// @vitest-environment jsdom
/**
 * The daily quests and the chest on screen (components/quests): the quests row on Home's Today card, the chest (a
 * button, a short animation, one reward recorded at the tap; none of the animation under reduced motion), yesterday's
 * chest for one more day, "Quest done" on the finish sheet with its cue, the chest waiting for a set's results (after
 * the set's one break, which the store app fills with an ad), the colour themes in Settings, and rewards off.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem } from '@/content'
import { installFakeAudio, installMotion, removeMotion } from '@/components/juice/audioTesting'
import { onCuePlayed, resetSoundsForTests, type PlayedCue } from '@/components/juice/sounds'
import { MOMENT_MS, useJuice } from '@/components/juice/useJuice'
import { installPointer, removePointer } from '@/components/keypadTesting'
import { Home } from '@/pages/Home'
import ProblemPage from '@/pages/Problem'
import { SetPage } from '@/pages/SetPage'
import { SettingsPage } from '@/pages/Settings'
import { problemPath } from '@/problem/url'
import { saveActiveSet, type ActiveSet } from '@/session/activeSet'
import { registerSetEndBreak } from '@/session/breaks'
import { questSpecs, resetQuestCacheForTests, type QuestSpec } from '@/session/quests'
import { busyDay, cleanProblem, dayTime, openCardBefore, questInput } from '@/session/questTesting'
import { THEME_CHANCE, THEMES, addDays, chestRoll, dayKey, resetStoreForTests, useStore, type Ev } from '@/store'
import { CHEST_SHAKE_MS, rewardWords } from './Chest'
import { QuestNewsBlock, resetQuestCuesForTests } from './Quests'
import { ThemeRoot } from './theme'

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

const PAGE_TIMEOUT = 120_000
const store = () => useStore.getState()
const today = () => dayKey(Date.now())
let played: PlayedCue[] = []
let stopListening: () => void = () => {}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Home with the app shell's juice (the sounds follow the event log). */
function JuicyHome() {
  useJuice()
  return <Home />
}

/** Today's specs for a log, as the app reads them (Home's class is the log's). */
function specsFor(day: string, events: Ev[]): QuestSpec[] {
  return questSpecs(day, questInput(events))
}

/** A day (from 2026-11-02 on) whose quests, for this log before it, pass `pred`; the clock is put there, at 2 pm. */
function goToDayWhere(pred: (specs: QuestSpec[], day: string) => boolean, before: (day: string) => Ev[] = () => []): string {
  for (let i = 0; i < 400; i++) {
    const day = addDays('2026-11-02', i)
    if (pred(specsFor(day, before(day)), day)) {
      vi.setSystemTime(new Date(dayTime(day, 14)))
      return day
    }
  }
  throw new Error('no such day')
}

/** Today's log with every quest done (a monster from yesterday, squashed in today's clean set). */
function allDoneToday(): Ev[] {
  const day = today()
  const before = openCardBefore(day)
  return [...before, ...busyDay(day, specsFor(day, before))]
}

/** The number line answered right on the first check: the quickest finish. */
function finishNumberLine(seed: number) {
  const inst = generateProblem('numberLine', 'nl.read', seed, {})
  if (inst.answer.type !== 'set') throw new Error('expected a set answer')
  fireEvent.change(screen.getByLabelText('Interval notation'), { target: { value: inst.answer.interval } })
  fireEvent.change(screen.getByLabelText('Set-builder notation'), { target: { value: inst.answer.setBuilder } })
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
}

function handSet(seeds: number[]): ActiveSet {
  return {
    version: 1,
    id: 'set-quests',
    courseId: 'precalc',
    startedAt: Date.now(),
    timed: false,
    problems: seeds.map((seed) => ({ moduleId: 'numberLine', templateId: 'nl.read', seed, flags: '', pick: 'unit' as const })),
    index: 0,
    attemptIds: seeds.map(() => null),
    status: seeds.map(() => 'pending' as const),
  }
}

const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })

beforeEach(() => {
  resetStoreForTests()
  localStorage.clear()
  resetQuestCacheForTests()
  resetQuestCuesForTests()
  resetSoundsForTests()
  played = []
  stopListening = onCuePlayed((p) => played.push(p))
  window.scrollTo = () => {}
  document.documentElement.removeAttribute('style')
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  stopListening()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  removePointer()
  removeMotion()
})

