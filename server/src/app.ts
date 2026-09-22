/**
 * The tutor's HTTP handler. nginx proxies /api/ here (127.0.0.1:3000 in the same replica).
 *
 *   GET  /healthz           "ok" (container health only; nginx never routes it here)
 *   GET  /api/tutor/status  TutorStatus
 *   POST /api/tutor/ask     TutorAskRequest -> text/event-stream of TutorStreamEvent
 *   GET  /api/tutor/log     TutorLogResponse (PARENT_USERS only)
 *   POST /api/tutor/flag    TutorFlagRequest -> TutorFlagResponse
 *
 * Every /api/tutor/ route re-checks the signed-in account against ALLOWED_USERS first.
 */
import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  TUTOR_LIMITS,
  type TutorAskRequest,
  type TutorErrorCode,
  type TutorFlagResponse,
  type TutorLogResponse,
  type TutorStatus,
  type TutorStreamEvent,
} from '../../src/shared/tutor.ts'
import { identify } from './auth.ts'
import { HEARTBEAT, formatEvent, parseJson, readBody, sendError, sendJson, startEventStream } from './http.ts'
import type { DailyLimiter } from './limits.ts'
import type { AskRecord, TutorLog } from './log.ts'
import { buildRequest } from './prompt.ts'
import { ProviderError, type TutorProvider } from './providers/types.ts'
import { RequestError, parseAskRequest, parseFlagRequest, redactPersonal } from './validate.ts'

export interface AppDeps {
  allowedUsers: ReadonlySet<string>
  parentUsers: ReadonlySet<string>
  timeoutMs: number
  provider: TutorProvider
  log: TutorLog
  limiter: DailyLimiter
  now?: () => Date
  newId?: () => string
  /** Interval between SSE keep-alive comments. */
  heartbeatMs?: number
  /** One line per event, never a key, a header or a provider error body. */
  logger?: (line: string) => void
}

/** Friendly sentences for the error event (shown to her as-is). */
export const MESSAGES: Record<TutorErrorCode, string> = {
  unavailable: 'The tutor is unavailable right now. Try again in a little while.',
  timeout: 'The tutor took too long to answer. Try asking again.',
  limit: "You've used all of today's tutor questions. They come back tomorrow.",
  busy: 'The tutor is still answering your last question.',
  blocked: "I can't help with that one. Let's get back to the problem.",
  not_configured: "The tutor isn't set up yet.",
}

type Handler = (req: IncomingMessage, res: ServerResponse) => void

