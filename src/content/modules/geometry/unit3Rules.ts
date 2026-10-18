/**
 * Rule cards for honors geometry Unit 3. Examples use 4, 17, 159, 1/4, and −4.
 * No template generates those as an answer. The cards never use a choice's button text
 * (Corresponding, Yes, Parallel, and the rest of that list).
 */
import type { RuleCard } from '@/content/types'
import type { GeoMistakeId } from './grade'

export const UNIT3_RULE_IDS = {
  transversal: 'geo3-transversal',
  parallelAngles: 'geo3-parallel-angles',
  converse: 'geo3-converse',
  slope: 'geo3-slope',
  line: 'geo3-line',
  triangle: 'geo3-triangle-sum',
  polygon: 'geo3-polygon-sum',
  exterior: 'geo3-exterior-sum',
} as const

export const UNIT3_RULE_FOR: Partial<Record<GeoMistakeId, string>> = {
  geo_alt_int_corr_swapped: UNIT3_RULE_IDS.transversal,
  geo_alt_ext_corr_swapped: UNIT3_RULE_IDS.transversal,
  geo_same_side_congruent: UNIT3_RULE_IDS.parallelAngles,
  geo_congruent_as_same_side: UNIT3_RULE_IDS.parallelAngles,
  geo_parallel_only_when_not: UNIT3_RULE_IDS.converse,
  geo_perp_reciprocal_only: UNIT3_RULE_IDS.slope,
  geo_perp_sign_only: UNIT3_RULE_IDS.slope,
  geo_vertical_as_zero: UNIT3_RULE_IDS.slope,
  geo_lines_relation_swapped: UNIT3_RULE_IDS.slope,
  geo_parallel_kept_intercept: UNIT3_RULE_IDS.line,
  geo_exterior_adjacent: UNIT3_RULE_IDS.triangle,
  geo_interior_sum_n180: UNIT3_RULE_IDS.polygon,
  geo_interior_not_divided: UNIT3_RULE_IDS.polygon,
  geo_exterior_180_over_n: UNIT3_RULE_IDS.exterior,
  geo_sides_from_interior_360: UNIT3_RULE_IDS.exterior,
  geo_sides_from_exterior_180: UNIT3_RULE_IDS.exterior,
  geo_exterior_sum_as_interior: UNIT3_RULE_IDS.exterior,
}

export const PARALLEL_RULES: RuleCard[] = [
  {
    id: UNIT3_RULE_IDS.transversal,
    title: 'Where the eight angles sit',
    body: 'Two lines cut by a third line make eight angles. Name a pair by where each angle sits: between the lines or outside them, and on which side of the third line. Opposite angles at one crossing match either way. Neighbors on a straight line add to a straight angle either way.',
    example: 'angle 17 and angle 4 sit in different places → name the pair from the places',
  },
  {
    id: UNIT3_RULE_IDS.parallelAngles,
    title: 'When the two lines do not meet',
    body: 'When the two lines do not meet, angles in the same corner match, angles between the lines on opposite sides of the third line match, and angles outside the lines on opposite sides match. The pair between the lines on one side of the third line adds to a straight angle.',
    example: 'a pair that matches → do not add that pair to a straight angle',
  },
  {
    id: UNIT3_RULE_IDS.converse,
    title: 'Deciding whether the lines meet',
    body: 'These pairs, with one angle at each crossing, decide it: the same corner, opposite sides between the lines, opposite sides outside the lines, and the one-side pair between the lines. When the measures fit the pair (matching, or adding to a straight angle for the one-side pair), the lines do not meet. When they do not fit, the lines meet, because lines that do not meet would make them fit. Two angles at one crossing, opposite angles or a straight pair, fit either way, so you cannot tell from them.',
    example: 'opposite angles match either way → you cannot tell whether the lines meet',
  },
  {
    id: UNIT3_RULE_IDS.slope,
    title: 'Slope',
    body: 'A line that does not meet this one keeps the slope. A line that meets it at a right angle uses the flipped fraction with the opposite sign. A vertical line has no slope number. A horizontal line is the one that does not rise.',
    example: '1/4 ✗ → −4',
  },
  {
    id: UNIT3_RULE_IDS.line,
    title: 'The line through a point',
    body: 'Keep the slope you need, then choose the intercept so the line contains the point. Copying the original intercept writes the original line, which misses the point.',
    example: 'y = 4x + 17 ✗ → y = 4x − 15',
  },
]

export const POLYGON_RULES: RuleCard[] = [
  {
    id: UNIT3_RULE_IDS.triangle,
    title: 'Angles of a triangle',
    body: 'The three interior angles of a triangle add to a straight angle. An exterior angle equals the two interior angles that are not beside it. The angle beside the exterior is the one that adds with it to a straight angle.',
    example: '17° + 4° + 159° → a straight angle',
  },
  {
    id: UNIT3_RULE_IDS.polygon,
    title: 'Interior angles of a polygon',
    body: 'The interior angles of a convex polygon add to a straight angle for each side after the first two. A regular polygon shares that sum equally among its sides, so each interior angle is the sum divided by the number of sides.',
    example: '(24 − 2) straight angles → the sum divided by the number of sides',
  },
  {
    id: UNIT3_RULE_IDS.exterior,
    title: 'Exterior angles of a polygon',
    body: 'One exterior angle at each vertex of a convex polygon makes a full turn, however many sides there are. Each exterior angle of a regular polygon is that full turn divided by the number of sides. The number of sides is a full turn divided by one exterior angle, not by an interior angle and not by a straight angle.',
    example: 'a full turn shared by the sides → one full turn, however many sides',
  },
]
