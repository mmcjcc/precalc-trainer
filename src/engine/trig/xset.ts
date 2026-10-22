/**
 * Sets of x-values (Unit 5): the vertical asymptotes or the zeros of tan, cot, sec and csc, as a family
 * "x = π/4 + kπ/2" (k an integer) or as a list in an interval, "x = π/4, x = 3π/4". Every equal set is right: any base
 * of the family (π/4 + kπ/2 is −π/4 + kπ/2 and 3π/4 + kπ/2), any letter (k, n, m, j), (2k + 1)π/4 as well as
 * π/4 + kπ/2, and two families that together make the set (π/4 + kπ and 3π/4 + kπ). Sets are compared exactly: every
 * value is a rational multiple of π (or a rational, when the period has no π), a family by its residues modulo the
 * common period.
 */
import { exactAdd, exactDiv, exactEq, exactNeg, exactNum, exactTex, isZero, type TrigExact } from './exact'
import { evalExprExact, hasTrigFunction, readExpr } from './expr'
import type { TrigGrade } from './grade'
import { gcd, q, qSub, type Q } from './rational'
import type { TrigMistakeId } from './types'
import { familyTex, normalFamily, type XFamily } from './wave'

export interface XSet {
  values: TrigExact[]
  families: XFamily[]
}

export type XSetRead = { ok: true; set: XSet; tex: string } | { ok: false; message: string }

const LETTERS = ['k', 'n', 'm', 'j']

/** "k is an integer", "k ∈ ℤ", "where k is any integer", "for any integer k", "(k an integer)", "k in Z", "k = 0, ±1, ±2, …". */
const QUALIFIERS: readonly RegExp[] = [
  /[,;]?\s*\(?\s*(?:(?:where|for|with)\s+)?[knmj]\s*(?:∈|in|is|are)\s*(?:an?\s+|any\s+)?(?:integers?|ℤ|z|whole\s+numbers?)\s*\)?\s*\.?$/i,
  /[,;]?\s*\(?\s*(?:(?:where|for|with)\s+)?[knmj]\s+(?:an?|any)\s+(?:integers?|whole\s+numbers?)\s*\)?\s*\.?$/i,
  /[,;]?\s*\(?\s*(?:where|for|with)\s+(?:(?:any|all|every|each|some)\s+)?(?:integers?|whole\s+numbers?)\s+[knmj]\s*\)?\s*\.?$/i,
  /[,;]?\s*\(?\s*[knmj]\s*=\s*0\s*,\s*(?:±|\+-)\s*1\s*,\s*(?:±|\+-)\s*2\s*,?\s*(?:\.\.\.|…)\s*\)?\s*\.?$/i,
]

function stripQualifier(t: string): string {
  let s = t.trim()
  for (let i = 0; i < 4; i++) {
    const hit = QUALIFIERS.map((re) => re.exec(s)).find((m) => m && m[0].trim() !== '')
    if (!hit) break
    s = s.slice(0, hit.index).trim()
  }
  return s
}

function splitItems(t: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (depth === 0 && (c === ',' || c === ';')) {
      out.push(t.slice(start, i))
      start = i + 1
    }
  }
  out.push(t.slice(start))
  return out
    .flatMap((s) => s.split(/\s+(?:and|or)\s+/i))
    .map((s) => s.trim())
    .filter(Boolean)
}

/** The value of an item at letter = n, or why it cannot be read as an x-value. */
function valueAt(node: Parameters<typeof evalExprExact>[0], letter: string | null, n: number): TrigExact | null {
  const env: Record<string, TrigExact> = letter ? { [letter]: { c: q(n), root: 1, pi: 0 } } : {}
  const v = evalExprExact(node, env)
  if (v.k !== 'exact' || v.v.root !== 1 || v.v.pi < 0 || v.v.pi > 1) return null
  return v.v
}

/**
 * Why an item is not one exact x-value: a decimal, a trig function left in, a division by zero, or a sum of a number
 * and a multiple of π. The words never write a value (no bare π a list of x-values could hold).
 */
function notOneNumber(item: string, node: Parameters<typeof evalExprExact>[0], letter: string | null): string {
  if (/\d*\.\d/.test(item)) return 'Write each x-value exactly, with fractions instead of decimals.'
  if (hasTrigFunction(node)) return 'Work the trig function out first: each x-value is one exact number.'
  if (evalExprExact(node, letter ? { [letter]: { c: q(0), root: 1, pi: 0 } } : {}).k === 'undef') return 'Nothing can be divided by zero: each x-value is one exact number.'
  return 'Each x-value is one exact number, like a/b or aπ/b, not a sum of the two kinds.'
}

