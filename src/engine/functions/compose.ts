/**
 * Composition of functions: f(g(x)) as text (unsimplified with g IN PARENTHESES, then simplified), the
 * exact value (f o g)(a), the domain of f o g = {x in dom g : g(x) in dom f}, the decomposition check,
 * the mistake candidates and the graders.
 *
 * The composite domain is computed from dom g and the preimage of dom f under g — never from the
 * simplified formula, which can hide g's restriction: f(x) = x^2, g(x) = sqrt(x) gives x, but the
 * domain is [0, ∞).
 */
import type { Rational, SolutionSet } from '@/shared/types'
import { rat, ratFromString, ratToNumber, ratToString } from '@/notation/rational'
import { components, isFiniteEndpoint, setContains, setIntersection, setIsSubset, setsEqual } from '@/notation/sets/solutionSet'
import { nicestWitness } from '@/notation/sets/compare'
import { exprEquivalent } from '../expressions'
import { evalNode, fnName, isOp, nodeArgs, type MathNode } from '../math'
import { parseExpression } from '../parse'
import { niceNumber } from '../samples'
import { parseSetAnswer, parseValueAnswer } from './answer'
import {
  attempt,
  dedupeCandidates,
  evalText,
  gradeSetAgainst,
  num,
  parseFunction,
  pointIn,
  valueText,
} from './common'
import { whyUndefined } from './domain'
import {
  exactConstant,
  exactEval,
  exactLiteral,
  surdEquals,
  surdMul,
  surdRational,
  surdToNumber,
  surdToText,
  type Surd,
} from './exact'
import { polyEquals, polyMul, ratFnOf } from './poly'
import { analyzeDomain, domainSet, preimage, unwrap, valueAt, type DomainAnalysis } from './solve'
import {
  builderText,
  canonicalText,
  describeText,
  intervalText,
  predicateText,
  pretty,
  prettySet,
  showNode,
  substituteBare,
  substituteText,
  substituteValueText,
} from './text'
import type {
  ExpressionMistakeCandidate,
  FunctionGrade,
  SetMistakeCandidate,
  ValueMistakeCandidate,
} from './types'

// ---------------------------------------------------------------------------
// Parsing the pair
// ---------------------------------------------------------------------------

interface Pair {
  f: MathNode
  g: MathNode
  fText: string
  gText: string
  /** f(g(x)) exactly as substituted (g in parentheses), parsed. */
  composite: MathNode
  unsimplified: string
}

function parsePair(f: string, g: string): Pair | null {
  const pf = parseFunction(f)
  const pg = parseFunction(g)
  if (!pf.ok || !pg.ok) return null
  const fText = showNode(pf.node)
  const gText = showNode(pg.node)
  const unsimplified = substituteText(fText, gText)
  const pc = parseExpression(unsimplified, ['x'])
  if (!pc.ok) return null
  return { f: pf.node, g: pg.node, fText, gText, composite: pc.node, unsimplified }
}

// ---------------------------------------------------------------------------
// Simplifying
// ---------------------------------------------------------------------------

function intExponent(node: MathNode): number | null {
  const e = attempt(() => exactConstant(node))
  return e && e.d === 1 ? e.n : null
}

/** (sqrt(u))^2 → u, (nthRoot(u, n))^n → u, (cbrt(u))^3 → u, cbrt(u^3) → u (valid wherever defined). */
function simplifyRoots(node: MathNode): MathNode {
  const n = unwrap(node)
  const mapped = n.map((child) => simplifyRoots(child))
  const m = unwrap(mapped)
  const args = nodeArgs(m)
  if (isOp(m, '^')) {
    const k = intExponent(args[1]!)
    const base = unwrap(args[0]!)
    const bArgs = nodeArgs(base)
    const name = fnName(base)
    if (k === 2 && name === 'sqrt') return bArgs[0]!
    if (k === 3 && name === 'cbrt') return bArgs[0]!
    if (name === 'nthRoot' && k !== null && intExponent(bArgs[1]!) === k) return bArgs[0]!
  }
  const name = fnName(m)
  if (name === 'cbrt' || (name === 'nthRoot' && (intExponent(args[1]!) ?? 0) % 2 === 1)) {
    const k = name === 'cbrt' ? 3 : intExponent(args[1]!)!
    const inner = unwrap(args[0]!)
    if (isOp(inner, '^') && intExponent(nodeArgs(inner)[1]!) === k) return nodeArgs(inner)[0]!
  }
  return mapped
}

/** Rational points spread over a set (for comparing two formulas on it). */
function probePoints(set: SolutionSet, perPiece = 6): Rational[] {
  const out: Rational[] = []
  const offsets = [rat(1, 3), rat(1), rat(2), rat(7, 2), rat(6), rat(13)]
  for (const c of components(set)) {
    const lo = c.lo
    const hi = c.hi
    if (isFiniteEndpoint(lo) && isFiniteEndpoint(hi)) {
      if (lo.n * hi.d === hi.n * lo.d) {
        out.push(lo)
        continue
      }
      for (let k = 1; k <= perPiece; k++) {
        const t = ratToNumber(lo) + ((ratToNumber(hi) - ratToNumber(lo)) * k) / (perPiece + 1)
        out.push(rationalNear(t, lo, hi))
      }
    } else if (isFiniteEndpoint(lo)) {
      for (const o of offsets.slice(0, perPiece)) out.push(rat(lo.n * o.d + o.n * lo.d, lo.d * o.d))
    } else if (isFiniteEndpoint(hi)) {
      for (const o of offsets.slice(0, perPiece)) out.push(rat(hi.n * o.d - o.n * hi.d, hi.d * o.d))
    } else {
      out.push(...[rat(-7), rat(-5, 2), rat(-1), rat(-1, 3), rat(1, 2), rat(2), rat(4), rat(9)])
    }
  }
  return out
}

