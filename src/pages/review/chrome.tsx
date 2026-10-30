import { createContext, useContext, type ReactNode } from 'react'

/** Set while a review is showing a problem, so Next stays in the set. */
export interface ReviewChrome {
  onNext: () => void
  onSkip: () => void
  timed?: boolean
  sat?: boolean
}

const Ctx = createContext<ReviewChrome | null>(null)

export function ReviewChromeProvider({ value, children }: { value: ReviewChrome; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useReviewChrome(): ReviewChrome | null {
  return useContext(Ctx)
}
