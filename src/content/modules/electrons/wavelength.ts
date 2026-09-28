/**
 * light.wavelength — λ = c / ν. The answer is asked in m, or in nm (the task then divides by the
 * exact 10⁻⁹). Across seeds: an answer in nm, and answers that need scientific notation.
 */
import { prettySigFig } from '@/engine'
import { FREQUENCIES, frequencyExample, otherFrequency, visibleFrequency } from './bands'
import { makeLightTemplate, type LightDraft } from './build'

const INSTRUCTIONS =
  'Find the wavelength in the unit the question asks for. Round to the right number of significant figures. Measured constants count; an exact conversion does not.'

const NUDGE_NM =
  'λ = c ÷ ν gives meters. The question wants nanometers: divide by 10⁻⁹ in the same calculation (that factor is exact). Round to the fewest figures.'
const NUDGE_M = 'λ = c ÷ ν, and the answer stays in meters. Round to the fewest significant figures. c counts.'

function fill(pattern: string, text: string): string {
  return pattern.replace('%s', prettySigFig(text))
}

function draft(text: string, context: string, answerInNm: boolean, trap: string): LightDraft {
  return {
    formula: 'wavelength',
    frequencyText: text,
    wavelengthInNm: false,
    answerInNm,
    givenUnit: 'Hz',
    givenLabel: 'frequency',
    unit: answerInNm ? 'nm' : 'm',
    context,
    prompt: answerInNm ? 'What is the wavelength of this light, in nm?' : 'What is the wavelength of this wave, in m?',
    trap,
    nudge: answerInNm ? NUDGE_NM : NUDGE_M,
    ruleCards: answerInNm ? ['wave', 'convert', 'inverse', 'constants'] : ['wave', 'inverse', 'constants'],
  }
}

const book = FREQUENCIES[1]! // 4.50e14, the anchor wavelength

export const wavelengthTemplate = makeLightTemplate({
  id: 'light.wavelength',
  title: 'Wavelength from frequency',
  description: 'λ = c / ν, answered in meters or in nanometers.',
  version: 1,
  knobs: [],
  instructions: INSTRUCTIONS,
  nudge: NUDGE_M,
  scenarios: () => [
    {
      id: 'book-nm',
      weight: 2,
      draw: () => draft(book.text, fill(book.scene, book.text), true, 'answer-in-nm'),
    },
    {
      id: 'book-m',
      weight: 2,
      draw: () => draft(book.text, fill(book.scene, book.text), false, 'answer-in-m'),
    },
    {
      id: 'visible-nm',
      weight: 4,
      draw: (rng) => {
        const text = visibleFrequency(rng)
        return draft(text, `Visible light has a frequency of ${prettySigFig(text)} Hz.`, true, 'answer-in-nm')
      },
    },
    {
      id: 'visible-m',
      weight: 3,
      draw: (rng) => {
        const text = visibleFrequency(rng)
        return draft(text, `Visible light has a frequency of ${prettySigFig(text)} Hz.`, false, 'answer-in-m')
      },
    },
    {
      id: 'bank-nm',
      weight: 3,
      draw: (rng) => {
        const ex = frequencyExample(rng, true)
        return draft(ex.text, fill(ex.scene, ex.text), true, 'answer-in-nm')
      },
    },
    {
      id: 'bank-m',
      weight: 3,
      draw: (rng) => {
        const ex = frequencyExample(rng, 'any')
        return draft(ex.text, fill(ex.scene, ex.text), false, 'answer-in-m')
      },
    },
    {
      id: 'other-m',
      weight: 3,
      draw: (rng) => {
        const ex = otherFrequency(rng)
        return draft(ex.text, fill(ex.scene, ex.text), false, 'answer-in-m')
      },
    },
  ],
  fallback: draft(book.text, fill(book.scene, book.text), true, 'answer-in-nm'),
})
