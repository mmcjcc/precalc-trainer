// @vitest-environment jsdom
/**
 * Honors geometry Unit 7 figures at 375 px. Every figure each template can make (300 seeds per template) is checked:
 * labels stay off the lines, off each other, and inside the figure (GeoFigure's own layout); the segment labels and
 * dimension lines GeoFigure draws but does not report are held to the same rule with the generators' copy of its
 * arithmetic, and that copy agrees with the component exactly. Each segment's label is nearer its own segment than any
 * other, a label on a side of a triangle sits outside it, the hypotenuse's two segments each get their own dimension
 * line, and the side she is asked for is labeled with a letter or "?" only, never a number.
 */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import { figureLayout, layoutOf } from '@/content/modules/geometry/unit5Layout'
import { figureIssues6 } from '@/content/modules/geometry/unit6Build'
import type { GeoFigureSpec, ModuleId } from '@/shared/types'
import { GeoFigure, geoFigureLayout, type Stroke } from './GeoFigure'

const HEAVY = 120_000
const SEEDS = 300

const TEMPLATES: readonly (readonly [ModuleId, string])[] = [
  ['geoRightSimilar', 'rs.altitude'],
  ['geoPythagorean', 'py.side'],
  ['geoPythagorean', 'py.apply'],
  ['geoSpecialRight', 'sp.special'],
]

function answerOf(module: ModuleId, template: string, seed: number): GeometryAnswer {
  return generateProblem(module, template, seed).answer as GeometryAnswer
}

/** Does the stroke pass through the box grown by `margin`? (the same test GeoFigure.test.tsx uses) */
function crosses([x1, y1, x2, y2]: Stroke, box: { l: number; t: number; r: number; b: number }, margin: number): boolean {
  const l = box.l - margin
  const r = box.r + margin
  const t = box.t - margin
  const b = box.b + margin
  let lo = 0
  let hi = 1
  const dx = x2 - x1
  const dy = y2 - y1
  for (const [p, q] of [
    [-dx, x1 - l],
    [dx, r - x1],
    [-dy, y1 - t],
    [dy, b - y1],
  ] as const) {
    if (p === 0) {
      if (q < 0) return false
    } else if (p < 0) lo = Math.max(lo, q / p)
    else hi = Math.min(hi, q / p)
    if (lo > hi) return false
  }
  return true
}

const apart = (p: { l: number; t: number; r: number; b: number }, q: { l: number; t: number; r: number; b: number }) => p.r <= q.l || q.r <= p.l || p.b <= q.t || q.b <= p.t

/** GeoFigure's own layout check, as in GeoFigure.test.tsx. */
function layoutProblems(spec: GeoFigureSpec): string[] {
  const { width, height, strokes, dots, labels, leaders } = geoFigureLayout(spec)
  const out: string[] = []
  for (const leader of leaders) {
    for (const label of labels) if (label.text !== leader.text && crosses(leader.stroke, label, 0)) out.push(`the leader to ${leader.text} crosses ${label.kind} ${label.text}`)
  }
  for (const label of labels) {
    if (label.l < 0 || label.t < 0 || label.r > width || label.b > height) out.push(`${label.kind} ${label.text} leaves the figure`)
    if (strokes.some((s) => crosses(s, label, 1))) out.push(`${label.kind} ${label.text} sits on a line`)
    if (label.kind !== 'point' && dots.some((d) => !apart(label, d))) out.push(`${label.kind} ${label.text} covers a dot`)
  }
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) if (!apart(labels[i]!, labels[j]!)) out.push(`${labels[i]!.kind} ${labels[i]!.text} covers ${labels[j]!.kind} ${labels[j]!.text}`)
  }
  return out
}

function box(label: { l: number; t: number; r: number; b: number; text: string; kind: string }) {
  return { l: Math.round(label.l * 1000) / 1000, t: Math.round(label.t * 1000) / 1000, r: Math.round(label.r * 1000) / 1000, b: Math.round(label.b * 1000) / 1000, text: label.text, kind: label.kind }
}

type P = { x: number; y: number }
function distToSegment(p: P, a: P, b: P): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}
function inside(p: P, poly: P[]): boolean {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!
    const b = poly[j]!
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit
  }
  return hit
}

