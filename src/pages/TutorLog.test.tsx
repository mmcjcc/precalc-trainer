// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TutorLogItem, TutorStatus } from '@/shared/tutor'
import { SettingsPage } from './Settings'
import { TutorLogPage } from './TutorLog'

function status(over: Partial<TutorStatus> = {}): TutorStatus {
  return {
    configured: true,
    provider: 'mock',
    model: 'mock',
    limit: 30,
    remaining: 12,
    isParent: false,
    logging: 'memory',
    ...over,
  }
}

function item(over: Partial<TutorLogItem>): TutorLogItem {
  return {
    id: 'id-1',
    at: '2026-09-21T15:00:00.000Z',
    user: 'student@example.com',
    problemId: 'inequalities/ineq.linear@1/abc',
    moduleId: 'inequalities',
    question: 'Why flip the sign?',
    answer: 'Dividing by a negative flips it.',
    status: 'ok',
    counted: true,
    finished: false,
    revealed: false,
    provider: 'mock',
    model: 'mock',
    flags: [],
    ...over,
  }
}

function json(body: unknown, code = 200): Response {
  return new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Tutor log', () => {
  it('renders a parent’s questions newest first, including a flag note', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/tutor/status')) return json(status({ isParent: true }))
        if (url.includes('/api/tutor/log')) {
          return json({
            logging: 'memory',
            items: [
              item({ id: 'older', at: '2026-09-20T12:00:00.000Z', question: 'Earlier question', answer: 'Earlier answer' }),
              item({
                id: 'newer',
                at: '2026-09-21T18:00:00.000Z',
                question: 'Later question',
                answer: 'Later answer',
                flags: [{ at: '2026-09-21T18:05:00.000Z', by: 'student@example.com', reason: 'wrong', note: 'said to divide by zero' }],
              }),
            ],
          })
        }
        return json({ error: 'nope' }, 404)
      }),
    )
    render(
      <MemoryRouter>
        <TutorLogPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Later question')).toBeTruthy()
    const cards = screen.getAllByRole('article')
    expect(cards[0]?.textContent).toContain('Later question')
    expect(cards[0]?.textContent).toContain('Later answer')
    expect(cards[0]?.textContent).toContain('said to divide by zero')
    expect(cards[1]?.textContent).toContain('Earlier question')
    expect(screen.queryByText('This page is for a parent.')).toBeNull()
    expect(screen.getByText(/cleared when the tutor restarts/)).toBeTruthy()
  })

  it('refuses anyone who is not a parent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(status({ isParent: false }))))
    render(
      <MemoryRouter>
        <TutorLogPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('This page is for a parent.')).toBeTruthy()
    expect(screen.queryByRole('article')).toBeNull()
  })
})

describe('Settings tutor link', () => {
  it('shows the Tutor log link only for a parent', async () => {
    const fetchMock = vi.fn(async () => json(status({ isParent: false })))
    vi.stubGlobal('fetch', fetchMock)
    const view = render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByRole('link', { name: 'Tutor log' })).toBeNull()
    view.unmount()

    vi.stubGlobal('fetch', vi.fn(async () => json(status({ isParent: true }))))
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )
    const link = await screen.findByRole('link', { name: 'Tutor log' })
    expect(link.getAttribute('href')).toBe('/tutor-log')
  })
})
