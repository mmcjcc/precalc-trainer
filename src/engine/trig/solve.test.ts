/**
 * Every angle in one turn (uc.solve): each special value of each function, in degrees and in radians, against a table
 * written out by hand and against Math (every whole degree of the turn tried); then her list, read and graded.
 */
import { describe, expect, it } from 'vitest'
import { exactNum, exactText, type TrigExact } from './exact'
import { readExact } from './reader'
import { q } from './rational'
import { angleValue, gradeAngleList, listText, readAngleList, solveAnswer, solveSlips, type AngleListSpec } from './solve'
import type { TrigFn } from './values'

const ex = (t: string): TrigExact => {
  const v = readExact(t)
  if (v === null || v === 'undefined') throw new Error(`cannot read ${t}`)
  return v
}

/** fn, value, degrees, radians: written by hand from the unit circle. */
const TABLE: [TrigFn, string, string, string][] = [
  ['sin', '1/2', '30, 150', 'π/6, 5π/6'],
  ['sin', '-1/2', '210, 330', '7π/6, 11π/6'],
  ['sin', '√2/2', '45, 135', 'π/4, 3π/4'],
  ['sin', '-√2/2', '225, 315', '5π/4, 7π/4'],
  ['sin', '√3/2', '60, 120', 'π/3, 2π/3'],
  ['sin', '-√3/2', '240, 300', '4π/3, 5π/3'],
  ['sin', '1', '90', 'π/2'],
  ['sin', '-1', '270', '3π/2'],
  ['cos', '1/2', '60, 300', 'π/3, 5π/3'],
  ['cos', '-1/2', '120, 240', '2π/3, 4π/3'],
  ['cos', '√2/2', '45, 315', 'π/4, 7π/4'],
  ['cos', '-√2/2', '135, 225', '3π/4, 5π/4'],
  ['cos', '√3/2', '30, 330', 'π/6, 11π/6'],
  ['cos', '-√3/2', '150, 210', '5π/6, 7π/6'],
  ['cos', '0', '90, 270', 'π/2, 3π/2'],
  ['cos', '-1', '180', 'π'],
  ['tan', '1', '45, 225', 'π/4, 5π/4'],
  ['tan', '-1', '135, 315', '3π/4, 7π/4'],
  ['tan', '√3', '60, 240', 'π/3, 4π/3'],
  ['tan', '-√3', '120, 300', '2π/3, 5π/3'],
  ['tan', '√3/3', '30, 210', 'π/6, 7π/6'],
  ['tan', '-√3/3', '150, 330', '5π/6, 11π/6'],
  ['csc', '2', '30, 150', 'π/6, 5π/6'],
  ['csc', '-2', '210, 330', '7π/6, 11π/6'],
  ['csc', '√2', '45, 135', 'π/4, 3π/4'],
  ['csc', '-2√3/3', '240, 300', '4π/3, 5π/3'],
  ['csc', '1', '90', 'π/2'],
  ['sec', '2', '60, 300', 'π/3, 5π/3'],
  ['sec', '-√2', '135, 225', '3π/4, 5π/4'],
  ['sec', '2√3/3', '30, 330', 'π/6, 11π/6'],
  ['sec', '-1', '180', 'π'],
  ['cot', '1', '45, 225', 'π/4, 5π/4'],
  ['cot', '√3', '30, 210', 'π/6, 7π/6'],
  ['cot', '-√3/3', '120, 300', '2π/3, 5π/3'],
  ['cot', '0', '90, 270', 'π/2, 3π/2'],
]

function math(fn: TrigFn, deg: number): number {
  const t = (deg * Math.PI) / 180
  switch (fn) {
    case 'sin':
      return Math.sin(t)
    case 'cos':
      return Math.cos(t)
    case 'tan':
      return Math.tan(t)
    case 'csc':
      return 1 / Math.sin(t)
    case 'sec':
      return 1 / Math.cos(t)
    case 'cot':
      return Math.cos(t) / Math.sin(t)
  }
}

