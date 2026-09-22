import { problemId } from '@/content/registry'
import type { DifficultyKnobs, ProblemInstance } from '@/content/types'
import type { CalcPanels, SolutionSet } from '@/shared/types'
import { finiteXs, xWindow } from '../fnExpr'

const NO_CALC: CalcPanels = { ti84: [], nspire: [] }

export interface DomainRangeDraft {
  question: 'domain' | 'range'
  templateId: 'dr.domain' | 'dr.range'
  version: number
  seed: number
  knobs: DifficultyKnobs
  title: string
  instructions: string
  f: string
  interval: string
  builder: string
  set: SolutionSet
  family?: string
  nudge: string
  ruleCard: string
  ruleCards: string[]
  reveal: string[]
  trap: string
}

export function buildDomainRange(d: DomainRangeDraft): ProblemInstance {
  return {
    id: problemId('domainRange', d.templateId, d.version, d.seed),
    moduleId: 'domainRange',
    templateId: d.templateId,
    skill: d.templateId,
    genVersion: d.version,
    seed: d.seed >>> 0,
    knobs: d.knobs,
    kind: 'domainRange',
    title: d.title,
    instructions: d.instructions,
    statementText: `f(x) = ${d.f}`,
    vars: ['x'],
    start: null,
    canonical: [],
    answer: {
      type: 'domainRange',
      question: d.question,
      f: d.f,
      interval: d.interval,
      builder: d.builder,
      set: d.set,
      family: d.family,
      nudge: d.nudge,
      ruleCard: d.ruleCard,
      ruleCards: d.ruleCards,
      reveal: d.reveal,
      trap: d.trap,
    },
    graph: { kind: 'function', f: d.f, xDomain: xWindow(finiteXs(d.set)) },
    calc: NO_CALC,
    params: { f: d.f, trap: d.trap, question: d.question },
  }
}
