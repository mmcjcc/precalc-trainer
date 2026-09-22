/**
 * Domain from a formula in x: the exact set, the restrictions it comes from, a reading explanation,
 * the mistake candidates and the grader.
 *
 * Supported (anything else returns null rather than a guess):
 *  - polynomials; rational functions whose denominators have only rational real roots (irreducible
 *    factors with no real roots, such as x^2 + 4, are fine);
 *  - even roots (sqrt, nthRoot(u, 4), u^(1/2)…) of expressions whose boundary points are rational
 *    (linear, factorable quadratics, rational functions);
 *  - an even root as a factor of a denominator (radicand > 0);
 *  - odd roots (cbrt, nthRoot(u, 3), u^(1/3)) — no restriction of their own;
 *  - sums, differences, products, quotients, integer powers and absolute values of these.
 */
import type { Rational, SolutionSet } from '@/shared/types'
import { ratDiv, ratNeg } from '@/notation/rational'
import { nicestWitness } from '@/notation/sets/compare'
import { setContains, setIsAllReals, setIsEmpty } from '@/notation/sets/solutionSet'
import type { MathNode } from '../math'
import { attempt, dedupeCandidates, evalText, gradeSetAgainst, num, parseFunction, pointIn } from './common'
import { parseSetAnswer } from './answer'
import { surdOf, type Surd } from './exact'
import { factoredText, polyDeg, polyOf } from './poly'
import { rangeModel } from './range'
import {
  analyzeDomain,
  intersectAll,
  NONNEG,
  POSITIVE,
  preimage,
  solveEq,
  valueInSet,
  type DomainAnalysis,
  type RestrictionInfo,
} from './solve'
import { builderText, describeText, intervalText, predicateText, pretty, prettySet, showNode } from './text'
import type { DomainRestriction, DomainResult, FunctionGrade, SetMistakeCandidate } from './types'

// ---------------------------------------------------------------------------
// Explanation
// ---------------------------------------------------------------------------

export function rootName(index: number): string {
  const names: Record<number, string> = { 2: 'square root', 3: 'cube root', 4: 'fourth root', 5: 'fifth root', 6: 'sixth root' }
  return names[index] ?? `${index}th root`
}

const REL: Record<string, string> = { '!=': '≠', '>=': '≥', '>': '>' }

/** Isolated zeros of a node (null when its zero set contains an interval or is not exact). */
function zerosOf(node: MathNode): Rational[] | null {
  const z = attempt(() => solveEq(node, { n: 0, d: 1 }))
  if (!z || z.pieces.length) return null
  return z.points
}

function listText(values: Rational[]): string {
  const t = values.map((v) => `x = ${num(v)}`)
  return t.length <= 1 ? (t[0] ?? '') : `${t.slice(0, -1).join(', ')} and ${t[t.length - 1]}`
}

/** "−2x + 6 ≥ 0 → −2x ≥ −6 → x ≤ 3 (dividing by −2 flips ≥ to ≤)". */
function linearSteps(r: RestrictionInfo): string {
  const { a, b } = r.linear!
  const rel = r.relation
  const bound = ratDiv(ratNeg(b), a)
  const flip = a.n < 0
  const solvedRel = rel === '!=' ? '≠' : flip ? (rel === '>=' ? '≤' : '<') : REL[rel]!
  const steps = [`${pretty(r.expr)} ${REL[rel]} 0`]
  const ax = a.n === a.d ? 'x' : a.n === -a.d ? '−x' : `${num(a)}x`
  if (b.n !== 0) steps.push(`${ax} ${REL[rel]} ${num(ratNeg(b))}`)
  if (a.n !== a.d) steps.push(`x ${solvedRel} ${num(bound)}`)
  let note = ''
  if (flip && rel !== '!=') {
    note = a.n === -a.d ? ` (multiplying by −1 flips ${REL[rel]} to ${solvedRel})` : ` (dividing by ${num(a)}, a negative number, flips ${REL[rel]} to ${solvedRel})`
  }
  return `${steps.join(' → ')}${note}`
}

function solvingText(r: RestrictionInfo): string {
  const cond = `${pretty(r.expr)} ${REL[r.relation]} 0`
  if (r.linear) return `${linearSteps(r)}.`
  if (setIsAllReals(r.set)) return `${cond} holds for every x, so this removes nothing.`
  if (setIsEmpty(r.set)) return `${cond} never holds, so no x works.`
  const solved = pretty(predicateText(r.set))
  const poly = polyOf(r.node)
  const zeros = zerosOf(r.node)
  if (poly && polyDeg(poly) >= 2 && zeros && zeros.length) {
    const fac = factoredText(poly)
    const where = fac ? `${pretty(r.expr)} = ${pretty(fac)} is 0 at ${pretty(listText(zeros))}` : `${pretty(r.expr)} is 0 at ${pretty(listText(zeros))}`
    if (r.relation === '!=') return `${where}, so ${solved}.`
    return `${where}; a test number in each piece shows ${cond} when ${solved}.`
  }
  return `${cond} when ${solved}.`
}

