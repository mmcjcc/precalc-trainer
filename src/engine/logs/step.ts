/**
 * Relation mode for exponential and log equations (and inequalities), one line against the previous one.
 *
 * How a step is judged (the textbook method: solve, then check every answer in the ORIGINAL equation):
 *  - Equations: the two lines must have the same solutions INSIDE THE DOMAIN OF THE ORIGINAL (every log
 *    input positive, every log base positive and not 1, no denominator 0, no even root of a negative).
 *      · A line that also has solutions outside that domain is legal, with caveat 'extraneous_check' and
 *        the info pattern log_check_answers: log x + log(x − 3) = 1 → log(x(x − 3)) = 1 lets in x = −2.
 *      · Dropping such a candidate is legal: x = 5 or x = −2 → x = 5 ("rejected x = −2").
 *      · Losing a solution inside the domain is a mistake: ln(x²) = 4 → 2 ln x = 4 loses x = −e²
 *        (log_power_abs), x = 5 or x = −2 → x = −2 drops a real answer (log_valid_rejected).
 *  - Inequalities: compared on the whole line, so the domain has to be carried in the line itself
 *    (log x < 2 → x < 100 is wrong at x = −1; 0 < x < 100 is right).
 * Solution sets come from the wide grid (wide.ts), so a half-life answer t ≈ 9953 is compared too.
 */
import type { ChipId, StepContext, VarName } from '@/shared/types'
import { REWRITE_CHIPS } from '@/shared/types'
import { buildCounterexample, pickNicest, survivesSnap } from '../counterexample'
import { collectVars, compileExpression, evalNode, symbolName, type MathNode } from '../math'
import { patternHit } from '../matchers/catalog'
import { runMatchers } from '../matchers'
import { parseStatement, singleRelation, statementToPlain } from '../parse'
import type { Mismatch } from '../roots'
import { isInequalityStatement, type Scope } from '../samples'
import { verifyStatementsGeneric } from '../step'
import { detectMove } from '../transforms'
import type { Relation, Statement } from '../types'
import { domain1D, sameOnSamples, samplesInDomain, varsOfNodes } from './equiv'
import { relationSlips, type RelSlip } from './relslips'
import { slipWitness } from './rewrite'
import { classifyLogRewrite, moveSentence } from './rules'
import { asExpPower, asLogCall, hasLogOrExp, isExpLogNode, logCallsOf, productFactors } from './slips'
import { display, displayNode, fixed, joinAnd, num, numText } from './text'
import type { DecimalSpec, ExtraneousNote, LogMove, LogProperty, LogStepContext, LogStepResult } from './types'
import { compareWide, inDomain, sidesOf, solutionsWide, type Domain1D, type WideMismatch } from './wide'

const DEFAULT_VARS: VarName[] = ['x']

function parseError(which: 'prev' | 'next', e: { message: string; position: number; length?: number }): LogStepResult {
  const message = which === 'prev' ? `Previous line: ${e.message}` : e.message
  return { ok: false, verdict: 'parse_error', acceptableChips: [], parseError: { message, position: e.position, ...(e.length ? { length: e.length } : {}) } }
}

function allEqualities(s: Statement): boolean {
  return s.disjuncts.every((c) => c.every((r) => r.op === '='))
}

/** The tolerance a DecimalSpec allows (half a unit in the last place for `places`). */
export function decimalTolerance(d: DecimalSpec): number {
  return 'places' in d ? 0.5 * 10 ** -d.places + 1e-12 : d.tolerance
}

// ---------------------------------------------------------------------------
// Extraneous candidates
// ---------------------------------------------------------------------------

