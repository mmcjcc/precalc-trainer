/**
 * Chapter 10, the mole: four templates. Which substance, which direction, every measurement and
 * its significant figures, the wording, and which element is asked about all come from
 * makeRng(mixSeed(seed, k)); nothing is read from a table of problems.
 */
import type { Rng } from '@/content/rng'
import { measurement, digitsOf, scientific } from '@/content/modules/sigFigs/numbers'
import { countSigFigs } from '@/engine'
import { makeMoleTemplate, prettyNumber, type BuiltStage, type Drawn } from './build'
import {
  capName,
  countsOf,
  DRAWABLE,
  elementName,
  massList,
  molarMassText,
  particleKindOf,
  show,
  symbolsOf,
  atomicMassText,
  anhydrousCounts,
  hundredthsText,
  WATER_HUNDREDTHS,
  type MoSubstance,
} from './facts'
import { PARTICLE_TEXT, STP_TEXT } from './rules'

export const AVOGADRO_SHOWN = '6.022 × 10²³'

const byKind = (...kinds: MoSubstance['kind'][]) => DRAWABLE.filter((s) => kinds.includes(s.kind))

export const POOLS = {
  element: byKind('element'),
  cluster: byKind('diatomic', 'molecular'),
  ionic: byKind('ionic', 'hydrate'),
  diatomic: byKind('diatomic'),
  molecular: byKind('molecular'),
  salt: byKind('ionic'),
  hydrate: byKind('hydrate'),
  /** Gases at STP. */
  gas: DRAWABLE.filter((s) => s.state === 'gas'),
  /** A liquid or a solid at 0 °C and 1 atm (benzene's state there surprises people, so it stays out). */
  condensed: DRAWABLE.filter((s) => s.state !== 'gas' && s.key !== 'C6H6'),
}

// ---------------------------------------------------------------------------
// Measurements, born as text
// ---------------------------------------------------------------------------

export function molesGiven(rng: Rng, figs: number): string {
  return measurement(rng, figs, rng.pick([0, 1, 1, 2]))
}

export function massGiven(rng: Rng, figs: number): string {
  return measurement(rng, figs, rng.pick([1, 2, 2, 3]))
}

export function countGiven(rng: Rng, figs: number, lo: number, hi: number): string {
  return scientific(digitsOf(rng, figs), rng.int(lo, hi))
}

export function volumeGiven(rng: Rng): string {
  return measurement(rng, 3, rng.pick([1, 2]))
}

function figsFor(rng: Rng, s: MoSubstance): number {
  const want = rng.chance(0.5) ? 3 : 4
  return Math.min(want, countSigFigs(molarMassText(s)))
}

const pretty = prettyNumber

function particleWord(s: MoSubstance): string {
  return particleKindOf(s)
}

function capParticle(s: MoSubstance): string {
  return capName(particleKindOf(s))
}

function termsOf(counts: readonly { symbol: string; n: number }[]): string {
  return counts.map((c) => (c.n > 1 ? `${c.n} × ${atomicMassText(c.symbol)}` : atomicMassText(c.symbol))).join(' + ')
}

/** '2 × 1.01 + 16.00'; a hydrate as its salt plus its waters: '63.55 + 32.06 + 4 × 16.00 + 5 × 18.02'. */
function sumExpression(s: MoSubstance): string {
  if (s.waters === 0) return termsOf(countsOf(s))
  return `${termsOf(anhydrousCounts(s))} + ${s.waters} × ${hundredthsText(WATER_HUNDREDTHS)}`
}

const HINT_SCI = 'Scientific notation is fine; keep the figures the measurements support.'
const HINT_FIGS = 'Keep the figures the measurements support.'
const HINT_MASS = 'In g/mol, to the hundredths place.'

// ---------------------------------------------------------------------------
// mo.particles — moles and particles
// ---------------------------------------------------------------------------