/** A simple rational strictly inside (lo, hi) near t. */
function rationalNear(t: number, lo: Rational, hi: Rational): Rational {
  for (const d of [1, 2, 3, 4, 6, 8, 12, 24, 48, 96]) {
    const r = rat(Math.round(t * d), d)
    const v = ratToNumber(r)
    if (v > ratToNumber(lo) && v < ratToNumber(hi)) return r
  }
  return rat(Math.round(t * 1e6), 1e6)
}

type Val = Surd | number | 'undef'

function valAt(node: MathNode, t: Rational | Surd | number): Val {
  if (typeof t === 'number') {
    const f = evalNode(node, { x: t })
    return f === 'undef' ? 'undef' : f
  }
  const v = attempt(() => valueAt(node, t))
  if (v === null) return 'undef'
  if (typeof v === 'number') return Number.isFinite(v) ? v : 'undef'
  return v
}

function sameVal(a: Val, b: Val): boolean {
  if (a === 'undef' || b === 'undef') return a === b
  if (typeof a !== 'number' && typeof b !== 'number') return surdEquals(a, b)
  const x = typeof a === 'number' ? a : surdToNumber(a)
  const y = typeof b === 'number' ? b : surdToNumber(b)
  return Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y))
}

const GENERIC_PROBES: readonly Rational[] = (
  [[-9, 2], [-3, 1], [-2, 1], [-3, 2], [-1, 1], [-1, 3], [0, 1], [1, 4], [1, 2], [1, 1], [3, 2], [2, 1], [5, 2], [3, 1], [4, 1], [13, 3], [6, 1], [7, 1], [10, 1]] as const
).map(([n, d]) => rat(n, d))

/** Probes spread over each piece of `set`, plus the generic probes that fall inside it. */
function probesIn(set: SolutionSet): Rational[] {
  return [...probePoints(set), ...GENERIC_PROBES.filter((t) => setContains(set, t))]
}

/**
 * Two rational expressions are the same rational function exactly when num_a·den_b = num_b·den_a
 * (a proof, not a sample). null when either is not a rational expression.
 */
function rationalIdentity(a: MathNode, b: MathNode): boolean | null {
  const fa = ratFnOf(a)
  const fb = ratFnOf(b)
  if (!fa || !fb) return null
  return attempt(() => polyEquals(polyMul(fa.num, fb.den), polyMul(fb.num, fa.den)))
}

/**
 * `her` equals `target` on `set` (a subset of target's domain). Rational expressions: exact identity
 * plus her domain containing the set. Otherwise every probe of the set, exactly when both values are
 * surds.
 */
function sameOnSet(her: MathNode, target: MathNode, set: SolutionSet): boolean {
  const id = rationalIdentity(her, target)
  const dh = attempt(() => domainSet(her))
  if (id === false) return false
  if (id === true && dh) return setIsSubset(set, dh)
  const pts = probesIn(set)
  if (!pts.length) return false
  return pts.every((t) => {
    const a = valAt(target, t)
    return a !== 'undef' && sameVal(a, valAt(her, t))
  })
}

/**
 * Same function where both are defined: equal at every probe of the overlap of their exact domains
 * (when those are known and the overlap is more than a few points), else on the generic probes
 * (≥ 5 defined for both, at most 1 one-sided point).
 */
function sameWhereDefined(a: MathNode, b: MathNode): boolean {
  const da = attempt(() => domainSet(a))
  const db = attempt(() => domainSet(b))
  const id = rationalIdentity(a, b)
  if (id === false) return false
  if (da && db) {
    const common = setIntersection(da, db)
    if (!common.pieces.length) return false
    if (id === true) return true
    return probesIn(common).every((t) => {
      const va = valAt(a, t)
      const vb = valAt(b, t)
      return va !== 'undef' && vb !== 'undef' && sameVal(va, vb)
    })
  }
  let both = 0
  let oneSided = 0
  for (const t of GENERIC_PROBES) {
    const va = valAt(a, t)
    const vb = valAt(b, t)
    if (va === 'undef' && vb === 'undef') continue
    if (va === 'undef' || vb === 'undef') {
      oneSided++
      continue
    }
    if (!sameVal(va, vb)) return false
    both++
  }
  return both >= 5 && oneSided <= 1
}

/** Defined on a whole interval (a formula undefined everywhere is nobody's realistic answer). */
function definedSomewhere(node: MathNode): boolean {
  const d = attempt(() => domainSet(node))
  if (d) return d.pieces.length > 0
  return GENERIC_PROBES.filter((t) => valAt(node, t) !== 'undef').length >= 5
}

