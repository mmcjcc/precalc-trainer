/**
 * Provider adapters against fake SDK clients: the request each one builds, how the stream is read,
 * and how failures map. Nothing here reaches the network.
 */
import Anthropic from '@anthropic-ai/sdk'
import { ApiError, FinishReason, type GenerateContentResponse, type GoogleGenAI } from '@google/genai'
import { describe, expect, it } from 'vitest'
import { loadConfig } from '../config.ts'
import { buildRequest } from '../prompt.ts'
import { context } from '../testing.ts'
import { ANTHROPIC_FALLBACK_BETA, ANTHROPIC_MAX_TOKENS, createAnthropicProvider } from './anthropic.ts'
import { GEMINI_MAX_OUTPUT_TOKENS, createGeminiProvider } from './gemini.ts'
import { makeProvider } from './index.ts'
import { createMockProvider, mockReply } from './mock.ts'
import { ProviderError } from './types.ts'

const REQ = buildRequest(context(), 'why was that rejected?', [{ question: 'earlier?', answer: 'Earlier answer.' }])

async function run(p: ReturnType<typeof createMockProvider>, signal = new AbortController().signal) {
  let text = ''
  const result = await p.stream(REQ, (t) => (text += t), signal)
  return { text, result }
}

async function failureOf(promise: Promise<unknown>): Promise<ProviderError> {
  try {
    await promise
  } catch (err) {
    expect(err).toBeInstanceOf(ProviderError)
    return err as ProviderError
  }
  throw new Error('expected a failure')
}

// ---------------------------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------------------------

function chunk(parts: { text?: string; thought?: boolean }[], finishReason?: FinishReason, blockReason?: string): GenerateContentResponse {
  return {
    candidates: [{ content: { role: 'model', parts }, ...(finishReason ? { finishReason } : {}) }],
    ...(blockReason ? { promptFeedback: { blockReason } } : {}),
  } as unknown as GenerateContentResponse
}

function fakeGemini(script: GenerateContentResponse[] | Error, seen: { params?: unknown; getModel?: string } = {}): GoogleGenAI {
  return {
    models: {
      async generateContentStream(params: unknown) {
        seen.params = params
        if (script instanceof Error) throw script
        return (async function* () {
          for (const c of script) yield c
        })()
      },
      async get(params: { model: string }) {
        seen.getModel = params.model
        return { name: `models/${params.model}` }
      },
    },
  } as unknown as GoogleGenAI
}

function gemini(client: GoogleGenAI) {
  return createGeminiProvider({ apiKey: '', model: 'gemini-3.8-flash', thinking: 'low', timeoutMs: 60_000, client })
}

