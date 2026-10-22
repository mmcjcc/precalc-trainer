/**
 * Honors geometry Unit 7, first half (right triangles). Every seed grades its own answers, keeps the promised trap as a
 * real candidate, leaves every answer out of everything she can read before she answers (a radical binds the number it
 * touches: a side of 6√2 does not show a leg of 6), never asks for a number the problem already gives (a rounded
 * answer included: a 13-foot ramp may not reach 13.0 feet), and reads as English. Examples on the catalog entries, the
 * rule cards and the format hints never show an answer a template can generate (the 2000-seed sweep). The
 * distributions, the cases, the letters, the turns and mirrors, and every equal form of a right answer are checked too.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import type { GeometryAnswer, RuleCard } from '@/content/types'
import type { ErrorPatternId, ModuleId } from '@/shared/types'
import { readGeoAnswer, sameGeoValue } from './answer'
import { GEO_UNIT7_MISTAKE_IDS, exampleShowsAnswer, exposedExact, gradeGeoStage, stageDisplay } from './grade'
import { GEO_RULE_FOR } from './rules'
import { PYTHAGOREAN_RULES, RIGHT_SIMILAR_RULES, SPECIAL_RIGHT_RULES } from './unit7Rules'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000
const SWEEP = 600_000
/** Numbers and radicals that are examples somewhere a Unit 7 student can see them, so no part may have them as its answer. */
const RESERVED_NUMBERS = [0, 1, 43, 43.7, 43.71, 90, 180]
const RESERVED_TEXT = ['3√11', '(3√11)/2']

const TEMPLATES: { module: ModuleId; template: string; cards: RuleCard[] }[] = [
  { module: 'geoRightSimilar', template: 'rs.mean', cards: RIGHT_SIMILAR_RULES },
  { module: 'geoRightSimilar', template: 'rs.altitude', cards: RIGHT_SIMILAR_RULES },
  { module: 'geoPythagorean', template: 'py.side', cards: PYTHAGOREAN_RULES },
  { module: 'geoPythagorean', template: 'py.classify', cards: PYTHAGOREAN_RULES },
  { module: 'geoPythagorean', template: 'py.apply', cards: PYTHAGOREAN_RULES },
  { module: 'geoSpecialRight', template: 'sp.special', cards: SPECIAL_RIGHT_RULES },
]
const FIGURED = ['rs.altitude', 'py.side', 'py.apply', 'sp.special']

