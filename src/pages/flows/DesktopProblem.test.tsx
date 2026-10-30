// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '@/App'
import { generateProblem, SAT_PRACTICE_REVIEW_ID } from '@/content'
import { resetKeypadForTests } from '@/components/keypadStore'
import { resetWindowSize, setWindowSize, WINDOWS } from '@/components/layoutTesting'
import { MathKeypad } from '@/components/MathKeypad'
import { createReviewSession, saveReview } from '@/pages/review/session'
import ReviewPage from '@/pages/Review'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '../Problem'

const FLOW_TIMEOUT = 120_000

class QuietObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

function renderProblemAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MathKeypad />
      <Routes>
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
        <Route path="/review/:reviewId" element={<ReviewPage />} />
        <Route path="/m/:moduleId" element={<p>module page</p>} />
        <Route path="/" element={<p>Home page</p>} />
      </Routes>
    </MemoryRouter>,
  )
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

describe('desktop problem layout and worked example', () => {
  it(
    'at 1900x1050 spreads the problem page and docks Scratch and Example side by side beside the work column',
    async () => {
      setWindowSize(...WINDOWS.desktop, { coarse: false })
      useStore.getState().unlock()
      const path = problemPath('inequalities', 'ineq.linear', 42)
      render(
        <MemoryRouter initialEntries={[path]}>
          <AppShell />
        </MemoryRouter>,
      )

      const workPane = await screen.findByRole('region', { name: 'Your working' })
      const problemPane = screen.getByRole('region', { name: 'Problem and tools' })
      const main = document.getElementById('main')!
      expect(main.className).toContain('max-w-[88rem]')

      const panes = document.querySelector<HTMLElement>('[data-panes]')!
      expect(panes.hasAttribute('data-desktop-problem')).toBe(true)
      expect(panes.getAttribute('data-docked-count')).toBe('0')

      const toolbar = within(problemPane).getByRole('toolbar', { name: 'Problem tools' })
      const scratchBtn = within(toolbar).getByRole('button', { name: 'Scratch' })
      const exampleBtn = within(toolbar).getByRole('button', { name: 'Example' })

      fireEvent.click(scratchBtn)
      const scratchDocked = screen.getByRole('region', { name: 'Scratch pad' })
      expect(scratchDocked.getAttribute('data-docked-panel')).toBe('scratch')
      expect(panes.contains(scratchDocked)).toBe(true)
      expect(panes.contains(workPane)).toBe(true)
      expect(panes.getAttribute('data-docked-count')).toBe('1')

      fireEvent.click(exampleBtn)
      const exampleDocked = screen.getByRole('region', { name: 'Example — see one like it' })
      expect(exampleDocked.getAttribute('data-docked-panel')).toBe('example')
      expect(panes.contains(exampleDocked)).toBe(true)
      expect(panes.contains(scratchDocked)).toBe(true)
      expect(panes.contains(workPane)).toBe(true)
      expect(panes.getAttribute('data-docked-count')).toBe('2')
      expect(screen.queryByRole('dialog')).toBeNull()
    },
    FLOW_TIMEOUT,
  )

  it(
    'keeps WINDOWS.wide (1280x800) unchanged with the two-pane tablet layout and opens Example as a bottom sheet on a phone (375x812)',
    () => {
      setWindowSize(...WINDOWS.wide)
      const path = problemPath('inequalities', 'ineq.linear', 42)
      const { unmount } = renderProblemAt(path)

      const panes = document.querySelector<HTMLElement>('[data-panes]')!
      expect(panes.hasAttribute('data-desktop-problem')).toBe(false)
      const problemPane = screen.getByRole('region', { name: 'Problem and tools' })
      const tablist = within(problemPane).getByRole('tablist', { name: 'Problem tools' })
      expect(within(tablist).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Tools', 'Scratch pad'])
      expect(screen.getByRole('region', { name: 'Your working' })).toBeTruthy()
      unmount()

      setWindowSize(...WINDOWS.phone)
      renderProblemAt(path)
      expect(document.querySelector('[data-panes]')).toBeNull()
      const exampleBtn = screen.getByRole('button', { name: 'Example' })
      fireEvent.click(exampleBtn)
      const dialog = screen.getByRole('dialog', { name: 'Example — see one like it' })
      expect(dialog.closest('[data-sheet]')?.getAttribute('data-sheet')).toBe('sheet')
    },
    FLOW_TIMEOUT,
  )

  it(
    'reveals one line at a time on Next line tap with reasons, logs example_viewed, and leaves her attempt first-try and revealed untouched',
    () => {
      setWindowSize(...WINDOWS.desktop, { coarse: false })
      const inst = generateProblem('inequalities', 'ineq.distribute', 19)
      renderProblemAt(problemPath('inequalities', 'ineq.distribute', 19))

      const toolbar = screen.getByRole('toolbar', { name: 'Problem tools' })
      fireEvent.click(within(toolbar).getByRole('button', { name: 'Example' }))

      const exampleRegion = screen.getByRole('region', { name: 'Example — see one like it' })
      const siblingStatement = exampleRegion.querySelector('[data-example-statement-text]')?.textContent?.trim() ?? ''
      expect(siblingStatement.length).toBeGreaterThan(0)
      expect(siblingStatement).not.toBe(inst.statementText.trim())

      // Initially 0 walked steps are shown; only the start line is visible.
      expect(exampleRegion.querySelectorAll('[data-example-step]').length).toBe(0)
      const nextLineBtn = within(exampleRegion).getByRole('button', { name: 'Next line' })

      fireEvent.click(nextLineBtn)
      const step1 = exampleRegion.querySelectorAll('[data-example-step]')
      expect(step1.length).toBe(1)
      expect(step1[0]?.querySelector('[data-example-reason]')?.textContent?.trim().length).toBeGreaterThan(0)

      // Walk the remaining lines one at a time until the conclusion appears.
      for (let i = 0; i < 10; i++) {
        const btn = within(exampleRegion).queryByRole('button', { name: 'Next line' })
        if (!btn) break
        const before = exampleRegion.querySelectorAll('[data-example-step]').length
        fireEvent.click(btn)
        const after = exampleRegion.querySelectorAll('[data-example-step]').length
        expect(after).toBe(before + 1)
      }
      expect(exampleRegion.querySelector('[data-example-conclusion]')).toBeTruthy()

      // Verify example_viewed event was logged and her attempt state is untouched.
      const state = useStore.getState()
      const viewed = state.events.filter((e) => e.t === 'example_viewed')
      expect(viewed).toHaveLength(1)
      expect(viewed[0]).toMatchObject({
        t: 'example_viewed',
        skill: 'ineq.distribute',
        moduleId: 'inequalities',
      })
      expect(state.attempt?.hintsUsed).toEqual({})
      expect(state.attempt?.steps).toEqual([])
      expect(state.attempt?.final?.revealed).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )

  it(
    'renders parts-type examples with each part answer and hint reason',
    () => {
      setWindowSize(...WINDOWS.desktop, { coarse: false })
      const inst = generateProblem('expLogGraphs', 'eg.features', 11)
      renderProblemAt(problemPath('expLogGraphs', 'eg.features', 11))

      const toolbar = screen.getByRole('toolbar', { name: 'Problem tools' })
      fireEvent.click(within(toolbar).getByRole('button', { name: 'Example' }))

      const exampleRegion = screen.getByRole('region', { name: 'Example — see one like it' })
      const siblingStatement = exampleRegion.querySelector('[data-example-statement-text]')?.textContent?.trim() ?? ''
      expect(siblingStatement).not.toBe(inst.statementText.trim())

      const parts = exampleRegion.querySelectorAll('[data-example-part]')
      expect(parts.length).toBeGreaterThanOrEqual(4)
      for (const part of parts) {
        const ans = part.querySelector('[data-example-part-answer]')?.textContent?.trim() ?? ''
        const why = part.querySelector('[data-example-part-why]')?.textContent?.trim() ?? ''
        expect(ans.length).toBeGreaterThan(0)
        expect(why.length).toBeGreaterThan(0)
      }
    },
    FLOW_TIMEOUT,
  )

  it(
    'hides the Example button on uncovered types and while a timed SAT set is running',
    () => {
      setWindowSize(...WINDOWS.desktop, { coarse: false })
      const { unmount } = renderProblemAt(problemPath('quadratics', 'cs.form', 7))
      expect(screen.queryByRole('button', { name: 'Example' })).toBeNull()
      unmount()

      // Start a timed SAT review session and render /review/sat-practice
      useStore.getState().setSettings({ testMode: true })
      const session = createReviewSession(SAT_PRACTICE_REVIEW_ID, {
        count: 10,
        timed: true,
        testModeBefore: false,
      })
      saveReview(session)
      renderProblemAt(`/review/${SAT_PRACTICE_REVIEW_ID}`)
      expect(screen.getByTestId('sat-timer')).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Example' })).toBeNull()
    },
    FLOW_TIMEOUT,
  )
})
