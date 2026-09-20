/**
 * Problem URLs (UX-13): `/p/<moduleId>/<templateId>/<seed36>?d=<flags>`.
 * Flags are one letter per knob so links stay short: `f` fractions, `n` negativeLead, `2`/`3` steps,
 * `s` sciNotation, `e` exactNumbers (significant figures).
 * Pure helpers — no React.
 */
import type { DifficultyKnobs, KnobDef } from '@/content/types'
import { seedFromBase36, seedToBase36 } from '@/content/rng'

export function knobsFromFlags(flags: string | null | undefined): DifficultyKnobs {
  const knobs: DifficultyKnobs = {}
  if (!flags) return knobs
  for (const ch of flags) {
    if (ch === 'f') knobs.fractions = true
    else if (ch === 'n') knobs.negativeLead = true
    else if (ch === 's') knobs.sciNotation = true
    else if (ch === 'e') knobs.exactNumbers = true
    else if (ch === '1' || ch === '2' || ch === '3') knobs.steps = Number(ch) as 1 | 2 | 3
  }
  return knobs
}

export function flagsFromKnobs(knobs: DifficultyKnobs): string {
  let s = ''
  if (knobs.fractions) s += 'f'
  if (knobs.negativeLead) s += 'n'
  if (knobs.sciNotation) s += 's'
  if (knobs.exactNumbers) s += 'e'
  if (knobs.steps && knobs.steps !== 1) s += String(knobs.steps)
  return s
}

/** Knobs a template honors, seeded from each knob's default (boolean knobs only for v1). */
export function defaultKnobs(defs: KnobDef[]): DifficultyKnobs {
  const knobs: DifficultyKnobs = {}
  for (const d of defs) {
    if (d.key === 'steps') {
      if (typeof d.default === 'number') knobs.steps = d.default
    } else if (typeof d.default === 'boolean') {
      knobs[d.key] = d.default
    }
  }
  return knobs
}

export function problemPath(moduleId: string, templateId: string, seed: number | string, flags = ''): string {
  const seed36 = typeof seed === 'number' ? seedToBase36(seed) : seed
  return `/p/${moduleId}/${templateId}/${seed36}${flags ? `?d=${flags}` : ''}`
}

/** Parse a base36 seed route param; null when malformed. */
export function parseSeedParam(seed: string | undefined): number | null {
  if (!seed || !/^[0-9a-z]{1,7}$/i.test(seed)) return null
  try {
    const n = seedFromBase36(seed.toLowerCase())
    return Number.isFinite(n) ? n >>> 0 : null
  } catch {
    return null
  }
}
