// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { SatRwAnswer } from '@/content/types'
import { ProblemPage } from '@/pages/Problem'
import { Welcome } from '@/pages/Welcome'
import type { ModuleId } from '@/shared/types'
import { resetStoreForTests, useStore } from '@/store'

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
        <Route path="/" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SatRwFlow', () => {
  beforeEach(() => {
    resetStoreForTests()
  })

  it('renders an item, records a named mistake on a wrong option, finishes on the right option, and keeps progress across reload', () => {
    const inst = generateProblem('rwBoundaries' as ModuleId, 'rb.join', 7)
    expect(inst.answer.type).toBe('satrw')
    const answer = inst.answer as SatRwAnswer

    const wrongOpt = answer.options.find((o) => o.id !== answer.correctId)!
    const rightOpt = answer.options.find((o) => o.id === answer.correctId)!

    const view = renderAt('/p/rwBoundaries/rb.join/7')

    expect(screen.getByText(inst.statementText)).toBeTruthy()

    // Pick a wrong option first
    const wrongRadio = screen.getByRole('radio', { name: new RegExp(`^${wrongOpt.id}\\.`) })
    fireEvent.click(wrongRadio)
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))

    // Its named mistake is recorded and its student-words nudge is shown
    expect(screen.getByText(wrongOpt.nudge!)).toBeTruthy()
    const eventsAfterWrong = useStore.getState().events
    expect(eventsAfterWrong).toContainEqual(
      expect.objectContaining({
        t: 'final_answer',
        skill: 'rb.join',
        correct: false,
        pattern: wrongOpt.mistake,
      }),
    )

    // Reload mid-attempt: keeps her selected option and rejection feedback
    view.unmount()
    const reloaded = renderAt('/p/rwBoundaries/rb.join/7')
    const restoredWrongRadio = screen.getByRole('radio', { name: new RegExp(`^${wrongOpt.id}\\.`) }) as HTMLInputElement
    expect(restoredWrongRadio.checked).toBe(true)
    expect(screen.getByText(wrongOpt.nudge!)).toBeTruthy()

    // Now pick the right option and check
    const rightRadio = screen.getByRole('radio', { name: new RegExp(`^${rightOpt.id}\\.`) })
    fireEvent.click(rightRadio)
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))

    // Finished screen shows
    expect(screen.getByText('Problem finished')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'The answer, worked out' })).toBeTruthy()

    const eventsAfterDone = useStore.getState().events
    expect(eventsAfterDone).toContainEqual(
      expect.objectContaining({
        t: 'problem_done',
        skill: 'rb.join',
        finalCorrect: false,
      }),
    )

    // Reload after completion: her progress in the store persists
    reloaded.unmount()
    renderAt('/p/rwBoundaries/rb.join/7')
    expect(
      useStore.getState().events.some((e) => e.t === 'problem_done' && e.skill === 'rb.join'),
    ).toBe(true)
  })

  it('satrw course unit list renders only the two non-empty domains; the two empty domains do not render', () => {
    render(
      <MemoryRouter>
        <Welcome />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /^SAT Reading & Writing/ }))

    expect(screen.getByRole('button', { name: 'Domain 3: Expression of Ideas' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Domain 4: Standard English Conventions' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Information and Ideas/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Craft and Structure/ })).toBeNull()
  })
})
