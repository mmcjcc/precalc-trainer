/**
 * Precalculus Unit 6, Part 1: Fundamental trig identities (reciprocal, quotient, Pythagorean).
 *
 * - Reads trig identity expressions written in textbook or calculator notation (sin²x, sin^2(x), (sin x)^2, sin x,
 *   √(1 − cos²θ), etc.) on top of expr.ts.
 * - Judges step equivalence numerically across a seeded set of ≥ 12 angles avoiding singularities and zeros of all
 *   trig functions involved, using the 'undef' discipline of expressions.ts.
 * - Names the 8 identity-rewrite slips (trig_pythag_sign, trig_pythag_no_square, trig_reciprocal_wrong_pair,
 *   trig_quotient_inverted, trig_cancel_across_sum, trig_square_dropped, trig_identity_sign_lost,
 *   trig_split_denominator).
 * - Structural "done" test: single trig function or constant for ti.simplify; canonical AST match with the target
 *   right-hand side (after at least one intermediate step) for ti.verify.
 * - Detects which identity family a valid step used ('pythagorean' | 'reciprocal' | 'quotient' | 'algebra').
 */
import { patternHit } from '@/engine/matchers/catalog'
import type { ErrorPatternId, PatternHit } from '@/shared/types'
import { canonicalExprKey, readExpr, sameExprForm, type ExprFn, type ExprNode } from './expr'
import type { TrigMistakeId } from './types'
import type { TrigFn } from './values'

export type Quadrant = 1 | 2 | 3 | 4

function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function mixSeed(seed: number, salt: number): number {
  return ((seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0) || 1
}

export type TrigStepFamily = 'pythagorean' | 'reciprocal' | 'quotient' | 'algebra'

export interface TrigStepContext {
  /** 'simplify' finishes at any single trig function or constant; 'verify' finishes at the target right-hand side. */
  kind?: 'simplify' | 'verify'
  /** Variable in the expression ('x' by default, 'θ' for ti.express). */
  variable?: 'x' | 'θ'
  /** Starting left-hand expression (used in 'verify' to require at least one intermediate step). */
  start?: string
  /** Target right-hand expression (required in 'verify', optional in 'simplify'). */
  target?: string
  /** Quadrant restriction when applicable (1..4). */
  quadrant?: Quadrant
  /** Seed for sample angle selection. */
  seed?: number
}

export interface TrigStepResult {
  ok: boolean
  verdict: 'equivalent' | 'not_equivalent' | 'parse_error' | 'unchanged' | 'unverified_jump'
  done: boolean
  family?: TrigStepFamily
  tex?: string
  normalizedText?: string
  message: string
  pattern?: PatternHit
}

export interface TrigSlipCandidate {
  text: string
  latex: string
  mistake: TrigMistakeId
  witness: string
}

const TRIG_FN_NAMES = new Set<string>(['sin', 'cos', 'tan', 'csc', 'sec', 'cot'])

/** Replace variable name in an ExprNode tree (used to map internal 't' back to 'θ'). */
function renameVar(node: ExprNode, from: string, to: string): ExprNode {
  switch (node.t) {
    case 'var':
      return node.name === from ? { t: 'var', name: to } : node
    case 'neg':
      return { t: 'neg', arg: renameVar(node.arg, from, to) }
    case 'add':
      return { t: 'add', op: node.op, l: renameVar(node.l, from, to), r: renameVar(node.r, from, to) }
    case 'mul':
      return { t: 'mul', op: node.op, l: renameVar(node.l, from, to), r: renameVar(node.r, from, to) }
    case 'pow':
      return { t: 'pow', base: renameVar(node.base, from, to), exp: renameVar(node.exp, from, to) }
    case 'fn':
      return { t: 'fn', name: node.name, arg: renameVar(node.arg, from, to) }
    default:
      return node
  }
}

/**
 * Rewrite textbook trig powers `sin^2(x)` and `sin^2 x` into `((sin(x))^2)` so `readExpr` (which rejects `sin^2(x)`
 * in graphing modules) parses them cleanly into `{ t: 'pow', base: { t: 'fn', ... }, exp: { t: 'num', v: 2 } }`.
 */
function expandTrigPowers(input: string): string {
  let s = input
    .replace(/\u00b2/g, '^2')
    .replace(/\u00b3/g, '^3')
    .replace(/\u2074/g, '^4')

  const re = /\b(sin|cos|tan|csc|sec|cot)\s*\^\s*(?:\(\s*(\d+)\s*\)|(\d+))\s*/gi
  let guard = 0
  while (guard++ < 32) {
    re.lastIndex = 0
    const m = re.exec(s)
    if (!m) break
    const fn = m[1]!.toLowerCase()
    const exp = m[2] ?? m[3]!
    const afterIdx = m.index + m[0].length
    const rest = s.slice(afterIdx)

    if (rest.startsWith('(')) {
      let depth = 0
      let end = -1
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '(') depth++
        else if (rest[i] === ')') {
          depth--
          if (depth === 0) {
            end = i
            break
          }
        }
      }
      if (end === -1) break
      const arg = rest.slice(1, end)
      s = `${s.slice(0, m.index)}((${fn}(${arg}))^${exp})${rest.slice(end + 1)}`
      continue
    }

    const bareMatch = /^([0-9]*\s*(?:π|pi)?\s*[a-zA-Zθ]\b|[0-9]+(?:\.[0-9]+)?|π|pi)/i.exec(rest)
    if (!bareMatch) break
    const arg = bareMatch[1]!.trim()
    s = `${s.slice(0, m.index)}((${fn}(${arg}))^${exp})${rest.slice(bareMatch[0].length)}`
  }
  return s
}

export type TrigIdentityRead =
  | { ok: true; node: ExprNode; tex: string; used: readonly string[] }
  | { ok: false; message: string }

/**
 * Read a trig identity expression in `x` or `θ`, supporting `sin²x`, `sin^2(x)`, `(sin x)^2`, `sin x`, `√(...)`, etc.
 */
export function readTrigIdentityExpr(raw: string, opts: { variable?: 'x' | 'θ' } = {}): TrigIdentityRead {
  const variable = opts.variable ?? 'x'
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return { ok: false, message: 'Type an expression first.' }
  if (trimmed.includes('=')) {
    return {
      ok: false,
      message: 'Write one expression per line without an equals sign.',
    }
  }

  let pre = trimmed.replace(/\btheta\b/gi, 'θ')
  if (variable === 'θ') {
    const strippedFns = pre.replace(/\b(arcsin|arccos|arctan|asin|acos|atan|sin|cos|tan|csc|sec|cot|sqrt|abs|pi)\b/gi, '')
    if (/[xX]/.test(strippedFns)) {
      return { ok: false, message: 'Write the expression in terms of θ, not x.' }
    }
    pre = pre.replace(/θ/g, 't')
  }

  // `cos x (1 / sin x)` means (cos x)·(1 / sin x): wrap a bare one-letter argument so the parser's
  // bare-argument rule (which lets `sin 2x` and `cos 2(x − π/4)` absorb what follows) cannot swallow
  // the next factor. `sin x^2` keeps its old binding, so the lookahead skips a following power.
  const expanded = expandTrigPowers(pre).replace(/\b(sin|cos|tan|csc|sec|cot)\s*([xt])\b(?!\s*[\^⁻])/gi, '$1($2)')
  const internalVar = variable === 'θ' ? 't' : 'x'
  const r = readExpr(expanded, {
    vars: [internalVar],
    varWords: `Write the expression in terms of ${variable}.`,
  })
  if (!r.ok) {
    return {
      ok: false,
      message: variable === 'θ' ? r.message.replace(/\bt\b/g, 'θ') : r.message,
    }
  }
  const node = variable === 'θ' ? renameVar(r.node, 't', 'θ') : r.node
  const used = variable === 'θ' ? r.used.map((u) => (u === 't' ? 'θ' : u)) : r.used
  return {
    ok: true,
    node,
    tex: trigIdentityNodeToLatex(node),
    used,
  }
}

const FN_LATEX: Record<ExprFn, string> = {
  sin: '\\sin',
  cos: '\\cos',
  tan: '\\tan',
  csc: '\\csc',
  sec: '\\sec',
  cot: '\\cot',
  asin: '\\sin^{-1}',
  acos: '\\cos^{-1}',
  atan: '\\tan^{-1}',
  sqrt: '',
  abs: '',
}

function wrapParensLatex(s: string): string {
  return `\\left(${s}\\right)`
}

function formatTrigArgLatex(arg: ExprNode): string {
  if (arg.t === 'var') return arg.name === 'θ' ? '\\theta' : ` ${arg.name}`
  return wrapParensLatex(trigIdentityNodeToLatex(arg))
}

