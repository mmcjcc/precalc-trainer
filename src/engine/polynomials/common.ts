/**
 * Shared readers and text helpers for the polynomials core.
 *
 * Everything graded is exact: polynomials are read off the parse tree into rational coefficients
 * (`polyOf`), numbers into `Rational`s. No float is compared anywhere in this folder.
 *
 * Text convention (same as the functions and transformations cores): fields named `text`, `f`,
 * `vertexForm`, … are ASCII app syntax the parser reads back; sentences (`message`, `witness`, `reason`,
 * `explanation`) are display text with the unicode minus sign.
 */
import type { ParseError, Rational } from '@/shared/types'
import { rat, ratAbs, ratCompare, ratFromString, ratToString } from '@/notation/rational'
import type { MathNode } from '../math'
import { normalizeGlyphs, parseExpression } from '../parse'
import { parseFunction } from '../functions/common'
import { exactEval, surdRational, Unsupported } from '../functions/exact'
import { polyDeg, polyEval, polyOf, polyToText, polyTrim, ratFnOf, type Poly, type RatFn } from '../functions/poly'
import { pretty } from '../functions/text'
import { rp, toRational } from '../transformations/text'
import type { PolyGrade, PolyInput, PolyMistakeKind } from './types'

export { pretty }

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/** Runs `fn`; an overflow of the safe-integer range or a value outside the exact model becomes null. */
export function guard<T>(fn: () => T): T | null {
  try {
    return fn()
  } catch (e) {
    if (e instanceof Unsupported || e instanceof RangeError) return null
    throw e
  }
}

/**
 * Runs a grader. Exact arithmetic stays inside the safe-integer range; an answer with a number so large
 * that checking it leaves that range (a held-down key, usually) is reported as unreadable instead of
 * throwing.
 */
export function checked<T>(fn: () => T): T | Extract<PolyGrade, { verdict: 'invalid' }> {
  try {
    return fn()
  } catch (e) {
    if (e instanceof Unsupported || e instanceof RangeError) {
      return { verdict: 'invalid', reason: 'unreadable', message: 'A number in that answer is too large to check exactly. Look for a typing slip.' }
    }
    throw e
  }
}

// ---------------------------------------------------------------------------
// Reading the problem's polynomial
// ---------------------------------------------------------------------------

export interface PolySource {
  /** Coefficients from the constant term up (the functions core's `Poly`). */
  poly: Poly
  /** Standard form, app syntax: "2x^3 - 3x^2 - 5". */
  text: string
}

/** The problem's text is parsed once: a screen grades many answers against the same f. */
const READ_CACHE = new Map<string, PolySource | null>()
const READ_CACHE_SIZE = 256

/** The problem's polynomial from text or from coefficients (highest power first); null when it is not one. */
export function readPoly(input: PolyInput): PolySource | null {
  if (typeof input !== 'string') return readPolyUncached(input)
  const hit = READ_CACHE.get(input)
  if (hit !== undefined) return hit
  const out = readPolyUncached(input)
  if (READ_CACHE.size >= READ_CACHE_SIZE) READ_CACHE.clear()
  READ_CACHE.set(input, out)
  return out
}

function readPolyUncached(input: PolyInput): PolySource | null {
  return guard(() => {
    let poly: Poly | null
    if (typeof input === 'string') {
      const p = parseFunction(input)
      if (!p.ok) return null
      poly = polyOf(p.node)
    } else {
      const cs: Rational[] = []
      for (const v of input) {
        const r = toRational(v)
        if (!r) return null
        cs.push(r)
      }
      poly = polyTrim(cs.reverse())
    }
    return poly ? { poly, text: polyToText(poly) } : null
  })
}

/** Coefficients from the highest power down, zeros included ([] for the zero polynomial). */
export function descending(p: Poly): Rational[] {
  return [...p].reverse()
}

/** The polynomial with these coefficients, highest power first. */
export function fromDescending(cs: readonly Rational[]): Poly {
  return polyTrim([...cs].reverse())
}

// ---------------------------------------------------------------------------
// Reading her answers
// ---------------------------------------------------------------------------

