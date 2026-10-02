/**
 * Public types of the electron-configuration core (chemistry, CK-12 ch. 5: aufbau, Pauli, Hund, orbital
 * diagrams, configurations, noble-gas shorthand, valence electrons, ions). Kept local to this folder: the
 * mistake kinds are a local union, not ErrorPatternIds (the content stage registers ids and catalog wording
 * and maps these kinds onto them).
 */
import type { ParseError } from '@/shared/types'

// ---------------------------------------------------------------------------
// Subshells, configurations, species
// ---------------------------------------------------------------------------

export type SubshellLetter = 's' | 'p' | 'd' | 'f'

/** A subshell: shell number n and letter, e.g. { n: 3, l: 'd' } for 3d. */
export interface Subshell {
  n: number
  l: SubshellLetter
}

/** A subshell with its electrons: 3d6 is { n: 3, l: 'd', count: 6 }. */
export interface SubshellCount extends Subshell {
  count: number
}

/** Occupied subshells only (no zero counts), in FILLING order unless a function says otherwise. */
export type ElectronConfiguration = readonly SubshellCount[]

/** A neutral atom (charge 0) or a monatomic ion. Fe3+ is { z: 26, charge: 3 }; Cl- is { z: 17, charge: -1 }. */
export interface EconfigSpecies {
  z: number
  charge: number
}

/**
 * A species as templates give it: text ("Fe", "Fe3+", "Cl-", "O 2-"), or an object with the atomic number or
 * the symbol. The charge defaults to 0.
 */
export type EconfigSpeciesLike = string | { z: number; charge?: number } | { symbol: string; charge?: number }

/** A subshell as templates give it: "3d" or { n: 3, l: 'd' }. */
export type SubshellLike = string | Subshell

/** 'full' is 1s2 2s2 2p6 3s1; 'shorthand' is [Ne] 3s1. */
export type EconfigForm = 'full' | 'shorthand'

/** 'filling' is 4s2 3d6 (the order the subshells fill); 'shell' is 3d6 4s2 (by shell number). */
export type EconfigOrder = 'filling' | 'shell'

export interface EconfigRenderOptions {
  form?: EconfigForm
  order?: EconfigOrder
}

/** A noble gas used as a shorthand core. */
export interface NobleGasCore {
  symbol: string
  z: number
}

/** The shorthand of a species: the core (null when no noble gas comes before it) and what follows it. */
export interface NobleGasShorthand {
  core: NobleGasCore | null
  rest: ElectronConfiguration
}

// ---------------------------------------------------------------------------
// What she types
// ---------------------------------------------------------------------------

/** One subshell of her answer with where it sits in the text she typed. */
export interface ParsedTerm extends SubshellCount {
  position: number
  length: number
}

/** The bracketed symbol at the start of a shorthand answer. Any element parses; the graders judge it. */
export interface ParsedCore {
  symbol: string
  z: number
  /** True for a group-18 element. */
  nobleGas: boolean
  position: number
  length: number
}

export interface ParsedConfiguration {
  core: ParsedCore | null
  /** In the order she typed them. A subshell appears at most once (a repeat is a parse error). */
  terms: ParsedTerm[]
}

export type ConfigurationParse = { ok: true; value: ParsedConfiguration } | { ok: false; error: ParseError }

/** Her answer to "which element (or ion) is this?": a symbol or a name, with an optional charge. */
export interface SpeciesAnswer {
  z: number
  symbol: string
  /** The charge she wrote, or null when she wrote none. */
  charge: number | null
  /** True when she typed the element's name instead of its symbol. */
  byName: boolean
}

export type SpeciesAnswerParse = { ok: true; value: SpeciesAnswer } | { ok: false; error: ParseError }

// ---------------------------------------------------------------------------
// Orbital diagrams
// ---------------------------------------------------------------------------

export type Spin = 'up' | 'down'

/**
 * One orbital (one box): the arrows in it, in the order they were put in. [] is an empty box, ['up'] a single
 * electron, ['up', 'down'] a pair. A box may hold a WRONG state (['up', 'up'], three arrows) so the graders can
 * name the Pauli mistake; a UI that lets her tap arrows into a box should allow those states.
 */
export type OrbitalBox = readonly Spin[]

