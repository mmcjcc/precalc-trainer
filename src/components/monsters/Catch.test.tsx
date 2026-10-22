// @vitest-environment jsdom
/**
 * The catch (catchMoment.ts, MonsterTag.tsx): the first time she makes a mistake, the verdict that names it shows its
 * monster, "Caught: <name>", flipping in; once per mistake, remembered in the rewards' slice across a reload and a
 * backup import; after that, the small avatar beside the title. The new "gotcha" sound plays only with Sounds on.
 * Reduced motion: the same catch, standing still. On the real problem page: the work-list card and the phone composer.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '@/App'
import { ComposerStatus, patternVerdict } from '@/components/ComposerVerdict'
import { installFakeAudio, installMotion, removeMotion } from '@/components/juice/audioTesting'
import { onCuePlayed, resetSoundsForTests, type PlayedCue } from '@/components/juice/sounds'
import { MOMENT_MS, useJuice } from '@/components/juice/useJuice'
import { installPointer, removePointer } from '@/components/keypadTesting'
import { SigFigRejection } from '@/components/SigFigFeedback'
import { ERROR_PATTERNS } from '@/engine'
import { problemPath } from '@/problem/url'
import type { ErrorPatternId } from '@/shared/types'
import { STORAGE_KEYS, emptyRewards, namedPattern, resetStoreForTests, useEvents, useStore, type Ev } from '@/store'
import { resetCatchMomentForTests, useMonsterCatches } from './catchMoment'

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

const PAGE_TIMEOUT = 120_000
const LAZY = { timeout: 120_000 }
const DAY = 86_400_000

/** The shell's catch watcher and juice, and the verdicts for her latest named mistake: a parts card and the composer line. */
function Harness() {
  useMonsterCatches()
  useJuice()
  const events = useEvents()
  const last = [...events].reverse().map(namedPattern).find((p) => p !== null)
  if (!last) return null
  const hit = ERROR_PATTERNS[last as ErrorPatternId]
  return (
    <>
      <SigFigRejection message="Look again." patterns={[hit]} />
      <ComposerStatus verdict={patternVerdict(hit, 'Look again.')} onWhy={() => {}} onStuck={null} />
    </>
  )
}

function startAttempt() {
  useStore.getState().startAttempt({
    problemId: 'inequalities/ineq.linear@1/abc',
    moduleId: 'inequalities',
    templateId: 'ineq.linear',
    skill: 'ineq.linear',
    seed: 'abc',
    difficulty: '',
    genVersion: 1,
  })
}

const store = () => useStore.getState()
const caughtBanners = () => [...document.querySelectorAll<HTMLElement>('[data-monster-caught]')]
const avatars = (id: string) => document.querySelectorAll(`svg[data-monster="${id}"]`)
/** The memory is written right after the update that caught it. */
const settle = () => act(async () => {})

let played: PlayedCue[] = []
let stopListening: () => void = () => {}

beforeAll(async () => {
  await import('@/pages/Problem')
}, 120_000)

beforeEach(() => {
  resetStoreForTests()
  localStorage.clear()
  resetCatchMomentForTests()
  resetSoundsForTests()
  played = []
  stopListening = onCuePlayed((p) => played.push(p))
  installFakeAudio()
})

afterEach(() => {
  stopListening()
  vi.unstubAllGlobals()
  removeMotion()
  removePointer()
  resetSoundsForTests()
})

