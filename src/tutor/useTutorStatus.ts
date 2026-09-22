import { useEffect, useState } from 'react'
import type { TutorStatus } from '@/shared/tutor'
import { fetchTutorStatus } from './api'

export interface TutorStatusState {
  /** The status request has settled (success or failure). */
  ready: boolean
  /** Null when the request failed, returned 503, or the body was unusable. */
  status: TutorStatus | null
}

/**
 * Retry delays after a failed status request. When the app wakes from scale-to-zero, nginx can
 * answer before the tutor sidecar is listening (503 "tutor offline"), so the first problem opened
 * would otherwise hide the Ask panel until a reload.
 */
const RETRY_MS = [2000, 5000, 10000] as const

/**
 * Status request per mount, retried a few times while it fails. A failure or a 503 leaves `status`
 * null so the caller can hide the tutor and leave the rest of the app unchanged; a later success
 * shows it.
 */
export function useTutorStatus(): TutorStatusState {
  const [state, setState] = useState<TutorStatusState>({ ready: false, status: null })
  useEffect(() => {
    const ac = new AbortController()
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const attempt = (n: number) => {
      void fetchTutorStatus(ac.signal).then((status) => {
        if (!live) return
        setState({ ready: true, status })
        const delay = RETRY_MS[n]
        if (!status && delay !== undefined) timer = setTimeout(() => attempt(n + 1), delay)
      })
    }
    attempt(0)
    return () => {
      live = false
      if (timer) clearTimeout(timer)
      ac.abort()
    }
  }, [])
  return state
}
