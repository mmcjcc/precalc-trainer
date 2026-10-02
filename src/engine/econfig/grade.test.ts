import { describe, expect, it } from 'vitest'
import { configurationMistakes, gradeConfiguration, gradeFullConfiguration, gradeShorthandConfiguration } from './grade'
import type { EconfigGrade, EconfigMistakeKind } from './types'

function mistakeOf(g: EconfigGrade): EconfigMistakeKind | null {
  return g.verdict === 'mistake' ? g.mistake : null
}

function witnessOf(g: EconfigGrade): string {
  if (g.verdict !== 'mistake') throw new Error(`expected a named mistake, got ${g.verdict}: ${'message' in g ? g.message : ''}`)
  return g.witness
}

function messageOf(g: EconfigGrade): string {
  return g.verdict === 'mistake' ? g.witness : g.message
}

describe('right answers', () => {
  it('accepts the full configuration in filling order and in shell order', () => {
    expect(gradeFullConfiguration('Fe', '1s2 2s2 2p6 3s2 3p6 4s2 3d6').verdict).toBe('correct')
    expect(gradeFullConfiguration('Fe', '1s2 2s2 2p6 3s2 3p6 3d6 4s2').verdict).toBe('correct')
    expect(gradeFullConfiguration('Fe', '1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶').verdict).toBe('correct')
    expect(gradeFullConfiguration('Fe', '1S2, 2S2, 2P6, 3S2, 3P6, 4S2, 3D6').verdict).toBe('correct')
    expect(gradeFullConfiguration('Fe', '1s^2 2s^2 2p^6 3s^2 3p^6 4s^2 3d^6').verdict).toBe('correct')
    expect(gradeFullConfiguration('H', '1s1').verdict).toBe('correct')
  })

  it('accepts the shorthand in either order', () => {
    expect(gradeShorthandConfiguration('Fe', '[Ar] 4s2 3d6')).toEqual({ verdict: 'correct', message: 'Correct: Fe is [Ar] 4s² 3d⁶.' })
    expect(gradeShorthandConfiguration('Fe', '[Ar] 3d6 4s2')).toEqual({ verdict: 'correct', message: 'Correct: Fe is [Ar] 3d⁶ 4s².' })
    expect(gradeShorthandConfiguration('Br', '[ar] 3d10 4s2 4p5').verdict).toBe('correct')
    expect(gradeShorthandConfiguration('Ar', '[Ne] 3s2 3p6').verdict).toBe('correct')
  })

  it('accepts the exceptions and says why', () => {
    expect(messageOf(gradeShorthandConfiguration('Cr', '[Ar] 4s1 3d5'))).toBe(
      'Correct: Cr is [Ar] 4s¹ 3d⁵. Chromium is one of the two exceptions: one electron moves from 4s to 3d, because a half-filled 3d subshell (3d⁵) is extra stable.',
    )
    expect(messageOf(gradeShorthandConfiguration('Cu', '[Ar] 3d10 4s1'))).toContain('a completely filled 3d subshell (3d¹⁰) is extra stable')
    expect(gradeFullConfiguration('Cu', '1s2 2s2 2p6 3s2 3p6 4s1 3d10').verdict).toBe('correct')
  })

  it('accepts ions, and notes what happened', () => {
    expect(messageOf(gradeShorthandConfiguration('Fe3+', '[Ar] 3d5'))).toBe('Correct: Fe³⁺ is [Ar] 3d⁵. The 4s electrons leave first, before any 3d electron.')
    expect(messageOf(gradeFullConfiguration('Na+', '1s2 2s2 2p6'))).toBe('Correct: Na⁺ is 1s² 2s² 2p⁶. That is the same configuration as neon.')
    expect(gradeFullConfiguration('Cu+', '1s2 2s2 2p6 3s2 3p6 3d10').verdict).toBe('correct')
    expect(gradeFullConfiguration('Zn2+', '1s2 2s2 2p6 3s2 3p6 3d10').verdict).toBe('correct')
    expect(gradeFullConfiguration('Fe2+', '1s2 2s2 2p6 3s2 3p6 3d6').verdict).toBe('correct')
    expect(gradeFullConfiguration('Fe2+', '1s2 2s2 2p6 3s2 3p6 4s0 3d6').verdict).toBe('correct')
  })

  it('an ion with a noble-gas configuration: the gas alone, or the gas before it and the full outer shell', () => {
    expect(gradeShorthandConfiguration('Na+', '[Ne]').verdict).toBe('correct')
    expect(gradeShorthandConfiguration('Na+', '[He] 2s2 2p6').verdict).toBe('correct')
    expect(gradeShorthandConfiguration('S2-', '[Ar]').verdict).toBe('correct')
    expect(gradeShorthandConfiguration('S2-', '[Ne] 3s2 3p6').verdict).toBe('correct')
    expect(gradeShorthandConfiguration('Br-', '[Kr]').verdict).toBe('correct')
    expect(gradeShorthandConfiguration('Br-', '[Ar] 4s2 3d10 4p6').verdict).toBe('correct')
    expect(gradeShorthandConfiguration('Li+', '[He]').verdict).toBe('correct')
    expect(gradeShorthandConfiguration('Li+', '1s2').verdict).toBe('correct')
  })
})

