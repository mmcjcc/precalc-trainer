/**
 * Slip generators: what each named mistake WOULD turn an expression into, at every place in the tree where
 * that mistake can happen. A generator never judges; the checkers compare her line with these candidates
 * only after the line has been found NOT to be a legal rewrite, so a slip that happens to give a right
 * line here (log(2 + 2) "=" log 2 + log 2) can never be reported.
 *
 *   log_sum_split             log(A + B) → log A + log B, and log A + log B → log(A + B)
 *   log_product_as_product    log(AB) → log A · log B, and log A · log B → log(AB)
 *   log_quotient_as_quotient  log(A/B) → log A / log B, log A / log B → log(A/B) or log A − log B, log A − log B → log A / log B
 *   log_power_as_power        log(Aⁿ) → (log A)ⁿ
 *   log_coefficient_as_power  n log A → (log A)ⁿ, and (log A)ⁿ → n log A
 *   log_coefficient_inside    n log A → log(nA), and log(nA) → n log A
 *   log_change_base_inverted  log_b A → log b / log A, and log A / log B → log_A B
 *   log_identity_misused      log_b b → 0, log_b 1 → 1
 *   log_power_abs             log(Aⁿ), n even → n log A (right only where A > 0: the checker uses it for a domain loss)
 *   log_exp_sum_split         b^(A + B) → bᴬ + bᴮ, and bᴬ + bᴮ → b^(A + B)
 *   log_exp_power_added       (bᴬ)ᴮ → b^(A + B), and bᴬ · bᴮ → b^(AB)
 *   log_exp_negative_exponent b^(−A) → −bᴬ
 *   log_exp_coefficient_base  c · bᵘ → (cb)ᵘ
 */
import { collectVars, compileExpression, fnName, isOp, isUnaryMinus, nodeArgs, tryConst, walkNode, type MathNode } from '../math'
import type { LogMistakeId } from './types'

export interface Slip {
  id: LogMistakeId
  /** The whole tree with the slip applied at one place. */
  node: MathNode
  /** The sub-tree the slip rewrote, and what it became (for the witness sentence). */
  from: MathNode
  to: MathNode
}

// ---------------------------------------------------------------------------
// Tree helpers
// ---------------------------------------------------------------------------

export function src(n: MathNode): string {
  return `(${n.toString()})`
}

export function build(text: string): MathNode {
  return compileExpression(text)
}

function replaceNode(root: MathNode, target: MathNode, replacement: MathNode): MathNode {
  if (root === target) return replacement
  return root.transform((n) => (n === target ? replacement : n))
}

export interface Signed {
  sign: 1 | -1
  node: MathNode
}

/** a − b + c → [+a, −b, +c]; −(a + b) stays one negative term of (a + b). */
export function signedTerms(node: MathNode): Signed[] {
  if (isOp(node, '+') && nodeArgs(node).length === 2) return nodeArgs(node).flatMap(signedTerms)
  if (isOp(node, '-') && nodeArgs(node).length === 2) {
    const [a, b] = nodeArgs(node)
    return [...signedTerms(a!), ...signedTerms(b!).map((t) => ({ sign: (t.sign === 1 ? -1 : 1) as 1 | -1, node: t.node }))]
  }
  if (isUnaryMinus(node)) return signedTerms(nodeArgs(node)[0]!).map((t) => ({ sign: (t.sign === 1 ? -1 : 1) as 1 | -1, node: t.node }))
  return [{ sign: 1, node }]
}

export function sumOf(terms: readonly Signed[]): string {
  if (!terms.length) return '0'
  return terms.map((t, i) => (i === 0 ? (t.sign < 0 ? `-${src(t.node)}` : src(t.node)) : `${t.sign < 0 ? '-' : '+'} ${src(t.node)}`)).join(' ')
}

/** 2x·y → [2, x, y] (unary minus as a factor −1). */
export function productFactors(node: MathNode): MathNode[] {
  if (isOp(node, '*')) return nodeArgs(node).flatMap(productFactors)
  if (isUnaryMinus(node)) return [build('-1'), ...productFactors(nodeArgs(node)[0]!)]
  return [node]
}

