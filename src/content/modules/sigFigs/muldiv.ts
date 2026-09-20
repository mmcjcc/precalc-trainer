/**
 * sf.muldiv — multiply or divide measurements; the answer keeps the FEWEST significant figures.
 * Traps across seeds: a quotient that ends in a significant zero (12.50 ÷ 4.1 = 3.0), an exact
 * counted or defined number that must not limit the answer, operands in scientific notation, a
 * product that needs scientific notation or a trailing point (rule 11), operands with leading
 * zeros or placeholder zeros, three factors.
 */
import type { Rng } from '@/content/rng'
import type { DifficultyKnobs } from '@/content/types'
import { prettySigFig, sigFigMistakeCandidates } from '@/engine'
import type { ErrorPatternId, SigFigEvaluation } from '@/shared/types'
import { EXACT_KNOB, makeSigFigTemplate, SCI_KNOB, type DraftQuantity, type Scenario, type SigFigDraft } from './build'
import { digitsOf, fromInteger, measurement, scientific, zeros } from './numbers'
import { sfRule } from './rules'

const R = sfRule
const pretty = prettySigFig

const NUDGE =
  'This is × or ÷, so count the significant figures in each MEASURED number. The answer gets the smallest count. Do the whole calculation first, then round once.'
const EXACT_NUDGE =
  'One of these numbers was counted, or is true by definition. It was never measured, so it has no uncertainty: leave it out when you look for the fewest figures.'
const SCI_NUDGE =
  'The power of ten never changes how many figures a number has: count the digits in front of the × 10. Do the arithmetic, then round to the fewest.'

export const isScientific = (ev: SigFigEvaluation): boolean => ev.expected.text.includes('x 10^')
export const hasTrailingPoint = (ev: SigFigEvaluation): boolean => ev.expected.text.endsWith('.')
export const endsInDecimalZero = (ev: SigFigEvaluation): boolean => /\.\d*0$/.test(ev.expected.text)

/** The mistake `id` would give a DIFFERENT answer here, so the task can expose it. */
export function exposes(ev: SigFigEvaluation, id: ErrorPatternId): boolean {
  return sigFigMistakeCandidates(ev.task).some((c) => c.id === id)
}

/** Round a positive integer ratio (used only to aim generated inputs; the engine checks the result). */
function ratio(numerator: number, denominator: number): number {
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator)
}

function q(text: string, unit: string, label: string, exact?: { note: string }): DraftQuantity {
  return exact ? { text, unit, label, exact: true, note: exact.note } : { text, unit, label }
}

function muldiv(
  quantities: DraftQuantity[],
  ops: ('*' | '/')[],
  unit: string,
  context: string,
  trap: string,
  ruleCards: string[],
  extra: { nudge?: string; accept?: (ev: SigFigEvaluation) => boolean; params?: Record<string, number | string | boolean> } = {},
): SigFigDraft {
  const out: SigFigDraft = {
    task: {
      kind: 'muldiv',
      terms: quantities.map((x) => (x.exact ? { text: x.text, exact: true, note: x.note ?? 'exact' } : { text: x.text })),
      ops,
    },
    quantities,
    unit,
    context,
    trap,
    ruleCards,
  }
  if (extra.nudge) out.nudge = extra.nudge
  if (extra.accept) out.accept = extra.accept
  if (extra.params) out.params = extra.params
  return out
}

