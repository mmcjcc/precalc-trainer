/** Words shared by the tan, cot, sec and csc templates: format hints, instructions, titles. No number a template asks for. */
import type { OtherTrigGraphsQuestion } from '@/content/types'

export const OG_PERIOD_HINT = 'Exact: a whole number, a fraction, or a form like kπ/n.'
export const OG_FAMILY_HINT = 'Every one of them, as x = a + kp with k an integer.'
export const OG_LIST_HINT = 'Each x-value in the interval, exactly, separated by commas.'
export const OG_RANGE_HINT = 'A union of two intervals, like (−∞, a] ∪ [b, ∞).'
export const OG_MATCH_HINT = 'Pick one graph.'
export const OG_HINTS = [OG_PERIOD_HINT, OG_FAMILY_HINT, OG_LIST_HINT, OG_RANGE_HINT, OG_MATCH_HINT]

export const OG_INSTRUCTIONS: Record<OtherTrigGraphsQuestion, string> = {
  features: 'One part at a time. x is in radians: give exact answers.',
  match: 'Pick the graph of the equation.',
}

export const OG_TITLES: Record<OtherTrigGraphsQuestion, string> = {
  features: 'Features of tan, cot, sec and csc graphs',
  match: 'Match the graph',
}