/** A numeric coefficient times the rest: 3·log(x) → { coef: 3, rest: log(x) }; log(x) → { coef: 1, rest }. */
export function coefficientSplit(node: MathNode): { coef: number; rest: MathNode | null; restFactors: MathNode[] } {
  const fs = productFactors(node)
  let coef = 1
  const rest: MathNode[] = []
  for (const f of fs) {
    const c = collectVars(f).length ? null : tryConst(f)
    if (c != null && !hasLogOrPower(f)) coef *= c
    else rest.push(f)
  }
  return { coef, rest: rest.length ? (rest.length === 1 ? rest[0]! : build(rest.map(src).join(' * '))) : null, restFactors: rest }
}

function hasLogOrPower(node: MathNode): boolean {
  let found = false
  walkNode(node, (n) => {
    const f = fnName(n)
    if (f && LOG_NAMES.has(f)) found = true
    if (f === 'exp') found = true
  })
  return found
}

// ---------------------------------------------------------------------------
// Logs and exponentials
// ---------------------------------------------------------------------------

const LOG_NAMES = new Set(['log', 'ln', 'log10', 'log2'])

export interface LogCall {
  node: MathNode
  arg: MathNode
  /** null for base 10 (log, log10) and base e (ln). */
  base: MathNode | null
  kind: 'log10' | 'ln' | 'logb'
  /** The base's value when it is a constant (10, e, 2, 1/2…). */
  baseValue: number | null
  /** Text of the base for sameness when it is not constant. */
  baseKey: string
}

export function asLogCall(node: MathNode): LogCall | null {
  const f = fnName(node)
  if (!f || !LOG_NAMES.has(f)) return null
  const [arg, base] = nodeArgs(node)
  if (!arg) return null
  if (f === 'ln') return { node, arg, base: null, kind: 'ln', baseValue: Math.E, baseKey: 'e' }
  if (f === 'log2') return { node, arg, base: build('2'), kind: 'logb', baseValue: 2, baseKey: '2' }
  if (base && f === 'log') {
    const bv = tryConst(base)
    return { node, arg, base, kind: 'logb', baseValue: bv, baseKey: bv != null ? String(bv) : base.toString() }
  }
  return { node, arg, base: null, kind: 'log10', baseValue: 10, baseKey: '10' }
}

export function sameBase(a: LogCall, b: LogCall): boolean {
  if (a.baseValue != null && b.baseValue != null) return Math.abs(a.baseValue - b.baseValue) <= 1e-12 * Math.max(1, Math.abs(a.baseValue))
  return a.baseKey === b.baseKey
}

/** The same kind of log (same base) of a new argument, as math.js text. */
export function logLike(call: LogCall, arg: string): string {
  if (call.kind === 'ln') return `ln(${arg})`
  if (call.kind === 'log10') return `log(${arg})`
  return `log(${arg}, ${src(call.base!)})`
}

/** A log of `arg` with base text `base` (null: 10). */
export function logText(arg: string, base: string | null): string {
  return base === null ? `log(${arg})` : `log(${arg}, ${base})`
}

export interface ExpPower {
  node: MathNode
  /** The base as math.js text: "2", "e", "(1/2)". */
  baseText: string
  baseValue: number
  exponent: MathNode
  /** Written exp(u). */
  viaExp: boolean
}

/** b^u with a constant base b > 0, b ≠ 1, or exp(u). */
export function asExpPower(node: MathNode): ExpPower | null {
  if (fnName(node) === 'exp') {
    const u = nodeArgs(node)[0]
    return u ? { node, baseText: 'e', baseValue: Math.E, exponent: u, viaExp: true } : null
  }
  if (!isOp(node, '^')) return null
  const [b, u] = nodeArgs(node)
  if (!b || !u || collectVars(b).length) return null
  const bv = tryConst(b)
  if (bv == null || !(bv > 0) || Math.abs(bv - 1) < 1e-12) return null
  return { node, baseText: src(b), baseValue: bv, exponent: u, viaExp: false }
}

export function powLike(p: ExpPower, exponent: string): string {
  return p.viaExp ? `exp(${exponent})` : `${p.baseText} ^ (${exponent})`
}

function sameExpBase(a: ExpPower, b: ExpPower): boolean {
  return Math.abs(a.baseValue - b.baseValue) <= 1e-12 * Math.max(1, a.baseValue)
}

