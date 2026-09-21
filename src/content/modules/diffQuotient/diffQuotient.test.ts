import { describe, expect, it } from 'vitest'
import { generateProblem, getModule, MODULES } from '@/content/index'
import type { ProblemInstance } from '@/content/types'
import { differenceQuotient, dqStatus, evaluateExpr, exprEquivalent, fOfXPlusH } from '@/engine'
import { CHIP_OF_TAG } from '@/shared/types'
import { dqAnswer, dqNextStep, dqProgress, dqSolved, dqSpec, dqStart, gradeDqStep, gradeFxh } from './grade'
import { mono, shapeKey, sum, times } from './text'

const TEMPLATES = ['dq.linear', 'dq.quadratic', 'dq.rational', 'dq.radical'] as const
const SEEDS = 300

function all(templateId: string): ProblemInstance[] {
  return Array.from({ length: SEEDS }, (_, i) => generateProblem('diffQuotient', templateId, i + 1))
}

/** Push the canonical path through the graders: every line accepted, chips right, only the last finished. */
function walk(p: ProblemInstance): void {
  const where = `${p.id} f(x) = ${dqAnswer(p).f}`
  const [first, ...rest] = p.canonical
  const s1 = gradeFxh(p, first!.text)
  expect(s1.ok, `${where}: f(x + h) line ${first!.text}`).toBe(true)
  expect(s1.acceptableChips).toEqual([])
  let prev = dqStart(p, first!.text)
  rest.forEach((step, i) => {
    const r = gradeDqStep(p, prev, step.text)
    expect(r.ok, `${where}: ${prev} → ${step.text}`).toBe(true)
    expect(r.pattern).toBeUndefined()
    expect(r.acceptableChips, `${where}: chip for ${step.text}`).toContain(CHIP_OF_TAG[step.tag])
    const last = i === rest.length - 1
    expect(r.simplified, `${where}: simplified(${step.text})`).toBe(last)
    prev = step.text
  })
}

describe('module registration', () => {
  it('registers Difference quotient with the precalculus modules, after them', () => {
    const mod = getModule('diffQuotient')
    expect(mod.title).toBe('Difference quotient')
    expect(mod.subject).toBeUndefined()
    const precalc = MODULES.filter((m) => !m.subject).map((m) => m.id)
    expect(precalc[precalc.length - 1]).toBe('diffQuotient')
    expect(mod.templates.map((t) => t.id)).toEqual([...TEMPLATES])
    for (const p of TEMPLATES.map((t) => generateProblem('diffQuotient', t, 1))) {
      for (const s of p.canonical) expect(mod.ruleCards.some((c) => c.id === s.ruleCard), s.ruleCard).toBe(true)
    }
  })
})

