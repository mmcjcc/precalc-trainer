/**
 * Colour themes (docs/progress/phone-quests.md). The app's primary colour is the navy family of tokens in src/index.css
 * (`--color-navy`, `-600`, `-800`, `-100`, `-50`); a theme is one set of values for those five, applied at runtime on
 * the root element (components/quests/theme.ts). Coral, gold, and the right and wrong colours never change.
 *
 * Navy is the default and always hers. The other three are earned, one at a time, from the daily chest
 * (store/chest.ts): never bought. Each passes the same contrast rules as navy (src/store/themes.test.ts): its text and
 * buttons at least 4.5:1 on white and on its own light tints, and the light tints at least 3:1 where they carry
 * meaning. None is green, red or gold: those colours already mean right, wrong and the gold of a squash. Pure data.
 */
import type { ThemeId } from './types'

/** The five navy-family tokens a theme sets (the CSS custom property names, without `--color-`). */
export interface ThemeTokens {
  /** Text, filled buttons, rings. */
  navy: string
  /** A filled button under the pointer. */
  'navy-600': string
  /** The darker edge under a chunky button and a path stop. */
  'navy-800': string
  /** Borders, a ring's track, a missed day's dot. */
  'navy-100': string
  /** Light panels and the keypad. */
  'navy-50': string
}

export interface ThemeDef {
  id: ThemeId
  /** Her word for it in Settings and on the chest. */
  name: string
  tokens: ThemeTokens
}

export const DEFAULT_THEME: ThemeId = 'navy'

export const THEMES: Readonly<Record<ThemeId, ThemeDef>> = {
  navy: {
    id: 'navy',
    name: 'Navy',
    tokens: { navy: '#2F3C7E', 'navy-600': '#26316a', 'navy-800': '#1b2353', 'navy-100': '#e6e8f3', 'navy-50': '#f3f4f9' },
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    tokens: { navy: '#07425A', 'navy-600': '#053647', 'navy-800': '#032530', 'navy-100': '#DCEBF0', 'navy-50': '#EEF6F8' },
  },
  plum: {
    id: 'plum',
    name: 'Plum',
    tokens: { navy: '#58286F', 'navy-600': '#48205C', 'navy-800': '#2F143D', 'navy-100': '#EEE4F3', 'navy-50': '#F7F2F9' },
  },
  cocoa: {
    id: 'cocoa',
    name: 'Cocoa',
    tokens: { navy: '#553627', 'navy-600': '#462C20', 'navy-800': '#2D1C14', 'navy-100': '#F1E7E1', 'navy-50': '#F9F4F1' },
  },
}

/** The themes a chest can give, in the order Settings lists them (and the chest draws from). */
export const EARNED_THEMES: readonly ThemeId[] = ['ocean', 'plum', 'cocoa']

export const THEME_IDS: readonly ThemeId[] = [DEFAULT_THEME, ...EARNED_THEMES]

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && (THEME_IDS as readonly string[]).includes(v)
}

export const TOKEN_NAMES: readonly (keyof ThemeTokens)[] = ['navy', 'navy-600', 'navy-800', 'navy-100', 'navy-50']
