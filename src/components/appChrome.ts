/**
 * Which screens get the whole phone. On a phone (useBreakpoint() === 'mobile') the app shell shows the bottom tab bar
 * on menu screens, and neither the tab bar nor the top navigation on a problem screen or a running set: those have
 * their own compact header. Wide screens keep the top navigation everywhere. The shell decides; a page only says
 * what it is.
 */
import { useLayoutEffect } from 'react'
import { create } from 'zustand'

const useFullScreenStore = create<{ pages: number }>(() => ({ pages: 0 }))

/** Routes that are a problem or a running set from their first frame (before their lazy page has loaded). */
export function isFullScreenPath(pathname: string): boolean {
  // Her own problem (`/own/<module>/<template>/<statement>`) is a problem screen; its builder (`/own/<module>`) is not.
  const ownProblem = pathname.startsWith('/own/') && pathname.split('/').length >= 5
  return pathname.startsWith('/p/') || pathname.startsWith('/g/') || pathname === '/set' || pathname.startsWith('/set/') || ownProblem
}

/**
 * A page that is a problem screen (ProblemFrame) or part of a running set calls this while it is mounted, so a phone
 * shows it full screen: the unit review's problems, for one, live on a route that also has menu-like screens.
 */
export function useFullScreenPage(on = true): void {
  useLayoutEffect(() => {
    if (!on) return
    useFullScreenStore.setState((s) => ({ pages: s.pages + 1 }))
    return () => useFullScreenStore.setState((s) => ({ pages: Math.max(0, s.pages - 1) }))
  }, [on])
}

/** Some mounted page asked for the whole screen. */
export function useFullScreenPageShown(): boolean {
  return useFullScreenStore((s) => s.pages > 0)
}
