import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BottomSheet } from '@/components/BottomSheet'
import { finishInfo, skillRing, useEvents, useRewards, useStore, type FinishInfo, type SkillRingInfo, type TodayView } from '@/store'
import { GoalRing, SkillRing } from './Rings'
import { RING_WORD, awardLines } from './words'

export interface FinishData {
  info: FinishInfo
  /** The problem type's ring before this problem and after it. */
  before: SkillRingInfo
  after: SkillRingInfo
  today: TodayView
}

/** What a finished attempt earned, today's goal, and its type's ring before and after (null without an attempt). */
export function useFinish(attemptId: string | undefined, skill: string): FinishData | null {
  const view = useRewards()
  const events = useEvents()
  const rewards = useStore((s) => s.rewards)
  return useMemo(() => {
    if (!attemptId) return null
    const info = finishInfo(view, events, rewards, attemptId)
    const after = skillRing(events, skill)
    const before = skillRing(
      events.filter((e) => !(e.t === 'problem_done' && e.attemptId === attemptId)),
      skill,
    )
    return { info, before, after, today: view.today }
  }, [attemptId, skill, view, events, rewards])
}

/** The moments worth a cheer, besides the XP lines that already say a mistake was squashed or a type mastered. */
function cheers(info: FinishInfo): string[] {
  const out: string[] = []
  if (info.comeback) out.push('Welcome back!')
  if (info.repaired) out.push('Double goal: your streak keeps going')
  else if (info.goalMet) out.push('Today’s goal is met!')
  return out
}

function goalCaption(today: TodayView): string {
  const left = Math.max(0, today.target - today.xp)
  if (today.target > today.goal && left > 0) return `${left} XP to a double goal`
  return today.xp >= today.target ? 'Today’s goal: met' : `${left} XP to today’s goal`
}

/**
 * A finished problem's rewards: the XP and the lines that earned it, the cheers (goal met, a comeback; a squashed
 * mistake and a new mastery are lines of their own), today's goal ring, and the ring of the problem type that moved.
 * The phone's finish sheet shows it under a big check; a wide screen shows it in the completion card.
 */
export function FinishRewards({ data, templateTitle, size = 'card' }: { data: FinishData; templateTitle: string; size?: 'sheet' | 'card' }) {
  const lines = awardLines(data.info.awards, templateTitle)
  const cheer = cheers(data.info)
  const ringSize = size === 'sheet' ? 88 : 72
  const moved = data.before.level !== data.after.level
  return (
    <div className="space-y-3" data-finish-rewards="">
      {size === 'card' && <p className="text-2xl font-bold text-navy">+{data.info.total} XP</p>}
      {lines.length > 0 && (
        <ul aria-label="XP earned" className="divide-y divide-navy-100 rounded-xl border border-navy-100 bg-white px-3">
          {lines.map((line) => {
            const big = line.key.startsWith('squash') || line.key === 'mastered'
            return (
              <li key={line.key} className={`flex items-baseline justify-between gap-3 py-2 text-sm ${big ? 'font-semibold text-navy' : 'text-navy'}`}>
                <span>
                  {big && <span aria-hidden className="text-gold-text">★ </span>}
                  {line.label}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  +{line.xp}
                  {line.half && <span className="sr-only"> (half)</span>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {data.info.half && (
        <p className="text-xs text-navy/70">
          Half XP: you have mastered this type. It pays in full again when it is due for review, two weeks after your last
          problem of it.
        </p>
      )}
      {cheer.length > 0 && (
        <ul aria-label="Cheers" className="space-y-2">
          {cheer.map((c) => (
            <li key={c} className="rounded-xl bg-gold-100 px-3 py-2 font-semibold text-navy">
              <span aria-hidden className="text-gold-text">★ </span>
              {c}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-start justify-center gap-6">
        <div className="flex max-w-36 flex-col items-center gap-1 text-center">
          <GoalRing xp={data.today.xp} target={data.today.target} size={ringSize} />
          <p className="text-xs text-navy/80">{goalCaption(data.today)}</p>
        </div>
        <div className="flex max-w-36 flex-col items-center gap-1 text-center">
          <SkillRing ring={data.after} from={data.before} title={templateTitle} size={ringSize} />
          <p className="text-xs text-navy/80">
            <span className="font-semibold text-navy">{templateTitle}</span>
            <br />
            {moved ? `${RING_WORD[data.before.level]} → ${RING_WORD[data.after.level]}` : RING_WORD[data.after.level]}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * The finish sheet that takes the completion card's place on a phone: a big check, the XP and its lines, the goal
 * ring and the type's ring, one big Next button and "Done for today" under it. Closing it leaves a small card behind.
 */
export function FinishSheet({
  open,
  onClose,
  title,
  data,
  templateTitle,
  nextLabel,
  onNext,
}: {
  open: boolean
  onClose: () => void
  title: string
  data: FinishData
  templateTitle: string
  nextLabel: string
  onNext: () => void
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div data-completion-card="" data-finish-sheet="" className="space-y-4">
        <div className="flex flex-col items-center text-center">
          <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full bg-ok text-4xl font-bold text-white">
            ✓
          </span>
          <p className="mt-2 text-4xl font-bold text-navy">+{data.info.total} XP</p>
        </div>
        <FinishRewards data={data} templateTitle={templateTitle} size="sheet" />
        <button
          type="button"
          onClick={onNext}
          className="min-h-14 w-full rounded-2xl bg-navy px-4 text-lg font-semibold text-white hover:bg-navy-600"
        >
          {nextLabel}
        </button>
        <Link to="/" className="flex min-h-11 items-center justify-center font-semibold text-navy underline">
          Done for today
        </Link>
      </div>
    </BottomSheet>
  )
}