describe.each(TEMPLATES)('%s over 300 seeds', (templateId) => {
  const instances = all(templateId)

  it('is deterministic and well formed', () => {
    for (const p of instances) {
      expect(JSON.stringify(generateProblem('diffQuotient', templateId, p.seed))).toBe(JSON.stringify(p))
      const a = dqAnswer(p)
      expect(p.kind).toBe('diffQuotient')
      expect(p.vars).toEqual(['x', 'h'])
      expect(p.start).toBeNull()
      expect(p.statementText).toBe(`f(x) = ${a.f}`)
      expect(a.restrictions[0]).toBe('h != 0')
      expect(p.calc).toEqual({ ti84: [], nspire: [] })
      expect(p.graph.kind).toBe('function')
      expect(p.graph.secant?.h0).toBeGreaterThan(0)
      // The secant's two points are on the graph and inside the window.
      const { x0, h0 } = p.graph.secant!
      expect(evaluateExpr(a.f, { x: x0 })).not.toBe('undef')
      expect(evaluateExpr(a.f, { x: x0 + h0 })).not.toBe('undef')
      expect(x0).toBeGreaterThan(p.graph.xDomain![0])
      expect(x0 + h0).toBeLessThan(p.graph.xDomain![1])
      // The canonical f(x + h) line is f(x + h); the answer is the difference quotient and is finished.
      expect(exprEquivalent(p.canonical[0]!.text, fOfXPlusH(a.f), p.vars).equivalent).toBe(true)
      expect(a.simplified).toBe(p.canonical[p.canonical.length - 1]!.text)
      expect(dqStatus(a.simplified, dqSpec(p))).toEqual({ equivalent: true, simplified: true })
      expect(exprEquivalent(a.simplified, differenceQuotient(a.f), p.vars).equivalent).toBe(true)
    }
  })

  it('accepts the canonical path line by line with the right chips', { timeout: 180_000 }, () => {
    for (const p of instances) walk(p)
  })

  it('anchors progress on the current line and reveals the next canonical line', { timeout: 120_000 }, () => {
    for (const p of instances.slice(0, 60)) {
      expect(dqNextStep(p, null)).toBe(p.canonical[0])
      expect(dqProgress(p, null).label).toBe('start')
      p.canonical.forEach((step, i) => {
        const info = dqProgress(p, step.text)
        expect(info.anchorIndex, `${p.id}: ${step.text}`).toBe(i)
        expect(info.stage).toBe(i + 1)
        expect(dqNextStep(p, step.text)).toBe(p.canonical[i + 1] ?? null)
        expect(dqSolved(p, step.text)).toBe(i === p.canonical.length - 1)
      })
      expect(dqProgress(p, p.canonical[p.canonical.length - 1]!.text).stage).toBe(p.canonical.length)
    }
  })
})

describe('what the templates cover', () => {
  it('linear: a and b nonzero, negatives included; the answer is a; the note explains why', () => {
    const ps = all('dq.linear')
    const as = ps.map((p) => Number(p.params.a))
    expect(as.some((a) => a < 0)).toBe(true)
    expect(as.some((a) => a === 1)).toBe(true)
    expect(ps.every((p) => Number(p.params.a) !== 0 && Number(p.params.b) !== 0)).toBe(true)
    expect(ps.some((p) => Number(p.params.b) < 0)).toBe(true)
    for (const p of ps) {
      expect(dqAnswer(p).simplified).toBe(String(p.params.a))
      expect(dqAnswer(p).note).toMatch(/secant/)
    }
  })

  it('quadratic: a = 1 and a = −1, missing terms and negatives appear; answer is 2ax + ah + b', () => {
    const ps = all('dq.quadratic')
    const has = (pred: (a: number, b: number, c: number) => boolean) => ps.some((p) => pred(Number(p.params.a), Number(p.params.b), Number(p.params.c)))
    expect(has((a) => a === 1)).toBe(true)
    expect(has((a) => a === -1)).toBe(true)
    expect(has((a) => a < -1)).toBe(true)
    expect(has((_a, b) => b === 0)).toBe(true)
    expect(has((_a, _b, c) => c === 0)).toBe(true)
    expect(has((_a, b) => b < 0)).toBe(true)
    for (const p of ps) {
      const a = Number(p.params.a)
      const b = Number(p.params.b)
      for (const [x, h] of [[1, 2], [-3, 0.5]] as const) {
        expect(evaluateExpr(dqAnswer(p).simplified, { x, h })).toBeCloseTo(2 * a * x + a * h + b, 9)
      }
    }
  })

  it('rational: a/x and the shifted a/(x + c), both signs of a', () => {
    const ps = all('dq.rational')
    expect(ps.some((p) => p.params.c === 0)).toBe(true)
    expect(ps.some((p) => p.params.c !== 0)).toBe(true)
    expect(ps.some((p) => Number(p.params.a) < 0)).toBe(true)
    const plain = ps.find((p) => p.params.c === 0 && p.params.a === 3)
    expect(plain && dqAnswer(plain).simplified).toBe('-3/(x(x + h))')
  })

  it('radical: sqrt(x) and sqrt(x + c); the answer is 1/(sqrt(x + h) + sqrt(x))', () => {
    const ps = all('dq.radical')
    const plain = ps.find((p) => p.params.c === 0)
    expect(plain && dqAnswer(plain).simplified).toBe('1/(sqrt(x + h) + sqrt(x))')
    expect(ps.some((p) => p.params.c !== 0)).toBe(true)
  })

  it('the negativeLead knob forces the negative forms', () => {
    for (let seed = 1; seed <= 40; seed++) {
      expect(Number(generateProblem('diffQuotient', 'dq.linear', seed, { negativeLead: true }).params.a)).toBeLessThan(0)
      expect(Number(generateProblem('diffQuotient', 'dq.quadratic', seed, { negativeLead: true }).params.a)).toBeLessThan(0)
      expect(Number(generateProblem('diffQuotient', 'dq.rational', seed, { negativeLead: true }).params.a)).toBeLessThan(0)
      expect(Number(generateProblem('diffQuotient', 'dq.quadratic', seed, { negativeLead: false }).params.a)).toBeGreaterThan(0)
    }
  })
})

