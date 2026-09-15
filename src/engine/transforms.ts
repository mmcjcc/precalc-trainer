/**
 * Tier 1 — structural transform detectors (engine-design §4, BUILD_GUIDE §4).
 *
 * `detectMove(old, new, opts)` looks at the two statements and either
 *   - accepts (rewrite / swap sides / add / multiply / cube / cube root / ± root / swap x,y),
 *   - rejects with a named error pattern (no_sign_flip, flip_on_add, swap_misname, ...), or
 *   - defers to Tier 2 with the move it recognised (non-constant multiplier, squaring, reciprocal,
 *     single-branch even root) so the solution-set comparison can decide.
 * Every numeric test is "equal on the seeded samples" (samples.ts); even-power / root tests use
 * the loose domain (sqrt(x)^2 ≡ x where both are defined) and leave the domain to Tier 2.
 */
import type { ChipId, DetectedMove, ErrorPatternId, PropertyTag, RelOp } from '@/shared/types'
import { CHIP_LABEL, CHIP_OF_TAG } from '@/shared/types'
import { statementsEquivalent } from './equiv'
import {
  collectVars,
  compileExpression,
  domainSubexpressions,
  evalNode,
  isFn,
  nearlyEqual,
  nodeArgs,
  substituteVars,
  tryConst,
  type MathNode,
} from './math'
import { mapStatement, reverseRelOp, singleRelation } from './parse'
import { classifyRewriteNodes } from './rewriteClassifier'
import { constantOnSamples, exprEquiv, makeSamples, prettyNumber, type Scope } from './samples'
import { isInequality, isStrict, type Relation, type Statement } from './types'

export type DeferReason = 'nonconstant_ratio' | 'nonconstant_add' | 'square' | 'reciprocal' | 'root_single'

export type Detection =
  | {
      kind: 'accept'
      move: DetectedMove
      /** Chips graded correct (the move's own chip plus e.g. swap_sides when the sides were also swapped). */
      chips: ChipId[]
      verdict: 'equivalent' | 'equivalent_by_rename'
      swapped?: boolean
    }
  | { kind: 'reject'; pattern: ErrorPatternId; witness?: string; move?: DetectedMove }
  | { kind: 'defer'; reason: DeferReason; move: DetectedMove; chips: ChipId[] }

export interface DetectOptions {
  seed: number
  checkValue?: number
  allowSwap?: boolean
}

interface Env {
  vars: string[]
  seed: number
  checkValue?: number
  samples: Scope[]
}

const SYM: Record<RelOp, string> = { '=': '=', '<': '<', '<=': '≤', '>': '>', '>=': '≥' }

// ---------------------------------------------------------------------------
// Node helpers
// ---------------------------------------------------------------------------

function src(n: MathNode): string {
  return `(${n.toString()})`
}
function powN(n: MathNode, k: number): MathNode {
  return compileExpression(`${src(n)}^${k}`)
}
function cbrtN(n: MathNode): MathNode {
  return compileExpression(`cbrt${src(n)}`)
}
function sqrtN(n: MathNode): MathNode {
  return compileExpression(`sqrt${src(n)}`)
}
function negN(n: MathNode): MathNode {
  return compileExpression(`-${src(n)}`)
}
function recipN(n: MathNode): MathNode {
  return compileExpression(`1/${src(n)}`)
}

function eq(a: MathNode, b: MathNode, env: Env, loose = false): boolean {
  // Structurally identical trees are equal everywhere, including where the sampler finds too few
  // defined points (e.g. sqrt((y - 9)/4) after swapping x and y).
  if (a.toString() === b.toString()) return true
  return exprEquiv(a, b, env.vars, env.seed, { domain: loose ? 'loose' : 'strict' }, env.checkValue).equivalent
}

function swapRelation(rel: Relation): Relation {
  return { lhs: rel.rhs, rhs: rel.lhs, op: reverseRelOp(rel.op), lhsSrc: rel.rhsSrc, rhsSrc: rel.lhsSrc }
}

function hasVariableDenominator(rel: Relation): boolean {
  return domainSubexpressions(rel.lhs).zero.length + domainSubexpressions(rel.rhs).zero.length > 0
}

function variableDenominators(rel: Relation): MathNode[] {
  return [...domainSubexpressions(rel.lhs).zero, ...domainSubexpressions(rel.rhs).zero]
}

