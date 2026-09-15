import type { RelOp } from '@/shared/types'
import { calcPanels } from '@/content/calc'
import { makeRng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { coeffVar, linearExpr, relJoin } from '../format'
import { rayFor, setAnswer } from '../sets'

const OPS: RelOp[] = ['<=', '>=', '<', '>']

function solvedOp(startOp: RelOp, a: number): RelOp {
  if (a > 0) return startOp
  switch (startOp) {
    case '<':
      return '>'
    case '>':
      return '<'
    case '<=':
      return '>='
    case '>=':
      return '<='
    default:
      return startOp
  }
}

export const linearTemplate: TemplateDef = {
  id: 'ineq.linear',
  title: 'Linear inequality',
  description: 'Solve ax + b ⋈ c. Negative a forces a sign flip.',
  version: 1,
  knobs: [
    { key: 'negativeLead', label: 'Negative coefficient (flip)', default: undefined },
  ],
  generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
    const rng = makeRng(seed)
    const wantNeg = knobs.negativeLead === true || (knobs.negativeLead !== false && rng.chance(0.55))
    const a = wantNeg ? -rng.int(2, 6) : rng.int(2, 6)
    const k = rng.intExcept(-6, 6, [0])
    const b = rng.intExcept(-8, 8, [0])
    const op = rng.pick(OPS)
    const c = a * k + b
    const start = relJoin(linearExpr(a, b), op, String(c))
    const mid = relJoin(coeffVar(a), op, String(c - b))
    const finalOp = solvedOp(op, a)
    const final = relJoin('x', finalOp, String(k))
    const set = rayFor(finalOp, k)
    const answer = setAnswer(set)
    return {
      id: `inequalities/ineq.linear@1/${(seed >>> 0).toString(36)}`,
      moduleId: 'inequalities',
      templateId: 'ineq.linear',
      skill: 'ineq.linear',
      genVersion: 1,
      seed,
      knobs,
      kind: 'inequality',
      title: 'Solve the inequality',
      instructions: 'Solve for x. Give the answer in interval notation and set-builder notation.',
      statementText: start,
      vars: ['x'],
      start,
      canonical: [
        {
          text: mid,
          tag: 'sub_both',
          nudge: 'Move the constant away from the x term.',
          ruleCard: 'add-sub',
          stage: 'constant moved',
        },
        {
          text: final,
          tag: a < 0 ? 'mul_div_neg_flip' : 'div_both',
          nudge: a < 0 ? 'Divide by the coefficient of x — it is negative.' : 'Divide by the coefficient of x.',
          ruleCard: a < 0 ? 'flip-negative' : 'mul-div',
          stage: 'solved',
        },
      ],
      answer,
      graph: { kind: 'numberLine', set },
      calc: calcPanels({ family: 'inequality', expr: `${a}x`, relation: start, checkValue: k }),
      check: { k, fk: a * k + b },
      params: { a, b, c, k, op },
    }
  },
}
