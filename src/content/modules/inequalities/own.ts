/**
 * "Check my own problem" for linear inequalities (docs/progress/own-problem.md): her inequality as a ProblemInstance
 * exactly like the four templates make (kind 'inequality', a set answer in interval and set-builder notation), or
 * the reason it is outside this module.
 *
 * The class is the one the module's grading supports: one letter, every side linear in it with exact numbers (whole
 * numbers, fractions, decimals; parentheses to distribute), one inequality, a chain a < bx + c ≤ d with numbers at
 * both ends, or two inequalities joined by "and" or "or". The solution set is solved exactly here (rational
 * arithmetic) and cross-checked by reading the last line back with the notation layer; every line of the hint path is
 * passed through the engine's own checker before she sees it. Every boundary lies within ±50, inside the window the
 * engine's line checks search (−60 to 60), so a wrong line is always caught.
 */
import type { MathNode } from 'mathjs'
import { calcPanels } from '@/content/calc'
import type { CanonicalStep, ProblemInstance } from '@/content/types'
import { parseStatement, verifyStep } from '@/engine'
import { polyDeg, ratFnOf } from '@/engine/functions/poly'
import { evalNode, isOp, isUnaryMinus, nodeArgs } from '@/engine/math'
import type { Relation } from '@/engine/types'
import {
  rat,
  ratCompare,
  ratDiv,
  ratIsInteger,
  ratNeg,
  ratSub,
  ratToNumber,
  setContains,
  setFromRelation,
  setIntersection,
  setsEqual,
  setUnion,
  type Rational,
} from '@/notation'
import type { PropertyTag, RelOp, SolutionSet, StepContext, VarName } from '@/shared/types'
import {
  OWN_VERSION,
  fail,
  fnWords,
  letterReason,
  lettersOf,
  listWords,
  math,
  ownProblemId,
  ownSeed,
  parseReason,
  scanFeatures,
  screenText,
  screenTree,
  type OwnConstructor,
  type OwnKind,
  type OwnPart,
  type OwnResult,
} from '@/content/own/core'
import { ONE, ZERO, isZero, lin as linText, num, sign, term, words } from '@/content/own/print'
import { flipOp } from '../format'
import { isolatedVariableLine } from '../progress'
import { rayFor, setAnswer } from '../sets'

const MODULE = 'inequalities' as const
/** Every finite boundary of her answer lies within ±BOUND (the engine's line checks search −60 to 60). */
export const OWN_INEQ_BOUND = 50

const KIND: OwnKind = {
  id: 'solve',
  label: 'Solve an inequality',
  example: '-13x - 20 >= -3(2x - 5)',
  input: 'relation',
  vars: ['x', 'y', 'n'],
}

const TEMPLATES = ['ineq.linear', 'ineq.distribute', 'ineq.fraction', 'ineq.compound'] as const

type Shape = 'single' | 'chain' | 'and' | 'or'

/** p·v + q, exactly. */
interface Lin {
  p: Rational
  q: Rational
}

/** p·v + q in app syntax. */
function lin(l: Lin, v: string): string {
  return linText(l.p, l.q, v)
}

// ---------------------------------------------------------------------------
// Reading her sides
// ---------------------------------------------------------------------------

type Read = { ok: true; lin: Lin } | { ok: false; result: OwnResult }

const LINEAR_HERE = 'here I check linear inequalities'

