import { describe, expect, it } from 'vitest'
import { insertImplicitMul, parseStatement } from './parse'
import { evalNode } from './math'
import { statementHolds } from './samples'

describe('insertImplicitMul', () => {
  it('turns x(y+2) into a product, not a function call', () => {
    expect(insertImplicitMul('x(y+2)')).toBe('x*(y+2)')
  })
  it('splits xy into x*y', () => {
    expect(insertImplicitMul('xy')).toBe('x*y')
  })
  it('leaves cbrt(...) as a function', () => {
    expect(insertImplicitMul('cbrt(7x+3)')).toBe('cbrt(7*x+3)')
  })
})

describe('parseStatement', () => {
  it('splits on = without handing assignment to math.js', () => {
    const p = parseStatement('(x+1)^3 = 7y+3')
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.statement.disjuncts).toHaveLength(1)
    expect(p.statement.disjuncts[0]![0]!.op).toBe('=')
  })

  it('parses inequalities including unicode', () => {
    const p = parseStatement('-14 ≤ -14x')
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.statement.disjuncts[0]![0]!.op).toBe('<=')
  })

  it('expands ± into an or', () => {
    const p = parseStatement('x = ±3')
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.statement.disjuncts).toHaveLength(2)
    expect(statementHolds(p.statement, { x: 3 })).toBe(true)
    expect(statementHolds(p.statement, { x: -3 })).toBe(true)
    expect(statementHolds(p.statement, { x: 0 })).toBe(false)
  })

  it('parses chained inequalities as AND', () => {
    const p = parseStatement('-3 < 2x+1 <= 7')
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.statement.disjuncts[0]).toHaveLength(2)
    expect(statementHolds(p.statement, { x: 0 })).toBe(true)
    expect(statementHolds(p.statement, { x: 4 })).toBe(false)
  })

  it('rejects a bare expression', () => {
    const p = parseStatement('cbrt(7x+3)-1')
    expect(p.ok).toBe(false)
  })

  it('evaluates cbrt of a negative', () => {
    const p = parseStatement('y = cbrt(x)')
    expect(p.ok).toBe(true)
    if (!p.ok) return
    const v = evalNode(p.statement.disjuncts[0]![0]!.rhs, { x: -8 })
    expect(v).toBe(-2)
  })

  it('treats (x)^(1/3) like cbrt(x) at x = -8', () => {
    const a = parseStatement('y = cbrt(x)')
    const b = parseStatement('y = (x)^(1/3)')
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    const va = evalNode(a.statement.disjuncts[0]![0]!.rhs, { x: -8 })
    const vb = evalNode(b.statement.disjuncts[0]![0]!.rhs, { x: -8 })
    expect(va).toBe(-2)
    expect(vb).toBe(-2)
  })
})
