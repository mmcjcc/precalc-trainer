// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { buildReviewSet } from '@/pages/review/buildReview'
import { loadReview, saveReview, type ReviewSession } from '@/pages/review/session'
import { ERROR_PATTERNS } from '@/engine'
import { resetStoreForTests, useStore, type Ev } from '@/store'
import { ReviewPage } from './Review'

const reviewSeed = vi.hoisted(() => ({ current: 1 }))

vi.mock('@/content/rng', async () => {
  const actual = await vi.importActual<typeof import('@/content/rng')>('@/content/rng')
  return { ...actual, randomSeed: () => reviewSeed.current }
})

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

function renderReview(initialPath = '/review/unit1') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
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
  localStorage.removeItem('pct.review.sat')
  localStorage.removeItem('pct.review.sat-algebra')
  localStorage.removeItem('pct.review.sat-advanced-math')
  localStorage.removeItem('pct.review.sat-data-analysis')
  localStorage.removeItem('pct.review.sat-geometry-trig')
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
    expect(await screen.findByText('Problem 1 of 12', {}, { timeout: 120000 })).toBeTruthy()
    // The problem view is lazy. "test mode" is rendered only after that chunk mounts and the attempt starts.
    expect(await screen.findByText(/test mode/, {}, { timeout: 120000 })).toBeTruthy()
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
  }, 120000)

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
    expect(await screen.findByLabelText('Interval notation', {}, { timeout: 120000 })).toBeTruthy()

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
  }, 120000)
})

