/**
 * sf.mixed — two rules in one problem: a sum or difference inside a product or quotient (or the
 * other way round). Carry every digit through, note the precision of the intermediate, round once.
 * Traps across seeds: mass by difference then density (the subtraction limits), the average of
 * counted trials (an exact 3 that must not limit), percent error (× 100 exact), calorimetry
 * (ΔT limits), product plus a mass (outer + −), a task where rounding the intermediate early
 * changes the answer, operands in scientific notation.
 */
import type { Rng } from '@/content/rng'
import type { DifficultyKnobs } from '@/content/types'
import { prettySigFig } from '@/engine'
import type { SigFigEvaluation, SigFigOp, SigFigOperand } from '@/shared/types'
import { EXACT_KNOB, makeSigFigTemplate, SCI_KNOB, type DraftQuantity, type Scenario, type SigFigDraft } from './build'
import { digitBetween, digitsOf, fromInteger, measurement, scientific } from './numbers'
import { exposes } from './muldiv'
import { sfRule } from './rules'

const R = sfRule

const NUDGE =
  'Two rules, one at a time. Do the part in parentheses first and note how precise it is (its last good place, or its number of figures), but keep every digit in the calculator. Round once, at the very end.'
const EARLY_NUDGE =
  'Do not round the intermediate result: write down how many figures it is good to, but carry all of its digits into the next step. Rounding twice moves the answer.'

function q(text: string, unit: string, label: string, exact?: { note: string }): DraftQuantity {
  return exact ? { text, unit, label, exact: true, note: exact.note } : { text, unit, label }
}

/** A quantity that is a group (sub-calculation) in the task. */
interface GroupSpec {
  quantities: DraftQuantity[]
  ops: SigFigOp[]
}

type OperandSpec = DraftQuantity | GroupSpec

const isGroupSpec = (o: OperandSpec): o is GroupSpec => 'quantities' in o

function term(x: DraftQuantity) {
  return x.exact ? { text: x.text, exact: true, note: x.note ?? 'exact' } : { text: x.text }
}

function mixed(
  operands: OperandSpec[],
  ops: SigFigOp[],
  unit: string,
  context: string,
  trap: string,
  ruleCards: string[],
  extra: { nudge?: string; accept?: (ev: SigFigEvaluation) => boolean } = {},
): SigFigDraft {
  const taskOperands: SigFigOperand[] = operands.map((o) => (isGroupSpec(o) ? { terms: o.quantities.map(term), ops: o.ops } : term(o)))
  const out: SigFigDraft = {
    task: { kind: 'mixed', operands: taskOperands, ops },
    quantities: operands.flatMap((o) => (isGroupSpec(o) ? o.quantities : [o])),
    unit,
    context,
    trap,
    ruleCards,
  }
  if (extra.nudge) out.nudge = extra.nudge
  if (extra.accept) out.accept = extra.accept
  return out
}

/**
 * (m_full − m_empty) ÷ V, with a believable density (0.70–1.99 g/mL). When the liquid is a small
 * pipetted volume ("close"), the mass difference has fewer figures than the volume and limits.
 */
