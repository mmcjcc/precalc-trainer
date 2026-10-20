// @vitest-environment jsdom
/**
 * The problem screen on a phone (a touch screen below 768 px, the math keypad on): one problem of each kind
 * finished with the compact header, the pinned problem strip, the verdict where she is looking (the composer's
 * line with Why?, or the part's verdict with the Stuck? chip under it) and the leave sheet. jsdom has no layout:
 * IntersectionObserver is a fake the test drives, and scrolling is recorded, not done.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem, getModule } from '@/content'
import type { ProblemInstance } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { resetKeypadForTests } from '@/components/keypadStore'
import { installPointer, keypad, queryKeypad, removePointer, settle, tap, tapBox, typeOnKeypad } from '@/components/keypadTesting'
import { MathKeypad } from '@/components/MathKeypad'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '../Problem'

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

/** The verdict reveal after a keypad Check (its geometry is tested in verdictReveal.test.ts): count the calls. */
const reveal = vi.hoisted(() => ({ calls: 0 }))
vi.mock('./verdictReveal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./verdictReveal')>()
  return {
    ...actual,
    revealVerdictAboveKeypad: (strip: HTMLElement | null) => {
      reveal.calls++
      actual.revealVerdictAboveKeypad(strip)
    },
  }
})

const FLOW_TIMEOUT = 120_000

