/**
 * Rule cards for honors geometry Unit 7, second half (Jurgensen 8-5 to 8-7): the tangent, sine and cosine ratios,
 * and angles of elevation and depression. Examples use letters and no button text ("sine ratio" is a choice, and
 * "cosine ratio" contains it). No digit a part can have as its answer.
 */
import type { RuleCard } from '@/content/types'
import type { GeoMistakeId } from './grade'

export const UNIT7B_RULE_IDS = {
  ratios: 'geo7b-ratios',
  side: 'geo7b-side',
  angle: 'geo7b-angle',
  elevation: 'geo7b-elevation',
  two: 'geo7b-two',
} as const

/** The two-observation slip opens the two-observation card, and only that module lists the card. */
export const UNIT7B_RULE_FOR: Partial<Record<GeoMistakeId, string>> = {
  geo_distances_combined: UNIT7B_RULE_IDS.two,
}

export const TRIG_RATIO_RULES: RuleCard[] = [
  {
    id: UNIT7B_RULE_IDS.ratios,
    title: 'The tangent, sine, and cosine ratios',
    body: 'For an acute angle of a right triangle, the tangent ratio is opposite over adjacent, the sine ratio is opposite over hypotenuse, and the cosine ratio is adjacent over hypotenuse. That is SOH-CAH-TOA. Opposite is the side across from the angle, adjacent is the leg that touches it, and the hypotenuse is across from the right angle. Put the TI-84 in DEGREE mode before you use it. Write a fraction in lowest terms, and a radical in simplest form.',
    example: 'opposite j, adjacent k, hypotenuse l → tan = j/k, sin = j/l, cos = k/l',
  },
  {
    id: UNIT7B_RULE_IDS.side,
    title: 'A side from a trigonometric ratio',
    body: 'Name the side you know and the side you want from the acute angle: opposite, adjacent, or hypotenuse. The ratio of the angle equals the side on top over the side on the bottom. Multiply when the unknown is on top, and divide when it is on the bottom. Put the TI-84 in DEGREE mode.',
    example: 'unknown on the bottom → divide the known side by the ratio',
  },
  {
    id: UNIT7B_RULE_IDS.angle,
    title: 'An angle from two sides',
    body: 'An acute angle is the inverse of the ratio of two sides: opposite over hypotenuse, adjacent over hypotenuse, or opposite over adjacent. On the TI-84 that is 2nd SIN, 2nd COS, or 2nd TAN, and the calculator has to be in DEGREE mode. The ratio itself is not the angle.',
    example: 'opposite j and hypotenuse l → the angle is the inverse of j/l',
  },
]

export const ELEVATION_RULES: RuleCard[] = [
  {
    id: UNIT7B_RULE_IDS.elevation,
    title: 'Angles of elevation and depression',
    body: 'An angle of elevation is measured up from the horizontal to a line of sight. An angle of depression is measured down from the horizontal to a line of sight. The two are equal alternate interior angles where a horizontal at the observer meets a horizontal at the object, so both are measured from the horizontal, never from the vertical. Put the TI-84 in DEGREE mode, then use the tangent, sine, or cosine ratio.',
    example: 'the line of sight drops from the horizontal → that angle equals the angle in the triangle at the object',
  },
  {
    id: UNIT7B_RULE_IDS.two,
    title: 'Two angles of elevation',
    body: 'Two observations of the same top give two right triangles that share the height. On the same side of the tower, the farther distance is the closer one plus the space between the points, so the tangents are subtracted. On opposite sides, the two distances add up to the space between the observers, so the tangents are added.',
    example: 'both points on the same side → the farther distance is the closer one plus the space between',
  },
  TRIG_RATIO_RULES[1]!,
  TRIG_RATIO_RULES[2]!,
]
