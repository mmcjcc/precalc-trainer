/**
 * The right-triangle templates over 300 seeds each (trig/testkit sweep): deterministic; every answer and spelling
 * right; every slip its own id and never the answer; nonsense not an attempt; the promised slip a real candidate that
 * grades as its id, promised wherever a slip is possible; nothing she sees before a part (the prompt, the
 * instructions, the cards and hints, the part's own texts and catalog entries, and the figure's labels as they stand
 * then) spells that part's answer or a later one; an independent re-solve from the figure and the words agrees; at
 * least 25 distinct problems; no answer above 10% of seeds; and every slip of the brief promised somewhere.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { plain, showsNumber } from '../trig/text'
import { sweep, trigAnswerOf } from '../trig/testkit'
import { RT_HINTS, RT_RULES } from '.'

const LOOP_TIMEOUT = 120_000

describe('the rightTriangle module', () => {
  it('is registered between angles and radian measure and the unit circle, with its four templates and eight cards', () => {
    const mod = getModule('rightTriangle')
    expect(mod.title).toBe('Right triangle trigonometry')
    expect(mod.templates.map((t) => t.id)).toEqual(['rt.ratios', 'rt.special', 'rt.side', 'rt.angle'])
    expect(mod.order).toBeGreaterThan(getModule('angleMeasure').order)
    expect(mod.order).toBeLessThan(getModule('unitCircle').order)
    expect(mod.ruleCards).toHaveLength(8)
  })
})

const BRIEF: Record<string, string[]> = {
  'rt.ratios': ['trig_opposite_adjacent_swapped', 'trig_hypotenuse_as_leg', 'trig_pythag_added', 'trig_pythag_subtracted', 'trig_side_not_rooted', 'trig_reciprocal_missing', 'trig_reciprocal_mixed'],
  'rt.special': ['trig_special_root3_two_swapped', 'trig_special_45_two', 'trig_special_wrong_way', 'trig_special_legs_swapped'],
  'rt.side': ['trig_opposite_adjacent_swapped', 'trig_hypotenuse_as_leg', 'trig_depression_from_vertical', 'trig_radian_mode'],
  'rt.angle': ['trig_radian_mode', 'trig_ratio_for_angle', 'trig_opposite_adjacent_swapped', 'trig_depression_from_vertical', 'trig_hypotenuse_as_leg'],
}

describe.each(Object.keys(BRIEF))('%s over 300 seeds', (templateId) => {
  it(
    'deterministic; every answer and spelling right; every slip its own id; the promised slip real; nothing early spells an answer, figure labels included; the re-solve agrees; varied',
    () => {
      const r = sweep('rightTriangle', templateId, 300, RT_RULES, RT_HINTS, showsNumber)
      expect(r.distinctProblems, 'distinct problems').toBeGreaterThanOrEqual(25)
      expect(r.maxAnswerShare, `the answer ${r.topAnswer} is too common`).toBeLessThanOrEqual(0.1)
      for (const id of BRIEF[templateId]!) expect(r.promised.has(id), `${id} is promised somewhere`).toBe(true)
    },
    LOOP_TIMEOUT,
  )
})

describe('what the templates draw', () => {
  it(
    'ratios: two legs and a leg with the hypotenuse, whole and radical third sides, θ at the base and at the top, one to three ratios',
    () => {
      const seen = { legs: 0, legHyp: 0, radical: 0, whole: 0, top: 0, base: 0 }
      const counts = new Set<number>()
      for (let seed = 1; seed <= 300; seed++) {
        const a = trigAnswerOf(generateProblem('rightTriangle', 'rt.ratios', seed))
        expect(a.stages[0]!.id).toBe('side')
        counts.add(a.stages.length - 1)
        if (/the legs are/.test(a.prompt)) seen.legs++
        else seen.legHyp++
        if (a.stages[0]!.answerText.includes('√')) seen.radical++
        else seen.whole++
        const tri = a.figure.triangle!
        const theta = tri.corners.find((c) => c.id === tri.angles[0]!.at)!
        if (theta.y > 0) seen.top++
        else seen.base++
        // The third side is the one labelled only once she has found it.
        expect(tri.sides.filter((s) => s.after === 'side')).toHaveLength(1)
      }
      for (const [k, v] of Object.entries(seen)) expect(v, k).toBeGreaterThan(30)
      expect([...counts].sort()).toEqual([1, 2, 3])
    },
    LOOP_TIMEOUT,
  )

  it(
    'special triangles: both kinds, every side given, whole and radical lengths, the hypotenuse given with a leg asked',
    () => {
      const kinds = new Set<string>()
      let radicalGiven = 0
      let legFromHyp = 0
      for (let seed = 1; seed <= 300; seed++) {
        const a = trigAnswerOf(generateProblem('rightTriangle', 'rt.special', seed))
        const words = plain(a.prompt)
        const given = /shown, (.+?) is (\S+)\. Find/.exec(words)!
        kinds.add(`${words.includes('45°-45°-90°') ? '45' : '30'}:${given[1]}`)
        if (given[2]!.includes('√')) radicalGiven++
        if (given[1] === 'the hypotenuse') legFromHyp++
      }
      expect([...kinds].sort()).toEqual([
        '30:the hypotenuse',
        '30:the side across from the 30° angle',
        '30:the side across from the 60° angle',
        '45:one leg',
        '45:the hypotenuse',
      ])
      expect(radicalGiven).toBeGreaterThan(40)
      expect(legFromHyp).toBeGreaterThan(40)
    },
    LOOP_TIMEOUT,
  )

  it(
    'sides and angles: plain triangles and every story, each rounding, an angle of depression from the horizontal',
    () => {
      for (const t of ['rt.side', 'rt.angle']) {
        const scenes = new Map<string, number>()
        const places = new Set<number>()
        for (let seed = 1; seed <= 300; seed++) {
          const a = trigAnswerOf(generateProblem('rightTriangle', t, seed))
          const tri = a.figure.triangle!
          scenes.set(tri.scene, (scenes.get(tri.scene) ?? 0) + 1)
          const c = a.stages[0]!.check
          if (c.kind === 'decimal') places.add(c.places)
          if (tri.scene === 'lighthouse') expect(tri.angles[0]!.fromHorizontal, `${t}/${seed}: depression from the horizontal`).toBe(true)
          // The asked side is a letter, the asked angle is θ: never a number.
          if (t === 'rt.side') expect(tri.sides.some((s) => s.label === 'x')).toBe(true)
          else expect(tri.angles[0]!.label).toBe('θ')
        }
        for (const s of ['plain', 'ladder', 'ramp', 'kite', 'lighthouse', 'tree']) expect(scenes.get(s) ?? 0, `${t}: ${s}`).toBeGreaterThan(10)
        expect([...places].sort(), t).toEqual(t === 'rt.side' ? [0, 1, 2] : [1])
      }
    },
    LOOP_TIMEOUT,
  )
})
