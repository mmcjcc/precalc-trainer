/**
 * Rule cards for honors geometry Unit 9, the circle half (Jurgensen 11-5 and 11-6): circumference, area, arc length,
 * the area of a sector, and a segment of a circle. One card per idea, in our own words. No digits and no radical
 * signs anywhere on a card, so no card can show a generated answer; the format hints keep 43 for their examples.
 */
import type { RuleCard } from '@/content/types'
import type { GeoMistakeId } from './grade'

export const CIRCLE_RULE_IDS = {
  circumference: 'geo9-circumference',
  area: 'geo9-circle-area',
  radius: 'geo9-radius-diameter',
  arc: 'geo9-arc-length',
  sector: 'geo9-sector',
  measure: 'geo9-arc-measure',
  segment: 'geo9-segment',
  pi: 'geo9-pi',
} as const

/** The eleven mistakes this half of the unit adds, in the order of GEO_UNIT9_MISTAKE_IDS. */
export const CIRCLE_MISTAKE_IDS = [
  'geo_circumference_for_area',
  'geo_area_for_circumference',
  'geo_circle_diameter_as_radius',
  'geo_circle_radius_as_diameter',
  'geo_circle_radius_not_squared',
  'geo_pi_left_off',
  'geo_sector_fraction_left_off',
  'geo_arc_sector_swapped',
  'geo_arc_measure_for_length',
  'geo_segment_triangle_not_subtracted',
  'geo_segment_triangle_added',
] as const satisfies readonly GeoMistakeId[]

/** New circle mistakes only. Reused ids keep the cards they already open. */
export const UNIT9_CIRCLE_RULE_FOR: Partial<Record<GeoMistakeId, string>> = {
  geo_circumference_for_area: CIRCLE_RULE_IDS.area,
  geo_area_for_circumference: CIRCLE_RULE_IDS.circumference,
  geo_circle_diameter_as_radius: CIRCLE_RULE_IDS.radius,
  geo_circle_radius_as_diameter: CIRCLE_RULE_IDS.radius,
  geo_circle_radius_not_squared: CIRCLE_RULE_IDS.area,
  geo_pi_left_off: CIRCLE_RULE_IDS.pi,
  geo_sector_fraction_left_off: CIRCLE_RULE_IDS.sector,
  geo_arc_sector_swapped: CIRCLE_RULE_IDS.arc,
  geo_arc_measure_for_length: CIRCLE_RULE_IDS.measure,
  geo_segment_triangle_not_subtracted: CIRCLE_RULE_IDS.segment,
  geo_segment_triangle_added: CIRCLE_RULE_IDS.segment,
}

const CIRC: RuleCard = {
  id: CIRCLE_RULE_IDS.circumference,
  title: 'Circumference of a circle',
  body: 'The circumference is the distance around the circle. It is π times the diameter, which is the same as two times π times the radius. Leave π as a symbol in the answer.',
  example: 'radius r → the circumference is two times π times r',
}

const AREA: RuleCard = {
  id: CIRCLE_RULE_IDS.area,
  title: 'Area of a circle',
  body: 'The area of a circle is π times the square of the radius. Square the radius first, then multiply by π. Doubling the radius instead of squaring it gives the circumference, which is a length, not an area.',
  example: 'radius r → the area is π times r times r',
}

const RADIUS: RuleCard = {
  id: CIRCLE_RULE_IDS.radius,
  title: 'Radius and diameter',
  body: 'The radius goes from the center to the circle. The diameter goes all the way across through the center, so it is twice the radius, and the radius is half the diameter. Check which one a formula wants before you put a number in.',
  example: 'diameter d → the radius is half of d',
}

const ARC: RuleCard = {
  id: CIRCLE_RULE_IDS.arc,
  title: 'Arc length',
  body: 'An arc is part of the circle, so its length is part of the circumference. The fraction is the arc’s measure, the same as its central angle, out of the full turn of three hundred sixty degrees. A major arc is the rest of the circle, so its fraction is the full turn minus the central angle, out of the full turn.',
  example: 'central angle m and radius r → the arc length is m out of the full turn, times two times π times r',
}

const SECTOR: RuleCard = {
  id: CIRCLE_RULE_IDS.sector,
  title: 'Area of a sector',
  body: 'A sector is the region between two radii and their arc, shaped like a slice of pie. Its area is part of the area of the circle: the central angle out of the full turn of three hundred sixty degrees, times π times the square of the radius. The whole circle’s area is only the start.',
  example: 'central angle m and radius r → the sector is m out of the full turn, times π times r times r',
}

const MEASURE: RuleCard = {
  id: CIRCLE_RULE_IDS.measure,
  title: 'Arc measure and arc length',
  body: 'The measure of an arc is in degrees, the same number as its central angle. The arc length is a distance in units such as centimeters, and it depends on the radius too: the same angle in a bigger circle has a longer arc. To find a central angle from an arc length, find what fraction of the circumference the arc is, then take that fraction of the full turn.',
  example: 'an arc of m degrees → its length is a fraction of the circumference, not m',
}

const SEGMENT: RuleCard = {
  id: CIRCLE_RULE_IDS.segment,
  title: 'Area of a segment of a circle',
  body: 'A segment of a circle is the region between a chord and its arc. The sector with the same arc reaches to the center, so it is the segment together with the triangle made by the two radii and the chord. The area of the segment is the area of the sector minus the area of that triangle.',
  example: 'sector S and triangle T → the segment is S minus T',
}

const PI: RuleCard = {
  id: CIRCLE_RULE_IDS.pi,
  title: 'Answers in terms of π',
  body: 'An answer in terms of π keeps π as a symbol, the way a simplest radical keeps its square root. Write the number in front in lowest terms and put π after it. Do not change π into a decimal, and do not drop it.',
  example: 'k times π, with k in lowest terms → kπ',
}

export const CIRCLE_RULES: RuleCard[] = [CIRC, AREA, RADIUS, ARC, SECTOR, MEASURE, SEGMENT, PI]
