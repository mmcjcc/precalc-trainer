/**
 * Tier 3 — matcher hooks (engine-design §7): "does the student's line equal a known WRONG
 * transform of the old line?" Each matcher builds candidate wrong sides from the old AST and
 * compares them numerically with the student's side. Ids and lessons come from the shared catalog.
 *
 * The MATCHERS agent will split this file per family under matchers/; keep `runMatchers` stable.
 */
import type { ErrorPatternId, PatternHit } from '@/shared/types'
import type { RelOp } from '@/shared/types'
import { gRatioSamples, reverseInequality, statementsEquivalent } from './equiv'
import {
  collectVars,
  compileExpression,
  evalNode,
  isFn,
  isNumberNode,
  isOp,
  isUnaryMinus,
  nearlyEqual,
  negateNode,
  nodeArgs,
  symbolName,
  tryConst,
  walkNode,
  type MathNode,
} from './math'
import { patternHit } from './matchers/catalog'
import { reverseRelOp } from './parse'
import { DEFAULT_SEED, exprEquivalent, prettyNumber, type Scope } from './samples'
import { isInequality, type Relation, type Statement } from './types'

const SYM: Record<RelOp, string> = { '=': '=', '<': '<', '<=': '≤', '>': '>', '>=': '≥' }

export interface MatcherContext {
  seed?: number
  moduleId?: string
}

function single(stmt: Statement): Relation | null {
  return stmt.disjuncts.length === 1 && stmt.disjuncts[0]!.length === 1 ? stmt.disjuncts[0]![0]! : null
}

function varsOf(a: Statement, b: Statement): string[] {
  return [...new Set([...a.vars, ...b.vars])]
}

function src(n: MathNode): string {
  return `(${n.toString()})`
}

function additiveTerms(node: MathNode): MathNode[] {
  if (isOp(node, '+') && nodeArgs(node).length === 2) return nodeArgs(node).flatMap(additiveTerms)
  if (isOp(node, '-') && nodeArgs(node).length === 2) {
    const [a, b] = nodeArgs(node)
    return [...additiveTerms(a!), negateNode(b!)]
  }
  return [node]
}

function sumNodes(terms: MathNode[]): MathNode {
  if (terms.length === 0) return compileExpression('0')
  if (terms.length === 1) return terms[0]!
  return compileExpression(terms.map(src).join('+'))
}

/** Replace one specific sub-node (by reference) inside `root`. */
function replaceNode(root: MathNode, target: MathNode, replacement: MathNode): MathNode {
  return root.transform((n) => (n === target ? replacement : n))
}

// ---------------------------------------------------------------------------
// Candidate generators (each yields wrong versions of ONE side)
// ---------------------------------------------------------------------------

function minusTeleportCandidates(side: MathNode): MathNode[] {
  const out: MathNode[] = []
  walkNode(side, (n) => {
    if (!isOp(n, '/')) return
    const [num, den] = nodeArgs(n)
    if (!num || !den) return
    const terms = additiveTerms(den)
    if (terms.length < 2) return
    for (let i = 0; i < terms.length; i++) {
      const flipped = terms.map((t, j) => (j === i ? negateNode(t) : t))
      out.push(replaceNode(side, n, compileExpression(`-${src(num)}/${src(sumNodes(flipped))}`)))
    }
  })
  return out
}

function partialDistCandidates(side: MathNode): MathNode[] {
  const out: MathNode[] = []
  walkNode(side, (n) => {
    if (!isOp(n, '*')) return
    const args = nodeArgs(n)
    if (args.length !== 2) return
    for (let i = 0; i < 2; i++) {
      const factor = args[i]!
      const other = args[1 - i]!
      const terms = additiveTerms(other)
      if (terms.length < 2) continue
      for (let k = 0; k < terms.length; k++) {
        const wrong = terms.map((t, j) => (j === k ? t : compileExpression(`${src(factor)}*${src(t)}`)))
        out.push(replaceNode(side, n, sumNodes(wrong)))
      }
    }
  })
  return out
}

