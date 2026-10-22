/**
 * "Check my own problem" routes (docs/progress/own-problem.md). Pure helpers, no React.
 *  - `/own/<moduleId>`: the builder, where she types her problem;
 *  - `/own/<moduleId>/<templateId>/<statement>`: her problem, the statement URL-encoded, so a reload or a Back-and-
 *    return rebuilds the same problem (and its saved attempt, keyed by an id built from the statement).
 */
import type { Attempt } from '@/store/types'
import { problemPath } from './url'

export function ownBuilderPath(moduleId: string): string {
  return `/own/${moduleId}`
}

export function ownProblemPath(moduleId: string, templateId: string, statement: string): string {
  return `/own/${moduleId}/${templateId}/${encodeURIComponent(statement)}`
}

/** Where an attempt reopens: her own problem's route, or the generated problem's. */
export function attemptPath(attempt: Pick<Attempt, 'moduleId' | 'templateId' | 'seed' | 'difficulty' | 'own'>): string {
  if (attempt.own !== undefined) return ownProblemPath(attempt.moduleId, attempt.templateId, attempt.own)
  return problemPath(attempt.moduleId, attempt.templateId, attempt.seed, attempt.difficulty)
}
