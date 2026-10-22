/**
 * Rule cards for honors geometry Unit 7, first half (right triangles, Jurgensen 8-1 to 8-4), named the way Jurgensen
 * names the theorems and corollaries. Examples use the letters j, k, l, m (and J to N for points), which no template
 * uses, and no number a part can have as its answer (only 43 and 90, which no Unit 7 answer is). A body may name every
 * kind of triangle, since it names all of them and so singles out none.
 */
import type { RuleCard } from '@/content/types'
import type { GeoMistakeId } from './grade'

export const UNIT7_RULE_IDS = {
  mean: 'geo7-mean',
  similar: 'geo7-altitude-similar',
  altitudeMean: 'geo7-altitude-mean',
  legMean: 'geo7-leg-mean',
  pythagorean: 'geo7-pythagorean',
  triples: 'geo7-triples',
  converse: 'geo7-converse',
  acuteObtuse: 'geo7-acute-obtuse',
  inequality: 'geo7-triangle-inequality',
  inside: 'geo7-inside-figures',
  rounding: 'geo7-rounding',
  radicalSquare: 'geo7-radical-square',
  special45: 'geo7-45-45-90',
  special30: 'geo7-30-60-90',
  specialFigures: 'geo7-special-figures',
  rationalize: 'geo7-rationalize',
  /** Unit 1's id: geo_distance_not_squared and geo_distance_no_root open this card in every unit. */
  distance: 'geo-distance',
  /** Unit 1's id: geo_answered_x opens this card in every unit. */
  substitute: 'geo-substitute',
} as const

/**
 * The card a named mistake opens. A mistake two modules share and whose card differs by module (a geometric mean slip
 * on a mean or on a triangle) is left out, so it opens the card of the part it happened on.
 */
export const UNIT7_RULE_FOR: Partial<Record<GeoMistakeId, string>> = {
  geo_leg_far_segment: UNIT7_RULE_IDS.legMean,
  geo_converse_wrong_side: UNIT7_RULE_IDS.acuteObtuse,
  geo_acute_obtuse_swapped: UNIT7_RULE_IDS.acuteObtuse,
  geo_triangle_inequality_skipped: UNIT7_RULE_IDS.inequality,
  geo_coefficient_not_squared: UNIT7_RULE_IDS.radicalSquare,
}

const MEAN: RuleCard = {
  id: UNIT7_RULE_IDS.mean,
  title: 'Geometric mean',
  body: 'If a, b and x are positive numbers with a/x = x/b, then x is the geometric mean of a and b. Cross-multiplying gives x² = ab, so x = √(ab), written in simplest radical form. Going the other way, if x is the geometric mean of a and b, then b = x²/a. Half of a + b is the arithmetic mean, a different number.',
  example: 'j/x = x/k → x² = jk → x = √(jk)',
}

const PYTHAGOREAN: RuleCard = {
  id: UNIT7_RULE_IDS.pythagorean,
  title: 'Pythagorean Theorem',
  body: 'In a right triangle, the square of the hypotenuse is equal to the sum of the squares of the legs: c² = a² + b². The hypotenuse c is the side across from the right angle and the longest side. To find a leg, subtract: a² = c² − b². Finish with the positive square root, in simplest radical form.',
  example: 'legs j and k → hypotenuse √(j² + k²)',
}

const RADICAL_SQUARE: RuleCard = {
  id: UNIT7_RULE_IDS.radicalSquare,
  title: 'Squaring a radical',
  body: 'To square a number times a radical, square both factors: (k√m)² = k² · m. A radical squared is the number under it: (√m)² = m.',
  example: '(k√m)² → k² · m',
}

const SUBSTITUTE: RuleCard = {
  id: UNIT7_RULE_IDS.substitute,
  title: 'Substitute to find the measure',
  body: 'x is the number that makes the equation true. A length is what its expression equals after you put that number in. They are the same only by accident.',
  example: 'x = j and the length is x + k → the length is j + k',
}

export const RIGHT_SIMILAR_RULES: RuleCard[] = [
  MEAN,
  {
    id: UNIT7_RULE_IDS.similar,
    title: 'Theorem: the altitude to the hypotenuse',
    body: 'If the altitude is drawn to the hypotenuse of a right triangle, then the two triangles formed are similar to the original triangle and to each other. Its two corollaries give the geometric means.',
    example: 'right △JKL with altitude LM to the hypotenuse JK → △JLK ~ △JML ~ △LMK',
  },
  {
    id: UNIT7_RULE_IDS.altitudeMean,
    title: 'Corollary 1: the altitude',
    body: 'When the altitude is drawn to the hypotenuse of a right triangle, the length of the altitude is the geometric mean of the lengths of the two segments of the hypotenuse.',
    example: 'segments j and k of the hypotenuse → altitude² = jk',
  },
  {
    id: UNIT7_RULE_IDS.legMean,
    title: 'Corollary 2: each leg',
    body: 'When the altitude is drawn to the hypotenuse of a right triangle, each leg is the geometric mean of the hypotenuse and the segment of the hypotenuse that is next to that leg.',
    example: 'hypotenuse j + k, leg l touching segment j → l² = (j + k) · j',
  },
  PYTHAGOREAN,
  RADICAL_SQUARE,
  SUBSTITUTE,
]

