// @vitest-environment jsdom
/** The store app's first run: which class, then which unit; Home opens on the choice. */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCourse, unitsWithModules } from '@/content'
import { resetStoreForTests, useStore } from '@/store'
import { Home } from './Home'
import { courseBlurb } from './Welcome'

vi.mock('@/edition', () => ({
  EDITION: 'store',
  STORE: true,
  STORE_SKIPS_SUBJECTS: ['Chemistry'],
  includesSubject: (subject: string | undefined) => subject !== 'Chemistry',
}))

beforeEach(() => {
  resetStoreForTests()
})

function renderHome(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/c/:courseId" element={<Home />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('the store app’s first run', () => {
  it('asks for the class, then the unit, and Home opens on that choice', { timeout: 120_000 }, () => {
    renderHome()
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to Math Trainer' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Geometry/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'Which unit is your class on?' })).toBeTruthy()
    const geometry = getCourse('geometry')!
    const third = unitsWithModules(geometry)[2]!
    fireEvent.click(screen.getByRole('button', { name: `${third.label}: ${third.title}` }))
    const settings = useStore.getState().settings
    expect(settings.courseId).toBe('geometry')
    expect(settings.unitByCourse?.geometry).toBe(third.id)
    // Home itself now, on that class.
    expect(screen.queryByRole('heading', { name: 'Welcome to Math Trainer' })).toBeNull()
    expect(screen.getByRole('button', { name: /Start a set/ })).toBeTruthy()
  })

  it('Back returns to the classes; "Not sure?" starts at the first unit', { timeout: 120_000 }, () => {
    renderHome()
    fireEvent.click(screen.getByRole('button', { name: /^Precalculus/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to Math Trainer' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Precalculus/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Not sure? Start at the beginning' }))
    const precalc = getCourse('precalc')!
    expect(useStore.getState().settings.unitByCourse?.precalc).toBe(unitsWithModules(precalc)[0]!.id)
  })

  it('never shows once she has chosen a class, done anything, or followed a class link', { timeout: 120_000 }, () => {
    useStore.getState().setSettings({ courseId: 'precalc' })
    const a = renderHome()
    expect(screen.queryByRole('heading', { name: 'Welcome to Math Trainer' })).toBeNull()
    a.unmount()
    resetStoreForTests()
    useStore.setState({ events: [{ t: 'drill_answer', at: Date.now(), skill: 'f', correct: true, kind: 'legal' }] })
    const b = renderHome()
    expect(screen.queryByRole('heading', { name: 'Welcome to Math Trainer' })).toBeNull()
    b.unmount()
    resetStoreForTests()
    renderHome('/c/geometry')
    expect(screen.queryByRole('heading', { name: 'Welcome to Math Trainer' })).toBeNull()
  })

  it('says what each class covers, from its units', () => {
    const blurb = courseBlurb(getCourse('precalc')!)
    expect(blurb.startsWith('Functions and their graphs, ')).toBe(true)
  })
})
