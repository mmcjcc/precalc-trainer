// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useRef } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { worksheetInstance } from '@/content/modules/graphFeatures/generate'
import type { ProblemInstance } from '@/content/types'
import { useAttemptLifecycle, useCompletion } from '@/problem/useAttempt'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore, type Attempt } from '@/store'
import ProblemPage from '../Problem'
import { GraphFeaturesFlow } from './GraphFeaturesFlow'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** The worksheet is not a random seed (its lowest point sits just outside [-8, 8]), so mount the flow on that instance. */
function WorksheetPage({ instance }: { instance: ProblemInstance }) {
  const takeSecs = useRef(() => 0)
  const { completion, finish } = useCompletion(instance, 'Turning points', () => takeSecs.current())
  const live = useAttemptLifecycle(instance, '', !completion)
  const snapshot = useRef<Attempt | null>(null)
  if (live) snapshot.current = live
  const attempt = live ?? (completion ? snapshot.current : null)
  return <GraphFeaturesFlow instance={instance} attempt={attempt} flags="" templateTitle="Turning points" completion={completion} finish={finish} />
}

function renderWorksheet() {
  const instance = worksheetInstance()
  return render(
    <MemoryRouter>
      <WorksheetPage instance={instance} />
    </MemoryRouter>,
  )
}

function typeField(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

beforeEach(() => {
  resetStoreForTests()
})

describe('GraphFeaturesFlow', () => {
  it('shows a generated graph up front and hides the calculator', () => {
    renderAt(problemPath('graphFeatures', 'gf.features', 1))
    expect(screen.getByRole('heading', { name: 'Read the graph' })).toBeTruthy()
    expect(screen.getByText(/Use interval notation for increasing and decreasing/)).toBeTruthy()
    expect(screen.getAllByRole('img', { name: /Turning points/ }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Show the graph' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Calculator' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Show calculator steps' })).toBeNull()
    expect(screen.getByLabelText('Increasing')).toBeTruthy()
    expect(screen.getByLabelText('Local min')).toBeTruthy()
  })

  it('accepts her worksheet except U between the local minimums, then the "and" version finishes', () => {
    renderWorksheet()
    expect(screen.getAllByRole('img', { name: /\(-2\.5, -5\.5\).*\(2, 3\.25\).*\(7\.25, -9\.25\).*Both ends go up/ }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('(-2.5, -5.5)').length).toBeGreaterThan(0)
    expect(screen.getAllByText('(2, 3.25)').length).toBeGreaterThan(0)
    expect(screen.getAllByText('(7.25, -9.25)').length).toBeGreaterThan(0)

    typeField('Increasing', '(-2.5, 2) U (7.25, inf)')
    typeField('Decreasing', '(-inf, -2.5) U (2, 7.25)')
    typeField('Global max', 'none')
    typeField('Global min', '(7.25, -9.25)')
    typeField('Local max', '(2, 3.25)')
    typeField('Local min', '(-2.5, -5.5) U (7.25, -9.25)')
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('U joins intervals, not points')
    expect(alert.textContent).toContain('U joins intervals')
    expect(alert.textContent).toContain('(7.25, -9.25)')
    expect(alert.textContent).toMatch(/backwards/)
    expect(screen.getAllByText(/Looks right\./)).toHaveLength(5)
    expect(screen.getByLabelText('Local min').getAttribute('aria-invalid')).toBe('true')
    for (const label of ['Increasing', 'Decreasing', 'Global max', 'Global min', 'Local max']) {
      expect(screen.getByLabelText(label).getAttribute('aria-invalid')).toBeNull()
    }
    const finals = useStore.getState().events.filter((e) => e.t === 'final_answer')
    expect(finals).toMatchObject([{ correct: false, pattern: 'gf_union_between_points', via: 'text' }])

    fireEvent.click(screen.getByRole('button', { name: 'Nudge me' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show the rule' }))
    const hints = screen.getByRole('heading', { name: 'Hints' }).closest('section')!
    expect(within(hints).getByText('Which joiner?')).toBeTruthy()
    expect(hints.textContent).toContain('U joins intervals (sets of numbers)')
    expect(hints.textContent).toContain('(-inf, -5] U (2, 7]')
    expect(hints.textContent).toContain('{x | x <= -5 or 2 < x <= 7}')
    expect(hints.textContent).toContain('(-2.5, -5.5) and (7.25, -9.25)')

    typeField('Local min', '(-2.5, -5.5) and (7.25, -9.25)')
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(screen.getByText(/Increasing on \(-2\.5, 2\) U \(7\.25, inf\)/)).toBeTruthy()
    expect((screen.getByLabelText('Local min') as HTMLInputElement).disabled).toBe(true)
    const done = useStore.getState().events.find((e) => e.t === 'problem_done')
    expect(done).toMatchObject({ finalCorrect: false, revealed: 0 })
  })
})