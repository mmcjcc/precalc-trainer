/**
 * "Check my own problem" for inverses (docs/progress/own-problem.md): her function f(x) = … as a ProblemInstance
 * exactly like the six templates make (kind 'inverse'), or the reason it is outside this module.
 *
 * The class is the templates' forms with her own numbers (whole numbers, fractions, decimals):
 *  - linear px + q (inv.linear; inv.frac-linear when p is a fraction);
 *  - a cube root cbrt(px + q) + r (inv.cbrt-shift);
 *  - k/(cx + d) + m, a number over a linear denominator, plus a number (inv.rational);
 *  - (ax + b)/(cx + d) written as one fraction (inv.mobius), with ad − bc ≠ 0;
 *  - a(x − h)² + m in vertex form with a whole-number h, not one-to-one (inv.quadratic-not).
 * The inverse, the check value and the hint lines are worked out exactly from her numbers, in the templates' own
 * order (swap first, and solve first), and every hint line is checked against her function before she sees it. The
 * engine's line checks look at the curve on slices between −60 and 60: her function must stay in that window on
 * at least half of them (it is, for every template), so a wrong line is always seen.
 */
import type { MathNode } from 'mathjs'
import { calcPanels } from '@/content/calc'
import type { CalcFamily } from '@/content/calc/types'
import type { CanonicalStep, ProblemInstance } from '@/content/types'
import { parseExpression, parseStatement, statementHolds } from '@/engine'
import { polyDeg, ratFnOf } from '@/engine/functions/poly'
import { collectVars, evalNode, fnName, isOp, isUnaryMinus, nodeArgs, symbolName } from '@/engine/math'
import {
  rat,
  ratAdd,
  ratDiv,
  ratIsInteger,
  ratMul,
  ratNeg,
  ratSub,
  ratToNumber,
  type Rational,
} from '@/notation'
import type { PropertyTag } from '@/shared/types'
import {
  OWN_VERSION,
  fail,
  fnWords,
  letterReason,
  math,
  ownProblemId,
  ownSeed,
  parseReason,
  scanFeatures,
  screenText,
  screenTree,
  type OwnConstructor,
  type OwnKind,
  type OwnResult,
} from '@/content/own/core'
import { ONE, ZERO, factor, isMinusOne, isOne, isZero, lin, num, plus, sign, term, words } from '@/content/own/print'
import { INVERSE_INSTRUCTIONS, SWAP_FIRST_NUDGE, SWAP_LAST_NUDGE, domainAround } from './shared'

const MODULE = 'inverses' as const

const KIND: OwnKind = {
  id: 'inverse',
  label: 'Find the inverse',
  example: 'f(x) = cbrt(5x - 2) + 4',
  input: 'either',
  vars: ['x', 'y'],
}

const TEMPLATES = ['inv.linear', 'inv.frac-linear', 'inv.cbrt-shift', 'inv.rational', 'inv.mobius', 'inv.quadratic-not'] as const
type TemplateId = (typeof TEMPLATES)[number]

/** The engine's slices (engine/slicing.ts SLICE_VALUES): her curve must be in its window on half of them. */
const SLICES = [-8, -5, -3, -2, -1, -0.5, 0.5, 1, 2, 3, 5, 8] as const
const WINDOW = 55
const MIN_SLICES = 6

const FIT = 'here I find inverses of linear, cube-root and fraction functions, and of a quadratic in vertex form'

function step(text: string, tag: PropertyTag, nudge: string, ruleCard: string, stage: string): CanonicalStep {
  return { text, tag, nudge, ruleCard, stage }
}

const undoTag = (t: Rational): PropertyTag => (sign(t) > 0 ? 'sub_both' : 'add_both')
const undoNudge = (t: Rational, what: string): string =>
  sign(t) > 0 ? `Subtract ${words(num(t))} from both sides so ${what} stands alone.` : `Add ${words(num(ratNeg(t)))} to both sides so ${what} stands alone.`

/** v + s, or v alone. */
const shift = (v: string, s: Rational): string => plus(v, s)
/** (v + s) in parentheses when there is a shift. */
const paren = (v: string, s: Rational): string => (isZero(s) ? v : `(${plus(v, s)})`)

// ---------------------------------------------------------------------------
// Reading her function
// ---------------------------------------------------------------------------

interface Signed {
  minus: boolean
  node: MathNode
}

function unwrap(n: MathNode): MathNode {
  return n.type === 'ParenthesisNode' ? unwrap((n as unknown as { content: MathNode }).content) : n
}

/** The top-level terms of a sum, with their signs. */
function termsOf(root: MathNode): Signed[] {
  const out: Signed[] = []
  const walk = (n: MathNode, minus: boolean) => {
    const m = unwrap(n)
    if ((isOp(m, '+') || isOp(m, '-')) && nodeArgs(m).length === 2) {
      walk(nodeArgs(m)[0]!, minus)
      walk(nodeArgs(m)[1]!, isOp(m, '-') ? !minus : minus)
    } else if (isUnaryMinus(m)) walk(nodeArgs(m)[0]!, !minus)
    else out.push({ minus, node: m })
  }
  walk(root, false)
  return out
}

const hasX = (n: MathNode): boolean => collectVars(n).includes('x')

/** An exact number (no letter), or null. */
function constant(n: MathNode): Rational | null {
  if (hasX(n)) return null
  const r = ratFnOf(n, 'x')
  if (!r || polyDeg(r.den) !== 0 || polyDeg(r.num) > 0) return null
  return ratDiv(r.num[0] ?? ZERO, r.den[0]!)
}

