import { describe, expect, it } from 'vitest'
import {
  detectTrigStepFamily,
  evalTrigSafe,
  gradeTiExpressExpr,
  isSimplifiedTrig,
  readTrigIdentityExpr,
  sameTrigExpr,
  trigExprEquivalent,
  trigIdentitySlips,
  trigIdentityText,
  trigIdentityToLatex,
  trigSampleAngles,
  verifyTrigStep,
} from './identity'
import { TRIG_MISTAKE_IDS, type TrigMistakeId } from './types'

describe('trig identity engine (src/engine/trig/identity.ts)', () => {
  it('reads textbook and calculator trig-identity syntax in x and θ', () => {
    const forms = ['sin²x + cos²x', 'sin^2(x) + cos^2(x)', '(sin x)^2 + (cos x)^2', 'sin(x)^2 + cos(x)^2']
    for (const f of forms) {
      const r = readTrigIdentityExpr(f, { variable: 'x' })
      expect(r.ok, f).toBe(true)
      if (r.ok) {
        expect(trigIdentityText(r.node)).toBe('sin²x + cos²x')
        expect(trigIdentityToLatex(f, 'x')).toBe('\\sin^{2}x + \\cos^{2}x')
      }
    }

    const thetaForms = [
      '−√(1 − cos²θ)',
      '-sqrt(1 - cos^2(θ))',
      '-sqrt(1 - (cos θ)^2)',
      '-sqrt(1 - cos²θ)',
      '-(1 - cos^2(θ))^(1/2)',
    ]
    for (const f of thetaForms) {
      const r = readTrigIdentityExpr(f, { variable: 'θ' })
      expect(r.ok, f).toBe(true)
      if (r.ok) {
        expect(sameTrigExpr(r.node, '−√(1 − cos²θ)', 'θ')).toBe(true)
      }
    }
  })

  it('samples >= 12 seeded angles avoiding poles and zeros, using the undef discipline', () => {
    const angles = trigSampleAngles({ seed: 42 })
    expect(angles.length).toBeGreaterThanOrEqual(12)
    const r = readTrigIdentityExpr('tan x + cot x + sec x + csc x', { variable: 'x' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      for (const a of angles) {
        const val = evalTrigSafe(r.node, { x: a })
        expect(val).not.toBe('undef')
      }
    }
    expect(trigExprEquivalent('sin²x + cos²x', '1', { variable: 'x' })).toBe(true)
    expect(trigExprEquivalent('1 + tan²x', 'sec²x', { variable: 'x' })).toBe(true)
    expect(trigExprEquivalent('1 + cot²x', 'csc²x', { variable: 'x' })).toBe(true)
  })

  it('recognizes simplified single trig functions and constants with isSimplifiedTrig', () => {
    for (const doneExpr of ['sin x', '−cos x', 'tan x', '1', '−1', '2']) {
      expect(isSimplifiedTrig(doneExpr, 'x'), doneExpr).toBe(true)
    }
    for (const unsimplified of ['sin x / cos x', '1 / cos x', 'sin²x + cos²x', 'tan x cos x', 'sec x − cos x', 'sec²x']) {
      expect(isSimplifiedTrig(unsimplified, 'x'), unsimplified).toBe(false)
    }
  })

  it('detects step identity families (pythagorean, reciprocal, quotient, algebra)', () => {
    expect(detectTrigStepFamily('1 − cos²x', 'sin²x', 'x')).toBe('pythagorean')
    expect(detectTrigStepFamily('sec x', '1 / cos x', 'x')).toBe('reciprocal')
    expect(detectTrigStepFamily('tan x cos x', '(sin x / cos x) cos x', 'x')).toBe('quotient')
    expect(detectTrigStepFamily('(sin x / cos x) cos x', 'sin x', 'x')).toBe('algebra')
  })

  it('triggers all 8 new trig_ identity mistake IDs from concrete hand-written bad lines', () => {
    const cases: { prev: string; bad: string; id: TrigMistakeId }[] = [
      { prev: '1 − cos²x', bad: '1 + cos²x', id: 'trig_pythag_sign' },
      { prev: '1 − cos²x', bad: 'sin x', id: 'trig_pythag_no_square' },
      { prev: 'sec x', bad: '1 / sin x', id: 'trig_reciprocal_wrong_pair' },
      { prev: 'tan x', bad: 'cos x / sin x', id: 'trig_quotient_inverted' },
      { prev: '(sin x + cos x) / cos x', bad: 'sin x + 1', id: 'trig_cancel_across_sum' },
      { prev: 'cos²x', bad: 'cos x', id: 'trig_square_dropped' },
      { prev: 'cos²x − 1', bad: 'sin²x', id: 'trig_identity_sign_lost' },
      { prev: '1 / (sin x + cos x)', bad: '(1 / sin x) + (1 / cos x)', id: 'trig_split_denominator' },
    ]

    const seen = new Set<string>()
    for (const c of cases) {
      const res = verifyTrigStep(c.prev, c.bad, { kind: 'simplify', variable: 'x' })
      expect(res.ok, `${c.prev} -> ${c.bad}`).toBe(false)
      expect(res.pattern?.id, `${c.prev} -> ${c.bad}`).toBe(c.id)
      expect(TRIG_MISTAKE_IDS).toContain(c.id)
      seen.add(c.id)
    }
    expect(seen.size).toBe(8)
  })

  it('generates distinct slips with trigIdentitySlips that verifyTrigStep names with the exact mistake ID', () => {
    const start = '(1 − cos²x) / sin x'
    const ctx = { kind: 'simplify' as const, variable: 'x' as const, start }
    const slips = trigIdentitySlips(start, ctx)
    expect(slips.length).toBeGreaterThan(0)
    for (const s of slips) {
      const check = verifyTrigStep(start, s.text, ctx)
      expect(check.ok, s.text).toBe(false)
      expect(check.pattern?.id, s.text).toBe(s.mistake)
    }
  })

  it('grades ti.express Part 3 and names trig_identity_sign_lost, trig_pythag_sign, and trig_pythag_no_square', () => {
    const spec = {
      targetFn: 'sin' as const,
      givenFn: 'cos' as const,
      quadrant: 3 as const,
      identityText: 'sin²θ + cos²θ = 1',
      signText: '−' as const,
      answerText: '−√(1 − cos²θ)',
      answerLatex: '-\\sqrt{1 - \\cos^{2}\\theta}',
    }

    for (const right of [
      '−√(1 − cos²θ)',
      '-sqrt(1 - cos^2(θ))',
      '-sqrt(1 - (cos θ)^2)',
      '-sqrt(1 - cos²θ)',
      '-(1 - cos^2(θ))^(1/2)',
    ]) {
      expect(gradeTiExpressExpr(spec, right), right).toEqual({ verdict: 'correct' })
    }

    const signLost = gradeTiExpressExpr(spec, '√(1 − cos²θ)')
    expect(signLost.verdict).toBe('mistake')
    if (signLost.verdict === 'mistake') expect(signLost.id).toBe('trig_identity_sign_lost')

    const pythagSign = gradeTiExpressExpr(spec, '−√(1 + cos²θ)')
    expect(pythagSign.verdict).toBe('mistake')
    if (pythagSign.verdict === 'mistake') expect(pythagSign.id).toBe('trig_pythag_sign')

    const noSquare = gradeTiExpressExpr(spec, '−√(1 − cos θ)')
    expect(noSquare.verdict).toBe('mistake')
    if (noSquare.verdict === 'mistake') expect(noSquare.id).toBe('trig_pythag_no_square')
  })
})
