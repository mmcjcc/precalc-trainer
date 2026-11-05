/**
 * Learn: multiple choice when the set can supply the right definition and three different wrong ones,
 * otherwise she reveals the definition and marks it herself. A miss comes back later until it is right once.
 */

export interface LearnChoice {
  text: string
  correct: boolean
}

export interface LearnItem {
  id: string
  misses: number
}

export interface LearnState {
  queue: LearnItem[]
  /** Cards whose first answer was right. */
  firstTry: number
  /** Cards that were missed at least once before they were right. */
  neededRetry: number
  done: boolean
}

interface LearnCard {
  id: string
  definition: string
}

/** Stable seed for one card's choices so a re-render does not shuffle them again. */
export function learnSeed(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = out[i] as T
    out[i] = out[j] as T
    out[j] = a
  }
  return out
}

/**
 * Four choices, or null when this card cannot be multiple choice (fewer than four cards, or fewer than
 * three definitions that belong to other cards and are not the right one).
 */
export function learnChoices(cards: readonly LearnCard[], cardId: string, rng: () => number): LearnChoice[] | null {
  const index = cards.findIndex((card) => card.id === cardId)
  if (index < 0 || cards.length < 4) return null
  const right = cards[index]!.definition
  const pool: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < cards.length; i++) {
    if (i === index) continue
    const text = cards[i]!.definition
    if (text === right || seen.has(text)) continue
    seen.add(text)
    pool.push(text)
  }
  if (pool.length < 3) return null
  const distractors = shuffle(pool, rng).slice(0, 3)
  return shuffle(
    [{ text: right, correct: true }, ...distractors.map((text) => ({ text, correct: false }))],
    rng,
  )
}

export function startLearn(ids: readonly string[], rng: () => number): LearnState {
  return {
    queue: shuffle(
      ids.map((id) => ({ id, misses: 0 })),
      rng,
    ),
    firstTry: 0,
    neededRetry: 0,
    done: ids.length === 0,
  }
}

/** Grade the card at the front of the queue. A wrong answer goes to the back. */
export function answerLearn(state: LearnState, correct: boolean): LearnState {
  if (state.done || state.queue.length === 0) return state
  const [current, ...rest] = state.queue
  if (!current) return state
  if (!correct) return { ...state, queue: [...rest, { id: current.id, misses: current.misses + 1 }] }
  return {
    queue: rest,
    firstTry: state.firstTry + (current.misses === 0 ? 1 : 0),
    neededRetry: state.neededRetry + (current.misses > 0 ? 1 : 0),
    done: rest.length === 0,
  }
}