/** px + q exactly, or null. */
function linearOf(n: MathNode): { p: Rational; q: Rational } | null {
  const r = ratFnOf(n, 'x')
  if (!r || polyDeg(r.den) !== 0 || polyDeg(r.num) > 1) return null
  const d = r.den[0]!
  return { p: ratDiv(r.num[1] ?? ZERO, d), q: ratDiv(r.num[0] ?? ZERO, d) }
}

/** The sum of the constant terms; null when a term is neither the one with x nor a number. */
function restSum(terms: readonly Signed[], skip: Signed): Rational | null {
  let total = ZERO
  for (const t of terms) {
    if (t === skip) continue
    const c = constant(t.node)
    if (!c) return null
    total = ratAdd(total, t.minus ? ratNeg(c) : c)
  }
  return total
}

type Form =
  | { kind: 'linear'; p: Rational; q: Rational }
  | { kind: 'cbrt'; p: Rational; q: Rational; r: Rational }
  | { kind: 'rational'; k: Rational; c: Rational; d: Rational; m: Rational }
  | { kind: 'mobius'; a: Rational; b: Rational; c: Rational; d: Rational }
  | { kind: 'quadratic'; a: Rational; h: number; m: Rational }

function cubeRootForm(terms: readonly Signed[]): Form | null {
  const withX = terms.filter((t) => hasX(t.node))
  if (withX.length !== 1) return null
  const t = withX[0]!
  const fn = fnName(t.node)
  const args = nodeArgs(t.node)
  const isCbrt = fn === 'cbrt' || ((fn === 'nthRoot' || fn === 'nthroot') && args[1] && evalNode(args[1], {}) === 3)
  if (!isCbrt || t.minus) return null
  const inner = linearOf(args[0]!)
  const r = restSum(terms, t)
  if (!inner || isZero(inner.p) || !r) return null
  return { kind: 'cbrt', p: inner.p, q: inner.q, r }
}

function rationalForm(terms: readonly Signed[]): Form | null {
  const withX = terms.filter((t) => hasX(t.node))
  if (withX.length !== 1) return null
  const t = withX[0]!
  if (!isOp(t.node, '/')) return null
  const [top, bottom] = nodeArgs(t.node)
  const k = top ? constant(top) : null
  const den = bottom ? linearOf(bottom) : null
  const m = restSum(terms, t)
  if (!k || isZero(k) || !den || isZero(den.p) || !m) return null
  return { kind: 'rational', k: t.minus ? ratNeg(k) : k, c: den.p, d: den.q, m }
}

function mobiusForm(root: MathNode): Form | null {
  const n = unwrap(root)
  if (!isOp(n, '/')) return null
  const [top, bottom] = nodeArgs(n)
  const a = top ? linearOf(top) : null
  const c = bottom ? linearOf(bottom) : null
  if (!a || !c || isZero(c.p)) return null
  return { kind: 'mobius', a: a.p, b: a.q, c: c.p, d: c.q }
}

/** a(x − h)² + m, a x² + m: one squared term in x (times a number) and numbers. */
function vertexForm(terms: readonly Signed[]): Form | null {
  const withX = terms.filter((t) => hasX(t.node))
  if (withX.length !== 1) return null
  const t = withX[0]!
  let coef = t.minus ? rat(-1) : ONE
  let sq = t.node
  if (isOp(sq, '*')) {
    // a·(x − h)², or (x − h)²·a.
    const [l, r] = nodeArgs(sq)
    const left = l ? constant(l) : null
    const right = r ? constant(r) : null
    const value = left ?? right
    const rest = left ? r : right ? l : undefined
    if (!value || !rest) return null
    coef = ratMul(coef, value)
    sq = unwrap(rest)
  }
  if (!isOp(sq, '^')) return null
  const [base, exp] = nodeArgs(sq)
  if (!base || !exp || evalNode(exp, {}) !== 2) return null
  const inner = linearOf(base)
  if (!inner || !isOne(inner.p)) return null
  const m = restSum(terms, t)
  if (!m) return null
  const h = ratNeg(inner.q)
  if (!ratIsInteger(h)) return null
  return { kind: 'quadratic', a: coef, h: h.n, m }
}

type Read = { ok: true; f: MathNode; text: string } | { ok: false; result: OwnResult }

