/**
 * The log / ln semantics fix: how every spelling she might type is read, how the evaluator computes it, and
 * that every place the app already used `log` (graphs, the exact cores, KaTeX, calculator strings, the
 * Sandbox's step checker) reads it the way her course and her TI-84 do.
 */
import { describe, expect, it } from 'vitest'
import { evalExpr, verifyRewrite, verifyStep } from '@/engine'
import { toNspire, toTi84 } from '@/notation/calcString'
import { toLatex } from '@/notation/toLatex'
import { domainOf } from '../functions/domain'
import { compileExpression, domainSubexpressions, evalNode, logBase } from '../math'
import { insertImplicitMul, parseExpression, parseStatement } from '../parse'
import { averageRateOfChange } from '../transformations/rate'
import { rewriteLogSyntax } from './syntax'

function val(text: string, scope: Record<string, number> = {}): number | 'undef' {
  const p = parseExpression(text, ['x', 'y', 'n'])
  if (!p.ok) throw new Error(`${text}: ${p.error.message}`)
  return evalNode(p.node, scope)
}

function close(a: number | 'undef', b: number): void {
  expect(a).not.toBe('undef')
  expect(Math.abs((a as number) - b)).toBeLessThan(1e-12 * Math.max(1, Math.abs(b)))
}

function parseErr(text: string): { message: string; position: number } {
  const p = parseExpression(text, ['x', 'y', 'n'])
  expect(p.ok, text).toBe(false)
  return p.ok ? { message: '', position: -1 } : p.error
}

describe('log is base 10, ln is base e, log(u, b) is base b', () => {
  it('log(x) is the TI-84 LOG key: base 10', () => {
    expect(val('log(100)')).toBe(2)
    expect(val('log(1000)')).toBe(3)
    expect(val('log(0.001)')).toBe(-3)
    expect(val('log(1)')).toBe(0)
    close(val('log(7)'), Math.log10(7))
    close(val('log(10^x)', { x: 2.5 }), 2.5)
  })

  it('ln(x) is the TI-84 LN key: base e (math.js has no ln of its own)', () => {
    expect(val('ln(e)')).toBe(1)
    expect(val('ln(1)')).toBe(0)
    close(val('ln(e^3)'), 3)
    close(val('ln(7)'), Math.log(7))
    close(val('e^(ln(7))'), 7)
  })

  it('log(u, b) and logBASE(u, b) take the argument first, like the TI-84 and math.js', () => {
    expect(val('log(8, 2)')).toBe(3)
    expect(val('logBASE(81, 3)')).toBe(4)
    expect(val('LOGBASE(81,3)')).toBe(4)
    expect(val('logBase(32, 2)')).toBe(5)
    expect(rewriteLogSyntax('logBASE(8, 2)')).toBe('log(8, 2)')
  })

  it('subscript bases: log_2(8), log_(1/2)(8), log_{3}(81), log_e(x), log_10(x)', () => {
    expect(val('log_2(8)')).toBe(3)
    expect(val('log_(1/2)(8)')).toBe(-3)
    expect(val('log_{3}(81)')).toBe(4)
    close(val('log_e(x)', { x: 5 }), Math.log(5))
    expect(val('log_10(1000)')).toBe(3)
    expect(rewriteLogSyntax('log_e(x)')).toBe('ln(x)')
    expect(rewriteLogSyntax('log_10(x)')).toBe('log(x)')
    expect(rewriteLogSyntax('log_2(x + 1) - 3')).toBe('log(x + 1, 2) - 3')
    expect(rewriteLogSyntax('log_2(log_3(x))')).toBe('log(log(x, 3), 2)')
  })

  it('digits typed straight after log are a base when "(" follows (log2(8), log10(x)); otherwise the input (log100)', () => {
    expect(val('log2(8)')).toBe(3)
    expect(val('log10(1000)')).toBe(3)
    expect(val('log100')).toBe(2)
    expect(rewriteLogSyntax('log10(x)')).toBe('log(x)')
  })

  it('a log without parentheses takes ONE number or ONE letter when an operator or the end comes next', () => {
    expect(val('log 100')).toBe(2)
    close(val('ln x', { x: 3 }), Math.log(3))
    close(val('lnx', { x: 3 }), Math.log(3))
    close(val('2ln x + 1', { x: 3 }), 2 * Math.log(3) + 1)
    close(val('log x + log y', { x: 2, y: 5 }), 1)
    expect(val('log_2 8')).toBe(3)
    close(val('log_3 x', { x: 9 }), 2)
    expect(val('ln e')).toBe(1)
  })

  it('a longer input without parentheses is ambiguous on paper: a parse error with a caret on the log', () => {
    for (const t of ['ln 2x', 'log x^2', 'ln e^5', 'log xy', 'log_28', 'log 2(8)']) {
      const e = parseErr(t)
      expect(e.message, t).toMatch(/parentheses/)
      expect(e.position, t).toBe(0)
    }
    expect(parseErr('y + ln 2x').position).toBe(4)
    expect(parseErr('ln').message).toMatch(/needs an input/)
    expect(parseErr('ln_2(8)').message).toMatch(/base e/)
  })

  it('a log of 0 or a negative, and a base of 0, 1 or a negative, are undefined', () => {
    for (const t of ['log(-1)', 'log(0)', 'ln(-2)', 'ln(0)', 'log(8, 1)', 'log(8, -2)', 'log(8, 0)', 'log(-8, 2)', 'log_2(0)']) {
      expect(val(t), t).toBe('undef')
    }
  })

  it('exact integer results come out exact (no 4.999999999999999)', () => {
    expect(val('log(243, 3)')).toBe(5)
    expect(val('log_5(125)')).toBe(3)
    expect(val('log_3(1/27)')).toBe(-3)
    expect(logBase(1024, 2)).toBe(10)
    expect(logBase(7, 1)).toBeNaN()
  })

  it('e, exp(x), 10^x, b^x', () => {
    expect(val('e')).toBe(Math.E)
    close(val('exp(2)'), Math.E ** 2)
    close(val('10^x', { x: 2 }), 100)
    expect(val('2^(-3)')).toBe(0.125)
    close(val('e^-x', { x: 1 }), 1 / Math.E)
    close(val('(1/2)^x', { x: 3 }), 0.125)
    close(val('3e^(2x)', { x: 0.5 }), 3 * Math.E)
    // Calculator precedence, as before: e^2x is (e^2)·x.
    close(val('e^2x', { x: 3 }), Math.E ** 2 * 3)
  })

  it('a decimal exponent keeps its value (it was rounded to a fraction with denominator ≤ 12 before)', () => {
    close(val('10^0.4771'), 10 ** 0.4771)
    close(val('e^0.33'), Math.E ** 0.33)
    close(val('2^0.3'), 2 ** 0.3)
    // A fraction exponent is still a real root: (−8)^(1/3) = −2.
    expect(val('(-8)^(1/3)')).toBe(-2)
    close(val('x^(2/3)', { x: -8 }), 4)
  })

  it('log inputs (and a variable base) are domain boundaries', () => {
    const d = domainSubexpressions(compileExpression('log(x - 3) + ln(2 * x) + log(5, x)'))
    expect(d.pos.map((n) => n.toString())).toEqual(['x - 3', '2 * x', 'x'])
    expect(d.zero.map((n) => n.toString())).toEqual(['x - 1'])
  })
})

