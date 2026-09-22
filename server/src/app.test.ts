import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { TUTOR_LIMITS, type TutorLogResponse, type TutorStatus } from '../../src/shared/tutor.ts'
import { MESSAGES } from './app.ts'
import { ProviderError } from './providers/types.ts'
import {
  KID,
  PARENT,
  answerOf,
  ask,
  askBody,
  headers,
  last,
  scripted,
  startApp,
  waitOrAbort,
  type TestApp,
} from './testing.ts'

const apps: TestApp[] = []
const dirs: string[] = []
async function app(opts: Parameters<typeof startApp>[0] = {}): Promise<TestApp> {
  const a = await startApp(opts)
  apps.push(a)
  return a
}
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'tutor-test-'))
  dirs.push(d)
  return d
}
afterEach(async () => {
  while (apps.length) await apps.pop()!.close()
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true })
})

async function status(a: TestApp, user: string | null = KID) {
  const res = await fetch(`${a.url}/api/tutor/status`, { headers: headers(user, false) })
  return { res, body: (await res.json()) as TutorStatus }
}

describe('only the family: allowlist and parent checks', () => {
  it('refuses a request with no signed-in account', async () => {
    const a = await app()
    for (const [path, init] of [
      ['/api/tutor/status', {}],
      ['/api/tutor/log', {}],
      ['/api/tutor/ask', { method: 'POST', headers: headers(null), body: JSON.stringify(askBody()) }],
      ['/api/tutor/flag', { method: 'POST', headers: headers(null), body: '{"id":"x","reason":"wrong"}' }],
    ] as const) {
      const res = await fetch(`${a.url}${path}`, init)
      expect(res.status, path).toBe(403)
      expect(await res.json()).toMatchObject({ code: 'forbidden' })
    }
  })

  it('refuses accounts that are not on ALLOWED_USERS, including near misses', async () => {
    const a = await app()
    for (const who of ['stranger@example.com', 'kid@example.com.evil.net', 'notkid@example.com', 'kid', `${KID}, ${PARENT}`]) {
      expect((await status(a, who)).res.status, who).toBe(403)
    }
  })

  it('matches the account ignoring letter case and surrounding spaces', async () => {
    const a = await app()
    expect((await status(a, '  KID@Example.COM ')).res.status).toBe(200)
  })

  it('fails closed when ALLOWED_USERS is empty', async () => {
    const a = await app({ allowedUsers: new Set(), parentUsers: new Set([PARENT]) })
    expect((await status(a, PARENT)).res.status).toBe(403)
  })

  it('reports isParent and lets only PARENT_USERS read the log', async () => {
    const a = await app()
    expect((await status(a, KID)).body.isParent).toBe(false)
    expect((await status(a, PARENT)).body.isParent).toBe(true)
    const kid = await fetch(`${a.url}/api/tutor/log`, { headers: headers(KID, false) })
    expect(kid.status).toBe(403)
    expect(await kid.json()).toMatchObject({ code: 'not_parent' })
    const parent = await fetch(`${a.url}/api/tutor/log`, { headers: headers(PARENT, false) })
    expect(parent.status).toBe(200)
    expect(((await parent.json()) as TutorLogResponse).items).toEqual([])
  })

  it('nobody reads the log when PARENT_USERS is empty', async () => {
    const a = await app({ parentUsers: new Set() })
    expect((await fetch(`${a.url}/api/tutor/log`, { headers: headers(PARENT, false) })).status).toBe(403)
  })
})

describe('status', () => {
  it('describes provider, limit, remaining and logging', async () => {
    const a = await app({ limit: 7 })
    expect((await status(a)).body).toEqual({
      configured: true,
      provider: 'mock',
      model: 'mock',
      limit: 7,
      remaining: 7,
      isParent: false,
      logging: 'memory',
    })
  })

  it('says file logging when TUTOR_LOG_DIR is set', async () => {
    const a = await app({ logDir: tempDir() })
    expect((await status(a)).body.logging).toBe('file')
  })
})

