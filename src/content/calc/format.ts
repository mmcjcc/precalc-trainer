/**
 * Formatting + relation-parsing helpers shared by the TI-84 and Nspire step builders.
 * String work on top of the notation serializers, plus one numeric helper (linearCrossings) that
 * evaluates app-syntax expressions through the engine to find where a compound inequality turns.
 */
import { evaluateExpr } from '@/engine/expressions'
import { assertNoFractionalPow, toNspire, toTi84 } from '@/notation/calcString'
import type { RelOp } from '@/shared/types'
import type { CalcEndpoint, CalcId, CalcInstance } from './types'

export function endpointValue(e: CalcEndpoint): number {
  return typeof e === 'number' ? e : e.n / e.d
}

/** Integer → "3"; simple fraction (denominator ≤ 64) → "-2/5"; otherwise ≤ 4 decimals. Never "-0". */
export function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return String(v)
  const r = Math.round(v)
  if (Math.abs(v - r) < 1e-9) return String(r === 0 ? 0 : r)
  for (let d = 2; d <= 64; d++) {
    const n = Math.round(v * d)
    if (Math.abs(v - n / d) < 1e-9) return `${n}/${d}`
  }
  return String(Number(v.toFixed(4)))
}

export function fmtEndpoint(e: CalcEndpoint): string {
  if (typeof e === 'number') return fmtNum(e)
  return e.d === 1 ? String(e.n) : `${e.n}/${e.d}`
}

export function list(nums: readonly number[]): string {
  return nums.map(fmtNum).join(', ')
}

function varRe(name: string): RegExp {
  return new RegExp(`(?<![A-Za-z_])${name}(?![A-Za-z0-9_])`, 'g')
}

/** Rename a variable letter without touching function names: "3n-5" → "3x-5", "exp" untouched. */
export function renameVar(text: string, from: string, to: string): string {
  return from === to ? text : text.replace(varRe(from), to)
}

/**
 * App syntax → that calculator's typed syntax via the notation serializers, plus the panel's
 * defensive clean-up: the independent variable is renamed here (word-boundary safe, so "3n"
 * works), stray whitespace is dropped, and a lowercase x that leaked through on the TI-84 becomes X.
 * Throws if the result contains a fractional power (the serializers never should).
 */
export function convertExpr(calc: CalcId, expr: string, independent = 'x'): string {
  const src = renameVar(expr, independent, 'x')
  let out = calc === 'ti84' ? toTi84(src, 'x') : toNspire(src, 'x')
  out = out.replace(/\s+/g, '')
  if (calc === 'ti84') out = out.replace(/(?<![A-Za-z])x(?![A-Za-z0-9])/g, 'X')
  assertNoFractionalPow(out)
  return out
}

// ---------------------------------------------------------------------------
// Relations ("-5x+6 <= 3", "-2 < 3x+1 <= 5", "x < -2 or x > 5")
// ---------------------------------------------------------------------------

export interface RelAtom {
  lhs: string
  op: RelOp
  rhs: string
}

export const OP_GLYPH: Record<RelOp, string> = { '=': '=', '<': '<', '<=': '≤', '>': '>', '>=': '≥' }

export function hasRelOp(text: string): boolean {
  return /<=|>=|[<>=≤≥]/.test(text)
}

const REL_TOKEN = /(<=|>=|<|>|=)/

function atomsOf(part: string): RelAtom[] | null {
  const segs = part.split(REL_TOKEN)
  if (segs.length < 3 || segs.length % 2 === 0) return null
  const atoms: RelAtom[] = []
  for (let i = 1; i < segs.length; i += 2) {
    const lhs = (segs[i - 1] ?? '').trim()
    const rhs = (segs[i + 1] ?? '').trim()
    const op = segs[i] as RelOp
    if (!lhs || !rhs) return null
    atoms.push({ lhs, op, rhs })
  }
  return atoms
}

/** OR of ANDs. "a < E <= b" → one AND-group of two atoms; "x < -2 or x > 5" → two OR-groups. */
export function parseRelation(text: string): RelAtom[][] | null {
  const norm = text
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/∨/g, ' or ')
    .replace(/∧/g, ' and ')
  const groups: RelAtom[][] = []
  for (const g of norm.split(/\s+or\s+/i)) {
    const atoms: RelAtom[] = []
    for (const a of g.split(/\s+and\s+/i)) {
      const got = atomsOf(a)
      if (!got) return null
      atoms.push(...got)
    }
    groups.push(atoms)
  }
  return groups.length > 0 ? groups : null
}

