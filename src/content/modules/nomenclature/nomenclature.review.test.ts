/**
 * Format hints, rule-card examples and the example lines of named mistakes are on screen while she can still act.
 * None may contain an answer any template can generate for that kind of part, nor seed 1's answer (the idea of
 * geometry.review.test.ts). Rule cards are open in the Rule cards panel on every problem of their module, so their
 * examples may contain no answer of any kind of part that module asks. A card that lists the whole table (the
 * polyatomic ion reference) singles out nothing and is fine.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { NmPartKind, NomenclatureAnswer } from '@/content/types'
import { NM_MISTAKE_IDS, POLYATOMIC_IONS, formulaDisplay } from '@/engine'
import { rungTwoCards } from './check'
import { examplesFor, nmShown } from './feedback'
import { HINTS, NM_TEMPLATES } from './generate'
import { gradeNmStage } from './grade'
import { leaksTo, stageKeys } from './leaks'
import { halogenFamilyReference, nmRule, NM_RULES, polyatomicReference } from './rules'
import { NM_PART_KINDS, showsAnyAnswer } from './universe'
import { getModule, getTemplate } from '@/content/registry'

const HEAVY = 120_000

function answerOf(moduleId: string, templateId: string, seed: number): NomenclatureAnswer {
  const p = generateProblem(moduleId as never, templateId, seed)
  if (p.answer.type !== 'nomenclature') throw new Error(`${templateId}/${seed} is ${p.answer.type}`)
  return p.answer
}

/** The kinds of part each template asks. */
const PARTS: Readonly<Record<string, readonly NmPartKind[]>> = {
  'nm.ion': ['ion-name', 'ion-formula'],
  'nm.ionicFormula': ['ion-formula', 'ionic-formula'],
  'nm.ionicName': ['ionic-name'],
  'nm.ionicFromName': ['ionic-formula'],
  'nm.molecular': ['molecular-name', 'molecular-formula'],
  'nm.acid': ['acid-name', 'acid-formula'],
  'nm.hydrate': ['hydrate-name', 'hydrate-formula'],
  'nm.classify': ['class'],
}

/** Seed 1's answers in every form, per template: no example or hint anywhere may show them. */
function seedOneAnswers(): string[] {
  const out: string[] = []
  for (const { moduleId, templateId } of NM_TEMPLATES)
    for (const s of answerOf(moduleId, templateId, 1).stages) {
      if (s.kind === 'choice') continue
      out.push(s.answerText, ...s.accept, ...(s.kind === 'name' ? [] : [formulaDisplay(s.answerText)]))
    }
  return out
}

