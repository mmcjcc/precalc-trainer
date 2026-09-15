import type { VarName } from '@/shared/types'
import { collectVars, compileExpression, FUNC_NAMES, type MathNode } from './math'
import type { ParseError, ParseResult, Relation, Statement } from './types'
import type { RelOp } from '@/shared/types'

const KEEP_IDENTS = new Set([...FUNC_NAMES, 'pi', 'e', 'inf', 'infinity', 'oo'])
const DEFAULT_VARS: readonly string[] = ['x', 'y', 'n']

type Tok =
  | { kind: 'num' | 'id' | 'op' | 'comma'; text: string }
  | { kind: 'lparen' | 'rparen'; text: string }

/** Symbol-strip glyphs → ASCII calculator syntax. */
export function normalizeGlyphs(input: string): string {
  return input
    .replace(/[−–—]/g, '-')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≠/g, '!=')
    .replace(/·|×/g, '*')
    .replace(/÷/g, '/')
    .replace(/∞/g, 'inf')
    .replace(/π/g, 'pi')
    .replace(/∛/g, 'cbrt')
    .replace(/√/g, 'sqrt')
    .replace(/±/g, '+-')
    .replace(/\+\/-/g, '+-')
    .replace(/\+\-/g, '+-')
}

/**
 * `f^-1(x)`, `f^(-1)(x)`, `f⁻¹(x)`, `finv(x)` and `f(x)` on the LEFT of the relation sign are
 * aliases for `y` (the inverse module's final line and the function-notation start line).
 */
const FN_ALIAS =
  /^(\s*)f\s*(?:\^\s*[({]?\s*-\s*1\s*[)}]?|inv|⁻¹|-1)?\s*\(\s*x\s*\)(\s*)(?=(?:<=|>=|=|<|>|≤|≥))/i

export function normalizeInput(text: string): string {
  const aliased = text.replace(FN_ALIAS, '$1y$2')
  return normalizeGlyphs(aliased)
}

function rewriteAbsBars(src: string): string {
  let s = src
  for (let guard = 0; guard < 8; guard++) {
    const start = s.indexOf('|')
    if (start < 0) return s
    const end = s.indexOf('|', start + 1)
    if (end < 0) return s
    s = `${s.slice(0, start)}abs(${s.slice(start + 1, end)})${s.slice(end + 1)}`
  }
  return s
}

function tokenize(src: string): Tok[] {
  const s = src.replace(/\s+/g, '')
  const toks: Tok[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]!
    if (c === '(') {
      toks.push({ kind: 'lparen', text: c })
      i++
      continue
    }
    if (c === ')') {
      toks.push({ kind: 'rparen', text: c })
      i++
      continue
    }
    if (c === ',') {
      toks.push({ kind: 'comma', text: c })
      i++
      continue
    }
    if (/[0-9.]/.test(c)) {
      let j = i + 1
      while (j < s.length && /[0-9.]/.test(s[j]!)) j++
      toks.push({ kind: 'num', text: s.slice(i, j) })
      i = j
      continue
    }
    if (/[A-Za-z]/.test(c)) {
      let j = i + 1
      while (j < s.length && /[A-Za-z]/.test(s[j]!)) j++
      const word = s.slice(i, j)
      toks.push({ kind: 'id', text: FUNC_NAMES.has(word) ? word : word.toLowerCase() })
      i = j
      continue
    }
    if (
      s.startsWith('<=', i) ||
      s.startsWith('>=', i) ||
      s.startsWith('!=', i) ||
      s.startsWith('**', i)
    ) {
      toks.push({ kind: 'op', text: s.slice(i, i + 2) })
      i += 2
      continue
    }
    toks.push({ kind: 'op', text: c })
    i++
  }
  return toks
}

function needsMul(a: Tok, b: Tok): boolean {
  const leftValue = a.kind === 'num' || a.kind === 'id' || a.kind === 'rparen'
  const rightValue = b.kind === 'num' || b.kind === 'id' || b.kind === 'lparen'
  if (!leftValue || !rightValue) return false
  if (a.kind === 'id' && b.kind === 'lparen' && FUNC_NAMES.has(a.text)) return false
  return true
}

function splitBareIdent(text: string): string {
  if (KEEP_IDENTS.has(text) || text.length === 1) return text
  if (![...text].every((ch) => /[a-z]/.test(ch))) return text
  return [...text].join('*')
}

