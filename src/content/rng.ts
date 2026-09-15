/**
 * Deterministic PRNG for problem generation (mulberry32). Same seed → same problem.
 * Templates must consume randomness in a fixed order; bump TemplateDef.version if that changes.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number
  /** Uniform integer in [lo, hi] inclusive. */
  int(lo: number, hi: number): number
  /** Uniform integer in [lo, hi] inclusive, excluding the given values. */
  intExcept(lo: number, hi: number, except: readonly number[]): number
  pick<T>(arr: readonly T[]): T
  shuffle<T>(arr: readonly T[]): T[]
  /** true with probability p. */
  chance(p: number): boolean
  /** ±1 with equal probability. */
  sign(): 1 | -1
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeRng(seed: number): Rng {
  const next = mulberry32(seed)
  const rng: Rng = {
    next,
    int(lo, hi) {
      return lo + Math.floor(next() * (hi - lo + 1))
    },
    intExcept(lo, hi, except) {
      const candidates: number[] = []
      for (let v = lo; v <= hi; v++) if (!except.includes(v)) candidates.push(v)
      if (candidates.length === 0) throw new Error('intExcept: empty range')
      return candidates[Math.floor(next() * candidates.length)]!
    },
    pick(arr) {
      if (arr.length === 0) throw new Error('pick: empty array')
      return arr[Math.floor(next() * arr.length)]!
    },
    shuffle(arr) {
      const out = arr.slice()
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        const tmp = out[i]!
        out[i] = out[j]!
        out[j] = tmp
      }
      return out
    },
    chance(p) {
      return next() < p
    },
    sign() {
      return next() < 0.5 ? -1 : 1
    },
  }
  return rng
}

/** Mix a seed with a small integer (e.g. step index) to derive sub-seeds. */
export function mixSeed(seed: number, salt: number): number {
  return ((seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0) || 1
}

export function randomSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1
}

export function seedToBase36(seed: number): string {
  return (seed >>> 0).toString(36)
}

export function seedFromBase36(s: string): number {
  const v = parseInt(s, 36)
  if (!Number.isFinite(v) || v < 0) throw new Error(`bad seed: ${s}`)
  return v >>> 0
}
