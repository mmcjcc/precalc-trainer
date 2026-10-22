/**
 * Rule cards for optimization with quadratics. They stay on screen while she answers, so they give the method in
 * words and letters and never a number or an equation a template can generate (examples use l and w, letters no
 * problem uses; the review sweep checks every card against 2000 problems of each template).
 */
import type { RuleCard } from '@/content/types'

export const OPT_RULE_IDS = {
  equations: 'opt-equations',
  fences: 'opt-fences',
  final: 'opt-final',
  vertex: 'opt-vertex',
  readBack: 'opt-read-back',
  revenue: 'opt-revenue',
  numbers: 'opt-numbers',
} as const

export const OPT_RULES: RuleCard[] = [
  {
    id: OPT_RULE_IDS.equations,
    title: 'Primary and secondary equations',
    body: 'The primary equation names the quantity the problem makes largest (or smallest), written with both variables: an area is length times width, a revenue is price times the number sold, a product is one number times the other. The secondary equation is the condition that ties the variables together: the total fencing, how sales change with the price, or what the numbers add up to.',
    example: 'primary: the quantity = a formula in both letters; secondary: the condition, in both letters',
  },
  {
    id: OPT_RULE_IDS.fences,
    title: 'Counting the fence',
    body: 'Add up every piece of fence in the figure, one term for each side the fence runs along. A side against a wall needs no fence. Pens in a row share the fences between them: n pens have n + 1 fences across the row, and 2n along it (n along the open side when a wall runs down the other).',
    example: 'n pens in a row: (n + 1)·(side across) + 2n·(side along) = the fencing',
  },
  {
    id: OPT_RULE_IDS.final,
    title: 'The final equation',
    body: 'Solve the secondary equation for one letter and put that expression into the primary equation in place of the letter, so only one variable is left. When you solve, divide every term; when you multiply out, keep every term.',
    example: 'm·w + n·l = c → w = (c − n·l)/m → the primary in l alone',
  },
  {
    id: OPT_RULE_IDS.vertex,
    title: 'The vertex is the largest or smallest value',
    body: 'Write the final equation as ax² + bx + c. Its vertex is at x = −b/(2a): b is the number with x and a the number with x². When a is negative the parabola opens down and the vertex is the maximum; when a is positive it opens up and the vertex is the minimum. On a graphing calculator, graph it and use the maximum (or minimum) tool under 2nd TRACE.',
    example: 'ax² + bx: x = −b/(2a), then put x back in',
  },
  {
    id: OPT_RULE_IDS.readBack,
    title: 'Read the answer back into the question',
    body: 'Put the value you found into the secondary equation to get the other variable, and into the final (or primary) equation for the largest value. Then answer what was asked, with units: a length in feet or meters, an area in square units, money in dollars.',
    example: 'l from the vertex → w from the secondary → the area from l and w',
  },
  {
    id: OPT_RULE_IDS.revenue,
    title: 'Price, sales and revenue',
    body: 'Revenue is the price times the number sold. When each dollar of price increase costs k sales, the number sold is the number sold now minus k for every dollar above the starting price. When the price moves in half-dollar steps, count two steps to the dollar.',
    example: 'number sold = number now − k·(price − starting price)',
  },
  {
    id: OPT_RULE_IDS.numbers,
    title: 'Number problems',
    body: 'Call the numbers x and y, as the problem does. The sentence about them (their sum, a sum with a multiple, how far apart they are) is the secondary equation. What is made largest or smallest (their product, or the sum of their squares) is the primary equation.',
    example: '“twice the first plus the second”: two times the first, plus the second',
  },
]
