/**
 * Polynomial long division (engine/polynomials/long.ts). Her worksheet's four problems (a cubic over a
 * quadratic, photo of 2026-11-10) are worked here by hand and are the fixtures; then the identity
 * dividend = divisor · quotient + remainder is checked on many divisions, and each box's grader on
 * the slips it says it can tell apart.
 */
import { describe, expect, it } from 'vitest'
import { makeRng } from '@/content/rng'
import { rat } from '@/notation/rational'
import { polyAdd, polyDeg, polyEquals, polyIsZero, polyMul } from '../functions/poly'
import { readPoly } from './common'
import { gradeLongPart, longDivision } from './long'

/** Worked on paper: divide the leading terms, multiply, subtract, twice. */
const WORKSHEET = [
  {
    n: 5,
    dividend: 'x^3 + 3x^2 + 2x - 5',
    divisor: 'x^2 + 1',
    rounds: [
      { term: 'x', product: 'x^3 + x', difference: '3x^2 + x - 5' },
      { term: '3', product: '3x^2 + 3', difference: 'x - 8' },
    ],
    quotient: 'x + 3',
    remainder: 'x - 8',
  },
  {
    n: 6,
    dividend: '2x^3 - 3x^2 + 4x + 7',
    divisor: 'x^2 - x + 2',
    rounds: [
      { term: '2x', product: '2x^3 - 2x^2 + 4x', difference: '-x^2 + 7' },
      { term: '-1', product: '-x^2 + x - 2', difference: '-x + 9' },
    ],
    quotient: '2x - 1',
    remainder: '-x + 9',
  },
  {
    n: 7,
    dividend: '3x^3 + 5x^2 - 2x + 6',
    divisor: 'x^2 + 2x - 3',
    rounds: [
      { term: '3x', product: '3x^3 + 6x^2 - 9x', difference: '-x^2 + 7x + 6' },
      { term: '-1', product: '-x^2 - 2x + 3', difference: '9x + 3' },
    ],
    quotient: '3x - 1',
    remainder: '9x + 3',
  },
  {
    n: 8,
    dividend: '4x^3 - 7x^2 + 3x - 8',
    divisor: 'x^2 - 3x + 4',
    rounds: [
      { term: '4x', product: '4x^3 - 12x^2 + 16x', difference: '5x^2 - 13x - 8' },
      { term: '5', product: '5x^2 - 15x + 20', difference: '2x - 28' },
    ],
    quotient: '4x + 5',
    remainder: '2x - 28',
  },
] as const

const poly = (text: string) => {
  const p = readPoly(text)
  if (!p) throw new Error(`not a polynomial: ${text}`)
  return p.poly
}

