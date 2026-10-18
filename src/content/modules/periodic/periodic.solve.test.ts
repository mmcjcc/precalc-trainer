/**
 * Independent check of chemistry chapter 6 (written by the reviewer, not the generator's author).
 * Anchors: known values from the three cited sources. Re-solve: every problem answered again from its
 * wording with a separate classification of the table, and every ranking checked against the data
 * and against the rules she is taught.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { PeriodicAnswer } from '@/content/types'
import { ELEMENTS } from '@/engine/chem/elements'
import { TRENDS } from '@/engine/chem/trends'
import { gradePtStage } from './grade'

const bySymbol = new Map(ELEMENTS.map((e) => [e.symbol, e]))
const byName = new Map(ELEMENTS.map((e) => [e.name, e]))
const trend = (symbol: string) => {
  const e = bySymbol.get(symbol)
  if (!e) throw new Error(`no element ${symbol}`)
  const t = TRENDS[e.z - 1]
  if (!t || t.z !== e.z) throw new Error(`no trend row for ${symbol}`)
  return t
}

describe('the trend table, against known values from its cited sources', () => {
  // Cordero et al. 2008 single-bond covalent radii, pm.
  const RADIUS: Record<string, number> = {
    H: 31, He: 28, Li: 128, Be: 96, B: 84, C: 76, N: 71, O: 66, F: 57, Ne: 58, Na: 166, Mg: 141, Al: 121,
    Si: 111, P: 107, S: 105, Cl: 102, Ar: 106, K: 203, Ca: 176, Br: 120, Rb: 220, Sr: 195, I: 139, Cs: 244, Ba: 215,
  }
  // NIST first ionization energies, kJ/mol.
  const IE: Record<string, number> = {
    H: 1312.0, He: 2372.3, Li: 520.2, Be: 899.5, B: 800.6, C: 1086.5, N: 1402.3, O: 1313.9, F: 1681.0, Ne: 2080.7,
    Na: 495.8, Mg: 737.7, Al: 577.5, Si: 786.5, P: 1011.8, S: 999.6, Cl: 1251.2, Ar: 1520.6, K: 418.8, Ca: 589.8,
    Br: 1139.9, Rb: 403.0, Sr: 549.5, I: 1008.4, Cs: 375.7, Ba: 502.9,
  }
  // Pauling electronegativities as revised by Allred (1961).
  const EN: Record<string, number> = {
    H: 2.2, Li: 0.98, Be: 1.57, B: 2.04, C: 2.55, N: 3.04, O: 3.44, F: 3.98, Na: 0.93, Mg: 1.31, Al: 1.61, Si: 1.9,
    P: 2.19, S: 2.58, Cl: 3.16, K: 0.82, Ca: 1.0, Br: 2.96, Rb: 0.82, Sr: 0.95, I: 2.66, Cs: 0.79, Ba: 0.89,
  }
  it('has every row for Z 1-56, in order', () => {
    expect(TRENDS.length).toBeGreaterThanOrEqual(56)
    TRENDS.slice(0, 56).forEach((row, i) => expect(row.z).toBe(i + 1))
  })
  it('matches the anchors', () => {
    for (const [s, v] of Object.entries(RADIUS)) expect(trend(s).radiusPm, `radius ${s}`).toBe(v)
    for (const [s, v] of Object.entries(IE)) expect(Math.abs(trend(s).ionizationKjMol - v), `ionization ${s}`).toBeLessThanOrEqual(0.6)
    for (const [s, v] of Object.entries(EN)) expect(trend(s).electronegativity, `electronegativity ${s}`).toBeCloseTo(v, 2)
  })
  it('keeps the four ionization exceptions that the rankings must avoid', () => {
    for (const [hi, lo] of [['Be', 'B'], ['N', 'O'], ['Mg', 'Al'], ['P', 'S']]) {
      expect(trend(hi!).ionizationKjMol, `${hi} > ${lo}`).toBeGreaterThan(trend(lo!).ionizationKjMol)
    }
  })
})

// --- an independent classification of the table -----------------------------------------------
const METALLOIDS = new Set(['B', 'Si', 'Ge', 'As', 'Sb', 'Te'])
const NONMETALS = new Set(['H', 'He', 'C', 'N', 'O', 'F', 'Ne', 'P', 'S', 'Cl', 'Ar', 'Se', 'Br', 'Kr', 'I', 'Xe', 'Rn'])
function blockOf(symbol: string): string {
  const e = bySymbol.get(symbol)!
  if (symbol === 'He') return 's'
  if (e.group === null) return 'f'
  if (e.group <= 2) return 's'
  if (e.group <= 12) return 'd'
  return 'p'
}
function classOf(symbol: string): string {
  if (METALLOIDS.has(symbol)) return 'metalloid'
  if (NONMETALS.has(symbol)) return 'nonmetal'
  return 'metal'
}
function familyOf(symbol: string): string | null {
  const g = bySymbol.get(symbol)!.group
  if (symbol === 'H') return null
  if (g === 1) return 'alkali metals'
  if (g === 2) return 'alkaline earth metals'
  if (g === 17) return 'halogens'
  if (g === 18) return 'noble gases'
  if (g !== null && g >= 3 && g <= 12) return 'transition metals'
  return null
}
function valenceOf(symbol: string): number {
  if (symbol === 'He') return 2
  const g = bySymbol.get(symbol)!.group!
  return g <= 2 ? g : g - 10
}
const MAIN = (symbol: string) => {
  const g = bySymbol.get(symbol)!.group
  return g !== null && (g <= 2 || g >= 13)
}

/** The taught rules: a is ranked above b for this property (larger radius, higher energy, ...). */
function ruleSays(property: string, a: string, b: string): boolean | null {
  const A = bySymbol.get(a)!
  const B = bySymbol.get(b)!
  if (A.group === null || B.group === null) return null
  // Radius and metallic character grow down and to the left; ionization energy and electronegativity up and to the right.
  const growsDownLeft = property === 'atomic radius' || property === 'metallic character'
  const down = Math.sign(A.period - B.period)
  const left = Math.sign(B.group - A.group)
  const votes = [down, left].filter((v) => v !== 0)
  if (votes.length === 0) return null
  if (votes.some((v) => v !== votes[0])) return null // the two rules disagree: not a taught ranking
  return growsDownLeft ? votes[0]! > 0 : votes[0]! < 0
}
function dataValue(property: string, symbol: string): number {
  const t = trend(symbol)
  if (property === 'atomic radius') return t.radiusPm
  if (property === 'first ionization energy') return t.ionizationKjMol
  if (property === 'electronegativity') return t.electronegativity
  return -t.ionizationKjMol // metallic character: the easier to ionize, the more metallic
}