/** Textbook LaTeX rendering for an ExprNode (renders `(sin x)^2` as `\sin^{2} x`). */
export function trigIdentityNodeToLatex(node: ExprNode): string {
  switch (node.t) {
    case 'num':
      return node.text
    case 'pi':
      return '\\pi'
    case 'var':
      return node.name === 'θ' ? '\\theta' : node.name
    case 'neg': {
      const inner = trigIdentityNodeToLatex(node.arg)
      return `-${node.arg.t === 'add' || node.arg.t === 'neg' ? wrapParensLatex(inner) : inner}`
    }
    case 'add': {
      const r = trigIdentityNodeToLatex(node.r)
      return `${trigIdentityNodeToLatex(node.l)} ${node.op} ${
        node.r.t === 'neg' || (node.op === '-' && node.r.t === 'add') ? wrapParensLatex(r) : r
      }`
    }
    case 'mul': {
      if (node.op === '/') return `\\frac{${trigIdentityNodeToLatex(node.l)}}{${trigIdentityNodeToLatex(node.r)}}`
      const l = node.l.t === 'add' || node.l.t === 'neg' ? wrapParensLatex(trigIdentityNodeToLatex(node.l)) : trigIdentityNodeToLatex(node.l)
      const r =
        node.r.t === 'add' || node.r.t === 'neg' || (node.r.t === 'mul' && node.r.op === '/')
          ? wrapParensLatex(trigIdentityNodeToLatex(node.r))
          : trigIdentityNodeToLatex(node.r)
      const dot = node.op === '*' || (/\d$/.test(l) && /^\d/.test(r))
      return `${l}${dot ? ' \\cdot ' : ' '}${r}`
    }
    case 'pow': {
      if (node.base.t === 'fn' && TRIG_FN_NAMES.has(node.base.name) && node.exp.t === 'num' && node.exp.v.d === 1 && node.exp.v.n >= 2) {
        return `${FN_LATEX[node.base.name]}^{${node.exp.text}}${formatTrigArgLatex(node.base.arg).replace(/^ /, '')}`
      }
      const b =
        node.base.t === 'num' || node.base.t === 'pi' || node.base.t === 'var'
          ? trigIdentityNodeToLatex(node.base)
          : wrapParensLatex(trigIdentityNodeToLatex(node.base))
      return `${b}^{${trigIdentityNodeToLatex(node.exp)}}`
    }
    case 'fn':
      if (node.name === 'sqrt') return `\\sqrt{${trigIdentityNodeToLatex(node.arg)}}`
      if (node.name === 'abs') return `\\left|${trigIdentityNodeToLatex(node.arg)}\\right|`
      return `${FN_LATEX[node.name]}${formatTrigArgLatex(node.arg)}`
  }
}

/** Convert a trig identity text string to textbook LaTeX. */
export function trigIdentityToLatex(raw: string, variable: 'x' | 'θ' = raw.includes('θ') ? 'θ' : 'x'): string {
  const trimmed = raw.trim()
  if (trimmed.includes('=')) {
    const parts = trimmed.split('=')
    if (parts.length === 2) {
      return `${trigIdentityToLatex(parts[0]!, variable)} = ${trigIdentityToLatex(parts[1]!, variable)}`
    }
  }
  const r = readTrigIdentityExpr(trimmed, { variable })
  return r.ok ? r.tex : trimmed
}

/** Textbook plain-text rendering of an ExprNode (`sin²x`, `cos x`, `(1 − cos²x)/sin x`). */
export function trigIdentityText(node: ExprNode): string {
  switch (node.t) {
    case 'num':
      return node.text
    case 'pi':
      return 'π'
    case 'var':
      return node.name
    case 'neg': {
      const inner = trigIdentityText(node.arg)
      return `−${node.arg.t === 'add' || node.arg.t === 'neg' || (node.arg.t === 'mul' && node.arg.op === '/') ? `(${inner})` : inner}`
    }
    case 'add': {
      const l = trigIdentityText(node.l)
      const r = trigIdentityText(node.r)
      const op = node.op === '-' ? '−' : '+'
      const rightStr = node.r.t === 'neg' || (node.op === '-' && node.r.t === 'add') ? `(${r})` : r
      return `${l} ${op} ${rightStr}`
    }
    case 'mul': {
      if (node.op === '/') {
        const l = node.l.t === 'add' || (node.l.t === 'mul' && node.l.op === '/') ? `(${trigIdentityText(node.l)})` : trigIdentityText(node.l)
        const r =
          node.r.t === 'add' || node.r.t === 'mul' || node.r.t === 'neg' ? `(${trigIdentityText(node.r)})` : trigIdentityText(node.r)
        return `${l} / ${r}`
      }
      const l = node.l.t === 'add' || node.l.t === 'neg' || (node.l.t === 'mul' && node.l.op === '/') ? `(${trigIdentityText(node.l)})` : trigIdentityText(node.l)
      const r = node.r.t === 'add' || node.r.t === 'neg' || (node.r.t === 'mul' && node.r.op === '/') ? `(${trigIdentityText(node.r)})` : trigIdentityText(node.r)
      return `${l} ${r}`.replace(/\)\s+\(/g, ')(')
    }
    case 'pow': {
      if (node.base.t === 'fn' && TRIG_FN_NAMES.has(node.base.name) && node.exp.t === 'num') {
        const expInt = node.exp.v.d === 1 ? node.exp.v.n : -1
        const sup = expInt === 2 ? '²' : expInt === 3 ? '³' : expInt === 4 ? '⁴' : `^${node.exp.text}`
        const argText = node.base.arg.t === 'var' ? node.base.arg.name : `(${trigIdentityText(node.base.arg)})`
        return `${node.base.name}${sup}${argText}`
      }
      const b = node.base.t === 'var' || node.base.t === 'num' ? trigIdentityText(node.base) : `(${trigIdentityText(node.base)})`
      const sup = node.exp.t === 'num' && node.exp.v.d === 1 && node.exp.v.n === 2 ? '²' : `^${trigIdentityText(node.exp)}`
      return `${b}${sup}`
    }
    case 'fn': {
      if (node.name === 'sqrt') return `√(${trigIdentityText(node.arg)})`
      if (node.name === 'abs') return `|${trigIdentityText(node.arg)}|`
      const argText = node.arg.t === 'var' ? ` ${node.arg.name}` : `(${trigIdentityText(node.arg)})`
      return `${node.name}${argText}`
    }
  }
}

// ---------------------------------------------------------------------------
// Numeric evaluation with the 'undef' discipline of src/engine/expressions.ts
// ---------------------------------------------------------------------------

export type TrigEvalResult = number | 'undef'

const POLE_EPS = 1e-8

/** Evaluate an ExprNode at a given angle map, returning 'undef' on division by zero, trig pole, or negative root. */
export function evalTrigSafe(node: ExprNode, env: Readonly<Record<string, number>>): TrigEvalResult {
  switch (node.t) {
    case 'num': {
      if (node.v.d === 0) return 'undef'
      const val = node.v.n / node.v.d
      return Number.isFinite(val) ? val : 'undef'
    }
    case 'pi':
      return Math.PI
    case 'var': {
      const v = env[node.name]
      return v !== undefined && Number.isFinite(v) ? v : 'undef'
    }
    case 'neg': {
      const a = evalTrigSafe(node.arg, env)
      return a === 'undef' ? 'undef' : -a
    }
    case 'add': {
      const l = evalTrigSafe(node.l, env)
      const r = evalTrigSafe(node.r, env)
      if (l === 'undef' || r === 'undef') return 'undef'
      const res = node.op === '+' ? l + r : l - r
      return Number.isFinite(res) ? res : 'undef'
    }
    case 'mul': {
      const l = evalTrigSafe(node.l, env)
      const r = evalTrigSafe(node.r, env)
      if (l === 'undef' || r === 'undef') return 'undef'
      if (node.op === '/') {
        if (Math.abs(r) < POLE_EPS) return 'undef'
        const q = l / r
        return Number.isFinite(q) ? q : 'undef'
      }
      const p = l * r
      return Number.isFinite(p) ? p : 'undef'
    }
    case 'pow': {
      const b = evalTrigSafe(node.base, env)
      const e = evalTrigSafe(node.exp, env)
      if (b === 'undef' || e === 'undef') return 'undef'
      if (Math.abs(b) < POLE_EPS && e <= 0) return 'undef'
      if (b < 0 && !Number.isInteger(e)) return 'undef'
      const v = Math.pow(b, e)
      return Number.isFinite(v) ? v : 'undef'
    }
    case 'fn': {
      const a = evalTrigSafe(node.arg, env)
      if (a === 'undef') return 'undef'
      const s = Math.sin(a)
      const c = Math.cos(a)
      switch (node.name) {
        case 'sin':
          return s
        case 'cos':
          return c
        case 'tan':
          return Math.abs(c) < POLE_EPS ? 'undef' : s / c
        case 'csc':
          return Math.abs(s) < POLE_EPS ? 'undef' : 1 / s
        case 'sec':
          return Math.abs(c) < POLE_EPS ? 'undef' : 1 / c
        case 'cot':
          return Math.abs(s) < POLE_EPS ? 'undef' : c / s
        case 'asin':
          return Math.abs(a) > 1 ? 'undef' : Math.asin(a)
        case 'acos':
          return Math.abs(a) > 1 ? 'undef' : Math.acos(a)
        case 'atan':
          return Math.atan(a)
        case 'sqrt':
          return a < -1e-12 ? 'undef' : Math.sqrt(Math.max(0, a))
        case 'abs':
          return Math.abs(a)
      }
    }
  }
}

/** Base offsets in (0, π/2) that avoid 0, π/6, π/4, π/3, π/2 and where sin, cos, tan, 1±sin, 1±cos, sin±cos are all well away from 0. */
const QI_BASE_ANGLES: readonly number[] = [
  0.173, 0.241, 0.319, 0.397, 0.461, 0.583, 0.659, 0.727, 0.849, 0.923, 0.991, 1.117, 1.193, 1.269, 1.347, 1.429,
]

function quadrantAngle(q: Quadrant, offset: number): number {
  switch (q) {
    case 1:
      return offset
    case 2:
      return Math.PI - offset
    case 3:
      return Math.PI + offset
    case 4:
      return 2 * Math.PI - offset
  }
}

function anyFunctionZeroOrSingular(angle: number): boolean {
  const s = Math.sin(angle)
  const c = Math.cos(angle)
  if (Math.abs(s) < 0.08 || Math.abs(c) < 0.08) return true
  if (Math.abs(Math.abs(s) - Math.abs(c)) < 0.04) return true
  return false
}

