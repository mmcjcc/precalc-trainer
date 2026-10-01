/**
 * Tutor sidecar configuration, read once from the environment at start-up.
 *
 *   TUTOR_PROVIDER     gemini | anthropic | mock                     [gemini]
 *   GEMINI_API_KEY     paid Gemini API key (container app secret)
 *   GEMINI_MODEL       Gemini model id                               [gemini-3.8-flash]
 *   GEMINI_THINKING    low | medium | high | off (off = don't send a thinking level)  [low]
 *   ANTHROPIC_API_KEY  Anthropic API key (container app secret)
 *   ANTHROPIC_MODEL    Claude model id                               [claude-opus-5]
 *   TUTOR_DAILY_LIMIT  questions per person per day                  [30]
 *   TUTOR_TIMEOUT_MS   per-request provider timeout                  [60000]
 *   TUTOR_TIMEZONE     IANA zone where "today" starts and ends       [America/New_York]
 *   TUTOR_LOG_DIR      directory for the monthly JSONL logs (an Azure Files mount on Azure).
 *                      Unset: questions are logged in memory only (status says so).
 *   ALLOWED_USERS      comma-separated emails that may use the tutor (same list as nginx).
 *                      Empty: nobody gets in (fail closed).
 *   PARENT_USERS       comma-separated emails that may read the log. Never hard-coded.
 *   HOST / PORT        listen address                                [127.0.0.1 / 3000]
 *   TUTOR_MOCK_DELAY_MS  delay between mock words, for UI work        [30]
 *
 * Each key can also come from a file: GEMINI_API_KEY_FILE / ANTHROPIC_API_KEY_FILE name it (a
 * mounted secret such as /run/secrets/GEMINI_API_KEY). The plain variable wins when both are set.
 * So can each list: ALLOWED_USERS_FILE / PARENT_USERS_FILE, with the addresses separated by
 * commas, spaces or line ends. A list read from a file is never quoted in an error message.
 */
import { readFileSync } from 'node:fs'
import type { TutorProviderName } from '../../src/shared/tutor.ts'

export type GeminiThinking = 'low' | 'medium' | 'high' | 'off'

export interface TutorConfig {
  provider: TutorProviderName
  geminiApiKey: string
  geminiModel: string
  geminiThinking: GeminiThinking
  anthropicApiKey: string
  anthropicModel: string
  dailyLimit: number
  timeoutMs: number
  timeZone: string
  logDir: string | null
  allowedUsers: Set<string>
  parentUsers: Set<string>
  host: string
  port: number
  mockDelayMs: number
}

export class ConfigError extends Error {}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash'
export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5'

/** Same character rule as docker/25-allowlist.sh: anything else is refused rather than guessed at. */
const ACCOUNT = /^[A-Za-z0-9._%+@-]+$/

/** `quote: false` keeps a refused entry out of the message (a list that came from a secret file). */
export function parseUserList(name: string, raw: string | undefined, quote = true): Set<string> {
  const out = new Set<string>()
  for (const part of (raw ?? '').split(',')) {
    const u = part.trim()
    if (!u) continue
    if (!ACCOUNT.test(u)) {
      throw new ConfigError(`${name} ${quote ? `entry "${u}"` : 'has an entry that'} has a character outside A-Z a-z 0-9 . _ % + @ -`)
    }
    out.add(u.toLowerCase())
  }
  return out
}

/**
 * The content of the file `${name}_FILE` points at (a mounted secret), or null when that variable
 * is not set. A file that is named but can't be read stops start-up, rather than running on
 * without the key or with an empty list. The message names the variable, never the content.
 */
function fileOf(env: Record<string, string | undefined>, name: string): string | null {
  const file = (env[`${name}_FILE`] ?? '').trim()
  if (!file) return null
  try {
    return readFileSync(file, 'utf8')
  } catch {
    throw new ConfigError(`${name}_FILE is set but that file cannot be read`)
  }
}

/** A secret from the variable `name`, or else from its file. */
function secret(env: Record<string, string | undefined>, name: string): string {
  const direct = (env[name] ?? '').trim()
  if (direct) return direct
  return (fileOf(env, name) ?? '').trim()
}

