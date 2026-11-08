/**
 * Rule cards for honors geometry Unit 8 (circles, Jurgensen chapter 9, plus the circle equation). One card per
 * theorem family, in our own words. The places card lists every place an angle can meet a circle and singles none
 * of them out. Examples use letters only, so none can show a generated answer.
 */
import type { RuleCard } from '@/content/types'
import type { GeoMistakeId } from './grade'

export const UNIT8_RULE_IDS = {
  tangent: 'geo8-tangent',
  twoTangents: 'geo8-two-tangents',
  arcs: 'geo8-arcs',
  chords: 'geo8-chords',
  inscribed: 'geo8-inscribed',
  places: 'geo8-angle-places',
  inside: 'geo8-inside-angle',
  outside: 'geo8-outside-angle',
  chordParts: 'geo8-chord-parts',
  secants: 'geo8-secants',
  tangentSecant: 'geo8-tangent-secant',
  equation: 'geo8-equation',
  general: 'geo8-general-equation',
  region: 'geo8-region',
} as const

/** New circle mistakes only. Borrowed ids keep the card they already open. */
export const UNIT8_RULE_FOR: Partial<Record<GeoMistakeId, string>> = {
  geo_tangent_right_vertex: UNIT8_RULE_IDS.tangent,
  geo_circumscribed_adjacent: UNIT8_RULE_IDS.twoTangents,
  geo_major_minor_swapped: UNIT8_RULE_IDS.arcs,
  geo_arcs_not_from_full: UNIT8_RULE_IDS.arcs,
  geo_semicircle_as_quarter: UNIT8_RULE_IDS.arcs,
  geo_inscribed_not_halved: UNIT8_RULE_IDS.inscribed,
  geo_arc_not_doubled: UNIT8_RULE_IDS.inscribed,
  geo_semicircle_right_missed: UNIT8_RULE_IDS.inscribed,
  geo_cyclic_not_supplementary: UNIT8_RULE_IDS.inscribed,
  geo_half_sum_difference_swapped: UNIT8_RULE_IDS.places,
  geo_chord_parts_crossed: UNIT8_RULE_IDS.chordParts,
  geo_secant_part_not_whole: UNIT8_RULE_IDS.secants,
  geo_tangent_not_squared: UNIT8_RULE_IDS.tangentSecant,
  geo_diameter_for_radius: UNIT8_RULE_IDS.equation,
  geo_radius_unsquared: UNIT8_RULE_IDS.equation,
  geo_center_signs_flipped: UNIT8_RULE_IDS.equation,
}

const TANGENT: RuleCard = {
  id: UNIT8_RULE_IDS.tangent,
  title: 'A tangent and a radius',
  body: 'A tangent meets the radius drawn to the point of tangency at a right angle. The radius, the tangent segment, and the line from the center to the outside point are the sides of a right triangle, with the right angle at the point of tangency. The segment is a tangent only when that right angle is there.',
  example: 'radius j and line to the outside point k → the tangent is the remaining side of the right triangle',
}

const TWO: RuleCard = {
  id: UNIT8_RULE_IDS.twoTangents,
  title: 'Two tangents from one point',
  body: 'Two tangent segments drawn from the same outside point are congruent. A quadrilateral drawn around a circle therefore has equal sums of the opposite sides, and the perimeter is twice either sum.',
  example: 'tangent segments j and k from the same point → j = k',
}

const ARCS: RuleCard = {
  id: UNIT8_RULE_IDS.arcs,
  title: 'Central angles and arcs',
  body: 'A central angle has the same measure as its minor arc. The major arc is the long way around and is named with three letters. A diameter cuts the circle into two semicircles. Adjacent arcs around the circle add up to one full turn.',
  example: 'central angle j → minor arc j, and the major arc is a full turn minus j',
}

const CHORDS: RuleCard = {
  id: UNIT8_RULE_IDS.chords,
  title: 'Chords',
  body: 'Congruent chords cut congruent arcs and sit the same distance from the center, and each of those statements runs the other way too. A radius perpendicular to a chord bisects the chord and its arc, so the right triangle runs from the center to the midpoint of the chord and then out half the chord.',
  example: 'chord j, so the leg is half of j → the radius is the hypotenuse of that right triangle',
}

