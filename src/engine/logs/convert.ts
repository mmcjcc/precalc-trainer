/**
 * Rewriting between exponential and logarithmic form: b^y = x ⟺ log_b(x) = y.
 *
 * A form is read off the relation: the exponential form has one side b^y (a constant base b > 0, b ≠ 1,
 * or e^y / exp(y)) and the other side x; the log form has one side log_b(x) (log is base 10, ln base e)
 * and the other side y. Her answer is right when it is the requested form with the SAME three parts (the
 * base by value, the other two as expressions, compared on their domain). An equal relation in the wrong
 * form is 'invalid' / 'not_in_form'. The swaps of two of the three parts are log_convert_swapped; b·y = x
 * is log_convert_multiplied.
 */
import type { VarName } from '@/shared/types'
import { collectVars, compileExpression, evalNode, fnName, nodeArgs, tryConst, type MathNode } from '../math'
import { patternHit } from '../matchers/catalog'
import { parseStatement, singleRelation } from '../parse'
import { sameOnSamples, samplesInDomain } from './equiv'
import { solutionsWide } from './wide'
import { asExpPower, asLogCall, productFactors } from './slips'
import { appText, display, displayNode } from './text'
import type { LogGrade, LogMistakeCandidate, LogMistakeId } from './types'

/** The three parts of b^y = x. `base` is a tree for the base (e for ln and exp). */
export interface ExpLogParts {
  base: MathNode
  baseValue: number
  /** The exponent y (the value of the log). */
  exponent: MathNode
  /** The result x (the input of the log). */
  result: MathNode
  /** Which form the relation was written in. */
  form: 'exp' | 'log'
}

const E_NODE = () => compileExpression('e')

/** Reads b^y = x (either side order) or log_b(x) = y. */
export function readForm(text: string, vars: readonly VarName[] = ['x', 'y', 'n']): ExpLogParts | null {
  const p = parseStatement(text, vars)
  if (!p.ok) return null
  const r = singleRelation(p.statement)
  if (!r || r.op !== '=') return null
  for (const [s, o] of [
    [r.lhs, r.rhs],
    [r.rhs, r.lhs],
  ] as const) {
    const call = asLogCall(s)
    if (call && call.baseValue != null) {
      const base = call.kind === 'ln' ? E_NODE() : call.kind === 'log10' ? compileExpression('10') : call.base!
      return { base, baseValue: call.baseValue, exponent: o, result: call.arg, form: 'log' }
    }
  }
  for (const [s, o] of [
    [r.lhs, r.rhs],
    [r.rhs, r.lhs],
  ] as const) {
    const pw = asExpPower(s)
    if (pw) return { base: pw.viaExp ? E_NODE() : compileExpression(pw.baseText), baseValue: pw.baseValue, exponent: pw.exponent, result: o, form: 'exp' }
    // The parser reads b^(1/2) as sqrt(b) and b^(1/3) as cbrt(b): e^(0.5) = sqrt(e) is still a power.
    const root = rootPower(s)
    if (root) return { ...root, result: o, form: 'exp' }
  }
  return null
}

function rootPower(n: MathNode): { base: MathNode; baseValue: number; exponent: MathNode } | null {
  const name = fnName(n)
  if (name !== 'sqrt' && name !== 'cbrt' && name !== 'nthRoot') return null
  const [b, k] = nodeArgs(n)
  if (!b || collectVars(b).length) return null
  const bv = tryConst(b)
  if (bv == null || !(bv > 0) || Math.abs(bv - 1) < 1e-12) return null
  const index = name === 'sqrt' ? 2 : name === 'cbrt' ? 3 : k ? tryConst(k) : null
  if (index == null || !Number.isInteger(index) || index < 2) return null
  return { base: b, baseValue: bv, exponent: compileExpression(`1/${index}`) }
}

function baseApp(p: ExpLogParts): string {
  return Math.abs(p.baseValue - Math.E) < 1e-12 ? 'e' : appText(p.base)
}

/** Parentheses unless the text is one number or one letter (e^(2x), not e^2x, which reads as e²·x). */
function wrap(t: string): string {
  return /^(\d+(\.\d+)?|[a-z])$/i.test(t) ? t : `(${t})`
}

/** "log_2(32) = 5", "ln(7) = 2x", "log(1000) = 3" (app syntax). */
export function logFormText(p: ExpLogParts): string {
  const b = baseApp(p)
  const x = appText(p.result)
  const left = b === 'e' ? `ln(${x})` : b === '10' ? `log(${x})` : `log_${wrap(b)}(${x})`
  return `${left} = ${appText(p.exponent)}`
}

