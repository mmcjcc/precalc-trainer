/**
 * Shared pieces for honors geometry Unit 7, second half. Rounded lengths and angles, including a calculator left in
 * RADIAN mode (that value can be negative). The exact-fraction and figure helpers of the first half stay in unit7Build.
 */
import type { ErrorPatternId } from '@/shared/types'
import type { GeometryAnswer } from '@/content/types'
import { nearHalf, type LengthUnit7, type Places, type Stage7 } from './unit7Build'

const PLACE_EXAMPLE: Record<Places, string> = { 0: '43', 1: '43.7', 2: '43.71' }

/** The line under a rounded box. 43, 43.7 and 43.71 are reserved, so they are never an answer. */
export function decimalHint(places: Places, kind: 'length' | 'deg', unit?: LengthUnit7): string {
  const e = PLACE_EXAMPLE[places]
  if (kind === 'deg') {
    if (places === 0) return 'A whole number of degrees, like 43.'
    if (places === 1) return 'A number of degrees to the nearest tenth, like 43.7.'
    return 'A number of degrees to the nearest hundredth, like 43.71.'
  }
  const name = places === 0 ? 'whole number' : places === 1 ? 'tenth' : 'hundredth'
  return unit ? `A length to the nearest ${name}, like ${e} ${unit}.` : `A number to the nearest ${name}, like ${e}.`
}

/** Round halfway away from zero, and keep the minus a radian-mode value can have. */
export function signedRounded(v: number, places: Places): string {
  const f = 10 ** places
  const r = Math.floor(Math.abs(v) * f + 0.5 + 1e-9) / f
  const text = r.toFixed(places)
  return v < 0 ? `-${text}` : text
}

export interface DecimalSlip {
  id: ErrorPatternId
  value: number
  witness: string
}

/**
 * A rounded length or angle. `exact` is the unrounded value, so too few places is a note. A slip within 1e-4 of a
 * rounding boundary is dropped (two calculators can disagree); the answer itself that close is refused. A negative
 * slip is kept, so RADIAN mode still grades when the calculator prints a minus.
 */
export function decimalStage(opts: {
  label: string
  places: Places
  value: number
  unit?: 'deg'
  lengthUnit?: LengthUnit7
  nudge: string
  ruleCard: string
  reveal: string[]
  slips: readonly DecimalSlip[]
  givens: readonly number[]
}): Stage7 | null {
  if (!Number.isFinite(opts.value) || opts.value <= 0 || opts.value > 1e5) return null
  if (nearHalf(opts.value, opts.places)) return null
  const answerText = signedRounded(opts.value, opts.places)
  const answer = Number(answerText)
  if (!(answer > 0)) return null
  if (opts.givens.some((g) => Math.abs(g - answer) < 1e-9)) return null
  const traps: Stage7['traps'] = []
  for (const slip of opts.slips) {
    if (!Number.isFinite(slip.value) || slip.value === 0 || Math.abs(slip.value) > 1e5) continue
    if (nearHalf(slip.value, opts.places)) continue
    const text = signedRounded(slip.value, opts.places)
    const n = Number(text)
    if (!Number.isFinite(n) || n === 0 || n === answer) continue
    if (traps.some((t) => Number(t.text) === n)) continue
    if (opts.givens.some((g) => Math.abs(g - n) < 1e-9)) continue
    traps.push({ id: slip.id, text, witness: slip.witness })
  }
  if (traps.length === 0) return null
  return {
    id: 'x',
    kind: 'number',
    round: opts.places,
    exact: opts.value.toFixed(6),
    ...(opts.unit ? { unit: opts.unit } : {}),
    ...(opts.lengthUnit ? { lengthUnit: opts.lengthUnit } : {}),
    label: opts.label,
    hint: decimalHint(opts.places, opts.unit === 'deg' ? 'deg' : 'length', opts.lengthUnit),
    answerText,
    nudge: opts.nudge,
    ruleCard: opts.ruleCard,
    reveal: opts.reveal,
    traps,
  }
}

/** The numbers a rounded problem already shows: whole givens, and a degree written as its own number. */
export function givenNumbers(answer: GeometryAnswer): number[] {
  const texts = [answer.prompt, ...(answer.figure.segments ?? []).map((s) => s.label ?? ''), ...(answer.figure.angles ?? []).map((a) => a.label ?? '')]
  const out: number[] = []
  for (const text of texts) {
    for (const m of text.matchAll(/\d+(?:\.\d+)?/g)) {
      const n = Number(m[0])
      if (Number.isFinite(n)) out.push(n)
    }
  }
  return out
}
