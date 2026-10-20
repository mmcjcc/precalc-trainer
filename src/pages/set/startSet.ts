import { randomSeed, type CourseDef } from '@/content'
import { newActiveSet, saveActiveSet, type ActiveSet } from '@/session/activeSet'
import { buildSet } from '@/session/buildSet'
import { useStore } from '@/store'

/** Said once when this device cannot keep the set (storage blocked or full). */
export function warnSetNotSaved(): void {
  useStore.getState().toast('This set could not be saved on this device.', {
    tone: 'bad',
    detail: 'It keeps going while the app is open, but closing the app ends it.',
  })
}

/**
 * Build a set for her from this class and make it the active one (replacing any other): "Start a set" on Home and
 * "Another set" on the results. It starts something, so it never calls the set's break. Null when the class has no
 * problem types.
 */
export function startSet(course: CourseDef): ActiveSet | null {
  const s = useStore.getState()
  const now = Date.now()
  const built = buildSet({ course, events: s.events, rewards: s.rewards, now, seed: randomSeed() })
  if (built.problems.length === 0) return null
  const set = newActiveSet(built, { now, timed: s.settings.testMode })
  if (!saveActiveSet(set)) warnSetNotSaved()
  return set
}
