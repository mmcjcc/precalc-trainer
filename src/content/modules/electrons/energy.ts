/**
 * light.energy — E = hν from a frequency, and E = hc / λ from a wavelength (one muldiv chain,
 * no intermediate rounding). The book's 5.75 × 10^14 Hz and the 700. nm chain are fixed seeds.
 */
import { prettySigFig } from '@/engine'
import { colourName, FREQUENCIES, metreWave, nmValue, TRAILING_NM, TWO_FIG_NM, visibleFrequency } from './bands'
import { makeLightTemplate, type LightDraft, type LightScenario } from './build'

const INSTRUCTIONS =
  'Find the energy of one photon, in joules. Round once, at the end. Measured constants count; an exact conversion does not.'

const NUDGE_F = 'One photon: E = hν, so multiply. h and the frequency are both measurements; keep the fewer figures.'
const NUDGE_NM =
  'From a wavelength, E = hc ÷ λ as one calculation. Convert nanometers to meters first (× 10⁻⁹, exact), keep every digit, and round once at the end. h and c both count.'
const NUDGE_M = 'From a wavelength already in meters, E = hc ÷ λ. Multiply h by c, divide by λ, and round once. Both constants count.'

function fill(pattern: string, text: string): string {
  return pattern.replace('%s', prettySigFig(text))
}

function fromFrequency(text: string, context: string, trap: string): LightDraft {
  return {
    formula: 'energy-freq',
    frequencyText: text,
    wavelengthInNm: false,
    answerInNm: false,
    givenUnit: 'Hz',
    givenLabel: 'frequency',
    unit: 'J',
    context,
    prompt: 'What is the energy of one photon of this light, in J?',
    trap,
    nudge: NUDGE_F,
    ruleCards: ['energy', 'higher', 'constants', 'wave'],
  }
}

function fromNm(text: string, context: string, trap: string): LightDraft {
  return {
    formula: 'energy-wave',
    wavelengthText: text,
    wavelengthInNm: true,
    answerInNm: false,
    givenUnit: 'nm',
    givenLabel: 'wavelength',
    unit: 'J',
    context,
    prompt: 'What is the energy of one photon of this light, in J?',
    trap,
    nudge: NUDGE_NM,
    ruleCards: ['energy', 'convert', 'constants', 'higher'],
  }
}

function fromMetres(text: string, context: string): LightDraft {
  return {
    formula: 'energy-wave',
    wavelengthText: text,
    wavelengthInNm: false,
    answerInNm: false,
    givenUnit: 'm',
    givenLabel: 'wavelength',
    unit: 'J',
    context,
    prompt: 'What is the energy of one photon of this wave, in J?',
    trap: 'metres-scientific',
    nudge: NUDGE_M,
    ruleCards: ['energy', 'constants', 'wave', 'higher'],
  }
}

const bookFreq = FREQUENCIES[0]! // 5.75e14, the book's photon energy

const scenarios = (): LightScenario[] => [
  {
    id: 'book-frequency',
    weight: 3,
    draw: () => fromFrequency(bookFreq.text, 'Light of frequency 5.75 × 10¹⁴ Hz falls on a metal.', 'book-frequency'),
  },
  {
    id: 'visible-frequency',
    weight: 3,
    draw: (rng) => {
      const text = visibleFrequency(rng)
      return fromFrequency(text, `A photon of visible light has frequency ${prettySigFig(text)} Hz.`, 'from-frequency')
    },
  },
  {
    id: 'other-frequency',
    weight: 2,
    draw: (rng) => {
      const ex = rng.pick(FREQUENCIES.filter((f) => f.text !== bookFreq.text))
      return fromFrequency(ex.text, fill(ex.scene, ex.text), 'from-frequency')
    },
  },
  {
    id: 'trailing-700',
    weight: 3,
    draw: () => fromNm('700.', 'Deep red light has a wavelength of 700. nm.', 'trailing-point'),
  },
  {
    id: 'book-orange',
    weight: 2,
    draw: () => fromNm('620', 'Orange light has a wavelength of 620 nm.', 'book-orange'),
  },
  {
    id: 'two-figures',
    weight: 2,
    draw: (rng) => {
      const text = rng.pick(TWO_FIG_NM)
      return fromNm(text, `This is ${colourName(nmValue(text))} light, with a wavelength of ${prettySigFig(text)} nm.`, 'two-figures')
    },
  },
  {
    id: 'trailing-point',
    weight: 2,
    draw: (rng) => {
      const text = rng.pick(TRAILING_NM)
      return fromNm(text, `A ${colourName(nmValue(text))} light has wavelength ${prettySigFig(text)} nm.`, 'trailing-point')
    },
  },
  {
    id: 'metres',
    weight: 3,
    draw: (rng) => {
      const wave = metreWave(rng, 'scientific')
      return fromMetres(wave.text, fill(wave.scene, wave.text))
    },
  },
]

export const energyTemplate = makeLightTemplate({
  id: 'light.energy',
  title: 'Energy of a photon',
  description: 'E = hν from a frequency, and E = hc / λ from a wavelength, rounded once.',
  version: 1,
  knobs: [],
  instructions: INSTRUCTIONS,
  nudge: NUDGE_F,
  scenarios,
  fallback: fromFrequency(bookFreq.text, 'Light of frequency 5.75 × 10¹⁴ Hz falls on a metal.', 'book-frequency'),
})
