/**
 * Relation-mode step verification (BUILD_GUIDE §4, engine-design §4–§8).
 *
 *   Tier 1  transforms.detectMove — structural move (accept / reject with pattern / defer)
 *   Tier 2  roots.compareSets1D (one free variable) or slicing.compareSets2D (two) — the solution
 *           sets, with ctx.seed and ctx.checkValue threaded through
 *   Tier 3  matchers.runMatchers — explain a rejection; else the nicest counterexample
 *
 * `undecidable` is never accepted.
 */
import type { ChipId, Counterexample, PatternHit, StepContext, StepResult, Verdict } from '@/shared/types'
import { REWRITE_CHIPS } from '@/shared/types'
import { buildCounterexample, pickNicest, pointDisplay, survivesSnap, type CounterexampleKind } from './counterexample'
import { isFn, isOp, nodeArgs, tryConst, walkNode, type MathNode } from './math'
import { runMatchers } from './matchers'
import { patternHit } from './matchers/catalog'
import { parseStatement, singleRelation, statementToPlain } from './parse'
import { compareSets1D, GRID_N_1D, type Mismatch } from './roots'
import { isInequalityStatement, type Scope } from './samples'
import { compareSets2D, type SliceMismatch } from './slicing'
import { detectMove, sameLine, squaringRestriction, swapXY, type Detection } from './transforms'
import type { Statement } from './types'

interface Tier2 {
  verdict: Verdict
  mismatches: (Mismatch | SliceMismatch)[]
  kind: CounterexampleKind
  vars: string[]
}

function unionVars(a: Statement, b: Statement): string[] {
  return [...new Set([...a.vars, ...b.vars])].sort()
}

/**
 * Tier 2. "Extraneous" / "lost" solutions are equation vocabulary: for inequalities a superset or
 * subset is reported as plain `not_equivalent` (e.g. x < 3 → x <= 3 differs at x = 3).
 */
function compareSolutionSets(oldS: Statement, newS: Statement, ctx: StepContext): Tier2 {
  const vars = unionVars(oldS, newS)
  const inequality = isInequalityStatement(oldS) || isInequalityStatement(newS)
  const collapse = (v: Verdict): Verdict => (inequality && (v === 'extraneous_superset' || v === 'lost_subset') ? 'not_equivalent' : v)
  if (vars.length >= 2) {
    const c = compareSets2D(oldS, newS, vars, ctx.seed, ctx.checkValue)
    return { verdict: collapse(c.verdict), mismatches: c.mismatches, kind: 'twoVar', vars }
  }
  const v = vars[0] ?? 'x'
  const extra = ctx.checkValue != null ? [ctx.checkValue] : []
  const c = compareSets1D(oldS, newS, v, {}, ctx.seed, GRID_N_1D, extra)
  const kind: CounterexampleKind = inequality ? 'inequality' : 'equation'
  return { verdict: collapse(c.verdict), mismatches: c.mismatches, kind, vars: [v] }
}

function counterexampleOf(oldS: Statement, newS: Statement, t2: Tier2): Counterexample | undefined {
  const shown = t2.mismatches.filter((mm) => survivesSnap(oldS, newS, mm, t2.vars))
  const m = pickNicest(shown.length ? shown : t2.mismatches, t2.vars)
  return m ? buildCounterexample(oldS, newS, m, t2.vars, t2.kind) : undefined
}

function mentionsEvenPowerOrAbs(stmt: Statement): boolean {
  let found = false
  const check = (n: MathNode) => {
    if (isFn(n, 'abs') || isFn(n, 'sqrt')) found = true
    if (isOp(n, '^')) {
      const e = nodeArgs(n)[1]
      const ev = e ? tryConst(e) : null
      if (ev != null && Number.isInteger(ev) && ev % 2 === 0) found = true
    }
  }
  for (const clause of stmt.disjuncts) {
    for (const rel of clause) {
      walkNode(rel.lhs, check)
      walkNode(rel.rhs, check)
    }
  }
  return found
}

function unique(chips: ChipId[]): ChipId[] {
  return [...new Set(chips)]
}

/**
 * If `next` is the SAME line as a canonical line and `prev` the same line as the one before it
 * (sides rewritten, or swapped with the symbol reversed — never merely an equivalent relation, or
 * `2x + 8 > 10 → 2x > 2` would anchor on the later `2x > 2 → x > 1`), the canonical pair's move is
 * preferred for chip grading (the canonical lines are plain strings, so the detectors run on that
 * pair to infer the chip).
 */
