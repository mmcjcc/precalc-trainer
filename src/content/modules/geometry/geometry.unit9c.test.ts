/**
 * Honors geometry Unit 9, the circle half (circumference, area, arcs, sectors, segments). Every seed grades its own
 * answers, keeps the promised trap as a real candidate, leaves every answer out of everything she can read before she
 * answers, never asks for a number the problem already gives, and reads as English. Figures are checked with
 * GeoFigure's own layout at 375 px. Examples on the catalog entries, the rule cards and the format hints never show
 * an answer a template can generate, and the numbers they use (43 and its two-term examples) are never an answer.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { geoFigureLayout, type GeoLabelBox, type Stroke } from '@/components/GeoFigure'
import { SPECIES } from '@/components/monsters/species'
import { ERROR_PATTERNS } from '@/engine'
import type { GeometryAnswer } from '@/content/types'
import type { GeoFigureSpec } from '@/shared/types'
import { readGeoAnswer, sameGeoValue, type GeoValue } from './answer'
import { GEO_UNIT9_MISTAKE_IDS, exampleShowsAnswer, exposedExact, gradeGeoStage, stageDisplay } from './grade'
import { GEO_RULE_FOR } from './rules'
import { CIRCLE_MISTAKE_IDS, CIRCLE_RULES } from './unit9CircleRules'
import { DEG_HINT9, PI_HINT9, SUM_HINT9 } from './unit9Circles'
import { EXACT_HINT9 } from './unit9Polygons'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000
const SWEEP = 120_000
const TEMPLATES = ['ca.circle', 'ca.sector', 'ca.segment'] as const
type Template = (typeof TEMPLATES)[number]
/** Numbers the format hints and cards use as examples: no answer may be one of them. */
const RESERVED = ['43', '43π', '(43π)/2', '43/2', '3√11', '43π - 7', '43π - 7√11']
const METHOD = [/postulate/i, /congruent/i, /add to 90/i, /add to 180/i, /midpoint formula/i, /distance formula/i]

