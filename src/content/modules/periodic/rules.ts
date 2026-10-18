/**
 * Rule cards for the periodic table. Shown on hint rung 2, while she can still answer, so the
 * body and the example never use a digit, a block letter, a family name, or a reason sentence
 * that a template can ask her to give.
 */
import type { RuleCard } from '@/content/types'
import type { PtWhyReason } from '@/content/types'
import type { ErrorPatternId } from '@/shared/types'

export const WHY_TEXT: Record<PtWhyReason, string> = {
  protons: 'More protons pull on the same shell',
  shells: 'There is another shell of electrons',
  shielding: 'Inner electrons block the nucleus',
}

export const PT_RULES: readonly RuleCard[] = [
  {
    id: 'pt.row',
    title: 'Count the rows from the top',
    body: 'The period is the row the element sits in, starting at the top of the table. It is not the count of electrons in the outer shell.',
    example: 'Rn sits in a later row ✗ → count the rows from the top',
  },
  {
    id: 'pt.column',
    title: 'Count the columns from the left',
    body: 'Use the long form of the table and count every column from the left, including the middle ten. The two rows set below the main table are not given a column number.',
    example: 'At sits just before the last column ✗ → count every column from the left',
  },
  {
    id: 'pt.block',
    title: 'The block is the last subshell',
    body: 'The block letter is the subshell that receives the last electron. The first two columns are one kind, the right-hand columns are another, the middle ten are another, and the two rows below the table are the last kind. Helium is grouped with the last column, but its electrons fill the first shell only, and that subshell is not the right-hand kind.',
    example: 'Rn is in the last column ✗ → the subshell that filled last decides the block',
  },
  {
    id: 'pt.class',
    title: 'Left, right, or the staircase',
    body: 'Most elements to the left of the staircase lose electrons. The ones that touch the staircase are the in-between group. Hydrogen sits in the first column but belongs with the elements on the right.',
    example: 'Fr loses electrons easily ✗ → it is not one of the in-between elements',
  },
  {
    id: 'pt.family',
    title: 'Match the column to its family',
    body: 'The first column, other than hydrogen, shares one family. The second column has the next. The column just before the last has its own, and the last column has its own. The ten middle columns share one more.',
    example: 'Ra is in the second column ✗ → not the first column under hydrogen',
  },
  {
    id: 'pt.valence',
    title: 'Only the outer shell counts',
    body: 'Valence electrons are the electrons in the outermost shell, not every electron in the atom and not the row number. On the right side of the table, take ten off the column number. Helium is a pair, not the count used for the later noble gases.',
    example: 'Rn place in the table used as the outer shell ✗ → count the outer shell only',
  },
  {
    id: 'pt.rank',
    title: 'Radius and ionization energy run opposite ways',
    body: 'Atomic radius and metallic character grow down a column and toward the left. First ionization energy and electronegativity grow up a column and toward the right. A diagonal counts only when both of those pulls agree.',
    example: 'Fr, Ra, At from the large end when the small end was asked ✗ → start at the end the question names',
  },
  {
    id: 'pt.size',
    title: 'Ions change size when electrons move',
    body: 'A positive ion has lost electrons, so the nucleus pulls a smaller cloud in more tightly than in the atom. A negative ion has gained electrons, and that extra repulsion spreads the cloud out past the atom.',
    example: 'Fr+ called the larger one ✗ → the neutral atom is larger',
  },
  {
    id: 'pt.iso',
    title: 'Same electrons, so compare protons',
    body: 'Ions in one isoelectronic series hold the same number of electrons. The ion with fewer protons holds that cloud less tightly, so it is larger. The electron count of the neutral atom is not the size order.',
    example: 'Fr+, Ra2+ and At− ordered by the neutral atoms ✗ → fewer protons means the larger ion',
  },
  {
    id: 'pt.why',
    title: 'Same row or a new row',
    body: 'Elements in one row share an outer shell. Across that row the nucleus pulls harder as you move right. Down a column there is a new shell, and the inner electrons stand between the nucleus and the outer electron.',
    example: 'Rn beside Xe in one row, explained by a new shell ✗ → the nucleus pulls harder on the shell they share',
  },
]

const RULE_INDEX = new Map(PT_RULES.map((card) => [card.id, card]))

export function ptRule(id: string): RuleCard {
  const card = RULE_INDEX.get(id)
  if (!card) throw new Error(`missing periodic rule card ${id}`)
  return card
}

/** Which card to put first when she hits this slip. */
export const PT_RULE_FOR: Partial<Record<ErrorPatternId, string>> = {
  pt_trend_reversed: 'pt.rank',
  pt_radius_like_ionization: 'pt.rank',
  pt_group_number_valence: 'pt.valence',
  pt_hydrogen_metal: 'pt.class',
  pt_helium_p_block: 'pt.block',
  pt_cation_larger: 'pt.size',
  pt_anion_smaller: 'pt.size',
  pt_isoelectronic_electron_count: 'pt.iso',
  pt_period_as_valence: 'pt.row',
  pt_f_as_d_block: 'pt.block',
  pt_helium_octet: 'pt.valence',
  pt_valence_is_atomic_number: 'pt.valence',
  pt_valence_is_period: 'pt.valence',
  pt_alkaline_called_alkali: 'pt.family',
  pt_alkali_called_alkaline: 'pt.family',
  pt_metalloid_called_metal: 'pt.class',
  pt_metal_called_metalloid: 'pt.class',
  pt_why_shells_across_period: 'pt.why',
  pt_why_shielding_same_shell: 'pt.why',
  pt_why_protons_down_group: 'pt.why',
}
