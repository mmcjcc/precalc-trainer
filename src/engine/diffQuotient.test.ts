import { describe, expect, it } from 'vitest'
import type { StepContext, VarName } from '@/shared/types'
import {
  appText,
  checkDqLine,
  checkFxhLine,
  definedAtHZero,
  differenceQuotient,
  dqMistake,
  dqSamplePoints,
  dqStartLine,
  dqStatus,
  fOfXPlusH,
  fxhMistake,
  LEFT_TO_DO,
  polynomialCoefficients,
  stripFxhLabel,
  substituteX,
  type DqSpec,
} from './diffQuotient'
import { exprEquivalent, parseExpression, verifyRewrite } from './index'
import { evalNode } from './math'
import { ERROR_PATTERNS } from './matchers/catalog'
import { insertImplicitMul } from './parse'
import { makeSamples } from './samples'

const XH: VarName[] = ['x', 'h']
const ctx: StepContext = { vars: XH, seed: 12345, moduleId: 'diffQuotient' }

function value(text: string, x: number, h: number, vars: VarName[] = XH): number | 'undef' {
  const p = parseExpression(text, vars)
  if (!p.ok) throw new Error(`${text}: ${p.error.message}`)
  return evalNode(p.node, { x, h })
}

describe('the variable h', () => {
  it('is a parse error unless the problem owns it', () => {
    const p = parseExpression('5x + 5h', ['x'])
    expect(p.ok).toBe(false)
    if (!p.ok) expect(p.error.message).toMatch(/Unknown letter "h"/)
    expect(parseExpression('5x + 5h').ok).toBe(false) // default letters are x, y, n
    expect(parseExpression('5x + 5h', XH).ok).toBe(true)
  })

  it('splits implicit products with h', () => {
    expect(insertImplicitMul('xh')).toBe('x*h')
    expect(insertImplicitMul('2hx')).toBe('2*h*x')
    expect(insertImplicitMul('(x+h)^2')).toBe('(x+h)^2')
    expect(insertImplicitMul('h(2x+h)')).toBe('h*(2*x+h)')
    expect(insertImplicitMul('3h^2')).toBe('3*h^2')
    expect(value('xh', 3, 2)).toBe(6)
    expect(value('2hx', 3, 2)).toBe(12)
    expect(value('(x+h)^2', 3, 2)).toBe(25)
    expect(value('h(2x+h)', 3, 2)).toBe(16)
    expect(value('6xh + 3h^2 + 2h', 1, 2)).toBe(28)
  })

  it('never breaks a function name', () => {
    expect(insertImplicitMul('sqrt(x+h)')).toBe('sqrt(x+h)')
    expect(insertImplicitMul('nthroot(x+h,3)')).toBe('nthroot(x+h,3)')
    expect(insertImplicitMul('cbrt(h)')).toBe('cbrt(h)')
    expect(value('1/(sqrt(x+h) + sqrt(x))', 4, 5)).toBeCloseTo(1 / 5)
    expect(value('cbrt(x + h)', 3, 5)).toBe(2)
    expect(value('abs(h - x)', 5, 2)).toBe(3)
  })

  it('evaluates h from the scope, never as a built-in constant', () => {
    expect(value('h', 0, 0.5)).toBe(0.5)
    expect(value('h/h', 1, 1e-6)).toBe(1)
  })
})

