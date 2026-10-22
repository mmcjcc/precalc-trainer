// @vitest-environment jsdom
/**
 * The Monsters tab (pages/Monsters.tsx): the tally, the species with their monsters (caught in colour with how many
 * times and the squash pips, squashed in a gold frame, not seen as a dark outline), a rare monster's sparkle frame,
 * a monster's card (keyboard reachable, focus kept inside, Escape closes it and focus goes back), "Practice this",
 * XP only with rewards on; the four tabs, and the drill still reachable from Unit 1 and from Progress.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '@/App'
import { installMotion, removeMotion } from '@/components/juice/audioTesting'
import { installPointer, removePointer } from '@/components/keypadTesting'
import { SPECIES } from '@/components/monsters/species'
import { getTemplate } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import { resetStoreForTests, useStore, type Ev } from '@/store'
import { ModulePage } from './Module'
import { MonstersPage } from './Monsters'
import { ProgressPage } from './Progress'

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

const PAGE_TIMEOUT = 120_000
const LAZY = { timeout: 120_000 }
const LINEAR = getTemplate('inequalities', 'ineq.linear').title

/** Local time `offset` days from today, at `hour`. */
function dayAt(offset: number, hour = 9): number {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, hour).getTime()
}

function rejected(attemptId: string, skill: string, at: number, pattern: string): Ev {
  return { t: 'step_rejected', at, attemptId, skill, stepIdx: 0, pattern }
}

function done(attemptId: string, skill: string, at: number): Ev {
  return { t: 'problem_done', at, attemptId, skill, moduleId: 'inequalities', steps: 2, firstTryRate: 1, hints: 0, revealed: 0, finalCorrect: true, mode: 'normal', secs: 60 }
}

/** Squashed: flip_on_add. On the loose: no_sign_flip (three times, 1 of 3), cbrt_sign_dropped (rare), endpoint_type. */
function seed() {
  useStore.setState({
    events: [
      rejected('a', 'ineq.linear', dayAt(-9), 'flip_on_add'),
      done('a2', 'ineq.linear', dayAt(-8)),
      done('a3', 'ineq.linear', dayAt(-7)),
      done('a4', 'ineq.linear', dayAt(-6)),
      rejected('b', 'ineq.linear', dayAt(-5), 'no_sign_flip'),
      rejected('b', 'ineq.linear', dayAt(-5, 10), 'no_sign_flip'),
      rejected('c', 'ineq.linear', dayAt(-3), 'no_sign_flip'),
      done('c', 'ineq.linear', dayAt(-3, 10)),
      done('d', 'ineq.linear', dayAt(-2, 10)),
      rejected('e', 'inv.cbrt-shift', dayAt(-2), 'cbrt_sign_dropped'),
      { t: 'final_answer', at: dayAt(-1), attemptId: 'f', skill: 'nl.read', correct: false, pattern: 'endpoint_type', via: 'text' },
    ],
  })
}

function LocationProbe() {
  const { pathname } = useLocation()
  return <p data-testid="where">{pathname}</p>
}

