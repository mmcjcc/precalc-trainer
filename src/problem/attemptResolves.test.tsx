// @vitest-environment jsdom
/**
 * A saved attempt for a problem this build cannot open (a module or template renamed or retired) must not lock her
 * out: seen in QA when a build without the log modules was served where an expLogEquations attempt was saved, and
 * every problem link bounced to Home until storage was cleared.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { Home } from '@/pages/Home'
import ProblemPage from '@/pages/Problem'
import { resetStoreForTests, STORAGE_KEYS, useStore } from '@/store'
import { attemptResolves } from './attemptResolves'

const SLOW = { timeout: 120_000 }

/** A saved attempt with her work in it, then its stored copy pointed at a module this build does not have. */
async function seedRetiredAttempt(): Promise<string> {
  const p = generateProblem('inequalities', 'ineq.linear', 7)
  const s = useStore.getState()
  s.startAttempt({ problemId: p.id, moduleId: p.moduleId, templateId: p.templateId, skill: p.skill, seed: '7', difficulty: '', genVersion: p.genVersion })
  useStore.getState().acceptStep({ text: p.canonical[0]!.text, propertyTag: p.canonical[0]!.tag })
  const id = useStore.getState().attempt!.id
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.attempt)!) as Record<string, unknown>
  localStorage.setItem(STORAGE_KEYS.attempt, JSON.stringify({ ...stored, moduleId: 'retiredLogs', templateId: 'rl.gone', problemId: 'retiredLogs/rl.gone@1/7' }))
  await useStore.persist.rehydrate()
  expect(useStore.getState().attempt).toMatchObject({ id, moduleId: 'retiredLogs' })
  return id
}

beforeEach(() => {
  resetStoreForTests()
})
afterEach(() => {
  cleanup()
})

describe('attemptResolves', () => {
  it('is true for a problem this build can open, false for a retired module, template or a bad seed', () => {
    const base = { id: 'a', moduleId: 'inequalities', templateId: 'ineq.linear', seed: '7', difficulty: '' }
    expect(attemptResolves(base)).toBe(true)
    expect(attemptResolves({ ...base, id: 'b', moduleId: 'retiredLogs' })).toBe(false)
    expect(attemptResolves({ ...base, id: 'c', templateId: 'ineq.gone' })).toBe(false)
    expect(attemptResolves({ ...base, id: 'd', seed: '!!' })).toBe(false)
  })
})

describe('a saved attempt for a retired module', () => {
  it('does not stop a real problem route: the problem renders, nothing asks about the old one, her events stay', SLOW, async () => {
    const oldId = await seedRetiredAttempt()
    const eventsBefore = useStore.getState().events.length
    render(
      <MemoryRouter initialEntries={['/p/geoAngles/ga.pairs/3']}>
        <Routes>
          <Route path="/" element={<p>Home page</p>} />
          <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByText('Home page')).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: generateProblem('geoAngles', 'ga.pairs', parseInt('3', 36)).title })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Unfinished problem' })).toBeNull()
    // The problem she opened replaced it; her earlier work is still in the log, and the old one is left unfinished.
    const s = useStore.getState()
    expect(s.attempt).toMatchObject({ moduleId: 'geoAngles', templateId: 'ga.pairs' })
    expect(s.events.length).toBeGreaterThanOrEqual(eventsBefore)
    expect(s.events.some((e) => e.t === 'step_accepted' && e.attemptId === oldId)).toBe(true)
  })

  it('is not offered on Home', SLOW, async () => {
    await seedRetiredAttempt()
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
    expect(screen.queryByText('Pick up where you left off')).toBeNull()
    expect(screen.queryByRole('link', { name: /Continue/ })).toBeNull()
  })
})
