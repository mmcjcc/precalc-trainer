import { describe, expect, it } from 'vitest'
import { ERROR_PATTERNS } from '../matchers/catalog'
import { OPT_MISTAKE_IDS } from './types'

describe('optimization catalog entries', () => {
  it('every opt_ id has a title, a lesson of one to three sentences, and a wrong → right example', () => {
    for (const id of OPT_MISTAKE_IDS) {
      const e = ERROR_PATTERNS[id]
      expect(e.id).toBe(id)
      expect(e.title.length, id).toBeGreaterThan(10)
      expect(e.lesson.length, id).toBeGreaterThan(60)
      expect(e.lesson.split(/(?<=[.!?])\s+/).length, `${id}: one to three sentences`).toBeLessThanOrEqual(3)
      expect(e.example, id).toMatch(/✗ →/)
    }
  })

  it('the catalog’s opt_ ids are exactly the core’s', () => {
    const all = Object.keys(ERROR_PATTERNS).filter((k) => k.startsWith('opt_'))
    expect(all.sort()).toEqual([...OPT_MISTAKE_IDS].sort())
  })

  it('no example or lesson names a number a problem could have: letters, and digits only inside 2a, 2n, 2l', () => {
    for (const id of OPT_MISTAKE_IDS) {
      const { example, lesson, title } = ERROR_PATTERNS[id]
      // A digit on its own is a number; the 1 of n + 1 and n − 1 is the counting rule itself.
      for (const m of `${title} ${example} ${lesson}`.matchAll(/(?<![A-Za-z\d.])\d+(?:\.\d+)?(?![A-Za-z\d])/g)) expect(['1'], `${id}: ${m[0]}`).toContain(m[0])
      // The letters of the problems (x, y and an equation with A = …) only where they name the formula, never an answer.
      expect(example, id).not.toMatch(/A = [xy]|= -?\d+(?![a-z\d])/)
    }
  })
})
