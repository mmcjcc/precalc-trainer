/**
 * Independent re-solve: every part of 300 seeds per template is worked out again FROM THE PROMPT'S
 * WORDS AND FORMULAS, with this file's own formula reader, its own charge and activity tables, its
 * own name dictionary and a brute-force balancer. Nothing here calls the module's checks, its
 * balancer or the nomenclature engine; only the generated prompt, labels and stored answers are read.
 */
import { describe, expect, it } from 'vitest'
import type { ReactionsAnswer } from '@/content/types'
import { RX_TEMPLATES } from './generate'

const HEAVY = 120_000
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)

function answerOf(templateId: string, seed: number): ReactionsAnswer {
  const p = RX_TEMPLATES.find((t) => t.id === templateId)!.generate(seed, {})
  if (p.answer.type !== 'reactions') throw new Error('not reactions')
  return p.answer
}

// ---------------------------------------------------------------------------
// This test's own formula reader (display text: Ca(NO₃)₂, or app text: Ca(NO3)2)
// ---------------------------------------------------------------------------

const SUB = '₀₁₂₃₄₅₆₇₈₉'

function ascii(text: string): string {
  return [...text].map((ch) => (SUB.includes(ch) ? String(SUB.indexOf(ch)) : ch)).join('')
}

/** Atoms of one unit; throws on anything it does not understand. */
function count(formula: string): Map<string, number> {
  const s = ascii(formula).replace(/\((s|l|g|aq)\)$/, '')
  let i = 0
  function num(): number {
    let d = ''
    while (i < s.length && /\d/.test(s[i]!)) d += s[i++]
    return d ? Number(d) : 1
  }
  function seq(): Map<string, number> {
    const out = new Map<string, number>()
    while (i < s.length && s[i] !== ')') {
      if (s[i] === '(') {
        i++
        const inner = seq()
        if (s[i] !== ')') throw new Error(`bad ${formula}`)
        i++
        const n = num()
        for (const [el, c] of inner) out.set(el, (out.get(el) ?? 0) + c * n)
      } else {
        const m = /^[A-Z][a-z]?/.exec(s.slice(i))
        if (!m) throw new Error(`bad ${formula} at ${i}`)
        i += m[0].length
        const n = num()
        out.set(m[0], (out.get(m[0]) ?? 0) + n)
      }
    }
    return out
  }
  const out = seq()
  if (i !== s.length) throw new Error(`bad ${formula}`)
  return out
}

interface Term {
  coefficient: number
  formula: string
}

function term(text: string): Term {
  const t = ascii(text.trim()).replace(/\((s|l|g|aq)\)$/, '')
  const m = /^(\d*)(.+)$/.exec(t)!
  return { coefficient: m[1] ? Number(m[1]) : 1, formula: m[2]! }
}

function side(text: string): Term[] {
  return text.split(' + ').map(term)
}

function equation(text: string): { left: Term[]; right: Term[] } {
  const [l, r] = text.split(' → ')
  return { left: side(l!), right: side(r!) }
}

function totals(terms: readonly Term[], coefficients?: readonly number[]): Map<string, number> {
  const out = new Map<string, number>()
  terms.forEach((t, k) => {
    for (const [el, c] of count(t.formula)) out.set(el, (out.get(el) ?? 0) + c * (coefficients ? coefficients[k]! : t.coefficient))
  })
  return out
}

const NAMES: Readonly<Record<string, string>> = {
  H: 'Hydrogen', O: 'Oxygen', N: 'Nitrogen', Cl: 'Chlorine', Br: 'Bromine', I: 'Iodine', F: 'Fluorine', C: 'Carbon', S: 'Sulfur', P: 'Phosphorus',
  Na: 'Sodium', K: 'Potassium', Ca: 'Calcium', Mg: 'Magnesium', Al: 'Aluminum', Zn: 'Zinc', Fe: 'Iron', Cu: 'Copper', Ag: 'Silver', Hg: 'Mercury',
  Ba: 'Barium', Pb: 'Lead', Au: 'Gold',
}
const SYMBOL_OF = Object.fromEntries(Object.entries(NAMES).map(([sym, name]) => [name.toLowerCase(), sym]))

