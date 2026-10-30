/**
 * Which problem types offer Guided mode's cards, and where each one's cards come from (lineCards.ts builds them).
 * A line-by-line type joins by adding a source: the right next line from its path (its module's `nextStep`), the
 * lines its named mistakes turn her current line into, its checker and its "same line" test.
 *
 * Exponential and logarithmic equations: the right line is the module's next canonical line from her current
 * line (only while her line is on the path); the wrong ones are the log engine's own slips of her current line
 * (`logLineSlips`), confirmed with `checkLogStep` in the context the flow checks a typed line with.
 */
import { logAnchor, logSame } from '@/content/modules/explog/anchor'
import { POLY_PATTERN } from '@/content/modules/polynomials/patterns'
import { canonicalIndexOf, dqAnswer, gradeDqStep, gradeFxh } from '@/content/modules/diffQuotient/grade'
import { shapeKey } from '@/content/modules/diffQuotient/text'
import { getModule } from '@/content/registry'
import { sameLine } from '@/content/modules/progress'
import type { ProblemInstance, ProblemKind } from '@/content/types'
import {
  checkLogRewrite,
  checkLogStep,
  checkSquareLine,
  exprEquivalent,
  fOfXPlusH,
  logLineSlips,
  logRewriteSlips,
  negateExpr,
  parseExpression,
  squareMistakes,
  substituteNegX,
  substituteX,
  verifyRewrite,
  verifyStep,
  type LogStepContext,
} from '@/engine'
import { gradeSlotLine, slotStart, type Slot } from './evenOdd'
import { buildStepContext, safeLatex } from './stepEngine'
import { buildLineCards, type CardCandidate, type LineCard } from './lineCards'
import { stepLineSlips } from './stepSlips'

type CardSource = (instance: ProblemInstance, current: string, line: number) => LineCard[]

/** How an exponential or log equation's lines are checked (the flow checks her typed lines with the same). */
export function expLogStepContext(instance: ProblemInstance): LogStepContext | null {
  const a = instance.answer
  if (a.type !== 'expLogEquations') return null
  return { original: a.equation, vars: ['x'], seed: instance.seed, ...(a.places ? { decimal: { places: a.places } } : {}) }
}

function expLogCards(instance: ProblemInstance, current: string, line: number): LineCard[] {
  const ctx = expLogStepContext(instance)
  if (!ctx) return []
  // Only from a line on the path: after a legal line of her own route the module's "next line" is its first line
  // again, a sideways move, not the next step.
  const onPath = logAnchor(instance, current) > 0 || logSame(current, instance.start ?? '', ['x'])
  if (!onPath) return []
  const next = getModule(instance.moduleId).nextStep(instance, current, false)
  if (!next) return []
  return buildLineCards({
    current,
    right: next.text,
    candidates: logLineSlips(current, ['x']),
    check: (prev, text) => {
      const r = checkLogStep(prev, text, ctx)
      return { ok: r.ok, pattern: r.pattern?.id }
    },
    same: (a, b) => logSame(a, b, ['x']),
    toLatex: safeLatex,
    seed: instance.seed,
    line,
  })
}

function onCanonical(instance: ProblemInstance, current: string, swapped: boolean): boolean {
  const info = getModule(instance.moduleId).progress(instance, current, swapped)
  return info.path !== 'none' || info.label === 'start'
}

function inequalityCards(instance: ProblemInstance, current: string, line: number): LineCard[] {
  if (!onCanonical(instance, current, false)) return []
  const next = getModule(instance.moduleId).nextStep(instance, current, false)
  if (!next) return []
  const ctx = buildStepContext(instance, false)
  return buildLineCards({
    current,
    right: next.text,
    candidates: stepLineSlips(current, instance.vars),
    check: (prev, text) => {
      const r = verifyStep(prev, text, ctx)
      return { ok: r.ok, pattern: r.pattern?.id }
    },
    same: (a, b) => sameLine(a, b, instance.vars, instance.seed),
    toLatex: safeLatex,
    seed: instance.seed,
    line,
  })
}

