/**
 * Seeded polynomial and rational inequalities. Each one is built from linear factors so the
 * solution set is exact. The build checks that set against the expression, and checks its trap.
 */
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import { problemId } from '@/content/registry'
import type { AnswerSpec, DifficultyKnobs, ProblemInstance, SignChartsOp, SignChartsQuestion, SignChartsStageId, TemplateDef } from '@/content/types'
import { linearFactor, polyFromRoots, sameRational } from '@/content/modules/rationalFns/model'
import { Unsupported } from '@/engine/functions/exact'
import { factoredText, linearFactorText, P_ONE, polyAdd, polyDeg, polyIsZero, polyMul, polySub, polyToText, type Poly } from '@/engine/functions/poly'
import type { CalcPanels, Rational } from '@/shared/types'
import { rat, ratEquals, ratMul, ratSub } from '@/notation'
import { gradeScPart, stageTraps, type ScGrade, type ScMistakeId, type ScTrap } from './grade'
import {
  explainLines,
  graphOf,
  intervalLabels,
  parseInequality,
  ScSkip,
  signsText,
  splitInequality,
  splitPolynomial,
  type ScProblem,
} from './model'
import { SC_RULE_FOR, SC_RULE_IDS } from './rules'

export const SC_MODULE_ID = 'signCharts' as const

export type SignChartsAnswer = Extract<AnswerSpec, { type: 'signCharts' }>

export const SC_KEYS: Record<SignChartsStageId, string> = {
  critical: 'critical',
  signs: 'signs',
  solution: 'solution',
}

const NO_GRAPH = { kind: 'none' as const }
const NO_CALC: CalcPanels = { ti84: [], nspire: [] }

const PROMPT: Record<SignChartsQuestion, string> = {
  poly: 'Solve the inequality.',
  rational: 'Solve the inequality.',
  chart: 'Solve the inequality.',
}

const INSTRUCTIONS: Record<SignChartsQuestion, string> = {
  poly: 'Solve the inequality and give the solution set.',
  rational: 'Solve the inequality and give the solution set.',
  chart: 'Give the critical numbers, the sign on each interval, and the solution set.',
}

const NUDGE: Record<SignChartsStageId, string> = {
  critical: 'List every zero of the numerator and every zero of the denominator, from least to greatest. A denominator zero is a critical number too.',
  signs: 'The sign on the far right is the sign of the leading coefficient. A factor with an even power does not change the sign as you move left.',
  solution: 'Keep the intervals whose sign matches the inequality. A numerator zero is included for ≤ or ≥ and left out for < or >. A denominator zero is never included.',
}

const STAGE_CARD: Record<SignChartsStageId, string> = {
  critical: SC_RULE_IDS.critical,
  signs: SC_RULE_IDS.signs,
  solution: SC_RULE_IDS.intervals,
}

const QUESTION_STAGES: Record<SignChartsQuestion, SignChartsStageId[]> = {
  poly: ['solution'],
  rational: ['solution'],
  chart: ['critical', 'signs', 'solution'],
}

const STAGE_LABEL: Record<SignChartsStageId, string> = {
  critical: 'critical numbers',
  signs: 'signs',
  solution: 'solution set',
}

const OPS: SignChartsOp[] = ['>', '>=', '<', '<=']
const FRONTS = [1, -1, 2, -2, 3, -3] as const
const SHIFTS = [-3, -2, -1, 1, 2, 3] as const

const ROOTS: Rational[] = (() => {
  const out: Rational[] = []
  for (let d = 1; d <= 3; d++) {
    for (let n = -5; n <= 5; n++) {
      if (gcd(Math.abs(n), d) !== 1) continue
      out.push(rat(n, d))
    }
  }
  return out
})()

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x
}

function takeRoots(rng: Rng, n: number, banned: readonly Rational[]): Rational[] {
  const avail = ROOTS.filter((r) => !banned.some((b) => ratEquals(b, r)))
  if (avail.length < n) throw new ScSkip('not enough roots')
  return rng.shuffle(avail).slice(0, n)
}

interface FactorSpec {
  root: Rational
  mult: number
}

function withEven(rng: Rng, roots: readonly Rational[], chance: number): FactorSpec[] {
  const factors = roots.map((root) => ({ root, mult: 1 }))
  if (factors.length > 0 && rng.chance(chance)) factors[rng.int(0, factors.length - 1)]!.mult = 2
  return factors
}

