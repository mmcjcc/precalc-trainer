import { describe, expect, it } from 'vitest'
import { parseStatement } from '../parse'
import { checkLogStep, logLineSlips } from './index'

describe('logLineSlips', () => {
  it('lists what the named mistakes turn a line into, as lines the parser reads back, each once', () => {
    const slips = logLineSlips('3^x = 13')
    expect(slips.length).toBeGreaterThan(3)
    const ids = new Set(slips.map((s) => s.id))
    expect(ids.has('log_convert_dropped')).toBe(true)
    expect(ids.has('log_one_side')).toBe(true)
    expect(ids.has('log_power_as_power')).toBe(true)
    expect(new Set(slips.map((s) => s.text)).size).toBe(slips.length)
    for (const s of slips) expect(parseStatement(s.text, ['x']).ok, s.text).toBe(true)
    expect(slips[0]).toEqual({ id: 'log_convert_dropped', text: 'x = 13' })
  })

  it('gives the slips of dividing by a log factor', () => {
    const texts = logLineSlips('x * log(3) = log(13)').map((s) => `${s.id} ${s.text}`)
    expect(texts).toContain('log_change_base_inverted x = log(3)/log(13)')
    expect(texts).toContain('log_quotient_as_quotient x = log(13/3)')
  })

  it('a slip, checked as her next line, is named as that slip', () => {
    for (const s of logLineSlips('x * log(3) = log(13)').filter((s) => s.text.startsWith('x ='))) {
      const r = checkLogStep('x * log(3) = log(13)', s.text, { vars: ['x'] })
      expect(r.ok, s.text).toBe(false)
      expect(r.pattern?.id, s.text).toBe(s.id)
    }
  })

  it('has nothing for a line it cannot read, or for a line of several relations', () => {
    expect(logLineSlips('3^x = ')).toEqual([])
    expect(logLineSlips('x = 2 or x = 3')).toEqual([])
    expect(logLineSlips('x(x - 5) = 36')).toEqual([])
  })
})