function inverseCards(instance: ProblemInstance, current: string, line: number): LineCard[] {
  if (instance.answer.type !== 'inverse' || !instance.answer.oneToOne) return []
  if (!onCanonical(instance, current, false)) return []
  const next = getModule(instance.moduleId).nextStep(instance, current, false)
  if (!next) return []
  const ctx = buildStepContext(instance, false)
  return buildLineCards({
    current,
    right: next.text,
    candidates: stepLineSlips(current, instance.vars),
    check: (prev, text) => {
      const r = verifyStep(prev, text, ctx)
      return { ok: r.ok, pattern: r.pattern?.id }
    },
    same: (a, b) => sameLine(a, b, instance.vars, instance.seed),
    toLatex: safeLatex,
    seed: instance.seed,
    line,
  })
}

function printedExpr(text: string, vars: readonly string[]): string {
  const p = parseExpression(text, vars)
  return p.ok ? p.node.toString() : text.replace(/\s+/g, '')
}

function quadraticCards(instance: ProblemInstance, current: string, line: number): LineCard[] {
  const a = instance.answer
  if (a.type !== 'quadratics' || a.question !== 'form') return []
  const path = a.path.map((p) => p.text)
  if (path.length < 2) return []
  const vars = instance.vars.length ? instance.vars : (['x'] as const)
  const sameWriting = (x: string, y: string) => printedExpr(x, vars) === printedExpr(y, vars) || x.replace(/\s+/g, '') === y.replace(/\s+/g, '')
  const idx = path.findIndex((t) => sameWriting(t, current))
  const atStart = sameWriting(current, a.f) || sameWriting(current, instance.start ?? a.f)
  if (idx < 0 && !atStart) return []
  const right = idx >= 0 ? path[idx + 1] : path[1]
  if (!right) return []
  const candidates: CardCandidate[] = (squareMistakes(a.f) ?? []).map((c) => ({
    id: POLY_PATTERN[c.kind],
    text: c.text,
  }))
  return buildLineCards({
    current,
    right,
    candidates,
    check: (_prev, text) => {
      const g = checkSquareLine(a.f, text)
      if (g.verdict === 'correct') return { ok: true }
      if (g.verdict === 'mistake') return { ok: false, pattern: POLY_PATTERN[g.mistake] }
      return { ok: false }
    },
    same: sameWriting,
    toLatex: safeLatex,
    seed: instance.seed,
    line,
  })
}

function logPropertiesCards(instance: ProblemInstance, current: string, line: number): LineCard[] {
  const a = instance.answer
  if (a.type !== 'logProperties') return []
  const vars = a.vars.length ? a.vars : instance.vars
  const start = instance.start ?? a.expr
  const onPath = logAnchor(instance, current) > 0 || logSame(current, start, vars)
  if (!onPath) return []
  const next = getModule(instance.moduleId).nextStep(instance, current, false)
  if (!next) return []
  return buildLineCards({
    current,
    right: next.text,
    candidates: logRewriteSlips(current, vars),
    check: (prev, text) => {
      const r = checkLogRewrite(prev, text, { assumePositive: true, vars })
      return { ok: r.ok, pattern: r.pattern?.id }
    },
    same: (x, y) => logSame(x, y, vars),
    toLatex: safeLatex,
    seed: instance.seed,
    line,
  })
}

const H_TOKEN = /(?<![A-Za-z])h(?![A-Za-z])/g
const X_TOKEN = /(?<![A-Za-z])x(?![A-Za-z])/g

function fxhTextSlips(f: string): CardCandidate[] {
  const out: CardCandidate[] = []
  out.push({ id: 'dq_fx_plus_h', text: `${f} + h` })
  out.push({ id: 'dq_fx_plus_fh', text: `${f} + (${substituteX(f, 'h')})` })
  out.push({ id: 'dq_partial_sub', text: f })
  const positions = [...f.matchAll(X_TOKEN)]
  if (positions.length >= 1) {
    const i = positions[0]!.index ?? 0
    out.push({ id: 'dq_partial_sub', text: `${f.slice(0, i)}(x + h)${f.slice(i + 1)}` })
    if (positions.length >= 2) {
      const j = positions[1]!.index ?? 0
      out.push({ id: 'dq_partial_sub', text: `${f.slice(0, j)}(x + h)${f.slice(j + 1)}` })
    }
  }
  if (/x\^\d/.test(f)) {
    out.push({ id: 'power_over_sum', text: f.replace(/x\^(\d+)/g, '(x^$1 + h^$1)') })
  }
  const unexpanded = fOfXPlusH(f)
  if (unexpanded !== f) out.push({ id: 'dq_partial_sub', text: unexpanded.replace('(x + h)', 'x') })
  return out
}

