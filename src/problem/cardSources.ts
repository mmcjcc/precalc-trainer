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
import { getModule } from '@/content/registry'
import type { ProblemInstance, ProblemKind } from '@/content/types'
import { checkLogStep, logLineSlips, type LogStepContext } from '@/engine'
import { buildLineCards, type LineCard } from './lineCards'
import { safeLatex } from './stepEngine'

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

const SOURCES: Partial<Record<ProblemKind, CardSource>> = {
  expLogEquations: expLogCards,
}

/** This problem type offers the cards (and the Type / Pick switch). */
export function offersLineCards(instance: ProblemInstance): boolean {
  return SOURCES[instance.kind] !== undefined
}

/**
 * The step type of the line from `current` to the path's next line `next`: what the move does, as the engine reads
 * it ("power_rule+take_log"). It keys "picked right twice: type it this time", so the rule follows the kind of step
 * across problems. (Every line of a problem shares one rule card, so keying by the card made a three-line problem go
 * pick, pick, type.) Null when the type has no cards or the engine names no property.
 */
export function stepTypeOf(instance: ProblemInstance, current: string, next: string): string | null {
  if (!offersLineCards(instance)) return null
  const move = checkLogStep(current, next, expLogStepContext(instance) ?? { vars: ['x'] }).logMove
  return move && move.properties.length > 0 ? [...move.properties].sort().join('+') : null
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
