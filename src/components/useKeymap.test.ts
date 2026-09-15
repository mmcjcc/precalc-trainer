import { describe, expect, it } from 'vitest'
import { matchKey, type KeyLike } from './useKeymap'

const k = (key: string, mods: Partial<KeyLike> = {}): KeyLike => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods })
const outside = { inField: false, fieldEmpty: true }
const emptyField = { inField: true, fieldEmpty: true }
const typing = { inField: true, fieldEmpty: false }

describe('matchKey (desktop keymap, UX-07)', () => {
  it('Ctrl+Shift+H/G/C open hint, graph, calculator (also with Cmd, any case)', () => {
    expect(matchKey(k('H', { ctrlKey: true, shiftKey: true }), typing)).toEqual({ kind: 'hint' })
    expect(matchKey(k('g', { metaKey: true, shiftKey: true }), outside)).toEqual({ kind: 'graph' })
    expect(matchKey(k('C', { ctrlKey: true, shiftKey: true }), typing)).toEqual({ kind: 'calc' })
    expect(matchKey(k('c', { ctrlKey: true }), typing)).toBeNull() // plain Ctrl+C is copy
  })

  it('Ctrl+Z undoes the last step only when not editing text', () => {
    expect(matchKey(k('z', { ctrlKey: true }), outside)).toEqual({ kind: 'undo' })
    expect(matchKey(k('z', { ctrlKey: true }), emptyField)).toEqual({ kind: 'undo' })
    expect(matchKey(k('z', { ctrlKey: true }), typing)).toBeNull()
  })

  it('Escape always maps; Enter submits only outside a field (the form handles it inside)', () => {
    expect(matchKey(k('Escape'), typing)).toEqual({ kind: 'escape' })
    expect(matchKey(k('Enter'), outside)).toEqual({ kind: 'submit' })
    expect(matchKey(k('Enter'), typing)).toBeNull()
  })

  it('digits pick chips only while the chip group is active and focus is not in a text field', () => {
    expect(matchKey(k('3'), outside, { chipsActive: true })).toEqual({ kind: 'digit', n: 3 })
    // F1: an empty step input is where the next line starts (3x < 21): the digit belongs to the input.
    expect(matchKey(k('0'), emptyField, { chipsActive: true })).toBeNull()
    expect(matchKey(k('3'), typing, { chipsActive: true })).toBeNull()
    expect(matchKey(k('3'), outside, { chipsActive: false })).toBeNull()
  })

  it('? opens the cheat-sheet outside fields; Alt combos are never ours', () => {
    expect(matchKey(k('?'), outside)).toEqual({ kind: 'help' })
    expect(matchKey(k('?'), typing)).toBeNull()
    expect(matchKey(k('h', { altKey: true }), outside)).toBeNull()
  })
})
