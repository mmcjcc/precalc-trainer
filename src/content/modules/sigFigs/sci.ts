/**
 * sf.sci — rewrite a measurement in scientific notation, or back in standard notation, without
 * changing its significant figures.
 * Traps across seeds: leading zeros (0.0045 → 4.5 × 10⁻³), a trailing zero after the point that
 * must survive (0.00450 → 4.50 × 10⁻³), placeholder zeros that must NOT appear in the coefficient
 * (1200 → 1.2 × 10³), a trailing point that makes them count (1200. → 1.200 × 10³), captive zeros,
 * and the way back: 4.50 × 10⁻³ → 0.00450, 3.00 × 10² → 300., 2.50 × 10¹ → 25.0.
 */
import type { Rng } from '@/content/rng'
import type { SigFigEvaluation } from '@/shared/types'
import { KINDS, pickUnit, recordedSentence, type QuantityKind } from './contexts'
import { makeSigFigTemplate, type Scenario, type SigFigDraft } from './build'
import { digitsOf, nonzeroDigit, scientific, zeros } from './numbers'
import { hasTrailingPoint } from './muldiv'
import { sfRule } from './rules'

const R = sfRule

const TO_SCI_NUDGE =
  'Move the decimal point until exactly one nonzero digit sits in front of it, and count the jumps for the power of ten. Every significant figure you started with must still be showing, and nothing extra.'
const TO_STD_NUDGE =
  'Move the decimal point the number of places the power of ten says: right for a positive power, left for a negative one, filling gaps with zeros. Then check the figures: the same digits must be significant as before.'

function draft(rng: Rng, text: string, to: 'scientific' | 'standard', trap: string, ruleCards: string[], extra: { nudge?: string; accept?: (ev: SigFigEvaluation) => boolean } = {}): SigFigDraft {
  const kind: QuantityKind = rng.pick(KINDS)
  const unit = pickUnit(rng, kind, text)
  const out: SigFigDraft = {
    task: { kind: 'convert', text, to },
    quantities: [{ text, unit, label: kind }],
    unit,
    context: recordedSentence(rng, kind, text, unit),
    trap,
    ruleCards,
    nudge: extra.nudge ?? (to === 'scientific' ? TO_SCI_NUDGE : TO_STD_NUDGE),
  }
  if (extra.accept) out.accept = extra.accept
  return out
}