/** Read a set of x-values: a list, one or more families, or both. */
export function readXSet(raw: string): XSetRead {
  let t = (raw ?? '').replace(/[−–—]/g, '-').replace(/[   ]/g, ' ').trim()
  if (!t) return { ok: false, message: 'Type your answer first.' }
  t = t.replace(/^\{(.*)\}$/s, '$1').trim()
  t = stripQualifier(t)
  const items = splitItems(t)
  if (!items.length) return { ok: false, message: 'Type your answer first.' }
  const set: XSet = { values: [], families: [] }
  const texs: string[] = []
  for (const item0 of items) {
    let item = item0
    const eq = item.split('=')
    if (eq.length > 2) return { ok: false, message: 'Write each value as x = a number, separated by commas.' }
    if (eq.length === 2) {
      if (!/^x$/i.test(eq[0]!.trim())) return { ok: false, message: 'These are x-values: write each one as x = …' }
      item = eq[1]!.trim()
    }
    if (!item) return { ok: false, message: 'Something is missing after an equals sign.' }
    const r = readExpr(item, { vars: LETTERS, varWords: 'The only letter in an x-value is k, the integer.' })
    if (!r.ok) return { ok: false, message: r.message }
    if (r.used.length > 1) return { ok: false, message: 'Use one letter, k, for the integer in each family.' }
    const letter = r.used[0] ?? null
    const vals = [-1, 0, 1, 2, 3].map((n) => valueAt(r.node, letter, n))
    if (vals.some((v) => v === null)) return { ok: false, message: notOneNumber(item, r.node, letter) }
    const [vm, v0, v1, v2, v3] = vals as TrigExact[]
    texs.push(`${eq.length === 2 ? 'x = ' : ''}${r.tex}`)
    if (!letter) {
      set.values.push(v0!)
      continue
    }
    const step = exactAdd(v1!, exactNeg(v0!))
    if (!step || isZero(step)) return { ok: false, message: 'k has to change the value: write a family as a + kp, with p the distance between neighbours.' }
    const linear = [exactAdd(v2!, exactNeg(v1!)), exactAdd(v3!, exactNeg(v2!)), exactAdd(v0!, exactNeg(vm!))].every((d) => d && exactEq(d, step))
    if (!linear) return { ok: false, message: 'Write a family as a + kp: a starting value plus k times the distance between neighbours.' }
    if (!isZero(v0!) && v0!.pi !== step.pi) return { ok: false, message: 'In a family a + kp, a and p are measured the same way: both with π, or both without.' }
    set.families.push(normalFamily(v0!, step))
  }
  return { ok: true, set, tex: texs.join(',\\; ') }
}

// ---------------------------------------------------------------------------
// Equality
// ---------------------------------------------------------------------------

const qKey = (v: Q) => `${v.n}/${v.d}`

function lcmInt(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b)
}

/** The common period of rational steps n/d: lcm of the tops over the common bottom. */
function lcmQ(steps: readonly Q[]): Q {
  const D = steps.reduce((acc, s) => lcmInt(acc, s.d), 1)
  const tops = steps.map((s) => (s.n * D) / s.d)
  const L = tops.reduce((acc, t) => lcmInt(acc, t), 1)
  return q(L, D)
}

/** r mod L, in [0, L). */
function modQ(r: Q, L: Q): Q {
  const k = Math.floor((r.n * L.d) / (r.d * L.n))
  return qSub(r, q(k * L.n, L.d))
}

/** The π power every value and step shares (0 or 1), or null when they are mixed. */
function kindOf(set: XSet): number | null {
  const all = [...set.values, ...set.families.flatMap((f) => [f.base, f.step])].filter((v) => !isZero(v))
  if (!all.length) return 0
  const p = all[0]!.pi
  return all.every((v) => v.pi === p) ? p : null
}

function inFamily(v: TrigExact, f: XFamily): boolean {
  const d = exactAdd(v, exactNeg(f.base))
  if (!d) return false
  if (isZero(d)) return true
  const r = exactDiv(d, f.step)
  return r.root === 1 && r.pi === 0 && r.c.d === 1
}

function contains(set: XSet, v: TrigExact): boolean {
  return set.values.some((w) => exactEq(w, v)) || set.families.some((f) => inFamily(v, f))
}

function residues(fams: readonly XFamily[], L: Q): Set<string> | null {
  const out = new Set<string>()
  for (const f of fams) {
    const count = (L.n * f.step.c.d) / (L.d * f.step.c.n)
    if (!Number.isInteger(count) || count > 240) return null
    for (let j = 0; j < count; j++) out.add(qKey(modQ(q(f.base.c.n * f.step.c.d + j * f.step.c.n * f.base.c.d, f.base.c.d * f.step.c.d), L)))
  }
  return out
}