/** 12.50 g ÷ 4.1 mL → 3.0 g/mL: the divisor limits and the quotient ends in a significant zero. */
function drawQuotientZero(rng: Rng): SigFigDraft {
  const figsB = rng.pick([2, 2, 3])
  const bInt = figsB === 2 ? rng.int(11, 99) : rng.int(101, 999)
  const b = fromInteger(bInt, figsB - 1)
  // Target quotient ends in a zero: k.0 (2 figures) or k.k0 (3 figures), in units of 10^-(figsB-1).
  const qInt = figsB === 2 ? rng.int(2, 9) * 10 : rng.int(11, 99) * 10
  const half = Math.floor((bInt - 1) / 2)
  const exact = bInt * qInt + rng.int(-half, half) // units of 10^-(2 figsB - 2)
  const scale = 10 ** (2 * figsB - 4) // bring the mass to hundredths of a gram
  const a = fromInteger(ratio(exact, scale), 2)
  return muldiv(
    [q(a, 'g', 'mass of the sample'), q(b, 'mL', 'volume of water displaced')],
    ['/'],
    'g/mL',
    `A metal sample has a mass of ${a} g. Dropped into a graduated cylinder, it displaces ${b} mL of water. Find its density.`,
    'quotient-significant-zero',
    [R('muldiv'), R('showFigures')],
    {
      nudge: 'Round to the fewest figures. If your rounded answer ends in a zero after the decimal point, keep it: that zero is one of the figures.',
      accept: (ev) => endsInDecimalZero(ev) && ev.expected.sigFigs === figsB && ev.limit.termIndices.length === 1 && ev.limit.termIndices[0] === 1,
    },
  )
}

const COUNTS = [3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 18, 22, 24, 25, 32, 36, 48]

function drawExactCount(rng: Rng): SigFigDraft {
  const form = rng.int(0, 2)
  const count = String(rng.pick(COUNTS))
  const counted = { note: 'counted' }
  if (form === 0) {
    const m = fromInteger(rng.int(150, 995), 3)
    const thing = rng.pick(['aspirin tablet', 'vitamin tablet', 'sugar cube', 'paper clip'])
    return muldiv(
      [q(m, 'g', `mass of one ${thing}`), q(count, `${thing}s`, 'how many', counted)],
      ['*'],
      'g',
      `One ${thing} has a mass of ${m} g. What is the total mass of ${count} of them?`,
      'exact-count',
      [R('exact'), R('muldiv')],
      { nudge: EXACT_NUDGE, accept: (ev) => exposes(ev, 'sf_exact_limited') },
    )
  }
  if (form === 1) {
    const total = fromInteger(rng.int(1500, 9999), 2)
    const thing = rng.pick(['penny', 'marble', 'washer', 'bolt'])
    return muldiv(
      [q(total, 'g', `total mass of the ${thing}s`), q(count, thing === 'penny' ? 'pennies' : `${thing}s`, 'how many', counted)],
      ['/'],
      'g',
      `${count} ${thing === 'penny' ? 'pennies' : `${thing}s`} have a total mass of ${total} g. What is the average mass of one?`,
      'exact-count',
      [R('exact'), R('muldiv')],
      { nudge: EXACT_NUDGE, accept: (ev) => exposes(ev, 'sf_exact_limited') },
    )
  }
  const volume = fromInteger(rng.int(105, 995), 2)
  return muldiv(
    [q(volume, 'mL', 'total volume of the drops'), q(count, 'drops', 'how many', counted)],
    ['/'],
    'mL',
    `${count} drops from a pipet have a total volume of ${volume} mL. What is the volume of one drop?`,
    'exact-count',
    [R('exact'), R('muldiv'), R('leading')],
    { nudge: EXACT_NUDGE, accept: (ev) => exposes(ev, 'sf_exact_limited') },
  )
}

interface Conversion {
  from: string
  to: string
  factor: string
  op: '*' | '/'
  note: string
  /** Figures of the measured value (4 keeps the trap live against 2.54). */
  figs: number
  intDigits: number
  what: string
}

const CONVERSIONS: Conversion[] = [
  { from: 'cm', to: 'm', factor: '100', op: '/', note: 'defined: 100 cm = 1 m', figs: 4, intDigits: 3, what: 'the length of a ribbon' },
  { from: 'mL', to: 'L', factor: '1000', op: '/', note: 'defined: 1000 mL = 1 L', figs: 4, intDigits: 3, what: 'the volume of a solution' },
  { from: 'g', to: 'kg', factor: '1000', op: '/', note: 'defined: 1000 g = 1 kg', figs: 4, intDigits: 3, what: 'the mass of a sample' },
  { from: 'kg', to: 'g', factor: '1000', op: '*', note: 'defined: 1 kg = 1000 g', figs: 4, intDigits: 1, what: 'the mass of a sample' },
  { from: 'min', to: 's', factor: '60', op: '*', note: 'defined: 1 min = 60 s', figs: 3, intDigits: 1, what: 'the reaction time' },
  { from: 'in', to: 'cm', factor: '2.54', op: '*', note: 'defined: 1 in = 2.54 cm', figs: 4, intDigits: 2, what: 'the length of a glass tube' },
]

