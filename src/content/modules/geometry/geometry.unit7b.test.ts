/**
 * Honors geometry Unit 7, second half (Jurgensen 8-5 to 8-7). Every seed grades its own answers, keeps the promised
 * trap as a real candidate, leaves every answer out of everything she can read before she answers, never asks for a
 * number the problem already gives, and reads as English. The three ratios, elevation and depression, and the turns
 * of the figure are counted over 300 seeds. "solve the right triangle" is 8-8 and is not built.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import type { GeometryAnswer, RuleCard } from '@/content/types'
import type { ModuleId } from '@/shared/types'
import { readGeoAnswer, sameGeoValue } from './answer'
import { GEO_UNIT7B_MISTAKE_IDS, exampleShowsAnswer, exposedExact, gradeGeoStage, stageDisplay } from './grade'
import { ELEVATION_RULES, TRIG_RATIO_RULES } from './unit7bRules'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000
const SWEEP = 120_000
const RESERVED_NUMBERS = [0, 1, 43, 43.7, 43.71, 90, 180]
const RESERVED_TEXT = ['3√11', '(3√11)/2']
const SPECIAL = [30, 45, 60]

const TEMPLATES: { module: ModuleId; template: string; cards: RuleCard[] }[] = [
  { module: 'geoTrigRatios', template: 'tr.ratio', cards: TRIG_RATIO_RULES },
  { module: 'geoTrigRatios', template: 'tr.side', cards: TRIG_RATIO_RULES },
  { module: 'geoTrigRatios', template: 'tr.angle', cards: TRIG_RATIO_RULES },
  { module: 'geoElevDepress', template: 'el.story', cards: ELEVATION_RULES },
  { module: 'geoElevDepress', template: 'el.two', cards: ELEVATION_RULES },
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
  const whole = /^(\d+)\.0+$/.exec(display)
  if (whole) out.push(whole[1]!)
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
  if (/(?<![\d.])1 (feet|inches|meters|yards|miles|kilometers|units)\b/.test(text)) out.push(`plural: ${text}`)
  if (/(?<![\d.])([02-9]|\d{2,}) (foot|inch|meter|yard|mile|kilometer|unit)\b(?!-)/.test(text)) out.push(`singular: ${text}`)
  for (const s of sentences(text)) if (!/^[A-Z]/.test(s)) out.push(`sentence starts with “${s.slice(0, 24)}”`)
  return out
}

function beforeBlob(a: GeometryAnswer): string {
  const before = [a.prompt, a.figure.ariaLabel, ...(a.lines ?? [])]
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

/** Which ratio the sentence asks for. "cosine" is checked as its own word, so it is not counted as sine. */
function ratioAsked(a: GeometryAnswer): 'sin' | 'cos' | 'tan' {
  const wrote = /Write the (sine|cosine|tangent) ratio/.exec(a.prompt)
  if (wrote) return wrote[1] === 'sine' ? 'sin' : wrote[1] === 'cosine' ? 'cos' : 'tan'
  if (a.prompt.includes('Which ratio')) {
    const id = a.stages[0]!.answerText
    if (id === 'sin' || id === 'cos' || id === 'tan') return id
  }
  throw new Error(`no ratio in: ${a.prompt}`)
}

describe('geometry unit 7 second half registration', () => {
  it('puts the two modules after the special triangles, and keeps the unit title', () => {
    const ratios = getModule('geoTrigRatios')
    const elev = getModule('geoElevDepress')
    const special = getModule('geoSpecialRight')
    expect([ratios.title, elev.title]).toEqual(['The tangent, sine and cosine ratios', 'Angles of elevation and depression'])
    expect([ratios.order, elev.order]).toEqual([27, 28])
    expect(ratios.order).toBeGreaterThan(special.order)
    expect(ratios.templates.map((t) => t.id)).toEqual(['tr.ratio', 'tr.side', 'tr.angle'])
    expect(elev.templates.map((t) => t.id)).toEqual(['el.story', 'el.two'])
    for (const mod of [ratios, elev]) for (const t of mod.templates) expect(t.title, t.id).not.toBe(mod.title)
    const joined = [...TRIG_RATIO_RULES, ...ELEVATION_RULES].map((c) => `${c.title} ${c.body} ${c.example}`).join('\n')
    expect(joined).toMatch(/SOH-CAH-TOA/)
    expect(joined).toMatch(/tangent ratio/)
    expect(joined).toMatch(/sine ratio/)
    expect(joined).toMatch(/cosine ratio/)
    expect(joined).toMatch(/angle of elevation/)
    expect(joined).toMatch(/angle of depression/)
    expect(joined).toMatch(/from the horizontal/)
    expect(joined).toMatch(/alternate interior/)
    expect(joined.toLowerCase()).not.toContain('solve the right triangle')
    expect(joined).toMatch(/DEGREE mode/)
  })
})

