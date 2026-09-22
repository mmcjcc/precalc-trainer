/**
 * Printers for the functions core: app-syntax text of a parse tree (round-trips through the parser),
 * the canonical "simplified" text (rational parts expanded and reduced), set texts (interval notation
 * and set-builder with ≠ where a textbook would use it), and display prettifying.
 *
 * Convention: fields named `interval`, `builder`, `text`, `expr` are ASCII app syntax (what the student
 * types; `parseInterval` / `parseSetAnswer` / `parseExpression` read them back). Sentences meant to be
 * read (explanations, witnesses) go through `pretty` (− ≥ ≤ ≠ ∞ ∪).
 */
import type { Piece, Rational, SolutionSet } from '@/shared/types'
import { ratToString } from '@/notation/rational'
import { endpointToString, normalizeSet, setIsAllReals, setToInterval, setToSetBuilder } from '@/notation/sets/solutionSet'
import { collectVars, fnName, isOp, isUnaryMinus, nodeArgs, type MathNode } from '../math'
import { normalizeGlyphs } from '../parse'
import { exactConstant, exactEval, surdToText, Unsupported, type Surd } from './exact'
import { polyDeg, polyTermCount, ratFnOf, ratFnReduce, ratFnToText } from './poly'

// ---------------------------------------------------------------------------
// Tree printer
// ---------------------------------------------------------------------------

const SUM = 1
const NEG = 3
const PROD = 2
const POW = 4
const ATOM = 5

export interface Printed {
  text: string
  prec: number
}

/** A printer hook: return a replacement for `node`, or null to print it structurally. */
export type PrintOverride = (node: MathNode) => Printed | null

function unwrap(node: MathNode): MathNode {
  let n = node
  while (n.type === 'ParenthesisNode') n = (n as unknown as { content: MathNode }).content
  return n
}

const wrap = (p: Printed, cond: boolean) => (cond ? `(${p.text})` : p.text)

/** Precedence of a printed text (top-level sum, leading minus, power, atom or product). */
export function textPrec(text: string): number {
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (depth === 0 && i > 0 && (c === '+' || c === '-') && text[i - 1] === ' ') return SUM
  }
  if (text.startsWith('-')) return NEG
  if (/^([a-z]|\d+(\.\d+)?)$/.test(text)) return ATOM
  if (/^[a-z]\^\d+$/.test(text)) return POW
  const call = text.match(/^[A-Za-z]+\(/)
  if (call && text.endsWith(')')) {
    let d = 0
    for (let i = call[0].length - 1; i < text.length; i++) {
      if (text[i] === '(') d++
      else if (text[i] === ')') {
        d--
        if (d === 0 && i < text.length - 1) return PROD
      }
    }
    return ATOM
  }
  return PROD
}

/** App-syntax text of a tree (implicit multiplication, `sqrt(...)`, `cbrt(...)`, `abs(...)`). */
export function printNode(node: MathNode, override?: PrintOverride): Printed {
  const n = unwrap(node)
  if (override) {
    const o = override(n)
    if (o) return o
  }
  const rec = n as unknown as Record<string, unknown>
  if (n.type === 'ConstantNode') return { text: String(rec.value), prec: ATOM }
  if (n.type === 'SymbolNode') return { text: String(rec.name), prec: ATOM }
  const args = nodeArgs(n)
  if (n.type === 'FunctionNode') {
    const name = fnName(n) ?? 'f'
    if (name === 'nthRoot' && args.length === 2) {
      let k: string
      try {
        k = ratToString(exactConstant(args[1]!))
      } catch {
        k = printNode(args[1]!, override).text
      }
      const inner = printNode(args[0]!, override).text
      return { text: k === '3' ? `cbrt(${inner})` : `nthRoot(${inner}, ${k})`, prec: ATOM }
    }
    return { text: `${name}(${args.map((a) => printNode(a, override).text).join(', ')})`, prec: ATOM }
  }
  if (n.type !== 'OperatorNode') return { text: n.toString(), prec: ATOM }
  if (isUnaryMinus(n)) {
    const a = printNode(args[0]!, override)
    return { text: `-${wrap(a, a.prec === SUM || a.prec === NEG)}`, prec: NEG }
  }
  if (rec.fn === 'unaryPlus') return printNode(args[0]!, override)
  const a = printNode(args[0]!, override)
  const b = printNode(args[1]!, override)
  if (isOp(n, '+')) {
    return { text: b.text.startsWith('-') ? `${a.text} - ${b.text.slice(1)}` : `${a.text} + ${b.text}`, prec: SUM }
  }
  if (isOp(n, '-')) return { text: `${a.text} - ${wrap(b, b.prec === SUM || b.prec === NEG)}`, prec: SUM }
  if (isOp(n, '*')) {
    const leftIsDiv = isOp(unwrap(args[0]!), '/')
    const rightIsDiv = isOp(unwrap(args[1]!), '/')
    const left = wrap(a, a.prec === SUM || leftIsDiv)
    const right = wrap(b, b.prec === SUM || b.prec === NEG || rightIsDiv)
    const endsDigitOrParen = /[\d)]$/.test(left)
    const endsLetter = /[a-z]$/i.test(left)
    const startsLetter = /^[a-z]/i.test(right)
    const startsParen = right.startsWith('(')
    const juxtapose = (endsDigitOrParen && (startsLetter || startsParen)) || (endsLetter && startsParen)
    return { text: juxtapose ? `${left}${right}` : `${left} * ${right}`, prec: PROD }
  }
  if (isOp(n, '/')) {
    return { text: `${wrap(a, a.prec === SUM)}/${wrap(b, b.prec < POW)}`, prec: PROD }
  }
  if (isOp(n, '^')) {
    return { text: `${wrap(a, a.prec < ATOM)}^${wrap(b, b.prec < ATOM)}`, prec: POW }
  }
  return { text: n.toString(), prec: ATOM }
}

