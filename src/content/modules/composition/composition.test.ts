import { describe, expect, it } from 'vitest'
import { generateProblem, MODULES } from '@/content'
import type { ProblemInstance } from '@/content/types'
import {
  checkDecomposition,
  compositeDomain,
  compositeDomainMistakes,
  compositeValue,
  compositeValueMistakes,
  compositionMistakes,
  composeText,
  gradeCompositeDomain,
  gradeCompositeValue,
  gradeComposition,
  type FunctionMistakeKind,
} from '@/engine'

const SEEDS = 300

function comp(template: string, seed: number): ProblemInstance {
  return generateProblem('composition', template, seed)
}

function ans(p: ProblemInstance) {
  if (p.answer.type !== 'composition') throw new Error(`${p.id} answer type ${p.answer.type}`)
  return p.answer
}

describe('composition registration', () => {
  it('sits under precalculus, right after Domain and range', () => {
    const ids = MODULES.filter((m) => !m.subject).map((m) => m.id)
    expect(ids.indexOf('composition')).toBe(ids.indexOf('domainRange') + 1)
    const mod = MODULES.find((m) => m.id === 'composition')!
    expect(mod.title).toBe('Composition of functions')
    expect(mod.subject).toBeUndefined()
    expect(mod.templates.map((t) => t.id)).toEqual(['comp.expr', 'comp.value', 'comp.domain', 'comp.decompose'])
  })
})

describe.each(['comp.expr', 'comp.value', 'comp.domain', 'comp.decompose'])('%s over 300 seeds', (template) => {
  const problems = Array.from({ length: SEEDS }, (_, i) => comp(template, i + 1))

  it('is deterministic and core-supported', () => {
    for (const p of problems) {
      expect(JSON.stringify(comp(template, p.seed))).toBe(JSON.stringify(p))
      const a = ans(p)
      expect(p.kind).toBe('composition')
      expect(p.moduleId).toBe('composition')
      expect(p.start).toBeNull()
      expect(p.canonical).toEqual([])
      expect(p.calc.ti84).toEqual([])
      expect(p.calc.nspire).toEqual([])
      expect(p.graph.kind).toBe('function')
      expect(p.graph.f).toBeTruthy()
      expect(a.question).toBe(
        template === 'comp.expr' ? 'expr' : template === 'comp.value' ? 'value' : template === 'comp.domain' ? 'domain' : 'decompose',
      )
      if (template !== 'comp.decompose') {
        expect(compositeDomain(a.f, a.g), `${a.f} ∘ ${a.g}`).not.toBeNull()
      }
    }
  }, 60_000)
})

describe('comp.expr', () => {
  const problems = Array.from({ length: SEEDS }, (_, i) => comp('comp.expr', i + 1))

  it('always has an x^2, and both formula texts grade correct', () => {
    let classic = false
    for (const p of problems) {
      const a = ans(p)
      expect(a.f).toMatch(/x\^2/)
      expect(a.g).not.toBe('x')
      const text = composeText(a.f, a.g)
      expect(text, `${a.f} ${a.g}`).not.toBeNull()
      if (!text) continue
      expect(a.simplified).toBe(text.simplified)
      expect(a.unsimplified).toBe(text.unsimplified)
      expect(gradeComposition(a.f, a.g, text.simplified).verdict).toBe('correct')
      expect(gradeComposition(a.f, a.g, text.unsimplified).verdict).toBe('correct')
      expect(p.graph.f).toBe(text.unsimplified)
      if (a.f === 'x^2 + 1' && a.g === 'x - 3') classic = true
    }
    expect(classic).toBe(true)
  }, 60_000)

  it('every formula mistake is reachable from a realistic wrong answer', () => {
    const seen = new Set<FunctionMistakeKind>()
    for (const p of problems) {
      const a = ans(p)
      for (const c of compositionMistakes(a.f, a.g) ?? []) {
        const g = gradeComposition(a.f, a.g, c.text)
        expect(g.verdict, `${a.f} ∘ ${a.g} ${c.kind} ${c.text}`).toBe('mistake')
        if (g.verdict === 'mistake') {
          expect(g.mistake).toBe(c.kind)
          expect(g.witness.length).toBeGreaterThan(0)
          seen.add(c.kind)
        }
      }
    }
    for (const kind of ['compose_no_parens', 'compose_partial_sub', 'compose_product', 'compose_reversed', 'compose_sum'] as const) {
      expect(seen.has(kind), kind).toBe(true)
    }
  }, 60_000)
})

