/**
 * The colour theme on screen (docs/progress/phone-quests.md): the theme she picked in Settings, while rewards are on and
 * her log says a chest gave it to her (store/chest.ts); otherwise navy. A theme is five values for the navy family of
 * tokens (store/themes.ts), set on the root element, so every `bg-navy`, `text-navy/80`, `border-navy-100` and the
 * chunky buttons' edge follow it. Coral, gold, ok and bad never change. The graphs and the number line draw with the
 * palette constants (src/shared/types.ts PALETTE) and stay navy.
 */
import { useEffect, useMemo } from 'react'
import { STORE } from '@/edition'
import { DEFAULT_THEME, THEMES, TOKEN_NAMES, ownedThemes, rewardsOn, useStore, type Ev, type Settings, type ThemeId } from '@/store'

/** The theme that applies: hers when rewards are on and she owns it, else navy. */
export function appliedTheme(settings: Pick<Settings, 'theme' | 'rewards'>, events: readonly Ev[], store: boolean = STORE): ThemeId {
  const theme = settings.theme
  if (!theme || theme === DEFAULT_THEME || !rewardsOn(settings, store)) return DEFAULT_THEME
  return ownedThemes(events).includes(theme) ? theme : DEFAULT_THEME
}

/** Put a theme's tokens on the root element (navy: take them off, so the stylesheet's own values apply). */
export function applyTheme(id: ThemeId, root: HTMLElement | null = typeof document === 'undefined' ? null : document.documentElement): void {
  if (!root) return
  const def = THEMES[id] ?? THEMES[DEFAULT_THEME]
  for (const name of TOKEN_NAMES) {
    if (def.id === DEFAULT_THEME) root.style.removeProperty(`--color-${name}`)
    else root.style.setProperty(`--color-${name}`, def.tokens[name])
  }
  if (def.id === DEFAULT_THEME) root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', def.id)
  // The browser's own bar (a phone's address bar, an installed web app's title bar) takes the primary colour too.
  const meta = typeof document === 'undefined' ? null : document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', def.tokens.navy)
}

/** Mount once (the app shell): keeps the root element's tokens on the theme that applies. */
export function useAppliedTheme(): void {
  const events = useStore((s) => s.events)
  const settings = useStore((s) => s.settings)
  const id = useMemo(() => appliedTheme(settings, events), [settings, events])
  useEffect(() => {
    applyTheme(id)
  }, [id])
}

/** The same as a component, for pages rendered on their own (tests). */
export function ThemeRoot(): null {
  useAppliedTheme()
  return null
}
