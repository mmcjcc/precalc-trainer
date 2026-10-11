import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import type { ProblemInstance } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { ratEquals } from '@/notation'
import {
  RF_KEYS,
  RF_MISTAKE_IDS,
  RF_RULE_FOR,
  RF_RULES,
  canonicalEntries,
  equationFromText,
  featureTraps,
  featuresFromText,
  gradeAsymptote,
  gradeDomain,
  gradeHoles,
  gradeRfStage,
  gradeSolution,
  gradeVertical,
  gradeXIntercepts,
  gradeYIntercept,
  solutionTraps,
  type RationalFnsAnswer,
  type RfFeatures,
  type RfMistakeId,
} from '@/content/modules/rationalFns'

const SEEDS = 300
const LOOP_TIMEOUT = 120_000

const TEMPLATES = [
  ['rf.features', 'features'],
  ['rf.asymptote', 'asymptote'],
  ['rf.equation', 'equation'],
] as const

/** Words that would hand her the method or the trap. The sentence above the work may not use them. */
const METHOD_WORDS = /cancel|leading|remainder|extraneous|reduced|quotient|\bdegree\b|synthetic|shared factor/i

function answerOf(p: ProblemInstance): RationalFnsAnswer {
  if (p.answer.type !== 'rationalFns') throw new Error(`${p.id}: not a rational function`)
  return p.answer
}

function mistake(id: RfMistakeId, grade: { verdict: string; mistake?: string }) {
  expect(grade).toMatchObject({ verdict: 'mistake', mistake: id })
}

