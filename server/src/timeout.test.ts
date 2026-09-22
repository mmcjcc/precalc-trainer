import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withTimeout } from './timeout.ts'

describe('withTimeout', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('passes a value through when the promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve(7), 1000)).resolves.toBe(7)
  })

  it('passes a rejection through unchanged', async () => {
    const err = Object.assign(new Error('nope'), { code: 'EACCES' })
    await expect(withTimeout(Promise.reject(err), 1000)).rejects.toBe(err)
  })

  it('rejects with the given code when the promise never settles', async () => {
    const pending = withTimeout(new Promise<never>(() => {}), 15_000)
    const assertion = expect(pending).rejects.toMatchObject({ code: 'ETIMEDOUT' })
    await vi.advanceTimersByTimeAsync(15_000)
    await assertion
  })
})