/** One side as p·v + q, exactly; or why it is outside the module. */
export function readInequalitySide(node: MathNode, v: string): Read {
  const f = scanFeatures(node, v)
  const no = (code: string, parts: OwnPart[]): Read => ({ ok: false, result: fail(code, ...parts) })
  if (f.fns.includes('abs')) return no('absolute_value', ['This has an absolute value of ', math(v), ' in it, and ', `${LINEAR_HERE} without one.`])
  if (f.varInExponent) return no('exponent', ['This has ', math(v), ' in an exponent, and ', `${LINEAR_HERE}.`])
  if (f.fns.length) {
    const kind = f.fns[0]!
    return no('function', [`This has ${fnWords(kind)} of `, math(v), ' in it, and ', `${LINEAR_HERE}.`])
  }
  const rational = (): Read =>
    no('rational', ['This has ', math(v), ' in a denominator, and ', `${LINEAR_HERE}. Rational inequalities are in `, { module: 'signCharts' }, '.'])
  if (f.varInDenominator) return rational()
  if (f.fractionalPower) return no('root_power', ['This has a fractional power of ', math(v), ' in it, and ', `${LINEAR_HERE}.`])
  if (f.maxPower >= 2) {
    return no('polynomial', ['This has ', math(`${v}^${f.maxPower}`), ' in it, and ', `${LINEAR_HERE}. Polynomial inequalities are in `, { module: 'signCharts' }, '.'])
  }
  if (f.constants.length || f.constFns.length) {
    const what = f.constants.includes('pi') ? [math('pi')] : f.constants.includes('e') ? [math('e')] : [`${fnWords(f.constFns[0]!)} of a number`]
    return no('irrational', ['This has ', ...what, ' in it, and the answer boxes here take whole numbers, fractions and decimals, so I can’t check it.'])
  }
  const r = ratFnOf(node, v)
  if (!r) return no('unsure', ['I can’t read one side exactly, so I won’t check this one.'])
  if (polyDeg(r.den) > 0) return rational()
  if (polyDeg(r.num) >= 2) {
    return no('polynomial', ['This multiplies ', math(v), ' by ', math(v), ', which makes ', math(`${v}^2`), `, and ${LINEAR_HERE}. Polynomial inequalities are in `, { module: 'signCharts' }, '.'])
  }
  const den = r.den[0]!
  return { ok: true, lin: { p: ratDiv(r.num[1] ?? ZERO, den), q: ratDiv(r.num[0] ?? ZERO, den) } }
}

function unwrap(n: MathNode): MathNode {
  return n.type === 'ParenthesisNode' ? unwrap((n as unknown as { content: MathNode }).content) : n
}

function isNumberLike(t: MathNode): boolean {
  if (t.type === 'ConstantNode') return true
  if (t.type === 'ParenthesisNode') return isNumberLike((t as unknown as { content: MathNode }).content)
  if (isUnaryMinus(t)) return isNumberLike(nodeArgs(t)[0]!)
  if (isOp(t, '/')) return nodeArgs(t).every((a) => a.type === 'ConstantNode')
  return false
}

function isMonomial(t: MathNode, v: string): boolean {
  if (t.type === 'SymbolNode') return (t as unknown as { name: string }).name === v
  if (isOp(t, '*')) {
    const [a, b] = nodeArgs(t)
    return Boolean(a && b && isNumberLike(a) && isMonomial(b, v))
  }
  if (isOp(t, '/')) {
    const [a, b] = nodeArgs(t)
    return Boolean(a && b && isMonomial(a, v) && b.type === 'ConstantNode')
  }
  return false
}

/** A side written the short way already: one term in v (or none) and one number (or none). */
function simpleSide(node: MathNode, v: string): boolean {
  const terms: MathNode[] = []
  const flat = (t: MathNode) => {
    if ((isOp(t, '+') || isOp(t, '-')) && nodeArgs(t).length === 2) {
      flat(nodeArgs(t)[0]!)
      terms.push(nodeArgs(t)[1]!)
    } else terms.push(t)
  }
  flat(unwrap(node))
  let varTerms = 0
  let numTerms = 0
  for (const raw of terms) {
    const t = isUnaryMinus(raw) ? nodeArgs(raw)[0]! : raw
    if (isNumberLike(t)) numTerms++
    else if (isMonomial(t, v)) varTerms++
    else return false
  }
  return varTerms <= 1 && numTerms <= 1
}