/** `xy` → `x*y`, `2x(y+2)` → `2*x*(y+2)`, `cbrt(7x+3)` stays a call. */
export function insertImplicitMul(input: string): string {
  const toks = tokenize(input)
  const out: string[] = []
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!
    if (i > 0 && needsMul(toks[i - 1]!, t)) out.push('*')
    if (t.kind === 'id') out.push(splitBareIdent(t.text))
    else out.push(t.text)
  }
  return out.join('')
}

const REL_OPS = ['<=', '>=', '!=', '=', '<', '>'] as const
type AnyRelOp = (typeof REL_OPS)[number]

class LineError extends Error {
  position: number
  length?: number
  constructor(message: string, position: number, length?: number) {
    super(message)
    this.position = position
    this.length = length
  }
}

function findTopLevel(
  src: string,
  pred: (slice: string, i: number) => number,
): { index: number; len: number }[] {
  const hits: { index: number; len: number }[] = []
  let depth = 0
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (c === '(' || c === '{') depth++
    else if (c === ')' || c === '}') depth = Math.max(0, depth - 1)
    if (depth !== 0) continue
    const len = pred(src, i)
    if (len > 0) {
      hits.push({ index: i, len })
      i += len - 1
    }
  }
  return hits
}

/** Splits `src` on a top-level separator, returning the parts and their start offsets. */
function splitTopLevel(src: string, sep: string): { text: string; offset: number }[] {
  const parts: { text: string; offset: number }[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i <= src.length - sep.length; i++) {
    const c = src[i]
    if (c === '(') depth++
    else if (c === ')') depth = Math.max(0, depth - 1)
    if (depth === 0 && src.slice(i, i + sep.length) === sep) {
      parts.push({ text: src.slice(start, i), offset: start })
      i += sep.length - 1
      start = i + 1
    }
  }
  parts.push({ text: src.slice(start), offset: start })
  return parts
}

function relOpAt(src: string, i: number): number {
  for (const op of REL_OPS) {
    if (src.startsWith(op, i)) return op.length
  }
  return 0
}

function mathjsPosition(e: unknown): number | null {
  const msg = String((e as { message?: string })?.message ?? e)
  const m = msg.match(/\(char (\d+)\)/i) ?? msg.match(/char(?:acter)?\s+(\d+)/i)
  return m ? Math.max(0, Number(m[1]) - 1) : null
}

/** Parses one side; `offset` is where the side starts in the (normalized) line. */
function parseSide(raw: string, offset: number): { node: MathNode; src: string } {
  const lead = raw.length - raw.trimStart().length
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new LineError('One side of the relation is empty — every line needs both sides.', offset)
  }
  const prepared = insertImplicitMul(trimmed)
  try {
    const node = compileExpression(prepared)
    return { node, src: prepared }
  } catch (e) {
    const p = mathjsPosition(e)
    const msg = String((e as { message?: string })?.message ?? '')
    let friendly = 'Could not read that side.'
    if (/Parenthesis \) expected|Parenthesis.*expected/i.test(msg)) friendly = 'A closing ) is missing.'
    else if (/Unexpected end of expression/i.test(msg)) friendly = 'That side ends too early — something is missing after the last operator.'
    else if (/Value expected/i.test(msg)) friendly = 'An operator has nothing next to it.'
    else if (/Unexpected/i.test(msg)) friendly = 'There is a symbol here I do not understand.'
    throw new LineError(friendly, offset + lead + Math.min(p ?? 0, trimmed.length), 1)
  }
}

function parseRelation(raw: string, offset: number): Relation {
  const ops = findTopLevel(raw, relOpAt)
  if (ops.length === 0) {
    throw new LineError('Each line needs both sides and =, <, ≤, >, ≥.', offset, raw.length)
  }
  if (ops.length > 1) {
    throw new LineError(
      'Too many comparison signs in one piece — use "and" or a chain like -3 < x <= 5.',
      offset + ops[1]!.index,
      ops[1]!.len,
    )
  }
  const hit = ops[0]!
  const opText = raw.slice(hit.index, hit.index + hit.len) as AnyRelOp
  if (opText === '!=') {
    throw new LineError('≠ is not used here — write the two cases with "or".', offset + hit.index, hit.len)
  }
  const lhs = parseSide(raw.slice(0, hit.index), offset)
  const rhs = parseSide(raw.slice(hit.index + hit.len), offset + hit.index + hit.len)
  return { lhs: lhs.node, rhs: rhs.node, op: opText, lhsSrc: lhs.src, rhsSrc: rhs.src }
}

