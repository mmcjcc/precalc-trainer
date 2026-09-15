/**
 * The notation layer's slice of the error-pattern library: final-answer / set-notation patterns.
 * Text is in the coach voice; `patternHit` attaches a concrete witness for one instance.
 */
import type { ErrorPatternId, PatternHit } from '@/shared/types'

export type NotationPatternId = Extract<
  ErrorPatternId,
  | 'backwards_interval'
  | 'infinity_bracket'
  | 'bracket_point'
  | 'empty_interval'
  | 'dropped_union'
  | 'set_interval_mismatch'
  | 'wrong_side'
  | 'endpoint_type'
>

export const NOTATION_PATTERNS: Record<NotationPatternId, Omit<PatternHit, 'witness'>> = {
  backwards_interval: {
    id: 'backwards_interval',
    title: 'Intervals read left → right',
    lesson:
      'Intervals read left → right on the number line: the smaller number goes first, and −∞ always leads with a (.',
    example: '[3, -inf) ✗ → (-inf, 3]',
  },
  infinity_bracket: {
    id: 'infinity_bracket',
    title: '∞ always gets a (',
    lesson:
      '∞ is never reached — no number sits at infinity — so the bracket beside it is always round: ( or ).',
    example: '[-inf, 2) ✗ → (-inf, 2)',
  },
  bracket_point: {
    id: 'bracket_point',
    title: 'A single point uses braces',
    lesson: 'A single number is a set of one element: {3}. Brackets need two different endpoints.',
    example: '[3] ✗ → {3}',
  },
  empty_interval: {
    id: 'empty_interval',
    title: 'That interval is empty',
    lesson:
      '(a, a) contains nothing: both endpoints are the same number and at least one is excluded. The single number a is {a}; no solutions at all is {}.',
    example: '(2, 2) ✗ → {2} or {}',
  },
  dropped_union: {
    id: 'dropped_union',
    title: 'Put U between separate pieces',
    lesson: "Two separate pieces need U (union) between them — one interval can't have a gap.",
    example: '(-inf, -2] (5, inf) ✗ → (-inf, -2] U (5, inf)',
  },
  set_interval_mismatch: {
    id: 'set_interval_mismatch',
    title: 'Your interval and your set disagree',
    lesson:
      'Your interval and your set-builder should describe exactly the same numbers. Check each endpoint: included (≤, bracket) or not (<, parenthesis)?',
    example: '(-inf, 2) vs {x | x <= 2} ✗ — 2 is in one but not the other',
  },
  wrong_side: {
    id: 'wrong_side',
    title: 'Shade the other side',
    lesson:
      'x > -2 means numbers bigger than -2, which sit to the RIGHT of -2 on the number line. Read the inequality aloud — "x is greater than" — and shade that way.',
    example: 'x > -2 → (-inf, -2) ✗ → (-2, inf)',
  },
  endpoint_type: {
    id: 'endpoint_type',
    title: 'Bracket or parenthesis?',
    lesson:
      '≤ and ≥ include the endpoint → bracket [ ] and a closed dot; < and > exclude it → parenthesis ( ) and an open dot.',
    example: 'x <= 2 → (-inf, 2) ✗ → (-inf, 2]',
  },
}

export function patternHit(id: NotationPatternId, witness?: string): PatternHit {
  const base = NOTATION_PATTERNS[id]
  return witness === undefined ? { ...base } : { ...base, witness }
}
