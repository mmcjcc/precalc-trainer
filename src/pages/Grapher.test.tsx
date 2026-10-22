// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppShell } from '@/App'
import { installFakeCanvas, type FakeCanvas } from '@/components/grapher/canvasTesting'
import { flushGraphSave, reloadGraphStoreForTests, resetGraphStoreForTests, useGraphStore } from '@/components/grapher/graphStore'
import { resetKeypadForTests } from '@/components/keypadStore'
import { installPointer, keypad, removePointer, tap, tapBox } from '@/components/keypadTesting'
import { MathKeypad } from '@/components/MathKeypad'
import { GRAPH_STORAGE_KEY } from '@/grapher/state'
import { STANDARD_WINDOW } from '@/grapher/view'
import { resetStoreForTests } from '@/store'
import { GrapherPage } from './Grapher'

const LAZY = { timeout: 120_000 }
const PAGE_TIMEOUT = 120_000

let canvas: FakeCanvas

function renderPage(withKeypad = false) {
  return render(
    <MemoryRouter initialEntries={['/graph']}>
      <Routes>
        <Route path="/graph" element={<GrapherPage />} />
      </Routes>
      {withKeypad && <MathKeypad />}
    </MemoryRouter>,
  )
}

const row = (n: number) => screen.getByLabelText(`Row ${n}`) as HTMLInputElement
const type = (n: number, text: string) => fireEvent.change(row(n), { target: { value: text } })
const status = () => document.querySelector('[data-graph-status]')!.textContent ?? ''
const description = () => document.getElementById(screen.getByRole('img', { name: /^Graph, x from/ }).getAttribute('aria-describedby')!)!.textContent ?? ''
const pointsPanel = () => {
  const d = document.querySelector<HTMLDetailsElement>('[data-graph-points]')!
  d.open = true
  return d
}
const tablePanel = () => {
  const d = document.querySelector<HTMLDetailsElement>('[data-graph-table]')!
  d.open = true
  return d
}
const plane = () => document.querySelector<HTMLElement>('[data-graph-plane]')!
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
/**
 * Points of interest come a moment after the graph settles, and the plane draws them on the next frame. React's act
 * holds what a wait sets off until the wait ends, so the frame needs a second wait.
 */
const settle = async () => {
  await act(() => wait(160))
  await act(() => wait(40))
}

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
  removePointer()
})

describe('the Graph tab', () => {
  it('opens /graph (a lazy page) on a phone with the five tabs, Graph marked', { timeout: PAGE_TIMEOUT }, async () => {
    installPointer(true)
    render(
      <MemoryRouter initialEntries={['/graph']}>
        <AppShell />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'Graph' }, LAZY)).toBeTruthy()
    const bar = document.querySelector<HTMLElement>('[data-tab-bar]')!
    expect(within(bar).getAllByRole('link').map((a) => a.textContent)).toEqual(['Home', 'Monsters', 'Graph', 'Progress', 'Settings'])
    expect(within(bar).getByRole('link', { name: 'Graph' }).getAttribute('aria-current')).toBe('page')
  })
})