function drawExactConversion(rng: Rng): SigFigDraft {
  const c = rng.pick(CONVERSIONS)
  const trailing = rng.chance(0.35)
  const value = measurement(rng, c.figs, c.intDigits, trailing)
  const factorUnit = c.op === '/' ? `${c.from}/${c.to}` : `${c.to}/${c.from}`
  return muldiv(
    [q(value, c.from, c.what), q(c.factor, factorUnit, 'conversion factor', { note: c.note })],
    [c.op],
    c.to,
    `A student measures ${c.what} as ${value} ${c.from}. Express it in ${c.to} (${c.note.replace('defined: ', '')}, exactly).`,
    'exact-conversion',
    [R('exact'), R('muldiv'), R('showFigures')],
    {
      nudge: 'The conversion factor is a definition, not a measurement, so it has unlimited figures. Only the measured value decides how many figures the answer keeps.',
      accept: (ev) => exposes(ev, 'sf_exact_limited'),
      params: { conversion: `${c.from}->${c.to}` },
    },
  )
}

function drawScientific(rng: Rng): SigFigDraft {
  const form = rng.int(0, 3)
  if (form === 0) {
    const t = measurement(rng, rng.int(2, 3), rng.int(1, 2))
    return muldiv(
      [q('3.00 x 10^8', 'm/s', 'speed of light'), q(t, 's', 'time')],
      ['*'],
      'm',
      `Light travels at 3.00 × 10⁸ m/s. How far does it travel in ${t} s?`,
      'scientific-operands',
      [R('scientific'), R('muldiv')],
      { nudge: SCI_NUDGE },
    )
  }
  if (form === 1) {
    const a = scientific(digitsOf(rng, rng.int(2, 3), { lastNonzero: rng.chance(0.5) }), rng.int(2, 3))
    const b = scientific(digitsOf(rng, rng.int(2, 3), { lastNonzero: rng.chance(0.5) }), rng.int(1, 2))
    return muldiv(
      [q(a, 'm', 'length'), q(b, 'm', 'width')],
      ['*'],
      'm²',
      `A rectangular field is ${pretty(a)} m long and ${pretty(b)} m wide. Find its area.`,
      'scientific-operands',
      [R('scientific'), R('muldiv')],
      { nudge: SCI_NUDGE },
    )
  }
  if (form === 2) {
    const mass = fromInteger(rng.int(105, 995), 2)
    const molecules = scientific(digitsOf(rng, 3), rng.int(20, 22))
    return muldiv(
      [q(mass, 'g', 'mass of the gas sample'), q(molecules, 'molecules', 'number of molecules')],
      ['/'],
      'g',
      `A ${mass} g sample of a gas is found to contain ${pretty(molecules)} molecules. What is the average mass of one molecule?`,
      'scientific-operands',
      [R('scientific'), R('muldiv')],
      { nudge: SCI_NUDGE },
    )
  }
  const drop = scientific(`${digitsOf(rng, 1)}0`, -2)
  const density = fromInteger(rng.int(701, 1399), 3)
  return muldiv(
    [q(drop, 'mL', 'volume of one drop'), q(density, 'g/mL', 'density of the liquid')],
    ['*'],
    'g',
    `One drop of a liquid has a volume of ${pretty(drop)} mL, and the liquid's density is ${density} g/mL. What is the mass of the drop?`,
    'scientific-operands',
    [R('scientific'), R('muldiv'), R('showFigures')],
    { nudge: SCI_NUDGE },
  )
}

