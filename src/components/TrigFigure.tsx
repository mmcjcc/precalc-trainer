/**
 * A trig figure from a TrigFigureSpec: the unit circle with an angle in standard position (a spiral when it turns more
 * than once, an arrow showing which way it turns), axes with a point on the terminal side, or a circle with a central
 * angle and its arc or sector. It fills its container, uses the app's colour tokens, and describes itself in words.
 * The reference angle is drawn only when `showReference` is set: the flow sets it once she has answered it, or
 * finished. Where a problem asks where the terminal side lies, the flow leaves `showAngle` off until she has answered
 * that: the unit circle and its axes only, since the drawn angle would show the quadrant.
 */
import { useId } from 'react'
import type { TrigFigureSpec } from '@/content/types'

const NAVY = 'var(--color-navy)'
const CORAL = 'var(--color-coral-700)'
const INK = 'var(--color-ink)'
const GOLD = 'var(--color-gold-text)'
const GOLD_FILL = 'var(--color-gold)'
const HALO = { stroke: 'var(--color-gold-100)', strokeWidth: 4, strokeLinejoin: 'round', paintOrder: 'stroke' } as const

const VW = 320
const VH = 320
const CX = 160
const CY = 160
/** Radius of the unit circle (and of the sector's circle) in SVG units. */
const R = 104

const rad = (deg: number) => (deg * Math.PI) / 180
/** A point at `deg` (math angle, counterclockwise from +x) and distance `r` from the centre, in SVG units. */
export function polar(deg: number, r: number): { x: number; y: number } {
  return { x: CX + r * Math.cos(rad(deg)), y: CY - r * Math.sin(rad(deg)) }
}

const f = (n: number) => Number(n.toFixed(2))

/**
 * The path of an angle's arc from 0° to `deg`: a circular arc for one turn or less, a spiral (radius growing with
 * each turn) for more. Returns the path and the end point and direction, for the arrowhead.
 */
export function anglePath(deg: number, r0: number, grow: number): { d: string; end: { x: number; y: number }; endDeg: number; spiral: boolean } {
  const total = Math.abs(deg)
  const sign = deg < 0 ? -1 : 1
  const spiral = total > 360
  const steps = Math.max(8, Math.ceil(total / 5))
  const pts: string[] = []
  let end = polar(0, r0)
  for (let i = 0; i <= steps; i++) {
    const t = (total * i) / steps
    const r = spiral ? r0 + (grow * t) / 360 : r0
    const p = polar(sign * t, r)
    pts.push(`${i === 0 ? 'M' : 'L'}${f(p.x)},${f(p.y)}`)
    end = p
  }
  return { d: pts.join(' '), end, endDeg: deg, spiral }
}

/** A small arrowhead at `p`, pointing along the arc's direction of travel at math angle `deg`. */
function arrowHead(p: { x: number; y: number }, deg: number, clockwise: boolean): string {
  // Tangent of a counterclockwise circle at angle a is (−sin a, cos a) in math axes; SVG y points down.
  const a = rad(deg)
  const s = clockwise ? -1 : 1
  const tx = -Math.sin(a) * s
  const ty = -Math.cos(a) * s
  const nx = -ty
  const ny = tx
  const tip = { x: p.x + tx * 6, y: p.y + ty * 6 }
  const l = { x: p.x - tx * 4 + nx * 5, y: p.y - ty * 4 + ny * 5 }
  const rr = { x: p.x - tx * 4 - nx * 5, y: p.y - ty * 4 - ny * 5 }
  return `M${f(tip.x)},${f(tip.y)} L${f(l.x)},${f(l.y)} L${f(rr.x)},${f(rr.y)} Z`
}

function Label({ x, y, text, color = INK, size = 14, italic = false, data }: { x: number; y: number; text: string; color?: string; size?: number; italic?: boolean; data?: string }) {
  return (
    <text data-trig={data} x={f(x)} y={f(y)} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize={size} fontWeight={600} fontStyle={italic ? 'italic' : undefined} {...HALO}>
      {text}
    </text>
  )
}

function Axes({ marker }: { marker: string }) {
  return (
    <g data-trig="axes">
      <line x1={10} y1={CY} x2={VW - 14} y2={CY} stroke={NAVY} strokeOpacity={0.55} strokeWidth={1.5} markerEnd={`url(#${marker})`} />
      <line x1={CX} y1={VH - 10} x2={CX} y2={14} stroke={NAVY} strokeOpacity={0.55} strokeWidth={1.5} markerEnd={`url(#${marker})`} />
      <Label x={VW - 12} y={CY + 16} text="x" italic size={14} />
      <Label x={CX + 14} y={14} text="y" italic size={14} />
    </g>
  )
}

