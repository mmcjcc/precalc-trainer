import { calcPanels } from '@/content/calc'
import { makeRng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { coeffVar, linearExpr, xShift } from '../format'

export const inverseLinearTemplate: TemplateDef = {
  id: 'inv.linear',
  title: 'Linear inverse',
  description: 'Find the inverse of y = ax + b. Swap first, then undo.',
  version: 1,
  knobs: [],
  generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
    const rng = makeRng(seed)
    const a = rng.pick([2, 3, 4, 5, -2, -3, -4])
    const b = rng.intExcept(-6, 6, [0])
    const k = rng.pick([1, 2, -1, -2, 3])
    const fk = a * k + b
    const start = `y = ${linearExpr(a, b)}`
    const swapped = `x = ${linearExpr(a, b, 'y')}`
    const shifted = `${xShift(-b, 'x')} = ${coeffVar(a, 'y')}`
    const divided = `(${xShift(-b, 'x')})/${a} = y`
    const isolated = `y = (${xShift(-b, 'x')})/${a}`
    const inverse = `(${xShift(-b, 'x')})/${a}`
    return {
      id: `inverses/inv.linear@1/${(seed >>> 0).toString(36)}`,
      moduleId: 'inverses',
      templateId: 'inv.linear',
      skill: 'inv.linear',
      genVersion: 1,
      seed,
      knobs,
      kind: 'inverse',
      title: 'Find the inverse',
      instructions: 'Swap x and y, then undo the operations. Write f⁻¹ as y = … in x.',
      statementText: start,
      vars: ['x', 'y'],
      start,
      canonical: [
        {
          text: swapped,
          tag: 'swap_xy',
          nudge: 'The first move on an inverse is to swap x and y.',
          ruleCard: 'swap-xy',
          stage: 'swapped',
        },
        {
          text: shifted,
          tag: b > 0 ? 'sub_both' : 'add_both',
          nudge: 'Undo the add/subtract sitting with y.',
          ruleCard: 'add-sub',
          stage: 'constant moved',
        },
        {
          text: divided,
          tag: 'div_both',
          nudge: 'Divide by the coefficient of y.',
          ruleCard: 'mul-div',
          stage: 'coefficient 1',
        },
        {
          text: isolated,
          tag: 'swap_sides',
          nudge: 'Put y on the left.',
          ruleCard: 'swap-sides',
          stage: 'y isolated',
        },
      ],
      answer: { type: 'inverse', oneToOne: true, inverse },
      graph: { kind: 'function', f: linearExpr(a, b), finv: inverse, showIdentity: true },
      calc: calcPanels({
        family: 'inverse-linear',
        expr: linearExpr(a, b),
        inverseExpr: inverse,
        checkValue: k,
        checkOutput: fk,
      }),
      check: { k, fk },
      params: { a, b, k, fk },
    }
  },
}
