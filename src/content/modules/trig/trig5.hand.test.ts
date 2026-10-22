/**
 * Unit 5's hand-worked textbook problems (Larson 4.5 to 4.8), through the builders the templates use: each answer
 * worked out by hand in the test's name, checked as she would type it (and in the other ways a textbook writes it),
 * each slip named by its id, and a plain wrong answer only wrong. Includes the brief's own: y = 3 sin(2x − π/2) + 1,
 * y = tan(x/2), arccos(−1/2), arcsin(sin(5π/6)), cos(arctan(3/4)), tan(arcsin(−5/13)) and the Ferris wheel
 * h(t) = 30 − 25cos(πt/2).
 */
import { describe, expect, it } from 'vitest'
import type { TrigPart } from '@/content/types'
import { q, type TrigExact, type Wave } from '@/engine/trig'
import { algebraicProblem, cancelProblem, evaluateProblem, identityProblem, triangleProblem } from '../inverseTrig'
import { matchProblem, matchSlips, ogFeaturesProblem } from '../otherTrigGraphs'
import { equationProblem, featuresProblem, modelProblem } from '../sinusoids'
import { gradeTrigPart } from './parts'
import { plain } from './text'

/** c·π^pi as an exact number: ex(1, 4, 1) is π/4. */
const ex = (n: number, d = 1, pi: 0 | 1 = 0): TrigExact => ({ c: q(n, d), root: 1, pi })

function check(part: TrigPart | undefined, right: string[], slips: [string, string][] = [], wrong: string[] = []) {
  expect(part).toBeDefined()
  const p = part!
  expect(right, `${p.id}: the first spelling is the answer`).toContain(p.answerText)
  for (const t of right) {
    const g = gradeTrigPart(p, t)
    expect(g.verdict, `${p.id} “${t}”${g.verdict !== 'correct' ? ` — ${g.verdict === 'mistake' ? g.mistake : g.message}` : ''}`).toBe('correct')
  }
  for (const [t, id] of slips) {
    const g = gradeTrigPart(p, t)
    expect(g.verdict === 'mistake' ? g.mistake : g.verdict, `${p.id} “${t}”`).toBe(id)
  }
  for (const t of wrong) expect(gradeTrigPart(p, t).verdict, `${p.id} “${t}”`).toBe('wrong')
}

const stage = (d: { stages: TrigPart[] }, id: string) => d.stages.find((s) => s.id === id)
const words = (lines: string[]) => lines.map(plain).join(' ')

