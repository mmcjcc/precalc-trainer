import type { TutorProviderName } from '../../../src/shared/tutor.ts'
import type { ProviderRequest } from '../prompt.ts'

/**
 * unavailable: the provider failed (network, rate limit, bad key, 5xx...). Not counted.
 * timeout:     the provider's own client timed out. Not counted.
 * blocked:     the provider's safety layer stopped the answer (Gemini safety filter, Claude refusal). Counted.
 * aborted:     our AbortSignal fired (request timeout or she closed the page); the caller knows which.
 */
export type ProviderFailureKind = 'unavailable' | 'timeout' | 'blocked' | 'aborted'

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderFailureKind,
    /** Short code for the log ("rate_limited", "http_503", "safety"...). Never an error body. */
    readonly code: string,
  ) {
    super(`${kind}: ${code}`)
    this.name = 'ProviderError'
  }
}

export interface ProviderResult {
  /** The answer hit the output cap. */
  truncated: boolean
}

export interface TutorProvider {
  readonly name: TutorProviderName
  readonly model: string
  /** Has what it needs to answer (an API key; the mock always does). */
  readonly configured: boolean
  /**
   * Streams the answer: `onText` gets each text delta, in order. Resolves when the answer is complete;
   * rejects with a ProviderError (anything else is a bug and is treated as `unavailable`).
   */
  stream(req: ProviderRequest, onText: (text: string) => void, signal: AbortSignal): Promise<ProviderResult>
  /** Free start-up check that the key and the model id work (no tokens spent). Throws a ProviderError. */
  check(): Promise<void>
}

/** Short, body-free code for an HTTP status from a provider. */
export function statusCode(status: number | undefined): string {
  switch (status) {
    case 400:
      return 'bad_request'
    case 401:
      return 'auth'
    case 403:
      return 'forbidden'
    case 404:
      return 'not_found'
    case 429:
      return 'rate_limited'
    case undefined:
      return 'http_unknown'
    default:
      return `http_${status}`
  }
}
