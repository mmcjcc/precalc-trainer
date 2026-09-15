import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { assertNoFractionalPow } from '@/notation/calcString'
import type { ModuleId } from '@/shared/types'
import { betweenOf, convertExpr, fmtNum, linearCrossings, parseRelation, predicateFor } from './format'
import { calcPanels, calcSteps } from './index'
import { CALC_FAMILIES, type CalcFamily, type CalcId, type CalcInstance, type CalcStep } from './types'

const CALCS: readonly CalcId[] = ['ti84', 'nspire']
const SEEDS = [1, 2, 3, 7, 12, 29, 101, 4242]

interface Sample {
  label: string
  family: CalcFamily
  panels: Record<CalcId, CalcStep[]>
  indep: string
  k?: number
  twin?: number
  relation?: string
  /** Compound inequality: the solved interval's endpoints as the template prints them. */
  interval?: [string, string]
  asymptotes?: { vertical: number; horizontal: number }
}

const TEMPLATES: readonly [ModuleId, string, CalcFamily][] = [
  ['inequalities', 'ineq.distribute', 'inequality'],
  ['inequalities', 'ineq.compound', 'inequality'],
  ['inequalities', 'ineq.fraction', 'inequality'],
  ['numberLine', 'nl.read', 'number-line'],
  ['evenOdd', 'evenOdd.poly', 'even-odd'],
  ['inverses', 'inv.linear', 'inverse-linear'],
  ['inverses', 'inv.cbrt-shift', 'inverse-cbrt'],
  ['inverses', 'inv.frac-linear', 'inverse-frac-linear'],
  ['inverses', 'inv.rational', 'inverse-rational'],
  ['inverses', 'inv.mobius', 'inverse-mobius'],
  ['inverses', 'inv.quadratic-not', 'not-one-to-one'],
]

/** Families no template covers yet. */
const HAND_WRITTEN: readonly CalcInstance[] = [
  { family: 'function', expr: '2x + 3', inverseExpr: '(x - 3)/2', checkValue: 1, checkOutput: 5 },
  { family: 'function', expr: 'x^3 - 2', checkValue: -1, checkOutput: -3 },
  {
    family: 'plus-minus-sqrt',
    expr: '4x^2 - 7',
    inverseExpr: 'sqrt((x + 7)/4)',
    pmInner: '(x + 7)/4',
    checkValue: 1,
    checkOutput: -3,
  },
  { family: 'plus-minus-sqrt', expr: '(x - 1)^2 + 2', pmInner: 'x - 2', checkValue: 3, checkOutput: 6 },
]

function buildSamples(): Sample[] {
  const out: Sample[] = []
  for (const [moduleId, templateId, family] of TEMPLATES) {
    for (const seed of SEEDS) {
      const p = generateProblem(moduleId, templateId, seed)
      const params = p.params as Record<string, unknown>
      const s: Sample = {
        label: `${templateId}@${seed}`,
        family,
        panels: p.calc as Record<CalcId, CalcStep[]>,
        indep: p.vars[0] ?? 'x',
        k: p.check?.k,
        twin: p.check?.twin,
      }
      if (family === 'inequality') s.relation = p.start ?? undefined
      if (family === 'number-line') s.relation = p.statementText
      if (templateId === 'ineq.compound') s.interval = [String(params.lo), String(params.hi)]
      if (family === 'inverse-rational' || family === 'inverse-mobius') {
        s.asymptotes = { vertical: Number(params.verticalAsymptote), horizontal: Number(params.horizontalAsymptote) }
      }
      out.push(s)
    }
  }
  HAND_WRITTEN.forEach((inst, i) => {
    out.push({
      label: `${inst.family}#${i}`,
      family: inst.family,
      panels: calcPanels(inst),
      indep: 'x',
      k: inst.checkValue,
      twin: inst.twin,
    })
  })
  return out
}

const SAMPLES = buildSamples()

const fieldsOf = (st: CalcStep): string[] => [st.title, st.keys, st.why ?? '', st.caution ?? '']
const blobOf = (steps: CalcStep[]): string => steps.flatMap(fieldsOf).join('\n')

/** The number as a student would see it: -2, (-)2, (−)2 or −2 for negatives; never a bare 2 inside -2. */
function mentionsNum(blob: string, v: number): boolean {
  const abs = fmtNum(Math.abs(v)).replace('/', '\\/')
  const re =
    v < 0
      ? new RegExp(`(?:-|−|\\(-\\)|\\(−\\))${abs}(?![0-9])`)
      : new RegExp(`(?<![0-9.\\-−)])${abs}(?![0-9])`)
  return re.test(blob)
}

