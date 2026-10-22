/**
 * Lessons from the earlier reviews, for optimization with quadratics:
 *  - no catalog example or lesson, rule card, format hint or instruction contains an answer any template generates
 *    (2000 seeds per template, in four runs of 500);
 *  - before a part is answered, nothing she can see (its question, hint, nudge, the sentences and catalog entries of
 *    its slips, its plain note) spells that part's answer or a later one, on either route, and neither does any
 *    message she can retry on (a note for an unreadable answer, a unit of the wrong kind, a rounding not asked for, an
 *    equation of the wrong kind), counting an answer that ends a sentence ("… is 31250.");
 *  - every equivalent equation and every correctly rounded number is right.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { OptimizationAnswer, OptPart } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { exactFromText, OPT_MISTAKE_IDS } from '@/engine/optim'
import { answerForms, gradeOptPart, partCatalogTexts, partShownTexts, stagesFor } from './parts'
import { OPT_RULES } from './rules'
import { optAnswerOf } from './testkit'
import { answerMatcher, plain } from './text'
import { OPT_HINTS } from './words'

const LOOP_TIMEOUT = 120_000
const TEMPLATES = ['opt.wall', 'opt.pens', 'opt.numbers', 'opt.revenue'] as const

const FIXED = [...OPT_RULES.flatMap((c) => [c.title, c.body, c.example ?? '']), ...OPT_HINTS, ...OPT_MISTAKE_IDS.flatMap((id) => [ERROR_PATTERNS[id].title, ERROR_PATTERNS[id].lesson, ERROR_PATTERNS[id].example])]

describe.each(TEMPLATES)('%s: no card, hint, catalog entry or instruction spells an answer', (templateId) => {
  for (const [from, to] of [
    [1, 500],
    [501, 1000],
    [1001, 1500],
    [1501, 2000],
  ] as const) {
    it(
      `seeds ${from}–${to}`,
      () => {
        const clashes: string[] = []
        for (let seed = from; seed <= to && clashes.length < 10; seed++) {
          const p = generateProblem('optimization', templateId, seed)
          const a = optAnswerOf(p)
          const all = [...a.stages, ...a.yStages].flatMap(answerForms)
          const shows = answerMatcher(all)
          for (const text of [...FIXED, p.instructions]) if (text && shows(text)) clashes.push(`${p.id}: “${plain(text)}” spells an answer`)
        }
        expect(clashes).toEqual([])
      },
      LOOP_TIMEOUT,
    )
  }
})

/** Answers she might type that are not attempts, or are wrong, so the messages beside a retry can be read. */
function retryInputs(part: OptPart): string[] {
  const out = ['', '???', '(', '1/0', '2 3']
  if (part.kind === 'equation') out.push('2x + y', 'A = lw', 'f(x) = 3x', 'Y1 = 3x', 'A = xy = 5', '2x + y <= 7', 'x + y = y + x', 'A = 7', 'P = 7', 'R = 7', 'S = 7', 'y = 3x + 1', 'A = 2x^2 + 7x', 'x = 7', 'A = xyz')
  else out.push('0.5', '12.345', '12.3', '7', 'x(9 - 2x)', '7 ft^2', '7 ft', '7 inches', 'y = 7', 'x = 7', '$7', '7 dollars', '7 tickets', 'sqrt(-1)', '1000000', '-7', '7/9', '3 1/3')
  return out
}

