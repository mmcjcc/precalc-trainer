import { describe, expect, it } from 'vitest'
import { m, pieces, plain, showsAnswer, texPlain } from './text'

describe('math strings: KaTeX between dollar signs, read back as words', () => {
  it('reads the TeX this unit writes', () => {
    expect(texPlain('\\frac{5\\pi}{6}')).toBe('5π/6')
    expect(texPlain('-\\frac{11\\pi}{4}')).toBe('−11π/4')
    expect(texPlain('150^{\\circ}')).toBe('150°')
    expect(texPlain('\\frac{\\sqrt{3}}{2}')).toBe('√3/2')
    expect(texPlain('\\sin\\left(\\frac{5\\pi}{6}\\right)')).toBe('sin(5π/6)')
    expect(texPlain('\\cos\\theta = \\frac{x}{r}')).toBe('cos θ = x/r')
    expect(texPlain('r = \\sqrt{(-3)^{2} + 4^{2}}')).toBe('r = √((−3)² + 4²)')
    expect(texPlain('A = \\frac{1}{2} r^{2} \\theta')).toBe('A = 1/2 r² θ')
    expect(texPlain('\\frac{\\pi}{180^{\\circ}}')).toBe('π/180°')
    expect(texPlain('\\frac{5 \\cdot 180^{\\circ}}{6}')).toBe('(5 · 180°)/6')
    expect(texPlain('\\text{undefined}')).toBe('undefined')
    expect(texPlain('\\frac{\\pi^{2}}{216}')).toBe('π²/216')
  })

  it('splits text from math, and reads the whole string', () => {
    const s = `Convert ${m('150^{\\circ}')} to radians.`
    expect(pieces(s)).toEqual([
      { tex: false, text: 'Convert ' },
      { tex: true, text: '150^{\\circ}' },
      { tex: false, text: ' to radians.' },
    ])
    expect(plain(s)).toBe('Convert 150° to radians.')
  })

  it('an answer that ends a sentence counts as shown; one inside a longer number does not', () => {
    expect(showsAnswer([`so it is ${m('-\\frac{1}{2}')}.`], ['-1/2'])).toBe(true)
    expect(showsAnswer([`the angle ${m('\\frac{7\\pi}{6}')}`], ['π/6'])).toBe(false)
    expect(showsAnswer(['the point (−3, 4)'], ['-3/5'])).toBe(false)
    expect(showsAnswer(['turns through 1050°'], ['30'])).toBe(false)
  })
})
