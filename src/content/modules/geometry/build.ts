/**
 * Shared shell for every geometry problem: the instance, the box keys, and the tutor's lines.
 * Units 2 and 3 should call this instead of copying a flow.
 */
import { problemId } from '@/content/registry'
import type { DifficultyKnobs, GeometryAnswer, GeometryStageId, ProblemInstance } from '@/content/types'
import type { CalcPanels, ModuleId } from '@/shared/types'
import { assertGeoAnswer } from './grade'
import { reasonLabel } from './reasons'

export type { GeometryAnswer }

/** Box key for every part. Unit 1 uses `x` and `result`; Unit 2 uses `a` through `h`. */
export const GEO_KEYS: Record<GeometryStageId, string> = {
  x: 'x',
  result: 'result',
  a: 'a',
  b: 'b',
  c: 'c',
  d: 'd',
  e: 'e',
  f: 'f',
  g: 'g',
  h: 'h',
}

const NO_GRAPH = { kind: 'none' as const }
const NO_CALC: CalcPanels = { ti84: [], nspire: [] }

export interface GeoBuilt {
  answer: GeometryAnswer
  title: string
  instructions: string
  params: Record<string, number | string | boolean>
}

export function geoInstance(
  moduleId: ModuleId,
  templateId: string,
  version: number,
  seed: number,
  knobs: DifficultyKnobs,
  built: GeoBuilt,
): ProblemInstance {
  assertGeoAnswer(`${templateId}/${seed}`, built.answer)
  return {
    id: problemId(moduleId, templateId, version, seed),
    moduleId,
    templateId,
    skill: templateId,
    genVersion: version,
    seed: seed >>> 0,
    knobs,
    kind: 'geometry',
    title: built.title,
    instructions: built.instructions,
    statementText: built.answer.prompt,
    vars: [],
    start: null,
    canonical: [],
    answer: built.answer,
    graph: NO_GRAPH,
    calc: NO_CALC,
    params: { ...built.params, trap: built.answer.trap, trapStage: built.answer.trapStage },
  }
}

export function canonicalEntries(answer: GeometryAnswer): Record<string, string> {
  const out: Record<string, string> = {}
  for (const stage of answer.stages) out[GEO_KEYS[stage.id]] = stage.answerText
  return out
}

/** Her boxes, in the order she fills them, for the tutor. */
export function geoWork(answer: GeometryAnswer, entries: Record<string, string> | undefined): string[] {
  if (!entries) return []
  const lines: string[] = []
  for (const stage of answer.stages) {
    const text = entries[GEO_KEYS[stage.id]]?.trim()
    if (text) lines.push(`${stage.label}: ${shownEntry(stage, text)}`)
  }
  return lines
}

/** The words she picked. Choice and reason boxes store an id; the tutor should see the sentence or the reason name. */
function shownEntry(stage: GeometryAnswer['stages'][number], text: string): string {
  if (stage.kind === 'choice') return stage.choices?.find((choice) => choice.id === text)?.text ?? text
  if (stage.kind === 'reason') return reasonLabel(text)
  return text
}
