// @vitest-environment jsdom
/** Step-by-step solving made obvious: the guide on a step problem, the badge, the Home link, a set always has one. */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Home } from '@/pages/Home'
import { ModulePage } from '@/pages/Module'
import ProblemPage from '@/pages/Problem'
import { normalizeSettings, settingsAfterImport } from '@/store/backup'
import { resetStoreForTests, useStore } from '@/store'
import { stepByStepModule } from '@/problem/solveStyle'

const SLOW = { timeout: 120_000 }

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/m/:moduleId" element={<ModulePage />} />
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  )
}

beforeEach(() => resetStoreForTests())
afterEach(() => cleanup())

describe('the step-by-step guide', () => {
  it('opens a step-by-step problem until she closes it, and never an answer-only one', SLOW, () => {
    const first = renderAt('/p/inequalities/ineq.linear/7')
    const guide = screen.getByRole('region', { name: 'Solve it step by step' })
    expect(within(guide).getByText('Write your next line, then check it.')).toBeTruthy()
    // Pick is not offered on inequalities, so the guide does not mention it.
    expect(within(guide).queryByText(/Switch to/)).toBeNull()
    fireEvent.click(within(guide).getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('region', { name: 'Solve it step by step' })).toBeNull()
    expect(useStore.getState().settings.seenStepGuide).toBe(true)
    first.unmount()
    // Closed once, it stays closed on the next step problem.
    renderAt('/p/inverses/inv.linear/3')
    expect(screen.queryByRole('region', { name: 'Solve it step by step' })).toBeNull()
  })

  it('mentions Pick where the problem offers it; an answer-only problem has no guide', SLOW, () => {
    const a = renderAt('/p/expLogEquations/ee.exponential/2')
    expect(within(screen.getByRole('region', { name: 'Solve it step by step' })).getByText(/Switch to/)).toBeTruthy()
    a.unmount()
    resetStoreForTests()
    renderAt('/p/logForms/lf.value/2')
    expect(screen.queryByRole('region', { name: 'Solve it step by step' })).toBeNull()
  })

  it('belongs to the device: an import never sets or clears it', () => {
    expect(normalizeSettings({ seenStepGuide: true }).seenStepGuide).toBe(true)
    expect(normalizeSettings({ seenStepGuide: 'yes' }).seenStepGuide).toBeUndefined()
    expect(settingsAfterImport({ seenStepGuide: true } as never, { seenStepGuide: false } as never, 'replace').seenStepGuide).toBe(true)
    expect(settingsAfterImport({} as never, { seenStepGuide: true } as never, 'replace').seenStepGuide).toBeUndefined()
  })
})

describe('where step-by-step problems are', () => {
  it('Home marks the step-by-step modules and offers one under Start a set', SLOW, () => {
    useStore.getState().setSettings({ courseId: 'precalc', unitByCourse: { precalc: 'unit1' } })
    renderAt('/')
    // The path's signposts carry the mark, on exactly the step-by-step modules.
    const badges = [...document.querySelectorAll('[data-step-badge]')]
    expect(badges.length).toBeGreaterThan(0)
    for (const badge of badges) {
      const signpost = badge.closest<HTMLElement>('[data-path-signpost]')!
      expect(signpost.querySelector('h3')!.textContent!.length).toBeGreaterThan(0)
      expect(stepByStepModule(signpost.dataset.pathSignpost!)).toBe(true)
    }
    const marked = badges.map((b) => b.closest<HTMLElement>('[data-path-signpost]')!.dataset.pathSignpost)
    const steps = [...document.querySelectorAll<HTMLElement>('[data-path-signpost]')].map((s) => s.dataset.pathSignpost!).filter(stepByStepModule)
    expect(marked).toEqual(steps)
    fireEvent.click(screen.getByRole('button', { name: 'Or solve one problem step by step' }))
    const path = screen.getByTestId('where').textContent!
    const moduleId = path.split('/')[2]!
    expect(path.startsWith('/p/')).toBe(true)
    expect(stepByStepModule(moduleId)).toBe(true)
  })

  it('a class with no step-by-step modules has no link; the module page shows the badge', SLOW, () => {
    useStore.getState().setSettings({ courseId: 'geometry' })
    const home = renderAt('/')
    expect(screen.queryByRole('button', { name: 'Or solve one problem step by step' })).toBeNull()
    home.unmount()
    renderAt('/m/inequalities')
    expect(document.querySelector('[data-step-badge]')!.textContent).toBe('Step by step')
  })
})
