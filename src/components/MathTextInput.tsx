import { useCallback, type InputHTMLAttributes, type Ref } from 'react'
import type { InputMode } from './keypadStore'
import type { StripKey } from './symbolStrip'
import { useMathKeypad } from './useMathKeypad'

/** What a box hands the math keypad: its context keys and, when they differ from them, its letters. */
export interface KeypadBox {
  /** The box's strip keys, or a `KEYPAD_SETS` entry for a box that never had a strip. */
  keys?: readonly StripKey[]
  /** Letters (x, y, n, …) when they are not the letters among `keys`. */
  vars?: readonly string[]
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'inputMode'> & {
  ref?: Ref<HTMLInputElement>
  inputMode?: InputMode
  /** Opt this box into the math keypad (touch screens only). Without it, an ordinary input. */
  keypad?: KeypadBox
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value)
  else if (ref) (ref as { current: T | null }).current = value
}

/**
 * A drop-in `<input>` for a math answer box. With `keypad`, on a touch screen it opens the math keypad
 * instead of the phone's keyboard (see `useMathKeypad`); everything else is passed straight through,
 * so value, onChange, Enter and the box's form behave exactly as before.
 */
export function MathTextInput({ ref, keypad, inputMode = 'text', disabled, onFocus, onBlur, onClick, ...rest }: Props) {
  const kp = useMathKeypad({ keys: keypad?.keys, vars: keypad?.vars, inputMode, disabled, enabled: keypad !== undefined })
  const keypadRef = kp.ref
  // Stable while the caller's ref is, so a ref object is not detached and re-attached on every render.
  const setRefs = useCallback(
    (el: HTMLInputElement | null) => {
      keypadRef(el)
      assignRef(ref, el)
    },
    [keypadRef, ref],
  )
  return (
    <input
      {...rest}
      ref={setRefs}
      disabled={disabled}
      inputMode={kp.inputMode}
      onFocus={(e) => {
        kp.onFocus()
        onFocus?.(e)
      }}
      onBlur={(e) => {
        kp.onBlur()
        onBlur?.(e)
      }}
      onClick={(e) => {
        kp.onClick()
        onClick?.(e)
      }}
    />
  )
}
