/** The daily quests and chests as the screens read them (session/quests.ts, pure), memoized on the store. */
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { openableChests, questDay, questDayWithout, questMoves, type ChestSpot, type QuestDay, type QuestInput, type QuestMove } from '@/session/quests'
import { dailyGoalOf, useRewards, useStore, type PersistedState, type XpAward } from '@/store'

/** What the quests read from a store state and its rewards' awards. */
export function questInputOf(s: Pick<PersistedState, 'events' | 'rewards' | 'settings'>, awards: readonly XpAward[]): QuestInput {
  return {
    events: s.events,
    rewards: s.rewards,
    awards,
    goal: dailyGoalOf(s.settings),
    ...(s.settings.courseId !== undefined ? { courseId: s.settings.courseId } : {}),
    ...(s.settings.unitByCourse !== undefined ? { unitByCourse: s.settings.unitByCourse } : {}),
  }
}

export function useQuestInput(): QuestInput {
  const view = useRewards()
  const { events, rewards, settings } = useStore(useShallow((s) => ({ events: s.events, rewards: s.rewards, settings: s.settings })))
  return useMemo(() => questInputOf({ events, rewards, settings }, view.awards), [events, rewards, settings, view.awards])
}

export interface TodayQuests {
  today: QuestDay
  /** Chests she can open now (today's, yesterday's). */
  chests: ChestSpot[]
}

/** Today's quests and the chests waiting to be opened. */
export function useTodayQuests(): TodayQuests {
  const input = useQuestInput()
  const day = useRewards().today.day
  return useMemo(() => ({ today: questDay(day, input), chests: openableChests(input, Date.now()) }), [input, day])
}

export interface QuestNews {
  /** The quests this work moved (newly done ones say "Quest done"). */
  moves: QuestMove[]
  today: QuestDay
  chests: ChestSpot[]
}

/**
 * What a finished problem (its attempt) or a finished set (its attempts and its end) did to today's quests. Null while
 * there is nothing finished to read (`attemptIds` null).
 */
export function useQuestNews(attemptIds: readonly string[] | null, setId?: string): QuestNews | null {
  const input = useQuestInput()
  const day = useRewards().today.day
  const key = attemptIds ? attemptIds.join(' ') : null
  return useMemo(() => {
    if (key === null) return null
    const today = questDay(day, input)
    const before = questDayWithout(day, input, new Set(key ? key.split(' ') : []), setId)
    return { moves: questMoves(before, today), today, chests: openableChests(input, Date.now()) }
  }, [input, day, key, setId])
}
