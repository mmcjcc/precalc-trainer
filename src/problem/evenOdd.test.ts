import { describe, expect, it } from 'vitest'
import { decodeSlotStep, encodeSlotStep, gradeParity, gradeSlotLine, parityTable, slotHelp, slotHintView, slotLines, type ParityAnswer } from './evenOdd'

const odd: ParityAnswer = {
  type: 'parity',
  f: '5x^3 - 3x',
  verdict: 'odd',
  reason: 'values',
  fNegX: ['5(-x)^3 - 3(-x)', '-5x^3 + 3x'],
  negF: ['-(5x^3 - 3x)', '-5x^3 + 3x'],
  k: 2,
}
const ctx = { vars: ['x' as const], seed: 7 }

describe('gradeSlotLine', () => {
  it('accepts the unsimplified and the simplified f(-x) as a first line', () => {
    expect(gradeSlotLine('A', [], '5(-x)^3 - 3(-x)', odd, ctx).kind).toBe('accepted')
    expect(gradeSlotLine('A', [], '-5x^3 + 3x', odd, ctx).kind).toBe('accepted')
  })
  it('rejects a sign slip in f(-x) with a concrete message', () => {
    const r = gradeSlotLine('A', [], '-5x^3 - 3x', odd, ctx)
    expect(r.kind).toBe('rejected')
    if (r.kind === 'rejected') expect(r.message.length).toBeGreaterThan(10)
  })
  it('grades later lines as rewrites of the previous accepted line', () => {
    expect(gradeSlotLine('A', ['5(-x)^3 - 3(-x)'], '-5x^3 + 3x', odd, ctx).kind).toBe('accepted')
    expect(gradeSlotLine('A', ['5(-x)^3 - 3(-x)'], '-5x^3 - 3x', odd, ctx).kind).toBe('rejected')
  })
  it('grades slot B against -f(x)', () => {
    expect(gradeSlotLine('B', [], '-(5x^3 - 3x)', odd, ctx).kind).toBe('accepted')
    expect(gradeSlotLine('B', [], '-5x^3 + 3x', odd, ctx).kind).toBe('accepted')
    expect(gradeSlotLine('B', [], '-5x^3 - 3x', odd, ctx).kind).toBe('rejected')
  })
  it('reports parse errors with a position instead of rejecting', () => {
    const r = gradeSlotLine('A', [], '5(-x^3 - 3(-x)', odd, ctx)
    expect(r.kind).toBe('parse')
    if (r.kind === 'parse') expect(r.error.position).toBeGreaterThan(0)
  })
})

describe('slotHintView', () => {
  const cards = [
    { id: 'f-neg-x', title: 'Form f(−x)', body: 'b' },
    { id: 'simplify-neg', title: 'Simplify', body: 'b' },
    { id: 'verdict', title: 'Even vs odd', body: 'b' },
  ]
  it('walks unsimplified → simplified → verdict on the slot lines', () => {
    expect(slotHintView('A', odd, [], cards)).toMatchObject({ reveal: '5(-x)^3 - 3(-x)', card: { id: 'f-neg-x' } })
    expect(slotHintView('A', odd, ['5(-x)^3 - 3(-x)'], cards)).toMatchObject({ reveal: '-5x^3 + 3x', card: { id: 'simplify-neg' } })
    expect(slotHintView('A', odd, ['-5*x^3 + 3*x'], cards)).toMatchObject({ reveal: null, card: { id: 'verdict' } })
    expect(slotHintView('B', odd, [], cards).reveal).toBe('-(5x^3 - 3x)')
    expect(slotHintView('B', odd, ['-(5x^3 - 3x)'], cards).reveal).toBe('-5x^3 + 3x')
  })
  it('explains unexplained slot rejections by naming the move', () => {
    expect(slotHelp('A', odd.f)).toMatch(/Replace EVERY x/)
    expect(slotHelp('B', odd.f, false)).toMatch(/EVERY term/)
  })
})

describe('slot encoding', () => {
  it('round-trips through the attempt step text', () => {
    const a = encodeSlotStep('A', '-5x^3 + 3x')
    const b = encodeSlotStep('B', '-(5x^3 - 3x)')
    expect(decodeSlotStep(a)).toEqual({ slot: 'A', expr: '-5x^3 + 3x' })
    expect(slotLines([a, b, encodeSlotStep('B', '-5x^3 + 3x')])).toEqual({ A: ['-5x^3 + 3x'], B: ['-(5x^3 - 3x)', '-5x^3 + 3x'] })
    expect(decodeSlotStep('3x < 9')).toBeNull()
  })
})

describe('gradeParity', () => {
  it('accepts the right verdict and names the property with the plug-in numbers', () => {
    const g = gradeParity(odd, 'odd', null)
    expect(g.correct).toBe(true)
    expect(g.message).toMatch(/f\(2\) = 34/)
    expect(g.message).toMatch(/f\(−2\) = -34/)
  })
  it('rejects the wrong verdict and says what it is', () => {
    const g = gradeParity(odd, 'even', null)
    expect(g.correct).toBe(false)
    expect(g.message).toMatch(/odd/)
  })
  it('handles neither with the domain reason', () => {
    const sq: ParityAnswer = { type: 'parity', f: 'sqrt(x)', verdict: 'neither', reason: 'domain_asymmetric', fNegX: ['sqrt(-x)'], negF: ['-sqrt(x)'], k: 4 }
    expect(gradeParity(sq, 'neither', null).correct).toBe(false)
    expect(gradeParity(sq, 'neither', 'values').correct).toBe(false)
    expect(gradeParity(sq, 'neither', 'domain_asymmetric').correct).toBe(true)
    expect(gradeParity(sq, 'even', null).message).toMatch(/domain/)
  })
  it('builds the plus/minus k table', () => {
    const rows = parityTable(odd)
    expect(rows.map((r) => r.k).sort((a, b) => a - b)).toEqual([-2, 2])
    expect(rows.find((r) => r.k === 2)).toEqual({ k: 2, fk: 34, fNegK: -34, negFk: -34 })
  })
})
