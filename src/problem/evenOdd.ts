/**
 * Even/odd flow logic: two evidence slots (A: f(−x), B: −f(x)) as mini step columns, then the
 * verdict. Slot lines live in the attempt's step list encoded as "f(-x) = E" / "-f(x) = E" so a
 * reload restores both columns. Pure — no React, no store.
 */
import { checkParityWithK, exprEquivalent, negateExpr, substituteNegX, verifyRewrite } from '@/engine'
import type { AnswerSpec, Parity, ParityReason } from '@/content/types'
import type { PatternHit, StepContext, StepResult } from '@/shared/types'

export type ParityAnswer = Extract<AnswerSpec, { type: 'parity' }>
export type Slot = 'A' | 'B'

export const SLOT_LABEL: Record<Slot, string> = { A: 'f(−x)', B: '−f(x)' }
const SLOT_PREFIX: Record<Slot, string> = { A: 'f(-x) = ', B: '-f(x) = ' }

export function encodeSlotStep(slot: Slot, expr: string): string {
  return `${SLOT_PREFIX[slot]}${expr}`
}

export function decodeSlotStep(text: string): { slot: Slot; expr: string } | null {
  for (const slot of ['A', 'B'] as const) {
    const p = SLOT_PREFIX[slot]
    if (text.startsWith(p)) return { slot, expr: text.slice(p.length) }
  }
  return null
}

/** Lines accepted so far in each slot, in order. */
export function slotLines(stepTexts: readonly string[]): Record<Slot, string[]> {
  const out: Record<Slot, string[]> = { A: [], B: [] }
  for (const t of stepTexts) {
    const d = decodeSlotStep(t)
    if (d) out[d.slot].push(d.expr)
  }
  return out
}

/** The expression the next line in a slot must be a rewrite of. */
export function slotStart(slot: Slot, answer: ParityAnswer): string {
  return slot === 'A' ? substituteNegX(answer.f) : negateExpr(answer.f)
}

export type SlotOutcome =
  | { kind: 'parse'; error: { message: string; position: number; length?: number } }
  | { kind: 'accepted'; result: StepResult; text: string }
  | { kind: 'rejected'; result: StepResult; pattern?: PatternHit; message: string }

/**
 * Grade one typed line for a slot. The first line must be equivalent to f(−x) (resp. −f(x)) —
 * checked against the substituted form AND every stored canonical entry; later lines are
 * rewrites of the previous accepted line via verifyRewrite.
 */
export function gradeSlotLine(slot: Slot, previous: string[], typed: string, answer: ParityAnswer, ctx: StepContext): SlotOutcome {
  const text = typed.trim()
  if (!text) return { kind: 'parse', error: { message: 'Type the line first.', position: 0 } }
  const prev = previous.length ? previous[previous.length - 1]! : slotStart(slot, answer)
  const result = verifyRewrite(prev, text, ctx)
  if (result.verdict === 'parse_error' && result.parseError) return { kind: 'parse', error: result.parseError }
  if (result.ok) return { kind: 'accepted', result, text: result.normalized?.text ?? text }
  if (previous.length === 0) {
    // First line: also accept anything equivalent to a stored canonical form (belt and braces).
    const targets = slot === 'A' ? answer.fNegX : answer.negF
    if (targets.some((t) => exprEquivalent(text, t, ['x'], ctx.seed).equivalent)) {
      return { kind: 'accepted', result: { ...result, ok: true, verdict: 'equivalent' }, text }
    }
  }
  return { kind: 'rejected', result, pattern: result.pattern, message: result.pattern?.lesson ?? slotHelp(slot, answer.f, previous.length === 0) }
}

/** Coaching sentence for a rejected slot line that no matcher explained. */
export function slotHelp(slot: Slot, f: string, firstLine = true): string {
  if (!firstLine) {
    return slot === 'A'
      ? 'That rewrite changed the value of f(−x). Simplify one piece at a time: (−x)^even = x^even, (−x)^odd = −x^odd.'
      : 'That rewrite changed the value of −f(x). The minus in front flips the sign of EVERY term, not just the first.'
  }
  return slot === 'A'
    ? `That is not f(−x). Replace EVERY x in ${f} with (−x) — keep the parentheses so the sign applies to the whole x.`
    : `That is not −f(x). Negate the WHOLE function: −(${f}) — distribute the minus to every term.`
}

export const PARITY_REASONS: { id: ParityReason; label: string }[] = [
  { id: 'domain_asymmetric', label: 'The domain is not symmetric: f(k) exists but f(−k) does not (or vice versa)' },
  { id: 'values', label: 'f(−x) matches neither f(x) nor −f(x)' },
]

export interface ParityGrade {
  correct: boolean
  message: string
}

