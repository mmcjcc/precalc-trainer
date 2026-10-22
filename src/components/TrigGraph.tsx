/**
 * A trig graph (Unit 5), from a GraphSpec with `ticks`: the curve to its true shape, x ticks at multiples of π/k
 * labelled π/4, π/2, 3π/4 … (or a plain step), y ticks, the axes, dashed vertical asymptotes, and the labelled points,
 * each label clear of the curve and of the others (components/trigGraphLayout.ts). It fills its container, uses the
 * app's colour tokens, and names itself by `ariaLabel` (a matching card says "Graph A", never its formula).
 */
import type { GraphSpec } from '@/shared/types'
import { trigGraphLayout } from './trigGraphLayout'

const NAVY = 'var(--color-navy)'
const CORAL = 'var(--color-coral-700)'
const INK = 'var(--color-ink)'
const HALO = { stroke: 'white', strokeWidth: 3, strokeLinejoin: 'round', paintOrder: 'stroke' } as const

const pts = (p: { x: number; y: number }[]) => p.map((q) => `${q.x},${q.y}`).join(' ')

export function TrigGraph({ spec, className }: { spec: GraphSpec; className?: string }) {
  const lay = trigGraphLayout(spec)
  const labelled = (spec.markers ?? []).map((m) => m.label)
  const aria =
    spec.ariaLabel ??
    `Graph of the function${labelled.length ? `, with the points ${labelled.join(' and ')} marked` : ''}${(spec.guides?.length ?? 0) > 0 ? ', and its vertical asymptotes dashed' : ''}.`
  const notes: string[] = []
  if (labelled.length) notes.push('Dots: the labelled points.')
  if ((spec.guides?.length ?? 0) > 0) notes.push('Dashed lines: vertical asymptotes.')
  return (
    <figure className={`space-y-1 ${className ?? ''}`}>
      <svg role="img" aria-label={aria} viewBox={`0 0 ${lay.width} ${lay.height}`} className="block h-auto w-full max-w-[440px] rounded-xl bg-white" data-trig-graph="">
        {lay.grid.map((g, i) => (
          <line key={`g${i}`} x1={g.a.x} y1={g.a.y} x2={g.b.x} y2={g.b.y} stroke="var(--color-gray, #9ca3af)" strokeOpacity={0.22} strokeWidth={1} />
        ))}
        {lay.axes.map((a, i) => (
          <line key={`a${i}`} data-trig="axis" x1={a.a.x} y1={a.a.y} x2={a.b.x} y2={a.b.y} stroke={NAVY} strokeOpacity={0.6} strokeWidth={1.25} />
        ))}
        {lay.ticks.map((t, i) => (
          <line key={`t${i}`} x1={t.a.x} y1={t.a.y} x2={t.b.x} y2={t.b.y} stroke={NAVY} strokeOpacity={0.6} strokeWidth={1} />
        ))}
        {lay.guides.map((g, i) => (
          <line key={`d${i}`} data-trig="asymptote" x1={g.a.x} y1={g.a.y} x2={g.b.x} y2={g.b.y} stroke={INK} strokeOpacity={0.55} strokeWidth={1.25} strokeDasharray="6 4" />
        ))}
        {lay.curves.map((c, i) => (
          <polyline key={`c${i}`} data-trig="curve" points={pts(c)} fill="none" stroke={NAVY} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {lay.dots.map((d, i) =>
          d.closed ? (
            <circle key={`o${i}`} cx={d.x} cy={d.y} r={4} fill={NAVY} />
          ) : (
            <circle key={`o${i}`} cx={d.x} cy={d.y} r={4.5} fill="white" stroke={NAVY} strokeWidth={2} />
          ),
        )}
        {lay.xLabels.map((l, i) => (
          <text key={`x${i}`} data-trig="x-tick" x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill={INK}>
            {l.text}
          </text>
        ))}
        {lay.yLabels.map((l, i) => (
          <text key={`y${i}`} data-trig="y-tick" x={l.x} y={l.y} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={INK}>
            {l.text}
          </text>
        ))}
        {lay.markers.map((m, i) => (
          <g key={`m${i}`} data-trig="marker">
            <circle cx={m.cx} cy={m.cy} r={4} fill={CORAL} stroke="white" strokeWidth={1.5} />
            <text data-trig="marker-label" x={m.x} y={m.y} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={600} fill={INK} {...HALO}>
              {m.label}
            </text>
          </g>
        ))}
      </svg>
      {notes.length > 0 && <figcaption className="text-xs text-navy/70">{notes.join(' ')}</figcaption>}
    </figure>
  )
}
