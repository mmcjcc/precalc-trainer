/**
 * Values of constant log and exponential expressions: "evaluate log₂ 8", "log 0.001", "ln(e⁵)", "e^(ln 7)",
 * "log₄ 8", and "approximate log₂ 7 to three decimal places".
 *
 * Exact problems are graded in the exact model (exact.ts): 3/2 and 1.5 are both right for log₄ 8, and a
 * calculator decimal for an irrational value is not an answer (verdict 'invalid', reason 'not_exact'; the
 * message asks for the exact form without giving it). A decimal is accepted only when the problem asks for
 * one (`decimal`), within its tolerance.
 *
 * Mistakes are what each slip gives for THIS expression: every expression slip (slips.ts) applied to the
 * problem and to its change-of-base form (the calculator route: log₂ 7 = log 7 / log 2, where log(7/2) and
 * log 2 / log 7 are the slips), plus the sign slip, the divide slip (log₂ 8 = 8/2) and, for decimals,
 * pressing LN for LOG or LOG for LN.
 */
import { ratToString } from '@/notation/rational'
import { collectVars, compileExpression, evalNode, type MathNode } from '../math'
import { patternHit } from '../matchers/catalog'
import { parseExpression } from '../parse'
import { exactEquals, exactIsRational, exactNeg, exactRational, tryExact, type ExactValue } from './exact'
import { asExpPower, asLogCall, expressionSlips } from './slips'
import { decimalTolerance } from './step'
import { display, displayNode, fixed, num } from './text'
import type { DecimalSpec, LogGrade, LogMistakeCandidate, LogMistakeId } from './types'

export interface LogValue {
  /** The problem, app syntax as parsed. */
  text: string
  value: number
  exact: ExactValue | null
  /** "3", "-3/2" when the value is rational, else null. */
  exactText: string | null
  rational: boolean
}

function parseConstant(text: string): { ok: true; node: MathNode; text: string } | { ok: false; error: { message: string; position: number; length?: number } } {
  const p = parseExpression(text, ['x'])
  if (!p.ok) return p
  if (collectVars(p.node).length) {
    const at = text.search(/(?<![A-Za-z])x(?![A-Za-z])/)
    return { ok: false, error: { message: 'This answer is a number: no x should be left in it.', position: Math.max(0, at), length: 1 } }
  }
  return p
}

/** The exact value of a constant expression; null when it is undefined or unreadable. */
export function logValue(text: string): LogValue | null {
  const p = parseConstant(text)
  if (!p.ok) return null
  return valueOfNode(p.node, p.text)
}

function valueOfNode(node: MathNode, text: string): LogValue | null {
  const v = evalNode(node, {})
  if (v === 'undef') return null
  const ex = tryExact(node)
  const exact = ex && ex !== 'undef' ? ex : null
  const r = exact ? exactRational(exact) : null
  return { text, value: v, exact, exactText: r ? ratToString(r) : null, rational: exact ? exactIsRational(exact) : false }
}

function close(a: number, b: number, tol = 1e-9): boolean {
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b))
}

/** A float that is a fraction with a small denominator (to 1e-12): how a value outside the exact model can still be rational. */
function looksRational(v: number): boolean {
  for (let d = 1; d <= 1000; d++) if (Math.abs(v * d - Math.round(v * d)) <= 1e-9 * Math.max(1, Math.abs(v * d))) return true
  return false
}

/** Her value equals the target exactly (exact model when both are in it, else 1e-12, never a decimal for an irrational). */
function exactlyEqual(her: LogValue, target: LogValue): boolean {
  if (her.exact && target.exact) return exactEquals(her.exact, target.exact)
  if (!close(her.value, target.value, 1e-12)) return false
  // A terminating decimal never equals an irrational number.
  if (her.rational && target.exact && !target.rational) return false
  if (her.rational && !target.exact && !looksRational(target.value)) return false
  return true
}

/** The change-of-base form of every log with a base other than 10 and e: log(a, b) → log(a)/log(b). */
function changeOfBaseForm(node: MathNode): MathNode | null {
  let changed = false
  const out = node.transform((n) => {
    const c = asLogCall(n)
    if (c && c.kind === 'logb' && c.base) {
      changed = true
      return compileExpression(`log(${c.arg.toString()}) / log(${c.base.toString()})`)
    }
    return n
  })
  return changed ? out : null
}

