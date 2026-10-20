import { describe, expect, it } from 'vitest'
import { toLatex } from './toLatex'

describe('toLatex: a number times a power of a number keeps its dot', () => {
  it.each([
    ['5 * 7^x = 1715', '5\\cdot 7^{x} = 1715'],
    ['4^x - 9 * 2^x + 8 = 0', '4^{x}-9\\cdot 2^{x}+8 = 0'],
    ['2 * 3^(x - 1) - 4', '2\\cdot 3^{x-1}-4'],
    ['2 * 3x', '2\\cdot 3x'],
    // The live site showed this one as 10001.05^x = 3000.
    ['1000(1.05)^x = 3000', '1000\\cdot 1.05^{x} = 3000'],
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

describe('toLatex: a function call raised to a power keeps its brackets', () => {
  it('(log 1.08)^x never prints as log(1.08)^x, which reads as log(1.08^x)', () => {
    expect(toLatex('log(1.08)^x')).toBe(String.raw`\left(\log\left(1.08\right)\right)^{x}`)
    expect(toLatex('ln(x)^2')).toBe(String.raw`\left(\ln\left(x\right)\right)^{2}`)
    // The other reading, a log of a power, has no outer brackets.
    expect(toLatex('log(1.08^x)')).toBe(String.raw`\log\left(1.08^{x}\right)`)
  })

  it('an absolute value keeps its bars alone', () => {
    expect(toLatex('abs(x)^2')).toBe(String.raw`\left|x\right|^{2}`)
  })
})