function move(tag: PropertyTag, detail: string, exact = true, constant?: number): DetectedMove {
  const m: DetectedMove = { tag, chip: CHIP_OF_TAG[tag], exact, detail }
  if (constant != null) m.constant = constant
  return m
}

function accept(m: DetectedMove, extraChips: ChipId[] = []): Detection {
  return { kind: 'accept', move: m, chips: [m.chip, ...extraChips.filter((c) => c !== m.chip)], verdict: 'equivalent' }
}

function defer(reason: DeferReason, m: DetectedMove, extraChips: ChipId[] = []): Detection {
  return { kind: 'defer', reason, move: m, chips: [m.chip, ...extraChips.filter((c) => c !== m.chip)] }
}

function reject(pattern: ErrorPatternId, witness?: string, m?: DetectedMove): Detection {
  const d: Detection = { kind: 'reject', pattern }
  if (witness) d.witness = witness
  if (m) d.move = m
  return d
}

// ---------------------------------------------------------------------------
// Numeric side analyses
// ---------------------------------------------------------------------------

/** L'−L ≡ R'−R on the samples → the common difference (constant when it is one). */
function sideDelta(o: Relation, n: Relation, env: Env): { constant: number | null; zero: boolean } | null {
  const deltas: number[] = []
  let compared = 0
  for (const s of env.samples) {
    const oL = evalNode(o.lhs, s)
    const oR = evalNode(o.rhs, s)
    const nL = evalNode(n.lhs, s)
    const nR = evalNode(n.rhs, s)
    if (oL === 'undef' || oR === 'undef' || nL === 'undef' || nR === 'undef') continue
    const dL = nL - oL
    const dR = nR - oR
    const scale = Math.max(Math.abs(oL), Math.abs(oR), Math.abs(nL), Math.abs(nR))
    if (!nearlyEqual(dL, dR, scale)) return null
    deltas.push(dL)
    compared++
  }
  if (compared < 6) return null
  const zero = deltas.every((d) => Math.abs(d) <= 1e-9)
  return { constant: constantOnSamples(deltas), zero }
}

/** L'/L ≡ R'/R on the samples (where L, R ≠ 0) → constant multiplier or a varying expression. */
function sideRatio(
  o: Relation,
  n: Relation,
  env: Env,
): { kind: 'constant'; value: number } | { kind: 'expression'; typicalAbs: number } | null {
  const ratios: number[] = []
  let compared = 0
  for (const s of env.samples) {
    const oL = evalNode(o.lhs, s)
    const oR = evalNode(o.rhs, s)
    const nL = evalNode(n.lhs, s)
    const nR = evalNode(n.rhs, s)
    if (oL === 'undef' || oR === 'undef' || nL === 'undef' || nR === 'undef') continue
    if (Math.abs(oL) <= 1e-9 * Math.max(1, Math.abs(nL)) || Math.abs(oR) <= 1e-9 * Math.max(1, Math.abs(nR))) continue
    const rL = nL / oL
    const rR = nR / oR
    if (!nearlyEqual(rL, rR, Math.max(Math.abs(rL), Math.abs(rR)))) return null
    ratios.push(rL)
    compared++
  }
  if (compared < 6) return null
  const c = constantOnSamples(ratios)
  if (c != null) return { kind: 'constant', value: c }
  const mags = ratios.map(Math.abs).sort((a, b) => a - b)
  return { kind: 'expression', typicalAbs: mags[Math.floor(mags.length / 2)] ?? 1 }
}

/** Normalised form h op 0 (h = L−R for =,<,≤ and R−L for >,≥). */
function hAt(rel: Relation, s: Scope): number | 'undef' {
  const l = evalNode(rel.lhs, s)
  const r = evalNode(rel.rhs, s)
  if (l === 'undef' || r === 'undef') return 'undef'
  return rel.op === '>' || rel.op === '>=' ? r - l : l - r
}

/** h_new / h_old constant on the samples → that constant. */
function hRatio(o: Relation, n: Relation, env: Env): number | null {
  const ratios: number[] = []
  for (const s of env.samples) {
    const ho = hAt(o, s)
    const hn = hAt(n, s)
    if (ho === 'undef' || hn === 'undef') continue
    if (Math.abs(ho) <= 1e-9 * Math.max(1, Math.abs(hn))) continue
    ratios.push(hn / ho)
  }
  if (ratios.length < 6) return null
  return constantOnSamples(ratios)
}

