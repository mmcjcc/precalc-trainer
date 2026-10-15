/**
 * Right answers written the ways a student writes them: no spaces, U or ∪, "{}" or "no solution",
 * an unreduced fraction.
 */
import { describe, expect, it } from 'vitest'
import { gradeCritical, gradeSigns, gradeSolution } from './grade'
import { parseInequality } from './model'

describe('equivalent spellings of a sign-chart answer', () => {
  const square = parseInequality('(x - 2)^2(x + 1) >= 0')
  const ratio = parseInequality('(x + 3)/(x - 1) <= 0')
  const moved = parseInequality('2/(x - 1) < 1')
  const none = parseInequality('(x - 2)^2 < 0')
  const all = parseInequality('(x - 2)^2 >= 0')
  const half = parseInequality('(2x - 1)(x + 1) > 0')
  const point = parseInequality('(x - 2)^2 <= 0')

  it.each(['[-1, inf)', '[-1,inf)', '[-1, ∞)', '[-1, infinity)'])('square ≥ 0: %s', (text) => {
    expect(gradeSolution(square, text).verdict).toBe('correct')
  })

  it.each(['[-3, 1)', '[-3,1)', '[-6/2, 2/2)'])('ratio ≤ 0: %s', (text) => {
    expect(gradeSolution(ratio, text).verdict).toBe('correct')
  })

  it.each(['(-inf, 1) U (3, inf)', '(-inf,1)U(3,inf)', '(-∞, 1) ∪ (3, ∞)', '(-infinity, 1) U (3, infinity)'])('moved < 1: %s', (text) => {
    expect(gradeSolution(moved, text).verdict).toBe('correct')
  })

  it.each(['no solution', 'No solution', '{}', 'none', '∅', 'empty'])('no solution: %s', (text) => {
    expect(gradeSolution(none, text).verdict).toBe('correct')
  })

  it.each(['(-inf, inf)', '(-inf,inf)', '(-∞, ∞)', 'all real numbers'])('all reals: %s', (text) => {
    expect(gradeSolution(all, text).verdict).toBe('correct')
  })

  it.each(['(-inf, -1) U (1/2, inf)', '(-inf,-1)U(2/4,inf)', '(-infinity, -1) ∪ (1/2, infinity)'])('half: %s', (text) => {
    expect(gradeSolution(half, text).verdict).toBe('correct')
  })

  it.each(['{2}', '{4/2}', '{2}'])('a single point: %s', (text) => {
    expect(gradeSolution(point, text).verdict).toBe('correct')
  })

  it('accepts an unreduced critical number, and signs with or without commas', () => {
    expect(gradeCritical(ratio, '-3, 1').verdict).toBe('correct')
    expect(gradeCritical(ratio, '-6/2, 2/2').verdict).toBe('correct')
    expect(gradeSigns(square, '-, +, +').verdict).toBe('correct')
    expect(gradeSigns(square, '- + +').verdict).toBe('correct')
    expect(gradeSigns(square, '-++').verdict).toBe('correct')
    expect(gradeSigns(square, '−, +, +').verdict).toBe('correct')
  })
})
