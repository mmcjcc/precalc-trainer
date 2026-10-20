import { describe, expect, it } from 'vitest'
import { BACKUP_APP_ID, LEGACY_BACKUP_APP_ID, buildBackup, importBackup, parseBackup, settingsAfterImport } from './backup'
import { DEFAULT_SETTINGS, emptyRewards, type Ev, type RewardsState, type Settings } from './types'

const oldFile = JSON.stringify({
  app: LEGACY_BACKUP_APP_ID,
  schemaVersion: 1,
  exportedAt: '2026-09-01T00:00:00.000Z',
  settings: {
    calculator: 'nspire',
    askProperty: 'off',
    testMode: true,
    seenA2HS: true,
    courseId: 'chemistry',
    unitByCourse: { chemistry: 'ch5', precalc: 'unit1' },
  },
  events: [{ t: 'drill_answer', at: 5, skill: 'powers-roots', correct: true, kind: 'legal' } satisfies Ev],
  weekly: {},
  streak: { lastDay: '', count: 0 },
})

describe('backup app name', () => {
  it('imports a file exported under the old name and writes the new name', () => {
    const parsed = parseBackup(oldFile)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.backup.app).toBe(BACKUP_APP_ID)
    expect(parsed.backup.settings.courseId).toBe('chemistry')
    expect(parsed.backup.settings.unitByCourse).toEqual({ chemistry: 'ch5', precalc: 'unit1' })
    expect(parsed.backup.settings.calculator).toBe('nspire')

    const imported = importBackup({ events: [], weekly: {}, streak: { lastDay: '', count: 0 } }, oldFile, 'replace')
    expect(imported.ok).toBe(true)
    if (!imported.ok) return
    expect(imported.events).toHaveLength(1)
    expect(imported.settings.courseId).toBe('chemistry')

    const exported = buildBackup({
      settings: parsed.backup.settings,
      events: imported.events,
      weekly: {},
      streak: { lastDay: '', count: 0 },
    })
    expect(exported.app).toBe(BACKUP_APP_ID)
    expect(JSON.parse(JSON.stringify(exported)).app).toBe('math-science-trainer')
  })

  it('rejects a file that is neither the old name nor the new one', () => {
    const bad = oldFile.replace(LEGACY_BACKUP_APP_ID, 'some-other-app')
    const parsed = parseBackup(bad)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toMatch(/Math & Science Trainer/)
  })

  it('loads settings saved before classes existed, and keeps a class choice the file does not mention', () => {
    const legacy = JSON.stringify({
      app: LEGACY_BACKUP_APP_ID,
      schemaVersion: 1,
      settings: { calculator: 'ti84' },
      events: [],
      weekly: {},
      streak: { lastDay: '', count: 0 },
    })
    const parsed = parseBackup(legacy)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.backup.settings.courseId).toBeUndefined()
    expect(parsed.backup.settings.askProperty).toBe('always')
    expect(parsed.backup.settings.calculator).toBe('ti84')

    const current: Settings = { ...DEFAULT_SETTINGS, courseId: 'precalc', unitByCourse: { precalc: 'unit2' } }
    const merged = settingsAfterImport(current, parsed.backup.settings, 'merge')
    expect(merged.courseId).toBe('precalc')
    expect(merged.unitByCourse).toEqual({ precalc: 'unit2' })
    expect(merged.calculator).toBe('ti84')
  })

  it("merge keeps this device's settings and only fills in a class it has not chosen", () => {
    const parsed = parseBackup(oldFile)
    if (!parsed.ok) throw new Error(parsed.error)
    const fresh = settingsAfterImport({ ...DEFAULT_SETTINGS }, parsed.backup.settings, 'merge')
    expect(fresh).toEqual({ ...DEFAULT_SETTINGS, courseId: 'chemistry', unitByCourse: { chemistry: 'ch5', precalc: 'unit1' } })

    const current: Settings = { ...DEFAULT_SETTINGS, courseId: 'precalc', unitByCourse: { precalc: 'unit2' } }
    const merged = settingsAfterImport(current, parsed.backup.settings, 'merge')
    expect(merged.calculator).toBe('ti84')
    expect(merged.askProperty).toBe('always')
    expect(merged.testMode).toBe(false)
    expect(merged.courseId).toBe('precalc')
    expect(merged.unitByCourse).toEqual({ chemistry: 'ch5', precalc: 'unit2' })
  })

  it('the math keypad belongs to the device: an import never changes it, and junk in a file is ignored', () => {
    const fromComputer = JSON.stringify({ ...JSON.parse(oldFile), settings: { ...JSON.parse(oldFile).settings, mathKeypad: true } })
    const parsed = parseBackup(fromComputer)
    if (!parsed.ok) throw new Error(parsed.error)
    expect(parsed.backup.settings.mathKeypad).toBe(true)
    const phone: Settings = { ...DEFAULT_SETTINGS, mathKeypad: false }
    expect(settingsAfterImport(phone, parsed.backup.settings, 'replace').mathKeypad).toBe(false)
    expect(settingsAfterImport(phone, parsed.backup.settings, 'merge').mathKeypad).toBe(false)
    // A device that never touched the switch keeps the default (absent = on).
    expect('mathKeypad' in settingsAfterImport({ ...DEFAULT_SETTINGS }, parsed.backup.settings, 'replace')).toBe(false)
    // Junk in the file is ignored.
    const junk = parseBackup(JSON.stringify({ ...JSON.parse(oldFile), settings: { mathKeypad: 'yes' } }))
    if (!junk.ok) throw new Error(junk.error)
    expect('mathKeypad' in junk.backup.settings).toBe(false)
  })

  it("replace takes the file's settings but never its test mode or its home-screen flag", () => {
    const parsed = parseBackup(oldFile)
    if (!parsed.ok) throw new Error(parsed.error)
    const replaced = settingsAfterImport({ ...DEFAULT_SETTINGS }, parsed.backup.settings, 'replace')
    expect(replaced.calculator).toBe('nspire')
    expect(replaced.askProperty).toBe('off')
    expect(replaced.courseId).toBe('chemistry')
    expect(replaced.testMode).toBe(false)
    expect(replaced.seenA2HS).toBe(false)
  })
})

