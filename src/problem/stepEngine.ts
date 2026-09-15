/**
 * Shared step-column logic for every problem kind — pure functions over the engine + content APIs
 * so the flows can be tested without React. The hook in ./useStepEngine.ts wires these to the store.
 */
import { normalizeInput, parseExpression, parseStatement, verifyRewrite, verifyStep } from '@/engine'
import { toLatex } from '@/notation'
import { getModule } from '@/content/registry'
import type { CanonicalStep, ProblemInstance, RuleCard } from '@/content/types'
import {
  ALL_CHIPS,
  CHIP_LABEL,
  type ChipId,
  type Counterexample,
  type ParseError,
  type PatternHit,
  type StepContext,
  type StepResult,
  type VarName,
} from '@/shared/types'

// ---------------------------------------------------------------------------
// Context + submission
// ---------------------------------------------------------------------------

export function buildStepContext(instance: ProblemInstance, swapped: boolean): StepContext {
  const canonical = [...instance.canonical, ...(instance.canonicalAlt ?? [])].map((s) => s.text)
  return {
    vars: instance.vars,
    seed: instance.seed,
    allowSwap: instance.kind === 'inverse' && !swapped,
    checkValue: instance.check?.k,
    canonical,
    moduleId: instance.moduleId,
  }
}

export type SubmitOutcome =
  | { kind: 'parse'; error: ParseError }
  | { kind: 'accepted'; result: StepResult; text: string; latex: string }
  | { kind: 'rejected'; result: StepResult }

/**
 * Verify `typed` against `currentLine`. `mode` picks relation mode (statements) or expression
 * mode (even/odd slots). The accepted text is the engine's normalized form; latex comes from what
 * she typed so the worked column shows her notation.
 */
export function classifyStep(
  currentLine: string,
  typed: string,
  ctx: StepContext,
  mode: 'relation' | 'expression' = 'relation',
): SubmitOutcome {
  const text = typed.trim()
  if (!text) return { kind: 'parse', error: { message: 'Type the next line first.', position: 0 } }
  const result = mode === 'relation' ? verifyStep(currentLine, text, ctx) : verifyRewrite(currentLine, text, ctx)
  if (result.verdict === 'parse_error' && result.parseError) return { kind: 'parse', error: result.parseError }
  if (result.ok) {
    return { kind: 'accepted', result, text: result.normalized?.text ?? text, latex: safeLatex(text) }
  }
  return { kind: 'rejected', result }
}

/** Live validation for MathInput: null when the text parses in the given mode. */
export function liveParseError(text: string, vars: VarName[], mode: 'relation' | 'expression' = 'relation'): ParseError | null {
  const t = text.trim()
  if (!t) return null
  const r = mode === 'relation' ? parseStatement(t, vars) : parseExpression(t, vars)
  return r.ok ? null : r.error
}

