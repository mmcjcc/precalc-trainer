// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from '@/pages/Settings'
import { resetStoreForTests, useStore } from '@/store'
import { Composer } from './Composer'
import { resetKeypadForTests } from './keypadStore'
import { focusBox, installPointer, keypad, queryKeypad, removePointer, settle, tap, tapBox, typeOnKeypad } from './keypadTesting'
import { MathInput } from './MathInput'
import { MathKeypad } from './MathKeypad'
import { MathTextInput } from './MathTextInput'
import { LOG_KEYS, type StripKey } from './symbolStrip'

function Line({ onSubmit, stripKeys, disabled }: { onSubmit?: () => void; stripKeys?: readonly StripKey[]; disabled?: boolean }) {
  const [value, setValue] = useState('')
  return <MathInput value={value} onChange={setValue} onSubmit={onSubmit} label="Next line" stripKeys={stripKeys} disabled={disabled} />
}

function Box({ label, keys, onEnter }: { label: string; keys?: readonly StripKey[]; onEnter?: () => void }) {
  const [value, setValue] = useState('')
  return (
    <MathTextInput
      aria-label={label}
      keypad={{ keys }}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={
        onEnter
          ? (e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onEnter()
              }
            }
          : undefined
      }
    />
  )
}

function renderWithKeypad(ui: ReactNode) {
  return render(
    <>
      <MathKeypad />
      {ui}
    </>,
  )
}

const line = () => screen.getByRole('textbox', { name: 'Next line' }) as HTMLInputElement
const strip = () => screen.queryByRole('toolbar', { name: 'Math symbols' })

beforeEach(() => {
  resetStoreForTests()
  resetKeypadForTests()
  installPointer(true)
})

afterEach(() => {
  removePointer()
  vi.restoreAllMocks()
})

