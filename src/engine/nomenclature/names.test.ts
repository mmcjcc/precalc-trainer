import { describe, expect, it } from 'vitest'
import { nameKey, readName } from './names'

describe('nameKey: one key for every accepted spelling', () => {
  it.each([
    ['iron(III) chloride', 'iron(iii) chloride'],
    ['Iron (III) Chloride', 'iron(iii) chloride'],
    ['iron ( III ) chloride', 'iron(iii) chloride'],
    ['iron(III)chloride', 'iron(iii) chloride'],
    ['  iron(III)   chloride ', 'iron(iii) chloride'],
    ['IRON(III) CHLORIDE', 'iron(iii) chloride'],
    ['aluminium oxide', 'aluminum oxide'],
    ['sodium sulphate', 'sodium sulfate'],
    ['hydrogen sulphide', 'hydrogen sulfide'],
    ['sulphuric acid', 'sulfuric acid'],
    ['caesium fluoride', 'cesium fluoride'],
    ['carbon monooxide', 'carbon monoxide'],
    ['carbon monoxide', 'carbon monoxide'],
    ['carbon mono-oxide', 'carbon monoxide'],
    ['dinitrogen pentaoxide', 'dinitrogen pentoxide'],
    ['dinitrogen tetraoxide', 'dinitrogen tetroxide'],
    ['dichlorine heptaoxide', 'dichlorine heptoxide'],
    ['carbon tetraiodide', 'carbon tetriodide'],
    ['carbon tetriodide', 'carbon tetriodide'],
    ['nitrogen triiodide', 'nitrogen triiodide'],
    ['sodium bicarbonate', 'sodium hydrogen carbonate'],
    ['sodium bisulfate', 'sodium hydrogen sulfate'],
    ['hydriodic acid', 'hydroiodic acid'],
    ['sodium ethanoate', 'sodium acetate'],
    ['dimercury chloride', 'mercury(i) chloride'],
    ['dimercury(I) chloride', 'mercury(i) chloride'],
    ['copper(II) sulfate penta hydrate', 'copper(ii) sulfate pentahydrate'],
    ['copper(II) sulfate penta-hydrate', 'copper(ii) sulfate pentahydrate'],
  ])('%s → %s', (input, key) => {
    expect(nameKey(input)).toBe(key)
  })
})

describe('readName', () => {
  const err = (t: string) => {
    const r = readName(t)
    return r.ok ? null : r.error
  }

  it('reads a name into its key and words', () => {
    const r = readName('Copper (II) Sulphate Pentahydrate')
    expect(r.ok && r.value).toEqual({ key: 'copper(ii) sulfate pentahydrate', words: ['copper(ii)', 'sulfate', 'pentahydrate'] })
  })

  it('treats an Arabic numeral, a bare Roman numeral or a classical name as not an attempt', () => {
    expect(err('iron(3) chloride')).toMatchObject({ reason: 'not_in_form', position: 5 })
    expect(err('iron(3+) chloride')).toMatchObject({ reason: 'not_in_form', position: 5 })
    expect(err('iron 3 chloride')).toMatchObject({ reason: 'not_in_form', position: 5 })
    expect(err('iron(3) chloride')!.message).toMatch(/Roman numeral/)
    expect(err('iron III chloride')).toMatchObject({ reason: 'not_in_form', position: 5, length: 3 })
    expect(err('iron III chloride')!.message).toMatch(/parentheses/)
    expect(err('iron(IIII) chloride')).toMatchObject({ reason: 'not_in_form' })
    expect(err('ferric chloride')).toMatchObject({ reason: 'not_in_form', position: 0, length: 6 })
    expect(err('ferric chloride')!.message).toMatch(/older name for iron\(III\).*Stock system/)
    expect(err('Cuprous oxide')!.message).toMatch(/copper\(I\)/)
    expect(err('copper(II) sulfate 5 hydrate')).toMatchObject({ reason: 'not_in_form', position: 19 })
    expect(err('copper(II) sulfate 5 hydrate')!.message).toMatch(/Greek prefix/)
    // "chromic acid" is an acid name, not the classical name of chromium(III).
    expect(readName('chromic acid').ok).toBe(true)
  })

  it('rejects what is not a name', () => {
    expect(err('')).toMatchObject({ reason: 'unreadable' })
    expect(err('sodium + chloride')).toMatchObject({ reason: 'unreadable', position: 7 })
    expect(err('iron((III)) chloride')!.reason).toBe('unreadable')
    expect(err('iron(III chloride')!.reason).toBe('unreadable')
    expect(err('iron III) chloride')!.reason).toBe('unreadable')
    expect(err('(III) iron chloride')).toMatchObject({ reason: 'not_in_form' })
    expect(err('iron(aq) chloride')!.reason).toBe('unreadable')
  })
})