export interface TrigSampleOpts {
  variable?: 'x' | 'θ'
  quadrant?: Quadrant
  seed?: number
  count?: number
}

function coerceNode(expr: string | ExprNode, variable: 'x' | 'θ' = 'x'): ExprNode | null {
  if (typeof expr !== 'string') return expr
  const r = readTrigIdentityExpr(expr, { variable })
  return r.ok ? r.node : null
}

/**
 * Build a deterministic seeded list of at least 12 angles avoiding singularities and zeros of all functions in `a` and `b`.
 */
export function trigSampleAngles(
  aOrOpts?: string | ExprNode | TrigSampleOpts,
  b?: string | ExprNode,
  opts: TrigSampleOpts = {},
): number[] {
  const isOptsOnly =
    aOrOpts === undefined ||
    (typeof aOrOpts === 'object' && !('t' in aOrOpts))
  const resolvedOpts: TrigSampleOpts = isOptsOnly ? ((aOrOpts as TrigSampleOpts | undefined) ?? {}) : opts
  const variable: 'x' | 'θ' = resolvedOpts.variable ?? 'x'
  const fallbackNode: ExprNode = { t: 'num', v: { n: 1, d: 1 }, text: '1' }
  const nodeA = isOptsOnly ? fallbackNode : (coerceNode(aOrOpts as string | ExprNode, variable) ?? fallbackNode)
  const nodeB = isOptsOnly || b === undefined ? fallbackNode : (coerceNode(b, variable) ?? fallbackNode)
  const want = Math.max(12, resolvedOpts.count ?? 16)
  const rng = makeRng(mixSeed(resolvedOpts.seed ?? 20260601, 0x54524947))

  const pool: number[] = []
  if (resolvedOpts.quadrant) {
    for (const base of QI_BASE_ANGLES) {
      const jitter = (rng() - 0.5) * 0.018
      pool.push(quadrantAngle(resolvedOpts.quadrant, Math.max(0.11, Math.min(1.46, base + jitter))))
    }
  } else {
    for (let i = 0; i < QI_BASE_ANGLES.length; i++) {
      const base = QI_BASE_ANGLES[i]!
      for (const q of [1, 2, 3, 4] as const) {
        const jitter = (rng() - 0.5) * 0.014
        pool.push(quadrantAngle(q, Math.max(0.11, Math.min(1.46, base + jitter))))
      }
    }
  }

  const chosen: number[] = []
  for (const angle of pool) {
    if (anyFunctionZeroOrSingular(angle)) continue
    const env = { [variable]: angle }
    const va = evalTrigSafe(nodeA, env)
    const vb = evalTrigSafe(nodeB, env)
    if (va === 'undef' || vb === 'undef') continue
    if (Math.abs(va) > 1e6 || Math.abs(vb) > 1e6) continue
    chosen.push(angle)
    if (chosen.length >= want) break
  }
  return chosen
}

const EQUIV_TOL = 1e-7

/**
 * Numeric equivalence of two trig expressions over ≥ 12 seeded sample angles avoiding singularities and zeros.
 */
export function trigExprEquivalent(
  a: string | ExprNode,
  b: string | ExprNode,
  opts: { variable?: 'x' | 'θ'; quadrant?: Quadrant; seed?: number } = {},
): boolean {
  const variable: 'x' | 'θ' = opts.variable ?? 'x'
  const nodeA = coerceNode(a, variable)
  const nodeB = coerceNode(b, variable)
  if (!nodeA || !nodeB) return false
  const angles = trigSampleAngles(nodeA, nodeB, { ...opts, variable, count: 16 })
  if (angles.length < 12) return false
  for (const angle of angles) {
    const env = { [variable]: angle }
    const va = evalTrigSafe(nodeA, env)
    const vb = evalTrigSafe(nodeB, env)
    if (va === 'undef' || vb === 'undef') return false
    const tol = EQUIV_TOL * Math.max(1, Math.abs(va), Math.abs(vb))
    if (Math.abs(va - vb) > tol) return false
  }
  return true
}

/** True when `a` and `b` evaluate to exact opposites (`va === -vb`, non-zero) across ≥ 12 sample angles. */
export function trigExprOpposite(
  a: string | ExprNode,
  b: string | ExprNode,
  opts: { variable?: 'x' | 'θ'; quadrant?: Quadrant; seed?: number } = {},
): boolean {
  const variable: 'x' | 'θ' = opts.variable ?? 'x'
  const nodeB = coerceNode(b, variable)
  if (!nodeB) return false
  return trigExprEquivalent(a, { t: 'neg', arg: nodeB }, opts) && !trigExprEquivalent(a, nodeB, opts)
}

/** True when two trig expressions have the same canonical AST structure. */
export function sameTrigExpr(a: string | ExprNode, b: string | ExprNode, variable: 'x' | 'θ' = 'x'): boolean {
  const na = typeof a === 'string' ? readTrigIdentityExpr(a, { variable }) : { ok: true as const, node: a }
  const nb = typeof b === 'string' ? readTrigIdentityExpr(b, { variable }) : { ok: true as const, node: b }
  if (!na.ok || !nb.ok) return false
  return sameExprForm(na.node, nb.node)
}

/**
 * Structural "done" check for `ti.simplify`: true when `node` is a single first-power trig function of `variable`
 * (e.g. `sin x` or `−cos x`) or a single numeric constant (e.g. `1`, `−1`).
 */
export function isSimplifiedTrig(expr: string | ExprNode, variable: 'x' | 'θ' = 'x'): boolean {
  const node = coerceNode(expr, variable)
  if (!node) return false
  if (node.t === 'num') return true
  if (node.t === 'neg') {
    if (node.arg.t === 'num') return true
    return node.arg.t === 'fn' && TRIG_FN_NAMES.has(node.arg.name) && node.arg.arg.t === 'var' && node.arg.arg.name === variable
  }
  return node.t === 'fn' && TRIG_FN_NAMES.has(node.name) && node.arg.t === 'var' && node.arg.name === variable
}

// ---------------------------------------------------------------------------
// Step family detection ('pythagorean' | 'reciprocal' | 'quotient' | 'algebra')
// ---------------------------------------------------------------------------

interface TrigStats {
  fns: Record<TrigFn, number>
  squares: Record<TrigFn, number>
  totalSquares: number
}

function collectStats(node: ExprNode, out: TrigStats): void {
  switch (node.t) {
    case 'neg':
      collectStats(node.arg, out)
      return
    case 'add':
    case 'mul':
      collectStats(node.l, out)
      collectStats(node.r, out)
      return
    case 'pow':
      if (node.base.t === 'fn' && TRIG_FN_NAMES.has(node.base.name) && node.exp.t === 'num' && node.exp.v.d === 1 && node.exp.v.n >= 2) {
        const fn = node.base.name as TrigFn
        out.squares[fn] = (out.squares[fn] ?? 0) + 1
        out.totalSquares += 1
        out.fns[fn] = (out.fns[fn] ?? 0) + 1
        return
      }
      collectStats(node.base, out)
      collectStats(node.exp, out)
      return
    case 'fn':
      if (TRIG_FN_NAMES.has(node.name)) {
        const fn = node.name as TrigFn
        out.fns[fn] = (out.fns[fn] ?? 0) + 1
      }
      collectStats(node.arg, out)
      return
    default:
      return
  }
}

function statsOf(node: ExprNode): TrigStats {
  const s: TrigStats = {
    fns: { sin: 0, cos: 0, tan: 0, csc: 0, sec: 0, cot: 0 },
    squares: { sin: 0, cos: 0, tan: 0, csc: 0, sec: 0, cot: 0 },
    totalSquares: 0,
  }
  collectStats(node, s)
  return s
}

/** Detect which fundamental identity family a valid step used. */
export function detectTrigStepFamily(prev: string | ExprNode, next: string | ExprNode, variable: 'x' | 'θ' = 'x'): TrigStepFamily {
  const np = typeof prev === 'string' ? readTrigIdentityExpr(prev, { variable }) : { ok: true as const, node: prev }
  const nn = typeof next === 'string' ? readTrigIdentityExpr(next, { variable }) : { ok: true as const, node: next }
  if (!np.ok || !nn.ok) return 'algebra'
  const a = statsOf(np.node)
  const b = statsOf(nn.node)

  // Check Pythagorean: square of sin/cos/tan/sec/csc/cot traded for 1 or partner square
  const pythagPairs: [TrigFn, TrigFn][] = [
    ['sin', 'cos'],
    ['tan', 'sec'],
    ['cot', 'csc'],
  ]
  for (const [f1, f2] of pythagPairs) {
    const sqBefore = a.squares[f1] + a.squares[f2]
    const sqAfter = b.squares[f1] + b.squares[f2]
    if ((a.squares[f1] !== b.squares[f1] || a.squares[f2] !== b.squares[f2]) && (sqBefore > 0 || sqAfter > 0)) {
      // Distinguish Pythagorean from simple algebraic squaring `sin x * sin x -> sin²x` or canceling `sin²x / sin x -> sin x`
      const f1Changed = (a.fns[f1] > 0) !== (b.fns[f1] > 0)
      const f2Changed = (a.fns[f2] > 0) !== (b.fns[f2] > 0)
      const bothBefore = a.squares[f1] > 0 && a.squares[f2] > 0 && sqAfter === 0
      const bothAfter = b.squares[f1] > 0 && b.squares[f2] > 0 && sqBefore === 0
      if (f1Changed || f2Changed || bothBefore || bothAfter) {
        return 'pythagorean'
      }
    }
  }

  // Check Quotient: tan or cot traded for sin & cos
  const tanChanged = a.fns.tan !== b.fns.tan
  const cotChanged = a.fns.cot !== b.fns.cot
  if (tanChanged || cotChanged) {
    const sinInvolved = a.fns.sin > 0 || b.fns.sin > 0
    const cosInvolved = a.fns.cos > 0 || b.fns.cos > 0
    if (sinInvolved && cosInvolved) return 'quotient'
  }

  // Check Reciprocal: sec <-> 1/cos, csc <-> 1/sin, cot <-> 1/tan
  if (a.fns.sec !== b.fns.sec || a.fns.csc !== b.fns.csc || (a.fns.cot !== b.fns.cot && a.fns.tan !== b.fns.tan)) {
    return 'reciprocal'
  }

  return 'algebra'
}

