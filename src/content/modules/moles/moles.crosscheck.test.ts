/**
 * Independent re-solve of the moles templates: every part of 300 seeds per template is worked out
 * from what she SEES — the prompt's numbers and formulas, and the part's label and unit — with the
 * test's own formula reader, its own significant-figure counter and plain floating-point arithmetic.
 * Nothing here imports the module's tables, graders or engine helpers.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { MoleAnswer } from '@/content/types'

const HEAVY = 120_000
const SEEDS = 300

const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
const SUP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' }

/** 'Mg₃(PO₄)₂' or 'CuSO₄·5H₂O' → atom counts. */
function readFormula(display: string): Map<string, number> {
  const out = new Map<string, number>()
  const [main, water] = display.split('·')
  const add = (m: Map<string, number>, symbol: string, n: number) => m.set(symbol, (m.get(symbol) ?? 0) + n)
  const parse = (text: string): Map<string, number> => {
    const counts = new Map<string, number>()
    let i = 0
    const sub = () => {
      let d = ''
      while (i < text.length && SUB[text[i]!]) d += SUB[text[i++]!]
      return d ? Number(d) : 1
    }
    while (i < text.length) {
      if (text[i] === '(') {
        const close = text.indexOf(')', i)
        const inner = parse(text.slice(i + 1, close))
        i = close + 1
        const n = sub()
        for (const [s, k] of inner) add(counts, s, k * n)
        continue
      }
      const m = /^[A-Z][a-z]?/.exec(text.slice(i))
      if (!m) throw new Error(`unreadable formula ${display}`)
      i += m[0].length
      add(counts, m[0], sub())
    }
    return counts
  }
  for (const [s, k] of parse(main!)) add(out, s, k)
  if (water) {
    const n = Number(/^\d+/.exec(water)![0])
    add(out, 'H', 2 * n)
    add(out, 'O', n)
  }
  return out
}

/** '3.163 × 10²³' → { value, figs }; trailing-point and placeholder rules as her class counts them. */
function readNumber(text: string): { value: number; figs: number } {
  const t = text.trim().replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => `^${[...m].map((c) => SUP[c]).join('')}`)
  const m = /^(\d+\.?\d*)(?:\s*[×x]\s*10\^(-?\d+))?$/.exec(t)
  if (!m) throw new Error(`unreadable number ${text}`)
  const body = m[1]!
  const value = Number(body) * 10 ** Number(m[2] ?? 0)
  const digits = body.replace('.', '').replace(/^0+/, '')
  const figs = body.includes('.') ? digits.length : digits.replace(/0+$/, '').length
  return { value, figs }
}

function answerValue(text: string): { value: number; figs: number } {
  return readNumber(text.replace(/\s*x\s*10\^/, ' × 10^'))
}

/** Round to n significant figures as a number. */
function sig(v: number, n: number): number {
  return Number(v.toPrecision(n))
}

function massesOf(prompt: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const m of prompt.matchAll(/\b([A-Z][a-z]?) (\d+\.\d\d)\b/g)) out.set(m[1]!, Number(m[2]))
  return out
}

function molarMass(formula: string, masses: Map<string, number>): number {
  let sum = 0
  for (const [symbol, n] of readFormula(formula)) {
    const m = masses.get(symbol)
    if (m == null) throw new Error(`no mass for ${symbol} in the prompt`)
    sum += n * m
  }
  return Math.round(sum * 100) / 100
}

function figsOfMass(m: number): number {
  return readNumber(m.toFixed(2)).figs
}

const ELEMENTS = new Set(['C', 'Fe', 'Al', 'Mg', 'He', 'Cu', 'Na', 'S', 'Ne'])
const DIATOMIC = new Set(['H₂', 'N₂', 'O₂', 'F₂', 'Cl₂', 'Br₂', 'I₂'])
const IONIC_START = ['Na', 'K', 'Ca', 'Mg', 'Al', 'Fe', 'Cu', 'Ba', '(NH₄)']

function unitOf(formula: string): string {
  if (ELEMENTS.has(formula)) return 'Atoms'
  if (DIATOMIC.has(formula)) return 'Molecules'
  if (IONIC_START.some((p) => formula.startsWith(p))) return 'Formula units'
  return 'Molecules'
}

const NA = 6.022e23

function expectClose(stage: MoleAnswer['stages'][number], value: number, figs: number, where: string) {
  const got = answerValue(stage.answerText)
  expect(got.figs, `${where} figures of ${stage.answerText}`).toBe(figs)
  const want = sig(value, figs)
  expect(Math.abs(got.value - want) / Math.abs(want), `${where}: ${stage.answerText} vs ${want}`).toBeLessThan(1e-9)
}

function answers(templateId: string): MoleAnswer[] {
  return Array.from({ length: SEEDS }, (_, i) => {
    const p = generateProblem('moles', templateId, i + 1)
    if (p.answer.type !== 'mole') throw new Error('not a mole problem')
    return p.answer
  })
}

const NUM = String.raw`(\d+\.?\d*(?: × 10[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)?)`

