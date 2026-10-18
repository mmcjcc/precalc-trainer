/**
 * The reason bank for honors geometry Unit 2. She picks from this list; she never types a reason.
 * A named mistake is a specific wrong reason for the reason that was actually required.
 */
import type { ErrorPatternId } from '@/shared/types'

export const REASON_GROUPS = [
  { id: 'given', title: 'Given' },
  { id: 'equality', title: 'Properties of equality' },
  { id: 'congruence', title: 'Properties of congruence' },
  { id: 'definition', title: 'Definitions' },
  { id: 'postulate', title: 'Postulates' },
  { id: 'theorem', title: 'Theorems' },
] as const

export type ReasonGroupId = (typeof REASON_GROUPS)[number]['id']

export const REASONS = [
  { id: 'given', label: 'Given', group: 'given' },
  { id: 'eq-add', label: 'Addition property of equality', group: 'equality' },
  { id: 'eq-sub', label: 'Subtraction property of equality', group: 'equality' },
  { id: 'eq-mul', label: 'Multiplication property of equality', group: 'equality' },
  { id: 'eq-div', label: 'Division property of equality', group: 'equality' },
  { id: 'eq-subst', label: 'Substitution property of equality', group: 'equality' },
  { id: 'eq-dist', label: 'Distributive property', group: 'equality' },
  { id: 'eq-refl', label: 'Reflexive property of equality', group: 'equality' },
  { id: 'eq-sym', label: 'Symmetric property of equality', group: 'equality' },
  { id: 'eq-trans', label: 'Transitive property of equality', group: 'equality' },
  { id: 'cong-refl', label: 'Reflexive property of congruence', group: 'congruence' },
  { id: 'cong-sym', label: 'Symmetric property of congruence', group: 'congruence' },
  { id: 'cong-trans', label: 'Transitive property of congruence', group: 'congruence' },
  { id: 'def-midpoint', label: 'Definition of midpoint', group: 'definition' },
  { id: 'def-seg-bisector', label: 'Definition of a segment bisector', group: 'definition' },
  { id: 'def-ang-bisector', label: 'Definition of an angle bisector', group: 'definition' },
  { id: 'def-cong-seg', label: 'Definition of congruent segments', group: 'definition' },
  { id: 'def-cong-ang', label: 'Definition of congruent angles', group: 'definition' },
  { id: 'def-comp', label: 'Definition of complementary angles', group: 'definition' },
  { id: 'def-supp', label: 'Definition of supplementary angles', group: 'definition' },
  { id: 'def-right', label: 'Definition of a right angle', group: 'definition' },
  { id: 'def-perp', label: 'Definition of perpendicular lines', group: 'definition' },
  { id: 'post-seg-add', label: 'Segment addition postulate', group: 'postulate' },
  { id: 'post-ang-add', label: 'Angle addition postulate', group: 'postulate' },
  { id: 'post-linear-pair', label: 'Linear pair postulate', group: 'postulate' },
  { id: 'thm-vertical', label: 'Vertical angles theorem', group: 'theorem' },
  { id: 'thm-cong-supp', label: 'Congruent supplements theorem', group: 'theorem' },
  { id: 'thm-cong-comp', label: 'Congruent complements theorem', group: 'theorem' },
  { id: 'thm-right-cong', label: 'All right angles are congruent', group: 'theorem' },
  { id: 'def-right-triangle', label: 'Definition of a right triangle', group: 'definition' },
  { id: 'post-sss', label: 'SSS congruence postulate', group: 'postulate' },
  { id: 'post-sas', label: 'SAS congruence postulate', group: 'postulate' },
  { id: 'post-asa', label: 'ASA congruence postulate', group: 'postulate' },
  { id: 'post-aas', label: 'AAS congruence postulate', group: 'postulate' },
  { id: 'post-hl', label: 'HL postulate', group: 'postulate' },
  { id: 'thm-aas', label: 'AAS theorem', group: 'theorem' },
  { id: 'thm-hl', label: 'HL theorem', group: 'theorem' },
  { id: 'thm-cpctc', label: 'Corresponding parts of congruent triangles are congruent', group: 'theorem' },
  { id: 'thm-alt-int', label: 'Alternate interior angles theorem', group: 'theorem' },
] as const