function dqTextSlips(current: string, simplified: string): CardCandidate[] {
  const out: CardCandidate[] = []
  const noDiv = current.replace(/\/\s*h\s*$/, '').replace(/^\((.*)\)$/s, '$1')
  if (noDiv && noDiv !== current) out.push({ id: 'dq_forgot_divide', text: noDiv })
  const hZero = current.replace(H_TOKEN, '0')
  if (hZero !== current) out.push({ id: 'dq_set_h_zero', text: hZero })
  if (simplified) out.push({ id: 'dq_set_h_zero', text: simplified.replace(H_TOKEN, '0') })
  return out
}

function sameShape(instance: ProblemInstance, a: string, b: string): boolean {
  const ka = shapeKey(a, instance.vars)
  const kb = shapeKey(b, instance.vars)
  if (ka && kb) return ka === kb
  return a.replace(/\s+/g, '') === b.replace(/\s+/g, '')
}

function diffQuotientCards(instance: ProblemInstance, current: string, line: number): LineCard[] {
  if (instance.answer.type !== 'diffQuotient') return []
  const a = dqAnswer(instance)
  if (!current.trim()) {
    const next = getModule(instance.moduleId).nextStep(instance, null, false)
    if (!next) return []
    return buildLineCards({
      current: '',
      right: next.text,
      candidates: fxhTextSlips(a.f),
      check: (_prev, text) => {
        const r = gradeFxh(instance, text)
        return { ok: r.ok, pattern: r.pattern?.id }
      },
      same: (x, y) => sameShape(instance, x, y) || exprEquivalent(x, y, instance.vars, instance.seed).equivalent,
      toLatex: safeLatex,
      seed: instance.seed,
      line,
    })
  }
  // Part 2: her line is a difference-quotient expression. Off the path (not a canonical shape, and not the
  // built start line) is typed.
  const nextFromModule = getModule(instance.moduleId).nextStep(instance, current, false)
  let right = nextFromModule?.text
  if (!right) {
    const i = canonicalIndexOf(instance, current)
    if (i >= 0) right = instance.canonical[i + 1]?.text
    else if (instance.canonical.length > 1) right = instance.canonical[1]?.text
  }
  if (!right) return []
  return buildLineCards({
    current,
    right,
    candidates: dqTextSlips(current, a.simplified),
    check: (prev, text) => {
      const r = gradeDqStep(instance, prev || current, text)
      return { ok: r.ok, pattern: r.pattern?.id }
    },
    same: (x, y) => sameShape(instance, x, y),
    toLatex: safeLatex,
    seed: instance.seed,
    line,
  })
}

function stripY(text: string): string {
  return text.replace(/^\s*y\s*=\s*/, '')
}

function evenOddCards(instance: ProblemInstance, current: string, line: number): LineCard[] {
  const a = instance.answer
  if (a.type !== 'parity') return []
  const slot: Slot = current.startsWith('B:') ? 'B' : 'A'
  const raw = (slot === 'B' ? current.slice(2) : current).trim()
  const expr = stripY(raw)
  const ctx = { vars: instance.vars, seed: instance.seed, checkValue: a.k, moduleId: instance.moduleId }
  const start = slotStart(slot, a)
  const path = slot === 'A' ? [start, ...a.fNegX] : [start, ...a.negF]
  const same = (x: string, y: string) => exprEquivalent(x, y, ['x'], instance.seed).equivalent
  const atStart = !expr || same(expr, a.f) || raw === (instance.start ?? '')
  let right: string | null = null
  let prevLines: string[] = []
  if (atStart) {
    right = path[0] ?? null
    prevLines = []
  } else {
    let idx = -1
    for (let i = 0; i < path.length; i++) {
      if (same(path[i]!, expr)) idx = i
    }
    if (idx < 0) return []
    right = path[idx + 1] ?? null
    prevLines = [expr]
  }
  if (!right) return []
  const candidates: CardCandidate[] = evenOddSlips(slot, a.f, right)
  return buildLineCards({
    current: atStart ? a.f : expr,
    right,
    candidates,
    check: (_prev, text) => {
      const o = gradeSlotLine(slot, prevLines, text, a, ctx)
      if (o.kind === 'accepted') return { ok: true }
      if (o.kind === 'rejected') return { ok: false, pattern: o.result.pattern?.id }
      return { ok: false }
    },
    same,
    toLatex: safeLatex,
    seed: instance.seed,
    line,
  })
}

