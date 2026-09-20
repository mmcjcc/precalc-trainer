/**
 * sf.round — round a calculator value to N significant figures (or to a named place).
 * Traps across seeds: leading zeros, placeholder zeros in a big number, an answer that needs
 * scientific notation or a trailing decimal point (rule 11), a rounding that carries (0.99961 → 1.00),
 * a significant trailing zero that must be kept (3.0448 → 3.0), a numeral in scientific notation.
 */
import type { Rng } from '@/content/rng'
import type { DifficultyKnobs } from '@/content/types'
import { sigFigPlaceName } from '@/engine'
import type { SigFigEvaluation } from '@/shared/types'
import { calculatorSentence, KINDS, pickUnit, type QuantityKind } from './contexts'
import { makeSigFigTemplate, SCI_KNOB, type Scenario, type SigFigDraft } from './build'
import { digitBetween, digitsOf, nonzeroDigit, scientific, zeros } from './numbers'
import { sfRule } from './rules'

const NUDGE =
  'Find the first nonzero digit and count along to the last digit you keep. Look only at the very next digit to decide whether the kept part goes up or stays. Then check that what you wrote still shows the right number of figures.'

const R = sfRule

const isScientific = (ev: SigFigEvaluation): boolean => ev.expected.text.includes('x 10^')
const hasTrailingPoint = (ev: SigFigEvaluation): boolean => ev.expected.text.endsWith('.')
const keepsDecimalZero = (ev: SigFigEvaluation): boolean => /\.\d*0$/.test(ev.expected.text) && !isScientific(ev)
/** The rounded value is a single 1 followed by zeros: the rounding carried all the way (0.99961 → 1.00). */
const carriedToOne = (ev: SigFigEvaluation): boolean => ev.expected.value.replace(/[.0-]/g, '') === '1' && ev.rounding === 'up'

function figsDraft(
  rng: Rng,
  text: string,
  sigFigs: number,
  trap: string,
  ruleCards: string[],
  extra: { nudge?: string; accept?: (ev: SigFigEvaluation) => boolean } = {},
): SigFigDraft {
  const kind: QuantityKind = rng.pick(KINDS)
  const unit = pickUnit(rng, kind, text)
  const target = `${sigFigs} significant figure${sigFigs === 1 ? '' : 's'}`
  const out: SigFigDraft = {
    task: { kind: 'round', text, sigFigs },
    quantities: [{ text, unit, label: kind }],
    unit,
    context: calculatorSentence(rng, kind, text, unit, target),
    trap,
    ruleCards,
    params: { sigFigs },
  }
  if (extra.nudge) out.nudge = extra.nudge
  if (extra.accept) out.accept = extra.accept
  return out
}

/** A digit that cannot start a tie: 6-9, or 5 followed by a nonzero digit. */
function upDigits(rng: Rng): string {
  return rng.chance(0.3) ? `5${nonzeroDigit(rng)}` : digitBetween(rng, 6, 9)
}