export function createHandler(deps: AppDeps): Handler {
  const now = deps.now ?? (() => new Date())
  const newId = deps.newId ?? randomUUID
  const heartbeatMs = deps.heartbeatMs ?? 15_000
  const logger = deps.logger ?? ((line: string) => console.log(line))

  async function ask(req: IncomingMessage, res: ServerResponse, user: string): Promise<void> {
    const body: TutorAskRequest = parseAskRequest(parseJson(await readBody(req, TUTOR_LIMITS.bodyBytes)))
    const { question, context } = body
    const started = Date.now()
    const id = newId()
    const base = {
      type: 'ask' as const,
      v: 1 as const,
      id,
      user,
      problemId: context.problemId,
      ...(context.attemptId ? { attemptId: context.attemptId } : {}),
      moduleId: context.moduleId,
      kind: context.kind,
      question,
      finished: context.finished,
      revealed: context.revealed,
      ...(context.verdict ? { verdict: context.verdict.status } : {}),
      ...(context.verdict?.mistake?.id ? { mistake: context.verdict.mistake.id } : {}),
      provider: deps.provider.name,
      model: deps.provider.model,
    }
    const record = (fields: Pick<AskRecord, 'answer' | 'status' | 'counted'> & Partial<AskRecord>): AskRecord => {
      const at = now()
      return { ...base, at: at.toISOString(), day: deps.log.today(), ms: Date.now() - started, ...fields }
    }

    startEventStream(res)
    const send = (e: TutorStreamEvent) => {
      if (!res.writableEnded && !res.destroyed) res.write(formatEvent(e))
    }
    const fail = (code: TutorErrorCode, remaining?: number) =>
      send({ type: 'error', code, message: MESSAGES[code], ...(remaining === undefined ? {} : { remaining }) })

    if (!deps.provider.configured) {
      void deps.log.append(record({ answer: '', status: 'error', counted: false, error: 'not_configured' }))
      fail('not_configured', deps.limiter.remaining(user))
      res.end()
      return
    }
    const slot = deps.limiter.reserve(user)
    if (slot === 'busy') {
      fail('busy', deps.limiter.remaining(user))
      res.end()
      return
    }
    if (slot === 'limit') {
      void deps.log.append(record({ answer: '', status: 'error', counted: false, error: 'limit' }))
      fail('limit', 0)
      res.end()
      return
    }

    // From here the slot is reserved: every path below commits it exactly once.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort('timeout'), deps.timeoutMs)
    const heartbeat = setInterval(() => {
      if (!res.writableEnded && !res.destroyed) res.write(HEARTBEAT)
    }, heartbeatMs)
    const onClose = () => {
      if (!res.writableEnded) controller.abort('client')
    }
    res.on('close', onClose)

    let answer = ''
    try {
      const history = deps.log.history(user, context.problemId, context.attemptId, TUTOR_LIMITS.historyTurns)
      const request = buildRequest(context, redactPersonal(question), history)
      const result = await deps.provider.stream(
        request,
        (text) => {
          answer += text
          send({ type: 'delta', text })
        },
        controller.signal,
      )
      const remaining = deps.limiter.commit(user, true)
      void deps.log.append(record({ answer, status: 'ok', counted: true, ...(result.truncated ? { truncated: true } : {}) }))
      logger(`tutor: ask ok ms=${Date.now() - started} chars=${answer.length}${result.truncated ? ' truncated' : ''}`)
      send({ type: 'done', id, remaining, limit: deps.limiter.limit, ...(result.truncated ? { truncated: true } : {}) })
    } catch (err) {
      const pe = err instanceof ProviderError ? err : new ProviderError('unavailable', 'internal')
      if (!(err instanceof ProviderError)) logger(`tutor: unexpected ${err instanceof Error ? err.name : typeof err}`)
      const reason = controller.signal.aborted ? String(controller.signal.reason) : ''
      if (pe.kind === 'blocked') {
        // The provider did answer (with a refusal): it counts, like any other answered question.
        const remaining = deps.limiter.commit(user, true)
        void deps.log.append(record({ answer, status: 'blocked', counted: true, error: pe.code }))
        logger(`tutor: ask blocked code=${pe.code}`)
        fail('blocked', remaining)
      } else if (reason === 'client') {
        // She closed the page. Count it only if the provider had already started answering.
        const counted = answer.length > 0
        deps.limiter.commit(user, counted)
        void deps.log.append(record({ answer, status: 'aborted', counted, error: 'client_closed' }))
        logger('tutor: ask aborted by the client')
      } else if (reason === 'timeout' || pe.kind === 'timeout') {
        const remaining = deps.limiter.commit(user, false)
        void deps.log.append(record({ answer, status: 'timeout', counted: false, error: 'timeout' }))
        logger('tutor: ask timed out')
        fail('timeout', remaining)
      } else {
        const remaining = deps.limiter.commit(user, false)
        void deps.log.append(record({ answer, status: 'error', counted: false, error: pe.code }))
        logger(`tutor: provider failed code=${pe.code}`)
        fail('unavailable', remaining)
      }
    } finally {
      clearTimeout(timer)
      clearInterval(heartbeat)
      res.off('close', onClose)
      if (!res.writableEnded) res.end()
    }
  }

  async function flag(req: IncomingMessage, res: ServerResponse, user: string, isParent: boolean): Promise<void> {
    const body = parseFlagRequest(parseJson(await readBody(req, TUTOR_LIMITS.bodyBytes)))
    const target = deps.log.find(body.id)
    // Her own answers, or any answer for a parent. Anything else looks like "not found".
    if (!target || (target.user !== user && !isParent)) return sendError(res, 404, 'no such answer', 'not_found')
    await deps.log.append({
      type: 'flag',
      v: 1,
      at: now().toISOString(),
      day: deps.log.today(),
      id: body.id,
      by: user,
      reason: body.reason,
      ...(body.note ? { note: body.note } : {}),
    })
    logger(`tutor: answer flagged reason=${body.reason}`)
    const out: TutorFlagResponse = { ok: true }
    sendJson(res, 200, out)
  }

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://tutor.local')
    const path = url.pathname
    if (path === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end('ok\n')
      return
    }
    if (!path.startsWith('/api/tutor/')) return sendError(res, 404, 'not found', 'not_found')

    const caller = identify(req, deps.allowedUsers, deps.parentUsers)
    if (!caller.ok) {
      req.resume()
      return sendError(res, 403, 'this account may not use the tutor', 'forbidden')
    }
    const method = req.method ?? 'GET'
    const endpoint = path.slice('/api/tutor/'.length)
    const wants = (m: string) => {
      if (method === m) return true
      req.resume()
      sendError(res, 405, `use ${m}`, 'method_not_allowed')
      return false
    }
    const json = () => {
      const type = String(req.headers['content-type'] ?? '').toLowerCase()
      if (type.startsWith('application/json')) return true
      // Also keeps cross-site form posts out: a JSON content type needs a CORS preflight nobody answers.
      req.resume()
      sendError(res, 415, 'send Content-Type: application/json', 'unsupported_media_type')
      return false
    }

    switch (endpoint) {
      case 'status': {
        if (!wants('GET')) return
        const out: TutorStatus = {
          configured: deps.provider.configured,
          provider: deps.provider.name,
          model: deps.provider.model,
          limit: deps.limiter.limit,
          remaining: deps.limiter.remaining(caller.user),
          isParent: caller.isParent,
          logging: deps.log.logging,
        }
        return sendJson(res, 200, out)
      }
      case 'ask':
        if (!wants('POST') || !json()) return
        return ask(req, res, caller.user)
      case 'log': {
        if (!wants('GET')) return
        if (!caller.isParent) return sendError(res, 403, 'only a parent account may read the log', 'not_parent')
        const n = Number(url.searchParams.get('limit') ?? 100)
        const limit = Number.isInteger(n) && n > 0 ? Math.min(n, 500) : 100
        const out: TutorLogResponse = { items: deps.log.recent(limit), logging: deps.log.logging }
        return sendJson(res, 200, out)
      }
      case 'flag':
        if (!wants('POST') || !json()) return
        return flag(req, res, caller.user, caller.isParent)
      default:
        req.resume()
        return sendError(res, 404, 'not found', 'not_found')
    }
  }

  return (req, res) => {
    route(req, res).catch((err: unknown) => {
      if (res.headersSent) {
        if (!res.writableEnded) res.end()
        return
      }
      if (err instanceof RequestError) return sendError(res, err.status, err.message, err.code)
      logger(`tutor: internal error ${err instanceof Error ? err.name : typeof err}`)
      sendError(res, 500, 'internal error', 'internal')
    })
  }
}
