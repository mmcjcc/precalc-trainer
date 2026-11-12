/**
 * Words shared by the oblique-triangle templates: format hints, instructions and titles. Like the rule cards they give
 * the method in words and letters and never a number a template can ask for.
 */
import type { ObliqueQuestion } from '@/content/types'

export const OT_SIDE_HINT = 'A decimal, rounded to the nearest tenth.'
export const OT_ANGLE_HINT = 'Degrees, rounded to the nearest tenth. The ° is optional.'
export const OT_THIRD_HINT = 'A whole number of degrees. The ° is optional.'
export const OT_AREA_HINT = 'A decimal, rounded to the nearest tenth. Square units are understood.'
export const OT_HINTS = [OT_SIDE_HINT, OT_ANGLE_HINT, OT_THIRD_HINT, OT_AREA_HINT]

export const OT_INSTRUCTIONS: Record<ObliqueQuestion, string> = {
  sines: 'Set your calculator to DEGREE mode. Find the third angle first, then the side, rounded to the nearest tenth.',
  ambiguous: 'Compare side a with the height h = b sin A to count the triangles, then find B in DEGREE mode, to the nearest tenth of a degree.',
  cosines: 'Use the law of cosines in DEGREE mode, and round to the nearest tenth.',
  area: 'Pick the area formula that fits what you know, and round to the nearest tenth.',
  choose: 'Decide which law starts the solution, then find the first unknown in DEGREE mode, rounded to the nearest tenth.',
}

export const OT_TITLES: Record<ObliqueQuestion, string> = {
  sines: 'The law of sines',
  ambiguous: 'The ambiguous case (SSA)',
  cosines: 'The law of cosines',
  area: 'The area of a triangle',
  choose: 'Which law starts?',
}

/** The note for a plain wrong number. */
export const OT_WRONG_SIDE = 'That does not match. Check which side goes with which angle, and that the calculator is in DEGREE mode.'
export const OT_WRONG_ANGLE = 'That is not the angle. Check the formula, which side is across from the angle, and DEGREE mode.'
export const OT_WRONG_AREA = 'That is not the area. Check the formula and each number you put in.'