function expand(factors: readonly FactorSpec[]): Rational[] {
  const roots: Rational[] = []
  for (const factor of factors) {
    for (let i = 0; i < factor.mult; i++) roots.push(factor.root)
  }
  return roots
}

interface Drawn {
  model: ScProblem
  shape: string
  even: boolean
  negative: boolean
}

function integerPoly(p: Poly): boolean {
  return p.every((c) => c.d === 1)
}

function accept(text: string, intended: { num: Poly; den: Poly }): ScProblem {
  let model: ScProblem
  try {
    model = parseInequality(text)
  } catch (e) {
    if (e instanceof ScSkip || e instanceof Unsupported || e instanceof RangeError) throw e
    if (e instanceof Error && e.message.startsWith('not an inequality')) throw new ScSkip(e.message)
    throw e
  }
  if (!sameRational({ num: model.chart.num, den: model.chart.den }, intended)) throw new ScSkip('the displayed inequality is a different function')
  if (!integerPoly(model.chart.num) || !integerPoly(model.chart.den)) throw new ScSkip('coefficients are not integers')
  if (model.chart.criticals.some((c) => c.x.d > 3)) throw new ScSkip('a critical number has a large denominator')
  if (model.chart.criticals.some((c) => c.numMult > 0 && c.denMult > 0)) throw new ScSkip('a hole')
  if (polyDeg(model.chart.num) > 6 || polyDeg(model.chart.den) > 4) throw new ScSkip('degree too high')
  return model
}

function flags(model: ScProblem): { even: boolean; negative: boolean } {
  const even = model.chart.criticals.some((c) => c.exponent !== 0 && c.exponent % 2 === 0)
  const negative = model.chart.signs[model.chart.signs.length - 1] === '-'
  return { even, negative }
}

function showPoly(p: Poly, factored: boolean): string {
  if (!factored) return polyToText(p)
  const text = factoredText(p)
  if (!text) throw new ScSkip('factored form did not round-trip')
  return text
}

function drawPoly(rng: Rng): Drawn {
  const shape = rng.pick(['factored', 'expanded', 'sides'] as const)
  const op = rng.pick(OPS)
  const factors = withEven(rng, takeRoots(rng, rng.int(1, 3), []), 0.65)
  const front = rng.pick(FRONTS)
  const num = polyFromRoots(front, expand(factors))
  if (polyIsZero(num) || !integerPoly(num)) throw new ScSkip('polynomial did not build')
  let text: string
  if (shape === 'sides') {
    const split = splitPolynomial(num, op)
    if (split) {
      text = split.text
    } else {
      const k = rng.pick(SHIFTS)
      const shifted = polyAdd(num, [rat(k)])
      if (!polyIsZero(polySub(polySub(shifted, [rat(k)]), num))) throw new ScSkip('the two sides do not rebuild the polynomial')
      text = `${polyToText(shifted)} ${op} ${polyToText([rat(k)])}`
    }
  } else {
    text = `${showPoly(num, shape === 'factored')} ${op} 0`
  }
  const model = accept(text, { num, den: P_ONE })
  return { model, shape, ...flags(model) }
}

function drawRatio(rng: Rng): Drawn {
  const op = rng.pick(OPS)
  const numFactors = withEven(rng, takeRoots(rng, rng.int(1, 2), []), 0.55)
  const denFactors = withEven(rng, takeRoots(rng, rng.int(1, 2), numFactors.map((f) => f.root)), 0.2)
  const numFront = rng.pick(FRONTS)
  const denFront = rng.pick([1, 2, 3] as const)
  const num = polyFromRoots(numFront, expand(numFactors))
  const den = polyFromRoots(denFront, expand(denFactors))
  if (polyIsZero(num) || polyIsZero(den) || !integerPoly(num) || !integerPoly(den)) throw new ScSkip('fraction did not build')
  const factored = rng.chance(0.5)
  const text = `(${showPoly(num, factored)})/(${showPoly(den, factored)}) ${op} 0`
  const model = accept(text, { num, den })
  return { model, shape: factored ? 'ratio-factored' : 'ratio', ...flags(model) }
}

