// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { buildBackup } from '@/store/backup'
import { resetStoreForTests, useStore } from '@/store'
import { encodeStrokes, startStroke, extendStroke, type Stroke } from './ink'
import { loadPad, padKey, readPaper, readScratchIndex, removePad, savePad, SCRATCH_CAP, SCRATCH_INDEX_KEY, SCRATCH_MAX_PADS, writePaper } from './scratchStorage'

function scribble(points: number, seed = 1): Stroke {
  const s = startStroke('pen', 'navy', 100 + seed, 100)
  for (let i = 1; i < points; i++) extendStroke(s, 100 + seed + ((i * 37) % 700), 100 + ((i * 53) % 900))
  return s
}

beforeEach(() => {
  localStorage.clear()
  resetStoreForTests()
})

describe('one pad per attempt, on this device', () => {
  it('saves and loads an attempt’s strokes; another attempt has its own; an empty pad is removed', () => {
    const a = [scribble(30, 1)]
    const b = [scribble(10, 2), scribble(12, 3)]
    expect(savePad('p/a#1', a, 1000)).toBe(true)
    expect(savePad('p/b#2', b, 2000)).toBe(true)
    expect(loadPad('p/a#1')).toEqual(a)
    expect(loadPad('p/b#2')).toEqual(b)
    expect(loadPad('p/c#3')).toBeNull()
    expect(readScratchIndex().pads.map((p) => p.id)).toEqual(['p/a#1', 'p/b#2'])
    savePad('p/a#1', [], 3000)
    expect(localStorage.getItem(padKey('p/a#1'))).toBeNull()
    expect(readScratchIndex().pads.map((p) => p.id)).toEqual(['p/b#2'])
    removePad('p/b#2')
    expect(loadPad('p/b#2')).toBeNull()
    expect(readScratchIndex().pads).toEqual([])
  })

  it('reads a broken pad or index as nothing', () => {
    localStorage.setItem(padKey('x'), JSON.stringify('v9;garbage'))
    localStorage.setItem(SCRATCH_INDEX_KEY, '{not json')
    expect(loadPad('x')).toBeNull()
    expect(readScratchIndex()).toEqual({ version: 1, pads: [], paper: true })
  })

  it('past the cap, the pads that changed longest ago go first; the one being saved never does', () => {
    const big = [scribble(4000, 1)]
    const size = encodeStrokes(big).length
    const fit = Math.floor(SCRATCH_CAP / size)
    expect(fit).toBeGreaterThan(2)
    for (let i = 0; i < fit; i++) savePad(`pad-${i}`, big, 1000 + i)
    expect(readScratchIndex().pads).toHaveLength(fit)
    // One more: the oldest goes.
    savePad('newest', big, 9000)
    const ids = readScratchIndex().pads.map((p) => p.id)
    expect(ids).not.toContain('pad-0')
    expect(ids).toContain('pad-1')
    expect(ids).toContain('newest')
    expect(loadPad('pad-0')).toBeNull()
    expect(readScratchIndex().pads.reduce((sum, p) => sum + p.size, 0)).toBeLessThanOrEqual(SCRATCH_CAP)
    // Saving an old pad again makes it the newest: now pad-1 is the oldest.
    savePad('pad-1', big, 9500)
    savePad('another', big, 9600)
    expect(loadPad('pad-1')).toEqual(big)
    expect(loadPad('pad-2')).toBeNull()
  })

  it('keeps at most SCRATCH_MAX_PADS pads, however small', () => {
    for (let i = 0; i < SCRATCH_MAX_PADS + 5; i++) savePad(`small-${i}`, [scribble(3, i)], i)
    const ids = readScratchIndex().pads.map((p) => p.id)
    expect(ids).toHaveLength(SCRATCH_MAX_PADS)
    expect(ids).not.toContain('small-0')
    expect(ids).toContain(`small-${SCRATCH_MAX_PADS + 4}`)
  })

  it('graph paper is on by default and the switch is kept', () => {
    expect(readPaper()).toBe(true)
    writePaper(false)
    expect(readPaper()).toBe(false)
    savePad('a', [scribble(5)], 1)
    expect(readPaper()).toBe(false)
  })

  it('never goes into a backup', () => {
    savePad('p/a#1', [scribble(50)], 1)
    const s = useStore.getState()
    const backup = JSON.stringify(buildBackup({ settings: s.settings, events: s.events, weekly: s.weekly, streak: s.streak, rewards: s.rewards }))
    expect(backup).not.toContain('scratch')
    expect(backup).not.toContain(encodeStrokes([scribble(50)]).slice(3, 30))
  })
})
