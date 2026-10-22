/**
 * The graphs of the six functions (Unit 5): amplitude, period, phase shift, range, key points, asymptotes and zeros
 * against a table written out by hand, and against Math (the key points are where the curve is, the asymptotes where
 * it blows up, the zeros where it is zero); the equation as she would type it reads back to the same function; the
 * slips of each feature by hand.
 */
import { describe, expect, it } from 'vitest'
import { exactNum, exactText, tx, type TrigExact } from './exact'
import { evalExprNum, readFunctionAnswer } from './expr'
import { q, type Q } from './rational'
import {
  amplitudeSlips,
  asymptoteSlips,
  familyText,
  keyPointSlips,
  midlineSlips,
  periodSlips,
  pointsText,
  rangeSlips,
  shiftSlips,
  waveAmplitude,
  waveAsymptotes,
  wavePeriod,
  waveRangeText,
  waveKeyPoints,
  waveTex,
  waveText,
  waveValue,
  waveZeros,
  zeroSlips,
  type Wave,
  type WaveFn,
  type WaveForm,
} from './wave'

const r = (n: number, d = 1): Q => q(n, d)
const pi = (n: number, d = 1): TrigExact => tx(q(n, d), 1, 1)
const num = (n: number, d = 1): TrigExact => tx(q(n, d))
const W = (fn: WaveFn, A: Q, B: TrigExact, C: TrigExact, D: Q): Wave => ({ fn, A, B, C, D })

describe('y = 3 sin(2x − π/2) + 1 (the brief’s example)', () => {
  const w = W('sin', r(3), num(2), pi(1, 4), r(1))
  it('amplitude 3, period π, phase shift π/4 to the right, range [−2, 4]', () => {
    expect(exactText(waveAmplitude(w))).toBe('3')
    expect(exactText(wavePeriod(w))).toBe('π')
    expect(exactText(w.C)).toBe('π/4')
    expect(waveRangeText(w)).toBe('[-2, 4]')
  })
  it('is written both ways, and each reads back to the same function', () => {
    expect(waveText(w, 'expanded')).toBe('y = 3sin(2x - π/2) + 1')
    expect(waveText(w, 'factored')).toBe('y = 3sin(2(x - π/4)) + 1')
    expect(waveTex(w, 'expanded')).toBe('y = 3\\sin\\left(2x - \\frac{\\pi}{2}\\right) + 1')
    for (const form of ['expanded', 'factored'] as WaveForm[]) {
      const read = readFunctionAnswer(waveText(w, form), { variable: 'x', allowBare: false })
      if (!read.ok) throw new Error(read.message)
      for (const x of [-1.3, 0.2, 0.9, 2.4]) expect(evalExprNum(read.node, { x })).toBeCloseTo(3 * Math.sin(2 * x - Math.PI / 2) + 1, 12)
    }
  })
  it('the key points from the phase shift: (π/4, 1), (π/2, 4), (3π/4, 1), (π, −2), (5π/4, 1)', () => {
    expect(pointsText(waveKeyPoints(w))).toBe('(π/4, 1), (π/2, 4), (3π/4, 1), (π, -2), (5π/4, 1)')
  })
  it('the slips, by hand', () => {
    expect(amplitudeSlips(w).map((s) => [s.id, exactText(s.value)])).toEqual([
      ['trig_amplitude_with_d', '4'],
      ['trig_amplitude_as_span', '6'],
    ])
    expect(periodSlips(w).map((s) => [s.id, exactText(s.value)])).toEqual([
      ['trig_period_as_b', '2'],
      ['trig_period_times_b', '4π'],
      ['trig_period_base_mixed', 'π/2'],
    ])
    expect(shiftSlips(w, 'expanded').map((s) => [s.id, exactText(s.value)])).toEqual([
      ['trig_shift_not_divided', 'π/2'],
      ['trig_shift_wrong_way', '-π/4'],
    ])
    expect(shiftSlips(w, 'factored').map((s) => s.id)).toEqual(['trig_shift_wrong_way'])
    expect(midlineSlips(w).map((s) => exactText(s.value))).toEqual(['0'])
    expect(rangeSlips(w).map((s) => [s.id, s.text])).toEqual([['trig_range_ignores_d', '[-3, 3]']])
    expect(keyPointSlips(w, 'expanded').map((s) => [s.id, pointsText(s.points)])).toEqual([
      ['trig_shift_not_divided', '(π/2, 1), (3π/4, 4), (π, 1), (5π/4, -2), (3π/2, 1)'],
      ['trig_shift_wrong_way', '(-π/4, 1), (0, 4), (π/4, 1), (π/2, -2), (3π/4, 1)'],
    ])
  })
})

