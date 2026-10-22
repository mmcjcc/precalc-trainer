import { useEffect, useRef } from 'react'
import { burstConfetti } from '@/components/juice/Confetti'
import { CountUp } from '@/components/juice/CountUp'
import { cueLength, playCue, soundsOn } from '@/components/juice/sounds'
import { QuestNewsBlock } from '@/components/quests/Quests'
import type { QuestNews } from '@/components/quests/useQuests'
import { goalCaption } from '@/components/rewards/Finish'
import { GoalRing, SkillRing } from '@/components/rewards/Rings'
import { MonsterArt } from '@/components/monsters/MonsterArt'
import { patternTitle, RING_WORD, skillTitle } from '@/components/rewards/words'
import { outcomeWords, type SetLine, type SetOutcome, type SetRewards } from '@/session/summary'
import { useStore, type TodayView } from '@/store'

/** Shape, not only color: a filled check, a plain check, a dashed ring for skipped. */
function OutcomeMark({ outcome }: { outcome: SetOutcome }) {
  const base = 'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold'
  if (outcome.kind === 'firstTry') return <span aria-hidden className={`${base} bg-ok text-white`}>✓</span>
  if (outcome.kind === 'skipped') return <span aria-hidden className={`${base} border-2 border-dashed border-navy/60 text-navy/70`}>–</span>
  if (outcome.kind === 'open') return <span aria-hidden className={`${base} border-2 border-navy/30 text-navy/70`}>·</span>
  return <span aria-hidden className={`${base} bg-navy text-white`}>✓</span>
}

/**
 * The end of a set, after "See results": a big check, "Set done", each problem with how it went, and with rewards on
 * the set's XP (counting up from 0), today's goal ring (sweeping from before the set), the problem-type rings that
 * moved and the mistakes it squashed, the daily quests it moved and the chest when they are all done (components/quests:
 * opened here, after the set's break). A small party when it appears: confetti (not under reduced motion) and, with
 * Sounds on, a fanfare (then the quest cue when it finished a quest); rewards on or off. One big "Another set" and
 * "Done". It does not know the screen size: one column that the page centers.
 */
export function SetSummary({
  lines,
  rewards,
  today,
  quests = null,
  setId = '',
  onAnother,
  onDone,
}: {
  lines: readonly SetLine[]
  /** Null with rewards off: no XP, no rings, no goal. */
  rewards: SetRewards | null
  today: TodayView | null
  /** Rewards on: what the set did to today's quests, and the chests she can open now. */
  quests?: QuestNews | null
  /** The set: its quest cue plays once. */
  setId?: string
  onAnother: () => void
  onDone: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  // The problem screen is gone: a screen reader starts at the results.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])
  // The party: once, when the results appear.
  useEffect(() => {
    burstConfetti({ y: 0.22, count: 64 })
    if (soundsOn(useStore.getState().settings)) playCue('fanfare')
  }, [])

  return (
    <div className="mx-auto w-full max-w-xl space-y-5" data-set-summary="">
      <header className="flex flex-col items-center text-center">
        <span aria-hidden className="flex h-20 w-20 items-center justify-center rounded-full bg-ok text-5xl font-bold text-white">
          ✓
        </span>
        <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-3xl font-bold text-navy outline-none">
          Set done
        </h1>
        {rewards && (
          <p className="mt-1 text-4xl font-bold text-navy">
            <CountUp value={rewards.xp} prefix="+" suffix=" XP" />
          </p>
        )}
      </header>

      <ol aria-label="Problems in this set" className="divide-y divide-navy-100 rounded-2xl border border-navy-100 bg-white">
        {lines.map((line) => (
          <li key={line.index} className="flex items-start gap-3 p-3" data-outcome={line.outcome.kind}>
            <OutcomeMark outcome={line.outcome} />
            <div className="min-w-0">
              <p className="font-semibold text-navy">{line.title}</p>
              {line.typeTitle !== line.title && <p className="text-xs text-navy/80">{line.typeTitle}</p>}
              <p className="text-sm text-navy">{outcomeWords(line.outcome)}</p>
            </div>
          </li>
        ))}
      </ol>

      {rewards && today && (
        <section aria-label="What the set earned" className="space-y-3" data-set-rewards="">
          <div className="flex flex-wrap items-start justify-center gap-6">
            <div className="flex max-w-36 flex-col items-center gap-1 text-center">
              <GoalRing xp={today.xp} target={today.target} from={Math.max(0, today.xp - rewards.xpToday)} />
              <p className="text-xs text-navy/80">{goalCaption(today)}</p>
            </div>
            {rewards.rings.map((ring) => (
              <div key={ring.skill} className="flex max-w-36 flex-col items-center gap-1 text-center">
                <SkillRing ring={ring.after} from={ring.before} title={ring.title} size={88} />
                <p className="text-xs text-navy/80">
                  <span className="font-semibold text-navy">{ring.title}</span>
                  <br />
                  {ring.before.level !== ring.after.level ? `${RING_WORD[ring.before.level]} → ${RING_WORD[ring.after.level]}` : RING_WORD[ring.after.level]}
                </p>
              </div>
            ))}
          </div>
          {quests && (
            <QuestNewsBlock
              moves={quests.moves}
              today={quests.today}
              chests={quests.chests}
              momentKey={`set:${setId}`}
              cueDelay={cueLength('fanfare') + 0.1}
              chestHere
            />
          )}
          {rewards.squashed.length > 0 && (
            <ul aria-label="Mistakes squashed" className="space-y-2">
              {rewards.squashed.map((s) => (
                <li key={`${s.pattern}|${s.skill}`} className="rounded-xl bg-gold-100 px-3 py-2 font-semibold text-navy">
                  <span aria-hidden className="text-gold-text">★ </span>
                  <MonsterArt id={s.pattern} size={32} className="mr-1 inline-block align-middle" />
                  Squashed: {patternTitle(s.pattern)}
                  <span className="block text-xs font-normal text-navy/80">{skillTitle(s.skill)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="space-y-2">
        <button type="button" onClick={onAnother} className="btn-chunky min-h-14 w-full rounded-2xl bg-navy px-4 text-lg font-semibold text-white hover:bg-navy-600">
          Another set
        </button>
        <button type="button" onClick={onDone} className="min-h-12 w-full rounded-xl px-4 font-semibold text-navy underline hover:bg-navy-50">
          Done
        </button>
      </div>
    </div>
  )
}