function simplifiedOf(pair: Pair, dom: SolutionSet | null): string {
  const s = attempt(() => canonicalText(simplifyRoots(pair.composite)))
  if (!s) return pair.unsimplified
  const p = parseExpression(s, ['x'])
  if (!p.ok) return pair.unsimplified
  const ok = dom ? sameOnSet(p.node, pair.composite, dom) : sameWhereDefined(p.node, pair.composite)
  return ok ? s : pair.unsimplified
}

export interface CompositionText {
  /** "(x - 3)^2 + 1": every x in f replaced by (g), the line she should write first. */
  unsimplified: string
  /** "x^2 - 6x + 10". Equal to the unsimplified form on the composite's domain. */
  simplified: string
}

/** f(g(x)) as text, or null when f or g does not parse. */
export function composeText(f: string, g: string): CompositionText | null {
  const pair = parsePair(f, g)
  if (!pair) return null
  const dom = attempt(() => compositeDomainSet(pair))
  return { unsimplified: pair.unsimplified, simplified: simplifiedOf(pair, dom) }
}

// ---------------------------------------------------------------------------
// Composite domain
// ---------------------------------------------------------------------------

function compositeDomainSet(pair: Pair): SolutionSet {
  return preimage(pair.g, domainSet(pair.f))
}

export interface CompositeDomainResult {
  set: SolutionSet
  interval: string
  builder: string
  /** dom g. */
  innerDomain: SolutionSet
  /** dom f. */
  outerDomain: SolutionSet
  /** The simplified formula of f(g(x)) and the domain it would suggest on its own (null if not exact). */
  simplified: string
  simplifiedDomain: SolutionSet | null
  /** The simplified formula's own domain differs from the true one (the trap). */
  hidesRestriction: boolean
  explanation: string[]
}

interface CompositeModel {
  pair: Pair
  fa: DomainAnalysis
  ga: DomainAnalysis
  result: CompositeDomainResult
}

function relWord(rel: string): string {
  return rel === '!=' ? '≠' : rel === '>=' ? '≥' : '>'
}

function compositeModel(pair: Pair): CompositeModel {
  const fa = analyzeDomain(pair.f)
  const ga = analyzeDomain(pair.g)
  const set = compositeDomainSet(pair)
  const simplified = simplifiedOf(pair, set)
  const ps = parseExpression(simplified, ['x'])
  const simplifiedDomain = ps.ok ? attempt(() => domainSet(ps.node)) : null
  const hides = simplifiedDomain !== null && !setsEqual(simplifiedDomain, set)
  const lines: string[] = []
  if (ga.restrictions.length) {
    lines.push(`First, x must be in the domain of g(x) = ${pretty(pair.gText)}: ${prettySet(ga.set)} (${pretty(describeText(ga.set))}).`)
  } else {
    lines.push(`g(x) = ${pretty(pair.gText)} is defined for every real x.`)
  }
  if (!fa.restrictions.length) {
    lines.push(`f(x) = ${pretty(pair.fText)} accepts every real number, so every output of g is allowed.`)
  }
  for (const r of fa.restrictions) {
    const pre = preimage(pair.g, r.set)
    const inner = substituteText(r.expr, pair.gText)
    lines.push(
      `f(x) = ${pretty(pair.fText)} needs ${pretty(r.expr)} ${relWord(r.relation)} 0. With g(x) in place of x that is ${pretty(inner)} ${relWord(r.relation)} 0, which holds for ${pretty(predicateText(pre))}.`,
    )
  }
  lines.push(`Domain of f∘g: ${prettySet(set)} (${pretty(describeText(set))}).`)
  if (hides && simplifiedDomain) {
    lines.push(
      `Careful: the simplified formula ${pretty(simplified)} on its own would allow ${prettySet(simplifiedDomain)}, but g(x) has to be defined first, so the domain stays ${prettySet(set)}.`,
    )
  }
  return {
    pair,
    fa,
    ga,
    result: {
      set,
      interval: intervalText(set),
      builder: builderText(set),
      innerDomain: ga.set,
      outerDomain: fa.set,
      simplified,
      simplifiedDomain,
      hidesRestriction: hides,
      explanation: lines,
    },
  }
}

/** Domain of f o g, exact, with the explanation; null outside the exact model. */
export function compositeDomain(f: string, g: string): CompositeDomainResult | null {
  const pair = parsePair(f, g)
  if (!pair) return null
  return attempt(() => compositeModel(pair).result)
}

/** Why x = w is not in dom(f o g): g undefined there, or g(w) outside dom f. */
function compositeWhy(m: CompositeModel, w: Rational): string {
  const gv = valAt(m.pair.g, w)
  if (gv === 'undef') return `g(${num(w)}) is undefined (${whyUndefined(m.ga, w)}), so f(g(${num(w)})) is undefined too`
  const gt = pretty(valueText(gv))
  const why = typeof gv === 'number' ? 'it is outside the domain of f' : whyUndefined(m.fa, gv)
  return `g(${num(w)}) = ${gt}, and f(${gt}) is undefined (${why.replace(/ there/, ` at x = ${gt}`)})`
}

