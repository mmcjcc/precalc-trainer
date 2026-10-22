/**
 * Reading the grapher's rows. Each side of a row goes through the app's own parser (`@/engine` parseExpression, the
 * one that grades her work: implicit multiplication, |x|, √, logs written every way the TI-84 and her book write
 * them), so a row means here exactly what the same text means in a problem. What this file adds is the row's shape:
 *
 *   y = 2x + 1, 2x + 1 = y, or a bare expression in x     a curve
 *   f(x) = x^2 (any one letter but x, y and e)             her function, graphed and usable in later rows: g(x) = f(x − 2)
 *   x = 3                                                  a vertical line
 *   (3, 4), or (1, 2), (3, 4)                              points
 *   y < x^2, y >= 2x − 1, x^2 > y                          shading below or above (dashed edge for < and >)
 *   x <= 2                                                 shading left or right of a vertical line
 *   2x + 3y = 6, 2x + 3y < 6                               an equation or inequality with y in it once, solved for y
 *   a = 2                                                  a value for a letter (shown with a slider)
 *   y = x^2 {x > 0}, y = 6 {1 <= x < 3}                    a restriction at the end: only where it holds
 *
 * Any other letter (a, b, h, k...) is a slider. Her functions are found first, by name, across all the rows; a call
 * f(…) of one of them is then rewritten as a carrier call the parser keeps whole (`nthroot(…, −(1000 + k))`, see
 * compile.ts), so f(x)^2 and 2f(x − 1) parse as calls, while a(x − h)^2 stays a times (x − h)^2. Every error is a
 * sentence for her, with where in her text it is. Pure.
 */
import type { MathNode } from 'mathjs'
import { parseExpression, parseStatement } from '@/engine'
import { FUNC_NAMES, collectVars } from '@/engine/math'
import type { RelOp } from '@/shared/types'

/** A relation sign as typed: the app's five, and ≠ (which the grapher turns away with a sentence). */
export type RowRel = RelOp | '!='
import { CARRIER_BASE, CARRIER_NAME, carrierIndex } from './compile'

export interface RowError {
  message: string
  /** 0-based index into her text, when it points at one place. */
  position?: number
  length?: number
}

export type Ineq = '<' | '<=' | '>' | '>='

export interface Restriction {
  /** OR of ANDs of relations in x (and slider letters). */
  disjuncts: { lhs: MathNode; op: RelOp; rhs: MathNode }[][]
  /** Carrier text of the condition, for the preview. */
  text: string
}

export type RowShape =
  | { kind: 'empty' }
  | { kind: 'error'; error: RowError }
  | { kind: 'curve'; expr: MathNode; restrict: Restriction | null }
  | { kind: 'define'; name: string; display: string; expr: MathNode; restrict: Restriction | null }
  | { kind: 'implicit'; lhs: MathNode; rhs: MathNode; op: '=' | Ineq; restrict: Restriction | null }
  | { kind: 'region'; expr: MathNode; op: Ineq; restrict: Restriction | null }
  | { kind: 'vline'; expr: MathNode }
  | { kind: 'xregion'; expr: MathNode; op: Ineq }
  | { kind: 'points'; points: { x: MathNode; y: MathNode }[] }
  | { kind: 'constant'; name: string; display: string; expr: MathNode }

/** What the KaTeX preview draws: the row's pieces in carrier text (preview.ts turns carriers back into f(…)). */
export type TexPlan =
  | { kind: 'none' }
  | { kind: 'plain'; text: string }
  | { kind: 'expr'; text: string; restrict?: string }
  | { kind: 'relation'; left: string; op: RowRel; right: string; restrict?: string }
  | { kind: 'define'; display: string; body: string; restrict?: string }
  | { kind: 'points'; points: [string, string][] }

export interface RowParse {
  shape: RowShape
  /** Slider letters this row uses (not x, y, e or a function's name), in the order they appear. */
  letters: string[]
  /** Her functions this row calls, by name. */
  calls: string[]
  tex: TexPlan
}

export interface FunctionInfo {
  /** Lower-case key (the parser reads letters in lower case). */
  name: string
  /** As she typed it: A(x) keeps its capital. */
  display: string
  /** Carrier index. */
  index: number
  /** Row that defines it. */
  row: number
}