// ---------------------------------------------------------------------------
// Move descriptions
// ---------------------------------------------------------------------------

function isNiceDivisor(d: number): boolean {
  return Math.abs(d - Math.round(d)) < 1e-9 && Math.abs(d) >= 2
}

/** Describe multiplying by m as a divide (when 1/m is a whole number) or a multiply. */
function mulMove(m: number, ineq: boolean, flipped: boolean): DetectedMove {
  const divisor = 1 / m
  const divide = isNiceDivisor(divisor)
  const shown = divide ? divisor : m
  let detail = divide
    ? `divided both sides by ${prettyNumber(divisor)}`
    : `multiplied both sides by ${prettyNumber(m)}`
  if (ineq && m < 0 && flipped) detail += ' — negative, so the symbol flips'
  const tag: PropertyTag = ineq && m < 0 && flipped ? 'mul_div_neg_flip' : divide ? 'div_both' : 'mul_both'
  return move(tag, detail, true, shown)
}

function addMove(d: number): DetectedMove {
  if (d < 0) return move('sub_both', `subtracted ${prettyNumber(-d)} from both sides`, true, -d)
  return move('add_both', `added ${prettyNumber(d)} to both sides`, true, d)
}

function multiplierWord(m: number): string {
  const divisor = 1 / m
  return isNiceDivisor(divisor) ? `divided by ${prettyNumber(divisor)}` : `multiplied by ${prettyNumber(m)}`
}

// ---------------------------------------------------------------------------
// Single-relation detectors
// ---------------------------------------------------------------------------

function rewriteDetection(o: Relation, n: Relation): Detection {
  const leftChanged = o.lhs.toString() !== n.lhs.toString()
  const rightChanged = o.rhs.toString() !== n.rhs.toString()
  let cls = classifyRewriteNodes(o.lhs, n.lhs)
  let side = 'left'
  if (rightChanged && !leftChanged) {
    cls = classifyRewriteNodes(o.rhs, n.rhs)
    side = 'right'
  } else if (leftChanged && rightChanged) {
    const r = classifyRewriteNodes(o.rhs, n.rhs)
    if (cls.chip !== r.chip) cls = { chip: cls.confidence === 'high' ? cls.chip : r.chip, confidence: 'medium' }
    else if (cls.confidence !== 'high' || r.confidence !== 'high') cls = { chip: cls.chip, confidence: 'medium' }
    side = 'both'
  } else if (!leftChanged && !rightChanged) {
    cls = { chip: 'simplify', confidence: 'low' }
  }
  const tag = cls.chip as PropertyTag
  const where = side === 'both' ? 'on both sides' : `on the ${side} side`
  const detail = `rewrote ${where} (${CHIP_LABEL[cls.chip]})`
  return accept(move(tag, detail, cls.confidence === 'high'))
}

