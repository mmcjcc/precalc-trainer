/**
 * Chapter 10, percent composition and formulas: the three templates over 300 seeds, the empirical
 * cases the brief asks to see drawn (a ratio ending in a half, in a third or two thirds, in a
 * quarter), and coverage of the whole substance table across both chapter 10 modules.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import type { MoleAnswer } from '@/content/types'
import { roundRatToPlace } from '@/engine/sigfigs/decimal'
import { equalsExampleNumber, gradeMoStage, modelFor } from '../moles/grade'
import { gradeModel } from '../moles/numeric'
import { countsOf, DRAWABLE, MO_RESERVED, MO_RESERVED_WORDS, SUBSTANCES } from '../moles/facts'
import { percentByMass, solveEmpirical } from './facts'

const HEAVY = 120_000
const SEEDS = 300
const TEMPLATES = ['cf.percent', 'cf.empirical', 'cf.molecular'] as const
const MOLE_TEMPLATES = ['mo.particles', 'mo.molarMass', 'mo.mass', 'mo.gas'] as const

function answerOf(moduleId: 'moles' | 'chemFormulas', templateId: string, seed: number) {
  const p = generateProblem(moduleId, templateId, seed)
  if (p.answer.type !== 'mole') throw new Error(`${templateId}/${seed} is ${p.answer.type}`)
  return { answer: p.answer, params: p.params }
}

const CACHE = new Map<string, { answer: MoleAnswer; params: Record<string, unknown> }[]>()
function sweep(templateId: string) {
  const moduleId = templateId.startsWith('cf.') ? 'chemFormulas' : 'moles'
  if (!CACHE.has(templateId)) CACHE.set(templateId, Array.from({ length: SEEDS }, (_, i) => answerOf(moduleId, templateId, i + 1)))
  return CACHE.get(templateId)!
}

describe('registration and the percent arithmetic', () => {
  it('registers chemFormulas with its three templates', () => {
    const mod = getModule('chemFormulas')
    expect(mod.subject).toBe('Chemistry')
    expect(mod.templates.map((t) => t.id)).toEqual([...TEMPLATES])
    expect(generateProblem('chemFormulas', 'cf.percent', 1).kind).toBe('mole')
  })

  it('the percents of one compound sum to 100 within rounding, at the tenths and the hundredths', () => {
    for (const s of SUBSTANCES) {
      if (s.kind === 'element' || s.kind === 'diatomic') continue
      for (const place of [-1, -2]) {
        const rounded = countsOf(s).map((c) => Number(roundRatToPlace(percentByMass(s, c.symbol), place).m) * 10 ** place)
        const sum = rounded.reduce((a, b) => a + b, 0)
        expect(Math.abs(sum - 100), `${s.key} at ${place}`).toBeLessThanOrEqual(countsOf(s).length * 0.5 * 10 ** place + 1e-9)
      }
    }
  })
})

describe.each(TEMPLATES)('%s over 300 seeds', (templateId) => {
  it(
    'is deterministic, re-grades its own answers, and every trap grades to exactly its id',
    () => {
      const all = sweep(templateId)
      for (let i = 0; i < SEEDS; i += 37) expect(JSON.stringify(answerOf('chemFormulas', templateId, i + 1).answer)).toBe(JSON.stringify(all[i]!.answer))
      for (const { answer: a } of all) {
        expect(JSON.parse(JSON.stringify(a))).toEqual(a)
        for (const stage of a.stages) {
          const model = modelFor(stage.check)
          expect(gradeModel(model, stage, stage.answerText).verdict).toBe('correct')
          for (const trap of stage.traps) {
            const g = gradeModel(model, stage, trap.text)
            expect(g.verdict === 'mistake' && g.mistake).toBe(trap.id)
          }
          expect(equalsExampleNumber(stage)).toBe(false)
        }
        if (a.trap) {
          const g = gradeMoStage(a, a.trapStage!, a.trapAnswer!)
          expect(g.verdict === 'mistake' && g.mistake).toBe(a.trap)
        }
        for (const word of MO_RESERVED_WORDS) expect(a.prompt.includes(word)).toBe(false)
      }
    },
    HEAVY,
  )

  it(
    'varies: at least 45 distinct statements over seeds 1..60',
    () => {
      expect(new Set(sweep(templateId).slice(0, 60).map((x) => x.answer.prompt)).size).toBeGreaterThanOrEqual(45)
    },
    HEAVY,
  )
})

describe('what the formula templates draw', () => {
  it(
    'cf.percent draws all three variants and both places',
    () => {
      const variants = new Map<string, number>()
      const places = new Set<unknown>()
      for (const { params } of sweep('cf.percent')) {
        variants.set(String(params.variant), (variants.get(String(params.variant)) ?? 0) + 1)
        if (params.variant !== 'sample') places.add(params.place)
      }
      expect([...variants.keys()].sort()).toEqual(['formula', 'hydrate', 'sample'])
      for (const n of variants.values()) expect(n / SEEDS).toBeGreaterThan(0.15)
      expect([...places].sort((x, y) => Number(x) - Number(y))).toEqual([-2, -1])
    },
    HEAVY,
  )

  it(
    'cf.empirical draws a ratio ending in a half, in a third or two thirds, and in a quarter, from percents and from masses',
    () => {
      const factors = new Map<number, number>()
      const bases = new Set<string>()
      for (const { answer } of sweep('cf.empirical')) {
        const stage = answer.stages.find((s) => s.check.kind === 'empirical')!
        if (stage.check.kind !== 'empirical') continue
        bases.add(stage.check.basis)
        const solve = solveEmpirical(stage.check.data)!
        factors.set(solve.factor, (factors.get(solve.factor) ?? 0) + 1)
      }
      expect(bases).toEqual(new Set(['percent', 'mass']))
      for (const f of [1, 2, 3, 4]) expect(factors.get(f) ?? 0, `factor ${f}`).toBeGreaterThan(0)
    },
    HEAVY,
  )

  it(
    'every formula slip is promised somewhere',
    () => {
      const promised = new Set(TEMPLATES.flatMap((t) => sweep(t).map((x) => x.answer.trap)).filter(Boolean))
      for (const id of [
        'mo_percent_by_count',
        'mo_percent_one_atom',
        'mo_percent_part_over_part',
        'mo_hydrate_water_once',
        'mo_hydrate_water_left_out',
        'mo_subscripts_ignored',
        'mo_molar_mass_inverted',
        'mo_mass_ratio_as_mole_ratio',
        'mo_ratio_rounded',
        'mo_empirical_as_molecular',
      ]) {
        expect(promised.has(id as never), id).toBe(true)
      }
    },
    HEAVY,
  )
})

describe('the whole substance table, across both chapter 10 modules', () => {
  it(
    'every drawable substance appears somewhere over 300 seeds; no reserved one ever does',
    () => {
      const seen = new Set<string>()
      for (const t of [...MOLE_TEMPLATES, ...TEMPLATES]) {
        for (const { answer, params } of sweep(t)) {
          for (const value of Object.values(params)) if (typeof value === 'string') seen.add(value)
          for (const stage of answer.stages) if ('formula' in stage.check) seen.add(stage.check.formula)
        }
      }
      for (const s of DRAWABLE) expect(seen.has(s.key), s.key).toBe(true)
      for (const key of MO_RESERVED) expect(seen.has(key), key).toBe(false)
    },
    HEAVY,
  )
})
