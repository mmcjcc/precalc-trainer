// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import type { TutorStatus, TutorStreamEvent } from '@/shared/tutor'
import ProblemPage from '@/pages/Problem'

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

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

function installMatchMedia(width: number) {
  window.matchMedia = (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    const matches = min ? width >= Number(min[1]) : false
    return {
      matches,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false
      },
    } as MediaQueryList
  }
}

function renderProblem() {
  return render(
    <MemoryRouter initialEntries={[problemPath('inequalities', 'ineq.linear', 4)]}>
      <Routes>
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function openAsk() {
  await waitFor(() => {
    const box = screen.queryByRole('textbox', { name: 'Your question' })
    const button = screen.queryByRole('button', { name: 'Ask' })
    if (!box && !button) throw new Error('tutor not open yet')
  })
  const button = screen.queryByRole('button', { name: 'Ask' })
  if (button && !screen.queryByRole('textbox', { name: 'Your question' })) fireEvent.click(button)
  return screen.findByRole('textbox', { name: 'Your question' })
}

beforeEach(() => {
  resetStoreForTests()
  localStorage.clear()
  installMatchMedia(1280)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Ask panel', () => {
  it('stays hidden when status fails, returns 503, or is not configured', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('offline')
    })
    vi.stubGlobal('fetch', fetchMock)
    const failed = renderProblem()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByRole('heading', { name: 'Ask' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ask' })).toBeNull()
    expect(screen.queryByText(/This is an AI tutor/)).toBeNull()
    failed.unmount()

    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'tutor offline' }, 503)))
    const down = renderProblem()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Hints' })).toBeTruthy())
    await waitFor(() => expect(screen.queryByText(/This is an AI tutor/)).toBeNull())
    expect(screen.queryByRole('button', { name: 'Ask' })).toBeNull()
    down.unmount()

    vi.stubGlobal('fetch', vi.fn(async () => json(status({ configured: false }))))
    renderProblem()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Rule cards' })).toBeTruthy())
    await waitFor(() => expect(screen.queryByText(/This is an AI tutor/)).toBeNull())
    expect(screen.queryByRole('heading', { name: 'Ask' })).toBeNull()
  })

  it('streams deltas into the answer, then shows how many questions are left', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init
      const url = String(input)
      if (url.includes('/api/tutor/status')) return json(status())
      if (url.includes('/api/tutor/ask')) {
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const enc = new TextEncoder()
            controller.enqueue(enc.encode(frame({ type: 'delta', text: 'Look at the sign. ' })))
            controller.enqueue(enc.encode(': keep-alive\n\n'))
            await gate
            controller.enqueue(enc.encode(frame({ type: 'delta', text: 'Then flip it.' })))
            controller.enqueue(enc.encode(frame({ type: 'done', id: 'ans-9', remaining: 11, limit: 30 })))
            controller.close()
          },
        })
        return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } })
      }
      return json({ ok: false }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)
    renderProblem()
    const box = await openAsk()
    expect(screen.getByText(/This is an AI tutor/)).toBeTruthy()
    expect(screen.getByText('12 questions left today')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(box, { target: { value: '   ' } })
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(box, { target: { value: 'x'.repeat(501) } })
    expect(screen.getByText('501/500')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(box, { target: { value: 'Why the sign?' } })
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/api/tutor/ask'))).toBe(false)
    fireEvent.keyDown(box, { key: 'Enter' })

    expect(await screen.findByText(/Look at the sign\./)).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Your question' }), { target: { value: 'And the next one?' } })
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true)

    release()
    expect(await screen.findByText(/Look at the sign\. Then flip it\./)).toBeTruthy()
    expect(screen.getByText('11 questions left today')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(false)

    const ask = fetchMock.mock.calls.find((call) => String(call[0]).includes('/api/tutor/ask'))
    const body = JSON.parse(String(ask?.[1]?.body)) as { question: string; context: Record<string, unknown> }
    expect(body.question).toBe('Why the sign?')
    expect(body.context.kind).toBe('inequality')
    expect(body.context).not.toHaveProperty('email')
    expect(body.context).not.toHaveProperty('name')
  })

  it('shows an error event in the answer and drops the partial text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/tutor/status')) return json(status())
        if (url.includes('/api/tutor/ask')) {
          return sse([
            frame({ type: 'delta', text: 'PARTIAL-SECRET' }),
            frame({
              type: 'error',
              code: 'unavailable',
              message: 'The tutor is unavailable right now. Try again in a little while.',
              remaining: 12,
            }),
          ])
        }
        return json({ ok: false }, 404)
      }),
    )
    renderProblem()
    const box = await openAsk()
    fireEvent.change(box, { target: { value: 'Hello?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('The tutor is unavailable right now. Try again in a little while.')).toBeTruthy()
    expect(screen.queryByText(/PARTIAL-SECRET/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Flag this answer' })).toBeNull()
  })

  it('flags a finished answer with its id and keeps the thread across a remount', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init
      const url = String(input)
      if (url.includes('/api/tutor/status')) return json(status())
      if (url.includes('/api/tutor/ask')) {
        return sse([frame({ type: 'delta', text: 'Check the sign.' }), frame({ type: 'done', id: 'log-42', remaining: 9, limit: 30 })])
      }
      if (url.includes('/api/tutor/flag')) return json({ ok: true })
      return json({ ok: false }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)
    const view = renderProblem()
    const box = await openAsk()
    fireEvent.change(box, { target: { value: 'Why was that rejected?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('Check the sign.')).toBeTruthy()
    const attemptId = useStore.getState().attempt?.id
    expect(attemptId).toBeTruthy()
    await waitFor(() => expect(localStorage.getItem(`pct.tutor.${attemptId}`)).toContain('Why was that rejected?'))

    fireEvent.change(screen.getByLabelText('Optional note'), { target: { value: 'It said to flip twice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Flag this answer' }))
    expect(await screen.findByText('Thanks, flagged for a parent to review.')).toBeTruthy()
    const flag = fetchMock.mock.calls.find((call) => String(call[0]).includes('/api/tutor/flag'))
    expect(JSON.parse(String(flag?.[1]?.body))).toEqual({ id: 'log-42', reason: 'wrong', note: 'It said to flip twice' })

    view.unmount()
    renderProblem()
    await openAsk()
    expect(await screen.findByText('Why was that rejected?')).toBeTruthy()
    expect(screen.getByText('Check the sign.')).toBeTruthy()
    expect(screen.getByText('Thanks, flagged for a parent to review.')).toBeTruthy()
  })

  it('puts an Ask button on the phone toolbar at 375px', async () => {
    installMatchMedia(375)
    vi.stubGlobal('fetch', vi.fn(async () => json(status())))
    renderProblem()
    const opener = await screen.findByRole('button', { name: 'Ask' })
    expect(opener.className).toContain('min-h-11')
    fireEvent.click(opener)
    const dialog = await screen.findByRole('dialog', { name: 'Ask' })
    expect(dialog.textContent).toContain('This is an AI tutor')
    const box = screen.getByRole('textbox', { name: 'Your question' })
    expect(box.className).toContain('w-full')
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).className).toContain('min-h-11')
  })
})
