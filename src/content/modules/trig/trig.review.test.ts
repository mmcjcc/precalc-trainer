/**
 * Lessons from the earlier reviews, for the first half of Unit 4 (angles and the unit circle):
 *  - no catalog example or lesson, rule card, format hint or instruction contains an answer any template generates
 *    (2000 seeds per template);
 *  - before a part is answered, nothing she can see (its question, hint, nudge, the sentences and catalog entries of
 *    its slips, its plain note) spells that part's answer or a later one, and neither does any message she can retry
 *    on (a note for an unreadable answer, a form that is not simplest, a decimal, the wrong unit), counting an answer
 *    that ends a sentence ("… = −1/2.");
 *  - every equal exact form, and every correctly rounded decimal, is right.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { RuleCard, TrigPart } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { TRIG_MISTAKE_IDS } from '@/engine/trig'
import type { ModuleId } from '@/shared/types'
import { AM_HINTS, AM_INSTRUCTIONS, AM_RULES } from '../angleMeasure'
import { UC_HINTS, UC_INSTRUCTIONS, UC_RULES } from '../unitCircle'
import { answerForms, gradeTrigPart, partCatalogTexts, partShownTexts } from './parts'
import { plain, showsAnswer } from './text'
import { trigAnswerOf } from './testkit'

const SWEEP = 2000
const LOOP_TIMEOUT = 120_000

const cardTexts = (cards: readonly RuleCard[]) => cards.flatMap((c) => [c.title, c.body, c.example ?? ''])

const TEMPLATES: [ModuleId, string, readonly RuleCard[], readonly string[], readonly string[]][] = [
  ['angleMeasure', 'am.convert', AM_RULES, AM_HINTS, Object.values(AM_INSTRUCTIONS)],
  ['angleMeasure', 'am.coterminal', AM_RULES, AM_HINTS, Object.values(AM_INSTRUCTIONS)],
  ['angleMeasure', 'am.reference', AM_RULES, AM_HINTS, Object.values(AM_INSTRUCTIONS)],
  ['angleMeasure', 'am.arc', AM_RULES, AM_HINTS, Object.values(AM_INSTRUCTIONS)],
  ['unitCircle', 'uc.exact', UC_RULES, UC_HINTS, Object.values(UC_INSTRUCTIONS)],
  ['unitCircle', 'uc.point', UC_RULES, UC_HINTS, Object.values(UC_INSTRUCTIONS)],
]

/** Answers she might type that are not attempts, or are wrong, so the messages beside a retry can be read. */
function retryInputs(part: TrigPart): string[] {
  const out = ['', '???', 'sin(30)', 'x/r', '1/0', '∞', '(5π/6', '2 3']
  if (part.kind === 'angle') out.push('150°', '2.618', '7π', '1.5', '0.25π', 'π - π/6', '1000', '1/√2')
  if (part.kind === 'value') out.push('0.866', '1/√2', '√12/2', '√4', '2√3/6', '√2√3', '30°', 'cot θ = 1', 'π/6', '0.123', '5 rad', '1 + √3')
  if (part.kind === 'decimal') out.push('7π/9', '1', '0.1', '12345.6', '2.5°', '2.5 rad', '√2')
  if (part.kind === 'choice') out.push('Q9')
  return out
}

describe('trig catalog entries and cards', () => {
  it('every trig_ id has an entry; examples and lessons write numbers as words, so no special value appears', () => {
    for (const id of TRIG_MISTAKE_IDS) {
      const e = ERROR_PATTERNS[id]
      expect(e.example, id).toMatch(/✗ →/)
      expect(`${e.lesson} ${e.example}`, id).not.toMatch(/undefined|√[23]|\b1\/2\b/)
    }
  })

  it('rule cards say how, never a value: no special value, no "undefined", and only the fixed numbers of a turn', () => {
    for (const card of [...AM_RULES, ...UC_RULES]) {
      const text = `${card.title} ${card.body} ${card.example ?? ''}`
      expect(text, card.id).not.toMatch(/undefined|√[23]\b|\b1\/2\b|√2\/2|√3\/2/)
    }
  })
})

