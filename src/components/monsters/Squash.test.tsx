// @vitest-environment jsdom
/**
 * The squash (SquashMoment.tsx): when three clean problems squash a mistake (the rewards decide), the finish sheet shows
 * its monster squashed: a splat, the card turning gold, and the existing pop. Reduced motion: no splat, gold and flat
 * from the start. Rewards off: the completion card shows it too, with no XP.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeAudio } from '@/components/juice/audioTesting'
import { onCuePlayed, resetSoundsForTests, type PlayedCue } from '@/components/juice/sounds'
import { MOMENT_MS, useJuice } from '@/components/juice/useJuice'
import { installPointer, removePointer } from '@/components/keypadTesting'
import { generateProblem } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import ProblemPage from '@/pages/Problem'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore, type Ev } from '@/store'

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

class GoneObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    const rect = { top: -400, bottom: -100 }
    this.callback([{ target, isIntersecting: false, boundingClientRect: rect } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
  disconnect() {}
  unobserve() {}
}

const PAGE_TIMEOUT = 120_000

function dayAt(offset: number, hour = 9): number {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, hour).getTime()
}

function done(attemptId: string, at: number): Ev {
  return { t: 'problem_done', at, attemptId, skill: 'nl.read', moduleId: 'numberLine', steps: 0, firstTryRate: 1, hints: 0, revealed: 0, finalCorrect: true, mode: 'timed', secs: 60 }
}

/** Caught on the number line, then two clean problems of it: the next finish squashes it. */
function twoOfThree() {
  useStore.setState({
    events: [{ t: 'step_rejected', at: dayAt(-3), attemptId: 'c', skill: 'nl.read', stepIdx: 0, pattern: 'no_sign_flip' }, done('t1', dayAt(-2)), done('t2', dayAt(-1))],
  })
}

function JuiceOnly() {
  useJuice()
  return null
}

function finishNumberLine() {
  const inst = generateProblem('numberLine', 'nl.read', 12345, {})
  if (inst.answer.type !== 'set') throw new Error('expected a set answer')
  render(
    <MemoryRouter initialEntries={[problemPath('numberLine', 'nl.read', 12345)]}>
      <JuiceOnly />
      <Routes>
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.change(screen.getByLabelText('Interval notation'), { target: { value: inst.answer.interval } })
  fireEvent.change(screen.getByLabelText('Set-builder notation'), { target: { value: inst.answer.setBuilder } })
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
}

/** A phone that asks for reduced motion. */
function installReducedPhone() {
  window.matchMedia = ((query: string) =>
    ({
      matches: /pointer:\s*coarse/.test(query) || /prefers-reduced-motion:\s*reduce/.test(query),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia
}

let played: PlayedCue[] = []
let stop: () => void = () => {}

beforeEach(() => {
  resetStoreForTests()
  localStorage.clear()
  resetSoundsForTests()
  played = []
  stop = onCuePlayed((p) => played.push(p))
  installFakeAudio()
  vi.stubGlobal('IntersectionObserver', GoneObserver)
})

afterEach(() => {
  stop()
  vi.unstubAllGlobals()
  removePointer()
  resetSoundsForTests()
})

const squash = () => document.querySelector<HTMLElement>('[data-squash-moment]')

describe('the squash on the finish sheet', () => {
  it('a phone with rewards on: the monster splats, its card turns gold, beside its +50 line; the pop plays', { timeout: PAGE_TIMEOUT }, async () => {
    installPointer(true)
    useStore.getState().setSettings({ rewards: true, sounds: true })
    twoOfThree()
    finishNumberLine()
    const sheet = screen.getByRole('dialog', { name: 'Problem complete' })
    expect(within(sheet).getByRole('list', { name: 'XP earned' }).textContent).toContain(`Squashed: ${ERROR_PATTERNS.no_sign_flip.title}+50`)
    const moment = within(sheet).getByRole('list', { name: 'Monsters squashed' })
    const item = within(moment).getByRole('listitem')
    expect(item.getAttribute('data-squashed')).toBe('no_sign_flip')
    expect(item.textContent).toBe(`Squashed: The Sign Flipper${ERROR_PATTERNS.no_sign_flip.title}`)
    // The splat, the drops, and the card turning gold (it ends gold: its own classes).
    expect(item.querySelector('.monster-splat svg[data-monster="no_sign_flip"]')).toBeTruthy()
    expect(item.querySelectorAll('.splat-drop')).toHaveLength(6)
    expect(item.className).toContain('squash-card')
    expect(item.className).toContain('bg-gold-100')
    expect(item.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, MOMENT_MS + 40))
    })
    expect(played.map((p) => p.cue)).toContain('pop')
  })

  it('reduced motion: no splat and no drops; gold and flattened from the start', { timeout: PAGE_TIMEOUT }, () => {
    installReducedPhone()
    useStore.getState().setSettings({ rewards: true })
    twoOfThree()
    finishNumberLine()
    const item = squash()!.querySelector<HTMLElement>('[data-squashed]')!
    expect(item.querySelector('.monster-splat')).toBeNull()
    expect(item.querySelector('.monster-squashed')).toBeTruthy()
    expect(item.querySelector('.splat-drop')).toBeNull()
    expect(item.className).not.toContain('squash-card')
    expect(item.className).toContain('bg-gold-100')
    expect(item.className).toContain('border-gold')
  })

  it('nothing squashed, no squash', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    useStore.getState().setSettings({ rewards: true })
    finishNumberLine()
    expect(screen.getByRole('dialog', { name: 'Problem complete' })).toBeTruthy()
    expect(squash()).toBeNull()
  })

  it('rewards off (the family app): the completion card shows the squash, with no XP; the pop still plays with Sounds on', { timeout: PAGE_TIMEOUT }, async () => {
    installPointer(true)
    useStore.getState().setSettings({ sounds: true })
    twoOfThree()
    finishNumberLine()
    expect(screen.queryByRole('dialog')).toBeNull()
    const card = document.querySelector<HTMLElement>('[data-completion-card]')!
    expect(card.contains(squash())).toBe(true)
    expect(squash()!.textContent).toContain('Squashed: The Sign Flipper')
    expect(card.textContent).not.toMatch(/XP/)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, MOMENT_MS + 40))
    })
    expect(played.map((p) => p.cue)).toEqual(['finish', 'pop'])
  })

  it('a wide screen with rewards on: in the completion card’s rewards', { timeout: PAGE_TIMEOUT }, () => {
    useStore.getState().setSettings({ rewards: true })
    twoOfThree()
    finishNumberLine()
    const rewards = document.querySelector<HTMLElement>('[data-finish-rewards]')!
    expect(rewards.contains(squash())).toBe(true)
  })
})
