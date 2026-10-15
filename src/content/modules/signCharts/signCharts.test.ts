import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import type { ProblemInstance } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { parseSetAnswer } from '@/engine/functions/answer'
import { polyDeg, polyEval, polyIsZero, polyMul, polySub, rationalRoots, type Poly } from '@/engine/functions/poly'
import { readFormula } from '@/engine/polynomials/common'
import { emptySet, rat, ratAdd, ratCompare, ratDiv, ratSub, ratToString, setContains, type Rational, type SolutionSet } from '@/notation'
import {
  SC_KEYS,
  SC_MISTAKE_IDS,
  SC_RULE_FOR,
  SC_RULES,
  canonicalEntries,
  gradeScStage,
  parseInequality,
  stageTraps,
  type ScMistakeId,
  type SignChartsAnswer,
} from '@/content/modules/signCharts'

const SEEDS = 300
const LOOP_TIMEOUT = 120_000

const TEMPLATES = [
  ['sc.poly', 'poly'],
  ['sc.rational', 'rational'],
  ['sc.chart', 'chart'],
] as const

/** Words that would hand her the method or the trap. The sentence above the work may not use them. */
const METHOD_WORDS = /leading|multiplicity|undefined|flip|one side|multiply|asymptote|extraneous|even power/i

const seenTraps = new Set<string>()

function answerOf(p: ProblemInstance): SignChartsAnswer {
  if (p.answer.type !== 'signCharts') throw new Error(`${p.id}: not a sign chart`)
  return p.answer
}

function sideOf(text: string): { num: Poly; den: Poly } {
  const read = readFormula(text)
  if (!read.ok || !read.ratFn) throw new Error(`could not read "${text}"`)
  return read.ratFn
}

function rootsOf(p: Poly): Rational[] {
  if (polyIsZero(p) || polyDeg(p) < 1) return []
  const found = rationalRoots(p)
  if (polyDeg(found.rest) >= 1) throw new Error('a factor did not split into rational roots')
  return found.roots
}

/** The solution set, recomputed from the two sides with engine polynomial operations. Not the module's sign chart. */
function agree(p: ProblemInstance, a: SignChartsAnswer) {
  const left = sideOf(a.left)
  const right = sideOf(a.right)
  const num = polySub(polyMul(left.num, right.den), polyMul(right.num, left.den))
  const den = polyMul(left.den, right.den)
  if (polyIsZero(den)) throw new Error(`${p.id}: zero denominator`)
  for (const c of [...num, ...den]) expect(c.d, p.id).toBe(1)
  const crits = [...new Map([...rootsOf(num), ...rootsOf(den)].map((x) => [ratToString(x), x])).values()].sort(ratCompare)
  for (const x of crits) expect(x.d, `${p.id} critical ${ratToString(x)}`).toBeLessThanOrEqual(3)
  expect(a.criticalText, p.id).toBe(crits.length === 0 ? 'none' : crits.map(ratToString).join(', '))
  expect(a.intervals, p.id).toHaveLength(crits.length + 1)
  expect(a.signsText.split(',').map((s) => s.trim()).filter(Boolean), p.id).toHaveLength(crits.length + 1)

  const tests: Rational[] = crits.length === 0 ? [rat(0)] : [ratSub(crits[0]!, rat(1))]
  for (let i = 0; i < crits.length - 1; i++) tests.push(ratDiv(ratAdd(crits[i]!, crits[i + 1]!), rat(2)))
  if (crits.length > 0) tests.push(ratAdd(crits[crits.length - 1]!, rat(1)))

  const solution = readSolution(a.solutionText)
  const holds = (x: Rational) => {
    const d = polyEval(den, x)
    if (d.n === 0) return false
    const n = polyEval(num, x)
    if (n.n === 0) return a.op === '<=' || a.op === '>='
    const positive = ratDiv(n, d).n > 0
    return a.op === '>' || a.op === '>=' ? positive : !positive
  }
  for (const x of [...tests, ...crits]) {
    expect(setContains(solution, x), `${p.id} ${a.inequality} at ${ratToString(x)}`).toBe(holds(x))
  }
}