/** IntersectionObserver for jsdom: the test says when the problem card has scrolled out of view. */
class FakeIntersectionObserver {
  static live: FakeIntersectionObserver[] = []
  readonly targets = new Set<Element>()
  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
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

/** The gold problem card scrolls up out of view (out) or back into it. */
function scrollCard(out: boolean) {
  const rect = out ? { top: -420, bottom: -140 } : { top: 80, bottom: 300 }
  act(() => {
    for (const io of [...FakeIntersectionObserver.live]) {
      for (const target of io.targets) {
        const entry = { target, isIntersecting: !out, intersectionRatio: out ? 0 : 1, boundingClientRect: rect, intersectionRect: rect, rootBounds: null, time: 0 }
        io.callback([entry as unknown as IntersectionObserverEntry], io as unknown as IntersectionObserver)
      }
    }
  })
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MathKeypad />
      <Routes>
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
        <Route path="/m/:moduleId" element={<p>module page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
const textbox = (name: string) => screen.getByRole('textbox', { name }) as HTMLInputElement
const card = () => document.querySelector<HTMLElement>('.problem-card')!
const strip = () => screen.queryByRole('button', { name: /Show the (problem|figure)/ })
const dialog = (name: string | RegExp) => screen.queryByRole('dialog', { name })
const composerStatus = () => document.querySelector<HTMLElement>('[data-composer-status]')
const completionToast = () => useStore.getState().toasts.some((t) => /^Problem (complete|finished)$/.test(t.message))

/** Close the open sheet with its × button (the backdrop, also named Close, is outside the dialog). */
function closeSheet(name: string | RegExp) {
  fireEvent.click(within(dialog(name)!).getByRole('button', { name: 'Close' }))
}

/** Another problem with her work in it, so opening this one asks first. */
function workOnAnotherProblem(): ProblemInstance {
  const other = generateProblem('inequalities', 'ineq.linear', 12345, {})
  const s = useStore.getState()
  s.startAttempt({
    problemId: other.id,
    moduleId: 'inequalities',
    templateId: 'ineq.linear',
    skill: other.skill,
    seed: (12345).toString(36),
    difficulty: '',
    genVersion: other.genVersion,
  })
  s.acceptStep({ text: other.canonical[0]!.text })
  return other
}

/** The in-app sheet asks (no system dialog); nothing changes until she answers; Leave starts this problem. */
function leaveTheOtherProblem(other: ProblemInstance, here: ProblemInstance) {
  const sheet = dialog('Unfinished problem')
  expect(sheet).toBeTruthy()
  expect(sheet!.textContent).toContain('You have work on this problem. Leave it? It will count as unfinished.')
  // It names the problem it is about: the one with her work in it, not the page behind the sheet.
  expect(sheet!.textContent).toContain(getModule('inequalities').title)
  expect(sheet!.textContent).toContain(other.title)
  expect(useStore.getState().attempt?.problemId).toBe(other.id)
  fireEvent.click(within(sheet!).getByRole('button', { name: 'Leave' }))
  expect(dialog('Unfinished problem')).toBeNull()
  expect(events('problem_abandoned')).toHaveLength(1)
  expect(useStore.getState().attempt?.problemId).toBe(here.id)
}

/** One row: × back to the module page, the title, the progress dots. No breadcrumb, no visible "stage" line. */
function expectCompactHeader(p: ProblemInstance) {
  const mod = getModule(p.moduleId)
  const close = screen.getByRole('link', { name: `Close, back to ${mod.title}` })
  expect(close.getAttribute('href')).toBe(`/m/${p.moduleId}`)
  expect(close.textContent).toBe('×')
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(p.title)
  expect(screen.queryByRole('link', { name: mod.title })).toBeNull()
  expect(screen.queryByRole('button', { name: 'shortcuts (?)' })).toBeNull()
  const spoken = screen.getByText(/^stage \d+ of \d+ · /)
  expect(spoken.className).toContain('sr-only')
  const dots = Array.from(document.querySelectorAll('[data-dot]')).map((d) => d.getAttribute('data-dot'))
  expect(dots.length).toBeGreaterThan(0)
  expect(dots[0]).toBe('current')
  return dots
}

let scrollIntoView: ReturnType<typeof vi.fn>
const realScrollBy = window.scrollBy

beforeEach(() => {
  resetStoreForTests()
  resetKeypadForTests()
  installPointer(true)
  FakeIntersectionObserver.live = []
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  scrollIntoView = vi.fn()
  Element.prototype.scrollIntoView = scrollIntoView as unknown as Element['scrollIntoView']
  window.scrollBy = vi.fn() as unknown as typeof window.scrollBy
})

afterEach(() => {
  removePointer()
  vi.unstubAllGlobals()
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
  window.scrollBy = realScrollBy
})

describe('the problem screen on a phone', () => {
  it(
    'a line-by-line equation: 7^(x + 2) = 2^x with the verdict in the composer, Why?, Stuck? and the pinned problem',
    async () => {
      const p = generateProblem('expLogEquations', 'ee.exponential', 24)
      if (p.answer.type !== 'expLogEquations') throw new Error('ee.exponential')
      const other = workOnAnotherProblem()
      renderAt(problemPath('expLogEquations', 'ee.exponential', 24))
      leaveTheOtherProblem(other, p)

      // The header: one row, then the instructions as one line (they add to the title).
      expectCompactHeader(p)
      const instructions = document.querySelector('[data-instructions]')!
      expect(instructions.textContent).toBe('One line at a time, then write the solution in the answer box.')
      expect(instructions.className).toContain('truncate')
      fireEvent.click(instructions)
      expect(instructions.className).not.toContain('truncate')

      // The pinned problem: nothing while the card is on screen; the statement's math once it scrolls away.
      expect(strip()).toBeNull()
      scrollCard(true)
      const pinned = strip()!
      expect(pinned.getAttribute('aria-label')).toBe('Show the problem: 7^(x + 2) = 2^x')
      expect(pinned.querySelector('.katex')).toBeTruthy()
      // No keypad up: a tap scrolls back to the card.
      fireEvent.click(pinned)
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
      expect(scrollIntoView.mock.contexts.at(-1)).toBe(card())
      expect(document.activeElement).toBe(card())

      // With the keypad up the card opens in a sheet over her place, and the keypad comes back after.
      const line = textbox('Next line')
      tapBox(line)
      expect(keypad()).toBeTruthy()
      fireEvent.click(strip()!)
      expect(dialog('The problem')!.querySelector('.katex')).toBeTruthy()
      await settle()
      expect(queryKeypad()).toBeNull()
      closeSheet('The problem')
      expect(dialog('The problem')).toBeNull()
      expect(document.activeElement).toBe(line)
      expect(keypad()).toBeTruthy()
      scrollCard(false)
      expect(strip()).toBeNull()

      // A wrong line: the composer names the mistake right above her input.
      expect(composerStatus()!.textContent).toBe('Stuck?')
      typeOnKeypad('(x+2)ln(7) = ln(2')
      tap('check')
      const title = ERROR_PATTERNS.log_power_as_power.title
      const status = composerStatus()!
      expect(status.textContent).toContain(title)
      expect(status.textContent).toContain('log(aⁿ) = n · log a: the power moves to the front as a multiplier.')
      // The full card stays in the work list.
      expect(screen.getByRole('alert').textContent).toContain(`Not accepted: ${title}`)

      // Why? opens the whole lesson: the catalog lesson, the sentence about her line, the example.
      fireEvent.click(within(status).getByRole('button', { name: `Why? ${title}` }))
      const why = dialog(title)!
      expect(why.textContent).toContain('the power moves to the front as a multiplier')
      expect(why.textContent).toContain('Example:')
      await settle()
      closeSheet(title)
      expect(document.activeElement).toBe(line)
      expect(keypad()).toBeTruthy()

      // Stuck? opens the hint sheet with the next hint: the nudge, then the rule. The step itself waits for her tap.
      fireEvent.click(within(composerStatus()!).getByRole('button', { name: 'Stuck?' }))
      let hints = dialog('Hints')!
      expect(within(hints).getByText('Nudge')).toBeTruthy()
      expect(useStore.getState().attempt?.hintsUsed).toEqual({ '0': 1 })
      closeSheet('Hints')
      fireEvent.click(within(composerStatus()!).getByRole('button', { name: 'Stuck?' }))
      hints = dialog('Hints')!
      expect(useStore.getState().attempt?.hintsUsed).toEqual({ '0': 2 })
      closeSheet('Hints')
      fireEvent.click(within(composerStatus()!).getByRole('button', { name: 'Stuck?' }))
      hints = dialog('Hints')!
      expect(within(hints).getByRole('button', { name: /Show the step/ })).toBeTruthy()
      expect(useStore.getState().attempt?.hintsUsed).toEqual({ '0': 2 })
      closeSheet('Hints')
      expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()

      // A kept line.
      tapBox(line)
      fireEvent.change(line, { target: { value: '(x+2)log(7) = xlog(2)' } })
      tap('check')
      expect(composerStatus()!.textContent).toBe('✓ KeptStuck?')

      // The answer, then the completion card and no toast that says the same thing.
      const answer = textbox('Answer')
      tapBox(answer)
      typeOnKeypad('x = 2ln(7)/(ln(2) - ln(7))')
      tap('check')
      expect(events('problem_done')).toHaveLength(1)
      const done = screen.getByRole('heading', { name: /Problem (complete|finished)/ })
      expect(completionToast()).toBe(false)
      expect(scrollIntoView.mock.contexts.at(-1)).toBe(done.closest('section'))
      // A screen reader hears it in the words the toast used.
      expect(document.querySelector('[data-completion-announcer]')!.textContent).toMatch(/^Problem (complete|finished)\. 1 steps, \d first-try, \d+ hints?$/)
      expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy()
      expect(composerStatus()).toBeNull()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a parts flow: the features of an exponential, a named mistake with Stuck? under it, then every part',
    async () => {
      const p = generateProblem('expLogGraphs', 'eg.features', 3)
      if (p.answer.type !== 'expLogGraphs') throw new Error('eg.features')
      const other = workOnAnotherProblem()
      renderAt(problemPath('expLogGraphs', 'eg.features', 3))
      leaveTheOtherProblem(other, p)
      const dots = expectCompactHeader(p)
      expect(dots).toEqual(['current', 'todo', 'todo', 'todo', 'todo'])
      // Without a composer, the panel buttons come after the problem, not above it.
      const panels = screen.getByRole('group', { name: 'Side panels' })
      expect(within(panels).getByRole('button', { name: 'Hints' })).toBeTruthy()
      expect(card().compareDocumentPosition(panels) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

      scrollCard(true)
      expect(strip()!.getAttribute('aria-label')).toBe('Show the problem: f(x) = (1/4)^(x + 1) - 2')

      // A wrong domain: the verdict under the part's box, with the chip under it.
      const domain = textbox('Domain')
      tapBox(domain)
      typeOnKeypad('(-2, inf)')
      reveal.calls = 0
      tap('check')
      // Once the keypad has scrolled, the page brings the verdict under the box into view too.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200))
      })
      expect(reveal.calls).toBe(1)
      const verdict = screen.getByRole('alert')
      expect(verdict.textContent).toContain(ERROR_PATTERNS.exp_domain_range_swapped.title)
      const chip = screen.getByRole('button', { name: 'Stuck?' })
      expect(verdict.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      fireEvent.click(chip)
      expect(within(dialog('Hints')!).getByText('Nudge')).toBeTruthy()
      expect(useStore.getState().attempt?.hintsUsed).toEqual({ '0': 1 })
      closeSheet('Hints')

      // Every part, one after another.
      for (const part of p.answer.stages) {
        if (part.kind === 'choice') {
          const label = part.choices?.find((c) => c.value === part.answerText)?.label ?? part.answerText
          fireEvent.click(screen.getByRole('radio', { name: label }))
          fireEvent.click(screen.getByRole('button', { name: 'Check' }))
        } else {
          const box = textbox(part.label)
          tapBox(box)
          fireEvent.change(box, { target: { value: part.answerText } })
          tap('check')
        }
      }
      expect(events('problem_done')).toHaveLength(1)
      expect(screen.getByRole('heading', { name: /Problem (complete|finished)/ })).toBeTruthy()
      expect(Array.from(document.querySelectorAll('[data-dot]')).every((d) => d.getAttribute('data-dot') === 'done')).toBe(true)
      expect(completionToast()).toBe(false)
      // No more chip once the problem is done.
      expect(screen.queryByRole('button', { name: 'Stuck?' })).toBeNull()
    },
    FLOW_TIMEOUT,
  )

  it(
    'where the chip goes: beside the composer, not under its work-list card; under an even/odd column; never on closed hints',
    () => {
      // A composer flow: the work-list card stays as it is, the composer carries the chip.
      const inst = generateProblem('inequalities', 'ineq.linear', 12345, {})
      const ineq = renderAt(problemPath('inequalities', 'ineq.linear', 12345))
      fireEvent.change(textbox('Next line'), { target: { value: '3x < 9' } })
      fireEvent.click(screen.getByRole('button', { name: 'Check this step' }))
      expect(screen.getByRole('alert').textContent).toContain('Not accepted')
      expect(screen.getAllByRole('button', { name: 'Stuck?' })).toHaveLength(1)
      expect(composerStatus()!.contains(screen.getByRole('button', { name: 'Stuck?' }))).toBe(true)
      expect(within(composerStatus()!).getByRole('button', { name: /^Why\? / })).toBeTruthy()
      // A kept line, then Undo: the composer's line follows the step engine.
      fireEvent.change(textbox('Next line'), { target: { value: inst.canonical[0]!.text } })
      fireEvent.click(screen.getByRole('button', { name: 'Check this step' }))
      expect(composerStatus()!.textContent).toBe('✓ KeptStuck?')
      fireEvent.click(screen.getByRole('button', { name: 'Undo step 1' }))
      expect(composerStatus()!.textContent).toBe('Stuck?')
      // The final-answer card: the ladder is closed there, so no chip, even under a wrong answer.
      for (const step of inst.canonical) {
        fireEvent.change(textbox('Next line'), { target: { value: step.text } })
        fireEvent.click(screen.getByRole('button', { name: 'Check this step' }))
      }
      expect(screen.getByRole('heading', { name: 'Final answer' })).toBeTruthy()
      fireEvent.change(screen.getByLabelText('Interval notation'), { target: { value: '(-1000, 1000)' } })
      fireEvent.change(screen.getByLabelText('Set-builder notation'), { target: { value: '{x | -1000 < x < 1000}' } })
      fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
      expect(screen.queryByRole('button', { name: 'Stuck?' })).toBeNull()
      ineq.unmount()

      // Even/odd: two columns and no composer, so the chip sits under a rejected line.
      resetStoreForTests()
      renderAt(problemPath('evenOdd', 'evenOdd.poly', 777))
      fireEvent.change(textbox('f(−x) line'), { target: { value: 'x + 1' } })
      fireEvent.click(screen.getByRole('button', { name: 'Check f(−x)' }))
      const alert = screen.getByRole('alert')
      const chip = screen.getByRole('button', { name: 'Stuck?' })
      expect(alert.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      fireEvent.click(chip)
      expect(within(dialog('Hints')!).getByText('Nudge')).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a geometry problem: the figure behind "Show the figure", a wrong x with Stuck? under it, then the angle',
    async () => {
      const p = generateProblem('geoAngles', 'ga.bisector', 1)
      if (p.answer.type !== 'geometry') throw new Error('ga.bisector')
      const other = workOnAnotherProblem()
      renderAt(problemPath('geoAngles', 'ga.bisector', 1))
      leaveTheOtherProblem(other, p)
      expect(expectCompactHeader(p)).toEqual(['current', 'todo'])
      expect(document.querySelector('[data-instructions]')!.textContent).toBe('Type an exact value for each part.')

      // A figure problem pins its first sentence and offers the figure.
      expect(card().querySelector('[role="img"]')).toBeTruthy()
      scrollCard(true)
      const pinned = strip()!
      // Its first sentence: the next one starts with math (m∠ABD), so the givens come along.
      const first = 'BD bisects ∠ABC. m∠ABD = 4x + 6 and m∠DBC = 7x − 9.'
      expect(p.statementText.startsWith(first)).toBe(true)
      expect(pinned.textContent).toBe(`${first}Show the figure`)
      expect(pinned.getAttribute('aria-label')).toBe(`${first} Show the figure`)
      // With the keypad up, the figure opens in the sheet.
      const x = textbox('x')
      tapBox(x)
      fireEvent.click(pinned)
      expect(dialog('The problem')!.querySelector('[role="img"]')).toBeTruthy()
      await settle()
      closeSheet('The problem')
      expect(keypad()).toBeTruthy()

      // A wrong x: the plain verdict under the box, the chip under it.
      typeOnKeypad('3')
      tap('check')
      expect(screen.getByRole('alert').textContent).toContain('That is not x.')
      fireEvent.click(screen.getByRole('button', { name: 'Stuck?' }))
      expect(within(dialog('Hints')!).getByText('Nudge')).toBeTruthy()
      closeSheet('Hints')

      tapBox(x)
      fireEvent.change(x, { target: { value: '5' } })
      tap('check')
      expect(Array.from(document.querySelectorAll('[data-dot]')).map((d) => d.getAttribute('data-dot'))).toEqual(['done', 'current'])
      const angle = textbox('m∠ABC')
      expect(document.activeElement).toBe(angle)
      typeOnKeypad('52°')
      tap('check')
      expect(screen.getByRole('heading', { name: /Problem (complete|finished)/ })).toBeTruthy()
      expect(completionToast()).toBe(false)
    },
    FLOW_TIMEOUT,
  )
})
