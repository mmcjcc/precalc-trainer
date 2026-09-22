import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { makeRng, type Rng } from '@/content/rng'
import { rangeOf } from '@/engine'
import { addConst, fraction, linearExpr, polyExpr, scaledAtom } from '../fnExpr'
import { buildDomainRange } from './build'
import { DR_RULE_IDS } from './rules'

const VERSION = 1
const TRIES = 24

const RANGE_SHAPES = [
  'linear',
  'quadratic-up',
  'quadratic-down',
  'sqrt-up',
  'sqrt-down',
  'abs-up',
  'abs-down',
  'reciprocal',
  'cube-root',
] as const

type RangeShape = (typeof RANGE_SHAPES)[number]

const NUDGE: Record<RangeShape, string> = {
  linear: 'The range is the heights the graph reaches, not the inputs. A slanted line has no highest or lowest point.',
  'quadratic-up': 'A parabola has a vertex. The sign of the x^2 term says whether that vertex is the lowest point or the highest.',
  'quadratic-down': 'A parabola has a vertex. The sign of the x^2 term says whether that vertex is the lowest point or the highest.',
  'sqrt-up': 'A square root is never negative. Then look at the number in front of it, and anything added at the end.',
  'sqrt-down': 'The number in front of the square root is negative, so it flips the graph upside down. Which y-values can still happen?',
  'abs-up': 'An absolute value makes a V. The tip of the V is the vertex, and the number in front says whether it opens up or down.',
  'abs-down': 'The number in front of the absolute value is negative, so the V opens down. The tip is the highest point.',
  reciprocal: 'This graph has a horizontal asymptote. The y-value of that line is a height f never actually reaches.',
  'cube-root': 'A cube root keeps going forever in both directions. Which heights can it hit?',
}

function cardFor(shape: RangeShape): string {
  return shape === 'reciprocal' ? DR_RULE_IDS.asymptote : DR_RULE_IDS.outputs
}

/** Quadratic with an integer vertex (h, k), opening up or down. */
function quadratic(rng: Rng, sign: 1 | -1): string {
  const a = sign * rng.pick([1, 1, 2])
  const h = rng.int(-3, 3)
  const b = -2 * a * h
  const k = rng.int(-4, 5)
  const c = k - a * h * h - b * h
  return polyExpr([c, b, a])
}

/** a·fn(bx + c) + d, boundary of the inside at an integer. a is the signed outer coefficient. */
function atom(rng: Rng, fn: 'sqrt' | 'abs' | 'cbrt', a: number): string {
  const b = rng.int(1, 3)
  const endpoint = rng.int(-4, 4)
  const d = rng.int(-5, 5)
  return addConst(scaledAtom(a, fn, linearExpr(b, -b * endpoint)), d)
}

function draftShape(rng: Rng): { f: string; shape: RangeShape } {
  const shape = rng.pick(RANGE_SHAPES)
  switch (shape) {
    case 'linear':
      return { f: linearExpr(rng.intExcept(-5, 5, [0]), rng.int(-6, 6)), shape }
    case 'quadratic-up':
      return { f: quadratic(rng, 1), shape }
    case 'quadratic-down':
      return { f: quadratic(rng, -1), shape }
    case 'sqrt-up':
      return { f: atom(rng, 'sqrt', rng.pick([1, 1, 2, 3])), shape }
    case 'sqrt-down': {
      const classic = rng.chance(0.3)
      if (classic) return { f: '-2sqrt(x + 1) + 5', shape }
      return { f: atom(rng, 'sqrt', -rng.pick([1, 2, 2, 3])), shape }
    }
    case 'abs-up':
      return { f: atom(rng, 'abs', rng.pick([1, 1, 2])), shape }
    case 'abs-down':
      return { f: atom(rng, 'abs', -rng.pick([1, 1, 2])), shape }
    case 'reciprocal': {
      const classic = rng.chance(0.25)
      const a = classic ? 3 : rng.intExcept(-4, 4, [0])
      const h = classic ? 2 : rng.int(-5, 5)
      const k = classic ? 1 : rng.int(-4, 4)
      const denom = h === 0 ? 'x' : linearExpr(1, -h)
      return { f: addConst(fraction(a, denom), k), shape }
    }
    case 'cube-root':
      return { f: atom(rng, 'cbrt', rng.pick([1, 1, -1, 2])), shape }
  }
}

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const rng = makeRng(seed >>> 0)
  for (let n = 0; n < TRIES; n++) {
    const draft = draftShape(rng)
    const range = rangeOf(draft.f)
    if (!range) continue
    const primary = cardFor(draft.shape)
    return buildDomainRange({
      question: 'range',
      templateId: 'dr.range',
      version: VERSION,
      seed,
      knobs,
      title: 'Find the range of f',
      instructions: 'Write the set of outputs in interval notation. Set-builder in y is fine too.',
      f: draft.f,
      interval: range.interval,
      builder: range.builder,
      set: range.set,
      family: range.family,
      nudge: NUDGE[draft.shape],
      ruleCard: primary,
      ruleCards: draft.shape === 'reciprocal' ? [DR_RULE_IDS.asymptote, DR_RULE_IDS.outputs] : [DR_RULE_IDS.outputs],
      reveal: range.explanation,
      trap: draft.shape,
    })
  }
  throw new Error(`dr.range: no core-supported function for seed ${seed}`)
}

export const rangeTemplate: TemplateDef = {
  id: 'dr.range',
  title: 'Range of f',
  description: 'The set of outputs: lines, parabolas both ways, roots, absolute values, and a horizontal asymptote left out.',
  version: VERSION,
  knobs: [],
  generate,
}