/** −2(x − 3) → −2x − 6 and −(a + b) → −a + b: the minus reached only the first term. */
function negativeNotDistributedCandidates(side: MathNode): MathNode[] {
  const out: MathNode[] = []
  walkNode(side, (n) => {
    if (isUnaryMinus(n)) {
      const terms = additiveTerms(nodeArgs(n)[0]!)
      if (terms.length >= 2) {
        const wrong = terms.map((t, j) => (j === 0 ? negateNode(t) : t))
        out.push(replaceNode(side, n, sumNodes(wrong)))
      }
    }
    const isNegProduct = isUnaryMinus(n) && isOp(nodeArgs(n)[0]!, '*')
    const prod = isNegProduct ? nodeArgs(n)[0]! : n
    if (!isOp(prod, '*')) return
    const args = nodeArgs(prod)
    if (args.length !== 2) return
    for (let i = 0; i < 2; i++) {
      const factor = args[i]!
      const other = args[1 - i]!
      const c = tryConst(factor)
      const coef = c == null ? null : isNegProduct ? -c : c
      if (coef == null || coef >= 0) continue
      const terms = additiveTerms(other)
      if (terms.length < 2) continue
      const wrong = terms.map((t, j) => compileExpression(`${j === 0 ? coef : -coef}*${src(t)}`))
      out.push(replaceNode(side, n, sumNodes(wrong)))
    }
  })
  return out
}

function constIntoRadicalCandidates(side: MathNode): MathNode[] {
  const out: MathNode[] = []
  walkNode(side, (n) => {
    if (!isOp(n, '+') && !(isOp(n, '-') && nodeArgs(n).length === 2)) return
    const [a, b] = nodeArgs(n)
    if (!a || !b) return
    const isRad = (m: MathNode) => isFn(m, 'cbrt') || isFn(m, 'sqrt')
    const radical = isRad(a) ? a : isRad(b) ? b : null
    const other = radical === a ? b : radical === b ? a : null
    if (!radical || !other) return
    const inner = nodeArgs(radical)[0]
    if (!inner) return
    const fn = isFn(radical, 'cbrt') ? 'cbrt' : 'sqrt'
    if (isOp(n, '+')) out.push(replaceNode(side, n, compileExpression(`${fn}(${src(inner)}+${src(other)})`)))
    else if (radical === a) out.push(replaceNode(side, n, compileExpression(`${fn}(${src(inner)}-${src(other)})`)))
  })
  return out
}

function cbrtSignCandidates(side: MathNode): MathNode[] {
  const out: MathNode[] = []
  walkNode(side, (n) => {
    if (!isFn(n, 'cbrt')) return
    const inner = nodeArgs(n)[0]
    if (!inner) return
    out.push(replaceNode(side, n, compileExpression(`cbrt(-${src(inner)})`)))
  })
  return out
}

/** (a+b)^k → a^k + b^k, and sqrt/cbrt/abs(a+b) → f(a) + f(b) */
function powerOverSumCandidates(side: MathNode): MathNode[] {
  const out: MathNode[] = []
  walkNode(side, (n) => {
    for (const fn of ['sqrt', 'cbrt', 'abs'] as const) {
      if (!isFn(n, fn)) continue
      const inner = nodeArgs(n)[0]
      const terms = inner ? additiveTerms(inner) : []
      if (terms.length < 2) continue
      out.push(replaceNode(side, n, sumNodes(terms.map((t) => compileExpression(`${fn}${src(t)}`)))))
    }
    if (!isOp(n, '^')) return
    const [base, exp] = nodeArgs(n)
    if (!base || !exp) return
    const terms = additiveTerms(base)
    if (terms.length < 2) return
    out.push(replaceNode(side, n, sumNodes(terms.map((t) => compileExpression(`${src(t)}^${src(exp)}`)))))
  })
  return out
}