const PARTICLE_OPENERS: readonly ((s: MoSubstance) => string)[] = [
  (s) => `On the shelf: a jar of ${s.name}, ${show(s.key)}.`,
  (s) => `A lab tray holds ${s.name} (${show(s.key)}).`,
  (s) => `Your teacher hands out ${s.name}, ${show(s.key)}, in two vials.`,
  (s) => `Think about ${s.name}, ${show(s.key)}, one particle at a time.`,
  (s) => `Two samples of ${s.name} (${show(s.key)}) sit on the bench.`,
]

function drawParticles(rng: Rng): Drawn {
  const pool = rng.pick([POOLS.element, POOLS.cluster, POOLS.ionic])
  const s = rng.pick(pool)
  const opener = rng.int(0, PARTICLE_OPENERS.length - 1)
  const toParticles = rng.chance(0.5)
  const figs = rng.chance(0.5) ? 3 : 4
  const given = toParticles ? molesGiven(rng, figs) : countGiven(rng, figs, 21, 25)
  const multi = s.kind === 'element' ? [] : countsOf(s).filter((c) => c.n >= 2)
  const withAtoms = multi.length > 0 && rng.chance(0.75)
  const atom = multi.length > 0 ? rng.pick(multi).symbol : ''
  const fromMoles = rng.chance(0.5)
  const figs2 = rng.chance(0.5) ? 3 : 4
  const given2 = fromMoles ? molesGiven(rng, figs2) : countGiven(rng, figs2, 22, 25)
  const shown = show(s.key)
  const sample1 = toParticles ? `${pretty(given)} mol of ${shown}` : `${pretty(given)} representative particles of ${shown}`
  const sample2 = !withAtoms ? '' : fromMoles ? `${pretty(given2)} mol of ${shown}` : `${pretty(given2)} atoms of ${elementName(atom)}`
  const prompt = [
    PARTICLE_OPENERS[opener]!(s),
    `Sample 1 holds ${sample1}.`,
    withAtoms ? `Sample 2 holds ${sample2}.` : '',
    `One mole is ${AVOGADRO_SHOWN} particles. Name the counting unit first, then count.`,
  ]
    .filter(Boolean)
    .join(' ')
  const kindStage: BuiltStage = {
    kind: 'choice',
    label: `Counting unit for ${shown}`,
    hint: 'Choose one.',
    nudge: 'Ask what the substance is made of: a lone element, small bonded clusters, or a lattice of ions.',
    ruleCard: 'mo.particle',
    check: { kind: 'particle-kind', formula: s.key },
    choices: rng.shuffle(Object.values(PARTICLE_TEXT).map((text) => ({ id: text, text }))),
    reveal: (answer) => `${capName(s.name)} is counted in ${answer.toLowerCase()}.`,
  }
  const countStage: BuiltStage = toParticles
    ? {
        kind: 'number',
        label: `${capParticle(s)} in sample 1`,
        hint: HINT_SCI,
        nudge: 'One mole is Avogadro’s number of particles. Going from moles to a count, should the number get bigger or smaller?',
        ruleCard: 'mo.counting',
        unit: particleWord(s),
        check: { kind: 'convert', formula: s.key, from: 'mol', to: 'particles', given },
        reveal: (answer) => `${pretty(given)} mol × ${AVOGADRO_SHOWN} per mole = ${pretty(answer)} ${particleWord(s)}.`,
      }
    : {
        kind: 'number',
        label: 'Moles in sample 1',
        hint: HINT_FIGS,
        nudge: 'Avogadro’s number of particles makes one mole. Going from a count to moles, should the number get bigger or smaller?',
        ruleCard: 'mo.counting',
        unit: 'mol',
        check: { kind: 'convert', formula: s.key, from: 'particles', to: 'mol', given },
        reveal: (answer) => `${pretty(given)} ÷ ${AVOGADRO_SHOWN} per mole = ${pretty(answer)} mol.`,
      }
  const drafts = [kindStage, countStage]
  if (withAtoms) {
    const k = countsOf(s).find((c) => c.symbol === atom)!.n
    drafts.push(
      fromMoles
        ? {
            kind: 'number',
            label: `${atom} atoms in sample 2`,
            hint: HINT_SCI,
            nudge: `Count the particles first, then use the subscript: each one carries that many ${atom} atoms.`,
            ruleCard: 'mo.counting',
            unit: `${atom} atoms`,
            check: { kind: 'convert', formula: s.key, from: 'mol', to: 'atoms', given: given2, atom },
            reveal: (answer) => `${pretty(given2)} mol × ${AVOGADRO_SHOWN} × ${k} ${atom} per particle = ${pretty(answer)} ${atom} atoms.`,
          }
        : {
            kind: 'number',
            label: `Moles of ${shown} in sample 2`,
            hint: HINT_FIGS,
            nudge: `Each particle carries more than one ${atom} atom: undo the subscript, then undo Avogadro’s number.`,
            ruleCard: 'mo.counting',
            unit: 'mol',
            check: { kind: 'convert', formula: s.key, from: 'atoms', to: 'mol', given: given2, atom },
            reveal: (answer) => `${pretty(given2)} ${atom} atoms ÷ ${k} per particle ÷ ${AVOGADRO_SHOWN} = ${pretty(answer)} mol.`,
          },
    )
  }
  return {
    prompt,
    drafts,
    extraCards: ['mo.roadMap'],
    params: { formula: s.key, toParticles, withAtoms, atom: withAtoms ? atom : '', fromMoles: withAtoms ? fromMoles : false, opener },
  }
}

