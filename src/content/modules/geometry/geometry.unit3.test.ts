/**
 * Honors geometry Unit 3. Every seed grades its own answers, keeps the promised trap as a real
 * candidate, and leaves the answer out of anything she can read before she finishes.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import type { GeoFigureSpec } from '@/shared/types'
import type { ModuleId } from '@/shared/types'
import { readLine, sameLine } from './lines'
import { GEO_UNIT3_MISTAKE_IDS, containsAnswer, exampleShowsAnswer, gradeGeoStage, stageDisplay } from './grade'
import { PARALLEL_RULES, POLYGON_RULES } from './unit3Rules'
import type { GeometryAnswer } from './build'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000

const TEMPLATES: { module: ModuleId; template: string; cards: typeof PARALLEL_RULES }[] = [
  { module: 'geoParallel', template: 'gl3.pairs', cards: PARALLEL_RULES },
  { module: 'geoParallel', template: 'gl3.solve', cards: PARALLEL_RULES },
  { module: 'geoParallel', template: 'gl3.converse', cards: PARALLEL_RULES },
  { module: 'geoParallel', template: 'gl3.slopes', cards: PARALLEL_RULES },
  { module: 'geoPolygonAngles', template: 'gpa.triangle', cards: POLYGON_RULES },
  { module: 'geoPolygonAngles', template: 'gpa.polygon', cards: POLYGON_RULES },
]

function answerOf(module: ModuleId, template: string, seed: number): GeometryAnswer {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${template}/${seed} is ${p.answer.type}`)
  return p.answer
}

function wedge(v: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const a1 = Math.atan2(a.y - v.y, a.x - v.x)
  const a2 = Math.atan2(b.y - v.y, b.x - v.x)
  let d = a2 - a1
  while (d <= -Math.PI) d += 2 * Math.PI
  while (d > Math.PI) d -= 2 * Math.PI
  return (Math.abs(d) * 180) / Math.PI
}

function point(fig: GeoFigureSpec, id: string): { x: number; y: number } {
  const p = fig.points.find((item) => item.id === id)
  if (!p) throw new Error(`missing ${id}`)
  return p
}

function convexPolygon(fig: GeoFigureSpec): number {
  const vs = fig.points.filter((p) => /^V\d+$/.test(p.id)).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))
  if (vs.length < 3) return vs.length
  let sign = 0
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i]!
    const b = vs[(i + 1) % vs.length]!
    const c = vs[(i + 2) % vs.length]!
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(cross) < 1e-4) throw new Error('flat polygon')
    const s = Math.sign(cross)
    if (sign === 0) sign = s
    else if (s !== sign) throw new Error('not convex')
  }
  return vs.length
}

describe('geometry unit 3 registration', () => {
  it('puts both modules after the Unit 2 modules', () => {
    const parallel = getModule('geoParallel')
    const polygons = getModule('geoPolygonAngles')
    expect(parallel.subject).toBe('Geometry')
    expect(polygons.subject).toBe('Geometry')
    expect(parallel.title).toBe('Parallel lines and transversals')
    expect(polygons.title).toBe('Angles of triangles and polygons')
    expect(parallel.order).toBe(13)
    expect(polygons.order).toBe(14)
    expect(parallel.order).toBeGreaterThan(getModule('geoProof').order)
    expect(parallel.templates.map((t) => t.id)).toEqual(['gl3.pairs', 'gl3.solve', 'gl3.converse', 'gl3.slopes'])
    expect(polygons.templates.map((t) => t.id)).toEqual(['gpa.triangle', 'gpa.polygon'])
    const sample = generateProblem('geoParallel', 'gl3.pairs', 1)
    expect(parallel.progress(sample, null, false)).toMatchObject({ stage: 0, total: 1 })
    expect(parallel.nextStep(sample, null, false)).toBeNull()
    expect(polygons.nextStep(sample, null, false)).toBeNull()
  })

  it('seed 1 of each template shows the trap named in the progress log', () => {
    const trap = (module: ModuleId, template: string) => answerOf(module, template, 1).trap
    expect(trap('geoParallel', 'gl3.pairs')).toBe('geo_alt_int_corr_swapped')
    expect(trap('geoParallel', 'gl3.solve')).toBe('geo_same_side_congruent')
    expect(trap('geoParallel', 'gl3.converse')).toBe('geo_alt_int_corr_swapped')
    expect(trap('geoParallel', 'gl3.slopes')).toBe('geo_perp_reciprocal_only')
    expect(trap('geoPolygonAngles', 'gpa.triangle')).toBe('geo_exterior_adjacent')
    expect(trap('geoPolygonAngles', 'gpa.polygon')).toBe('geo_interior_sum_n180')
  })
})

describe.each(TEMPLATES)('$module/$template over 300 seeds', ({ module, template, cards }) => {
  const cardIds = new Set(cards.map((c) => c.id))

  it('is deterministic, validates its answers, and keeps the trap as a real candidate', () => {
    for (const seed of SEEDS) {
      const p = generateProblem(module, template, seed)
      expect(generateProblem(module, template, seed)).toEqual(p)
      expect(() => JSON.stringify(p)).not.toThrow()
      expect(p.id).toBe(`${module}/${template}@1/${seed.toString(36)}`)
      expect(p.kind).toBe('geometry')
      expect(p.answer.type).toBe('geometry')
      if (p.answer.type !== 'geometry') throw new Error('not geometry')
      const a = p.answer
      expect(a.stages.length).toBeGreaterThan(0)
      for (const n of a.angles) expect(n > 0 && n < 180, `${p.id} angle ${n}`).toBe(true)
      for (const ang of a.figure.angles ?? []) {
        const got = wedge(point(a.figure, ang.vertex), point(a.figure, ang.from), point(a.figure, ang.to))
        expect(got > 0.5 && got < 179.5, `${p.id} drew ${got}`).toBe(true)
      }
      if (template === 'gpa.polygon') {
        const n = convexPolygon(a.figure)
        expect(n >= 3 && n <= 20, `${p.id} has ${n} sides`).toBe(true)
      }
      const before = [a.prompt, a.figure.ariaLabel]
      for (const stage of a.stages) before.push(stage.hint, stage.nudge, stage.note ?? '')
      for (const ang of a.figure.angles ?? []) if (ang.label) before.push(ang.label)
      const blob = before.join('\n')
      for (const stage of a.stages) {
        expect(cardIds.has(stage.ruleCard), stage.ruleCard).toBe(true)
        expect(gradeGeoStage(a, stage.id, stage.answerText).verdict, `${p.id} ${stage.id}`).toBe('correct')
        const display = stageDisplay(stage)
        expect(containsAnswer(blob, display), `${p.id} shows “${display}”`).toBe(false)
        expect(display).not.toBe('4')
        expect(display).not.toBe('-4')
        expect(display).not.toBe('x = 4')
        const garbage = stage.kind === 'choice' ? '' : stage.kind === 'line' ? 'banana' : '???'
        expect(gradeGeoStage(a, stage.id, garbage).verdict, `${p.id} garbage`).toBe('invalid')
      }
      const promised = a.stages.find((s) => s.id === a.trapStage)
      expect(promised?.traps.some((t) => t.id === a.trap && t.text === a.trapAnswer), `${p.id} ${a.trap}`).toBe(true)
      const trapGrade = gradeGeoStage(a, a.trapStage, a.trapAnswer)
      expect(trapGrade.verdict, `${p.id} ${a.trapAnswer}`).toBe('mistake')
      if (trapGrade.verdict === 'mistake') expect(trapGrade.mistake).toBe(a.trap)
    }
  }, HEAVY)
})

describe('geometry unit 3 trap coverage', () => {
  it('every new geo_ id is a real candidate on some seed, and vertical and horizontal lines appear', () => {
    const seen = new Set<string>()
    let vertical = 0
    let horizontal = 0
    for (const { module, template } of TEMPLATES) {
      for (const seed of SEEDS) {
        const a = answerOf(module, template, seed)
        for (const stage of a.stages) for (const trap of stage.traps) seen.add(trap.id)
        if (template === 'gl3.slopes') {
          if (/the line x = [−-]?\d+/.test(a.prompt)) vertical += 1
          if (/the line y = [−-]?\d+(?![\dx/])/.test(a.prompt)) horizontal += 1
        }
      }
    }
    for (const id of GEO_UNIT3_MISTAKE_IDS) expect(seen.has(id), id).toBe(true)
    for (const id of GEO_UNIT3_MISTAKE_IDS) {
      expect(ERROR_PATTERNS[id].lesson.length).toBeGreaterThan(0)
      expect(ERROR_PATTERNS[id].example).toContain('✗')
    }
    expect(vertical).toBeGreaterThan(0)
    expect(horizontal).toBeGreaterThan(0)
  }, HEAVY)

  it('rule cards and catalog examples use the reserved story, not a generated answer, over 2000 seeds', () => {
    const clashes: string[] = []
    for (const { module, template, cards } of TEMPLATES) {
      for (let seed = 1; seed <= 2000; seed++) {
        const a = answerOf(module, template, seed)
        for (const stage of a.stages) {
          const display = stageDisplay(stage)
          for (const trap of stage.traps) {
            const info = ERROR_PATTERNS[trap.id]
            const blob = `${info.title}\n${info.lesson}\n${info.example}`
            if (containsAnswer(blob, display) || exampleShowsAnswer(info.example, display)) {
              clashes.push(`${template}/${seed} ${display}: ${trap.id}`)
            }
          }
          for (const card of cards) {
            const blob = `${card.title}\n${card.body}\n${card.example ?? ''}`
            const result = (card.example ?? '').split(/=|→/).pop()?.trim() ?? ''
            if (containsAnswer(blob, display) || (result && exampleShowsAnswer(result, display))) {
              clashes.push(`${template}/${seed} ${display}: rule ${card.id}`)
            }
          }
        }
      }
    }
    expect(clashes.slice(0, 8)).toEqual([])
  }, HEAVY)
})

function text(a: GeometryAnswer, id: GeometryAnswer['stages'][number]['id']): string {
  const stage = a.stages.find((s) => s.id === id)
  if (!stage) throw new Error(`no ${id}`)
  return stage.answerText
}

function trapText(a: GeometryAnswer, id: string): string {
  for (const stage of a.stages) {
    const hit = stage.traps.find((t) => t.id === id)
    if (hit) return hit.text
  }
  throw new Error(`no trap ${id}`)
}

describe('hand-worked unit 3', () => {
  it('pairs: angles 4 and 6 are alternate interior, and corresponding is the trap', () => {
    const a = answerOf('geoParallel', 'gl3.pairs', 1)
    expect(a.prompt).toContain('∠4')
    expect(a.prompt).toContain('∠6')
    expect(text(a, 'a')).toBe('alt-int')
    expect(a.trap).toBe('geo_alt_int_corr_swapped')
    expect(a.trapAnswer).toBe('corr')
    expect(gradeGeoStage(a, 'a', 'corr')).toMatchObject({ verdict: 'mistake', mistake: 'geo_alt_int_corr_swapped' })
    expect(gradeGeoStage(a, 'a', 'alt-int').verdict).toBe('correct')
  })

  it('pairs: angles 1 and 7 are alternate exterior', () => {
    const a = answerOf('geoParallel', 'gl3.pairs', 2)
    expect(text(a, 'a')).toBe('alt-ext')
    expect(trapText(a, 'geo_alt_ext_corr_swapped')).toBe('corr')
    expect(gradeGeoStage(a, 'a', 'corr')).toMatchObject({ verdict: 'mistake', mistake: 'geo_alt_ext_corr_swapped' })
  })

  it('pairs: angles 2 and 6 are corresponding, and alternate interior is the trap', () => {
    const a = answerOf('geoParallel', 'gl3.pairs', 3)
    expect(text(a, 'a')).toBe('corr')
    expect(trapText(a, 'geo_alt_int_corr_swapped')).toBe('alt-int')
    expect(gradeGeoStage(a, 'a', 'alt-int')).toMatchObject({ verdict: 'mistake', mistake: 'geo_alt_int_corr_swapped' })
  })

  it('solve: same-side (2x + 10) and (3x + 20) give x = 30, not x = -10', () => {
    const a = answerOf('geoParallel', 'gl3.solve', 1)
    // (2x + 10) + (3x + 20) = 180 → 5x + 30 = 180 → x = 30. m∠3 = 70. Setting them equal gives x = -10.
    expect(a.prompt).toContain('∠3 = (2x + 10)°')
    expect(a.prompt).toContain('∠6 = (3x + 20)°')
    expect(text(a, 'x')).toBe('30')
    expect(text(a, 'result')).toBe('70')
    expect(a.angles).toEqual([70, 110])
    expect(trapText(a, 'geo_same_side_congruent')).toBe('-10')
    expect(gradeGeoStage(a, 'x', '-10')).toMatchObject({ verdict: 'mistake', mistake: 'geo_same_side_congruent' })
    expect(gradeGeoStage(a, 'x', '−10')).toMatchObject({ verdict: 'mistake', mistake: 'geo_same_side_congruent' })
    expect(gradeGeoStage(a, 'x', 'x = 30').verdict).toBe('correct')
    expect(gradeGeoStage(a, 'x', '30°').verdict).toBe('invalid')
    expect(gradeGeoStage(a, 'result', 'm∠3 = 70').verdict).toBe('correct')
    expect(gradeGeoStage(a, 'result', '70°').verdict).toBe('correct')
  })

  it('solve: alternate interior (4x + 6) and (6x − 14) give x = 10, not 94/5', () => {
    const a = answerOf('geoParallel', 'gl3.solve', 2)
    // 4x + 6 = 6x − 14 → x = 10. m∠4 = 46. Adding them to 180 gives 10x − 8 = 180 → x = 94/5.
    expect(a.prompt).toContain('∠4 = (4x + 6)°')
    expect(a.prompt).toContain('∠6 = (6x − 14)°')
    expect(text(a, 'x')).toBe('10')
    expect(text(a, 'result')).toBe('46')
    expect(trapText(a, 'geo_congruent_as_same_side')).toBe('94/5')
    expect(gradeGeoStage(a, 'x', '94/5')).toMatchObject({ verdict: 'mistake', mistake: 'geo_congruent_as_same_side' })
  })

  it('converse: angles 4 and 6 both 70, so the lines are parallel by alternate interior', () => {
    const a = answerOf('geoParallel', 'gl3.converse', 1)
    expect(a.prompt).toContain('∠4 = 70°')
    expect(a.prompt).toContain('∠6 = 70°')
    expect(text(a, 'a')).toBe('yes')
    expect(text(a, 'b')).toBe('alt-int')
    expect(a.trap).toBe('geo_alt_int_corr_swapped')
    expect(a.trapAnswer).toBe('corr')
    expect(a.stages[0]!.choices?.find((c) => c.id === 'no')?.trap).toBeUndefined()
    expect(gradeGeoStage(a, 'b', 'corr')).toMatchObject({ verdict: 'mistake', mistake: 'geo_alt_int_corr_swapped' })
    expect(gradeGeoStage(a, 'a', 'no').verdict).toBe('wrong')
  })

  it('converse: vertical angles 1 and 3 both 70 do not make the lines parallel', () => {
    const a = answerOf('geoParallel', 'gl3.converse', 2)
    expect(a.prompt).toContain('∠1 = 70°')
    expect(a.prompt).toContain('∠3 = 70°')
    expect(text(a, 'a')).toBe('no')
    expect(text(a, 'b')).toBe('none')
    expect(a.stages[0]!.choices?.find((c) => c.id === 'yes')?.trap).toBe('geo_parallel_only_when_not')
    expect(gradeGeoStage(a, 'a', 'yes')).toMatchObject({ verdict: 'mistake', mistake: 'geo_parallel_only_when_not' })
    expect(gradeGeoStage(a, 'b', 'corr')).toMatchObject({ verdict: 'mistake', mistake: 'geo_parallel_only_when_not' })
  })

  it('converse: find x so angles 3 and 6 are same-side interior', () => {
    const a = answerOf('geoParallel', 'gl3.converse', 3)
    // Same expressions as the solve: (2x + 10) + (3x + 20) = 180 → x = 30. Setting them equal gives x = -10.
    expect(a.prompt).toContain('Find x so that lines m and n are parallel')
    expect(text(a, 'x')).toBe('30')
    expect(text(a, 'result')).toBe('ssi')
    expect(trapText(a, 'geo_same_side_congruent')).toBe('-10')
    expect(a.stages[1]!.kind).toBe('choice')
    expect(gradeGeoStage(a, 'x', '-10')).toMatchObject({ verdict: 'mistake', mistake: 'geo_same_side_congruent' })
    expect(gradeGeoStage(a, 'result', 'corr')).toMatchObject({ verdict: 'mistake', mistake: 'geo_same_side_congruent' })
  })

  it('slopes: a line perpendicular to y = 2x + 3 has slope -1/2, not 1/2', () => {
    const a = answerOf('geoParallel', 'gl3.slopes', 1)
    expect(a.prompt).toContain('perpendicular')
    expect(a.prompt).toContain('y = 2x + 3')
    expect(text(a, 'result')).toBe('-1/2')
    expect(trapText(a, 'geo_perp_reciprocal_only')).toBe('1/2')
    expect(gradeGeoStage(a, 'result', '1/2')).toMatchObject({ verdict: 'mistake', mistake: 'geo_perp_reciprocal_only' })
    expect(gradeGeoStage(a, 'result', '−1/2').verdict).toBe('correct')
    expect(gradeGeoStage(a, 'result', 'undefined').verdict).toBe('invalid')
  })

  it('slopes: the parallel through (1, 4) is y = 2x + 2, not the original line', () => {
    const a = answerOf('geoParallel', 'gl3.slopes', 2)
    expect(a.prompt).toContain('through (1, 4)')
    expect(a.prompt).toContain('parallel')
    expect(text(a, 'result')).toBe('y = 2x + 2')
    const right = readLine(text(a, 'result'))
    const kept = readLine(trapText(a, 'geo_parallel_kept_intercept'))
    const equiv = readLine('y - 4 = 2(x - 1)')
    const original = readLine('y = 2x + 3')
    if (!right.ok || !kept.ok || !equiv.ok || !original.ok) throw new Error('line')
    expect(sameLine(right.line, equiv.line)).toBe(true)
    expect(sameLine(kept.line, original.line)).toBe(true)
    expect(gradeGeoStage(a, 'result', 'y - 4 = 2(x - 1)').verdict).toBe('correct')
    expect(gradeGeoStage(a, 'result', 'y − 4 = 2(x − 1)').verdict).toBe('correct')
    expect(gradeGeoStage(a, 'result', '2x - y = -2').verdict).toBe('correct')
    expect(gradeGeoStage(a, 'result', 'y = 2x + 3')).toMatchObject({ verdict: 'mistake', mistake: 'geo_parallel_kept_intercept' })
  })

  it('slopes: perpendicular to y = 3x − 1 is -1/3, not -3', () => {
    const a = answerOf('geoParallel', 'gl3.slopes', 3)
    expect(text(a, 'result')).toBe('-1/3')
    expect(trapText(a, 'geo_perp_sign_only')).toBe('-3')
    expect(gradeGeoStage(a, 'result', '-3')).toMatchObject({ verdict: 'mistake', mistake: 'geo_perp_sign_only' })
    expect(gradeGeoStage(a, 'result', '−3')).toMatchObject({ verdict: 'mistake', mistake: 'geo_perp_sign_only' })
  })

  it('slopes: y = 2x + 1 and y = 2x − 4 are parallel, not perpendicular', () => {
    const a = answerOf('geoParallel', 'gl3.slopes', 4)
    expect(text(a, 'a')).toBe('par')
    expect(a.trapAnswer).toBe('perp')
    expect(gradeGeoStage(a, 'a', 'perp')).toMatchObject({ verdict: 'mistake', mistake: 'geo_lines_relation_swapped' })
    expect(gradeGeoStage(a, 'a', 'neither').verdict).toBe('wrong')
  })

  it('slopes: a line parallel to x = 2 has undefined slope, not 0', () => {
    const a = answerOf('geoParallel', 'gl3.slopes', 5)
    expect(a.prompt).toContain('x = 2')
    expect(text(a, 'result')).toBe('undefined')
    expect(a.stages[0]!.allowUndefined).toBe(true)
    expect(trapText(a, 'geo_vertical_as_zero')).toBe('0')
    expect(gradeGeoStage(a, 'result', '0')).toMatchObject({ verdict: 'mistake', mistake: 'geo_vertical_as_zero' })
    expect(gradeGeoStage(a, 'result', 'Undefined').verdict).toBe('correct')
  })

  it('triangle: exterior (6x − 5) equals (3x + 2) + (2x + 1) only at x = 8, not 182/11', () => {
    const a = answerOf('geoPolygonAngles', 'gpa.triangle', 1)
    // 3x + 2 + 2x + 1 = 5x + 3. Set equal to 6x − 5 → x = 8. Exterior = 43.
    // The angle beside it: 6x − 5 = 180 − (5x + 3) → x = 182/11.
    expect(a.prompt).toContain('(3x + 2)°')
    expect(a.prompt).toContain('(2x + 1)°')
    expect(a.prompt).toContain('(6x − 5)°')
    expect(text(a, 'x')).toBe('8')
    expect(text(a, 'result')).toBe('43')
    expect(a.angles).toEqual([26, 17, 137, 43])
    expect(trapText(a, 'geo_exterior_adjacent')).toBe('182/11')
    expect(gradeGeoStage(a, 'x', '182/11')).toMatchObject({ verdict: 'mistake', mistake: 'geo_exterior_adjacent' })
    expect(gradeGeoStage(a, 'result', '43°').verdict).toBe('correct')
    expect(a.figure.points.some((p) => p.id === 'D')).toBe(true)
  })

  it('triangle: 2x, 3x, and 4x sum to 180, so x = 20 and m∠B = 60, not x = 60', () => {
    const a = answerOf('geoPolygonAngles', 'gpa.triangle', 2)
    // 9x = 180 → x = 20. m∠B = 60. Using three straight angles gives 9x = 540 → x = 60.
    expect(a.prompt).toContain('m∠A = (2x)°')
    expect(a.prompt).toContain('m∠B = (3x)°')
    expect(a.prompt).toContain('m∠C = (4x)°')
    expect(text(a, 'x')).toBe('20')
    expect(text(a, 'result')).toBe('60')
    expect(a.angles).toEqual([40, 60, 80])
    expect(trapText(a, 'geo_interior_sum_n180')).toBe('60')
    expect(gradeGeoStage(a, 'x', '60')).toMatchObject({ verdict: 'mistake', mistake: 'geo_interior_sum_n180' })
    expect(gradeGeoStage(a, 'result', 'm∠B = 60').verdict).toBe('correct')
    expect(a.figure.points.some((p) => p.id === 'D')).toBe(false)
  })

  it('polygon: a convex heptagon sums to 900, not 1260', () => {
    const a = answerOf('geoPolygonAngles', 'gpa.polygon', 1)
    expect(a.prompt).toContain('convex 7-gon')
    expect(text(a, 'result')).toBe('900')
    expect(trapText(a, 'geo_interior_sum_n180')).toBe('1260')
    expect(gradeGeoStage(a, 'result', '1260')).toMatchObject({ verdict: 'mistake', mistake: 'geo_interior_sum_n180' })
    expect(gradeGeoStage(a, 'result', '900°').verdict).toBe('correct')
  })

  it('polygon: each interior angle of a regular octagon is 135, not 1080', () => {
    const a = answerOf('geoPolygonAngles', 'gpa.polygon', 2)
    // (8 − 2) × 180 = 1080, and 1080 / 8 = 135.
    expect(a.prompt).toContain('regular 8-gon')
    expect(text(a, 'result')).toBe('135')
    expect(trapText(a, 'geo_interior_not_divided')).toBe('1080')
    expect(gradeGeoStage(a, 'result', '1080')).toMatchObject({ verdict: 'mistake', mistake: 'geo_interior_not_divided' })
  })

  it('polygon: each exterior angle of a regular hexagon is 60, not 30', () => {
    const a = answerOf('geoPolygonAngles', 'gpa.polygon', 3)
    // 360 / 6 = 60. A straight angle shared out is 180 / 6 = 30.
    expect(a.prompt).toContain('regular 6-gon')
    expect(text(a, 'result')).toBe('60')
    expect(trapText(a, 'geo_exterior_180_over_n')).toBe('30')
    expect(gradeGeoStage(a, 'result', '30')).toMatchObject({ verdict: 'mistake', mistake: 'geo_exterior_180_over_n' })
  })

  it('polygon: an interior angle of 120° means 6 sides, not 3', () => {
    const a = answerOf('geoPolygonAngles', 'gpa.polygon', 4)
    // Exterior angle 60°, and 360 / 60 = 6. 360 / 120 = 3.
    expect(a.prompt).toContain('120°')
    expect(text(a, 'result')).toBe('6')
    expect(a.stages[0]!.unit).toBeUndefined()
    expect(trapText(a, 'geo_sides_from_interior_360')).toBe('3')
    expect(gradeGeoStage(a, 'result', '3')).toMatchObject({ verdict: 'mistake', mistake: 'geo_sides_from_interior_360' })
    expect(gradeGeoStage(a, 'result', '6°').verdict).toBe('invalid')
    expect(convexPolygon(a.figure)).toBe(6)
  })

  it('polygon: the exterior angles of a convex decagon sum to 360, not 1440', () => {
    const a = answerOf('geoPolygonAngles', 'gpa.polygon', 5)
    // (10 − 2) × 180 = 1440 is the interior sum. The exterior sum is 360.
    expect(a.prompt).toContain('convex 10-gon')
    expect(text(a, 'result')).toBe('360')
    expect(trapText(a, 'geo_exterior_sum_as_interior')).toBe('1440')
    expect(gradeGeoStage(a, 'result', '1440')).toMatchObject({ verdict: 'mistake', mistake: 'geo_exterior_sum_as_interior' })
  })
})