describe('form: full versus shorthand', () => {
  it('shorthand where the full configuration was asked is not an attempt', () => {
    const g = gradeFullConfiguration('Fe', '[Ar] 4s2 3d6')
    expect(g).toEqual({
      verdict: 'invalid',
      message: 'That is the noble-gas shorthand. This question asks for the full configuration: write out every subshell, starting from 1s.',
      position: 0,
      length: 4,
    })
  })

  it('a full configuration where the shorthand was asked is not an attempt', () => {
    const g = gradeShorthandConfiguration('Fe', '1s2 2s2 2p6 3s2 3p6 4s2 3d6')
    expect(g.verdict).toBe('invalid')
    expect(messageOf(g)).toContain('start with a noble gas in square brackets')
  })

  it('hydrogen and helium have no shorthand: the full configuration is accepted', () => {
    expect(gradeShorthandConfiguration('He', '1s2').verdict).toBe('correct')
    expect(gradeShorthandConfiguration('H', '1s1').verdict).toBe('correct')
  })

  it("'either' (the default) accepts both forms", () => {
    expect(gradeConfiguration('Fe', '[Ar] 4s2 3d6').verdict).toBe('correct')
    expect(gradeConfiguration('Fe', '1s2 2s2 2p6 3s2 3p6 4s2 3d6').verdict).toBe('correct')
  })

  it('unreadable input is invalid with a position; a species outside the model is unsupported', () => {
    expect(gradeFullConfiguration('Fe', '1s2 2s')).toEqual({ verdict: 'invalid', message: 'Write how many electrons are in 2s, like 2s2.', position: 4, length: 2 })
    expect(gradeFullConfiguration('Fe', '')).toEqual({ verdict: 'invalid', message: 'Type the configuration, like 1s2 2s2 2p3.', position: 0 })
    expect(gradeFullConfiguration('Rb', '1s2').verdict).toBe('unsupported')
    expect(gradeFullConfiguration('Fe4+', '1s2')).toEqual({ verdict: 'unsupported', message: 'Fe⁴⁺ is outside the model: the taught charges of iron are 3+ and 2+.' })
  })
})

