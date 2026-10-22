/**
 * The colour themes (store/themes.ts) pass the same contrast rules as navy: text and buttons at least 4.5:1 on white and
 * on the light tints; the light tints at least 3:1 where they carry meaning; and nowhere worse than navy itself, at every
 * opacity the app writes navy text with. Navy's values are the stylesheet's own.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, EARNED_THEMES, THEMES, THEME_IDS, TOKEN_NAMES, isThemeId } from './themes'

type RGB = [number, number, number]

function rgb(hex: string): RGB {
  const n = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)) as RGB
}

function channel(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance([r, g, b]: RGB): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG 2 contrast ratio. */
function ratio(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** `fg` at `alpha` over `bg` (what `text-navy/70` on white is). */
function over(fg: RGB, alpha: number, bg: RGB): RGB {
  return fg.map((c, i) => Math.round(c * alpha + bg[i]! * (1 - alpha))) as RGB
}

const WHITE: RGB = [255, 255, 255]
/** The opacities the app writes navy text with (`text-navy/90` ... `text-navy/40`). */
const TEXT_ALPHAS = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4]
const navy = THEMES.navy.tokens

describe('the themes', () => {
  it('navy is the stylesheet’s own family, and every theme sets all five tokens', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8')
    for (const name of TOKEN_NAMES) {
      const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6});`))
      expect(m?.[1]?.toLowerCase()).toBe(navy[name].toLowerCase())
    }
    expect(THEME_IDS).toEqual([DEFAULT_THEME, ...EARNED_THEMES])
    expect(EARNED_THEMES).toHaveLength(3)
    for (const id of THEME_IDS) {
      expect(isThemeId(id)).toBe(true)
      for (const name of TOKEN_NAMES) expect(THEMES[id].tokens[name]).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
    expect(isThemeId('forest')).toBe(false)
  })

  for (const id of THEME_IDS) {
    const t = THEMES[id].tokens
    const P = rgb(t.navy)
    it(`${THEMES[id].name}: text and buttons at least 4.5:1, the tints that carry meaning at least 3:1, never worse than navy`, () => {
      // Text on white, and white text on the filled buttons (the same ratio), at rest and under the pointer.
      expect(ratio(P, WHITE)).toBeGreaterThanOrEqual(4.5)
      expect(ratio(rgb(t['navy-600']), WHITE)).toBeGreaterThanOrEqual(4.5)
      expect(ratio(rgb(t['navy-800']), WHITE)).toBeGreaterThanOrEqual(4.5)
      // Text on the light panels and chips.
      expect(ratio(P, rgb(t['navy-50']))).toBeGreaterThanOrEqual(4.5)
      expect(ratio(P, rgb(t['navy-100']))).toBeGreaterThanOrEqual(4.5)
      // Navy text at 80% and up passes 4.5:1 on white and on the lightest panel.
      for (const a of [0.9, 0.8]) {
        expect(ratio(over(P, a, WHITE), WHITE)).toBeGreaterThanOrEqual(4.5)
        expect(ratio(over(P, a, rgb(t['navy-50'])), rgb(t['navy-50']))).toBeGreaterThanOrEqual(4.5)
      }
      // Marks that carry meaning: a ring's fill against its track, a mended day's dot and a skipped problem's ring
      // (navy at 60%) on white.
      expect(ratio(P, rgb(t['navy-100']))).toBeGreaterThanOrEqual(3)
      expect(ratio(over(P, 0.6, WHITE), WHITE)).toBeGreaterThanOrEqual(3)
      expect(ratio(WHITE, over(P, 0.6, WHITE))).toBeGreaterThanOrEqual(3)
      // Never worse than navy, at every text opacity the app uses (so a theme passes everything navy passes).
      for (const a of TEXT_ALPHAS) {
        expect(ratio(over(P, a, WHITE), WHITE)).toBeGreaterThanOrEqual(ratio(over(rgb(navy.navy), a, WHITE), WHITE) - 0.005)
      }
      // The light tints are as light as navy's (the same faint borders and panels, no darker).
      expect(ratio(rgb(t['navy-100']), WHITE)).toBeLessThan(1.35)
      expect(ratio(rgb(t['navy-50']), WHITE)).toBeLessThan(1.2)
    })
  }
})
