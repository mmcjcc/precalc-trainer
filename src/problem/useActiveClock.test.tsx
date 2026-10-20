// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDLE_CAP_MS, useActiveClock } from './useIdleNudge'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useActiveClock', () => {
  it('counts thinking time, but not a screen left on with nobody touching it', () => {
    const got: number[] = []
    const { result } = renderHook(() => useActiveClock(true, (s) => got.push(s), 15))
    // Twenty minutes on the screen without a touch: only the first three count.
    act(() => {
      vi.advanceTimersByTime(20 * 60_000)
    })
    const counted = got.reduce((a, b) => a + b, 0) + result.current()
    expect(counted).toBe(IDLE_CAP_MS / 1000)
  })

  it('starts counting again at her next tap', () => {
    const got: number[] = []
    const { result } = renderHook(() => useActiveClock(true, (s) => got.push(s), 15))
    act(() => {
      vi.advanceTimersByTime(10 * 60_000)
    })
    act(() => {
      window.dispatchEvent(new Event('pointerdown'))
      vi.advanceTimersByTime(60_000)
    })
    const counted = got.reduce((a, b) => a + b, 0) + result.current()
    expect(counted).toBe(IDLE_CAP_MS / 1000 + 60)
  })
})
