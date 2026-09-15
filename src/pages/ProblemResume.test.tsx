// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { generateProblem } from '@/content/index'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from './Problem'

// Resume after reload (research UX-11): the page must mount straight into a stored mid-problem state
// without React hook-order errors, for the inverse flow at its check-it stage.
describe('resume a stored inverse attempt at the check-it stage', () => {
  let errors: string[] = []
  beforeEach(() => {
    resetStoreForTests()
    errors = []
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(' '))
    })
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the check-it card with the accepted lines and no hook errors', async () => {
    const seed36 = '1k8'
    const p = generateProblem('inverses', 'inv.linear', parseInt(seed36, 36))
    const s = useStore.getState()
    s.startAttempt({
      problemId: p.id,
      moduleId: p.moduleId,
      templateId: p.templateId,
      skill: p.skill,
      seed: seed36,
      difficulty: '',
      genVersion: p.genVersion,
    })
    s.setFinal({ oneToOne: 'yes' })
    s.recordFinalAnswer({ correct: true })
    // swap, subtract, divide: the last line is y = f⁻¹(x)
    const lines = [p.canonical[0]!, p.canonical[1]!, p.canonical[p.canonical.length - 1]!]
    for (const step of lines) {
      useStore.getState().acceptStep({ text: step.text, propertyTag: step.tag })
      if (step.tag === 'swap_xy') useStore.getState().setSwapped(true)
    }

    render(
      <MemoryRouter initialEntries={[`/p/inverses/inv.linear/${seed36}`]}>
        <Routes>
          <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Check it with k =/)).toBeTruthy()
    expect(screen.getByText(/stage 4 of 4/)).toBeTruthy()
    expect(useStore.getState().attempt?.steps.length).toBe(3)
    const hookErrors = errors.filter((e) => /hook/i.test(e) || /Rendered more/i.test(e))
    expect(hookErrors).toEqual([])
  })
})
