/**
 * Realistic wavelengths and frequencies, as text. Colour names are only for the sentence; the
 * arithmetic stays in the sig-fig engine. Visible light here is 380–750 nm.
 */
import type { Rng } from '@/content/rng'
import { digitsOf, scientific } from '../sigFigs/numbers'

export function colourName(nm: number): string {
  if (nm < 450) return 'violet'
  if (nm < 495) return 'blue'
  if (nm < 570) return 'green'
  if (nm < 590) return 'yellow'
  if (nm <= 620) return 'orange' // her book calls 620 nm orange
  return 'red'
}

/** Two significant figures, 380–750 nm, trailing zero is a placeholder (like 620). */
export const TWO_FIG_NM: readonly string[] = (() => {
  const out: string[] = []
  for (let n = 380; n <= 750; n += 10) if (n % 100 !== 0) out.push(String(n))
  return out
})()

/** Three figures with a trailing point, so the zero counts: "700." */
export const TRAILING_NM: readonly string[] = ['400.', '500.', '550.', '600.', '650.', '700.', '720.', '750.']

export function nmValue(text: string): number {
  const n = Number(text.endsWith('.') ? text.slice(0, -1) : text)
  if (!Number.isFinite(n)) throw new Error(`electrons: bad wavelength ${text}`)
  return n
}

/** A visible frequency, 4.00 × 10^14 to 7.89 × 10^14 Hz, with 3 or 4 figures. */
export function visibleFrequency(rng: Rng): string {
  const figs = rng.chance(0.35) ? 4 : 3
  const first = rng.int(4, 7)
  let digits = String(first)
  for (let i = 1; i < figs; i++) {
    const hi = first === 7 && i === 1 ? 8 : 9
    const lo = i === figs - 1 ? 1 : 0
    digits += String(rng.int(lo, hi))
  }
  return scientific(digits, 14)
}

export interface MetreWave {
  text: string
  /** One sentence, with the pretty numeral already filled in by the caller if it contains "%s". */
  scene: string
}

/** Wavelengths already in meters. `scientific` ones are written with a power of ten. */
export const METRE_WAVES: readonly MetreWave[] = [
  { text: '9.40 x 10^-7', scene: 'A TV remote sends infrared light of wavelength %s m.' },
  { text: '1.06 x 10^-6', scene: 'A near-infrared laser shines at %s m.' },
  { text: '1.00 x 10^-5', scene: 'An infrared heater glows at a wavelength of %s m.' },
  { text: '8.50 x 10^-6', scene: 'Thermal infrared light has a wavelength of %s m.' },
  { text: '5.00 x 10^-6', scene: 'An infrared lamp emits light of wavelength %s m.' },
  { text: '2.54 x 10^-7', scene: 'A mercury UV lamp emits light of wavelength %s m.' },
  { text: '3.10 x 10^-7', scene: 'UVB light from the sun includes a wavelength of %s m.' },
  { text: '1.85 x 10^-7', scene: 'A UV lamp emits light of wavelength %s m.' },
  { text: '2.50 x 10^-8', scene: 'Extreme-ultraviolet light has a wavelength of %s m.' },
  { text: '1.22 x 10^-1', scene: 'A microwave oven produces waves of wavelength %s m.' },
  { text: '2.80 x 10^-2', scene: 'A microwave link uses waves of wavelength %s m.' },
  { text: '6.00 x 10^-2', scene: 'A radar set sends microwaves of wavelength %s m.' },
  { text: '3.00 x 10^2', scene: 'An AM radio station broadcasts at a wavelength of %s m.' },
  { text: '5.00 x 10^1', scene: 'A shortwave radio signal has a wavelength of %s m.' },
  { text: '1.50 x 10^2', scene: 'A radio beacon transmits at a wavelength of %s m.' },
  { text: '3.00', scene: 'An FM radio station broadcasts at a wavelength of %s m.' },
  { text: '2.80', scene: 'A radio wave in the FM band has a wavelength of %s m.' },
]

export function metreWave(rng: Rng, kind: 'scientific' | 'any' | 'radio-standard'): MetreWave {
  const pool =
    kind === 'scientific'
      ? METRE_WAVES.filter((w) => w.text.includes('x 10^'))
      : kind === 'radio-standard'
        ? METRE_WAVES.filter((w) => !w.text.includes('x 10^'))
        : METRE_WAVES
  return rng.pick(pool)
}

export interface FrequencyExample {
  text: string
  scene: string
  /** Asking for nm is natural (visible, near IR, near UV). Radio and microwave stay in meters. */
  nmOk: boolean
}

export const FREQUENCIES: readonly FrequencyExample[] = [
  { text: '5.75e14', scene: 'Green light has a frequency of %s Hz.', nmOk: true },
  { text: '4.50e14', scene: 'Red light has a frequency of %s Hz.', nmOk: true },
  { text: '6.50e14', scene: 'Blue light has a frequency of %s Hz.', nmOk: true },
  { text: '5.09e14', scene: 'Yellow light, like a sodium lamp, has a frequency of %s Hz.', nmOk: true },
  { text: '7.50e14', scene: 'Violet light has a frequency of %s Hz.', nmOk: true },
  { text: '3.00 x 10^13', scene: 'Infrared light has a frequency of %s Hz.', nmOk: true },
  { text: '1.50 x 10^13', scene: 'A far-infrared source radiates at %s Hz.', nmOk: true },
  { text: '1.20 x 10^15', scene: 'Ultraviolet light has a frequency of %s Hz.', nmOk: true },
  { text: '2.00 x 10^15', scene: 'A UV lamp radiates at %s Hz.', nmOk: true },
  { text: '2.45 x 10^9', scene: 'A microwave oven runs at %s Hz.', nmOk: false },
  { text: '5.00 x 10^9', scene: 'A microwave signal has a frequency of %s Hz.', nmOk: false },
  { text: '9.80 x 10^7', scene: 'An FM radio station broadcasts at %s Hz.', nmOk: false },
  { text: '1.00 x 10^6', scene: 'An AM radio station broadcasts at %s Hz.', nmOk: false },
  { text: '2.00 x 10^5', scene: 'A long-wave radio signal has a frequency of %s Hz.', nmOk: false },
]

export function frequencyExample(rng: Rng, nmOk: boolean | 'any'): FrequencyExample {
  const pool = nmOk === 'any' ? FREQUENCIES : FREQUENCIES.filter((f) => f.nmOk === nmOk)
  return rng.pick(pool)
}

/** A generated scientific frequency outside the visible window, for extra variety. */
export function otherFrequency(rng: Rng): FrequencyExample {
  const band = rng.pick(['ir', 'uv', 'microwave', 'radio'] as const)
  if (band === 'ir') {
    const text = scientific(digitsOf(rng, 3, { lastNonzero: true }), rng.pick([12, 13]))
    return { text, scene: 'Infrared light has a frequency of %s Hz.', nmOk: true }
  }
  if (band === 'uv') {
    const text = scientific('1' + digitsOf(rng, 2, { lastNonzero: true }), 15)
    return { text, scene: 'Ultraviolet light has a frequency of %s Hz.', nmOk: true }
  }
  if (band === 'microwave') {
    const text = scientific(digitsOf(rng, 3, { lastNonzero: true }), 9)
    return { text, scene: 'A microwave signal has a frequency of %s Hz.', nmOk: false }
  }
  const text = scientific(digitsOf(rng, 3, { lastNonzero: true }), rng.pick([6, 8]))
  return { text, scene: 'A radio transmitter works at %s Hz.', nmOk: false }
}
