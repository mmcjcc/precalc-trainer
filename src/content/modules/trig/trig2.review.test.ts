/**
 * Lessons from the earlier reviews, for the second half of Unit 4 (right triangles, one value and the quadrant, every
 * angle in one turn), with the second half's leak matcher (showsNumber: √ and π belong to the number they touch):
 *  - no catalog example or lesson, rule card, format hint or instruction contains an answer any of these templates
 *    generates (2000 seeds per template);
 *  - before a part is answered, nothing she can see (the prompt, the figure's labels as they stand then, its question,
 *    hint, nudge, the sentences and catalog entries of its slips, its plain note) spells that part's answer or a later
 *    one, and neither does any message she can retry on, counting an answer that ends a sentence ("… = 5√2.");
 *  - every equal exact form, every correctly rounded decimal, and every order and spelling of a list is right.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { RuleCard, TrigPart } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { TRIG_MISTAKE_IDS } from '@/engine/trig'
import type { ModuleId } from '@/shared/types'
import { RT_HINTS, RT_INSTRUCTIONS, RT_RULES } from '../rightTriangle'
import { UC_HINTS, UC_INSTRUCTIONS, UC_RULES } from '../unitCircle'
import { answerForms, figureTextsAt, gradeTrigPart, partCatalogTexts, partShownTexts } from './parts'
import { numberOf2 } from './resolve2'
import { plain, showsNumber } from './text'
import { trigAnswerOf } from './testkit'

const SWEEP = 2000
const LOOP_TIMEOUT = 120_000

const cardTexts = (cards: readonly RuleCard[]) => cards.flatMap((c) => [c.title, c.body, c.example ?? ''])

const TEMPLATES: [ModuleId, string, readonly RuleCard[], readonly string[], readonly string[]][] = [
  ['rightTriangle', 'rt.ratios', RT_RULES, RT_HINTS, Object.values(RT_INSTRUCTIONS)],
  ['rightTriangle', 'rt.special', RT_RULES, RT_HINTS, Object.values(RT_INSTRUCTIONS)],
  ['rightTriangle', 'rt.side', RT_RULES, RT_HINTS, Object.values(RT_INSTRUCTIONS)],
  ['rightTriangle', 'rt.angle', RT_RULES, RT_HINTS, Object.values(RT_INSTRUCTIONS)],
  ['unitCircle', 'uc.given', UC_RULES, UC_HINTS, Object.values(UC_INSTRUCTIONS)],
  ['unitCircle', 'uc.solve', UC_RULES, UC_HINTS, Object.values(UC_INSTRUCTIONS)],
]

/** Answers she might type that are not attempts, or are wrong, so the messages beside a retry can be read. */
function retryInputs(part: TrigPart): string[] {
  const out = ['', '???', 'sin(30)', 'x/r', '1/0', '∞', '(5', '2 3', 'undefined']
  const c = part.check
  if (part.kind === 'value') {
    out.push('0.866', '1/√2', '√12/2', '√4', '2√3/6', '√2√3', '30°', 'cot θ = 1', 'π/6', '5 rad', '1 + √3', '-1')
    // Her answer as a calculator decimal (to three places and to one), and with the other sign.
    const v = numberOf2(part.answerText)
    out.push(v.toFixed(3), v.toFixed(1), `-(${part.answerText})`)
  }
  if (part.kind === 'decimal' && c.kind === 'decimal') {
    out.push('7π/9', '√2', '12345.6', '2.5 rad', '2.5°', '1', '0.1', c.value.toFixed(Math.max(0, c.places - 1)), String(Math.round(c.value)), `${c.value.toFixed(c.places)} m`, `${c.value.toFixed(c.places)} km`)
  }
  if (part.kind === 'angles' && c.kind === 'angles') {
    const items = part.answerText.split(', ')
    out.push('240 300', '240, 240', '4π/3, 5π/3', '240°', '4.19, 5.24', 'π', '0, 1', items[0]!, `${items[0]!}, 1`)
    if (c.unit === 'deg') {
      // The same angles a full turn off, and one of them in a quadrant of the other sign.
      out.push(c.degs.map((d) => String(Number(d) - 360)).join(', '), c.degs.map((d) => String(360 - Number(d))).join(', '))
    } else out.push(c.degs.map((d) => `${Number(d) / 180 - 2}pi`).join(', '))
  }
  return out
}

describe('the second half’s catalog entries', () => {
  it('every new trig_ id has an entry in words: no special value, no digit but the degrees of a right angle and a turn', () => {
    // The second half's eighteen, up to where Unit 5's begin.
    const second = TRIG_MISTAKE_IDS.slice(TRIG_MISTAKE_IDS.indexOf('trig_opposite_adjacent_swapped'), TRIG_MISTAKE_IDS.indexOf('trig_amplitude_negative'))
    expect(second).toHaveLength(18)
    for (const id of second) {
      const e = ERROR_PATTERNS[id]
      expect(e.example, id).toMatch(/✗ →/)
      expect(`${e.lesson} ${e.example}`, id).not.toMatch(/undefined|√[23]|\b1\/2\b|\b(30|45|60)\b/)
    }
  })
})