// ---------------------------------------------------------------------------
// mo.molarMass — two substances
// ---------------------------------------------------------------------------

const MASS_OPENERS: readonly string[] = [
  'Find the molar mass of each substance:',
  'A stockroom label needs two molar masses:',
  'Weigh one mole of each, on paper:',
  'Two bottles, two molar masses:',
  'Before any conversion, the molar masses of',
]

function molarMassNudge(s: MoSubstance): string {
  if (s.kind === 'diatomic') return 'Read the formula exactly as written: the subscript tells how many atoms ride in each particle.'
  if (s.kind === 'hydrate') return 'Weigh the salt, then every water after the dot, and add them.'
  if (s.pieces.some((p) => 'group' in p)) return 'Work the parentheses first: the subscript outside multiplies everything inside.'
  return 'Multiply each atomic mass by its subscript, then add them all.'
}

export function molarMassStage(s: MoSubstance): BuiltStage {
  return {
    kind: 'number',
    label: `Molar mass of ${show(s.key)}`,
    hint: HINT_MASS,
    nudge: molarMassNudge(s),
    ruleCard: s.kind === 'hydrate' ? 'cf.hydrate' : 'mo.molarMass',
    unit: 'g/mol',
    check: { kind: 'molar-mass', formula: s.key },
    reveal: (answer) => `${show(s.key)}: ${sumExpression(s)} = ${answer} g/mol.`,
  }
}

function drawMolarMass(rng: Rng): Drawn {
  const categories = [POOLS.diatomic, POOLS.molecular, POOLS.salt, POOLS.hydrate]
  const firstAt = rng.pick([0, 1, 1, 2, 2, 3])
  const secondAt = rng.intExcept(0, 3, [firstAt])
  const a = rng.pick(categories[firstAt]!)
  const b = rng.pick(categories[secondAt]!)
  const opener = rng.int(0, MASS_OPENERS.length - 1)
  const [first, second] = rng.chance(0.5) ? [a, b] : [b, a]
  const symbols = [...new Set([...symbolsOf(first), ...symbolsOf(second)])]
  const prompt = `${MASS_OPENERS[opener]} ${first.name} (${show(first.key)}) and ${second.name} (${show(second.key)}). Use atomic masses rounded to the hundredths: ${massList(symbols)}.`
  return {
    prompt,
    drafts: [molarMassStage(first), molarMassStage(second)],
    params: { first: first.key, second: second.key, opener },
  }
}