/** f(x) = E, y = E, or E alone: E in x. */
function readFunction(statement: string): Read {
  const asRelation = parseStatement(statement, ['x', 'y'])
  if (asRelation.ok) {
    const rels = asRelation.statement.disjuncts.flat()
    if (rels.length !== 1 || asRelation.statement.disjuncts.length !== 1) {
      return { ok: false, result: fail('not_function', 'Type one function, like ', math('f(x) = 2x + 3'), '.') }
    }
    const rel = rels[0]!
    if (rel.op !== '=') {
      return { ok: false, result: fail('inequality', 'This is an inequality, and here I find the inverse of a function: type it as ', math('f(x) = …'), ' or ', math('y = …'), '.') }
    }
    const [side, other] = symbolName(rel.lhs) === 'y' ? [rel.rhs, rel.lhs] : symbolName(rel.rhs) === 'y' ? [rel.lhs, rel.rhs] : [null, null]
    if (!side || !other) {
      return { ok: false, result: fail('not_function', 'Type the function with ', math('f(x)'), ' or ', math('y'), ' alone on the left, like ', math('f(x) = 2x + 3'), '.') }
    }
    if (collectVars(side).includes('y')) {
      return { ok: false, result: fail('y_inside', 'The right side has ', math('y'), ' in it; type the function in ', math('x'), ' alone, like ', math('f(x) = 2x + 3'), '.') }
    }
    const text = statement.slice(statement.indexOf('=') + 1).trim()
    return { ok: true, f: side, text: symbolName(rel.lhs) === 'y' ? text : statement.slice(0, statement.indexOf('=')).trim() }
  }
  const asExpression = parseExpression(statement, ['x', 'y'])
  if (asExpression.ok) {
    if (collectVars(asExpression.node).includes('y')) {
      return { ok: false, result: fail('y_inside', 'This has ', math('y'), ' in it; type the function in ', math('x'), ' alone, like ', math('f(x) = 2x + 3'), '.') }
    }
    return { ok: true, f: asExpression.node, text: statement }
  }
  // With no relation sign it was meant as an expression: its own error says what is wrong.
  const error = /[=<>]/.test(statement) ? asRelation.error : asExpression.error
  const r = parseReason(error, statement)
  if (r.code === 'letter') {
    return { ok: false, result: letterReason(statement, { main: 'x', allowed: ['x'], functions: true, here: ['a function is written in ', math('x')] }) }
  }
  return { ok: false, result: { ok: false, reason: r } }
}

/** Why her function is not one of the forms, by what it has in it. */
function whyNot(f: MathNode): OwnResult {
  const feat = scanFeatures(f, 'x')
  if (feat.varInExponent || feat.fns.includes('exp') || feat.fns.includes('log')) {
    return fail('exp_log', 'This has ', math('x'), feat.varInExponent ? ' in an exponent' : ' inside a log', `, and ${FIT}. Inverses of exponential and log functions are in `, { module: 'expLogGraphs' }, '.')
  }
  if (feat.fns.includes('sqrt')) {
    return fail('square_root', 'This has a square root of ', math('x'), ' in it, and its inverse needs a restricted domain; ', `${FIT}.`)
  }
  if (feat.fractionalPower) return fail('root_power', 'This has a fractional power of ', math('x'), ' in it, and ', `${FIT}.`)
  if (feat.fns.includes('abs')) return fail('absolute_value', 'This has an absolute value of ', math('x'), ' in it, which is not one-to-one, and ', `${FIT}.`)
  if (feat.fns.includes('cbrt')) {
    return fail('cube_root_form', 'Here I check a cube root on its own plus a number, like ', math('cbrt(5x - 2) + 4'), ', with nothing multiplying it and only ', math('x'), ' to the first power inside.')
  }
  if (feat.fns.length) return fail('function', `This has ${fnWords(feat.fns[0]!)} of `, math('x'), ' in it, and ', `${FIT}.`)
  if (feat.constants.length || feat.constFns.length) {
    return fail('irrational', 'This has ', feat.constants.includes('pi') ? math('pi') : feat.constants.includes('e') ? math('e') : 'a root or a log of a number', ' in it; here I check functions with whole numbers, fractions and decimals.')
  }
  const r = ratFnOf(f, 'x')
  if (!r) return fail('unsure', 'I can’t read this function exactly, so I won’t check it.')
  const top = polyDeg(r.num)
  const bottom = polyDeg(r.den)
  if (bottom === 0 && top <= 0) return fail('constant', 'Once it is simplified there is no ', math('x'), ' left, so every input gives the same output and there is no inverse.')
  if (bottom === 0 && top === 2) {
    return fail('quadratic_form', 'For a quadratic, type it in vertex form, like ', math('2(x - 3)^2 + 1'), ', with a whole number for the shift: here I check it in that form. Rewriting it is in ', { module: 'quadratics' }, '.')
  }
  if (bottom === 0) return fail('polynomial', 'This has ', math(`x^${top}`), ' in it, and ', `${FIT}.`)
  return fail('rational_form', 'This fraction has ', math('x^2'), ' or more in it, and here I check a fraction with ', math('x'), ' to the first power on top and below, like ', math('(3x - 1)/(2x + 5)'), '.')
}

// ---------------------------------------------------------------------------
// The forms: f, f⁻¹, the paths, the check value
// ---------------------------------------------------------------------------

interface Built {
  templateId: TemplateId
  title: string
  instructions: string
  /** f in app syntax (as the template writes it). */
  f: string
  canonical: CanonicalStep[]
  alt: CanonicalStep[]
  /** f(t) exactly where defined. */
  fAt: (t: Rational) => Rational | null
  /** f⁻¹(t) exactly where defined (one-to-one forms). */
  invAt: ((t: Rational) => Rational | null) | null
  inverse?: string
  bonusInverse?: string
  family: CalcFamily
  asymptotes?: { vertical: Rational; horizontal: Rational }
  pmInner?: string
  check: { k: number; fk: number; twin?: number } | null
  graphExtra: Record<string, unknown>
}

/** A whole-number input k whose output f(k) is a whole number within ±50, nearest to 0 first. */
function wholeCheck(fAt: (t: Rational) => Rational | null, range = 12): { k: number; fk: number } | null {
  const order = [1, 2, -1, -2, 3, -3, 4, -4, 5, -5, 0]
  for (let k = 6; k <= range; k++) order.push(k, -k)
  for (const k of order) {
    const v = fAt(rat(k))
    if (v && ratIsInteger(v) && Math.abs(v.n) <= 50) return { k, fk: v.n }
  }
  return null
}