/** The base of a log call as a number value for an identity check (null when not constant). */
function isOne(n: MathNode): boolean {
  const v = collectVars(n).length ? null : tryConst(n)
  return v != null && Math.abs(v - 1) < 1e-12
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

type Gen = (root: MathNode, push: (id: LogMistakeId, from: MathNode, to: string) => void) => void

/** Every log call and the parts of every sum, product and power, visited once. */
function visit(root: MathNode, fn: (n: MathNode) => void): void {
  walkNode(root, fn)
}

const genSumSplit: Gen = (root, push) => {
  visit(root, (n) => {
    const call = asLogCall(n)
    if (call) {
      const terms = signedTerms(call.arg)
      if (terms.length >= 2) push('log_sum_split', n, sumOf(terms.map((t) => ({ sign: t.sign, node: build(logLike(call, t.node.toString())) }))))
      return
    }
    // log A ± log B (same base) → log(A ± B)
    if (!isOp(n, '+') && !(isOp(n, '-') && nodeArgs(n).length === 2)) return
    const terms = signedTerms(n)
    if (terms.length !== 2) return
    const [a, b] = terms
    const ca = asLogCall(a!.node)
    const cb = asLogCall(b!.node)
    if (!ca || !cb || !sameBase(ca, cb) || a!.sign < 0) return
    push('log_sum_split', n, logLike(ca, `${src(ca.arg)} ${b!.sign < 0 ? '-' : '+'} ${src(cb.arg)}`))
  })
}

const genProduct: Gen = (root, push) => {
  visit(root, (n) => {
    const call = asLogCall(n)
    if (call) {
      const fs = productFactors(call.arg).filter((f) => f.toString() !== '-1')
      if (fs.length >= 2) push('log_product_as_product', n, fs.map((f) => logLike(call, f.toString())).join(' * '))
      return
    }
    if (isOp(n, '*') && nodeArgs(n).length === 2) {
      const [a, b] = nodeArgs(n)
      const ca = asLogCall(a!)
      const cb = asLogCall(b!)
      if (ca && cb && sameBase(ca, cb)) push('log_product_as_product', n, logLike(ca, `${src(ca.arg)} * ${src(cb.arg)}`))
    }
  })
}

const genQuotient: Gen = (root, push) => {
  visit(root, (n) => {
    const call = asLogCall(n)
    if (call) {
      if (isOp(call.arg, '/')) {
        const [p, q] = nodeArgs(call.arg)
        push('log_quotient_as_quotient', n, `${logLike(call, p!.toString())} / ${logLike(call, q!.toString())}`)
      }
      return
    }
    if (isOp(n, '/')) {
      const [a, b] = nodeArgs(n)
      const ca = asLogCall(a!)
      const cb = asLogCall(b!)
      if (ca && cb && sameBase(ca, cb)) {
        push('log_quotient_as_quotient', n, logLike(ca, `${src(ca.arg)} / ${src(cb.arg)}`))
        push('log_quotient_as_quotient', n, `${logLike(ca, ca.arg.toString())} - ${logLike(cb, cb.arg.toString())}`)
      }
      return
    }
    if (isOp(n, '-') && nodeArgs(n).length === 2) {
      const terms = signedTerms(n)
      if (terms.length !== 2 || terms[0]!.sign < 0 || terms[1]!.sign > 0) return
      const ca = asLogCall(terms[0]!.node)
      const cb = asLogCall(terms[1]!.node)
      if (ca && cb && sameBase(ca, cb)) push('log_quotient_as_quotient', n, `${src(ca.node)} / ${src(cb.node)}`)
    }
  })
}

const genPower: Gen = (root, push) => {
  visit(root, (n) => {
    const call = asLogCall(n)
    if (!call || !isOp(call.arg, '^')) return
    const [a, k] = nodeArgs(call.arg)
    push('log_power_as_power', n, `(${logLike(call, a!.toString())}) ^ ${src(k!)}`)
    const kv = collectVars(k!).length ? null : tryConst(k!)
    if (kv != null && Number.isInteger(kv) && kv % 2 === 0 && kv !== 0) push('log_power_abs', n, `${kv} * ${logLike(call, a!.toString())}`)
  })
}

/** c·log(A) as a product node (either order), or −log(A). */
function coefLog(n: MathNode): { coef: number; call: LogCall; coefNode: MathNode | null } | null {
  if (isUnaryMinus(n)) {
    const c = asLogCall(nodeArgs(n)[0]!)
    return c ? { coef: -1, call: c, coefNode: null } : null
  }
  if (!isOp(n, '*') || nodeArgs(n).length !== 2) return null
  const [a, b] = nodeArgs(n)
  for (const [k, l] of [
    [a!, b!],
    [b!, a!],
  ] as const) {
    const call = asLogCall(l)
    if (!call) continue
    const kv = collectVars(k).length ? null : tryConst(k)
    if (kv != null && !hasLogOrPower(k)) return { coef: kv, call, coefNode: k }
    if (collectVars(k).length) return { coef: Number.NaN, call, coefNode: k }
  }
  return null
}

const genCoefficient: Gen = (root, push) => {
  visit(root, (n) => {
    const cl = coefLog(n)
    if (cl && cl.coefNode && !(Math.abs(cl.coef - 1) < 1e-12) && !(Math.abs(cl.coef + 1) < 1e-12)) {
      const k = src(cl.coefNode)
      push('log_coefficient_as_power', n, `(${cl.call.node.toString()}) ^ ${k}`)
      push('log_coefficient_inside', n, logLike(cl.call, `${k} * ${src(cl.call.arg)}`))
      return
    }
    // (log A)^k → k·log A
    if (isOp(n, '^')) {
      const [b, k] = nodeArgs(n)
      const call = asLogCall(b!)
      if (call && !collectVars(k!).length) push('log_coefficient_as_power', n, `${src(k!)} * ${src(call.node)}`)
      return
    }
    // log(c·A) → c·log A
    const call = asLogCall(n)
    if (call) {
      const split = coefficientSplit(call.arg)
      if (split.rest && Math.abs(split.coef - 1) > 1e-12 && split.coef > 0) push('log_coefficient_inside', n, `${split.coef} * ${logLike(call, split.rest.toString())}`)
    }
  })
}

const genChangeBase: Gen = (root, push) => {
  visit(root, (n) => {
    const call = asLogCall(n)
    if (call && call.kind === 'logb' && call.base) {
      push('log_change_base_inverted', n, `log(${call.base.toString()}) / log(${call.arg.toString()})`)
      return
    }
    if (isOp(n, '/')) {
      const [a, b] = nodeArgs(n)
      const ca = asLogCall(a!)
      const cb = asLogCall(b!)
      if (ca && cb && sameBase(ca, cb)) push('log_change_base_inverted', n, `log(${cb.arg.toString()}, ${src(ca.arg)})`)
    }
  })
}

const genIdentity: Gen = (root, push) => {
  visit(root, (n) => {
    const call = asLogCall(n)
    if (!call) return
    if (isOne(call.arg)) {
      push('log_identity_misused', n, '1')
      return
    }
    const av = collectVars(call.arg).length ? null : tryConst(call.arg)
    if (av != null && call.baseValue != null && Math.abs(av - call.baseValue) <= 1e-12 * Math.max(1, av)) push('log_identity_misused', n, '0')
  })
}

const genExpSum: Gen = (root, push) => {
  visit(root, (n) => {
    const p = asExpPower(n)
    if (p) {
      const terms = signedTerms(p.exponent)
      if (terms.length >= 2) push('log_exp_sum_split', n, sumOf(terms.map((t) => ({ sign: t.sign, node: build(powLike(p, t.node.toString())) }))))
      return
    }
    if (!isOp(n, '+') && !(isOp(n, '-') && nodeArgs(n).length === 2)) return
    const terms = signedTerms(n)
    if (terms.length !== 2 || terms[0]!.sign < 0) return
    const pa = asExpPower(terms[0]!.node)
    const pb = asExpPower(terms[1]!.node)
    if (!pa || !pb || !sameExpBase(pa, pb)) return
    push('log_exp_sum_split', n, powLike(pa, `${src(pa.exponent)} ${terms[1]!.sign < 0 ? '-' : '+'} ${src(pb.exponent)}`))
  })
}

const genExpPower: Gen = (root, push) => {
  visit(root, (n) => {
    if (isOp(n, '^')) {
      const [b, k] = nodeArgs(n)
      const inner = asExpPower(b!)
      if (inner) {
        push('log_exp_power_added', n, powLike(inner, `${src(inner.exponent)} + ${src(k!)}`))
        return
      }
    }
    if (isOp(n, '*') && nodeArgs(n).length === 2) {
      const [a, b] = nodeArgs(n)
      const pa = asExpPower(a!)
      const pb = asExpPower(b!)
      if (pa && pb && sameExpBase(pa, pb)) push('log_exp_power_added', n, powLike(pa, `${src(pa.exponent)} * ${src(pb.exponent)}`))
    }
  })
}

/** The exponent with its minus sign removed: −x → x, −3x (parsed (−3)·x) → 3x, −2 → 2; null when it is not negative. */
export function positiveOfNegative(u: MathNode): string | null {
  if (isUnaryMinus(u)) return nodeArgs(u)[0]!.toString()
  if (!collectVars(u).length) {
    const uv = tryConst(u)
    return uv != null && uv < 0 ? String(-uv) : null
  }
  const split = coefficientSplit(u)
  if (split.coef < 0 && split.rest) return `${-split.coef} * (${split.rest.toString()})`
  return null
}

const genExpNegative: Gen = (root, push) => {
  visit(root, (n) => {
    const p = asExpPower(n)
    if (!p) return
    const pos = positiveOfNegative(p.exponent)
    if (pos !== null) push('log_exp_negative_exponent', n, `-(${powLike(p, pos)})`)
  })
}

const genCoefficientBase: Gen = (root, push) => {
  visit(root, (n) => {
    if (!isOp(n, '*') || nodeArgs(n).length !== 2) return
    const [a, b] = nodeArgs(n)
    for (const [c, e] of [
      [a!, b!],
      [b!, a!],
    ] as const) {
      const p = asExpPower(e)
      const cv = collectVars(c).length ? null : tryConst(c)
      if (!p || cv == null || hasLogOrPower(c) || Math.abs(cv - 1) < 1e-12 || !(cv > 0)) continue
      const base = p.viaExp ? `${cv} * e` : `${cv} * ${p.baseText}`
      push('log_exp_coefficient_base', n, `(${base}) ^ ${src(p.exponent)}`)
      return
    }
  })
}

const GENERATORS: readonly Gen[] = [
  genIdentity,
  genSumSplit,
  genProduct,
  genQuotient,
  genPower,
  genCoefficient,
  genChangeBase,
  genExpSum,
  genExpPower,
  genExpNegative,
  genCoefficientBase,
]

/**
 * A negative constant raised to a power with a variable in it ((log 0.5)^(x/5730)): defined only at
 * isolated points, and math.js takes about 15 ms per evaluation of it (it searches for a real root).
 * No student line for these problems looks like that, so such a candidate is never built.
 */
export function hasNegativeBasePower(node: MathNode): boolean {
  let found = false
  walkNode(node, (n) => {
    if (found || !isOp(n, '^')) return
    const [b, e] = nodeArgs(n)
    if (!b || !e || collectVars(b).length || !collectVars(e).length) return
    const bv = tryConst(b)
    if (bv != null && bv < 0) found = true
  })
  return found
}

/** Every slip that applies somewhere in `root`, in priority order. */
export function expressionSlips(root: MathNode): Slip[] {
  const out: Slip[] = []
  const seen = new Set<string>()
  for (const gen of GENERATORS) {
    gen(root, (id, from, to) => {
      let toNode: MathNode
      try {
        toNode = build(to)
      } catch {
        return
      }
      if (hasNegativeBasePower(toNode)) return
      const node = replaceNode(root, from, toNode)
      const key = `${id}|${node.toString()}`
      if (seen.has(key)) return
      seen.add(key)
      out.push({ id, node, from, to: toNode })
    })
  }
  return out
}

/** A log of anything, or a constant base raised to a power that contains a variable (what the engine routes here). */
export function isExpLogNode(node: MathNode): boolean {
  let found = false
  node.traverse((n) => {
    if (found) return
    if (asLogCall(n)) found = true
    const p = asExpPower(n)
    if (p && collectVars(p.exponent).length) found = true
  })
  return found
}

/** Does the tree contain a log or an exponential with a constant base? */
export function hasLogOrExp(root: MathNode): boolean {
  let found = false
  walkNode(root, (n) => {
    if (asLogCall(n) || asExpPower(n)) found = true
  })
  return found
}

/** Every log call in the tree. */
export function logCallsOf(root: MathNode): LogCall[] {
  const out: LogCall[] = []
  walkNode(root, (n) => {
    const c = asLogCall(n)
    if (c) out.push(c)
  })
  return out
}

/** Every exponential b^u (constant base) or exp(u) in the tree. */
export function expPowersOf(root: MathNode): ExpPower[] {
  const out: ExpPower[] = []
  walkNode(root, (n) => {
    const p = asExpPower(n)
    if (p) out.push(p)
  })
  return out
}