function bothSides(base: Relation, n: Relation, env: Env, viaSwap: boolean): Detection | null {
  const ineq = isInequality(base.op)
  const sameOp = n.op === base.op
  const revOp = ineq && n.op === reverseRelOp(base.op)
  const extra: ChipId[] = viaSwap ? ['swap_sides'] : []
  const swapNote = viaSwap ? ' and swapped the sides' : ''

  const delta = sideDelta(base, n, env)
  if (delta && !delta.zero) {
    if (sameOp) {
      if (delta.constant != null) {
        const m = addMove(delta.constant)
        m.detail += swapNote
        return accept(m, extra)
      }
      return defer('nonconstant_add', move('add_both', `added the same expression to both sides${swapNote}`), extra)
    }
    if (revOp) {
      const what = delta.constant != null ? `added ${prettyNumber(delta.constant)} to both sides` : 'added the same expression to both sides'
      return reject('flip_on_add', `You ${what} and flipped ${SYM[base.op]} to ${SYM[n.op]} — adding or subtracting never flips the symbol.`)
    }
  }

  const ratio = sideRatio(base, n, env)
  if (!ratio) return null
  if (ratio.kind === 'constant') {
    const m = ratio.value
    if (Math.abs(m - 1) < 1e-9) return null
    if (m > 0) {
      if (sameOp) {
        const mv = mulMove(m, ineq, false)
        mv.detail += swapNote
        return accept(mv, extra)
      }
      if (revOp) {
        return reject(
          'flip_on_positive',
          `You ${multiplierWord(m)} — a positive number — so ${SYM[base.op]} should stay ${SYM[base.op]}, not become ${SYM[n.op]}.`,
        )
      }
      return null
    }
    if (!ineq) {
      if (!sameOp) return null
      const mv = mulMove(m, false, false)
      mv.detail += swapNote
      return accept(mv, extra)
    }
    if (revOp) {
      const mv = mulMove(m, true, true)
      mv.detail += swapNote
      return accept(mv, extra)
    }
    if (sameOp) {
      return reject(
        'no_sign_flip',
        `You ${multiplierWord(m)} — a negative number — but kept ${SYM[base.op]}. Multiplying or dividing by a negative turns it into ${SYM[reverseRelOp(base.op)]}.`,
        mulMove(m, true, false),
      )
    }
    return null
  }
  // non-constant multiplier
  if (ineq) {
    return reject(
      'nonconstant_multiplier_inequality',
      'You multiplied both sides by an expression that is positive for some values and negative for others — the symbol would have to flip only some of the time.',
    )
  }
  if (!sameOp) return null
  const oldDen = variableDenominators(base)
  if (oldDen.length && !hasVariableDenominator(n)) {
    const names = [...new Set(oldDen.map((d) => d.toString()))]
    return defer(
      'nonconstant_ratio',
      move('clear_denominator', `multiplied both sides by ${names.join(' and ')} to clear the denominator${swapNote}`),
      extra,
    )
  }
  const divided = (!oldDen.length && hasVariableDenominator(n)) || ratio.typicalAbs < 1
  return divided
    ? defer('nonconstant_ratio', move('div_both', `divided both sides by the same expression${swapNote}`), extra)
    : defer('nonconstant_ratio', move('mul_both', `multiplied both sides by the same expression${swapNote}`), extra)
}

function powerAndRoots(base: Relation, n: Relation, env: Env, viaSwap: boolean): Detection | null {
  if (n.op !== base.op) return null
  const extra: ChipId[] = viaSwap ? ['swap_sides'] : []
  const swapNote = viaSwap ? ' and swapped the sides' : ''
  if (eq(n.lhs, powN(base.lhs, 3), env, true) && eq(n.rhs, powN(base.rhs, 3), env, true)) {
    return accept(move('cube_both', `cubed both sides${swapNote}`), extra)
  }
  if (eq(n.lhs, powN(base.lhs, 2), env, true) && eq(n.rhs, powN(base.rhs, 2), env, true)) {
    return defer('square', move('square_both', `squared both sides${swapNote}`), extra)
  }
  if (eq(n.lhs, cbrtN(base.lhs), env, true) && eq(n.rhs, cbrtN(base.rhs), env, true)) {
    return accept(move('cube_root_both', `took the cube root of both sides${swapNote}`), extra)
  }
  return null
}

function reciprocal(base: Relation, n: Relation, env: Env, viaSwap: boolean): Detection | null {
  if (!eq(n.lhs, recipN(base.lhs), env) || !eq(n.rhs, recipN(base.rhs), env)) return null
  const extra: ChipId[] = viaSwap ? ['swap_sides'] : []
  return defer('reciprocal', move('rewrite_fraction', `took the reciprocal of both sides${viaSwap ? ' and swapped the sides' : ''}`), extra)
}

/** Single branch of an even root: S'^2 ≡ S and T' ≡ ±sqrt(T). */
function rootSingle(o: Relation, n: Relation, env: Env): Detection | null {
  if (o.op !== '=' || n.op !== '=') return null
  for (const [S, T] of [
    [o.lhs, o.rhs],
    [o.rhs, o.lhs],
  ] as const) {
    for (const [Sp, Tp] of [
      [n.lhs, n.rhs],
      [n.rhs, n.lhs],
    ] as const) {
      if (!collectVars(Sp).length) continue
      if (!eq(powN(Sp, 2), S, env, true)) continue
      const root = sqrtN(T)
      if (eq(Tp, root, env, true) || eq(Tp, negN(root), env, true)) {
        return defer('root_single', move('root_both_pm', 'took the square root of both sides — one branch only'))
      }
    }
  }
  return null
}

