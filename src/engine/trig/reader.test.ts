import { describe, expect, it } from 'vitest'
import { exactText } from './exact'
import { formNote, readExact, readTrigAnswer, type TrigNumberRead } from './reader'

const value = (text: string) => {
  const v = readExact(text)
  return v === null ? null : v === 'undefined' ? 'undefined' : exactText(v)
}
const read = (text: string, units?: string[]) => {
  const r = readTrigAnswer(text, units ? { units } : {})
  if (!r.ok) throw new Error(`${text}: ${r.message}`)
  return r
}
const num = (text: string, units?: string[]) => {
  const r = read(text, units)
  if (r.kind !== 'number') throw new Error(`${text} read as ${r.kind}`)
  return r as TrigNumberRead
}
const message = (text: string) => {
  const r = readTrigAnswer(text)
  if (r.ok) throw new Error(`${text} was read`)
  return r.message
}

describe('exact values, every spelling', () => {
  it('square roots: the glyph, sqrt, with or without parentheses', () => {
    for (const t of ['√3/2', 'sqrt(3)/2', '(√3)/2', 'sqrt3/2', '√(3)/2', '1/2√3', '(1/2)√3', '√3 / 2', '√3÷2', '0.5√3']) expect(value(t), t).toBe('√3/2')
    for (const t of ['2√3/3', '2sqrt(3)/3', '(2√3)/3', '2/3√3', '2 * sqrt(3) / 3']) expect(value(t), t).toBe('2√3/3')
    expect(value('-√2/2')).toBe('-√2/2')
    expect(value('−√2/2')).toBe('-√2/2')
    expect(value('-(√2)/2')).toBe('-√2/2')
    expect(value('√2/-2')).toBe('-√2/2')
  })

  it('whole numbers, fractions and decimals that end', () => {
    expect(value('-1/2')).toBe('-1/2')
    expect(value('−0.5')).toBe('-1/2')
    expect(value('1')).toBe('1')
    expect(value('0')).toBe('0')
    expect(value('.5')).toBe('1/2')
    expect(value('2')).toBe('2')
    expect(value('3/5')).toBe('3/5')
  })

  it('the word for no value', () => {
    for (const t of ['undefined', 'Undefined', 'undef', 'DNE', 'does not exist', 'doesn’t exist', 'no value', 'undefined.']) expect(value(t), t).toBe('undefined')
    expect(read('tan θ = undefined')).toMatchObject({ kind: 'undefined', fn: 'tan' })
  })

  it('radian measures', () => {
    for (const t of ['5π/6', '5pi/6', '(5/6)π', '5/6π', '5 pi / 6', '5*pi/6', 'π5/6', '5π÷6']) expect(value(t), t).toBe('5π/6')
    expect(value('-7π/4')).toBe('-7π/4')
    expect(value('π')).toBe('π')
    expect(value('π/6')).toBe('π/6')
    expect(value('pi^2/216')).toBe('π^2/216')
    expect(value('27000/π')).toBe('27000/π')
    expect(num('5π/6 radians').radians).toBe(true)
    expect(num('5π/6 rad').radians).toBe(true)
  })

  it('degree measures', () => {
    for (const t of ['150', '150°', '150 degrees', '150 deg', '150º']) expect(value(t), t).toBe('150')
    expect(num('150°').degrees).toBe(true)
    expect(num('150').degrees).toBe(false)
    expect(num('-210°').exact && exactText(num('-210°').exact!)).toBe('-210')
    expect(num('143.2°').plain).toEqual({ value: 143.2, places: 1 })
  })

  it('a name before the answer and a unit after it', () => {
    expect(value('r = √13')).toBe('√13')
    expect(read('sin θ = 1/2')).toMatchObject({ fn: 'sin' })
    expect(read('sin(θ) = 1/2')).toMatchObject({ fn: 'sin' })
    expect(read('cos x = 1/2')).toMatchObject({ fn: 'cos' })
    expect(exactText(num('s = 4π cm', ['cm']).exact!)).toBe('4π')
    expect(exactText(num('4π cm', ['cm']).exact!)).toBe('4π')
    expect(num('16.8 in', ['in', 'inches']).plain).toEqual({ value: 16.8, places: 1 })
    expect(num('235.6 square feet', ['ft²', 'square feet', 'sq ft']).plain).toEqual({ value: 235.6, places: 1 })
    expect(num('236 ft²', ['ft²', 'square feet']).plain).toEqual({ value: 236, places: 0 })
    expect(num('≈ 0.70').plain).toEqual({ value: 0.7, places: 2 })
    expect(num('2,827.4', []).plain).toEqual({ value: 2827.4, places: 1 })
  })
})