describe('y = tan(x/2) (the brief’s example)', () => {
  const w = W('tan', r(1), num(1, 2), num(0), r(0))
  it('period 2π, asymptotes x = π + 2kπ, zeros x = 2kπ', () => {
    expect(exactText(wavePeriod(w))).toBe('2π')
    expect(familyText(waveAsymptotes(w)!)).toBe('x = π + 2kπ')
    expect(familyText(waveZeros(w)!)).toBe('x = 2kπ')
  })
  it('the asymptote slips: the zeros instead (the shift slips need a shift)', () => {
    expect(asymptoteSlips(w, 'expanded').map((s) => [s.id, familyText(s.family)])).toEqual([['trig_asymptotes_zeros_swapped', 'x = 2kπ']])
    expect(zeroSlips(w, 'expanded').map((s) => [s.id, familyText(s.family)])).toEqual([['trig_asymptotes_zeros_swapped', 'x = π + 2kπ']])
    expect(periodSlips(w).map((s) => [s.id, exactText(s.value)])).toEqual([
      ['trig_period_as_b', '1/2'],
      ['trig_period_times_b', 'π/2'],
      ['trig_period_base_mixed', '4π'],
    ])
  })
})

/** fn, A, B, C (the shift), D; period, asymptote family, range: by hand. */
const TABLE: { w: Wave; period: string; asym: string | null; range: string; zeros?: string }[] = [
  { w: W('sec', r(2), num(1), num(0), r(1)), period: '2π', asym: 'x = π/2 + kπ', range: '(-∞, -1] ∪ [3, ∞)' },
  { w: W('csc', r(-1), num(2), pi(1, 4), r(0)), period: 'π', asym: 'x = π/4 + kπ/2', range: '(-∞, -1] ∪ [1, ∞)' },
  { w: W('tan', r(1), num(2), num(0), r(0)), period: 'π/2', asym: 'x = π/4 + kπ/2', range: '(-∞, ∞)', zeros: 'x = kπ/2' },
  { w: W('tan', r(3), num(3), pi(1, 6), r(0)), period: 'π/3', asym: 'x = kπ/3', range: '(-∞, ∞)', zeros: 'x = π/6 + kπ/3' },
  { w: W('cot', r(2), num(1, 3), num(0), r(-1)), period: '3π', asym: 'x = 3kπ', range: '(-∞, ∞)' },
  { w: W('cot', r(1), num(1), pi(1, 3), r(0)), period: 'π', asym: 'x = π/3 + kπ', range: '(-∞, ∞)', zeros: 'x = 5π/6 + kπ' },
  { w: W('sec', r(1, 2), pi(1, 2), num(1), r(2)), period: '4', asym: 'x = 2k', range: '(-∞, 3/2] ∪ [5/2, ∞)' },
  { w: W('tan', r(1), pi(1), num(1, 2), r(0)), period: '1', asym: 'x = k', range: '(-∞, ∞)', zeros: 'x = 1/2 + k' },
  { w: W('cos', r(-2), num(4), num(0), r(3)), period: 'π/2', asym: null, range: '[1, 5]' },
  { w: W('sin', r(1, 2), pi(1, 3), num(-1), r(-2)), period: '6', asym: null, range: '[-5/2, -3/2]' },
]

