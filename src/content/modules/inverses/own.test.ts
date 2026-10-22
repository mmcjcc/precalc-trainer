/**
 * "Check my own problem" for inverses (docs/progress/own-problem.md).
 *  - Round trip: every template, 300 seeds: the generated function typed as her own is the same kind and template,
 *    has the same inverse (or the same not-one-to-one verdict, reason and bonus inverse), the generated answer line is
 *    found on hers, her check value is right for her function, and the trap (renaming only one letter in the swap)
 *    is named the same way by both checkers.
 *  - Her paths: every hinted line, swap first and solve first, is a line the engine keeps (templates and her own
 *    numbers beyond the templates').
 *  - Wrong lines are seen: for her own numbers beyond the templates' ranges, slipped lines are refused.
 *  - Her real quiz: the inverse of f(x) = ∛(5x − 2) + 4, cubing before subtracting the 4.
 *  - Why not: what is outside the module gets its reason.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { buildOwnProblem, partsText, type OwnResult } from '@/content/own'
import type { CanonicalStep, ProblemInstance } from '@/content/types'
import { evalExpr, normalizeInput, parseExpression, verifyStep } from '@/engine'
import { makeRng } from '@/content/rng'
import type { StepContext } from '@/shared/types'

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 13)
const LONG = { timeout: 900_000 }

function own(text: string): OwnResult {
  return buildOwnProblem('inverses', 'inverse', text)
}

function ok(text: string): ProblemInstance {
  const r = own(text)
  if (!r.ok) throw new Error(`${text}: ${r.reason.code} ${partsText(r.reason.parts)}`)
  return r.instance
}

/** The checker's context, as the flow builds it (problem/stepEngine.ts buildStepContext). */
function ctxOf(p: ProblemInstance, allowSwap: boolean): StepContext {
  return {
    vars: p.vars,
    seed: p.seed,
    allowSwap,
    checkValue: p.check?.k,
    canonical: [...p.canonical, ...(p.canonicalAlt ?? [])].map((s) => s.text),
    moduleId: p.moduleId,
  }
}

const fOf = (p: ProblemInstance) => p.graph.f ?? p.statementText.replace(/^\s*y\s*=\s*/, '')

/** The same function: defined at the same points of a wide grid, and equal there (a square root's half-line too). */
function sameInverse(a: string, b: string, _seed?: number): boolean {
  let both = 0
  for (let i = -60; i <= 60; i++) {
    const x = i * 0.97 + 0.113
    const va = evalExpr(a, { x })
    const vb = evalExpr(b, { x })
    if ((va === 'undef') !== (vb === 'undef')) return false
    if (va === 'undef' || vb === 'undef') continue
    if (Math.abs(va - vb) > 1e-7 * Math.max(1, Math.abs(va))) return false
    both++
  }
  return both >= 3
}

/** Walk a path through the engine as the flow does (one swap allowed). Returns the first refused line, or null. */
function walk(p: ProblemInstance, path: readonly CanonicalStep[]): string | null {
  let prev = p.start!
  let swapped = false
  for (const s of path) {
    const r = verifyStep(prev, s.text, ctxOf(p, !swapped))
    if (!r.ok) return `${prev} → ${s.text}: ${r.verdict} ${r.pattern?.id ?? ''}`
    if (r.swapped) swapped = true
    prev = s.text
  }
  return null
}

/** The swap with only y renamed: from y = E(x), the line x = E(x). */
function misnamed(start: string): string {
  return start.replace(/^\s*y\s*=/, 'x =')
}