describe('rational functions, by hand', () => {
  const famous = featuresFromText('(x^2 - 9)/(x^2 - x - 6)')

  it('reads (x^2 - 9)/(x^2 - x - 6): hole (3, 6/5), vertical asymptote x = -2, horizontal y = 1', () => {
    expect(famous.holesText).toBe('(3, 6/5)')
    expect(famous.holes[0]!.y).toEqual({ n: 6, d: 5 })
    expect(famous.vaText).toBe('x = -2')
    expect(famous.asymptoteKind).toBe('horizontal')
    expect(famous.asymptoteText).toBe('y = 1')
    expect(famous.xIntText).toBe('(-3, 0)')
    expect(famous.yIntText).toBe('(0, 3/2)')
    expect(famous.domainText).toBe('(-inf, -2) U (-2, 3) U (3, inf)')
    expect(famous.degreeNum).toBe(2)
    expect(famous.degreeDen).toBe(2)
    expect(gradeDomain(famous, famous.domainText).verdict).toBe('correct')
    expect(gradeVertical(famous, 'x = -2').verdict).toBe('correct')
    expect(gradeHoles(famous, '(3, 6/5)').verdict).toBe('correct')
    expect(gradeAsymptote(famous, 'y = 1').verdict).toBe('correct')
    expect(gradeXIntercepts(famous, '(-3, 0)').verdict).toBe('correct')
    expect(gradeYIntercept(famous, '(0, 3/2)').verdict).toBe('correct')
  })

  it('names a hole left out of the domain, and a hole written as a vertical asymptote', () => {
    mistake('rf_hole_left_out', gradeDomain(famous, '(-inf, -2) U (-2, inf)'))
    mistake('rf_hole_as_asymptote', gradeVertical(famous, 'x = -2, x = 3'))
    mistake('rf_hole_as_asymptote', gradeVertical(famous, 'x = 3, x = -2'))
  })

  it('names a numerator zero given as a vertical asymptote', () => {
    mistake('rf_asymptote_from_numerator', gradeVertical(famous, 'x = -3'))
  })

  it("names a missing hole and a hole whose height is 0 instead of the reduced value", () => {
    mistake('rf_hole_left_out', gradeHoles(famous, 'none'))
    mistake('rf_hole_y_unreduced', gradeHoles(famous, '(3, 0)'))
    expect(gradeHoles(famous, '(3, 6/5)').verdict).toBe('correct')
  })

  it('names an x-intercept at the canceled zero, and intercepts swapped or written as numbers', () => {
    mistake('rf_intercept_at_hole', gradeXIntercepts(famous, '(-3, 0), (3, 0)'))
    mistake('rf_intercept_swapped', gradeXIntercepts(famous, '-3'))
    mistake('rf_intercept_swapped', gradeXIntercepts(famous, '(0, 3/2)'))
    mistake('rf_intercept_swapped', gradeYIntercept(famous, '3/2'))
    mistake('rf_intercept_swapped', gradeYIntercept(famous, '(-3, 0)'))
  })

  it('uses the leading-coefficient ratio, not the constant terms, when the degrees match', () => {
    mistake('rf_degree_rule', gradeAsymptote(famous, 'y = 0'))
    mistake('rf_ratio_not_leading', gradeAsymptote(famous, 'y = 3/2'))
    expect(gradeAsymptote(famous, 'y = 7').verdict).toBe('wrong')
  })

  it('divides (x^2 - 1)/(x - 2) to the slant line y = x + 2, and names the remainder and the wrong case', () => {
    const slant = featuresFromText('(x^2 - 1)/(x - 2)')
    expect(slant.asymptoteKind).toBe('slant')
    expect(slant.asymptoteText).toBe('y = x + 2')
    expect(slant.remainder).toEqual([{ n: 3, d: 1 }])
    expect(slant.vaText).toBe('x = 2')
    expect(slant.xIntText).toBe('(-1, 0), (1, 0)')
    expect(slant.yIntText).toBe('(0, 1/2)')
    expect(slant.holesText).toBe('none')
    expect(gradeAsymptote(slant, 'y = x + 2').verdict).toBe('correct')
    expect(gradeAsymptote(slant, 'x + 2').verdict).toBe('correct')
    mistake('rf_slant_remainder', gradeAsymptote(slant, 'y = x + 5'))
    mistake('rf_slant_remainder', gradeAsymptote(slant, 'y = x'))
    mistake('rf_slant_remainder', gradeAsymptote(slant, 'y = (x^2 - 1)/(x - 2)'))
    mistake('rf_degree_rule', gradeAsymptote(slant, 'y = 1'))
    mistake('rf_ratio_not_leading', gradeAsymptote(slant, 'y = 1/2'))
    mistake('rf_ratio_not_leading', gradeAsymptote(slant, 'y = (1/2)x'))
  })

  it('reads (2x - 1)/(x - 3) as y = 2, not the constant terms and not y = 0', () => {
    const ratio = featuresFromText('(2x - 1)/(x - 3)')
    expect(ratio.asymptoteText).toBe('y = 2')
    expect(ratio.vaText).toBe('x = 3')
    expect(ratio.xIntText).toBe('(1/2, 0)')
    expect(ratio.yIntText).toBe('(0, 1/3)')
    expect(ratio.holes).toHaveLength(0)
    expect(gradeAsymptote(ratio, 'y = 2').verdict).toBe('correct')
    mistake('rf_degree_rule', gradeAsymptote(ratio, 'y = 0'))
    mistake('rf_ratio_not_leading', gradeAsymptote(ratio, 'y = 1/3'))
    mistake('rf_ratio_not_leading', gradeAsymptote(ratio, 'y = 1'))
  })

  it('puts a hole at (-1, -1/3) when (x + 1) cancels, and a horizontal asymptote y = 0', () => {
    const hole = featuresFromText('(x + 1)/((x + 1)(x - 2))')
    expect(hole.holesText).toBe('(-1, -1/3)')
    expect(hole.vaText).toBe('x = 2')
    expect(hole.asymptoteText).toBe('y = 0')
    expect(hole.xIntText).toBe('none')
    expect(hole.yIntText).toBe('(0, -1/2)')
    expect(hole.degreeNum).toBe(1)
    expect(hole.degreeDen).toBe(2)
    expect(gradeAsymptote(hole, 'y = 0').verdict).toBe('correct')
    expect(gradeXIntercepts(hole, 'none').verdict).toBe('correct')
    mistake('rf_hole_as_asymptote', gradeVertical(hole, 'x = -1, x = 2'))
    mistake('rf_degree_rule', gradeAsymptote(hole, 'y = 1'))
  })

  it('has no y-intercept when x = 0 is a vertical asymptote', () => {
    const noY = featuresFromText('(x - 1)/x')
    expect(noY.yIntercept).toBeNull()
    expect(noY.yIntText).toBe('none')
    expect(noY.vaText).toBe('x = 0')
    expect(noY.xIntText).toBe('(1, 0)')
    expect(noY.asymptoteText).toBe('y = 1')
    expect(gradeYIntercept(noY, 'none').verdict).toBe('correct')
    expect(gradeVertical(noY, 'x = 0').verdict).toBe('correct')
    mistake('rf_intercept_swapped', gradeYIntercept(noY, '(1, 0)'))
    mistake('rf_degree_rule', gradeAsymptote(noY, 'y = 0'))
  })

  it('cancels (x - 2)/(x - 2) to a hole at (2, 1), with no vertical asymptote', () => {
    const cancel = featuresFromText('(x - 2)/(x - 2)')
    expect(cancel.holesText).toBe('(2, 1)')
    expect(cancel.vaText).toBe('none')
    expect(cancel.asymptoteText).toBe('y = 1')
    expect(cancel.xIntText).toBe('none')
    expect(cancel.yIntText).toBe('(0, 1)')
    expect(gradeVertical(cancel, 'none').verdict).toBe('correct')
    expect(gradeHoles(cancel, '(2, 1)').verdict).toBe('correct')
    expect(gradeXIntercepts(cancel, 'none').verdict).toBe('correct')
    mistake('rf_hole_as_asymptote', gradeVertical(cancel, 'x = 2'))
    mistake('rf_hole_y_unreduced', gradeHoles(cancel, '(2, 0)'))
    mistake('rf_hole_left_out', gradeDomain(cancel, '(-inf, inf)'))
    mistake('rf_intercept_at_hole', gradeXIntercepts(cancel, '(2, 0)'))
    mistake('rf_degree_rule', gradeAsymptote(cancel, 'y = 0'))
    mistake('rf_intercept_swapped', gradeYIntercept(cancel, '1'))
  })

  it('gives a bottom-heavy function the horizontal asymptote y = 0', () => {
    const bottom = featuresFromText('1/(x - 1)')
    expect(bottom.degreeNum).toBe(0)
    expect(bottom.degreeDen).toBe(1)
    expect(bottom.asymptoteText).toBe('y = 0')
    expect(bottom.vaText).toBe('x = 1')
    expect(bottom.xIntText).toBe('none')
    expect(bottom.yIntText).toBe('(0, -1)')
    expect(bottom.holes).toHaveLength(0)
    expect(gradeAsymptote(bottom, '0').verdict).toBe('correct')
    mistake('rf_degree_rule', gradeAsymptote(bottom, 'y = 1'))
    mistake('rf_ratio_not_leading', gradeAsymptote(bottom, 'y = -1'))
  })

  it('drops the value that makes a denominator 0, and keeps a value that works', () => {
    const kept = equationFromText('((x - 3)(x + 1))/(x - 3) = 2')
    expect(kept.solutionText).toBe('{1}')
    expect(kept.solutions).toHaveLength(1)
    expect(ratEquals(kept.solutions[0]!, { n: 1, d: 1 })).toBe(true)
    expect(kept.excluded.some((x) => ratEquals(x, { n: 3, d: 1 }))).toBe(true)
    expect(gradeSolution(kept, '{1}').verdict).toBe('correct')
    expect(gradeSolution(kept, '1').verdict).toBe('correct')
    mistake('rf_extraneous_kept', gradeSolution(kept, '{1, 3}'))
    mistake('rf_extraneous_kept', gradeSolution(kept, '3, 1'))
    mistake('rf_valid_dropped', gradeSolution(kept, 'no solution'))
    mistake('rf_valid_dropped', gradeSolution(kept, '{3}'))

    const none = equationFromText('((x - 3)(x - 1))/(x - 3) = 2')
    expect(none.solutions).toHaveLength(0)
    expect(none.solutionText).toBe('no solution')
    expect(gradeSolution(none, 'no solution').verdict).toBe('correct')
    expect(gradeSolution(none, 'none').verdict).toBe('correct')
    mistake('rf_extraneous_kept', gradeSolution(none, '{3}'))
    mistake('rf_extraneous_kept', gradeSolution(none, '3'))

    const dropped = equationFromText('(x - 1)/(x - 3) = 0')
    expect(dropped.solutionText).toBe('{1}')
    expect(gradeSolution(dropped, '{1}').verdict).toBe('correct')
    mistake('rf_valid_dropped', gradeSolution(dropped, 'no solution'))
    mistake('rf_extraneous_kept', gradeSolution(dropped, '{1, 3}'))

    const both = equationFromText('(3x - 5)/(x - 1) = (2x - 3)/(x - 1)')
    expect(both.solutionText).toBe('{2}')
    expect(gradeSolution(both, '{2}').verdict).toBe('correct')
    mistake('rf_extraneous_kept', gradeSolution(both, '{1, 2}'))
    mistake('rf_valid_dropped', gradeSolution(both, 'no solution'))
  })

  it('refuses an unreadable answer and does not treat it as a named mistake', () => {
    expect(gradeDomain(famous, '').verdict).toBe('invalid')
    expect(gradeDomain(famous, 'banana').verdict).toBe('invalid')
    expect(gradeVertical(famous, 'y = -2').verdict).toBe('invalid')
    expect(gradeHoles(famous, '3').verdict).toBe('invalid')
    expect(gradeAsymptote(famous, 'x = 1').verdict).toBe('invalid')
    expect(gradeSolution(equationFromText('(x - 1)/(x - 3) = 0'), 'x').verdict).toBe('invalid')
    expect(gradeVertical(famous, 'x = 9').verdict).toBe('wrong')
  })

  it('has a catalog lesson and a rule card for every rf_ id', () => {
    expect(RF_MISTAKE_IDS).toHaveLength(11)
    for (const id of RF_MISTAKE_IDS) {
      const info = ERROR_PATTERNS[id]
      expect(info.id, id).toBe(id)
      expect(info.title.length, id).toBeGreaterThan(5)
      expect(info.lesson.length, id).toBeGreaterThan(40)
      expect(info.example, id).toContain('✗')
      expect(RF_RULES.some((c) => c.id === RF_RULE_FOR[id]), id).toBe(true)
    }
  })
})