function drawRewrite(rng: Rng): Drawn {
  const op = rng.pick(OPS)
  const denRoot = rng.pick(ROOTS)
  const numRoot = rng.pick(ROOTS.filter((r) => !ratEquals(r, denRoot)))
  const c = rng.pick(SHIFTS)
  const a = ratMul(ratSub(numRoot, denRoot), rat(c * denRoot.d))
  if (a.d !== 1 || a.n === 0 || Math.abs(a.n) > 18) throw new ScSkip('the constant would not be a small integer')
  const den = linearFactor(denRoot)
  const num = polySub([rat(a.n)], polyMul([rat(c)], den))
  const left = `${polyToText([rat(a.n)])}/(${linearFactorText(denRoot)})`
  const text = `${left} ${op} ${polyToText([rat(c)])}`
  const model = accept(text, { num, den })
  if (!model.chart.criticals.some((cr) => ratEquals(cr.x, denRoot) && cr.denMult > 0)) throw new ScSkip('the denominator zero disappeared')
  if (!model.chart.criticals.some((cr) => ratEquals(cr.x, numRoot) && cr.numMult > 0)) throw new ScSkip('the numerator zero disappeared')
  return { model, shape: 'rewrite', ...flags(model) }
}

function drawRational(rng: Rng): Drawn {
  return rng.chance(0.45) ? drawRewrite(rng) : drawRatio(rng)
}

function drawFor(question: SignChartsQuestion, rng: Rng): Drawn {
  if (question === 'poly') return drawPoly(rng)
  if (question === 'rational') return drawRational(rng)
  return rng.chance(0.5) ? drawRational(rng) : drawPoly(rng)
}

function poolFor(question: SignChartsQuestion, model: ScProblem): ScTrap[] {
  const stages = QUESTION_STAGES[question]
  return stages.flatMap((stage) => stageTraps(model, stage))
}

export function gradeScStage(answer: SignChartsAnswer, stage: SignChartsStageId, text: string): ScGrade {
  try {
    const model = parseInequality(answer.inequality)
    return gradeScPart(model, stage, text)
  } catch (e) {
    if (e instanceof ScSkip || e instanceof Unsupported || e instanceof RangeError) {
      return { verdict: 'invalid', message: 'This problem could not be checked exactly.' }
    }
    throw e
  }
}

export function canonicalEntries(answer: SignChartsAnswer): Record<string, string> {
  return {
    [SC_KEYS.critical]: answer.criticalText,
    [SC_KEYS.signs]: answer.signsText,
    [SC_KEYS.solution]: answer.solutionText,
  }
}

export function scWork(answer: SignChartsAnswer, entries: Record<string, string> | undefined): string[] {
  if (!entries) return []
  const lines: string[] = []
  for (const stage of answer.stages) {
    const text = entries[SC_KEYS[stage.id]]
    if (text?.trim()) lines.push(`${STAGE_LABEL[stage.id]}: ${text.trim()}`)
  }
  return lines
}

function assertSelf(where: string, answer: SignChartsAnswer, model: ScProblem): void {
  const entries = canonicalEntries(answer)
  for (const stage of answer.stages) {
    const g = gradeScStage(answer, stage.id, entries[SC_KEYS[stage.id]] ?? '')
    if (g.verdict !== 'correct') throw new Error(`${where}: the canonical ${stage.id} answer does not grade correct (${g.verdict})`)
  }
  const trap = gradeScStage(answer, answer.trapStage, answer.trapAnswer)
  if (trap.verdict !== 'mistake' || trap.mistake !== answer.trap) {
    throw new Error(`${where}: trap ${answer.trap} on ${answer.trapStage} graded ${trap.verdict}${trap.verdict === 'mistake' ? ` ${trap.mistake}` : ''}`)
  }
  const live = poolFor(answer.question, model)
  if (!live.some((t) => t.id === answer.trap && t.stage === answer.trapStage && t.text === answer.trapAnswer)) {
    throw new Error(`${where}: promised trap ${answer.trap} is not a candidate`)
  }
}

function fullReveal(model: ScProblem): string[] {
  const lines = explainLines(model)
  return [...lines.critical, ...lines.signs, ...lines.solution]
}

