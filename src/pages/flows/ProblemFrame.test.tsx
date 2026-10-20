// @vitest-environment jsdom
/**
 * The problem frame around every flow: what a wide screen keeps (today's header, no strip, no composer verdict,
 * no chips), the completion card in place of the completion toast, and "Copy link" outside the phone app only.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem, getModule, getTemplate } from '@/content'
import { installPointer, removePointer } from '@/components/keypadTesting'
import { useCompletion } from '@/problem/useAttempt'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage, { ProblemView } from '../Problem'
import { ReviewChromeProvider } from '../review/chrome'

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

/** An IntersectionObserver that reports the problem card as scrolled away as soon as it is watched. */
class GoneObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    const rect = { top: -400, bottom: -100 }
    this.callback([{ target, isIntersecting: false, boundingClientRect: rect } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
  disconnect() {}
  unobserve() {}
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

/** The number line problem, answered right: the quickest way to a completion card. */
function finishNumberLine() {
  const inst = generateProblem('numberLine', 'nl.read', 12345, {})
  if (inst.answer.type !== 'set') throw new Error('expected a set answer')
  renderAt(problemPath('numberLine', 'nl.read', 12345))
  type('Interval notation', inst.answer.interval)
  type('Set-builder notation', inst.answer.setBuilder)
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
  expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
}

const completionToasts = () => useStore.getState().toasts.filter((t) => /^Problem (complete|finished)$/.test(t.message))

beforeEach(() => {
  resetStoreForTests()
  vi.stubGlobal('IntersectionObserver', GoneObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete (window as { Capacitor?: unknown }).Capacitor
  removePointer()
})

/** Each test below renders a whole problem page: slow under a full parallel run. */
const PAGE_TIMEOUT = 120_000

describe('a wide screen keeps today’s problem page', () => {
  it('breadcrumb, title, instructions, the stage line and shortcuts; no strip, no composer verdict, no chips', { timeout: PAGE_TIMEOUT }, () => {
    const inst = generateProblem('inequalities', 'ineq.linear', 12345, {})
    renderAt(problemPath('inequalities', 'ineq.linear', 12345))
    expect(screen.getByRole('link', { name: getModule('inequalities').title })).toBeTruthy()
    expect(screen.getByText(new RegExp(`· ${getTemplate('inequalities', 'ineq.linear').title}`))).toBeTruthy()
    expect(screen.getByText(inst.instructions)).toBeTruthy()
    expect(screen.getByText(/^stage \d+ of \d+ · /).className).not.toContain('sr-only')
    expect(screen.getByRole('button', { name: 'shortcuts (?)' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /^Close, back to/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Show the problem/ })).toBeNull()
    fireEvent.change(screen.getByLabelText('Next line'), { target: { value: '3x < 9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check this step' }))
    expect(screen.getByText(/Not accepted/)).toBeTruthy()
    expect(document.querySelector('[data-composer-status]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Stuck?' })).toBeNull()
  })
})

describe('the completion card, not a toast', () => {
  it('a finished problem shows the card and no toast saying the same thing; a screen reader hears the toast’s words', { timeout: PAGE_TIMEOUT }, () => {
    finishNumberLine()
    expect(completionToasts()).toEqual([])
    expect(document.querySelector('[data-completion-card]')).toBeTruthy()
    const announcer = document.querySelector('[data-completion-announcer]')!
    expect(announcer.getAttribute('aria-live')).toBe('polite')
    expect(announcer.textContent).toBe('Problem complete. 0 hints')
  })

  it('where no card shows, the toast still says it', { timeout: PAGE_TIMEOUT }, () => {
    const inst = generateProblem('numberLine', 'nl.read', 12345, {})
    function NoCard() {
      const { completion, finish } = useCompletion(inst, 'Read the number line')
      return (
        <button type="button" onClick={finish}>
          {completion ? 'finished' : 'finish'}
        </button>
      )
    }
    useStore.getState().startAttempt({
      problemId: inst.id,
      moduleId: 'numberLine',
      templateId: 'nl.read',
      skill: inst.skill,
      seed: (12345).toString(36),
      difficulty: '',
      genVersion: inst.genVersion,
    })
    render(<NoCard />)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'finish' }))
    })
    expect(screen.getByRole('button', { name: 'finished' })).toBeTruthy()
    expect(completionToasts()).toHaveLength(1)
  })
})

describe('Copy link', () => {
  it('is there in the web app', { timeout: PAGE_TIMEOUT }, () => {
    finishNumberLine()
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy()
  })

  it('is not there inside the phone app, where a link to one of its pages opens nowhere else', { timeout: PAGE_TIMEOUT }, () => {
    window.Capacitor = { isNativePlatform: () => true }
    finishNumberLine()
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Next problem' })).toBeTruthy()
  })
})

describe('the review set on a phone', () => {
  it('keeps its own sticky bar at the top, so it gets no pinned strip', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    render(
      <MemoryRouter>
        <ReviewChromeProvider value={{ onNext: () => {}, onSkip: () => {} }}>
          <ProblemView moduleId="inequalities" templateId="ineq.linear" seed="9ix" />
        </ReviewChromeProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /^Close, back to/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Show the problem/ })).toBeNull()
  })

  it('a phone outside the review set pins the problem once its card is gone', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    renderAt(problemPath('inequalities', 'ineq.linear', 12345))
    expect(screen.getByRole('button', { name: /^Show the problem/ })).toBeTruthy()
  })
})
