/**
 * light.spectrum — put regions or visible colors in order of wavelength, frequency or energy.
 * No calculation. Frequency and energy rise as wavelength falls, so the reverse ranking is one mistake.
 */
import { makeRng } from '@/content/rng'
import type { DifficultyKnobs, ElectronsOrderQuestion, ProblemInstance, SpectrumItem, TemplateDef } from '@/content/types'
import type { CalcPanels } from '@/shared/types'
import { EL_MODULE_ID } from './build'
import { ltRule } from './rules'

const NO_CALC: CalcPanels = { ti84: [], nspire: [] }

/** Index 0 is the longest wavelength (lowest frequency and energy). */
const SPECTRUM: readonly SpectrumItem[] = [
  { id: 'radio', label: 'radio' },
  { id: 'microwave', label: 'microwave' },
  { id: 'infrared', label: 'infrared' },
  { id: 'visible', label: 'visible' },
  { id: 'ultraviolet', label: 'ultraviolet' },
  { id: 'xray', label: 'X-ray' },
  { id: 'gamma', label: 'gamma' },
]

const COLOURS: readonly SpectrumItem[] = [
  { id: 'red', label: 'red' },
  { id: 'orange', label: 'orange' },
  { id: 'yellow', label: 'yellow' },
  { id: 'green', label: 'green' },
  { id: 'blue', label: 'blue' },
  { id: 'violet', label: 'violet' },
]

const QUANTITIES = ['wavelength', 'frequency', 'energy'] as const
const DIRECTIONS = ['increasing', 'decreasing'] as const

const NUDGE =
  'Radio and red are the long-wavelength, low-frequency, low-energy end. Gamma and violet are the short-wavelength, high-frequency, high-energy end. Frequency and energy rise together as wavelength falls.'

const INSTRUCTIONS = 'Tap the items in the order the question asks for. Undo removes the last tap.'

function sameIds(a: readonly SpectrumItem[], ids: readonly string[]): boolean {
  return a.length === ids.length && a.every((item, i) => item.id === ids[i])
}

function correctOrder(
  chosen: readonly SpectrumItem[],
  pool: readonly SpectrumItem[],
  quantity: (typeof QUANTITIES)[number],
  direction: (typeof DIRECTIONS)[number],
): string[] {
  const rank = new Map(pool.map((item, i) => [item.id, i]))
  const longToShort = [...chosen].sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
  // Longest wavelength is lowest frequency and lowest energy.
  const longFirst = (quantity === 'wavelength' && direction === 'decreasing') || (quantity !== 'wavelength' && direction === 'increasing')
  const ordered = longFirst ? longToShort : [...longToShort].reverse()
  return ordered.map((item) => item.id)
}

function pickSubset(rng: ReturnType<typeof makeRng>, pool: readonly SpectrumItem[]): SpectrumItem[] {
  const k = rng.int(3, 5)
  if (rng.chance(0.55)) {
    const start = rng.int(0, pool.length - k)
    return pool.slice(start, start + k)
  }
  return rng.shuffle([...pool]).slice(0, k)
}

export const spectrumTemplate: TemplateDef = {
  id: 'light.spectrum',
  title: 'Order the spectrum',
  description: 'Rank regions of the electromagnetic spectrum, or visible colors, by wavelength, frequency or energy.',
  version: 1,
  knobs: [],
  generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
    const rng = makeRng(seed)
    const family = rng.chance(0.5) ? 'spectrum' : 'colours'
    const pool = family === 'spectrum' ? SPECTRUM : COLOURS
    const quantity = rng.pick(QUANTITIES)
    const direction = rng.pick(DIRECTIONS)
    const chosen = pickSubset(rng, pool)
    const order = correctOrder(chosen, pool, quantity, direction)
    let shown = rng.shuffle(chosen)
    for (let i = 0; i < 6 && (sameIds(shown, order) || sameIds(shown, [...order].reverse())); i++) shown = rng.shuffle(chosen)
    const question: ElectronsOrderQuestion = {
      kind: 'order',
      family,
      quantity,
      direction,
      items: shown,
      order,
    }
    const thing = family === 'spectrum' ? 'regions' : 'colors'
    const extreme = direction === 'increasing' ? 'smallest' : 'largest'
    const prompt = `Tap these ${thing} in order of ${direction} ${quantity}, starting with the ${extreme}.`
    const context = family === 'spectrum' ? 'These are regions of the electromagnetic spectrum.' : 'These are colors of visible light.'
    const labels = order.map((id) => pool.find((item) => item.id === id)!.label)
    const reveal = [
      'Radio has the longest wavelength and the lowest frequency and energy; gamma has the shortest wavelength and the highest frequency and energy. Among visible colors, red is the long-wavelength end and violet is the short-wavelength end.',
      'Frequency and energy both rise as wavelength falls, so those rankings are the reverse of the wavelength ranking.',
      `In order of ${direction} ${quantity}: ${labels.join(' → ')}.`,
    ]
    const ruleCards = [ltRule('spectrum'), ltRule('inverse'), ltRule('higher')]
    return {
      id: `${EL_MODULE_ID}/light.spectrum@1/${(seed >>> 0).toString(36)}`,
      moduleId: EL_MODULE_ID,
      templateId: 'light.spectrum',
      skill: 'light.spectrum',
      genVersion: 1,
      seed,
      knobs,
      kind: 'electrons',
      title: 'Order the spectrum',
      instructions: INSTRUCTIONS,
      statementText: prompt,
      vars: [],
      start: null,
      canonical: [],
      answer: {
        type: 'electrons',
        question,
        prompt,
        context,
        expectedDisplay: labels.join(' → '),
        nudge: NUDGE,
        ruleCard: ruleCards[0]!,
        ruleCards,
        reveal,
        trap: `${family}-${quantity}-${direction}`,
      },
      graph: { kind: 'none' },
      calc: NO_CALC,
      params: { scenario: family, trap: `${family}-${quantity}-${direction}`, draws: 1, fallback: false, quantity, direction },
    }
  },
}