/** Why t is outside the original's domain: the first log input (or base) that is not positive there. */
export function extraneousNote(original: Statement, v: string, t: number): ExtraneousNote {
  const scope = { [v]: t }
  const text = numText(t)
  for (const side of sidesOf(original)) {
    for (const call of logCallsOf(side)) {
      const a = evalNode(call.arg, scope)
      if (a === 'undef' || a <= 0) {
        const shown = displayNode(call.node)
        const av = a === 'undef' ? 'undefined' : num(a)
        return {
          value: t,
          text,
          argument: call.arg.toString(),
          argumentValue: av,
          sentence: `${v} = ${num(t)} makes ${shown} undefined: its input is ${av}, and a log needs a positive input.`,
        }
      }
      if (call.base) {
        const b = evalNode(call.base, scope)
        if (b === 'undef' || b <= 0 || Math.abs(b - 1) < 1e-12) {
          return { value: t, text, argument: call.base.toString(), argumentValue: b === 'undef' ? 'undefined' : num(b), sentence: `${v} = ${num(t)} makes the base of ${displayNode(call.node)} ${b === 'undef' ? 'undefined' : num(b)}, and a log base must be positive and not 1.` }
        }
      }
    }
  }
  for (const side of sidesOf(original)) {
    if (evalNode(side, scope) === 'undef') {
      return { value: t, text, argument: side.toString(), argumentValue: 'undefined', sentence: `${v} = ${num(t)} makes ${displayNode(side)} undefined in the original equation.` }
    }
  }
  return { value: t, text, argument: '', argumentValue: '', sentence: `${v} = ${num(t)} does not solve the original equation.` }
}

// ---------------------------------------------------------------------------
// Value lines and rounding
// ---------------------------------------------------------------------------

/** "x = 2.807" → 2.807 (the line gives the variable one constant value), else null. */
function valueOfLine(s: Statement, v: string): { value: number; text: string } | null {
  const r = singleRelation(s)
  if (!r || r.op !== '=') return null
  for (const [a, b, bSrc] of [
    [r.lhs, r.rhs, r.rhsSrc],
    [r.rhs, r.lhs, r.lhsSrc],
  ] as const) {
    if (symbolName(a) !== v || collectVars(b).length) continue
    const val = evalNode(b, {})
    if (val !== 'undef') return { value: val, text: bSrc }
  }
  return null
}

/** Decimal places typed in a numeral ("2.807" → 3), or null when the text is not a plain decimal. */
export function decimalPlaces(text: string): number | null {
  const m = text.trim().match(/^[-+]?\d*\.(\d+)$/)
  return m ? m[1]!.length : null
}

// ---------------------------------------------------------------------------
// Matching her line to a slip
// ---------------------------------------------------------------------------

function sideMatch(a: Relation, b: Relation, samples: readonly Scope[]): boolean {
  const min = Math.min(4, samples.length)
  const same = (x: MathNode, y: MathNode) => sameOnSamples(x, y, samples, min)
  if (a.op === b.op && same(a.lhs, b.lhs) && same(a.rhs, b.rhs)) return true
  const rev: Record<string, string> = { '=': '=', '<': '>', '>': '<', '<=': '>=', '>=': '<=' }
  return rev[a.op] === b.op && same(a.lhs, b.rhs) && same(a.rhs, b.lhs)
}

/** (L − R) of one relation is a constant multiple of the other's on the samples. */
function proportional(a: Relation, b: Relation, samples: readonly Scope[]): number | null {
  const ratios: number[] = []
  for (const s of samples) {
    const al = evalNode(a.lhs, s)
    const ar = evalNode(a.rhs, s)
    const bl = evalNode(b.lhs, s)
    const br = evalNode(b.rhs, s)
    const da = al === 'undef' || ar === 'undef' ? null : al - ar
    const db = bl === 'undef' || br === 'undef' ? null : bl - br
    if ((da === null) !== (db === null)) return null
    if (da === null || db === null) continue
    const scale = Math.max(1, Math.abs(al as number), Math.abs(ar as number), Math.abs(bl as number), Math.abs(br as number))
    if (Math.abs(db) <= 1e-9 * scale) {
      if (Math.abs(da) > 1e-7 * scale) return null
      continue
    }
    ratios.push(da / db)
  }
  if (ratios.length < 4) return null
  const k = ratios[0]!
  if (Math.abs(k) < 1e-12) return null
  return ratios.every((r) => Math.abs(r - k) <= 1e-7 * Math.max(1, Math.abs(k))) ? k : null
}

