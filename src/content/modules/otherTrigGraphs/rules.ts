/**
 * Rule cards for the graphs of tan, cot, sec and csc. Facts named in letters (period π/B or 2π/B, x = a + kp); π only
 * glued to a letter or a slash, so no card shows a period, an asymptote, a zero or a range a template asks for.
 */
import type { RuleCard } from '@/content/types'

export const OG_RULE_IDS = {
  period: 'og-period',
  asymptotes: 'og-asymptotes',
  zeros: 'og-zeros',
  range: 'og-range',
  match: 'og-match',
} as const

export const OG_RULES: RuleCard[] = [
  {
    id: OG_RULE_IDS.period,
    title: 'Periods of tan, cot, sec and csc',
    body: 'tan and cot repeat every half turn, so the period of y = A tan(Bx − C) + D is π/B. sec and csc repeat every full turn, like cos and sin: their period is 2π/B.',
    example: 'tan and cot: π/B; sec and csc: 2π/B',
  },
  {
    id: OG_RULE_IDS.asymptotes,
    title: 'Vertical asymptotes',
    body: 'tan = sin/cos and sec = one over cos have no value where cos is zero; cot = cos/sin and csc = one over sin have none where sin is zero. Set the inside, Bx − C, equal to the angles where that function is zero and solve for x. They repeat, so write them all as a family x = a + kp, with k any integer and p the distance between neighbours.',
    example: 'x = a + kp, k an integer',
  },
  {
    id: OG_RULE_IDS.zeros,
    title: 'Zeros of tan and cot',
    body: 'With no vertical shift, tan is zero where sin of the inside is zero, and cot where cos of the inside is zero: halfway between neighbouring asymptotes.',
    example: 'a zero halfway between two asymptotes',
  },
  {
    id: OG_RULE_IDS.range,
    title: 'The range of sec and csc',
    body: 'sec and csc never take a height strictly between their turning points. For y = A sec(Bx − C) + D the range is (−∞, D − |A|] ∪ [D + |A|, ∞), and the same for csc. tan and cot take every height.',
    example: 'two pieces: up to D − |A|, and from D + |A| on',
  },
  {
    id: OG_RULE_IDS.match,
    title: 'Which graph is it?',
    body: 'Check one thing at a time: the period (the distance between neighbouring asymptotes, or one full wave), where a cycle starts (the shift, and its direction), which way the graph goes there (the sign of A), and the vertical shift. Each wrong graph gets one of them wrong.',
    example: 'period, then shift, then the sign of A, then the vertical shift',
  },
]
