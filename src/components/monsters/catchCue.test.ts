/** The catch's sound (juice/cues.ts, juice/sounds.ts): a springy "gotcha" in place of the nope, for a first catch only. */
import { describe, expect, it } from 'vitest'
import { cuesFor, type MomentFacts } from '@/components/juice/cues'
import { cueLength, cueTones } from '@/components/juice/sounds'
import type { Ev } from '@/store'

const slip: Ev = { t: 'step_rejected', at: 1, attemptId: 'a', skill: 's', stepIdx: 0, pattern: 'no_sign_flip' }
const done: Ev = { t: 'problem_done', at: 1, attemptId: 'a', skill: 's', moduleId: 'm', steps: 1, firstTryRate: 1, hints: 0, revealed: 0, finalCorrect: true, mode: 'normal', secs: 9 }
const facts = (added: Ev[], more: Partial<MomentFacts> = {}): MomentFacts => ({ added, combo: 0, goalReached: false, squashed: 0, milestone: false, ...more })
const names = (f: MomentFacts) => cuesFor(f).map((c) => c.cue)

describe('the catch’s cue', () => {
  it('a first catch is the gotcha in place of the nope; a mistake made before is the nope', () => {
    expect(names(facts([slip], { caught: 1 }))).toEqual(['catch'])
    expect(names(facts([slip], { caught: 0 }))).toEqual(['slip'])
    expect(names(facts([slip]))).toEqual(['slip'])
    // The finish still outranks everything; the rewards' extras still follow.
    expect(names(facts([slip, done], { caught: 1 }))).toEqual(['finish'])
    expect(names(facts([slip], { caught: 1, goalReached: true }))).toEqual(['catch', 'sparkle'])
  })

  it('warm, short and springy: soft tones that glide up, then two bright notes, ending higher than it starts', () => {
    const tones = cueTones('catch')
    for (const t of tones) {
      expect(['sine', 'triangle', undefined]).toContain(t.type)
      expect(t.peak).toBeLessThanOrEqual(0.25)
    }
    expect(tones[0]!.glide).toBeGreaterThan(tones[0]!.freq)
    const notes = tones.filter((t) => t.peak >= 0.1)
    expect(notes.at(-1)!.freq).toBeGreaterThan(notes[0]!.freq)
    expect(cueLength('catch')).toBeLessThan(0.7)
  })
})
