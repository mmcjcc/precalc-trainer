import { problemId } from '@/content/registry'
import type { AnswerSpec, DifficultyKnobs, ProblemInstance } from '@/content/types'
import type { CalcPanels, SolutionSet } from '@/shared/types'
import { finiteXs, xWindow } from '../fnExpr'

const NO_CALC: CalcPanels = { ti84: [], nspire: [] }

export interface CompositionDraft {
  templateId: 'comp.expr' | 'comp.value' | 'comp.domain' | 'comp.decompose'
  version: number
  seed: number
  knobs: DifficultyKnobs
  title: string
  instructions: string
  /** What the gold box states, in app syntax (f and g, or h). */
  statementText: string
  /** The curve behind the reveal gate. The unsimplified composite when the simplified formula would lie. */
  graphF: string
  window: number[]
  answer: Extract<AnswerSpec, { type: 'composition' }>
  params: Record<string, number | string | boolean>
}

export function buildComposition(d: CompositionDraft): ProblemInstance {
  return {
    id: problemId('composition', d.templateId, d.version, d.seed),
    moduleId: 'composition',
    templateId: d.templateId,
    skill: d.templateId,
    genVersion: d.version,
    seed: d.seed >>> 0,
    knobs: d.knobs,
    kind: 'composition',
    title: d.title,
    instructions: d.instructions,
    statementText: d.statementText,
    vars: ['x'],
    start: null,
    canonical: [],
    answer: d.answer,
    graph: { kind: 'function', f: d.graphF, xDomain: xWindow(d.window) },
    calc: NO_CALC,
    params: d.params,
  }
}

export function windowFrom(set: SolutionSet | null | undefined, extra: number[] = []): number[] {
  return [...(set ? finiteXs(set) : []), ...extra]
}
