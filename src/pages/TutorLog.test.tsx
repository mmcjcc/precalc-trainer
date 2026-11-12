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

  it('shows a homework problem she typed, and marks a full solution', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/tutor/status')) return json(status({ isParent: true }))
        if (url.includes('/api/tutor/log')) {
          return json({
            logging: 'file',
            items: [
              item({
                id: 'hw',
                kind: 'freeform',
                className: 'Honors Precalculus',
                problemText: 'Solve 2x + 3 = 11',
                fullSolution: true,
                moduleId: 'freeform',
                problemId: 'conv-1',
                question: 'Show me the full solution',
                answer: 'Subtract 3, then divide by 2. x = 4.',
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
    expect(await screen.findByText(/Solve 2x \+ 3 = 11/)).toBeTruthy()
    expect(screen.getByText('Full solution')).toBeTruthy()
    expect(screen.getByText('Honors Precalculus')).toBeTruthy()
    expect(screen.getByText(/Subtract 3, then divide by 2/)).toBeTruthy()
  })

  it('shows what the provider counted: on each answer, and in a table by day and model', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/tutor/status')) return json(status({ isParent: true }))
        if (url.includes('/api/tutor/log')) {
          return json({
            logging: 'file',
            items: [
              item({ id: 'counted', model: 'gemini-3.8-flash', usage: { input: 2431, output: 356, thinking: 240 } }),
              item({ id: 'before', at: '2026-09-20T12:00:00.000Z', question: 'An answer from before counts were kept' }),
            ],
            days: [
              { day: '2026-09-21', model: 'gemini-3.8-flash', answers: 12, input: 31200, output: 4100 },
              { day: '2026-09-20', model: 'gemini-3.8-flash', answers: 3, input: 7000, output: 900 },
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
    expect(await screen.findByRole('heading', { name: 'Tokens by day' })).toBeTruthy()
    const rows = screen.getAllByRole('row').map((row) => row.textContent)
    expect(rows).toEqual(['DayModelAnswersInputOutput', '2026-09-21gemini-3.8-flash1231,2004,100', '2026-09-20gemini-3.8-flash37,000900'])
    const cards = screen.getAllByRole('article')
    expect(cards[0]?.querySelector('[data-tokens]')?.textContent).toBe('2,431 tokens in · 356 out (240 of them thinking) · gemini-3.8-flash')
    expect(cards[1]?.querySelector('[data-tokens]')).toBeNull()
  })

  it('an older tutor that sends no token table shows the log as before', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => (String(input).includes('/api/tutor/status') ? json(status({ isParent: true })) : json({ logging: 'file', items: [item({})] }))),
    )
    render(
      <MemoryRouter>
        <TutorLogPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Why flip the sign?')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Tokens by day' })).toBeNull()
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