// ---------------------------------------------------------------------------
// mo.mass — grams, moles and particles
// ---------------------------------------------------------------------------

const MASS_SAMPLE_OPENERS: readonly ((s: MoSubstance) => string)[] = [
  (s) => `Two samples of ${s.name} (${show(s.key)}) come back from the balance.`,
  (s) => `A stockroom bottle of ${s.name}, ${show(s.key)}, gives two samples.`,
  (s) => `Two scoops of ${s.name} (${show(s.key)}) for the lab.`,
  (s) => `You measure out ${s.name}, ${show(s.key)}, twice.`,
]

function drawMass(rng: Rng): Drawn {
  const pool = rng.pick([POOLS.element, POOLS.diatomic, POOLS.molecular, POOLS.molecular, POOLS.salt, POOLS.hydrate])
  const s = rng.pick(pool)
  const opener = rng.int(0, MASS_SAMPLE_OPENERS.length - 1)
  const toMoles = rng.chance(0.5)
  const figs = figsFor(rng, s)
  const given1 = toMoles ? massGiven(rng, figs) : molesGiven(rng, figs)
  const toParticles = rng.chance(0.5)
  const figs2 = figsFor(rng, s)
  const given2 = toParticles ? massGiven(rng, figs2) : countGiven(rng, figs2, 21, 24)
  const M = molarMassText(s)
  const sample1 = toMoles ? `${pretty(given1)} g` : `${pretty(given1)} mol`
  const sample2 = toParticles ? `${pretty(given2)} g` : `${pretty(given2)} ${particleWord(s)}`
  const prompt = `${MASS_SAMPLE_OPENERS[opener]!(s)} Sample 1 is ${sample1}; sample 2 is ${sample2}. Use atomic masses rounded to the hundredths (${massList(symbolsOf(s))}) and ${AVOGADRO_SHOWN} particles per mole.`
  const b: BuiltStage = toMoles
    ? {
        kind: 'number',
        label: 'Moles in sample 1',
        hint: HINT_FIGS,
        nudge: 'Start from the molar mass: grams and moles trade through it. Decide whether it divides or multiplies.',
        ruleCard: 'mo.roadMap',
        unit: 'mol',
        check: { kind: 'convert', formula: s.key, from: 'g', to: 'mol', given: given1 },
        reveal: (answer) => `${pretty(given1)} g ÷ ${M} g/mol = ${pretty(answer)} mol.`,
      }
    : {
        kind: 'number',
        label: 'Mass of sample 1',
        hint: HINT_FIGS,
        nudge: 'Start from the molar mass: grams and moles trade through it. Decide whether it divides or multiplies.',
        ruleCard: 'mo.roadMap',
        unit: 'g',
        check: { kind: 'convert', formula: s.key, from: 'mol', to: 'g', given: given1 },
        reveal: (answer) => `${pretty(given1)} mol × ${M} g/mol = ${pretty(answer)} g.`,
      }
  const c: BuiltStage = toParticles
    ? {
        kind: 'number',
        label: `${capParticle(s)} in sample 2`,
        hint: HINT_SCI,
        nudge: 'Two legs: get to moles first, then out to the count the question asks for.',
        ruleCard: 'mo.roadMap',
        unit: particleWord(s),
        check: { kind: 'convert', formula: s.key, from: 'g', to: 'particles', given: given2 },
        reveal: (answer) => `${pretty(given2)} g ÷ ${M} g/mol × ${AVOGADRO_SHOWN} = ${pretty(answer)} ${particleWord(s)}.`,
      }
    : {
        kind: 'number',
        label: 'Mass of sample 2',
        hint: HINT_FIGS,
        nudge: 'Two legs: get to moles first, then out to the mass the question asks for.',
        ruleCard: 'mo.roadMap',
        unit: 'g',
        check: { kind: 'convert', formula: s.key, from: 'particles', to: 'g', given: given2 },
        reveal: (answer) => `${pretty(given2)} ÷ ${AVOGADRO_SHOWN} × ${M} g/mol = ${pretty(answer)} g.`,
      }
  return {
    prompt,
    drafts: [b, c],
    extraCards: ['mo.molarMass', 'mo.counting'],
    params: { formula: s.key, toMoles, toParticles, opener },
  }
}