describe('the quests row on Home', () => {
  it('rewards on: "Quests 0/3" and three short lines with their progress; all done, each is ticked and the chest appears', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    store().setSettings({ rewards: true })
    const { unmount } = renderHome()
    const todayCard = screen.getByRole('region', { name: 'Today' })
    const row = within(todayCard).getByRole('region', { name: 'Quests: 0 of 3 done' })
    const items = within(within(row).getByRole('list', { name: 'Today’s quests' })).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    for (const li of items) {
      expect(li.textContent).toMatch(/\d+ of \d+/)
      expect(li.hasAttribute('data-quest-done')).toBe(false)
      // The bar is decorative: the words say how far.
      expect(li.querySelector('[aria-hidden] > span[style]')).toBeTruthy()
    }
    expect(within(row).getByText('0/3')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /chest/ })).toBeNull()
    unmount()

    useStore.setState({ events: allDoneToday() })
    renderHome()
    const done = screen.getByRole('region', { name: 'Quests: 3 of 3 done' })
    const ticked = within(done).getAllByRole('listitem')
    expect(ticked.every((li) => li.hasAttribute('data-quest-done') && li.textContent!.includes(', done'))).toBe(true)
    const chest = within(done).getByRole('button', { name: 'Open today’s chest' })
    expect(chest.getAttribute('aria-describedby')).toBeTruthy()
    expect(chest.className).toContain('min-h-16')
    expect(chest.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
    // Still one primary action on a phone's Home: the chest is a gold card, not a filled navy button.
    expect(chest.className).not.toContain('bg-navy')
  })

  it('rewards off: no quests, no chest, no colour themes', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    useStore.setState({ events: [...allDoneToday(), { t: 'chest_opened', at: Date.now() - 86_400_000, day: addDays(today(), -1), reward: { kind: 'theme', theme: 'ocean' } }] })
    // The family app's default (no switch set): rewards off.
    const first = renderHome()
    expect(screen.queryByRole('region', { name: /^Quests/ })).toBeNull()
    first.unmount()
    store().setSettings({ rewards: false, theme: 'ocean' })
    renderHome()
    expect(screen.queryByRole('region', { name: /^Quests/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /chest/ })).toBeNull()
    render(
      <MemoryRouter>
        <ThemeRoot />
        <SettingsPage />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('group', { name: 'Colour theme' })).toBeNull()
    // Rewards off: navy, whatever she picked before.
    expect(document.documentElement.style.getPropertyValue('--color-navy')).toBe('')
  })
})

