/**
 * The scratch pad's drawing as data (pure: no DOM). A pad is a list of strokes; a stroke is the tool it was drawn with,
 * its ink and its points as whole numbers in pad units: the pad is UNITS wide whatever its size on screen, and y uses the
 * same unit, so a drawing keeps its shape when the pad is shown at another width (a phone's sheet, a tablet's pane). The
 * eraser is a stroke too (it takes ink off where it passes), so undo and redo are one list of changes.
 *
 * Stored on the device as compact text (`encodeStrokes`): per stroke a three-character head and its points as
 * variable-length deltas, about three characters a point.
 */

export type Tool = 'pen' | 'highlighter' | 'eraser'
export type Ink = 'navy' | 'red' | 'green'

export const INKS: readonly Ink[] = ['navy', 'red', 'green']

/** The pad's width in its own units. */
export const UNITS = 1000

/** Pressure as stored: 0 (lightest) to 15 (hardest). */
export const PRESSURE_STEPS = 15

export interface Stroke {
  tool: Tool
  /** The pen's ink (kept on every stroke; the highlighter and the eraser have their own colour). */
  ink: Ink
  /** Points in pad units, flat: [x0, y0, x1, y1, ...], whole numbers. */
  xy: number[]
  /** Pressure per point (0 to 15) where the device reported it (a stylus); absent: an even line. */
  p?: number[]
}

/** One change, for undo and redo: a stroke drawn, or the pad cleared (with what was on it). */
export type Change = { kind: 'add'; stroke: Stroke } | { kind: 'clear'; strokes: Stroke[] }

export interface PadState {
  strokes: Stroke[]
  undo: Change[]
  redo: Change[]
}

/** How many changes undo remembers. */
export const HISTORY = 200

export const EMPTY_PAD: PadState = { strokes: [], undo: [], redo: [] }

export function padOf(strokes: Stroke[]): PadState {
  return { strokes, undo: [], redo: [] }
}

function remember(undo: Change[], change: Change): Change[] {
  const next = [...undo, change]
  return next.length > HISTORY ? next.slice(next.length - HISTORY) : next
}

export function addStroke(pad: PadState, stroke: Stroke): PadState {
  return { strokes: [...pad.strokes, stroke], undo: remember(pad.undo, { kind: 'add', stroke }), redo: [] }
}

/** Clear the pad (undo brings it back). An empty pad stays as it is. */
export function clearPad(pad: PadState): PadState {
  if (pad.strokes.length === 0) return pad
  return { strokes: [], undo: remember(pad.undo, { kind: 'clear', strokes: pad.strokes }), redo: [] }
}

export function canUndo(pad: PadState): boolean {
  return pad.undo.length > 0
}

export function canRedo(pad: PadState): boolean {
  return pad.redo.length > 0
}

export function undoPad(pad: PadState): PadState {
  const change = pad.undo[pad.undo.length - 1]
  if (!change) return pad
  const undo = pad.undo.slice(0, -1)
  const redo = [...pad.redo, change]
  if (change.kind === 'add') {
    // The change undone is always the newest, so its stroke is the last one on the pad.
    const i = pad.strokes.lastIndexOf(change.stroke)
    const strokes = i >= 0 ? [...pad.strokes.slice(0, i), ...pad.strokes.slice(i + 1)] : pad.strokes
    return { strokes, undo, redo }
  }
  return { strokes: change.strokes, undo, redo }
}

export function redoPad(pad: PadState): PadState {
  const change = pad.redo[pad.redo.length - 1]
  if (!change) return pad
  const redo = pad.redo.slice(0, -1)
  const undo = [...pad.undo, change]
  if (change.kind === 'add') return { strokes: [...pad.strokes, change.stroke], undo, redo }
  return { strokes: [], undo, redo }
}

/** A point moves the stroke on only this far (pad units) from the last one kept: a still hand adds nothing. */
export const MIN_STEP = 2

/** Pressure 0..1 as stored (a stylus reports it; a finger or a mouse does not). */
export function pressureStep(pressure: number): number {
  if (!Number.isFinite(pressure)) return Math.round(PRESSURE_STEPS / 2)
  return Math.max(0, Math.min(PRESSURE_STEPS, Math.round(pressure * PRESSURE_STEPS)))
}

