/**
 * Regression tests for the engine-routes review findings ER-1 … ER-10.
 * Like the sweep, the template walks read content instances (test-only import from @/content).
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content/index'
import type { ProblemInstance } from '@/content/types'
import type { StepContext, StepResult } from '@/shared/types'
import { CHIP_OF_TAG, REWRITE_CHIPS } from '@/shared/types'
import { verifyRewrite } from './expressions'
import { parseStatement } from './parse'
import { findRootsOf } from './roots'
import { statementHolds } from './samples'
import { verifyStep } from './step'

const XY: StepContext = { vars: ['x', 'y'], seed: 1 }
const X1: StepContext = { vars: ['x'], seed: 1 }

function show(r: StepResult): string {
  return JSON.stringify({ ok: r.ok, verdict: r.verdict, detected: r.detected, chips: r.acceptableChips, pattern: r.pattern?.id, witness: r.pattern?.witness, ce: r.counterexample?.message })
}

function holds(line: string, scope: Record<string, number>): boolean {
  const p = parseStatement(line, ['x', 'y'])
  if (!p.ok) throw new Error(p.error.message)
  return statementHolds(p.statement, scope) === true
}

function ctxOf(p: ProblemInstance, allowSwap: boolean): StepContext {
  const c: StepContext = { vars: p.vars, seed: p.seed, allowSwap }
  if (p.check?.k != null) c.checkValue = p.check.k
  return c
}

/** "2 = 2 → FALSE": an equation whose shown sides agree must never be labelled FALSE. */
const SELF_CONTRADICTION = /(?:^|\s)(−?[\d./]+) = \1 → FALSE/

describe('ER-1: ± between two terms', () => {
  it('y = 2 +- sqrt(x) is y = 2 + sqrt(x) or y = 2 - sqrt(x)', () => {
    expect(holds('y = 2 +- sqrt(x)', { x: 9, y: 5 })).toBe(true)
    expect(holds('y = 2 +- sqrt(x)', { x: 9, y: -1 })).toBe(true)
    expect(holds('y = 2 +- sqrt(x)', { x: 9, y: 6 })).toBe(false)
  })

  it('x = 3 +- 2 is x = 5 or x = 1', () => {
    expect(holds('x = 3 +- 2', { x: 5 })).toBe(true)
    expect(holds('x = 3 +- 2', { x: 1 })).toBe(true)
    expect(holds('x = 3 +- 2', { x: 32 })).toBe(false)
    expect(holds('x = 3 ± 2', { x: 5 })).toBe(true)
  })

  it('x = +-3 still means x = 3 or x = -3', () => {
    expect(holds('x = +-3', { x: 3 })).toBe(true)
    expect(holds('x = +-3', { x: -3 })).toBe(true)
    expect(holds('x = +-3', { x: 0 })).toBe(false)
  })

  it('the quadratic ± line is accepted as root_both_pm', () => {
    const q = generateProblem('inverses', 'inv.quadratic-not', 2)
    const ctx = ctxOf(q, false)
    const r = verifyStep('(y + 2)^2 = (x - 1)/2', 'y = -2 +- sqrt((x - 1)/2)', ctx)
    expect(r.ok, show(r)).toBe(true)
    expect(r.detected?.tag).toBe('root_both_pm')
    expect(r.acceptableChips).toContain('root_both')
    const r2 = verifyStep('y + 2 = +-sqrt((x - 1)/2)', 'y = -2 +- sqrt((x - 1)/2)', ctx)
    expect(r2.ok, show(r2)).toBe(true)
    const r3 = verifyStep('x^2 = 9', 'x = 0 +- 3', X1)
    expect(r3.ok, show(r3)).toBe(true)
    const r4 = verifyStep('(x - 1)^2 = 9', 'x = 1 +- 3', X1)
    expect(r4.ok, show(r4)).toBe(true)
    expect(r4.detected?.tag).toBe('root_both_pm')
  })
})