function drawDensityByDifference(rng: Rng, close: boolean): SigFigDraft {
  const empty = rng.int(1000, 4999) // hundredths of a gram
  const density = rng.int(70, 199) // hundredths of a g/mL, only to aim the numbers
  const liquid = rng.pick(['an unknown liquid', 'a salt solution', 'a sugar solution', 'a cleaning solution'])
  let volume: string
  let diff: number
  if (close) {
    const vol = rng.pick([100, 200, 250, 500, 750, 1000]) // thousandths of a mL
    volume = fromInteger(vol, 3)
    diff = Math.max(2, Math.round((vol * density) / 1000))
  } else {
    const vol = rng.int(21, 99) // tenths of a mL
    volume = fromInteger(vol, 1)
    diff = Math.round((vol * density) / 10)
  }
  const full = fromInteger(empty + diff, 2)
  const emptyText = fromInteger(empty, 2)
  return mixed(
    [{ quantities: [q(full, 'g', 'vial with liquid'), q(emptyText, 'g', 'empty vial')], ops: ['-'] }, q(volume, 'mL', 'volume of liquid')],
    ['/'],
    'g/mL',
    close
      ? `A micropipette delivers ${volume} mL of ${liquid} into a vial. The empty vial has a mass of ${emptyText} g; with the liquid in it, ${full} g. What is the density of the liquid?`
      : `An empty vial has a mass of ${emptyText} g. With ${volume} mL of ${liquid} in it, the mass is ${full} g. What is the density of the liquid?`,
    close ? 'subtraction-limits' : 'density-by-difference',
    [R('mixed'), R('addsub'), R('muldiv')],
    {
      nudge: close
        ? 'Subtract first and count the figures of the difference: close readings leave only a few. That small count, not the figures of the volume, is what limits the density.'
        : NUDGE,
      accept: close ? (ev) => ev.intermediates.length === 1 && ev.limit.termIndices.length > 0 && ev.limit.termIndices.every((i) => i < 2) : undefined,
    },
  )
}

/** (a + b + c) ÷ 3, the 3 counted. */
function drawAverage(rng: Rng, scientificValues = false): SigFigDraft {
  const trials: string[] = []
  let quantities: DraftQuantity[]
  let what: string
  let unit: string
  // The three values stay below a third of the next power of ten, so the sum has the same number of
  // digits in front of the point as each trial and the average has the figures a teacher expects.
  if (scientificValues) {
    const p = rng.int(3, 5)
    for (let i = 0; i < 3; i++) trials.push(scientific(`${digitBetween(rng, 1, 3)}${digitsOf(rng, rng.int(1, 2), { lastNonzero: rng.chance(0.5) })}`, p))
    what = 'the mass of the tank'
    unit = 'g'
    quantities = trials.map((t, i) => q(t, 'g', `trial ${i + 1}`))
  } else {
    const same = rng.chance(0.5)
    const base = rng.int(1200, 3200) // hundredths
    for (let i = 0; i < 3; i++) {
      const v = base + rng.int(-60, 60)
      trials.push(same || i !== 1 ? fromInteger(v, 2) : fromInteger(Math.round(v / 10), 1))
    }
    what = rng.pick(['the mass of the sample', 'the volume delivered by the pipet', 'the volume of the flask'])
    unit = what.includes('volume') ? 'mL' : 'g'
    quantities = trials.map((t, i) => q(t, unit, `trial ${i + 1}`))
  }
  const shown = trials.map((t) => `${prettySigFig(t)} ${unit}`)
  return mixed(
    [{ quantities, ops: ['+', '+'] }, q('3', 'trials', 'how many trials', { note: 'counted' })],
    ['/'],
    unit,
    `Three trials give ${what} as ${shown[0]}, ${shown[1]} and ${shown[2]}. What is the average?`,
    scientificValues ? 'scientific-average' : 'average-exact-count',
    [R('exact'), R('mixed'), R('addsub')],
    {
      nudge: 'Add the three values and note the place the sum is good to: that fixes how many figures the sum has. The number of trials was counted, so it never limits. Divide with all the digits, then round to the figures of the sum.',
      accept: (ev) => exposes(ev, 'sf_exact_limited'),
    },
  )
}

