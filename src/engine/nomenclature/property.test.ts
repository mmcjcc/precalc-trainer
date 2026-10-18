/**
 * Property loops over everything the model can build.
 *
 * - every ionic compound (each compound cation with each anion), acid, hydrogen compound and every binary
 *   molecular compound (each supported pair, counts 1 to 10): name → formula → name and formula → name → formula
 *   round-trip, and both graders say correct for the printed answers;
 * - every ionic compound, acid and ion, and every molecular pair at seeded counts: each listed candidate grades
 *   as its own id, differs from the answer, has a distinct text, and its witness never prints the answer;
 * - seeded: right answers written every accepted way (case, spacing, British spellings, elision either way,
 *   aliases, Unicode subscripts, the hydrate dot, acetate's three formulas, (aq)) always grade correct;
 * - seeded: 2,000 ionic formulas with the right ions and random counts grade correct exactly when the counts are
 *   the right ones, are never invalid or unsupported, and a balanced multiple is always nm_not_lowest_ratio.
 */
import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../samples'
import { acidCompounds, compoundFormula, compoundName, hydrateCompound, hydrogenCompounds, ionicCompounds, molecularCompound, molecularCompounds, molecularPairs, unitText } from './compounds'
import {
  formulaFromNameMistakes,
  gradeFormulaFromName,
  gradeIonFormula,
  gradeIonName,
  gradeNameFromFormula,
  ionFormulaMistakes,
  ionNameMistakes,
  nameFromFormulaMistakes,
} from './grade'
import { ionDisplay, nmIons } from './ions'
import { nameKey } from './names'
import { compoundOfFormula, compoundOfName } from './read'
import { formulaDisplay, SUBSCRIPT_DIGITS } from './text'
import type { Compound, NmGrade, NmMistakeCandidate } from './types'

type Rand = () => number
const pick = <T>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!
const verdictOf = (g: NmGrade) => (g.verdict === 'mistake' ? g.mistake : g.verdict)
const SWEEP_TIMEOUT = 120_000

