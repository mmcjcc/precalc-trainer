/**
 * Factoring polynomials: every template over 300 seeds is deterministic, validates its own answers, never shows a
 * part's answer before she answers it, keeps every promised trap a real candidate that grades as its id, reads as
 * English, draws what the brief asks for in the proportions it asks for, and never draws a reserved number.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { FactoringStageId, ProblemInstance } from '@/content/types'
import { FA_RESERVED, FA_TEMPLATE_IDS, canonicalEntries, faSelfTest, gradeFactoringStage, leaks, stageAnswers, type FactoringAnswer } from '.'

const LOOP = 120_000
const SEEDS = 300

function answerOf(p: ProblemInstance): FactoringAnswer {
  if (p.answer.type !== 'factoring') throw new Error('expected a factoring problem')
  return p.answer
}

const cache = new Map<string, ProblemInstance[]>()
function sweep(templateId: string, n = SEEDS): ProblemInstance[] {
  const hit = cache.get(templateId)
  if (hit && hit.length >= n) return hit.slice(0, n)
  const out: ProblemInstance[] = []
  for (let seed = 1; seed <= n; seed++) out.push(generateProblem('factoring', templateId, seed))
  cache.set(templateId, out)
  return out
}

/** Everything she can read before she answers: title, instructions, prompt, the statement, every nudge. */
function readable(p: ProblemInstance): string[] {
  const a = answerOf(p)
  return [p.title, p.instructions, p.statementText, a.prompt, ...a.stages.map((s) => s.nudge)]
}