describe('sampling in x and h', () => {
  it('keeps h and x + h away from 0 and adds rows inside a square root’s domain', () => {
    for (const seed of [1, 7, 12345, 0x9e3779b9]) {
      const rows = makeSamples(['h', 'x'], seed)
      expect(rows.length).toBeGreaterThanOrEqual(20)
      for (const r of rows) {
        expect(Math.abs(r.h!)).toBeGreaterThanOrEqual(0.05)
        expect(Math.abs(r.x! + r.h!)).toBeGreaterThanOrEqual(0.05)
      }
      expect(rows.filter((r) => r.x! > 0 && r.x! + r.h! > 0).length).toBeGreaterThanOrEqual(10)
    }
  })

  it('leaves variable sets without h untouched', () => {
    const rows = makeSamples(['x', 'y'], 5)
    expect(rows).toHaveLength(20)
  })

  it('treats a line equivalent to the DQ only where h ≠ 0 as equivalent', () => {
    expect(exprEquivalent('(5x + 5h - 2 - (5x - 2))/h', '5', XH).equivalent).toBe(true)
    expect(exprEquivalent('(2xh + h^2)/h', '2x + h', XH).equivalent).toBe(true)
    expect(exprEquivalent('(3/(x + h) - 3/x)/h', '-3/(x(x + h))', XH).equivalent).toBe(true)
    expect(exprEquivalent('(sqrt(x + h) - sqrt(x))/h', '1/(sqrt(x + h) + sqrt(x))', XH).equivalent).toBe(true)
    expect(exprEquivalent('(sqrt(x + h + 3) - sqrt(x + 3))/h', '1/(sqrt(x + h + 3) + sqrt(x + 3))', XH).equivalent).toBe(true)
    expect(exprEquivalent('(2xh + h^2)/h', '2x + h^2', XH).equivalent).toBe(false)
    expect(exprEquivalent('(sqrt(x + h) - sqrt(x))/h', '1/(2sqrt(x))', XH).equivalent).toBe(false)
  })

  it('verifyRewrite accepts cancelling h and names the chip', () => {
    const r = verifyRewrite('(6xh + 3h^2 + 2h)/h', 'h(6x + 3h + 2)/h', ctx)
    expect(r.ok).toBe(true)
    expect(r.acceptableChips).toContain('factor')
    expect(verifyRewrite('h(6x + 3h + 2)/h', '6x + 3h + 2', ctx).ok).toBe(true)
  })
})

describe('text helpers', () => {
  it('substitutes every x', () => {
    expect(fOfXPlusH('3x^2 + 2x - 1')).toBe('3(x + h)^2 + 2(x + h) - 1')
    expect(fOfXPlusH('sqrt(x)')).toBe('sqrt((x + h))')
    expect(substituteX('3x^2 + 2x - 1', 'h')).toBe('3h^2 + 2h - 1')
    expect(substituteX('exp(x) + max(x, 1)', 'h')).toBe('exp(h) + max(h, 1)')
  })

  it('builds the start line with f(x) in parentheses', () => {
    expect(dqStartLine('5(x+h) - 2', '5x - 2')).toBe('(5(x+h) - 2 - (5x - 2))/h')
    expect(differenceQuotient('5x - 2')).toBe('(5(x + h) - 2 - (5x - 2))/h')
  })

  it('reads an optional f(x + h) = label', () => {
    expect(stripFxhLabel('f(x+h) = 5(x+h) - 2')).toBe('5(x+h) - 2')
    expect(stripFxhLabel('F( x + h )=x^2')).toBe('x^2')
    expect(stripFxhLabel('5(x+h) - 2')).toBe('5(x+h) - 2')
  })

  it('prints nodes with implicit multiplication', () => {
    const p = parseExpression('-(3x^2) + 5(x + h) - 2/x', XH)
    if (!p.ok) throw new Error('parse')
    expect(appText(p.node)).toBe('-3x^2 + 5(x + h) - 2/x')
  })

  it('finds polynomial coefficients and refuses the rest', () => {
    expect(polynomialCoefficients('3x^2 + 2x - 1')).toEqual([-1, 2, 3])
    expect(polynomialCoefficients('-x^2 + 4')).toEqual([4, 0, -1])
    expect(polynomialCoefficients('5x - 2')).toEqual([-2, 5])
    expect(polynomialCoefficients('3/x')).toBeNull()
    expect(polynomialCoefficients('sqrt(x + 2)')).toBeNull()
  })
})

