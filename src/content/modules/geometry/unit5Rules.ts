/**
 * Rule cards for honors geometry Unit 5 (quadrilaterals), named the way Jurgensen names the theorems. Examples
 * use the letters J, K, L, M, N (no template uses them) and only numbers no template generates as an answer
 * (0, 1, 2, 4, 8, 33, 180, the slope 1/4, the radical 2√5, the point (4, 2)), and never the name of a shape, which is
 * an answer on a naming question. A card body may name every shape or every test; a card that lists them all
 * singles out none.
 */
import type { RuleCard } from '@/content/types'
import type { GeoMistakeId } from './grade'

/** Unit 1 card ids (rules.ts GEO_RULE_IDS), repeated here because rules.ts imports this file. */
const UNIT1_IDS = { substitute: 'geo-substitute', distance: 'geo-distance', midFormula: 'geo-mid-formula' } as const

export const UNIT5_RULE_IDS = {
  pgramSides: 'geo5-pgram-sides',
  pgramAngles: 'geo5-pgram-angles',
  pgramDiagonals: 'geo5-pgram-diagonals',
  pgramTests: 'geo5-pgram-tests',
  slope: 'geo5-slope',
  rectangle: 'geo5-rectangle',
  rhombus: 'geo5-rhombus',
  square: 'geo5-square',
  rectRhombus: 'geo5-rect-rhombus',
  classify: 'geo5-classify',
  midsegment: 'geo5-midsegment',
  median: 'geo5-median',
  isoTrapezoid: 'geo5-iso-trapezoid',
  kite: 'geo5-kite',
} as const

/**
 * The card a named mistake opens. A mistake two modules share (a half-diagonal used as the whole, one pair of
 * sides taken as enough) is left out, so it opens the card of the part it happened on.
 */
export const UNIT5_RULE_FOR: Partial<Record<GeoMistakeId, string>> = {
  geo_consecutive_angles_equal: UNIT5_RULE_IDS.pgramAngles,
  geo_opposite_angles_supplementary: UNIT5_RULE_IDS.pgramAngles,
  geo_diagonals_assumed_congruent: UNIT5_RULE_IDS.pgramDiagonals,
  geo_parallelogram_as_rhombus: UNIT5_RULE_IDS.pgramSides,
  geo_rect_rhombus_swapped: UNIT5_RULE_IDS.rectRhombus,
  geo_median_not_halved: UNIT5_RULE_IDS.median,
  geo_median_as_base: UNIT5_RULE_IDS.median,
  geo_midsegment_doubled: UNIT5_RULE_IDS.midsegment,
  geo_kite_angles_wrong_pair: UNIT5_RULE_IDS.kite,
  geo_trapezoid_as_parallelogram: UNIT5_RULE_IDS.isoTrapezoid,
  geo_parallel_congruent_mixed: UNIT5_RULE_IDS.pgramTests,
  geo_consecutive_marks_as_opposite: UNIT5_RULE_IDS.pgramTests,
  geo_one_diagonal_bisected: UNIT5_RULE_IDS.pgramTests,
  geo_parallelogram_test_missed: UNIT5_RULE_IDS.pgramTests,
  geo_square_not_rectangle: UNIT5_RULE_IDS.square,
  geo_not_most_specific: UNIT5_RULE_IDS.classify,
  geo_converse_property: UNIT5_RULE_IDS.classify,
  geo_slope_inverted: UNIT5_RULE_IDS.slope,
}

const SUBSTITUTE: RuleCard = {
  id: UNIT1_IDS.substitute,
  title: 'Substitute to find the measure',
  body: 'x is the number that makes the equation true. A length or an angle measure is what its expression equals after you put that number in. They are the same only by accident.',
  example: 'x = 4 and JK = 8x + 1 → JK = 33',
}

export const PARALLELOGRAM_RULES: RuleCard[] = [
  {
    id: UNIT5_RULE_IDS.pgramSides,
    title: 'Opposite sides of a parallelogram are congruent',
    body: 'Theorem: opposite sides of a parallelogram are congruent. Set the expressions for two opposite sides equal, then solve for x. Two sides that meet at a vertex are consecutive; they are equal only when the parallelogram is a rhombus.',
    example: 'parallelogram JKLM: JK = ML and KL = JM',
  },
  {
    id: UNIT5_RULE_IDS.pgramAngles,
    title: 'Angles of a parallelogram',
    body: 'Theorem: opposite angles of a parallelogram are congruent. Consecutive angles share a side, and because the opposite sides are parallel they are same-side interior angles: they are supplementary, adding to 180°.',
    example: 'parallelogram JKLM: m∠J = m∠L, and m∠J + m∠K = 180',
  },
  {
    id: UNIT5_RULE_IDS.pgramDiagonals,
    title: 'Diagonals of a parallelogram bisect each other',
    body: 'Theorem: the diagonals of a parallelogram bisect each other. The point where they cross is the midpoint of each diagonal, so the two halves of one diagonal are equal and the whole diagonal is twice a half. The two diagonals are equal to each other only in a rectangle.',
    example: 'JL and KM cross at N: JN = NL, so JL = 2 · JN',
  },
  {
    id: UNIT5_RULE_IDS.pgramTests,
    title: 'Five ways to prove a parallelogram',
    body: 'A quadrilateral is a parallelogram if both pairs of opposite sides are parallel (the definition), if both pairs of opposite sides are congruent, if one pair of opposite sides is both congruent and parallel, if both pairs of opposite angles are congruent, or if the diagonals bisect each other. Only the marks count. One pair parallel and the other pair congruent is not one of the five.',
    example: 'arrows: parallel sides; ticks: congruent segments; arcs: congruent angles',
  },
  {
    id: UNIT5_RULE_IDS.slope,
    title: 'Slope and parallel sides',
    body: 'Slope is rise over run: (y₂ − y₁)/(x₂ − x₁). Two sides are parallel when their slopes are equal. When both pairs of opposite sides have equal slopes, both pairs are parallel, and the quadrilateral is a parallelogram by definition.',
    example: 'a rise of 1 over a run of 4 → slope 1/4',
  },
  {
    id: UNIT1_IDS.distance,
    title: 'Distance formula',
    body: 'The distance from (x₁, y₁) to (x₂, y₂) is √((x₂ − x₁)² + (y₂ − y₁)²). Square the changes, add them, take the square root, and write the result in simplest radical form. Equal lengths for both pairs of opposite sides show both pairs are congruent.',
    example: 'changes of 2 and 4 → √(2² + 4²) = 2√5',
  },
  {
    id: UNIT1_IDS.midFormula,
    title: 'Midpoint formula',
    body: 'The midpoint of (x₁, y₁) and (x₂, y₂) is ((x₁ + x₂)/2, (y₁ + y₂)/2): add each pair of coordinates, then divide by 2. When both diagonals have the same midpoint, the diagonals bisect each other.',
    example: '(0, 4) and (8, 0) → (4, 2)',
  },
  SUBSTITUTE,
]