describe('round trip: every inverse template, typed back as her own problem', () => {
  for (const template of getModule('inverses').templates) {
    it(`${template.id}: same kind, template, inverse, check and trap over ${SEEDS.length} seeds`, LONG, () => {
      const failures: string[] = []
      for (const seed of SEEDS) {
        const gen = generateProblem('inverses', template.id, seed)
        const r = own(gen.statementText)
        const where = `${gen.id} "${gen.statementText}"`
        if (!r.ok) {
          failures.push(`${where}: ${r.reason.code} ${partsText(r.reason.parts)}`)
          continue
        }
        const mine = r.instance
        if (mine.kind !== 'inverse' || mine.templateId !== gen.templateId) failures.push(`${where}: ${mine.kind} ${mine.templateId}`)
        if (mine.vars.join() !== gen.vars.join()) failures.push(`${where}: vars`)
        if (mine.answer.type !== 'inverse' || gen.answer.type !== 'inverse') {
          failures.push(`${where}: not an inverse answer`)
          continue
        }
        if (mine.answer.oneToOne !== gen.answer.oneToOne) failures.push(`${where}: one-to-one ${mine.answer.oneToOne}`)
        const f = fOf(gen)
        if (!sameInverse(fOf(mine), f, seed)) failures.push(`${where}: f ${fOf(mine)}`)
        if (gen.answer.oneToOne) {
          if (!mine.answer.inverse || !sameInverse(mine.answer.inverse, gen.answer.inverse!, seed)) failures.push(`${where}: inverse ${mine.answer.inverse}`)
        } else {
          if (mine.answer.reason !== gen.answer.reason) failures.push(`${where}: reason ${mine.answer.reason}`)
          if (!mine.answer.bonusInverse || !sameInverse(mine.answer.bonusInverse, gen.answer.bonusInverse!, seed)) failures.push(`${where}: bonus ${mine.answer.bonusInverse}`)
        }
        // Her check value is right for her function: f(k) = f(k) stored, and back (or the twin) gives it again.
        const c = mine.check
        if (!c) failures.push(`${where}: no check value`)
        else {
          const fk = evalExpr(f, { x: c.k })
          if (fk === 'undef' || Math.abs(fk - c.fk) > 1e-9 || !Number.isInteger(c.k) || !Number.isInteger(c.fk)) failures.push(`${where}: check ${JSON.stringify(c)}`)
          if (mine.answer.oneToOne) {
            const back = evalExpr(mine.answer.inverse!, { x: c.fk })
            if (back === 'undef' || Math.abs(back - c.k) > 1e-9) failures.push(`${where}: f⁻¹(${c.fk}) = ${back}`)
          } else {
            const ft = c.twin === undefined ? 'undef' : evalExpr(f, { x: c.twin })
            if (ft === 'undef' || Math.abs(ft - c.fk) > 1e-9 || c.twin === c.k) failures.push(`${where}: twin ${c.twin}`)
          }
        }
        // The generated answer line is found on hers (the flow's detectInverseCompletion compares with the stored inverse).
        if (gen.answer.oneToOne) {
          const line = gen.canonical[gen.canonical.length - 1]!.text
          const expr = normalizeInput(line).replace(/^\s*y\s*=\s*/, '')
          if (!parseExpression(expr, ['x']).ok || !sameInverse(expr, mine.answer.inverse!, mine.seed)) failures.push(`${where}: answer line ${line}`)
        }
        // The trap: the swap with only one letter renamed, named the same way by both checkers.
        const slip = misnamed(gen.start!)
        const a = verifyStep(gen.start!, slip, ctxOf(gen, true))
        const b = verifyStep(mine.start!, slip, ctxOf(mine, true))
        if (a.ok || b.ok || a.pattern?.id !== b.pattern?.id || b.pattern?.id !== 'swap_misname') {
          failures.push(`${where}: trap ${slip}: ${a.pattern?.id}/${b.pattern?.id}`)
        }
        if (mine.own !== gen.statementText || !mine.id.startsWith(`own:inverses/${gen.templateId}@`)) failures.push(`${where}: own ${mine.own}`)
      }
      expect(failures).toEqual([])
    })
  }
})

describe('her paths: every hinted line is one the engine keeps', () => {
  const TEMPLATE_SEEDS = SEEDS.slice(0, 12)
  for (const template of getModule('inverses').templates) {
    it(`${template.id}: swap first and solve first, ${TEMPLATE_SEEDS.length} seeds`, LONG, () => {
      const failures: string[] = []
      for (const seed of TEMPLATE_SEEDS) {
        const mine = ok(generateProblem('inverses', template.id, seed).statementText)
        for (const [name, path] of [
          ['canonical', mine.canonical],
          ['alt', mine.canonicalAlt ?? []],
        ] as const) {
          const bad = walk(mine, path)
          if (bad) failures.push(`${mine.id} ${name}: ${bad}`)
        }
      }
      expect(failures).toEqual([])
    })
  }

  it('her own numbers beyond the templates’ ranges', LONG, () => {
    const failures: string[] = []
    for (const text of [
      'f(x) = cbrt(5x - 2) + 4',
      'y = 7x - 12',
      'y = -x + 9',
      'y = x/2 + 1',
      'y = -(5/3)x - 4',
      'y = 0.5x + 2.5',
      'f(x) = cbrt(x/2 + 1) - 1',
      'y = 6/(2x - 3) + 1',
      'y = -3/(x + 4)',
      'y = (3x - 1)/(2x + 5)',
      'y = (x + 7)/(3x)',
      'y = (4)/(2x - 1)',
      'y = 3(x + 2)^2 - 7',
      'y = (1/2)(x - 4)^2',
      'y = -x^2 + 9',
    ]) {
      const mine = ok(text)
      for (const [name, path] of [
        ['canonical', mine.canonical],
        ['alt', mine.canonicalAlt ?? []],
      ] as const) {
        const bad = walk(mine, path)
        if (bad) failures.push(`${text} ${name}: ${bad}`)
      }
    }
    expect(failures).toEqual([])
  })
})

