import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { showsNumber } from '../trig/text'
import { sweep, trigAnswerOf } from '../trig/testkit'
import { UC_HINTS, UC_RULES } from '.'

const LOOP_TIMEOUT = 120_000

describe('the unitCircle module', () => {
  it('is registered after right triangle trigonometry, with its four templates and eight rule cards', () => {
    const mod = getModule('unitCircle')
    expect(mod.title).toBe('The unit circle and trig functions of any angle')
    expect(mod.templates.map((t) => t.id)).toEqual(['uc.exact', 'uc.point', 'uc.given', 'uc.solve'])
    expect(mod.order).toBeGreaterThan(getModule('angleMeasure').order)
    expect(mod.order).toBeGreaterThan(getModule('rightTriangle').order)
    expect(mod.ruleCards).toHaveLength(8)
  })
})

const BRIEF: Record<string, string[]> = {
  'uc.exact': ['trig_sign_quadrant', 'trig_sin_cos_swapped', 'trig_tan_inverted', 'trig_reciprocal_mixed', 'trig_reciprocal_missing', 'trig_zero_for_undefined', 'trig_undefined_for_zero'],
  'uc.point': ['trig_sign_quadrant', 'trig_r_left_out', 'trig_sin_cos_swapped', 'trig_tan_inverted', 'trig_reciprocal_mixed', 'trig_reciprocal_missing', 'trig_r_not_rooted'],
  'uc.given': ['trig_coordinate_sign', 'trig_pythag_added', 'trig_side_not_rooted', 'trig_r_not_rooted', 'trig_r_negative', 'trig_sign_quadrant', 'trig_sin_cos_swapped', 'trig_r_left_out', 'trig_tan_inverted', 'trig_reciprocal_missing', 'trig_reciprocal_mixed'],
  // trig_solve_one_answer is named by rule (any one of two answers) and never promised: a list with one answer in it
  // is part of the answer (unitCircle.second.test.ts names it).
  'uc.solve': ['trig_solve_reference_only', 'trig_solve_wrong_sign_quadrant', 'trig_solve_out_of_range', 'trig_sin_cos_swapped', 'trig_reciprocal_missing', 'trig_reciprocal_mixed', 'trig_pi_dropped'],
}

/** The second half's templates use its leak matcher, as their gate does. */
const SECOND = new Set(['uc.given', 'uc.solve'])

describe.each(Object.keys(BRIEF))('%s over 300 seeds', (templateId) => {
  it(
    'deterministic; every answer and spelling right; every slip its own id; the promised slip real; nothing early spells an answer; the re-solve agrees; varied',
    () => {
      const r = sweep('unitCircle', templateId, 300, UC_RULES, UC_HINTS, SECOND.has(templateId) ? showsNumber : undefined)
      expect(r.distinctProblems, 'distinct problems').toBeGreaterThanOrEqual(25)
      expect(r.maxAnswerShare, `the answer ${r.topAnswer} is too common`).toBeLessThanOrEqual(0.1)
      for (const id of BRIEF[templateId]!) expect(r.promised.has(id), `${id} is promised somewhere`).toBe(true)
    },
    LOOP_TIMEOUT,
  )
})

describe('what the templates draw', () => {
  it(
    'exact values: all six functions, both units, every quadrant, the axes with values that do not exist, coterminal forms',
    () => {
      const fns = new Set<string>()
      const seen = { degrees: 0, radians: 0, undefined: 0, axis: 0, negative: 0, pastTurn: 0 }
      const quadrants = new Set<number>()
      for (let seed = 1; seed <= 300; seed++) {
        const a = trigAnswerOf(generateProblem('unitCircle', 'uc.exact', seed))
        const c = a.stages[0]!.check
        if (c.kind === 'value') fns.add(c.fn!)
        if (/°/.test(a.figure.label)) seen.degrees++
        else seen.radians++
        if (a.stages[0]!.answerText === 'undefined') seen.undefined++
        const co = ((a.figure.deg % 360) + 360) % 360
        if (co % 90 === 0) seen.axis++
        else quadrants.add(Math.floor(co / 90) + 1)
        if (a.figure.deg < 0) seen.negative++
        if (Math.abs(a.figure.deg) > 360) seen.pastTurn++
      }
      expect([...fns].sort()).toEqual(['cos', 'cot', 'csc', 'sec', 'sin', 'tan'])
      expect([...quadrants].sort()).toEqual([1, 2, 3, 4])
      for (const [k, v] of Object.entries(seen)) expect(v, k).toBeGreaterThan(5)
    },
    LOOP_TIMEOUT,
  )

  it(
    'points: whole-number distances and radicals, every quadrant, r first and then one to three functions',
    () => {
      let radical = 0
      let whole = 0
      const counts = new Set<number>()
      const quadrants = new Set<string>()
      for (let seed = 1; seed <= 300; seed++) {
        const a = trigAnswerOf(generateProblem('unitCircle', 'uc.point', seed))
        expect(a.stages[0]!.id).toBe('r')
        counts.add(a.stages.length - 1)
        if (a.stages[0]!.answerText.includes('√')) radical++
        else whole++
        const { x, y } = a.figure.point!
        quadrants.add(`${Math.sign(x)}${Math.sign(y)}`)
      }
      expect(radical).toBeGreaterThan(60)
      expect(whole).toBeGreaterThan(60)
      expect([...counts].sort()).toEqual([1, 2, 3])
      expect(quadrants.size).toBe(4)
    },
    LOOP_TIMEOUT,
  )
})
