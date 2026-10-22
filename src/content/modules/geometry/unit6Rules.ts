/**
 * Rule cards for honors geometry Unit 6 (similarity, Jurgensen chapter 7), named the way Jurgensen names the theorems.
 * Examples use the letters J, K, L, M, N (and j, k, l, m for numbers), which no template uses, and only the numbers
 * no part can have as its answer (23, 41, 67, 90, 180); a body names every test or none, so it singles out no answer.
 */
import type { RuleCard } from '@/content/types'
import type { GeoMistakeId } from './grade'

export const UNIT6_RULE_IDS = {
  proportion: 'geo6-proportion',
  properties: 'geo6-properties',
  mean: 'geo6-mean',
  polygons: 'geo6-similar-polygons',
  scale: 'geo6-scale-factor',
  perimeter: 'geo6-perimeters',
  corrAngles: 'geo6-corresponding-angles',
  aa: 'geo6-aa',
  sss: 'geo6-sss',
  sas: 'geo6-sas',
  which: 'geo6-which',
  rightMean: 'geo6-right-mean',
  indirect: 'geo6-indirect',
  splitter: 'geo6-splitter',
  converse: 'geo6-splitter-converse',
  bisector: 'geo6-angle-bisector',
  parallels: 'geo6-parallels',
  /** Unit 4's id: geo_vertices_out_of_order opens this card in every unit. */
  statement: 'geo4-correspondence',
  /** Unit 4's id: geo_vertical_angles_missed opens this card in every unit. */
  freePairs: 'geo4-proof-shared',
  /** Unit 5's id: geo_midsegment_doubled opens this card in every unit. */
  midpoint: 'geo5-midsegment',
  /** Unit 1's id: geo_answered_x opens this card in every unit. */
  substitute: 'geo-substitute',
} as const

/**
 * The card a named mistake opens. A mistake two modules share (a proportion mixed or cross-multiplied wrong, a part
 * matched by position, a geometric mean slip) is left out, so it opens the card of the part it happened on.
 */
export const UNIT6_RULE_FOR: Partial<Record<GeoMistakeId, string>> = {
  geo_scale_factor_inverted: UNIT6_RULE_IDS.scale,
  geo_perimeter_ratio_squared: UNIT6_RULE_IDS.perimeter,
  geo_corresponding_supplementary: UNIT6_RULE_IDS.corrAngles,
  geo_angle_scaled: UNIT6_RULE_IDS.corrAngles,
  geo_ssa_as_similarity: UNIT6_RULE_IDS.which,
  geo_shared_angle_missed: UNIT6_RULE_IDS.which,
  geo_similarity_test_missed: UNIT6_RULE_IDS.which,
  geo_sss_two_pairs: UNIT6_RULE_IDS.which,
  geo_aa_one_angle: UNIT6_RULE_IDS.which,
  geo_shadows_crossed: UNIT6_RULE_IDS.indirect,
  geo_bisector_ratio_swapped: UNIT6_RULE_IDS.bisector,
}

const PROPORTION: RuleCard = {
  id: UNIT6_RULE_IDS.proportion,
  title: 'Solving a proportion',
  body: 'A proportion is an equation that says two ratios are equal. In a proportion the product of the means equals the product of the extremes: if j/k = l/m, then jm = kl. Cross-multiply (each numerator times the denominator on the other side), then solve the equation that gives. A number in front of parentheses multiplies every term inside.',
  example: 'j/k = l/m → j · m = k · l',
}

const SUBSTITUTE: RuleCard = {
  id: UNIT6_RULE_IDS.substitute,
  title: 'Substitute to find the measure',
  body: 'x is the number that makes the equation true. A length or an angle measure is what its expression equals after you put that number in. They are the same only by accident.',
  example: 'x = 23 and m∠J = (90 − x)° → m∠J = 67°',
}