function containsPlainly(text: string, answer: string): boolean {
  const t = text.toLowerCase()
  const a = answer.toLowerCase()
  for (let i = t.indexOf(a); i >= 0; i = t.indexOf(a, i + 1)) {
    const prev = t[i - 1]
    const next = t[i + a.length]
    const glued = (ch: string | undefined) => ch !== undefined && /[a-z0-9(₀-₉⁰-⁹⁺⁻·]/.test(ch)
    if (!glued(next) && !(prev !== undefined && /[a-z0-9₀-₉]/.test(prev))) return true
  }
  return false
}

describe('texts shown on every problem never contain an answer a template can generate', () => {
  it(
    'rule-card examples contain no answer of any kind of part their module asks, and not seed 1’s',
    () => {
      const seedOne = seedOneAnswers()
      for (const moduleId of ['ionicNames', 'molecularAcids'] as const) {
        const parts = NM_TEMPLATES.filter((t) => t.moduleId === moduleId).flatMap((t) => PARTS[t.templateId]!)
        for (const card of getModule(moduleId).ruleCards) {
          const example = card.example ?? ''
          for (const part of parts) expect(showsAnyAnswer(example, part), `${moduleId} ${card.id} on ${part}: ${example}`).toBe(false)
          for (const a of seedOne) expect(containsPlainly(example, a), `${card.id}: seed 1’s ${a}`).toBe(false)
        }
      }
      expect(NM_RULES.every((card) => getModule('ionicNames').ruleCards.includes(card) || getModule('molecularAcids').ruleCards.includes(card))).toBe(true)
    },
    HEAVY,
  )

  it(
    'format hints and instructions contain no answer of the kinds of part they sit with, and not seed 1’s',
    () => {
      const seedOne = seedOneAnswers()
      for (const hint of Object.values(HINTS)) {
        for (const part of NM_PART_KINDS) expect(showsAnyAnswer(hint, part), `${hint} on ${part}`).toBe(false)
        for (const a of seedOne) expect(containsPlainly(hint, a), `${hint}: seed 1’s ${a}`).toBe(false)
      }
      // The template's description (the module page) and its instructions (under the title of every problem).
      for (const { moduleId, templateId } of NM_TEMPLATES) {
        const texts = [getTemplate(moduleId, templateId).description, generateProblem(moduleId, templateId, 1).instructions]
        for (const text of texts) {
          for (const part of PARTS[templateId]!) expect(showsAnyAnswer(text, part), `${templateId} on ${part}: ${text}`).toBe(false)
          for (const a of seedOne) expect(containsPlainly(text, a), `${templateId}: seed 1’s ${a}`).toBe(false)
        }
      }
    },
    HEAVY,
  )

  it('every example line a slip can show on a kind of part contains no answer of that kind', () => {
    let shown = 0
    for (const id of NM_MISTAKE_IDS)
      for (const part of NM_PART_KINDS)
        for (const example of examplesFor(id, part)) {
          shown++
          expect(showsAnyAnswer(example, part), `${id} on ${part}: ${example}`).toBe(false)
        }
    expect(shown).toBeGreaterThan(100)
  }, HEAVY)

  it('the polyatomic ion reference is the textbook’s whole table, with the bromine and iodine families beside it', () => {
    const rows = polyatomicReference().flatMap((g) => g.rows)
    const textbook = POLYATOMIC_IONS.filter((r) => r.inTextbook)
    expect(rows).toHaveLength(textbook.length)
    for (const r of textbook) expect(rows.some((row) => row.formula === r.formula && row.charge === r.charge), r.name).toBe(true)
    expect(polyatomicReference().map((g) => g.charge)).toEqual(['1−', '2−', '3−', '1+', '2+'])
    expect(rows.find((r) => r.formula === 'SO4')).toMatchObject({ name: 'sulfate', display: 'SO₄²⁻', charge: -2 })
    expect(rows.find((r) => r.formula === 'Hg2')?.name).toBe('mercury(I) (dimercury)')
    expect(halogenFamilyReference().map((r) => r.name).sort()).toEqual(['bromite', 'hypobromite', 'hypoiodite', 'iodate', 'iodite', 'perbromate', 'periodate'])
  })
})

describe.each(NM_TEMPLATES)('$templateId over 2000 seeds', ({ moduleId, templateId }) => {
  it(
    'no hint, example line or rung-2 card shows an answer of that kind of part, nor this part’s answer',
    () => {
      const clashes: string[] = []
      for (let seed = 1; seed <= 2000; seed++) {
        const a = answerOf(moduleId, templateId, seed)
        for (const stage of a.stages) {
          const keys = stageKeys(stage)
          const at = `${templateId}/${seed} ${stage.id}=${stage.answerText}`
          if (showsAnyAnswer(stage.hint, stage.part) || leaksTo(stage.hint, keys)) clashes.push(`${at}: hint`)
          for (const id of rungTwoCards(a, stage)) {
            const card = nmRule(id)
            if (leaksTo(`${card.title} ${card.body} ${card.example ?? ''}`, keys)) clashes.push(`${at}: card ${id}`)
          }
          for (const trap of stage.traps) {
            const shown = nmShown(stage, gradeNmStage(a, stage.id, trap.text), trap.text)
            if (shown.kind !== 'mistake') continue
            if (shown.example && (showsAnyAnswer(shown.example, stage.part) || leaksTo(shown.example, keys, trap.text))) clashes.push(`${at}: ${trap.id} example "${shown.example}"`)
            for (const text of [shown.title, shown.lesson, shown.witness]) if (leaksTo(text, keys, trap.text)) clashes.push(`${at}: ${trap.id} "${text}"`)
          }
        }
      }
      expect(clashes.slice(0, 12)).toEqual([])
    },
    HEAVY,
  )
})
