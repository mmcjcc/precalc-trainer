/**
 * The worked answers of the unit 3 problems that solve for x: they show the equation and the algebra, not only the
 * answers (a design review found "1. x = 9. 2. m∠B = 34." for a triangle, with no equation).
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import { solveText, lin } from './expr'

function answerOf(module: 'geoParallel' | 'geoPolygonAngles', template: string, seed: number): GeometryAnswer {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${template}/${seed} is ${p.answer.type}`)
  return p.answer
}

describe('solveText', () => {
  it('collects, isolates and solves, keeping the x terms positive', () => {
    expect(solveText(lin(7, 117), lin(0, 180))).toBe('7x + 117 = 180, so 7x = 63 and x = 9')
    expect(solveText(lin(4, 6), lin(6, -14))).toBe('4x + 6 = 6x − 14, so 2x = 20 and x = 10')
    expect(solveText(lin(1, 63), lin(2, 50))).toBe('x + 63 = 2x + 50, so x = 13')
    expect(solveText(lin(9, 0), lin(0, 180))).toBe('9x = 180, so x = 20')
  })
})

describe('unit 3 worked answers show the equation', () => {
  it('a triangle: the angle sum, the algebra, then the measure with x put in', () => {
    const a = answerOf('geoPolygonAngles', 'gpa.triangle', 4)
    expect(a.reveal).toEqual([
      'The three angles of a triangle add to 180°: (2x + 27) + (x + 25) + (4x + 65) = 180. Combine like terms: 7x + 117 = 180, so 7x = 63 and x = 9.',
      'm∠C = 4x + 65 = 4(9) + 65 = 101°.',
    ])
  })

  it('an exterior angle: the remote angles, the algebra, then m∠ACD', () => {
    const a = answerOf('geoPolygonAngles', 'gpa.triangle', 1)
    expect(a.reveal).toEqual([
      'The exterior angle equals the two remote interior angles together: 6x − 5 = (3x + 2) + (2x + 1). Combine like terms: 6x − 5 = 5x + 3, so x = 8.',
      'm∠ACD = 6x − 5 = 6(8) − 5 = 43°.',
    ])
  })

  it('parallel lines: the pair named, its equation, then the measure', () => {
    expect(answerOf('geoParallel', 'gl3.solve', 2).reveal).toEqual([
      '∠4 and ∠6 are alternate interior angles, so they are congruent: 4x + 6 = 6x − 14, so 2x = 20 and x = 10.',
      'm∠4 = 4x + 6 = 4(10) + 6 = 46°.',
    ])
    expect(answerOf('geoParallel', 'gl3.solve', 1).reveal[0]).toBe(
      '∠3 and ∠6 are same-side interior angles, so they add to 180°: (2x + 10) + (3x + 20) = 180. Combine like terms: 5x + 30 = 180, so 5x = 150 and x = 30.',
    )
  })

  it('every seed: the x line ends with her x, the measure line with her measure, and each stage reveals its own line', () => {
    for (const [module, template] of [
      ['geoParallel', 'gl3.solve'],
      ['geoPolygonAngles', 'gpa.triangle'],
    ] as const) {
      for (let seed = 1; seed <= 300; seed++) {
        const a = answerOf(module, template, seed)
        const where = `${template}/${seed}`
        const [xStage, result] = a.stages
        expect(a.reveal, where).toHaveLength(2)
        expect(a.reveal[0], where).toContain(' = ')
        expect(a.reveal[0]!.endsWith(`x = ${xStage!.answerText}.`), `${where}: ${a.reveal[0]}`).toBe(true)
        expect(a.reveal[1]!.endsWith(` = ${result!.answerText}°.`), `${where}: ${a.reveal[1]}`).toBe(true)
        expect(xStage!.reveal, where).toEqual([a.reveal[0]])
        expect(result!.reveal, where).toEqual([a.reveal[1]])
      }
    }
  })
})
