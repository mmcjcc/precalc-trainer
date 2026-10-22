/**
 * The right-triangle figure's layout over every right-triangle template, 300 seeds each, in every state she sees it in
 * (before any part, after each part, done): no label sits on a line (the sides, the ladder, the arcs, the right-angle
 * mark, the ticks, the dimension lines, the scene), on a filled shape, on another label, or off the figure; a
 * dimension line runs the whole length of its side, end to end; the right-angle mark is at the right angle; a side
 * she finds has no label until she has found it, then its length.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { TrigAnswer } from '@/content/types'
import { segHitsBox, triangleLayout, type Box } from './trigTriangle'

const overlaps = (p: Box, q: Box) => p.l < q.r && q.l < p.r && p.t < q.b && q.t < p.b
const LOOP_TIMEOUT = 120_000

describe.each(['rt.ratios', 'rt.special', 'rt.side', 'rt.angle'])('%s figures over 300 seeds', (templateId) => {
  it(
    'every label clear of every line, shape, other label and edge, in every state',
    () => {
      const clashes: string[] = []
      for (let seed = 1; seed <= 300 && clashes.length < 10; seed++) {
        const a = generateProblem('rightTriangle', templateId, seed).answer as TrigAnswer
        const tri = a.figure.triangle!
        for (let passed = 0; passed <= a.stages.length; passed++) {
          const answered = new Set(a.stages.slice(0, passed).map((s) => s.id))
          const lay = triangleLayout(tri, (after) => !after || answered.has(after))
          const where = `${templateId}/${seed} (${tri.scene}, after ${passed})`
          lay.labels.forEach((l, i) => {
            const b = l.box
            if (b.l < 2 || b.t < 2 || b.r > lay.width - 2 || b.b > lay.height - 2) clashes.push(`${where}: “${l.text}” off the figure`)
            // A dimension label sits in its own line's gap: only the other strokes count.
            const own = l.kind === 'dimension' ? lay.dims.find((d) => d.key === l.key) : null
            const ownSegs = own ? new Set([...own.line, ...own.ticks, ...own.ext].map(([p, q]) => `${p.x},${p.y},${q.x},${q.y}`)) : new Set<string>()
            for (const s of lay.strokes) {
              if (ownSegs.has(`${s.a.x},${s.a.y},${s.b.x},${s.b.y}`)) continue
              if (segHitsBox(s, b)) {
                clashes.push(`${where}: “${l.text}” on a line`)
                break
              }
            }
            if (lay.obstacles.some((o) => overlaps(o, b))) clashes.push(`${where}: “${l.text}” on a shape`)
            lay.labels.forEach((m, j) => {
              if (j > i && overlaps(m.box, b)) clashes.push(`${where}: “${l.text}” on “${m.text}”`)
            })
          })
        }
      }
      expect(clashes).toEqual([])
    },
    LOOP_TIMEOUT,
  )

  it(
    'dimension lines run end to end; the right-angle mark is at the right angle; a found side is labelled only once found',
    () => {
      for (let seed = 1; seed <= 300; seed++) {
        const a = generateProblem('rightTriangle', templateId, seed).answer as TrigAnswer
        const tri = a.figure.triangle!
        const before = triangleLayout(tri, (after) => !after)
        const done = triangleLayout(tri, () => true)
        for (const d of done.dims) {
          const [from, to] = d.key.split('-') as [string, string]
          const A = done.P[from]!
          const B = done.P[to]!
          // The extension lines start at the side's own two corners.
          expect(Math.hypot(d.ext[0]![0].x - A.x, d.ext[0]![0].y - A.y)).toBeLessThan(4)
          expect(Math.hypot(d.ext[1]![0].x - B.x, d.ext[1]![0].y - B.y)).toBeLessThan(4)
          // The line's ends are A and B carried across, so the length shown is the whole side.
          const n = { x: d.line[0]![0].x - A.x, y: d.line[0]![0].y - A.y }
          expect(Math.abs(d.line[1]![1].x - (B.x + n.x))).toBeLessThan(0.01)
          expect(Math.abs(d.line[1]![1].y - (B.y + n.y))).toBeLessThan(0.01)
        }
        const R = done.P[tri.right]!
        expect(Math.min(...done.rightMark.map((p) => Math.hypot(p.x - R.x, p.y - R.y)))).toBeLessThan(12)
        for (const s of tri.sides.filter((x) => x.after)) {
          expect(before.labels.some((l) => l.key === `${s.from}-${s.to}`), `${templateId}/${seed}: found side labelled early`).toBe(false)
          expect(done.labels.find((l) => l.key === `${s.from}-${s.to}`)?.text).toBe(s.label)
        }
      }
    },
    LOOP_TIMEOUT,
  )
})
