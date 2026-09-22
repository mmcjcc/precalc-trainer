/**
 * TUTOR_PROVIDER=gemini: Google Gemini through the official @google/genai SDK, with the parent's
 * paid API key (paid tier: prompts are not used to improve Google's products).
 *
 * Calls, as documented at https://ai.google.dev/api/generate-content and
 * https://ai.google.dev/gemini-api/docs/safety-settings (read 2026-09-21):
 *   ai.models.generateContentStream({ model, contents, config }) -> async iterator of chunks
 *   config.systemInstruction, config.safetySettings, config.maxOutputTokens, config.thinkingConfig
 * The stateless generateContent API is used on purpose: nothing is stored on Google's side between
 * requests, and the history the model sees is exactly what this server sends.
 *
 * Safety: every adjustable harm category at BLOCK_LOW_AND_ABOVE (the default for Gemini 2.5 and 3
 * models is OFF). A blocked prompt or a SAFETY-type finish is reported as `blocked`.
 */
import {
  ApiError,
  FinishReason,
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  ThinkingLevel,
  type Content,
  type GenerateContentConfig,
  type GenerateContentResponse,
  type SafetySetting,
} from '@google/genai'
import type { GeminiThinking } from '../config.ts'
import type { ProviderRequest } from '../prompt.ts'
import { ProviderError, statusCode, type ProviderResult, type TutorProvider } from './types.ts'

/** Answers are a few sentences; the cap also bounds the model's thinking on a hard question. */
export const GEMINI_MAX_OUTPUT_TOKENS = 2048

export const GEMINI_SAFETY_SETTINGS: SafetySetting[] = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE }))

const BLOCKED_FINISH: ReadonlySet<string> = new Set([
  FinishReason.SAFETY,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII,
  FinishReason.RECITATION,
  FinishReason.LANGUAGE,
])

const LEVEL: Record<Exclude<GeminiThinking, 'off'>, ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
}

export interface GeminiOptions {
  apiKey: string
  model: string
  thinking: GeminiThinking
  timeoutMs: number
  /** Injected in tests; built from the key otherwise. */
  client?: GoogleGenAI
}

/** The request body the SDK sends (exported for the tests). */
export function geminiParams(model: string, thinking: GeminiThinking, req: ProviderRequest, signal: AbortSignal, timeoutMs: number) {
  const contents: Content[] = req.turns.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.text }] }))
  const config: GenerateContentConfig = {
    systemInstruction: req.system,
    safetySettings: GEMINI_SAFETY_SETTINGS,
    maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
    abortSignal: signal,
    httpOptions: { timeout: timeoutMs },
    ...(thinking === 'off' ? {} : { thinkingConfig: { thinkingLevel: LEVEL[thinking] } }),
  }
  return { model, contents, config }
}

/** Answer text of one chunk: text parts only, never thought parts. */
function chunkText(chunk: GenerateContentResponse): string {
  const parts = chunk.candidates?.[0]?.content?.parts ?? []
  let out = ''
  for (const p of parts) if (typeof p.text === 'string' && !p.thought) out += p.text
  return out
}

function failure(err: unknown, signal: AbortSignal): ProviderError {
  if (err instanceof ProviderError) return err
  if (signal.aborted) return new ProviderError('aborted', 'aborted')
  if (err instanceof ApiError) return new ProviderError('unavailable', statusCode(err.status))
  if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) return new ProviderError('timeout', 'timeout')
  return new ProviderError('unavailable', 'network')
}

export function createGeminiProvider(opts: GeminiOptions): TutorProvider {
  let client = opts.client
  const ai = () => (client ??= new GoogleGenAI({ apiKey: opts.apiKey }))
  return {
    name: 'gemini',
    model: opts.model,
    configured: Boolean(opts.apiKey || opts.client),
    async check() {
      const signal = AbortSignal.timeout(15_000)
      try {
        await ai().models.get({ model: opts.model, config: { abortSignal: signal } })
      } catch (err) {
        throw failure(err, signal)
      }
    },
    async stream(req, onText, signal): Promise<ProviderResult> {
      let truncated = false
      let any = false
      try {
        const stream = await ai().models.generateContentStream(geminiParams(opts.model, opts.thinking, req, signal, opts.timeoutMs))
        for await (const chunk of stream) {
          if (chunk.promptFeedback?.blockReason) throw new ProviderError('blocked', 'prompt_blocked')
          const text = chunkText(chunk)
          if (text) {
            any = true
            onText(text)
          }
          const finish = chunk.candidates?.[0]?.finishReason
          if (finish && BLOCKED_FINISH.has(finish)) throw new ProviderError('blocked', `finish_${finish.toLowerCase()}`)
          if (finish === FinishReason.MAX_TOKENS) truncated = true
        }
      } catch (err) {
        throw failure(err, signal)
      }
      if (!any) throw new ProviderError('unavailable', 'empty')
      return { truncated }
    },
  }
}
