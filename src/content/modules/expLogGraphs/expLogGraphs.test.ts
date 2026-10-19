/**
 * Graphs of exponential and logarithmic functions, every template over 300 seeds: built from the seed and
 * deterministic, each part's answer grades right, each trap grades as its own id, the promised trap is one of
 * them, and nothing she sees before a part is answered spells that part's answer.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import type { ExpLogPart, ProblemInstance } from '@/content/types'
import { compileExpr, ERROR_PATTERNS } from '@/engine'
import { partCatalogTexts, partShownTexts } from '../explog/parts'
import { anyShows } from '../explog/text'
import { EG_RULES, gradeEgPart, inverseCheck, curveOf, type ExpLogGraphsAnswer } from '.'

const SEEDS = 300
const LOOP_TIMEOUT = 120_000

function answerOf(p: ProblemInstance): ExpLogGraphsAnswer {
  if (p.answer.type !== 'expLogGraphs') throw new Error(`${p.id} is not an exp/log graph`)
  return p.answer
}

/** Spellings of one part's answer, written here rather than taken from the generator. */
function formsOf(part: ExpLogPart): string[] {
  const a = part.answerText
  if (part.kind === 'choice') return []
  if (part.kind === 'interval') {
    if (a === '(-inf, inf)') return [a, '(-∞, ∞)', 'all real numbers']
    const m = /^\((-?\d+), inf\)$/.exec(a) ?? /^\(-inf, (-?\d+)\)$/.exec(a)
    const letter = part.id === 'range' ? 'y' : 'x'
    const ineq = m ? (a.endsWith('inf)') ? `${letter} > ${m[1]}` : `${letter} < ${m[1]}`) : null
    return [a, a.replace(/inf/g, '∞'), ...(ineq ? [ineq] : [])]
  }
  return [a]
}

const cardTexts = EG_RULES.flatMap((r) => [r.title, r.body, r.example ?? ''])

describe('expLogGraphs module', () => {
  it('registers three templates after the equations module, with its own rule cards', () => {
    const mod = getModule('expLogGraphs')
    expect(mod.title).toBe('Graphs of exponential and logarithmic functions')
    expect(mod.templates.map((t) => t.id)).toEqual(['eg.features', 'eg.match', 'eg.inverse'])
    expect(mod.order).toBeGreaterThan(getModule('expLogEquations').order)
    expect(mod.ruleCards).toBe(EG_RULES)
  })
})