/** The boxes of one subshell, left to right: 1 box for s, 3 for p, 5 for d. */
export type OrbitalDiagram = readonly OrbitalBox[]

export type OrbitalDiagramParse = { ok: true; value: OrbitalBox[] } | { ok: false; error: ParseError }

/** The right diagram of one subshell of a species. */
export interface OrbitalDiagramInfo {
  subshell: Subshell
  /** "3d" */
  name: string
  /** Electrons in this subshell (0 when the species has none there). */
  electrons: number
  /** Number of boxes: 1, 3 or 5. */
  orbitals: number
  /** Hund's-rule filling: one up arrow per box left to right, then the down arrows left to right. */
  boxes: OrbitalBox[]
  /** Electrons alone in a box. */
  unpaired: number
  /** Compact text the diagram parser reads back: "ud u u u u". */
  text: string
}

// ---------------------------------------------------------------------------
// Mistakes and grades
// ---------------------------------------------------------------------------

/** Every named mistake the electron-configuration graders can report. */
export type EconfigMistakeKind =
  // Configurations (atoms and ions)
  | 'electron_count'
  | 'subshell_overfilled'
  | 'subshell_nonexistent'
  | 'filling_order'
  | 'exception_missed'
  | 'exception_misapplied'
  // Ions
  | 'ion_charge_ignored'
  | 'ion_wrong_direction'
  | 'ion_removed_from_3d'
  | 'ion_wrong_number'
  // Noble-gas shorthand
  | 'core_wrong'
  | 'core_not_earlier'
  // Valence electrons
  | 'valence_total_electrons'
  | 'valence_last_subshell'
  // Orbital diagrams and unpaired electrons
  | 'hund_broken'
  | 'pauli_broken'
  | 'unpaired_from_wrong_diagram'

export const ECONFIG_MISTAKE_KINDS: readonly EconfigMistakeKind[] = [
  'electron_count',
  'subshell_overfilled',
  'subshell_nonexistent',
  'filling_order',
  'exception_missed',
  'exception_misapplied',
  'ion_charge_ignored',
  'ion_wrong_direction',
  'ion_removed_from_3d',
  'ion_wrong_number',
  'core_wrong',
  'core_not_earlier',
  'valence_total_electrons',
  'valence_last_subshell',
  'hund_broken',
  'pauli_broken',
  'unpaired_from_wrong_diagram',
]

/**
 * A grader's verdict (the same shape as the transformations core's TransformGrade).
 *  - correct:     her answer is right; `message` is a short confirmation.
 *  - mistake:     wrong, and a named mistake; `witness` is a sentence about HER answer.
 *  - wrong:       wrong, no named mistake fits; `message` is a plain, specific sentence.
 *  - invalid:     her answer could not be read, or is in the wrong form (not an attempt);
 *                 `position`/`length` point into what she typed when there is a place to point at.
 *  - unsupported: the PROBLEM is outside the model (a template bug, never her fault).
 */
export type EconfigGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'mistake'; mistake: EconfigMistakeKind; witness: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string; position?: number; length?: number }
  | { verdict: 'unsupported'; message: string }

/** What one configuration mistake gives for a species. `shadows`: other kinds giving the same text. */
export interface ConfigurationMistakeCandidate {
  kind: EconfigMistakeKind
  /** The wrong configuration as she would type it: "[Ar] 4s2 3d4" (app text, in the requested form). */
  text: string
  /** The sentence the grader returns for it. */
  witness: string
  shadows: EconfigMistakeKind[]
}

/** What one counting mistake gives (valence electrons, unpaired electrons). */
export interface CountMistakeCandidate {
  kind: EconfigMistakeKind
  value: number
  /** The number as she would type it. */
  text: string
  witness: string
  shadows: EconfigMistakeKind[]
}

/** What one orbital-diagram mistake gives. */
export interface DiagramMistakeCandidate {
  kind: EconfigMistakeKind
  boxes: OrbitalBox[]
  /** Compact text: "ud ud - - -". */
  text: string
  witness: string
  shadows: EconfigMistakeKind[]
}

/** The questions the core can grade; the validator takes one to say whether a species suits it. */
export type EconfigQuestion = 'full' | 'shorthand' | 'identify' | 'valence' | 'diagram' | 'unpaired'