describe('letter runs and function names', () => {
  it('a run of letters splits into the names it contains: x log(2) is x·log(2)', () => {
    expect(insertImplicitMul('xlog(2)')).toBe('x*log(2)')
    expect(insertImplicitMul('x log(2)')).toBe('x*log(2)')
    expect(insertImplicitMul('x ln(x)')).toBe('x*ln(x)')
    expect(insertImplicitMul('2x log(x)')).toBe('2*x*log(x)')
    expect(insertImplicitMul('x sqrt(x)')).toBe('x*sqrt(x)')
    expect(insertImplicitMul('pix')).toBe('pi*x')
  })

  it('runs of the app’s own letters split exactly as before', () => {
    expect(insertImplicitMul('xy')).toBe('x*y')
    expect(insertImplicitMul('ex')).toBe('e*x')
    expect(insertImplicitMul('2ex')).toBe('2*e*x')
    expect(insertImplicitMul('2hx')).toBe('2*h*x')
    expect(insertImplicitMul('x(y+2)')).toBe('x*(y+2)')
    expect(insertImplicitMul('cbrt(7x+3)')).toBe('cbrt(7*x+3)')
    expect(insertImplicitMul('nthroot(x+h,3)')).toBe('nthroot(x+h,3)')
    expect(insertImplicitMul('exp(x) + max(x, 1)')).toBe('exp(x)+max(x,1)')
  })

  it('a function name with no parentheses is a parse error instead of a value that is undefined everywhere', () => {
    expect(parseErr('sqrtx').message).toMatch(/sqrt needs parentheses/)
    const s = parseStatement('y = 2 + abs', ['x', 'y'])
    expect(s.ok).toBe(false)
    if (!s.ok) {
      expect(s.error.message).toMatch(/abs needs parentheses/)
      expect(s.error.position).toBe(8)
    }
  })
})

