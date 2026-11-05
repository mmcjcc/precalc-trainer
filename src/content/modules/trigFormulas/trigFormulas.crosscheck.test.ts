/**
 * Independent numeric check of trigFormulas. The expected value is recomputed from the words on the page
 * (the angle, or the given ratio and the quadrant) with Math, then compared with the stored exact text
 * read as a number. Nothing here trusts the generator's stored number as the source of the truth.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { readTrigAnswer } from '@/engine/trig'
import type { TrigFormulasAnswer, TrigPart } from '@/content/types'
import { gradeTfPart } from './index'

const SEEDS = 300
const TOL = 1e-9
const SLOW = 180_000

function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOL * Math.max(1, Math.abs(a), Math.abs(b))
}

function num(text: string): number {
  const r = readTrigAnswer(text)
  if (!r.ok || r.kind !== 'number') throw new Error(`not a number: ${text}`)
  return r.approx
}

function of(answer: TrigFormulasAnswer): TrigFormulasAnswer {
  return answer
}

function part(answer: TrigFormulasAnswer, id: string): TrigPart {
  const found = answer.stages.find((stage) => stage.id === id)
  if (!found) throw new Error(`no part ${id}`)
  return found
}

const RAD_TO_DEG: Record<string, number> = {
  'π/12': 15,
  '5π/12': 75,
  '7π/12': 105,
  '11π/12': 165,
}

function sumAngle(statement: string): { fn: string; deg: number } {
  const rad = statement.match(/(sin|cos|tan|csc|sec|cot) (π\/12|5π\/12|7π\/12|11π\/12)/)
  if (rad) return { fn: rad[1]!, deg: RAD_TO_DEG[rad[2]!]! }
  const deg = statement.match(/(sin|cos|tan|csc|sec|cot) (\d+)°/)
  if (!deg) throw new Error(`no angle in ${statement}`)
  return { fn: deg[1]!, deg: Number(deg[2]) }
}

function mathFn(fn: string, deg: number): number {
  const x = (deg * Math.PI) / 180
  const s = Math.sin(x)
  const c = Math.cos(x)
  if (fn === 'sin') return s
  if (fn === 'cos') return c
  if (fn === 'tan') return s / c
  if (fn === 'csc') return 1 / s
  if (fn === 'sec') return 1 / c
  return c / s
}

const QUAD: Record<string, 1 | 2 | 3 | 4> = { I: 1, II: 2, III: 3, IV: 4 }

function signs(q: 1 | 2 | 3 | 4): { sin: number; cos: number } {
  return { sin: q === 1 || q === 2 ? 1 : -1, cos: q === 1 || q === 4 ? 1 : -1 }
}

function fraction(text: string): number {
  const s = text.replace(/−/g, '-')
  const [n, d] = s.split('/')
  return Number(n) / (d ? Number(d) : 1)
}

function radiansOf(token: string): number {
  const s = token.trim().replace(/−/g, '-').replace(/\s/g, '')
  if (s === '0') return 0
  const m = /^(-?)(\d*)π(?:\/(\d+))?$/.exec(s)
  if (!m) throw new Error(`angle ${token}`)
  const sign = m[1] === '-' ? -1 : 1
  const coef = m[2] ? Number(m[2]) : 1
  const den = m[3] ? Number(m[3]) : 1
  return (sign * coef * Math.PI) / den
}

function quadrantOf(rad: number): 1 | 2 | 3 | 4 {
  let x = rad % (2 * Math.PI)
  if (x < 0) x += 2 * Math.PI
  if (x < Math.PI / 2 - 1e-12) return 1
  if (x < Math.PI - 1e-12) return 2
  if (x < (3 * Math.PI) / 2 - 1e-12) return 3
  return 4
}

function halfPositive(fn: string, q: 1 | 2 | 3 | 4): boolean {
  if (q === 1) return true
  if (q === 2) return fn === 'sin'
  if (q === 3) return fn === 'tan'
  return fn === 'cos'
}

describe('trigFormulas cross-check', () => {
  it('ta.sumdiff: the stored exact value matches Math, over 300 seeds', () => {
    const statements = new Set<string>()
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = generateProblem('trigFormulas', 'ta.sumdiff', seed)
      if (seed <= 60) statements.add(p.statementText)
      const again = generateProblem('trigFormulas', 'ta.sumdiff', seed)
      expect(again.statementText).toBe(p.statementText)
      if (p.answer.type !== 'trigFormulas') throw new Error('kind')
      const a = of(p.answer)
      const { fn, deg } = sumAngle(p.statementText)
      const want = mathFn(fn, deg)
      const value = part(a, 'value')
      expect(close(num(value.answerText), want), `${p.statementText} → ${value.answerText}`).toBe(true)
      const split = part(a, 'split')
      const label = split.choices?.find((c) => c.value === split.answerText)?.label ?? ''
      const bits = /(\d+)° ([+−-]) (\d+)°/.exec(label)
      if (!bits) throw new Error(`split ${label}`)
      const combined = bits[2] === '+' ? Number(bits[1]) + Number(bits[3]) : Number(bits[1]) - Number(bits[3])
      expect(combined).toBe(deg)
      const alt = value.answerText.replace(/√(\d+)/g, 'sqrt($1)')
      if (alt !== value.answerText) expect(gradeTfPart(a, 'value', alt).verdict).toBe('correct')
    }
    expect(statements.size).toBeGreaterThanOrEqual(40)
  }, SLOW)

  it('ta.double: missing ratio and double angles match the quadrant arithmetic, over 300 seeds', () => {
    const statements = new Set<string>()
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = generateProblem('trigFormulas', 'ta.double', seed)
      if (seed <= 60) statements.add(p.statementText)
      if (p.answer.type !== 'trigFormulas') throw new Error('kind')
      const a = of(p.answer)
      const given = p.statementText.match(/(sin|cos) θ = ([−-]?\d+\/\d+|[−-]?\d+)/)
      const quad = p.statementText.match(/Quadrant (IV|III|II|I)/)
      if (!given || !quad) throw new Error(p.statementText)
      const ratio = fraction(given[2]!)
      const q = QUAD[quad[1]!]!
      const other = Math.sqrt(1 - ratio * ratio)
      const { sin: sinSign, cos: cosSign } = signs(q)
      const sin = given[1] === 'sin' ? ratio : sinSign * other
      const cos = given[1] === 'cos' ? ratio : cosSign * other
      expect(close(sin * sin + cos * cos, 1)).toBe(true)
      const missingId = given[1] === 'sin' ? 'cos' : 'sin'
      expect(close(num(part(a, missingId).answerText), missingId === 'sin' ? sin : cos)).toBe(true)
      expect(close(num(part(a, 'sin2').answerText), 2 * sin * cos)).toBe(true)
      expect(close(num(part(a, 'cos2').answerText), cos * cos - sin * sin)).toBe(true)
      expect(close(num(part(a, 'tan2').answerText), (2 * sin * cos) / (cos * cos - sin * sin))).toBe(true)
      const flipped = part(a, missingId).answerText.startsWith('-')
        ? part(a, missingId).answerText.slice(1)
        : `-${part(a, missingId).answerText}`
      expect(gradeTfPart(a, missingId, flipped).verdict).not.toBe('correct')
    }
    expect(statements.size).toBeGreaterThanOrEqual(40)
  }, SLOW)

  it('ta.half: the half-angle value matches the formula and the half angle’s quadrant, over 300 seeds', () => {
    const statements = new Set<string>()
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = generateProblem('trigFormulas', 'ta.half', seed)
      if (seed <= 60) statements.add(p.statementText)
      if (p.answer.type !== 'trigFormulas') throw new Error('kind')
      const a = of(p.answer)
      const given = p.statementText.match(/cos θ = ([−-]?\d+\/\d+|[−-]?\d+)/)
      const range = p.statementText.match(/between (.+?) and (.+?),/)
      const asked = p.statementText.match(/find (sin|cos|tan)θ\/2/)
      if (!given || !range || !asked) throw new Error(p.statementText)
      const cos = fraction(given[1]!)
      const lo = radiansOf(range[1]!)
      const hi = radiansOf(range[2]!)
      const mid = (lo + hi) / 2
      const halfQ = quadrantOf(mid / 2)
      const fn = asked[1]!
      const mag =
        fn === 'sin' ? Math.sqrt((1 - cos) / 2) : fn === 'cos' ? Math.sqrt((1 + cos) / 2) : Math.sqrt((1 - cos) / (1 + cos))
      const want = (halfPositive(fn, halfQ) ? 1 : -1) * mag
      const value = part(a, 'value')
      expect(close(num(value.answerText), want), `${p.statementText} → ${value.answerText}`).toBe(true)
      expect(part(a, 'quadrant').answerText).toBe(String(halfQ))
      const alt = value.answerText.replace(/√(\d+)/g, 'sqrt($1)')
      if (alt !== value.answerText) expect(gradeTfPart(a, 'value', alt).verdict).toBe('correct')
    }
    expect(statements.size).toBeGreaterThanOrEqual(40)
  }, SLOW)
})
