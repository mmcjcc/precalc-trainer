import { describe, expect, it } from 'vitest'
import { generateProblem, MODULES } from '@/content'
import type { ProblemInstance } from '@/content/types'
import {
  describeAsInputs,
  equationMistakes,
  explicitFormula,
  gradeDescription,
  gradeEquation,
  gradeMappedPoint,
  hasUnfactoredForm,
  makeTransform,
  mappedPointMistakes,
  PARENTS,
  TRANSFORM_MISTAKE_KINDS,
  unfactoredConstant,
  ERROR_PATTERNS,
  type StepInput,
  type TransformMistakeKind,
  type TransformSpec,
} from '@/engine'
import { ratToString, type Rational } from '@/notation'
import type { RatLike } from '@/engine'
import { TR_PATTERN } from './patterns'

const SEEDS = 300

const DESCRIBE_KINDS: TransformMistakeKind[] = [
  'h_shift_reversed',
  'v_shift_reversed',
  'h_factor_inverted',
  'v_factor_inverted',
  'reflection_wrong_axis',
  'unfactored_shift',
  'missing_reflection',
  'missing_step',
  'extra_step',
]
const POINT_KINDS: TransformMistakeKind[] = [
  'h_shift_reversed',
  'v_shift_reversed',
  'h_factor_inverted',
  'v_factor_inverted',
  'reflection_wrong_axis',
  'unfactored_shift',
  'missing_reflection',
  'h_order',
  'v_order',
  'factors_swapped',
]
const EQUATION_KINDS: TransformMistakeKind[] = [
  'h_shift_reversed',
  'v_shift_reversed',
  'h_factor_inverted',
  'v_factor_inverted',
  'reflection_wrong_axis',
  'unfactored_shift',
  'missing_reflection',
  'v_factor_inside',
  'v_shift_inside',
]

function problems(template: string): ProblemInstance[] {
  return Array.from({ length: SEEDS }, (_, i) => generateProblem('transformations', template, i + 1))
}

function ans(p: ProblemInstance) {
  if (p.answer.type !== 'transformations') throw new Error(`${p.id} answer type ${p.answer.type}`)
  return p.answer
}

function specOf(p: ProblemInstance): TransformSpec {
  const a = ans(p)
  return makeTransform(a.parent, { a: a.a, b: a.b, h: a.h, k: a.k })
}

function flip(direction: 'left' | 'right' | 'up' | 'down'): 'left' | 'right' | 'up' | 'down' {
  if (direction === 'left') return 'right'
  if (direction === 'right') return 'left'
  if (direction === 'up') return 'down'
  return 'up'
}

function ratText(v: RatLike): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return ratToString(v as Rational)
}

function absText(spec: TransformSpec): string {
  const c = unfactoredConstant(spec)
  return ratToString(c.n < 0 ? { n: -c.n, d: c.d } : c)
}

describe('transformations registration', () => {
  it('sits under precalculus, right after Operations with functions', () => {
    const ids = MODULES.filter((m) => !m.subject).map((m) => m.id)
    expect(ids.indexOf('transformations')).toBe(ids.indexOf('functionOps') + 1)
    const mod = MODULES.find((m) => m.id === 'transformations')!
    expect(mod.title).toBe('Transformations')
    expect(mod.subject).toBeUndefined()
    expect(mod.templates.map((t) => t.id)).toEqual(['tr.describe', 'tr.point', 'tr.equation'])
    expect(mod.ruleCards.map((c) => c.title)).toEqual([
      'f(x − h) moves right h',
      'f(bx) squeezes toward the y-axis',
      'a·f(x) stretches vertically by a',
      'Where the minus sign sits',
      'Factor the inside first',
      'Map a point backwards, then forwards',
    ])
  })

  it('registers every transformation mistake as a tr_, pw_, or rate_ catalog entry', () => {
    for (const kind of TRANSFORM_MISTAKE_KINDS) {
      const id = TR_PATTERN[kind]
      if (kind.startsWith('piecewise_')) expect(id).toBe(`pw_${kind}`)
      else if (kind.startsWith('rate_')) expect(id).toBe(kind)
      else expect(id).toBe(`tr_${kind}`)
      const info = ERROR_PATTERNS[id]
      expect(info.title.length).toBeGreaterThan(0)
      expect(info.lesson.length).toBeGreaterThan(0)
      expect(info.example).toMatch(/→/)
    }
  })
})

