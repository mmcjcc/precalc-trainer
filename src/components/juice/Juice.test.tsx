// @vitest-environment jsdom
/**
 * The juice that follows the event log (useJuice.ts): which sound plays for which event, the Sounds switch, silence for
 * an import or a reset and where Web Audio is missing; with rewards on the "+10" floats, the goal's confetti and the
 * streak milestone celebrated once per milestone; reduced motion; the count-up, the kept line's pop and the flame.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkedColumn } from '@/components/WorkedColumn'
import { Home } from '@/pages/Home'
import { SettingsPage } from '@/pages/Settings'
import { emptyRewards, resetStoreForTests, useAttempt, useStore, type AttemptStep, type Ev } from '@/store'
import { installFakeAudio, installMotion, removeAudio, removeMotion } from './audioTesting'
import { CountUp } from './CountUp'
import { flameSize, resetFlareForTests, StreakFlame } from './Flame'
import { JuiceLayers } from './JuiceLayers'
import { onCuePlayed, resetSoundsForTests, type PlayedCue } from './sounds'
import { MOMENT_MS, useJuice } from './useJuice'

const PAGE_TIMEOUT = 120_000
const DAY = 86_400_000
const SKILL = 'ineq.linear'

let played: PlayedCue[] = []
let stopListening: () => void = () => {}

/** Local time `offset` days from today, at `hour`. */
function dayAt(offset: number, hour = 9): number {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, hour).getTime()
}

function done(attemptId: string, at: number, opts: Partial<Extract<Ev, { t: 'problem_done' }>> = {}): Ev {
  return { t: 'problem_done', at, attemptId, skill: SKILL, moduleId: 'inequalities', steps: 2, firstTryRate: 1, hints: 0, revealed: 0, finalCorrect: true, mode: 'timed', secs: 60, ...opts }
}

function line(attemptId: string, stepIdx: number, at: number): Ev {
  return { t: 'step_accepted', at, attemptId, skill: SKILL, stepIdx, firstTry: true, revealed: false, property: 'skipped' }
}

/** Her goal (60 XP: two timed problems of 30) met on each of the `n` days before today. */
function metDays(n: number): Ev[] {
  const out: Ev[] = []
  for (let d = -n; d <= -1; d++) out.push(done(`m${d}a`, dayAt(d)), done(`m${d}b`, dayAt(d, 10)))
  return out
}

function startAttempt() {
  useStore.getState().startAttempt({
    problemId: 'inequalities/ineq.linear@1/abc',
    moduleId: 'inequalities',
    templateId: SKILL,
    skill: SKILL,
    seed: 'abc',
    difficulty: '',
    genVersion: 1,
  })
}

/** The app shell's juice, with the open attempt's work list (the "+10" rises from its kept lines). */
function Harness() {
  useJuice()
  const attempt = useAttempt()
  return (
    <>
      <WorkedColumn start={null} steps={attempt?.steps ?? []} />
      <JuiceLayers />
    </>
  )
}

/** Let one moment be decided (the juice waits for the store updates one tap makes). */
const moment = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, MOMENT_MS + 40))
  })

const cues = () => played.map((p) => p.cue)
const store = () => useStore.getState()
const soundsOnHere = () => store().setSettings({ sounds: true })

beforeEach(() => {
  resetStoreForTests()
  localStorage.clear()
  resetSoundsForTests()
  resetFlareForTests()
  played = []
  stopListening = onCuePlayed((p) => played.push(p))
  installFakeAudio()
})

afterEach(() => {
  stopListening()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  removeMotion()
  resetSoundsForTests()
})

