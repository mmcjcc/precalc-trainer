/**
 * Range for the Unit 1 families, exact, with a reading explanation:
 *   constant, linear, quadratic (from the vertex), odd-degree polynomial,
 *   a·sqrt(bx + c) + d (any even root), a·|bx + c| + d, a·cbrt(bx + c) + d (any odd root),
 *   a/(x - h) + k (also written (px + q)/(rx + s)).
 * Anything else returns null. The family is read off the exact structure (one root/abs node of a
 * linear expression, and the whole function affine in that node), and the domain must be the family's
 * natural one (so 1/(1/x) is not mistaken for the line y = x).
 */
import type { Rational, SolutionSet } from '@/shared/types'
import { rat, ratDiv, ratMul, ratNeg, ratSub } from '@/notation/rational'
import { allReals, setFromPieces, setIsAllReals, setsEqual } from '@/notation/sets/solutionSet'
import { math, type MathNode } from '../math'
import {
  attempt,
  dedupeCandidates,
  gradeSetAgainst,
  nicestIn,
  num,
  parseFunction,
  pointIn,
} from './common'
import { parseSetAnswer } from './answer'
import { Unsupported } from './exact'
import { polyDeg, polyEval, polyOf, polyToText, ratFnOf } from './poly'
import { domainSet, rootShape, solveEq, unwrap } from './solve'
import { builderText, intervalText, pretty, prettySet, showNode } from './text'
import type { FunctionGrade, RangeFamily, RangeResult, SetMistakeCandidate } from './types'

export interface RangeModel {
  node: MathNode
  result: RangeResult
  /** The set a student gets by ignoring the reflection (a < 0). */
  reflected?: SolutionSet
  /** The outer coefficient and shift (roots, abs), and the atom text. */
  atom?: { text: string; alpha: Rational; delta: Rational; kind: 'even_root' | 'absolute_value' | 'odd_root' }
}

function ray(from: Rational, up: boolean): SolutionSet {
  return setFromPieces([up ? { lo: from, hi: 'inf', loClosed: true, hiClosed: false } : { lo: '-inf', hi: from, loClosed: false, hiClosed: true }])
}

function allBut(k: Rational): SolutionSet {
  return setFromPieces([
    { lo: '-inf', hi: k, loClosed: false, hiClosed: false },
    { lo: k, hi: 'inf', loClosed: false, hiClosed: false },
  ])
}

/** "x - 3", "x + 1/2", "x". */
export function shiftText(h: Rational, v = 'x'): string {
  if (h.n === 0) return v
  const abs = rat(Math.abs(h.n), h.d)
  return `${v} ${h.n > 0 ? '-' : '+'} ${abs.d === 1 ? abs.n : `${abs.n}/${abs.d}`}`
}

function finish(node: MathNode, family: RangeFamily, set: SolutionSet, params: RangeResult['params'], explanation: string[]): RangeResult {
  return {
    f: showNode(node),
    family,
    set,
    interval: intervalText(set),
    builder: builderText(set, 'y'),
    params,
    explanation: [...explanation, `Range: ${prettySet(set)}.`],
  }
}

/** Every atom (root or absolute value) in the tree. */
function atomsOf(node: MathNode): MathNode[] {
  const out: MathNode[] = []
  node.traverse((n) => {
    // Every function call counts (a second one, or log, makes the shape test fail).
    if (n.type === 'FunctionNode') out.push(n)
    else if (n.type === 'OperatorNode' && (n as unknown as { op: string }).op === '^' && attempt(() => rootShape(n))) out.push(n)
  })
  return out
}