/** Which side the variable terms sit on. */
function variableSide(rel: Relation): 'L' | 'R' | 'mixed' {
  const l = collectVars(rel.lhs).length > 0
  const r = collectVars(rel.rhs).length > 0
  return l && !r ? 'L' : r && !l ? 'R' : 'mixed'
}

/** (L' − R') / (L − R) constant on the samples → that constant (no direction folding). */
function dRatio(o: Relation, n: Relation, env: Env): number | null {
  const ratios: number[] = []
  for (const s of env.samples) {
    const lo = evalNode(o.lhs, s)
    const ro = evalNode(o.rhs, s)
    const ln = evalNode(n.lhs, s)
    const rn = evalNode(n.rhs, s)
    if (lo === 'undef' || ro === 'undef' || ln === 'undef' || rn === 'undef') continue
    const d0 = lo - ro
    const d1 = ln - rn
    if (Math.abs(d0) <= 1e-9 * Math.max(1, Math.abs(d1))) continue
    ratios.push(d1 / d0)
  }
  if (ratios.length < 6) return null
  return constantOnSamples(ratios)
}

/**
 * The new inequality points the wrong way. The normalised h-ratio cannot tell WHY: "divided by a
 * negative and kept the symbol" and "divided by a positive and turned it" both give a negative h
 * ratio. Keep the variable on the side it started on (she did the operation in place), then read
 * the raw multiplier: positive with the symbol turned -> flip_on_positive (flip_on_add when the
 * multiplier is 1); negative with the symbol kept -> no_sign_flip.
 */
function directionError(o: Relation, n: Relation, env: Env): Detection | null {
  const so = variableSide(o)
  const sn = variableSide(n)
  const aligned = so !== 'mixed' && sn !== 'mixed' && so !== sn ? swapRelation(n) : n
  const r = dRatio(o, aligned, env)
  if (r == null || Math.abs(r) < 1e-12) return null
  const reading = aligned === n ? '' : ` (reading your line as ${aligned.lhsSrc} ${SYM[aligned.op]} ${aligned.rhsSrc})`
  const turned = aligned.op !== o.op
  if (r > 0 && turned) {
    if (Math.abs(r - 1) < 1e-9) {
      return reject(
        'flip_on_add',
        `You moved terms across by adding or subtracting on both sides, and turned ${SYM[o.op]} into ${SYM[aligned.op]}${reading}. Adding or subtracting never flips the symbol.`,
      )
    }
    return reject(
      'flip_on_positive',
      `You ${multiplierWord(r)} — a positive number — so ${SYM[o.op]} should stay ${SYM[o.op]}, not become ${SYM[aligned.op]}${reading}.`,
    )
  }
  if (r < 0 && !turned) {
    return reject(
      'no_sign_flip',
      `You ${multiplierWord(r)} — a negative number — but kept ${SYM[o.op]}${reading}. Multiplying or dividing by a negative turns it into ${SYM[reverseRelOp(o.op)]}.`,
      mulMove(r, true, false),
    )
  }
  return null
}

