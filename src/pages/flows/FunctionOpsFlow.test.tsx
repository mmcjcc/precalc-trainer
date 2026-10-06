// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '../Problem'

const FLOW = 120_000

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function typeField(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function finals() {
  return useStore.getState().events.filter((e) => e.t === 'final_answer')
}

function problem(template: string, seed = 1) {
  const p = generateProblem('functionOps', template, seed)
  if (p.answer.type !== 'functionOps') throw new Error('type')
  return p
}

beforeEach(() => {
  resetStoreForTests()
})

describe('FunctionOpsFlow table', () => {
  it('names a mistake, restores the entry after a reload, then accepts the value', () => {
    const p = problem('ops.table')
    const a = p.answer.type === 'functionOps' ? p.answer : null
    if (!a) throw new Error('type')
    const view = renderAt(problemPath('functionOps', 'ops.table', p.seed))
    expect(screen.getByRole('table', { name: 'Values of f and g' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'x' })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: 'f(x)' })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: 'g(x)' })).toBeTruthy()
    expect(screen.queryByText(a.reveal[0]!)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Calculator' })).toBeNull()

    typeField('Value', a.trapAnswer)
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    const alert = screen.getByRole('alert')
    const info = ERROR_PATTERNS[a.trap as keyof typeof ERROR_PATTERNS]
    expect(alert.textContent).toContain(info.title)
    expect(alert.textContent).toContain('→')
    expect(finals()).toMatchObject([{ correct: false, pattern: a.trap, via: 'text' }])

    fireEvent.click(screen.getByRole('button', { name: 'Nudge me' }))
    expect(screen.getByText(a.nudge)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show the rule' }))

    view.unmount()
    expect(useStore.getState().attempt?.final?.fnEntries?.answer).toBe(a.trapAnswer)
    renderAt(problemPath('functionOps', 'ops.table', p.seed))
    expect((screen.getByLabelText('Value') as HTMLInputElement).value).toBe(a.trapAnswer)

    typeField('Value', a.answerText)
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(screen.getByText(a.reveal[0]!)).toBeTruthy()
    expect((screen.getByLabelText('Value') as HTMLInputElement).disabled).toBe(true)
    expect(finals()).toMatchObject([{ correct: false, pattern: a.trap }, { correct: true }])
    const done = useStore.getState().events.find((e) => e.t === 'problem_done')
    expect(done).toMatchObject({ finalCorrect: false, revealed: 0 })
  }, FLOW)

  it('an unreadable value records nothing', () => {
    const p = problem('ops.table', 2)
    renderAt(problemPath('functionOps', 'ops.table', p.seed))
    typeField('Value', '???')
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText(/doesn’t count as an attempt/)).toBeTruthy()
    expect(finals()).toEqual([])
    expect(screen.queryByRole('heading', { name: /Problem finished/ })).toBeNull()
  }, FLOW)

  it('the worked explanation marks the answer as shown', () => {
    const p = problem('ops.table', 4)
    const a = p.answer.type === 'functionOps' ? p.answer : null
    if (!a) throw new Error('type')
    renderAt(problemPath('functionOps', 'ops.table', p.seed))
    expect(screen.queryByText(a.reveal[0]!)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Nudge me' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show the rule' }))
    fireEvent.click(screen.getByRole('button', { name: /Explain the answer/ }))
    expect(screen.getByText(a.reveal[0]!)).toBeTruthy()
    expect(useStore.getState().attempt?.final?.revealed).toBe(true)
  }, FLOW)
})

describe('FunctionOpsFlow graphs', () => {
  it('shows both curves before she answers, names a mistake, restores the entry, then accepts the value', () => {
    const p = problem('ops.graph')
    const a = p.answer.type === 'functionOps' ? p.answer : null
    if (!a) throw new Error('type')
    const view = renderAt(problemPath('functionOps', 'ops.graph', p.seed))
    const graphs = screen.getAllByRole('img', { name: /Graphs of f and g/ })
    expect(graphs.length).toBeGreaterThan(0)
    expect(graphs[0]!.textContent).toContain('f')
    expect(graphs[0]!.textContent).toContain('g')
    expect(screen.queryByRole('button', { name: 'Show the graph' })).toBeNull()
    expect(screen.queryByText(a.reveal[0]!)).toBeNull()

    typeField('Value', a.trapAnswer)
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('alert').textContent).toContain(ERROR_PATTERNS[a.trap as keyof typeof ERROR_PATTERNS].title)
    expect(finals()).toMatchObject([{ correct: false, pattern: a.trap, via: 'text' }])

    view.unmount()
    expect(useStore.getState().attempt?.final?.fnEntries?.answer).toBe(a.trapAnswer)
    renderAt(problemPath('functionOps', 'ops.graph', p.seed))
    expect((screen.getByLabelText('Value') as HTMLInputElement).value).toBe(a.trapAnswer)

    typeField('Value', a.answerText)
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(finals()).toMatchObject([{ correct: false, pattern: a.trap }, { correct: true }])
  }, FLOW)

  it('an unreadable value records nothing', () => {
    const p = problem('ops.graph', 2)
    renderAt(problemPath('functionOps', 'ops.graph', p.seed))
    typeField('Value', '???')
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText(/doesn’t count as an attempt/)).toBeTruthy()
    expect(finals()).toEqual([])
  }, FLOW)
})

describe('FunctionOpsFlow formulas', () => {
  it('names a mistake, restores the formula after a reload, then accepts an equivalent formula', () => {
    const p = problem('ops.formula')
    const a = p.answer.type === 'functionOps' ? p.answer : null
    if (!a) throw new Error('type')
    const view = renderAt(problemPath('functionOps', 'ops.formula', p.seed))
    expect(screen.getByText(a.prompt)).toBeTruthy()
    expect(screen.queryByText(a.reveal[0]!)).toBeNull()
    expect(a.f!.includes(a.answerText)).toBe(false)
    expect(a.g!.includes(a.answerText)).toBe(false)
    expect(screen.queryByRole('button', { name: 'Show the graph' })).toBeNull()

    typeField('Formula', a.trapAnswer)
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('alert').textContent).toContain(ERROR_PATTERNS[a.trap as keyof typeof ERROR_PATTERNS].title)
    expect(finals()).toMatchObject([{ correct: false, pattern: a.trap, via: 'text' }])

    view.unmount()
    expect(useStore.getState().attempt?.final?.fnEntries?.answer).toBe(a.trapAnswer)
    renderAt(problemPath('functionOps', 'ops.formula', p.seed))
    expect((screen.getByLabelText('Formula') as HTMLInputElement).value).toBe(a.trapAnswer)

    typeField('Formula', a.answerText)
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(screen.getByText(a.reveal[0]!)).toBeTruthy()
    expect(finals()).toMatchObject([{ correct: false, pattern: a.trap }, { correct: true }])
  }, FLOW)

  it('an unreadable formula records nothing', () => {
    const p = problem('ops.formula', 2)
    renderAt(problemPath('functionOps', 'ops.formula', p.seed))
    typeField('Formula', '3x +')
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText(/doesn’t count as an attempt/)).toBeTruthy()
    expect(finals()).toEqual([])
  }, FLOW)
})