describe('simplified = equivalent AND defined at h = 0', () => {
  const quad: DqSpec = { f: '3x^2 + 2x - 1', answer: '6x + 3h + 2' }
  const rat: DqSpec = { f: '3/x', answer: '-3/(x(x + h))' }
  const shiftedRat: DqSpec = { f: '-2/(x + 4)', answer: '2/((x + 4)(x + h + 4))' }
  const rad: DqSpec = { f: 'sqrt(x)', answer: '1/(sqrt(x + h) + sqrt(x))' }
  const shiftedRad: DqSpec = { f: 'sqrt(x - 3)', answer: '1/(sqrt(x + h - 3) + sqrt(x - 3))' }

  it('polynomial', () => {
    expect(dqStatus('(6xh + 3h^2 + 2h)/h', quad)).toEqual({ equivalent: true, simplified: false })
    expect(dqStatus('h(6x + 3h + 2)/h', quad)).toEqual({ equivalent: true, simplified: false })
    expect(dqStatus('6x + 3h + 2', quad)).toEqual({ equivalent: true, simplified: true })
    expect(dqStatus('2 + 3h + 6x', quad)).toEqual({ equivalent: true, simplified: true })
    expect(dqStatus('6x + 2', quad)).toEqual({ equivalent: false, simplified: false })
  })

  it('rational', () => {
    expect(dqStatus('(3/(x + h) - 3/x)/h', rat)).toEqual({ equivalent: true, simplified: false })
    expect(dqStatus('-3h/(hx(x + h))', rat)).toEqual({ equivalent: true, simplified: false })
    expect(dqStatus('-3/(x(x + h))', rat)).toEqual({ equivalent: true, simplified: true })
    expect(dqStatus('-3/(x^2 + xh)', rat)).toEqual({ equivalent: true, simplified: true })
    expect(dqStatus('2/((x + 4)(x + h + 4))', shiftedRat).simplified).toBe(true)
    expect(dqStatus('(2h/((x + 4)(x + h + 4)))/h', shiftedRat)).toEqual({ equivalent: true, simplified: false })
  })

  it('radical', () => {
    expect(dqStatus('(sqrt(x + h) - sqrt(x))/h', rad)).toEqual({ equivalent: true, simplified: false })
    expect(dqStatus('(x + h - x)/(h(sqrt(x + h) + sqrt(x)))', rad)).toEqual({ equivalent: true, simplified: false })
    expect(dqStatus('1/(sqrt(x + h) + sqrt(x))', rad)).toEqual({ equivalent: true, simplified: true })
    expect(dqStatus('1/(sqrt(x + h - 3) + sqrt(x - 3))', shiftedRad).simplified).toBe(true)
    expect(definedAtHZero('h/(h(sqrt(x + h - 3) + sqrt(x - 3)))', shiftedRad)).toBe(false)
  })
})

describe('her Day 5 homework: f(x) = 5x − 2', () => {
  const spec: DqSpec = { f: '5x - 2', answer: '5' }
  const lines = ['(5x + 5h - 2 - (5x - 2))/h', '(5x + 5h - 2 - 5x + 2)/h', '5h/h', '5']

  it('accepts every line she wrote, and only the last one is finished', () => {
    const fxh = checkFxhLine('5(x+h) - 2', spec, ctx)
    expect(fxh.ok).toBe(true)
    expect(fxh.acceptableChips).toEqual([])
    let prev = dqStartLine('5(x+h) - 2', spec.f)
    expect(prev).toBe('(5(x+h) - 2 - (5x - 2))/h')
    lines.forEach((line, i) => {
      const r = checkDqLine(prev, line, spec, ctx)
      expect(r.ok, line).toBe(true)
      expect(r.pattern).toBeUndefined()
      expect(r.simplified).toBe(i === lines.length - 1)
      expect(r.leftToDo).toBe(i === lines.length - 1 ? undefined : LEFT_TO_DO)
      prev = line
    })
  })

  it('names the dropped parentheses on the very line where it would happen', () => {
    const r = checkDqLine('(5x + 5h - 2 - (5x - 2))/h', '(5x + 5h - 2 - 5x - 2)/h', spec, ctx)
    expect(r.ok).toBe(false)
    expect(r.pattern?.id).toBe('negative_not_distributed')
    expect(r.pattern?.witness).toBe('The minus in front of f(x) changes the sign of EVERY term: −(5x − 2) = −5x + 2, not −5x − 2.')
    expect(r.counterexample?.message).toMatch(/^At x = \d+, h = \d+ the line before gives 5, but yours gives/)
  })
})