const BROKEN = [/\[object/, /undefined/, /NaN/, /\b[Aa]n? \d/]

function slipGrades(a: FactoringAnswer) {
  const right = canonicalEntries(a)
  return a.slips.map((s) => ({ slip: s, grade: gradeFactoringStage(a, s.stage, { ...right, ...s.entries }) }))
}

describe('factoring templates: every seed', () => {
  for (const templateId of FA_TEMPLATE_IDS) {
    it(
      `${templateId}: deterministic, self-checked, and its answers grade correct`,
      () => {
        for (const p of sweep(templateId)) {
          const again = generateProblem('factoring', templateId, p.seed)
          expect(JSON.stringify(again)).toBe(JSON.stringify(p))
          const a = answerOf(p)
          expect(faSelfTest(a), `${templateId}/${p.seed}`).toBeNull()
          const right = canonicalEntries(a)
          for (const st of a.stages) {
            const g = gradeFactoringStage(a, st.id, right)
            expect(g.parts.every((x) => x.grade.verdict === 'correct'), `${templateId}/${p.seed} ${st.id}`).toBe(true)
          }
        }
      },
      LOOP,
    )

    it(
      `${templateId}: the promised trap is a real slip that grades as its id, and no slip is the answer or another slip`,
      () => {
        let promised = 0
        for (const p of sweep(templateId)) {
          const a = answerOf(p)
          for (const { slip, grade } of slipGrades(a)) {
            const named = grade.parts.filter((x) => x.grade.verdict === 'mistake')
            expect(named.map((x) => (x.grade.verdict === 'mistake' ? x.grade.mistake : '')), `${templateId}/${p.seed} ${slip.id}`).toEqual([slip.id])
          }
          const keys = a.slips.map((s) => JSON.stringify([s.stage, s.entries]))
          expect(new Set(keys).size).toBe(keys.length)
          if (a.trap) {
            promised++
            expect(a.slips.some((s) => s.id === a.trap && s.stage === a.trapStage)).toBe(true)
            // The trap's rule card leads its part's hints.
            expect(a.stages.find((s) => s.id === a.trapStage)!.ruleCard).toBe(a.ruleCard)
          } else {
            // A seed promises nothing only when it has no slip to promise.
            expect(a.slips).toEqual([])
          }
        }
        expect(promised).toBeGreaterThan(SEEDS * 0.75)
      },
      LOOP,
    )

    it(
      `${templateId}: nothing she reads before answering holds the answer, and it all reads as English`,
      () => {
        for (const p of sweep(templateId)) {
          const a = answerOf(p)
          for (const st of a.stages) {
            const ans = stageAnswers(a, st.id)
            // The statement is the polynomial itself; every other line she reads before answering is checked.
            for (const text of readable(p).filter((t) => t !== p.statementText)) expect(leaks(text, ans), `${templateId}/${p.seed} ${st.id}: ${text}`).toBe(false)
          }
          // The witnesses of every slip: a sentence about her answer, never the right one.
          for (const { slip, grade } of slipGrades(a)) {
            for (const part of grade.parts) {
              if (part.grade.verdict !== 'mistake') continue
              expect(leaks(part.grade.witness, stageAnswers(a, slip.stage)), `${templateId}/${p.seed} ${slip.id}: ${part.grade.witness}`).toBe(false)
              for (const re of BROKEN) expect(part.grade.witness).not.toMatch(re)
            }
          }
          for (const text of [...readable(p), ...a.reveal, a.expectedDisplay]) for (const re of BROKEN) expect(text, `${templateId}/${p.seed}`).not.toMatch(re)
        }
      },
      LOOP,
    )
  }
})

describe('factoring templates: what is drawn', () => {
  it(
    'seeds 1 to 60 give at least 40 different statements per template',
    () => {
      for (const templateId of FA_TEMPLATE_IDS) {
        // A statement is what she is shown: the question's wording and the polynomial.
        const statements = new Set(sweep(templateId, 60).map((p) => `${answerOf(p).prompt} ${p.statementText}`))
        expect(statements.size, templateId).toBeGreaterThanOrEqual(40)
      }
    },
    LOOP,
  )

  it(
    'no typed answer is more than 10% of 300 seeds, part by part (the "does not factor" choice aside)',
    () => {
      for (const templateId of FA_TEMPLATE_IDS) {
        const ps = sweep(templateId).map(answerOf)
        const stagesOf = new Set<FactoringStageId>(ps.flatMap((a) => a.stages.map((s) => s.id)))
        for (const stage of stagesOf) {
          const counts = new Map<string, number>()
          for (const a of ps) {
            if (!a.stages.some((s) => s.id === stage) || a.prime) continue
            const key = stageAnswers(a, stage).join(' | ')
            counts.set(key, (counts.get(key) ?? 0) + 1)
          }
          const most = Math.max(...counts.values())
          expect(most, `${templateId} ${stage}`).toBeLessThanOrEqual(SEEDS * 0.1)
        }
      }
    },
    LOOP,
  )

  it(
    'fa.squares: a sum of two squares in 15 to 25% of seeds; the others are differences and perfect squares; the choice order varies',
    () => {
      const ps = sweep('fa.squares').map(answerOf)
      const prime = ps.filter((a) => a.prime).length
      expect(prime).toBeGreaterThanOrEqual(SEEDS * 0.15)
      expect(prime).toBeLessThanOrEqual(SEEDS * 0.25)
      expect(ps.filter((a) => a.shape.core === 'dos').length).toBeGreaterThan(SEEDS * 0.3)
      expect(ps.filter((a) => a.shape.core === 'pst' && a.shape.s > 0).length).toBeGreaterThan(SEEDS * 0.1)
      expect(ps.filter((a) => a.shape.core === 'pst' && a.shape.s < 0).length).toBeGreaterThan(SEEDS * 0.1)
      const first = ps.filter((a) => a.choiceOrder![0] === 'prime').length
      expect(first).toBeGreaterThan(SEEDS * 0.35)
      expect(first).toBeLessThan(SEEDS * 0.65)
    },
    LOOP,
  )

  it(
    'fa.cubes: x^3 ± k^3 for k = 1..6 and (mx)^3 ± k^3 for m = 2, 3; a common factor first in 20 to 30% of seeds',
    () => {
      const ps = sweep('fa.cubes').map(answerOf)
      const withGcf = ps.filter((a) => a.shape.g !== 1 || a.shape.e !== 0).length
      expect(withGcf).toBeGreaterThanOrEqual(SEEDS * 0.2)
      expect(withGcf).toBeLessThanOrEqual(SEEDS * 0.3)
      for (const a of ps) {
        expect([1, 2, 3]).toContain(a.shape.m)
        expect(a.shape.n).toBeGreaterThanOrEqual(1)
        expect(a.shape.n).toBeLessThanOrEqual(6)
      }
      for (const k of [1, 2, 3, 4, 5, 6]) expect(ps.some((a) => a.shape.m === 1 && a.shape.n === k), `k = ${k}`).toBe(true)
      for (const m of [2, 3]) expect(ps.some((a) => a.shape.m === m && a.shape.g === 1 && a.shape.e === 0), `m = ${m}`).toBe(true)
      expect(ps.some((a) => a.shape.s > 0) && ps.some((a) => a.shape.s < 0)).toBe(true)
      // The common factor shapes of the brief: a number, and x.
      expect(ps.some((a) => a.shape.g > 1 && a.shape.e === 0)).toBe(true)
      expect(ps.some((a) => a.shape.g === 1 && a.shape.e === 1)).toBe(true)
    },
    LOOP,
  )

  it(
    'fa.trinomial: x^2 + bx + c and ax^2 + bx + c with a = 2..6, every sign pattern of b and c',
    () => {
      const ps = sweep('fa.trinomial').map(answerOf)
      const leads = new Set(ps.map((a) => a.shape.k[0]! * a.shape.k[2]!))
      expect([...leads].sort()).toEqual([1, 2, 3, 4, 5, 6])
      for (const monic of [true, false]) {
        for (const bPos of [true, false]) {
          for (const cPos of [true, false]) {
            const hit = ps.some((a) => {
              const [p0, q0, p1, q1] = a.shape.k as [number, number, number, number]
              const b = p0 * q1 + p1 * q0
              const c = q0 * q1
              return (p0 * p1 === 1) === monic && b > 0 === bPos && c > 0 === cPos
            })
            expect(hit, `monic ${monic}, b > 0 ${bPos}, c > 0 ${cPos}`).toBe(true)
          }
        }
      }
    },
    LOOP,
  )

  it(
    'fa.grouping and fa.complete: each scenario is drawn',
    () => {
      const groups = sweep('fa.grouping').map(answerOf)
      const u = (a: FactoringAnswer) => a.shape.k[1]!
      expect(groups.some((a) => u(a) < 0 && Number.isInteger(Math.sqrt(-u(a))))).toBe(true)
      expect(groups.some((a) => u(a) > 0)).toBe(true)
      expect(groups.some((a) => u(a) < 0 && !Number.isInteger(Math.sqrt(-u(a))))).toBe(true)
      // A negative third term is where the sign slip lives: often enough to matter.
      expect(groups.filter((a) => u(a) < 0).length).toBeGreaterThan(SEEDS * 0.5)
      const complete = sweep('fa.complete').map(answerOf)
      for (const core of ['dos', 'cubes', 'dos2', 'quartic', 'tri'] as const) expect(complete.some((a) => a.shape.core === core), core).toBe(true)
      // The brief's own examples are among the draws (3x^3 − 12x and 2x^3 − 16 are later seeds: factoring.hand.test.ts).
      const fs = new Set(complete.map((a) => a.f))
      for (const f of ['x^4 - 16', 'x^4 - 5x^2 + 4']) expect(fs.has(f), f).toBe(true)
    },
    LOOP,
  )

  it(
    'no draw uses a number reserved for the examples',
    () => {
      for (const templateId of FA_TEMPLATE_IDS) {
        for (const a of sweep(templateId).map(answerOf)) {
          const sh = a.shape
          const where = `${templateId} ${a.f}`
          expect(sh.g, where).not.toBe(FA_RESERVED.gcfNumber)
          for (const v of [sh.m, sh.n, ...sh.k]) for (const r of FA_RESERVED.anywhere) expect(Math.abs(v), where).not.toBe(r)
          if (sh.core === 'cubes') expect(sh.n, where).not.toBe(FA_RESERVED.cubeRoot)
          if (sh.core === 'dos2') expect(sh.n, where).not.toBe(FA_RESERVED.quarticN)
          if (sh.core === 'tri') expect(sh.k[0]! * sh.k[2]!, where).not.toBe(FA_RESERVED.leading)
        }
      }
    },
    LOOP,
  )
})