function fail(message: string, position = 0, length?: number): { ok: false; error: ParseError } {
  return { ok: false, error: length ? { message, position, length } : { message, position } }
}

const LABEL = /^\s*(?:[A-Za-z]\s*\(\s*x\s*\)|y)\s*=/

export type FormulaAnswer =
  | {
      ok: true
      node: MathNode
      /** Her formula as the parser read it (app syntax, label removed). */
      text: string
      /** Its exact coefficients when it multiplies out to a polynomial, else null. */
      poly: Poly | null
      /** num/den when it is a rational function, else null. */
      ratFn: RatFn | null
    }
  | { ok: false; error: ParseError }

/** Her formula in x ("f(x) =", "q(x) =" or "y =" in front is fine), read exactly. */
export function readFormula(text: string): FormulaAnswer {
  const raw = text ?? ''
  if (!raw.trim()) return fail('Type your answer first.')
  const label = raw.match(LABEL)
  const body = label ? raw.slice(label[0].length) : raw
  if (!body.trim()) return fail('Type the formula after the = sign.', raw.length)
  const p = parseExpression(body, ['x'])
  if (!p.ok) return { ok: false, error: { ...p.error, position: p.error.position + (label ? label[0].length : 0) + (body.length - body.trimStart().length) } }
  const ratFn = guard(() => ratFnOf(p.node))
  const poly = guard(() => polyOf(p.node))
  return { ok: true, node: p.node, text: body.trim(), poly, ratFn }
}

export type NumberAnswer =
  | {
      ok: true
      /** Exact value; null for a real number that is not rational (sqrt(2), pi): never right here. */
      value: Rational | null
      text: string
    }
  | { ok: false; error: ParseError }

/** A number: "3", "-1/2", "0.75", "6/4", "(2 - 5)/3". Read exactly (0.1 is 1/10). */
export function readNumber(text: string): NumberAnswer {
  const raw = text ?? ''
  const t = raw.trim()
  const lead = raw.length - raw.trimStart().length
  if (!t) return fail('Type a number first.')
  const direct = ratFromString(t)
  if (direct) return { ok: true, value: direct, text: t }
  const p = parseExpression(t, ['x'])
  if (!p.ok) return { ok: false, error: { ...p.error, position: p.error.position + lead } }
  const xAt = t.search(/(?<![A-Za-z])x(?![A-Za-z])/)
  if (xAt >= 0) return fail('This answer is a number: no x should be left in it.', lead + xAt, 1)
  try {
    const v = exactEval(p.node, null)
    if (v === 'undef') return fail('That value is undefined as written. Check for a division by 0.', lead, t.length)
    return { ok: true, value: surdRational(v), text: t }
  } catch (e) {
    if (e instanceof Unsupported || e instanceof RangeError) return { ok: true, value: null, text: t }
    throw e
  }
}

export interface ListItem {
  text: string
  /** Offset of the item in the original text. */
  start: number
}

/** Is raw[start..end) one pair of parentheses around a list with a comma in it, "(1, -2, 1/2)"? */
function parenthesizedList(raw: string, start: number, end: number): boolean {
  if (raw[start] !== '(' || raw[end - 1] !== ')') return false
  let depth = 0
  let comma = false
  for (let i = start; i < end; i++) {
    if (raw[i] === '(') depth++
    else if (raw[i] === ')') {
      depth--
      if (depth === 0 && i < end - 1) return false
    } else if (raw[i] === ',' && depth === 1) comma = true
  }
  return comma
}

/**
 * "{1, -2, 1/2}", "(1, -2, 1/2)" or "1, -2, 1/2" → the items between top-level commas (one outer pair of
 * braces, brackets or parentheses removed).
 */
