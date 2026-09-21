// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem } from '@/content'
import type { ProblemInstance } from '@/content/types'
import { mono, sum } from '@/content/modules/diffQuotient/text'
import { resetStoreForTests, useStore } from '@/store'
import { STORAGE_KEYS } from '@/store/storage'
import { problemPath } from '@/problem/url'
import ProblemPage from '../Problem'

// function-plot needs a real SVG layout engine; the secant sketch is plain SVG and renders as is.
vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
        <Route path="/" element={<p>home page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function submit(label: string, value: string, button: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: button }))
}

const fxh = (value: string) => submit('f(x + h) line', value, 'Check f(x + h)')
const next = (value: string) => submit('Next line', value, 'Check this step')

function findSeed(templateId: string, pred: (p: ProblemInstance) => boolean): ProblemInstance {
  for (let seed = 1; seed < 50_000; seed++) {
    const p = generateProblem('diffQuotient', templateId, seed)
    if (pred(p)) return p
  }
  throw new Error(`no seed for ${templateId}`)
}

const homework = findSeed('dq.linear', (p) => p.answer.type === 'diffQuotient' && p.answer.f === '5x - 2')
const quadratic = findSeed('dq.quadratic', (p) => p.params.shape === 'full' && Number(p.params.a) >= 2)

beforeEach(() => {
  resetStoreForTests()
  localStorage.clear()
})
afterEach(() => cleanup())