/** A sum or difference of two terms (the parser has dropped the parentheses around it). */
function isSum(n: MathNode): boolean {
  const m = unwrap(n)
  return (isOp(m, '+') || isOp(m, '-')) && nodeArgs(m).length === 2
}

/** A product with a sum in it, or a minus in front of a sum: something to distribute. */
function hasDistribution(node: MathNode): boolean {
  let found = false
  const visit = (n: MathNode) => {
    if ((isOp(n, '*') || isUnaryMinus(n)) && nodeArgs(n).some(isSum)) found = true
    if (isOp(n, '/') && isSum(nodeArgs(n)[0]!)) found = true
    if (n.type === 'ParenthesisNode') visit((n as unknown as { content: MathNode }).content)
    for (const a of nodeArgs(n)) visit(a)
  }
  visit(node)
  return found
}

// ---------------------------------------------------------------------------
// Solving exactly, and the lines a textbook writes
// ---------------------------------------------------------------------------

interface Branch {
  /** Her text of this part, as she typed it (normalized). */
  text: string
  op: RelOp
  left: Lin
  right: Lin
  /** Her sides were already short (no simplify line). */
  simple: boolean
  distribute: boolean
}

interface Phase {
  text: string
  tag: PropertyTag
  rule: string
  nudge: string
}

type PhaseKey = 'simplify' | 'collect' | 'constant' | 'divide'
const PHASES: readonly PhaseKey[] = ['simplify', 'collect', 'constant', 'divide']

const STAGE: Record<PhaseKey, string> = {
  simplify: 'sides simplified',
  collect: 'letter terms on one side',
  constant: 'constant moved',
  divide: 'solved',
}

interface Solved {
  phases: Partial<Record<PhaseKey, Phase>>
  /** The last line: the letter alone on one side. */
  final: string
  /** Its set. */
  set: SolutionSet
}

/**
 * One relation's lines: simplify each side, gather the letter terms on the left, move the number, divide (or
 * multiply by the reciprocal; flip for a negative). Null when the letter cancels (no line ends with it alone).
 */
