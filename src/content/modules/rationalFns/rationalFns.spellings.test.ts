/**
 * Right answers written the ways a student writes them. f = (3x^2 - 16x + 5)/(9x^3 - 30x^2 - 27x + 12)
 * = (3x - 1)(x - 5) / (3(3x - 1)(x - 4)(x + 1)): hole (1/3, 7/22), VAs x = -1 and x = 4, y = 0,
 * x-intercept (5, 0), y-intercept (0, 5/12). The equation ((x + 2)(x + 1))/(x + 1) = 1 has no solution.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { gradeRfStage, type RationalFnsAnswer } from './build'
import type { RfStageId } from './grade'

const answer = (t: string, seed: number) => generateProblem('rationalFns', t, seed).answer as RationalFnsAnswer

describe('equivalent spellings of right answers', () => {
  const f = answer('rf.features', 1)
  it.each<[RfStageId, string]>([
    ['va', 'x=4, x=-1'],
    ['va', 'x = -1 and x = 4'],
    ['holes', '(1/3,7/22)'],
    ['holes', '(2/6, 14/44)'],
    ['asymptote', 'y=0'],
    ['xint', '(5,0)'],
    ['yint', '(0, 10/24)'],
    ['domain', '(-inf,-1)U(-1,1/3)U(1/3,4)U(4,inf)'],
  ])('%s: %s', (stage, text) => {
    expect(gradeRfStage(f, stage, text).verdict).toBe('correct')
  })
  const eq = answer('rf.equation', 1)
  it.each(['no solution', 'No solution', '{}', 'none', '∅'])('equation: %s', (text) => {
    expect(gradeRfStage(eq, 'solution', text).verdict).toBe('correct')
  })
})
