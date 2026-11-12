import { describe, expect, it } from 'vitest'
import { getModule } from '@/content/registry'
import type { ReactionsAnswer } from '@/content/types'
import { ERROR_PATTERNS, nomenclatureProblem } from '@/engine'
import { elementBySymbol } from '@/engine/chem/elements'
import './index'
import {
  atomCounts,
  elementOfFormula,
  isHydrocarbon,
  PREDICT_COMBINATION,
  PREDICT_DECOMPOSITION,
  PREDICT_DOUBLE,
  PREDICT_SINGLE,
  REACTIONS,
  reactionOf,
  reactsWith,
  RX_RESERVED_FORMULAS,
  rxLeaks,
  speciesOf,
  typesPool,
  wordPool,
} from './facts'
import { RX_TEMPLATES } from './generate'
import { gradeRxStage, RX_MISTAKE_IDS, RX_REUSED_MISTAKE_IDS } from './grade'
import { REACTS_TEXT, RX_RULE_FOR, RX_RULES, TYPE_TEXT } from './rules'

const HEAVY = 120_000
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const TEMPLATE_IDS = ['rx.count', 'rx.balance', 'rx.types', 'rx.predict', 'rx.word'] as const

function answerOf(templateId: string, seed: number): ReactionsAnswer {
  const t = RX_TEMPLATES.find((x) => x.id === templateId)!
  const p = t.generate(seed, {})
  if (p.answer.type !== 'reactions') throw new Error(`${templateId}/${seed} is ${p.answer.type}`)
  return p.answer
}

const CACHE = new Map<string, ReactionsAnswer[]>()
function sweep(templateId: string): ReactionsAnswer[] {
  const hit = CACHE.get(templateId)
  if (hit) return hit
  const all = SEEDS.map((seed) => answerOf(templateId, seed))
  CACHE.set(templateId, all)
  return all
}

describe('registration and catalog', () => {
  it('registers the module with its five templates and nine rule cards', () => {
    const mod = getModule('reactions')
    expect(mod.subject).toBe('Chemistry')
    expect(mod.templates.map((t) => t.id)).toEqual([...TEMPLATE_IDS])
    expect(mod.ruleCards.map((c) => c.id)).toEqual(RX_RULES.map((c) => c.id))
    expect(new Set(RX_RULES.map((c) => c.id)).size).toBe(RX_RULES.length)
  })

  it('every rx_ id has a catalog entry and a first rule card', () => {
    for (const id of RX_MISTAKE_IDS) {
      const info = ERROR_PATTERNS[id]
      expect(info.id).toBe(id)
      expect(info.title.length, id).toBeGreaterThan(10)
      expect(info.lesson.length, id).toBeGreaterThan(60)
      expect(info.example, id).toContain('✗ →')
      expect(RX_RULES.some((c) => c.id === RX_RULE_FOR[id]), id).toBe(true)
    }
    expect(RX_REUSED_MISTAKE_IDS.every((id) => id in ERROR_PATTERNS)).toBe(true)
  })
})

