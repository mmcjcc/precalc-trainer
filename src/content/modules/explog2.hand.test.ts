/**
 * Hand-worked problems a precalculus book prints for the second half of Unit 3 (graphs, inverses, growth and
 * decay). Each problem is built with the module's own builder from the textbook numbers, and its expected
 * answer is written here and checked against Math directly, not taken from the generator.
 */
import { describe, expect, it } from 'vitest'
import type { ExpLogPartTrap } from '@/content/types'
import { baseOf, featuresAnswer, gradeEgPart, inverseAnswer, type Curve, type ExpLogGraphsAnswer } from './expLogGraphs'
import { gradeEmPart, growthProblem, halfLifeProblem, interestProblem, modelAnswer, type ExpModelsAnswer } from './expModels'

const first = (traps: readonly ExpLogPartTrap[]) => traps[0]!
const curve = (family: Curve['family'], a: number, base: string, h: number, k: number): Curve => ({ family, a, base: baseOf(base), h, k })
const features = (c: Curve): ExpLogGraphsAnswer => featuresAnswer(c, (parts) => ({ stage: parts[0]!.id, trap: parts[0]!.traps[0]! })).answer
const inverse = (c: Curve): ExpLogGraphsAnswer => inverseAnswer(c, first).answer
const verdict = (a: ExpLogGraphsAnswer | ExpModelsAnswer, stage: string, text: string): string => {
  const g = a.type === 'expLogGraphs' ? gradeEgPart(a, stage, text) : gradeEmPart(a, stage, text)
  return g.verdict === 'mistake' ? g.mistake : g.verdict
}