describe('hand-worked: graphs of sine and cosine (Larson 4.5)', () => {
  it('y = 3 sin(2x − π/2) + 1: amplitude 3, period 2π/2 = π, shift (π/2)/2 = π/4 right, midline y = 1, range [−2, 4]', () => {
    const wave: Wave = { fn: 'sin', A: q(3), B: ex(2), C: ex(1, 4, 1), D: q(1) }
    const d = featuresProblem({ wave, form: 'expanded', keyPoints: true })
    expect(plain(d.display!)).toBe('y = 3sin(2x − π/2) + 1')
    check(stage(d, 'amplitude'), ['3'], [['4', 'trig_amplitude_with_d']])
    check(stage(d, 'period'), ['π', 'pi', '1π'], [['2', 'trig_period_as_b'], ['4π', 'trig_period_times_b']])
    check(stage(d, 'shift'), ['π/4 right', 'π/4', 'right π/4', 'π/4 to the right', 'pi/4 R'], [['π/2 right', 'trig_shift_not_divided'], ['π/4 left', 'trig_shift_wrong_way']])
    check(stage(d, 'midline'), ['y = 1', 'y=1', '1'])
    check(stage(d, 'range'), ['[-2, 4]', '−2 ≤ y ≤ 4', '[−2,4]'], [['[-3, 3]', 'trig_range_ignores_d']])
    // The cycle starts at the shift, a quarter period (π/4) apart: midline, highest, midline, lowest, midline.
    check(stage(d, 'keypoints'), ['(π/4, 1), (π/2, 4), (3π/4, 1), (π, -2), (5π/4, 1)', '(5π/4, 1), (π, -2), (3π/4, 1), (π/2, 4), (π/4, 1)'])
  })

  it('y = −2 sin(x/3 − 5π/6): amplitude |−2| = 2, period 2π ÷ 1/3 = 6π, shift (5π/6) ÷ (1/3) = 5π/2 right', () => {
    const wave: Wave = { fn: 'sin', A: q(-2), B: ex(1, 3), C: ex(5, 2, 1), D: q(0) }
    const d = featuresProblem({ wave, form: 'expanded', keyPoints: false })
    expect(plain(d.display!)).toBe('y = −2sin(x/3 − 5π/6)')
    check(stage(d, 'amplitude'), ['2'], [['-2', 'trig_amplitude_negative']])
    check(stage(d, 'period'), ['6π'], [['2π/3', 'trig_period_times_b']])
    check(stage(d, 'shift'), ['5π/2 right', '5π/2'], [['5π/6 right', 'trig_shift_not_divided'], ['5π/2 left', 'trig_shift_wrong_way']])
    check(stage(d, 'midline'), ['y = 0', '0'])
    check(stage(d, 'range'), ['[-2, 2]'])
  })

  it('y = −½ cos(3(x + π/4)) + 2: factored, so the shift is π/4 left (the textbook’s −π/4); period 2π/3; range [3/2, 5/2]', () => {
    const wave: Wave = { fn: 'cos', A: q(-1, 2), B: ex(3), C: ex(-1, 4, 1), D: q(2) }
    const d = featuresProblem({ wave, form: 'factored', keyPoints: false })
    check(stage(d, 'amplitude'), ['1/2', '0.5'], [['-1/2', 'trig_amplitude_negative']])
    check(stage(d, 'period'), ['2π/3', '(2/3)π', '2pi/3'], [['3', 'trig_period_as_b']])
    check(stage(d, 'shift'), ['π/4 left', '-π/4', '−π/4', 'left π/4', 'π/4 to the left'], [['π/4 right', 'trig_shift_wrong_way']])
    check(stage(d, 'midline'), ['y = 2'], [['y = 0', 'trig_midline_zero']])
    check(stage(d, 'range'), ['[3/2, 5/2]', '[1.5, 2.5]'], [['[-1/2, 1/2]', 'trig_range_ignores_d']])
  })

  it('a graph with a highest point (π/4, 3/2) and the next lowest (3π/4, 1/2): A = ½, D = 1, period 2 · π/2 = π, y = ½cos(2(x − π/4)) + 1', () => {
    const d = equationProblem({ mode: 'graph', A: [1, 2], B: ex(2), D: 1, high: ex(1, 4, 1), first: 'high', periods: 1 })
    expect(d.figure.kind).toBe('graph')
    expect(d.figure.graph!.markers!.map((mk) => mk.label)).toEqual(['(π/4, 3/2)', '(3π/4, 1/2)'])
    // Every equivalent equation is right: the cosine from the highest point, the sine, the cosine from the lowest point.
    check(
      stage(d, 'equation'),
      ['y = (1/2)cos(2(x - π/4)) + 1', 'y = 0.5sin(2x) + 1', 'y = -(1/2)cos(2(x - 3π/4)) + 1', 'y = 1 + cos(2x - π/2)/2', 'y = (1/2)sin(2(x - π)) + 1'],
      [
        ['y = cos(2(x - π/4)) + 1', 'trig_amplitude_as_span'],
        ['y = (1/2)cos(4(x - π/4)) + 1', 'trig_period_half'],
        ['y = (1/2)cos(2(x - π/4)) + 3/2', 'trig_midline_at_extreme'],
        ['y = -(1/2)cos(2(x - π/4)) + 1', 'trig_reflection_missed'],
      ],
      ['y = 3cos(x) + 7'],
    )
  })

  it('a cosine curve with amplitude 4 and period 2: B = 2π/2 = π, y = 4cos(πx) (B is not the period: 4cos(2x) is)', () => {
    const d = equationProblem({ mode: 'words', fn: 'cos', A: 4, B: ex(1, 1, 1), shift: ex(0), D: 0 })
    expect(plain(d.prompt)).toBe('Write an equation of a cosine curve with amplitude 4 and period 2.')
    check(stage(d, 'equation'), ['y = 4cos(πx)', 'y = 4sin(πx + π/2)', 'y = -4cos(π(x - 1))', 'y=4cos(pi x)'], [['y = 4cos(2x)', 'trig_b_as_period']])
  })

  it('a sine curve with amplitude 4 and period π/2, shifted π/8 left and 2 down: y = 4sin(4(x + π/8)) − 2 (4x + π/8 shifts only π/32)', () => {
    const d = equationProblem({ mode: 'words', fn: 'sin', A: 4, B: ex(4), shift: ex(-1, 8, 1), D: -2 })
    check(stage(d, 'equation'), ['y = 4sin(4(x + π/8)) - 2', 'y = 4sin(4x + π/2) - 2', 'y = 4cos(4x) - 2'], [['y = 4sin(4x + π/8) - 2', 'trig_shift_not_divided'], ['y = 4sin(4(x - π/8)) - 2', 'trig_shift_wrong_way']])
  })
})

