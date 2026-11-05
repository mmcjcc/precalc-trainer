/**
 * Assembles trigEquations problems. Every seed is one catalog row (seed mod the catalog length), so the
 * same seed always rebuilds the same problem. Each catalog has more than 60 rows and unique statements,
 * so seeds 1..60 are 60 different statements.
 *
 * The factor instructions never write a bare 0: some solution lists contain the angle 0, and the house
 * leak matcher would treat a 0 in "[0, 2π)" as showing that answer.
 */
import { problemId as makeProblemId } from '@/content/registry'
import type { DifficultyKnobs, ProblemInstance, RuleCard, TemplateDef, TrigEquationsAnswer, TrigFigureSpec, TrigPart } from '@/content/types'
import type { CalcPanels, ErrorPatternId, GraphSpec } from '@/shared/types'
import { answerForms, partShownTexts } from '../trig/parts'
import { plain, showsNumber } from '../trig/text'
import { FACTOR_CATALOG, factorShapeAt, factorStages, gradeFactorPart } from './factor'
import { LINEAR_CATALOG, gradeLinearPart, linearStages } from './linear'
import { TE_RULES } from './rules'
import { assertTraps, close } from '../trigFormulas/grade'
import { readExact } from '@/engine/trig'

export const TE_MODULE_ID = 'trigEquations' as const
const VERSION = 1

const EMPTY_GRAPH: GraphSpec = { kind: 'none' }
const EMPTY_CALC: CalcPanels = { ti84: [], nspire: [] }
const NO_FIGURE: TrigFigureSpec = { kind: 'none', deg: 0, label: '', ariaLabel: '' }

const INSTRUCTIONS = {
  linear: 'Isolate the trig function, find the reference angle in radians, then list every solution on [0, 2π).',
  factor: 'Factor into two equations and list every solution on one full turn, from the positive x-axis up to but not including a full turn. Do not divide both sides by the function.',
} as const

const TITLES = {
  linear: 'A linear trig equation',
  factor: 'A quadratic trig equation',
} as const

export type TeQuestion = keyof typeof TITLES

function gradeOf(question: TeQuestion, part: TrigPart, raw: string) {
  return question === 'linear' ? gradeLinearPart(part, raw) : gradeFactorPart(part, raw)
}

function promise(stages: readonly TrigPart[], seed: number): { trap: ErrorPatternId; trapStage: string; trapAnswer: string } {
  const spots = stages.flatMap((stage) => stage.traps.map((trap) => ({ stage, trap })))
  if (spots.length === 0) throw new Error('no named mistake to promise')
  const spot = spots[(seed >>> 0) % spots.length]!
  return { trap: spot.trap.id, trapStage: spot.stage.id, trapAnswer: spot.trap.text }
}

function assertClean(question: TeQuestion, prompt: string, stages: readonly TrigPart[], rules: readonly RuleCard[]): void {
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

function finish(question: TeQuestion, seed: number, prompt: string, stages: TrigPart[], ruleIds: string[]): TrigEquationsAnswer {
  assertClean(question, prompt, stages, TE_RULES.filter((rule) => ruleIds.includes(rule.id)))
  const promised = promise(stages, seed)
  return {
    type: 'trigEquations',
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

function instance(templateId: string, seed: number, knobs: DifficultyKnobs, title: string, instructions: string, answer: TrigEquationsAnswer): ProblemInstance {
  return {
    id: makeProblemId(TE_MODULE_ID, templateId, VERSION, seed),
    moduleId: TE_MODULE_ID,
    templateId,
    skill: templateId,
    genVersion: VERSION,
    seed: seed >>> 0,
    knobs,
    kind: 'trigEquations',
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

/** Plug every stored solution back into the isolated equation. Independent of the list's spelling. */
function checkLinear(item: (typeof LINEAR_CATALOG)[number], stages: readonly TrigPart[]): void {
  const exact = readExact(item.valueText)
  if (!exact || exact === 'undefined') throw new Error(`linear value ${item.valueText}`)
  const target = (exact.c.n / exact.c.d) * Math.sqrt(exact.root)
  const solutions = stages.find((stage) => stage.id === 'solutions')!
  if (solutions.check.kind !== 'angles') throw new Error('solutions part')
  for (const text of solutions.check.degs) {
    const [n, d] = text.split('/')
    const deg = Number(n) / (d ? Number(d) : 1)
    const rad = (deg * Math.PI) / 180
    const got = item.fn === 'sin' ? Math.sin(rad) : item.fn === 'cos' ? Math.cos(rad) : Math.tan(rad)
    if (!close(got, target)) throw new Error(`${item.fn} ${deg}° is ${got}, want ${target}`)
  }
}

export function linearProblem(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const item = LINEAR_CATALOG[(seed >>> 0) % LINEAR_CATALOG.length]!
  const stages = linearStages(item)
  checkLinear(item, stages)
  const answer = finish('linear', seed, item.prompt, stages, ['te-isolate', 'te-solve'])
  return instance('te.linear', seed, knobs, TITLES.linear, INSTRUCTIONS.linear, answer)
}

export function factorProblem(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const index = (seed >>> 0) % FACTOR_CATALOG.length
  const item = FACTOR_CATALOG[index]!
  const { shape, fn } = factorShapeAt(index)
  if (fn !== item.fn) throw new Error('factor catalog drifted')
  const stages = factorStages(shape, fn)
  const answer = finish('factor', seed, item.prompt, stages, ['te-factor', 'te-solve'])
  return instance('te.factor', seed, knobs, TITLES.factor, INSTRUCTIONS.factor, answer)
}

export const TE_TEMPLATES: TemplateDef[] = [
  {
    id: 'te.linear',
    title: TITLES.linear,
    description: 'One trig function, linear in that function: isolate it, name the reference angle in radians, and list every solution on [0, 2π).',
    version: VERSION,
    knobs: [],
    generate: linearProblem,
  },
  {
    id: 'te.factor',
    title: TITLES.factor,
    description: 'A quadratic in sin x, cos x or tan x: factor, solve each factor, and list every solution on one full turn. Never solved by dividing both sides by the function.',
    version: VERSION,
    knobs: [],
    generate: factorProblem,
  },
]
