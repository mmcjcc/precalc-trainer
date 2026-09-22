import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { parseInterval, setsEqual } from '@/notation'
import type { ErrorPatternId } from '@/shared/types'
import { featuresOf } from './answers'
import { slopeAt, valueAt } from './curve'
import { formatPoint, formatQuarter, isQuarter, joinPoints, near } from './format'
import { canonicalEntries, GF_PATTERN_IDS, gradeGraphFeatures, type GfAnswer, type GfEntries } from './grade'
import { WORKSHEET_TURNS, worksheetInstance } from './generate'

function answerOf(seed: number): GfAnswer {
  const p = generateProblem('graphFeatures', 'gf.features', seed)
  if (p.answer.type !== 'graphFeatures') throw new Error('expected a graphFeatures answer')
  return p.answer
}

function withFields(answer: GfAnswer, patch: Partial<GfEntries>): GfEntries {
  return { ...canonicalEntries(answer), ...patch }
}

/** Replace turning-point x-values with their heights, without touching a longer number that contains them. */
function heightsInstead(text: string, answer: GfAnswer): string {
  const pairs = answer.turns
    .map((t) => [formatQuarter(t.x), formatQuarter(t.y)] as const)
    .sort((a, b) => b[0].length - a[0].length)
  let out = text
  for (const [x, y] of pairs) {
    const token = x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`(?<![\\d.])${token}(?![\\d.])`, 'g'), y)
  }
  return out
}

function closeTurns(s: string): string {
  return s.replaceAll('(', '[').replaceAll(')', ']').replaceAll('[-inf', '(-inf').replaceAll('inf]', 'inf)')
}

function bracketInfinity(s: string): string {
  if (s.includes('(-inf')) return s.replace('(-inf', '[-inf')
  if (s.includes(', inf)')) return s.replace(', inf)', ', inf]')
  throw new Error(`no infinity in ${s}`)
}

function strangerPoint(answer: GfAnswer): string {
  for (const p of [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 3, y: -1 },
  ]) {
    if (!answer.turns.some((t) => near(t.x, p.x) && near(t.y, p.y))) return formatPoint(p)
  }
  return '(9, 9)'
}

/** One realistic wrong answer per gf_ pattern, built from this problem's own numbers. */
function realisticWrong(answer: GfAnswer, id: (typeof GF_PATTERN_IDS)[number]): GfEntries | null {
  const base = canonicalEntries(answer)
  switch (id) {
    case 'gf_union_between_points': {
      // U only shows up once a box lists two points. W lists two mins, M two maxes; an S has one of each,
      // so she dumps both labelled turns into the local-min box with U between them.
      if (answer.localMin.includes(' and ')) return { ...base, localMin: answer.localMin.replaceAll(' and ', ' U ') }
      if (answer.localMax.includes(' and ')) return { ...base, localMax: answer.localMax.replaceAll(' and ', ' U ') }
      return { ...base, localMin: answer.turns.map((t) => formatPoint(t)).join(' U ') }
    }
    case 'gf_y_for_intervals':
      return { ...base, increasing: heightsInstead(answer.increasing, answer) }
    case 'gf_brackets_at_turns':
      return { ...base, increasing: closeTurns(answer.increasing), decreasing: closeTurns(answer.decreasing) }
    case 'gf_swapped_inc_dec':
      return { ...base, increasing: answer.decreasing, decreasing: answer.increasing }
    case 'gf_global_on_ray':
      if (answer.globalMaxPoint === null) return { ...base, globalMax: answer.localMax }
      if (answer.globalMinPoint === null) return { ...base, globalMin: answer.localMin }
      return null
    case 'gf_global_not_local': {
      if (answer.globalMinPoint) {
        const rest = answer.localMinPoints.filter((p) => !(near(p.x, answer.globalMinPoint!.x) && near(p.y, answer.globalMinPoint!.y)))
        if (rest.length === 0) return null
        return { ...base, localMin: joinPoints(rest) }
      }
      if (answer.globalMaxPoint) {
        const rest = answer.localMaxPoints.filter((p) => !(near(p.x, answer.globalMaxPoint!.x) && near(p.y, answer.globalMaxPoint!.y)))
        if (rest.length === 0) return null
        return { ...base, localMax: joinPoints(rest) }
      }
      return null
    }
    case 'gf_not_turning_point':
      return { ...base, localMax: strangerPoint(answer) }
    case 'gf_swapped_coordinates': {
      const p = answer.localMaxPoints[0] ?? answer.localMinPoints[0]
      if (!p) return null
      return { ...base, localMax: `(${formatQuarter(p.y)}, ${formatQuarter(p.x)})` }
    }
  }
}

