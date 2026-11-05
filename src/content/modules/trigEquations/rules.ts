/**
 * Rule cards for solving a trig equation on [0, 2π).
 * Plain text, and no specific solution (π/6, 1/2, …) that an item can ask for.
 */
import type { RuleCard } from '@/content/types'

export const TE_RULES: RuleCard[] = [
  {
    id: 'te-isolate',
    title: 'Isolate the trig function',
    body:
      'Move the constant to the other side — moving a term changes its sign — then divide by the coefficient in front of the function. You should be left with one function equal to a number.\n' +
      'Sine and cosine only take values from −1 to 1. A result outside that has no angle. Tangent can be any number.',
    example: 'moving a constant across the equals sign flips its sign',
  },
  {
    id: 'te-solve',
    title: 'Every solution in one full turn',
    body:
      'The reference angle is the acute angle whose trig value is the absolute value you isolated. It is written in radians here, as a fraction times pi, not in degrees.\n' +
      'Sine is positive in Quadrants I and II, cosine in I and IV, tangent in I and III. Put the reference angle into each quadrant with the right sign, and keep only the angles from zero up to one full turn.',
    example: 'one matching quadrant is not the whole list',
  },
  {
    id: 'te-factor',
    title: 'A quadratic in one trig function',
    body:
      'Treat sin x (or cos x, or tan x) as the variable and factor. Then set each factor equal to zero and solve.\n' +
      'Do not divide both sides by the function: that throws away the angles where the factor is zero. If a factor asks sine or cosine for a number past 1, that factor has no solution; the other factor’s angles are the whole list.',
    example: 'factor the function out instead of dividing by it',
  },
]

export const TE_RULE_IDS = TE_RULES.map((card) => card.id)