/** n^(1/3) for an exact rational, or null when it is not a rational cube. */
function rationalCubeRoot(r: Rational): Rational | null {
  const root = (n: number): number | null => {
    const c = Math.round(Math.cbrt(n))
    return c * c * c === n ? c : null
  }
  const a = root(r.n)
  const b = root(r.d)
  return a === null || b === null ? null : rat(a, b)
}

function linearForm(p: Rational, q: Rational): Built {
  const f = lin(p, q, 'x')
  const fraction = !ratIsInteger(p)
  // f⁻¹(v) = (v − q)/p, written as the templates write it.
  const inv = (v: string): string => {
    if (isOne(p)) return shift(v, ratNeg(q))
    if (fraction) {
      const r = ratDiv(ONE, p)
      const inner = isZero(q) ? v : `(${shift(v, ratNeg(q))})`
      // The reciprocal of 1/2 is 2: a whole number is written as one.
      if (ratIsInteger(r)) return isMinusOne(r) ? `-${inner}` : `${r.n}${inner}`
      return `${sign(r) < 0 ? '-' : ''}(${Math.abs(r.n)}/${r.d})${inner}`
    }
    if (isMinusOne(p)) return isZero(q) ? `-${v}` : `-(${shift(v, ratNeg(q))})`
    return isZero(q) ? `${v}/${factor(p)}` : `(${shift(v, ratNeg(q))})/${factor(p)}`
  }
  const inverse = inv('x')
  const coefWord = words(num(p))
  const divide = (known: string, other: string): CanonicalStep =>
    fraction
      ? step(
          `${inv(known)} = ${other}`,
          'reciprocal_multiply',
          `Multiply both sides by the reciprocal ${words(num(ratDiv(ONE, p)))}: that undoes the coefficient ${coefWord} in one move (dividing by ${coefWord} is the same thing).`,
          'reciprocal',
          'coefficient 1',
        )
      : step(`${inv(known)} = ${other}`, 'div_both', `Divide both sides by ${coefWord}, the coefficient of ${other}.`, 'mul-div', 'coefficient 1')
  const canonical: CanonicalStep[] = [step(`x = ${lin(p, q, 'y')}`, 'swap_xy', SWAP_FIRST_NUDGE, 'swap-xy', 'swapped')]
  if (!isZero(q)) canonical.push(step(`${shift('x', ratNeg(q))} = ${term(p, 'y')}`, undoTag(q), undoNudge(q, `the ${term(p, 'y')} term`), 'add-sub', 'constant moved'))
  if (!isOne(p)) canonical.push(divide('x', 'y'))
  canonical.push(step(`y = ${inverse}`, 'swap_sides', 'Put y on the left: equals reads the same from either side.', 'swap-sides', 'y isolated'))
  const alt: CanonicalStep[] = []
  if (!isZero(q)) alt.push(step(`${shift('y', ratNeg(q))} = ${term(p, 'x')}`, undoTag(q), undoNudge(q, `the ${term(p, 'x')} term`), 'add-sub', 'constant moved'))
  if (!isOne(p)) alt.push(divide('y', 'x'))
  alt.push(step(`x = ${inv('y')}`, 'swap_sides', 'Put x on the left: equals reads the same from either side.', 'swap-sides', 'x isolated'))
  alt.push(step(`y = ${inverse}`, 'swap_xy', SWAP_LAST_NUDGE, 'swap-xy', 'y isolated'))
  const fAt = (t: Rational) => ratAdd(ratMul(p, t), q)
  return {
    templateId: fraction ? 'inv.frac-linear' : 'inv.linear',
    title: fraction ? 'Find the inverse (fraction coefficient)' : 'Find the inverse',
    instructions: INVERSE_INSTRUCTIONS,
    f,
    canonical,
    alt,
    fAt,
    invAt: (t) => ratDiv(ratSub(t, q), p),
    inverse,
    family: fraction ? 'inverse-frac-linear' : 'inverse-linear',
    check: wholeCheck(fAt),
    graphExtra: {},
  }
}

function cbrtForm(p: Rational, q: Rational, r: Rational): Built {
  const inside = (v: string) => lin(p, q, v)
  const root = (v: string) => `cbrt(${inside(v)})`
  const f = plus(root('x'), r)
  const cube = (v: string) => (isZero(r) ? `${v}^3` : `(${shift(v, ratNeg(r))})^3`)
  const lessQ = (v: string) => plus(cube(v), ratNeg(q))
  const inv = (v: string): string => {
    if (isOne(p)) return lessQ(v)
    const inner = isZero(q) ? cube(v) : `(${lessQ(v)})`
    if (ratIsInteger(p)) return `${inner}/${factor(p)}`
    return `${factor(ratDiv(ONE, p))}${inner.startsWith('(') ? inner : `(${inner})`}`
  }
  const inverse = inv('x')
  const solve = (known: string, other: string): CanonicalStep[] => {
    const out: CanonicalStep[] = []
    if (!isZero(r)) out.push(step(`${shift(known, ratNeg(r))} = ${root(other)}`, undoTag(r), 'Undo the number outside the cube root first.', 'add-sub', 'root isolated'))
    out.push(step(`${cube(known)} = ${inside(other)}`, 'cube_both', 'Cube both sides to undo the cube root.', 'cube-both', 'cubed'))
    if (!isZero(q)) out.push(step(`${lessQ(known)} = ${term(p, other)}`, undoTag(q), `Move the number away from ${other}.`, 'add-sub', 'constant moved'))
    if (!isOne(p)) out.push(step(`${inv(known)} = ${other}`, 'div_both', `Divide by the coefficient of ${other}.`, 'mul-div', 'coefficient 1'))
    return out
  }
  const canonical = [
    step(`x = ${plus(root('y'), r)}`, 'swap_xy', 'Swap x and y first.', 'swap-xy', 'swapped'),
    ...solve('x', 'y'),
    step(`y = ${inverse}`, 'swap_sides', 'Put y on the left.', 'swap-sides', 'y isolated'),
  ]
  const alt = [
    ...solve('y', 'x'),
    step(`x = ${inv('y')}`, 'swap_sides', 'Put x on the left.', 'swap-sides', 'x isolated'),
    step(`y = ${inverse}`, 'swap_xy', SWAP_LAST_NUDGE, 'swap-xy', 'y isolated'),
  ]
  const fAt = (t: Rational) => {
    const c = rationalCubeRoot(ratAdd(ratMul(p, t), q))
    return c ? ratAdd(c, r) : null
  }
  const invAt = (t: Rational) => {
    const s = ratSub(t, r)
    return ratDiv(ratSub(ratMul(ratMul(s, s), s), q), p)
  }
  return {
    templateId: 'inv.cbrt-shift',
    title: 'Find the inverse (cube root)',
    instructions: 'Swap x and y, then undo: subtract the shift, cube, undo the rest. Write y = f⁻¹(x).',
    f,
    canonical,
    alt,
    fAt,
    invAt,
    inverse,
    family: 'inverse-cbrt',
    check: wholeCheck(fAt, 30),
    graphExtra: {},
  }
}

