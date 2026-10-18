/**
 * Rule cards for the log properties. No digits, so they cannot spell a generated line.
 */
import type { RuleCard } from '@/content/types'
import type { LogMistakeId } from '@/engine'

export const LP_RULE_IDS = {
  product: 'lp-product',
  quotient: 'lp-quotient',
  power: 'lp-power',
} as const

export const LP_RULES: RuleCard[] = [
  {
    id: LP_RULE_IDS.product,
    title: 'Product rule',
    body: 'The log of a product is the sum of the logs: log(ab) = log a + log b. A sum inside a log does not split, and a sum of logs is the log of a product, not of a sum.',
    example: 'log(ab) → log(a)·log(b) ✗ → log(a) + log(b)',
  },
  {
    id: LP_RULE_IDS.quotient,
    title: 'Quotient rule',
    body: 'The log of a quotient is the difference of the logs: log(a/b) = log a − log b. log a / log b is a different number; that is the change of base.',
    example: 'log(a/b) → log(a)/log(b) ✗ → log(a) − log(b)',
  },
  {
    id: LP_RULE_IDS.power,
    title: 'Power rule',
    body: 'The exponent comes down in front: log(a^n) = n·log a. A number in front goes back up as an exponent of what is inside, not as a factor and not as an exponent on the whole log.',
    example: 'n·log(a) → log(n·a) ✗ → log(a^n)',
  },
]

const QUOTIENT = new Set<LogMistakeId>(['log_quotient_as_quotient'])
const POWER = new Set<LogMistakeId>(['log_power_as_power', 'log_coefficient_as_power', 'log_coefficient_inside', 'log_power_abs'])

export function lpRuleFor(id: string): string {
  if (QUOTIENT.has(id as LogMistakeId)) return LP_RULE_IDS.quotient
  if (POWER.has(id as LogMistakeId)) return LP_RULE_IDS.power
  return LP_RULE_IDS.product
}
