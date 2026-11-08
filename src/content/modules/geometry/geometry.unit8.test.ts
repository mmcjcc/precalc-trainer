/**
 * Honors geometry Unit 8 (circles). Every seed grades its own answers, keeps the promised trap as a real candidate,
 * leaves every answer out of everything she can read before she answers, never asks for a number the problem already
 * gives, and reads as English. Figures are checked with GeoFigure's own layout. Examples on the catalog entries, the
 * rule cards and the format hints never show an answer a template can generate (the 2000-seed sweep).
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { geoFigureLayout, type GeoLabelBox, type Stroke } from '@/components/GeoFigure'
import { ERROR_PATTERNS } from '@/engine'
import type { GeometryAnswer, RuleCard } from '@/content/types'
import type { GeoFigureSpec, ModuleId } from '@/shared/types'
import { readGeoAnswer, sameGeoValue } from './answer'
import { GEO_UNIT8_MISTAKE_IDS, exampleShowsAnswer, exposedExact, gradeGeoStage, stageDisplay } from './grade'
import { GEO_RULE_FOR } from './rules'
import { ANGLE_RULES_8, MEASURE_RULES, TANGENT_RULES } from './unit8Rules'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000
const SWEEP = 120_000
const RESERVED_TEXT = ['3√11', '(3√11)/2', '(8, 13)', '(8, −13)', '(8, -13)']
const METHOD = [/postulate/i, /congruent/i, /add to 90/i, /add to 180/i, /midpoint formula/i, /distance formula/i]

const TEMPLATES: { module: ModuleId; template: string; cards: RuleCard[] }[] = [
  { module: 'geoTangentChords', template: 'tc.tangent', cards: TANGENT_RULES },
  { module: 'geoTangentChords', template: 'tc.arcs', cards: TANGENT_RULES },
  { module: 'geoTangentChords', template: 'tc.chords', cards: TANGENT_RULES },
  { module: 'geoCircleAngles', template: 'ia.inscribed', cards: ANGLE_RULES_8 },
  { module: 'geoCircleAngles', template: 'ia.inside', cards: ANGLE_RULES_8 },
  { module: 'geoCircleAngles', template: 'ia.outside', cards: ANGLE_RULES_8 },
  { module: 'geoCircleMeasures', template: 'cm.lengths', cards: MEASURE_RULES },
  { module: 'geoCircleMeasures', template: 'cm.equation', cards: MEASURE_RULES },
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
    for (const m of t.matchAll(/(\d+(?:\.\d+)?)?√(\d+)|\d+(?:\.\d+)?/g)) {
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

function markerQuad(a: GeometryAnswer): number {
  const O = a.figure.points.find((p) => p.id === 'O')
  const mark = a.figure.points.find((p) => p.id === 'A') ?? a.figure.points.find((p) => p.id === 'T')
  if (!O || !mark) return 0
  const dx = mark.x - O.x
  const dy = mark.y - O.y
  if (dx > 0.05 && dy > 0.05) return 1
  if (dx < -0.05 && dy > 0.05) return 2
  if (dx < -0.05 && dy < -0.05) return 3
  if (dx > 0.05 && dy < -0.05) return 4
  return 0
}

describe('geometry unit 8 registration', () => {
  it('puts the three modules after elevation, with the unit title', () => {
    const tangents = getModule('geoTangentChords')
    const angles = getModule('geoCircleAngles')
    const measures = getModule('geoCircleMeasures')
    const elev = getModule('geoElevDepress')
    expect([tangents.title, angles.title, measures.title]).toEqual([
      'Tangents, arcs and chords',
      'Inscribed and other angles',
      'Segment lengths and circle equations',
    ])
    expect([tangents.order, angles.order, measures.order]).toEqual([29, 30, 31])
    expect(tangents.order).toBeGreaterThan(elev.order)
    expect(tangents.templates.map((t) => t.id)).toEqual(['tc.tangent', 'tc.arcs', 'tc.chords'])
    expect(angles.templates.map((t) => t.id)).toEqual(['ia.inscribed', 'ia.inside', 'ia.outside'])
    expect(measures.templates.map((t) => t.id)).toEqual(['cm.lengths', 'cm.equation'])
    const joined = [...TANGENT_RULES, ...ANGLE_RULES_8, ...MEASURE_RULES].map((c) => `${c.title} ${c.body} ${c.example}`).join('\n')
    for (const word of ['point of tangency', 'central angle', 'inscribed angle', 'intercepted arc', 'minor arc', 'major arc', 'chord', 'secant', 'standard form of the equation of a circle']) {
      expect(joined.toLowerCase(), word).toContain(word)
    }
    const places = ANGLE_RULES_8.find((c) => c.id === 'geo8-angle-places')!
    expect(places.body).toMatch(/at the center/)
    expect(places.body).toMatch(/on the circle/)
    expect(places.body).toMatch(/inside the circle/)
    expect(places.body).toMatch(/outside the circle/)
    expect(places.body.toLowerCase()).not.toContain('this problem')
  })
})

describe.each(TEMPLATES)('$module/$template over 300 seeds', ({ module, template, cards }) => {
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
        expect(a.figure.circles?.length, where).toBeGreaterThan(0)
        expect(a.figure.ariaLabel, where).not.toMatch(/\d/)
        expect(layoutProblems(a.figure), where).toEqual([])
        const blob = beforeBlob(a)
        const displays = a.stages.map((stage) => stageDisplay(stage))
        for (const display of displays) expect(shows(blob, display), `${where} shows “${display}”`).toBe(false)
        for (const stage of a.stages) {
          expect(cardIds.has(stage.ruleCard), `${where} ${stage.ruleCard}`).toBe(true)
          expect(gradeGeoStage(a, stage.id, stage.answerText).verdict, where).toBe('correct')
          expect(RESERVED_TEXT.includes(stage.answerText), where).toBe(false)
          for (const line of stage.reveal) expect(blob.includes(line), `${where} reveal on screen`).toBe(false)
          const garbage = stage.kind === 'choice' ? '' : '???'
          expect(gradeGeoStage(a, stage.id, garbage).verdict, where).toBe('invalid')
          const retryText = stage.kind === 'choice' ? '' : '999999'
          const retry = gradeGeoStage(a, stage.id, retryText)
          if (retry.verdict !== 'correct') {
            const said = retry.verdict === 'mistake' ? retry.witness : retry.message
            for (const display of displays.slice(a.stages.indexOf(stage))) expect(shows(said, display), `${where} retry shows “${display}”`).toBe(false)
          }
          for (const trap of stage.traps) {
            const g = gradeGeoStage(a, stage.id, trap.text)
            expect(g.verdict === 'mistake' && g.mistake === trap.id, `${where} ${trap.id} “${trap.text}”`).toBe(true)
            for (const display of displays) expect(shows(trap.witness, display), `${where} witness`).toBe(false)
            expect(englishProblems(trap.witness), where).toEqual([])
          }
          const texts = new Set<string>()
          for (const choice of stage.choices ?? []) {
            expect(texts.has(choice.text), `${where} duplicate choice`).toBe(false)
            texts.add(choice.text)
            expect(a.prompt.toLowerCase().includes(choice.text.toLowerCase()), `${where} prompt prints a choice`).toBe(false)
            expect((stage.nudge + stage.hint).toLowerCase().includes(choice.text.toLowerCase()), where).toBe(false)
          }
          for (const line of [stage.hint, stage.nudge, ...stage.reveal]) expect(englishProblems(line), `${where}: ${line}`).toEqual([])
          for (const label of a.figure.points) expect(label.label ?? '', where).not.toMatch(/\d/)
          for (const seg of a.figure.segments ?? []) expect(seg.label ?? '', where).toBe('')
          for (const ang of a.figure.angles ?? []) expect(ang.label ?? '', where).toBe('')
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
        if (a.stages.some((stage) => stage.kind !== 'choice')) {
          for (const phrase of METHOD) expect(a.prompt, where).not.toMatch(phrase)
        }
        expect(a.prompt, where).not.toMatch(/add to 180/)
        if (/Decide whether/.test(a.prompt)) expect(a.figure.angles ?? [], where).toEqual([])
        if (/inscribed in a semicircle/.test(a.prompt)) expect((a.figure.angles ?? []).some((ang) => ang.right), where).toBe(false)
        if (template === 'cm.equation') expect(a.figure.circles![0]!.r, where).toBeLessThanOrEqual(8)
      }
    },
    HEAVY,
  )

  it(
    'no numeric answer is 0, 1, 47, or a number the problem gives',
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
          if (v!.q.rad === 1 && v!.q.d === 1) expect([0, 1, 47].includes(v!.q.n), `${template}/${seed}`).toBe(false)
          expect(given.some((g) => sameGeoValue(g, v!)), `${template}/${seed} ${stage.answerText} is given`).toBe(false)
        }
      }
    },
    HEAVY,
  )
})

describe('geometry unit 8 trap coverage', () => {
  it(
    'every new circle mistake, and the borrowed slips these problems use, is a real candidate somewhere',
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
      for (const id of GEO_UNIT8_MISTAKE_IDS) {
        expect(seen.has(id), id).toBe(true)
        expect(promised.has(id), `${id} promised`).toBe(true)
        const info = ERROR_PATTERNS[id]
        expect(info.lesson.length, id).toBeGreaterThan(40)
        expect(info.example, id).toContain('✗')
        expect(info.example, id).toContain('→')
        expect(`${info.title} ${info.lesson} ${info.example}`, id).not.toMatch(/\d/)
        expect(GEO_RULE_FOR[id], id).toMatch(/^geo8-/)
      }
      for (const id of ['trig_pythag_added', 'trig_pythag_subtracted', 'trig_side_not_rooted', 'geo_half_not_taken', 'geo_answered_x']) {
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

describe('unit 8 variety and mix', () => {
  it(
    'each template shows at least 25 distinct problems, no answer is more than a tenth, and the marker visits every quadrant',
    () => {
      for (const { module, template } of TEMPLATES) {
        const prompts = new Set<string>()
        const whole = new Map<string, number>()
        const quads = new Map<number, number>()
        for (const seed of SEEDS) {
          const a = answerOf(module, template, seed)
          prompts.add(a.prompt)
          whole.set(a.expectedDisplay, (whole.get(a.expectedDisplay) ?? 0) + 1)
          const q = markerQuad(a)
          quads.set(q, (quads.get(q) ?? 0) + 1)
        }
        expect(prompts.size, template).toBeGreaterThanOrEqual(25)
        const top = [...whole.entries()].sort((p, q) => q[1] - p[1])[0]!
        expect(top[1] / SEEDS.length, `${template} “${top[0]}”`).toBeLessThanOrEqual(0.1)
        for (const q of [1, 2, 3, 4]) expect(quads.get(q) ?? 0, `${template} quadrant ${q}`).toBeGreaterThanOrEqual(20)
        expect(quads.get(0) ?? 0, `${template} on an axis`).toBe(0)
      }
    },
    HEAVY,
  )

  it(
    'the four equation asks each appear 15 to 35 percent of the time, and the three outside cases each 20 to 50 percent',
    () => {
      const modes = new Map<string, number>()
      const cases = new Map<string, number>()
      for (const seed of SEEDS) {
        const eq = generateProblem('geoCircleMeasures', 'cm.equation', seed)
        const mode = String(eq.params.mode)
        modes.set(mode, (modes.get(mode) ?? 0) + 1)
        const outside = generateProblem('geoCircleAngles', 'ia.outside', seed)
        const which = String(outside.params.case)
        cases.set(which, (cases.get(which) ?? 0) + 1)
      }
      for (const id of ['read', 'write', 'region', 'complete']) {
        const share = (modes.get(id) ?? 0) / SEEDS.length
        expect(share, id).toBeGreaterThanOrEqual(0.15)
        expect(share, id).toBeLessThanOrEqual(0.35)
      }
      for (const id of ['secants', 'secantTangent', 'tangents']) {
        const share = (cases.get(id) ?? 0) / SEEDS.length
        expect(share, id).toBeGreaterThanOrEqual(0.2)
        expect(share, id).toBeLessThanOrEqual(0.5)
      }
    },
    HEAVY,
  )
})