export const SPECIAL_RULES: RuleCard[] = [
  {
    id: UNIT5_RULE_IDS.rectangle,
    title: 'Diagonals of a rectangle are congruent',
    body: 'A rectangle is a parallelogram with four right angles. Theorem: the diagonals of a rectangle are congruent. They also bisect each other, so all four half-diagonals are equal, and each triangle they cut off at a side is isosceles.',
    example: 'JL = KM, and they cross at N: JN = NL = KN = NM',
  },
  {
    id: UNIT5_RULE_IDS.rhombus,
    title: 'Diagonals of a rhombus',
    body: 'A rhombus is a parallelogram with four congruent sides. Theorems: the diagonals of a rhombus are perpendicular, and each diagonal bisects two angles of the rhombus.',
    example: 'JL ⊥ KM, and m∠KJL = m∠MJL',
  },
  {
    id: UNIT5_RULE_IDS.square,
    title: 'A square is a rectangle and a rhombus',
    body: 'A square has four right angles and four congruent sides, so it is a rectangle and a rhombus, and every property of both holds: its diagonals are congruent, perpendicular, and bisect each other, and each diagonal cuts two right angles in half.',
    example: 'JL = KM and JL ⊥ KM',
  },
  {
    id: UNIT5_RULE_IDS.rectRhombus,
    title: 'Rectangle diagonals or rhombus diagonals',
    body: 'In a parallelogram, congruent diagonals make a rectangle and perpendicular diagonals make a rhombus. In a rectangle the half-diagonals are equal, so the two angles a side makes with the diagonals are equal. In a rhombus the diagonals meet at a right angle, so those two angles are complementary.',
    example: 'JL ≅ KM gives right angles; JL ⊥ KM gives congruent sides',
  },
  {
    id: UNIT5_RULE_IDS.classify,
    title: 'The most specific name',
    body: 'A parallelogram has both pairs of opposite sides parallel. A rectangle is a parallelogram with four right angles, a rhombus is a parallelogram with four congruent sides, and a square is both. A trapezoid has exactly one pair of parallel sides; an isosceles trapezoid also has congruent legs. A kite has two pairs of congruent consecutive sides and no congruent opposite sides. The most specific name uses every given fact, and every name that fits is still true.',
    example: 'four right angles and four congruent sides: every name that fits is true, and one uses both facts',
  },
  SUBSTITUTE,
]

export const TRAPEZOID_RULES: RuleCard[] = [
  {
    id: UNIT5_RULE_IDS.midsegment,
    title: 'Triangle midsegment theorem',
    body: 'The segment that joins the midpoints of two sides of a triangle is parallel to the third side and half as long. So the third side is twice the midsegment.',
    example: 'triangle JKL, with M the midpoint of JK and N the midpoint of JL: MN = ½ · KL',
  },
  {
    id: UNIT5_RULE_IDS.median,
    title: 'Median of a trapezoid',
    body: 'The median (or midsegment) of a trapezoid joins the midpoints of the legs. Theorem: it is parallel to the bases, and its length is half the sum of the bases, the average of the two.',
    example: 'bases JK and ML: median = ½(JK + ML)',
  },
  {
    id: UNIT5_RULE_IDS.isoTrapezoid,
    title: 'Isosceles trapezoid',
    body: 'An isosceles trapezoid has congruent legs. Theorems: its base angles (the two angles at one base) are congruent, and its diagonals are congruent. Two angles along one leg are same-side interior angles between the parallel bases, so they add to 180°. The diagonals do not bisect each other.',
    example: 'bases JK and ML: m∠J = m∠K, and m∠J + m∠M = 180',
  },
  {
    id: UNIT5_RULE_IDS.kite,
    title: 'Kite',
    body: 'A kite has two pairs of congruent consecutive sides and no congruent opposite sides. Theorems: its diagonals are perpendicular, and it has exactly one pair of congruent opposite angles, at the two vertices where unequal sides meet.',
    example: 'JK ≅ JM and LK ≅ LM: ∠K ≅ ∠M, and JL ⊥ KM',
  },
  SUBSTITUTE,
]