// ---------------------------------------------------------------------------
// AST slip generation & mistake matching
// ---------------------------------------------------------------------------

const numNode = (v: number): ExprNode => ({ t: 'num', v: { n: v, d: 1 }, text: String(v) })
const varNode = (name: string): ExprNode => ({ t: 'var', name })
const fnNode = (name: ExprFn, arg: ExprNode): ExprNode => ({ t: 'fn', name, arg })
const sqNode = (fn: ExprFn, arg: ExprNode): ExprNode => ({ t: 'pow', base: fnNode(fn, arg), exp: numNode(2) })
const addNode = (op: '+' | '-', l: ExprNode, r: ExprNode): ExprNode => ({ t: 'add', op, l, r })
const mulNode = (op: '*' | '·' | '/' | 'implicit', l: ExprNode, r: ExprNode): ExprNode => ({
  t: 'mul',
  op: op === '·' ? '*' : op,
  l,
  r,
})
const negNode = (arg: ExprNode): ExprNode => ({ t: 'neg', arg })

function isTrigSq(node: ExprNode, fn?: TrigFn): { fn: TrigFn; arg: ExprNode } | null {
  if (
    node.t === 'pow' &&
    node.base.t === 'fn' &&
    TRIG_FN_NAMES.has(node.base.name) &&
    node.exp.t === 'num' &&
    node.exp.v.d === 1 &&
    node.exp.v.n === 2
  ) {
    const f = node.base.name as TrigFn
    if (!fn || f === fn) return { fn: f, arg: node.base.arg }
  }
  return null
}

function isTrigFn(node: ExprNode, fn?: TrigFn): { fn: TrigFn; arg: ExprNode } | null {
  if (node.t === 'fn' && TRIG_FN_NAMES.has(node.name)) {
    const f = node.name as TrigFn
    if (!fn || f === fn) return { fn: f, arg: node.arg }
  }
  return null
}

function isOne(node: ExprNode): boolean {
  return node.t === 'num' && node.v.d === 1 && node.v.n === 1
}

interface RawAstSlip {
  node: ExprNode
  mistake: TrigMistakeId
  witness: string
}