describe('comp.value', () => {
  const problems = Array.from({ length: SEEDS }, (_, i) => comp('comp.value', i + 1))

  it('grades the exact value, and some seeds are undefined', () => {
    let defined = 0
    let undefinedSeen = 0
    for (const p of problems) {
      const a = ans(p)
      expect(typeof a.a).toBe('number')
      const v = compositeValue(a.f, a.g, a.a!)
      expect(v, `${a.f} ∘ ${a.g} at ${a.a}`).not.toBeNull()
      if (!v) continue
      expect(a.defined).toBe(v.defined)
      expect(a.reveal).toEqual(v.steps)
      if (v.defined) {
        defined++
        expect(v.value.exact).not.toBeNull()
        expect(a.valueText).toBe(v.value.text)
        expect(gradeCompositeValue(a.f, a.g, a.a!, v.value.text).verdict).toBe('correct')
      } else {
        undefinedSeen++
        expect(a.valueText).toBe('undefined')
        expect(gradeCompositeValue(a.f, a.g, a.a!, 'undefined').verdict).toBe('correct')
        expect(gradeCompositeValue(a.f, a.g, a.a!, 'DNE').verdict).toBe('correct')
      }
    }
    expect(defined).toBeGreaterThan(0)
    expect(undefinedSeen).toBeGreaterThan(0)
  }, 60_000)

  it('product and reversed-order values are reachable', () => {
    const seen = new Set<FunctionMistakeKind>()
    for (const p of problems) {
      const a = ans(p)
      for (const c of compositeValueMistakes(a.f, a.g, a.a!) ?? []) {
        const g = gradeCompositeValue(a.f, a.g, a.a!, c.text)
        expect(g.verdict, `${a.f} ${a.g} @ ${a.a} ${c.kind} ${c.text}`).toBe('mistake')
        if (g.verdict === 'mistake') {
          expect(g.mistake).toBe(c.kind)
          seen.add(c.kind)
        }
      }
    }
    expect(seen.has('value_product')).toBe(true)
    expect(seen.has('value_reversed')).toBe(true)
  }, 60_000)
})

describe('comp.domain', () => {
  const problems = Array.from({ length: SEEDS }, (_, i) => comp('comp.domain', i + 1))

  it('grades the composite domain, including the two textbook traps', () => {
    let x2 = false
    let recip = false
    for (const p of problems) {
      const a = ans(p)
      const dom = compositeDomain(a.f, a.g)
      expect(dom, `${a.f} ∘ ${a.g}`).not.toBeNull()
      if (!dom) continue
      expect(a.interval).toBe(dom.interval)
      expect(a.hidesRestriction).toBe(dom.hidesRestriction)
      expect(gradeCompositeDomain(a.f, a.g, dom.set).verdict).toBe('correct')
      expect(gradeCompositeDomain(a.f, a.g, dom.interval).verdict).toBe('correct')
      expect(gradeCompositeDomain(a.f, a.g, dom.builder).verdict).toBe('correct')
      expect(a.reveal).toEqual(dom.explanation)
      expect(p.graph.f).toBe(a.unsimplified)
      if (a.f === 'x^2' && a.g === 'sqrt(x)') {
        x2 = true
        expect(dom.interval).toBe('[0, inf)')
        expect(dom.hidesRestriction).toBe(true)
        expect(dom.simplifiedDomain && gradeCompositeDomain(a.f, a.g, dom.simplifiedDomain).verdict).not.toBe('correct')
      }
      if (a.f === '1/(x - 2)' && a.g === 'sqrt(x)') {
        recip = true
        expect(dom.interval).toBe('[0, 4) U (4, inf)')
      }
    }
    expect(x2).toBe(true)
    expect(recip).toBe(true)
  }, 60_000)

  it('simplified-formula and inner-only domains are reachable', () => {
    const seen = new Set<FunctionMistakeKind>()
    for (const p of problems) {
      const a = ans(p)
      for (const c of compositeDomainMistakes(a.f, a.g) ?? []) {
        const g = gradeCompositeDomain(a.f, a.g, c.interval)
        expect(g.verdict, `${a.f} ∘ ${a.g} ${c.kind}`).toBe('mistake')
        if (g.verdict === 'mistake') {
          expect(g.mistake).toBe(c.kind)
          seen.add(c.kind)
        }
      }
    }
    expect(seen.has('composite_domain_simplified')).toBe(true)
    expect(seen.has('composite_domain_inner_only')).toBe(true)
  }, 60_000)
})

describe('comp.decompose', () => {
  const problems = Array.from({ length: SEEDS }, (_, i) => comp('comp.decompose', i + 1))

  it('accepts the canonical pair, rejects f(x) = x, and accepts a second split of 1/(inside)^2', () => {
    const traps = new Set<string>()
    let second = false
    for (const p of problems) {
      const a = ans(p)
      traps.add(a.trap)
      expect(a.h, p.id).toBeTruthy()
      const ok = checkDecomposition(a.h!, a.f, a.g)
      expect(ok.ok, `${a.h} = ${a.f} ∘ ${a.g}`).toBe(true)
      const trivial = checkDecomposition(a.h!, 'x', a.h!)
      expect(trivial.ok).toBe(false)
      if (!trivial.ok) expect(trivial.reason).toBe('trivial_f')
      if (a.f === '1/x^2') {
        const alt = checkDecomposition(a.h!, '1/x', `(${a.g})^2`)
        expect(alt.ok, `${a.h} as 1/x ∘ (${a.g})^2`).toBe(true)
        second = true
      }
    }
    expect([...traps].sort()).toEqual(['abs', 'cube', 'recip', 'recip-square', 'sqrt', 'square'])
    expect(second).toBe(true)
  }, 60_000)
})
