/**
 * Words shared by the sinusoid templates: format hints, instructions and titles. Like the rule cards they give the
 * method in words and letters and never a number a template can ask for.
 */
import type { SinusoidsQuestion } from '@/content/types'

export const SG_AMPLITUDE_HINT = 'A positive number: a whole number or a fraction.'
export const SG_PERIOD_HINT = 'Exact: a whole number, a fraction, or a form like kπ/n.'
export const SG_SHIFT_HINT = 'A size and a direction, like a/b right or a/b left. If there is no shift, say so in words.'
export const SG_MIDLINE_HINT = 'The horizontal line y = a number.'
export const SG_RANGE_HINT = 'An interval of heights, like [a, b].'
export const SG_POINTS_HINT = 'Five exact points (x, y), separated by commas, in any order.'
export const SG_EQUATION_HINT = 'y = a formula in x. Any equivalent equation is right, with sine or cosine.'
export const SG_MODEL_HINT = 'The model: its name, =, and a formula in t. Any equivalent formula is right.'
export const SG_DECIMAL_HINT = 'A decimal, rounded the way the part asks. A unit after it is fine.'
export const SG_HINTS = [SG_AMPLITUDE_HINT, SG_PERIOD_HINT, SG_SHIFT_HINT, SG_MIDLINE_HINT, SG_RANGE_HINT, SG_POINTS_HINT, SG_EQUATION_HINT, SG_MODEL_HINT, SG_DECIMAL_HINT]

export const SG_INSTRUCTIONS: Record<SinusoidsQuestion, string> = {
  features: 'One part at a time. x is in radians: give exact answers.',
  equation: 'Write one equation. Any equivalent form is right, with sine or with cosine.',
  model: 'One part at a time. Use your calculator in RADIAN mode, and round the way each part asks.',
}

export const SG_TITLES: Record<SinusoidsQuestion, string> = {
  features: 'Features of a sine or cosine graph',
  equation: 'An equation for a sinusoid',
  model: 'Sinusoidal models',
}