describe('gf.features generator', () => {
  it('is deterministic over 300 seeds, and every curve and canonical answer checks out', () => {
    const shapes = new Set<string>()
    for (let seed = 1; seed <= 300; seed++) {
      const a = generateProblem('graphFeatures', 'gf.features', seed)
      const b = generateProblem('graphFeatures', 'gf.features', seed)
      expect(b).toEqual(a)
      expect(a.kind).toBe('graphFeatures')
      expect(a.calc).toEqual({ ti84: [], nspire: [] })
      expect(a.graph.kind).toBe('function')
      expect(a.graph.f).toBeUndefined()
      if (a.answer.type !== 'graphFeatures') throw new Error('type')
      const ans = a.answer
      shapes.add(ans.shape)
      const turns = ans.turns
      expect(turns.length === 2 || turns.length === 3).toBe(true)
      const xs = turns.map((t) => t.x)
      const ys = turns.map((t) => t.y)
      for (const t of turns) {
        expect(isQuarter(t.x), `${seed} x`).toBe(true)
        expect(isQuarter(t.y), `${seed} y`).toBe(true)
        expect(t.x).toBeGreaterThanOrEqual(-8)
        expect(t.x).toBeLessThanOrEqual(8)
        expect(t.y).toBeGreaterThanOrEqual(-8)
        expect(t.y).toBeLessThanOrEqual(8)
      }
      for (let i = 0; i < turns.length - 1; i++) expect(turns[i + 1]!.x - turns[i]!.x).toBeGreaterThanOrEqual(3 - 1e-9)
      for (const y of ys) expect(xs.some((x) => near(x, y))).toBe(false)

      const tail = Number(a.params.tail)
      const [xLo, xHi] = a.graph.xDomain!
      const [yLo, yHi] = a.graph.yDomain!
      for (const t of turns) {
        expect(valueAt(turns, tail, t.x)).toBe(t.y)
        expect(slopeAt(turns, tail, t.x)).toBe(0)
        const left = slopeAt(turns, tail, t.x - 0.05)
        const right = slopeAt(turns, tail, t.x + 0.05)
        if (t.kind === 'min') {
          expect(left).toBeLessThan(0)
          expect(right).toBeGreaterThan(0)
        } else {
          expect(left).toBeGreaterThan(0)
          expect(right).toBeLessThan(0)
        }
        expect(t.x).toBeGreaterThan(xLo)
        expect(t.x).toBeLessThan(xHi)
        expect(t.y).toBeGreaterThan(yLo)
        expect(t.y).toBeLessThan(yHi)
        const sample = a.graph.samples!.find((s) => s.x === t.x)
        expect(sample?.y).toBe(t.y)
        const marker = a.graph.markers!.find((m) => m.x === t.x)
        expect(marker?.label).toBe(formatPoint(t))
      }
      // The drawn polyline is strictly monotone on each piece, and the tails leave the window.
      const samples = a.graph.samples!
      expect(samples[0]!.y < yLo || samples[0]!.y > yHi).toBe(true)
      expect(samples[samples.length - 1]!.y < yLo || samples[samples.length - 1]!.y > yHi).toBe(true)
      const bounds = [xLo, ...xs, xHi]
      for (let i = 0; i < bounds.length - 1; i++) {
        const lo = bounds[i]!
        const hi = bounds[i + 1]!
        const dir = slopeAt(turns, tail, (lo + hi) / 2) > 0 ? 1 : -1
        const seg = samples.filter((s) => s.x >= lo - 1e-9 && s.x <= hi + 1e-9)
        expect(seg.length).toBeGreaterThan(2)
        for (let k = 0; k < seg.length - 1; k++) {
          expect((seg[k + 1]!.y - seg[k]!.y) * dir).toBeGreaterThan(0)
        }
      }

      const inc = parseInterval(ans.increasing)
      const dec = parseInterval(ans.decreasing)
      expect(inc.ok, ans.increasing).toBe(true)
      expect(dec.ok, ans.decreasing).toBe(true)
      if (inc.ok) expect(setsEqual(inc.set, ans.increasingSet)).toBe(true)
      if (dec.ok) expect(setsEqual(dec.set, ans.decreasingSet)).toBe(true)
      const grade = gradeGraphFeatures(ans, canonicalEntries(ans))
      expect(grade.correct, `seed ${seed}`).toBe(true)
      expect(grade.patterns).toEqual([])
    }
    expect(shapes).toEqual(new Set(['W', 'M', 'S']))
  }, 30_000)
})

describe('worksheet answers', () => {
  const inst = worksheetInstance()
  if (inst.answer.type !== 'graphFeatures') throw new Error('type')
  const ans = inst.answer

  it('matches her worksheet', () => {
    expect(ans.shape).toBe('W')
    expect(ans.leftEnd).toBe('up')
    expect(ans.rightEnd).toBe('up')
    expect(ans.turns).toEqual(WORKSHEET_TURNS)
    expect(ans.increasing).toBe('(-2.5, 2) U (7.25, inf)')
    expect(ans.decreasing).toBe('(-inf, -2.5) U (2, 7.25)')
    expect(ans.globalMax).toBe('none')
    expect(ans.globalMin).toBe('(7.25, -9.25)')
    expect(ans.localMax).toBe('(2, 3.25)')
    expect(ans.localMin).toBe('(-2.5, -5.5) and (7.25, -9.25)')
    expect(featuresOf(WORKSHEET_TURNS).increasing).toBe(ans.increasing)
  })

  it('accepts commas, fractions, None, and extra spaces', () => {
    const grade = gradeGraphFeatures(ans, {
      increasing: ' (-2.5, 2)  U  (7.25, inf) ',
      decreasing: '(-inf, -5/2) or (2, 29/4)',
      globalMax: 'None',
      globalMin: '(29/4, -37/4)',
      localMax: '(2, 3.25)',
      localMin: '(-5/2, -11/2), (29/4, -37/4)',
    })
    expect(grade.correct).toBe(true)
    expect(grade.patterns).toEqual([])
  })
})