export function splitList(text: string): ListItem[] {
  const raw = text ?? ''
  let start = 0
  let end = raw.length
  while (start < end && /\s/.test(raw[start]!)) start++
  while (end > start && /\s/.test(raw[end - 1]!)) end--
  if (
    end - start >= 2 &&
    ((raw[start] === '{' && raw[end - 1] === '}') || (raw[start] === '[' && raw[end - 1] === ']') || parenthesizedList(raw, start, end))
  ) {
    start++
    end--
  }
  const items: ListItem[] = []
  let depth = 0
  let from = start
  for (let i = start; i <= end; i++) {
    const ch = i < end ? raw[i] : ','
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    else if (ch === ',' && (depth === 0 || i === end)) {
      const part = raw.slice(from, i)
      items.push({ text: part.trim(), start: from + (part.length - part.trimStart().length) })
      from = i + 1
    }
  }
  return items
}

export type RowAnswer =
  | { ok: true; values: (Rational | null)[]; texts: string[] }
  | { ok: false; message: string; index?: number; position?: number; length?: number }

/**
 * A row of numbers: one string per input box, or one string with commas ("2, 1, 2, -1"; plain numbers
 * separated by spaces also work).
 */
export function readRow(answer: string | readonly string[], what: string): RowAnswer {
  let items: ListItem[]
  const boxes = typeof answer !== 'string'
  if (typeof answer === 'string') {
    if (!answer.trim()) return { ok: false, message: `Type the ${what} first, with a comma between the numbers.` }
    // A semicolon between the numbers is a comma typed differently, not a wrong row.
    if (!answer.includes(',')) answer = answer.replace(/;/g, ',')
    const words = answer.trim().split(/\s+/)
    if (!answer.includes(',') && words.length > 1 && words.every((w) => ratFromString(w))) {
      let at = 0
      items = words.map((w) => {
        const start = answer.indexOf(w, at)
        at = start + w.length
        return { text: w, start }
      })
    } else items = splitList(answer)
  } else items = answer.map((t) => ({ text: (t ?? '').trim(), start: 0 }))
  const values: (Rational | null)[] = []
  const texts: string[] = []
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!
    if (!it.text) {
      return boxes
        ? { ok: false, message: `Fill in every box of the ${what}.`, index: i }
        : { ok: false, message: `There is an empty place in the ${what}: check the commas.`, index: i, position: it.start }
    }
    const n = readNumber(it.text)
    if (!n.ok) {
      return {
        ok: false,
        message: `Entry ${i + 1} of the ${what}: ${n.error.message}`,
        index: i,
        position: it.start + n.error.position,
        ...(n.error.length ? { length: n.error.length } : {}),
      }
    }
    values.push(n.value)
    texts.push(it.text)
  }
  return { ok: true, values, texts }
}

/** A row problem as an `invalid` verdict. */
export function invalidRow(r: Extract<RowAnswer, { ok: false }>): PolyGrade {
  return {
    verdict: 'invalid',
    reason: 'unreadable',
    message: r.message,
    ...(r.index !== undefined ? { index: r.index } : {}),
    ...(r.position !== undefined ? { position: r.position } : {}),
    ...(r.length !== undefined ? { length: r.length } : {}),
  }
}

/** A parse error as an `invalid` verdict. */
export function invalidParse(error: ParseError, index?: number): Extract<PolyGrade, { verdict: 'invalid' }> {
  return {
    verdict: 'invalid',
    reason: 'unreadable',
    message: error.message,
    position: error.position,
    ...(error.length ? { length: error.length } : {}),
    ...(index !== undefined ? { index } : {}),
  }
}

/** "±" and its spellings → "+-" (the parser's own normalization), unicode minus → "-". */
export function plain(text: string): string {
  return normalizeGlyphs(text ?? '')
}

// ---------------------------------------------------------------------------
// Exact helpers
// ---------------------------------------------------------------------------

export function same(a: Rational | null | undefined, b: Rational | null | undefined): boolean {
  return !!a && !!b && ratCompare(a, b) === 0
}

export function sameRow(a: readonly (Rational | null)[], b: readonly (Rational | null)[]): boolean {
  return a.length === b.length && a.every((v, i) => same(v, b[i]))
}

/** p(x) exactly. */
export function valueAt(p: Poly, x: Rational): Rational {
  return polyEval(p, x)
}

