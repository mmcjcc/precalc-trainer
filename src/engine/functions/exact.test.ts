import { describe, expect, it } from 'vitest'
import { rat, ratToString } from '@/notation'
import { parseExpression } from '../parse'
import {
  exactEval,
  exactLiteral,
  surdAdd,
  surdDiv,
  surdEquals,
  surdInt,
  surdMul,
  surdOf,
  surdSign,
  surdSqrt,
  surdToText,
  type ExactValue,
} from './exact'
import { factoredText, polyOf, polyToText, rationalRoots, ratFnOf, ratFnReduce, ratFnToText, realRootsExact, sturmCount } from './poly'
import { parseSetAnswer, parseValueAnswer } from './answer'
import { builderText, describeText, substituteText, substituteValueText } from './text'
import { setToInterval } from '@/notation'

function ev(text: string, x?: number): ExactValue {
  const p = parseExpression(text, ['x'])
  if (!p.ok) throw new Error(text)
  return exactEval(p.node, x === undefined ? null : exactLiteral(x))
}

function txt(v: ExactValue): string {
  return v === 'undef' ? 'undef' : surdToText(v)
}

describe('exact values (rational combinations of square roots)', () => {
  it('evaluates literals exactly and keeps long decimals as written', () => {
    expect(ratToString(exactLiteral(0.1))).toBe('1/10')
    expect(ratToString(exactLiteral(0.333333333))).toBe('333333333/1000000000')
    expect(txt(ev('0.1 + 0.2'))).toBe('3/10')
  })

  it('simplifies radicals to a canonical form', () => {
    expect(txt(ev('sqrt(8)'))).toBe('2sqrt(2)')
    expect(txt(ev('sqrt(8)/2'))).toBe('sqrt(2)')
    expect(txt(ev('sqrt(3/4)'))).toBe('sqrt(3)/2')
    expect(txt(ev('sqrt(2)sqrt(6)'))).toBe('2sqrt(3)')
    expect(txt(ev('(1 + sqrt(2))^2'))).toBe('3 + 2sqrt(2)')
    expect(txt(ev('1/(sqrt(2) + 1)'))).toBe('-1 + sqrt(2)')
    expect(txt(ev('1/sqrt(2)'))).toBe('sqrt(2)/2')
    expect(txt(ev('cbrt(-27/8)'))).toBe('-3/2')
    expect(txt(ev('(-8)^(2/3)'))).toBe('4')
    expect(txt(ev('abs(1 - sqrt(2))'))).toBe('-1 + sqrt(2)')
    expect(surdEquals(surdMul(surdSqrt(surdInt(2)) as never, surdSqrt(surdInt(2)) as never), surdInt(2))).toBe(true)
  })

  it('marks undefined points and refuses what it cannot represent', () => {
    expect(ev('sqrt(x - 3)', 2)).toBe('undef')
    expect(ev('1/(x - 3)', 3)).toBe('undef')
    expect(ev('nthRoot(x, 4)', -16)).toBe('undef')
    expect(() => ev('cbrt(2)')).toThrow()
    expect(() => ev('pi')).toThrow()
    expect(() => ev('sqrt(1 + sqrt(2))')).toThrow()
    expect(surdDiv(surdInt(1), surdInt(0))).toBe('undef')
  })

  it('decides signs exactly', () => {
    const a = surdAdd(surdOf(rat(-7, 5)), surdSqrt(surdInt(2)) as never) // √2 − 1.4 > 0
    expect(surdSign(a)).toBe(1)
    const b = surdAdd(surdOf(rat(-3, 2)), surdSqrt(surdInt(2)) as never) // √2 − 1.5 < 0
    expect(surdSign(b)).toBe(-1)
  })
})

