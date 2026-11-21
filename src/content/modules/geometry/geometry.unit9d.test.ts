/**
 * Honors geometry Unit 9, the last module (area ratios, shaded regions, geometric probability). Every seed grades its
 * own answers, keeps the promised trap as a real candidate, leaves every answer out of everything she can read before
 * she answers, never asks for a number the problem already gives, and reads as English. Figures are checked with
 * GeoFigure's own layout at 375 px. Examples on the catalog entries, the rule cards and the format hints never show
 * an answer a template can generate, and the hints' own example values are never an answer.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { geoFigureLayout, type GeoLabelBox, type Stroke } from '@/components/GeoFigure'
import { SPECIES } from '@/components/monsters/species'
import { ERROR_PATTERNS } from '@/engine'
import type { GeometryAnswer } from '@/content/types'
import type { GeoFigureSpec } from '@/shared/types'
import { readGeoAnswer, sameGeoValue, type GeoValue } from './answer'
import { GEO_UNIT9B_MISTAKE_IDS, GEO_UNIT9_MISTAKE_IDS, exampleShowsAnswer, exposedExact, gradeGeoStage, stageDisplay } from './grade'
import { GEO_RULE_FOR } from './rules'
import { RATIO_HINT6 } from './unit6Build'
import { PI_HINT9, SUM_HINT9 } from './unit9Circles'
import { EXACT_HINT9 } from './unit9Polygons'
import { RATIO_MISTAKE_IDS, RATIO_RULES } from './unit9RatioRules'
import { PROB_HINT9 } from './unit9Ratios'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000
const SWEEP = 240_000
const TEMPLATES = ['ra.shared', 'ra.similar', 'ra.shaded', 'ra.chance'] as const
type Template = (typeof TEMPLATES)[number]
const QUESTION: Record<string, string> = { 'ra.shared': 'areaRatio', 'ra.similar': 'areaRatio', 'ra.shaded': 'shadedRegion', 'ra.chance': 'geoProbability' }
/** Every example value of the format hints: no answer may be one of them. */
const RESERVED = ['9/7', '43', '43/2', '3√11', '43π', '(43π)/2', '43π - 7', '43π - 7√11', '43/97', '(43π)/97']
const METHOD = [/postulate/i, /congruent/i, /add to 90/i, /add to 180/i, /midpoint formula/i, /distance formula/i]