describe('the rewards in a backup', () => {
  const rewards: RewardsState = {
    days: { '2026-07-01': 1, '2026-07-02': 2 },
    settledThrough: '2026-09-15',
    foldedThrough: Date.UTC(2026, 6, 18),
    cards: {
      'no_sign_flip|ineq.linear': { pattern: 'no_sign_flip', skill: 'ineq.linear', count: 4, firstAt: 1, lastAt: 9, lastAttempt: 'a', clean: 2 },
    },
    mastered: { 'ineq.linear': 5 },
  }
  const file = () =>
    JSON.stringify(
      buildBackup({
        settings: { ...DEFAULT_SETTINGS, rewards: true, dailyGoal: 100, vibrate: false },
        events: [],
        weekly: {},
        streak: { lastDay: '', count: 0 },
        rewards,
      }),
    )

  it('round trip: the slice comes back as it went out, and replace takes it', () => {
    const parsed = parseBackup(file())
    if (!parsed.ok) throw new Error(parsed.error)
    expect(parsed.backup.rewards).toEqual(rewards)
    expect(parsed.backup.settings).toMatchObject({ rewards: true, dailyGoal: 100, vibrate: false })
    const replaced = importBackup({ events: [], weekly: {}, streak: { lastDay: '', count: 0 }, rewards: emptyRewards() }, file(), 'replace')
    if (!replaced.ok) throw new Error(replaced.error)
    expect(replaced.rewards).toEqual(rewards)
  })

  it('a file from before the rewards imports with an empty slice; merge keeps this device’s days and adds the file’s', () => {
    const parsed = parseBackup(oldFile)
    if (!parsed.ok) throw new Error(parsed.error)
    expect(parsed.backup.rewards).toEqual(emptyRewards())
    const mine: RewardsState = { ...emptyRewards(), days: { '2026-07-02': 1, '2026-09-01': 1 }, settledThrough: '2026-09-10' }
    const merged = importBackup({ events: [], weekly: {}, streak: { lastDay: '', count: 0 }, rewards: mine }, file(), 'merge')
    if (!merged.ok) throw new Error(merged.error)
    expect(merged.rewards.days).toEqual({ '2026-07-01': 1, '2026-07-02': 2, '2026-09-01': 1 })
    expect(merged.rewards.settledThrough).toBe('2026-09-10')
    expect(merged.rewards.cards['no_sign_flip|ineq.linear']).toMatchObject({ count: 4, clean: 2 })
  })

  it('the daily goal travels with a replace; the rewards and vibrate switches belong to the device', () => {
    const parsed = parseBackup(file())
    if (!parsed.ok) throw new Error(parsed.error)
    const phone: Settings = { ...DEFAULT_SETTINGS, rewards: false, vibrate: true }
    const replaced = settingsAfterImport(phone, parsed.backup.settings, 'replace')
    expect(replaced).toMatchObject({ dailyGoal: 100, rewards: false, vibrate: true })
    // A device that never touched the switches keeps its edition's default (absent).
    const fresh = settingsAfterImport({ ...DEFAULT_SETTINGS }, parsed.backup.settings, 'replace')
    expect('rewards' in fresh || 'vibrate' in fresh).toBe(false)
    expect(fresh.dailyGoal).toBe(100)
    // Merge keeps this device's goal.
    expect(settingsAfterImport({ ...DEFAULT_SETTINGS, dailyGoal: 30 }, parsed.backup.settings, 'merge').dailyGoal).toBe(30)
    // Junk is dropped.
    const junk = parseBackup(JSON.stringify({ ...JSON.parse(oldFile), settings: { dailyGoal: 45, rewards: 'yes' } }))
    if (!junk.ok) throw new Error(junk.error)
    expect('dailyGoal' in junk.backup.settings || 'rewards' in junk.backup.settings).toBe(false)
  })
})