export function gradeParity(answer: ParityAnswer, verdict: Parity, reason: ParityReason | null): ParityGrade {
  const k = answer.k
  const table = checkParityWithK(answer.f, [k]).table
  const row = table.find((r) => r.k === k)
  const show = (v: number | 'undef' | undefined) => (v === undefined ? '?' : v === 'undef' ? 'undefined' : String(Number.isInteger(v) ? v : Number(v.toFixed(3))))
  const fk = show(row?.fk)
  const fNegK = show(row?.fNegK)
  const plug = `Plug in k = ${k}: f(${k}) = ${fk}, f(−${k}) = ${fNegK}.`
  if (verdict !== answer.verdict) {
    if (answer.verdict === 'neither' && answer.reason === 'domain_asymmetric') {
      return { correct: false, message: `Neither — the domain is not symmetric about 0, so the value test never starts. ${plug}` }
    }
    const why =
      answer.verdict === 'even'
        ? `f(−x) simplifies to f(x) itself, so it is even. ${plug}`
        : answer.verdict === 'odd'
          ? `f(−x) simplifies to −f(x), so it is odd. ${plug}`
          : `f(−x) matches neither f(x) nor −f(x), so it is neither. ${plug}`
    return { correct: false, message: `Not ${verdict}. ${why}` }
  }
  if (verdict === 'neither') {
    if (!reason) return { correct: false, message: 'Neither is right — now pick the reason.' }
    if (reason !== answer.reason) {
      return {
        correct: false,
        message:
          answer.reason === 'domain_asymmetric'
            ? `Neither, but the reason is the domain: ${plug} One side is undefined, so the function cannot be symmetric.`
            : `Neither, but the domain IS symmetric here — the values differ: ${plug}`,
      }
    }
    return { correct: true, message: `Yes — neither. ${answer.reason === 'domain_asymmetric' ? 'The domain is not symmetric about 0.' : 'f(−x) is neither f(x) nor −f(x).'} ${plug}` }
  }
  return {
    correct: true,
    message: verdict === 'even' ? `Yes — even: f(−x) = f(x); the graph mirrors across the y-axis. ${plug}` : `Yes — odd: f(−x) = −f(x); the graph rotates 180° about the origin. ${plug}`,
  }
}

/** Rows for the plug-in table at ±k (the stored k first). */
export function parityTable(answer: ParityAnswer): { k: number; fk: number | 'undef'; fNegK: number | 'undef'; negFk: number | 'undef' }[] {
  const table = checkParityWithK(answer.f, [answer.k]).table
  const rows = table.filter((r) => Math.abs(r.k) === answer.k)
  return rows.map((r) => ({ k: r.k, fk: r.fk, fNegK: r.fNegK, negFk: r.fk === 'undef' ? 'undef' : -r.fk }))
}

export interface SlotHintView {
  nudge: string
  card: { id: string; title: string; body: string; example?: string } | null
  /** Next line to reveal for this slot, or null when the slot is already simplified. */
  reveal: string | null
}

function compact(text: string): string {
  return text.replace(/[\s*]/g, '')
}

/**
 * Hint ladder for one slot, anchored on that slot's lines (not on the module's `y = …` path, whose
 * statements use a variable the even/odd problem does not own): empty → the unsimplified first
 * line; otherwise → the simplified form; already simplified → compare and choose the verdict.
 */
export function slotHintView(
  slot: Slot,
  answer: ParityAnswer,
  lines: readonly string[],
  cards: readonly { id: string; title: string; body: string; example?: string }[],
): SlotHintView {
  const canon = slot === 'A' ? answer.fNegX : answer.negF
  const first = canon[0] ?? slotStart(slot, answer)
  const simplified = canon[canon.length - 1] ?? first
  const last = lines[lines.length - 1]
  const card = (id: string) => cards.find((c) => c.id === id) ?? null
  if (slot === 'B') {
    const b = slotBHint(answer)
    if (last === undefined) return { nudge: b.nudge, card: b.card, reveal: first }
    if (compact(last) === compact(simplified)) {
      return { nudge: `−f(x) is simplified. Put it next to your f(−x): the same expression means odd.`, card: card('verdict'), reveal: null }
    }
    return { nudge: 'Distribute the minus: every term of f(x) changes sign.', card: b.card, reveal: simplified }
  }
  if (last === undefined) {
    return { nudge: `Replace every x in ${answer.f} with (−x). Keep the parentheses — do not simplify yet if you want the evidence line.`, card: card('f-neg-x'), reveal: first }
  }
  if (compact(last) === compact(simplified)) {
    return { nudge: `f(−x) is simplified. Is it f(x) = ${answer.f} again (even), your −f(x) (odd), or neither?`, card: card('verdict'), reveal: null }
  }
  return { nudge: 'Simplify the powers of (−x): even powers drop the minus, odd powers keep it.', card: card('simplify-neg'), reveal: simplified }
}

/** Hints for slot B (the module's canonical path only covers slot A). */
export function slotBHint(answer: ParityAnswer): { nudge: string; card: { id: string; title: string; body: string; example?: string }; reveal: string } {
  const last = answer.negF[answer.negF.length - 1] ?? negateExpr(answer.f)
  return {
    nudge: `Write −f(x) by negating the whole function: −(${answer.f}). Then distribute the minus to every term.`,
    card: {
      id: 'negate-all',
      title: 'Negate the whole function',
      body: '−f(x) means the minus applies to EVERY term. −(a − b) = −a + b: both signs flip, not just the first.',
      example: `-(${answer.f}) → ${last}`,
    },
    reveal: last,
  }
}
