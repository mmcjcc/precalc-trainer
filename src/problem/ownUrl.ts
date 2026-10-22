/**
 * "Check my own problem" routes (docs/progress/own-problem.md). Pure helpers, no React.
 *  - `/own/<moduleId>`: the builder, where she types her problem;
 *  - `/own/<moduleId>/<templateId>/<statement>?d=<flags>`: her problem, the statement URL-encoded, so a reload or a
 *    Back-and-return rebuilds the same problem (and its saved attempt, keyed by an id built from the statement). The
 *    flags are what she asked of the answer (`ownFlags`: 'r3' rounded to three decimal places; none for the exact
 *    answer), as a generated problem's route carries its difficulty flags, and the attempt keeps them in `difficulty`.
 */
import type { Attempt } from '@/store/types'
import { problemPath } from './url'

export function ownBuilderPath(moduleId: string): string {
  return `/own/${moduleId}`
}

export function ownProblemPath(moduleId: string, templateId: string, statement: string, flags = ''): string {
  return `/own/${moduleId}/${templateId}/${encodeURIComponent(statement)}${flags ? `?d=${encodeURIComponent(flags)}` : ''}`
}

/** Where an attempt reopens: her own problem's route, or the generated problem's. */
export function attemptPath(attempt: Pick<Attempt, 'moduleId' | 'templateId' | 'seed' | 'difficulty' | 'own'>): string {
  if (attempt.own !== undefined) return ownProblemPath(attempt.moduleId, attempt.templateId, attempt.own, attempt.difficulty)
  return problemPath(attempt.moduleId, attempt.templateId, attempt.seed, attempt.difficulty)
}
