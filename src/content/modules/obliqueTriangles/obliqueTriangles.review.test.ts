/**
 * The review sweep: 1000 seeds per template. Nothing she reads before a part (prompt, instructions, figure, rule cards,
 * hints, the part's own texts) spells that part's answer or a later one, and no catalog title, lesson or example of any
 * mistake this module can name spells any answer of the problem; every text reads as English.
 */
import { describe, expect, it } from 'vitest'
import '@/content/modules'
import { ERROR_PATTERNS } from '@/engine'
import type { ErrorPatternId } from '@/shared/types'
import { answerForms } from '../trig/parts'
import { showsNumber } from '../trig/text'
import { EARLY_NOTE, badEnglish, obliqueLeaks, readableTexts } from './grade'
import { OT_RULES } from './rules'
import { problemAt } from './testkit'
import { OT_HINTS } from './words'

const T = 120_000

const NAMED: ErrorPatternId[] = [
  ...(Object.keys(ERROR_PATTERNS).filter((id) => id.startsWith('ot_')) as ErrorPatternId[]),
  'trig_radian_mode',
  'trig_side_not_rooted',
  'trig_pythag_added',
  'trig_pythag_subtracted',
  'trig_opposite_adjacent_swapped',
]
const CATALOG = NAMED.flatMap((id) => [ERROR_PATTERNS[id].title, ERROR_PATTERNS[id].lesson, ERROR_PATTERNS[id].example])
const CARDS = OT_RULES.flatMap((c) => [c.title, c.body, c.example ?? ''])

describe('the catalog entries and cards read as English', () => {
  it('no article before a number, no leftovers', () => {
    expect(NAMED.filter((id) => id.startsWith('ot_'))).toHaveLength(17)
    for (const t of [...CATALOG, ...CARDS, ...OT_HINTS, EARLY_NOTE]) expect(badEnglish(t), t).toBeNull()
  })
})

describe.each(['ot.sines', 'ot.ambiguous', 'ot.cosines', 'ot.area', 'ot.choose'] as const)('%s, 1000 seeds', (id) => {
  for (const [from, to] of [
    [1, 500],
    [501, 1000],
  ] as const) {
    it(
      `seeds ${from}-${to}: no early text, catalog entry or card spells an answer`,
      () => {
        for (let seed = from; seed <= to; seed++) {
          const { p, a } = problemAt(id, seed)
          expect(obliqueLeaks(a, p.instructions, OT_RULES, OT_HINTS), p.id).toEqual([])
          const forms = a.stages.flatMap(answerForms)
          for (const t of [...CATALOG, ...CARDS, ...OT_HINTS, EARLY_NOTE]) expect(showsNumber([t], forms), `${p.id}: ${t}`).toBe(false)
          for (const t of readableTexts(a, p.instructions)) expect(badEnglish(t), p.id).toBeNull()
        }
      },
      T,
    )
  }
})