function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((x, i) => Math.abs(x - b[i]!) <= 1e-7 * Math.max(1, Math.abs(x)))
}

/** Her line divides one log by another (log a / log b): the change-of-base reading of a swapped answer. */
function hasLogRatio(s: Statement): boolean {
  let found = false
  for (const side of sidesOf(s)) {
    side.traverse((n) => {
      if (n.type !== 'OperatorNode' || (n as unknown as { op: string }).op !== '/') return
      const [a, b] = (n as unknown as { args: MathNode[] }).args
      if (a && b && (asLogCall(a) || logCallsOf(a).length) && asLogCall(b)) found = true
    })
  }
  return found
}

/**
 * The first slip of `prev` that produces her line: the same sides (any legal rewriting of each side), or
 * the same relation up to a constant factor, or (equations) the same solutions as the slipped line, which
 * covers "the slip, then correct algebra" (log x + log(x − 3) = 1 → x + x − 3 = 10). When several slips
 * give her solutions, the one whose shape matches her line wins (a ratio of logs reads as an inverted
 * change of base rather than a swapped base).
 */
function matchSlip(slips: readonly RelSlip[], prevS: Statement, nextS: Statement, v: string, samples: readonly Scope[]): RelSlip | null {
  const n = singleRelation(nextS)
  if (n) {
    const sides = slips.filter((s) => {
      const c = singleRelation(s.stmt)
      return c !== null && sideMatch(n, c, samples)
    })
    if (sides.length) return preferred(sides, nextS)
    const prop = slips.filter((s) => {
      const c = singleRelation(s.stmt)
      if (!c || c.op !== n.op) return false
      const k = proportional(n, c, samples)
      return k != null && (n.op === '=' || k > 0)
    })
    if (prop.length) return preferred(prop, nextS)
  }
  if (!allEqualities(nextS)) return null
  const solN = solutionsWide(nextS, v)
  if (!solN.length || solN.length > 8) return null
  const solP = solutionsWide(prevS, v)
  const hits: RelSlip[] = []
  const seen = new Set<string>()
  for (const s of slips) {
    if (!allEqualities(s.stmt)) continue
    const key = statementToPlain(s.stmt)
    if (seen.has(key)) continue
    seen.add(key)
    const solC = solutionsWide(s.stmt, v)
    if (!solC.length || sameNumbers(solC, solP)) continue
    if (sameNumbers(solC, solN)) hits.push(s)
  }
  return hits.length ? preferred(hits, nextS) : null
}

/** Among slips that all produce her line, the one whose shape fits it: a ratio of logs is an inverted change of base. */
function preferred(hits: readonly RelSlip[], nextS: Statement): RelSlip {
  if (hasLogRatio(nextS)) {
    const inverted = hits.find((h) => h.id === 'log_change_base_inverted')
    if (inverted) return inverted
    const swapped = hits.find((h) => h.id === 'log_convert_swapped')
    if (swapped) {
      return {
        ...swapped,
        id: 'log_change_base_inverted',
        witness: `${swapped.witness} Written as a quotient of logs, the log of the number goes on top and the log of the base on the bottom.`,
      }
    }
  }
  return hits[0]!
}

function relSlipWitness(s: RelSlip, v: string, samples: readonly Scope[]): string {
  if (s.witness) return s.witness
  return s.slip ? slipWitness(s.slip, [v], samples) : ''
}

// ---------------------------------------------------------------------------
// Naming the legal move
// ---------------------------------------------------------------------------

