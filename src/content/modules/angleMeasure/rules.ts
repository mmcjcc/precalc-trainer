/**
 * Rule cards for angles and radian measure. They stay on screen while she answers, so they use letters and the
 * fixed facts of a turn (180°, 360°, π, 2π), which no template asks for: conversions skip ±180°, ±360°, ±π and ±2π,
 * and a coterminal or reference angle is never on an axis.
 */
import type { RuleCard } from '@/content/types'

export const AM_RULE_IDS = {
  radians: 'am-radians',
  coterminal: 'am-coterminal',
  quadrant: 'am-quadrant',
  reference: 'am-reference',
  arc: 'am-arc',
} as const

export const AM_RULES: RuleCard[] = [
  {
    id: AM_RULE_IDS.radians,
    title: 'Degrees and radians',
    body: 'A full turn is 360°, or 2π radians, so a half turn is 180°, or π radians. Degrees to radians: multiply by π/180 and simplify the fraction in front of π. Radians to degrees: multiply by 180/π, and the π cancels.',
    example: 'd° = d · π/180 radians; kπ radians = k · 180°',
  },
  {
    id: AM_RULE_IDS.coterminal,
    title: 'Coterminal angles',
    body: 'Angles in standard position that end on the same terminal side are coterminal: they differ by whole turns. Add or subtract 360° (or 2π) as many times as it takes to land in [0°, 360°) (or [0, 2π)). A negative angle turns clockwise, so add turns to it.',
    example: 'θ, θ + 360°, θ − 360°: one terminal side',
  },
  {
    id: AM_RULE_IDS.quadrant,
    title: 'Where the terminal side lies',
    body: 'Start on the positive x-axis and turn: counterclockwise for a positive angle, clockwise for a negative one. The first quarter turn is Quadrant I, then II, III and IV going counterclockwise. An angle that stops on an axis is in no quadrant.',
    example: 'find the coterminal angle in one turn, then read off its quarter',
  },
  {
    id: AM_RULE_IDS.reference,
    title: 'The reference angle',
    body: 'The reference angle is the acute angle between the terminal side and the x-axis. Find the coterminal angle θ in one turn, then: Quadrant I, θ itself; Quadrant II, 180° − θ; Quadrant III, θ − 180°; Quadrant IV, 360° − θ. In radians use π and 2π.',
    example: 'Quadrant III: θ − 180°, never 180° − θ',
  },
  {
    id: AM_RULE_IDS.arc,
    title: 'Arc length and sector area',
    body: 'With the central angle θ in radians, the arc length is s = rθ and the sector area is A = ½r²θ. An angle given in degrees has to be changed to radians first.',
    example: 'θ in degrees: s = r · θ · π/180',
  },
]
