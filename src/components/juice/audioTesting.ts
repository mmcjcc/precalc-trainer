/**
 * A fake Web Audio context for tests (jsdom has none). Not part of the app bundle: only tests import this file.
 * `installFakeAudio()` puts it on `window.AudioContext`; every context it makes is in `FakeAudioContext.made`.
 */
import { vi } from 'vitest'

class FakeParam {
  value = 0
  readonly calls: [string, number, number][] = []
  setValueAtTime(v: number, t: number) {
    this.calls.push(['set', v, t])
    this.value = v
    return this
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.calls.push(['exp', v, t])
    return this
  }
}

class FakeNode {
  readonly outputs: unknown[] = []
  connect(node: unknown) {
    this.outputs.push(node)
    return node
  }
  disconnect() {}
}

export class FakeOscillator extends FakeNode {
  type = 'sine'
  readonly frequency = new FakeParam()
  startAt: number | null = null
  stopAt: number | null = null
  onended: (() => void) | null = null
  start(t: number) {
    this.startAt = t
  }
  stop(t: number) {
    this.stopAt = t
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam()
}

class FakeFilter extends FakeNode {
  type = 'lowpass'
  readonly frequency = new FakeParam()
}

export class FakeAudioContext {
  static made: FakeAudioContext[] = []
  /** How the next context starts: running, or suspended (a page nobody has touched yet). */
  static startState: 'running' | 'suspended' = 'running'
  /** The next resume() rejects (a browser that does not allow it). */
  static rejectResume = false
  state: 'running' | 'suspended' | 'closed'
  currentTime = 0
  readonly destination = new FakeNode()
  readonly oscillators: FakeOscillator[] = []
  readonly gains: FakeGain[] = []
  resumes = 0
  suspends = 0
  constructor() {
    this.state = FakeAudioContext.startState
    FakeAudioContext.made.push(this)
  }
  createOscillator() {
    const o = new FakeOscillator()
    this.oscillators.push(o)
    return o
  }
  createGain() {
    const g = new FakeGain()
    this.gains.push(g)
    return g
  }
  createBiquadFilter() {
    return new FakeFilter()
  }
  resume() {
    this.resumes += 1
    if (FakeAudioContext.rejectResume) return Promise.reject(new Error('not allowed'))
    this.state = 'running'
    return Promise.resolve()
  }
  suspend() {
    this.suspends += 1
    this.state = 'suspended'
    return Promise.resolve()
  }
}

/** window.AudioContext is the fake (undo with vi.unstubAllGlobals). */
export function installFakeAudio(): void {
  FakeAudioContext.made = []
  FakeAudioContext.startState = 'running'
  FakeAudioContext.rejectResume = false
  vi.stubGlobal('AudioContext', FakeAudioContext)
}

/** window.AudioContext throws when made (a browser that blocks it). */
export function installBlockedAudio(): void {
  vi.stubGlobal(
    'AudioContext',
    class {
      constructor() {
        throw new Error('blocked')
      }
    },
  )
}

/** No Web Audio at all. */
export function removeAudio(): void {
  vi.stubGlobal('AudioContext', undefined)
  vi.stubGlobal('webkitAudioContext', undefined)
}

/** window.matchMedia answering `(prefers-reduced-motion: reduce)` with `reduce`, and every other query false. */
export function installMotion(reduce: boolean): void {
  window.matchMedia = ((query: string) =>
    ({
      matches: /prefers-reduced-motion:\s*reduce/.test(query) ? reduce : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia
}

export function removeMotion(): void {
  delete (window as { matchMedia?: unknown }).matchMedia
}
