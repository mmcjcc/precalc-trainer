import { useRef, type KeyboardEvent } from 'react'
import { CHIP_LABEL, type ChipId } from '@/shared/types'
import { CHIP_ORDER } from '@/problem/stepEngine'

type Props = {
  onPick: (chip: ChipId) => void
  onSkip: () => void
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

/**
 * "Which property justified that step?" — inline, non-blocking (UX-08). role="radiogroup" with
 * arrow-key movement; digits 1–9/0 are handled by the page keymap; Tab/Esc skip.
 */
export function PropertyChips({ onPick, onSkip }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKey(e: KeyboardEvent<HTMLElement>, i: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      refs.current[(i + 1) % CHIP_ORDER.length]?.focus()
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      refs.current[(i - 1 + CHIP_ORDER.length) % CHIP_ORDER.length]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onSkip()
    }
  }

  return (
    <div className="rounded-xl border border-gold bg-gold-100 p-3" onBlur={undefined}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-navy" id="chip-question">
          Which property justified that step?
        </p>
        <button type="button" onClick={onSkip} className="min-h-9 rounded-lg px-2 text-sm text-navy/70 underline hover:text-navy">
          Skip (Tab)
        </button>
      </div>
      <div role="radiogroup" aria-labelledby="chip-question" className="flex flex-wrap gap-2">
        {CHIP_ORDER.map((chip, i) => (
          <button
            key={chip}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={false}
            onClick={() => onPick(chip)}
            onKeyDown={(e) => onKey(e, i)}
            className="min-h-10 rounded-full border border-navy-100 bg-white px-3 text-sm text-navy hover:bg-navy hover:text-white focus-visible:bg-navy focus-visible:text-white"
          >
            {DIGITS[i] && <span className="mr-1 text-xs opacity-60">{DIGITS[i]}</span>}
            {CHIP_LABEL[chip]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-navy/60">Never counts against you. Enter, Tab, or typing the next line skips it.</p>
    </div>
  )
}
