/**
 * Honors geometry Unit 5 (quadrilaterals). Every seed grades its own answers, keeps the promised trap as a
 * real candidate, leaves the answer out of anything she can read before she answers, and reads as English.
 * Examples on the catalog entries, the rule cards, and the format hints never show an answer a template can
 * generate for that part (the 2000-seed sweep), and the distributions match the brief.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import type { GeometryAnswer, RuleCard } from '@/content/types'
import type { ErrorPatternId, ModuleId } from '@/shared/types'
import { GEO_UNIT5_MISTAKE_IDS, containsAnswer, exampleShowsAnswer, exposed, gradeGeoStage, stageDisplay } from './grade'
import { PARALLELOGRAM_RULES, SPECIAL_RULES, TRAPEZOID_RULES } from './unit5Rules'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000
/** Numbers that are examples somewhere a Unit 5 student can see them, so no part may have them as its answer. */
const RESERVED = ['2', '4', '8', '17', '33', '40', '43', '45', '53', '86', '90', '180', '1/4', '-1/4', '-4', '2√3', '2√5', '2√10', '(-4, 1)', '(4, 2)', '(5/2, 11/2)', '(-3/2, -5/2)']

const TEMPLATES: { module: ModuleId; template: string; cards: RuleCard[] }[] = [
  { module: 'geoParallelograms', template: 'gq.props', cards: PARALLELOGRAM_RULES },
  { module: 'geoParallelograms', template: 'gq.prove', cards: PARALLELOGRAM_RULES },
  { module: 'geoParallelograms', template: 'gq.coords', cards: PARALLELOGRAM_RULES },
  { module: 'geoSpecialQuads', template: 'gs.props', cards: SPECIAL_RULES },
  { module: 'geoSpecialQuads', template: 'gs.classify', cards: SPECIAL_RULES },
  { module: 'geoTrapezoids', template: 'gz.midseg', cards: TRAPEZOID_RULES },
  { module: 'geoTrapezoids', template: 'gz.isosceles', cards: TRAPEZOID_RULES },
]
const NUMERIC = ['gq.props', 'gs.props', 'gz.midseg', 'gz.isosceles']

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
  if (/\b1 (ticks|arcs|arrows|units)\b/.test(text) || /\b([02-9]|\d{2,}) (tick|arc|arrow|unit)\b/.test(text)) out.push(`plural: ${text}`)
  for (const s of sentences(text)) if (!/^[A-Z]/.test(s)) out.push(`sentence starts with “${s.slice(0, 12)}”`)
  return out
}

describe('geometry unit 5 registration', () => {
  it('puts the three modules in Unit 5 order, after the Unit 4 proofs', () => {
    const pg = getModule('geoParallelograms')
    const sq = getModule('geoSpecialQuads')
    const tz = getModule('geoTrapezoids')
    expect([pg.title, sq.title, tz.title]).toEqual(['Parallelograms', 'Rectangles, rhombuses, and squares', 'Trapezoids, kites, and midsegments'])
    expect([pg.order, sq.order, tz.order]).toEqual([18, 19, 20])
    expect(pg.order).toBeGreaterThan(getModule('geoTriangleProofs').order)
    expect(pg.templates.map((t) => t.id)).toEqual(['gq.props', 'gq.prove', 'gq.coords'])
    expect(sq.templates.map((t) => t.id)).toEqual(['gs.props', 'gs.classify'])
    expect(tz.templates.map((t) => t.id)).toEqual(['gz.midseg', 'gz.isosceles'])
    const sample = generateProblem('geoParallelograms', 'gq.props', 1)
    expect(sample.kind).toBe('geometry')
    for (const mod of [pg, sq, tz]) {
      expect(mod.progress(sample, null, false)).toMatchObject({ stage: 0, total: 1 })
      expect(mod.nextStep(sample, null, false)).toBeNull()
    }
  })

  it('seed 1 of each template promises the trap written for it', () => {
    const want: Record<string, [ModuleId, ErrorPatternId]> = {
      'gq.props': ['geoParallelograms', 'geo_diagonal_half_as_whole'],
      'gq.prove': ['geoParallelograms', 'geo_parallelogram_test_missed'],
      'gq.coords': ['geoParallelograms', 'geo_one_pair_half_test'],
      'gs.props': ['geoSpecialQuads', 'geo_rect_rhombus_swapped'],
      'gs.classify': ['geoSpecialQuads', 'geo_not_most_specific'],
      'gz.midseg': ['geoTrapezoids', 'geo_median_as_base'],
      'gz.isosceles': ['geoTrapezoids', 'geo_trapezoid_as_parallelogram'],
    }
    for (const [template, [module, trap]] of Object.entries(want)) {
      const a = answerOf(module, template, 1)
      expect(a.trap, template).toBe(trap)
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
        const where = `${p.id}`
        expect(a.stages.length, where).toBeGreaterThan(0)
        for (const n of a.angles) expect(Number.isInteger(n) && n > 0 && n < 180, `${where} angle ${n}`).toBe(true)
        for (const n of a.lengths) expect(Number.isInteger(n) && n > 0, `${where} length ${n}`).toBe(true)
        if (a.figure.points.length > 0) expect(a.figure.ariaLabel.length, where).toBeGreaterThan(0)
        const before = [a.prompt, a.figure.ariaLabel, ...(a.lines ?? [])]
        for (const stage of a.stages) before.push(stage.hint, stage.nudge, stage.note ?? '')
        for (const pt of a.figure.points) before.push(pt.label ?? '')
        for (const s of a.figure.segments ?? []) before.push(s.label ?? '')
        for (const g of a.figure.angles ?? []) before.push(g.label ?? '')
        const blob = before.join('\n')
        const displays = a.stages.map((stage) => stageDisplay(stage))
        for (const stage of a.stages) {
          expect(cardIds.has(stage.ruleCard), `${where} card ${stage.ruleCard}`).toBe(true)
          expect(gradeGeoStage(a, stage.id, stage.answerText).verdict, `${where} ${stage.id}`).toBe('correct')
          const display = stageDisplay(stage)
          expect(shows(blob, display), `${where} shows “${display}”`).toBe(false)
          expect(containsAnswer(blob, display), `${where} shows “${display}”`).toBe(false)
          expect(RESERVED.includes(stage.answerText), `${where} reserved ${stage.answerText}`).toBe(false)
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
        }
        const promised = a.stages.find((stage) => stage.id === a.trapStage)
        expect(promised?.traps.some((trap) => trap.id === a.trap && trap.text === a.trapAnswer), `${where} ${a.trap}`).toBe(true)
        const g = gradeGeoStage(a, a.trapStage, a.trapAnswer)
        expect(g.verdict === 'mistake' && g.mistake === a.trap, `${where} promised ${a.trap}`).toBe(true)
        expect(englishProblems(a.prompt), where).toEqual([])
        expect(englishProblems(a.figure.ariaLabel), `${where} aria`).toEqual([])
        for (const stage of a.stages) {
          for (const line of [stage.hint, stage.nudge, ...stage.reveal]) expect(englishProblems(line), `${where} ${stage.id}`).toEqual([])
        }
        expect(a.prompt, where).not.toMatch(/\b[Aa]n? \d/)
        expect(`${a.prompt}\n${a.figure.ariaLabel}`, where).not.toMatch(/\bmatch(?:es|ing)?\b/i)
        if (NUMERIC.includes(template)) {
          expect(a.stages[0]!.id, where).toBe('x')
          expect(a.prompt, where).toMatch(/Find x(, then [^.]+)?\.$/)
          expect(a.prompt, where).not.toMatch(/congruent/i)
        }
      }
    },
    HEAVY,
  )
})