describe('ER-2: infinite-slope roots (cube roots)', () => {
  it('a bisected root of cbrt is a root, a pole of 1/(t-2) stays a pole', () => {
    const cb = findRootsOf((t) => ({ g: -Math.cbrt(3 * t + 10), scale: 2 }))
    expect(cb.roots.some((r) => Math.abs(r + 10 / 3) < 1e-6)).toBe(true)
    expect(cb.poles).toEqual([])
    // Off the grid (a grid point exactly on the pole is 'undef' and brackets nothing).
    const pole = findRootsOf((t) => {
      const v = 1 / (t - 2.013)
      return Number.isFinite(v) ? { g: v, scale: Math.max(1, Math.abs(v)) } : 'undef'
    })
    expect(pole.roots).toEqual([])
    expect(pole.poles.some((r) => Math.abs(r - 2.013) < 1e-6)).toBe(true)
  })

  for (const seed of [1, 6, 10, 12]) {
    it(`inv.cbrt-shift seed ${seed}: swap line → final inverse in one line is accepted`, () => {
      const p = generateProblem('inverses', 'inv.cbrt-shift', seed)
      const inv = (p.answer as { inverse?: string }).inverse!
      const r = verifyStep(p.canonical[0]!.text, `y = ${inv}`, ctxOf(p, false))
      expect(r.ok, `${p.canonical[0]!.text} -> y = ${inv}\n${show(r)}`).toBe(true)
      const r2 = verifyStep(p.start!, `x = ${inv.replaceAll('x', 'y')}`, ctxOf(p, true))
      expect(r2.ok, show(r2)).toBe(true)
    })
  }

  it('the seed-1 scenario and its variants', () => {
    const p = generateProblem('inverses', 'inv.cbrt-shift', 1)
    const ctx = ctxOf(p, false)
    for (const [a, b] of [
      ['x = cbrt(3y + 10) + 2', 'y = ((x - 2)^3 - 10)/3'],
      ['x = cbrt(3y + 10) + 2', 'y = (x - 2)^3/3 - 10/3'],
      ['x - 2 = cbrt(3y + 10)', 'y = (x - 2)^3/3 - 10/3'],
      ['x = cbrt(3y + 10) + 2', '3y + 10 = (x - 2)^3'],
    ] as const) {
      const r = verifyStep(a, b, ctx)
      expect(r.ok, `${a} -> ${b}\n${show(r)}`).toBe(true)
    }
    const r = verifyStep('x = cbrt(3y + 10) + 2', 'y = ((x - 2)^3 - 10)/3', { ...ctx, seed: 12345 })
    expect(r.ok, show(r)).toBe(true)
  })

  it('wrong cube-root lines are still rejected, and no counterexample calls a true equation FALSE', () => {
    const p = generateProblem('inverses', 'inv.cbrt-shift', 1)
    const ctx = ctxOf(p, false)
    for (const [a, b] of [
      ['x = cbrt(3y + 10) + 2', 'y = ((x - 2)^3 - 11)/3'],
      ['x = cbrt(3y + 10) + 2', 'y = ((x + 2)^3 - 10)/3'],
      ['x - 2 = cbrt(3y + 10)', '(x - 2)^3 = 3y + 12'],
      ['x = cbrt(3y + 10) + 2', 'x = cbrt(3y + 12)'],
      ['x = cbrt(3y + 1) + 2', 'y = (x - 2)^3/3'],
    ] as const) {
      const r = verifyStep(a, b, ctx)
      expect(r.ok, `${a} -> ${b}\n${show(r)}`).toBe(false)
      expect(r.counterexample?.message ?? '', `${a} -> ${b}`).not.toMatch(SELF_CONTRADICTION)
    }
  })
})

describe('ER-3: canonical anchoring matches the same line', () => {
  const tags = (r: StepResult) => r.detected
  for (const moduleId of ['inequalities', 'inverses'] as const) {
    for (const t of getModule(moduleId).templates) {
      it(`${t.id}: every canonical step keeps its own chip`, { timeout: 120_000 }, () => {
        const problems: string[] = []
        for (let seed = 1; seed <= 5; seed++) {
          const p = generateProblem(moduleId, t.id, seed)
          const canonical = [...p.canonical, ...(p.canonicalAlt ?? [])].map((s) => s.text)
          let prev = p.start!
          let swapped = false
          for (const step of p.canonical) {
            const ctx: StepContext = { ...ctxOf(p, p.kind === 'inverse' && !swapped), canonical }
            const r = verifyStep(prev, step.text, ctx)
            const want = CHIP_OF_TAG[step.tag]
            const det = tags(r)
            const detOk =
              !det || det.chip === want || (REWRITE_CHIPS.includes(want) && REWRITE_CHIPS.includes(det.chip))
            if (!r.ok || !r.acceptableChips.includes(want) || !detOk) {
              problems.push(`[${t.id} s${seed}] ${prev} -> ${step.text} tag=${step.tag} (${want}) :: ${show(r)}`)
            }
            if (r.swapped) swapped = true
            prev = step.text
          }
        }
        expect(problems).toEqual([])
      })
    }
  }

  it('mul_div is not a correct chip for the add/subtract step of a one-variable problem', () => {
    const canonical = ['2x > 2', 'x > 1']
    const r = verifyStep('2x + 8 > 10', '2x > 2', { ...X1, canonical: ['2x + 8 > 10', ...canonical] })
    expect(r.detected?.tag).toBe('sub_both')
    expect(r.acceptableChips).toEqual(['add_sub'])
  })
})

