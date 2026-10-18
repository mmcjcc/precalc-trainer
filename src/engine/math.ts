import { create, all, type MathNode } from 'mathjs'

/** `predictable: true` keeps sqrt(-4) = NaN (not Complex) and (-8)^(1/3) = -2. */
export const math = create(all, { predictable: true })
export type { MathNode }

/**
 * log_b(x) for numbers. Exact integer results come out exact (log(243, 3) is 5, not 4.999999999999999):
 * when b^k reproduces x exactly for the nearest integer k, k is the answer. x ≤ 0, b ≤ 0 and b = 1 give
 * NaN (the evaluator's 'undef').
 */
export function logBase(x: number, b: number): number {
  if (!(b > 0) || b === 1 || !(x > 0)) return Number.NaN
  const v = b === 10 ? Math.log10(x) : b === 2 ? Math.log2(x) : Math.log(x) / Math.log(b)
  const k = Math.round(v)
  if (Math.abs(v - k) < 1e-9 * Math.max(1, Math.abs(k)) && Math.abs(k) <= 1074 && b ** k === x) return k
  return v
}

/**
 * The app's logarithms (her course and her TI-84): log(x) is base 10, ln(x) is base e, log(x, b) is base
 * b. math.js on its own has no `ln` and reads a one-argument `log` as the NATURAL log, so both are
 * defined here; the parser (logs/syntax.ts) turns log_2(8), log2(8) and logBASE(8, 2) into log(8, 2).
 * Only `log1p` and `kldivergence` depend on math.js's own `log`, and the app uses neither.
 */
math.import(
  {
    ln: math.typed('ln', { number: (x: number) => (x > 0 ? Math.log(x) : Number.NaN) }),
    log: math.typed('log', {
      number: (x: number) => (x > 0 ? Math.log10(x) : Number.NaN),
      'number, number': (x: number, b: number) => logBase(x, b),
    }),
  },
  { override: true },
)

export const FUNC_NAMES = new Set([
  'sqrt',
  'cbrt',
  'abs',
  'nthroot',
  'nthRoot',
  'root',
  'log',
  'ln',
  'log10',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'exp',
  'min',
  'max',
  'floor',
  'ceil',
  'round',
  'sign',
])

function rec(node: MathNode): Record<string, unknown> {
  return node as unknown as Record<string, unknown>
}

export function stripParens(node: MathNode): MathNode {
  return node.transform((n) => {
    if (n.type === 'ParenthesisNode' && 'content' in n) {
      // transform() does not descend into a replacement node, so strip nested parentheses too:
      // ((5(x+h) - 2 - (5x - 2)))/h would otherwise keep its inner ParenthesisNodes.
      return stripParens(rec(n).content as MathNode)
    }
    return n
  })
}

function almostInt(x: number): number | null {
  const r = Math.round(x)
  return Math.abs(x - r) < 1e-10 ? r : null
}

export function approxFraction(x: number, maxDen = 12): { num: number; den: number } {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  let best = { num: Math.round(ax), den: 1, err: Math.abs(ax - Math.round(ax)) }
  for (let den = 1; den <= maxDen; den++) {
    const num = Math.round(ax * den)
    const err = Math.abs(ax - num / den)
    if (err < best.err - 1e-12 || (Math.abs(err - best.err) < 1e-12 && den < best.den)) {
      best = { num, den, err }
    }
  }
  return { num: sign * best.num, den: best.den }
}

