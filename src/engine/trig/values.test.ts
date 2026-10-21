/**
 * The six functions at every special angle, against a table written out by hand (the values on a textbook's unit
 * circle), in degrees and in radians, in every quadrant, on every axis, and for negative and coterminal forms; and a
 * second, numeric oracle (Math.sin and Math.cos) for every multiple of 15° from −720° to 720°.
 */
import { describe, expect, it } from 'vitest'
import { pointR, pointValue, trigValue, unitPoint, valueText, type TrigFn } from './values'
import { degFromPiMultiple, radiansOf } from './angle'
import { exactNum, exactText } from './exact'
import { readExact } from './reader'
import { q } from './rational'

/** deg: sin, cos, tan, csc, sec, cot. Written by hand from the unit circle. */
const TABLE: Record<number, [string, string, string, string, string, string]> = {
  0: ['0', '1', '0', 'undefined', '1', 'undefined'],
  30: ['1/2', '√3/2', '√3/3', '2', '2√3/3', '√3'],
  45: ['√2/2', '√2/2', '1', '√2', '√2', '1'],
  60: ['√3/2', '1/2', '√3', '2√3/3', '2', '√3/3'],
  90: ['1', '0', 'undefined', '1', 'undefined', '0'],
  120: ['√3/2', '-1/2', '-√3', '2√3/3', '-2', '-√3/3'],
  135: ['√2/2', '-√2/2', '-1', '√2', '-√2', '-1'],
  150: ['1/2', '-√3/2', '-√3/3', '2', '-2√3/3', '-√3'],
  180: ['0', '-1', '0', 'undefined', '-1', 'undefined'],
  210: ['-1/2', '-√3/2', '√3/3', '-2', '-2√3/3', '√3'],
  225: ['-√2/2', '-√2/2', '1', '-√2', '-√2', '1'],
  240: ['-√3/2', '-1/2', '√3', '-2√3/3', '-2', '√3/3'],
  270: ['-1', '0', 'undefined', '-1', 'undefined', '0'],
  300: ['-√3/2', '1/2', '-√3', '-2√3/3', '2', '-√3/3'],
  315: ['-√2/2', '√2/2', '-1', '-√2', '√2', '-1'],
  330: ['-1/2', '√3/2', '-√3/3', '-2', '2√3/3', '-√3'],
}
const FNS: TrigFn[] = ['sin', 'cos', 'tan', 'csc', 'sec', 'cot']

describe('the six functions at the special angles, against the hand table', () => {
  it('every angle of one turn, every function', () => {
    for (const [deg, row] of Object.entries(TABLE)) {
      FNS.forEach((fn, i) => {
        const v = trigValue(fn, q(Number(deg)))
        expect(v, `${fn}(${deg}°)`).not.toBeNull()
        expect(valueText(v!), `${fn}(${deg}°)`).toBe(row[i])
      })
    }
  })

  it('the same table with every angle written in radians: the names written by hand, read back, the same values', () => {
    const RADIANS: Record<number, string> = {
      0: '0',
      30: 'π/6',
      45: 'π/4',
      60: 'π/3',
      90: 'π/2',
      120: '2π/3',
      135: '3π/4',
      150: '5π/6',
      180: 'π',
      210: '7π/6',
      225: '5π/4',
      240: '4π/3',
      270: '3π/2',
      300: '5π/3',
      315: '7π/4',
      330: '11π/6',
    }
    for (const [deg, row] of Object.entries(TABLE)) {
      const name = RADIANS[Number(deg)]!
      expect(exactText(radiansOf(q(Number(deg)))), `${deg}°`).toBe(name)
      // Her radian answer read back is the same angle, so the same six values.
      const read = readExact(name)
      if (read === null || read === 'undefined') throw new Error(`${name} did not read`)
      const back = degFromPiMultiple(read.c)
      expect(back.n, name).toBe(Number(deg))
      FNS.forEach((fn, i) => expect(valueText(trigValue(fn, back)!), `${fn}(${name})`).toBe(row[i]))
      // And one turn on (13π/6 for π/6); the next test takes every angle a turn or two either way.
      FNS.forEach((fn, i) => {
        expect(valueText(trigValue(fn, q(Number(deg) + 360))!), `${fn}(${name} + 2π)`).toBe(row[i])
      })
    }
  })

  it('negative angles and angles past a turn give the value of their coterminal angle', () => {
    for (const [deg, row] of Object.entries(TABLE)) {
      for (const turns of [-2, -1, 1, 2]) {
        const d = Number(deg) + 360 * turns
        FNS.forEach((fn, i) => expect(valueText(trigValue(fn, q(d))!), `${fn}(${d}°)`).toBe(row[i]))
      }
    }
  })

  it('agrees with Math.sin and Math.cos at every multiple of 15° that is special, from −720° to 720°', () => {
    for (let d = -720; d <= 720; d += 15) {
      const special = d % 30 === 0 || d % 45 === 0
      const p = unitPoint(q(d))
      if (!special) {
        expect(p, `${d}°`).toBeNull()
        continue
      }
      const rad = (d * Math.PI) / 180
      expect(exactNum(p!.x)).toBeCloseTo(Math.cos(rad), 12)
      expect(exactNum(p!.y)).toBeCloseTo(Math.sin(rad), 12)
      const tan = trigValue('tan', q(d))!
      if (Math.abs(Math.cos(rad)) < 1e-12) expect(tan).toBe('undefined')
      else expect(exactNum(tan as never)).toBeCloseTo(Math.tan(rad), 9)
    }
  })

  it('a few textbook values said aloud', () => {
    expect(valueText(trigValue('sin', q(-225))!)).toBe('√2/2')
    expect(valueText(trigValue('tan', q(270))!)).toBe('undefined')
    expect(valueText(trigValue('cos', q(390))!)).toBe('√3/2')
    expect(valueText(trigValue('sec', q(-120))!)).toBe('-2')
    expect(valueText(trigValue('cot', q(-90))!)).toBe('0')
  })

  it('no value at an angle that is not a multiple of 30° or 45°', () => {
    expect(trigValue('sin', q(20))).toBeNull()
    expect(trigValue('cos', q(15))).toBeNull()
    expect(trigValue('tan', q(1, 2))).toBeNull()
  })
})

