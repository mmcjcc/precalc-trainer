// @vitest-environment jsdom
/**
 * "Graph it" from a problem: the grapher opens with the function the problem shows (or her own final equation), in
 * the problem's window, and Back returns to the problem with her work as she left it. Never for a hidden answer.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '@/App'
import { installFakeCanvas, type FakeCanvas } from '@/components/grapher/canvasTesting'
import { resetGraphStoreForTests, useGraphStore } from '@/components/grapher/graphStore'
import { resetKeypadForTests } from '@/components/keypadStore'
import { generateProblem } from '@/content'
import type { OptimizationAnswer } from '@/content/types'
import { speakable } from '@/grapher/format'
import { graphItFromStatement } from '@/grapher/graphIt'
import { problemPath } from '@/problem/url'
import { resetStoreForTests } from '@/store'

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

const LAZY = { timeout: 120_000 }
const FLOW = 120_000
let canvas: FakeCanvas

const graphItButtons = () => screen.queryAllByRole('button', { name: /^Graph it/ })
const field = (label: string) => screen.getByRole('textbox', { name: label }) as HTMLInputElement
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const settle = async () => {
  await act(() => wait(160))
  await act(() => wait(40))
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell />
    </MemoryRouter>,
  )
}

beforeAll(async () => {
  await import('@/pages/Problem')
  await import('@/pages/Grapher')
}, 120_000)

beforeEach(() => {
  resetStoreForTests()
  resetKeypadForTests()
  localStorage.clear()
  resetGraphStoreForTests()
  canvas = installFakeCanvas()
  window.scrollTo = () => {}
})

afterEach(() => {
  canvas.restore()
})

describe('Graph it from an optimization problem', () => {
  it('appears only once her final equation is right; opens it with its maximum at (125, 31250); Back keeps her work', { timeout: FLOW }, async () => {
    // The worksheet's pigpen: 500 ft of fence, three sides, against a stone wall.
    const seed = 982
    const a = generateProblem('optimization', 'opt.wall', seed).answer as OptimizationAnswer
    const answers = a.stages.map((s) => (s as unknown as { answerText: string }).answerText)
    expect(answers.slice(0, 3)).toEqual(['2x + y = 500', 'A = xy', 'A = 500x - 2x^2'])
    renderAt(problemPath('optimization', 'opt.wall', seed))
    expect(await screen.findByRole('heading', { name: `Part 1 of 6: ${a.stages[0]!.label}` }, LAZY)).toBeTruthy()

    // Not before: the final equation is an answer she has not given (nor in the calculator steps, which hold it).
    expect(graphItButtons()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Show calculator steps' }))
    expect(graphItButtons()).toEqual([])
    for (const i of [0, 1]) {
      fireEvent.change(field(a.stages[i]!.label), { target: { value: answers[i] } })
      fireEvent.click(screen.getByRole('button', { name: 'Check' }))
      expect(graphItButtons()).toEqual([])
    }
    fireEvent.change(field(a.stages[2]!.label), { target: { value: 'A = 500x - 2x^2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))

    // Her equation is right: Graph it, in the final equation's card.
    const finalCard = screen.getByRole('heading', { name: `Part 3 of 6: ${a.stages[2]!.label}` }).closest('section')!
    const button = within(finalCard).getByRole('button', { name: 'Graph it: open your final equation in the grapher' })
    expect(graphItButtons()).toEqual([button])
    // She has started part 4.
    fireEvent.change(field(a.stages[3]!.label), { target: { value: '12' } })

    fireEvent.click(button)
    expect(await screen.findByRole('heading', { level: 1, name: 'Graph' }, LAZY)).toBeTruthy()
    expect((screen.getByLabelText('Row 1') as HTMLInputElement).value).toBe('A(x) = 500x - 2x^2')
    const w = useGraphStore.getState().window
    expect(w.xMin).toBeLessThan(0)
    expect(w.xMax).toBeGreaterThan(250)
    expect(w.yMax).toBeGreaterThan(31250)
    await settle()
    const points = document.querySelector<HTMLDetailsElement>('[data-graph-points]')!
    points.open = true
    expect(within(points).getAllByRole('button').map((b) => b.textContent)).toContain('Row 1: maximum(125, 31250)')
    expect(document.querySelector('[data-graph-status]')!.textContent).toBe('From your problem: row 1.')

    fireEvent.click(screen.getByRole('button', { name: /Back to the problem/ }))
    expect(await screen.findByRole('heading', { name: `Part 4 of 6: ${a.stages[3]!.label}` }, LAZY)).toBeTruthy()
    expect(field(a.stages[3]!.label).value).toBe('12')
    expect(screen.getByRole('heading', { name: `Part 3 of 6: ${a.stages[2]!.label}` })).toBeTruthy()
    expect((screen.getByRole('textbox', { name: a.stages[2]!.label }) as HTMLInputElement).value).toBe('A = 500x - 2x^2')
    // Graph it again does not add the same row twice.
    fireEvent.click(screen.getByRole('button', { name: 'Graph it: open your final equation in the grapher' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Graph' }, LAZY)).toBeTruthy()
    expect(useGraphStore.getState().rows.map((r) => r.text)).toEqual(['A(x) = 500x - 2x^2'])
  })
})

/** Graph it sits behind the graph's and the calculator steps' reveal gates: open whichever the problem has. */
async function revealGates() {
  await screen.findByRole('heading', { level: 1 }, LAZY)
  for (const label of ['Show the graph', 'Show calculator steps']) {
    const gate = screen.queryByRole('button', { name: label })
    if (gate) fireEvent.click(gate)
  }
}