function isSingleComparison(relation: string | undefined): boolean {
  const g = relation ? parseRelation(relation) : null
  return !!g && g.length === 1 && g[0]!.length === 1
}

describe('calculator panels: every family × both calculators', () => {
  it('covers every CalcFamily', () => {
    const covered = new Set(SAMPLES.map((s) => s.family))
    for (const f of CALC_FAMILIES) expect(covered.has(f), `no sample for ${f}`).toBe(true)
  })

  it('renders non-empty steps with no placeholders, undefined, NaN or fractional powers', () => {
    for (const s of SAMPLES) {
      for (const calc of CALCS) {
        const steps = s.panels[calc]
        const where = `${s.label} ${calc}`
        expect(steps.length, where).toBeGreaterThan(0)
        for (const st of steps) {
          expect(st.title.trim(), where).not.toBe('')
          expect(st.keys.trim(), `${where} ${st.title}`).not.toBe('')
          for (const text of fieldsOf(st)) {
            expect(text, where).not.toContain('{{')
            expect(text, where).not.toContain('undefined')
            expect(text, where).not.toContain('NaN')
            expect(text, where).not.toContain('Infinity')
            expect(() => assertNoFractionalPow(text), where).not.toThrow()
          }
        }
      }
    }
  })

  it('mentions the check value in every panel that has one', () => {
    for (const s of SAMPLES) {
      if (s.k === undefined) continue
      for (const calc of CALCS) {
        expect(mentionsNum(blobOf(s.panels[calc]), s.k), `${s.label} ${calc} should mention k = ${s.k}`).toBe(true)
      }
    }
  })

  it('number-line panels store-and-test the set and never mention inverses', () => {
    const nl = SAMPLES.filter((s) => s.family === 'number-line')
    expect(nl.length).toBeGreaterThan(0)
    for (const s of nl) {
      for (const calc of CALCS) {
        const steps = s.panels[calc]
        const blob = blobOf(steps)
        const where = `${s.label} ${calc}: ${s.relation}`
        expect(blob, where).not.toMatch(/inverse/i)
        expect(blob, where).not.toContain('f1(f2')
        expect(blob, where).not.toContain('DrawInv')
        expect(blob, where).toContain('1/true means that x is in the set')
        expect(blob, where).toContain(calc === 'ti84' ? 'STO→ X,T,θ,n' : 'ctrl var (→)')
        // The predicate is typed in that calculator's own syntax, chains split into and.
        const pred = predicateFor(calc, s.relation)
        expect(pred, where).not.toBeNull()
        expect(blob, where).toContain(pred!)
        const test = steps.find((st) => st.title.startsWith('Test the'))
        expect(test, where).toBeDefined()
        expect(test!.keys, where).not.toMatch(calc === 'ti84' ? /[<≤>≥=]\s*X\s*[<≤>≥]/ : /[<≤>≥=]\s*x\s*[<≤>≥]/)
        // Every endpoint of the set is probed.
        for (const e of s.relation!.match(/-?\d+(?:\/\d+)?/g) ?? []) {
          expect(blob, `${where} should probe ${e}`).toContain(e)
        }
        if (/-\d/.test(s.relation!)) expect(blob, where).toContain('(−) key')
      }
    }
  })

  it('single inequalities keep the left − right graph and show that boundary', () => {
    const singles = SAMPLES.filter((s) => s.family === 'inequality' && isSingleComparison(s.relation))
    expect(singles.length).toBeGreaterThan(0)
    for (const s of singles) {
      const atom = parseRelation(s.relation!)![0]![0]!
      for (const calc of CALCS) {
        const blob = blobOf(s.panels[calc])
        const boundary = convertExpr(calc, `(${atom.lhs})-(${atom.rhs})`, s.indep)
        expect(blob, `${s.label} ${calc}`).toContain('Graph left side minus right side')
        expect(blob, `${s.label} ${calc}`).toContain(boundary)
      }
    }
  })

  it('compound inequalities graph between the lines and test the whole statement', () => {
    const compound = SAMPLES.filter((s) => s.family === 'inequality' && s.interval)
    expect(compound.length).toBeGreaterThan(0)
    for (const s of compound) {
      for (const calc of CALCS) {
        const steps = s.panels[calc]
        const blob = blobOf(steps)
        const where = `${s.label} ${calc}: ${s.relation}`
        expect(blob, where).toContain('between the lines')
        expect(blob, where).toContain(calc === 'ti84' ? 'Y3 = ' : 'f3(x) = ')
        expect(blob, where).toContain(predicateFor(calc, s.relation, s.indep)!)
        expect(blob, where).not.toMatch(/inverse/i)
        expect(blob, where).not.toContain('Enter the related equation')
        const test = steps.find((st) => st.title === 'Test the whole inequality')
        expect(test, where).toBeDefined()
        expect(test!.keys, where).toContain(' and ')
        // The probes straddle both endpoints of the solved interval.
        for (const e of s.interval!) expect(blob, `${where} should probe ${e}`).toContain(e)
      }
    }
  })

  it('not-one-to-one panels show k and its twin', () => {
    const not11 = SAMPLES.filter((s) => s.family === 'not-one-to-one')
    expect(not11.length).toBeGreaterThan(0)
    for (const s of not11) {
      for (const calc of CALCS) {
        const blob = blobOf(s.panels[calc])
        expect(s.twin, s.label).toBeDefined()
        expect(mentionsNum(blob, s.k!), `${s.label} ${calc} k`).toBe(true)
        expect(mentionsNum(blob, s.twin!), `${s.label} ${calc} twin`).toBe(true)
      }
    }
  })

  it('rational and Möbius panels state both asymptotes and how they swap', () => {
    const rat = SAMPLES.filter((s) => s.asymptotes)
    expect(rat.length).toBeGreaterThan(0)
    for (const s of rat) {
      const v = fmtNum(s.asymptotes!.vertical)
      const h = fmtNum(s.asymptotes!.horizontal)
      for (const calc of CALCS) {
        const blob = blobOf(s.panels[calc])
        const where = `${s.label} ${calc}`
        for (const phrase of [`x = ${v}`, `y = ${h}`, `x = ${h}`, `y = ${v}`]) expect(blob, where).toContain(phrase)
        if (calc === 'ti84') expect(blob, where).toContain('Detect Asymptotes')
      }
    }
  })

  it('calcSteps and calcPanels agree', () => {
    for (const inst of HAND_WRITTEN) {
      const panels = calcPanels(inst)
      for (const calc of CALCS) expect(calcSteps(calc, inst)).toEqual(panels[calc])
    }
  })
})

