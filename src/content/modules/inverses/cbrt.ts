import { calcPanels } from '@/content/calc'
import { makeRng } from '@/content/rng'
import type { CanonicalStep, DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { coeffVar, linearExpr, xShift } from '../format'

export const inverseCbrtTemplate: TemplateDef = {
  id: 'inv.cbrt-shift',
  title: 'Cube-root inverse',
  description: 'Find the inverse of y = cbrt(ax + b) + c. Integer round-trip by construction.',
  version: 1,
  knobs: [],
  generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
    const rng = makeRng(seed)
    let a = 1
    let b = 1
    let c = 0
    let m = 2
    let k = 1
    for (let tries = 0; tries < 24; tries++) {
      m = rng.pick([-3, -2, -1, 1, 2, 3])
      k = rng.pick([-3, -2, -1, 1, 2, 3])
      a = rng.pick([1, 2, 3, 4])
      c = rng.pick([-2, -1, 0, 1, 2])
      b = m * m * m - a * k
      if (Math.abs(b) <= 15 && b !== 0) break
    }
    const inner = linearExpr(a, b)
    const innerY = linearExpr(a, b, 'y')
    const cbrtPart = `cbrt(${inner})`
    const start = c === 0 ? `y = ${cbrtPart}` : `y = ${cbrtPart} ${c > 0 ? '+' : '-'} ${Math.abs(c)}`
    const swapped =
      c === 0 ? `x = cbrt(${innerY})` : `x = cbrt(${innerY}) ${c > 0 ? '+' : '-'} ${Math.abs(c)}`
    const isolatedRoot = `${xShift(-c, 'x')} = cbrt(${innerY})`
    const cubed = `(${xShift(-c, 'x')})^3 = ${innerY}`
    const minusB =
      b === 0 ? cubed : `(${xShift(-c, 'x')})^3 ${b > 0 ? '-' : '+'} ${Math.abs(b)} = ${coeffVar(a, 'y')}`
    const inverseInner = b === 0 ? `(${xShift(-c, 'x')})^3` : `(${xShift(-c, 'x')})^3 ${b > 0 ? '-' : '+'} ${Math.abs(b)}`
    const inverse = a === 1 ? inverseInner : `(${inverseInner})/${a}`
    const divided = `${inverse} = y`
    const isolated = `y = ${inverse}`
    const fk = m + c
    return {
      id: `inverses/inv.cbrt-shift@1/${(seed >>> 0).toString(36)}`,
      moduleId: 'inverses',
      templateId: 'inv.cbrt-shift',
      skill: 'inv.cbrt-shift',
      genVersion: 1,
      seed,
      knobs,
      kind: 'inverse',
      title: 'Find the inverse (cube root)',
      instructions: 'Swap x and y, then undo: subtract the shift, cube, undo the rest. Write y = f⁻¹(x).',
      statementText: start,
      vars: ['x', 'y'],
      start,
      canonical: [
        {
          text: swapped,
          tag: 'swap_xy',
          nudge: 'Swap x and y first.',
          ruleCard: 'swap-xy',
          stage: 'swapped',
        },
        ...(c === 0
          ? []
          : ([
              {
                text: isolatedRoot,
                tag: c > 0 ? 'sub_both' : 'add_both',
                nudge: 'Undo the constant outside the cube root.',
                ruleCard: 'add-sub',
                stage: 'root isolated',
              },
            ] satisfies CanonicalStep[])),
        {
          text: cubed,
          tag: 'cube_both',
          nudge: 'Cube both sides to undo the cube root.',
          ruleCard: 'cube-both',
          stage: 'cubed',
        },
        ...(b === 0
          ? []
          : ([
              {
                text: minusB,
                tag: b > 0 ? 'sub_both' : 'add_both',
                nudge: 'Move the constant away from y.',
                ruleCard: 'add-sub',
                stage: 'constant moved',
              },
            ] satisfies CanonicalStep[])),
        ...(a === 1
          ? []
          : ([
              {
                text: divided,
                tag: 'div_both',
                nudge: 'Divide by the coefficient of y.',
                ruleCard: 'mul-div',
                stage: 'coefficient 1',
              },
            ] satisfies CanonicalStep[])),
        {
          text: isolated,
          tag: 'swap_sides',
          nudge: 'Put y on the left.',
          ruleCard: 'swap-sides',
          stage: 'y isolated',
        },
      ],
      answer: { type: 'inverse', oneToOne: true, inverse },
      graph: { kind: 'function', f: start.replace(/^y = /, ''), finv: inverse, showIdentity: true },
      calc: calcPanels({
        family: 'inverse-cbrt',
        expr: start.replace(/^y = /, ''),
        inverseExpr: inverse,
        checkValue: k,
        checkOutput: fk,
      }),
      check: { k, fk },
      params: { a, b, c, m, k, fk },
    }
  },
}