export const RATIO_RULES: RuleCard[] = [
  PROPORTION,
  {
    id: UNIT6_RULE_IDS.properties,
    title: 'Properties of proportions',
    body: 'If j/k = l/m, each of these is true as well: jm = kl; j/l = k/m (the means trade places); k/j = m/l (both ratios turned over); (j + k)/k = (l + m)/m and (j − k)/k = (l − m)/m (the same number added to, or taken from, both sides). Turning only one ratio over, or multiplying each fraction’s own numerator and denominator, is not one of them.',
    example: 'j/k = l/m → k/j = m/l',
  },
  {
    id: UNIT6_RULE_IDS.mean,
    title: 'Geometric mean',
    body: 'The geometric mean of two positive numbers j and k is the positive number x with j/x = x/k. Cross-multiplying gives x² = jk, so x = √(jk), in simplest radical form when jk is not a perfect square. The average (j + k)/2 is the arithmetic mean, a different number.',
    example: 'j/x = x/k → x² = jk → x = √(jk)',
  },
  {
    id: UNIT6_RULE_IDS.polygons,
    title: 'Similar polygons',
    body: 'Two polygons are similar (~, read “is similar to”) when their corresponding angles are congruent and their corresponding sides are in proportion. The order of the letters in the similarity statement gives the correspondence: the first vertex goes with the first vertex, the second with the second, and so on, however the figures are turned or flipped.',
    example: 'the first two letters of each name → a pair of corresponding sides',
  },
  {
    id: UNIT6_RULE_IDS.scale,
    title: 'Scale factor',
    body: 'The scale factor of one similar polygon to another is the ratio of a side of the first to the corresponding side of the second. Every pair of corresponding sides gives the same ratio. The scale factor going the other way is the reciprocal.',
    example: 'side j of the first polygon, side k of the second → j/k, also written j:k',
  },
  {
    id: UNIT6_RULE_IDS.perimeter,
    title: 'Perimeters of similar polygons',
    body: 'If two polygons are similar, the ratio of their perimeters equals the scale factor. The ratio of their areas is the square of the scale factor, so squaring belongs to areas, not to perimeters or sides.',
    example: 'scale factor j/k → perimeters in the ratio j/k',
  },
  {
    id: UNIT6_RULE_IDS.corrAngles,
    title: 'Corresponding angles of similar polygons',
    body: 'Corresponding angles of similar polygons are congruent: their measures are equal. The scale factor changes the sides, never the angles, and the angles of each triangle still add to 180°.',
    example: '∠J corresponds to ∠M → m∠J = m∠M',
  },
  SUBSTITUTE,
]