describe('her worksheet, problems 5 to 8', () => {
  it.each(WORKSHEET)('problem $n: ($dividend) ÷ ($divisor)', (w) => {
    const d = longDivision(w.dividend, w.divisor)
    if (!d) throw new Error('no division')
    expect(d.rounds.map((r) => ({ term: r.term, product: r.product, difference: r.difference }))).toEqual(w.rounds)
    expect(d.quotient).toBe(w.quotient)
    expect(d.remainder).toBe(w.remainder)
    expect(d.rounds[0]!.current).toBe(w.dividend)
    expect(d.rounds[1]!.current).toBe(w.rounds[0].difference)
    // Every box takes its worked answer, typed the way she would.
    w.rounds.forEach((r, round) => {
      expect(gradeLongPart(w.dividend, w.divisor, { what: 'term', round }, r.term).verdict).toBe('correct')
      expect(gradeLongPart(w.dividend, w.divisor, { what: 'product', round }, r.product).verdict).toBe('correct')
      expect(gradeLongPart(w.dividend, w.divisor, { what: 'difference', round }, r.difference).verdict).toBe('correct')
    })
    expect(gradeLongPart(w.dividend, w.divisor, { what: 'quotient' }, w.quotient).verdict).toBe('correct')
    expect(gradeLongPart(w.dividend, w.divisor, { what: 'remainder' }, w.remainder).verdict).toBe('correct')
    // The explanation is three lines a round and the result, and ends on both answers.
    expect(d.explanation).toHaveLength(7)
    expect(d.explanation[6]).toContain('quotient')
  })

  it('problem 5 keeps the empty x column of x^2 + 1 in the rows it lines up', () => {
    const d = longDivision('x^3 + 3x^2 + 2x - 5', 'x^2 + 1')!
    expect(d.rounds[0]!.currentRow).toEqual(['1', '3', '2', '-5'])
    expect(d.rounds[0]!.productRow).toEqual(['1', '0', '1', '0'])
    expect(d.rounds[1]!.currentRow).toEqual(['3', '1', '-5'])
    expect(d.rounds[1]!.productRow).toEqual(['3', '0', '3'])
  })

  it('what she wrote on problem 5 is told apart from the right line', () => {
    // Her page: 2x^2 + 2x - 5 under the bar after a "1" on top.
    const g = gradeLongPart('x^3 + 3x^2 + 2x - 5', 'x^2 + 1', { what: 'difference', round: 0 }, '2x^2 + 2x - 5')
    expect(g.verdict).toBe('wrong')
    const term = gradeLongPart('x^3 + 3x^2 + 2x - 5', 'x^2 + 1', { what: 'term', round: 0 }, '1')
    expect(term.verdict).toBe('wrong')
    expect(term.verdict === 'wrong' && term.message).toMatch(/leading terms: x\^3 ÷ x\^2/)
  })
})

describe('the identity, on many divisions', () => {
  it('dividend = divisor · quotient + remainder, and the remainder has a lower degree', () => {
    const rng = makeRng(20261110)
    for (let i = 0; i < 400; i++) {
      const top = rng.int(2, 5)
      const bottom = rng.int(1, top)
      const dividend = Array.from({ length: top + 1 }, (_, k) => (k === 0 ? rng.intExcept(-6, 6, [0]) : rng.int(-9, 9)))
      const divisor = Array.from({ length: bottom + 1 }, (_, k) => (k === 0 ? rng.intExcept(-4, 4, [0]) : rng.int(-6, 6)))
      const d = longDivision(dividend, divisor)
      if (!d) throw new Error(`no division for ${dividend} / ${divisor}`)
      const a = poly(d.dividend)
      const b = poly(d.divisor)
      const q = d.quotient === '0' ? [] : poly(d.quotient)
      const r = d.remainder === '0' ? [] : poly(d.remainder)
      expect(polyEquals(polyAdd(polyMul(b, q), r), a), `${d.dividend} / ${d.divisor}`).toBe(true)
      expect(polyIsZero(r) || polyDeg(r) < polyDeg(b)).toBe(true)
      // Each round's lead cancels: the difference always has a lower degree than what was divided.
      for (const round of d.rounds) {
        const cur = poly(round.current)
        expect(round.difference === '0' || polyDeg(poly(round.difference)) < polyDeg(cur)).toBe(true)
        expect(round.currentRow).toHaveLength(polyDeg(cur) + 1)
        expect(round.productRow).toHaveLength(polyDeg(cur) + 1)
      }
    }
  })

  it('fractions stay exact when the divisor does not lead with 1', () => {
    const d = longDivision('x^3 + 1', '2x^2 + 1')!
    expect(polyEquals(poly(d.quotient), [rat(0), rat(1, 2)])).toBe(true)
    expect(polyEquals(polyAdd(polyMul(poly('2x^2 + 1'), [rat(0), rat(1, 2)]), poly(d.remainder)), poly('x^3 + 1'))).toBe(true)
  })

  it('there is no division by a constant, by zero, or by something of higher degree', () => {
    expect(longDivision('x^2 + 1', '3')).toBeNull()
    expect(longDivision('x^2 + 1', '0')).toBeNull()
    expect(longDivision('x + 1', 'x^2 + 1')).toBeNull()
  })
})