describe.each(TEMPLATES)('$module/$template over 300 seeds', ({ module, template, cards }) => {
  const cardIds = new Set(cards.map((card) => card.id))

  it(
    'is deterministic, validates its answers, keeps the trap as a real candidate, and never shows an answer early',
    () => {
      for (const seed of SEEDS) {
        const p = generateProblem(module, template, seed)
        expect(generateProblem(module, template, seed)).toEqual(p)
        expect(() => JSON.stringify(p)).not.toThrow()
        expect(p.id).toBe(`${module}/${template}@1/${seed.toString(36)}`)
        expect(p.kind).toBe('geometry')
        if (p.answer.type !== 'geometry') throw new Error('not geometry')
        const a = p.answer
        const where = p.id
        expect(a.stages.length, where).toBe(1)
        expect(a.figure.points.length, where).toBeGreaterThan(0)
        expect(a.figure.ariaLabel.length, where).toBeGreaterThan(0)
        const blob = beforeBlob(a)
        const display = stageDisplay(a.stages[0]!)
        expect(shows(blob, display), `${where} shows “${display}”`).toBe(false)
        expect(`${a.prompt}\n${blob}\n${a.stages[0]!.reveal.join('\n')}`.toLowerCase(), where).not.toContain('solve the right triangle')
        for (const stage of a.stages) {
          expect(cardIds.has(stage.ruleCard), `${where} card ${stage.ruleCard}`).toBe(true)
          expect(gradeGeoStage(a, stage.id, stage.answerText).verdict, `${where} ${stage.id}`).toBe('correct')
          expect(RESERVED_TEXT.includes(stage.answerText), `${where} reserved ${stage.answerText}`).toBe(false)
          for (const line of stage.reveal) expect(blob.includes(line), `${where} reveal is on screen`).toBe(false)
          const garbage = stage.kind === 'choice' ? '' : '???'
          expect(gradeGeoStage(a, stage.id, garbage).verdict, `${where} garbage`).toBe('invalid')
          // A message she can retry on (a blank choice, or a number that is not the answer) must not show the answer.
          const retryText = stage.kind === 'choice' ? '' : '999999'
          const retry = gradeGeoStage(a, stage.id, retryText)
          if (retry.verdict !== 'correct') {
            const said = retry.verdict === 'mistake' ? retry.witness : retry.message
            expect(shows(said, display), `${where} retry “${retryText}” shows “${display}”`).toBe(false)
          }
          for (const trap of stage.traps) {
            const g = gradeGeoStage(a, stage.id, trap.text)
            expect(g.verdict === 'mistake' && g.mistake === trap.id, `${where} ${stage.id} ${trap.id} “${trap.text}”`).toBe(true)
            expect(shows(trap.witness, display), `${where} ${trap.id} witness shows “${display}”`).toBe(false)
            expect(englishProblems(trap.witness), `${where} ${trap.id} witness`).toEqual([])
          }
          for (const choice of stage.choices ?? []) {
            expect(a.prompt.toLowerCase().includes(choice.text.toLowerCase()), `${where} prompt prints “${choice.text}”`).toBe(false)
            expect(stage.nudge.toLowerCase().includes(choice.text.toLowerCase()), `${where} nudge prints “${choice.text}”`).toBe(false)
          }
          for (const line of [stage.hint, stage.nudge, ...stage.reveal]) expect(englishProblems(line), `${where} ${stage.id}`).toEqual([])
        }
        const promised = a.stages.find((stage) => stage.id === a.trapStage)
        expect(promised?.traps.some((trap) => trap.id === a.trap && trap.text === a.trapAnswer), `${where} ${a.trap}`).toBe(true)
        const g = gradeGeoStage(a, a.trapStage, a.trapAnswer)
        expect(g.verdict === 'mistake' && g.mistake === a.trap, `${where} promised ${a.trap}`).toBe(true)
        expect(englishProblems(a.prompt), where).toEqual([])
        expect(englishProblems(a.figure.ariaLabel), `${where} aria`).toEqual([])
        expect(a.prompt, where).not.toMatch(/\b[Aa]n? \d/)
      }
    },
    HEAVY,
  )

  it(
    'no answer is reserved, zero or less, or a number the problem gives',
    () => {
      for (const seed of SEEDS) {
        const a = answerOf(module, template, seed)
        const given = givenValues(a)
        for (const stage of a.stages) {
          if (stage.kind !== 'number') continue
          const v = valueOf(stage.answerText)!
          expect(v, `${template}/${seed}`).not.toBeNull()
          const n = (v.q.n / v.q.d) * Math.sqrt(v.q.rad)
          expect(n, `${template}/${seed} ${stage.answerText}`).toBeGreaterThan(0)
          if (v.q.rad === 1) expect(RESERVED_NUMBERS.includes(n), `${template}/${seed} reserved ${stage.answerText}`).toBe(false)
          if (stage.round !== undefined) {
            const plain = given.filter((g) => g.q.rad === 1).map((g) => g.q.n / g.q.d)
            expect(plain.some((g) => Math.abs(g - n) < 1e-9), `${template}/${seed} ${stage.answerText} is given`).toBe(false)
          } else {
            expect(given.some((g) => sameGeoValue(g, v)), `${template}/${seed} ${stage.answerText} is given`).toBe(false)
          }
        }
      }
    },
    HEAVY,
  )
})

