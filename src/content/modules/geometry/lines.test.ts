/**
 * The line reader and formatter. A fractional slope is printed in parentheses, "(2/5)x" or "-(1/5)x",
 * so it never reads as 2 over 5x, while every spelling she might type still reads as the same line.
 */
import { describe, expect, it } from 'vitest'
import { rat } from '@/notation'
import { formatLine, readLine, sameLine, slopeCoefficient, type LineEq } from './lines'

function line(text: string): LineEq {
  const read = readLine(text)
  if (!read.ok) throw new Error(`unread: ${text}`)
  return read.line
}

function allSame(spellings: readonly string[]) {
  const first = line(spellings[0]!)
  for (const typed of spellings) expect(sameLine(line(typed), first), typed).toBe(true)
}

describe('formatLine prints a fractional slope in parentheses', () => {
  it('positive and negative fractions, sign outside the parentheses, ASCII hyphen', () => {
    expect(formatLine(line('2x - 5y = -40'))).toBe('y = (2/5)x + 8')
    expect(formatLine(line('x + 5y = 23'))).toBe('y = -(1/5)x + 23/5')
    expect(formatLine(line('2x + 3y = 19'))).toBe('y = -(2/3)x + 19/3')
    expect(formatLine(line('y = 5/2x - 1'))).toBe('y = (5/2)x - 1')
    expect(formatLine(line('y = (1/2)x'))).toBe('y = (1/2)x')
  })

  it('leaves integer slopes, ±1, vertical and horizontal lines as they were', () => {
    expect(formatLine(line('y - 4 = 2(x - 1)'))).toBe('y = 2x + 2')
    expect(formatLine(line('y = -3x - 1'))).toBe('y = -3x - 1')
    expect(formatLine(line('y = x'))).toBe('y = x')
    expect(formatLine(line('x + y = 1'))).toBe('y = -x + 1')
    expect(formatLine(line('2x = 6'))).toBe('x = 3')
    expect(formatLine(line('3y + 6 = 0'))).toBe('y = -2')
    expect(formatLine(line('y = 2x + 1/2'))).toBe('y = 2x + 1/2')
  })

  it('never prints a fraction right against x, and reads its own output back as the same line', () => {
    for (let a = -6; a <= 6; a++) {
      for (let b = -6; b <= 6; b++) {
        if (a === 0 && b === 0) continue
        for (const c of [-7, -2, 0, 3, 11]) {
          const text = `${a}x + ${b}y + ${c} = 0`
          const shown = formatLine(line(text))
          expect(shown, text).not.toMatch(/\d\/\d+\s*x/)
          expect(shown, text).not.toContain('−')
          expect(sameLine(line(shown), line(text)), `${text} → ${shown}`).toBe(true)
        }
      }
    }
  }, 120_000)

  it('slopeCoefficient keeps the minus each place uses', () => {
    expect(slopeCoefficient(rat(2, 5), '−')).toBe('(2/5)')
    expect(slopeCoefficient(rat(-1, 5), '−')).toBe('−(1/5)')
    expect(slopeCoefficient(rat(-1, 5), '-')).toBe('-(1/5)')
    expect(slopeCoefficient(rat(-3, 1), '−')).toBe('−3')
    expect(slopeCoefficient(rat(4, 1), '-')).toBe('4')
  })
})

describe('readLine accepts every spelling she might type', () => {
  it('a positive fractional slope: 2/5x, (2/5)x, 2x/5, and standard form', () => {
    allSame(['y = (2/5)x + 8', 'y = 2/5x + 8', 'y = 2/5 x + 8', 'y = 2x/5 + 8', 'y = (2x)/5 + 8', 'y - 8 = (2/5)(x - 0)', '5y = 2x + 40', '2x - 5y = -40', '-2x + 5y = 40'])
  })

  it('a negative fractional slope: -(1/5)x, (-1/5)x, -1/5x, -x/5, point-slope, and standard form', () => {
    allSame([
      'y = -(1/5)x + 23/5',
      'y = (-1/5)x + 23/5',
      'y = -1/5x + 23/5',
      'y = -x/5 + 23/5',
      'y = (-x)/5 + 23/5',
      'y - 4 = -1/5(x - 3)',
      'y - 4 = -(1/5)(x - 3)',
      'y - 4 = (-1/5)(x - 3)',
      'x + 5y = 23',
      '5y = -x + 23',
      'y = −(1/5)x + 23/5',
      'y − 4 = −1/5(x − 3)',
    ])
  })

  it('reads 2/5x as (2/5)x, not 2/(5x), and tells a different line apart', () => {
    expect(sameLine(line('y = 2/5x + 8'), line('y = 0.4x + 8'))).toBe(true)
    expect(sameLine(line('y = (2/5)x + 8'), line('y = (5/2)x + 8'))).toBe(false)
    expect(sameLine(line('y = -(1/5)x + 23/5'), line('y = (1/5)x + 23/5'))).toBe(false)
    expect(readLine('y = 2/(5x) + 8').ok).toBe(false)
  })
})