export const SCI_SCENARIOS: Scenario[] = [
  {
    id: 'leading-zeros',
    weight: 2,
    draw: (rng) => draft(rng, `0.${zeros(rng.int(1, 4))}${digitsOf(rng, rng.int(2, 3))}`, 'scientific', 'leading-zeros', [R('movePoint'), R('leading')]),
  },
  {
    id: 'leading-and-trailing-zeros',
    weight: 2,
    draw: (rng) =>
      draft(rng, `0.${zeros(rng.int(1, 3))}${digitsOf(rng, rng.int(1, 2))}${zeros(rng.int(1, 2))}`, 'scientific', 'leading-and-trailing-zeros', [R('movePoint'), R('trailing'), R('leading')], {
        nudge: 'The zeros in front disappear when you move the point, but the zeros at the end were measured: they stay in the coefficient.',
      }),
  },
  {
    id: 'placeholder-zeros',
    weight: 2,
    draw: (rng) =>
      draft(rng, `${digitsOf(rng, rng.int(1, 3))}${zeros(rng.int(1, 4))}`, 'scientific', 'placeholder-zeros', [R('movePoint'), R('trailing')], {
        nudge: 'No decimal point, so the trailing zeros are placeholders. Scientific notation has no room for placeholders: only the significant digits go in the coefficient.',
      }),
  },
  {
    id: 'trailing-point',
    weight: 1,
    draw: (rng) =>
      draft(rng, `${digitsOf(rng, rng.int(1, 2))}${zeros(rng.int(1, 3))}.`, 'scientific', 'trailing-point', [R('movePoint'), R('trailing')], {
        nudge: 'That decimal point at the end makes every zero significant, so all of them must appear in the coefficient.',
      }),
  },
  {
    id: 'captive-zeros',
    weight: 1,
    draw: (rng) => {
      const core = `${nonzeroDigit(rng)}${zeros(rng.int(1, 2))}${digitsOf(rng, rng.int(1, 2))}`
      const text = rng.chance(0.5) ? `${core}${zeros(rng.int(1, 3))}` : `0.${zeros(rng.int(1, 3))}${core}`
      return draft(rng, text, 'scientific', 'captive-zeros', [R('movePoint'), R('captive')])
    },
  },
  {
    id: 'trailing-zeros-decimal',
    weight: 1,
    draw: (rng) => {
      // At least two digits in front of the point, so the power of ten is not 0: 95.00 → 9.500 × 10¹.
      const head = digitsOf(rng, rng.int(1, 2))
      const tail = zeros(rng.int(head.length === 1 ? 2 : 1, 3))
      const all = head + tail
      const fraction = rng.int(1, Math.min(tail.length, all.length - 2))
      return draft(rng, `${all.slice(0, all.length - fraction)}.${all.slice(all.length - fraction)}`, 'scientific', 'trailing-zeros-decimal', [R('movePoint'), R('trailing')])
    },
  },
  {
    id: 'plain-to-scientific',
    weight: 1,
    draw: (rng) => {
      const digits = digitsOf(rng, rng.int(3, 5), { noZeros: true })
      const fraction = rng.int(0, digits.length - 1)
      const text = fraction === 0 ? digits : `${digits.slice(0, digits.length - fraction)}.${digits.slice(digits.length - fraction)}`
      return draft(rng, text, 'scientific', 'plain', [R('movePoint'), R('scientific')])
    },
  },
  {
    id: 'to-standard-small',
    weight: 2,
    draw: (rng) => {
      const digits = rng.chance(0.5) ? `${digitsOf(rng, rng.int(1, 2))}0` : digitsOf(rng, rng.int(2, 3))
      return draft(rng, scientific(digits, rng.int(-6, -1)), 'standard', 'to-standard-small', [R('movePoint'), R('leading'), R('trailing')], {
        nudge: 'A negative power means a small number: move the point to the left and fill with zeros in front. Those new zeros are placeholders, but a zero that was in the coefficient stays significant, so keep it.',
      })
    },
  },
  {
    id: 'to-standard-large',
    weight: 2,
    draw: (rng) => {
      const digits = digitsOf(rng, rng.int(2, 3))
      return draft(rng, scientific(digits, rng.int(digits.length, 6)), 'standard', 'to-standard-large', [R('movePoint'), R('trailing')], {
        nudge: 'A positive power means a big number: move the point to the right and fill the empty places with zeros. Those zeros are placeholders, so no decimal point at the end.',
        accept: (ev) => !hasTrailingPoint(ev),
      })
    },
  },
  {
    id: 'to-standard-trailing-point',
    weight: 1,
    draw: (rng) => {
      // Coefficient ends in zero and the power lands its last figure in the ones place: 3.00 × 10² → 300.
      const digits = `${digitsOf(rng, rng.int(1, 2))}${zeros(rng.int(1, 2))}`
      return draft(rng, scientific(digits, digits.length - 1), 'standard', 'to-standard-trailing-point', [R('movePoint'), R('showFigures'), R('trailing')], {
        nudge: 'The zeros in the coefficient are significant. After you move the point they land in front of the ones place, where a plain whole number would make them look like placeholders. Show that they count.',
        accept: hasTrailingPoint,
      })
    },
  },
  {
    id: 'to-standard-decimal',
    weight: 1,
    draw: (rng) => {
      // 2.50 × 10¹ → 25.0, 1.000 × 10² → 100.0: the point still has somewhere to sit.
      const digits = `${digitsOf(rng, rng.int(1, 2))}${zeros(rng.int(1, 2))}`
      return draft(rng, scientific(digits, rng.int(digits.length >= 3 ? 1 : 0, digits.length - 2)), 'standard', 'to-standard-decimal', [R('movePoint'), R('trailing')])
    },
  },
]

export const sciTemplate = makeSigFigTemplate({
  id: 'sf.sci',
  title: 'Scientific notation',
  description: 'Rewrite a measurement in scientific notation, or back in standard notation, keeping exactly its significant figures.',
  version: 1,
  knobs: [],
  instructions: 'Rewrite the measurement in the notation asked for. It must show exactly the same significant figures.',
  entry: 'numeral',
  nudge: TO_SCI_NUDGE,
  scenarios: () => SCI_SCENARIOS,
  fallback: {
    task: { kind: 'convert', text: '0.00450', to: 'scientific' },
    quantities: [{ text: '0.00450', unit: 'g', label: 'mass' }],
    unit: 'g',
    context: 'A lab notebook lists the mass of a sample as 0.00450 g.',
    trap: 'leading-and-trailing-zeros',
    ruleCards: [R('movePoint'), R('trailing'), R('leading')],
    nudge: TO_SCI_NUDGE,
  },
})
