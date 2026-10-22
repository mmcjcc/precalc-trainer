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

describe('Graph it from a problem that gives a function', () => {
  it('a quadratic: under the problem and in the calculator steps; the grapher opens with f in the problem’s window', { timeout: FLOW }, async () => {
    const p = generateProblem('quadratics', 'cs.vertex', 1)
    if (p.answer.type !== 'quadratics') throw new Error('expected a quadratic')
    renderAt(problemPath('quadratics', 'cs.vertex', 1))
    const name = `Graph it: open ${speakable(`f(x) = ${p.answer.f}`)} in the grapher`
    const button = await screen.findByRole('button', { name }, LAZY)
    fireEvent.click(screen.getByRole('button', { name: 'Show calculator steps' }))
    const calc = screen.getByRole('region', { name: 'Calculator steps' })
    expect(within(calc).getByRole('button', { name })).toBeTruthy()
    fireEvent.click(button)
    expect(await screen.findByRole('heading', { level: 1, name: 'Graph' }, LAZY)).toBeTruthy()
    expect((screen.getByLabelText('Row 1') as HTMLInputElement).value).toBe(`f(x) = ${p.answer.f}`)
    const [xMin, xMax] = p.answer.graph.xDomain!
    expect(useGraphStore.getState().window.xMin).toBeCloseTo(xMin, 9)
    expect(useGraphStore.getState().window.xMax).toBeCloseTo(xMax, 9)
    fireEvent.click(screen.getByRole('button', { name: /Back to the problem/ }))
    expect(await screen.findByRole('button', { name }, LAZY)).toBeTruthy()
  })

  it('writing g is the question: only f goes to the grapher, in the problem’s window', { timeout: FLOW }, async () => {
    const p = generateProblem('transformations', 'tr.equation', 1)
    if (p.answer.type !== 'transformations') throw new Error('expected a transformation')
    renderAt(problemPath('transformations', 'tr.equation', 1))
    fireEvent.click(await screen.findByRole('button', { name: `Graph it: open ${speakable(`f(x) = ${p.answer.parentFormula}`)} in the grapher` }, LAZY))
    expect(await screen.findByRole('heading', { level: 1, name: 'Graph' }, LAZY)).toBeTruthy()
    expect(useGraphStore.getState().rows.map((r) => r.text)).toEqual([`f(x) = ${p.answer.parentFormula}`])
    expect(useGraphStore.getState().window).toEqual({ xMin: -8, xMax: 8, yMin: -8, yMax: 8 })
  })

  it('a function with no window of its own (synthetic division): the grapher zooms to fit it', { timeout: FLOW }, async () => {
    const p = generateProblem('polyDivision', 'sd.table', 1)
    if (p.answer.type !== 'polyDivision') throw new Error('expected a division')
    renderAt(problemPath('polyDivision', 'sd.table', 1))
    fireEvent.click(await screen.findByRole('button', { name: `Graph it: open ${speakable(`f(x) = ${p.answer.f}`)} in the grapher` }, LAZY))
    expect(await screen.findByRole('heading', { level: 1, name: 'Graph' }, LAZY)).toBeTruthy()
    await waitFor(() => expect(useGraphStore.getState().fitPending).toBe(false))
    expect(useGraphStore.getState().window).not.toEqual({ xMin: -10, xMax: 10, yMin: -10, yMax: 10 })
  })

  it('a piecewise function: its pieces with their conditions, one colour; no Graph it once the problem is finished', { timeout: FLOW }, async () => {
    const p = generateProblem('piecewiseRate', 'pw.evaluate', 1)
    if (p.answer.type !== 'piecewiseRate') throw new Error('expected a piecewise problem')
    renderAt(problemPath('piecewiseRate', 'pw.evaluate', 1))
    const button = await screen.findByRole('button', { name: 'Graph it: open f, piece by piece in the grapher' }, LAZY)
    fireEvent.change(screen.getByLabelText('Value of f(x)'), { target: { value: p.answer.valueText } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('heading', { name: /Problem (complete|finished)/ })).toBeTruthy()
    expect(button.isConnected).toBe(false)
    expect(graphItButtons()).toEqual([])
    useGraphStore.getState().importRows({ rows: p.answer.pieces!.map((q) => ({ text: `y = ${q.formula} {${q.condition}}`, color: 'navy' })), label: 'f' })
    expect(useGraphStore.getState().rows.every((r) => r.color === 'navy')).toBe(true)
  })

  it('a polynomial built from its zeros (f is the answer): no Graph it', { timeout: FLOW }, async () => {
    renderAt(problemPath('polyZeros', 'pz.build', 1))
    expect(await screen.findByRole('heading', { level: 1, name: 'A polynomial from its zeros' }, LAZY)).toBeTruthy()
    expect(graphItButtons()).toEqual([])
  })
})
