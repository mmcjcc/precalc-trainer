/**
 * Rule cards for the last module of honors geometry Unit 9 (Jurgensen 11-7 and 11-8, and the shaded regions of 11-5
 * and 11-6): ratios of areas, shaded regions, and geometric probability. One card per idea, in our own words. No
 * digits and no radical signs anywhere on a card, so no card can show a generated answer.
 *
 * The module also opens four cards it shares with the earlier Unit 9 modules (the area of a rectangle, of a regular
 * polygon, of an equilateral triangle, and of a circle), because a shaded region starts from those areas.
 */
import type { RuleCard } from '@/content/types'
import type { GeoMistakeId } from './grade'
import { AREA_RULES, UNIT9_RULE_IDS } from './unit9Rules'
import { CIRCLE_RULES, CIRCLE_RULE_IDS } from './unit9CircleRules'

export const RATIO_RULE_IDS = {
  sameHeight: 'geo9-same-height',
  similar: 'geo9-similar-areas',
  partWhole: 'geo9-part-whole',
  shaded: 'geo9-shaded-region',
  inscribed: 'geo9-inscribed',
  chanceLength: 'geo9-chance-length',
  chanceArea: 'geo9-chance-area',
  chanceRest: 'geo9-chance-rest',
  // Shared with the polygon and circle modules.
  rect: UNIT9_RULE_IDS.rect,
  regular: UNIT9_RULE_IDS.regular,
  equilateral: UNIT9_RULE_IDS.equilateral,
  circle: CIRCLE_RULE_IDS.area,
} as const

/** The nine mistakes this module adds, in the order of GEO_UNIT9B_MISTAKE_IDS. */
export const RATIO_MISTAKE_IDS = [
  'geo_area_ratio_squared',
  'geo_area_ratio_not_squared',
  'geo_scale_from_areas_not_rooted',
  'geo_area_ratio_reversed',
  'geo_part_to_part_for_whole',
  'geo_region_not_subtracted',
  'geo_region_added',
  'geo_inscribed_side_from_radius',
  'geo_probability_complement',
] as const satisfies readonly GeoMistakeId[]

/** New mistakes only. Reused ids keep the cards they already open. */
export const UNIT9_RATIO_RULE_FOR: Partial<Record<GeoMistakeId, string>> = {
  geo_area_ratio_squared: RATIO_RULE_IDS.sameHeight,
  geo_area_ratio_not_squared: RATIO_RULE_IDS.similar,
  geo_scale_from_areas_not_rooted: RATIO_RULE_IDS.similar,
  geo_area_ratio_reversed: RATIO_RULE_IDS.partWhole,
  geo_part_to_part_for_whole: RATIO_RULE_IDS.partWhole,
  geo_region_not_subtracted: RATIO_RULE_IDS.shaded,
  geo_region_added: RATIO_RULE_IDS.shaded,
  geo_inscribed_side_from_radius: RATIO_RULE_IDS.inscribed,
  geo_probability_complement: RATIO_RULE_IDS.chanceRest,
}

const SAME_HEIGHT: RuleCard = {
  id: RATIO_RULE_IDS.sameHeight,
  title: 'Triangles with the same height, or the same base',
  body: 'The area of a triangle is half the base times the height. When two triangles have the same height, the half and the height are the same for both, so their areas are in the same ratio as their bases. When they have the same base, their areas are in the ratio of their heights. Such triangles are usually not similar, so nothing is squared.',
  example: 'the same height, bases j and k → the areas are in the ratio j to k',
}

const SIMILAR: RuleCard = {
  id: RATIO_RULE_IDS.similar,
  title: 'Areas of similar figures',
  body: 'If two figures are similar with scale factor j to k, then their corresponding sides and their perimeters are in the ratio j to k, and their areas are in the ratio of the squares, j squared to k squared. Going back from the areas, take the square root of each to get the scale factor.',
  example: 'scale factor j to k → perimeters j to k, areas j squared to k squared',
}

const PART_WHOLE: RuleCard = {
  id: RATIO_RULE_IDS.partWhole,
  title: 'Part to part, or part to whole',
  body: 'A figure cut into two pieces gives two kinds of ratio: one piece to the other piece, and one piece to the whole, which is both pieces together. Read which one the question asks for, and keep its order: the measure named first goes on top.',
  example: 'pieces j and k → piece to piece is j to k, piece to whole is j to j plus k',
}

const SHADED: RuleCard = {
  id: RATIO_RULE_IDS.shaded,
  title: 'The area of a shaded region',
  body: 'When the shaded region is a figure with another figure cut out of it, its area is the area of the outer figure minus the area of the figure cut out. Find each area on its own first. If one has π and the other does not, the answer keeps both terms.',
  example: 'outer area P and inside area Q → the shaded area is P minus Q',
}

const INSCRIBED: RuleCard = {
  id: RATIO_RULE_IDS.inscribed,
  title: 'A figure inscribed in a circle',
  body: 'A polygon inscribed in a circle has every vertex on the circle, so the radius reaches from the center to each vertex. For a square, the diagonals are diameters. For a regular hexagon, the radius cuts it into six equilateral triangles, so each side equals the radius. For an equilateral triangle, the side is the radius times the square root of three. A circle inscribed in a square touches every side, so its diameter is the side of the square.',
  example: 'a square inscribed in a circle of radius r → its diagonal is two times r',
}

const CHANCE_LENGTH: RuleCard = {
  id: RATIO_RULE_IDS.chanceLength,
  title: 'Probability on a segment',
  body: 'If a point of a segment is picked at random, the probability that it lands on a smaller segment inside it is the length of the smaller segment over the length of the whole segment.',
  example: 'a piece of length j on a segment of length w → the probability is j over w',
}

const CHANCE_AREA: RuleCard = {
  id: RATIO_RULE_IDS.chanceArea,
  title: 'Probability in a region',
  body: 'If a point of a region is picked at random, the probability that it lands in a smaller region inside it is the area of the smaller region over the area of the whole region. Keep π in the answer when one of the areas has it.',
  example: 'a region of area j inside a region of area w → the probability is j over w',
}

const CHANCE_REST: RuleCard = {
  id: RATIO_RULE_IDS.chanceRest,
  title: 'The probability of the rest',
  body: 'The point lands either in a region or outside it, so the two probabilities add up to one. The probability of landing outside a region is one minus the probability of landing in it.',
  example: 'landing in the region has probability p → landing outside it has probability one minus p',
}

const shared = (id: string): RuleCard => {
  const card = [...AREA_RULES, ...CIRCLE_RULES].find((c) => c.id === id)
  if (!card) throw new Error(`no shared card ${id}`)
  return card
}

export const RATIO_RULES: RuleCard[] = [
  SAME_HEIGHT,
  SIMILAR,
  PART_WHOLE,
  SHADED,
  INSCRIBED,
  CHANCE_LENGTH,
  CHANCE_AREA,
  CHANCE_REST,
  shared(RATIO_RULE_IDS.rect),
  shared(RATIO_RULE_IDS.regular),
  shared(RATIO_RULE_IDS.equilateral),
  shared(RATIO_RULE_IDS.circle),
]
