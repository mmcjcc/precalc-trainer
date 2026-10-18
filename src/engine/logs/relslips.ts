/**
 * Slips of a whole equation: what each named mistake turns the PREVIOUS line into, for this problem.
 *
 *   side slips        any expression slip (slips.ts) on either side
 *   log_one_side      A = B → log(A) = B or A = log(B)                         (2^x = 7 → x log 2 = 7)
 *   log_sum_split     taking logs of a sum term by term                        (2^x + 3 = 7 → log 2^x + log 3 = log 7)
 *   take logs + slip  log(A) = log(B), then a slip inside                      (3^(2x) = 5 → (log 3)^(2x) = log 5)
 *   log_convert_*     log_b A = C → A = C^b (swapped), A = b·C (multiplied), A = C (dropped); the same after the
 *                     logs on a side are combined; b^A = C → A = log_C b (swapped), A = C/b, A = C
 *   log_ln_confused   log A = C → A = e^C, ln A = C → A = 10^C
 *   solving U·log b = log a:
 *     log_change_base_inverted   U = log b / log a
 *     log_quotient_as_quotient   U = log(a/b), U = log a − log b
 */
import type { MathNode } from '../math'
import { collectVars, compileExpression, tryConst } from '../math'
import { makeStatement } from '../parse'
import type { Relation, Statement } from '../types'
import { condenseLogs } from './rules'
import { asExpPower, asLogCall, expPowersOf, expressionSlips, hasNegativeBasePower, logCallsOf, productFactors, signedTerms, src, type LogCall, type Slip } from './slips'
import { appText, display, displayNode } from './text'
import type { LogMistakeId } from './types'

export interface RelSlip {
  id: LogMistakeId
  stmt: Statement
  /** The expression slip it came from, for side slips (the witness is built from it). */
  slip?: Slip
  /** Witness sentence (display text) for the non-side slips. */
  witness?: string
}

function rel(lhs: MathNode, rhs: MathNode, op: Relation['op'] = '='): Relation {
  return { lhs, rhs, op, lhsSrc: appText(lhs), rhsSrc: appText(rhs) }
}

function stmtOf(lhs: MathNode, rhs: MathNode, op: Relation['op'] = '='): Statement {
  return makeStatement([[rel(lhs, rhs, op)]], `${appText(lhs)} ${op} ${appText(rhs)}`)
}

function tryBuild(text: string): MathNode | null {
  try {
    return compileExpression(text)
  } catch {
    return null
  }
}

function isConstant(n: MathNode): boolean {
  return collectVars(n).length === 0
}

function lineText(l: MathNode, r: MathNode): string {
  return display(`${appText(l)} = ${appText(r)}`)
}

/** Bases a student might use when taking logs here: 10, e, and the bases of the exponentials in the line. */
function logBases(r: Relation): { text: string | null; ln: boolean }[] {
  const out: { text: string | null; ln: boolean }[] = [
    { text: null, ln: false },
    { text: null, ln: true },
  ]
  for (const p of [...expPowersOf(r.lhs), ...expPowersOf(r.rhs)]) {
    if (p.viaExp || Math.abs(p.baseValue - Math.E) < 1e-12 || Math.abs(p.baseValue - 10) < 1e-12) continue
    if (!out.some((b) => b.text === p.baseText)) out.push({ text: p.baseText, ln: false })
  }
  return out
}

function logOf(arg: MathNode, base: { text: string | null; ln: boolean }): MathNode | null {
  if (base.ln) return tryBuild(`ln(${arg.toString()})`)
  return tryBuild(base.text === null ? `log(${arg.toString()})` : `log(${arg.toString()}, ${base.text})`)
}

function convertSlips(logSide: MathNode, other: MathNode, out: RelSlip[]): void {
  const call = asLogCall(logSide)
  if (!call || !isConstant(other)) return
  const C = other
  const A = call.arg
  const b = call.kind === 'ln' ? 'e' : call.kind === 'log10' ? '10' : src(call.base!)
  const bShow = call.kind === 'ln' ? 'e' : call.kind === 'log10' ? '10' : display(appText(call.base!))
  const cShow = displayNode(C)
  const right = `${display(appText(A))} = ${bShow}^${/^[\w.]+$/.test(cShow) ? cShow : `(${cShow})`}`
  const head = `${displayNode(logSide)} = ${cShow} means ${right}: the base ${bShow} raised to the power ${cShow}.`
  const push = (id: LogMistakeId, rhsText: string, says: string) => {
    const r = tryBuild(rhsText)
    if (r) out.push({ id, stmt: stmtOf(A, r), witness: `${head} ${says.replace('{line}', lineText(A, r))}` })
  }
  push('log_convert_dropped', C.toString(), 'Your line {line} drops the log without raising the base to the power.')
  push('log_convert_swapped', `(${C.toString()}) ^ ${b}`, 'Your line {line} has the base and the exponent the other way round.')
  push('log_convert_multiplied', `${b} * (${C.toString()})`, 'Your line {line} multiplies the base by the exponent instead.')
  if (call.kind === 'log10') push('log_ln_confused', `exp(${C.toString()})`, 'log is base 10, but your line {line} uses e, the base of ln.')
  if (call.kind === 'ln') push('log_ln_confused', `10 ^ (${C.toString()})`, 'ln is base e, but your line {line} uses 10, the base of log.')
}