describe.each(['eg.features', 'eg.match', 'eg.inverse'] as const)('expLogGraphs/%s over 300 seeds', (templateId) => {
  it(
    'is deterministic, grades its answers and traps, promises a real trap, and hides each answer until its part',
    () => {
      const statements = new Set<string>()
      const answers = new Map<string, number>()
      const promised = new Set<string>()
      for (let seed = 1; seed <= SEEDS; seed++) {
        const p = generateProblem('expLogGraphs', templateId, seed)
        expect(generateProblem('expLogGraphs', templateId, seed), p.id).toEqual(p)
        const a = answerOf(p)
        expect(p.kind).toBe('expLogGraphs')
        expect(p.graph.kind, 'the rail graph would show the answer early').toBe('none')
        for (const part of a.stages) {
          const right = gradeEgPart(a, part.id, part.answerText)
          expect(right.verdict, `${p.id} ${part.id} “${part.answerText}”`).toBe('correct')
          for (const form of formsOf(part)) expect(gradeEgPart(a, part.id, form).verdict, `${p.id} ${part.id} “${form}”`).toBe('correct')
          for (const trap of part.traps) {
            expect(trap.id.startsWith('exp_') || trap.id.startsWith('log_'), trap.id).toBe(true)
            expect(ERROR_PATTERNS[trap.id], trap.id).toBeTruthy()
            const g = gradeEgPart(a, part.id, trap.text)
            expect(g.verdict === 'mistake' ? g.mistake : g.verdict, `${p.id} ${part.id} trap “${trap.text}”`).toBe(trap.id)
          }
        }
        const stage = a.stages.find((s) => s.id === a.trapStage)
        expect(stage?.traps.some((t) => t.id === a.trap && t.text === a.trapAnswer), `${p.id} promised ${a.trap}`).toBe(true)
        const g = gradeEgPart(a, a.trapStage, a.trapAnswer)
        expect(g.verdict === 'mistake' && g.mistake, p.id).toBe(a.trap)
        // Before a part is answered: the statement, the cards, and that part's own texts never spell its answer
        // or a later one.
        a.stages.forEach((part, i) => {
          const later = a.stages.slice(i).flatMap(formsOf)
          const shown = [p.instructions, a.prompt, ...cardTexts, ...partShownTexts(part), ...partCatalogTexts(part)]
          const leaks = shown.filter((text) => anyShows([text], later))
          expect(leaks, `${p.id} ${part.id}`).toEqual([])
        })
        if (a.question === 'match') {
          const right = a.candidates?.find((c) => c.letter === a.stages[0]!.answerText)
          expect(right?.f, p.id).toBe(a.f)
          const fns = (a.candidates ?? []).map((c) => compileExpr(c.f))
          // Four different functions: two candidates never agree at every probe.
          for (let i = 0; i < fns.length; i++) {
            for (let j = i + 1; j < fns.length; j++) {
              const differ = [-2.5, -0.5, 0.75, 2.25, 4.5, 6.5].some((x) => {
                const u = fns[i]!({ x })
                const v = fns[j]!({ x })
                return u === 'undef' ? v !== 'undef' : v === 'undef' || Math.abs(u - v) > 1e-6
              })
              expect(differ, `${p.id} candidates ${i} and ${j}`).toBe(true)
            }
          }
          for (const c of a.candidates ?? []) expect(c.graph.ariaLabel, 'a candidate graph must not announce its formula').toBe(`Graph ${c.letter}`)
          answers.set(a.f, (answers.get(a.f) ?? 0) + 1)
        } else {
          answers.set(a.expectedDisplay, (answers.get(a.expectedDisplay) ?? 0) + 1)
        }
        if (a.question === 'inverse') {
          // The stored inverse composes with f both ways (sampled here, not by the grader).
          const f = compileExpr(a.f)
          const g = compileExpr(a.stages[0]!.answerText)
          const check = inverseCheck(curveOf(a))
          for (const x of check.domainSamples) {
            const y = f({ x })
            if (y === 'undef') continue
            const back = g({ x: y })
            expect(back !== 'undef' && Math.abs(back - x) < 1e-6 * Math.max(1, Math.abs(x)), `${p.id} f⁻¹(f(${x}))`).toBe(true)
          }
        }
        statements.add(`${p.statementText} ${a.matchMode ?? ''}`)
        promised.add(`${a.trapStage}:${a.trap}`)
      }
      expect(statements.size, templateId).toBeGreaterThanOrEqual(25)
      expect(Math.max(...answers.values()), `${templateId} most common answer`).toBeLessThanOrEqual(SEEDS / 10)
      if (templateId === 'eg.features') {
        // The brief's four traps are all promised somewhere in the run.
        for (const want of ['asymptote:exp_asymptote_unshifted', 'asymptote:exp_shift_sign', 'range:exp_sign_of_a', 'domain:exp_endpoint_closed']) expect(promised, want).toContain(want)
      }
      if (templateId === 'eg.inverse') for (const want of ['inverse:exp_inverse_shift', 'inverse:exp_inverse_base_swapped', 'inverse:exp_inverse_reciprocal']) expect(promised).toContain(want)
      if (templateId === 'eg.match') for (const want of ['match:exp_sign_of_a', 'match:exp_base_direction', 'match:exp_shift_sign']) expect(promised).toContain(want)
    },
    LOOP_TIMEOUT,
  )
})
