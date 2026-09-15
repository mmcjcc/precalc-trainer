/**
 * Final-answer comparison: student set vs target, and interval vs set-builder cross-check.
 *
 * Patterns (research "Answer matchers" N1, N2, 2b, 10):
 *   wrong_side     — the student's set matches the COMPLEMENT of the target on interior probes
 *   endpoint_type  — same interior, differs only at endpoints (bracket vs parenthesis)
 *   dropped_union  — student ⊆ target and at least one whole component of the target is missing
 * Otherwise no pattern, just the nicest witness: a rational in one set but not the other,
 * integers first, then smallest magnitude.
 */
import type { PatternHit, Piece, Rational, SolutionSet } from '@/shared/types'
import {
  rat,
  ratAdd,
  ratCeil,
  ratCompare,
  ratFloor,
  ratIsInteger,
  ratMidpoint,
  ratSub,
  ratToNumber,
  ratToString,
} from '../rational'
import {
  components,
  isFiniteEndpoint,
  normalizeSet,
  pieceEquals,
  pieceToInterval,
  setComplement,
  setContains,
  setCriticalValues,
  setDifference,
  setIsAllReals,
  setIsEmpty,
  setIsSubset,
  setUnion,
  setsEqual,
} from './solutionSet'
import { patternHit } from './patterns'

export interface CompareResult {
  equal: boolean
  pattern?: PatternHit
  witness?: Rational
}

export interface CrossCheckResult {
  agree: boolean
  pattern?: PatternHit
  witness?: Rational
}

export interface Probes {
  /** Midpoints between consecutive critical values, plus one beyond each end. */
  interior: Rational[]
  /** The critical values themselves (endpoints and isolated points of both sets). */
  endpoints: Rational[]
}

function sortDedupe(vals: Rational[]): Rational[] {
  const sorted = [...vals].sort(ratCompare)
  const out: Rational[] = []
  for (const v of sorted) {
    const last = out[out.length - 1]
    if (!last || ratCompare(last, v) !== 0) out.push(v)
  }
  return out
}

/** Deterministic probe points that decide equality exactly for this class of sets (CG-06). */
export function probePoints(a: SolutionSet, b: SolutionSet): Probes {
  const E = sortDedupe([...setCriticalValues(a), ...setCriticalValues(b)])
  if (E.length === 0) return { interior: [rat(0)], endpoints: [] }
  const interior: Rational[] = [ratSub(E[0]!, rat(1))]
  for (let i = 0; i + 1 < E.length; i++) interior.push(ratMidpoint(E[i]!, E[i + 1]!))
  interior.push(ratAdd(E[E.length - 1]!, rat(1)))
  return { interior, endpoints: E }
}

function agreeAt(a: SolutionSet, b: SolutionSet, pts: Rational[]): boolean {
  return pts.every((p) => setContains(a, p) === setContains(b, p))
}

/** The nicest number inside one component: an integer nearest 0 if there is one, else the midpoint. */
export function candidateIn(c: Piece): Rational {
  if (isFiniteEndpoint(c.lo) && isFiniteEndpoint(c.hi) && ratCompare(c.lo, c.hi) === 0) return c.lo
  const loInt = isFiniteEndpoint(c.lo) ? (c.loClosed ? ratCeil(c.lo) : ratFloor(c.lo) + 1) : -Infinity
  const hiInt = isFiniteEndpoint(c.hi) ? (c.hiClosed ? ratFloor(c.hi) : ratCeil(c.hi) - 1) : Infinity
  if (loInt <= hiInt) {
    const k = loInt <= 0 && 0 <= hiInt ? 0 : hiInt < 0 ? hiInt : loInt
    return rat(k)
  }
  if (isFiniteEndpoint(c.lo) && isFiniteEndpoint(c.hi)) return ratMidpoint(c.lo, c.hi)
  // Unreachable: an unbounded piece always contains an integer.
  return isFiniteEndpoint(c.lo) ? c.lo : isFiniteEndpoint(c.hi) ? c.hi : rat(0)
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

function pickNicest(cands: Rational[]): Rational | undefined {
  let best: Rational | undefined
  for (const c of cands) if (!best || nicer(c, best)) best = c
  return best
}

/** A rational in exactly one of the two sets (integers preferred, then smallest magnitude). */
export function nicestWitness(a: SolutionSet, b: SolutionSet): Rational | undefined {
  const sym = setUnion(setDifference(a, b), setDifference(b, a))
  return pickNicest(components(sym).map(candidateIn))
}

function componentName(c: Piece): string {
  if (isFiniteEndpoint(c.lo) && isFiniteEndpoint(c.hi) && ratCompare(c.lo, c.hi) === 0) {
    return `{${ratToString(c.lo)}}`
  }
  return pieceToInterval(c)
}

export function compareAnswerSet(student: SolutionSet, target: SolutionSet, variable = 'x'): CompareResult {
  const s = normalizeSet(student)
  const t = normalizeSet(target)
  if (setsEqual(s, t)) return { equal: true }
  const witness = nicestWitness(s, t)
  if (!witness) return { equal: false }
  const v = variable
  const w = ratToString(witness)

  if (!setIsEmpty(t) && !setIsAllReals(t)) {
    const probes = probePoints(s, t)
    if (agreeAt(s, setComplement(t), probes.interior)) {
      const inTarget = setContains(t, witness)
      return {
        equal: false,
        witness,
        pattern: patternHit(
          'wrong_side',
          `${v} = ${w} ${inTarget ? 'is a solution but is not in your set' : 'is in your set but is not a solution'} — the shading belongs on the other side.`,
        ),
      }
    }
    if (agreeAt(s, t, probes.interior)) {
      const inTarget = setContains(t, witness)
      return {
        equal: false,
        witness,
        pattern: patternHit(
          'endpoint_type',
          inTarget
            ? `${v} = ${w} IS a solution — ≤ or ≥ includes the endpoint, so ${w} needs a bracket — but your answer leaves it out.`
            : `${v} = ${w} is NOT a solution — < or > excludes the endpoint, so ${w} needs a parenthesis — but your answer includes it.`,
        ),
      }
    }
    if (setIsSubset(s, t)) {
      const targetComps = components(t)
      const missing = components(setDifference(t, s)).filter((c) => targetComps.some((tc) => pieceEquals(c, tc)))
      if (missing.length > 0) {
        const mw = pickNicest(missing.map(candidateIn)) ?? witness
        const names = missing.map(componentName).join(' and ')
        return {
          equal: false,
          witness: mw,
          pattern: patternHit(
            'dropped_union',
            `${names} ${missing.length > 1 ? 'are' : 'is'} missing from your answer — ${v} = ${ratToString(mw)} is a solution but isn't in your set.`,
          ),
        }
      }
    }
  }
  return { equal: false, witness }
}

/** Do the student's interval answer and set-builder answer describe the same numbers? */
export function crossCheck(interval: SolutionSet, builder: SolutionSet, variable = 'x'): CrossCheckResult {
  if (setsEqual(interval, builder)) return { agree: true }
  const witness = nicestWitness(interval, builder)
  if (!witness) return { agree: true }
  const inInterval = setContains(normalizeSet(interval), witness)
  const w = ratToString(witness)
  return {
    agree: false,
    witness,
    pattern: patternHit(
      'set_interval_mismatch',
      `${variable} = ${w} is in your ${inInterval ? 'interval' : 'set-builder'} but not in your ${inInterval ? 'set-builder' : 'interval'}.`,
    ),
  }
}