describe('difference quotient flow', { timeout: 30_000 }, () => {
  it('accepts her exact homework for f(x) = 5x − 2 line by line and completes with 5', () => {
    renderAt(problemPath('diffQuotient', 'dq.linear', homework.seed))
    expect(screen.getByRole('heading', { name: /Part 1/ })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /Part 2/ })).toBeNull()
    // The graph waits behind the reveal gate; there is no calculator panel at all.
    expect(screen.getByRole('button', { name: 'Show the graph' })).toBeTruthy()
    expect(screen.queryByRole('img', { name: /secant line/ })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Graph it' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Calculator' })).toBeNull()

    fxh('5(x+h) - 2')
    const part2 = screen.getByRole('heading', { name: /Part 2/ }).closest('section')!
    // The column starts from her f(x + h) with f(x) in parentheses, rendered like her worksheet line.
    expect(within(part2).getByText('start')).toBeTruthy()
    expect(part2.innerHTML).toContain('5\\left(x+h\\right)-2-\\left(5x-2\\right)')
    // No chip question for the substitution line.
    expect(screen.queryByText('Which property justified that step?')).toBeNull()

    next('(5x + 5h - 2 - (5x - 2))/h')
    expect(screen.getByText('Which property justified that step?')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: /distribute$/ }))
    expect(screen.getByText('Yes — distribute.')).toBeTruthy()
    expect(screen.getByText(/not finished yet: h is still in a denominator/)).toBeTruthy()

    next('(5x + 5h - 2 - 5x + 2)/h')
    next('5h/h')
    fireEvent.click(screen.getByRole('radio', { name: /combine like terms$/ }))
    expect(screen.getByText('Yes — combine like terms.')).toBeTruthy()
    next('5')
    expect(screen.getAllByText('accepted')).toHaveLength(5)
    expect(screen.queryByRole('alert')).toBeNull()
    // The last line's chip question comes first; skipping it finishes the problem.
    fireEvent.click(screen.getByRole('button', { name: /Skip/ }))

    expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    const answer = screen.getByRole('heading', { name: 'Answer' }).closest('section')!
    expect(within(answer).getByText(/h ≠ 0/)).toBeTruthy()
    expect(within(answer).getByText(/secant slope is the line's own slope: that is why the answer is 5/)).toBeTruthy()
    expect(useStore.getState().attempt).toBeNull()
    const done = useStore.getState().events.find((e) => e.t === 'problem_done')
    expect(done && done.t === 'problem_done' && done.finalCorrect).toBe(true)
    // The worked path stays on screen, and the secant sketch is no longer behind the gate.
    expect(screen.getAllByText('accepted')).toHaveLength(5)
    expect(screen.queryByRole('button', { name: 'Show the graph' })).toBeNull()
    const sketch = screen.getByRole('img', { name: /secant line through \(x, f\(x\)\) = \(1, 3\) and \(x \+ h, f\(x \+ h\)\) = \(3, 13\)/ })
    for (const label of ['x', 'x + h', 'f(x)', 'f(x + h)', 'h']) expect(within(sketch as unknown as HTMLElement).getAllByText(label).length).toBeGreaterThan(0)
    expect(screen.getByText(/slope = \(f\(3\) − f\(1\)\)\/2 = \(13 − 3\)\/2 = 5\./)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show calculator steps' })).toBeNull()
  })

  it('names the dropped parentheses, then takes the fix (quadratic)', () => {
    if (quadratic.answer.type !== 'diffQuotient') throw new Error('type')
    const a = Number(quadratic.params.a)
    const b = Number(quadratic.params.b)
    const c = Number(quadratic.params.c)
    renderAt(problemPath('diffQuotient', 'dq.quadratic', quadratic.seed))
    fxh(quadratic.canonical[0]!.text)
    const byStage = (stage: string) => quadratic.canonical.find((s) => s.stage === stage)!.text
    next(byStage('square expanded'))
    next(byStage('f(x + h) expanded'))
    expect(screen.getAllByText('accepted')).toHaveLength(3)

    // The minus reached only the first term of f(x).
    const expanded = [mono(a, 2), mono(2 * a, 1, 1), mono(a, 0, 2), mono(b, 1), mono(b, 0, 1), mono(c)]
    next(`(${sum([...expanded, mono(-a, 2), mono(b, 1), mono(c)])})/h`)
    const card = screen.getByRole('alert')
    expect(within(card).getByText(/The minus is part of the multiplier/)).toBeTruthy()
    expect(within(card).getByText(/The minus in front of f\(x\) changes the sign of EVERY term/)).toBeTruthy()
    expect(useStore.getState().attempt?.currentRejections).toBe(1)
    expect(useStore.getState().events.some((e) => e.t === 'step_rejected' && e.pattern === 'negative_not_distributed')).toBe(true)

    next(byStage('minus distributed'))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getAllByText('accepted')).toHaveLength(4)

    // Setting h = 0 at the end is named kindly, then the real answer finishes it.
    next(byStage('like terms combined'))
    next(sum([mono(2 * a, 1), mono(b)]))
    expect(within(screen.getByRole('alert')).getByText(/Keep the h/)).toBeTruthy()
    next(quadratic.answer.simplified)
    fireEvent.click(screen.getByRole('button', { name: /Skip/ }))
    expect(screen.getByRole('heading', { name: /Problem complete|Problem finished/ })).toBeTruthy()
  })

  it('restores both parts after a reload mid-problem', () => {
    const view = renderAt(problemPath('diffQuotient', 'dq.linear', homework.seed))
    fxh('5(x+h) - 2')
    next('(5x + 5h - 2 - (5x - 2))/h')
    expect(screen.getAllByText('accepted')).toHaveLength(2)
    const saved = localStorage.getItem(STORAGE_KEYS.attempt)
    expect(saved).toContain('5*(x+h)-2')
    view.unmount()

    // Reload: memory is gone, localStorage survives.
    useStore.setState({ attempt: null })
    localStorage.setItem(STORAGE_KEYS.attempt, saved!)
    useStore.persist.rehydrate()
    expect(useStore.getState().attempt?.steps).toHaveLength(2)

    renderAt(problemPath('diffQuotient', 'dq.linear', homework.seed))
    const part2 = screen.getByRole('heading', { name: /Part 2/ }).closest('section')!
    expect(within(part2).getAllByText('accepted')).toHaveLength(1)
    expect(screen.getAllByText('accepted')).toHaveLength(2)
    expect(screen.getByText(/stage 2 of 5/)).toBeTruthy()
    // Work continues from the restored line.
    next('(5x + 5h - 2 - 5x + 2)/h')
    expect(screen.getAllByText('accepted')).toHaveLength(3)
  })

  it('hints: nudge, rule card, then the next line flagged as revealed', () => {
    renderAt(problemPath('diffQuotient', 'dq.linear', homework.seed))
    fireEvent.click(screen.getByRole('button', { name: 'Nudge me' }))
    expect(screen.getByText(/Replace every x in 5x - 2 with \(x \+ h\)/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show the rule' }))
    expect(screen.getAllByText('Find f(x + h)').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /Show the step/ }))
    fireEvent.click(screen.getByRole('button', { name: /Use this line/ }))
    expect(screen.getByRole('heading', { name: /Part 2/ })).toBeTruthy()
    expect(screen.getAllByText('revealed')).toHaveLength(1)
    expect(useStore.getState().attempt?.steps[0]).toMatchObject({ revealed: true })
  })

  it('shows a counterexample with friendly numbers for an unexplained slip in part 1', () => {
    renderAt(problemPath('diffQuotient', 'dq.linear', homework.seed))
    fxh('5x + 5h + 2')
    const card = screen.getByRole('alert')
    expect(within(card).getByText('At x = 1, h = 1: f(x + h) = f(2) = 8, but your line gives 12.')).toBeTruthy()
    expect(screen.getByText(/That is not f\(x \+ h\)/)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /Part 2/ })).toBeNull()
  })
})