describe('named mistakes: each fires on a realistic wrong line, never on a right one', () => {
  const lin: DqSpec = { f: '3x - 2', answer: '3' }
  const quad: DqSpec = { f: '3x^2 + 2x - 1', answer: '6x + 3h + 2' }
  const negQuad: DqSpec = { f: '-x^2 + 4x', answer: '-2x - h + 4' }
  const rat: DqSpec = { f: '3/x', answer: '-3/(x(x + h))' }
  const rad: DqSpec = { f: 'sqrt(x)', answer: '1/(sqrt(x + h) + sqrt(x))' }

  const fxhCases: [DqSpec, string, string][] = [
    [lin, '3x - 2 + h', 'dq_fx_plus_h'],
    [quad, '3x^2 + 2x - 1 + h', 'dq_fx_plus_h'],
    [lin, '(3x - 2) + (3h - 2)', 'dq_fx_plus_fh'],
    [quad, '3x^2 + 2x - 1 + 3h^2 + 2h - 1', 'dq_fx_plus_fh'],
    [rat, '3/x + 3/h', 'dq_fx_plus_fh'],
    [rad, 'sqrt(x) + sqrt(h)', 'dq_fx_plus_fh'],
    [quad, '3(x+h)^2 + 2x - 1', 'dq_partial_sub'],
    [quad, '3x^2 + 2(x + h) - 1', 'dq_partial_sub'],
    [lin, '3x - 2', 'dq_partial_sub'],
    [quad, '3(x^2 + h^2) + 2(x + h) - 1', 'power_over_sum'],
    [quad, '3x^2 + 3h^2 + 2x + 2h - 1', 'power_over_sum'],
    [{ f: 'x^2', answer: '2x + h' }, 'x^2 + h^2', 'power_over_sum'],
    [quad, '3x^2 + 6xh + h^2 + 2x + 2h - 1', 'partial_distribute'],
    [lin, '3x + h - 2 + 0', 'dq_fx_plus_h'],
    [negQuad, '-x^2 + 2xh + h^2 + 4x + 4h', 'negative_not_distributed'],
  ]
  it.each(fxhCases)('f(x) = %s: f(x + h) typed as %s → %s', (spec, typed, id) => {
    const r = checkFxhLine(typed, spec, ctx)
    expect(r.ok).toBe(false)
    expect(r.pattern?.id).toBe(id)
    expect(r.pattern?.witness).toBeTruthy()
    expect(fxhMistake(typed, spec)?.id).toBe(id)
  })

  const dqCases: [DqSpec, string, string, string][] = [
    [quad, '(6xh + 3h^2 + 2h)/h', '6x + 3h^2 + 2', 'dq_partial_cancel'],
    [quad, '(6xh + 3h^2 + 2h)/h', '6xh + 3h + 2', 'dq_partial_cancel'],
    [{ f: 'x^2 + 3x', answer: '2x + h + 3' }, '(2xh + h^2 + 3h)/h', '2x + h^2 + 3', 'dq_partial_cancel'],
    [lin, '(3x + 3h - 2 - 3x + 2)/h', '3h', 'dq_forgot_divide'],
    [quad, '(6xh + 3h^2 + 2h)/h', '6xh + 3h^2 + 2h', 'dq_forgot_divide'],
    [rat, '(3/(x + h) - 3/x)/h', '-3h/(x(x + h))', 'dq_forgot_divide'],
    [quad, '(6xh + 3h^2 + 2h)/h', '6x + 2', 'dq_set_h_zero'],
    [quad, 'h(6x + 3h + 2)/h', '6x + 2', 'dq_set_h_zero'],
    [rat, '-3h/(hx(x + h))', '-3/x^2', 'dq_set_h_zero'],
    [rad, 'h/(h(sqrt(x + h) + sqrt(x)))', '1/(2sqrt(x))', 'dq_set_h_zero'],
    [quad, '(3x^2 + 6xh + 3h^2 + 2x + 2h - 1 - (3x^2 + 2x - 1))/h', '(3x^2 + 6xh + 3h^2 + 2x + 2h - 1 - 3x^2 + 2x - 1)/h', 'negative_not_distributed'],
    [lin, '(3x + 3h - 2 - (3x - 2))/h', '(3x + 3h - 2 - 3x - 2)/h', 'negative_not_distributed'],
    [quad, '(3(x + h)^2 + 2(x + h) - 1 - (3x^2 + 2x - 1))/h', '(3x^2 + 3h^2 + 2x + 2h - 1 - (3x^2 + 2x - 1))/h', 'power_over_sum'],
  ]
  it.each(dqCases)('f(x) = %s: after %s, %s → %s', (spec, prev, typed, id) => {
    const r = checkDqLine(prev, typed, spec, ctx)
    expect(r.ok).toBe(false)
    expect(r.pattern?.id).toBe(id)
    expect(r.pattern?.witness).toBeTruthy()
    expect(dqMistake(typed, spec)?.id).toBe(id)
  })

  it('witnesses use her numbers', () => {
    const pc = checkDqLine('(6xh + 3h^2 + 2h)/h', '6x + 3h^2 + 2', quad, ctx)
    expect(pc.pattern?.witness).toBe('Dividing by h takes one h from EVERY term: 6xh → 6x, 3h^2 → 3h, 2h → 2. Your line kept 3h^2 whole.')
    const h0 = checkDqLine('(6xh + 3h^2 + 2h)/h', '6x + 2', quad, ctx)
    expect(h0.pattern?.witness).toBe('At x = 1, h = 1 the difference quotient is 11, but your line gives 8: it is what the quotient approaches as h → 0.')
    const pd = checkFxhLine('3x^2 + 6xh + h^2 + 2x + 2h - 1', quad, ctx)
    expect(pd.pattern?.witness).toMatch(/^The 3 multiplies every piece: 3\(x \+ h\)\^2 = 3\(x\^2 \+ 2xh \+ h\^2\) = 3x\^2 \+ 6xh \+ 3h\^2\./)
    const plusH = checkFxhLine('3x - 2 + h', lin, ctx)
    expect(plusH.counterexample?.message).toBe('At x = 1, h = 1: f(x + h) = f(2) = 4, but your line gives 2.')
  })

  it('the h → 0 lesson is warm and points at the derivative', () => {
    expect(ERROR_PATTERNS.dq_set_h_zero.lesson).toMatch(/NEXT big idea \(the derivative\)/)
  })

  const rightLines: [DqSpec, string][] = [
    [lin, '3(x + h) - 2'],
    [lin, '3x + 3h - 2'],
    [quad, '3(x + h)^2 + 2(x + h) - 1'],
    [quad, '3x^2 + 6xh + 3h^2 + 2x + 2h - 1'],
    [quad, 'f(x+h) = 3(x^2 + 2xh + h^2) + 2x + 2h - 1'],
    [negQuad, '-(x + h)^2 + 4(x + h)'],
    [rat, '3/(x + h)'],
    [rad, 'sqrt(x + h)'],
    [rad, 'sqrt(h + x)'],
  ]
  it.each(rightLines)('f(x) = %s: the right f(x + h) line %s is accepted with no pattern', (spec, typed) => {
    const r = checkFxhLine(typed, spec, ctx)
    expect(r.ok).toBe(true)
    expect(r.pattern).toBeUndefined()
    expect(fxhMistake(typed, spec)).toBeNull()
  })

  const rightDq: [DqSpec, string][] = [
    [quad, '6x + 3h + 2'],
    [quad, 'h(6x + 3h + 2)/h'],
    [quad, '(6xh + 3h^2 + 2h)/h'],
    [lin, '3'],
    [rat, '-3/(x(x + h))'],
    [rad, '1/(sqrt(x + h) + sqrt(x))'],
  ]
  it.each(rightDq)('f(x) = %s: the right line %s never matches a mistake', (spec, typed) => {
    expect(dqMistake(typed, spec)).toBeNull()
    expect(checkDqLine(differenceQuotient(spec.f), typed, spec, ctx).ok).toBe(true)
  })

  it('anything else wrong gets a counterexample at friendly numbers', () => {
    const r = checkDqLine('(6xh + 3h^2 + 2h)/h', '6x + 3h + 7', quad, ctx)
    expect(r.ok).toBe(false)
    expect(r.pattern).toBeUndefined()
    expect(r.counterexample?.message).toBe('At x = 1, h = 1 the line before gives 11, but yours gives 16.')
    const s = checkFxhLine('3x^2 + 6xh + 3h^2 + 2x + 2h + 5', quad, ctx)
    expect(s.pattern).toBeUndefined()
    expect(s.counterexample?.message).toBe('At x = 1, h = 1: f(x + h) = f(2) = 15, but your line gives 21.')
  })

  it('parse errors point into what she typed', () => {
    const r = checkFxhLine('f(x+h) = 5(x+h', lin, ctx)
    expect(r.verdict).toBe('parse_error')
    expect(r.parseError?.position).toBeGreaterThanOrEqual(8)
    expect(checkFxhLine('5x + 5y', lin, ctx).verdict).toBe('parse_error')
    expect(checkDqLine('(3x + 3h - 2 - (3x - 2))/h', '3h/', lin, ctx).verdict).toBe('parse_error')
  })

  it('samples used for candidates have no h = 0', () => {
    expect(dqSamplePoints().every((p) => p.h !== 0)).toBe(true)
  })
})
