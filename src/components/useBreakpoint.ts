import { useEffect, useState } from 'react'

/** Breakpoints from docs/research/ux-mobile-progress.md: <768 mobile, 768–1023 tablet, ≥1024 desktop. */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

const TABLET = '(min-width: 768px)'
const DESKTOP = '(min-width: 1024px)'

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
    for (const mq of mqs) mq.addEventListener('change', update)
    return () => {
      for (const mq of mqs) mq.removeEventListener('change', update)
    }
  }, [])
  return bp
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
