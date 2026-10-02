import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { expandFactored, makeFactored, polyValueAt, polynomialFromZeros, polynomialFromZerosMistakes } from '@/engine'
import type { BuiltPolynomial, PolyMistakeKind } from '@/engine'
import { ratToString } from '@/notation'
import { polyShow } from '@/content/modules/polynomials/patterns'
import { buildZerosProblem, pzTrapKinds, weighted, type PolyZerosAnswer, type PzProblem } from './build'
import { zerosSpec } from './grade'

const VERSION = 1

/** The number in front: a whole number (core §5), never 1, because then leaving it out could not be seen. */
const LEADS: readonly { item: string; weight: number }[] = [
  { item: '2', weight: 3 },
  { item: '-2', weight: 3 },
  { item: '3', weight: 2 },
  { item: '-3', weight: 2 },
  { item: '-1', weight: 3 },
]

const TRAP_WEIGHTS: readonly { item: PolyMistakeKind; weight: number }[] = [
  { item: 'lead_coefficient_omitted', weight: 3 },
  { item: 'zero_sign_reversed', weight: 3 },
  { item: 'multiplicity_ignored', weight: 2 },
  { item: 'multiplicity_wrong_zero', weight: 2 },
]

/** The height of the given point stays this small. */
const HEIGHT_LIMIT = 100

const NUDGE =
  'Every zero gives one factor, and its multiplicity says how many times that factor appears. Those factors fix where the graph meets the x-axis, but not how tall it is: leave room for a number in front, and let the point tell you what it is.'

interface Draft {
  problem: PzProblem
  built: BuiltPolynomial
}

/**
 * Two or three whole-number zeros, one of them repeated, a number in front, and a point of the graph. The
 * point's height is read off the ENGINE's polynomial for those numbers, and the engine then has to find the
 * same number in front from the zeros and the point alone. Redrawn until all four slips give different
 * formulas.
 */
function draw(rng: Rng): Draft {
  for (let tries = 0; tries < 300; tries++) {
    const count = rng.chance(0.6) ? 2 : 3
    const repeated = rng.int(0, count - 1)
    const exponent = count === 2 && rng.chance(0.2) ? 3 : 2
    const sizes: number[] = []
    const factors: { zero: number; mult: number }[] = []
    for (let i = 0; i < count; i++) {
      // No size twice: two zeros are never opposites, so a sign slip always changes the formula.
      const size = rng.intExcept(1, 4, sizes)
      sizes.push(size)
      factors.push({ zero: rng.sign() * size, mult: i === repeated ? exponent : 1 })
    }
    const lead = weighted(rng, LEADS)
    // The y-intercept is the natural point; otherwise a whole number that is not a zero, no further out
    // than one step past the outermost zeros.
    const values = factors.map((f) => f.zero)
    const x = rng.chance(0.65) ? 0 : rng.intExcept(Math.min(...values) - 1, Math.max(...values) + 1, [0, ...values])
    const expanded = expandFactored(makeFactored(lead, factors))
    const y = expanded ? polyValueAt(expanded, x) : null
    if (!y || y.d !== 1 || y.n === 0 || Math.abs(y.n) > HEIGHT_LIMIT) continue
    const problem: PzProblem = {
      question: 'build',
      f: '',
      zeros: factors.map((f) => ({ text: String(f.zero), mult: f.mult })),
      point: { x: String(x), y: String(y.n) },
    }
    const built = polynomialFromZeros(zerosSpec(problem))
    if (!built || ratToString(built.a) !== lead) continue
    const slips = polynomialFromZerosMistakes(zerosSpec(problem)) ?? []
    if (slips.some((c) => c.shadows.length > 0)) continue
    const kinds = pzTrapKinds(problem)
    if (!TRAP_WEIGHTS.every((t) => kinds.includes(t.item))) continue
    return { problem: { ...problem, f: built.text }, built }
  }
  throw new Error('polyZeros: no zeros and point passed the filters in 300 draws')
}

/** "x = −1 (multiplicity 2)" for each given zero, in the order they are shown. */
export function givenZeros(zeros: PolyZerosAnswer['zeros']): string[] {
  return zeros.map((z) => `x = ${z.text} (multiplicity ${z.mult})`)
}

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  // Salted, so seed n here is not the same polynomial as seed n of the other templates.
  const rng = makeRng(mixSeed(seed, 13))
  const { problem, built } = draw(rng)
  const trap = weighted(rng, TRAP_WEIGHTS)
  const point = problem.point!
  return buildZerosProblem({
    question: 'build',
    templateId: 'pz.build',
    version: VERSION,
    seed,
    knobs,
    title: 'A polynomial from its zeros',
    instructions: 'Type a formula for f(x). You may leave it as a product; you do not have to multiply it out.',
    prompt: 'Write a formula for the polynomial f of least degree that has these zeros and whose graph passes through the point.',
    statementText: `Zeros: ${givenZeros(problem.zeros).join(', ')}. Point on the graph: (${point.x}, ${point.y}).`,
    f: built.text,
    form: 'hidden',
    zeros: problem.zeros,
    point,
    nudges: [NUDGE],
    reveals: [built.explanation],
    reveal: built.explanation,
    expectedDisplay: `f(x) = ${polyShow(built.text)}`,
    trap,
    scenario: point.x === '0' ? 'intercept' : 'point',
    params: { degree: built.degree, zeros: problem.zeros.length, lead: ratToString(built.a), x: point.x },
  })
}

export const fromZerosTemplate: TemplateDef = {
  id: 'pz.build',
  title: 'Build a polynomial from its zeros',
  description: 'Zeros with their multiplicities and one more point of the graph: write the polynomial of least degree. Any formula that multiplies out to the right polynomial is accepted.',
  version: VERSION,
  knobs: [],
  generate,
}