/** log ↔ ln everywhere (the wrong calculator key). */
function otherKey(node: MathNode): MathNode | null {
  let changed = false
  const out = node.transform((n) => {
    const c = asLogCall(n)
    if (c && c.kind === 'log10') {
      changed = true
      return compileExpression(`ln(${c.arg.toString()})`)
    }
    if (c && c.kind === 'ln') {
      changed = true
      return compileExpression(`log(${c.arg.toString()})`)
    }
    return n
  })
  return changed ? out : null
}

interface ValueCandidate {
  id: LogMistakeId
  node: MathNode | null
  value: LogValue
  witness: string
}

function candidateValues(node: MathNode, target: LogValue, decimal: boolean): ValueCandidate[] {
  const out: ValueCandidate[] = []
  const shown = displayNode(node)
  const push = (id: LogMistakeId, n: MathNode | null, value: LogValue | null, witness: string) => {
    if (!value) return
    if (exactlyEqual(value, target) || close(value.value, target.value, 1e-9)) return
    out.push({ id, node: n, value, witness })
  }
  const right = target.exactText ? display(target.exactText) : num(target.value)
  const call = asLogCall(node)
  // Divided instead of finding the exponent: log_2(8) "=" 8/2.
  if (call && call.baseValue != null && !collectVars(call.arg).length) {
    const a = evalNode(call.arg, {})
    if (a !== 'undef') {
      const q = valueOfNode(compileExpression(`(${call.arg.toString()}) / (${call.baseValue === Math.E ? 'e' : call.base ? call.base.toString() : '10'})`), '')
      const base = call.kind === 'ln' ? 'e' : call.kind === 'log10' ? '10' : displayNode(call.base!)
      push('log_value_divided', null, q, `${shown} asks: ${base} to what power gives ${displayNode(call.arg)}? That power is ${right}. Dividing ${displayNode(call.arg)} by ${base} answers a different question.`)
    }
  }
  // The sign slip.
  if (target.exact && target.value !== 0) {
    const neg = exactNeg(target.exact)
    const nv: LogValue = { text: '', value: -target.value, exact: neg, exactText: exactRational(neg) ? ratToString(exactRational(neg)!) : null, rational: target.rational }
    const between = call && !collectVars(call.arg).length ? evalNode(call.arg, {}) : 'undef'
    const why =
      between !== 'undef' && between > 0 && between < 1
        ? `${displayNode(call!.arg)} is between 0 and 1, so it takes a negative power of the base: ${shown} = ${right}.`
        : `Check the sign: ${shown} = ${right}. Ask which power of the base gives the number, sign included.`
    push('log_value_sign', null, nv, why)
  }
  const sources: MathNode[] = [node]
  const cob = changeOfBaseForm(node)
  if (cob) sources.push(cob)
  for (const src of sources) {
    for (const slip of expressionSlips(src)) {
      if (slip.id === 'log_power_abs') continue
      const v = valueOfNode(slip.node, '')
      const from = displayNode(slip.from)
      const to = displayNode(slip.to)
      const theirs = v && slip.to.type !== 'ConstantNode' ? `, but ${to} ${v.exactText ? '=' : '≈'} ${v.exactText ? display(v.exactText) : num(v.value)}` : ''
      push(slip.id, slip.node, v, `${SLIP_SENTENCE[slip.id] ?? ''}${from} is not ${to}: ${shown} = ${right}${theirs}.`)
    }
  }
  if (decimal) {
    const ok = otherKey(node)
    if (ok) {
      const v = valueOfNode(ok, '')
      push('log_ln_confused', ok, v, `log is base 10 and ln is base e. ${shown} ≈ ${num(target.value)}; ${displayNode(ok)} ≈ ${v ? num(v.value) : '?'} uses the other key.`)
    }
  }
  return out
}

