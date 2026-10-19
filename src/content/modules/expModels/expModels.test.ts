/**
 * Growth and decay word problems, every template over 300 seeds: deterministic, every answer grades right in
 * every spelling the problem allows, every trap is its own id and stands apart from the answer and from the
 * other traps at the rounding asked, the promised trap is one of them, the prompt says how to round, and
 * nothing she sees early spells an answer.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import type { ExpLogPart, ProblemInstance } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { partCatalogTexts, partShownTexts } from '../explog/parts'
import { anyShows, roundPlaces } from '../explog/text'
import { EM_RULES, gradeEmPart, type ExpModelsAnswer } from '.'

const SEEDS = 300
const LOOP_TIMEOUT = 120_000

function answerOf(p: ProblemInstance): ExpModelsAnswer {
  if (p.answer.type !== 'expModels') throw new Error(`${p.id} is not a growth or decay problem`)
  return p.answer
}

/** "2834.71" → "2,834.71": thousands commas in the whole-number part only. */
function group(plain: string): string {
  const [whole, frac] = plain.split('.')
  return `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${frac === undefined ? '' : `.${frac}`}`
}

/** Spellings she might type, written here: "$2,834.71", "2834.71", "2,834.71", "12.5 years", "t = 12.5". */
function spellings(part: ExpLogPart): string[] {
  const plain = part.answerText.replace(/,/g, '')
  const grouped = group(plain)
  if (part.kind === 'exact') return [part.answerText]
  const out = [plain, grouped]
  if (part.money) out.push(`$${grouped}`, `$${plain}`)
  else out.push(`t = ${plain}`)
  if (part.units?.length) out.push(`${plain} ${part.units[0]}`)
  return out
}

/** The answer forms the leak check looks for. */
function forms(part: ExpLogPart): string[] {
  const plain = part.answerText.replace(/,/g, '')
  return part.kind === 'exact' ? [part.answerText] : [plain, group(plain)]
}

const cardTexts = EM_RULES.flatMap((r) => [r.title, r.body, r.example ?? ''])

describe('expModels module', () => {
  it('registers three templates after the graphs module, with its own rule cards', () => {
    const mod = getModule('expModels')
    expect(mod.title).toBe('Exponential growth and decay')
    expect(mod.templates.map((t) => t.id)).toEqual(['em.interest', 'em.halflife', 'em.growth'])
    expect(mod.order).toBeGreaterThan(getModule('expLogGraphs').order)
    expect(mod.ruleCards).toBe(EM_RULES)
  })
})

describe.each(['em.interest', 'em.halflife', 'em.growth'] as const)('expModels/%s over 300 seeds', (templateId) => {
  it(
    'is deterministic, grades every spelling and trap, keeps traps apart at the rounding, and hides the answers',
    () => {
      const statements = new Set<string>()
      const answers = new Map<string, number>()
      const promised = new Set<string>()
      for (let seed = 1; seed <= SEEDS; seed++) {
        const p = generateProblem('expModels', templateId, seed)
        expect(generateProblem('expModels', templateId, seed), p.id).toEqual(p)
        const a = answerOf(p)
        expect(p.kind).toBe('expModels')
        expect(p.statementText).toBe(a.prompt)
        // The textbook sentence says how to round (or, for k, that it is exact).
        expect(a.prompt, p.id).toMatch(templateId === 'em.growth' ? /P = P₀e\^\(kt\)/ : /Round to the nearest (cent|tenth|hundredth|year)/)
        for (const part of a.stages) {
          expect(part.ask, `${p.id} ${part.id}`).toMatch(part.kind === 'exact' ? /exact/ : /Round/)
          for (const form of spellings(part)) {
            const g = gradeEmPart(a, part.id, form)
            expect(g.verdict, `${p.id} ${part.id} “${form}”: ${g.verdict === 'correct' ? '' : JSON.stringify(g)}`).toBe('correct')
          }
          const values: number[] = []
          for (const trap of part.traps) {
            expect(ERROR_PATTERNS[trap.id], trap.id).toBeTruthy()
            const g = gradeEmPart(a, part.id, trap.text)
            expect(g.verdict === 'mistake' ? g.mistake : g.verdict, `${p.id} ${part.id} trap ${trap.id} “${trap.text}”`).toBe(trap.id)
            values.push(...(trap.values ?? []))
          }
          if (part.kind === 'decimal') {
            // Every trap differs from the answer, and from the other traps, at the rounding asked.
            const right = (part.closedForms ?? []).length
            expect(right, p.id).toBeGreaterThan(0)
            const answer = Number(part.answerText.replace(/,/g, ''))
            const rounded = values.map((v) => roundPlaces(v, part.places ?? 0))
            expect(rounded, `${p.id} ${part.id}`).not.toContain(roundPlaces(answer, part.places ?? 0))
            for (let i = 0; i < values.length; i++) {
              for (let j = i + 1; j < values.length; j++) {
                const sameTrap = part.traps.some((t) => (t.values ?? []).includes(values[i]!) && (t.values ?? []).includes(values[j]!))
                if (!sameTrap) expect(rounded[i], `${p.id} ${part.id} traps ${i} and ${j}`).not.toBe(rounded[j])
              }
            }
          }
        }
        const stage = a.stages.find((s) => s.id === a.trapStage)
        expect(stage?.traps.some((t) => t.id === a.trap && t.text === a.trapAnswer), `${p.id} promised ${a.trap}`).toBe(true)
        expect(a.trap.startsWith('exp_'), p.id).toBe(true)
        const g = gradeEmPart(a, a.trapStage, a.trapAnswer)
        expect(g.verdict === 'mistake' && g.mistake, p.id).toBe(a.trap)
        a.stages.forEach((part, i) => {
          const later = a.stages.slice(i).flatMap(forms)
          const shown = [p.instructions, a.prompt, ...cardTexts, ...partShownTexts(part), ...partCatalogTexts(part)]
          expect(shown.filter((text) => anyShows([text], later)), `${p.id} ${part.id}`).toEqual([])
        })
        statements.add(a.prompt)
        answers.set(a.expectedDisplay, (answers.get(a.expectedDisplay) ?? 0) + 1)
        promised.add(a.trap)
      }
      expect(statements.size, templateId).toBeGreaterThanOrEqual(25)
      expect(Math.max(...answers.values()), templateId).toBeLessThanOrEqual(SEEDS / 10)
      const want: Record<string, string[]> = {
        'em.interest': ['exp_wrong_period', 'exp_simple_interest', 'exp_continuous_swapped', 'exp_exponent_missing'],
        'em.halflife': ['exp_halflife_inverted', 'exp_halflife_base', 'exp_halflife_decayed'],
        'em.growth': ['exp_growth_no_log', 'exp_growth_log_diff', 'exp_growth_swapped'],
      }
      for (const id of want[templateId]!) expect(promised, id).toContain(id)
    },
    LOOP_TIMEOUT,
  )
})
