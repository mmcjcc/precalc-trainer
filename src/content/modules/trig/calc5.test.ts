/**
 * Unit 5's calculator panels say only what applies: RADIAN mode first (DEGREE only where the problem asks for
 * degrees), the function or the inverse as she would key it, and where π is ("2nd ^", "the π key") only where the keys
 * or her exact answer use π. Over 300 seeds per template, and by hand for the brief's examples.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { q, type TrigExact, type Wave } from '@/engine/trig'
import type { ModuleId } from '@/shared/types'
import { evaluateProblem } from '../inverseTrig'
import { featuresProblem, modelProblem } from '../sinusoids'
import { tiWaveKeys } from './calc5'
import { plain } from './text'
import { trigAnswerOf } from './testkit'

const LOOP_TIMEOUT = 120_000
const ex = (n: number, d = 1, pi: 0 | 1 = 0): TrigExact => ({ c: q(n, d), root: 1, pi })
const stepText = (s: { title: string; keys: string; why?: string; caution?: string }) => `${s.title} | ${s.keys} | ${s.why ?? ''} | ${s.caution ?? ''}`

const CASES: [ModuleId, string][] = [
  ['sinusoids', 'sg.features'],
  ['sinusoids', 'sg.equation'],
  ['sinusoids', 'sg.model'],
  ['otherTrigGraphs', 'og.features'],
  ['otherTrigGraphs', 'og.match'],
  ['inverseTrig', 'it.evaluate'],
  ['inverseTrig', 'it.compose'],
]

describe.each(CASES)('%s/%s calculator steps over 300 seeds', (moduleId, templateId) => {
  it(
    'RADIAN first (DEGREE only when degrees are asked), and where π is only where the keys or her answer use it',
    () => {
      for (let seed = 1; seed <= 300; seed++) {
        const p = generateProblem(moduleId, templateId, seed)
        const a = trigAnswerOf(p)
        const where = `${templateId}/${seed}`
        const ti = p.calc.ti84
        const ns = p.calc.nspire
        // An expression in x has no calculator steps (and no panel); every other problem has both.
        const algebraic = a.stages.some((s) => s.check.kind === 'function' && s.check.algebraic)
        if (algebraic) {
          expect(ti.length + ns.length, where).toBe(0)
          continue
        }
        expect(ti.length, where).toBeGreaterThan(1)
        expect(ns.length, where).toBeGreaterThan(1)
        const degrees = /in degrees/.test(plain(a.prompt))
        expect(ti[0]!.title, where).toBe(`Set the angle mode to ${degrees ? 'DEGREE' : 'RADIAN'}`)
        expect(ns[0]!.title, where).toMatch(degrees ? /Degree/i : /Radian/i)
        const all = [...ti, ...ns].map(stepText).join('\n')
        expect(all, where).not.toMatch(/NaN|undefined|Infinity|null/)
        // π: said where the keys use it, or where she checks an exact answer in radians that has a π.
        const tiKeys = ti.map((s) => s.keys).join(' ')
        const nsKeys = ns.map((s) => s.keys).join(' ')
        const answerPi = a.stages.some((s) => /π/.test(s.answerText))
        const checksPi = ti.some((s) => s.title === 'Check your exact answer') && answerPi
        // sg.equation's keys are "your equation": π is said when her equation has one.
        const typesPi = templateId === 'sg.equation' && answerPi
        const saysTi = /π is 2nd \^/.test(ti.map(stepText).join(' '))
        expect(saysTi, `${where}: π on the TI-84`).toBe(/π/.test(tiKeys) || checksPi || typesPi)
        expect(/π is the π key/.test(ns.map(stepText).join(' ')), `${where}: π on the Nspire`).toBe(/π/.test(nsKeys) || typesPi)
        // The mode word never contradicts the step that sets it.
        if (!degrees) expect(all, where).not.toMatch(/to DEGREE/)
      }
    },
    LOOP_TIMEOUT,
  )
})

describe('hand-checked panels', () => {
  it('y = 3 sin(2x − π/2) + 1: RADIAN, then Y1 = 3 SIN( 2 X,T,θ,n − π ÷ 2 ) + 1, and π is 2nd ^', () => {
    const w: Wave = { fn: 'sin', A: q(3), B: ex(2), C: ex(1, 4, 1), D: q(1) }
    expect(tiWaveKeys(w)).toBe('3 SIN( 2 X,T,θ,n − π ÷ 2 ) + 1')
    const d = featuresProblem({ wave: w, form: 'expanded', keyPoints: false })
    expect(d.calc.ti84[0]!.title).toBe('Set the angle mode to RADIAN')
    expect(d.calc.ti84[1]!.keys).toBe('Y= → Y1 = 3 SIN( 2 X,T,θ,n − π ÷ 2 ) + 1 → ENTER')
    expect(d.calc.ti84[1]!.why).toMatch(/π is 2nd \^/)
  })

  it('y = sec(2x) − 3 has no SEC key: Y1 = 1 ÷ COS( 2 X,T,θ,n ) − 3, and no π is mentioned', () => {
    const w: Wave = { fn: 'sec', A: q(1), B: ex(2), C: ex(0), D: q(-3) }
    expect(tiWaveKeys(w)).toBe('1 ÷ COS( 2 X,T,θ,n ) − 3')
  })

  it('the Ferris wheel h(t) = 30 − 25cos(πt/2): RADIAN, then intersect with Y2 = 40, warned about DEGREE', () => {
    const d = modelProblem({ story: 'wheel', wheel: { diameter: 50, center: 30, platform: null, period: 4, seconds: false, start: 'bottom', feet: true }, at: q(3, 2), target: q(40) })
    const ti = d.calc.ti84
    expect(ti[0]!.title).toBe('Set the angle mode to RADIAN')
    expect(ti[1]!.keys).toMatch(/Y1 = 30 − 25 COS\( π X,T,θ,n ÷ 2 \)|Y1 = .*COS\(/)
    expect(ti.at(-1)!.keys).toMatch(/Y2 = 40 .*5:intersect/)
    expect(ti.at(-1)!.caution).toMatch(/DEGREE mode/)
  })

  it('cos⁻¹(−1/2) in degrees: DEGREE, then 2nd COS of −1/2 (about 120), with no word about π', () => {
    const d = evaluateProblem({ fn: 'acos', input: '-1/2', mode: 'exact', unit: 'deg', notation: 1 })
    expect(d.calc.ti84[0]!.title).toBe('Set the angle mode to DEGREE')
    expect(d.calc.ti84[1]!.keys).toBe('2nd COS (COS⁻¹) (−) 1 ÷ 2 ) → ENTER')
    expect(d.calc.ti84[1]!.why).toMatch(/about 120 degrees/)
    expect(d.calc.ti84.map(stepText).join(' ')).not.toMatch(/π/)
  })

  it('arccos(3/2): the calculator shows ERR:DOMAIN, and there is no exact answer to check', () => {
    const d = evaluateProblem({ fn: 'acos', input: '3/2', mode: 'exact', unit: 'rad', notation: 0 })
    expect(d.calc.ti84[1]!.why).toMatch(/ERR:DOMAIN/)
    expect(d.calc.ti84.some((s) => s.title === 'Check your exact answer')).toBe(false)
  })
})
