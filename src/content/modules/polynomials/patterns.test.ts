import { describe, expect, it } from 'vitest'
import { ERROR_PATTERNS, POLY_MISTAKE_KINDS, gradeAxisOfSymmetry, gradeVertex } from '@/engine'
import { POLY_MISTAKE_IDS, POLY_PATTERN, polyGradePattern, polyPattern, polyShow } from './patterns'

describe('polynomial mistake kinds → catalog', () => {
  it('maps all 24 kinds to their own poly_ id, each with a catalog entry', () => {
    expect(POLY_MISTAKE_KINDS).toHaveLength(24)
    expect(Object.keys(POLY_PATTERN).sort()).toEqual([...POLY_MISTAKE_KINDS].sort())
    expect(new Set(POLY_MISTAKE_IDS).size).toBe(24)
    for (const kind of POLY_MISTAKE_KINDS) {
      const id = POLY_PATTERN[kind]
      expect(id).toBe(`poly_${kind}`)
      const info = ERROR_PATTERNS[id]
      expect(info, id).toBeTruthy()
      expect(info.id).toBe(id)
      expect(info.title.length, id).toBeGreaterThan(8)
      expect(info.lesson.length, id).toBeGreaterThan(40)
      // Wrong → right, in that order.
      expect(info.example, id).toMatch(/✗ → /)
      // The catalog is display text: a real minus sign, never an ASCII hyphen before a digit.
      expect(`${info.title} ${info.lesson} ${info.example}`, id).not.toMatch(/(^|[\s(])-\d/)
    }
  })

  it('has no poly_ catalog entry without a kind', () => {
    const ids = Object.keys(ERROR_PATTERNS).filter((id) => id.startsWith('poly_'))
    expect(ids.sort()).toEqual([...POLY_MISTAKE_IDS].sort())
  })

  it('builds the hit with her witness, and only for a named mistake', () => {
    const hit = polyPattern('cs_h_sign', 'about her numbers')
    expect(hit).toMatchObject({ id: 'poly_cs_h_sign', witness: 'about her numbers' })
    expect(hit.title).toBe(ERROR_PATTERNS.poly_cs_h_sign.title)
    expect(polyPattern('cs_h_sign').witness).toBeUndefined()

    const named = gradeVertex('2x^2 - 12x + 13', '(-3, -5)')
    expect(named.verdict).toBe('mistake')
    expect(polyGradePattern(named)).toMatchObject({ id: 'poly_cs_h_sign', witness: named.verdict === 'mistake' ? named.witness : '' })
    expect(polyGradePattern(gradeVertex('2x^2 - 12x + 13', '(3, -5)'))).toBeNull()
    expect(polyGradePattern(gradeAxisOfSymmetry('2x^2 - 12x + 13', '7'))).toBeNull()
    expect(polyGradePattern(gradeAxisOfSymmetry('2x^2 - 12x + 13', ''))).toBeNull()
  })

  it('shows a real minus sign', () => {
    expect(polyShow('2(x - 3)^2 - 5')).toBe('2(x − 3)^2 − 5')
  })
})
