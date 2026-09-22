// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTutorStatus } from './useTutorStatus'

const OK = { configured: true, provider: 'mock', model: 'mock', limit: 30, remaining: 30, isParent: false, logging: 'memory' }
const offline = () => new Response(JSON.stringify({ error: 'tutor offline' }), { status: 503 })
const online = () => new Response(JSON.stringify(OK), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('useTutorStatus', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('retries while the sidecar is still starting, then shows the tutor', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(offline()).mockResolvedValueOnce(online())
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useTutorStatus())
    await act(async () => {})
    expect(result.current).toEqual({ ready: true, status: null })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.status?.configured).toBe(true)
  })

  it('stops after the last retry when there is no tutor at all', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => offline())
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useTutorStatus())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(result.current.status).toBeNull()
  })

  it('does not retry after a success', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => online())
    vi.stubGlobal('fetch', fetchMock)
    renderHook(() => useTutorStatus())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
