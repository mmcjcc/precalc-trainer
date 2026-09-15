import { calcPanels } from '@/content/calc'
import { makeRng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { checkParity, evalExpr } from '@/engine/parity'

export type BankFamily = 'abs' | 'root' | 'rational'

export type BankItem = {
  family: BankFamily
  /** f(x) in app syntax. */
  f: string
  /** f(−x) with every x replaced by (−x), unsimplified. */
  fNegX: string
  /** f(−x) simplified. */
  fNegXSimpl: string
  /** −f(x) simplified (the unsimplified form is always `-(f)`). */
  negF: string
  /** Friendly check values (CG-08); the generator draws one. */
  ks: readonly number[]
}

/**
 * Item bank verified against checkParity (CG-07) with stored check values chosen per CG-08:
 *  - cbrt family: k = ±8 (cbrt(−8) = −2 makes the sign fold visible);
 *  - sqrt(25 − x²) family: k ∈ {3, 4} (legs of the 3-4-5 triangle → f(k) integer);
 *  - sqrt(x + b): k with k + b a perfect square and −k + b < 0 (shows the domain failure);
 *  - rationals: k ∈ {1, 2, 3} with nonzero denominators at ±k and |f(k)| with denominator ≤ 5;
 *  - 1/(x+2): k = 2 so that f(−2) is undefined — the domain question answered by the plug-in.
 */
export const BANK: readonly BankItem[] = [
  // abs
  { family: 'abs', f: 'abs(x)', fNegX: 'abs(-x)', fNegXSimpl: 'abs(x)', negF: '-abs(x)', ks: [2, 3] },
  { family: 'abs', f: 'x*abs(x)', fNegX: '(-x)*abs(-x)', fNegXSimpl: '-x*abs(x)', negF: '-x*abs(x)', ks: [2, 3] },
  { family: 'abs', f: 'abs(x)+x', fNegX: 'abs(-x)+(-x)', fNegXSimpl: 'abs(x)-x', negF: '-abs(x)-x', ks: [2, 3] },
  // roots
  { family: 'root', f: 'cbrt(x)', fNegX: 'cbrt(-x)', fNegXSimpl: '-cbrt(x)', negF: '-cbrt(x)', ks: [8, -8] },
  { family: 'root', f: 'x*cbrt(x)', fNegX: '(-x)*cbrt(-x)', fNegXSimpl: 'x*cbrt(x)', negF: '-x*cbrt(x)', ks: [8, -8] },
  { family: 'root', f: 'cbrt(x)+1', fNegX: 'cbrt(-x)+1', fNegXSimpl: '-cbrt(x)+1', negF: '-cbrt(x)-1', ks: [8, -8] },
  { family: 'root', f: 'sqrt(25-x^2)', fNegX: 'sqrt(25-(-x)^2)', fNegXSimpl: 'sqrt(25-x^2)', negF: '-sqrt(25-x^2)', ks: [3, 4] },
  { family: 'root', f: 'x*sqrt(25-x^2)', fNegX: '(-x)*sqrt(25-(-x)^2)', fNegXSimpl: '-x*sqrt(25-x^2)', negF: '-x*sqrt(25-x^2)', ks: [3, 4] },
  { family: 'root', f: 'sqrt(x+3)', fNegX: 'sqrt(-x+3)', fNegXSimpl: 'sqrt(3-x)', negF: '-sqrt(x+3)', ks: [6] },
  { family: 'root', f: 'sqrt(x+1)', fNegX: 'sqrt(-x+1)', fNegXSimpl: 'sqrt(1-x)', negF: '-sqrt(x+1)', ks: [3] },
  // rationals
  { family: 'rational', f: '1/x', fNegX: '1/(-x)', fNegXSimpl: '-1/x', negF: '-1/x', ks: [1, 2, 3] },
  { family: 'rational', f: '1/(x^2-4)', fNegX: '1/((-x)^2-4)', fNegXSimpl: '1/(x^2-4)', negF: '-1/(x^2-4)', ks: [1, 3] },
  { family: 'rational', f: 'x/(x^2-1)', fNegX: '(-x)/((-x)^2-1)', fNegXSimpl: '-x/(x^2-1)', negF: '-x/(x^2-1)', ks: [2] },
  { family: 'rational', f: '(x^2+1)/(x^2-3)', fNegX: '((-x)^2+1)/((-x)^2-3)', fNegXSimpl: '(x^2+1)/(x^2-3)', negF: '-(x^2+1)/(x^2-3)', ks: [1, 2, 3] },
  { family: 'rational', f: '(x^2+1)/x', fNegX: '((-x)^2+1)/(-x)', fNegXSimpl: '-(x^2+1)/x', negF: '-(x^2+1)/x', ks: [1, 2, 3] },
  { family: 'rational', f: '1/(x+2)', fNegX: '1/(-x+2)', fNegXSimpl: '1/(2-x)', negF: '-1/(x+2)', ks: [2] },
]

/** −f(x) lines the student can match: the raw negation first, then the simplified form. */
export function negFLines(f: string, simplified: string): string[] {
  const raw = `-(${f})`
  return raw === simplified ? [raw] : [raw, simplified]
}

export const evenOddBankTemplate: TemplateDef = {
  id: 'evenOdd.special',
  title: 'Roots, abs, and rationals',
  description: 'Same even/odd test on abs, cube roots, square roots, and simple rationals — including asymmetric domains.',
  version: 2,
  knobs: [],
  generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
    const rng = makeRng(seed)
    const item = rng.pick(BANK)
    const k = rng.pick(item.ks)
    const checked = checkParity(item.f, [k])
    const fk = evalExpr(item.f, { x: k })
    const domainHint =
      item.family === 'root' && item.f.startsWith('sqrt(x')
        ? ' Ask first: is f(−x) even defined where f(x) is?'
        : ''
    return {
      id: `evenOdd/evenOdd.special@2/${(seed >>> 0).toString(36)}`,
      moduleId: 'evenOdd',
      templateId: 'evenOdd.special',
      skill: 'evenOdd.special',
      genVersion: 2,
      seed,
      knobs,
      kind: 'evenOdd',
      title: 'Even, odd, or neither?',
      instructions:
        'Write f(−x) and −f(x). Ask first: is the domain symmetric about 0? Then compare values at the stored k.',
      statementText: `y = ${item.f}`,
      vars: ['x'],
      start: `y = ${item.f}`,
      canonical: [
        {
          text: `y = ${item.fNegX}`,
          tag: 'simplify',
          nudge: 'Replace every x with (−x). Keep the parentheses.' + domainHint,
          ruleCard: 'f-neg-x',
          stage: 'f(-x) written',
        },
        {
          text: `y = ${item.fNegXSimpl}`,
          tag: 'simplify',
          nudge: 'Simplify. Even powers and |·| drop the minus; odd roots and odd powers keep it.',
          ruleCard: 'simplify-neg',
          stage: 'f(-x) simplified',
        },
      ],
      answer: {
        type: 'parity',
        f: item.f,
        verdict: checked.verdict,
        reason: checked.reason,
        fNegX: [item.fNegX, item.fNegXSimpl],
        negF: negFLines(item.f, item.negF),
        k,
      },
      graph: {
        kind: 'function',
        f: item.f,
        extra: [
          { expr: item.fNegXSimpl, label: 'f(-x)', style: 'dashed', color: 'gold' },
          { expr: item.negF, label: '-f(x)', style: 'dotted', color: 'coral' },
        ],
        xDomain: [-8, 8],
      },
      calc: calcPanels({ family: 'even-odd', expr: item.f, checkValue: k }),
      check: { k, fk: typeof fk === 'number' ? fk : 0 },
      params: { f: item.f, family: item.family, verdict: checked.verdict, reason: checked.reason, k },
    }
  },
}
