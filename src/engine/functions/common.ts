/**
 * Shared helpers for the functions graders: reading a function, nice witness points, exact value text.
 */
import type { ParseError, Rational, SolutionSet } from '@/shared/types'
import { rat, ratCompare, ratIsInteger, ratToNumber, ratToString } from '@/notation/rational'
import { candidateIn } from '@/notation/sets/compare'
import { components, setContains, setDifference, setsEqual } from '@/notation/sets/solutionSet'
import type { MathNode } from '../math'
import { parseExpression } from '../parse'
import { niceNumber } from '../samples'
import { surdRational, surdToText, Unsupported, type Surd } from './exact'
import { valueAt } from './solve'
import { pretty } from './text'
import type { FunctionGrade, SetMistakeCandidate } from './types'

/** The only variable a Unit 1 function uses. */
export const FN_VARS = ['x'] as const

/** "f(x) = x^2 + 1" or "x^2 + 1" → the parsed right-hand side. */
export function parseFunction(text: string): { ok: true; node: MathNode; text: string } | { ok: false; error: ParseError } {
  const label = text.match(/^\s*[a-z]\s*\(\s*x\s*\)\s*=/i)
  const body = label ? text.slice(label[0].length) : text
  const p = parseExpression(body, FN_VARS)
  if (p.ok || !label) return p
  return { ok: false, error: { ...p.error, position: p.error.position + label[0].length } }
}

/** Runs `fn`, turning `Unsupported` into null. */
export function attempt<T>(fn: () => T): T | null {
  try {
    return fn()
  } catch (e) {
    if (e instanceof Unsupported) return null
    throw e
  }
}

function nicer(a: Rational, b: Rational): boolean {
  const ai = ratIsInteger(a)
  const bi = ratIsInteger(b)
  if (ai !== bi) return ai
  const am = Math.abs(ratToNumber(a))
  const bm = Math.abs(ratToNumber(b))
  if (am !== bm) return am < bm
  return ratCompare(a, b) < 0
}

/** The friendliest number in a set: an integer nearest 0 when there is one. */
export function nicestIn(set: SolutionSet): Rational | undefined {
  let best: Rational | undefined
  for (const c of components(set)) {
    const k = candidateIn(c)
    if (!best || nicer(k, best)) best = k
  }
  return best
}

/** 0 integer, 1 fraction, 2 exact radical, 3 decimal approximation, 4 undefined. */
function valueRank(node: MathNode, t: Rational): number {
  const v = attempt(() => valueAt(node, t))
  if (v === null || v === 'undef' || (typeof v === 'number' && !Number.isFinite(v))) return 4
  if (typeof v === 'number') return 3
  const r = surdRational(v)
  if (!r) return 2
  return r.d === 1 ? 0 : 1
}

/**
 * The friendliest number in a set. With `node`, prefer a point where node's value reads well
 * (cbrt(x − 2): x = 1 gives −1, better than x = 0 giving −1.26).
 */
export function friendlyPoint(set: SolutionSet, node?: MathNode): Rational | undefined {
  const cands: Rational[] = []
  for (let k = 0; k <= 12; k++) {
    for (const s of k === 0 ? [0] : [k, -k]) if (setContains(set, rat(s))) cands.push(rat(s))
  }
  for (const c of components(set)) cands.push(candidateIn(c))
  if (!cands.length) return undefined
  if (!node) return nicestIn(set)
  let best: { t: Rational; rank: number } | undefined
  for (const t of cands) {
    const rank = valueRank(node, t)
    if (!best || rank < best.rank || (rank === best.rank && nicer(t, best.t))) best = { t, rank }
  }
  return best?.t
}

/** A number in `a` but not in `b` (nicest first; with `node`, where node's value reads well). */
export function pointIn(a: SolutionSet, b: SolutionSet, node?: MathNode): Rational | undefined {
  return friendlyPoint(setDifference(a, b), node)
}

/** Text of a value for a sentence: exact ("-1/2", "2sqrt(3)") when possible. */
export function valueText(v: Surd | number): string {
  return typeof v === 'number' ? niceNumber(v) : surdToText(v)
}

/** f(t) as text, or 'undef'. */
export function evalText(node: MathNode, t: Rational | Surd): string | 'undef' {
  const v = attempt(() => valueAt(node, t))
  if (v === null || v === 'undef' || (typeof v === 'number' && !Number.isFinite(v))) return 'undef'
  return valueText(v)
}

/** Display text of a rational in a sentence: "−1/2". */
export function num(r: Rational | number): string {
  return pretty(typeof r === 'number' ? niceNumber(r) : ratToString(r))
}

/** Grade a set answer: exact equality, then the named candidates in priority order, then plain. */
export function gradeSetAgainst(
  her: SolutionSet,
  target: SolutionSet,
  candidates: readonly SetMistakeCandidate[],
  plain: () => string,
  correct: string,
): FunctionGrade {
  if (setsEqual(her, target)) return { verdict: 'correct', message: correct }
  for (const c of candidates) {
    if (setsEqual(her, c.set)) return { verdict: 'mistake', mistake: c.kind, witness: c.witness }
  }
  return { verdict: 'wrong', message: plain() }
}

/** Keep candidates that differ from the target and from every earlier candidate. */
export function dedupeCandidates(target: SolutionSet, cands: SetMistakeCandidate[]): SetMistakeCandidate[] {
  const out: SetMistakeCandidate[] = []
  for (const c of cands) {
    if (setsEqual(c.set, target)) continue
    if (out.some((o) => setsEqual(o.set, c.set))) continue
    out.push(c)
  }
  return out
}
