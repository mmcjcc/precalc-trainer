// @vitest-environment jsdom
/**
 * The unit path on Home (docs/progress/phone-path.md): every type of the unit as a stop in course order with its
 * state, "You are here" on the set builder's first type, a sheet (phone) or popover (wide) with "Practice this type"
 * and "About this module", the review's trophy or the finish flag, no locks anywhere, the accessible names, the
 * level-up celebration (once, never under reduced motion), and Home's other cards as they were.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COURSES, getCourse, modulesInUnit, type UnitDef } from '@/content'
import { removePointer } from '@/components/keypadTesting'
import { loadActiveSet } from '@/session/activeSet'
import { buildSet } from '@/session/buildSet'
import { emptyRewards, resetStoreForTests, useStore, type Ev } from '@/store'
import { Home } from '@/pages/Home'
import { PATH_STORAGE_KEY, readPathMemory } from './pathMemory'
import { setStart, unitPath } from './pathModel'

const PAGE_TIMEOUT = 120_000
const DAY = 86_400_000
const HOUR = 3_600_000

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderHome(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/c/:courseId" element={<Home />} />
        <Route path="/c/:courseId/:unitId" element={<Home />} />
        <Route path="/m/:moduleId" element={<p>Module page</p>} />
        <Route path="/p/:moduleId/:templateId/:seed" element={<p>Problem page</p>} />
        <Route path="/review/:reviewId" element={<p>Review page</p>} />
        <Route path="/set" element={<p>Set page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const where = () => screen.getByTestId('where').textContent

/** A device: a phone or a wide screen, and whether it asks for reduced motion. */
function installMedia({ wide, reduce }: { wide: boolean; reduce: boolean }) {
  window.matchMedia = ((query: string) => ({
    matches: /prefers-reduced-motion:\s*reduce/.test(query) ? reduce : /min-width/.test(query) ? wide : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

let seq = 0

function done(skill: string, moduleId: string, at: number, opts: Partial<Extract<Ev, { t: 'problem_done' }>> = {}): Ev {
  seq += 1
  return {
    t: 'problem_done',
    at,
    attemptId: `${skill}#${seq}`,
    skill,
    moduleId,
    steps: 2,
    firstTryRate: 1,
    hints: 0,
    revealed: 0,
    finalCorrect: true,
    mode: 'normal',
    secs: 60,
    ...opts,
  }
}

/** `n` problems of a type that went well, the last one `daysAgo` days ago. */
function good(skill: string, moduleId: string, n: number, daysAgo = 1): Ev[] {
  const last = Date.now() - daysAgo * DAY
  return Array.from({ length: n }, (_, i) => done(skill, moduleId, last - (n - 1 - i) * HOUR))
}

/** Unit 3 with each state: a type practiced (2 of 5 went well), one solid, one mastered; the rest new. */
function seedUnit3(): Ev[] {
  const events = [
    ...good('lf.convert', 'logForms', 2, 3),
    ...good('lp.expand', 'logProperties', 3, 2),
    ...good('lp.condense', 'logProperties', 5, 1),
  ]
  useStore.setState({ events })
  return events
}

const precalc = getCourse('precalc')!
const unit3 = precalc.units[2]!

const pathList = () => screen.getByRole('list', { name: /^Path through / })
const stops = () => [...pathList().querySelectorAll<HTMLButtonElement>('[data-path-stop]')]
const stop = (templateId: string) => pathList().querySelector<HTMLButtonElement>(`[data-path-stop="${templateId}"]`)!
const nameOf = (el: Element) => el.getAttribute('aria-label') ?? ''

beforeEach(() => {
  resetStoreForTests()
  localStorage.clear()
  window.scrollTo = () => {}
})

afterEach(() => {
  vi.unstubAllGlobals()
  removePointer()
})

describe('the stops', () => {
  it('every type of the unit, in course order, with its state from the log', { timeout: PAGE_TIMEOUT }, () => {
    seedUnit3()
    renderHome('/c/precalc/unit3')
    const types = modulesInUnit(unit3).flatMap((m) => m.templates.map((t) => ({ id: t.id, title: t.title, module: m.title })))
    expect(stops().map((s) => s.dataset.pathStop)).toEqual(types.map((t) => t.id))
    expect(stops().map((s) => s.dataset.stopState)).toEqual(
      types.map((t) => (t.id === 'lf.convert' ? 'practiced' : t.id === 'lp.expand' ? 'solid' : t.id === 'lp.condense' ? 'mastered' : 'new')),
    )
    // Each title is written beside its node.
    for (const [i, s] of stops().entries()) expect(s.textContent).toContain(types[i]!.title)
    // The type, its state and its module (the next set's first type adds "You are here", tested below).
    const plain = (id: string) => nameOf(stop(id)).replace(/^You are here\. /, '')
    expect(plain('lf.value')).toBe('Evaluate a logarithm: new. In Logarithms and exponential form.')
    expect(plain('lf.convert')).toBe('Rewrite in the other form: practiced, 2 of 5. In Logarithms and exponential form.')
    expect(plain('lp.expand')).toBe('Expand a logarithm: solid, 3 of 5. In Properties of logarithms.')
    expect(plain('lp.condense')).toBe('Condense to one logarithm: mastered. In Properties of logarithms.')
    // The look follows the state: grey to do, navy under way, green with a check once solid.
    expect(stop('lf.value').querySelector('[data-face]')!.className).toContain('bg-navy-100')
    expect(stop('lf.convert').querySelector('[data-face]')!.className).toContain('bg-navy')
    expect(stop('lp.expand').querySelector('[data-face]')!.className).toContain('bg-ok')
    expect(stop('lp.condense').querySelector('[data-face]')!.className).toContain('bg-ok')
    // The ring: empty, part-filled (navy), part-filled (green), full.
    const arc = (id: string) => stop(id).querySelector('[data-ring-value]')?.getAttribute('data-ring-value') ?? null
    expect(arc('lf.value')).toBeNull()
    expect(arc('lf.convert')).toBe('0.40')
    expect(arc('lp.expand')).toBe('0.60')
    expect(arc('lp.condense')).toBe('1.00')
    // The header: the unit's name and how many types are solid.
    const section = screen.getByRole('region', { name: 'Unit 3 · Exponential and logarithmic functions' })
    expect(section.querySelector('[data-path-solid]')!.textContent).toBe(`2 of ${types.length} types solid`)
    expect(section.querySelector('header')!.compareDocumentPosition(pathList()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('is an ordered list; the ring is decorative and every stop is a button that opens a dialog, never disabled', { timeout: PAGE_TIMEOUT }, () => {
    renderHome('/c/precalc/unit3')
    expect(pathList().tagName).toBe('OL')
    for (const s of stops()) {
      expect(s.tagName).toBe('BUTTON')
      expect(s.hasAttribute('disabled')).toBe(false)
      expect(s.getAttribute('aria-disabled')).toBeNull()
      expect(s.getAttribute('aria-haspopup')).toBe('dialog')
      for (const svg of s.querySelectorAll('svg')) expect(svg.getAttribute('aria-hidden')).toBe('true')
      // A finger-sized target: the node alone is 68 px (80 px raised).
      expect(parseInt((s.firstElementChild as HTMLElement).style.width)).toBeGreaterThanOrEqual(44)
    }
    expect(document.querySelectorAll('[disabled], [aria-disabled="true"]')).toHaveLength(0)
    expect(document.body.textContent).not.toMatch(/locked|padlock/i)
  })

  it('every unit of every class renders, an empty one too, with no stop disabled', { timeout: PAGE_TIMEOUT }, () => {
    const empty: UnitDef = { id: 'unit9', label: 'Unit 9', title: 'Conics', moduleIds: ['conicsNotYet'] }
    const units = precalc.units as UnitDef[]
    units.push(empty)
    try {
      for (const course of COURSES) {
        for (const unit of course.units) {
          const view = renderHome(`/c/${course.id}/${unit.id}`)
          expect(screen.getByRole('button', { name: new RegExp(`^${unit.label} · `), pressed: true })).toBeTruthy()
          const types = modulesInUnit(unit).flatMap((m) => m.templates)
          if (modulesInUnit(unit).length === 0) {
            expect(unitPath(course, unit, new Map())).toEqual([])
            if (course.id === 'sat') {
              expect(setStart(course, [], emptyRewards(), Date.now(), unit.id)).toBeNull()
              expect(screen.getByRole('heading', { name: 'SAT practice set' })).toBeTruthy()
            } else {
              expect(screen.getByText('Nothing to practise here yet: this unit is being built.')).toBeTruthy()
            }
            expect(screen.queryByRole('list', { name: /^Path through / })).toBeNull()
          } else {
            expect(stops()).toHaveLength(types.length)
            expect(stops().filter((s) => s.disabled || s.getAttribute('aria-disabled') === 'true')).toEqual([])
            // With no history the next set starts at the unit Home shows: exactly one "You are here", its first type.
            expect([...pathList().querySelectorAll<HTMLElement>('[data-here]')].map((s) => s.dataset.pathStop)).toEqual([types[0]!.id])
            expect(within(screen.getByRole('region', { name: 'Modules in this unit' })).getAllByRole('link')).toHaveLength(modulesInUnit(unit).length)
          }
          view.unmount()
        }
      }
    } finally {
      units.pop()
    }
  })
})

describe('You are here', () => {
  it('is the type Start a set starts with, raised and named, with the header saying so', { timeout: PAGE_TIMEOUT }, () => {
    const events = seedUnit3()
    renderHome('/c/precalc/unit3')
    const expected = buildSet({ course: precalc, events, rewards: emptyRewards(), now: Date.now(), seed: 1, startUnit: 'unit3' }).problems[0]!.templateId
    const here = pathList().querySelectorAll<HTMLButtonElement>('[data-here]')
    expect(here).toHaveLength(1)
    expect(here[0]!.dataset.pathStop).toBe(expected)
    expect(nameOf(here[0]!)).toMatch(/^You are here\. /)
    expect(here[0]!.textContent).toContain('You are here')
    // Raised: a size up.
    expect((here[0]!.firstElementChild as HTMLElement).style.width).toBe('80px')
    const title = modulesInUnit(unit3).flatMap((m) => m.templates).find((t) => t.id === expected)!.title
    expect(screen.getByText(title, { selector: 'span.font-semibold' })).toBeTruthy()
    const show = screen.getByRole('button', { name: 'Show me' })
    fireEvent.click(show)
    expect(document.activeElement).toBe(here[0])

    // The set she gets starts there.
    fireEvent.click(screen.getByRole('button', { name: 'Start a set' }))
    expect(where()).toBe('/set')
    expect(loadActiveSet()!.problems[0]!.templateId).toBe(expected)
  })

  it('a mistake to squash in another unit: no stop here is marked, the header says where the set starts', { timeout: PAGE_TIMEOUT }, () => {
    useStore.setState({
      events: [
        ...good('lf.value', 'logForms', 1, 1),
        { t: 'step_rejected', at: Date.now() - 2 * DAY, attemptId: 'x1', skill: 'ineq.linear', stepIdx: 0, pattern: 'no_sign_flip' },
      ],
    })
    renderHome('/c/precalc/unit3')
    expect(pathList().querySelectorAll('[data-here]')).toHaveLength(0)
    expect(screen.getByText(/^Your next set starts in Unit 1 · Functions and their graphs, with/).textContent).toContain('Linear inequality')
    fireEvent.click(screen.getByRole('button', { name: 'Show that unit' }))
    expect(screen.getByRole('button', { name: /^Unit 1 · /, pressed: true })).toBeTruthy()
    expect(stop('ineq.linear').hasAttribute('data-here')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Start a set' }))
    expect(loadActiveSet()!.problems[0]!.templateId).toBe('ineq.linear')
  })

  it('pulses only where motion is allowed', { timeout: PAGE_TIMEOUT }, () => {
    installMedia({ wide: false, reduce: false })
    const moving = renderHome('/c/precalc/unit3')
    expect(pathList().querySelector('[data-here] .path-pulse')).toBeTruthy()
    moving.unmount()
    installMedia({ wide: false, reduce: true })
    renderHome('/c/precalc/unit3')
    expect(pathList().querySelector('[data-here]')).toBeTruthy()
    expect(document.querySelector('.path-pulse')).toBeNull()
  })
})

describe('a stop’s sheet and popover', () => {
  it('a phone: a sheet with the type, its ring and state, and its two actions; Practice this type opens that type', { timeout: PAGE_TIMEOUT }, () => {
    installMedia({ wide: false, reduce: true })
    seedUnit3()
    renderHome('/c/precalc/unit3')
    const s = stop('lp.expand')
    fireEvent.click(s)
    const dialog = screen.getByRole('dialog', { name: 'Expand a logarithm' })
    expect(dialog.closest('[data-path-sheet]')).toBeTruthy()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(s.getAttribute('aria-expanded')).toBe('true')
    expect(within(dialog).getByText('Properties of logarithms')).toBeTruthy()
    expect(within(dialog).getByText('Solid: 3 of the last 5 went well')).toBeTruthy()
    expect(within(dialog).getByRole('link', { name: 'About this module' }).getAttribute('href')).toBe('/m/logProperties')
    // Nothing in it is disabled; the close button and the actions are finger-sized.
    for (const el of within(dialog).getAllByRole('button')) expect(el.hasAttribute('disabled')).toBe(false)
    expect(within(dialog).getByRole('button', { name: 'Close' }).className).toContain('h-11')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Practice this type' }))
    expect(where()).toMatch(/^\/p\/logProperties\/lp\.expand\/[0-9a-z]+$/)
  })

  it('keeps focus inside, closes with Escape and its close button, and gives focus back to the stop', { timeout: PAGE_TIMEOUT }, async () => {
    installMedia({ wide: false, reduce: true })
    renderHome('/c/precalc/unit3')
    const s = stop('lf.value')
    s.focus()
    fireEvent.click(s)
    const dialog = screen.getByRole('dialog', { name: 'Evaluate a logarithm' })
    expect(document.activeElement).toBe(dialog)
    const close = within(dialog).getByRole('button', { name: 'Close' })
    const about = within(dialog).getByRole('link', { name: 'About this module' })
    // Shift+Tab from the dialog itself goes to its last control; Tab from the last goes round to the first.
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(about)
    fireEvent.keyDown(about, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(about)
    // Focus that wanders outside comes back in.
    act(() => screen.getByRole('button', { name: 'Start a set' }).focus())
    expect(dialog.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(s)
    expect(s.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(s)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(s)
    // A tap on the backdrop closes it too.
    fireEvent.click(s)
    fireEvent.click(document.querySelector('[data-path-sheet] > [aria-hidden]')!)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('a wide screen: a popover under the stop; a tap outside closes it; About this module opens the module page', { timeout: PAGE_TIMEOUT }, () => {
    installMedia({ wide: true, reduce: true })
    renderHome('/c/precalc/unit3')
    fireEvent.click(stop('ee.exponential'))
    const dialog = screen.getByRole('dialog', { name: 'Exponential equations' })
    expect(dialog.hasAttribute('data-path-popover')).toBe(true)
    expect(dialog.closest('[data-path-sheet]')).toBeNull()
    // It sits in the stop's own row, right under it.
    expect(stop('ee.exponential').parentElement!.contains(dialog)).toBe(true)
    fireEvent.click(document.querySelector('[data-path-popover-backdrop]')!)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(stop('ee.exponential'))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'About this module' }))
    expect(where()).toBe('/m/expLogEquations')
  })

  it('the stop where the next set starts says so in its sheet', { timeout: PAGE_TIMEOUT }, () => {
    installMedia({ wide: false, reduce: true })
    renderHome('/c/precalc/unit3')
    const here = pathList().querySelector<HTMLButtonElement>('[data-here]')!
    fireEvent.click(here)
    expect(within(screen.getByRole('dialog')).getByText('You are here: your next set starts with this type.')).toBeTruthy()
  })
})

describe('the end of the path', () => {
  it('Unit 1 ends at the review’s trophy, which opens the review', { timeout: PAGE_TIMEOUT }, () => {
    renderHome('/c/precalc/unit1')
    const trophy = within(pathList()).getByRole('link', { name: 'Unit 1 review: one mixed set from the whole unit' })
    expect(trophy.hasAttribute('data-path-trophy')).toBe(true)
    // The last item on the path.
    const items = within(pathList()).getAllByRole('listitem')
    expect(items.at(-1)!.contains(trophy)).toBe(true)
    expect(items).toHaveLength(stops().length + 1)
    fireEvent.click(trophy)
    expect(where()).toBe('/review/unit1')
  })

  it('a unit with no review ends with a finish flag that counts the solid types', { timeout: PAGE_TIMEOUT }, () => {
    seedUnit3()
    renderHome('/c/precalc/unit3')
    const items = within(pathList()).getAllByRole('listitem')
    const flag = items.at(-1)!
    expect(flag.querySelector('[data-path-flag]')).toBeTruthy()
    expect(flag.textContent).toContain('Finish line')
    expect(flag.textContent).toContain(`2 of ${stops().length} types solid`)
    expect(within(pathList()).queryByRole('link')).toBeNull()
  })
})

describe('a stop that levelled up', () => {
  function rememberShown(seen: Record<string, { level: string; fill: number }>) {
    localStorage.setItem(PATH_STORAGE_KEY, JSON.stringify({ version: 1, seen }))
  }

  it('pops and sweeps its ring on the next visit to Home, once', { timeout: PAGE_TIMEOUT }, async () => {
    installMedia({ wide: false, reduce: false })
    seedUnit3()
    // The path last showed lp.expand Practiced (2 of 5) and the rest as they are now.
    rememberShown({ 'lf.convert': { level: 'practiced', fill: 0.4 }, 'lp.expand': { level: 'practiced', fill: 0.4 }, 'lp.condense': { level: 'mastered', fill: 1 } })
    const first = renderHome('/c/precalc/unit3')
    const s = stop('lp.expand')
    expect(s.dataset.levelup).toBe('play')
    expect(s.querySelector('.path-levelup')).toBeTruthy()
    // Its name says the state now; the ring sweeps from where it stood to now.
    expect(nameOf(s)).toBe('Expand a logarithm: solid, 3 of 5. In Properties of logarithms.')
    expect(s.querySelector('[data-ring-value]')!.getAttribute('data-ring-value')).toBe('0.40')
    await waitFor(() => expect(s.querySelector('[data-ring-value]')!.getAttribute('data-ring-value')).toBe('0.60'))
    await waitFor(() => expect(s.dataset.levelup).toBeUndefined(), { timeout: 3000 })
    // Only that stop.
    expect(stops().filter((x) => x.dataset.levelup !== undefined)).toEqual([])
    expect(readPathMemory()!.seen['lp.expand']).toEqual({ level: 'solid', fill: 0.6 })
    first.unmount()

    renderHome('/c/precalc/unit3')
    expect(stops().filter((x) => x.dataset.levelup !== undefined)).toEqual([])
    expect(document.querySelector('.path-levelup')).toBeNull()
  })

  it('never under reduced motion (and it does not wait to play later)', { timeout: PAGE_TIMEOUT }, () => {
    installMedia({ wide: false, reduce: true })
    seedUnit3()
    rememberShown({ 'lp.expand': { level: 'practiced', fill: 0.4 } })
    const still = renderHome('/c/precalc/unit3')
    expect(stops().filter((x) => x.dataset.levelup !== undefined)).toEqual([])
    expect(document.querySelector('.path-levelup')).toBeNull()
    expect(readPathMemory()!.seen['lp.expand']).toEqual({ level: 'solid', fill: 0.6 })
    still.unmount()
    installMedia({ wide: false, reduce: false })
    renderHome('/c/precalc/unit3')
    expect(document.querySelector('.path-levelup')).toBeNull()
  })

  it('celebrates nothing the first time the path is shown on a device, and waits until the stop is on screen', { timeout: PAGE_TIMEOUT }, () => {
    installMedia({ wide: false, reduce: false })
    seedUnit3()
    const first = renderHome('/c/precalc/unit3')
    expect(document.querySelector('[data-levelup]')).toBeNull()
    expect(readPathMemory()!.seen['lp.condense']).toEqual({ level: 'mastered', fill: 1 })
    first.unmount()

    // A level-up off screen waits, showing where it stood, and plays once it scrolls into view.
    rememberShown({ 'lf.convert': { level: 'practiced', fill: 0.4 }, 'lp.expand': { level: 'practiced', fill: 0.4 }, 'lp.condense': { level: 'mastered', fill: 1 } })
    const observers: { cb: IntersectionObserverCallback; el: Element | null }[] = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        private readonly entry: { cb: IntersectionObserverCallback; el: Element | null }
        constructor(cb: IntersectionObserverCallback) {
          this.entry = { cb, el: null }
          observers.push(this.entry)
        }
        observe(el: Element) {
          this.entry.el = el
        }
        disconnect() {}
        unobserve() {}
      },
    )
    renderHome('/c/precalc/unit3')
    const s = stop('lp.expand')
    expect(s.dataset.levelup).toBe('wait')
    expect(s.querySelector('[data-face]')!.getAttribute('data-face')).toBe('practiced')
    expect(nameOf(s)).toContain('solid, 3 of 5')
    expect(readPathMemory()!.seen['lp.expand']).toEqual({ level: 'practiced', fill: 0.4 })
    const watching = observers.filter((o) => o.el && s.contains(o.el)).at(-1)!
    act(() => watching.cb([{ isIntersecting: true, target: watching.el! } as unknown as IntersectionObserverEntry], {} as IntersectionObserver))
    expect(s.dataset.levelup).toBe('play')
    expect(s.querySelector('[data-face]')!.getAttribute('data-face')).toBe('solid')
    expect(readPathMemory()!.seen['lp.expand']).toEqual({ level: 'solid', fill: 0.6 })
  })
})

describe('Home around the path', () => {
  it('keeps its other cards in their places: the path and the module list come after the unit chips and the review card', { timeout: PAGE_TIMEOUT }, () => {
    useStore.getState().startAttempt({
      problemId: 'inequalities/ineq.linear@1/abc',
      moduleId: 'inequalities',
      templateId: 'ineq.linear',
      skill: 'ineq.linear',
      seed: 'abc',
      difficulty: '',
      genVersion: 1,
    })
    renderHome('/c/precalc/unit1')
    const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    const order = [
      screen.getByRole('heading', { level: 1 }),
      screen.getByRole('button', { name: 'Start a set' }),
      screen.getByRole('link', { name: 'Continue' }),
      screen.getByRole('tablist', { name: 'Classes' }),
      screen.getByRole('region', { name: 'Practice weak spots' }),
      screen.getByRole('group', { name: 'Honors Precalculus units' }),
      screen.getByRole('region', { name: 'Unit 1 review' }),
      screen.getByRole('region', { name: 'Unit 1 · Functions and their graphs' }),
      screen.getByRole('region', { name: 'Modules in this unit' }),
      screen.getByRole('link', { name: /Sandbox/ }),
    ]
    for (let i = 1; i < order.length; i++) expect(follows(order[i - 1]!, order[i]!)).toBe(true)
    // The path adds no second "Start a set" and no filled action.
    expect(screen.getAllByRole('button', { name: 'Start a set' })).toHaveLength(1)
    for (const s of stops()) expect(s.className).not.toMatch(/\bbg-navy\b/)
  })
})

describe('the styles', () => {
  // Tests run from the project root.
  const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8')
  const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))

  it('the pulse and the level-up pop are animations, both stopped under reduced motion, and the press stands still', () => {
    for (const name of ['path-pulse', 'path-levelup']) {
      expect(css).toMatch(new RegExp(`\\.${name} \\{[^}]*animation`))
      expect(reduced).toContain(`.${name}`)
    }
    expect(reduced).toMatch(/\.path-stop:active \.path-face \{ transform: none; \}/)
  })
})