/** App-syntax text of a tree as written (structure kept). */
export function showNode(node: MathNode): string {
  return printNode(node).text
}

function hasVar(node: MathNode): boolean {
  return collectVars(node).length > 0
}

function surdPrec(s: Surd): number {
  return textPrec(surdToText(s))
}

/** Rational parts expanded and reduced, constants evaluated exactly, the rest printed as written. */
const canonicalOverride: PrintOverride = (node) => {
  if (!hasVar(node)) {
    try {
      const v = exactEval(node, null)
      if (v === 'undef') return null
      return { text: surdToText(v), prec: surdPrec(v) }
    } catch (e) {
      if (e instanceof Unsupported) return null
      throw e
    }
  }
  const rf = ratFnOf(node)
  if (!rf) return null
  try {
    const red = ratFnReduce(rf)
    const text = ratFnToText(red)
    const prec = polyDeg(red.den) > 0 ? (text.startsWith('-') ? NEG : PROD) : polyTermCount(red.num) > 1 ? SUM : textPrec(text)
    return { text, prec }
  } catch (e) {
    if (e instanceof Unsupported) return null
    throw e
  }
}

/** The simplified text of a tree: see `canonicalOverride`. */
export function canonicalText(node: MathNode): string {
  return printNode(node, canonicalOverride).text
}

// ---------------------------------------------------------------------------
// Substitution text
// ---------------------------------------------------------------------------

const X_TOKEN = /(?<![A-Za-z])x(?![A-Za-z])/g

function neighbors(s: string, index: number): { prev: string; next: string } {
  let i = index - 1
  while (i >= 0 && s[i] === ' ') i--
  let j = index + 1
  while (j < s.length && s[j] === ' ') j++
  return { prev: i >= 0 ? s[i]! : '', next: j < s.length ? s[j]! : '' }
}

/**
 * f with every x replaced by (g): "x^2 + 1", "x - 3" → "(x - 3)^2 + 1"; "2x + 1" → "2(x - 3) + 1".
 * No doubled parentheses where x already sits alone inside (): "sqrt(x)" → "sqrt(x - 3)". A single
 * letter goes in bare.
 */