export function tryConst(node: MathNode): number | null {
  try {
    const v = node.evaluate()
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

/**
 * Rewrite E^(p/q) with odd q as nthRoot(E,q)^p so negatives stay real. Only an exponent that IS p/q is
 * rewritten (x^(1/3), x^(2/5)): a decimal exponent such as 10^0.4771 or e^0.33 keeps its own value
 * (approxFraction alone would turn 0.4771 into 5/11 and 0.33 into 1/3).
 */
export function normalizeOddRoots(node: MathNode): MathNode {
  return node.transform((n) => {
    if (n.type !== 'OperatorNode' || rec(n).op !== '^') return n
    const args = rec(n).args as MathNode[] | undefined
    if (!args || args.length !== 2) return n
    const exp = tryConst(args[1])
    if (exp == null) return n
    const { num, den } = approxFraction(exp, 12)
    if (den <= 1) return n
    if (Math.abs(exp - num / den) > 1e-12 * Math.max(1, Math.abs(exp))) return n
    const baseSrc = `(${args[0].toString()})`
    if (den % 2 === 1) {
      const root = `nthRoot(${baseSrc}, ${den})`
      return stripParens(math.parse(num === 1 ? root : `(${root})^(${num})`))
    }
    if (den === 2 && num === 1) {
      return stripParens(math.parse(`sqrt(${baseSrc})`))
    }
    return n
  })
}

export function compileExpression(src: string): MathNode {
  const parsed = math.parse(src)
  return normalizeOddRoots(stripParens(parsed))
}

/** Relative tolerance: |a−b| ≤ 1e-9·max(1, |a|, |b|, scale). */
export function nearlyEqual(a: number, b: number, scale = 1): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b), scale)
}

// ---------------------------------------------------------------------------
// Evaluation with a compile cache (node.evaluate() recompiles on every call, ~7x slower).
// ---------------------------------------------------------------------------

type Compiled = { evaluate: (scope?: Record<string, number>) => unknown }
const COMPILED = new WeakMap<MathNode, Compiled>()

function compiledOf(node: MathNode): Compiled {
  let c = COMPILED.get(node)
  if (!c) {
    c = node.compile() as Compiled
    COMPILED.set(node, c)
  }
  return c
}

/** NaN / Infinity / Complex / thrown error ⇒ 'undef'. */
export function evalNode(node: MathNode, scope: Record<string, number>): number | 'undef' {
  try {
    const v = compiledOf(node).evaluate(scope)
    if (typeof v !== 'number' || !Number.isFinite(v)) return 'undef'
    return v
  } catch {
    return 'undef'
  }
}

/**
 * Magnitude of the top-level operands of `node` at `scope` (0 when it has none or they are
 * undefined). Makes the tolerance relative to operand size: (x+1)^3 − x^3 at x = 250 has
 * operands ~1.6e7 while the difference is ~1.9e5.
 */
export function operandScale(node: MathNode, scope: Record<string, number>): number {
  if (node.type !== 'OperatorNode') return 0
  let s = 0
  for (const a of nodeArgs(node)) {
    const v = evalNode(a, scope)
    if (v !== 'undef') s = Math.max(s, Math.abs(v))
  }
  return s
}

// ---------------------------------------------------------------------------
// AST helpers
// ---------------------------------------------------------------------------

export function collectVars(node: MathNode): string[] {
  const found = new Set<string>()
  const skip = new Set(['pi', 'e', 'inf', 'infinity', 'true', 'false', ...FUNC_NAMES])
  node.traverse((n, _path, parent) => {
    if (n.type !== 'SymbolNode' || !('name' in n)) return
    const name = (n as { name: string }).name
    if (skip.has(name) || name.startsWith('__')) return
    if (parent && parent.type === 'FunctionNode' && (parent as { fn?: MathNode }).fn === n) return
    found.add(name)
  })
  return [...found].sort()
}

export function substituteVars(node: MathNode, map: Record<string, string>): MathNode {
  const tmp: Record<string, string> = {}
  const back: Record<string, string> = {}
  let i = 0
  for (const [from, to] of Object.entries(map)) {
    const token = `__s${i++}`
    tmp[from] = token
    back[token] = to
  }
  const rename = (n: MathNode, dict: Record<string, string>) =>
    n.transform((cur) => {
      if (cur.type === 'SymbolNode' && 'name' in cur) {
        const name = (cur as { name: string }).name
        if (dict[name]) return math.parse(dict[name])
      }
      return cur
    })
  return rename(rename(node, tmp), back)
}