function classifyStep(prevS: Statement, nextS: Statement, samples: readonly Scope[], rejected: readonly ExtraneousNote[]): LogMove {
  const props: LogProperty[] = []
  if (rejected.length) props.push('reject_extraneous')
  const o = singleRelation(prevS)
  const n = singleRelation(nextS)
  if (o && n) {
    const min = Math.min(4, samples.length)
    const same = (x: MathNode, y: MathNode) => sameOnSamples(x, y, samples, min)
    const pairs: [MathNode, MathNode, MathNode, MathNode][] = [
      [o.lhs, o.rhs, n.lhs, n.rhs],
      [o.lhs, o.rhs, n.rhs, n.lhs],
    ]
    for (const [ol, or, nl, nr] of pairs) {
      // A log of both sides.
      const lo = asLogCall(nl)
      const ro = asLogCall(nr)
      if (lo && ro && same(lo.arg, ol) && same(ro.arg, or)) return finish([...props, 'take_log'])
      for (const k of ['log', 'ln']) {
        const tl = buildSafe(`${k}(${ol.toString()})`)
        const tr = buildSafe(`${k}(${or.toString()})`)
        if (tl && tr && same(tl, nl) && same(tr, nr)) return finish([...props, 'take_log'])
      }
      // Exponential form ↔ log form.
      const lc = asLogCall(ol)
      if (lc && !collectVars(or).length && same(nl, lc.arg)) {
        const b = lc.kind === 'ln' ? 'e' : lc.kind === 'log10' ? '10' : `(${lc.base!.toString()})`
        const p = buildSafe(`${b} ^ (${or.toString()})`)
        if (p && same(nr, p)) return finish([...props, 'convert_form'])
      }
      const pe = asExpPower(ol)
      if (pe && !collectVars(or).length && same(nl, pe.exponent)) {
        const l = buildSafe(pe.viaExp ? `ln(${or.toString()})` : `log(${or.toString()}, ${pe.baseText})`)
        if (l && same(nr, l)) return finish([...props, 'convert_form'])
      }
      // One-to-one: log_b A = log_b B → A = B, bᴬ = bᴮ → A = B.
      const la = asLogCall(ol)
      const lb = asLogCall(or)
      if (la && lb && same(nl, la.arg) && same(nr, lb.arg)) return finish([...props, 'one_to_one'])
      const ea = asExpPower(ol)
      const eb = asExpPower(or)
      if (ea && eb && Math.abs(ea.baseValue - eb.baseValue) < 1e-12 * ea.baseValue && same(nl, ea.exponent) && same(nr, eb.exponent)) return finish([...props, 'one_to_one'])
      // One side rewritten.
      if (same(ol, nl) && !same(or, nr)) return finish([...props, ...classifyLogRewrite(or, nr, samples).properties])
      if (same(or, nr) && !same(ol, nl)) return finish([...props, ...classifyLogRewrite(ol, nl, samples).properties])
    }
    const det = detectMove(prevS, nextS, { seed: 1 })
    if (det && (det.kind === 'accept' || det.kind === 'defer')) return finish([...props, 'both_sides'], logConstantDetail(det.move.detail, det.move.constant, prevS))
  }
  return finish(props.length ? props : ['rewrite'])
}

function finish(props: LogProperty[], detail?: string): LogMove {
  const uniq = [...new Set(props.filter((p) => p !== 'rewrite' || props.length === 1))]
  return { properties: uniq, detail: detail && uniq.length === 1 ? detail : moveSentence(uniq) }
}

/** "multiplied both sides by 3.322" → "divided both sides by log(2)" when the number is a log of the line. */
function logConstantDetail(detail: string, constant: number | undefined, prevS: Statement): string {
  if (constant == null || !/both sides by/.test(detail)) return detail
  for (const side of sidesOf(prevS)) {
    for (const f of productFactors(side)) {
      if (collectVars(f).length || !logCallsOf(f).length) continue
      const fv = evalNode(f, {})
      if (fv === 'undef' || fv === 0) continue
      const tail = detail.replace(/^.*both sides by [^ ]+/, '')
      if (Math.abs(1 / fv - constant) <= 1e-9 * Math.max(1, Math.abs(constant)) || Math.abs(fv - constant) <= 1e-9 * Math.max(1, Math.abs(constant))) {
        const divided = Math.abs(1 / fv - constant) <= 1e-9 * Math.max(1, Math.abs(constant))
        return `${divided ? 'divided' : 'multiplied'} both sides by ${displayNode(f)}${tail}`
      }
    }
  }
  return detail
}

