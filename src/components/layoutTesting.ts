/**
 * Test helpers for the layouts (jsdom has no window size of its own that media queries follow). `setWindowSize` gives the
 * window a width and a height and installs a `matchMedia` that answers width, height, orientation and pointer queries from
 * them, so the app picks its layout from the width exactly as in a browser; a later call resizes the window and tells
 * every query that changed. Not part of the app bundle: only tests import this file.
 */
import { act } from '@testing-library/react'

type Listener = (e: MediaQueryListEvent) => void

interface Size {
  width: number
  height: number
  coarse: boolean
  reducedMotion: boolean
}

let size: Size | null = null
const live: { query: string; matches: boolean; listeners: Set<Listener>; mql: MediaQueryList }[] = []

function px(value: string): number {
  const m = /^([\d.]+)(px|rem|em)$/.exec(value.trim())
  if (!m) return Number.NaN
  const n = Number(m[1])
  return m[2] === 'px' ? n : n * 16
}

/** One `(feature: value)` against the window. Unknown features are false, as for a browser that does not know them. */
function feature(text: string, s: Size): boolean {
  const m = /^\(\s*([a-z-]+)\s*(?::\s*([^)]+))?\)$/.exec(text.trim())
  if (!m) return false
  const [, name, raw = ''] = m
  const value = raw.trim()
  switch (name) {
    case 'min-width':
      return s.width >= px(value)
    case 'max-width':
      return s.width <= px(value)
    case 'min-height':
      return s.height >= px(value)
    case 'max-height':
      return s.height <= px(value)
    case 'orientation':
      return value === (s.width > s.height ? 'landscape' : 'portrait')
    case 'pointer':
    case 'any-pointer':
      return value === (s.coarse ? 'coarse' : 'fine')
    case 'hover':
      return value === (s.coarse ? 'none' : 'hover')
    case 'prefers-reduced-motion':
      return value === 'reduce' ? s.reducedMotion : !s.reducedMotion
    default:
      return false
  }
}

/** A media query list: alternatives separated by commas, each a chain of features joined by `and`. */
export function mediaMatches(query: string, s: Size): boolean {
  return query.split(',').some((alt) =>
    alt
      .trim()
      .split(/\s+and\s+/)
      .every((part) => feature(part, s)),
  )
}

function install(): void {
  window.matchMedia = ((query: string) => {
    const listeners = new Set<Listener>()
    const entry = { query, matches: size ? mediaMatches(query, size) : false, listeners, mql: null as unknown as MediaQueryList }
    const mql = {
      get matches() {
        return size ? mediaMatches(query, size) : false
      },
      media: query,
      onchange: null,
      addListener: (l: Listener) => listeners.add(l),
      removeListener: (l: Listener) => listeners.delete(l),
      addEventListener: (_: string, l: Listener) => listeners.add(l),
      removeEventListener: (_: string, l: Listener) => listeners.delete(l),
      dispatchEvent: () => false,
    } as unknown as MediaQueryList
    entry.mql = mql
    live.push(entry)
    return mql
  }) as typeof window.matchMedia
}

/**
 * The window at `width` x `height` CSS px. A touch screen by default (a phone, a tablet: the math keypad opens); `coarse:
 * false` for a computer with a mouse. Call it before rendering, or after to resize (inside act).
 */
export function setWindowSize(width: number, height: number, opts: { coarse?: boolean; reducedMotion?: boolean } = {}): void {
  size = { width, height, coarse: opts.coarse ?? true, reducedMotion: opts.reducedMotion ?? true }
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
  install()
  const changed = live.filter((e) => {
    const now = mediaMatches(e.query, size!)
    const was = e.matches
    e.matches = now
    return now !== was
  })
  act(() => {
    for (const e of changed) {
      const event = { matches: e.matches, media: e.query } as MediaQueryListEvent
      for (const l of [...e.listeners]) l(event)
    }
    window.dispatchEvent(new Event('resize'))
  })
}

/** Back to jsdom's own window: no matchMedia (the app then takes the tablet layout), 1024 x 768. */
export function resetWindowSize(): void {
  size = null
  live.length = 0
  delete (window as { matchMedia?: unknown }).matchMedia
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 768 })
}

/** The four windows the layouts are checked at. */
export const WINDOWS = {
  /** A desktop window where side panels dock beside the work column. */
  desktop: [1900, 1050],
  /** A large tablet or a laptop, on its side. */
  wide: [1280, 800],
  /** A tablet on its side. */
  landscape: [1024, 768],
  /** A tablet held upright: the phone layout with a wider reading column. */
  upright: [800, 1280],
  /** A phone. */
  phone: [375, 812],
} as const
