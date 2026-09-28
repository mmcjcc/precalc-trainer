import { describe, expect, it } from 'vitest'
import { rat, ratAbs, ratCompare, ratDiv, ratToString } from '@/notation/rational'
import type { Rational } from '@/shared/types'
import { describeAsInputs, describeTransform, gradeDescription, stepSentence } from './describe'
import { makeTransform } from './spec'
import type { DescriptionGrade, StepInput, TransformSpec } from './types'

const sentences = (spec: TransformSpec) => describeTransform(spec).map((d) => d.sentence)

const shiftH = (direction: 'left' | 'right', amount: number | string): StepInput => ({ kind: 'shift', direction, amount })
const shiftV = (direction: 'up' | 'down', amount: number | string): StepInput => ({ kind: 'shift', direction, amount })
const scale = (axis: 'horizontal' | 'vertical', word: 'stretch' | 'compress', factor: number | string): StepInput => ({ kind: 'scale', axis, word, factor })
const reflect = (axis: 'x' | 'y'): StepInput => ({ kind: 'reflect', axis })

function mistakes(g: DescriptionGrade): string[] {
  return 'checks' in g ? g.checks.filter((c) => c.mistake).map((c) => c.mistake!) : []
}

describe('describeTransform', () => {
  it.each([
    [makeTransform('square', { a: -2, h: 3, k: 1 }), ['shift right 3', 'reflect over the x-axis', 'stretch vertically by a factor of 2', 'shift up 1']],
    [makeTransform('sqrt', { b: -1, h: -2 }), ['reflect over the y-axis', 'shift left 2']],
    [makeTransform('sqrt', { b: 2, h: 3 }), ['compress horizontally by a factor of 1/2', 'shift right 3']],
    [makeTransform('square', { b: '1/2', h: 4 }), ['stretch horizontally by a factor of 2', 'shift right 4']],
    [makeTransform('reciprocal', { a: '1/3', k: -4 }), ['compress vertically by a factor of 1/3', 'shift down 4']],
    [makeTransform('cbrt', { a: -1, b: -3, h: '-1/2', k: '5/2' }), ['reflect over the y-axis', 'compress horizontally by a factor of 1/3', 'shift left 1/2', 'reflect over the x-axis', 'shift up 5/2']],
    [makeTransform('abs', { a: '3/2', b: '-2/5' }), ['reflect over the y-axis', 'stretch horizontally by a factor of 5/2', 'stretch vertically by a factor of 3/2']],
    [makeTransform('cube'), []],
  ])('%#: %j', (spec, expected) => {
    expect(sentences(spec as TransformSpec)).toEqual(expected)
  })

  it('gives the reason for each step, with the factoring for the unfactored form', () => {
    const s = makeTransform('sqrt', { a: 3, b: 2, h: 3, k: -1 })
    expect(describeTransform(s).map((d) => d.reason)).toEqual([
      'x is multiplied by 2 inside f, so x-values are divided by 2',
      'x − 3 inside f, once 2 is factored out: 2(x − 3)',
      'f is multiplied by 3, so y-values are multiplied by 3',
      '1 is subtracted after f',
    ])
    expect(describeTransform(s, { form: 'unfactored' })[1]!.reason).toBe('2x − 6 = 2(x − 3) inside f')
  })

  // Every sign combination of a and b, and h, k positive, negative and zero.
  const As = ['2', '-2', '1/2', '-1/2', '1', '-1']
  const Bs = ['1', '-1', '2', '-2', '1/3', '-1/3']
  const Hs = ['3', '-3', '0']
  const Ks = ['4', '-4', '0']

  function expectedSentences(a: Rational, b: Rational, h: Rational, k: Rational): string[] {
    const out: string[] = []
    const one = rat(1)
    const txt = (r: Rational) => ratToString(r).replace(/-/g, '−')
    if (b.n < 0) out.push('reflect over the y-axis')
    const B = ratAbs(b)
    if (ratCompare(B, one) > 0) out.push(`compress horizontally by a factor of ${txt(ratDiv(one, B))}`)
    if (ratCompare(B, one) < 0) out.push(`stretch horizontally by a factor of ${txt(ratDiv(one, B))}`)
    if (h.n > 0) out.push(`shift right ${txt(h)}`)
    if (h.n < 0) out.push(`shift left ${txt(ratAbs(h))}`)
    if (a.n < 0) out.push('reflect over the x-axis')
    const Aa = ratAbs(a)
    if (ratCompare(Aa, one) > 0) out.push(`stretch vertically by a factor of ${txt(Aa)}`)
    if (ratCompare(Aa, one) < 0) out.push(`compress vertically by a factor of ${txt(Aa)}`)
    if (k.n > 0) out.push(`shift up ${txt(k)}`)
    if (k.n < 0) out.push(`shift down ${txt(ratAbs(k))}`)
    return out
  }

  it('describes all 324 sign combinations in the standard order, and grades its own steps correct in any order', () => {
    let n = 0
    for (const a of As) for (const b of Bs) for (const h of Hs) for (const k of Ks) {
      const spec = makeTransform('sqrt', { a, b, h, k })
      expect(sentences(spec), JSON.stringify({ a, b, h, k })).toEqual(expectedSentences(spec.a, spec.b, spec.h, spec.k))
      const steps = describeAsInputs(spec)
      expect(gradeDescription(spec, steps).verdict).toBe('correct')
      expect(gradeDescription(spec, [...steps].reverse()).verdict).toBe('correct')
      expect(gradeDescription(spec, steps, { form: 'unfactored' }).verdict).toBe('correct')
      n++
    }
    expect(n).toBe(324)
  }, 120_000)
})

