/**
 * Words shared by the inverse-function templates: format hints, instructions, titles. No number a template asks for,
 * and never the words the "No value" button enters.
 */
import type { InverseTrigQuestion } from '@/content/types'

export const IT_RAD_HINT = 'An exact angle in radians, like kπ/n. If there is no such angle, use the button.'
export const IT_DEG_HINT = 'An exact angle in degrees; the ° is optional. If there is no such angle, use the button.'
export const IT_DECIMAL_HINT = 'A decimal in radians, rounded the way the problem asks.'
export const IT_VALUE_HINT = 'Exact: a whole number, a fraction, or a radical such as a√b/c. If it has none, use the button.'
export const IT_SIDE_HINT = 'Exact: a whole number or a radical such as a√b, with its sign.'
export const IT_RATIO_HINT = 'Exact: a whole number, a fraction, or a radical such as a√b/c.'
export const IT_QUADRANT_HINT = 'Pick one quadrant.'
export const IT_EXPRESSION_HINT = 'An expression in x with no trig functions: a radical, a fraction, or both.'
export const IT_HINTS = [IT_RAD_HINT, IT_DEG_HINT, IT_DECIMAL_HINT, IT_VALUE_HINT, IT_SIDE_HINT, IT_RATIO_HINT, IT_QUADRANT_HINT, IT_EXPRESSION_HINT]

export const IT_INSTRUCTIONS: Record<InverseTrigQuestion, string> = {
  evaluate: 'Give the value in the unit the problem asks for. If there is no such angle, use the button under the box.',
  compose: 'One part at a time, exactly. If the expression cannot be worked out at all, use the button under the box.',
}

export const IT_TITLES: Record<InverseTrigQuestion, string> = {
  evaluate: 'Values of the inverse functions',
  compose: 'Compositions with inverse functions',
}