describe.each(TEMPLATES)('Unit 7 figures: %s/%s', (module, template) => {
  it(
    'keep every label off the lines, off each other, and inside the figure, over 300 seeds',
    () => {
      const problems: string[] = []
      for (let seed = 1; seed <= SEEDS; seed++) {
        const spec = answerOf(module, template, seed).figure
        for (const p of layoutProblems(spec)) problems.push(`${template}/${seed}: ${p}`)
        // The stricter check: segment labels, ticks, squares, dimension lines, the figure's edge.
        for (const p of figureIssues6(spec)) problems.push(`${template}/${seed}: ${p}`)
      }
      expect(problems.slice(0, 12)).toEqual([])
    },
    HEAVY,
  )

  it(
    'each segment’s label is nearer its own segment than any other, and a side’s label sits outside the triangle',
    () => {
      const problems: string[] = []
      for (let seed = 1; seed <= SEEDS; seed++) {
        const a = answerOf(module, template, seed)
        const spec = a.figure
        const lay = figureLayout(spec)
        const { sx, sy } = layoutOf(spec)
        const at = (id: string): P => {
          const p = spec.points.find((q) => q.id === id)!
          return { x: sx(p.x), y: sy(p.y) }
        }
        const segs = spec.segments ?? []
        const boxes = lay.labels.filter((l) => l.kind === 'segment')
        let k = 0
        for (const s of segs) {
          if (!s.label) continue
          const b = boxes[k++]!
          const c = { x: (b.l + b.r) / 2, y: (b.t + b.b) / 2 }
          const own = distToSegment(c, at(s.from), at(s.to))
          for (const o of segs) {
            if (o === s) continue
            const d = distToSegment(c, at(o.from), at(o.to))
            if (d <= own) problems.push(`${template}/${seed}: the label ${s.label.trim()} of ${s.from}${s.to} is nearer ${o.from}${o.to}`)
          }
        }
        // A triangle's side labeled beside it has its label outside the triangle: find each drawn triangle of three
        // segments and test the label's middle.
        const pts = new Set(segs.flatMap((s) => [s.from, s.to]))
        const has = (p: string, q: string) => segs.some((s) => (s.from === p && s.to === q) || (s.from === q && s.to === p))
        const list = [...pts]
        const triangles: string[][] = []
        for (let i = 0; i < list.length; i++)
          for (let j = i + 1; j < list.length; j++)
            for (let m = j + 1; m < list.length; m++) if (has(list[i]!, list[j]!) && has(list[j]!, list[m]!) && has(list[i]!, list[m]!)) triangles.push([list[i]!, list[j]!, list[m]!])
        k = 0
        for (const s of segs) {
          if (!s.label) continue
          const b = boxes[k++]!
          if (s.labelSide === 'below') continue
          const c = { x: (b.l + b.r) / 2, y: (b.t + b.b) / 2 }
          for (const t of triangles) {
            if (!(t.includes(s.from) && t.includes(s.to))) continue
            // A side of this triangle: its label is not inside it.
            if (inside(c, t.map(at))) {
              // An interior segment (an altitude or a diagonal) is a side of two small triangles, one on each side of it,
              // so its label is inside one of them by necessity; a side of only one triangle is an outer side.
              const sideOf = (u: string[]) => {
                const third = at(u.find((id) => id !== s.from && id !== s.to)!)
                const p = at(s.from)
                const q = at(s.to)
                return Math.sign((q.x - p.x) * (third.y - p.y) - (q.y - p.y) * (third.x - p.x))
              }
              const around = triangles.filter((u) => u.includes(s.from) && u.includes(s.to)).map(sideOf)
              const interior = around.includes(1) && around.includes(-1)
              if (!interior) problems.push(`${template}/${seed}: the label ${s.label.trim()} of the side ${s.from}${s.to} sits inside the triangle ${t.join('')}`)
            }
          }
        }
      }
      expect(problems.slice(0, 12)).toEqual([])
    },
    HEAVY,
  )

  it(
    'the generators’ copy of the label arithmetic agrees with GeoFigure, and segment labels are where GeoFigure draws them',
    () => {
      const problems: string[] = []
      for (let seed = 1; seed <= SEEDS; seed += 2) {
        const spec = answerOf(module, template, seed).figure
        const theirs = geoFigureLayout(spec)
        const ours = figureLayout(spec)
        const a = theirs.labels.map(box)
        const b = ours.labels.filter((l) => l.kind !== 'segment').map(box)
        if (JSON.stringify(a) !== JSON.stringify(b)) problems.push(`${template}/${seed}: labels differ`)
        if (theirs.height !== ours.height) problems.push(`${template}/${seed}: height ${theirs.height} vs ${ours.height}`)
        const { container, unmount } = render(<GeoFigure spec={spec} />)
        const drawn = [...container.querySelectorAll('[data-geo="seg-label"]')].map((el) => ({ text: el.textContent ?? '', x: Number(el.getAttribute('x')), y: Number(el.getAttribute('y')) }))
        const dims = container.querySelectorAll('[data-geo="dimension"]').length
        unmount()
        const copy = ours.labels.filter((l) => l.kind === 'segment')
        if (drawn.length !== copy.length) problems.push(`${template}/${seed}: ${drawn.length} segment labels drawn, ${copy.length} in the copy`)
        drawn.forEach((d, i) => {
          const c = copy[i]
          if (!c || c.text !== d.text) return problems.push(`${template}/${seed}: segment label ${d.text}`)
          const cx = (c.l + c.r) / 2
          const cy = (c.t + c.b) / 2
          if (Math.abs(cx - d.x) > 1e-6 || Math.abs(cy - d.y) > 1e-6) problems.push(`${template}/${seed}: ${d.text} drawn at ${d.x}, ${d.y}, copy at ${cx}, ${cy}`)
        })
        const below = (spec.segments ?? []).filter((s) => s.label && s.labelSide === 'below').length
        if (dims !== below) problems.push(`${template}/${seed}: ${dims} dimension lines drawn for ${below} labels below`)
      }
      expect(problems.slice(0, 8)).toEqual([])
    },
    HEAVY,
  )

  it(
    'draws every figure: distinct points, marks on points, pieces of the hypotenuse on dimension lines, the asked side never numbered',
    () => {
      const problems: string[] = []
      let pieces = 0
      for (let seed = 1; seed <= SEEDS; seed++) {
        const a = answerOf(module, template, seed)
        const spec = a.figure
        const ids = new Set(spec.points.map((p) => p.id))
        if (ids.size !== spec.points.length) problems.push(`${template}/${seed}: a repeated point`)
        for (let i = 0; i < spec.points.length; i++) {
          for (let j = i + 1; j < spec.points.length; j++) {
            const [p, q] = [spec.points[i]!, spec.points[j]!]
            if (Math.hypot(p.x - q.x, p.y - q.y) < 1e-6) problems.push(`${template}/${seed}: ${p.id} and ${q.id} coincide`)
          }
        }
        const refs = [...(spec.segments ?? []).flatMap((s) => [s.from, s.to]), ...(spec.angles ?? []).flatMap((g) => [g.vertex, g.from, g.to])]
        for (const r of refs) if (!ids.has(r)) problems.push(`${template}/${seed}: a mark uses missing point ${r}`)
        // A labeled piece of a longer segment (in line with another segment, going on past the shared point) is on a
        // dimension line, never a label beside it.
        const at = (id: string) => spec.points.find((p) => p.id === id)!
        for (const s of spec.segments ?? []) {
          if (!s.label) continue
          const piece = (spec.segments ?? []).some((o) => {
            if (o === s) return false
            const shared = [o.from, o.to].filter((id) => id === s.from || id === s.to)
            if (shared.length !== 1) return false
            const p = at(shared[0]!)
            const q = at(shared[0] === s.from ? s.to : s.from)
            const r = at(o.from === shared[0] ? o.to : o.from)
            const cross = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
            const len = Math.hypot(q.x - p.x, q.y - p.y) * Math.hypot(r.x - p.x, r.y - p.y)
            const dot = (q.x - p.x) * (r.x - p.x) + (q.y - p.y) * (r.y - p.y)
            return Math.abs(cross) < 1e-3 * len && dot < 0
          })
          if (piece) pieces++
          if (piece && s.labelSide !== 'below') problems.push(`${template}/${seed}: the piece ${s.from}${s.to} is labeled beside it`)
        }
        // Every label is a given from the prompt (a number, a radical, an expression in x) or a letter for the side
        // asked (x, y, or ?): never a number the prompt does not give.
        const promptNumbers = new Set((a.prompt.match(/\d*√\d+|\d+/g) ?? []).map(String))
        for (const s of spec.segments ?? []) {
          const t = s.label?.trim()
          if (!t) continue
          if (t === 'x' || t === 'y' || t === '?') continue
          if (/x/.test(t)) {
            if (!a.prompt.includes(t)) problems.push(`${template}/${seed}: the expression ${t} is not in the prompt`)
            continue
          }
          if (!promptNumbers.has(t)) problems.push(`${template}/${seed}: the label ${t} is not a number the prompt gives`)
        }
        const { container, unmount } = render(<GeoFigure spec={spec} />)
        const svg = container.querySelector('svg')
        if (!svg || svg.getAttribute('role') !== 'img' || svg.getAttribute('aria-label') !== spec.ariaLabel) problems.push(`${template}/${seed}: not drawn`)
        if (!svg?.getAttribute('viewBox')?.startsWith('0 0 360 ')) problems.push(`${template}/${seed}: viewBox`)
        if (container.querySelectorAll('[data-geo="point"]').length !== spec.points.filter((p) => p.label).length) problems.push(`${template}/${seed}: points`)
        if (container.innerHTML.includes('NaN') || container.innerHTML.includes('undefined')) problems.push(`${template}/${seed}: NaN in the drawing`)
        unmount()
      }
      expect(problems.slice(0, 10)).toEqual([])
      // The altitude problems label the pieces of the hypotenuse on most seeds.
      if (template === 'rs.altitude') expect(pieces, template).toBeGreaterThan(SEEDS / 2)
    },
    HEAVY,
  )
})
