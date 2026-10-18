/**
 * Expression mode for logs and exponentials: expand, condense, simplify, evaluate step by step.
 *
 * A line is legal when it equals the previous line at EVERY point where the previous line is defined
 * (`compareOnDomain`): ln(x²) → 2 ln x is rejected unless the problem assumes x > 0 (then it is the power
 * rule), while 2 ln x → ln(x²) is fine (the domain only grows). When the line is not legal, the slips of
 * the previous line (slips.ts) are compared with it; one that produces her line names the mistake, else the
 * counterexample shows a point inside the domain where the two lines differ.
 */
import type { Counterexample, StepResult, VarName } from '@/shared/types'
import { REWRITE_CHIPS } from '@/shared/types'
import { expressionCounterexample } from '../counterexample'
import { collectVars, evalNode, type MathNode } from '../math'
import { patternHit } from '../matchers/catalog'
import { runMatchers } from '../matchers'
import { parseExpression, parseStatement } from '../parse'
import type { Scope } from '../samples'
import { compareOnDomain, samplesInDomain, sameOnSamples } from './equiv'
import { classifyLogRewrite, condenseLogs, expandLogs, legalRewrites } from './rules'
import { asLogCall, expressionSlips, hasLogOrExp, productFactors, type Slip } from './slips'
import { displayNode, num } from './text'
import type { LogRewriteContext, LogStepResult } from './types'
import { exactEquals, tryExact } from './exact'

const DEFAULT_VARS: VarName[] = ['x', 'y']

function parseError(which: 'prev' | 'next', e: { message: string; position: number; length?: number }): LogStepResult {
  const message = which === 'prev' ? `Previous line: ${e.message}` : e.message
  return { ok: false, verdict: 'parse_error', acceptableChips: [], parseError: { message, position: e.position, ...(e.length ? { length: e.length } : {}) } }
}

/** "log(3) ≈ 0.477" or "log(8, 2) = 3" for a sentence. */
export function valueSentence(node: MathNode, scope: Scope): string {
  const v = evalNode(node, scope)
  if (v === 'undef') return `${displayNode(node)} is undefined`
  const n = num(v)
  const exact = Math.abs(v - Number(n.replace('−', '-'))) < 1e-9 || /\//.test(n)
  return `${displayNode(node)} ${exact ? '=' : '≈'} ${n}`
}

function pointText(scope: Scope, vars: readonly string[]): string {
  return vars
    .filter((v) => scope[v] != null)
    .map((v) => `${v} = ${num(scope[v]!)}`)
    .join(', ')
}

/** "log(x + 2) is not log(x) + log(2)… At x = 1: …" — the witness of a slip, about HER expression. */
export function slipWitness(slip: Slip, vars: readonly string[], samples: readonly Scope[]): string {
  const from = displayNode(slip.from)
  const to = displayNode(slip.to)
  const lead = SLIP_LEAD[slip.id](from, to)
  const differs = (s: Scope, allowUndef: boolean) => {
    const a = evalNode(slip.from, s)
    const b = evalNode(slip.to, s)
    return a !== 'undef' && (b === 'undef' ? allowUndef : Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(a)))
  }
  const at = samples.find((s) => differs(s, false)) ?? samples.find((s) => differs(s, true))
  if (!at) return lead
  const where = collectVars(slip.from).length || collectVars(slip.to).length ? `At ${pointText(at, vars)}: ` : ''
  const b = evalNode(slip.to, at)
  const tail = b === 'undef' ? `${to} is undefined there.` : slip.to.type === 'ConstantNode' ? `your line has ${num(b)}.` : `${valueSentence(slip.to, at)}.`
  return `${lead} ${where}${valueSentence(slip.from, at)}, but ${tail}`
}