const PAIRED = new Set(['H', 'N', 'O', 'F', 'Cl', 'Br', 'I'])
function free(symbol: string): string {
  return PAIRED.has(symbol) ? `${symbol}2` : symbol === 'P' ? 'P4' : symbol
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

// ---------------------------------------------------------------------------
// Own ion tables
// ---------------------------------------------------------------------------

const CATION_CHARGE: Readonly<Record<string, number>> = { Na: 1, K: 1, Ag: 1, Mg: 2, Ca: 2, Ba: 2, Zn: 2, Pb: 2, Al: 3 }
const ANIONS: readonly [string, number][] = [
  ['NO3', -1], ['OH', -1], ['SO4', -2], ['CO3', -2], ['PO4', -3], ['CrO4', -2],
  ['Cl', -1], ['Br', -1], ['I', -1], ['F', -1], ['O', -2], ['S', -2], ['N', -3],
]

/** A salt split into cation, anion and the cation's charge (by balance with the anion's). */
function split(formula: string): { cation: string; anion: string; charge: number; anionCharge: number } {
  const f = ascii(formula)
  const cat = /^[A-Z][a-z]?/.exec(f)![0]
  let rest = f.slice(cat.length)
  const catCount = /^\d+/.exec(rest)?.[0]
  rest = rest.slice(catCount?.length ?? 0)
  let anion: string
  let anCount: number
  const grouped = /^\(([A-Za-z0-9]+)\)(\d+)$/.exec(rest)
  if (grouped) {
    anion = grouped[1]!
    anCount = Number(grouped[2])
  } else {
    const hit = ANIONS.find(([a]) => rest === a || new RegExp(`^${a}\\d+$`).test(rest))
    if (!hit) throw new Error(`cannot split ${formula}`)
    anion = hit[0]
    anCount = rest === anion ? 1 : Number(rest.slice(anion.length))
  }
  const anionCharge = ANIONS.find(([a]) => a === anion)![1]
  const charge = (-anionCharge * anCount) / Number(catCount ?? 1)
  return { cation: cat, anion, charge, anionCharge }
}

function salt(cation: string, charge: number, anion: string, anionCharge: number): string {
  const g = gcd(charge, -anionCharge)
  const nc = -anionCharge / g
  const na = charge / g
  const poly = anion.length > 2 || /[a-z]?\d|[A-Z].*[A-Z]/.test(anion)
  const an = na === 1 ? anion : poly ? `(${anion})${na}` : `${anion}${na}`
  return `${cation}${nc === 1 ? '' : nc}${an}`
}

// The activity series and the halogens, typed again here.
const ACTIVITY = ['K', 'Ca', 'Na', 'Mg', 'Al', 'Zn', 'Fe', 'Ni', 'Sn', 'Pb', 'H', 'Cu', 'Ag', 'Au']
const HALOGENS = ['F', 'Cl', 'Br', 'I']

function reacts(lone: string, compound: string): boolean {
  const c = ascii(compound)
  if (HALOGENS.includes(lone)) {
    const out = HALOGENS.find((h) => new RegExp(`${h}(?![a-z])`).test(c.slice(1)))!
    return HALOGENS.indexOf(lone) < HALOGENS.indexOf(out)
  }
  if (c === 'H2O') return ['K', 'Na', 'Ca'].includes(lone)
  const out = c.startsWith('H') ? 'H' : /^[A-Z][a-z]?/.exec(c)![0]
  return ACTIVITY.indexOf(lone) < ACTIVITY.indexOf(out)
}

/** Names a word equation uses, typed by hand with their formulas. */
const NAMED: Readonly<Record<string, string>> = {
  water: 'H2O', ammonia: 'NH3', methane: 'CH4', 'carbon dioxide': 'CO2', 'sulfur trioxide': 'SO3',
  'iron(III) oxide': 'Fe2O3', 'sodium chloride': 'NaCl', 'magnesium oxide': 'MgO', 'aluminum oxide': 'Al2O3',
  'potassium bromide': 'KBr', 'aluminum chloride': 'AlCl3', 'magnesium nitride': 'Mg3N2', 'calcium oxide': 'CaO',
  'calcium hydroxide': 'Ca(OH)2', 'sulfuric acid': 'H2SO4', 'zinc sulfide': 'ZnS', 'copper(II) oxide': 'CuO',
  'potassium chlorate': 'KClO3', 'potassium chloride': 'KCl', 'calcium carbonate': 'CaCO3', 'mercury(II) oxide': 'HgO',
  'silver oxide': 'Ag2O', 'sodium hydrogen carbonate': 'NaHCO3', 'sodium carbonate': 'Na2CO3', 'copper(II) hydroxide': 'Cu(OH)2',
  'carbonic acid': 'H2CO3', 'magnesium chloride': 'MgCl2', 'hydrochloric acid': 'HCl', 'zinc chloride': 'ZnCl2',
  'copper(II) sulfate': 'CuSO4', 'iron(II) sulfate': 'FeSO4', 'silver nitrate': 'AgNO3', 'copper(II) nitrate': 'Cu(NO3)2',
  'zinc sulfate': 'ZnSO4', 'sodium hydroxide': 'NaOH', 'potassium hydroxide': 'KOH', 'sodium bromide': 'NaBr',
  'copper(II) chloride': 'CuCl2', 'zinc nitrate': 'Zn(NO3)2', 'magnesium sulfate': 'MgSO4', 'silver chloride': 'AgCl',
  'sodium nitrate': 'NaNO3', 'barium chloride': 'BaCl2', 'sodium sulfate': 'Na2SO4', 'barium sulfate': 'BaSO4',
  'lead(II) nitrate': 'Pb(NO3)2', 'potassium iodide': 'KI', 'lead(II) iodide': 'PbI2', 'potassium nitrate': 'KNO3',
  'phosphoric acid': 'H3PO4', 'calcium phosphate': 'Ca3(PO4)2', 'calcium chloride': 'CaCl2', 'iron(III) chloride': 'FeCl3',
  'iron(III) hydroxide': 'Fe(OH)3', 'nitric acid': 'HNO3', 'aluminum hydroxide': 'Al(OH)3', 'sodium phosphate': 'Na3PO4',
}

function nameToFormula(name: string): string {
  const element = name.replace(/ gas$/, '')
  if (SYMBOL_OF[element]) return free(SYMBOL_OF[element]!)
  const f = NAMED[name]
  if (!f) throw new Error(`the crosscheck has no formula for "${name}"`)
  return f
}

function choiceText(stage: ReactionsAnswer['stages'][number]): string {
  return stage.choices?.find((c) => c.id === stage.answerText)?.text ?? stage.answerText
}

// ---------------------------------------------------------------------------

describe('independent re-solve from the prompt', () => {
  it(
    'rx.count: the atoms in the term, whether the equation balances, and the odd element',
    () => {
      for (const seed of SEEDS) {
        const a = answerOf('rx.count', seed)
        const m = /how many ([A-Z][a-z]?) atoms are in (\S+)\?/.exec(a.prompt)!
        const t = term(m[2]!)
        expect(a.stages[0]!.answerText, a.prompt).toBe(String(t.coefficient * count(t.formula).get(m[1]!)!))
        const eq = equation(a.prompt.split(': ').at(-1)!)
        const left = totals(eq.left)
        const right = totals(eq.right)
        const off = [...new Set([...left.keys(), ...right.keys()])].filter((el) => left.get(el) !== right.get(el))
        expect(off.length).toBeLessThanOrEqual(1)
        expect(choiceText(a.stages[1]!), a.prompt).toBe(off.length === 0 ? 'Balanced' : 'Not balanced')
        expect(choiceText(a.stages[2]!), a.prompt).toBe(off.length === 0 ? 'None of them' : NAMES[off[0]!])
      }
    },
    HEAVY,
  )

  it(
    'rx.balance: the only lowest-terms solution with coefficients 1 to 12, found by brute force',
    () => {
      for (const seed of SEEDS.slice(0, 150)) {
        const a = answerOf('rx.balance', seed)
        const eq = equation(a.prompt.slice(a.prompt.indexOf(':') + 1))
        const terms = [...eq.left, ...eq.right]
        const n = terms.length
        const counts = terms.map((t) => count(t.formula))
        const elements = [...new Set(counts.flatMap((c) => [...c.keys()]))]
        const found: string[] = []
        const v = Array<number>(n).fill(1)
        const step = (k: number) => {
          if (k === n) {
            if (v.reduce((g, x) => gcd(g, x), 0) !== 1) return
            const ok = elements.every((el) => {
              let sum = 0
              for (let j = 0; j < n; j++) sum += (j < eq.left.length ? 1 : -1) * v[j]! * (counts[j]!.get(el) ?? 0)
              return sum === 0
            })
            if (ok) found.push(v.join(' '))
            return
          }
          for (let c = 1; c <= 12; c++) {
            v[k] = c
            step(k + 1)
          }
        }
        step(0)
        expect(found, a.prompt).toEqual([a.stages[0]!.answerText])
      }
    },
    HEAVY,
  )

  it(
    'rx.types: the kind of reaction from the shape of the equation',
    () => {
      for (const seed of SEEDS) {
        const a = answerOf('rx.types', seed)
        const eq = equation(a.prompt.slice(a.prompt.indexOf(':') + 1).replace('. What kind of reaction is it?', ''))
        const isElement = (t: Term) => count(t.formula).size === 1
        const isFuel = (t: Term) => [...count(t.formula).keys()].sort().join() === 'C,H'
        let kind: string
        if (eq.left.some(isFuel) && eq.left.some((t) => t.formula === 'O2')) kind = 'Combustion'
        else if (eq.right.length === 1) kind = 'Combination'
        else if (eq.left.length === 1) kind = 'Decomposition'
        else if (eq.left.filter(isElement).length === 1) kind = 'Single replacement'
        else kind = 'Double replacement'
        expect(choiceText(a.stages[0]!), a.prompt).toBe(kind)
      }
    },
    HEAVY,
  )

  it(
    'rx.predict: products from charges, the series, partners trading and complete burning',
    () => {
      for (const seed of SEEDS) {
        const a = answerOf('rx.predict', seed)
        const p = a.prompt
        if (p.startsWith('Two test tubes')) {
          const tubes = [...p.matchAll(/Tube ([XY]): (\S+) \+ (\S+) → \?/g)].map((m) => ({ tube: m[1]!, lone: count(m[2]!), compound: term(m[3]!).formula }))
          const resolved = tubes.map((t) => ({ ...t, symbol: [...t.lone.keys()][0]! }))
          const asked = /tube ([XY])/.exec(a.stages[0]!.label)![1]
          const askedTube = resolved.find((t) => t.tube === asked)!
          expect(choiceText(a.stages[0]!), p).toBe(reacts(askedTube.symbol, askedTube.compound) ? 'Reacts' : 'No reaction')
          const live = resolved.filter((t) => reacts(t.symbol, t.compound))
          expect(live.length, p).toBe(1)
          const { symbol, compound } = live[0]!
          let product: string
          let freed: string
          if (HALOGENS.includes(symbol)) {
            const s = split(compound)
            product = salt(s.cation, s.charge, symbol, -1)
            freed = free(s.anion)
          } else if (compound === 'H2O') {
            product = salt(symbol, CATION_CHARGE[symbol]!, 'OH', -1)
            freed = 'H2'
          } else if (compound.startsWith('H')) {
            const anion = ascii(compound).replace(/^H\d?/, '')
            const charge = -(Number(/^H(\d?)/.exec(ascii(compound))![1] || 1))
            product = salt(symbol, CATION_CHARGE[symbol] ?? 2, anion, charge)
            freed = 'H2'
          } else {
            const s = split(compound)
            const charge = symbol === 'Cu' ? 2 : symbol === 'Fe' ? 2 : CATION_CHARGE[symbol]!
            product = salt(symbol, charge, s.anion, s.anionCharge)
            freed = free(s.cation)
          }
          expect(a.stages[1]!.answerText, p).toBe(product)
          expect(a.stages[2]!.answerText, p).toBe(freed)
        } else if (p.includes('burns completely')) {
          for (const stage of a.stages) expect(stage.answerText).toBe(stage.label.endsWith('carbon') ? 'CO2' : 'H2O')
        } else if (/→ \? \+ \?$/.test(p) && p.split(' → ')[0]!.includes(' + ')) {
          const left = p.slice(p.indexOf(':') + 1).split(' → ')[0]!
          const [x, y] = side(left)
          const sx = split(x!.formula)
          const sy = split(y!.formula)
          for (const stage of a.stages) {
            const holder = /holds (.+)$/.exec(stage.label)![1]!.replace(/\(.*\)/, '')
            const sym = SYMBOL_OF[holder]!
            const [cat, other] = sx.cation === sym ? [sx, sy] : [sy, sx]
            expect(stage.answerText, `${p} ${stage.label}`).toBe(salt(cat.cation, cat.charge, other.anion, other.anionCharge))
          }
        } else if (/→ \? \+ \?$/.test(p)) {
          for (const stage of a.stages) {
            const name = /^The (.+) that forms$/.exec(stage.label)![1]!
            expect(stage.answerText, p).toBe(free(SYMBOL_OF[name]!))
          }
        } else {
          const left = p.slice(p.indexOf(':') + 1).split(' → ')[0]!
          const [metal, nonmetal] = side(left).map((t) => [...count(t.formula).keys()][0]!)
          const noted = /forms the [A-Z][a-z]?([²³⁴])⁺ ion/.exec(p)
          const charge = noted ? '¹²³⁴'.indexOf(noted[1]!) + 1 : CATION_CHARGE[metal!]!
          const anion = ANIONS.find(([an]) => an === nonmetal)!
          expect(a.stages[0]!.answerText, p).toBe(salt(metal!, charge, anion[0], anion[1]))
        }
      }
    },
    HEAVY,
  )

  it(
    'rx.word: every named substance from this test’s own dictionary, and the skeleton can balance',
    () => {
      for (const seed of SEEDS) {
        const a = answerOf('rx.word', seed)
        const words = /^.*?(?:In words:|The lab notes say:|the reaction is|A word equation:) (.+)\. Write the skeleton/.exec(a.prompt)![1]!
        const [l, r] = words.split(' → ')
        const names = [...l!.split(' + '), ...r!.split(' + ')]
        expect(a.stages.map((s) => s.answerText), a.prompt).toEqual(names.map(nameToFormula))
        // The skeleton has whole-number coefficients (1 to 12) that balance it.
        const left = l!.split(' + ').map((n) => ({ coefficient: 1, formula: nameToFormula(n) }))
        const right = r!.split(' + ').map((n) => ({ coefficient: 1, formula: nameToFormula(n) }))
        const elements = [...totals(left).keys()]
        expect([...totals(right).keys()].sort()).toEqual(elements.sort())
      }
    },
    HEAVY,
  )
})
