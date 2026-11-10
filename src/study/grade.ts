/**
 * How a typed test answer is graded. She types the short side of a card (testAnswerSide), and the
 * check forgives what is not knowledge: capitals, spacing, closing punctuation, a leading article,
 * a bracketed aside ("Wavelength (λ)" takes "wavelength"), and one slipped letter in a word answer.
 * Anything with a digit or a math sign in it must match exactly: "-1" is not "1".
 */

export function normalizeStudyAnswer(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** The answer with the forgiven parts taken out. */
function looseKey(text: string): string {
  return normalizeStudyAnswer(text)
    .replace(/[‘’“”'"]/g, '')
    .replace(/([a-z])[-\u2010\u2011](?=[a-z])/g, '$1 ')
    .replace(/[.,;:!?]+(?=\s|$)/g, '')
    .replace(/^(?:a|an|the)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function withoutAsides(text: string): string {
  return text.replace(/\([^()]*\)/g, ' ')
}

/** Words only: no digit and no math sign, so a near miss can only be a spelling slip. */
function wordsOnly(key: string): boolean {
  return /^[a-zÀ-ɏ ]+$/.test(key)
}

function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = row
  }
  return prev[b.length]!
}

export type StudyGrade = 'right' | 'close' | 'wrong'

/** 'close' is right with a spelling slip: it counts, and the page shows her the exact answer. */
export function gradeStudyAnswer(given: string, expected: string): StudyGrade {
  const mine = looseKey(given)
  if (!mine) return 'wrong'
  const full = looseKey(expected)
  const bare = looseKey(withoutAsides(expected))
  if (mine === full || (bare && (mine === bare || looseKey(withoutAsides(given)) === bare))) return 'right'
  for (const target of [full, bare]) {
    if (!target || target.length < 6 || !wordsOnly(target) || !wordsOnly(mine)) continue
    const allowed = target.length >= 12 ? 2 : 1
    if (editDistance(mine, target, allowed) <= allowed) return 'close'
  }
  return 'wrong'
}

export function studyAnswersMatch(given: string, expected: string): boolean {
  return gradeStudyAnswer(given, expected) !== 'wrong'
}

/**
 * The side she types in a test: the shorter one across the set, since nobody can retype a
 * sentence word for word. A tie goes to the term.
 */
export function testAnswerSide(cards: readonly { term: string; definition: string }[]): 'term' | 'definition' {
  let terms = 0
  let definitions = 0
  for (const card of cards) {
    terms += card.term.trim().length
    definitions += card.definition.trim().length
  }
  return terms <= definitions ? 'term' : 'definition'
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