function renderMonsters() {
  return render(
    <MemoryRouter initialEntries={['/monsters']}>
      <Routes>
        <Route path="/monsters" element={<MonstersPage />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

const section = (name: string) => screen.getByRole('region', { name: new RegExp(`^${name}`) })
const tile = (id: string) => document.querySelector<HTMLElement>(`[data-monster-tile="${id}"]`)!

beforeAll(async () => {
  await import('./Monsters')
  await import('./Drill')
}, 120_000)

beforeEach(() => {
  resetStoreForTests()
  localStorage.clear()
})

afterEach(() => {
  removePointer()
  removeMotion()
})

describe('the collection', () => {
  it('none caught yet: the tally, every species one closed line with its outline in the dark', { timeout: PAGE_TIMEOUT }, () => {
    renderMonsters()
    expect(screen.getByRole('heading', { level: 1, name: 'Monsters' })).toBeTruthy()
    expect(document.querySelector('[data-monster-tally]')!.textContent).toBe('0 squashed · 0 on the loose')
    expect(screen.getByText(/None caught yet\. The first time the checker names one of your mistakes/)).toBeTruthy()
    // The family app: every species, math and chemistry.
    const sections = document.querySelectorAll('[data-species]')
    expect(sections).toHaveLength(SPECIES.length)
    expect([...document.querySelectorAll('details')].every((d) => !d.open)).toBe(true)
    for (const s of sections) expect(s.querySelector('summary svg[data-silhouette]')).toBeTruthy()
    // A closed species draws no tiles (a phone would draw hundreds of pictures for nothing).
    expect(document.querySelectorAll('[data-monster-tile]')).toHaveLength(0)
    expect(screen.queryAllByRole('button', { name: /Caught|Squashed/ })).toEqual([])
    // Opened, its monsters are there, every one a silhouette.
    const log = section('Log Splitter').querySelector('details')!
    act(() => {
      log.open = true
      log.dispatchEvent(new Event('toggle'))
    })
    expect(section('Log Splitter').querySelectorAll('[data-monster-tile][data-status="unseen"]')).toHaveLength(SPECIES.find((s) => s.id === 'log')!.variants.length)
    expect(within(section('Log Splitter')).getByText(`${SPECIES.find((s) => s.id === 'log')!.variants.length} more not caught yet`)).toBeTruthy()
  })

  it('caught, squashed and not seen, from her log: "1 squashed · 3 on the loose"', { timeout: PAGE_TIMEOUT }, () => {
    seed()
    renderMonsters()
    expect(document.querySelector('[data-monster-tally]')!.textContent).toBe('1 squashed · 3 on the loose')
    const sign = section('The Sign Flipper')
    expect(sign.querySelector('details')!.open).toBe(true)
    expect(within(sign).getByText('1 squashed · 2 on the loose')).toBeTruthy()
    // A species she has not met stays closed, its outline dark.
    expect(section('Log Splitter').querySelector('details')!.open).toBe(false)
    expect(within(section('Log Splitter')).getByText('None caught yet')).toBeTruthy()

    // Caught three times, one clean problem since: in colour, ×3 and one pip.
    const caught = within(sign).getByRole('button', { name: `The Sign Flipper: ${ERROR_PATTERNS.no_sign_flip.title}. Caught 3 times, 1 of 3 clean problems to squash it.` })
    expect(caught.querySelector('svg[data-monster="no_sign_flip"]')).toBeTruthy()
    expect(caught.querySelector('[data-silhouette]')).toBeNull()
    expect(caught.querySelector('[data-pips]')!.getAttribute('data-pips')).toBe('1')
    expect(caught.textContent).toContain('×3')
    expect(tile('no_sign_flip').getAttribute('data-status')).toBe('caught')
    // Squashed: the gold frame and three pips.
    const squashed = within(sign).getByRole('button', { name: `The Sign Flipper: ${ERROR_PATTERNS.flip_on_add.title}. Squashed. Caught once.` })
    expect(squashed.className).toContain('border-gold')
    expect(squashed.querySelector('[data-pips]')!.getAttribute('data-pips')).toBe('3')
    // Not seen: a dark outline with a "?", hidden from a screen reader, which hears how many instead.
    const unseen = tile('flip_on_positive')
    expect(unseen.getAttribute('data-status')).toBe('unseen')
    expect(unseen.getAttribute('aria-hidden')).toBe('true')
    expect(unseen.querySelector('svg[data-silhouette]')).toBeTruthy()
    expect(within(sign).getByText(`${SPECIES[0]!.variants.length - 3} more not caught yet`)).toBeTruthy()
    // Bracket Gremlin: a wrong check names it too.
    expect(within(section('Bracket Gremlin')).getByText('0 squashed · 1 on the loose')).toBeTruthy()
  })

  it('a rare monster wears a sparkle frame, and says so', { timeout: PAGE_TIMEOUT }, () => {
    installMotion(false)
    seed()
    renderMonsters()
    const rare = within(section('The Sign Flipper')).getByRole('button', { name: /^Rare\. The Sign Flipper: / })
    expect(rare.closest('li')!.getAttribute('data-monster-tile')).toBe('cbrt_sign_dropped')
    expect(rare.className).toContain('monster-rare')
    expect(rare.querySelectorAll('.monster-twinkle')).toHaveLength(2)
    const plain = within(section('The Sign Flipper')).getByRole('button', { name: (n) => n.startsWith(`The Sign Flipper: ${ERROR_PATTERNS.no_sign_flip.title}`) })
    expect(plain.className).not.toContain('monster-rare')
  })

  it('reduced motion: the sparkles stand still', { timeout: PAGE_TIMEOUT }, () => {
    installMotion(true)
    seed()
    renderMonsters()
    const rare = within(section('The Sign Flipper')).getByRole('button', { name: /^Rare\. / })
    expect(rare.querySelectorAll('[aria-hidden]').length).toBeGreaterThan(0)
    expect(rare.querySelectorAll('.monster-twinkle')).toHaveLength(0)
  })
})

describe('a monster’s card', () => {
  it('its picture, name, lesson and example, where she last caught it, the pips, Practice this; keyboard and Escape', { timeout: PAGE_TIMEOUT }, () => {
    seed()
    renderMonsters()
    const opener = within(section('The Sign Flipper')).getByRole('button', { name: new RegExp(`: ${ERROR_PATTERNS.no_sign_flip.title}\\. Caught 3 times`) })
    opener.focus()
    fireEvent.click(opener)
    const card = screen.getByRole('dialog', { name: 'The Sign Flipper' })
    expect(card.getAttribute('aria-modal')).toBe('true')
    expect(card.querySelector('svg[data-monster="no_sign_flip"]')!.getAttribute('aria-hidden')).toBe('true')
    expect(card.textContent).toContain('On the loose')
    expect(card.textContent).toContain(ERROR_PATTERNS.no_sign_flip.title)
    expect(card.textContent).toContain(SPECIES[0]!.personality)
    expect(card.textContent).toContain(ERROR_PATTERNS.no_sign_flip.lesson)
    expect(card.textContent).toContain('Example:')
    expect(card.textContent).toContain('1 of 3 clean problems to squash it.')
    expect(card.textContent).toContain(`Caught 3 times. Last caught in ${LINEAR}, 3 days ago.`)
    // Rewards off (the family app's default): no XP.
    expect(card.textContent).not.toMatch(/XP/)
    // Focus is in the card and goes round it.
    expect(card.contains(document.activeElement)).toBe(true)
    const close = within(card).getByRole('button', { name: 'Close' })
    const practice = within(card).getByRole('button', { name: 'Practice this' })
    practice.focus()
    fireEvent.keyDown(practice, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(practice)
    // Escape closes it and gives focus back to the tile.
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('Practice this opens a problem of the type she caught it in', { timeout: PAGE_TIMEOUT }, () => {
    seed()
    renderMonsters()
    fireEvent.click(within(section('The Sign Flipper')).getByRole('button', { name: /^Rare\. / }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Practice this' }))
    expect(screen.getByTestId('where').textContent).toMatch(/^\/p\/inverses\/inv\.cbrt-shift\//)
  })

  it('a squashed monster’s card, with rewards on: gold, and XP mentioned where it pays', { timeout: PAGE_TIMEOUT }, () => {
    useStore.getState().setSettings({ rewards: true })
    seed()
    renderMonsters()
    fireEvent.click(within(section('The Sign Flipper')).getByRole('button', { name: /Squashed\. Caught once\.$/ }))
    const card = screen.getByRole('dialog', { name: 'The Sign Flipper' })
    expect(card.textContent).toContain('Squashed: 3 clean problems in a row.')
    expect(card.querySelector('.border-gold')).toBeTruthy()
    fireEvent.click(within(card).getByRole('button', { name: 'Close' }))
    fireEvent.click(within(section('The Sign Flipper')).getByRole('button', { name: /Caught 3 times/ }))
    expect(screen.getByRole('dialog').textContent).toContain('1 of 3 clean problems to squash it (+50 XP).')
  })

  it('a phone: the card is a bottom sheet, and a tap outside closes it', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    seed()
    renderMonsters()
    fireEvent.click(within(section('Bracket Gremlin')).getByRole('button', { name: /Caught once/ }))
    const host = document.querySelector<HTMLElement>('[data-monster-card]')!
    expect(host.className).toContain('items-end')
    fireEvent.click(host.firstElementChild!)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('getting there', () => {
  function renderAt(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <AppShell />
      </MemoryRouter>,
    )
  }

  it('the Monsters tab (a lazy page) on a phone, marked in the tab bar', { timeout: PAGE_TIMEOUT }, async () => {
    installPointer(true)
    window.scrollTo = () => {}
    renderAt('/monsters')
    expect(await screen.findByRole('heading', { level: 1, name: 'Monsters' }, LAZY)).toBeTruthy()
    const bar = document.querySelector<HTMLElement>('[data-tab-bar]')!
    expect(within(bar).getAllByRole('link').map((a) => a.textContent)).toEqual(['Home', 'Monsters', 'Graph', 'Progress', 'Settings'])
    expect(within(bar).getByRole('link', { name: 'Monsters' }).getAttribute('aria-current')).toBe('page')
  })

  it('the drill keeps its route: from Unit 1’s modules on Home (its module page), and from Progress', { timeout: PAGE_TIMEOUT }, async () => {
    useStore.getState().setSettings({ courseId: 'precalc', unitByCourse: { precalc: 'unit1' } })
    window.scrollTo = () => {}
    const view = renderAt('/')
    const modules = document.querySelector<HTMLElement>('[data-unit-modules]')!
    expect(within(modules).getByRole('link', { name: 'Properties drill' }).getAttribute('href')).toBe('/m/propertiesDrill')
    view.unmount()
    render(
      <MemoryRouter initialEntries={['/m/propertiesDrill']}>
        <Routes>
          <Route path="/m/:moduleId" element={<ModulePage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /Start the drill/ }).getAttribute('href')).toBe('/drill')
    render(
      <MemoryRouter>
        <ProgressPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Open the properties drill' }).getAttribute('href')).toBe('/drill')
    // And the route still opens the drill.
    const drill = renderAt('/drill')
    expect(await screen.findByRole('heading', { level: 1, name: 'Properties drill' }, LAZY)).toBeTruthy()
    drill.unmount()
  })

  it('Home’s mistakes to squash show their monsters and lead to the Monsters tab', { timeout: PAGE_TIMEOUT }, () => {
    useStore.getState().setSettings({ rewards: true, courseId: 'precalc' })
    seed()
    window.scrollTo = () => {}
    renderAt('/')
    const today = screen.getByRole('region', { name: 'Today' })
    const cards = within(within(today).getByRole('list', { name: 'Mistakes to squash' })).getAllByRole('listitem')
    for (const li of cards) expect(li.querySelector('svg[data-monster]')!.getAttribute('aria-hidden')).toBe('true')
    expect(cards[0]!.querySelector('svg[data-monster="no_sign_flip"]')).toBeTruthy()
    expect(within(today).getByRole('link', { name: 'The whole collection' }).getAttribute('href')).toBe('/monsters')
    act(() => {
      fireEvent.click(within(today).getByRole('link', { name: 'The whole collection' }))
    })
  })
})
