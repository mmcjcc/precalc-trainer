import { describe, expect, it } from 'vitest'
import { buildBackup, importBackup, normalizeSettings, settingsAfterImport } from './backup'
import { mergeMilestones, milestoneReached, milestonesThrough, normalizeMilestones } from './milestones'
import { mergeRewards, normalizeRewards } from './rewards'
import { EMPTY_STREAK, emptyRewards, type RewardsState } from './types'

describe('streak milestones', () => {
  it('a streak that crosses 7, 30 or 100 reaches it, unless it was celebrated before', () => {
    expect(milestoneReached(6, 7)).toBe(7)
    expect(milestoneReached(6, 7, [7])).toBeNull()
    expect(milestoneReached(29, 30, [7])).toBe(30)
    expect(milestoneReached(99, 100, [7, 30])).toBe(100)
    // Already past it (an existing streak, an import): nothing crossed.
    expect(milestoneReached(9, 10)).toBeNull()
    expect(milestoneReached(7, 7)).toBeNull()
    // Two at once (a merged log): the highest.
    expect(milestoneReached(5, 31)).toBe(30)
    expect(milestoneReached(0, 0)).toBeNull()
  })

  it('the lower milestones count as celebrated with the highest', () => {
    expect(milestonesThrough(6)).toEqual([])
    expect(milestonesThrough(31)).toEqual([7, 30])
    expect(milestonesThrough(100)).toEqual([7, 30, 100])
  })

  it('merged, normalized: known milestones, sorted, once', () => {
    expect(mergeMilestones([30], [7, 30])).toEqual([7, 30])
    expect(mergeMilestones(undefined, undefined)).toEqual([])
    expect(normalizeMilestones([100, 7, 'x', 12, 7])).toEqual([7, 100])
    expect(normalizeMilestones('7')).toBeUndefined()
    expect(normalizeMilestones([])).toBeUndefined()
  })
})

describe('the rewards slice keeps them (additive)', () => {
  const slice = (milestones?: number[]): RewardsState => ({ ...emptyRewards(), ...(milestones ? { milestones } : {}) })

  it('storage and backups read them; a slice from before has none', () => {
    expect(normalizeRewards({ ...emptyRewards(), milestones: [7, 30] }).milestones).toEqual([7, 30])
    expect(normalizeRewards(emptyRewards())).toEqual(emptyRewards())
    expect('milestones' in normalizeRewards({ milestones: ['seven'] })).toBe(false)
  })

  it('a merge import keeps every milestone either device celebrated', () => {
    expect(mergeRewards(slice([7]), slice([30])).milestones).toEqual([7, 30])
    expect('milestones' in mergeRewards(slice(), slice())).toBe(false)
  })

  it('a backup carries them, replace and merge alike', () => {
    const mine = { settings: normalizeSettings({}), events: [], weekly: {}, streak: { ...EMPTY_STREAK }, rewards: slice([7]) }
    const text = JSON.stringify(buildBackup({ ...mine, rewards: slice([7, 30]) }))
    const replaced = importBackup(mine, text, 'replace')
    const merged = importBackup({ ...mine, rewards: slice([100]) }, text, 'merge')
    if (!replaced.ok || !merged.ok) throw new Error('import failed')
    expect(replaced.rewards.milestones).toEqual([7, 30])
    expect(merged.rewards.milestones).toEqual([7, 30, 100])
  })
})

describe('the Sounds switch belongs to the device', () => {
  it('is read from storage and backups, and an import never changes it', () => {
    expect(normalizeSettings({ sounds: true }).sounds).toBe(true)
    expect(normalizeSettings({ sounds: 'yes' }).sounds).toBeUndefined()
    const here = normalizeSettings({ sounds: false })
    const file = normalizeSettings({ sounds: true, dailyGoal: 100 })
    expect(settingsAfterImport(here, file, 'replace').sounds).toBe(false)
    expect(settingsAfterImport(here, file, 'replace').dailyGoal).toBe(100)
    expect(settingsAfterImport(here, file, 'merge').sounds).toBe(false)
    // Never set here: the edition's default stays (absent), whatever the file says.
    expect('sounds' in settingsAfterImport(normalizeSettings({}), file, 'replace')).toBe(false)
  })
})
