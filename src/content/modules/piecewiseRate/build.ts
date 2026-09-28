import { problemId } from '@/content/registry'
import type { DifficultyKnobs, ProblemInstance } from '@/content/types'
import type { CalcPanels } from '@/shared/types'

const NO_CALC: CalcPanels = { ti84: [], nspire: [] }
const NO_GRAPH = { kind: 'none' as const }

interface PieceDraft {
  formula: string
  condition: string
  lo: string
  hi: string
  loClosed: boolean
  hiClosed: boolean
}

export interface EvaluateBuild {
  version: number
  seed: number
  knobs: DifficultyKnobs
  pieces: PieceDraft[]
  x: string
  valueText: string
  nudge: string
  reveal: string[]
  trap: string
}

export function buildEvaluate(d: EvaluateBuild): ProblemInstance {
  const shown = d.pieces.map((p) => `${p.formula} for ${p.condition}`).join('; ')
  return {
    id: problemId('piecewiseRate', 'pw.evaluate', d.version, d.seed),
    moduleId: 'piecewiseRate',
    templateId: 'pw.evaluate',
    skill: 'pw.evaluate',
    genVersion: d.version,
    seed: d.seed >>> 0,
    knobs: d.knobs,
    kind: 'piecewiseRate',
    title: 'Evaluate the piecewise function',
    instructions: 'Find f at the given x. If no piece includes that x, the answer is undefined.',
    statementText: `f(x) = ${shown}. Find f(${d.x}).`,
    vars: ['x'],
    start: null,
    canonical: [],
    answer: {
      type: 'piecewiseRate',
      question: 'evaluate',
      pieces: d.pieces,
      x: d.x,
      valueText: d.valueText,
      nudge: d.nudge,
      ruleCard: 'pw-boundary',
      ruleCards: ['pw-boundary'],
      reveal: d.reveal,
      trap: d.trap,
    },
    graph: NO_GRAPH,
    calc: NO_CALC,
    params: { trap: d.trap, question: 'evaluate', x: d.x },
  }
}

export interface RateBuild {
  version: number
  seed: number
  knobs: DifficultyKnobs
  f: string
  a: string
  b: string
  rateText: string
  nudge: string
  reveal: string[]
  trap: string
}

export function buildRate(d: RateBuild): ProblemInstance {
  return {
    id: problemId('piecewiseRate', 'arc.rate', d.version, d.seed),
    moduleId: 'piecewiseRate',
    templateId: 'arc.rate',
    skill: 'arc.rate',
    genVersion: d.version,
    seed: d.seed >>> 0,
    knobs: d.knobs,
    kind: 'piecewiseRate',
    title: 'Average rate of change',
    instructions: 'Give the exact average rate of change of f on the interval, as an integer or a fraction.',
    statementText: `Average rate of change of f(x) = ${d.f} on [${d.a}, ${d.b}].`,
    vars: ['x'],
    start: null,
    canonical: [],
    answer: {
      type: 'piecewiseRate',
      question: 'rate',
      f: d.f,
      a: d.a,
      b: d.b,
      rateText: d.rateText,
      nudge: d.nudge,
      ruleCard: 'pw-rate',
      ruleCards: ['pw-rate'],
      reveal: d.reveal,
      trap: d.trap,
    },
    graph: NO_GRAPH,
    calc: NO_CALC,
    params: { trap: d.trap, question: 'rate', f: d.f },
  }
}