describe('compound and continuous interest', () => {
  it('$1,000 at 5% compounded monthly for 10 years is $1,647.01, in every way she might type it', () => {
    expect(1000 * (1 + 0.05 / 12) ** 120).toBeCloseTo(1647.0095, 4)
    const a = modelAnswer(interestProblem({ ask: 'balance', P: 1000, bp: 500, n: 12, t: 10 }), first)
    expect(a.prompt).toBe('$1,000 is invested at 5% interest compounded monthly. How much is in the account after 10 years? Round to the nearest cent.')
    expect(a.stages[0]!.answerText).toBe('1,647.01')
    for (const typed of ['$1,647.01', '1647.01', '1,647.01', '$1647.01', '1647.01 dollars', 'A = 1647.01', '1647.009']) expect(verdict(a, 'answer', typed), typed).toBe('correct')
    // Rounded too far, or the formula unrounded: not an attempt.
    expect(verdict(a, 'answer', '1647.0')).toBe('invalid')
    expect(verdict(a, 'answer', '1647')).toBe('invalid')
    expect(verdict(a, 'answer', '1000(1 + 0.05/12)^120')).toBe('invalid')
    // The slips, each with the value it gives on THIS problem.
    expect(verdict(a, 'answer', '1628.89')).toBe('exp_wrong_period') // annually: 1000(1.05)^10
    expect(verdict(a, 'answer', '1643.62')).toBe('exp_wrong_period') // quarterly
    expect(verdict(a, 'answer', '1500.00')).toBe('exp_simple_interest') // 1000(1 + 0.05·10)
    expect(verdict(a, 'answer', '1648.72')).toBe('exp_continuous_swapped') // 1000e^0.5
    expect(verdict(a, 'answer', '1042.46')).toBe('exp_exponent_missing') // (1 + 0.05/12)^10
    expect(verdict(a, 'answer', '1700')).toBe('wrong')
  })

  it('$2,500 at 4.5% compounded monthly for 8 years is $3,580.91', () => {
    expect(2500 * (1 + 0.045 / 12) ** 96).toBeCloseTo(3580.9116, 4)
    const a = modelAnswer(interestProblem({ ask: 'balance', P: 2500, bp: 450, n: 12, t: 8 }), first)
    expect(a.prompt).toContain('$2,500 is invested at 4.5% interest compounded monthly.')
    for (const typed of ['$3,580.91', '3580.91', '3,580.91']) expect(verdict(a, 'answer', typed), typed).toBe('correct')
  })

  it('$5,000 at 3% compounded continuously for 10 years is $6,749.29', () => {
    expect(5000 * Math.exp(0.3)).toBeCloseTo(6749.294, 3)
    const a = modelAnswer(interestProblem({ ask: 'balance', P: 5000, bp: 300, n: 0, t: 10 }), first)
    expect(a.prompt).toContain('compounded continuously')
    expect(verdict(a, 'answer', '6749.29')).toBe('correct')
    expect(verdict(a, 'answer', '6,749.29')).toBe('correct')
    expect(verdict(a, 'answer', String((5000 * (1 + 0.03 / 12) ** 120).toFixed(2)))).toBe('exp_continuous_swapped') // monthly used for continuous
    expect(verdict(a, 'answer', '6500.00')).toBe('exp_simple_interest')
  })

  it('money doubles at 6% compounded continuously in 11.55 years; r = 6 gives 0.12', () => {
    expect(Math.log(2) / 0.06).toBeCloseTo(11.5525, 4)
    const a = modelAnswer(interestProblem({ ask: 'double', P: 1000, bp: 600, n: 0, places: 2 }), first)
    expect(a.prompt).toBe('An investment earns 6% interest compounded continuously. How long will it take the investment to double? Round to the nearest hundredth of a year.')
    expect(verdict(a, 'answer', '11.55')).toBe('correct')
    expect(verdict(a, 'answer', '11.55 years')).toBe('correct')
    expect(verdict(a, 'answer', 'ln(2)/0.06')).toBe('invalid') // exact, but the problem says round
    expect(verdict(a, 'answer', '11.6')).toBe('invalid') // rounded too far
    expect(verdict(a, 'answer', '0.12')).toBe('exp_rate_percent') // ln 2 / 6
    expect(verdict(a, 'answer', '16.67')).toBe('exp_simple_interest') // 1/0.06
    expect(verdict(a, 'answer', '11.58')).toBe('exp_continuous_swapped') // monthly
  })

  it('money doubles at 8% compounded quarterly in 8.75 years', () => {
    expect(Math.log(2) / (4 * Math.log(1.02))).toBeCloseTo(8.7507, 4)
    const a = modelAnswer(interestProblem({ ask: 'double', P: 1000, bp: 800, n: 4, places: 2 }), first)
    expect(verdict(a, 'answer', '8.75')).toBe('correct')
    expect(verdict(a, 'answer', '35.00')).toBe('exp_exponent_missing') // n·t, not divided by 4
  })

  it('$1,500 grows to $2,500 at 6% compounded quarterly in 8.58 years', () => {
    expect(Math.log(2500 / 1500) / (4 * Math.log(1.015))).toBeCloseTo(8.5775, 4)
    const a = modelAnswer(interestProblem({ ask: 'time', P: 1500, bp: 600, n: 4, A: 2500, places: 2 }), first)
    expect(a.prompt).toBe('$1,500 is invested at 6% interest compounded quarterly. How long will it take for the balance to reach $2,500? Round to the nearest hundredth of a year.')
    expect(verdict(a, 'answer', '8.58')).toBe('correct')
    expect(verdict(a, 'answer', 't = 8.58')).toBe('correct')
    expect(verdict(a, 'answer', '34.31')).toBe('exp_exponent_missing')
  })
})

