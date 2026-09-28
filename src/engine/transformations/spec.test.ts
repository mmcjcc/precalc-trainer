import { describe, expect, it } from 'vitest'
import { rat, ratToString, setsEqual, setToInterval } from '@/notation'
import type { Rational } from '@/shared/types'
import { domainOf, rangeOf } from '../functions'
import { exactEval, surdEquals, surdOf, surdToText } from '../functions/exact'
import { evalNode } from '../math'
import { parseExpression } from '../parse'
import {
  explicitFormula,
  fNotation,
  graphWindow,
  hasUnfactoredForm,
  insideText,
  keyFeatures,
  makeTransform,
  mapPoint,
  PARENT_NAMES,
  PARENTS,
  parentFormula,
  sameGraph,
  specDomain,
  specRange,
  specValue,
  transformValueAt,
} from './spec'
import type { ParentName, StatementForm, TransformSpec } from './types'

function node(text: string) {
  const p = parseExpression(text, ['x'])
  if (!p.ok) throw new Error(`does not parse: ${text} (${p.error.message})`)
  return p.node
}

const pt = (p: { x: Rational; y: Rational }) => `(${ratToString(p.x)}, ${ratToString(p.y)})`

/** Every combination of signs and zeros the tests sweep (a, b, h, k as text). */
const A = ['2', '-2', '1/2', '-1', '1']
const B = ['1', '-1', '2', '-1/3', '3/2']
const H = ['3', '-1/2', '0']
const K = ['1', '-4', '0']

function* allSpecs(): Generator<TransformSpec> {
  for (const parent of PARENT_NAMES) for (const a of A) for (const b of B) for (const h of H) for (const k of K) yield makeTransform(parent, { a, b, h, k })
}

