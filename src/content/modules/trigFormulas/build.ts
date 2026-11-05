/**
 * Assembles trigFormulas problems. Every seed is one catalog row (seed mod the catalog length), so the
 * same seed always rebuilds the same problem. Statements are unique across a catalog, and each catalog
 * has more than 60 rows, so seeds 1..60 are 60 different statements.
 */
import { problemId as makeProblemId } from '@/content/registry'
import type { DifficultyKnobs, ProblemInstance, RuleCard, TemplateDef, TrigFigureSpec, TrigFormulasAnswer, TrigPart } from '@/content/types'
import type { CalcPanels, ErrorPatternId, GraphSpec } from '@/shared/types'
import { answerForms, partShownTexts } from '../trig/parts'
import { plain, showsNumber } from '../trig/text'
import { DOUBLE_CATALOG, doubleStages } from './double'
import { assertTraps, close, gradeExactValue, readNumber } from './grade'
import { HALF_CATALOG, halfStages } from './half'
import { TF_RULES } from './rules'
import { SUM_CATALOG, gradeSumPart, sumStages } from './sumdiff'
import { gradeDoublePart } from './double'
import { gradeHalfPart } from './half'

export const TF_MODULE_ID = 'trigFormulas' as const
const VERSION = 1

const EMPTY_GRAPH: GraphSpec = { kind: 'none' }
const EMPTY_CALC: CalcPanels = { ti84: [], nspire: [] }
const NO_FIGURE: TrigFigureSpec = { kind: 'none', deg: 0, label: '', ariaLabel: '' }

const INSTRUCTIONS = {
  sumdiff: 'Use a sum or difference formula. Leave the answer exact.',
  double: 'Use a double-angle formula. Leave every answer exact, sign included.',
  half: 'Use a half-angle formula. The sign comes from where the half angle lands.',
} as const

const TITLES = {
  sumdiff: 'Exact value from a sum or difference',
  double: 'Double-angle values',
  half: 'Half-angle values',
} as const

export type TfQuestion = keyof typeof TITLES

function gradeOf(question: TfQuestion, part: TrigPart, raw: string) {
  if (question === 'sumdiff') return gradeSumPart(part, raw)
  if (question === 'double') return gradeDoublePart(part, raw)
  return gradeHalfPart(part, raw)
}

function promise(stages: readonly TrigPart[], seed: number): { trap: ErrorPatternId; trapStage: string; trapAnswer: string } {
  const spots = stages.flatMap((stage) => stage.traps.map((trap) => ({ stage, trap })))
  if (spots.length === 0) throw new Error('no named mistake to promise')
  const spot = spots[(seed >>> 0) % spots.length]!
  return { trap: spot.trap.id, trapStage: spot.stage.id, trapAnswer: spot.trap.text }
}

function assertClean(question: TfQuestion, prompt: string, stages: readonly TrigPart[], rules: readonly RuleCard[]): void {
  const around = [
    prompt,
    INSTRUCTIONS[question],
    ...rules.flatMap((rule) => [rule.title, rule.body, rule.example ?? '']),
    ...stages.flatMap((stage) => partShownTexts(stage)),
  ]
  for (const stage of stages) {
    assertTraps(stage, (text) => gradeOf(question, stage, text))
    const forms = answerForms(stage)
    if (forms.length > 0 && showsNumber(around, forms)) {
      throw new Error(`${question} ${stage.id} shows its answer early (${forms.join(' | ')})`)
    }
  }
}

function finish(
  question: TfQuestion,
  seed: number,
  prompt: string,
  stages: TrigPart[],
  ruleIds: string[],
): TrigFormulasAnswer {
  assertClean(question, prompt, stages, TF_RULES.filter((rule) => ruleIds.includes(rule.id)))
  const promised = promise(stages, seed)
  return {
    type: 'trigFormulas',
    question,
    prompt,
    figure: NO_FIGURE,
    stages,
    expectedDisplay: stages.map((stage) => `${stage.label}: ${stage.answerText}`).join('; '),
    nudge: stages[0]!.nudge,
    ruleCard: stages[0]!.ruleCard,
    ruleCards: ruleIds,
    reveal: stages.flatMap((stage) => stage.reveal),
    ...promised,
  }
}