describe('sounds follow the event log', () => {
  it('a chime that climbs with the combo, the nope for a slip, the arpeggio at the finish (rewards off too)', { timeout: PAGE_TIMEOUT }, async () => {
    soundsOnHere()
    // A mistake she has made before (the first time is a catch, components/monsters/Catch.test.tsx).
    useStore.setState({ rewards: { ...emptyRewards(), caught: ['no_sign_flip'] } })
    render(<Harness />)
    startAttempt()
    for (const n of [3, 4, 5]) {
      act(() => {
        store().acceptStep({ text: `x < ${n}` })
      })
      await moment()
    }
    expect(played.map((p) => [p.cue, p.step])).toEqual([
      ['right', 0],
      ['right', 1],
      ['right', 2],
    ])
    act(() => store().rejectStep('no_sign_flip'))
    await moment()
    expect(cues().at(-1)).toBe('slip')
    // Fixed after the slip: a right line, the chime back at the bottom (the slip reset the combo quietly).
    act(() => {
      store().acceptStep({ text: 'x < 6' })
    })
    await moment()
    expect(played.at(-1)).toMatchObject({ cue: 'right', step: 0 })
    // A hint is not a sound.
    act(() => store().useHint(4, 1))
    await moment()
    expect(played).toHaveLength(5)
    act(() => {
      store().recordFinalAnswer({ correct: true, via: 'text' })
      store().finishAttempt()
    })
    await moment()
    expect(cues().at(-1)).toBe('finish')
    expect(played).toHaveLength(6)
  })

  it('a check that grades two boxes is one moment: one chime, two steps up', { timeout: PAGE_TIMEOUT }, async () => {
    soundsOnHere()
    render(<Harness />)
    startAttempt()
    act(() => {
      store().recordFinalAnswer({ correct: true, via: 'text', part: 'Interval notation' })
      store().recordFinalAnswer({ correct: true, via: 'text', part: 'Set-builder notation' })
    })
    await moment()
    expect(played).toEqual([{ cue: 'right', step: 1, delay: 0 }])
  })

  it('the switch silences them (off by default in the family web app)', { timeout: PAGE_TIMEOUT }, async () => {
    render(<Harness />)
    startAttempt()
    act(() => {
      store().acceptStep({ text: 'x < 3' })
    })
    await moment()
    expect(played).toEqual([])
  })

  it('nothing plays for an import, a reset or old events put back', { timeout: PAGE_TIMEOUT }, async () => {
    soundsOnHere()
    render(<Harness />)
    act(() => useStore.setState({ events: [line('z', 0, Date.now() - 2 * DAY), line('z', 1, Date.now() - DAY)] }))
    await moment()
    const backup = JSON.stringify({ app: 'math-science-trainer', schemaVersion: 1, settings: {}, events: [line('y', 0, Date.now() - 3 * DAY)], weekly: {}, streak: { lastDay: '', count: 0 } })
    act(() => {
      expect(store().importJson(backup, 'merge').ok).toBe(true)
    })
    await moment()
    act(() => store().resetProgress())
    await moment()
    expect(played).toEqual([])
    expect(FakeAudioContextCount()).toBe(0)
  })

  it('where Web Audio is missing, the app is silent and nothing throws', { timeout: PAGE_TIMEOUT }, async () => {
    removeAudio()
    soundsOnHere()
    render(<Harness />)
    startAttempt()
    act(() => {
      store().acceptStep({ text: 'x < 3' })
    })
    await moment()
    expect(played).toEqual([])
  })
})

/** Contexts the fake made (none until a sound or a gesture needs one). */
function FakeAudioContextCount(): number {
  const ctor = (window as unknown as { AudioContext: { made: unknown[] } }).AudioContext
  return ctor.made.length
}

const RECT = { left: 20, top: 200, width: 240, height: 40, bottom: 240, right: 260, x: 20, y: 200, toJSON: () => ({}) } as DOMRect

