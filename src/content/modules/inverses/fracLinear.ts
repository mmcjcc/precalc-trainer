import { calcPanels } from '@/content/calc'
import { makeRng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { addConst, fracCoeff, gcd, prettyInt, xShift } from '../format'
import {
  INVERSE_INSTRUCTIONS,
  SWAP_FIRST_NUDGE,
  SWAP_LAST_NUDGE,
  inverseId,
  step,
  undoConstNudge,
  undoConstTag,
} from './shared'

const DENOMINATORS = [2, 3, 4, 5] as const
const NUMERATORS = [2, 3, 4, 5, 6, 7] as const

/**
 * y = ±(p/q)x + b with p, q coprime. The check value is k = ±q, so f(k) = ±p + b is an integer
 * and the reciprocal multiply lands back on ±q exactly.
 */
export const inverseFracLinearTemplate: TemplateDef = {
  id: 'inv.frac-linear',
  title: 'Fraction-coefficient inverse',
  description: 'Find the inverse of y = ±(p/q)x + b. A fraction coefficient is undone by its reciprocal.',
  version: 1,
  knobs: [],
  generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
    const rng = makeRng(seed)
    const q = rng.pick(DENOMINATORS)
    const p = rng.pick(NUMERATORS.filter((v) => gcd(v, q) === 1))
    const s = rng.sign()
    const b = rng.intExcept(-6, 6, [0])
    const kSign = rng.sign()
    const k = kSign * q
    const fk = s * kSign * p + b
    const neg = s < 0

    const coef = (v: string) => fracCoeff(p, q, v, neg)
    const recip = (v: string) => `${neg ? '-' : ''}(${q}/${p})(${xShift(-b, v)})`
    const f = addConst(coef('x'), b)
    const inverse = recip('x')
    const coefWord = `${neg ? '−' : ''}${p}/${q}`
    const recipWord = `${neg ? '−' : ''}${q}/${p}`
    const recipNudge = `Multiply both sides by the reciprocal ${recipWord} — that undoes the coefficient ${coefWord} in one move (dividing by ${coefWord} is the same thing).`

    return {
      id: inverseId('inv.frac-linear', seed),
      moduleId: 'inverses',
      templateId: 'inv.frac-linear',
      skill: 'inv.frac-linear',
      genVersion: 1,
      seed,
      knobs,
      kind: 'inverse',
      title: 'Find the inverse (fraction coefficient)',
      instructions: INVERSE_INSTRUCTIONS,
      statementText: `y = ${f}`,
      vars: ['x', 'y'],
      start: `y = ${f}`,
      canonical: [
        step(`x = ${addConst(coef('y'), b)}`, 'swap_xy', SWAP_FIRST_NUDGE, 'swap-xy', 'swapped'),
        step(
          `${xShift(-b, 'x')} = ${coef('y')}`,
          undoConstTag(b),
          undoConstNudge(b, `the ${coef('y')} term`),
          'add-sub',
          'constant moved',
        ),
        step(`${recip('x')} = y`, 'reciprocal_multiply', recipNudge, 'reciprocal', 'coefficient 1'),
        step(`y = ${inverse}`, 'swap_sides', 'Put y on the left — equals reads the same from either side.', 'swap-sides', 'y isolated'),
      ],
      canonicalAlt: [
        step(
          `${xShift(-b, 'y')} = ${coef('x')}`,
          undoConstTag(b),
          undoConstNudge(b, `the ${coef('x')} term`),
          'add-sub',
          'constant moved',
        ),
        step(`${recip('y')} = x`, 'reciprocal_multiply', recipNudge, 'reciprocal', 'coefficient 1'),
        step(`x = ${recip('y')}`, 'swap_sides', 'Put x on the left — equals reads the same from either side.', 'swap-sides', 'x isolated'),
        step(`y = ${inverse}`, 'swap_xy', SWAP_LAST_NUDGE, 'swap-xy', 'y isolated'),
      ],
      answer: { type: 'inverse', oneToOne: true, inverse },
      graph: { kind: 'function', f, finv: inverse, showIdentity: true },
      calc: calcPanels({
        family: 'inverse-frac-linear',
        expr: f,
        inverseExpr: inverse,
        checkValue: k,
        checkOutput: fk,
      }),
      check: { k, fk },
      params: { p, q, s, b, k, fk, coefficient: `${prettyInt(s * p)}/${q}` },
    }
  },
}
