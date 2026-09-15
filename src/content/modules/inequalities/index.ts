import { registerModule } from '@/content/registry'
import type { ModuleDef, RuleCard } from '@/content/types'
import { isolatedVariableLine, nextFromPath, progressFromPath } from '../progress'
import { compoundTemplate } from './compound'
import { distributeTemplate } from './distribute'
import { fractionTemplate } from './fraction'
import { linearTemplate } from './linear'

export const INEQ_RULES: RuleCard[] = [
  {
    id: 'add-sub',
    title: 'Add or subtract both sides',
    body: 'Adding or subtracting the same number never flips < ≤ > ≥.',
    example: '3x - 2 <= 7  →  3x <= 9',
  },
  {
    id: 'mul-div',
    title: 'Multiply or divide both sides',
    body: 'A positive multiplier keeps the inequality. A negative one flips it.',
    example: '2x <= 10  →  x <= 5',
  },
  {
    id: 'flip-negative',
    title: 'Negative coefficient flips',
    body: 'Multiply/divide by a negative → flip the inequality. Add/subtract never flips.',
    example: '-14 <= -14x  →  1 >= x',
  },
  {
    id: 'distribute',
    title: 'Distribute',
    body: 'a(b+c) = ab + ac. Every term inside the parentheses gets the multiplier.',
    example: '-3(x-2)  →  -3x + 6',
  },
  {
    id: 'reciprocal',
    title: 'Undo a fraction coefficient with its reciprocal',
    body: 'A coefficient is multiplication, so undo it by multiplying both sides by the reciprocal. (3/5)·(5/3) = 1. If the coefficient is negative, the reciprocal is negative too — flip.',
    example: '(3/5)y <= 6  →  y <= 10        -(3/5)y <= 6  →  y >= -10',
  },
  {
    id: 'compound',
    title: 'Compound inequality: three parts',
    body: 'a < E <= b is two inequalities at once. Whatever you do to the middle, do to both ends. Dividing by a negative flips BOTH symbols; then rewrite the chain so the smaller number is on the left.',
    example: '-3 < -3x <= 6  →  1 > x >= -2  →  -2 <= x < 1',
  },
]

export const inequalitiesModule: ModuleDef = {
  id: 'inequalities',
  title: 'Linear inequalities',
  blurb: 'Isolate the variable. Watch the inequality symbol when you multiply or divide by a negative.',
  order: 2,
  templates: [linearTemplate, distributeTemplate, fractionTemplate, compoundTemplate],
  ruleCards: INEQ_RULES,
  progress: progressFromPath,
  nextStep: nextFromPath,
  solved: (instance, line) => isolatedVariableLine(line, instance.vars[0] ?? 'x'),
}

registerModule(inequalitiesModule)