/** a/(b+c) → a/b + a/c */
function splitDenominatorCandidates(side: MathNode): MathNode[] {
  const out: MathNode[] = []
  walkNode(side, (n) => {
    if (!isOp(n, '/')) return
    const [num, den] = nodeArgs(n)
    if (!num || !den) return
    const terms = additiveTerms(den)
    if (terms.length < 2) return
    out.push(replaceNode(side, n, sumNodes(terms.map((t) => compileExpression(`${src(num)}/${src(t)}`)))))
  })
  return out
}

/** (a+b)/c → a/c + b : only one term was divided. */
function cancelTermCandidates(side: MathNode): MathNode[] {
  const out: MathNode[] = []
  walkNode(side, (n) => {
    if (!isOp(n, '/')) return
    const [num, den] = nodeArgs(n)
    if (!num || !den) return
    const terms = additiveTerms(num)
    if (terms.length < 2) return
    for (let i = 0; i < terms.length; i++) {
      out.push(replaceNode(side, n, sumNodes(terms.map((t, j) => (j === i ? compileExpression(`${src(t)}/${src(den)}`) : t)))))
    }
  })
  return out
}

/** a/b + c/d → (a+c)/(b+d) */
function addDenominatorCandidates(side: MathNode): MathNode[] {
  const out: MathNode[] = []
  walkNode(side, (n) => {
    if (!isOp(n, '+') || nodeArgs(n).length !== 2) return
    const [a, b] = nodeArgs(n)
    if (!a || !b || !isOp(a, '/') || !isOp(b, '/')) return
    const [an, ad] = nodeArgs(a)
    const [bn, bd] = nodeArgs(b)
    if (!an || !ad || !bn || !bd) return
    out.push(replaceNode(side, n, compileExpression(`(${src(an)}+${src(bn)})/(${src(ad)}+${src(bd)})`)))
  })
  return out
}

/** sqrt(u^2) → u */
function sqrtSquareCandidates(side: MathNode): MathNode[] {
  const out: MathNode[] = []
  walkNode(side, (n) => {
    if (!isFn(n, 'sqrt')) return
    const inner = nodeArgs(n)[0]
    if (!inner || !isOp(inner, '^')) return
    const [base, exp] = nodeArgs(inner)
    if (!base || !exp || tryConst(exp) !== 2) return
    out.push(replaceNode(side, n, base))
  })
  return out
}

/** (-u)^k with even k → -(u^k) */
function negPowerCandidates(side: MathNode): MathNode[] {
  const out: MathNode[] = []
  walkNode(side, (n) => {
    if (!isOp(n, '^')) return
    const [base, exp] = nodeArgs(n)
    if (!base || !exp || !isUnaryMinus(base)) return
    const k = tryConst(exp)
    if (k == null || !Number.isInteger(k) || k % 2 !== 0) return
    out.push(replaceNode(side, n, compileExpression(`-(${src(nodeArgs(base)[0]!)}^${k})`)))
  })
  return out
}

/**
 * Numeric coefficient and the remaining factors of a product. A unary minus anywhere in the
 * product (−2y parses as unaryMinus(2)·y, −(3/4)y as unaryMinus(3/4)·y) counts as a factor −1.
 */
function coefficientOf(term: MathNode): { coef: number; rest: MathNode[] } {
  let coef = 1
  const rest: MathNode[] = []
  const visit = (node: MathNode) => {
    if (isUnaryMinus(node)) {
      coef = -coef
      visit(nodeArgs(node)[0]!)
      return
    }
    if (isOp(node, '*')) {
      for (const f of nodeArgs(node)) visit(f)
      return
    }
    const c = tryConst(node)
    if (c != null) coef *= c
    else rest.push(node)
  }
  visit(term)
  return { coef, rest }
}

