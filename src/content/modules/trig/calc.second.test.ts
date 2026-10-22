/**
 * The second half's calculator panels say only what applies: MODE to DEGREE first wherever SIN, COS or TAN is pressed
 * on a degree angle (sides, angles, the special triangles), 2nd SIN for sin⁻¹, "Check your exact answer" only for an
 * exact answer, and where π is only where the keys or her angles use π (uc.solve in radians).
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { readExact, type TrigExact } from '@/engine/trig'
import type { ModuleId } from '@/shared/types'
import { angleProblem, sideProblem } from '../rightTriangle'
import { solveProblem } from '../unitCircle'

const LOOP_TIMEOUT = 120_000
const panelText = (steps: { title: string; keys: string; why?: string; caution?: string }[]) => steps.map((s) => `${s.title} | ${s.keys} | ${s.why ?? ''} | ${s.caution ?? ''}`).join('\n')

const CASES: [ModuleId, string][] = [
  ['rightTriangle', 'rt.ratios'],
  ['rightTriangle', 'rt.special'],
  ['rightTriangle', 'rt.side'],
  ['rightTriangle', 'rt.angle'],
  ['unitCircle', 'uc.given'],
  ['unitCircle', 'uc.solve'],
]

describe.each(CASES)('%s/%s calculator steps over 300 seeds', (moduleId, templateId) => {
  it(
    'the mode first where a trig key meets an angle, the inverse as 2nd SIN, the exact check only for exact answers, π only where used',
    () => {
      for (let seed = 1; seed <= 300; seed++) {
        const p = generateProblem(moduleId, templateId, seed)
        const ti = p.calc.ti84
        const ns = p.calc.nspire
        const text = panelText(ti)
        const where = `${templateId}/${seed}`
        expect(ti.length, where).toBeGreaterThan(0)
        expect(ns.length, where).toBe(ti.length)
        const usesTrigKeys = /\b(SIN|COS|TAN)\(/.test(ti.map((s) => s.keys).join(' ')) || /2nd (SIN|COS|TAN)/.test(text)
        if (usesTrigKeys) expect(ti[0]!.title, where).toMatch(/^Set the angle mode to (DEGREE|RADIAN)$/)
        const exact = p.answer.type === 'rightTriangle' ? p.answer.question === 'ratios' || p.answer.question === 'special' : p.answer.type === 'unitCircle' && p.answer.question === 'given'
        expect(ti.some((s) => s.title === 'Check your exact answer'), `${where}: the exact check`).toBe(exact)
        const radians = p.answer.type === 'unitCircle' && p.answer.question === 'solve' && p.answer.stages[0]!.check.kind === 'angles' && p.answer.stages[0]!.check.unit === 'rad'
        expect(/π/.test(text), `${where}: π mentioned`).toBe(radians)
        if (templateId === 'rt.side' || templateId === 'rt.angle' || templateId === 'rt.special') expect(ti[0]!.title, where).toBe('Set the angle mode to DEGREE')
        if (templateId === 'rt.angle') expect(ti[1]!.keys, where).toMatch(/^2nd (SIN|COS|TAN) \((SIN|COS|TAN)⁻¹\) \d+ ÷ \d+ \) → ENTER$/)
        if (templateId === 'rt.side') expect(ti[1]!.keys, where).toMatch(/^\d+ [×÷] (SIN|COS|TAN)\( \d+ \) → ENTER$/)
        if (templateId === 'uc.solve') expect(ti[1]!.keys, where).toMatch(/^2nd (SIN|COS|TAN) \((SIN|COS|TAN)⁻¹\)/)
      }
    },
    LOOP_TIMEOUT,
  )
})

describe('hand-checked panels', () => {
  it('a 20 ft ladder at 70°: DEGREE, then 20 × SIN( 70 ), about 18.79; legs 12 and 16: 2nd TAN, about 36.87', () => {
    const side = sideProblem({ scene: 'ladder', deg: 70, known: { role: 'hyp', value: 20 }, asked: 'opp', places: 1, caseIndex: 0 })
    expect(side.calc.ti84.map((s) => s.title)).toEqual(['Set the angle mode to DEGREE', 'Work out the side'])
    expect(side.calc.ti84[1]!.keys).toBe('20 × SIN( 70 ) → ENTER')
    expect(side.calc.ti84[1]!.why).toMatch(/about 18\.79/)
    const angle = angleProblem({ scene: 'plain', a: { role: 'opp', value: 12 }, b: { role: 'adj', value: 16 }, unit: null })
    expect(angle.calc.ti84[1]!.keys).toBe('2nd TAN (TAN⁻¹) 12 ÷ 16 ) → ENTER')
    expect(angle.calc.ti84[1]!.why).toMatch(/about 36\.869898/)
    expect(angle.calc.ti84[1]!.caution).toMatch(/TAN on its own gives the tangent of a number/)
  })

  it('cos θ = −1/2 in radians: RADIAN, then 2nd COS of −1/2 (about 2.094395), and π is 2nd ^ for her angles', () => {
    const d = solveProblem({ fn: 'cos', value: readExact('-1/2') as TrigExact, unit: 'rad' })
    expect(d.calc.ti84[0]!.title).toBe('Set the angle mode to RADIAN')
    expect(d.calc.ti84[1]!.keys).toBe('2nd COS (COS⁻¹) (−) 1 ÷ 2 ) → ENTER')
    expect(d.calc.ti84[1]!.why).toMatch(/about 2\.094395/)
    expect(d.calc.ti84[2]!.why).toMatch(/^π is 2nd \^/)
    const deg = solveProblem({ fn: 'csc', value: readExact('2') as TrigExact, unit: 'deg' })
    expect(deg.calc.ti84[1]!.keys).toBe('2nd SIN (SIN⁻¹) 1 ÷ ( 2 ) ) → ENTER')
    expect(deg.calc.ti84[2]!.keys).toBe('1 ÷ SIN( your angle ) → ENTER')
    expect(deg.calc.ti84.map((s) => `${s.keys} ${s.why}`).join(' ')).not.toMatch(/π/)
  })
})