describe('the reaction table', () => {
  it('holds 45 to 60 reactions, every type well represented', () => {
    expect(REACTIONS.length).toBeGreaterThanOrEqual(45)
    expect(REACTIONS.length).toBeLessThanOrEqual(60)
    expect(new Set(REACTIONS.map((r) => r.id)).size).toBe(REACTIONS.length)
    for (const type of Object.keys(TYPE_TEXT)) expect(REACTIONS.filter((r) => r.type === type).length, type).toBeGreaterThanOrEqual(8)
  })

  it('every species is a formula the engine reads, and every compound is one its naming model builds', () => {
    for (const r of REACTIONS) {
      for (const s of speciesOf(r)) {
        const counts = atomCounts(s.formula)
        for (const el of counts.keys()) expect(elementBySymbol(el), `${r.id} ${el}`).toBeTruthy()
        if (elementOfFormula(s.formula)) continue
        if (isHydrocarbon(s.formula) && s.formula !== 'CH4') continue
        expect(nomenclatureProblem(s.formula, 'name', { inWater: s.state === 'aq' }), `${r.id} ${s.formula}`).toBeNull()
      }
    }
  })

  it('each row has the shape of its type', () => {
    for (const r of REACTIONS) {
      const elementsIn = r.reactants.filter((s) => elementOfFormula(s.formula))
      const elementsOut = r.products.filter((s) => elementOfFormula(s.formula))
      switch (r.type) {
        case 'combination':
          expect(r.products.length, r.id).toBe(1)
          expect(r.reactants.length, r.id).toBeGreaterThanOrEqual(2)
          break
        case 'decomposition':
          expect(r.reactants.length, r.id).toBe(1)
          expect(r.products.length, r.id).toBeGreaterThanOrEqual(2)
          break
        case 'single':
          expect([elementsIn.length, elementsOut.length, r.reactants.length, r.products.length], r.id).toEqual([1, 1, 2, 2])
          expect(reactsWith(elementOfFormula(elementsIn[0]!.formula)!, r.reactants.find((s) => !elementOfFormula(s.formula))!.formula), r.id).toBe(true)
          break
        case 'double':
          expect([elementsIn.length, elementsOut.length, r.reactants.length, r.products.length], r.id).toEqual([0, 0, 2, 2])
          break
        case 'combustion':
          expect(isHydrocarbon(r.reactants[0]!.formula), r.id).toBe(true)
          expect(r.reactants[1]!.formula).toBe('O2')
          expect(r.products.map((s) => s.formula)).toEqual(['CO2', 'H2O'])
          break
      }
    }
  })

  it('the predict pools agree with the series and the table', () => {
    for (const id of [...PREDICT_COMBINATION, ...PREDICT_DECOMPOSITION, ...PREDICT_DOUBLE]) expect(() => reactionOf(id)).not.toThrow()
    for (const id of PREDICT_COMBINATION) expect(reactionOf(id).reactants.every((s) => elementOfFormula(s.formula)), id).toBe(true)
    for (const id of PREDICT_DECOMPOSITION) expect(reactionOf(id).products.every((s) => elementOfFormula(s.formula)), id).toBe(true)
    for (const entry of PREDICT_SINGLE) {
      const r = reactionOf(entry.id)
      const compound = r.reactants[1]!.formula
      expect(reactsWith(elementOfFormula(r.reactants[0]!.formula)!, compound), entry.id).toBe(true)
      for (const idle of entry.idle) expect(reactsWith(idle, compound), `${idle} + ${compound}`).toBe(false)
    }
    expect(typesPool('combination').some((id) => reactionOf(id).reactants.some((s) => s.formula === 'O2'))).toBe(false)
    expect(wordPool().length).toBeGreaterThanOrEqual(40)
  })

  it('no reserved example species is in the table', () => {
    for (const r of REACTIONS) for (const s of speciesOf(r)) expect((RX_RESERVED_FORMULAS as readonly string[]).includes(s.formula), s.formula).toBe(false)
  })
})