describe('half-life and carbon-14', () => {
  it('carbon-14 with 25% left is 11,460 years; the three slips are 2,865, 5,730 and 2,378', () => {
    expect((5730 * Math.log(0.25)) / Math.log(0.5)).toBeCloseTo(11460, 9)
    const a = modelAnswer(halfLifeProblem({ ask: 'carbon', percent: 25, places: 0 }), first)
    expect(a.prompt).toBe('A bone contains 25% of the carbon-14 that a living bone has. The half-life of carbon-14 is 5730 years. How old is the bone? Round to the nearest year.')
    for (const typed of ['11,460', '11460', '11460 years', '11,460 years', 't = 11460']) expect(verdict(a, 'answer', typed), typed).toBe('correct')
    expect(verdict(a, 'answer', '2865')).toBe('exp_halflife_inverted')
    expect(verdict(a, 'answer', '5730')).toBe('exp_halflife_base')
    expect(verdict(a, 'answer', '2378')).toBe('exp_halflife_decayed')
  })

  it('an artifact that lost 75% of its carbon-14 is also 11,460 years old', () => {
    const a = modelAnswer(halfLifeProblem({ ask: 'carbon', percent: 75, lost: true, places: 0 }), first)
    expect(a.prompt).toContain('has lost 75% of its carbon-14')
    expect(verdict(a, 'answer', '11460')).toBe('correct')
    expect(verdict(a, 'answer', '2378')).toBe('exp_halflife_decayed')
  })

  it('250 g with a 12-day half-life leaves 44.19 g after 30 days', () => {
    expect(250 * 0.5 ** 2.5).toBeCloseTo(44.1942, 4)
    const a = modelAnswer(halfLifeProblem({ ask: 'left', A0: 250, h: 12, t: 30, mass: 'gram', time: 'day', places: 2 }), first)
    expect(a.prompt).toBe('A 250-gram sample of a radioactive isotope has a half-life of 12 days. How much of it is left after 30 days? Round to the nearest hundredth of a gram.')
    expect(verdict(a, 'answer', '44.19')).toBe('correct')
    expect(verdict(a, 'answer', '44.19 grams')).toBe('correct')
    expect(verdict(a, 'answer', '44.19 g')).toBe('correct')
    expect(verdict(a, 'answer', '205.81')).toBe('exp_halflife_decayed')
    expect(verdict(a, 'answer', '189.46')).toBe('exp_halflife_inverted')
  })

  it('400 mg decays to 50 mg in 24 hours when the half-life is 8 hours; a whole number is right as it is', () => {
    const a = modelAnswer(halfLifeProblem({ ask: 'time', A0: 400, A: 50, h: 8, mass: 'milligram', time: 'hour', places: 1 }), first)
    expect(a.prompt).toContain('Round to the nearest tenth of an hour.')
    for (const typed of ['24', '24.0', '24 hours']) expect(verdict(a, 'answer', typed), typed).toBe('correct')
    expect(verdict(a, 'answer', '8.0')).toBe('exp_halflife_base')
  })

  it('200 mg decays to 140 mg in 9 days: the half-life is 17.5 days', () => {
    expect((9 * Math.log(0.5)) / Math.log(0.7)).toBeCloseTo(17.4902, 4)
    const a = modelAnswer(halfLifeProblem({ ask: 'halflife', A0: 200, A: 140, t: 9, mass: 'milligram', time: 'day', places: 1 }), first)
    expect(verdict(a, 'answer', '17.5')).toBe('correct')
    expect(verdict(a, 'answer', '4.6')).toBe('exp_halflife_inverted')
    expect(verdict(a, 'answer', '9.0')).toBe('exp_halflife_base')
    expect(verdict(a, 'answer', '5.2')).toBe('exp_halflife_decayed')
  })
})

