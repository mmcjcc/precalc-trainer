import { useId } from 'react'
import { Link } from 'react-router-dom'
import { openCards, useRewards, type StreakView, type WeekDayState } from '@/store'
import { MistakeCardList } from './MistakeCards'
import { GoalRing } from './Rings'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

const DAY_WORDS: Record<WeekDayState, string> = {
  met: 'goal met',
  rest: 'rest day',
  repaired: 'mended by a double goal',
  off: 'not met',
  today: 'today',
  future: 'to come',
}

const DOT: Record<WeekDayState, string> = {
  met: 'bg-navy text-white',
  repaired: 'bg-navy/60 text-white',
  rest: 'border-2 border-navy-100 bg-white text-navy/70',
  off: 'bg-navy-100',
  today: 'border-2 border-navy bg-white',
  future: 'border border-dashed border-navy-100 bg-white',
}

/** Monday to Sunday: a filled dot for each day she met her goal, a "z" for a rest day. */
export function WeekDots({ week }: { week: StreakView['week'] }) {
  return (
    <ol aria-label="This week" className="flex gap-1.5">
      {week.map((d, i) => (
        <li key={d.day} className="flex flex-col items-center gap-0.5" data-day-state={d.state}>
          <span aria-hidden className="text-[10px] font-semibold text-navy/60">
            {WEEKDAYS[i]!.slice(0, 1)}
          </span>
          <span aria-hidden className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${DOT[d.state]}`}>
            {d.state === 'met' || d.state === 'repaired' ? '✓' : d.state === 'rest' ? 'z' : ''}
          </span>
          <span className="sr-only">
            {WEEKDAYS[i]}: {DAY_WORDS[d.state]}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** "5-day streak · 5 of 7 this week", or how to start one. Never a warning. */
export function streakLine(streak: StreakView): string {
  const run = streak.days > 0 ? `${streak.days}-day streak` : 'Meet today’s goal to start a streak'
  return `${run} · ${streak.weekMet} of 7 this week`
}

/**
 * The top of Home with rewards on: today's goal ring, the streak with "N of 7 this week" and the week's days, the
 * rest days saved, and her top three open mistake cards (each opens a problem of its type).
 */
export function TodayCard() {
  const view = useRewards()
  const titleId = useId()
  const mistakesId = useId()
  const { today, streak } = view
  const open = openCards(view.cards)
  const left = Math.max(0, today.target - today.xp)
  const goalLine = streak.repairToday
    ? `${left} XP more for a double goal today: it keeps your streak going.`
    : today.met
      ? 'Today’s goal is met. Anything more is a bonus.'
      : `${left} XP to today’s goal.`
  return (
    <section aria-labelledby={titleId} data-rewards-today="" className="rounded-2xl border border-navy-100 bg-white p-4">
      <div className="flex items-center gap-4">
        <GoalRing xp={today.xp} target={today.target} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <h2 id={titleId} className="text-lg font-semibold text-navy">
            Today
          </h2>
          <p className="text-sm text-navy">{goalLine}</p>
          <p className="text-sm font-semibold text-navy">{streakLine(streak)}</p>
          <WeekDots week={streak.week} />
          {streak.days > 0 && streak.restDays > 0 && (
            <p className="text-xs text-navy/70">
              {streak.restDays} rest {streak.restDays === 1 ? 'day' : 'days'} saved: a day off uses one by itself.
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <h3 id={mistakesId} className="font-semibold text-navy">
          Mistakes to squash
        </h3>
        {open.length > 0 ? (
          <>
            <MistakeCardList cards={open} practice label="Mistakes to squash" />
            <Link to="/progress" className="inline-flex min-h-11 items-center text-sm font-semibold text-navy underline">
              The whole collection
            </Link>
          </>
        ) : (
          <p className="text-sm text-navy/80">
            {view.cards.length > 0
              ? 'Every mistake you caught is squashed. A new one lands here the moment the checker names it.'
              : 'When the checker names a mistake, it lands here. Three clean problems of that type squash it.'}
          </p>
        )}
      </div>
    </section>
  )
}
