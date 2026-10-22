// @vitest-environment jsdom
/**
 * The scratch pad (docs/progress/app-tablet.md): its tools, undo and redo, clear with its question, graph paper, one pad
 * per attempt kept on the device and back after a reload, palm rejection by pointer type, a stylus's pressure, its
 * accessible names; and where the layout opens it: a sheet from the tools row on a phone, a view of the left pane on a
 * tablet, never over her work.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetKeypadForTests } from '@/components/keypadStore'
import { resetWindowSize, setWindowSize, WINDOWS } from '@/components/layoutTesting'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '@/pages/Problem'
import { PEN_WIDTH } from './draw'
import { forgetScratchSessions, ScratchPad } from './ScratchPad'
import { loadPad, readPaper } from './scratchStorage'

const FLOW_TIMEOUT = 120_000

interface Call {
  op: string
  lineWidth: number
  strokeStyle: string
  composite: string
}

/** A 2D context that records what the pad drew (jsdom has no canvas). */
function installPadCanvas(): { calls: Call[]; restore: () => void } {
  const calls: Call[] = []
  const original = HTMLCanvasElement.prototype.getContext
  const contexts = new WeakMap<HTMLCanvasElement, Record<string, unknown>>()
  const make = () => {
    const ctx: Record<string, unknown> = {
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      strokeStyle: '#000',
      fillStyle: '#000',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      setTransform: () => {},
    }
    for (const op of ['beginPath', 'moveTo', 'lineTo', 'arc', 'stroke', 'fill', 'clearRect']) {
      ctx[op] = () => calls.push({ op, lineWidth: ctx.lineWidth as number, strokeStyle: String(ctx.strokeStyle), composite: String(ctx.globalCompositeOperation) })
    }
    return ctx
  }
  HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, kind: string) {
    if (kind !== '2d') return null
    let ctx = contexts.get(this)
    if (!ctx) {
      ctx = make()
      contexts.set(this, ctx)
    }
    return ctx as unknown as CanvasRenderingContext2D
  } as typeof HTMLCanvasElement.prototype.getContext
  return {
    calls,
    restore: () => {
      HTMLCanvasElement.prototype.getContext = original
    },
  }
}

const canvas = () => screen.getByRole('img', { name: /^Scratch pad: a drawing area for your own working/ })
const strokes = () => Number(canvas().getAttribute('data-strokes'))
const button = (name: string) => within(screen.getByRole('toolbar', { name: 'Scratch pad tools' })).getByRole('button', { name })

type Kind = 'pen' | 'touch' | 'mouse'

function down(kind: Kind, id: number, x: number, y: number, pressure = 0.5) {
  fireEvent.pointerDown(canvas(), { pointerId: id, pointerType: kind, clientX: x, clientY: y, pressure, button: 0 })
}
function move(kind: Kind, id: number, x: number, y: number, pressure = 0.5) {
  fireEvent.pointerMove(canvas(), { pointerId: id, pointerType: kind, clientX: x, clientY: y, pressure })
}
function up(kind: Kind, id: number, x: number, y: number) {
  fireEvent.pointerUp(canvas(), { pointerId: id, pointerType: kind, clientX: x, clientY: y })
}

/** A short line from (x, y), right and down, with one pointer. */
function draw(kind: Kind, x = 40, y = 40, pressure = 0.5, id = 1) {
  down(kind, id, x, y, pressure)
  move(kind, id, x + 30, y + 10, pressure)
  move(kind, id, x + 60, y + 20, pressure)
  up(kind, id, x + 60, y + 20)
}

let fake: ReturnType<typeof installPadCanvas>

beforeEach(() => {
  resetStoreForTests()
  resetKeypadForTests()
  localStorage.clear()
  forgetScratchSessions()
  fake = installPadCanvas()
  // The pad is 500 px wide here: a pad unit is half a pixel.
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 500, bottom: 400, width: 500, height: 400, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)
})

afterEach(() => {
  fake.restore()
  vi.restoreAllMocks()
  resetWindowSize()
})

