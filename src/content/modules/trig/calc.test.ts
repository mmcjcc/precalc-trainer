import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { ModuleId } from '@/shared/types'
import { trigAnswerOf } from './testkit'

const LOOP_TIMEOUT = 120_000

describe('the calculator panels: the mode first, then the keys, then a decimal check of an exact answer', () => {
  it(
    'every problem with sin, cos or tan sets the angle mode of its own unit first; exact answers end with a check',
    () => {
      const templates: [ModuleId, string][] = [
        ['angleMeasure', 'am.convert'],
        ['angleMeasure', 'am.coterminal'],
        ['angleMeasure', 'am.reference'],
        ['unitCircle', 'uc.exact'],
      ]
      for (const [m, t] of templates) {
        for (let seed = 1; seed <= 40; seed++) {
          const p = generateProblem(m, t, seed)
          const a = trigAnswerOf(p)
          const ti = p.calc.ti84
          const ns = p.calc.nspire
          const radians = !/°/.test(a.figure.label)
          // A conversion works in the mode of the unit it converts to; the others in the angle's own unit.
          const target = a.question === 'convert' ? (a.stages[0]!.check as { unit: 'deg' | 'rad' }).unit : radians ? 'rad' : 'deg'
          expect(ti[0]!.title, `${p.id}`).toBe(`Set the angle mode to ${target === 'rad' ? 'RADIAN' : 'DEGREE'}`)
          expect(ti[0]!.keys).toMatch(/^MODE →/)
          expect(ns[0]!.title).toBe(`Set the angle mode to ${target === 'rad' ? 'Radian' : 'Degree'}`)
          const exactPart = a.stages.some((s) => s.kind === 'angle' || (s.kind === 'value' && s.answerText !== 'undefined'))
          if (exactPart && (a.question === 'convert' || a.question === 'exact')) expect(ti.at(-1)!.title).toBe('Check your exact answer')
        }
      }
    },
    LOOP_TIMEOUT,
  )

  it(
    'csc, sec and cot go through 1 ÷ SIN, COS or TAN; a value that does not exist warns about the error',
    () => {
      for (let seed = 1; seed <= 200; seed++) {
        const p = generateProblem('unitCircle', 'uc.exact', seed)
        const a = trigAnswerOf(p)
        const c = a.stages[0]!.check
        if (c.kind !== 'value') continue
        const step = p.calc.ti84[1]!
        if (c.fn === 'csc' || c.fn === 'sec' || c.fn === 'cot') expect(step.keys).toMatch(/^1 ÷ (SIN|COS|TAN)\(/)
        if (a.stages[0]!.answerText === 'undefined') expect(step.caution).toMatch(/error/)
      }
    },
    LOOP_TIMEOUT,
  )

  it('arcs and points are arithmetic: no mode step, and π is 2nd ^', () => {
    const arc = generateProblem('angleMeasure', 'am.arc', 1)
    expect(arc.calc.ti84[0]!.title).toMatch(/^Work out the (arc length|area)/)
    expect(arc.calc.ti84[0]!.caution).toMatch(/mode does not matter/)
    const point = generateProblem('unitCircle', 'uc.point', 1)
    expect(point.calc.ti84[0]!.title).toBe('Find r')
  })
})
