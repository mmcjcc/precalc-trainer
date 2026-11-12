/**
 * Independent re-solve of the formula templates: every part of 300 seeds per template is worked
 * out from the prompt's numbers, formulas and wording and the part's label, with the test's own
 * formula reader, significant-figure counter and plain arithmetic. It also re-checks the brief's
 * rule for empirical data: every mole ratio within 0.03 of its target, none readable two ways.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { MoleAnswer } from '@/content/types'

const HEAVY = 120_000
const SEEDS = 300

const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }

function readFormula(display: string): [string, number][] {
  const out: [string, number][] = []
  const add = (symbol: string, n: number) => {
    const at = out.findIndex(([s]) => s === symbol)
    if (at >= 0) out[at]![1] += n
    else out.push([symbol, n])
  }
  const [main, water] = display.split('·')
  const walk = (text: string, mult: number) => {
    let i = 0
    const sub = () => {
      let d = ''
      while (i < text.length && SUB[text[i]!]) d += SUB[text[i++]!]
      return d ? Number(d) : 1
    }
    while (i < text.length) {
      if (text[i] === '(') {
        const close = text.indexOf(')', i)
        const inner = text.slice(i + 1, close)
        i = close + 1
        walk(inner, mult * sub())
        continue
      }
      const m = /^[A-Z][a-z]?/.exec(text.slice(i))!
      i += m[0].length
      add(m[0], sub() * mult)
    }
  }
  walk(main!, 1)
  if (water) {
    const n = Number(/^\d+/.exec(water)![0])
    add('H', 2 * n)
    add('O', n)
  }
  return out
}

function figsOf(body: string): number {
  const digits = body.replace('.', '').replace(/^0+/, '')
  return body.includes('.') ? digits.length : digits.replace(/0+$/, '').length
}

function lastPlace(body: string): number {
  const dot = body.indexOf('.')
  return dot < 0 ? 0 : -(body.length - dot - 1)
}

function sig(v: number, n: number): number {
  return Number(v.toPrecision(n))
}

function massesOf(prompt: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const m of prompt.matchAll(/\b([A-Z][a-z]?) (\d+\.\d\d)\b/g)) out.set(m[1]!, Number(m[2]))
  return out
}

function sumMass(counts: [string, number][], masses: Map<string, number>): number {
  return Math.round(counts.reduce((s, [sym, n]) => s + n * masses.get(sym)!, 0) * 100) / 100
}

const NAME_TO_SYMBOL: Record<string, string> = { hydrogen: 'H', carbon: 'C', nitrogen: 'N', oxygen: 'O', sulfur: 'S', sodium: 'Na', magnesium: 'Mg', aluminum: 'Al', phosphorus: 'P', potassium: 'K', calcium: 'Ca', iron: 'Fe', copper: 'Cu', chlorine: 'Cl' }

function answers(templateId: string): MoleAnswer[] {
  return Array.from({ length: SEEDS }, (_, i) => {
    const p = generateProblem('chemFormulas', templateId, i + 1)
    if (p.answer.type !== 'mole') throw new Error('not a mole problem')
    return p.answer
  })
}

function countsText(counts: [string, number][]): string {
  return counts.map(([s, n]) => `${s}=${n}`).join(';')
}

/** Divide by the smallest and find the smallest multiplier (1-4) that leaves every ratio within 0.03 of whole. */
function empirical(symbols: string[], moles: number[]): { counts: [string, number][]; factor: number } {
  const min = Math.min(...moles)
  const ratios = moles.map((m) => m / min)
  for (let f = 1; f <= 4; f++) {
    if (ratios.every((r) => Math.abs(r - Math.round(r * f) / f) <= 0.03)) {
      // no smaller multiplier comes within 0.08 on every ratio (so nothing reads two ways)
      for (let g = 1; g < f; g++) expect(ratios.some((r) => Math.abs(r - Math.round(r * g) / g) >= 0.08)).toBe(true)
      return { counts: symbols.map((s, i) => [s, Math.round(ratios[i]! * f)]), factor: f }
    }
  }
  throw new Error(`ratios ${ratios.join(', ')} have no clean multiplier`)
}

