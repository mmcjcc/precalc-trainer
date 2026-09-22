// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem } from '@/content'
import { compositionMistakes, gradeCompositeDomain } from '@/engine'
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

function exprExample() {
  for (let seed = 1; seed <= 300; seed++) {
    const p = generateProblem('composition', 'comp.expr', seed)
    if (p.answer.type !== 'composition') continue
    const hit = compositionMistakes(p.answer.f, p.answer.g)?.find((m) => m.kind === 'compose_no_parens')
    if (!hit || !p.answer.simplified) continue
    return { seed, wrong: hit.text, right: p.answer.simplified, nudge: p.answer.nudge, f: p.answer.f, g: p.answer.g }
  }
  throw new Error('no parentheses seed')
}

function domainExample() {
  for (let seed = 1; seed <= 300; seed++) {
    const p = generateProblem('composition', 'comp.domain', seed)
    if (p.answer.type !== 'composition') continue
    if (p.answer.f === 'x^2' && p.answer.g === 'sqrt(x)' && p.answer.interval) {
      return { seed, right: p.answer.interval }
    }
  }
  throw new Error('no x^2 ∘ sqrt(x) seed')
}

beforeEach(() => {
  resetStoreForTests()
})

describe('CompositionFlow', () => {
  it('names a missing pair of parentheses, restores the formula after a reload, then accepts the simplified form', () => {
    const ex = exprExample()
    expect(ex.f).toMatch(/x\^2/)
    const view = renderAt(problemPath('composition', 'comp.expr', ex.seed))
    expect(screen.getByRole('heading', { name: 'Find (f ∘ g)(x)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Show the graph' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Calculator' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Show calculator steps' })).toBeNull()

    typeField('Composite formula', ex.wrong)
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Put the inside function in parentheses')
    expect(alert.textContent).toMatch(/→/)
    expect(finals()).toMatchObject([{ correct: false, pattern: 'fn_compose_no_parens', via: 'text' }])

    fireEvent.click(screen.getByRole('button', { name: 'Nudge me' }))
    expect(screen.getByText(ex.nudge)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show the rule' }))
    const hints = screen.getByRole('heading', { name: 'Hints' }).closest('section')!
    expect(within(hints).getByText('Put the inside function in parentheses')).toBeTruthy()

    view.unmount()
    expect(useStore.getState().attempt?.final?.fnEntries?.answer).toBe(ex.wrong)
    renderAt(problemPath('composition', 'comp.expr', ex.seed))
    expect((screen.getByLabelText('Composite formula') as HTMLInputElement).value).toBe(ex.wrong)

    typeField('Composite formula', ex.right)
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(screen.getByText(/Simplified:/)).toBeTruthy()
    expect((screen.getByLabelText('Composite formula') as HTMLInputElement).disabled).toBe(true)
    expect(finals()).toMatchObject([{ correct: false, pattern: 'fn_compose_no_parens' }, { correct: true }])
    const done = useStore.getState().events.find((e) => e.t === 'problem_done')
    expect(done).toMatchObject({ finalCorrect: false, revealed: 0 })
  }, 30_000)

  it('the sqrt-then-square domain is not all real numbers, and that mistake is named', () => {
    const ex = domainExample()
    const wrong = '(-inf, inf)'
    const graded = generateProblem('composition', 'comp.domain', ex.seed)
    if (graded.answer.type !== 'composition') throw new Error('type')
    expect(gradeCompositeDomain(graded.answer.f, graded.answer.g, wrong).verdict).toBe('mistake')

    renderAt(problemPath('composition', 'comp.domain', ex.seed))
    expect(screen.getByRole('heading', { name: 'Find the domain of f ∘ g' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Show the graph' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Calculator' })).toBeNull()

    typeField('Domain of f o g', wrong)
    expect(screen.getByText('reads as all real numbers')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('alert').textContent).toContain('Simplifying can hide a restriction')
    expect(finals()).toMatchObject([{ correct: false, pattern: 'fn_composite_domain_simplified', via: 'text' }])

    typeField('Domain of f o g', ex.right)
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(screen.getByText(/Domain of f∘g:/)).toBeTruthy()
  }, 30_000)
})