describe('every uc.solve value, both units', () => {
  it.each(TABLE)('%s θ = %s', (fn, value, degrees, radians) => {
    const degs = solveAnswer(fn, ex(value))
    expect(listText(degs, 'deg')).toBe(degrees)
    expect(listText(degs, 'rad')).toBe(radians)
    // Math, trying every whole degree of the turn: exactly these.
    const want = exactNum(ex(value))
    const found: number[] = []
    for (let d = 0; d < 360; d++) {
      const v = math(fn, d)
      if (Number.isFinite(v) && Math.abs(v) < 1e7 && Math.abs(v - want) < 1e-9) found.push(d)
    }
    expect(found.join(', ')).toBe(degrees)
    // The radian names read back to the same angles.
    expect(radians.split(', ').map((t) => (exactNum(ex(t)) * 180) / Math.PI).map((d) => Math.round(d)).join(', ')).toBe(degrees)
  })

  it('a value no special angle has gives no angles', () => {
    expect(solveAnswer('sin', ex('1/3'))).toEqual([])
    expect(solveAnswer('cos', ex('2'))).toEqual([])
  })
})

describe('the slips of an equation', () => {
  const show = (fn: TrigFn, value: string, unit: 'deg' | 'rad') => solveSlips(fn, ex(value), unit).map((s) => `${s.id}=${s.values.map(exactText).join(', ')}`)

  it('sin θ = −√3/2 in degrees: the reference angle alone, the positive quadrants, the calculator’s −60°, cos instead', () => {
    expect(show('sin', '-√3/2', 'deg')).toEqual([
      'trig_solve_reference_only=60',
      'trig_solve_wrong_sign_quadrant=60, 120',
      'trig_solve_out_of_range=240, -60',
      'trig_sin_cos_swapped=150, 210',
    ])
  })

  it('cos θ = −1/2 in radians: ±cos⁻¹ keeps −2π/3; π dropped', () => {
    expect(show('cos', '-1/2', 'rad')).toEqual([
      'trig_solve_reference_only=π/3',
      'trig_solve_wrong_sign_quadrant=π/3, 5π/3',
      'trig_solve_out_of_range=2π/3, -2π/3',
      'trig_sin_cos_swapped=7π/6, 11π/6',
      'trig_pi_dropped=2/3, 4/3',
    ])
  })

  it('cot θ = √3 solved as tan θ = √3, and csc θ = 2 solved as sec θ = 2', () => {
    expect(show('cot', '√3', 'deg')).toContain('trig_reciprocal_missing=60, 240')
    expect(show('csc', '2', 'deg')).toContain('trig_reciprocal_mixed=60, 300')
  })

  it('cos θ = −1 in radians: no π-dropped slip (its lesson names π)', () => {
    expect(show('cos', '-1', 'rad').some((s) => s.startsWith('trig_pi_dropped'))).toBe(false)
  })

  it('no slip list is the answer', () => {
    for (const [fn, value] of TABLE) {
      for (const unit of ['deg', 'rad'] as const) {
        const answer = solveAnswer(fn, ex(value)).map((d) => exactText(angleValue(d, unit))).sort().join('|')
        for (const s of solveSlips(fn, ex(value), unit)) expect(s.values.map(exactText).sort().join('|'), `${fn} ${value} ${unit}: ${s.id}`).not.toBe(answer)
      }
    }
  })
})

describe('reading her list', () => {
  it('commas, semicolons, and, or, braces, a name before each angle, degree signs', () => {
    for (const t of ['240, 300', '300,240', '240; 300', '240 and 300', 'θ = 240 or θ = 300', '{240, 300}', '240°, 300°', '240, 300,']) {
      const r = readAngleList(t)
      expect(r.ok, t).toBe(true)
      if (r.ok) expect(r.items.map((i) => i.approx).sort((a, b) => a - b), t).toEqual([240, 300])
    }
  })

  it('a space where a comma belongs, an empty spot, a word for no value: a message', () => {
    expect(readAngleList('240 300')).toMatchObject({ ok: false, message: 'Put a comma between the angles.' })
    expect(readAngleList('240, , 300').ok).toBe(false)
    expect(readAngleList('undefined').ok).toBe(false)
    expect(readAngleList('').ok).toBe(false)
  })
})

