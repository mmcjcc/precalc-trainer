// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem } from '@/content'
import { domainMistakes, rangeMistakes } from '@/engine'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '../Problem'

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

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

function domainExample() {
  for (let seed = 1; seed <= 300; seed++) {
    const p = generateProblem('domainRange', 'dr.domain', seed)
    if (p.answer.type !== 'domainRange' || p.answer.trap !== 'denominator') continue
    const hit = domainMistakes(p.answer.f)?.find((m) => m.kind === 'domain_forgot_denominator')
    if (!hit) continue
    return { seed, wrong: hit.interval, right: p.answer.interval, nudge: p.answer.nudge, witness: hit.witness }
  }
  throw new Error('no denominator seed')
}

function rangeExample() {
  for (let seed = 1; seed <= 300; seed++) {
    const p = generateProblem('domainRange', 'dr.range', seed)
    if (p.answer.type !== 'domainRange' || p.answer.trap !== 'reciprocal') continue
    const hit = rangeMistakes(p.answer.f)?.find((m) => m.kind === 'range_included_asymptote')
    if (!hit) continue
    return { seed, wrong: hit.interval, right: p.answer.interval }
  }
  throw new Error('no reciprocal seed')
}

beforeEach(() => {
  resetStoreForTests()
})

describe('DomainRangeFlow', () => {
  it('names a dropped denominator, keeps the entry across a reload, then accepts the fix', () => {
    const ex = domainExample()
    const view = renderAt(problemPath('domainRange', 'dr.domain', ex.seed))
    expect(screen.getByRole('heading', { name: 'Find the domain of f' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Show the graph' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Calculator' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Show calculator steps' })).toBeNull()

    typeField('Domain', ex.wrong)
    expect(screen.getByText(/^reads as /)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('A denominator can never be 0')
    expect(alert.textContent).toContain('denominator')
    expect(alert.textContent).toMatch(/→/)
    expect(finals()).toMatchObject([{ correct: false, pattern: 'fn_domain_forgot_denominator', via: 'text' }])

    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(finals()).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Nudge me' }))
    expect(screen.getByText(ex.nudge)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show the rule' }))
    const hints = screen.getByRole('heading', { name: 'Hints' }).closest('section')!
    expect(within(hints).getByText('A denominator cannot be 0')).toBeTruthy()

    view.unmount()
    expect(useStore.getState().attempt?.final?.fnEntries?.answer).toBe(ex.wrong)
    renderAt(problemPath('domainRange', 'dr.domain', ex.seed))
    expect((screen.getByLabelText('Domain') as HTMLInputElement).value).toBe(ex.wrong)

    typeField('Domain', ex.right)
    expect(screen.getByText(/^reads as /).textContent).toMatch(/reads as /)
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(screen.getByText(/Domain:/)).toBeTruthy()
    expect((screen.getByLabelText('Domain') as HTMLInputElement).disabled).toBe(true)
    expect(finals()).toMatchObject([{ correct: false, pattern: 'fn_domain_forgot_denominator' }, { correct: true }])
    const done = useStore.getState().events.find((e) => e.t === 'problem_done')
    expect(done).toMatchObject({ finalCorrect: false, revealed: 0 })
  }, 30_000)

  it('a range answer reads back in y, and keeping the asymptote is named', () => {
    const ex = rangeExample()
    renderAt(problemPath('domainRange', 'dr.range', ex.seed))
    expect(screen.getByRole('heading', { name: 'Find the range of f' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Calculator' })).toBeNull()

    typeField('Range', ex.wrong)
    const preview = screen.getByText(/^reads as /).textContent ?? ''
    expect(preview.startsWith('reads as ')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('alert').textContent).toContain('The asymptote value is not an output')
    expect(finals()).toMatchObject([{ correct: false, pattern: 'fn_range_included_asymptote', via: 'text' }])

    typeField('Range', ex.right)
    expect(screen.getByText(/^reads as /).textContent).toMatch(/except/)
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(screen.getByText(/Range:/)).toBeTruthy()
  }, 30_000)
})
