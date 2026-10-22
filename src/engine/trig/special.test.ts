/**
 * The special right triangles, every side from every other and back, against a table written out by hand and against
 * Math (each side is the hypotenuse times the sine of the angle across from it); and the slips of each direction.
 */
import { describe, expect, it } from 'vitest'
import { exactNum, exactText, type TrigExact } from './exact'
import { readExact } from './reader'
import { specialRoles, specialSide, specialSlips, type SpecialRole, type SpecialTriangle } from './special'
import { valueEq } from './values'

const ex = (t: string): TrigExact => {
  const v = readExact(t)
  if (v === null || v === 'undefined') throw new Error(`cannot read ${t}`)
  return v
}

/** The value as a number of its own in the text: "6" is not in "60°" or "6√3". */
const mentions = (text: string, value: string) => new RegExp(`(?<![\\d.√/])${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\d√/]|\\.\\d)`).test(text)

/** Written by hand: [triangle, the side given, its length, then every side of that triangle]. */
const TABLE: [SpecialTriangle, SpecialRole, string, Partial<Record<SpecialRole, string>>][] = [
  ['30', 'hyp', '10', { short: '5', long: '5√3', hyp: '10' }],
  ['30', 'short', '7', { short: '7', long: '7√3', hyp: '14' }],
  ['30', 'long', '6', { short: '2√3', long: '6', hyp: '4√3' }],
  ['30', 'long', '4√3', { short: '4', long: '4√3', hyp: '8' }],
  ['30', 'hyp', '9', { short: '9/2', long: '9√3/2', hyp: '9' }],
  ['30', 'short', '2√3', { short: '2√3', long: '6', hyp: '4√3' }],
  ['30', 'hyp', '4√3', { short: '2√3', long: '6', hyp: '4√3' }],
  ['30', 'long', '5', { short: '5√3/3', long: '5', hyp: '10√3/3' }],
  ['45', 'leg', '6', { leg: '6', hyp: '6√2' }],
  ['45', 'hyp', '8', { leg: '4√2', hyp: '8' }],
  ['45', 'hyp', '6√2', { leg: '6', hyp: '6√2' }],
  ['45', 'leg', '5√2', { leg: '5√2', hyp: '10' }],
  ['45', 'hyp', '7', { leg: '7√2/2', hyp: '7' }],
  ['45', 'leg', '2√3', { leg: '2√3', hyp: '2√6' }],
]

/** The angle across from each side, in degrees. */
const ACROSS: Record<SpecialTriangle, Partial<Record<SpecialRole, number>>> = {
  '45': { leg: 45, hyp: 90 },
  '30': { short: 30, long: 60, hyp: 90 },
}

describe('every special triangle, both ways', () => {
  it.each(TABLE)('%s-triangle, %s = %s', (tri, from, value, sides) => {
    for (const to of specialRoles(tri)) {
      const got = specialSide(tri, from, ex(value), to)
      expect(exactText(got), `${to} from ${from}`).toBe(sides[to])
      // Back again gives the side she was given.
      expect(exactText(specialSide(tri, to, got, from)), `${from} from ${to}`).toBe(value)
      // Math: a side is the hypotenuse times the sine of the angle across from it.
      const hyp = exactNum(ex(value)) / Math.sin((ACROSS[tri][from]! * Math.PI) / 180)
      expect(exactNum(got), `${to} numerically`).toBeCloseTo(hyp * Math.sin((ACROSS[tri][to]! * Math.PI) / 180), 10)
    }
  })
})

describe('the slips of each direction', () => {
  const ids = (tri: SpecialTriangle, from: SpecialRole, value: string, to: SpecialRole) => specialSlips(tri, from, ex(value), to).map((s) => `${s.id}=${exactText(s.value as TrigExact)}`)

  it('30-60-90 from the short leg 7: the long leg as 14 swaps the two factors; 7√3/3 divides the wrong way', () => {
    expect(ids('30', 'short', '7', 'long')).toEqual(['trig_special_root3_two_swapped=14', 'trig_special_wrong_way=7√3/3'])
    expect(ids('30', 'short', '7', 'hyp')).toEqual(['trig_special_root3_two_swapped=7√3', 'trig_special_wrong_way=7/2'])
  })

  it('30-60-90 from the hypotenuse 10: 5√3 for the short leg swaps the legs; 20 doubles instead of halving', () => {
    expect(ids('30', 'hyp', '10', 'short')).toEqual(['trig_special_root3_two_swapped=10√3/3', 'trig_special_legs_swapped=5√3', 'trig_special_wrong_way=20'])
    expect(ids('30', 'hyp', '10', 'long')).toEqual(['trig_special_root3_two_swapped=20√3/3', 'trig_special_legs_swapped=5'])
  })

  it('30-60-90 from the long leg 6: 6√3 for the short leg multiplies; 12 for the hypotenuse doubles the long leg', () => {
    expect(ids('30', 'long', '6', 'short')).toEqual(['trig_special_root3_two_swapped=3', 'trig_special_wrong_way=6√3'])
    expect(ids('30', 'long', '6', 'hyp')).toEqual(['trig_special_root3_two_swapped=3√3', 'trig_special_legs_swapped=12', 'trig_special_wrong_way=12√3'])
  })

  it('45-45-90: a leg of 6 gives 12 for leg·2 and 3√2 the wrong way; a hypotenuse of 8 gives 4 and 8√2', () => {
    expect(ids('45', 'leg', '6', 'hyp')).toEqual(['trig_special_45_two=12', 'trig_special_wrong_way=3√2'])
    expect(ids('45', 'hyp', '8', 'leg')).toEqual(['trig_special_45_two=4', 'trig_special_wrong_way=8√2'])
  })

  it('no slip is the answer, and no sentence states it', () => {
    for (const [tri, from, value] of TABLE) {
      for (const to of specialRoles(tri)) {
        if (to === from) continue
        const answer = specialSide(tri, from, ex(value), to)
        for (const s of specialSlips(tri, from, ex(value), to)) {
          expect(valueEq(s.value, answer)).toBe(false)
          expect(mentions(s.witness, exactText(answer)), s.witness).toBe(false)
        }
      }
    }
  })
})
