/**
 * Rule cards for the unit circle. They stay on screen while she answers, and the answers here are the special values
 * themselves, so the cards give the method in words (half the hypotenuse, the square root of three, zero on the
 * bottom) and never write a value a template can ask for.
 */
import type { RuleCard } from '@/content/types'

export const UC_RULE_IDS = {
  unitCircle: 'uc-unit-circle',
  special: 'uc-special',
  signs: 'uc-signs',
  reciprocal: 'uc-reciprocal',
  axes: 'uc-axes',
  point: 'uc-point',
} as const

export const UC_RULES: RuleCard[] = [
  {
    id: UC_RULE_IDS.unitCircle,
    title: 'The unit circle',
    body: 'The unit circle has its center at the origin and a radius of one. The terminal side of θ meets it at the point (cos θ, sin θ): cos θ is the x-coordinate and sin θ is the y-coordinate. tan θ = sin θ / cos θ = y/x.',
    example: 'the point at θ: (x, y) = (cos θ, sin θ)',
  },
  {
    id: UC_RULE_IDS.special,
    title: 'Special angles',
    body: 'Work with the reference angle and its right triangle, hypotenuse one. In a 45°-45°-90° triangle the two legs are equal. In a 30°-60°-90° triangle the leg across from 30° is half the hypotenuse, and the leg across from 60° is that short leg times the square root of three.',
    example: 'leg across from 30° = half the hypotenuse',
  },
  {
    id: UC_RULE_IDS.signs,
    title: 'Signs by quadrant',
    body: 'All six functions are positive in Quadrant I. In Quadrant II only sin and csc are, in Quadrant III only tan and cot, and in Quadrant IV only cos and sec: All Students Take Calculus. Find the value for the reference angle, then give it the sign of the quadrant.',
    example: 'Quadrant III: sin θ is negative, tan θ is positive',
  },
  {
    id: UC_RULE_IDS.reciprocal,
    title: 'The reciprocal functions',
    body: 'csc θ = 1/sin θ, sec θ = 1/cos θ, and cot θ = 1/tan θ = cos θ / sin θ. Find sin, cos or tan first, then turn it upside down.',
    example: 'csc θ = r/y when sin θ = y/r',
  },
  {
    id: UC_RULE_IDS.axes,
    title: 'Angles on the axes',
    body: 'When the terminal side lies on an axis, the point on the unit circle is the top, bottom, left or right of the circle: one coordinate is zero and the other is plus or minus one. A ratio with that zero on the bottom has no value; with the zero on top the ratio is zero.',
    example: 'straight up: x is zero, so y/x has no value',
  },
  {
    id: UC_RULE_IDS.point,
    title: 'A point on the terminal side',
    body: 'For a point (x, y) on the terminal side, r = √(x² + y²) is its distance from the origin. Then sin θ = y/r, cos θ = x/r, tan θ = y/x, csc θ = r/y, sec θ = r/x and cot θ = x/y. Keep the signs of x and y, and rationalize a square root in the denominator.',
    example: 'r = √(x² + y²), then sin θ = y/r',
  },
]