describe('gradeDescription — correct answers', () => {
  it('lists the steps in the confirmation', () => {
    const g = gradeDescription(makeTransform('square', { a: -2, h: 3, k: 1 }), [shiftV('up', 1), reflect('x'), scale('vertical', 'stretch', 2), shiftH('right', 3)])
    expect(g).toMatchObject({ verdict: 'correct', message: 'Correct: shift right 3, reflect over the x-axis, stretch vertically by a factor of 2 and shift up 1.' })
    expect(g.verdict === 'correct' && g.checks.every((c) => c.status === 'correct')).toBe(true)
  })

  it('accepts "compress by 2" for a compression by a factor of 1/2, and text or number amounts', () => {
    const s = makeTransform('abs', { b: 2, h: '3/2', k: -0.5 })
    expect(gradeDescription(s, [scale('horizontal', 'compress', 2), shiftH('right', '3/2'), shiftV('down', '1/2')]).verdict).toBe('correct')
    expect(gradeDescription(s, [scale('horizontal', 'compress', '1/2'), shiftH('right', 1.5), shiftV('down', 0.5)]).verdict).toBe('correct')
    // A negative amount turns the direction around.
    expect(gradeDescription(s, [scale('horizontal', 'compress', '1/2'), shiftH('left', -1.5), shiftV('up', '-1/2')]).verdict).toBe('correct')
  })

  it('treats a reflection over the y-axis of x^2 or abs as optional (it does not change the graph)', () => {
    const s = makeTransform('square', { b: -1, h: 3 })
    const without = gradeDescription(s, [shiftH('right', 3)])
    expect(without.verdict).toBe('correct')
    expect(without.verdict === 'correct' && without.message).toBe(
      'Correct: reflect over the y-axis and shift right 3. (The formula also reflects over the y-axis, but for f(x) = x^2 that does not change the graph: f(−x) = f(x).)',
    )
    expect(gradeDescription(s, [reflect('y'), shiftH('right', 3)]).verdict).toBe('correct')
  })

  it('says so when there is nothing to describe', () => {
    expect(gradeDescription(makeTransform('cbrt'), [])).toMatchObject({ verdict: 'correct', message: 'Correct: g is f itself: no transformations.' })
  })
})

