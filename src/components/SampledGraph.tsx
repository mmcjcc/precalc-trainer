import { PALETTE, type GraphMarker, type GraphSample, type GraphSpec } from '@/shared/types'

const W = 440
const H = 360
const PAD = { left: 44, right: 18, top: 28, bottom: 32 }

type Pt = { x: number; y: number }

/**
 * Polyline through GraphSpec.samples, with turning points labelled. Used when the curve is not one
 * expression. Expression graphs never set `samples`, so they stay on function-plot.
 */
export function SampledGraph({ spec }: { spec: GraphSpec }) {
  const samples = spec.samples ?? []
  const markers = [...(spec.markers ?? [])].sort((a, b) => a.x - b.x)
  const [xLo, xHi] = spec.xDomain ?? [Math.min(...samples.map((s) => s.x)), Math.max(...samples.map((s) => s.x))]
  const [yLo, yHi] = spec.yDomain ?? [xLo, xHi]
  if (samples.length < 2 || !(xHi > xLo) || !(yHi > yLo)) {
    return <p className="text-sm text-navy/60">Nothing to graph for this problem.</p>
  }

  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const sx = (x: number) => PAD.left + ((x - xLo) / (xHi - xLo)) * innerW
  const sy = (y: number) => PAD.top + ((yHi - y) / (yHi - yLo)) * innerH
  const inY = (y: number) => y >= yLo && y <= yHi

  const pieces = clipPieces(samples, yLo, yHi)
  const axisY = inY(0) ? sy(0) : H - PAD.bottom
  const axisX = xLo <= 0 && 0 <= xHi ? sx(0) : PAD.left
  const labels = placeLabels(markers, sx, sy)
  const ends = endPhrase(samples, markers)
  const listed = markers.map((m) => m.label).join(', ')
  const aria = `Graph of the function. Turning points: ${listed}. ${ends}`

  const grid: { x1: number; y1: number; x2: number; y2: number }[] = []
  const x0 = Math.ceil(xLo)
  const x1 = Math.floor(xHi)
  if (x1 - x0 <= 24) {
    for (let x = x0; x <= x1; x++) grid.push({ x1: sx(x), y1: PAD.top, x2: sx(x), y2: H - PAD.bottom })
  }
  const y0 = Math.ceil(yLo)
  const y1 = Math.floor(yHi)
  if (y1 - y0 <= 24) {
    for (let y = y0; y <= y1; y++) grid.push({ x1: PAD.left, y1: sy(y), x2: W - PAD.right, y2: sy(y) })
  }

  return (
    <figure className="space-y-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[440px] rounded-xl bg-white" role="img" aria-label={aria}>
        {grid.map((g, i) => (
          <line key={i} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={PALETTE.gray} strokeOpacity={0.25} strokeWidth={1} />
        ))}
        <line x1={PAD.left} y1={axisY} x2={W - PAD.right} y2={axisY} stroke={PALETTE.navy} strokeOpacity={0.55} strokeWidth={1.25} />
        <line x1={axisX} y1={PAD.top} x2={axisX} y2={H - PAD.bottom} stroke={PALETTE.navy} strokeOpacity={0.55} strokeWidth={1.25} />
        {pieces.map((pts, i) => (
          <polyline key={i} points={pts.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')} fill="none" stroke={PALETTE.navy} strokeWidth={2.5} strokeLinejoin="round" />
        ))}
        {markers.map((m) => (
          <circle key={`${m.x},${m.y}`} cx={sx(m.x)} cy={sy(m.y)} r={4.5} fill={PALETTE.coral} stroke="white" strokeWidth={1.5} />
        ))}
        {labels.map((lab) => (
          <g key={lab.key}>
            <rect x={lab.x - 2} y={lab.y - 1} width={lab.w + 4} height={lab.h + 2} rx={3} fill="white" fillOpacity={0.9} />
            <text x={lab.x} y={lab.y + 12} fontSize={12} fill={PALETTE.navy}>
              {lab.text}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="text-xs text-navy/70">navy: the function · labelled points are the turning points</figcaption>
    </figure>
  )
}

function endPhrase(samples: GraphSample[], markers: GraphMarker[]): string {
  const first = markers[0]
  const last = markers[markers.length - 1]
  if (!first || !last) return ''
  const leftUp = samples[0]!.y > first.y
  const rightUp = samples[samples.length - 1]!.y > last.y
  if (leftUp && rightUp) return 'Both ends go up.'
  if (!leftUp && !rightUp) return 'Both ends go down.'
  if (!leftUp && rightUp) return 'The left end goes down and the right end goes up.'
  return 'The left end goes up and the right end goes down.'
}

/** Break the polyline where it leaves the y-window, clipping each piece to the frame. */
function clipPieces(samples: GraphSample[], yLo: number, yHi: number): Pt[][] {
  const pieces: Pt[][] = []
  let cur: Pt[] = []
  const push = (p: Pt) => {
    const prev = cur[cur.length - 1]
    if (!prev || prev.x !== p.x || prev.y !== p.y) cur.push(p)
  }
  const flush = () => {
    if (cur.length > 1) pieces.push(cur)
    cur = []
  }
  for (let i = 0; i < samples.length - 1; i++) {
    const seg = clipSegment(samples[i]!, samples[i + 1]!, yLo, yHi)
    if (!seg) {
      flush()
      continue
    }
    push(seg[0])
    push(seg[1])
    const bInside = samples[i + 1]!.y >= yLo && samples[i + 1]!.y <= yHi
    if (!bInside) flush()
  }
  flush()
  return pieces
}

function clipSegment(a: Pt, b: Pt, yLo: number, yHi: number): [Pt, Pt] | null {
  const aIn = a.y >= yLo && a.y <= yHi
  const bIn = b.y >= yLo && b.y <= yHi
  if (aIn && bIn) return [a, b]
  if ((a.y < yLo && b.y < yLo) || (a.y > yHi && b.y > yHi)) return null
  const at = (from: Pt, to: Pt, y: number): Pt => {
    const t = (y - from.y) / (to.y - from.y)
    return { x: from.x + t * (to.x - from.x), y }
  }
  if ((a.y < yLo && b.y > yHi) || (a.y > yHi && b.y < yLo)) {
    const lo = at(a, b, yLo)
    const hi = at(a, b, yHi)
    return a.y < yLo ? [lo, hi] : [hi, lo]
  }
  const bound = (y: number) => (y < yLo ? yLo : yHi)
  const p = aIn ? a : at(a, b, bound(a.y))
  const q = bIn ? b : at(a, b, bound(b.y))
  return [p, q]
}

interface LabelBox {
  key: string
  text: string
  x: number
  y: number
  w: number
  h: number
}

function placeLabels(markers: GraphMarker[], sx: (x: number) => number, sy: (y: number) => number): LabelBox[] {
  const placed: LabelBox[] = []
  const lh = 16
  for (const m of markers) {
    const w = Math.max(36, m.label.length * 7.1)
    const px = sx(m.x)
    const py = sy(m.y)
    const below = m.labelSide !== 'above'
    const options = [
      { x: px - w / 2, y: below ? py + 8 : py - lh - 8 },
      { x: px - w / 2, y: below ? py - lh - 8 : py + 8 },
      { x: px + 10, y: py - lh / 2 },
      { x: px - w - 10, y: py - lh / 2 },
    ]
    let chosen = options[0]!
    for (const o of options) {
      const box = { x: o.x, y: o.y, w, h: lh }
      const inside = box.x >= 2 && box.y >= 2 && box.x + box.w <= W - 2 && box.y + box.h <= H - 2
      if (inside && !placed.some((p) => overlaps(p, box))) {
        chosen = o
        break
      }
    }
    placed.push({ key: `${m.x},${m.y}`, text: m.label, x: chosen.x, y: chosen.y, w, h: lh })
  }
  return placed
}

function overlaps(a: LabelBox, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}