describe('rewards on', () => {
  beforeEach(() => {
    store().setSettings({ rewards: true, sounds: true })
    // jsdom lays nothing out: give every element a place on the screen.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(RECT)
  })

  it('“+10” rises from the kept line, the goal met sparkles and throws confetti', { timeout: PAGE_TIMEOUT }, async () => {
    installMotion(false)
    // 50 XP this morning: one more line meets the goal of 60.
    useStore.setState({ events: [0, 1, 2, 3, 4].map((i) => line('earlier', i, dayAt(0, 0) + i)) })
    render(<Harness />)
    startAttempt()
    act(() => {
      store().acceptStep({ text: 'x < 3' })
    })
    await moment()
    expect(cues()).toEqual(['right', 'sparkle'])
    const floats = document.querySelector('[data-xp-floats]')!
    expect(floats.getAttribute('aria-hidden')).toBe('true')
    expect(within(floats as HTMLElement).getByText('+10')).toBeTruthy()
    const confetti = document.querySelector('[data-confetti]')!
    expect(confetti.getAttribute('aria-hidden')).toBe('true')
    expect(confetti.querySelectorAll('.confetti-bit').length).toBeGreaterThan(20)
    // The kept line flashed, and its check popped.
    const row = document.querySelector('[data-kept-step="0"]')!
    expect(row.className).toContain('juice-kept')
    expect(row.querySelector('.juice-pop')).toBeTruthy()
  })

  it('a part’s “+10” rises from the box she checked; two boxes checked together rise one after the other', { timeout: PAGE_TIMEOUT }, async () => {
    installMotion(false)
    render(
      <>
        <Harness />
        <input aria-label="Answer" />
      </>,
    )
    startAttempt()
    screen.getByRole('textbox', { name: 'Answer' }).focus()
    act(() => {
      store().recordFinalAnswer({ correct: true, via: 'text', part: 'Interval notation' })
      store().recordFinalAnswer({ correct: true, via: 'text', part: 'Set-builder notation' })
    })
    await moment()
    const floats = [...document.querySelectorAll<HTMLElement>('[data-xp-floats] .xp-float')]
    expect(floats.map((f) => f.textContent)).toEqual(['+10', '+10'])
    // The middle of the box's top edge (jsdom's boxes are the test's: 240 wide at x 20, top 200).
    expect(floats[0]!.style.left).toBe('140px')
    expect(floats[0]!.style.top).toBe('200px')
    expect(floats[1]!.style.animationDelay).toBe('160ms')
  })

  it('a squashed mistake pops after the arpeggio', { timeout: PAGE_TIMEOUT }, async () => {
    useStore.setState({
      events: [
        { t: 'step_rejected', at: dayAt(-3), attemptId: 'c', skill: SKILL, stepIdx: 0, pattern: 'no_sign_flip' },
        done('t1', dayAt(-3, 12)),
        done('t2', dayAt(-2)),
      ],
    })
    render(<Harness />)
    act(() => useStore.setState((s) => ({ events: [...s.events, done('t3', Date.now(), { mode: 'normal' })] })))
    await moment()
    // +20 finish, +10 no hints, +50 squashed: 80 XP, today's goal met too.
    expect(cues()).toEqual(['finish', 'pop', 'sparkle'])
  })

  it('under reduced motion: no floats, no confetti, no flash, but the sounds still play', { timeout: PAGE_TIMEOUT }, async () => {
    installMotion(true)
    useStore.setState({ events: [0, 1, 2, 3, 4].map((i) => line('earlier', i, dayAt(0, 0) + i)) })
    render(<Harness />)
    startAttempt()
    act(() => {
      store().acceptStep({ text: 'x < 3' })
    })
    await moment()
    expect(cues()).toEqual(['right', 'sparkle'])
    expect(document.querySelector('[data-xp-floats]')).toBeNull()
    expect(document.querySelector('[data-confetti]')).toBeNull()
    expect(document.querySelector('[data-kept-step="0"]')!.className).not.toContain('juice-kept')
  })

  it('rewards off: no floats and no goal, only the sound', { timeout: PAGE_TIMEOUT }, async () => {
    installMotion(false)
    store().setSettings({ rewards: false })
    useStore.setState({ events: [0, 1, 2, 3, 4].map((i) => line('earlier', i, dayAt(0, 0) + i)) })
    render(<Harness />)
    startAttempt()
    act(() => {
      store().acceptStep({ text: 'x < 3' })
    })
    await moment()
    expect(cues()).toEqual(['right'])
    expect(document.querySelector('[data-xp-floats]')).toBeNull()
    expect(document.querySelector('[data-confetti]')).toBeNull()
  })
})