describe('independent re-solve of the moles templates', () => {
  it(
    'mo.particles: the counting unit, moles and particles, atoms of one element',
    () => {
      answers('mo.particles').forEach((a, i) => {
        const where = `mo.particles@${i + 1}`
        const formula = /Counting unit for (\S+)$/.exec(a.stages[0]!.label)![1]!
        const choice = a.stages[0]!.choices!.find((c) => c.id === a.stages[0]!.answerText)!.text
        expect(choice, where).toBe(unitOf(formula))
        const s1 = new RegExp(`Sample 1 holds ${NUM} (mol|representative particles) of`).exec(a.prompt)!
        const g1 = readNumber(s1[1]!)
        const b = a.stages[1]!
        if (s1[2] === 'mol') expectClose(b, g1.value * NA, Math.min(g1.figs, 4), where)
        else expectClose(b, g1.value / NA, Math.min(g1.figs, 4), where)
        if (a.stages[2]) {
          const c = a.stages[2]
          const counts = readFormula(formula)
          const s2 = new RegExp(`Sample 2 holds ${NUM} (mol of \\S+|atoms of [a-z]+)\\.`).exec(a.prompt)!
          const g2 = readNumber(s2[1]!)
          const symbol = /^(\S+) atoms in sample 2$/.exec(c.label)?.[1] ?? /^([A-Z][a-z]?)/.exec(c.unit === 'mol' ? '' : c.unit ?? '')?.[1]
          if (s2[2]!.startsWith('mol')) {
            expectClose(c, g2.value * NA * counts.get(symbol!)!, Math.min(g2.figs, 4), where)
          } else {
            const name = s2[2]!.slice('atoms of '.length)
            const sym = [...counts.keys()].find((k) => NAME[k] === name)!
            expectClose(c, g2.value / counts.get(sym)! / NA, Math.min(g2.figs, 4), where)
          }
        }
      })
    },
    HEAVY,
  )

  it(
    'mo.molarMass: each sum from the prompt’s masses',
    () => {
      answers('mo.molarMass').forEach((a, i) => {
        const masses = massesOf(a.prompt)
        for (const stage of a.stages) {
          const formula = /^Molar mass of (\S+)$/.exec(stage.label)![1]!
          expect(Number(stage.answerText), `mo.molarMass@${i + 1} ${formula}`).toBeCloseTo(molarMass(formula, masses), 9)
          expect(stage.answerText).toMatch(/^\d+\.\d\d$/)
        }
      })
    },
    HEAVY,
  )

  it(
    'mo.mass: grams and moles, then grams and particles',
    () => {
      answers('mo.mass').forEach((a, i) => {
        const where = `mo.mass@${i + 1}`
        const shown = formulaIn(a.prompt)
        const M = molarMass(shown, massesOf(a.prompt))
        const mf = figsOfMass(M)
        const s = new RegExp(`Sample 1 is ${NUM} (g|mol); sample 2 is ${NUM} (g|atoms|molecules|formula units)\\.`).exec(a.prompt)!
        const g1 = readNumber(s[1]!)
        const g2 = readNumber(s[3]!)
        const [b, c] = a.stages as [MoleAnswer['stages'][number], MoleAnswer['stages'][number]]
        if (s[2] === 'g') expectClose(b, g1.value / M, Math.min(g1.figs, mf), where)
        else expectClose(b, g1.value * M, Math.min(g1.figs, mf), where)
        if (s[4] === 'g') expectClose(c, (g2.value / M) * NA, Math.min(g2.figs, mf, 4), where)
        else expectClose(c, (g2.value / NA) * M, Math.min(g2.figs, mf, 4), where)
      })
    },
    HEAVY,
  )

  it(
    'mo.gas: when 22.4 L/mol applies, then liters, moles and grams',
    () => {
      answers('mo.gas').forEach((a, i) => {
        const where = `mo.gas@${i + 1}`
        const scene = /^First, a judgment: (.*?\.) Then/.exec(a.prompt)![1]!
        const liquidOrSolid = /holds (liquid|solid) /.test(scene)
        const atStp = /at (0 °C and 1 atm|STP|273 K and 1 atm)\.$/.test(scene)
        const want = liquidOrSolid ? 'No — it is not a gas' : atStp ? 'Yes — it is a gas at STP' : 'No — the gas is not at STP'
        expect(a.stages[0]!.answerText, where).toBe(want)
        const gas = /Then two samples of [a-z ]+ gas \((\S+)\) at STP/.exec(a.prompt)![1]!
        const M = molarMass(gas, massesOf(a.prompt))
        const mf = figsOfMass(M)
        const s = new RegExp(`sample 1 is ${NUM} (L|mol), sample 2 is ${NUM} (L|g)\\.`).exec(a.prompt)!
        const g1 = readNumber(s[1]!)
        const g2 = readNumber(s[3]!)
        const [, b, c] = a.stages as [unknown, MoleAnswer['stages'][number], MoleAnswer['stages'][number]]
        if (s[2] === 'L') expectClose(b, g1.value / 22.4, Math.min(g1.figs, 3), where)
        else expectClose(b, g1.value * 22.4, Math.min(g1.figs, 3), where)
        if (s[4] === 'L') expectClose(c, (g2.value / 22.4) * M, Math.min(g2.figs, 3, mf), where)
        else expectClose(c, (g2.value / M) * 22.4, Math.min(g2.figs, 3, mf), where)
      })
    },
    HEAVY,
  )
})

const NAME: Record<string, string> = { H: 'hydrogen', C: 'carbon', N: 'nitrogen', O: 'oxygen', S: 'sulfur', Na: 'sodium', Mg: 'magnesium', Al: 'aluminum', P: 'phosphorus', K: 'potassium', Ca: 'calcium', Fe: 'iron', Cu: 'copper', Cl: 'chlorine', F: 'fluorine', I: 'iodine', Ba: 'barium' }

/** The first formula printed in the prompt: '(Fe₂O₃)' or ', Fe₂O₃,'. */
function formulaIn(prompt: string): string {
  // A formula in parentheses follows a space (so 'iron(III)' is not one); one between commas stands alone.
  const m = /\s\((\S+?)\)(?=[\s.,;])|, (\S+?),/.exec(prompt)!
  return (m[1] ?? m[2])!
}
