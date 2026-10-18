import { describe, expect, it } from 'vitest'
import { ERROR_PATTERNS } from '../matchers/catalog'
import { NM_MISTAKE_IDS } from './types'

describe('the nm_ ids and their catalog entries', () => {
  it('every mistake id has a warm, specific entry: a title, a lesson and a wrong → right example', () => {
    expect(NM_MISTAKE_IDS.length).toBe(32)
    expect(new Set(NM_MISTAKE_IDS).size).toBe(NM_MISTAKE_IDS.length)
    for (const id of NM_MISTAKE_IDS) {
      const e = ERROR_PATTERNS[id]
      expect(e.id).toBe(id)
      expect(id.startsWith('nm_')).toBe(true)
      expect(e.title.length, id).toBeGreaterThan(10)
      expect(e.lesson.length, id).toBeGreaterThan(60)
      expect(e.example, id).toMatch(/✗ .*→/)
    }
  })

  it('every nm_ id in the catalog is listed', () => {
    const all = Object.keys(ERROR_PATTERNS).filter((k) => k.startsWith('nm_'))
    expect(all.sort()).toEqual([...NM_MISTAKE_IDS].sort())
  })
})
