import { describe, expect, it } from 'vitest'
import { buildExpressSpec } from './index'
import { gradeTiExpressExpr, verifyTrigStep, type TrigMistakeId } from '@/engine/trig'

describe('trigIdentities hand-worked textbook anchors', () => {
  it('ti.express: sin θ in terms of cos θ in Quadrant III', () => {
    const spec = buildExpressSpec('sin', 'cos', 3)
    // Part 1: sin²θ + cos²θ = 1
    expect(spec.identityText).toBe('sin²θ + cos²θ = 1')
    // Part 2: − (negative in QIII)
    expect(spec.signText).toBe('−')
    // Part 3: −√(1 − cos²θ)
    expect(spec.answerText).toBe('−√(1 − cos²θ)')

    for (const accepted of [
      '-sqrt(1 - cos^2(θ))',
      '-sqrt(1 - (cos θ)^2)',
      '-sqrt(1 - cos²θ)',
      '-(1 - cos^2(θ))^(1/2)',
    ]) {
      expect(gradeTiExpressExpr(spec, accepted), accepted).toEqual({ verdict: 'correct' })
    }

    // Named mistakes on Part 3
    expect(gradeTiExpressExpr(spec, '+sqrt(1 - cos^2(θ))')).toMatchObject({
      verdict: 'mistake',
      id: 'trig_identity_sign_lost',
    })
    expect(gradeTiExpressExpr(spec, '-sqrt(1 + cos^2(θ))')).toMatchObject({
      verdict: 'mistake',
      id: 'trig_pythag_sign',
    })
    expect(gradeTiExpressExpr(spec, '-sqrt(1 - cos θ)')).toMatchObject({
      verdict: 'mistake',
      id: 'trig_pythag_no_square',
    })
  })

  it('ti.simplify: tan x cos x -> (sin x / cos x) cos x -> sin x', () => {
    const ctx = { kind: 'simplify' as const, variable: 'x' as const, start: 'tan x cos x' }
    const s1 = verifyTrigStep('tan x cos x', '(sin x / cos x) cos x', ctx)
    expect(s1.ok).toBe(true)
    expect(s1.done).toBe(false)
    expect(s1.family).toBe('quotient')

    const s2 = verifyTrigStep('(sin x / cos x) cos x', 'sin x', ctx)
    expect(s2.ok).toBe(true)
    expect(s2.done).toBe(true)
  })

  it('ti.simplify: (1 − cos²x) / sin x -> sin²x / sin x -> sin x', () => {
    const ctx = { kind: 'simplify' as const, variable: 'x' as const, start: '(1 − cos²x) / sin x' }
    const s1 = verifyTrigStep('(1 − cos²x) / sin x', 'sin²x / sin x', ctx)
    expect(s1.ok).toBe(true)
    expect(s1.done).toBe(false)
    expect(s1.family).toBe('pythagorean')

    const s2 = verifyTrigStep('sin²x / sin x', 'sin x', ctx)
    expect(s2.ok).toBe(true)
    expect(s2.done).toBe(true)
  })

  it('ti.simplify: sec²x (1 − sin²x) -> sec²x cos²x -> (1 / cos²x) cos²x -> 1', () => {
    const ctx = { kind: 'simplify' as const, variable: 'x' as const, start: 'sec²x (1 − sin²x)' }
    const s1 = verifyTrigStep('sec²x (1 − sin²x)', 'sec²x cos²x', ctx)
    expect(s1.ok).toBe(true)
    expect(s1.done).toBe(false)

    const s2 = verifyTrigStep('sec²x cos²x', '(1 / cos²x) cos²x', ctx)
    expect(s2.ok).toBe(true)
    expect(s2.done).toBe(false)

    const s3 = verifyTrigStep('(1 / cos²x) cos²x', '1', ctx)
    expect(s3.ok).toBe(true)
    expect(s3.done).toBe(true)
  })

  it('ti.verify: sec x − cos x = sin x tan x', () => {
    const ctx = {
      kind: 'verify' as const,
      variable: 'x' as const,
      start: 'sec x − cos x',
      target: 'sin x tan x',
    }
    const s1 = verifyTrigStep('sec x − cos x', '(1 / cos x) − cos x', ctx)
    expect(s1.ok).toBe(true)
    expect(s1.done).toBe(false)

    const s2 = verifyTrigStep('(1 / cos x) − cos x', '(1 − cos²x) / cos x', ctx)
    expect(s2.ok).toBe(true)
    expect(s2.done).toBe(false)

    const s3 = verifyTrigStep('(1 − cos²x) / cos x', 'sin²x / cos x', ctx)
    expect(s3.ok).toBe(true)
    expect(s3.done).toBe(false)

    const s4 = verifyTrigStep('sin²x / cos x', 'sin x tan x', ctx)
    expect(s4.ok).toBe(true)
    expect(s4.done).toBe(true)
  })

  it('ti.verify: tan x + cot x = sec x csc x (canonical walk, off-walk valid step, and 1-step jump rejection)', () => {
    const ctx = {
      kind: 'verify' as const,
      variable: 'x' as const,
      start: 'tan x + cot x',
      target: 'sec x csc x',
    }

    // Jumping directly from tan x + cot x to sec x csc x in one step is rejected
    const jump = verifyTrigStep('tan x + cot x', 'sec x csc x', ctx)
    expect(jump.ok).toBe(false)

    // Canonical walk
    const s1 = verifyTrigStep('tan x + cot x', '(sin x / cos x) + (cos x / sin x)', ctx)
    expect(s1.ok).toBe(true)
    expect(s1.done).toBe(false)

    const s2 = verifyTrigStep('(sin x / cos x) + (cos x / sin x)', '(sin²x + cos²x) / (sin x cos x)', ctx)
    expect(s2.ok).toBe(true)
    expect(s2.done).toBe(false)

    const s3 = verifyTrigStep('(sin²x + cos²x) / (sin x cos x)', '1 / (sin x cos x)', ctx)
    expect(s3.ok).toBe(true)
    expect(s3.done).toBe(false)

    const s4 = verifyTrigStep('1 / (sin x cos x)', 'sec x csc x', ctx)
    expect(s4.ok).toBe(true)
    expect(s4.done).toBe(true)

    // Off-walk valid step: (1 / cos x)(1 / sin x) before sec x csc x
    const offWalk = verifyTrigStep('1 / (sin x cos x)', '(1 / cos x)(1 / sin x)', ctx)
    expect(offWalk.ok).toBe(true)
    expect(offWalk.done).toBe(false)

    const finishOffWalk = verifyTrigStep('(1 / cos x)(1 / sin x)', 'sec x csc x', ctx)
    expect(finishOffWalk.ok).toBe(true)
    expect(finishOffWalk.done).toBe(true)
  })

  it('accepts off-walk valid routes on ti.simplify and finishes cleanly', () => {
    const ctx = { kind: 'simplify' as const, variable: 'x' as const, start: '(1 − sin²x) / cos x' }

    // Route A (canonical): cos²x / cos x -> cos x
    const a1 = verifyTrigStep('(1 − sin²x) / cos x', 'cos²x / cos x', ctx)
    expect(a1.ok).toBe(true)
    expect(a1.done).toBe(false)
    const a2 = verifyTrigStep('cos²x / cos x', 'cos x', ctx)
    expect(a2.ok).toBe(true)
    expect(a2.done).toBe(true)

    // Route B (off-walk): split numerator 1/cos x − sin²x/cos x -> sec x − sin x tan x -> cos x
    const b1 = verifyTrigStep('(1 − sin²x) / cos x', '(1 / cos x) − (sin²x / cos x)', ctx)
    expect(b1.ok).toBe(true)
    expect(b1.done).toBe(false)
    const b2 = verifyTrigStep('(1 / cos x) − (sin²x / cos x)', 'sec x − sin x tan x', ctx)
    expect(b2.ok).toBe(true)
    expect(b2.done).toBe(false)
    const b3 = verifyTrigStep('sec x − sin x tan x', 'cos x', ctx)
    expect(b3.ok).toBe(true)
    expect(b3.done).toBe(true)
  })

  it('triggers all 8 new trig_ mistake IDs on hand-written bad lines', () => {
    const badSteps: [string, string, TrigMistakeId][] = [
      ['sin²x + cos²x', 'sin²x − cos²x', 'trig_pythag_sign'],
      ['1 − sin²x', 'cos x', 'trig_pythag_no_square'],
      ['csc x', '1 / cos x', 'trig_reciprocal_wrong_pair'],
      ['cot x', 'sin x / cos x', 'trig_quotient_inverted'],
      ['(1 − cos²x) / cos²x', '1 − 1', 'trig_cancel_across_sum'],
      ['sin²x', 'sin x', 'trig_square_dropped'],
      ['sin²x − 1', 'cos²x', 'trig_identity_sign_lost'],
      ['cos x / (1 + sin x)', '(cos x / 1) + (cos x / sin x)', 'trig_split_denominator'],
    ]

    for (const [prev, next, expectedId] of badSteps) {
      const r = verifyTrigStep(prev, next, { kind: 'simplify', variable: 'x' })
      expect(r.ok, `${prev} -> ${next}`).toBe(false)
      expect(r.pattern?.id, `${prev} -> ${next}`).toBe(expectedId)
    }
  })
})