/** The reference angle: from the terminal side to the nearest part of the x-axis, dashed, in gold. */
function ReferenceMark({ deg, label }: { deg: number; label: string }) {
  const c = ((deg % 360) + 360) % 360
  // The x-axis direction the terminal side is nearest to.
  const axis = c < 90 ? 0 : c < 270 ? 180 : 360
  const from = Math.min(c, axis)
  const to = Math.max(c, axis)
  const r = 50
  const a = polar(from, r)
  const b = polar(to, r)
  const mid = polar((from + to) / 2, r + 16)
  return (
    <g data-trig="reference">
      <path d={`M${f(a.x)},${f(a.y)} A${r},${r} 0 0 0 ${f(b.x)},${f(b.y)}`} fill="none" stroke={GOLD} strokeWidth={2.5} strokeDasharray="5 4" />
      <Label x={mid.x} y={mid.y} text={label} color={GOLD} size={13} data="reference-label" />
    </g>
  )
}

function CircleFigure({ spec, showReference, marker }: { spec: TrigFigureSpec; showReference: boolean; marker: string }) {
  const end = polar(spec.deg, R)
  const total = Math.abs(spec.deg)
  // One turn or less: an arc. More: a spiral, 9 units wider each turn, so every turn shows.
  const arc = anglePath(spec.deg, 22, 9)
  const clockwise = spec.deg < 0
  const sign = clockwise ? -1 : 1
  // The angle's label sits outside the arc: along its middle for one turn or less, just before the spiral's end for
  // more, clear of the terminal side.
  const labelAt = total > 360 ? polar(spec.deg - sign * 32, 22 + (9 * total) / 360 + 20) : polar(spec.deg / 2, total < 40 ? 62 : 46)
  return (
    <>
      <circle data-trig="unit-circle" cx={CX} cy={CY} r={R} fill="none" stroke={NAVY} strokeOpacity={0.35} strokeWidth={1.5} />
      <Axes marker={marker} />
      <line data-trig="terminal" x1={CX} y1={CY} x2={f(end.x)} y2={f(end.y)} stroke={NAVY} strokeWidth={2.5} />
      <circle data-trig="point" cx={f(end.x)} cy={f(end.y)} r={4.5} fill={NAVY} />
      {spec.deg !== 0 && (
        <g data-trig={arc.spiral ? 'spiral' : 'angle-arc'} data-direction={clockwise ? 'clockwise' : 'counterclockwise'}>
          <path d={arc.d} fill="none" stroke={CORAL} strokeWidth={2} />
          <path d={arrowHead(arc.end, spec.deg, clockwise)} fill={CORAL} />
        </g>
      )}
      <Label x={labelAt.x} y={labelAt.y} text={spec.label} color={CORAL} data="angle-label" />
      {showReference && spec.reference && <ReferenceMark deg={spec.deg} label={spec.reference.label} />}
    </>
  )
}

/** Half a label's width and height in SVG units (14-unit semibold text: about 8 units a character). */
export function labelHalfSize(text: string): { w: number; h: number } {
  return { w: text.length * 4 + 2, h: 8 }
}

/**
 * Where a point's label goes: beside the point, across the terminal side from the drop to the x-axis, and far enough
 * out for its width, so the ray running on past the point never crosses it. `u` is the ray's direction (SVG units).
 */
export function pointLabelAt(P: { x: number; y: number }, u: { x: number; y: number }, text: string): { x: number; y: number } {
  // Of the two sides of the ray, the one away from the x-axis; on the x-axis, above it.
  let n = { x: -u.y, y: u.x }
  const away = P.y - CY
  if (n.y * away < 0 || (away === 0 && n.y > 0)) n = { x: -n.x, y: -n.y }
  const { w, h } = labelHalfSize(text)
  const d = w * Math.abs(n.x) + h * Math.abs(n.y) + 6
  return {
    x: Math.min(Math.max(P.x + n.x * d, w + 2), VW - w - 2),
    y: Math.min(Math.max(P.y + n.y * d, h + 2), VH - h - 2),
  }
}