describe('Gemini provider', () => {
  it('sends the system instruction, the turns with Gemini roles, strict safety and the caps', async () => {
    const seen: { params?: unknown } = {}
    const p = gemini(fakeGemini([chunk([{ text: 'Hi' }], FinishReason.STOP)], seen))
    await run(p)
    const params = seen.params as {
      model: string
      contents: { role: string; parts: { text: string }[] }[]
      config: Record<string, unknown>
    }
    expect(params.model).toBe('gemini-3.8-flash')
    expect(params.contents.map((c) => c.role)).toEqual(['user', 'model', 'user'])
    expect(params.contents[1].parts[0].text).toBe('Earlier answer.')
    expect(params.contents[2].parts[0].text).toContain('<problem>')
    expect(params.config.systemInstruction).toBe(REQ.system)
    expect(params.config.maxOutputTokens).toBe(GEMINI_MAX_OUTPUT_TOKENS)
    expect(params.config.thinkingConfig).toEqual({ thinkingLevel: 'LOW' })
    expect(params.config.httpOptions).toEqual({ timeout: 60_000 })
    expect(params.config.abortSignal).toBeInstanceOf(AbortSignal)
    expect(params.config.safetySettings).toEqual([
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
    ])
  })

  it('omits the thinking level when GEMINI_THINKING=off', async () => {
    const seen: { params?: unknown } = {}
    const p = createGeminiProvider({ apiKey: '', model: 'gemini-2.5-flash', thinking: 'off', timeoutMs: 1000, client: fakeGemini([chunk([{ text: 'a' }])], seen) })
    await run(p)
    expect((seen.params as { config: Record<string, unknown> }).config.thinkingConfig).toBeUndefined()
  })

  it('streams answer text only (never thought parts) and reports MAX_TOKENS as truncated', async () => {
    const p = gemini(
      fakeGemini([
        chunk([{ text: 'secret reasoning', thought: true }]),
        chunk([{ text: 'Dividing by ' }]),
        chunk([{ text: 'a negative flips it.' }], FinishReason.MAX_TOKENS),
      ]),
    )
    const { text, result } = await run(p)
    expect(text).toBe('Dividing by a negative flips it.')
    expect(result.truncated).toBe(true)
  })

  it('a blocked prompt or a safety finish is `blocked`', async () => {
    expect((await failureOf(run(gemini(fakeGemini([chunk([], undefined, 'SAFETY')]))))).kind).toBe('blocked')
    const e = await failureOf(run(gemini(fakeGemini([chunk([{ text: 'Well' }], FinishReason.SAFETY)]))))
    expect(e).toMatchObject({ kind: 'blocked', code: 'finish_safety' })
    expect((await failureOf(run(gemini(fakeGemini([chunk([{ text: 'x' }], FinishReason.PROHIBITED_CONTENT)]))))).kind).toBe('blocked')
  })

  it('an API error maps to a short code, never the error body', async () => {
    const e = await failureOf(run(gemini(fakeGemini(new ApiError({ message: '{"error":{"message":"quota exceeded for key AIza-SECRET"}}', status: 429 })))))
    expect(e).toMatchObject({ kind: 'unavailable', code: 'rate_limited' })
    expect(e.message).not.toContain('SECRET')
    expect((await failureOf(run(gemini(fakeGemini(new ApiError({ message: 'x', status: 503 })))))).code).toBe('http_503')
    expect((await failureOf(run(gemini(fakeGemini(new TypeError('fetch failed'))))))).toMatchObject({ kind: 'unavailable', code: 'network' })
  })

  it('an empty answer is a failure', async () => {
    expect((await failureOf(run(gemini(fakeGemini([chunk([], FinishReason.STOP)])))))).toMatchObject({ kind: 'unavailable', code: 'empty' })
  })

  it('an aborted signal is `aborted`', async () => {
    const ctl = new AbortController()
    ctl.abort('timeout')
    const e = await failureOf(run(gemini(fakeGemini(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))), ctl.signal))
    expect(e.kind).toBe('aborted')
  })

  it('the start-up check asks for the model (free)', async () => {
    const seen: { getModel?: string } = {}
    await gemini(fakeGemini([], seen)).check()
    expect(seen.getModel).toBe('gemini-3.8-flash')
  })
})

// ---------------------------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------------------------

interface FakeStreamScript {
  events?: unknown[]
  final?: { stop_reason: string | null; content: { type: string; text?: string }[] }
  throws?: Error
}

function fakeAnthropic(script: FakeStreamScript, seen: { body?: Record<string, unknown>; options?: Record<string, unknown>; retrieved?: string } = {}): Anthropic {
  return {
    beta: {
      messages: {
        stream(body: Record<string, unknown>, options: Record<string, unknown>) {
          seen.body = body
          seen.options = options
          return {
            async *[Symbol.asyncIterator]() {
              if (script.throws) throw script.throws
              for (const e of script.events ?? []) yield e
            },
            finalMessage: async () => script.final ?? { stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }] },
          }
        },
      },
    },
    models: {
      async retrieve(id: string) {
        seen.retrieved = id
        return { id }
      },
    },
  } as unknown as Anthropic
}

const delta = (text: string) => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })

function claude(client: Anthropic) {
  return createAnthropicProvider({ apiKey: '', model: 'claude-opus-5', timeoutMs: 60_000, client })
}