describe('rationalFns module', () => {
  it('is registered after zeros and end behavior, with three templates', () => {
    const mod = getModule('rationalFns')
    expect(mod.title).toBe('Rational functions')
    expect(mod.subject).toBeUndefined()
    expect(mod.templates.map((t) => t.id)).toEqual(['rf.features', 'rf.asymptote', 'rf.equation'])
    expect(mod.order).toBeGreaterThan(getModule('polyZeros').order)
    expect(mod.order).toBeLessThan(getModule('sigFigs').order)
    expect(mod.ruleCards).toBe(RF_RULES)
    expect(new Set(RF_RULES.map((c) => c.id)).size).toBe(RF_RULES.length)
    for (const template of mod.templates) expect(template.knobs).toEqual([])
    const sample = generateProblem('rationalFns', 'rf.features', 1)
    expect(mod.progress(sample, null, false)).toMatchObject({ stage: 0, total: 1, anchorIndex: -1, path: 'none' })
    expect(mod.nextStep(sample, null, false)).toBeNull()
  })
})

function assertHidden(p: ProblemInstance, a: RationalFnsAnswer) {
  const visible = [p.title, p.instructions, a.prompt].join('\n')
  expect(visible, p.id).not.toMatch(METHOD_WORDS)
  for (const line of a.reveal) {
    if (line.length > 24) expect(visible.includes(line), `${p.id} shows a worked line`).toBe(false)
  }
  for (const stage of a.stages) {
    const secret = canonicalEntries(a)[RF_KEYS[stage.id]] ?? ''
    if (secret.length > 2) expect(a.prompt.includes(secret), `${p.id} prompt shows ${secret}`).toBe(false)
    expect(stage.nudge.length).toBeGreaterThan(40)
    expect(stage.reveal.length).toBeGreaterThan(0)
  }
}

