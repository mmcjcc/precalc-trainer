/**
 * Entry point of the tutor sidecar (bundled by server/build.mjs into server/dist/tutor.mjs).
 * Listens on 127.0.0.1:3000 inside the Container App replica; nginx proxies /api/ to it.
 */
import { createServer } from 'node:http'
import { createHandler } from './app.ts'
import { ConfigError, describeConfig, loadConfig, type TutorConfig } from './config.ts'
import { DailyLimiter } from './limits.ts'
import { TutorLog } from './log.ts'
import { makeProvider } from './providers/index.ts'
import { ProviderError } from './providers/types.ts'
import { withTimeout } from './timeout.ts'

/** How long the log directory may take to answer at start-up (an Azure Files mount can stall). */
const LOG_INIT_TIMEOUT_MS = 15_000

async function main(): Promise<void> {
  // Until the server is up, a stop signal ends the process at once: there is nothing to flush yet,
  // and a stalled start-up step must never leave the container unkillable (as PID 1 without a
  // handler, node would ignore SIGTERM). Replaced by the graceful shutdown once listening.
  let onSignal: (signal: string) => void = (signal) => {
    console.log(`tutor: ${signal} during start-up, exiting`)
    process.exit(1)
  }
  process.on('SIGTERM', () => onSignal('SIGTERM'))
  process.on('SIGINT', () => onSignal('SIGINT'))

  let config: TutorConfig
  try {
    config = loadConfig()
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`tutor: configuration error: ${err.message}`)
      process.exit(1)
    }
    throw err
  }
  console.log(`tutor: starting ${describeConfig(config)}`)
  if (config.allowedUsers.size === 0) console.warn('tutor: ALLOWED_USERS is empty, so every request is refused (fail closed)')
  for (const p of config.parentUsers) {
    if (!config.allowedUsers.has(p)) console.warn('tutor: a PARENT_USERS entry is not in ALLOWED_USERS, so it cannot reach the log')
  }

  const log = new TutorLog({
    dir: config.logDir,
    timeZone: config.timeZone,
    onWriteError: (code) => console.error(`tutor: log write failed (${code})`),
  })
  try {
    await withTimeout(log.init(), LOG_INIT_TIMEOUT_MS)
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : 'unknown'
    console.error(`tutor: cannot write the log directory TUTOR_LOG_DIR (${code}); refusing to run without the parent's log`)
    process.exit(1)
  }
  if (log.skippedLines) console.warn(`tutor: skipped ${log.skippedLines} unreadable log line(s)`)
  if (!config.logDir) console.warn('tutor: TUTOR_LOG_DIR is not set, so questions are logged in memory only')

  const limiter = new DailyLimiter(config.dailyLimit, () => log.today(), log.countsFor(log.today()))
  const provider = makeProvider(config)
  const server = createServer(
    createHandler({
      allowedUsers: config.allowedUsers,
      parentUsers: config.parentUsers,
      timeoutMs: config.timeoutMs,
      provider,
      log,
      limiter,
    }),
  )
  server.listen(config.port, config.host, () => {
    console.log(`tutor: ready on http://${config.host}:${config.port}`)
  })

  // The key check runs after listening so a slow provider never delays start-up. deploy/azure-setup.sh
  // looks for these lines in the container log.
  if (provider.name !== 'mock') {
    if (!provider.configured) console.error(`tutor: key check FAILED (${provider.name}: no API key)`)
    else {
      provider.check().then(
        () => console.log(`tutor: key check ok (${provider.name}, ${provider.model})`),
        (err: unknown) => console.error(`tutor: key check FAILED (${provider.name}: ${err instanceof ProviderError ? err.code : 'unknown'})`),
      )
    }
  }

  const shutdown = (signal: string) => {
    console.log(`tutor: ${signal}, shutting down`)
    server.close()
    void log.flush().then(() => process.exit(0))
    setTimeout(() => process.exit(0), 5000).unref()
  }
  onSignal = shutdown
}

void main()
