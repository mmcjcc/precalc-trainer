/**
 * Tier 2, two variables: x/y slicing (engine-design §5b).
 *
 * Fix x at each slice value and run the one-variable boundary method in y on [−60, 60] for both
 * statements; then fix y and root-find in x. Both directions are mandatory: `x = 3` vs `x = 5`
 * has no y-roots on any x-slice (looks equivalent) but x-roots {3} vs {5} at y = 1.
 */
import type { Verdict } from '@/shared/types'
import { compareSets1D, GRID_N_SLICE, verdictFromMismatches, type Mismatch } from './roots'
import { mulberry32, type Scope } from './samples'
import type { Statement } from './types'

export const SLICE_VALUES: readonly number[] = [-8, -5, -3, -2, -1, -0.5, 0.5, 1, 2, 3, 5, 8]

export interface SliceMismatch extends Mismatch {
  /** Which variable was held fixed on the slice that produced this point. */
  fixedVar: string
  freeVar: string
  /** Roots of the old / new statements in `freeVar` on that slice (for "needs y = …" messages). */
  oldRoots: number[]
  newRoots: number[]
}

export interface SliceComparison {
  verdict: Verdict
  mismatches: SliceMismatch[]
  informative: number
}

export function sliceValues(seed: number, checkValue?: number): number[] {
  const rand = mulberry32(seed ^ 0x3c6ef372)
  const out = [...SLICE_VALUES]
  for (let i = 0; i < 4; i++) out.push(Math.round((rand() * 20 - 10) * 100) / 100)
  if (checkValue != null && Number.isFinite(checkValue) && !out.includes(checkValue)) out.push(checkValue)
  return out
}

/**
 * Compare the solution sets of two statements in the two variables `vars` (typically x and y).
 * Extra variables (e.g. a third one) are held at 1.
 */
export function compareSets2D(
  oldS: Statement,
  newS: Statement,
  vars: readonly string[],
  seed = 1,
  checkValue?: number,
): SliceComparison {
  const [a, b] = vars
  if (!a || !b) throw new Error('compareSets2D needs two variables')
  const base: Scope = {}
  for (const v of vars.slice(2)) base[v] = 1
  const mismatches: SliceMismatch[] = []
  let informative = 0
  const values = sliceValues(seed, checkValue)
  for (const [fixedVar, freeVar] of [
    [a, b],
    [b, a],
  ] as const) {
    for (const v of values) {
      const fixed: Scope = { ...base, [fixedVar]: v }
      const cmp = compareSets1D(oldS, newS, freeVar, fixed, seed, GRID_N_SLICE)
      informative += cmp.informative
      for (const m of cmp.mismatches) {
        mismatches.push({ ...m, fixedVar, freeVar, oldRoots: cmp.oldRoots, newRoots: cmp.newRoots })
      }
    }
  }
  return { verdict: verdictFromMismatches(mismatches, informative), mismatches, informative }
}
