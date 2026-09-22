import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { domainOf } from '@/engine'
import { makeRng, type Rng } from '@/content/rng'
import { addConst, fraction, linearExpr, polyExpr, scaledAtom } from '../fnExpr'
import { buildDomainRange } from './build'
import { DR_RULE_IDS } from './rules'

const VERSION = 1
const TRIES = 24

const DOMAIN_SHAPES = [
  'denominator',
  'square-root',
  'root-and-denominator',
  'root-in-denominator',
  'negative-under-root',
  'cube-root',
  'polynomial',
  'factored-denominator',
] as const

type DomainShape = (typeof DOMAIN_SHAPES)[number]

const NUDGE: Record<DomainShape, string> = {
  denominator: 'There is a fraction. Whatever is under the bar is not allowed to be 0 — even when it is negative.',
  'square-root': 'A square root only accepts an inside that is at least 0. Solve that inequality, and keep the endpoint.',
  'root-and-denominator': 'Two things can knock an x out: the square root, and the denominator. Write both.',
  'root-in-denominator': 'The square root is underneath the fraction. If the inside is 0, you would be dividing by 0.',
  'negative-under-root': 'Look at the number in front of x inside the root. It is negative, and dividing by a negative flips the inequality.',
  'cube-root': 'This is a cube root. Cube roots are fine with negatives — ask yourself whether anything else restricts x.',
  polynomial: 'There is no denominator and no even root here. What inputs does a polynomial accept?',
  'factored-denominator': 'The denominator factors. Each factor is its own place where the bottom can be 0.',
}

const CARD: Record<DomainShape, string> = {
  denominator: DR_RULE_IDS.denominator,
  'square-root': DR_RULE_IDS.evenRoot,
  'root-and-denominator': DR_RULE_IDS.denominator,
  'root-in-denominator': DR_RULE_IDS.rootDenom,
  'negative-under-root': DR_RULE_IDS.flip,
  'cube-root': DR_RULE_IDS.anyInput,
  polynomial: DR_RULE_IDS.anyInput,
  'factored-denominator': DR_RULE_IDS.denominator,
}

/** Related cards after the primary one, so a problem with two restrictions still has both. */
function cardsFor(shape: DomainShape): string[] {
  if (shape === 'root-and-denominator') return [DR_RULE_IDS.denominator, DR_RULE_IDS.evenRoot]
  if (shape === 'negative-under-root') return [DR_RULE_IDS.flip, DR_RULE_IDS.evenRoot]
  if (shape === 'root-in-denominator') return [DR_RULE_IDS.rootDenom, DR_RULE_IDS.evenRoot]
  return [CARD[shape]]
}

/** A linear radicand bx + c whose boundary -c/b is the integer `endpoint`. b > 0 opens to the right. */
function radicand(b: number, endpoint: number): string {
  return linearExpr(b, -b * endpoint)
}

function draftShape(rng: Rng): { f: string; shape: DomainShape } {
  const shape = rng.pick(DOMAIN_SHAPES)
  switch (shape) {
    case 'denominator': {
      const a = rng.intExcept(-4, 4, [0])
      const h = rng.chance(0.2) ? 3 : rng.int(-6, 6)
      const k = rng.int(-4, 4)
      const denom = h === 0 ? 'x' : linearExpr(1, -h)
      return { f: addConst(fraction(a, denom), k), shape }
    }
    case 'square-root': {
      const classic = rng.chance(0.2)
      const b = classic ? 1 : rng.int(1, 3)
      const endpoint = classic ? -2 : rng.int(-5, 4)
      const a = rng.pick([1, 1, 2])
      const d = classic ? 0 : rng.int(-4, 4)
      return { f: addConst(scaledAtom(a, 'sqrt', radicand(b, endpoint)), d), shape }
    }
    case 'root-and-denominator': {
      const classic = rng.chance(0.35)
      const rootAt = classic ? -2 : rng.int(-4, 3)
      const hole = classic ? 3 : rng.int(rootAt + 1, rootAt + 6)
      const numer = rng.pick([1, 1, 2])
      const root = scaledAtom(numer, 'sqrt', linearExpr(1, -rootAt))
      const denom = linearExpr(1, -hole)
      const bottom = /^[A-Za-z]$/.test(denom) ? denom : `(${denom})`
      return { f: `${root}/${bottom}`, shape }
    }
    case 'root-in-denominator': {
      const classic = rng.chance(0.35)
      const h = classic ? 1 : rng.int(-4, 5)
      const a = rng.pick([1, 1, 2])
      return { f: fraction(a, scaledAtom(1, 'sqrt', linearExpr(1, -h))), shape }
    }
    case 'negative-under-root': {
      // The textbook flip, often enough that the first 300 seeds always include it.
      if (rng.chance(0.45)) return { f: 'sqrt(-2x + 6)', shape }
      const b = rng.int(1, 3)
      const endpoint = rng.int(-3, 5)
      const a = rng.pick([1, 1, 2])
      const d = rng.int(-3, 3)
      // -b x + b*endpoint ≥ 0 flips to x ≤ endpoint.
      return { f: addConst(scaledAtom(a, 'sqrt', linearExpr(-b, b * endpoint)), d), shape }
    }
    case 'cube-root': {
      const classic = rng.chance(0.25)
      const h = classic ? 2 : rng.int(-5, 5)
      const a = rng.pick([1, 1, -1, 2])
      const d = rng.int(-3, 3)
      return { f: addConst(scaledAtom(a, 'cbrt', linearExpr(1, -h)), d), shape }
    }
    case 'polynomial': {
      const deg = rng.pick([1, 2, 2, 3] as const)
      if (deg === 1) return { f: linearExpr(rng.intExcept(-5, 5, [0]), rng.int(-6, 6)), shape }
      if (deg === 2) {
        const a = rng.pick([1, 1, -1, 2])
        return { f: polyExpr([rng.int(-6, 6), rng.int(-5, 5), a]), shape }
      }
      const a = rng.pick([1, 1, -1, 2])
      return { f: polyExpr([rng.int(-4, 4), rng.int(-3, 3), rng.int(-3, 3), a]), shape }
    }
    case 'factored-denominator': {
      const classic = rng.chance(0.3)
      const r = classic ? 3 : rng.int(-5, 5)
      const s = classic ? -3 : rng.intExcept(-5, 5, [r])
      const denom = polyExpr([r * s, -(r + s), 1])
      const numer = rng.intExcept(-3, 3, [0, r, s])
      return { f: fraction(numer, denom), shape }
    }
  }
}

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const rng = makeRng(seed >>> 0)
  for (let n = 0; n < TRIES; n++) {
    const draft = draftShape(rng)
    const dom = domainOf(draft.f)
    if (!dom) continue
    return buildDomainRange({
      question: 'domain',
      templateId: 'dr.domain',
      version: VERSION,
      seed,
      knobs,
      title: 'Find the domain of f',
      instructions: 'Write it in interval notation. Set-builder, or “all real numbers except 3”, works too.',
      f: draft.f,
      interval: dom.interval,
      builder: dom.builder,
      set: dom.set,
      nudge: NUDGE[draft.shape],
      ruleCard: CARD[draft.shape],
      ruleCards: cardsFor(draft.shape),
      reveal: dom.explanation,
      trap: draft.shape,
    })
  }
  throw new Error(`dr.domain: no core-supported function for seed ${seed}`)
}

export const domainTemplate: TemplateDef = {
  id: 'dr.domain',
  title: 'Domain of f',
  description: 'Interval notation for the inputs a formula accepts: denominators, roots, and the negative-coefficient flip.',
  version: VERSION,
  knobs: [],
  generate,
}
