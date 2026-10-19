/**
 * Lessons from the earlier reviews, for the second half of Unit 3 (graphs, inverses, growth and decay):
 *  - no catalog example, rule card, format hint or instruction contains an answer any template generates
 *    (2000 seeds per template);
 *  - before a part is answered, nothing she can see (its question, hint, nudge, the sentences and the catalog
 *    entries of its slips, the plain note) spells that part's answer or a later one;
 *  - every exp_ id has a warm catalog entry, and the ids the templates name are exactly those entries.
 * The sweep only generates and reads texts; it does not grade.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { ExpLogPart, ProblemInstance } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import type { ErrorPatternId, ModuleId } from '@/shared/types'
import { partCatalogTexts, partShownTexts } from './explog/parts'
import { anyShows } from './explog/text'
import { CHOICE_HINT, EG_INSTRUCTIONS, EG_RULES, FORMULA_HINT, INTERVAL_HINT, LINE_HINT, POINT_HINT } from './expLogGraphs'
import { EM_INSTRUCTIONS, EM_RULES, EXACT_HINT, MONEY_HINT, NUMBER_HINT } from './expModels'

const SWEEP = 2000
const LOOP_TIMEOUT = 120_000

const SECOND_HALF_IDS: ErrorPatternId[] = [
  'exp_asymptote_unshifted',
  'exp_shift_sign',
  'exp_sign_of_a',
  'exp_endpoint_closed',
  'exp_domain_range_swapped',
  'exp_asymptote_axis',
  'exp_intercept_shift',
  'exp_base_direction',
  'exp_inverse_shift',
  'exp_inverse_base_swapped',
  'exp_inverse_reciprocal',
  'exp_rate_percent',
  'exp_wrong_period',
  'exp_simple_interest',
  'exp_continuous_swapped',
  'exp_exponent_missing',
  'exp_halflife_inverted',
  'exp_halflife_base',
  'exp_halflife_decayed',
  'exp_growth_no_log',
  'exp_growth_log_diff',
  'exp_growth_swapped',
]

/** Spellings of a part's answer that would give it away: the canonical text and its other common forms. */
function formsOf(part: ExpLogPart): string[] {
  if (part.kind === 'choice') return []
  const a = part.answerText
  if (part.kind === 'interval') {
    if (a === '(-inf, inf)') return [a, '(-∞, ∞)', 'all real numbers']
    const lo = /^\((-?\d+), inf\)$/.exec(a)
    const hi = /^\(-inf, (-?\d+)\)$/.exec(a)
    const letter = part.id === 'range' ? 'y' : 'x'
    return [a, a.replace(/inf/g, '∞'), ...(lo ? [`${letter} > ${lo[1]}`] : []), ...(hi ? [`${letter} < ${hi[1]}`] : [])]
  }
  if (part.kind === 'decimal') {
    const plain = a.replace(/,/g, '')
    const [whole, frac] = plain.split('.')
    return [plain, `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${frac === undefined ? '' : `.${frac}`}`]
  }
  return [a]
}

const CARDS = [...EG_RULES, ...EM_RULES].flatMap((r) => [r.title, r.body, r.example ?? ''])
const HINTS = [INTERVAL_HINT, LINE_HINT, POINT_HINT, CHOICE_HINT, FORMULA_HINT, MONEY_HINT, NUMBER_HINT, EXACT_HINT, ...Object.values(EG_INSTRUCTIONS), ...Object.values(EM_INSTRUCTIONS)]
const EXAMPLES = SECOND_HALF_IDS.flatMap((id) => [ERROR_PATTERNS[id].example, ERROR_PATTERNS[id].lesson])

function stagesOf(p: ProblemInstance): ExpLogPart[] {
  if (p.answer.type === 'expLogGraphs' || p.answer.type === 'expModels') return p.answer.stages
  throw new Error(`${p.id} is not a second-half Unit 3 problem`)
}

describe('second-half Unit 3 catalog entries', () => {
  it('every exp_ id has a title, a lesson in the warm voice, and a wrong → right example', () => {
    for (const id of SECOND_HALF_IDS) {
      const e = ERROR_PATTERNS[id]
      expect(e.id).toBe(id)
      expect(e.title.length, id).toBeGreaterThan(10)
      expect(e.lesson.length, id).toBeGreaterThan(60)
      expect(e.lesson.split(/(?<=[.!?])\s+/).length, `${id}: one or two sentences, three at most`).toBeLessThanOrEqual(3)
      expect(e.example, id).toMatch(/✗ →/)
    }
    const all = Object.keys(ERROR_PATTERNS).filter((k) => k.startsWith('exp_'))
    expect(all.sort()).toEqual([...SECOND_HALF_IDS].sort())
  })
})

describe.each([
  ['expLogGraphs', 'eg.features'],
  ['expLogGraphs', 'eg.match'],
  ['expLogGraphs', 'eg.inverse'],
  ['expModels', 'em.interest'],
  ['expModels', 'em.halflife'],
  ['expModels', 'em.growth'],
] as const)('%s/%s texts over 2000 seeds', (moduleId: ModuleId, templateId: string) => {
  it(
    'no example, card, hint or early text spells an answer, and every named slip is one of the catalog ids',
    () => {
      const clashes: string[] = []
      const named = new Set<string>()
      for (let seed = 1; seed <= SWEEP && clashes.length < 12; seed++) {
        const p = generateProblem(moduleId, templateId, seed)
        const stages = stagesOf(p)
        const all = stages.flatMap(formsOf)
        // On screen from the start, whatever the part: cards, hints, instructions, and the exp_ catalog texts.
        for (const text of [...CARDS, ...HINTS, ...EXAMPLES]) if (anyShows([text], all)) clashes.push(`${p.id}: “${text}” spells ${all.join(' | ')}`)
        if (anyShows([p.instructions], all)) clashes.push(`${p.id}: the instructions spell an answer`)
        stages.forEach((part, i) => {
          const later = stages.slice(i).flatMap(formsOf)
          const shown = [p.answer.type === 'expLogGraphs' || p.answer.type === 'expModels' ? p.answer.prompt : '', ...partShownTexts(part), ...partCatalogTexts(part)]
          for (const text of shown) if (anyShows([text], later)) clashes.push(`${p.id} ${part.id}: “${text}” spells ${later.join(' | ')}`)
          for (const trap of part.traps) named.add(trap.id)
        })
      }
      expect(clashes).toEqual([])
      for (const id of named) expect(SECOND_HALF_IDS.includes(id as ErrorPatternId) || ['log_convert_dropped', 'log_ln_confused', 'log_quotient_as_quotient'].includes(id), id).toBe(true)
    },
    LOOP_TIMEOUT,
  )
})
