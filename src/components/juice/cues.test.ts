import { describe, expect, it } from 'vitest'
import type { Ev } from '@/store'
import { cuesFor, type MomentFacts } from './cues'
import { CHIME_SCALE, cueTones, soundsOn } from './sounds'

const now = 1_000_000
const lineEv = (opts: { revealed?: boolean; firstTry?: boolean } = {}): Ev => ({
  t: 'step_accepted',
  at: now,
  attemptId: 'a',
  skill: 's',
  stepIdx: 0,
  firstTry: opts.firstTry ?? true,
  revealed: opts.revealed ?? false,
  property: 'skipped',
})
const slipEv: Ev = { t: 'step_rejected', at: now, attemptId: 'a', skill: 's', stepIdx: 0, pattern: 'p' }
const checkEv = (correct: boolean, part?: string): Ev => ({ t: 'final_answer', at: now, attemptId: 'a', skill: 's', correct, ...(part ? { part } : {}) })
const doneEv: Ev = { t: 'problem_done', at: now, attemptId: 'a', skill: 's', moduleId: 'm', steps: 1, firstTryRate: 1, hints: 0, revealed: 0, finalCorrect: true, mode: 'normal', secs: 9 }
const hintEv: Ev = { t: 'hint', at: now, attemptId: 'a', skill: 's', stepIdx: 0, rung: 2 }
const drillEv: Ev = { t: 'drill_answer', at: now, skill: 'd', correct: true, kind: 'legal' }

function facts(added: Ev[], more: Partial<MomentFacts> = {}): MomentFacts {
  return { added, combo: 1, goalReached: false, squashed: 0, milestone: false, ...more }
}

const names = (f: MomentFacts) => cuesFor(f).map((c) => c.cue)

describe('which sound for which moment', () => {
  it('a right line or part: the chime, one step higher per answer in a row', () => {
    expect(cuesFor(facts([lineEv()], { combo: 1 }))).toEqual([{ cue: 'right', step: 0, delay: 0 }])
    expect(cuesFor(facts([checkEv(true)], { combo: 4 }))[0]).toMatchObject({ cue: 'right', step: 3 })
    // A line fixed after a slip is still right: the chime at the bottom (the slip reset the combo).
    expect(cuesFor(facts([lineEv({ firstTry: false })], { combo: 0 }))[0]).toMatchObject({ cue: 'right', step: 0 })
    expect(cuesFor(facts([lineEv()], { combo: 40 }))[0]).toMatchObject({ cue: 'right', step: 7 })
  })

  it('a slip: the nope, also when part of the check was right', () => {
    expect(names(facts([slipEv]))).toEqual(['slip'])
    expect(names(facts([checkEv(false)]))).toEqual(['slip'])
    expect(names(facts([checkEv(true, 'Interval notation'), checkEv(false, 'Set-builder notation')]))).toEqual(['slip'])
  })

  it('a problem finished: the arpeggio, in place of the chime of its last line', () => {
    expect(names(facts([lineEv(), doneEv]))).toEqual(['finish'])
  })

  it('the rewards’ extras come after: a pop for a squashed mistake, a sparkle for the goal or a streak milestone', () => {
    const cues = cuesFor(facts([lineEv(), doneEv], { squashed: 1, goalReached: true }))
    expect(cues.map((c) => c.cue)).toEqual(['finish', 'pop', 'sparkle'])
    expect(cues[1]!.delay).toBeGreaterThan(cues[0]!.delay)
    expect(cues[2]!.delay).toBeGreaterThan(cues[1]!.delay)
    expect(names(facts([drillEv], { milestone: true }))).toEqual(['sparkle'])
    // The goal and a milestone at once: one sparkle.
    expect(names(facts([lineEv()], { goalReached: true, milestone: true }))).toEqual(['right', 'sparkle'])
  })

  it('no sound for a revealed line, a hint or a drill answer', () => {
    expect(cuesFor(facts([lineEv({ revealed: true, firstTry: false })]))).toEqual([])
    expect(cuesFor(facts([hintEv]))).toEqual([])
    expect(cuesFor(facts([drillEv]))).toEqual([])
  })
})

describe('how they sound', () => {
  it('the chime climbs the scale with the step and stops at the top', () => {
    const first = (step: number) => cueTones('right', step)[0]!.freq
    for (let s = 1; s < CHIME_SCALE.length; s++) expect(first(s)).toBeGreaterThan(first(s - 1))
    expect(first(12)).toBe(first(7))
    expect(first(-3)).toBe(first(0))
  })

  it('warm and modest: sine or soft triangle tones, low peaks; the nope is low, through a low-pass', () => {
    for (const cue of ['right', 'slip', 'finish', 'fanfare', 'sparkle', 'pop'] as const) {
      for (const t of cueTones(cue)) {
        expect(['sine', 'triangle', undefined]).toContain(t.type)
        expect(t.peak).toBeLessThanOrEqual(0.25)
        expect(t.dur).toBeLessThanOrEqual(1.2)
      }
    }
    const nope = cueTones('slip')
    expect(nope).toHaveLength(2)
    expect(nope.every((t) => t.freq < 400 && t.lowpass !== undefined)).toBe(true)
    expect(nope[1]!.freq).toBeLessThan(nope[0]!.freq)
    expect(Math.max(...cueTones('fanfare').map((t) => t.at + t.dur))).toBeGreaterThan(Math.max(...cueTones('finish').map((t) => t.at + t.dur)))
  })

  it('the switch: on by default in the store app, off in the family web app; her choice wins', () => {
    expect(soundsOn({}, true)).toBe(true)
    expect(soundsOn({}, false)).toBe(false)
    expect(soundsOn({ sounds: false }, true)).toBe(false)
    expect(soundsOn({ sounds: true }, false)).toBe(true)
  })
})
