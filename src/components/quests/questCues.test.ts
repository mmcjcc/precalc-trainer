/** The quests' sounds (code-made, components/juice/sounds.ts): the chest is its moment's one main sound; both stay soft. */
import { describe, expect, it } from 'vitest'
import { cuesFor } from '@/components/juice/cues'
import { cueLength, cueTones } from '@/components/juice/sounds'
import type { Ev } from '@/store'

const chest: Ev = { t: 'chest_opened', at: 1, day: '2026-10-22', reward: { kind: 'xp', xp: 25 } }

describe('the quest and chest cues', () => {
  it('a chest opened is the chest’s sound; a bonus that meets the goal sparkles after it', () => {
    expect(cuesFor({ added: [chest], combo: 0, goalReached: false, squashed: 0, milestone: false }).map((c) => c.cue)).toEqual(['chest'])
    const both = cuesFor({ added: [chest], combo: 0, goalReached: true, squashed: 0, milestone: false })
    expect(both.map((c) => c.cue)).toEqual(['chest', 'sparkle'])
    expect(both[1]!.delay).toBeGreaterThan(0)
    // A set's end alone is no sound of the juice's (the results play the fanfare, then the quest cue).
    expect(cuesFor({ added: [{ t: 'set_done', at: 1, setId: 's', done: ['a'], skipped: 0 }], combo: 0, goalReached: false, squashed: 0, milestone: false })).toEqual([])
  })

  it('short and soft, like the rest', () => {
    for (const cue of ['quest', 'chest'] as const) {
      expect(cueLength(cue)).toBeLessThan(1)
      for (const t of cueTones(cue)) {
        expect(t.peak).toBeLessThanOrEqual(0.2)
        expect(t.freq).toBeGreaterThan(100)
        expect(t.freq).toBeLessThan(3000)
      }
    }
  })
})
