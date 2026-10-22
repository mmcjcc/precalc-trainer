/**
 * Sounds, synthesized in code with the Web Audio API: no audio files, nothing downloaded or licensed
 * (docs/progress/phone-juice.md). Short, warm (sine and soft triangle tones, no harsh waves), at a modest volume.
 *
 * One AudioContext for the app, created lazily (never before she touches the page) and resumed on a user gesture:
 * browsers start a context suspended until then. It is suspended again after a while with no sound and while the app
 * is in the background. Where Web Audio is missing or blocked the app is silent, never an error.
 *
 * Which sound plays when is decided elsewhere (cues.ts, useJuice.ts); this file only knows how each one sounds.
 */
import { STORE } from '@/edition'
import type { Settings } from '@/store'

export type Cue =
  /** A right line or part: a bright two-note chime, one step higher per answer in a row (`step` 0 to 7). */
  | 'right'
  /** A slip (a rejected line, a wrong check): a soft, low two-note "nope". */
  | 'slip'
  /** A problem finished: a short rising arpeggio. */
  | 'finish'
  /** A set's results: a longer fanfare. */
  | 'fanfare'
  /** Today's goal met, a streak milestone: a sparkle. */
  | 'sparkle'
  /** A mistake squashed: a pop. */
  | 'pop'
  /** A mistake made for the first time, its monster caught (components/monsters): a springy "gotcha". */
  | 'catch'
  /** A daily quest done (components/quests): a bright "ta-da", up a fourth and a fifth. */
  | 'quest'
  /** A daily chest opened: a soft thunk, the lid gliding up, then a shower of high notes. */
  | 'chest'

/** "Sounds" (Settings): absent means the edition's default, on in the store app and off in the family web app. */
export function soundsOn(settings: Pick<Settings, 'sounds'>, store: boolean = STORE): boolean {
  return settings.sounds ?? store
}

// ---------------------------------------------------------------------------------------------------------------
// How each cue sounds (pure)
// ---------------------------------------------------------------------------------------------------------------

export interface Tone {
  /** Hz. */
  freq: number
  /** Seconds after the cue starts. */
  at: number
  /** Seconds from its start to silence. */
  dur: number
  /** Peak gain before the master volume. */
  peak: number
  type?: OscillatorType
  /** Glides to this frequency (the pop). */
  glide?: number
  /** Through a low-pass filter at this frequency (the soft "nope"). */
  lowpass?: number
}

/** The chime's steps: C5 up the major scale to C6, one step per right answer in a row. */
export const CHIME_SCALE: readonly number[] = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77, 1046.5]

const C4 = 261.63
const EB4 = 311.13
const G4 = 392.0
const C5 = 523.25
const E5 = 659.25
const G5 = 783.99
const C6 = 1046.5
const E6 = 1318.51
const G3 = 196.0
const A5 = 880.0
const G6 = 1567.98
const C7 = 2093.0