const SLIP_SENTENCE: Partial<Record<LogMistakeId, string>> = {
  log_change_base_inverted: 'In the change of base formula the base goes on the bottom: ',
  log_quotient_as_quotient: 'A quotient of logs is not the log of a quotient: ',
  log_identity_misused: 'Ask what power of the base gives the number inside: ',
  log_sum_split: 'A sum of logs is the log of a PRODUCT: ',
  log_product_as_product: 'The log of a product is the SUM of the logs: ',
  log_power_as_power: 'The exponent comes down in front as a multiplier: ',
  log_coefficient_as_power: 'A number in front of a log is the exponent of what is inside: ',
  log_coefficient_inside: 'The number in front becomes an exponent inside the log, not a factor: ',
  log_exp_negative_exponent: 'A negative exponent makes a reciprocal, which is still positive: ',
  log_exp_sum_split: 'A sum in the exponent makes a PRODUCT of powers: ',
  log_exp_power_added: 'A power of a power multiplies the exponents: ',
  log_exp_coefficient_base: 'Only the base is raised to the power: ',
}

function dedupe(cands: ValueCandidate[]): LogMistakeCandidate[] {
  const out: LogMistakeCandidate[] = []
  const vals: LogValue[] = []
  for (const c of cands) {
    const i = vals.findIndex((v) => exactlyEqual(c.value, v) || close(c.value.value, v.value, 1e-9))
    if (i >= 0) {
      const twin = out[i]!
      if (twin.id !== c.id && !twin.shadows.includes(c.id)) twin.shadows.push(c.id)
      continue
    }
    vals.push(c.value)
    out.push({ id: c.id, text: c.value.exactText ?? String(Number(c.value.value.toPrecision(12))), values: [c.value.value], witness: c.witness, shadows: [] })
  }
  return out
}

/** What each slip gives for this value problem, in priority order, without the ones equal to the answer. */
export function logValueMistakes(problem: string, opts: { decimal?: DecimalSpec } = {}): LogMistakeCandidate[] {
  const p = parseConstant(problem)
  if (!p.ok) return []
  const target = valueOfNode(p.node, p.text)
  if (!target) return []
  return dedupe(candidateValues(p.node, target, !!opts.decimal))
}

function explanationOf(node: MathNode, target: LogValue, decimal?: DecimalSpec): string[] {
  const shown = displayNode(node)
  const lines: string[] = []
  const call = asLogCall(node)
  const inner = call ? asExpPower(call.arg) : null
  if (call && inner && call.baseValue != null && Math.abs(inner.baseValue - call.baseValue) < 1e-12 * call.baseValue && target.exactText) {
    lines.push(`A log undoes a power of its own base: ${shown} = ${display(target.exactText)}.`)
    return lines
  }
  const outer = asExpPower(node)
  const innerLog = outer ? asLogCall(outer.exponent) : null
  if (outer && innerLog && innerLog.baseValue != null && Math.abs(outer.baseValue - innerLog.baseValue) < 1e-12 * outer.baseValue && target.exactText) {
    lines.push(`A power undoes a log of its own base: ${shown} = ${display(target.exactText)}.`)
    return lines
  }
  if (call && call.baseValue != null && target.exactText) {
    const base = call.kind === 'ln' ? 'e' : call.kind === 'log10' ? '10' : displayNode(call.base!)
    lines.push(`${shown} asks: ${base} to what power gives ${displayNode(call.arg)}?`)
    lines.push(`${base}^${/^[\d/-]+$/.test(target.exactText) && !target.exactText.includes('/') && !target.exactText.startsWith('-') ? target.exactText : `(${display(target.exactText)})`} = ${displayNode(call.arg)}, so ${shown} = ${display(target.exactText)}.`)
    return lines
  }
  if (target.exactText) {
    lines.push(`${shown} = ${display(target.exactText)}.`)
    return lines
  }
  const cob = changeOfBaseForm(node)
  if (cob) lines.push(`Change of base: ${shown} = ${displayNode(cob)}.`)
  lines.push(decimal && 'places' in decimal ? `On the calculator: ${displayNode(cob ?? node)} ≈ ${fixed(target.value, decimal.places)}.` : `${shown} ≈ ${num(target.value)}.`)
  return lines
}

/** Her decimal answer: the number she typed and how many decimal places it has. */
function plainDecimal(text: string): { value: number; places: number } | null {
  const m = text.trim().replace(/[−–]/g, '-').match(/^([-+]?)(\d*)\.(\d+)$|^([-+]?\d+)$/)
  if (!m) return null
  const value = Number(text.trim().replace(/[−–]/g, '-'))
  if (!Number.isFinite(value)) return null
  return { value, places: m[3] ? m[3].length : 0 }
}