/** Generate single-site wrong rewrites at the root of `node`. */
function rootSlips(node: ExprNode): RawAstSlip[] {
  const out: RawAstSlip[] = []

  // 1. trig_reciprocal_wrong_pair: sec <-> 1/sin, csc <-> 1/cos
  const tf = isTrigFn(node)
  if (tf) {
    if (tf.fn === 'sec') {
      out.push({
        node: mulNode('/', numNode(1), fnNode('sin', tf.arg)),
        mistake: 'trig_reciprocal_wrong_pair',
        witness: 'sec is the reciprocal of cos, not sin.',
      })
    } else if (tf.fn === 'csc') {
      out.push({
        node: mulNode('/', numNode(1), fnNode('cos', tf.arg)),
        mistake: 'trig_reciprocal_wrong_pair',
        witness: 'csc is the reciprocal of sin, not cos.',
      })
    } else if (tf.fn === 'tan') {
      out.push({
        node: mulNode('/', fnNode('cos', tf.arg), fnNode('sin', tf.arg)),
        mistake: 'trig_quotient_inverted',
        witness: 'tan is sin over cos; cos over sin is cot.',
      })
    } else if (tf.fn === 'cot') {
      out.push({
        node: mulNode('/', fnNode('sin', tf.arg), fnNode('cos', tf.arg)),
        mistake: 'trig_quotient_inverted',
        witness: 'cot is cos over sin; sin over cos is tan.',
      })
    }
  }

  // Squared trig functions: drop square, wrong reciprocal/quotient, wrong Pythagorean
  const sq = isTrigSq(node)
  if (sq) {
    out.push({
      node: fnNode(sq.fn, sq.arg),
      mistake: 'trig_square_dropped',
      witness: `Keep the square on ${sq.fn}.`,
    })
    if (sq.fn === 'sec') {
      out.push({
        node: mulNode('/', numNode(1), sqNode('sin', sq.arg)),
        mistake: 'trig_reciprocal_wrong_pair',
        witness: 'sec is the reciprocal of cos, not sin.',
      })
      out.push({
        node: addNode('-', numNode(1), sqNode('tan', sq.arg)),
        mistake: 'trig_pythag_sign',
        witness: 'The Pythagorean identity adds the squares: one plus tan squared equals sec squared.',
      })
    } else if (sq.fn === 'csc') {
      out.push({
        node: mulNode('/', numNode(1), sqNode('cos', sq.arg)),
        mistake: 'trig_reciprocal_wrong_pair',
        witness: 'csc is the reciprocal of sin, not cos.',
      })
      out.push({
        node: addNode('-', numNode(1), sqNode('cot', sq.arg)),
        mistake: 'trig_pythag_sign',
        witness: 'The Pythagorean identity adds the squares: one plus cot squared equals csc squared.',
      })
    } else if (sq.fn === 'tan') {
      out.push({
        node: mulNode('/', sqNode('cos', sq.arg), sqNode('sin', sq.arg)),
        mistake: 'trig_quotient_inverted',
        witness: 'tan is sin over cos; cos over sin is cot.',
      })
      out.push({
        node: addNode('+', sqNode('sec', sq.arg), numNode(1)),
        mistake: 'trig_pythag_sign',
        witness: 'Subtract one from sec squared to get tan squared.',
      })
    } else if (sq.fn === 'cot') {
      out.push({
        node: mulNode('/', sqNode('sin', sq.arg), sqNode('cos', sq.arg)),
        mistake: 'trig_quotient_inverted',
        witness: 'cot is cos over sin; sin over cos is tan.',
      })
      out.push({
        node: addNode('+', sqNode('csc', sq.arg), numNode(1)),
        mistake: 'trig_pythag_sign',
        witness: 'Subtract one from csc squared to get cot squared.',
      })
    } else if (sq.fn === 'sin') {
      out.push({
        node: addNode('+', numNode(1), sqNode('cos', sq.arg)),
        mistake: 'trig_pythag_sign',
        witness: 'Since sin squared plus cos squared equals one, sin squared is one minus cos squared.',
      })
    } else if (sq.fn === 'cos') {
      out.push({
        node: addNode('+', numNode(1), sqNode('sin', sq.arg)),
        mistake: 'trig_pythag_sign',
        witness: 'Since sin squared plus cos squared equals one, cos squared is one minus sin squared.',
      })
    }
  }

  // Additions and subtractions
  if (node.t === 'add') {
    const lSq = isTrigSq(node.l)
    const rSq = isTrigSq(node.r)
    const lFn = isTrigFn(node.l)
    const rFn = isTrigFn(node.r)

    // 1 - cos²x or 1 - sin²x
    if (node.op === '-' && isOne(node.l) && rSq && (rSq.fn === 'cos' || rSq.fn === 'sin')) {
      const other: TrigFn = rSq.fn === 'cos' ? 'sin' : 'cos'
      out.push({
        node: negNode(sqNode(other, rSq.arg)),
        mistake: 'trig_pythag_sign',
        witness: `One minus ${rSq.fn} squared is positive ${other} squared.`,
      })
      out.push({
        node: fnNode(other, rSq.arg),
        mistake: 'trig_pythag_no_square',
        witness: `One minus ${rSq.fn} squared is ${other} squared, with the square kept.`,
      })
      out.push({
        node: addNode('-', numNode(1), fnNode(rSq.fn, rSq.arg)),
        mistake: 'trig_pythag_no_square',
        witness: 'The Pythagorean identity ties the squares together, never the first powers.',
      })
      out.push({
        node: addNode('+', numNode(1), sqNode(rSq.fn, rSq.arg)),
        mistake: 'trig_pythag_sign',
        witness: `The Pythagorean identity gives one minus ${rSq.fn} squared here, not one plus.`,
      })
    }

    // cos²x - 1 or sin²x - 1 -> lost minus sign
    if (node.op === '-' && lSq && isOne(node.r) && (lSq.fn === 'cos' || lSq.fn === 'sin')) {
      const other: TrigFn = lSq.fn === 'cos' ? 'sin' : 'cos'
      out.push({
        node: sqNode(other, lSq.arg),
        mistake: 'trig_identity_sign_lost',
        witness: `${lSq.fn} squared minus one is the opposite of one minus ${lSq.fn} squared, so it is negative ${other} squared.`,
      })
    }

    // 1 - sec²x or 1 - csc²x -> lost minus sign
    if (node.op === '-' && isOne(node.l) && rSq && (rSq.fn === 'sec' || rSq.fn === 'csc')) {
      const other: TrigFn = rSq.fn === 'sec' ? 'tan' : 'cot'
      out.push({
        node: sqNode(other, rSq.arg),
        mistake: 'trig_identity_sign_lost',
        witness: `One minus ${rSq.fn} squared is negative ${other} squared.`,
      })
    }

    // tan²x - sec²x or cot²x - csc²x -> lost minus sign
    if (node.op === '-' && lSq && rSq) {
      if ((lSq.fn === 'tan' && rSq.fn === 'sec') || (lSq.fn === 'cot' && rSq.fn === 'csc')) {
        out.push({
          node: numNode(1),
          mistake: 'trig_identity_sign_lost',
          witness: `${rSq.fn} squared minus ${lSq.fn} squared is one, so reversing the subtraction gives minus one.`,
        })
      }
      if ((lSq.fn === 'sin' && rSq.fn === 'cos') || (lSq.fn === 'cos' && rSq.fn === 'sin')) {
        out.push({
          node: numNode(1),
          mistake: 'trig_pythag_sign',
          witness: 'The Pythagorean identity adds the squares: sin squared plus cos squared equals one, not the difference.',
        })
      }
      if ((lSq.fn === 'sec' && rSq.fn === 'tan') || (lSq.fn === 'csc' && rSq.fn === 'cot')) {
        out.push({
          node: negNode(numNode(1)),
          mistake: 'trig_pythag_sign',
          witness: `${lSq.fn} squared minus ${rSq.fn} squared equals positive one.`,
        })
      }
    }

    // sec²x - 1 or csc²x - 1
    if (node.op === '-' && lSq && isOne(node.r) && (lSq.fn === 'sec' || lSq.fn === 'csc')) {
      const other: TrigFn = lSq.fn === 'sec' ? 'tan' : 'cot'
      out.push({
        node: negNode(sqNode(other, lSq.arg)),
        mistake: 'trig_pythag_sign',
        witness: `${lSq.fn} squared minus one is positive ${other} squared.`,
      })
      out.push({
        node: fnNode(other, lSq.arg),
        mistake: 'trig_pythag_no_square',
        witness: `${lSq.fn} squared minus one is ${other} squared, with the square kept.`,
      })
    }

    // 1 + tan²x or tan²x + 1 or 1 + cot²x or cot²x + 1
    if (node.op === '+') {
      const tanLike = (isOne(node.l) && rSq) ? rSq : (isOne(node.r) && lSq) ? lSq : null
      if (tanLike && (tanLike.fn === 'tan' || tanLike.fn === 'cot')) {
        const secLike: TrigFn = tanLike.fn === 'tan' ? 'sec' : 'csc'
        out.push({
          node: addNode('-', numNode(1), sqNode(tanLike.fn, tanLike.arg)),
          mistake: 'trig_pythag_sign',
          witness: `One plus ${tanLike.fn} squared is ${secLike} squared.`,
        })
        out.push({
          node: fnNode(secLike, tanLike.arg),
          mistake: 'trig_square_dropped',
          witness: `One plus ${tanLike.fn} squared is ${secLike} squared, with the square kept.`,
        })
      }
      // 1 - tan²x or 1 - cot²x written as sec²x or csc²x
    }
    if (node.op === '-' && isOne(node.l) && rSq && (rSq.fn === 'tan' || rSq.fn === 'cot')) {
      const secLike: TrigFn = rSq.fn === 'tan' ? 'sec' : 'csc'
      out.push({
        node: sqNode(secLike, rSq.arg),
        mistake: 'trig_pythag_sign',
        witness: `One plus ${rSq.fn} squared is ${secLike} squared, with a plus sign, not a minus sign.`,
      })
    }

    // sin²x + cos²x or cos²x + sin²x
    if (
      node.op === '+' &&
      lSq &&
      rSq &&
      ((lSq.fn === 'sin' && rSq.fn === 'cos') || (lSq.fn === 'cos' && rSq.fn === 'sin'))
    ) {
      out.push({
        node: addNode('-', sqNode(lSq.fn, lSq.arg), sqNode(rSq.fn, rSq.arg)),
        mistake: 'trig_pythag_sign',
        witness: 'sin squared plus cos squared equals one.',
      })
      out.push({
        node: addNode('+', fnNode(lSq.fn, lSq.arg), fnNode(rSq.fn, rSq.arg)),
        mistake: 'trig_square_dropped',
        witness: 'Keep the squares on sin and cos.',
      })
    }

    // First-power Pythagorean slips: sin x + cos x -> 1, 1 - cos x -> sin x, 1 - sin x -> cos x, 1 + tan x -> sec x
    if (
      node.op === '+' &&
      lFn &&
      rFn &&
      ((lFn.fn === 'sin' && rFn.fn === 'cos') || (lFn.fn === 'cos' && rFn.fn === 'sin'))
    ) {
      out.push({
        node: numNode(1),
        mistake: 'trig_pythag_no_square',
        witness: 'Only the squares add to one: sin squared plus cos squared equals one, not sin plus cos.',
      })
    }
    if (node.op === '-' && isOne(node.l) && rFn && (rFn.fn === 'cos' || rFn.fn === 'sin')) {
      const other: TrigFn = rFn.fn === 'cos' ? 'sin' : 'cos'
      out.push({
        node: fnNode(other, rFn.arg),
        mistake: 'trig_pythag_no_square',
        witness: `One minus ${rFn.fn} needs squares before it becomes ${other} squared.`,
      })
    }
    if (node.op === '+' && isOne(node.l) && rFn && (rFn.fn === 'tan' || rFn.fn === 'cot')) {
      const other: TrigFn = rFn.fn === 'tan' ? 'sec' : 'csc'
      out.push({
        node: fnNode(other, rFn.arg),
        mistake: 'trig_pythag_no_square',
        witness: `One plus ${rFn.fn} needs squares before it becomes ${other} squared.`,
      })
    }

    // sec x - cos x or csc x - sin x: common denominator without squaring
    if (node.op === '-' && lFn && rFn) {
      if (lFn.fn === 'sec' && rFn.fn === 'cos') {
        out.push({
          node: mulNode('/', addNode('-', numNode(1), fnNode('cos', rFn.arg)), fnNode('cos', rFn.arg)),
          mistake: 'trig_pythag_no_square',
          witness: 'Putting cos over a denominator of cos multiplies cos by cos to make cos squared.',
        })
      } else if (lFn.fn === 'csc' && rFn.fn === 'sin') {
        out.push({
          node: mulNode('/', addNode('-', numNode(1), fnNode('sin', rFn.arg)), fnNode('sin', rFn.arg)),
          mistake: 'trig_pythag_no_square',
          witness: 'Putting sin over a denominator of sin multiplies sin by sin to make sin squared.',
        })
      }
    }
    // (1 / cos x) - cos x or (1 / sin x) - sin x
    if (node.op === '-' && node.l.t === 'mul' && node.l.op === '/' && isOne(node.l.l) && rFn) {
      const denomFn = isTrigFn(node.l.r)
      if (denomFn && denomFn.fn === rFn.fn) {
        out.push({
          node: mulNode('/', addNode('-', numNode(1), fnNode(rFn.fn, rFn.arg)), fnNode(rFn.fn, rFn.arg)),
          mistake: 'trig_pythag_no_square',
          witness: `Multiplying ${rFn.fn} by ${rFn.fn} for a common denominator gives ${rFn.fn} squared.`,
        })
        out.push({
          node: mulNode('/', addNode('+', numNode(1), sqNode(rFn.fn, rFn.arg)), fnNode(rFn.fn, rFn.arg)),
          mistake: 'trig_pythag_sign',
          witness: 'Keep the minus sign when combining over the common denominator.',
        })
      }
    }
  }

  // Multiplications and divisions
  if (node.t === 'mul') {
    if (node.op === '/') {
      const lFn = isTrigFn(node.l)
      const rFn = isTrigFn(node.r)
      const lSq = isTrigSq(node.l)
      const rSq = isTrigSq(node.r)

      // 1 / cos -> csc, 1 / sin -> sec
      if (isOne(node.l) && rFn) {
        if (rFn.fn === 'cos') {
          out.push({
            node: fnNode('csc', rFn.arg),
            mistake: 'trig_reciprocal_wrong_pair',
            witness: 'One over cos is sec, not csc.',
          })
        } else if (rFn.fn === 'sin') {
          out.push({
            node: fnNode('sec', rFn.arg),
            mistake: 'trig_reciprocal_wrong_pair',
            witness: 'One over sin is csc, not sec.',
          })
        }
      }
      if (isOne(node.l) && rSq) {
        if (rSq.fn === 'cos') {
          out.push({
            node: sqNode('csc', rSq.arg),
            mistake: 'trig_reciprocal_wrong_pair',
            witness: 'One over cos squared is sec squared, not csc squared.',
          })
        } else if (rSq.fn === 'sin') {
          out.push({
            node: sqNode('sec', rSq.arg),
            mistake: 'trig_reciprocal_wrong_pair',
            witness: 'One over sin squared is csc squared, not sec squared.',
          })
        }
      }

      // sin / cos -> cot, cos / sin -> tan
      if (lFn && rFn) {
        if (lFn.fn === 'sin' && rFn.fn === 'cos') {
          out.push({
            node: fnNode('cot', lFn.arg),
            mistake: 'trig_quotient_inverted',
            witness: 'sin over cos is tan, not cot.',
          })
        } else if (lFn.fn === 'cos' && rFn.fn === 'sin') {
          out.push({
            node: fnNode('tan', lFn.arg),
            mistake: 'trig_quotient_inverted',
            witness: 'cos over sin is cot, not tan.',
          })
        }
      }
      if (lSq && rSq) {
        if (lSq.fn === 'sin' && rSq.fn === 'cos') {
          out.push({
            node: sqNode('cot', lSq.arg),
            mistake: 'trig_quotient_inverted',
            witness: 'sin squared over cos squared is tan squared, not cot squared.',
          })
        } else if (lSq.fn === 'cos' && rSq.fn === 'sin') {
          out.push({
            node: sqNode('tan', lSq.arg),
            mistake: 'trig_quotient_inverted',
            witness: 'cos squared over sin squared is cot squared, not tan squared.',
          })
        }
      }

      // sin²x / cos x -> sin x cot x (inverted quotient) or sin x / cos x (square dropped)
      if (lSq && rFn) {
        if (lSq.fn === 'sin' && rFn.fn === 'cos') {
          out.push({
            node: mulNode('·', fnNode('sin', lSq.arg), fnNode('cot', lSq.arg)),
            mistake: 'trig_quotient_inverted',
            witness: 'sin over cos is tan, so sin squared over cos is sin times tan.',
          })
        } else if (lSq.fn === 'cos' && rFn.fn === 'sin') {
          out.push({
            node: mulNode('·', fnNode('cos', lSq.arg), fnNode('tan', lSq.arg)),
            mistake: 'trig_quotient_inverted',
            witness: 'cos over sin is cot, so cos squared over sin is cos times cot.',
          })
        }
      }

      // trig_cancel_across_sum: (a ± b) / c
      if (node.l.t === 'add') {
        const a = node.l.l
        const b = node.l.r
        const op = node.l.op
        // e.g. (sin x + cos x)/sin x -> 1 + cos x
        if (sameExprForm(a, node.r)) {
          out.push({
            node: addNode(op, numNode(1), b),
            mistake: 'trig_cancel_across_sum',
            witness: 'You canceled the denominator with only the first term of the numerator.',
          })
        } else if (sameExprForm(b, node.r)) {
          out.push({
            node: addNode(op, a, numNode(1)),
            mistake: 'trig_cancel_across_sum',
            witness: 'You canceled the denominator with only the second term of the numerator.',
          })
        }
        // e.g. (1 - cos²x)/cos x -> 1 - cos x, or (1 - sin²x)/sin x -> 1 - sin x
        const bSq = isTrigSq(b)
        if (bSq && rFn && bSq.fn === rFn.fn) {
          out.push({
            node: addNode(op, a, fnNode(rFn.fn, rFn.arg)),
            mistake: 'trig_cancel_across_sum',
            witness: `You canceled ${rFn.fn} with only one term of the numerator.`,
          })
        }
        const aSq = isTrigSq(a)
        if (aSq && rFn && aSq.fn === rFn.fn) {
          out.push({
            node: addNode(op, fnNode(rFn.fn, rFn.arg), b),
            mistake: 'trig_cancel_across_sum',
            witness: `You canceled ${rFn.fn} with only one term of the numerator.`,
          })
        }
        // e.g. (sec²x - 1)/sec²x -> 1 - 1 or sec x - 1
        if (aSq && rSq && aSq.fn === rSq.fn) {
          out.push({
            node: addNode(op, fnNode(aSq.fn, aSq.arg), b),
            mistake: 'trig_cancel_across_sum',
            witness: 'Divide every term of the numerator by the denominator, or replace the numerator using a Pythagorean identity first.',
          })
        }
        // e.g. (sin²x + cos²x)/(sin x cos x) -> sin x + cos x
        if (
          aSq &&
          bSq &&
          node.r.t === 'mul' &&
          node.r.op !== '/' &&
          ((aSq.fn === 'sin' && bSq.fn === 'cos') || (aSq.fn === 'cos' && bSq.fn === 'sin'))
        ) {
          out.push({
            node: addNode(op, fnNode(aSq.fn, aSq.arg), fnNode(bSq.fn, bSq.arg)),
            mistake: 'trig_cancel_across_sum',
            witness: 'You cannot cancel sin against one term and cos against the other across a plus sign.',
          })
        }
      }

      // trig_split_denominator: c / (a ± b) -> c/a ± c/b
      if (node.r.t === 'add') {
        out.push({
          node: addNode(node.r.op, mulNode('/', node.l, node.r.l), mulNode('/', node.l, node.r.r)),
          mistake: 'trig_split_denominator',
          witness: 'A sum or difference in the denominator cannot be split into two separate fractions.',
        })
      }
    } else {
      // Product `(1 + sin x)(1 - sin x)` or `(1 + cos x)(1 - cos x)` or `(sec x + 1)(sec x - 1)`
      if (node.l.t === 'add' && node.r.t === 'add' && node.l.op !== node.r.op) {
        const plusSide = node.l.op === '+' ? node.l : node.r
        const minusSide = node.l.op === '-' ? node.l : node.r
        if (sameExprForm(plusSide.l, minusSide.l) && sameExprForm(plusSide.r, minusSide.r)) {
          const rFn = isTrigFn(minusSide.r)
          const lFn = isTrigFn(minusSide.l)
          if (isOne(minusSide.l) && rFn && (rFn.fn === 'sin' || rFn.fn === 'cos')) {
            const other: TrigFn = rFn.fn === 'sin' ? 'cos' : 'sin'
            out.push({
              node: addNode('+', numNode(1), sqNode(rFn.fn, rFn.arg)),
              mistake: 'trig_pythag_sign',
              witness: 'The product of a sum and a difference is the difference of squares, with a minus sign.',
            })
            out.push({
              node: addNode('-', numNode(1), fnNode(rFn.fn, rFn.arg)),
              mistake: 'trig_pythag_no_square',
              witness: 'Multiplying the two binomials squares the trig function.',
            })
            out.push({
              node: fnNode(other, rFn.arg),
              mistake: 'trig_square_dropped',
              witness: `One minus ${rFn.fn} squared is ${other} squared, with the square kept.`,
            })
          } else if (lFn && isOne(minusSide.r) && (lFn.fn === 'sec' || lFn.fn === 'csc')) {
            const other: TrigFn = lFn.fn === 'sec' ? 'tan' : 'cot'
            out.push({
              node: addNode('+', sqNode(lFn.fn, lFn.arg), numNode(1)),
              mistake: 'trig_pythag_sign',
              witness: 'The product of a sum and a difference is the difference of squares, with a minus sign.',
            })
            out.push({
              node: fnNode(other, lFn.arg),
              mistake: 'trig_square_dropped',
              witness: `${lFn.fn} squared minus one is ${other} squared, with the square kept.`,
            })
          }
        }
      }
    }
  }

  return out
}