function polynomialRange(node: MathNode, p: readonly Rational[]): RangeModel {
  const f = showNode(node)
  const deg = polyDeg(p)
  if (deg <= 0) {
    const c = p[0] ?? rat(0)
    const set = setFromPieces([], [c])
    return { node, result: finish(node, 'constant', set, { k: c }, [`f(x) = ${pretty(f)} is the same number for every x, so the only output is ${num(c)}.`]) }
  }
  if (deg === 1) {
    const m = p[1]!
    const b0 = p[0] ?? rat(0)
    const top = b0.n === 0 ? 'y' : `(y ${b0.n < 0 ? '+' : '−'} ${num(rat(Math.abs(b0.n), b0.d))})`
    const solveX = m.n === m.d ? top.replace(/^\((.*)\)$/, '$1') : `${top}/${m.n < 0 || m.d !== 1 ? `(${num(m)})` : num(m)}`
    return {
      node,
      result: finish(node, 'linear', allReals(), { a: m, k: b0 }, [
        `f(x) = ${pretty(f)} is linear with slope ${num(m)} ≠ 0: its graph is a slanted line with no top or bottom.`,
        `Every y is an output: solving y = ${pretty(polyToText(p))} for x always works, x = ${solveX}.`,
      ]),
    }
  }
  if (deg === 2) {
    const [b, a] = [p[1] ?? rat(0), p[2]!]
    const h = ratDiv(ratNeg(b), ratMul(rat(2), a))
    const k = polyEval(p, h)
    const up = a.n > 0
    const set = ray(k, up)
    const lines = [
      `f(x) = ${pretty(f)} is a quadratic with a = ${num(a)}${up ? ' > 0, so the parabola opens up and its vertex is the lowest point' : ' < 0, so the parabola opens down and its vertex is the highest point'}.`,
      `Vertex: x = −b/(2a) = ${num(ratNeg(b))}/(2·${a.n < 0 ? `(${num(a)})` : num(a)}) = ${num(h)}, and f(${num(h)}) = ${num(k)}.`,
      `So every output is ${up ? '≥' : '≤'} ${num(k)}, and each of those values is reached.`,
    ]
    const model: RangeModel = { node, result: finish(node, 'quadratic', set, { a, h, k }, lines) }
    if (!up) model.reflected = ray(k, true)
    return model
  }
  if (deg % 2 === 1) {
    return {
      node,
      result: finish(node, 'odd_polynomial', allReals(), { a: p[deg]! }, [
        `f(x) = ${pretty(f)} is a polynomial of odd degree ${deg}: one end of the graph goes down forever and the other goes up forever.`,
        'The graph has no breaks, so it passes through every y-value.',
      ]),
    }
  }
  throw new Unsupported('even-degree polynomial of degree 4 or more')
}

function reciprocalRange(node: MathNode, num0: readonly Rational[], den: readonly Rational[]): RangeModel {
  const [d0, d1] = [den[0] ?? rat(0), den[1]!]
  const h = ratDiv(ratNeg(d0), d1)
  const k = polyDeg(num0) === 1 ? ratDiv(num0[1]!, d1) : rat(0)
  const r = ratSub(num0[0] ?? rat(0), ratMul(k, d0))
  if (r.n === 0) throw new Unsupported('constant with a hole')
  const a = ratDiv(r, d1)
  if (!setsEqual(domainSet(node), allBut(h))) throw new Unsupported('domain is not R minus h')
  const f = showNode(node)
  const frac = `${num(a)}/(${pretty(shiftText(h))})`
  const standard = k.n === 0 ? frac : `${num(k)} + ${frac}`
  const lines: string[] = []
  if (standard.replace(/\s/g, '') !== pretty(f).replace(/\s/g, '')) lines.push(`Write f in the form a/(x − h) + k: f(x) = ${standard}.`)
  lines.push(`${frac} is never 0 (its numerator ${num(a)} is not 0), and it takes every other real value.`)
  lines.push(`So f(x) takes every value except ${num(k)}: y = ${num(k)} is the horizontal asymptote.`)
  return { node, result: finish(node, 'reciprocal', allBut(k), { a, h, k }, lines) }
}

