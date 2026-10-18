/**
 * Domain-aware comparison of expressions.
 *
 * `compareOnDomain(prev, next)` is the rewrite rule a textbook uses: next must be defined at EVERY point
 * where prev is defined, and equal there. Points outside prev's domain do not matter, so condensing
 * 2 ln x into ln(x²) is fine (the new expression is defined in more places), while ln(x²) → 2 ln x is
 * not (at x = −1 the original is ln 1 = 0 and the new line is undefined), unless the problem says to
 * assume x > 0.
 *
 * Samples are drawn from INSIDE the domain: for one variable, from the domain's intervals (found from the
 * roots of every log input, radicand and denominator on the wide grid, see wide.ts); for two variables,
 * by rejection sampling (with positive points mixed in, so log(x) + log(y) gets enough of them).
 */
import { collectVars, evalNode, nearlyEqual, operandScale, type MathNode } from '../math'
import { mulberry32, type Scope } from '../samples'
import { domainOf, domainSamples, friendlyPoints, positivePart, type Domain1D } from './wide'

export interface CompareOptions {
  /** Every variable is assumed positive (the problem says so). */
  positive?: boolean
  seed?: number
}

export function varsOfNodes(nodes: readonly MathNode[]): string[] {
  return [...new Set(nodes.flatMap((n) => collectVars(n)))].sort()
}

function defined(nodes: readonly MathNode[], s: Scope): boolean {
  return nodes.every((n) => evalNode(n, s) !== 'undef')
}

const DOMAIN_MEMO = new Map<string, Domain1D>()

/** The one-variable domain of some trees, cut to (0, ∞) when the variable is assumed positive. Memoized by text. */
export function domain1D(nodes: readonly MathNode[], v: string, positive = false): Domain1D {
  const key = `${v}|${positive ? '+' : ''}|${nodes.map((n) => n.toString()).join(';')}`
  const hit = DOMAIN_MEMO.get(key)
  if (hit) return hit
  const d = domainOf(nodes, v)
  const out = positive ? positivePart(d) : d
  if (DOMAIN_MEMO.size > 512) DOMAIN_MEMO.clear()
  DOMAIN_MEMO.set(key, out)
  return out
}

/**
 * Scopes inside the domain of `ref` (every tree defined): friendly numbers first, then spread-out points.
 * One variable: from the domain's intervals. Two or more: rejection sampling. No variable: [{}].
 */
export function samplesInDomain(ref: readonly MathNode[], vars: readonly string[], opts: CompareOptions = {}): Scope[] {
  const seed = opts.seed ?? 0x2f6b
  if (vars.length === 0) return [{}]
  if (vars.length === 1) {
    const v = vars[0]!
    const d = domain1D(ref, v, opts.positive)
    const pts = [...friendlyPoints(d, 10), ...domainSamples(d, seed, 18)]
    const seen = new Set<string>()
    const out: Scope[] = []
    for (const t of pts) {
      const key = t.toPrecision(12)
      if (seen.has(key)) continue
      seen.add(key)
      const s = { [v]: t }
      if (defined(ref, s)) out.push(s)
    }
    return out
  }
  const rand = mulberry32(seed ^ 0x51ed27)
  const out: Scope[] = []
  const friendly = [1, 2, 3, 0.5, 4, 5, 10, 0.25, 7, 1.5]
  for (let i = 0; i < friendly.length && out.length < 6; i++) {
    const s: Scope = {}
    vars.forEach((v, j) => (s[v] = friendly[(i + 3 * j) % friendly.length]!))
    if (defined(ref, s)) out.push(s)
  }
  for (let i = 0; i < 600 && out.length < 28; i++) {
    const s: Scope = {}
    for (const v of vars) {
      const pos = opts.positive || rand() < 0.5
      s[v] = pos ? Math.exp(Math.log(0.05) + rand() * Math.log(40 / 0.05)) : rand() * 20 - 10
    }
    if (defined(ref, s)) out.push(s)
  }
  return out
}

export type DomainVerdict =
  /** Equal at every sampled point of prev's domain. `widened`: next is also defined somewhere prev is not. */
  | { kind: 'equal'; compared: number; widened: boolean }
  /** next is undefined at a point where prev is defined. */
  | { kind: 'domain_lost'; at: Scope; prevValue: number }
  /** Both defined, different values. */
  | { kind: 'different'; at: Scope; prevValue: number; nextValue: number }
  /** prev is defined nowhere we could sample. */
  | { kind: 'undecidable' }

function close(a: number, b: number, scale: number): boolean {
  return nearlyEqual(a, b, Math.max(Math.abs(a), Math.abs(b), scale))
}

/** The textbook rewrite test: next equals prev wherever prev is defined (within the assumption). */
export function compareOnDomain(prev: MathNode, next: MathNode, vars: readonly string[], opts: CompareOptions = {}): DomainVerdict {
  const samples = samplesInDomain([prev], vars, opts)
  if (samples.length < (vars.length ? 4 : 1)) return { kind: 'undecidable' }
  let lost: { at: Scope; prevValue: number } | null = null
  let diff: { at: Scope; prevValue: number; nextValue: number } | null = null
  for (const s of samples) {
    const a = evalNode(prev, s) as number
    const b = evalNode(next, s)
    if (b === 'undef') {
      lost ??= { at: s, prevValue: a }
      continue
    }
    const scale = Math.max(operandScale(prev, s), operandScale(next, s))
    if (!close(a, b, scale)) diff ??= { at: s, prevValue: a, nextValue: b }
  }
  if (diff) return { kind: 'different', ...diff }
  if (lost) return { kind: 'domain_lost', ...lost }
  return { kind: 'equal', compared: samples.length, widened: widens(prev, next, vars, opts) }
}

/** next is defined somewhere prev is not (condensing logs, dropping matching logs). */
function widens(prev: MathNode, next: MathNode, vars: readonly string[], opts: CompareOptions): boolean {
  const pts = samplesInDomain([next], vars, opts)
  return pts.some((s) => evalNode(prev, s) === 'undef')
}

/**
 * The same function: defined at the same sampled points (of either one's domain) and equal there, with at
 * least `min` points where both are defined. Used to recognise what a slip produces.
 */
export function sameFunction(a: MathNode, b: MathNode, vars: readonly string[], opts: CompareOptions & { min?: number } = {}): boolean {
  const samples = [...samplesInDomain([a], vars, opts), ...samplesInDomain([b], vars, { ...opts, seed: (opts.seed ?? 7) + 11 })]
  return sameOnSamples(a, b, samples, opts.min ?? (vars.length ? 5 : 1))
}

/** `sameFunction` on given samples (the checkers reuse one sample set for every candidate). */
export function sameOnSamples(a: MathNode, b: MathNode, samples: readonly Scope[], min = 5): boolean {
  let both = 0
  for (const s of samples) {
    const va = evalNode(a, s)
    const vb = evalNode(b, s)
    if (va === 'undef' && vb === 'undef') continue
    if (va === 'undef' || vb === 'undef') return false
    const scale = Math.max(operandScale(a, s), operandScale(b, s))
    if (!close(va, vb, scale)) return false
    both++
  }
  return both >= min
}