export const PYTHAGOREAN_RULES: RuleCard[] = [
  PYTHAGOREAN,
  {
    id: UNIT7_RULE_IDS.triples,
    title: 'Pythagorean triples',
    body: 'Three whole numbers a, b and c with a² + b² = c² are a Pythagorean triple. Any whole-number multiple of a triple is a triple too, so a triangle whose legs are a multiple of a triple has a whole-number hypotenuse. Other right triangles have a radical somewhere.',
    example: 'a triple j, k, l → kj, kk, kl for any whole number k',
  },
  {
    id: UNIT7_RULE_IDS.converse,
    title: 'Converse of the Pythagorean Theorem',
    body: 'If the square of one side of a triangle is equal to the sum of the squares of the other two sides, then the triangle is a right triangle. Use the longest side as c.',
    example: 'c² = a² + b², c the longest → the angle across from c measures 90°',
  },
  {
    id: UNIT7_RULE_IDS.acuteObtuse,
    title: 'Acute or obtuse from the squares',
    body: 'Let c be the longest side of a triangle. If c² < a² + b², the triangle is acute. If c² = a² + b², it is right. If c² > a² + b², it is obtuse. Find the longest side first: it is c wherever it is listed.',
    example: 'c² more than a² + b² → the angle across from c is more than 90°',
  },
  {
    id: UNIT7_RULE_IDS.inequality,
    title: 'Triangle Inequality',
    body: 'The sum of the lengths of any two sides of a triangle is greater than the length of the third side. Three lengths make a triangle only when the two shorter ones add up to more than the longest; check that before classifying.',
    example: 'j + k not more than l → the segments cannot meet',
  },
  {
    id: UNIT7_RULE_IDS.inside,
    title: 'Right triangles inside figures',
    body: 'The diagonal of a rectangle is the hypotenuse of a right triangle whose legs are two sides. The altitude to the base of an isosceles triangle bisects the base, and the diagonals of a rhombus bisect each other at right angles, so the right triangle inside uses half of the base, or half of each diagonal.',
    example: 'base j → each half of the triangle has a leg of half of j',
  },
  {
    id: UNIT7_RULE_IDS.distance,
    title: 'Distance formula',
    body: 'The distance between (x₁, y₁) and (x₂, y₂) is √((x₂ − x₁)² + (y₂ − y₁)²): the hypotenuse of the right triangle whose legs run along the grid. Square the changes, add, then take the square root, in simplest radical form.',
    example: 'changes j and k → √(j² + k²)',
  },
  {
    id: UNIT7_RULE_IDS.rounding,
    title: 'Rounding a length',
    body: 'Find the exact length first, as a square root. Then use a calculator for the square root and round once, at the end, to the place the problem asks for. Rounding a square on the way makes the last digit wrong.',
    example: 'a length of √j → a decimal, rounded once at the end',
  },
  RADICAL_SQUARE,
]

export const SPECIAL_RIGHT_RULES: RuleCard[] = [
  {
    id: UNIT7_RULE_IDS.special45,
    title: '45°-45°-90° Triangle Theorem',
    body: 'In the 45°-45°-90° triangle, the hypotenuse is √2 times as long as a leg. Both legs have the same length, so a leg is the hypotenuse divided by √2.',
    example: 'leg k → hypotenuse k√2',
  },
  {
    id: UNIT7_RULE_IDS.special30,
    title: '30°-60°-90° Triangle Theorem',
    body: 'In the 30°-60°-90° triangle, the hypotenuse is twice as long as the shorter leg, and the longer leg is √3 times as long as the shorter leg. The shorter leg is across from the 30° angle and the longer leg is across from the 60° angle.',
    example: 'shorter leg k → hypotenuse twice k, longer leg k√3',
  },
  {
    id: UNIT7_RULE_IDS.specialFigures,
    title: 'Special right triangles inside figures',
    body: 'A diagonal of a square cuts it into two 45°-45°-90° triangles. An altitude of an equilateral triangle cuts it into two 30°-60°-90° triangles, and the shorter leg is half a side. A rectangle whose diagonal makes an angle of 30° with a side, and a rhombus with an angle of 60°, are cut by their diagonals into 30°-60°-90° triangles; the rhombus’s shorter diagonal is as long as a side.',
    example: 'square with side k → diagonal k√2',
  },
  {
    id: UNIT7_RULE_IDS.rationalize,
    title: 'Simplest radical form',
    body: 'An answer in simplest radical form has no perfect-square factor under the radical and no radical in a denominator. To clear a radical from the denominator, multiply the top and the bottom by that radical.',
    example: 'k/√m → (k√m)/m',
  },
  {
    id: UNIT7_RULE_IDS.inside,
    title: 'Half a side, half a diagonal',
    body: 'The altitude of an equilateral triangle cuts a side in half, and the diagonals of a rhombus cut each other in half. The right triangle inside has the half as a leg; the whole side or the whole diagonal is twice that leg.',
    example: 'side j → the shorter leg is half of j',
  },
]
