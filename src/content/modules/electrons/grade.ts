/**
 * Grades a light answer. Order, exactly:
 *   1. gradeSigFigAnswer — correct (or unreadable) stops here.
 *   2. each lt_ task, evaluated exactly and rounded to HER significant figures.
 *   3. the sig-fig grader's own result (an sf_ slip, or its plain message).
 * A match is value equality after roundToSigFigs, never a float tolerance.
 * Spectrum order has no calculation: the reverse ranking is lt_order_reversed.
 */
import type { ElectronsLightQuestion, ElectronsOrderQuestion } from '@/content/types'
import { evaluateSigFigTask, gradeSigFigAnswer, patternHit, roundToSigFigs, validateSigFigTask } from '@/engine'
import type { ErrorPatternId, PatternHit, SigFigEvaluation, SigFigGrade, SigFigRounding } from '@/shared/types'
import { mistakeSpecs } from './tasks'

export const LT_MISTAKE_IDS = [
  'lt_no_conversion',
  'lt_conversion_backwards',
  'lt_multiplied',
  'lt_inverted',
  'lt_energy_divided',
  'lt_energy_no_c',
  'lt_wrong_unit',
  'lt_order_reversed',
] as const satisfies readonly ErrorPatternId[]

const ELLIPSIS = '…'

function sigDigitsShown(text: string): number {
  const digits = text.trim().replace(/^[+-]/, '').replace('.', '').replace(/^0+/, '')
  return digits.length
}

/**
 * Keep the first `keep` significant digits and drop the rest (no rounding). The parser refuses
 * more than 30 significant digits, and a frequency divided by h is far past that, but rounding
 * to n figures only needs the next digit. Chopping there leaves the rounded value unchanged.
 */
function chopSigDigits(text: string, keep: number): string {
  const trimmed = text.trim()
  const neg = trimmed.startsWith('-')
  const body = trimmed.replace(/^[+-]/, '')
  const point = body.indexOf('.')
  const digits = body.replace('.', '')
  let i = 0
  while (i < digits.length && digits[i] === '0') i++
  const sig = digits.slice(i, i + keep)
  if (sig.length === 0) return '0'
  const intDigits = point < 0 ? digits.length : point
  const firstPlace = intDigits - 1 - i
  const exp = firstPlace - (sig.length - 1)
  const sign = neg ? '-' : ''
  if (exp >= 0) return sign + sig + '0'.repeat(exp)
  const frac = -exp
  if (frac >= sig.length) return sign + '0.' + '0'.repeat(frac - sig.length) + sig
  return sign + sig.slice(0, sig.length - frac) + '.' + sig.slice(sig.length - frac)
}

/**
 * The evaluation's exact value, rounded to `sigFigs`. Null when the published digits cannot
 * decide that rounding (a non-terminating display shorter than the cut). When the first dropped
 * digit is on the page, chopping the rest does not change the rounded value: digits 0–4 always
 * stay, 6–9 always round up, and a 5 rounds up whether or not further digits make it a tie.
 */
export function roundEvaluation(ev: SigFigEvaluation, sigFigs: number): SigFigRounding | null {
  if (!Number.isInteger(sigFigs) || sigFigs < 1) return null
  let text: string
  if (ev.unroundedTerminates) {
    text = ev.unrounded
  } else if (ev.unrounded.endsWith(ELLIPSIS)) {
    text = ev.unrounded.slice(0, -1)
  } else {
    return null
  }
  const shown = sigDigitsShown(text)
  if (!ev.unroundedTerminates && shown < sigFigs + 1) return null
  // 30 is the parser's cap. n + 1 digits decide a rounding to n figures.
  if (shown > sigFigs && sigFigs + 1 <= 30) text = chopSigDigits(text, sigFigs + 1)
  else if (shown > 30) return null
  try {
    return roundToSigFigs(text, sigFigs)
  } catch {
    return null
  }
}

function named(id: ErrorPatternId, witness: string, base: SigFigGrade): SigFigGrade {
  return { status: 'wrong', message: witness, pattern: patternHit(id, witness), parsed: base.parsed }
}

