import { describe, expect, it } from 'vitest'
import { econfigAtoms, econfigIons, electronConfiguration, sameConfiguration, speciesText } from './model'
import { parseConfiguration, parseSpeciesAnswer } from './parse'
import { configurationDisplay, configurationText } from './text'
import type { ParsedConfiguration } from './types'

function read(text: string): ParsedConfiguration {
  const p = parseConfiguration(text)
  if (!p.ok) throw new Error(`expected "${text}" to parse: ${p.error.message}`)
  return p.value
}

/** "4s2 3d6" from the parsed terms, in the order she typed them. */
function typed(text: string): string {
  const v = read(text)
  return [v.core ? `[${v.core.symbol}]` : '', ...v.terms.map((t) => `${t.n}${t.l}${t.count}`)].filter((s) => s !== '').join(' ')
}

function failure(text: string): { message: string; position: number; length?: number } {
  const p = parseConfiguration(text)
  if (p.ok) throw new Error(`expected "${text}" to be a parse error`)
  return p.error
}

describe('parseConfiguration: the forms she may type', () => {
  it('reads a full configuration separated by spaces', () => {
    expect(read('1s2 2s2 2p6 3s1')).toEqual({
      core: null,
      terms: [
        { n: 1, l: 's', count: 2, position: 0, length: 3 },
        { n: 2, l: 's', count: 2, position: 4, length: 3 },
        { n: 2, l: 'p', count: 6, position: 8, length: 3 },
        { n: 3, l: 's', count: 1, position: 12, length: 3 },
      ],
    })
  })

  it('reads commas, semicolons and extra spaces', () => {
    expect(typed('1s2, 2s2, 2p3')).toBe('1s2 2s2 2p3')
    expect(typed('1s2,2s2,2p3')).toBe('1s2 2s2 2p3')
    expect(typed('  1s2;  2s2 ;2p3  ')).toBe('1s2 2s2 2p3')
  })

  it('reads counts written with ^, with braces, and with superscript digits', () => {
    expect(typed('1s^2 2s^2 2p^6')).toBe('1s2 2s2 2p6')
    expect(typed('3d^10 4s^{2}')).toBe('3d10 4s2')
    expect(typed('1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d¹⁰')).toBe('1s2 2s2 2p6 3s2 3p6 4s2 3d10')
    expect(typed('3d^{¹⁰}')).toBe('3d10')
  })

  it('reads upper and lower case letters', () => {
    expect(typed('1S2 2S2 2P6')).toBe('1s2 2s2 2p6')
    expect(typed('[AR] 4S2 3D6')).toBe('[Ar] 4s2 3d6')
    expect(typed('[ar] 4s2 3d6')).toBe('[Ar] 4s2 3d6')
  })

  it('reads subshells run together, with or without superscripts', () => {
    expect(typed('1s22s22p6')).toBe('1s2 2s2 2p6')
    expect(typed('1s22s22p63s23p64s23d104p5')).toBe('1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p5')
    expect(typed('1s²2s²2p⁶3s¹')).toBe('1s2 2s2 2p6 3s1')
    expect(typed('[Ar]4s23d10')).toBe('[Ar] 4s2 3d10')
    expect(typed('1s^22s^22p^3')).toBe('1s2 2s2 2p3')
  })

  it('keeps the order she typed, either way round', () => {
    expect(typed('[Ar] 4s2 3d6')).toBe('[Ar] 4s2 3d6')
    expect(typed('[Ar] 3d6 4s2')).toBe('[Ar] 3d6 4s2')
    expect(sameConfiguration(read('[Ar] 4s2 3d6').terms, read('[Ar] 3d6 4s2').terms)).toBe(true)
  })

  it('reads the shorthand core, alone or followed by subshells', () => {
    expect(read('[Ne] 3s1').core).toEqual({ symbol: 'Ne', z: 10, nobleGas: true, position: 0, length: 4 })
    expect(read('[ Ar ] 4s1').core).toEqual({ symbol: 'Ar', z: 18, nobleGas: true, position: 0, length: 6 })
    expect(read('[Ne]')).toEqual({ core: { symbol: 'Ne', z: 10, nobleGas: true, position: 0, length: 4 }, terms: [] })
    expect(read('[Xe] 6s2').core?.z).toBe(54)
    expect(read('[Ca] 3d2').core).toMatchObject({ symbol: 'Ca', z: 20, nobleGas: false })
  })

  it('reads subshells the graders will object to (it only reads; it does not judge)', () => {
    expect(typed('1s2 1p6')).toBe('1s2 1p6')
    expect(typed('2d4 3f1')).toBe('2d4 3f1')
    expect(typed('2p7')).toBe('2p7')
    expect(typed('3d12')).toBe('3d12')
    expect(typed('5s2 4d3 4f1')).toBe('5s2 4d3 4f1')
  })

  it('drops a subshell written with 0 electrons', () => {
    expect(typed('[Ar] 4s0 3d5')).toBe('[Ar] 3d5')
  })
})

