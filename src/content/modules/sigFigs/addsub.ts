/**
 * sf.addsub — add or subtract measurements; the answer stops at the LEAST precise place.
 * Traps across seeds: mixed decimal places (12.11 + 18.0 + 1.013 → 31.1), a subtraction that loses
 * figures (5.26 − 5.21 → 0.05), a whole number with placeholder zeros that sets a coarse place
 * (1200 + 34.5 → 1200), a sum that needs a trailing point (125 + 75 → 200.), a sum that ends in a
 * significant zero (18.0 + 2.04 → 20.0), a sum that gains a figure (9.8 + 0.57 → 10.4), operands
 * in scientific notation.
 */
import type { Rng } from '@/content/rng'
import type { DifficultyKnobs } from '@/content/types'
import { prettySigFig } from '@/engine'
import type { SigFigEvaluation } from '@/shared/types'
import { makeSigFigTemplate, SCI_KNOB, type DraftQuantity, type Scenario, type SigFigDraft } from './build'
import { digitsOf, fromInteger, measurement, scientific, zeros } from './numbers'
import { endsInDecimalZero, hasTrailingPoint, isScientific } from './muldiv'
import { sfRule } from './rules'

const R = sfRule

const NUDGE =
  'This is + or −, so forget counting figures for a moment. Line the numbers up on the decimal point and find the one that stops earliest. Your answer stops at that same place.'

function q(text: string, unit: string, label: string): DraftQuantity {
  return { text, unit, label }
}

function addsub(
  quantities: DraftQuantity[],
  ops: ('+' | '-')[],
  unit: string,
  context: string,
  trap: string,
  ruleCards: string[],
  extra: { nudge?: string; accept?: (ev: SigFigEvaluation) => boolean } = {},
): SigFigDraft {
  const out: SigFigDraft = {
    task: { kind: 'addsub', terms: quantities.map((x) => ({ text: x.text })), ops },
    quantities,
    unit,
    context,
    trap,
    ruleCards,
  }
  if (extra.nudge) out.nudge = extra.nudge
  if (extra.accept) out.accept = extra.accept
  return out
}

/** Fewest figures among the measured terms (all terms are measured in this template). */
function fewestFigures(ev: SigFigEvaluation): number {
  return Math.min(...ev.task.kind === 'addsub' ? ev.task.terms.map((t) => figuresOf(t.text)) : [99])
}

function figuresOf(text: string): number {
  const core = text.split(/\s*x\s*10\^/i)[0]!.replace('-', '')
  const digits = core.replace('.', '').replace(/^0+/, '')
  return core.includes('.') ? digits.length : digits.replace(/0+$/, '').length
}

function drawMixedPlaces(rng: Rng): SigFigDraft {
  // Three portions weighed on different balances: hundredths, tenths, thousandths (shuffled).
  const specs = rng.shuffle([
    { figs: 4, intDigits: 2 }, // 12.11
    { figs: 3, intDigits: 2 }, // 18.0-ish
    { figs: 4, intDigits: 1 }, // 1.013
  ])
  const texts = specs.map((s) => measurement(rng, s.figs, s.intDigits, rng.chance(0.3)))
  const what = rng.pick(['sodium chloride', 'sand', 'copper filings', 'sugar'])
  return addsub(
    [q(texts[0]!, 'g', 'first portion'), q(texts[1]!, 'g', 'second portion'), q(texts[2]!, 'g', 'third portion')],
    ['+', '+'],
    'g',
    `Three portions of ${what}, weighed on different balances, are combined in one beaker: ${texts[0]} g, ${texts[1]} g and ${texts[2]} g. What is the total mass?`,
    'mixed-places',
    [R('addsub'), R('rounding')],
  )
}

