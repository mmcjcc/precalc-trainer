import { describe, expect, it } from 'vitest'
import { GRID_KEYS, KEYPAD_SETS, allKeys, deleteBackward, insertKey, keypadLayout, letterKey, moveCaret, revealDelta } from './keypadKeys'
import { DIFF_QUOTIENT_KEYS, FUNCTION_KEYS, LOG_KEYS, SET_ANSWER_KEYS, STRIP_KEYS, type StripKey } from './symbolStrip'

const grid = (name: string): StripKey => {
  const k = GRID_KEYS.find((g) => g.name === name)
  if (!k) throw new Error(`no grid key ${name}`)
  return k
}
const strip = (label: string, keys: readonly StripKey[] = STRIP_KEYS): StripKey => {
  const k = keys.find((s) => s.label === label)
  if (!k) throw new Error(`no strip key ${label}`)
  return k
}
const labels = (keys: readonly StripKey[]) => keys.map((k) => k.label)

describe('the grid', () => {
  it('has the digits, the point, the four operations, brackets, a power, comma and equals', () => {
    for (const d of '0123456789') expect(GRID_KEYS.some((k) => k.insert === d)).toBe(true)
    expect(grid('point').insert).toBe('.')
    expect(grid('plus').insert).toBe('+')
    expect(grid('minus').insert).toBe('-')
    expect(grid('comma').insert).toBe(',')
    expect(grid('open parenthesis').insert).toBe('(')
    expect(grid('close parenthesis').insert).toBe(')')
  })

  it('inserts what the parser reads, under the names a screen reader speaks', () => {
    expect(grid('times')).toMatchObject({ label: '×', insert: '*' })
    expect(grid('divide')).toMatchObject({ label: '÷', insert: '/' })
    expect(grid('power')).toMatchObject({ insert: '^' })
    expect(grid('squared')).toMatchObject({ label: 'x²', insert: '^2' })
    expect(grid('equals').insert).toBe(' = ')
    for (const k of GRID_KEYS) expect(k.insert).toMatch(/^[\x20-\x7e]+$/)
  })

  it('gives every key its own cell', () => {
    const areas = GRID_KEYS.map((k) => k.area)
    expect(new Set(areas).size).toBe(areas.length)
  })
})

describe('keypadLayout: the grid letter and the context row from a box’s strip', () => {
  it('the full strip: x in the grid, y first in the row, nothing the grid already has', () => {
    const { primary, context } = keypadLayout(STRIP_KEYS)
    expect(primary.insert).toBe('x')
    expect(context[0]!.insert).toBe('y')
    const row = labels(context)
    for (const dup of ['x', '^', '(', ')', '/', '=']) expect(row).not.toContain(dup)
    for (const kept of ['<', '≤', '>', '≥', '√', '³√', '| |', '∞', '∪', '{ }', 'π', '±', 'or', '[', ']', '≠', '|']) expect(row).toContain(kept)
    expect(row.indexOf('≤')).toBeLessThan(row.indexOf('π'))
  })

  it('logs: the other letters, then the log keys in strip order', () => {
    expect(labels(keypadLayout(LOG_KEYS).context)).toEqual(['y', 'n', 'or', 'log', 'ln', 'log_', 'e^', 'logBASE'])
  })

  it('functions and the difference quotient keep their own keys', () => {
    expect(labels(keypadLayout(FUNCTION_KEYS).context)).toEqual(['√', '³√', '| |'])
    expect(labels(keypadLayout(DIFF_QUOTIENT_KEYS).context)).toEqual(['h', '√'])
  })

  it('a box whose first letter is not x puts its own letter in the grid', () => {
    const complex = [letterKey('i'), strip('√'), strip('±'), strip('('), strip(')')]
    const { primary, context } = keypadLayout(complex)
    expect(primary.insert).toBe('i')
    expect(labels(context)).toEqual(['√', '±'])
  })

  it('a number box gets x and no context row; vars replace the strip’s letters', () => {
    expect(keypadLayout()).toEqual({ primary: letterKey('x'), context: [] })
    expect(keypadLayout(KEYPAD_SETS.number).context).toEqual([])
    const range = keypadLayout(SET_ANSWER_KEYS, ['y'])
    expect(range.primary.insert).toBe('y')
    expect(labels(range.context)).not.toContain('x')
    expect(labels(keypadLayout(KEYPAD_SETS.xy).context)).toEqual(['y'])
  })

  it('a strip comma is the grid comma', () => {
    const geo: StripKey[] = [strip('√'), { label: '°', insert: '°', caret: 0, name: 'degrees' }, strip('('), { label: ',', insert: ',', caret: 0, name: 'comma' }]
    expect(labels(keypadLayout(geo).context)).toEqual(['√', '°'])
  })
})