describe.each(TEMPLATE_IDS)('%s over 300 seeds', (templateId) => {
  it(
    'is deterministic, re-grades its own answers, and every trap grades as its id',
    () => {
      for (const seed of SEEDS.slice(0, 40)) expect(JSON.stringify(answerOf(templateId, seed))).toBe(JSON.stringify(sweep(templateId)[seed - 1]))
      for (const a of sweep(templateId)) {
        for (const stage of a.stages) {
          expect(gradeRxStage(a, stage.id, stage.answerText).verdict).toBe('correct')
          for (const trap of stage.traps) {
            const g = gradeRxStage(a, stage.id, trap.text)
            expect(g.verdict === 'mistake' && g.mistake, `${a.prompt} ${trap.text}`).toBe(trap.id)
          }
        }
        if (a.trap) {
          const g = gradeRxStage(a, a.trapStage!, a.trapAnswer!)
          expect(g.verdict === 'mistake' && g.mistake).toBe(a.trap)
        }
      }
    },
    HEAVY,
  )

  it(
    'never shows an answer in the prompt, never draws a reserved species, and reads as English',
    () => {
      for (const a of sweep(templateId)) {
        for (const reserved of RX_RESERVED_FORMULAS) expect(rxLeaks(a.prompt, reserved), `${a.prompt} ${reserved}`).toBe(false)
        for (const stage of a.stages) {
          for (const answer of [stage.answerText, ...(stage.accept ?? [])]) {
            expect(rxLeaks(a.prompt, answer), `${a.prompt} | ${answer}`).toBe(false)
            expect(rxLeaks(stage.hint, answer)).toBe(false)
            expect(rxLeaks(stage.nudge, answer)).toBe(false)
          }
        }
        const visible = [a.prompt, ...a.stages.flatMap((s) => [s.label, s.hint, s.nudge, ...(s.choices ?? []).map((c) => c.text), ...s.reveal])]
        for (const text of visible) {
          expect(text).not.toMatch(/\[object|undefined|\bNaN\b/)
          expect(text).not.toMatch(/\b[Aa]n? \d/)
        }
      }
    },
    HEAVY,
  )

  it(
    'gives at least 40 different statements over seeds 1..60',
    () => {
      const prompts = new Set(sweep(templateId).slice(0, 60).map((a) => a.prompt))
      expect(prompts.size).toBeGreaterThanOrEqual(40)
    },
    HEAVY,
  )

  it(
    'no typed answer exceeds a tenth of the seeds, no right choice 60 % of a choice part',
    () => {
      const typed = new Map<string, Map<string, number>>()
      const chosen = new Map<string, Map<string, number>>()
      const seen = new Map<string, number>()
      for (const a of sweep(templateId)) {
        a.stages.forEach((stage, i) => {
          const key = `${i}`
          const bucket = stage.kind === 'choice' ? chosen : typed
          const m = bucket.get(key) ?? new Map<string, number>()
          m.set(stage.answerText, (m.get(stage.answerText) ?? 0) + 1)
          bucket.set(key, m)
          if (stage.kind === 'choice') seen.set(key, (seen.get(key) ?? 0) + 1)
        })
      }
      for (const [key, m] of typed) {
        const [top, n] = [...m.entries()].sort((x, y) => y[1] - x[1])[0]!
        expect(n, `${templateId} part ${key}: ${top}`).toBeLessThanOrEqual(30)
      }
      for (const [key, m] of chosen) {
        const [top, n] = [...m.entries()].sort((x, y) => y[1] - x[1])[0]!
        expect(n / seen.get(key)!, `${templateId} part ${key}: ${top}`).toBeLessThanOrEqual(0.6)
      }
    },
    HEAVY,
  )
})

describe('shares and coverage', () => {
  it(
    'each reaction type is 12-30 % of rx.types; reacts and no reaction are each at least 30 % of tube questions',
    () => {
      const types = new Map<string, number>()
      for (const a of sweep('rx.types')) types.set(a.stages[0]!.answerText, (types.get(a.stages[0]!.answerText) ?? 0) + 1)
      expect(types.size).toBe(5)
      for (const [type, n] of types) {
        expect(n / 300, type).toBeGreaterThanOrEqual(0.12)
        expect(n / 300, type).toBeLessThanOrEqual(0.3)
      }
      const tubes = sweep('rx.predict').flatMap((a) => a.stages.filter((s) => s.check.kind === 'reacts'))
      expect(tubes.length).toBeGreaterThan(40)
      const yes = tubes.filter((s) => s.answerText === REACTS_TEXT.yes).length
      expect(yes / tubes.length).toBeGreaterThanOrEqual(0.3)
      expect((tubes.length - yes) / tubes.length).toBeGreaterThanOrEqual(0.3)
    },
    HEAVY,
  )

  it(
    'every rx_ id is promised on some seed, and the reused nm_charges_unbalanced is a trap on some part',
    () => {
      const promised = new Set<string>()
      const trapped = new Set<string>()
      for (const id of TEMPLATE_IDS) {
        for (const a of sweep(id)) {
          if (a.trap) promised.add(a.trap)
          for (const s of a.stages) for (const t of s.traps) trapped.add(t.id)
        }
      }
      expect(RX_MISTAKE_IDS.filter((id) => !promised.has(id))).toEqual([])
      expect(trapped.has('nm_charges_unbalanced')).toBe(true)
    },
    HEAVY,
  )

  it(
    'every seed with a possible trap promises one, and most seeds have one',
    () => {
      for (const id of TEMPLATE_IDS) {
        const all = sweep(id)
        for (const a of all) if (a.stages.some((s) => s.traps.length > 0)) expect(a.trap, `${id}: ${a.prompt}`).toBeTruthy()
        expect(all.filter((a) => a.trap).length / all.length, id).toBeGreaterThanOrEqual(id === 'rx.types' ? 0.7 : 0.9)
      }
    },
    HEAVY,
  )
})