function drawSubtractionLoses(rng: Rng): SigFigDraft {
  const form = rng.int(0, 1)
  if (form === 0) {
    const empty = rng.int(500, 9900)
    const diff = rng.int(2, 95)
    const full = fromInteger(empty + diff, 2)
    const emptyText = fromInteger(empty, 2)
    const holder = rng.pick(['weighing boat', 'watch glass', 'crucible', 'filter paper'])
    const stuff = rng.pick(['catalyst', 'precipitate', 'dye', 'salt'])
    return addsub(
      [q(full, 'g', `${holder} with ${stuff}`), q(emptyText, 'g', `${holder} alone`)],
      ['-'],
      'g',
      `A ${holder} with a pinch of ${stuff} on it has a mass of ${full} g. The empty ${holder} has a mass of ${emptyText} g. What is the mass of the ${stuff}?`,
      'subtraction-loses-figures',
      [R('addsub'), R('leading')],
      {
        nudge: 'Both readings stop at the same place, so the answer stops there too. It will have far fewer figures than the readings you started with, and that is exactly right: subtracting close numbers loses figures.',
        accept: (ev) => ev.expected.sigFigs < fewestFigures(ev),
      },
    )
  }
  const before = rng.int(150, 450) // tenths of a mL
  const diff = rng.int(3, 45)
  const after = fromInteger(before + diff, 1)
  const beforeText = fromInteger(before, 1)
  return addsub(
    [q(after, 'mL', 'water level with the object'), q(beforeText, 'mL', 'water level before')],
    ['-'],
    'mL',
    `A graduated cylinder reads ${beforeText} mL. After a small stone is dropped in, it reads ${after} mL. What is the volume of the stone?`,
    'subtraction-loses-figures',
    [R('addsub'), R('rounding')],
    {
      nudge: 'Both readings stop at the tenths place, so the answer stops at the tenths place too, however few figures that leaves.',
      accept: (ev) => ev.expected.sigFigs < fewestFigures(ev),
    },
  )
}

function drawPlaceholderOperand(rng: Rng): SigFigDraft {
  const big = `${digitsOf(rng, rng.int(1, 2))}${zeros(rng.int(2, 3))}`
  const small = measurement(rng, rng.int(3, 4), rng.int(1, 2))
  return addsub(
    [q(big, 'mL', 'water already in the carboy'), q(small, 'mL', 'solution added')],
    ['+'],
    'mL',
    `A carboy holds roughly ${big} mL of water (read from the marks on its side). A student adds ${small} mL of solution from a burette. What is the total volume?`,
    'placeholder-operand',
    [R('addsub'), R('trailing')],
    {
      nudge: 'The big number has no decimal point, so its trailing zeros are placeholders: its last significant digit sits well to the left of the ones place. The answer cannot be more precise than that.',
      accept: (ev) => ev.expected.place >= 1,
    },
  )
}

function drawTrailingPoint(rng: Rng): SigFigDraft {
  // Two readings to the ones place whose sum ends in zero: 125 + 75 = 200.
  const total = rng.chance(0.5) ? rng.int(2, 9) * 100 + rng.int(0, 9) * 10 : rng.int(4, 9) * 10
  const a = rng.int(11, total - 11)
  const b = total - a
  return addsub(
    [q(String(a), 'mL', 'first volume'), q(String(b), 'mL', 'second volume')],
    ['+'],
    'mL',
    `${a} mL of water from one beaker is poured together with ${b} mL from another, both read to the nearest millilitre. What is the total volume?`,
    'needs-trailing-point',
    [R('showFigures'), R('addsub')],
    {
      nudge: 'Both numbers are good to the ones place, so the answer is too, even if it ends in zeros. Write it in a way that shows those zeros count: a decimal point at the end, or scientific notation.',
      accept: (ev) => hasTrailingPoint(ev) || isScientific(ev),
    },
  )
}

function drawKeepZero(rng: Rng): SigFigDraft {
  // tenths + hundredths whose sum, rounded to tenths, ends in 0 (18.0 + 2.04 → 20.0).
  const a = fromInteger(rng.int(50, 495), 1)
  const b = fromInteger(rng.int(105, 995), 2)
  return addsub(
    [q(a, 'g', 'mass of the beaker'), q(b, 'g', 'mass of the sample')],
    ['+'],
    'g',
    `A beaker weighed on a top-loading balance has a mass of ${a} g. A sample weighed on an analytical balance has a mass of ${b} g. What is the combined mass?`,
    'keep-zero',
    [R('addsub'), R('showFigures')],
    {
      nudge: 'The answer stops at the tenths place. If the digit there turns out to be a zero, it stays: it says the total is known to the tenths.',
      accept: (ev) => endsInDecimalZero(ev) && ev.expected.place === -1,
    },
  )
}