function atomRange(node: MathNode): RangeModel {
  const atoms = atomsOf(node)
  if (atoms.length !== 1) throw new Unsupported('not a single root or absolute value')
  const atom = atoms[0]!
  const isAbs = atom.type === 'FunctionNode' && (atom as unknown as { fn: { name?: string } }).fn?.name === 'abs'
  let inner: MathNode
  let kind: 'even_root' | 'absolute_value' | 'odd_root'
  let index = 2
  if (isAbs) {
    inner = (atom as unknown as { args: MathNode[] }).args[0]!
    kind = 'absolute_value'
  } else {
    const r = rootShape(atom)
    if (!r || r.power !== 1) throw new Unsupported('not a plain root')
    inner = r.radicand
    kind = r.even ? 'even_root' : 'odd_root'
    index = r.index
  }
  const lin = polyOf(inner)
  if (!lin || polyDeg(lin) !== 1) throw new Unsupported('inside is not linear')
  const h = ratDiv(ratNeg(lin[0] ?? rat(0)), lin[1]!)
  // The function must be affine in the atom: replace it by u and read a degree-1 polynomial in u (an x
  // anywhere else makes polyOf fail).
  const replaced = node.transform((n) => (n === atom ? math.parse('u') : n))
  const outer = polyOf(replaced, 'u')
  if (!outer || polyDeg(outer) !== 1) throw new Unsupported('not affine in the atom')
  const alpha = outer[1]!
  const delta = outer[0] ?? rat(0)
  const atomText = showNode(atom)
  const f = showNode(node)
  if (kind === 'odd_root') {
    const name = index === 3 ? 'cube root' : `${index}th root`
    return {
      node,
      atom: { text: atomText, alpha, delta, kind },
      result: finish(node, 'odd_root', allReals(), { a: alpha, h, k: delta }, [
        `${pretty(atomText)} takes every real value: the ${name} of a negative number is negative, of 0 is 0, of a positive number is positive.`,
        `Multiplying by ${num(alpha)} and adding ${num(delta)} still reaches every real number, so f(x) = ${pretty(f)} does too.`,
      ]),
    }
  }
  const up = alpha.n > 0
  const set = ray(delta, up)
  const base = kind === 'absolute_value' ? 'An absolute value' : `A ${index === 2 ? 'square root' : `${index}th root`}`
  const lines = [`${base} is never negative: ${pretty(atomText)} ≥ 0, and it is 0 at x = ${num(h)}, then grows without bound.`]
  const isOne = alpha.n === alpha.d
  if (!isOne) {
    lines.push(
      up
        ? `Multiplying by ${num(alpha)} (positive) keeps it ≥ 0.`
        : `Multiplying by ${num(alpha)} (negative) flips it: ${num(alpha)}·${pretty(atomText)} ≤ 0.`,
    )
  }
  lines.push(
    delta.n === 0
      ? `So f(x) ${up ? '≥' : '≤'} 0, and every such value is reached.`
      : `Adding ${num(delta)} shifts every output: f(x) ${up ? '≥' : '≤'} ${num(delta)}, and every such value is reached.`,
  )
  const model: RangeModel = { node, atom: { text: atomText, alpha, delta, kind }, result: finish(node, kind, set, { a: alpha, h, k: delta }, lines) }
  if (!up) model.reflected = ray(delta, true)
  return model
}

/** The range model of a parsed function (throws Unsupported outside the families). */
export function rangeModel(node: MathNode): RangeModel {
  const n = unwrap(node)
  const dom = domainSet(n)
  const p = polyOf(n)
  if (p) {
    if (!setIsAllReals(dom)) throw new Unsupported('polynomial formula with a restricted domain')
    return polynomialRange(n, p)
  }
  const rf = ratFnOf(n)
  if (rf) {
    if (polyDeg(rf.den) === 1 && polyDeg(rf.num) <= 1) return reciprocalRange(n, rf.num, rf.den)
    throw new Unsupported('rational function outside a/(x - h) + k')
  }
  return atomRange(n)
}

/** Exact range for the Unit 1 families, or null. */
export function rangeOf(f: string): RangeResult | null {
  const p = parseFunction(f)
  if (!p.ok) return null
  return attempt(() => rangeModel(p.node).result)
}

// ---------------------------------------------------------------------------
// Mistakes and grading
// ---------------------------------------------------------------------------

function whyNotOutput(m: RangeModel, w: Rational): string {
  const r = m.result
  const k = r.params.k
  switch (r.family) {
    case 'constant':
      return ` (f(x) is always ${num(k!)})`
    case 'quadratic':
      return ` (the vertex value is ${num(k!)}, and the parabola opens ${r.params.a!.n > 0 ? 'up' : 'down'})`
    case 'even_root':
    case 'absolute_value':
      return ` (f(x) ${r.params.a!.n > 0 ? '≥' : '≤'} ${num(k!)} for every x)`
    case 'reciprocal':
      return ` (y = ${num(k!)} is the horizontal asymptote)`
    default:
      void w
      return ''
  }
}

/** "y = 5 is an output: f(2) = 5" or "" when no nice x is found. */
function outputWitness(m: RangeModel, w: Rational): string {
  const xs = attempt(() => solveEq(m.node, w))
  const x0 = xs ? nicestIn(xs) : undefined
  return x0 ? `f(${num(x0)}) = ${num(w)}` : `some x gives f(x) = ${num(w)}`
}