function answerOf(template: string, seed: number): GeometryAnswer {
  const p = generateProblem('geoAreaRatios', template, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${template}/${seed} is ${p.answer.type}`)
  return p.answer
}

function spellings(display: string): string[] {
  const out = [display, display.replace(/-/g, '−')]
  const frac = /^\((\d*π?(?:√\d+)?)\)\/(\d+)$/.exec(display)
  if (frac) out.push(`${frac[1]}/${frac[2]}`)
  // A ratio shows as well with a colon or "to".
  const ratio = /^(\d+)\/(\d+)$/.exec(display)
  if (ratio) out.push(`${ratio[1]}:${ratio[2]}`, `${ratio[1]} to ${ratio[2]}`)
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

function valueOf(text: string, ratio = false): GeoValue | null {
  const r = readGeoAnswer(text, { sum: true, ...(ratio ? { ratio: true } : {}) })
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

/** Labels inside the 360-wide figure (the 375 px screen), clear of strokes (circles included) and of each other. */
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

const hasPi = (text: string) => text.includes('π')

/** The format hint every part of this kind shows. */
function hintFor(template: string, stage: GeometryAnswer['stages'][number]): string {
  if (stage.ratio) return RATIO_HINT6
  if (template === 'ra.chance') return PROB_HINT9
  if (stage.sum) return SUM_HINT9
  if (hasPi(stage.answerText)) return PI_HINT9
  return EXACT_HINT9
}

describe('geometry unit 9 area ratios: registration', () => {
  it('puts the module after the circle module, with its own rule cards', () => {
    const ratios = getModule('geoAreaRatios')
    const circles = getModule('geoCircleArea')
    expect(ratios.title).toBe('Area ratios, shaded regions and probability')
    expect(ratios.order).toBe(34)
    expect(ratios.order).toBeGreaterThan(circles.order)
    expect(ratios.templates.map((t) => t.id)).toEqual([...TEMPLATES])
    expect(ratios.ruleCards).toBe(RATIO_RULES)
    for (const card of RATIO_RULES) expect(card.id).toMatch(/^geo9-/)
    const joined = RATIO_RULES.map((c) => `${c.title} ${c.body} ${c.example}`).join('\n')
    expect(joined).not.toMatch(/\d/)
    expect(joined).not.toMatch(/√/)
    for (const word of ['same height', 'same base', 'similar', 'squares', 'perimeters', 'the whole', 'shaded', 'minus', 'inscribed', 'probability', 'length', 'area', 'one minus']) {
      expect(joined.toLowerCase(), word).toContain(word)
    }
    for (const card of RATIO_RULES) expect(card.body.toLowerCase()).not.toContain('this problem')
  })

  it('lists the nine new mistakes after the unit 9 list, each with a card, a catalog entry and a monster', () => {
    expect([...GEO_UNIT9B_MISTAKE_IDS]).toEqual([...RATIO_MISTAKE_IDS])
    for (const id of RATIO_MISTAKE_IDS) expect((GEO_UNIT9_MISTAKE_IDS as readonly string[]).includes(id), id).toBe(false)
    const cardIds = new Set(RATIO_RULES.map((c) => c.id))
    const mismeasure = SPECIES.find((s) => s.id === 'mismeasure')!
    expect(mismeasure.variants.slice(-9)).toEqual([...RATIO_MISTAKE_IDS])
    for (const id of RATIO_MISTAKE_IDS) {
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
  const cardIds = new Set(RATIO_RULES.map((card) => card.id))

  it(
    'is deterministic, validates its answers, keeps the trap, and never shows an answer early',
    () => {
      for (const seed of SEEDS) {
        const p = generateProblem('geoAreaRatios', template, seed)
        expect(generateProblem('geoAreaRatios', template, seed)).toEqual(p)
        expect(p.kind).toBe('geometry')
        if (p.answer.type !== 'geometry') throw new Error('not geometry')
        const a = p.answer
        const where = `${template}/${seed}`
        expect(a.question, where).toBe(QUESTION[template])
        expect(a.figure.ariaLabel, where).not.toMatch(/\d/)
        expect(layoutProblems(a.figure), where).toEqual([])
        const blob = beforeBlob(a)
        expect(blob, where).not.toMatch(/\[object|undefined|NaN/)
        for (const line of a.reveal) expect(line, where).not.toMatch(/\[object|undefined|NaN/)
        const displays = a.stages.map((stage) => stageDisplay(stage))
        for (const display of displays) expect(shows(blob, display), `${where} shows “${display}”`).toBe(false)
        if (displays.some(hasPi)) expect(a.prompt, where).toContain('in terms of π')
        if (template === 'ra.chance') expect(a.prompt, where).toContain('Give the probability as a fraction')
        const givens = givenValues(a)
        for (const [index, stage] of a.stages.entries()) {
          expect(cardIds.has(stage.ruleCard), `${where} ${stage.ruleCard}`).toBe(true)
          expect(gradeGeoStage(a, stage.id, stage.answerText).verdict, where).toBe('correct')
          expect(stage.traps.length, `${where} ${stage.id} has no slip`).toBeGreaterThan(0)
          expect(stage.hint, where).toBe(hintFor(template, stage))
          // A probability is a plain number: no ratio reading and no lowest-terms rule.
          if (template === 'ra.chance') {
            expect(stage.ratio, where).toBeUndefined()
            expect(stage.lowest, where).toBeUndefined()
          }
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
            const v = valueOf(trap.text)!
            expect(givens.some((g) => sameGeoValue(g, v)), `${where} ${trap.id} copies a given`).toBe(false)
            // A probability slip is more than zero.
            if (template === 'ra.chance') expect(v.kind === 'qty' ? v.q.n > 0 : true, where).toBe(true)
          }
          for (const line of [stage.hint, stage.nudge, ...stage.reveal]) expect(englishProblems(line), `${where}: ${line}`).toEqual([])
          // The figure never labels a length she is asked for.
          for (const seg of a.figure.segments ?? []) expect(seg.label?.trim() ?? '', where).not.toBe(stage.answerText)
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
        // The promised slip is never a given, never the answer, never a later part's answer, never another trap's value.
        const pv = valueOf(a.trapAnswer)!
        expect(givens.some((gv) => sameGeoValue(gv, pv)), `${where} promised slip is a given`).toBe(false)
        for (const later of a.stages.slice(promisedAt)) expect(sameText(later.answerText, a.trapAnswer), `${where} promised slip is an answer`).toBe(false)
        expect(englishProblems(a.prompt), where).toEqual([])
        expect(a.prompt, where).not.toMatch(/\b[Aa]n? \d/)
        expect(englishProblems(a.figure.ariaLabel), where).toEqual([])
        for (const phrase of METHOD) expect(a.prompt, where).not.toMatch(phrase)
        // A ratio question names which area comes first.
        for (const stage of a.stages) if (stage.ratio) expect(a.prompt, where).toMatch(/(?:ratio of the (?:area|perimeter) of \w+ \w+ to the (?:area|perimeter) of|scale factor of \w+ \w+ to )/)
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

const SHADED_IDS = [
  'geo_region_not_subtracted',
  'geo_region_added',
  'geo_inscribed_side_from_radius',
  'geo_circle_diameter_as_radius',
  'geo_circumference_for_area',
  'geo_circle_radius_not_squared',
  'geo_pi_left_off',
  'geo_area_not_halved',
  'geo_half_applied',
  'geo_perimeter_for_area',
  'geo_apothem_for_radius',
  'trig_special_legs_swapped',
  'trig_special_root3_two_swapped',
  'trig_special_wrong_way',
]

const CHANCE_IDS = [
  'geo_part_to_part_for_whole',
  'geo_probability_complement',
  'geo_area_ratio_reversed',
  'geo_area_ratio_not_squared',
  'geo_circle_diameter_as_radius',
  'geo_circle_radius_not_squared',
  'geo_pi_left_off',
  'geo_half_applied',
  'geo_area_not_halved',
]

/** The ids each template can name, and the ids it is expected to promise somewhere in 300 seeds. */
const EXPECTED: Record<Template, { named: string[]; promised: string[] }> = {
  'ra.shared': {
    named: ['geo_area_ratio_squared', 'geo_area_ratio_reversed', 'geo_part_to_part_for_whole'],
    promised: ['geo_area_ratio_squared', 'geo_area_ratio_reversed', 'geo_part_to_part_for_whole'],
  },
  // The squared scale factor typed for the perimeters is always the areas' answer, asked next: named, never promised.
  'ra.similar': {
    named: ['geo_perimeter_ratio_squared', 'geo_area_ratio_reversed', 'geo_area_ratio_not_squared', 'geo_scale_from_areas_not_rooted', 'geo_scale_factor_inverted', 'geo_part_over_whole', 'geo_part_to_part_for_whole'],
    promised: ['geo_area_ratio_reversed', 'geo_area_ratio_not_squared', 'geo_scale_from_areas_not_rooted', 'geo_scale_factor_inverted', 'geo_part_over_whole', 'geo_part_to_part_for_whole'],
  },
  'ra.shaded': {
    named: SHADED_IDS,
    promised: SHADED_IDS,
  },
  'ra.chance': {
    named: CHANCE_IDS,
    promised: CHANCE_IDS,
  },
}

/** Named on some seed but never the promised slip (it always equals a later part's answer). */
const NEVER_PROMISED = ['geo_perimeter_ratio_squared']

describe('geometry unit 9 area ratios: trap coverage', () => {
  it(
    'every expected slip is a real candidate and is promised somewhere',
    () => {
      const seen = new Set<string>()
      const promised = new Set<string>()
      for (const template of TEMPLATES) {
        const ownSeen = new Set<string>()
        const ownPromised = new Set<string>()
        for (const seed of SEEDS) {
          const a = answerOf(template, seed)
          ownPromised.add(a.trap)
          for (const stage of a.stages) for (const trap of stage.traps) ownSeen.add(trap.id)
        }
        for (const id of EXPECTED[template].named) expect(ownSeen.has(id), `${template} names ${id}`).toBe(true)
        for (const id of EXPECTED[template].promised) expect(ownPromised.has(id), `${template} promises ${id}`).toBe(true)
        for (const id of ownSeen) seen.add(id)
        for (const id of ownPromised) promised.add(id)
      }
      // Once all four templates are in, every one of the nine new ids is promised by some seed.
      if (TEMPLATES.length === 4) for (const id of RATIO_MISTAKE_IDS) expect(promised.has(id), `${id} promised`).toBe(true)
      for (const id of NEVER_PROMISED) {
        expect(seen.has(id), id).toBe(true)
        expect(promised.has(id), `${id} is promised`).toBe(false)
      }
    },
    HEAVY,
  )

  it(
    'examples, witnesses, hints, nudges, rule cards and reserved numbers never show a generated answer, and every seed draws, over 2000 seeds',
    () => {
      const clashes: string[] = []
      const failures: string[] = []
      const results = RATIO_RULES.map((card) => ({ id: card.id, example: card.example ?? '', body: card.body, result: (card.example ?? '').split(/=|→/).pop()!.trim() }))
      const hints = [RATIO_HINT6, PI_HINT9, SUM_HINT9, EXACT_HINT9, PROB_HINT9].join('\n')
      const examples = hints.match(/\(43π\)\/97|\(43π\)\/2|43π - 7√11|43π - 7|43π|43\/97|43\/2|3√11|9\/7|9:7|43/g) ?? []
      expect(examples.length).toBeGreaterThanOrEqual(10)
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
            for (const example of examples) {
              const ev = valueOf(example, true)
              const dv = valueOf(display)
              if (ev && dv && sameGeoValue(ev, dv)) clashes.push(`${template}/${seed} ${display}: a format hint`)
            }
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
      expect(failures.slice(0, 5)).toEqual([])
      expect(clashes.slice(0, 8)).toEqual([])
    },
    SWEEP,
  )
})

describe('geometry unit 9 area ratios: variety and mix', () => {
  it(
    'each template shows at least 25 distinct problems, no typed answer is more than a tenth, and the figure turns and flips',
    () => {
      for (const template of TEMPLATES) {
        const prompts = new Set<string>()
        const perPart = new Map<string, Map<string, number>>()
        const figures = new Set<string>()
        for (const seed of SEEDS) {
          const a = answerOf(template, seed)
          prompts.add(a.prompt)
          figures.add(JSON.stringify(a.figure.points.map((p) => [Math.round(p.x * 100), Math.round(p.y * 100)])))
          for (const stage of a.stages) {
            const key = `${stage.id}:${stage.label}`
            const m = perPart.get(key) ?? new Map<string, number>()
            m.set(stage.answerText, (m.get(stage.answerText) ?? 0) + 1)
            perPart.set(key, m)
          }
        }
        expect(prompts.size, template).toBeGreaterThanOrEqual(25)
        expect(figures.size, template).toBeGreaterThanOrEqual(250)
        for (const [key, m] of perPart) {
          const top = [...m.entries()].sort((p, q) => q[1] - p[1])[0]!
          expect(top[1] / SEEDS.length, `${template} ${key} “${top[0]}” ${top[1]}/${SEEDS.length}`).toBeLessThanOrEqual(0.1)
        }
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
          const k = key(generateProblem('geoAreaRatios', template, seed).params)
          counts.set(k, (counts.get(k) ?? 0) + 1)
        }
        return counts
      }
      const band = (counts: Map<string, number>, keys: string[], lo: number, hi: number, what: string) => {
        for (const k of keys) {
          const n = counts.get(k) ?? 0
          expect(n / 300, `${what} ${k} ${n}`).toBeGreaterThanOrEqual(lo)
          expect(n / 300, `${what} ${k} ${n}`).toBeLessThanOrEqual(hi)
        }
      }
      band(
        share('ra.shared', (p) => String(p.ask)),
        ['parts', 'whole', 'fromPart', 'fromWhole'],
        0.18,
        0.32,
        'ra.shared',
      )
      const first = share('ra.shared', (p) => String(p.first))
      expect(first.get('ABD') ?? 0).toBeGreaterThanOrEqual(90)
      expect(first.get('ADC') ?? 0).toBeGreaterThanOrEqual(90)
      band(
        share('ra.similar', (p) => String(p.variant)),
        ['pair', 'areas', 'other', 'parallel'],
        0.15,
        0.3,
        'ra.similar',
      )
      const shapes = share('ra.similar', (p) => (p.variant === 'parallel' ? 'parallel' : String(p.n)))
      expect(shapes.get('3') ?? 0, 'similar triangles').toBeGreaterThanOrEqual(50)
      expect(shapes.get('4') ?? 0, 'similar quadrilaterals').toBeGreaterThanOrEqual(50)
      band(
        share('ra.shaded', (p) => String(p.shape)),
        ['squareCircle', 'circleSquare', 'ring', 'pond', 'circleHexagon', 'circleTriangle'],
        0.12,
        0.28,
        'ra.shaded',
      )
      const parts = share('ra.shaded', (p) => String(p.three))
      expect((parts.get('true') ?? 0) / 300, 'three parts').toBeGreaterThanOrEqual(0.5)
      expect((parts.get('true') ?? 0) / 300, 'three parts').toBeLessThanOrEqual(0.7)
      band(
        share('ra.chance', (p) => String(p.variant)),
        ['segment', 'target', 'pond', 'rectangles'],
        0.18,
        0.32,
        'ra.chance',
      )
      // Each variant asks both of its regions (or, on a segment, at least four of the five pieces).
      const sides = share('ra.chance', (p) => (p.variant === 'segment' ? `segment ${p.piece}` : `${p.variant} ${p.inner}`))
      for (const k of ['target true', 'target false', 'pond true', 'pond false', 'rectangles true', 'rectangles false']) expect(sides.get(k) ?? 0, k).toBeGreaterThanOrEqual(15)
      expect(['AB', 'BC', 'CD', 'AC', 'BD'].filter((p) => (sides.get(`segment ${p}`) ?? 0) >= 5).length, 'segment pieces').toBeGreaterThanOrEqual(4)
    },
    HEAVY,
  )
})
