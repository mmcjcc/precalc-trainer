import { describe, expect, it } from 'vitest'
import { verifyStep } from '@/engine'
import { gradeFinalAnswer, previewInterval } from './inequality'

/**
 * Her real Precalculus Quiz 1 (September 2026), typed in as she wrote it. Each case pins down that the
 * trainer catches the slip she actually made and names it, so practice here would have warned her.
 */

describe('Quiz 1, question 1: number line (-inf, -5] U (2, 7]', () => {
  const set = previewInterval('(-inf, -5] U (2, 7]')!
  const target = { set, requireInterval: true, requireSetBuilder: true }

  it('accepts the right answer in both notations', () => {
    const g = gradeFinalAnswer('(-inf, -5] U (2, 7]', '{x | x <= -5 or 2 < x <= 7}', target)
    expect(g.done).toBe(true)
  })

  it('names her interval slips: the backwards ray and the comma instead of U', () => {
    const g = gradeFinalAnswer('[-5, -inf), (2, 7]', '{x | x <= -5 or 2 < x <= 7}', target)
    console.log('Q1 interval:', JSON.stringify({ status: g.interval.status, pattern: g.interval.pattern?.id, message: g.interval.message }))
    expect(g.done).toBe(false)
    expect(g.interval.pattern?.id).toBeDefined()
  })

  it('names the comma between the two intervals once the ray is the right way round', () => {
    const g = gradeFinalAnswer('(-inf, -5], (2, 7]', '{x | x <= -5 or 2 < x <= 7}', target)
    console.log('Q1 comma only:', JSON.stringify({ status: g.interval.status, pattern: g.interval.pattern?.id, message: g.interval.message }))
    expect(g.done).toBe(false)
    expect(g.interval.pattern?.id).toBe('dropped_union')
  })

  it('handles her set-builder exactly as written', () => {
    const g = gradeFinalAnswer('(-inf, -5] U (2, 7]', '{x | x >= -5, 2 < 7}', target)
    console.log('Q1 set-builder as written:', JSON.stringify({ status: g.setBuilder.status, pattern: g.setBuilder.pattern?.id, message: g.setBuilder.message }))
    expect(g.done).toBe(false)
  })

  it('catches her set-builder: x >= -5 points the wrong way', () => {
    const g = gradeFinalAnswer('(-inf, -5] U (2, 7]', '{x | x >= -5 or 2 < x <= 7}', target)
    console.log('Q1 set-builder:', JSON.stringify({ status: g.setBuilder.status, pattern: g.setBuilder.pattern?.id, mismatch: g.mismatch?.id }))
    expect(g.done).toBe(false)
  })
})

describe('Quiz 1, question 2: -13x - 20 >= -3(2x - 5)', () => {
  it('flags dividing by -7 without flipping', () => {
    const r = verifyStep('-7x >= 35', 'x >= -5', { vars: ['x'], seed: 1 })
    expect(r.ok).toBe(false)
    expect(r.pattern?.id).toBe('no_sign_flip')
  })

  it('accepts the flip', () => {
    expect(verifyStep('-7x >= 35', 'x <= -5', { vars: ['x'], seed: 1 }).ok).toBe(true)
  })
})

describe('Quiz 1, question 5: inverse of f(x) = cbrt(5x - 2) + 4', () => {
  it('names cubing both sides before subtracting the 4', () => {
    const r = verifyStep('x = cbrt(5y - 2) + 4', 'x^3 = 5y - 2 + 4', { vars: ['x', 'y'], seed: 1 })
    console.log('Q5 cube first:', JSON.stringify({ ok: r.ok, verdict: r.verdict, pattern: r.pattern?.id, title: r.pattern?.title, witness: r.pattern?.witness }))
    expect(r.ok).toBe(false)
    expect(r.pattern?.id).toBeDefined()
  })

  it('accepts the order her teacher wrote: subtract 4, then cube', () => {
    expect(verifyStep('x = cbrt(5y - 2) + 4', 'x - 4 = cbrt(5y - 2)', { vars: ['x', 'y'], seed: 1 }).ok).toBe(true)
    expect(verifyStep('x - 4 = cbrt(5y - 2)', '(x - 4)^3 = 5y - 2', { vars: ['x', 'y'], seed: 1 }).ok).toBe(true)
  })
})