describe('every existing use of log reads it the same way', () => {
  it('graphs (evalExpr) plot log as base 10 and ln as base e', () => {
    expect(evalExpr('log(x)', { x: 100 })).toBe(2)
    close(evalExpr('ln(x)', { x: Math.E }) as number, 1)
    expect(evalExpr('log(x)', { x: -1 })).toBe('undef')
  })

  it('the exact cores still decline a log (they have no exact model for it)', () => {
    expect(domainOf('log(x)')).toBeNull()
    expect(averageRateOfChange('log(x)', 1, 10)).toBeNull()
  })

  it('KaTeX shows log, ln and log_b as her textbook does', () => {
    expect(toLatex('log_2(8) = 3')).toBe('\\log_{2}\\left(8\\right) = 3')
    expect(toLatex('ln(x)')).toBe('\\ln\\left(x\\right)')
    expect(toLatex('log(x)')).toBe('\\log\\left(x\\right)')
    expect(toLatex('2log(x) - log_3(x + 1)')).toBe('2\\log\\left(x\\right)-\\log_{3}\\left(x+1\\right)')
    expect(toLatex('exp(2x)')).toBe('e^{2x}')
  })

  it('calculator strings: LOG and LN keys, logBASE( for any other base', () => {
    expect(toTi84('log(x)')).toBe('log(X)')
    expect(toTi84('ln(x)')).toBe('ln(X)')
    expect(toTi84('log_2(x)')).toBe('logBASE(X,2)')
    expect(toTi84('exp(x)')).toBe('e^(X)')
    expect(toNspire('log_2(x)')).toBe('log(x,2)')
    expect(toNspire('exp(x)')).toBe('e^(x)')
  })

  it('the Sandbox step checker reads log as base 10', () => {
    const ctx = { vars: ['x' as const], seed: 1 }
    expect(verifyStep('log(x) = 2', 'x = 100', ctx).ok).toBe(true)
    const r = verifyStep('log(x) = 2', 'x = e^2', ctx)
    expect(r.ok).toBe(false)
    expect(r.pattern?.id).toBe('log_ln_confused')
  })
})

describe('the general step checker hands log and exponential lines to the logs core', () => {
  const ctx = { vars: ['x' as const], seed: 3 }

  it('ln(x^2) = 4 → 2ln(x) = 4 loses x = −e² (the general Tier 1 called it "moved terms across")', () => {
    const r = verifyStep('ln(x^2) = 4', '2ln(x) = 4', ctx)
    expect(r.ok).toBe(false)
    expect(r.verdict).toBe('lost_subset')
    expect(r.pattern?.id).toBe('log_power_abs')
  })

  it('condensing logs is legal, with the extraneous-answer caveat', () => {
    const r = verifyStep('log(x) + log(x - 3) = 1', 'log(x(x - 3)) = 1', ctx)
    expect(r.ok).toBe(true)
    expect(r.caveat).toBe('extraneous_check')
    expect(r.pattern?.id).toBe('log_check_answers')
  })

  it('a half-life answer beyond the old [−60, 60] grid is still compared', () => {
    expect(verifyStep('0.5^(x/5730) = 0.3', 'x = 5730log(0.3)/log(0.5)', ctx).ok).toBe(true)
    expect(verifyStep('0.5^(x/5730) = 0.3', 'x = 5730log(0.5)/log(0.3)', ctx).ok).toBe(false)
  })

  it('expression mode: ln(x²) → 2 ln x is rejected (x = −1), 2 ln x → ln(x²) is accepted (the domain only grows)', () => {
    const bad = verifyRewrite('ln(x^2)', '2ln(x)', ctx)
    expect(bad.ok).toBe(false)
    expect(bad.pattern?.id).toBe('log_power_abs')
    expect(verifyRewrite('2ln(x)', 'ln(x^2)', ctx).ok).toBe(true)
  })

  it('a line without logs or variable exponents keeps the general checker', () => {
    const r = verifyStep('2x + 3 = 7', '2x = 4', ctx)
    expect(r.ok).toBe(true)
    expect(r.detected?.tag).toBe('sub_both')
    expect((r as { logMove?: unknown }).logMove).toBeUndefined()
  })
})
