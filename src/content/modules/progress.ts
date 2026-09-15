/**
 * Progress anchoring on the student's CURRENT line (research CG-05, BUILD_GUIDE §6).
 *
 * Every legal line of a problem is an equivalent relation, so relation equivalence cannot tell
 * where she is (after the first step every canonical line would "match"). Anchoring asks a
 * stricter question: is her line the same LINE as canonical line i up to same-side rewrites?
 * Each side must be expression-equivalent to the canonical side (or the sides swapped with the
 * symbol reversed), branch by branch for ± / or / chained lines in any order. That costs a few
 * sampled evaluations per canonical line and is cached per (problem, swapped, line).
 *
 * A line that matches no canonical line is legal but off the usual route: anchorIndex −1 and
 * nextStep null ("off the usual path"). Flows keep progress monotone by taking the best anchor
 * over all accepted lines, and decide completion with ModuleDef.solved, not with the anchor.
 */
import { collectVars, symbolName } from '@/engine/math'
import { parseStatement } from '@/engine/parse'
import { exprEquivalent } from '@/engine/samples'
import type { Relation, Statement } from '@/engine/types'
import type { CanonicalStep, ProblemInstance, ProgressInfo } from '../types'

const CACHE_MAX = 500
const parseCache = new Map<string, Statement | null>()
const progressCache = new Map<string, ProgressInfo>()

function remember<V>(cache: Map<string, V>, key: string, value: V): V {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, value)
  return value
}

function parsed(text: string, vars: readonly string[]): Statement | null {
  const key = `${vars.join(',')}|${text}`
  if (parseCache.has(key)) return parseCache.get(key) ?? null
  const r = parseStatement(text, vars)
  return remember(parseCache, key, r.ok ? r.statement : null)
}

const REVERSED: Record<string, string> = { '<': '>', '>': '<', '<=': '>=', '>=': '<=', '=': '=', '!=': '!=' }

function sameSide(a: Relation['lhs'], b: Relation['lhs'], vars: readonly string[], seed: number): boolean {
  return a.toString() === b.toString() || exprEquivalent(a, b, vars, seed)
}

function sameRelation(a: Relation, b: Relation, vars: readonly string[], seed: number): boolean {
  if (a.op === b.op && sameSide(a.lhs, b.lhs, vars, seed) && sameSide(a.rhs, b.rhs, vars, seed)) return true
  return REVERSED[a.op] === b.op && sameSide(a.lhs, b.rhs, vars, seed) && sameSide(a.rhs, b.lhs, vars, seed)
}

function matchAll<T>(as: readonly T[], bs: readonly T[], same: (a: T, b: T) => boolean): boolean {
  if (as.length !== bs.length) return false
  const used = bs.map(() => false)
  const go = (i: number): boolean => {
    if (i === as.length) return true
    for (let j = 0; j < bs.length; j++) {
      if (used[j] || !same(as[i]!, bs[j]!)) continue
      used[j] = true
      if (go(i + 1)) return true
      used[j] = false
    }
    return false
  }
  return go(0)
}

/** Same line up to same-side rewrites (see the file comment). */
export function sameLine(a: string, b: string, vars: readonly string[], seed: number): boolean {
  if (a.trim() === b.trim()) return true
  const sa = parsed(a, vars)
  const sb = parsed(b, vars)
  if (!sa || !sb) return false
  return matchAll(sa.disjuncts, sb.disjuncts, (ca, cb) => matchAll(ca, cb, (ra, rb) => sameRelation(ra, rb, vars, seed)))
}

/** Printed form of a parsed line, for "is this exactly that line?" tie-breaks. */
function printed(text: string, vars: readonly string[]): string {
  const s = parsed(text, vars)
  if (!s) return text.replace(/\s+/g, '')
  return s.disjuncts.map((c) => c.map((r) => `${r.lhs.toString()}${r.op}${r.rhs.toString()}`).join('&')).join('|')
}

/**
 * Highest canonical index that is the same line as `line`. Same-side rewrites (distribute, combine
 * like terms, factor) leave a line side-equivalent to the one before it, so several consecutive
 * canonical lines can match; an exact printed-form match wins over a merely equivalent one.
 */
function bestMatch(path: readonly CanonicalStep[], line: string, instance: ProblemInstance): number {
  const target = printed(line, instance.vars)
  let highest = -1
  for (let i = path.length - 1; i >= 0; i--) {
    if (!sameLine(path[i]!.text, line, instance.vars, instance.seed)) continue
    if (printed(path[i]!.text, instance.vars) === target) return i
    if (highest < 0) highest = i
  }
  return highest
}

export function progressFromPath(instance: ProblemInstance, currentLine: string | null, swapped: boolean): ProgressInfo {
  const key = `${instance.id}|${swapped ? 1 : 0}|${currentLine ?? ''}`
  const hit = progressCache.get(key)
  if (hit) return hit

  const canonical = instance.canonical
  const alt = instance.canonicalAlt ?? []
  // Only the literal start line is stage 0: a distributed or regrouped copy of it is real progress.
  const atStart = !currentLine || (instance.start != null && printed(instance.start, instance.vars) === printed(currentLine, instance.vars))
  if (atStart) {
    return remember(progressCache, key, { stage: 0, total: Math.max(canonical.length, 1), label: 'start', anchorIndex: -1, path: 'none' })
  }

  const i = bestMatch(canonical, currentLine, instance)
  const j = alt.length ? bestMatch(alt, currentLine, instance) : -1
  const fracCanon = i < 0 ? -1 : (i + 1) / canonical.length
  const fracAlt = j < 0 ? -1 : (j + 1) / alt.length
  let info: ProgressInfo
  if (i < 0 && j < 0) {
    info = { stage: 0, total: Math.max(canonical.length, 1), label: 'off the usual path', anchorIndex: -1, path: 'none' }
  } else if (fracAlt > fracCanon) {
    info = { stage: j + 1, total: alt.length, label: alt[j]!.stage, anchorIndex: j, path: 'alt' }
  } else {
    info = { stage: i + 1, total: canonical.length, label: canonical[i]!.stage, anchorIndex: i, path: 'canonical' }
  }
  return remember(progressCache, key, info)
}

/**
 * The canonical step that follows her current line: from the start, the first swap-first step
 * (or the first solve-first step once she has moved without swapping — anchored lines decide);
 * null when the line is already the last canonical line or when she is off the usual route.
 */
export function nextFromPath(instance: ProblemInstance, currentLine: string | null, swapped: boolean): CanonicalStep | null {
  const info = progressFromPath(instance, currentLine, swapped)
  if (info.path === 'none') return info.label === 'start' ? (instance.canonical[0] ?? null) : null
  const path = info.path === 'alt' ? (instance.canonicalAlt ?? []) : instance.canonical
  return path[info.anchorIndex + 1] ?? null
}

/**
 * Structural "solved" test for one-variable relations: every relation has the bare variable on
 * one side and no variable on the other (x >= 3/5, 3/5 <= x, -2 < x <= 5, x < -2 or x > 5).
 * Legality is the engine's job; this only says the answer is in solved form.
 */
export function isolatedVariableLine(line: string | null, variable: string): boolean {
  if (!line) return false
  const s = parsed(line, [variable])
  if (!s || s.disjuncts.length === 0) return false
  return s.disjuncts.every((clause) =>
    clause.every((rel) => {
      const l = symbolName(rel.lhs)
      const r = symbolName(rel.rhs)
      if (l === variable) return collectVars(rel.rhs).length === 0
      if (r === variable) return collectVars(rel.lhs).length === 0
      return false
    }),
  )
}