describe('insertKey: the strip’s insertion', () => {
  it('inserts at the caret', () => {
    expect(insertKey('x+1', 1, 1, grid('power'))).toEqual({ value: 'x^+1', caret: 2 })
    expect(insertKey('3', 1, 1, grid('times'))).toEqual({ value: '3*', caret: 2 })
  })

  it('replaces a selection', () => {
    expect(insertKey('x+12', 2, 4, grid('divide'))).toEqual({ value: 'x+/', caret: 3 })
  })

  it('a function key lands inside its parentheses, and wraps a selection', () => {
    expect(insertKey('2', 1, 1, strip('ln', LOG_KEYS))).toEqual({ value: '2ln()', caret: 4 })
    expect(insertKey('x+1', 0, 3, strip('√'))).toEqual({ value: 'sqrt(x+1)', caret: 8 })
    expect(insertKey('', 0, 0, strip('log_', LOG_KEYS))).toEqual({ value: 'log_()', caret: 4 })
  })

  it('equals keeps one space on each side', () => {
    expect(insertKey('x ', 2, 2, grid('equals')).value).toBe('x = ')
    expect(insertKey('(x+2)ln(7)', 10, 10, grid('equals')).value).toBe('(x+2)ln(7) = ')
  })
})

describe('deleteBackward', () => {
  const keys = allKeys(keypadLayout(LOG_KEYS.concat(STRIP_KEYS)))

  it('deletes a selection, or one character', () => {
    expect(deleteBackward('x+12', 1, 3, keys)).toEqual({ value: 'x2', caret: 1 })
    expect(deleteBackward('x+12', 4, 4, keys)).toEqual({ value: 'x+1', caret: 3 })
    expect(deleteBackward('x+12', 2, 2, keys)).toEqual({ value: 'x12', caret: 1 })
    expect(deleteBackward('x', 0, 0, keys)).toEqual({ value: 'x', caret: 0 })
  })

  it('one tap undoes one key: an empty template goes with its brackets', () => {
    expect(deleteBackward('2sqrt()', 6, 6, keys)).toEqual({ value: '2', caret: 1 })
    expect(deleteBackward('ln()', 3, 3, keys)).toEqual({ value: '', caret: 0 })
    expect(deleteBackward('log_()', 4, 4, keys)).toEqual({ value: '', caret: 0 })
    expect(deleteBackward('{}', 1, 1, keys)).toEqual({ value: '', caret: 0 })
    // Not empty: one character, as on any keyboard.
    expect(deleteBackward('sqrt(2)', 6, 6, keys)).toEqual({ value: 'sqrt()', caret: 5 })
  })

  it('a spaced token goes with its spaces', () => {
    expect(deleteBackward('x = ', 4, 4, keys)).toEqual({ value: 'x', caret: 1 })
    expect(deleteBackward('x <= ', 5, 5, keys)).toEqual({ value: 'x', caret: 1 })
    expect(deleteBackward('x < 2 or ', 9, 9, keys)).toEqual({ value: 'x < 2', caret: 5 })
    expect(deleteBackward('x = 5', 5, 5, keys)).toEqual({ value: 'x = ', caret: 4 })
  })

  it('a word typed on abc is not a key: "for" loses one letter', () => {
    expect(deleteBackward('for', 3, 3, keys)).toEqual({ value: 'fo', caret: 2 })
  })

  it('a name typed with one key goes whole', () => {
    expect(deleteBackward('2pi', 3, 3, keys)).toEqual({ value: '2', caret: 1 })
    expect(deleteBackward('(-inf', 5, 5, keys)).toEqual({ value: '(-', caret: 2 })
  })
})

describe('moveCaret', () => {
  it('moves one character and stops at the ends', () => {
    expect(moveCaret('x+1', 3, 3, -1)).toBe(2)
    expect(moveCaret('x+1', 0, 0, -1)).toBe(0)
    expect(moveCaret('x+1', 1, 1, 1)).toBe(2)
    expect(moveCaret('x+1', 3, 3, 1)).toBe(3)
  })

  it('collapses a selection to its start or end', () => {
    expect(moveCaret('x+12', 1, 3, -1)).toBe(1)
    expect(moveCaret('x+12', 1, 3, 1)).toBe(3)
  })
})

describe('revealDelta: what to scroll so the box sits above the keypad', () => {
  const band = { top: 8, bottom: 400 }

  it('nothing when the whole card is already in view', () => {
    expect(revealDelta({ top: 100, bottom: 148 }, { top: 60, bottom: 160 }, { top: 40, bottom: 300 }, band)).toBe(0)
  })

  it('a card behind the keypad scrolls up just enough to show all of it', () => {
    expect(revealDelta({ top: 500, bottom: 548 }, { top: 460, bottom: 600 }, { top: 420, bottom: 700 }, band)).toBe(300)
  })

  it('a card taller than the room shows the box’s own block, then the box itself', () => {
    // The block down to the card's end does not fit; the block (preview and box) does, all of it.
    expect(revealDelta({ top: 900, bottom: 948 }, { top: 860, bottom: 1000 }, { top: 0, bottom: 2000 }, band)).toBe(600)
    // The block and what follows it in the card (her message) fit together: both are shown.
    expect(revealDelta({ top: 900, bottom: 948 }, { top: 860, bottom: 1000 }, { top: 0, bottom: 1200 }, band)).toBe(800)
    // Even a block taller than the room never leaves the box behind the keypad.
    const delta = revealDelta({ top: 1500, bottom: 1548 }, { top: 0, bottom: 2000 }, { top: 0, bottom: 2000 }, band)
    expect(1548 - delta).toBeLessThanOrEqual(band.bottom)
    expect(1500 - delta).toBeGreaterThanOrEqual(band.top)
  })

  it('a card above the screen scrolls back down to it', () => {
    expect(revealDelta({ top: -100, bottom: -52 }, { top: -140, bottom: -40 }, { top: -160, bottom: 0 }, band)).toBe(-168)
  })
})
