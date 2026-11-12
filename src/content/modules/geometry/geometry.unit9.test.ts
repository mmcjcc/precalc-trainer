/**
 * Honors geometry Unit 9 (areas of polygons). Every seed grades its own answers, keeps the promised trap as a
 * real candidate, leaves every answer out of everything she can read before she answers, never asks for a number
 * the problem already gives, and reads as English. Figures are checked with GeoFigure's own layout. Examples on
 * the catalog entries, the rule cards and the format hints never show an answer a template can generate.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { geoFigureLayout, type GeoLabelBox, type Stroke } from '@/components/GeoFigure'
import { ERROR_PATTERNS } from '@/engine'
import type { GeometryAnswer, RuleCard } from '@/content/types'
import type { GeoFigureSpec, ModuleId } from '@/shared/types'
import { readGeoAnswer, sameGeoValue } from './answer'
import { GEO_UNIT9_MISTAKE_IDS, exampleShowsAnswer, exposedExact, gradeGeoStage, stageDisplay } from './grade'
import { GEO_RULE_FOR } from './rules'
import { AREA_RULES } from './unit9Rules'
import { CIRCLE_MISTAKE_IDS } from './unit9CircleRules'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000
const SWEEP = 120_000
const RESERVED_TEXT = ['3√11', '(3√11)/2']
const METHOD = [/postulate/i, /congruent/i, /add to 90/i, /add to 180/i, /midpoint formula/i, /distance formula/i]
const SHAPES = ['rectangle', 'parallelogram', 'triangle', 'trapezoid', 'rhombus'] as const

const TEMPLATES: { module: ModuleId; template: string; cards: RuleCard[] }[] = [
  { module: 'geoPolygonArea', template: 'ar.basic', cards: AREA_RULES },
  { module: 'geoPolygonArea', template: 'ar.special', cards: AREA_RULES },
  { module: 'geoPolygonArea', template: 'ar.regular', cards: AREA_RULES },
]

function answerOf(module: ModuleId, template: string, seed: number): GeometryAnswer {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${template}/${seed} is ${p.answer.type}`)
  return p.answer
}

function spellings(display: string): string[] {
  const out = [display, display.replace(/-/g, '−')]
  const frac = /^\((\d*√\d+)\)\/(\d+)$/.exec(display)
  if (frac) out.push(`${frac[1]}/${frac[2]}`)
  return out
}

function shows(blob: string, display: string): boolean {
  if (/[A-Za-z]{4}/.test(display)) return blob.toLowerCase().includes(display.toLowerCase())
  return spellings(display).some((d) => exposedExact(blob, d))
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function englishProblems(text: string): string[] {
  const out: string[] = []
  if (/\b[Aa]n? \d/.test(text)) out.push(`article before a number: ${text}`)
  if (/\b1 degrees\b/.test(text)) out.push(`1 degrees: ${text}`)
  if (/(?<![\d.])(?:[02-9]|\d{2,}) degree\b/.test(text)) out.push(`degree after a plural: ${text}`)
  if (/\[object|undefined/.test(text)) out.push(`broken text: ${text}`)
  for (const s of sentences(text)) if (!/^[A-Z]/.test(s)) out.push(`sentence starts with “${s.slice(0, 40)}”`)
  return out
}

function beforeBlob(a: GeometryAnswer): string {
  const before = [a.prompt, a.figure.ariaLabel]
  for (const stage of a.stages) before.push(stage.hint, stage.nudge, stage.note ?? '')
  for (const pt of a.figure.points) before.push(pt.label ?? '')
  for (const s of a.figure.segments ?? []) before.push(s.label ?? '')
  for (const g of a.figure.angles ?? []) before.push(g.label ?? '')
  return before.join('\n')
}

function valueOf(text: string) {
  const r = readGeoAnswer(text)
  return r.ok && r.value.kind === 'qty' ? r.value : null
}

function givenValues(a: GeometryAnswer) {
  const texts = [a.prompt, ...(a.figure.segments ?? []).map((s) => s.label ?? ''), ...(a.figure.angles ?? []).map((g) => g.label ?? ''), ...a.figure.points.map((p) => p.label ?? '')]
  const out: NonNullable<ReturnType<typeof valueOf>>[] = []
  for (const t of texts) {
    for (const m of t.matchAll(/\(\d*√\d+\)\/\d+|\d*√\d+\/\d+|\d+(?:\.\d+)?√\d+|√\d+|\d+\/\d+|\d+(?:\.\d+)?/g)) {
      const v = valueOf(m[0])
      if (v) out.push(v)
    }
  }
  return out
}

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

const apart = (p: GeoLabelBox, q: GeoLabelBox) => p.r <= q.l || q.r <= p.l || p.b <= q.t || q.b <= p.t

/** Labels inside the 360-wide figure (the 375 px screen), clear of strokes (the rim included) and of each other. */
function layoutProblems(spec: GeoFigureSpec): string[] {
  const { width, height, strokes, dots, labels, leaders } = geoFigureLayout(spec)
  const out: string[] = []
  for (const leader of leaders) {
    for (const label of labels) {
      if (label.text !== leader.text && crosses(leader.stroke, label, 0)) out.push(`the leader to ${leader.text} crosses ${label.kind} ${label.text}`)
    }
  }
  for (const label of labels) {
    if (label.l < 0 || label.t < 0 || label.r > width || label.b > height) out.push(`${label.kind} ${label.text} leaves the figure`)
    if (strokes.some((s) => crosses(s, label, 1))) out.push(`${label.kind} ${label.text} sits on a line`)
    if (label.kind !== 'point' && dots.some((d) => !apart(label, { ...d, kind: 'point', text: '•' }))) out.push(`${label.kind} ${label.text} covers a dot`)
  }
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      if (!apart(labels[i]!, labels[j]!)) out.push(`${labels[i]!.kind} ${labels[i]!.text} covers ${labels[j]!.kind} ${labels[j]!.text}`)
    }
  }
  return out
}

