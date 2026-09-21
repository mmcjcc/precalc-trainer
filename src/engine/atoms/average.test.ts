import { describe, expect, it } from 'vitest'
import type { AtomIsotopeRow } from '@/shared/types'
import { elementBySymbol, NATURAL_ISOTOPES } from '../chem/elements'
import { evaluateSigFigTask, validateSigFigTask } from '../sigfigs/evaluate'
import { sigFigMistakeCandidates } from '../sigfigs/grade'
import { averageMassMistakeCandidates, averageMassTask, exactAverage, explainAverageMass, gradeAverageMass, type AverageMassQuestion } from './average'
import { display, ratFromText, textAt } from './exact'

function real(symbol: string): AverageMassQuestion {
  const el = elementBySymbol(symbol)!
  const isotopes: AtomIsotopeRow[] = NATURAL_ISOTOPES[symbol]!.map((i) => ({
    label: `${el.name}-${i.massNumber}`,
    massNumber: i.massNumber,
    mass: i.mass,
    abundance: i.abundance,
  }))
  return { kind: 'avgmass', element: el.name, symbol, fictional: false, isotopes, task: averageMassTask(isotopes) }
}

const chlorine = real('Cl')

/** A made-up element X, CK-12 style. */
const elementX: AverageMassQuestion = (() => {
  const isotopes: AtomIsotopeRow[] = [
    { label: 'X-46', massNumber: 46, mass: '45.953', abundance: '8.25' },
    { label: 'X-48', massNumber: 48, mass: '47.948', abundance: '73.72' },
    { label: 'X-49', massNumber: 49, mass: '48.948', abundance: '18.03' },
  ]
  return { kind: 'avgmass', element: 'element X', symbol: 'X', fictional: true, isotopes, task: averageMassTask(isotopes) }
})()

describe('averageMassTask', () => {
  it('is a sig-fig mixed task: mass × abundance ÷ 100 per isotope (100 exact), joined by +', () => {
    expect(chlorine.task).toEqual({
      kind: 'mixed',
      operands: [
        { terms: [{ text: '34.969' }, { text: '75.76' }, { text: '100', exact: true, note: 'per cent: out of 100' }], ops: ['*', '/'] },
        { terms: [{ text: '36.966' }, { text: '24.24' }, { text: '100', exact: true, note: 'per cent: out of 100' }], ops: ['*', '/'] },
      ],
      ops: ['+'],
    })
    expect(validateSigFigTask(chlorine.task)).toEqual([])
    expect(evaluateSigFigTask(chlorine.task).expected.text).toBe('35.45')
    expect(display(exactAverage(chlorine.isotopes))).toBe('35.4530728')
  })

  it('every real table with its natural isotopes validates, and its answer agrees with the periodic table', () => {
    for (const symbol of Object.keys(NATURAL_ISOTOPES)) {
      const qq = real(symbol)
      expect(validateSigFigTask(qq.task), symbol).toEqual([])
      const ev = evaluateSigFigTask(qq.task)
      const weight = elementBySymbol(symbol)!.atomicWeight
      // The rounded answer and the printed atomic weight agree to the coarser of their two places.
      const coarse = Math.max(ev.expected.place, -(weight.split('.')[1]?.length ?? 0))
      const a = textAt(ratFromText(ev.expected.value), coarse)
      const b = textAt(ratFromText(weight), coarse)
      expect(a, `${symbol}: ${ev.expected.text} vs ${weight}`).toBe(b)
    }
  })
})

describe('gradeAverageMass: chlorine', () => {
  const grade = (t: string) => gradeAverageMass(chlorine, t)

  it('the right answer, in any spelling, is right', () => {
    for (const t of ['35.45', '3.545e1', '3.545 x 10^1']) {
      const g = grade(t)
      expect(g.status, t).toBe('correct')
      expect(g.pattern).toBeUndefined()
    }
    expect(grade('35.45').message).toBe('Correct! 35.45 u is the weighted average, rounded to the hundredths place.')
  })

  it('names each chemistry mistake from her own numbers', () => {
    const cases: [string, string, string][] = [
      ['3545', 'at_percent_not_decimal', '100 times too big'],
      ['3545.31', 'at_percent_not_decimal', '75.76% → 0.7576'],
      ['35.97', 'at_unweighted_average', '(34.969 + 36.966) ÷ 2'],
      ['35.9675', 'at_unweighted_average', 'plain average of the masses'],
      ['36', 'at_unweighted_average', 'plain average of the mass numbers, (35 + 37) ÷ 2'],
      ['35.48', 'at_mass_numbers_used', 'mass numbers (35, 37)'],
      ['35.4848', 'at_mass_numbers_used', 'mass numbers'],
      ['26.49', 'at_isotope_left_out', 'leaves out chlorine-37 (24.24%)'],
      ['8.961', 'at_isotope_left_out', 'leaves out chlorine-35 (75.76%)'],
    ]
    for (const [typed, id, words] of cases) {
      const g = grade(typed)
      expect(g.status, typed).toBe('wrong')
      expect(g.pattern?.id, typed).toBe(id)
      expect(g.message, typed).toContain(words)
      expect(g.message).toBe(g.pattern?.witness)
    }
  })

  it('figure slips come from the sig-fig grader itself', () => {
    expect(grade('35.453').pattern?.id).toBe('sf_most_precise')
    expect(grade('35.4530728').pattern?.id).toBe('sf_unrounded')
    expect(grade('35.450').pattern?.id).toBe('sf_extra_zeros')
    const exact = grade('40')
    expect(exact.pattern?.id).toBe('sf_exact_limited')
    expect(exact.message).toContain('The 100 that turns a percent into a decimal is exact')
  })

  it('a wrong answer that matches no named mistake gets a plain, specific message and no pattern', () => {
    const between = grade('35.1')
    expect(between.status).toBe('wrong')
    expect(between.pattern).toBeUndefined()
    expect(between.message).toContain('not the weighted average of this table')
    const outside = grade('100')
    expect(outside.pattern).toBeUndefined()
    expect(outside.message).toContain('between the lightest and the heaviest, 34.969 u and 36.966 u')
    // Right arithmetic, too few figures: the sig-fig grader's plain message stands.
    const coarse = grade('35.5')
    expect(coarse.pattern).toBeUndefined()
    expect(coarse.message).toContain('Your arithmetic is right')
  })

  it('a unit or a stray word is a parse error, not a wrong answer', () => {
    expect(grade('35.45 u').status).toBe('parse_error')
    expect(grade('').status).toBe('parse_error')
  })
})

