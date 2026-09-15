import { useStore } from '@/store'
import type { FieldResult, FinalAnswerGrade } from '@/problem/inequality'

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