describe.each(['tr.describe', 'tr.point', 'tr.equation'])('%s over 300 seeds', (template) => {
  const list = problems(template)

  it('is deterministic, core-supported, and the canonical answer grades correct', () => {
    for (const p of list) {
      expect(JSON.stringify(generateProblem('transformations', template, p.seed))).toBe(JSON.stringify(p))
      const a = ans(p)
      const spec = specOf(p)
      expect(p.kind).toBe('transformations')
      expect(p.start).toBeNull()
      expect(p.canonical).toEqual([])
      expect(p.calc.ti84).toEqual([])
      expect(p.calc.nspire).toEqual([])
      expect(p.graph.kind).toBe('function')
      expect(p.graph.f).toBe(a.parentFormula)
      expect(p.graph.fColor).toBe('gray')
      expect(p.graph.extra?.[0]).toMatchObject({ label: 'g', color: 'coral', style: 'solid', expr: a.formula })
      expect(gradeDescription(spec, describeAsInputs(spec), { form: a.form }).verdict).toBe('correct')
      const factored = explicitFormula(spec, 'factored')
      const shown = explicitFormula(spec, a.form)
      expect(gradeEquation(spec, factored, { form: a.form }).verdict, factored).toBe('correct')
      if (shown !== factored) expect(gradeEquation(spec, shown, { form: a.form }).verdict, shown).toBe('correct')
      if (a.question === 'point') {
        expect(a.sourcePoint).toBeTruthy()
        expect(a.imagePoint).toBeTruthy()
        expect(gradeMappedPoint(spec, { x: String(p.params.px), y: String(p.params.py) }, a.imagePoint!, { form: a.form }).verdict).toBe('correct')
        const ms = mappedPointMistakes(spec, { x: String(p.params.px), y: String(p.params.py) }, { form: a.form })
        expect(ms, a.sourcePoint).not.toBeNull()
        expect(ms!.every((c) => c.shadows.length === 0), `${p.seed} ${a.trap}`).toBe(true)
      }
      if (spec.parent === 'reciprocal') {
        expect(p.graph.fBreaks).toEqual([0])
        expect(p.graph.extra?.[0]?.breaks).toEqual([spec.h.n / spec.h.d])
      } else {
        expect(p.graph.fBreaks).toBeUndefined()
        expect(p.graph.extra?.[0]?.breaks).toBeUndefined()
      }
      const even = PARENTS[spec.parent].symmetry === 'even'
      const odd = PARENTS[spec.parent].symmetry === 'odd'
      if (even) expect(spec.b.n > 0, `${a.parent} should not reflect over the y-axis`).toBe(true)
      if (odd) expect(spec.a.n < 0 && spec.b.n < 0, `${a.parent} should not reflect over both axes`).toBe(false)
    }
  }, 180_000)
})