describe('continuous growth from two counts', () => {
  const draft = growthProblem({ who: 'bacteria', P0: 180, P1: 270, t1: 4, follow: { ask: 'predict', T: 10 } })
  const a = modelAnswer(draft, first)

  it('k is ln(3/2)/4 exactly, in any equal exact form, and a decimal is not the exact value', () => {
    expect(Math.log(1.5) / 4).toBeCloseTo(0.101366, 6)
    for (const typed of ['ln(3/2)/4', 'ln(1.5)/4', 'ln(270/180)/4', '(ln(270) - ln(180))/4', '0.25ln(1.5)', 'k = ln(1.5)/4']) expect(verdict(a, 'k', typed), typed).toBe('correct')
    expect(verdict(a, 'k', '0.1014')).toBe('invalid')
    expect(verdict(a, 'k', '(270/180)/4')).toBe('exp_growth_no_log')
    expect(verdict(a, 'k', '0.375')).toBe('exp_growth_no_log')
    expect(verdict(a, 'k', 'ln(90)/4')).toBe('exp_growth_log_diff')
    expect(verdict(a, 'k', '4/ln(1.5)')).toBe('exp_growth_swapped')
    expect(verdict(a, 'k', 'log(1.5)/4')).toBe('log_ln_confused')
  })

  it('k rounds to 0.1014, and 496 bacteria after 10 hours with either k', () => {
    expect(verdict(a, 'kRounded', '0.1014')).toBe('correct')
    expect(verdict(a, 'kRounded', '0.101')).toBe('invalid')
    expect(verdict(a, 'kRounded', '0.3750')).toBe('exp_growth_no_log')
    expect(180 * Math.exp((Math.log(1.5) / 4) * 10)).toBeCloseTo(496.0217, 4)
    expect(180 * Math.exp(0.1014 * 10)).toBeCloseTo(496.189, 3)
    expect(verdict(a, 'follow', '496')).toBe('correct')
    expect(verdict(a, 'follow', '496 bacteria')).toBe('correct')
  })

  it('the culture reaches 1,000 in 16.9 hours, and the slips of that solve are named', () => {
    const reach = modelAnswer(growthProblem({ who: 'bacteria', P0: 180, P1: 270, t1: 4, follow: { ask: 'reach', S: 1000, places: 1 } }), first)
    expect(Math.log(1000 / 180) / (Math.log(1.5) / 4)).toBeCloseTo(16.9169, 4)
    expect(verdict(reach, 'follow', '16.9')).toBe('correct')
    expect(verdict(reach, 'follow', '16.9 hours')).toBe('correct')
    expect(verdict(reach, 'follow', (1000 / 180 / (Math.log(1.5) / 4)).toFixed(1))).toBe('exp_growth_no_log')
    expect(verdict(reach, 'follow', (Math.log(820) / (Math.log(1.5) / 4)).toFixed(1))).toBe('exp_growth_log_diff')
  })
})

