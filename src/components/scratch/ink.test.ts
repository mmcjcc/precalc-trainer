import { describe, expect, it } from 'vitest'
import {
  addStroke,
  canRedo,
  canUndo,
  clearPad,
  decodeStrokes,
  EMPTY_PAD,
  encodeStrokes,
  extendStroke,
  HISTORY,
  MIN_STEP,
  pressureStep,
  redoPad,
  startStroke,
  undoPad,
  type Stroke,
} from './ink'

const line = (x0: number, y0: number, n: number, ink: Stroke['ink'] = 'navy'): Stroke => {
  const s = startStroke('pen', ink, x0, y0)
  for (let i = 1; i < n; i++) extendStroke(s, x0 + i * 5, y0 + i * 3)
  return s
}

describe('the drawing as compact text', () => {
  it('round-trips every tool, ink, negative and large coordinates, and pressure', () => {
    const pen = startStroke('pen', 'red', 12, 900, 0.7)
    extendStroke(pen, -40, 1200, 0.2)
    extendStroke(pen, 1500, 3, 1)
    const strokes: Stroke[] = [
      pen,
      line(100, 100, 40, 'green'),
      { tool: 'highlighter', ink: 'navy', xy: [10, 10, 400, 12] },
      { tool: 'eraser', ink: 'navy', xy: [5, 5] },
    ]
    const text = encodeStrokes(strokes)
    expect(text.startsWith('v1;')).toBe(true)
    expect(decodeStrokes(text)).toEqual(strokes)
    expect(decodeStrokes(encodeStrokes([]))).toEqual([])
  })

  it('is compact: about three characters a point for a hand-drawn line', () => {
    const s = line(500, 500, 200)
    const text = encodeStrokes([s])
    expect(text.length).toBeLessThan(200 * 3 + 12)
  })

  it('reads nothing it does not know (the pad then starts empty)', () => {
    for (const bad of ['', 'v2;pnE', 'v1;xnEAA', 'v1;pnE!!', 'v1;pnE', 'v1;pnPCAAAA', 'v1;pnECA']) expect(decodeStrokes(bad)).toBeNull()
  })
})

describe('drawing a stroke', () => {
  it('drops points closer than the minimum step, and keeps pressure only for a stylus', () => {
    const s = startStroke('pen', 'navy', 0, 0)
    expect(extendStroke(s, 1, 1)).toBe(false)
    expect(extendStroke(s, MIN_STEP, 0)).toBe(true)
    expect(s.xy).toEqual([0, 0, MIN_STEP, 0])
    expect(s.p).toBeUndefined()
    const pen = startStroke('pen', 'navy', 0, 0, 0.5)
    extendStroke(pen, 10, 0, 1)
    expect(pen.p).toEqual([pressureStep(0.5), 15])
    expect(pressureStep(-1)).toBe(0)
    expect(pressureStep(Number.NaN)).toBe(8)
  })
})

describe('undo, redo and clear', () => {
  it('undo takes back the newest change, redo puts it back; a new stroke forgets what was undone', () => {
    const a = line(0, 0, 3)
    const b = line(50, 50, 3)
    const c = line(90, 90, 3)
    let pad = addStroke(addStroke(EMPTY_PAD, a), b)
    expect(canUndo(pad)).toBe(true)
    expect(canRedo(pad)).toBe(false)
    pad = undoPad(pad)
    expect(pad.strokes).toEqual([a])
    expect(canRedo(pad)).toBe(true)
    pad = redoPad(pad)
    expect(pad.strokes).toEqual([a, b])
    pad = addStroke(undoPad(pad), c)
    expect(pad.strokes).toEqual([a, c])
    expect(canRedo(pad)).toBe(false)
  })

  it('clear empties the pad and undo brings it all back; an empty pad stays as it is', () => {
    const a = line(0, 0, 3)
    let pad = addStroke(EMPTY_PAD, a)
    pad = clearPad(pad)
    expect(pad.strokes).toEqual([])
    expect(clearPad(pad)).toBe(pad)
    pad = undoPad(pad)
    expect(pad.strokes).toEqual([a])
    pad = redoPad(pad)
    expect(pad.strokes).toEqual([])
  })

  it('remembers the last changes only', () => {
    let pad = EMPTY_PAD
    for (let i = 0; i < HISTORY + 20; i++) pad = addStroke(pad, line(i, i, 2))
    expect(pad.undo).toHaveLength(HISTORY)
    for (let i = 0; i < HISTORY + 20; i++) pad = undoPad(pad)
    expect(pad.strokes).toHaveLength(20)
    expect(canUndo(pad)).toBe(false)
  })
})