describe.each(TEMPLATES)('%s/%s texts over 2000 seeds', (moduleId, templateId, cards, hints, instructions) => {
  it(
    'no example, card, hint, instruction, early text, figure label or retry message spells an answer; every slip is a trig_ id',
    () => {
      const clashes: string[] = []
      const named = new Set<string>()
      const fixed = [...cardTexts(cards), ...hints, ...instructions]
      for (let seed = 1; seed <= SWEEP && clashes.length < 12; seed++) {
        const p = generateProblem(moduleId, templateId, seed)
        const a = trigAnswerOf(p)
        const all = a.stages.flatMap(answerForms)
        for (const text of [...fixed, p.instructions, a.prompt, a.figure.ariaLabel]) if (showsNumber([text], all)) clashes.push(`${p.id}: “${plain(text)}” spells ${all.join(' | ')}`)
        a.stages.forEach((part, i) => {
          const later = a.stages.slice(i).flatMap(answerForms)
          for (const text of figureTextsAt(a, i)) if (showsNumber([text], later)) clashes.push(`${p.id} ${part.id}: the figure’s “${text}” spells ${later.join(' | ')}`)
          for (const text of [...partShownTexts(part), ...partCatalogTexts(part)]) if (showsNumber([text], later)) clashes.push(`${p.id} ${part.id}: “${plain(text)}” spells ${later.join(' | ')}`)
          for (const typed of retryInputs(part)) {
            const g = gradeTrigPart(part, typed)
            if (g.verdict === 'correct') continue
            const said = g.verdict === 'mistake' ? g.witness : g.message
            if (showsNumber([said], later)) clashes.push(`${p.id} ${part.id}: “${typed}” → “${said}” spells ${later.join(' | ')}`)
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

/** Spellings of a part's answer, other than its own forms, that grade right. */
function equalForms(part: TrigPart): string[] {
  const c = part.check
  const right: string[] = []
  if (c.kind === 'decimal') {
    right.push(c.value.toFixed(c.places + 1), c.value.toFixed(c.places + 3))
    if (c.units?.length) right.push(`${part.answerText} ${c.units[0]}`, `${part.answerText}${c.units[0]}`)
    if (c.unit === 'deg') right.push(`${part.answerText}°`, `${part.answerText} degrees`, `θ = ${part.answerText}`)
  }
  if (c.kind === 'value') {
    const name = part.id === 'side' ? 'c' : c.fn ? `${c.fn} θ` : part.id
    right.push(`(${part.answerText})`, `${name} = ${part.answerText}`, part.answerText.replace(/√(\d+)/, 'sqrt($1)'), part.answerText.replace(/√(\d+)/, '*sqrt($1)').replace(/^\*/, '').replace(/^-\*/, '-'))
  }
  if (c.kind === 'angles') {
    const items = part.answerText.split(', ')
    const rev = [...items].reverse()
    right.push(`{${part.answerText}}`, items.map((t) => `θ = ${t}`).join(', '), items.join(' and '), items.join(' or '), rev.join(','), `${part.answerText},`)
    if (c.unit === 'deg') right.push(items.map((t) => `${t}°`).join(', '), items.map((t) => `${t} degrees`).join('; '))
    else {
      // (k/n)π for each angle, read from the answer in degrees.
      right.push(
        c.degs
          .map((d) => {
            const n = Number(d)
            const g = gcd(n, 180)
            return `(${n / g}/${180 / g})π`
          })
          .join(', '),
      )
      right.push(part.answerText.replace(/π/g, 'pi').replace(/, /g, ' , '))
    }
  }
  return right
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : Math.abs(a)
}

describe.each(TEMPLATES)('%s/%s: every equal form, rounding and order is right', (moduleId, templateId) => {
  it(
    'over 300 seeds',
    () => {
      for (let seed = 1; seed <= 300; seed++) {
        const a = trigAnswerOf(generateProblem(moduleId, templateId, seed))
        for (const part of a.stages) {
          for (const t of [part.answerText, ...part.forms, ...equalForms(part)]) {
            const g = gradeTrigPart(part, t)
            expect(g.verdict, `${templateId}/${seed} ${part.id}: “${t}”${g.verdict === 'invalid' || g.verdict === 'wrong' ? ` — ${g.message}` : ''}`).toBe('correct')
          }
        }
      }
    },
    LOOP_TIMEOUT,
  )
})