export function cueTones(cue: Cue, step = 0): Tone[] {
  switch (cue) {
    case 'right': {
      const f = CHIME_SCALE[Math.max(0, Math.min(CHIME_SCALE.length - 1, Math.round(step)))]!
      return [
        { freq: f, at: 0, dur: 0.3, peak: 0.2 },
        { freq: f * 2, at: 0, dur: 0.14, peak: 0.035 },
        { freq: f * 1.5, at: 0.07, dur: 0.38, peak: 0.18 },
        { freq: f * 3, at: 0.07, dur: 0.16, peak: 0.025 },
      ]
    }
    case 'slip':
      return [
        { freq: EB4, at: 0, dur: 0.2, peak: 0.16, type: 'triangle', lowpass: 1200 },
        { freq: C4, at: 0.15, dur: 0.3, peak: 0.15, type: 'triangle', lowpass: 1000 },
      ]
    case 'finish':
      return [
        ...[C5, E5, G5].map((freq, i) => ({ freq, at: i * 0.08, dur: 0.32, peak: 0.16 })),
        { freq: C6, at: 0.24, dur: 0.6, peak: 0.16 },
        { freq: C6 * 2, at: 0.24, dur: 0.35, peak: 0.025 },
      ]
    case 'fanfare':
      return [
        ...[G4, C5, E5].map((freq, i) => ({ freq, at: i * 0.11, dur: 0.24, peak: 0.15 })),
        ...[C5, E5, G5, C6].map((freq) => ({ freq, at: 0.36, dur: 1.1, peak: 0.08 })),
        { freq: C4, at: 0.36, dur: 1.1, peak: 0.07, type: 'triangle' as const, lowpass: 1400 },
      ]
    case 'sparkle':
      return [1318.51, 1567.98, 1760.0, 2093.0, 2637.02].map((freq, i) => ({ freq, at: i * 0.05, dur: 0.24, peak: 0.055 }))
    case 'pop':
      return [{ freq: 880, at: 0, dur: 0.13, peak: 0.2, glide: 220 }]
    case 'catch':
      // A spring up (a soft triangle gliding an octave), then two bright notes: caught!
      return [
        { freq: G4, at: 0, dur: 0.16, peak: 0.15, type: 'triangle', glide: G5, lowpass: 2400 },
        { freq: C6, at: 0.13, dur: 0.22, peak: 0.12 },
        { freq: E6, at: 0.22, dur: 0.34, peak: 0.12 },
        { freq: C6 * 2, at: 0.22, dur: 0.18, peak: 0.02 },
      ]
    case 'quest':
      // E5, A5, then a held E6: bright, short, and not the finish's arpeggio.
      return [
        { freq: E5, at: 0, dur: 0.16, peak: 0.13 },
        { freq: A5, at: 0.08, dur: 0.18, peak: 0.13 },
        { freq: E6, at: 0.16, dur: 0.42, peak: 0.12 },
        { freq: E6 * 2, at: 0.16, dur: 0.2, peak: 0.02 },
      ]
    case 'chest':
      // A soft low thunk (the lid), a glide up as it swings open, then the reward's shower of high notes.
      return [
        { freq: G3, at: 0, dur: 0.12, peak: 0.17, type: 'triangle', lowpass: 800 },
        { freq: G4, at: 0.1, dur: 0.32, peak: 0.07, type: 'triangle', glide: G6, lowpass: 3000 },
        ...[C6, E6, G6, C7].map((freq, i) => ({ freq, at: 0.4 + i * 0.06, dur: 0.3, peak: 0.06 })),
      ]
  }
}

/** Seconds a cue lasts (to start the next one after it). */
export function cueLength(cue: Cue): number {
  return Math.max(...cueTones(cue).map((t) => t.at + t.dur))
}

// ---------------------------------------------------------------------------------------------------------------
// Playing
// ---------------------------------------------------------------------------------------------------------------

/** The whole app's volume (each cue's own peaks are small too). */
const MASTER = 0.55
const ATTACK = 0.008
/** No sound for this long: the context sleeps (a phone's audio thread costs battery). */
const IDLE_MS = 30_000
/** The same cue asked again this soon is one sound (a double effect, two triggers for one moment). */
const SAME_CUE_MS = 50

type AudioCtor = new () => AudioContext

function audioCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & { webkitAudioContext?: AudioCtor; AudioContext?: AudioCtor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

/** This browser has Web Audio (Settings only offers the switch where it does). */
export function canPlaySounds(): boolean {
  return audioCtor() !== null
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
/** Creating a context threw (blocked): stay silent until the page reloads. */
let failed = false
let idleTimer: ReturnType<typeof setTimeout> | null = null
const lastPlayed = new Map<Cue, number>()

export interface PlayedCue {
  cue: Cue
  step: number
  /** Seconds after now. */
  delay: number
}
const listeners = new Set<(played: PlayedCue) => void>()

/** Told every cue that is scheduled (tests, and nothing else). */
export function onCuePlayed(fn: (played: PlayedCue) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (failed) return null
  if (ctx && ctx.state === 'closed') {
    ctx = null
    master = null
  }
  if (!ctx || !master) {
    const Ctor = audioCtor()
    if (!Ctor) return null
    try {
      const c = new Ctor()
      const g = c.createGain()
      g.gain.value = MASTER
      g.connect(c.destination)
      ctx = c
      master = g
    } catch {
      failed = true
      ctx = null
      master = null
      return null
    }
  }
  return { ctx, out: master }
}

function swallow(p: unknown): void {
  if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(() => {})
}

function sleep(): void {
  const c = ctx
  if (!c || c.state !== 'running') return
  try {
    swallow(c.suspend())
  } catch {
    /* already asleep, or closed */
  }
}

function sleepLater(): void {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    idleTimer = null
    sleep()
  }, IDLE_MS)
}

