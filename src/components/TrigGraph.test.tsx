// @vitest-environment jsdom
/**
 * Unit 5's trig graphs (components/TrigGraph, laid out by trigGraphLayout): x ticks at multiples of π/k labelled the
 * way a textbook writes them, the curve to its true shape and split at its asymptotes, the asymptotes dashed, every
 * labelled point's label clear of the curve, the asymptotes, the axes, the tick labels and the other labels, inside
 * the figure, on every graph of every Unit 5 template over 300 seeds. The figure scales as a whole (viewBox units),
 * so what clears here clears at the phone's 375 px. And `ticks` is additive: a graph without it is drawn as before,
 * and no other module's graph sets it.
 */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { generateProblem, MODULES } from '@/content'
import { waveGraph } from '@/content/modules/trig/graph5'
import type { TrigAnswer } from '@/content/types'
import { q, waveValue, type TrigExact, type Wave } from '@/engine/trig'
import type { GraphSpec, ModuleId } from '@/shared/types'
import { GraphPanel } from './GraphPanel'
import { TrigGraph } from './TrigGraph'
import { labelClear, piLabel, TG_H, TG_W, trigGraphLayout } from './trigGraphLayout'

const LOOP_TIMEOUT = 120_000
const ex = (n: number, d = 1, pi: 0 | 1 = 0): TrigExact => ({ c: q(n, d), root: 1, pi })

describe('π ticks', () => {
  it('j·π/k reads the way a textbook writes it', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((j) => piLabel(j, 4))).toEqual(['0', 'π/4', 'π/2', '3π/4', 'π', '5π/4', '3π/2', '7π/4', '2π'])
    expect([-1, -2, -6].map((j) => piLabel(j, 4))).toEqual(['−π/4', '−π/2', '−3π/2'])
    expect([1, 2, 3, 4].map((j) => piLabel(j, 3))).toEqual(['π/3', '2π/3', 'π', '4π/3'])
  })

  it('y = sin x on [0, 2π] with ticks every π/4: each label sits under its tick', () => {
    const w: Wave = { fn: 'sin', A: q(1), B: ex(1), C: ex(0), D: q(0) }
    const spec = waveGraph(w, { window: [0, 2 * Math.PI] })
    expect(spec.ticks?.xPiOver).toBe(2)
    const quarter: GraphSpec = { ...spec, ticks: { xPiOver: 4, yStep: 1 } }
    const lay = trigGraphLayout(quarter)
    expect(lay.xLabels.map((l) => l.text)).toEqual(['0', 'π/4', 'π/2', '3π/4', 'π', '5π/4', '3π/2', '7π/4', '2π'])
    const sx = (x: number) => lay.plot.l + (x / (2 * Math.PI)) * (lay.plot.r - lay.plot.l)
    lay.xLabels.forEach((l, j) => expect(l.x).toBeCloseTo(sx((j * Math.PI) / 4), 1))
  })

  it('a crowded window labels every other tick (or fewer), never overlapping', () => {
    const w: Wave = { fn: 'cos', A: q(2), B: ex(1, 4), C: ex(0), D: q(0) }
    const lay = trigGraphLayout({ ...waveGraph(w, { window: [-8 * Math.PI, 8 * Math.PI] }), ticks: { xPiOver: 2, yStep: 1 } })
    for (let i = 1; i < lay.xLabels.length; i++) expect(lay.xLabels[i]!.box.l).toBeGreaterThan(lay.xLabels[i - 1]!.box.r)
  })
})