/**
 * A list from the variable `name`, or else from its file, where commas, spaces and line ends
 * (LF or CRLF) all separate entries. An empty file is an empty list: nobody, as with no variable.
 */
function userList(env: Record<string, string | undefined>, name: string): Set<string> {
  if ((env[name] ?? '').trim()) return parseUserList(name, env[name])
  const text = fileOf(env, name)
  if (text === null) return new Set()
  return parseUserList(`${name}_FILE`, text.split(/[\s,]+/).join(','), false)
}

function int(name: string, raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw.trim() === '') return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < min || n > max) throw new ConfigError(`${name} must be a whole number from ${min} to ${max}; got "${raw}"`)
  return n
}

function validTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function loadConfig(env: Record<string, string | undefined> = process.env): TutorConfig {
  const provider = (env.TUTOR_PROVIDER ?? 'gemini').trim().toLowerCase() || 'gemini'
  if (provider !== 'gemini' && provider !== 'anthropic' && provider !== 'mock') {
    throw new ConfigError(`TUTOR_PROVIDER must be gemini, anthropic or mock; got "${env.TUTOR_PROVIDER}"`)
  }
  const thinking = (env.GEMINI_THINKING ?? 'low').trim().toLowerCase() || 'low'
  if (thinking !== 'low' && thinking !== 'medium' && thinking !== 'high' && thinking !== 'off') {
    throw new ConfigError(`GEMINI_THINKING must be low, medium, high or off; got "${env.GEMINI_THINKING}"`)
  }
  const timeZone = (env.TUTOR_TIMEZONE ?? '').trim() || 'America/New_York'
  if (!validTimeZone(timeZone)) throw new ConfigError(`TUTOR_TIMEZONE "${timeZone}" is not an IANA time zone`)
  const logDir = (env.TUTOR_LOG_DIR ?? '').trim() || null
  return {
    provider,
    geminiApiKey: secret(env, 'GEMINI_API_KEY'),
    geminiModel: (env.GEMINI_MODEL ?? '').trim() || DEFAULT_GEMINI_MODEL,
    geminiThinking: thinking,
    anthropicApiKey: secret(env, 'ANTHROPIC_API_KEY'),
    anthropicModel: (env.ANTHROPIC_MODEL ?? '').trim() || DEFAULT_ANTHROPIC_MODEL,
    dailyLimit: int('TUTOR_DAILY_LIMIT', env.TUTOR_DAILY_LIMIT, 30, 1, 1000),
    timeoutMs: int('TUTOR_TIMEOUT_MS', env.TUTOR_TIMEOUT_MS, 60_000, 5_000, 300_000),
    timeZone,
    logDir,
    allowedUsers: userList(env, 'ALLOWED_USERS'),
    parentUsers: userList(env, 'PARENT_USERS'),
    host: (env.HOST ?? '').trim() || '127.0.0.1',
    port: int('PORT', env.PORT, 3000, 1, 65535),
    mockDelayMs: int('TUTOR_MOCK_DELAY_MS', env.TUTOR_MOCK_DELAY_MS, 30, 0, 5000),
  }
}

/** One line for the start-up log. Never includes a key, only whether it is set. */
export function describeConfig(c: TutorConfig): string {
  const model = c.provider === 'gemini' ? c.geminiModel : c.provider === 'anthropic' ? c.anthropicModel : 'mock'
  const key = c.provider === 'gemini' ? c.geminiApiKey : c.provider === 'anthropic' ? c.anthropicApiKey : 'n/a'
  return [
    `provider=${c.provider}`,
    `model=${model}`,
    `key=${c.provider === 'mock' ? 'n/a' : key ? 'set' : 'MISSING'}`,
    `limit=${c.dailyLimit}/day`,
    `tz=${c.timeZone}`,
    `log=${c.logDir ? 'file' : 'memory'}`,
    `allowed=${c.allowedUsers.size}`,
    `parents=${c.parentUsers.size}`,
  ].join(' ')
}
