/**
 * Tutor HTTP client. POST /api/tutor/ask is Server-Sent Events, so it is read with fetch
 * (EventSource cannot POST). Framing: docs/progress/tutor-core.md §4.
 */
import type {
  TutorAskRequest,
  TutorErrorBody,
  TutorFlagRequest,
  TutorLogItem,
  TutorLogResponse,
  TutorStatus,
  TutorStreamEvent,
} from '@/shared/tutor'

const OFFLINE = 'The tutor is offline right now.'
const UNAVAILABLE = 'The tutor is unavailable right now. Try again in a little while.'

function isAbort(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true
  return err instanceof DOMException && err.name === 'AbortError'
}

export async function fetchTutorStatus(signal?: AbortSignal): Promise<TutorStatus | null> {
  try {
    const res = await fetch('/api/tutor/status', { signal })
    if (!res.ok) return null
    const data = (await res.json()) as TutorStatus
    if (!data || typeof data.configured !== 'boolean') return null
    return data
  } catch (err) {
    if (isAbort(err, signal)) return null
    return null
  }
}

function emitFrame(frame: string, on: (event: TutorStreamEvent) => void) {
  const data = frame.split('\n').find((line) => line.startsWith('data: '))
  if (!data) return
  try {
    const parsed = JSON.parse(data.slice(6)) as TutorStreamEvent
    if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') on(parsed)
  } catch {
    /* A bad frame is skipped; the next one may still be a done or an error. */
  }
}

async function readEventStream(res: Response, on: (event: TutorStreamEvent) => void) {
  if (!res.body) {
    on({ type: 'error', code: 'unavailable', message: UNAVAILABLE })
    return
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      buf = buf.replace(/\r\n/g, '\n')
      let splitAt = buf.indexOf('\n\n')
      while (splitAt >= 0) {
        emitFrame(buf.slice(0, splitAt), on)
        buf = buf.slice(splitAt + 2)
        splitAt = buf.indexOf('\n\n')
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/** Stream one question. An aborted fetch (she closed the panel) calls nothing. */
export async function askTutor(body: TutorAskRequest, on: (event: TutorStreamEvent) => void, signal?: AbortSignal) {
  let res: Response
  try {
    res = await fetch('/api/tutor/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (isAbort(err, signal)) return
    on({ type: 'error', code: 'unavailable', message: OFFLINE })
    return
  }
  if (signal?.aborted) return
  const stream = res.headers.get('content-type')?.startsWith('text/event-stream')
  if (!res.ok || !stream) {
    let message = UNAVAILABLE
    if (res.status === 503) message = OFFLINE
    else {
      try {
        const err = (await res.json()) as TutorErrorBody
        if (typeof err.error === 'string' && err.error) message = err.error
      } catch {
        /* keep the calm fallback */
      }
    }
    on({ type: 'error', code: 'unavailable', message })
    return
  }
  await readEventStream(res, (event) => {
    if (!signal?.aborted) on(event)
  })
}

export async function flagTutorAnswer(body: TutorFlagRequest): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch('/api/tutor/flag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) return { ok: true }
    if (res.status === 404) return { ok: false, message: "Couldn't flag that answer" }
    return { ok: false, message: "Couldn't flag that answer right now." }
  } catch {
    return { ok: false, message: "Couldn't flag that answer right now." }
  }
}

export async function fetchTutorLog(signal?: AbortSignal): Promise<{ ok: true; items: TutorLogItem[]; logging: TutorLogResponse['logging'] } | { ok: false }> {
  try {
    const res = await fetch('/api/tutor/log', { signal })
    if (!res.ok) return { ok: false }
    const data = (await res.json()) as TutorLogResponse
    const items = [...(data.items ?? [])].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    return { ok: true, items, logging: data.logging === 'file' ? 'file' : 'memory' }
  } catch (err) {
    if (isAbort(err, signal)) return { ok: false }
    return { ok: false }
  }
}