/** Recursively collect single-site wrong rewrites throughout an ExprNode tree. */
function collectTreeSlips(node: ExprNode): RawAstSlip[] {
  const out: RawAstSlip[] = [...rootSlips(node)]

  switch (node.t) {
    case 'neg':
      for (const s of collectTreeSlips(node.arg)) {
        out.push({ ...s, node: negNode(s.node) })
      }
      break
    case 'add':
      for (const s of collectTreeSlips(node.l)) {
        out.push({ ...s, node: addNode(node.op, s.node, node.r) })
      }
      for (const s of collectTreeSlips(node.r)) {
        out.push({ ...s, node: addNode(node.op, node.l, s.node) })
      }
      break
    case 'mul':
      for (const s of collectTreeSlips(node.l)) {
        out.push({ ...s, node: mulNode(node.op, s.node, node.r) })
      }
      for (const s of collectTreeSlips(node.r)) {
        out.push({ ...s, node: mulNode(node.op, node.l, s.node) })
      }
      break
    case 'pow':
      for (const s of collectTreeSlips(node.base)) {
        out.push({ ...s, node: { t: 'pow', base: s.node, exp: node.exp } })
      }
      break
    case 'fn':
      for (const s of collectTreeSlips(node.arg)) {
        out.push({ ...s, node: fnNode(node.name, s.node) })
      }
      break
    default:
      break
  }

  return out
}

/**
 * Generate named wrong rewrites of `currentLine` for Guide Me cards and step slip detection.
 * Every returned candidate is guaranteed NOT to be numerically equivalent to `currentLine`.
 */
export function trigIdentitySlips(currentLine: string, ctx: TrigStepContext = {}): TrigSlipCandidate[] {
  const variable = ctx.variable ?? (currentLine.includes('θ') ? 'θ' : 'x')
  const parsed = readTrigIdentityExpr(currentLine, { variable })
  if (!parsed.ok) return []

  const raw = collectTreeSlips(parsed.node)

  // Also add whole-line opposite-sign slip (trig_identity_sign_lost) so every line has at least a sign-loss candidate
  raw.push({
    node: parsed.node.t === 'neg' ? parsed.node.arg : negNode(parsed.node),
    mistake: 'trig_identity_sign_lost',
    witness: 'Check the sign of your expression.',
  })

  // Fallback general slips if `currentLine` is a simple quotient/product without many subtrees
  const v = varNode(variable)
  const st = statsOf(parsed.node)
  if (st.fns.sin > 0 && st.fns.cos > 0) {
    raw.push({
      node: fnNode('cot', v),
      mistake: 'trig_quotient_inverted',
      witness: 'sin over cos is tan, whereas cos over sin is cot.',
    })
    raw.push({
      node: fnNode('tan', v),
      mistake: 'trig_quotient_inverted',
      witness: 'Check whether sin or cos is on top in the quotient.',
    })
  }
  if (st.fns.cos > 0) {
    raw.push({
      node: fnNode('csc', v),
      mistake: 'trig_reciprocal_wrong_pair',
      witness: 'The reciprocal of cos is sec, not csc.',
    })
  }
  if (st.fns.sin > 0) {
    raw.push({
      node: fnNode('sec', v),
      mistake: 'trig_reciprocal_wrong_pair',
      witness: 'The reciprocal of sin is csc, not sec.',
    })
  }

  const out: TrigSlipCandidate[] = []
  const seenKeys = new Set<string>([canonicalExprKey(parsed.node)])

  for (const item of raw) {
    const text = trigIdentityText(item.node)
    const reParsed = readTrigIdentityExpr(text, { variable })
    if (!reParsed.ok) continue
    const key = canonicalExprKey(reParsed.node)
    if (seenKeys.has(key)) continue
    // Must be defined on ≥ 12 angles and NOT numerically equivalent to `parsed.node`
    const angles = trigSampleAngles(parsed.node, reParsed.node, {
      variable,
      quadrant: ctx.quadrant,
      seed: ctx.seed,
      count: 16,
    })
    if (angles.length < 12) continue
    if (trigExprEquivalent(parsed.node, reParsed.node, { variable, quadrant: ctx.quadrant, seed: ctx.seed })) continue
    // Avoid adding two candidates that are numerically identical to each other
    if (
      out.some((existing) => {
        const er = readTrigIdentityExpr(existing.text, { variable })
        return er.ok && trigExprEquivalent(er.node, reParsed.node, { variable, quadrant: ctx.quadrant, seed: ctx.seed })
      })
    ) {
      continue
    }
    seenKeys.add(key)
    out.push({
      text,
      latex: reParsed.tex,
      mistake: item.mistake,
      witness: item.witness,
    })
  }

  return out
}