const SLIP_LEAD: Record<Slip['id'], (from: string, to: string) => string> = {
  log_sum_split: (f, t) => `${f} is not ${t}: only a log of a PRODUCT splits into a sum of logs.`,
  log_product_as_product: (f, t) => `${f} is not ${t}: the log of a product is the SUM of the logs.`,
  log_quotient_as_quotient: (f, t) => `${f} is not ${t}: the log of a quotient is the DIFFERENCE of the logs, and a quotient of logs is a change of base.`,
  log_power_as_power: (f, t) => `${f} is not ${t}: the exponent comes down in front as a multiplier.`,
  log_coefficient_as_power: (f, t) => `${f} is not ${t}: a number in front of a log is the exponent of what is inside the log.`,
  log_coefficient_inside: (f, t) => `${f} is not ${t}: the number in front becomes an exponent inside the log, not a factor.`,
  log_change_base_inverted: (f, t) => `${f} is not ${t}: in the change of base formula the base goes on the bottom.`,
  log_identity_misused: (f, t) => `${f} is not ${t}: ask what power of the base gives the number inside.`,
  log_power_abs: (f, t) => `${f} is ${t} only where the inside of the log is positive; the power rule gives an absolute value here.`,
  log_exp_sum_split: (f, t) => `${f} is not ${t}: a sum in the exponent makes a PRODUCT of powers.`,
  log_exp_power_added: (f, t) => `${f} is not ${t}: a power of a power multiplies the exponents, and a product of powers adds them.`,
  log_exp_negative_exponent: (f, t) => `${f} is not ${t}: a negative exponent makes a reciprocal, which is still positive.`,
  log_exp_coefficient_base: (f, t) => `${f} is not ${t}: only the base is raised to the power; the number in front multiplies afterwards.`,
  log_convert_swapped: (f, t) => `${f} is not ${t}.`,
  log_convert_multiplied: (f, t) => `${f} is not ${t}.`,
  log_convert_dropped: (f, t) => `${f} is not ${t}.`,
  log_one_side: (f, t) => `${f} is not ${t}.`,
  log_extraneous_kept: (f, t) => `${f} is not ${t}.`,
  log_valid_rejected: (f, t) => `${f} is not ${t}.`,
  log_value_sign: (f, t) => `${f} is not ${t}.`,
  log_value_divided: (f, t) => `${f} is not ${t}.`,
  log_ln_confused: (f, t) => `${f} is not ${t}.`,
}

/**
 * The slip that produces `next` from `prev`, when one does: a slip of prev itself, or a slip made right
 * after one legal step (log₄(5x³y) → log₄ 5 + log₄ x³ + log₄ y by the product rule, then (log₄ x)³).
 * `domainLoss`: only then is log_power_abs possible.
 */
export function findSlip(prev: MathNode, next: MathNode, samples: readonly Scope[], domainLoss: boolean): Slip | null {
  const min = Math.min(4, Math.max(1, samples.length))
  const tryAll = (slips: readonly Slip[]): Slip | null => {
    for (const slip of slips) {
      if (slip.id === 'log_power_abs' && !domainLoss) continue
      if (slip.id !== 'log_power_abs' && domainLoss && sameOnSamples(slip.node, prev, samples, min)) continue
      if (sameOnSamples(next, slip.node, samples, min)) return slip
    }
    return null
  }
  const direct = tryAll(expressionSlips(prev))
  if (direct) return direct
  for (const legal of legalRewrites(prev)) {
    const after = tryAll(expressionSlips(legal.node))
    if (after) return after
  }
  // Products and quotients expanded, then a slip on a power: ln(x⁴y²/n) → (ln x)⁴ + 2 ln y − ln n.
  try {
    const partial = expandLogs(prev, { powers: false })
    if (partial.used.size) return tryAll(expressionSlips(partial.node))
  } catch {
    // No partial expansion.
  }
  return null
}

/**
 * Is `next` a legal rewrite of `prev`? Both are expressions in app syntax. Constant expressions are
 * compared exactly when the exact model covers them (log₂ 8 → 3), else to 1e-9.
 */
export function checkLogRewrite(prev: string, next: string, ctx: LogRewriteContext = {}): LogStepResult {
  const vars = ctx.vars ?? DEFAULT_VARS
  const pp = parseExpression(prev, vars)
  if (!pp.ok) return parseError('prev', pp.error)
  const pn = parseExpression(next, vars)
  if (!pn.ok) return parseError('next', pn.error)
  const a = pp.node
  const b = pn.node
  const used = [...new Set([...collectVars(a), ...collectVars(b)])].sort()
  const normalized = { text: pn.text, latex: '' }
  const opts = { positive: ctx.assumePositive, seed: ctx.seed }

  if (!used.length) {
    const ea = tryExact(a)
    const eb = tryExact(b)
    let same: boolean
    if (ea && eb && ea !== 'undef' && eb !== 'undef') same = exactEquals(ea, eb)
    else {
      const va = evalNode(a, {})
      const vb = evalNode(b, {})
      same = va !== 'undef' && vb !== 'undef' && Math.abs(va - vb) <= 1e-9 * Math.max(1, Math.abs(va))
    }
    if (same) return accepted(a, b, [{}], normalized)
    const slip = findSlip(a, b, [{}], false)
    const va = evalNode(a, {})
    const vb = evalNode(b, {})
    const result: LogStepResult = { ok: false, verdict: 'not_equivalent', acceptableChips: [], normalized }
    if (slip) result.pattern = patternHit(slip.id, slipWitness(slip, [], [{}]))
    result.counterexample = constantCounterexample(va, vb)
    return result
  }

  const verdict = compareOnDomain(a, b, used, opts)
  if (verdict.kind === 'undecidable') {
    return { ok: false, verdict: 'undecidable', acceptableChips: [], normalized, message: 'This expression is not defined for any value I can try, so I cannot check the step.' }
  }
  const samples = [...samplesInDomain([a], used, opts), ...samplesInDomain([b], used, { ...opts, seed: (ctx.seed ?? 7) + 3 })]
  if (verdict.kind === 'equal') return accepted(a, b, samples, normalized)

  const result: LogStepResult = { ok: false, verdict: 'not_equivalent', acceptableChips: [], normalized }
  const slip = findSlip(a, b, samples, verdict.kind === 'domain_lost')
  if (slip) result.pattern = patternHit(slip.id, slipWitness(slip, used, samples))
  else {
    // Not a log slip: the engine's algebra matchers (distribution, cancelling) on L = expr.
    const letter = (['y', 'n', 'x'] as const).find((v) => !used.includes(v))
    if (letter) {
      const os = parseStatement(`${letter} = ${pp.text}`, [...used, letter] as VarName[])
      const ns = parseStatement(`${letter} = ${pn.text}`, [...used, letter] as VarName[])
      if (os.ok && ns.ok) {
        const m = runMatchers(os.statement, ns.statement, { seed: ctx.seed })
        if (m) result.pattern = m
      }
    }
  }
  const at = verdict.at
  result.counterexample = expressionCounterexample(at, verdict.prevValue, verdict.kind === 'different' ? verdict.nextValue : 'undef', used)
  if (verdict.kind === 'domain_lost' && !ctx.assumePositive) {
    result.message = `${pointText(at, used)} is in the domain of the original expression but not of yours.`
  }
  return result
}