export interface ParsedRows {
  rows: RowParse[]
  /** Her functions, by name. */
  functions: Map<string, FunctionInfo>
  /** Bodies by carrier index (for compile.ts). */
  bodies: Map<number, MathNode>
  /** Letters given a value by a row (a = 2), with that row's index. */
  constants: Map<string, number>
  /** Every slider letter in use, in order of first appearance, without the constants. */
  sliders: string[]
}

const ALL_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')
/** Letters that are never sliders or names: the variables and Euler's number. */
const RESERVED = new Set(['x', 'y', 'e'])

// ---------------------------------------------------------------------------------------------------------------
// Text with a map back to her own characters
// ---------------------------------------------------------------------------------------------------------------

/** A string and, for each of its characters, where it came from in her text. */
interface Mapped {
  text: string
  origin: number[]
}

const GLYPHS: [RegExp, string][] = [
  [/^[−–—]/, '-'],
  [/^≤/, '<='],
  [/^≥/, '>='],
  [/^≠/, '!='],
  [/^[·×]/, '*'],
  [/^÷/, '/'],
  [/^∞/, 'inf'],
  [/^π/, 'pi'],
  [/^∛/, 'cbrt'],
  [/^√/, 'sqrt'],
  [/^±/, '+-'],
  [/^²/, '^2'],
  [/^³/, '^3'],
  [/^θ/, 'x'],
]

/** The function names a space may follow without meaning "times" (ln x, log 100: the engine reads those). */
function endsWithFunctionName(word: string): boolean {
  const segs = segmentLetters(word)
  const last = segs[segs.length - 1]
  return last !== undefined && last.text.length > 1 && last.text !== 'pi' && last.text !== 'inf'
}

/**
 * The symbol strip's glyphs in ASCII (the engine's normalizeGlyphs, plus ² and ³), keeping a map to her text. A space
 * between two letters means times unless a function name comes before it: the engine drops spaces, so "a sin(x)"
 * would otherwise be asin(x), the arcsine.
 */
function normalize(raw: string): Mapped {
  let text = ''
  const origin: number[] = []
  let i = 0
  while (i < raw.length) {
    const ch = raw[i]!
    if (/\s/.test(ch)) {
      let j = i
      while (j < raw.length && /\s/.test(raw[j]!)) j++
      const before = /[A-Za-z]+$/.exec(text)?.[0]
      const after = raw[j]
      if (before && after !== undefined && /[A-Za-z]/.test(after) && !endsWithFunctionName(before)) {
        text += '*'
        origin.push(i)
        i = j
        continue
      }
    }
    const rest = raw.slice(i, i + 1)
    const hit = GLYPHS.find(([re]) => re.test(rest))
    const out = hit ? hit[1] : ch
    for (let k = 0; k < out.length; k++) origin.push(i)
    text += out
    i++
  }
  return { text, origin }
}

function slice(m: Mapped, start: number, end = m.text.length): Mapped {
  return { text: m.text.slice(start, end), origin: m.origin.slice(start, end) }
}

function trimMapped(m: Mapped): Mapped {
  const lead = m.text.length - m.text.trimStart().length
  const trail = m.text.length - m.text.trimEnd().length
  return slice(m, lead, m.text.length - trail)
}

function originAt(m: Mapped, pos: number, fallback: number): number {
  if (m.origin.length === 0) return fallback
  return m.origin[Math.max(0, Math.min(pos, m.origin.length - 1))]!
}

// ---------------------------------------------------------------------------------------------------------------
// Top-level scanning
// ---------------------------------------------------------------------------------------------------------------

const OPENERS = '([{'
const CLOSERS = ')]}'

/** Index of the bracket closing the one at `open`, or -1. */
function matchingClose(s: string, open: number): number {
  let depth = 0
  for (let k = open; k < s.length; k++) {
    if (OPENERS.includes(s[k]!)) depth++
    else if (CLOSERS.includes(s[k]!)) {
      depth--
      if (depth === 0) return k
    }
  }
  return -1
}

interface OpHit {
  index: number
  op: RowRel
}