function assertFunction(p: ProblemInstance, a: RationalFnsAnswer, f: RfFeatures) {
  expect(p.moduleId).toBe('rationalFns')
  const entries = canonicalEntries(a)
  expect(entries.domain).toBe(f.domainText)
  expect(entries.va).toBe(f.vaText)
  expect(entries.holes).toBe(f.holesText)
  expect(entries.asymptote).toBe(f.asymptoteText)
  expect(entries.xint).toBe(f.xIntText)
  expect(entries.yint).toBe(f.yIntText)
  expect(f.degreeNum).toBeGreaterThanOrEqual(0)
  expect(f.degreeNum).toBeLessThanOrEqual(3)
  expect(f.degreeDen).toBeGreaterThanOrEqual(0)
  expect(f.degreeDen).toBeLessThanOrEqual(3)
  expect(f.asymptoteKind).not.toBe('none')
  for (const c of [...f.num, ...f.den]) expect(c.d).toBe(1)
  for (const x of [...f.vas, ...f.holes.map((h) => h.x), ...f.xIntercepts.map((pt) => pt.x)]) expect(x.d).toBeLessThanOrEqual(3)
  if (a.graph.kind === 'function') {
    expect(a.graph.guides?.length).toBeGreaterThan(0)
    expect(a.graph.fBreaks).toHaveLength(f.vas.length)
    if (f.holes.length > 0) expect(a.graph.dots?.some((d) => d.closed === false)).toBe(true)
    else expect(a.graph.dots ?? []).toHaveLength(0)
  }
}

