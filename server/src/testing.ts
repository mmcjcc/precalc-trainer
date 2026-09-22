/**
 * Test helpers for the server tests (imported only by *.test.ts; never bundled, because main.ts
 * doesn't import it). No test here ever reaches a real provider.
 */
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { TutorAskRequest, TutorContext, TutorStreamEvent } from '../../src/shared/tutor.ts'
import { createHandler, type AppDeps } from './app.ts'
import { DailyLimiter } from './limits.ts'
import { TutorLog } from './log.ts'
import type { ProviderRequest } from './prompt.ts'
import { createMockProvider } from './providers/mock.ts'
import { ProviderError, type ProviderResult, type TutorProvider } from './providers/types.ts'

export const KID = 'kid@example.com'
export const PARENT = 'parent+precalc@example.org'
export const HEADER = 'X-MS-CLIENT-PRINCIPAL-NAME'

export function context(over: Partial<TutorContext> = {}): TutorContext {
  return {
    problemId: 'inequalities/ineq.distribute-negative@1/k3',
    attemptId: 'inequalities/ineq.distribute-negative@1/k3#mf00',
    moduleId: 'inequalities',
    subject: 'precalculus',
    kind: 'inequality',
    title: 'Solve the inequality',
    instructions: 'Solve for x. Give the answer in interval AND set notation.',
    statement: '-2(x - 3) <= 10',
    work: ['-2(x - 3) <= 10', '-2x + 6 <= 10', '-2x <= 4'],
    verdict: {
      status: 'rejected',
      line: 'x <= -2',
      message: 'At x = 0 your old line is TRUE but your new line is FALSE.',
      mistake: {
        id: 'no_sign_flip',
        title: 'Forgot to flip the inequality',
        lesson: 'Multiplying or dividing both sides by a negative number reverses the inequality.',
        witness: 'You divided by -2 and kept <=.',
      },
    },
    canonical: ['-2x + 6 <= 10', '-2x <= 4', 'x >= -2'],
    answer: '[-2, inf)',
    finished: false,
    revealed: false,
    ...over,
  }
}

export function askBody(question = 'why did my sign flip get rejected?', over: Partial<TutorContext> = {}): TutorAskRequest {
  return { question, context: context(over) }
}

/** A provider that records what it was asked and answers with a script. */
export interface ScriptedProvider extends TutorProvider {
  requests: ProviderRequest[]
}

export function scripted(
  run: (req: ProviderRequest, onText: (t: string) => void, signal: AbortSignal) => Promise<ProviderResult>,
  name: TutorProvider['name'] = 'gemini',
): ScriptedProvider {
  const requests: ProviderRequest[] = []
  return {
    name,
    model: 'test-model',
    configured: true,
    requests,
    async check() {},
    stream(req, onText, signal) {
      requests.push(req)
      return run(req, onText, signal)
    },
  }
}

/** Resolves after `ms`, or rejects the way providers do when the signal fires. */
export function waitOrAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new ProviderError('aborted', 'aborted'))
    })
  })
}

export interface TestApp {
  url: string
  log: TutorLog
  limiter: DailyLimiter
  logs: string[]
  close(): Promise<void>
}

export interface StartOptions extends Partial<Omit<AppDeps, 'log' | 'limiter'>> {
  limit?: number
  logDir?: string | null
  now?: () => Date
}

export async function startApp(opts: StartOptions = {}): Promise<TestApp> {
  const now = opts.now ?? (() => new Date())
  const log = new TutorLog({ dir: opts.logDir ?? null, timeZone: 'America/New_York', now })
  await log.init()
  const limiter = new DailyLimiter(opts.limit ?? 30, () => log.today(), log.countsFor(log.today()))
  const logs: string[] = []
  const server = createServer(
    createHandler({
      allowedUsers: opts.allowedUsers ?? new Set([KID, PARENT]),
      parentUsers: opts.parentUsers ?? new Set([PARENT]),
      timeoutMs: opts.timeoutMs ?? 5000,
      provider: opts.provider ?? createMockProvider({ delayMs: 0 }),
      log,
      limiter,
      now,
      heartbeatMs: opts.heartbeatMs ?? 15_000,
      logger: (line) => logs.push(line),
      ...(opts.newId ? { newId: opts.newId } : {}),
    }),
  )
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  return {
    url: `http://127.0.0.1:${port}`,
    log,
    limiter,
    logs,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}

export function headers(user: string | null = KID, json = true): Record<string, string> {
  return { ...(user ? { [HEADER]: user } : {}), ...(json ? { 'Content-Type': 'application/json' } : {}) }
}

export interface Frame {
  event: string
  data: TutorStreamEvent
}

/** Parses an SSE body: frames separated by a blank line, comment lines (":") ignored. */
export function parseSse(text: string): Frame[] {
  const frames: Frame[] = []
  for (const block of text.split('\n\n')) {
    let event = ''
    let data = ''
    for (const line of block.split('\n')) {
      if (line.startsWith(':') || !line) continue
      if (line.startsWith('event: ')) event = line.slice(7)
      else if (line.startsWith('data: ')) data += line.slice(6)
      else throw new Error(`unexpected SSE line: ${line}`)
    }
    if (event || data) frames.push({ event, data: JSON.parse(data) as TutorStreamEvent })
  }
  return frames
}

export async function ask(app: TestApp, body: unknown = askBody(), user: string | null = KID) {
  const res = await fetch(`${app.url}/api/tutor/ask`, { method: 'POST', headers: headers(user), body: JSON.stringify(body) })
  const text = await res.text()
  return { res, text, frames: res.headers.get('content-type')?.startsWith('text/event-stream') ? parseSse(text) : [] }
}

export function answerOf(frames: Frame[]): string {
  return frames.map((f) => (f.data.type === 'delta' ? f.data.text : '')).join('')
}

export function last(frames: Frame[]): TutorStreamEvent {
  const f = frames[frames.length - 1]
  if (!f) throw new Error('no frames')
  return f.data
}
