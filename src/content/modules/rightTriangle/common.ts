/**
 * What every right-triangle template builds before the gate (build.ts assembles and checks it), and the helpers they
 * share: slips as she would type them, a rounded answer's slips that stand apart at the rounding asked, unit words.
 */
import type { CalcPanels } from '@/shared/types'
import type { RightTriangleQuestion, TrigFigureSpec, TrigPart, TrigPartTrap } from '@/content/types'
import { valueText, type TrigDecimalSlip, type TrigSlip } from '@/engine/trig'
import { roundPlaces } from '../explog/text'

export { exactForms } from '../trig/forms'

export interface Drafted {
  question: RightTriangleQuestion
  prompt: string
  figure: TrigFigureSpec
  stages: TrigPart[]
  /** The slips the problem may promise. */
  promisable: TrigPartTrap[]
  calc: CalcPanels
  /** What "Copy expression" offers under the calculator steps. */
  calcExpr: string
  ruleCards: string[]
}

/** Exact slips as she would type them. */
export function exactTraps(slips: readonly TrigSlip[]): TrigPartTrap[] {
  return slips.map((s) => ({ id: s.id, text: valueText(s.value), witness: s.witness }))
}

/** A slip's value as she would type it at the rounding asked (more places when that rounding shows only zeros). */
export function trapText(value: number, places: number): string {
  const r = roundPlaces(value, places)
  if (Number(r) !== 0) return r
  return String(Number(value.toPrecision(3)))
}

/** Slips of a rounded answer that stand apart from it, and from each other, at the rounding asked. */
export function decimalTraps(answer: number, places: number, slips: readonly TrigDecimalSlip[]): TrigPartTrap[] {
  const taken = new Set([roundPlaces(answer, places)])
  const out: TrigPartTrap[] = []
  for (const s of slips) {
    if (!Number.isFinite(s.value) || Math.abs(s.value) >= 1e6) continue
    const r = roundPlaces(s.value, places)
    if (taken.has(r) || Math.abs(s.value - answer) <= 0.5 * 10 ** -places + 1e-9) continue
    taken.add(r)
    out.push({ id: s.id, text: trapText(s.value, places), value: s.value, witness: s.witness })
  }
  return out
}

export interface LengthUnit {
  abbr: string
  /** Words she may type after the number. */
  words: string[]
  /** "feet", "centimeters" */
  name: string
  /** "a foot", "a centimeter" */
  piece: string
  /** "foot" for "a 20-foot ladder" */
  single: string
}

export const LENGTH_UNITS: Record<'ft' | 'm' | 'cm' | 'in', LengthUnit> = {
  ft: { abbr: 'ft', words: ['ft', 'feet', 'foot'], name: 'feet', piece: 'a foot', single: 'foot' },
  m: { abbr: 'm', words: ['m', 'meters', 'metres', 'meter'], name: 'meters', piece: 'a meter', single: 'meter' },
  cm: { abbr: 'cm', words: ['cm', 'centimeters', 'centimetres', 'centimeter'], name: 'centimeters', piece: 'a centimeter', single: 'centimeter' },
  in: { abbr: 'in', words: ['in', 'inches', 'inch'], name: 'inches', piece: 'an inch', single: 'inch' },
}

const PLACE_WORDS = ['', 'tenth', 'hundredth']

/** "Round to the nearest tenth of a foot." / "Round to the nearest meter." / "Round to the nearest hundredth." */
export function roundingWords(places: number, unit: LengthUnit | null): string {
  if (places === 0) return unit ? `Round to the nearest ${unit.single}.` : 'Round to the nearest whole number.'
  return `Round to the nearest ${PLACE_WORDS[places]}${unit ? ` of ${unit.piece}` : ''}.`
}