describe('grading her list', () => {
  const spec = (fn: TrigFn, value: string, unit: 'deg' | 'rad'): AngleListSpec => ({ fn, value: ex(value), unit, degs: solveAnswer(fn, ex(value)) })
  const grade = (fn: TrigFn, value: string, unit: 'deg' | 'rad', typed: string) => {
    const s = spec(fn, value, unit)
    const g = gradeAngleList(s, typed, solveSlips(fn, ex(value), unit))
    return g.verdict === 'mistake' ? g.mistake : g.verdict === 'invalid' ? `invalid:${g.reason}` : g.verdict
  }

  it('right in any order and spelling', () => {
    for (const t of ['240, 300', '300, 240', '240°, 300°', '240 degrees, 300 degrees', 'θ = 240°, θ = 300°']) expect(grade('sin', '-√3/2', 'deg', t), t).toBe('correct')
    for (const t of ['4π/3, 5π/3', '5pi/3, 4pi/3', '(4/3)π, (5/3)π', '8π/6, 10π/6']) expect(grade('sin', '-√3/2', 'rad', t), t).toBe('correct')
    expect(grade('sin', '-1', 'deg', '270')).toBe('correct')
  })

  it('the slips by their lists, and by rule', () => {
    expect(grade('sin', '-√3/2', 'deg', '60')).toBe('trig_solve_reference_only')
    expect(grade('sin', '-√3/2', 'deg', '120, 60')).toBe('trig_solve_wrong_sign_quadrant')
    // By rule: one of the two in a quadrant where sin is positive.
    expect(grade('sin', '-√3/2', 'deg', '240, 120')).toBe('trig_solve_wrong_sign_quadrant')
    expect(grade('sin', '-√3/2', 'deg', '-60, 240')).toBe('trig_solve_out_of_range')
    // By rule: any angle outside the range.
    expect(grade('sin', '-√3/2', 'deg', '600, 300')).toBe('trig_solve_out_of_range')
    expect(grade('sin', '-√3/2', 'deg', '240')).toBe('trig_solve_one_answer')
    expect(grade('sin', '-√3/2', 'deg', '300')).toBe('trig_solve_one_answer')
    expect(grade('cos', '-1/2', 'rad', '2/3, 4/3')).toBe('trig_pi_dropped')
    expect(grade('sin', '-√3/2', 'deg', '210, 300')).toBe('wrong')
  })

  it('the one-of-two sentence says how many and never which', () => {
    const g = gradeAngleList(spec('sin', '-√3/2', 'deg'), '240', solveSlips('sin', ex('-√3/2'), 'deg'))
    expect(g.verdict === 'mistake' && g.witness).toMatch(/There are two angles in \[0°, 360°\)/)
    expect(g.verdict === 'mistake' && g.witness).not.toMatch(/300/)
  })

  it('notes, not attempts: the wrong unit, a calculator decimal, an angle twice, a list that cannot be read', () => {
    expect(grade('sin', '-√3/2', 'deg', '4π/3, 5π/3')).toBe('invalid:wrong_unit')
    expect(grade('sin', '-√3/2', 'rad', '240, 300')).toBe('invalid:wrong_unit')
    expect(grade('sin', '-√3/2', 'rad', '240°, 300°')).toBe('invalid:wrong_unit')
    expect(grade('sin', '-√3/2', 'rad', '4.19, 5.24')).toBe('invalid:not_exact')
    expect(grade('sin', '-√3/2', 'deg', '240, 240')).toBe('invalid:unreadable')
    expect(grade('sin', '-√3/2', 'deg', '240 300')).toBe('invalid:unreadable')
    expect(grade('sin', '-√3/2', 'deg', '???')).toBe('invalid:unreadable')
  })

  it('the same list in another order or spelling has the same key', () => {
    const s = spec('sin', '-√3/2', 'deg')
    const key = (t: string) => gradeAngleList(s, t, []).key
    expect(key('240')).toBe(key('240°'))
    expect(key('60, 120')).toBe(key('120°, 60'))
    expect(key('60, 120')).not.toBe(key('60'))
  })

  it('a hand case: tan θ = 1 is 45° and 225°', () => {
    expect(listText(solveAnswer('tan', ex('1')), 'deg')).toBe('45, 225')
    expect(grade('tan', '1', 'deg', '45, 225')).toBe('correct')
    expect(grade('tan', '1', 'deg', '45, 135')).toBe('trig_solve_wrong_sign_quadrant')
    expect(solveAnswer('tan', ex('1')).map((d) => d.n)).toEqual([q(45).n, q(225).n])
  })
})
