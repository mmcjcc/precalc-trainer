/**
 * Difference-quotient grading and progress for a problem instance (pure; the flow and the module's
 * progress / nextStep / solved use these). The engine decides legality; this file adds the problem's
 * canonical path: which chip a canonical line is graded with, and where her line sits on the path.
 */
import { checkDqLine, checkFxhLine, dqStartLine, dqStatus, exprEquivalent, fOfXPlusH, type DqLineResult, type DqSpec } from '@/engine'
import type { AnswerSpec, CanonicalStep, ProblemInstance, ProgressInfo } from '@/content/types'
import { CHIP_OF_TAG, type StepContext } from '@/shared/types'
import { shapeKey } from './text'

export type DqAnswer = Extract<AnswerSpec, { type: 'diffQuotient' }>

export function dqAnswer(instance: ProblemInstance): DqAnswer {
  const a = instance.answer
  if (a.type !== 'diffQuotient') throw new Error(`${instance.id} is not a difference-quotient problem`)
  return a
}

export function dqSpec(instance: ProblemInstance): DqSpec {
  const a = dqAnswer(instance)
  return { f: a.f, answer: a.simplified }
}

export function dqContext(instance: ProblemInstance): StepContext {
  return { vars: instance.vars, seed: instance.seed, moduleId: 'diffQuotient', canonical: instance.canonical.map((s) => s.text) }
}

/** The first line of part 2: her f(x + h) line dropped in, f(x) in parentheses, over h. */
export function dqStart(instance: ProblemInstance, fxhLine: string | null): string {
  const a = dqAnswer(instance)
  return dqStartLine(fxhLine ?? a.fxh, a.f)
}

/** Part 1: check her f(x + h) line. */
export function gradeFxh(instance: ProblemInstance, typed: string): DqLineResult {
  return checkFxhLine(typed, dqSpec(instance), dqContext(instance))
}

/** Index (≥ 1) of the canonical line with the same shape as `line` (terms and factors in any order), or −1. */
export function canonicalIndexOf(instance: ProblemInstance, line: string): number {
  const key = shapeKey(line, instance.vars)
  if (key === null) return -1
  for (let i = instance.canonical.length - 1; i >= 1; i--) {
    if (shapeKey(instance.canonical[i]!.text, instance.vars) === key) return i
  }
  return -1
}

/**
 * Part 2: check a line against the line before it and the difference quotient. When her line IS a
 * canonical line (same shape), the canonical tag's chip is graded right too (BUILD_GUIDE §4: prefer
 * the canonical tag), on top of whatever the rewrite classifier allows.
 */
export function gradeDqStep(instance: ProblemInstance, prev: string, typed: string): DqLineResult {
  const res = checkDqLine(prev, typed, dqSpec(instance), dqContext(instance))
  if (!res.ok) return res
  const k = canonicalIndexOf(instance, typed)
  if (k < 1) return res
  const chip = CHIP_OF_TAG[instance.canonical[k]!.tag]
  return res.acceptableChips.includes(chip) ? res : { ...res, acceptableChips: [chip, ...res.acceptableChips] }
}

// ---------------------------------------------------------------------------
// Progress (ModuleDef.progress / nextStep / solved), cached per (problem, line)
// ---------------------------------------------------------------------------

const CACHE_MAX = 400
const cache = new Map<string, { info: ProgressInfo; solved: boolean }>()

type LineKind = 'fxh' | 'dq' | 'other'

function kindOf(instance: ProblemInstance, line: string): { kind: LineKind; simplified: boolean } {
  const a = dqAnswer(instance)
  if (exprEquivalent(line, fOfXPlusH(a.f), instance.vars, instance.seed).equivalent) return { kind: 'fxh', simplified: false }
  const s = dqStatus(line, dqSpec(instance), instance.seed)
  return s.equivalent ? { kind: 'dq', simplified: s.simplified } : { kind: 'other', simplified: false }
}

function analyse(instance: ProblemInstance, line: string | null): { info: ProgressInfo; solved: boolean } {
  const total = instance.canonical.length
  if (line === null || !line.trim()) return { info: { stage: 0, total, label: 'start', anchorIndex: -1, path: 'none' }, solved: false }
  // The id does not carry the knobs, so the function goes into the key too.
  const key = `${instance.id}|${dqAnswer(instance).f}|${line}`
  const hit = cache.get(key)
  if (hit) return hit
  const { kind, simplified } = kindOf(instance, line)
  let result: { info: ProgressInfo; solved: boolean }
  if (kind === 'fxh') {
    // Part 2 starts from HER f(x + h): typed already expanded, the start line is itself a later
    // canonical line, and the next hint must skip past it.
    const k = Math.max(0, canonicalIndexOf(instance, dqStart(instance, line)))
    result = { info: { stage: k + 1, total, label: instance.canonical[k]!.stage, anchorIndex: k, path: 'canonical' }, solved: false }
  } else if (kind === 'dq') {
    const i = simplified ? total - 1 : canonicalIndexOf(instance, line)
    result =
      i >= 1
        ? { info: { stage: i + 1, total, label: instance.canonical[i]!.stage, anchorIndex: i, path: 'canonical' }, solved: simplified }
        : { info: { stage: 1, total, label: 'off the usual path', anchorIndex: -1, path: 'none' }, solved: false }
  } else {
    result = { info: { stage: 0, total, label: 'off the usual path', anchorIndex: -1, path: 'none' }, solved: false }
  }
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, result)
  return result
}

/**
 * `line` is the LAST accepted line of the attempt: null before part 1, her f(x + h) line after it,
 * then her latest difference-quotient line.
 */
export function dqProgress(instance: ProblemInstance, line: string | null): ProgressInfo {
  return analyse(instance, line).info
}

export function dqNextStep(instance: ProblemInstance, line: string | null): CanonicalStep | null {
  const info = analyse(instance, line).info
  if (info.path === 'none') return info.label === 'start' ? (instance.canonical[0] ?? null) : null
  return instance.canonical[info.anchorIndex + 1] ?? null
}

/** Finished: the line is the difference quotient AND no h is left underneath (defined at h = 0). */
export function dqSolved(instance: ProblemInstance, line: string | null): boolean {
  return line !== null && analyse(instance, line).solved
}
