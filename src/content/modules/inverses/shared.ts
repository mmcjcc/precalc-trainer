/**
 * Helpers shared by the inverse templates: instance ids, a compact canonical-step builder and the
 * coach wording for "undo the constant" moves (named property + the concrete number).
 */
import type { CanonicalStep } from '@/content/types'
import type { PropertyTag } from '@/shared/types'

/** Every inverse template says this: both orderings are legal (BUILD_GUIDE §7). */
export const INVERSE_INSTRUCTIONS =
  'Swap x and y first, or solve for x first — both are fine. Undo the operations one at a time and finish with y = … in x.'

export const SWAP_FIRST_NUDGE = 'Swap x and y: every x becomes y and every y becomes x. That is the inverse relation.'
export const SWAP_LAST_NUDGE =
  'You have x by itself — now swap x and y. The inverse is the same relation with the letters traded.'

export function inverseId(templateId: string, seed: number): string {
  return `inverses/${templateId}@1/${(seed >>> 0).toString(36)}`
}

export function step(text: string, tag: PropertyTag, nudge: string, ruleCard: string, stage: string): CanonicalStep {
  return { text, tag, nudge, ruleCard, stage }
}

/** `t` is the constant sitting with the variable (y + t): t > 0 → subtract it, t < 0 → add. */
export function undoConstTag(t: number): PropertyTag {
  return t > 0 ? 'sub_both' : 'add_both'
}

/** "Subtract 2 from both sides so … stands alone." — names the move and the number. */
export function undoConstNudge(t: number, what: string): string {
  return t > 0
    ? `Subtract ${t} from both sides so ${what} stands alone.`
    : `Add ${-t} to both sides so ${what} stands alone.`
}

/** Suggested x-range wide enough to show every stored number (asymptotes, k, f(k)). */
export function domainAround(values: number[], pad = 3): [number, number] {
  return [Math.min(...values) - pad, Math.max(...values) + pad]
}