function rationalFormBuilt(k: Rational, c: Rational, d: Rational, m: Rational): Built {
  const den = (v: string) => (isOne(c) && isZero(d) ? v : `(${lin(c, d, v)})`)
  const frac = (v: string) => `${num(k)}/${den(v)}`
  const f = plus(frac('x'), m)
  const lessM = (v: string) => paren(v, ratNeg(m))
  const back = (v: string) => `${num(k)}/${lessM(v)}`
  // f⁻¹(v) = (k/(v − m) − d)/c.
  const inv = (v: string): string => {
    const top = plus(back(v), ratNeg(d))
    if (isOne(c)) return top
    return isZero(d) ? `${back(v)}/${factor(c)}` : `(${top})/${factor(c)}`
  }
  const inverse = inv('x')
  const cleared = (top: string, other: string) => (isZero(m) ? `${other}${den(top)} = ${num(k)}` : `${den(top)}${lessM(other)} = ${num(k)}`)
  const clearNudge = (v: string) => `Multiply both sides by ${den(v)} to clear the denominator. On this curve ${den(v)} is never 0, so nothing is lost.`
  const solve = (known: string, other: string): CanonicalStep[] => {
    const out: CanonicalStep[] = []
    if (!isZero(m)) out.push(step(`${shift(known, ratNeg(m))} = ${frac(other)}`, undoTag(m), undoNudge(m, `the fraction ${frac(other)}`), 'add-sub', 'fraction isolated'))
    out.push(step(cleared(other, known), 'clear_denominator', clearNudge(other), 'clear-denominator', 'denominator cleared'))
    out.push(step(`${lin(c, d, other)} = ${back(known)}`, 'div_both', `Divide both sides by ${lessM(known)}, so the ${other} part stands alone.`, 'mul-div', `${other} term isolated`))
    if (!isZero(d)) out.push(step(`${term(c, other)} = ${plus(back(known), ratNeg(d))}`, undoTag(d), undoNudge(d, `the ${other} term`), 'add-sub', isOne(c) ? `${other} isolated` : `${other} term alone`))
    if (!isOne(c)) out.push(step(`${other} = ${inv(known)}`, 'div_both', `Divide both sides by ${words(num(c))}, the coefficient of ${other}.`, 'mul-div', `${other} isolated`))
    return out
  }
  const canonical = [
    step(`x = ${plus(frac('y'), m)}`, 'swap_xy', `Swap x and y: every x becomes y and every y becomes x. The asymptotes trade places too.`, 'swap-xy', 'swapped'),
    ...solve('x', 'y'),
  ]
  const alt = [...solve('y', 'x'), step(`y = ${inverse}`, 'swap_xy', SWAP_LAST_NUDGE, 'swap-xy', 'y isolated')]
  const fAt = (t: Rational) => {
    const below = ratAdd(ratMul(c, t), d)
    return isZero(below) ? null : ratAdd(ratDiv(k, below), m)
  }
  const invAt = (t: Rational) => {
    const below = ratSub(t, m)
    return isZero(below) ? null : ratDiv(ratSub(ratDiv(k, below), d), c)
  }
  return {
    templateId: 'inv.rational',
    title: 'Find the inverse (rational)',
    instructions: INVERSE_INSTRUCTIONS,
    f,
    canonical: dedupe(`y = ${f}`, canonical),
    alt: dedupe(`y = ${f}`, alt),
    fAt,
    invAt,
    inverse,
    family: 'inverse-rational',
    asymptotes: { vertical: ratNeg(ratDiv(d, c)), horizontal: m },
    check: wholeCheck(fAt, 8),
    graphExtra: {},
  }
}