function solveBranch(b: Branch, v: string): Solved | null {
  const line = (l: Lin, r: Lin, o: RelOp = b.op) => `${lin(l, v)} ${o} ${lin(r, v)}`
  const phases: Partial<Record<PhaseKey, Phase>> = {}
  let left = b.left
  let right = b.right
  if (!b.simple) {
    phases.simplify = {
      text: line(left, right),
      tag: b.distribute ? 'distribute' : 'combine_like',
      rule: 'distribute',
      nudge: b.distribute
        ? 'Distribute first: every term inside the parentheses gets the multiplier. Then combine like terms on each side.'
        : 'Combine like terms on each side first.',
    }
  }
  if (!isZero(left.p) && !isZero(right.p)) {
    const moved = right.p
    left = { p: ratSub(left.p, right.p), q: left.q }
    right = { p: ZERO, q: right.q }
    if (isZero(left.p)) return null
    const what = words(term(sign(moved) > 0 ? moved : ratNeg(moved), v))
    phases.collect = {
      text: line(left, right),
      tag: sign(moved) > 0 ? 'sub_both' : 'add_both',
      rule: 'add-sub',
      nudge: sign(moved) > 0 ? `Get the ${v} terms on one side: subtract ${what} from both sides.` : `Get the ${v} terms on one side: add ${what} to both sides.`,
    }
  }
  const vLeft = !isZero(left.p)
  if (!vLeft && isZero(right.p)) return null
  const c = vLeft ? left.q : right.q
  if (!isZero(c)) {
    if (vLeft) {
      left = { p: left.p, q: ZERO }
      right = { p: ZERO, q: ratSub(right.q, c) }
    } else {
      right = { p: right.p, q: ZERO }
      left = { p: ZERO, q: ratSub(left.q, c) }
    }
    const amount = words(num(sign(c) > 0 ? c : ratNeg(c)))
    phases.constant = {
      text: line(left, right),
      tag: sign(c) > 0 ? 'sub_both' : 'add_both',
      rule: 'add-sub',
      nudge:
        sign(c) > 0
          ? `Subtract ${amount} from both sides to leave the ${v} term alone. Adding or subtracting never flips the symbol.`
          : `Add ${amount} to both sides to leave the ${v} term alone. Adding or subtracting never flips the symbol.`,
    }
  }
  const p = vLeft ? left.p : right.p
  const k = ratDiv(vLeft ? right.q : left.q, p)
  const flip = sign(p) < 0
  const op = flip ? flipOp(b.op) : b.op
  const final = vLeft ? `${v} ${op} ${num(k)}` : `${num(k)} ${op} ${v}`
  if (ratCompare(p, ONE) !== 0) {
    const fraction = !ratIsInteger(p)
    const recip = words(num(ratDiv(ONE, p)))
    phases.divide = {
      text: final,
      tag: fraction ? 'reciprocal_multiply' : flip ? 'mul_div_neg_flip' : 'div_both',
      rule: flip ? 'flip-negative' : fraction ? 'reciprocal' : 'mul-div',
      nudge: fraction
        ? flip
          ? `Multiply both sides by the reciprocal ${recip}. It is negative, so the symbol flips.`
          : `Multiply both sides by the reciprocal ${recip}. Positive multiplier: the symbol stays.`
        : ratCompare(p, rat(-1)) === 0
          ? 'Multiply both sides by −1 to get the plain letter. It is negative, so the symbol flips.'
          : flip
            ? `Divide both sides by ${words(num(p))}, the coefficient of ${v}. It is negative, so the symbol flips.`
            : `Divide both sides by ${words(num(p))}, the coefficient of ${v}.`,
    }
  }
  // v op k, or k op v (that is v flip(op) k).
  const set = rayFor(vLeft ? op : flipOp(op), k)
  return { phases, final, set }
}

function step(text: string, tag: PropertyTag, nudge: string, ruleCard: string, stage: string): CanonicalStep {
  return { text, tag, nudge, ruleCard, stage }
}

function singlePath(s: Solved): CanonicalStep[] {
  const out: CanonicalStep[] = []
  for (const key of PHASES) {
    const p = s.phases[key]
    if (p) out.push(step(p.text, p.tag, p.nudge, p.rule, STAGE[key]))
  }
  return out
}

/** Two parts joined by "and" / "or": each phase applies to both parts, one line per phase that changes either. */
function compoundPath(branches: readonly Branch[], solved: readonly Solved[], joiner: 'and' | 'or', v: string): CanonicalStep[] {
  const current = branches.map((b) => b.text)
  const NUDGE: Record<PhaseKey, string> = {
    simplify: 'In each part, distribute and combine like terms first.',
    collect: `In each part, get the ${v} terms on one side.`,
    constant: `In each part, move the number away from the ${v} term. Adding or subtracting never flips a symbol.`,
    divide: `In each part, divide by the coefficient of ${v}. A negative one flips the symbol of that part only.`,
  }
  const out: CanonicalStep[] = []
  for (const key of PHASES) {
    const changed = solved.map((s) => s.phases[key] ?? null)
    if (changed.every((c) => c === null)) continue
    changed.forEach((c, i) => {
      if (c) current[i] = c.text
    })
    const live = changed.filter((c): c is Phase => c !== null)
    const tags = live.map((c) => c.tag)
    const tag: PropertyTag = tags.includes('mul_div_neg_flip') ? 'mul_div_neg_flip' : tags.every((t) => t === tags[0]) ? tags[0]! : key === 'divide' ? 'div_both' : 'sub_both'
    const rules = live.map((c) => c.rule)
    out.push(step(current.join(` ${joiner} `), tag, NUDGE[key], rules.includes('flip-negative') ? 'flip-negative' : rules[0]!, STAGE[key]))
  }
  return out
}