// ---------------------------------------------------------------------------
// mo.gas — 22.4 L/mol, and when it may be used
// ---------------------------------------------------------------------------

const CONTAINERS = ['A sealed flask', 'A steel cylinder', 'A balloon', 'A glass bulb'] as const
const SOLID_CONTAINERS = ['A beaker', 'A dish', 'A sample jar'] as const
const STP_WORDS = ['0 °C and 1 atm', 'STP', '273 K and 1 atm'] as const
const OTHER_CONDITIONS = ['25 °C and 1 atm', '100 °C and 1 atm', '0 °C and 2.00 atm', '20 °C and 0.95 atm', '35 °C and 1 atm'] as const

function scenarioOf(rng: Rng): { s: MoSubstance; state: MoSubstance['state']; atStp: boolean; text: string } {
  const roll = rng.next()
  if (roll < 0.4) {
    const s = rng.pick(POOLS.gas)
    return { s, state: 'gas', atStp: true, text: `${rng.pick(CONTAINERS)} holds ${s.name} gas (${show(s.key)}) at ${rng.pick(STP_WORDS)}.` }
  }
  if (roll < 0.7) {
    const s = rng.pick(POOLS.condensed)
    return { s, state: s.state, atStp: true, text: `${rng.pick(SOLID_CONTAINERS)} holds ${s.state} ${s.name} (${show(s.key)}) at 0 °C and 1 atm.` }
  }
  const s = rng.pick(POOLS.gas)
  return { s, state: 'gas', atStp: false, text: `${rng.pick(CONTAINERS)} holds ${s.name} gas (${show(s.key)}) at ${rng.pick(OTHER_CONDITIONS)}.` }
}