describe('the catch', () => {
  it('the first time: its monster, caught, flipping in, in the card and on the composer line; remembered; then only the avatar', async () => {
    installMotion(false)
    render(<Harness />)
    startAttempt()
    act(() => store().rejectStep('flip_on_add'))
    const banners = caughtBanners()
    // The work-list card and the composer line both show it.
    expect(banners).toHaveLength(2)
    for (const b of banners) {
      expect(b.getAttribute('data-monster-caught')).toBe('flip_on_add')
      expect(b.textContent).toContain('Caught: The Sign Flipper')
      expect(b.textContent).toContain('New in your monster collection.')
      expect(b.querySelector('.monster-flip-in')).toBeTruthy()
      expect(b.querySelector('svg.monster-wiggle')).toBeTruthy()
      // The picture is decorative; the words are the text.
      expect(b.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
    }
    // The words are inside the verdict's alert, so they are read with it.
    expect(within(screen.getByRole('alert')).getByText('Caught: The Sign Flipper')).toBeTruthy()
    // While it is caught, no second picture beside the title.
    expect(avatars('flip_on_add')).toHaveLength(2)
    await settle()
    expect(store().rewards.caught).toEqual(['flip_on_add'])

    // The same mistake again: no catch, its small avatar beside the title.
    act(() => store().rejectStep('flip_on_add'))
    expect(caughtBanners()).toEqual([])
    expect(avatars('flip_on_add')).toHaveLength(2)
    const title = screen.getByRole('alert').querySelector('p')!
    expect(title.querySelector('svg[data-monster="flip_on_add"]')).toBeTruthy()
    expect(title.textContent).toBe(`✗ Not quite: ${ERROR_PATTERNS.flip_on_add.title}`)

    // A new mistake is a new catch, a rare one says so.
    act(() => store().rejectStep('cbrt_sign_dropped'))
    expect(caughtBanners()[0]!.textContent).toContain('A rare one, new in your collection.')
    await settle()
    expect(store().rewards.caught).toEqual(['cbrt_sign_dropped', 'flip_on_add'])
  })

  it('what one tap records is one moment: two boxes with one new mistake catch it once, two new mistakes both', async () => {
    function TwoBoxes() {
      useMonsterCatches()
      return <SigFigRejection message="Look again." patterns={[ERROR_PATTERNS.endpoint_type, ERROR_PATTERNS.wrong_side]} />
    }
    render(<TwoBoxes />)
    startAttempt()
    act(() => {
      store().recordFinalAnswer({ correct: false, pattern: 'endpoint_type', via: 'text', part: 'Interval notation' })
      store().recordFinalAnswer({ correct: false, pattern: 'endpoint_type', via: 'text', part: 'Set-builder notation' })
      store().recordFinalAnswer({ correct: false, pattern: 'wrong_side', via: 'text', part: 'Set-builder notation' })
    })
    expect(caughtBanners().map((b) => b.getAttribute('data-monster-caught'))).toEqual(['endpoint_type', 'wrong_side'])
    await settle()
    expect(store().rewards.caught).toEqual(['endpoint_type', 'wrong_side'])
    // The next tap is a new moment: made before, so no catch.
    act(() => store().recordFinalAnswer({ correct: false, pattern: 'endpoint_type', via: 'text' }))
    expect(caughtBanners()).toEqual([])
  })

  it('reduced motion: the same catch, standing still', () => {
    installMotion(true)
    render(<Harness />)
    startAttempt()
    act(() => store().rejectStep('endpoint_type'))
    const banner = caughtBanners()[0]!
    expect(banner.textContent).toContain('Caught: Bracket Gremlin')
    expect(banner.querySelector('.monster-flip-in')).toBeNull()
    expect(banner.querySelector('.monster-wiggle')).toBeNull()
    expect(banner.querySelector('[data-monster-motion]')).toBeNull()
  })

  it('a mistake she made before the monsters (in her log) is not a catch; nor is anything an import or a reset brings', async () => {
    useStore.setState({ events: [{ t: 'step_rejected', at: Date.now() - 3 * DAY, attemptId: 'old', skill: 'ineq.linear', stepIdx: 0, pattern: 'no_sign_flip' }] })
    render(<Harness />)
    startAttempt()
    act(() => store().rejectStep('no_sign_flip'))
    expect(caughtBanners()).toEqual([])
    expect(avatars('no_sign_flip').length).toBeGreaterThan(0)
    // Old events put back (an import): no catch, nothing remembered.
    act(() => useStore.setState((s) => ({ events: [...s.events, { t: 'step_rejected', at: Date.now() - 2 * DAY, attemptId: 'x', skill: 'ineq.linear', stepIdx: 0, pattern: 'wrong_side' } as Ev] })))
    expect(caughtBanners()).toEqual([])
    await settle()
    expect(store().rewards.caught).toBeUndefined()
  })

  it('remembered across a reload: the saved slice alone keeps it from coming twice', async () => {
    render(<Harness />)
    startAttempt()
    act(() => store().rejectStep('flip_on_positive'))
    expect(caughtBanners()).toHaveLength(2)
    await settle()
    const saved = localStorage.getItem(STORAGE_KEYS.rewards)
    expect(JSON.parse(saved!).caught).toEqual(['flip_on_positive'])

    // The app opens again with only that slice (the log is gone, say compacted): the memory alone remembers.
    resetStoreForTests()
    resetCatchMomentForTests()
    localStorage.setItem(STORAGE_KEYS.rewards, saved!)
    await act(async () => {
      await useStore.persist.rehydrate()
    })
    expect(store().events).toEqual([])
    expect(store().rewards.caught).toEqual(['flip_on_positive'])
    startAttempt()
    act(() => store().rejectStep('flip_on_positive'))
    expect(caughtBanners()).toEqual([])
    expect(avatars('flip_on_positive').length).toBeGreaterThan(0)
  })

  it('remembered across a backup import, on a device that never saw it', async () => {
    render(<Harness />)
    startAttempt()
    act(() => store().rejectStep('swap_sides_no_reverse'))
    await settle()
    const backup = JSON.parse(store().exportJson())
    // Only the slice travels (no events), so the memory alone has to remember.
    backup.events = []
    resetStoreForTests()
    resetCatchMomentForTests()
    act(() => {
      expect(store().importJson(JSON.stringify(backup), 'replace').ok).toBe(true)
    })
    expect(store().rewards.caught).toEqual(['swap_sides_no_reverse'])
    startAttempt()
    act(() => store().rejectStep('swap_sides_no_reverse'))
    expect(caughtBanners()).toEqual([])
    // A merge keeps it too.
    act(() => {
      expect(store().importJson(JSON.stringify({ ...backup, rewards: { ...emptyRewards(), caught: ['wrong_side'] } }), 'merge').ok).toBe(true)
    })
    expect(store().rewards.caught).toEqual(['swap_sides_no_reverse', 'wrong_side'])
  })
})

describe('the catch’s sound', () => {
  const moment = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, MOMENT_MS + 40))
    })

  it('Sounds on: the “gotcha” for a first catch, the nope for a mistake made before', async () => {
    store().setSettings({ sounds: true })
    render(<Harness />)
    startAttempt()
    act(() => store().rejectStep('no_sign_flip'))
    await moment()
    expect(played.map((p) => p.cue)).toEqual(['catch'])
    act(() => store().rejectStep('no_sign_flip'))
    await moment()
    expect(played.map((p) => p.cue)).toEqual(['catch', 'slip'])
    // A wrong check that names a new mistake is a catch too.
    act(() => store().recordFinalAnswer({ correct: false, pattern: 'endpoint_type', via: 'text' }))
    await moment()
    expect(played.at(-1)!.cue).toBe('catch')
  })

  it('Sounds off (the family app’s default): silence, and the catch still shows', async () => {
    render(<Harness />)
    startAttempt()
    act(() => store().rejectStep('no_sign_flip'))
    await moment()
    expect(played).toEqual([])
    expect(caughtBanners().length).toBeGreaterThan(0)
  })
})