function plainRangeMessage(m: RangeModel, her: SolutionSet): string {
  const T = m.result.set
  const extra = pointIn(her, T)
  if (extra) return `Your answer includes y = ${num(extra)}, but f(x) never equals ${num(extra)}${whyNotOutput(m, extra)}.`
  const missing = pointIn(T, her)
  if (missing) return `y = ${num(missing)} is an output, ${outputWitness(m, missing)}, but your answer leaves it out.`
  return 'That set is not the range.'
}

function candidatesFor(m: RangeModel): SetMistakeCandidate[] {
  const T = m.result.set
  const out: SetMistakeCandidate[] = []
  const dom = attempt(() => domainSet(m.node))
  if (dom) {
    const extra = pointIn(dom, T)
    const missing = pointIn(T, dom)
    const tail = extra
      ? `y = ${num(extra)} is in your answer, but f(x) never equals ${num(extra)}${whyNotOutput(m, extra)}.`
      : missing
        ? `y = ${num(missing)} is an output (${outputWitness(m, missing)}), but your answer leaves it out.`
        : ''
    out.push({
      kind: 'range_gave_domain',
      set: dom,
      interval: intervalText(dom),
      witness: `${prettySet(dom)} is the domain: the inputs x. The range is the set of outputs y = f(x). ${tail}`.trim(),
    })
  }
  if (m.reflected) {
    const w = pointIn(m.reflected, T)
    const r = m.result
    let witness: string
    if (r.family === 'quadratic') {
      witness = `a = ${num(r.params.a!)} is negative, so the parabola opens down and the vertex (${num(r.params.h!)}, ${num(r.params.k!)}) is its HIGHEST point: every output is ≤ ${num(r.params.k!)}.${w ? ` Your answer includes y = ${num(w)}, which is above the vertex.` : ''}`
    } else {
      const a = m.atom!
      const coef = a.alpha.n === -a.alpha.d ? 'The minus sign in front' : `The coefficient ${num(a.alpha)} in front`
      witness = `${coef} flips the graph upside down: ${num(a.alpha)}·${pretty(a.text)} ≤ 0, so f(x) ≤ ${num(a.delta)}.${w ? ` Your answer includes y = ${num(w)}, but no output is above ${num(a.delta)}.` : ''}`
    }
    out.push({ kind: 'range_reflection_ignored', set: m.reflected, interval: intervalText(m.reflected), witness })
  }
  if (m.result.family === 'reciprocal') {
    const { a, h, k } = m.result.params
    const frac = `${num(a!)}/(${pretty(shiftText(h!))})`
    out.push({
      kind: 'range_included_asymptote',
      set: allReals(),
      interval: intervalText(allReals()),
      witness: `y = ${num(k!)} is the horizontal asymptote: ${frac} is never 0 (its numerator is ${num(a!)}), so f(x) never equals ${num(k!)}. Your answer includes ${num(k!)}; the range is ${prettySet(m.result.set)}.`,
    })
  }
  return dedupeCandidates(T, out)
}

/** What each range mistake produces for f (distinct from the range and each other), or null. */
export function rangeMistakes(f: string): SetMistakeCandidate[] | null {
  const p = parseFunction(f)
  if (!p.ok) return null
  return attempt(() => candidatesFor(rangeModel(p.node)))
}

/** Grade her range answer (a SolutionSet, or text in any form `parseSetAnswer` reads). */
export function gradeRange(f: string, answer: SolutionSet | string): FunctionGrade {
  const p = parseFunction(f)
  if (!p.ok) return { verdict: 'unsupported', message: `The function "${f}" does not parse: ${p.error.message}` }
  const m = attempt(() => rangeModel(p.node))
  if (!m) return { verdict: 'unsupported', message: `The range of ${f} is outside the families the checker handles.` }
  let her: SolutionSet
  if (typeof answer === 'string') {
    const a = parseSetAnswer(answer)
    if (!a.ok) return { verdict: 'invalid', message: a.error.message, position: a.error.position, length: a.error.length }
    her = a.set
  } else her = answer
  const cands = attempt(() => candidatesFor(m)) ?? []
  return gradeSetAgainst(her, m.result.set, cands, () => plainRangeMessage(m, her), `Correct: the range is ${prettySet(m.result.set)}.`)
}
