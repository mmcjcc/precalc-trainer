/**
 * Public types of the functions core (domain and range, composition). Kept local to the engine
 * folder: the mistake kinds are a local union, not ErrorPatternIds (the content stage registers ids and
 * catalog wording and maps these kinds onto them).
 */
import type { Rational, SolutionSet } from '@/shared/types'

/** Every named mistake the functions graders can report. */
export type FunctionMistakeKind =
  // Domain from a formula
  | 'domain_forgot_denominator'
  | 'domain_root_strict'
  | 'domain_root_denominator_zero'
  | 'domain_odd_root_restricted'
  | 'domain_no_flip'
  | 'domain_gave_range'
  | 'domain_denominator_nonneg'
  // Range
  | 'range_gave_domain'
  | 'range_reflection_ignored'
  | 'range_included_asymptote'
  // f(g(x)) as a formula
  | 'compose_product'
  | 'compose_reversed'
  | 'compose_sum'
  | 'compose_no_parens'
  | 'compose_partial_sub'
  // (f o g)(a) as a number
  | 'value_product'
  | 'value_reversed'
  // Domain of f o g
  | 'composite_domain_simplified'
  | 'composite_domain_inner_only'

export const FUNCTION_MISTAKE_KINDS: readonly FunctionMistakeKind[] = [
  'domain_forgot_denominator',
  'domain_root_strict',
  'domain_root_denominator_zero',
  'domain_odd_root_restricted',
  'domain_no_flip',
  'domain_gave_range',
  'domain_denominator_nonneg',
  'range_gave_domain',
  'range_reflection_ignored',
  'range_included_asymptote',
  'compose_product',
  'compose_reversed',
  'compose_sum',
  'compose_no_parens',
  'compose_partial_sub',
  'value_product',
  'value_reversed',
  'composite_domain_simplified',
  'composite_domain_inner_only',
]

/**
 * A grader's verdict.
 *  - correct:     her answer is right; `message` is a short confirmation.
 *  - mistake:     wrong, and it is exactly what the named mistake produces for this function;
 *                 `witness` is a sentence about HER numbers.
 *  - wrong:       wrong, no named mistake fits; `message` is a plain, specific sentence (a witness
 *                 point, what is true there, what her answer says).
 *  - invalid:     her answer could not be read (not an attempt); `position`/`length` point into it.
 *  - unsupported: the PROBLEM is outside the exact model (a template bug, never her fault).
 */
export type FunctionGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'mistake'; mistake: FunctionMistakeKind; witness: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string; position?: number; length?: number }
  | { verdict: 'unsupported'; message: string }

export type RestrictionKind = 'denominator' | 'even_root' | 'even_root_denominator'

/** One condition the domain comes from. Text fields are ASCII app syntax. */
export interface DomainRestriction {
  /** 'denominator': D != 0; 'even_root': radicand >= 0; 'even_root_denominator': radicand > 0. */
  kind: RestrictionKind
  /** The denominator D, or the radicand. "x - 3", "-2x + 6". */
  expr: string
  relation: '!=' | '>=' | '>'
  /** "x - 3 != 0". */
  condition: string
  /** Where the condition holds (inside the expression's own domain). Exact. */
  set: SolutionSet
  /** The same set as a condition on x: "x != 3", "x <= 3", "x <= -3 or x >= 3". */
  solved: string
  /** Root index for the root kinds (2 for sqrt). */
  index?: number
  /** The whole root for the root kinds: "sqrt(x - 1)". */
  root?: string
}

export interface DomainResult {
  /** The function as the engine read it (app syntax). */
  f: string
  set: SolutionSet
  /** "(-inf, 3) U (3, inf)". */
  interval: string
  /** "{x | x != 3}", "{x | x >= -2 and x != 3}". */
  builder: string
  restrictions: DomainRestriction[]
  /** Odd roots (they restrict nothing): radicand and index. */
  oddRoots: { expr: string; index: number; root: string }[]
  /** Ordered reading lines for the hint reveal / after a correct answer (unicode, display only). */
  explanation: string[]
}

export type RangeFamily =
  | 'constant'
  | 'linear'
  | 'quadratic'
  | 'odd_polynomial'
  | 'even_root'
  | 'absolute_value'
  | 'odd_root'
  | 'reciprocal'

export interface RangeResult {
  f: string
  family: RangeFamily
  set: SolutionSet
  interval: string
  /** In y: "{y | y >= -3}", "{y | y != 2}". */
  builder: string
  /**
   * The family's numbers, exact:
   *  quadratic: a, vertex (h, k); even_root / absolute_value / odd_root: a (outer coefficient), k (shift),
   *  h (where the inner linear expression is 0); reciprocal: a, h, k of a/(x - h) + k; linear: a (slope),
   *  k (intercept); constant: k.
   */
  params: { a?: Rational; h?: Rational; k?: Rational }
  explanation: string[]
}

/** A mistake candidate for a set answer: what the mistake produces for this function. */
export interface SetMistakeCandidate {
  kind: FunctionMistakeKind
  set: SolutionSet
  interval: string
  /** The sentence the grader returns when her answer is exactly this set. */
  witness: string
}

/** A mistake candidate for a formula answer (f(g(x))). */
export interface ExpressionMistakeCandidate {
  kind: FunctionMistakeKind
  /** The formula the mistake produces, app syntax ("x - 3^2 + 1"). */
  text: string
  witness: string
}

/** A mistake candidate for a value answer ((f o g)(a)). */
export interface ValueMistakeCandidate {
  kind: FunctionMistakeKind
  /** Exact value text ("-5", "sqrt(2)"). */
  text: string
  witness: string
}