function compositeWorks(m: CompositeModel, w: Rational): string {
  const gv = valAt(m.pair.g, w)
  const fv = gv === 'undef' ? 'undef' : valAt(m.pair.f, gv)
  if (gv === 'undef' || fv === 'undef') return ''
  return `g(${num(w)}) = ${pretty(valueText(gv))} and f(${pretty(valueText(gv))}) = ${pretty(valueText(fv))}`
}

function compositeCandidates(m: CompositeModel): SetMistakeCandidate[] {
  const T = m.result.set
  const out: SetMistakeCandidate[] = []
  const sd = m.result.simplifiedDomain
  if (sd) {
    const extra = pointIn(sd, T)
    const missing = pointIn(T, sd, m.pair.composite)
    const tail = extra
      ? `x = ${num(extra)} is in your answer, but ${compositeWhy(m, extra)}.`
      : missing
        ? `x = ${num(missing)} works (${compositeWorks(m, missing)}), but your answer leaves it out.`
        : ''
    out.push({
      kind: 'composite_domain_simplified',
      set: sd,
      interval: intervalText(sd),
      witness: `That is the domain of the simplified formula ${pretty(m.result.simplified)} alone, but simplifying can hide a restriction. ${tail} The domain of f∘g is every x in the domain of g whose output g(x) is in the domain of f.`.replace(/\s+/g, ' ').trim(),
    })
  }
  const dg = m.ga.set
  const extra = pointIn(dg, T)
  out.push({
    kind: 'composite_domain_inner_only',
    set: dg,
    interval: intervalText(dg),
    witness: `You kept only the domain of g. Its output g(x) also has to be an allowed input for f${extra ? `: at x = ${num(extra)}, ${compositeWhy(m, extra)}` : ''}.`,
  })
  return dedupeCandidates(T, out)
}

/** What each composite-domain mistake produces (distinct from the answer and each other), or null. */
export function compositeDomainMistakes(f: string, g: string): SetMistakeCandidate[] | null {
  const pair = parsePair(f, g)
  if (!pair) return null
  return attempt(() => compositeCandidates(compositeModel(pair)))
}

/** Grade her domain of f o g (a SolutionSet, or text in any form `parseSetAnswer` reads). */
export function gradeCompositeDomain(f: string, g: string, answer: SolutionSet | string): FunctionGrade {
  const pair = parsePair(f, g)
  if (!pair) return { verdict: 'unsupported', message: `f(x) = ${f} or g(x) = ${g} does not parse.` }
  const m = attempt(() => compositeModel(pair))
  if (!m) return { verdict: 'unsupported', message: `The domain of f∘g for f(x) = ${f}, g(x) = ${g} is outside what the checker can find exactly.` }
  let her: SolutionSet
  if (typeof answer === 'string') {
    const a = parseSetAnswer(answer)
    if (!a.ok) return { verdict: 'invalid', message: a.error.message, position: a.error.position, length: a.error.length }
    her = a.set
  } else her = answer
  const T = m.result.set
  const plain = () => {
    const w = nicestWitness(her, T)
    if (!w) return 'That set is not the domain of f∘g.'
    if (setContains(her, w)) return `Your answer includes x = ${num(w)}, but ${compositeWhy(m, w)}.`
    const p = pointIn(T, her, m.pair.composite) ?? w
    return `x = ${num(p)} is in the domain of f∘g (${compositeWorks(m, p)}), but your answer leaves it out.`
  }
  const cands = attempt(() => compositeCandidates(m)) ?? []
  return gradeSetAgainst(her, T, cands, plain, `Correct: the domain of f∘g is ${prettySet(T)}.`)
}

// ---------------------------------------------------------------------------
// f(g(x)) as a formula: candidates and grading
// ---------------------------------------------------------------------------

const X_TOKEN = /(?<![A-Za-z])x(?![A-Za-z])/g

function partialTexts(f: string, g: string): { text: string; none: boolean }[] {
  const pos = [...f.matchAll(X_TOKEN)].map((mt) => mt.index ?? 0)
  if (pos.length < 1 || pos.length > 4) return []
  const out: { text: string; none: boolean }[] = []
  for (let mask = 0; mask < (1 << pos.length) - 1; mask++) {
    let text = ''
    let last = 0
    pos.forEach((p, k) => {
      text += f.slice(last, p) + (((mask >> k) & 1) === 1 ? `(${g})` : 'x')
      last = p + 1
    })
    out.push({ text: text + f.slice(last), none: mask === 0 })
  }
  return out
}

function nodeOf(text: string): MathNode | null {
  const p = parseExpression(text, ['x'])
  return p.ok ? p.node : null
}

/** Probe x values: integers near 0 inside the composite's domain, then its probe points. */
function witnessCandidates(dom: SolutionSet | null): Rational[] {
  const out: Rational[] = []
  for (const k of [1, 2, 0, -1, 3, -2, 4, -3, 5, 6, -4, 7, 9, -5, 10]) {
    if (!dom || setContains(dom, rat(k))) out.push(rat(k))
  }
  if (dom) out.push(...probePoints(dom))
  return out
}

function isNice(v: Val): boolean {
  if (v === 'undef' || typeof v === 'number') return false
  const r = surdRational(v)
  return !!r && r.d <= 6
}

