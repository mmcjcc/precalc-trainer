import { useMemo } from 'react'
import type { Rational, SolutionSet } from '@/shared/types'
import { PALETTE } from '@/shared/types'
import { describeSet, endpointToNumber, ratToNumber, ratToString } from './setDescribe'

type Props = {
  set: SolutionSet
  /** Force the visible range; otherwise derived from the endpoints. */
  domain?: [number, number]
  className?: string
  /** Extra sentence appended to the accessible name (e.g. the inequality it shows). */
  caption?: string
}

const W = 360
const H = 64
const PAD = 26
const Y = 30

function domainFor(set: SolutionSet, given?: [number, number]): [number, number] {
  if (given) return given
  const vals: number[] = []
  for (const p of set.pieces) {
    if (p.lo !== '-inf') vals.push(endpointToNumber(p.lo))
    if (p.hi !== 'inf') vals.push(endpointToNumber(p.hi))
  }
  for (const pt of set.points) vals.push(ratToNumber(pt))
  if (vals.length === 0) return [-5, 5]
  let lo = Math.floor(Math.min(...vals)) - 2
  let hi = Math.ceil(Math.max(...vals)) + 2
  if (hi - lo < 8) {
    const extra = 8 - (hi - lo)
    lo -= Math.ceil(extra / 2)
    hi += Math.floor(extra / 2)
  }
  return [lo, hi]
}

function tickStep(range: number): number {
  if (range <= 16) return 1
  if (range <= 40) return 2
  if (range <= 100) return 5
  return 10
}

/**
 * Number line of an exact SolutionSet: shaded rays/segments, open/closed dots, isolated points.
 * `role="img"` + generated aria-label (UX-05). Never color-only: open vs closed is a fill difference
 * AND is spelled out in the label.
 */
export function NumberLineSet({ set, domain, className, caption }: Props) {
  const [lo, hi] = useMemo(() => domainFor(set, domain), [set, domain])
  const xOf = (t: number) => {
    const clamped = Math.max(lo, Math.min(hi, t))
    return PAD + ((clamped - lo) / (hi - lo)) * (W - 2 * PAD)
  }
  const step = tickStep(hi - lo)
  const ticks: number[] = []
  for (let n = Math.ceil(lo / step) * step; n <= hi; n += step) ticks.push(n)
  const label = describeSet(set) + (caption ? `. ${caption}` : '')

  const navy = PALETTE.navy
  const dots: { x: number; closed: boolean; key: string; value: Rational }[] = []
  const shades: { x1: number; x2: number; key: string }[] = []
  set.pieces.forEach((p, i) => {
    const a = p.lo === '-inf' ? lo - 1 : endpointToNumber(p.lo)
    const b = p.hi === 'inf' ? hi + 1 : endpointToNumber(p.hi)
    shades.push({ x1: p.lo === '-inf' ? PAD - 8 : xOf(a), x2: p.hi === 'inf' ? W - PAD + 8 : xOf(b), key: `s${i}` })
    if (typeof p.lo !== 'string') dots.push({ x: xOf(a), closed: p.loClosed, key: `lo${i}`, value: p.lo })
    if (typeof p.hi !== 'string') dots.push({ x: xOf(b), closed: p.hiClosed, key: `hi${i}`, value: p.hi })
  })
  set.points.forEach((pt, i) => dots.push({ x: xOf(ratToNumber(pt)), closed: true, key: `p${i}`, value: pt }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`w-full max-w-md ${className ?? ''}`} role="img" aria-label={label}>
      <title>{label}</title>
      {/* axis with arrowheads */}
      <line x1={PAD - 12} y1={Y} x2={W - PAD + 12} y2={Y} stroke={navy} strokeWidth={1.5} />
      <polygon points={`${PAD - 18},${Y} ${PAD - 10},${Y - 4} ${PAD - 10},${Y + 4}`} fill={navy} />
      <polygon points={`${W - PAD + 18},${Y} ${W - PAD + 10},${Y - 4} ${W - PAD + 10},${Y + 4}`} fill={navy} />
      {ticks.map((n) => (
        <g key={n}>
          <line x1={xOf(n)} y1={Y - 5} x2={xOf(n)} y2={Y + 5} stroke={navy} strokeWidth={1} />
          <text x={xOf(n)} y={Y + 20} textAnchor="middle" fontSize={10} fill={navy}>
            {n}
          </text>
        </g>
      ))}
      {shades.map((s) => (
        <line key={s.key} x1={s.x1} y1={Y} x2={s.x2} y2={Y} stroke={PALETTE.coral} strokeWidth={6} strokeLinecap="butt" opacity={0.9} />
      ))}
      {dots.map((d) => (
        <g key={d.key}>
          <circle cx={d.x} cy={Y} r={6} fill={d.closed ? navy : '#fff'} stroke={navy} strokeWidth={2.5} data-dot={d.closed ? 'closed' : 'open'} />
          {d.value.d !== 1 && (
            <text x={d.x} y={Y - 12} textAnchor="middle" fontSize={10} fill={navy}>
              {ratToString(d.value)}
            </text>
          )}
        </g>
      ))}
      {set.pieces.length === 0 && set.points.length === 0 && (
        <text x={W / 2} y={Y - 12} textAnchor="middle" fontSize={11} fill={navy}>
          ∅ — nothing shaded
        </text>
      )}
    </svg>
  )
}