function readSolution(text: string): SolutionSet {
  if (/^(?:no\s+solutions?|none|empty(?:\s+set)?|∅|\{\}|dne)$/i.test(text.trim())) return emptySet()
  const parsed = parseSetAnswer(text)
  if (!parsed.ok) throw new Error(parsed.error.message)
  return parsed.set
}

function assertHidden(p: ProblemInstance, a: SignChartsAnswer) {
  const visible = [p.title, p.instructions, a.prompt].join('\n')
  expect(visible, p.id).not.toMatch(METHOD_WORDS)
  for (const line of a.reveal) {
    if (line.length > 24) expect(visible.includes(line), `${p.id} shows a worked line`).toBe(false)
  }
  if (a.solutionText.length > 2) expect(a.prompt.includes(a.solutionText), p.id).toBe(false)
  for (const stage of a.stages) {
    expect(stage.nudge.length, p.id).toBeGreaterThan(40)
    expect(stage.reveal.length, p.id).toBeGreaterThan(0)
  }
}

describe('signCharts module', () => {
  it('is registered after rational functions, with three templates and a catalog card for every slip', () => {
    const mod = getModule('signCharts')
    expect(mod.title).toBe('Polynomial and rational inequalities')
    expect(mod.templates.map((t) => t.id)).toEqual(['sc.poly', 'sc.rational', 'sc.chart'])
    expect(mod.order).toBeGreaterThan(getModule('rationalFns').order)
    expect(mod.order).toBeLessThan(getModule('sigFigs').order)
    expect(mod.ruleCards).toBe(SC_RULES)
    expect(new Set(SC_RULES.map((c) => c.id)).size).toBe(SC_RULES.length)
    for (const id of SC_MISTAKE_IDS) {
      const info = ERROR_PATTERNS[id]
      expect(info.title.length, id).toBeGreaterThan(0)
      expect(info.lesson.length, id).toBeGreaterThan(40)
      expect(info.example, id).toMatch(/✗/)
      expect(info.example, id).toMatch(/→/)
      expect(SC_RULE_FOR[id], id).toBeTruthy()
    }
    const sample = generateProblem('signCharts', 'sc.poly', 1)
    expect(mod.progress(sample, null, false)).toMatchObject({ stage: 0, total: 1, anchorIndex: -1, path: 'none' })
    expect(mod.nextStep(sample, null, false)).toBeNull()
  })
})

