/**
 * The Unit 5 readers by hand: a phase shift every way a textbook writes it (−π/3 is π/3 left); a set of x-values as a
 * family or a list, every equal set right (any base, any letter, (2k + 1)π/4, two families that make one); the five
 * key points as a set in any order.
 */
import { describe, expect, it } from 'vitest'
import { exactText, tx, type TrigExact } from './exact'
import { q } from './rational'
import { gradePoints, readPointList } from './points'
import { gradeShift, readShift } from './shift'
import { gradeXSet, readXSet, sameXSet, type XSet } from './xset'

const pi = (n: number, d = 1): TrigExact => tx(q(n, d), 1, 1)
const num = (n: number, d = 1): TrigExact => tx(q(n, d))

describe('the phase shift', () => {
  it.each([
    ['π/4 right', 'π/4'],
    ['π/4 to the right', 'π/4'],
    ['pi/4 units to the right', 'π/4'],
    ['right π/4', 'π/4'],
    ['right by pi/4', 'π/4'],
    ['π/4', 'π/4'],
    ['phase shift = π/4 right', 'π/4'],
    ['-π/3', '-π/3'],
    ['π/3 left', '-π/3'],
    ['π/3 to the left', '-π/3'],
    ['left π/3', '-π/3'],
    ['π/3 L', '-π/3'],
    ['1/2 right', '1/2'],
    ['none', '0'],
    ['no phase shift', '0'],
    ['0', '0'],
  ])('“%s” is %s', (typed, value) => {
    const r = readShift(typed)
    if (!r.ok) throw new Error(r.message)
    expect(exactText(r.value)).toBe(value)
  })

  it.each([['45° right'], ['-π/3 left'], ['left'], ['π/3 up'], ['undefined']])('“%s” is not read', (typed) => {
    expect(readShift(typed).ok).toBe(false)
  })

  it('grades a right shift, its slips, a decimal and a plain wrong answer', () => {
    const cands = [
      { id: 'trig_shift_not_divided' as const, value: pi(1, 2), witness: 'w1' },
      { id: 'trig_shift_wrong_way' as const, value: pi(-1, 4), witness: 'w2' },
    ]
    expect(gradeShift(pi(1, 4), 'π/4 to the right', cands).verdict).toBe('correct')
    expect(gradeShift(pi(1, 4), 'π/2 right', cands)).toMatchObject({ verdict: 'mistake', mistake: 'trig_shift_not_divided' })
    expect(gradeShift(pi(1, 4), 'π/4 left', cands)).toMatchObject({ verdict: 'mistake', mistake: 'trig_shift_wrong_way' })
    expect(gradeShift(pi(1, 4), '0.785 right', cands)).toMatchObject({ verdict: 'invalid', reason: 'not_exact' })
    expect(gradeShift(pi(1, 4), 'π/8', cands).verdict).toBe('wrong')
    expect(gradeShift(num(0), 'none', cands).verdict).toBe('correct')
  })
})

const set = (t: string): XSet => {
  const r = readXSet(t)
  if (!r.ok) throw new Error(`${t}: ${r.message}`)
  return r.set
}

