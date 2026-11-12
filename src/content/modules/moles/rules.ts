/**
 * Rule cards for the mole (chemistry chapter 10), in our own words. Shown on hint rung 2 while she
 * can still answer, so no card may single out an answer: worked substances are Br₂, Ca(OH)₂ and
 * BaCl₂·2H₂O, which no chapter 10 template ever draws; a card that must name the particle kinds
 * names all three together (a complete listing singles out none); and the road map shows every
 * conversion and favours none.
 */
import type { RuleCard } from '@/content/types'
import type { ErrorPatternId } from '@/shared/types'
import { CF_CARD_SLIPS } from '../chemFormulas/rules'

/** The three counting units, as the choice buttons print them. */
export const PARTICLE_TEXT = {
  atoms: 'Atoms',
  molecules: 'Molecules',
  'formula units': 'Formula units',
} as const

/** The 22.4 L/mol choice, as the buttons print it. */
export const STP_TEXT = {
  yes: 'Yes — it is a gas at STP',
  notGas: 'No — it is not a gas',
  notStp: 'No — the gas is not at STP',
} as const

export const MO_RULES: readonly RuleCard[] = [
  {
    id: 'mo.counting',
    title: 'A mole is a count',
    body: 'A mole counts particles the way a dozen counts eggs, only on a scale big enough for atoms: one mole of anything is 6.022 × 10²³ of its particles — Avogadro’s number. Moles to particles: multiply by that number. Particles to moles: divide by it. To count one element inside a compound, take one more step: every particle carries as many of that element as its subscript says.',
    example: 'Br₂: each particle is a pair, so one mole of Br₂ carries two moles of Br',
  },
  {
    id: 'mo.particle',
    title: 'Name the particle before you count it',
    body: 'Each kind of substance has its own counting unit. A lone element, such as a metal or a noble gas, is counted in Atoms. The seven elements that pair up (hydrogen, nitrogen, oxygen, fluorine, chlorine, bromine and iodine) and every molecular compound are counted in Molecules. An ionic compound, hydrates included, has no separate molecules, so it is counted in Formula units: one smallest repeating ratio of its ions.',
    example: 'Ca(OH)₂ is ionic and Br₂ is a paired-up element, so they are counted in different units',
  },
  {
    id: 'mo.molarMass',
    title: 'Molar mass: add up the whole formula',
    body: 'The molar mass is the mass of one mole, in grams per mole: add the atomic mass of every atom in the formula. Use each atomic mass rounded to the hundredths place, as the problem lists them (hydrogen 1.01, carbon 12.01, oxygen 16.00). A subscript multiplies the atom just before it; a subscript after parentheses multiplies everything inside them; the seven paired-up elements weigh double, since each of their particles is a pair; and the waters after a hydrate’s dot count too, each one a whole H₂O.',
    example: 'Ca(OH)₂ = 40.08 + 2 × (16.00 + 1.01) = 74.10 g/mol',
  },
  {
    id: 'mo.roadMap',
    title: 'The mole road map',
    body: 'Moles sit in the middle of every trip. Grams and moles: divide grams by the molar mass, or multiply moles by it. Particles and moles: divide a count by 6.022 × 10²³, or multiply moles by it. Liters of gas and moles: divide liters by 22.4 L/mol, or multiply moles by it — and that number belongs only to a gas at STP (0 °C and 1 atm). Grams to particles, or liters to grams, is two legs: first to moles, then out the other side. The answer keeps the significant figures of the measurement.',
    example: 'Ca(OH)₂: grams ÷ 74.10 g/mol gives moles, and moles × 6.022 × 10²³ gives the count',
  },
]

/** The slips each moles card answers (the card shown first when she makes one). */
export const MO_CARD_SLIPS: Record<string, readonly ErrorPatternId[]> = {
  'mo.counting': ['mo_avogadro_inverted', 'mo_molecules_for_atoms'],
  'mo.particle': ['mo_particle_kind'],
  'mo.molarMass': ['mo_atomic_mass_for_molar', 'mo_subscripts_ignored', 'mo_paren_first_only', 'mo_diatomic_single'],
  'mo.roadMap': ['mo_stopped_at_moles', 'mo_molar_mass_inverted', 'mo_molar_volume_inverted', 'mo_stp_misapplied'],
}

/** Slip → the card that answers it, built from each card's own list (both chapter 10 modules). */
export const MO_RULE_FOR: Partial<Record<ErrorPatternId, string>> = Object.fromEntries(
  Object.entries({ ...MO_CARD_SLIPS, ...CF_CARD_SLIPS }).flatMap(([card, ids]) => ids.map((id) => [id, card])),
)