function parseChain(raw: string, offset: number): Relation[] {
  const ops = findTopLevel(raw, relOpAt)
  if (ops.length <= 1) return [parseRelation(raw, offset)]
  const pieces: { text: string; offset: number }[] = []
  let start = 0
  const opTexts: AnyRelOp[] = []
  for (const hit of ops) {
    pieces.push({ text: raw.slice(start, hit.index), offset: offset + start })
    opTexts.push(raw.slice(hit.index, hit.index + hit.len) as AnyRelOp)
    start = hit.index + hit.len
  }
  pieces.push({ text: raw.slice(start), offset: offset + start })
  const dirs = opTexts.map((o) => (o === '<' || o === '<=' ? 'lt' : o === '>' || o === '>=' ? 'gt' : o))
  const chainOk =
    dirs.every((d) => d === 'lt') || dirs.every((d) => d === 'gt') || dirs.every((d) => d === '=')
  if (!chainOk) {
    throw new LineError(
      'A chained inequality must point the same way, like -3 < x <= 5.',
      offset + ops[1]!.index,
      ops[1]!.len,
    )
  }
  const rels: Relation[] = []
  for (let i = 0; i < opTexts.length; i++) {
    const op = opTexts[i]!
    if (op === '!=') throw new LineError('≠ is not used here — write the two cases with "or".', offset + ops[i]!.index, 2)
    const left = parseSide(pieces[i]!.text, pieces[i]!.offset)
    const right = parseSide(pieces[i + 1]!.text, pieces[i + 1]!.offset)
    rels.push({ lhs: left.node, rhs: right.node, op, lhsSrc: left.src, rhsSrc: right.src })
  }
  return rels
}

function parseClause(raw: string, offset: number): Relation[] {
  const andParts = splitTopLevel(` ${raw} `, ' and ')
  if (andParts.length > 1) {
    return andParts.flatMap((p) => parseChain(p.text, offset + p.offset - 1))
  }
  return parseChain(raw, offset)
}

/**
 * `h +- E` → [`h + E`, `h - E`]. A ± in a unary position (line start, after a relation sign, an
 * opening parenthesis, a comma or another operator) has no left operand: `x = +-3` → [`x = 3`, `x = -3`].
 */
function expandPlusMinus(src: string): string[] {
  if (!src.includes('+-')) return [src]
  const plus = src.replace(/\+-/g, (_m, offset: number) => {
    const before = src.slice(0, offset).trimEnd()
    const prev = before[before.length - 1]
    return prev == null || '=<>(,*/^+-'.includes(prev) ? '' : '+'
  })
  return [plus, src.replaceAll('+-', '-')]
}

function unionVars(disjuncts: Relation[][]): string[] {
  const set = new Set<string>()
  for (const clause of disjuncts) {
    for (const rel of clause) {
      for (const v of collectVars(rel.lhs)) set.add(v)
      for (const v of collectVars(rel.rhs)) set.add(v)
    }
  }
  return [...set].sort()
}

function letterPosition(original: string, letter: string): number {
  const re = new RegExp(`(?<![A-Za-z])${letter}(?![A-Za-z])`, 'i')
  const m = re.exec(original)
  if (m) return m.index
  const idx = original.toLowerCase().indexOf(letter)
  return idx < 0 ? 0 : idx
}

function unknownLetterError(original: string, found: string[], allowed: readonly string[]): ParseError | null {
  const bad = found.filter((v) => !allowed.includes(v))
  if (!bad.length) return null
  const letter = bad[0]!
  const list = allowed.length === 1 ? `only ${allowed[0]}` : allowed.join(' and ')
  return {
    message: `Unknown letter "${letter}" — this problem uses ${list}.`,
    position: letterPosition(original, letter),
    length: 1,
    hint: `Unknown letter "${letter}"`,
  }
}

function toParseError(e: unknown): ParseError {
  if (e instanceof LineError) {
    return { message: e.message, position: e.position, length: e.length, hint: e.message }
  }
  const p = mathjsPosition(e)
  return { message: 'Could not read that line.', position: p ?? 0, hint: String((e as { message?: string })?.message ?? e) }
}