function expConvertSlips(powSide: MathNode, other: MathNode, out: RelSlip[]): void {
  const p = asExpPower(powSide)
  if (!p || !isConstant(other) || isConstant(p.exponent)) return
  const A = p.exponent
  const C = other
  const b = p.viaExp ? 'e' : p.baseText
  const bShow = p.viaExp ? 'e' : display(appText(compileExpression(p.baseText)))
  const cShow = displayNode(C)
  const rightRhs = p.viaExp ? `ln(${cShow})` : `log_${/^[\w.]+$/.test(bShow) ? bShow : `(${bShow})`}(${cShow})`
  const head = `${displayNode(powSide)} = ${cShow} means ${display(appText(A))} = ${display(rightRhs)}: the exponent is the log, base ${bShow}, of ${cShow}.`
  const push = (id: LogMistakeId, rhsText: string, says: string) => {
    const r = tryBuild(rhsText)
    if (r) out.push({ id, stmt: stmtOf(A, r), witness: `${head} ${says.replace('{line}', lineText(A, r))}` })
  }
  push('log_convert_dropped', C.toString(), 'Your line {line} drops the base without taking a log.')
  push('log_convert_swapped', p.viaExp ? `log(e, ${src(C)})` : `log(${b}, ${src(C)})`, 'Your line {line} has the base and the number the other way round.')
  push('log_convert_multiplied', `(${C.toString()}) / ${b}`, 'Your line {line} divides by the base instead of taking a log.')
  if (p.viaExp || Math.abs(p.baseValue - Math.E) < 1e-12) push('log_ln_confused', `log(${C.toString()})`, 'The base is e, so the log is ln; your line {line} uses log, which is base 10.')
  if (Math.abs(p.baseValue - 10) < 1e-12) push('log_ln_confused', `ln(${C.toString()})`, 'The base is 10, so the log is log; your line {line} uses ln, which is base e.')
}

/**
 * U·F = G with F the constant log factors and U everything else (it holds the variable): 2x·log 3 = log 5
 * has U = 2x and F = log 3, so the slips are 2x = log 3 / log 5, 2x = log(5/3), 2x = log 5 − log 3.
 */
function divisionSlips(side: MathNode, other: MathNode, out: RelSlip[]): void {
  if (!isConstant(other)) return
  const fs = productFactors(side)
  const logFactors = fs.filter((f) => isConstant(f) && logCallsOf(f).length > 0)
  const rest = fs.filter((f) => !logFactors.includes(f))
  if (!logFactors.length || !rest.some((f) => !isConstant(f))) return
  const U = rest.length === 1 ? rest[0]! : tryBuild(rest.map(src).join(' * '))
  const F = logFactors.length === 1 ? logFactors[0]! : tryBuild(logFactors.map(src).join(' * '))
  if (!U || !F) return
  const fCall = logFactors.length === 1 ? asLogCall(F) : null
  const gCall = asLogCall(other)
  if (!fCall && !logCallsOf(F).length) return
  const fv = tryConst(F)
  if (fv == null || Math.abs(fv) < 1e-12) return
  const right = `${display(appText(U))} = ${displayNode(other)}/${displayNode(F)}`
  const head = `${displayNode(side)} = ${displayNode(other)} means ${right}: divide both sides by ${displayNode(F)}.`
  const inv = tryBuild(`${src(F)} / ${src(other)}`)
  if (inv) out.push({ id: 'log_change_base_inverted', stmt: stmtOf(U, inv), witness: `${head} Your line ${lineText(U, inv)} is upside down: the number you divide BY goes on the bottom.` })
  if (fCall && gCall && sameKind(fCall, gCall)) {
    const q = tryBuild(logText(gCall, `${src(gCall.arg)} / ${src(fCall.arg)}`))
    if (q) out.push({ id: 'log_quotient_as_quotient', stmt: stmtOf(U, q), witness: `${head} ${displayNode(other)}/${displayNode(F)} is a quotient of two logs; it is not ${displayNode(q)} (that is ${displayNode(other)} − ${displayNode(F)}).` })
    const d = tryBuild(`${src(other)} - ${src(F)}`)
    if (d) out.push({ id: 'log_quotient_as_quotient', stmt: stmtOf(U, d), witness: `${head} A quotient of logs is not a difference of logs: ${displayNode(other)} − ${displayNode(F)} is log of a quotient, a different number.` })
  }
}