describe('Anthropic provider', () => {
  it('streams claude-opus-5 with adaptive thinking, medium effort, refusal fallbacks and a modest max_tokens', async () => {
    const seen: { body?: Record<string, unknown>; options?: Record<string, unknown> } = {}
    const p = claude(
      fakeAnthropic(
        {
          events: [
            { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
            { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'hidden' } },
            delta('Look at '),
            delta('the sign.'),
          ],
          final: { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Look at the sign.' }] },
        },
        seen,
      ),
    )
    const { text, result } = await run(p)
    expect(text).toBe('Look at the sign.')
    expect(result.truncated).toBe(false)
    expect(seen.body).toMatchObject({
      model: 'claude-opus-5',
      max_tokens: ANTHROPIC_MAX_TOKENS,
      betas: [ANTHROPIC_FALLBACK_BETA],
      fallbacks: 'default',
      thinking: { type: 'adaptive', display: 'omitted' },
      output_config: { effort: 'medium' },
      system: REQ.system,
    })
    expect(ANTHROPIC_FALLBACK_BETA).toBe('server-side-fallback-2026-07-01')
    expect(ANTHROPIC_MAX_TOKENS).toBeGreaterThanOrEqual(2048)
    expect(seen.body?.messages).toEqual(REQ.turns.map((t) => ({ role: t.role, content: t.text })))
    expect(seen.body).not.toHaveProperty('temperature')
    expect(seen.options).toMatchObject({ timeout: 60_000 })
    expect(seen.options?.signal).toBeInstanceOf(AbortSignal)
  })

  it('checks stop_reason: a refusal is `blocked`, max_tokens is truncated', async () => {
    const refused = claude(fakeAnthropic({ events: [delta('Sure, ')], final: { stop_reason: 'refusal', content: [{ type: 'text', text: 'Sure, ' }] } }))
    expect(await failureOf(run(refused))).toMatchObject({ kind: 'blocked', code: 'refusal' })
    const long = claude(fakeAnthropic({ events: [delta('A long')], final: { stop_reason: 'max_tokens', content: [{ type: 'text', text: 'A long' }] } }))
    expect((await run(long)).result.truncated).toBe(true)
  })

  it('maps typed SDK errors, most specific first, to short codes', async () => {
    const h = new Headers()
    const cases: [Error, string, string][] = [
      [new Anthropic.RateLimitError(429, { type: 'error', error: { type: 'rate_limit_error', message: 'slow down SECRET' } }, 'slow down SECRET', h), 'unavailable', 'rate_limited'],
      [new Anthropic.AuthenticationError(401, undefined, 'bad key', h), 'unavailable', 'auth'],
      [new Anthropic.BadRequestError(400, undefined, 'bad', h), 'unavailable', 'bad_request'],
      [new Anthropic.InternalServerError(529, undefined, 'overloaded', h), 'unavailable', 'http_529'],
      [new Anthropic.APIConnectionTimeoutError(), 'timeout', 'timeout'],
      [new Anthropic.APIConnectionError({ message: 'reset' }), 'unavailable', 'network'],
      [new Anthropic.APIUserAbortError(), 'aborted', 'aborted'],
      [new Error('weird'), 'unavailable', 'unknown'],
    ]
    for (const [err, kind, code] of cases) {
      const e = await failureOf(run(claude(fakeAnthropic({ throws: err }))))
      expect(e, err.constructor.name).toMatchObject({ kind, code })
      expect(e.message).not.toContain('SECRET')
    }
  })

  it('the start-up check retrieves the model (free)', async () => {
    const seen: { retrieved?: string } = {}
    await claude(fakeAnthropic({}, seen)).check()
    expect(seen.retrieved).toBe('claude-opus-5')
  })
})

// ---------------------------------------------------------------------------------------------
// Mock and selection
// ---------------------------------------------------------------------------------------------

describe('mock provider', () => {
  it('streams a canned coaching reply that names the checker mistake', async () => {
    const { text } = await run(createMockProvider({ delayMs: 0 }))
    expect(text).toBe(mockReply(REQ))
    expect(text.startsWith('(Mock tutor)')).toBe(true)
    expect(text).toContain('Forgot to flip the inequality')
    expect(text).toContain('Try it and check it.')
    expect(text).toContain('1 earlier question(s)')
  })

  it('has hooks for the UI: [mock-error], [mock-blocked]', async () => {
    const p = createMockProvider({ delayMs: 0 })
    const err = buildRequest(context(), 'x [mock-error]', [])
    await expect(p.stream(err, () => {}, new AbortController().signal)).rejects.toMatchObject({ kind: 'unavailable' })
    const blocked = buildRequest(context(), '[mock-blocked]', [])
    await expect(p.stream(blocked, () => {}, new AbortController().signal)).rejects.toMatchObject({ kind: 'blocked' })
  })

  it('[mock-hang] waits for the abort', async () => {
    const p = createMockProvider({ delayMs: 0 })
    const ctl = new AbortController()
    const pending = p.stream(buildRequest(context(), '[mock-hang]', []), () => {}, ctl.signal)
    setTimeout(() => ctl.abort('timeout'), 20)
    await expect(pending).rejects.toMatchObject({ kind: 'aborted' })
  })
})

describe('TUTOR_PROVIDER selects the implementation', () => {
  it('gemini (default), anthropic and mock; configured only with a key', () => {
    const g = makeProvider(loadConfig({}))
    expect(g).toMatchObject({ name: 'gemini', model: 'gemini-3.8-flash', configured: false })
    expect(makeProvider(loadConfig({ GEMINI_API_KEY: 'k' })).configured).toBe(true)
    expect(makeProvider(loadConfig({ TUTOR_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }))).toMatchObject({ name: 'anthropic', model: 'claude-opus-5', configured: true })
    expect(makeProvider(loadConfig({ TUTOR_PROVIDER: 'mock' }))).toMatchObject({ name: 'mock', configured: true })
    expect(makeProvider(loadConfig({ GEMINI_MODEL: 'gemini-3.5-flash-lite', GEMINI_API_KEY: 'k' })).model).toBe('gemini-3.5-flash-lite')
  })
})