function schedule(c: AudioContext, out: AudioNode, tones: readonly Tone[], t0: number): void {
  for (const tone of tones) {
    const t = t0 + tone.at
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = tone.type ?? 'sine'
    osc.frequency.setValueAtTime(tone.freq, t)
    if (tone.glide) osc.frequency.exponentialRampToValueAtTime(tone.glide, t + tone.dur * 0.8)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(tone.peak, t + ATTACK)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + tone.dur)
    const nodes: AudioNode[] = [osc, gain]
    if (tone.lowpass) {
      const filter = c.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = tone.lowpass
      osc.connect(filter)
      filter.connect(gain)
      nodes.push(filter)
    } else {
      osc.connect(gain)
    }
    gain.connect(out)
    osc.onended = () => {
      for (const n of nodes) {
        try {
          n.disconnect()
        } catch {
          /* already gone */
        }
      }
    }
    osc.start(t)
    osc.stop(t + tone.dur + 0.05)
  }
}

/**
 * Play a cue now (or `delay` seconds from now). The caller has checked the Sounds switch. Silent where Web Audio is
 * missing, blocked or not allowed yet; never throws.
 */
export function playCue(cue: Cue, opts: { step?: number; delay?: number } = {}): void {
  const now = Date.now()
  const last = lastPlayed.get(cue)
  if (last !== undefined && now - last < SAME_CUE_MS && !opts.delay) return
  const a = audio()
  if (!a) return
  lastPlayed.set(cue, now)
  const step = opts.step ?? 0
  const delay = Math.max(0, opts.delay ?? 0)
  const start = () => {
    try {
      schedule(a.ctx, a.out, cueTones(cue, step), a.ctx.currentTime + 0.01 + delay)
    } catch {
      return
    }
    sleepLater()
    for (const fn of listeners) fn({ cue, step, delay })
  }
  try {
    if (a.ctx.state === 'running') {
      start()
      return
    }
    const resumed = a.ctx.resume()
    if (resumed && typeof resumed.then === 'function') resumed.then(start, () => {})
    else start()
  } catch {
    /* a blocked context is silence */
  }
}

/** Wake the context (create it, resume it) inside a user gesture, when the Sounds switch is on. */
function wake(isOn: () => boolean): void {
  if (!isOn()) return
  const a = audio()
  if (!a || a.ctx.state !== 'suspended') return
  try {
    swallow(a.ctx.resume())
  } catch {
    /* not allowed yet: the next gesture tries again */
  }
}

/**
 * Mount once: every tap or key wakes the context while Sounds is on (a browser lets it start only from a gesture; a
 * touch counts on its pointerup / touchend / click, a mouse or a key on its down), and the context sleeps while the app
 * is in the background.
 */
export function installSoundUnlock(isOn: () => boolean): () => void {
  if (typeof window === 'undefined') return () => {}
  const onGesture = () => wake(isOn)
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') sleep()
  }
  const events = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const
  for (const type of events) window.addEventListener(type, onGesture, { capture: true, passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    for (const type of events) window.removeEventListener(type, onGesture, { capture: true })
    document.removeEventListener('visibilitychange', onVisibility)
  }
}

/** Tests: forget the context, the timers and the last cues. */
export function resetSoundsForTests(): void {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = null
  ctx = null
  master = null
  failed = false
  lastPlayed.clear()
}
