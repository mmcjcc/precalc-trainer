import { describe, expect, it } from 'vitest'
import { ratToString } from '@/notation/rational'
import { gradeMappedPoint, mappedPointMistakes, parsePointAnswer } from './points'
import { makeTransform, mapPoint, PARENTS } from './spec'
import { pointText } from './text'
import type { TransformGrade } from './types'

const kinds = (g: TransformGrade) => (g.verdict === 'mistake' ? g.mistake : g.verdict)

describe('parsePointAnswer', () => {
  it.each([
    ['(5, -3)', '5', '-3'],
    ['5,-3', '5', '-3'],
    ['  ( 1/2 , -0.5 ) ', '1/2', '-1/2'],
    ['(-3/2, 4)', '-3/2', '4'],
    ['(2.5, 7/2)', '5/2', '7/2'],
    ['(4/2 + 3, −1)', '5', '-1'],
    ['((1), (-2))', '1', '-2'],
    ['(sqrt(9), 0)', '3', '0'],
  ])('%s', (text, x, y) => {
    const p = parsePointAnswer(text)
    expect(p.ok).toBe(true)
    if (p.ok) expect([ratToString(p.x!), ratToString(p.y!)]).toEqual([x, y])
  })

  it('keeps an irrational coordinate as "not rational" (never correct), not as an error', () => {
    const p = parsePointAnswer('(sqrt(2), 1)')
    expect(p.ok && p.x).toBeNull()
  })

  it.each([
    ['', 'Type the point first, like (5, -3).', 0],
    ['(5 -3)', 'Write the point as (x, y) with a comma between the coordinates, like (5, -3).', 5],
    ['(1, 2, 3)', 'A point has two coordinates, (x, y): there is an extra comma here.', 5],
    ['(x, 2)', 'Each coordinate is a number: work it out so no x is left.', 1],
    ['(3, 2x)', 'Each coordinate is a number: work it out so no x is left.', 5],
    ['(1/0, 2)', 'The x-coordinate is undefined as written (a division by 0?).', 1],
    ['(5, )', 'The y-coordinate is missing: write the point as (x, y).', 3],
    ['(4, -1', 'A closing ) is missing.', 6],
    ['4, -1)', 'There is a ) without a matching (.', 5],
  ])('rejects %j', (text, message, position) => {
    const p = parsePointAnswer(text)
    expect(p.ok).toBe(false)
    if (!p.ok) {
      expect(p.error.message).toBe(message)
      expect(p.error.position).toBe(position)
    }
  })
})

