/**
 * Mistake Monsters' catches (store/catches.ts): which events name a mistake, which of them are first catches, and the
 * memory of catches in the rewards' slice (normalized, merged, carried by backups, cleared by a reset).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { buildBackup, importBackup, normalizeSettings } from './backup'
import { caughtPatterns, firstCatches, mergeCatches, namedPattern, normalizeCatches } from './catches'
import { resetStoreForTests, useStore } from './index'
import { mergeRewards, normalizeRewards } from './rewards'
import { EMPTY_STREAK, emptyRewards, type Ev, type RewardsState } from './types'

const AT = 1_700_000_000_000

function rejected(pattern: string | undefined, at = AT, attemptId = 'a'): Ev {
  return { t: 'step_rejected', at, attemptId, skill: 'ineq.linear', stepIdx: 0, ...(pattern ? { pattern } : {}) }
}

function check(correct: boolean, pattern?: string, at = AT): Ev {
  return { t: 'final_answer', at, attemptId: 'a', skill: 'nl.read', correct, via: 'text', ...(pattern ? { pattern } : {}) }
}

describe('what counts as catching a mistake', () => {
  it('a rejected line or a wrong check that names a pattern; nothing else', () => {
    expect(namedPattern(rejected('no_sign_flip'))).toBe('no_sign_flip')
    expect(namedPattern(rejected(undefined))).toBeNull()
    expect(namedPattern(check(false, 'endpoint_type'))).toBe('endpoint_type')
    expect(namedPattern(check(false))).toBeNull()
    // A right check never names a mistake, even with a pattern on it.
    expect(namedPattern(check(true, 'endpoint_type'))).toBeNull()
    expect(namedPattern({ t: 'hint', at: AT, attemptId: 'a', skill: 's', stepIdx: 0, rung: 1 })).toBeNull()
  })

  it('a first catch is a mistake never made before: not in the log, the folded cards or the memory', () => {
    const empty = { events: [] as Ev[], rewards: emptyRewards() }
    expect(firstCatches([rejected('no_sign_flip')], empty)).toEqual(['no_sign_flip'])
    // Twice in one moment (two boxes, one mistake): one catch.
    expect(firstCatches([check(false, 'endpoint_type'), check(false, 'endpoint_type'), check(false, 'wrong_side')], empty)).toEqual(['endpoint_type', 'wrong_side'])
    // Made before: in the log...
    expect(firstCatches([rejected('no_sign_flip', AT + 5)], { events: [rejected('no_sign_flip')], rewards: emptyRewards() })).toEqual([])
    // ...in a card the compaction folded...
    const folded: RewardsState = {
      ...emptyRewards(),
      cards: { 'no_sign_flip|ineq.linear': { pattern: 'no_sign_flip', skill: 'ineq.linear', count: 2, firstAt: AT, lastAt: AT, lastAttempt: 'x', clean: 0 } },
    }
    expect(firstCatches([rejected('no_sign_flip', AT + 5)], { events: [], rewards: folded })).toEqual([])
    // ...or remembered in the slice.
    expect(firstCatches([rejected('no_sign_flip', AT + 5)], { events: [], rewards: { ...emptyRewards(), caught: ['no_sign_flip'] } })).toEqual([])
    expect([...caughtPatterns([rejected('a1'), check(false, 'b1')], { ...folded, caught: ['c1'] })].sort()).toEqual(['a1', 'b1', 'c1', 'no_sign_flip'])
  })
})

describe('the memory in the rewards slice (additive)', () => {
  const slice = (caught?: string[]): RewardsState => ({ ...emptyRewards(), ...(caught ? { caught } : {}) })

  it('merged and normalized: strings, sorted, once; a slice from before has none', () => {
    expect(mergeCatches(['b', 'a'], ['a', 'c'])).toEqual(['a', 'b', 'c'])
    expect(mergeCatches(undefined, undefined)).toEqual([])
    expect(normalizeCatches(['x', 3, 'x', ''])).toEqual(['x'])
    expect(normalizeCatches('x')).toBeUndefined()
    expect(normalizeCatches([])).toBeUndefined()
    expect(normalizeRewards({ ...emptyRewards(), caught: ['wrong_side', 'endpoint_type'] }).caught).toEqual(['endpoint_type', 'wrong_side'])
    expect(normalizeRewards(emptyRewards())).toEqual(emptyRewards())
    expect('caught' in normalizeRewards({ caught: [7] })).toBe(false)
  })

  it('a merge import keeps every catch either device had', () => {
    expect(mergeRewards(slice(['a']), slice(['b'])).caught).toEqual(['a', 'b'])
    expect('caught' in mergeRewards(slice(), slice())).toBe(false)
  })

  it('a backup carries them, replace and merge alike', () => {
    const mine = { settings: normalizeSettings({}), events: [], weekly: {}, streak: { ...EMPTY_STREAK }, rewards: slice(['no_sign_flip']) }
    const text = JSON.stringify(buildBackup({ ...mine, rewards: slice(['endpoint_type']) }))
    const replaced = importBackup(mine, text, 'replace')
    const merged = importBackup(mine, text, 'merge')
    if (!replaced.ok || !merged.ok) throw new Error('import failed')
    expect(replaced.rewards.caught).toEqual(['endpoint_type'])
    expect(merged.rewards.caught).toEqual(['endpoint_type', 'no_sign_flip'])
  })
})

describe('the store', () => {
  beforeEach(() => resetStoreForTests())

  it('noteCatches adds to the memory once; a reset clears it', () => {
    const before = useStore.getState().rewards
    useStore.getState().noteCatches(['wrong_side', 'endpoint_type'])
    expect(useStore.getState().rewards.caught).toEqual(['endpoint_type', 'wrong_side'])
    const after = useStore.getState().rewards
    expect(after).not.toBe(before)
    useStore.getState().noteCatches(['wrong_side'])
    expect(useStore.getState().rewards).toBe(after)
    useStore.getState().resetProgress()
    expect(useStore.getState().rewards.caught).toBeUndefined()
  })
})