function answerOf(module: ModuleId, template: string, seed: number): GeometryAnswer {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${template}/${seed} is ${p.answer.type}`)
  return p.answer
}

/** Every way an answer is written: as stored, a real minus, a radical fraction without parentheses, a whole rounded answer without its zeros. */
function spellings(display: string): string[] {
  const out = [display, display.replace(/-/g, '−')]
  const frac = /^\((\d*√\d+)\)\/(\d+)$/.exec(display)
  if (frac) out.push(`${frac[1]}/${frac[2]}`)
  const whole = /^(\d+)\.0+$/.exec(display)
  if (whole) out.push(whole[1]!)
  return out
}

/** A word answer is found in any case; a number as its own token, a radical binding the number it touches. */
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

/** English the student reads: no article before a number, plurals that agree, and no sentence opening on a symbol. */
function englishProblems(text: string): string[] {
  const out: string[] = []
  if (/\b[Aa]n? \d/.test(text)) out.push(`article before a number: ${text}`)
  if (/(?<![\d.])1 (feet|inches|meters|yards|miles|kilometers|units)\b/.test(text)) out.push(`plural: ${text}`)
  if (/(?<![\d.])([02-9]|\d{2,}) (foot|inch|meter|yard|mile|kilometer|unit)\b(?!-)/.test(text)) out.push(`singular: ${text}`)
  for (const s of sentences(text)) if (!/^[A-Z]/.test(s)) out.push(`sentence starts with “${s.slice(0, 14)}”`)
  return out
}

/** What she can read before she answers anything: the prompt, the figure's words and labels, hints, nudges, notes. */
function beforeBlob(a: GeometryAnswer): string {
  const before = [a.prompt, a.figure.ariaLabel, ...(a.lines ?? [])]
  for (const stage of a.stages) before.push(stage.hint, stage.nudge, stage.note ?? '')
  for (const pt of a.figure.points) before.push(pt.label ?? '')
  for (const s of a.figure.segments ?? []) before.push(s.label ?? '')
  for (const g of a.figure.angles ?? []) before.push(g.label ?? '')
  return before.join('\n')
}

/** Every number or radical the problem gives, in the prompt or on the figure, as an exact value. */
function givenValues(a: GeometryAnswer) {
  const texts = [a.prompt, ...(a.figure.segments ?? []).map((s) => s.label ?? ''), ...(a.figure.angles ?? []).map((g) => g.label ?? ''), ...a.figure.points.map((p) => p.label ?? '')]
  const out: NonNullable<ReturnType<typeof valueOf>>[] = []
  for (const t of texts) for (const m of t.matchAll(/(\d+(?:\.\d+)?)?√(\d+)|\d+(?:\.\d+)?/g)) {
    const v = valueOf(m[0])
    if (v) out.push(v)
  }
  return out
}

function valueOf(text: string) {
  const r = readGeoAnswer(text)
  return r.ok && r.value.kind === 'qty' ? r.value : null
}

describe('reading what is on screen, the Unit 7 way', () => {
  it('a radical binds the number it touches, and a decimal is not a whole number', () => {
    expect(exposedExact('The hypotenuse is 6√2.', '6')).toBe(false)
    expect(exposedExact('The hypotenuse is 6√2.', '6√2')).toBe(true)
    expect(exposedExact('A leg of √3', '3')).toBe(false)
    expect(exposedExact('12√3 and 2√3', '2√3')).toBe(true)
    expect(exposedExact('12√3', '2√3')).toBe(false)
    expect(exposedExact('AD = x + 6', '6')).toBe(true)
    expect(exposedExact('it rounds to 6.5 feet', '6')).toBe(false)
    expect(exposedExact('so x = 6.', '6')).toBe(true)
    expect(exposedExact('P (6, 2)', '6')).toBe(true)
  })
})

describe('geometry unit 7 registration', () => {
  it('puts the three modules in Unit 7 order, after Unit 6', { timeout: HEAVY }, () => {
    const similar = getModule('geoRightSimilar')
    const pyth = getModule('geoPythagorean')
    const special = getModule('geoSpecialRight')
    expect([similar.title, pyth.title, special.title]).toEqual(['Similarity in right triangles', 'The Pythagorean Theorem and its converse', 'Special right triangles'])
    expect([similar.order, pyth.order, special.order]).toEqual([24, 25, 26])
    expect(similar.order).toBeGreaterThan(getModule('geoProportionalParts').order)
    expect(similar.templates.map((t) => t.id)).toEqual(['rs.mean', 'rs.altitude'])
    expect(pyth.templates.map((t) => t.id)).toEqual(['py.side', 'py.classify', 'py.apply'])
    expect(special.templates.map((t) => t.id)).toEqual(['sp.special'])
    for (const mod of [similar, pyth, special]) for (const t of mod.templates) expect(t.title, t.id).not.toBe(mod.title)
    const sample = generateProblem('geoPythagorean', 'py.side', 1)
    expect(sample.kind).toBe('geometry')
    for (const mod of [similar, pyth, special]) {
      expect(mod.progress(sample, null, false)).toMatchObject({ stage: 0, total: 1 })
      expect(mod.nextStep(sample, null, false)).toBeNull()
    }
  })

  it('seed 1 of each template promises the trap written for it', { timeout: HEAVY }, () => {
    const want: Record<string, [ModuleId, ErrorPatternId, string]> = {
      'rs.mean': ['geoRightSimilar', 'geo_mean_not_rooted', '324'],
      'rs.altitude': ['geoRightSimilar', 'geo_geometric_as_arithmetic', '9'],
      'py.side': ['geoPythagorean', 'geo_distance_not_squared', '14'],
      'py.classify': ['geoPythagorean', 'geo_converse_wrong_side', 'acute'],
      'py.apply': ['geoPythagorean', 'trig_pythag_subtracted', '66'],
      'sp.special': ['geoSpecialRight', 'trig_special_45_two', '13/2'],
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
        for (const n of a.lengths) expect(Number.isInteger(n) && n > 0, `${where} length ${n}`).toBe(true)
        if (FIGURED.includes(template)) expect(a.figure.points.length, where).toBeGreaterThan(0)
        if (a.figure.points.length > 0) expect(a.figure.ariaLabel.length, where).toBeGreaterThan(0)
        const blob = beforeBlob(a)
        const displays = a.stages.map((stage) => stageDisplay(stage))
        for (const [i, stage] of a.stages.entries()) {
          expect(cardIds.has(stage.ruleCard), `${where} card ${stage.ruleCard}`).toBe(true)
          expect(gradeGeoStage(a, stage.id, stage.answerText).verdict, `${where} ${stage.id}`).toBe('correct')
          const display = stageDisplay(stage)
          expect(shows(blob, display), `${where} shows “${display}”`).toBe(false)
          expect(RESERVED_TEXT.includes(stage.answerText), `${where} reserved ${stage.answerText}`).toBe(false)
          for (const line of stage.reveal) {
            expect(blob.includes(line), `${where} reveal is on screen`).toBe(false)
            // A worked line shows its own answer, never a later part's.
            for (const later of displays.slice(i + 1)) expect(shows(line, later), `${where} ${stage.id} worked line shows ${later}`).toBe(false)
          }
          const garbage = stage.kind === 'choice' ? '' : '???'
          expect(gradeGeoStage(a, stage.id, garbage).verdict, `${where} garbage`).toBe('invalid')
          for (const trap of stage.traps) {
            const g = gradeGeoStage(a, stage.id, trap.text)
            expect(g.verdict === 'mistake' && g.mistake === trap.id, `${where} ${stage.id} ${trap.id}`).toBe(true)
            for (const other of displays) expect(shows(trap.witness, other), `${where} ${trap.id} witness shows “${other}”`).toBe(false)
            expect(englishProblems(trap.witness), `${where} ${trap.id} witness`).toEqual([])
          }
          // No choice's button text is printed in the prompt, in any case.
          for (const choice of stage.choices ?? []) expect(a.prompt.toLowerCase().includes(choice.text.toLowerCase()), `${where} prompt prints “${choice.text}”`).toBe(false)
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
        if (a.stages.some((s) => s.label === 'x')) expect(a.prompt, where).toMatch(/\bx\b/)
      }
    },
    HEAVY,
  )

  it(
    'no answer, exact or rounded, is reserved, zero or less, or a number the problem gives',
    () => {
      for (const seed of SEEDS) {
        const a = answerOf(module, template, seed)
        const given = givenValues(a)
        for (const stage of a.stages) {
          if (stage.kind !== 'number') continue
          const v = valueOf(stage.answerText)!
          expect(v, `${template}/${seed}`).not.toBeNull()
          const n = (v.q.n / v.q.d) * Math.sqrt(v.q.rad)
          expect(n, `${template}/${seed} ${stage.id} positive`).toBeGreaterThan(0)
          if (v.q.rad === 1) expect(RESERVED_NUMBERS.includes(n), `${template}/${seed} reserved ${stage.answerText}`).toBe(false)
          if (stage.round !== undefined) {
            // A rounded answer may not equal a number she was given (the 13-foot ramp that reached 13.0 feet).
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

  it(
    'what she is told when she retries never shows an answer',
    () => {
      for (const seed of SEEDS.slice(0, 150)) {
        const a = answerOf(module, template, seed)
        const displays = a.stages.map((stage) => stageDisplay(stage))
        for (const [i, stage] of a.stages.entries()) {
          const tries: string[] = stage.kind === 'choice' ? ['', 'not-a-choice'] : ['???', '1001', '0.001', `${stage.answerText}°`, 'x', '-4']
          if (stage.kind === 'number') {
            const v = valueOf(stage.answerText)!
            const n = (v.q.n / v.q.d) * Math.sqrt(v.q.rad)
            tries.push(n.toFixed(1), n.toFixed(3))
            if (stage.round !== undefined) {
              tries.push(stage.exact!, `${stage.answerText} ${stage.lengthUnit === 'ft' ? 'm' : 'ft'}`, `${stage.answerText} cm`)
              if (stage.round > 0) tries.push(n.toFixed(stage.round - 1))
            } else if (v.q.rad > 1 && v.q.d === 1 && v.q.n > 1) {
              tries.push(`sqrt(${v.q.n * v.q.n * v.q.rad})`, `${2 * v.q.n}sqrt(${v.q.rad})/2`)
            }
          }
          for (const text of tries) {
            const g = gradeGeoStage(a, stage.id, text)
            if (g.verdict === 'correct') continue
            const said = g.verdict === 'mistake' ? g.witness : g.message
            // This part's answer and every later one; an earlier part is already answered.
            for (const d of displays.slice(i)) expect(shows(said, d), `${template}/${seed} ${stage.id} “${text}” → “${said}” shows ${d}`).toBe(false)
          }
        }
      }
    },
    HEAVY,
  )
})

describe('geometry unit 7 trap coverage', () => {
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
      for (const id of GEO_UNIT7_MISTAKE_IDS) {
        expect(seen.has(id), id).toBe(true)
        const info = ERROR_PATTERNS[id]
        expect(info.id).toBe(id)
        expect(info.lesson.length, id).toBeGreaterThan(40)
        expect(info.example, id).toContain('✗')
        expect(info.example, id).toContain('→')
        expect(englishProblems(info.lesson), id).toEqual([])
        // Lessons and examples carry no digit, so no example can be an answer.
        expect(`${info.title} ${info.lesson} ${info.example}`, id).not.toMatch(/\d/)
      }
      // The converse slips can be named where the answer is a kind of triangle: their words never name a kind.
      for (const id of ['geo_converse_wrong_side', 'geo_triangle_inequality_skipped', 'geo_acute_obtuse_swapped', 'geo_coefficient_not_squared'] as const) {
        const info = ERROR_PATTERNS[id]
        expect(`${info.title} ${info.lesson} ${info.example}`.toLowerCase(), id).not.toMatch(/acute|right|obtuse|not a triangle/)
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
        'geo_leg_far_segment',
        'geo_altitude_leg_mixed',
        'geo_geometric_as_arithmetic',
        'geo_mean_not_rooted',
        'trig_pythag_added',
        'trig_pythag_subtracted',
        'trig_side_not_rooted',
        'geo_converse_wrong_side',
        'geo_triangle_inequality_skipped',
        'geo_acute_obtuse_swapped',
        'geo_coefficient_not_squared',
        'trig_special_root3_two_swapped',
        'trig_special_45_two',
        'geo_half_not_taken',
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
          const displays = a.stages.map((s) => stageDisplay(s))
          for (const stage of a.stages) {
            const display = stageDisplay(stage)
            if (shows([stage.hint, stage.nudge, stage.note ?? ''].join('\n'), display)) clashes.push(`${template}/${seed} ${display}: hint`)
            for (const trap of stage.traps) {
              const info = ERROR_PATTERNS[trap.id]
              if (shows(`${info.title}\n${info.lesson}\n${info.example}`, display) || exampleShowsAnswer(info.example, display)) clashes.push(`${template}/${seed} ${display}: ${trap.id}`)
              for (const d of displays) if (shows(trap.witness, d)) clashes.push(`${template}/${seed} ${d}: ${trap.id} witness`)
            }
            for (const card of results) {
              if (shows(card.example, display) || exampleShowsAnswer(card.example, display) || (card.result && exampleShowsAnswer(card.result, display))) {
                clashes.push(`${template}/${seed} ${display}: rule ${card.id}`)
              }
              // A body may name every kind of triangle; it may not hold a number that is the answer.
              if (!/[A-Za-z]{4}/.test(display) && shows(card.body, display)) clashes.push(`${template}/${seed} ${display}: rule body ${card.id}`)
            }
          }
        }
      }
      expect(clashes.slice(0, 8)).toEqual([])
    },
    SWEEP,
  )

  it('the format hints and the examples do not work seed 1’s problem', { timeout: HEAVY }, () => {
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

  it('the cards name the theorems and corollaries the way the book does', () => {
    const titles = [...RIGHT_SIMILAR_RULES, ...PYTHAGOREAN_RULES, ...SPECIAL_RIGHT_RULES].map((c) => c.title)
    for (const name of ['Geometric mean', 'Corollary 1: the altitude', 'Corollary 2: each leg', 'Pythagorean Theorem', 'Converse of the Pythagorean Theorem', 'Triangle Inequality', '45°-45°-90° Triangle Theorem', '30°-60°-90° Triangle Theorem']) {
      expect(titles, name).toContain(name)
    }
  })
})

describe('unit 7 variety', () => {
  it(
    'each template shows at least 25 distinct problems over 300 seeds, and no answer is more than a tenth of them',
    () => {
      for (const { module, template } of TEMPLATES) {
        const prompts = new Set<string>()
        const whole = new Map<string, number>()
        const parts = new Map<string, number>()
        for (const seed of SEEDS) {
          const a = answerOf(module, template, seed)
          prompts.add(a.prompt)
          whole.set(a.expectedDisplay, (whole.get(a.expectedDisplay) ?? 0) + 1)
          for (const s of a.stages) parts.set(`${s.label} ${s.answerText}`, (parts.get(`${s.label} ${s.answerText}`) ?? 0) + 1)
        }
        expect(prompts.size, template).toBeGreaterThanOrEqual(25)
        if (template === 'py.classify') continue
        expect(Math.max(...whole.values()) / SEEDS.length, template).toBeLessThanOrEqual(0.1)
        expect(Math.max(...parts.values()) / SEEDS.length, template).toBeLessThanOrEqual(0.1)
      }
    },
    HEAVY,
  )

  it(
    'acute, right, obtuse and no triangle are each 15 to 35 percent of any 300 seeds in a row',
    () => {
      for (const start of [1, 2, 101, 1001]) {
        const counts = new Map<string, number>()
        for (let seed = start; seed < start + 300; seed++) {
          const id = answerOf('geoPythagorean', 'py.classify', seed).stages[0]!.answerText
          counts.set(id, (counts.get(id) ?? 0) + 1)
        }
        for (const id of ['acute', 'right', 'obtuse', 'none']) {
          const share = (counts.get(id) ?? 0) / 300
          expect(share, `${id} from ${start}`).toBeGreaterThanOrEqual(0.15)
          expect(share, `${id} from ${start}`).toBeLessThanOrEqual(0.35)
        }
      }
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
          const letters = p.answer.figure.points.filter((pt) => pt.label).map((pt) => pt.id).join('') + (p.answer.prompt.match(/\b[A-Z]{2,}\b/g) ?? []).join('')
          expect(letters, p.id).not.toMatch(/[IOJKLMNX]/)
        }
        cases.set(template, seen)
      }
      expect([...cases.get('rs.mean')!].sort()).toEqual(['mean', 'reverse'])
      expect([...cases.get('rs.altitude')!].sort()).toEqual(['ac', 'ax', 'hx', 'pa', 'pc', 'ph', 'pq', 'px', 'quad'])
      expect([...cases.get('py.side')!].sort()).toEqual(['grid', 'isosceles', 'rectangle', 'rhombus', 'triangle'])
      expect([...cases.get('py.classify')!].sort()).toEqual(['acute', 'none', 'obtuse', 'right'])
      expect([...cases.get('py.apply')!].sort()).toEqual(['field', 'kite', 'ladder', 'ramp', 'screen', 'ship'])
      expect([...cases.get('sp.special')!].sort()).toEqual(['equilateral', 'isoRight', 'rectangle30', 'rhombus60', 'square', 'tri30', 'tri45'])
    },
    HEAVY,
  )

  it(
    'the figures turn and mirror: the right angle sits in every direction from the middle, and both orientations appear',
    () => {
      for (const template of ['rs.altitude', 'py.side', 'sp.special'] as const) {
        const module: ModuleId = template === 'rs.altitude' ? 'geoRightSimilar' : template === 'py.side' ? 'geoPythagorean' : 'geoSpecialRight'
        const quarters = new Set<string>()
        const turns = new Set<number>()
        for (const seed of SEEDS) {
          const a = answerOf(module, template, seed)
          const right = (a.figure.angles ?? []).find((g) => g.right)
          if (!right || a.figure.grid) continue
          const pts = a.figure.points
          const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
          const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
          const v = pts.find((p) => p.id === right.vertex)!
          quarters.add(`${v.x >= cx ? 'right' : 'left'} ${v.y >= cy ? 'top' : 'bottom'}`)
          // The orientation of the right angle's corner: from one arm to the other, counterclockwise or clockwise.
          const f = pts.find((p) => p.id === right.from)!
          const t = pts.find((p) => p.id === right.to)!
          turns.add(Math.sign((f.x - v.x) * (t.y - v.y) - (f.y - v.y) * (t.x - v.x)))
        }
        // The altitude's figure keeps the hypotenuse's pieces on dimension lines, which GeoFigure draws below a segment
        // (to its right when it stands upright), so its right angle sits above or to the left of the hypotenuse: three
        // of the four directions. The other figures put it anywhere.
        if (template === 'rs.altitude') expect(quarters.size, template).toBeGreaterThanOrEqual(3)
        else expect([...quarters].sort(), template).toEqual(['left bottom', 'left top', 'right bottom', 'right top'])
        expect([...turns].sort(), template).toEqual([-1, 1])
      }
    },
    HEAVY,
  )
})

describe('a true answer is never graded wrong', () => {
  it(
    'every equal exact form is right, an unsimplified radical or a decimal is a note, never a wrong answer',
    () => {
      let radicals = 0
      for (const { module, template } of TEMPLATES.filter((t) => t.template !== 'py.classify' && t.template !== 'py.apply')) {
        for (const seed of SEEDS.slice(0, 150)) {
          const a = answerOf(module, template, seed)
          for (const stage of a.stages) {
            const v = valueOf(stage.answerText)!.q
            const forms = [stage.answerText, `${stage.label === 'x' ? 'x = ' : ''}${stage.answerText}`]
            if (v.rad > 1) {
              radicals++
              const coeff = v.n === 1 ? '' : `${v.n}`
              const ascii = `${coeff}${coeff ? '*' : ''}sqrt(${v.rad})${v.d > 1 ? `/${v.d}` : ''}`
              forms.push(ascii, ascii.replace('*', ' '))
              // The same value not in simplest form: a note that asks for simplest form, not a mistake.
              const notes = [...(v.n > 1 ? [`sqrt(${v.n * v.n * v.rad})${v.d > 1 ? `/${v.d}` : ''}`] : []), `${2 * v.n}sqrt(${v.rad})/${2 * v.d}`]
              for (const n of notes) {
                const g = gradeGeoStage(a, stage.id, n)
                expect(g.verdict, `${template}/${seed} ${n}`).toBe('invalid')
                if (g.verdict === 'invalid') expect(g.message, n).toMatch(/simplest|Reduce|perfect-square/)
              }
              // A calculator decimal close to the answer: exact, please.
              const dec = gradeGeoStage(a, stage.id, ((v.n / v.d) * Math.sqrt(v.rad)).toFixed(3))
              expect(dec.verdict, `${template}/${seed} decimal`).toBe('invalid')
              if (dec.verdict === 'invalid') expect(dec.message).toMatch(/exact value/)
            } else if (v.d > 1) {
              forms.push((v.n / v.d).toString())
            }
            for (const f of forms) expect(gradeGeoStage(a, stage.id, f).verdict, `${template}/${seed} ${f}`).toBe('correct')
          }
        }
      }
      expect(radicals).toBeGreaterThan(150)
    },
    HEAVY,
  )

  it(
    'a rounded answer: correctly rounded is right, more places that round to it are right, fewer places or the exact radical is a note',
    () => {
      const unitWords: Record<string, string> = { ft: 'feet', in: 'inches', m: 'meters', yd: 'yards', km: 'kilometers', mi: 'miles' }
      for (const seed of SEEDS) {
        const a = answerOf('geoPythagorean', 'py.apply', seed)
        const stage = a.stages[0]!
        const places = stage.round!
        const exact = valueOf(stage.exact!)!.q
        const value = (exact.n / exact.d) * Math.sqrt(exact.rad)
        for (const typed of [stage.answerText, `${stage.answerText} ${stage.lengthUnit}`, `${stage.answerText} ${unitWords[stage.lengthUnit!]}`, value.toFixed(places + 2)]) {
          expect(gradeGeoStage(a, stage.id, typed).verdict, `py.apply/${seed} ${typed}`).toBe('correct')
        }
        // The exact radical is a note (round it); a whole-number length typed exactly is simply right.
        expect(gradeGeoStage(a, stage.id, stage.exact!).verdict, `py.apply/${seed} exact`).toBe(exact.rad > 1 ? 'invalid' : 'correct')
        if (places > 0 && Number(value.toFixed(places - 1)) !== Number(stage.answerText)) {
          const g = gradeGeoStage(a, stage.id, value.toFixed(places - 1))
          expect(g.verdict, `py.apply/${seed} fewer places`).toBe('invalid')
          if (g.verdict === 'invalid') expect(g.message).toMatch(/rounded too far/)
        }
        expect(gradeGeoStage(a, stage.id, `${stage.answerText} cm`).verdict, `py.apply/${seed} other unit`).toBe('invalid')
        expect(gradeGeoStage(a, stage.id, `${stage.answerText}°`).verdict).toBe('invalid')
        // A slip's rounded value is named; the same slip with more places is named too.
        for (const trap of stage.traps) {
          expect(gradeGeoStage(a, stage.id, trap.text)).toMatchObject({ verdict: 'mistake', mistake: trap.id })
        }
      }
    },
    HEAVY,
  )
})