export function ratKey(r: Rational): string {
  return `${r.n}/${r.d}`
}

/** Distinct values, ascending. */
export function sortedSet(values: readonly Rational[]): Rational[] {
  const seen = new Map<string, Rational>()
  for (const v of values) seen.set(ratKey(v), v)
  return [...seen.values()].sort(ratCompare)
}

export function sameSet(a: readonly Rational[], b: readonly Rational[]): boolean {
  const x = sortedSet(a)
  const y = sortedSet(b)
  return x.length === y.length && x.every((v, i) => ratCompare(v, y[i]!) === 0)
}

/** Positive divisors of a positive integer, ascending. */
export function divisors(n: number): number[] {
  const out: number[] = []
  for (let k = 1; k * k <= n; k++) {
    if (n % k === 0) {
      out.push(k)
      if (k * k !== n) out.push(n / k)
    }
  }
  return out.sort((x, y) => x - y)
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

/**
 * Keep the candidates that differ from the right answer, in priority order. A later candidate giving the
 * same wrong answer as an earlier one is dropped and its kind listed in the earlier one's `shadows`.
 */
export function dedupeCandidates<T extends { kind: PolyMistakeKind; shadows: PolyMistakeKind[] }>(
  raw: readonly T[],
  isRight: (c: T) => boolean,
  sameAnswer: (a: T, b: T) => boolean,
): T[] {
  const kept: T[] = []
  for (const r of raw) {
    if (isRight(r)) continue
    const twin = kept.find((k) => sameAnswer(k, r))
    if (twin) {
      if (twin.kind !== r.kind && !twin.shadows.includes(r.kind)) twin.shadows.push(r.kind)
      continue
    }
    kept.push({ ...r, shadows: [] })
  }
  return kept
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/** Display text of a polynomial: "2x^2 − 12x + 13". */
export function polyPretty(p: Poly): string {
  return pretty(polyToText(p))
}

/** "2, −3, 0, −5". */
export function rowPretty(values: readonly Rational[]): string {
  return values.map(rp).join(', ')
}

/** "2, -3, 0, -5" (app syntax). */
export function rowText(values: readonly Rational[]): string {
  return values.map(ratToString).join(', ')
}

/** "a − b" as display text, with b in parentheses when it is negative: "13 − 18", "13 − (−9)". */
export function minusText(a: Rational, b: Rational): string {
  return `${rp(a)} − ${b.n < 0 ? `(${rp(b)})` : rp(b)}`
}

/** "a + b" as display text with the sign folded in when a is given as text: "0 + 4", "−3 + (−8)". */
export function plusParen(a: Rational, b: Rational): string {
  return `${rp(a)} + ${b.n < 0 ? `(${rp(b)})` : rp(b)}`
}

/** "constant term", "x term", "x^3 term". */
export function termName(power: number): string {
  return power === 0 ? 'constant term' : power === 1 ? 'x term' : `x^${power} term`
}

/** "x", "x^2" for a power ≥ 1. */
export function powerText(power: number): string {
  return power === 1 ? 'x' : `x^${power}`
}

/** A signed x-term to append, app syntax: " - 6x", " + x", " + (3/2)x"; "" for 0. */
export function xTerm(coef: Rational): string {
  if (coef.n === 0) return ''
  const abs = ratAbs(coef)
  const body = abs.n === 1 && abs.d === 1 ? 'x' : abs.d === 1 ? `${abs.n}x` : `(${ratToString(abs)})x`
  return coef.n > 0 ? ` + ${body}` : ` - ${body}`
}

/** "A", "A and B", "A, B and C". */
export function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** 1 → "first", …, used for columns of the table. */
export function ordinal(n: number): string {
  return ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][n] ?? `${n}th`
}

export function isInteger(r: Rational): boolean {
  return r.d === 1
}

export const ONE = rat(1)
export const ZERO = rat(0)

/** The degree as a word pair: "6 (even)". */
export function parityWord(n: number): 'even' | 'odd' {
  return n % 2 === 0 ? 'even' : 'odd'
}

export { polyDeg }