describe('hand-worked: sinusoidal models (Larson 4.5, Sullivan 6.6)', () => {
  it('a Ferris wheel 50 feet across, its center 30 feet up, a turn every 4 minutes, boarding at the bottom: h(t) = 30 − 25cos(πt/2); h(1.5) ≈ 47.7; first 40 feet at t ≈ 1.26', () => {
    const d = modelProblem({ story: 'wheel', wheel: { diameter: 50, center: 30, platform: null, period: 4, seconds: false, start: 'bottom', feet: true }, at: q(3, 2), target: q(40) })
    check(stage(d, 'model'), ['h(t) = 30 - 25cos(πt/2)', 'h(t) = 30 - 25cos((π/2)t)', 'h(t) = 30 + 25sin(πt/2 - π/2)', 'h(t) = -25cos(pi t/2) + 30'], [
      ['h(t) = 30 - 50cos(πt/2)', 'trig_amplitude_as_diameter'],
      ['h(t) = 30 + 25cos(πt/2)', 'trig_model_start_point'],
    ])
    // h(1.5) = 30 − 25cos(3π/4) = 30 + 25 · √2/2 ≈ 47.68; DEGREE mode reads cos(3π/4) as the cosine of 2.36°.
    check(stage(d, 'value'), ['47.7', '47.68', '47.7 feet', '47.7 ft'], [['5.0', 'trig_degree_mode']])
    // 30 − 25cos(πt/2) = 40: cos(πt/2) = −0.4, πt/2 ≈ 1.9823, t ≈ 1.2620.
    check(stage(d, 'time'), ['1.26', '1.262', '1.26 minutes'])
  })

  it('a tide 10.6 feet deep 2.5 hours after midnight, 7 feet at the next low 6.2 hours later: d(t) = 8.8 + 1.8cos((5π/31)(t − 2.5)); d(9.8) ≈ 7.3', () => {
    const d = modelProblem({ story: 'tide', tide: { high: q(53, 5), low: q(7), at: q(5, 2), half: q(31, 5) }, at: q(49, 5), target: q(10) })
    expect(plain(d.prompt)).toContain('deepest, 10.6 feet, 2.5 hours after midnight')
    check(stage(d, 'model'), ['d(t) = 8.8 + 1.8cos((5π/31)(t - 2.5))', 'd(t) = 8.8 + 1.8cos(2π(t - 2.5)/12.4)', 'd(t) = 8.8 + 1.8cos(π(t - 2.5)/6.2)'], [['d(t) = 8.8 + 3.6cos((5π/31)(t - 2.5))', 'trig_amplitude_as_span']])
    check(stage(d, 'value'), ['7.3', '7.30'])
    // 8.8 + 1.8cos((5π/31)(t − 2.5)) = 10: cos(…) = 2/3, so t = 2.5 − (31/5π)·arccos(2/3) ≈ 0.84.
    check(stage(d, 'time'), ['0.84', '0.843'])
  })

  it('average highs of 89°F in July and 37°F in January: T(t) = 63 + 26cos(π(t − 7)/6); T(5) = 63 + 26 · ½ = 76', () => {
    const d = modelProblem({ story: 'temperature', temperature: { high: 89, low: 37 }, at: q(5), target: q(70) })
    check(stage(d, 'model'), ['T(t) = 63 + 26cos(π(t - 7)/6)', 'T(t) = 63 - 26cos(πt/6 - π/6)', 'T(t) = 63 + 26cos((π/6)(t - 7))'], [['T(t) = 26cos(π(t - 7)/6)', 'trig_midline_zero']])
    check(stage(d, 'value'), ['76.0', '76'])
    // 63 + 26cos(π(t − 7)/6) = 70: t = 7 − (6/π)·arccos(7/26) ≈ 4.5.
    check(stage(d, 'time'), ['4.5', '4.52'])
  })
})