function mobiusFormBuilt(a: Rational, b: Rational, c: Rational, d: Rational): Built {
  const f = `(${lin(a, b, 'x')})/(${lin(c, d, 'x')})`
  // b − d·u, the side left after the letter terms are collected.
  const rest = (u: string) => lin(ratNeg(d), b, u)
  const invDen = (u: string) => lin(c, ratNeg(a), u)
  const inverse = `(${rest('x')})/(${invDen('x')})`
  const xy = (cc: Rational) => term(cc, 'xy')
  const solve = (u: string, v: string): CanonicalStep[] => {
    const distributed = isZero(d) ? xy(c) : `${xy(c)} ${sign(d) > 0 ? '+' : '-'} ${term(sign(d) > 0 ? d : ratNeg(d), u)}`
    const collected = isZero(a) ? xy(c) : `${xy(c)} ${sign(a) > 0 ? '-' : '+'} ${term(sign(a) > 0 ? a : ratNeg(a), v)}`
    return [
      step(`${u}(${lin(c, d, v)}) = ${lin(a, b, v)}`, 'clear_denominator', `Multiply both sides by (${lin(c, d, v)}) to clear the denominator. On this curve it is never 0, so nothing is lost.`, 'clear-denominator', 'denominator cleared'),
      step(`${distributed} = ${lin(a, b, v)}`, 'distribute', `Distribute the ${u}.`, 'distribute', 'distributed'),
      step(`${collected} = ${rest(u)}`, sign(a) >= 0 ? 'sub_both' : 'add_both', `${v} shows up on both sides: get every ${v}-term on the left and everything else on the right.`, 'add-sub', `${v} terms collected`),
      step(`${v}(${invDen(u)}) = ${rest(u)}`, 'factor', `Factor ${v} out of the left side.`, 'factor', `${v} factored out`),
      step(`${v} = (${rest(u)})/(${invDen(u)})`, 'div_both', `Divide both sides by (${invDen(u)}): it is never 0 on this curve, and ${v} is alone.`, 'mul-div', `${v} isolated`),
    ]
  }
  const canonical = [
    step(`x = (${lin(a, b, 'y')})/(${lin(c, d, 'y')})`, 'swap_xy', 'Swap x and y: every x becomes y and every y becomes x. The asymptotes trade places too.', 'swap-xy', 'swapped'),
    ...solve('x', 'y'),
  ]
  const alt = [...solve('y', 'x'), step(`y = ${inverse}`, 'swap_xy', SWAP_LAST_NUDGE, 'swap-xy', 'y isolated')]
  const fAt = (t: Rational) => {
    const below = ratAdd(ratMul(c, t), d)
    return isZero(below) ? null : ratDiv(ratAdd(ratMul(a, t), b), below)
  }
  const invAt = (t: Rational) => {
    const below = ratSub(ratMul(c, t), a)
    return isZero(below) ? null : ratDiv(ratSub(b, ratMul(d, t)), below)
  }
  return {
    templateId: 'inv.mobius',
    title: 'Find the inverse (Möbius)',
    instructions: INVERSE_INSTRUCTIONS,
    f,
    canonical: dedupe(`y = ${f}`, canonical),
    alt: dedupe(`y = ${f}`, alt),
    fAt,
    invAt,
    inverse,
    family: 'inverse-mobius',
    asymptotes: { vertical: ratNeg(ratDiv(d, c)), horizontal: ratDiv(a, c) },
    check: wholeCheck(fAt, 8),
    graphExtra: {},
  }
}

function quadraticFormBuilt(a: Rational, h: number, m: Rational): Built {
  const H = rat(h)
  const sq = (v: string) => (h === 0 ? `${v}^2` : `(${shift(v, ratNeg(H))})^2`)
  const lead = (v: string) => term(a, sq(v))
  const f = plus(lead('x'), m)
  const radicand = (v: string): string => {
    if (sign(a) > 0) {
      if (isOne(a)) return shift(v, ratNeg(m))
      return isZero(m) ? `${v}/${factor(a)}` : `(${shift(v, ratNeg(m))})/${factor(a)}`
    }
    const n = isZero(m) ? `-${v}` : `${num(m)} - ${v}`
    if (isMinusOne(a)) return n
    return isZero(m) ? `-${v}/${factor(ratNeg(a))}` : `(${n})/${factor(ratNeg(a))}`
  }
  const root = (v: string) => `sqrt(${radicand(v)})`
  const shifted = (v: string) => (h === 0 ? v : shift(v, ratNeg(H)))
  const pmLine = (v: string, w: string) => `${shifted(v)} = +-${root(w)}`
  const branches = (v: string, w: string) => `${v} = ${h} + ${root(w)} or ${v} = ${h} - ${root(w)}`
  const bonusInverse = h === 0 ? root('x') : `${h} + ${root('x')}`
  const final = h === 0 ? pmLine('y', 'x') : branches('y', 'x')
  const twinWords = `Two opposite numbers square to the same thing, and that ± is exactly why f is not one-to-one.`
  const solve = (known: string, other: string): CanonicalStep[] => {
    const out: CanonicalStep[] = []
    if (!isZero(m)) out.push(step(`${shift(known, ratNeg(m))} = ${lead(other)}`, undoTag(m), undoNudge(m, `the squared part ${lead(other)}`), 'add-sub', 'constant moved'))
    if (!isOne(a)) out.push(step(`${sq(other)} = ${radicand(known)}`, 'div_both', `Divide both sides by ${words(num(a))}, the number multiplying the square.`, 'mul-div', 'square isolated'))
    out.push(step(pmLine(other, known), 'root_both_pm', `Undo the square with a square root, and keep both signs: ±. ${twinWords}`, 'root-pm', h === 0 ? `${other} isolated (both branches)` : 'root taken (±)'))
    if (h !== 0) out.push(step(branches(other, known), undoTag(rat(-h)), `${h > 0 ? `Add ${h} to` : `Subtract ${-h} from`} both sides, on both branches. Restrict f to x ≥ ${words(String(h))} and only the + branch survives.`, 'add-sub', `${other} isolated (both branches)`))
    return out
  }
  const canonical = [step(`x = ${plus(lead('y'), m)}`, 'swap_xy', 'Swap x and y: every x becomes y and every y becomes x. (Bonus path: the verdict is already settled by the twin pair.)', 'swap-xy', 'swapped'), ...solve('x', 'y')]
  const alt = [...solve('y', 'x'), step(final, 'swap_xy', 'Now swap x and y in both branches: the inverse relation is the same curve with the letters traded.', 'swap-xy', 'y isolated (both branches)')]
  const fAt = (t: Rational) => {
    const s = ratSub(t, H)
    return ratAdd(ratMul(a, ratMul(s, s)), m)
  }
  // Two inputs the same distance from h: the smallest distance that gives a whole-number output.
  let check: Built['check'] = null
  for (const dist of [2, 1, 3, 4, 5, 6]) {
    const v = fAt(rat(h + dist))
    if (ratIsInteger(v) && Math.abs(v.n) <= 100) {
      check = { k: h + dist, fk: v.n, twin: h - dist }
      break
    }
  }
  return {
    templateId: 'inv.quadratic-not',
    title: 'Is it one-to-one?',
    instructions: `First decide: is f one-to-one? Think horizontal line test — what does an even power do to two inputs on opposite sides of x = ${words(String(h))}? If it is not, name the reason and show a pair of inputs with the same output. Bonus: restrict f to x ≥ ${words(String(h))} and find that inverse. ${INVERSE_INSTRUCTIONS}`,
    f,
    canonical,
    alt,
    fAt,
    invAt: null,
    bonusInverse,
    family: 'not-one-to-one',
    pmInner: radicand('x'),
    check,
    graphExtra: { reflect: true, badge: 'fails vertical line test' },
  }
}

