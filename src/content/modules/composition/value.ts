import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { makeRng, type Rng } from '@/content/rng'
import { compositeDomain, compositeValue } from '@/engine'
import { linearExpr, polyExpr } from '../fnExpr'
import { buildComposition, windowFrom } from './build'
import { COMP_RULE_IDS } from './rules'

const VERSION = 1
const TRIES = 24

interface Pair {
  f: string
  g: string
  a: number
  /** 'undefined' when (f ∘ g)(a) does not exist; otherwise a defined exact value. */
  trap: 'undefined' | 'defined'
}

/**
 * Shapes pinned so some seeds are undefined and the defined ones stay exact (integer or a square root
 * the core can write). The classic product/reversed pair is included on its own.
 */
function pair(rng: Rng): Pair {
  const shape = rng.pick([
    'classic',
    'poly',
    'sqrt-undef',
    'sqrt-def',
    'recip-undef',
    'inner-undef',
    'inner-def',
    'recip-sqrt-undef',
  ] as const)
  switch (shape) {
    case 'classic':
      return { f: '2x + 5', g: 'x^2 - 1', a: 2, trap: 'defined' }
    case 'poly': {
      const af = rng.intExcept(-4, 4, [0])
      const ag = rng.pick([1, 1, 2, -1])
      return {
        f: linearExpr(af, rng.int(-5, 5)),
        g: polyExpr([rng.int(-4, 4), rng.int(-3, 3), ag]),
        a: rng.int(-2, 4),
        trap: 'defined',
      }
    }
    case 'sqrt-undef':
      return { f: 'sqrt(x)', g: linearExpr(1, rng.pick([-5, -4, -3])), a: rng.pick([-1, 0, 1, 2]), trap: 'undefined' }
    case 'sqrt-def':
      return { f: 'sqrt(x)', g: 'x - 5', a: rng.pick([5, 6, 9]), trap: 'defined' }
    case 'recip-undef': {
      const h = rng.int(1, 4)
      return { f: `1/(${linearExpr(1, -h)})`, g: 'x', a: h, trap: 'undefined' }
    }
    case 'inner-undef':
      return { f: polyExpr([rng.int(0, 3), 0, 1]), g: 'sqrt(x)', a: rng.pick([-4, -1]), trap: 'undefined' }
    case 'inner-def':
      return { f: linearExpr(rng.pick([1, 2, 3]), rng.int(-3, 3)), g: 'sqrt(x)', a: rng.pick([0, 1, 4, 9]), trap: 'defined' }
    case 'recip-sqrt-undef':
      return { f: '1/(x - 2)', g: 'sqrt(x)', a: 4, trap: 'undefined' }
  }
}

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const rng = makeRng(seed >>> 0)
  for (let n = 0; n < TRIES; n++) {
    const draft = pair(rng)
    const value = compositeValue(draft.f, draft.g, draft.a)
    const dom = compositeDomain(draft.f, draft.g)
    if (!value || !dom) continue
    if (draft.trap === 'undefined' && value.defined) continue
    if (draft.trap === 'defined' && (!value.defined || value.value.exact === null)) continue
    const valueText = value.defined ? value.value.text : 'undefined'
    return buildComposition({
      templateId: 'comp.value',
      version: VERSION,
      seed,
      knobs,
      title: `Find (f ∘ g)(${draft.a})`,
      instructions: 'A number, a fraction, a square root like 2sqrt(3), or undefined.',
      statementText: `f(x) = ${draft.f}, g(x) = ${draft.g}`,
      graphF: draft.f,
      window: windowFrom(dom.set, [draft.a]),
      answer: {
        type: 'composition',
        question: 'value',
        f: draft.f,
        g: draft.g,
        a: draft.a,
        defined: value.defined,
        valueText,
        nudge: 'Work from the inside out: g of the number first, then f of that result. If either step breaks, the answer is undefined.',
        ruleCard: COMP_RULE_IDS.order,
        ruleCards: [COMP_RULE_IDS.order, COMP_RULE_IDS.parens],
        reveal: value.steps,
        trap: draft.trap,
      },
      params: { f: draft.f, g: draft.g, a: draft.a, trap: draft.trap, value: valueText },
    })
  }
  throw new Error(`comp.value: no core-supported pair for seed ${seed}`)
}

export const valueTemplate: TemplateDef = {
  id: 'comp.value',
  title: '(f ∘ g)(a)',
  description: 'A friendly integer plugged into f ∘ g, sometimes where the composite is undefined.',
  version: VERSION,
  knobs: [],
  generate,
}