describe('ask: Server-Sent Events', () => {
  it('streams text deltas, then a done event with the remaining count', async () => {
    const a = await app({ limit: 5 })
    const { res, text, frames } = await ask(a)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/event-stream; charset=utf-8')
    expect(res.headers.get('cache-control')).toContain('no-cache')
    expect(res.headers.get('x-accel-buffering')).toBe('no')
    // Framing: every frame is "event: <type>\ndata: <json>\n\n" and the event name equals data.type.
    expect(text.endsWith('\n\n')).toBe(true)
    for (const f of frames) expect(f.event).toBe(f.data.type)
    expect(frames.length).toBeGreaterThan(2)
    expect(frames.slice(0, -1).every((f) => f.data.type === 'delta')).toBe(true)
    const done = last(frames)
    expect(done).toMatchObject({ type: 'done', remaining: 4, limit: 5 })
    expect(answerOf(frames)).toContain('(Mock tutor) The checker named this one: Forgot to flip the inequality')
    expect((await status(a)).body.remaining).toBe(4)
  })

  it('sends keep-alive comments while the provider is slow, and they do not break the framing', async () => {
    const provider = scripted(async (_req, onText, signal) => {
      await waitOrAbort(120, signal)
      onText('Think about the sign.')
      return { truncated: false }
    })
    const a = await app({ provider, heartbeatMs: 20 })
    const { text, frames } = await ask(a)
    expect(text).toContain(': keep-alive\n\n')
    expect(answerOf(frames)).toBe('Think about the sign.')
    expect(last(frames).type).toBe('done')
  })

  it('flags a truncated answer', async () => {
    const provider = scripted(async (_req, onText) => {
      onText('Half an ans')
      return { truncated: true }
    })
    const a = await app({ provider })
    expect(last((await ask(a)).frames)).toMatchObject({ type: 'done', truncated: true })
  })

  it('answers not_configured without calling anything when the provider has no key', async () => {
    const provider = { ...scripted(async () => ({ truncated: false })), configured: false }
    const a = await app({ provider })
    const { frames } = await ask(a)
    expect(last(frames)).toEqual({ type: 'error', code: 'not_configured', message: MESSAGES.not_configured, remaining: 30 })
    expect(provider.requests).toHaveLength(0)
  })
})

describe('request caps', () => {
  it('refuses a body over the cap with 413 before reading it all', async () => {
    const a = await app()
    const big = JSON.stringify(askBody('x'.repeat(10), { statement: 'y'.repeat(40_000) }))
    expect(big.length).toBeGreaterThan(TUTOR_LIMITS.bodyBytes)
    const res = await fetch(`${a.url}/api/tutor/ask`, { method: 'POST', headers: headers(), body: big })
    expect(res.status).toBe(413)
    expect(await res.json()).toMatchObject({ code: 'too_large' })
  })

  it('caps the question length', async () => {
    const a = await app()
    const ok = await ask(a, askBody('q'.repeat(TUTOR_LIMITS.question)))
    expect(last(ok.frames).type).toBe('done')
    const long = await ask(a, askBody('q'.repeat(TUTOR_LIMITS.question + 1)))
    expect(long.res.status).toBe(400)
    expect(JSON.parse(long.text)).toMatchObject({ code: 'question_too_long' })
  })

  it('refuses an empty question, bad JSON, a missing context field, too many lines', async () => {
    const a = await app()
    const cases: [string, unknown][] = [
      ['empty', askBody('   ')],
      ['no context', { question: 'hi' }],
      ['no statement', { question: 'hi', context: { ...askBody().context, statement: undefined } }],
      ['finished not boolean', { question: 'hi', context: { ...askBody().context, finished: 'yes' } }],
      ['bad subject', { question: 'hi', context: { ...askBody().context, subject: 'history' } }],
      ['too many lines', askBody('hi', { work: Array.from({ length: TUTOR_LIMITS.lines + 1 }, () => 'x = 1') })],
      ['line too long', askBody('hi', { canonical: ['x'.repeat(TUTOR_LIMITS.line + 1)] })],
      ['odd module id', askBody('hi', { moduleId: '../etc' })],
    ]
    for (const [what, body] of cases) {
      const r = await ask(a, body)
      expect(r.res.status, what).toBe(400)
    }
    const bad = await fetch(`${a.url}/api/tutor/ask`, { method: 'POST', headers: headers(), body: '{"question": ' })
    expect(bad.status).toBe(400)
    expect((await status(a)).body.remaining).toBe(30)
  })

  it('wants JSON and the right method', async () => {
    const a = await app()
    const form = await fetch(`${a.url}/api/tutor/ask`, {
      method: 'POST',
      headers: { 'X-MS-CLIENT-PRINCIPAL-NAME': KID, 'Content-Type': 'text/plain' },
      body: JSON.stringify(askBody()),
    })
    expect(form.status).toBe(415)
    expect((await fetch(`${a.url}/api/tutor/ask`, { headers: headers() })).status).toBe(405)
    expect((await fetch(`${a.url}/api/tutor/status`, { method: 'POST', headers: headers(), body: '{}' })).status).toBe(405)
    expect((await fetch(`${a.url}/api/tutor/nope`, { headers: headers() })).status).toBe(404)
  })
})

