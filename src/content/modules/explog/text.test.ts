import { describe, expect, it } from 'vitest'
import { exampleShowsAnswer, safeExample, safeLesson, safeWitness } from './text'

// The emulator showed this witness after a sign slip on log(0.1): it gave the answer away.
const SIGN_SLIP = '0.1 is between 0 and 1, so it takes a negative power of the base: log(0.1) = −1.'

describe('exampleShowsAnswer: does a line she sees spell her answer?', () => {
  it('beside a retry, an answer at the end of a sentence counts: the period is not a decimal point', () => {
    expect(exampleShowsAnswer(SIGN_SLIP, '-1', { sentenceEnd: true })).toBe(true)
    expect(exampleShowsAnswer('The value is 7/3.', '7/3', { sentenceEnd: true })).toBe(true)
  })

  it('a longer number is never the answer: a decimal, a digit before or after, a subscript', () => {
    for (const opts of [{}, { sentenceEnd: true }]) {
      expect(exampleShowsAnswer('log(0.001) = −3, not −1.5', '-1', opts)).toBe(false)
      expect(exampleShowsAnswer('the base is 10.', '0', opts)).toBe(false)
      expect(exampleShowsAnswer('log_29 of something', '29', opts)).toBe(false)
      expect(exampleShowsAnswer('0.1 is small', '1', opts)).toBe(false)
    }
  })

  it('problem generation keeps the old boundary for now (its rule cards state general facts)', () => {
    expect(exampleShowsAnswer('Every y = b^x passes through (0, 1).', '(0, 1)')).toBe(false)
    expect(exampleShowsAnswer('Every y = b^x passes through (0, 1) on its graph', '(0, 1)')).toBe(true)
  })
})

describe('the guards beside a retry', () => {
  it('safeWitness swaps a witness that ends with the answer for a number-free line', () => {
    const shown = safeWitness(SIGN_SLIP, ['-1'])
    expect(shown).not.toContain('−1')
    expect(shown).toMatch(/rule card/)
    expect(safeWitness('Check the sign of the exponent.', ['-1'])).toBe('Check the sign of the exponent.')
  })

  it('safeExample and safeLesson do the same', () => {
    expect(safeExample('log(0.1) → 1 ✗ → −1.', ['-1'])).toBe('')
    expect(safeLesson('So log(0.1) = −1.', ['-1'])).toMatch(/rule card/)
  })
})
