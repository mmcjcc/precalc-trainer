import { describe, expect, it } from 'vitest'
import { generateProblem, MODULES } from '@/content/index'
import { evalNode } from '@/engine/math'
import { parseExpression, parseStatement } from '@/engine/parse'
import { checkParity, evalExpr as evalParity } from '@/engine/parity'
import { exprEquivalent } from '@/engine/samples'
import { verifyStep } from '@/engine/verify'
import { parseInterval, parseSetBuilder, setFromRelation, setsEqual } from '@/notation'
import type { ModuleId } from '@/shared/types'

const TEMPLATES: { module: ModuleId; template: string }[] = [
  { module: 'inequalities', template: 'ineq.linear' },
  { module: 'inequalities', template: 'ineq.distribute' },
  { module: 'inequalities', template: 'ineq.fraction' },
  { module: 'inequalities', template: 'ineq.compound' },
  { module: 'inverses', template: 'inv.linear' },
  { module: 'inverses', template: 'inv.cbrt-shift' },
]

const PARITY: { module: ModuleId; template: string }[] = [
  { module: 'evenOdd', template: 'evenOdd.poly' },
  { module: 'evenOdd', template: 'evenOdd.special' },
]

function evalExpr(text: string, scope: Record<string, number>) {
  const p = parseStatement(`y = ${text}`)
  if (!p.ok) throw new Error(p.error.message)
  return evalNode(p.statement.disjuncts[0]![0]!.rhs, scope)
}

function sameExpr(a: string, b: string): boolean {
  const pa = parseExpression(a, ['x'])
  const pb = parseExpression(b, ['x'])
  if (!pa.ok) throw new Error(`${a}: ${pa.error.message}`)
  if (!pb.ok) throw new Error(`${b}: ${pb.error.message}`)
  return exprEquivalent(pa.node, pb.node, ['x'])
}

describe('module registry', () => {
  it('registers all six modules in display order', () => {
    expect(MODULES.map((m) => m.id)).toEqual([
      'numberLine',
      'inequalities',
      'evenOdd',
      'inverses',
      'propertiesDrill',
      'sigFigs',
    ])
  })
})

describe('generators — canonical paths verify', () => {
  for (const { module, template } of TEMPLATES) {
    it(`${module}/${template}: 25 seeds accept every canonical step`, () => {
      for (let n = 1; n <= 25; n++) {
        const p = generateProblem(module, template, n * 9973 + 17)
        expect(p.start).toBeTruthy()
        expect(p.canonical.length).toBeGreaterThan(0)
        let line = p.start!
        for (const step of p.canonical) {
          const r = verifyStep(line, step.text)
          expect(r.ok, `${p.id}\n${line}  →  ${step.text}`).toBe(true)
          line = step.text
        }
        if (p.answer.type === 'set') {
          const parsed = parseInterval(p.answer.interval)
          expect(parsed.ok, p.answer.interval).toBe(true)
          if (parsed.ok) expect(setsEqual(parsed.set, p.answer.set)).toBe(true)
          const builder = parseSetBuilder(p.answer.setBuilder)
          expect(builder.ok, p.answer.setBuilder).toBe(true)
          if (builder.ok) expect(setsEqual(builder.set, p.answer.set)).toBe(true)
          // The last canonical line IS the answer: its solution set must equal answer.set.
          const last = p.canonical[p.canonical.length - 1]!.text
          const fromLine = setFromRelation(last)
          expect(fromLine, last).not.toBeNull()
          if (fromLine) expect(setsEqual(fromLine, p.answer.set), `${last} vs ${p.answer.interval}`).toBe(true)
          expect(p.graph.kind).toBe('numberLine')
        }
        if (p.answer.type === 'inverse' && p.check && p.answer.inverse) {
          const f = p.start!.replace(/^y = /, '')
          expect(evalExpr(f, { x: p.check.k })).toBe(p.check.fk)
          expect(evalExpr(p.answer.inverse, { x: p.check.fk })).toBe(p.check.k)
        }
      }
    })
  }
})

