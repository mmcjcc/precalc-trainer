import type { TutorConfig } from '../config.ts'
import { createAnthropicProvider } from './anthropic.ts'
import { createGeminiProvider } from './gemini.ts'
import { createMockProvider } from './mock.ts'
import type { TutorProvider } from './types.ts'

/** TUTOR_PROVIDER picks the implementation; switching provider is a setting, not a code change. */
export function makeProvider(c: TutorConfig): TutorProvider {
  switch (c.provider) {
    case 'gemini':
      return createGeminiProvider({ apiKey: c.geminiApiKey, model: c.geminiModel, thinking: c.geminiThinking, timeoutMs: c.timeoutMs })
    case 'anthropic':
      return createAnthropicProvider({ apiKey: c.anthropicApiKey, model: c.anthropicModel, timeoutMs: c.timeoutMs })
    case 'mock':
      return createMockProvider({ delayMs: c.mockDelayMs })
  }
}
