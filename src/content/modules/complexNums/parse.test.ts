import { describe, expect, it } from 'vitest'
import { cx, cxEq, formatCx } from './arith'
import { parseCxAnswer } from './parse'

function one(text: string) {
  const p = parseCxAnswer(text)
  if (!p.ok) throw new Error(`${text}: ${p.message}`)
  expect(p.values).toHaveLength(1)
  return p
}

function many(text: string) {
  const p = parseCxAnswer(text)
  if (!p.ok) throw new Error(`${text}: ${p.message}`)
  return p
}

describe('complex answer parser', () => {
  it('accepts every listed spelling of a + bi', () => {
    const want = cx(3, -2)
    for (const t of ['3 - 2i', '3-2i', '-2i + 3', '3 + -2i']) {
      expect(cxEq(one(t).values[0]!, want), t).toBe(true)
      expect(one(t).simplified, t).toBe(true)
    }
    expect(cxEq(one('i').values[0]!, cx(0, 1))).toBe(true)
    expect(cxEq(one('-i').values[0]!, cx(0, -1))).toBe(true)
    expect(cxEq(one('2i').values[0]!, cx(0, 2))).toBe(true)
    expect(cxEq(one('0').values[0]!, cx(0, 0))).toBe(true)
  })

  it('accepts fractions and a real denominator', () => {
    const want = cx({ n: -4, d: 5 }, { n: 7, d: 5 })
    expect(cxEq(one('4/5 - 7/5 i').values[0]!, cx({ n: 4, d: 5 }, { n: -7, d: 5 }))).toBe(true)
    const p = one('(4 - 7i)/5')
    expect(cxEq(p.values[0]!, cx({ n: 4, d: 5 }, { n: -7, d: 5 }))).toBe(true)
    expect(p.simplified).toBe(true)
    const q = one('-4/5 + 7/5 i')
    expect(cxEq(q.values[0]!, want)).toBe(true)
  })

  it('accepts a conjugate pair written with +- or ±', () => {
    for (const t of ['2 +- 3i', '2 ± 3i', '2 + 3i, 2 - 3i', '2-3i, 2+3i']) {
      const p = many(t)
      expect(p.values).toHaveLength(2)
      const keys = p.values.map((z) => formatCx(z)).sort()
      expect(keys, t).toEqual(['2 + 3i', '2 - 3i'])
    }
  })

  it('accepts k i sqrt(m) with generous spacing', () => {
    const want = cx(0, 4, 1, 3)
    for (const t of ['4i sqrt(3)', '4 sqrt(3) i', '4isqrt3', '4i sqrt 3', '4 * i * sqrt(3)']) {
      expect(cxEq(one(t).values[0]!, want), t).toBe(true)
    }
  })

  it('marks i^2 and a complex denominator as not simplified', () => {
    const a = parseCxAnswer('i^2')
    expect(a.ok && a.simplified).toBe(false)
    expect(a.ok && cxEq(a.values[0]!, cx(-1))).toBe(true)
    const b = parseCxAnswer('(2 + 3i)/(1 - 2i)')
    expect(b.ok && b.simplified).toBe(false)
    const c = parseCxAnswer('sqrt(-48)')
    expect(c.ok && c.simplified).toBe(false)
  })

  it('refuses nonsense with a message', () => {
    expect(parseCxAnswer('')).toMatchObject({ ok: false, message: 'Type your answer first.' })
    expect(parseCxAnswer('   ')).toMatchObject({ ok: false })
    const junk = parseCxAnswer('???')
    expect(junk.ok).toBe(false)
    if (junk.ok) return
    expect(junk.message.length).toBeGreaterThan(10)
    expect(parseCxAnswer('hello').ok).toBe(false)
    expect(parseCxAnswer('3 +').ok).toBe(false)
  })
})