/** Grade a typed numeral for a light calculation. */
export function gradeLightAnswer(question: ElectronsLightQuestion, typed: string): SigFigGrade {
  const base = gradeSigFigAnswer(question.task, typed)
  if (base.status !== 'wrong' || !base.parsed || base.parsed.isZero || base.parsed.sigFigs < 1) return base
  const hers = base.parsed
  let correctEv: SigFigEvaluation
  try {
    correctEv = evaluateSigFigTask(question.task)
  } catch {
    return base
  }
  const correctAtHers = roundEvaluation(correctEv, hers.sigFigs)
  // Right arithmetic, wrong number of figures: the sig-fig grader already named it (or said so plainly).
  if (correctAtHers && correctAtHers.value === hers.value) return base

  for (const spec of mistakeSpecs(question)) {
    let ev: SigFigEvaluation
    try {
      if (validateSigFigTask(spec.task).some((issue) => issue.code === 'invalid')) continue
      ev = evaluateSigFigTask(spec.task)
    } catch {
      continue
    }
    const rounded = roundEvaluation(ev, hers.sigFigs)
    if (!rounded || rounded.value !== hers.value) continue
    if (correctAtHers && rounded.value === correctAtHers.value) continue
    return named(spec.id, spec.witness(hers.display), base)
  }
  return base
}

/**
 * What she would write for `id` if she did that wrong operation and rounded to the figures this
 * problem's measurements support. Empty when the mistake does not apply or collides with the
 * right answer. Energy-divided returns both h ÷ ν and ν ÷ h.
 */
export function lightMistakeAnswers(question: ElectronsLightQuestion, id: ErrorPatternId): string[] {
  const correct = evaluateSigFigTask(question.task)
  const n = correct.expected.sigFigs
  const out: string[] = []
  for (const spec of mistakeSpecs(question)) {
    if (spec.id !== id) continue
    if (validateSigFigTask(spec.task).some((issue) => issue.code === 'invalid')) continue
    const ev = evaluateSigFigTask(spec.task)
    const rounded = roundEvaluation(ev, n)
    if (!rounded || rounded.value === correct.expected.value) continue
    out.push(rounded.text)
  }
  return out
}

/** Every applicable mistake is a different number from the right answer and from the others. */
export function lightMistakesDistinct(question: ElectronsLightQuestion): boolean {
  let correctValue: string
  try {
    correctValue = evaluateSigFigTask(question.task).expected.value
  } catch {
    return false
  }
  const seen = new Set<string>([correctValue])
  const specs = mistakeSpecs(question)
  for (const id of new Set(specs.map((spec) => spec.id))) {
    const texts = lightMistakeAnswers(question, id)
    if (texts.length !== specs.filter((spec) => spec.id === id).length) return false
    for (const text of texts) {
      const grade = gradeLightAnswer(question, text)
      if (grade.status !== 'wrong' || grade.pattern?.id !== id || !grade.parsed) return false
      if (seen.has(grade.parsed.value)) return false
      seen.add(grade.parsed.value)
    }
  }
  return true
}

export interface OrderGrade {
  status: 'correct' | 'wrong' | 'incomplete'
  message: string
  pattern?: PatternHit
}

function listOf(q: ElectronsOrderQuestion, ids: readonly string[]): string {
  const labels = new Map(q.items.map((item) => [item.id, item.label]))
  return ids.map((id) => labels.get(id) ?? id).join(' → ')
}

/** Grade a full tap sequence. A short sequence is incomplete and is not a wrong answer. */
export function gradeSpectrumOrder(question: ElectronsOrderQuestion, tapped: readonly string[]): OrderGrade {
  const known = new Set(question.items.map((item) => item.id))
  if (tapped.length < question.order.length) {
    return {
      status: 'incomplete',
      message: 'Tap every one of them, in order, then check. Undo takes the last tap back.',
    }
  }
  const same = (ids: readonly string[]) => tapped.length === ids.length && tapped.every((id, i) => id === ids[i])
  if (tapped.some((id) => !known.has(id)) || new Set(tapped).size !== tapped.length) {
    return { status: 'wrong', message: 'Each region or color is tapped once, in the order the question asks for.' }
  }
  if (same(question.order)) {
    return {
      status: 'correct',
      message: `Yes: ${listOf(question, question.order)} is ${question.direction} ${question.quantity}.`,
    }
  }
  const reversed = [...question.order].reverse()
  if (same(reversed)) {
    const witness = `That is the reverse order (${listOf(question, tapped)}). ${question.direction === 'increasing' ? 'Increasing' : 'Decreasing'} ${question.quantity} runs ${listOf(question, question.order)}.`
    return { status: 'wrong', message: witness, pattern: patternHit('lt_order_reversed', witness) }
  }
  return {
    status: 'wrong',
    message: `Not that order. ${question.direction === 'increasing' ? 'Increasing' : 'Decreasing'} ${question.quantity} is not ${listOf(question, tapped)}. Frequency and energy rise as wavelength falls.`,
  }
}