function instance(templateId: string, seed: number, knobs: DifficultyKnobs, title: string, instructions: string, answer: TrigFormulasAnswer): ProblemInstance {
  return {
    id: makeProblemId(TF_MODULE_ID, templateId, VERSION, seed),
    moduleId: TF_MODULE_ID,
    templateId,
    skill: templateId,
    genVersion: VERSION,
    seed: seed >>> 0,
    knobs,
    kind: 'trigFormulas',
    title,
    instructions,
    statementText: plain(answer.prompt),
    vars: [],
    start: null,
    canonical: [],
    answer,
    graph: EMPTY_GRAPH,
    calc: EMPTY_CALC,
    params: { question: answer.question, trap: answer.trap ?? '', trapStage: answer.trapStage ?? '' },
  }
}

function checkDouble(item: (typeof DOUBLE_CATALOG)[number], stages: readonly TrigPart[]): void {
  const given = readNumber(item.givenText)
  const missing = readNumber(item.missingText)
  const sin2 = readNumber(item.sin2)
  const cos2 = readNumber(item.cos2)
  const tan2 = readNumber(item.tan2)
  if (!given || !missing || !sin2 || !cos2 || !tan2) throw new Error('double value did not read')
  const sin = item.given === 'sin' ? given.approx : missing.approx
  const cos = item.given === 'cos' ? given.approx : missing.approx
  if (!close(sin * sin + cos * cos, 1)) throw new Error('sin² + cos² is not 1')
  if (!close(sin2.approx, 2 * sin * cos)) throw new Error('sin 2θ')
  if (!close(cos2.approx, cos * cos - sin * sin)) throw new Error('cos 2θ')
  if (!close(tan2.approx, sin2.approx / cos2.approx)) throw new Error('tan 2θ')
  for (const stage of stages) {
    if (stage.kind !== 'value') continue
    const got = gradeExactValue(stage, stage.answerText)
    if (got.verdict !== 'correct') throw new Error(stage.id)
  }
}

function checkHalf(item: (typeof HALF_CATALOG)[number]): void {
  const cos = readNumber(item.cosText)
  const value = readNumber(item.value)
  if (!cos || !value) throw new Error('half value did not read')
  const mag =
    item.fn === 'sin'
      ? Math.sqrt((1 - cos.approx) / 2)
      : item.fn === 'cos'
        ? Math.sqrt((1 + cos.approx) / 2)
        : Math.sqrt((1 - cos.approx) / (1 + cos.approx))
  const signed = item.sign === '+' ? mag : -mag
  if (!close(value.approx, signed)) throw new Error(`${item.fn} half ${item.value} is ${value.approx}, want ${signed}`)
}

export function sumdiffProblem(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const item = SUM_CATALOG[(seed >>> 0) % SUM_CATALOG.length]!
  const stages = sumStages(item)
  const answer = finish('sumdiff', seed, item.prompt, stages, ['tf-sum'])
  return instance('ta.sumdiff', seed, knobs, TITLES.sumdiff, INSTRUCTIONS.sumdiff, answer)
}

export function doubleProblem(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const item = DOUBLE_CATALOG[(seed >>> 0) % DOUBLE_CATALOG.length]!
  const stages = doubleStages(item)
  checkDouble(item, stages)
  const answer = finish('double', seed, item.prompt, stages, ['tf-double'])
  return instance('ta.double', seed, knobs, TITLES.double, INSTRUCTIONS.double, answer)
}

export function halfProblem(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const item = HALF_CATALOG[(seed >>> 0) % HALF_CATALOG.length]!
  const stages = halfStages(item)
  checkHalf(item)
  const answer = finish('half', seed, item.prompt, stages, ['tf-half'])
  return instance('ta.half', seed, knobs, TITLES.half, INSTRUCTIONS.half, answer)
}

export const TF_TEMPLATES: TemplateDef[] = [
  {
    id: 'ta.sumdiff',
    title: TITLES.sumdiff,
    description: 'Exact sin, cos, tan, csc, sec or cot of 15°, 75°, 105° or 165° (or the radian twin) from a sum or difference.',
    version: VERSION,
    knobs: [],
    generate: sumdiffProblem,
  },
  {
    id: 'ta.double',
    title: TITLES.double,
    description: 'From sin θ or cos θ as a fraction and the quadrant: the other ratio, then sin, cos and tan of 2θ.',
    version: VERSION,
    knobs: [],
    generate: doubleProblem,
  },
  {
    id: 'ta.half',
    title: TITLES.half,
    description: 'From cos θ and an interval for θ: the quadrant and sign of θ/2, then sin, cos or tan of θ/2.',
    version: VERSION,
    knobs: [],
    generate: halfProblem,
  },
]