const INSCRIBED: RuleCard = {
  id: UNIT8_RULE_IDS.inscribed,
  title: 'Inscribed angles',
  body: 'An inscribed angle is half the arc it intercepts, so the arc is twice the angle. An angle inscribed in a semicircle is a right angle. Opposite angles of a quadrilateral inscribed in a circle are supplementary.',
  example: 'inscribed angle intercepting arc j → the angle is half of j',
}

const PLACES: RuleCard = {
  id: UNIT8_RULE_IDS.places,
  title: 'Where the angle sits',
  body: 'An angle that meets a circle can sit at the center, on the circle, inside the circle, or outside the circle. Each place has its own rule relating the angle to the arcs it intercepts. The place is what decides the rule.',
  example: 'at the center, on the circle, inside, or outside → use the rule for that place',
}

const INSIDE: RuleCard = {
  id: UNIT8_RULE_IDS.inside,
  title: 'An angle inside the circle',
  body: 'Two chords crossing inside a circle make an angle of half the sum of the arcs intercepted by that angle and by its vertical angle. A tangent and a chord meeting at the point of tangency make an angle of half the intercepted arc.',
  example: 'intercepted arcs j and k inside the circle → the angle is half of j + k',
}

const OUTSIDE: RuleCard = {
  id: UNIT8_RULE_IDS.outside,
  title: 'An angle outside the circle',
  body: 'Two secants, a secant and a tangent, or two tangents drawn from a point outside the circle make an angle of half the difference of the intercepted arcs. With two tangents, those two arcs make one full turn.',
  example: 'far arc j and near arc k → the angle is half of j − k',
}

const PARTS: RuleCard = {
  id: UNIT8_RULE_IDS.chordParts,
  title: 'Parts of crossing chords',
  body: 'When two chords cross inside a circle, the product of the lengths of the parts of one chord equals the product of the lengths of the parts of the other. Each chord is multiplied by its own parts.',
  example: 'parts j and k of one chord, part m of the other → the missing part is j · k / m',
}

const SECANTS: RuleCard = {
  id: UNIT8_RULE_IDS.secants,
  title: 'Two secants from one point',
  body: 'When two secants are drawn from the same outside point, the product of one secant’s outside part and the whole secant equals the same product on the other. The whole secant is the outside part plus the inside part.',
  example: 'outside j and whole secant m → j · m equals the other outside times its whole secant',
}

const TANGENT_SECANT: RuleCard = {
  id: UNIT8_RULE_IDS.tangentSecant,
  title: 'A tangent and a secant',
  body: 'When a tangent and a secant are drawn from the same outside point, the square of the tangent segment equals the outside part of the secant times the whole secant. Finish with the square root when the tangent is the unknown.',
  example: 'outside j and whole secant m → the tangent squared is j · m',
}

const EQUATION: RuleCard = {
  id: UNIT8_RULE_IDS.equation,
  title: 'Standard form of the equation of a circle',
  body: 'The standard form of the equation of a circle with center (h, k) and radius r is (x − h)² + (y − k)² = r². The signs in front of h and k are already the subtraction, and the right side is the radius squared, not the radius and not the diameter.',
  example: 'center (h, k) and radius r → (x − h)² + (y − k)² = r²',
}

const GENERAL: RuleCard = {
  id: UNIT8_RULE_IDS.general,
  title: 'Completing the square',
  body: 'An equation x² + y² + Dx + Ey + F = 0 is a circle when it can be written in standard form. Half of D and half of E, with the signs changed, are the coordinates of the center. The radius is the square root of the number left on the right after the square is completed.',
  example: 'x² + y² + Dx + Ey + F = 0 → the center is the opposite of half of D and of E',
}

const REGION: RuleCard = {
  id: UNIT8_RULE_IDS.region,
  title: 'Inside, on, or outside',
  body: 'Compare the distance from the center to the point with the radius. The point is on the circle when the distances are equal, in the interior when it is closer than the radius, and in the exterior when it is farther. The comparison uses the radius, not the diameter.',
  example: 'distance d and radius r → on the circle when d = r',
}

export const TANGENT_RULES: RuleCard[] = [TANGENT, TWO, ARCS, CHORDS]
export const ANGLE_RULES_8: RuleCard[] = [INSCRIBED, PLACES, INSIDE, OUTSIDE]
export const MEASURE_RULES: RuleCard[] = [PARTS, SECANTS, TANGENT_SECANT, EQUATION, GENERAL, REGION]