describe('features of a graph', () => {
  it('f(x) = −2·3^(x − 1) + 4: (−∞, ∞), y < 4, y = 4, (0, 10/3), decreasing', () => {
    const a = features(curve('exponential', -2, '3', 1, 4))
    expect(a.f).toBe('-2 * 3^(x - 1) + 4')
    expect(verdict(a, 'domain', 'all real numbers')).toBe('correct')
    expect(verdict(a, 'domain', '(-inf, inf)')).toBe('correct')
    expect(verdict(a, 'range', '(-inf, 4)')).toBe('correct')
    expect(verdict(a, 'range', 'y < 4')).toBe('correct')
    expect(verdict(a, 'range', '(4, inf)')).toBe('exp_sign_of_a') // y > k when a < 0
    expect(verdict(a, 'range', 'y > 4')).toBe('exp_sign_of_a')
    expect(verdict(a, 'range', '(-inf, 4]')).toBe('exp_endpoint_closed')
    expect(verdict(a, 'asymptote', 'y = 4')).toBe('correct')
    expect(verdict(a, 'asymptote', 'y = 0')).toBe('exp_asymptote_unshifted') // kept after the shift
    expect(verdict(a, 'asymptote', 'x = 4')).toBe('exp_asymptote_axis')
    expect(-2 * 3 ** -1 + 4).toBeCloseTo(10 / 3, 12)
    expect(verdict(a, 'intercept', '(0, 10/3)')).toBe('correct')
    expect(verdict(a, 'intercept', '(0, 3.333)')).toBe('invalid') // a rounded decimal is not exact
    expect(verdict(a, 'intercept', '(0, 2)')).toBe('exp_intercept_shift') // b^0 = 1 at x = 0
    expect(verdict(a, 'intercept', '(0, -2)')).toBe('exp_shift_sign') // −2·3^1 + 4
    expect(verdict(a, 'behavior', 'decreasing')).toBe('correct')
    expect(verdict(a, 'behavior', 'increasing')).toBe('exp_sign_of_a')
  })

  it('g(x) = log_2(x + 3) − 1: x > −3, all reals, x = −3, (−1, 0), increasing', () => {
    const a = features(curve('logarithmic', 1, '2', -3, -1))
    expect(a.f).toBe('log_2(x + 3) - 1')
    expect(verdict(a, 'domain', '(-3, inf)')).toBe('correct')
    expect(verdict(a, 'domain', 'x > -3')).toBe('correct')
    expect(verdict(a, 'domain', 'x >= -3')).toBe('exp_endpoint_closed') // a log's domain with ≥
    expect(verdict(a, 'domain', '[-3, inf)')).toBe('exp_endpoint_closed')
    expect(verdict(a, 'domain', '(3, inf)')).toBe('exp_shift_sign')
    expect(verdict(a, 'range', '(-inf, inf)')).toBe('correct')
    expect(verdict(a, 'asymptote', 'x = -3')).toBe('correct')
    expect(verdict(a, 'asymptote', 'x = 3')).toBe('exp_shift_sign') // log(x + 3) has x = −3
    expect(verdict(a, 'asymptote', 'x = 0')).toBe('exp_asymptote_unshifted')
    expect(verdict(a, 'intercept', '(-1, 0)')).toBe('correct')
    expect(verdict(a, 'intercept', '(-2, 0)')).toBe('exp_intercept_shift')
    expect(verdict(a, 'behavior', 'increasing')).toBe('correct')
  })

  it('f(x) = e^(x − 1) + 2 crosses the y-axis at (0, e^(−1) + 2), written any exact way', () => {
    const a = features(curve('exponential', 1, 'e', 1, 2))
    for (const typed of ['(0, e^(-1) + 2)', '(0, 1/e + 2)', '(0, 2 + e^(-1))']) expect(verdict(a, 'intercept', typed), typed).toBe('correct')
    expect(verdict(a, 'intercept', '(0, 2.368)')).toBe('invalid')
    expect(verdict(a, 'intercept', '(0, 3)')).toBe('exp_intercept_shift')
  })

  it('g(x) = ln(x − 2) − 1 crosses the x-axis at (e + 2, 0)', () => {
    const a = features(curve('logarithmic', 1, 'e', 2, -1))
    expect(a.f).toBe('ln(x - 2) - 1')
    for (const typed of ['(e + 2, 0)', '(2 + e, 0)']) expect(verdict(a, 'intercept', typed), typed).toBe('correct')
    expect(verdict(a, 'intercept', '(4.718, 0)')).toBe('invalid')
    // ln(x − 2) = 0 and x − 2 = 1 both give (3, 0) here: one answer, one name (the earlier slip keeps it).
    expect(verdict(a, 'intercept', '(3, 0)')).toBe('exp_intercept_shift')
    expect(verdict(a, 'asymptote', 'x = 2')).toBe('correct')
    // With − 2 the two slips part: (3, 0) leaves out the shift, (4, 0) erases the log.
    const b = features(curve('logarithmic', 1, 'e', 2, -2))
    expect(verdict(b, 'intercept', '(e^2 + 2, 0)')).toBe('correct')
    expect(verdict(b, 'intercept', '(3, 0)')).toBe('exp_intercept_shift')
    expect(verdict(b, 'intercept', '(4, 0)')).toBe('log_convert_dropped')
  })

  it('every way a book writes all real numbers is right, and a point on the wrong axis gets a plain note', () => {
    const a = features(curve('exponential', 1, '2', 0, 1))
    for (const typed of ['(-inf, inf)', '(−∞, ∞)', 'all real numbers', 'R', 'ℝ', 'x ∈ ℝ', '{x | x ∈ ℝ}', '(-infinity, infinity)']) expect(verdict(a, 'domain', typed), typed).toBe('correct')
    const g = gradeEgPart(a, 'domain', 'x is real')
    expect(g.verdict).toBe('invalid')
    // g(x) = log_2(x + 1) crosses at the origin: the note follows the part asked, not the coordinates of the answer.
    const origin = features(curve('logarithmic', 1, '2', -1, 0))
    expect(verdict(origin, 'intercept', '(0, 0)')).toBe('correct')
    const note = gradeEgPart(origin, 'intercept', '(0, 5)')
    expect(note.verdict === 'wrong' && note.message).toMatch(/x-intercept is where the graph crosses the x-axis/)
  })

  it('f(x) = (1/2)^x + 3 falls toward y = 3', () => {
    const a = features(curve('exponential', 1, '1/2', 0, 3))
    expect(a.f).toBe('(1/2)^x + 3')
    expect(verdict(a, 'range', 'y > 3')).toBe('correct')
    expect(verdict(a, 'intercept', '(0, 4)')).toBe('correct')
    expect(verdict(a, 'behavior', 'decreasing')).toBe('correct')
    expect(verdict(a, 'behavior', 'increasing')).toBe('exp_base_direction')
  })
})

