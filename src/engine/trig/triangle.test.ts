/**
 * The right-triangle core against a table written out by hand (Pythagorean triples, and pairs that leave a radical)
 * and against Math: the third side both ways, the six ratios of an acute angle, and the slips of each.
 */
import { describe, expect, it } from 'vitest'
import { exactInt, exactNum, exactText, type TrigExact } from './exact'
import { readExact } from './reader'
import { hypotenuseOf, hypotenuseSlips, legOf, legSlips, rtRatio, rtRatioSlips, type RtSides } from './triangle'
import { valueEq, type TrigFn } from './values'

const n = (v: number) => exactInt(v)

/** The value as a number of its own in the text: "5" is not in "15" or "5√3". */
const mentions = (text: string, value: string) => new RegExp(`(?<![\\d.√/])${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\d√/]|\\.\\d)`).test(text)
const ex = (t: string): TrigExact => {
  const v = readExact(t)
  if (v === null || v === 'undefined') throw new Error(`cannot read ${t}`)
  return v
}

/** leg, leg, hypotenuse: written by hand. */
const TRIANGLES: [string, string, string][] = [
  ['3', '4', '5'],
  ['5', '12', '13'],
  ['8', '15', '17'],
  ['7', '24', '25'],
  ['20', '21', '29'],
  ['9', '40', '41'],
  ['6', '8', '10'],
  ['2', '3', '√13'],
  ['1', '2', '√5'],
  ['2', '4', '2√5'],
  ['4', '6', '2√13'],
  ['2', '√21', '5'],
  ['4', '2√5', '6'],
  ['3', '2√10', '7'],
  ['√2', '√2', '2'],
  ['2√3', '2', '4'],
]

describe('the third side, both ways, against the hand table', () => {
  it.each(TRIANGLES)('legs %s and %s, hypotenuse %s', (a, b, c) => {
    expect(exactText(hypotenuseOf(ex(a), ex(b)))).toBe(c)
    expect(exactText(legOf(ex(a), ex(c)))).toBe(b)
    expect(exactText(legOf(ex(b), ex(c)))).toBe(a)
    // And Math agrees.
    expect(exactNum(hypotenuseOf(ex(a), ex(b)))).toBeCloseTo(Math.hypot(exactNum(ex(a)), exactNum(ex(b))), 12)
  })

  it('a leg as long as the hypotenuse, or longer, is not a triangle', () => {
    expect(() => legOf(n(5), n(5))).toThrow()
    expect(() => legOf(n(6), n(5))).toThrow()
  })
})

/** The six ratios of θ with opposite 12, adjacent 5, hypotenuse 13, and with opposite 2, adjacent 3, hypotenuse √13. */
const RATIOS: [RtSides, Record<TrigFn, string>][] = [
  [{ opp: n(12), adj: n(5), hyp: n(13) }, { sin: '12/13', cos: '5/13', tan: '12/5', csc: '13/12', sec: '13/5', cot: '5/12' }],
  [{ opp: n(2), adj: n(3), hyp: ex('√13') }, { sin: '2√13/13', cos: '3√13/13', tan: '2/3', csc: '√13/2', sec: '√13/3', cot: '3/2' }],
  [{ opp: ex('√21'), adj: n(2), hyp: n(5) }, { sin: '√21/5', cos: '2/5', tan: '√21/2', csc: '5√21/21', sec: '5/2', cot: '2√21/21' }],
]
const FNS: TrigFn[] = ['sin', 'cos', 'tan', 'csc', 'sec', 'cot']

describe('the six ratios', () => {
  it('against the hand table, rationalized', () => {
    for (const [s, row] of RATIOS) for (const fn of FNS) expect(exactText(rtRatio(fn, s)), fn).toBe(row[fn])
  })

  it('against Math: θ = atan(opp/adj), and each ratio is the function of θ', () => {
    for (const [a, b] of TRIANGLES) {
      const s: RtSides = { opp: ex(a), adj: ex(b), hyp: hypotenuseOf(ex(a), ex(b)) }
      const theta = Math.atan2(exactNum(s.opp), exactNum(s.adj))
      const want: Record<TrigFn, number> = { sin: Math.sin(theta), cos: Math.cos(theta), tan: Math.tan(theta), csc: 1 / Math.sin(theta), sec: 1 / Math.cos(theta), cot: 1 / Math.tan(theta) }
      for (const fn of FNS) expect(exactNum(rtRatio(fn, s)), `${fn} of ${a}, ${b}`).toBeCloseTo(want[fn], 10)
    }
  })
})

describe('the slips', () => {
  it('a leg from 5 and 13: the squares added is √194, the square left is 144', () => {
    const slips = legSlips(n(5), n(13))
    expect(slips.map((s) => [s.id, exactText(s.value as TrigExact)])).toEqual([
      ['trig_pythag_added', '√194'],
      ['trig_side_not_rooted', '144'],
    ])
    for (const s of slips) expect(s.witness).not.toMatch(/\b12\b/)
  })

  it('the hypotenuse from legs 2 and 3: the square left is 13, the squares subtracted is √5', () => {
    expect(hypotenuseSlips(n(2), n(3)).map((s) => [s.id, exactText(s.value as TrigExact)])).toEqual([
      ['trig_side_not_rooted', '13'],
      ['trig_pythag_subtracted', '√5'],
    ])
    // Equal legs: nothing to subtract.
    expect(hypotenuseSlips(n(4), n(4)).map((s) => s.id)).toEqual(['trig_side_not_rooted'])
  })

  it('each ratio’s slips: swapped, upside down, a leg for the hypotenuse, the reciprocals; never the answer', () => {
    const s: RtSides = { opp: n(12), adj: n(5), hyp: n(13) }
    const ids = (fn: TrigFn) => rtRatioSlips(fn, s).map((x) => `${x.id}=${exactText(x.value as TrigExact)}`)
    expect(ids('sin')).toEqual(['trig_opposite_adjacent_swapped=5/13', 'trig_hypotenuse_as_leg=13/12', 'trig_hypotenuse_as_leg=12/5'])
    expect(ids('cos')).toEqual(['trig_opposite_adjacent_swapped=12/13', 'trig_hypotenuse_as_leg=13/5', 'trig_hypotenuse_as_leg=5/12'])
    expect(ids('tan')).toEqual(['trig_opposite_adjacent_swapped=5/12', 'trig_hypotenuse_as_leg=12/13'])
    expect(ids('csc')).toEqual(['trig_reciprocal_missing=12/13', 'trig_reciprocal_mixed=13/5'])
    expect(ids('sec')).toEqual(['trig_reciprocal_missing=5/13', 'trig_reciprocal_mixed=13/12'])
    expect(ids('cot')).toEqual(['trig_reciprocal_missing=12/5'])
    for (const [sides] of RATIOS) {
      for (const fn of FNS) {
        const answer = rtRatio(fn, sides)
        for (const slip of rtRatioSlips(fn, sides)) {
          expect(valueEq(slip.value, answer), `${fn}: ${slip.id}`).toBe(false)
          expect(mentions(slip.witness, exactText(answer)), `${fn}: ${slip.id}`).toBe(false)
        }
      }
    }
  })
})