function quadrantOf(a: GeometryAnswer): number {
  const pts = a.figure.points.filter((p) => /^[A-D]$/.test(p.id) || /^P\d+$/.test(p.id))
  const c = {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  }
  const mark = pts[0]
  if (!mark) return 0
  const dx = mark.x - c.x
  const dy = mark.y - c.y
  if (Math.abs(dx) < 0.05 || Math.abs(dy) < 0.05) return 0
  if (dx > 0 && dy > 0) return 1
  if (dx < 0 && dy > 0) return 2
  if (dx < 0 && dy < 0) return 3
  return 4
}

describe('geometry unit 9 registration', () => {
  it('puts the area module after the circle modules', () => {
    const areas = getModule('geoPolygonArea')
    const measures = getModule('geoCircleMeasures')
    expect(areas.title).toBe('Areas of polygons')
    expect(areas.order).toBe(32)
    expect(areas.order).toBeGreaterThan(measures.order)
    expect(areas.templates.map((t) => t.id)).toEqual(['ar.basic', 'ar.special', 'ar.regular'])
    const joined = AREA_RULES.map((c) => `${c.title} ${c.body} ${c.example}`).join('\n')
    for (const word of ['base', 'height', 'apothem', 'perimeter', 'circumference']) {
      if (word === 'circumference') {
        expect(joined.toLowerCase()).not.toContain(word)
        continue
      }
      expect(joined.toLowerCase(), word).toContain(word)
    }
    expect(joined.toLowerCase()).not.toContain('altitude')
    const all = AREA_RULES.find((c) => c.id === 'geo9-all')!
    expect(all.body).toMatch(/rectangle/)
    expect(all.body).toMatch(/triangle/)
    expect(all.body).toMatch(/trapezoid/)
    expect(all.body).toMatch(/rhombus/)
    expect(all.body).toMatch(/regular polygon/)
    expect(all.body.toLowerCase()).not.toContain('this problem')
    expect(joined).not.toMatch(/\d/)
    expect(joined).not.toMatch(/√/)
  })
})