/** "2^5 = 32", "e^(2x) = 7" (app syntax). */
export function expFormText(p: ExpLogParts): string {
  return `${wrap(baseApp(p))}^${wrap(appText(p.exponent))} = ${appText(p.result)}`
}

/** The other form of a relation in one of them; null when it is neither. */
export function convertForm(text: string, vars?: readonly VarName[]): string | null {
  const p = readForm(text, vars)
  if (!p) return null
  return p.form === 'exp' ? logFormText(p) : expFormText(p)
}

function sameExpr(a: MathNode, b: MathNode, vars: readonly string[]): boolean {
  if (a.toString() === b.toString()) return true
  if (!vars.length) {
    const x = tryConst(a)
    const y = tryConst(b)
    return x != null && y != null && Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x))
  }
  const samples = [...samplesInDomain([a], vars), ...samplesInDomain([b], vars, { seed: 17 })]
  return sameOnSamples(a, b, samples, Math.min(4, samples.length))
}

function sameValue(a: MathNode, v: number): boolean {
  if (collectVars(a).length) return false
  const x = evalNode(a, {})
  return x !== 'undef' && Math.abs(x - v) <= 1e-9 * Math.max(1, Math.abs(v))
}

interface Swap {
  id: LogMistakeId
  base: MathNode
  exponent: MathNode
  result: MathNode
  say: string
}

function swapsOf(p: ExpLogParts): Swap[] {
  return [
    { id: 'log_convert_swapped', base: p.exponent, exponent: p.base, result: p.result, say: 'the base and the exponent traded places' },
    { id: 'log_convert_swapped', base: p.base, exponent: p.result, result: p.exponent, say: 'the exponent and the result traded places' },
    { id: 'log_convert_swapped', base: p.result, exponent: p.exponent, result: p.base, say: 'the base and the result traded places' },
  ]
}

function partsMatch(her: ExpLogParts, base: MathNode, exponent: MathNode, result: MathNode, vars: readonly string[]): boolean {
  const bv = collectVars(base).length ? null : evalNode(base, {})
  const baseOk = bv !== null && bv !== 'undef' ? Math.abs(her.baseValue - bv) <= 1e-9 * Math.max(1, Math.abs(bv)) : sameExpr(her.base, base, vars)
  return baseOk && sameExpr(her.exponent, exponent, vars) && sameExpr(her.result, result, vars)
}

function explanationOf(p: ExpLogParts, target: 'exp' | 'log'): string[] {
  const b = display(baseApp(p))
  const y = displayNode(p.exponent)
  const x = displayNode(p.result)
  return [
    `In ${display(expFormText(p))} the base is ${b}, the exponent is ${y} and the result is ${x}.`,
    `A log IS an exponent: log base ${b} of ${x} is the power ${y}.`,
    target === 'log' ? `Log form: ${display(logFormText(p))}.` : `Exponential form: ${display(expFormText(p))}.`,
  ]
}

/** What each slip writes for this conversion (app syntax), without the ones equal to the answer. */
export function convertMistakes(given: string, vars: readonly VarName[] = ['x', 'y', 'n']): LogMistakeCandidate[] {
  const p = readForm(given, vars)
  if (!p) return []
  const target = p.form === 'exp' ? 'log' : 'exp'
  const out: LogMistakeCandidate[] = []
  for (const s of swapsOf(p)) {
    const sv = collectVars(s.base).length ? null : evalNode(s.base, {})
    if (sv === null || sv === 'undef' || !(sv > 0) || Math.abs(sv - 1) < 1e-12) continue
    if (Math.abs(sv - p.baseValue) < 1e-12 && sameExpr(s.exponent, p.exponent, vars) && sameExpr(s.result, p.result, vars)) continue
    const parts: ExpLogParts = { base: s.base, baseValue: sv, exponent: s.exponent, result: s.result, form: p.form }
    const text = target === 'log' ? logFormText(parts) : expFormText(parts)
    if (out.some((o) => o.text === text)) continue
    out.push({ id: s.id, text, witness: witnessOf(p, s, target), shadows: [] })
  }
  if (target === 'exp') {
    out.push({
      id: 'log_convert_multiplied',
      text: `${wrap(baseApp(p))} * ${wrap(appText(p.exponent))} = ${appText(p.result)}`,
      witness: `${display(logFormText(p))} means the base ${display(baseApp(p))} RAISED to the power ${displayNode(p.exponent)}: ${display(expFormText(p))}, not ${display(baseApp(p))} times ${displayNode(p.exponent)}.`,
      shadows: [],
    })
  }
  return out
}

