import type { RelOp } from '@/shared/types'
import { calcPanels } from '@/content/calc'
import { makeRng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { aTimesBinom, coeffVar, linearExpr, relJoin } from '../format'
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

export const distributeTemplate: TemplateDef = {
  id: 'ineq.distribute',
  title: 'Distribute, then solve',
  description: 'Solve a(x + b) ⋈ c. Distribution first, then isolate x.',
  version: 1,
  knobs: [{ key: 'negativeLead', label: 'Negative outside (flip)', default: undefined }],
  generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
    const rng = makeRng(seed)
    const wantNeg = knobs.negativeLead === true || (knobs.negativeLead !== false && rng.chance(0.45))
    const a = wantNeg ? -rng.int(2, 5) : rng.int(2, 5)
    const k = rng.intExcept(-5, 5, [0])
    const b = rng.intExcept(-5, 5, [0])
    const op = rng.pick(OPS)
    const c = a * (k + b)
    const start = relJoin(aTimesBinom(a, b), op, String(c))
    const expanded = relJoin(linearExpr(a, a * b), op, String(c))
    const mid = relJoin(coeffVar(a), op, String(c - a * b))
    const finalOp = solvedOp(op, a)
    const final = relJoin('x', finalOp, String(k))
    const set = rayFor(finalOp, k)
    const answer = setAnswer(set)
    return {
      id: `inequalities/ineq.distribute@1/${(seed >>> 0).toString(36)}`,
      moduleId: 'inequalities',
      templateId: 'ineq.distribute',
      skill: 'ineq.distribute',
      genVersion: 1,
      seed,
      knobs,
      kind: 'inequality',
      title: 'Distribute, then solve',
      instructions: 'Expand, then solve for x. Finish in interval and set-builder notation.',
      statementText: start,
      vars: ['x'],
      start,
      canonical: [
        {
          text: expanded,
          tag: 'distribute',
          nudge: 'Every term inside the parentheses gets the multiplier.',
          ruleCard: 'distribute',
          stage: 'distributed',
        },
        {
          text: mid,
          tag: 'sub_both',
          nudge: 'Move the constant to the other side.',
          ruleCard: 'add-sub',
          stage: 'constant moved',
        },
        {
          text: final,
          tag: a < 0 ? 'mul_div_neg_flip' : 'div_both',
          nudge: a < 0 ? 'Divide by a negative — flip the inequality.' : 'Divide to get x alone.',
          ruleCard: a < 0 ? 'flip-negative' : 'mul-div',
          stage: 'solved',
        },
      ],
      answer,
      graph: { kind: 'numberLine', set },
      calc: calcPanels({ family: 'inequality', expr: `${a}x`, relation: start, checkValue: k }),
      check: { k, fk: a * (k + b) },
      params: { a, b, c, k, op },
    }
  },
}
