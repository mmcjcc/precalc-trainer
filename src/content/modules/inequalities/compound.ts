import type { RelOp } from '@/shared/types'
import { calcPanels } from '@/content/calc'
import { makeRng } from '@/content/rng'
import type { CanonicalStep, DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { rat, ratToNumber, ratToString, setFromRelation } from '@/notation'
import { coeffVar, flipOp, linearExpr, opGlyph, prettyInt } from '../format'
import { setAnswer } from '../sets'

type ChainOps = readonly [RelOp, RelOp]
const OP_PAIRS: readonly ChainOps[] = [
  ['<', '<='],
  ['<=', '<'],
  ['<', '<'],
  ['<=', '<='],
]

/**
 * Compound inequality a ⋈₁ cx + d ⋈₂ b (both symbols point the same way).
 * Canonical: sub_both on all three parts → div_both (c > 0) or mul_div_neg_flip (c < 0, both
 * symbols flip, chain now reads high → low) → swap_sides rewrite to the low → high form.
 * Clean numbers (CG-11): endpoints are integers, or thirds/fifths when |c| ∈ {3, 5} and the
 * `fractions` knob (or a 25 % draw) asks for it.
 */
export const compoundTemplate: TemplateDef = {
  id: 'ineq.compound',
  title: 'Compound inequality',
  description: 'Solve a < cx + d <= b. Every move happens to all three parts.',
  version: 1,
  knobs: [
    { key: 'negativeLead', label: 'Negative coefficient (flip both)', default: undefined },
    { key: 'fractions', label: 'Fraction endpoints (thirds / fifths)', default: undefined },
  ],
  generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
    const rng = makeRng(seed)
    const negative =
      knobs.negativeLead === true || (knobs.negativeLead !== false && rng.chance(0.4))
    const mag = rng.int(2, 5)
    const c = negative ? -mag : mag
    const wantFraction =
      knobs.fractions === true || (knobs.fractions !== false && rng.chance(0.25))
    const fraction = wantFraction && (mag === 3 || mag === 5)
    const [op1, op2] = rng.pick(OP_PAIRS)
    const d = rng.intExcept(-6, 6, [0])

    // Solution endpoints lo < hi as exact rationals with denominator |c| (integers otherwise).
    let loNum: number
    let hiNum: number
    if (fraction) {
      // m1 < m2 in [−3|c|, 3|c|], at least one not divisible by |c|, at least |c| apart.
      const lo = rng.int(-3 * mag, mag)
      let hi = lo + rng.int(mag, 2 * mag)
      if (lo % mag === 0 && hi % mag === 0) hi += 1
      loNum = lo
      hiNum = hi
    } else {
      const k1 = rng.int(-4, 2)
      const k2 = k1 + rng.int(1, 3)
      loNum = k1 * mag
      hiNum = k2 * mag
    }
    const lo = rat(loNum, mag)
    const hi = rat(hiNum, mag)
    // The middle expression E = cx + d ranges over [c·lo + d, c·hi + d] (reversed when c < 0).
    const eLo = negative ? -hiNum + d : loNum + d
    const eHi = negative ? -loNum + d : hiNum + d
    const a = eLo
    const b = eHi
    const start = `${a} ${op1} ${linearExpr(c, d)} ${op2} ${b}`
    const mid = `${a - d} ${op1} ${coeffVar(c)} ${op2} ${b - d}`
    const loS = ratToString(lo)
    const hiS = ratToString(hi)
    const final = negative ? `${loS} ${op2} x ${op1} ${hiS}` : `${loS} ${op1} x ${op2} ${hiS}`
    const set = setFromRelation(final)
    if (!set) throw new Error(`ineq.compound: could not build the answer set from "${final}"`)
    const answer = setAnswer(set)
    const dWord = d > 0 ? `Subtract ${d} from` : `Add ${-d} to`
    const canonical: CanonicalStep[] = [
      {
        text: mid,
        tag: d > 0 ? 'sub_both' : 'add_both',
        nudge: `${dWord} all three parts — the middle AND both ends. Adding or subtracting never flips a symbol.`,
        ruleCard: 'compound',
        stage: 'constant moved',
      },
    ]
    if (negative) {
      const flipped = `${hiS} ${flipOp(op1)} x ${flipOp(op2)} ${loS}`
      canonical.push(
        {
          text: flipped,
          tag: 'mul_div_neg_flip',
          nudge:
            op1 === op2
              ? `Divide all three parts by ${prettyInt(c)}. It is negative, so BOTH symbols flip: each ${opGlyph(op1)} becomes ${opGlyph(flipOp(op1))}.`
              : `Divide all three parts by ${prettyInt(c)}. It is negative, so BOTH symbols flip: ${opGlyph(op1)} becomes ${opGlyph(flipOp(op1))} and ${opGlyph(op2)} becomes ${opGlyph(flipOp(op2))}.`,
          ruleCard: 'flip-negative',
          stage: 'solved (reads high to low)',
        },
        {
          text: final,
          tag: 'swap_sides',
          nudge: `Read the chain right to left so the smaller number comes first: ${final}.`,
          ruleCard: 'compound',
          stage: 'solved',
        },
      )
    } else {
      canonical.push({
        text: final,
        tag: 'div_both',
        nudge: `Divide all three parts by ${c}. Positive divisor — the symbols stay as they are.`,
        ruleCard: 'mul-div',
        stage: 'solved',
      })
    }
    // Friendly check value: an integer inside (or on the edge of) the solution interval.
    const midpoint = (ratToNumber(lo) + ratToNumber(hi)) / 2
    let k = Math.round(midpoint)
    if (k < ratToNumber(lo)) k = Math.ceil(ratToNumber(lo))
    if (k > ratToNumber(hi)) k = Math.floor(ratToNumber(hi))
    const fk = c * k + d
    return {
      id: `inequalities/ineq.compound@1/${(seed >>> 0).toString(36)}`,
      moduleId: 'inequalities',
      templateId: 'ineq.compound',
      skill: 'ineq.compound',
      genVersion: 1,
      seed,
      knobs,
      kind: 'inequality',
      title: 'Solve the compound inequality',
      instructions:
        'Solve for x, keeping all three parts. Give the answer in interval notation and set-builder notation.',
      statementText: start,
      vars: ['x'],
      start,
      canonical,
      answer,
      graph: { kind: 'numberLine', set },
      calc: calcPanels({ family: 'inequality', expr: linearExpr(c, d), relation: start, checkValue: k }),
      check: { k, fk },
      params: { a, b, c, d, op1, op2, lo: loS, hi: hiS, negative, fraction },
    }
  },
}