describe('named mistakes over seeds: realistic wrong lines get their name, right lines never do', () => {
  const XS = (p: ProblemInstance) => p.canonical.map((s) => s.text)
  const stageLine = (p: ProblemInstance, stage: string) => p.canonical.find((s) => s.stage === stage)!.text

  it('quadratic (300 seeds)', { timeout: 180_000 }, () => {
    for (const p of all('dq.quadratic')) {
      const a = Number(p.params.a)
      const b = Number(p.params.b)
      const c = Number(p.params.c)
      const f = dqAnswer(p).f
      const where = `${p.id} f(x) = ${f}`
      const fx = (typed: string) => gradeFxh(p, typed).pattern?.id
      expect(fx(`${f} + h`), where).toBe('dq_fx_plus_h')
      const fh = fx(`(${f}) + (${f.replace(/x/g, 'h')})`)
      expect(c === 0 ? ['dq_fx_plus_fh', 'power_over_sum'] : ['dq_fx_plus_fh'], where).toContain(fh)
      expect(fx(sum([times(a, 'x^2 + h^2'), b ? times(b, 'x + h') : '', mono(c)])), where).toBe('power_over_sum')
      if (b !== 0) expect(fx(sum([times(a, '(x + h)^2'), mono(b, 1), mono(c)])), where).toBe('dq_partial_sub')
      if (Math.abs(a) !== 1) {
        const missed = [mono(a, 2), mono(2 * a, 1, 1), mono(1, 0, 2), mono(b, 1), mono(b, 0, 1), mono(c)]
        expect(fx(sum(missed)), where).toBe(a < 0 ? 'negative_not_distributed' : 'partial_distribute')
      }
      const expanded = [mono(a, 2), mono(2 * a, 1, 1), mono(a, 0, 2), mono(b, 1), mono(b, 0, 1), mono(c)]
      const dq = (prev: string, typed: string) => gradeDqStep(p, prev, typed)
      const before = stageLine(p, 'f(x + h) expanded')
      expect(dq(before, `(${sum([...expanded, mono(-a, 2), mono(b, 1), mono(c)])})/h`).pattern?.id, where).toBe('negative_not_distributed')
      const combined = stageLine(p, 'like terms combined')
      expect(dq(combined, sum([mono(2 * a, 1), mono(a, 0, 2), mono(b)])).pattern?.id, where).toBe('dq_partial_cancel')
      expect(dq(combined, sum([mono(2 * a, 1), mono(b)])).pattern?.id, where).toBe('dq_set_h_zero')
      expect(dq(combined, sum([mono(2 * a, 1, 1), mono(a, 0, 2), mono(b, 0, 1)])).pattern?.id, where).toBe('dq_forgot_divide')
      // Right lines: accepted, no pattern (the canonical walk covers every canonical line).
      expect(dq(combined, dqAnswer(p).simplified).pattern, where).toBeUndefined()
      expect(XS(p).length).toBeGreaterThanOrEqual(6)
    }
  })

  it('linear, rational and radical (100 seeds each)', { timeout: 180_000 }, () => {
    for (const p of all('dq.linear').slice(0, 100)) {
      const a = Number(p.params.a)
      const b = Number(p.params.b)
      const start = dqStart(p, p.canonical[0]!.text)
      expect(gradeDqStep(p, start, `(${sum([mono(a, 1), mono(a, 0, 1), mono(b), mono(-a, 1), mono(b)])})/h`).pattern?.id, p.id).toBe('negative_not_distributed')
      expect(gradeDqStep(p, stageLine(p, 'minus distributed'), mono(a, 0, 1)).pattern?.id, p.id).toBe('dq_forgot_divide')
      expect(gradeFxh(p, `${dqAnswer(p).f} + h`).pattern?.id ?? 'accepted', p.id).toBe(a === 1 ? 'accepted' : 'dq_fx_plus_h')
    }
    for (const p of all('dq.rational').slice(0, 100)) {
      const a = Number(p.params.a)
      const c = Number(p.params.c)
      const d0 = c === 0 ? 'x' : `(x ${c > 0 ? '+' : '-'} ${Math.abs(c)})`
      const combined = stageLine(p, 'like terms combined')
      expect(gradeDqStep(p, combined, `${-a}/${d0}^2`).pattern?.id, p.id).toBe('dq_set_h_zero')
      const den = combined.slice(combined.indexOf('/(') + 1, combined.lastIndexOf(')/h'))
      expect(gradeDqStep(p, combined, `${mono(-a, 0, 1)}/${den}`).pattern?.id, p.id).toBe('dq_forgot_divide')
    }
    for (const p of all('dq.radical').slice(0, 100)) {
      const f = dqAnswer(p).f
      const cleared = stageLine(p, 'like terms combined')
      expect(gradeDqStep(p, cleared, `1/(2${f})`).pattern?.id, p.id).toBe('dq_set_h_zero')
      expect(gradeFxh(p, `${f} + h`).pattern?.id, p.id).toBe('dq_fx_plus_h')
    }
  })
})