describe('ER-4: negative coefficients keep their sign', () => {
  it('(a) -2x - 4 < -8 -> -2x < -12 is not combine_unlike', () => {
    const r = verifyStep('-2x - 4 < -8', '-2x < -12', { vars: ['x'], seed: 8 })
    expect(r.ok).toBe(false)
    expect(r.pattern?.id).not.toBe('combine_unlike')
    expect(r.pattern?.id).toBe('term_across_sign')
    expect(r.pattern?.witness).toBe('Moving −4 to the other side means adding 4 to both sides, so it arrives as 4.')
  })

  it('(b) x = -3y - 6 -> x - 6 = -3y is term_across_sign', () => {
    const r = verifyStep('x = -3y - 6', 'x - 6 = -3y', { vars: ['x', 'y'], seed: 3, allowSwap: false })
    expect(r.ok).toBe(false)
    expect(r.pattern?.id, show(r)).toBe('term_across_sign')
  })

  it('(c) x = -4y - 3 -> y = -4x - 3 or y = 1/(-4x - 3) gets no combine_unlike', () => {
    for (const next of ['y = -4x - 3', 'y = 1/(-4x - 3)']) {
      const r = verifyStep('x = -4y - 3', next, { vars: ['x', 'y'], seed: 4 })
      expect(r.ok).toBe(false)
      expect(r.pattern?.id, show(r)).not.toBe('combine_unlike')
      expect(r.counterexample).toBeTruthy()
    }
  })

  it('(d)/(e) a negative coefficient gets reciprocal_coeff', () => {
    for (const [prev, next] of [
      ['x + 6 = -2y', 'y = x/-2 + 6'],
      ['x + 6 = -2y', 'y = (-1/2)x + 6'],
      ['x + 6 = -2y', 'y = -x/2 + 6'],
      ['x - 1 = -(3/4)y', 'y = (-4/3)x - 1'],
      ['x - 4 = 2y', 'y = x/2 - 4'],
    ] as const) {
      const r = verifyStep(prev, next, XY)
      expect(r.pattern?.id, `${prev} -> ${next}\n${show(r)}`).toBe('reciprocal_coeff')
    }
  })
})

describe('ER-5: term across an inequality sign', () => {
  it('names the moved term on inequalities too', () => {
    for (const [prev, next, vars] of [
      ['x + 5 < 2', 'x < 7', ['x']],
      ['2x + 8 > 10', '2x > 18', ['x']],
      ['(1/4)y + 3 > 1', '(1/4)y > 4', ['y']],
      ['x + 5 = 2', 'x = 7', ['x']],
    ] as const) {
      const r = verifyStep(prev, next, { vars: [...vars], seed: 1 })
      expect(r.ok).toBe(false)
      expect(r.pattern?.id, `${prev} -> ${next}\n${show(r)}`).toBe('term_across_sign')
      expect(r.pattern?.lesson).toMatch(/inequality/)
    }
  })
})

describe('ER-6: swap combined with a solving move', () => {
  for (let seed = 1; seed <= 5; seed++) {
    it(`inv.linear seed ${seed}: typing the inverse straight from the start is accepted as a swap`, () => {
      const p = generateProblem('inverses', 'inv.linear', seed)
      const inv = (p.answer as { inverse?: string }).inverse!
      const r = verifyStep(p.start!, `y = ${inv}`, ctxOf(p, true))
      expect(r.ok, show(r)).toBe(true)
      expect(r.verdict).toBe('equivalent_by_rename')
      expect(r.swapped).toBe(true)
      expect(r.detected?.tag).toBe('swap_xy')
      expect(r.detected?.detail).toMatch(/^swapped x and y and /)
      expect(r.acceptableChips[0]).toBe('swap_xy')
    })
  }

  it('the seed-1 scenarios, and a wrong swap is still rejected', () => {
    const p = generateProblem('inverses', 'inv.linear', 1)
    const ctx = ctxOf(p, true)
    for (const [prev, next] of [
      ['y = -2x - 6', 'y = (x + 6)/-2'],
      ['y = -2x - 6', 'x + 6 = -2y'],
      ['y + 6 = -2x', '(x + 6)/-2 = y'],
    ] as const) {
      const r = verifyStep(prev, next, ctx)
      expect(r.ok, `${prev} -> ${next}\n${show(r)}`).toBe(true)
      expect(r.swapped).toBe(true)
      expect(r.acceptableChips).toContain('swap_xy')
    }
    const divided = verifyStep('y = -2x - 6', 'y = (x + 6)/-2', ctx)
    expect(divided.acceptableChips).toContain('mul_div')

    const wrong = verifyStep('y = -2x - 6', 'y = (x - 6)/-2', ctx)
    expect(wrong.ok).toBe(false)
    expect(wrong.swapped).toBeUndefined()
    const noSwap = verifyStep('y = -2x - 6', 'y = (x + 6)/-2', { ...ctx, allowSwap: false })
    expect(noSwap.ok).toBe(false)
  })
})

