/** Inputs from an adversarial review (Gemini, 2026-10-14) that the grader used to answer with a generic message. */
import { describe, expect, it } from 'vitest'
import { gradeScPart } from './grade'
import { parseInequality } from './model'

const named = (ineq: string, stage: 'solution' | 'critical', text: string) => {
  const g = gradeScPart(parseInequality(ineq), stage, text)
  return g.verdict === 'mistake' ? g.mistake : g.verdict
}

describe('slips found in review', () => {
  it('names a bracket at a denominator zero on a strict inequality', () => {
    expect(named('(x - 1)/(x - 2) < 0', 'solution', '(1, 2]')).toBe('sc_denominator_included')
    expect(named('(x - 1)/(x - 2) < 0', 'solution', '(1, 2)')).toBe('correct')
  })

  it('names the exact complement as the other intervals', () => {
    expect(named('(x - 1)(x - 2) <= 0', 'solution', '(-inf, 1) U (2, inf)')).toBe('sc_wrong_intervals')
    expect(named('(x - 1)(x - 2) <= 0', 'solution', '[1, 2]')).toBe('correct')
  })

  it('names a missing critical number even when the list is also out of order', () => {
    expect(named('(x + 1)(x - 1)(x - 2) > 0', 'critical', '2, 1')).toBe('sc_critical_missing')
    expect(named('(x + 1)(x - 1)(x - 2) > 0', 'critical', '2, 1, -1')).toBe('wrong')
    expect(named('(x + 1)(x - 1)(x - 2) > 0', 'critical', '-1, 1, 2')).toBe('correct')
  })
})
