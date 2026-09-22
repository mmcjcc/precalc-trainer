import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { makeRng, type Rng } from '@/content/rng'
import { composeText, compositeDomain } from '@/engine'
import { linearExpr, polyExpr } from '../fnExpr'
import { buildComposition, windowFrom } from './build'
import { COMP_RULE_IDS } from './rules'

const VERSION = 1
const TRIES = 24

/**
 * f always has an x^2, so substituting g without parentheses is a different function.
 * g is linear and not just x.
 */
function pair(rng: Rng): { f: string; g: string } {
  if (rng.chance(0.18)) return { f: 'x^2 + 1', g: 'x - 3' }
  const a = rng.pick([1, 1, 1, 2, -1])
  const b = rng.int(-3, 3)
  const c = rng.int(-4, 4)
  let gA = rng.intExcept(-3, 3, [0])
  let gB = rng.int(-5, 5)
  if (gA === 1 && gB === 0) gB = rng.pick([-3, -1, 2, 3])
  return { f: polyExpr([c, b, a]), g: linearExpr(gA, gB) }
}

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const rng = makeRng(seed >>> 0)
  for (let n = 0; n < TRIES; n++) {
    const { f, g } = pair(rng)
    const text = composeText(f, g)
    const dom = compositeDomain(f, g)
    if (!text || !dom) continue
    return buildComposition({
      templateId: 'comp.expr',
      version: VERSION,
      seed,
      knobs,
      title: 'Find (f ∘ g)(x)',
      instructions: 'Write a simplified formula. Any equivalent form is fine.',
      statementText: `f(x) = ${f}, g(x) = ${g}`,
      graphF: text.unsimplified,
      window: windowFrom(dom.set),
      answer: {
        type: 'composition',
        question: 'expr',
        f,
        g,
        simplified: text.simplified,
        unsimplified: text.unsimplified,
        interval: dom.interval,
        set: dom.set,
        nudge: 'f ∘ g means g goes inside f. Replace every x in f with all of g(x), and put parentheses around it.',
        ruleCard: COMP_RULE_IDS.parens,
        ruleCards: [COMP_RULE_IDS.parens, COMP_RULE_IDS.order],
        reveal: [
          `Put g inside f, in parentheses: (f ∘ g)(x) = ${text.unsimplified}.`,
          `Simplified: ${text.simplified}.`,
        ],
        trap: 'parens',
      },
      params: { f, g, trap: 'parens', simplified: text.simplified },
    })
  }
  throw new Error(`comp.expr: no core-supported pair for seed ${seed}`)
}

export const exprTemplate: TemplateDef = {
  id: 'comp.expr',
  title: '(f ∘ g)(x)',
  description: 'Substitute g into f and simplify. f has an x^2, so the parentheses matter.',
  version: VERSION,
  knobs: [],
  generate,
}