/**
 * Grade a value answer. `decimal` set: the problem asks for a rounded decimal (her answer is graded with
 * that tolerance). Unset: the exact value is wanted.
 */
export function gradeLogValue(problem: string, answer: string, opts: { decimal?: DecimalSpec } = {}): LogGrade {
  const p = parseConstant(problem)
  if (!p.ok) return { verdict: 'unsupported', message: `The problem ${problem} is not a number expression I can read.` }
  const target = valueOfNode(p.node, p.text)
  if (!target) return { verdict: 'unsupported', message: `${display(p.text)} is undefined.` }
  const explanation = explanationOf(p.node, target, opts.decimal)
  const raw = (answer ?? '').trim()
  if (!raw) return { verdict: 'invalid', reason: 'unreadable', message: 'Type your answer first.' }
  const h = parseConstant(raw)
  if (!h.ok) return { verdict: 'invalid', reason: 'unreadable', message: h.error.message, position: h.error.position, ...(h.error.length ? { length: h.error.length } : {}) }
  const her = valueOfNode(h.node, h.text)
  if (!her) return { verdict: 'invalid', reason: 'unreadable', message: 'That value is undefined as written. Check the input of each log.' }
  const shown = displayNode(p.node)
  const cands = candidateValues(p.node, target, !!opts.decimal)

  if (opts.decimal) {
    const tol = decimalTolerance(opts.decimal)
    const dec = plainDecimal(raw)
    if (!dec) {
      if (close(her.value, target.value, 1e-9)) return { verdict: 'invalid', reason: 'not_in_form', message: 'That is the exact value. This problem asks for a decimal: work it out on the calculator and round it.' }
    } else {
      if (Math.abs(dec.value - target.value) <= tol) return { verdict: 'correct', message: `Correct: ${shown} ≈ ${display(raw)}.`, explanation }
      if ('places' in opts.decimal && dec.places < opts.decimal.places && Math.abs(dec.value - target.value) <= 0.5 * 10 ** -dec.places + 1e-12) {
        return { verdict: 'invalid', reason: 'not_rounded', message: `Keep ${opts.decimal.places} decimal place${opts.decimal.places === 1 ? '' : 's'}: ${display(raw)} is rounded too far.` }
      }
    }
    for (const c of cands) {
      if (Math.abs(her.value - c.value.value) <= Math.max(tol, 0.5 * 10 ** -(dec?.places ?? 3) + 1e-12)) {
        return { verdict: 'mistake', mistake: c.id, pattern: patternHit(c.id, c.witness), witness: c.witness, explanation }
      }
    }
    return { verdict: 'wrong', message: `${display(raw)} is not ${shown}.${cob(p.node)} Check it on the calculator.`, explanation }
  }

  if (exactlyEqual(her, target)) return { verdict: 'correct', message: `Correct: ${shown} = ${display(target.exactText ?? h.text)}.`, explanation }
  // A calculator decimal for an irrational value (or for a rational one, to its typed places).
  const dec = plainDecimal(raw)
  if (dec && dec.places >= 1 && Math.abs(dec.value - target.value) <= 0.5 * 10 ** -dec.places + 1e-12) {
    return {
      verdict: 'invalid',
      reason: 'not_exact',
      message: `${display(raw)} is a calculator approximation. This one has an exact value: find the power of the base that gives the number inside.`,
    }
  }
  for (const c of cands) {
    if (exactlyEqual(her, c.value) || (!c.value.exact && close(her.value, c.value.value, 1e-9))) {
      return { verdict: 'mistake', mistake: c.id, pattern: patternHit(c.id, c.witness), witness: c.witness, explanation }
    }
  }
  return { verdict: 'wrong', message: `${display(raw)} is not ${shown}. Ask: what power of the base gives the number inside the log?`, explanation }
}

function cob(node: MathNode): string {
  const c = changeOfBaseForm(node)
  return c ? ` Change of base: ${displayNode(node)} = ${displayNode(c)}.` : ''
}