const REL_OPS: RowRel[] = ['<=', '>=', '!=', '=', '<', '>']

function topLevelRelations(s: string): OpHit[] {
  const hits: OpHit[] = []
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    if (OPENERS.includes(c)) depth++
    else if (CLOSERS.includes(c)) depth = Math.max(0, depth - 1)
    if (depth !== 0) continue
    const op = REL_OPS.find((o) => s.startsWith(o, i))
    if (op) {
      hits.push({ index: i, op })
      i += op.length - 1
    }
  }
  return hits
}

function topLevelCommas(s: string): number[] {
  const out: number[] = []
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    if (OPENERS.includes(c)) depth++
    else if (CLOSERS.includes(c)) depth = Math.max(0, depth - 1)
    else if (c === ',' && depth === 0) out.push(i)
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Her functions: names, and calls rewritten as carriers
// ---------------------------------------------------------------------------------------------------------------

/** The engine's names a run of letters can hold (longest first), as its tokenizer splits "xsin" into x·sin. */
const SEGMENT_NAMES: readonly string[] = [...new Set([...FUNC_NAMES].map((n) => n.toLowerCase()).filter((n) => /^[a-z]{2,}$/.test(n)).concat('pi', 'inf', 'infinity'))].sort(
  (a, b) => b.length - a.length,
)

/** Split a run of letters the way the engine's tokenizer does: known names whole, the rest letter by letter. */
export function segmentLetters(run: string): { text: string; start: number }[] {
  const lower = run.toLowerCase()
  if (FUNC_NAMES.has(run) || SEGMENT_NAMES.includes(lower)) return [{ text: lower, start: 0 }]
  const out: { text: string; start: number }[] = []
  let i = 0
  while (i < lower.length) {
    const name = SEGMENT_NAMES.find((n) => lower.startsWith(n, i))
    if (name) {
      out.push({ text: name, start: i })
      i += name.length
    } else {
      out.push({ text: lower[i]!, start: i })
      i++
    }
  }
  return out
}

const DEFINE = /^\s*([A-Za-z])\s*\(\s*([A-Za-z])\s*\)\s*=(?![=<>])/
const CONSTANT = /^\s*([A-Za-z])\s*=(?![=<>])/

/**
 * Rewrite each call f(…) of her functions as `nthroot(…, -(1000 + k))`, which the engine's parser keeps whole (its
 * tokenizer knows nthroot) and compile.ts turns back into the call. The map still points at her characters.
 */
function withCarriers(m: Mapped, functions: ReadonlyMap<string, FunctionInfo>, calls: Set<string>): Mapped {
  if (functions.size === 0) return m
  const s = m.text
  let text = ''
  const origin: number[] = []
  const emit = (str: string, from: number) => {
    text += str
    for (let k = 0; k < str.length; k++) origin.push(from)
  }
  /** Where each carrier's tag goes: the index of its closing parenthesis → the tag text. */
  const tags = new Map<number, string>()
  let i = 0
  while (i < s.length) {
    const c = s[i]!
    if (/[A-Za-z]/.test(c)) {
      let j = i
      while (j < s.length && /[A-Za-z]/.test(s[j]!)) j++
      let k = j
      while (k < s.length && s[k] === ' ') k++
      const segs = segmentLetters(s.slice(i, j))
      const last = segs[segs.length - 1]!
      const fn = s[k] === '(' && last.text.length === 1 ? functions.get(last.text) : undefined
      const close = fn ? matchingClose(s, k) : -1
      if (fn && close > 0) {
        calls.add(fn.name)
        // The letters before the name stay as they were (a·f(x)), with an explicit × so they cannot run into the
        // carrier's name; the name becomes the carrier.
        for (let p = i; p < i + last.start; p++) emit(s[p]!, m.origin[p]!)
        emit(`${last.start > 0 ? '*' : ' '}${CARRIER_NAME}`, m.origin[i + last.start]!)
        for (let p = i + last.start + 1; p < k; p++) emit(s[p]!, m.origin[p]!)
        tags.set(close, `, -${CARRIER_BASE + fn.index}`)
        i = k
        continue
      }
      for (let p = i; p < j; p++) emit(s[p]!, m.origin[p]!)
      i = j
      continue
    }
    const tag = tags.get(i)
    if (tag) emit(tag, m.origin[i]!)
    emit(c, m.origin[i]!)
    i++
  }
  return { text, origin }
}

// ---------------------------------------------------------------------------------------------------------------
// Sides
// ---------------------------------------------------------------------------------------------------------------

class RowFail extends Error {
  readonly error: RowError
  constructor(error: RowError) {
    super(error.message)
    this.error = error
  }
}

function fail(message: string, position?: number, length?: number): never {
  throw new RowFail({ message, ...(position !== undefined ? { position } : {}), ...(length !== undefined ? { length } : {}) })
}

interface Side {
  node: MathNode
  /** Carrier text (for the preview). */
  text: string
  letters: Set<string>
  usesX: boolean
  usesY: boolean
}

/** Every SymbolNode name in a tree (function names left out). */
function symbolsOf(node: MathNode): Set<string> {
  return new Set(collectVars(node))
}

function parseSide(m: Mapped, ctx: ParseCtx, what = 'that side'): Side {
  const t = trimMapped(m)
  if (!t.text) fail(`${what[0]!.toUpperCase()}${what.slice(1)} is empty.`, originAt(m, 0, ctx.end))
  const carried = withCarriers(t, ctx.functions, ctx.calls)
  const p = parseExpression(carried.text, ALL_LETTERS)
  if (!p.ok) {
    const at = originAt(carried, p.error.position, originAt(t, 0, 0))
    fail(p.error.message, at, p.error.length)
  }
  const letters = symbolsOf(p.node)
  for (const name of letters) {
    if (ctx.functions.has(name)) {
      const fn = ctx.functions.get(name)!
      fail(`${fn.display} is a function: write ${fn.display}(x), or ${fn.display}(2) for one value.`)
    }
  }
  return { node: p.node, text: carried.text, letters, usesX: letters.has('x'), usesY: letters.has('y') }
}

interface ParseCtx {
  functions: ReadonlyMap<string, FunctionInfo>
  calls: Set<string>
  /** Length of her text, for errors at the end. */
  end: number
}

const isExactly = (m: Mapped, letter: string) => m.text.trim().toLowerCase() === letter

function flip(op: Ineq): Ineq {
  return op === '<' ? '>' : op === '>' ? '<' : op === '<=' ? '>=' : '<='
}

function constantSide(side: Side, what: string): Side {
  if (side.usesX || side.usesY) fail(what)
  return side
}

/** Restrictions at the end of the row: {x > 0}, {1 <= x < 3}, several in a row. */
function splitRestrictions(m: Mapped, ctx: ParseCtx): { main: Mapped; conds: Mapped[] } {
  let main = trimMapped(m)
  const conds: Mapped[] = []
  for (let guard = 0; guard < 6 && main.text.endsWith('}'); guard++) {
    const s = main.text
    let depth = 0
    let open = -1
    for (let k = s.length - 1; k >= 0; k--) {
      if (CLOSERS.includes(s[k]!)) depth++
      else if (OPENERS.includes(s[k]!)) {
        depth--
        if (depth === 0) {
          open = k
          break
        }
      }
    }
    if (open < 0 || s[open] !== '{') fail('A { is missing: a restriction goes in braces, like {x > 0}.', originAt(main, s.length - 1, ctx.end))
    conds.unshift(slice(main, open + 1, s.length - 1))
    main = trimMapped(slice(main, 0, open))
  }
  if (main.text.includes('{') || main.text.includes('}')) {
    const at = Math.max(main.text.indexOf('{'), main.text.indexOf('}'))
    fail('Braces hold a restriction at the end of the row, like y = x^2 {x > 0}.', originAt(main, at, ctx.end))
  }
  return { main, conds }
}

function parseRestriction(conds: Mapped[], ctx: ParseCtx, letters: Set<string>): Restriction | null {
  if (conds.length === 0) return null
  const disjuncts: Restriction['disjuncts'] = [[]]
  const texts: string[] = []
  for (const cond of conds) {
    const t = trimMapped(cond)
    if (!t.text) fail('The braces are empty: write a condition on x inside, like {x > 0}.', originAt(cond, 0, ctx.end))
    const carried = withCarriers(t, ctx.functions, ctx.calls)
    const p = parseStatement(carried.text, ALL_LETTERS)
    if (!p.ok) {
      const message = /needs both sides/.test(p.error.message) ? 'A restriction is a condition on x, like {x > 0} or {1 <= x < 3}.' : p.error.message
      fail(message, originAt(carried, p.error.position, originAt(t, 0, 0)), p.error.length)
    }
    const used = new Set<string>()
    for (const clause of p.statement.disjuncts) {
      for (const r of clause) for (const v of [...collectVars(r.lhs), ...collectVars(r.rhs)]) used.add(v)
    }
    if (used.has('y')) fail('A restriction is a condition on x only, like {x > 0}.', originAt(t, 0, 0))
    if (!used.has('x')) fail('A restriction needs x in it, like {x > 0}.', originAt(t, 0, 0))
    for (const v of used) if (v !== 'x') letters.add(v)
    // AND of the braces: each brace's OR distributes over what came before.
    const next: Restriction['disjuncts'] = []
    for (const before of disjuncts) {
      for (const clause of p.statement.disjuncts) next.push([...before, ...clause.map((r) => ({ lhs: r.lhs, op: r.op, rhs: r.rhs }))])
    }
    disjuncts.splice(0, disjuncts.length, ...next)
    texts.push(carried.text)
  }
  return { disjuncts, text: texts.join(', ') }
}

function tryPoints(main: Mapped, ctx: ParseCtx, letters: Set<string>): { points: { x: MathNode; y: MathNode }[]; tex: [string, string][] } | null {
  const s = main.text
  if (!s.startsWith('(')) return null
  const pieces: Mapped[] = []
  let start = 0
  for (const comma of [...topLevelCommas(s), s.length]) {
    pieces.push(trimMapped(slice(main, start, comma)))
    start = comma + 1
  }
  // Every piece must be one parenthesized pair: "(3, 4)".
  const pairs: [Mapped, Mapped][] = []
  for (const piece of pieces) {
    const t = piece.text
    if (!t.startsWith('(') || matchingClose(t, 0) !== t.length - 1) return null
    const inner = slice(piece, 1, t.length - 1)
    const commas = topLevelCommas(inner.text)
    if (commas.length !== 1) {
      if (pieces.length === 1 && commas.length === 0) return null // (x + 1): an expression
      fail('A point has two coordinates, like (3, 4).', originAt(piece, 0, ctx.end))
    }
    pairs.push([slice(inner, 0, commas[0]!), slice(inner, commas[0]! + 1)])
  }
  const points: { x: MathNode; y: MathNode }[] = []
  const tex: [string, string][] = []
  for (const [mx, my] of pairs) {
    const sx = constantSide(parseSide(mx, ctx, 'a coordinate'), 'A point’s coordinates are numbers (or slider letters), like (3, 4) or (a, 2).')
    const sy = constantSide(parseSide(my, ctx, 'a coordinate'), 'A point’s coordinates are numbers (or slider letters), like (3, 4) or (a, 2).')
    for (const l of [...sx.letters, ...sy.letters]) letters.add(l)
    points.push({ x: sx.node, y: sy.node })
    tex.push([sx.text, sy.text])
  }
  return { points, tex }
}

function addLetters(target: Set<string>, side: Side) {
  for (const l of side.letters) if (l !== 'x' && l !== 'y') target.add(l)
}

/** One row, given her functions. */
function parseOne(raw: string, ctx: ParseCtx, defines: FunctionInfo | null, constant: string | null): { shape: RowShape; letters: Set<string>; tex: TexPlan } {
  const letters = new Set<string>()
  const m = normalize(raw)
  if (!m.text.trim()) return { shape: { kind: 'empty' }, letters, tex: { kind: 'none' } }

  if (defines) {
    const head = DEFINE.exec(m.text)!
    const variable = head[2]!.toLowerCase()
    if (variable !== 'x') fail(`Write ${defines.display} in x: ${defines.display}(x) = …`, m.text.indexOf(head[2]!), 1)
    const { main, conds } = splitRestrictions(slice(m, head[0].length), ctx)
    // A restriction on the definition would leave its calls unsure of where it holds: it goes on a row that graphs it.
    if (conds.length) fail(`Put the restriction on a row that graphs ${defines.display}: y = ${defines.display}(x) {x > 0}.`)
    const body = parseSide(main, ctx, `the formula of ${defines.display}`)
    if (body.usesY) fail(`${defines.display}(x) is a formula in x: leave y out of it.`)
    addLetters(letters, body)
    return {
      shape: { kind: 'define', name: defines.name, display: defines.display, expr: body.node, restrict: null },
      letters,
      tex: { kind: 'define', display: defines.display, body: body.text },
    }
  }

  const { main, conds } = splitRestrictions(m, ctx)
  if (!main.text) fail('Write something before the braces, like y = x^2 {x > 0}.', 0)

  const points = conds.length === 0 ? tryPoints(main, ctx, letters) : null
  if (points) return { shape: { kind: 'points', points: points.points }, letters, tex: { kind: 'points', points: points.tex } }

  const ops = topLevelRelations(main.text)
  const restrictLater = () => parseRestriction(conds, ctx, letters)
  if (ops.length === 0) {
    const side = parseSide(main, ctx, 'the row')
    if (side.usesY) fail('This row has y in it but no = sign. Write y = … with x on the other side.', originAt(main, main.text.toLowerCase().indexOf('y'), 0), 1)
    addLetters(letters, side)
    const restrict = restrictLater()
    return { shape: { kind: 'curve', expr: side.node, restrict }, letters, tex: { kind: 'expr', text: side.text, ...(restrict ? { restrict: restrict.text } : {}) } }
  }
  if (ops.length > 1) {
    const second = ops[1]!
    const equals = ops.every((o) => o.op === '=')
    fail(
      equals ? 'One = sign per row. Put each equation in its own row.' : 'One comparison per row. Put each one in its own row, or use a restriction: y = x^2 {0 < x < 3}.',
      originAt(main, second.index, ctx.end),
      second.op.length,
    )
  }
  const hit = ops[0]!
  if (hit.op === '!=') fail('≠ is not graphed. Use <, ≤, > or ≥.', originAt(main, hit.index, ctx.end), 2)
  const left = slice(main, 0, hit.index)
  const right = slice(main, hit.index + hit.op.length)
  if (!left.text.trim()) fail('The left side is empty.', originAt(main, hit.index, ctx.end))
  if (!right.text.trim()) fail('The right side is empty: write something after the sign.', originAt(main, hit.index, ctx.end), hit.op.length)

  if (hit.op === '=') {
    if (constant) {
      const value = parseSide(right, ctx, 'the value')
      if (value.usesX || value.usesY) {
        fail(`${constant} = … gives the letter ${constant.toLowerCase()} one value. To graph a formula, write y = … or ${constant === constant.toUpperCase() && constant !== 'Y' ? constant : 'f'}(x) = ….`)
      }
      addLetters(letters, value)
      if (conds.length) fail('A restriction goes on a curve, not on a value.')
      return { shape: { kind: 'constant', name: constant.toLowerCase(), display: constant, expr: value.node }, letters, tex: { kind: 'relation', left: constant, op: '=', right: value.text } }
    }
    if (isExactly(left, 'y') || isExactly(right, 'y')) {
      const expr = parseSide(isExactly(left, 'y') ? right : left, ctx)
      if (expr.usesY) fail('y is on both sides. Write y = … with only x on the other side.')
      addLetters(letters, expr)
      const restrict = restrictLater()
      return { shape: { kind: 'curve', expr: expr.node, restrict }, letters, tex: { kind: 'relation', left: 'y', op: '=', right: expr.text, ...(restrict ? { restrict: restrict.text } : {}) } }
    }
    if (isExactly(left, 'x') || isExactly(right, 'x')) {
      const c = parseSide(isExactly(left, 'x') ? right : left, ctx)
      if (c.usesY) fail('This grapher draws x = a number, a vertical line. For a curve, write y = … in terms of x.')
      if (c.usesX) fail('x is on both sides. For a vertical line write x = a number, like x = 3.')
      if (conds.length) fail('A restriction goes on a curve, not on a vertical line.')
      addLetters(letters, c)
      return { shape: { kind: 'vline', expr: c.node }, letters, tex: { kind: 'relation', left: 'x', op: '=', right: c.text } }
    }
  }

  const ineq = hit.op as Ineq
  if (hit.op !== '=') {
    if (isExactly(left, 'y') || isExactly(right, 'y')) {
      const onLeft = isExactly(left, 'y')
      const expr = parseSide(onLeft ? right : left, ctx)
      if (expr.usesY) fail('y is on both sides. Write y < … (or ≤, >, ≥) with only x on the other side.')
      addLetters(letters, expr)
      const op = onLeft ? ineq : flip(ineq)
      const restrict = restrictLater()
      return { shape: { kind: 'region', expr: expr.node, op, restrict }, letters, tex: { kind: 'relation', left: 'y', op, right: expr.text, ...(restrict ? { restrict: restrict.text } : {}) } }
    }
    if (isExactly(left, 'x') || isExactly(right, 'x')) {
      const onLeft = isExactly(left, 'x')
      const c = parseSide(onLeft ? right : left, ctx)
      if (c.usesX || c.usesY) fail('Shading beside a vertical line needs a number on the other side, like x < 3.')
      if (conds.length) fail('A restriction goes on a curve, not on x < a number.')
      addLetters(letters, c)
      const op = onLeft ? ineq : flip(ineq)
      return { shape: { kind: 'xregion', expr: c.node, op }, letters, tex: { kind: 'relation', left: 'x', op, right: c.text } }
    }
  }

  // Both sides are expressions: y must be in it (once, linearly; checked when it is compiled with the sliders' values).
  const l = parseSide(left, ctx, 'the left side')
  const r = parseSide(right, ctx, 'the right side')
  if (!l.usesY && !r.usesY) {
    if (!l.usesX && !r.usesX) fail('There is no x or y here to graph.')
    if (hit.op === '=') {
      fail('There is no y here. To see where the two sides are equal, graph y = (left side) and y = (right side) in two rows and look where they cross.')
    }
    fail('There is no y here. Write it as y < … (or ≤, >, ≥) to shade, or compare the two sides as two curves.')
  }
  addLetters(letters, l)
  addLetters(letters, r)
  const restrict = restrictLater()
  return {
    shape: { kind: 'implicit', lhs: l.node, rhs: r.node, op: hit.op === '=' ? '=' : ineq, restrict },
    letters,
    tex: { kind: 'relation', left: l.text, op: hit.op, right: r.text, ...(restrict ? { restrict: restrict.text } : {}) },
  }
}

/** Where a letter first appears in her text, ignoring function names (sin, sqrt...), for the order of the sliders. */
function firstIndex(raw: string, letter: string): number {
  const masked = raw.toLowerCase().replace(/[a-z]+/g, (run) =>
    segmentLetters(run)
      .map((s) => (s.text.length > 1 ? ' '.repeat(s.text.length) : s.text))
      .join(''),
  )
  const at = masked.indexOf(letter)
  return at < 0 ? Number.MAX_SAFE_INTEGER : at
}

/** Carrier calls inside a parsed body (for the definitions' dependencies). */
function callsIn(node: MathNode): number[] {
  const out: number[] = []
  node.traverse((n) => {
    const k = carrierIndex(n)
    if (k !== null) out.push(k)
  })
  return out
}

/**
 * Read every row. Function names come first, from the rows that define them (f(x) = …), so a call in any row is a
 * call; a name defined twice, a function that calls itself (or a circle of them) and a letter used both as a function
 * and as a value are errors on the rows involved.
 */
export function parseRows(texts: readonly string[]): ParsedRows {
  const functions = new Map<string, FunctionInfo>()
  const constants = new Map<string, number>()
  const defineOf: (FunctionInfo | null)[] = []
  const constantOf: (string | null)[] = []
  const early = new Map<number, RowError>()

  texts.forEach((raw, row) => {
    defineOf.push(null)
    constantOf.push(null)
    const t = normalize(raw).text
    const def = DEFINE.exec(t)
    if (def) {
      const display = def[1]!
      const name = display.toLowerCase()
      if (RESERVED.has(name)) return
      const before = functions.get(name) ?? (constants.has(name) ? null : undefined)
      if (before !== undefined) {
        early.set(row, { message: before ? `${display} is already defined in row ${before.row + 1}. Use another letter, like g.` : `${display} already has a value in row ${constants.get(name)! + 1}.` })
        return
      }
      const info: FunctionInfo = { name, display, index: functions.size, row }
      functions.set(name, info)
      defineOf[row] = info
      return
    }
    const con = CONSTANT.exec(t)
    if (con) {
      const display = con[1]!
      const name = display.toLowerCase()
      if (RESERVED.has(name)) return
      if (functions.has(name)) {
        early.set(row, { message: `${display} is a function (row ${functions.get(name)!.row + 1}). Give the value to another letter.` })
        return
      }
      if (constants.has(name)) {
        early.set(row, { message: `${display} already has a value in row ${constants.get(name)! + 1}.` })
        return
      }
      constants.set(name, row)
      constantOf[row] = display
    }
  })

  const rows: RowParse[] = texts.map((raw, row) => {
    const calls = new Set<string>()
    const ctx: ParseCtx = { functions, calls, end: raw.length }
    const pre = early.get(row)
    if (pre) return { shape: { kind: 'error', error: pre }, letters: [], calls: [], tex: { kind: 'plain', text: normalize(raw).text } }
    try {
      const { shape, letters, tex } = parseOne(raw, ctx, defineOf[row] ?? null, constantOf[row] ?? null)
      const ordered = [...letters].filter((l) => !RESERVED.has(l) && !functions.has(l)).sort((a, b) => firstIndex(raw, a) - firstIndex(raw, b))
      return { shape, letters: ordered, calls: [...calls], tex }
    } catch (e) {
      if (e instanceof RowFail) return { shape: { kind: 'error', error: e.error }, letters: [], calls: [...calls], tex: { kind: 'plain', text: normalize(raw).text } }
      throw e
    }
  })

  // A function must not reach itself through its calls.
  const bodies = new Map<number, MathNode>()
  const byIndex = new Map<number, FunctionInfo>()
  for (const fn of functions.values()) byIndex.set(fn.index, fn)
  for (const fn of functions.values()) {
    const shape = rows[fn.row]!.shape
    if (shape.kind === 'define') bodies.set(fn.index, shape.expr)
  }
  const reaches = (from: number, target: number, seen = new Set<number>()): boolean => {
    const body = bodies.get(from)
    if (!body) return false
    for (const k of callsIn(body)) {
      if (k === target) return true
      if (!seen.has(k)) {
        seen.add(k)
        if (reaches(k, target, seen)) return true
      }
    }
    return false
  }
  for (const fn of functions.values()) {
    if (reaches(fn.index, fn.index)) {
      rows[fn.row] = { ...rows[fn.row]!, shape: { kind: 'error', error: { message: `${fn.display} is defined in terms of itself. A function’s formula can use other functions, not its own name.` } } }
    }
  }
  // A body that is now an error (or a call of an undefined body) leaves no body.
  for (const fn of functions.values()) if (rows[fn.row]!.shape.kind !== 'define') bodies.delete(fn.index)
  // A row that calls a function whose definition is in error is in error too.
  rows.forEach((r, i) => {
    if (r.shape.kind === 'error' || r.shape.kind === 'empty') return
    const broken = r.calls.map((n) => functions.get(n)!).find((fn) => !bodies.has(fn.index))
    if (broken) rows[i] = { ...r, shape: { kind: 'error', error: { message: `${broken.display} has a problem in row ${broken.row + 1}; fix it there first.` } } }
  })

  const sliders: string[] = []
  for (const r of rows) for (const l of r.letters) if (!constants.has(l) && !sliders.includes(l)) sliders.push(l)
  for (const fn of functions.values()) {
    // Function names are never sliders, even where a row is in error.
    const at = sliders.indexOf(fn.name)
    if (at >= 0) sliders.splice(at, 1)
  }
  return { rows, functions, bodies, constants, sliders }
}

/** Why a row cannot be read, as one sentence, or null when it can. */
export function rowError(r: RowParse): RowError | null {
  return r.shape.kind === 'error' ? r.shape.error : null
}
