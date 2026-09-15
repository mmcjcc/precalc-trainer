import { calcPanels } from '@/content/calc'
import { makeRng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { addConst, prettyInt, xShift } from '../format'
import { INVERSE_INSTRUCTIONS, inverseId, step, undoConstNudge, undoConstTag } from './shared'

/**
 * f(x) = a(x − h)² + c is NOT one-to-one: k = h + 2 and its twin h − 2 share the output 4a + c.
 * The app grades this problem by the verdict + twin. The canonical path is the bonus path on the
 * restricted domain x ≥ h; every line is a legal equivalence (the ± is kept until the end and the
 * "+ branch only" choice lives in `answer.bonusInverse`, not in a step).
 */
export const inverseQuadraticNotTemplate: TemplateDef = {
  id: 'inv.quadratic-not',
  title: 'Is it one-to-one? (quadratic)',
  description:
    'Decide whether f(x) = a(x − h)² + c has an inverse, and back the verdict with two inputs that share an output. Bonus: the inverse on x ≥ h.',
  version: 1,
  knobs: [],
  generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
    const rng = makeRng(seed)
    const a = rng.sign() * rng.int(1, 4)
    const h = rng.int(-3, 3)
    const c = rng.int(-9, 9)
    const k = h + 2
    const twin = h - 2
    const fk = 4 * a + c

    const sq = (v: string) => (h === 0 ? `${v}^2` : `(${xShift(-h, v)})^2`)
    const lead = (v: string) => (a === 1 ? sq(v) : a === -1 ? `-${sq(v)}` : `${a}${sq(v)}`)
    const f = addConst(lead('x'), c)
    /** (v − c)/a, written so the inside of the root reads cleanly when a < 0: (c − v)/(−a). */
    const radicand = (v: string): string => {
      if (a > 0) {
        const n = xShift(-c, v)
        if (a === 1) return n
        return c === 0 ? `${v}/${a}` : `(${n})/${a}`
      }
      const n = c === 0 ? `-${v}` : `${c} - ${v}`
      if (a === -1) return n
      return c === 0 ? `-${v}/${-a}` : `(${n})/${-a}`
    }
    const root = (v: string) => `sqrt(${radicand(v)})`
    const shifted = (v: string) => (h === 0 ? v : xShift(-h, v))
    const pmLine = (v: string, w: string) => `${shifted(v)} = +-${root(w)}`
    const branches = (v: string, w: string) => `${v} = ${h} + ${root(w)} or ${v} = ${h} - ${root(w)}`
    const bonusInverse = h === 0 ? root('x') : `${h} + ${root('x')}`
    const final = h === 0 ? pmLine('y', 'x') : branches('y', 'x')

    const swapNudge =
      'Swap x and y: every x becomes y and every y becomes x. (Bonus path — the verdict is already settled by the twin pair.)'
    const divNudge = `Divide both sides by ${prettyInt(a)}, the number multiplying the square.`
    const rootNudge = `Undo the square with a square root — and keep both signs: ±. Two opposite numbers square to the same thing (${prettyInt(k - h)}² = ${prettyInt(twin - h)}² = 4), and that ± is exactly why f is not one-to-one.`
    const branchNudge = (v: string) =>
      `${undoConstNudge(-h, v)} Do it on both branches. Restrict f to x ≥ ${prettyInt(h)} and only the + branch survives: y = ${bonusInverse}.`

    return {
      id: inverseId('inv.quadratic-not', seed),
      moduleId: 'inverses',
      templateId: 'inv.quadratic-not',
      skill: 'inv.quadratic-not',
      genVersion: 1,
      seed,
      knobs,
      kind: 'inverse',
      title: 'Is it one-to-one?',
      instructions: `First decide: is f one-to-one? Think horizontal line test — what does an even power do to two inputs on opposite sides of x = ${prettyInt(h)}? If it is not, name the reason and show a pair of inputs with the same output. Bonus: restrict f to x ≥ ${prettyInt(h)} and find that inverse. ${INVERSE_INSTRUCTIONS}`,
      statementText: `y = ${f}`,
      vars: ['x', 'y'],
      start: `y = ${f}`,
      canonical: [
        step(`x = ${addConst(lead('y'), c)}`, 'swap_xy', swapNudge, 'swap-xy', 'swapped'),
        ...(c !== 0
          ? [
              step(
                `${xShift(-c, 'x')} = ${lead('y')}`,
                undoConstTag(c),
                undoConstNudge(c, `the squared part ${lead('y')}`),
                'add-sub',
                'constant moved',
              ),
            ]
          : []),
        ...(a !== 1 ? [step(`${sq('y')} = ${radicand('x')}`, 'div_both', divNudge, 'mul-div', 'square isolated')] : []),
        step(pmLine('y', 'x'), 'root_both_pm', rootNudge, 'root-pm', h === 0 ? 'y isolated (both branches)' : 'root taken (±)'),
        ...(h !== 0
          ? [step(branches('y', 'x'), undoConstTag(-h), branchNudge('y'), 'add-sub', 'y isolated (both branches)')]
          : []),
      ],
      canonicalAlt: [
        ...(c !== 0
          ? [
              step(
                `${xShift(-c, 'y')} = ${lead('x')}`,
                undoConstTag(c),
                undoConstNudge(c, `the squared part ${lead('x')}`),
                'add-sub',
                'constant moved',
              ),
            ]
          : []),
        ...(a !== 1 ? [step(`${sq('x')} = ${radicand('y')}`, 'div_both', divNudge, 'mul-div', 'square isolated')] : []),
        step(pmLine('x', 'y'), 'root_both_pm', rootNudge, 'root-pm', h === 0 ? 'x isolated (both branches)' : 'root taken (±)'),
        ...(h !== 0
          ? [step(branches('x', 'y'), undoConstTag(-h), branchNudge('x'), 'add-sub', 'x isolated (both branches)')]
          : []),
        step(
          final,
          'swap_xy',
          'Now swap x and y in both branches — the inverse relation is the same curve with the letters traded.',
          'swap-xy',
          'y isolated (both branches)',
        ),
      ],
      answer: { type: 'inverse', oneToOne: false, reason: 'even_power_pm', bonusInverse },
      graph: { kind: 'function', f, reflect: true, showIdentity: true, badge: 'fails vertical line test' },
      calc: calcPanels({
        family: 'not-one-to-one',
        expr: f,
        checkValue: k,
        checkOutput: fk,
        twin,
        pmInner: radicand('x'),
      }),
      check: { k, fk, twin },
      params: { a, h, c, k, fk, twin },
    }
  },
}