function constantCounterexample(a: number | 'undef', b: number | 'undef'): Counterexample {
  const fmt = (v: number | 'undef') => (v === 'undef' ? 'undefined' : num(v))
  return {
    point: {},
    pointDisplay: '',
    oldTruth: true,
    newTruth: false,
    message: `The original is ${fmt(a)}, but your line is ${fmt(b)}.`,
  }
}

function accepted(a: MathNode, b: MathNode, samples: readonly Scope[], normalized: StepResult['normalized']): LogStepResult {
  const logMove = hasLogOrExp(a) || hasLogOrExp(b) ? classifyLogRewrite(a, b, samples) : { properties: ['rewrite' as const], detail: 'rewrote the expression' }
  return {
    ok: true,
    verdict: 'equivalent',
    detected: { tag: 'simplify', chip: 'simplify', exact: false, detail: logMove.detail },
    acceptableChips: [...REWRITE_CHIPS],
    normalized,
    logMove,
  }
}

// ---------------------------------------------------------------------------
// Expand / condense helpers for templates
// ---------------------------------------------------------------------------

function nodeOf(text: string, vars: readonly VarName[]): MathNode | null {
  const p = parseExpression(text, vars)
  return p.ok ? p.node : null
}

/** The textbook full expansion (app syntax): "log(x^2 y/z)" → "2log(x) + log(y) - log(z)". Null when unreadable. */
export function expandLog(text: string, vars: readonly VarName[] = DEFAULT_VARS): string | null {
  const n = nodeOf(text, vars)
  return n ? expandLogs(n).text : null
}

/** The single-log form (app syntax): "2log(x) + log(y) - log(z)" → "log(x^2 y/z)". Null when not one base. */
export function condenseLog(text: string, vars: readonly VarName[] = DEFAULT_VARS): string | null {
  const n = nodeOf(text, vars)
  if (!n) return null
  const c = condenseLogs(n)
  return c ? c.text : null
}

/**
 * Fully expanded: no log has a product, a quotient, a power or a root of the variable inside it (sums stay:
 * log(x + 1) cannot be expanded).
 */
export function isExpandedLog(text: string, vars: readonly VarName[] = DEFAULT_VARS): boolean {
  const n = nodeOf(text, vars)
  if (!n) return false
  let ok = true
  n.traverse((m) => {
    const call = asLogCall(m)
    if (!call || !collectVars(call.arg).length) return
    const a = call.arg
    if (productFactors(a).length >= 2 || a.type === 'OperatorNode' && ['/', '^'].includes((a as unknown as { op: string }).op)) ok = false
    if (a.type === 'FunctionNode' && ['sqrt', 'cbrt', 'nthRoot'].includes(String((a as unknown as { fn: { name: string } }).fn.name))) ok = false
  })
  return ok
}

/** One log with nothing in front of it (or a log-free constant): the "single logarithm" an exercise asks for. */
export function isSingleLog(text: string, vars: readonly VarName[] = DEFAULT_VARS): boolean {
  const n = nodeOf(text, vars)
  if (!n) return false
  return asLogCall(n) !== null
}
