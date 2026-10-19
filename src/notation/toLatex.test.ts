import { describe, expect, it } from 'vitest'
import { toLatex } from './toLatex'

describe('toLatex: a number times a power of a number keeps its dot', () => {
  it.each([
    ['5 * 7^x = 1715', '5\\cdot 7^{x} = 1715'],
    ['4^x - 9 * 2^x + 8 = 0', '4^{x}-9\\cdot 2^{x}+8 = 0'],
    ['2 * 3^(x - 1) - 4', '2\\cdot 3^{x-1}-4'],
    ['2 * 3x', '2\\cdot 3x'],
  ])('%s', (text, tex) => {
    expect(toLatex(text)).toBe(tex)
  })

  it('leaves products that read correctly side by side as they were', () => {
    expect(toLatex('2x')).toBe('2x')
    expect(toLatex('3e^(x - 1) + 2')).toBe('3e^{x-1}+2')
    expect(toLatex('2 * (1/2)^x')).toBe('2\\left(\\frac{1}{2}\\right)^{x}')
    expect(toLatex('2log_3(x - 1) + 4')).toBe('2\\log_{3}\\left(x-1\\right)+4')
    expect(toLatex('x * 2')).toBe('x\\cdot 2')
  })
})
