/** The path's memory of what it last showed: which stops levelled up since, and what it keeps (pure parts). */
import { describe, expect, it } from 'vitest'
import type { SkillRingInfo } from '@/store/rewards'
import { levelUps, memoryAfter, type PathMemory } from './pathMemory'

const ring = (level: SkillRingInfo['level'], strong: number): SkillRingInfo => ({
  level,
  strong,
  count: level === 'new' ? 0 : 5,
  fill: level === 'mastered' ? 1 : strong / 5,
})

const rings = new Map<string, SkillRingInfo>([
  ['a', ring('practiced', 2)],
  ['b', ring('solid', 3)],
  ['c', ring('mastered', 5)],
  ['d', ring('practiced', 1)],
])

const memory = (seen: PathMemory['seen']): PathMemory => ({ version: 1, seen })

describe('level-ups', () => {
  it('none the first time the path is shown on a device: nothing old celebrates', () => {
    expect(levelUps(null, rings, ['a', 'b', 'c', 'd']).size).toBe(0)
  })

  it('a level that went up since it was shown, with where its ring stood then', () => {
    const before = memory({ b: { level: 'practiced', fill: 0.4 }, c: { level: 'solid', fill: 0.8 }, d: { level: 'practiced', fill: 0.2 } })
    const ups = levelUps(before, rings, ['a', 'b', 'c', 'd', 'e'])
    // a: New (not remembered) to Practiced; b: Practiced to Solid; c: Solid to Mastered. d stayed Practiced; e is New.
    expect([...ups.keys()]).toEqual(['a', 'b', 'c'])
    expect(ups.get('a')).toEqual({ level: 'new', fill: 0 })
    expect(ups.get('b')).toEqual({ level: 'practiced', fill: 0.4 })
    expect(ups.get('c')).toEqual({ level: 'solid', fill: 0.8 })
  })

  it('only among the stops shown now, and never for a ring that went down or only filled more', () => {
    const before = memory({ a: { level: 'solid', fill: 0.6 }, d: { level: 'practiced', fill: 0 } })
    expect(levelUps(before, rings, ['a', 'd']).size).toBe(0)
    expect(levelUps(memory({}), rings, ['b']).has('b')).toBe(true)
    expect(levelUps(memory({}), rings, ['a']).has('b')).toBe(false)
  })
})

describe('what the path keeps', () => {
  it('starts from every ring now the first time (New ones are not written)', () => {
    const after = memoryAfter(null, new Map([...rings, ['n', ring('new', 0)]]), ['a'])
    expect(after).toEqual({
      version: 1,
      seen: {
        a: { level: 'practiced', fill: 0.4 },
        b: { level: 'solid', fill: 0.6 },
        c: { level: 'mastered', fill: 1 },
        d: { level: 'practiced', fill: 0.2 },
      },
    })
  })

  it('records the stops shown, leaves a level-up that has not played yet, and lowers a ring that went down anywhere', () => {
    const before = memory({
      a: { level: 'new', fill: 0 },
      b: { level: 'practiced', fill: 0.4 },
      // Not shown now, but lower than it was (a reset, a slip): lowered, so winning it back celebrates again.
      x: { level: 'mastered', fill: 1 },
      // Not shown, higher now: kept as it was, to celebrate when it is shown.
      d: { level: 'new', fill: 0 },
    })
    const after = memoryAfter(before, rings, ['a'])
    expect(after.seen).toEqual({
      a: { level: 'practiced', fill: 0.4 },
      b: { level: 'practiced', fill: 0.4 },
    })
    // Once b's celebration plays, it is recorded too.
    expect(memoryAfter(after, rings, ['b']).seen.b).toEqual({ level: 'solid', fill: 0.6 })
  })
})