interface ChainSolved {
  steps: CanonicalStep[]
  final: string
  set: SolutionSet
}

/** a op1 (p·v + q) op2 b, with numbers a and b at the ends (the compound template's path). */
function chainPath(a: Rational, op1: RelOp, mid: Lin, op2: RelOp, b: Rational, simple: boolean, distribute: boolean, v: string): ChainSolved {
  const steps: CanonicalStep[] = []
  if (!simple) {
    steps.push(
      step(
        `${num(a)} ${op1} ${lin(mid, v)} ${op2} ${num(b)}`,
        distribute ? 'distribute' : 'combine_like',
        distribute ? 'Distribute in the middle part first: every term inside the parentheses gets the multiplier.' : 'Simplify each of the three parts first.',
        'distribute',
        STAGE.simplify,
      ),
    )
  }
  let left = a
  let right = b
  if (!isZero(mid.q)) {
    left = ratSub(a, mid.q)
    right = ratSub(b, mid.q)
    const amount = words(num(sign(mid.q) > 0 ? mid.q : ratNeg(mid.q)))
    steps.push(
      step(
        `${num(left)} ${op1} ${term(mid.p, v)} ${op2} ${num(right)}`,
        sign(mid.q) > 0 ? 'sub_both' : 'add_both',
        `${sign(mid.q) > 0 ? `Subtract ${amount} from` : `Add ${amount} to`} all three parts: the middle AND both ends. Adding or subtracting never flips a symbol.`,
        'compound',
        STAGE.constant,
      ),
    )
  }
  const p = mid.p
  const lo = ratDiv(left, p)
  const hi = ratDiv(right, p)
  if (sign(p) > 0) {
    const final = `${num(lo)} ${op1} ${v} ${op2} ${num(hi)}`
    if (ratCompare(p, ONE) !== 0) {
      const fraction = !ratIsInteger(p)
      steps.push(
        step(
          final,
          fraction ? 'reciprocal_multiply' : 'div_both',
          fraction
            ? `Multiply all three parts by the reciprocal ${words(num(ratDiv(ONE, p)))}. Positive: the symbols stay as they are.`
            : `Divide all three parts by ${words(num(p))}. Positive divisor: the symbols stay as they are.`,
          fraction ? 'reciprocal' : 'mul-div',
          STAGE.divide,
        ),
      )
    }
    return { steps, final, set: setIntersection(rayFor(flipOp(op1), lo), rayFor(op2, hi)) }
  }
  // Divided by a negative: both symbols flip and the chain reads high to low; then it is read the other way round.
  const flipped = `${num(lo)} ${flipOp(op1)} ${v} ${flipOp(op2)} ${num(hi)}`
  const final = `${num(hi)} ${op2} ${v} ${op1} ${num(lo)}`
  const how =
    ratCompare(p, rat(-1)) === 0
      ? 'Multiply all three parts by −1.'
      : !ratIsInteger(p)
        ? `Multiply all three parts by the reciprocal ${words(num(ratDiv(ONE, p)))}.`
        : `Divide all three parts by ${words(num(p))}.`
  steps.push(
    step(flipped, 'mul_div_neg_flip', `${how} It is negative, so BOTH symbols flip.`, 'flip-negative', 'solved (reads high to low)'),
    step(final, 'swap_sides', 'Read the chain right to left so the smaller number comes first.', 'compound', STAGE.divide),
  )
  return { steps, final, set: setIntersection(rayFor(flipOp(op2), hi), rayFor(op1, lo)) }
}

// ---------------------------------------------------------------------------
// The constructor
// ---------------------------------------------------------------------------

/** The top-level pieces of her text between " and " / " or " (outside parentheses). */
function topLevelParts(statement: string, joiner: 'and' | 'or'): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  const sep = ` ${joiner} `
  for (let i = 0; i < statement.length; i++) {
    const c = statement[i]
    if (c === '(' || c === '{') depth++
    else if (c === ')' || c === '}') depth = Math.max(0, depth - 1)
    else if (depth === 0 && statement.startsWith(sep, i)) {
      parts.push(statement.slice(start, i).trim())
      start = i + sep.length
      i += sep.length - 1
    }
  }
  parts.push(statement.slice(start).trim())
  return parts
}