function explainRestriction(r: RestrictionInfo): string {
  if (r.kind === 'denominator') {
    const lead = `The denominator ${pretty(r.expr)} cannot be 0`
    const zeros = zerosOf(r.node)
    if (zeros && zeros.length === 0) return `${lead}, and it never is for a real x, so it removes nothing.`
    if (r.linear) return `${lead}: ${linearSteps(r)}.`
    return `${lead}: ${solvingText(r)}`
  }
  const root = pretty(r.rootText ?? r.expr)
  const name = rootName(r.index ?? 2)
  if (r.kind === 'even_root') return `The ${name} ${root} needs a radicand ≥ 0: ${solvingText(r)}`
  return `${root} is in a denominator, so it must be strictly positive (a ${name} of 0 would divide by 0): ${solvingText(r)}`
}

function explain(fText: string, a: DomainAnalysis): string[] {
  const lines: string[] = []
  if (!a.restrictions.length && !a.oddRoots.length) {
    lines.push(`f(x) = ${pretty(fText)} has no variable denominator and no even root, so every real number is allowed.`)
  }
  for (const r of a.restrictions) lines.push(explainRestriction(r))
  for (const o of a.oddRoots) {
    lines.push(`The ${rootName(o.index)} ${pretty(o.rootText)} is defined for every real number (an odd root of a negative number is negative), so it adds no restriction.`)
  }
  const desc = describeText(a.set)
  const plain = pretty(desc)
  const set = prettySet(a.set)
  lines.push(plain === set ? `Domain: ${set}.` : `Domain: ${set}, that is, ${plain}.`)
  return lines
}

function toPublic(r: RestrictionInfo): DomainRestriction {
  const out: DomainRestriction = {
    kind: r.kind,
    expr: r.expr,
    relation: r.relation,
    condition: `${r.expr} ${r.relation} 0`,
    set: r.set,
    solved: predicateText(r.set),
  }
  if (r.index !== undefined) out.index = r.index
  if (r.rootText !== undefined) out.root = r.rootText
  return out
}

export interface DomainModel {
  node: MathNode
  analysis: DomainAnalysis
  result: DomainResult
}

export function domainModel(node: MathNode): DomainModel {
  const analysis = analyzeDomain(node)
  const f = showNode(node)
  const result: DomainResult = {
    f,
    set: analysis.set,
    interval: intervalText(analysis.set),
    builder: builderText(analysis.set),
    restrictions: analysis.restrictions.map(toPublic),
    oddRoots: analysis.oddRoots.map((o) => ({ expr: o.expr, index: o.index, root: o.rootText })),
    explanation: explain(f, analysis),
  }
  return { node, analysis, result }
}

/** Exact domain of f (app syntax in x, "f(x) =" optional), or null outside the supported shapes. */
export function domainOf(f: string): DomainResult | null {
  const p = parseFunction(f)
  if (!p.ok) return null
  return attempt(() => domainModel(p.node).result)
}

// ---------------------------------------------------------------------------
// Why a point is outside the domain
// ---------------------------------------------------------------------------

/** "the denominator x − 3 is 0 there", "the radicand x − 5 is −2 there, which is negative". */
export function whyUndefined(a: DomainAnalysis, w: Rational | Surd): string {
  const s = 'terms' in w ? w : surdOf(w)
  for (const r of a.restrictions) {
    if (attempt(() => valueInSet(s, r.set)) !== false) continue
    const v = evalText(r.node, w)
    if (v === 'undef') continue
    if (r.kind === 'denominator') return `the denominator ${pretty(r.expr)} is 0 there`
    if (r.kind === 'even_root_denominator' && v === '0') return `the denominator ${pretty(r.rootText ?? r.expr)} is the ${rootName(r.index ?? 2)} of 0, which is 0, there`
    return `the radicand ${pretty(r.expr)} is ${pretty(v)} there, which is negative`
  }
  return 'the formula is undefined there'
}

function fAt(node: MathNode, w: Rational): string {
  const v = evalText(node, w)
  return v === 'undef' ? 'undefined' : pretty(v)
}

// ---------------------------------------------------------------------------
// Mistake candidates
// ---------------------------------------------------------------------------

