/**
 * Shared pieces of the difference-quotient templates: rule cards (her Day 5 notes), the canonical
 * f(x + h) step, and the ProblemInstance builder. The canonical path is
 *   [0] the f(x + h) line (stage 1; no chip: substituting is not a property move)
 *   [1..] the lines AFTER the built start line (f(x + h) − (f(x)))/h, ending in the simplified DQ.
 */
import { fOfXPlusH } from '@/engine'
import type { CanonicalStep, DifficultyKnobs, ProblemInstance, RuleCard } from '@/content/types'
import type { PropertyTag } from '@/shared/types'

export const DQ_RULES: RuleCard[] = [
  {
    id: 'dq-def',
    title: 'The difference quotient',
    body: '(f(x + h) − f(x))/h is the slope of the secant line through (x, f(x)) and (x + h, f(x + h)): the rise f(x + h) − f(x) over the run h. h ≠ 0.',
    example: 'f(x) = 5x − 2  →  (5(x + h) − 2 − (5x − 2))/h',
  },
  {
    id: 'fxh',
    title: 'Find f(x + h)',
    body: 'Replace EVERY x in the formula with (x + h), parentheses and all. You may leave it unexpanded; the expanding can happen in the next part.',
    example: 'f(x) = 3x^2 + 2x − 1  →  f(x + h) = 3(x + h)^2 + 2(x + h) − 1',
  },
  {
    id: 'square-binomial',
    title: 'Square a binomial',
    body: '(x + h)^2 = (x + h)(x + h) = x^2 + 2xh + h^2. The middle term 2xh is the one that goes missing if you square each piece.',
    example: '3(x + h)^2  →  3(x^2 + 2xh + h^2)  →  3x^2 + 6xh + 3h^2',
  },
  {
    id: 'distribute',
    title: 'Distribute to every term',
    body: 'The number in front multiplies EVERY term inside the parentheses.',
    example: '5(x + h)  →  5x + 5h',
  },
  {
    id: 'minus-parens',
    title: 'Subtract ALL of f(x)',
    body: 'Keep f(x) in parentheses. The minus in front of it changes the sign of every term.',
    example: '−(3x^2 + 2x − 1)  →  −3x^2 − 2x + 1',
  },
  {
    id: 'combine-like',
    title: 'Combine like terms',
    body: 'After the minus is distributed, every term WITHOUT an h cancels. It always happens: f(x + h) − f(x) is 0 when h = 0.',
    example: '(5x + 5h − 2 − 5x + 2)/h  →  5h/h',
  },
  {
    id: 'factor-h',
    title: 'Factor out h, then cancel',
    body: 'Every term on top has an h. Factor it out and cancel it with the h underneath (allowed because h ≠ 0). Each term loses exactly ONE h.',
    example: '(6xh + 3h^2 + 2h)/h  →  h(6x + 3h + 2)/h  →  6x + 3h + 2',
  },
  {
    id: 'common-denominator',
    title: 'Combine the fractions on top',
    body: 'Subtract the two fractions over a common denominator, then divide by h: dividing by h puts an h in the denominator.',
    example: '3/(x + h) − 3/x  →  (3x − 3(x + h))/(x(x + h))',
  },
  {
    id: 'conjugate',
    title: 'Multiply by the conjugate',
    body: '(√A − √B)(√A + √B) = A − B clears the square roots from the top. Multiply top AND bottom by √(x + h) + √x; leave the bottom factored.',
    example: '(sqrt(x + h) − sqrt(x))/h  →  (x + h − x)/(h(sqrt(x + h) + sqrt(x)))',
  },
  {
    id: 'keep-h',
    title: 'Finished means the h underneath is gone',
    body: 'The difference quotient is simplified when no h is left in a denominator. The answer may still contain h. Letting h go to 0 is the next idea: the derivative.',
  },
]

export function step(text: string, tag: PropertyTag, nudge: string, ruleCard: string, stage: string): CanonicalStep {
  return { text, tag, nudge, ruleCard, stage }
}

/** Canonical stage-1 line: f(x + h) unexpanded. */
export function fxhStep(f: string, fxh = fOfXPlusH(f)): CanonicalStep {
  return step(fxh, 'simplify', `Replace every x in ${f} with (x + h). Keep the parentheses; you do not have to expand yet.`, 'fxh', 'f(x + h) written')
}

export interface DqBuild {
  templateId: string
  version: number
  seed: number
  knobs: DifficultyKnobs
  f: string
  /** Canonical f(x + h) line (default: every x replaced by (x + h)). */
  fxh?: string
  /** Lines after the start line; the last one is the simplified difference quotient. */
  steps: CanonicalStep[]
  restrictions: string[]
  note?: string
  secant: { x0: number; h0: number }
  xDomain: [number, number]
  params: Record<string, number | string | boolean>
}

export function buildInstance(b: DqBuild): ProblemInstance {
  const fxh = b.fxh ?? fOfXPlusH(b.f)
  const simplified = b.steps[b.steps.length - 1]!.text
  return {
    id: `diffQuotient/${b.templateId}@${b.version}/${(b.seed >>> 0).toString(36)}`,
    moduleId: 'diffQuotient',
    templateId: b.templateId,
    skill: b.templateId,
    genVersion: b.version,
    seed: b.seed,
    knobs: b.knobs,
    kind: 'diffQuotient',
    title: 'Simplify the difference quotient',
    instructions: 'Find f(x + h). Then build (f(x + h) − f(x))/h and simplify it one line at a time until no h is left underneath (h ≠ 0).',
    statementText: `f(x) = ${b.f}`,
    vars: ['x', 'h'],
    start: null,
    canonical: [fxhStep(b.f, fxh), ...b.steps],
    answer: { type: 'diffQuotient', f: b.f, fxh, simplified, restrictions: b.restrictions, note: b.note ?? '' },
    graph: { kind: 'function', f: b.f, secant: b.secant, xDomain: b.xDomain },
    calc: { ti84: [], nspire: [] },
    params: { f: b.f, answer: simplified, ...b.params },
  }
}