describe.each(TEMPLATES)('%s: early texts and the messages she can retry on, both routes, 300 seeds', (templateId) => {
  it(
    'never spell the part’s answer or a later one',
    () => {
      const clashes: string[] = []
      for (let seed = 1; seed <= 300 && clashes.length < 10; seed++) {
        const a = optAnswerOf(generateProblem('optimization', templateId, seed))
        for (const route of ['x', 'y'] as const) {
          const stages = stagesFor(a, route)
          stages.forEach((part, i) => {
            const later = stages.slice(i).flatMap(answerForms)
            const shows = answerMatcher(later)
            for (const text of [...partShownTexts(part), ...partCatalogTexts(part)]) if (shows(text)) clashes.push(`${a.question}/${seed} ${route} ${part.id}: “${plain(text)}”`)
            for (const typed of retryInputs(part)) {
              const g = gradeOptPart(a, part, typed)
              if (g.verdict === 'correct') continue
              const said = g.verdict === 'mistake' ? g.witness : g.message
              if (shows(said)) clashes.push(`${a.question}/${seed} ${route} ${part.id}: “${typed}” → “${plain(said)}”`)
            }
          })
        }
      }
      expect(clashes).toEqual([])
    },
    LOOP_TIMEOUT,
  )
})

/** Equal forms of an equation part she might write, made from the part's own answer. */
function equivalentEquations(a: OptimizationAnswer, part: OptPart): string[] {
  const c = part.check
  const Q = a.quantity
  if (c.kind === 'constraint') {
    // 2x + y = 500 as 3 times itself, with the sides swapped, and moved to one side.
    const [l, r] = c.equation.split(' = ')
    return [`3(${l}) = 3(${r})`, `${r} = ${l}`, `${l} - (${r}) = 0`, `(${l})/2 = (${r})/2`]
  }
  if (c.kind === 'primary') {
    const rhs = c.equation.split(' = ')[1]!
    return [`${rhs} = ${Q}`, `${Q}/2 = (${rhs})/2`, `${Q} - (${rhs}) = 0`, `2${Q} = 2(${rhs})`]
  }
  if (c.kind === 'final') {
    const fx = c.x.split(' = ')[1]!
    const fy = c.y.split(' = ')[1]!
    return [`${fx} = ${Q}`, `${Q}(x) = ${fx}`, `${Q} = (2(${fx}))/2`, `${Q} = ${fy}`, `${Q}(y) = ${fy}`]
  }
  return []
}

/** Right spellings of a number part: exact forms, more places than asked, with the unit. */
function equivalentNumbers(a: OptimizationAnswer, part: OptPart): string[] {
  const c = part.check
  if (c.kind !== 'number') return []
  const v = exactFromText(c.value, a.units)
  const value = v.n / v.d
  const unit = c.dim === 'length' ? ` ${a.units.lengthUnit}` : c.dim === 'area' ? ` ${a.units.lengthUnit}^2` : c.dim === 'count' ? ` ${a.units.count?.[0] ?? ''}` : ''
  const needs = c.dim === 'area' ? unit : ''
  const out = [`${v.n}/${v.d}${needs}`, `(${v.n})/(${v.d})${needs}`]
  if (c.places !== undefined) out.push(`${value.toFixed(c.places + 1)}${needs}`, `${value.toFixed(c.places + 2)}${needs}`)
  if (c.dim !== 'none' && c.dim !== 'money') out.push(`${c.value}${unit}`)
  if (c.dim === 'money') out.push(`$${value.toFixed(2)}`, `${value.toFixed(2)} dollars`)
  out.push(`${c.name} = ${c.value}${needs}`)
  return out
}

describe.each(TEMPLATES)('%s: every equal equation and every correct rounding is right', (templateId) => {
  it(
    'over 300 seeds, both routes',
    () => {
      const wrong: string[] = []
      for (let seed = 1; seed <= 300 && wrong.length < 10; seed++) {
        const a = optAnswerOf(generateProblem('optimization', templateId, seed))
        for (const route of ['x', 'y'] as const) {
          for (const part of stagesFor(a, route)) {
            for (const t of [...equivalentEquations(a, part), ...equivalentNumbers(a, part)]) {
              const g = gradeOptPart(a, part, t)
              if (g.verdict !== 'correct') wrong.push(`${a.question}/${seed} ${route} ${part.id}: “${t}” → ${g.verdict}${g.verdict === 'invalid' || g.verdict === 'wrong' ? `: ${g.message}` : ''}`)
            }
          }
        }
      }
      expect(wrong).toEqual([])
    },
    LOOP_TIMEOUT,
  )
})
