import { calcPanels } from '@/content/calc'
import { makeRng } from '@/content/rng'
import type { DifficultyKnobs, Parity, ProblemInstance, TemplateDef } from '@/content/types'
import { checkParity, evalExpr } from '@/engine/parity'

type Term = { c: number; p: number }

function termStr(t: Term, first: boolean): string {
  const abs = Math.abs(t.c)
  const sign = t.c < 0 ? '-' : '+'
  let body: string
  if (t.p === 0) body = String(abs)
  else if (t.p === 1) body = abs === 1 ? 'x' : `${abs}x`
  else body = abs === 1 ? `x^${t.p}` : `${abs}x^${t.p}`
  if (first) return t.c < 0 ? `-${body}` : body
  return ` ${sign} ${body}`
}

function formatPoly(terms: Term[], v = 'x'): string {
  let s = ''
  terms.forEach((t, i) => {
    if (v === 'x') s += termStr(t, i === 0)
    else {
      const abs = Math.abs(t.c)
      const sign = t.c < 0 ? '-' : '+'
      let body: string
      if (t.p === 0) body = String(abs)
      else if (t.p === 1) body = abs === 1 ? v : `${abs}${v}`
      else body = abs === 1 ? `${v}^${t.p}` : `${abs}${v}^${t.p}`
      s += i === 0 ? (t.c < 0 ? `-${body}` : body) : ` ${sign} ${body}`
    }
  })
  return s
}

export const evenOddPolyTemplate: TemplateDef = {
  id: 'evenOdd.poly',
  title: 'Polynomial even / odd / neither',
  description: 'Write f(−x) and −f(x), then choose the verdict. Plug in the stored k.',
  version: 1,
  knobs: [],
  generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
    const rng = makeRng(seed)
    const want = rng.pick<Parity>(['even', 'odd', 'neither'])
    let terms: Term[] = []
    if (want === 'even') {
      const p1 = rng.pick([2, 4])
      const p0 = rng.chance(0.7) ? 0 : 2
      terms = [
        { c: rng.intExcept(-5, 5, [0]), p: p1 },
        { c: rng.intExcept(-5, 5, [0]), p: p0 === p1 ? 0 : p0 },
      ]
      if (terms[1]!.p === terms[0]!.p) terms[1] = { c: rng.intExcept(-4, 4, [0]), p: 0 }
    } else if (want === 'odd') {
      terms = [
        { c: rng.intExcept(-5, 5, [0]), p: rng.pick([3, 1]) },
        { c: rng.intExcept(-5, 5, [0]), p: 1 },
      ]
      if (terms[0]!.p === 1) terms = [{ c: rng.intExcept(-5, 5, [0]), p: 3 }, { c: rng.intExcept(-5, 5, [0]), p: 1 }]
    } else {
      terms = [
        { c: rng.intExcept(-5, 5, [0]), p: 3 },
        { c: rng.intExcept(-5, 5, [0]), p: 2 },
      ]
    }
    terms.sort((a, b) => b.p - a.p)
    const f = formatPoly(terms)
    const fNegX = formatPoly(terms, '(-x)')
    const negF = formatPoly(terms.map((t) => ({ ...t, c: -t.c })))
    // f(−x) simplified: odd powers keep the minus, even powers drop it (equals f when even, −f when odd).
    const simplifiedNeg = formatPoly(terms.map((t) => ({ ...t, c: t.p % 2 === 1 ? -t.c : t.c })))
    const k = rng.pick([1, 2])
    const checked = checkParity(f, [k])
    const fk = evalExpr(f, { x: k })
    const fNegK = evalExpr(f, { x: -k })
    return {
      id: `evenOdd/evenOdd.poly@1/${(seed >>> 0).toString(36)}`,
      moduleId: 'evenOdd',
      templateId: 'evenOdd.poly',
      skill: 'evenOdd.poly',
      genVersion: 1,
      seed,
      knobs,
      kind: 'evenOdd',
      title: 'Even, odd, or neither?',
      instructions:
        'Write f(−x) and −f(x). Then choose even / odd / neither. Use the stored k as a plug-in check.',
      statementText: `y = ${f}`,
      vars: ['x'],
      start: `y = ${f}`,
      canonical: [
        {
          text: `y = ${fNegX}`,
          tag: 'simplify',
          nudge: 'Replace every x with (−x). Do not simplify yet if you want the evidence line.',
          ruleCard: 'f-neg-x',
          stage: 'f(-x) written',
        },
        {
          text: `y = ${simplifiedNeg}`,
          tag: 'simplify',
          nudge: 'Simplify powers of (−x). Even powers drop the minus; odd powers keep it.',
          ruleCard: 'simplify-neg',
          stage: 'f(-x) simplified',
        },
      ],
      answer: {
        type: 'parity',
        f,
        verdict: checked.verdict,
        reason: checked.reason,
        fNegX: [fNegX, simplifiedNeg],
        negF: [`-(${f})`, negF],
        k,
      },
      graph: {
        kind: 'function',
        f,
        extra: [{ expr: simplifiedNeg, label: 'simplified f(-x)', style: 'dashed', color: 'gold' }],
        xDomain: [-6, 6],
      },
      calc: calcPanels({ family: 'even-odd', expr: f, checkValue: k }),
      check: { k, fk: typeof fk === 'number' ? fk : 0 },
      params: { f, want, k, fk: String(fk), fNegK: String(fNegK) },
    }
  },
}
