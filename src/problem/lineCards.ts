/**
 * Guided mode's cards (docs/progress/phone-guided.md): the right next line among wrong ones, each wrong one what a
 * named mistake turns her current line into, so a wrong pick shows exactly that mistake's lesson. Pure and generic:
 * a line-by-line problem type hands in the right line, the lines its named mistakes give, its own checker and its
 * own "same line" test (see cardSources.ts); the builder keeps only wrong lines the checker names as exactly that
 * mistake, and orders the cards by the problem's seed and the line, so a re-render never reshuffles them.
 */
import { makeRng, mixSeed } from '@/content/rng'

export interface LineCard {
  /** Stable within the line: 'right', or the named mistake's id. */
  key: string
  /** App syntax. A picked card goes through the checker exactly as the same line typed would. */
  text: string
  latex: string
  right: boolean
  /** A wrong card's named mistake (catalog id), as the checker names it. */
  mistake?: string
}

/** A line one named mistake gives. */
export interface CardCandidate {
  id: string
  text: string
}

/** The checker's verdict on a line, as far as the cards need it. */
export interface CardCheck {
  /** The line is kept. */
  ok: boolean
  /** The named mistake it reports (a rejection). */
  pattern?: string
}

export interface LineCardsInput {
  /** Her current line: every card is a next line after it. */
  current: string
  /** The right next line (the problem's path). */
  right: string
  /** Lines her named mistakes would give from `current`, in the checker's priority order. */
  candidates: readonly CardCandidate[]
  /** The checker, exactly as it judges a typed line. */
  check: (prev: string, next: string) => CardCheck
  /** The same line written another way (a wrong card is never the right line, nor another wrong card). */
  same: (a: string, b: string) => boolean
  /** LaTeX for a card ('' when it cannot be drawn). */
  toLatex: (text: string) => string
  /** The problem's seed and the line's index: they fix the order of the cards. */
  seed: number
  line: number
  /** Wrong cards wanted (default WRONG_CARDS). */
  wrong?: number
}

/** Two wrong cards beside the right one: three to choose from. */
export const WRONG_CARDS = 2

const squash = (text: string) => text.replace(/\s+/g, '')

function bigrams(text: string): Map<string, number> {
  const out = new Map<string, number>()
  for (let i = 0; i < text.length - 1; i++) {
    const g = text.slice(i, i + 2)
    out.set(g, (out.get(g) ?? 0) + 1)
  }
  return out
}

/**
 * How alike two lines look (0 to 1): the share of two-character pieces they have in common, spaces ignored.
 * log(3)^x = log(13) looks much like x·log(3) = log(13); x = 13 does not.
 */
export function likeness(a: string, b: string): number {
  const x = squash(a)
  const y = squash(b)
  if (x === y) return 1
  if (x.length < 2 || y.length < 2) return 0
  const bx = bigrams(x)
  const by = bigrams(y)
  let both = 0
  for (const [g, n] of bx) both += Math.min(n, by.get(g) ?? 0)
  return (2 * both) / (x.length - 1 + (y.length - 1))
}

/**
 * How good a wrong line is as a card beside the right one: alike, and not much longer (a long line shares many
 * pieces with anything, and a slip piled on a slip, log(3)/log(3^x) = log_3(13), is not a line she would write).
 */
export function closeness(candidate: string, right: string): number {
  const c = squash(candidate).length
  const r = Math.max(1, squash(right).length)
  return likeness(candidate, right) - (0.5 * Math.max(0, c - r)) / r
}

/** The cards in the order fixed by the seed and the line (the same cards always come out the same way). */
export function cardOrder<T>(cards: readonly T[], seed: number, line: number): T[] {
  return makeRng(mixSeed(seed >>> 0, line)).shuffle(cards)
}

/**
 * The cards for one line: the right line and up to `wrong` wrong ones, each with a different named mistake, each
 * named as exactly that mistake by the checker, never kept by it, never the right line written another way. The
 * wrong lines closest to the right one come first (`closeness`: they are the ones worth telling apart). No wrong
 * line that qualifies, or a right line the checker does not keep: no cards (the line is typed).
 */
export function buildLineCards(input: LineCardsInput): LineCard[] {
  const { current, right, check, same, toLatex } = input
  const want = input.wrong ?? WRONG_CARDS
  const rightLatex = toLatex(right)
  if (!rightLatex || squash(right) === squash(current) || !check(current, right).ok) return []
  const ranked = input.candidates
    .map((c, i) => ({ c, i, score: closeness(c.text, right) }))
    .sort((p, q) => q.score - p.score || p.i - q.i)
    .map((r) => r.c)
  const wrong: LineCard[] = []
  const tried = new Set<string>()
  for (const c of ranked) {
    if (wrong.length >= want) break
    const key = squash(c.text)
    if (tried.has(key)) continue
    tried.add(key)
    if (wrong.some((w) => w.mistake === c.id)) continue
    if (key === squash(right) || key === squash(current)) continue
    const latex = toLatex(c.text)
    if (!latex) continue
    if (same(c.text, right) || wrong.some((w) => same(c.text, w.text))) continue
    const verdict = check(current, c.text)
    if (verdict.ok || verdict.pattern !== c.id) continue
    wrong.push({ key: c.id, text: c.text, latex, right: false, mistake: c.id })
  }
  if (wrong.length === 0) return []
  return cardOrder([{ key: 'right', text: right, latex: rightLatex, right: true }, ...wrong], input.seed, input.line)
}
