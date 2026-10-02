import { describe, expect, it } from 'vitest'
import { BACKUP_APP_ID, LEGACY_BACKUP_APP_ID, buildBackup, importBackup, parseBackup, settingsAfterImport } from './backup'
import { DEFAULT_SETTINGS, type Ev, type Settings } from './types'

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
