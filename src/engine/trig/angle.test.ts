import { describe, expect, it } from 'vitest'
import {
  angleSay,
  angleTex,
  angleText,
  coterminalDeg,
  halfTurnSlipDeg,
  negativeDirectionDeg,
  oneTurnShortDeg,
  placeOf,
  placeWords,
  radiansOf,
  referenceDeg,
  turnsTo,
} from './angle'
import { exactText } from './exact'
import { q, qText } from './rational'

const deg = (n: number, d = 1) => q(n, d)
const where = (d: number) => placeWords(placeOf(q(d)))

describe('exact conversion', () => {
  it('degrees to radians, as a multiple of π', () => {
    expect(exactText(radiansOf(deg(150)))).toBe('5π/6')
    expect(exactText(radiansOf(deg(-315)))).toBe('-7π/4')
    expect(exactText(radiansOf(deg(72)))).toBe('2π/5')
    expect(exactText(radiansOf(deg(180)))).toBe('π')
    expect(exactText(radiansOf(deg(690)))).toBe('23π/6')
    expect(exactText(radiansOf(deg(1)))).toBe('π/180')
    expect(exactText(radiansOf(deg(0)))).toBe('0')
  })

  it('names and KaTeX in both units', () => {
    expect(angleText({ deg: deg(150), unit: 'deg' })).toBe('150')
    expect(angleSay({ deg: deg(-210), unit: 'deg' })).toBe('−210°')
    expect(angleText({ deg: deg(-495), unit: 'rad' })).toBe('-11π/4')
    expect(angleSay({ deg: deg(-495), unit: 'rad' })).toBe('−11π/4')
    expect(angleTex({ deg: deg(-495), unit: 'rad' })).toBe('-\\frac{11\\pi}{4}')
    expect(angleTex({ deg: deg(40), unit: 'deg' })).toBe('40^{\\circ}')
    expect(angleText({ deg: deg(45, 2), unit: 'deg' })).toBe('22.5')
  })
})

describe('the quadrant, or the axis', () => {
  it('every quadrant and every axis, positive, negative and past a turn', () => {
    expect(where(40)).toBe('Quadrant I')
    expect(where(150)).toBe('Quadrant II')
    expect(where(210)).toBe('Quadrant III')
    expect(where(300)).toBe('Quadrant IV')
    expect(where(-60)).toBe('Quadrant IV')
    expect(where(-120)).toBe('Quadrant III')
    expect(where(-200)).toBe('Quadrant II')
    expect(where(-300)).toBe('Quadrant I')
    expect(where(510)).toBe('Quadrant II')
    expect(where(-510)).toBe('Quadrant III')
    expect(where(0)).toBe('the positive x-axis')
    expect(where(90)).toBe('the positive y-axis')
    expect(where(-180)).toBe('the negative x-axis')
    expect(where(-90)).toBe('the negative y-axis')
    expect(where(450)).toBe('the positive y-axis')
    expect(where(720)).toBe('the positive x-axis')
  })
})

describe('coterminal angles', () => {
  it('in [0°, 360°), any number of turns either way', () => {
    expect(qText(coterminalDeg(deg(-510)))).toBe('210')
    expect(qText(coterminalDeg(deg(690)))).toBe('330')
    expect(qText(coterminalDeg(deg(-495)))).toBe('225')
    expect(qText(coterminalDeg(deg(360)))).toBe('0')
    expect(qText(coterminalDeg(deg(-1)))).toBe('359')
    expect(qText(coterminalDeg(deg(1000)))).toBe('280')
    expect(turnsTo(deg(-510))).toBe(2)
    expect(turnsTo(deg(1000))).toBe(-2)
    expect(turnsTo(deg(300))).toBe(0)
  })

  it('the slips: half turns, one turn short, a negative angle turned the other way', () => {
    expect(qText(halfTurnSlipDeg(deg(-510))!)).toBe('30')
    expect(qText(halfTurnSlipDeg(deg(510))!)).toBe('330')
    // Two half turns are a whole turn: the slip gives the right answer, and the builders leave it out.
    expect(qText(halfTurnSlipDeg(deg(600))!)).toBe('240')
    expect(halfTurnSlipDeg(deg(200))).toBeNull()
    expect(qText(oneTurnShortDeg(deg(-510))!)).toBe('-150')
    expect(qText(oneTurnShortDeg(deg(1000))!)).toBe('640')
    expect(oneTurnShortDeg(deg(400))).toBeNull()
    expect(oneTurnShortDeg(deg(-30))).toBeNull()
    expect(qText(negativeDirectionDeg(deg(-510))!)).toBe('150')
    expect(negativeDirectionDeg(deg(510))).toBeNull()
  })
})

describe('reference angles', () => {
  it('the acute angle to the x-axis, in every quadrant, after the coterminal angle', () => {
    expect(qText(referenceDeg(deg(150))!)).toBe('30')
    expect(qText(referenceDeg(deg(210))!)).toBe('30')
    expect(qText(referenceDeg(deg(300))!)).toBe('60')
    expect(qText(referenceDeg(deg(40))!)).toBe('40')
    expect(qText(referenceDeg(deg(-510))!)).toBe('30')
    expect(qText(referenceDeg(deg(-100))!)).toBe('80')
    expect(qText(referenceDeg(deg(845))!)).toBe('55')
    expect(referenceDeg(deg(270))).toBeNull()
    expect(referenceDeg(deg(-180))).toBeNull()
  })

  it('in radians: the reference angle of 7π/6 is π/6', () => {
    expect(exactText(radiansOf(referenceDeg(deg(210))!))).toBe('π/6')
    expect(exactText(radiansOf(referenceDeg(deg(-495))!))).toBe('π/4')
  })
})
