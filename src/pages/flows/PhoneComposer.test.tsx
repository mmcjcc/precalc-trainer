// @vitest-environment jsdom
/**
 * The phone composer with the keypad open (docs/progress/app-tablet.md), at 375 x 812 and 360 x 640: the line she is
 * writing, the last two lines of her work above it and the problem strip stay on screen; the composer's extras (the
 * verdict, the nudge, Stuck?, the tools, notes) fold to one line that unfolds on a tap; no blank band between the composer
 * and the keypad. jsdom has no layout, so the fit is measured with the layout's own numbers: the keypad's from index.css,
 * the strip's, the composer's and the work rows' from the classes they carry on the page here.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '@/App'
import { resetKeypadForTests, useKeypadStore } from '@/components/keypadStore'
import { LINE_GAP } from '@/components/keypadDom'
import { keypad, tap, tapBox } from '@/components/keypadTesting'
import { resetWindowSize, setWindowSize } from '@/components/layoutTesting'
import { problemPath } from '@/problem/url'
import { resetStoreForTests } from '@/store'

const LAZY = { timeout: 120_000 }
const FLOW_TIMEOUT = 120_000
/** The app's stylesheet (vitest runs from the project's root). */
const CSS = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

/** IntersectionObserver for jsdom: the test says when the problem card has scrolled out of view. */
class FakeIntersectionObserver {
  static live: FakeIntersectionObserver[] = []
  readonly targets = new Set<Element>()
  constructor(readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.live.push(this)
  }
  observe(el: Element) {
    this.targets.add(el)
  }
  unobserve(el: Element) {
    this.targets.delete(el)
  }
  disconnect() {
    this.targets.clear()
    FakeIntersectionObserver.live = FakeIntersectionObserver.live.filter((o) => o !== this)
  }
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

function scrollCardAway() {
  const rect = { top: -420, bottom: -140 }
  act(() => {
    for (const io of [...FakeIntersectionObserver.live]) {
      for (const target of io.targets) {
        const entry = { target, isIntersecting: false, intersectionRatio: 0, boundingClientRect: rect, intersectionRect: rect, rootBounds: null, time: 0 }
        io.callback([entry as unknown as IntersectionObserverEntry], io as unknown as IntersectionObserver)
      }
    }
  })
}

// ---- the layout's own numbers -----------------------------------------------------------------------------------

/** A CSS rule's body in index.css. */
function rule(selector: string): string {
  const at = CSS.indexOf(`${selector} {`)
  if (at < 0) throw new Error(`no rule ${selector} in index.css`)
  return CSS.slice(at, CSS.indexOf('}', at))
}

/** The open keypad's height in a window `height` px tall, from index.css: rows of clamp(min, vh, max), gaps, padding. */
function keypadHeight(height: number, contextRow: boolean): number {
  const key = /height: clamp\((\d+)px, ([\d.]+)dvh, (\d+)px\)/.exec(rule('.kp-key'))!
  const [min, vh, max] = [Number(key[1]), Number(key[2]), Number(key[3])]
  const row = Math.min(max, Math.max(min, (vh / 100) * height))
  const grid = rule('.kp-grid')
  const gridRows = (grid.match(/"[^"]+"/g) ?? []).length
  const gridGap = Number(/gap: (\d+)px/.exec(grid)![1])
  const innerGap = Number(/gap: (\d+)px/.exec(rule('.kp-inner'))![1])
  const panel = rule('.math-keypad')
  const pad = Number(/padding: (\d+)px/.exec(panel)![1])
  const border = Number(/border-top: (\d+)px/.exec(panel)![1])
  const rows = gridRows + (contextRow ? 1 : 0)
  return border + pad * 2 + rows * row + (gridRows - 1) * gridGap + (contextRow ? innerGap : 0)
}

/** Tailwind's spacing scale: a class's number times 4 px (h-9 is 36 px, mb-1.5 is 6 px). */
function px(el: Element, prefix: string): number {
  const cls = el.className.toString().split(/\s+/).find((c) => c.startsWith(`${prefix}-`) && /^[\d.]+$/.test(c.slice(prefix.length + 1)))
  if (!cls) throw new Error(`${prefix}-* not on <${el.tagName.toLowerCase()} class="${el.className}">`)
  return Number(cls.slice(prefix.length + 1)) * 4
}

/** Text lines (line heights of text-sm and text-base) and the tallest line of inline math (a fraction). */
const TEXT_SM = 20
const MATH_LINE = 40

/** The folded composer: its top border and padding, the one line, the preview and the box, its bottom padding. */
function foldedComposerHeight(composer: HTMLElement): number {
  const status = composer.querySelector<HTMLElement>('[data-composer-status]')!
  const line = status.firstElementChild!
  const form = composer.querySelector('form')!
  const preview = form.querySelector('[aria-label="Preview"]')!
  const box = form.querySelector('input')!
  const bottom = /padding-bottom: max\(([\d.]+)rem/.exec(rule('.composer-sticky'))!
  expect(composer.className).toContain('border-t')
  return 1 + px(composer, 'pt') + px(status, 'mb') + px(line, 'h') + px(preview, 'min-h') + px(form, 'space-y') + px(box, 'min-h') + Number(bottom[1]) * 16
}

/** A row of her work (WorkedColumn): its border and padding round the tallest of its number, its math and its Undo. */
function workRowHeight(row: HTMLElement): number {
  const undo = row.querySelector('button')
  const content = Math.max(TEXT_SM + 4, MATH_LINE + 4, undo ? px(undo, 'min-h') : 0)
  expect(row.className).toContain('border ')
  return 2 + px(row, 'py') * 2 + content
}

/** The pinned problem: its button's height and its bottom border. */
function stripHeight(): number {
  const strip = document.querySelector<HTMLElement>('[data-pinned-problem]')!
  expect(strip.className).toContain('border-b')
  return px(strip.querySelector('button')!, 'min-h') + 1
}

// ---- the page ----------------------------------------------------------------------------------------------------

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell />
    </MemoryRouter>,
  )
}

const PATH = problemPath('expLogEquations', 'ee.exponential', 24)
const line = () => screen.getByRole('textbox', { name: 'Next line' }) as HTMLInputElement
const composer = () => line().closest<HTMLElement>('[data-keypad-region]')!
const status = () => composer().querySelector<HTMLElement>('[data-composer-status]')!

function check(text: string) {
  fireEvent.change(line(), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Check this line' }))
}

beforeAll(async () => {
  await import('@/pages/Problem')
}, 120_000)

beforeEach(() => {
  resetStoreForTests()
  resetKeypadForTests()
  localStorage.clear()
  FakeIntersectionObserver.live = []
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  window.scrollBy = vi.fn() as unknown as typeof window.scrollBy
  Element.prototype.scrollIntoView = (() => {}) as unknown as Element['scrollIntoView']
})

afterEach(() => {
  resetWindowSize()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
})

describe.each([
  [375, 812],
  [360, 640],
])('a phone at %i x %i with the keypad open', (width, height) => {
  it(
    'the extras fold to one line that unfolds on a tap; the writing line, two lines of work and the strip fit; no gap',
    async () => {
      setWindowSize(width, height)
      renderAt(PATH)
      await screen.findByRole('textbox', { name: 'Next line' }, LAZY)
      // One kept line (with the start line, two lines of work), then a slip the composer names.
      check('(x+2)log(7) = xlog(2)')
      check('x + 2 = x')
      const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-work-line]'))
      expect(rows).toHaveLength(2)

      // Keypad down: the composer shows everything (the tools row, the whole verdict).
      expect(composer().hasAttribute('data-folded')).toBe(false)
      expect(within(composer()).getByRole('button', { name: 'Hints' })).toBeTruthy()

      // Keypad up: one line, the verdict cut to it, Why? and Stuck? on it, the tools folded away.
      tapBox(line())
      expect(keypad()).toBeTruthy()
      expect(composer().hasAttribute('data-folded')).toBe(true)
      expect(status().hasAttribute('data-folded')).toBe(true)
      expect(status().firstElementChild!.className).toContain('h-9')
      expect(status().querySelector('[data-fold-line] p')!.className).toContain('truncate')
      expect(status().textContent).toContain('Not kept:')
      expect(within(status()).getByRole('button', { name: /^Why\? / })).toBeTruthy()
      expect(within(status()).getByRole('button', { name: 'Stuck?' })).toBeTruthy()
      expect(within(composer()).queryByRole('button', { name: 'Hints' })).toBeNull()
      // What is on screen of the composer: that line and the box she writes in, nothing else.
      const shown = Array.from(composer().children).filter((c) => !c.hasAttribute('hidden'))
      expect(shown).toEqual([status(), composer().querySelector('form')])

      // A tap on ⌄ unfolds the extras; ⌃ folds them again; so does the next Check.
      const more = within(status()).getByRole('button', { name: 'More: tools, hints and notes' })
      expect(more.getAttribute('aria-expanded')).toBe('false')
      fireEvent.click(more)
      expect(composer().hasAttribute('data-folded')).toBe(false)
      expect(within(composer()).getByRole('button', { name: 'Hints' })).toBeTruthy()
      expect(document.activeElement).toBe(line())
      fireEvent.click(within(status()).getByRole('button', { name: 'Less' }))
      expect(composer().hasAttribute('data-folded')).toBe(true)
      fireEvent.click(status().querySelector('[data-fold-line]')!)
      expect(composer().hasAttribute('data-folded')).toBe(false)
      tap('check')
      expect(composer().hasAttribute('data-folded')).toBe(true)

      // The fit, with the layout's own numbers.
      scrollCardAway()
      const strip = stripHeight()
      const kp = keypadHeight(height, keypad().querySelector('.kp-context') !== null)
      const folded = foldedComposerHeight(composer())
      const gap = px(rows[0]!.parentElement!, 'space-y')
      const lines = workRowHeight(rows[0]!) + gap + workRowHeight(rows[1]!)
      const room = height - strip - kp - folded - LINE_GAP
      expect(lines).toBeLessThanOrEqual(room)
      // For the log: what is left over (px) under those numbers.
      expect(room - lines).toBeGreaterThanOrEqual(0)

      // No gap: the page keeps no padding under the composer, the composer is the end of a column that reaches the
      // keypad, and the page keeps no safe-area band under the open keypad (index.css).
      expect(document.getElementById('main')!.className).toContain('pb-0')
      const column = document.querySelector<HTMLElement>('[data-problem-column]')!
      expect(column.lastElementChild).toBe(composer())
      expect(column.className).toContain('phone-problem-column')
      expect(rule('.phone-problem-column')).toContain('min-height: calc(100dvh - max(var(--keypad-h, 0px)')
      expect(composer().className).toContain('mt-auto')
      expect(document.documentElement.hasAttribute('data-keypad-open')).toBe(true)
      expect(rule('html[data-keypad-open] #root')).toContain('padding-bottom: 0')
    },
    FLOW_TIMEOUT,
  )

  it(
    'after a Check on the keypad her newest line ends right above the composer, not the page’s end',
    async () => {
      setWindowSize(width, height)
      const KEYPAD = Math.round(keypadHeight(height, true))
      const COMPOSER = 155
      const LAST_BOTTOM = 700
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        const rect = (top: number, bottom: number) => ({ top, bottom, height: bottom - top, left: 0, right: width, width, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
        if (this.classList.contains('math-keypad')) return rect(height - KEYPAD, height)
        if (this.hasAttribute('data-keypad-region')) return rect(height - KEYPAD - COMPOSER, height - KEYPAD)
        if (this.hasAttribute('data-work-line')) {
          const all = Array.from(document.querySelectorAll('[data-work-line]'))
          const i = all.indexOf(this)
          return rect(LAST_BOTTOM - 60 * (all.length - i), LAST_BOTTOM - 60 * (all.length - 1 - i))
        }
        return rect(0, 0)
      })
      renderAt(PATH)
      await screen.findByRole('textbox', { name: 'Next line' }, LAZY)
      tapBox(line())
      expect(useKeypadStore.getState().height).toBe(KEYPAD)
      fireEvent.change(line(), { target: { value: '(x+2)log(7) = xlog(2)' } })
      const scrollBy = window.scrollBy as unknown as ReturnType<typeof vi.fn>
      scrollBy.mockClear()
      tap('check')
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200))
      })
      const want = Math.round(LAST_BOTTOM - (height - KEYPAD - COMPOSER - LINE_GAP))
      expect(scrollBy).toHaveBeenCalledWith({ top: want, behavior: 'smooth' })
      expect(window.scrollTo).not.toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }))
    },
    FLOW_TIMEOUT,
  )

  it(
    'when the keypad opens with the page at its top (a resumed problem), her newest line comes right above the composer',
    async () => {
      // Review 2026-10-22, on the emulator: her lines stayed hidden behind the composer until the next Check.
      setWindowSize(width, height)
      const KEYPAD = Math.round(keypadHeight(height, true))
      const COMPOSER = 155
      const LAST_BOTTOM = height + 300
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        const rect = (top: number, bottom: number) => ({ top, bottom, height: bottom - top, left: 0, right: width, width, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
        if (this.classList.contains('math-keypad')) return rect(height - KEYPAD, height)
        if (this.hasAttribute('data-keypad-region')) return rect(height - KEYPAD - COMPOSER, height - KEYPAD)
        if (this.hasAttribute('data-work-line')) {
          const all = Array.from(document.querySelectorAll('[data-work-line]'))
          const i = all.indexOf(this)
          return rect(LAST_BOTTOM - 60 * (all.length - i), LAST_BOTTOM - 60 * (all.length - 1 - i))
        }
        return rect(0, 0)
      })
      renderAt(PATH)
      await screen.findByRole('textbox', { name: 'Next line' }, LAZY)
      const scrollBy = window.scrollBy as unknown as ReturnType<typeof vi.fn>
      scrollBy.mockClear()
      tapBox(line())
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200))
      })
      const want = Math.round(LAST_BOTTOM - (height - KEYPAD - COMPOSER - LINE_GAP))
      expect(scrollBy).toHaveBeenCalledWith({ top: want, behavior: 'smooth' })
    },
    FLOW_TIMEOUT,
  )
})
