import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/content/rng'
import { answerLearn, learnChoices, learnSeed, startLearn } from './learn'

interface Card {
  id: string
  definition: string
}

function cardsOf(n: number, rng: () => number, unique = true): Card[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    definition: unique ? `def ${i} ${Math.floor(rng() * 1e6)}` : i % 2 === 0 ? 'same' : `other ${i}`,
  }))
}

describe('learn choices', () => {
  it('over many sets and seeds: four unique options, the right one once, distractors from other cards', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = mulberry32(seed)
      for (const n of [4, 5, 8, 15, 40]) {
        const cards = cardsOf(n, rng)
        const others = new Map(cards.map((card) => [card.id, new Set(cards.filter((item) => item.id !== card.id).map((item) => item.definition))]))
        for (const card of cards) {
          const choices = learnChoices(cards, card.id, mulberry32(seed * 1000 + card.id.length + n))
          expect(choices, `${seed}:${n}:${card.id}`).not.toBeNull()
          if (!choices) continue
          expect(choices).toHaveLength(4)
          expect(new Set(choices.map((choice) => choice.text)).size).toBe(4)
          const right = choices.filter((choice) => choice.correct)
          expect(right).toHaveLength(1)
          expect(right[0]!.text).toBe(card.definition)
          for (const choice of choices) {
            if (choice.correct) continue
            expect(choice.text).not.toBe(card.definition)
            expect(others.get(card.id)!.has(choice.text)).toBe(true)
          }
        }
      }
    }
  })

  it('is not multiple choice for fewer than four cards, or when three different wrong definitions are not there', () => {
    const few = cardsOf(3, mulberry32(1))
    expect(learnChoices(few, few[0]!.id, mulberry32(2))).toBeNull()
    expect(learnChoices([], 'missing', mulberry32(2))).toBeNull()
    const shared: Card[] = [
      { id: 'a', definition: 'same' },
      { id: 'b', definition: 'same' },
      { id: 'c', definition: 'same' },
      { id: 'd', definition: 'other' },
    ]
    expect(learnChoices(shared, 'd', mulberry32(3))).toBeNull()
    expect(learnChoices(shared, 'a', mulberry32(3))).toBeNull()
  })

  it('keeps a card’s seed stable', () => {
    expect(learnSeed('cell')).toBe(learnSeed('cell'))
    expect(learnSeed('cell')).not.toBe(learnSeed('mito'))
  })
})

describe('a learn round', () => {
  it('brings a miss back until it is right, and counts first tries apart from retries', () => {
    const state = startLearn(['a', 'b', 'c', 'd'], () => 0)
    const first = state.queue[0]!.id
    const missed = answerLearn(state, false)
    expect(missed.queue.at(-1)).toMatchObject({ id: first, misses: 1 })
    expect(missed.queue.slice(0, -1).every((item) => item.misses === 0)).toBe(true)
    expect(missed.done).toBe(false)
    let next = missed
    while (next.queue.length > 1) next = answerLearn(next, true)
    expect(next.queue.map((item) => item.id)).toEqual([first])
    expect(next.firstTry).toBe(3)
    next = answerLearn(next, true)
    expect(next.done).toBe(true)
    expect(next.firstTry).toBe(3)
    expect(next.neededRetry).toBe(1)
    expect(answerLearn(next, true)).toBe(next)
  })

  it('an empty set is already done', () => {
    expect(startLearn([], () => 0).done).toBe(true)
  })
})
