/**
 * Words shared by the right-triangle templates: format hints, instructions and titles. Like the rule cards they give
 * the method in words and never a number a template can ask for.
 */
import type { RightTriangleQuestion } from '@/content/types'

export const RT_EXACT_HINT = 'Exact: a whole number, a fraction, or a radical such as a√b or a√b/c.'
export const RT_SIDE_HINT = 'A decimal, rounded the way the problem asks. A unit after it is fine.'
export const RT_ANGLE_HINT = 'Degrees, rounded the way the problem asks. The ° is optional.'
export const RT_HINTS = [RT_EXACT_HINT, RT_SIDE_HINT, RT_ANGLE_HINT]

export const RT_INSTRUCTIONS: Record<RightTriangleQuestion, string> = {
  ratios: 'One part at a time: the third side first, then each ratio, exactly.',
  special: 'Give each side exactly, in simplest radical form.',
  side: 'Set your calculator to DEGREE mode, then round the way the problem asks.',
  angle: 'Use the inverse function in DEGREE mode, and round to the nearest tenth of a degree.',
}

export const RT_TITLES: Record<RightTriangleQuestion, string> = {
  ratios: 'Right-triangle ratios',
  special: 'Special right triangles',
  side: 'A side from an angle',
  angle: 'An angle from two sides',
}
