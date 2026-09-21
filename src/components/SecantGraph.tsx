import { useMemo } from 'react'
import { compileExpr, niceNumber } from '@/engine'
import { PALETTE, type GraphSpec } from '@/shared/types'

const W = 320
const H = 280
const PAD = { left: 44, right: 14, top: 14, bottom: 30 }

type Pt = { x: number; y: number }

function show(v: number): string {
  return niceNumber(v).replace(/-/g, '−')
}

/**
 * The worksheet sketch of a difference quotient: f in navy, ONE secant line (coral, dashed) through
 * (x, f(x)) and (x + h, f(x + h)), dashed drops to the axes labelled x, x + h, f(x), f(x + h), and
 * the run h and the rise f(x + h) − f(x) as the legs of a right triangle. Plain SVG (no plotting
 * library), so it renders anywhere and reads well at phone width.
 */
export function SecantGraph({ spec }: { spec: GraphSpec }) {
  const f = spec.f ?? ''
  const secant = spec.secant
  const model = useMemo(() => {
    if (!secant) return null
    const F = compileExpr(f)
    const at = (x: number): number | null => {
      const v = F({ x })
      return v === 'undef' ? null : v
    }
    const { x0, h0 } = secant
    const x1 = x0 + h0
    const y0 = at(x0)
    const y1 = at(x1)
    if (y0 === null || y1 === null) return null
    const [lo, hi] = spec.xDomain ?? [x0 - 4, x1 + 4]
    const n = 240
    const samples: (Pt | null)[] = Array.from({ length: n + 1 }, (_, i) => {
      const x = lo + ((hi - lo) * i) / n
      const y = at(x)
      return y === null ? null : { x, y }
    })
    // y-window: the middle of f's values on the window (asymptotes would flatten everything), the two
    // secant points, and 0 when it is close, padded.
    const ys = samples.filter((p): p is Pt => p !== null).map((p) => p.y).sort((a, b) => a - b)
    const q = (t: number) => ys[Math.min(ys.length - 1, Math.max(0, Math.round(t * (ys.length - 1))))] ?? 0
    let yLo = Math.min(q(0.1), y0, y1)
    let yHi = Math.max(q(0.9), y0, y1)
    const span = Math.max(1, yHi - yLo)
    if (yLo > 0 && yLo < span) yLo = 0
    if (yHi < 0 && -yHi < span) yHi = 0
    yLo -= span * 0.15
    yHi += span * 0.15
    return { x0, x1, y0, y1, lo, hi, yLo, yHi, samples, slope: (y1 - y0) / h0 }
  }, [f, secant, spec.xDomain])

  if (!model) return <p className="text-sm text-navy/60">Nothing to graph for this problem.</p>
  const { x0, x1, y0, y1, lo, hi, yLo, yHi, samples, slope } = model
  const sx = (x: number) => PAD.left + ((x - lo) / (hi - lo)) * (W - PAD.left - PAD.right)
  const sy = (y: number) => H - PAD.bottom - ((y - yLo) / (yHi - yLo)) * (H - PAD.top - PAD.bottom)
  const inY = (y: number) => y >= yLo && y <= yHi

  // f as polyline pieces: break where f is undefined or leaves the window.
  const pieces: string[] = []
  let cur: string[] = []
  for (const p of samples) {
    if (p && inY(p.y)) cur.push(`${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`)
    else if (cur.length) {
      if (cur.length > 1) pieces.push(cur.join(' '))
      cur = []
    }
  }
  if (cur.length > 1) pieces.push(cur.join(' '))

  // Axes: at 0 when 0 is in view, else along the bottom / left edge.
  const axisY = inY(0) ? sy(0) : H - PAD.bottom
  const axisX = lo <= 0 && 0 <= hi ? sx(0) : PAD.left
  const secantAt = (x: number) => y0 + slope * (x - x0)
  const clipX = (x: number) => Math.min(hi, Math.max(lo, x))
  // Secant line across the window, clipped to the y-range.
  const ends = [lo, hi].map((x) => {
    const y = secantAt(x)
    if (inY(y)) return { x, y }
    const yb = y > yHi ? yHi : yLo
    return { x: clipX(x0 + (yb - y0) / slope), y: yb }
  })
  // Right triangle under the secant: corner at (x + h, f(x)); the rise label goes right of it, or left
  // when there is no room.
  const riseRoom = W - PAD.right - (sx(x1) + 4) >= 84
  const color = { f: PALETTE.navy, secant: PALETTE.coral700, guide: PALETTE.gray, label: PALETTE.navy }

  return (
    <figure className="space-y-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[360px] rounded-xl bg-white"
        role="img"
        aria-label={`Graph of f(x) = ${f} with the secant line through (x, f(x)) = (${show(x0)}, ${show(y0)}) and (x + h, f(x + h)) = (${show(x1)}, ${show(y1)}), slope ${show(slope)}`}
      >
        {/* axes */}
        <line x1={PAD.left} y1={axisY} x2={W - PAD.right} y2={axisY} stroke={color.guide} strokeWidth={1} />
        <line x1={axisX} y1={PAD.top} x2={axisX} y2={H - PAD.bottom} stroke={color.guide} strokeWidth={1} />
        {/* f */}
        {pieces.map((pts, i) => (
          <polyline key={i} points={pts} fill="none" stroke={color.f} strokeWidth={2.5} />
        ))}
        {/* secant */}
        <line x1={sx(ends[0]!.x)} y1={sy(ends[0]!.y)} x2={sx(ends[1]!.x)} y2={sy(ends[1]!.y)} stroke={color.secant} strokeWidth={2} strokeDasharray="7 4" />
        {/* drops to the x-axis and across to the y-axis */}
        {[
          { x: x0, y: y0 },
          { x: x1, y: y1 },
        ].map((p) => (
          <g key={p.x} stroke={color.guide} strokeWidth={1} strokeDasharray="3 3">
            <line x1={sx(p.x)} y1={sy(p.y)} x2={sx(p.x)} y2={axisY} />
            <line x1={sx(p.x)} y1={sy(p.y)} x2={axisX} y2={sy(p.y)} />
          </g>
        ))}
        {/* run h and rise f(x + h) − f(x) */}
        <line x1={sx(x0)} y1={sy(y0)} x2={sx(x1)} y2={sy(y0)} stroke={color.secant} strokeWidth={1.5} />
        <line x1={sx(x1)} y1={sy(y0)} x2={sx(x1)} y2={sy(y1)} stroke={color.secant} strokeWidth={1.5} />
        <text x={(sx(x0) + sx(x1)) / 2} y={sy(y0) + (y0 <= y1 ? 15 : -6)} textAnchor="middle" fontSize={13} fontStyle="italic" fill={color.secant}>
          h
        </text>
        <text
          x={riseRoom ? sx(x1) + 4 : sx(x1) - 4}
          y={(sy(y0) + sy(y1)) / 2 + 4}
          textAnchor={riseRoom ? 'start' : 'end'}
          fontSize={11}
          fill={color.secant}
        >
          f(x + h) − f(x)
        </text>
        {/* the two points */}
        <circle cx={sx(x0)} cy={sy(y0)} r={4} fill={color.secant} />
        <circle cx={sx(x1)} cy={sy(y1)} r={4} fill={color.secant} />
        {/* axis labels */}
        <text x={sx(x0)} y={Math.min(H - 4, axisY + 16)} textAnchor="middle" fontSize={12} fontStyle="italic" fill={color.label}>
          x
        </text>
        <text x={sx(x1)} y={Math.min(H - 4, axisY + 16)} textAnchor="middle" fontSize={12} fontStyle="italic" fill={color.label}>
          x + h
        </text>
        <text x={Math.max(2, axisX - 4)} y={sy(y0) + 4} textAnchor="end" fontSize={11} fontStyle="italic" fill={color.label}>
          f(x)
        </text>
        <text x={Math.max(2, axisX - 4)} y={sy(y1) + 4} textAnchor="end" fontSize={11} fontStyle="italic" fill={color.label}>
          f(x + h)
        </text>
      </svg>
      <figcaption className="text-xs text-navy/70">
        navy: f · coral dashed: the secant line. Here x = {show(x0)} and h = {show(x1 - x0)}: slope = (f({show(x1)}) − f({show(x0)}))/{show(x1 - x0)} = ({show(y1)} − {y0 < 0 ? `(${show(y0)})` : show(y0)})/
        {show(x1 - x0)} = {show(slope)}.
      </figcaption>
    </figure>
  )
}
