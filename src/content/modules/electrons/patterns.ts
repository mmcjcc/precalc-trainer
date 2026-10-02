/**
 * EconfigMistakeKind → ErrorPatternId (`ec_`). The catalog holds the lesson and the wrong → right
 * example. The engine's witness is the sentence about her answer and is shown as-is.
 */
import { ECONFIG_MISTAKE_KINDS, patternHit } from '@/engine'
import type { EconfigMistakeKind } from '@/engine'
import type { ErrorPatternId, PatternHit } from '@/shared/types'

export const EC_PATTERN: Record<EconfigMistakeKind, ErrorPatternId> = {
  electron_count: 'ec_electron_count',
  subshell_overfilled: 'ec_subshell_overfilled',
  subshell_nonexistent: 'ec_subshell_nonexistent',
  filling_order: 'ec_filling_order',
  exception_missed: 'ec_exception_missed',
  exception_misapplied: 'ec_exception_misapplied',
  ion_charge_ignored: 'ec_ion_charge_ignored',
  ion_wrong_direction: 'ec_ion_wrong_direction',
  ion_removed_from_3d: 'ec_ion_removed_from_3d',
  ion_wrong_number: 'ec_ion_wrong_number',
  core_wrong: 'ec_core_wrong',
  core_not_earlier: 'ec_core_not_earlier',
  valence_total_electrons: 'ec_valence_total_electrons',
  valence_last_subshell: 'ec_valence_last_subshell',
  hund_broken: 'ec_hund_broken',
  pauli_broken: 'ec_pauli_broken',
  unpaired_from_wrong_diagram: 'ec_unpaired_from_wrong_diagram',
}

/** Every ec_ id, in engine order. */
export const EC_MISTAKE_IDS: readonly ErrorPatternId[] = ECONFIG_MISTAKE_KINDS.map((kind) => EC_PATTERN[kind])

/** The catalog lesson for a named configuration mistake, with her witness attached. */
export function ecPattern(kind: EconfigMistakeKind, witness?: string): PatternHit {
  return patternHit(EC_PATTERN[kind], witness)
}