export type ReasonId = (typeof REASONS)[number]['id']

const BY_ID = new Map<string, (typeof REASONS)[number]>(REASONS.map((reason) => [reason.id, reason]))

export function isReason(id: string): id is ReasonId {
  return BY_ID.has(id)
}

export function reasonLabel(id: string): string {
  return BY_ID.get(id)?.label ?? id
}

export function reasonsInGroup(group: ReasonGroupId): readonly (typeof REASONS)[number][] {
  return REASONS.filter((reason) => reason.group === group)
}

/**
 * The classic swaps. The first id is the reason the line actually needs; the second is the pick.
 * Anything not in this table is a plain wrong answer.
 */
const SWAPS: readonly { correct: ReasonId; picked: ReasonId; mistake: ErrorPatternId }[] = [
  { correct: 'post-seg-add', picked: 'def-midpoint', mistake: 'geo_midpoint_for_addition' },
  { correct: 'def-midpoint', picked: 'post-seg-add', mistake: 'geo_addition_for_midpoint' },
  { correct: 'def-midpoint', picked: 'def-cong-seg', mistake: 'geo_congruent_for_midpoint' },
  { correct: 'eq-trans', picked: 'eq-subst', mistake: 'geo_substitution_for_transitive' },
  { correct: 'cong-trans', picked: 'eq-subst', mistake: 'geo_substitution_for_transitive' },
  { correct: 'post-seg-add', picked: 'eq-add', mistake: 'geo_equality_for_postulate' },
  { correct: 'post-ang-add', picked: 'eq-add', mistake: 'geo_equality_for_postulate' },
  { correct: 'eq-sym', picked: 'eq-refl', mistake: 'geo_reflexive_for_symmetric' },
  { correct: 'cong-sym', picked: 'cong-refl', mistake: 'geo_reflexive_for_symmetric' },
  { correct: 'thm-vertical', picked: 'post-linear-pair', mistake: 'geo_linear_for_vertical' },
  { correct: 'post-linear-pair', picked: 'thm-vertical', mistake: 'geo_vertical_for_linear' },
  // Unit 4. A book that says "postulate" where another says "theorem" is listed on the row as
  // `accept`, not here. These are the picks that name a different fact.
  { correct: 'post-sss', picked: 'thm-hl', mistake: 'geo_hl_no_right' },
  { correct: 'post-sss', picked: 'post-hl', mistake: 'geo_hl_no_right' },
  { correct: 'post-sss', picked: 'thm-cpctc', mistake: 'geo_cpctc_too_soon' },
  { correct: 'post-sas', picked: 'thm-hl', mistake: 'geo_hl_no_right' },
  { correct: 'post-sas', picked: 'post-hl', mistake: 'geo_hl_no_right' },
  { correct: 'post-sas', picked: 'thm-cpctc', mistake: 'geo_cpctc_too_soon' },
  { correct: 'post-asa', picked: 'thm-aas', mistake: 'geo_asa_aas_swapped' },
  { correct: 'post-asa', picked: 'post-aas', mistake: 'geo_asa_aas_swapped' },
  { correct: 'post-asa', picked: 'thm-hl', mistake: 'geo_hl_no_right' },
  { correct: 'post-asa', picked: 'post-hl', mistake: 'geo_hl_no_right' },
  { correct: 'post-asa', picked: 'thm-cpctc', mistake: 'geo_cpctc_too_soon' },
  { correct: 'thm-aas', picked: 'post-asa', mistake: 'geo_asa_aas_swapped' },
  { correct: 'thm-aas', picked: 'thm-hl', mistake: 'geo_hl_no_right' },
  { correct: 'thm-aas', picked: 'post-hl', mistake: 'geo_hl_no_right' },
  { correct: 'thm-aas', picked: 'thm-cpctc', mistake: 'geo_cpctc_too_soon' },
  { correct: 'thm-hl', picked: 'post-sas', mistake: 'geo_sas_not_included' },
  { correct: 'thm-hl', picked: 'thm-cpctc', mistake: 'geo_cpctc_too_soon' },
  { correct: 'post-hl', picked: 'post-sas', mistake: 'geo_sas_not_included' },
  { correct: 'post-hl', picked: 'thm-cpctc', mistake: 'geo_cpctc_too_soon' },
  { correct: 'cong-refl', picked: 'given', mistake: 'geo_shared_side_missed' },
]