/** (measured − accepted) ÷ accepted × 100, the 100 defined. */
function drawPercentError(rng: Rng): SigFigDraft {
  const target = rng.pick([
    { what: 'the density of aluminum', accepted: 270, places: 2, unit: 'g/mL' },
    { what: 'the boiling point of ethanol', accepted: 784, places: 1, unit: '°C' },
    { what: 'the melting point of naphthalene', accepted: 803, places: 1, unit: '°C' },
    { what: 'the density of the unknown liquid', accepted: rng.int(101, 199), places: 2, unit: 'g/mL' },
  ])
  const measured = target.accepted + (target.places === 2 ? rng.int(5, 60) : rng.int(3, 30))
  const m = fromInteger(measured, target.places)
  const a = fromInteger(target.accepted, target.places)
  const { what, unit } = target
  return mixed(
    [{ quantities: [q(m, unit, 'measured value'), q(a, unit, 'accepted value')], ops: ['-'] }, q(a, unit, 'accepted value'), q('100', '%', 'per cent', { note: 'defined: per cent means per 100' })],
    ['/', '*'],
    '%',
    `A student measures ${what} as ${m} ${unit}; the accepted value is ${a} ${unit}. What is the percent error, (measured − accepted) ÷ accepted × 100?`,
    'percent-error',
    [R('mixed'), R('exact'), R('addsub')],
    {
      nudge: 'The difference on top is a subtraction, so its figures come from its place. That usually leaves only one or two figures, and the per-cent factor is exact by definition, so the difference is what limits the answer.',
      accept: (ev) => ev.intermediates.length === 1 && ev.intermediates[0]!.sigFigs <= 2 && exposes(ev, 'sf_exact_limited'),
    },
  )
}

/** m × 4.184 × (T2 − T1): the temperature change limits. */
function drawCalorimetry(rng: Rng): SigFigDraft {
  const mass = measurement(rng, 3, 2, rng.chance(0.4))
  const t1 = rng.int(180, 250) // tenths of a degree
  const t2 = t1 + rng.int(15, 130)
  const t1Text = fromInteger(t1, 1)
  const t2Text = fromInteger(t2, 1)
  return mixed(
    [q(mass, 'g', 'mass of water'), q('4.184', 'J/(g·°C)', 'specific heat of water'), { quantities: [q(t2Text, '°C', 'final temperature'), q(t1Text, '°C', 'starting temperature')], ops: ['-'] }],
    ['*', '*'],
    'J',
    `${mass} g of water warms from ${t1Text} °C to ${t2Text} °C. The heat absorbed is mass × 4.184 J/(g·°C) × (final − starting temperature). How much heat did the water absorb?`,
    'calorimetry',
    [R('mixed'), R('addsub'), R('muldiv')],
    {
      nudge: 'Find the temperature change first and count ITS figures: two readings to the tenths give a difference good to the tenths. That count is usually the smallest in the problem, so it sets the answer.',
    },
  )
}

/** ρ × V + m_container: outer + with a product inside. */
function drawProductPlusMass(rng: Rng): SigFigDraft {
  const density = fromInteger(rng.int(80, 199), 2)
  const volume = measurement(rng, 3, 2, rng.chance(0.4))
  const beaker = fromInteger(rng.int(4000, 9999), 2)
  return mixed(
    [{ quantities: [q(density, 'g/mL', 'density of the solution'), q(volume, 'mL', 'volume of solution')], ops: ['*'] }, q(beaker, 'g', 'mass of the empty beaker')],
    ['+'],
    'g',
    `An empty beaker has a mass of ${beaker} g. ${volume} mL of a solution with density ${density} g/mL is poured in. What is the total mass of the beaker and solution?`,
    'product-plus-mass',
    [R('mixed'), R('muldiv'), R('addsub')],
    {
      nudge: 'Multiply first and decide how many figures the product deserves: that tells you its last good place. Then add, and stop at the coarser of that place and the beaker mass. Round only at the end.',
    },
  )
}

/** Any of the calculation scenarios, kept only when rounding the intermediate early would change the answer. */
function drawRoundedEarly(rng: Rng): SigFigDraft {
  const inner = rng.pick([
    () => drawDensityByDifference(rng, false),
    () => drawCalorimetry(rng),
    () => drawProductPlusMass(rng),
  ])()
  return {
    ...inner,
    trap: 'rounded-early',
    nudge: EARLY_NUDGE,
    ruleCards: [R('mixed'), ...inner.ruleCards.filter((c) => c !== R('mixed'))],
    accept: (ev) => (inner.accept ? inner.accept(ev) : true) && exposes(ev, 'sf_rounded_early'),
  }
}