describe('the hand table, against Math', () => {
  it.each(TABLE.map((row) => [waveText(row.w, 'factored'), row] as const))('%s', (_label, row) => {
    const { w } = row
    expect(exactText(wavePeriod(w))).toBe(row.period)
    const asym = waveAsymptotes(w)
    expect(asym ? familyText(asym) : null).toBe(row.asym)
    expect(waveRangeText(w)).toBe(row.range)
    const z = waveZeros(w)
    expect(z ? familyText(z) : undefined).toBe(row.zeros)
    const P = exactNum(wavePeriod(w))
    // The period: the same height one period on, at many points.
    for (const x of [-2.1, -0.37, 0.11, 0.93, 1.7]) {
      const a = waveValue(w, x)
      const b = waveValue(w, x + P)
      if (Number.isFinite(a) && Math.abs(a) < 1e6) expect(b).toBeCloseTo(a, 6)
    }
    // Asymptotes: the curve blows up beside each one; zeros: it is zero there.
    if (asym) {
      for (let k = -2; k <= 2; k++) {
        const x = exactNum(asym.base) + k * exactNum(asym.step)
        expect(Math.abs(waveValue(w, x + 1e-7))).toBeGreaterThan(1e4)
      }
    }
    if (z) for (let k = -2; k <= 2; k++) expect(waveValue(w, exactNum(z.base) + k * exactNum(z.step))).toBeCloseTo(0, 9)
  })

  it('the key points are on the curve, a quarter period apart, from the shift', () => {
    for (const w of [W('sin', r(3), num(2), pi(1, 4), r(1)), W('cos', r(-2), num(1, 2), pi(-1, 3), r(-1)), W('sin', r(1, 2), pi(1, 2), num(1), r(0))]) {
      const pts = waveKeyPoints(w)
      expect(exactNum(pts[0]!.x)).toBeCloseTo(exactNum(w.C), 12)
      for (const [i, p] of pts.entries()) {
        expect(waveValue(w, exactNum(p.x))).toBeCloseTo(p.y.n / p.y.d, 9)
        if (i) expect(exactNum(p.x) - exactNum(pts[i - 1]!.x)).toBeCloseTo(exactNum(wavePeriod(w)) / 4, 12)
      }
    }
  })
})

describe('slips by hand for the other functions', () => {
  it('y = 2 sec(3x − π) + 1: a shift of a whole asymptote step leaves only sec’s at sin’s zeros; the band; the sinusoid range', () => {
    const w = W('sec', r(2), num(3), pi(1, 3), r(1))
    // 3x − π = π/2 + kπ gives x = π/2 + kπ/3, the same set as π/6 + kπ/3. The undivided shift (π) and the shift the
    // wrong way (−π/3) are whole steps of π/3 away, so they give the same set and are left out.
    expect(familyText(waveAsymptotes(w)!)).toBe('x = π/6 + kπ/3')
    expect(asymptoteSlips(w, 'expanded').map((s) => [s.id, familyText(s.family)])).toEqual([['trig_sec_asymptotes_at_sin_zeros', 'x = kπ/3']])
    expect(rangeSlips(w).map((s) => [s.id, s.text])).toEqual([
      ['trig_range_ignores_d', '(-∞, -2] ∪ [2, ∞)'],
      ['trig_sec_range_as_sinusoid', '[-1, 3]'],
    ])
  })

  it('y = tan(2x − π/3): the zeros and the undivided shift; the wrong way lands on the same set as the undivided shift', () => {
    const w = W('tan', r(1), num(2), pi(1, 6), r(0))
    // 2x − π/3 = π/2 + kπ: x = 5π/12 + kπ/2. Undivided (shift π/3): 7π/12 + kπ/2 = π/12 + kπ/2. The wrong way (shift
    // −π/6): −π/6 + π/4 = π/12, the same set, so the earlier slip names it.
    expect(familyText(waveAsymptotes(w)!)).toBe('x = 5π/12 + kπ/2')
    expect(asymptoteSlips(w, 'expanded').map((s) => [s.id, familyText(s.family)])).toEqual([
      ['trig_asymptotes_zeros_swapped', 'x = π/6 + kπ/2'],
      ['trig_shift_not_divided', 'x = π/12 + kπ/2'],
    ])
    expect(familyText(waveZeros(w)!)).toBe('x = π/6 + kπ/2')
  })

  it('amplitude slips keep the sign of a negative A, and drop a top that is not above zero', () => {
    const w = W('cos', r(-3), num(1), num(0), r(-4))
    expect(amplitudeSlips(w).map((s) => [s.id, exactText(s.value)])).toEqual([
      ['trig_amplitude_negative', '-3'],
      ['trig_amplitude_as_span', '6'],
    ])
    expect(keyPointSlips(w, 'factored').map((s) => [s.id, pointsText(s.points)])).toEqual([['trig_reflection_missed', '(0, -1), (π/2, -4), (π, -7), (3π/2, -4), (2π, -1)']])
  })

  it('every sentence is about her answer and states no number of this problem', () => {
    const w = W('sin', r(-5, 2), num(2, 3), pi(1, 2), r(-1))
    const all = [...amplitudeSlips(w), ...periodSlips(w), ...shiftSlips(w, 'expanded'), ...midlineSlips(w)].map((s) => s.witness)
    // The formulas 2π/B and π/B are the rule, not a number of this problem.
    for (const s of all) expect(s.replace(/2?π\/B/g, '')).not.toMatch(/\d/)
  })
})