describe('the chest', () => {
  it('tap to open: recorded at the tap, a shake, the lid swings up and the reward rises out; the chest cue plays', { timeout: PAGE_TIMEOUT }, async () => {
    installMotion(false)
    installFakeAudio()
    store().setSettings({ rewards: true, sounds: true })
    useStore.setState({ events: allDoneToday() })
    render(
      <MemoryRouter>
        <JuicyHome />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open today’s chest' }))
    const ev = store().events.at(-1)!
    expect(ev.t).toBe('chest_opened')
    if (ev.t !== 'chest_opened') throw new Error('expected the chest')
    expect(ev.day).toBe(today())
    const card = document.querySelector<HTMLElement>(`[data-chest="${today()}"]`)!
    expect(card.getAttribute('data-chest-state')).toBe('shaking')
    expect(card.querySelector('.chest-shake')).toBeTruthy()
    const status = within(card).getByRole('status')
    expect(status.textContent).toContain('Opening')
    expect(document.activeElement).toBe(status)
    await wait(CHEST_SHAKE_MS + 60)
    // The chest's own sound, first (a bonus that meets the goal sparkles after it).
    expect(played[0]?.cue).toBe('chest')
    expect(MOMENT_MS).toBeLessThan(CHEST_SHAKE_MS)
    expect(card.getAttribute('data-chest-state')).toBe('open')
    expect(card.querySelector('.chest-lid-open')).toBeTruthy()
    expect(status.textContent).toContain(rewardWords(ev.reward))
    expect(status.textContent).toContain('Today’s chest:')
    // One chest a day: it is not offered again, here or on a fresh Home.
    expect(screen.queryByRole('button', { name: 'Open today’s chest' })).toBeNull()
    expect(store().openChest(today())).toBeNull()
  })

  it('reduced motion: the reward at once, standing still', { timeout: PAGE_TIMEOUT }, () => {
    installMotion(true)
    store().setSettings({ rewards: true })
    useStore.setState({ events: allDoneToday() })
    renderHome()
    const closed = document.querySelector<HTMLElement>('[data-chest]')!
    expect(closed.querySelector('.chest-wiggle')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open today’s chest' }))
    const card = document.querySelector<HTMLElement>(`[data-chest="${today()}"]`)!
    expect(card.getAttribute('data-chest-state')).toBe('open')
    expect(card.querySelector('.chest-shake, .chest-lid-open, .chest-reward-in')).toBeNull()
    expect(card.querySelector('.chest-lid-up')).toBeTruthy()
    const ev = store().events.at(-1)!
    if (ev.t !== 'chest_opened') throw new Error('expected the chest')
    expect(within(card).getByRole('status').textContent).toContain(rewardWords(ev.reward))
    // The quests' bars do not sweep either.
    expect(document.querySelector('.quest-bar-fill')).toBeNull()
  })

  it('a chest not opened by midnight waits the next day only, as yesterday’s', { timeout: PAGE_TIMEOUT }, () => {
    store().setSettings({ rewards: true })
    const yesterday = addDays(today(), -1)
    const before = openCardBefore(yesterday)
    useStore.setState({ events: [...before, ...busyDay(yesterday, specsFor(yesterday, before))] })
    renderHome()
    const chest = screen.getByRole('button', { name: 'Open yesterday’s chest' })
    expect(document.getElementById(chest.getAttribute('aria-describedby')!)!.textContent).toContain('today only')
    fireEvent.click(chest)
    const ev = store().events.at(-1)!
    expect(ev).toMatchObject({ t: 'chest_opened', day: yesterday })
  })

  it('a theme from the chest: "Use it now" puts it on the root element; Settings lists it, Navy is always there', { timeout: PAGE_TIMEOUT }, () => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    // A day whose chest is a theme.
    const day = goToDayWhere((_, d) => chestRoll(d) < THEME_CHANCE)
    installMotion(true)
    store().setSettings({ rewards: true })
    useStore.setState({ events: allDoneToday() })
    render(
      <MemoryRouter>
        <ThemeRoot />
        <Home />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open today’s chest' }))
    const ev = store().events.at(-1)!
    expect(ev).toMatchObject({ t: 'chest_opened', day, reward: { kind: 'theme' } })
    if (ev.t !== 'chest_opened' || ev.reward.kind !== 'theme') throw new Error('expected a theme')
    const theme = THEMES[ev.reward.theme]
    expect(screen.getByRole('status').textContent).toContain(`A new colour theme: ${theme.name}`)
    expect(document.documentElement.style.getPropertyValue('--color-navy')).toBe('')
    fireEvent.click(screen.getByRole('button', { name: `Use ${theme.name} now` }))
    expect(store().settings.theme).toBe(theme.id)
    const root = document.documentElement
    expect(root.style.getPropertyValue('--color-navy')).toBe(theme.tokens.navy)
    expect(root.style.getPropertyValue('--color-navy-800')).toBe(theme.tokens['navy-800'])
    expect(root.getAttribute('data-theme')).toBe(theme.id)
  })
})

describe('reduced motion and the quest news', () => {
  it('"Quest done" stands still; the bars do not sweep; the words are all there', () => {
    installMotion(true)
    const quest = { kind: 'problems' as const, target: 3, count: 3, done: true }
    const moving = { kind: 'firstTry' as const, target: 8, count: 6, done: false }
    const today = { day: '2026-10-22', quests: [quest, moving, { kind: 'xp' as const, target: 60, count: 20, done: false }], done: 1, allDone: false }
    render(
      <MemoryRouter>
        <QuestNewsBlock
          moves={[
            { quest, before: 2, newlyDone: true },
            { quest: moving, before: 4, newlyDone: false },
          ]}
          today={today}
          chests={[]}
          momentKey="reduced"
          cueDelay={1}
          chestHere
        />
      </MemoryRouter>,
    )
    const list = screen.getByRole('list', { name: 'Quests moved' })
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['✓Quest done: Finish 3 problems', 'Get 8 lines or parts right first try6 of 8'])
    expect(document.querySelector('.quest-done-pop, .quest-bar-fill')).toBeNull()
    expect(screen.getByRole('region', { name: 'Quests: 1 of 3 done' })).toBeTruthy()
  })
})

describe('the colour themes in Settings', () => {
  it('lists Navy and the themes she owns; picking one changes the root tokens; a theme she does not own never applies', { timeout: PAGE_TIMEOUT }, () => {
    store().setSettings({ rewards: true, theme: 'plum' })
    useStore.setState({ events: [{ t: 'chest_opened', at: Date.now() - 1000, day: today(), reward: { kind: 'theme', theme: 'ocean' } }] })
    render(
      <MemoryRouter>
        <ThemeRoot />
        <SettingsPage />
      </MemoryRouter>,
    )
    // Plum was never won: navy applies, and Navy is the one checked.
    expect(document.documentElement.style.getPropertyValue('--color-navy')).toBe('')
    const group = screen.getByRole('group', { name: 'Colour theme' })
    const options = within(group).getAllByRole('radio')
    expect(options.map((o) => (o as HTMLInputElement).value)).toEqual(['navy', 'ocean'])
    expect((within(group).getByRole('radio', { name: 'Navy' }) as HTMLInputElement).checked).toBe(true)
    expect(group.textContent).toContain('2 more to find')
    fireEvent.click(within(group).getByRole('radio', { name: 'Ocean' }))
    expect(store().settings.theme).toBe('ocean')
    expect(document.documentElement.style.getPropertyValue('--color-navy')).toBe(THEMES.ocean.tokens.navy)
    expect(document.documentElement.style.getPropertyValue('--color-navy-50')).toBe(THEMES.ocean.tokens['navy-50'])
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? THEMES.ocean.tokens.navy).toBe(THEMES.ocean.tokens.navy)
    fireEvent.click(within(group).getByRole('radio', { name: 'Navy' }))
    expect(document.documentElement.style.getPropertyValue('--color-navy')).toBe('')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
})

describe('quests on the finish sheet and the set results', () => {
  it('a problem that finishes a quest: "Quest done" on the finish sheet, the tick pops, the quest cue after the arpeggio', { timeout: PAGE_TIMEOUT }, async () => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    const day = goToDayWhere((specs) => specs.some((s) => s.kind === 'problems'))
    installPointer(true)
    installFakeAudio()
    store().setSettings({ rewards: true, sounds: true })
    // Two problems finished earlier today: the number line is the third.
    useStore.setState({ events: [...cleanProblem('e1', dayTime(day, 9), 1), ...cleanProblem('e2', dayTime(day, 10), 1)] })
    render(
      <MemoryRouter initialEntries={[problemPath('numberLine', 'nl.read', 4242)]}>
        <Routes>
          <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
        </Routes>
      </MemoryRouter>,
    )
    finishNumberLine(4242)
    const sheet = screen.getByRole('dialog', { name: 'Problem complete' })
    const news = within(sheet).getByRole('list', { name: 'Quests moved' })
    const doneLine = within(news).getByText((_, el) => el?.getAttribute('data-quest-move') === 'problems')
    expect(doneLine.textContent).toContain('Quest done: Finish 3 problems')
    expect(doneLine.querySelector('.quest-done-pop')).toBeTruthy()
    await wait(80)
    const quest = played.find((p) => p.cue === 'quest')
    expect(quest).toBeTruthy()
    expect(quest!.delay).toBeGreaterThan(0.8)
    expect(played.map((p) => p.cue).indexOf('finish')).toBeLessThan(played.map((p) => p.cue).indexOf('quest'))
  })

  it('a set: the break runs before the results, the set’s end is logged after it, and the chest is opened on the results', { timeout: PAGE_TIMEOUT }, () => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    const day = goToDayWhere((specs) => specs.some((s) => s.kind === 'noHintSet'))
    const specs = specsFor(day, [])
    installPointer(true)
    store().setSettings({ rewards: true })
    // The other two quests done earlier today (four clean problems, the path's stop, her own problem): the set is the third.
    const early: Ev[] = []
    for (let i = 0; i < 4; i++) early.push(...cleanProblem(`e${i}`, dayTime(day, 8, i * 5), 3))
    const path = specs.find((s) => s.kind === 'pathStop')?.skill
    if (path) early.push(...cleanProblem('ep', dayTime(day, 9), 1, { skill: path }))
    early.push(...cleanProblem('eo', dayTime(day, 9, 30), 1, { own: true }))
    useStore.setState({ events: early })
    expect(early.some((e) => e.t === 'set_done')).toBe(false)

    const seen: { setDone: boolean; chest: boolean; chestOnScreen: boolean }[] = []
    const unregister = registerSetEndBreak((go) => {
      // The ad's moment: no results, no chest anywhere yet.
      const evs = store().events
      seen.push({ setDone: evs.some((e) => e.t === 'set_done'), chest: evs.some((e) => e.t === 'chest_opened'), chestOnScreen: document.querySelector('[data-chest]') !== null })
      go()
    })
    try {
      saveActiveSet(handSet([501, 502, 503]))
      render(
        <MemoryRouter initialEntries={['/set']}>
          <Routes>
            <Route path="/set" element={<SetPage />} />
            <Route path="/" element={<p>Home</p>} />
          </Routes>
        </MemoryRouter>,
      )
      for (const [i, seed] of [501, 502, 503].entries()) {
        finishNumberLine(seed)
        const sheet = screen.getByRole('dialog', { name: 'Problem complete' })
        // Inside the set, no chest on the finish sheet.
        expect(within(sheet).queryByRole('button', { name: /chest/ })).toBeNull()
        fireEvent.click(within(sheet).getByRole('button', { name: i < 2 ? 'Next in set' : 'See results' }))
      }
      expect(seen).toEqual([{ setDone: false, chest: false, chestOnScreen: false }])
      expect(screen.getByRole('heading', { level: 1, name: 'Set done' })).toBeTruthy()
      const setDone = store().events.find((e) => e.t === 'set_done')
      expect(setDone).toMatchObject({ setId: 'set-quests', skipped: 0 })
      const news = screen.getByRole('list', { name: 'Quests moved' })
      expect(news.textContent).toContain('Quest done: Finish a set with no hints')
      fireEvent.click(screen.getByRole('button', { name: 'Open today’s chest' }))
      const evs = store().events
      expect(evs.at(-1)).toMatchObject({ t: 'chest_opened', day })
      expect(evs.findIndex((e) => e.t === 'set_done')).toBeLessThan(evs.length - 1)
    } finally {
      unregister()
    }
  })

  it('inside a set, a chest earned mid-set waits for the results: a line says so, no button', { timeout: PAGE_TIMEOUT }, () => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    // A day with "Finish 3 problems" and no set quest: the set's first problem finishes the day's last quest.
    const day = goToDayWhere((specs) => specs.some((s) => s.kind === 'problems') && !specs.some((s) => s.kind === 'noHintSet' || s.kind === 'perfectSet'))
    const specs = specsFor(day, [])
    installPointer(true)
    store().setSettings({ rewards: true })
    // Two problems earlier today, four clean lines each, that do the other two quests (her own one when it asks for
    // homework, the path's stop when it asks for that; either way a type she has not mastered).
    const own = specs.some((q) => q.kind === 'own')
    const path = specs.find((q) => q.kind === 'pathStop')?.skill
    useStore.setState({
      events: [...cleanProblem('e1', dayTime(day, 8), 4, { own }), ...cleanProblem('e2', dayTime(day, 9), 4, path ? { skill: path } : {})],
    })
    saveActiveSet(handSet([601, 602, 603]))
    render(
      <MemoryRouter initialEntries={['/set']}>
        <Routes>
          <Route path="/set" element={<SetPage />} />
        </Routes>
      </MemoryRouter>,
    )
    finishNumberLine(601)
    const sheet = screen.getByRole('dialog', { name: 'Problem complete' })
    expect(within(sheet).getByRole('list', { name: 'Quests moved' }).textContent).toContain('Quest done: Finish 3 problems')
    expect(within(sheet).getByRole('region', { name: 'Quests: 3 of 3 done' })).toBeTruthy()
    const waits = sheet.querySelector('[data-chest-waits]')
    expect(waits?.textContent).toContain('open it on your set’s results')
    expect(within(sheet).queryByRole('button', { name: /chest/ })).toBeNull()
  })
})
