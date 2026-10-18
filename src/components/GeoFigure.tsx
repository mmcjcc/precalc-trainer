/**
 * A geometry figure from a GeoFigureSpec. It fills its container (no sideways scroll),
 * uses the app's colour tokens, and describes itself in words for a screen reader.
 * Units 2 and 3 should pass a spec rather than draw their own SVG.
 */
import { useId } from 'react'
import type { GeoAngleMark, GeoFigureSpec, GeoPoint } from '@/shared/types'

const NAVY = 'var(--color-navy)'
const NAVY_100 = 'var(--color-navy-100)'
const CORAL = 'var(--color-coral)'
const INK = 'var(--color-ink)'
const GOLD = 'var(--color-gold-text)'

const VW = 360
const PAD = 48
/** A line's name ("m", "t") is a little larger than an angle number, and italic, as in a textbook. */
const LINE_LABEL_SIZE = 15
/** Where an angle number without an arc starts, measured from the vertex along the angle's middle. */
const NUMBER_R = 14

export function GeoFigure({ spec }: { spec: GeoFigureSpec }) {
  const rawId = useId().replace(/:/g, '')
  const marker = `geo-arrow-${rawId}`
  const { sx, sy, h, at, pointSides, anglePlaces, linePlaces } = placeLabels(spec)

  return (
    <div className="w-full max-w-full overflow-hidden">
      <svg
        role="img"
        aria-label={spec.ariaLabel}
        viewBox={`0 0 ${VW} ${h}`}
        width="100%"
        className="block h-auto max-w-full"
      >
        <defs>
          <marker id={marker} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto-start-reverse">
            <path d="M0,0 L8,3 L0,6 Z" fill={NAVY} />
          </marker>
        </defs>
        {spec.grid && <Grid spec={spec} sx={sx} sy={sy} />}
        {spec.lines?.map((line, i) => {
          const a = at(line.through[0])
          const b = at(line.through[1])
          const drawn = clipExtended(a.x, a.y, b.x, b.y, 8, 8, VW - 8, h - 8)
          if (!drawn) return null
          const name = linePlaces[i]
          return (
            <g key={`line-${i}`}>
              <line
                data-geo="line"
                x1={drawn[0]}
                y1={drawn[1]}
                x2={drawn[2]}
                y2={drawn[3]}
                stroke={NAVY}
                strokeWidth={2}
                markerStart={`url(#${marker})`}
                markerEnd={`url(#${marker})`}
              />
              {line.arrows ? (
                <ParallelMarks x1={drawn[0]} y1={drawn[1]} x2={drawn[2]} y2={drawn[3]} count={line.arrows} />
              ) : null}
              {line.label && name ? (
                <text
                  data-geo="line-label"
                  x={name.x}
                  y={name.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={INK}
                  fontSize={LINE_LABEL_SIZE}
                  fontStyle="italic"
                  fontWeight={600}
                  {...HALO}
                >
                  {line.label}
                </text>
              ) : null}
            </g>
          )
        })}
        {spec.rays?.map((ray, i) => {
          const a = at(ray.from)
          const b = at(ray.through)
          const drawn = clipRay(a.x, a.y, b.x, b.y, 8, 8, VW - 8, h - 8)
          if (!drawn) return null
          return (
            <line
              key={`ray-${i}`}
              data-geo="ray"
              x1={drawn[0]}
              y1={drawn[1]}
              x2={drawn[2]}
              y2={drawn[3]}
              stroke={NAVY}
              strokeWidth={2}
              markerEnd={`url(#${marker})`}
            />
          )
        })}
        {spec.segments?.map((seg, i) => {
          const a = at(seg.from)
          const b = at(seg.to)
          return (
            <g key={`seg-${i}`} data-geo="segment">
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={NAVY} strokeWidth={2.5} strokeLinecap="round" />
              {seg.ticks ? <Ticks x1={a.x} y1={a.y} x2={b.x} y2={b.y} count={seg.ticks} /> : null}
              {seg.label ? <SegLabel x1={a.x} y1={a.y} x2={b.x} y2={b.y} text={seg.label} side={seg.labelSide ?? 'above'} /> : null}
            </g>
          )
        })}
        {spec.angles?.map((angle, i) => (
          <AngleMark key={`ang-${i}`} angle={angle} at={at} place={anglePlaces[i] ?? null} />
        ))}
        {spec.points.map((p) => {
          if (!p.label) return null
          return (
            <g key={p.id} data-geo="point">
              <circle cx={sx(p.x)} cy={sy(p.y)} r={4} fill={NAVY} />
              <PointLabel x={sx(p.x)} y={sy(p.y)} text={p.label} side={pointSides.get(p.id) ?? p.labelSide ?? 'above'} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function Grid({ spec, sx, sy }: { spec: GeoFigureSpec; sx: (x: number) => number; sy: (y: number) => number }) {
  const grid = spec.grid
  if (!grid) return null
  const xs: number[] = []
  const ys: number[] = []
  for (let x = Math.ceil(grid.xMin); x <= Math.floor(grid.xMax); x++) xs.push(x)
  for (let y = Math.ceil(grid.yMin); y <= Math.floor(grid.yMax); y++) ys.push(y)
  const top = sy(grid.yMax)
  const bottom = sy(grid.yMin)
  const left = sx(grid.xMin)
  const right = sx(grid.xMax)
  return (
    <g data-geo="grid">
      {xs.map((x) => (
        <line key={`vx${x}`} x1={sx(x)} y1={top} x2={sx(x)} y2={bottom} stroke={x === 0 ? NAVY : NAVY_100} strokeWidth={x === 0 ? 1.5 : 1} />
      ))}
      {ys.map((y) => (
        <line key={`hy${y}`} x1={left} y1={sy(y)} x2={right} y2={sy(y)} stroke={y === 0 ? NAVY : NAVY_100} strokeWidth={y === 0 ? 1.5 : 1} />
      ))}
      {grid.yMin <= 0 && grid.yMax >= 0 ? (
        <text x={right - 4} y={sy(0) - 6} textAnchor="end" fill={GOLD} fontSize={12}>
          x
        </text>
      ) : null}
      {grid.xMin <= 0 && grid.xMax >= 0 ? (
        <text x={sx(0) + 6} y={top + 12} fill={GOLD} fontSize={12}>
          y
        </text>
      ) : null}
    </g>
  )
}

/** Arrow marks along a line, about a third of the way across, pointing with the line. */
function ParallelMarks({ x1, y1, x2, y2, count }: { x1: number; y1: number; x2: number; y2: number; count: 1 | 2 }) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  const ux = (x2 - x1) / len
  const uy = (y2 - y1) / len
  const nx = -uy
  const ny = ux
  const spots = count === 1 ? [0.32] : [0.32, 0.32 + 12 / len]
  return (
    <g data-geo="parallel" data-count={count}>
      {spots.map((t, i) => {
        const cx = x1 + (x2 - x1) * t
        const cy = y1 + (y2 - y1) * t
        const back = 7
        const wing = 5
        return (
          <polyline
            key={i}
            points={`${cx - ux * back + nx * wing},${cy - uy * back + ny * wing} ${cx},${cy} ${cx - ux * back - nx * wing},${cy - uy * back - ny * wing}`}
            fill="none"
            stroke={CORAL}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      })}
    </g>
  )
}

function Ticks({ x1, y1, x2, y2, count }: { x1: number; y1: number; x2: number; y2: number; count: 1 | 2 | 3 }) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  const nx = -(y2 - y1) / len
  const ny = (x2 - x1) / len
  const ux = (x2 - x1) / len
  const uy = (y2 - y1) / len
  const gap = 5
  const start = -((count - 1) * gap) / 2
  return (
    <g data-geo="ticks" data-count={count}>
      {Array.from({ length: count }, (_, i) => {
        const cx = mx + ux * (start + i * gap)
        const cy = my + uy * (start + i * gap)
        return (
          <line
            key={i}
            x1={cx - nx * 7}
            y1={cy - ny * 7}
            x2={cx + nx * 7}
            y2={cy + ny * 7}
            stroke={CORAL}
            strokeWidth={2}
            strokeLinecap="round"
          />
        )
      })}
    </g>
  )
}

/** Unit normal pointing to the given side of the segment (screen y grows down). */
function sideNormal(x1: number, y1: number, x2: number, y2: number, side: 'above' | 'below'): [number, number] {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  let nx = -(y2 - y1) / len
  let ny = (x2 - x1) / len
  if (ny > 0 || (Math.abs(ny) < 0.25 && nx > 0)) {
    nx = -nx
    ny = -ny
  }
  return side === 'below' ? [-nx, -ny] : [nx, ny]
}

function SegLabel({ x1, y1, x2, y2, text, side }: { x1: number; y1: number; x2: number; y2: number; text: string; side: 'above' | 'below' }) {
  if (side === 'below') return <DimLabel x1={x1} y1={y1} x2={x2} y2={y2} text={text} />
  const [nx, ny] = sideNormal(x1, y1, x2, y2, side)
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return (
    <text data-geo="seg-label" x={mx + nx * 14} y={my + ny * 14} textAnchor="middle" dominantBaseline="middle" fill={INK} fontSize={13} {...HALO}>
      {text}
    </text>
  )
}

/**
 * A length labeled below its segment, drawn as a dimension line |—— 43 ——| clear of the point
 * letters. The whole segment lies on top of its parts, so this is what shows it is one length.
 */
function DimLabel({ x1, y1, x2, y2, text }: { x1: number; y1: number; x2: number; y2: number; text: string }) {
  const [nx, ny] = sideNormal(x1, y1, x2, y2, 'below')
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  const ux = (x2 - x1) / len
  const uy = (y2 - y1) / len
  const off = 34
  const ax = x1 + nx * off
  const ay = y1 + ny * off
  const bx = x2 + nx * off
  const by = y2 + ny * off
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  const gap = Math.min(len / 2 - 4, text.length * 3.8 + 6)
  return (
    <g data-geo="dimension">
      <line x1={ax} y1={ay} x2={mx - ux * gap} y2={my - uy * gap} stroke={INK} strokeWidth={1} />
      <line x1={mx + ux * gap} y1={my + uy * gap} x2={bx} y2={by} stroke={INK} strokeWidth={1} />
      <line x1={ax - nx * 6} y1={ay - ny * 6} x2={ax + nx * 6} y2={ay + ny * 6} stroke={INK} strokeWidth={1} />
      <line x1={bx - nx * 6} y1={by - ny * 6} x2={bx + nx * 6} y2={by + ny * 6} stroke={INK} strokeWidth={1} />
      <text data-geo="seg-label" x={mx} y={my} textAnchor="middle" dominantBaseline="middle" fill={INK} fontSize={13}>
        {text}
      </text>
    </g>
  )
}

function PointLabel({ x, y, text, side }: { x: number; y: number; text: string; side: NonNullable<GeoPoint['labelSide']> }) {
  const [dx, dy, anchor] = POINT_SHIFT[side]
  return (
    <text x={x + dx} y={y + dy} textAnchor={anchor} dominantBaseline="middle" fill={INK} fontSize={14} fontWeight={600} {...HALO}>
      {text}
    </text>
  )
}

const POINT_SHIFT: Record<NonNullable<GeoPoint['labelSide']>, [number, number, 'start' | 'middle' | 'end']> = {
  above: [0, -12, 'middle'],
  below: [0, 16, 'middle'],
  left: [-10, 0, 'end'],
  right: [10, 0, 'start'],
  'above-left': [-8, -10, 'end'],
  'above-right': [8, -10, 'start'],
  'below-left': [-8, 14, 'end'],
  'below-right': [8, 14, 'start'],
}

/** A thin outline in the card colour, so a label stays readable where it crosses a line. */
const HALO = { stroke: 'var(--color-gold-100)', strokeWidth: 4, strokeLinejoin: 'round', paintOrder: 'stroke' } as const

/**
 * The arcs and the usual label spot of one angle mark. Without an arc the number starts close to the
 * vertex, inside the angle, and moves out along the angle's middle only as far as it must.
 */
function angleShape(angle: GeoAngleMark, at: (id: string) => { x: number; y: number }) {
  const v = at(angle.vertex)
  const a = at(angle.from)
  const b = at(angle.to)
  const angA = Math.atan2(a.y - v.y, a.x - v.x)
  const angB = Math.atan2(b.y - v.y, b.x - v.x)
  let delta = angB - angA
  while (delta <= -Math.PI) delta += 2 * Math.PI
  while (delta > Math.PI) delta -= 2 * Math.PI
  const arc = angle.arc !== false
  const count = angle.marks ?? 1
  const base = angle.radius ?? 22
  const outer = base + (count - 1) * 7
  return { v, a, b, angA, delta, count, base, outer, arc, bis: angA + delta / 2, labelR: arc ? outer + 16 : NUMBER_R }
}

interface LabelPlace {
  x: number
  y: number
  /** From the arc to the label, when the label had to move out to stay clear of the others. */
  leader?: [number, number, number, number]
}

type Box = { l: number; t: number; r: number; b: number }
const overlaps = (p: Box, q: Box) => p.l < q.r && q.l < p.r && p.t < q.b && q.t < p.b

/** Rough text box: 13 px digits and symbols are about 7 px wide. */
function textBox(x: number, y: number, text: string, size: number, anchor: 'start' | 'middle' | 'end' = 'middle'): Box {
  const w = text.length * size * 0.56 + 4
  const l = anchor === 'middle' ? x - w / 2 : anchor === 'start' ? x : x - w
  return { l, t: y - size * 0.62, r: l + w, b: y + size * 0.62 }
}

type Side = NonNullable<GeoPoint['labelSide']>
const SIDES: readonly Side[] = ['above', 'below', 'right', 'left', 'above-right', 'above-left', 'below-right', 'below-left']

function pointLabelBox(p: GeoPoint, side: Side, sx: (x: number) => number, sy: (y: number) => number): Box {
  const [dx, dy, anchor] = POINT_SHIFT[side]
  return textBox(sx(p.x) + dx, sy(p.y) + dy, p.label ?? p.id, 14, anchor)
}

/**
 * Which side of its dot each point's letter goes on. The spec's side wins unless the letter would sit
 * on a drawn line (a point partway along a line, labeled along the line), cover another letter or dot,
 * or leave the figure; then the first clear side is used.
 */
function placePointLabels(
  spec: GeoFigureSpec,
  at: (id: string) => { x: number; y: number },
  sx: (x: number) => number,
  sy: (y: number) => number,
  h: number,
): Map<string, Side> {
  const strokes = drawnStrokes(spec, at, h)
  const dots: Box[] = spec.points.map((p) => ({ l: sx(p.x) - 6, t: sy(p.y) - 6, r: sx(p.x) + 6, b: sy(p.y) + 6 }))
  const taken: Box[] = []
  const sides = new Map<string, Side>()
  for (const p of spec.points) {
    if (!p.label) continue
    const preferred = p.labelSide ?? 'above'
    const own = dots[spec.points.indexOf(p)]!
    const clear = (box: Box) =>
      box.l >= 2 && box.r <= VW - 2 && box.t >= 2 && box.b <= h - 2 &&
      !strokes.some((s) => segmentHitsBox(s, box)) &&
      !taken.some((t) => overlaps(t, box)) &&
      !dots.some((d) => d !== own && overlaps(d, box))
    const side = [preferred, ...SIDES.filter((s) => s !== preferred)].find((s) => clear(pointLabelBox(p, s, sx, sy))) ?? preferred
    sides.set(p.id, side)
    taken.push(pointLabelBox(p, side, sx, sy))
  }
  return sides
}

/**
 * Every label's spot, in drawing order: point letters, then angle labels, then line names. Each one keeps
 * clear of the lines, of the labels placed before it, and of the figure's edge.
 */
function placeLabels(spec: GeoFigureSpec) {
  const { sx, sy, h } = layoutOf(spec)
  const at = (id: string) => {
    const p = spec.points.find((point) => point.id === id)
    if (!p) throw new Error(`GeoFigure: no point ${id}`)
    return { x: sx(p.x), y: sy(p.y), point: p }
  }
  const pointSides = placePointLabels(spec, at, sx, sy, h)
  const taken: Box[] = []
  for (const p of spec.points) {
    // The dot, and its letter.
    taken.push({ l: sx(p.x) - 6, t: sy(p.y) - 6, r: sx(p.x) + 6, b: sy(p.y) + 6 })
    if (!p.label) continue
    taken.push(pointLabelBox(p, pointSides.get(p.id) ?? p.labelSide ?? 'above', sx, sy))
  }
  taken.push(...parallelMarkBoxes(spec, at, h))
  const strokes = drawnStrokes(spec, at, h)
  // What later labels keep off: the drawn lines plus each leader line as it is placed.
  const avoid = [...strokes]
  const anglePlaces = placeAngleLabels(spec, at, h, taken, avoid)
  const linePlaces = placeLineLabels(spec, at, h, taken, avoid)
  return { sx, sy, h, at, pointSides, anglePlaces, linePlaces, strokes }
}

/** One drawn label as a box in SVG units (the viewBox is 360 wide), for checks that labels stay apart. */
export interface GeoLabelBox extends Box {
  kind: 'point' | 'angle' | 'line'
  text: string
}

/**
 * The figure's size, every stroke it draws (lines and rays clipped as drawn, segments), every dot it draws,
 * and every label it draws as a box. Tests use this to check that labels keep off the lines, off the dots,
 * off each other, and inside the figure.
 */
export function geoFigureLayout(spec: GeoFigureSpec): {
  width: number
  height: number
  strokes: Stroke[]
  dots: Box[]
  labels: GeoLabelBox[]
  /** Leader lines, each with the text of the label it leads to. */
  leaders: { text: string; stroke: Stroke }[]
} {
  const { sx, sy, h, pointSides, anglePlaces, linePlaces, strokes } = placeLabels(spec)
  const labels: GeoLabelBox[] = []
  const dots: Box[] = []
  for (const p of spec.points) {
    if (!p.label) continue
    dots.push({ l: sx(p.x) - 4, t: sy(p.y) - 4, r: sx(p.x) + 4, b: sy(p.y) + 4 })
    labels.push({ kind: 'point', text: p.label, ...pointLabelBox(p, pointSides.get(p.id) ?? p.labelSide ?? 'above', sx, sy) })
  }
  ;(spec.angles ?? []).forEach((angle, i) => {
    const place = anglePlaces[i]
    if (angle.label && place) labels.push({ kind: 'angle', text: angle.label, ...textBox(place.x, place.y, angle.label, 13) })
  })
  ;(spec.lines ?? []).forEach((line, i) => {
    const place = linePlaces[i]
    if (line.label && place) labels.push({ kind: 'line', text: line.label, ...textBox(place.x, place.y, line.label, LINE_LABEL_SIZE) })
  })
  const leaders = (spec.angles ?? []).flatMap((angle, i) => {
    const leader = anglePlaces[i]?.leader
    return angle.label && leader ? [{ text: angle.label, stroke: leader }] : []
  })
  return { width: VW, height: h, strokes, dots, labels, leaders }
}

/**
 * Where each angle's label goes. A label starts at its usual spot inside the angle and moves out
 * along the angle's middle until it clears every label already placed (point letters first, then
 * angles in order) and stays inside the figure. Narrow angles drawn to their true size need this.
 * A number with no arc stays on the angle's middle, so it needs no leader.
 */
function placeAngleLabels(
  spec: GeoFigureSpec,
  at: (id: string) => { x: number; y: number },
  h: number,
  taken: Box[],
  strokes: Stroke[],
): (LabelPlace | null)[] {
  const shapes = (spec.angles ?? []).map((angle) => angleShape(angle, at))
  return (spec.angles ?? []).map((angle, i) => {
    if (!angle.label || angle.right) return null
    const g = shapes[i]!
    const clear = (box: Box) =>
      box.l >= 2 && box.r <= VW - 2 && box.t >= 2 && box.b <= h - 2 &&
      !taken.some((t) => overlaps(t, box)) &&
      !strokes.some((s) => segmentHitsBox(s, box))
    const at_ = (dir: number, r: number) => ({ x: g.v.x + Math.cos(dir) * r, y: g.v.y + Math.sin(dir) * r })
    const sign = g.delta < 0 ? -1 : 1
    // A whole angle (another marked angle at its vertex lies inside it) is labeled just outside its
    // arc, past the far ray, so the label cannot be read as one of the parts.
    const whole = shapes.some((o, j) => j !== i && o.v.x === g.v.x && o.v.y === g.v.y && inside(o, g))
    const candidates: { dir: number; r: number }[] = []
    if (whole) {
      for (const past of [g.angA + g.delta, g.angA]) {
        const away = past === g.angA ? -sign : sign
        for (const deg of [10, 16, 24]) for (let r = g.outer + 10; r <= g.outer + 90; r += 8) candidates.push({ dir: past + away * (deg * Math.PI) / 180, r })
      }
    }
    // A number without an arc creeps out in small steps, so it stays near its vertex.
    const step = g.arc ? 6 : 2
    const outside = (from: number, to: number) => {
      for (const past of [g.angA + g.delta, g.angA]) {
        const away = past === g.angA ? -sign : sign
        for (const deg of [12, 20, 30, 45]) for (let r = g.outer + from; r <= g.outer + to; r += 8) candidates.push({ dir: past + away * (deg * Math.PI) / 180, r })
      }
    }
    if (g.arc && !whole) {
      // Near the vertex first: a little way along the middle of the angle, then just outside the angle
      // past either side (a long label in a triangle's corner), and only then farther out. A label far
      // along the middle can end up beside another vertex, where it reads as that angle's.
      for (let r = g.labelR; r <= g.labelR + 48; r += step) candidates.push({ dir: g.bis, r })
      outside(8, 64)
      for (let r = g.labelR + 48 + step; r <= g.labelR + 200; r += step) candidates.push({ dir: g.bis, r })
      outside(72, 110)
    } else {
      for (let r = g.labelR; r <= g.labelR + 200; r += step) candidates.push({ dir: g.bis, r })
    }
    for (const c of candidates) {
      const { x, y } = at_(c.dir, c.r)
      const box = textBox(x, y, angle.label, 13)
      if (!clear(box)) continue
      if (c.dir === g.bis && (c.r === g.labelR || !g.arc)) {
        taken.push(box)
        return { x, y }
      }
      // A leader from the arc (or, with no arc, from inside the angle) to the nearest edge of the label.
      // It may not cross another label, and later labels keep off it.
      const onArc = at_(clampAngle(c.dir, g.angA, g.delta), g.arc ? g.outer + 2 : NUMBER_R)
      const near = { x: Math.min(Math.max(onArc.x, box.l), box.r), y: Math.min(Math.max(onArc.y, box.t), box.b) }
      const leader: Stroke = [onArc.x, onArc.y, near.x, near.y]
      if (taken.some((t) => segmentHitsBox(leader, t))) continue
      taken.push(box)
      strokes.push(leader)
      return { x, y, leader }
    }
    // No clear spot inside the figure: keep the usual one.
    const { x, y } = at_(g.bis, g.labelR)
    taken.push(textBox(x, y, angle.label, 13))
    return { x, y }
  })
}

/**
 * Where each line's name goes: near one end of the line as drawn, just off it, clear of every stroke and
 * every label already placed, and inside the figure. A line that runs across is named near its right end,
 * above it when there is room; a steep line near its upper end, to its right when there is room.
 */
function placeLineLabels(
  spec: GeoFigureSpec,
  at: (id: string) => { x: number; y: number },
  h: number,
  taken: Box[],
  strokes: Stroke[],
): (LabelPlace | null)[] {
  return (spec.lines ?? []).map((line) => {
    const name = line.label
    if (!name) return null
    const a = at(line.through[0])
    const b = at(line.through[1])
    const d = clipExtended(a.x, a.y, b.x, b.y, 8, 8, VW - 8, h - 8)
    if (!d) return null
    const [x1, y1, x2, y2] = d as [number, number, number, number]
    const u = unit(x2 - x1, y2 - y1)
    const across = Math.abs(u.x) >= Math.abs(u.y)
    // Each end, with the direction that walks back into the figure along the line.
    const ends = [
      { x: x1, y: y1, ix: u.x, iy: u.y },
      { x: x2, y: y2, ix: -u.x, iy: -u.y },
    ].sort((p, q) => (across ? q.x - p.x : p.y - q.y))
    // The two sides of the line: above first for a line that runs across, right first for a steep one.
    const sides = [
      { x: -u.y, y: u.x },
      { x: u.y, y: -u.x },
    ].sort((p, q) => (across ? p.y - q.y : q.x - p.x))
    const probe = textBox(0, 0, name, LINE_LABEL_SIZE)
    const halfW = (probe.r - probe.l) / 2
    const halfH = (probe.b - probe.t) / 2
    const inBounds = (box: Box) => box.l >= 2 && box.r <= VW - 2 && box.t >= 2 && box.b <= h - 2
    let fallback: LabelPlace | null = null
    for (const end of ends) {
      for (const along of [18, 26, 34, 44, 56, 70, 86, 104]) {
        for (const side of sides) {
          // Far enough from its own line that the box (with the 2 px margin) does not touch it.
          const off = 4 + Math.abs(side.x) * (halfW + 2) + Math.abs(side.y) * (halfH + 2)
          const x = end.x + end.ix * along + side.x * off
          const y = end.y + end.iy * along + side.y * off
          const box = textBox(x, y, name, LINE_LABEL_SIZE)
          if (!inBounds(box)) continue
          fallback ??= { x, y }
          if (strokes.some((s) => segmentHitsBox(s, box)) || taken.some((t) => overlaps(t, box))) continue
          taken.push(box)
          return { x, y }
        }
      }
    }
    // Nowhere clear: the first spot inside the figure near an end.
    if (fallback) taken.push(textBox(fallback.x, fallback.y, name, LINE_LABEL_SIZE))
    return fallback
  })
}

/** A box around each arrow mark drawn along a line, so no label covers one. */
function parallelMarkBoxes(spec: GeoFigureSpec, at: (id: string) => { x: number; y: number }, h: number): Box[] {
  const out: Box[] = []
  for (const line of spec.lines ?? []) {
    if (!line.arrows) continue
    const a = at(line.through[0])
    const b = at(line.through[1])
    const d = clipExtended(a.x, a.y, b.x, b.y, 8, 8, VW - 8, h - 8)
    if (!d) continue
    const [x1, y1, x2, y2] = d as [number, number, number, number]
    const len = Math.hypot(x2 - x1, y2 - y1) || 1
    for (const t of line.arrows === 1 ? [0.32] : [0.32, 0.32 + 12 / len]) {
      const cx = x1 + (x2 - x1) * t
      const cy = y1 + (y2 - y1) * t
      out.push({ l: cx - 9, t: cy - 9, r: cx + 9, b: cy + 9 })
    }
  }
  return out
}

export type Stroke = [number, number, number, number]

/** Every line the figure draws (rays and lines clipped as drawn), for labels to keep off. */
function drawnStrokes(spec: GeoFigureSpec, at: (id: string) => { x: number; y: number }, h: number): Stroke[] {
  const out: Stroke[] = []
  for (const line of spec.lines ?? []) {
    const a = at(line.through[0])
    const b = at(line.through[1])
    const d = clipExtended(a.x, a.y, b.x, b.y, 8, 8, VW - 8, h - 8)
    if (d) out.push([d[0]!, d[1]!, d[2]!, d[3]!])
  }
  for (const ray of spec.rays ?? []) {
    const a = at(ray.from)
    const b = at(ray.through)
    const d = clipRay(a.x, a.y, b.x, b.y, 8, 8, VW - 8, h - 8)
    if (d) out.push([d[0]!, d[1]!, d[2]!, d[3]!])
  }
  for (const seg of spec.segments ?? []) {
    const a = at(seg.from)
    const b = at(seg.to)
    out.push([a.x, a.y, b.x, b.y])
  }
  return out
}

/** Liang–Barsky: does any part of the stroke pass through the box (with a 2 px margin)? */
function segmentHitsBox([x1, y1, x2, y2]: Stroke, box: Box): boolean {
  const l = box.l - 2
  const r = box.r + 2
  const t = box.t - 2
  const b = box.b + 2
  const dx = x2 - x1
  const dy = y2 - y1
  let lo = 0
  let hi = 1
  for (const [p, q] of [
    [-dx, x1 - l],
    [dx, r - x1],
    [-dy, y1 - t],
    [dy, b - y1],
  ] as const) {
    if (p === 0) {
      if (q < 0) return false
      continue
    }
    const u = q / p
    if (p < 0) lo = Math.max(lo, u)
    else hi = Math.min(hi, u)
    if (lo > hi) return false
  }
  return true
}

/** Is angle `o` inside angle `g` (same vertex, both of o's sides within g's opening)? */
function inside(o: ReturnType<typeof angleShape>, g: ReturnType<typeof angleShape>): boolean {
  const within = (dir: number) => {
    let d = (dir - g.angA) * Math.sign(g.delta || 1)
    while (d < -1e-9) d += 2 * Math.PI
    while (d > 2 * Math.PI) d -= 2 * Math.PI
    return d <= Math.abs(g.delta) + 1e-9
  }
  return Math.abs(o.delta) < Math.abs(g.delta) - 1e-9 && within(o.angA) && within(o.angA + o.delta)
}

/** The direction on the arc nearest to `dir` (the arc runs from angA through delta). */
function clampAngle(dir: number, angA: number, delta: number): number {
  let d = (dir - angA) * Math.sign(delta || 1)
  while (d < -Math.PI) d += 2 * Math.PI
  while (d > Math.PI) d -= 2 * Math.PI
  const span = Math.abs(delta)
  const clamped = Math.min(Math.max(d, 0), span)
  return angA + clamped * Math.sign(delta || 1)
}

function AngleMark({ angle, at, place }: { angle: GeoAngleMark; at: (id: string) => { x: number; y: number }; place: LabelPlace | null }) {
  const g = angleShape(angle, at)
  if (angle.right) {
    return <RightMark vx={g.v.x} vy={g.v.y} ax={g.a.x} ay={g.a.y} bx={g.b.x} by={g.b.y} label={angle.label} />
  }
  const spot = place ?? { x: g.v.x + Math.cos(g.bis) * g.labelR, y: g.v.y + Math.sin(g.bis) * g.labelR }
  return (
    <g data-geo="angle" data-marks={g.arc ? (angle.marks ?? undefined) : undefined} data-arc={g.arc ? undefined : 'none'}>
      {g.arc
        ? Array.from({ length: g.count }, (_, i) => (
            <path key={i} data-geo="arc" d={arcPath(g.v.x, g.v.y, g.base + i * 7, g.angA, g.delta)} fill="none" stroke={CORAL} strokeWidth={2} />
          ))
        : null}
      {place?.leader ? (
        <line data-geo="leader" x1={place.leader[0]} y1={place.leader[1]} x2={place.leader[2]} y2={place.leader[3]} stroke={CORAL} strokeWidth={1} />
      ) : null}
      {angle.label ? (
        <text x={spot.x} y={spot.y} textAnchor="middle" dominantBaseline="middle" fill={INK} fontSize={13} {...HALO}>
          {angle.label}
        </text>
      ) : null}
    </g>
  )
}

function RightMark({ vx, vy, ax, ay, bx, by, label }: { vx: number; vy: number; ax: number; ay: number; bx: number; by: number; label?: string }) {
  const size = 14
  const ua = unit(ax - vx, ay - vy)
  const ub = unit(bx - vx, by - vy)
  const p1 = { x: vx + ua.x * size, y: vy + ua.y * size }
  const p2 = { x: p1.x + ub.x * size, y: p1.y + ub.y * size }
  const p3 = { x: vx + ub.x * size, y: vy + ub.y * size }
  const lx = vx + (ua.x + ub.x) * (size + 16)
  const ly = vy + (ua.y + ub.y) * (size + 16)
  return (
    <g data-geo="right">
      <polyline points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`} fill="none" stroke={NAVY} strokeWidth={2} />
      {label ? (
        <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill={INK} fontSize={13}>
          {label}
        </text>
      ) : null}
    </g>
  )
}

function arcPath(cx: number, cy: number, r: number, start: number, delta: number): string {
  const x1 = cx + Math.cos(start) * r
  const y1 = cy + Math.sin(start) * r
  const x2 = cx + Math.cos(start + delta) * r
  const y2 = cy + Math.sin(start + delta) * r
  const sweep = delta > 0 ? 1 : 0
  const large = Math.abs(delta) > Math.PI ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`
}

function unit(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y) || 1
  return { x: x / len, y: y / len }
}

function layoutOf(spec: GeoFigureSpec): { sx: (x: number) => number; sy: (y: number) => number; h: number } {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const take = (x: number, y: number) => {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  if (spec.grid) {
    take(spec.grid.xMin, spec.grid.yMin)
    take(spec.grid.xMax, spec.grid.yMax)
  } else {
    for (const p of spec.points) take(p.x, p.y)
  }
  if (!Number.isFinite(minX)) {
    minX = 0
    maxX = 1
    minY = 0
    maxY = 1
  }
  if (maxX - minX < 0.5) {
    minX -= 1
    maxX += 1
  }
  // Points on one horizontal line (a segment figure) need only room for their labels.
  const flat = !spec.grid && maxY - minY < 1e-9
  if (maxY - minY < 0.5) {
    minY -= 1
    maxY += 1
  }
  const spanX = maxX - minX
  const spanY = maxY - minY
  const innerW = VW - 2 * PAD
  const innerH = flat ? 70 : Math.max(140, Math.min(260, innerW * (spanY / spanX)))
  const h = innerH + 2 * PAD
  const scale = Math.min(innerW / spanX, innerH / spanY)
  const usedW = spanX * scale
  const usedH = spanY * scale
  const ox = (VW - usedW) / 2
  const oy = (h - usedH) / 2
  return {
    h,
    sx: (x) => ox + (x - minX) * scale,
    sy: (y) => oy + (maxY - y) * scale,
  }
}

/** Extend a segment both ways, then clip it to the rectangle. Arrowheads sit on the ends. */
function clipExtended(x1: number, y1: number, x2: number, y2: number, left: number, top: number, right: number, bottom: number): number[] | null {
  const u = unit(x2 - x1, y2 - y1)
  return clipSeg(x1 - u.x * 800, y1 - u.y * 800, x2 + u.x * 800, y2 + u.y * 800, left, top, right, bottom)
}

function clipRay(x1: number, y1: number, x2: number, y2: number, left: number, top: number, right: number, bottom: number): number[] | null {
  const u = unit(x2 - x1, y2 - y1)
  return clipSeg(x1, y1, x1 + u.x * 800, y1 + u.y * 800, left, top, right, bottom)
}

function clipSeg(x1: number, y1: number, x2: number, y2: number, xmin: number, ymin: number, xmax: number, ymax: number): number[] | null {
  const code = (x: number, y: number) => (x < xmin ? 1 : 0) | (x > xmax ? 2 : 0) | (y < ymin ? 4 : 0) | (y > ymax ? 8 : 0)
  let c1 = code(x1, y1)
  let c2 = code(x2, y2)
  for (let i = 0; i < 12; i++) {
    if ((c1 | c2) === 0) return [x1, y1, x2, y2]
    if (c1 & c2) return null
    const c = c1 || c2
    let x = 0
    let y = 0
    if (c & 8) {
      if (y2 === y1) return null
      x = x1 + ((x2 - x1) * (ymax - y1)) / (y2 - y1)
      y = ymax
    } else if (c & 4) {
      if (y2 === y1) return null
      x = x1 + ((x2 - x1) * (ymin - y1)) / (y2 - y1)
      y = ymin
    } else if (c & 2) {
      if (x2 === x1) return null
      y = y1 + ((y2 - y1) * (xmax - x1)) / (x2 - x1)
      x = xmax
    } else {
      if (x2 === x1) return null
      y = y1 + ((y2 - y1) * (xmin - x1)) / (x2 - x1)
      x = xmin
    }
    if (c === c1) {
      x1 = x
      y1 = y
      c1 = code(x1, y1)
    } else {
      x2 = x
      y2 = y
      c2 = code(x2, y2)
    }
  }
  return null
}