describe('hand-worked: graphs of the other trig functions (Larson 4.6)', () => {
  it('y = tan(x/2): period π ÷ ½ = 2π, asymptotes where x/2 = π/2 + kπ, x = π + 2kπ, zeros x = 2kπ', () => {
    const wave: Wave = { fn: 'tan', A: q(1), B: ex(1, 2), C: ex(0), D: q(0) }
    const d = ogFeaturesProblem({ wave, form: 'expanded', list: null })
    expect(plain(d.display!)).toBe('y = tan(x/2)')
    check(stage(d, 'period'), ['2π', '2pi'], [['π/2', 'trig_period_times_b'], ['4π', 'trig_period_base_mixed']])
    check(stage(d, 'asymptotes'), ['x = π + 2kπ', 'x = -π + 2kπ', 'x = (2k + 1)π', 'x = π + 2nπ, n ∈ ℤ', 'x = 3π - 2kπ'], [['x = 2kπ', 'trig_asymptotes_zeros_swapped']], ['x = π/2 + kπ'])
    check(stage(d, 'zeros'), ['x = 2kπ', 'x = 2πk', 'x = 2nπ'], [['x = π + 2kπ', 'trig_asymptotes_zeros_swapped']])
  })

  it('y = sec(2x) − 3 between −π/2 and π/2: period π, asymptotes where cos 2x = 0, x = ±π/4, range (−∞, −4] ∪ [−2, ∞)', () => {
    const wave: Wave = { fn: 'sec', A: q(1), B: ex(2), C: ex(0), D: q(-3) }
    const d = ogFeaturesProblem({ wave, form: 'expanded', list: { from: -Math.PI / 2 } })
    expect(plain(d.prompt)).toContain('between x = −π/2 and x = π/2')
    check(stage(d, 'period'), ['π'], [['2', 'trig_period_as_b'], ['π/2', 'trig_period_base_mixed']])
    check(stage(d, 'asymptotes'), ['x = -π/4, x = π/4', 'x = π/4, x = -π/4', 'π/4 and -π/4'], [['x = 0', 'trig_sec_asymptotes_at_sin_zeros']])
    check(stage(d, 'range'), ['(-∞, -4] ∪ [-2, ∞)', 'y ≤ -4 or y ≥ -2'], [['[-4, -2]', 'trig_sec_range_as_sinusoid'], ['(-∞, -1] ∪ [1, ∞)', 'trig_range_ignores_d']])
  })

  it('y = cot(x/2 − π/6): period π ÷ ½ = 2π, asymptotes where x/2 − π/6 = kπ, x = π/3 + 2kπ, zeros x = 4π/3 + 2kπ', () => {
    const wave: Wave = { fn: 'cot', A: q(1), B: ex(1, 2), C: ex(1, 3, 1), D: q(0) }
    const d = ogFeaturesProblem({ wave, form: 'expanded', list: null })
    check(stage(d, 'period'), ['2π'])
    check(stage(d, 'asymptotes'), ['x = π/3 + 2kπ', 'x = 7π/3 + 2kπ', 'x = -5π/3 + 2kπ'], [['x = 4π/3 + 2kπ', 'trig_asymptotes_zeros_swapped']])
    check(stage(d, 'zeros'), ['x = 4π/3 + 2kπ', 'x = -2π/3 + 2kπ'])
  })

  it('y = 2csc(x − π/4): period 2π, asymptotes where sin(x − π/4) = 0, x = π/4 + kπ (not where cos is zero), range (−∞, −2] ∪ [2, ∞)', () => {
    const wave: Wave = { fn: 'csc', A: q(2), B: ex(1), C: ex(1, 4, 1), D: q(0) }
    const d = ogFeaturesProblem({ wave, form: 'factored', list: null })
    check(stage(d, 'period'), ['2π'], [['π', 'trig_period_base_mixed']])
    check(stage(d, 'asymptotes'), ['x = π/4 + kπ', 'x = 5π/4 + kπ', 'x = -3π/4 + kπ'])
  })

  it('which graph is y = −tan(x − π/4)? the one falling through (π/4, 0); the others flip it, shift it the other way, or are −cot', () => {
    const wave: Wave = { fn: 'tan', A: q(-1), B: ex(1), C: ex(1, 4, 1), D: q(0) }
    const slips = matchSlips(wave).map((s) => s.slip!.id)
    expect(slips).toEqual(['trig_reflection_missed', 'trig_shift_wrong_way', 'trig_cofunction_graph'])
    // Places A to D show candidates 2, 0, 3, 1: the shift the wrong way, the right graph, −cot, the flip.
    const d = matchProblem({ wave, form: 'factored', slips: [0, 1, 2], order: [2, 0, 3, 1] })
    expect(d.figure.graphs!.map((g) => g.letter)).toEqual(['A', 'B', 'C', 'D'])
    for (const g of d.figure.graphs!) expect(g.graph.ariaLabel).toBe(`Graph ${g.letter}`)
    const part = d.stages[0]!
    expect(part.answerText).toBe('B')
    check(part, ['B'], [['A', 'trig_shift_wrong_way'], ['C', 'trig_cofunction_graph'], ['D', 'trig_reflection_missed']])
    // The right card's curve is the equation's: it falls through (π/4, 0).
    const right = d.figure.graphs![1]!.graph
    const near = (right.runs ?? []).flat().filter((s) => Math.abs(s.x - Math.PI / 4) < 0.05)
    expect(near.length).toBeGreaterThan(0)
    for (const s of near) expect(Math.abs(s.y)).toBeLessThan(0.1)
  })
})

