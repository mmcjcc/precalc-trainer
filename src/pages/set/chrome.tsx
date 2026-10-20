import { createContext, useContext, type ReactNode } from 'react'
import type { SetSlotStatus } from '@/session/activeSet'

/**
 * Set while a set is showing one of its problems (pages/SetPage.tsx), so the problem screen shows the set's progress
 * and its main button stays in the set. The problem screen decides where (the phone's compact header, the completion
 * area on a wide screen); the set runner does not know the screen size.
 */
export interface SetChrome {
  /** The slot she is on (0-based). */
  index: number
  total: number
  status: readonly SetSlotStatus[]
  /** "Next in set", or "See results" on the last problem. */
  nextLabel: string
  /** The main button once the problem is finished: the next problem, or the results (the set's one break). */
  onNext: () => void
  /** Skip the problem she is on: it counts as skipped, not as wrong. */
  onSkip: () => void
}

const Ctx = createContext<SetChrome | null>(null)

export function SetChromeProvider({ value, children }: { value: SetChrome; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSetChrome(): SetChrome | null {
  return useContext(Ctx)
}