/** True when `answer` appears in `text` as a whole formula or name (not as the start of a longer one). */
function printsAnswer(text: string, answer: string): boolean {
  for (let i = text.indexOf(answer); i >= 0; i = text.indexOf(answer, i + 1)) {
    const next = text[i + answer.length]
    const prev = text[i - 1]
    const glued = (ch: string | undefined) => ch !== undefined && (/[A-Za-z0-9(]/.test(ch) || SUBSCRIPT_DIGITS.includes(ch) || '·⁺⁻'.includes(ch))
    if (!glued(next) && !(prev !== undefined && /[A-Za-z]/.test(prev))) return true
  }
  return false
}

function checkCandidates(label: string, list: NmMistakeCandidate[] | null, grade: (t: string) => NmGrade, answers: string[], key: (t: string) => string): void {
  expect(list, label).not.toBeNull()
  const texts = list!.map((c) => key(c.text))
  expect(new Set(texts).size, `${label}: distinct`).toBe(texts.length)
  for (const c of list!) {
    expect(answers.map(key), `${label}: ${c.text}`).not.toContain(key(c.text))
    const g = grade(c.text)
    expect(verdictOf(g), `${label}: ${c.text}`).toBe(c.id)
    expect(g.verdict === 'mistake' && g.witness).toBe(c.witness)
    // Her own answer may be quoted (it can contain the right word: "hydrogen carbonate" for carbonate).
    const theirs = c.witness.replace(new RegExp(c.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '…')
    for (const a of answers) expect(printsAnswer(theirs, a), `${label}: ${c.id} witness prints ${a}: ${c.witness}`).toBe(false)
  }
}

const ALL_FIXED: Compound[] = [...ionicCompounds(), ...acidCompounds(), ...hydrogenCompounds()]

describe('round trips over everything the tables build', () => {
  it('ionic compounds, acids and hydrogen compounds: formula ⟷ name, and both graders say correct', () => {
    expect(ALL_FIXED.length).toBeGreaterThan(1450)
    for (const c of ALL_FIXED) {
      const f = compoundFormula(c)
      const n = compoundName(c)
      const fromF = compoundOfFormula(f)
      const fromN = compoundOfName(n)
      expect(fromF && compoundName(fromF), f).toBe(n)
      expect(fromN && compoundFormula(fromN), n).toBe(f)
      expect(verdictOf(gradeNameFromFormula(f, n)), `${f} / ${n}`).toBe('correct')
      expect(verdictOf(gradeFormulaFromName(n, f)), `${n} / ${f}`).toBe('correct')
    }
  }, SWEEP_TIMEOUT)

  it('every binary molecular compound (97 pairs × counts 1 to 10, and water)', () => {
    const all = molecularCompounds()
    expect(all.length).toBe(9701)
    for (const c of all) {
      const f = compoundFormula(c)
      const n = compoundName(c)
      expect(compoundName(compoundOfFormula(f)!), f).toBe(n)
      expect(compoundFormula(compoundOfName(n)!), n).toBe(f)
    }
  }, SWEEP_TIMEOUT)

  it('hydrates of every salt (seeded water counts)', () => {
    const r = mulberry32(2026_11_09)
    for (const salt of ionicCompounds()) {
      const c = hydrateCompound(salt, 1 + Math.floor(r() * 10))
      const f = compoundFormula(c)
      const n = compoundName(c)
      expect(compoundName(compoundOfFormula(f)!), f).toBe(n)
      expect(compoundFormula(compoundOfName(n)!), n).toBe(f)
    }
  }, SWEEP_TIMEOUT)

  it('every ion: its name and its formula grade correct', () => {
    for (const ion of nmIons()) {
      expect(verdictOf(gradeIonName(ion.text, ion.name)), ion.text).toBe('correct')
      expect(verdictOf(gradeIonFormula(ion.name, ion.text)), ion.name).toBe('correct')
      expect(verdictOf(gradeIonFormula(ion, ionDisplay(ion))), ion.name).toBe('correct')
    }
  })
})

describe('every candidate grades as its own id and never equals the answer', () => {
  it('names and formulas of every ionic compound, acid and hydrogen compound', () => {
    let count = 0
    const ids = new Set<string>()
    for (const c of ALL_FIXED) {
      const f = compoundFormula(c)
      const n = compoundName(c)
      const names = nameFromFormulaMistakes(f)
      checkCandidates(f, names, (t) => gradeNameFromFormula(f, t), [n], nameKey)
      const formulas = formulaFromNameMistakes(n)
      checkCandidates(n, formulas, (t) => gradeFormulaFromName(n, t), [f, formulaDisplay(f)], (t) => t)
      for (const x of [...names!, ...formulas!]) ids.add(x.id)
      count += names!.length + formulas!.length
    }
    expect(count).toBeGreaterThan(10_000)
    expect(ids.size).toBe(23) // all but the molecular, hydrate, ion-charge and class ids
  }, SWEEP_TIMEOUT)

  it('every molecular pair at seeded counts, and every hydrate of a few salts', () => {
    const r = mulberry32(711)
    for (const [a, b] of molecularPairs())
      for (let k = 0; k < 3; k++) {
        const c = molecularCompound(a, 1 + Math.floor(r() * 6), b, 1 + Math.floor(r() * 6))
        const f = compoundFormula(c)
        const n = compoundName(c)
        checkCandidates(f, nameFromFormulaMistakes(f), (t) => gradeNameFromFormula(f, t), [n], nameKey)
        checkCandidates(n, formulaFromNameMistakes(n), (t) => gradeFormulaFromName(n, t), [f, formulaDisplay(f)], (t) => t)
      }
    const salts = ionicCompounds()
    for (let k = 0; k < 150; k++) {
      const c = hydrateCompound(pick(r, salts), 1 + Math.floor(r() * 10))
      const f = compoundFormula(c)
      const n = compoundName(c)
      checkCandidates(f, nameFromFormulaMistakes(f), (t) => gradeNameFromFormula(f, t), [n], nameKey)
      checkCandidates(n, formulaFromNameMistakes(n), (t) => gradeFormulaFromName(n, t), [f, formulaDisplay(f)], (t) => t)
    }
  }, SWEEP_TIMEOUT)

  it('every ion, both directions', () => {
    for (const ion of nmIons()) {
      checkCandidates(ion.text, ionNameMistakes(ion), (t) => gradeIonName(ion, t), [ion.name], (t) => nameKey(t).replace(/ ion$/, ''))
      checkCandidates(ion.name, ionFormulaMistakes(ion), (t) => gradeIonFormula(ion, t), [ion.text, ionDisplay(ion)], (t) => t)
    }
  })
})

// --- right answers written every accepted way ---------------------------------------------------------

function nameVariant(r: Rand, name: string): string {
  let s = name
  if (r() < 0.5) s = s.replace(/\(/g, ' (')
  if (r() < 0.3) s = s.replace(/\(([IVX]+)\)/g, (_m, x: string) => `( ${x.toLowerCase()} )`)
  if (r() < 0.4) s = s.replace(/sulf/g, 'sulph')
  if (r() < 0.4) s = s.replace(/aluminum/g, 'aluminium').replace(/cesium/g, 'caesium')
  if (r() < 0.5) s = s.replace(/\b(mon|tetr|pent|hex|hept|oct|non|dec)(oxide|oxygen)/g, (_m, p: string, w: string) => `${p}${p === 'mon' ? 'o' : 'a'}${w}`)
  if (r() < 0.3) s = s.replace(/hydrogen carbonate/, 'bicarbonate')
  if (r() < 0.3) s = s.replace(/\b(mono|di|tri|tetra|penta|hexa|hepta|octa|nona|deca)hydrate/, '$1-hydrate')
  const caseStyle = r()
  if (caseStyle < 0.2) s = s.toUpperCase()
  else if (caseStyle < 0.4) s = s.replace(/\b[a-z]/g, (ch) => ch.toUpperCase())
  if (r() < 0.3) s = `  ${s.replace(/ /g, '  ')} `
  return s
}

const SUB = (d: string) => [...d].map((x) => SUBSCRIPT_DIGITS[Number(x)]).join('')

function formulaVariant(r: Rand, formula: string): string {
  let s = formula
  if (r() < 0.3) s = s.replace(/CH3COO/g, () => pick(r, ['CH3COO', 'C2H3O2', 'CH3CO2']))
  if (r() < 0.4) s = s.replace(/([A-Za-z)])(\d+)/g, (_m, a: string, d: string) => a + SUB(d))
  if (r() < 0.3) s = s.replace('·', pick(r, ['*', '.', ' · ', '•']))
  if (r() < 0.2) s = s.replace(/([a-z0-9)])([A-Z(])/g, '$1 $2')
  return s
}

describe('seeded: right answers written every accepted way grade correct', () => {
  it('2,000 names and 2,000 formulas', () => {
    const r = mulberry32(20261109)
    const pool: Compound[] = [...ALL_FIXED, ...molecularCompounds().filter((_c, i) => i % 7 === 0)]
    const salts = ionicCompounds()
    for (let i = 0; i < 2000; i++) {
      const c = r() < 0.15 ? hydrateCompound(pick(r, salts), 1 + Math.floor(r() * 10)) : pick(r, pool)
      const f = compoundFormula(c)
      const n = nameVariant(r, compoundName(c))
      expect(verdictOf(gradeNameFromFormula(f, n)), `#${i} ${f}: ${n}`).toBe('correct')
      const typed = formulaVariant(r, c.kind === 'acid' && c.binary && r() < 0.5 ? f.replace('(aq)', '') : f)
      expect(verdictOf(gradeFormulaFromName(compoundName(c), typed)), `#${i} ${compoundName(c)}: ${typed}`).toBe('correct')
    }
  }, SWEEP_TIMEOUT)
})

describe('seeded: odd input never throws', () => {
  it('3,000 random strings through every grader return a verdict', () => {
    const r = mulberry32(99)
    const alphabet = ['Fe', 'Cl', 'O', 'S', 'N', 'H', 'Na', 'Hg', 'Co', 'C', '(', ')', '2', '3', '4', '₂', '³', '⁺', '⁻', '+', '-', '^', '·', '*', '.', ' ', 'iron', '(III)', 'ide', 'ate', 'acid', 'hydro', 'di', 'mono', 'x', 'é', '']
    const problems = ['FeCl3', 'Ca(NO3)2', 'N2O5', 'HCl(aq)', 'CuSO4·5H2O', 'Hg2Cl2']
    const names = ['iron(III) chloride', 'calcium nitrate', 'dinitrogen pentoxide', 'hydrochloric acid', 'copper(II) sulfate pentahydrate']
    const verdicts = new Set(['correct', 'mistake', 'wrong', 'invalid', 'unsupported'])
    for (let i = 0; i < 3000; i++) {
      const n = Math.floor(r() * 7)
      let s = ''
      for (let k = 0; k < n; k++) s += pick(r, alphabet)
      const grades = [
        gradeNameFromFormula(pick(r, problems), s),
        gradeFormulaFromName(pick(r, names), s),
        gradeIonName('SO4 2-', s),
        gradeIonFormula('iron(III)', s),
        gradeNameFromFormula(s, 'iron(III) chloride'),
        gradeFormulaFromName(s, 'FeCl3'),
      ]
      for (const g of grades) expect(verdicts.has(g.verdict), `#${i} ${JSON.stringify(s)}`).toBe(true)
    }
  }, SWEEP_TIMEOUT)
})

describe('seeded: ionic formulas with random counts', () => {
  it('2,000 draws: correct exactly when the counts are right; a balanced multiple is not the lowest ratio', () => {
    const r = mulberry32(42)
    const salts = ionicCompounds()
    const seen = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      const c = pick(r, salts)
      const x = 1 + Math.floor(r() * 6)
      const y = 1 + Math.floor(r() * 6)
      const typed = unitText(c.cation.formula, c.cation.kind === 'polyatomic', x) + unitText(c.anion.formula, c.anion.kind === 'polyatomic', y)
      const n = compoundName(c)
      const g = gradeFormulaFromName(n, typed)
      const label = `#${i} ${n}: ${typed}`
      expect(g.verdict, label).not.toBe('invalid')
      expect(g.verdict, label).not.toBe('unsupported')
      const right = x === c.cationCount && y === c.anionCount
      expect(g.verdict === 'correct', label).toBe(right)
      if (right) continue
      seen.add(verdictOf(g))
      const balanced = c.cation.charge * x + c.anion.charge * y === 0
      if (balanced) expect(verdictOf(g), label).toBe('nm_not_lowest_ratio')
      else
        expect(['nm_charges_unbalanced', 'nm_crisscross_reversed', 'nm_numeral_as_subscript', 'nm_numeral_wrong', 'nm_unit_ion_reduced', 'nm_anion_first'], label).toContain(verdictOf(g))
    }
    for (const id of ['nm_charges_unbalanced', 'nm_not_lowest_ratio', 'nm_crisscross_reversed']) expect(seen.has(id), id).toBe(true)
  }, SWEEP_TIMEOUT)
})