/** The friendliest x (in the composite's domain) where the wrong formula differs from f(g(x)). */
function differingPoint(target: MathNode, wrong: MathNode, dom: SolutionSet | null): Rational | null {
  let fallback: Rational | null = null
  for (const t of witnessCandidates(dom)) {
    const a = valAt(target, t)
    const b = valAt(wrong, t)
    if (a === 'undef' || b === 'undef' || sameVal(a, b)) continue
    if (isNice(a) && isNice(b)) return t
    fallback ??= t
  }
  return fallback
}

function vt(v: Val): string {
  return v === 'undef' ? 'undefined' : pretty(valueText(v))
}

/** A value as a factor or summand: negatives and sums in parentheses, "2·(−2)". */
function vp(v: Val): string {
  const t = vt(v)
  return /^−|\s/.test(t) ? `(${t})` : t
}

function expressionCandidates(pair: Pair, dom: SolutionSet | null): ExpressionMistakeCandidate[] {
  const { f, g, fText, gText, composite, unsimplified } = pair
  const out: (ExpressionMistakeCandidate & { node: MathNode })[] = []
  const at = (wrong: MathNode, describe: (p: Rational) => string): string => {
    const p = differingPoint(composite, wrong, dom)
    if (!p) return ''
    const gp = valAt(g, p)
    const fgp = valAt(composite, p)
    return ` At x = ${num(p)}: f(g(${num(p)})) = f(${vt(gp)}) = ${vt(fgp)}, but ${describe(p)}.`
  }
  const push = (kind: ExpressionMistakeCandidate['kind'], text: string, witness: (node: MathNode) => string) => {
    const node = nodeOf(text)
    if (!node) return
    out.push({ kind, text, node, witness: witness(node).trim() })
  }
  const bare = substituteBare(fText, gText)
  push('compose_no_parens', bare, (node) => {
    return `Put g(x) in parentheses when you substitute: x → (${pretty(gText)}) turns ${pretty(fText)} into ${pretty(unsimplified)}. Without them it reads ${pretty(bare)}, and f's exponents and coefficients reach only part of ${pretty(gText)}.${at(node, (p) => `${pretty(bare)} gives ${vt(valAt(node, p))}`)}`
  })
  for (const part of partialTexts(fText, gText)) {
    push('compose_partial_sub', part.text, (node) => {
      const lead = part.none
        ? `Your answer is still f(x): none of the x's became (${pretty(gText)}).`
        : `Your answer ${pretty(part.text)} replaced some x's with (${pretty(gText)}) and left others as x.`
      return `${lead} Every x in f must become (${pretty(gText)}): ${pretty(unsimplified)}.${at(node, (p) => `your line gives ${vt(valAt(node, p))}`)}`
    })
  }
  push('compose_product', `(${fText})(${gText})`, (node) => {
    return `Your answer is f(x)·g(x) = (${pretty(fText)})(${pretty(gText)}): you multiplied the two formulas. f(g(x)) puts g(x) inside f: replace every x in f with (${pretty(gText)}) to get ${pretty(unsimplified)}.${at(node, (p) => `f(${num(p)})·g(${num(p)}) = ${vp(valAt(f, p))}·${vp(valAt(g, p))} = ${vt(valAt(node, p))}`)}`
  })
  const reversed = substituteText(gText, fText)
  push('compose_reversed', reversed, (node) => {
    return `Your answer is g(f(x)) = ${pretty(reversed)}: g on the outside. f(g(x)) is the other order, f on the outside with g(x) inside: ${pretty(unsimplified)}.${at(node, (p) => `g(f(${num(p)})) = g(${vt(valAt(f, p))}) = ${vt(valAt(node, p))}`)}`
  })
  push('compose_sum', `${fText} + (${gText})`, (node) => {
    return `Your answer is f(x) + g(x) = ${pretty(fText)} + (${pretty(gText)}): you added the formulas. f(g(x)) means replace every x in f with (${pretty(gText)}): ${pretty(unsimplified)}.${at(node, (p) => `f(${num(p)}) + g(${num(p)}) = ${vt(valAt(f, p))} + ${vp(valAt(g, p))} = ${vt(valAt(node, p))}`)}`
  })
  // Keep the candidates that are defined on an interval, differ from f(g(x)) and from every earlier one.
  const kept: typeof out = []
  for (const c of out) {
    if (!definedSomewhere(c.node)) continue
    if (sameWhereDefined(c.node, composite)) continue
    if (kept.some((k) => sameWhereDefined(k.node, c.node))) continue
    kept.push(c)
  }
  return kept.map(({ kind, text, witness }) => ({ kind, text, witness }))
}

/** What each f(g(x)) mistake produces for this f and g (distinct from the answer), or null. */
export function compositionMistakes(f: string, g: string): ExpressionMistakeCandidate[] | null {
  const pair = parsePair(f, g)
  if (!pair) return null
  const dom = attempt(() => compositeDomainSet(pair))
  return expressionCandidates(pair, dom)
}

const COMPOSITE_LABEL = /^\s*(?:\(\s*[a-z]\s*(?:o|∘|\*|·)\s*[a-z]\s*\)\s*\(\s*x\s*\)|[a-z]\s*\(\s*[a-z]\s*\(\s*x\s*\)\s*\))\s*=/i

/**
 * Grade her f(g(x)). Correct when her formula equals f(g(x)) at every probe of the composite's domain
 * (unsimplified or simplified, any equivalent form; "f(g(x)) =" or "(f o g)(x) =" in front is fine).
 */