function detectPair(o: Relation, n: Relation, env: Env): Detection | null {
  const ineq = isInequality(o.op)

  if (o.op === n.op && eq(n.lhs, o.lhs, env) && eq(n.rhs, o.rhs, env)) return rewriteDetection(o, n)

  if (eq(n.lhs, o.rhs, env) && eq(n.rhs, o.lhs, env)) {
    if (n.op === reverseRelOp(o.op)) {
      return accept(move('swap_sides', ineq ? 'swapped the sides and reversed the symbol' : 'swapped the two sides'))
    }
    if (ineq && n.op === o.op) {
      return reject(
        'swap_sides_no_reverse',
        `Reading ${o.lhsSrc} ${SYM[o.op]} ${o.rhsSrc} from the other side gives ${o.rhsSrc} ${SYM[reverseRelOp(o.op)]} ${o.lhsSrc} — the symbol turns around with the sides.`,
      )
    }
  }

  const swapped = swapRelation(o)
  for (const [base, viaSwap] of [
    [o, false],
    [swapped, true],
  ] as const) {
    const r = bothSides(base, n, env, viaSwap)
    if (r) return r
  }
  for (const [base, viaSwap] of [
    [o, false],
    [swapped, true],
  ] as const) {
    const r = powerAndRoots(base, n, env, viaSwap) ?? reciprocal(base, n, env, viaSwap)
    if (r) return r
  }

  // Normalised h-ratio: catches combined moves (subtract then divide, move-and-swap, ...).
  if (isStrict(o.op) === isStrict(n.op) && (ineq === isInequality(n.op))) {
    const c = hRatio(o, n, env)
    if (c != null && Math.abs(c) > 1e-9) {
      const restricted = hasVariableDenominator(o) !== hasVariableDenominator(n)
      if (!ineq || c > 0) {
        const near1 = Math.abs(c - 1) < 1e-9
        const mv = near1
          ? move('add_both', 'moved terms across the sign (added or subtracted on both sides)')
          : mulMove(c, ineq, false)
        if (!near1) mv.detail += ' (after collecting terms)'
        const chips: ChipId[] = ['add_sub', 'mul_div', 'swap_sides']
        return restricted ? defer('nonconstant_ratio', mv, chips) : accept(mv, chips)
      }
      return (
        directionError(o, n, env) ??
        reject(
          'no_sign_flip',
          `Your line is the old one scaled by ${prettyNumber(c)} — a negative — with the symbol still pointing the same way. Flip it: ${SYM[o.op]} becomes ${SYM[reverseRelOp(o.op)]}.`,
        )
      )
    }
  }

  return rootSingle(o, n, env)
}

// ---------------------------------------------------------------------------
// Statement-level detectors
// ---------------------------------------------------------------------------

function pmRoot(oldS: Statement, newS: Statement, env: Env): Detection | null {
  const o = singleRelation(oldS)
  if (!o || o.op !== '=') return null
  const rootMove = move('root_both_pm', 'took the square root of both sides, keeping ±')
  // abs(S') = sqrt(T)
  const n = singleRelation(newS)
  if (n && n.op === '=') {
    for (const [S, T] of [
      [o.lhs, o.rhs],
      [o.rhs, o.lhs],
    ] as const) {
      for (const [A, B] of [
        [n.lhs, n.rhs],
        [n.rhs, n.lhs],
      ] as const) {
        if (!isFn(A, 'abs')) continue
        const inner = nodeArgs(A)[0]
        if (!inner) continue
        if (eq(powN(inner, 2), S, env, true) && eq(B, sqrtN(T), env, true)) return accept(rootMove)
      }
    }
    return null
  }
  if (newS.disjuncts.length !== 2) return null
  const [ca, cb] = newS.disjuncts
  if (!ca || !cb || ca.length !== 1 || cb.length !== 1) return null
  const a = ca[0]!
  const b = cb[0]!
  if (a.op !== '=' || b.op !== '=') return null
  for (const [S, T] of [
    [o.lhs, o.rhs],
    [o.rhs, o.lhs],
  ] as const) {
    for (const side of ['lhs', 'rhs'] as const) {
      const other = side === 'lhs' ? 'rhs' : 'lhs'
      const ra = a[side]
      const rb = b[side]
      if (!collectVars(ra).length || !eq(ra, rb, env)) continue
      const root = sqrtN(T)
      const neg = negN(root)
      const ta = a[other]
      const tb = b[other]
      // u = ±√T
      if (eq(powN(ra, 2), S, env, true)) {
        if ((eq(ta, root, env, true) && eq(tb, neg, env, true)) || (eq(ta, neg, env, true) && eq(tb, root, env, true))) {
          return accept(rootMove)
        }
      }
      // v = h ± √T with (v − h)² ≡ S: the branches share the centre h = (ta + tb)/2 and differ by ±√T.
      const centre = compileExpression(`(${src(ta)} + ${src(tb)})/2`)
      const half = compileExpression(`(${src(ta)} - ${src(tb)})/2`)
      if (!eq(powN(compileExpression(`${src(ra)} - ${src(centre)}`), 2), S, env, true)) continue
      if (eq(half, root, env, true) || eq(half, neg, env, true)) return accept(rootMove)
    }
  }
  return null
}

