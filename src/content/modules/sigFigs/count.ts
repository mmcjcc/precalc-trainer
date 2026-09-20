/**
 * sf.count — how many significant figures does this measurement have?
 * Traps across seeds: leading zeros, captive zeros, trailing zeros with and without a decimal point,
 * a trailing decimal point ("1200."), scientific notation.
 */
import type { Rng } from '@/content/rng'
import type { DifficultyKnobs } from '@/content/types'
import { KINDS, pickUnit, recordedSentence, type QuantityKind } from './contexts'
import { makeSigFigTemplate, SCI_KNOB, type Scenario, type SigFigDraft } from './build'
import { digitsOf, nonzeroDigit, scientific, zeros } from './numbers'
import { sfRule } from './rules'

const NUDGE =
  'Start at the first nonzero digit and walk to the right: every digit from there on counts, with one exception — zeros at the very end of a whole number that has no decimal point.'

function draft(rng: Rng, text: string, trap: string, ruleCards: string[], nudge?: string): SigFigDraft {
  const kind: QuantityKind = rng.pick(KINDS)
  const unit = pickUnit(rng, kind, text)
  const out: SigFigDraft = {
    task: { kind: 'count', text },
    quantities: [{ text, unit, label: kind }],
    unit: '',
    context: recordedSentence(rng, kind, text, unit),
    trap,
    ruleCards,
  }
  if (nudge) out.nudge = nudge
  return out
}

const R = sfRule

export const COUNT_SCENARIOS: Scenario[] = [
  {
    id: 'leading-zeros',
    weight: 2,
    draw: (rng) => draft(rng, `0.${zeros(rng.int(1, 3))}${digitsOf(rng, rng.int(2, 3))}`, 'leading-zeros', [R('leading'), R('nonzero')]),
  },
  {
    id: 'leading-and-trailing-zeros',
    weight: 2,
    draw: (rng) =>
      draft(
        rng,
        `0.${zeros(rng.int(1, 3))}${digitsOf(rng, rng.int(1, 2))}${zeros(rng.int(1, 2))}`,
        'leading-and-trailing-zeros',
        [R('trailing'), R('leading')],
        'Two kinds of zeros here. The ones in front only place the decimal point. The ones at the end come after a decimal point, so somebody measured them.',
      ),
  },
  {
    id: 'captive-zeros',
    weight: 2,
    draw: (rng) => {
      const core = `${nonzeroDigit(rng)}${zeros(rng.int(1, 2))}${digitsOf(rng, rng.int(1, 2))}`
      const form = rng.int(0, 3)
      const text =
        form === 0
          ? core // 5002
          : form === 1
            ? `${core.slice(0, 1)}.${core.slice(1)}` // 5.002
            : form === 2
              ? `${core.slice(0, 2)}.${core.slice(2)}` // 50.02
              : `0.${zeros(rng.int(1, 2))}${core}` // 0.05002
      return draft(rng, text, 'captive-zeros', [R('captive'), form === 3 ? R('leading') : R('nonzero')])
    },
  },
  {
    id: 'trailing-zeros-decimal',
    weight: 2,
    draw: (rng) => {
      const head = digitsOf(rng, rng.int(1, 2))
      const tail = zeros(rng.int(1, 3))
      const all = head + tail
      const fraction = rng.int(1, tail.length)
      const text = `${all.slice(0, all.length - fraction)}.${all.slice(all.length - fraction)}`
      return draft(rng, text, 'trailing-zeros-decimal', [R('trailing'), R('nonzero')])
    },
  },
  {
    id: 'placeholder-zeros',
    weight: 2,
    draw: (rng) => {
      const head = digitsOf(rng, rng.int(1, 3))
      return draft(rng, `${head}${zeros(rng.int(1, 6 - head.length))}`, 'placeholder-zeros', [R('trailing')])
    },
  },
  {
    id: 'trailing-point',
    weight: 1,
    draw: (rng) =>
      draft(
        rng,
        `${digitsOf(rng, rng.int(1, 2))}${zeros(rng.int(1, 3))}.`,
        'trailing-point',
        [R('trailing'), R('showFigures')],
        'There is a decimal point at the very end. It is there on purpose: it tells you the zeros in front of it were measured.',
      ),
  },
  {
    id: 'scientific',
    weight: 2,
    draw: (rng) => {
      const figs = rng.int(1, 4)
      const digits = rng.chance(0.4) && figs >= 2 ? `${digitsOf(rng, figs - 1, { lastNonzero: false })}0` : digitsOf(rng, figs)
      const power = rng.chance(0.5) ? rng.int(2, 9) : rng.int(-9, -2)
      return draft(
        rng,
        scientific(digits, power),
        'scientific',
        [R('scientific'), R('trailing')],
        'Look only at the number in front of the × 10. Every digit written there counts, zeros included; the power of ten just sets the size.',
      )
    },
  },
  {
    id: 'everything',
    weight: 1,
    draw: (rng) =>
      draft(
        rng,
        `0.${zeros(rng.int(1, 2))}${nonzeroDigit(rng)}${zeros(rng.int(1, 2))}${nonzeroDigit(rng)}${zeros(rng.int(1, 2))}`,
        'leading-captive-and-trailing-zeros',
        [R('leading'), R('captive'), R('trailing')],
        'Three kinds of zeros in one number: in front (never count), in the middle (always count), and at the end after a decimal point (count).',
      ),
  },
  {
    id: 'plain',
    weight: 1,
    draw: (rng) => {
      const digits = digitsOf(rng, rng.int(3, 5), { noZeros: true })
      const fraction = rng.int(1, digits.length - 1)
      return draft(rng, `${digits.slice(0, digits.length - fraction)}.${digits.slice(digits.length - fraction)}`, 'no-zeros', [R('nonzero')])
    },
  },
]

export const countTemplate = makeSigFigTemplate({
  id: 'sf.count',
  title: 'Count the significant figures',
  description: 'A measurement as it was written down. How many of its digits are significant?',
  version: 1,
  knobs: [SCI_KNOB],
  instructions: 'Tap every digit that is significant, then check.',
  entry: 'count',
  nudge: NUDGE,
  scenarios: (knobs: DifficultyKnobs) =>
    knobs.sciNotation === true ? COUNT_SCENARIOS.filter((s) => s.id === 'scientific') : COUNT_SCENARIOS,
  fallback: {
    task: { kind: 'count', text: '0.00450' },
    quantities: [{ text: '0.00450', unit: 'g', label: 'mass' }],
    unit: '',
    context: 'A lab notebook lists the mass of a sample as 0.00450 g.',
    trap: 'leading-and-trailing-zeros',
    ruleCards: [R('trailing'), R('leading')],
  },
})
