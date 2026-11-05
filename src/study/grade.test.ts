import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/content/rng'
import { normalizeStudyAnswer, pickTestCards, studyAnswersMatch } from './grade'

describe('a typed answer', () => {
  it.each([
    ['power house', 'power house', true],
    ['  POWER   house ', 'power house', true],
    ['Power\nHouse', 'power house', true],
    ['power\thouse', 'power house', true],
    ['  power   house  ', 'POWER house', true],
    ['powerhouse', 'power house', false],
    ['nope', 'power house', false],
    ['', 'power house', false],
    ['Power House', 'power  house', true],
  ])('%j matches %j: %s', (given, definition, expected) => {
    expect(studyAnswersMatch(given, definition)).toBe(expected)
  })

  it('trims, collapses inner whitespace and ignores case', () => {
    expect(normalizeStudyAnswer('  A \n B\tC  ')).toBe('a b c')
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