function finiteEnds(set: SolutionSet): Rational[] {
  const out: Rational[] = []
  for (const piece of set.pieces) {
    if (piece.lo !== '-inf' && piece.lo !== 'inf') out.push(piece.lo)
    if (piece.hi !== '-inf' && piece.hi !== 'inf') out.push(piece.hi)
  }
  return [...out, ...set.points]
}

/** A friendly check value: a whole number in the answer near its first boundary (the templates' k), else 0. */
function checkValueOf(set: SolutionSet): number {
  const first = finiteEnds(set)[0]
  if (!first) return 0
  const base = Math.round(ratToNumber(first))
  for (const d of [0, 1, -1, 2, -2, 3, -3]) if (setContains(set, rat(base + d))) return base + d
  return base
}

function holds(op: RelOp, diff: Rational): boolean {
  const s = sign(diff)
  if (op === '<') return s < 0
  if (op === '<=') return s <= 0
  if (op === '>') return s > 0
  if (op === '>=') return s >= 0
  return s === 0
}

/** The letter cancels in one relation: what is left, and whether it always holds. */
function cancelled(b: Branch, shape: Shape, v: string): OwnResult {
  // After the letter terms cancel, L − R is the number qL − qR.
  const left = num(b.left.q)
  const right = num(b.right.q)
  const shown = `${left} ${b.op} ${right}`
  if (shape !== 'single') {
    return fail('part_without_variable', 'One part comes down to ', math(shown), ', with no ', math(v), ' in it, and here each part has to keep its letter.')
  }
  return holds(b.op, ratSub(b.left.q, b.right.q))
    ? fail('identity', 'The ', math(v), ' terms cancel here: it comes down to ', math(shown), ', which is always true, so the solution set is all real numbers, ', { tex: '(-\\infty, \\infty)' }, ', and no line ends with ', math(v), ' alone for me to check.')
    : fail('contradiction', 'The ', math(v), ' terms cancel here: it comes down to ', math(shown), ', which is never true, so there is no solution, ', { tex: '\\emptyset' }, ', and no line ends with ', math(v), ' alone for me to check.')
}