describe.each(TEMPLATES)('%s/%s texts over 2000 seeds', (moduleId, templateId, cards, hints, instructions) => {
  it(
    'no example, card, hint, instruction, early text or retry message spells an answer; every slip is a trig_ id',
    () => {
      const clashes: string[] = []
      const named = new Set<string>()
      const fixed = [...cardTexts(cards), ...hints, ...instructions]
      for (let seed = 1; seed <= SWEEP && clashes.length < 12; seed++) {
        const p = generateProblem(moduleId, templateId, seed)
        const a = trigAnswerOf(p)
        const all = a.stages.flatMap(answerForms)
        // On screen whatever the part: the cards, the hints, the instructions, the prompt and the figure's words.
        for (const text of [...fixed, p.instructions, a.prompt, a.figure.ariaLabel, a.figure.label]) if (showsAnswer([text], all)) clashes.push(`${p.id}: “${plain(text)}” spells ${all.join(' | ')}`)
        a.stages.forEach((part, i) => {
          const later = a.stages.slice(i).flatMap(answerForms)
          for (const text of [...partShownTexts(part), ...partCatalogTexts(part)]) if (showsAnswer([text], later)) clashes.push(`${p.id} ${part.id}: “${plain(text)}” spells ${later.join(' | ')}`)
          for (const typed of retryInputs(part)) {
            const g = gradeTrigPart(part, typed)
            const said = g.verdict === 'mistake' ? g.witness : g.message
            if (g.verdict !== 'correct' && showsAnswer([said], later)) clashes.push(`${p.id} ${part.id}: “${typed}” → “${said}” spells ${later.join(' | ')}`)
          }
          for (const trap of part.traps) named.add(trap.id)
        })
      }
      expect(clashes).toEqual([])
      for (const id of named) expect((TRIG_MISTAKE_IDS as readonly string[]).includes(id), id).toBe(true)
    },
    LOOP_TIMEOUT,
  )
})

describe.each(TEMPLATES)('%s/%s: every equal exact form and every correctly rounded decimal is right', (moduleId, templateId) => {
  it(
    'over 300 seeds',
    () => {
      for (let seed = 1; seed <= 300; seed++) {
        const a = trigAnswerOf(generateProblem(moduleId, templateId, seed))
        for (const part of a.stages) {
          const c = part.check
          const right: string[] = []
          if (c.kind === 'decimal') {
            // More places than asked are right too, and so is a unit word.
            right.push(c.value.toFixed(c.places + 1), c.value.toFixed(c.places + 3), `${part.answerText} ${c.units?.[0] ?? ''}`.trim())
          }
          if (c.kind === 'angle' && c.unit === 'deg') right.push(`${part.answerText} degrees`, `${part.answerText}°`)
          if (c.kind === 'angle' && c.unit === 'rad') right.push(`${part.answerText} radians`, part.answerText.replace('π', 'pi'), `(${part.answerText})`)
          // A name before the value: r, the function the box is for, or s and A for an arc or a sector.
          const name = part.id === 'r' ? 'r' : c.kind === 'value' && c.fn ? `${c.fn} θ` : 's'
          if (c.kind === 'value' && part.answerText !== 'undefined') right.push(`(${part.answerText})`, `${name} = ${part.answerText}`, part.answerText.replace(/√(\d+)/, 'sqrt($1)'))
          if (c.kind === 'value' && part.answerText === 'undefined') right.push('DNE', 'does not exist', 'Undefined')
          for (const t of right) {
            const g = gradeTrigPart(part, t)
            expect(g.verdict, `${templateId}/${seed} ${part.id}: “${t}”${g.verdict === 'invalid' || g.verdict === 'wrong' ? ` — ${g.message}` : ''}`).toBe('correct')
          }
        }
      }
    },
    LOOP_TIMEOUT,
  )
})
