// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ModulePage } from './Module'

function renderModule(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/m/${id}`]}>
      <Routes>
        <Route path="/m/:moduleId" element={<ModulePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Module page class eyebrow', () => {
  it('names the chemistry chapter and links Back to that unit', () => {
    renderModule('electrons')
    expect(screen.getByText('Chemistry · Chapter 5')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Electrons and light' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/c/chemistry/ch5')
  })

  it('names the precalculus unit and links Back there', () => {
    renderModule('diffQuotient')
    expect(screen.getByText('Precalculus · Unit 1')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/c/precalc/unit1')
  })

  it('puts significant figures in Chapter 3, the chapter the module itself does not number', () => {
    renderModule('sigFigs')
    expect(screen.getByText('Chemistry · Chapter 3')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/c/chemistry/ch3')
  })
})