describe('the form she wrote', () => {
  it('simplest radical form has no issue', () => {
    for (const t of ['√3/2', '2√3/3', '-√2/2', '3√13/13', '√13', '2√5', '5π/6', '(5/6)π', '1/2√3', '0.5', '-1']) expect(num(t).issue, t).toBeNull()
  })

  it('names what is not simplest', () => {
    expect(num('1/√2').issue).toBe('radical_denominator')
    expect(num('2/√3').issue).toBe('radical_denominator')
    expect(num('3/(2√3)').issue).toBe('radical_denominator')
    expect(num('√12/2').issue).toBe('radicand_square')
    expect(num('√45').issue).toBe('radicand_square')
    expect(num('√4').issue).toBe('perfect_square')
    expect(num('√(3/4)').issue).toBe('radicand_fraction')
    expect(num('√0.75').issue).toBe('radicand_fraction')
    expect(num('2√3/6').issue).toBe('unreduced_radical')
    expect(num('√2√3').issue).toBe('radical_product')
    expect(num('3^(1/2)/2').issue).toBe('radical_power')
    expect(num('2π - π/6').issue).toBe('sum')
    expect(num('√2/2 + 1').issue).toBe('sum')
    expect(num('√2/2 + 1').exact).toBeNull()
  })

  it('the note says what to fix, never a value: not even hers (it is in her box)', () => {
    expect(formNote('radical_denominator')).toMatch(/Rationalize the denominator/)
    expect(formNote('radicand_square')).toMatch(/perfect-square factor/)
    for (const issue of ['radical_denominator', 'perfect_square', 'radicand_fraction', 'radicand_square', 'unreduced_radical', 'radical_product', 'radical_power', 'sum'] as const) {
      expect(formNote(issue), issue).not.toMatch(/\d/)
    }
  })

  it('a decimal is remembered, with its places', () => {
    expect(num('0.866').decimal).toBe(true)
    expect(num('0.866').plain).toEqual({ value: 0.866, places: 3 })
    expect(num('0.8333π').decimal).toBe(true)
    expect(num('0.8333π').plain).toBeNull()
    expect(num('-2.618').plain).toEqual({ value: -2.618, places: 3 })
  })

  it('a KaTeX preview of what she typed', () => {
    expect(num('√3/2').tex).toBe('\\frac{\\sqrt{3}}{2}')
    expect(num('5pi/6').tex).toBe('\\frac{5 \\pi}{6}')
    expect(num('150°').tex).toBe('150^{\\circ}')
    expect(num('2*3').tex).toBe('2 \\cdot 3')
  })
})

describe('what it will not read, and why', () => {
  it('an empty box, a letter, a function still in the answer, infinity', () => {
    expect(message('')).toMatch(/Type your answer/)
    expect(message('y/r')).toMatch(/numbers of this point/)
    expect(message('sin(30°)')).toMatch(/still has sin/)
    expect(message('∞')).toMatch(/∞ is not a number/)
    expect(message('1/0')).toMatch(/divided by zero/)
    expect(message('√(-3)')).toMatch(/negative/)
    expect(message('2 3')).toMatch(/operation between/)
    expect(message('5π/6°')).toMatch(/no degree sign/)
    expect(message('(5π/6')).toMatch(/parenthesis/)
    expect(message('5π/6)')).toMatch(/extra parenthesis/)
    expect(message('2x = 3')).toMatch(/a name, an equals sign and the answer/)
    expect(message('1,5')).toMatch(/decimal point/)
  })

  it('messages never invent a value she did not type', () => {
    for (const t of ['y/r', 'sin(30)', '1/0', '∞', 'abc']) expect(message(t)).not.toMatch(/√3|1\/2|undefined/)
  })
})