describe('gradeDescription — each named mistake', () => {
  it('h_shift_reversed: f(x − 3) described as shift left 3', () => {
    const g = gradeDescription(makeTransform('square', { h: 3 }), [shiftH('left', 3)])
    expect(g).toMatchObject({
      verdict: 'mistake',
      mistake: 'h_shift_reversed',
      witness: 'The inside of f, x − 3, is 0 at x = 3: the point of f at x = 0 moves to x = 3. So g shifts right 3, not left 3.',
    })
  })

  it('v_shift_reversed: f(x) + 1 described as shift down 1', () => {
    expect(gradeDescription(makeTransform('abs', { k: 1 }), [shiftV('down', 1)])).toMatchObject({
      verdict: 'mistake',
      mistake: 'v_shift_reversed',
      witness: 'The + 1 after f adds 1 to every output, so g shifts up 1, not down 1.',
    })
    expect(gradeDescription(makeTransform('abs', { k: -4 }), [shiftV('up', 4)])).toMatchObject({
      mistake: 'v_shift_reversed',
      witness: 'The − 4 after f subtracts 4 from every output, so g shifts down 4, not up 4.',
    })
  })

  it('h_factor_inverted: f(2x) described as a stretch by 2 (and f((1/3)x) as a compression by 1/3)', () => {
    expect(gradeDescription(makeTransform('sqrt', { b: 2 }), [scale('horizontal', 'stretch', 2)])).toMatchObject({
      verdict: 'mistake',
      mistake: 'h_factor_inverted',
      witness: 'Inside f, x is multiplied by 2. f(2x) at x = 1 is f(2): every x-value is divided by 2, so compress horizontally by a factor of 1/2, not stretch horizontally by a factor of 2.',
    })
    expect(gradeDescription(makeTransform('sqrt', { b: '-1/3' }), [reflect('y'), scale('horizontal', 'compress', '1/3')])).toMatchObject({
      mistake: 'h_factor_inverted',
      witness:
        'Inside f, x is multiplied by 1/3 (the minus sign is the reflection). f((1/3)x) at x = 1 is f(1/3): every x-value is divided by 1/3, so stretch horizontally by a factor of 3, not compress horizontally by a factor of 1/3.',
    })
  })

  it('v_factor_inverted: (1/2)f(x) described as a stretch by 2, 3f(x) as a compression by 1/3', () => {
    expect(gradeDescription(makeTransform('cube', { a: '1/2' }), [scale('vertical', 'stretch', 2)])).toMatchObject({
      mistake: 'v_factor_inverted',
      witness: 'f is multiplied by 1/2, so every y-value is multiplied by 1/2: compress vertically by a factor of 1/2, not stretch vertically by a factor of 2.',
    })
    expect(gradeDescription(makeTransform('cube', { a: 3 }), [scale('vertical', 'compress', '1/3')])).toMatchObject({ mistake: 'v_factor_inverted' })
  })

  it('reflection_wrong_axis: −f(x) described as a y-axis reflection, f(−x) as an x-axis one', () => {
    const g = gradeDescription(makeTransform('sqrt', { a: -1 }), [reflect('y')])
    expect(g).toMatchObject({
      verdict: 'mistake',
      mistake: 'reflection_wrong_axis',
      witness: 'The minus sign is in front of f, so it changes the sign of the outputs: reflect over the x-axis. A minus sign on x inside f, as in f(−x), is what reflects over the y-axis.',
    })
    // One mistake, not a missing step plus an extra one.
    expect(g.verdict === 'mistake' && g.checks.map((c) => c.status)).toEqual(['wrong'])
    expect(gradeDescription(makeTransform('sqrt', { b: -1, h: 2 }), [reflect('x'), shiftH('right', 2)])).toMatchObject({
      mistake: 'reflection_wrong_axis',
      witness: 'The minus sign is on x inside f (−(x − 2)), so it changes the sign of the inputs: reflect over the y-axis. A minus sign in front of f, as in −f(x), is what reflects over the x-axis.',
    })
  })

  it('reflection_wrong_axis for an odd parent says the graphs happen to agree but the formula does not', () => {
    const g = gradeDescription(makeTransform('cube', { a: -1 }), [reflect('y')])
    expect(g.verdict === 'mistake' && g.witness).toBe(
      'The minus sign is in front of f, so it changes the sign of the outputs: reflect over the x-axis. A minus sign on x inside f, as in f(−x), is what reflects over the y-axis. (For f(x) = x^3, f(−x) = −f(x), so the two reflections happen to draw the same graph, but the formula says the x-axis.)',
    )
  })

  it('unfactored_shift: f(2x − 6) described as shift right 6', () => {
    const s = makeTransform('sqrt', { b: 2, h: 3 })
    const g = gradeDescription(s, [scale('horizontal', 'compress', '1/2'), shiftH('right', 6)], { form: 'unfactored' })
    expect(g).toMatchObject({
      verdict: 'mistake',
      mistake: 'unfactored_shift',
      witness: 'Factor 2 out of the inside first: 2x − 6 = 2(x − 3). The shift is what is subtracted from x after factoring, so g shifts right 3, not right 6.',
    })
    // Stated factored, the same answer is still named (she multiplied the shift by 2).
    expect(gradeDescription(s, [scale('horizontal', 'compress', '1/2'), shiftH('right', 6)])).toMatchObject({
      mistake: 'unfactored_shift',
      witness: 'In 2(x − 3) the 2 multiplies (x − 3) as a whole, so g shifts right 3. Right 6 comes from the multiplied-out inside 2x − 6, whose constant is not the shift.',
    })
  })

  it('f(−x + 3): "shift left 3" is the unfactored trap when written unfactored, a reversed shift when factored', () => {
    const s = makeTransform('sqrt', { b: -1, h: 3 })
    const steps = [reflect('y'), shiftH('left', 3)]
    expect(mistakes(gradeDescription(s, steps, { form: 'unfactored' }))).toEqual(['unfactored_shift'])
    expect(mistakes(gradeDescription(s, steps))).toEqual(['h_shift_reversed'])
  })

  it('missing_reflection and missing_step name what is left out', () => {
    const s = makeTransform('abs', { a: -2, h: 3, k: 1 })
    const g = gradeDescription(s, [shiftH('right', 3), scale('vertical', 'stretch', 2)])
    expect(g.verdict).toBe('mistake')
    expect(g.verdict === 'mistake' && g.checks.filter((c) => c.status === 'missing').map((c) => [c.mistake, c.message])).toEqual([
      ['missing_reflection', 'Missing: reflect over the x-axis. The minus sign in front of f (a = −2) changes the sign of every output.'],
      ['missing_step', 'Missing: shift up 1. 1 is added after f.'],
    ])
    expect(g.verdict === 'mistake' && g.mistake).toBe('missing_reflection')
    // Both reflections of an odd parent: the note says why the shape looks unchanged.
    const both = gradeDescription(makeTransform('cube', { a: -1, b: -1 }), [])
    expect(mistakes(both)).toEqual(['missing_reflection', 'missing_reflection'])
    expect(both.verdict === 'mistake' && both.witness).toContain('the two reflections together give back the same shape')
  })

  it('extra_step: a step g does not have, or a second step for the same slot', () => {
    const g = gradeDescription(makeTransform('square', { h: 3 }), [shiftH('right', 3), shiftV('up', 2), shiftH('left', 2)])
    expect(g.verdict === 'mistake' && g.checks.map((c) => [c.status, c.message])).toEqual([
      ['correct', 'Shift right 3: x − 3 inside f.'],
      ['extra', 'You listed two horizontal shifts; g has one: shift right 3.'],
      ['extra', 'Shift up 2 is not part of g: nothing is added after f.'],
    ])
    expect(gradeDescription(makeTransform('square', { a: -1 }), [reflect('x'), scale('vertical', 'stretch', 2)])).toMatchObject({
      mistake: 'extra_step',
      witness: 'Stretch vertically by a factor of 2 is not part of g: f is only multiplied by −1, which is a reflection, not a stretch.',
    })
    expect(mistakes(gradeDescription(makeTransform('square', { h: 1 }), [shiftH('right', 1), reflect('y')]))).toEqual(['extra_step'])
  })

  it('reports every wrong step, the first named one on top', () => {
    const g = gradeDescription(makeTransform('square', { a: -2, h: 3, k: 1 }), [shiftH('left', 3), reflect('y'), scale('vertical', 'compress', '1/2'), shiftV('down', 1)])
    expect(mistakes(g)).toEqual(['h_shift_reversed', 'reflection_wrong_axis', 'v_factor_inverted', 'v_shift_reversed'])
    expect(g.verdict === 'mistake' && g.mistake).toBe('h_shift_reversed')
  })

  it('plain wrong amounts get a specific sentence, not a named mistake', () => {
    expect(gradeDescription(makeTransform('square', { h: 3 }), [shiftH('right', 5)])).toMatchObject({
      verdict: 'wrong',
      message: 'g shifts right 3, not right 5. The inside x − 3 is 0 at x = 3.',
    })
    expect(gradeDescription(makeTransform('square', { b: 2, h: 3 }), [scale('horizontal', 'compress', '1/2'), shiftH('right', 4)])).toMatchObject({
      verdict: 'wrong',
      message: 'g shifts right 3, not right 4. Factor 2 out of the inside: 2(x − 3).',
    })
    expect(gradeDescription(makeTransform('square', { a: 3 }), [scale('vertical', 'stretch', 4)])).toMatchObject({
      verdict: 'wrong',
      message: "g's vertical factor is 3 (stretch vertically by a factor of 3), not 4: f is multiplied by 3, so y-values are multiplied by 3.",
    })
  })

  it('never names a mistake on the right answer', () => {
    for (const parent of ['square', 'cube', 'sqrt', 'cbrt', 'abs', 'reciprocal'] as const) {
      for (const spec of [makeTransform(parent, { a: -2, b: 2, h: 3, k: 1 }), makeTransform(parent, { a: '1/2', b: '-1/3', h: -2, k: -5 })]) {
        for (const form of ['factored', 'unfactored'] as const) {
          const g = gradeDescription(spec, describeAsInputs(spec), { form })
          expect(g.verdict, `${parent} ${form}`).toBe('correct')
          expect(mistakes(g)).toEqual([])
        }
      }
    }
  }, 120_000)
})