export const ROUND_SCENARIOS: Scenario[] = [
  {
    id: 'leading-zeros',
    weight: 2,
    draw: (rng) => figsDraft(rng, `0.${zeros(rng.int(1, 3))}${digitsOf(rng, rng.int(4, 5))}`, rng.int(2, 3), 'leading-zeros', [R('leading'), R('rounding')]),
  },
  {
    id: 'placeholder-zeros',
    weight: 2,
    draw: (rng) =>
      figsDraft(rng, digitsOf(rng, rng.int(4, 6), { noZeros: true }), rng.int(2, 3), 'placeholder-zeros', [R('showFigures'), R('rounding')], {
        nudge: 'The dropped digits are in front of the decimal point, so they cannot just disappear: each one becomes a placeholder zero, or the number changes size.',
        accept: (ev) => !isScientific(ev) && !hasTrailingPoint(ev) && ev.expected.place > 0,
      }),
  },
  {
    id: 'needs-scientific',
    weight: 2,
    draw: (rng) => {
      const n = rng.int(2, 3)
      // Kept digits end in a zero, either directly (40|312 → 4.0 × 10⁴) or by carrying (19|99 → 2.0 × 10³).
      const kept = rng.chance(0.5) ? `${digitsOf(rng, n - 1)}0` : `${digitsOf(rng, n - 1, { lastNonzero: false })}9`
      const rest = kept.endsWith('0') ? `${digitBetween(rng, 0, 4)}${digitsOf(rng, rng.int(1, 2))}` : `${upDigits(rng)}${digitsOf(rng, rng.int(0, 1))}`
      return figsDraft(rng, kept + rest, n, 'needs-scientific', [R('showFigures'), R('trailing')], {
        nudge: 'Your rounded digits end in a zero. Written as a plain whole number that zero would look like a placeholder, so find a way to write it that shows it counts.',
        accept: isScientific,
      })
    },
  },
  {
    id: 'trailing-point',
    weight: 1,
    draw: (rng) => {
      // Whole part ends in 0 (or carries to one) and the answer stops in the ones place: "150." / "2000."
      const n = rng.int(2, 4)
      const whole = rng.chance(0.5) ? `${digitsOf(rng, n - 1)}0` : `${digitsOf(rng, n - 1, { lastNonzero: false })}9`
      const fraction = whole.endsWith('0') ? `${digitBetween(rng, 0, 4)}${digitsOf(rng, 1)}` : `${upDigits(rng)}`
      return figsDraft(rng, `${whole}.${fraction}`, n, 'trailing-point', [R('showFigures'), R('trailing')], {
        nudge: 'The last digit you keep is a zero in the ones place. A whole number ending in zero hides that, so show it: a decimal point at the end, or scientific notation.',
        accept: hasTrailingPoint,
      })
    },
  },
  {
    id: 'carry',
    weight: 2,
    draw: (rng) => {
      const n = rng.int(2, 3)
      const nines = '9'.repeat(n)
      const tail = `${upDigits(rng)}${digitsOf(rng, rng.int(0, 1))}`
      const form = rng.int(0, 2)
      const text = form === 0 ? `0.${zeros(rng.int(0, 2))}${nines}${tail}` : form === 1 ? `${nines[0]}.${nines.slice(1)}${tail}` : `${nines}.${tail}`
      return figsDraft(rng, text, n, 'carry', [R('rounding'), R('showFigures')], {
        nudge: 'Every kept digit is a 9 and the next digit rounds up, so the carry runs all the way through. Write the new number, then make sure it still shows the figures you were asked for.',
        accept: carriedToOne,
      })
    },
  },
  {
    id: 'keep-zero',
    weight: 2,
    draw: (rng) => {
      const n = rng.int(2, 3)
      const kept = `${digitsOf(rng, n - 1)}0`
      const rest = `${digitBetween(rng, 0, 4)}${digitsOf(rng, rng.int(1, 2))}`
      const all = kept + rest
      const intDigits = rng.int(1, n - 1)
      const text = `${all.slice(0, intDigits)}.${all.slice(intDigits)}`
      return figsDraft(rng, text, n, 'keep-zero', [R('showFigures'), R('trailing')], {
        nudge: 'The last digit you keep is a zero after the decimal point. It was earned, so it stays in the answer.',
        accept: keepsDecimalZero,
      })
    },
  },
  {
    id: 'to-place',
    weight: 1,
    draw: (rng) => {
      const place = rng.pick([-3, -2, -2, -1, -1, 0, 1])
      const digits = digitsOf(rng, rng.int(Math.max(4, -place + 2), 6))
      const fraction = place >= 0 ? rng.int(1, 2) : rng.int(-place + 1, Math.min(-place + 2, digits.length - 1))
      const text = `${digits.slice(0, digits.length - fraction)}.${digits.slice(digits.length - fraction)}`
      const kind: QuantityKind = rng.pick(KINDS)
      const unit = pickUnit(rng, kind, text)
      return {
        task: { kind: 'round', text, place },
        quantities: [{ text, unit, label: kind }],
        unit,
        context: calculatorSentence(rng, kind, text, unit, `the ${sigFigPlaceName(place)} place`),
        trap: 'round-to-place',
        nudge: `Find the ${sigFigPlaceName(place)} place first. Everything to its right gets dropped, and the very first dropped digit decides whether the ${sigFigPlaceName(place)} digit goes up.`,
        ruleCards: [R('rounding'), R('addsub')],
        params: { place },
      }
    },
  },
  {
    id: 'scientific-numeral',
    weight: 1,
    draw: (rng) => {
      const digits = digitsOf(rng, rng.int(4, 5))
      const power = rng.chance(0.5) ? rng.int(2, 23) : rng.int(-9, -2)
      return figsDraft(rng, scientific(digits, power), rng.int(2, 3), 'scientific-numeral', [R('scientific'), R('rounding')], {
        nudge: 'Round the number in front of the × 10 and leave the power of ten alone. Only if the rounding carries into a new digit does the power change.',
      })
    },
  },
  {
    id: 'plain',
    weight: 1,
    draw: (rng) => {
      const digits = digitsOf(rng, rng.int(4, 6), { noZeros: true })
      const fraction = rng.int(1, digits.length - 1)
      return figsDraft(rng, `${digits.slice(0, digits.length - fraction)}.${digits.slice(digits.length - fraction)}`, rng.int(2, 3), 'plain', [R('rounding'), R('nonzero')])
    },
  },
]

export const roundTemplate = makeSigFigTemplate({
  id: 'sf.round',
  title: 'Round to significant figures',
  description: 'A calculator value that must be reported to a given number of significant figures (or to a named place).',
  version: 1,
  knobs: [SCI_KNOB],
  instructions: 'Round the value. Write the answer so that it shows exactly the figures asked for.',
  entry: 'numeral',
  nudge: NUDGE,
  scenarios: (knobs: DifficultyKnobs) =>
    knobs.sciNotation === true ? ROUND_SCENARIOS.filter((s) => s.id === 'scientific-numeral') : ROUND_SCENARIOS,
  fallback: {
    task: { kind: 'round', text: '0.004567', sigFigs: 2 },
    quantities: [{ text: '0.004567', unit: 'g', label: 'mass' }],
    unit: 'g',
    context: 'A calculator shows 0.004567 g for the mass of a sample, but the measurements only support 2 significant figures.',
    trap: 'leading-zeros',
    ruleCards: [R('leading'), R('rounding')],
    params: { sigFigs: 2 },
  },
})