/** Are two sets of x-values the same set? */
export function sameXSet(a: XSet, b: XSet): boolean {
  const fa = a.families.length > 0
  const fb = b.families.length > 0
  if (fa !== fb) return false
  if (!fa) {
    const uniq = (vs: TrigExact[]) => vs.filter((v, i) => vs.findIndex((w) => exactEq(w, v)) === i)
    const ua = uniq(a.values)
    const ub = uniq(b.values)
    return ua.length === ub.length && ua.every((v) => ub.some((w) => exactEq(v, w)))
  }
  const ka = kindOf(a)
  const kb = kindOf(b)
  if (ka === null || kb === null) return false
  const all = [...a.families, ...b.families]
  if (all.some((f) => f.step.pi !== all[0]!.step.pi)) return false
  // Bases measured as the steps are (a zero base has no π of its own).
  const fix = (f: XFamily): XFamily => ({ base: isZero(f.base) ? { c: q(0), root: 1, pi: f.step.pi } : f.base, step: f.step })
  const L = lcmQ(all.map((f) => f.step.c))
  const ra = residues(a.families.map(fix), L)
  const rb = residues(b.families.map(fix), L)
  if (!ra || !rb || ra.size !== rb.size || [...ra].some((r) => !rb.has(r))) return false
  return a.values.every((v) => contains(b, v)) && b.values.every((v) => contains(a, v))
}

/** The members of a set between lo and hi (numbers), in order: a family's members there, and the listed values. */
export function membersBetween(set: XSet, lo: number, hi: number): TrigExact[] {
  const out: TrigExact[] = [...set.values.filter((v) => exactNum(v) > lo && exactNum(v) < hi)]
  for (const f of set.families) {
    const s = exactNum(f.step)
    const b = exactNum(f.base)
    for (let k = Math.ceil((lo - b) / s) - 1; b + k * s < hi; k++) {
      const x = b + k * s
      if (x <= lo || x >= hi) continue
      const v = exactAdd(f.base, { c: q(k * f.step.c.n, f.step.c.d), root: 1, pi: f.step.pi })
      if (v && !out.some((w) => exactEq(w, v))) out.push(v)
    }
  }
  return out.sort((x, y) => exactNum(x) - exactNum(y))
}

/** KaTeX of a set: the families, then the values. */
export function xSetTex(set: XSet): string {
  return [...set.families.map((f) => familyTex(f)), ...set.values.map((v) => `x = ${exactTex(v)}`)].join(',\\; ')
}

export interface XSetCandidate {
  id: TrigMistakeId
  set: XSet
  witness: string
}

export interface XSetSpec {
  answer: XSet
  /** The part asks for the values in this open interval (a list); absent: the whole family. */
  between?: [number, number]
  /** "asymptotes" or "x-intercepts", for the notes. */
  what: string
}

/** Grade her set against the answer and this problem's slips. */
export function gradeXSet(spec: XSetSpec, typed: string, candidates: readonly XSetCandidate[]): TrigGrade {
  const r = readXSet(typed)
  if (!r.ok) return { verdict: 'invalid', reason: 'unreadable', message: r.message }
  const her = r.set
  if (sameXSet(her, spec.answer)) return { verdict: 'correct', message: `Correct: those are the ${spec.what}.` }
  for (const c of candidates) if (sameXSet(her, c.set)) return { verdict: 'mistake', mistake: c.id, witness: c.witness }
  const answerInfinite = spec.answer.families.length > 0
  if (answerInfinite && her.families.length === 0 && her.values.length > 0 && her.values.every((v) => contains(spec.answer, v))) {
    return { verdict: 'invalid', reason: 'unreadable', message: `Those are ${spec.what}, but there are infinitely many, one set in every period. Write them as a family, x = a + kp, with k an integer.` }
  }
  if (!answerInfinite && spec.between && her.families.length > 0) {
    const [lo, hi] = spec.between
    const inside = membersBetween(her, lo, hi)
    if (inside.length === spec.answer.values.length && inside.every((v) => spec.answer.values.some((w) => exactEq(v, w)))) {
      return { verdict: 'invalid', reason: 'unreadable', message: `This part asks only for the ${spec.what} in the interval given: list just those, separated by commas.` }
    }
  }
  if (!answerInfinite && her.families.length === 0 && her.values.length > 0 && her.values.length < spec.answer.values.length && her.values.every((v) => spec.answer.values.some((w) => exactEq(v, w)))) {
    return { verdict: 'invalid', reason: 'unreadable', message: `Your list is right as far as it goes, but there are more ${spec.what} in that interval.` }
  }
  return { verdict: 'wrong', message: `Those are not the ${spec.what}.` }
}