/** A tree from math.js text built out of node.toString() pieces (not student text). */
function buildSafe(text: string): MathNode | null {
  try {
    return compileExpression(text)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// The checker
// ---------------------------------------------------------------------------

function chipsFor(prevS: Statement, nextS: Statement): { detected: LogStepResult['detected']; chips: ChipId[] } {
  const det = detectMove(prevS, nextS, { seed: 1 })
  if (det && (det.kind === 'accept' || det.kind === 'defer')) {
    return { detected: det.move, chips: det.move.exact ? det.chips : [...new Set([...det.chips, ...REWRITE_CHIPS])] }
  }
  return { detected: undefined, chips: [...REWRITE_CHIPS] }
}

/**
 * Is `next` a legal next line after `prev`? One variable; a line with more variables goes to the engine's
 * general step checker. See the file comment for how extraneous answers are handled.
 */
export function checkLogStep(prev: string, next: string, ctx: LogStepContext = {}): LogStepResult {
  const vars = ctx.vars ?? DEFAULT_VARS
  const pp = parseStatement(prev, vars)
  if (!pp.ok) return parseError('prev', pp.error)
  const pn = parseStatement(next, vars)
  if (!pn.ok) return parseError('next', pn.error)
  const po = ctx.original ? parseStatement(ctx.original, vars) : null
  const origS = po && po.ok ? po.statement : pp.statement
  const used = [...new Set([...pp.statement.vars, ...pn.statement.vars, ...origS.vars])].sort()
  if (used.length !== 1) {
    const sc: StepContext = { vars, seed: ctx.seed ?? 1 }
    return verifyStatementsGeneric(pp.statement, pn.statement, sc)
  }
  return checkLogStatements(pp.statement, pn.statement, origS, ctx)
}

/**
 * Lines the engine's general step checker hands to this one: a log anywhere, or an exponential with the
 * variable in the exponent (b^x, e^x, exp(x)), in a one-variable line.
 */
export function routesToLogs(oldS: Statement, newS: Statement): boolean {
  const vars = new Set([...oldS.vars, ...newS.vars])
  if (vars.size !== 1) return false
  return [...sidesOf(oldS), ...sidesOf(newS)].some(isExpLogNode)
}

/** `checkLogStep` on parsed statements of one variable (the engine's verifyStep routes log lines here). */
export function checkLogStatements(prevS: Statement, nextS: Statement, origS: Statement, ctx: LogStepContext = {}): LogStepResult {
  const used = [...new Set([...prevS.vars, ...nextS.vars, ...origS.vars])].sort()
  const normalized = { text: statementToPlain(nextS), latex: '' }
  if (used.length !== 1) return verifyStatementsGeneric(prevS, nextS, { vars: ctx.vars ?? DEFAULT_VARS, seed: ctx.seed ?? 1 })
  const v = used[0]!
  const equation = allEqualities(prevS) && allEqualities(nextS)
  const D0: Domain1D = domain1D(sidesOf(origS), v, ctx.assumePositive)
  const inScope = equation ? (t: number) => inDomain(D0, t) : ctx.assumePositive ? (t: number) => t > 0 : undefined
  const cmp = compareWide(prevS, nextS, v, { seed: ctx.seed, inScope, extraPoints: D0.boundaries })
  const samples = [...samplesInDomain(sidesOf(prevS), [v], { seed: ctx.seed }), ...samplesInDomain(sidesOf(nextS), [v], { seed: (ctx.seed ?? 3) + 1 })]

  if (!cmp.mismatches.length) {
    if (cmp.informative < 3) {
      return { ok: false, verdict: 'undecidable', acceptableChips: [], normalized, message: 'These lines are not defined for any value I can try, so I cannot check the step.' }
    }
    const extraneous = equation ? cmp.newTrue.filter((t) => !inDomain(D0, t) && !cmp.oldTrue.some((o) => near(o, t))).map((t) => extraneousNote(origS, v, t)) : []
    const rejected = equation ? cmp.oldTrue.filter((t) => !inDomain(D0, t) && !cmp.newTrue.some((o) => near(o, t))).map((t) => extraneousNote(origS, v, t)) : []
    const logMove = classifyStep(prevS, nextS, samples, rejected)
    // Arithmetic on both sides keeps the engine's own move and chips; a log move is a rewrite family.
    const generic = logMove.properties.includes('both_sides') ? chipsFor(prevS, nextS) : null
    const result: LogStepResult = {
      ok: true,
      verdict: extraneous.length ? 'extraneous_superset' : 'equivalent',
      acceptableChips: generic?.chips ?? [...REWRITE_CHIPS],
      normalized,
      logMove,
      detected: generic?.detected ? { ...generic.detected, detail: logMove.detail } : { tag: 'simplify', chip: 'simplify', exact: false, detail: logMove.detail },
    }
    if (extraneous.length) {
      result.caveat = 'extraneous_check'
      result.extraneous = extraneous
      result.pattern = patternHit('log_check_answers', `${joinAnd(extraneous.map((e) => `${v} = ${num(e.value)}`))} ${extraneous.length > 1 ? 'fit' : 'fits'} this line but not the original: ${extraneous.map((e) => e.sentence).join(' ')} Check every answer in the original at the end.`)
    }
    if (rejected.length) {
      result.rejected = rejected
      result.logMove = { properties: logMove.properties, detail: `rejected ${joinAnd(rejected.map((e) => `${v} = ${num(e.value)}`))}: ${rejected.map((e) => e.sentence).join(' ')}` }
    }
    return result
  }

  // A rounded last line.
  const val = equation ? valueOfLine(nextS, v) : null
  const inside = cmp.oldTrue.filter((t) => inDomain(D0, t))
  if (val && inside.length === 1) {
    const s = inside[0]!
    const places = decimalPlaces(val.text)
    if (ctx.decimal) {
      const tol = decimalTolerance(ctx.decimal)
      if (Math.abs(val.value - s) <= tol) {
        return {
          ok: true,
          verdict: 'equivalent',
          acceptableChips: [...REWRITE_CHIPS],
          normalized,
          logMove: { properties: ['rounded'], detail: `rounded ${v} to ${fixedFor(ctx.decimal, s)}` },
          detected: { tag: 'simplify', chip: 'simplify', exact: false, detail: `rounded to ${fixedFor(ctx.decimal, s)}` },
        }
      }
      if (places != null && Math.abs(val.value - s) <= 0.5 * 10 ** -places + 1e-12) {
        return { ok: false, verdict: 'not_equivalent', acceptableChips: [], normalized, message: `${display(val.text)} is rounded too far: ${'places' in ctx.decimal ? `give ${ctx.decimal.places} decimal place${ctx.decimal.places === 1 ? '' : 's'}` : 'keep more decimal places'}.` }
      }
    } else if (places != null && places >= 1 && Math.abs(val.value - s) <= 0.5 * 10 ** -places + 1e-12) {
      return {
        ok: false,
        verdict: 'not_equivalent',
        acceptableChips: [],
        normalized,
        notExact: true,
        message: `${display(val.text)} is a calculator approximation. This problem wants the exact answer: keep it written with logs (or e) instead of a decimal.`,
      }
    }
  }

  const lost = cmp.mismatches.every((m) => m.old === true && m.new !== true)
  const gained = cmp.mismatches.every((m) => m.new === true && m.old !== true)
  const verdict = lost ? 'lost_subset' : gained ? 'extraneous_superset' : 'not_equivalent'
  const result: LogStepResult = { ok: false, verdict, acceptableChips: [], normalized }

  // Dropped a real answer from a list of candidates (judged against the original's logs).
  const origHasLogs = sidesOf(origS).some((s) => logCallsOf(s).length > 0)
  if (lost && equation && prevS.disjuncts.length >= 2 && origHasLogs) {
    const lostPts = dedupeNear(cmp.mismatches.map((m) => m.scope[v]!))
    const sentences = lostPts.map((t) => `${v} = ${num(t)} keeps every log in the original defined${logInputsText(origS, v, t)}, and it solves the original, so it stays.`)
    result.pattern = patternHit('log_valid_rejected', `${sentences.join(' ')} Only an answer that makes a log’s input 0 or negative is extraneous.`)
  }
  if (!result.pattern) {
    const r = singleRelation(prevS)
    const slip = r && (hasLogOrExp(r.lhs) || hasLogOrExp(r.rhs)) ? matchSlip(relationSlips(r), prevS, nextS, v, samples) : null
    if (slip) result.pattern = patternHit(slip.id, relSlipWitness(slip, v, samples))
  }
  if (!result.pattern) {
    const m = runMatchers(prevS, nextS, { seed: ctx.seed })
    if (m) result.pattern = m
  }
  const ce = counterexampleOf(prevS, nextS, cmp.mismatches, v, isInequalityStatement(prevS) || isInequalityStatement(nextS))
  if (ce) result.counterexample = ce
  return result
}

function fixedFor(d: DecimalSpec, s: number): string {
  return 'places' in d ? fixed(s, d.places) : num(s)
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a))
}

