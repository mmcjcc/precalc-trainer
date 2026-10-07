// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem } from '@/content'
import { ERROR_PATTERNS, averageRateMistakes, evaluatePiecewise, gradePiecewiseValue, toRational, type PiecewisePiece } from '@/engine'
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
  }, 120_000)

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
  }, 120_000)
})

const FLOW = 120_000

function more(template: string, seed: number) {
  const p = generateProblem('piecewiseRate', template, seed)
  if (p.answer.type !== 'piecewiseRate' || !p.answer.parts) throw new Error(template)
  return { p, a: p.answer }
}

function clickCheck() {
  const buttons = screen.getAllByRole('button', { name: 'Check' }).filter((b) => !(b as HTMLButtonElement).disabled)
  fireEvent.click(buttons[buttons.length - 1]!)
}

function typeField(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function dotKinds() {
  return {
    open: document.querySelectorAll('[data-dot="open"]').length,
    closed: document.querySelectorAll('[data-dot="closed"]').length,
  }
}

function expectDots() {
  const dots = dotKinds()
  expect(dots.open).toBeGreaterThan(0)
  expect(dots.closed).toBeGreaterThan(0)
}

function fillRows(rows: { formula: string; condition: string }[]) {
  let have = screen.getAllByLabelText(/Formula for piece/).length
  while (have < rows.length) {
    fireEvent.click(screen.getByRole('button', { name: 'Add a piece' }))
    have++
  }
  rows.forEach((row, i) => {
    typeField(`Formula for piece ${i + 1}`, row.formula)
    typeField(`Interval for piece ${i + 1}`, row.condition)
  })
}

describe('PiecewiseRateFlow graph', () => {
  it('shows open and closed dots, names the trap, restores the entry, then accepts the value', () => {
    const { p, a } = more('pw.graph', 1)
    const ask = a.asks![0]!
    const view = renderAt(problemPath('piecewiseRate', 'pw.graph', p.seed))
    expect(screen.getByRole('heading', { name: 'Read a piecewise graph' })).toBeTruthy()
    expect(screen.getByText(a.prompt!)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show the graph' })).toBeNull()
    expect(screen.queryByText(a.reveal[0]!)).toBeNull()
    expectDots()
    expect((screen.getByLabelText(a.parts![0]!.label) as HTMLInputElement).value).toBe('')

    typeField(a.parts![0]!.label, ask.trapText!)
    clickCheck()
    expect(screen.getByRole('alert').textContent).toContain(ERROR_PATTERNS[a.trap as keyof typeof ERROR_PATTERNS].title)
    expect(finals()).toMatchObject([{ correct: false, pattern: a.trap, via: 'text' }])

    view.unmount()
    renderAt(problemPath('piecewiseRate', 'pw.graph', p.seed))
    expect((screen.getByLabelText(a.parts![0]!.label) as HTMLInputElement).value).toBe(ask.trapText)

    typeField(a.parts![0]!.label, ask.valueText)
    clickCheck()
    for (const extra of (a.asks ?? []).slice(1)) {
      typeField(`f(${extra.x})`, extra.valueText)
      clickCheck()
    }
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(screen.getByText(a.reveal[0]!)).toBeTruthy()
    const done = useStore.getState().events.find((e) => e.t === 'problem_done')
    expect(done).toMatchObject({ finalCorrect: false, revealed: 0 })
  }, FLOW)

  it('an unreadable value records nothing', () => {
    const { p, a } = more('pw.graph', 2)
    renderAt(problemPath('piecewiseRate', 'pw.graph', p.seed))
    typeField(a.parts![0]!.label, '???')
    clickCheck()
    expect(screen.getByText(/doesn’t count as an attempt/)).toBeTruthy()
    expect(finals()).toEqual([])
  }, FLOW)

  it('the worked explanation marks the answer as shown', () => {
    const { p, a } = more('pw.graph', 4)
    renderAt(problemPath('piecewiseRate', 'pw.graph', p.seed))
    expect(screen.queryByText(a.reveal[0]!)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Nudge me' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show the rule' }))
    fireEvent.click(screen.getByRole('button', { name: /Explain the answer/ }))
    expect(screen.getByText(a.reveal[0]!)).toBeTruthy()
    expect(useStore.getState().attempt?.final?.revealed).toBe(true)
    expect(useStore.getState().attempt?.final?.firstCorrect).toBe(false)
  }, FLOW)
})