function candidates(m: DomainModel): SetMistakeCandidate[] {
  const { node, analysis } = m
  const R = analysis.restrictions
  const T = analysis.set
  const sets = R.map((r) => r.set)
  const out: SetMistakeCandidate[] = []
  const add = (kind: SetMistakeCandidate['kind'], set: SolutionSet, witness: (set: SolutionSet) => string) => {
    out.push({ kind, set, interval: intervalText(set), witness: witness(set) })
  }
  const replace = (idx: number[], by: (i: number) => SolutionSet | null) =>
    intersectAll(sets.flatMap((s, j) => (idx.includes(j) ? [by(j)].filter((x): x is SolutionSet => x !== null) : [s])))
  const eachAndAll = (idx: number[]): number[][] => (idx.length > 1 ? [idx, ...idx.map((i) => [i])] : idx.length ? [idx] : [])
  const indices = (pred: (r: RestrictionInfo) => boolean) => R.map((r, i) => (pred(r) ? i : -1)).filter((i) => i >= 0)

  // 1. Forgot the denominator restriction(s).
  const dens = indices((r) => r.kind === 'denominator')
  for (const group of eachAndAll(dens)) {
    add('domain_forgot_denominator', replace(group, () => null), (C) => {
      const w = pointIn(C, T)
      const lesson = group.map((i) => `${pretty(R[i]!.expr)} ≠ 0 gives ${pretty(predicateText(R[i]!.set))}`).join('; ')
      if (!w) return `A denominator can never be 0: ${lesson}.`
      return `Your answer includes x = ${num(w)}, but ${whyUndefined(analysis, w)}, so f(${num(w)}) is undefined. A denominator can never be 0: ${lesson}.`
    })
  }

  // 2. Even root in a denominator solved with ≥ (the zero of the radicand included).
  const rootDens = indices((r) => r.kind === 'even_root_denominator')
  for (const group of eachAndAll(rootDens)) {
    add('domain_root_denominator_zero', replace(group, (i) => preimage(R[i]!.node, NONNEG)), (C) => {
      const w = pointIn(C, T)
      const r = R[group.find((i) => w && !setContains(R[i]!.set, w)) ?? group[0]!]!
      const root = pretty(r.rootText ?? r.expr)
      const head = w ? `Your answer includes x = ${num(w)}, but there the denominator ${root} is the ${rootName(r.index ?? 2)} of 0, which is 0, so f(${num(w)}) divides by 0.` : ''
      return `${head} A root in a denominator must be strictly positive: ${pretty(r.expr)} > 0, not ≥ 0.`.trim()
    })
  }

  // 3. Used > where ≥ belongs for an even root (the radicand's zero left out).
  const roots = indices((r) => r.kind === 'even_root')
  for (const group of eachAndAll(roots)) {
    add('domain_root_strict', replace(group, (i) => preimage(R[i]!.node, POSITIVE)), (C) => {
      const w = pointIn(T, C, node)
      const r = R[group.find((i) => w && setContains(R[i]!.set, w) && !setContains(preimage(R[i]!.node, POSITIVE), w)) ?? group[0]!]!
      const name = rootName(r.index ?? 2)
      const head = w ? `Your answer leaves out x = ${num(w)}, but f(${num(w)}) = ${fAt(node, w)} is defined: the ${name} of 0 is 0.` : `The ${name} of 0 is 0.`
      return `${head} The radicand only has to be ≥ 0, so ${pretty(r.expr)} ≥ 0 keeps its endpoint${w ? ` (x = ${num(w)} belongs in the domain; use a bracket)` : ''}.`
    })
  }

  // 4. Solved a root restriction without flipping when dividing by a negative.
  for (const i of indices((r) => (r.kind === 'even_root' || r.kind === 'even_root_denominator') && !!r.linear && r.linear.a.n < 0)) {
    const r = R[i]!
    const { a, b } = r.linear!
    const bound = ratDiv(ratNeg(b), a)
    const closed = r.relation === '>='
    const mirrored: SolutionSet = { pieces: [{ lo: bound, hi: 'inf', loClosed: closed, hiClosed: false }], points: [] }
    add('domain_no_flip', replace([i], () => mirrored), (C) => {
      const w = pointIn(C, T)
      const rel = REL[r.relation]!
      const flipped = closed ? '≤' : '<'
      const ax = a.n === -a.d ? '−x' : `${num(a)}x`
      const step = b.n !== 0 ? `${ax} ${rel} ${num(ratNeg(b))}; ` : ''
      const div = a.n === -a.d ? 'multiplying by −1' : `dividing by ${num(a)}, a negative number,`
      const at = w ? ` Your answer points the other way: at x = ${num(w)} the radicand ${pretty(r.expr)} is ${pretty(evalText(r.node, w))}, which is negative.` : ''
      return `From ${pretty(r.expr)} ${rel} 0: ${step}${div} flips the inequality, so x ${flipped} ${num(bound)}.${at}`
    })
  }

  // 5. Restricted an odd root as if it were even.
  const odd = analysis.oddRoots
  const oddGroups = odd.length > 1 ? [odd.map((_, i) => i), ...odd.map((_, i) => [i])] : odd.length ? [[0]] : []
  for (const group of oddGroups) {
    const extra = group.map((i) => preimage(odd[i]!.radicand, odd[i]!.inDenominator ? POSITIVE : NONNEG))
    add('domain_odd_root_restricted', intersectAll([...sets, ...extra]), (C) => {
      const w = pointIn(T, C, node)
      const o = odd[group[0]!]!
      const name = rootName(o.index)
      const head = w ? `Your answer leaves out x = ${num(w)}, but f(${num(w)}) = ${fAt(node, w)} is defined.` : ''
      return `${head} ${pretty(o.rootText)} is a ${name}: the ${name} of a negative number is a real number (cbrt(−8) = −2). Only even roots, like square roots, need a radicand ≥ 0.`.trim()
    })
  }

  // 6. Wrote the denominator restriction as ≥ 0 (or > 0) instead of ≠ 0.
  for (const group of eachAndAll(dens)) {
    for (const rel of ['>=', '>'] as const) {
      add('domain_denominator_nonneg', replace(group, (i) => preimage(R[i]!.node, rel === '>=' ? NONNEG : POSITIVE)), (C) => {
        const w = pointIn(T, C, node)
        const r = R[group.find((i) => w && setContains(R[i]!.set, w)) ?? group[0]!]!
        const want = rel === '>=' ? '≥ 0' : 'positive'
        const head = w ? ` At x = ${num(w)}, ${pretty(r.expr)} = ${pretty(evalText(r.node, w))} and f(${num(w)}) = ${fAt(node, w)} is defined, but your answer leaves it out.` : ''
        return `A denominator only has to be nonzero, not ${want}.${head} Solve ${pretty(r.expr)} ≠ 0 instead: ${pretty(predicateText(r.set))}.`
      })
    }
  }

  // 7. Gave the range instead.
  const range = attempt(() => rangeModel(node))
  if (range) {
    add('domain_gave_range', range.result.set, (C) => {
      const extra = pointIn(C, T)
      const missing = pointIn(T, C, node)
      const tail = extra
        ? `x = ${num(extra)} is in your answer, but ${whyUndefined(analysis, extra)}, so f(${num(extra)}) is undefined.`
        : missing
          ? `x = ${num(missing)} is a valid input (f(${num(missing)}) = ${fAt(node, missing)}), but your answer leaves it out.`
          : ''
      return `${prettySet(C)} is the range of f: its outputs. The domain is the set of inputs x that f accepts. ${tail}`.trim()
    })
  }
  return dedupeCandidates(T, out)
}

