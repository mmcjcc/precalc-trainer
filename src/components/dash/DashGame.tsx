/**
 * The Monster Dash canvas: one run of the pure game (src/dash/engine.ts) drawn 8-bit — a 320x180
 * world scaled up with `image-rendering: pixelated`, the runner rasterized from her monster's own
 * art (src/dash/sprite.ts). One input: tap, click, Space or ArrowUp. The run starts on the first
 * input and `onDone(score)` fires once when it ends; "play again" remounts the component.
 */
import { useEffect, useRef } from 'react'
import { createDash, dashScore, DASH_H, DASH_W, GROUND_Y, OBSTACLE_BOX, RUNNER_SIZE, RUNNER_X, stepDash, type DashObstacle, type DashState } from '@/dash/engine'
import { loadDashSprite } from '@/dash/sprite'

const SKY = '#fffdf2'
const GROUND = '#e7ebf7'
const GROUND_LINE = '#1f2a63'
const INK = '#1f2a63'
const ACCENT = '#b45309'

function drawObstacle(ctx: CanvasRenderingContext2D, o: DashObstacle, screenX: number) {
  const box = OBSTACLE_BOX[o.kind]
  const x = Math.round(screenX)
  const top = GROUND_Y - box.h
  ctx.fillStyle = INK
  if (o.kind === 'cone' || o.kind === 'twins') {
    // Stacked bars make a chunky triangle; twins are two of them, low and wide.
    const cones = o.kind === 'twins' ? 2 : 1
    const w = o.kind === 'twins' ? 14 : box.w
    for (let c = 0; c < cones; c++) {
      const cx = x + c * 16
      for (let row = 0; row < box.h; row += 4) {
        const shrink = Math.floor(((box.h - row) / box.h) * (w / 2 - 1))
        ctx.fillRect(cx + shrink, top + row, w - 2 * shrink, 4)
      }
    }
    return
  }
  if (o.kind === 'block') {
    ctx.fillRect(x, top, box.w, box.h)
    ctx.fillStyle = SKY
    ctx.font = 'bold 9px monospace'
    ctx.fillText('x²', x + 3, top + 11)
    return
  }
  if (o.kind === 'flask') {
    // A pixel Erlenmeyer: narrow neck, wide base, a stripe of liquid.
    ctx.fillRect(x + 5, top, 6, 7)
    for (let row = 7; row < box.h; row += 3) {
      const grow = Math.min(5, row - 6)
      ctx.fillRect(x + 5 - grow, top + row, 6 + 2 * grow, 3)
    }
    ctx.fillStyle = ACCENT
    ctx.fillRect(x + 2, top + box.h - 6, 12, 3)
    return
  }
  // π: two legs and a bar.
  ctx.fillRect(x, top, box.w, 5)
  ctx.fillRect(x + 3, top + 5, 4, box.h - 5)
  ctx.fillRect(x + box.w - 7, top + 5, 4, box.h - 5)
}

function drawRunner(ctx: CanvasRenderingContext2D, s: DashState, sprite: HTMLCanvasElement | null) {
  const x = Math.round(RUNNER_X)
  const y = Math.round(s.y)
  if (sprite) {
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(sprite, x - 1, y - 1, RUNNER_SIZE + 2, RUNNER_SIZE + 2)
    return
  }
  // No sprite (art missing or the SVG could not load): a friendly pixel blob.
  ctx.fillStyle = INK
  ctx.fillRect(x, y + 4, RUNNER_SIZE, RUNNER_SIZE - 4)
  ctx.fillRect(x + 3, y, RUNNER_SIZE - 6, 6)
  ctx.fillStyle = SKY
  ctx.fillRect(x + 5, y + 7, 4, 4)
  ctx.fillRect(x + 13, y + 7, 4, 4)
}

function draw(ctx: CanvasRenderingContext2D, s: DashState, sprite: HTMLCanvasElement | null, started: boolean) {
  ctx.clearRect(0, 0, DASH_W, DASH_H)
  ctx.fillStyle = SKY
  ctx.fillRect(0, 0, DASH_W, DASH_H)
  ctx.fillStyle = GROUND
  ctx.fillRect(0, GROUND_Y, DASH_W, DASH_H - GROUND_Y)
  ctx.fillStyle = GROUND_LINE
  ctx.fillRect(0, GROUND_Y, DASH_W, 2)
  // Ground ticks scroll with the world so the speed reads.
  for (let wx = Math.floor(s.dist / 24) * 24; wx < s.dist + DASH_W; wx += 24) {
    ctx.fillRect(Math.round(wx - s.dist), GROUND_Y + 8, 8, 2)
  }
  for (const o of s.obstacles) drawObstacle(ctx, o, o.x - s.dist)
  drawRunner(ctx, s, sprite)
  ctx.fillStyle = INK
  ctx.font = 'bold 10px monospace'
  ctx.textAlign = 'right'
  ctx.fillText(String(dashScore(s)).padStart(5, '0'), DASH_W - 6, 14)
  ctx.textAlign = 'left'
  if (!started) {
    ctx.font = 'bold 11px monospace'
    ctx.fillText('Tap or press Space to run', 70, 80)
  }
}

export function DashGame({ runner, seed, onDone }: { runner: string; seed: number; onDone: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const state = createDash(seed)
    let sprite: HTMLCanvasElement | null = null
    let started = false
    let jumpQueued = false
    let lastT: number | null = null
    let raf = 0
    let ended = false

    void loadDashSprite(runner).then((s) => {
      sprite = s
    })

    const press = () => {
      if (!started) started = true
      jumpQueued = true
    }
    const onPointer = (e: PointerEvent) => {
      e.preventDefault()
      press()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault()
        press()
      }
    }
    canvas.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)

    const frame = (t: number) => {
      if (document.hidden || lastT === null || !started) {
        lastT = t
      } else {
        stepDash(state, (t - lastT) / 1000, jumpQueued)
        jumpQueued = false
        lastT = t
      }
      draw(ctx, state, sprite, started)
      if (state.over) {
        if (!ended) {
          ended = true
          doneRef.current(dashScore(state))
        }
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [runner, seed])

  return (
    <canvas
      ref={canvasRef}
      width={DASH_W}
      height={DASH_H}
      data-dash-canvas
      aria-label="Monster Dash: tap, click, or press Space to jump over the obstacles"
      className="w-full max-w-[40rem] touch-none select-none rounded-xl border border-navy-100"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