describe('renderers', () => {
  it.each([
    [makeTransform('square', { a: -2, h: 3, k: 1 }), '-2f(x - 3) + 1', '-2(x - 3)^2 + 1'],
    [makeTransform('sqrt', { b: -1, h: -2 }), 'f(-(x + 2))', 'sqrt(-(x + 2))'],
    [makeTransform('reciprocal', { a: 3, h: 1, k: 2 }), '3f(x - 1) + 2', '3/(x - 1) + 2'],
    [makeTransform('sqrt', { b: 2, h: 3 }), 'f(2(x - 3))', 'sqrt(2(x - 3))'],
    [makeTransform('cube', { a: '1/2' }), '(1/2)f(x)', '(1/2)x^3'],
    [makeTransform('cube', { a: '-1/2', b: -1 }), '-(1/2)f(-x)', '-(1/2)(-x)^3'],
    [makeTransform('reciprocal', { a: '-1/2', h: 3 }), '-(1/2)f(x - 3)', '-1/(2(x - 3))'],
    [makeTransform('reciprocal', { b: 2 }), 'f(2x)', '1/(2x)'],
    [makeTransform('reciprocal', { b: -1 }), 'f(-x)', '1/(-x)'],
    [makeTransform('abs', { a: -1, h: -4, k: -2 }), '-f(x + 4) - 2', '-abs(x + 4) - 2'],
    [makeTransform('cbrt', { a: 2, b: -1, h: 1, k: 3 }), '2f(-(x - 1)) + 3', '2cbrt(-(x - 1)) + 3'],
    [makeTransform('square', { b: '1/2', h: 4 }), 'f((1/2)(x - 4))', '((1/2)(x - 4))^2'],
    [makeTransform('square', { b: '1/2' }), 'f((1/2)x)', '((1/2)x)^2'],
    [makeTransform('abs', { h: '1/2', k: '-3/4' }), 'f(x - 1/2) - 3/4', 'abs(x - 1/2) - 3/4'],
  ])('%#: f-notation %s, explicit %s', (spec, f, explicit) => {
    expect(fNotation(spec as TransformSpec)).toBe(f)
    expect(explicitFormula(spec as TransformSpec)).toBe(explicit)
  })

  it('writes each parent itself plainly', () => {
    const plain: Record<ParentName, string> = { square: 'x^2', cube: 'x^3', sqrt: 'sqrt(x)', cbrt: 'cbrt(x)', abs: 'abs(x)', reciprocal: '1/x' }
    for (const p of PARENT_NAMES) {
      expect(explicitFormula(makeTransform(p))).toBe(plain[p])
      expect(parentFormula(p)).toBe(plain[p])
      expect(fNotation(makeTransform(p))).toBe('f(x)')
    }
  })

  it('multiplies the inside out for the unfactored form (the classic trap)', () => {
    const s = makeTransform('sqrt', { b: 2, h: 3 })
    expect(hasUnfactoredForm(s)).toBe(true)
    expect(fNotation(s, 'unfactored')).toBe('f(2x - 6)')
    expect(explicitFormula(s, 'unfactored')).toBe('sqrt(2x - 6)')
    expect(insideText(makeTransform('sqrt', { b: -2, h: 3 }), 'unfactored')).toBe('-2x + 6')
    expect(insideText(makeTransform('sqrt', { b: -1, h: 3 }), 'unfactored')).toBe('-x + 3')
    expect(insideText(makeTransform('square', { b: '1/2', h: 4 }), 'unfactored')).toBe('(1/2)x - 2')
    expect(explicitFormula(makeTransform('square', { a: -2, b: 2, h: 3, k: 1 }), 'unfactored')).toBe('-2(2x - 6)^2 + 1')
    expect(explicitFormula(makeTransform('reciprocal', { a: 3, b: 2, h: -1 }), 'unfactored')).toBe('3/(2x + 2)')
    // No difference when b = 1 or h = 0.
    for (const s2 of [makeTransform('square', { h: 3 }), makeTransform('square', { b: 2 })]) {
      expect(hasUnfactoredForm(s2)).toBe(false)
      expect(fNotation(s2, 'unfactored')).toBe(fNotation(s2))
    }
  })

  it('every renderer parses and equals g exactly at every key point image, all parents and signs', () => {
    let checked = 0
    for (const spec of allSpecs()) {
      for (const form of ['factored', 'unfactored'] as StatementForm[]) {
        const g = node(explicitFormula(spec, form))
        // f-notation with f replaced by the parent's formula reads back as the same function.
        const viaF = node(
          fNotation(spec, form).replace(/f\((.*)\)/, (_m, u: string) => `(${parentFormula(spec.parent).replace(/x/g, `(${u})`)})`),
        )
        for (const p of PARENTS[spec.parent].keyPoints) {
          const img = mapPoint(spec, p)
          const want = surdOf(img.y)
          const got = exactEval(g, img.x)
          const got2 = exactEval(viaF, img.x)
          expect(got !== 'undef' && surdEquals(got, want), `${explicitFormula(spec, form)} at ${pt(img)}`).toBe(true)
          expect(got2 !== 'undef' && surdEquals(got2, want), `${fNotation(spec, form)} at ${pt(img)}`).toBe(true)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(5000)
  }, 120_000)
})

describe('mapPoint', () => {
  it.each([
    [makeTransform('square', { a: -2, b: 2, h: 3, k: 1 }), [4, 16], '(5, -31)'],
    [makeTransform('square', { a: -2, h: 3, k: 1 }), [1, 1], '(4, -1)'],
    [makeTransform('sqrt', { b: -1, h: -2 }), [4, 2], '(-6, 2)'],
    [makeTransform('reciprocal', { a: 3, h: 1, k: 2 }), ['1/2', 2], '(3/2, 8)'],
    [makeTransform('cbrt', { a: 2, b: -1, h: 1, k: 3 }), [8, 2], '(-7, 7)'],
    [makeTransform('cube', { a: '1/2', b: '1/3' }), [2, 8], '(6, 4)'],
    [makeTransform('abs', { a: -1, h: -4, k: -2 }), [-2, 2], '(-6, -4)'],
    [makeTransform('sqrt', { a: 3, b: '1/2', h: '-1/2', k: '5/2' }), [9, 3], '(35/2, 23/2)'],
  ])('%#: %j', (spec, [x, y], image) => {
    expect(pt(mapPoint(spec as TransformSpec, { x: x!, y: y! }))).toBe(image)
  })

  it('the image of every key point lies exactly on g, for every parent and sign combination', () => {
    for (const spec of allSpecs()) {
      for (const p of PARENTS[spec.parent].keyPoints) {
        const img = mapPoint(spec, p)
        const v = specValue(spec, img.x)
        expect(v !== 'undef' && surdEquals(v, surdOf(img.y))).toBe(true)
      }
    }
  }, 120_000)

  it('accepts numbers and text for the point and rejects the unreadable', () => {
    const s = makeTransform('square', { h: 1 })
    expect(pt(mapPoint(s, { x: 0.5, y: '1/4' }))).toBe('(3/2, 1/4)')
    expect(() => mapPoint(s, { x: 'two', y: 1 })).toThrow(RangeError)
  })
})

describe('keyFeatures', () => {
  it('vertex, start point, center and asymptotes move to (h, k)', () => {
    const q = keyFeatures(makeTransform('square', { a: -2, h: 3, k: 1 }))
    expect(q.anchor?.name).toBe('vertex')
    expect(pt(q.anchor!.image)).toBe('(3, 1)')
    expect(q.asymptotes).toBeNull()
    expect([q.domainInterval, q.rangeInterval]).toEqual(['(-inf, inf)', '(-inf, 1]'])
    expect(q.explanation).toEqual([
      'The vertex (0, 0) of y = x^2 moves to (3, 1).',
      'a = −2 < 0, so the graph opens down.',
      'Domain: (−∞, ∞). Range: (−∞, 1].',
    ])

    const s = keyFeatures(makeTransform('sqrt', { b: -1, h: -2 }))
    expect(s.anchor?.name).toBe('start point')
    expect(pt(s.anchor!.image)).toBe('(-2, 0)')
    expect([s.domainInterval, s.rangeInterval]).toEqual(['(-inf, -2]', '[0, inf)'])
    expect(s.explanation[1]).toBe('From (−2, 0) the graph goes left (b = −1) and up (a = 1).')
    expect(s.points.map((p) => `${pt(p.parent)}→${pt(p.image)}`)).toEqual(['(0, 0)→(-2, 0)', '(1, 1)→(-3, 1)', '(4, 2)→(-6, 2)', '(9, 3)→(-11, 3)'])

    const r = keyFeatures(makeTransform('reciprocal', { a: 3, h: 1, k: 2 }))
    expect(r.anchor).toBeNull()
    expect(r.asymptotes && [ratToString(r.asymptotes.vertical), ratToString(r.asymptotes.horizontal)]).toEqual(['1', '2'])
    expect([r.domainInterval, r.rangeInterval]).toEqual(['(-inf, 1) U (1, inf)', '(-inf, 2) U (2, inf)'])
    expect(r.explanation[0]).toBe('The asymptotes x = 0 and y = 0 of y = 1/x move to x = 1 and y = 2.')

    for (const p of ['cube', 'cbrt'] as const) {
      const c = keyFeatures(makeTransform(p, { a: 2, h: -1, k: 5 }))
      expect(c.anchor?.name).toBe('center')
      expect(pt(c.anchor!.image)).toBe('(-1, 5)')
      expect([c.domainInterval, c.rangeInterval]).toEqual(['(-inf, inf)', '(-inf, inf)'])
    }
  })

  it('domain and range agree with the functions core on the explicit formula (both forms)', () => {
    let n = 0
    for (const spec of allSpecs()) {
      if (ratToString(spec.h) === '-1/2') continue // keep the sweep short; halves are covered elsewhere
      for (const form of ['factored', 'unfactored'] as StatementForm[]) {
        const text = explicitFormula(spec, form)
        const d = domainOf(text)
        const r = rangeOf(text)
        expect(d, text).not.toBeNull()
        expect(r, text).not.toBeNull()
        expect(setsEqual(d!.set, specDomain(spec)), `${text}: ${setToInterval(d!.set)}`).toBe(true)
        expect(setsEqual(r!.set, specRange(spec)), `${text}: ${setToInterval(r!.set)}`).toBe(true)
        n++
      }
    }
    expect(n).toBeGreaterThan(1000)
  }, 120_000)
})

describe('sameGraph', () => {
  it('recognizes equal functions written as different transformations', () => {
    const same: [ParentName, Record<string, string | number>, Record<string, string | number>][] = [
      ['square', { a: 4 }, { b: 2 }],
      ['square', { a: 4 }, { b: -2 }],
      ['square', { a: -2, h: 3, k: 1 }, { a: -2, b: -1, h: 3, k: 1 }],
      ['cube', { a: 8 }, { b: 2 }],
      ['cube', { a: -1, h: 3 }, { b: -1, h: 3 }],
      ['abs', { a: 6 }, { a: 3, b: -2 }],
      ['reciprocal', { a: 2 }, { b: '1/2' }],
      ['reciprocal', { a: -1, h: 1 }, { b: -1, h: 1 }],
      ['sqrt', { a: 2 }, { b: 4 }],
      ['sqrt', { a: 3, b: -1, h: 2 }, { b: -9, h: 2 }],
      ['cbrt', { a: 2 }, { b: 8 }],
      ['cbrt', { a: -1, h: 5, k: 1 }, { b: -1, h: 5, k: 1 }],
    ]
    for (const [p, s1, s2] of same) expect(sameGraph(makeTransform(p, s1), makeTransform(p, s2)), `${p} ${JSON.stringify([s1, s2])}`).toBe(true)
    const different: [ParentName, Record<string, string | number>, Record<string, string | number>][] = [
      ['sqrt', { b: 4 }, { b: -4 }],
      ['sqrt', { a: 2 }, { b: 2 }],
      ['square', { h: 3 }, { h: -3 }],
      ['abs', { a: -1 }, { b: -1 }],
      ['cube', { a: 2 }, { b: 2 }],
      ['reciprocal', { a: 2 }, { b: 2 }],
      ['cbrt', { a: 2 }, { b: 2 }],
    ]
    for (const [p, s1, s2] of different) expect(sameGraph(makeTransform(p, s1), makeTransform(p, s2)), `${p} ${JSON.stringify([s1, s2])}`).toBe(false)
    expect(sameGraph(makeTransform('square'), makeTransform('abs'))).toBe(false)
  })

  it('agrees with exact evaluation on every pair from a sweep', () => {
    const coefs = ['1', '-1', '2', '-2', '1/2', '4', '-1/4', '8']
    const xs = [rat(1, 3), rat(2), rat(-5, 2), rat(7), rat(-9), rat(1, 8), rat(27), rat(-8)]
    for (const p of PARENT_NAMES) {
      const specs = coefs.flatMap((a) => coefs.map((b) => makeTransform(p, { a, b, h: 1 })))
      for (let i = 0; i < specs.length; i++) {
        for (let j = i + 1; j < specs.length; j += 3) {
          const s1 = specs[i]!
          const s2 = specs[j]!
          const byValues = xs.every((t) => {
            const v1 = transformValueAt(s1, t)
            const v2 = transformValueAt(s2, t)
            if (v1 === null || v2 === null) {
              // A cube root outside the exact model: the test oracle falls back to floats.
              const f1 = evalNode(node(explicitFormula(s1)), { x: t.n / t.d })
              const f2 = evalNode(node(explicitFormula(s2)), { x: t.n / t.d })
              return f1 !== 'undef' && f2 !== 'undef' && Math.abs(f1 - f2) < 1e-9 * Math.max(1, Math.abs(f1))
            }
            if (v1 === 'undef' || v2 === 'undef') return v1 === v2
            return surdEquals(v1, v2)
          })
          expect(sameGraph(s1, s2), `${p}: ${explicitFormula(s1)} vs ${explicitFormula(s2)}`).toBe(byValues)
        }
      }
    }
  }, 120_000)
})

describe('values and construction', () => {
  it('evaluates g exactly, with undefined points and the exact model boundary', () => {
    const txt = (v: ReturnType<typeof transformValueAt>) => (v === null || v === 'undef' ? v : surdToText(v))
    expect(txt(transformValueAt(makeTransform('sqrt'), 2))).toBe('sqrt(2)')
    expect(txt(transformValueAt(makeTransform('sqrt'), -1))).toBe('undef')
    expect(txt(transformValueAt(makeTransform('reciprocal', { h: 3 }), 3))).toBe('undef')
    expect(txt(transformValueAt(makeTransform('cbrt'), 2))).toBeNull()
    expect(txt(transformValueAt(makeTransform('cbrt', { a: 2 }), '-27/8'))).toBe('-3')
    expect(txt(transformValueAt(makeTransform('square', { a: -2, h: 3, k: 1 }), '0.5'))).toBe('-23/2')
  })

  it('refuses a = 0, b = 0, unknown parents and unreadable numbers', () => {
    expect(() => makeTransform('square', { a: 0 })).toThrow(/a cannot be 0/)
    expect(() => makeTransform('square', { b: '0' })).toThrow(/b cannot be 0/)
    expect(() => makeTransform('log' as ParentName)).toThrow(/unknown parent/)
    expect(() => makeTransform('square', { h: 'three' })).toThrow(/not a number/)
    const s = makeTransform('sqrt', { a: '-3/2', b: 0.5, h: '-1', k: 2 })
    expect([s.a, s.b, s.h, s.k].map(ratToString)).toEqual(['-3/2', '1/2', '-1', '2'])
  })

  it('suggests a square window that shows the anchor and the key points', () => {
    expect(graphWindow(makeTransform('square', { h: 3, k: 1 }))).toEqual([-8, 8])
    expect(graphWindow(makeTransform('square', { h: 10, k: -1 }))).toEqual([-14, 14])
    expect(graphWindow(makeTransform('cube', { a: 3 }))).toEqual([-8, 8])
    expect(graphWindow(makeTransform('sqrt', { a: 100 }))).toEqual([-30, 30])
  })
})
