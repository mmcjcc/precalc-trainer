/**
 * Review sweep, 1000 seeds per template: no catalog title, lesson or example of an fa_ mistake and no rule card
 * holds the answer to any part of any problem, and no problem is one of the examples (they use reserved numbers).
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import { readPoly } from '@/engine/polynomials/common'
import { polyEquals } from '@/engine/functions/poly'
import { FA_RULES, FA_TEMPLATE_IDS, leaks, stageAnswers } from '.'

const SEEDS = 1000

const catalog = Object.values(ERROR_PATTERNS).filter((p) => p.id.startsWith('fa_'))
const texts = [...catalog.flatMap((p) => [p.title, p.lesson, p.example ?? '']), ...FA_RULES.flatMap((c) => [c.title, c.body, c.example ?? ''])]

/** The polynomial each example starts from: the text before ":" or "=" ("x^3 − 1000: …", "14x^3 + 21x^2 = …"). */
const examplePolys = [...catalog.map((p) => p.example ?? ''), ...FA_RULES.map((c) => c.example ?? '')]
  .flatMap((e) => e.split(';'))
  .map((e) => e.split(/[:=]/)[0]!.replace(/−/g, '-').replace(/does not factor.*/, '').trim())
  .map((t) => readPoly(t)?.poly)
  .filter((p): p is NonNullable<typeof p> => Boolean(p) && p!.length >= 2)

describe('factoring review: the catalog and the rule cards against every answer', () => {
  it('there is an fa_ entry for every slip and a polynomial for most examples', () => {
    expect(catalog).toHaveLength(14)
    expect(examplePolys.length).toBeGreaterThanOrEqual(20)
  })

  for (const templateId of FA_TEMPLATE_IDS) {
    it(
      `${templateId}: ${SEEDS} seeds, no catalog or rule text holds an answer, and no problem is an example`,
      () => {
        for (let seed = 1; seed <= SEEDS; seed++) {
          const p = generateProblem('factoring', templateId, seed)
          if (p.answer.type !== 'factoring') throw new Error('expected factoring')
          const a = p.answer
          for (const st of a.stages) {
            const ans = stageAnswers(a, st.id)
            for (const t of texts) expect(leaks(t, ans), `${templateId}/${seed} ${st.id}: ${t}`).toBe(false)
          }
          const f = readPoly(a.f)!.poly
          expect(examplePolys.some((e) => polyEquals(e, f)), `${templateId}/${seed}: ${a.f}`).toBe(false)
        }
      },
      120_000,
    )
  }
})