function evenOddSlips(slot: Slot, f: string, target: string): CardCandidate[] {
  const out: CardCandidate[] = []
  out.push({ id: 'neg_power_sign', text: target.replace(/\(-x\)/g, '-x') })
  out.push({ id: 'neg_power_sign', text: target.replace(/\(-x\)\^(\d+)/g, '(-x^$1)') })
  out.push({ id: 'neg_power_sign', text: target.replace(/\^\((\d+)\)/g, '^$1') })
  if (slot === 'A') {
    out.push({ id: 'partial_distribute', text: substituteNegX(f).replace(/\(-x\)\^(\d+)/g, '(-x^$1)') })
    out.push({ id: 'neg_power_sign', text: f.replace(/(?<![A-Za-z])x(?![A-Za-z])/g, '-x') })
  } else {
    out.push({ id: 'negative_not_distributed', text: negateExpr(f).replace(/^\-\((.*)\)([+-].*)$/s, '-($1)$2') })
    const dropped = f.startsWith('-') ? f.slice(1) : `-${f}`
    out.push({ id: 'negative_not_distributed', text: dropped })
  }
  return out
}

const SOURCES: Partial<Record<ProblemKind, CardSource>> = {
  expLogEquations: expLogCards,
  inequality: inequalityCards,
  quadratics: quadraticCards,
  inverse: inverseCards,
  logProperties: logPropertiesCards,
  diffQuotient: diffQuotientCards,
  evenOdd: evenOddCards,
}

/** This problem type offers the cards (and the Guide me switch). */
export function offersLineCards(instance: ProblemInstance): boolean {
  if (!SOURCES[instance.kind]) return false
  if (instance.kind === 'quadratics') return instance.answer.type === 'quadratics' && instance.answer.question === 'form'
  if (instance.kind === 'inverse') return instance.answer.type === 'inverse' && instance.answer.oneToOne
  return true
}

/**
 * The step type of the line from `current` to the path's next line `next`: what the move does, as the engine reads
 * it ("power_rule+take_log"). It keys "picked right twice: type it this time", so the rule follows the kind of step
 * across problems. (Every line of a problem shares one rule card, so keying by the card made a three-line problem go
 * pick, pick, type.) Null when the type has no cards or the engine names no property.
 */
export function stepTypeOf(instance: ProblemInstance, current: string, next: string): string | null {
  if (!offersLineCards(instance)) return null
  if (instance.kind === 'expLogEquations') {
    const move = checkLogStep(current, next, expLogStepContext(instance) ?? { vars: ['x'] }).logMove
    return move && move.properties.length > 0 ? [...move.properties].sort().join('+') : null
  }
  if (instance.kind === 'logProperties') {
    const a = instance.answer
    const vars = a.type === 'logProperties' ? a.vars : instance.vars
    const move = checkLogRewrite(current, next, { assumePositive: true, vars }).logMove
    return move && move.properties.length > 0 ? [...move.properties].sort().join('+') : null
  }
  if (instance.kind === 'quadratics') {
    const g = instance.answer.type === 'quadratics' ? checkSquareLine(instance.answer.f, next) : null
    return g && g.verdict === 'correct' ? (g.done ? 'vertex_form' : 'rewrite') : null
  }
  if (instance.kind === 'diffQuotient' || instance.kind === 'evenOdd') {
    const r = verifyRewrite(current || next, next, buildStepContext(instance, false))
    return r.detected?.tag ?? (r.ok ? 'rewrite' : null)
  }
  const move = verifyStep(current, next, buildStepContext(instance, false)).detected
  return move?.tag ?? null
}

const cache = new Map<string, LineCard[]>()

/**
 * The cards for the line after `current` (line = the index of the line she is writing), in their fixed order; empty
 * when the type has none or this line has none (she types it). Cached: a re-render, or the hint panel asking for the
 * same line, does not build them again.
 */
export function lineCardsFor(instance: ProblemInstance, current: string, line: number): LineCard[] {
  const source = SOURCES[instance.kind]
  if (!source) return []
  const key = `${instance.id}|${JSON.stringify(instance.knobs)}|${line}|${current}`
  const hit = cache.get(key)
  if (hit) return hit
  const cards = source(instance, current, line)
  if (cache.size > 64) cache.clear()
  cache.set(key, cards)
  return cards
}

/** Tests: build the cards again instead of reading them from the cache. */
export function clearLineCardsCache(): void {
  cache.clear()
}