describe('gradeDescription — unreadable steps', () => {
  it.each([
    [[shiftH('right', 'three')], 0, 'Could not read the shift amount "three". Type a number like 3, 1/2 or 2.5.'],
    [[reflect('x'), shiftV('up', 0)], 1, 'A shift by 0 does nothing. Leave that step out.'],
    [[scale('vertical', 'stretch', -2)], 0, 'A stretch or compression factor is a positive number. A minus sign is a reflection: add it as its own step.'],
    [[scale('horizontal', 'compress', 1)], 0, 'A factor of 1 changes nothing. Leave that step out.'],
  ])('%#', (steps, index, message) => {
    expect(gradeDescription(makeTransform('square', { a: -2, h: 3 }), steps as StepInput[])).toEqual({ verdict: 'invalid', message, index })
  })

  it('an invalid spec is unsupported, not her fault', () => {
    const bad = { parent: 'square', a: rat(0), b: rat(1), h: rat(0), k: rat(0) } as TransformSpec
    expect(gradeDescription(bad, []).verdict).toBe('unsupported')
  })

  it('stepSentence reads normalized steps', () => {
    expect(stepSentence({ kind: 'scale', axis: 'vertical', word: 'compress', factor: rat(2, 3) })).toBe('compress vertically by a factor of 2/3')
    expect(stepSentence({ kind: 'shift', direction: 'left', amount: rat(7, 2) })).toBe('shift left 7/2')
    expect(stepSentence({ kind: 'reflect', axis: 'y' })).toBe('reflect over the y-axis')
  })
})
