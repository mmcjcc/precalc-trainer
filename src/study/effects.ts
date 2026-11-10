/**
 * Study's share of the juice (components/juice): the chime for a right answer climbing with her
 * streak, the "nope" for a miss, and the party when a round ends. Sounds follow the Sounds switch
 * like everywhere else; confetti is nothing under reduced motion. What she must be able to see
 * without either (right or wrong, and the right answer) is drawn by the modes themselves.
 */
import { burstConfetti } from '@/components/juice/Confetti'
import { playCue, soundsOn, type Cue } from '@/components/juice/sounds'
import { chimeStep } from '@/session/combo'
import { useStore } from '@/store'

function cue(c: Cue, step = 0): void {
  if (soundsOn(useStore.getState().settings)) playCue(c, { step })
}

/** A right answer, the `streak`-th in a row. */
export function soundRight(streak: number): void {
  cue('right', chimeStep(streak))
}

export function soundWrong(): void {
  cue('slip')
}

/** The end of a round: a fanfare and confetti, bigger for a clean one. */
export function celebrateRound(clean: boolean): void {
  cue('fanfare')
  burstConfetti(clean ? { y: 0.22, count: 64 } : { y: 0.22 })
}

/** How long a right answer stays on screen before the next card. */
export const RIGHT_PAUSE_MS = 900
/** How long a matched pair shows green before it leaves the board. */
export const MATCH_PAUSE_MS = 420