function sameKind(a: LogCall, b: LogCall): boolean {
  return a.kind === b.kind && (a.kind !== 'logb' || a.baseKey === b.baseKey)
}

function logText(call: LogCall, arg: string): string {
  if (call.kind === 'ln') return `ln(${arg})`
  if (call.kind === 'log10') return `log(${arg})`
  return `log(${arg}, ${src(call.base!)})`
}

/**
 * Every slip of a single relation (equations; inequalities get the side slips only). The order is the
 * priority order: when two slips give the same line, the earlier one names it.
 */
function relationSlipsRaw(r: Relation): RelSlip[] {
  const out: RelSlip[] = []
  const sides: ['lhs' | 'rhs', MathNode, MathNode][] = [
    ['lhs', r.lhs, r.rhs],
    ['rhs', r.rhs, r.lhs],
  ]
  // Conversions first: they are the slips of the step that removes a log or an exponential.
  if (r.op === '=') {
    for (const [, s, o] of sides) {
      convertSlips(s, o, out)
      expConvertSlips(s, o, out)
      const condensed = asLogCall(s) ? null : condenseLogs(s)
      if (condensed && asLogCall(condensed.node)) convertSlips(condensed.node, o, out)
      divisionSlips(s, o, out)
    }
  }
  for (const [which, s, o] of sides) {
    for (const slip of expressionSlips(s)) {
      const stmt = which === 'lhs' ? stmtOf(slip.node, o, r.op) : stmtOf(o, slip.node, r.op)
      out.push({ id: slip.id, stmt, slip })
    }
  }
  if (r.op !== '=') return out
  const hasExp = expPowersOf(r.lhs).length + expPowersOf(r.rhs).length > 0
  if (!hasExp) return out
  for (const base of logBases(r)) {
    const lL = logOf(r.lhs, base)
    const lR = logOf(r.rhs, base)
    if (!lL || !lR) continue
    const name = base.ln ? 'ln' : 'log'
    const both = lineText(lL, lR)
    out.push({ id: 'log_one_side', stmt: stmtOf(lL, r.rhs), witness: `Take the log of BOTH sides: ${both}. Your line takes the ${name} of the left side only.` })
    out.push({ id: 'log_one_side', stmt: stmtOf(r.lhs, lR), witness: `Take the log of BOTH sides: ${both}. Your line takes the ${name} of the right side only.` })
    // Logs of a sum taken term by term.
    for (const [which, s, o] of sides) {
      const terms = signedTerms(s)
      if (terms.length < 2) continue
      const parts: string[] = []
      let ok = true
      for (const t of terms) {
        const v = isConstant(t.node) ? tryConst(t.node) : null
        const inner = v != null && v < 0 ? compileExpression(String(-v)) : t.node
        const lg = logOf(inner, base)
        if (!lg) {
          ok = false
          break
        }
        const sign = t.sign * (v != null && v < 0 ? -1 : 1)
        parts.push(`${parts.length ? (sign < 0 ? ' - ' : ' + ') : sign < 0 ? '-' : ''}${src(lg)}`)
      }
      const split = ok ? tryBuild(parts.join('')) : null
      const lo = logOf(o, base)
      if (!split || !lo) continue
      const stmt = which === 'lhs' ? stmtOf(split, lo) : stmtOf(lo, split)
      out.push({
        id: 'log_sum_split',
        stmt,
        witness: `${display(`${name}(${appText(s)})`)} is not ${displayNode(split)}: a log of a sum does not split. Get the power by itself first, then take the log of both sides.`,
      })
    }
    // Logs of both sides, then a slip inside one of them.
    for (const [which, s, o] of [
      ['lhs', lL, lR],
      ['rhs', lR, lL],
    ] as const) {
      for (const slip of expressionSlips(s)) {
        if (slip.id === 'log_sum_split' || slip.id === 'log_power_abs') continue
        const stmt = which === 'lhs' ? stmtOf(slip.node, o) : stmtOf(o, slip.node)
        out.push({ id: slip.id, stmt, slip })
      }
    }
  }
  return out
}

const SLIP_CACHE = new Map<string, RelSlip[]>()

/**
 * Every slip of a single relation (equations; inequalities get the side slips only), in priority order:
 * when two slips give the same line, the earlier one names it. Candidates with a negative constant
 * raised to a variable power are left out (see hasNegativeBasePower). Cached per relation.
 */
export function relationSlips(r: Relation): RelSlip[] {
  const key = `${r.lhs.toString()}|${r.op}|${r.rhs.toString()}`
  const hit = SLIP_CACHE.get(key)
  if (hit) return hit
  const out = relationSlipsRaw(r).filter((s) => !s.stmt.disjuncts.flat().some((x) => hasNegativeBasePower(x.lhs) || hasNegativeBasePower(x.rhs)))
  if (SLIP_CACHE.size > 256) SLIP_CACHE.clear()
  SLIP_CACHE.set(key, out)
  return out
}
