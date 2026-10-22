/**
 * Honors geometry Unit 6 (similarity). Every seed grades its own answers, keeps the promised trap as a real candidate,
 * leaves the answer out of everything she can read before she answers, never asks for a number the problem already
 * gives, and reads as English. Examples on the catalog entries, the rule cards and the format hints never show an answer
 * a template can generate for that part (the 2000-seed sweep), and the distributions match the brief.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import type { GeometryAnswer, RuleCard } from '@/content/types'
import type { ErrorPatternId, GeoPoint, ModuleId } from '@/shared/types'
import { readGeoAnswer } from './answer'
import { GEO_UNIT6_MISTAKE_IDS, containsAnswer, exampleShowsAnswer, exposed, gradeGeoStage, stageDisplay } from './grade'
import { GEO_RULE_FOR } from './rules'
import { PARTS_RULES, RATIO_RULES, SIMILAR_RULES } from './unit6Rules'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000
/** Numbers and texts that are examples somewhere a Unit 6 student can see them, so no part may have them as its answer. */
const RESERVED_NUMBERS = [0, 1, 23, 41, 67, 90, 180]
const RESERVED_TEXT = ['9/7', '7/9', '2√7']

const TEMPLATES: { module: ModuleId; template: string; cards: RuleCard[] }[] = [
  { module: 'geoRatios', template: 'gr.proportion', cards: RATIO_RULES },
  { module: 'geoRatios', template: 'gr.polygons', cards: RATIO_RULES },
  { module: 'geoSimilarTriangles', template: 'gt.prove', cards: SIMILAR_RULES },
  { module: 'geoSimilarTriangles', template: 'gt.solve', cards: SIMILAR_RULES },
  { module: 'geoProportionalParts', template: 'gp.splitter', cards: PARTS_RULES },
  { module: 'geoProportionalParts', template: 'gp.bisector', cards: PARTS_RULES },
]
/** Templates whose problems find x (all of them but the which-test question). */
const NUMERIC = ['gr.proportion', 'gr.polygons', 'gt.solve', 'gp.splitter', 'gp.bisector']

