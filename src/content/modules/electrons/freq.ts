/**
 * light.freq — ν = c / λ. Wavelength usually in nm (visible colors), sometimes already in m.
 * Across seeds: two-figure nm like 620, trailing-point nm like 700., and metres in scientific notation.
 */
import type { Rng } from '@/content/rng'
import { prettySigFig } from '@/engine'
import { fromInteger } from '../sigFigs/numbers'
import { colourName, metreWave, nmValue, TRAILING_NM, TWO_FIG_NM } from './bands'
import { makeLightTemplate, type LightDraft, type LightScenario } from './build'

const INSTRUCTIONS =
  'Find the frequency in hertz. Round to the right number of significant figures. Measured constants count; an exact conversion does not.'

const NUDGE_NM =
  'c = λν, and c is in m/s. Change nanometers into meters before you divide (× 10⁻⁹, exact). Then round to the fewest significant figures. c counts; the conversion does not.'
const NUDGE_M =
  'c = λν. The wavelength is already in meters, so divide c by it. Round to the fewest significant figures. c is a measurement, so it counts.'

function fill(pattern: string, text: string): string {
  return pattern.replace('%s', prettySigFig(text))
}

function fromNm(text: string, context: string, trap: string): LightDraft {
  return {
    formula: 'freq',
    wavelengthText: text,
    wavelengthInNm: true,
    answerInNm: false,
    givenUnit: 'nm',
    givenLabel: 'wavelength',
    unit: 'Hz',
    context,
    prompt: 'What is the frequency of this light, in Hz?',
    trap,
    nudge: NUDGE_NM,
    ruleCards: ['wave', 'convert', 'inverse', 'constants'],
  }
}

function colourContext(text: string): string {
  return `This is ${colourName(nmValue(text))} light, with a wavelength of ${prettySigFig(text)} nm.`
}

/** Three significant figures, 381–749 nm (no trailing zero). */
function threeFigNm(rng: Rng): string {
  let n = rng.int(381, 748)
  if (n % 10 === 0) n += 1
  return String(n)
}

function fromMetres(rng: Rng, kind: 'scientific' | 'radio-standard'): LightDraft {
  const wave = metreWave(rng, kind)
  return {
    formula: 'freq',
    wavelengthText: wave.text,
    wavelengthInNm: false,
    answerInNm: false,
    givenUnit: 'm',
    givenLabel: 'wavelength',
    unit: 'Hz',
    context: fill(wave.scene, wave.text),
    prompt: 'What is the frequency of this wave, in Hz?',
    trap: kind === 'scientific' ? 'metres-scientific' : 'metres-standard',
    nudge: NUDGE_M,
    ruleCards: ['wave', 'inverse', 'constants'],
  }
}

const scenarios = (): LightScenario[] => [
  {
    id: 'book-orange',
    weight: 3,
    draw: () => fromNm('620', 'Orange light has a wavelength of 620 nm.', 'book-orange'),
  },
  {
    id: 'trailing-point',
    weight: 3,
    draw: (rng) => {
      const text = rng.pick(TRAILING_NM)
      return fromNm(text, `A deep ${colourName(nmValue(text))} light has wavelength ${prettySigFig(text)} nm.`, 'trailing-point')
    },
  },
  {
    id: 'sodium',
    weight: 2,
    draw: () => fromNm('589.0', 'Sodium street lamps glow at 589.0 nm, a yellow light.', 'sodium'),
  },
  {
    id: 'two-figures',
    weight: 3,
    draw: (rng) => {
      const text = rng.pick(TWO_FIG_NM)
      return fromNm(text, colourContext(text), 'two-figures')
    },
  },
  {
    id: 'visible-nm',
    weight: 3,
    draw: (rng) => {
      const text = threeFigNm(rng)
      return fromNm(text, colourContext(text), 'visible-nm')
    },
  },
  {
    id: 'four-figures',
    weight: 2,
    draw: (rng) => {
      const text = fromInteger(rng.int(3800, 7500), 1)
      return fromNm(text, colourContext(text), 'four-figures')
    },
  },
  {
    id: 'metres-scientific',
    weight: 4,
    draw: (rng) => fromMetres(rng, 'scientific'),
  },
  {
    id: 'metres-standard',
    weight: 2,
    draw: (rng) => fromMetres(rng, 'radio-standard'),
  },
]

export const freqTemplate = makeLightTemplate({
  id: 'light.freq',
  title: 'Frequency from wavelength',
  description: 'ν = c / λ. Visible wavelengths in nm, plus infrared, ultraviolet, microwave and radio in m.',
  version: 1,
  knobs: [],
  instructions: INSTRUCTIONS,
  nudge: NUDGE_NM,
  scenarios,
  fallback: fromNm('620', 'Orange light has a wavelength of 620 nm.', 'book-orange'),
})