function drawGas(rng: Rng): Drawn {
  const scene = scenarioOf(rng)
  const g = rng.pick(POOLS.gas)
  const toMoles = rng.chance(0.5)
  const given1 = toMoles ? volumeGiven(rng) : measurement(rng, 3, rng.pick([0, 1]))
  const toMass = rng.chance(0.5)
  const given2 = toMass ? volumeGiven(rng) : massGiven(rng, 3)
  const shown = show(g.key)
  const M = molarMassText(g)
  const sample1 = toMoles ? `${pretty(given1)} L` : `${pretty(given1)} mol`
  const sample2 = toMass ? `${pretty(given2)} L` : `${pretty(given2)} g`
  const prompt = `First, a judgment: ${scene.text} Then two samples of ${g.name} gas (${shown}) at STP — sample 1 is ${sample1}, sample 2 is ${sample2}. At STP one mole of any gas fills 22.4 L; use atomic masses rounded to the hundredths (${massList(symbolsOf(g))}).`
  const a: BuiltStage = {
    kind: 'choice',
    label: 'May 22.4 L/mol be used for that first sample?',
    hint: 'Choose one.',
    nudge: 'Two things must both be true for that shortcut. Check the state of the sample, then its conditions.',
    ruleCard: 'mo.roadMap',
    check: { kind: 'stp-ok', formula: scene.s.key, state: scene.state, atStp: scene.atStp },
    choices: rng.shuffle(Object.values(STP_TEXT).map((text) => ({ id: text, text }))),
    reveal: (answer) => `${answer}.`,
  }
  const b: BuiltStage = toMoles
    ? {
        kind: 'number',
        label: 'Moles in sample 1',
        hint: HINT_FIGS,
        nudge: 'At STP every mole of gas takes the same room. Decide whether that volume per mole divides or multiplies.',
        ruleCard: 'mo.roadMap',
        unit: 'mol',
        check: { kind: 'convert', formula: g.key, from: 'L', to: 'mol', given: given1 },
        reveal: (answer) => `${pretty(given1)} L ÷ 22.4 L/mol = ${pretty(answer)} mol.`,
      }
    : {
        kind: 'number',
        label: 'Volume of sample 1',
        hint: HINT_FIGS,
        nudge: 'At STP every mole of gas takes the same room. Decide whether that volume per mole divides or multiplies.',
        ruleCard: 'mo.roadMap',
        unit: 'L',
        check: { kind: 'convert', formula: g.key, from: 'mol', to: 'L', given: given1 },
        reveal: (answer) => `${pretty(given1)} mol × 22.4 L/mol = ${pretty(answer)} L.`,
      }
  const c: BuiltStage = toMass
    ? {
        kind: 'number',
        label: 'Mass of sample 2',
        hint: HINT_FIGS,
        nudge: 'Two legs: liters to moles first, then moles to grams.',
        ruleCard: 'mo.roadMap',
        unit: 'g',
        check: { kind: 'convert', formula: g.key, from: 'L', to: 'g', given: given2 },
        reveal: (answer) => `${pretty(given2)} L ÷ 22.4 L/mol × ${M} g/mol = ${pretty(answer)} g.`,
      }
    : {
        kind: 'number',
        label: 'Volume of sample 2',
        hint: HINT_FIGS,
        nudge: 'Two legs: grams to moles first, then moles to liters.',
        ruleCard: 'mo.roadMap',
        unit: 'L',
        check: { kind: 'convert', formula: g.key, from: 'g', to: 'L', given: given2 },
        reveal: (answer) => `${pretty(given2)} g ÷ ${M} g/mol × 22.4 L/mol = ${pretty(answer)} L.`,
      }
  return {
    prompt,
    drafts: [a, b, c],
    extraCards: ['mo.molarMass'],
    params: { scene: scene.s.key, state: scene.state, atStp: scene.atStp, gas: g.key, toMoles, toMass },
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const particlesTemplate = makeMoleTemplate(
  'moles',
  'mo.particles',
  'particles',
  'Moles and particles',
  'Name the counting unit (atoms, molecules or formula units), then convert between moles and particles with Avogadro’s number — and count the atoms of one element in a compound.',
  'Answer each part. Counts may be in scientific notation; keep the figures the measurements support.',
  121,
  drawParticles,
)

export const molarMassTemplate = makeMoleTemplate(
  'moles',
  'mo.molarMass',
  'molarMass',
  'Molar mass from a formula',
  'Add up a formula to the hundredths: subscripts, parentheses, the diatomic elements and hydrates.',
  'Give each molar mass in g/mol to the hundredths place.',
  122,
  drawMolarMass,
)

export const massTemplate = makeMoleTemplate(
  'moles',
  'mo.mass',
  'mass',
  'Grams, moles and particles',
  'Grams to moles and back through the molar mass, then grams to particles and back in two steps through moles.',
  'Answer each part. Keep the figures the measurements support.',
  123,
  drawMass,
)

export const gasTemplate = makeMoleTemplate(
  'moles',
  'mo.gas',
  'gas',
  'Gas volume at STP',
  'When 22.4 L/mol may be used, then liters to moles and back, and liters to grams and back for a gas at STP.',
  'Answer each part. Keep the figures the measurements support.',
  124,
  drawGas,
)

export const MO_TEMPLATES: readonly TemplateLike[] = [particlesTemplate, molarMassTemplate, massTemplate, gasTemplate]

type TemplateLike = typeof particlesTemplate