describe('daily limit', () => {
  it('stops at TUTOR_DAILY_LIMIT with a limit error', async () => {
    const a = await app({ limit: 2 })
    expect(last((await ask(a)).frames)).toMatchObject({ type: 'done', remaining: 1 })
    expect(last((await ask(a)).frames)).toMatchObject({ type: 'done', remaining: 0 })
    const third = await ask(a)
    expect(last(third.frames)).toEqual({ type: 'error', code: 'limit', message: MESSAGES.limit, remaining: 0 })
    expect(answerOf(third.frames)).toBe('')
    // The other account has its own allowance.
    expect(last((await ask(a, askBody(), PARENT)).frames)).toMatchObject({ type: 'done', remaining: 1 })
  })

  it('a restart counts today from the log file, and ignores yesterday and uncounted answers', async () => {
    const dir = tempDir()
    const now = () => new Date('2026-09-21T16:00:00Z') // noon in New York
    const first = await app({ limit: 3, logDir: dir, now })
    await ask(first)
    await ask(first)
    await first.log.flush()
    await first.close()
    apps.splice(apps.indexOf(first), 1)
    const file = join(dir, 'tutor-2026-09.jsonl')
    const extra = (day: string, counted: boolean) =>
      JSON.stringify({ type: 'ask', v: 1, id: `x-${day}-${counted}`, at: `${day}T12:00:00Z`, day, user: KID, problemId: 'p', moduleId: 'm', kind: 'k', question: 'q', answer: 'a', status: counted ? 'ok' : 'error', counted, finished: false, revealed: false, provider: 'mock', model: 'mock', ms: 1 })
    writeFileSync(file, readFileSync(file, 'utf8') + extra('2026-09-20', true) + '\n' + extra('2026-09-21', false) + '\n' + '{"torn line\n')

    const second = await app({ limit: 3, logDir: dir, now })
    expect(second.log.skippedLines).toBe(1)
    expect((await status(second)).body.remaining).toBe(1)
    expect(last((await ask(second)).frames)).toMatchObject({ type: 'done', remaining: 0 })
    expect(last((await ask(second)).frames)).toMatchObject({ type: 'error', code: 'limit' })
  })

  it('the count starts over at local midnight', async () => {
    let t = new Date('2026-09-22T03:30:00Z') // 23:30 on the 21st in New York
    const a = await app({ limit: 1, now: () => t })
    await ask(a)
    expect(last((await ask(a)).frames)).toMatchObject({ code: 'limit' })
    t = new Date('2026-09-22T04:30:00Z') // 00:30 on the 22nd
    expect(last((await ask(a)).frames)).toMatchObject({ type: 'done', remaining: 0 })
  })

  it('one question at a time per person', async () => {
    const provider = scripted(async (_req, onText, signal) => {
      await waitOrAbort(300, signal)
      onText('done')
      return { truncated: false }
    })
    const a = await app({ provider })
    const firstP = ask(a)
    await new Promise((r) => setTimeout(r, 60))
    const second = await ask(a)
    expect(last(second.frames)).toMatchObject({ type: 'error', code: 'busy', message: MESSAGES.busy })
    expect(last((await firstP).frames)).toMatchObject({ type: 'done', remaining: 29 })
  })
})

