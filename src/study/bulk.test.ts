/**
 * Paste to cards (study/bulk.ts): the separator is found from the text, a line without one carries
 * on the card before it, and nothing is ever dropped silently (skipped, clipped, overflow).
 */
import { describe, expect, it } from 'vitest'
import { STUDY_LIMITS } from '@/store/studySets'
import { parseBulkCards } from './bulk'

function pairs(text: string, split?: Parameters<typeof parseBulkCards>[1]) {
  return parseBulkCards(text, split).cards.map((c) => [c.term, c.definition])
}

describe('paste to cards', () => {
  it('reads a Quizlet or spreadsheet export: a tab between term and definition', () => {
    const r = parseBulkCards('hola\thello\nadiós\tgoodbye\r\ngracias\tthank you\n')
    expect(r.split).toBe('tab')
    expect(r.cards).toEqual([
      { term: 'hola', definition: 'hello' },
      { term: 'adiós', definition: 'goodbye' },
      { term: 'gracias', definition: 'thank you' },
    ])
    expect(r.skipped).toEqual([])
  })

  it('reads "term - definition" and keeps hyphens inside words and number ranges', () => {
    const r = parseBulkCards(
      ['Photon - a particle of light', 'Wave-particle duality - light acts as both', 'Visible light – about 400–700 nm', 'Orbital — where an electron probably is'].join('\n'),
    )
    expect(r.split).toBe('dash')
    expect(r.cards.map((c) => c.term)).toEqual(['Photon', 'Wave-particle duality', 'Visible light', 'Orbital'])
    expect(r.cards[2]!.definition).toBe('about 400–700 nm')
    expect(r.cards[3]!.definition).toBe('where an electron probably is')
  })

  it('reads "term: definition" and arrows', () => {
    expect(pairs('Cation: a positive ion\nAnion: a negative ion')).toEqual([
      ['Cation', 'a positive ion'],
      ['Anion', 'a negative ion'],
    ])
    expect(pairs('s -> 1 orbital\np → 3 orbitals\nd => 5 orbitals')).toEqual([
      ['s', '1 orbital'],
      ['p', '3 orbitals'],
      ['d', '5 orbitals'],
    ])
  })

  it('her notes: dashes and colons mixed, bullets and numbers dropped, the first separator wins', () => {
    const notes = [
      '▷ Heisenberg Uncertainty Principle - it is impossible to measure the position and velocity of a particle at the same time',
      '• Aufbau Principle: energy orbitals - all lower energy orbitals must be filled before higher',
      "3. Hund's Rule - orbitals of equal energy are first occupied by one electron each",
      '- Pauli Exclusion Principle: no 2 electrons can have the same 4 quantum #s',
    ].join('\n')
    const r = parseBulkCards(notes)
    expect(r.cards.map((c) => c.term)).toEqual(['Heisenberg Uncertainty Principle', 'Aufbau Principle', "Hund's Rule", 'Pauli Exclusion Principle'])
    expect(r.cards[1]!.definition).toBe('energy orbitals - all lower energy orbitals must be filled before higher')
    expect(r.skipped).toEqual([])
  })

  it('a formula keeps its equals sign when the list is written with dashes or colons', () => {
    expect(pairs('c = λν - the speed of light\nE = hν: the energy of one photon')).toEqual([
      ['c = λν', 'the speed of light'],
      ['E = hν', 'the energy of one photon'],
    ])
    expect(pairs('uno = one\ndos = two')).toEqual([
      ['uno', 'one'],
      ['dos', 'two'],
    ])
  })

  it('a line with no separator carries on the card before it; one before any card is skipped', () => {
    const r = parseBulkCards(['Chapter 5', 'Ground state - the lowest energy', 'arrangement of the electrons', 'Excited state:', 'after an electron jumps up'].join('\n'))
    expect(r.cards).toEqual([
      { term: 'Ground state', definition: 'the lowest energy arrangement of the electrons' },
      { term: 'Excited state', definition: 'after an electron jumps up' },
    ])
    expect(r.skipped).toEqual(['Chapter 5'])
  })

  it('no separators at all: every other line, or blocks parted by blank lines', () => {
    const alternating = parseBulkCards('mitochondria\nthe powerhouse\nnucleus\nthe control center\nleftover')
    expect(alternating.split).toBe('lines')
    expect(alternating.cards).toEqual([
      { term: 'mitochondria', definition: 'the powerhouse' },
      { term: 'nucleus', definition: 'the control center' },
    ])
    expect(alternating.skipped).toEqual(['leftover'])
    expect(pairs('mitochondria\nthe powerhouse\nof the cell\n\nnucleus\nthe control center')).toEqual([
      ['mitochondria', 'the powerhouse of the cell'],
      ['nucleus', 'the control center'],
    ])
  })

  it('her choice of separator is used alone', () => {
    expect(pairs('Ratio 1:1 - equal parts\nRatio 2:1 - two to one', 'dash')).toEqual([
      ['Ratio 1:1', 'equal parts'],
      ['Ratio 2:1', 'two to one'],
    ])
    expect(pairs('a - b: c', 'colon')).toEqual([['a - b', 'c']])
    expect(pairs('one\nuno\ntwo\ndos', 'lines')).toEqual([
      ['one', 'uno'],
      ['two', 'dos'],
    ])
    const none = parseBulkCards('no tabs here - at all', 'tab')
    expect(none.cards).toEqual([])
    expect(none.skipped).toEqual(['no tabs here - at all'])
  })

  it('a term with nothing after it is reported, not kept', () => {
    const r = parseBulkCards('Photon - a particle of light\nQuantum -   \nOrbital:')
    expect(r.cards.map((c) => c.term)).toEqual(['Photon'])
    expect(r.skipped).toEqual(['Quantum', 'Orbital'])
  })

  it('long fields are shortened and counted; cards past the room are counted', () => {
    const long = 'x'.repeat(STUDY_LIMITS.maxField + 40)
    const r = parseBulkCards(`a - ${long}\nb - short`)
    expect(r.clipped).toBe(1)
    expect(r.cards[0]!.definition.length).toBe(STUDY_LIMITS.maxField)
    const many = Array.from({ length: 12 }, (_, i) => `t${i} - d${i}`).join('\n')
    const tight = parseBulkCards(many, 'auto', 10)
    expect(tight.cards.length).toBe(10)
    expect(tight.overflow).toBe(2)
  })

  it('nothing pasted is nothing found', () => {
    expect(parseBulkCards('  \n\n ')).toEqual({ cards: [], split: null, skipped: [], clipped: 0, overflow: 0 })
  })
})
