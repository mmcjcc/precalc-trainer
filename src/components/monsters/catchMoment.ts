/**
 * The catch (docs/progress/phone-monsters.md): the first time she makes a mistake she has never made before, the verdict
 * that names it shows its monster, "Caught: <name>", flipping in. Decided from the event log as the juice is (only
 * for events she just added here, never for an import or a reset), the moment it is recorded, so the verdict drawn
 * for it already knows; then remembered in the rewards' slice (`noteCatches`), so it happens once per mistake.
 *
 * The verdict components ask `useJustCaught(pattern)`: true while the latest moment that named a mistake caught that
 * one for the first time. The next named mistake starts a new moment, so the same mistake made again shows its small
 * avatar instead. What one tap records is one moment (a check that grades two boxes records twice, before anything
 * else runs): its catches add up.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { freshlyAdded } from '@/components/juice/useJuice'
import { firstCatches, namedPattern, useStore } from '@/store'
import { isMonster } from './species'

interface CatchMoment {
  seq: number
  /** The mistakes this moment caught for the first time (monsters only). */
  caught: ReadonlySet<string>
}

let current: CatchMoment | null = null
let seq = 0
/** A moment is open until the work of the tap that started it is done (the next microtask). */
let open = false
const listeners = new Set<() => void>()

function publish(moment: CatchMoment | null): void {
  current = moment
  for (const l of [...listeners]) l()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function snapshot(): CatchMoment | null {
  return current
}

/** The mistakes the latest moment caught for the first time. */
export function caughtNow(): ReadonlySet<string> {
  return current?.caught ?? new Set()
}

/** Is this mistake the one just caught for the first time? (The verdict that names it shows the catch.) */
export function useJustCaught(pattern: string | null | undefined): boolean {
  const moment = useSyncExternalStore(subscribe, snapshot, snapshot)
  return Boolean(pattern && moment?.caught.has(pattern))
}

/**
 * Mount once (the app shell): watches the event log for named mistakes she just made, decides which are first
 * catches, shows them, and remembers them in the rewards' slice.
 */
export function useMonsterCatches(): void {
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (s.events === prev.events) return
        const added = freshlyAdded(s.events, prev.events, Date.now())
        if (!added) {
          // An import, a reset or the compaction: nothing she just did.
          if (s.events.length < prev.events.length) publish(null)
          return
        }
        if (!added.some((e) => namedPattern(e) !== null)) return
        const caught = firstCatches(added, prev).filter(isMonster)
        // Within one tap the catches add up: a second record of the same mistake is no longer a first.
        const all = open && current ? new Set([...current.caught, ...caught]) : new Set(caught)
        if (!open) {
          open = true
          queueMicrotask(() => {
            open = false
          })
        }
        publish({ seq: ++seq, caught: all })
        // Remembered right after this update (not inside it): the catch never shows twice.
        if (caught.length > 0) queueMicrotask(() => useStore.getState().noteCatches(caught))
      }),
    [],
  )
}

/** Tests: forget the latest moment. */
export function resetCatchMomentForTests(): void {
  open = false
  publish(null)
}
