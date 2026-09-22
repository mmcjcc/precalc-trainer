import { FN_PATTERN } from '@/content/modules/domainRange/patterns'
import { useStore } from '@/store'
import type { FieldResult, FinalAnswerGrade } from '@/problem/inequality'
import type { FunctionGrade } from '@/engine'
import type { AtomGrade, SigFigGrade, SigFigTapGrade } from '@/shared/types'

/**
 * Store the typed interval / set-builder answers and log one final_answer event per graded input.
 * A field that failed to parse with a named notation pattern (dropped ∪, backwards interval, bracket
 * on ∞, bracket point, empty interval) is logged as a wrong answer with that pattern, so Progress
 * counts the slip; pattern-less syntax errors stay unlogged.
 */
export function recordSetAnswer(grade: FinalAnswerGrade, texts: { interval: string; set: string }): void {
  const s = useStore.getState()
  s.setFinal({ interval: texts.interval, set: texts.set })
  if (grade.mismatch) {
    s.recordFinalAnswer({ correct: false, pattern: grade.mismatch.id, via: 'text' })
    return
  }
  const records: { correct: boolean; pattern?: string }[] = []
  const fields: [FieldResult, boolean | undefined][] = [
    [grade.interval, grade.graded.interval],
    [grade.setBuilder, grade.graded.setBuilder],
  ]
  for (const [field, graded] of fields) {
    if (graded) records.push({ correct: field.status === 'ok', pattern: field.pattern?.id })
    else if (field.status === 'parse' && field.pattern) records.push({ correct: false, pattern: field.pattern.id })
  }
  // Wrong ones first: the attempt's first-check result reads the first record of a check.
  records.sort((a, b) => Number(a.correct) - Number(b.correct))
  for (const r of records) s.recordFinalAnswer({ correct: r.correct, pattern: r.pattern, via: 'text' })
}

/**
 * Log one final_answer event for a typed significant-figures answer (final or intermediate), with
 * the engine's pattern id when it named the mistake. A parse error is not an answer: nothing is
 * logged, like pattern-less syntax errors elsewhere.
 */
export function recordSigFigGrade(grade: SigFigGrade): void {
  if (grade.status === 'parse_error') return
  useStore.getState().recordFinalAnswer({ correct: grade.status === 'correct', pattern: grade.pattern?.id, via: 'text' })
}

/**
 * Log a tap-the-digits check: one correct record, or one wrong record per distinct named mistake
 * among the taps (a plain wrong record when no rule was named), so Progress counts each slip.
 */
export function recordSigFigTaps(grade: SigFigTapGrade): void {
  const s = useStore.getState()
  if (grade.correct) {
    s.recordFinalAnswer({ correct: true, via: 'builder' })
    return
  }
  if (grade.patterns.length === 0) {
    s.recordFinalAnswer({ correct: false, via: 'builder' })
    return
  }
  for (const p of grade.patterns) s.recordFinalAnswer({ correct: false, pattern: p.id, via: 'builder' })
}

/**
 * Log a graph-features check: one correct record, or one wrong record per distinct named mistake
 * (a single plain wrong record when none was named). A blank box is not an answer: nothing is logged.
 */
export function recordGraphFeatures(grade: { correct: boolean; incomplete: boolean; patterns: { id: string }[] }): void {
  if (grade.incomplete) return
  const s = useStore.getState()
  if (grade.correct) {
    s.recordFinalAnswer({ correct: true, via: 'text' })
    return
  }
  if (grade.patterns.length === 0) {
    s.recordFinalAnswer({ correct: false, via: 'text' })
    return
  }
  const seen = new Set<string>()
  for (const p of grade.patterns) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    s.recordFinalAnswer({ correct: false, pattern: p.id, via: 'text' })
  }
}

/**
 * Log one final_answer for a domain, range, composition formula, value, or composite-domain check.
 * A named mistake is stored under its fn_ id so Progress counts it. Unreadable input is not an attempt.
 */
export function recordFunctionGrade(grade: FunctionGrade): void {
  if (grade.verdict === 'invalid' || grade.verdict === 'unsupported') return
  const s = useStore.getState()
  if (grade.verdict === 'correct') {
    s.recordFinalAnswer({ correct: true, via: 'text' })
    return
  }
  if (grade.verdict === 'mistake') {
    s.recordFinalAnswer({ correct: false, pattern: FN_PATTERN[grade.mistake], via: 'text' })
    return
  }
  s.recordFinalAnswer({ correct: false, via: 'text' })
}

/**
 * Log a decomposition check. An unreadable f or g is not an attempt; a trivial or unequal pair is.
 */
export function recordDecomposition(result: { ok: boolean; reason?: string }): void {
  if (!result.ok && (result.reason === 'parse_f' || result.reason === 'parse_g' || result.reason === 'unsupported')) return
  useStore.getState().recordFinalAnswer({ correct: result.ok, via: 'text' })
}

/**
 * Log an atomic-structure check (several boxes at once): one correct record, or one wrong record per
 * distinct named mistake among the boxes (a single plain wrong record when none was named), so
 * Progress counts each slip. An unreadable or empty box is not an answer: nothing is logged.
 */
export function recordAtomGrade(grade: AtomGrade): void {
  if (grade.status === 'parse_error') return
  const s = useStore.getState()
  if (grade.status === 'correct') {
    s.recordFinalAnswer({ correct: true, via: 'text' })
    return
  }
  if (grade.patterns.length === 0) {
    s.recordFinalAnswer({ correct: false, via: 'text' })
    return
  }
  for (const p of grade.patterns) s.recordFinalAnswer({ correct: false, pattern: p.id, via: 'text' })
}
