/**
 * Rule cards for the inverse trig functions. They NAME the facts: the domains and ranges in symbols ([−1, 1],
 * [−π/2, π/2], [0, π], (−π/2, π/2)), which is why no inverseTrig answer is an end of a range (0, ±π/2, π) or ±1
 * (generators and the 2000-seed review check; arctan(1) is asked, and its answer is π/4). Examples use a letter (u).
 */
import type { RuleCard } from '@/content/types'

export const IT_RULE_IDS = {
  ranges: 'it-ranges',
  special: 'it-special',
  outside: 'it-outside',
  calculator: 'it-calculator',
  cancel: 'it-cancel',
  triangle: 'it-triangle',
  algebraic: 'it-algebraic',
} as const

export const IT_RULES: RuleCard[] = [
  {
    id: IT_RULE_IDS.ranges,
    title: 'The inverse functions and their ranges',
    body: 'arcsin x, also written sin⁻¹ x, is the angle in [−π/2, π/2] whose sine is x, for x in [−1, 1]. arccos x is the angle in [0, π] whose cosine is x, for x in [−1, 1]. arctan x is the angle in (−π/2, π/2) whose tangent is x, for every x.',
    example: 'arcsin and arctan: the right half of the unit circle; arccos: the top half',
  },
  {
    id: IT_RULE_IDS.special,
    title: 'Exact values',
    body: 'Find the angle in the range whose sine, cosine or tangent is the input, from the unit circle’s special angles. A negative input gives a negative angle for arcsin and arctan, and an angle in Quadrant II for arccos.',
    example: 'arccos(−u) = a half turn minus arccos(u)',
  },
  {
    id: IT_RULE_IDS.outside,
    title: 'Inputs that have no angle',
    body: 'A sine or a cosine is never more than one or less than minus one, so arcsin and arccos only take inputs in [−1, 1]. For any other input there is no angle at all. arctan takes every input.',
    example: 'arcsin(u) for u past one: no angle at all',
  },
  {
    id: IT_RULE_IDS.calculator,
    title: 'On the calculator',
    body: 'In RADIAN mode, 2nd SIN gives sin⁻¹, and 2nd COS and 2nd TAN the others. SIN on its own gives the sine of a number, and one over SIN its reciprocal: neither is the angle.',
    example: 'sin⁻¹(u): 2nd SIN, in RADIAN mode',
  },
  {
    id: IT_RULE_IDS.cancel,
    title: 'Undoing in the right order',
    body: 'sin(arcsin u) = u for every u in [−1, 1], and for no other u: outside, arcsin u is not there to start with. arcsin(sin θ) = θ only when θ is in [−π/2, π/2]; otherwise find sin θ first, then the angle in the range with that sine. The same goes for arccos with [0, π] and arctan with (−π/2, π/2).',
    example: 'arcsin(sin θ), θ in Quadrant II: a half turn minus θ',
  },
  {
    id: IT_RULE_IDS.triangle,
    title: 'A reference triangle',
    body: 'For cos(arctan(u)), let θ = arctan(u): its range puts θ in a quadrant, and tan θ = u gives two sides of the point on its terminal side (y and x, with their signs). Find the third with x² + y² = r², then read cos θ = x/r off the point.',
    example: 'θ = arctan(u): y = u and x = 1, then r from x² + y² = r²',
  },
  {
    id: IT_RULE_IDS.algebraic,
    title: 'An expression in x',
    body: 'For cos(arcsin u), let θ = arcsin u: sin θ = u, so draw a right triangle with opposite side u and hypotenuse 1. The Pythagorean theorem gives the adjacent side, a square root, positive because θ is in Quadrant I or IV. Then cos θ is adjacent over hypotenuse, and the answer has no trig functions left in it.',
    example: 'opposite u, hypotenuse 1: the adjacent side from a² + b² = c²',
  },
]
