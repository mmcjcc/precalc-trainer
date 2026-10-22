import { useEffect, useId } from 'react'
import { useMotionAllowed } from '@/components/juice/motion'
import { playCue, soundsOn } from '@/components/juice/sounds'
import { questDetail, questProgressWords, questTitle, type ChestSpot, type Quest, type QuestDay, type QuestMove } from '@/session/quests'
import { useStore } from '@/store'
import { ChestSpots } from './Chest'

/** A quest's bar (decorative: the words beside it say how far). Green once done. */
function QuestBar({ quest }: { quest: Quest }) {
  const motion = useMotionAllowed()
  const fill = quest.target > 0 ? Math.min(1, quest.count / quest.target) : 0
  return (
    <span aria-hidden className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-navy-100">
      <span className={`block h-full rounded-full ${quest.done ? 'bg-ok' : 'bg-navy'} ${motion ? 'quest-bar-fill' : ''}`} style={{ width: `${Math.round(fill * 100)}%` }} />
    </span>
  )
}

/** "Quests 1/3" on screen; "Quests: 1 of 3 done" to a screen reader. */
function QuestsHeading({ day }: { day: QuestDay }) {
  const n = day.quests.length
  return (
    <>
      Quests<span className="sr-only">{`: ${day.done} of ${n} done`}</span>
      <span aria-hidden className="ml-1.5 tabular-nums">{`${day.done}/${n}`}</span>
    </>
  )
}

/** One quest: a tick when done, what it asks (and the stop it names), its bar, and "6 of 8". */
function QuestRow({ quest }: { quest: Quest }) {
  const detail = questDetail(quest)
  return (
    <li className="flex items-start gap-2.5 py-1.5" data-quest={quest.kind} data-quest-done={quest.done ? '' : undefined}>
      <span
        aria-hidden
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${quest.done ? 'bg-ok text-white' : 'border-2 border-navy-100 bg-white'}`}
      >
        {quest.done ? '✓' : ''}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-navy">{questTitle(quest)}</span>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-navy/80">
            {questProgressWords(quest)}
            {quest.done && <span className="sr-only">, done</span>}
          </span>
        </span>
        {detail && <span className="block text-xs text-navy/80">{detail}</span>}
        <QuestBar quest={quest} />
      </span>
    </li>
  )
}

/**
 * The quests row of Home's Today card: "Quests 1/3", the day's three quests with their bars (done ones ticked), and the
 * chest when all three are done (today's, and yesterday's unopened one, which waits a day).
 */
export function TodayQuests({ today, chests }: { today: QuestDay; chests: readonly ChestSpot[] }) {
  const titleId = useId()
  if (today.quests.length === 0) return null
  return (
    <section aria-labelledby={titleId} className="space-y-1" data-quests="">
      <h3 id={titleId} className="font-semibold text-navy">
        <QuestsHeading day={today} />
      </h3>
      <ul aria-label="Today’s quests" className="divide-y divide-navy-100">
        {today.quests.map((q) => (
          <QuestRow key={q.kind} quest={q} />
        ))}
      </ul>
      <ChestSpots chests={chests} />
    </section>
  )
}

/** Moments whose quest cue already played (a sheet closed and opened again does not play it twice). */
const cued = new Set<string>()

/** Tests: forget which moments played their cue. */
export function resetQuestCuesForTests(): void {
  cued.clear()
}

/**
 * What a finished problem or set did to today's quests, for the finish sheet (the wide completion card) and the set's
 * results: "Quest done: Finish a set with no hints" for each quest it finished (with the quest cue, Sounds on; the tick
 * pops where motion is allowed), and "Get 8 lines or parts right first try: 6 of 8" for each it moved. Then the chest:
 * here, or, inside a set, a line saying it waits for the set's results (the set's one break, an ad in the store app,
 * comes before them, so it never covers a chest she is opening).
 */
export function QuestNewsBlock({
  moves,
  today,
  chests,
  momentKey,
  cueDelay,
  chestHere,
}: {
  moves: readonly QuestMove[]
  today: QuestDay
  chests: readonly ChestSpot[]
  /** The attempt or the set: its quest cue plays once. */
  momentKey: string
  /** Seconds to wait for the cue (after the finish's arpeggio, or the results' fanfare). */
  cueDelay: number
  /** Show the chest here (false inside a set before its results). */
  chestHere: boolean
}) {
  const titleId = useId()
  const motion = useMotionAllowed()
  const doneNow = moves.filter((m) => m.newlyDone)
  const anyDone = doneNow.length > 0
  useEffect(() => {
    if (!anyDone || cued.has(momentKey)) return
    cued.add(momentKey)
    if (soundsOn(useStore.getState().settings)) playCue('quest', { delay: cueDelay })
  }, [anyDone, momentKey, cueDelay])
  const todayChest = chests.some((c) => c.when === 'today')
  if (moves.length === 0 && chests.length === 0) return null
  return (
    <section aria-labelledby={titleId} className="space-y-2" data-quest-news="">
      <h3 id={titleId} className="text-sm font-semibold text-navy">
        <QuestsHeading day={today} />
      </h3>
      {moves.length > 0 && (
        <ul aria-label="Quests moved" className="space-y-1.5">
          {moves.map((m) =>
            m.newlyDone ? (
              <li key={m.quest.kind} className="rounded-xl bg-gold-100 px-3 py-2 font-semibold text-navy" data-quest-move={m.quest.kind} data-quest-done="">
                <span aria-hidden className={`mr-1 text-ok ${motion ? 'quest-done-pop' : ''}`}>
                  ✓
                </span>
                Quest done: {questTitle(m.quest)}
              </li>
            ) : (
              <li key={m.quest.kind} className="rounded-xl border border-navy-100 bg-white px-3 py-2 text-sm text-navy" data-quest-move={m.quest.kind}>
                <span className="flex items-baseline justify-between gap-2">
                  <span>{questTitle(m.quest)}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{questProgressWords(m.quest)}</span>
                </span>
                <QuestBar quest={m.quest} />
              </li>
            ),
          )}
        </ul>
      )}
      {chestHere ? (
        <ChestSpots chests={chests} />
      ) : (
        todayChest && (
          <p className="rounded-xl bg-gold-100 px-3 py-2 text-sm font-semibold text-navy" data-chest-waits="">
            <span aria-hidden className="text-gold-text">★ </span>
            Your chest is ready: open it on your set’s results.
          </p>
        )
      )}
    </section>
  )
}
