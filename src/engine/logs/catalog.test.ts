import { describe, expect, it } from 'vitest'
import { ERROR_PATTERNS } from '../matchers/catalog'
import { LOG_MISTAKE_IDS } from './types'

describe('the log_ ids and their catalog entries', () => {
  it('every mistake id has a warm, specific entry: a title, a lesson and a wrong → right example', () => {
    expect(LOG_MISTAKE_IDS.length).toBe(22)
    expect(new Set(LOG_MISTAKE_IDS).size).toBe(LOG_MISTAKE_IDS.length)
    for (const id of LOG_MISTAKE_IDS) {
      const e = ERROR_PATTERNS[id]
      expect(e.id).toBe(id)
      expect(id.startsWith('log_')).toBe(true)
      expect(e.title.length).toBeGreaterThan(10)
      expect(e.lesson.length).toBeGreaterThan(60)
      expect(e.example).toMatch(/✗/)
    }
  })

  it('the caveat entry exists and is not listed as a mistake', () => {
    expect(ERROR_PATTERNS.log_check_answers.title).toMatch(/check/i)
    expect(LOG_MISTAKE_IDS).not.toContain('log_check_answers' as never)
  })

  it('every log_ id in the catalog is either a mistake or the caveat', () => {
    const all = Object.keys(ERROR_PATTERNS).filter((k) => k.startsWith('log_'))
    expect(all.sort()).toEqual([...LOG_MISTAKE_IDS, 'log_check_answers'].sort())
  })
})
