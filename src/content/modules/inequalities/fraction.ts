import type { RelOp } from '@/shared/types'
import { calcPanels } from '@/content/calc'
import { makeRng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { rat, ratToString } from '@/notation'
import { addConst, flipOp, fracCoeff, gcd, opGlyph, prettyInt, relJoin } from '../format'
import { rayFor, setAnswer } from '../sets'

const OPS: RelOp[] = ['<=', '>=', '<', '>']

/**
 * Ineq B (content-templates.md): ±(p/q)y + t ⋈ u, solved for y.
 *  - q ∈ {2,3,4,5}, p ∈ 1..5 coprime to q, t,u ∈ [−9, 9], t ≠ 0.
 *  - Integer variant: p | (u − t), so y = q(u − t)/p is an integer.
 *  - Fraction variant (knob `fractions`, or ~30 %): p ∈ {3, 5} and p ∤ (u − t), so the answer is
 *    thirds or fifths (CG-11 clean-number rule). Endpoints are exact rationals.
 * Canonical: sub_both/add_both (move t) → reciprocal_multiply (× q/p; flip when negative).
 */
export const fractionTemplate: TemplateDef = {
  id: 'ineq.fraction',
  title: 'Fraction coefficient',
  description: 'Solve ±(p/q)y + t ⋈ u. Undo the fraction with its reciprocal; flip if it is negative.',
  version: 1,
  knobs: [
    { key: 'negativeLead', label: 'Negative coefficient (flip)', default: undefined },
    { key: 'fractions', label: 'Fraction answer (thirds / fifths)', default: undefined },
  ],
  generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
    const rng = makeRng(seed)
    const q = rng.pick([2, 3, 4, 5])
    const coprime = [1, 2, 3, 4, 5].filter((p) => p !== q && gcd(p, q) === 1)
    const wantFraction =
      knobs.fractions === true || (knobs.fractions !== false && rng.chance(0.3))
    const fracChoices = coprime.filter((p) => p === 3 || p === 5)
    const fraction = wantFraction && fracChoices.length > 0
    const p = fraction ? rng.pick(fracChoices) : rng.pick(coprime)
    const negative =
      knobs.negativeLead === true || (knobs.negativeLead !== false && rng.chance(0.5))
    const op = rng.pick(OPS)
    const t = rng.intExcept(-9, 9, [0])

    // m = u − t. Integer variant: m = p·k. Fraction variant: p ∤ m.
    let m: number
    if (fraction) {
      const ms: number[] = []
      for (let v = -9; v <= 9; v++) if (v !== 0 && v % p !== 0 && Math.abs(t + v) <= 9) ms.push(v)
      m = rng.pick(ms)
    } else {
      const ks: number[] = []
      for (let k = -9; k <= 9; k++) if (k !== 0 && Math.abs(t + p * k) <= 9) ks.push(k)
      m = p * rng.pick(ks)
    }
    const u = t + m
    // ±(p/q) y ⋈ m  →  y ⋈' ±(q/p) m
    const solution = rat(negative ? -q * m : q * m, p)
    const finalOp = negative ? flipOp(op) : op
    const coef = fracCoeff(p, q, 'y', negative)
    const start = relJoin(addConst(coef, t), op, String(u))
    const mid = relJoin(coef, op, String(m))
    const final = relJoin('y', finalOp, ratToString(solution))
    const set = rayFor(finalOp, solution)
    const answer = setAnswer(set, 'y')
    const recip = `${negative ? '−' : ''}${p === 1 ? `${q}` : `${q}/${p}`}`
    const k = q
    const fk = (negative ? -p : p) + t
    return {
      id: `inequalities/ineq.fraction@1/${(seed >>> 0).toString(36)}`,
      moduleId: 'inequalities',
      templateId: 'ineq.fraction',
      skill: 'ineq.fraction',
      genVersion: 1,
      seed,
      knobs,
      kind: 'inequality',
      title: 'Solve the inequality',
      instructions: 'Solve for y. Give the answer in interval notation and set-builder notation.',
      statementText: start,
      vars: ['y'],
      start,
      canonical: [
        {
          text: mid,
          tag: t > 0 ? 'sub_both' : 'add_both',
          nudge:
            t > 0
              ? `Subtract ${t} from both sides to leave the y term alone. Adding or subtracting never flips the symbol.`
              : `Add ${-t} to both sides to leave the y term alone. Adding or subtracting never flips the symbol.`,
          ruleCard: 'add-sub',
          stage: 'constant moved',
        },
        {
          text: final,
          tag: 'reciprocal_multiply',
          nudge: negative
            ? `Multiply both sides by the reciprocal ${recip}. It is negative, so ${opGlyph(op)} becomes ${opGlyph(finalOp)}.`
            : `Multiply both sides by the reciprocal ${recip}. Positive multiplier — the symbol stays ${opGlyph(op)}.`,
          ruleCard: negative ? 'flip-negative' : 'reciprocal',
          stage: 'solved',
        },
      ],
      answer,
      graph: { kind: 'numberLine', set },
      calc: calcPanels({
        family: 'inequality',
        expr: addConst(coef, t),
        relation: start,
        checkValue: k,
        independent: 'y',
      }),
      check: { k, fk },
      params: {
        p,
        q,
        t,
        u,
        m,
        op,
        negative,
        fraction,
        solution: ratToString(solution),
        solutionPretty: prettyInt(solution.n) + (solution.d === 1 ? '' : `/${solution.d}`),
      },
    }
  },
}
