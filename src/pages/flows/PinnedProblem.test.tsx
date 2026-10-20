// @vitest-environment jsdom
import { render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PinnedProblemStrip, pinnedSummary, useScrolledPast } from './PinnedProblem'

describe('pinnedSummary: the problem in one line', () => {
  it('a statement that is math becomes KaTeX', () => {
    expect(pinnedSummary('2x + 8 > 10', ['x'])).toEqual({ tex: '2x+8 > 10', text: '2x + 8 > 10' })
    expect(pinnedSummary('7^(x + 2) = 2^x', ['x']).tex).toBe('7^{x+2} = 2^{x}')
    expect(pinnedSummary('x < -8 or -4 <= x < 0 or x >= 4', ['x']).tex).toContain('\\text{ or }')
    expect(pinnedSummary('log_8(16)', ['x']).tex).toBe('\\log_{8}\\left(16\\right)')
  })

  it('two definitions side by side, and a function the parser does not know by name', () => {
    expect(pinnedSummary('f(x) = x^2 + 4, g(x) = 3x - 2', ['x']).tex).toBe('f(x) = x^{2}+4,\\;\\; g(x) = 3x-2')
    expect(pinnedSummary('h(x) = 1/(-4x)^2', ['x']).tex).toBe('h(x) = \\frac{1}{\\left(-4x\\right)^{2}}')
  })

  it('a point or an interval is never split at its comma', () => {
    expect(pinnedSummary('(-2, 4]', ['x']).tex).toBeNull()
    expect(pinnedSummary('(-2, 4]', ['x']).text).toBe('(-2, 4]')
  })

  it('words become their first sentence', () => {
    expect(pinnedSummary('$5,500 is invested at 7.75% interest compounded continuously. How much is in the account after 6 years?', ['x'])).toEqual({
      tex: null,
      text: '$5,500 is invested at 7.75% interest compounded continuously.',
    })
    expect(pinnedSummary('170.43 cm × 5.75 cm', ['x'])).toEqual({ tex: null, text: '170.43 cm × 5.75 cm' })
    expect(pinnedSummary('Name the ion N³⁻.', ['x']).text).toBe('Name the ion N³⁻.')
  })
})

describe('useScrolledPast', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is false without IntersectionObserver (an old browser): no strip at all', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const el = document.createElement('div')
    const { result } = renderHook(() => useScrolledPast({ current: el }, true))
    expect(result.current).toBe(false)
  })

  it('watches under the strip and the status bar, and stops when it is switched off', () => {
    const observe = vi.fn()
    const disconnect = vi.fn()
    let options: IntersectionObserverInit | undefined
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(_cb: IntersectionObserverCallback, o?: IntersectionObserverInit) {
          options = o
        }
        observe = observe
        disconnect = disconnect
      },
    )
    const el = document.createElement('div')
    const { rerender } = renderHook(({ on }) => useScrolledPast({ current: el }, on), { initialProps: { on: true } })
    expect(observe).toHaveBeenCalledWith(el)
    expect(options?.rootMargin).toBe('-48px 0px 0px 0px')
    rerender({ on: false })
    expect(disconnect).toHaveBeenCalled()
  })
})

describe('PinnedProblemStrip', () => {
  it('math as KaTeX; a figure problem says "Show the figure"', () => {
    const onShow = vi.fn()
    const view = render(<PinnedProblemStrip summary={{ tex: '2x+8 > 10', text: '2x + 8 > 10' }} figure={false} onShow={onShow} />)
    const strip = screen.getByRole('button', { name: 'Show the problem: 2x + 8 > 10' })
    expect(strip.querySelector('.katex')).toBeTruthy()
    strip.click()
    expect(onShow).toHaveBeenCalledTimes(1)
    expect(view.container.querySelector('.pinned-problem')?.className).toContain('fixed')
    view.unmount()
    render(<PinnedProblemStrip summary={{ tex: null, text: 'BD bisects ∠ABC.' }} figure onShow={onShow} />)
    expect(screen.getByRole('button', { name: 'BD bisects ∠ABC. Show the figure' }).textContent).toBe('BD bisects ∠ABC.Show the figure')
  })
})
