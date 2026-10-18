/**
 * Rule cards for honors geometry Unit 4. Examples use 11, 23, and 41.
 * No template generates those as an answer. The cards never use a choice's button text
 * (three-letter method names, or "not enough information") or a reason's button label.
 */
import type { RuleCard } from '@/content/types'
import type { GeoMistakeId } from './grade'

export const UNIT4_RULE_IDS = {
  correspondence: 'geo4-correspondence',
  methods: 'geo4-methods',
  parts: 'geo4-cpctc-parts',
  base: 'geo4-base-angles',
  equilateral: 'geo4-equilateral',
  shared: 'geo4-proof-shared',
  cpctc: 'geo4-proof-cpctc',
  defs: 'geo4-proof-defs',
} as const

export const UNIT4_RULE_FOR: Partial<Record<GeoMistakeId, string>> = {
  geo_ssa_as_congruence: UNIT4_RULE_IDS.methods,
  geo_aaa_as_congruence: UNIT4_RULE_IDS.methods,
  geo_sas_not_included: UNIT4_RULE_IDS.methods,
  geo_asa_aas_swapped: UNIT4_RULE_IDS.methods,
  geo_hl_no_right: UNIT4_RULE_IDS.methods,
  geo_vertices_out_of_order: UNIT4_RULE_IDS.correspondence,
  geo_cpctc_too_soon: UNIT4_RULE_IDS.cpctc,
  geo_shared_side_missed: UNIT4_RULE_IDS.shared,
  geo_base_angles_wrong_vertex: UNIT4_RULE_IDS.base,
  geo_equilateral_angle_for_side: UNIT4_RULE_IDS.equilateral,
}

export const CONGRUENCE_RULES: RuleCard[] = [
  {
    id: UNIT4_RULE_IDS.correspondence,
    title: 'The letters name the matching vertices',
    body: 'When two triangles match, the order of the letters is the matching. The first vertex of one names the first vertex of the other, and the same for the second and the third. A side or an angle matches the part made of the letters in those same places.',
    example: 'First vertex with the second vertex ✗ → first vertex with the first vertex',
  },
  {
    id: UNIT4_RULE_IDS.methods,
    title: 'What shows two triangles match',
    body: 'Two triangles match when three sides match, or two sides and the angle between them, or two angles and the side between them, or two angles and a side that is not between them, or the side opposite the right angle and one other side of a right triangle. Two sides with an angle that is not between them do not do it, and three angles do not do it.',
    example: 'three matching angles ✗ → two sides and the angle between them',
  },
  {
    id: UNIT4_RULE_IDS.parts,
    title: 'Matching parts are equal',
    body: 'Once two triangles match, a part of one equals the part of the other in the same place in the letter order. Set those two expressions equal, solve for x, then put x back into the part the question asks for.',
    example: 'x = 11 and the part is 2x + 19 → the part is 41',
  },
]

export const ISOSCELES_RULES: RuleCard[] = [
  {
    id: UNIT4_RULE_IDS.base,
    title: 'The matching angles sit across from the matching sides',
    body: 'If two sides of a triangle match, the angles across from those sides match. The converse is the same fact turned around: if two angles match, the sides across from them match. The angle between the matching sides is the third one.',
    example: 'x = 11 ✗ → x = 23',
  },
  {
    id: UNIT4_RULE_IDS.equilateral,
    title: 'Three matching sides',
    body: 'If all three sides match, all three angles match, and each angle is a straight angle split into three equal parts, which is 60. A side is still a length: put x into the side the question asks for. 60 is the angle, not the side.',
    example: '11 ✗ → 41',
  },
]

export const TRIANGLE_PROOF_RULES: RuleCard[] = [
  {
    id: UNIT4_RULE_IDS.methods,
    title: 'What shows two triangles match',
    body: 'Two triangles match when three sides match, or two sides and the angle between them, or two angles and the side between them, or two angles and a side that is not between them, or the side opposite the right angle and one other side of a right triangle. The reason names which of those the rows have already shown.',
    example: 'the side that is not between the angles, named as the side between them ✗ → the side between the two angles',
  },
  {
    id: UNIT4_RULE_IDS.correspondence,
    title: 'The letters name the matching vertices',
    body: 'The statement that the triangles match has to list the vertices in matching order. The first letter of one triangle names the first letter of the other. A shared vertex keeps its own letter in both places.',
    example: 'the second vertex named where the first one belongs ✗ → the first vertex with the first vertex',
  },
  {
    id: UNIT4_RULE_IDS.shared,
    title: 'A side, a crossing, or a pair of parallels',
    body: 'A side that lies in both triangles matches itself, and that row still has to be written. Two lines that cross make a pair of opposite angles that match. When two lines are parallel, a transversal makes a pair of angles between the lines on opposite sides of the transversal, and those angles match.',
    example: 'the shared side was a fact from the start ✗ → the side matches itself',
  },
  {
    id: UNIT4_RULE_IDS.cpctc,
    title: 'The parts come after the triangles',
    body: 'Matching parts of matching triangles is the row after the row that shows the triangles match. It cannot be the reason that the triangles match, because that row has not been written yet.',
    example: 'the parts, on the row that shows the triangles match ✗ → the parts, on the next row',
  },
  {
    id: UNIT4_RULE_IDS.defs,
    title: 'Midpoint, bisector, and perpendicular',
    body: 'A midpoint cuts a segment into two pieces that match. An angle bisector cuts an angle into two angles that match. Perpendicular lines meet at a right angle, and a triangle with a right angle is a right triangle. Each of those is its own row.',
    example: 'the two pieces added to the whole segment ✗ → the two pieces match because of the midpoint',
  },
]