export function buildOwnInequality(text: string): OwnResult {
  const screened = screenText(text)
  if (!screened.ok) return { ok: false, reason: screened.reason }
  const statement = screened.statement
  if (statement.includes('+-')) return fail('plus_minus', 'This has ±, and an inequality here has one value on each side.')
  const parsed = parseStatement(statement, ['x', 'y', 'n'])
  if (!parsed.ok) {
    if (/needs both sides and/.test(parsed.error.message)) {
      return fail('no_relation', 'This has no inequality sign; type one of <, ≤, > or ≥ with something on each side.')
    }
    const r = parseReason(parsed.error, statement)
    if (r.code === 'letter') {
      return letterReason(statement, { main: 'x', allowed: ['x', 'y', 'n'], here: ['I check inequalities in one letter, ', math('x'), ', ', math('y'), ' or ', math('n')] })
    }
    return { ok: false, reason: r }
  }
  const st = parsed.statement
  const relations: Relation[] = st.disjuncts.flat()
  const sides = relations.flatMap((r) => [r.lhs, r.rhs])
  const tree = screenTree(sides)
  if (tree) return { ok: false, reason: tree }

  const letters = lettersOf(sides)
  if (letters.length === 0) return fail('no_variable', 'This has no letter in it, so there is nothing to solve for.')
  if (letters.length > 1) {
    return fail('two_variables', `This has ${letters.length === 2 ? 'two' : 'several'} letters, ${listWords(letters)}, and here I check inequalities in one letter.`)
  }
  const v = letters[0] as VarName
  if (relations.some((r) => r.op === '=')) {
    return fail('equation', 'This is an equation, with =, and here I check inequalities, with <, ≤, > or ≥.')
  }
  if (relations.length > 2) {
    return fail('too_many', 'This has more than two inequalities; here I check one, a chain like ', math('2 < 3x + 1 <= 7'), ', or two joined by “and” or “or”.')
  }
  const joinedByAnd = st.disjuncts.length === 1 && relations.length === 2 && topLevelParts(statement, 'and').length === 2
  const shape: Shape = st.disjuncts.length === 2 ? 'or' : relations.length === 1 ? 'single' : joinedByAnd ? 'and' : 'chain'
  const texts = shape === 'or' ? topLevelParts(statement, 'or') : shape === 'and' ? topLevelParts(statement, 'and') : [statement]

  // Each side, read exactly.
  const branches: Branch[] = []
  for (const [i, rel] of relations.entries()) {
    const l = readInequalitySide(rel.lhs, v)
    if (!l.ok) return l.result
    const r = readInequalitySide(rel.rhs, v)
    if (!r.ok) return r.result
    branches.push({
      text: texts[i] ?? statement,
      op: rel.op,
      left: l.lin,
      right: r.lin,
      simple: simpleSide(rel.lhs, v) && simpleSide(rel.rhs, v),
      distribute: hasDistribution(rel.lhs) || hasDistribution(rel.rhs),
    })
  }

  let set: SolutionSet
  let steps: CanonicalStep[]
  let final: string
  let templateId: (typeof TEMPLATES)[number] = 'ineq.compound'
  let title = 'Solve the compound inequality'
  let instructions = `Solve for ${v}, keeping both parts. Give the answer in interval notation and set-builder notation.`

  if (shape === 'chain') {
    // a op1 E op2 b: the parser gives a op1 E and E op2 b.
    const [r1, r2] = branches as [Branch, Branch]
    const mid = r1.right
    if (!isZero(r1.left.p) || !isZero(r2.right.p)) {
      return fail('chain_outer', 'In a chain like ', math('2 < 3x + 1 <= 7'), ' the two outer parts are numbers, and here a letter is in an outer part.')
    }
    if (isZero(mid.p)) return fail('no_variable_left', 'Once the middle part is simplified there is no ', math(v), ' left in it, so there is nothing to solve.')
    const simple = simpleSide(relations[0]!.lhs, v) && simpleSide(relations[0]!.rhs, v) && simpleSide(relations[1]!.rhs, v)
    const c = chainPath(r1.left.q, r1.op, mid, r2.op, r2.right.q, simple, r1.distribute || r2.distribute, v)
    steps = c.steps
    final = c.final
    set = c.set
    instructions = `Solve for ${v}, keeping all three parts. Give the answer in interval notation and set-builder notation.`
  } else {
    const solved: Solved[] = []
    for (const b of branches) {
      const s = solveBranch(b, v)
      if (!s) return cancelled(b, shape, v)
      solved.push(s)
    }
    if (shape === 'single') {
      const b = branches[0]!
      steps = singlePath(solved[0]!)
      final = solved[0]!.final
      set = solved[0]!.set
      templateId = b.distribute ? 'ineq.distribute' : !ratIsInteger(b.left.p) || !ratIsInteger(b.right.p) ? 'ineq.fraction' : 'ineq.linear'
      title = 'Solve the inequality'
      instructions = `Solve for ${v}. Give the answer in interval notation and set-builder notation.`
    } else {
      steps = compoundPath(branches, solved, shape, v)
      final = solved.map((s) => s.final).join(` ${shape} `)
      set = shape === 'or' ? setUnion(solved[0]!.set, solved[1]!.set) : setIntersection(solved[0]!.set, solved[1]!.set)
    }
  }

  // Every boundary inside the window the engine's line checks search.
  for (const end of finiteEnds(set)) {
    if (Math.abs(ratToNumber(end)) > OWN_INEQ_BOUND) {
      return fail('far_answer', `The answer to this one lies farther from 0 than ${OWN_INEQ_BOUND}, beyond where my line checks look, so I can’t check it reliably.`)
    }
  }
  // The arithmetic, read back: the last line has the letter alone and says exactly the set solved above.
  const readBack = setFromRelation(final)
  if (!readBack || !setsEqual(readBack, set) || !isolatedVariableLine(final, v)) {
    return fail('unsure', 'I’m not sure I can solve this one exactly, so I won’t check it.')
  }

  const seed = ownSeed(statement)
  const k = checkValueOf(set)
  const canonical = verifiedPath(statement, steps, final, v, seed, k)
  if (!canonical) return fail('unsure', 'I’m not sure my line checks work on this one, so I won’t check it.')

  const fkValue = evalNode(relations[0]!.lhs, { [v]: k })
  let calc: ProblemInstance['calc']
  try {
    calc = calcPanels({ family: 'inequality', expr: statement, relation: statement, checkValue: k, ...(v !== 'x' ? { independent: v } : {}) })
  } catch {
    calc = { ti84: [], nspire: [] }
  }
  const instance: ProblemInstance = {
    id: ownProblemId(MODULE, templateId, statement),
    moduleId: MODULE,
    templateId,
    skill: templateId,
    genVersion: OWN_VERSION,
    seed,
    knobs: {},
    kind: 'inequality',
    title,
    instructions,
    statementText: statement,
    vars: [v],
    start: statement,
    canonical,
    answer: setAnswer(set, v),
    graph: { kind: 'numberLine', set },
    calc,
    check: { k, fk: fkValue === 'undef' ? 0 : fkValue },
    params: { own: true, shape, final },
    own: statement,
  }
  return { ok: true, instance, asks: ['Solve for ', math(v), '; give the answer in interval and set notation.'] }
}