export function gradeComposition(f: string, g: string, answer: string): FunctionGrade {
  const pair = parsePair(f, g)
  if (!pair) return { verdict: 'unsupported', message: `f(x) = ${f} or g(x) = ${g} does not parse.` }
  const label = answer.match(COMPOSITE_LABEL)
  const body = label ? answer.slice(label[0].length) : answer
  const shift = label ? label[0].length : 0
  if (!body.trim()) return { verdict: 'invalid', message: 'Type f(g(x)) first.', position: 0 }
  const p = parseExpression(body, ['x'])
  if (!p.ok) return { verdict: 'invalid', message: p.error.message, position: p.error.position + shift, length: p.error.length }
  const dom = attempt(() => compositeDomainSet(pair))
  const correct = dom
    ? sameOnSet(p.node, pair.composite, dom)
    : exprEquivalent(pair.unsimplified, p.text, ['x']).equivalent
  if (correct) {
    return { verdict: 'correct', message: `Correct: f(g(x)) = ${pretty(pair.unsimplified)}.` }
  }
  for (const c of expressionCandidates(pair, dom)) {
    const node = nodeOf(c.text)
    if (node && sameWhereDefined(p.node, node)) return { verdict: 'mistake', mistake: c.kind, witness: c.witness }
  }
  const w = differingPoint(pair.composite, p.node, dom)
  if (w) {
    const gp = valAt(pair.g, w)
    return {
      verdict: 'wrong',
      message: `At x = ${num(w)}: f(g(${num(w)})) = f(${vt(gp)}) = ${vt(valAt(pair.composite, w))}, but your expression gives ${vt(valAt(p.node, w))}. Replace every x in f with (${pretty(pair.gText)}).`,
    }
  }
  // Same values where both are defined, but hers is undefined somewhere in the domain.
  const herDom = attempt(() => domainSet(p.node))
  const probe = dom ? ((herDom && pointIn(dom, herDom)) ?? probesIn(dom).find((t) => valAt(p.node, t) === 'undef')) : undefined
  if (probe) {
    return {
      verdict: 'wrong',
      message: `At x = ${num(probe)}, f(g(${num(probe)})) = ${vt(valAt(pair.composite, probe))}, but your expression is undefined there.`,
    }
  }
  return { verdict: 'wrong', message: `That is not f(g(x)). Replace every x in f with (${pretty(pair.gText)}): ${pretty(pair.unsimplified)}.` }
}

// ---------------------------------------------------------------------------
// (f o g)(a)
// ---------------------------------------------------------------------------

export interface ExactNumber {
  /** Exact value when it is in the model (rational or rational combination of square roots). */
  exact: Surd | null
  approx: number
  /** "11", "-1/2", "2sqrt(3)" (app syntax). */
  text: string
}

export type CompositeValue =
  | { defined: true; value: ExactNumber; inner: ExactNumber; steps: string[] }
  | { defined: false; reason: 'inner' | 'outer'; inner?: ExactNumber; steps: string[] }

/**
 * An exact value, or (outside the exact model, e.g. cbrt(5)) the float with the unevaluated expression
 * as its text, so the text is still exact and grades correct when she types it.
 */
function toExactNumber(v: Surd | number, expression?: string): ExactNumber {
  if (typeof v === 'number') return { exact: null, approx: v, text: expression ?? niceNumber(v) }
  return { exact: v, approx: surdToNumber(v), text: surdToText(v) }
}

function ratOf(a: Rational | number | string): Rational | null {
  if (typeof a === 'string') return ratFromString(a)
  if (typeof a === 'number') return attempt(() => exactLiteral(a))
  return a
}

function compositeValueOf(pair: Pair, a: Rational): CompositeValue {
  const aText = ratToString(a)
  const gv = valAt(pair.g, a)
  const gSub = substituteValueText(pair.gText, aText)
  const gLine = `g(${num(a)}) = ${pretty(gSub)}`
  if (gv === 'undef') {
    const ga = attempt(() => analyzeDomain(pair.g))
    const why = ga ? whyUndefined(ga, a) : 'it is outside the domain of g'
    return {
      defined: false,
      reason: 'inner',
      steps: [`${gLine} is undefined: ${why}.`, `So (f∘g)(${num(a)}) is undefined: ${num(a)} is not in the domain of g, so it is not in the domain of f∘g.`],
    }
  }
  const inner = toExactNumber(gv, gSub)
  const fv = valAt(pair.f, gv)
  const fSub = substituteValueText(pair.fText, inner.text)
  const fLine = `f(${pretty(inner.text)}) = ${pretty(fSub)}`
  const upTo = (line: string, sub: string, v: ExactNumber) => (v.text === sub ? `${line}.` : `${line} = ${pretty(v.text)}.`)
  if (fv === 'undef') {
    const fa = attempt(() => analyzeDomain(pair.f))
    const why = fa && typeof gv !== 'number' ? whyUndefined(fa, gv) : 'it is outside the domain of f'
    return {
      defined: false,
      reason: 'outer',
      inner,
      steps: [
        upTo(gLine, gSub, inner),
        `${fLine} is undefined: ${why.replace(/ there/, ` at x = ${pretty(inner.text)}`)}.`,
        `So (f∘g)(${num(a)}) is undefined: g(${num(a)}) = ${pretty(inner.text)} is not in the domain of f.`,
      ],
    }
  }
  const value = toExactNumber(fv, fSub)
  return {
    defined: true,
    value,
    inner,
    steps: [upTo(gLine, gSub, inner), upTo(fLine, fSub, value), `(f∘g)(${num(a)}) = ${pretty(value.text)}.`],
  }
}