/** Structural fallback checks for student lines that combine a slip with simplification. */
function detectStructuralSlip(
  prevNode: ExprNode,
  nextNode: ExprNode,
  opts: { variable: 'x' | 'θ'; quadrant?: Quadrant; seed?: number },
): { id: TrigMistakeId; witness: string } | null {
  const prevStats = statsOf(prevNode)
  const nextStats = statsOf(nextNode)
  const v = varNode(opts.variable)

  // 1. Check if `next` is numerically `-prev` when `prev` is a reversed Pythagorean difference or radical
  if (trigExprOpposite(prevNode, nextNode, opts)) {
    // If prev is `sin² - cos²`, `sec² - tan²`, `csc² - cot²`, `1 - cos²`, `1 - sin²`, `sec² - 1`, `csc² - 1`,
    // getting the negative is `trig_pythag_sign` unless prev itself is `cos² - 1`, `sin² - 1`, `1 - sec²`, `1 - csc²`, `tan² - sec²`, `cot² - csc²`
    if (prevNode.t === 'add' && prevNode.op === '-') {
      const lSq = isTrigSq(prevNode.l)
      const rSq = isTrigSq(prevNode.r)
      if (
        (lSq && isOne(prevNode.r) && (lSq.fn === 'cos' || lSq.fn === 'sin')) ||
        (isOne(prevNode.l) && rSq && (rSq.fn === 'sec' || rSq.fn === 'csc')) ||
        (lSq && rSq && ((lSq.fn === 'tan' && rSq.fn === 'sec') || (lSq.fn === 'cot' && rSq.fn === 'csc')))
      ) {
        return {
          id: 'trig_identity_sign_lost',
          witness: 'Reversing the order of subtraction flips the sign of the identity.',
        }
      }
      if (
        (isOne(prevNode.l) && rSq && (rSq.fn === 'cos' || rSq.fn === 'sin')) ||
        (lSq && isOne(prevNode.r) && (lSq.fn === 'sec' || lSq.fn === 'csc')) ||
        (lSq && rSq && ((lSq.fn === 'sec' && rSq.fn === 'tan') || (lSq.fn === 'csc' && rSq.fn === 'cot')))
      ) {
        return {
          id: 'trig_pythag_sign',
          witness: 'Check the sign in the Pythagorean identity.',
        }
      }
    }
    return {
      id: 'trig_identity_sign_lost',
      witness: 'Your expression has the opposite sign of the previous line.',
    }
  }

  // 2. Split denominator: prev is `c / (a ± b)` and next is a sum/difference of two fractions
  if (prevNode.t === 'mul' && prevNode.op === '/' && prevNode.r.t === 'add' && nextNode.t === 'add') {
    const splitNode = addNode(prevNode.r.op, mulNode('/', prevNode.l, prevNode.r.l), mulNode('/', prevNode.l, prevNode.r.r))
    if (trigExprEquivalent(nextNode, splitNode, opts)) {
      return {
        id: 'trig_split_denominator',
        witness: 'A sum or difference in the denominator cannot be split into separate fractions.',
      }
    }
  }

  // 3. Cancel across sum: prev is `(a ± b) / c` and next canceled `c` from only one term
  if (prevNode.t === 'mul' && prevNode.op === '/' && prevNode.l.t === 'add') {
    const a = prevNode.l.l
    const b = prevNode.l.r
    const c = prevNode.r
    const op = prevNode.l.op
    const cancelFirst = addNode(op, mulNode('/', a, c), b)
    const cancelSecond = addNode(op, a, mulNode('/', b, c))
    if (trigExprEquivalent(nextNode, cancelFirst, opts) || trigExprEquivalent(nextNode, cancelSecond, opts)) {
      return {
        id: 'trig_cancel_across_sum',
        witness: 'The denominator divides every term of the numerator, not just one term.',
      }
    }
  }

  // 4. Square dropped: `prev` has squares and `next` is equivalent to `prev` with squares replaced by first powers
  if (prevStats.totalSquares > nextStats.totalSquares) {
    // Check if squaring `next` (when `prev` is a single squared trig function like `cos²x` and `next` is `cos x`) matches `prev`
    const sqNext: ExprNode = { t: 'pow', base: nextNode, exp: numNode(2) }
    if (trigExprEquivalent(prevNode, sqNext, opts)) {
      // From a Pythagorean combination like `1 − sin²x`, writing the partner without its square
      // (`cos x`) is the identity misremembered without squares, not merely a dropped exponent.
      const bare = nextNode.t === 'neg' ? nextNode.arg : nextNode
      if (prevNode.t === 'add' && bare.t === 'fn') {
        return {
          id: 'trig_pythag_no_square',
          witness: 'The Pythagorean identity ties the squares together: keep the square until a square root removes it.',
        }
      }
      return {
        id: 'trig_square_dropped',
        witness: 'Keep the square on the trig function.',
      }
    }
  }

  // 5. Pythagorean without squares: e.g. `sin x + cos x -> 1` or `1 - cos x -> sin x`
  if (prevStats.totalSquares === 0 && isOne(nextNode)) {
    if (prevStats.fns.sin > 0 && prevStats.fns.cos > 0 && prevNode.t === 'add') {
      return {
        id: 'trig_pythag_no_square',
        witness: 'Only the squares add to one: sin squared plus cos squared equals one.',
      }
    }
  }

  // 6. Quotient inverted: `prev` is equivalent to `tan x` (or `cot x`) and `next` is equivalent to `cot x` (or `tan x`)
  if (
    (trigExprEquivalent(prevNode, fnNode('tan', v), opts) && trigExprEquivalent(nextNode, fnNode('cot', v), opts)) ||
    (trigExprEquivalent(prevNode, fnNode('cot', v), opts) && trigExprEquivalent(nextNode, fnNode('tan', v), opts))
  ) {
    return {
      id: 'trig_quotient_inverted',
      witness: 'tan is sin over cos, and cot is cos over sin.',
    }
  }

  // 7. Reciprocal wrong pair: `prev` is equivalent to `sec x` (or `csc x`) and `next` is equivalent to `csc x` (or `sec x`)
  if (
    (trigExprEquivalent(prevNode, fnNode('sec', v), opts) && trigExprEquivalent(nextNode, fnNode('csc', v), opts)) ||
    (trigExprEquivalent(prevNode, fnNode('csc', v), opts) && trigExprEquivalent(nextNode, fnNode('sec', v), opts))
  ) {
    return {
      id: 'trig_reciprocal_wrong_pair',
      witness: 'sec goes with cos, and csc goes with sin.',
    }
  }

  return null
}

/**
 * Verify a student's trig identity step `prev -> next`.
 */
