/**
 * The grader on Unit 9's circle answers, with a hand-built problem: an area of 25π and a segment of 4π − 8.
 * A decimal near the exact value (with the π key or with 3.14) is a note, not an attempt; the number with its π
 * left off is wrong; a sum is read only on the part that allows one.
 */
import { describe, expect, it } from 'vitest'
import type { GeometryAnswer } from '@/content/types'
import { exposedExact, gradeGeoStage } from './grade'

const stage = (id: 'a' | 'b', answerText: string, extra: Partial<GeometryAnswer['stages'][number]> = {}): GeometryAnswer['stages'][number] => ({
  id,
  kind: 'number',
  label: id === 'a' ? 'the area of the circle' : 'the area of the segment',
  hint: 'A number times π.',
  answerText,
  nudge: 'Which formula has the radius squared?',
  ruleCard: 'card',
  reveal: [],
  traps: [],
  ...extra,
})

const answer: GeometryAnswer = {
  type: 'geometry',
  question: 'circleSegment',
  prompt: 'A circle has a radius of 5 cm.',
  figure: { points: [], ariaLabel: '' },
  stages: [
    stage('a', '25π', { traps: [{ id: 'geo_area_not_halved', text: '10π', witness: 'That is the distance around.' }] }),
    stage('b', '4π - 8', { sum: true, traps: [{ id: 'geo_area_not_halved', text: '4π', witness: 'That is the whole sector.' }] }),
  ],
  lengths: [5],
  angles: [],
  expectedDisplay: '',
  reveal: [],
  ruleCards: ['card'],
  trap: 'geo_area_not_halved',
  trapStage: 'a',
  trapAnswer: '10π',
}

const grade = (id: 'a' | 'b', text: string) => gradeGeoStage(answer, id, text)

describe('grading an answer in terms of π', () => {
  it('takes the exact value in any spelling', () => {
    for (const text of ['25π', '25pi', '25 π', 'A = 25π', '25*pi']) {
      expect(grade('a', text).verdict, text).toBe('correct')
    }
    expect(grade('a', '25π')).toEqual({ verdict: 'correct', message: 'Correct: 25π.' })
  })

  it('a calculator decimal is a note that asks for π, with the π key or with 3.14', () => {
    for (const text of ['78.54', '78.5', '78.539816']) {
      const g = grade('a', text)
      expect(g.verdict, text).toBe('invalid')
      if (g.verdict === 'invalid') expect(g.message).toBe('That looks like a calculator decimal. Give the exact value, in terms of π.')
    }
  })

  it('the number with its π left off is wrong, a named slip is named, and an unreduced form is a note', () => {
    expect(grade('a', '25').verdict).toBe('wrong')
    expect(grade('a', '10π')).toMatchObject({ verdict: 'mistake', mistake: 'geo_area_not_halved' })
    expect(grade('a', '50π/2').verdict).toBe('invalid')
    expect(grade('a', '5π - 2').verdict).toBe('invalid')
  })
})

describe('grading a sum', () => {
  it('takes the terms in any order and factored, on the part that allows a sum', () => {
    for (const text of ['4π - 8', '4pi-8', '-8 + 4π', '4(π - 2)']) {
      expect(grade('b', text).verdict, text).toBe('correct')
    }
    expect(grade('b', '4π - 8')).toEqual({ verdict: 'correct', message: 'Correct: 4π - 8.' })
  })

  it('names a one-term slip, notes a decimal, and calls another sum wrong', () => {
    expect(grade('b', '4π')).toMatchObject({ verdict: 'mistake', mistake: 'geo_area_not_halved' })
    const decimal = grade('b', '4.57')
    expect(decimal.verdict).toBe('invalid')
    if (decimal.verdict === 'invalid') expect(decimal.message).toMatch(/in terms of π/)
    expect(grade('b', '4π + 8').verdict).toBe('wrong')
    expect(grade('b', '8 - 4π').verdict).toBe('wrong')
    expect(grade('b', '2π + 2π - 8').verdict).toBe('invalid')
  })
})

describe('π binds the number it touches', () => {
  it('6π does not show a 6, and 6π itself is shown', () => {
    expect(exposedExact('The arc is 6π cm long.', '6')).toBe(false)
    expect(exposedExact('The arc is 6π cm long.', '6π')).toBe(true)
    expect(exposedExact('The radius is 6 cm.', '6π')).toBe(false)
    expect(exposedExact('The radius is 6 cm.', '6')).toBe(true)
    expect(exposedExact('An area of 36π cm².', '6π')).toBe(false)
  })
})