/** The named mistake for this pick, or null when the pick is merely wrong. */
export function reasonMistake(correct: string, picked: string): ErrorPatternId | null {
  const hit = SWAPS.find((swap) => swap.correct === correct && swap.picked === picked)
  return hit?.mistake ?? null
}

/** Every classic swap that applies when `correct` is the reason the line needs. */
export function swapsFor(correct: string): readonly { picked: ReasonId; mistake: ErrorPatternId }[] {
  return SWAPS.filter((swap) => swap.correct === correct).map((swap) => ({ picked: swap.picked, mistake: swap.mistake }))
}

/**
 * A sentence about the reason she picked. It names her pick and not the button that would have been right.
 */
export function reasonWitness(mistake: ErrorPatternId, picked: string): string {
  const name = reasonLabel(picked)
  switch (mistake) {
    case 'geo_midpoint_for_addition':
      return `${name} says the two pieces are the same length. This line adds the pieces to get the whole segment, and the pieces are not marked congruent.`
    case 'geo_addition_for_midpoint':
      return `${name} adds two pieces to make the whole segment. This line only says the two pieces match, because of a midpoint.`
    case 'geo_congruent_for_midpoint':
      return `${name} tells you that equal lengths are congruent segments. This line is where the equal lengths come from: the point is a midpoint.`
    case 'geo_substitution_for_transitive':
      return `${name} replaces one expression with another inside a line you already have. This line chains two equalities that share a middle quantity: if a equals b and b equals c, then a equals c.`
    case 'geo_equality_for_postulate':
      return `${name} adds the same quantity to both sides of an equation you already have. This line is about a point on a segment, or a ray inside an angle, and the whole is the sum of the pieces.`
    case 'geo_reflexive_for_symmetric':
      return `${name} says a quantity equals itself. This line swaps the two sides of an equality that was already written.`
    case 'geo_linear_for_vertical':
      return `${name} is about two angles that form a straight line. These two angles are the opposite pair made by two crossing lines.`
    case 'geo_vertical_for_linear':
      return `${name} is about the opposite angles made by two crossing lines. These two angles sit next to each other and form a straight line.`
    case 'geo_hl_no_right':
      return 'That reason needs a right angle in each triangle and the side opposite it. These triangles do not have a right angle.'
    case 'geo_cpctc_too_soon':
      return 'That reason is about corresponding parts of triangles that are already congruent. This row is still proving the triangles congruent. The parts come on a later row.'
    case 'geo_asa_aas_swapped':
      return 'That reason puts the side on the wrong side of the two angles. Check whether the side sits between the angles or not.'
    case 'geo_sas_not_included':
      return 'That reason needs the included angle, the one between the two sides. The angle here is not between them.'
    case 'geo_shared_side_missed':
      return 'That reason treats the side as one of the facts at the start. A side in both triangles is congruent to itself, and that still has to be written.'
    case 'geo_vertical_angles_missed':
      return 'The two lines cross, so the opposite angles are congruent. That pair still counts toward proving the triangles congruent.'
    default:
      return `${name} does not justify this line.`
  }
}