describe('wrong lines are seen on her own numbers, not only on the templates’', () => {
  it('a slipped number in each hinted line is refused, over random functions in the class', LONG, () => {
    const rng = makeRng(20261022)
    const failures: string[] = []
    let checked = 0
    for (let i = 0; i < 40; i++) {
      const p = rng.intExcept(-9, 9, [0])
      const q = rng.int(-20, 20)
      const r = rng.int(-9, 9)
      const c = rng.intExcept(-4, 4, [0])
      const forms = [`y = ${p}x + ${q}`, `y = cbrt(${Math.abs(p)}x + ${q}) + ${r}`, `y = ${p}/(${c}x + ${r}) + ${q % 10}`, `y = (${p}x + ${r})/(${c}x + ${q % 7})`]
      const text = forms[i % forms.length]!.replace(/\+ -/g, '- ')
      const res = own(text)
      if (!res.ok) continue
      const mine = res.instance
      // The line after the swap with its number nudged by one: a slip the engine has to see.
      const swapLine = mine.canonical[0]!.text
      const next = mine.canonical[1]
      if (!next) continue
      const slipped = next.text.replace(/(\d+)(?!.*\d)/, (d) => String(Number(d) + 1))
      if (slipped === next.text) continue
      const verdict = verifyStep(swapLine, slipped, ctxOf(mine, false))
      checked++
      if (verdict.ok) failures.push(`${text}: ${swapLine} → ${slipped} was kept`)
    }
    expect(failures).toEqual([])
    expect(checked).toBeGreaterThan(20)
  })
})

describe('her own problem: Precalculus Quiz 1, question 5', () => {
  const quiz = 'f(x) = ∛(5x − 2) + 4'

  it('is checked as a cube-root inverse with f⁻¹(x) = ((x − 4)³ + 2)/5', () => {
    const p = ok(quiz)
    expect(p.templateId).toBe('inv.cbrt-shift')
    expect(p.statementText).toBe('y = cbrt(5x - 2) + 4')
    expect(p.answer.type === 'inverse' && p.answer.inverse).toBe('((x - 4)^3 + 2)/5')
    expect(p.check).toEqual({ k: 2, fk: 6 })
  })

  it('names cubing before subtracting the 4, as the quiz regression does, and keeps her teacher’s order', () => {
    const p = ok(quiz)
    const swap = verifyStep(p.start!, 'x = cbrt(5y - 2) + 4', ctxOf(p, true))
    expect(swap.ok && swap.swapped).toBe(true)
    const slip = verifyStep('x = cbrt(5y - 2) + 4', 'x^3 = 5y - 2 + 4', ctxOf(p, false))
    const regression = verifyStep('x = cbrt(5y - 2) + 4', 'x^3 = 5y - 2 + 4', { vars: ['x', 'y'], seed: 1 })
    expect(slip.ok).toBe(false)
    expect(slip.pattern?.id).toBeDefined()
    expect(slip.pattern?.id).toBe(regression.pattern?.id)
    expect(verifyStep('x = cbrt(5y - 2) + 4', 'x - 4 = cbrt(5y - 2)', ctxOf(p, false)).ok).toBe(true)
    expect(verifyStep('x - 4 = cbrt(5y - 2)', '(x - 4)^3 = 5y - 2', ctxOf(p, false)).ok).toBe(true)
  })
})

describe('why not: what is outside inverses gets its reason', () => {
  const cases: [string, string, RegExp?][] = [
    ['x^2 + 4x + 1', 'quadratic_form', /vertex form.*\[quadratics\]/],
    ['(x - 1/2)^2 + 3', 'quadratic_form', /whole number for the shift/],
    ['sqrt(x - 1)', 'square_root', /restricted domain/],
    ['2^x + 1', 'exp_log', /Inverses of exponential and log functions are in \[expLogGraphs\]/],
    ['ln(x)', 'exp_log', /inside a log/],
    ['x^3 + 1', 'polynomial', /x\^\{3\}/],
    ['abs(x)', 'absolute_value', /not one-to-one/],
    ['5', 'constant', /no x in it/],
    ['(2x + 2)/(x + 1)', 'constant', /simplifies to a constant/],
    ['y = 2y + 1', 'y_inside', /y in it/],
    ['x = 2y + 1', 'not_function', /alone on the left/],
    ['2cbrt(x - 1)', 'cube_root_form', /nothing multiplying it/],
    ['(x^2 + 1)/(x - 1)', 'rational_form', /first power on top and below/],
    ['y > 2x + 1', 'inequality', /This is an inequality/],
    ['100x + 3000', 'far_curve', /far past where my line checks look/],
    ['2t + 1', 'letter', /^This uses the letter t, .*; type it with x in place of t, and I can check it\.$/],
    ['g(x) = 2x + 3', 'letter', /^This calls the function g, .*; type it as f\(x\) = 2x\+3, and I can check it\.$/],
    ['f(x) = 2x + k', 'letter', /^This has two letters, x and k/],
    ['y = 2x +', 'missing', /missing after the \+/],
    ['x +- 3', 'plus_minus', /±/],
    ['sin(x)', 'function', /function/],
    ['y = pi x', 'irrational', /π|pi/],
  ]
  for (const [text, code, words] of cases) {
    it(`${JSON.stringify(text)} → ${code}`, () => {
      const r = own(text)
      expect(r.ok, r.ok ? r.instance.id : '').toBe(false)
      if (r.ok) return
      expect(r.reason.code).toBe(code)
      if (words) expect(partsText(r.reason.parts)).toMatch(words)
      expect(typeof r.reason.parts[0] === 'string' && /^[A-Z]/.test(r.reason.parts[0] as string)).toBe(true)
    })
  }
})