function anchorCanonical(oldS: Statement, newS: Statement, ctx: StepContext): { move: Detection & { kind: 'accept' | 'defer' } } | null {
  const lines = ctx.canonical
  if (!lines || lines.length < 2) return null
  const opts = { seed: ctx.seed, checkValue: ctx.checkValue }
  const parsed = lines.map((l) => parseStatement(l, ctx.vars))
  for (let i = parsed.length - 1; i >= 1; i--) {
    const ci = parsed[i]!
    const cp = parsed[i - 1]!
    if (!ci.ok || !cp.ok) continue
    if (!sameLine(ci.statement, newS, opts)) continue
    if (!sameLine(cp.statement, oldS, opts)) continue
    const d = detectMove(cp.statement, ci.statement, { seed: ctx.seed, checkValue: ctx.checkValue, allowSwap: ctx.allowSwap })
    if (d && (d.kind === 'accept' || d.kind === 'defer')) return { move: d }
    return null
  }
  return null
}

function acceptResult(
  oldS: Statement,
  newS: Statement,
  ctx: StepContext,
  det: (Detection & { kind: 'accept' | 'defer' }) | null,
  verdict: Verdict,
  extras: Partial<StepResult> = {},
): StepResult {
  let move = det?.move
  let chips: ChipId[] = det ? (det.move.exact ? det.chips : unique([...det.chips, ...REWRITE_CHIPS])) : []
  const anchor = anchorCanonical(oldS, newS, ctx)
  if (anchor) {
    const am = anchor.move
    const anchorChips = am.move.exact ? am.chips : unique([...am.chips, ...REWRITE_CHIPS])
    if (!move || am.move.chip !== move.chip) {
      move = am.move
      chips = unique([...anchorChips, ...chips])
    }
  }
  const result: StepResult = {
    ok: true,
    verdict,
    acceptableChips: chips,
    normalized: { text: statementToPlain(newS), latex: '' },
    ...extras,
  }
  if (move) result.detected = move
  return result
}

function rejectResult(
  newS: Statement,
  verdict: Verdict,
  opts: { pattern?: PatternHit; counterexample?: Counterexample; detected?: Detection['kind'] extends never ? never : StepResult['detected'] },
): StepResult {
  const r: StepResult = {
    ok: false,
    verdict,
    acceptableChips: [],
    normalized: { text: statementToPlain(newS), latex: '' },
  }
  if (opts.pattern) r.pattern = opts.pattern
  if (opts.counterexample) r.counterexample = opts.counterexample
  if (opts.detected) r.detected = opts.detected
  return r
}

function lostWitness(ce: Counterexample | undefined): string | undefined {
  return ce ? `You lost ${ce.pointDisplay} — it solves the original but not your new line.` : undefined
}

function extraWitness(ce: Counterexample | undefined): string | undefined {
  if (!ce) return undefined
  const why = ce.oldTruth === 'undef' ? 'the original is undefined there' : 'the original is false there'
  return `${ce.pointDisplay} fits your new line but ${why} — check every answer in the original at the end.`
}

/** Verify a parsed step. `verifyStep` wraps this with parsing. */
export function verifyStatements(oldS: Statement, newS: Statement, ctx: StepContext): StepResult {
  const result = verifyCore(oldS, newS, ctx)
  if (result.ok || !ctx.allowSwap) return result
  return swapWithMove(oldS, newS, ctx) ?? result
}

/**
 * The swap and a solving move in one line (y = −2x − 6 → y = (x + 6)/−2). Tier 1 only accepts a
 * swap plus same-side rewrites; when that and the plain comparison both fail, compare the renamed
 * old line with the new one. Equal solution sets → accepted as the swap, with the solving move's
 * chip also graded correct when Tier 1 can name it.
 */
function swapWithMove(oldS: Statement, newS: Statement, ctx: StepContext): StepResult | null {
  const hasXY = (s: Statement) => s.vars.includes('x') && s.vars.includes('y')
  if (!hasXY(oldS) || !hasXY(newS)) return null
  const mapped = swapXY(oldS)
  if (compareSolutionSets(mapped, newS, ctx).verdict !== 'equivalent') return null
  const det = detectMove(mapped, newS, { seed: ctx.seed, checkValue: ctx.checkValue })
  const solving = det && (det.kind === 'accept' || det.kind === 'defer') ? det.move : null
  const detail = `swapped x and y and ${solving ? solving.detail : 'rearranged in the same line'}`
  return {
    ok: true,
    verdict: 'equivalent_by_rename',
    swapped: true,
    detected: { tag: 'swap_xy', chip: 'swap_xy', exact: true, detail },
    acceptableChips: unique(['swap_xy', ...(solving ? [solving.chip] : [])]),
    normalized: { text: statementToPlain(newS), latex: '' },
  }
}