function dedupeNear(pts: number[]): number[] {
  const out: number[] = []
  for (const p of pts.sort((a, b) => a - b)) if (!out.some((q) => near(p, q))) out.push(p)
  return out
}

/** ": log(−2 + 5) = log(3)" style detail of the original's log inputs at t. */
function logInputsText(original: Statement, v: string, t: number): string {
  const calls = sidesOf(original).flatMap((s) => logCallsOf(s))
  if (!calls.length) return ''
  const parts = calls.slice(0, 3).map((c) => {
    const a = evalNode(c.arg, { [v]: t })
    return `${displayNode(c.arg)} is ${a === 'undef' ? 'undefined' : num(a)}`
  })
  return ` (${parts.join(', ')})`
}

function counterexampleOf(oldS: Statement, newS: Statement, mismatches: readonly WideMismatch[], v: string, inequality: boolean) {
  const ms = mismatches as unknown as Mismatch[]
  const shown = ms.filter((m) => survivesSnap(oldS, newS, m, [v]))
  const m = pickNicest(shown.length ? shown : ms, [v])
  return m ? buildCounterexample(oldS, newS, m, [v], inequality ? 'inequality' : 'equation') : undefined
}

/**
 * The SAME line up to rewrites, judged on the domains (for progress anchoring against canonical lines):
 * relation by relation the sides are the same function (defined at the same sampled points, equal there),
 * or swapped with the symbol reversed; branches of "or" lines match in any order. Not a solution-set
 * comparison: 2^x = 8 and x = 3 are different lines.
 */
export function sameLogLine(a: string, b: string, vars: readonly VarName[] = DEFAULT_VARS): boolean {
  const pa = parseStatement(a, vars)
  const pb = parseStatement(b, vars)
  if (!pa.ok || !pb.ok) return false
  const used = varsOfNodes([...sidesOf(pa.statement), ...sidesOf(pb.statement)])
  const samples = [...samplesInDomain(sidesOf(pa.statement), used), ...samplesInDomain(sidesOf(pb.statement), used, { seed: 29 })]
  const ra = pa.statement.disjuncts.map((c) => (c.length === 1 ? c[0]! : null))
  const rb = pb.statement.disjuncts.map((c) => (c.length === 1 ? c[0]! : null))
  if (ra.length !== rb.length || ra.some((r) => !r) || rb.some((r) => !r)) return false
  const taken = rb.map(() => false)
  for (const x of ra) {
    const j = rb.findIndex((y, k) => !taken[k] && sideMatch(x!, y!, samples))
    if (j < 0) return false
    taken[j] = true
  }
  return true
}