function answerOf(template: Template, seed: number): GeometryAnswer {
  const p = generateProblem('geoCircleArea', template, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${template}/${seed} is ${p.answer.type}`)
  return p.answer
}

function spellings(display: string): string[] {
  const out = [display, display.replace(/-/g, '−')]
  const frac = /^\((\d*π?(?:√\d+)?)\)\/(\d+)$/.exec(display)
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
  if (/\[object|undefined|NaN/.test(text)) out.push(`broken text: ${text}`)
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

function valueOf(text: string): GeoValue | null {
  const r = readGeoAnswer(text, { sum: true })
  return r.ok ? r.value : null
}

const sameText = (a: string, b: string) => {
  const va = valueOf(a)
  const vb = valueOf(b)
  return !!va && !!vb && sameGeoValue(va, vb)
}

/** Every number, radical and multiple of π in the prompt and on the figure. */
function givenValues(a: GeometryAnswer): GeoValue[] {
  const texts = [a.prompt, ...(a.figure.segments ?? []).map((s) => s.label ?? ''), ...(a.figure.angles ?? []).map((g) => g.label ?? '')]
  const out: GeoValue[] = []
  for (const t of texts) {
    // "in terms of π" names π, it does not give it as a number: a bare π counts only before √ or /.
    for (const m of t.matchAll(/\(\d*π?(?:√\d+)?\)\/\d+|(?:\d+π|π(?=[√/]))(?:√\d+)?(?:\/\d+)?|\d+(?:\.\d+)?√\d+|√\d+|\d+\/\d+|\d+(?:\.\d+)?/g)) {
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

/** The quadrant radius OA points into, as the figure is drawn. */
function quadrantOf(a: GeometryAnswer): number {
  const o = a.figure.points.find((p) => p.id === 'O')!
  const A = a.figure.points.find((p) => p.id === 'A')!
  const dx = A.x - o.x
  const dy = A.y - o.y
  if (Math.abs(dx) < 1e-6 || Math.abs(dy) < 1e-6) return 0
  if (dx > 0 && dy > 0) return 1
  if (dx < 0 && dy > 0) return 2
  if (dx < 0 && dy < 0) return 3
  return 4
}

const hasPi = (text: string) => text.includes('π')

describe('geometry unit 9 circles: registration', () => {
  it('puts the circle module after the polygon module, with its own rule cards', () => {
    const circles = getModule('geoCircleArea')
    const polygons = getModule('geoPolygonArea')
    expect(circles.title).toBe('Circles: circumference, area, arcs and sectors')
    expect(circles.order).toBe(33)
    expect(circles.order).toBeGreaterThan(polygons.order)
    expect(circles.templates.map((t) => t.id)).toEqual(['ca.circle', 'ca.sector', 'ca.segment'])
    expect(circles.ruleCards).toBe(CIRCLE_RULES)
    const joined = CIRCLE_RULES.map((c) => `${c.title} ${c.body} ${c.example}`).join('\n')
    expect(joined).not.toMatch(/\d/)
    expect(joined).not.toMatch(/√/)
    for (const word of ['circumference', 'area', 'radius', 'diameter', 'arc length', 'sector', 'degrees', 'segment', 'chord', 'in terms of π']) {
      expect(joined.toLowerCase(), word).toContain(word)
    }
    for (const card of CIRCLE_RULES) expect(card.body.toLowerCase()).not.toContain('this problem')
  })

  it('appends the eleven circle mistakes at the end of the unit 9 list, each with a card and a monster', () => {
    expect(GEO_UNIT9_MISTAKE_IDS.slice(-11)).toEqual([...CIRCLE_MISTAKE_IDS])
    const cardIds = new Set(CIRCLE_RULES.map((c) => c.id))
    const mismeasure = SPECIES.find((s) => s.id === 'mismeasure')!
    expect(mismeasure.variants.slice(-11)).toEqual([...CIRCLE_MISTAKE_IDS])
    for (const id of CIRCLE_MISTAKE_IDS) {
      expect(cardIds.has(GEO_RULE_FOR[id]!), id).toBe(true)
      const info = ERROR_PATTERNS[id]
      expect(info.id).toBe(id)
      expect(info.lesson.length, id).toBeGreaterThan(40)
      expect(info.example, id).toContain('✗')
      expect(info.example, id).toContain('→')
      expect(`${info.title} ${info.lesson} ${info.example}`, id).not.toMatch(/\d/)
      for (const s of SPECIES) if (s.id !== 'mismeasure') expect(s.variants.includes(id), `${id} in ${s.id}`).toBe(false)
    }
  })
})

describe.each(TEMPLATES)('%s over 300 seeds', (template) => {
  const cardIds = new Set(CIRCLE_RULES.map((card) => card.id))

  it(
    'is deterministic, validates its answers, keeps the trap, and never shows an answer early',
    () => {
      for (const seed of SEEDS) {
        const p = generateProblem('geoCircleArea', template, seed)
        expect(generateProblem('geoCircleArea', template, seed)).toEqual(p)
        expect(p.kind).toBe('geometry')
        if (p.answer.type !== 'geometry') throw new Error('not geometry')
        const a = p.answer
        const where = `${template}/${seed}`
        expect(a.question, where).toBe(template === 'ca.circle' ? 'circleArea' : template === 'ca.sector' ? 'arcSector' : 'circleSegment')
        expect(a.figure.circles?.length, where).toBe(1)
        expect(a.figure.ariaLabel, where).not.toMatch(/\d/)
        expect(layoutProblems(a.figure), where).toEqual([])
        const blob = beforeBlob(a)
        expect(blob, where).not.toMatch(/\[object|undefined|NaN/)
        for (const line of a.reveal) expect(line, where).not.toMatch(/\[object|undefined|NaN/)
        const displays = a.stages.map((stage) => stageDisplay(stage))
        for (const display of displays) expect(shows(blob, display), `${where} shows “${display}”`).toBe(false)
        if (displays.some(hasPi)) expect(a.prompt, where).toContain('in terms of π')
        const givens = givenValues(a)
        for (const [index, stage] of a.stages.entries()) {
          expect(cardIds.has(stage.ruleCard), `${where} ${stage.ruleCard}`).toBe(true)
          expect(gradeGeoStage(a, stage.id, stage.answerText).verdict, where).toBe('correct')
          expect(stage.traps.length, `${where} ${stage.id} has no slip`).toBeGreaterThan(0)
          // The line under the box is the same for every part of its kind.
          const kind = stage.unit === 'deg' ? DEG_HINT9 : stage.sum ? SUM_HINT9 : hasPi(stage.answerText) ? PI_HINT9 : EXACT_HINT9
          expect(stage.hint, where).toBe(kind)
          for (const line of stage.reveal) expect(blob.includes(line), `${where} reveal on screen`).toBe(false)
          expect(gradeGeoStage(a, stage.id, '???').verdict, where).toBe('invalid')
          const retry = gradeGeoStage(a, stage.id, '999999')
          if (retry.verdict !== 'correct') {
            const said = retry.verdict === 'mistake' ? retry.witness : retry.message
            for (const display of displays.slice(index)) expect(shows(said, display), `${where} retry shows “${display}”`).toBe(false)
          }
          const seen: string[] = []
          for (const trap of stage.traps) {
            const g = gradeGeoStage(a, stage.id, trap.text)
            expect(g.verdict === 'mistake' && g.mistake === trap.id, `${where} ${trap.id} “${trap.text}” graded ${g.verdict}`).toBe(true)
            expect(seen.some((t) => sameText(t, trap.text)), `${where} duplicate trap ${trap.text}`).toBe(false)
            seen.push(trap.text)
            expect(sameText(trap.text, stage.answerText), `${where} trap equals the answer`).toBe(false)
            for (const display of displays) expect(shows(trap.witness, display), `${where} witness shows ${display}`).toBe(false)
            expect(englishProblems(trap.witness), where).toEqual([])
            // A slip that copies a given is kept only for the arc's degrees given as its length.
            const v = valueOf(trap.text)!
            if (trap.id !== 'geo_arc_measure_for_length') expect(givens.some((g) => sameGeoValue(g, v)), `${where} ${trap.id} copies a given`).toBe(false)
          }
          for (const line of [stage.hint, stage.nudge, ...stage.reveal]) expect(englishProblems(line), `${where}: ${line}`).toEqual([])
          // The figure never labels a length she is asked for.
          if (stage.label === 'Radius') for (const seg of a.figure.segments ?? []) expect(seg.label?.trim() ?? '', where).not.toBe(stage.answerText)
          if (stage.unit === 'deg') for (const ang of a.figure.angles ?? []) expect(ang.label ?? '', where).not.toMatch(/\d/)
        }
        for (const label of a.figure.points) expect(label.label ?? '', where).not.toMatch(/\d/)
        for (let i = 0; i < a.stages.length; i++) {
          for (let j = i + 1; j < a.stages.length; j++) {
            for (const line of a.stages[i]!.reveal) expect(shows(line, displays[j]!), `${where} earlier reveal shows later answer`).toBe(false)
          }
        }
        const promisedAt = a.stages.findIndex((stage) => stage.id === a.trapStage)
        const promised = a.stages[promisedAt]!
        expect(promised.traps.some((trap) => trap.id === a.trap && trap.text === a.trapAnswer), `${where} ${a.trap}`).toBe(true)
        const g = gradeGeoStage(a, a.trapStage, a.trapAnswer)
        expect(g.verdict === 'mistake' && g.mistake === a.trap, `${where} promised ${a.trap}`).toBe(true)
        // The promised slip is never a given, never the answer, never a later part's answer.
        const pv = valueOf(a.trapAnswer)!
        expect(givens.some((gv) => sameGeoValue(gv, pv)), `${where} promised slip is a given`).toBe(false)
        for (const later of a.stages.slice(promisedAt)) expect(sameText(later.answerText, a.trapAnswer), `${where} promised slip is an answer`).toBe(false)
        expect(englishProblems(a.prompt), where).toEqual([])
        expect(englishProblems(a.figure.ariaLabel), where).toEqual([])
        for (const phrase of METHOD) expect(a.prompt, where).not.toMatch(phrase)
        // "arc length", never "arc" alone for a length.
        expect(a.prompt, where).not.toMatch(/(?<!arc )length of (?:minor |major )?arc|Find (?:the )?(?:minor |major )?arc(?! length)\b/)
      }
    },
    HEAVY,
  )

  it(
    'no answer is reserved, and no answer is a number the problem gives',
    () => {
      for (const seed of SEEDS) {
        const a = answerOf(template, seed)
        const given = givenValues(a)
        for (const stage of a.stages) {
          const v = valueOf(stage.answerText)
          expect(v, `${template}/${seed} ${stage.answerText}`).not.toBeNull()
          for (const r of RESERVED) expect(sameText(r, stage.answerText), `${template}/${seed} ${stage.answerText} is reserved`).toBe(false)
          expect(['0', '1', '90', '180', 'π'].includes(stage.answerText), `${template}/${seed}`).toBe(false)
          expect(given.some((g) => sameGeoValue(g, v!)), `${template}/${seed} ${stage.answerText} is given`).toBe(false)
        }
      }
    },
    HEAVY,
  )
})

describe('geometry unit 9 circles: trap coverage', () => {
  it(
    'every circle mistake and every reused slip is a real candidate, and all but one are promised somewhere',
    () => {
      const seen = new Set<string>()
      const promised = new Set<string>()
      for (const template of TEMPLATES) {
        for (const seed of SEEDS) {
          const a = answerOf(template, seed)
          promised.add(a.trap)
          for (const stage of a.stages) for (const trap of stage.traps) seen.add(trap.id)
        }
      }
      for (const id of [...CIRCLE_MISTAKE_IDS, 'geo_major_minor_swapped', 'geo_area_not_halved', 'trig_side_not_rooted', 'trig_special_legs_swapped', 'trig_special_root3_two_swapped', 'trig_special_wrong_way']) {
        expect(seen.has(id), id).toBe(true)
        // πr² for a circumference always equals the later area part or the given area, so it is named but never promised.
        if (id === 'geo_area_for_circumference') continue
        expect(promised.has(id), `${id} promised`).toBe(true)
      }
      expect(promised.has('geo_area_for_circumference')).toBe(false)
    },
    HEAVY,
  )

  it(
    'examples, witnesses, hints, nudges, rule cards and reserved numbers never show a generated answer, over 2000 seeds',
    () => {
      const clashes: string[] = []
      const failures: string[] = []
      const results = CIRCLE_RULES.map((card) => ({ id: card.id, example: card.example ?? '', body: card.body, result: (card.example ?? '').split(/=|→/).pop()!.trim() }))
      const hints = [PI_HINT9, DEG_HINT9, SUM_HINT9, EXACT_HINT9].join('\n')
      for (const template of TEMPLATES) {
        for (let seed = 1; seed <= 2000; seed++) {
          let a: GeometryAnswer
          try {
            a = answerOf(template, seed)
          } catch (e) {
            failures.push(`${template}/${seed}: ${e instanceof Error ? e.message : String(e)}`)
            continue
          }
          for (const stage of a.stages) {
            const display = stageDisplay(stage)
            // Each hint example as a whole (43, 43π, (43π)/2, 43π - 7, ...) is never an answer.
            for (const example of hints.match(/\(43π\)\/2|43π - 7√11|43π - 7|43π|43\/2|3√11|43/g) ?? []) if (sameText(example, display)) clashes.push(`${template}/${seed} ${display}: a format hint`)
            for (const r of RESERVED) if (sameText(r, display)) clashes.push(`${template}/${seed} ${display}: reserved`)
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
      // Every seed produces a problem.
      expect(failures.slice(0, 5)).toEqual([])
      expect(clashes.slice(0, 8)).toEqual([])
    },
    SWEEP,
  )
})

describe('geometry unit 9 circles: variety and mix', () => {
  it(
    'each template shows at least 25 distinct problems, no typed answer is more than a tenth, and the figure turns',
    () => {
      for (const template of TEMPLATES) {
        const prompts = new Set<string>()
        const perPart = new Map<string, Map<string, number>>()
        const quads = new Map<number, number>()
        const reflected = new Set<boolean>()
        for (const seed of SEEDS) {
          const p = generateProblem('geoCircleArea', template, seed)
          if (p.answer.type !== 'geometry') throw new Error('not geometry')
          const a = p.answer
          prompts.add(a.prompt)
          for (const stage of a.stages) {
            const key = `${stage.id}:${stage.label}`
            const m = perPart.get(key) ?? new Map<string, number>()
            m.set(stage.answerText, (m.get(stage.answerText) ?? 0) + 1)
            perPart.set(key, m)
          }
          const q = quadrantOf(a)
          quads.set(q, (quads.get(q) ?? 0) + 1)
          const o = a.figure.points.find((pt) => pt.id === 'O')!
          const A = a.figure.points.find((pt) => pt.id === 'A')!
          const B = a.figure.points.find((pt) => pt.id === 'B')
          if (B && template !== 'ca.circle') reflected.add((A.x - o.x) * (B.y - o.y) - (A.y - o.y) * (B.x - o.x) > 0)
        }
        expect(prompts.size, template).toBeGreaterThanOrEqual(25)
        // No answer of a typed part is more than a tenth of the template's 300 problems.
        for (const [key, m] of perPart) {
          const top = [...m.entries()].sort((p, q) => q[1] - p[1])[0]!
          expect(top[1] / SEEDS.length, `${template} ${key} “${top[0]}” ${top[1]}/${SEEDS.length}`).toBeLessThanOrEqual(0.1)
        }
        for (const q of [1, 2, 3, 4]) expect(quads.get(q) ?? 0, `${template} quadrant ${q}`).toBeGreaterThanOrEqual(10)
        if (template !== 'ca.circle') expect(reflected.size, `${template} both ways round`).toBe(2)
      }
    },
    HEAVY,
  )

  it(
    'the variants and asks hold their shares',
    () => {
      const share = (template: Template, key: (p: Record<string, string | number | boolean>) => string) => {
        const counts = new Map<string, number>()
        for (const seed of SEEDS) {
          const k = key(generateProblem('geoCircleArea', template, seed).params)
          counts.set(k, (counts.get(k) ?? 0) + 1)
        }
        return counts
      }
      const variants = share('ca.circle', (p) => String(p.variant))
      for (const v of ['radius', 'diameter', 'circumference', 'area']) {
        const n = variants.get(v) ?? 0
        expect(n / 300, `${v} ${n}`).toBeGreaterThanOrEqual(0.15)
        expect(n / 300, `${v} ${n}`).toBeLessThanOrEqual(0.35)
      }
      const odd = share('ca.circle', (p) => (p.variant === 'diameter' ? `d:${p.odd}` : p.variant === 'radius' ? `r:${p.radical}` : 'other'))
      const oddShare = (odd.get('d:true') ?? 0) / ((odd.get('d:true') ?? 0) + (odd.get('d:false') ?? 0))
      expect(oddShare, 'odd diameters').toBeGreaterThanOrEqual(0.1)
      expect(oddShare, 'odd diameters').toBeLessThanOrEqual(0.4)
      const radShare = (odd.get('r:true') ?? 0) / ((odd.get('r:true') ?? 0) + (odd.get('r:false') ?? 0))
      expect(radShare, 'radical radii').toBeGreaterThanOrEqual(0.05)
      expect(radShare, 'radical radii').toBeLessThanOrEqual(0.3)
      const asks = share('ca.sector', (p) => String(p.ask))
      for (const v of ['arc', 'sector', 'both', 'angle', 'radius']) {
        const n = asks.get(v) ?? 0
        expect(n / 300, `${v} ${n}`).toBeGreaterThanOrEqual(0.12)
        expect(n / 300, `${v} ${n}`).toBeLessThanOrEqual(0.3)
      }
      const major = share('ca.sector', (p) => (p.ask === 'arc' || p.ask === 'sector' ? String(p.major) : 'other'))
      const majorShare = (major.get('true') ?? 0) / ((major.get('true') ?? 0) + (major.get('false') ?? 0))
      expect(majorShare, 'major').toBeGreaterThanOrEqual(0.1)
      expect(majorShare, 'major').toBeLessThanOrEqual(0.33)
      const angles = share('ca.segment', (p) => String(p.theta))
      for (const v of ['60', '90', '120']) {
        const n = angles.get(v) ?? 0
        expect(n / 300, `${v} ${n}`).toBeGreaterThanOrEqual(0.25)
        expect(n / 300, `${v} ${n}`).toBeLessThanOrEqual(0.45)
      }
    },
    HEAVY,
  )
})
