/**
 * The properties drill on a phone: four big choices instead of all fourteen chips (a design review found the
 * fourteen long chips pushed the feedback and Next below the fold). The right property and three others, two of
 * them from its own family where it has enough (the moves that are easiest to mix up), in an order fixed by the
 * question, so a re-render never reshuffles them.
 */
import { ALL_CHIPS, type ChipId } from '@/shared/types'

/** Properties that are easy to mix up with each other. */
const FAMILIES: readonly (readonly ChipId[])[] = [
  // the same thing to both sides
  ['add_sub', 'mul_div', 'power_both', 'root_both'],
  // rewriting one side
  ['distribute', 'factor', 'combine_like', 'simplify', 'rewrite_fraction'],
  // reordering
  ['commutative', 'associative'],
  // the sides and the letters
  ['swap_sides', 'swap_xy', 'rename_inverse'],
]

export const PHONE_CHOICES = 4

/** A small deterministic generator seeded by the question's id (FNV-1a, then mulberry32). */
function rng(key: string): () => number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** The right property and PHONE_CHOICES - 1 others, in a fixed order for this question. */
export function propertyChoices(questionId: string, right: ChipId, n = PHONE_CHOICES): ChipId[] {
  const next = rng(questionId)
  const family = FAMILIES.find((f) => f.includes(right)) ?? []
  const near = shuffled(
    family.filter((c) => c !== right),
    next,
  ).slice(0, 2)
  const far = shuffled(
    ALL_CHIPS.filter((c) => c !== right && !near.includes(c)),
    next,
  )
  const picked = [right, ...near, ...far].slice(0, n)
  return shuffled(picked, next)
}