describe('her homework as a problem', () => {
  it('a linear seed with f(x) = 5x − 2 walks her exact lines', () => {
    let p: ProblemInstance | undefined
    for (let seed = 1; seed < 20_000 && !p; seed++) {
      const q = generateProblem('diffQuotient', 'dq.linear', seed)
      if (dqAnswer(q).f === '5x - 2') p = q
    }
    expect(p).toBeDefined()
    const texts = p!.canonical.map((s) => s.text)
    expect(texts).toEqual(['5(x + h) - 2', '(5x + 5h - 2 - (5x - 2))/h', '(5x + 5h - 2 - 5x + 2)/h', '5h/h', '5'])
  })

  it('an f(x + h) typed already expanded starts part 2 further along, and the next hint skips ahead', () => {
    const p = all('dq.linear').find((q) => Number(q.params.a) > 1)!
    const a = Number(p.params.a)
    const b = Number(p.params.b)
    const expandedFxh = `${a}x + ${a}h + ${b}`.replace(/\+ -/g, '- ')
    expect(gradeFxh(p, expandedFxh).ok).toBe(true)
    const k = p.canonical.findIndex((s) => s.stage === 'f(x + h) expanded')
    expect(k).toBe(1)
    expect(dqProgress(p, expandedFxh).anchorIndex).toBe(k)
    expect(dqNextStep(p, expandedFxh)).toBe(p.canonical[k + 1])
  })

  it('matches her line in any term order to the same canonical line', () => {
    expect(shapeKey('(5x + 5h - 2 - 5x + 2)/h', ['x', 'h'])).toBe(shapeKey('(5h + 5x - 5x - 2 + 2)/h', ['x', 'h']))
    expect(shapeKey('h(6x + 3h + 2)/h', ['x', 'h'])).toBe(shapeKey('(6x + 2 + 3h)h/h', ['x', 'h']))
    expect(shapeKey('5h/h', ['x', 'h'])).not.toBe(shapeKey('5', ['x', 'h']))
  })
})