function drawGainsFigure(rng: Rng): SigFigDraft {
  // 9.8 + 0.57 = 10.37 → 10.4: three figures from two-figure readings.
  const bInt = rng.int(21, 99) // hundredths: two figures
  const a = fromInteger(rng.int(100 - Math.floor(bInt / 10), 99), 1) // tenths, chosen so the sum passes 10
  const b = fromInteger(bInt, 2)
  return addsub(
    [q(a, 'mL', 'first reading'), q(b, 'mL', 'second reading')],
    ['+'],
    'mL',
    `A student combines ${a} mL of solution from a graduated cylinder with ${b} mL from a pipet. What is the total volume?`,
    'gains-a-figure',
    [R('addsub'), R('muldiv')],
    {
      nudge: 'Go by places, not by counting figures. The answer stops at the tenths place, and it may end up with more figures than either reading had. That is fine for + and −.',
      accept: (ev) => ev.expected.sigFigs > Math.max(...(ev.task.kind === 'addsub' ? ev.task.terms.map((t) => figuresOf(t.text)) : [0])),
    },
  )
}

function drawScientific(rng: Rng): SigFigDraft {
  const p = rng.int(2, 4)
  const a = scientific(digitsOf(rng, rng.int(2, 3), { lastNonzero: rng.chance(0.5) }), p)
  const b = scientific(digitsOf(rng, rng.int(2, 3), { lastNonzero: rng.chance(0.5) }), p - rng.int(0, 1))
  const op = rng.chance(0.6) ? '+' : '-'
  return addsub(
    [q(a, 'g', 'first mass'), q(b, 'g', 'second mass')],
    [op],
    'g',
    op === '+'
      ? `A tank contains ${prettySigFig(a)} g of water, and ${prettySigFig(b)} g more is added. What is the total mass?`
      : `A tank contains ${prettySigFig(a)} g of water, and ${prettySigFig(b)} g is drained off. What mass is left?`,
    'scientific-operands',
    [R('scientific'), R('addsub')],
    {
      nudge: 'Write both numbers with the same power of ten (or in ordinary notation) so you can line up the places. Then find which one stops earliest.',
      accept: (ev) => ev.expected.value !== '0' && !ev.expected.value.startsWith('-'),
    },
  )
}

function drawSubtractMixedPlaces(rng: Rng): SigFigDraft {
  const full = fromInteger(rng.int(12000, 29999), 2)
  const empty = fromInteger(rng.int(600, 1150), 1)
  return addsub(
    [q(full, 'g', 'flask with solution'), q(empty, 'g', 'empty flask')],
    ['-'],
    'g',
    `A flask with solution has a mass of ${full} g on an analytical balance. The empty flask, weighed earlier on a coarser balance, was ${empty} g. What is the mass of the solution?`,
    'subtract-mixed-places',
    [R('addsub'), R('rounding')],
  )
}

export const ADDSUB_SCENARIOS: Scenario[] = [
  { id: 'mixed-places', weight: 3, draw: drawMixedPlaces },
  { id: 'subtraction-loses-figures', weight: 3, draw: drawSubtractionLoses },
  { id: 'placeholder-operand', weight: 2, draw: drawPlaceholderOperand },
  { id: 'needs-trailing-point', weight: 2, draw: drawTrailingPoint },
  { id: 'keep-zero', weight: 2, draw: drawKeepZero },
  { id: 'gains-a-figure', weight: 2, draw: drawGainsFigure },
  { id: 'scientific-operands', weight: 2, draw: drawScientific },
  { id: 'subtract-mixed-places', weight: 1, draw: drawSubtractMixedPlaces },
]

export const addsubTemplate = makeSigFigTemplate({
  id: 'sf.addsub',
  title: 'Add and subtract',
  description: 'Combined masses, mass by difference, volumes from readings: add or subtract and stop at the least precise place.',
  version: 1,
  knobs: [SCI_KNOB],
  instructions: 'Do the calculation and give the answer rounded to the correct place.',
  entry: 'numeral',
  nudge: NUDGE,
  scenarios: (knobs: DifficultyKnobs) =>
    knobs.sciNotation === true ? ADDSUB_SCENARIOS.filter((s) => s.id === 'scientific-operands') : ADDSUB_SCENARIOS,
  fallback: {
    task: { kind: 'addsub', terms: [{ text: '12.11' }, { text: '18.0' }, { text: '1.013' }], ops: ['+', '+'] },
    quantities: [q('12.11', 'g', 'first portion'), q('18.0', 'g', 'second portion'), q('1.013', 'g', 'third portion')],
    unit: 'g',
    context: 'Three portions of sodium chloride, weighed on different balances, are combined in one beaker: 12.11 g, 18.0 g and 1.013 g. What is the total mass?',
    trap: 'mixed-places',
    ruleCards: [R('addsub'), R('rounding')],
  },
})