export const SIMILAR_RULES: RuleCard[] = [
  {
    id: UNIT6_RULE_IDS.which,
    title: 'Which test proves similarity',
    body: 'Three tests prove two triangles similar: the AA Similarity Postulate, the SSS Similarity Theorem, and the SAS Similarity Theorem. A shared angle, vertical angles, right angles, and angles made by parallel lines all count as congruent pairs. Two pairs of proportional sides with an angle that is not between them (SSA), two pairs of sides alone, or one pair of angles alone prove nothing.',
    example: 'one pair of congruent angles → not enough; two pairs → similar',
  },
  {
    id: UNIT6_RULE_IDS.aa,
    title: 'AA Similarity Postulate',
    body: 'If two angles of one triangle are congruent to two angles of another triangle, then the triangles are similar. The third angles are then congruent too, because each triangle’s angles add to 180°.',
    example: '∠J ≅ ∠M and ∠K ≅ ∠N → the triangles are similar',
  },
  {
    id: UNIT6_RULE_IDS.sss,
    title: 'SSS Similarity Theorem',
    body: 'If the sides of one triangle are in proportion to the sides of another triangle, then the triangles are similar. Pair the shortest with the shortest, the longest with the longest, and the middle with the middle: all three ratios must be equal.',
    example: 'three ratios of corresponding sides, all equal → similar',
  },
  {
    id: UNIT6_RULE_IDS.sas,
    title: 'SAS Similarity Theorem',
    body: 'If an angle of one triangle is congruent to an angle of another triangle, and the sides including those angles are in proportion, then the triangles are similar. The congruent angles have to lie between the proportional sides.',
    example: 'the angle between two proportional pairs of sides → similar',
  },
  {
    id: UNIT6_RULE_IDS.statement,
    title: 'The letters name the corresponding vertices',
    body: 'In a similarity statement, as in a congruence statement, the order of the letters is the correspondence: the first vertex of one triangle goes with the first vertex of the other, and so on. Find the pairs from the angles that match, not from where the vertices sit in the drawing.',
    example: 'first vertex with the second vertex ✗ → first vertex with the first vertex',
  },
  {
    id: UNIT6_RULE_IDS.freePairs,
    title: 'Angles the figure gives',
    body: 'Some congruent angles need no mark. An angle two triangles share is congruent to itself, two segments that cross make congruent vertical angles, and all right angles are congruent.',
    example: 'two segments that cross → the angles across from each other are congruent',
  },
  {
    id: UNIT6_RULE_IDS.rightMean,
    title: 'The altitude to the hypotenuse',
    body: 'The altitude to the hypotenuse of a right triangle forms two triangles that are similar to the original triangle and to each other. The altitude is the geometric mean of the two segments of the hypotenuse, and each leg is the geometric mean of the hypotenuse and the segment next to that leg.',
    example: 'segments j and k of the hypotenuse → altitude √(jk)',
  },
  {
    id: UNIT6_RULE_IDS.indirect,
    title: 'Indirect measurement',
    body: 'Two objects and their shadows at the same time of day make similar right triangles, because the sun’s rays meet the ground at the same angle. A mirror on the ground does the same: the two angles at the mirror are congruent. Each ratio compares a height with its own shadow, or with its own distance to the mirror.',
    example: 'height j with shadow k, height l with shadow m → j/k = l/m',
  },
  PROPORTION,
]

export const PARTS_RULES: RuleCard[] = [
  {
    id: UNIT6_RULE_IDS.splitter,
    title: 'Triangle Proportionality Theorem',
    body: 'If a line parallel to one side of a triangle intersects the other two sides, then it divides those sides proportionally: a part over the other part on one side equals the matching part over the other part on the other side. A part over the whole side works only when both sides of the equation use the whole.',
    example: 'MN ∥ KL, with M between J and K, and N between J and L → JM/MK = JN/NL',
  },
  {
    id: UNIT6_RULE_IDS.converse,
    title: 'Converse of the Triangle Proportionality Theorem',
    body: 'If a line divides two sides of a triangle proportionally, then it is parallel to the third side. Compare a part over the other part on both sides: equal ratios mean the line is parallel, and unequal ratios mean it is not.',
    example: 'JM/MK = JN/NL → MN ∥ KL',
  },
  {
    id: UNIT6_RULE_IDS.midpoint,
    title: 'A parallel through a midpoint',
    body: 'If a line through the midpoint of one side of a triangle is parallel to a second side, it passes through the midpoint of the third side. The segment joining those two midpoints is parallel to the third side and half as long (the Triangle Midsegment Theorem).',
    example: 'M the midpoint of JK and MN ∥ KL → N the midpoint of JL, and MN = ½ · KL',
  },
  {
    id: UNIT6_RULE_IDS.bisector,
    title: 'Triangle Angle-Bisector Theorem',
    body: 'If a ray bisects an angle of a triangle, then it divides the opposite side into segments proportional to the other two sides. Each segment goes with the side of the triangle that it touches.',
    example: 'JN bisects ∠J, with N between K and L → KN/NL = JK/JL',
  },
  {
    id: UNIT6_RULE_IDS.parallels,
    title: 'Three parallel lines',
    body: 'If three parallel lines intersect two transversals, then they divide the transversals proportionally: the first piece over the second piece is the same on both transversals.',
    example: 'pieces j and k on one transversal, l and m on the other → j/k = l/m',
  },
  PROPORTION,
  SUBSTITUTE,
]
