/**
 * The legal moves, as generators of the RIGHT next line: what each log property and exponent rule turns
 * an expression into at each place it applies. Used to name the property a legal line used (and, for a
 * template, as possible next steps), and for the textbook full expansion / single-log form.
 */
import { collectVars, compileExpression, fnName, isOp, isUnaryMinus, nodeArgs, tryConst, walkNode, type MathNode } from '../math'
import { ratToString } from '@/notation/rational'
import type { Scope } from '../samples'
import { sameOnSamples } from './equiv'
import { exactIsRational, exactRational, tryExact } from './exact'
import { asExpPower, asLogCall, logLike, positiveOfNegative, powLike, productFactors, sameBase, signedTerms, src, sumOf, type LogCall, type Signed } from './slips'
import { appText } from './text'
import type { LogMove, LogProperty } from './types'

export interface LegalRewrite {
  property: LogProperty
  node: MathNode
}

function replaceNode(root: MathNode, target: MathNode, replacement: MathNode): MathNode {
  if (root === target) return replacement
  return root.transform((n) => (n === target ? replacement : n))
}

type Push = (property: LogProperty, from: MathNode, to: string) => void

function isConstOne(n: MathNode): boolean {
  const v = collectVars(n).length ? null : tryConst(n)
  return v != null && Math.abs(v - 1) < 1e-12
}

function baseMatches(call: LogCall, b: number): boolean {
  return call.baseValue != null && Math.abs(call.baseValue - b) <= 1e-12 * Math.max(1, b)
}

/** The exact rational value of a log of a number ("3" for log_2(8), "-3" for log(0.001)), else null. */
function constantLogValue(n: MathNode): string | null {
  if (collectVars(n).length) return null
  const v = tryExact(n)
  if (!v || v === 'undef' || !exactIsRational(v)) return null
  const r = exactRational(v)
  return r ? `(${ratToString(r)})` : null
}

function genLegal(root: MathNode, push: Push): void {
  walkNode(root, (n) => {
    const call = asLogCall(n)
    if (call) {
      const a = call.arg
      const fs = productFactors(a).filter((f) => f.toString() !== '-1')
      if (fs.length >= 2) push('product_rule', n, fs.map((f) => logLike(call, f.toString())).join(' + '))
      if (isOp(a, '/')) {
        const [p, q] = nodeArgs(a)
        push('quotient_rule', n, `${logLike(call, p!.toString())} - ${logLike(call, q!.toString())}`)
      }
      if (isOp(a, '^')) {
        const [p, k] = nodeArgs(a)
        const pe = asExpPower(a)
        if (pe && baseMatches(call, pe.baseValue)) push('inverse_property', n, pe.exponent.toString())
        else push('power_rule', n, `${src(k!)} * ${logLike(call, p!.toString())}`)
      }
      if (fnName(a) === 'exp' && call.kind === 'ln') push('inverse_property', n, nodeArgs(a)[0]!.toString())
      if (fnName(a) === 'sqrt') push('power_rule', n, `(1/2) * ${logLike(call, nodeArgs(a)[0]!.toString())}`)
      if (fnName(a) === 'cbrt') push('power_rule', n, `(1/3) * ${logLike(call, nodeArgs(a)[0]!.toString())}`)
      if (isConstOne(a)) push('log_identity', n, '0')
      const av = collectVars(a).length ? null : tryConst(a)
      if (av != null && baseMatches(call, av)) push('log_identity', n, '1')
      const known = constantLogValue(n)
      if (known !== null && !isConstOne(a) && !(av != null && baseMatches(call, av))) push('evaluate', n, known)
      if (call.kind === 'logb' && call.base) {
        push('change_of_base', n, `log(${a.toString()}) / log(${call.base.toString()})`)
        push('change_of_base', n, `ln(${a.toString()}) / ln(${call.base.toString()})`)
      }
      return
    }
    const p = asExpPower(n)
    if (p) {
      const inner = asLogCall(p.exponent)
      if (inner && baseMatches(inner, p.baseValue)) push('inverse_property', n, inner.arg.toString())
      const terms = signedTerms(p.exponent)
      if (terms.length >= 2) push('exp_product', n, terms.map((t) => (t.sign < 0 ? `1 / (${powLike(p, t.node.toString())})` : `(${powLike(p, t.node.toString())})`)).join(' * '))
      const pos = positiveOfNegative(p.exponent)
      if (pos !== null) push('exp_negative', n, `1 / (${powLike(p, pos)})`)
      if (isOp(p.exponent, '*') && nodeArgs(p.exponent).length === 2) {
        const [u, w] = nodeArgs(p.exponent)
        push('exp_power', n, `(${powLike(p, u!.toString())}) ^ ${src(w!)}`)
      }
      return
    }
    if (isOp(n, '^')) {
      const [b, k] = nodeArgs(n)
      const inner = asExpPower(b!)
      if (inner) push('exp_power', n, powLike(inner, `${src(inner.exponent)} * ${src(k!)}`))
      const lc = asLogCall(b!)
      if (lc && !collectVars(k!).length) return
    }
    // Two-term combinations.
    const terms = signedTerms(n)
    if (terms.length === 2 && (isOp(n, '+') || isOp(n, '-'))) {
      const [x, y] = terms as [Signed, Signed]
      const cx = asLogCall(x.node)
      const cy = asLogCall(y.node)
      if (cx && cy && sameBase(cx, cy) && x.sign > 0) {
        push(y.sign > 0 ? 'product_rule' : 'quotient_rule', n, logLike(cx, `${src(cx.arg)} ${y.sign > 0 ? '*' : '/'} ${src(cy.arg)}`))
      }
    }
    if (isOp(n, '*') && nodeArgs(n).length === 2) {
      const [a, b] = nodeArgs(n)
      const pa = asExpPower(a!)
      const pb = asExpPower(b!)
      if (pa && pb && Math.abs(pa.baseValue - pb.baseValue) < 1e-12 * pa.baseValue) push('exp_product', n, powLike(pa, `${src(pa.exponent)} + ${src(pb.exponent)}`))
      for (const [k, l] of [
        [a!, b!],
        [b!, a!],
      ] as const) {
        const lc = asLogCall(l)
        if (lc && !asLogCall(k)) push('power_rule', n, logLike(lc, `${src(lc.arg)} ^ ${src(k)}`))
      }
    }
    if (isOp(n, '/')) {
      const [a, b] = nodeArgs(n)
      const ca = asLogCall(a!)
      const cb = asLogCall(b!)
      if (ca && cb && sameBase(ca, cb)) push('change_of_base', n, `log(${ca.arg.toString()}, ${src(cb.arg)})`)
      const pa = asExpPower(a!)
      const pb = asExpPower(b!)
      if (pa && pb && Math.abs(pa.baseValue - pb.baseValue) < 1e-12 * pa.baseValue) push('exp_product', n, powLike(pa, `${src(pa.exponent)} - ${src(pb.exponent)}`))
      if (pb && isConstOne(a!)) push('exp_negative', n, powLike(pb, `-${src(pb.exponent)}`))
    }
  })
}

