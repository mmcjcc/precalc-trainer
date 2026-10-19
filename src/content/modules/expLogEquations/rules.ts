/**
 * Rule cards for exponential and logarithmic equations. No digits and no "no solution":
 * both can be an answer she is still working toward.
 */
import type { RuleCard } from '@/content/types'
import type { LogMistakeId } from '@/engine'

export const EE_RULE_IDS = {
  both: 'ee-both-sides',
  convert: 'ee-convert',
  domain: 'ee-domain',
  quadratic: 'ee-quadratic',
} as const

export const EE_RULES: RuleCard[] = [
  {
    id: EE_RULE_IDS.both,
    title: 'The same move on both sides',
    body: 'If A = B, then log A = log B. A number in front of a power is not part of the base: divide by it first. A sum inside an exponent makes a product of powers, and a sum of logs is the log of a product, not of a sum.',
    example: 'b^(x) = a → x·log(b) = a ✗ → x·log(b) = log(a)',
  },
  {
    id: EE_RULE_IDS.convert,
    title: 'A log and a power undo each other',
    body: 'log base b of A = C means A = b^C. Erasing the word log, multiplying by the base, or swapping the base and the result writes a different equation. In a change of base, the base goes on the bottom.',
    example: 'log_b(A) = C → A = C ✗ → A = b^C',
  },
  {
    id: EE_RULE_IDS.domain,
    title: 'Check every answer in the original',
    body: 'A log needs a positive input. Combining logs can bring in an answer the original cannot use, and it can also hide a negative answer that still makes every input positive. Put each answer back into the original logs.',
    example: 'dropping a negative x ✗ → keep it when every log input stays positive',
  },
  {
    id: EE_RULE_IDS.quadratic,
    title: 'A power that is quadratic in form',
    body: 'e to the 2x is (e to the x) squared, and (b^2)^x is (b^x) squared. Let u be that power, solve the quadratic, then take a log. A negative u is not a power of a positive base, so it gives nothing.',
    example: 'keeping u negative ✗ → only a positive u is a power of the base',
  },
]

const CONVERT = new Set<LogMistakeId>([
  'log_convert_swapped',
  'log_convert_multiplied',
  'log_convert_dropped',
  'log_change_base_inverted',
  'log_quotient_as_quotient',
  'log_one_side',
])
const DOMAIN = new Set<LogMistakeId>(['log_extraneous_kept', 'log_valid_rejected', 'log_power_abs'])
const QUADRATIC = new Set<LogMistakeId>(['log_exp_negative_exponent', 'log_exp_power_added', 'log_exp_sum_split'])

export function eeRuleFor(id: string, question: 'exponential' | 'logarithmic' | 'quadratic'): string {
  if (question === 'quadratic') return EE_RULE_IDS.quadratic
  if (DOMAIN.has(id as LogMistakeId)) return EE_RULE_IDS.domain
  if (CONVERT.has(id as LogMistakeId)) return EE_RULE_IDS.convert
  if (QUADRATIC.has(id as LogMistakeId)) return EE_RULE_IDS.quadratic
  return EE_RULE_IDS.both
}
