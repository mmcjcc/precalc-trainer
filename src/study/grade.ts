/** How a typed test answer is compared to the card's definition. */
export function normalizeStudyAnswer(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function studyAnswersMatch(given: string, definition: string): boolean {
  return normalizeStudyAnswer(given) === normalizeStudyAnswer(definition)
}

/** Up to `n` cards, in a shuffled order. A smaller set is the whole set, still shuffled. */
export function pickTestCards<T>(cards: readonly T[], rng: () => number, n = 10): T[] {
  const order = cards.slice()
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = order[i] as T
    order[i] = order[j] as T
    order[j] = a
  }
  return order.slice(0, Math.min(n, order.length))
}