/** 2x + 3 → 5x: unlike terms merged. */
function combineUnlikeCandidates(side: MathNode): MathNode[] {
  const terms = additiveTerms(side)
  if (terms.length < 2) return []
  const out: MathNode[] = []
  for (let i = 0; i < terms.length; i++) {
    for (let j = 0; j < terms.length; j++) {
      if (i === j) continue
      const a = coefficientOf(terms[i]!)
      const b = coefficientOf(terms[j]!)
      if (!a.rest.length || b.rest.length) continue
      const merged = compileExpression(`${a.coef + b.coef}*${a.rest.map(src).join('*')}`)
      out.push(sumNodes(terms.filter((_, k) => k !== i && k !== j).concat(merged)))
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Witness text
// ---------------------------------------------------------------------------

/** A point where the two sides differ, naming every variable either side uses. */
function sideWitness(oldSide: MathNode, newSide: MathNode, vars: string[]): string | undefined {
  const probes = [0, 1, 2, -1, 3, 0.5]
  const used = [...new Set([...collectVars(oldSide), ...collectVars(newSide)])].sort()
  for (const t of probes) {
    const scope: Scope = {}
    for (const v of vars) scope[v] = v === 'y' && vars.includes('x') ? 1 : t
    const a = evalNode(oldSide, scope)
    const b = evalNode(newSide, scope)
    if (a === 'undef' || b === 'undef') continue
    if (nearlyEqual(a, b, Math.max(Math.abs(a), Math.abs(b)))) continue
    if (prettyNumber(a) === prettyNumber(b)) continue
    const where = used.map((v) => `${v} = ${prettyNumber(scope[v] ?? t)}`).join(', ')
    const at = where ? `At ${where}: t` : 'T'
    return `${at}he original side gives ${prettyNumber(a)}, yours gives ${prettyNumber(b)}.`
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

type SideMatcher = { id: ErrorPatternId; candidates: (side: MathNode) => MathNode[] }

const SIDE_MATCHERS: SideMatcher[] = [
  { id: 'minus_teleport', candidates: minusTeleportCandidates },
  { id: 'partial_distribute', candidates: partialDistCandidates },
  { id: 'negative_not_distributed', candidates: negativeNotDistributedCandidates },
  { id: 'const_into_radical', candidates: constIntoRadicalCandidates },
  { id: 'cbrt_sign_dropped', candidates: cbrtSignCandidates },
  { id: 'power_over_sum', candidates: powerOverSumCandidates },
  { id: 'split_denominator', candidates: splitDenominatorCandidates },
  { id: 'cancel_term', candidates: cancelTermCandidates },
  { id: 'add_denominators', candidates: addDenominatorCandidates },
  { id: 'sqrt_square_abs', candidates: sqrtSquareCandidates },
  { id: 'neg_power_sign', candidates: negPowerCandidates },
  { id: 'combine_unlike', candidates: combineUnlikeCandidates },
]

function matchSides(o: Relation, n: Relation, vars: string[], seed: number): PatternHit | undefined {
  const pairs: [MathNode, MathNode][] = [
    [o.lhs, n.lhs],
    [o.rhs, n.rhs],
    [o.lhs, n.rhs],
    [o.rhs, n.lhs],
  ]
  for (const m of SIDE_MATCHERS) {
    for (const [oldSide, newSide] of pairs) {
      for (const cand of m.candidates(oldSide)) {
        if (exprEquivalent(newSide, cand, vars, seed)) return patternHit(m.id, sideWitness(oldSide, newSide, vars))
      }
    }
  }
  return undefined
}

/** (3/5)y = x − 2 → y = (5/3)x − 2: reciprocal applied to one term only. */
function reciprocalCoeff(o: Relation, n: Relation, vars: string[], seed: number): PatternHit | undefined {
  for (const [coefSide, other] of [
    [o.lhs, o.rhs],
    [o.rhs, o.lhs],
  ] as const) {
    const { coef, rest } = coefficientOf(coefSide)
    if (rest.length !== 1 || Math.abs(coef) < 1e-12 || Math.abs(Math.abs(coef) - 1) < 1e-12) continue
    const v = symbolName(rest[0]!)
    if (!v) continue
    const terms = additiveTerms(other)
    const recip = 1 / coef
    const oneTerm: MathNode[] = []
    for (let i = 0; i < terms.length; i++) {
      oneTerm.push(sumNodes(terms.map((t, j) => (j === i ? compileExpression(`(${recip})*${src(t)}`) : t))))
    }
    oneTerm.push(compileExpression(`${src(other)}+(${recip})`), compileExpression(`${src(other)}-(${recip})`))
    // k·R: multiplied by the coefficient itself instead of its reciprocal.
    const sameCoef = compileExpression(`(${coef})*${src(other)}`)
    for (const [studentVar, studentSide] of [
      [n.lhs, n.rhs],
      [n.rhs, n.lhs],
    ] as const) {
      if (symbolName(studentVar) !== v) continue
      if (exprEquivalent(studentSide, sameCoef, vars, seed)) {
        return patternHit(
          'reciprocal_coeff',
          `${v} is multiplied by ${prettyNumber(coef)}, so undo it by multiplying by the reciprocal ${prettyNumber(recip)} — you multiplied by ${prettyNumber(coef)} again instead.`,
        )
      }
      for (const cand of oneTerm) {
        if (exprEquivalent(studentSide, cand, vars, seed)) {
          return patternHit('reciprocal_coeff', `The coefficient ${prettyNumber(coef)} multiplies ${v}, so undo it by multiplying EVERY term of the other side by ${prettyNumber(recip)}.`)
        }
      }
    }
  }
  return undefined
}

/** x + 3 = 7 → x = 7 + 3 (or x + 3 < 7 → x < 7 + 3): a term crossed the sign without changing sign. */
function termAcrossSign(o: Relation, n: Relation, vars: string[], seed: number): PatternHit | undefined {
  if (o.op !== n.op) return undefined
  for (const [from, to, fromIsLeft] of [
    [o.lhs, o.rhs, true],
    [o.rhs, o.lhs, false],
  ] as const) {
    const terms = additiveTerms(from)
    if (terms.length < 2) continue
    for (let i = 0; i < terms.length; i++) {
      const t = terms[i]!
      if (isNumberNode(t) === false && tryConst(t) == null && !symbolName(t)) continue
      const remaining = sumNodes(terms.filter((_, j) => j !== i))
      const wrong = compileExpression(`${src(to)}+${src(t)}`)
      const newFrom = fromIsLeft ? n.lhs : n.rhs
      const newTo = fromIsLeft ? n.rhs : n.lhs
      if (exprEquivalent(newFrom, remaining, vars, seed) && exprEquivalent(newTo, wrong, vars, seed)) {
        const c = tryConst(t)
        const witness =
          c != null
            ? `Moving ${prettyNumber(c)} to the other side means ${c < 0 ? `adding ${prettyNumber(-c)} to` : `subtracting ${prettyNumber(c)} from`} both sides, so it arrives as ${prettyNumber(-c)}.`
            : `Moving ${t.toString()} to the other side means subtracting it from both sides, so it arrives as −(${t.toString()}).`
        return patternHit('term_across_sign', witness)
      }
    }
  }
  return undefined
}

/** y = cbrt(u) − 1 → y³ = u − 1: the cube hit only the radical. */
function opOnOneTerm(o: Relation, n: Relation, vars: string[], seed: number): PatternHit | undefined {
  for (const [radSide, other, radIsLeft] of [
    [o.lhs, o.rhs, true],
    [o.rhs, o.lhs, false],
  ] as const) {
    const terms = additiveTerms(radSide)
    if (terms.length < 2) continue
    for (let i = 0; i < terms.length; i++) {
      const t = terms[i]!
      const k = isFn(t, 'cbrt') ? 3 : isFn(t, 'sqrt') ? 2 : null
      if (!k) continue
      const inner = nodeArgs(t)[0]!
      const wrongSide = sumNodes(terms.map((x, j) => (j === i ? inner : x)))
      const poweredOther = compileExpression(`${src(other)}^${k}`)
      const newRad = radIsLeft ? n.lhs : n.rhs
      const newOther = radIsLeft ? n.rhs : n.lhs
      if (exprEquivalent(newRad, wrongSide, vars, seed) && exprEquivalent(newOther, poweredOther, vars, seed)) {
        return patternHit('op_on_one_term', `You ${k === 3 ? 'cubed' : 'squared'} the root but not the rest of that side. Isolate the root first, then ${k === 3 ? 'cube' : 'square'} the whole side.`)
      }
    }
  }
  return undefined
}

/** a op1 m op2 b → b op1 m op2 a: the chain read from the other end with its symbols unchanged. */
function chainReadBackwards(oldS: Statement, newS: Statement, vars: string[], seed: number): string | undefined {
  if (oldS.disjuncts.length !== 1 || newS.disjuncts.length !== 1) return undefined
  const oc = oldS.disjuncts[0]!
  const nc = newS.disjuncts[0]!
  const k = oc.length
  if (k < 2 || nc.length !== k) return undefined
  const mirrored = nc.every((rel, i) => {
    const mirror = oc[k - 1 - i]!
    return (
      isInequality(rel.op) &&
      (rel.op === oc[i]!.op || rel.op === mirror.op) &&
      exprEquivalent(rel.lhs, mirror.rhs, vars, seed) &&
      exprEquivalent(rel.rhs, mirror.lhs, vars, seed)
    )
  })
  if (!mirrored) return undefined
  const forward = [oc[0]!.lhsSrc, ...oc.flatMap((r) => [SYM[r.op], r.rhsSrc])].join(' ')
  const backward = [oc[k - 1]!.rhsSrc, ...[...oc].reverse().flatMap((r) => [SYM[reverseRelOp(r.op)], r.lhsSrc])].join(' ')
  return `Reading ${forward} from the other end gives ${backward} — every symbol turns around when the ends swap places.`
}

function inequalityDirection(oldS: Statement, newS: Statement, o: Relation | null, n: Relation | null, vars: string[], seed: number): PatternHit | undefined {
  const reversed = reverseInequality(newS)
  if (!statementsEquivalent(oldS, reversed) || statementsEquivalent(oldS, newS)) return undefined
  if (o && n && exprEquivalent(n.lhs, o.rhs, vars, seed) && exprEquivalent(n.rhs, o.lhs, vars, seed)) {
    return patternHit('swap_sides_no_reverse')
  }
  const chainWitness = chainReadBackwards(oldS, newS, vars, seed)
  if (chainWitness) return patternHit('swap_sides_no_reverse', chainWitness)
  const addRatio = gRatioSamples(oldS, reversed)
  if (addRatio != null && addRatio > 0 && Math.abs(addRatio - 1) < 1e-6) return patternHit('flip_on_add')
  return patternHit('no_sign_flip', 'Your line is the old one with the symbol reversed — that only happens when you multiply or divide by a negative.')
}

/** Tier-3 hook: explain a rejected step with a known error pattern, or undefined. */
export function runMatchers(oldS: Statement, newS: Statement, ctx: MatcherContext = {}): PatternHit | undefined {
  const seed = ctx.seed ?? DEFAULT_SEED
  const vars = varsOf(oldS, newS)
  const o = single(oldS)
  const n = single(newS)

  const dir = inequalityDirection(oldS, newS, o, n, vars, seed)
  if (dir) return dir
  if (!o || !n) return undefined

  return (
    matchSides(o, n, vars, seed) ??
    reciprocalCoeff(o, n, vars, seed) ??
    termAcrossSign(o, n, vars, seed) ??
    opOnOneTerm(o, n, vars, seed)
  )
}

/** Legacy name. */
export const matchErrorPattern = runMatchers