describe('sets of x-values', () => {
  const answer = set('x = π/4 + kπ/2')
  it.each([
    'x = π/4 + kπ/2',
    'π/4 + kπ/2',
    'x = π/4 + πk/2',
    'x = π/4 + (π/2)k',
    'x = -π/4 + kπ/2',
    'x = 3π/4 + nπ/2',
    'x = (2k + 1)π/4',
    'x = π/4 + kπ, x = 3π/4 + kπ',
    'x = π/4 + kπ/2, k ∈ ℤ',
    'x = π/4 + kπ/2 where k is an integer',
    'x = π/4 + kπ/2 for any integer k',
    'x = π/4 + kπ/2 (k an integer)',
    '{π/4 + kπ/2}',
    'x = π/4 + kπ/2 and x = 5π/4 + kπ',
  ])('π/4 + kπ/2 is %s', (t) => {
    expect(sameXSet(answer, set(t))).toBe(true)
  })
  it.each(['x = π/4 + kπ', 'x = π/2 + kπ/2', 'x = π/4 + kπ/4', 'x = π/4', 'x = π/4, x = 3π/4', 'x = kπ/2'])('π/4 + kπ/2 is not %s', (t) => {
    expect(sameXSet(answer, set(t))).toBe(false)
  })
  it('families without π (a period with no π): x = 1 + 2k is x = −1 + 2k, not x = 1 + k', () => {
    expect(sameXSet(set('x = 1 + 2k'), set('x = -1 + 2n'))).toBe(true)
    expect(sameXSet(set('x = 1 + 2k'), set('x = 2k + 1'))).toBe(true)
    expect(sameXSet(set('x = 1 + 2k'), set('x = 1 + k'))).toBe(false)
  })
  it('lists: the same values in any order and spelling', () => {
    expect(sameXSet(set('x = π/4, x = 3π/4'), set('3pi/4, pi/4'))).toBe(true)
    expect(sameXSet(set('π/4 and 3π/4'), set('x = π/4'))).toBe(false)
  })
  it.each([
    ['x = π/4 + k^2π', /a \+ kp/],
    ['y = π/4 + kπ', /x-values/],
    ['x = π/4 + kπ + n', /one letter/],
    ['x = π/4 + k', /not a sum of the two kinds/],
    ['x = 0.785 + kπ', /fractions instead of decimals/],
    ['x = sin(30) + kπ', /trig function/],
    ['x = 1/0', /divided by zero/],
    ['x = u + kπ', /the only letter/i],
  ])('“%s” is a message', (t, m) => {
    const r = readXSet(t)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(m)
  })
  it('grades: a family where a family is asked; a list of members is a note; a list in an interval', () => {
    const cands = [{ id: 'trig_asymptotes_zeros_swapped' as const, set: set('x = kπ/2'), witness: 'w' }]
    expect(gradeXSet({ answer, what: 'asymptotes' }, 'x = -π/4 + kπ/2', cands).verdict).toBe('correct')
    expect(gradeXSet({ answer, what: 'asymptotes' }, 'x = kπ/2', cands)).toMatchObject({ verdict: 'mistake', mistake: 'trig_asymptotes_zeros_swapped' })
    expect(gradeXSet({ answer, what: 'asymptotes' }, 'x = π/4, x = 3π/4', cands).verdict).toBe('invalid')
    expect(gradeXSet({ answer, what: 'asymptotes' }, 'x = π/3 + kπ', cands).verdict).toBe('wrong')
    const list = set('x = π/4, x = 3π/4')
    const spec = { answer: list, between: [0, Math.PI] as [number, number], what: 'asymptotes' }
    expect(gradeXSet(spec, '3π/4, π/4', []).verdict).toBe('correct')
    expect(gradeXSet(spec, 'x = π/4 + kπ/2', []).verdict).toBe('invalid')
    expect(gradeXSet(spec, 'x = π/4', []).verdict).toBe('invalid')
    expect(gradeXSet(spec, 'x = π/2', []).verdict).toBe('wrong')
  })
  it('reads back the value of a family member', () => {
    const f = set('x = π/4 + kπ/2').families[0]!
    expect([exactText(f.base), exactText(f.step)]).toEqual(['π/4', 'π/2'])
    expect(exactText(set('x = -π/4 + kπ/2').families[0]!.base)).toBe('π/4')
    expect(pi(1, 4)).toEqual(f.base)
  })
})

describe('key points', () => {
  const answer = readPointList('(π/4, 1), (π/2, 4), (3π/4, 1), (π, −2), (5π/4, 1)')
  if (!answer.ok) throw new Error(answer.message)
  it('in any order, with the keyboard’s spellings', () => {
    expect(gradePoints(answer.points, '(pi, -2), (pi/4, 1), (5pi/4, 1), (pi/2, 4), (3pi/4, 1)', []).verdict).toBe('correct')
    expect(gradePoints(answer.points, '(π/4,1);(π/2,4);(3π/4,1);(π,-2);(5π/4,1)', []).verdict).toBe('correct')
  })
  it('notes: four of the five, a point twice, calculator decimals; a wrong list', () => {
    expect(gradePoints(answer.points, '(π/4, 1), (π/2, 4), (3π/4, 1), (π, −2)', []).verdict).toBe('invalid')
    expect(gradePoints(answer.points, '(π/4, 1), (π/4, 1), (3π/4, 1), (π, −2), (5π/4, 1)', []).verdict).toBe('invalid')
    expect(gradePoints(answer.points, '(0.785, 1), (1.571, 4), (2.356, 1), (3.142, -2), (3.927, 1)', [])).toMatchObject({ verdict: 'invalid', reason: 'not_exact' })
    expect(gradePoints(answer.points, '(0, 1), (π/4, 4), (π/2, 1), (3π/4, −2), (π, 1)', []).verdict).toBe('wrong')
    expect(readPointList('π/4, 1').ok).toBe(false)
    expect(readPointList('(π/4, 1, 2)').ok).toBe(false)
  })
})
