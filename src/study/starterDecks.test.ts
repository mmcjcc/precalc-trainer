/**
 * Starter decks: every deck obeys the store's own limits, the derived decks match the engines
 * they come from, and the unit-circle numbers are re-checked against Math.
 */
import { describe, expect, it } from 'vitest'
import { ionDisplay } from '@/engine'
import { ELEMENTS } from '@/engine/chem/elements'
import { transitionGlossary } from '@/content/modules/satrw/transitions'
import { STORE_SKIPS_SUBJECTS } from '@/edition'
import { checkTitle, prepareCards, STUDY_LIMITS } from '@/store/studySets'
import { allStarterDecks, elementsForDeck, polyatomicIonsForDeck, starterDecks, UNIT_CIRCLE_VALUES } from './starterDecks'

function deck(id: string) {
  const found = allStarterDecks().find((d) => d.id === id)
  if (!found) throw new Error(`no starter deck ${id}`)
  return found
}

describe('starter decks', () => {
  it('every deck fits the study-set limits with nothing dropped', () => {
    const decks = allStarterDecks()
    expect(decks.length).toBeGreaterThanOrEqual(8)
    expect(new Set(decks.map((d) => d.id)).size).toBe(decks.length)
    expect(new Set(decks.map((d) => d.title)).size).toBe(decks.length)
    for (const d of decks) {
      expect(checkTitle(d.title)).toMatchObject({ ok: true })
      expect(d.blurb.length).toBeGreaterThan(0)
      expect(d.cards.length).toBeGreaterThanOrEqual(18)
      expect(d.cards.length).toBeLessThanOrEqual(STUDY_LIMITS.maxCards)
      const prepared = prepareCards(d.cards)
      if (!prepared.ok) throw new Error(`${d.id}: ${prepared.error}`)
      expect(prepared.dropped).toBe(0)
      expect(prepared.cards.length).toBe(d.cards.length)
      expect(new Set(d.cards.map((c) => c.term)).size).toBe(d.cards.length)
    }
  })

  it('only chemistry and SAT decks carry a store-skipped subject', () => {
    for (const d of allStarterDecks()) {
      if (d.subject !== undefined) expect(STORE_SKIPS_SUBJECTS).toContain(d.subject)
    }
    expect(deck('polyatomic-ions').subject).toBe('Chemistry')
    expect(deck('chem-vocab').subject).toBe('Chemistry')
    expect(deck('chem-electrons').subject).toBe('Chemistry')
    expect(deck('element-symbols').subject).toBe('Chemistry')
    expect(deck('sat-transitions').subject).toBe('English')
    expect(deck('unit-circle').subject).toBeUndefined()
    expect(deck('geometry-theorems').subject).toBeUndefined()
  })

  it('the family build shows every deck', () => {
    expect(starterDecks()).toEqual(allStarterDecks())
  })

  it('unit-circle exact values agree with Math', () => {
    const NUMBER: Record<string, number> = {
      '0': 0,
      '1': 1,
      '-1': -1,
      '1/2': 1 / 2,
      '√2/2': Math.SQRT2 / 2,
      '√3/2': Math.sqrt(3) / 2,
      '√3': Math.sqrt(3),
      '√3/3': Math.sqrt(3) / 3,
    }
    const cards = deck('unit-circle').cards
    for (const v of UNIT_CIRCLE_VALUES) {
      const rad = (v.deg * Math.PI) / 180
      if (v.exact === 'undefined') {
        expect(v.fn).toBe('tan')
        expect(Math.abs(Math.cos(rad))).toBeLessThan(1e-12)
      } else {
        const want = NUMBER[v.exact]
        if (want === undefined) throw new Error(`no number for ${v.exact}`)
        expect(Math.abs(Math[v.fn](rad) - want)).toBeLessThan(1e-9)
      }
      const match = cards.find((c) => c.term === `${v.fn} ${v.deg}° (${v.rad})`)
      expect(match?.definition).toBe(v.exact)
    }
  })

  it('radian conversion cards agree with Math', () => {
    const RAD: Record<string, number> = {
      'π/6': Math.PI / 6,
      'π/4': Math.PI / 4,
      'π/3': Math.PI / 3,
      'π/2': Math.PI / 2,
      π: Math.PI,
      '3π/2': (3 * Math.PI) / 2,
      '2π': 2 * Math.PI,
    }
    const conversions = deck('unit-circle').cards.filter((c) => c.term.endsWith('in radians'))
    expect(conversions.length).toBe(7)
    for (const c of conversions) {
      const deg = Number(c.term.replace('° in radians', ''))
      expect(Number.isFinite(deg)).toBe(true)
      expect(Math.abs(RAD[c.definition]! - (deg * Math.PI) / 180)).toBeLessThan(1e-12)
    }
  })

  it('the polyatomic deck is exactly the engine’s polyatomic ions', () => {
    const ions = polyatomicIonsForDeck()
    const cards = deck('polyatomic-ions').cards
    expect(cards.length).toBe(ions.length)
    expect(ions.length).toBeGreaterThanOrEqual(20)
    for (let i = 0; i < ions.length; i++) {
      const ion = ions[i]!
      expect(ion.kind).toBe('polyatomic')
      expect(cards[i]!.term.toLowerCase()).toBe(ion.name.toLowerCase())
      expect(cards[i]!.definition.startsWith(ionDisplay(ion))).toBe(true)
    }
    for (const name of ['ammonium', 'sulfate', 'nitrate', 'phosphate', 'hydroxide', 'carbonate']) {
      expect(ions.some((ion) => ion.name === name)).toBe(true)
    }
  })

  it('the element deck matches the element table', () => {
    const picked = elementsForDeck()
    const cards = deck('element-symbols').cards
    expect(cards.length).toBe(picked.length)
    for (let i = 0; i < picked.length; i++) {
      expect(cards[i]!.term.toLowerCase()).toBe(picked[i]!.name)
      expect(cards[i]!.definition).toBe(picked[i]!.symbol)
    }
    for (const el of ELEMENTS) if (el.z <= 20) expect(picked).toContain(el)
    for (const symbol of ['Fe', 'Cu', 'Ag', 'Au', 'Hg', 'Pb', 'Sn', 'W']) {
      expect(picked.some((el) => el.symbol === symbol)).toBe(true)
    }
  })

  it('electron-configuration cards add up against the element table', () => {
    const SUP: Record<string, number> = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 }
    const zOf = (symbol: string) => {
      const el = ELEMENTS.find((e) => e.symbol === symbol)
      if (!el) throw new Error(`no element ${symbol}`)
      return el.z
    }
    const configCards = deck('chem-electrons').cards.filter((c) => c.term.startsWith('Electron configuration: '))
    expect(configCards.length).toBeGreaterThanOrEqual(5)
    for (const c of configCards) {
      const m = c.term.match(/^Electron configuration: ([a-z]+) \(Z = (\d+)\)$/)
      if (!m) throw new Error(`bad term ${c.term}`)
      const el = ELEMENTS.find((e) => e.name === m[1])
      if (!el) throw new Error(`no element named ${m[1]}`)
      expect(el.z).toBe(Number(m[2]))
      let electrons = 0
      for (const token of c.definition.match(/\[(?:Ne|Ar)\]|\d[spdf][⁰¹²³⁴⁵⁶⁷⁸⁹]+/g) ?? []) {
        if (token.startsWith('[')) electrons += zOf(token.slice(1, -1))
        else electrons += [...token.slice(2)].reduce((n, ch) => n * 10 + SUP[ch]!, 0)
      }
      expect(electrons).toBe(el.z)
    }
  })

  it('the filling-order card obeys the n + l rule', () => {
    const order = deck('chem-electrons').cards.find((c) => c.term === 'Orbital filling order')
    if (!order) throw new Error('no filling-order card')
    const L: Record<string, number> = { s: 0, p: 1, d: 2, f: 3 }
    const subs = (order.definition.match(/\d[spdf]/g) ?? []).map((t) => ({ n: Number(t[0]), l: L[t[1]!]! }))
    expect(subs.length).toBe(19)
    expect(subs[0]).toEqual({ n: 1, l: 0 })
    for (let i = 1; i < subs.length; i++) {
      const a = subs[i - 1]!
      const b = subs[i]!
      // Madelung: fill by rising n + l, and inside a tie by rising n.
      const ka = a.n + a.l
      const kb = b.n + b.l
      expect(kb > ka || (kb === ka && b.n > a.n)).toBe(true)
    }
    for (const { n, l } of subs) expect(l).toBeLessThanOrEqual(n - 1)
  })

  it('the transition deck carries every taught word and a summary card per relation', () => {
    const cards = deck('sat-transitions').cards
    const groups = transitionGlossary()
    expect(cards.length).toBe(groups.reduce((n, g) => n + g.words.length + 1, 0))
    for (const group of groups) {
      for (const word of group.words) {
        const term = word.replace(/,$/, '')
        const match = cards.find((c) => c.term === term)
        if (!match) throw new Error(`no card for ${word}`)
        expect(match.definition).toContain(group.signals)
      }
      const summary = cards.find((c) => c.term.endsWith(' transitions'))
      expect(summary).toBeTruthy()
    }
    for (const group of groups) {
      const summaries = cards.filter((c) => c.term.endsWith(' transitions') && group.words.every((w) => c.definition.includes(w.replace(/,$/, ''))))
      expect(summaries.length).toBe(1)
    }
  })
})