describe.each(TEMPLATES)('%s over 300 seeds', (templateId, question) => {
  it(
    'is deterministic, grades its own answers, hides them, and promises a real trap',
    () => {
      const traps = new Set<string>()
      const shapes = new Set<string>()
      let even = 0
      let negative = 0
      let factored = 0
      let expanded = 0
      let sides = 0
      let rewrite = 0
      let rationalKind = 0
      for (let seed = 1; seed <= SEEDS; seed++) {
        const p = generateProblem('signCharts', templateId, seed)
        expect(generateProblem('signCharts', templateId, seed), p.id).toEqual(p)
        const a = answerOf(p)
        expect(p.kind).toBe('signCharts')
        expect(p.moduleId).toBe('signCharts')
        expect(p.skill).toBe(templateId)
        expect(a.question).toBe(question)
        expect(p.canonical).toEqual([])
        expect(p.start).toBeNull()
        expect(p.vars).toEqual(['x'])
        expect(p.graph).toEqual({ kind: 'none' })
        expect(p.calc).toEqual({ ti84: [], nspire: [] })
        expect(a.graph.kind).toBe('function')
        expect(a.graph.f).toBeTruthy()
        expect(a.graph.solutionMarks).toBeTruthy()
        expect(p.statementText).toBe(a.inequality)
        expect(p.params.trap).toBe(a.trap)
        expect(p.params.trapStage).toBe(a.trapStage)
        expect(a.ruleCard).toBe(SC_RULE_FOR[a.trap as ScMistakeId])
        expect(a.ruleCards[0]).toBe(a.ruleCard)
        expect(new Set(a.ruleCards).size).toBe(a.ruleCards.length)
        expect(a.prompt).toBe('Solve the inequality.')
        expect(p.instructions).toBe(
          question === 'chart'
            ? 'Give the critical numbers, the sign on each interval, and the solution set.'
            : 'Solve the inequality and give the solution set.',
        )
        expect(['>', '>=', '<', '<=']).toContain(a.op)

        const model = parseInequality(a.inequality)
        const entries = canonicalEntries(a)
        for (const stage of a.stages) {
          expect(gradeScStage(a, stage.id, entries[SC_KEYS[stage.id]] ?? '').verdict, `${p.id} ${stage.id}`).toBe('correct')
        }
        const trap = gradeScStage(a, a.trapStage, a.trapAnswer)
        expect(trap, `${p.id} ${a.trap}`).toMatchObject({ verdict: 'mistake', mistake: a.trap })
        expect(entries[SC_KEYS[a.trapStage]], p.id).not.toBe(a.trapAnswer)
        const live = a.stages.flatMap((stage) => stageTraps(model, stage.id))
        expect(live.some((t) => t.id === a.trap && t.stage === a.trapStage && t.text === a.trapAnswer), `${p.id} ${a.trap}`).toBe(true)
        agree(p, a)

        if (question === 'chart') {
          expect(a.stages.map((s) => s.id)).toEqual(['critical', 'signs', 'solution'])
          if (model.kind === 'rational') rationalKind++
        } else {
          expect(a.stages.map((s) => s.id)).toEqual(['solution'])
          expect(a.trapStage).toBe('solution')
        }
        if (model.kind === 'rational') {
          expect(a.graph.fBreaks?.length, p.id).toBeGreaterThan(0)
        }
        assertHidden(p, a)
        traps.add(a.trap)
        seenTraps.add(a.trap)
        shapes.add(String(p.params.shape))
        if (p.params.even === true) even++
        if (p.params.negative === true) negative++
        if (p.params.shape === 'factored' || p.params.shape === 'ratio-factored') factored++
        if (p.params.shape === 'expanded') expanded++
        if (p.params.shape === 'sides') sides++
        if (p.params.shape === 'rewrite') rewrite++
      }
      expect(traps.size, `${templateId} traps ${[...traps].join(',')}`).toBeGreaterThan(2)
      expect(even, `${templateId} even ${even}`).toBeGreaterThan(SEEDS * 0.2)
      expect(negative, `${templateId} negative ${negative}`).toBeGreaterThan(SEEDS * 0.15)
      if (question === 'poly') {
        expect(shapes).toEqual(new Set(['factored', 'expanded', 'sides']))
        expect(factored, `factored ${factored}`).toBeGreaterThan(40)
        expect(expanded, `expanded ${expanded}`).toBeGreaterThan(40)
        expect(sides, `sides ${sides}`).toBeGreaterThan(40)
      }
      if (question === 'rational') {
        expect(rewrite, `rewrite ${rewrite}`).toBeGreaterThan(40)
        expect(traps.has('sc_denominator_included'), [...traps].join(',')).toBe(true)
        expect(traps.has('sc_not_one_side'), [...traps].join(',')).toBe(true)
        expect(traps.has('sc_multiplied_by_denominator'), [...traps].join(',')).toBe(true)
      }
      if (question === 'chart') {
        expect(rationalKind, `rational charts ${rationalKind}`).toBeGreaterThan(60)
        expect(rationalKind, `rational charts ${rationalKind}`).toBeLessThan(SEEDS - 60)
        expect(traps.has('sc_critical_missing'), [...traps].join(',')).toBe(true)
      }
    },
    LOOP_TIMEOUT,
  )
})

describe('sign chart slips', () => {
  it('every sc_ id is the promised trap of some seed', () => {
    expect([...seenTraps].sort()).toEqual([...SC_MISTAKE_IDS].sort())
  })
})