describe('geometry unit 7b trap coverage', () => {
  it(
    'every new geo_ id, and every borrowed trig slip, is a real candidate on some seed',
    () => {
      const seen = new Set<string>()
      const promised = new Set<string>()
      for (const { module, template } of TEMPLATES) {
        for (const seed of SEEDS) {
          const a = answerOf(module, template, seed)
          promised.add(a.trap)
          for (const stage of a.stages) for (const trap of stage.traps) seen.add(trap.id)
        }
      }
      for (const id of GEO_UNIT7B_MISTAKE_IDS) {
        expect(seen.has(id), id).toBe(true)
        expect(promised.has(id), `${id} promised`).toBe(true)
        const info = ERROR_PATTERNS[id]
        expect(info.lesson.length, id).toBeGreaterThan(40)
        expect(info.example, id).toContain('✗')
        expect(info.example, id).toContain('→')
        expect(englishProblems(info.lesson), id).toEqual([])
        expect(`${info.title} ${info.lesson} ${info.example}`, id).not.toMatch(/\d/)
      }
      for (const id of [
        'trig_opposite_adjacent_swapped',
        'trig_sin_cos_swapped',
        'trig_hypotenuse_as_leg',
        'trig_radian_mode',
        'trig_ratio_for_angle',
        'trig_depression_from_vertical',
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
          const display = stageDisplay(a.stages[0]!)
          const stage = a.stages[0]!
          if (shows([stage.hint, stage.nudge, stage.note ?? ''].join('\n'), display)) clashes.push(`${template}/${seed} ${display}: hint`)
          for (const trap of stage.traps) {
            const info = ERROR_PATTERNS[trap.id]
            if (shows(`${info.title}\n${info.lesson}\n${info.example}`, display) || exampleShowsAnswer(info.example, display)) clashes.push(`${template}/${seed} ${display}: ${trap.id}`)
            if (shows(trap.witness, display)) clashes.push(`${template}/${seed} ${display}: ${trap.id} witness`)
          }
          for (const card of results) {
            if (shows(card.example, display) || exampleShowsAnswer(card.example, display) || (card.result && exampleShowsAnswer(card.result, display))) {
              clashes.push(`${template}/${seed} ${display}: rule ${card.id}`)
            }
            if (!/[A-Za-z]{4}/.test(display) && shows(card.body, display)) clashes.push(`${template}/${seed} ${display}: rule body ${card.id}`)
          }
        }
      }
      expect(clashes.slice(0, 8)).toEqual([])
    },
    SWEEP,
  )

  it('the format hints and the card examples do not work seed 1’s problem', () => {
    for (const { module, template, cards } of TEMPLATES) {
      const a = answerOf(module, template, 1)
      const given = new Set(givenValues(a).map((v) => v.q.n / v.q.d).filter((n) => n > 1))
      const texts = [...cards.map((c) => c.example ?? ''), ...a.stages.map((s) => s.hint)]
      for (const text of texts) {
        const numbers = [...text.matchAll(/\d+/g)].map((m) => Number(m[0])).filter((n) => given.has(n))
        expect(numbers.length, `${template}: “${text}” reuses ${numbers.join(', ')}`).toBeLessThan(2)
      }
    }
  })
})