/** A line that only writes the one before it again is not a step. */
function dedupe(start: string, steps: readonly CanonicalStep[]): CanonicalStep[] {
  const squash = (t: string) => t.replace(/\s+/g, '')
  const out: CanonicalStep[] = []
  let prev = start
  for (const s of steps) {
    if (squash(s.text) === squash(prev)) continue
    out.push(s)
    prev = s.text
  }
  return out
}

// ---------------------------------------------------------------------------
// Checks before she sees anything
// ---------------------------------------------------------------------------

/**
 * Her curve and its inverse inside the engine's window on at least half of its slices. A quadratic is only graded by
 * its verdict and its twin pair (no line is checked until the bonus after it is done): a third of the slices will do.
 */
function inWindow(b: Built): boolean {
  const needed = b.invAt === null ? 4 : MIN_SLICES
  let seen = 0
  for (const s of SLICES) {
    const t = rat(Math.round(s * 2), 2)
    const y = b.fAt(t)
    const yOk = y === null ? evalOk(b.f, s) : Math.abs(ratToNumber(y)) <= WINDOW
    const x = b.invAt ? b.invAt(t) : null
    const xOk = b.invAt === null ? true : x !== null && Math.abs(ratToNumber(x)) <= WINDOW
    if (yOk && xOk) seen++
  }
  return seen >= needed
}

function evalOk(f: string, t: number): boolean {
  const p = parseExpression(f, ['x'])
  if (!p.ok) return false
  const v = evalNode(p.node, { x: t })
  return v !== 'undef' && Math.abs(v) <= WINDOW
}

/**
 * Every hint line holds on her curve and only on it: at points (t, f(t)) before the swap and (f(t), t) after it, and
 * not one unit off the curve. Cheap (a few evaluations a line), so it runs on every problem she checks; the tests walk
 * the same lines through the engine's own checker.
 */
function linesHold(b: Built): boolean {
  const ts = [rat(7, 3), rat(-5, 4), rat(13, 5), rat(-11, 7), rat(1, 3)]
  const points: { x: number; y: number }[] = []
  for (const t of ts) {
    const y = b.fAt(t)
    if (y === null) {
      const p = parseExpression(b.f, ['x'])
      const v = p.ok ? evalNode(p.node, { x: ratToNumber(t) }) : 'undef'
      if (v !== 'undef') points.push({ x: ratToNumber(t), y: v })
    } else points.push({ x: ratToNumber(t), y: ratToNumber(y) })
  }
  if (points.length < 3) return false
  const holds = (line: string, x: number, y: number): boolean | 'undef' => {
    const s = parseStatement(line, ['x', 'y'])
    if (!s.ok) return 'undef'
    return statementHolds(s.statement, { x, y })
  }
  const check = (line: string, swapped: boolean): boolean => {
    let good = 0
    for (const p of points) {
      const [x, y] = swapped ? [p.y, p.x] : [p.x, p.y]
      const on = holds(line, x, y)
      if (on === false) return false
      if (on === true) {
        good++
        // One unit off the curve, the line must not hold (it says something).
        if ((swapped ? holds(line, x, y + 1) : holds(line, x, y + 1)) === true) return false
      }
    }
    return good >= 2
  }
  const pathOk = (path: readonly CanonicalStep[], swappedFrom: number) => path.every((s, i) => check(s.text, i >= swappedFrom))
  // Swap first: every line is after the swap. Solve first: only the last line is.
  return pathOk(b.canonical, 0) && pathOk(b.alt, b.alt.length - 1)
}

