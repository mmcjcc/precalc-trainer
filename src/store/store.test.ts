// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS, resetStoreForTests, useStore } from './index'

function start(problemId = 'inequalities/ineq.a@1/abc') {
  return useStore.getState().startAttempt({
    problemId,
    moduleId: 'inequalities',
    templateId: 'ineq.a',
    skill: 'ineq.a',
    seed: 'abc',
    difficulty: '',
    genVersion: 1,
    now: Date.now(),
  })
}

describe('store persistence (pct.* keys)', () => {
  beforeEach(() => {
    resetStoreForTests()
    localStorage.clear()
  })

  it('writes settings to pct.settings and only touches changed slices', () => {
    useStore.getState().setSettings({ calculator: 'nspire' })
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.settings)!)).toMatchObject({ calculator: 'nspire' })
    const eventsBefore = localStorage.getItem(STORAGE_KEYS.events)
    useStore.getState().setSettings({ testMode: true })
    expect(localStorage.getItem(STORAGE_KEYS.events)).toBe(eventsBefore)
  })

  it('persists the attempt after every accepted step and debounces the draft by 500 ms', () => {
    vi.useFakeTimers()
    try {
      start()
      const s = useStore.getState()
      s.setDraft('3x <= 9')
      expect(useStore.getState().attempt?.draft).toBe('')
      vi.advanceTimersByTime(499)
      expect(useStore.getState().attempt?.draft).toBe('')
      vi.advanceTimersByTime(1)
      expect(useStore.getState().attempt?.draft).toBe('3x <= 9')
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.attempt)!).draft).toBe('3x <= 9')

      s.setDraft('typing…')
      s.acceptStep({ text: '3x <= 9', propertyTag: 'sub_both' })
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.attempt)!)
      expect(stored.steps).toHaveLength(1)
      expect(stored.draft).toBe('')
      vi.advanceTimersByTime(600)
      expect(useStore.getState().attempt?.draft).toBe('') // pending draft was dropped by the accept
    } finally {
      vi.useRealTimers()
    }
  })

  it('records the event stream for an attempt and patches the property outcome in place', () => {
    start()
    const s = useStore.getState()
    s.rejectStep('no_sign_flip')
    s.acceptStep({ text: 'x >= -3' })
    s.answerProperty(0, 'correct', 'mul_div')
    s.useHint(1, 1)
    s.acceptStep({ text: 'x >= -3', revealed: true })
    const summary = s.finishAttempt({ finalCorrect: true, secs: 42 })
    expect(summary).toMatchObject({ steps: 2, firstTry: 0, hints: 1, revealed: 1, finalCorrect: true, secs: 42, streak: 1 })
    const types = useStore.getState().events.map((e) => e.t)
    expect(types).toEqual(['step_rejected', 'step_accepted', 'hint', 'step_accepted', 'problem_done'])
    const first = useStore.getState().events[1]
    expect(first).toMatchObject({ t: 'step_accepted', firstTry: false, property: 'correct' })
    expect(useStore.getState().attempt).toBeNull()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.events)!)).toHaveLength(5)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.streak)!)).toMatchObject({ count: 1 })
  })

  it('starting a different problem records problem_abandoned for the current one', () => {
    start('inequalities/ineq.a@1/abc')
    start('inequalities/ineq.b@1/zzz')
    const ev = useStore.getState().events
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ t: 'problem_abandoned', skill: 'ineq.a' })
  })

  it('undoStep pops the last step and puts its text back in the draft', () => {
    start()
    useStore.getState().acceptStep({ text: '3x <= 9' })
    const undone = useStore.getState().undoStep()
    expect(undone?.text).toBe('3x <= 9')
    expect(useStore.getState().attempt?.steps).toHaveLength(0)
    expect(useStore.getState().attempt?.draft).toBe('3x <= 9')
    expect(useStore.getState().events.at(-1)?.t).toBe('step_undone')
  })

  it('export → reset → import(merge) round-trips and stamps lastBackupAt', () => {
    start()
    useStore.getState().acceptStep({ text: 'x <= 1' })
    useStore.getState().finishAttempt({ finalCorrect: true })
    const json = useStore.getState().exportJson()
    expect(useStore.getState().meta.lastBackupAt).toBeTruthy()
    useStore.getState().resetProgress()
    expect(useStore.getState().events).toHaveLength(0)
    const r = useStore.getState().importJson(json, 'merge')
    expect(r).toEqual({ ok: true, added: 2 })
    expect(useStore.getState().events).toHaveLength(2)
    // importing the same file again adds nothing (dedup)
    expect(useStore.getState().importJson(json, 'merge')).toEqual({ ok: true, added: 0 })
    expect(useStore.getState().importJson('not json', 'merge')).toMatchObject({ ok: false })
  })

  it('keeps working in memory and toasts once when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    try {
      useStore.getState().setSettings({ askProperty: 'off' })
      useStore.getState().setSettings({ testMode: true })
      expect(useStore.getState().settings.askProperty).toBe('off')
      return new Promise<void>((resolve) => {
        queueMicrotask(() => {
          expect(useStore.getState().storageOk).toBe(false)
          expect(useStore.getState().toasts).toHaveLength(1)
          resolve()
        })
      })
    } finally {
      spy.mockRestore()
    }
  })

  it('rehydrates from pct.* keys with defaults filled in', () => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ calculator: 'nspire' }))
    localStorage.setItem(STORAGE_KEYS.events, JSON.stringify([{ t: 'drill_answer', at: 1, skill: 'd', correct: true, kind: 'legal' }, { bogus: true }]))
    localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify({ ok: true }))
    useStore.persist.rehydrate()
    const s = useStore.getState()
    expect(s.settings).toEqual({ calculator: 'nspire', askProperty: 'always', testMode: false, seenA2HS: false })
    expect(s.events).toHaveLength(1)
    expect(s.auth.ok).toBe(true)
    expect(s.hydrated).toBe(true)
  })
})

