import { FN_PATTERN } from '@/content/modules/domainRange/patterns'
import { EC_PATTERN } from '@/content/modules/electrons/patterns'
import { POLY_PATTERN } from '@/content/modules/polynomials/patterns'
import { TR_PATTERN } from '@/content/modules/transformations/patterns'
import { useStore } from '@/store'
import type { FieldResult, FinalAnswerGrade } from '@/problem/inequality'
import type { DescriptionGrade, EconfigGrade, FunctionGrade, PolyGrade, SquareLineGrade, TransformGrade } from '@/engine'
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
/**
 * Log a transformation, piecewise, or rate check. A named mistake is stored under its tr_, pw_, or
 * rate_ id. A description can name several steps at once, so each distinct one is its own record.
 * Unreadable input is not an attempt.
 */
export function recordTransformGrade(grade: TransformGrade | DescriptionGrade): void {
  if (grade.verdict === 'invalid' || grade.verdict === 'unsupported') return
  const s = useStore.getState()
  if (grade.verdict === 'correct') {
    s.recordFinalAnswer({ correct: true, via: 'text' })
    return
  }
  if ('checks' in grade) {
    const seen = new Set<string>()
    for (const check of grade.checks) {
      if (!check.mistake) continue
      const id = TR_PATTERN[check.mistake]
      if (seen.has(id)) continue
      seen.add(id)
      s.recordFinalAnswer({ correct: false, pattern: id, via: 'text' })
    }
    if (seen.size > 0) return
  }
  if (grade.verdict === 'mistake') {
    s.recordFinalAnswer({ correct: false, pattern: TR_PATTERN[grade.mistake], via: 'text' })
    return
  }
  s.recordFinalAnswer({ correct: false, via: 'text' })
}

export function recordDecomposition(result: { ok: boolean; reason?: string }): void {
  if (!result.ok && (result.reason === 'parse_f' || result.reason === 'parse_g' || result.reason === 'unsupported')) return
  useStore.getState().recordFinalAnswer({ correct: result.ok, via: 'text' })
}

/**
 * Log an atomic-structure check (several boxes at once): one correct record, or one wrong record per
 * distinct named mistake among the boxes (a single plain wrong record when none was named), so
 * Progress counts each slip. An unreadable or empty box is not an answer: nothing is logged.
 */
/** Log a spectrum-order check. A sequence she has not finished is not an answer. */
export function recordOrderGrade(grade: { status: 'correct' | 'wrong' | 'incomplete'; pattern?: { id: string } }): void {
  if (grade.status === 'incomplete') return
  useStore.getState().recordFinalAnswer({ correct: grade.status === 'correct', pattern: grade.pattern?.id, via: 'text' })
}

/**
 * Log an electron-configuration check. A named mistake is stored under its ec_ id. Unreadable input,
 * or an answer in the wrong form, is not an attempt: nothing is logged. Two-part diagram questions
 * pass both grades; one invalid part drops the whole check, and a fully correct check is one record.
 */
export function recordEconfigGrades(grades: readonly EconfigGrade[]): void {
  if (grades.length === 0) return
  if (grades.some((g) => g.verdict === 'invalid' || g.verdict === 'unsupported')) return
  const s = useStore.getState()
  const bad = grades.filter((g) => g.verdict !== 'correct')
  if (bad.length === 0) {
    s.recordFinalAnswer({ correct: true, via: 'text' })
    return
  }
  for (const g of bad) {
    s.recordFinalAnswer({
      correct: false,
      pattern: g.verdict === 'mistake' ? EC_PATTERN[g.mistake] : undefined,
      via: 'text',
    })
  }
}

/**
 * Log one polynomial check (Unit 2: completing the square, synthetic division, zeros, rational roots) made of
 * one or more grades: the parts of one press of Check. A named mistake is stored under its poly_ id.
 * Unreadable input, or an answer that is equal but not in the form asked for, is not an attempt: one invalid
 * or unsupported part drops the whole check. All parts correct is ONE correct record; otherwise one wrong
 * record per part that is not correct (a part that is right is not logged on its own).
 */
export function recordPolyGrades(grades: readonly (PolyGrade | SquareLineGrade)[]): void {
  if (grades.length === 0) return
  if (grades.some((g) => g.verdict === 'invalid' || g.verdict === 'unsupported')) return
  const s = useStore.getState()
  const bad = grades.filter((g) => g.verdict !== 'correct')
  if (bad.length === 0) {
    s.recordFinalAnswer({ correct: true, via: 'text' })
    return
  }
  for (const g of bad) {
    s.recordFinalAnswer({
      correct: false,
      pattern: g.verdict === 'mistake' ? POLY_PATTERN[g.mistake] : undefined,
      via: 'text',
    })
  }
}

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
