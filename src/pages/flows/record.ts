import { useStore } from '@/store'
import type { FieldResult, FinalAnswerGrade } from '@/problem/inequality'
import type { SigFigGrade, SigFigTapGrade } from '@/shared/types'

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