describe('review fixes: step accounting (F2, F3, F5)', () => {
  beforeEach(() => {
    resetStoreForTests()
    localStorage.clear()
  })

  it('F2: a step typed after rung 3 ("Show the step") counts as revealed and not first-try', () => {
    start()
    const s = useStore.getState()
    s.useHint(0, 1)
    s.useHint(0, 2)
    s.useHint(0, 3)
    // Typed by hand — "Use this line" was not clicked.
    expect(useStore.getState().acceptStep({ text: '3x < -3' })).toMatchObject({ revealed: true, firstTry: false })
    expect(useStore.getState().finishAttempt({})).toMatchObject({ revealed: 1, firstTry: 0 })
  })

  it('F2: rung 3 under a separate ladder key (even/odd slot) marks that slot step revealed', () => {
    start()
    useStore.getState().useHint(1000, 3)
    expect(useStore.getState().acceptStep({ text: 'B:-(x)', hintKey: 1000 })).toMatchObject({ revealed: true, firstTry: false })
  })

  it('F3: undo does not erase rejections at a step index', () => {
    start()
    useStore.getState().acceptStep({ text: '3x < -3' })
    useStore.getState().rejectStep()
    useStore.getState().rejectStep()
    useStore.getState().undoStep()
    expect(useStore.getState().acceptStep({ text: '3x < -3' })).toMatchObject({ firstTry: true })
    expect(useStore.getState().acceptStep({ text: 'x < -1' })).toMatchObject({ firstTry: false })
    useStore.getState().finishAttempt({})
    expect(useStore.getState().events.find((e) => e.t === 'problem_done')).toMatchObject({ steps: 2, firstTryRate: 0.5 })
  })

  it('F3: an attempt stored before rejectionsByIdx existed still loads and counts rejections', () => {
    const a = start()
    const legacy: Record<string, unknown> = { ...a }
    delete legacy.rejectionsByIdx
    useStore.setState({ attempt: null }) // (persists null — write the legacy shape after it)
    localStorage.setItem(STORAGE_KEYS.attempt, JSON.stringify(legacy))
    useStore.persist.rehydrate()
    expect(useStore.getState().attempt?.id).toBe(a.id)
    useStore.getState().rejectStep()
    expect(useStore.getState().acceptStep({ text: 'x < 1' })).toMatchObject({ firstTry: false })
  })

  it('F5: a wrong final answer earlier in the attempt makes finalCorrect false, even when finish says true', () => {
    start()
    useStore.getState().recordFinalAnswer({ correct: false, via: 'text' })
    useStore.getState().recordFinalAnswer({ correct: true, via: 'text' })
    expect(useStore.getState().finishAttempt({ finalCorrect: true })).toMatchObject({ finalCorrect: false })
    // No steps: the rate follows the first final-answer check (wrong → 0).
    expect(useStore.getState().events.find((e) => e.t === 'problem_done')).toMatchObject({ finalCorrect: false, firstTryRate: 0 })
  })

  it('F5: answer-only problem right on the first check → finalCorrect true, rate 1', () => {
    start()
    useStore.getState().recordFinalAnswer({ correct: true, via: 'text' })
    useStore.getState().finishAttempt({})
    expect(useStore.getState().events.find((e) => e.t === 'problem_done')).toMatchObject({ finalCorrect: true, firstTryRate: 1 })
  })
})
