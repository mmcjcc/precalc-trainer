/**
 * What every oblique-triangle template drafts before the gate (build.ts assembles and checks it), and the helpers
 * they share: a rounded part with its slips and its rounded-too-early values, a choice part, and the words for a
 * side or an angle.
 */
import type { CalcPanels, ErrorPatternId } from '@/shared/types'
import type { ObliqueFigure, ObliqueQuestion, TrigPart, TrigPartTrap } from '@/content/types'
import { roundPlaces } from '../explog/text'

export interface Drafted {
  question: ObliqueQuestion
  prompt: string
  oblique: ObliqueFigure
  /** Words for the figure (a screen reader and the tutor). Never an answer. */
  ariaLabel: string
  stages: TrigPart[]
  early: Record<string, number[]>
  /** The slips the problem may promise. */
  promisable: TrigPartTrap[]
  calc: CalcPanels
  /** What "Copy expression" offers under the calculator steps. */
  calcExpr: string
  ruleCards: string[]
  /** Every number the problem gives (sides and angles): no rounded answer may equal one. */
  givens: number[]
  /** The rounded answers' values before rounding: none may sit near a rounding boundary. */
  rounded: number[]
  /** Every triangle the problem is about (two in the ambiguous case, none when no triangle fits), for the checks. */
  shapes: Shape[]
}

/** A triangle's angles and sides (in the same order: side i across from angle i); `right` when one angle is 90°. */
export interface Shape {
  angles: number[]
  sides: number[]
  right?: boolean
}

/** One named slip of a rounded part: its number before rounding and the sentence about her answer. */
export interface Slip {
  id: ErrorPatternId
  value: number
  /** Built from the slip's own text: never the answer. */
  witness: (her: string) => string
}

/** Every rounded answer here is to the nearest tenth (a side, an area) or the nearest tenth of a degree. */
export const PLACES = 1

/** A slip's number as she would type it: to the tenth, or three figures where the tenth shows only zero. */
export function slipText(value: number): string {
  const r = roundPlaces(value, PLACES)
  if (Number(r) !== 0) return r
  return String(Number(value.toPrecision(3)))
}

/** Slips this far from the answer or nearer are left out, so they never meet a rounded-too-early value. */
const NEAR = 0.3

/** The slips that stand apart from the answer and from each other at the tenth, in order (the first of a tie wins). */
export function slipTraps(value: number, slips: readonly Slip[]): TrigPartTrap[] {
  const taken = new Set([roundPlaces(value, PLACES)])
  const out: TrigPartTrap[] = []
  for (const s of slips) {
    if (!Number.isFinite(s.value) || Math.abs(s.value) >= 1e6) continue
    if (Math.abs(s.value - value) <= NEAR) continue
    const text = slipText(s.value)
    if (taken.has(text) || taken.has(roundPlaces(s.value, PLACES))) continue
    taken.add(text)
    taken.add(roundPlaces(s.value, PLACES))
    out.push({ id: s.id, text, value: s.value, witness: s.witness(text.replace(/-/g, '−')) })
  }
  return out
}

/** Rounded-too-early values worth a note: a tenth or two from the answer, never the answer at the tenth. */
export function earlyValues(value: number, early: readonly number[]): number[] {
  const answer = roundPlaces(value, PLACES)
  const out = new Map<string, number>()
  for (const e of early) {
    if (!Number.isFinite(e)) continue
    const r = roundPlaces(e, PLACES)
    if (r === answer || Math.abs(e - value) > 0.25) continue
    if (!out.has(r)) out.set(r, Number(r))
  }
  return [...out.values()]
}

export interface DecimalPartInput {
  id: string
  label: string
  ask: string
  nudge: string
  ruleCard: string
  reveal: string[]
  value: number
  /** An angle in degrees (the ° is fine after it), or a length or an area (no degree sign). */
  degrees: boolean
  slips: readonly Slip[]
  early: readonly number[]
  wrongNote: string
  formatHint: string
}

/** A part rounded to the tenth, with its slips and its rounded-too-early values. */
export function decimalPart(o: DecimalPartInput): { part: TrigPart; early: number[] } {
  const answerText = roundPlaces(o.value, PLACES)
  const part: TrigPart = {
    id: o.id,
    kind: 'decimal',
    label: o.label,
    ask: o.ask,
    formatHint: o.formatHint,
    nudge: o.nudge,
    ruleCard: o.ruleCard,
    reveal: o.reveal,
    answerText,
    forms: o.degrees ? [`${answerText}°`] : [],
    check: { kind: 'decimal', value: o.value, places: PLACES, ...(o.degrees ? { unit: 'deg' as const } : {}) },
    wrongNote: o.wrongNote,
    traps: slipTraps(o.value, o.slips),
  }
  return { part, early: earlyValues(o.value, o.early) }
}

/** A choice part: the options in a fixed order, each wrong option with its slip (or none). */
export function choicePart(o: {
  id: string
  label: string
  ask: string
  nudge: string
  ruleCard: string
  reveal: string[]
  choices: { value: string; label: string }[]
  answer: string
  traps: { value: string; id: ErrorPatternId; witness: string }[]
  wrongNote: string
}): TrigPart {
  return {
    id: o.id,
    kind: 'choice',
    label: o.label,
    ask: o.ask,
    formatHint: 'Pick one.',
    choices: o.choices,
    nudge: o.nudge,
    ruleCard: o.ruleCard,
    reveal: o.reveal,
    answerText: o.answer,
    forms: [],
    check: { kind: 'choice' },
    wrongNote: o.wrongNote,
    traps: o.traps.filter((t) => t.value !== o.answer).map((t) => ({ id: t.id, text: t.value, witness: t.witness })),
  }
}

/** A number for a sentence: the minus sign, and four decimals for a value worked out. */
export function shown(v: number, places = 4): string {
  return v.toFixed(places).replace(/-/g, '−')
}