/** Add a point (pad units) to a stroke being drawn, unless it is too near the last one. Returns whether it was added. */
export function extendStroke(stroke: Stroke, x: number, y: number, pressure?: number): boolean {
  const px = Math.round(x)
  const py = Math.round(y)
  const n = stroke.xy.length
  if (n >= 2) {
    const dx = px - stroke.xy[n - 2]!
    const dy = py - stroke.xy[n - 1]!
    if (dx * dx + dy * dy < MIN_STEP * MIN_STEP) return false
  }
  stroke.xy.push(px, py)
  if (stroke.p) stroke.p.push(pressureStep(pressure ?? 0.5))
  return true
}

/** A new stroke at its first point. `pressure` only for a stylus that reports it. */
export function startStroke(tool: Tool, ink: Ink, x: number, y: number, pressure?: number): Stroke {
  const stroke: Stroke = { tool, ink, xy: [] }
  if (pressure !== undefined) stroke.p = []
  extendStroke(stroke, x, y, pressure)
  return stroke
}

// ---- compact text ------------------------------------------------------------------------------------------------

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const VALUE = new Map([...ALPHA].map((c, i) => [c, i]))
const TOOL_CHAR: Record<Tool, string> = { pen: 'p', highlighter: 'h', eraser: 'e' }
const CHAR_TOOL: Record<string, Tool> = { p: 'pen', h: 'highlighter', e: 'eraser' }
const INK_CHAR: Record<Ink, string> = { navy: 'n', red: 'r', green: 'g' }
const CHAR_INK: Record<string, Ink> = { n: 'navy', r: 'red', g: 'green' }
const VERSION = 'v1'

function zigzag(n: number): number {
  return n >= 0 ? n * 2 : -n * 2 - 1
}

function unzigzag(n: number): number {
  return n % 2 === 0 ? n / 2 : -(n + 1) / 2
}

function pushVarint(out: string[], value: number): void {
  let v = zigzag(Math.round(value))
  while (v >= 32) {
    out.push(ALPHA[(v % 32) + 32]!)
    v = Math.floor(v / 32)
  }
  out.push(ALPHA[v]!)
}

function readVarints(text: string): number[] | null {
  const out: number[] = []
  let value = 0
  let scale = 1
  for (const c of text) {
    const d = VALUE.get(c)
    if (d === undefined) return null
    value += (d % 32) * scale
    if (d >= 32) {
      scale *= 32
      if (scale > 2 ** 40) return null
    } else {
      out.push(unzigzag(value))
      value = 0
      scale = 1
    }
  }
  return scale === 1 && value === 0 ? out : null
}

/** The strokes as compact text: "v1;" then each stroke, ";" between them. */
export function encodeStrokes(strokes: readonly Stroke[]): string {
  const parts = strokes.map((s) => {
    const out: string[] = [TOOL_CHAR[s.tool], INK_CHAR[s.ink], s.p ? 'P' : 'E']
    const n = Math.floor(s.xy.length / 2)
    pushVarint(out, n)
    let x = 0
    let y = 0
    let p = 0
    for (let i = 0; i < n; i++) {
      const nx = s.xy[i * 2]!
      const ny = s.xy[i * 2 + 1]!
      pushVarint(out, nx - x)
      pushVarint(out, ny - y)
      x = nx
      y = ny
      if (s.p) {
        const np = s.p[i] ?? p
        pushVarint(out, np - p)
        p = np
      }
    }
    return out.join('')
  })
  return [VERSION, ...parts].join(';')
}

/** The strokes back from `encodeStrokes`, or null for text this version cannot read (then the pad starts empty). */
export function decodeStrokes(text: string): Stroke[] | null {
  if (typeof text !== 'string') return null
  const parts = text.split(';')
  if (parts[0] !== VERSION) return null
  const strokes: Stroke[] = []
  for (const part of parts.slice(1)) {
    if (part.length < 4) return null
    const tool = CHAR_TOOL[part[0]!]
    const ink = CHAR_INK[part[1]!]
    const flag = part[2]
    if (!tool || !ink || (flag !== 'P' && flag !== 'E')) return null
    const nums = readVarints(part.slice(3))
    if (!nums || nums.length === 0) return null
    const n = nums[0]!
    const per = flag === 'P' ? 3 : 2
    if (n < 1 || nums.length !== 1 + n * per) return null
    const xy: number[] = []
    const p: number[] = []
    let x = 0
    let y = 0
    let q = 0
    for (let i = 0; i < n; i++) {
      x += nums[1 + i * per]!
      y += nums[2 + i * per]!
      xy.push(x, y)
      if (flag === 'P') {
        q += nums[3 + i * per]!
        if (q < 0 || q > PRESSURE_STEPS) return null
        p.push(q)
      }
    }
    strokes.push(flag === 'P' ? { tool, ink, xy, p } : { tool, ink, xy })
  }
  return strokes
}
