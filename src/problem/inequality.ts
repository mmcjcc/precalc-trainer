/**
 * Final-answer grading for inequality and number-line problems: interval + set-builder inputs,
 * cross-checked against each other first (set_interval_mismatch), then against the target set.
 * Pure — no React, no store.
 */
import { compareAnswerSet, crossCheck, parseInterval, parseSetBuilder } from '@/notation'
import type { ParseError, PatternHit, SolutionSet } from '@/shared/types'

export type FieldStatus = 'empty' | 'parse' | 'wrong' | 'ok'

export interface FieldResult {
  status: FieldStatus
  /** Parse error with position (shown under the input, not an attempt). */
  error?: ParseError
  /** Coaching pattern when the value is legal notation but the wrong set. */
  pattern?: PatternHit
  /** Sentence for the student. */
  message: string
  set?: SolutionSet
}

export interface FinalAnswerTarget {
  set: SolutionSet
  requireInterval: boolean
  requireSetBuilder: boolean
}

export interface FinalAnswerGrade {
  interval: FieldResult
  setBuilder: FieldResult
  /** Both parsed but describe different sets — reported before either is compared to the target. */
  mismatch?: PatternHit
  /** Every required input agrees with the target. */
  done: boolean
  /** Which inputs were actually graded against the target this round (for event logging). */
  graded: { interval?: boolean; setBuilder?: boolean }
}

function empty(): FieldResult {
  return { status: 'empty', message: '' }
}

function gradeAgainstTarget(set: SolutionSet, target: SolutionSet, what: string): FieldResult {
  const cmp = compareAnswerSet(set, target)
  if (cmp.equal) return { status: 'ok', message: `✓ ${what} matches the solution set.`, set }
  const message = cmp.pattern?.witness ?? cmp.pattern?.lesson ?? `That ${what.toLowerCase()} is not the solution set.`
  return { status: 'wrong', pattern: cmp.pattern, message, set }
}

/**
 * Grade the two final-answer inputs. Empty inputs stay `empty` (not wrong). A parse failure keeps
 * the notation pattern (backwards interval, dropped union, bracket point) as coaching text.
 */
export function gradeFinalAnswer(intervalText: string, setBuilderText: string, target: FinalAnswerTarget): FinalAnswerGrade {
  let interval = empty()
  let setBuilder = empty()
  const graded: FinalAnswerGrade['graded'] = {}

  const it = intervalText.trim()
  if (it) {
    const p = parseInterval(it)
    if (p.ok) interval = { status: 'ok', message: '', set: p.set }
    else interval = { status: 'parse', error: p.error, pattern: p.pattern, message: p.pattern?.lesson ?? p.error.message }
  }
  const st = setBuilderText.trim()
  if (st) {
    const p = parseSetBuilder(st)
    if (p.ok) setBuilder = { status: 'ok', message: '', set: p.set }
    else setBuilder = { status: 'parse', error: p.error, pattern: p.pattern, message: p.pattern?.lesson ?? p.error.message }
  }

  // Cross-check first: the two answers must agree with each other before either is judged.
  let mismatch: PatternHit | undefined
  if (interval.set && setBuilder.set) {
    const cc = crossCheck(interval.set, setBuilder.set)
    if (!cc.agree) {
      mismatch = cc.pattern
      const msg = cc.pattern?.witness ?? cc.pattern?.lesson ?? 'Your interval and your set-builder describe different numbers.'
      interval = { ...interval, status: 'wrong', message: msg, pattern: cc.pattern }
      setBuilder = { ...setBuilder, status: 'wrong', message: msg, pattern: cc.pattern }
      graded.interval = true
      graded.setBuilder = true
      return { interval, setBuilder, mismatch, done: false, graded }
    }
  }

  if (interval.set) {
    interval = gradeAgainstTarget(interval.set, target.set, 'Interval')
    graded.interval = true
  }
  if (setBuilder.set) {
    setBuilder = gradeAgainstTarget(setBuilder.set, target.set, 'Set-builder')
    graded.setBuilder = true
  }

  const intervalOk = target.requireInterval ? interval.status === 'ok' : interval.status === 'ok' || interval.status === 'empty'
  const builderOk = target.requireSetBuilder ? setBuilder.status === 'ok' : setBuilder.status === 'ok' || setBuilder.status === 'empty'
  const anyAnswered = interval.status !== 'empty' || setBuilder.status !== 'empty'
  return { interval, setBuilder, done: anyAnswered && intervalOk && builderOk, graded }
}

/** Live number-line preview of the typed interval (null while it does not parse). */
export function previewInterval(text: string): SolutionSet | null {
  const t = text.trim()
  if (!t) return null
  const p = parseInterval(t)
  return p.ok ? p.set : null
}