describe.each(TEMPLATES)('%s over 300 seeds', (templateId, question) => {
  it(
    'is deterministic, grades its own answers, hides them, and promises a real trap',
    () => {
      const traps = new Set<string>()
      let factored = 0
      let holes = 0
      const degrees = new Set<string>()
      let extraneous = 0
      let empty = 0
      for (let seed = 1; seed <= SEEDS; seed++) {
        const p = generateProblem('rationalFns', templateId, seed)
        expect(generateProblem('rationalFns', templateId, seed), p.id).toEqual(p)
        const a = answerOf(p)
        expect(p.kind).toBe('rationalFns')
        expect(p.moduleId).toBe('rationalFns')
        expect(p.skill).toBe(templateId)
        expect(a.question).toBe(question)
        expect(p.canonical).toEqual([])
        expect(p.start).toBeNull()
        expect(p.vars).toEqual(['x'])
        expect(p.graph).toEqual({ kind: 'none' })
        expect(p.calc).toEqual({ ti84: [], nspire: [] })
        expect(a.graph.kind).toBe('function')
        expect(p.statementText).toBe(question === 'equation' ? a.equation : a.f)
        expect(p.params.trap).toBe(a.trap)
        expect(p.params.trapStage).toBe(a.trapStage)
        expect(a.ruleCard).toBe(RF_RULE_FOR[a.trap as RfMistakeId])
        expect(a.ruleCards[0]).toBe(a.ruleCard)
        expect(new Set(a.ruleCards).size).toBe(a.ruleCards.length)

        const entries = canonicalEntries(a)
        for (const stage of a.stages) {
          expect(gradeRfStage(a, stage.id, entries[RF_KEYS[stage.id]] ?? '').verdict, `${p.id} ${stage.id}`).toBe('correct')
        }
        const trap = gradeRfStage(a, a.trapStage, a.trapAnswer)
        expect(trap, `${p.id} ${a.trap}`).toMatchObject({ verdict: 'mistake', mistake: a.trap })
        expect(entries[RF_KEYS[a.trapStage]]).not.toBe(a.trapAnswer)
        if (question === 'equation') {
          const eq = equationFromText(a.equation)
          expect(solutionTraps(eq).some((t) => t.id === a.trap), p.id).toBe(true)
          expect(eq.solutions.length === 0 ? 'no solution' : eq.solutionText).toBe(entries.solution)
          if (p.params.extraneous === true) extraneous++
          if (eq.solutions.length === 0) empty++
          expect(['const', 'linear', 'same', 'none', 'valid']).toContain(p.params.family)
        } else {
          const f = featuresFromText(a.f)
          expect(a.trapStage).not.toBe('solution')
          if (a.trapStage !== 'solution') expect(featureTraps(f, a.trapStage).some((t) => t.id === a.trap), `${p.id} ${a.trap}`).toBe(true)
          assertFunction(p, a, f)
          if (p.params.form === 'factored') factored++
          if (p.params.hole === true) {
            holes++
            expect(f.holes).toHaveLength(1)
          } else {
            expect(f.holes).toHaveLength(0)
          }
          degrees.add(String(p.params.degreeCase))
          expect(['bottom', 'equal', 'slant']).toContain(p.params.degreeCase)
          if (question === 'features') {
            expect(a.stages.map((s) => s.id)).toEqual(['domain', 'va', 'holes', 'asymptote', 'xint', 'yint'])
          } else {
            expect(a.stages.map((s) => s.id)).toEqual(['asymptote'])
          }
        }
        assertHidden(p, a)
        traps.add(a.trap)
      }
      expect(traps.size).toBeGreaterThan(0)
      if (question !== 'equation') {
        expect(factored).toBeGreaterThan(SEEDS * 0.3)
        expect(factored).toBeLessThan(SEEDS * 0.7)
        expect(degrees).toEqual(new Set(['bottom', 'equal', 'slant']))
      }
      if (question === 'features') {
        expect(holes).toBeGreaterThan(SEEDS * 0.3)
        expect(holes).toBeLessThan(SEEDS * 0.7)
      }
      if (question === 'equation') {
        expect(extraneous).toBeGreaterThan(SEEDS * 0.6)
        expect(empty).toBeGreaterThan(15)
        expect(traps.has('rf_extraneous_kept')).toBe(true)
        expect(traps.has('rf_valid_dropped')).toBe(true)
      }
    },
    LOOP_TIMEOUT,
  )
})
