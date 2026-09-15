import { calcPanels } from '@/content/calc'
import { makeRng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { coeffVar, linearExpr, prettyInt, xShift } from '../format'
import { INVERSE_INSTRUCTIONS, SWAP_LAST_NUDGE, domainAround, inverseId, step } from './shared'

/** Integer check values of (ak + b)/(k + d): (k + d) | (ak + b), |f(k)| ≤ 12 (CG-04, exact integer arithmetic). */
export function mobiusChecks(a: number, b: number, d: number): { k: number; fk: number }[] {
  const out: { k: number; fk: number }[] = []
  for (let k = -8; k <= 8; k++) {
    const n = k + d
    if (n === 0) continue
    const num = a * k + b
    if (num % n !== 0) continue
    const fk = num / n
    if (Math.abs(fk) <= 12) out.push({ k, fk })
  }
  return out
}

/**
 * f(x) = (ax + b)/(x + d), c = 1. Δ = ad − b ≠ 0 (else f is constant) and a + d ≠ 0 (else f is its
 * own inverse, which reads as a mistake). Inverse: (b − dx)/(x − a); asymptotes x = −d, y = a swap.
 */
export const inverseMobiusTemplate: TemplateDef = {
  id: 'inv.mobius',
  title: 'Möbius inverse',
  description: 'Find the inverse of y = (ax + b)/(x + d). y shows up twice — collect, factor, divide.',
  version: 1,
  knobs: [],
  generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
    const rng = makeRng(seed)
    let a = 2
    let b = 1
    let d = 3
    let options = mobiusChecks(a, b, d)
    for (let tries = 0; tries < 48; tries++) {
      const ta = rng.sign() * rng.int(1, 5)
      const tb = rng.sign() * rng.int(1, 6)
      const td = rng.sign() * rng.int(1, 6)
      if (ta * td - tb === 0 || ta + td === 0) continue
      const found = mobiusChecks(ta, tb, td)
      if (found.length < 2) continue
      a = ta
      b = tb
      d = td
      options = found
      break
    }
    const { k, fk } = rng.pick(options)

    const sgn = (n: number) => (n > 0 ? '+' : '-')
    const term = (n: number, v: string) => coeffVar(Math.abs(n), v)
    const f = `(${linearExpr(a, b, 'x')})/(${xShift(d, 'x')})`
    /** b − d·v, the side that is left after the variable terms are collected. */
    const rest = (v: string) => `${b} ${sgn(-d)} ${term(d, v)}`
    const invDen = (v: string) => xShift(-a, v)
    const inverse = `(${rest('x')})/(${invDen('x')})`
    const collectTag = a > 0 ? 'sub_both' : 'add_both'

    const swapNudge = `Swap x and y: every x becomes y and every y becomes x. The asymptotes trade places too — f has x = ${prettyInt(-d)} and y = ${prettyInt(a)}, so f⁻¹ will have x = ${prettyInt(a)} and y = ${prettyInt(-d)}.`
    const clearNudge = (v: string) =>
      `Multiply both sides by (${xShift(d, v)}) to clear the denominator. On this curve (${xShift(d, v)}) is never 0, so nothing is lost.`
    const distributeNudge = (u: string, v: string) => `Distribute the ${u}: ${u}(${xShift(d, v)}) = ${u}${v} ${sgn(d)} ${term(d, u)}.`
    const collectNudge = (u: string, v: string) =>
      `${v} shows up on both sides. ${a > 0 ? 'Subtract' : 'Add'} ${term(a, v)} and ${d > 0 ? 'subtract' : 'add'} ${term(d, u)} on both sides — every ${v}-term lands on the left, everything else on the right.`
    const factorNudge = (u: string, v: string) =>
      `Factor ${v} out of the left side: ${u}${v} ${sgn(-a)} ${term(a, v)} = ${v}(${invDen(u)}).`
    const divNudge = (u: string, v: string) => `Divide both sides by (${invDen(u)}) — it is never 0 on this curve — and ${v} is alone.`
    const asymptotes = { vertical: -d, horizontal: a }

    /** The six moves after y = f(x) has been written with `u` as the known side and `v` as the letter to isolate. */
    const solve = (u: string, v: string) => [
      step(`${u}(${xShift(d, v)}) = ${linearExpr(a, b, v)}`, 'clear_denominator', clearNudge(v), 'clear-denominator', 'denominator cleared'),
      step(`xy ${sgn(d)} ${term(d, u)} = ${linearExpr(a, b, v)}`, 'distribute', distributeNudge(u, v), 'distribute', 'distributed'),
      step(`xy ${sgn(-a)} ${term(a, v)} = ${rest(u)}`, collectTag, collectNudge(u, v), 'add-sub', `${v} terms collected`),
      step(`${v}(${invDen(u)}) = ${rest(u)}`, 'factor', factorNudge(u, v), 'factor', `${v} factored out`),
      step(`${v} = (${rest(u)})/(${invDen(u)})`, 'div_both', divNudge(u, v), 'mul-div', `${v} isolated`),
    ]

    return {
      id: inverseId('inv.mobius', seed),
      moduleId: 'inverses',
      templateId: 'inv.mobius',
      skill: 'inv.mobius',
      genVersion: 1,
      seed,
      knobs,
      kind: 'inverse',
      title: 'Find the inverse (Möbius)',
      instructions: INVERSE_INSTRUCTIONS,
      statementText: `y = ${f}`,
      vars: ['x', 'y'],
      start: `y = ${f}`,
      canonical: [
        step(`x = (${linearExpr(a, b, 'y')})/(${xShift(d, 'y')})`, 'swap_xy', swapNudge, 'swap-xy', 'swapped'),
        ...solve('x', 'y'),
      ],
      canonicalAlt: [...solve('y', 'x'), step(`y = ${inverse}`, 'swap_xy', SWAP_LAST_NUDGE, 'swap-xy', 'y isolated')],
      answer: { type: 'inverse', oneToOne: true, inverse },
      graph: { kind: 'function', f, finv: inverse, showIdentity: true, xDomain: domainAround([-d, a, k, fk]) },
      calc: calcPanels({
        family: 'inverse-mobius',
        expr: f,
        inverseExpr: inverse,
        checkValue: k,
        checkOutput: fk,
        asymptotes,
      }),
      check: { k, fk },
      params: { a, b, c: 1, d, delta: a * d - b, k, fk, verticalAsymptote: -d, horizontalAsymptote: a },
    }
  },
}
