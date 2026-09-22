import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { makeRng, type Rng } from '@/content/rng'
import { composeText, compositeDomain } from '@/engine'
import { fraction, linearExpr, polyExpr } from '../fnExpr'
import { buildComposition, windowFrom } from './build'
import { COMP_RULE_IDS } from './rules'

const VERSION = 1
const TRIES = 24

const SHAPES = [
  'x2-sqrt',
  'x2-sqrt-shift',
  'recip-sqrt',
  'recip-sqrt-h',
  'sqrt-linear',
  'both-poly',
  'recip-linear',
] as const

type Shape = (typeof SHAPES)[number]

function pair(rng: Rng): { f: string; g: string; trap: Shape } {
  const trap = rng.pick(SHAPES)
  switch (trap) {
    case 'x2-sqrt':
      return { f: 'x^2', g: 'sqrt(x)', trap }
    case 'x2-sqrt-shift': {
      const p = rng.int(0, 4)
      const c = rng.int(0, 3)
      return { f: c === 0 ? 'x^2' : polyExpr([c, 0, 1]), g: p === 0 ? 'sqrt(x)' : `sqrt(${linearExpr(1, p)})`, trap }
    }
    case 'recip-sqrt':
      return { f: '1/(x - 2)', g: 'sqrt(x)', trap }
    case 'recip-sqrt-h': {
      const h = rng.int(1, 5)
      return { f: `1/(${linearExpr(1, -h)})`, g: 'sqrt(x)', trap }
    }
    case 'sqrt-linear': {
      const b = rng.int(-5, -1)
      return { f: 'sqrt(x)', g: linearExpr(1, b), trap }
    }
    case 'both-poly': {
      const a = rng.pick([1, 2, -1])
      return { f: polyExpr([rng.int(-3, 3), rng.int(-2, 2), a]), g: linearExpr(rng.intExcept(-3, 3, [0]), rng.int(-4, 4)), trap }
    }
    case 'recip-linear': {
      const h = rng.int(-4, 4)
      const a = rng.intExcept(-3, 3, [0])
      const b = rng.int(-4, 4)
      const denom = h === 0 ? 'x' : linearExpr(1, -h)
      return { f: fraction(1, denom), g: linearExpr(a, b), trap }
    }
  }
}

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const rng = makeRng(seed >>> 0)
  for (let n = 0; n < TRIES; n++) {
    const draft = pair(rng)
    const dom = compositeDomain(draft.f, draft.g)
    const text = composeText(draft.f, draft.g)
    if (!dom || !text) continue
    return buildComposition({
      templateId: 'comp.domain',
      version: VERSION,
      seed,
      knobs,
      title: 'Find the domain of f ∘ g',
      instructions: 'x has to be legal for g, and g(x) has to be legal for f. Interval notation.',
      statementText: `f(x) = ${draft.f}, g(x) = ${draft.g}`,
      graphF: text.unsimplified,
      window: windowFrom(dom.set),
      answer: {
        type: 'composition',
        question: 'domain',
        f: draft.f,
        g: draft.g,
        simplified: text.simplified,
        unsimplified: text.unsimplified,
        interval: dom.interval,
        builder: dom.builder,
        set: dom.set,
        hidesRestriction: dom.hidesRestriction,
        nudge: 'x has to be legal for g, and g(x) has to be legal for f. The simplified formula can hide one of those.',
        ruleCard: COMP_RULE_IDS.domain,
        ruleCards: [COMP_RULE_IDS.domain, COMP_RULE_IDS.order],
        reveal: dom.explanation,
        trap: draft.trap,
      },
      params: { f: draft.f, g: draft.g, trap: draft.trap, hides: dom.hidesRestriction },
    })
  }
  throw new Error(`comp.domain: no core-supported pair for seed ${seed}`)
}

export const domainTemplate: TemplateDef = {
  id: 'comp.domain',
  title: 'Domain of f ∘ g',
  description: 'Where f(g(x)) is defined, including the restrictions a simplified formula can hide.',
  version: VERSION,
  knobs: [],
  generate,
}
