import { describe, expect, it } from 'vitest'
import { checkDecomposition } from '@/engine'
import { gradeFunctionOps, type OpsData } from '@/content/modules/functionOps/ops'

/**
 * The worksheet the module was built from, with the name removed. These are her answers, graded by
 * the same checkers the screens use. The composition pairs at the bottom go through the existing
 * decomposition grader and are not reimplemented here.
 */
const TABLE: OpsData = {
  question: 'table',
  op: 'fog',
  at: '0',
  xs: [-5, -3, 0, 1, 2, 3, 4, 8],
  fv: [4, 2, -5, 0, -3, 8, 3, 1],
  gv: [-3, 2, 0, 1, 8, -5, 4, 3],
}

const GRAPH: OpsData = {
  question: 'graph',
  op: 'f+g',
  at: '0',
  fPts: [
    { x: -5, y: -2 },
    { x: -4, y: -1 },
    { x: -2, y: 1 },
    { x: -1, y: 1 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 3, y: -4 },
  ],
  gPts: [
    { x: -4, y: 4 },
    { x: -3, y: 3 },
    { x: -2, y: 2 },
    { x: -1, y: 2 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 5, y: -3 },
  ],
}

function at(base: OpsData, op: OpsData['op'], x: number): OpsData {
  return { ...base, op, at: String(x) }
}

describe('worksheet table', () => {
  const right: [OpsData['op'], number, string][] = [
    ['fog', -5, '2'],
    ['g-f', 2, '11'],
    ['f+f+g', -3, '6'],
    ['fgf', 3, '-320'],
    ['gof', 0, '-3'],
    ['fof', 4, '8'],
    ['f/g', 1, '0'],
    ['fog', -3, '-3'],
    ['gg', 2, '64'],
    ['f+g', 8, '4'],
    ['fogog', -3, '1'],
    ['fog', 8, '8'],
  ]

  it('grades every value she got right as correct', () => {
    for (const [op, x, text] of right) {
      expect(gradeFunctionOps(at(TABLE, op, x), text), `${op}(${x})`).toMatchObject({ verdict: 'correct' })
    }
  })
})

describe('worksheet graphs', () => {
  it('grades the values she read correctly', () => {
    expect(gradeFunctionOps(at(GRAPH, 'f+g', -1), '3')).toMatchObject({ verdict: 'correct' })
    expect(gradeFunctionOps(at(GRAPH, 'f+g', 0), '1')).toMatchObject({ verdict: 'correct' })
    expect(gradeFunctionOps(at(GRAPH, 'fg', -2), '2')).toMatchObject({ verdict: 'correct' })
  })

  it('names a sign read off the wrong side of the x-axis', () => {
    // (gf)(3) is the product. g(3) = -1; reading it as 1 gives (-4)(1) = -4. The product is 4.
    const grade = gradeFunctionOps(at(GRAPH, 'fg', 3), '-4')
    expect(grade).toMatchObject({ verdict: 'mistake', mistake: 'op_sign_flipped' })
    expect(gradeFunctionOps(at(GRAPH, 'fg', 3), '4')).toMatchObject({ verdict: 'correct' })
  })

  it('names a difference taken in the other order', () => {
    const grade = gradeFunctionOps(at(GRAPH, 'g-f', -4), '-5')
    expect(grade).toMatchObject({ verdict: 'mistake', mistake: 'op_difference_reversed' })
    expect(gradeFunctionOps(at(GRAPH, 'g-f', -4), '5')).toMatchObject({ verdict: 'correct' })
  })

  it('does not accept 2 for (f o g)(-5)', () => {
    // g(-5) is not on the graph (g starts at x = -4), so (f ∘ g)(-5) is undefined.
    // 2 is g(f(-5)) = g(-2): she used f where g was asked, then kept going. That is op_wrong_function.
    // op_order_reversed is not also emitted, because the asked inside value does not exist.
    const grade = gradeFunctionOps(at(GRAPH, 'fog', -5), '2')
    expect(grade.verdict).not.toBe('correct')
    expect(grade).toMatchObject({ verdict: 'mistake', mistake: 'op_wrong_function' })
    expect(gradeFunctionOps(at(GRAPH, 'fog', -5), 'undefined')).toMatchObject({ verdict: 'correct' })
  })
})

describe('worksheet formulas', () => {
  const pair: OpsData = { question: 'formula', op: 'f+g', at: 'x', f: '3x^2 - 10x + 8', g: '8x + 2' }

  it('grades the quadratic pair', () => {
    expect(gradeFunctionOps({ ...pair, op: 'f+g' }, '3x^2 - 2x + 10')).toMatchObject({ verdict: 'correct' })
    expect(gradeFunctionOps({ ...pair, op: 'g-f' }, '-3x^2 + 18x - 6')).toMatchObject({ verdict: 'correct' })
    expect(gradeFunctionOps({ ...pair, op: 'g-f' }, '-3x^2 - 2x + 10')).toMatchObject({ verdict: 'mistake', mistake: 'op_minus_not_distributed' })
    expect(gradeFunctionOps({ ...pair, op: 'fog' }, '192x^2 + 16x')).toMatchObject({ verdict: 'correct' })
    // (8x + 2)^2 taken as 64x^2 + 4 drops the cross term. The constant then cancels, leaving 192x^2 - 80x.
    expect(gradeFunctionOps({ ...pair, op: 'fog' }, '192x^2 - 80x')).toMatchObject({ verdict: 'mistake', mistake: 'op_inner_not_squared' })
  })

  it('grades the linear-outer pair, including the reversed order', () => {
    const swapped: OpsData = { question: 'formula', op: 'fog', at: 'x', f: '2x + 1', g: 'x^2 + 2x' }
    expect(gradeFunctionOps(swapped, '2x^2 + 4x + 1')).toMatchObject({ verdict: 'correct' })
    expect(gradeFunctionOps({ ...swapped, op: 'gof' }, '4x^2 + 8x + 3')).toMatchObject({ verdict: 'correct' })
    expect(gradeFunctionOps({ ...swapped, op: 'gof' }, '2x^2 + 4x + 1')).toMatchObject({ verdict: 'mistake', mistake: 'op_order_reversed' })
  })
})

describe('worksheet decompositions, existing grader', () => {
  it('accepts both pairs for 3x^2 - 11 and the square-root decomposition', () => {
    const h = '17/sqrt(8x - 5)'
    expect(checkDecomposition(h, '17/sqrt(x)', '8x - 5').ok).toBe(true)
    // She swapped the boxes: sqrt(8x - 5) on the outside and 17/x on the inside. That is not h.
    expect(checkDecomposition(h, 'sqrt(8x - 5)', '17/x').ok).toBe(false)
    expect(checkDecomposition('3x^2 - 11', '3x - 2', 'x^2 - 3').ok).toBe(true)
    expect(checkDecomposition('3x^2 - 11', '3x - 11', 'x^2').ok).toBe(true)
  })
})