describe('the pad on its own', () => {
  it('every tool is a named button; the canvas is named as her drawing area, which the app does not read', () => {
    render(<ScratchPad attemptId="a#1" size="pane" />)
    const toolbar = screen.getByRole('toolbar', { name: 'Scratch pad tools' })
    expect(within(toolbar).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Pen, navy',
      'Pen, red',
      'Pen, green',
      'Highlighter',
      'Eraser',
      'Undo',
      'Redo',
      'Clear the pad',
      'Graph paper',
    ])
    expect(canvas().getAttribute('aria-label')).toContain('The app does not read or check what you draw here.')
    expect(screen.getByText('For your own working. Nothing on the pad is read or checked.')).toBeTruthy()
    // The navy pen to start; one tool pressed at a time.
    expect(button('Pen, navy').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(button('Highlighter'))
    expect(button('Highlighter').getAttribute('aria-pressed')).toBe('true')
    expect(button('Pen, navy').getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(button('Pen, red'))
    expect(button('Pen, red').getAttribute('aria-pressed')).toBe('true')
    expect(button('Highlighter').getAttribute('aria-pressed')).toBe('false')
    // Nothing to undo, redo or clear yet.
    expect((button('Undo') as HTMLButtonElement).disabled).toBe(true)
    expect((button('Redo') as HTMLButtonElement).disabled).toBe(true)
    expect((button('Clear the pad') as HTMLButtonElement).disabled).toBe(true)
  })

  it('draws with a finger in pad units; undo takes the newest stroke back and redo puts it back', () => {
    render(<ScratchPad attemptId="a#1" size="pane" />)
    draw('touch')
    expect(strokes()).toBe(1)
    // 500 px wide: x in units is twice the pixels.
    expect(loadPad('a#1')![0]!.xy.slice(0, 2)).toEqual([80, 80])
    fireEvent.click(button('Pen, green'))
    draw('mouse', 100, 100)
    expect(loadPad('a#1')!.map((s) => s.ink)).toEqual(['navy', 'green'])
    fireEvent.click(button('Undo'))
    expect(strokes()).toBe(1)
    expect(loadPad('a#1')).toHaveLength(1)
    fireEvent.click(button('Redo'))
    expect(strokes()).toBe(2)
    expect((button('Redo') as HTMLButtonElement).disabled).toBe(true)
    // The highlighter and the eraser are strokes too: the eraser takes ink off (destination-out).
    fireEvent.click(button('Highlighter'))
    draw('touch', 10, 200)
    fireEvent.click(button('Eraser'))
    draw('touch', 10, 200)
    expect(loadPad('a#1')!.map((s) => s.tool)).toEqual(['pen', 'pen', 'highlighter', 'eraser'])
    expect(fake.calls.some((c) => c.op === 'stroke' && c.composite === 'destination-out')).toBe(true)
    expect(fake.calls.some((c) => c.op === 'stroke' && c.composite === 'multiply')).toBe(true)
  })

  it('clear asks first: Keep it keeps everything; Clear it empties the pad, and undo brings it back', async () => {
    render(<ScratchPad attemptId="a#1" size="pane" />)
    draw('touch')
    draw('touch', 100, 120)
    fireEvent.click(button('Clear the pad'))
    const ask = screen.getByRole('alertdialog', { name: 'Clear the scratch pad?' })
    expect(ask.textContent).toContain('Everything on it goes.')
    expect(document.activeElement).toBe(within(ask).getByRole('button', { name: 'Keep it' }))
    expect(strokes()).toBe(2)
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep it' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(strokes()).toBe(2)
    fireEvent.click(button('Clear the pad'))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Clear it' }))
    expect(strokes()).toBe(0)
    expect(loadPad('a#1')).toBeNull()
    // Focus goes to Undo (Clear is off on an empty pad).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
    expect(document.activeElement).toBe(button('Undo'))
    fireEvent.click(button('Undo'))
    expect(strokes()).toBe(2)
    expect(loadPad('a#1')).toHaveLength(2)
  })

  it('graph paper is on by default and can be turned off; the device remembers', () => {
    const view = render(<ScratchPad attemptId="a#1" size="pane" />)
    const surface = () => canvas().parentElement!
    expect(button('Graph paper').getAttribute('aria-pressed')).toBe('true')
    expect(surface().className).toContain('scratch-paper')
    fireEvent.click(button('Graph paper'))
    expect(button('Graph paper').getAttribute('aria-pressed')).toBe('false')
    expect(surface().className).not.toContain('scratch-paper')
    expect(readPaper()).toBe(false)
    view.unmount()
    render(<ScratchPad attemptId="b#2" size="sheet" />)
    expect(button('Graph paper').getAttribute('aria-pressed')).toBe('false')
  })

  it('palm rejection: before a stylus a finger draws; once the stylus has drawn, touches do not; a stylus wipes a palm’s stroke', () => {
    render(<ScratchPad attemptId="a#1" size="pane" />)
    draw('touch')
    expect(strokes()).toBe(1)
    draw('pen', 60, 60, 0.6, 2)
    expect(strokes()).toBe(2)
    // The hand resting on the screen while she writes: ignored.
    draw('touch', 200, 200, 0.5, 3)
    expect(strokes()).toBe(2)
    // While the stylus is down a touch does nothing either.
    down('pen', 4, 10, 300, 0.5)
    down('touch', 5, 200, 300)
    move('touch', 5, 260, 320)
    up('touch', 5, 260, 320)
    move('pen', 4, 80, 300, 0.5)
    up('pen', 4, 80, 300)
    expect(strokes()).toBe(3)
    expect(loadPad('a#1')!.every((s, i) => i === 0 || s.p !== undefined)).toBe(true)
  })

  it('a palm that lands before the stylus leaves no mark', () => {
    render(<ScratchPad attemptId="a#1" size="pane" />)
    down('touch', 7, 300, 300)
    move('touch', 7, 320, 330)
    // The stylus comes down: the palm's stroke goes, the stylus draws.
    down('pen', 8, 20, 20, 0.5)
    move('touch', 7, 340, 360)
    up('touch', 7, 340, 360)
    move('pen', 8, 60, 40, 0.5)
    up('pen', 8, 60, 40)
    expect(strokes()).toBe(1)
    expect(loadPad('a#1')![0]!.p).toBeDefined()
  })

  it('pressure thickens the pen where the stylus reports it; a finger draws an even line', () => {
    render(<ScratchPad attemptId="a#1" size="pane" />)
    draw('touch')
    const even = fake.calls.filter((c) => c.op === 'stroke').map((c) => c.lineWidth)
    expect(new Set(even)).toEqual(new Set([PEN_WIDTH]))
    fake.calls.length = 0
    down('pen', 2, 20, 100, 0.1)
    move('pen', 2, 60, 100, 0.1)
    move('pen', 2, 100, 100, 1)
    move('pen', 2, 140, 100, 1)
    up('pen', 2, 140, 100)
    const pen = loadPad('a#1')![1]!
    expect(pen.p).toEqual([2, 2, 15, 15])
    const widths = fake.calls.filter((c) => c.op === 'stroke').map((c) => c.lineWidth)
    expect(Math.min(...widths)).toBeLessThan(PEN_WIDTH)
    expect(Math.max(...widths)).toBeGreaterThan(PEN_WIDTH)
  })

  it('one pad per attempt; a reload reads it back from the device, undo history aside', () => {
    const a = render(<ScratchPad attemptId="p/x@1/a#1" size="pane" />)
    draw('touch')
    draw('touch', 100, 100)
    a.unmount()
    const b = render(<ScratchPad attemptId="p/x@1/b#2" size="pane" />)
    expect(strokes()).toBe(0)
    draw('touch')
    b.unmount()
    // A reload: nothing in memory, the pad from storage.
    forgetScratchSessions()
    render(<ScratchPad attemptId="p/x@1/a#1" size="pane" />)
    expect(strokes()).toBe(2)
    expect((button('Undo') as HTMLButtonElement).disabled).toBe(true)
    expect(loadPad('p/x@1/b#2')).toHaveLength(1)
  })
})

describe('where the layout opens it', () => {
  function Away() {
    const navigate = useNavigate()
    return (
      <button type="button" onClick={() => navigate(-1)}>
        Back to the problem
      </button>
    )
  }

  function renderProblem(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
          <Route path="/m/:moduleId" element={<Away />} />
        </Routes>
      </MemoryRouter>,
    )
  }

  const PATH = problemPath('geoAngles', 'ga.bisector', 1)

  it(
    'a phone: Scratch in the tools row opens it as a sheet; what she drew is there when it opens again',
    () => {
      setWindowSize(...WINDOWS.phone)
      renderProblem(PATH)
      const tools = screen.getByRole('group', { name: 'Side panels' })
      fireEvent.click(within(tools).getByRole('button', { name: 'Scratch' }))
      const sheet = screen.getByRole('dialog', { name: 'Scratch pad' })
      expect(sheet.closest('[data-sheet]')!.getAttribute('data-sheet')).toBe('sheet')
      draw('touch')
      expect(strokes()).toBe(1)
      fireEvent.click(within(sheet).getAllByRole('button', { name: 'Close' }).at(-1)!)
      expect(screen.queryByRole('dialog', { name: 'Scratch pad' })).toBeNull()
      fireEvent.click(within(screen.getByRole('group', { name: 'Side panels' })).getByRole('button', { name: 'Scratch' }))
      expect(strokes()).toBe(1)
      expect(canvas().closest('[data-scratch-pad]')!.getAttribute('data-scratch-for')).toBe(useStore.getState().attempt!.id)
    },
    FLOW_TIMEOUT,
  )

  it(
    'a tablet: a view of the left pane beside the tools, never over her work; Back and return, and a reload, bring it back',
    () => {
      setWindowSize(...WINDOWS.landscape)
      const view = renderProblem(PATH)
      const left = () => screen.getByRole('region', { name: 'Problem and tools' })
      const right = () => screen.getByRole('region', { name: 'Your working' })
      const views = within(left()).getByRole('tablist', { name: 'Problem tools' })
      expect(within(views).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Tools', 'Scratch pad'])
      expect(within(views).getByRole('tab', { name: 'Tools' }).getAttribute('aria-selected')).toBe('true')
      fireEvent.click(within(views).getByRole('tab', { name: 'Scratch pad' }))
      expect(left().contains(canvas())).toBe(true)
      expect(right().contains(canvas())).toBe(false)
      // The figure stays above the pad, and the box she writes in stays in her pane.
      expect(left().querySelector('[data-problem-card] [role="img"]')).toBeTruthy()
      expect(within(right()).getByRole('textbox', { name: 'x' })).toBeTruthy()
      expect(within(left()).getByRole('complementary', { hidden: true, name: 'Side panels' }).closest('[hidden]')).toBeTruthy()
      draw('pen', 40, 40, 0.5)
      fireEvent.click(within(views).getByRole('tab', { name: 'Tools' }))
      expect(screen.queryByRole('img', { name: /^Scratch pad/ })).toBeNull()
      fireEvent.click(within(views).getByRole('tab', { name: 'Scratch pad' }))
      expect(strokes()).toBe(1)
      // She types in her pane (the attempt has her work), goes to the module page and comes back with Back: the same
      // attempt, and its pad.
      fireEvent.change(within(right()).getByRole('textbox', { name: 'x' }), { target: { value: '3' } })
      fireEvent.click(within(right()).getAllByRole('button', { name: /^Check/ })[0]!)
      const id = useStore.getState().attempt!.id
      fireEvent.click(within(left()).getByRole('link', { name: 'Angles and angle pairs' }))
      fireEvent.click(screen.getByRole('button', { name: 'Back to the problem' }))
      expect(useStore.getState().attempt!.id).toBe(id)
      fireEvent.click(within(screen.getByRole('tablist', { name: 'Problem tools' })).getByRole('tab', { name: 'Scratch pad' }))
      expect(strokes()).toBe(1)
      // A reload: nothing in memory; the pad comes back from the device.
      view.unmount()
      forgetScratchSessions()
      const again = renderProblem(PATH)
      expect(useStore.getState().attempt!.id).toBe(id)
      fireEvent.click(within(screen.getByRole('tablist', { name: 'Problem tools' })).getByRole('tab', { name: 'Scratch pad' }))
      expect(strokes()).toBe(1)
      again.unmount()
    },
    FLOW_TIMEOUT,
  )
})