describe('geometry unit 5 trap coverage', () => {
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
      for (const id of GEO_UNIT5_MISTAKE_IDS) {
        expect(seen.has(id), id).toBe(true)
        const info = ERROR_PATTERNS[id]
        expect(info.id).toBe(id)
        expect(info.lesson.length, id).toBeGreaterThan(40)
        expect(info.example, id).toContain('✗')
        expect(info.example, id).toContain('→')
        expect(englishProblems(info.lesson), id).toEqual([])
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
        const results = cards.map((card) => ({ id: card.id, example: card.example ?? '', result: (card.example ?? '').split(/=|→/).pop()!.trim() }))
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
            }
          }
        }
      }
      expect(clashes.slice(0, 8)).toEqual([])
    },
    HEAVY,
  )
})

describe('unit 5 variety', () => {
  it(
    'each numeric template shows ten or more values of x over 300 seeds, none on more than a fifth of them',
    () => {
      for (const { module, template } of TEMPLATES.filter((t) => NUMERIC.includes(t.template))) {
        const xs = new Map<string, number>()
        for (const seed of SEEDS) {
          const x = answerOf(module, template, seed).stages[0]!.answerText
          xs.set(x, (xs.get(x) ?? 0) + 1)
        }
        expect(xs.size, template).toBeGreaterThanOrEqual(10)
        expect(Math.max(...xs.values()) / SEEDS.length, template).toBeLessThanOrEqual(0.2)
      }
    },
    HEAVY,
  )

  it(
    'each proof answer is 12 to 25 percent of the seeds, and every way of not proving it appears',
    () => {
      const answers = new Map<string, number>()
      const families = new Set<string>()
      for (const seed of SEEDS) {
        const p = generateProblem('geoParallelograms', 'gq.prove', seed)
        if (p.answer.type !== 'geometry') throw new Error('prove')
        const answer = p.answer.stages[0]!.answerText
        answers.set(answer, (answers.get(answer) ?? 0) + 1)
        if (answer === 'none') families.add(String(p.params.case))
      }
      for (const id of ['parallel', 'sides', 'onePair', 'angles', 'diagonals', 'none']) {
        const share = (answers.get(id) ?? 0) / SEEDS.length
        expect(share, id).toBeGreaterThanOrEqual(0.12)
        expect(share, id).toBeLessThanOrEqual(0.25)
      }
      // A figure that does not prove it is drawn sometimes as a parallelogram and sometimes as the shape with the same marks.
      for (const f of ['mixed-pgram', 'mixed-other', 'oneCongruent-pgram', 'oneCongruent-other', 'oneParallel-pgram', 'oneParallel-other', 'consecutive', 'oneDiagonal-pgram', 'oneDiagonal-other']) {
        expect(families.has(f), f).toBe(true)
      }
    },
    HEAVY,
  )

  it(
    'every case, every mode, and every name shows up, and the letters never use I, O, J, K, L, M, N, or X',
    () => {
      const cases = new Map<string, Set<string>>()
      const names = new Set<string>()
      for (const { module, template } of TEMPLATES) {
        const seen = new Set<string>()
        for (const seed of SEEDS) {
          const p = generateProblem(module, template, seed)
          if (p.answer.type !== 'geometry') throw new Error(template)
          seen.add(String(p.params.case).split('-')[0]!)
          if (template === 'gs.classify' && p.answer.stages.length === 1) names.add(p.answer.stages[0]!.answerText)
          const letters = p.answer.figure.points.map((pt) => pt.id).join('') + (p.answer.prompt.match(/\b[A-Z]{2,}\b/g) ?? []).join('')
          expect(letters, p.id).not.toMatch(/[IOJKLMNX]/)
        }
        cases.set(template, seen)
      }
      expect([...cases.get('gq.props')!].sort()).toEqual(['consAngles', 'diagHalves', 'diagWhole', 'oppAngles', 'sides'])
      expect([...cases.get('gq.coords')!].sort()).toEqual(['lengthsNo', 'lengthsYes', 'midNo', 'midYes', 'mixed', 'slopesNo', 'slopesYes'])
      expect([...cases.get('gs.props')!].sort()).toEqual(['rectAngles', 'rectCorner', 'rectDiagHalf', 'rectDiagWhole', 'rhombusAngles', 'rhombusBisect', 'rhombusHalves', 'squareAngle', 'squareDiag'])
      expect([...cases.get('gs.classify')!].sort()).toEqual(['coords', 'facts', 'marks', 'must'])
      expect([...cases.get('gz.midseg')!].sort()).toEqual(['medianBases', 'medianOne', 'medianSum', 'triangleBase', 'triangleBoth'])
      expect([...cases.get('gz.isosceles')!].sort()).toEqual(['baseAngles', 'diagonals', 'kiteEnds', 'kiteSides', 'oppositeAngles'])
      expect([...names].sort()).toEqual(['isoTrapezoid', 'kite', 'parallelogram', 'quadrilateral', 'rectangle', 'rhombus', 'square', 'trapezoid'])
    },
    HEAVY,
  )
})