/** (d2 − d1) ÷ t with the distances in scientific notation. */
function drawScientific(rng: Rng): SigFigDraft {
  const p = rng.int(3, 4)
  const d1 = scientific(digitsOf(rng, rng.int(2, 3), { lastNonzero: rng.chance(0.5) }), p - 1)
  const d2 = scientific(digitsOf(rng, rng.int(2, 3), { lastNonzero: rng.chance(0.5) }), p)
  const t = measurement(rng, 3, 2)
  return mixed(
    [{ quantities: [q(d2, 'm', 'final position'), q(d1, 'm', 'starting position')], ops: ['-'] }, q(t, 's', 'time taken')],
    ['/'],
    'm/s',
    `A weather balloon rises from ${prettySigFig(d1)} m to ${prettySigFig(d2)} m in ${t} s. What is its average speed?`,
    'scientific-operands',
    [R('scientific'), R('mixed'), R('addsub')],
    {
      nudge: 'Write both heights with the same power of ten to see where each one stops. The difference is good to that place; count its figures, then divide and round to the fewest.',
    },
  )
}

export const MIXED_SCENARIOS: Scenario[] = [
  { id: 'density-by-difference', weight: 2, draw: (rng) => drawDensityByDifference(rng, false) },
  { id: 'subtraction-limits', weight: 2, draw: (rng) => drawDensityByDifference(rng, true) },
  { id: 'average-exact-count', weight: 2, draw: (rng) => drawAverage(rng) },
  { id: 'percent-error', weight: 2, draw: drawPercentError },
  { id: 'calorimetry', weight: 2, draw: drawCalorimetry },
  { id: 'product-plus-mass', weight: 2, draw: drawProductPlusMass },
  { id: 'rounded-early', weight: 3, draw: drawRoundedEarly },
  { id: 'scientific-operands', weight: 1, draw: drawScientific },
]

export function mixedScenarios(knobs: DifficultyKnobs): Scenario[] {
  if (knobs.exactNumbers === true && knobs.sciNotation === true) {
    return [{ id: 'scientific-average', weight: 1, draw: (rng) => drawAverage(rng, true) }]
  }
  if (knobs.exactNumbers === true) return MIXED_SCENARIOS.filter((s) => s.id === 'average-exact-count' || s.id === 'percent-error')
  if (knobs.sciNotation === true) return MIXED_SCENARIOS.filter((s) => s.id === 'scientific-operands')
  return MIXED_SCENARIOS
}

export const mixedTemplate = makeSigFigTemplate({
  id: 'sf.mixed',
  title: 'Mixed operations',
  description: 'Density by difference, averages, percent error, calorimetry: two rules in one problem, rounded once at the end.',
  version: 1,
  knobs: [EXACT_KNOB, SCI_KNOB],
  instructions: 'Do the whole calculation, carrying every digit through, and round once at the end to the correct number of significant figures.',
  entry: 'numeral',
  nudge: NUDGE,
  scenarios: mixedScenarios,
  fallback: {
    task: { kind: 'mixed', operands: [{ terms: [{ text: '25.26' }, { text: '15.11' }], ops: ['-'] }, { text: '8.2' }], ops: ['/'] },
    quantities: [q('25.26', 'g', 'flask with liquid'), q('15.11', 'g', 'empty flask'), q('8.2', 'mL', 'volume of liquid')],
    unit: 'g/mL',
    context: 'An empty flask has a mass of 15.11 g. With 8.2 mL of an unknown liquid in it, the mass is 25.26 g. What is the density of the liquid?',
    trap: 'density-by-difference',
    ruleCards: [R('mixed'), R('addsub'), R('muldiv')],
  },
})
