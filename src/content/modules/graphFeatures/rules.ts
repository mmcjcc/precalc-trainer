import type { RuleCard } from '@/content/types'

/**
 * Rule cards for reading a graph, in this module's own words. Ids are stable: the flow points
 * hint rung 2 at one of them. "Which joiner?" is the card for U written between points.
 */
export const GF_RULE_IDS = {
  joiner: 'gf-joiner',
  xValues: 'gf-x-values',
  open: 'gf-open',
  infinity: 'gf-infinity',
  direction: 'gf-direction',
  unbounded: 'gf-unbounded',
  globalLocal: 'gf-global-local',
  points: 'gf-points',
} as const

export const GF_RULES: RuleCard[] = [
  {
    id: GF_RULE_IDS.joiner,
    title: 'Which joiner?',
    body: 'U joins intervals (sets of numbers). "or" joins conditions in set-builder notation. "and" or a comma lists points. They are not interchangeable — U between two points reads as two intervals, and one of those can run backwards.',
    example: '(-inf, -5] U (2, 7]     {x | x <= -5 or 2 < x <= 7}     (-2.5, -5.5) and (7.25, -9.25)',
  },
  {
    id: GF_RULE_IDS.xValues,
    title: 'Intervals use x-values',
    body: 'Increasing and decreasing are read along the x-axis: the inputs where the graph climbs or falls as you move left to right. The y-coordinate is the height of a labelled point, not an endpoint of those intervals.',
    example: 'turns at x = -2.5, 2, 7.25 → increasing (-2.5, 2) U (7.25, inf), not the heights',
  },
  {
    id: GF_RULE_IDS.open,
    title: 'Parentheses at a turning point',
    body: 'At a labelled turn the graph is flat for an instant, so that x is not strictly increasing or strictly decreasing. Leave it out: parentheses, not brackets.',
    example: '[-2.5, 2] ✗ → (-2.5, 2)',
  },
  {
    id: GF_RULE_IDS.infinity,
    title: '∞ always gets a parenthesis',
    body: 'The graph never arrives at infinity, so ∞ is never included. Write (-inf, -2.5) or (7.25, inf) — never a bracket next to ∞.',
    example: '[-inf, -2.5) ✗ → (-inf, -2.5)     (7.25, inf] ✗ → (7.25, inf)',
  },
  {
    id: GF_RULE_IDS.direction,
    title: 'Climbing or falling?',
    body: 'Read left to right. Where the curve climbs, it is increasing. Where it falls, it is decreasing. Swapping the two words swaps the two intervals.',
    example: 'a climb from x = -2.5 to x = 2 is increasing (-2.5, 2), not decreasing',
  },
  {
    id: GF_RULE_IDS.unbounded,
    title: 'No highest point on a ray',
    body: 'A global max is the single highest point the graph reaches. If either end climbs forever, y goes to +∞ and there is no global max — write none. If either end falls forever, y goes to −∞ and there is no global min.',
    example: 'both ends rising → global max none, not the local max',
  },
  {
    id: GF_RULE_IDS.globalLocal,
    title: 'A global max or min is also local',
    body: 'If the graph actually reaches a highest or lowest point, that point is a turning point, so it is local too. It goes in the global box and in the local list.',
    example: 'global min (7.25, -9.25) is also a local min: (-2.5, -5.5) and (7.25, -9.25)',
  },
  {
    id: GF_RULE_IDS.points,
    title: 'Only the labelled turns, (x, y)',
    body: 'A local max or min is one of the labelled turning points. Write it (x, y): how far across, then how high. A point that is not a turn does not belong, and swapping the coordinates names a different point.',
    example: '(3.25, 2) ✗ → (2, 3.25)     (0, 0) is not a turn',
  },
]
