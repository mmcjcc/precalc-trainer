import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { makeRng, type Rng } from '@/content/rng'
import { checkDecomposition, compositeDomain, domainOf } from '@/engine'
import { addConst, fraction, nonTrivialLinear } from '../fnExpr'
import { buildComposition, windowFrom } from './build'
import { COMP_RULE_IDS } from './rules'

const VERSION = 1
const TRIES = 24

const SHAPES = ['square', 'cube', 'recip', 'recip-square', 'sqrt', 'abs'] as const
type Shape = (typeof SHAPES)[number]

function draft(rng: Rng): { h: string; f: string; g: string; trap: Shape } {
  const trap = rng.pick(SHAPES)
  const a = rng.intExcept(-4, 4, [0])
  let b = rng.int(-6, 6)
  if (a === 1 && b === 0) b = 2
  const g = nonTrivialLinear(a, b)
  switch (trap) {
    case 'square':
      return { h: `(${g})^2`, f: 'x^2', g, trap }
    case 'cube':
      return { h: `(${g})^3`, f: 'x^3', g, trap }
    case 'recip': {
      const coef = rng.intExcept(-3, 3, [0])
      const k = rng.int(-3, 3)
      return { h: addConst(fraction(coef, g), k), f: addConst(fraction(coef, 'x'), k), g, trap }
    }
    case 'recip-square':
      return { h: `1/(${g})^2`, f: '1/x^2', g, trap }
    case 'sqrt': {
      const d = rng.int(-3, 3)
      return { h: addConst(`sqrt(${g})`, d), f: addConst('sqrt(x)', d), g, trap }
    }
    case 'abs': {
      const d = rng.int(-3, 3)
      return { h: addConst(`abs(${g})`, d), f: addConst('abs(x)', d), g, trap }
    }
  }
}

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const rng = makeRng(seed >>> 0)
  for (let n = 0; n < TRIES; n++) {
    const item = draft(rng)
    const verdict = checkDecomposition(item.h, item.f, item.g)
    const dom = domainOf(item.h)
    const composed = compositeDomain(item.f, item.g)
    if (!verdict.ok || !dom || !composed) continue
    return buildComposition({
      templateId: 'comp.decompose',
      version: VERSION,
      seed,
      knobs,
      title: 'Decompose h',
      instructions: 'Find an outer function f and an inner function g so that h(x) = f(g(x)). Neither one should be just x. More than one pair can be right.',
      statementText: `h(x) = ${item.h}`,
      graphF: item.h,
      window: windowFrom(dom.set),
      answer: {
        type: 'composition',
        question: 'decompose',
        f: item.f,
        g: item.g,
        h: item.h,
        nudge: 'h does an inside job and then an outside job. Let g be the inside and f the outside. Neither one should be just x.',
        ruleCard: COMP_RULE_IDS.order,
        ruleCards: [COMP_RULE_IDS.order, COMP_RULE_IDS.parens],
        reveal: [
          `One way: f(x) = ${item.f} and g(x) = ${item.g}.`,
          verdict.message,
          'Another split can be right too, as long as f(g(x)) really is h(x) and neither function is just x.',
        ],
        trap: item.trap,
      },
      params: { h: item.h, f: item.f, g: item.g, trap: item.trap },
    })
  }
  throw new Error(`comp.decompose: no core-supported decomposition for seed ${seed}`)
}

export const decomposeTemplate: TemplateDef = {
  id: 'comp.decompose',
  title: 'Decompose h',
  description: 'Write h as f(g(x)). Any non-trivial pair that really composes to h is right.',
  version: VERSION,
  knobs: [],
  generate,
}
