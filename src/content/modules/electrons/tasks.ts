/**
 * Sig-fig tasks for the light formulas, and the task each named mistake would have computed.
 * Templates and the grader both go through here, so a problem cannot drift from the way it is graded.
 * c = 3.00 × 10^8 m/s (3 figures), h = 6.626 × 10^-34 J·s (4), 1 nm = 10^-9 m (exact).
 */
import type { ElectronsLightQuestion } from '@/content/types'
import { prettySigFig } from '@/engine'
import type { ErrorPatternId, SigFigTask, SigFigTerm } from '@/shared/types'

export const C_TEXT = '3.00e8'
export const H_TEXT = '6.626e-34'
export const NM_TEXT = '1e-9'
export const GIGA_TEXT = '1e9'

const C: SigFigTerm = { text: C_TEXT }
const H: SigFigTerm = { text: H_TEXT }
const NM: SigFigTerm = { text: NM_TEXT, exact: true, note: 'defined: 1 nm = 10^-9 m' }
/** 10^9 used where 10^-9 belongs. Exact, so it does not change the figure count. */
const GIGA: SigFigTerm = { text: GIGA_TEXT, exact: true, note: 'defined power of ten' }

function t(text: string): SigFigTerm {
  return { text }
}

export function frequencyTask(wavelength: string, inNm: boolean): SigFigTask {
  return inNm
    ? { kind: 'muldiv', terms: [C, t(wavelength), NM], ops: ['/', '/'] }
    : { kind: 'muldiv', terms: [C, t(wavelength)], ops: ['/'] }
}

export function wavelengthTask(frequency: string, answerInNm: boolean): SigFigTask {
  return answerInNm
    ? { kind: 'muldiv', terms: [C, t(frequency), NM], ops: ['/', '/'] }
    : { kind: 'muldiv', terms: [C, t(frequency)], ops: ['/'] }
}

export function energyFromFrequencyTask(frequency: string): SigFigTask {
  return { kind: 'muldiv', terms: [H, t(frequency)], ops: ['*'] }
}

export function energyFromWavelengthTask(wavelength: string, inNm: boolean): SigFigTask {
  return inNm
    ? { kind: 'muldiv', terms: [H, C, t(wavelength), NM], ops: ['*', '/', '/'] }
    : { kind: 'muldiv', terms: [H, C, t(wavelength)], ops: ['*', '/'] }
}

export interface MistakeSpec {
  id: ErrorPatternId
  task: SigFigTask
  /** One sentence about the number she typed (`hers` is its pretty display). */
  witness: (hers: string) => string
}

type LightFacts = Pick<ElectronsLightQuestion, 'formula' | 'wavelengthText' | 'wavelengthInNm' | 'frequencyText' | 'answerInNm'>

function shown(text: string | undefined, fallback: string): string {
  return text ? prettySigFig(text) : fallback
}

/** After ÷, a number with a power of ten needs parentheses: "h ÷ 5.75 × 10¹⁴" reads as (h ÷ 5.75) × 10¹⁴. */
function paren(display: string): string {
  return display.includes('×') ? `(${display})` : display
}

