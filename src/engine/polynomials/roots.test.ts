import { describe, expect, it } from 'vitest'
import { ratToString } from '@/notation/rational'
import { gradeRationalZeros, gradeRootCandidates, rationalRootCandidates, rootCandidateMistakes } from './roots'
import type { PolyGrade } from './types'

/** 2x^3 − 5x^2 − 4x + 3 = (x + 1)(2x − 1)(x − 3): candidates ±1, ±3, ±1/2, ±3/2; zeros −1, 1/2, 3. */
const F = '2x^3 - 5x^2 - 4x + 3'

function mistakeOf(g: PolyGrade): string | null {
  return g.verdict === 'mistake' ? g.mistake : null
}

describe('rationalRootCandidates', () => {
  it('the sample', () => {
    const m = rationalRootCandidates(F)!
    expect(m.f).toBe(F)
    expect([m.constant, m.leading]).toEqual([3, 2])
    expect(m.p).toEqual([1, 3])
    expect(m.q).toEqual([1, 2])
    expect(m.positives.map(ratToString)).toEqual(['1', '3', '1/2', '3/2'])
    expect(m.candidates.map(ratToString)).toEqual(['-3', '-3/2', '-1', '-1/2', '1/2', '1', '3/2', '3'])
    expect(m.text).toBe('+-1, +-3, +-1/2, +-3/2')
    expect(m.tests.map((t) => `${ratToString(t.candidate)}:${ratToString(t.value)}`)).toEqual(['-3:-84', '-3/2:-9', '-1:0', '-1/2:7/2', '1/2:0', '1:-4', '3/2:-15/2', '3:0'])
    expect(m.zeros.map(ratToString)).toEqual(['-1', '1/2', '3'])
    expect(m.multiplicities).toEqual([1, 1, 1])
    expect(m.explanation).toEqual([
      'Constant term 3: its factors are p = ±1, ±3.',
      'Leading coefficient 2: its factors are q = ±1, ±2.',
      'Every rational zero is one of the fractions p/q: ±1, ±3, ±1/2, ±3/2. That is 8 candidates once repeats are removed.',
    ])
    expect(m.zeroExplanation).toEqual([
      'Test each candidate: put it into f(x) (or divide synthetically and look for remainder 0).',
      'f(−1) = 0, f(1/2) = 0 and f(3) = 0, so the rational zeros are −1, 1/2 and 3. Every other candidate gives a value that is not 0.',
    ])
  })

  it('hand-checked lists and zeros', () => {
    const cases: [string, string, string[]][] = [
      ['x^3 - 7x + 6', '+-1, +-2, +-3, +-6', ['-3', '1', '2']],
      ['6x^3 + 11x^2 - 3x - 2', '+-1, +-2, +-1/2, +-1/3, +-2/3, +-1/6', ['-2', '-1/3', '1/2']],
      ['x^2 + x + 1', '+-1', []],
      ['4x^2 - 1', '+-1, +-1/2, +-1/4', ['-1/2', '1/2']],
      ['x^4 - 5x^2 + 4', '+-1, +-2, +-4', ['-2', '-1', '1', '2']],
      ['2x^2 - 3x - 2', '+-1, +-2, +-1/2', ['-1/2', '2']],
      ['-3x^3 + 4x - 8', '+-1, +-2, +-4, +-8, +-1/3, +-2/3, +-4/3, +-8/3', []],
      ['x^3 - 3x^2 + 3x - 1', '+-1', ['1']],
      ['4x^3 - 12x^2 + 9x', '', []],
    ]
    for (const [f, text, zeros] of cases) {
      const m = rationalRootCandidates(f)
      if (!text) {
        expect(m, f).toBeNull()
        continue
      }
      expect([m!.text, m!.zeros.map(ratToString)], f).toEqual([text, zeros])
      // Repeats are removed: 2/2 is 1, 4/4 is 1.
      expect(new Set(m!.candidates.map(ratToString)).size).toBe(m!.candidates.length)
    }
    expect(rationalRootCandidates('x^3 - 3x^2 + 3x - 1')!.multiplicities).toEqual([3])
    expect(rationalRootCandidates([2, -5, -4, 3])!.text).toBe('+-1, +-3, +-1/2, +-3/2')
    expect(rationalRootCandidates('x^2 + x + 1')!.zeroExplanation[1]).toBe('None of the 2 candidates gives 0, so f(x) has no rational zeros.')
  })

  it('needs integer coefficients and a nonzero constant term', () => {
    for (const f of ['x^3 - x', '(1/2)x^2 - 1', '7', 'sqrt(x) - 1', '1/x', '']) expect(rationalRootCandidates(f), f).toBeNull()
    expect(gradeRootCandidates('x^3 - x', '+-1').verdict).toBe('unsupported')
    expect(gradeRationalZeros('(1/2)x^2 - 1', 'none').verdict).toBe('unsupported')
  })
})

