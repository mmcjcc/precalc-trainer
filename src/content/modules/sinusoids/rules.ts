/**
 * Rule cards for the graphs of sine and cosine. They stay on the module page and in the hints while she answers, so
 * they NAME the facts in letters (amplitude |A|, period 2π/B, phase shift C/B, midline y = D) and never write a number a
 * template can ask for: π appears only glued to a letter or a slash (2π/B, C/B).
 */
import type { RuleCard } from '@/content/types'

export const SG_RULE_IDS = {
  amplitude: 'sg-amplitude',
  period: 'sg-period',
  shift: 'sg-shift',
  keyPoints: 'sg-key-points',
  fromGraph: 'sg-from-graph',
  model: 'sg-model',
} as const

export const SG_RULES: RuleCard[] = [
  {
    id: SG_RULE_IDS.amplitude,
    title: 'Amplitude, midline and range',
    body: 'In y = A sin(B(x − C)) + D and y = A cos(B(x − C)) + D the amplitude is |A|: how far the graph rises above its midline and sinks below it. The midline is the horizontal line y = D, halfway between the highest and lowest points, and the range is [D − |A|, D + |A|]. A negative A flips the graph over its midline.',
    example: 'highest point at height D + |A|, lowest at D − |A|',
  },
  {
    id: SG_RULE_IDS.period,
    title: 'The period',
    body: 'B squeezes or stretches the graph. One full cycle of sin or cos takes a length of 2π/B: the period. A bigger B makes the cycles shorter.',
    example: 'period = 2π/B',
  },
  {
    id: SG_RULE_IDS.shift,
    title: 'The phase shift',
    body: 'In y = A sin(B(x − C)) + D the graph is shifted C: to the right when C is positive, to the left when it is negative. Written y = A sin(Bx − C) + D, factor B out of the inside first: Bx − C = B(x − C/B), so the phase shift is C/B. A cycle starts where the inside is zero.',
    example: 'sin(Bx − C): phase shift C/B',
  },
  {
    id: SG_RULE_IDS.keyPoints,
    title: 'Five key points',
    body: 'One period starts at the phase shift and ends one period later. Split it into four equal steps of a quarter period. From the start, sin goes midline, highest, midline, lowest, midline; cos goes highest, midline, lowest, midline, highest. A negative A swaps the highest and the lowest.',
    example: 'x-steps of a quarter period: the period divided by four',
  },
  {
    id: SG_RULE_IDS.fromGraph,
    title: 'An equation from a graph',
    body: 'Read a highest point and the next lowest point. The midline D is the average of their heights and the amplitude is half their difference. From a highest point to the next lowest is half a period, so the period is twice that distance, and B = 2π/period. A cosine starts its cycle at a highest point, so use that x as the shift.',
    example: 'y = A cos(B(x − x of a highest point)) + D',
  },
  {
    id: SG_RULE_IDS.model,
    title: 'Sinusoidal models',
    body: 'The midline is the average of the highest and lowest values, and the amplitude is half their difference: a wheel’s radius, not its diameter. For a period P, B = 2π/P. Start the curve where the story starts: cos at a high point, −cos at a low point, sin on the midline going up. Work it out in RADIAN mode, and for a time use intersect.',
    example: 'starts at the bottom: h = midline − radius · cos(Bt)',
  },
]
