// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCourse, modulesInUnit } from '@/content'
import { resetStoreForTests, STORAGE_KEYS, useStore, type Ev } from '@/store'
import { Home } from './Home'

function PathProbe() {
  const { pathname } = useLocation()
  return <p data-testid="path">{pathname}</p>
}

function renderHome(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PathProbe />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/c/:courseId" element={<Home />} />
        <Route path="/c/:courseId/:unitId" element={<Home />} />
      </Routes>
    </MemoryRouter>,
  )
}

function moduleTitles(): string[] {
  return screen.queryAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
}

const precalc = getCourse('precalc')!
const unit1Titles = modulesInUnit(precalc.units[0]!).map((module) => module.title)

function done(at: number, moduleId: string, skill: string): Ev {
  return {
    t: 'problem_done',
    at,
    attemptId: `a${at}`,
    skill,
    moduleId,
    steps: 1,
    firstTryRate: 1,
    hints: 0,
    revealed: 0,
    finalCorrect: true,
    mode: 'normal',
    secs: 1,
  }
}

beforeEach(() => {
  resetStoreForTests()
  localStorage.removeItem('pct.review.unit1')
})

describe('Home: classes and units', () => {
  it('shows one tab per class that has modules, and the row does not wrap', () => {
    renderHome()
    expect(screen.getByRole('heading', { level: 1, name: 'Math & Science Trainer' })).toBeTruthy()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Honors Precalculus', 'Chemistry'])
    expect(screen.queryByRole('tab', { name: 'Geometry' })).toBeNull()
    const tablist = screen.getByRole('tablist', { name: 'Classes' })
    expect(tablist.className).toMatch(/flex-nowrap/)
    expect(tablist.className).toMatch(/overflow-x-auto/)
    for (const tab of tabs) expect(tab.className).toMatch(/min-h-11/)
    const units = screen.getByRole('group', { name: 'Honors Precalculus units' })
    expect(units.className).toMatch(/flex-nowrap/)
    expect(units.className).toMatch(/overflow-x-auto/)
  })

  it('moves and selects a class with the arrow keys, Home and End', () => {
    renderHome()
    const tablist = screen.getByRole('tablist', { name: 'Classes' })
    expect(screen.getByRole('tab', { name: 'Honors Precalculus', selected: true })).toBeTruthy()

    fireEvent.keyDown(tablist, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Chemistry', selected: true })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Honors Precalculus', selected: false })).toBeTruthy()
    expect(moduleTitles()).toEqual(['Electrons and light'])

    fireEvent.keyDown(tablist, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Chemistry', selected: true })).toBeTruthy()

    fireEvent.keyDown(tablist, { key: 'Home' })
    expect(screen.getByRole('tab', { name: 'Honors Precalculus', selected: true })).toBeTruthy()
    expect(moduleTitles()).toEqual(unit1Titles)

    fireEvent.keyDown(tablist, { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: 'Honors Precalculus', selected: true })).toBeTruthy()

    fireEvent.keyDown(tablist, { key: 'End' })
    expect(screen.getByRole('tab', { name: 'Chemistry', selected: true })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Unit 1 review' })).toBeNull()
  })

  it('shows only the selected unit, with the review card on precalc Unit 1 only', () => {
    renderHome()
    expect(moduleTitles()).toEqual(unit1Titles)
    expect(moduleTitles().at(-1)).toBe('Difference quotient')
    expect(moduleTitles().indexOf('Domain and range')).toBe(moduleTitles().indexOf('Reading a graph') + 1)
    const review = screen.getByRole('heading', { name: 'Unit 1 review' })
    const firstModule = screen.getAllByRole('heading', { level: 3 })[0]!
    expect(review.compareDocumentPosition(firstModule) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('link', { name: /Start the review/ }).getAttribute('href')).toBe('/review/unit1')

    fireEvent.click(screen.getByRole('tab', { name: 'Chemistry' }))
    expect(screen.queryByRole('heading', { name: 'Unit 1 review' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Difference quotient' })).toBeNull()
    expect(moduleTitles()).toEqual(['Electrons and light'])
    expect(screen.getByRole('link', { name: /Choose a type/ }).getAttribute('href')).toBe('/m/electrons')

    fireEvent.click(screen.getByRole('button', { name: /Chapter 3/ }))
    expect(moduleTitles()).toEqual(['Significant figures'])
    expect(screen.getByRole('link', { name: /Choose a type/ }).getAttribute('href')).toBe('/m/sigFigs')
    expect(screen.queryByRole('heading', { name: 'Unit 1 review' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Chapter 4/ }))
    expect(moduleTitles()).toEqual(['Atomic structure'])
    expect(screen.getByRole('link', { name: /Choose a type/ }).getAttribute('href')).toBe('/m/atoms')

    fireEvent.click(screen.getByRole('tab', { name: 'Honors Precalculus' }))
    fireEvent.click(screen.getByRole('button', { name: /Unit 2/ }))
    expect(screen.getByText('Nothing to practise here yet: this unit is being built.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Random problem' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Unit 1 review' })).toBeNull()
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
    expect(screen.getByRole('button', { name: /Unit 2/, pressed: true }).textContent).toMatch(/Coming soon/)
  })

  it('keeps the choice in the store across a remount and a reload of saved settings', async () => {
    const first = renderHome()
    fireEvent.click(screen.getByRole('tab', { name: 'Chemistry' }))
    fireEvent.click(screen.getByRole('button', { name: /Chapter 4/ }))
    expect(useStore.getState().settings.courseId).toBe('chemistry')
    expect(useStore.getState().settings.unitByCourse).toEqual({ chemistry: 'ch4' })
    first.unmount()

    const second = renderHome()
    expect(screen.getByRole('tab', { name: 'Chemistry', selected: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Chapter 4/, pressed: true })).toBeTruthy()
    expect(moduleTitles()).toEqual(['Atomic structure'])
    const saved = localStorage.getItem(STORAGE_KEYS.settings)
    expect(saved).toMatch(/"courseId":"chemistry"/)
    expect(saved).toMatch(/"ch4"/)
    second.unmount()

    resetStoreForTests()
    localStorage.setItem(STORAGE_KEYS.settings, saved!)
    await useStore.persist.rehydrate()
    renderHome()
    expect(screen.getByRole('tab', { name: 'Chemistry', selected: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Chapter 4/, pressed: true })).toBeTruthy()
    expect(moduleTitles()).toEqual(['Atomic structure'])
    expect(useStore.getState().settings.calculator).toBe('ti84')
  })

  it('opens on the class of the latest event, and the last unit of that class that has modules', () => {
    useStore.setState({
      events: [
        done(1, 'inequalities', 'ineq.linear'),
        done(2, 'sigFigs', 'sf.mixed'),
        { t: 'drill_answer', at: 3, skill: 'powers-roots', correct: true, kind: 'legal' },
      ],
    })
    renderHome()
    expect(screen.getByRole('tab', { name: 'Chemistry', selected: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Chapter 5/, pressed: true })).toBeTruthy()
    expect(moduleTitles()).toEqual(['Electrons and light'])
    // The computed default is not written until she picks a class or opens a real deep link.
    expect(useStore.getState().settings.courseId).toBeUndefined()
  })

  it('breaks a tie by the later event, and ignores an event that belongs to no class', () => {
    useStore.setState({
      events: [done(5, 'sigFigs', 'sf.count'), done(5, 'inequalities', 'ineq.linear')],
    })
    renderHome()
    expect(screen.getByRole('tab', { name: 'Honors Precalculus', selected: true })).toBeTruthy()
  })

  it('opens /c/chemistry/ch5 on that class and unit, and an unknown id falls back', () => {
    const linked = renderHome('/c/chemistry/ch5')
    expect(screen.getByRole('tab', { name: 'Chemistry', selected: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Chapter 5/, pressed: true })).toBeTruthy()
    expect(moduleTitles()).toEqual(['Electrons and light'])
    expect(screen.queryByRole('heading', { name: 'Unit 1 review' })).toBeNull()
    expect(useStore.getState().settings.courseId).toBe('chemistry')
    expect(useStore.getState().settings.unitByCourse?.chemistry).toBe('ch5')
    linked.unmount()

    resetStoreForTests()
    const unknown = renderHome('/c/not-a-class/nope')
    expect(screen.getByRole('heading', { level: 1, name: 'Math & Science Trainer' })).toBeTruthy()
    expect(screen.queryByText(/not found/i)).toBeNull()
    expect(screen.getByRole('tab', { name: 'Honors Precalculus', selected: true })).toBeTruthy()
    expect(useStore.getState().settings.courseId).toBeUndefined()
    unknown.unmount()

    resetStoreForTests()
    renderHome('/c/chemistry/missing')
    expect(screen.getByRole('tab', { name: 'Chemistry', selected: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Chapter 5/, pressed: true })).toBeTruthy()
    expect(useStore.getState().settings.unitByCourse?.chemistry).toBe('ch5')
  })

  it('keeps Continue above the tabs, weak spots under them, and draws weak spots only from the selected class', () => {
    useStore.getState().startAttempt({
      problemId: 'inequalities/ineq.linear@1/abc',
      moduleId: 'inequalities',
      templateId: 'ineq.linear',
      skill: 'ineq.linear',
      seed: 'abc',
      difficulty: '',
      genVersion: 1,
    })
    renderHome()
    const continueLink = screen.getByRole('link', { name: 'Continue' })
    const tablist = screen.getByRole('tablist', { name: 'Classes' })
    expect(continueLink.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(continueLink.getAttribute('href')).toBe('/p/inequalities/ineq.linear/abc')

    const weak = screen.getByRole('region', { name: 'Practice weak spots' })
    expect(weak.textContent).toMatch(/from Honors Precalculus/)
    // It belongs to the selected class, so it sits under the class tabs and above the unit switcher.
    expect(tablist.compareDocumentPosition(weak) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const units = screen.getByRole('group', { name: 'Honors Precalculus units' })
    expect(weak.compareDocumentPosition(units) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Practice weak spots' }))
      expect(screen.getByTestId('path').textContent).toMatch(/^\/p\/numberLine\//)
    } finally {
      random.mockRestore()
    }
  })

  it('names the selected class on weak spots and will not leave that class', () => {
    renderHome()
    fireEvent.click(screen.getByRole('tab', { name: 'Chemistry' }))
    const weak = screen.getByRole('region', { name: 'Practice weak spots' })
    expect(weak.textContent).toMatch(/from Chemistry/)
    expect(weak.textContent).not.toMatch(/Honors Precalculus/)

    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Practice weak spots' }))
      const path = screen.getByTestId('path').textContent ?? ''
      expect(path.startsWith('/p/sigFigs/')).toBe(true)
      expect(path.includes('ineq')).toBe(false)
      expect(path.includes('numberLine')).toBe(false)
    } finally {
      random.mockRestore()
    }
  })
})