describe('hand-worked: inverse trig functions (Larson 4.7)', () => {
  it('arccos(−1/2) = 2π/3: the angle in [0, π] with cosine −1/2 (−π/3 is arcsin’s side of the circle)', () => {
    const d = evaluateProblem({ fn: 'acos', input: '-1/2', mode: 'exact', unit: 'rad', notation: 0 })
    expect(plain(d.display!)).toBe('arccos(−1/2)')
    check(d.stages[0], ['2π/3', '2pi/3', '2π/3 rad', '(2/3)π'], [['-π/3', 'trig_arccos_range_as_arcsin'], ['4π/3', 'trig_inverse_other_angle'], ['π/3', 'trig_inverse_sign_dropped']])
  })

  it('cos⁻¹(−1/2) in degrees is 120°', () => {
    const d = evaluateProblem({ fn: 'acos', input: '-1/2', mode: 'exact', unit: 'deg', notation: 0 })
    check(d.stages[0], ['120', '120°', '120 degrees'], [['-60', 'trig_arccos_range_as_arcsin']])
  })

  it('arcsin(−√3/2) = −π/3, not 5π/3 (coterminal, but outside [−π/2, π/2]) and not 4π/3', () => {
    const d = evaluateProblem({ fn: 'asin', input: '-√3/2', mode: 'exact', unit: 'rad', notation: 1 })
    check(d.stages[0], ['-π/3', '−π/3', '-pi/3'], [['5π/3', 'trig_inverse_not_principal'], ['4π/3', 'trig_inverse_other_angle'], ['π/3', 'trig_inverse_sign_dropped']])
  })

  it('arctan(√3) = π/3 (π/6 is the angle whose tangent is 1/√3)', () => {
    const d = evaluateProblem({ fn: 'atan', input: '√3', mode: 'exact', unit: 'rad', notation: 1 })
    check(d.stages[0], ['π/3'], [['π/6', 'trig_tan_inverted']])
  })

  it('arccos(3/2) has no value: no cosine is more than one. The button says so; a number is named', () => {
    const d = evaluateProblem({ fn: 'acos', input: '3/2', mode: 'exact', unit: 'rad', notation: 1 })
    const part = d.stages[0]!
    expect(part.noValue).toBe(true)
    check(part, ['no value', 'undefined', 'DNE'], [['π/3', 'trig_inverse_outside_domain'], ['0', 'trig_inverse_outside_domain']])
    expect(plain(d.prompt)).not.toMatch(/no value/i)
  })

  it('sin⁻¹(−0.8) ≈ −0.927 in RADIAN mode; −53.130 is the same angle in DEGREE mode', () => {
    const d = evaluateProblem({ fn: 'asin', input: '-0.8', mode: 'decimal', unit: 'rad', notation: 0 })
    check(d.stages[0], ['-0.927', '-0.9273', '−0.927 rad'], [['-53.130', 'trig_degree_mode']])
    expect(d.calc.ti84[0]!.title).toBe('Set the angle mode to RADIAN')
  })
})

