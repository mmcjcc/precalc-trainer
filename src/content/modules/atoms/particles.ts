/**
 * atom.particles — "How many protons, neutrons and electrons?" The particle is shown as a nuclear
 * symbol (KaTeX), in hyphen notation ("chlorine-37"), or as a named ion ("a sulfide ion, S²⁻, with
 * mass number 32"). Traps across seeds: neutrons typed as the mass number, protons read from the
 * mass number, electrons that ignore the charge or flip its sign, protons changed for an ion.
 * A draw is kept only when every one of those mistakes gives a number different from the right one
 * (and from each other), so each can be named when she makes it.
 */
import type { Rng } from '@/content/rng'
import { formulaText, hyphenName, nuclearSymbolLatex, particleCounts } from '@/engine'
import type { AtomParticle } from '@/shared/types'
import { makeAtomTemplate, periodicEntry, type AtomDraft, type AtomScenario } from './build'
import { ionCharges, ionName, ISOTOPE_POOL, type PoolIsotope } from './isotopes'
import { atRule } from './rules'

const INSTRUCTIONS = 'Count the protons, neutrons and electrons, and type each as a whole number.'

const NUDGE = {
  symbol: 'Start with the atomic number, the bottom number: it counts the protons. The mass number and the charge give you the other two.',
  hyphen: 'The number after the name is the mass number. The atomic number comes from the periodic table, and it counts the protons.',
  ion: 'Start with the protons: an ion has exactly as many as its neutral atom. Then the charge tells you whether electrons were gained or lost.',
} as const

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** A sentence about an isotope students meet by name (from NOTABLE_ISOTOPES), or ''. */
export function notableSentence(iso: PoolIsotope): string {
  const note = iso.note
  if (!note) return ''
  const who = capital(hyphenName({ z: iso.element.z, massNumber: iso.massNumber }))
  if (/^defines\b/.test(note)) return `${who} ${note}.`
  if (/^(used|deuterium|tritium)\b/.test(note)) return `${who} is ${note}.`
  if (/^most\b/.test(note)) return `${who} is the ${note}.`
  return `${who} is a ${note}.`
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a'
}

/** Every named mistake produces its own number, different from the right one. */
export function particleTrapsVisible(p: AtomParticle): boolean {
  const { protons: P, neutrons: N, electrons: E } = particleCounts(p)
  const A = p.massNumber
  const c = p.charge
  const distinct = (xs: number[]) => new Set(xs).size === xs.length
  if (!distinct([P, A]) || !distinct([N, A])) return false
  if (c !== 0) {
    if (!distinct([P, A, P - c, P + c])) return false
    if (!distinct([E, P, P + c]) || P + c < 0) return false
  }
  return true
}

/** Pick an element first (so heavy tables of isotopes do not crowd the others out), then one of its isotopes. */
function pickIsotope(rng: Rng, filter: (iso: PoolIsotope) => boolean): PoolIsotope {
  const usable = ISOTOPE_POOL.filter(filter)
  const symbols = [...new Set(usable.map((i) => i.symbol))]
  const symbol = rng.pick(symbols)
  return rng.pick(usable.filter((i) => i.symbol === symbol))
}

function draft(iso: PoolIsotope, charge: number, shown: 'symbol' | 'hyphen' | 'ion', trap: string, ruleCards: string[]): AtomDraft | null {
  const particle: AtomParticle = { symbol: iso.symbol, z: iso.element.z, massNumber: iso.massNumber, charge }
  if (!particleTrapsVisible(particle)) return null
  const hyphen = hyphenName(particle)
  let prompt: string
  if (shown === 'symbol') prompt = 'How many protons, neutrons and electrons are in this particle?'
  else if (shown === 'hyphen') prompt = `How many protons, neutrons and electrons are in an atom of ${hyphen}?`
  else {
    const name = ionName(iso.element, charge)
    prompt = `How many protons, neutrons and electrons are in ${article(name)} ${name}, ${formulaText(particle)}, with mass number ${iso.massNumber}?`
  }
  const out: AtomDraft = {
    question: { kind: 'particles', particle, shown },
    prompt,
    context: notableSentence(iso),
    unit: '',
    trap,
    nudge: NUDGE[shown],
    ruleCards,
    params: { symbol: particle.symbol, massNumber: particle.massNumber, charge, shown },
  }
  if (shown === 'symbol') out.latex = nuclearSymbolLatex(particle)
  else out.periodic = [periodicEntry(particle.z)]
  return out
}

const R = atRule

function signedIon(rng: Rng, sign: 1 | -1 | 0, shown: 'symbol' | 'ion', trap: string): AtomDraft | null {
  const iso = pickIsotope(rng, (i) => ionCharges(i.element, sign).length > 0)
  const charge = rng.pick(ionCharges(iso.element, sign))
  return draft(iso, charge, shown, trap, [R('electrons'), R('protons'), R('neutrons'), R('notation')])
}

export const PARTICLE_SCENARIOS: AtomScenario[] = [
  {
    id: 'symbol-neutral',
    weight: 2,
    draw: (rng) => draft(pickIsotope(rng, () => true), 0, 'symbol', 'neutrons-from-mass-number', [R('neutrons'), R('protons'), R('massNumber'), R('notation'), R('isotopes')]),
  },
  { id: 'symbol-cation', weight: 2, draw: (rng) => signedIon(rng, 1, 'symbol', 'cation-electrons') },
  { id: 'symbol-anion', weight: 2, draw: (rng) => signedIon(rng, -1, 'symbol', 'anion-electrons') },
  {
    id: 'hyphen-atom',
    weight: 2,
    draw: (rng) => draft(pickIsotope(rng, () => true), 0, 'hyphen', 'hyphen-mass-number', [R('isotopes'), R('protons'), R('neutrons'), R('massNumber')]),
  },
  { id: 'named-ion', weight: 2, draw: (rng) => signedIon(rng, 0, 'ion', 'named-ion') },
]

export const particlesTemplate = makeAtomTemplate({
  id: 'atom.particles',
  title: 'Count the particles',
  description: 'Protons, neutrons and electrons from a nuclear symbol, a name like chlorine-37, or a named ion.',
  version: 1,
  instructions: INSTRUCTIONS,
  scenarios: PARTICLE_SCENARIOS,
  fallback: {
    question: { kind: 'particles', particle: { symbol: 'Cl', z: 17, massNumber: 37, charge: -1 }, shown: 'symbol' },
    prompt: 'How many protons, neutrons and electrons are in this particle?',
    context: '',
    latex: '{}^{37}_{17}\\mathrm{Cl}^{-}',
    unit: '',
    trap: 'anion-electrons',
    nudge: NUDGE.symbol,
    ruleCards: [R('electrons'), R('protons'), R('neutrons'), R('notation')],
  },
})