describe('tr.describe traps', () => {
  const list = problems('tr.describe')

  it('includes each reading trap in the first 300 seeds', () => {
    const traps = new Set(list.map((p) => ans(p).trap))
    for (const trap of ['shift-right', 'shift-left', 'unfactored', 'h-compress', 'h-stretch', 'reflect-x', 'reflect-y', 'v-stretch', 'v-compress']) {
      expect(traps.has(trap), trap).toBe(true)
    }
    const by = (trap: string) => list.filter((p) => ans(p).trap === trap).map(ans)
    expect(by('shift-right').every((a) => Number(a.h) > 0)).toBe(true)
    expect(by('shift-left').every((a) => Number(a.h) < 0)).toBe(true)
    expect(by('unfactored').every((a) => a.form === 'unfactored' && hasUnfactoredForm(makeTransform(a.parent, { a: a.a, b: a.b, h: a.h, k: a.k })))).toBe(true)
    expect(by('unfactored').some((a) => a.notation === 'f(2x - 6)' || /f\([23]x - /.test(a.notation))).toBe(true)
    expect(by('h-compress').some((a) => a.notation === 'f(2x)')).toBe(true)
    expect(by('h-compress').every((a) => a.b === '2' || a.b === '3')).toBe(true)
    expect(by('h-stretch').some((a) => a.notation === 'f((1/2)x)')).toBe(true)
    expect(by('h-stretch').every((a) => a.b === '1/2' || a.b === '1/3')).toBe(true)
    expect(by('reflect-x').every((a) => a.sentences.some((s) => s === 'reflect over the x-axis'))).toBe(true)
    expect(by('reflect-y').every((a) => a.parent !== 'square' && a.parent !== 'abs')).toBe(true)
    expect(by('reflect-y').every((a) => a.sentences.some((s) => s === 'reflect over the y-axis'))).toBe(true)
    expect(by('v-stretch').every((a) => a.sentences.some((s) => s.startsWith('stretch vertically')))).toBe(true)
    expect(by('v-compress').every((a) => a.sentences.some((s) => s.startsWith('compress vertically')))).toBe(true)
  })

  it('every description mistake is reachable from a realistic wrong list', () => {
    const seen = new Set<TransformMistakeKind>()
    for (const p of list) {
      const a = ans(p)
      const spec = specOf(p)
      const steps = describeAsInputs(spec)
      const trials: StepInput[][] = [[...steps, { kind: 'shift', direction: 'up', amount: '5' }]]
      steps.forEach((step, i) => {
        trials.push(steps.filter((_, j) => j !== i))
        if (step.kind === 'shift') {
          trials.push(steps.map((s, j) => (j === i ? { ...step, direction: flip(step.direction) } : s)))
          if (a.form === 'unfactored' && (step.direction === 'left' || step.direction === 'right')) {
            trials.push(steps.map((s, j) => (j === i ? { kind: 'shift', direction: step.direction, amount: absText(spec) } : s)))
          }
        }
        if (step.kind === 'scale') {
          trials.push(
            steps.map((s, j) =>
              j === i ? { kind: 'scale', axis: step.axis, word: step.word === 'stretch' ? 'compress' : 'stretch', factor: ratText(step.factor) } : s,
            ),
          )
        }
        if (step.kind === 'reflect') {
          trials.push(steps.map((s, j) => (j === i ? { kind: 'reflect', axis: step.axis === 'x' ? 'y' : 'x' } : s)))
        }
      })
      for (const chosen of trials) {
        const g = gradeDescription(spec, chosen, { form: a.form })
        if (g.verdict !== 'mistake') continue
        seen.add(g.mistake)
        for (const check of g.checks) if (check.mistake) seen.add(check.mistake)
      }
    }
    for (const kind of DESCRIBE_KINDS) expect(seen.has(kind), kind).toBe(true)
  }, 60_000)
})

describe('tr.point traps', () => {
  const list = problems('tr.point')

  it('includes a shift each way, the factor-out trap, both reflections, both scales, and a negative a whose vertical order matters', () => {
    const traps = new Set(list.map((p) => ans(p).trap))
    for (const trap of ['shift-right', 'shift-left', 'unfactored', 'h-compress', 'h-stretch', 'reflect-x', 'reflect-y', 'v-stretch', 'v-compress', 'v-order']) {
      expect(traps.has(trap), trap).toBe(true)
    }
    const order = list.filter((p) => ans(p).trap === 'v-order').map(ans)
    expect(order.length).toBeGreaterThan(0)
    expect(order.every((a) => a.a.startsWith('-') && a.k !== '0')).toBe(true)
    const unfactored = list.filter((p) => ans(p).trap === 'unfactored').map(ans)
    expect(unfactored.every((a) => a.form === 'unfactored' && Math.abs(Number(a.b)) !== 1)).toBe(true)
  })

  it('every point mistake is what a realistic wrong point grades as', () => {
    const seen = new Set<TransformMistakeKind>()
    for (const p of list) {
      const a = ans(p)
      const spec = specOf(p)
      const point = { x: String(p.params.px), y: String(p.params.py) }
      for (const c of mappedPointMistakes(spec, point, { form: a.form }) ?? []) {
        const g = gradeMappedPoint(spec, point, c.text, { form: a.form })
        expect(g.verdict, `${p.seed} ${c.kind} ${c.text}`).toBe('mistake')
        if (g.verdict === 'mistake') {
          expect(g.mistake).toBe(c.kind)
          expect(g.witness.length).toBeGreaterThan(0)
          seen.add(c.kind)
        }
      }
    }
    for (const kind of POINT_KINDS) expect(seen.has(kind), kind).toBe(true)
  }, 60_000)
})

describe('tr.equation', () => {
  const list = problems('tr.equation')

  it('gives the steps in words and keeps the factor-out, both shifts, both scales, and both reflections', () => {
    const traps = new Set(list.map((p) => ans(p).trap))
    for (const trap of ['shift-right', 'shift-left', 'unfactored', 'h-compress', 'h-stretch', 'reflect-x', 'reflect-y', 'v-stretch', 'v-compress']) {
      expect(traps.has(trap), trap).toBe(true)
    }
    for (const p of list) {
      const a = ans(p)
      expect(a.notation).toBe('')
      expect(a.sentences.length).toBeGreaterThan(0)
      expect(a.form).toBe('factored')
      expect(p.statementText).toContain(a.sentences[0]!)
      expect(p.statementText).not.toContain(a.formula)
    }
    const reflect = list.filter((p) => ans(p).trap === 'reflect-x' || ans(p).trap === 'reflect-y')
    expect(reflect.every((p) => ans(p).parent === 'sqrt')).toBe(true)
  })

  it('every equation mistake is what a realistic wrong formula grades as', () => {
    const seen = new Set<TransformMistakeKind>()
    const need = new Set(EQUATION_KINDS)
    for (const p of list) {
      if (need.size === 0) break
      const a = ans(p)
      const spec = specOf(p)
      for (const c of equationMistakes(spec, { form: a.form }) ?? []) {
        if (!need.has(c.kind)) continue
        const g = gradeEquation(spec, c.text, { form: a.form })
        expect(g.verdict, `${p.seed} ${c.kind} ${c.text}`).toBe('mistake')
        if (g.verdict === 'mistake') {
          expect(g.mistake).toBe(c.kind)
          expect(g.witness.length).toBeGreaterThan(0)
          seen.add(c.kind)
          need.delete(c.kind)
        }
      }
    }
    for (const kind of EQUATION_KINDS) expect(seen.has(kind), kind).toBe(true)
  }, 180_000)
})