describe('the curve to its true shape', () => {
  const unscale = (lay: ReturnType<typeof trigGraphLayout>, spec: GraphSpec) => {
    const [xLo, xHi] = spec.xDomain!
    const [yLo, yHi] = spec.yDomain!
    return (p: { x: number; y: number }) => ({ x: xLo + ((p.x - lay.plot.l) / (lay.plot.r - lay.plot.l)) * (xHi - xLo), y: yHi - ((p.y - lay.plot.t) / (lay.plot.b - lay.plot.t)) * (yHi - yLo) })
  }

  it('y = 3 sin(2x − π/2) + 1: every drawn point is on the curve', () => {
    const w: Wave = { fn: 'sin', A: q(3), B: ex(2), C: ex(1, 4, 1), D: q(1) }
    const spec = waveGraph(w, { window: [-Math.PI / 4, (7 * Math.PI) / 4] })
    for (const run of spec.runs!) for (const s of run) expect(s.y).toBeCloseTo(3 * Math.sin(2 * s.x - Math.PI / 2) + 1, 9)
    const lay = trigGraphLayout(spec)
    const back = unscale(lay, spec)
    for (const c of lay.curves) for (const p of c) {
      const m = back(p)
      // Two decimals of a unit in the layout: within about 0.01 of a unit of height.
      expect(Math.abs(m.y - (3 * Math.sin(2 * m.x - Math.PI / 2) + 1))).toBeLessThan(0.08)
    }
  })

  it('y = tan(x/2): one run per branch, none crossing an asymptote (x = ±π), each running off the window', () => {
    const w: Wave = { fn: 'tan', A: q(1), B: ex(1, 2), C: ex(0), D: q(0) }
    const spec = waveGraph(w, { window: [-2 * Math.PI, 2 * Math.PI], asymptotes: true })
    expect(spec.guides!.map((g) => g.x)).toEqual([-Math.PI, Math.PI])
    expect(spec.runs).toHaveLength(3)
    for (const run of spec.runs!) {
      const xs = run.map((s) => s.x)
      for (const a of [-Math.PI, Math.PI]) expect(xs.every((x) => x < a) || xs.every((x) => x > a)).toBe(true)
      for (const s of run) expect(s.y).toBeCloseTo(Math.tan(s.x / 2), 6)
    }
    // The middle branch reaches the top and the bottom of the window.
    const lay = trigGraphLayout(spec)
    const middle = lay.curves.filter((c) => c.length > 10)
    expect(Math.min(...middle.flat().map((p) => p.y))).toBeCloseTo(lay.plot.t, 0)
    expect(Math.max(...middle.flat().map((p) => p.y))).toBeCloseTo(lay.plot.b, 0)
  })

  it('the asymptotes are drawn dashed, and the graph names itself without a formula', () => {
    const w: Wave = { fn: 'sec', A: q(1), B: ex(2), C: ex(0), D: q(-3) }
    const spec = waveGraph(w, { window: [-Math.PI, Math.PI], asymptotes: true })
    const { container } = render(<TrigGraph spec={spec} />)
    const dashed = container.querySelectorAll('[data-trig="asymptote"]')
    expect(dashed.length).toBe(4)
    for (const d of dashed) expect(d.getAttribute('stroke-dasharray')).toBe('6 4')
    const aria = container.querySelector('svg')!.getAttribute('aria-label')!
    expect(aria).toMatch(/vertical asymptotes dashed/)
    expect(aria).not.toMatch(/sec|cos|\d/)
    const card = render(<TrigGraph spec={{ ...spec, ariaLabel: 'Graph C' }} />)
    expect(card.container.querySelector('svg')!.getAttribute('aria-label')).toBe('Graph C')
  })
})

describe('ticks are additive: every other graph is drawn as before', () => {
  it('GraphPanel draws a trig graph only when the spec has ticks', () => {
    const runs = [[{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }]]
    const plain = render(<GraphPanel spec={{ kind: 'function', runs, xDomain: [0, 2], yDomain: [-1, 2] }} />)
    expect(plain.container.querySelector('[data-trig-graph]')).toBeNull()
    expect(plain.container.querySelector('svg')).not.toBeNull()
    plain.unmount()
    const trig = render(<GraphPanel spec={{ kind: 'function', runs, xDomain: [0, 2], yDomain: [-1, 2], ticks: { xStep: 1, yStep: 1 } }} />)
    expect(trig.container.querySelector('[data-trig-graph]')).not.toBeNull()
  })

  it(
    'no module outside Unit 5 sets ticks on a graph (three seeds of every template)',
    () => {
      const unit5 = new Set<ModuleId>(['sinusoids', 'otherTrigGraphs', 'inverseTrig'])
      let graphs = 0
      for (const mod of MODULES) {
        if (unit5.has(mod.id)) continue
        for (const t of mod.templates) {
          for (const seed of [1, 2, 3]) {
            const p = generateProblem(mod.id, t.id, seed)
            expect(p.graph.ticks, `${p.id}`).toBeUndefined()
            graphs++
          }
        }
      }
      expect(graphs).toBeGreaterThan(300)
    },
    LOOP_TIMEOUT,
  )
})

const UNIT5: [ModuleId, string][] = [
  ['sinusoids', 'sg.features'],
  ['sinusoids', 'sg.equation'],
  ['sinusoids', 'sg.model'],
  ['otherTrigGraphs', 'og.features'],
  ['otherTrigGraphs', 'og.match'],
  ['inverseTrig', 'it.evaluate'],
  ['inverseTrig', 'it.compose'],
]