describe('independent re-solve of the formula templates', () => {
  it(
    'cf.percent: molar masses and percents from the formula, the sample, or the hydrate',
    () => {
      answers('cf.percent').forEach((a, i) => {
        const where = `cf.percent@${i + 1}`
        const masses = massesOf(a.prompt)
        const place = /to the (tenths|hundredths) place/.exec(a.prompt)?.[1] === 'tenths' ? 1 : 2
        const formula = /\s\((\S+?)\)(?=[\s.,;])|, (\S+?),/.exec(a.prompt)!
        const shown = (formula[1] ?? formula[2])!
        const counts = readFormula(shown)
        for (const stage of a.stages) {
          if (stage.label.startsWith('Molar mass of')) {
            expect(Number(stage.answerText), where).toBeCloseTo(sumMass(counts, masses), 9)
            continue
          }
          if (stage.label === 'Percent water by mass') {
            const waters = Number(/·(\d+)H₂O/.exec(shown)![1])
            const want = ((waters * (2 * masses.get('H')! + masses.get('O')!)) / sumMass(counts, masses)) * 100
            expect(stage.answerText, where).toBe(want.toFixed(place))
            continue
          }
          const symbol = /\(([A-Z][a-z]?)\)/.exec(stage.label)![1]!
          if (stage.label.endsWith('by mass')) {
            const n = counts.find(([s]) => s === symbol)![1]
            const want = ((n * masses.get(symbol)!) / sumMass(counts, masses)) * 100
            expect(stage.answerText, where).toBe(want.toFixed(place))
          } else {
            const grams = [...a.prompt.matchAll(/(\d+\.?\d*) g of ([a-z]+)/g)].map((m) => ({ body: m[1]!, symbol: NAME_TO_SYMBOL[m[2]!]! }))
            const part = grams.find((g) => g.symbol === symbol)!
            const total = grams.reduce((s, g) => s + Number(g.body), 0)
            const totalPlace = Math.max(...grams.map((g) => lastPlace(g.body)))
            const totalFigs = figsOf(total.toFixed(Math.max(0, -totalPlace)))
            const figs = Math.min(figsOf(part.body), totalFigs)
            const got = stage.answerText
            expect(figsOf(got.replace(/ x 10\^.*/, '')), `${where} figures`).toBe(figs)
            expect(Number(got), where).toBeCloseTo(sig((Number(part.body) / total) * 100, figs), 9)
          }
        }
      })
    },
    HEAVY,
  )

  it(
    'cf.empirical: moles of the named element, then the formula — and the ratios are clean',
    () => {
      const factors = new Set<number>()
      answers('cf.empirical').forEach((a, i) => {
        const where = `cf.empirical@${i + 1}`
        const masses = massesOf(a.prompt)
        const data = a.prompt.includes('% ')
          ? [...a.prompt.matchAll(/(\d+\.?\d*)% [a-z]+ \(([A-Z][a-z]?)\)/g)].map((m) => ({ body: m[1]!, symbol: m[2]! }))
          : [...a.prompt.matchAll(/(\d+\.?\d*) g of [a-z]+ \(([A-Z][a-z]?)\)/g)].map((m) => ({ body: m[1]!, symbol: m[2]! }))
        expect(data.length, where).toBeGreaterThanOrEqual(2)
        const [molesPart, formulaPart] = a.stages as [MoleAnswer['stages'][number], MoleAnswer['stages'][number]]
        const asked = /\(([A-Z][a-z]?)\)$/.exec(molesPart.label)![1]!
        const d = data.find((x) => x.symbol === asked)!
        const figs = Math.min(figsOf(d.body), figsOf(masses.get(asked)!.toFixed(2)))
        expect(Number(molesPart.answerText), where).toBeCloseTo(sig(Number(d.body) / masses.get(asked)!, figs), 9)
        const moles = data.map((x) => Number(x.body) / masses.get(x.symbol)!)
        const solved = empirical(
          data.map((x) => x.symbol),
          moles,
        )
        // Rounding each mole amount to three figures first leads to the same formula.
        const rounded = empirical(
          data.map((x) => x.symbol),
          moles.map((m) => sig(m, 3)),
        )
        expect(countsText(rounded.counts), where).toBe(countsText(solved.counts))
        expect(formulaPart.answerText, where).toBe(countsText(solved.counts))
        factors.add(solved.factor)
      })
      expect([...factors].sort()).toEqual([1, 2, 3, 4])
    },
    HEAVY,
  )

  it(
    'cf.molecular: formula mass, multiplier, molecular formula',
    () => {
      answers('cf.molecular').forEach((a, i) => {
        const where = `cf.molecular@${i + 1}`
        const masses = massesOf(a.prompt)
        const emp = readFormula(/empirical formula (?:is )?([^\s,.]+)/.exec(a.prompt)![1]!)
        const molar = Number(/molar mass is (\d+\.?\d*) g\/mol/.exec(a.prompt)![1])
        const efm = sumMass(emp, masses)
        const k = Math.round(molar / efm)
        expect(Math.abs(molar / efm - k), where).toBeLessThanOrEqual(0.03)
        expect(Number(a.stages[0]!.answerText), where).toBeCloseTo(efm, 9)
        expect(a.stages[1]!.answerText, where).toBe(String(k))
        expect(a.stages[2]!.answerText, where).toBe(countsText(emp.map(([s, n]) => [s, n * k])))
        expect(k, where).toBeGreaterThanOrEqual(2)
      })
    },
    HEAVY,
  )
})