/** A product whose rounded digits end in a zero in front of the decimal point: 2.0 × 10² cm² or "120." cm². */
function drawNeedsScientific(rng: Rng): SigFigDraft {
  const threeFigures = rng.chance(0.4)
  let l: string
  let w: string
  if (threeFigures) {
    const wInt = rng.int(101, 999) // hundredths → 3 figures
    const target = rng.int(12, 99) * 10 // 120 … 990, three figures ending in 0
    l = fromInteger(ratio(target * 10_000, wInt), 2) // hundredths → 4+ figures
    w = fromInteger(wInt, 2)
  } else {
    const wInt = rng.int(11, 99) // tenths → 2 figures
    const target = rng.int(1, 9) * 100 // 100 … 900, two figures ending in 0
    l = fromInteger(ratio(target * 100, wInt), 1) // tenths → 3+ figures
    w = fromInteger(wInt, 1)
  }
  return muldiv(
    [q(l, 'cm', 'length of the foil'), q(w, 'cm', 'width of the foil')],
    ['*'],
    'cm²',
    `A rectangle of aluminum foil is ${l} cm long and ${w} cm wide. Find its area.`,
    'needs-scientific-or-point',
    [R('showFigures'), R('muldiv'), R('trailing')],
    {
      nudge: 'Round to the fewest figures first. If the rounded digits end in a zero in front of the decimal point, a plain whole number will not show that zero counts: use scientific notation or a decimal point at the end.',
      accept: (ev) => (isScientific(ev) || hasTrailingPoint(ev)) && exposes(ev, 'sf_ambiguous_zeros'),
    },
  )
}

function drawLeadingZeros(rng: Rng): SigFigDraft {
  const trailing = rng.chance(0.4)
  const volume = trailing ? fromInteger(rng.int(11, 99) * 10, 4) : fromInteger(rng.int(101, 999), 4)
  const density = fromInteger(rng.int(1001, 2999), 3)
  const gas = rng.pick(['nitrogen', 'oxygen', 'argon', 'carbon dioxide'])
  return muldiv(
    [q(volume, 'L', 'volume of the gas'), q(density, 'g/L', 'density of the gas')],
    ['*'],
    'g',
    `A sample of ${gas} has a volume of ${volume} L, and its density is ${density} g/L. What is the mass of the sample?`,
    'operand-leading-zeros',
    [R('leading'), R('muldiv'), R('trailing')],
    {
      nudge: 'Count the figures of the small number carefully: zeros in front of the first nonzero digit do not count, but a zero at the end after the decimal point does.',
      accept: (ev) => ev.limit.termIndices.length === 1 && ev.limit.termIndices[0] === 0,
    },
  )
}

function drawPlaceholderZeros(rng: Rng): SigFigDraft {
  const volume = `${digitsOf(rng, rng.int(1, 2))}${zeros(rng.int(2, 3))}`
  const time = measurement(rng, 3, 2)
  return muldiv(
    [q(volume, 'mL', 'volume drained'), q(time, 'min', 'time taken')],
    ['/'],
    'mL/min',
    `A carboy drains ${volume} mL of solution in ${time} min. What is the flow rate?`,
    'operand-placeholder-zeros',
    [R('trailing'), R('muldiv')],
    {
      nudge: 'The whole number has no decimal point, so its trailing zeros are only placeholders. Count its figures before you decide which number limits the answer.',
      accept: (ev) => ev.limit.termIndices.length === 1 && ev.limit.termIndices[0] === 0,
    },
  )
}

function drawThreeFactors(rng: Rng): SigFigDraft {
  const figs = rng.shuffle([4, 3, 2])
  const dims = figs.map((f) => measurement(rng, f, rng.int(1, 2), rng.chance(0.25)))
  return muldiv(
    [q(dims[0]!, 'cm', 'length'), q(dims[1]!, 'cm', 'width'), q(dims[2]!, 'cm', 'height')],
    ['*', '*'],
    'cm³',
    `A block of metal measures ${dims[0]} cm by ${dims[1]} cm by ${dims[2]} cm. Find its volume.`,
    'three-factors',
    [R('muldiv'), R('rounding')],
  )
}