describe('Guided mode in a backup', () => {
  const att = 'expLogEquations/ee.exponential@1/1#k1'
  const events: Ev[] = [
    { t: 'step_rejected', at: 10, attemptId: att, skill: 'ee.exponential', stepIdx: 0, pattern: 'log_one_side', via: 'card' },
    { t: 'step_accepted', at: 11, attemptId: att, skill: 'ee.exponential', stepIdx: 0, firstTry: false, revealed: false, property: 'skipped', via: 'card', rule: 'ee-convert' },
    { t: 'step_accepted', at: 12, attemptId: att, skill: 'ee.exponential', stepIdx: 1, firstTry: true, revealed: false, property: 'skipped', rule: 'ee-convert' },
    { t: 'final_answer', at: 13, attemptId: att, skill: 'ee.exponential', correct: true, via: 'text' },
    {
      t: 'problem_done',
      at: 14,
      attemptId: att,
      skill: 'ee.exponential',
      moduleId: 'expLogEquations',
      steps: 2,
      firstTryRate: 0.5,
      hints: 0,
      revealed: 0,
      finalCorrect: true,
      mode: 'normal',
      secs: 50,
      picked: 1,
    },
  ]
  const file = (settings: Settings = { ...DEFAULT_SETTINGS, lineEntry: 'pick' }) =>
    JSON.stringify(buildBackup({ settings, events, weekly: {}, streak: { lastDay: '', count: 0 } }))

  it('events with via card (and the step type, and picked) survive export and import, replace and merge', () => {
    const replaced = importBackup({ events: [], weekly: {}, streak: { lastDay: '', count: 0 } }, file(), 'replace')
    if (!replaced.ok) throw new Error(replaced.error)
    expect(replaced.events).toEqual(events)
    // Merge into a device that already has the first two: nothing twice, the rest added as they were.
    const merged = importBackup({ events: events.slice(0, 2), weekly: {}, streak: { lastDay: '', count: 0 } }, file(), 'merge')
    if (!merged.ok) throw new Error(merged.error)
    expect(merged.added).toBe(3)
    expect(merged.events).toEqual(events)
  })

  it('Type / Pick belongs to the device: kept through a replace and a merge; junk is dropped', () => {
    const parsed = parseBackup(file())
    if (!parsed.ok) throw new Error(parsed.error)
    expect(parsed.backup.settings.lineEntry).toBe('pick')
    expect(settingsAfterImport({ ...DEFAULT_SETTINGS, lineEntry: 'type' }, parsed.backup.settings, 'replace').lineEntry).toBe('type')
    expect('lineEntry' in settingsAfterImport({ ...DEFAULT_SETTINGS }, parsed.backup.settings, 'replace')).toBe(false)
    expect(settingsAfterImport({ ...DEFAULT_SETTINGS, lineEntry: 'pick' }, { ...DEFAULT_SETTINGS }, 'replace').lineEntry).toBe('pick')
    expect(settingsAfterImport({ ...DEFAULT_SETTINGS }, parsed.backup.settings, 'merge').lineEntry).toBeUndefined()
    const junk = parseBackup(JSON.stringify({ ...JSON.parse(oldFile), settings: { lineEntry: 'swipe' } }))
    if (!junk.ok) throw new Error(junk.error)
    expect('lineEntry' in junk.backup.settings).toBe(false)
  })
})