describe('PiecewiseRateFlow domain', () => {
  it('names a closed end, restores the interval, then accepts domain and range', () => {
    const { p, a } = more('pw.domain', 1)
    const trap = a.traps!.find((t) => t.id === a.trap)!
    const view = renderAt(problemPath('piecewiseRate', 'pw.domain', p.seed))
    expect(screen.getByText(a.prompt!)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show the graph' })).toBeNull()
    expect(screen.queryByText(a.domainText!)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'The graph of f' })).toBeNull()
    expect(dotKinds()).toEqual({ open: 0, closed: 0 })

    typeField('Domain', trap.text!)
    clickCheck()
    expect(screen.getByRole('alert').textContent).toContain(ERROR_PATTERNS[a.trap as keyof typeof ERROR_PATTERNS].title)
    expect(finals()).toMatchObject([{ correct: false, pattern: a.trap, via: 'text' }])

    view.unmount()
    renderAt(problemPath('piecewiseRate', 'pw.domain', p.seed))
    expect((screen.getByLabelText('Domain') as HTMLInputElement).value).toBe(trap.text)

    typeField('Domain', a.domainText!)
    clickCheck()
    typeField('Range', a.rangeText!)
    clickCheck()
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'The graph of f' })).toBeNull()
    const done = useStore.getState().events.find((e) => e.t === 'problem_done')
    expect(done).toMatchObject({ finalCorrect: false, revealed: 0 })
  }, FLOW)

  it('draws the graph only after she finishes, with open and closed dots', () => {
    const { p, a } = more('pw.domain', 2)
    const trap = a.traps!.find((t) => t.id === a.trap)!
    const view = renderAt(problemPath('piecewiseRate', 'pw.domain', p.seed))
    expect(screen.queryByRole('heading', { name: 'The graph of f' })).toBeNull()
    expect(dotKinds()).toEqual({ open: 0, closed: 0 })
    typeField('Domain', a.domainText!)
    clickCheck()
    typeField('Range', trap.text!)
    clickCheck()
    expect(finals().some((e) => e.t === 'final_answer' && e.pattern === a.trap)).toBe(true)

    view.unmount()
    renderAt(problemPath('piecewiseRate', 'pw.domain', p.seed))
    expect((screen.getByLabelText('Domain') as HTMLInputElement).value).toBe(a.domainText)
    expect((screen.getByLabelText('Range') as HTMLInputElement).value).toBe(trap.text)

    typeField('Range', a.rangeText!)
    clickCheck()
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'The graph of f' })).toBeTruthy()
    expectDots()
  }, FLOW)

  it('an unreadable interval records nothing', () => {
    const { p } = more('pw.domain', 3)
    renderAt(problemPath('piecewiseRate', 'pw.domain', p.seed))
    typeField('Domain', 'nope')
    clickCheck()
    expect(screen.getByText(/doesn’t count as an attempt/)).toBeTruthy()
    expect(finals()).toEqual([])
  }, FLOW)
})

describe('PiecewiseRateFlow continuity', () => {
  it('names the slip for k, restores it, then shows the graph', () => {
    const { p, a } = more('pw.continuous', 1)
    const trap = a.traps!.find((t) => t.id === a.trap)!
    const view = renderAt(problemPath('piecewiseRate', 'pw.continuous', p.seed))
    expect(screen.getByText(a.prompt!)).toBeTruthy()
    expect(screen.queryByText(a.reveal[0]!)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'The graph of f' })).toBeNull()
    expect(dotKinds()).toEqual({ open: 0, closed: 0 })

    typeField('k', trap.text!)
    clickCheck()
    expect(screen.getByRole('alert').textContent).toContain(ERROR_PATTERNS[a.trap as keyof typeof ERROR_PATTERNS].title)
    expect(finals()).toMatchObject([{ correct: false, pattern: a.trap, via: 'text' }])

    view.unmount()
    renderAt(problemPath('piecewiseRate', 'pw.continuous', p.seed))
    expect((screen.getByLabelText('k') as HTMLInputElement).value).toBe(trap.text)

    typeField('k', a.kText!)
    clickCheck()
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'The graph of f' })).toBeTruthy()
    expectDots()
    const done = useStore.getState().events.find((e) => e.t === 'problem_done')
    expect(done).toMatchObject({ finalCorrect: false, revealed: 0 })
  }, FLOW)

  it('an unreadable k records nothing', () => {
    const { p } = more('pw.continuous', 2)
    renderAt(problemPath('piecewiseRate', 'pw.continuous', p.seed))
    typeField('k', 'abc')
    clickCheck()
    expect(screen.getByText(/doesn’t count as an attempt/)).toBeTruthy()
    expect(finals()).toEqual([])
  }, FLOW)
})

describe('PiecewiseRateFlow write', () => {
  it('shows the dots, names the trap rows, restores them, then accepts the function', () => {
    const { p, a } = more('pw.write', 1)
    const trap = a.traps!.find((t) => t.id === a.trap)!
    const view = renderAt(problemPath('piecewiseRate', 'pw.write', p.seed))
    expect(screen.getByText(a.prompt!)).toBeTruthy()
    expect(screen.queryByText(a.reveal[0]!)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Show the graph' })).toBeNull()
    expectDots()

    fillRows(trap.rows!)
    clickCheck()
    expect(screen.getByRole('alert').textContent).toContain(ERROR_PATTERNS[a.trap as keyof typeof ERROR_PATTERNS].title)
    expect(finals()).toMatchObject([{ correct: false, pattern: a.trap, via: 'text' }])

    view.unmount()
    renderAt(problemPath('piecewiseRate', 'pw.write', p.seed))
    expect((screen.getByLabelText('Formula for piece 1') as HTMLInputElement).value).toBe(trap.rows![0]!.formula)
    expect((screen.getByLabelText('Interval for piece 1') as HTMLInputElement).value).toBe(trap.rows![0]!.condition)

    fillRows(a.rows!)
    clickCheck()
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(screen.getByText(a.reveal[0]!)).toBeTruthy()
    const done = useStore.getState().events.find((e) => e.t === 'problem_done')
    expect(done).toMatchObject({ finalCorrect: false, revealed: 0 })
  }, FLOW)

  it('an unreadable row records nothing', () => {
    const { p } = more('pw.write', 2)
    renderAt(problemPath('piecewiseRate', 'pw.write', p.seed))
    typeField('Formula for piece 1', '???')
    typeField('Interval for piece 1', 'not an interval')
    clickCheck()
    expect(screen.getByText(/doesn’t count as an attempt/)).toBeTruthy()
    expect(finals()).toEqual([])
  }, FLOW)
})
