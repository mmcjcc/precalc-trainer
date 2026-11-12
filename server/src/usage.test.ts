/**
 * Token counts: what each provider reports for a call, and where the tutor keeps it (the log record,
 * the parent's log with a table by day and model, one console line of numbers). The counts are the
 * unit the provider bills in, so they are what a cost estimate has to be built from.
 * Also here: the log file ends its last line before appending to a copy that was cut off mid-write.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Anthropic from '@anthropic-ai/sdk'
import { FinishReason, type GenerateContentResponse, type GoogleGenAI } from '@google/genai'
import { afterEach, describe, expect, it } from 'vitest'
import type { TutorCardsResponse, TutorLogResponse } from '../../src/shared/tutor.ts'
import { buildRequest } from './prompt.ts'
import { createAnthropicProvider } from './providers/anthropic.ts'
import { createGeminiProvider, usageOf } from './providers/gemini.ts'
import { createMockProvider } from './providers/mock.ts'
import { tokenUsage, type TutorProvider } from './providers/types.ts'
import { KID, PARENT, ask, askBody, context, headers, scripted, startApp, type TestApp } from './testing.ts'

const REQ = buildRequest(context(), 'why was that rejected?', [])
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]).toString('base64')
const signal = () => new AbortController().signal

const apps: TestApp[] = []
const dirs: string[] = []
async function app(opts: Parameters<typeof startApp>[0] = {}): Promise<TestApp> {
  const a = await startApp(opts)
  apps.push(a)
  return a
}
afterEach(async () => {
  while (apps.length) await apps.pop()!.close()
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

async function parentLog(a: TestApp): Promise<TutorLogResponse> {
  await a.log.flush()
  return (await (await fetch(`${a.url}/api/tutor/log`, { headers: headers(PARENT, false) })).json()) as TutorLogResponse
}

describe('a token count is two whole numbers, or nothing', () => {
  it('keeps thinking and cached only when the provider gave a positive number', () => {
    expect(tokenUsage(1200, 340)).toEqual({ input: 1200, output: 340 })
    expect(tokenUsage(1200, 340, { thinking: 100, cached: 800 })).toEqual({ input: 1200, output: 340, thinking: 100, cached: 800 })
    expect(tokenUsage(1200, 340, { thinking: 0, cached: undefined })).toEqual({ input: 1200, output: 340 })
    expect(tokenUsage(1200.4, 339.6)).toEqual({ input: 1200, output: 340 })
  })

  it.each([
    [undefined, 5],
    [5, undefined],
    [-1, 5],
    [Number.NaN, 5],
    ['12', 5],
    [5, Number.POSITIVE_INFINITY],
  ])('%j and %j are no count', (input, output) => {
    expect(tokenUsage(input, output)).toBeUndefined()
  })
})

describe('what each provider reports', () => {
  function geminiWith(chunks: GenerateContentResponse[], one?: GenerateContentResponse): TutorProvider {
    const client = {
      models: {
        async generateContentStream() {
          return (async function* () {
            for (const c of chunks) yield c
          })()
        },
        async generateContent() {
          return one
        },
      },
    } as unknown as GoogleGenAI
    return createGeminiProvider({ apiKey: '', model: 'gemini-3.8-flash', thinking: 'low', timeoutMs: 1000, client })
  }
  const part = (text: string, usageMetadata?: Record<string, number>, finishReason?: FinishReason) =>
    ({ candidates: [{ content: { role: 'model', parts: [{ text }] }, ...(finishReason ? { finishReason } : {}) }], ...(usageMetadata ? { usageMetadata } : {}) }) as unknown as GenerateContentResponse

  it('Gemini: the last chunk’s totals, with thinking added to the answer because both are billed as output', async () => {
    const p = geminiWith([
      part('Look at ', { promptTokenCount: 2100, candidatesTokenCount: 3 }),
      part('the sign.', { promptTokenCount: 2100, candidatesTokenCount: 41, thoughtsTokenCount: 260, cachedContentTokenCount: 1024, totalTokenCount: 2401 }, FinishReason.STOP),
    ])
    const result = await p.stream(REQ, () => {}, signal())
    expect(result.usage).toEqual({ input: 2100, output: 301, thinking: 260, cached: 1024 })
  })

  it('Gemini: no usage metadata is no count, and the answer still stands', async () => {
    const result = await geminiWith([part('ok', undefined, FinishReason.STOP)]).stream(REQ, () => {}, signal())
    expect(result).toEqual({ truncated: false })
    expect(usageOf(undefined)).toBeUndefined()
    expect(usageOf({ candidatesTokenCount: 5 })).toBeUndefined()
  })

  it('Gemini: a photo read into cards carries its count', async () => {
    const p = geminiWith([], part('[{"term":"a","definition":"1"}]', { promptTokenCount: 1810, candidatesTokenCount: 900, thoughtsTokenCount: 120 }, FinishReason.STOP))
    expect(await p.cardsFromImage!({ mime: 'image/jpeg', data: JPEG }, signal())).toEqual({ text: '[{"term":"a","definition":"1"}]', usage: { input: 1810, output: 1020, thinking: 120 } })
  })

  it('Claude: the prompt is input_tokens plus what was read from and written to the cache', async () => {
    const client = {
      beta: {
        messages: {
          stream() {
            return {
              async *[Symbol.asyncIterator]() {
                yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } }
              },
              finalMessage: async () => ({
                stop_reason: 'end_turn',
                content: [{ type: 'text', text: 'ok' }],
                usage: { input_tokens: 300, output_tokens: 180, cache_read_input_tokens: 1500, cache_creation_input_tokens: 200 },
              }),
            }
          },
        },
      },
    } as unknown as Anthropic
    const p = createAnthropicProvider({ apiKey: '', model: 'claude-haiku-5-5', timeoutMs: 1000, client })
    expect((await p.stream(REQ, () => {}, signal())).usage).toEqual({ input: 2000, output: 180, cached: 1500 })
  })

  it('the mock counts characters, about four to a token, so the screens have numbers', async () => {
    const mock = createMockProvider({ delayMs: 0 })
    let text = ''
    const result = await mock.stream(REQ, (t) => (text += t), signal())
    expect(result.usage?.output).toBe(Math.ceil(text.length / 4))
    expect(result.usage?.input).toBeGreaterThan(200)
    const cards = await mock.cardsFromImage!({ mime: 'image/jpeg', data: JPEG }, signal())
    expect(cards.usage).toEqual({ input: Math.ceil(JPEG.length / 4), output: Math.ceil(cards.text.length / 4) })
  })
})

describe('where the tutor keeps the count', () => {
  const counted = (usage: { input: number; output: number; thinking?: number }) =>
    scripted(async (_req, onText) => {
      onText('Flip the sign.')
      return { truncated: false, usage }
    })

  it('on the answer in the parent’s log, in the table by day and model, and as numbers on the console line', async () => {
    const now = () => new Date('2026-09-21T16:00:00Z')
    const a = await app({ now, provider: counted({ input: 2400, output: 310, thinking: 250 }) })
    await ask(a)
    await ask(a)
    const log = await parentLog(a)
    expect(log.items).toHaveLength(2)
    expect(log.items[0]!.usage).toEqual({ input: 2400, output: 310, thinking: 250 })
    expect(log.days).toEqual([{ day: '2026-09-21', model: 'test-model', answers: 2, input: 4800, output: 620 }])
    const line = a.logs.find((l) => l.startsWith('tutor: ask ok'))!
    expect(line).toMatch(/^tutor: ask ok ms=\d+ chars=14 in=2400 out=310 thinking=250$/)
  })

  it('a provider that reports no count leaves the answer out of the table', async () => {
    const a = await app({ provider: scripted(async (_req, onText) => (onText('Hi.'), { truncated: false })) })
    await ask(a)
    const log = await parentLog(a)
    expect(log.items[0]!.usage).toBeUndefined()
    expect(log.days).toEqual([])
    expect(a.logs.find((l) => l.startsWith('tutor: ask ok'))).toMatch(/chars=3$/)
  })

  it('a failed answer has no count', async () => {
    const a = await app({ provider: createMockProvider({ delayMs: 0 }) })
    await ask(a, askBody('why? [mock-error]'))
    const log = await parentLog(a)
    expect(log.items[0]).toMatchObject({ status: 'error' })
    expect(log.items[0]!.usage).toBeUndefined()
    expect(log.days).toEqual([])
  })

  it('a photo read into cards is counted like an answer', async () => {
    const provider: TutorProvider = {
      ...scripted(async () => ({ truncated: false })),
      async cardsFromImage() {
        return { text: '[{"term":"Photon","definition":"A particle of light."}]', usage: { input: 1900, output: 700 } }
      },
    }
    const a = await app({ now: () => new Date('2026-09-21T16:00:00Z'), provider })
    const res = await fetch(`${a.url}/api/tutor/cards`, { method: 'POST', headers: headers(KID), body: JSON.stringify({ image: { mime: 'image/jpeg', data: JPEG } }) })
    expect(((await res.json()) as TutorCardsResponse).cards).toHaveLength(1)
    const log = await parentLog(a)
    expect(log.items[0]!.usage).toEqual({ input: 1900, output: 700 })
    expect(log.days).toEqual([{ day: '2026-09-21', model: 'test-model', answers: 1, input: 1900, output: 700 }])
    expect(a.logs.find((l) => l.startsWith('tutor: cards ok'))).toMatch(/^tutor: cards ok ms=\d+ cards=1 in=1900 out=700$/)
  })

  it('days are newest first, and each model has its own row', async () => {
    let t = new Date('2026-09-20T16:00:00Z')
    const a = await app({ now: () => t, provider: counted({ input: 100, output: 10 }) })
    await ask(a)
    t = new Date('2026-09-21T16:00:00Z')
    await ask(a)
    a.log.append({ ...(await parentLog(a)).items[0]!, type: 'ask', v: 1, id: 'other', day: '2026-09-21', kind: 'k', ms: 1, model: 'another-model', usage: { input: 7, output: 3 } })
    expect((await parentLog(a)).days).toEqual([
      { day: '2026-09-21', model: 'another-model', answers: 1, input: 7, output: 3 },
      { day: '2026-09-21', model: 'test-model', answers: 1, input: 100, output: 10 },
      { day: '2026-09-20', model: 'test-model', answers: 1, input: 100, output: 10 },
    ])
  })

  it('the count survives a restart, and old lines without one still load', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tutor-usage-'))
    dirs.push(dir)
    const now = () => new Date('2026-09-21T16:00:00Z')
    const old = JSON.stringify({ type: 'ask', v: 1, id: 'old', at: '2026-09-20T12:00:00Z', day: '2026-09-20', user: KID, problemId: 'p', moduleId: 'm', kind: 'k', question: 'q', answer: 'a', status: 'ok', counted: true, finished: false, revealed: false, provider: 'mock', model: 'mock', ms: 1 })
    writeFileSync(join(dir, 'tutor-2026-09.jsonl'), old + '\n')
    const first = await app({ now, logDir: dir, provider: counted({ input: 2000, output: 300 }) })
    await ask(first)
    await first.log.flush()
    const second = await app({ now, logDir: dir })
    const log = await parentLog(second)
    expect(log.items.map((i) => i.usage)).toEqual([{ input: 2000, output: 300 }, undefined])
    expect(log.days).toEqual([{ day: '2026-09-21', model: 'test-model', answers: 1, input: 2000, output: 300 }])
  })
})

describe('a log file cut off mid-write (a power failure, a failover)', () => {
  it('has its half line ended at start, so the next record is not glued to it and lost', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tutor-torn-'))
    dirs.push(dir)
    const file = join(dir, 'tutor-2026-09.jsonl')
    const now = () => new Date('2026-09-21T16:00:00Z')
    const whole = JSON.stringify({ type: 'ask', v: 1, id: 'whole', at: '2026-09-21T12:00:00Z', day: '2026-09-21', user: KID, problemId: 'p', moduleId: 'm', kind: 'k', question: 'q', answer: 'a', status: 'ok', counted: true, finished: false, revealed: false, provider: 'mock', model: 'mock', ms: 1 })
    writeFileSync(file, whole + '\n' + '{"type":"ask","v":1,"id":"torn","at":"2026-09-21T12:0')

    const first = await app({ now, logDir: dir, limit: 5 })
    expect(first.log.skippedLines).toBe(1)
    expect(readFileSync(file, 'utf8').endsWith('\n')).toBe(true)
    await ask(first)
    await first.log.flush()

    // The record written after the half line is whole in the file and loads at the next start.
    const second = await app({ now, logDir: dir, limit: 5 })
    expect(second.log.skippedLines).toBe(1)
    expect(second.log.recent(10)).toHaveLength(2)
    expect(second.limiter.remaining(KID)).toBe(3)
  })

  it('a file that ends cleanly is left exactly as it was', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tutor-clean-'))
    dirs.push(dir)
    const file = join(dir, 'tutor-2026-09.jsonl')
    const line = JSON.stringify({ type: 'ask', v: 1, id: 'whole', at: '2026-09-21T12:00:00Z', day: '2026-09-21', user: KID, problemId: 'p', moduleId: 'm', kind: 'k', question: 'q', answer: 'a', status: 'ok', counted: true, finished: false, revealed: false, provider: 'mock', model: 'mock', ms: 1 }) + '\n'
    writeFileSync(file, line)
    await app({ now: () => new Date('2026-09-21T16:00:00Z'), logDir: dir })
    expect(readFileSync(file, 'utf8')).toBe(line)
  })
})
