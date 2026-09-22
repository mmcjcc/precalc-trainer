/**
 * FunctionMistakeKind → ErrorPatternId. The prefix is `fn_`; the catalog holds the lesson and the
 * wrong → right example. The engine's witness sentence is about her numbers and is shown as-is.
 */
import type { FunctionMistakeKind } from '@/engine'
import type { ErrorPatternId } from '@/shared/types'

export const FN_PATTERN: Record<FunctionMistakeKind, ErrorPatternId> = {
  domain_forgot_denominator: 'fn_domain_forgot_denominator',
  domain_root_strict: 'fn_domain_root_strict',
  domain_root_denominator_zero: 'fn_domain_root_denominator_zero',
  domain_odd_root_restricted: 'fn_domain_odd_root_restricted',
  domain_no_flip: 'fn_domain_no_flip',
  domain_gave_range: 'fn_domain_gave_range',
  domain_denominator_nonneg: 'fn_domain_denominator_nonneg',
  range_gave_domain: 'fn_range_gave_domain',
  range_reflection_ignored: 'fn_range_reflection_ignored',
  range_included_asymptote: 'fn_range_included_asymptote',
  compose_product: 'fn_compose_product',
  compose_reversed: 'fn_compose_reversed',
  compose_sum: 'fn_compose_sum',
  compose_no_parens: 'fn_compose_no_parens',
  compose_partial_sub: 'fn_compose_partial_sub',
  value_product: 'fn_value_product',
  value_reversed: 'fn_value_reversed',
  composite_domain_simplified: 'fn_composite_domain_simplified',
  composite_domain_inner_only: 'fn_composite_domain_inner_only',
}