function witnessOf(p: ExpLogParts, s: Swap, target: 'exp' | 'log'): string {
  const right = target === 'log' ? logFormText(p) : expFormText(p)
  return `In ${display(expFormText(p))} the base is ${display(baseApp(p))}, the exponent is ${displayNode(p.exponent)} and the result is ${displayNode(p.result)}; in your answer ${s.say}. The ${target === 'log' ? 'log' : 'exponential'} form is ${display(right)}.`
}

/**
 * Grade a conversion: `given` is the relation in one form, `answer` her relation, which must be in the
 * other form.
 */
export function gradeConvertForm(given: string, answer: string, vars: readonly VarName[] = ['x', 'y', 'n']): LogGrade {
  const p = readForm(given, vars)
  if (!p) return { verdict: 'unsupported', message: `${given} is neither b^y = x nor log_b(x) = y.` }
  const target = p.form === 'exp' ? 'log' : 'exp'
  const explanation = explanationOf(p, target)
  const raw = (answer ?? '').trim()
  if (!raw) return { verdict: 'invalid', reason: 'unreadable', message: 'Type the equation first.' }
  const parsed = parseStatement(raw, vars)
  if (!parsed.ok) return { verdict: 'invalid', reason: 'unreadable', message: parsed.error.message, position: parsed.error.position, ...(parsed.error.length ? { length: parsed.error.length } : {}) }
  const used = [...new Set([...collectVars(p.exponent), ...collectVars(p.result), ...parsed.statement.vars])]
  const her = readForm(raw, vars)
  if (her && her.form === target) {
    if (partsMatch(her, p.base, p.exponent, p.result, used)) return { verdict: 'correct', message: `Correct: ${display(target === 'log' ? logFormText(p) : expFormText(p))}.`, explanation }
    for (const s of swapsOf(p)) {
      if (partsMatch(her, s.base, s.exponent, s.result, used)) {
        const w = witnessOf(p, s, target)
        return { verdict: 'mistake', mistake: s.id, pattern: patternHit(s.id, w), witness: w, explanation }
      }
    }
    return { verdict: 'wrong', message: `Check each part: the base of ${display(expFormText(p))} is ${display(baseApp(p))}, and a log equals the EXPONENT.`, explanation }
  }
  if (her && her.form === p.form && partsMatch(her, p.base, p.exponent, p.result, used)) {
    return { verdict: 'invalid', reason: 'not_in_form', message: target === 'log' ? 'That is the same equation, still in exponential form. Write it with a log: log_b(result) = exponent.' : 'That is the same equation, still in log form. Write it as a power: base^exponent = result.' }
  }
  if (target === 'exp') {
    const r = singleRelation(parsed.statement)
    if (r) {
      for (const [s, o] of [
        [r.lhs, r.rhs],
        [r.rhs, r.lhs],
      ] as const) {
        const fs = productFactors(s)
        if (fs.length !== 2) continue
        const [f, g] = fs as [MathNode, MathNode]
        const okBase = (n: MathNode) => sameValue(n, p.baseValue)
        if (((okBase(f) && sameExpr(g, p.exponent, used)) || (okBase(g) && sameExpr(f, p.exponent, used))) && sameExpr(o, p.result, used)) {
          const w = `${display(logFormText(p))} means the base ${display(baseApp(p))} RAISED to the power ${displayNode(p.exponent)}: ${display(expFormText(p))}, not ${display(baseApp(p))} times ${displayNode(p.exponent)}.`
          return { verdict: 'mistake', mistake: 'log_convert_multiplied', pattern: patternHit('log_convert_multiplied', w), witness: w, explanation }
        }
      }
    }
  }
  // The same equation solved or rearranged, but not in the asked form (log(x) = 2 answered x = 100).
  const givenStmt = parseStatement(given, vars)
  if (givenStmt.ok && givenStmt.statement.vars.length === 1 && parsed.statement.vars.length <= 1) {
    const v = givenStmt.statement.vars[0]!
    const a = solutionsWide(givenStmt.statement, v)
    const b = solutionsWide(parsed.statement, v)
    if (a.length && a.length === b.length && a.every((t, i) => Math.abs(t - b[i]!) <= 1e-9 * Math.max(1, Math.abs(t)))) {
      return {
        verdict: 'invalid',
        reason: 'not_in_form',
        message: target === 'log' ? 'That is the same equation, but the question asks for log form: log_base(result) = exponent.' : 'That is the same equation, but the question asks for exponential form: base^exponent = result.',
      }
    }
  }
  return {
    verdict: 'wrong',
    message: target === 'log' ? 'Write it as log_base(result) = exponent: one log on one side, the exponent on the other.' : 'Write it as base^exponent = result: the base raised to the value of the log.',
    explanation,
  }
}
