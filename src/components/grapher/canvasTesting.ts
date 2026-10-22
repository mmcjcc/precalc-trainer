/**
 * Test helpers for the grapher (jsdom has no canvas): a fake 2D context that records what the plane drew, so a test can
 * check the shading, the dashed edge or the dots without pixels. Only tests import this file.
 */

export interface DrawCall {
  op: string
  args: unknown[]
  fillStyle?: string
  strokeStyle?: string
  dash?: number[]
}

export interface FakeCanvas {
  calls: DrawCall[]
  /** Calls since the last clearRect (one frame). */
  lastFrame: () => DrawCall[]
  restore: () => void
}

const RECORDED = ['moveTo', 'lineTo', 'arc', 'fill', 'stroke', 'fillRect', 'clearRect', 'fillText', 'strokeText', 'closePath', 'beginPath']

export function installFakeCanvas(): FakeCanvas {
  const calls: DrawCall[] = []
  const original = HTMLCanvasElement.prototype.getContext
  function makeContext() {
    let dash: number[] = []
    const ctx: Record<string, unknown> = {
      fillStyle: '#000',
      strokeStyle: '#000',
      lineWidth: 1,
      lineJoin: 'miter',
      lineCap: 'butt',
      font: '10px sans-serif',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      setTransform: () => {},
      setLineDash: (d: number[]) => {
        dash = [...d]
      },
      getLineDash: () => dash,
      measureText: (t: string) => ({ width: t.length * 7 }),
    }
    for (const op of RECORDED) {
      ctx[op] = (...args: unknown[]) => {
        calls.push({ op, args, fillStyle: String(ctx.fillStyle), strokeStyle: String(ctx.strokeStyle), dash: [...dash] })
      }
    }
    return ctx
  }
  const contexts = new WeakMap<HTMLCanvasElement, Record<string, unknown>>()
  HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, kind: string) {
    if (kind !== '2d') return null
    let ctx = contexts.get(this)
    if (!ctx) {
      ctx = makeContext()
      contexts.set(this, ctx)
    }
    return ctx as unknown as CanvasRenderingContext2D
  } as typeof HTMLCanvasElement.prototype.getContext
  return {
    calls,
    lastFrame: () => {
      let start = 0
      calls.forEach((c, i) => {
        if (c.op === 'clearRect') start = i
      })
      return calls.slice(start)
    },
    restore: () => {
      HTMLCanvasElement.prototype.getContext = original
    },
  }
}
