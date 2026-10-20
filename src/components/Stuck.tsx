import { createContext, useContext, useEffect, type MouseEvent, type PointerEvent } from 'react'

/**
 * "Stuck?": help under her thumb on a phone. The problem frame provides the request (open the hint sheet and
 * take the next hint); a wrong verdict shows the chip under itself; a hint ladder takes the request as a press
 * of its own button. Only the nudge and the rule come that way: the rung that shows the step or the answer
 * waits in the sheet for her own tap, since it costs the first try.
 */
export interface StuckApi {
  /** Shows the chip where it is offered; null: no chip here (a wide screen, or the composer carries it). */
  onStuck: (() => void) | null
  /** Bumped by every Stuck? tap, so a ladder that is already on screen hears it too. */
  seq: number
  /** True once per Stuck? tap: the first ladder to ask takes the request. */
  take: () => boolean
}

const NONE: StuckApi = { onStuck: null, seq: 0, take: () => false }

const StuckContext = createContext<StuckApi>(NONE)

export const StuckProvider = StuckContext.Provider

/** A tap on the chip leaves focus where it was (the math box), so the keypad can come back after the sheet. */
const keepFocus = {
  onPointerDown: (e: PointerEvent) => e.preventDefault(),
  onMouseDown: (e: MouseEvent) => e.preventDefault(),
}

export function StuckButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      {...keepFocus}
      onClick={onClick}
      aria-haspopup="dialog"
      className="min-h-9 shrink-0 rounded-full border border-gold-text/30 bg-gold-100 px-3 text-sm font-semibold text-navy hover:bg-gold"
    >
      Stuck?
    </button>
  )
}

/** Under a wrong verdict: the chip, where the page offers it (a phone, a screen without a composer). */
export function StuckChip() {
  const { onStuck } = useContext(StuckContext)
  if (!onStuck) return null
  return (
    <div className="mt-2" data-stuck-chip="">
      <StuckButton onClick={onStuck} />
    </div>
  )
}

/**
 * For a hint ladder: take a pending Stuck? request as a press of the ladder's button, for the nudge (rung 1) and
 * the rule (rung 2) only. A request nobody takes is dropped when the hint sheet closes.
 */
export function useStuckRequest(rung: number, advance: () => void, disabled: boolean): void {
  const { seq, take } = useContext(StuckContext)
  useEffect(() => {
    if (!take()) return
    if (!disabled && rung < 2) advance()
    // Runs when the ladder mounts (the sheet opened) and on every new request; `take` answers once per tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rung/advance are read at the moment of the request
  }, [seq, take])
}