describe('streak milestones', () => {
  beforeEach(() => {
    store().setSettings({ rewards: true, sounds: true })
  })

  const banner = (days: number) => screen.queryByRole('region', { name: `${days}-day streak!` })
  /** Today's goal met now: two problems she just finished. */
  const meetTodayNow = () =>
    act(() => useStore.setState((s) => ({ events: [...s.events, done('today-a', Date.now() - 2), done('today-b', Date.now() - 1)] })))

  it('the first time she reaches 7 days: the banner, confetti and the sparkle, remembered so it never repeats', { timeout: PAGE_TIMEOUT }, async () => {
    installMotion(false)
    useStore.setState({ events: metDays(6) })
    render(<Harness />)
    expect(banner(7)).toBeNull()
    await meetTodayNow()
    await moment()
    const shown = banner(7)!
    expect(shown).toBeTruthy()
    expect(within(shown).getByText('A whole week of goals met. Keep it going!')).toBeTruthy()
    expect(shown.closest('[role="status"]')).toBeTruthy()
    expect(store().rewards.milestones).toEqual([7])
    expect(cues()).toEqual(['finish', 'sparkle'])
    expect(document.querySelectorAll('[data-confetti] .confetti-bit').length).toBeGreaterThan(20)
    fireEvent.click(within(shown).getByRole('button', { name: 'Close' }))
    expect(banner(7)).toBeNull()

    // The streak broke and she built it back to 7: no second celebration.
    act(() => useStore.setState({ events: metDays(6) }))
    await moment()
    await meetTodayNow()
    await moment()
    expect(banner(7)).toBeNull()
    expect(store().rewards.milestones).toEqual([7])
  })

  it('30 days, with 7 celebrated before: the 30-day banner; a streak already past a milestone celebrates nothing', { timeout: PAGE_TIMEOUT }, async () => {
    useStore.setState({ events: metDays(29), rewards: { ...emptyRewards(), milestones: [7] } })
    render(<Harness />)
    await meetTodayNow()
    await moment()
    expect(banner(30)).toBeTruthy()
    expect(within(banner(30)!).getByText('A whole month of goals met. That is a real habit.')).toBeTruthy()
    expect(store().rewards.milestones).toEqual([7, 30])
    // Reduced motion (no matchMedia here): the banner and the sound, no confetti.
    expect(document.querySelector('[data-confetti]')).toBeNull()
    expect(cues()).toContain('sparkle')
  })

  it('an existing streak past 7 (or one brought in by an import) is not a new milestone', { timeout: PAGE_TIMEOUT }, async () => {
    useStore.setState({ events: metDays(9) })
    render(<Harness />)
    await meetTodayNow()
    await moment()
    expect(banner(7)).toBeNull()
    expect(store().rewards.milestones).toBeUndefined()
  })
})

describe('counting the XP up', () => {
  it('counts from 0 to the total; what is read out is the total all along', { timeout: PAGE_TIMEOUT }, async () => {
    installMotion(false)
    render(
      <p data-testid="xp">
        <CountUp value={45} prefix="+" suffix=" XP" />
      </p>,
    )
    const counting = document.querySelector('[data-counting]')!
    expect(counting.getAttribute('aria-hidden')).toBe('true')
    expect(counting.textContent).toBe('+0 XP')
    expect(screen.getByText('+45 XP').className).toContain('sr-only')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1300))
    })
    expect(document.querySelector('[data-counting]')).toBeNull()
    expect(screen.getByTestId('xp').textContent).toBe('+45 XP')
  })

  it('under reduced motion it is the total at once', { timeout: PAGE_TIMEOUT }, () => {
    installMotion(true)
    render(
      <p data-testid="xp">
        <CountUp value={45} prefix="+" suffix=" XP" />
      </p>,
    )
    expect(document.querySelector('[data-counting]')).toBeNull()
    expect(screen.getByTestId('xp').textContent).toBe('+45 XP')
  })
})

describe('a kept line', () => {
  const step = (idx: number, revealed = false): AttemptStep => ({ idx, text: `x < ${idx + 3}`, accepted: true, firstTry: !revealed, revealed, property: 'skipped' })

  function Column({ initial }: { initial: AttemptStep[] }) {
    const [steps, setSteps] = useState(initial)
    return (
      <>
        <button type="button" onClick={() => setSteps((s) => [...s, step(s.length)])}>
          keep
        </button>
        <button type="button" onClick={() => setSteps((s) => [...s, step(s.length, true)])}>
          show
        </button>
        <button type="button" onClick={() => setSteps((s) => [...s, step(s.length), step(s.length + 1)])}>
          restore
        </button>
        <WorkedColumn start="x + 2 < 5" steps={steps} />
      </>
    )
  }

  const row = (idx: number) => document.querySelector(`[data-kept-step="${idx}"]`)!

  it('flashes green and pops its check once when she keeps it; not a line restored, not a line the hint showed', { timeout: PAGE_TIMEOUT }, () => {
    installMotion(false)
    render(<Column initial={[step(0)]} />)
    expect(row(0).className).not.toContain('juice-kept')
    fireEvent.click(screen.getByRole('button', { name: 'keep' }))
    expect(row(1).className).toContain('juice-kept')
    expect(row(1).querySelector('.juice-pop')?.textContent).toBe('✓')
    fireEvent.click(screen.getByRole('button', { name: 'show' }))
    expect(row(2).className).not.toContain('juice-kept')
    fireEvent.click(screen.getByRole('button', { name: 'restore' }))
    expect(row(3).className).not.toContain('juice-kept')
    expect(row(4).className).not.toContain('juice-kept')
    // Still a numbered line with its check and the word.
    expect(row(1).textContent).toContain('accepted')
  })

  it('does not move under reduced motion', { timeout: PAGE_TIMEOUT }, () => {
    installMotion(true)
    render(<Column initial={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'keep' }))
    expect(row(0).className).not.toContain('juice-kept')
    expect(row(0).querySelector('.juice-pop')).toBeNull()
  })
})