/** What each domain mistake produces for f (distinct from the domain and from each other), or null. */
export function domainMistakes(f: string): SetMistakeCandidate[] | null {
  const p = parseFunction(f)
  if (!p.ok) return null
  return attempt(() => candidates(domainModel(p.node)))
}

function plainDomainMessage(m: DomainModel, her: SolutionSet): string {
  const T = m.analysis.set
  const w0 = nicestWitness(her, T)
  if (!w0) return 'That set is not the domain.'
  if (setContains(her, w0)) {
    return `Your answer includes x = ${num(w0)}, but ${whyUndefined(m.analysis, w0)}, so f(${num(w0)}) is undefined.`
  }
  const w = pointIn(T, her, m.node) ?? w0
  return `x = ${num(w)} is in the domain: f(${num(w)}) = ${fAt(m.node, w)}, but your answer leaves it out.`
}

/** Grade her domain answer (a SolutionSet, or text in any form `parseSetAnswer` reads). */
export function gradeDomain(f: string, answer: SolutionSet | string): FunctionGrade {
  const p = parseFunction(f)
  if (!p.ok) return { verdict: 'unsupported', message: `The function "${f}" does not parse: ${p.error.message}` }
  const m = attempt(() => domainModel(p.node))
  if (!m) return { verdict: 'unsupported', message: `The domain of ${f} is outside what the checker can find exactly.` }
  let her: SolutionSet
  if (typeof answer === 'string') {
    const a = parseSetAnswer(answer)
    if (!a.ok) return { verdict: 'invalid', message: a.error.message, position: a.error.position, length: a.error.length }
    her = a.set
  } else her = answer
  const cands = attempt(() => candidates(m)) ?? []
  return gradeSetAgainst(her, m.analysis.set, cands, () => plainDomainMessage(m, her), `Correct: the domain is ${prettySet(m.analysis.set)}.`)
}