describe('electron_count: the total is wrong, and by how many', () => {
  it('one too few', () => {
    expect(gradeFullConfiguration('Fe', '1s2 2s2 2p6 3s2 3p6 4s2 3d5')).toEqual({
      verdict: 'mistake',
      mistake: 'electron_count',
      witness: 'Your configuration has 25 electrons (2 + 2 + 6 + 2 + 6 + 2 + 5 = 25), 1 too few. A neutral iron atom has 26, the same as its atomic number.',
    })
  })

  it('too many, and the shorthand shows the core in the sum', () => {
    expect(witnessOf(gradeFullConfiguration('O', '1s2 2s2 2p6'))).toContain('10 electrons (2 + 2 + 6 = 10), 2 too many. A neutral oxygen atom has 8')
    const g = gradeShorthandConfiguration('Fe', '[Ar] 4s2 3d7')
    expect(mistakeOf(g)).toBe('electron_count')
    expect(witnessOf(g)).toContain('27 electrons (18 in [Ar] + 2 + 7 = 27), 1 too many')
  })

  it('stopping early is a count mistake; a subshell skipped in the middle is a filling-order mistake', () => {
    expect(witnessOf(gradeFullConfiguration('Fe', '1s2 2s2 2p6 3s2 3p6 4s2'))).toContain('20 electrons (2 + 2 + 6 + 2 + 6 + 2 = 20), 6 too few')
    expect(mistakeOf(gradeFullConfiguration('H', '1s2'))).toBe('electron_count')
    expect(mistakeOf(gradeShorthandConfiguration('Cu', '[Ar] 4s1 3d9'))).toBe('electron_count')
    expect(mistakeOf(gradeFullConfiguration('Fe', '1s2 2s2 2p6 3s2 3p6 3d6'))).toBe('filling_order')
  })

  it('an ion whose total is on the wrong side but not the mirror image', () => {
    const g = gradeShorthandConfiguration('Fe2+', '[Ar] 4s2 3d7')
    expect(mistakeOf(g)).toBe('electron_count')
    expect(witnessOf(g)).toContain('Fe²⁺ has 26 − 2 = 24 electrons')
  })
})

describe('subshell_overfilled: more than s2, p6, d10', () => {
  it('names the subshell and its maximum', () => {
    expect(gradeFullConfiguration('Na', '1s2 2s2 2p7')).toEqual({
      verdict: 'mistake',
      mistake: 'subshell_overfilled',
      witness: '2p⁷ is too many: a p subshell has 3 orbitals with 2 electrons each, so it holds at most 6. Once 2p is full, the next electron starts the next subshell.',
    })
    expect(witnessOf(gradeFullConfiguration('Li', '1s3'))).toContain('1s³ is too many: an s subshell has 1 orbital with 2 electrons each, so it holds at most 2')
    expect(witnessOf(gradeShorthandConfiguration('Ga', '[Ar] 4s2 3d11'))).toContain('a d subshell has 5 orbitals with 2 electrons each, so it holds at most 10')
    expect(mistakeOf(gradeShorthandConfiguration('Sc', '[Ar] 4s3'))).toBe('subshell_overfilled')
  })
})

describe('subshell_nonexistent: 1p, 2d, 3f', () => {
  it('says which subshells the shell does have', () => {
    expect(gradeFullConfiguration('Na', '1s2 2s2 2p6 2d1')).toEqual({
      verdict: 'mistake',
      mistake: 'subshell_nonexistent',
      witness: 'There is no 2d subshell. Shell 2 has only s and p subshells: d subshells start at shell 3.',
    })
    expect(witnessOf(gradeFullConfiguration('Li', '1s2 1p1'))).toBe('There is no 1p subshell. Shell 1 has only an s subshell: p subshells start at shell 2.')
    expect(witnessOf(gradeFullConfiguration('K', '1s2 2s2 2p6 3s2 3p6 3f1'))).toBe('There is no 3f subshell. Shell 3 has only s, p and d subshells: f subshells start at shell 4.')
  })

  it('comes before the count and the maximum', () => {
    expect(mistakeOf(gradeFullConfiguration('Ne', '1s2 1p8'))).toBe('subshell_nonexistent')
  })
})

