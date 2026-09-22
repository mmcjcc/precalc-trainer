/**
 * Rejects with an Error whose `code` is `code` when `promise` has not settled within `ms`.
 * Used to keep a stalled start-up step (a log directory on a mount that never answers) from
 * hanging the tutor: start-up then fails loudly instead of waiting forever.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, code = 'ETIMEDOUT'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`timed out after ${ms} ms`), { code })), ms)
  })
  return Promise.race([promise, expired]).finally(() => clearTimeout(timer))
}