describe('SAT practice set review', () => {
  it('offers 8, 12 or 22 problems, scales the timer from 35 minutes for 22, and never stops her when time is up', async () => {
    const view = renderReview('/review/sat')
    expect(screen.getByRole('heading', { name: 'SAT practice set' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '8' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '12' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '22', checked: true })).toBeTruthy()
    expect(screen.getByText(/35 minutes for 22 problems, as on the test\. The timer only shows/)).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: '12' }))
    expect(screen.getByText(/19 minutes for 12 problems/)).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: '8' }))
    expect(screen.getByText(/13 minutes for 8 problems, scaled from the test's 35 minutes for 22\. The timer/)).toBeTruthy()
    view.unmount()

    // Seed a timed 8-problem SAT session already past its 13-minute (780s) target, opening on numberLine.
    const built = buildReviewSet('sat', { count: 8, seed: 11, events: [] })
    const problems = built.problems.slice()
    problems[0] = { topicId: 'algebra:numberLine', moduleId: 'numberLine', templateId: 'nl.read', seed: 12345 }
    const expiredSession: ReviewSession = {
      version: 1,
      reviewId: 'sat',
      seed: built.seed,
      count: 8,
      timed: true,
      elapsedSecs: 2400, // 40:00, well past both 13:00 and 35:00
      problems,
      index: 0,
      attemptIds: problems.map(() => null),
      status: problems.map(() => 'pending'),
    }
    saveReview(expiredSession)

    renderReview('/review/sat')
    const timer = screen.getByRole('timer', { name: 'Set timer' })
    expect(timer.textContent).toMatch(/40:00 \/ 13:00/)
    expect(timer.textContent).toMatch(/never stops you/)
    // Even past the target time, the problem loads and she can answer and advance.
    expect(await screen.findByLabelText('Interval notation', {}, { timeout: 120000 })).toBeTruthy()
    const inst = generateProblem('numberLine', 'nl.read', 12345)
    if (inst.answer.type !== 'set') throw new Error('expected a set')
    fireEvent.change(screen.getByLabelText('Interval notation'), { target: { value: inst.answer.interval } })
    fireEvent.change(screen.getByLabelText('Set-builder notation'), { target: { value: inst.answer.setBuilder } })
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
    expect(await screen.findByRole('heading', { name: /Problem (finished|complete)/ })).toBeTruthy()
    fireEvent.click(within(bar()).getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Problem 2 of 8')).toBeTruthy()
  }, 120000)

  it('summarizes results by domain (problems, first-try rate, time), names the weakest domain, and lets her practice it', async () => {
    const problems = [
      { topicId: 'algebra:inequalities', moduleId: 'inequalities', templateId: 'ineq.linear', seed: 101 },
      { topicId: 'algebra:inverses', moduleId: 'inverses', templateId: 'inv.linear', seed: 102 },
      { topicId: 'advanced-math:quadratics', moduleId: 'quadratics', templateId: 'cs.vertex', seed: 103 },
      { topicId: 'data-analysis:geoRatios', moduleId: 'geoRatios', templateId: 'gr.proportion', seed: 104 },
      { topicId: 'geometry-trig:geoPythagorean', moduleId: 'geoPythagorean', templateId: 'py.side', seed: 105 },
    ]
    const events: Ev[] = [
      // Algebra: 2 problems, both right on first try, 35s total
      {
        t: 'problem_done',
        at: 1000,
        attemptId: 'att-alg-1',
        moduleId: 'inequalities',
        skill: 'ineq.linear',
        steps: 2,
        hints: 0,
        revealed: 0,
        finalCorrect: true,
        firstTryRate: 1,
        mode: 'normal',
        secs: 20,
      },
      {
        t: 'problem_done',
        at: 2000,
        attemptId: 'att-alg-2',
        moduleId: 'inverses',
        skill: 'inv.linear',
        steps: 2,
        hints: 0,
        revealed: 0,
        finalCorrect: true,
        firstTryRate: 1,
        mode: 'normal',
        secs: 15,
      },
      // Advanced Math: 1 problem, right on first try, 25s
      {
        t: 'problem_done',
        at: 3000,
        attemptId: 'att-adv-1',
        moduleId: 'quadratics',
        skill: 'cs.vertex',
        steps: 1,
        hints: 0,
        revealed: 0,
        finalCorrect: true,
        firstTryRate: 1,
        mode: 'normal',
        secs: 25,
      },
      // Data Analysis: 1 problem, missed first try (firstTryRate 0.5), 75s
      {
        t: 'problem_done',
        at: 4000,
        attemptId: 'att-psda-1',
        moduleId: 'geoRatios',
        skill: 'gr.proportion',
        steps: 2,
        hints: 0,
        revealed: 0,
        finalCorrect: true,
        firstTryRate: 0.5,
        mode: 'normal',
        secs: 75,
      },
      // Geometry and Trigonometry: 1 problem, right on first try, 30s
      {
        t: 'problem_done',
        at: 5000,
        attemptId: 'att-geo-1',
        moduleId: 'geoPythagorean',
        skill: 'py.side',
        steps: 1,
        hints: 0,
        revealed: 0,
        finalCorrect: true,
        firstTryRate: 1,
        mode: 'normal',
        secs: 30,
      },
    ]
    useStore.setState({ events })

    const finishedSession: ReviewSession = {
      version: 1,
      reviewId: 'sat',
      seed: 99,
      count: problems.length,
      timed: false,
      problems,
      index: problems.length, // at summary
      attemptIds: ['att-alg-1', 'att-alg-2', 'att-adv-1', 'att-psda-1', 'att-geo-1'],
      status: ['done', 'done', 'done', 'done', 'done'],
    }
    saveReview(finishedSession)

    renderReview('/review/sat')
    expect(screen.getByRole('heading', { name: 'Results by domain' })).toBeTruthy()

    const algRow = document.querySelector<HTMLElement>('[data-domain-result="algebra"]')!
    expect(algRow.textContent).toMatch(/Algebra/)
    expect(algRow.textContent).toMatch(/2 problems/)
    expect(algRow.textContent).toMatch(/2 of 2 right on the first try \(100%\)/)
    expect(algRow.textContent).toMatch(/Time: 35s/)

    const psdaRow = document.querySelector<HTMLElement>('[data-domain-result="data-analysis"]')!
    expect(psdaRow.textContent).toMatch(/Problem-Solving and Data Analysis/)
    expect(psdaRow.textContent).toMatch(/1 problem/)
    expect(psdaRow.textContent).toMatch(/0 of 1 right on the first try \(0%\)/)
    expect(psdaRow.textContent).toMatch(/Time: 1m 15s/)

    const weakestBox = document.querySelector<HTMLElement>('[data-weakest-domain]')!
    expect(weakestBox.getAttribute('data-weakest-domain')).toBe('data-analysis')
    expect(weakestBox.textContent).toMatch(/Weakest domain:\s*Problem-Solving and Data Analysis/)

    const practiceBtn = within(weakestBox).getByRole('button', {
      name: 'Practice Problem-Solving and Data Analysis',
    })
    fireEvent.click(practiceBtn)

    // Clicking the button opens an 8-problem set for that domain.
    expect(await screen.findByText('Problem 1 of 8', {}, { timeout: 120000 })).toBeTruthy()
    expect(loadReview('sat-data-analysis')?.count).toBe(8)
  }, 120000)
})