describe('filling_order: a subshell skipped or filled out of order', () => {
  it('3d filled before 4s (potassium as [Ar] 3d1)', () => {
    expect(gradeShorthandConfiguration('K', '[Ar] 3d1')).toEqual({
      verdict: 'mistake',
      mistake: 'filling_order',
      witness:
        'You put 1 electron in 3d while 4s is still empty. 4s is slightly lower in energy than 3d, so 4s fills first, right after 3p. Subshells fill in this order: 1s 2s 2p 3s 3p 4s 3d 4p.',
    })
    expect(mistakeOf(gradeFullConfiguration('K', '1s2 2s2 2p6 3s2 3p6 3d1'))).toBe('filling_order')
    expect(witnessOf(gradeShorthandConfiguration('Fe', '[Ar] 3d8'))).toContain('You put 8 electrons in 3d while 4s is still empty')
    expect(witnessOf(gradeShorthandConfiguration('Ca', '[Ar] 4s1 3d1'))).toContain('You put 1 electron in 3d while 4s has only 1')
    expect(mistakeOf(gradeShorthandConfiguration('Cr', '[Ar] 3d6'))).toBe('filling_order')
  })

  it('a skipped subshell is named even though it also makes the total wrong', () => {
    expect(witnessOf(gradeShorthandConfiguration('Br', '[Ar] 4s2 4p5'))).toBe(
      'You skipped 3d: it comes before 4p and has to fill first. Subshells fill in this order: 1s 2s 2p 3s 3p 4s 3d 4p.',
    )
    expect(witnessOf(gradeFullConfiguration('Na', '1s2 2s2 3s1'))).toContain('You skipped 2p: it comes before 3s')
    expect(witnessOf(gradeShorthandConfiguration('Sc', '[Ar] 3d1'))).toContain('You put 1 electron in 3d while 4s is still empty')
    expect(witnessOf(gradeFullConfiguration('K+', '1s2 2s2 2p6 3p6'))).toContain('You skipped 3s')
    expect(witnessOf(gradeShorthandConfiguration('Br-', '[Ar] 4s2 4p6'))).toContain('You skipped 3d')
  })

  it('a subshell skipped', () => {
    expect(witnessOf(gradeFullConfiguration('Na', '1s2 2s2 3s2 3p5'))).toContain('You skipped 2p: it comes before 3s and has to fill first.')
    expect(witnessOf(gradeFullConfiguration('B', '1s2 2p3'))).toContain('You skipped 2s')
  })

  it('moved on before a subshell was full', () => {
    expect(witnessOf(gradeShorthandConfiguration('Ga', '[Ar] 4s2 3d9 4p2'))).toContain('You moved on to 4p while 3d has only 9 of its 10 electrons')
    expect(witnessOf(gradeFullConfiguration('C', '1s2 2s1 2p3'))).toContain('You moved on to 2p while 2s has only 1 of its 2 electrons')
  })

  it('4d written for 3d', () => {
    const g = gradeFullConfiguration('Fe', '1s2 2s2 2p6 3s2 3p6 4s2 4d6')
    expect(mistakeOf(g)).toBe('filling_order')
    expect(witnessOf(g)).toContain('You wrote 4d, but the d subshell that fills in period 4 is 3d')
  })

  it('in an ion', () => {
    expect(mistakeOf(gradeFullConfiguration('S2-', '1s2 2s2 2p6 3s2 3p4 4s2'))).toBe('filling_order')
    expect(witnessOf(gradeShorthandConfiguration('Fe2+', '[Ar] 3d5 4p1'))).toContain('You moved on to 4p while 3d has only 5 of its 10 electrons')
  })

  it('the order she TYPES in is never a filling-order mistake', () => {
    expect(gradeFullConfiguration('Fe', '3d6 4s2 3p6 3s2 2p6 2s2 1s2').verdict).toBe('correct')
  })
})

describe('exception_missed: chromium and copper', () => {
  it('chromium as 4s2 3d4', () => {
    expect(gradeShorthandConfiguration('Cr', '[Ar] 4s2 3d4')).toEqual({
      verdict: 'mistake',
      mistake: 'exception_missed',
      witness:
        '4s² 3d⁴ follows the filling order exactly, but chromium is one of the two exceptions among the first 36 elements. A half-filled d subshell (3d⁵) is extra stable, so one electron moves from 4s to 3d.',
    })
    expect(mistakeOf(gradeShorthandConfiguration('Cr', '[Ar] 3d4 4s2'))).toBe('exception_missed')
    expect(mistakeOf(gradeFullConfiguration('Cr', '1s2 2s2 2p6 3s2 3p6 4s2 3d4'))).toBe('exception_missed')
  })

  it('copper as 4s2 3d9', () => {
    const g = gradeShorthandConfiguration('Cu', '[Ar] 4s2 3d9')
    expect(mistakeOf(g)).toBe('exception_missed')
    expect(witnessOf(g)).toContain('A completely filled d subshell (3d¹⁰) is extra stable')
  })
})

