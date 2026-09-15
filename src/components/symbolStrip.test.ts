import { describe, expect, it } from 'vitest'
import { STRIP_KEYS, insertToken, type StripKey } from './symbolStrip'

const key = (label: string): StripKey => {
  const k = STRIP_KEYS.find((s) => s.label === label)
  if (!k) throw new Error(`no key ${label}`)
  return k
}

describe('symbol strip order and tokens (UX-01)', () => {
  it('starts with the most-used keys so they are visible without scrolling', () => {
    expect(STRIP_KEYS.slice(0, 11).map((k) => k.label)).toEqual(['x', 'y', '^', '(', ')', '/', '=', '<', '≤', '>', '≥'])
  })

  it('inserts ASCII parser tokens, never the glyph', () => {
    for (const k of STRIP_KEYS) expect(k.insert).toMatch(/^[\x20-\x7e]+$/)
    expect(key('√').insert).toBe('sqrt()')
    expect(key('³√').insert).toBe('cbrt()')
    expect(key('| |').insert).toBe('abs()')
    expect(key('≤').insert.trim()).toBe('<=')
    expect(key('∞').insert).toBe('inf')
    expect(key('∪').insert.trim()).toBe('U')
    expect(key('π').insert).toBe('pi')
  })
})

describe('insertToken caret math (UX-02)', () => {
  it('places the caret inside the parens of sqrt()', () => {
    const r = insertToken('', 0, 0, key('√'))
    expect(r).toEqual({ value: 'sqrt()', caret: 5 })
  })

  it('inserts at the caret in the middle of existing text', () => {
    const r = insertToken('x+1', 1, 1, key('^'))
    expect(r).toEqual({ value: 'x^+1', caret: 2 })
  })

  it('wraps a selection inside a paren token and puts the caret after the selection', () => {
    const r = insertToken('x+1 = 7', 0, 3, key('³√'))
    expect(r.value).toBe('cbrt(x+1) = 7')
    expect(r.caret).toBe('cbrt(x+1'.length)
    expect(r.value.slice(r.caret)).toBe(') = 7')
  })

  it('replaces a selection with a plain token', () => {
    const r = insertToken('x <= 7', 2, 4, key('≥'))
    expect(r.value).toBe('x >= 7')
    expect(r.caret).toBe(4)
  })

  it('collapses the padding of spaced tokens against existing spaces / at the start', () => {
    expect(insertToken('x ', 2, 2, key('≤')).value).toBe('x <= ')
    expect(insertToken('', 0, 0, key('≤')).value).toBe('<= ')
    expect(insertToken('x  7', 1, 1, key('=')).value).toBe('x = 7')
  })

  it('tolerates a reversed or out-of-range selection', () => {
    expect(insertToken('abc', 3, 1, key('x'))).toEqual({ value: 'ax', caret: 2 })
    expect(insertToken('abc', 10, 10, key('π'))).toEqual({ value: 'abcpi', caret: 5 })
  })

  it('places the caret inside { } for set notation', () => {
    const r = insertToken('x | ', 4, 4, key('{ }'))
    expect(r).toEqual({ value: 'x | {}', caret: 5 })
  })
})