describe('gradeMappedPoint', () => {
  const sp = makeTransform('square', { a: -2, b: 2, h: 3, k: 1 })

  it('accepts the exact image in any equivalent form', () => {
    for (const ans of ['(5, -31)', '5, -31', '(10/2, -31.0)', '( 5 , −31 )']) {
      expect(gradeMappedPoint(sp, { x: 4, y: 16 }, ans)).toEqual({
        verdict: 'correct',
        message: 'Correct: (4, 16) on f moves to (5, −31) on g (x = 4 ÷ 2 + 3 = 5, y = −2·16 + 1 = −31).',
      })
    }
  })

  it('lists every mistake for one point, with the exact wrong point each gives', () => {
    const c = mappedPointMistakes(sp, { x: 4, y: 16 })!
    expect(c.map((m) => [m.kind, m.text, m.shadows])).toEqual([
      ['h_shift_reversed', '(-1, -31)', []],
      ['v_shift_reversed', '(5, -33)', []],
      ['unfactored_shift', '(8, -31)', []],
      ['missing_reflection', '(5, 33)', []],
      ['reflection_wrong_axis', '(1, 33)', ['factors_swapped']],
      ['h_factor_inverted', '(11, -31)', []],
      ['v_factor_inverted', '(5, -7)', []],
      ['h_order', '(7/2, -31)', []],
      ['v_order', '(5, -34)', []],
      ['factors_swapped', '(-5, 9)', []],
    ])
    // Written unfactored, the unfactored trap comes first and there is no order-of-operations x candidate.
    expect(mappedPointMistakes(sp, { x: 4, y: 16 }, { form: 'unfactored' })!.map((m) => m.kind)).toEqual([
      'unfactored_shift',
      'h_shift_reversed',
      'v_shift_reversed',
      'missing_reflection',
      'reflection_wrong_axis',
      'h_factor_inverted',
      'v_factor_inverted',
      'v_order',
      'factors_swapped',
    ])
  })

  it('every candidate grades as its own mistake, with its witness', () => {
    for (const form of ['factored', 'unfactored'] as const) {
      for (const c of mappedPointMistakes(sp, { x: 4, y: 16 }, { form })!) {
        expect(gradeMappedPoint(sp, { x: 4, y: 16 }, c.text, { form })).toEqual({ verdict: 'mistake', mistake: c.kind, witness: c.witness })
      }
    }
  })

  it.each([
    // [what, spec, point on f, her answer, kind, witness]
    ['h_shift_reversed', makeTransform('square', { h: -2, k: -1 }), [1, 1], '(3, 0)', 'The inside of f, x + 2, is 0 at x = −2, so the graph shifts left 2: subtract 2 from the x-coordinate. x = 1 − 2 = −1. Your x-coordinate, 3, adds 2.'],
    ['v_shift_reversed', makeTransform('sqrt', { k: -4 }), [4, 2], '(4, 6)', 'The − 4 after f moves every point down 4: y = 2 − 4 = −2. Your y-coordinate, 6, moves it up 4.'],
    ['h_factor_inverted', makeTransform('sqrt', { b: 2 }), [4, 2], '(8, 2)', 'The 2 multiplying x inside f squeezes the graph toward the y-axis: DIVIDE the x-coordinate by 2. x = 4 ÷ 2 = 2. Your x-coordinate, 8, multiplies by 2: 2·4 = 8.'],
    ['v_factor_inverted', makeTransform('abs', { a: '1/2' }), [-2, 2], '(-2, 4)', 'The 1/2 in front of f MULTIPLIES every y-value by 1/2: y = (1/2)·2 = 1. Your y-coordinate, 4, divides by 1/2: 2 ÷ (1/2) = 4.'],
    ['h_order', makeTransform('sqrt', { b: 2, h: 3 }), [4, 2], '(7/2, 2)', 'Divide by 2 FIRST, then shift (solve 2(x − 3) = 4): x = 4 ÷ 2 + 3 = 5. Your x-coordinate, 7/2, shifts first: (4 + 3) ÷ 2 = 7/2.'],
    ['v_order', makeTransform('cube', { a: 3, k: 2 }), [1, 1], '(1, 9)', 'Multiply by 3 FIRST, then shift: y = 3·1 + 2 = 5. Your y-coordinate, 9, shifts first: 3·(1 + 2) = 9.'],
    ['factors_swapped', makeTransform('square', { a: 2, b: 3 }), [1, 1], '(1/2, 3)', '2 is in front of f, so it acts on y (y = 2·1 = 2); 3 is inside f with x, so it acts on x (x = 1 ÷ 3 = 1/3). Your point (1/2, 3) uses 2 on x and 3 on y.'],
    ['reflection_wrong_axis', makeTransform('sqrt', { a: -1 }), [4, 2], '(-4, 2)', 'The minus sign in front of f changes the sign of y, not x: it reflects over the x-axis. The point is (4, −2); yours, (−4, 2), flips x instead.'],
    ['missing_reflection', makeTransform('abs', { a: -1, h: 2 }), [1, 1], '(3, 1)', 'The minus sign in front of f (a = −1) flips the point over the x-axis: y = −1·1 = −1. Your y-coordinate, 1, leaves out the minus sign.'],
    ['missing_reflection', makeTransform('sqrt', { b: -1 }), [4, 2], '(4, 2)', 'The minus sign on x inside f (b = −1) flips the point over the y-axis: x = 4 ÷ (−1) = −4. Your x-coordinate, 4, leaves out the minus sign.'],
  ])('%s', (kind, spec, [x, y], answer, witness) => {
    expect(gradeMappedPoint(spec, { x: x!, y: y! }, answer)).toEqual({ verdict: 'mistake', mistake: kind, witness })
    const right = pointText(mapPoint(spec, { x: x!, y: y! }))
    expect(gradeMappedPoint(spec, { x: x!, y: y! }, right).verdict).toBe('correct')
  })

  it('unfactored_shift: for f(2x − 6) she used 6 instead of 6/2', () => {
    const s = makeTransform('sqrt', { b: 2, h: 3 })
    expect(gradeMappedPoint(s, { x: 4, y: 2 }, '(8, 2)', { form: 'unfactored' })).toEqual({
      verdict: 'mistake',
      mistake: 'unfactored_shift',
      witness: 'Factor 2 out first: 2x − 6 = 2(x − 3), so the shift is right 3, not right 6. x = 4 ÷ 2 + 3 = 5. Your x-coordinate, 8, used 6: 4 ÷ 2 + 6 = 8.',
    })
    // f(−x + 3): she read +3 as "left 3". Written unfactored that is the trap; factored, a reversed shift.
    const r = makeTransform('sqrt', { b: -1, h: 3 })
    expect(kinds(gradeMappedPoint(r, { x: 4, y: 2 }, '(-7, 2)', { form: 'unfactored' }))).toBe('unfactored_shift')
    expect(kinds(gradeMappedPoint(r, { x: 4, y: 2 }, '(-7, 2)'))).toBe('h_shift_reversed')
  })

  it('reports coincidences between mistakes in shadows (templates avoid such points)', () => {
    // p = 2, b = 2, h = 3: the unfactored shift (2/2 + 6) and multiplying by b (2·2 + 3) both give 7.
    const s = makeTransform('square', { b: 2, h: 3 })
    const hit = mappedPointMistakes(s, { x: 2, y: 4 })!.find((c) => c.text === '(7, 4)')!
    expect([hit.kind, hit.shadows]).toEqual(['unfactored_shift', ['h_factor_inverted']])
  })

  it('never names a mistake on the right answer, for every parent and key point', () => {
    for (const parent of Object.keys(PARENTS) as (keyof typeof PARENTS)[]) {
      for (const spec of [makeTransform(parent, { a: -2, b: 2, h: 3, k: 1 }), makeTransform(parent, { a: '1/2', b: '-1/3', h: -2, k: -5 })]) {
        for (const p of PARENTS[parent].keyPoints) {
          const right = pointText(mapPoint(spec, p))
          for (const form of ['factored', 'unfactored'] as const) {
            expect(gradeMappedPoint(spec, p, right, { form }).verdict).toBe('correct')
            expect(mappedPointMistakes(spec, p, { form })!.some((c) => c.text === right)).toBe(false)
          }
        }
      }
    }
  }, 120_000)

  it('a plain wrong answer says which coordinate is right and how to get the other', () => {
    expect(gradeMappedPoint(sp, { x: 4, y: 16 }, '(5, 2.333)')).toEqual({
      verdict: 'wrong',
      message: 'Your x-coordinate 5 is right. For y, multiply by −2, then add 1: y = −2·16 + 1 = −31.',
    })
    expect(gradeMappedPoint(sp, { x: 4, y: 16 }, '(6, -31)')).toEqual({
      verdict: 'wrong',
      message: 'Your y-coordinate −31 is right. For x, divide by 2, then add 3: x = 4 ÷ 2 + 3 = 5.',
    })
    expect(gradeMappedPoint(sp, { x: 4, y: 16 }, '(7, 5)')).toEqual({
      verdict: 'wrong',
      message: '(4, 16) on f moves to (5, −31) on g. For x, divide by 2, then add 3: x = 4 ÷ 2 + 3 = 5. For y, multiply by −2, then add 1: y = −2·16 + 1 = −31.',
    })
    // A rounded decimal for an exact fraction.
    const s = makeTransform('sqrt', { b: 3, h: 1 })
    expect(gradeMappedPoint(s, { x: 4, y: 2 }, '(2.33, 2)')).toEqual({
      verdict: 'wrong',
      message: 'Your y-coordinate 2 is right. For x, divide by 3, then add 1: x = 4 ÷ 3 + 1 = 7/3. 2.33 is a rounded decimal: give the exact value, 7/3.',
    })
  })

  it('unreadable answers are invalid; an invalid problem is unsupported', () => {
    expect(gradeMappedPoint(sp, { x: 4, y: 16 }, '(5; -31)')).toMatchObject({ verdict: 'invalid', position: 2, length: 1 })
    expect(gradeMappedPoint(sp, { x: 'four', y: 16 }, '(5, -31)').verdict).toBe('unsupported')
    expect(gradeMappedPoint({ ...sp, b: { n: 0, d: 1 } }, { x: 4, y: 16 }, '(5, -31)').verdict).toBe('unsupported')
  })
})
