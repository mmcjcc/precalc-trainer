// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetWindowSize, setWindowSize, WINDOWS } from '@/components/layoutTesting'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '../Problem'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
        <Route path="/" element={<p>home page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  resetStoreForTests()
})

afterEach(() => {
  resetWindowSize()
})

describe('Periodic table tool gating in ProblemFrame', () => {
  it('offers the Periodic table panel on chemistry problems in the desktop/tablet rail and keeps it in test mode', () => {
    useStore.getState().setSettings({ testMode: true })
    renderAt(problemPath('periodic', 'pt.locate', 1))

    expect(screen.getByRole('heading', { name: 'Periodic table' })).toBeTruthy()
    const ptable = document.querySelector<HTMLElement>('[data-ptable]')
    expect(ptable).toBeTruthy()
    expect(ptable!.querySelectorAll('[data-ptable-cell]')).toHaveLength(118)

    fireEvent.click(ptable!.querySelector<HTMLButtonElement>('[data-ptable-cell="K"]')!)
    expect(ptable!.querySelector('[data-ptable-detail]')?.textContent).toContain('Potassium')
  })

  it('offers the Elements sheet button on chemistry problems in the phone layout', () => {
    setWindowSize(...WINDOWS.phone)
    renderAt(problemPath('ionicNames', 'nm.ionicFormula', 1))

    const tools = screen.getByRole('group', { name: 'Side panels' })
    const btn = within(tools).getByRole('button', { name: 'Elements' })
    expect(btn).toBeTruthy()

    fireEvent.click(btn)
    const dialog = screen.getByRole('dialog', { name: 'Periodic table' })
    expect(dialog.querySelector('[data-ptable]')).toBeTruthy()
  })

  it('omits the Periodic table tool on non-chemistry problems (geometry and precalculus)', () => {
    const geoView = renderAt(problemPath('geoAngles', 'ga.bisector', 1))
    expect(screen.queryByRole('heading', { name: 'Periodic table' })).toBeNull()
    expect(document.querySelector('[data-ptable]')).toBeNull()
    geoView.unmount()

    resetStoreForTests()
    const precalcView = renderAt(problemPath('quadratics', 'cs.form', 1))
    expect(screen.queryByRole('heading', { name: 'Periodic table' })).toBeNull()
    expect(document.querySelector('[data-ptable]')).toBeNull()
    precalcView.unmount()

    resetStoreForTests()
    setWindowSize(...WINDOWS.phone)
    renderAt(problemPath('geoSegments', 'gs.addition', 1))
    const tools = screen.getByRole('group', { name: 'Side panels' })
    expect(within(tools).queryByRole('button', { name: 'Elements' })).toBeNull()
    expect(document.querySelector('[data-ptable]')).toBeNull()
  })
})