describe('Graph it from a problem that gives a function', () => {
  it('a quadratic: behind the calculator steps’ gate, never in the open; opens f in the problem’s window', { timeout: FLOW }, async () => {
    const p = generateProblem('quadratics', 'cs.vertex', 1)
    if (p.answer.type !== 'quadratics') throw new Error('expected a quadratic')
    renderAt(problemPath('quadratics', 'cs.vertex', 1))
    const name = `Graph it: open ${speakable(`f(x) = ${p.answer.f}`)} in the grapher`
    // Its graph shows the vertex, the answer: no Graph it until she opens a gate that says it gives the answer away.
    await screen.findByRole('heading', { level: 1 }, LAZY)
    expect(graphItButtons()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Show calculator steps' }))
    const calc = screen.getByRole('region', { name: 'Calculator steps' })
    const button = within(calc).getByRole('button', { name })
    fireEvent.click(button)
    expect(await screen.findByRole('heading', { level: 1, name: 'Graph' }, LAZY)).toBeTruthy()
    expect((screen.getByLabelText('Row 1') as HTMLInputElement).value).toBe(`f(x) = ${p.answer.f}`)
    const [xMin, xMax] = p.answer.graph.xDomain!
    expect(useGraphStore.getState().window.xMin).toBeCloseTo(xMin, 9)
    expect(useGraphStore.getState().window.xMax).toBeCloseTo(xMax, 9)
    fireEvent.click(screen.getByRole('button', { name: /Back to the problem/ }))
    expect(await screen.findByRole('heading', { level: 1 }, LAZY)).toBeTruthy()
  })

  it('writing g is the question: only f goes to the grapher, in the problem’s window', { timeout: FLOW }, async () => {
    const p = generateProblem('transformations', 'tr.equation', 1)
    if (p.answer.type !== 'transformations') throw new Error('expected a transformation')
    renderAt(problemPath('transformations', 'tr.equation', 1))
    await revealGates()
    fireEvent.click(screen.getAllByRole('button', { name: `Graph it: open ${speakable(`f(x) = ${p.answer.parentFormula}`)} in the grapher` })[0]!)
    expect(await screen.findByRole('heading', { level: 1, name: 'Graph' }, LAZY)).toBeTruthy()
    expect(useGraphStore.getState().rows.map((r) => r.text)).toEqual([`f(x) = ${p.answer.parentFormula}`])
    expect(useGraphStore.getState().window).toEqual({ xMin: -8, xMax: 8, yMin: -8, yMax: 8 })
  })

  it('zeros of a polynomial: behind the calculator steps’ gate; the grapher opens f (zooming to fit it when it has no window)', { timeout: FLOW }, async () => {
    const p = generateProblem('polyZeros', 'pz.zeros', 1)
    if (p.answer.type !== 'polyZeros') throw new Error('expected a polynomial')
    const request = graphItFromStatement(p)!
    renderAt(problemPath('polyZeros', 'pz.zeros', 1))
    await screen.findByRole('heading', { level: 1 }, LAZY)
    expect(graphItButtons()).toEqual([])
    await revealGates()
    fireEvent.click(screen.getAllByRole('button', { name: `Graph it: open ${speakable(request.label)} in the grapher` })[0]!)
    expect(await screen.findByRole('heading', { level: 1, name: 'Graph' }, LAZY)).toBeTruthy()
    expect(useGraphStore.getState().rows.map((r) => r.text)).toEqual(request.rows.map((r) => r.text))
    if (!request.window) {
      await waitFor(() => expect(useGraphStore.getState().fitPending).toBe(false))
      expect(useGraphStore.getState().window).not.toEqual({ xMin: -10, xMax: 10, yMin: -10, yMax: 10 })
    }
  })

  it('a problem with no graph and no calculator steps (a piecewise value, a division) has no Graph it: its graph would give the answer', { timeout: FLOW }, async () => {
    for (const [m, t] of [
      ['piecewiseRate', 'pw.evaluate'],
      ['polyDivision', 'sd.table'],
    ] as const) {
      const view = renderAt(problemPath(m, t, 1))
      await screen.findByRole('heading', { level: 1 }, LAZY)
      await revealGates()
      expect(graphItButtons(), `${m}/${t}`).toEqual([])
      view.unmount()
    }
    // A piecewise function's pieces, when she types them in the Graph tab, keep one colour.
    const p = generateProblem('piecewiseRate', 'pw.evaluate', 1)
    if (p.answer.type !== 'piecewiseRate') throw new Error('expected a piecewise problem')
    useGraphStore.getState().importRows({ rows: p.answer.pieces!.map((q) => ({ text: `y = ${q.formula} {${q.condition}}`, color: 'navy' })), label: 'f' })
    expect(useGraphStore.getState().rows.every((r) => r.color === 'navy')).toBe(true)
  })

  it('a polynomial built from its zeros (f is the answer): no Graph it', { timeout: FLOW }, async () => {
    renderAt(problemPath('polyZeros', 'pz.build', 1))
    expect(await screen.findByRole('heading', { level: 1, name: 'A polynomial from its zeros' }, LAZY)).toBeTruthy()
    expect(graphItButtons()).toEqual([])
  })
})
