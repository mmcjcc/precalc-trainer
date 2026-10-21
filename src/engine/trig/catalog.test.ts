import { describe, expect, it } from 'vitest'
import { ERROR_PATTERNS } from '../matchers/catalog'
import { TRIG_MISTAKE_IDS } from './types'

describe('trig catalog entries', () => {
  it('every trig_ id has a title, a lesson in the warm voice, and a wrong → right example', () => {
    for (const id of TRIG_MISTAKE_IDS) {
      const e = ERROR_PATTERNS[id]
      expect(e.id).toBe(id)
      expect(e.title.length, id).toBeGreaterThan(10)
      expect(e.lesson.length, id).toBeGreaterThan(60)
      expect(e.lesson.split(/(?<=[.!?])\s+/).length, `${id}: one to three sentences`).toBeLessThanOrEqual(3)
      expect(e.example, id).toMatch(/✗ →/)
    }
  })

  it('the catalog’s trig_ ids are exactly the core’s', () => {
    const all = Object.keys(ERROR_PATTERNS).filter((k) => k.startsWith('trig_'))
    expect(all.sort()).toEqual([...TRIG_MISTAKE_IDS].sort())
  })

  it('no example names a value: letters and words only, no digit but the degrees of the rules', () => {
    for (const id of TRIG_MISTAKE_IDS) {
      const { example, lesson } = ERROR_PATTERNS[id]
      // Digits only in 90°, 180°, 360° and 2π (the rules themselves), never a special value or a generated angle.
      for (const m of `${example} ${lesson}`.replace(/2π/g, 'a full turn').matchAll(/\d+/g)) expect(['90', '180', '360'], `${id}: ${m[0]}`).toContain(m[0])
      expect(example, id).not.toMatch(/undefined|√[23]/)
    }
  })
})