describe('parseConfiguration: errors point at the character', () => {
  it('empty input', () => {
    expect(failure('')).toEqual({ message: 'Type the configuration, like 1s2 2s2 2p3.', position: 0 })
    expect(failure('   ').position).toBe(0)
  })

  it('a missing count', () => {
    expect(failure('1s2 2s 2p3')).toEqual({ message: 'Write how many electrons are in 2s, like 2s2.', position: 4, length: 2 })
    expect(failure('1s2 2p')).toEqual({ message: 'Write how many electrons are in 2p, like 2p6.', position: 4, length: 2 })
    expect(failure('3d')).toEqual({ message: 'Write how many electrons are in 3d, like 3d10.', position: 0, length: 2 })
    expect(failure('1s2s2')).toMatchObject({ message: 'Write how many electrons are in 1s, like 1s2.', position: 0 })
    expect(failure('2p^')).toMatchObject({ position: 0, length: 2 })
  })

  it('a letter that is not a subshell', () => {
    expect(failure('1s2 2g3')).toEqual({ message: '“g” is not a subshell letter. The subshells are s, p, d and f.', position: 5, length: 1 })
    expect(failure('1s2 2x')).toMatchObject({ position: 5, length: 1 })
  })

  it('a subshell without its shell number, or a number without its letter', () => {
    expect(failure('1s2 p6')).toEqual({ message: 'Write the shell number in front of the letter, like 2p.', position: 4, length: 1 })
    expect(failure('1s2 2 2p6')).toEqual({ message: 'After the shell number comes the subshell letter: s, p, d or f (like 2p6).', position: 4, length: 1 })
    expect(failure('0s2')).toEqual({ message: 'Shells are numbered from 1.', position: 0, length: 1 })
  })

  it('a subshell written twice', () => {
    expect(failure('1s2 2s2 2s2')).toEqual({ message: '2s is written twice. Write each subshell once, with all of its electrons.', position: 8, length: 3 })
  })

  it('a count with too many digits', () => {
    expect(failure('1s2 2p600')).toMatchObject({ position: 4, length: 5 })
  })

  it('a stray character', () => {
    expect(failure('1s2 + 2s2')).toEqual({ message: '“+” does not belong in a configuration. Write the subshells like 1s2 2s2 2p6.', position: 4, length: 1 })
    expect(failure('1s2 2s2.')).toMatchObject({ position: 7, length: 1 })
    expect(failure('²s2')).toMatchObject({ position: 0, length: 1 })
  })

  it('the noble gas: brackets, position, one only', () => {
    expect(failure('Ar 4s2 3d6')).toEqual({ message: 'Put the noble gas in square brackets: [Ar].', position: 0, length: 2 })
    expect(failure('ne 3s1')).toEqual({ message: 'Put the noble gas in square brackets: [Ne].', position: 0, length: 2 })
    expect(failure('(Ar) 4s2')).toEqual({ message: 'Use square brackets for the noble gas, like [Ar].', position: 0, length: 4 })
    expect(failure('{Ne} 3s1')).toMatchObject({ position: 0, length: 4 })
    expect(failure('[Ar 4s2')).toEqual({ message: 'This bracket is never closed. Write the noble gas like [Ar].', position: 0, length: 1 })
    expect(failure('[] 4s2')).toMatchObject({ position: 0, length: 2 })
    expect(failure('[Zz] 4s2')).toEqual({ message: 'No element has the symbol “Zz”. The core is a noble gas: [He], [Ne] or [Ar].', position: 0, length: 4 })
    expect(failure('4s2 [Ar] 3d6')).toEqual({ message: 'The noble gas goes first, before the subshells.', position: 4, length: 4 })
    expect(failure('[Ne] [Ar] 4s2')).toEqual({ message: 'Use only one noble gas, at the very start.', position: 5, length: 4 })
    expect(failure('[1s2]')).toMatchObject({ position: 0, length: 5 })
  })

  it('a word that is not a configuration', () => {
    expect(failure('iron')).toMatchObject({ position: 0, length: 4 })
    expect(failure('1s2 two')).toMatchObject({ position: 4, length: 3 })
  })
})