describe('a point on the terminal side', () => {
  it('Pythagorean points: r is whole and every ratio is a fraction', () => {
    expect(valueText(pointR(-3, 4))).toBe('5')
    expect(valueText(pointValue('sin', -3, 4))).toBe('4/5')
    expect(valueText(pointValue('cos', -3, 4))).toBe('-3/5')
    expect(valueText(pointValue('tan', -3, 4))).toBe('-4/3')
    expect(valueText(pointValue('csc', -3, 4))).toBe('5/4')
    expect(valueText(pointValue('sec', -3, 4))).toBe('-5/3')
    expect(valueText(pointValue('cot', -3, 4))).toBe('-3/4')
    expect(valueText(pointR(5, -12))).toBe('13')
    expect(valueText(pointValue('sin', 5, -12))).toBe('-12/13')
    expect(valueText(pointValue('cot', -8, -15))).toBe('8/15')
  })

  it('points that leave a radical: r = √13 and the ratios rationalized', () => {
    expect(valueText(pointR(-2, 3))).toBe('√13')
    expect(valueText(pointValue('sin', -2, 3))).toBe('3√13/13')
    expect(valueText(pointValue('cos', -2, 3))).toBe('-2√13/13')
    expect(valueText(pointValue('tan', -2, 3))).toBe('-3/2')
    expect(valueText(pointValue('csc', -2, 3))).toBe('√13/3')
    expect(valueText(pointValue('sec', -2, 3))).toBe('-√13/2')
    expect(valueText(pointR(2, 4))).toBe('2√5')
    expect(valueText(pointValue('cos', 2, 4))).toBe('√5/5')
    expect(valueText(pointValue('sin', 1, -1))).toBe('-√2/2')
  })

  it('every ratio agrees with the angle of the point', () => {
    for (const [x, y] of [
      [-3, 4],
      [5, -12],
      [-2, 3],
      [7, 24],
      [-1, -2],
      [6, -3],
    ] as const) {
      const t = Math.atan2(y, x)
      const v = (fn: TrigFn) => exactNum(pointValue(fn, x, y) as never)
      expect(v('sin')).toBeCloseTo(Math.sin(t), 12)
      expect(v('cos')).toBeCloseTo(Math.cos(t), 12)
      expect(v('tan')).toBeCloseTo(Math.tan(t), 12)
      expect(v('csc')).toBeCloseTo(1 / Math.sin(t), 12)
      expect(v('sec')).toBeCloseTo(1 / Math.cos(t), 12)
      expect(v('cot')).toBeCloseTo(1 / Math.tan(t), 12)
    }
  })
})
