/**
 * Drawing the scratch pad on a canvas. The strokes' points are pad units (ink.ts); `scale` is CSS px per unit (the pad's
 * width in px / UNITS). Line widths are CSS px whatever the scale: the pen 2.6 px (thinner to thicker with a stylus's
 * pressure), the highlighter 16 px under the ink, the eraser 24 px.
 */
import { PALETTE } from '@/shared/types'
import { PRESSURE_STEPS, type Ink, type Stroke } from './ink'

/** The canvas calls the pad uses (a 2D context; tests record them). */
export interface PadContext {
  lineWidth: number
  lineCap: CanvasLineCap
  lineJoin: CanvasLineJoin
  strokeStyle: string | CanvasGradient | CanvasPattern
  fillStyle: string | CanvasGradient | CanvasPattern
  globalAlpha: number
  globalCompositeOperation: GlobalCompositeOperation
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  arc(x: number, y: number, r: number, start: number, end: number): void
  stroke(): void
  fill(): void
  clearRect(x: number, y: number, w: number, h: number): void
}

/** The pen's inks: the app's navy, its red text colour and its green (each at least 4.5:1 on white). */
export const INK_COLOR: Record<Ink, string> = {
  navy: PALETTE.navy,
  red: PALETTE.coral700,
  green: PALETTE.success,
}

export const PEN_WIDTH = 2.6
export const HIGHLIGHTER_WIDTH = 16
export const ERASER_WIDTH = 24
const HIGHLIGHTER = PALETTE.gold

/** The pen's width at a stored pressure: half the base at the lightest touch, about 1.6 times at the hardest. */
export function penWidth(step: number | undefined): number {
  if (step === undefined) return PEN_WIDTH
  return PEN_WIDTH * (0.5 + (1.1 * step) / PRESSURE_STEPS)
}

function style(ctx: PadContext, stroke: Stroke): void {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (stroke.tool === 'eraser') {
    // destination-out keeps only the ink's alpha: what the eraser passes over goes, whatever its colour.
    ctx.globalCompositeOperation = 'destination-out'
    ctx.globalAlpha = 1
    ctx.strokeStyle = PALETTE.navy
    ctx.fillStyle = PALETTE.navy
    ctx.lineWidth = ERASER_WIDTH
  } else if (stroke.tool === 'highlighter') {
    // Under the ink it marks: multiply keeps the pen's lines dark where the highlighter crosses them.
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = 0.85
    ctx.strokeStyle = HIGHLIGHTER
    ctx.fillStyle = HIGHLIGHTER
    ctx.lineWidth = HIGHLIGHTER_WIDTH
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.strokeStyle = INK_COLOR[stroke.ink]
    ctx.fillStyle = INK_COLOR[stroke.ink]
    ctx.lineWidth = PEN_WIDTH
  }
}

function reset(ctx: PadContext): void {
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}

/** One stroke. A single point is a dot; a stylus's stroke is drawn segment by segment, each as wide as its pressure. */
export function drawStroke(ctx: PadContext, stroke: Stroke, scale: number): void {
  const n = Math.floor(stroke.xy.length / 2)
  if (n === 0) return
  style(ctx, stroke)
  const x = (i: number) => stroke.xy[i * 2]! * scale
  const y = (i: number) => stroke.xy[i * 2 + 1]! * scale
  const pressured = stroke.tool === 'pen' && stroke.p !== undefined
  if (n === 1) {
    ctx.beginPath()
    ctx.arc(x(0), y(0), (pressured ? penWidth(stroke.p![0]) : ctx.lineWidth) / 2, 0, Math.PI * 2)
    ctx.fill()
  } else if (pressured) {
    for (let i = 1; i < n; i++) {
      ctx.lineWidth = penWidth((stroke.p![i - 1]! + stroke.p![i]!) / 2)
      ctx.beginPath()
      ctx.moveTo(x(i - 1), y(i - 1))
      ctx.lineTo(x(i), y(i))
      ctx.stroke()
    }
  } else {
    ctx.beginPath()
    ctx.moveTo(x(0), y(0))
    for (let i = 1; i < n; i++) ctx.lineTo(x(i), y(i))
    ctx.stroke()
  }
  reset(ctx)
}

/** The whole pad: cleared, then every stroke in order (and the one being drawn, last). */
export function drawPad(ctx: PadContext, strokes: readonly Stroke[], scale: number, width: number, height: number, live?: Stroke | null): void {
  ctx.clearRect(0, 0, width, height)
  for (const s of strokes) drawStroke(ctx, s, scale)
  if (live) drawStroke(ctx, live, scale)
}