describe('exception_misapplied: the 4s → 3d move in an element that does not have it', () => {
  it.each([
    ['Fe', '[Ar] 4s1 3d7'],
    ['Mn', '[Ar] 4s1 3d6'],
    ['V', '[Ar] 4s1 3d4'],
    ['Ni', '[Ar] 3d9 4s1'],
    ['Sc', '[Ar] 4s1 3d2'],
  ])('%s as %s', (element, answer) => {
    expect(mistakeOf(gradeShorthandConfiguration(element, answer))).toBe('exception_misapplied')
  })

  it('names her 3d count and the rule', () => {
    expect(witnessOf(gradeShorthandConfiguration('Fe', '[Ar] 4s1 3d7'))).toBe(
      'You moved an electron from 4s to 3d (4s¹ 3d⁷). Only chromium and copper do that, because it gives them a half-filled (3d⁵) or completely filled (3d¹⁰) d subshell. 3d⁷ is neither, so iron follows the normal order and fills 4s completely.',
    )
  })

  it('does not fire on the real exceptions', () => {
    expect(gradeShorthandConfiguration('Cr', '[Ar] 4s1 3d5').verdict).toBe('correct')
    expect(gradeShorthandConfiguration('Cu', '[Ar] 4s1 3d10').verdict).toBe('correct')
  })
})

describe('ion_charge_ignored: the neutral atom given for the ion', () => {
  it('a cation', () => {
    expect(gradeFullConfiguration('Na+', '1s2 2s2 2p6 3s1')).toEqual({
      verdict: 'mistake',
      mistake: 'ion_charge_ignored',
      witness: 'Your configuration has 11 electrons (2 + 2 + 6 + 1 = 11), as many as a neutral sodium atom. Na⁺ has a 1+ charge, so it has lost 1 electron: 11 − 1 = 10.',
    })
    expect(mistakeOf(gradeShorthandConfiguration('Fe2+', '[Ar] 4s2 3d6'))).toBe('ion_charge_ignored')
    expect(mistakeOf(gradeShorthandConfiguration('Cr3+', '[Ar] 4s2 3d4'))).toBe('ion_charge_ignored')
  })

  it('an anion', () => {
    const g = gradeFullConfiguration('Cl-', '1s2 2s2 2p6 3s2 3p5')
    expect(mistakeOf(g)).toBe('ion_charge_ignored')
    expect(witnessOf(g)).toContain('Cl⁻ has a 1− charge, so it has gained 1 electron: 17 + 1 = 18.')
    expect(mistakeOf(gradeShorthandConfiguration('Cl-', '[Ne] 3s2 3p5'))).toBe('ion_charge_ignored')
  })
})

describe('ion_wrong_direction: electrons added for a cation, removed for an anion', () => {
  it('a cation with electrons added', () => {
    expect(gradeFullConfiguration('Na+', '1s2 2s2 2p6 3s2')).toEqual({
      verdict: 'mistake',
      mistake: 'ion_wrong_direction',
      witness:
        'Your configuration has 12 electrons (2 + 2 + 6 + 2 = 12), 1 MORE than the 11 of a neutral sodium atom. Electrons are negative, so a 1+ charge means the atom LOST 1 electron: 11 − 1 = 10.',
    })
    expect(mistakeOf(gradeShorthandConfiguration('Fe2+', '[Ar] 4s2 3d8'))).toBe('ion_wrong_direction')
  })

  it('an anion with electrons removed', () => {
    const g = gradeFullConfiguration('O2-', '1s2 2s2 2p2')
    expect(mistakeOf(g)).toBe('ion_wrong_direction')
    expect(witnessOf(g)).toContain('2 FEWER than the 8 of a neutral oxygen atom')
    expect(witnessOf(g)).toContain('a 2− charge means the atom GAINED 2 electrons: 8 + 2 = 10.')
    expect(mistakeOf(gradeShorthandConfiguration('Cl-', '[Ne] 3s2 3p4'))).toBe('ion_wrong_direction')
  })
})