function renamed(stmt: Statement, map: Record<string, string>): Statement {
  return mapStatement(stmt, (rel) => ({
    ...rel,
    lhs: substituteVars(rel.lhs, map),
    rhs: substituteVars(rel.rhs, map),
  }))
}

function sameRelation(ra: Relation, rb: Relation, env: Env): boolean {
  if (rb.op === ra.op && eq(rb.lhs, ra.lhs, env) && eq(rb.rhs, ra.rhs, env)) return true
  if (rb.op === reverseRelOp(ra.op) && eq(rb.lhs, ra.rhs, env) && eq(rb.rhs, ra.lhs, env)) return true
  return false
}

/** Order-insensitive one-to-one matching of two small lists (backtracking; lists have ≤ 3 items). */
function matchAll<T>(as: readonly T[], bs: readonly T[], same: (a: T, b: T) => boolean): boolean {
  if (as.length !== bs.length) return false
  const used = bs.map(() => false)
  const go = (i: number): boolean => {
    if (i === as.length) return true
    for (let j = 0; j < bs.length; j++) {
      if (used[j] || !same(as[i]!, bs[j]!)) continue
      used[j] = true
      if (go(i + 1)) return true
      used[j] = false
    }
    return false
  }
  return go(0)
}

/**
 * Same statement up to same-side rewrites: relation by relation (sides swapped with the symbol
 * reversed is fine), branch by branch for ± / or / and lines in any order. Falls back to the
 * sampled truth comparison only when the shapes differ.
 */
function sameStatement(a: Statement, b: Statement, env: Env): boolean {
  const ra = singleRelation(a)
  const rb = singleRelation(b)
  if (ra && rb) return sameRelation(ra, rb, env)
  if (matchAll(a.disjuncts, b.disjuncts, (ca, cb) => matchAll(ca, cb, (x, y) => sameRelation(x, y, env)))) return true
  return statementsEquivalent(a, b)
}

function swapVars(oldS: Statement, newS: Statement, env: Env): Detection | null {
  if (!oldS.vars.includes('x') || !oldS.vars.includes('y')) return null
  if (!newS.vars.includes('x') || !newS.vars.includes('y')) return null
  const mapped = renamed(oldS, { x: 'y', y: 'x' })
  if (!sameStatement(mapped, newS, { ...env, vars: ['x', 'y'] })) return null
  return {
    kind: 'accept',
    move: move('swap_xy', 'swapped x and y (the inverse relation)'),
    chips: ['swap_xy'],
    verdict: 'equivalent_by_rename',
    swapped: true,
  }
}

function swapMisname(oldS: Statement, newS: Statement, env: Env): Detection | null {
  if (!oldS.vars.includes('x') || !oldS.vars.includes('y')) return null
  const kept = newS.vars.length === 1 ? newS.vars[0]! : null
  if (kept !== 'x' && kept !== 'y') return null
  const dropped = kept === 'x' ? 'y' : 'x'
  const once = renamed(oldS, { [dropped]: kept })
  if (!sameStatement(once, newS, { ...env, vars: [kept] })) return null
  return reject(
    'swap_misname',
    `Every ${dropped} became ${kept}, but the ${kept}'s stayed put — swap BOTH letters: each x becomes y and each y becomes x.`,
  )
}

function sameShape(a: Statement, b: Statement): boolean {
  if (a.disjuncts.length !== b.disjuncts.length) return false
  return a.disjuncts.every((clause, i) => clause.length === b.disjuncts[i]!.length)
}

function detectChain(oldS: Statement, newS: Statement, env: Env): Detection | null {
  if (!sameShape(oldS, newS)) return null
  const pairs: [Relation, Relation][] = []
  oldS.disjuncts.forEach((clause, i) => clause.forEach((rel, j) => pairs.push([rel, newS.disjuncts[i]![j]!])))
  if (pairs.length < 2) return null
  const positional = detectPairs(pairs, env)
  if (positional?.kind === 'accept' || oldS.disjuncts.length !== 1) return positional

  // Read the other way: 0 > x > −1 → −1 < x < 0 pairs old relation i with new relation k−1−i,
  // sides swapped and symbol reversed.
  const oc = oldS.disjuncts[0]!
  const nc = newS.disjuncts[0]!
  const k = oc.length
  const mirrored: [Relation, Relation][] = oc.map((rel, i) => [rel, swapRelation(nc[k - 1 - i]!)])
  const reversed = detectPairs(mirrored, env)
  if (reversed?.kind !== 'accept') return positional
  const reorderOnly = mirrored.every(([o, n]) => n.op === o.op && eq(n.lhs, o.lhs, env) && eq(n.rhs, o.rhs, env))
  if (reorderOnly) {
    return accept(move('swap_sides', 'read the chain from the other end, turning every symbol around'))
  }
  const m: DetectedMove = { ...reversed.move, detail: `${reversed.move.detail} and read the chain from the other end` }
  return { ...reversed, move: m, chips: [...new Set<ChipId>([...reversed.chips, 'swap_sides'])] }
}