describe('rows', () => {
  it('a row is a labelled field with a live KaTeX preview, and an error that says what it cannot read', async () => {
    renderPage()
    type(1, 'y = x^2 - 4')
    await waitFor(() => expect(document.querySelector('[data-row-preview] .katex')).toBeTruthy())
    expect(document.querySelector('[data-row-error]')).toBeNull()
    expect(row(1).getAttribute('aria-invalid')).toBe('false')
    type(1, 'y = 2x +')
    await waitFor(() => expect(document.querySelector('[data-row-error]')?.textContent).toMatch(/ends too early/))
    expect(row(1).getAttribute('aria-invalid')).toBe('true')
    expect(row(1).getAttribute('aria-describedby')).toBe(document.querySelector('[data-row-error]')!.id)
    type(1, 'x^2 + y^2 = 25')
    await waitFor(() => expect(document.querySelector('[data-row-error]')?.textContent).toMatch(/Solve for y first/))
  })

  it('Enter goes to a new row below; Backspace in an empty row removes it', async () => {
    renderPage()
    type(1, 'y = x')
    fireEvent.keyDown(row(1), { key: 'Enter' })
    expect(useGraphStore.getState().rows).toHaveLength(2)
    await waitFor(() => expect(document.activeElement).toBe(row(2)))
    fireEvent.keyDown(row(2), { key: 'Backspace' })
    expect(useGraphStore.getState().rows).toHaveLength(1)
    await waitFor(() => expect(document.activeElement).toBe(row(1)))
  })

  it('rows can be hidden, recoloured, moved and deleted, with buttons that say so', async () => {
    renderPage()
    type(1, 'y = x')
    fireEvent.click(screen.getByRole('button', { name: '+ Add a row' }))
    type(2, 'y = -x')
    const swatch = screen.getByRole('button', { name: 'Row 1 on the graph (navy)' })
    expect(swatch.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(swatch)
    expect(useGraphStore.getState().rows[0]!.hidden).toBe(true)
    expect(screen.getByRole('button', { name: 'Row 1 on the graph (navy)' }).getAttribute('aria-pressed')).toBe('false')
    await waitFor(() => expect(description()).toMatch(/Row 1 is hidden/))

    fireEvent.click(screen.getByRole('button', { name: 'Row 2 options' }))
    const sheet = screen.getByRole('dialog', { name: 'Row 2' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'purple' }))
    expect(useGraphStore.getState().rows[1]!.color).toBe('purple')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Move up' }))
    expect(useGraphStore.getState().rows.map((r) => r.text)).toEqual(['y = -x', 'y = x'])
    fireEvent.click(screen.getByRole('button', { name: 'Row 2 options' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Row 2' })).getByRole('button', { name: 'Delete row 2' }))
    expect(useGraphStore.getState().rows.map((r) => r.text)).toEqual(['y = -x'])
    for (const b of [screen.getByRole('button', { name: 'Row 1 options' }), screen.getByRole('button', { name: /^Row 1 on the graph/ })]) expect(b.className).toMatch(/h-11 w-11/)
  })

  it('f(x) = … in one row and g(x) = f(x − 2) in the next: both drawn, g’s preview keeps the call', async () => {
    renderPage()
    type(1, 'f(x) = x^2')
    fireEvent.click(screen.getByRole('button', { name: '+ Add a row' }))
    type(2, 'g(x) = f(x - 2)')
    // In words a screen reader reads well: the true minus, x² for x^2.
    await waitFor(() => expect(description()).toMatch(/Row 2, red: the curve g\(x\) = f\(x − 2\)\.$/))
    expect(description()).toMatch(/Row 1, navy: the curve f\(x\) = x²\./)
    const previews = document.querySelectorAll('[data-row-preview]')
    expect(previews[1]!.textContent).toMatch(/g\(x\)=f\(x−2\)/)
  })
})

describe('the plane', () => {
  it('has a description of its window and each row, and draws shading with a dashed edge and a hole', async () => {
    renderPage()
    type(1, 'y < 2x + 1')
    fireEvent.click(screen.getByRole('button', { name: '+ Add a row' }))
    type(2, 'y = (x^2 - 1)/(x - 1)')
    await waitFor(() => expect(description()).toMatch(/Row 2/))
    expect(description()).toMatch(/^x from −10 to 10, y from −10 to 10\. Angles in radians\./)
    expect(description()).toMatch(/Row 1, navy: shading below its edge, y < 2x \+ 1, the edge dashed/)
    await settle()
    const frame = canvas.lastFrame()
    // The shading is a translucent fill in the row's colour; the edge is dashed; the hole is an open circle.
    expect(frame.some((c) => c.op === 'fill' && /^rgba\(47, 60, 126, 0\.16\)$/.test(c.fillStyle ?? ''))).toBe(true)
    expect(frame.some((c) => c.op === 'stroke' && (c.dash?.length ?? 0) > 0)).toBe(true)
    expect(frame.some((c) => c.op === 'arc' && Math.abs((c.args[0] as number) - 220) < 0.5 && Math.abs((c.args[1] as number) - 120) < 0.5)).toBe(true)
  })

  it('a drag pans; + and − zoom by two about the centre; the house goes back to the standard window', async () => {
    renderPage()
    type(1, 'y = x')
    const p = plane()
    fireEvent.pointerDown(p, { pointerId: 1, clientX: 200, clientY: 150, button: 0 })
    fireEvent.pointerMove(p, { pointerId: 1, clientX: 300, clientY: 150 })
    fireEvent.pointerUp(p, { pointerId: 1, clientX: 300, clientY: 150 })
    const w = useGraphStore.getState().window
    expect(w.xMin).toBeCloseTo(-15, 9)
    expect(w.xMax).toBeCloseTo(5, 9)
    fireEvent.click(screen.getByRole('button', { name: 'Standard window' }))
    await waitFor(() => expect(useGraphStore.getState().window).toEqual(STANDARD_WINDOW))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(useGraphStore.getState().window).toEqual({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 })
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(useGraphStore.getState().window).toEqual({ xMin: -20, xMax: 20, yMin: -20, yMax: 20 })
    for (const name of ['Zoom in', 'Zoom out', 'Zoom to fit', 'Standard window']) expect(screen.getByRole('button', { name }).className).toMatch(/h-11 w-11/)
  })

  it('a two-finger pinch zooms about the fingers; the wheel zooms about the pointer', async () => {
    renderPage()
    type(1, 'y = x')
    const p = plane()
    // Fingers 100 px apart around (200, 150), the plane's centre, then 200 px apart: twice as close, centred still.
    fireEvent.pointerDown(p, { pointerId: 1, clientX: 150, clientY: 150, button: 0 })
    fireEvent.pointerDown(p, { pointerId: 2, clientX: 250, clientY: 150, button: 0 })
    fireEvent.pointerMove(p, { pointerId: 1, clientX: 100, clientY: 150 })
    fireEvent.pointerMove(p, { pointerId: 2, clientX: 300, clientY: 150 })
    fireEvent.pointerUp(p, { pointerId: 1, clientX: 100, clientY: 150 })
    fireEvent.pointerUp(p, { pointerId: 2, clientX: 300, clientY: 150 })
    const w = useGraphStore.getState().window
    expect(w.xMin).toBeCloseTo(-5, 9)
    expect(w.xMax).toBeCloseTo(5, 9)
    expect(w.yMin).toBeCloseTo(-5, 9)
    expect(w.yMax).toBeCloseTo(5, 9)
    // The wheel: in (a negative deltaY) about the pointer at the plane's right edge middle, x = 5.
    fireEvent.wheel(p, { deltaY: -200, clientX: 400, clientY: 150 })
    await act(() => wait(300))
    const z = useGraphStore.getState().window
    expect(z.xMax).toBeCloseTo(5, 9)
    expect(z.xMax - z.xMin).toBeLessThan(10)
  })

  it('Zoom to fit picks a window with the interesting part of every curve', async () => {
    renderPage()
    type(1, 'y = 500x - 2x^2')
    await waitFor(() => expect(description()).toMatch(/Row 1/))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom to fit' }))
    const w = useGraphStore.getState().window
    expect(w.xMin).toBeLessThan(0)
    expect(w.xMax).toBeGreaterThan(250)
    expect(w.yMax).toBeGreaterThan(31250)
  })

  it('a tap on a curve traces it; a tap on empty plane clears it', async () => {
    renderPage()
    type(1, 'y = x')
    await waitFor(() => expect(description()).toMatch(/Row 1/))
    await settle()
    // (2, 2) in the standard window on the nominal 400 × 300 plane.
    const p = plane()
    fireEvent.pointerDown(p, { pointerId: 1, clientX: 240, clientY: 120, button: 0 })
    fireEvent.pointerUp(p, { pointerId: 1, clientX: 240, clientY: 120 })
    await waitFor(() => expect(status()).toBe('Row 1: (2, 2)'))
    expect(document.querySelector('[data-graph-marker]')!.textContent).toBe('(2, 2)')
    // Far from the line (it is near the top of the plane where x is 8).
    fireEvent.pointerDown(p, { pointerId: 1, clientX: 360, clientY: 280, button: 0 })
    fireEvent.pointerUp(p, { pointerId: 1, clientX: 360, clientY: 280 })
    await waitFor(() => expect(status()).toMatch(/Tap a curve/))
  })
})

describe('points of interest', () => {
  it('x² − 4: listed under the plane as buttons; picking one shows it on the plane and says it', async () => {
    renderPage()
    type(1, 'y = x^2 - 4')
    await settle()
    const panel = pointsPanel()
    const buttons = within(panel).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Row 1: zero(−2, 0)', 'Row 1: y-intercept · minimum(0, −4)', 'Row 1: zero(2, 0)'])
    fireEvent.click(buttons[1]!)
    expect(status()).toBe('Row 1: y-intercept · minimum (0, −4)')
    expect(buttons[1]!.getAttribute('aria-pressed')).toBe('true')
    // And a tap on its dot picks it too: (0, −4) is at (200, 210) on the plane.
    fireEvent.click(buttons[0]!)
    fireEvent.pointerDown(plane(), { pointerId: 1, clientX: 202, clientY: 208, button: 0 })
    fireEvent.pointerUp(plane(), { pointerId: 1, clientX: 202, clientY: 208 })
    await waitFor(() => expect(status()).toBe('Row 1: y-intercept · minimum (0, −4)'))
  })

  it('A(x) = 500x − 2x² in a window that holds it: its maximum at (125, 31250)', async () => {
    useGraphStore.getState().importRows({ rows: [{ text: 'A(x) = 500x - 2x^2' }], window: { xMin: -10, xMax: 260, yMin: -3000, yMax: 36000 }, label: 'A' })
    renderPage()
    await settle()
    const texts = within(pointsPanel()).getAllByRole('button').map((b) => b.textContent)
    expect(texts).toContain('Row 1: maximum(125, 31250)')
    expect(texts).toContain('Row 1: zero(250, 0)')
  })

  it('two curves: their intersections', async () => {
    renderPage()
    type(1, 'y = x')
    fireEvent.click(screen.getByRole('button', { name: '+ Add a row' }))
    type(2, 'y = x^2')
    await settle()
    const texts = within(pointsPanel()).getAllByRole('button').map((b) => b.textContent)
    expect(texts.filter((t) => t?.startsWith('Rows 1 and 2: intersection'))).toEqual(['Rows 1 and 2: intersection(0, 0)', 'Rows 1 and 2: intersection(1, 1)'])
  })
})

describe('sliders', () => {
  it('each letter that is not x or y gets a slider with its value, range and step; moving it moves the curve', async () => {
    renderPage()
    type(1, 'y = a(x - h)^2 + k')
    await waitFor(() => expect(document.querySelectorAll('[data-slider]')).toHaveLength(3))
    expect([...document.querySelectorAll('[data-slider]')].map((s) => s.getAttribute('data-slider'))).toEqual(['a', 'h', 'k'])
    const k = screen.getByRole('slider', { name: /^k, slider from −10 to 10/ })
    expect((k as HTMLInputElement).value).toBe('1')
    fireEvent.change(k, { target: { value: '-4' } })
    expect(useGraphStore.getState().sliders.k!.value).toBe(-4)
    await settle()
    // The vertex moved with h and k: (1, −4).
    expect(within(pointsPanel()).getAllByRole('button').map((b) => b.textContent)).toContain('Row 1: minimum(1, −4)')
    // The value box takes a typed value (outside the range: the range grows); range and step fold out.
    const value = screen.getByLabelText('a, its value')
    fireEvent.change(value, { target: { value: '15' } })
    fireEvent.keyDown(value, { key: 'Enter' })
    expect(useGraphStore.getState().sliders.a).toEqual({ value: 15, min: -10, max: 15, step: 0.1 })
    fireEvent.click(screen.getByRole('button', { name: 'h: range and step' }))
    const step = screen.getByLabelText('h, step')
    fireEvent.change(step, { target: { value: '0.5' } })
    fireEvent.blur(step)
    expect(useGraphStore.getState().sliders.h!.step).toBe(0.5)
  })
})

describe('the table', () => {
  it('x and y from a start in steps; undefined where the row is not defined', async () => {
    renderPage()
    type(1, 'y = 1/x')
    await waitFor(() => expect(description()).toMatch(/Row 1/))
    const table = tablePanel()
    fireEvent.change(within(table).getByLabelText('Table start'), { target: { value: '-2' } })
    fireEvent.keyDown(within(table).getByLabelText('Table start'), { key: 'Enter' })
    const cells = () => within(table).getAllByRole('row').slice(1).map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent))
    expect(cells().slice(0, 5)).toEqual([
      ['−2', '−0.5'],
      ['−1', '−1'],
      ['0', 'undefined'],
      ['1', '1'],
      ['2', '0.5'],
    ])
    fireEvent.change(within(table).getByLabelText('Table step'), { target: { value: '0.5' } })
    fireEvent.blur(within(table).getByLabelText('Table step'))
    expect(cells()[1]).toEqual(['−1.5', '−2/3'])
  })
})

describe('degree mode', () => {
  it('RADIAN by default, as on the TI-84; DEGREE makes sin take degrees', async () => {
    renderPage()
    type(1, 'y = sin(x)')
    const rad = screen.getByRole('button', { name: 'RADIAN' })
    const deg = screen.getByRole('button', { name: 'DEGREE' })
    expect(rad.getAttribute('aria-pressed')).toBe('true')
    await waitFor(() => expect(description()).toMatch(/Angles in radians/))
    const table = tablePanel()
    fireEvent.change(within(table).getByLabelText('Table step'), { target: { value: '90' } })
    fireEvent.blur(within(table).getByLabelText('Table step'))
    const ys = () => within(table).getAllByRole('row').slice(1, 4).map((tr) => tr.querySelectorAll('td')[1]!.textContent)
    expect(ys()[1]).toBe('0.894')
    fireEvent.click(deg)
    expect(useGraphStore.getState().mode).toBe('deg')
    await waitFor(() => expect(ys()).toEqual(['0', '1', '0']))
    expect(description()).toMatch(/Angles in degrees/)
  })
})

describe('kept on the device', () => {
  it('rows, sliders, the window and the mode survive a reload', async () => {
    const view = renderPage()
    type(1, 'y = a x^2')
    await waitFor(() => expect(document.querySelectorAll('[data-slider]')).toHaveLength(1))
    fireEvent.change(screen.getByRole('slider', { name: /^a, slider/ }), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'DEGREE' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    flushGraphSave()
    view.unmount()
    expect(localStorage.getItem(GRAPH_STORAGE_KEY)).toContain('y = a x^2')
    resetGraphStoreForTests()
    expect(useGraphStore.getState().rows[0]!.text).toBe('')
    reloadGraphStoreForTests()
    renderPage()
    expect(row(1).value).toBe('y = a x^2')
    expect(useGraphStore.getState().sliders.a!.value).toBe(3)
    expect(useGraphStore.getState().mode).toBe('deg')
    expect(useGraphStore.getState().window).toEqual({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 })
    expect(screen.getByRole('button', { name: 'DEGREE' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('a stored graph that is not one is ignored (the default graph instead)', () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify({ version: 1, rows: 'nope' }))
    reloadGraphStoreForTests()
    expect(useGraphStore.getState().rows).toHaveLength(1)
    expect(useGraphStore.getState().window).toEqual(STANDARD_WINDOW)
  })

  it('Clear all asks first, in the app’s own sheet', async () => {
    renderPage()
    type(1, 'y = x')
    fireEvent.click(screen.getByRole('button', { name: '+ Add a row' }))
    type(2, 'y = 2x')
    fireEvent.click(screen.getByRole('button', { name: 'Clear all…' }))
    const sheet = screen.getByRole('dialog', { name: 'Clear the graph?' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Keep them' }))
    expect(useGraphStore.getState().rows).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Clear all…' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Clear the graph?' })).getByRole('button', { name: 'Clear all' }))
    expect(useGraphStore.getState().rows.map((r) => r.text)).toEqual([''])
    expect(useGraphStore.getState().window).toEqual(STANDARD_WINDOW)
  })
})

describe('the math keypad', () => {
  it('on a touch screen a row opens the keypad with the graphing keys; Next goes to a new row', async () => {
    installPointer(true)
    renderPage(true)
    tapBox(row(1))
    const pad = keypad()
    const names = within(pad).getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    for (const name of ['x', 'y', 'power', 'square root', 'absolute value', 'sine', 'cosine', 'tangent', 'natural log', 'log base 10', 'pi', 'e', 'less than or equal', 'greater than or equal', 'a', 'h', 'k', 'set braces']) {
      expect(names).toContain(name)
    }
    expect(names).not.toContain('check')
    expect(within(pad).getByRole('button', { name: 'next row' }).textContent).toBe('Next')
    tap('y')
    tap('equals')
    tap('x')
    tap('squared')
    expect(row(1).value).toBe('y = x^2')
    tap('next row')
    expect(useGraphStore.getState().rows).toHaveLength(2)
    await waitFor(() => expect(document.activeElement).toBe(row(2)))
  })
})