const problem = (template: string, seed: number) => generateProblem('periodic' as never, template, seed).answer as PeriodicAnswer
const stageText = (a: PeriodicAnswer, label: RegExp) => a.stages.find((s) => label.test(s.label))
const SEEDS = 2000

function checkGrades(a: PeriodicAnswer, where: string) {
  for (const s of a.stages) expect(gradePtStage(a, s.id, s.answerText).verdict, `${where} ${s.label}=${s.answerText}`).toBe('correct')
  if (a.trap && a.trapStage && a.trapAnswer != null) {
    const g = gradePtStage(a, a.trapStage, a.trapAnswer)
    expect(g.verdict === 'mistake' && g.mistake, `${where} trap ${a.trap}=${a.trapAnswer}`).toBe(a.trap)
  }
}

describe('chapter 6, answered again from the wording', () => {
  it('locate: period, group, block, class and family from an independent table', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = problem('pt.locate', seed)
      const where = `pt.locate/${seed}: ${a.prompt}`
      const m = /^Where is (.+) on the periodic table\?$/.exec(a.prompt)
      expect(m, where).not.toBeNull()
      const el = bySymbol.get(m![1]!) ?? byName.get(m![1]!)
      expect(el, where).toBeDefined()
      const s = el!.symbol
      expect(stageText(a, /^Period$/)!.answerText, where).toBe(String(el!.period))
      const group = stageText(a, /^Group$/)!.answerText
      expect(group, where).toBe(el!.group === null ? 'none' : String(el!.group))
      expect(stageText(a, /^Block$/)!.answerText, where).toBe(blockOf(s))
      expect(stageText(a, /^Class$/)!.answerText, where).toBe(classOf(s))
      const fam = stageText(a, /^Family$/)
      expect(fam?.answerText ?? null, where).toBe(familyOf(s))
      checkGrades(a, `pt.locate/${seed}`)
    }
  }, 120000)

  it('valence: from the element or from a configuration', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = problem('pt.valence', seed)
      const where = `pt.valence/${seed}: ${a.prompt}`
      const column = /^How many valence electrons does an element in the (first|second) column have(?:, other than hydrogen)?\?$/.exec(a.prompt)
      const byGroup = column ? ([a.prompt, column[1] === 'first' ? '1' : '2'] as unknown as RegExpExecArray) : /^How many valence electrons does an element in group (\d+) have(?:, other than helium)?\?$/.exec(a.prompt)
      const named = byGroup ? null : /^How many valence electrons does (.+) have\?$/.exec(a.prompt)
      const config = /^Read this configuration: (.+)\.$/.exec(a.prompt)
      expect(byGroup || named || config, where).toBeTruthy()
      if (byGroup) {
        const g = Number(byGroup[1])
        expect(g <= 2 || g >= 13, `${where} main group`).toBe(true)
        expect(stageText(a, /Valence/)!.answerText, where).toBe(String(g <= 2 ? g : g - 10))
      } else if (named) {
        const el = bySymbol.get(named[1]!) ?? byName.get(named[1]!)
        expect(el && MAIN(el.symbol), `${where} main group`).toBeTruthy()
        expect(stageText(a, /Valence/)!.answerText, where).toBe(String(valenceOf(el!.symbol)))
      } else {
        const terms = config![1]!.split(/\s+/).map((t) => /^(\d)([spdf])(\d+)$/.exec(t)!)
        expect(terms.every(Boolean), where).toBe(true)
        const n = Math.max(...terms.map((t) => Number(t[1])))
        const outer = terms.filter((t) => Number(t[1]) === n && (t[2] === 's' || t[2] === 'p')).reduce((sum, t) => sum + Number(t[3]), 0)
        const last = terms[terms.length - 1]!
        // A main-group configuration: valence electrons are the outer s and p.
        expect(stageText(a, /Valence/)!.answerText, where).toBe(String(outer))
        const block = stageText(a, /^Block$/)
        if (block) expect(block.answerText, where).toBe(last[2])
        const period = stageText(a, /^Period$/)
        if (period) expect(period.answerText, where).toBe(String(n))
      }
      checkGrades(a, `pt.valence/${seed}`)
    }
  }, 120000)

  it('trends: every stored order agrees with the data and with the taught rules', () => {
    const transition: string[] = []
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = problem('pt.trends', seed)
      const where = `pt.trends/${seed}: ${a.prompt}`
      const m = /^Rank these by (atomic radius|first ionization energy|electronegativity|metallic character), (increasing|decreasing): (.+)\.$/.exec(a.prompt)
      expect(m, where).not.toBeNull()
      const [, property, direction, list] = m!
      const symbols = list!.split(', ')
      const order = stageText(a, /Order/)!.answerText.split(', ')
      expect([...order].sort(), where).toEqual([...symbols].sort())
      if (symbols.some((s) => !MAIN(s))) transition.push(where)
      for (let i = 0; i + 1 < order.length; i++) {
        const [hi, lo] = direction === 'decreasing' ? [order[i]!, order[i + 1]!] : [order[i + 1]!, order[i]!]
        // Metallic character has no measured column: the taught rule alone decides it.
        if (property !== 'metallic character') {
          expect(dataValue(property!, hi) > dataValue(property!, lo), `${where}: data puts ${lo} above ${hi}`).toBe(true)
        }
        expect(ruleSays(property!, hi, lo), `${where}: the rules do not put ${hi} above ${lo}`).toBe(true)
      }
      checkGrades(a, `pt.trends/${seed}`)
    }
    expect(transition.slice(0, 5), 'rankings stay with main-group elements').toEqual([])
  }, 120000)

  it('ions: an atom against its ion, and isoelectronic series by proton count', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = problem('pt.ions', seed)
      const where = `pt.ions/${seed}: ${a.prompt}`
      const pair = /^Which is larger, (\S+) or (\S+)\?$/.exec(a.prompt)
      const series = /^These ions have the same number of electrons\. Rank them by ionic radius, (increasing|decreasing): (.+)\.$/.exec(a.prompt)
      expect(pair || series, where).toBeTruthy()
      const ion = (text: string) => {
        const m = /^([A-Z][a-z]?)(\d*)([+-])?$/.exec(text)!
        const charge = m[3] ? (m[3] === '+' ? 1 : -1) * Number(m[2] || 1) : 0
        return { el: bySymbol.get(m[1]!)!, charge }
      }
      if (pair) {
        const [x, y] = [ion(pair[1]!), ion(pair[2]!)]
        expect(x.el.symbol, where).toBe(y.el.symbol)
        const charged = x.charge !== 0 ? x : y
        expect(charged.el.commonCharges, `${where} a taught charge`).toContain(charged.charge)
        // A cation is smaller than its atom; an anion is larger.
        const larger = charged.charge > 0 ? (x.charge === 0 ? pair[1] : pair[2]) : charged === x ? pair[1] : pair[2]
        expect(stageText(a, /Larger/)!.answerText, where).toBe(larger)
      } else {
        const ions = series![2]!.split(', ').map((t) => ({ text: t, ...ion(t) }))
        const electrons = new Set(ions.map((i) => i.el.z - i.charge))
        expect(electrons.size, `${where} isoelectronic`).toBe(1)
        for (const i of ions) expect(i.el.commonCharges, `${where} ${i.text}`).toContain(i.charge)
        // Fewer protons hold the same electrons less tightly: the larger ion.
        const decreasing = [...ions].sort((p, q) => p.el.z - q.el.z).map((i) => i.text)
        const want = series![1] === 'decreasing' ? decreasing : [...decreasing].reverse()
        expect(stageText(a, /Order/)!.answerText, where).toBe(want.join(', '))
      }
      checkGrades(a, `pt.ions/${seed}`)
    }
  }, 120000)

  it('why: down a group, a new shell and the inner electrons; across a row, more protons', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = problem('pt.why', seed)
      const where = `pt.why/${seed}: ${a.prompt}`
      const m = /^Why does (\S+) have a (larger|smaller|higher|lower) (atomic radius|first ionization energy|electronegativity) than (\S+)\?$/.exec(a.prompt)
      expect(m, where).not.toBeNull()
      const [, x, , property, y] = m!
      const [X, Y] = [bySymbol.get(x!)!, bySymbol.get(y!)!]
      const stage = a.stages[0]!
      const choice = (re: RegExp) => stage.choices!.find((c) => re.test(c.text))!.id
      const shell = choice(/another shell/i)
      const shielding = choice(/inner electrons/i)
      const protons = choice(/protons/i)
      const grade = (id: string) => gradePtStage(a, stage.id, id).verdict
      if (X.group === Y.group) {
        // Down a group both are the textbook reason: farther out, and shielded by more inner electrons.
        expect(grade(shell), `${where}: another shell`).toBe('correct')
        expect(grade(shielding), `${where}: shielding`).toBe('correct')
        expect(grade(protons), `${where}: protons`).not.toBe('correct')
      } else {
        expect(X.period, `${where} one row`).toBe(Y.period)
        expect(grade(protons), `${where}: protons`).toBe('correct')
        expect(grade(shell), `${where}: another shell`).not.toBe('correct')
      }
      expect(dataValue(property!, x!) !== dataValue(property!, y!), where).toBe(true)
      checkGrades(a, `pt.why/${seed}`)
    }
  }, 120000)
})