/** (f o g)(a) exactly, or "undefined" with the reason; null when f or g does not parse. */
export function compositeValue(f: string, g: string, a: Rational | number | string): CompositeValue | null {
  const pair = parsePair(f, g)
  const r = ratOf(a)
  if (!pair || !r) return null
  return attempt(() => compositeValueOf(pair, r))
}

function mulVal(a: Val, b: Val): Val {
  if (a === 'undef' || b === 'undef') return 'undef'
  if (typeof a !== 'number' && typeof b !== 'number') return attempt(() => surdMul(a, b)) ?? surdToNumber(a) * surdToNumber(b)
  const x = typeof a === 'number' ? a : surdToNumber(a)
  const y = typeof b === 'number' ? b : surdToNumber(b)
  return x * y
}

function valueCandidates(pair: Pair, a: Rational, cv: CompositeValue): (ValueMistakeCandidate & { value: Val })[] {
  const out: (ValueMistakeCandidate & { value: Val })[] = []
  const fa = valAt(pair.f, a)
  const ga = valAt(pair.g, a)
  const target: Val = cv.defined ? (cv.value.exact ?? cv.value.approx) : 'undef'
  let inside: string
  if (cv.defined) inside = `first g(${num(a)}) = ${pretty(cv.inner.text)}, then f(${pretty(cv.inner.text)}) = ${pretty(cv.value.text)}`
  else if (cv.reason === 'outer') inside = `first g(${num(a)}) = ${pretty(cv.inner!.text)}, then f(${pretty(cv.inner!.text)}) is undefined, so (f∘g)(${num(a)}) is undefined`
  else inside = `g(${num(a)}) is undefined, so (f∘g)(${num(a)}) is undefined`
  const prod = mulVal(fa, ga)
  if (prod !== 'undef') {
    out.push({
      kind: 'value_product',
      value: prod,
      text: valueText(prod),
      witness: `You multiplied f(${num(a)})·g(${num(a)}) = ${vp(fa)}·${vp(ga)} = ${vt(prod)}. (f∘g)(${num(a)}) means f(g(${num(a)})): ${inside}.`,
    })
  }
  if (fa !== 'undef') {
    const gfa = valAt(pair.g, fa)
    if (gfa !== 'undef') {
      out.push({
        kind: 'value_reversed',
        value: gfa,
        text: valueText(gfa),
        witness: `You found g(f(${num(a)})) = g(${vt(fa)}) = ${vt(gfa)}: that is (g∘f)(${num(a)}). For (f∘g)(${num(a)}) work from the inside out: ${inside}.`,
      })
    }
  }
  const kept: typeof out = []
  for (const c of out) {
    if (target !== 'undef' && sameVal(c.value, target)) continue
    if (kept.some((k) => sameVal(k.value, c.value))) continue
    kept.push(c)
  }
  return kept
}

/** What each (f o g)(a) mistake produces (distinct from the answer and each other), or null. */
export function compositeValueMistakes(f: string, g: string, a: Rational | number | string): ValueMistakeCandidate[] | null {
  const pair = parsePair(f, g)
  const r = ratOf(a)
  if (!pair || !r) return null
  return attempt(() => {
    const cv = compositeValueOf(pair, r)
    return valueCandidates(pair, r, cv).map(({ kind, text, witness }) => ({ kind, text, witness }))
  })
}

/** Grade her (f o g)(a): a number (exact comparison) or a word for "undefined". */
export function gradeCompositeValue(f: string, g: string, a: Rational | number | string, answer: string): FunctionGrade {
  const pair = parsePair(f, g)
  const r = ratOf(a)
  if (!pair || !r) return { verdict: 'unsupported', message: 'The problem does not parse.' }
  const cv = attempt(() => compositeValueOf(pair, r))
  if (!cv) return { verdict: 'unsupported', message: 'This value is outside what the checker can compute exactly.' }
  const ans = parseValueAnswer(answer)
  if (!ans.ok) return { verdict: 'invalid', message: ans.error.message, position: ans.error.position, length: ans.error.length }
  const steps = cv.steps.join(' ')
  if (ans.undefined) {
    return cv.defined
      ? { verdict: 'wrong', message: `(f∘g)(${num(r)}) is defined: ${steps}` }
      : { verdict: 'correct', message: `Correct: ${steps}` }
  }
  const herExact = attempt(() => exactEval(ans.node, null))
  const her: Val = herExact === null ? valAt(ans.node, rat(0)) : herExact
  if (her === 'undef') return { verdict: 'invalid', message: 'That value is undefined as written — check for division by 0 or a square root of a negative.' }
  const cands = valueCandidates(pair, r, cv)
  if (cv.defined) {
    const target: Val = cv.value.exact ?? cv.value.approx
    if (sameVal(her, target)) return { verdict: 'correct', message: `Correct: ${steps}` }
  }
  for (const c of cands) if (sameVal(her, c.value)) return { verdict: 'mistake', mistake: c.kind, witness: c.witness }
  if (!cv.defined) return { verdict: 'wrong', message: `(f∘g)(${num(r)}) is undefined: ${steps}` }
  const herNum = typeof her === 'number' ? her : surdToNumber(her)
  const exactTarget = cv.value.exact
  if (/\./.test(ans.text) && (!exactTarget || !surdRational(exactTarget)) && Math.abs(herNum - cv.value.approx) <= 0.01 * Math.max(1, Math.abs(cv.value.approx))) {
    return { verdict: 'wrong', message: `${pretty(ans.text)} is a rounded decimal. Give the exact value: (f∘g)(${num(r)}) = ${pretty(cv.value.text)}.` }
  }
  return { verdict: 'wrong', message: `Work from the inside out: ${steps} Your answer, ${pretty(herExact && herExact !== 'undef' ? surdToText(herExact) : ans.text)}, is not ${pretty(cv.value.text)}.` }
}