describe('grading one box', () => {
  const A = 'x^3 + 3x^2 + 2x - 5'
  const B = 'x^2 + 1'
  const C = '2x^3 - 3x^2 + 4x + 7'
  const D = 'x^2 - x + 2'
  const message = (g: ReturnType<typeof gradeLongPart>) => ('message' in g ? g.message : '')

  it('any form of the right polynomial is right', () => {
    expect(gradeLongPart(A, B, { what: 'product', round: 0 }, 'x(x^2 + 1)').verdict).toBe('correct')
    expect(gradeLongPart(A, B, { what: 'difference', round: 0 }, '-5 + x + 3x^2').verdict).toBe('correct')
    expect(gradeLongPart(C, D, { what: 'remainder' }, '9 - x').verdict).toBe('correct')
  })

  it('a right box never states a later answer', () => {
    const g = gradeLongPart(A, B, { what: 'term', round: 0 }, 'x')
    expect(message(g)).not.toContain('x + 3')
    expect(message(g)).not.toContain('x − 8')
    const diff = gradeLongPart(A, B, { what: 'difference', round: 0 }, '3x^2 + x - 5')
    expect(message(diff)).toMatch(/another round/)
    expect(message(gradeLongPart(A, B, { what: 'difference', round: 1 }, 'x - 8'))).toMatch(/lower than the degree/)
  })

  it('the minus sign not carried through the product is named in words', () => {
    // (2x^3 - 3x^2 + 4x + 7) - (2x^3 - 2x^2 + 4x): the leads cancel, then -2x^2 and 4x are added.
    const g = gradeLongPart(C, D, { what: 'difference', round: 0 }, '-5x^2 + 8x + 7')
    expect(g.verdict).toBe('wrong')
    expect(message(g)).toMatch(/minus sign belongs to every term/)
  })

  it('only the first term of the divisor multiplied', () => {
    const g = gradeLongPart(C, D, { what: 'product', round: 0 }, '2x^3')
    expect(g.verdict).toBe('wrong')
    expect(message(g)).toMatch(/first term of the divisor only/)
  })

  it('the rest of the dividend not brought down', () => {
    const g = gradeLongPart(A, B, { what: 'difference', round: 0 }, '3x^2 + x')
    expect(g.verdict).toBe('wrong')
    expect(message(g)).toMatch(/Bring down the rest/)
  })

  it('a skipped power in the divisor gets its own sentence on a wrong subtraction', () => {
    expect(message(gradeLongPart(A, B, { what: 'difference', round: 0 }, '3x^2 + 2x - 6'))).toMatch(/skips a power/)
    expect(message(gradeLongPart(C, D, { what: 'difference', round: 0 }, 'x^2 + 1'))).not.toMatch(/skips a power/)
  })

  it('the quotient and the remainder are not each other, and neither box takes the whole result', () => {
    expect(message(gradeLongPart(A, B, { what: 'quotient' }, 'x - 8'))).toMatch(/what was left at the end/)
    expect(message(gradeLongPart(A, B, { what: 'remainder' }, 'x + 3'))).toMatch(/That is the quotient/)
    const whole = gradeLongPart(A, B, { what: 'quotient' }, 'x + 3 + (x - 8)/(x^2 + 1)')
    expect(whole).toMatchObject({ verdict: 'invalid', reason: 'not_in_form' })
    const over = gradeLongPart(A, B, { what: 'remainder' }, '(x - 8)/(x^2 + 1)')
    expect(over).toMatchObject({ verdict: 'invalid', reason: 'not_in_form' })
    expect(message(over)).toMatch(/without the divisor under it/)
  })

  it('an empty or unreadable box is not an attempt', () => {
    expect(gradeLongPart(A, B, { what: 'term', round: 0 }, '').verdict).toBe('invalid')
    expect(gradeLongPart(A, B, { what: 'term', round: 0 }, 'x +').verdict).toBe('invalid')
    expect(gradeLongPart(A, B, { what: 'term', round: 0 }, '1/x').verdict).toBe('invalid')
    expect(gradeLongPart(A, B, { what: 'term', round: 7 }, 'x').verdict).toBe('unsupported')
  })
})