/** The lt_ calculations that apply to this problem, in diagnosis order. */
export function mistakeSpecs(q: LightFacts): MistakeSpec[] {
  const wl = shown(q.wavelengthText, 'the wavelength')
  const freq = shown(q.frequencyText, 'the frequency')
  const wlUnit = q.wavelengthInNm ? 'nm' : 'm'
  const out: MistakeSpec[] = []

  const noConversion = (): MistakeSpec | null => {
    if (!q.wavelengthText || !q.wavelengthInNm) return null
    const task =
      q.formula === 'freq'
        ? frequencyTask(q.wavelengthText, false)
        : q.formula === 'energy-wave'
          ? energyFromWavelengthTask(q.wavelengthText, false)
          : null
    if (!task) return null
    return {
      id: 'lt_no_conversion',
      task,
      witness: (hers) => `${wl} nm was used as if it were already meters, so ${hers} is off by a factor of 10⁹.`,
    }
  }

  const backwards = (): MistakeSpec | null => {
    if (q.formula === 'freq' && q.wavelengthText && q.wavelengthInNm) {
      return {
        id: 'lt_conversion_backwards',
        task: { kind: 'muldiv', terms: [C, t(q.wavelengthText), GIGA], ops: ['/', '/'] },
        witness: (hers) => `The conversion on ${wl} nm was flipped: 10⁹ was used where 10⁻⁹ belongs, which is what gives ${hers}.`,
      }
    }
    if (q.formula === 'wavelength' && q.answerInNm && q.frequencyText) {
      return {
        id: 'lt_conversion_backwards',
        task: { kind: 'muldiv', terms: [C, t(q.frequencyText), GIGA], ops: ['/', '/'] },
        witness: (hers) => `Meters become nanometers by dividing by 10⁻⁹, not by 10⁹. That backwards step gives ${hers}.`,
      }
    }
    if (q.formula === 'energy-wave' && q.wavelengthText && q.wavelengthInNm) {
      return {
        id: 'lt_conversion_backwards',
        task: { kind: 'muldiv', terms: [H, C, t(q.wavelengthText), GIGA], ops: ['*', '/', '/'] },
        witness: (hers) => `The conversion on ${wl} nm was flipped: 10⁹ was used where 10⁻⁹ belongs, which is what gives ${hers}.`,
      }
    }
    return null
  }

  const multiplied = (): MistakeSpec | null => {
    if (q.formula === 'freq' && q.wavelengthText) {
      return {
        id: 'lt_multiplied',
        task: q.wavelengthInNm
          ? { kind: 'muldiv', terms: [C, t(q.wavelengthText), NM], ops: ['*', '*'] }
          : { kind: 'muldiv', terms: [C, t(q.wavelengthText)], ops: ['*'] },
        witness: (hers) => `c × ${wl} ${wlUnit} was multiplied instead of divided, and that product is ${hers}.`,
      }
    }
    if (q.formula === 'wavelength' && q.frequencyText) {
      return {
        id: 'lt_multiplied',
        task: q.answerInNm
          ? { kind: 'muldiv', terms: [C, t(q.frequencyText), NM], ops: ['*', '/'] }
          : { kind: 'muldiv', terms: [C, t(q.frequencyText)], ops: ['*'] },
        witness: (hers) => `c × ${freq} Hz was multiplied instead of divided, and that product is ${hers}.`,
      }
    }
    return null
  }

  const inverted = (): MistakeSpec | null => {
    if (q.formula === 'freq' && q.wavelengthText) {
      return {
        id: 'lt_inverted',
        task: q.wavelengthInNm
          ? { kind: 'muldiv', terms: [t(q.wavelengthText), NM, C], ops: ['*', '/'] }
          : { kind: 'muldiv', terms: [t(q.wavelengthText), C], ops: ['/'] },
        witness: (hers) => `${wl} ${wlUnit} ÷ c was used instead of c ÷ the wavelength, which gives ${hers}.`,
      }
    }
    if (q.formula === 'wavelength' && q.frequencyText) {
      return {
        id: 'lt_inverted',
        task: q.answerInNm
          ? { kind: 'muldiv', terms: [t(q.frequencyText), C, NM], ops: ['/', '/'] }
          : { kind: 'muldiv', terms: [t(q.frequencyText), C], ops: ['/'] },
        witness: (hers) => `${freq} Hz ÷ c was used instead of c ÷ the frequency, which gives ${hers}.`,
      }
    }
    return null
  }

  const energyDivided = (): MistakeSpec[] => {
    if (q.formula !== 'energy-freq' || !q.frequencyText) return []
    const freqText = q.frequencyText
    return [
      {
        id: 'lt_energy_divided',
        task: { kind: 'muldiv', terms: [H, t(freqText)], ops: ['/'] },
        witness: (hers) => `h ÷ ${paren(freq)} Hz was used instead of h × the frequency, which gives ${hers}.`,
      },
      {
        id: 'lt_energy_divided',
        task: { kind: 'muldiv', terms: [t(freqText), H], ops: ['/'] },
        witness: (hers) => `${freq} Hz ÷ h was used instead of h × the frequency, which gives ${hers}.`,
      },
    ]
  }

  const energyNoC = (): MistakeSpec | null => {
    if (q.formula !== 'energy-wave' || !q.wavelengthText) return null
    return {
      id: 'lt_energy_no_c',
      task: q.wavelengthInNm
        ? { kind: 'muldiv', terms: [H, t(q.wavelengthText), NM], ops: ['/', '/'] }
        : { kind: 'muldiv', terms: [H, t(q.wavelengthText)], ops: ['/'] },
      witness: (hers) => `c was left out of E = hc ÷ λ, so h ÷ ${paren(wl)} ${wlUnit} gives ${hers}.`,
    }
  }

  const wrongUnit = (): MistakeSpec | null => {
    if (q.formula !== 'wavelength' || !q.frequencyText) return null
    return {
      id: 'lt_wrong_unit',
      task: wavelengthTask(q.frequencyText, !q.answerInNm),
      witness: (hers) =>
        q.answerInNm
          ? `${hers} is the wavelength in meters. The question asked for nanometers, a billion times as many.`
          : `${hers} is the wavelength in nanometers. The question asked for meters.`,
    }
  }

  for (const spec of [noConversion(), backwards(), multiplied(), inverted(), energyNoC(), wrongUnit()]) {
    if (spec) out.push(spec)
  }
  out.push(...energyDivided())
  return out
}