describe('ion_removed_from_3d: a transition-metal cation that kept its 4s electrons', () => {
  it('Fe2+ as [Ar] 4s2 3d4', () => {
    expect(gradeShorthandConfiguration('Fe2+', '[Ar] 4s2 3d4')).toEqual({
      verdict: 'mistake',
      mistake: 'ion_removed_from_3d',
      witness:
        'Your configuration still has 2 electrons in 4s. When a transition metal becomes a positive ion, the 4s electrons leave FIRST, before any 3d electron: 4s is the outermost shell (n = 4). Fe²⁺ has no 4s electrons left.',
    })
  })

  it.each([
    ['Fe3+', '[Ar] 4s2 3d3'],
    ['Fe3+', '[Ar] 4s1 3d4'],
    ['Cu+', '[Ar] 4s1 3d9'],
    ['Cu2+', '[Ar] 4s1 3d8'],
    ['Zn2+', '[Ar] 4s2 3d8'],
    ['Cr3+', '[Ar] 4s1 3d2'],
    ['Mn2+', '1s2 2s2 2p6 3s2 3p6 4s2 3d3'],
  ])('%s as %s', (ion, answer) => {
    expect(mistakeOf(gradeConfiguration(ion, answer))).toBe('ion_removed_from_3d')
  })

  it('does not fire for a main-group cation or for the right answer', () => {
    expect(gradeShorthandConfiguration('Fe2+', '[Ar] 3d6').verdict).toBe('correct')
    expect(mistakeOf(gradeShorthandConfiguration('Ca2+', '[Ar] 4s2'))).toBe('ion_charge_ignored')
  })
})

describe('ion_wrong_number: the right direction, the wrong amount', () => {
  it('too few removed', () => {
    expect(gradeShorthandConfiguration('Fe3+', '[Ar] 3d6')).toEqual({
      verdict: 'mistake',
      mistake: 'ion_wrong_number',
      witness:
        'Your configuration has 24 electrons (18 in [Ar] + 6 = 24), 2 fewer than the 26 of a neutral iron atom. A 3+ charge means 3 electrons are removed, not 2: 26 − 3 = 23.',
    })
    expect(mistakeOf(gradeFullConfiguration('Mg2+', '1s2 2s2 2p6 3s1'))).toBe('ion_wrong_number')
    expect(mistakeOf(gradeShorthandConfiguration('Al3+', '[Ne] 3s2'))).toBe('ion_wrong_number')
  })

  it('too many removed, too few or too many added', () => {
    expect(mistakeOf(gradeFullConfiguration('Na+', '1s2 2s2 2p5'))).toBe('ion_wrong_number')
    const g = gradeFullConfiguration('O2-', '1s2 2s2 2p5')
    expect(mistakeOf(g)).toBe('ion_wrong_number')
    expect(witnessOf(g)).toContain('1 more than the 8 of a neutral oxygen atom. A 2− charge means 2 electrons are added, not 1: 8 + 2 = 10.')
    expect(witnessOf(gradeFullConfiguration('F-', '1s2 2s2 2p6 3s1'))).toContain('A 1− charge means 1 electron is added, not 2')
  })
})