describe('inverses, by composition', () => {
  it('the inverse of 2^(x − 1) + 3 is log_2(x − 3) + 1, in any equal form', () => {
    const a = inverse(curve('exponential', 1, '2', 1, 3))
    expect(a.stages[0]!.answerText).toBe('log_2(x - 3) + 1')
    for (const typed of ['log_2(x - 3) + 1', 'y = log_2(x-3)+1', 'f^-1(x) = log_2(x - 3) + 1', 'ln(x - 3)/ln(2) + 1', 'log(x - 3)/log(2) + 1', '1 + logBASE(x - 3, 2)']) {
      expect(verdict(a, 'inverse', typed), typed).toBe('correct')
    }
    expect(verdict(a, 'inverse', 'log_2(x - 1) + 3')).toBe('exp_inverse_shift')
    expect(verdict(a, 'inverse', 'log_(x - 3)(2) + 1')).toBe('exp_inverse_base_swapped')
    expect(verdict(a, 'inverse', '1/(2^(x - 1) + 3)')).toBe('exp_inverse_reciprocal')
    expect(verdict(a, 'inverse', 'x = 2^(y - 1) + 3')).toBe('invalid') // swapped but not solved
    expect(verdict(a, 'inverse', 'log_2(y - 3) + 1')).toBe('invalid')
    expect(verdict(a, 'inverse', 'log_2(x + 3) + 1')).toBe('wrong')
  })

  it('and back: the inverse of log_2(x − 3) + 1 is 2^(x − 1) + 3', () => {
    const a = inverse(curve('logarithmic', 1, '2', 3, 1))
    expect(a.stages[0]!.answerText).toBe('2^(x - 1) + 3')
    expect(verdict(a, 'inverse', '2^(x-1) + 3')).toBe('correct')
    expect(verdict(a, 'inverse', '0.5 * 2^x + 3')).toBe('correct')
    expect(verdict(a, 'inverse', '(x - 1)^2 + 3')).toBe('exp_inverse_base_swapped')
    expect(verdict(a, 'inverse', '2^(x - 3) + 1')).toBe('exp_inverse_shift')
  })

  it('the inverse of e^(x + 2) − 5 is ln(x + 5) − 2', () => {
    const a = inverse(curve('exponential', 1, 'e', -2, -5))
    expect(a.stages[0]!.answerText).toBe('ln(x + 5) - 2')
    expect(verdict(a, 'inverse', 'ln(x + 5) - 2')).toBe('correct')
    expect(verdict(a, 'inverse', 'log(x + 5)/log(e) - 2')).toBe('correct')
  })

  it('the inverse of 2·3^(x − 1) + 4 is log_3((x − 4)/2) + 1, also log_3(x − 4) − log_3(2) + 1', () => {
    const a = inverse(curve('exponential', 2, '3', 1, 4))
    expect(a.stages[0]!.answerText).toBe('log_3((x - 4)/2) + 1')
    expect(verdict(a, 'inverse', 'log_3(x - 4) - log_3(2) + 1')).toBe('correct')
    expect(verdict(a, 'inverse', 'log_3(x - 4) + 1')).toBe('wrong')
  })
})