describe('gf_ mistakes', () => {
  const seeds = [1, 2, 3, 4, 5, 8, 13, 21, 42, 100, 256]

  it('each pattern fires on a realistic wrong answer and never on the right one', () => {
    const seen = new Set<string>()
    const shaped: GfAnswer[] = []
    for (const shape of ['W', 'M', 'S'] as const) {
      for (let seed = 1; seed <= 80 && shaped.filter((a) => a.shape === shape).length === 0; seed++) {
        const ans = answerOf(seed)
        if (ans.shape === shape) shaped.push(ans)
      }
    }
    for (const ans of [...seeds.map(answerOf), ...shaped]) {
      const right = gradeGraphFeatures(ans, canonicalEntries(ans))
      expect(right.correct).toBe(true)
      for (const id of GF_PATTERN_IDS) {
        expect(right.patterns.map((p) => p.id)).not.toContain(id)
        const wrong = realisticWrong(ans, id)
        if (!wrong) continue
        const grade = gradeGraphFeatures(ans, wrong)
        expect(grade.correct, `${id} ${ans.shape}`).toBe(false)
        expect(grade.patterns.map((p) => p.id), `${id} ${ans.shape} ${ans.increasing}`).toContain(id)
        const hit = grade.patterns.find((p) => p.id === id)!
        expect(hit.lesson.length).toBeGreaterThan(20)
        expect(hit.witness && hit.witness.length).toBeGreaterThan(10)
        expect(hit.example).toMatch(/→|✗/)
        seen.add(id)
      }
    }
    expect([...seen].sort()).toEqual([...GF_PATTERN_IDS].sort())
  })

  it('names the U between her local minimums, and the corrected "and" is right', () => {
    const ans = answerOf(1)
    // The fixed worksheet is asserted above; here a generated W or any shape still teaches U.
    const inst = worksheetInstance()
    if (inst.answer.type !== 'graphFeatures') throw new Error('type')
    const sheet = inst.answer
    const wrong = gradeGraphFeatures(sheet, withFields(sheet, { localMin: '(-2.5, -5.5) U (7.25, -9.25)' }))
    expect(wrong.fields.find((f) => f.id === 'localMin')?.pattern?.id).toBe('gf_union_between_points')
    expect(wrong.fields.filter((f) => f.id !== 'localMin').every((f) => f.status === 'ok')).toBe(true)
    expect(wrong.patterns.map((p) => p.id)).toEqual(['gf_union_between_points'])
    expect(wrong.patterns[0]!.witness).toContain('(7.25, -9.25)')
    expect(wrong.patterns[0]!.witness).toMatch(/backwards/)
    const fixed = gradeGraphFeatures(sheet, withFields(sheet, { localMin: '(-2.5, -5.5) and (7.25, -9.25)' }))
    expect(fixed.correct).toBe(true)
    // A generated problem's right answer still does not trip the pattern.
    expect(gradeGraphFeatures(ans, canonicalEntries(ans)).patterns).toEqual([])
  })

  it('keeps notation mistakes for interval typos, and a plain message has no pattern id', () => {
    const inst = worksheetInstance()
    if (inst.answer.type !== 'graphFeatures') throw new Error('type')
    const ans = inst.answer
    const cases: [GfEntries, ErrorPatternId][] = [
      [withFields(ans, { decreasing: bracketInfinity(ans.decreasing) }), 'infinity_bracket'],
      [withFields(ans, { increasing: ans.increasing.split(' U ')[0]! }), 'dropped_union'],
      [withFields(ans, { increasing: '(7.25, -2.5) U (2, inf)' }), 'backwards_interval'],
    ]
    for (const [entries, id] of cases) {
      const grade = gradeGraphFeatures(ans, entries)
      expect(grade.patterns.map((p) => p.id), id).toContain(id)
    }
    const plain = gradeGraphFeatures(ans, withFields(ans, { increasing: '(-8, -7)' }))
    expect(plain.correct).toBe(false)
    expect(plain.fields.find((f) => f.id === 'increasing')?.pattern).toBeUndefined()
    expect(plain.fields.find((f) => f.id === 'increasing')?.message).toContain(ans.increasing)
    expect(plain.patterns).toEqual([])
  })
})