describe('ER-7: doc-listed step errors get their lesson', () => {
  it('root spread over a sum is power_over_sum', () => {
    for (const [prev, next] of [
      ['x = cbrt(2y + 12)', 'x = cbrt(2y) + cbrt(12)'],
      ['x = cbrt(3y + 10) + 2', 'x = cbrt(3y) + cbrt(10) + 2'],
    ] as const) {
      const r = verifyStep(prev, next, { ...XY, allowSwap: false })
      expect(r.pattern?.id, `${prev} -> ${next}\n${show(r)}`).toBe('power_over_sum')
    }
  })

  it('a minus over a sum that reaches one term is negative_not_distributed', () => {
    const r = verifyRewrite('-(4x^3 + 3x^2)', '-4x^3 + 3x^2', { vars: ['x'], seed: 3 })
    expect(r.ok).toBe(false)
    expect(r.pattern?.id, show(r)).toBe('negative_not_distributed')
  })

  it('multiplying by the coefficient instead of its reciprocal is reciprocal_coeff', () => {
    const a = verifyStep('x - 6 = (3/4)y', 'y = (3/4)(x - 6)', XY)
    expect(a.pattern?.id, show(a)).toBe('reciprocal_coeff')
    expect(a.pattern?.witness).toMatch(/4\/3/)
    const b = verifyStep('(5/4)y > 4', 'y > 5', { vars: ['y'], seed: 1 })
    expect(b.pattern?.id, show(b)).toBe('reciprocal_coeff')
  })
})

describe('ER-8: a chain read backwards without turning the symbols', () => {
  it('is swap_sides_no_reverse, not no_sign_flip', () => {
    for (const [prev, next] of [
      ['0 > x > -1', '-1 > x > 0'],
      ['-1 < x < 0', '0 < x < -1'],
      ['2 > x > 0', '0 > x > 2'],
    ] as const) {
      const r = verifyStep(prev, next, X1)
      expect(r.ok).toBe(false)
      expect(r.pattern?.id, `${prev} -> ${next}\n${show(r)}`).toBe('swap_sides_no_reverse')
    }
  })
})

describe('ER-9: pattern witnesses show a point where the sides differ', () => {
  const SAME = /gives (−?[\d./]+), yours gives \1\./
  it('skips points where both sides agree', () => {
    for (const [a, b] of [
      ['cbrt(-x)', 'cbrt(x)'],
      ['4(-x)^3 + 3(-x)^2', '-4x^3 - 3x^2'],
      ['sqrt(25-(-x)^2)', 'sqrt(25+x^2)'],
      ['(-x)^2 + 1', '-x^2 + 1'],
    ] as const) {
      const r = verifyRewrite(a, b, { vars: ['x'], seed: 3 })
      expect(r.pattern, `${a} -> ${b}`).toBeTruthy()
      expect(r.pattern?.witness ?? '', `${a} -> ${b}`).not.toMatch(SAME)
    }
  })

  it('names every variable the sides use', () => {
    const r = verifyStep('x(y+2) = 5', 'xy + 2 = 5', XY)
    expect(r.pattern?.id).toBe('partial_distribute')
    expect(r.pattern?.witness).toMatch(/x = [^,]+, y = /)
  })
})

describe('ER-10: reading a chain the other way', () => {
  const p = generateProblem('inequalities', 'ineq.compound', 6, { negativeLead: true })
  const canonical = [...p.canonical, ...(p.canonicalAlt ?? [])].map((s) => s.text)
  const ctx: StepContext = { ...ctxOf(p, false), canonical }

  it('0 > x > -1 -> -1 < x < 0 is swap_sides', () => {
    const r = verifyStep('0 > x > -1', '-1 < x < 0', ctx)
    expect(r.ok, show(r)).toBe(true)
    expect(r.detected?.tag).toBe('swap_sides')
    expect(r.acceptableChips).toContain('swap_sides')
    const bare = verifyStep('0 > x > -1', '-1 < x < 0', X1)
    expect(bare.detected?.tag).toBe('swap_sides')
  })

  it('divide and reorder in one line offers mul_div and swap_sides', () => {
    for (const next of ['-1 < x < 0', 'x > -1 and x < 0']) {
      const r = verifyStep('0 < -4x < 4', next, ctx)
      expect(r.ok, show(r)).toBe(true)
      expect(r.acceptableChips, `${next}\n${show(r)}`).toContain('mul_div')
    }
    const r = verifyStep('0 < -4x < 4', '-1 < x < 0', ctx)
    expect(r.acceptableChips).toContain('swap_sides')
  })
})
