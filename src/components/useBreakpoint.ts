import { useEffect, useState } from 'react'

/**
 * Window widths (docs/progress/app-tablet.md). The layout follows the size of the window, never the device or its user
 * agent: a tablet on its side and a computer get the same layout, and so do a phone and a narrow window.
 *  - 'mobile', below 840 px wide: the phone layout (bottom tabs, the compact problem screen, sheets from the bottom). A
 *    phone, a phone on its side and a tablet held upright; from 600 px its reading column is wider (42rem), still one
 *    column. A window under 480 px tall stays here however wide it is: a big phone on its side (932 x 430) has no room
 *    for two panes over a keypad.
 *  - 'tablet', 840 to 1023 px, and 'desktop', 1024 px and more: the tablet layout (the navigation rail, the problem
 *    screen in two panes, sheets as centred dialogs, menu pages at a comfortable width with cards in two columns). The
 *    two differ only where a flow already asked (`bp === 'desktop'`: autofocus with a keyboard at hand).
 */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

/** The narrowest window that gets the tablet layout, in CSS px (Material's "expanded" width class). */
export const TABLET_LAYOUT_MIN = 840
/** The shortest window that gets it: below this a window is a phone on its side, whatever its width. */
export const TABLET_LAYOUT_MIN_HEIGHT = 480

const TABLET = `(min-width: ${TABLET_LAYOUT_MIN}px) and (min-height: ${TABLET_LAYOUT_MIN_HEIGHT}px)`
const DESKTOP = `(min-width: 1024px) and (min-height: ${TABLET_LAYOUT_MIN_HEIGHT}px)`

function read(): Breakpoint {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'desktop'
  if (window.matchMedia(DESKTOP).matches) return 'desktop'
  if (window.matchMedia(TABLET).matches) return 'tablet'
  return 'mobile'
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(read)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mqs = [window.matchMedia(TABLET), window.matchMedia(DESKTOP)]
    const update = () => setBp(read())
    // The window may have changed between the first render and this effect (a rotation, a test resizing it).
    update()
    for (const mq of mqs) mq.addEventListener('change', update)
    return () => {
      for (const mq of mqs) mq.removeEventListener('change', update)
    }
  }, [])
  return bp
}

/** The two layouts the app has: the phone layout (below 840 px) and the tablet layout (840 px and more). */
export type Layout = 'phone' | 'tablet'

export function layoutOf(bp: Breakpoint): Layout {
  return bp === 'mobile' ? 'phone' : 'tablet'
}

/**
 * Which layout the window gets. Only layouts read it: the app shell, the problem screen's frame, the sheets and the
 * menu pages' columns. A flow, a card or a box never does.
 */
export function useLayout(): Layout {
  return layoutOf(useBreakpoint())
}

/** The narrowest window where the problem screen docks side panels (Scratch, Example) beside the work column. */
export const DESKTOP_PROBLEM_MIN = 1440
const DESKTOP_PROBLEM = `(min-width: ${DESKTOP_PROBLEM_MIN}px) and (min-height: ${TABLET_LAYOUT_MIN_HEIGHT}px)`

function readDesktopProblem(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(DESKTOP_PROBLEM).matches
}

/**
 * True when the window is wide enough (`>= 1440px` and `>= 480px` tall) for the desktop problem screen
 * to spread across the window and dock the scratch pad and worked example beside the work column.
 * Returns `false` at `WINDOWS.wide` (1280x800), `WINDOWS.landscape` (1024x768), and when `matchMedia` is absent.
 */
export function useDesktopProblemLayout(): boolean {
  const [wide, setWide] = useState<boolean>(readDesktopProblem)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(DESKTOP_PROBLEM)
    const update = () => setWide(readDesktopProblem())
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return wide
}

/** Standalone (installed) PWA? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
}

/** iOS Safari (where localStorage is evicted after 7 days unless installed). */
export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return iOS && safari
}
