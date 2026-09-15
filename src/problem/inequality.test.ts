import { describe, expect, it } from 'vitest'
import { setFromRelation } from '@/notation'
import { gradeFinalAnswer, previewInterval } from './inequality'

const target = { set: setFromRelation('x >= -6')!, requireInterval: true, requireSetBuilder: true }

describe('gradeFinalAnswer', () => {
  it('accepts when both notations agree with the target', () => {
    const g = gradeFinalAnswer('[-6, inf)', '{x | x >= -6}', target)
    expect(g.done).toBe(true)
    expect(g.interval.status).toBe('ok')
    expect(g.setBuilder.status).toBe('ok')
    expect(g.graded).toEqual({ interval: true, setBuilder: true })
  })

  it('reports set_interval_mismatch before grading against the target', () => {
    const g = gradeFinalAnswer('(-6, inf)', '{x | x >= -6}', target)
    expect(g.done).toBe(false)
    expect(g.mismatch?.id).toBe('set_interval_mismatch')
    expect(g.interval.status).toBe('wrong')
    expect(g.setBuilder.status).toBe('wrong')
    expect(g.interval.message).toMatch(/-6/)
  })

  it('grades a lone wrong interval against the target with a pattern lesson', () => {
    const g = gradeFinalAnswer('(-6, inf)', '', target)
    expect(g.done).toBe(false)
    expect(g.interval.status).toBe('wrong')
    expect(g.interval.pattern?.id).toBe('endpoint_type')
    expect(g.setBuilder.status).toBe('empty')
    expect(g.graded).toEqual({ interval: true })
  })

  it('keeps notation parse failures as coaching, not attempts against the target', () => {
    const g = gradeFinalAnswer('(inf, -6]', '', target)
    expect(g.interval.status).toBe('parse')
    expect(g.interval.pattern?.id).toBe('backwards_interval')
    expect(g.interval.error?.position).toBe(0)
    expect(g.graded).toEqual({})
  })

  it('is not done until every required input is right', () => {
    const g = gradeFinalAnswer('[-6, inf)', '', target)
    expect(g.interval.status).toBe('ok')
    expect(g.done).toBe(false)
    const g2 = gradeFinalAnswer('[-6, inf)', '', { ...target, requireSetBuilder: false })
    expect(g2.done).toBe(true)
  })

  it('previews a parseable interval as a set', () => {
    expect(previewInterval('[-6, inf)')?.pieces).toHaveLength(1)
    expect(previewInterval('[-6, inf')).toBeNull()
    expect(previewInterval('')).toBeNull()
  })
})
