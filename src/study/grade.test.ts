import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/content/rng'
import { gradeStudyAnswer, normalizeStudyAnswer, pickTestCards, studyAnswersMatch, testAnswerSide } from './grade'

describe('a typed answer', () => {
  it.each([
    ['power house', 'power house', true],
    ['  POWER   house ', 'power house', true],
    ['Power\nHouse', 'power house', true],
    ['power\thouse', 'power house', true],
    ['  power   house  ', 'POWER house', true],
    ['nope', 'power house', false],
    ['', 'power house', false],
    ['Power House', 'power  house', true],
  ])('%j matches %j: %s', (given, expected, right) => {
    expect(studyAnswersMatch(given, expected)).toBe(right)
  })

  it('trims, collapses inner whitespace and ignores case', () => {
    expect(normalizeStudyAnswer('  A \n B\tC  ')).toBe('a b c')
  })

  it.each([
    ['sine and cosecant only.', 'Sine and cosecant only', 'closing punctuation'],
    ['pauli exclusion principle', 'The Pauli exclusion principle', 'a leading article'],
    ['wavelength', 'Wavelength (λ)', 'a bracketed aside left off'],
    ['wavelength (λ)', 'Wavelength (λ)', 'a bracketed aside typed'],
    ['wave particle duality', 'Wave-particle duality', 'a hyphen inside a word'],
    ['hunds rule', "Hund's rule", 'an apostrophe'],
  ])('%j is right for %j (%s)', (given, expected) => {
    expect(gradeStudyAnswer(given, expected)).toBe('right')
  })

  it.each([
    ['mitochondira', 'mitochondria'],
    ['powerhouse', 'power house'],
    ['heisenburg uncertainty principle', 'Heisenberg uncertainty principle'],
    ['ionic bonds', 'Ionic bond'],
  ])('%j is close for %j: it counts, and she is shown the spelling', (given, expected) => {
    expect(gradeStudyAnswer(given, expected)).toBe('close')
    expect(studyAnswersMatch(given, expected)).toBe(true)
  })

  it.each([
    ['1', '-1', 'a sign'],
    ['1/2', '√3/2', 'a different value'],
    ['3/2', '√3/2', 'a dropped root'],
    ['sin 20', 'sin 2θ', 'a formula one character off'],
    ['anion', 'cation', 'a different short word'],
    ['meiosis', 'mitosis', 'two letters off in a short word'],
    ['cos', 'sin', 'a short word'],
    ['()', 'Wavelength (λ)', 'nothing but brackets'],
  ])('%j is wrong for %j (%s)', (given, expected) => {
    expect(gradeStudyAnswer(given, expected)).toBe('wrong')
  })

  it('she types the shorter side of the cards; a tie is the term', () => {
    expect(testAnswerSide([{ term: 'Photon', definition: 'A particle of light that carries one quantum of energy.' }])).toBe('term')
    expect(testAnswerSide([{ term: 'sin 30° (π/6)', definition: '1/2' }])).toBe('definition')
    expect(testAnswerSide([{ term: 't1', definition: 'd1' }])).toBe('term')
    expect(testAnswerSide([])).toBe('term')
  })

  it('a bigger set is 10 cards; a smaller set is the whole set', () => {
    const dozen = Array.from({ length: 12 }, (_, i) => i)
    const picked = pickTestCards(dozen, mulberry32(1))
    expect(picked).toHaveLength(10)
    expect(new Set(picked).size).toBe(10)
    expect(picked.every((n) => dozen.includes(n))).toBe(true)
    expect(pickTestCards([1, 2, 3], () => 0).slice().sort()).toEqual([1, 2, 3])
    expect(pickTestCards([], () => 0)).toEqual([])
  })
})