describe('unit 7b variety', () => {
  it(
    'each template shows at least 25 distinct problems over 300 seeds, and no answer is more than a tenth of them',
    () => {
      for (const { module, template } of TEMPLATES) {
        const prompts = new Set<string>()
        const whole = new Map<string, number>()
        for (const seed of SEEDS) {
          const a = answerOf(module, template, seed)
          prompts.add(a.prompt)
          whole.set(a.expectedDisplay, (whole.get(a.expectedDisplay) ?? 0) + 1)
        }
        expect(prompts.size, template).toBeGreaterThanOrEqual(25)
        expect(Math.max(...whole.values()) / SEEDS.length, `${template} ${[...whole.entries()].sort((p, q) => q[1] - p[1])[0]![0]}`).toBeLessThanOrEqual(0.1)
      }
    },
    HEAVY,
  )

  it(
    'the three ratios each appear on 25 to 40 percent of tr.ratio, and elevation and depression each on 35 to 65 percent of el.story',
    () => {
      const ratios = new Map<string, number>()
      const stories = new Map<string, number>()
      for (const seed of SEEDS) {
        const ratio = ratioAsked(answerOf('geoTrigRatios', 'tr.ratio', seed))
        ratios.set(ratio, (ratios.get(ratio) ?? 0) + 1)
        const story = answerOf('geoElevDepress', 'el.story', seed)
        const kind = story.prompt.includes('angle of depression') ? 'depression' : story.prompt.includes('angle of elevation') ? 'elevation' : ''
        expect(kind, story.prompt).not.toBe('')
        stories.set(kind, (stories.get(kind) ?? 0) + 1)
      }
      for (const id of ['sin', 'cos', 'tan']) {
        const share = (ratios.get(id) ?? 0) / SEEDS.length
        expect(share, id).toBeGreaterThanOrEqual(0.25)
        expect(share, id).toBeLessThanOrEqual(0.4)
      }
      for (const id of ['elevation', 'depression']) {
        const share = (stories.get(id) ?? 0) / SEEDS.length
        expect(share, id).toBeGreaterThanOrEqual(0.35)
        expect(share, id).toBeLessThanOrEqual(0.65)
      }
    },
    HEAVY,
  )

  it(
    'a side problem’s angle is never only 30, 45, or 60, and a random angle is not within a twentieth of a degree of those',
    () => {
      for (const seed of SEEDS) {
        const side = generateProblem('geoTrigRatios', 'tr.side', seed)
        expect(SPECIAL.includes(Number(side.params.deg)), `tr.side/${seed} ${side.params.deg}`).toBe(false)
        const angle = answerOf('geoTrigRatios', 'tr.angle', seed)
        const exact = Number(angle.stages[0]!.exact)
        for (const s of SPECIAL) expect(Math.abs(exact - s), `tr.angle/${seed} ${exact}`).toBeGreaterThanOrEqual(0.05)
      }
    },
    HEAVY,
  )

  it(
    'plain triangles turn and mirror, and a story’s ground stays horizontal with the right angle on either side',
    () => {
      const quarters = new Set<string>()
      let tilted = 0
      let positive = 0
      let negative = 0
      for (const seed of SEEDS) {
        const a = answerOf('geoTrigRatios', 'tr.ratio', seed)
        const right = (a.figure.angles ?? []).find((g) => g.right)!
        const C = a.figure.points.find((p) => p.id === right.vertex)!
        const cx = a.figure.points.reduce((s, p) => s + p.x, 0) / a.figure.points.length
        const cy = a.figure.points.reduce((s, p) => s + p.y, 0) / a.figure.points.length
        quarters.add(`${C.x >= cx ? 'E' : 'W'}${C.y >= cy ? 'N' : 'S'}`)
        const leg = a.figure.points.find((p) => p.id === right.from)!
        if (Math.abs(leg.x - C.x) > 1e-6 && Math.abs(leg.y - C.y) > 1e-6) tilted++
        const area = signedArea(a.figure.points)
        if (area > 0) positive++
        else negative++
      }
      expect(quarters.size).toBeGreaterThanOrEqual(4)
      expect(tilted).toBeGreaterThan(SEEDS.length / 2)
      expect(positive).toBeGreaterThan(SEEDS.length / 5)
      expect(negative).toBeGreaterThan(SEEDS.length / 5)
      let left = 0
      let rightN = 0
      for (const seed of SEEDS) {
        const a = answerOf('geoElevDepress', 'el.story', seed)
        const mark = (a.figure.angles ?? []).find((g) => g.right)!
        const V = a.figure.points.find((p) => p.id === mark.vertex)!
        const ends = [mark.from, mark.to].map((id) => a.figure.points.find((p) => p.id === id)!)
        const vertical = ends.find((p) => Math.abs(p.x - V.x) <= 1e-6 * Math.max(1, Math.abs(p.y - V.y)))
        const horizontal = ends.find((p) => p !== vertical)
        expect(vertical, `el.story/${seed} ground`).toBeTruthy()
        expect(horizontal && Math.abs(horizontal.y - V.y) <= 1e-6 * Math.max(1, Math.abs(horizontal.x - V.x)), `el.story/${seed} level`).toBe(true)
        if ((horizontal?.x ?? 0) >= V.x) rightN++
        else left++
      }
      expect(left).toBeGreaterThan(SEEDS.length / 5)
      expect(rightN).toBeGreaterThan(SEEDS.length / 5)
    },
    HEAVY,
  )
})

function signedArea(pts: { x: number; y: number }[]): number {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    s += p.x * q.y - q.x * p.y
  }
  return s
}