describe('gradeRootCandidates', () => {
  it('accepts the set in any spelling', () => {
    for (const a of [
      '+-1, +-3, +-1/2, +-3/2',
      '±1, ±3, ±1/2, ±3/2',
      '±3/2, ±1/2, ±3, ±1',
      '1, -1, 3, -3, 1/2, -1/2, 3/2, -3/2',
      '{1, -1, 3, -3, 0.5, -0.5, 1.5, -1.5}',
      '+-{1, 3, 1/2, 3/2}',
      '±(1, 3, 1/2, 3/2)',
      '±1, ±3, ±1/2, ±3/2, ±1/1, ±3/1',
      '+/-1, +/-3, +/-1/2, +/-3/2',
    ]) {
      expect(gradeRootCandidates(F, a), a).toMatchObject({ verdict: 'correct', message: 'Correct: all 8 candidates, ±1, ±3, ±1/2, ±3/2 (factors of 3 over factors of 2).' })
    }
    expect(gradeRootCandidates('6x^3 + 11x^2 - 3x - 2', '±1, ±2, ±1/2, ±2/2, ±1/3, ±2/3, ±1/6, ±2/6').verdict).toBe('correct')
  })

  it('only the positives', () => {
    expect(gradeRootCandidates(F, '1, 3, 1/2, 3/2')).toMatchObject({
      verdict: 'mistake',
      mistake: 'rrt_no_plus_minus',
      witness: 'Each candidate can be positive or negative: ±1, ±3, ±1/2, ±3/2. You listed only the positive ones, so 4 candidates are missing (−1, for example).',
    })
  })

  it('q/p instead of p/q', () => {
    expect(gradeRootCandidates(F, '±1, ±2, ±1/3, ±2/3')).toMatchObject({
      verdict: 'mistake',
      mistake: 'rrt_inverted',
      witness:
        'The candidates are p/q: factors of the CONSTANT term 3 on top, factors of the LEADING coefficient 2 underneath. Your list has them upside down (q/p): 2 is on it, but 2 is not a factor of 3.',
    })
  })

  it('only integers when q > 1 gives fractions', () => {
    expect(gradeRootCandidates(F, '±1, ±3')).toMatchObject({
      verdict: 'mistake',
      mistake: 'rrt_integers_only',
      witness: 'The leading coefficient is 2, not ±1, so the denominator 2 gives fractions too: ±1/2, ±3/2. You listed only the factors of 3.',
    })
    const g = gradeRootCandidates('6x^3 + 11x^2 - 3x - 2', '±1, ±2')
    expect(g.verdict === 'mistake' && g.witness).toBe('The leading coefficient is 6, not ±1, so the denominators 2, 3 and 6 give fractions too: ±1/2, ±1/3, ±2/3, ±1/6. You listed only the factors of −2.')
  })

  it('factors of the wrong coefficients', () => {
    expect(gradeRootCandidates(F, '±1, ±2, ±4, ±1/2')).toMatchObject({
      verdict: 'mistake',
      mistake: 'rrt_wrong_coefficients',
      witness: 'Use the constant term 3 for p and the leading coefficient 2 for q. Your list comes from −4 (the coefficient of the x term) over 2 (the leading coefficient).',
    })
    expect(mistakeOf(gradeRootCandidates(F, '±1, ±5, ±1/2, ±5/2'))).toBe('rrt_wrong_coefficients')
  })

  it('candidates that would equal the right list are dropped', () => {
    // Leading coefficient 1: integers only IS the list; q/p is ±1, ±1/2, ±1/3, ±1/6.
    expect(rootCandidateMistakes('x^3 - 7x + 6')!.map((c) => c.kind).filter((k) => k !== 'rrt_wrong_coefficients')).toEqual(['rrt_no_plus_minus', 'rrt_inverted'])
    // 2x^2 − 3x − 2: constant and leading coefficient have the same factors, so q/p is the same list.
    expect(rootCandidateMistakes('2x^2 - 3x - 2')!.some((c) => c.kind === 'rrt_inverted')).toBe(false)
    expect(rootCandidateMistakes(F)!.slice(0, 3).map((c) => [c.kind, c.text])).toEqual([
      ['rrt_no_plus_minus', '1/2, 1, 3/2, 3'],
      ['rrt_inverted', '-2, -1, -2/3, -1/3, 1/3, 2/3, 1, 2'],
      ['rrt_integers_only', '-3, -1, 1, 3'],
    ])
  })

  it('other wrong lists say what is missing and what does not belong', () => {
    expect(gradeRootCandidates(F, '±1, ±3, ±1/2')).toMatchObject({ verdict: 'wrong', message: 'You have 6 of the 8 candidates. Missing: ±3/2.' })
    expect(gradeRootCandidates(F, '±1, ±3, ±1/2, 3/2')).toMatchObject({ verdict: 'wrong', message: 'You have 7 of the 8 candidates. Missing: −3/2.' })
    expect(gradeRootCandidates(F, '±1, ±3, ±1/2, ±3/2, ±5')).toMatchObject({
      verdict: 'wrong',
      message: '5 is not a candidate: its numerator 5 is not a factor of the constant term 3. (2 of your numbers are not candidates.)',
    })
    expect(gradeRootCandidates(F, '±1, ±3, ±1/2, ±3/2, 1/4')).toMatchObject({
      verdict: 'wrong',
      message: '1/4 is not a candidate: its denominator 4 is not a factor of the leading coefficient 2.',
    })
    expect(gradeRootCandidates(F, '±1, ±3, ±1/2, ±3/2, 0')).toMatchObject({ verdict: 'wrong', message: '0 is not a candidate: 0 is never a candidate when the constant term is not 0.' })
    expect(gradeRootCandidates(F, '±1, ±3, ±1/2, ±3/2, sqrt(3)')).toMatchObject({ verdict: 'wrong', message: 'sqrt(3) is not a rational number, so it cannot be a candidate.' })
  })

  it('unreadable lists are invalid', () => {
    expect(gradeRootCandidates(F, '')).toMatchObject({ verdict: 'invalid', reason: 'unreadable' })
    expect(gradeRootCandidates(F, '±1, , ±3')).toMatchObject({ verdict: 'invalid', index: 1 })
    expect(gradeRootCandidates(F, '±1, ±three')).toMatchObject({ verdict: 'invalid', index: 1 })
    expect(gradeRootCandidates(F, '±1, ±3/0')).toMatchObject({ verdict: 'invalid', index: 1 })
  })
})

