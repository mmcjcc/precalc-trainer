/**
 * Rule cards for honors geometry Unit 4. Examples use 6, 11, 23, 24, 41, and 90.
 * No template generates those as an answer. Titles and bodies may name the methods;
 * the examples do not use a part's answer.
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
  geo_vertical_angles_missed: UNIT4_RULE_IDS.shared,
}

const METHODS_BODY =
  'The SSS Postulate, the SAS Postulate, the ASA Postulate, the AAS Theorem, and the HL Theorem each prove two triangles congruent. SSA and AAA do not prove congruence. SAS needs the included angle; SSA has the angle that is not between the sides. ASA needs the included side; AAS has a side that is not between the angles. HL needs a right angle, the hypotenuse, and one leg.'

export const CONGRUENCE_RULES: RuleCard[] = [
  {
    id: UNIT4_RULE_IDS.correspondence,
    title: 'The letters name the corresponding vertices',
    body: 'When two triangles are congruent, the order of the letters is the correspondence. The first vertex of one corresponds to the first vertex of the other, and the same for the second and the third. A side or an angle corresponds to the part made of the letters in those same places.',
    example: 'First vertex with the second vertex ✗ → first vertex with the first vertex',
  },
  {
    id: UNIT4_RULE_IDS.methods,
    title: 'SSS, SAS, ASA, AAS, and HL',
    body: METHODS_BODY,
    example: 'three pairs of angles ✗ → two sides and the included angle',
  },
  {
    id: UNIT4_RULE_IDS.parts,
    title: 'Corresponding parts are congruent',
    body: 'Once two triangles are congruent, a part of one equals the corresponding part of the other. Set those two expressions equal, solve for x, then put x back into the part the question asks for. CPCTC is that step.',
    example: 'x = 11 and the part is 6x + 24 → the part is 90',
  },
]

export const ISOSCELES_RULES: RuleCard[] = [
  {
    id: UNIT4_RULE_IDS.base,
    title: 'Base angles of an isosceles triangle',
    body: 'If two sides of a triangle are congruent, the angles opposite those sides are congruent. Those are the base angles. The vertex angle is the angle between the congruent sides. The converse says the same fact the other way: if two angles are congruent, the sides opposite them are congruent.',
    example: 'x = 11 ✗ → x = 23',
  },
  {
    id: UNIT4_RULE_IDS.equilateral,
    title: 'An equilateral triangle',
    body: 'If all three sides are congruent, the triangle is equilateral and all three angles are congruent. Each angle measures 60°. A side is still a length: put x into the side the question asks for. 60 is the angle, not the side.',
    example: '11 ✗ → 41',
  },
]

export const TRIANGLE_PROOF_RULES: RuleCard[] = [
  {
    id: UNIT4_RULE_IDS.methods,
    title: 'SSS, SAS, ASA, AAS, and HL',
    body: `${METHODS_BODY} The reason names which of those the rows have already shown.`,
    example: 'the side that is not between the angles, named as the included side ✗ → the included side',
  },
  {
    id: UNIT4_RULE_IDS.correspondence,
    title: 'The letters name the corresponding vertices',
    body: 'The statement that the triangles are congruent lists the vertices in corresponding order. The first letter of one triangle corresponds to the first letter of the other. A shared vertex keeps its own letter in both places.',
    example: 'the second vertex named where the first one belongs ✗ → the first vertex with the first vertex',
  },
  {
    id: UNIT4_RULE_IDS.shared,
    title: 'A shared side, vertical angles, or alternate interior angles',
    body: 'A side that lies in both triangles is congruent to itself, and that row still has to be written. Two lines that cross make vertical angles, and vertical angles are congruent. When two lines are parallel, a transversal makes alternate interior angles, and those angles are congruent.',
    example: 'the shared side treated as a starting fact ✗ → the side congruent to itself',
  },
  {
    id: UNIT4_RULE_IDS.cpctc,
    title: 'CPCTC comes after the triangles',
    body: 'CPCTC, corresponding parts of congruent triangles are congruent, is the row after the row that proves the triangles congruent. It cannot be the reason that the triangles are congruent, because that row has not been written yet.',
    example: 'the parts, on the row that proves the triangles congruent ✗ → the parts, on the next row',
  },
  {
    id: UNIT4_RULE_IDS.defs,
    title: 'Midpoint, bisector, and perpendicular',
    body: 'A midpoint cuts a segment into two congruent segments. An angle bisector cuts an angle into two congruent angles. Perpendicular lines meet at a right angle, and a triangle with a right angle is a right triangle. Each of those is its own row.',
    example: 'the two pieces added to the whole segment ✗ → the two pieces congruent because of the midpoint',
  },
]