export function negateNode(node: MathNode): MathNode {
  return compileExpression(`-(${node.toString()})`)
}

export function nodeArgs(node: MathNode): MathNode[] {
  const args = rec(node).args
  return Array.isArray(args) ? (args as MathNode[]) : []
}

export function isOp(node: MathNode, op: string): boolean {
  return node.type === 'OperatorNode' && rec(node).op === op
}

export function isFn(node: MathNode, name: string): boolean {
  return fnName(node) === name
}

export function fnName(node: MathNode): string | null {
  if (node.type !== 'FunctionNode') return null
  const fn = rec(node).fn
  if (typeof fn === 'string') return fn
  if (fn && typeof fn === 'object' && 'name' in fn) return (fn as { name?: string }).name ?? null
  return null
}

export function isUnaryMinus(node: MathNode): boolean {
  return (
    node.type === 'OperatorNode' &&
    (rec(node).fn === 'unaryMinus' || (rec(node).op === '-' && nodeArgs(node).length === 1))
  )
}

export function isNumberNode(node: MathNode): boolean {
  return node.type === 'ConstantNode' && typeof rec(node).value === 'number'
}

export function symbolName(node: MathNode): string | null {
  if (node.type !== 'SymbolNode' || !('name' in node)) return null
  return (node as { name: string }).name
}

export function walkNode(node: MathNode, visit: (n: MathNode) => void): void {
  visit(node)
  for (const a of nodeArgs(node)) walkNode(a, visit)
}

/** The log functions of app syntax (after the parser's rewrite): log(u), log(u, b), ln(u), and math.js's log10/log2. */
export const LOG_FUNCS: ReadonlySet<string> = new Set(['log', 'ln', 'log10', 'log2'])

/**
 * Sub-expressions that bound the domain of `node`:
 *  - `zero`: must be ≠ 0 (denominators, bases of negative powers, b − 1 for a log with a variable base b),
 *  - `nonneg`: must be ≥ 0 (sqrt radicands, even nthRoot radicands, bases of x^(p/q) with even q),
 *  - `pos`: must be > 0 (log arguments, and the base of a log when it has a variable in it).
 * Their roots are domain-boundary points for the Tier-2 boundary method.
 */
export function domainSubexpressions(node: MathNode): { zero: MathNode[]; nonneg: MathNode[]; pos: MathNode[] } {
  const zero: MathNode[] = []
  const nonneg: MathNode[] = []
  const pos: MathNode[] = []
  walkNode(node, (n) => {
    const fn = fnName(n)
    if (fn && LOG_FUNCS.has(fn)) {
      const [a, b] = nodeArgs(n)
      if (a && collectVars(a).length) pos.push(a)
      if (b && collectVars(b).length) {
        pos.push(b)
        zero.push(compileExpression(`(${b.toString()}) - 1`))
      }
      return
    }
    if (isOp(n, '/')) {
      const d = nodeArgs(n)[1]
      if (d && collectVars(d).length) zero.push(d)
      return
    }
    if (isFn(n, 'sqrt')) {
      const a = nodeArgs(n)[0]
      if (a && collectVars(a).length) nonneg.push(a)
      return
    }
    if (isFn(n, 'nthRoot') || isFn(n, 'nthroot') || isFn(n, 'root')) {
      const [a, k] = nodeArgs(n)
      const kv = k ? tryConst(k) : 2
      if (a && collectVars(a).length && kv != null && Math.round(kv) % 2 === 0) nonneg.push(a)
      return
    }
    if (isOp(n, '^')) {
      const [base, exp] = nodeArgs(n)
      if (!base || !exp) return
      const ev = tryConst(exp)
      if (ev == null || !collectVars(base).length) return
      if (almostInt(ev) == null) {
        const { den } = approxFraction(ev, 12)
        if (den % 2 === 0) nonneg.push(base)
      } else if (ev < 0) {
        zero.push(base)
      }
    }
  })
  return { zero, nonneg, pos }
}

export { almostInt }