// ---------------------------------------------------------------------------
// Decomposition
// ---------------------------------------------------------------------------

export type DecompositionResult =
  | { ok: true; message: string }
  | {
      ok: false
      reason: 'parse_f' | 'parse_g' | 'trivial_f' | 'trivial_g' | 'not_equal' | 'domain' | 'unsupported'
      message: string
      position?: number
      length?: number
    }

/**
 * Her decomposition h = f o g. Accepted when f(g(x)) equals h (same values and, when both domains are
 * exact, the same domain) and neither f nor g is just x.
 */
export function checkDecomposition(h: string, f: string, g: string): DecompositionResult {
  const ph = parseFunction(h)
  if (!ph.ok) return { ok: false, reason: 'unsupported', message: `h(x) = ${h} does not parse.` }
  const pf = parseFunction(f)
  if (!pf.ok) return { ok: false, reason: 'parse_f', message: pf.error.message, position: pf.error.position, length: pf.error.length }
  const pg = parseFunction(g)
  if (!pg.ok) return { ok: false, reason: 'parse_g', message: pg.error.message, position: pg.error.position, length: pg.error.length }
  const isIdentity = (text: string) => exprEquivalent(text, 'x', ['x']).equivalent
  if (isIdentity(pf.text)) {
    return { ok: false, reason: 'trivial_f', message: 'f(x) = x does nothing: then g would have to be all of h. Pick an outer function f that does real work, like a square or a square root.' }
  }
  if (isIdentity(pg.text)) {
    return { ok: false, reason: 'trivial_g', message: 'g(x) = x does nothing: then f would have to be all of h. Pick an inner function g, the part of h that is computed first.' }
  }
  const pair = parsePair(pf.text, pg.text)
  if (!pair) return { ok: false, reason: 'unsupported', message: 'Could not build f(g(x)).' }
  const hNode = ph.node
  const domH = attempt(() => domainSet(hNode))
  const domFG = attempt(() => compositeDomainSet(pair))
  const w = differingPoint(hNode, pair.composite, domH)
  if (w) {
    return {
      ok: false,
      reason: 'not_equal',
      message: `f(g(x)) = ${pretty(pair.unsimplified)} is not h(x): at x = ${num(w)}, h(${num(w)}) = ${vt(valAt(hNode, w))}, but f(g(${num(w)})) = f(${vt(valAt(pair.g, w))}) = ${vt(valAt(pair.composite, w))}.`,
    }
  }
  if (domH && domFG && !setsEqual(domH, domFG)) {
    const extra = pointIn(domH, domFG)
    const detail = extra
      ? ` At x = ${num(extra)}, h(${num(extra)}) = ${vt(valAt(hNode, extra))}, but f(g(${num(extra)})) is undefined.`
      : ''
    return {
      ok: false,
      reason: 'domain',
      message: `f(g(x)) matches h(x) where both are defined, but not everywhere: f∘g has domain ${prettySet(domFG)}, h has ${prettySet(domH)}.${detail}`,
    }
  }
  const same = domH && domFG ? sameOnSet(pair.composite, hNode, domH) : exprEquivalent(pair.unsimplified, showNode(hNode), ['x']).equivalent
  if (!same) {
    return { ok: false, reason: 'not_equal', message: `f(g(x)) = ${pretty(pair.unsimplified)} does not match h(x) = ${pretty(showNode(hNode))}.` }
  }
  return { ok: true, message: `Yes: f(g(x)) = ${pretty(pair.unsimplified)} = h(x).` }
}

/** The composite f(g(x)) at a point, for display ("f(g(2)) = f(-1) = 2"); exported for flows. */
export function compositeAtText(f: string, g: string, x: Rational | number): string | null {
  const pair = parsePair(f, g)
  const r = ratOf(x)
  if (!pair || !r) return null
  const gv = evalText(pair.g, r)
  if (gv === 'undef') return `f(g(${num(r)})) is undefined: g(${num(r)}) is undefined`
  const fv = evalText(pair.composite, r)
  return `f(g(${num(r)})) = f(${pretty(gv)}) = ${fv === 'undef' ? 'undefined' : pretty(fv)}`
}