/** The statement to test: the `relation` field, or `expr` when expr itself is a relation. */
export function relationText(inst: CalcInstance): string | undefined {
  if (inst.relation) return inst.relation
  return hasRelOp(inst.expr) ? inst.expr : undefined
}

/** The boundary function LHS − RHS: `expr` itself unless expr is a relation. */
export function boundaryText(inst: CalcInstance): string {
  if (!hasRelOp(inst.expr)) return inst.expr
  const atom = parseRelation(inst.expr)?.[0]?.[0]
  return atom ? `(${atom.lhs})-(${atom.rhs})` : inst.expr
}

export function renderAtom(atom: RelAtom, conv: (s: string) => string): string {
  return `${conv(atom.lhs)} ${OP_GLYPH[atom.op]} ${conv(atom.rhs)}`
}

/**
 * Render OR-of-AND groups. With `groupParens`, an AND group of 2+ comparisons inside an OR is
 * wrapped — "x < -8 or (-4 ≤ x and x < 0)" — so no reader has to know that and binds before or.
 */
export function renderRelation(
  groups: RelAtom[][],
  conv: (s: string) => string,
  join: { and: string; or: string },
  groupParens = false,
): string {
  const wrap = groupParens && groups.length > 1
  return groups
    .map((g) => {
      const body = g.map((a) => renderAtom(a, conv)).join(join.and)
      return wrap && g.length > 1 ? `(${body})` : body
    })
    .join(join.or)
}

/**
 * The store-and-test condition in one calculator's syntax and glyphs: a chain "-4 <= x < 0" becomes
 * "-4 ≤ x and x < 0" (a chain would be read left to right as (−4 ≤ x) < 0 on both calculators).
 * Null when there is no relation or it does not parse.
 */
export function predicateFor(calc: CalcId, relation: string | undefined, independent = 'x'): string | null {
  if (!relation) return null
  const groups = parseRelation(relation)
  if (!groups) return null
  return renderRelation(groups, (s) => convertExpr(calc, s, independent), { and: ' and ', or: ' or ' }, true)
}

/** The comparison glyphs a rendered predicate uses, in keypad order. */
export function relSymbols(rendered: string): string[] {
  return ['<', '≤', '>', '≥', '='].filter((g) => rendered.includes(g))
}

/** A number as keyed in: TI-84 negatives show the (−) key; the Nspire shows a plain minus sign. */
export function keyedNum(calc: CalcId, v: number): string {
  const s = fmtNum(v)
  return calc === 'ti84' && s.startsWith('-') ? `(−)${s.slice(1)}` : s
}

const FLIP: Record<RelOp, RelOp> = { '<': '>', '<=': '>=', '>': '<', '>=': '<=', '=': '=' }
const squash = (s: string) => s.replace(/\s+/g, '')

/** lower < middle < upper, read from a chain ("-2 < 2x+2 <= 0") or an and ("2x+2 > -2 and 2x+2 <= 0"). */
export interface Between {
  middle: string
  lower: string
  upper: string
  lowerIncluded: boolean
  upperIncluded: boolean
}

export function betweenOf(inst: CalcInstance): Between | null {
  const rel = relationText(inst)
  const groups = rel ? parseRelation(rel) : null
  if (!groups || groups.length !== 1 || groups[0]!.length !== 2) return null
  const [a, b] = groups[0] as [RelAtom, RelAtom]
  for (const m of [squash(a.lhs), squash(a.rhs)]) {
    const sides = [a, b].map((atom) =>
      squash(atom.lhs) === m
        ? { op: atom.op, bound: atom.rhs }
        : squash(atom.rhs) === m
          ? { op: FLIP[atom.op], bound: atom.lhs }
          : null,
    )
    if (sides.some((x) => x === null)) continue
    const lo = sides.find((x) => x!.op === '>' || x!.op === '>=')
    const hi = sides.find((x) => x!.op === '<' || x!.op === '<=')
    if (!lo || !hi) continue
    const middle = squash(a.lhs) === m ? a.lhs : a.rhs
    return { middle, lower: lo.bound, upper: hi.bound, lowerIncluded: lo.op === '>=', upperIncluded: hi.op === '<=' }
  }
  return null
}

/**
 * Where a LINEAR middle expression meets each constant bound, in x. Null when the middle is not
 * linear, a bound is not constant, or anything fails to evaluate — callers then fall back to k.
 */
