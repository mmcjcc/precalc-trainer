import { calcPanels } from '@/content/calc'
import { makeRng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { addConst, prettyInt, xShift } from '../format'
import {
  INVERSE_INSTRUCTIONS,
  SWAP_LAST_NUDGE,
  domainAround,
  inverseId,
  step,
  undoConstNudge,
  undoConstTag,
} from './shared'

/**
 * f(x) = a/(x + b) + c. The check value is k = d − b for a divisor d of a, so f(k) = a/d + c is an
 * integer and f⁻¹ = a/(x − c) − b returns d − b exactly. b = −c is excluded (b = c = 0 included):
 * that makes f its own inverse, which a student reads as "I made a mistake" (CG-10).
 */
export const inverseRationalTemplate: TemplateDef = {
  id: 'inv.rational',
  title: 'Rational inverse',
  description: 'Find the inverse of y = a/(x + b) + c. Clear the denominator, then undo. Watch the asymptotes trade places.',
  version: 1,
  knobs: [],
  generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
    const rng = makeRng(seed)
    const a = rng.sign() * rng.pick([1, 2, 3, 4, 6])
    const b = rng.int(-6, 6)
    const c = rng.intExcept(-6, 6, [-b])
    const divisors = [...new Set([1, -1, Math.abs(a), -Math.abs(a)])]
    const options = divisors.map((d) => ({ d, k: d - b })).filter((o) => Math.abs(o.k) <= 8)
    const { d, k } = rng.pick(options)
    const fk = a / d + c

    const den = (v: string) => (b === 0 ? v : `(${xShift(b, v)})`)
    const minusC = (v: string) => (c === 0 ? v : `(${xShift(-c, v)})`)
    const frac = (v: string) => `${a}/${den(v)}`
    const invFrac = (v: string) => `${a}/${minusC(v)}`
    const f = addConst(frac('x'), c)
    const inverse = addConst(invFrac('x'), -b)
    /** (top + b)(other − c) = a, the cleared form; when c = 0 the bare letter goes first: x(y + b) = a. */
    const cleared = (top: string, other: string) =>
      c === 0 ? `${other}${den(top)} = ${a}` : `${den(top)}${minusC(other)} = ${a}`

    const swapNudge = `Swap x and y: every x becomes y and every y becomes x. The asymptotes trade places too — f has x = ${prettyInt(-b)} and y = ${prettyInt(c)}, so f⁻¹ will have x = ${prettyInt(c)} and y = ${prettyInt(-b)}.`
    const clearNudge = (v: string) =>
      `Multiply both sides by ${den(v)} to clear the denominator. On this curve ${den(v)} is never 0, so nothing is lost.`
    const divNudge = (keep: string, by: string) =>
      `Divide both sides by ${minusC(by)} — that leaves ${xShift(b, keep)} alone, with ${by} in the denominator where ${keep} used to be.`
    const asymptotes = { vertical: -b, horizontal: c }

    return {
      id: inverseId('inv.rational', seed),
      moduleId: 'inverses',
      templateId: 'inv.rational',
      skill: 'inv.rational',
      genVersion: 1,
      seed,
      knobs,
      kind: 'inverse',
      title: 'Find the inverse (rational)',
      instructions: INVERSE_INSTRUCTIONS,
      statementText: `y = ${f}`,
      vars: ['x', 'y'],
      start: `y = ${f}`,
      canonical: [
        step(`x = ${addConst(frac('y'), c)}`, 'swap_xy', swapNudge, 'swap-xy', 'swapped'),
        ...(c !== 0
          ? [
              step(
                `${xShift(-c, 'x')} = ${frac('y')}`,
                undoConstTag(c),
                undoConstNudge(c, `the fraction ${frac('y')}`),
                'add-sub',
                'fraction isolated',
              ),
            ]
          : []),
        step(cleared('y', 'x'), 'clear_denominator', clearNudge('y'), 'clear-denominator', 'denominator cleared'),
        step(
          `${xShift(b, 'y')} = ${invFrac('x')}`,
          'div_both',
          divNudge('y', 'x'),
          'mul-div',
          b === 0 ? 'y isolated' : 'y term isolated',
        ),
        ...(b !== 0 ? [step(`y = ${inverse}`, undoConstTag(b), undoConstNudge(b, 'y'), 'add-sub', 'y isolated')] : []),
      ],
      canonicalAlt: [
        ...(c !== 0
          ? [
              step(
                `${xShift(-c, 'y')} = ${frac('x')}`,
                undoConstTag(c),
                undoConstNudge(c, `the fraction ${frac('x')}`),
                'add-sub',
                'fraction isolated',
              ),
            ]
          : []),
        step(cleared('x', 'y'), 'clear_denominator', clearNudge('x'), 'clear-denominator', 'denominator cleared'),
        step(
          `${xShift(b, 'x')} = ${invFrac('y')}`,
          'div_both',
          divNudge('x', 'y'),
          'mul-div',
          b === 0 ? 'x isolated' : 'x term isolated',
        ),
        ...(b !== 0
          ? [step(`x = ${addConst(invFrac('y'), -b)}`, undoConstTag(b), undoConstNudge(b, 'x'), 'add-sub', 'x isolated')]
          : []),
        step(`y = ${inverse}`, 'swap_xy', SWAP_LAST_NUDGE, 'swap-xy', 'y isolated'),
      ],
      answer: { type: 'inverse', oneToOne: true, inverse },
      graph: { kind: 'function', f, finv: inverse, showIdentity: true, xDomain: domainAround([-b, c, k, fk]) },
      calc: calcPanels({
        family: 'inverse-rational',
        expr: f,
        inverseExpr: inverse,
        checkValue: k,
        checkOutput: fk,
        asymptotes,
      }),
      check: { k, fk },
      params: { a, b, c, d, k, fk, verticalAsymptote: -b, horizontalAsymptote: c },
    }
  },
}