function detectPairs(pairs: [Relation, Relation][], env: Env): Detection | null {
  const results: Detection[] = []
  for (const [o, n] of pairs) {
    const r = detectPair(o, n, env)
    if (!r) return null
    results.push(r)
  }
  const rejected = results.find((r) => r.kind === 'reject')
  if (rejected) return rejected
  const deferred = results.find((r) => r.kind === 'defer')
  if (deferred) return deferred
  const first = results[0]!
  if (first.kind !== 'accept') return null
  const chips = [...new Set(results.flatMap((r) => (r.kind === 'accept' ? r.chips : [])))]
  return { ...first, chips }
}

/**
 * Tier-1 entry point. Returns null when no structural move was recognised (Tier 2 decides).
 */
function makeEnv(a: Statement, b: Statement, opts: DetectOptions): Env {
  const vars = [...new Set([...a.vars, ...b.vars])].sort()
  const use = vars.length ? vars : ['x']
  return { vars: use, seed: opts.seed, checkValue: opts.checkValue, samples: makeSamples(use, opts.seed, opts.checkValue) }
}

/**
 * The SAME line up to rewrites (canonical anchoring): relation by relation the sides are
 * expression-equivalent, or swapped with the symbol reversed; branches of ± / or / and lines match
 * in any order. Never a solution-set comparison — `2x > 2` and `x > 1` are different lines.
 */
export function sameLine(a: Statement, b: Statement, opts: DetectOptions): boolean {
  const env = makeEnv(a, b, opts)
  const ra = singleRelation(a)
  const rb = singleRelation(b)
  if (ra && rb) return sameRelation(ra, rb, env)
  return matchAll(a.disjuncts, b.disjuncts, (ca, cb) => matchAll(ca, cb, (x, y) => sameRelation(x, y, env)))
}

/** Every x becomes y and every y becomes x. */
export function swapXY(stmt: Statement): Statement {
  return renamed(stmt, { x: 'y', y: 'x' })
}

export function detectMove(oldS: Statement, newS: Statement, opts: DetectOptions): Detection | null {
  const env = makeEnv(oldS, newS, opts)

  if (opts.allowSwap) {
    const s = swapVars(oldS, newS, env)
    if (s) return s
  }
  const mis = swapMisname(oldS, newS, env)
  if (mis) return mis

  const pm = pmRoot(oldS, newS, env)
  if (pm) return pm

  const o = singleRelation(oldS)
  const n = singleRelation(newS)
  if (o && n) return detectPair(o, n, env)
  return detectChain(oldS, newS, env)
}

/** Restriction text after squaring: the side that was NOT the even root must be ≥ 0. */
export function squaringRestriction(o: Relation): { text?: string; impossible?: boolean } {
  const isEvenRoot = (n: MathNode): boolean => {
    if (isFn(n, 'sqrt')) return true
    if (isFn(n, 'nthRoot') || isFn(n, 'nthroot') || isFn(n, 'root')) {
      const k = nodeArgs(n)[1]
      const kv = k ? tryConst(k) : 2
      return kv != null && Math.round(kv) % 2 === 0
    }
    return false
  }
  for (const [rootSide, other, otherSrc] of [
    [o.lhs, o.rhs, o.rhsSrc],
    [o.rhs, o.lhs, o.lhsSrc],
  ] as const) {
    if (!isEvenRoot(rootSide)) continue
    const c = tryConst(other)
    if (c != null) return c < 0 ? { impossible: true } : {}
    return { text: `${otherSrc} >= 0` }
  }
  return {}
}
