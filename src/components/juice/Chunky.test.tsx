// @vitest-environment jsdom
/**
 * The chunky primary buttons: one shared class (`btn-chunky`, src/index.css) on the main actions — Check, the keypad's
 * Check, Start a set, Next problem, Next in set, See results, Another set — keeping each button's role and accessible
 * name; the press and the juice's animations stand still under reduced motion.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem } from '@/content'
import { resetKeypadForTests } from '@/components/keypadStore'
import { installPointer, keypad, removePointer, tapBox } from '@/components/keypadTesting'
import { MathInput } from '@/components/MathInput'
import { MathKeypad } from '@/components/MathKeypad'
import { SetSummary } from '@/components/set/SetSummary'
import { Home } from '@/pages/Home'
import ProblemPage from '@/pages/Problem'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

const PAGE_TIMEOUT = 120_000

class QuietObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

const chunky = (el: HTMLElement) => el.className.split(/\s+/).includes('btn-chunky')

beforeEach(() => {
  resetStoreForTests()
  resetKeypadForTests()
  localStorage.clear()
  vi.stubGlobal('IntersectionObserver', QuietObserver)
  window.scrollTo = () => {}
})

afterEach(() => {
  vi.unstubAllGlobals()
  removePointer()
})

describe('the main actions share the chunky class and keep their roles and names', () => {
  it('Home’s Start a set, still described by its line', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
    const start = screen.getByRole('button', { name: 'Start a set' })
    expect(chunky(start)).toBe(true)
    expect(document.getElementById(start.getAttribute('aria-describedby')!)!.textContent).toMatch(/^3 problems, about 5 minutes$/)
  })

  it('a Check, then Next problem on the completion card (wide) and on the finish sheet (phone)', { timeout: PAGE_TIMEOUT }, () => {
    const finish = () => {
      const inst = generateProblem('numberLine', 'nl.read', 12345, {})
      if (inst.answer.type !== 'set') throw new Error('expected a set answer')
      fireEvent.change(screen.getByLabelText('Interval notation'), { target: { value: inst.answer.interval } })
      fireEvent.change(screen.getByLabelText('Set-builder notation'), { target: { value: inst.answer.setBuilder } })
      const check = screen.getByRole('button', { name: 'Check answer' })
      expect(chunky(check)).toBe(true)
      expect(check.getAttribute('type')).toBe('submit')
      fireEvent.click(check)
    }
    const page = () =>
      render(
        <MemoryRouter initialEntries={[problemPath('numberLine', 'nl.read', 12345)]}>
          <Routes>
            <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
          </Routes>
        </MemoryRouter>,
      )
    const wide = page()
    finish()
    const card = document.querySelector<HTMLElement>('[data-completion-card]')!
    expect(chunky(within(card).getByRole('button', { name: 'Next problem' }))).toBe(true)
    expect(chunky(within(card).getByRole('button', { name: 'Copy link' }))).toBe(false)
    wide.unmount()

    resetStoreForTests()
    installPointer(true)
    useStore.getState().setSettings({ rewards: true })
    page()
    finish()
    const sheet = screen.getByRole('dialog', { name: 'Problem complete' })
    expect(chunky(within(sheet).getByRole('button', { name: 'Next problem' }))).toBe(true)
  })

  it('the set’s results: Another set (and Done stays a plain link-style button)', { timeout: PAGE_TIMEOUT }, () => {
    render(<SetSummary lines={[]} rewards={null} today={null} onAnother={() => {}} onDone={() => {}} />)
    expect(chunky(screen.getByRole('button', { name: 'Another set' }))).toBe(true)
    expect(chunky(screen.getByRole('button', { name: 'Done' }))).toBe(false)
  })

  it('a line’s Check and the keypad’s Check key', { timeout: PAGE_TIMEOUT }, () => {
    function Line() {
      const [value, setValue] = useState('')
      return <MathInput value={value} onChange={setValue} onSubmit={() => {}} label="Next line" />
    }
    // A wide screen: the line's own Check button.
    const wide = render(<Line />)
    const submit = screen.getByRole('button', { name: 'Check this step' })
    expect(chunky(submit)).toBe(true)
    expect(submit.getAttribute('type')).toBe('submit')
    wide.unmount()
    // A touch screen: the keypad's Check key.
    installPointer(true)
    render(
      <>
        <MathKeypad />
        <Line />
      </>,
    )
    tapBox(screen.getByRole('textbox', { name: 'Next line' }))
    const key = within(keypad()).getByRole('button', { name: 'check' })
    expect(chunky(key)).toBe(true)
    expect(key.getAttribute('tabindex')).toBe('-1')
  })
})

describe('the styles', () => {
  // Tests run from the project root.
  const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8')
  const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))

  it('the edge is a shadow the focus ring keeps, and a tap presses it down', { timeout: PAGE_TIMEOUT }, () => {
    expect(css).toMatch(/\.btn-chunky \{[^}]*box-shadow: 0 var\(--chunky-depth\) 0 var\(--chunky-edge\)/)
    expect(css).toMatch(/\.btn-chunky:focus-visible \{[^}]*var\(--chunky-edge\), 0 0 0 1px var\(--color-navy\)/)
    expect(css).toMatch(/\.btn-chunky:active:not\(:disabled\) \{[^}]*translateY\(var\(--chunky-depth\)\)/)
  })

  it('under reduced motion every juice animation is off and the press stands still', { timeout: PAGE_TIMEOUT }, () => {
    for (const name of ['juice-kept', 'juice-pop', 'xp-float', 'combo-pill', 'combo-count', 'flame-flare', 'confetti-bit', 'milestone-banner']) {
      // Each is an animation, and each is listed in the reduced-motion rule.
      expect(css).toMatch(new RegExp(`\\.${name} \\{[^}]*animation`))
      expect(reduced).toContain(`.${name}`)
    }
    expect(reduced).toMatch(/animation: none !important/)
    expect(reduced).toMatch(/\.btn-chunky:active:not\(:disabled\) \{ transform: none; \}/)
  })
})
