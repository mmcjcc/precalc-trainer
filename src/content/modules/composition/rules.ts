import type { RuleCard } from '@/content/types'

/** Rule cards for composition, in this module's own words. */
export const COMP_RULE_IDS = {
  parens: 'comp-parens',
  order: 'comp-order',
  domain: 'comp-domain',
} as const

export const COMP_RULES: RuleCard[] = [
  {
    id: COMP_RULE_IDS.parens,
    title: 'Put the inside function in parentheses',
    body: 'When you substitute, the whole of g(x) goes where x was, in parentheses. Without them, an exponent or a coefficient only reaches part of g. Every x in f has to become g(x), not just one of them.',
    example: 'f(x) = x^2 + 1, g(x) = x - 3 → (x - 3)^2 + 1, not x - 3^2 + 1',
  },
  {
    id: COMP_RULE_IDS.order,
    title: 'f ∘ g means f(g(x))',
    body: '(f ∘ g)(x) is f on the outside and g on the inside: apply g first, then f. It is not f times g, not f plus g, and not g(f(x)). For a number, compute g(a) first, then f of that result.',
    example: 'f(x) = 2x + 5, g(x) = x^2 - 1, a = 2 → g(2) = 3, then f(3) = 11',
  },
  {
    id: COMP_RULE_IDS.domain,
    title: 'The domain of f ∘ g has two parts',
    body: 'x has to be in the domain of g, and then g(x) has to be in the domain of f. Simplifying f(g(x)) can hide one of those restrictions, so read the domain off the two functions, not off the simplified formula alone.',
    example: 'f(x) = x^2, g(x) = sqrt(x) → [0, inf). f(x) = 1/(x - 2), g(x) = sqrt(x) → [0, 4) U (4, inf)',
  },
]