describe('relation helpers', () => {
  it('splits chains into and, and parenthesises and-groups inside or', () => {
    expect(predicateFor('nspire', 'x < -8 or -4 <= x < 0 or x >= 4')).toBe('x < -8 or (-4 ≤ x and x < 0) or x ≥ 4')
    expect(predicateFor('ti84', '-2 < 2x + 2 <= 0')).toBe('(-)2 < 2X+2 and 2X+2 ≤ 0')
    expect(predicateFor('ti84', 'x = -6')).toBe('X = (-)6')
    expect(predicateFor('nspire', undefined)).toBeNull()
  })

  it('finds lower/middle/upper in ascending, descending and "and" forms', () => {
    const asc = betweenOf({ family: 'inequality', expr: '2x+2', relation: '-2 < 2x + 2 <= 0' })
    expect(asc).toEqual({ middle: '2x + 2', lower: '-2', upper: '0', lowerIncluded: false, upperIncluded: true })
    const desc = betweenOf({ family: 'inequality', expr: 'x', relation: '5 >= x > 1' })
    expect(desc).toMatchObject({ lower: '1', upper: '5', lowerIncluded: false, upperIncluded: true })
    const and = betweenOf({ family: 'inequality', expr: 'x', relation: '3x - 1 >= 2 and 3x - 1 < 8' })
    expect(and).toMatchObject({ middle: '3x - 1', lower: '2', upper: '8', lowerIncluded: true })
    expect(betweenOf({ family: 'inequality', expr: 'x', relation: 'x < -2 or x > 5' })).toBeNull()
  })

  it('solves linear crossings and refuses non-linear middles', () => {
    expect(linearCrossings('-2x + 1', ['1', '5'])).toEqual([0, -2])
    expect(linearCrossings('2y + 3', ['0'], 'y')).toEqual([-1.5])
    expect(linearCrossings('x^2', ['1', '4'])).toBeNull()
  })
})