export function verifyTrigStep(prev: string, next: string, ctx: TrigStepContext = {}): TrigStepResult {
  const variable = ctx.variable ?? (prev.includes('θ') || next.includes('θ') ? 'θ' : 'x')
  const prevRead = readTrigIdentityExpr(prev, { variable })
  if (!prevRead.ok) {
    return { ok: false, verdict: 'parse_error', done: false, message: prevRead.message }
  }
  const nextRead = readTrigIdentityExpr(next, { variable })
  if (!nextRead.ok) {
    return { ok: false, verdict: 'parse_error', done: false, message: nextRead.message }
  }

  const prevNode = prevRead.node
  const nextNode = nextRead.node

  // Repeating the exact same expression is not a new step
  if (sameExprForm(prevNode, nextNode)) {
    return {
      ok: false,
      verdict: 'unchanged',
      done: false,
      tex: nextRead.tex,
      message: 'That line is the same expression as the line above it. Write a step that transforms it.',
    }
  }

  const kind = ctx.kind ?? (ctx.target ? 'verify' : 'simplify')
  const eqOpts = { variable, quadrant: ctx.quadrant, seed: ctx.seed }

  if (trigExprEquivalent(prevNode, nextNode, eqOpts)) {
    // In `ti.verify`, jumping directly from the starting left-hand side to the target right-hand side in one step
    // is restating the identity rather than verifying it.
    if (kind === 'verify' && ctx.target) {
      const startExpr = ctx.start ?? prev
      const atStart = sameTrigExpr(prevNode, startExpr, variable)
      const isTarget = sameTrigExpr(nextNode, ctx.target, variable)
      if (atStart && isTarget) {
        return {
          ok: false,
          verdict: 'unverified_jump',
          done: false,
          tex: nextRead.tex,
          message: 'Show at least one intermediate identity step that transforms the left side into the right side.',
        }
      }
      const family = detectTrigStepFamily(prevNode, nextNode, variable)
      return {
        ok: true,
        verdict: 'equivalent',
        done: isTarget,
        family,
        tex: nextRead.tex,
        normalizedText: trigIdentityText(nextNode),
        message: isTarget ? 'Identity verified.' : 'Equivalent to the previous line.',
      }
    }

    const done = isSimplifiedTrig(nextNode, variable) || (ctx.target ? sameTrigExpr(nextNode, ctx.target, variable) : false)
    const family = detectTrigStepFamily(prevNode, nextNode, variable)
    return {
      ok: true,
      verdict: 'equivalent',
      done,
      family,
      tex: nextRead.tex,
      normalizedText: trigIdentityText(nextNode),
      message: done ? 'Simplified.' : 'Equivalent to the previous line.',
    }
  }

  // Not equivalent: match against generated slips of `prev` first
  const candidates = trigIdentitySlips(prev, { ...ctx, variable })
  for (const cand of candidates) {
    const cr = readTrigIdentityExpr(cand.text, { variable })
    if (cr.ok && trigExprEquivalent(nextNode, cr.node, eqOpts)) {
      return {
        ok: false,
        verdict: 'not_equivalent',
        done: false,
        tex: nextRead.tex,
        pattern: patternHit(cand.mistake, cand.witness),
        message: cand.witness,
      }
    }
  }

  // Fallback structural slip matcher
  const fallback = detectStructuralSlip(prevNode, nextNode, eqOpts)
  if (fallback) {
    return {
      ok: false,
      verdict: 'not_equivalent',
      done: false,
      tex: nextRead.tex,
      pattern: patternHit(fallback.id, fallback.witness),
      message: fallback.witness,
    }
  }

  return {
    ok: false,
    verdict: 'not_equivalent',
    done: false,
    tex: nextRead.tex,
    message: 'This line is not equal to the line above it. Check which fundamental identity applies here.',
  }
}

// ---------------------------------------------------------------------------
// Grading for ti.express ("Write f(θ) in terms of g(θ) in Quadrant Q")
// ---------------------------------------------------------------------------

export interface ExpressPairSpec {
  targetFn: TrigFn
  givenFn: TrigFn
  quadrant: Quadrant
  /** The Pythagorean identity tying the pair ('sin²θ + cos²θ = 1' | '1 + tan²θ = sec²θ' | '1 + cot²θ = csc²θ'). */
  identityText: string
  /** '+' or '−': the sign of targetFn in `quadrant`. */
  signText: '+' | '−'
  /** Canonical answer expression in θ (e.g. '−√(1 − cos²θ)'). */
  answerText: string
  answerLatex: string
}

export type ExpressPartGrade =
  | { verdict: 'correct' }
  | { verdict: 'invalid'; message: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'mistake'; id: ErrorPatternId; witness: string }

function usedTrigFunctions(node: ExprNode, out = new Set<TrigFn>()): Set<TrigFn> {
  switch (node.t) {
    case 'neg':
      usedTrigFunctions(node.arg, out)
      return out
    case 'add':
    case 'mul':
      usedTrigFunctions(node.l, out)
      usedTrigFunctions(node.r, out)
      return out
    case 'pow':
      usedTrigFunctions(node.base, out)
      usedTrigFunctions(node.exp, out)
      return out
    case 'fn':
      if (TRIG_FN_NAMES.has(node.name)) out.add(node.name as TrigFn)
      usedTrigFunctions(node.arg, out)
      return out
    default:
      return out
  }
}

/**
 * Grade the final expression of a `ti.express` problem ("Write targetFn θ in terms of givenFn θ in Quadrant Q").
 */
export function gradeTiExpressExpr(spec: ExpressPairSpec, raw: string): ExpressPartGrade {
  const read = readTrigIdentityExpr(raw, { variable: 'θ' })
  if (!read.ok) return { verdict: 'invalid', message: read.message }

  const fns = usedTrigFunctions(read.node)
  if (fns.size === 0) {
    return { verdict: 'invalid', message: `Write your expression in terms of ${spec.givenFn} θ.` }
  }
  for (const fn of fns) {
    if (fn !== spec.givenFn) {
      return {
        verdict: 'invalid',
        message: `Write your answer using only ${spec.givenFn} θ, not ${fn} θ.`,
      }
    }
  }

  const targetRead = readTrigIdentityExpr(spec.answerText, { variable: 'θ' })
  if (!targetRead.ok) return { verdict: 'wrong', message: 'Check your expression.' }
  const targetNode = targetRead.node
  const eqOpts = { variable: 'θ' as const, quadrant: spec.quadrant }
  // Slip candidates are matched as the expression she wrote, not on the quadrant: a bogus rewrite
  // like −√(csc θ − 1) can be undefined on the given quadrant yet still be exactly what she typed.
  const slipEq = (a: ExprNode, b: ExprNode) => sameTrigExpr(a, b, 'θ') || trigExprEquivalent(a, b, { variable: 'θ' })

  if (trigExprEquivalent(read.node, targetNode, eqOpts)) {
    return { verdict: 'correct' }
  }

  // 1. Opposite sign in the quadrant (e.g. +√(1 − cos²θ) instead of −√(1 − cos²θ) in QIII)
  if (trigExprOpposite(read.node, targetNode, eqOpts)) {
    return {
      verdict: 'mistake',
      id: 'trig_identity_sign_lost',
      witness: `In Quadrant ${['I', 'II', 'III', 'IV'][spec.quadrant - 1]}, ${spec.targetFn} θ is ${
        spec.signText === '+' ? 'positive' : 'negative'
      }, so the radical takes a ${spec.signText} sign.`,
    }
  }

  // 2. Wrong sign inside the Pythagorean radical (e.g. −√(1 + cos²θ) or √(1 − tan²θ) or √(sec²θ + 1))
  const wrongPythagTexts = [
    spec.answerText.replace('1 − ', '1 + '),
    spec.answerText.replace('1 + ', '1 − '),
    spec.answerText.replace(' − 1', ' + 1'),
    spec.answerText.replace(/^−/, '').replace('1 − ', '1 + '),
    spec.answerText.replace(/^−/, '').replace('1 + ', '1 − '),
    spec.answerText.replace(/^−/, '').replace(' − 1', ' + 1'),
  ]
  for (const wt of wrongPythagTexts) {
    if (wt === spec.answerText) continue
    const wr = readTrigIdentityExpr(wt, { variable: 'θ' })
    if (wr.ok && slipEq(read.node, wr.node)) {
      return {
        verdict: 'mistake',
        id: 'trig_pythag_sign',
        witness: `Check the sign inside the radical from ${spec.identityText}.`,
      }
    }
  }

  // 3. Pythagorean identity used without squaring the given function (e.g. −√(1 − cos θ) or 1 − cos θ)
  const noSquareTexts = [
    spec.answerText.replace(/²/g, ''),
    spec.answerText.replace(/^−/, '').replace(/²/g, ''),
    `1 − ${spec.givenFn} θ`,
    `−(1 − ${spec.givenFn} θ)`,
    `1 + ${spec.givenFn} θ`,
    `${spec.givenFn} θ − 1`,
  ]
  for (const ns of noSquareTexts) {
    const nr = readTrigIdentityExpr(ns, { variable: 'θ' })
    if (nr.ok && slipEq(read.node, nr.node)) {
      return {
        verdict: 'mistake',
        id: 'trig_pythag_no_square',
        witness: `The Pythagorean identity uses ${spec.givenFn}²θ, with the square kept inside the radical.`,
      }
    }
  }

  // 4. Forgot the square root altogether (e.g. −(1 − cos²θ) or 1 − cos²θ)
  const unrootedTexts = [
    `1 − ${spec.givenFn}²θ`,
    `−(1 − ${spec.givenFn}²θ)`,
    `1 + ${spec.givenFn}²θ`,
    `−(1 + ${spec.givenFn}²θ)`,
    `${spec.givenFn}²θ − 1`,
    `−(${spec.givenFn}²θ − 1)`,
  ]
  for (const ur of unrootedTexts) {
    const urRead = readTrigIdentityExpr(ur, { variable: 'θ' })
    if (urRead.ok && slipEq(read.node, urRead.node)) {
      return {
        verdict: 'mistake',
        id: 'trig_square_dropped',
        witness: `That expression is for ${spec.targetFn}²θ; take the square root to get ${spec.targetFn} θ.`,
      }
    }
  }

  // 5. Inverted quotient (e.g. √(1 − sin²θ) / sin θ for tan θ in terms of sin θ)
  const invTarget: ExprNode = mulNode('/', numNode(1), targetNode)
  const negInvTarget: ExprNode = negNode(invTarget)
  if (slipEq(read.node, invTarget) || slipEq(read.node, negInvTarget)) {
    const isRecipPair =
      (spec.targetFn === 'sec' || spec.targetFn === 'csc') && (spec.givenFn === 'sin' || spec.givenFn === 'cos')
    return {
      verdict: 'mistake',
      id: isRecipPair ? 'trig_reciprocal_wrong_pair' : 'trig_quotient_inverted',
      witness: isRecipPair
        ? 'sec is one over cos and csc is one over sin.'
        : 'tan θ is sin θ over cos θ, and cot θ is cos θ over sin θ.',
    }
  }

  return {
    verdict: 'wrong',
    message: `Solve ${spec.identityText} for ${spec.targetFn} θ and apply the ${spec.signText} sign for Quadrant ${
      ['I', 'II', 'III', 'IV'][spec.quadrant - 1]
    }.`,
  }
}
