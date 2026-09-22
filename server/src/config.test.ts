import { describe, expect, it } from 'vitest'
import { ConfigError, describeConfig, loadConfig, parseUserList } from './config.ts'
import { DailyLimiter } from './limits.ts'
import { localDay, monthFile } from './log.ts'
import { redactPersonal } from './validate.ts'

describe('configuration', () => {
  it('has safe defaults: gemini, closed allowlist, memory log, 30 a day, loopback', () => {
    const c = loadConfig({})
    expect(c).toMatchObject({
      provider: 'gemini',
      geminiModel: 'gemini-3.8-flash',
      geminiThinking: 'low',
      anthropicModel: 'claude-opus-5',
      dailyLimit: 30,
      timeoutMs: 60_000,
      timeZone: 'America/New_York',
      logDir: null,
      host: '127.0.0.1',
      port: 3000,
    })
    expect(c.allowedUsers.size).toBe(0)
    expect(c.parentUsers.size).toBe(0)
  })

  it('reads the lists lower-cased and refuses unsafe entries', () => {
    expect([...parseUserList('X', ' Kid@Example.com, ,parent+p@example.org ')]).toEqual(['kid@example.com', 'parent+p@example.org'])
    expect(() => parseUserList('ALLOWED_USERS', 'kid@example.com;default 1')).toThrow(ConfigError)
    expect(() => parseUserList('PARENT_USERS', '*')).toThrow(/PARENT_USERS/)
  })

  it('refuses unknown providers and out-of-range numbers', () => {
    expect(() => loadConfig({ TUTOR_PROVIDER: 'openai' })).toThrow(/TUTOR_PROVIDER/)
    expect(() => loadConfig({ TUTOR_DAILY_LIMIT: '0' })).toThrow(/TUTOR_DAILY_LIMIT/)
    expect(() => loadConfig({ TUTOR_DAILY_LIMIT: 'lots' })).toThrow(ConfigError)
    expect(() => loadConfig({ GEMINI_THINKING: 'max' })).toThrow(/GEMINI_THINKING/)
    expect(() => loadConfig({ TUTOR_TIMEZONE: 'Mars/Olympus' })).toThrow(/TUTOR_TIMEZONE/)
    expect(loadConfig({ TUTOR_PROVIDER: ' Anthropic ' }).provider).toBe('anthropic')
  })

  it('the start-up line says whether a key is set, never the key', () => {
    const line = describeConfig(loadConfig({ GEMINI_API_KEY: 'AIza-very-secret', ALLOWED_USERS: 'a@b.co' }))
    expect(line).toContain('key=set')
    expect(line).not.toContain('AIza')
    expect(describeConfig(loadConfig({}))).toContain('key=MISSING')
  })
})

describe('daily limiter', () => {
  it('reserves, counts, releases and rolls over', () => {
    let day = '2026-09-21'
    const l = new DailyLimiter(2, () => day, new Map([['kid', 1]]))
    expect(l.remaining('kid')).toBe(1)
    expect(l.reserve('kid')).toBe('ok')
    expect(l.reserve('kid')).toBe('busy')
    expect(l.commit('kid', false)).toBe(1) // a failed answer gives the slot back
    expect(l.reserve('kid')).toBe('ok')
    expect(l.commit('kid', true)).toBe(0)
    expect(l.reserve('kid')).toBe('limit')
    expect(l.reserve('parent')).toBe('ok')
    day = '2026-09-22'
    expect(l.remaining('kid')).toBe(2)
  })
})

describe('log helpers', () => {
  it('days and month files follow the configured time zone', () => {
    const late = new Date('2026-10-01T02:00:00Z') // still Sept 30 in New York
    expect(localDay(late, 'America/New_York')).toBe('2026-09-30')
    expect(localDay(late, 'UTC')).toBe('2026-10-01')
    expect(monthFile('2026-09-30')).toBe('tutor-2026-09.jsonl')
  })
})

describe('personal details in her question', () => {
  it('removes email addresses and phone numbers, leaves math alone', () => {
    expect(redactPersonal('mail me at kid.two+x@gmail.com please')).toBe('mail me at [email removed] please')
    expect(redactPersonal('call 555-123-4567 or (555) 123 4567 or +1 555.123.4567')).toBe('call [phone removed] or [phone removed] or [phone removed]')
    for (const math of ['x^2 - 5x + 6 <= 0', '6.022 x 10^23', '(-inf, 3] U (5, inf)', '12.50 / 4.1 = 3.0', '1234567890']) {
      expect(redactPersonal(math)).toBe(math)
    }
  })
})