export function substituteText(f: string, g: string): string {
  const src = normalizeGlyphs(f.trim())
  const inner = normalizeGlyphs(g.trim())
  if (/^[a-z]$/i.test(inner)) return src.replace(X_TOKEN, inner)
  // A single call such as sqrt(x) needs parentheses only under an exponent: (sqrt(x))^2, 2sqrt(x) + 1.
  const call = /^[A-Za-z]+\(/.test(inner) && textPrec(inner) === ATOM
  return src.replace(X_TOKEN, (_m, offset: number) => {
    const { prev, next } = neighbors(src, offset)
    const enclosed = (prev === '(' || prev === ',' || prev === '|') && (next === ')' || next === ',' || next === '|')
    return enclosed || (call && next !== '^') ? inner : `(${inner})`
  })
}

/** f with every x replaced by g's text and NO parentheses at all (the no-parentheses mistake). */
export function substituteBare(f: string, g: string): string {
  return normalizeGlyphs(f.trim()).replace(X_TOKEN, normalizeGlyphs(g.trim()))
}

/**
 * f with x replaced by a number, parenthesized only where needed: "x + 1" at 2 → "2 + 1",
 * "3x^2" at 2 → "3(2)^2", "x^2" at −1 → "(-1)^2".
 */
export function substituteValueText(f: string, value: string): string {
  const src = normalizeGlyphs(f.trim())
  const bareOk = /^\d+$/.test(value)
  return src.replace(X_TOKEN, (_m, offset: number) => {
    const { prev, next } = neighbors(src, offset)
    const enclosed = (prev === '(' || prev === ',' || prev === '|') && (next === ')' || next === ',' || next === '|')
    if (enclosed) return value
    // Next to a digit, letter or parenthesis the value would glue into an implicit product.
    const glued = /[\dA-Za-z)]/.test(prev) || /[\dA-Za-z(]/.test(next)
    return bareOk && !glued ? value : `(${value})`
  })
}

// ---------------------------------------------------------------------------
// Sets
// ---------------------------------------------------------------------------

function piecePredicate(p: Piece, v: string): string {
  if (p.lo === '-inf' && p.hi === 'inf') return `${v} in R`
  if (p.lo === '-inf') return `${v} ${p.hiClosed ? '<=' : '<'} ${endpointToString(p.hi)}`
  if (p.hi === 'inf') return `${v} ${p.loClosed ? '>=' : '>'} ${endpointToString(p.lo)}`
  return `${endpointToString(p.lo)} ${p.loClosed ? '<=' : '<'} ${v} ${p.hiClosed ? '<=' : '<'} ${endpointToString(p.hi)}`
}

/** One interval with finitely many points removed, when the set has that shape. */
function withHoles(set: SolutionSet): { base: Piece; holes: Rational[] } | null {
  const n = normalizeSet(set)
  if (n.points.length || !n.pieces.length) return null
  const merged: Piece[] = []
  const holes: Rational[] = []
  for (const p of n.pieces) {
    const last = merged[merged.length - 1]
    if (last && last.hi !== 'inf' && last.hi !== '-inf' && p.lo !== '-inf' && p.lo !== 'inf' && !last.hiClosed && !p.loClosed && last.hi.n * p.lo.d === p.lo.n * last.hi.d) {
      holes.push(p.lo)
      last.hi = p.hi
      last.hiClosed = p.hiClosed
    } else merged.push({ ...p })
  }
  if (merged.length !== 1 || !holes.length) return null
  return { base: merged[0]!, holes }
}

/**
 * The condition part of set-builder notation, ASCII: "x != 3", "x >= -2 and x != 3",
 * "x <= -3 or x >= 3", "x in R", "x = 2".
 */
export function predicateText(set: SolutionSet, v = 'x'): string {
  const n = normalizeSet(set)
  if (!n.pieces.length && !n.points.length) return 'no real number'
  if (setIsAllReals(n)) return `${v} in R`
  const h = withHoles(n)
  if (h) {
    const clauses: string[] = []
    if (!(h.base.lo === '-inf' && h.base.hi === 'inf')) clauses.push(piecePredicate(h.base, v))
    for (const p of h.holes) clauses.push(`${v} != ${ratToString(p)}`)
    return clauses.join(' and ')
  }
  const built = setToSetBuilder(n, v)
  return built.replace(/^\{[a-z] \| /, '').replace(/\}$/, '')
}

/** Set-builder notation, ASCII, with ≠ written as != where a textbook would: "{x | x >= -2 and x != 3}". */
export function builderText(set: SolutionSet, v = 'x'): string {
  const n = normalizeSet(set)
  if (!n.pieces.length && !n.points.length) return '{}'
  return `{${v} | ${predicateText(n, v)}}`
}

/** Interval notation, ASCII: "(-inf, 3) U (3, inf)". */
export function intervalText(set: SolutionSet): string {
  return setToInterval(set)
}

/** Reading text: "all real numbers", "all real numbers except 3 and -2", "x >= -2 and x != 3". */
export function describeText(set: SolutionSet, v = 'x'): string {
  const n = normalizeSet(set)
  if (!n.pieces.length && !n.points.length) return 'no real numbers'
  if (setIsAllReals(n)) return 'all real numbers'
  const h = withHoles(n)
  if (h && h.base.lo === '-inf' && h.base.hi === 'inf') {
    const pts = h.holes.map(ratToString)
    const list = pts.length === 1 ? pts[0]! : `${pts.slice(0, -1).join(', ')} and ${pts[pts.length - 1]}`
    return `all real numbers except ${list}`
  }
  return predicateText(n, v)
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** ASCII → reading text: − ≤ ≥ ≠ ∞ ∪ ℝ (sqrt/cbrt/abs stay as written). */
export function pretty(text: string): string {
  return text
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/!=/g, '≠')
    .replace(/(?<![A-Za-z])inf(?![A-Za-z])/g, '∞')
    .replace(/ U /g, ' ∪ ')
    .replace(/ in R(?![A-Za-z])/g, ' ∈ ℝ')
    .replace(/-/g, '−')
}

/** "(−∞, 3) ∪ (3, ∞)". */
export function prettySet(set: SolutionSet): string {
  return pretty(setToInterval(set))
}

/** A rational for a sentence: "−1/2". */
export function prettyRat(r: Rational): string {
  return pretty(ratToString(r))
}
