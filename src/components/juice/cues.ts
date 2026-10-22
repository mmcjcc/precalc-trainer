/**
 * Which sounds a moment makes (pure; useJuice.ts gathers the facts, sounds.ts plays them). One main sound for what she
 * just did, then the rewards' extras after it:
 * - a problem finished: the arpeggio (it outranks the chime of the line or part that finished it);
 * - a daily chest opened (components/quests): the chest's thunk, glide and shower;
 * - else a slip (a rejected line or card, a wrong check): the "nope" (a check that was partly wrong is a slip), or the
 *   "gotcha" when the slip is a mistake she never made before (its monster is caught: a catch is a win, not a slip);
 * - else a right line or part: the chime, one step higher per answer in a row (the combo, session/combo.ts);
 * - then a squashed mistake: a pop (rewards on or off: its monster is squashed); today's goal met or a streak
 *   milestone: a sparkle.
 * A revealed line ("Show the step") and a hint make no sound. Drill answers are neither lines nor parts: silent.
 */
import { chimeStep } from '@/session/combo'
import type { Ev } from '@/store'
import { cueLength, type Cue } from './sounds'

export interface MomentFacts {
  /** The events she just added (in log order). */
  added: readonly Ev[]
  /** The combo after them. */
  combo: number
  /** Rewards on: these events took today's XP to the goal (or the double goal). */
  goalReached: boolean
  /** Mistakes these events squashed (their monsters; rewards on or off). */
  squashed: number
  /** Rewards on: these events took the streak to a milestone not celebrated before. */
  milestone: boolean
  /** Mistakes these events named for the first time ever (monsters caught; components/monsters). */
  caught?: number
}

export interface PlannedCue {
  cue: Cue
  step: number
  /** Seconds after now. */
  delay: number
}

/** A small gap after a cue before the next one starts. */
const GAP = 0.04

export function cuesFor(facts: MomentFacts): PlannedCue[] {
  const out: PlannedCue[] = []
  let t = 0
  const push = (cue: Cue, step = 0) => {
    out.push({ cue, step, delay: t })
    // The chime and the nope are short; let the extras ring out after the start of a long one.
    t += Math.min(cueLength(cue), 0.5) + GAP
  }
  const finished = facts.added.some((e) => e.t === 'problem_done')
  const slip = facts.added.some((e) => e.t === 'step_rejected' || (e.t === 'final_answer' && !e.correct))
  const right = facts.added.some((e) => (e.t === 'step_accepted' && !e.revealed) || (e.t === 'final_answer' && e.correct))
  const chest = facts.added.some((e) => e.t === 'chest_opened')
  if (finished) push('finish')
  else if (chest) push('chest')
  else if (slip) push((facts.caught ?? 0) > 0 ? 'catch' : 'slip')
  else if (right) push('right', chimeStep(facts.combo))
  if (facts.squashed > 0) push('pop')
  if (facts.goalReached || facts.milestone) push('sparkle')
  return out
}
