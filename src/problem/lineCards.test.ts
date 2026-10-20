import { describe, expect, it } from 'vitest'
import { buildLineCards, cardOrder, closeness, likeness, type CardCheck, type LineCardsInput } from './lineCards'

/**
 * A toy checker: the lines it keeps, and the mistake it names for each line it does not. Lines are plain
 * strings here; the builder never reads them.
 */
function toy(keeps: string[], names: Record<string, string>): (prev: string, next: string) => CardCheck {
  return (_prev, next) => (keeps.includes(next) ? { ok: true } : { ok: false, ...(names[next] ? { pattern: names[next] } : {}) })
}

function input(over: Partial<LineCardsInput> = {}): LineCardsInput {
  return {
    current: 'A = B',
    right: 'a = b',
    candidates: [
      { id: 'slip_one', text: 'a = c' },
      { id: 'slip_two', text: 'a = d' },
      { id: 'slip_three', text: 'q = r' },
    ],
    check: toy(['a = b'], { 'a = c': 'slip_one', 'a = d': 'slip_two', 'q = r': 'slip_three' }),
    same: (x, y) => x.replace(/\s+/g, '') === y.replace(/\s+/g, ''),
    toLatex: (t) => t,
    seed: 7,
    line: 0,
    ...over,
  }
}

const wrongIds = (cards: { right: boolean; mistake?: string }[]) => cards.filter((c) => !c.right).map((c) => c.mistake)

describe('buildLineCards', () => {
  it('gives the right line and two wrong ones, each named by the checker as the mistake it was built from', () => {
    const cards = buildLineCards(input())
    expect(cards).toHaveLength(3)
    expect(cards.filter((c) => c.right)).toEqual([{ key: 'right', text: 'a = b', latex: 'a = b', right: true }])
    for (const c of cards.filter((c) => !c.right)) {
      expect(c.key).toBe(c.mistake)
      expect(toy([], { 'a = c': 'slip_one', 'a = d': 'slip_two' })('A = B', c.text).pattern).toBe(c.mistake)
    }
    expect(new Set(wrongIds(cards)).size).toBe(2)
  })

  it('takes the wrong lines most like the right one first', () => {
    const cards = buildLineCards(
      input({
        candidates: [
          { id: 'far', text: 'zzzz' },
          { id: 'near', text: 'a = bb' },
          { id: 'nearer', text: 'a = b + 0x' },
        ],
        check: toy(['a = b'], { zzzz: 'far', 'a = bb': 'near', 'a = b + 0x': 'nearer' }),
      }),
    )
    expect(new Set(wrongIds(cards))).toEqual(new Set(['near', 'nearer']))
    expect(likeness('log(3)^x = log(13)', 'x * log(3) = log(13)')).toBeGreaterThan(likeness('x = 13', 'x * log(3) = log(13)'))
    expect(likeness('x = 1', 'x = 1')).toBe(1)
    // A long line shares many pieces with anything: a slip piled on a slip ranks below a plain one.
    expect(closeness('log(3)/log(3^x) = log_3(13)', 'x * log(3) = log(13)')).toBeLessThan(closeness('3^x = log(13)', 'x * log(3) = log(13)'))
  })

  it('leaves out a line the checker keeps, names as another mistake, or names as nothing', () => {
    const cards = buildLineCards(
      input({
        candidates: [
          { id: 'kept', text: 'a = b + 0' },
          { id: 'renamed', text: 'a = e' },
          { id: 'unnamed', text: 'a = f' },
          { id: 'slip_two', text: 'a = d' },
        ],
        check: toy(['a = b', 'a = b + 0'], { 'a = e': 'other_slip', 'a = d': 'slip_two' }),
      }),
    )
    expect(wrongIds(cards)).toEqual(['slip_two'])
    expect(cards).toHaveLength(2)
  })

  it('never shows the right line twice, nor two wrong cards that are the same line, nor two of one mistake', () => {
    // The toy checker names every one of these lines; the builder still keeps them apart.
    const names: Record<string, string> = { 'a=b': 'same_as_right', 'a = c': 'slip_one', 'a = cc': 'slip_one', 'a =c': 'slip_two', 'a = g': 'slip_three' }
    const cards = buildLineCards(
      input({
        candidates: Object.entries(names).map(([text, id]) => ({ id, text })),
        check: (_p, next) => (next === 'a = b' ? { ok: true } : { ok: false, pattern: names[next] }),
      }),
    )
    const texts = cards.map((c) => c.text)
    expect(texts).toContain('a = b')
    expect(texts).not.toContain('a=b')
    expect(new Set(wrongIds(cards))).toEqual(new Set(['slip_one', 'slip_three']))
    expect(texts.filter((t) => t.replace(/\s+/g, '') === 'a=c')).toHaveLength(1)
  })

  it('never shows a wrong line that is the right line written another way', () => {
    // Sides swapped is the same line here.
    const sides = (t: string) => t.replace(/\s+/g, '').split('=').sort().join('=')
    const names: Record<string, string> = { 'b = a': 'written_again', 'a = c': 'slip_one', 'c = a': 'slip_two', 'a = g': 'slip_three' }
    const cards = buildLineCards(
      input({
        candidates: Object.entries(names).map(([text, id]) => ({ id, text })),
        check: (_p, next) => (next === 'a = b' ? { ok: true } : { ok: false, pattern: names[next] }),
        same: (x, y) => sides(x) === sides(y),
        // Ask for three, so every candidate is looked at.
        wrong: 3,
      }),
    )
    expect(cards.map((c) => c.text)).not.toContain('b = a')
    // 'c = a' is 'a = c' again.
    expect(cards.map((c) => c.text)).not.toContain('c = a')
    expect(new Set(wrongIds(cards))).toEqual(new Set(['slip_one', 'slip_three']))
  })

  it('a line with one wrong card shows two cards; with none, or a right line the checker does not keep, none', () => {
    expect(buildLineCards(input({ candidates: [{ id: 'slip_one', text: 'a = c' }] }))).toHaveLength(2)
    expect(buildLineCards(input({ candidates: [] }))).toEqual([])
    expect(buildLineCards(input({ check: toy([], { 'a = c': 'slip_one' }) }))).toEqual([])
    expect(buildLineCards(input({ toLatex: (t) => (t === 'a = b' ? '' : t) }))).toEqual([])
    // A card that cannot be drawn is not offered.
    expect(wrongIds(buildLineCards(input({ toLatex: (t) => (t === 'a = c' ? '' : t) })))).not.toContain('slip_one')
  })

  it('orders the cards by the seed and the line: the same every time, the right card not always in one place', () => {
    const a = buildLineCards(input())
    const b = buildLineCards(input())
    expect(b).toEqual(a)
    const places = new Set<number>()
    for (let seed = 1; seed <= 40; seed++) {
      for (let line = 0; line < 3; line++) places.add(buildLineCards(input({ seed, line })).findIndex((c) => c.right))
    }
    expect(places).toEqual(new Set([0, 1, 2]))
    expect(cardOrder(['p', 'q', 'r'], 12, 1)).toEqual(cardOrder(['p', 'q', 'r'], 12, 1))
    expect([...cardOrder(['p', 'q', 'r'], 12, 1)].sort()).toEqual(['p', 'q', 'r'])
  })
})
