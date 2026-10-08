// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '@/App'
import { resetStoreForTests } from '@/store'
import type { TutorStatus, TutorStreamEvent } from '@/shared/tutor'
import { AskAnythingPage } from './AskAnything'

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

function json(body: unknown, code = 200): Response {
  return new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json' } })
}

function frame(event: TutorStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

function sse(chunks: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder()
      for (const chunk of chunks) controller.enqueue(enc.encode(chunk))
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } })
}

function answer(text: string, id: string, remaining: number): Response {
  return sse([frame({ type: 'delta', text }), frame({ type: 'done', id, remaining, limit: 30 })])
}

beforeEach(() => {
  resetStoreForTests()
  localStorage.clear()
  delete window.__PRECALC_CONFIG__
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete window.__PRECALC_CONFIG__
})

function renderPage() {
  return render(
    <MemoryRouter>
      <AskAnythingPage />
    </MemoryRouter>,
  )
}

describe('Ask about any problem', () => {
  it('lists the classes, inserts a symbol, and starts a conversation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(status())))
    renderPage()
    const classBox = (await screen.findByLabelText('Class')) as HTMLSelectElement
    expect(Array.from(classBox.options).map((option) => option.text)).toEqual([
      'Honors Precalculus',
      'Chemistry',
      'Other math or science',
    ])
    expect((screen.getByRole('button', { name: 'Start' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'square root' }))
    expect((screen.getByLabelText('Problem') as HTMLTextAreaElement).value).toContain('sqrt()')
    expect(screen.queryByRole('textbox', { name: 'Your question' })).toBeNull()

    fireEvent.change(screen.getByLabelText('Problem'), { target: { value: 'Solve 2x + 3 = 11' } })
    fireEvent.change(screen.getByLabelText(/What I've tried/), { target: { value: 'I subtracted 3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(await screen.findByRole('textbox', { name: 'Your question' })).toBeTruthy()
    expect(screen.getByText('12 questions left today')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show me the full solution' })).toBeNull()
  })

  it('hides the full solution until two questions, then sends the flag', async () => {
    const bodies: { question: string; context: Record<string, unknown> }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('/api/tutor/status')) return json(status())
        if (url.includes('/api/tutor/ask')) {
          bodies.push(JSON.parse(String(init?.body)) as { question: string; context: Record<string, unknown> })
          const n = bodies.length
          return answer(`answer ${n}`, `id-${n}`, 12 - n)
        }
        return json({ ok: false }, 404)
      }),
    )
    renderPage()
    await screen.findByLabelText('Class')
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'chemistry' } })
    fireEvent.change(screen.getByLabelText('Problem'), { target: { value: 'Solve 2x + 3 = 11' } })
    fireEvent.change(screen.getByLabelText(/What I've tried/), { target: { value: 'I subtracted 3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    const box = await screen.findByRole('textbox', { name: 'Your question' })
    expect(screen.queryByRole('button', { name: 'Show me the full solution' })).toBeNull()

    fireEvent.change(box, { target: { value: 'Where do I start?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('answer 1')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show me the full solution' })).toBeNull()

    fireEvent.change(screen.getByRole('textbox', { name: 'Your question' }), { target: { value: 'What next?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('answer 2')).toBeTruthy()
    const solve = screen.getByRole('button', { name: 'Show me the full solution' })
    fireEvent.click(solve)
    expect(await screen.findByText('answer 3')).toBeTruthy()

    expect(bodies).toHaveLength(3)
    expect(bodies[0]?.context).toMatchObject({
      mode: 'freeform',
      className: 'Chemistry',
      problem: 'Solve 2x + 3 = 11',
      tried: 'I subtracted 3',
      fullSolution: false,
    })
    expect(bodies[1]?.context.fullSolution).toBe(false)
    expect(bodies[1]?.context.conversationId).toBe(bodies[0]?.context.conversationId)
    expect(bodies[2]?.question).toBe('Show me the full solution')
    expect(bodies[2]?.context.fullSolution).toBe(true)
    expect(bodies[2]?.context.conversationId).toBe(bodies[0]?.context.conversationId)

    fireEvent.change(screen.getByLabelText('Problem'), { target: { value: 'Solve x + 1 = 4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Your question' }), { target: { value: 'New problem?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('answer 4')).toBeTruthy()
    expect(bodies[3]?.context.conversationId).not.toBe(bodies[0]?.context.conversationId)
    expect(bodies[3]?.context.problem).toBe('Solve x + 1 = 4')
    expect(bodies[3]?.context.fullSolution).toBe(false)
  })

  it('says the tutor is offline or not set up, and offers the practice modules', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'tutor offline' }, 503)))
    const down = renderPage()
    expect(await screen.findByText('The tutor is offline right now.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Practice modules' }).getAttribute('href')).toBe('/')
    expect(screen.queryByLabelText('Problem')).toBeNull()
    down.unmount()

    vi.stubGlobal('fetch', vi.fn(async () => json(status({ configured: false }))))
    renderPage()
    expect(await screen.findByText("The tutor isn't set up yet.")).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Practice modules' }).getAttribute('href')).toBe('/')
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull()
  })
})

describe('Ask link and Home card', () => {
  function renderHome() {
    return render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    )
  }

  it('hides the nav item and the Home card when the tutor is not configured', async () => {
    const fetchMock = vi.fn(async () => json(status({ configured: false })))
    vi.stubGlobal('fetch', fetchMock)
    renderHome()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByRole('link', { name: 'Ask' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Ask about any problem: type a problem from your homework' })).toBeNull()
  })

  it('shows them, and the nav item opens the page, when the tutor is configured', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(status())))
    renderHome()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const link = await within(nav).findByRole('link', { name: 'Ask' })
    expect(link.getAttribute('href')).toBe('/ask')
    const card = await screen.findByRole('link', { name: 'Ask about any problem: type a problem from your homework' })
    expect(card.getAttribute('href')).toBe('/ask')
    fireEvent.click(link)
    expect(await screen.findByRole('heading', { name: 'Ask about any problem' }, { timeout: 20000 })).toBeTruthy()
    expect(await screen.findByLabelText('Class')).toBeTruthy()
  })
})
