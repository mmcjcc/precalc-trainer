import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerSetEndBreak, setEndBreak } from './breaks'

let unregister: (() => void) | null = null

afterEach(() => {
  unregister?.()
  unregister = null
})

describe('setEndBreak: the one break of a set', () => {
  it('with nothing registered (this repo shows no ads) shows the results at once', () => {
    const go = vi.fn()
    setEndBreak(go, { timed: false })
    expect(go).toHaveBeenCalledTimes(1)
  })

  it('a registered break is told about the set and decides when the results show; they show once', () => {
    let close: (() => void) | null = null
    const shown = vi.fn((go: () => void) => {
      close = go
    })
    unregister = registerSetEndBreak(shown)
    const go = vi.fn()
    setEndBreak(go, { timed: true })
    expect(shown).toHaveBeenCalledTimes(1)
    expect(shown).toHaveBeenCalledWith(expect.any(Function), { timed: true })
    expect(go).not.toHaveBeenCalled()
    close!()
    close!()
    expect(go).toHaveBeenCalledTimes(1)
  })

  it('a break that throws still shows the results', () => {
    unregister = registerSetEndBreak(() => {
      throw new Error('no ad today')
    })
    const go = vi.fn()
    expect(() => setEndBreak(go, { timed: false })).not.toThrow()
    expect(go).toHaveBeenCalledTimes(1)
  })

  it('a break that shows the results and then throws shows them once', () => {
    unregister = registerSetEndBreak((go) => {
      go()
      throw new Error('late failure')
    })
    const go = vi.fn()
    setEndBreak(go, { timed: false })
    expect(go).toHaveBeenCalledTimes(1)
  })

  it('removing the break puts the default back; removing an older one keeps the newer', () => {
    const first = vi.fn()
    const second = vi.fn((go: () => void) => go())
    const removeFirst = registerSetEndBreak(first)
    unregister = registerSetEndBreak(second)
    removeFirst()
    const go = vi.fn()
    setEndBreak(go, { timed: false })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    expect(go).toHaveBeenCalledTimes(1)
    unregister()
    unregister = null
    const again = vi.fn()
    setEndBreak(again, { timed: false })
    expect(second).toHaveBeenCalledTimes(1)
    expect(again).toHaveBeenCalledTimes(1)
  })
})