describe('core_wrong: the wrong noble gas in the brackets', () => {
  it('an earlier noble gas with the right tail', () => {
    expect(gradeShorthandConfiguration('Ca', '[Ne] 4s2')).toEqual({
      verdict: 'mistake',
      mistake: 'core_wrong',
      witness:
        "[Ne] stands for neon's 10 electrons. The noble gas just before calcium is argon, [Ar], with 18: with [Ne] your configuration has only 12 electrons.",
    })
    expect(mistakeOf(gradeShorthandConfiguration('Fe', '[Ne] 4s2 3d6'))).toBe('core_wrong')
    expect(mistakeOf(gradeShorthandConfiguration('Na', '[He] 3s1'))).toBe('core_wrong')
    expect(witnessOf(gradeShorthandConfiguration('Cl-', '[Ne]'))).toContain('Cl⁻ has 18 electrons, and the noble gas to start from is argon, [Ar], with 18')
    expect(mistakeOf(gradeShorthandConfiguration('Fe2+', '[Ne] 3d6'))).toBe('core_wrong')
  })

  it('an earlier noble gas with every electron written out', () => {
    const g = gradeShorthandConfiguration('Ca', '[Ne] 3s2 3p6 4s2')
    expect(mistakeOf(g)).toBe('core_wrong')
    expect(witnessOf(g)).toBe(
      'Every electron is in the right place, but the shorthand uses the noble gas JUST before calcium: argon. [Ar] already covers 3s² 3p⁶, so only what comes after argon is written out.',
    )
    expect(witnessOf(gradeShorthandConfiguration('Cl-', '[He] 2s2 2p6 3s2 3p6'))).toContain('the shorthand uses the nearest noble gas with no more electrons than Cl⁻: argon. [Ar] already covers 2s² 2p⁶ 3s² 3p⁶')
    expect(mistakeOf(gradeShorthandConfiguration('Ar', '[He] 2s2 2p6 3s2 3p6'))).toBe('core_wrong')
  })

  it('an element that is not a noble gas', () => {
    expect(witnessOf(gradeShorthandConfiguration('Ti', '[Ca] 3d2'))).toBe(
      'Only a noble gas can go in the brackets, because all of its subshells are full. Ca (calcium) is not a noble gas. Use the noble gas that comes just before titanium in the periodic table.',
    )
    expect(witnessOf(gradeShorthandConfiguration('Cl-', '[Cl]'))).toContain('Cl (chlorine) is not a noble gas. Use a noble gas with no more electrons than Cl⁻ has (18).')
  })

  it('does not blame the core when the core fits her own (wrong) configuration', () => {
    expect(mistakeOf(gradeShorthandConfiguration('Fe', '[Ne] 3s2 3p6 4s2 3d5'))).toBe('electron_count')
    expect(mistakeOf(gradeShorthandConfiguration('Cl-', '[Ne] 3s2 3p5'))).toBe('ion_charge_ignored')
  })
})

describe('core_not_earlier: the element itself, or a later noble gas', () => {
  it('the element itself', () => {
    expect(gradeShorthandConfiguration('Ar', '[Ar]')).toEqual({
      verdict: 'mistake',
      mistake: 'core_not_earlier',
      witness:
        "[Ar] is argon itself, so it cannot stand in for part of argon's own configuration. The shorthand starts from the noble gas BEFORE the element: for argon that is neon, [Ne].",
    })
    expect(mistakeOf(gradeShorthandConfiguration('Kr', '[Kr]'))).toBe('core_not_earlier')
    expect(witnessOf(gradeShorthandConfiguration('He', '[He]'))).toContain('no noble gas comes before helium')
  })

  it('a later noble gas', () => {
    expect(witnessOf(gradeShorthandConfiguration('Ca', '[Kr] 4s2'))).toBe(
      "[Kr] stands for krypton's 36 electrons, more than the 20 in calcium. The core is the noble gas that comes BEFORE calcium in the periodic table, never one after it.",
    )
    expect(mistakeOf(gradeShorthandConfiguration('Na', '[Ar] 3s1'))).toBe('core_not_earlier')
    expect(mistakeOf(gradeShorthandConfiguration('Fe', '[Xe] 4s2 3d6'))).toBe('core_not_earlier')
    expect(mistakeOf(gradeShorthandConfiguration('H', '[He]'))).toBe('core_not_earlier')
    expect(witnessOf(gradeShorthandConfiguration('Na+', '[Ar]'))).toContain("[Ar] stands for argon's 18 electrons, but Na⁺ has only 10.")
  })

  it('does not fire on an ion whose configuration IS that noble gas', () => {
    expect(gradeShorthandConfiguration('K+', '[Ar]').verdict).toBe('correct')
    expect(gradeShorthandConfiguration('Cl-', '[Ar]').verdict).toBe('correct')
  })
})

