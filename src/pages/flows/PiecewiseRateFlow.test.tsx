// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem } from '@/content'
import { averageRateMistakes, evaluatePiecewise, gradePiecewiseValue, toRational, type PiecewisePiece } from '@/engine'
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

function finals() {
  return useStore.getState().events.filter((e) => e.t === 'final_answer')
}

function piecesOf(pieces: { formula: string; lo: string; hi: string; loClosed: boolean; hiClosed: boolean }[]): PiecewisePiece[] {
  return pieces.map((p) => ({
    formula: p.formula,
    interval: {
      lo: p.lo === '-inf' ? '-inf' : toRational(p.lo)!,
      hi: p.hi === 'inf' ? 'inf' : toRational(p.hi)!,
      loClosed: p.loClosed,
      hiClosed: p.hiClosed,
    },
  }))
}

function boundaryExample() {
  for (let seed = 1; seed <= 300; seed++) {
    const p = generateProblem('piecewiseRate', 'pw.evaluate', seed)
    if (p.answer.type !== 'piecewiseRate' || p.answer.question !== 'evaluate' || p.answer.trap !== 'boundary-leq') continue
    const pieces = piecesOf(p.answer.pieces ?? [])
    for (const piece of p.answer.pieces ?? []) {
      const ev = evaluatePiecewise([{ formula: piece.formula, interval: { lo: '-inf', hi: 'inf', loClosed: false, hiClosed: false } }], p.answer.x!)
      if (!ev || !ev.defined || ev.text === p.answer.valueText) continue
      const g = gradePiecewiseValue(pieces, p.answer.x!, ev.text)
      if (g.verdict === 'mistake' && g.mistake === 'piecewise_boundary') {
        return { seed, wrong: ev.text, right: p.answer.valueText!, nudge: p.answer.nudge }
      }
    }
  }
  throw new Error('no boundary seed')
}

beforeEach(() => {
  resetStoreForTests()
})

describe('PiecewiseRateFlow', () => {
  it('names the boundary piece, restores the entry, then accepts the value', () => {
    const ex = boundaryExample()
    const view = renderAt(problemPath('piecewiseRate', 'pw.evaluate', ex.seed))
    expect(screen.getByRole('heading', { name: 'Evaluate the piecewise function' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show the graph' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Show calculator steps' })).toBeNull()

    fireEvent.change(screen.getByLabelText('Value of f(x)'), { target: { value: ex.wrong } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('A boundary belongs to the piece that includes it')
    expect(alert.textContent).toMatch(/→/)
    expect(finals()).toMatchObject([{ correct: false, pattern: 'pw_piecewise_boundary', via: 'text' }])

    fireEvent.click(screen.getByRole('button', { name: 'Nudge me' }))
    expect(screen.getByText(ex.nudge)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show the rule' }))
    const hints = screen.getByRole('heading', { name: 'Hints' }).closest('section')!
    expect(within(hints).getByText('A boundary belongs to ≤')).toBeTruthy()

    view.unmount()
    renderAt(problemPath('piecewiseRate', 'pw.evaluate', ex.seed))
    expect((screen.getByLabelText('Value of f(x)') as HTMLInputElement).value).toBe(ex.wrong)

    fireEvent.change(screen.getByLabelText('Value of f(x)'), { target: { value: ex.right } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(finals()).toMatchObject([{ correct: false, pattern: 'pw_piecewise_boundary' }, { correct: true }])
    const done = useStore.getState().events.find((e) => e.t === 'problem_done')
    expect(done).toMatchObject({ finalCorrect: false, revealed: 0 })
  }, 30_000)

  it('names a forgotten division on an average rate, then accepts the rate', () => {
    let example: { seed: number; wrong: string; right: string } | null = null
    for (let seed = 1; seed <= 40 && !example; seed++) {
      const p = generateProblem('piecewiseRate', 'arc.rate', seed)
      if (p.answer.type !== 'piecewiseRate' || !p.answer.f) continue
      const hit = averageRateMistakes(p.answer.f, p.answer.a!, p.answer.b!)?.find((m) => m.kind === 'rate_no_division')
      if (!hit || !p.answer.rateText) continue
      example = { seed, wrong: hit.text, right: p.answer.rateText }
    }
    if (!example) throw new Error('no rate seed')
    renderAt(problemPath('piecewiseRate', 'arc.rate', example.seed))
    expect(screen.getByRole('heading', { level: 1, name: 'Average rate of change' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show the graph' })).toBeNull()
    fireEvent.change(screen.getByLabelText('Average rate of change'), { target: { value: example.wrong } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('alert').textContent).toContain('Divide by the change in x')
    expect(finals()).toMatchObject([{ correct: false, pattern: 'rate_no_division', via: 'text' }])
    fireEvent.change(screen.getByLabelText('Average rate of change'), { target: { value: example.right } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
  }, 30_000)
})