describe('polynomials and rational functions', () => {
  const poly = (t: string) => {
    const p = parseExpression(t, ['x'])
    if (!p.ok) throw new Error(t)
    return polyOf(p.node)!
  }
  it('reads, prints and factors', () => {
    expect(polyToText(poly('(x - 3)^2 + 1'))).toBe('x^2 - 6x + 10')
    expect(polyToText(poly('x/2 - 3/4'))).toBe('(1/2)x - 3/4')
    expect(factoredText(poly('x^2 - 9'))).toBe('(x + 3)(x - 3)')
    expect(factoredText(poly('2x^2 - x - 1'))).toBe('(2x + 1)(x - 1)')
    expect(factoredText(poly('x^3 - 2x^2 + x'))).toBe('x(x - 1)^2')
    expect(factoredText(poly('x^2 + 1'))).toBeNull()
  })

  it('finds rational roots and proves there are no others', () => {
    const rr = rationalRoots(poly('6x^3 - 11x^2 + 6x - 1'))
    expect(rr.roots.map(ratToString)).toEqual(['1/3', '1/2', '1'])
    expect(realRootsExact(poly('x^4 + 1'))).toEqual([])
    expect(realRootsExact(poly('(x - 2)(x^2 + x + 1)')).map(ratToString)).toEqual(['2'])
    expect(() => realRootsExact(poly('x^2 - 2'))).toThrow()
    expect(sturmCount(poly('x^3 - 3x + 1'))).toBe(3)
    expect(sturmCount(poly('(x - 1)^2 (x + 2)'))).toBe(2)
  })

  it('reduces rational functions', () => {
    const p = parseExpression('2(1/x) + 1', ['x'])
    expect(p.ok && ratFnToText(ratFnReduce(ratFnOf(p.node)!))).toBe('(x + 2)/x')
    const q = parseExpression('(x^2 - 1)/(x - 1)', ['x'])
    expect(q.ok && ratFnToText(ratFnReduce(ratFnOf(q.node)!))).toBe('x + 1')
    const r = parseExpression('x/(1 - 2x)', ['x'])
    expect(r.ok && ratFnToText(ratFnReduce(ratFnOf(r.node)!))).toBe('-x/(2x - 1)')
  })
})

describe('text helpers and answer reading', () => {
  it('substitutes with parentheses only where they are needed', () => {
    expect(substituteText('x^2 + 1', 'x - 3')).toBe('(x - 3)^2 + 1')
    expect(substituteText('sqrt(x)', 'x - 3')).toBe('sqrt(x - 3)')
    expect(substituteText('x^2', 'sqrt(x)')).toBe('(sqrt(x))^2')
    expect(substituteText('2x + 1', 'sqrt(x)')).toBe('2sqrt(x) + 1')
    expect(substituteValueText('3x^2 - x', '2')).toBe('3(2)^2 - 2')
    expect(substituteValueText('x^2 + 1', '-1')).toBe('(-1)^2 + 1')
    expect(substituteValueText('x^2 + 1', '2')).toBe('2^2 + 1')
  })

  it('prints set-builder with != the textbook way', () => {
    const s = parseSetAnswer('[-2, 3) U (3, inf)')
    expect(s.ok && builderText(s.set)).toBe('{x | x >= -2 and x != 3}')
    const t = parseSetAnswer('(-inf, -1) U (-1, 2) U (2, inf)')
    expect(t.ok && builderText(t.set)).toBe('{x | x != -1 and x != 2}')
    expect(t.ok && describeText(t.set)).toBe('all real numbers except -1 and 2')
    const u = parseSetAnswer('(-inf, -2] U [2, inf)')
    expect(u.ok && builderText(u.set)).toBe('{x | x <= -2 or x >= 2}')
  })

  it('reads every set-answer form', () => {
    const iv = (t: string) => {
      const p = parseSetAnswer(t)
      return p.ok ? setToInterval(p.set) : `error: ${p.error.message}`
    }
    expect(iv('all real numbers except 3 and -2')).toBe('(-inf, -2) U (-2, 3) U (3, inf)')
    expect(iv('R')).toBe('(-inf, inf)')
    expect(iv('all real numbers')).toBe('(-inf, inf)')
    expect(iv('{x | x ≥ 1, x ≠ 3}')).toBe('[1, 3) U (3, inf)')
    expect(iv('x >= 2')).toBe('[2, inf)')
    expect(iv('{y | y != 1/2}')).toBe('(-inf, 1/2) U (1/2, inf)')
    expect(iv('')).toMatch(/^error/)
    expect(iv('{x | x != }')).toMatch(/^error/)
  })

  it('reads value answers', () => {
    expect(parseValueAnswer('DNE')).toEqual({ ok: true, undefined: true })
    const v = parseValueAnswer('2sqrt(3)')
    expect(v.ok && !v.undefined && v.text).toBe('2*sqrt(3)')
    expect(parseValueAnswer('x + 1').ok).toBe(false)
  })
})