describe('inequalities — clean numbers and knobs', () => {
  it('ineq.fraction: solves in y, answers are integers or thirds/fifths, check value is friendly', () => {
    let fractionSeen = 0
    let negativeSeen = 0
    for (let n = 1; n <= 40; n++) {
      const p = generateProblem('inequalities', 'ineq.fraction', n * 7727 + 5)
      expect(p.vars).toEqual(['y'])
      expect(p.answer.type).toBe('set')
      if (p.answer.type !== 'set') continue
      expect(p.answer.setBuilder.startsWith('{y |')).toBe(true)
      const piece = p.answer.set.pieces[0]!
      const end = piece.lo === '-inf' ? piece.hi : piece.lo
      expect(end).not.toBe('inf')
      expect(end).not.toBe('-inf')
      if (typeof end === 'object') {
        expect([1, 3, 5]).toContain(end.d)
        if (end.d !== 1) fractionSeen++
      }
      if (p.params.negative === true) negativeSeen++
      expect(p.check).toBeDefined()
      const f = p.start!.split(/ [<>]=? /)[0]!
      expect(evalExpr(f, { y: p.check!.k })).toBeCloseTo(p.check!.fk, 9)
    }
    expect(fractionSeen).toBeGreaterThan(0)
    expect(negativeSeen).toBeGreaterThan(0)
  })

  it('ineq.fraction: knobs force the integer/fraction and sign variants', () => {
    for (let n = 1; n <= 10; n++) {
      const frac = generateProblem('inequalities', 'ineq.fraction', n * 31 + 1, { fractions: true })
      expect(frac.params.fraction).toBe(true)
      const int = generateProblem('inequalities', 'ineq.fraction', n * 31 + 1, { fractions: false })
      expect(int.params.fraction).toBe(false)
      const neg = generateProblem('inequalities', 'ineq.fraction', n * 31 + 1, { negativeLead: true })
      expect(neg.params.negative).toBe(true)
      expect(neg.start?.startsWith('-(')).toBe(true)
      expect(neg.canonical[1]!.ruleCard).toBe('flip-negative')
    }
  })

  it('ineq.compound: bounded answer, chain symbols agree, negative coefficient reverses the chain', () => {
    let negativeSeen = 0
    let fractionSeen = 0
    for (let n = 1; n <= 40; n++) {
      const p = generateProblem('inequalities', 'ineq.compound', n * 6113 + 9)
      expect(p.answer.type).toBe('set')
      if (p.answer.type !== 'set') continue
      expect(p.answer.set.pieces).toHaveLength(1)
      expect(p.answer.set.points).toHaveLength(0)
      const piece = p.answer.set.pieces[0]!
      expect(typeof piece.lo).toBe('object')
      expect(typeof piece.hi).toBe('object')
      if (typeof piece.lo === 'object' && typeof piece.hi === 'object') {
        expect([1, 3, 5]).toContain(piece.lo.d)
        expect([1, 3, 5]).toContain(piece.hi.d)
        if (piece.lo.d !== 1 || piece.hi.d !== 1) fractionSeen++
      }
      // The start line is a chain with both symbols pointing the same way.
      expect(/^-?\d+ <=? .+ <=? -?\d+$/.test(p.start!), p.start!).toBe(true)
      if (p.params.negative === true) {
        negativeSeen++
        expect(p.canonical).toHaveLength(3)
        expect(p.canonical[1]!.tag).toBe('mul_div_neg_flip')
        expect(p.canonical[2]!.tag).toBe('swap_sides')
      } else {
        expect(p.canonical).toHaveLength(2)
        expect(p.canonical[1]!.tag).toBe('div_both')
      }
      // The final line reads low → high with x in the middle.
      const final = p.canonical[p.canonical.length - 1]!.text
      expect(/^-?\d+(\/\d+)? <=? x <=? -?\d+(\/\d+)?$/.test(final), final).toBe(true)
      expect(p.check).toBeDefined()
      expect(evalExpr(String(p.params.c) + 'x + ' + String(p.params.d), { x: p.check!.k })).toBe(p.check!.fk)
    }
    expect(negativeSeen).toBeGreaterThan(0)
    expect(fractionSeen).toBeGreaterThan(0)
  })
})