describe('provider failures', () => {
  it('a provider error is a friendly error event and does not count', async () => {
    const provider = scripted(async () => {
      throw new ProviderError('unavailable', 'rate_limited')
    })
    const b = await app({ limit: 3, provider })
    const { frames } = await ask(b)
    expect(last(frames)).toEqual({ type: 'error', code: 'unavailable', message: 'The tutor is unavailable right now. Try again in a little while.', remaining: 3 })
    expect((await status(b)).body.remaining).toBe(3)
    const item = b.log.recent(1)[0]
    expect(item).toMatchObject({ status: 'error', counted: false, answer: '' })
    expect(b.logs.some((l) => l.includes('code=rate_limited'))).toBe(true)
  })

  it('an error after partial text still does not count', async () => {
    const provider = scripted(async (_req, onText) => {
      onText('Start by ')
      throw new ProviderError('unavailable', 'http_503')
    })
    const a = await app({ limit: 3, provider })
    const { frames } = await ask(a)
    expect(frames[0].data).toEqual({ type: 'delta', text: 'Start by ' })
    expect(last(frames)).toMatchObject({ type: 'error', code: 'unavailable' })
    expect((await status(a)).body.remaining).toBe(3)
  })

  it('an unexpected exception is treated like a provider failure', async () => {
    const provider = scripted(async () => {
      throw new TypeError('boom')
    })
    const a = await app({ provider })
    expect(last((await ask(a)).frames)).toMatchObject({ type: 'error', code: 'unavailable', remaining: 30 })
  })

  it('the per-request timeout ends the answer with a timeout event and does not count', async () => {
    const provider = scripted(async (_req, _onText, signal) => {
      await waitOrAbort(10_000, signal)
      return { truncated: false }
    })
    const a = await app({ provider, timeoutMs: 80, limit: 2 })
    const t0 = Date.now()
    const { frames } = await ask(a)
    expect(Date.now() - t0).toBeLessThan(3000)
    expect(last(frames)).toEqual({ type: 'error', code: 'timeout', message: MESSAGES.timeout, remaining: 2 })
    expect(a.log.recent(1)[0]).toMatchObject({ status: 'timeout', counted: false })
  })

  it('a safety block counts (the provider did answer) and says so kindly', async () => {
    const provider = scripted(async () => {
      throw new ProviderError('blocked', 'finish_safety')
    })
    const a = await app({ provider, limit: 3 })
    expect(last((await ask(a)).frames)).toEqual({ type: 'error', code: 'blocked', message: MESSAGES.blocked, remaining: 2 })
    expect(a.log.recent(1)[0]).toMatchObject({ status: 'blocked', counted: true })
  })

  it('closing the page mid-answer aborts the provider call', async () => {
    let aborted = false
    const provider = scripted(async (_req, onText, signal) => {
      onText('Here is a start')
      await waitOrAbort(5000, signal).catch((e) => {
        aborted = true
        throw e
      })
      return { truncated: false }
    })
    const a = await app({ provider })
    const ctl = new AbortController()
    const res = await fetch(`${a.url}/api/tutor/ask`, { method: 'POST', headers: headers(), body: JSON.stringify(askBody()), signal: ctl.signal })
    const reader = res.body!.getReader()
    await reader.read()
    ctl.abort()
    await new Promise((r) => setTimeout(r, 100))
    expect(aborted).toBe(true)
    expect(a.log.recent(1)[0]).toMatchObject({ status: 'aborted', answer: 'Here is a start', counted: true })
  })
})

describe('no personal data goes to the provider', () => {
  it('sends only the problem and her question: no email, no account', async () => {
    const provider = scripted(async (_req, onText) => {
      onText('ok')
      return { truncated: false }
    })
    const a = await app({ provider })
    await ask(a, askBody('my email is kid.two@gmail.com and my cell is (555) 123-4567, why the flip?'))
    const req = provider.requests[0]
    const everything = [req.system, ...req.turns.map((t) => t.text)].join('\n')
    expect(everything).not.toContain(KID)
    expect(everything).not.toContain('kid.two@gmail.com')
    expect(everything).not.toContain('123-4567')
    expect(everything).toContain('[email removed]')
    expect(everything).toContain('[phone removed]')
    expect(everything).toContain('-2(x - 3) <= 10')
    // The parent's log keeps what she actually typed.
    expect(a.log.recent(1)[0].question).toContain('kid.two@gmail.com')
  })
})

describe('history of the same attempt', () => {
  it('replays her last answered questions on this attempt, and only this attempt', async () => {
    let n = 0
    const provider = scripted(async (_req, onText) => {
      onText(`answer ${++n}`)
      return { truncated: false }
    })
    const a = await app({ provider })
    await ask(a, askBody('first question'))
    await ask(a, askBody('second question'))
    let req = provider.requests[1]
    expect(req.turns.map((t) => t.role)).toEqual(['user', 'assistant', 'user'])
    expect(req.turns[0].text).toContain('first question')
    expect(req.turns[1].text).toBe('answer 1')
    expect(req.turns[0].text).not.toContain('<problem>')
    expect(req.turns[2].text).toContain('<problem>')

    await ask(a, askBody('other attempt', { attemptId: 'inequalities/ineq.distribute-negative@1/k3#zz' }))
    expect(provider.requests[2].turns).toHaveLength(1)

    for (let i = 0; i < 6; i++) await ask(a, askBody(`q${i}`))
    req = provider.requests[provider.requests.length - 1]
    expect(req.turns).toHaveLength(TUTOR_LIMITS.historyTurns * 2 + 1)

    // Another account never sees her thread.
    await ask(a, askBody('parent asks'), PARENT)
    expect(provider.requests[provider.requests.length - 1].turns).toHaveLength(1)
  })
})