describe('the streak flame', () => {
  it('none without a streak, then three sizes: 1-6, 7-29, 30 or more days', { timeout: PAGE_TIMEOUT }, () => {
    expect([0, 1, 6, 7, 29, 30, 365].map(flameSize)).toEqual(['none', 'small', 'small', 'medium', 'medium', 'large', 'large'])
    const { container } = render(<StreakFlame days={0} lit={false} day="2026-10-21" />)
    expect(container.innerHTML).toBe('')
  })

  it('dim until today’s goal is met, then lit with one flare a day (none under reduced motion)', { timeout: PAGE_TIMEOUT }, () => {
    installMotion(false)
    const { container, rerender } = render(<StreakFlame days={8} lit={false} day="2026-10-21" />)
    const flame = () => container.querySelector('[data-flame-size]')!
    expect(flame().getAttribute('data-flame-size')).toBe('medium')
    expect(flame().getAttribute('data-flame-lit')).toBe('false')
    expect(flame().className).not.toContain('flame-flare')
    rerender(<StreakFlame days={9} lit day="2026-10-21" />)
    expect(flame().getAttribute('data-flame-lit')).toBe('true')
    expect(flame().className).toContain('flame-flare')
    // Seen again the same day: lit, no second flare.
    const again = render(<StreakFlame days={9} lit day="2026-10-21" />)
    expect(again.container.querySelector('[data-flame-size]')!.className).not.toContain('flame-flare')
    installMotion(true)
    const reduced = render(<StreakFlame days={40} lit day="2026-10-22" />)
    expect(reduced.container.querySelector('[data-flame-size]')!.getAttribute('data-flame-size')).toBe('large')
    expect(reduced.container.querySelector('[data-flame-size]')!.className).not.toContain('flame-flare')
  })

  it('sits beside the streak on the Today card', { timeout: PAGE_TIMEOUT }, () => {
    store().setSettings({ rewards: true })
    const events: Ev[] = []
    for (let d = -3; d <= 0; d++) events.push(done(`w${d}a`, dayAt(d)), done(`w${d}b`, dayAt(d, 10)))
    useStore.setState({ events })
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </MemoryRouter>,
    )
    const today = screen.getByRole('region', { name: 'Today' })
    const streak = within(today).getByText(/^4-day streak · \d of 7 this week$/)
    const flame = streak.querySelector('[data-flame-size]')!
    expect(flame.getAttribute('data-flame-size')).toBe('small')
    expect(flame.getAttribute('data-flame-lit')).toBe('true')
    expect(flame.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('the Sounds switch in Settings', () => {
  function renderSettings() {
    return render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )
  }

  it('is off in the family web app; on, it plays a taste of the chime; it works with rewards off', { timeout: PAGE_TIMEOUT }, () => {
    renderSettings()
    const sw = screen.getByRole('switch', { name: 'Sounds' })
    expect(sw.getAttribute('aria-checked')).toBe('false')
    expect(screen.getByRole('switch', { name: 'Rewards (XP, daily goal, streak)' }).getAttribute('aria-checked')).toBe('false')
    fireEvent.click(sw)
    expect(store().settings.sounds).toBe(true)
    expect(cues()).toEqual(['right'])
    fireEvent.click(sw)
    expect(store().settings.sounds).toBe(false)
  })

  it('is not offered where the browser has no Web Audio', { timeout: PAGE_TIMEOUT }, () => {
    removeAudio()
    renderSettings()
    expect(screen.queryByRole('switch', { name: 'Sounds' })).toBeNull()
  })
})
