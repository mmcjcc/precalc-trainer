import { useEffect, useRef, useState } from 'react'
import { evalExpr } from '@/engine'
import { PALETTE, type GraphSpec, type PlotColor, type PlotStyle } from '@/shared/types'
import { splitDomain } from './graphBreaks'

const COLOR: Record<PlotColor, string> = {
  navy: PALETTE.navy,
  coral: PALETTE.coral,
  gray: PALETTE.gray,
  gold: PALETTE.goldText,
}

function evalAt(expr: string, x: number): number {
  if (!Number.isFinite(x)) return Number.NaN
  const v = evalExpr(expr, { x })
  return v === 'undef' ? Number.NaN : v
}

function asFn(expr: string) {
  return (scope: { x?: number }) => evalAt(expr, Number(scope.x))
}

/** One polyline per span, so a curve with a vertical asymptote is not joined across it. */
function pushCurve(
  data: Record<string, unknown>[],
  expr: string,
  color: string,
  style: PlotStyle,
  domain: [number, number],
  breaks: number[] | undefined,
  nSamples: number,
) {
  const spans = splitDomain(domain[0], domain[1], breaks)
  const attr = style === 'solid' ? undefined : { 'stroke-dasharray': style === 'dotted' ? '2 3' : '6 4' }
  for (const [a, b] of spans) {
    const item: Record<string, unknown> = { fn: asFn(expr), graphType: 'polyline', color, nSamples }
    if (spans.length > 1) item.range = [a, b]
    if (attr) item.attr = attr
    data.push(item)
  }
}

type Props = {
  spec: GraphSpec
  className?: string
}

type Status = 'loading' | 'ready' | 'failed'

/**
 * Square-window plot: f navy, inverse coral dashed, y = x gray dotted, extra curves as specified.
 * `reflect` draws the mirror of f across y = x parametrically (x = f(t), y = t) in coral dashed —
 * the not-one-to-one case, where the reflection is not a function.
 *
 * function-plot (and d3) load with a dynamic import inside the effect, so they live in their own
 * chunk and only download when a graph is actually shown.
 */
export function Graph({ spec, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>('loading')
  const f = spec.f
  const fColor = spec.fColor ?? 'navy'
  const fBreaks = spec.fBreaks
  const finv = spec.finv
  const extra = spec.extra
  const lo = spec.xDomain?.[0] ?? -8
  const hi = spec.xDomain?.[1] ?? 8
  const identity = spec.showIdentity
  const reflect = spec.reflect
  const badge = spec.badge
  const extraKey = JSON.stringify(extra ?? [])
  const fBreakKey = JSON.stringify(fBreaks ?? [])

  useEffect(() => {
    const el = ref.current
    if (!el || spec.kind !== 'function' || !f) return
    let cancelled = false
    setStatus('loading')
    const curves = JSON.parse(extraKey) as NonNullable<GraphSpec['extra']>
    import('function-plot')
      .then((mod) => {
        if (cancelled) return
        const functionPlot = mod.default
        el.innerHTML = ''
        const width = Math.min(320, el.clientWidth || 320)
        const data: Record<string, unknown>[] = []
        pushCurve(data, f, COLOR[fColor], 'solid', [lo, hi], fBreaks, 240)
        if (data[0]) data[0].skipTip = false
        if (identity || reflect) {
          data.push({
            fn: (scope: { x?: number }) => Number(scope.x),
            graphType: 'polyline',
            color: COLOR.gray,
            nSamples: 2,
            attr: { 'stroke-dasharray': '3 3' },
          })
        }
        if (finv) {
          data.push({ fn: asFn(finv), graphType: 'polyline', color: COLOR.coral, nSamples: 240, attr: { 'stroke-dasharray': '6 4' } })
        }
        if (reflect) {
          data.push({
            x: (scope: { t?: number }) => evalAt(f, Number(scope.t)),
            y: (scope: { t?: number }) => Number(scope.t),
            fnType: 'parametric',
            graphType: 'polyline',
            range: [lo, hi],
            color: COLOR.coral,
            nSamples: 240,
            attr: { 'stroke-dasharray': '6 4' },
          })
        }
        for (const c of curves) pushCurve(data, c.expr, COLOR[c.color], c.style, [lo, hi], c.breaks, 180)
        functionPlot({
          target: el,
          width,
          height: width,
          grid: true,
          xAxis: { domain: [lo, hi] },
          yAxis: { domain: [lo, hi] },
          tip: { xLine: true, yLine: true },
          data: data as never,
        })
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('failed')
      })
    return () => {
      cancelled = true
      el.innerHTML = ''
    }
  }, [f, fColor, fBreakKey, fBreaks, finv, extraKey, lo, hi, identity, reflect, spec.kind])

  if (spec.kind !== 'function' || !f) return null
  const legend: string[] = [`${fColor}: f`]
  if (finv) legend.push('coral dashed: f⁻¹')
  if (reflect) legend.push('coral dashed: mirror of f across y = x')
  if (identity || reflect) legend.push('gray dotted: y = x')
  for (const c of extra ?? []) legend.push(`${c.color} ${c.style}: ${c.label}`)
  const extraNames = (extra ?? []).map((c) => c.label)
  const aria = `Graph of ${f}${finv ? ' and its inverse' : ''}${reflect ? ', with its reflection across y = x' : ''}${extraNames.length ? `, with ${extraNames.join(' and ')}` : ''}`
  return (
    <div className={className}>
      <div ref={ref} className="overflow-hidden rounded-xl bg-white" role="img" aria-label={aria} aria-busy={status === 'loading'} />
      {status === 'loading' && <p className="text-sm text-navy/60">Drawing the graph…</p>}
      {status === 'failed' && (
        <p role="alert" className="text-sm text-navy">
          <span aria-hidden>⚠ </span>Could not draw this graph here — try the calculator panel instead.
        </p>
      )}
      {badge && (
        <p className="mt-2 text-sm font-semibold text-coral-700">
          <span aria-hidden>⚠ </span>
          {badge}
        </p>
      )}
      <p className="mt-1 text-xs text-navy/60">{legend.join(' · ')}. Square window — one x-unit looks like one y-unit.</p>
    </div>
  )
}