describe('gradeRationalZeros', () => {
  it('the zeros as a set', () => {
    for (const a of ['-1, 1/2, 3', '3, -1, 0.5', '{−1, 1/2, 3}', 'x = -1, x = 1/2, x = 3']) {
      expect(gradeRationalZeros(F, a), a).toMatchObject({ verdict: 'correct', message: 'Correct: f(−1) = 0, f(1/2) = 0 and f(3) = 0; no other candidate is a zero.' })
    }
    expect(gradeRationalZeros('x^2 + x + 1', 'none')).toMatchObject({ verdict: 'correct', message: 'Correct: none of the 2 candidates gives 0, so f(x) has no rational zeros.' })
    expect(gradeRationalZeros('4x^2 - 1', '±1/2').verdict).toBe('correct')
    const g = gradeRationalZeros(F, '-1, 1/2, 3')
    expect(g.verdict === 'correct' && g.explanation.length).toBe(5)
  })

  it('every sign backwards', () => {
    expect(gradeRationalZeros(F, '1, -1/2, -3')).toMatchObject({
      verdict: 'mistake',
      mistake: 'zero_sign_reversed',
      witness: 'Every sign is backwards: f(1) = −4, not 0, while f(−1) = 0. A zero is the number that makes f(x) equal 0 (the factor for x = −1 is the one that is 0 there).',
    })
    // Symmetric zeros: flipping the signs changes nothing, so nothing is named.
    expect(gradeRationalZeros('4x^2 - 1', '1/2, -1/2').verdict).toBe('correct')
    expect(gradeRationalZeros('x^4 - 5x^2 + 4', '-2, -1, 1, 2').verdict).toBe('correct')
  })

  it('a number that is not a zero gets its exact value; a missing zero is not given away', () => {
    expect(gradeRationalZeros(F, '-1, 1/2, 3, 1')).toMatchObject({ verdict: 'wrong', message: '1 is not a zero: f(1) = −4, not 0.' })
    expect(gradeRationalZeros(F, '-1, 3')).toMatchObject({
      verdict: 'wrong',
      message: 'You have 2 of the 3 rational zeros: keep testing the candidates −3, −3/2, −1, −1/2, 1/2, 1, 3/2, 3 for a remainder of 0.',
    })
    expect(gradeRationalZeros(F, '2')).toMatchObject({
      verdict: 'wrong',
      message:
        '2 is not a zero: f(2) = −9, not 0 (it is not even on the candidate list). There are 3 rational zeros among the candidates −3, −3/2, −1, −1/2, 1/2, 1, 3/2, 3: test them until the remainder is 0.',
    })
    expect(gradeRationalZeros(F, 'none')).toMatchObject({ verdict: 'wrong' })
    expect(gradeRationalZeros('x^2 + x + 1', '1')).toMatchObject({ verdict: 'wrong', message: '1 is not a zero: f(1) = 3, not 0.' })
    expect(gradeRationalZeros(F, '')).toMatchObject({ verdict: 'invalid' })
  })
})