export function safeLatex(text: string): string {
  try {
    return toLatex(text)
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// Property chips (UX-08)
// ---------------------------------------------------------------------------

export interface ChipGrade {
  outcome: 'correct' | 'wrong'
  message: string
}

/** Grade a picked chip against the step's acceptable chips. Never penalized; wrong → one-liner. */
export function gradeChip(chip: ChipId, acceptable: readonly ChipId[]): ChipGrade {
  if (acceptable.includes(chip)) return { outcome: 'correct', message: `Yes — ${CHIP_LABEL[chip]}.` }
  const right = acceptable[0]
  return {
    outcome: 'wrong',
    message: right ? `We'd call this: ${CHIP_LABEL[right]}.` : 'No single property fits this move — it is a plain rewrite.',
  }
}

export const CHIP_ORDER: readonly ChipId[] = ALL_CHIPS

/** Digit key → chip index (1–9 then 0 = tenth). */
export function chipIndexForDigit(n: number): number {
  return n === 0 ? 9 : n - 1
}

// ---------------------------------------------------------------------------
// Rejection rendering (plain text first; LaTeX only for parts that parse)
// ---------------------------------------------------------------------------

export interface ExampleSegment {
  text: string
  /** Present only when the segment parses as app-syntax math. */
  latex?: string
}

/** Split a pattern example on → and render each side as math only when it parses. */
export function exampleSegments(example: string): ExampleSegment[] {
  return example
    .split('→')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => {
      const cleaned = normalizeInput(text)
      const parsed = parseStatement(cleaned, ['x', 'y', 'n'])
      if (parsed.ok) return { text, latex: safeLatex(cleaned) }
      const expr = parseExpression(cleaned, ['x', 'y', 'n'])
      if (expr.ok) return { text, latex: safeLatex(cleaned) }
      return { text }
    })
}

function showValue(v: number | 'undef'): string {
  return v === 'undef' ? 'undefined' : String(Number.isInteger(v) ? v : Number(v.toFixed(3)))
}

/** Lines under the counterexample message: each side's value on the old and new line. */
export function counterexampleLines(cx: Counterexample): string[] {
  const lines: string[] = []
  if (cx.oldValues) lines.push(`Old line at ${cx.pointDisplay}: left = ${showValue(cx.oldValues.L)}, right = ${showValue(cx.oldValues.R)}`)
  if (cx.newValues) lines.push(`Your line at ${cx.pointDisplay}: left = ${showValue(cx.newValues.L)}, right = ${showValue(cx.newValues.R)}`)
  return lines
}

export interface RejectionView {
  title: string
  lesson?: string
  witness?: string
  example: ExampleSegment[]
  counterexample?: string
  sideValues: string[]
}

export function rejectionView(result: StepResult): RejectionView {
  const p = result.pattern
  return {
    title:
      p?.title ??
      (result.counterexample && !result.counterexample.oldValues
        ? 'Those two expressions have different values.'
        : 'That line does not say the same thing as the one before it.'),
    lesson: p?.lesson,
    witness: p?.witness,
    example: p?.example ? exampleSegments(p.example) : [],
    counterexample: result.counterexample?.message,
    sideValues: result.counterexample ? counterexampleLines(result.counterexample) : [],
  }
}

// ---------------------------------------------------------------------------
// Hints (rung 1 nudge, rung 2 rule card, rung 3 reveal)
// ---------------------------------------------------------------------------

export interface HintView {
  next: CanonicalStep | null
  nudge: string
  card: RuleCard | null
  /** Text to place in the worked column when rung 3 is used. */
  reveal: string | null
  /** The current line is legal but matches no canonical line, so rung 3 is unavailable. */
  offPath?: boolean
}

export const OFF_PATH_NUDGE =
  'This line is legal — the engine checked it — but it is off the usual route, so there is no single next line to show. Keep undoing the operations around the variable, or undo back to a line you recognize.'

export const FINISHED_NUDGE = 'The variable is by itself — that line is finished. Now write the answer below.'

/**
 * Resolve the hint content for the current line. After a rejection with a pattern, rung 2 prefers
 * that pattern's lesson (as a card) over the canonical rule card. When `nextStep` is null the line
 * is either finished (`solved`, or anchored on the last canonical line) or legal but off the usual
 * route — then the nudge says so and there is nothing to reveal.
 */
export function hintView(
  instance: ProblemInstance,
  currentLine: string | null,
  swapped: boolean,
  lastPattern?: PatternHit | null,
  solved = false,
): HintView {
  const mod = getModule(instance.moduleId)
  const next = solved ? null : mod.nextStep(instance, currentLine, swapped)
  const ruleCard = next ? mod.ruleCards.find((c) => c.id === next.ruleCard) ?? null : null
  const card: RuleCard | null = lastPattern
    ? { id: lastPattern.id, title: lastPattern.title, body: lastPattern.lesson, example: lastPattern.example }
    : ruleCard
  let offPath = false
  let nudge = next?.nudge ?? FINISHED_NUDGE
  if (!next && !solved) {
    const info = mod.progress(instance, currentLine, swapped)
    offPath = info.path === 'none' && info.label !== 'start'
    if (offPath) nudge = OFF_PATH_NUDGE
  }
  return { next, nudge, card, reveal: next?.text ?? null, offPath }
}

export interface ProgressLine {
  stage: number
  total: number
  label: string
  /** The current line is in finished form (ModuleDef.solved) — never inferred from the anchor. */
  solved: boolean
  /** The current line is legal but matches no canonical line. */
  offPath: boolean
}

/**
 * Progress shown to the student: the best anchor over every accepted line of the attempt plus the
 * current one (so it never goes backwards when she takes a legal detour), with completion decided
 * by `ModuleDef.solved` on the current line only.
 */
export function progressLine(
  instance: ProblemInstance,
  currentLine: string | null,
  swapped: boolean,
  history: readonly (string | null)[] = [],
): ProgressLine {
  const mod = getModule(instance.moduleId)
  const current = mod.progress(instance, currentLine, swapped)
  let best = current
  const frac = (i: { stage: number; total: number }) => (i.total > 0 ? i.stage / i.total : 0)
  for (const line of history) {
    if (line === currentLine) continue
    const info = mod.progress(instance, line, swapped)
    if (frac(info) > frac(best)) best = info
  }
  const solved = mod.solved ? mod.solved(instance, currentLine) : false
  const offPath = current.path === 'none' && current.label !== 'start'
  return {
    stage: solved ? best.total : best.stage,
    total: best.total,
    label: solved ? 'solved' : offPath && best !== current ? `${best.label} · this line is off the usual path` : best.label,
    solved,
    offPath,
  }
}