describe('on a touch screen (coarse pointer)', () => {
  it('a math box opens the keypad instead of the phone keyboard, and its strip is gone', () => {
    renderWithKeypad(<Line />)
    expect(line().getAttribute('inputmode')).toBe('none')
    expect(strip()).toBeNull()
    expect(queryKeypad()).toBeNull()
    tapBox(line())
    const pad = keypad()
    for (const name of ['times', 'divide', 'power', 'square root', 'delete', 'left', 'right', 'check', 'abc keyboard', 'hide keypad']) {
      expect(within(pad).getByRole('button', { name })).toBeTruthy()
    }
    for (const d of '0123456789') expect(within(pad).getByRole('button', { name: d })).toBeTruthy()
    // Keys are buttons out of the tab order: keyboard users never land on them.
    for (const b of within(pad).getAllByRole('button')) expect(b.getAttribute('tabindex')).toBe('-1')
  })

  it('a box the page focuses on its own (autofocus) keeps the caret but waits for a tap, like the phone keyboard', () => {
    function Auto() {
      const [value, setValue] = useState('')
      return <MathInput value={value} onChange={setValue} label="Next line" autoFocus />
    }
    renderWithKeypad(<Auto />)
    expect(document.activeElement).toBe(line())
    expect(line().getAttribute('inputmode')).toBe('none')
    expect(queryKeypad()).toBeNull()
    fireEvent.click(line())
    expect(keypad()).toBeTruthy()
  })

  it('keys insert at the caret, and replace a selection', () => {
    renderWithKeypad(<Line />)
    const box = line()
    tapBox(box)
    typeOnKeypad('7x^2')
    expect(box.value).toBe('7x^2')
    box.setSelectionRange(1, 1)
    tap('times')
    expect(box.value).toBe('7*x^2')
    expect(box.selectionStart).toBe(2)
    box.setSelectionRange(2, 5)
    tap('square root')
    expect(box.value).toBe('7*sqrt(x^2)')
    expect(box.selectionStart).toBe(10)
    box.setSelectionRange(0, 1)
    tap('4')
    expect(box.value).toBe('4*sqrt(x^2)')
  })

  it('the power and squared keys, and a function key that lands inside its parentheses', () => {
    renderWithKeypad(<Line stripKeys={LOG_KEYS} />)
    const box = line()
    tapBox(box)
    tap('x')
    tap('squared')
    tap('plus')
    tap('3')
    tap('power')
    tap('x')
    expect(box.value).toBe('x^2+3^x')
    tap('equals')
    tap('natural log')
    expect(box.value).toBe('x^2+3^x = ln()')
    expect(box.selectionStart).toBe(box.value.length - 1)
    tap('7')
    tap('right')
    tap('divide')
    tap('2')
    expect(box.value).toBe('x^2+3^x = ln(7)/2')
    // The line's own preview reads what the keypad typed.
    expect(screen.getByLabelText('Preview')).toBeTruthy()
  })

  it('backspace deletes one key, caret left and right move one place', () => {
    renderWithKeypad(<Line stripKeys={LOG_KEYS} />)
    const box = line()
    tapBox(box)
    typeOnKeypad('123')
    tap('left')
    expect(box.selectionStart).toBe(2)
    tap('delete')
    expect(box.value).toBe('13')
    expect(box.selectionStart).toBe(1)
    tap('right')
    expect(box.selectionStart).toBe(2)
    tap('delete')
    expect(box.value).toBe('1')
    tap('equals')
    expect(box.value).toBe('1 = ')
    tap('delete')
    expect(box.value).toBe('1')
    tap('log base 10')
    expect(box.value).toBe('1log()')
    tap('delete')
    expect(box.value).toBe('1')
    tap('delete')
    tap('delete')
    expect(box.value).toBe('')
  })

  it('holding delete keeps deleting; the click that ends the hold adds nothing', () => {
    renderWithKeypad(<Line />)
    const box = line()
    tapBox(box)
    typeOnKeypad('12345')
    vi.useFakeTimers()
    try {
      const del = within(keypad()).getByRole('button', { name: 'delete' })
      fireEvent.pointerDown(del)
      act(() => {
        vi.advanceTimersByTime(450 + 2 * 70)
      })
      fireEvent.pointerUp(del)
      fireEvent.click(del)
      expect(box.value).toBe('12')
      // An ordinary tap is one delete.
      fireEvent.pointerDown(del)
      fireEvent.pointerUp(del)
      fireEvent.click(del)
      expect(box.value).toBe('1')
    } finally {
      vi.useRealTimers()
    }
  })

  it('Check does what Enter does: the box’s form is submitted', () => {
    const onSubmit = vi.fn()
    renderWithKeypad(<Line onSubmit={onSubmit} />)
    tapBox(line())
    typeOnKeypad('3x<=9')
    tap('check')
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('Check goes to the box’s own Enter handler first, and a form whose button is disabled does nothing', () => {
    const onEnter = vi.fn()
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    renderWithKeypad(
      <form onSubmit={onSubmit}>
        <Box label="Own Enter" onEnter={onEnter} />
        <Box label="Plain" />
        <button type="submit">Go</button>
      </form>,
    )
    tapBox(screen.getByRole('textbox', { name: 'Own Enter' }))
    tap('check')
    expect(onEnter).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
    tapBox(screen.getByRole('textbox', { name: 'Plain' }))
    tap('check')
    expect(onSubmit).toHaveBeenCalledTimes(1)
    const button = screen.getByRole('button', { name: 'Go' }) as HTMLButtonElement
    button.disabled = true
    tap('check')
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('abc switches this box to the phone keyboard; 123 brings the keypad back', () => {
    renderWithKeypad(
      <>
        <Line />
        <Box label="Other" />
      </>,
    )
    const box = line()
    tapBox(box)
    typeOnKeypad('x')
    box.setSelectionRange(0, 0)
    tap('abc keyboard')
    expect(box.getAttribute('inputmode')).toBe('text')
    expect(document.activeElement).toBe(box)
    expect(box.selectionStart).toBe(0)
    expect(queryKeypad()).toBeNull()
    // Typing words on the phone keyboard is an ordinary change.
    fireEvent.change(box, { target: { value: 'no solution' } })
    expect(box.value).toBe('no solution')
    // Only this box: another math box still opens the keypad.
    const other = screen.getByRole('textbox', { name: 'Other' })
    expect(other.getAttribute('inputmode')).toBe('none')
    tapBox(other)
    expect(keypad()).toBeTruthy()
    tapBox(box)
    expect(queryKeypad()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'show math keypad' }))
    expect(box.getAttribute('inputmode')).toBe('none')
    expect(document.activeElement).toBe(box)
    expect(keypad()).toBeTruthy()
  })

  it('hide closes the keypad; tapping the box opens it again', async () => {
    renderWithKeypad(<Line />)
    tapBox(line())
    tap('hide keypad')
    await settle()
    expect(document.activeElement).not.toBe(line())
    expect(queryKeypad()).toBeNull()
    tapBox(line())
    expect(keypad()).toBeTruthy()
  })

  it('one keypad for every box: moving to another box swaps the context row', async () => {
    const ln = LOG_KEYS.find((k) => k.label === 'ln')!
    const deg: StripKey = { label: '°', insert: '°', caret: 0, name: 'degrees' }
    renderWithKeypad(
      <>
        <Box label="Log box" keys={[ln]} />
        <Box label="Angle box" keys={[deg]} />
      </>,
    )
    tapBox(screen.getByRole('textbox', { name: 'Log box' }))
    expect(within(keypad()).getByRole('button', { name: 'natural log' })).toBeTruthy()
    tapBox(screen.getByRole('textbox', { name: 'Angle box' }))
    await settle()
    expect(screen.getAllByRole('group', { name: 'Math keypad' })).toHaveLength(1)
    expect(within(keypad()).queryByRole('button', { name: 'natural log' })).toBeNull()
    tap('4')
    tap('5')
    tap('degrees')
    expect((screen.getByRole('textbox', { name: 'Angle box' }) as HTMLInputElement).value).toBe('45°')
    expect((screen.getByRole('textbox', { name: 'Log box' }) as HTMLInputElement).value).toBe('')
  })

  it('leaving the math boxes closes the keypad', async () => {
    renderWithKeypad(
      <>
        <Line />
        <button type="button">Elsewhere</button>
      </>,
    )
    tapBox(line())
    expect(keypad()).toBeTruthy()
    focusBox(screen.getByRole('button', { name: 'Elsewhere' }))
    await settle()
    expect(queryKeypad()).toBeNull()
  })

  it('a disabled box never opens the keypad', () => {
    renderWithKeypad(<Line disabled />)
    tapBox(line())
    expect(queryKeypad()).toBeNull()
    expect(line().getAttribute('inputmode')).toBe('text')
  })

  it('reserves room for the keypad and scrolls the box into view above it', async () => {
    const scrollBy = vi.fn()
    window.scrollBy = scrollBy as unknown as typeof window.scrollBy
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const rect = (top: number, bottom: number) => ({ top, bottom, height: bottom - top, left: 0, right: 360, width: 360, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
      if (this.classList.contains('math-keypad')) return rect(468, 768)
      if (this.tagName === 'INPUT') return rect(600, 648)
      if (this.tagName === 'FORM') return rect(560, 700)
      return rect(0, 0)
    })
    renderWithKeypad(<Line />)
    tapBox(line())
    expect(document.documentElement.style.getPropertyValue('--keypad-h')).toBe('300px')
    // innerHeight 768 − keypad 300 − margin 8 = 460: the form's end (700) scrolls up to it.
    expect(scrollBy).toHaveBeenCalledWith({ top: 240, behavior: 'smooth' })
    tap('hide keypad')
    await settle()
    expect(document.documentElement.style.getPropertyValue('--keypad-h')).toBe('')
  })

  it('a box under the work is kept above the composer docked on top of the keypad', () => {
    const scrollBy = vi.fn()
    window.scrollBy = scrollBy as unknown as typeof window.scrollBy
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const rect = (top: number, bottom: number) => ({ top, bottom, height: bottom - top, left: 0, right: 360, width: 360, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
      if (this.classList.contains('math-keypad')) return rect(468, 768)
      if (this.hasAttribute('data-keypad-dock')) return rect(318, 468)
      if (this.getAttribute('aria-label') === 'Answer') return rect(400, 448)
      if (this.tagName === 'FORM' && this.querySelector('[aria-label="Answer"]')) return rect(380, 460)
      return rect(0, 0)
    })
    renderWithKeypad(
      <>
        <form>
          <Box label="Answer" />
          <button type="submit">Check the answer</button>
        </form>
        <Composer>
          <Line />
        </Composer>
      </>,
    )
    tapBox(screen.getByRole('textbox', { name: 'Answer' }))
    // Above the keypad (768 − 300 − 8 = 460) and above the 150 px composer docked on it: 310.
    expect(scrollBy).toHaveBeenCalledWith({ top: 150, behavior: 'smooth' })
  })

  it('the composer sits on top of the keypad, and a Check there scrolls to her newest line', async () => {
    const scrollTo = vi.fn()
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo
    window.scrollBy = vi.fn() as unknown as typeof window.scrollBy
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 2000 })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const height = this.classList.contains('math-keypad') ? 300 : 0
      return { top: 768 - height, bottom: 768, height, left: 0, right: 360, width: 360, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
    })
    const onSubmit = vi.fn()
    renderWithKeypad(
      <Composer>
        <Line onSubmit={onSubmit} />
      </Composer>,
    )
    expect(line().closest('[data-keypad-scroll="end"]')?.className).toContain('composer-sticky')
    tapBox(line())
    tap('check')
    expect(onSubmit).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 2000 - window.innerHeight, behavior: 'smooth' }))
    delete (document.documentElement as { scrollHeight?: number }).scrollHeight
  })
})