describe('gradeAverageMass: every real table and a made-up element', () => {
  const all = [...Object.keys(NATURAL_ISOTOPES).map(real), elementX]

  it('the canonical answer and its alternates grade right; every mistake candidate grades to its own id and never to right', () => {
    for (const qq of all) {
      const ev = evaluateSigFigTask(qq.task)
      for (const t of [ev.expected.text, ...ev.expected.alternates]) expect(gradeAverageMass(qq, t).status, `${qq.symbol} ${t}`).toBe('correct')
      const cands = averageMassMistakeCandidates(qq)
      expect(cands.map((c) => c.id), qq.symbol).toContain('at_percent_not_decimal')
      expect(cands.map((c) => c.id), qq.symbol).toContain('at_unweighted_average')
      expect(cands.map((c) => c.id), qq.symbol).toContain('at_isotope_left_out')
      for (const c of cands) {
        expect(c.text).not.toBe(ev.expected.text)
        const g = gradeAverageMass(qq, c.text)
        expect(g.status).toBe('wrong')
        expect(g.pattern?.id).toBe(c.id)
      }
      // The sig-fig grader's own candidates keep their sf_* ids here.
      for (const c of sigFigMistakeCandidates(qq.task)) expect(gradeAverageMass(qq, c.text).pattern?.id, `${qq.symbol} ${c.text}`).toBe(c.id)
    }
  })

  it('element X: exact arithmetic, the mass-number mistake is visible', () => {
    const ev = evaluateSigFigTask(elementX.task)
    expect(display(exactAverage(elementX.isotopes))).toBe('47.9637125')
    expect(ev.expected.text).toBe('47.96')
    expect(gradeAverageMass(elementX, '48.02').pattern?.id).toBe('at_mass_numbers_used')
    expect(gradeAverageMass(elementX, '39.14').pattern?.id).toBe('at_isotope_left_out')
  })
})

describe('catalog examples agree with the engine', () => {
  it('the at_* average-mass examples are the numbers the engine computes', () => {
    const texts = (qq: AverageMassQuestion) => Object.fromEntries(averageMassMistakeCandidates(qq).map((c) => [c.text, c.id]))
    const cl = texts(chlorine)
    expect(cl['35.97']).toBe('at_unweighted_average') // (34.969 + 36.966) ÷ 2
    expect(cl['35.48']).toBe('at_mass_numbers_used') // 35 × 0.7576 + 37 × 0.2424
    expect(gradeAverageMass(chlorine, '3545').pattern?.id).toBe('at_percent_not_decimal')
    const mg = real('Mg')
    expect(evaluateSigFigTask(mg.task).expected.text).toBe('24.31')
    expect(gradeAverageMass(mg, '21.81').message).toContain('leaves out magnesium-25')
  })
})

describe('explainAverageMass', () => {
  it('shows the decimals, each product, the sum, the figures and a check', () => {
    expect(explainAverageMass(chlorine)).toEqual([
      'Average atomic mass is a weighted average: each isotope counts in proportion to how common it is.',
      'Change each percent to a decimal by dividing by 100: 75.76% → 0.7576, 24.24% → 0.2424.',
      'chlorine-35: 34.969 u × 0.7576 = 26.4925144 u',
      'chlorine-37: 36.966 u × 0.2424 = 8.9605584 u',
      'Add them: 26.4925144 + 8.9605584 = 35.4530728 u.',
      'Significant figures: each product keeps the fewest figures of its mass and its percent (the 100 is exact), so 26.49 is good to the hundredths place, 8.961 is good to the thousandths place. The sum stops at the least precise of those places: the hundredths.',
      'Rounded to the hundredths place: 35.45 u.',
      'Check: 35.45 u lies between 34.969 u and 36.966 u, nearest chlorine-35, the most abundant isotope.',
      'That agrees with the 35.45 printed for chlorine on the periodic table.',
    ])
    expect(explainAverageMass(elementX).some((l) => l.includes('periodic table'))).toBe(false)
  })
})