describe('hand-worked: compositions (Larson 4.7)', () => {
  it('sin(arcsin 0.3) = 0.3 (0.3 is in [−1, 1]); sin(arcsin 2) has no value at all', () => {
    const inside = identityProblem({ fn: 'asin', input: '0.3', notation: 1 })
    check(inside.stages[0], ['0.3', '3/10'])
    const outside = identityProblem({ fn: 'asin', input: '2', notation: 1 })
    // Cancelling to 2 skips the check of the input: arcsin 2 is not there to start with.
    check(outside.stages[0], ['no value', 'undefined'], [['2', 'trig_inverse_outside_domain']])
  })

  it('arcsin(sin(5π/6)) = arcsin(1/2) = π/6, not 5π/6 (outside [−π/2, π/2])', () => {
    const d = cancelProblem({ fn: 'asin', theta: 150, notation: 0 })
    expect(plain(d.display!)).toBe('arcsin(sin(5π/6))')
    check(d.stages[0], ['π/6', 'pi/6', 'π/6 rad'], [['5π/6', 'trig_inverse_cancel_outside']])
    expect(words(d.stages[0]!.reveal)).toContain('The angle 5π/6 is not on')
  })

  it('cos(arctan(3/4)): θ in Quadrant I with y = 3, x = 4, so r = 5 and cos θ = 4/5 (3/5 is sin θ)', () => {
    const d = triangleProblem({ fn: 'atan', value: q(3, 4), outer: 'cos', notation: 1 })
    check(stage(d, 'quadrant'), ['Q1'])
    check(stage(d, 'r'), ['5', 'r = 5'], [['25', 'trig_r_not_rooted'], ['-5', 'trig_r_negative']], ['7'])
    check(stage(d, 'cos'), ['4/5', '0.8'], [['3/5', 'trig_sin_cos_swapped']])
    // The figure labels x and y; r only once she has found it.
    expect(d.figure.legs!.r!.after).toBe('r')
  })

  it('tan(arcsin(−5/13)): θ in Quadrant IV with y = −5, r = 13, so x = 12 and tan θ = −5/12 (−12/5 is cot θ)', () => {
    const d = triangleProblem({ fn: 'asin', value: q(-5, 13), outer: 'tan', notation: 1 })
    check(stage(d, 'quadrant'), ['Q4'], [['Q3', 'trig_inverse_other_angle'], ['Q1', 'trig_inverse_sign_dropped']])
    check(stage(d, 'x'), ['12', 'x = 12'], [['-12', 'trig_coordinate_sign']])
    check(stage(d, 'tan'), ['-5/12', '−5/12'], [['-12/5', 'trig_tan_inverted'], ['5/12', 'trig_sign_quadrant']])
    expect(d.figure.legs!.x!.after).toBe('x')
  })

  it('cos(arcsin x) = √(1 − x²): opposite x, hypotenuse 1, adjacent √(1 − x²), positive in Quadrants I and IV', () => {
    const d = algebraicProblem({ shape: 0, c: 1, scale: 'div', notation: 1 })
    check(stage(d, 'expression'), ['√(1 - x^2)', 'sqrt(1-x^2)', '√(1 − x²)', '(1 - x^2)^(1/2)'], [
      ['-√(1 - x^2)', 'trig_sign_quadrant'],
      ['√(1 + x^2)', 'trig_pythag_added'],
      ['x', 'trig_sin_cos_swapped'],
    ])
    expect(gradeTrigPart(stage(d, 'expression')!, 'cos(asin(x))').verdict).toBe('invalid')
  })

  it('tan(arcsin(x/3)) = x/√(9 − x²): opposite x, hypotenuse 3', () => {
    const d = algebraicProblem({ shape: 2, c: 3, scale: 'div', notation: 1 })
    check(stage(d, 'expression'), ['x/√(9 - x^2)', 'x√(9 - x^2)/(9 - x^2)', '(x/3)/√(1 - x^2/9)'])
  })
})