/**
 * The hint path as the engine sees it: every line from the start must be one the checker accepts, in this
 * problem's own context. Should a textbook line not be accepted (none should be), the path is the answer line alone
 * (the last hint shows the answer with its rule card), never a line the checker would refuse.
 */
function verifiedPath(start: string, steps: readonly CanonicalStep[], final: string, v: VarName, seed: number, k: number): CanonicalStep[] | null {
  const walk = (path: readonly CanonicalStep[]): boolean => {
    const ctx: StepContext = { vars: [v], seed, allowSwap: false, checkValue: k, canonical: path.map((s) => s.text), moduleId: MODULE }
    let prev = start
    for (const s of path) {
      if (!verifyStep(prev, s.text, ctx).ok) return false
      prev = s.text
    }
    return true
  }
  if (isolatedVariableLine(start, v)) return []
  // A line that only writes the one before it again is not a step.
  const squash = (t: string) => t.replace(/\s+/g, '')
  const fresh: CanonicalStep[] = []
  let prev = start
  for (const s of steps) {
    if (squash(s.text) === squash(prev)) continue
    fresh.push(s)
    prev = s.text
  }
  steps = fresh
  const last = steps[steps.length - 1]
  if (steps.length && walk(steps)) return [...steps]
  const alone = [
    step(final, last?.tag ?? 'simplify', `Get ${v} by itself: undo what is done to it, one operation at a time, on both sides.`, last?.ruleCard ?? 'add-sub', STAGE.divide),
  ]
  return walk(alone) ? alone : null
}

export const ownInequalities: OwnConstructor = {
  moduleId: MODULE,
  kinds: [KIND],
  build: (_kind, text) => {
    try {
      return buildOwnInequality(text)
    } catch {
      return fail('unsure', 'I’m not sure I can check this one, so I won’t.')
    }
  },
  kindOfTemplate: (templateId) => ((TEMPLATES as readonly string[]).includes(templateId) ? KIND.id : null),
}