function answerOf(module: ModuleId, template: string, seed: number): GeometryAnswer {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${template}/${seed} is ${p.answer.type}`)
  return p.answer
}

/** A word answer is found in any case, a number as its own token, either minus sign. */
function shows(blob: string, display: string): boolean {
  if (/[A-Za-z]{4}/.test(display)) return blob.toLowerCase().includes(display.toLowerCase())
  return [display, display.replace(/-/g, '−')].some((d) => exposed(blob, d))
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** English the student reads: no article before a number, plurals that agree, and no sentence opening on a symbol. */
function englishProblems(text: string): string[] {
  const out: string[] = []
  if (/\b[Aa]n? \d/.test(text)) out.push(`article before a number: ${text}`)
  if (/\b1 (ticks|arcs|arrows|units|feet|meters)\b/.test(text) || /\b([02-9]|\d{2,}) (tick|arc|arrow|unit|foot|meter)\b/.test(text)) out.push(`plural: ${text}`)
  for (const s of sentences(text)) if (!/^[A-Z]/.test(s)) out.push(`sentence starts with “${s.slice(0, 12)}”`)
  return out
}

/** What she can read before she answers anything: the prompt, the figure's words and labels, hints, nudges, notes. */
function beforeBlob(a: GeometryAnswer): string {
  const before = [a.prompt, a.figure.ariaLabel, ...(a.lines ?? [])]
  for (const stage of a.stages) before.push(stage.hint, stage.nudge, stage.note ?? '')
  for (const pt of a.figure.points) before.push(pt.label ?? '')
  for (const s of a.figure.segments ?? []) before.push(s.label ?? '')
  for (const g of a.figure.angles ?? []) before.push(g.label ?? '')
  for (const l of a.figure.lines ?? []) before.push(l.label ?? '')
  return before.join('\n')
}

/** Every number the problem gives, in the prompt or on the figure. */
function givenNumbers(a: GeometryAnswer): number[] {
  const texts = [a.prompt, ...(a.figure.segments ?? []).map((s) => s.label ?? ''), ...(a.figure.angles ?? []).map((g) => g.label ?? '')]
  return texts.flatMap((t) => [...t.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0])))
}

/** A number part's answer as a plain number, or null for a radical or a pick. */
function plainValue(stage: GeometryAnswer['stages'][number]): number | null {
  if (stage.kind !== 'number') return null
  const r = readGeoAnswer(stage.answerText, { ratio: stage.ratio === true })
  if (!r.ok || r.value.kind !== 'qty' || r.value.q.rad !== 1) return null
  return r.value.q.n / r.value.q.d
}

describe('geometry unit 6 registration', () => {
  it('puts the three modules in Unit 6 order, after Unit 5', { timeout: HEAVY }, () => {
    const ratios = getModule('geoRatios')
    const similar = getModule('geoSimilarTriangles')
    const parts = getModule('geoProportionalParts')
    expect([ratios.title, similar.title, parts.title]).toEqual(['Ratio, proportion and similar polygons', 'Similar triangles', 'Proportional parts'])
    expect([ratios.order, similar.order, parts.order]).toEqual([21, 22, 23])
    expect(ratios.order).toBeGreaterThan(getModule('geoTrapezoids').order)
    expect(ratios.templates.map((t) => t.id)).toEqual(['gr.proportion', 'gr.polygons'])
    expect(similar.templates.map((t) => t.id)).toEqual(['gt.prove', 'gt.solve'])
    expect(parts.templates.map((t) => t.id)).toEqual(['gp.splitter', 'gp.bisector'])
    // A template's title is never its module's title (the breadcrumb would repeat itself).
    for (const mod of [ratios, similar, parts]) for (const t of mod.templates) expect(t.title, t.id).not.toBe(mod.title)
    const sample = generateProblem('geoRatios', 'gr.polygons', 1)
    expect(sample.kind).toBe('geometry')
    for (const mod of [ratios, similar, parts]) {
      expect(mod.progress(sample, null, false)).toMatchObject({ stage: 0, total: 1 })
      expect(mod.nextStep(sample, null, false)).toBeNull()
    }
  })

  it('seed 1 of each template promises the trap written for it', { timeout: HEAVY }, () => {
    const want: Record<string, [ModuleId, ErrorPatternId, string]> = {
      'gr.proportion': ['geoRatios', 'geo_proportion_distribute', '41/7'],
      'gr.polygons': ['geoRatios', 'geo_matched_by_position', '22'],
      'gt.prove': ['geoSimilarTriangles', 'geo_similarity_test_missed', 'none'],
      'gt.solve': ['geoSimilarTriangles', 'geo_shadows_crossed', '5/2'],
      'gp.splitter': ['geoProportionalParts', 'geo_part_over_whole', '52'],
      'gp.bisector': ['geoProportionalParts', 'geo_part_over_whole', '44'],
    }
    for (const [template, [module, trap, text]] of Object.entries(want)) {
      const a = answerOf(module, template, 1)
      expect([a.trap, a.trapAnswer], template).toEqual([trap, text])
      expect(gradeGeoStage(a, a.trapStage, a.trapAnswer)).toMatchObject({ verdict: 'mistake', mistake: trap })
    }
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
        expect(a.stages.length, where).toBeGreaterThan(0)
        for (const n of a.angles) expect(Number.isInteger(n) && n > 0 && n < 180, `${where} angle ${n}`).toBe(true)
        for (const n of a.lengths) expect(Number.isInteger(n) && n > 0, `${where} length ${n}`).toBe(true)
        if (a.figure.points.length > 0) expect(a.figure.ariaLabel.length, where).toBeGreaterThan(0)
        const blob = beforeBlob(a)
        const displays = a.stages.map((stage) => stageDisplay(stage))
        const given = givenNumbers(a)
        for (const stage of a.stages) {
          expect(cardIds.has(stage.ruleCard), `${where} card ${stage.ruleCard}`).toBe(true)
          expect(gradeGeoStage(a, stage.id, stage.answerText).verdict, `${where} ${stage.id}`).toBe('correct')
          const display = stageDisplay(stage)
          expect(shows(blob, display), `${where} shows “${display}”`).toBe(false)
          expect(containsAnswer(blob, display), `${where} shows “${display}”`).toBe(false)
          expect(RESERVED_TEXT.includes(stage.answerText), `${where} reserved ${stage.answerText}`).toBe(false)
          const value = plainValue(stage)
          if (value !== null) {
            expect(RESERVED_NUMBERS.includes(value), `${where} reserved ${stage.answerText}`).toBe(false)
            expect(value, `${where} ${stage.id} positive`).toBeGreaterThan(0)
            // An answer that equals a number the problem gives could be copied without the work.
            expect(given.some((g) => Math.abs(g - value) < 1e-9), `${where} ${stage.id} = ${stage.answerText} is given`).toBe(false)
          }
          for (const line of stage.reveal) expect(blob.includes(line), `${where} reveal is on screen`).toBe(false)
          const garbage = stage.kind === 'choice' ? '' : '???'
          expect(gradeGeoStage(a, stage.id, garbage).verdict, `${where} garbage`).toBe('invalid')
          for (const trap of stage.traps) {
            const g = gradeGeoStage(a, stage.id, trap.text)
            expect(g.verdict === 'mistake' && g.mistake === trap.id, `${where} ${stage.id} ${trap.id}`).toBe(true)
            for (const other of displays) expect(shows(trap.witness, other), `${where} ${trap.id} witness shows “${other}”`).toBe(false)
            expect(englishProblems(trap.witness), `${where} ${trap.id} witness`).toEqual([])
          }
          // No choice's button text is printed in the prompt.
          for (const choice of stage.choices ?? []) expect(a.prompt.includes(choice.text), `${where} prompt prints “${choice.text}”`).toBe(false)
          for (const line of [stage.hint, stage.nudge, ...stage.reveal]) expect(englishProblems(line), `${where} ${stage.id}`).toEqual([])
        }
        const promised = a.stages.find((stage) => stage.id === a.trapStage)
        expect(promised?.traps.some((trap) => trap.id === a.trap && trap.text === a.trapAnswer), `${where} ${a.trap}`).toBe(true)
        const g = gradeGeoStage(a, a.trapStage, a.trapAnswer)
        expect(g.verdict === 'mistake' && g.mistake === a.trap, `${where} promised ${a.trap}`).toBe(true)
        expect(englishProblems(a.prompt), where).toEqual([])
        expect(englishProblems(a.figure.ariaLabel), `${where} aria`).toEqual([])
        expect(a.prompt, where).not.toMatch(/\b[Aa]n? \d/)
        // A part labeled x is about an x the prompt names.
        if (a.stages.some((s) => s.id === 'x' && s.label === 'x')) expect(a.prompt, where).toMatch(/\bx\b/)
      }
    },
    HEAVY,
  )
})

describe('geometry unit 6 trap coverage', () => {
  it(
    'every new geo_ id is a real candidate on some seed, with a catalog entry in the same voice',
    () => {
      const seen = new Set<string>()
      for (const { module, template } of TEMPLATES) {
        for (const seed of SEEDS) {
          const a = answerOf(module, template, seed)
          for (const stage of a.stages) for (const trap of stage.traps) seen.add(trap.id)
        }
      }
      for (const id of GEO_UNIT6_MISTAKE_IDS) {
        expect(seen.has(id), id).toBe(true)
        const info = ERROR_PATTERNS[id]
        expect(info.id).toBe(id)
        expect(info.lesson.length, id).toBeGreaterThan(40)
        expect(info.example, id).toContain('✗')
        expect(info.example, id).toContain('→')
        expect(englishProblems(info.lesson), id).toEqual([])
        // Lessons and examples carry no digit but the 180 of a straight angle, so no example can be an answer.
        expect(`${info.lesson} ${info.example}`.replace(/180/g, ''), id).not.toMatch(/\d/)
      }
    },
    HEAVY,
  )

  it(
    'every slip the brief asks for is promised on some seed',
    () => {
      const promised = new Set<string>()
      for (const { module, template } of TEMPLATES) for (const seed of SEEDS) promised.add(answerOf(module, template, seed).trap)
      for (const id of [
        'geo_matched_by_position',
        'geo_part_over_whole',
        'geo_scale_factor_inverted',
        'geo_perimeter_ratio_squared',
        'geo_cross_multiplied_wrong',
        'geo_geometric_as_arithmetic',
        'geo_bisector_ratio_swapped',
        'geo_ssa_as_similarity',
        'geo_corresponding_supplementary',
        'geo_shadows_crossed',
      ]) {
        expect(promised.has(id), id).toBe(true)
      }
    },
    HEAVY,
  )

  it(
    'examples, witnesses, hints, nudges, and rule cards never show a generated answer, over 2000 seeds',
    () => {
      const clashes: string[] = []
      for (const { module, template, cards } of TEMPLATES) {
        // What each card's example works out to: the text after its last "=" or "→".
        const results = cards.map((card) => ({ id: card.id, example: card.example ?? '', body: card.body, result: (card.example ?? '').split(/=|→/).pop()!.trim() }))
        for (let seed = 1; seed <= 2000; seed++) {
          const a = answerOf(module, template, seed)
          for (const stage of a.stages) {
            const display = stageDisplay(stage)
            if (shows([stage.hint, stage.nudge, stage.note ?? ''].join('\n'), display)) clashes.push(`${template}/${seed} ${display}: hint`)
            for (const trap of stage.traps) {
              const info = ERROR_PATTERNS[trap.id]
              if (shows(`${info.title}\n${info.lesson}\n${info.example}`, display) || exampleShowsAnswer(info.example, display) || shows(trap.witness, display)) {
                clashes.push(`${template}/${seed} ${display}: ${trap.id}`)
              }
            }
            for (const card of results) {
              if (shows(card.example, display) || exampleShowsAnswer(card.example, display) || (card.result && exampleShowsAnswer(card.result, display))) {
                clashes.push(`${template}/${seed} ${display}: rule ${card.id}`)
              }
              // A body may name every test; it may not hold a number that is the answer.
              if (!/[A-Za-z]{4}/.test(display) && shows(card.body, display)) clashes.push(`${template}/${seed} ${display}: rule body ${card.id}`)
            }
          }
        }
      }
      expect(clashes.slice(0, 8)).toEqual([])
    },
    HEAVY,
  )

  it('the format hints and the examples do not work seed 1’s problem', { timeout: HEAVY }, () => {
    for (const { module, template, cards } of TEMPLATES) {
      const a = answerOf(module, template, 1)
      const given = new Set(givenNumbers(a).filter((n) => n > 1))
      const texts = [...cards.map((c) => c.example ?? ''), ...a.stages.map((s) => s.hint)]
      for (const text of texts) {
        const numbers = [...text.matchAll(/\d+/g)].map((m) => Number(m[0])).filter((n) => given.has(n))
        expect(numbers.length, `${template}: “${text}” reuses ${numbers.join(', ')}`).toBeLessThan(2)
      }
    }
  })
})

describe('the hint ladder always has a card to show', () => {
  it(
    'every part’s card, and the card each named slip opens, is a card of that module',
    () => {
      for (const { module, template, cards } of TEMPLATES) {
        const ids = new Set(cards.map((c) => c.id))
        for (const seed of SEEDS.slice(0, 150)) {
          const a = answerOf(module, template, seed)
          for (const stage of a.stages) {
            expect(ids.has(stage.ruleCard), `${template}/${seed} ${stage.ruleCard}`).toBe(true)
            for (const trap of stage.traps) {
              const card = GEO_RULE_FOR[trap.id as keyof typeof GEO_RULE_FOR]
              if (card) expect(ids.has(card), `${template}/${seed} ${trap.id} opens ${card}`).toBe(true)
            }
          }
          for (const id of a.ruleCards) expect(ids.has(id), `${template}/${seed} related ${id}`).toBe(true)
        }
      }
    },
    HEAVY,
  )
})

describe('unit 6 variety', () => {
  it(
    'each numeric template shows ten or more values of x over 300 seeds, none on more than a fifth of them',
    () => {
      for (const { module, template } of TEMPLATES.filter((t) => NUMERIC.includes(t.template))) {
        const xs = new Map<string, number>()
        let withX = 0
        for (const seed of SEEDS) {
          const stage = answerOf(module, template, seed).stages.find((s) => s.id === 'x')
          if (!stage) continue
          withX++
          xs.set(stage.answerText, (xs.get(stage.answerText) ?? 0) + 1)
        }
        expect(withX, template).toBeGreaterThan(150)
        expect(xs.size, template).toBeGreaterThanOrEqual(10)
        expect(Math.max(...xs.values()) / withX, template).toBeLessThanOrEqual(0.2)
        expect(Math.max(...xs.values()) / SEEDS.length, template).toBeLessThanOrEqual(0.2)
      }
    },
    HEAVY,
  )

  it(
    'each which-test answer is 12 to 25 percent of any 300 seeds in a row, and every family appears',
    () => {
      for (const start of [1, 2, 3, 4, 101]) {
        const answers = new Map<string, number>()
        for (let seed = start; seed < start + 300; seed++) {
          const id = answerOf('geoSimilarTriangles', 'gt.prove', seed).stages[0]!.answerText
          answers.set(id, (answers.get(id) ?? 0) + 1)
        }
        for (const id of ['AA', 'SSS', 'SAS', 'none']) {
          const share = (answers.get(id) ?? 0) / 300
          expect(share, `${id} from ${start}`).toBeGreaterThanOrEqual(0.12)
          expect(share, `${id} from ${start}`).toBeLessThanOrEqual(0.25)
        }
      }
      const families = new Set<string>()
      for (const seed of SEEDS) families.add(String(generateProblem('geoSimilarTriangles', 'gt.prove', seed).params.case))
      expect([...families].sort()).toEqual(
        ['aa-arcs', 'aa-numbers', 'aa-parallel', 'aa-right', 'aa-shared', 'aa-vertical', 'one-angle', 'sas', 'sas-shared', 'shared-only', 'ssa', 'sss', 'two-sides', 'vertical-only'].sort(),
      )
    },
    HEAVY,
  )

  it(
    'every case shows up, and the letters never use I, O, J, K, L, M, N, or X',
    () => {
      const cases = new Map<string, Set<string>>()
      for (const { module, template } of TEMPLATES) {
        const seen = new Set<string>()
        for (const seed of SEEDS) {
          const p = generateProblem(module, template, seed)
          if (p.answer.type !== 'geometry') throw new Error(template)
          seen.add(String(p.params.case))
          const letters = p.answer.figure.points.map((pt) => pt.id).join('') + (p.answer.prompt.match(/\b[A-Z]{2,}\b/g) ?? []).join('')
          expect(letters, p.id).not.toMatch(/[IOJKLMNX]/)
        }
        cases.set(template, seen)
      }
      expect([...cases.get('gr.proportion')!].sort()).toEqual(['binomial', 'mean', 'product', 'property', 'simple'])
      // Every property of proportions is the true choice on some seed.
      const forms = new Set<string>()
      for (let seed = 1; seed <= 600; seed++) {
        const p = generateProblem('geoRatios', 'gr.proportion', seed)
        if (p.params.case === 'property') forms.add(String(p.params.form))
      }
      expect([...forms].sort()).toEqual(['addition', 'alternation', 'inversion', 'means', 'subtraction', 'sum'])
      expect([...cases.get('gr.polygons')!].sort()).toEqual(['angle', 'perimeter', 'sides'])
      expect([...cases.get('gt.solve')!].sort()).toEqual(['mirror', 'parallel', 'reverse', 'right', 'shadow'])
      expect([...cases.get('gp.splitter')!].sort()).toEqual(['converse', 'midpoint', 'splitter'])
      expect([...cases.get('gp.bisector')!].sort()).toEqual(['bisector', 'parallels'])
    },
    HEAVY,
  )
})

/** Direction from a polygon's middle to the middle of each side, in degrees. */
function sideDirections(pts: readonly GeoPoint[]): number[] {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
  return pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length]!
    return (Math.atan2((p.y + q.y) / 2 - cy, (p.x + q.x) / 2 - cx) * 180) / Math.PI
  })
}

const gap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

describe('similar polygons are drawn so position never gives the correspondence', () => {
  it(
    'for every seed, the side drawn in the same place as each side of the second polygon is not its partner',
    () => {
      let reflected = 0
      for (const seed of SEEDS) {
        const a = answerOf('geoRatios', 'gr.polygons', seed)
        // The statement: "In the figure, ABCD ~ EFGH." or "△ABC ~ △DEF."
        const m = /In the figure, △?([A-Z]{3,4}) ~ △?([A-Z]{3,4})\./.exec(a.prompt)
        expect(m, a.prompt).not.toBeNull()
        const first = [...m![1]!]
        const second = [...m![2]!]
        const at = (id: string) => a.figure.points.find((p) => p.id === id)!
        const p1 = first.map(at)
        const p2 = second.map(at)
        const d1 = sideDirections(p1)
        const d2 = sideDirections(p2)
        d2.forEach((dir, j) => {
          const byPosition = d1.map((d, i) => ({ i, g: gap(d, dir) })).sort((u, v) => u.g - v.g)[0]!.i
          expect(byPosition, `gr.polygons/${seed} side ${j}`).not.toBe(j)
        })
        // Orientation: a flipped copy runs the other way round.
        const area = (pts: GeoPoint[]) => pts.reduce((s, p, i) => s + p.x * pts[(i + 1) % pts.length]!.y - pts[(i + 1) % pts.length]!.x * p.y, 0)
        if (Math.sign(area(p1)) !== Math.sign(area(p2))) reflected++
      }
      // A mirror image always leaves some side facing where it faced (the side along the mirror's axis), so only the
      // irregular shapes can be flipped and still keep every side away from its partner: some copies are flipped,
      // most are turned.
      expect(reflected).toBeGreaterThan(SEEDS.length * 0.05)
      expect(reflected).toBeLessThan(SEEDS.length * 0.75)
    },
    HEAVY,
  )

  it(
    'the statement is not alphabetical most of the time: the second polygon’s letters start anywhere',
    () => {
      let alphabetical = 0
      for (const seed of SEEDS) {
        const a = answerOf('geoRatios', 'gr.polygons', seed)
        const m = /~ △?([A-Z]{3,4})\./.exec(a.prompt)!
        const letters = [...m[1]!]
        if (letters.join('') === [...letters].sort().join('')) alphabetical++
      }
      expect(alphabetical / SEEDS.length).toBeLessThanOrEqual(0.25)
    },
    HEAVY,
  )
})

describe('the converse figure never answers', () => {
  it(
    'the segment looks parallel about as often when it is not as when it is',
    () => {
      const tally = { yes: [0, 0], no: [0, 0] }
      for (let seed = 1; seed <= 600; seed++) {
        const p = generateProblem('geoProportionalParts', 'gp.splitter', seed)
        if (p.params.case !== 'converse') continue
        const answer = String(p.params.answer) as 'yes' | 'no'
        tally[answer][p.params.looksParallel ? 0 : 1]++
        if (p.answer.type === 'geometry') expect(p.answer.prompt).toContain('not drawn to scale')
      }
      for (const answer of ['yes', 'no'] as const) {
        const [looks, not] = tally[answer]
        expect(looks + not, answer).toBeGreaterThan(40)
        const share = looks / (looks + not)
        expect(share, answer).toBeGreaterThan(0.3)
        expect(share, answer).toBeLessThan(0.7)
      }
    },
    HEAVY,
  )
})

describe('a true answer is never graded wrong', () => {
  it(
    'a scale factor or a ratio reads as a fraction, as a:b, or as "a to b"',
    () => {
      let ratios = 0
      for (const { module, template } of TEMPLATES) {
        for (const seed of SEEDS.slice(0, 120)) {
          const a = answerOf(module, template, seed)
          for (const stage of a.stages) {
            if (!stage.ratio) continue
            ratios++
            const [top, bottom] = stage.answerText.includes('/') ? stage.answerText.split('/') : [stage.answerText, '1']
            for (const spelled of [stage.answerText, `${top}:${bottom}`, `${top} : ${bottom}`, `${top} to ${bottom}`, `${Number(top) * 2}:${Number(bottom) * 2}`]) {
              expect(gradeGeoStage(a, stage.id, spelled).verdict, `${template}/${seed} ${spelled}`).toBe('correct')
            }
            // Upside down is named whenever it is a trap, and never right.
            expect(gradeGeoStage(a, stage.id, `${bottom}:${top}`).verdict, `${template}/${seed}`).not.toBe('correct')
          }
        }
      }
      expect(ratios).toBeGreaterThan(50)
    },
    HEAVY,
  )

  it(
    'a story’s length reads with or without its unit, and the other unit is a note',
    () => {
      let stories = 0
      for (let seed = 1; seed <= 300; seed++) {
        const a = answerOf('geoSimilarTriangles', 'gt.solve', seed)
        const stage = a.stages.find((s) => s.lengthUnit)
        if (!stage) continue
        stories++
        const unit = stage.lengthUnit!
        const word = unit === 'ft' ? 'feet' : 'meters'
        for (const typed of [stage.answerText, `${stage.answerText} ${unit}`, `${stage.answerText} ${word}`, `x = ${stage.answerText} ${unit}`]) {
          expect(gradeGeoStage(a, stage.id, typed).verdict, `gt.solve/${seed} ${typed}`).toBe('correct')
        }
        expect(gradeGeoStage(a, stage.id, `${stage.answerText} ${unit === 'ft' ? 'm' : 'ft'}`).verdict).toBe('invalid')
      }
      expect(stories).toBeGreaterThan(60)
    },
    HEAVY,
  )

  it(
    'a which-test question has exactly one right button, and a statement question offers one true statement',
    async () => {
      const { METHOD_TEXT } = await import('./unit6Similar')
      for (const seed of SEEDS) {
        const prove = answerOf('geoSimilarTriangles', 'gt.prove', seed)
        const stage = prove.stages[0]!
        expect(stage.choices!.map((c) => c.text)).toEqual(Object.values(METHOD_TEXT))
        expect(stage.choices!.filter((c) => c.id === stage.answerText)).toHaveLength(1)
        const solve = answerOf('geoSimilarTriangles', 'gt.solve', seed)
        const statement = solve.stages[0]!
        expect(statement.kind).toBe('choice')
        // Every choice keeps the first triangle as written, so no other choice is the same correspondence.
        const firsts = new Set(statement.choices!.map((c) => c.text.split(' ~ ')[0]))
        expect(firsts.size, `gt.solve/${seed}`).toBe(1)
        expect(new Set(statement.choices!.map((c) => c.text)).size).toBe(statement.choices!.length)
      }
    },
    HEAVY,
  )
})

describe('the shadow figures', () => {
  it(
    'both shadows sit on dimension lines below the ground, so a shadow length never reads as the sun’s ray',
    () => {
      let shadows = 0
      for (let seed = 1; seed <= 300; seed++) {
        const a = answerOf('geoSimilarTriangles', 'gt.solve', seed)
        if (!/casts a shadow/.test(a.prompt)) continue
        shadows += 1
        // The two shadows are the labeled segments lying on the ground (both ends at height 0): both below.
        const y = (id: string) => a.figure!.points.find((pt) => pt.id === id)!.y
        const ground = (a.figure!.segments ?? []).filter((s) => s.label && y(s.from) === 0 && y(s.to) === 0)
        expect(ground.length, `gt.solve/${seed}`).toBe(2)
        for (const s of ground) expect(s.labelSide, `gt.solve/${seed} ${s.from}${s.to}`).toBe('below')
      }
      expect(shadows).toBeGreaterThan(20)
    },
    HEAVY,
  )
})
