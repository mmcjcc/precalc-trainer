// @vitest-environment jsdom
/** The sounds (sounds.ts) on a fake Web Audio context: what plays, and silence where Web Audio is missing or blocked. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { FakeAudioContext, installBlockedAudio, installFakeAudio, removeAudio } from './audioTesting'
import { CHIME_SCALE, canPlaySounds, cueTones, installSoundUnlock, onCuePlayed, playCue, resetSoundsForTests, type PlayedCue } from './sounds'

let played: PlayedCue[] = []
let stop: () => void = () => {}

beforeEach(() => {
  resetSoundsForTests()
  played = []
  stop = onCuePlayed((p) => played.push(p))
})

afterEach(() => {
  stop()
  vi.unstubAllGlobals()
  resetSoundsForTests()
})

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('playing a cue', () => {
  it('makes one context, through a modest master volume, and the cue’s tones at their pitches', () => {
    installFakeAudio()
    expect(canPlaySounds()).toBe(true)
    playCue('right', { step: 3 })
    expect(FakeAudioContext.made).toHaveLength(1)
    const ctx = FakeAudioContext.made[0]!
    const master = ctx.gains[0]!
    expect(master.gain.value).toBeGreaterThan(0)
    expect(master.gain.value).toBeLessThanOrEqual(0.6)
    expect(master.outputs).toEqual([ctx.destination])
    const tones = cueTones('right', 3)
    expect(ctx.oscillators.map((o) => o.frequency.calls[0]![1])).toEqual(tones.map((t) => t.freq))
    expect(ctx.oscillators[0]!.frequency.calls[0]![1]).toBe(CHIME_SCALE[3])
    expect(ctx.oscillators.every((o) => o.startAt !== null && o.stopAt !== null && o.stopAt > o.startAt)).toBe(true)
    expect(played).toEqual([{ cue: 'right', step: 3, delay: 0 }])

    playCue('slip')
    expect(FakeAudioContext.made).toHaveLength(1) // one context for the app
    expect(played.map((p) => p.cue)).toEqual(['right', 'slip'])
  })

  it('a delayed cue starts later on the context’s clock', () => {
    installFakeAudio()
    playCue('sparkle', { delay: 0.5 })
    const ctx = FakeAudioContext.made[0]!
    expect(ctx.oscillators[0]!.startAt).toBeGreaterThanOrEqual(0.5)
  })

  it('the same cue twice in the same moment is one sound', () => {
    installFakeAudio()
    playCue('fanfare')
    playCue('fanfare')
    expect(played).toHaveLength(1)
  })

  it('a suspended context is resumed first, then the cue plays', async () => {
    installFakeAudio()
    FakeAudioContext.startState = 'suspended'
    playCue('finish')
    expect(played).toEqual([])
    await flush()
    expect(FakeAudioContext.made[0]!.resumes).toBe(1)
    expect(played.map((p) => p.cue)).toEqual(['finish'])
  })
})

describe('silence, never an error', () => {
  it('where Web Audio is missing', () => {
    removeAudio()
    expect(canPlaySounds()).toBe(false)
    expect(() => playCue('right')).not.toThrow()
    expect(played).toEqual([])
  })

  it('where making a context is blocked', () => {
    installBlockedAudio()
    expect(() => playCue('right')).not.toThrow()
    expect(() => playCue('slip')).not.toThrow()
    expect(played).toEqual([])
  })

  it('where resuming is not allowed', async () => {
    installFakeAudio()
    FakeAudioContext.startState = 'suspended'
    FakeAudioContext.rejectResume = true
    expect(() => playCue('right')).not.toThrow()
    await flush()
    expect(played).toEqual([])
  })
})

describe('the first gesture', () => {
  it('wakes the context while Sounds is on, and makes none while it is off; the background puts it to sleep', async () => {
    installFakeAudio()
    FakeAudioContext.startState = 'suspended'
    let on = false
    const uninstall = installSoundUnlock(() => on)
    window.dispatchEvent(new Event('pointerup'))
    expect(FakeAudioContext.made).toHaveLength(0)
    on = true
    window.dispatchEvent(new Event('pointerup'))
    expect(FakeAudioContext.made).toHaveLength(1)
    const ctx = FakeAudioContext.made[0]!
    expect(ctx.resumes).toBe(1)
    await flush()
    expect(ctx.state).toBe('running')

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(ctx.suspends).toBe(1)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })

    uninstall()
    window.dispatchEvent(new Event('pointerup'))
    expect(ctx.resumes).toBe(1)
  })
})
