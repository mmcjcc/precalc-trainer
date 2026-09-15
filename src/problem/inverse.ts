/**
 * Inverse flow logic (BUILD_GUIDE §7): one-to-one verdict, completion detection of the step
 * column, and the "check it" card. Pure — no React, no store.
 */
import { exprEquivalent, isOneToOne, normalizeInput, parseExpression } from '@/engine'
import type { AnswerSpec, CheckValue, OneToOneReason } from '@/content/types'

export type InverseAnswer = Extract<AnswerSpec, { type: 'inverse' }>

export const ONE_TO_ONE_REASONS: { id: OneToOneReason; label: string }[] = [
  { id: 'fails_hlt', label: 'A horizontal line crosses the graph twice (fails the horizontal line test)' },
  { id: 'even_power_pm', label: 'An even power: undoing it gives ± — two inputs share one output' },
  { id: 'repeated_y', label: 'Two different inputs give the same y' },
]

export interface OneToOneGrade {
  correct: boolean
  message: string
  /** Concrete evidence when she said "yes" but it is not one-to-one. */
  witness?: { a: number; b: number; y: number }
}

/**
 * Grade the one-to-one verdict. Reason is required only for "no"; any of the three reasons is
 * accepted when the answer lists none, and the stored reason is preferred when it does.
 */
export function gradeOneToOne(
  answer: InverseAnswer,
  f: string,
  verdict: 'yes' | 'no',
  reason: OneToOneReason | null,
  seed?: number,
): OneToOneGrade {
  const truth = answer.oneToOne
  if (verdict === 'yes') {
    if (truth) return { correct: true, message: 'Yes — every output comes from exactly one input, so f has an inverse.' }
    const w = isOneToOne(f, seed).witness
    const witness = w ? `f(${w.a}) = f(${w.b}) = ${w.y}` : 'two different inputs share an output'
    return {
      correct: false,
      message: `Not one-to-one: ${witness}. A horizontal line through y = ${w?.y ?? '…'} crosses the graph twice, so no single inverse undoes it.`,
      witness: w,
    }
  }
  // verdict === 'no'
  if (truth) {
    return { correct: false, message: 'It IS one-to-one: every horizontal line crosses the graph at most once, so each output has one input.' }
  }
  if (!reason) return { correct: false, message: 'Right that it is not one-to-one — now say why.' }
  if (!answer.reason || answer.reason === reason) {
    return { correct: true, message: `Yes — not one-to-one. ${reasonSentence(reason)}` }
  }
  return {
    correct: false,
    message: `Not one-to-one, but the reason here is: ${reasonSentence(answer.reason)}`,
  }
}

function reasonSentence(reason: OneToOneReason): string {
  switch (reason) {
    case 'fails_hlt':
      return 'A horizontal line crosses the graph twice.'
    case 'even_power_pm':
      return 'Undoing an even power gives ±, so two inputs share every positive output.'
    case 'repeated_y':
      return 'Two different inputs give the same y.'
  }
}

/** "f(k) = f(twin) = fk" evidence for the not-one-to-one case. */
export function twinEvidence(check: CheckValue | undefined): string | null {
  if (!check || check.twin === undefined) return null
  return `f(${check.k}) = f(${check.twin}) = ${check.fk}`
}

/**
 * Is the current line `y = E` (or `E = y`, or `f^-1(x) = E`) with E ≡ the stored inverse in x?
 * Returns E when it is, else null.
 */
export function detectInverseCompletion(currentLine: string | null, inverse: string | undefined, seed?: number): string | null {
  if (!currentLine || !inverse) return null
  const norm = normalizeInput(currentLine).trim()
  const eq = norm.indexOf('=')
  if (eq < 0 || norm.indexOf('=', eq + 1) >= 0) return null
  const left = norm.slice(0, eq).trim()
  const right = norm.slice(eq + 1).trim()
  let expr: string | null = null
  if (left === 'y') expr = right
  else if (right === 'y') expr = left
  if (!expr || /y/.test(expr)) return null
  const parsed = parseExpression(expr, ['x'])
  if (!parsed.ok) return null
  return exprEquivalent(expr, inverse, ['x'], seed).equivalent ? expr : null
}

export interface CheckItGrade {
  fk: { status: 'empty' | 'parse' | 'wrong' | 'ok'; message: string }
  back: { status: 'empty' | 'parse' | 'wrong' | 'ok'; message: string }
  done: boolean
}

function parseNumber(text: string): number | null {
  const t = text.trim().replace(/−/g, '-')
  if (!t) return null
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  const frac = /^(-?\d+)\s*\/\s*(-?\d+)$/.exec(t)
  if (frac) {
    const d = Number(frac[2])
    return d === 0 ? null : Number(frac[1]) / d
  }
  return null
}

export interface TwinGrade {
  fk: CheckItGrade['fk']
  twin: CheckItGrade['fk']
  done: boolean
}

/**
 * Not-one-to-one evidence: she computes f(k) and f(twin) and sees they are the same number.
 * Both are graded against check.fk (the twin shares k's output by construction).
 */
export function gradeTwin(fkText: string, twinText: string, check: CheckValue): TwinGrade {
  const twin = check.twin
  const grade = (text: string, input: number, first: boolean): CheckItGrade['fk'] => {
    const what = `f(${input})`
    if (!text.trim()) return { status: 'empty', message: '' }
    const v = parseNumber(text)
    if (v === null) return { status: 'parse', message: `Type a number for ${what} (an integer or a fraction like -3/2).` }
    if (Math.abs(v - check.fk) < 1e-9) {
      return { status: 'ok', message: first ? `✓ ${what} = ${check.fk}` : `✓ ${what} = ${check.fk} — the same output as f(${check.k})` }
    }
    return {
      status: 'wrong',
      message: `${what} should be ${check.fk}, not ${text.trim()}. Plug ${input} in again, one operation at a time — square the parentheses before you multiply.`,
    }
  }
  const fk = grade(fkText, check.k, true)
  const tw = twin === undefined ? { status: 'ok' as const, message: '' } : grade(twinText, twin, false)
  return { fk, twin: tw, done: fk.status === 'ok' && tw.status === 'ok' }
}

/** Grade f(k) = ? and f⁻¹(f(k)) = ? against the stored check value. */
export function gradeCheckIt(fkText: string, backText: string, check: CheckValue): CheckItGrade {
  const grade = (text: string, expected: number, what: string): CheckItGrade['fk'] => {
    if (!text.trim()) return { status: 'empty', message: '' }
    const v = parseNumber(text)
    if (v === null) return { status: 'parse', message: `Type a number for ${what} (an integer or a fraction like -3/2).` }
    if (Math.abs(v - expected) < 1e-9) return { status: 'ok', message: `✓ ${what} = ${expected}` }
    return { status: 'wrong', message: `${what} should be ${expected}, not ${text.trim()}. Plug ${what === `f(${check.k})` ? check.k : check.fk} in again, one operation at a time.` }
  }
  const fk = grade(fkText, check.fk, `f(${check.k})`)
  const back = grade(backText, check.k, `f⁻¹(${check.fk})`)
  return { fk, back, done: fk.status === 'ok' && back.status === 'ok' }
}
