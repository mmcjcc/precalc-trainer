/**
 * Rule cards for logarithms and exponential form. No digits: a generated answer is a number,
 * and these cards stay on screen while she can still answer.
 */
import type { RuleCard } from '@/content/types'
import type { LogMistakeId } from '@/engine'

export const LF_RULE_IDS = {
  definition: 'lf-definition',
  inverse: 'lf-inverse',
  change: 'lf-change',
} as const

export const LF_RULES: RuleCard[] = [
  {
    id: LF_RULE_IDS.definition,
    title: 'A logarithm is an exponent',
    body: 'log base b of a equals c means b to the power c equals a. The base stays the base, and the log equals the exponent, not the result.',
    example: 'log_b(a) → a/b ✗ → c, because b^c = a',
  },
  {
    id: LF_RULE_IDS.inverse,
    title: 'A power and a log undo each other',
    body: 'e to the power ln(a) is a, and ln of e to the power a is a. The same is true for ten and log. The minus in a negative exponent moves the power to the denominator; it does not make the value negative.',
    example: 'e^(ln a) → ln(a) ✗ → a',
  },
  {
    id: LF_RULE_IDS.change,
    title: 'Change of base',
    body: 'log base b of a equals log(a)/log(b), and also ln(a)/ln(b). The base goes on the bottom. log is the LOG key (base ten) and ln is the LN key (base e).',
    example: 'log_b(a) → log(b)/log(a) ✗ → log(a)/log(b)',
  },
]

const CHANGE = new Set<LogMistakeId>(['log_change_base_inverted', 'log_quotient_as_quotient', 'log_ln_confused'])
const INVERSE = new Set<LogMistakeId>([
  'log_exp_negative_exponent',
  'log_exp_sum_split',
  'log_exp_power_added',
  'log_exp_coefficient_base',
])

export function lfRuleFor(id: string): string {
  if (CHANGE.has(id as LogMistakeId)) return LF_RULE_IDS.change
  if (INVERSE.has(id as LogMistakeId)) return LF_RULE_IDS.inverse
  return LF_RULE_IDS.definition
}