describe('on the problem page', () => {
  function renderAt(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <AppShell />
      </MemoryRouter>,
    )
  }

  it('a wide screen: the work-list card catches it, then shows its avatar', { timeout: PAGE_TIMEOUT }, async () => {
    window.scrollTo = () => {}
    renderAt(problemPath('inequalities', 'ineq.linear', 12345))
    // 3x + 6 < 3: moving the 6 without changing its sign.
    const line = await screen.findByLabelText('Next line', {}, LAZY)
    fireEvent.change(line, { target: { value: '3x < 9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check this step' }))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Caught: The Sign Flipper')
    expect(alert.textContent).toContain(`Not accepted: ${ERROR_PATTERNS.term_across_sign.title}`)
    await settle()
    expect(store().rewards.caught).toEqual(['term_across_sign'])
    // The same mistake in another line.
    fireEvent.change(screen.getByLabelText('Next line'), { target: { value: '3x < 3 + 6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check this step' }))
    const again = screen.getByRole('alert')
    expect(again.textContent).not.toContain('Caught:')
    expect(again.querySelector('svg[data-monster="term_across_sign"]')).toBeTruthy()
  })

  it('a phone: the composer line catches it where she is looking', { timeout: PAGE_TIMEOUT }, async () => {
    installPointer(true)
    window.scrollTo = () => {}
    renderAt(problemPath('inequalities', 'ineq.linear', 12345))
    const line = await screen.findByLabelText('Next line', {}, LAZY)
    fireEvent.change(line, { target: { value: '3x > -3' } })
    fireEvent.click(screen.getByRole('button', { name: /^Check/ }))
    const status = document.querySelector<HTMLElement>('[data-composer-status]')!
    expect(status.querySelector('[data-monster-caught="flip_on_add"]')!.textContent).toContain('Caught: The Sign Flipper')
    expect(status.textContent).toContain(ERROR_PATTERNS.flip_on_add.title)
  })
})