describe('log and flags', () => {
  it('writes one JSONL record per question and per flag, and never the key or an error body', async () => {
    const dir = tempDir()
    let fail = false
    const provider = scripted(async (_req, onText) => {
      if (fail) throw new ProviderError('unavailable', 'rate_limited')
      onText('Divide by -2 and flip.')
      return { truncated: false }
    })
    const a = await app({ provider, logDir: dir, newId: (() => { let i = 0; return () => `id-${++i}` })() })
    const done = last((await ask(a)).frames)
    expect(done).toMatchObject({ type: 'done', id: 'id-1' })
    fail = true
    await ask(a, askBody('again?'))

    const flag = await fetch(`${a.url}/api/tutor/flag`, { method: 'POST', headers: headers(KID), body: JSON.stringify({ id: 'id-1', reason: 'wrong', note: ' it said flip twice ' }) })
    expect(flag.status).toBe(200)
    expect(await flag.json()).toEqual({ ok: true })
    const parentFlag = await fetch(`${a.url}/api/tutor/flag`, { method: 'POST', headers: headers(PARENT), body: JSON.stringify({ id: 'id-1', reason: 'inappropriate' }) })
    expect(parentFlag.status).toBe(200)
    await a.log.flush()

    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit' }).format(new Date())
    const text = readFileSync(join(dir, `tutor-${month}.jsonl`), 'utf8')
    const records = text.trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>)
    expect(records.map((r) => r.type)).toEqual(['ask', 'ask', 'flag', 'flag'])
    expect(records[0]).toMatchObject({ id: 'id-1', user: KID, question: 'why did my sign flip get rejected?', answer: 'Divide by -2 and flip.', status: 'ok', counted: true, verdict: 'rejected', mistake: 'no_sign_flip', provider: 'gemini', model: 'test-model', finished: false, revealed: false })
    expect(records[1]).toMatchObject({ status: 'error', counted: false, error: 'rate_limited', answer: '' })
    expect(records[2]).toMatchObject({ type: 'flag', id: 'id-1', by: KID, reason: 'wrong', note: 'it said flip twice' })
    expect(text).not.toMatch(/api[_-]?key/i)

    const log = (await (await fetch(`${a.url}/api/tutor/log?limit=10`, { headers: headers(PARENT, false) })).json()) as TutorLogResponse
    expect(log.logging).toBe('file')
    expect(log.items.map((i) => i.id)).toEqual(['id-2', 'id-1'])
    expect(log.items[1].flags.map((f) => f.reason)).toEqual(['wrong', 'inappropriate'])
    expect(log.items[1].flags[0]).toMatchObject({ by: KID, note: 'it said flip twice' })
  })

  it('flags: validates the reason, and only her own answers (a parent may flag any)', async () => {
    const a = await app({ newId: (() => { let i = 0; return () => `n${++i}` })() })
    await ask(a, askBody('from the parent'), PARENT)
    const post = (user: string, body: unknown) => fetch(`${a.url}/api/tutor/flag`, { method: 'POST', headers: headers(user), body: JSON.stringify(body) })
    expect((await post(KID, { id: 'n1', reason: 'wrong' })).status).toBe(404)
    expect((await post(KID, { id: 'nope', reason: 'wrong' })).status).toBe(404)
    expect((await post(PARENT, { id: 'n1', reason: 'rude' })).status).toBe(400)
    expect((await post(PARENT, { id: 'n1', reason: 'wrong', note: 'x'.repeat(TUTOR_LIMITS.flagNote + 1) })).status).toBe(400)
    expect((await post(PARENT, { id: 'n1', reason: 'wrong' })).status).toBe(200)
  })

  it('refuses to start when the log directory cannot be written', async () => {
    const dir = tempDir()
    const blocker = join(dir, 'a-file')
    writeFileSync(blocker, 'not a directory')
    await expect(startApp({ logDir: join(blocker, 'logs') })).rejects.toThrow()
  })
})