export function linearCrossings(middle: string, bounds: readonly string[], independent = 'x'): number[] | null {
  const at = (text: string, x: number) => evaluateExpr(renameVar(text, independent, 'x'), { x })
  const [y0, y1, y2] = [at(middle, 0), at(middle, 1), at(middle, 2)]
  if (typeof y0 !== 'number' || typeof y1 !== 'number' || typeof y2 !== 'number') return null
  const slope = y1 - y0
  if (Math.abs(slope) < 1e-12 || Math.abs(y2 - y1 - slope) > 1e-9) return null
  const out: number[] = []
  for (const bound of bounds) {
    const c0 = at(bound, 0)
    const c1 = at(bound, 1)
    if (typeof c0 !== 'number' || typeof c1 !== 'number' || Math.abs(c0 - c1) > 1e-12) return null
    out.push((c0 - y0) / slope + 0) // + 0 turns −0 into 0
  }
  return out
}

/** Replace the graphing variable in an already-converted string with a parenthesised number. */
export function substituteConverted(calc: CalcId, converted: string, v: number): string {
  const num = fmtNum(v)
  const lit = calc === 'ti84' && v < 0 ? `((-)${num.slice(1)})` : `(${num})`
  const re = calc === 'ti84' ? /(?<![A-Za-z])X(?![A-Za-z0-9])/g : /(?<![a-z])x(?![a-z0-9])/g
  return converted.replace(re, lit)
}

/** For each endpoint b: b − 1, b, b + 1 (sorted, deduped). */
export function probeValues(boundary?: readonly CalcEndpoint[]): number[] {
  if (!boundary || boundary.length === 0) return []
  const seen = new Set<string>()
  const out: number[] = []
  for (const b of boundary) {
    const v = endpointValue(b)
    for (const p of [v - 1, v, v + 1]) {
      const key = fmtNum(p)
      if (!seen.has(key)) {
        seen.add(key)
        out.push(p)
      }
    }
  }
  return out.sort((a, b) => a - b)
}

/** True when every stored number fits ZDecimal's ±6.6 × ±4.1 window. */
export function smallWindow(inst: CalcInstance): boolean {
  const vals: number[] = []
  for (const v of [inst.checkValue, inst.checkOutput, inst.twin]) if (v !== undefined) vals.push(v)
  if (inst.asymptotes) {
    vals.push(endpointValue(inst.asymptotes.vertical), endpointValue(inst.asymptotes.horizontal))
  }
  for (const b of inst.boundary ?? []) vals.push(endpointValue(b))
  return vals.every((v) => Math.abs(v) <= 6)
}

export function joinNotes(...notes: (string | undefined)[]): string | undefined {
  const kept = notes.filter((n): n is string => Boolean(n))
  return kept.length > 0 ? kept.join(' ') : undefined
}

export function assertNever(x: never): never {
  throw new Error(`unknown calc family: ${String(x)}`)
}

/** The relation's only comparison, or null for compound / or / missing relations. */
export function singleAtom(inst: CalcInstance): RelAtom | null {
  const rel = relationText(inst)
  const groups = rel ? parseRelation(rel) : null
  return groups && groups.length === 1 && groups[0]!.length === 1 ? groups[0]![0]! : null
}

/** How to read the sign of (left side − right side) for each comparison. */
export function readingOf(op: RelOp): { long: string; short: string } {
  switch (op) {
    case '<':
      return { long: 'is negative (the graph is below the x-axis)', short: 'a negative value' }
    case '<=':
      return { long: 'is zero or negative (on or below the x-axis)', short: 'a zero or negative value' }
    case '>':
      return { long: 'is positive (the graph is above the x-axis)', short: 'a positive value' }
    case '>=':
      return { long: 'is zero or positive (on or above the x-axis)', short: 'a zero or positive value' }
    default:
      return { long: 'is zero (where the graph crosses the x-axis)', short: 'zero' }
  }
}

/** Every number the panel asks her to look at: k, f(k), the twin, the asymptotes and endpoints. */
export function storedValues(inst: CalcInstance): number[] {
  const vals: number[] = []
  for (const v of [inst.checkValue, inst.checkOutput, inst.twin]) if (v !== undefined) vals.push(v)
  if (inst.asymptotes) vals.push(endpointValue(inst.asymptotes.vertical), endpointValue(inst.asymptotes.horizontal))
  for (const b of inst.boundary ?? []) vals.push(endpointValue(b))
  return vals
}

/** A ±limit window (multiple of 5, one unit of margin) that shows every stored number, or null if ±`fits` already does. */
export function windowLimit(inst: CalcInstance, fits: number): number | null {
  const vals = storedValues(inst)
  if (vals.length === 0) return null
  const max = Math.max(...vals.map((v) => Math.abs(v)))
  return max <= fits ? null : Math.ceil((max + 1) / 5) * 5
}
