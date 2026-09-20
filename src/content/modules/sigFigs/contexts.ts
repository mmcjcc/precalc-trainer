/**
 * Units and one-sentence lab contexts for the single-numeral templates (count, round, convert).
 * A numeral is classed by size so the unit stays believable: 0.0045 kg, 45.67 g, 45000 mg.
 */
import type { Rng } from '@/content/rng'
import { prettySigFig } from '@/engine'

export type QuantityKind = 'mass' | 'volume' | 'length' | 'time'
export type SizeClass = 'small' | 'medium' | 'large' | 'sci'

export const KINDS: readonly QuantityKind[] = ['mass', 'volume', 'length', 'time']

const UNITS: Record<QuantityKind, Record<SizeClass, readonly string[]>> = {
  mass: { small: ['g', 'kg'], medium: ['g'], large: ['g', 'mg'], sci: ['g', 'kg'] },
  volume: { small: ['L'], medium: ['mL'], large: ['mL', 'L'], sci: ['L', 'mL'] },
  length: { small: ['m', 'cm'], medium: ['cm'], large: ['m', 'mm'], sci: ['m'] },
  time: { small: ['s'], medium: ['s'], large: ['s'], sci: ['s'] },
}

const NOUN: Record<QuantityKind, readonly string[]> = {
  mass: ['the mass of a sample', 'the mass of a precipitate', 'the mass of a crucible', 'the mass of a zinc strip'],
  volume: ['the volume of a solution', 'the volume of gas collected', 'the volume of water added'],
  length: ['the length of a magnesium ribbon', 'the length of a copper wire', 'the width of a glass plate'],
  time: ['the reaction time', 'the time for the color change', 'the time for the solid to dissolve'],
}

/** Things that come in scientific notation with a negative power. */
const NOUN_TINY: Record<QuantityKind, readonly string[]> = {
  mass: ['the mass of one molecule', 'the mass of a dust grain'],
  volume: ['the volume of a single cell', 'the volume of one drop'],
  length: ['the diameter of an atom', 'the thickness of a soap film'],
  time: ['the time for one vibration of the molecule', 'the lifetime of the excited state'],
}

/** Things that come in scientific notation with a positive power. */
const NOUN_HUGE: Record<QuantityKind, readonly string[]> = {
  mass: ['the mass of the ore deposit', 'the mass of water in the reservoir'],
  volume: ['the volume of the reservoir', 'the volume of gas in the storage tank'],
  length: ['the distance to the Moon', 'the length of the pipeline'],
  time: ['the half-life of the isotope', 'the age of the rock sample'],
}

/** Size class from the text: scientific notation, < 1, whole number with 4+ digits, else medium. */
export function sizeClass(text: string): SizeClass {
  if (/x|e/i.test(text)) return 'sci'
  if (/^0\./.test(text)) return 'small'
  if (/^\d{4,}\.?$/.test(text)) return 'large'
  return 'medium'
}

export function pickUnit(rng: Rng, kind: QuantityKind, text: string): string {
  return rng.pick(UNITS[kind][sizeClass(text)])
}

/** A believable thing for this numeral to measure (one rng draw). */
function pickNoun(rng: Rng, kind: QuantityKind, text: string): string {
  if (sizeClass(text) !== 'sci') return rng.pick(NOUN[kind])
  const power = Number((/(?:x\s*10\^|e)\s*\(?([-−+]?\d+)/i.exec(text.replace('−', '-')) ?? [])[1] ?? '0')
  return rng.pick(power < 0 ? NOUN_TINY[kind] : NOUN_HUGE[kind])
}

/** "A lab notebook lists the mass of a sample as 0.00450 g." (one rng draw for the noun, one for the frame). */
export function recordedSentence(rng: Rng, kind: QuantityKind, text: string, unit: string): string {
  const noun = pickNoun(rng, kind, text)
  const shown = `${prettySigFig(text)} ${unit}`
  const frames = [
    `A lab notebook lists ${noun} as ${shown}.`,
    `A data table gives ${noun} as ${shown}.`,
    `A student writes down ${noun} as ${shown}.`,
  ]
  return rng.pick(frames)
}

/** "A calculator shows 0.004567 g for the mass of a sample, but the measurements only support 2 significant figures." */
export function calculatorSentence(rng: Rng, kind: QuantityKind, text: string, unit: string, target: string): string {
  const noun = pickNoun(rng, kind, text)
  return `A calculator shows ${prettySigFig(text)} ${unit} for ${noun}, but the measurements only support ${target}.`
}