/** Every legal single-place rewrite of `root`. */
export function legalRewrites(root: MathNode): LegalRewrite[] {
  const out: LegalRewrite[] = []
  const seen = new Set<string>()
  genLegal(root, (property, from, to) => {
    let toNode: MathNode
    try {
      toNode = compileExpression(to)
    } catch {
      return
    }
    const node = replaceNode(root, from, toNode)
    const key = `${property}|${node.toString()}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ property, node })
  })
  return out
}

// ---------------------------------------------------------------------------
// Full expansion and the single-log form
// ---------------------------------------------------------------------------

export interface Expanded {
  node: MathNode
  /** App syntax ("2log(x) + log(y) - log(z)", "log_3(x^2/y)"). */
  text: string
  used: Set<LogProperty>
}

function expandLogCall(call: LogCall, used: Set<LogProperty>, powers = true): string {
  const a = call.arg
  const fs = productFactors(a).filter((f) => f.toString() !== '-1')
  if (fs.length >= 2) {
    used.add('product_rule')
    return fs.map((f) => `(${expandLogCall({ ...call, arg: f }, used, powers)})`).join(' + ')
  }
  if (isOp(a, '/')) {
    const [p, q] = nodeArgs(a)
    used.add('quotient_rule')
    return `(${expandLogCall({ ...call, arg: p! }, used, powers)}) - (${expandLogCall({ ...call, arg: q! }, used, powers)})`
  }
  if (isOp(a, '^') && powers) {
    const [p, k] = nodeArgs(a)
    const pe = asExpPower(a)
    if (pe && baseMatches(call, pe.baseValue)) {
      used.add('inverse_property')
      return pe.exponent.toString()
    }
    used.add('power_rule')
    return `${src(k!)} * (${expandLogCall({ ...call, arg: p! }, used)})`
  }
  if ((fnName(a) === 'sqrt' || fnName(a) === 'cbrt') && powers) {
    used.add('power_rule')
    return `(1/${fnName(a) === 'sqrt' ? 2 : 3}) * (${expandLogCall({ ...call, arg: nodeArgs(a)[0]! }, used)})`
  }
  if (fnName(a) === 'exp' && call.kind === 'ln') {
    used.add('inverse_property')
    return nodeArgs(a)[0]!.toString()
  }
  if (isConstOne(a)) {
    used.add('log_identity')
    return '0'
  }
  const av = collectVars(a).length ? null : tryConst(a)
  if (av != null && baseMatches(call, av)) {
    used.add('log_identity')
    return '1'
  }
  const text = logLike(call, a.toString())
  const known = constantLogValue(compileExpression(text))
  if (known !== null) {
    used.add('evaluate')
    return known
  }
  return text
}

function expandNode(node: MathNode, used: Set<LogProperty>, powers = true): string {
  const call = asLogCall(node)
  if (call) return `(${expandLogCall(call, used, powers)})`
  if (node.type === 'OperatorNode' || node.type === 'FunctionNode') {
    const args = nodeArgs(node)
    if (!args.length) return node.toString()
    const parts = args.map((a) => expandNode(a, used, powers))
    if (node.type === 'FunctionNode') return `${fnName(node)}(${parts.join(', ')})`
    if (isUnaryMinus(node)) return `-(${parts[0]})`
    const op = (node as unknown as { op: string }).op
    return parts.map((p) => `(${p})`).join(` ${op} `)
  }
  return node.toString()
}

/**
 * Every log written as a sum of logs of single factors, powers brought down (the textbook expansion).
 * `powers: false` stops before the power rule (log(x²y/n) → log(x²) + log(y) − log(n)), the line a
 * power slip is made on.
 */
export function expandLogs(node: MathNode, opts: { powers?: boolean } = {}): Expanded {
  const used = new Set<LogProperty>()
  const out = compileExpression(expandNode(node, used, opts.powers ?? true))
  return { node: out, text: appText(out), used }
}

/** Σ cᵢ log_b(Aᵢ) with one base → log_b(∏ Aᵢ^cᵢ), negative coefficients in the denominator. Null when not one base. */
export function condenseLogs(node: MathNode): Expanded | null {
  const terms = signedTerms(node)
  const used = new Set<LogProperty>()
  let base: LogCall | null = null
  const num: string[] = []
  const den: string[] = []
  const rest: Signed[] = []
  for (const t of terms) {
    const fs = productFactors(t.node)
    const logs = fs.filter((f) => asLogCall(f))
    if (logs.length !== 1) {
      rest.push(t)
      continue
    }
    const call = asLogCall(logs[0]!)!
    if (base && !sameBase(base, call)) return null
    base ??= call
    const coefs = fs.filter((f) => f !== logs[0])
    let sign = t.sign
    const coefText = coefs
      .map((c) => {
        if (c.toString() === '-1') {
          sign = sign === 1 ? -1 : 1
          return null
        }
        return src(c)
      })
      .filter((c): c is string => c !== null)
    const arg = coefText.length ? `${src(call.arg)} ^ (${coefText.join(' * ')})` : src(call.arg)
    if (coefText.length) used.add('power_rule')
    // Numbers first inside the product: log(3x), not log(x · 3).
    const list = sign > 0 ? num : den
    if (!collectVars(call.arg).length) list.unshift(arg)
    else list.push(arg)
  }
  if (!base || num.length + den.length < 1) return null
  if (num.length + den.length > 1) {
    if (num.length > 1) used.add('product_rule')
    if (den.length) used.add('quotient_rule')
  }
  const top = num.length ? num.join(' * ') : '1'
  const inside = den.length ? `(${top}) / (${den.join(' * ')})` : top
  const single = logLike(base, inside)
  const out = compileExpression(rest.length ? `${single} + ${sumOf(rest)}` : single)
  return { node: out, text: appText(out), used }
}

// ---------------------------------------------------------------------------
// Naming the property a legal line used
// ---------------------------------------------------------------------------

const PROPERTY_WORDS: Record<LogProperty, string> = {
  product_rule: 'the product rule (log(ab) = log a + log b)',
  quotient_rule: 'the quotient rule (log(a/b) = log a − log b)',
  power_rule: 'the power rule (log(aⁿ) = n log a)',
  change_of_base: 'the change of base formula (log_b a = log a / log b)',
  inverse_property: 'the inverse property (log_b(bᵘ) = u and b^(log_b u) = u)',
  log_identity: 'log_b 1 = 0 and log_b b = 1',
  exp_product: 'the product of powers (bᵃ · bᶜ = b^(a + c))',
  exp_power: 'the power of a power ((bᵃ)ᶜ = b^(ac))',
  exp_negative: 'the negative exponent rule (b⁻ⁿ = 1/bⁿ)',
  take_log: 'a log of both sides',
  convert_form: 'the switch between exponential and log form (b^y = x ⟺ log_b x = y)',
  one_to_one: 'the one-to-one property (log_b A = log_b B ⟺ A = B)',
  both_sides: 'the same operation on both sides',
  reject_extraneous: 'the domain check',
  rounded: 'rounding',
  evaluate: 'the value of a log (log_b bⁿ = n)',
  rewrite: 'a rewrite',
}

export function moveSentence(properties: readonly LogProperty[]): string {
  const words = properties.map((p) => PROPERTY_WORDS[p])
  if (!words.length) return 'rewrote the expression'
  return `used ${words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`}`
}

/**
 * The shape of a line as far as the rules are concerned: the logs it contains (base and input) and the
 * exponentials (base and exponent). Every legal rewrite has the same VALUE as the line before, so the rule
 * a line used is found by matching shapes, not values.
 */
interface Shape {
  logs: { base: string; arg: MathNode }[]
  exps: { base: number; exp: MathNode }[]
}

function shapeOf(node: MathNode): Shape {
  const logs: Shape['logs'] = []
  const exps: Shape['exps'] = []
  walkNode(node, (n) => {
    const c = asLogCall(n)
    if (c) logs.push({ base: c.baseKey, arg: c.arg })
    const p = asExpPower(n)
    if (p && collectVars(p.exponent).length) exps.push({ base: p.baseValue, exp: p.exponent })
  })
  return { logs, exps }
}

function sameShape(a: Shape, b: Shape, samples: readonly Scope[]): boolean {
  if (a.logs.length !== b.logs.length || a.exps.length !== b.exps.length) return false
  const min = Math.min(4, Math.max(1, samples.length))
  const eq = (x: MathNode, y: MathNode) => {
    if (x.toString() === y.toString()) return true
    if (!collectVars(x).length && !collectVars(y).length) {
      const vx = tryConst(x)
      const vy = tryConst(y)
      return vx != null && vy != null && Math.abs(vx - vy) <= 1e-9 * Math.max(1, Math.abs(vx))
    }
    return sameOnSamples(x, y, samples, min)
  }
  const used = b.logs.map(() => false)
  for (const l of a.logs) {
    const j = b.logs.findIndex((m, k) => !used[k] && m.base === l.base && eq(l.arg, m.arg))
    if (j < 0) return false
    used[j] = true
  }
  const usedE = b.exps.map(() => false)
  for (const e of a.exps) {
    const j = b.exps.findIndex((m, k) => !usedE[k] && Math.abs(m.base - e.base) < 1e-12 * e.base && eq(e.exp, m.exp))
    if (j < 0) return false
    usedE[j] = true
  }
  return true
}

/**
 * Which properties turn prev into next (next is already known to be equal to prev): the legal rewrite,
 * the two in a row, or the full expansion / single-log form whose SHAPE is next's. A constant log that
 * became its value is 'evaluate'; anything else is 'rewrite'.
 */
export function classifyLogRewrite(prev: MathNode, next: MathNode, samples: readonly Scope[]): LogMove {
  const target = shapeOf(next)
  const hit = (n: MathNode) => sameShape(shapeOf(n), target, samples)
  const one = legalRewrites(prev)
  for (const r of one) if (hit(r.node)) return { properties: [r.property], detail: moveSentence([r.property]) }
  try {
    const ex = expandLogs(prev)
    if (ex.used.size && hit(ex.node)) {
      const props = [...ex.used]
      return { properties: props, detail: moveSentence(props) }
    }
    const co = condenseLogs(prev)
    if (co && co.used.size && hit(co.node)) {
      const props = [...co.used]
      return { properties: props, detail: moveSentence(props) }
    }
  } catch {
    // An expansion that does not parse back: no name.
  }
  for (const r of one) {
    for (const s of legalRewrites(r.node)) {
      if (!hit(s.node)) continue
      const props = [...new Set([r.property, s.property])]
      return { properties: props, detail: moveSentence(props) }
    }
  }
  const before = shapeOf(prev)
  const constLogsGone = before.logs.some((l) => !collectVars(l.arg).length) && target.logs.length < before.logs.length
  if (constLogsGone) return { properties: ['evaluate'], detail: moveSentence(['evaluate']) }
  return { properties: ['rewrite'], detail: 'rewrote the expression' }
}
