// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetKeypadForTests, useKeypadStore } from '@/components/keypadStore'
import { revealVerdictAboveKeypad } from './verdictReveal'

/** jsdom has no layout: each element gets the span the test gives it. */
function place(el: Element, top: number, bottom: number) {
  el.getBoundingClientRect = () => ({ top, bottom, left: 0, right: 360, width: 360, height: bottom - top, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
}

/** A part's card: its box, the verdict under it, the Stuck? chip under that. */
function part(box: [number, number], verdict: [number, number], chip?: [number, number]) {
  document.body.innerHTML = `
    <section>
      <h2>Part 1 of 2: x</h2>
      <form><input id="box" /><button type="submit">Check x</button>
        <div role="alert">Not quite</div>
        ${chip ? '<div data-stuck-chip=""><button>Stuck?</button></div>' : ''}
      </form>
    </section>`
  const el = document.getElementById('box') as HTMLInputElement
  place(el, ...box)
  place(document.querySelector('[role="alert"]')!, ...verdict)
  if (chip) place(document.querySelector('[data-stuck-chip]')!, ...chip)
  useKeypadStore.setState({ target: { id: 'k', el, keys: [], inputMode: 'text' }, height: 300 })
  return el
}

const scrollBy = vi.fn()

beforeEach(() => {
  resetKeypadForTests()
  scrollBy.mockReset()
  window.scrollBy = scrollBy as unknown as typeof window.scrollBy
  // A phone: 768 px tall; the keypad takes 300, so the band above it ends at 460.
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('after a Check on the keypad, the verdict under the part comes into view', () => {
  it('the box, the verdict and the chip all fit: just enough scroll to show them', () => {
    part([300, 348], [420, 600], [608, 644])
    revealVerdictAboveKeypad(null)
    expect(scrollBy).toHaveBeenCalledWith({ top: 644 - 460, behavior: 'smooth' })
  })

  it('a verdict too long to fit: the box at the top of the band (under the pinned strip), the verdict under it', () => {
    part([300, 348], [420, 1100])
    const strip = document.createElement('div')
    document.body.appendChild(strip)
    place(strip, 0, 52)
    revealVerdictAboveKeypad(strip)
    expect(scrollBy).toHaveBeenCalledWith({ top: 300 - 60, behavior: 'smooth' })
  })

  it('already on screen: no scroll', () => {
    part([100, 148], [200, 300])
    revealVerdictAboveKeypad(null)
    expect(scrollBy).not.toHaveBeenCalled()
  })

  it('the composer (docked on the keypad) has its own verdict line: no scroll', () => {
    const el = part([300, 348], [420, 600])
    const dock = document.createElement('div')
    dock.setAttribute('data-keypad-dock', '')
    el.parentElement!.insertBefore(dock, el)
    dock.appendChild(el)
    revealVerdictAboveKeypad(null)
    expect(scrollBy).not.toHaveBeenCalled()
  })

  it('no keypad, or the box on the phone keyboard (abc): nothing to do', () => {
    part([300, 348], [420, 600])
    useKeypadStore.setState({ height: 0 })
    revealVerdictAboveKeypad(null)
    useKeypadStore.setState({ height: 300, modes: { k: 'abc' } })
    revealVerdictAboveKeypad(null)
    expect(scrollBy).not.toHaveBeenCalled()
  })

  it('a part with no verdict yet (Check moved her to the next part): nothing to do', () => {
    part([300, 348], [420, 600])
    document.querySelector('[role="alert"]')!.remove()
    revealVerdictAboveKeypad(null)
    expect(scrollBy).not.toHaveBeenCalled()
  })
})