describe.each(TEMPLATES)('$template over 300 seeds', ({ module, template, cards }) => {
  const cardIds = new Set(cards.map((card) => card.id))

  it(
    'is deterministic, validates its answers, keeps the trap, and never shows an answer early',
    () => {
      for (const seed of SEEDS) {
        const p = generateProblem(module, template, seed)
        expect(generateProblem(module, template, seed)).toEqual(p)
        expect(p.kind).toBe('geometry')
        if (p.answer.type !== 'geometry') throw new Error('not geometry')
        const a = p.answer
        const where = `${template}/${seed}`
        expect(a.stages.length, where).toBeGreaterThan(0)
        expect(a.figure.circles?.length ?? 0, where).toBe(0)
        expect(a.figure.ariaLabel, where).not.toMatch(/\d/)
        expect(layoutProblems(a.figure), where).toEqual([])
        const blob = beforeBlob(a)
        expect(blob, where).not.toMatch(/\[object|undefined/)
        const displays = a.stages.map((stage) => stageDisplay(stage))
        for (const display of displays) expect(shows(blob, display), `${where} shows “${display}”`).toBe(false)
        const trapTexts = new Set<string>()
        for (const stage of a.stages) {
          expect(cardIds.has(stage.ruleCard), `${where} ${stage.ruleCard}`).toBe(true)
          expect(stage.ruleCard, where).not.toBe('geo9-all')
          expect(gradeGeoStage(a, stage.id, stage.answerText).verdict, where).toBe('correct')
          expect(RESERVED_TEXT.includes(stage.answerText), where).toBe(false)
          for (const line of stage.reveal) expect(blob.includes(line), `${where} reveal on screen`).toBe(false)
          expect(gradeGeoStage(a, stage.id, '???').verdict, where).toBe('invalid')
          const retry = gradeGeoStage(a, stage.id, '999999')
          if (retry.verdict !== 'correct') {
            const said = retry.verdict === 'mistake' ? retry.witness : retry.message
            for (const display of displays.slice(a.stages.indexOf(stage))) expect(shows(said, display), `${where} retry shows “${display}”`).toBe(false)
          }
          for (const trap of stage.traps) {
            const g = gradeGeoStage(a, stage.id, trap.text)
            expect(g.verdict === 'mistake' && g.mistake === trap.id, `${where} ${trap.id} “${trap.text}” graded ${g.verdict}`).toBe(true)
            expect(trapTexts.has(trap.text), `${where} duplicate trap ${trap.text}`).toBe(false)
            trapTexts.add(trap.text)
            for (const display of displays) {
              expect(trap.text === display, `${where} trap equals ${display}`).toBe(false)
              expect(shows(trap.witness, display), `${where} witness`).toBe(false)
            }
            expect(englishProblems(trap.witness), where).toEqual([])
          }
          for (const line of [stage.hint, stage.nudge, ...stage.reveal]) expect(englishProblems(line), `${where}: ${line}`).toEqual([])
          for (const label of a.figure.points) expect(label.label ?? '', where).not.toMatch(/\d/)
          const asked = stage.label === 'Area' || stage.label === 'Perimeter' ? null : stage.answerText
          if (asked) {
            for (const seg of a.figure.segments ?? []) expect(seg.label ?? '', `${where} labels ${asked}`).not.toBe(asked)
          }
        }
        for (let i = 0; i < a.stages.length; i++) {
          for (let j = i + 1; j < a.stages.length; j++) {
            for (const line of a.stages[i]!.reveal) expect(shows(line, displays[j]!), `${where} earlier reveal shows later answer`).toBe(false)
          }
        }
        const promised = a.stages.find((stage) => stage.id === a.trapStage)
        expect(promised?.traps.some((trap) => trap.id === a.trap && trap.text === a.trapAnswer), `${where} ${a.trap}`).toBe(true)
        const g = gradeGeoStage(a, a.trapStage, a.trapAnswer)
        expect(g.verdict === 'mistake' && g.mistake === a.trap, `${where} promised ${a.trap}`).toBe(true)
        expect(englishProblems(a.prompt), where).toEqual([])
        expect(englishProblems(a.figure.ariaLabel), where).toEqual([])
        for (const phrase of METHOD) expect(a.prompt, where).not.toMatch(phrase)
        expect(a.prompt, where).not.toMatch(/\baltitude\b/i)
      }
    },
    HEAVY,
  )

  it(
    'no numeric answer is reserved or a number the problem gives',
    () => {
      for (const seed of SEEDS) {
        const a = answerOf(module, template, seed)
        const given = givenValues(a)
        for (const stage of a.stages) {
          if (stage.kind !== 'number') continue
          const v = valueOf(stage.answerText)
          expect(v, `${template}/${seed} ${stage.answerText}`).not.toBeNull()
          const n = (v!.q.n / v!.q.d) * Math.sqrt(v!.q.rad)
          expect(n, `${template}/${seed}`).toBeGreaterThan(0)
          if (v!.q.rad === 1 && v!.q.d === 1) expect([0, 1, 43, 90, 180].includes(v!.q.n), `${template}/${seed}`).toBe(false)
          expect(given.some((g) => sameGeoValue(g, v!)), `${template}/${seed} ${stage.answerText} is given`).toBe(false)
        }
      }
    },
    HEAVY,
  )
})

describe('geometry unit 9 trap coverage', () => {
  it(
    'every new area mistake, and the borrowed slips these problems use, is a real candidate somewhere',
    () => {
      const seen = new Set<string>()
      const promised = new Set<string>()
      for (const { module, template } of TEMPLATES) {
        for (const seed of SEEDS) {
          const p = generateProblem(module, template, seed)
          promised.add(String(p.params.trap))
          if (p.answer.type !== 'geometry') continue
          for (const stage of p.answer.stages) for (const trap of stage.traps) seen.add(trap.id)
        }
      }
      // The circle half's ids are covered by geometry.unit9c.test.ts.
      for (const id of GEO_UNIT9_MISTAKE_IDS.filter((x) => !(CIRCLE_MISTAKE_IDS as readonly string[]).includes(x))) {
        expect(seen.has(id), id).toBe(true)
        expect(promised.has(id), `${id} promised`).toBe(true)
        const info = ERROR_PATTERNS[id]
        expect(info.lesson.length, id).toBeGreaterThan(40)
        expect(info.example, id).toContain('✗')
        expect(info.example, id).toContain('→')
        expect(`${info.title} ${info.lesson} ${info.example}`, id).not.toMatch(/\d/)
        expect(GEO_RULE_FOR[id], id).toMatch(/^geo9-/)
      }
      for (const id of [
        'trig_pythag_added',
        'trig_pythag_subtracted',
        'trig_side_not_rooted',
        'trig_special_root3_two_swapped',
        'trig_special_45_two',
        'trig_special_wrong_way',
        'trig_special_legs_swapped',
        'geo_half_not_taken',
        'geo_diagonal_half_as_whole',
      ]) {
        expect(seen.has(id), id).toBe(true)
        expect(promised.has(id), `${id} promised`).toBe(true)
      }
    },
    HEAVY,
  )

  it(
    'examples, witnesses, hints, nudges, and rule cards never show a generated answer, over 2000 seeds',
    () => {
      const clashes: string[] = []
      for (const { module, template, cards } of TEMPLATES) {
        const results = cards.map((card) => ({ id: card.id, example: card.example ?? '', body: card.body, result: (card.example ?? '').split(/=|→/).pop()!.trim() }))
        for (let seed = 1; seed <= 2000; seed++) {
          const a = answerOf(module, template, seed)
          for (const stage of a.stages) {
            const display = stageDisplay(stage)
            if (shows([stage.hint, stage.nudge, stage.note ?? ''].join('\n'), display)) clashes.push(`${template}/${seed} ${display}: hint`)
            for (const trap of stage.traps) {
              const info = ERROR_PATTERNS[trap.id]
              if (shows(`${info.title}\n${info.lesson}\n${info.example}`, display) || exampleShowsAnswer(info.example, display)) clashes.push(`${template}/${seed} ${display}: ${trap.id}`)
              if (shows(trap.witness, display)) clashes.push(`${template}/${seed} ${display}: witness`)
            }
            for (const card of results) {
              if (shows(card.example, display) || exampleShowsAnswer(card.example, display) || (card.result && exampleShowsAnswer(card.result, display))) {
                clashes.push(`${template}/${seed} ${display}: rule ${card.id}`)
              }
              if (!/[A-Za-z]{4}/.test(display) && shows(card.body, display)) clashes.push(`${template}/${seed} ${display}: rule body ${card.id}`)
            }
          }
        }
      }
      expect(clashes.slice(0, 8)).toEqual([])
    },
    SWEEP,
  )
})

describe('unit 9 variety and mix', () => {
  it(
    'each template shows at least 25 distinct problems, no answer is more than a tenth, and the figure is not always the same way up',
    () => {
      for (const { module, template } of TEMPLATES) {
        const prompts = new Set<string>()
        const whole = new Map<string, number>()
        const quads = new Map<number, number>()
        for (const seed of SEEDS) {
          const a = answerOf(module, template, seed)
          prompts.add(a.prompt)
          whole.set(a.expectedDisplay, (whole.get(a.expectedDisplay) ?? 0) + 1)
          const q = quadrantOf(a)
          quads.set(q, (quads.get(q) ?? 0) + 1)
        }
        expect(prompts.size, template).toBeGreaterThanOrEqual(25)
        const top = [...whole.entries()].sort((p, q) => q[1] - p[1])[0]!
        expect(top[1] / SEEDS.length, `${template} “${top[0]}”`).toBeLessThanOrEqual(0.1)
        for (const q of [1, 2, 3, 4]) expect(quads.get(q) ?? 0, `${template} quadrant ${q}`).toBeGreaterThanOrEqual(10)
      }
    },
    HEAVY,
  )

  it(
    'in ar.basic each of the five shapes appears 12 to 30 percent of the time',
    () => {
      const counts = new Map<string, number>()
      for (const seed of SEEDS) {
        const p = generateProblem('geoPolygonArea', 'ar.basic', seed)
        const shape = String(p.params.shape)
        counts.set(shape, (counts.get(shape) ?? 0) + 1)
      }
      for (const shape of SHAPES) {
        const share = (counts.get(shape) ?? 0) / SEEDS.length
        expect(share, `${shape} ${counts.get(shape)}`).toBeGreaterThanOrEqual(0.12)
        expect(share, `${shape} ${counts.get(shape)}`).toBeLessThanOrEqual(0.3)
      }
    },
    HEAVY,
  )
})