function PointFigure({ spec, marker }: { spec: TrigFigureSpec; marker: string }) {
  const pt = spec.point!
  const scale = 96 / Math.max(Math.abs(pt.x), Math.abs(pt.y))
  const P = { x: CX + pt.x * scale, y: CY - pt.y * scale }
  const len = Math.hypot(P.x - CX, P.y - CY)
  const ux = (P.x - CX) / len
  const uy = (P.y - CY) / len
  const ray = { x: CX + ux * Math.min(len + 34, 146), y: CY + uy * Math.min(len + 34, 146) }
  const foot = { x: P.x, y: CY }
  const arc = anglePath(spec.deg, 20, 0)
  // r along the segment, on the side away from the angle's arc.
  const rAt = { x: (CX + P.x) / 2 - uy * 14, y: (CY + P.y) / 2 + ux * 14 }
  const thetaAt = polar(spec.deg / 2, 36)
  const pointLabel = pointLabelAt(P, { x: ux, y: uy }, pt.label)
  return (
    <>
      <Axes marker={marker} />
      <line data-trig="drop" x1={f(P.x)} y1={f(P.y)} x2={f(foot.x)} y2={f(foot.y)} stroke={NAVY} strokeOpacity={0.6} strokeWidth={1.5} strokeDasharray="4 4" />
      <line data-trig="terminal" x1={CX} y1={CY} x2={f(ray.x)} y2={f(ray.y)} stroke={NAVY} strokeWidth={2.5} markerEnd={`url(#${marker})`} />
      <circle data-trig="point" cx={f(P.x)} cy={f(P.y)} r={4.5} fill={NAVY} />
      <g data-trig="angle-arc" data-direction="counterclockwise">
        <path d={arc.d} fill="none" stroke={CORAL} strokeWidth={2} />
        <path d={arrowHead(arc.end, spec.deg, false)} fill={CORAL} />
      </g>
      <Label x={pointLabel.x} y={pointLabel.y} text={pt.label} data="point-label" />
      <Label x={rAt.x} y={rAt.y} text="r" italic data="r-label" />
      <Label x={thetaAt.x} y={thetaAt.y} text={spec.label} color={CORAL} italic data="angle-label" />
    </>
  )
}

function SectorFigure({ spec }: { spec: TrigFigureSpec }) {
  const sector = spec.sector!
  const a = polar(0, R)
  const b = polar(spec.deg, R)
  const large = spec.deg > 180 ? 1 : 0
  const arcD = `M${f(a.x)},${f(a.y)} A${R},${R} 0 ${large} 0 ${f(b.x)},${f(b.y)}`
  const angleArc = anglePath(spec.deg, 24, 0)
  const angleLabel = polar(spec.deg / 2, spec.deg < 40 ? 66 : 46)
  return (
    <>
      <circle data-trig="circle" cx={CX} cy={CY} r={R} fill="none" stroke={NAVY} strokeOpacity={0.35} strokeWidth={1.5} />
      {sector.shade === 'area' && <path data-trig="sector-fill" d={`M${CX},${CY} L${f(a.x)},${f(a.y)} A${R},${R} 0 ${large} 0 ${f(b.x)},${f(b.y)} Z`} fill={GOLD_FILL} fillOpacity={0.7} stroke="none" />}
      <line data-trig="radius" x1={CX} y1={CY} x2={f(a.x)} y2={f(a.y)} stroke={NAVY} strokeWidth={2} />
      <line data-trig="terminal" x1={CX} y1={CY} x2={f(b.x)} y2={f(b.y)} stroke={NAVY} strokeWidth={2} />
      <path data-trig="sector-arc" d={arcD} fill="none" stroke={sector.shade === 'arc' ? CORAL : NAVY} strokeWidth={sector.shade === 'arc' ? 4.5 : 2} />
      <path data-trig="angle-arc" d={angleArc.d} fill="none" stroke={NAVY} strokeWidth={1.5} />
      <circle cx={CX} cy={CY} r={3} fill={NAVY} />
      <Label x={(CX + a.x) / 2} y={CY + 16} text={sector.radiusLabel} data="radius-label" size={13} />
      <Label x={angleLabel.x} y={angleLabel.y} text={spec.label} color={CORAL} data="angle-label" />
    </>
  )
}

export function TrigFigure({ spec, showReference = false, showAngle = true }: { spec: TrigFigureSpec; showReference?: boolean; showAngle?: boolean }) {
  const marker = `trig-arrow-${useId().replace(/:/g, '')}`
  const hidden = spec.kind === 'circle' && !showAngle
  const ariaLabel = hidden ? `The unit circle and its axes. The angle ${spec.label} is drawn once you have said where its terminal side lies.` : spec.ariaLabel
  return (
    <div className="mx-auto w-full max-w-[320px] overflow-hidden">
      <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${VW} ${VH}`} width="100%" className="block h-auto max-w-full">
        <defs>
          <marker id={marker} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto-start-reverse">
            <path d="M0,0 L8,3 L0,6 Z" fill={NAVY} />
          </marker>
        </defs>
        {hidden && (
          <>
            <circle data-trig="unit-circle" cx={CX} cy={CY} r={R} fill="none" stroke={NAVY} strokeOpacity={0.35} strokeWidth={1.5} />
            <Axes marker={marker} />
          </>
        )}
        {spec.kind === 'circle' && !hidden && <CircleFigure spec={spec} showReference={showReference} marker={marker} />}
        {spec.kind === 'point' && <PointFigure spec={spec} marker={marker} />}
        {spec.kind === 'sector' && <SectorFigure spec={spec} />}
      </svg>
    </div>
  )
}
