/**
 * atom.notation — the counts are given; she writes the particle: element symbol, mass number,
 * atomic number and charge. Traps across seeds: the element picked by the ELECTRON count (11 p,
 * 10 e written as Ne), mass number = protons + electrons or the neutrons alone, the charge sign
 * flipped, and the letter case of the symbol. A strip of the periodic table around the proton and
 * electron counts is shown (so the trap element is right there, as on a real table). A draw is kept
 * only when each mistake gives an answer different from the right one.
 */
import type { Rng } from '@/content/rng'
import { particleCounts } from '@/engine'
import { elementByZ } from '@/engine/chem/elements'
import type { AtomParticle } from '@/shared/types'
import { makeAtomTemplate, periodicStrip, type AtomDraft, type AtomScenario } from './build'
import { ionCharges, ISOTOPE_POOL, type PoolIsotope } from './isotopes'
import { notableSentence } from './particles'
import { atRule } from './rules'

const R = atRule

const NUDGE =
  'Let the protons pick the element, and only the protons. Then build the mass number from what is in the nucleus, and the charge from protons compared with electrons.'

/** Every named mistake produces its own answer, different from the right one. */
export function notationTrapsVisible(p: AtomParticle): boolean {
  const { protons: pr, neutrons: n, electrons: e } = particleCounts(p)
  const A = p.massNumber
  const distinct = (xs: number[]) => new Set(xs).size === xs.length
  if (e < 1) return false
  if (!distinct([A, pr + e, n])) return false
  if (p.charge !== 0) {
    if (!elementByZ(e)) return false
    if (!distinct([pr, e, A])) return false
  }
  return true
}

function pickIsotope(rng: Rng, filter: (iso: PoolIsotope) => boolean): PoolIsotope {
  const usable = ISOTOPE_POOL.filter(filter)
  const symbols = [...new Set(usable.map((i) => i.symbol))]
  const symbol = rng.pick(symbols)
  return rng.pick(usable.filter((i) => i.symbol === symbol))
}

function draw(rng: Rng, sign: 1 | -1 | 0, trap: string, ruleCards: string[]): AtomDraft | null {
  const iso = pickIsotope(rng, (i) => (sign === 0 ? true : ionCharges(i.element, sign).length > 0))
  const charge = sign === 0 ? 0 : rng.pick(ionCharges(iso.element, sign))
  const particle: AtomParticle = { symbol: iso.symbol, z: iso.element.z, massNumber: iso.massNumber, charge }
  if (!notationTrapsVisible(particle)) return null
  const { protons, neutrons, electrons } = particleCounts(particle)
  const lo = Math.min(protons, electrons) - 1
  const hi = Math.max(protons, electrons) + 1
  return {
    question: { kind: 'notation', particle },
    prompt: `A particle has ${protons} protons, ${neutrons} neutrons and ${electrons} electrons. Write it as a nuclear symbol.`,
    context: notableSentence(iso),
    periodic: periodicStrip(lo, hi),
    unit: '',
    trap,
    nudge: NUDGE,
    ruleCards,
    params: { symbol: particle.symbol, massNumber: particle.massNumber, charge },
  }
}

export const NOTATION_SCENARIOS: AtomScenario[] = [
  { id: 'cation', weight: 3, draw: (rng) => draw(rng, 1, 'element-from-electrons', [R('protons'), R('electrons'), R('notation'), R('massNumber')]) },
  { id: 'anion', weight: 3, draw: (rng) => draw(rng, -1, 'negative-charge', [R('electrons'), R('protons'), R('notation'), R('massNumber')]) },
  { id: 'neutral', weight: 2, draw: (rng) => draw(rng, 0, 'mass-number-parts', [R('massNumber'), R('protons'), R('notation'), R('isotopes')]) },
]

export const notationTemplate = makeAtomTemplate({
  id: 'atom.notation',
  title: 'Write the symbol',
  description: 'From protons, neutrons and electrons to the nuclear symbol: element, mass number, atomic number and charge.',
  version: 1,
  instructions: 'Write the particle: its element symbol, mass number, atomic number and charge. Leave the charge blank for a neutral atom.',
  scenarios: NOTATION_SCENARIOS,
  fallback: {
    question: { kind: 'notation', particle: { symbol: 'Na', z: 11, massNumber: 23, charge: 1 } },
    prompt: 'A particle has 11 protons, 12 neutrons and 10 electrons. Write it as a nuclear symbol.',
    context: '',
    periodic: periodicStrip(9, 12),
    unit: '',
    trap: 'element-from-electrons',
    nudge: NUDGE,
    ruleCards: [R('protons'), R('electrons'), R('notation'), R('massNumber')],
  },
})
