import type { RuleCard } from '@/content/types'
import type { GeoMistakeId } from './grade'

export const GEO_RULE_IDS = {
  segment: 'geo-segment-add',
  angle: 'geo-angle-add',
  midpoint: 'geo-midpoint',
  bisector: 'geo-bisector',
  midFormula: 'geo-mid-formula',
  endpoint: 'geo-endpoint',
  distance: 'geo-distance',
  comp: 'geo-comp',
  supp: 'geo-supp',
  vertical: 'geo-vertical',
  linear: 'geo-linear',
  words: 'geo-words',
  substitute: 'geo-substitute',
} as const

/**
 * Mistakes whose rule card is the same on every problem. The others use the part's own card,
 * so an angle problem does not open the segment postulate.
 */
export const GEO_RULE_FOR: Partial<Record<GeoMistakeId, string>> = {
  geo_midpoint_subtracted: GEO_RULE_IDS.midFormula,
  geo_endpoint_averaged: GEO_RULE_IDS.endpoint,
  geo_distance_not_squared: GEO_RULE_IDS.distance,
  geo_distance_no_root: GEO_RULE_IDS.distance,
  geo_vertical_as_supplementary: GEO_RULE_IDS.vertical,
  geo_linear_pair_equal: GEO_RULE_IDS.linear,
  geo_complement_reversed: GEO_RULE_IDS.words,
  geo_answered_x: GEO_RULE_IDS.substitute,
}

export const SEGMENT_RULES: RuleCard[] = [
  {
    id: GEO_RULE_IDS.segment,
    title: 'Segment addition postulate',
    body: 'If B is between A and C, then AB + BC = AC. The two pieces add up to the whole segment. They are equal only when the figure marks a midpoint.',
    example: 'PQ = 6x + 1, QR = 2x + 3, PR = 36 → (6x + 1) + (2x + 3) = 36',
  },
  {
    id: GEO_RULE_IDS.midpoint,
    title: 'Definition of a midpoint',
    body: 'The midpoint of a segment cuts it into two congruent pieces. AM = MB, and the whole segment is twice one piece: AB = 2 · AM.',
    example: 'PM = 10x + 3 and MQ = 8x + 11 → 10x + 3 = 8x + 11, and PQ = 2 · PM',
  },
  {
    id: GEO_RULE_IDS.midFormula,
    title: 'Midpoint formula',
    body: 'The midpoint of (x₁, y₁) and (x₂, y₂) is ((x₁ + x₂) / 2, (y₁ + y₂) / 2). Add each pair of coordinates, then divide by 2. Subtracting them is a different point.',
    example: '(1, 3) and (4, 8) → ((1 + 4) / 2, (3 + 8) / 2) = (5/2, 11/2)',
  },
  {
    id: GEO_RULE_IDS.endpoint,
    title: 'The other endpoint',
    body: 'If M is the midpoint of AB, then M is already the average of A and B, so B = 2M − A. Averaging A and M finds the midpoint of AM, not B.',
    example: 'P (1, 3) and M (4, 5) → Q = (2 · 4 − 1, 2 · 5 − 3) = (7, 7)',
  },
  {
    id: GEO_RULE_IDS.distance,
    title: 'Distance formula',
    body: 'The distance from (x₁, y₁) to (x₂, y₂) is √((x₂ − x₁)² + (y₂ − y₁)²). Square the changes, add, then take the square root, and write the radical in simplest form.',
    example: '(1, 1) to (3, 7) → √(2² + 6²) = √40 = 2√10',
  },
  {
    id: GEO_RULE_IDS.substitute,
    title: 'Substitute to find the measure',
    body: 'x is the number that makes the equation true. A length or an angle measure is what the expression equals after you put that number in. They are the same only by accident.',
    example: 'x = 4 and PQ = 8x + 1 → PQ = 8(4) + 1 = 33',
  },
]

export const ANGLE_RULES: RuleCard[] = [
  {
    id: GEO_RULE_IDS.angle,
    title: 'Angle addition postulate',
    body: 'If D is in the interior of ∠ABC, then m∠ABD + m∠DBC = m∠ABC. The two pieces add up to the whole angle. They are equal only when the figure marks a bisector.',
    example: 'm∠PQS = 5x + 3, m∠SQR = 4x + 4, m∠PQR = 43 → (5x + 3) + (4x + 4) = 43',
  },
  {
    id: GEO_RULE_IDS.bisector,
    title: 'Definition of an angle bisector',
    body: 'An angle bisector cuts an angle into two congruent angles. m∠ABD = m∠DBC, and the whole angle is twice one piece: m∠ABC = 2 · m∠ABD.',
    example: 'm∠PQS = 3x + 2 and m∠SQR = 4x − 2 → 3x + 2 = 4x − 2, and m∠PQR = 2 · m∠PQS',
  },
  {
    id: GEO_RULE_IDS.comp,
    title: 'Complementary angles',
    body: 'Complementary angles add to 90°. Supplementary angles add to 180°. The two totals are not interchangeable.',
    example: '(3x + 8) + (5x + 50) = 90',
  },
  {
    id: GEO_RULE_IDS.supp,
    title: 'Supplementary angles',
    body: 'Supplementary angles add to 180°. Complementary angles add to 90°. Using 90 for a supplementary pair solves a different problem.',
    example: '(2x + 10) + (3x + 20) = 180',
  },
  {
    id: GEO_RULE_IDS.vertical,
    title: 'Vertical angles',
    body: 'Vertical angles are the opposite angles made by two intersecting lines, and they are congruent. The neighboring angles are the linear pair, and those are the ones that add to 180°.',
    example: 'm∠1 = 2x + 10 and m∠2 = 3x − 5 → 2x + 10 = 3x − 5',
  },
  {
    id: GEO_RULE_IDS.linear,
    title: 'Linear pair',
    body: 'A linear pair is two adjacent angles that form a straight line, so their measures add to 180°. They are congruent only when each one is 90°.',
    example: 'm∠1 = 2x + 10 and m∠2 = 3x + 20 → (2x + 10) + (3x + 20) = 180',
  },
  {
    id: GEO_RULE_IDS.words,
    title: 'An angle and its partner',
    body: 'The complement of an angle is 90° minus the angle. The supplement is 180° minus the angle. The sentence describes the angle itself: “2 less than three times its complement” means the angle, not the complement, is the larger one.',
    example: 'a = 3(90 − a) − 2 → a = 67, and the complement is 23',
  },
  {
    id: GEO_RULE_IDS.substitute,
    title: 'Substitute to find the measure',
    body: 'x is the number that makes the equation true. The angle measure is what the expression equals after you put that number in.',
    example: 'x = 4 and m∠1 = 5x + 3 → m∠1 = 5(4) + 3 = 23',
  },
]
