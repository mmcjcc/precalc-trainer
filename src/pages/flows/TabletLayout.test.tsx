// @vitest-environment jsdom
/**
 * The problem screen in the tablet layout (docs/progress/app-tablet.md), at 1280 x 800 and 1024 x 768 on a touch screen:
 * two panes that scroll on their own, the problem with its figure or graph and its tools on the left, her work and the
 * composer on the right with the keypad docked at the bottom of that pane; the sheets as centred dialogs. At 800 x 1280
 * (a tablet upright) and 375 x 812 the phone layout. The flows are the same components in both: only the frame places them.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import { resetKeypadForTests } from '@/components/keypadStore'
import { keypad, queryKeypad, tap, tapBox, typeOnKeypad } from '@/components/keypadTesting'
import { resetWindowSize, setWindowSize, WINDOWS } from '@/components/layoutTesting'
import { MathKeypad } from '@/components/MathKeypad'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '../Problem'

const FLOW_TIMEOUT = 120_000

/** The problem card never scrolls away here (the phone's pinned strip has nothing to do). */
class QuietObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MathKeypad />
      <Routes>
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
        <Route path="/m/:moduleId" element={<p>module page</p>} />
        <Route path="/" element={<p>Home page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const panes = () => document.querySelector<HTMLElement>('[data-panes]')
const left = () => screen.getByRole('region', { name: 'Problem and tools' })
const right = () => screen.getByRole('region', { name: 'Your working' })
const workArea = () => right().querySelector<HTMLElement>('[data-pane-scroll]')!
const slot = () => right().querySelector<HTMLElement>('[data-keypad-slot]')!
const sheetKind = (dialog: HTMLElement) => dialog.closest('[data-sheet]')!.getAttribute('data-sheet')

/** Two panes that fill the window and scroll on their own; the tools stacked under the problem, Hints first. */
function expectTwoPanes(title: string): string[] {
  expect(panes()).toBeTruthy()
  expect(panes()!.style.height).toMatch(/^\d+px$/)
  expect(left().className).toContain('overflow-y-auto')
  expect(workArea().className).toContain('overflow-y-auto')
  expect(within(left()).getByRole('heading', { level: 1 }).textContent).toBe(title)
  expect(left().querySelector('[data-problem-card]')).toBeTruthy()
  const tools = within(left()).getByRole('complementary', { name: 'Side panels' })
  const names = within(tools)
    .getAllByRole('heading', { level: 2 })
    .map((h) => h.textContent ?? '')
  expect(names[0]).toBe('Hints')
  expect(names).toContain('Rule cards')
  // Nothing of the phone's screen: no compact header, no Stuck? chip, no pinned strip.
  expect(screen.queryByRole('link', { name: /^Close, back to/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Stuck?' })).toBeNull()
  expect(document.querySelector('[data-pinned-problem]')).toBeNull()
  return names
}

/** The keypad is part of the right pane, under her work: not over the screen, no room kept by the page. */
function expectDockedKeypad() {
  const kp = keypad()
  expect(slot().contains(kp)).toBe(true)
  expect(kp.hasAttribute('data-docked')).toBe(true)
  expect(left().contains(kp)).toBe(false)
  expect(document.documentElement.style.getPropertyValue('--keypad-h')).toBe('')
  expect(document.documentElement.hasAttribute('data-keypad-open')).toBe(false)
}

beforeEach(() => {
  resetStoreForTests()
  resetKeypadForTests()
  localStorage.clear()
  vi.stubGlobal('IntersectionObserver', QuietObserver)
  window.scrollTo = () => {}
  Element.prototype.scrollIntoView = (() => {}) as unknown as Element['scrollIntoView']
})

afterEach(() => {
  resetWindowSize()
  vi.unstubAllGlobals()
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
})

describe.each([WINDOWS.wide, WINDOWS.landscape])('the tablet layout at %i x %i', (width, height) => {
  beforeEach(() => setWindowSize(width, height))

  it(
    'a line problem: the equation and its tools on the left; her work, the composer and the docked keypad on the right',
    () => {
      const p = generateProblem('expLogEquations', 'ee.exponential', 24)
      renderAt(problemPath('expLogEquations', 'ee.exponential', 24))
      expectTwoPanes(p.title)
      expect(left().querySelector('[data-problem-card] .katex')).toBeTruthy()
      // Her work and the composer are in the right pane; the composer is a block under the work, not sticky.
      const line = within(right()).getByRole('textbox', { name: 'Next line' })
      const composer = line.closest<HTMLElement>('[data-keypad-region]')!
      expect(workArea().contains(composer)).toBe(false)
      expect(composer.className).not.toContain('sticky')
      expect(workArea().compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      // The keypad docks at the bottom of the right pane, under the composer.
      tapBox(line)
      expectDockedKeypad()
      expect(composer.compareDocumentPosition(keypad()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      // A wrong line: the full card in her work, right above the composer (no composer verdict line on a tablet).
      typeOnKeypad('(x+2)ln(7) = ln(2')
      tap('check')
      const alert = within(workArea()).getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.log_power_as_power.title)
      expect(document.querySelector('[data-composer-status]')).toBeNull()
      // A kept line, typed on the docked keypad.
      fireEvent.change(line, { target: { value: '(x+2)log(7) = xlog(2)' } })
      tap('check')
      expect(useStore.getState().attempt?.steps).toHaveLength(1)
      expect(workArea().querySelectorAll('[data-work-line]').length).toBe(2)
    },
    FLOW_TIMEOUT,
  )

  it(
    'a parts problem: the function on the left; the parts on the right, the keypad docked under them',
    () => {
      const p = generateProblem('expLogGraphs', 'eg.features', 3)
      if (p.answer.type !== 'expLogGraphs') throw new Error('eg.features')
      renderAt(problemPath('expLogGraphs', 'eg.features', 3))
      expectTwoPanes(p.title)
      const domain = within(workArea()).getByRole('textbox', { name: 'Domain' })
      tapBox(domain)
      expectDockedKeypad()
      typeOnKeypad('(-2, inf)')
      tap('check')
      expect(within(workArea()).getByRole('alert').textContent).toContain(ERROR_PATTERNS.exp_domain_range_swapped.title)
      // Every part, then the completion card in her pane.
      for (const part of p.answer.stages) {
        if (part.kind === 'choice') {
          const label = part.choices?.find((c) => c.value === part.answerText)?.label ?? part.answerText
          fireEvent.click(within(workArea()).getByRole('radio', { name: label }))
          fireEvent.click(within(workArea()).getByRole('button', { name: 'Check' }))
        } else {
          const box = within(workArea()).getByRole('textbox', { name: part.label })
          tapBox(box)
          fireEvent.change(box, { target: { value: part.answerText } })
          tap('check')
        }
      }
      expect(within(workArea()).getByRole('heading', { name: /Problem (complete|finished)/ })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a geometry problem: the figure stays in view on the left while she works on the right',
    () => {
      const p = generateProblem('geoAngles', 'ga.bisector', 1)
      renderAt(problemPath('geoAngles', 'ga.bisector', 1))
      expectTwoPanes(p.title)
      expect(left().querySelector('[data-problem-card] [role="img"]')).toBeTruthy()
      expect(right().querySelector('[role="img"]')).toBeNull()
      const x = within(workArea()).getByRole('textbox', { name: 'x' })
      tapBox(x)
      expectDockedKeypad()
      fireEvent.change(x, { target: { value: '5' } })
      tap('check')
      expect(document.activeElement).toBe(within(workArea()).getByRole('textbox', { name: 'm∠ABC' }))
    },
    FLOW_TIMEOUT,
  )

  it(
    'a graph problem: the graph on the left with its tools, the readings on the right',
    () => {
      renderAt(problemPath('graphFeatures', 'gf.features', 1))
      expectTwoPanes('Read the graph')
      expect(within(left()).getAllByRole('img', { name: /Turning points/ }).length).toBeGreaterThan(0)
      expect(within(right()).queryAllByRole('img', { name: /Turning points/ })).toHaveLength(0)
      tapBox(within(workArea()).getByRole('textbox', { name: 'Increasing' }))
      expectDockedKeypad()
    },
    FLOW_TIMEOUT,
  )
})

describe('the phone layout below 840 px', () => {
  it.each([WINDOWS.upright, WINDOWS.phone])(
    '%i x %i: one column with the compact header, the composer docked at its end; the tools are bottom sheets',
    (width, height) => {
      setWindowSize(width, height)
      renderAt(problemPath('expLogEquations', 'ee.exponential', 24))
      expect(panes()).toBeNull()
      expect(screen.getByRole('link', { name: /^Close, back to/ })).toBeTruthy()
      const column = document.querySelector<HTMLElement>('[data-problem-column]')!
      const composer = screen.getByRole('textbox', { name: 'Next line' }).closest<HTMLElement>('[data-keypad-region]')!
      expect(column.lastElementChild).toBe(composer)
      expect(composer.className).toContain('composer-sticky')
      fireEvent.click(within(composer).getByRole('button', { name: 'Hints' }))
      expect(sheetKind(screen.getByRole('dialog', { name: 'Hints' }))).toBe('sheet')
      // The keypad covers the bottom of the screen (no dock in this layout).
      fireEvent.click(within(screen.getByRole('dialog', { name: 'Hints' })).getAllByRole('button', { name: 'Close' }).at(-1)!)
      tapBox(screen.getByRole('textbox', { name: 'Next line' }))
      expect(keypad().hasAttribute('data-docked')).toBe(false)
    },
    FLOW_TIMEOUT,
  )
})

describe('sheets are centred dialogs in the tablet layout', () => {
  function workOnAnotherProblem() {
    const other = generateProblem('inequalities', 'ineq.linear', 12345, {})
    const s = useStore.getState()
    s.startAttempt({ problemId: other.id, moduleId: 'inequalities', templateId: 'ineq.linear', skill: other.skill, seed: (12345).toString(36), difficulty: '', genVersion: other.genVersion })
    s.acceptStep({ text: other.canonical[0]!.text })
  }

  it.each([
    [WINDOWS.wide, 'dialog'],
    [WINDOWS.landscape, 'dialog'],
    [WINDOWS.upright, 'sheet'],
    [WINDOWS.phone, 'sheet'],
  ] as const)('%j: the leave question is a %s', ([width, height], kind) => {
    setWindowSize(width, height)
    workOnAnotherProblem()
    renderAt(problemPath('geoAngles', 'ga.bisector', 1))
    expect(sheetKind(screen.getByRole('dialog', { name: 'Unfinished problem' }))).toBe(kind)
  }, FLOW_TIMEOUT)

  it('the finish sheet (rewards on) at 1024 x 768: a centred dialog over her pane', { timeout: FLOW_TIMEOUT }, () => {
    setWindowSize(...WINDOWS.landscape)
    useStore.getState().setSettings({ rewards: true })
    const inst = generateProblem('numberLine', 'nl.read', 12345, {})
    if (inst.answer.type !== 'set') throw new Error('expected a set answer')
    renderAt(problemPath('numberLine', 'nl.read', 12345))
    fireEvent.change(screen.getByLabelText('Interval notation'), { target: { value: inst.answer.interval } })
    fireEvent.change(screen.getByLabelText('Set-builder notation'), { target: { value: inst.answer.setBuilder } })
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
    const finish = screen.getByRole('dialog', { name: 'Problem complete' })
    expect(sheetKind(finish)).toBe('dialog')
    expect(within(finish).getByRole('button', { name: 'Next problem' })).toBeTruthy()
    expect(queryKeypad()).toBeNull()
  })
})