describe('everywhere else nothing changes', () => {
  it('a fine pointer (mouse) keeps the phone keyboard mode, the strip, and no keypad', () => {
    installPointer(false)
    renderWithKeypad(<Line />)
    expect(line().getAttribute('inputmode')).toBe('text')
    expect(strip()).toBeTruthy()
    tapBox(line())
    expect(queryKeypad()).toBeNull()
  })

  it('no matchMedia at all (old browsers, tests) is a fine pointer', () => {
    removePointer()
    renderWithKeypad(<Line />)
    expect(line().getAttribute('inputmode')).toBe('text')
    expect(strip()).toBeTruthy()
  })

  it('without a keypad mounted, a touch screen keeps the keyboard and the strip', () => {
    render(<Line />)
    expect(line().getAttribute('inputmode')).toBe('text')
    expect(strip()).toBeTruthy()
  })

  it('a box that did not opt in stays an ordinary input', () => {
    renderWithKeypad(<MathTextInput aria-label="Words" value="" onChange={() => {}} />)
    const words = screen.getByRole('textbox', { name: 'Words' })
    expect(words.getAttribute('inputmode')).toBe('text')
    tapBox(words)
    expect(queryKeypad()).toBeNull()
  })
})

describe('the Settings switch', () => {
  function renderSettings() {
    return render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )
  }

  it('on a touch screen: "Math keypad", on by default; off gives the keyboard and the strip back', () => {
    renderSettings()
    const sw = screen.getByRole('switch', { name: 'Math keypad' })
    expect(sw.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(sw)
    expect(useStore.getState().settings.mathKeypad).toBe(false)
    expect(sw.getAttribute('aria-checked')).toBe('false')

    renderWithKeypad(<Line />)
    expect(line().getAttribute('inputmode')).toBe('text')
    expect(strip()).toBeTruthy()
    tapBox(line())
    expect(queryKeypad()).toBeNull()

    act(() => {
      fireEvent.click(screen.getByRole('switch', { name: 'Math keypad' }))
    })
    expect(useStore.getState().settings.mathKeypad).toBe(true)
    expect(line().getAttribute('inputmode')).toBe('none')
    expect(strip()).toBeNull()
  })

  it('with a mouse there is no keypad, so no switch', () => {
    installPointer(false)
    renderSettings()
    expect(screen.queryByRole('switch', { name: 'Math keypad' })).toBeNull()
    expect(screen.getByRole('switch', { name: 'Test mode' })).toBeTruthy()
  })
})
