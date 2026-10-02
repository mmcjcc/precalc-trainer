// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { buildReviewSet } from '@/pages/review/buildReview'
import { loadReview } from '@/pages/review/session'
import { ERROR_PATTERNS } from '@/engine'
import { resetStoreForTests, useStore } from '@/store'
import { ReviewPage } from './Review'

const reviewSeed = vi.hoisted(() => ({ current: 1 }))

vi.mock('@/content/rng', async () => {
  const actual = await vi.importActual<typeof import('@/content/rng')>('@/content/rng')
  return { ...actual, randomSeed: () => reviewSeed.current }
})

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

function renderReview() {
  return render(
    <MemoryRouter initialEntries={['/review/unit1']}>
      <Routes>
        <Route path="/review/:reviewId" element={<ReviewPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** A seed whose 8-problem set opens on the number line, so the flow test can finish problem 1. */
function seedOpeningOnNumberLine(): number {
  for (let seed = 1; seed < 500; seed++) {
    const set = buildReviewSet('unit1', { count: 8, seed, events: [] })
    if (set.problems[0]?.templateId === 'nl.read') return seed
  }
  throw new Error('no review seed opens on the number line')
}

function bar() {
  return screen.getByText(/Problem \d+ of \d+/).closest('div')!
}

/** The problem view is lazy and transforms on first use; the OneDrive disk is slow. */
beforeAll(async () => {
  await import('./Problem')
}, 120000)

beforeEach(() => {
  resetStoreForTests()
  localStorage.removeItem('pct.review.unit1')
  reviewSeed.current = 1
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  // jsdom logs "Not implemented" instead of throwing, so the page's try/catch does not catch it.
  window.scrollTo = () => {}
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Unit 1 review', () => {
  it('starts a timed set in test mode', async () => {
    renderReview()
    fireEvent.click(screen.getByRole('switch', { name: 'Timed' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start the set' }))
    expect(await screen.findByText('Problem 1 of 12', {}, { timeout: 20000 })).toBeTruthy()
    // The problem view is lazy. "test mode" is rendered only after that chunk mounts and the attempt starts.
    expect(await screen.findByText(/test mode/, {}, { timeout: 20000 })).toBeTruthy()
    expect(useStore.getState().attempt?.mode).toBe('timed')
    expect(useStore.getState().settings.testMode).toBe(true)
    expect(loadReview('unit1')?.timed).toBe(true)

    // Test mode was off before the set, so it goes back off when the set ends.
    for (let n = 1; n <= 12; n++) {
      expect(screen.getByText(`Problem ${n} of 12`)).toBeTruthy()
      fireEvent.click(within(bar()).getByRole('button', { name: 'Skip' }))
    }
    expect(screen.getByRole('button', { name: 'Start another set' })).toBeTruthy()
    expect(useStore.getState().settings.testMode).toBe(false)
  }, 60000)

  it('drops a saved set that names a template which no longer exists', () => {
    const built = buildReviewSet('unit1', { count: 8, seed: 7, events: [] })
    const problems = built.problems.map((p, i) => (i === 3 ? { ...p, templateId: 'gone.template' } : p))
    localStorage.setItem(
      'pct.review.unit1',
      JSON.stringify({
        version: 1,
        reviewId: 'unit1',
        seed: built.seed,
        count: problems.length,
        timed: false,
        problems,
        index: 3,
        attemptIds: problems.map(() => null),
        status: problems.map(() => 'pending'),
      }),
    )
    expect(loadReview('unit1')).toBeNull()
    renderReview()
    expect(screen.getByRole('button', { name: 'Start the set' })).toBeTruthy()
  })

  it('finishes a problem, restores the place after a reload, skips, and summarizes the mistake', async () => {
    reviewSeed.current = seedOpeningOnNumberLine()
    const first = renderReview()
    fireEvent.click(screen.getByRole('radio', { name: '8' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start the set' }))
    expect(await screen.findByLabelText('Interval notation', {}, { timeout: 20000 })).toBeTruthy()

    const saved = loadReview('unit1')
    expect(saved?.problems[0]?.templateId).toBe('nl.read')
    const inst = generateProblem('numberLine', 'nl.read', saved!.problems[0]!.seed)
    if (inst.answer.type !== 'set') throw new Error('expected a set')

    fireEvent.change(screen.getByLabelText('Interval notation'), { target: { value: '[-inf, 2)' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
    await waitFor(() => {
      const hit = useStore.getState().events.some((e) => e.t === 'final_answer' && e.pattern === 'infinity_bracket')
      expect(hit).toBe(true)
    })

    fireEvent.change(screen.getByLabelText('Interval notation'), { target: { value: inst.answer.interval } })
    fireEvent.change(screen.getByLabelText('Set-builder notation'), { target: { value: inst.answer.setBuilder } })
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
    expect(await screen.findByRole('heading', { name: /Problem (finished|complete)/ })).toBeTruthy()

    fireEvent.click(within(bar()).getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Problem 2 of 8')).toBeTruthy()

    first.unmount()
    renderReview()
    expect(screen.getByText('Problem 2 of 8')).toBeTruthy()
    expect(loadReview('unit1')?.index).toBe(1)

    for (let n = 2; n <= 8; n++) {
      expect(screen.getByText(`Problem ${n} of 8`)).toBeTruthy()
      fireEvent.click(within(bar()).getByRole('button', { name: 'Skip' }))
    }

    expect(screen.getByText(ERROR_PATTERNS.infinity_bracket.title)).toBeTruthy()
    expect(screen.getByText('0 of 1 right on the first try')).toBeTruthy()
    const practice = screen.getByRole('link', { name: `Practice ${getModule('numberLine').title}` })
    expect(practice.getAttribute('href')).toBe('/m/numberLine')
    expect(screen.getByRole('button', { name: 'Start another set' })).toBeTruthy()
  }, 60000)
})