function assemble(question: SignChartsQuestion, templateId: string, version: number, seed: number, knobs: DifficultyKnobs, drawn: Drawn, rng: Rng): ProblemInstance {
  const stages = QUESTION_STAGES[question]
  const pool = poolFor(question, drawn.model)
  if (pool.length === 0) throw new ScSkip('no trap')
  const trap: ScTrap = rng.pick(pool)
  const primary = SC_RULE_FOR[trap.id as ScMistakeId]
  const lines = explainLines(drawn.model)
  const reveal = fullReveal(drawn.model)
  const parts = splitInequality(drawn.model.inequality)
  if (!parts) throw new ScSkip('the inequality has no operator')
  const criticalText = drawn.model.chart.criticalText
  const signText = signsText(drawn.model.chart.signs)
  const solutionText = drawn.model.chart.solutionText
  const answer: SignChartsAnswer = {
    type: 'signCharts',
    question,
    inequality: drawn.model.inequality,
    left: parts.left,
    right: parts.right,
    op: drawn.model.op,
    prompt: PROMPT[question],
    criticalText,
    signsText: signText,
    intervals: intervalLabels(drawn.model.chart.criticals),
    solutionText,
    stages: stages.map((id) => ({
      id,
      nudge: NUDGE[id],
      ruleCard: id === trap.stage ? primary : STAGE_CARD[id],
      reveal: question === 'chart' ? [...lines[id]] : reveal,
    })),
    expectedDisplay: '',
    nudge: NUDGE[stages[0]!],
    ruleCard: primary,
    ruleCards: [primary, ...stages.map((id) => STAGE_CARD[id]).filter((id, i, all) => id !== primary && all.indexOf(id) === i)],
    reveal,
    trap: trap.id,
    trapStage: trap.stage,
    trapAnswer: trap.text,
    graph: graphOf(drawn.model),
  }
  const byStage: Record<SignChartsStageId, string> = { critical: criticalText, signs: signText, solution: solutionText }
  answer.expectedDisplay = stages.map((id) => `${STAGE_LABEL[id]}: ${byStage[id]}`).join(' | ')
  assertSelf(`${templateId}/${seed}`, answer, drawn.model)
  const title = question === 'poly' ? 'Polynomial inequality' : question === 'rational' ? 'Rational inequality' : 'Critical numbers and signs'
  return {
    id: problemId(SC_MODULE_ID, templateId, version, seed),
    moduleId: SC_MODULE_ID,
    templateId,
    skill: templateId,
    genVersion: version,
    seed: seed >>> 0,
    knobs,
    kind: 'signCharts',
    title,
    instructions: INSTRUCTIONS[question],
    statementText: drawn.model.inequality,
    vars: ['x'],
    start: null,
    canonical: [],
    answer,
    graph: NO_GRAPH,
    calc: NO_CALC,
    params: {
      question,
      shape: drawn.shape,
      op: drawn.model.op,
      even: drawn.even,
      negative: drawn.negative,
      trap: answer.trap,
      trapStage: answer.trapStage,
    },
  }
}

function generateQuestion(question: SignChartsQuestion, templateId: string, version: number, salt: number) {
  return (seed: number, knobs: DifficultyKnobs = {}): ProblemInstance => {
    const rng = makeRng(mixSeed(seed, salt))
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        return assemble(question, templateId, version, seed, knobs, drawFor(question, rng), rng)
      } catch (e) {
        if (e instanceof ScSkip || e instanceof Unsupported || e instanceof RangeError) continue
        throw e
      }
    }
    throw new Error(`${templateId}: no inequality passed the filters in 80 draws (seed ${seed})`)
  }
}

export const polyTemplate: TemplateDef = {
  id: 'sc.poly',
  title: 'Polynomial inequality',
  description: 'Solve a polynomial inequality and give the solution set in interval notation.',
  version: 1,
  knobs: [],
  generate: generateQuestion('poly', 'sc.poly', 1, 61),
}

export const rationalTemplate: TemplateDef = {
  id: 'sc.rational',
  title: 'Rational inequality',
  description: 'Solve a rational inequality and give the solution set in interval notation.',
  version: 1,
  knobs: [],
  generate: generateQuestion('rational', 'sc.rational', 1, 62),
}

export const chartTemplate: TemplateDef = {
  id: 'sc.chart',
  title: 'Critical numbers and signs',
  description: 'Give the critical numbers, the sign on each interval, and the solution set.',
  version: 1,
  knobs: [],
  generate: generateQuestion('chart', 'sc.chart', 1, 63),
}

export const SC_TEMPLATES = [polyTemplate, rationalTemplate, chartTemplate] as const
