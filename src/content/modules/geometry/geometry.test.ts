import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import type { ModuleId } from '@/shared/types'
import { GEO_MISTAKE_IDS, GEO_RULE_FOR, gradeGeoStage, type GeoMistakeId } from '.'
import { exposed } from './grade'
import type { GeometryAnswer } from './build'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000

const TEMPLATES: { module: ModuleId; template: string }[] = [
  { module: 'geoSegments', template: 'gs.addition' },
  { module: 'geoSegments', template: 'gs.midpoint' },
  { module: 'geoSegments', template: 'gs.coord' },
  { module: 'geoAngles', template: 'ga.addition' },
  { module: 'geoAngles', template: 'ga.bisector' },
  { module: 'geoAngles', template: 'ga.pairs' },
  { module: 'geoAngles', template: 'ga.words' },
]

const METHOD = [/postulate/i, /congruent/i, /add to 90/i, /add to 180/i, /midpoint formula/i, /distance formula/i]

function answerOf(module: ModuleId, template: string, seed: number): GeometryAnswer {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${template}/${seed} is ${p.answer.type}`)
  return p.answer
}

describe('geometry module registration', () => {
  it('puts both modules after electrons, under Geometry', () => {
    const segments = getModule('geoSegments')
    const angles = getModule('geoAngles')
    expect(segments.subject).toBe('Geometry')
    expect(angles.subject).toBe('Geometry')
    expect(segments.title).toBe('Segments, midpoints and distance')
    expect(angles.title).toBe('Angles and angle pairs')
    expect(segments.order).toBeLessThan(angles.order)
    expect(segments.templates.map((t) => t.id)).toEqual(['gs.addition', 'gs.midpoint', 'gs.coord'])
    expect(angles.templates.map((t) => t.id)).toEqual(['ga.addition', 'ga.bisector', 'ga.pairs', 'ga.words'])
    const sample = generateProblem('geoSegments', 'gs.addition', 1)
    expect(segments.progress(sample, null, false)).toMatchObject({ stage: 0, total: 1 })
    expect(segments.nextStep(sample, null, false)).toBeNull()
    expect(angles.nextStep(sample, null, false)).toBeNull()
  })

  it('has a catalog entry for every geo_ id', () => {
    for (const id of GEO_MISTAKE_IDS) {
      const info = ERROR_PATTERNS[id]
      expect(info.id).toBe(id)
      expect(info.title.length).toBeGreaterThan(0)
      expect(info.lesson.length).toBeGreaterThan(0)
      expect(info.example).toContain('✗')
      expect(info.example).toContain('→')
    }
  })
})

describe.each(TEMPLATES)('$module/$template over 300 seeds', ({ module, template }) => {
  const cards = new Set(getModule(module).ruleCards.map((c) => c.id))

  it('is deterministic, keeps sensible measures, and grades its own answers and traps', () => {
    for (const seed of SEEDS) {
      const p = generateProblem(module, template, seed)
      expect(generateProblem(module, template, seed)).toEqual(p)
      expect(() => JSON.stringify(p)).not.toThrow()
      expect(p.id).toBe(`${module}/${template}@1/${seed.toString(36)}`)
      expect(p.kind).toBe('geometry')
      expect(p.moduleId).toBe(module)
      expect(p.graph).toEqual({ kind: 'none' })
      expect(p.calc).toEqual({ ti84: [], nspire: [] })
      expect(p.statementText).toBe(p.answer.type === 'geometry' ? p.answer.prompt : '')
      if (p.answer.type !== 'geometry') throw new Error('not geometry')
      const a = p.answer
      expect(a.figure.ariaLabel.trim().length).toBeGreaterThan(0)
      expect(a.stages.length).toBeGreaterThan(0)
      expect(a.stages.length).toBeLessThanOrEqual(2)
      for (const phrase of METHOD) expect(a.prompt).not.toMatch(phrase)
      for (const n of a.lengths) expect(Number.isInteger(n) && n > 0, `${p.id} length ${n}`).toBe(true)
      for (const n of a.angles) expect(Number.isInteger(n) && n > 0 && n < 180, `${p.id} angle ${n}`).toBe(true)
      for (const id of a.ruleCards) expect(cards.has(id), id).toBe(true)
      const visible = [a.prompt, a.figure.ariaLabel]
      for (const point of a.figure.points) visible.push(point.label ?? '')
      for (const seg of a.figure.segments ?? []) if (seg.label) visible.push(seg.label)
      for (const ang of a.figure.angles ?? []) if (ang.label) visible.push(ang.label)
      const blob = visible.join('\n')
      for (const stage of a.stages) {
        expect(cards.has(stage.ruleCard), stage.ruleCard).toBe(true)
        expect(gradeGeoStage(a, stage.id, stage.answerText).verdict, `${p.id} ${stage.id}`).toBe('correct')
        expect(exposed(blob, stage.answerText), `${p.id} shows ${stage.answerText}`).toBe(false)
        for (const line of stage.reveal) expect(a.prompt.includes(line), line).toBe(false)
        for (const trap of stage.traps) {
          const mapped = GEO_RULE_FOR[trap.id as GeoMistakeId]
          if (mapped) expect(cards.has(mapped), mapped).toBe(true)
          const g = gradeGeoStage(a, stage.id, trap.text)
          expect(g.verdict, `${p.id} ${trap.id} ${trap.text}`).toBe('mistake')
          if (g.verdict === 'mistake') expect(g.mistake).toBe(trap.id)
        }
      }
      const promised = a.stages.find((s) => s.id === a.trapStage)
      expect(promised?.traps.some((t) => t.id === a.trap && t.text === a.trapAnswer)).toBe(true)
      const trapGrade = gradeGeoStage(a, a.trapStage, a.trapAnswer)
      expect(trapGrade.verdict).toBe('mistake')
      if (trapGrade.verdict === 'mistake') expect(trapGrade.mistake).toBe(a.trap)
      for (const line of a.reveal) expect(a.prompt.includes(line)).toBe(false)
    }
  }, HEAVY)
})

describe('geometry trap coverage', () => {
  it('every geo_ id is a real candidate on some seed', () => {
    const seen = new Set<string>()
    for (const { module, template } of TEMPLATES) {
      for (const seed of SEEDS) {
        const a = answerOf(module, template, seed)
        for (const stage of a.stages) for (const trap of stage.traps) seen.add(trap.id)
      }
    }
    expect([...seen].sort()).toEqual([...GEO_MISTAKE_IDS].sort())
  }, HEAVY)
})