describe('root-candidate mistakes never fire on the right answer', () => {
  it('every candidate list differs from the right one and grades as its own kind', () => {
    for (const f of [F, 'x^3 - 7x + 6', '6x^3 + 11x^2 - 3x - 2', '4x^2 - 1', 'x^4 - 5x^2 + 4', '2x^2 - 3x - 2', '-3x^3 + 4x - 8', '3x^3 - 2x^2 + 6x - 4', 'x^2 + x + 1']) {
      const m = rationalRootCandidates(f)!
      expect(gradeRootCandidates(f, m.text).verdict, f).toBe('correct')
      expect(gradeRootCandidates(f, m.candidates.map(ratToString).join(', ')).verdict, f).toBe('correct')
      expect(gradeRationalZeros(f, m.zeros.length ? m.zeros.map(ratToString).join(', ') : 'none').verdict, f).toBe('correct')
      const right = m.candidates.map(ratToString).join(', ')
      const seen = new Set<string>()
      for (const c of rootCandidateMistakes(f)!) {
        expect(c.text, f).not.toBe(right)
        expect(seen.has(c.text), `${f}: ${c.text}`).toBe(false)
        seen.add(c.text)
        expect(mistakeOf(gradeRootCandidates(f, c.text)), `${f}: ${c.text}`).toBe(c.kind)
      }
      // Every zero the grader accepts makes f vanish exactly.
      for (const z of m.zeros) expect(m.tests.find((t) => ratToString(t.candidate) === ratToString(z))!.value.n, f).toBe(0)
    }
  })
})

describe('reading lists', () => {
  it('± with a space, x = in front, and parentheses around the whole list', () => {
    expect(gradeRootCandidates(F, '+ - 1, + - 3, + - 1/2, + - 3/2').verdict).toBe('correct')
    expect(gradeRootCandidates(F, '(1, -1, 3, -3, 1/2, -1/2, 3/2, -3/2)').verdict).toBe('correct')
    expect(gradeRootCandidates(F, 'x = ±1, x = ±3, x = ±1/2, x = ±3/2').verdict).toBe('correct')
    expect(gradeRationalZeros(F, '(-1, 1/2, 3)').verdict).toBe('correct')
    expect(gradeRationalZeros(F, '(1/2), 3, -1').verdict).toBe('correct')
    expect(gradeRationalZeros('4x^2 - 1', 'x = ±1/2').verdict).toBe('correct')
  })
})

describe('numbers too large for exact arithmetic', () => {
  it('are reported as unreadable, never thrown', () => {
    expect(gradeRationalZeros(F, '99999999999')).toMatchObject({ verdict: 'invalid', reason: 'unreadable', message: 'A number in that answer is too large to check exactly. Look for a typing slip.' })
    expect(['invalid', 'wrong']).toContain(gradeRootCandidates(F, '±1, ±99999999999999999999').verdict)
  })
})