describe('parseConfiguration: round trips', () => {
  const all = [...econfigAtoms(), ...econfigIons()]

  it('every rendered configuration parses back to the same subshells, in every form and order', () => {
    for (const sp of all) {
      const right = electronConfiguration(sp)
      for (const order of ['filling', 'shell'] as const) {
        const full = read(configurationText(sp, { order }))
        expect(full.core, speciesText(sp)).toBeNull()
        expect(sameConfiguration(full.terms, right), `${speciesText(sp)} full ${order}`).toBe(true)
        // The display text (superscripts) reads back the same way.
        expect(sameConfiguration(read(configurationDisplay(sp, { order })).terms, right), `${speciesText(sp)} display ${order}`).toBe(true)
        // And with every space removed.
        expect(sameConfiguration(read(configurationText(sp, { order }).replace(/ /g, '')).terms, right), `${speciesText(sp)} squeezed ${order}`).toBe(true)
      }
    }
  })

  it('term positions point at the text of each term', () => {
    for (const sp of all) {
      const text = configurationText(sp, { form: 'shorthand' })
      const v = read(text)
      for (const t of v.terms) expect(text.slice(t.position, t.position + t.length)).toBe(`${t.n}${t.l}${t.count}`)
      if (v.core) expect(text.slice(v.core.position, v.core.position + v.core.length)).toBe(`[${v.core.symbol}]`)
    }
  })
})

describe('parseSpeciesAnswer', () => {
  const value = (text: string) => {
    const p = parseSpeciesAnswer(text)
    if (!p.ok) throw new Error(`expected "${text}" to parse: ${p.error.message}`)
    return p.value
  }

  it('reads a symbol in any case, or a name', () => {
    expect(value('Fe')).toEqual({ z: 26, symbol: 'Fe', charge: null, byName: false })
    expect(value(' fe ')).toEqual({ z: 26, symbol: 'Fe', charge: null, byName: false })
    expect(value('FE')).toMatchObject({ z: 26 })
    expect(value('iron')).toEqual({ z: 26, symbol: 'Fe', charge: null, byName: true })
    expect(value('Iron')).toMatchObject({ z: 26, byName: true })
    expect(value('aluminium')).toMatchObject({ z: 13 })
    expect(value('sulphur')).toMatchObject({ z: 16 })
    expect(value('K')).toMatchObject({ z: 19 })
  })

  it('reads an optional charge in the ways she may write it', () => {
    for (const text of ['Fe3+', 'Fe 3+', 'Fe^3+', 'Fe+3', 'Fe³⁺', 'Fe(3+)', 'iron 3+']) expect(value(text), text).toMatchObject({ z: 26, charge: 3 })
    for (const text of ['Cl-', 'Cl−', 'Cl⁻', 'Cl 1-', 'Cl-1']) expect(value(text), text).toMatchObject({ z: 17, charge: -1 })
    expect(value('O2-')).toMatchObject({ z: 8, charge: -2 })
    expect(value('Na+')).toMatchObject({ z: 11, charge: 1 })
  })

  it('errors carry a position', () => {
    const err = (text: string) => {
      const p = parseSpeciesAnswer(text)
      if (p.ok) throw new Error(`expected "${text}" to fail`)
      return p.error
    }
    expect(err('')).toEqual({ message: 'Type the element’s symbol or name, like Fe or iron.', position: 0 })
    expect(err('Zz')).toEqual({ message: 'No element has the symbol “Zz”.', position: 0, length: 2 })
    expect(err(' ironn')).toMatchObject({ position: 1, length: 5 })
    expect(err('Fe 3')).toEqual({ message: 'Give the charge a sign: 3+ for positive, 2- for negative.', position: 3, length: 1 })
    expect(err('Fe2+ ion')).toMatchObject({ position: 2 })
    expect(err('26')).toMatchObject({ position: 0 })
  })
})