/**
 * Parses a relation line (`A = B`, `A <= B`, `A or B`, `a < E <= b`, `x = +-3`, `A and B`).
 * `vars` restricts the letters the line may use (default x, y, n).
 */
export function parseStatement(input: string, vars?: readonly VarName[] | readonly string[]): ParseResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: false, error: { message: 'Type a line of work first.', position: 0 } }
  }
  const allowed = vars && vars.length ? vars : DEFAULT_VARS
  try {
    const normalized = rewriteAbsBars(normalizeInput(trimmed))
    const orParts = splitTopLevel(` ${normalized} `, ' or ')
      .map((p) => ({ text: p.text.trim(), offset: p.offset }))
      .filter((p) => p.text)
    if (!orParts.length) {
      return { ok: false, error: { message: 'Type a line of work first.', position: 0 } }
    }
    const disjuncts: Relation[][] = []
    for (const part of orParts) {
      for (const branch of expandPlusMinus(part.text)) {
        disjuncts.push(parseClause(branch, Math.max(0, part.offset - 1)))
      }
    }
    const found = unionVars(disjuncts)
    const unknown = unknownLetterError(trimmed, found, allowed)
    if (unknown) return { ok: false, error: unknown }
    const statement: Statement = { disjuncts, source: trimmed, vars: found }
    return { ok: true, statement }
  } catch (e) {
    return { ok: false, error: toParseError(e) }
  }
}

/** Parses a bare expression (expression mode: even/odd slots, drill, parity helpers). */
export function parseExpression(
  input: string,
  vars?: readonly VarName[] | readonly string[],
): { ok: true; node: MathNode; text: string } | { ok: false; error: ParseError } {
  const trimmed = input.trim()
  if (!trimmed) return { ok: false, error: { message: 'Type an expression first.', position: 0 } }
  const allowed = vars && vars.length ? vars : DEFAULT_VARS
  try {
    const normalized = rewriteAbsBars(normalizeGlyphs(trimmed))
    const ops = findTopLevel(normalized, relOpAt)
    if (ops.length) {
      throw new LineError('This box wants an expression, not an equation — leave out the = sign.', ops[0]!.index, ops[0]!.len)
    }
    if (/\bor\b|\band\b|\+-/.test(normalized)) {
      throw new LineError('This box wants a single expression.', 0)
    }
    const { node, src } = parseSide(normalized, 0)
    const unknown = unknownLetterError(trimmed, collectVars(node), allowed)
    if (unknown) return { ok: false, error: unknown }
    return { ok: true, node, text: src }
  } catch (e) {
    return { ok: false, error: toParseError(e) }
  }
}

/** Plain app-syntax form of a statement, e.g. `x*y + 2*x = 5`. */
export function statementToPlain(stmt: Statement): string {
  return stmt.disjuncts
    .map((clause) => clause.map((r) => `${r.lhsSrc} ${r.op} ${r.rhsSrc}`).join(' and '))
    .join(' or ')
}

export function cloneRelation(rel: Relation): Relation {
  return {
    lhs: rel.lhs.clone(),
    rhs: rel.rhs.clone(),
    op: rel.op,
    lhsSrc: rel.lhsSrc,
    rhsSrc: rel.rhsSrc,
  }
}

export function mapStatement(stmt: Statement, fn: (rel: Relation) => Relation): Statement {
  const disjuncts = stmt.disjuncts.map((clause) => clause.map(fn))
  return { disjuncts, source: stmt.source, vars: unionVars(disjuncts) }
}

export function makeStatement(disjuncts: Relation[][], source = ''): Statement {
  return { disjuncts, source, vars: unionVars(disjuncts) }
}

export function singleRelation(stmt: Statement): Relation | null {
  return stmt.disjuncts.length === 1 && stmt.disjuncts[0]!.length === 1 ? stmt.disjuncts[0]![0]! : null
}

export function relationsOf(stmt: Statement): Relation[] {
  return stmt.disjuncts.flat()
}

export function reverseRelOp(op: RelOp): RelOp {
  switch (op) {
    case '<':
      return '>'
    case '>':
      return '<'
    case '<=':
      return '>='
    case '>=':
      return '<='
    default:
      return op
  }
}
