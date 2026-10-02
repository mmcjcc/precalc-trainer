import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { expandFactored, makeFactored, rationalRootCandidates } from '@/engine'
import type { FactorInput, PolyMistakeKind, RootCandidates } from '@/engine'
import { ratToString } from '@/notation'
import { polyShow } from '@/content/modules/polynomials/patterns'
import { NONMONIC_FACTORS, buildZerosProblem, largestNumber, pmShow, pzTrapKinds, rationalCalc, weighted } from './build'

const VERSION = 1

/** Lists up to 16 candidates are fine to type; a problem with no rational zero keeps the list shorter. */
const MAX_CANDIDATES = 16
const MAX_CANDIDATES_SPARSE = 12
const COEFFICIENT_LIMIT = 40

const SPARSE_LEADS: readonly { item: number; weight: number }[] = [
  { item: 2, weight: 4 },
  { item: 3, weight: 3 },
  { item: 4, weight: 2 },
  { item: 6, weight: 1 },
]
/** Constant terms with two to four factors. */
const SPARSE_CONSTANTS = [2, 3, 4, 5, 6, 8, 9, 10] as const

const TRAP_WEIGHTS: readonly { item: PolyMistakeKind; weight: number }[] = [
  { item: 'rrt_inverted', weight: 3 },
  { item: 'rrt_integers_only', weight: 3 },
  { item: 'rrt_wrong_coefficients', weight: 2 },
  { item: 'rrt_no_plus_minus', weight: 1 },
  { item: 'zero_sign_reversed', weight: 2 },
]

const NUDGE_CANDIDATES =
  'Only two numbers of f(x) matter for this list: the constant term and the leading coefficient. Write down the factors of each. A candidate is a fraction built from one factor of each kind. Decide which kind goes on top, and remember that a zero can be negative.'
const NUDGE_ZEROS =
  'Being on the list does not make a number a zero. Test your candidates one at a time: put each one into f(x), or divide synthetically and look at the remainder.'

/** Usable for this question: a leading coefficient with factors, a constant term with two to four, a list short enough to type. */
function usable(m: RootCandidates | null, limit: number): m is RootCandidates {
  if (!m) return false
  if (m.candidates.length > limit || m.q.length < 2 || m.p.length < 2 || m.p.length > 4) return false
  // q/p must be a different list from p/q, or turning the fraction over could not be seen.
  if (Math.abs(m.constant) === Math.abs(m.leading)) return false
  return largestNumber(m.f) <= COEFFICIENT_LIMIT
}

/**
 * A cubic that is a product of three linear factors, at least one with a number in front of x, multiplied
 * out by the engine: three rational zeros, one or two of them fractions.
 */
function drawProduct(rng: Rng): RootCandidates {
  for (let tries = 0; tries < 300; tries++) {
    const first = rng.pick(NONMONIC_FACTORS)
    const factors: FactorInput[] = [first]
    const sizes: number[] = []
    const whole = () => {
      const size = rng.intExcept(1, 4, sizes)
      sizes.push(size)
      factors.push({ zero: rng.sign() * size })
    }
    const two = rng.chance(0.2)
    if (two) factors.push(rng.pick(NONMONIC_FACTORS.filter((f) => f.coef !== first.coef)))
    else whole()
    whole()
    const lead = !two && rng.chance(0.15) ? 2 : 1
    const f = expandFactored(makeFactored(lead, rng.shuffle(factors)))
    const m = f ? rationalRootCandidates(f) : null
    if (!usable(m, MAX_CANDIDATES) || m.zeros.length !== 3) continue
    return m
  }
  throw new Error('polyZeros: no product passed the rational-root filters in 300 draws')
}

/** A cubic with picked coefficients and at most one rational zero: most of the list, or all of it, fails the test. */
function drawSparse(rng: Rng, zeros: 0 | 1): RootCandidates {
  for (let tries = 0; tries < 600; tries++) {
    const coefficients = [weighted(rng, SPARSE_LEADS), rng.int(-6, 6), rng.int(-6, 6), rng.sign() * rng.pick(SPARSE_CONSTANTS)]
    const m = rationalRootCandidates(coefficients)
    if (!usable(m, MAX_CANDIDATES_SPARSE) || m.zeros.length !== zeros) continue
    return m
  }
  throw new Error('polyZeros: no cubic passed the rational-root filters in 600 draws')
}

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  // Salted, so seed n here is not the same polynomial as seed n of the other templates.
  const rng = makeRng(mixSeed(seed, 14))
  const scenario = weighted(rng, [
    { item: 'product', weight: 7 },
    { item: 'one', weight: 2 },
    { item: 'none', weight: 1 },
  ] as const)
  const m = scenario === 'product' ? drawProduct(rng) : drawSparse(rng, scenario === 'one' ? 1 : 0)
  const zerosText = m.zeros.map(ratToString).join(', ') || 'none'
  const kinds = pzTrapKinds({ question: 'rational', f: m.f, zeros: [] })
  const trap = weighted(rng, TRAP_WEIGHTS.filter((t) => kinds.includes(t.item)))
  return buildZerosProblem({
    question: 'rational',
    templateId: 'pz.rational',
    version: VERSION,
    seed,
    knobs,
    title: 'Possible rational zeros',
    instructions: 'List every possible rational zero, with commas between the numbers. To type plus-or-minus, write +- in front of a number, as in "+-1, +-3". Then give the ones that really are zeros.',
    prompt: 'List every possible rational zero of f. Then find which of them really are zeros.',
    statementText: m.f,
    f: m.f,
    form: 'standard',
    zeros: [],
    candidatesText: m.text,
    rationalZerosText: zerosText,
    nudges: [NUDGE_CANDIDATES, NUDGE_ZEROS],
    reveals: [m.explanation, m.zeroExplanation],
    reveal: [...m.explanation, ...m.zeroExplanation],
    expectedDisplay: `possible rational zeros ${pmShow(m.text)}; rational zeros: ${polyShow(zerosText)}`,
    trap,
    scenario,
    calc: rationalCalc(m.f),
    params: { leading: m.leading, constant: m.constant, candidates: m.candidates.length, zeros: m.zeros.length },
  })
}

export const rationalTemplate: TemplateDef = {
  id: 'pz.rational',
  title: 'Rational root candidates',
  description: 'A cubic with whole-number coefficients: list every possible rational zero, then say which of them are zeros. Sometimes only one is, and sometimes none.',
  version: VERSION,
  knobs: [],
  generate,
}
