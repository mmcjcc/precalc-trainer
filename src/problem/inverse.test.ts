import { describe, expect, it } from 'vitest'
import { detectInverseCompletion, gradeCheckIt, gradeOneToOne, gradeTwin, twinEvidence, type InverseAnswer } from './inverse'

const yes: InverseAnswer = { type: 'inverse', oneToOne: true, inverse: '(x + 3)/-4' }
const no: InverseAnswer = { type: 'inverse', oneToOne: false, reason: 'even_power_pm' }

describe('gradeOneToOne', () => {
  it('accepts yes for a one-to-one function', () => {
    expect(gradeOneToOne(yes, '-4x - 3', 'yes', null).correct).toBe(true)
  })
  it('shows f(a) = f(b) = y evidence on a wrong yes', () => {
    const g = gradeOneToOne(no, 'x^2 + 1', 'yes', null)
    expect(g.correct).toBe(false)
    expect(g.witness).toBeDefined()
    expect(g.message).toMatch(/f\(-?\d+\) = f\(-?\d+\) = \d+/)
  })
  it('requires a reason for no and prefers the stored one', () => {
    expect(gradeOneToOne(no, 'x^2 + 1', 'no', null).correct).toBe(false)
    expect(gradeOneToOne(no, 'x^2 + 1', 'no', 'even_power_pm').correct).toBe(true)
    const wrongReason = gradeOneToOne(no, 'x^2 + 1', 'no', 'repeated_y')
    expect(wrongReason.correct).toBe(false)
    expect(wrongReason.message).toMatch(/even power/i)
  })
  it('rejects no for a one-to-one function', () => {
    expect(gradeOneToOne(yes, '-4x - 3', 'no', 'fails_hlt').correct).toBe(false)
  })
})

describe('detectInverseCompletion', () => {
  it('detects y = E, E = y and f^-1(x) = E when E is equivalent to the inverse', () => {
    expect(detectInverseCompletion('y = (x + 3)/-4', yes.inverse)).toBe('(x + 3)/-4')
    expect(detectInverseCompletion('(x+3)/-4 = y', yes.inverse)).toBe('(x+3)/-4')
    expect(detectInverseCompletion('f^-1(x) = -(x+3)/4', yes.inverse)).toBe('-(x+3)/4')
    expect(detectInverseCompletion('f⁻¹(x) = -x/4 - 3/4', yes.inverse)).toBe('-x/4 - 3/4')
  })
  it('does not fire on intermediate lines or the wrong expression', () => {
    expect(detectInverseCompletion('x + 3 = -4y', yes.inverse)).toBeNull()
    expect(detectInverseCompletion('y = -4x - 3', yes.inverse)).toBeNull()
    expect(detectInverseCompletion('y = (x + 3)/4', yes.inverse)).toBeNull()
    expect(detectInverseCompletion(null, yes.inverse)).toBeNull()
    expect(detectInverseCompletion('y = x', undefined)).toBeNull()
  })
})

describe('gradeCheckIt', () => {
  const check = { k: -1, fk: 1 }
  it('grades both numbers', () => {
    const g = gradeCheckIt('1', '-1', check)
    expect(g.done).toBe(true)
    expect(gradeCheckIt('1', '', check).done).toBe(false)
    const wrong = gradeCheckIt('2', '-1', check)
    expect(wrong.fk.status).toBe('wrong')
    expect(wrong.fk.message).toMatch(/should be 1/)
    expect(gradeCheckIt('abc', '', check).fk.status).toBe('parse')
    expect(gradeCheckIt('2/2', '-2/2', check).done).toBe(true)
  })
  it('grades the twin pair against the shared output', () => {
    const twin = { k: 2, fk: 5, twin: -6 }
    expect(gradeTwin('5', '5', twin).done).toBe(true)
    expect(gradeTwin('5', '5', twin).twin.message).toMatch(/same output as f\(2\)/)
    const wrong = gradeTwin('5', '4', twin)
    expect(wrong.done).toBe(false)
    expect(wrong.twin.message).toMatch(/f\(-6\) should be 5/)
    expect(gradeTwin('5', '', { k: 2, fk: 5 }).done).toBe(true)
  })
  it('formats twin evidence', () => {
    expect(twinEvidence({ k: 2, fk: 5, twin: -6 })).toBe('f(2) = f(-6) = 5')
    expect(twinEvidence({ k: 2, fk: 5 })).toBeNull()
  })
})
