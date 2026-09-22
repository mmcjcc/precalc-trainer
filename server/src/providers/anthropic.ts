/**
 * TUTOR_PROVIDER=anthropic: Claude (claude-opus-5) through the official @anthropic-ai/sdk, following
 * the claude-api skill:
 *   - streaming (client.beta.messages.stream) with the text deltas forwarded as they arrive;
 *   - adaptive thinking (on by default on Opus 5; stated explicitly) with output_config effort
 *     "medium", thinking text omitted from the stream (she only ever sees the answer);
 *   - server-side refusal fallbacks: fallbacks "default" + beta server-side-fallback-2026-07-01, so
 *     a request declined by a safety classifier is re-run on Anthropic's recommended fallback model
 *     inside the same call; a refusal that survives the chain is reported as `blocked`;
 *   - max_tokens 4096: answers are a few sentences, and the cap covers thinking plus text;
 *   - typed error handling, most specific class first. Error bodies are never logged.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { ProviderRequest } from '../prompt.ts'
import { ProviderError, statusCode, type ProviderResult, type TutorProvider } from './types.ts'

export const ANTHROPIC_MAX_TOKENS = 4096
export const ANTHROPIC_FALLBACK_BETA = 'server-side-fallback-2026-07-01'

export interface AnthropicOptions {
  apiKey: string
  model: string
  timeoutMs: number
  /** Injected in tests; built from the key otherwise. */
  client?: Anthropic
}

/** The request body (exported for the tests). */
export function anthropicParams(model: string, req: ProviderRequest) {
  return {
    model,
    max_tokens: ANTHROPIC_MAX_TOKENS,
    betas: [ANTHROPIC_FALLBACK_BETA],
    fallbacks: 'default' as const,
    thinking: { type: 'adaptive' as const, display: 'omitted' as const },
    output_config: { effort: 'medium' as const },
    system: req.system,
    messages: req.turns.map((t) => ({ role: t.role, content: t.text })),
  }
}

function failure(err: unknown, signal: AbortSignal): ProviderError {
  if (err instanceof ProviderError) return err
  if (signal.aborted || err instanceof Anthropic.APIUserAbortError) return new ProviderError('aborted', 'aborted')
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new ProviderError('timeout', 'timeout')
  if (err instanceof Anthropic.APIConnectionError) return new ProviderError('unavailable', 'network')
  if (err instanceof Anthropic.RateLimitError) return new ProviderError('unavailable', 'rate_limited')
  if (err instanceof Anthropic.AuthenticationError) return new ProviderError('unavailable', 'auth')
  if (err instanceof Anthropic.PermissionDeniedError) return new ProviderError('unavailable', 'forbidden')
  if (err instanceof Anthropic.NotFoundError) return new ProviderError('unavailable', 'not_found')
  if (err instanceof Anthropic.BadRequestError) return new ProviderError('unavailable', 'bad_request')
  if (err instanceof Anthropic.APIError) return new ProviderError('unavailable', statusCode(err.status))
  return new ProviderError('unavailable', 'unknown')
}

export function createAnthropicProvider(opts: AnthropicOptions): TutorProvider {
  let client = opts.client
  const claude = () => (client ??= new Anthropic({ apiKey: opts.apiKey, maxRetries: 1 }))
  return {
    name: 'anthropic',
    model: opts.model,
    configured: Boolean(opts.apiKey || opts.client),
    async check() {
      const signal = AbortSignal.timeout(15_000)
      try {
        await claude().models.retrieve(opts.model, {}, { signal })
      } catch (err) {
        throw failure(err, signal)
      }
    },
    async stream(req, onText, signal): Promise<ProviderResult> {
      try {
        const stream = claude().beta.messages.stream(anthropicParams(opts.model, req), { signal, timeout: opts.timeoutMs })
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') onText(event.delta.text)
        }
        const message = await stream.finalMessage()
        // Check stop_reason before trusting the content: a refusal can arrive before any text or mid-stream.
        if (message.stop_reason === 'refusal') throw new ProviderError('blocked', 'refusal')
        const text = message.content.some((b) => b.type === 'text' && b.text.length > 0)
        if (!text) throw new ProviderError('unavailable', 'empty')
        return { truncated: message.stop_reason === 'max_tokens' }
      } catch (err) {
        throw failure(err, signal)
      }
    },
  }
}