// ---------------------------------------------------------------------------
// The constructor
// ---------------------------------------------------------------------------

export function buildOwnInverse(text: string): OwnResult {
  const screened = screenText(text)
  if (!screened.ok) return { ok: false, reason: screened.reason }
  const statement = screened.statement
  if (statement.includes('+-')) return fail('plus_minus', 'This has ±, and a function has one output for each input.')
  const read = readFunction(statement)
  if (!read.ok) return read.result
  const tree = screenTree([read.f])
  if (tree) return { ok: false, reason: tree }
  if (!collectVars(read.f).includes('x')) return fail('constant', 'This has no ', math('x'), ' in it, so every input gives the same output and there is no inverse.')

  const terms = termsOf(read.f)
  const feat = scanFeatures(read.f, 'x')
  let form: Form | null = null
  if (feat.fns.includes('cbrt')) form = cubeRootForm(terms)
  else if (!feat.fns.length && !feat.varInExponent && !feat.constants.length && !feat.constFns.length && !feat.fractionalPower) {
    const r = ratFnOf(read.f, 'x')
    if (r && polyDeg(r.den) === 0 && polyDeg(r.num) === 1) {
      const lf = linearOf(read.f)
      if (lf) form = { kind: 'linear', p: lf.p, q: lf.q }
    } else if (r && polyDeg(r.den) === 0 && polyDeg(r.num) === 2) {
      form = vertexForm(terms)
    } else if (r && polyDeg(r.den) === 1 && polyDeg(r.num) <= 1) {
      form = rationalForm(terms) ?? mobiusForm(read.f)
      if (form?.kind === 'mobius' && isZero(ratSub(ratMul(form.a, form.d), ratMul(form.b, form.c)))) {
        return fail('constant', 'This fraction simplifies to a constant, so every input gives the same output and there is no inverse.')
      }
    }
  }
  if (!form) return whyNot(read.f)

  const built =
    form.kind === 'linear'
      ? linearForm(form.p, form.q)
      : form.kind === 'cbrt'
        ? cbrtForm(form.p, form.q, form.r)
        : form.kind === 'rational'
          ? rationalFormBuilt(form.k, form.c, form.d, form.m)
          : form.kind === 'mobius'
            ? mobiusFormBuilt(form.a, form.b, form.c, form.d)
            : quadraticFormBuilt(form.a, form.h, form.m)

  if (!inWindow(built)) {
    return fail('far_curve', 'The numbers in this one send its graph far past where my line checks look, so I can’t check it reliably.')
  }
  if (!linesHold(built)) return fail('unsure', 'I’m not sure I can work this one out exactly, so I won’t check it.')

  const start = `y = ${read.text}`
  const seed = ownSeed(statement)
  const check = built.check
  let calc: ProblemInstance['calc']
  try {
    calc = calcPanels({
      family: built.family,
      expr: built.f,
      ...(built.inverse ? { inverseExpr: built.inverse } : {}),
      ...(check ? { checkValue: check.k, checkOutput: check.fk } : {}),
      ...(check?.twin !== undefined ? { twin: check.twin } : {}),
      ...(built.asymptotes ? { asymptotes: built.asymptotes } : {}),
      ...(built.pmInner ? { pmInner: built.pmInner } : {}),
    })
  } catch {
    calc = { ti84: [], nspire: [] }
  }
  const oneToOne = built.templateId !== 'inv.quadratic-not'
  const xs = [ratToNumber(built.asymptotes?.vertical ?? ZERO), ratToNumber(built.asymptotes?.horizontal ?? ZERO), check?.k ?? 0, check?.fk ?? 0]
  const instance: ProblemInstance = {
    id: ownProblemId(MODULE, built.templateId, statement),
    moduleId: MODULE,
    templateId: built.templateId,
    skill: built.templateId,
    genVersion: OWN_VERSION,
    seed,
    knobs: {},
    kind: 'inverse',
    title: built.title,
    instructions: built.instructions,
    statementText: start,
    vars: ['x', 'y'],
    start,
    canonical: built.canonical,
    ...(built.alt.length ? { canonicalAlt: built.alt } : {}),
    answer: oneToOne
      ? { type: 'inverse', oneToOne: true, inverse: built.inverse! }
      : { type: 'inverse', oneToOne: false, reason: 'even_power_pm', bonusInverse: built.bonusInverse! },
    graph: oneToOne
      ? { kind: 'function', f: built.f, finv: built.inverse!, showIdentity: true, ...(built.asymptotes ? { xDomain: domainAround(xs) } : {}) }
      : { kind: 'function', f: built.f, reflect: true, showIdentity: true, badge: 'fails vertical line test' },
    calc,
    ...(check ? { check } : {}),
    params: { own: true, form: built.templateId },
    own: statement,
  }
  const asks = oneToOne
    ? ['Find ', math('f^-1(x)'), ' line by line: swap ', math('x'), ' and ', math('y'), ' first or solve first, then check it with a number.']
    : ['Decide whether ', math('f'), ' is one-to-one, and show two inputs with the same output.']
  return { ok: true, instance, asks }
}

export const ownInverses: OwnConstructor = {
  moduleId: MODULE,
  kinds: [KIND],
  build: (_kind, text) => {
    try {
      return buildOwnInverse(text)
    } catch {
      return fail('unsure', 'I’m not sure I can check this one, so I won’t.')
    }
  },
  kindOfTemplate: (templateId) => ((TEMPLATES as readonly string[]).includes(templateId) ? KIND.id : null),
}