function drawPlain(rng: Rng): SigFigDraft {
  const density = fromInteger(rng.int(701, 1999), 2)
  const volume = measurement(rng, rng.int(3, 4), 2, rng.chance(0.3))
  const liquid = rng.pick(['ethanol', 'glycerol', 'salt water', 'vinegar', 'olive oil'])
  return muldiv(
    [q(density, 'g/mL', 'density'), q(volume, 'mL', 'volume')],
    ['*'],
    'g',
    `The density of ${liquid} is ${density} g/mL. What is the mass of ${volume} mL of it?`,
    'plain',
    [R('muldiv'), R('rounding')],
  )
}

function drawScientificExact(rng: Rng): SigFigDraft {
  const perDrop = scientific(digitsOf(rng, 3), 21)
  const count = String(rng.pick(COUNTS))
  return muldiv(
    [q(perDrop, 'molecules', 'molecules in one drop'), q(count, 'drops', 'how many', { note: 'counted' })],
    ['*'],
    'molecules',
    `One drop of water contains ${pretty(perDrop)} molecules. How many molecules are in ${count} drops?`,
    'scientific-and-exact',
    [R('exact'), R('scientific'), R('muldiv')],
    { nudge: EXACT_NUDGE, accept: (ev) => exposes(ev, 'sf_exact_limited') },
  )
}

export const MULDIV_SCENARIOS: Scenario[] = [
  { id: 'quotient-significant-zero', weight: 3, draw: drawQuotientZero },
  { id: 'exact-count', weight: 2, draw: drawExactCount },
  { id: 'exact-conversion', weight: 2, draw: drawExactConversion },
  { id: 'scientific-operands', weight: 2, draw: drawScientific },
  { id: 'needs-scientific-or-point', weight: 2, draw: drawNeedsScientific },
  { id: 'operand-leading-zeros', weight: 2, draw: drawLeadingZeros },
  { id: 'operand-placeholder-zeros', weight: 1, draw: drawPlaceholderZeros },
  { id: 'three-factors', weight: 1, draw: drawThreeFactors },
  { id: 'plain', weight: 1, draw: drawPlain },
]

const EXACT_IDS = new Set(['exact-count', 'exact-conversion'])

export function muldivScenarios(knobs: DifficultyKnobs): Scenario[] {
  if (knobs.exactNumbers === true && knobs.sciNotation === true) {
    return [{ id: 'scientific-and-exact', weight: 1, draw: drawScientificExact }]
  }
  if (knobs.exactNumbers === true) return MULDIV_SCENARIOS.filter((s) => EXACT_IDS.has(s.id))
  if (knobs.sciNotation === true) return MULDIV_SCENARIOS.filter((s) => s.id === 'scientific-operands')
  return MULDIV_SCENARIOS
}

export const muldivTemplate = makeSigFigTemplate({
  id: 'sf.muldiv',
  title: 'Multiply and divide',
  description: 'Density, area, unit conversions: multiply or divide measurements and keep the fewest significant figures.',
  version: 1,
  knobs: [EXACT_KNOB, SCI_KNOB],
  instructions: 'Do the calculation and give the answer with the correct number of significant figures.',
  entry: 'numeral',
  nudge: NUDGE,
  scenarios: muldivScenarios,
  fallback: {
    task: { kind: 'muldiv', terms: [{ text: '12.50' }, { text: '4.1' }], ops: ['/'] },
    quantities: [q('12.50', 'g', 'mass of the sample'), q('4.1', 'mL', 'volume of water displaced')],
    unit: 'g/mL',
    context: 'A metal sample has a mass of 12.50 g. Dropped into a graduated cylinder, it displaces 4.1 mL of water. Find its density.',
    trap: 'quotient-significant-zero',
    ruleCards: [R('muldiv'), R('showFigures')],
  },
})
