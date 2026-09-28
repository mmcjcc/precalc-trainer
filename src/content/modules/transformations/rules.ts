import type { RuleCard } from '@/content/types'

/** Rule cards for transformations, in this module's own words. */
export const TR_RULE_IDS = {
  shift: 'tr-shift',
  hScale: 'tr-h-scale',
  vScale: 'tr-v-scale',
  reflect: 'tr-reflect',
  factor: 'tr-factor',
  point: 'tr-point',
} as const

export const TR_RULES: RuleCard[] = [
  {
    id: TR_RULE_IDS.shift,
    title: 'f(x − h) moves right h',
    body: 'The sign inside f does the opposite of what it looks like. f(x − h) moves RIGHT h, and f(x + h) moves left h. A number added after f moves UP: f(x) + k is up k, and f(x) − k is down k.',
    example: 'f(x − 3) + 1 → right 3, up 1, not left 3',
  },
  {
    id: TR_RULE_IDS.hScale,
    title: 'f(bx) squeezes toward the y-axis',
    body: 'A number multiplying x inside f divides the x-values. f(bx) squeezes toward the y-axis by 1/b: f(2x) is a horizontal compression by 1/2, and f(x/2) is a horizontal stretch by 2.',
    example: 'f(2x) → compress horizontally by 1/2, not stretch by 2',
  },
  {
    id: TR_RULE_IDS.vScale,
    title: 'a·f(x) stretches vertically by a',
    body: 'The number in front of f multiplies every height, and it stays in front. a·f(x) stretches vertically by a when a > 1, and compresses by a when 0 < a < 1. Inside the parentheses, that number would change x instead.',
    example: '2f(x) → stretch vertically by 2. (1/2)f(x) → compress vertically by 1/2',
  },
  {
    id: TR_RULE_IDS.reflect,
    title: 'Where the minus sign sits',
    body: '−f(x) reflects over the x-axis: the minus is in front, so the outputs flip. f(−x) reflects over the y-axis: the minus is on x, so the inputs flip. A minus in the formula is its own step.',
    example: '−f(x) → reflect over the x-axis. f(−x) → reflect over the y-axis',
  },
  {
    id: TR_RULE_IDS.factor,
    title: 'Factor the inside first',
    body: 'Factor the inside before you read the shift. f(2x − 6) = f(2(x − 3)), so it moves right 3, not 6. The 6 is the shift times the factor in front of x.',
    example: 'f(2x − 6) → right 3, not right 6',
  },
  {
    id: TR_RULE_IDS.point,
    title: 'Map a point backwards, then forwards',
    body: 'To map a point, x goes through the inside backwards (x/b + h) and y goes through the outside forwards (a·y + k). Divide x by b before you add h. Multiply y by a before you add k. a acts on y, and b acts on x.',
    example: '(4, 16) on f, g(x) = −2f(2(x − 3)) + 1 → (5, −31)',
  },
]
