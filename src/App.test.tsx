// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import '@/content'
import { MODULES } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import { CALC_LABEL, CHIP_LABEL } from '@/shared/types'
import { resetStoreForTests, useStore, type Ev } from '@/store'
import App, { AppShell } from './App'

const PIN_1234 = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'
/** Lazy routes transform on first use; the OneDrive disk is slow. */
const LAZY = { timeout: 20000 }

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell />
    </MemoryRouter>,
  )
}

beforeAll(async () => {
  await import('./pages/Drill')
}, 60000)

beforeEach(() => {
  resetStoreForTests()
  delete window.__PRECALC_CONFIG__
  window.location.hash = ''
})

afterEach(() => {
  delete window.__PRECALC_CONFIG__
})

describe('App routes', () => {
  it('renders Home with module cards, weak-spot practice and the current nav item marked', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Precalc Trainer' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Practice weak spots' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Random problem' })).toHaveLength(MODULES.length)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page')
    expect(within(nav).getByRole('link', { name: 'Progress' }).getAttribute('aria-current')).toBeNull()
  })

  it('shows a Continue card that links back to the unfinished problem', () => {
    const mod = MODULES.find((m) => m.templates.length > 0)!
    const t = mod.templates[0]!
    useStore.getState().startAttempt({
      problemId: `${mod.id}/${t.id}@${t.version}/abc`,
      moduleId: mod.id,
      templateId: t.id,
      skill: t.id,
      seed: 'abc',
      difficulty: 'f',
      genVersion: t.version,
    })
    useStore.getState().acceptStep({ text: 'x = 1' })
    renderAt('/')
    expect(screen.getByText(/1 step done/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Continue' }).getAttribute('href')).toBe(`/p/${mod.id}/${t.id}/abc?d=f`)
  })

  it('renders a module page with a Start button per template', () => {
    const mod = MODULES.find((m) => m.templates.length > 0)!
    renderAt(`/m/${mod.id}`)
    expect(screen.getByRole('heading', { level: 1, name: mod.title })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Start' })).toHaveLength(mod.templates.length)
  })

  it('renders Progress with named error patterns and backup controls', () => {
    const now = Date.now()
    const events: Ev[] = [
      { t: 'step_rejected', at: now, attemptId: 'a1', skill: 'ineq.any', stepIdx: 0, pattern: 'no_sign_flip' },
      { t: 'drill_answer', at: now, skill: 'powers-roots', correct: true, kind: 'legal' },
    ]
    useStore.setState({ events })
    renderAt('/progress')
    expect(screen.getByRole('heading', { level: 1, name: 'Progress' })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: ERROR_PATTERNS.no_sign_flip.title })).toBeTruthy()
    expect(screen.getByText('1 of 1 right (100%)')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Download backup (.json)' })).toBeTruthy()
    expect(screen.getByText('No backup from this device yet.')).toBeTruthy()
  })

  it('imports a pasted backup and reports the result', () => {
    const now = Date.now()
    useStore.setState({ events: [{ t: 'drill_answer', at: now, skill: 'f', correct: true, kind: 'legal' }] })
    const json = useStore.getState().exportJson()
    resetStoreForTests()
    renderAt('/progress')
    fireEvent.change(screen.getByLabelText('…or paste the backup text'), { target: { value: json } })
    fireEvent.click(screen.getByRole('button', { name: 'Import and merge' }))
    expect(screen.getByText(/Merged — 1 event added/)).toBeTruthy()
    expect(useStore.getState().events).toHaveLength(1)
  })

  it('renders Settings and saves the calculator and a reset', () => {
    useStore.setState({ events: [{ t: 'drill_answer', at: Date.now(), skill: 'f', correct: true, kind: 'legal' }] })
    renderAt('/settings')
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: CALC_LABEL.nspire }))
    expect(useStore.getState().settings.calculator).toBe('nspire')
    fireEvent.click(screen.getByRole('switch', { name: 'Test mode' }))
    expect(useStore.getState().settings.testMode).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Reset progress…' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes, reset everything' }))
    expect(useStore.getState().events).toHaveLength(0)
  })

  it('renders the Drill and records an answer in the store', async () => {
    renderAt('/drill')
    await screen.findByRole('heading', { level: 1, name: 'Properties drill' }, LAZY)
    const legal = screen.queryByRole('button', { name: 'Legal' })
    if (legal) fireEvent.click(legal)
    else fireEvent.click(screen.getByRole('button', { name: CHIP_LABEL.add_sub }))
    const answers = useStore.getState().events.filter((e) => e.t === 'drill_answer')
    expect(answers).toHaveLength(1)
    expect(answers[0]).toMatchObject({ kind: legal ? 'legal' : 'property' })
    expect(screen.getByText(/^[01] of 1 right$/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy()
  })
})

describe('PIN gate', () => {
  it('rejects a wrong PIN, then unlocks with 1234 and returns to the deep link', async () => {
    window.__PRECALC_CONFIG__ = { pinHash: PIN_1234 }
    window.location.hash = '#/progress'
    render(<App />)
    const input = screen.getByLabelText('Family PIN')
    expect(input.getAttribute('inputmode')).toBe('numeric')
    expect(input.getAttribute('type')).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: 'Show PIN' }))
    expect(screen.getByLabelText('Family PIN').getAttribute('type')).toBe('text')

    fireEvent.change(input, { target: { value: '0000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/doesn't match/)
    expect(useStore.getState().auth.ok).toBe(false)

    fireEvent.change(screen.getByLabelText('Family PIN'), { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Progress' }, LAZY)).toBeTruthy()
    expect(useStore.getState().auth.ok).toBe(true)
  })

  it('shows no gate when pinHash is empty', () => {
    window.__PRECALC_CONFIG__ = { pinHash: '' }
    render(<App />)
    expect(screen.queryByLabelText('Family PIN')).toBeNull()
    expect(screen.getByRole('button', { name: 'Practice weak spots' })).toBeTruthy()
  })
})

describe('Sign out (Container Apps sign-in)', () => {
  it('offers no sign-out link when the server configures none', () => {
    window.__PRECALC_CONFIG__ = { pinHash: '' }
    renderAt('/settings')
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Sign out' })).toBeNull()
  })

  it("links to the sign-in layer's logout when configured", () => {
    window.__PRECALC_CONFIG__ = { pinHash: '', signOutUrl: '/.auth/logout?post_logout_redirect_uri=/' }
    renderAt('/settings')
    const link = screen.getByRole('link', { name: 'Sign out' })
    expect(link.getAttribute('href')).toBe('/.auth/logout?post_logout_redirect_uri=/')
  })

  it.each(['//example.com/logout', '/\\example.com/logout', 'https://example.com/logout', 'javascript:alert(1)'])(
    'ignores the sign-out URL %s, which leaves the site',
    (signOutUrl) => {
      window.__PRECALC_CONFIG__ = { pinHash: '', signOutUrl }
      renderAt('/settings')
      expect(screen.queryByRole('link', { name: 'Sign out' })).toBeNull()
    },
  )
})
