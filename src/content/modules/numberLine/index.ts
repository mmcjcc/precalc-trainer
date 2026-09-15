import { registerModule } from '@/content/registry'
import type { ModuleDef, RuleCard } from '@/content/types'
import { numberLineReadTemplate } from './read'

export const NL_RULES: RuleCard[] = [
  {
    id: 'brackets',
    title: 'Bracket or parenthesis?',
    body: 'A closed (filled) dot means the endpoint is included → square bracket [ ]. An open dot means it is not → parenthesis ( ). In set-builder that is ≤ vs <.',
    example: 'closed dot at 2, shaded left:  (-inf, 2]   {x | x <= 2}',
  },
  {
    id: 'infinity',
    title: '∞ always gets a parenthesis',
    body: 'You never reach infinity, so it is never included. Write (-inf, 3] or [3, inf) — never a bracket next to ∞.',
    example: '[3, inf]  ✗   →   [3, inf)  ✓',
  },
  {
    id: 'point',
    title: 'A single point is {a}',
    body: 'One lone dot is a set with one element. Write it with braces: {6}. Not [6] and not [6, 6].',
    example: 'dot at 6:  {6}   {x | x = 6}',
  },
  {
    id: 'union',
    title: '∪ joins separate pieces',
    body: 'Each shaded piece is its own interval. Write them left to right with ∪ (type U) between them. In set-builder, join the conditions with "or".',
    example: '(-inf, -2) U [1, 4) U {6}   {x | x < -2 or 1 <= x < 4 or x = 6}',
  },
  {
    id: 'set-builder',
    title: 'Set-builder notation',
    body: 'Read {x | ...} as "the set of x such that ...". A segment is a chain: 1 <= x < 4. A ray is one inequality: x < -2. Use "or" between pieces.',
    example: '[1, 4)  →  {x | 1 <= x < 4}',
  },
]

export const numberLineModule: ModuleDef = {
  id: 'numberLine',
  title: 'Number line → notation',
  blurb: 'Read a shaded number line and write it two ways: interval notation and set-builder notation.',
  order: 1,
  templates: [numberLineReadTemplate],
  ruleCards: NL_RULES,
  // Answer-only kind: there is no worked column, so progress is a single stage reached on submit.
  progress: () => ({ stage: 0, total: 1, label: 'write both notations', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(numberLineModule)