/** Every trig graph a problem has: the figure's graph or cards, and the graph behind the Graph panel's gate. */
function graphsOf(moduleId: ModuleId, templateId: string, seed: number): GraphSpec[] {
  const p = generateProblem(moduleId, templateId, seed)
  const a = p.answer as TrigAnswer
  return [p.graph, a.figure.graph, ...(a.figure.graphs ?? []).map((g) => g.graph)].filter((g): g is GraphSpec => !!g && g.kind === 'function' && !!g.ticks)
}

describe.each(UNIT5)('%s/%s: labelled points clear of the curve and of each other (300 seeds)', (moduleId, templateId) => {
  it(
    'every label inside the figure, off the curve, the asymptotes, the tick labels, the dots and the other labels; rarely across an axis',
    () => {
      let labelled = 0
      let acrossAxis = 0
      const bad: string[] = []
      for (let seed = 1; seed <= 300; seed++) {
        for (const spec of graphsOf(moduleId, templateId, seed)) {
          const lay = trigGraphLayout(spec)
          expect(lay.width).toBe(TG_W)
          expect(lay.height).toBe(TG_H)
          expect(JSON.stringify(lay)).not.toMatch(/NaN|null/)
          const markers = spec.markers ?? []
          // Every point given a label is inside the window and drawn.
          expect(lay.markers.length, `${templateId}/${seed}`).toBe(markers.length)
          const curveSegs = lay.curves.flatMap((c) => c.slice(1).map((p, i) => ({ a: c[i]!, b: p })))
          const dotBoxes = lay.markers.map((mk) => ({ l: mk.cx - 4, r: mk.cx + 4, t: mk.cy - 4, b: mk.cy + 4 }))
          lay.markers.forEach((mk, i) => {
            labelled++
            const others = lay.markers.filter((_, j) => j !== i)
            // An axis line may run under a label (its white halo breaks the line) where no other spot is free.
            const obstacles = { width: lay.width, height: lay.height, curveSegs, guides: lay.guides, axes: [], xLabels: lay.xLabels, yLabels: lay.yLabels, dotBoxes, placed: others }
            if (!labelClear(mk.box, obstacles)) bad.push(`${templateId}/${seed}: “${mk.label}” at (${mk.x}, ${mk.y})`)
            else if (!labelClear(mk.box, { ...obstacles, axes: lay.axes })) acrossAxis++
          })
        }
      }
      expect(bad.slice(0, 8)).toEqual([])
      expect(acrossAxis, `${acrossAxis} of ${labelled} labels cross an axis`).toBeLessThanOrEqual(Math.max(2, labelled * 0.03))
      if (templateId === 'sg.equation') expect(labelled).toBeGreaterThan(200)
    },
    LOOP_TIMEOUT,
  )
})

describe('a drawn wave is its equation', () => {
  it('waveValue agrees with Math on the six functions', () => {
    const cases: [Wave, (x: number) => number][] = [
      [{ fn: 'sin', A: q(3), B: ex(2), C: ex(1, 4, 1), D: q(1) }, (x) => 3 * Math.sin(2 * (x - Math.PI / 4)) + 1],
      [{ fn: 'cos', A: q(-1, 2), B: ex(3), C: ex(-1, 4, 1), D: q(2) }, (x) => -0.5 * Math.cos(3 * (x + Math.PI / 4)) + 2],
      [{ fn: 'tan', A: q(1), B: ex(1, 2), C: ex(0), D: q(0) }, (x) => Math.tan(x / 2)],
      [{ fn: 'cot', A: q(2), B: ex(1), C: ex(1, 3, 1), D: q(-1) }, (x) => 2 / Math.tan(x - Math.PI / 3) - 1],
      [{ fn: 'sec', A: q(1), B: ex(1, 1, 1), C: ex(5, 6), D: q(0) }, (x) => 1 / Math.cos(Math.PI * (x - 5 / 6))],
      [{ fn: 'csc', A: q(-3), B: ex(2), C: ex(0), D: q(4) }, (x) => -3 / Math.sin(2 * x) + 4],
    ]
    for (const [w, f] of cases) for (const x of [-2.3, -0.7, 0.4, 1.3, 2.9]) expect(waveValue(w, x)).toBeCloseTo(f(x), 9)
  })
})
