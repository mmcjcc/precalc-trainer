/**
 * Rule cards for honors geometry Unit 9 (areas of polygons, Jurgensen chapter 11, first half). One card per
 * formula family, in our own words, plus a card that lists every area formula and singles none of them out.
 * No digits and no radical signs: a generated answer must not appear on a card.
 */
import type { RuleCard } from '@/content/types'
import type { GeoMistakeId } from './grade'

export const UNIT9_RULE_IDS = {
  rect: 'geo9-rect',
  triangle: 'geo9-triangle',
  trapezoid: 'geo9-trapezoid',
  diagonals: 'geo9-diagonals',
  regular: 'geo9-regular',
  equilateral: 'geo9-equilateral',
  special: 'geo9-special',
  height: 'geo9-height',
  half: 'geo9-half',
  all: 'geo9-all',
} as const

/** New area mistakes only. Borrowed Pythagorean and special-triangle ids keep the cards they already open. */
export const UNIT9_RULE_FOR: Partial<Record<GeoMistakeId, string>> = {
  geo_slant_as_height: UNIT9_RULE_IDS.height,
  geo_area_not_halved: UNIT9_RULE_IDS.half,
  geo_half_applied: UNIT9_RULE_IDS.rect,
  geo_bases_multiplied: UNIT9_RULE_IDS.trapezoid,
  geo_perimeter_for_area: UNIT9_RULE_IDS.regular,
  geo_area_for_perimeter: UNIT9_RULE_IDS.regular,
  geo_apothem_for_radius: UNIT9_RULE_IDS.regular,
}

const RECT: RuleCard = {
  id: UNIT9_RULE_IDS.rect,
  title: 'Area of a rectangle or a parallelogram',
  body: 'The area is the base times the height. The height is the perpendicular distance between the base and the opposite side, not the length of a slanted side. Do not take half: that would be the area of a triangle with the same base and height.',
  example: 'base b and height h → the area is b times h',
}

const TRI: RuleCard = {
  id: UNIT9_RULE_IDS.triangle,
  title: 'Area of a triangle',
  body: 'The area is half the base times the height. The height is the perpendicular distance from the opposite vertex to the line of the base. A slanted side is not the height unless the figure shows a right angle between that side and the base.',
  example: 'base b and height h → the area is half of b times h',
}

const TRAP: RuleCard = {
  id: UNIT9_RULE_IDS.trapezoid,
  title: 'Area of a trapezoid',
  body: 'The area is half the height times the sum of the two bases. The bases are the parallel sides. Add those bases; do not multiply them. The height is the perpendicular distance between the bases.',
  example: 'bases b and c and height h → the area is half of h times the sum of b and c',
}

const DIAG: RuleCard = {
  id: UNIT9_RULE_IDS.diagonals,
  title: 'Area of a rhombus or a kite',
  body: 'The area of a rhombus or a kite is half the product of the diagonals. The diagonals are perpendicular. Leaving out the half makes the area twice as big.',
  example: 'diagonals d and e → the area is half of d times e',
}

const REG: RuleCard = {
  id: UNIT9_RULE_IDS.regular,
  title: 'Area of a regular polygon',
  body: 'The area is half the apothem times the perimeter. The apothem is the perpendicular distance from the center to a side. The radius of a regular polygon reaches a vertex, which is farther than the apothem. The perimeter is the distance around, not the area.',
  example: 'apothem a and perimeter p → the area is half of a times p',
}

const EQ: RuleCard = {
  id: UNIT9_RULE_IDS.equilateral,
  title: 'Area of an equilateral triangle',
  body: 'The area is the square of the side, times the square root of three, divided by four. The height is half the side times the square root of three. The apothem, from the center to a side, is a third of that height.',
  example: 'side s → the area is the square of s, times the square root of three, divided by four',
}

const SPEC: RuleCard = {
  id: UNIT9_RULE_IDS.special,
  title: 'A special right triangle inside the figure',
  body: 'In a thirty-sixty-ninety triangle the sides are in the ratio one, square root of three, two: the short leg is opposite thirty degrees, the long leg is the short leg times the square root of three, and the hypotenuse is twice the short leg. In a forty-five-forty-five-ninety triangle the legs are equal and the hypotenuse is a leg times the square root of two. Find that side first, then the area.',
  example: 'short leg s in a thirty-sixty-ninety triangle → the long leg is s times the square root of three',
}

const HEIGHT: RuleCard = {
  id: UNIT9_RULE_IDS.height,
  title: 'The height is perpendicular',
  body: 'The height is the perpendicular distance, drawn straight across to the line of the base. It meets the base at a right angle. A slanted side is a different length, and using it as the height gives the wrong area.',
  example: 'a slanted side beside a perpendicular height → use the perpendicular distance',
}

const HALF: RuleCard = {
  id: UNIT9_RULE_IDS.half,
  title: 'When the area takes a half',
  body: 'A triangle is half the base times the height. A trapezoid is half the height times the sum of the bases. A rhombus or a kite is half the product of the diagonals. Leaving out the half doubles the area.',
  example: 'a product that still needs a half → take half of that product',
}

const ALL: RuleCard = {
  id: UNIT9_RULE_IDS.all,
  title: 'Area formulas',
  body: 'A rectangle or a parallelogram is base times height. A triangle is half of that. A trapezoid is half the height times the sum of the bases. A rhombus or a kite is half the product of the diagonals. A regular polygon is half the apothem times the perimeter. An equilateral triangle is the square of the side, times the square root of three, divided by four. The height in each of these is the perpendicular one.',
  example: 'any of these figures → use the formula for that figure, and do not treat one of them as the only formula',
}

export const AREA_RULES: RuleCard[] = [RECT, TRI, TRAP, DIAG, REG, EQ, SPEC, HEIGHT, HALF, ALL]