describe('the figure is turned and mirrored from the seed', () => {
  it(
    'the first vertex of each figure sits in every quarter of the picture over 300 seeds',
    () => {
      for (const { module, template } of TEMPLATES) {
        const quarters = new Set<string>()
        for (const seed of SEEDS) {
          const fig = answerOf(module, template, seed).figure
          if (fig.points.length === 0) continue
          const outline = fig.points.slice(0, template === 'gz.midseg' && fig.points.length === 5 ? 3 : 4)
          const cx = outline.reduce((s, p) => s + p.x, 0) / outline.length
          const cy = outline.reduce((s, p) => s + p.y, 0) / outline.length
          quarters.add(`${outline[0]!.x > cx ? 'right' : 'left'}-${outline[0]!.y > cy ? 'top' : 'bottom'}`)
        }
        expect([...quarters].sort(), template).toEqual(['left-bottom', 'left-top', 'right-bottom', 'right-top'])
      }
    },
    HEAVY,
  )
})

describe('a true name is never graded wrong', () => {
  it(
    'on a most-specific question every truer, more general name is the named slip; on a must question Yes on a true name is right',
    async () => {
      const { MORE_GENERAL } = await import('./unit5Special')
      for (let seed = 1; seed <= 600; seed++) {
        const a = answerOf('geoSpecialQuads', 'gs.classify', seed)
        if (a.stages.length === 1) {
          const answer = a.stages[0]!.answerText as keyof typeof MORE_GENERAL
          for (const general of MORE_GENERAL[answer]) {
            expect(gradeGeoStage(a, 'a', general), `gs.classify/${seed} ${general}`).toMatchObject({ verdict: 'mistake', mistake: 'geo_not_most_specific' })
          }
        } else {
          // Must it be a rectangle? Must it be a rhombus? A square is both.
          const [rect, rhombus] = a.stages as [GeometryAnswer['stages'][number], GeometryAnswer['stages'][number]]
          expect([rect.label, rhombus.label]).toEqual(['Rectangle?', 'Rhombus?'])
          const isSquare = rect.answerText === 'yes' && rhombus.answerText === 'yes'
          if (isSquare) {
            expect(gradeGeoStage(a, 'a', 'no')).toMatchObject({ verdict: 'mistake', mistake: 'geo_square_not_rectangle' })
            expect(gradeGeoStage(a, 'b', 'no')).toMatchObject({ verdict: 'mistake', mistake: 'geo_square_not_rectangle' })
          }
          for (const stage of a.stages) expect(gradeGeoStage(a, stage.id, stage.answerText).verdict).toBe('correct')
        }
      }
    },
    HEAVY,
  )
})