describe('plain wrong: the core written out again', () => {
  it('says what the brackets already cover', () => {
    expect(gradeShorthandConfiguration('Ca', '[Ar] 3p6 4s2')).toEqual({
      verdict: 'wrong',
      message: '[Ar] already includes 3p⁶. After the brackets, write only the subshells that come after argon.',
    })
  })
})

describe('configurationMistakes: what each slip would produce', () => {
  const pairs = (species: string, form?: 'full' | 'shorthand') => configurationMistakes(species, form)!.map((c) => [c.kind, c.text])

  it('chromium, shorthand', () => {
    expect(pairs('Cr', 'shorthand')).toEqual([
      ['exception_missed', '[Ar] 4s2 3d4'],
      ['filling_order', '[Ar] 3d6'],
      ['electron_count', '[Ar] 4s1 3d4'],
      ['core_wrong', '[Ne] 4s1 3d5'],
      ['core_not_earlier', '[Kr] 4s1 3d5'],
    ])
  })

  it('iron, full', () => {
    expect(pairs('Fe')).toEqual([
      ['exception_misapplied', '1s2 2s2 2p6 3s2 3p6 4s1 3d7'],
      ['filling_order', '1s2 2s2 2p6 3s2 3p6 3d8'],
      ['electron_count', '1s2 2s2 2p6 3s2 3p6 4s2 3d5'],
    ])
  })

  it('sodium and potassium, full', () => {
    expect(pairs('Na')).toEqual([
      ['electron_count', '1s2 2s2 2p6'],
      ['subshell_overfilled', '1s2 2s2 2p7'],
      ['subshell_nonexistent', '1s2 2s2 2p6 2d1'],
    ])
    expect(pairs('K')).toEqual([
      ['filling_order', '1s2 2s2 2p6 3s2 3p6 3d1'],
      ['electron_count', '1s2 2s2 2p6 3s2 3p6'],
      ['subshell_overfilled', '1s2 2s2 2p6 3s2 3p7'],
    ])
    expect(pairs('Li')).toContainEqual(['subshell_nonexistent', '1s2 1p1'])
  })

  it('ions', () => {
    expect(pairs('Fe2+', 'shorthand')).toEqual([
      ['ion_charge_ignored', '[Ar] 4s2 3d6'],
      ['ion_wrong_direction', '[Ar] 4s2 3d8'],
      ['ion_removed_from_3d', '[Ar] 4s2 3d4'],
      ['ion_wrong_number', '[Ar] 4s1 3d6'],
      ['core_wrong', '[Ne] 3d6'],
      ['core_not_earlier', '[Kr] 3d6'],
    ])
    expect(pairs('Cl-')).toEqual([
      ['ion_charge_ignored', '1s2 2s2 2p6 3s2 3p5'],
      ['ion_wrong_direction', '1s2 2s2 2p6 3s2 3p4'],
      ['ion_wrong_number', '1s2 2s2 2p6 3s2 3p6 4s1'],
    ])
    expect(pairs('Cu+', 'shorthand')).toEqual([
      ['ion_charge_ignored', '[Ar] 4s1 3d10'],
      ['ion_wrong_direction', '[Ar] 4s2 3d10'],
      ['ion_removed_from_3d', '[Ar] 4s1 3d9'],
      ['ion_wrong_number', '[Ar] 3d9'],
      ['core_wrong', '[Ne] 3d10'],
      ['core_not_earlier', '[Kr] 3d10'],
    ])
    expect(pairs('Ar', 'shorthand')).toContainEqual(['core_not_earlier', '[Ar]'])
  })

  it('the candidate carries the sentence the grader gives', () => {
    const c = configurationMistakes('Cr', 'shorthand')![0]!
    expect(c.witness).toBe(witnessOf(gradeShorthandConfiguration('Cr', c.text)))
    expect(c.shadows).toEqual([])
  })

  it('is null outside the model', () => {
    expect(configurationMistakes('Rb')).toBeNull()
    expect(configurationMistakes('Fe4+')).toBeNull()
  })
})