function verifyCore(oldS: Statement, newS: Statement, ctx: StepContext): StepResult {
  const det = detectMove(oldS, newS, { seed: ctx.seed, checkValue: ctx.checkValue, allowSwap: ctx.allowSwap })

  if (det?.kind === 'accept') {
    const extras: Partial<StepResult> = det.swapped ? { swapped: true } : {}
    return acceptResult(oldS, newS, ctx, det, det.verdict, extras)
  }

  if (det?.kind === 'reject') {
    const t2 = compareSolutionSets(oldS, newS, ctx)
    if (t2.verdict === 'equivalent') {
      // The named shape was a false alarm (e.g. multiplying by an expression that is always positive).
      const move = det.move
      return acceptResult(oldS, newS, ctx, move ? { kind: 'accept', move, chips: [move.chip], verdict: 'equivalent' } : null, 'equivalent')
    }
    const counterexample = counterexampleOf(oldS, newS, t2)
    const verdict: Verdict = t2.verdict === 'undecidable' ? 'not_equivalent' : t2.verdict
    return rejectResult(newS, verdict, {
      pattern: patternHit(det.pattern, det.witness),
      counterexample,
      detected: det.move,
    })
  }

  const t2 = compareSolutionSets(oldS, newS, ctx)
  const inequality = isInequalityStatement(oldS) || isInequalityStatement(newS)

  if (det?.kind === 'defer') {
    switch (t2.verdict) {
      case 'equivalent':
        return acceptResult(oldS, newS, ctx, det, 'equivalent')
      case 'extraneous_superset': {
        const ce = counterexampleOf(oldS, newS, t2)
        if (inequality || det.reason === 'root_single') {
          return rejectResult(newS, 'extraneous_superset', { counterexample: ce, detected: det.move })
        }
        const extras: Partial<StepResult> = {
          caveat: 'extraneous_check',
          pattern: patternHit('squaring_caveat', extraWitness(ce)),
        }
        if (det.reason === 'square') {
          const o = singleRelation(oldS)
          const restr = o ? squaringRestriction(o) : {}
          if (restr.impossible) {
            // sqrt(u) = negative constant: squaring hides that the original has no solution.
            return rejectResult(newS, 'extraneous_superset', { counterexample: ce, detected: det.move })
          }
          if (restr.text) extras.restriction = restr.text
        }
        return acceptResult(oldS, newS, ctx, det, 'extraneous_superset', extras)
      }
      case 'lost_subset': {
        const ce = counterexampleOf(oldS, newS, t2)
        const id = det.reason === 'root_single' || det.reason === 'square' ? 'dropped_pm' : 'divide_by_variable'
        return rejectResult(newS, 'lost_subset', { pattern: patternHit(id, lostWitness(ce)), counterexample: ce, detected: det.move })
      }
      case 'undecidable':
        return rejectResult(newS, 'undecidable', { detected: det.move })
      default: {
        const ce = counterexampleOf(oldS, newS, t2)
        const pattern = runMatchers(oldS, newS, ctx)
        return rejectResult(newS, 'not_equivalent', { pattern, counterexample: ce, detected: det.move })
      }
    }
  }

  switch (t2.verdict) {
    case 'equivalent':
      return acceptResult(oldS, newS, ctx, null, 'equivalent')
    case 'extraneous_superset': {
      const ce = counterexampleOf(oldS, newS, t2)
      return rejectResult(newS, 'extraneous_superset', { pattern: runMatchers(oldS, newS, ctx), counterexample: ce })
    }
    case 'lost_subset': {
      const ce = counterexampleOf(oldS, newS, t2)
      const matched = runMatchers(oldS, newS, ctx)
      const pattern = matched ?? (mentionsEvenPowerOrAbs(oldS) ? patternHit('dropped_pm', lostWitness(ce)) : undefined)
      return rejectResult(newS, 'lost_subset', { pattern, counterexample: ce })
    }
    case 'undecidable':
      return rejectResult(newS, 'undecidable', {})
    default: {
      const ce = counterexampleOf(oldS, newS, t2)
      return rejectResult(newS, 'not_equivalent', { pattern: runMatchers(oldS, newS, ctx), counterexample: ce })
    }
  }
}

/** Relation mode: is `next` a legal transformation of `prev`? */
export function verifyStep(prev: string, next: string, ctx: StepContext): StepResult {
  const p = parseStatement(prev, ctx.vars)
  if (!p.ok) {
    return {
      ok: false,
      verdict: 'parse_error',
      acceptableChips: [],
      parseError: { message: `Previous line: ${p.error.message}`, position: p.error.position, length: p.error.length },
    }
  }
  const n = parseStatement(next, ctx.vars)
  if (!n.ok) {
    const parseError = { message: n.error.message, position: n.error.position, length: n.error.length }
    return { ok: false, verdict: 'parse_error', acceptableChips: [], parseError }
  }
  return verifyStatements(p.statement, n.statement, ctx)
}

/** Display helper reused by expression mode. */
export function scopeDisplay(scope: Scope, vars: readonly string[]): string {
  return pointDisplay(scope, vars)
}