describe('even/odd generators', () => {
  for (const { module, template } of PARITY) {
    it(`${module}/${template}: verdict matches checkParity and the evidence lines are exact`, () => {
      for (let n = 1; n <= 25; n++) {
        const p = generateProblem(module, template, n * 7919 + 3)
        expect(p.answer.type).toBe('parity')
        if (p.answer.type !== 'parity') return
        const { f, k, fNegX, negF } = p.answer
        const r = checkParity(f, [k])
        expect(r.verdict, f).toBe(p.answer.verdict)
        expect(r.reason, f).toBe(p.answer.reason)
        // Every f(−x) line equals f with x → (−x); every −f(x) line equals −(f).
        const fNeg = f.replace(/x/g, '(-x)')
        expect(fNegX.length).toBeGreaterThanOrEqual(2)
        for (const line of fNegX) expect(sameExpr(fNeg, line), `${f}: f(-x) line ${line}`).toBe(true)
        expect(negF.length).toBeGreaterThanOrEqual(1)
        for (const line of negF) expect(sameExpr(`-(${f})`, line), `${f}: -f(x) line ${line}`).toBe(true)
        // Canonical lines are the f(−x) evidence, in order.
        expect(p.canonical.map((s) => s.text)).toEqual(fNegX.map((l) => `y = ${l}`))
        // The stored k is friendly: f(k) defined; for value verdicts f(−k) defined too.
        const fk = evalParity(f, { x: k })
        expect(fk, `${f} at ${k}`).not.toBe('undef')
        if (p.answer.reason === 'values') expect(evalParity(f, { x: -k })).not.toBe('undef')
        else expect(evalParity(f, { x: -k }), `${f}: domain failure should show at -${k}`).toBe('undef')
      }
    })
  }

  it('evenOdd.special: CG-07 root and rational families are present with CG-08 check values', () => {
    const seen = new Map<string, Set<number>>()
    for (let n = 1; n <= 300; n++) {
      const p = generateProblem('evenOdd', 'evenOdd.special', n * 104729 + 11)
      if (p.answer.type !== 'parity') continue
      const set = seen.get(p.answer.f) ?? new Set<number>()
      set.add(p.answer.k)
      seen.set(p.answer.f, set)
    }
    const ks = (f: string) => Array.from(seen.get(f) ?? []).sort((a, b) => a - b)
    expect(ks('cbrt(x)')).toEqual([-8, 8])
    expect(ks('x*cbrt(x)')).toEqual([-8, 8])
    expect(ks('cbrt(x)+1')).toEqual([-8, 8])
    expect(ks('sqrt(25-x^2)')).toEqual([3, 4])
    expect(ks('x*sqrt(25-x^2)')).toEqual([3, 4])
    expect(ks('sqrt(x+3)')).toEqual([6])
    expect(ks('1/x')).toEqual([1, 2, 3])
    expect(ks('1/(x^2-4)')).toEqual([1, 3])
    expect(ks('x/(x^2-1)')).toEqual([2])
    expect(ks('(x^2+1)/(x^2-3)')).toEqual([1, 2, 3])
    expect(ks('(x^2+1)/x')).toEqual([1, 2, 3])
    expect(ks('1/(x+2)')).toEqual([2])
    // Rational check values give a denominator ≤ 5.
    for (const [f, kset] of seen) {
      if (!f.includes('/')) continue
      for (const k of kset) {
        const v = evalParity(f, { x: k })
        expect(v).not.toBe('undef')
        if (typeof v === 'number') {
          const denomOk = [1, 2, 3, 4, 5].some((d) => Math.abs(v * d - Math.round(v * d)) < 1e-9)
          expect(denomOk, `${f}(${k}) = ${v}`).toBe(true)
        }
      }
    }
  })
})
