/**
 * Test helpers for the math keypad (jsdom). Not part of the app bundle: only tests import this file.
 * `typeOnKeypad` taps the keys a student would tap to write a line: digits and operations on the grid,
 * a function key for `ln(` (its parentheses come with it, so its `)` is the right-arrow key), the
 * strip's keys for words like `inf`, and nothing for spaces (the keypad spaces `=` itself).
 */
import { act, fireEvent, screen, within } from '@testing-library/react'

type MediaListener = (e: MediaQueryListEvent) => void

/** window.matchMedia where `(pointer: coarse)` is `coarse` and every width query is false (a phone). */
export function installPointer(coarse: boolean): void {
  window.matchMedia = ((query: string) => {
    const listeners = new Set<MediaListener>()
    return {
      matches: /pointer:\s*coarse/.test(query) ? coarse : false,
      media: query,
      onchange: null,
      addListener: (l: MediaListener) => listeners.add(l),
      removeListener: (l: MediaListener) => listeners.delete(l),
      addEventListener: (_: string, l: MediaListener) => listeners.add(l),
      removeEventListener: (_: string, l: MediaListener) => listeners.delete(l),
      dispatchEvent: () => false,
    } as unknown as MediaQueryList
  }) as typeof window.matchMedia
}

export function removePointer(): void {
  delete (window as { matchMedia?: unknown }).matchMedia
}

export function keypad(): HTMLElement {
  return screen.getByRole('group', { name: 'Math keypad' })
}

export function queryKeypad(): HTMLElement | null {
  return screen.queryByRole('group', { name: 'Math keypad' })
}

export function tap(name: string): void {
  fireEvent.click(within(keypad()).getByRole('button', { name }))
}

const tapKey = tap

/** Focus an element the way the page does (autofocus, a flow moving to the next part): no tap. */
export function focusBox(el: HTMLElement): void {
  act(() => {
    el.focus()
  })
}

/** Tap a box with a finger: it takes focus, then the click. */
export function tapBox(el: HTMLElement): void {
  focusBox(el)
  fireEvent.click(el)
}

/** Let a blur settle (the keypad decides after focus has landed). */
export async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5))
  })
}

/** Function keys whose parentheses come with them, by what they insert. */
const TEMPLATES: readonly [string, string][] = [
  ['sqrt(', 'square root'],
  ['cbrt(', 'cube root'],
  ['abs(', 'absolute value'],
  ['ln(', 'natural log'],
  ['log(', 'log base 10'],
  ['e^(', 'e to a power'],
]

/** Multi-character tokens typed with one key. */
const WORDS: readonly [string, string][] = [
  ['<=', 'less than or equal'],
  ['>=', 'greater than or equal'],
  ['!=', 'not equal'],
  ['+-', 'plus or minus'],
  ['inf', 'infinity'],
  ['pi', 'pi'],
  ['or', 'or'],
]

const CHARS: Record<string, string> = {
  '.': 'point',
  '+': 'plus',
  '-': 'minus',
  '*': 'times',
  '/': 'divide',
  '^': 'power',
  ',': 'comma',
  '=': 'equals',
  '<': 'less than',
  '>': 'greater than',
  '[': 'open bracket',
  ']': 'close bracket',
  U: 'union',
  '°': 'degrees',
}

/** Tap out `text` on the open keypad and return how many taps it took. Throws when a character has no key. */
export function typeOnKeypad(text: string): number {
  const open: ('paren' | 'template')[] = []
  let i = 0
  let taps = 0
  const tap = (name: string) => {
    tapKey(name)
    taps++
  }
  while (i < text.length) {
    const rest = text.slice(i)
    const ch = rest[0]!
    if (ch === ' ') {
      i++
      continue
    }
    const template = TEMPLATES.find(([insert]) => rest.startsWith(insert))
    if (template) {
      tap(template[1])
      open.push('template')
      i += template[0].length
      continue
    }
    const word = WORDS.find(([insert]) => rest.startsWith(insert) && !(insert === 'or' && /[a-z]/i.test(text[i - 1] ?? '')))
    if (word) {
      tap(word[1])
      i += word[0].length
      continue
    }
    if (ch === '(') {
      tap('open parenthesis')
      open.push('paren')
    } else if (ch === ')') {
      tap(open.pop() === 'template' ? 'right' : 'close parenthesis')
    } else if (/[0-9]/.test(ch)) {
      tap(ch)
    } else if (/[a-z]/i.test(ch) && ch !== 'U') {
      tap(ch)
    } else if (CHARS[ch]) {
      tap(CHARS[ch])
    } else {
      throw new Error(`no keypad key for ${JSON.stringify(ch)} in ${JSON.stringify(text)}`)
    }
    i++
  }
  return taps
}
