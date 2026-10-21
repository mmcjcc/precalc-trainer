// @vitest-environment jsdom
/** The store app (STORE): sounds are on until she switches them off (the family web app is Juice.test.tsx). */
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from '@/pages/Settings'
import { resetStoreForTests, useStore } from '@/store'
import { installFakeAudio } from './audioTesting'
import { onCuePlayed, resetSoundsForTests, type PlayedCue } from './sounds'
import { MOMENT_MS, useJuice } from './useJuice'

vi.mock('@/edition', () => ({
  EDITION: 'store',
  STORE: true,
  STORE_SKIPS_SUBJECTS: ['Chemistry'],
  includesSubject: (subject: string | undefined) => subject !== 'Chemistry',
}))

let played: PlayedCue[] = []
let stop: () => void = () => {}

beforeEach(() => {
  resetStoreForTests()
  resetSoundsForTests()
  played = []
  stop = onCuePlayed((p) => played.push(p))
  installFakeAudio()
})

afterEach(() => {
  stop()
  vi.unstubAllGlobals()
})

const moment = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, MOMENT_MS + 40))
  })

describe('the store app', () => {
  it('chimes on a right line out of the box; the Settings switch is on and turns them off', { timeout: 120_000 }, async () => {
    renderHook(() => useJuice())
    useStore.getState().startAttempt({
      problemId: 'inequalities/ineq.linear@1/abc',
      moduleId: 'inequalities',
      templateId: 'ineq.linear',
      skill: 'ineq.linear',
      seed: 'abc',
      difficulty: '',
      genVersion: 1,
    })
    act(() => {
      useStore.getState().acceptStep({ text: 'x < 3' })
    })
    await moment()
    expect(played.map((p) => p.cue)).toEqual(['right'])

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )
    const sw = screen.getByRole('switch', { name: 'Sounds' })
    expect(sw.getAttribute('aria-checked')).toBe('true')
    expect(useStore.getState().settings.sounds).toBeUndefined()
    fireEvent.click(sw)
    expect(useStore.getState().settings.sounds).toBe(false)
    act(() => {
      useStore.getState().acceptStep({ text: 'x < 4' })
    })
    await moment()
    expect(played.map((p) => p.cue)).toEqual(['right'])
  })
})
