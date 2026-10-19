/**
 * Reading a formula or a name into a compound of the model, with a reason when it is not one (for the
 * validators and the `unsupported` messages), and the ionic segmentation the graders use on her formulas.
 */
import { elementBySymbol } from '../chem/elements'
import {
  acceptedNameKeys,
  acidCompounds,
  hydrateCompound,
  hydrogenCompoundOf,
  hydrogenCompounds,
  ionicCompound,
  ionicCompounds,
  ionPairProblem,
  molecularCompounds,
  molecularProblem,
} from './compounds'
import { formulaPartsText, readFormula } from './formula'
import { compoundCations, ionsWrittenAs, nmAnions, NUMERAL_METALS } from './ions'
import { nameKey } from './names'
import { chargeDisplay, formulaDisplay, gcd, prefixValue } from './text'
import type {
  Compound,
  FormulaPart,
  FormulaProblemOptions,
  FormulaReading,
  IonicCompound,
  NmIon,
  NmParseError,
} from './types'

/** One way to read a formula as two ions (her order kept). */
export interface IonicSplit {
  cation: NmIon
  cationCount: number
  cationParens: boolean
  anion: NmIon
  anionCount: number
  anionParens: boolean
  order: 'cation-first' | 'anion-first'
}

interface Unit {
  parts: FormulaPart[]
  count: number
  parens: boolean
}

/** One side of a split read as an ion written `count` times. A single element 'O2' is O×2 or the unit O2. */
function unitsOf(side: readonly FormulaPart[]): Unit[] {
  if (side.length === 1 && side[0]!.type === 'group') return [{ parts: side[0]!.parts, count: side[0]!.count, parens: true }]
  if (side.some((p) => p.type === 'group')) return []
  if (side.length === 1) {
    const e = side[0]!
    const out: Unit[] = [{ parts: [{ ...e, count: 1 }], count: e.count, parens: false }]
    if (e.count > 1) out.push({ parts: [e], count: 1, parens: false })
    return out
  }
  return [{ parts: [...side], count: 1, parens: false }]
}

/** Every reading of the parts as cation + anion (either order), balanced or not. */
export function ionicSplits(parts: readonly FormulaPart[]): IonicSplit[] {
  const out: IonicSplit[] = []
  const cations = new Set(compoundCations().map((c) => c.text))
  for (let k = 1; k < parts.length; k++) {
    const left = unitsOf(parts.slice(0, k))
    const right = unitsOf(parts.slice(k))
    for (const l of left)
      for (const r of right) {
        for (const a of ionsWrittenAs(l.parts))
          for (const b of ionsWrittenAs(r.parts)) {
            if (cations.has(a.text) && b.role === 'anion')
              out.push({ cation: a, cationCount: l.count, cationParens: l.parens, anion: b, anionCount: r.count, anionParens: r.parens, order: 'cation-first' })
            if (a.role === 'anion' && cations.has(b.text))
              out.push({ cation: b, cationCount: r.count, cationParens: r.parens, anion: a, anionCount: l.count, anionParens: l.parens, order: 'anion-first' })
          }
      }
  }
  return out
}

export const splitBalanced = (s: IonicSplit) => s.cation.charge * s.cationCount + s.anion.charge * s.anionCount === 0

/** Parentheses exactly where the textbook puts them: around a polyatomic ion written more than once, nowhere else. */
export function splitParensRight(s: IonicSplit): boolean {
  const ok = (ion: NmIon, n: number, parens: boolean) => parens === (ion.kind === 'polyatomic' && n > 1)
  return ok(s.cation, s.cationCount, s.cationParens) && ok(s.anion, s.anionCount, s.anionParens)
}

export type CompoundRead = { ok: true; compound: Compound } | { ok: false; message: string }

const shown = (r: FormulaReading) => formulaDisplay(r.text)

/** An ionic compound from formula parts: balanced, lowest ratio, parentheses right. */
function ionicOf(parts: readonly FormulaPart[], label: string): CompoundRead | null {
  const splits = ionicSplits(parts).filter((s) => s.order === 'cation-first' && !ionPairProblem(s.cation, s.anion))
  if (splits.length === 0) return null
  const balanced = splits.filter(splitBalanced)
  if (balanced.length === 0) return { ok: false, message: `The charges in ${label} do not balance.` }
  const s = balanced.find((x) => gcd(x.cationCount, x.anionCount) === 1)
  if (!s) return { ok: false, message: `${label} is not written in the lowest whole-number ratio.` }
  if (!splitParensRight(s)) return { ok: false, message: `${label} has parentheses where the textbook does not put them (or none where it does).` }
  return { ok: true, compound: ionicCompound(s.cation, s.anion) }
}

function acidOf(parts: readonly FormulaPart[], inWater: boolean): Compound | null {
  // CH3COOH and CH3CO2H: acetic acid written the organic way.
  const text = formulaPartsText(parts)
  if (text === 'CH3COOH' || text === 'CH3CO2H') {
    const acetate = nmAnions().find((a) => a.formula === 'CH3COO')!
    return hydrogenCompoundOf(acetate, true)
  }
  const h = parts[0]
  if (!h || h.type !== 'element' || h.symbol !== 'H' || parts.length < 2) return null
  for (const anion of ionsWrittenAs(parts.slice(1))) {
    if (anion.role !== 'anion' || -anion.charge !== h.count) continue
    const c = hydrogenCompoundOf(anion, inWater)
    if (c) return c
  }
  return null
}

function molecularOf(parts: readonly FormulaPart[]): Compound | null {
  if (parts.length !== 2 || parts.some((p) => p.type !== 'element')) return null
  const [a, b] = parts as [Extract<FormulaPart, { type: 'element' }>, Extract<FormulaPart, { type: 'element' }>]
  if (molecularProblem(a.symbol, a.count, b.symbol, b.count)) return null
  return { kind: 'molecular', first: a.symbol, firstCount: a.count, second: b.symbol, secondCount: b.count }
}

/** Why an ionic-looking formula is outside the model: the charge its metal would need, or a metal with no taught ion. */
function metalReason(parts: readonly FormulaPart[], label: string): string | null {
  const first = parts[0]
  if (!first || first.type !== 'element') return null
  const el = elementBySymbol(first.symbol)
  const metal = el && el.symbol !== 'H' && (el.group === null || el.group <= 12 || ['Al', 'Ga', 'In', 'Tl', 'Sn', 'Pb', 'Bi'].includes(el.symbol))
  if (!el || !metal) return null
  const taught = el.commonCharges.filter((c) => c > 0)
  if (taught.length === 0) return `${capital(el.name)} has no ion taught in this course, so ${label} is outside the model.`
  const needed: number[] = []
  for (const r of unitsOf(parts.slice(1))) {
    for (const an of ionsWrittenAs(r.parts)) {
      if (an.role !== 'anion') continue
      if ((an.formula === 'O2' || an.formula === 'H') && el.group !== 1 && el.group !== 2) continue // peroxide, hydride: groups 1 and 2 only
      const total = -an.charge * r.count
      if (total % first.count === 0) needed.push(total / first.count)
    }
  }
  // Only when no reading gives a taught charge is the charge the problem (Mg2O2 is a ratio problem instead).
  if (needed.length === 0 || needed.some((q) => taught.includes(q))) return null
  const q = needed[0]!
  return `${label} would need ${el.symbol}${chargeDisplay(q)}, and the taught charge${taught.length > 1 ? 's' : ''} of ${el.name} ${taught.length > 1 ? 'are' : 'is'} ${taught.map((c) => `${c}+`).join(' and ')}.`
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** A formula reading as a compound of the model, or why not. */
export function compoundOfReading(r: FormulaReading, options: FormulaProblemOptions = {}): CompoundRead {
  const label = shown(r)
  if (r.waters !== null) {
    const salt = ionicOf(r.parts, formulaDisplay(formulaPartsText(r.parts)))
    if (!salt) return { ok: false, message: `${label} is outside the model: a hydrate here is an ionic compound with water.` }
    if (!salt.ok) return salt
    if (r.waters > 10) return { ok: false, message: 'A hydrate in the model has 1 to 10 water molecules (mono- to deca-).' }
    return { ok: true, compound: hydrateCompound(salt.compound as IonicCompound, r.waters) }
  }
  const acid = acidOf(r.parts, r.state === 'aq' || options.inWater === true)
  if (acid) return { ok: true, compound: acid }
  const ionic = ionicOf(r.parts, label)
  const why = metalReason(r.parts, label)
  if (ionic && (ionic.ok || !why)) return ionic
  const mol = molecularOf(r.parts)
  if (mol) return { ok: true, compound: mol }
  if (why) return { ok: false, message: why }
  return {
    ok: false,
    message: `${label} is outside the model: it is not an ionic compound of the ions in the tables, a binary molecular compound, an acid or a hydrate.`,
  }
}

/** Reads a formula (problem side) into a compound, or why not (unreadable or outside the model). */
export function readCompoundFormula(text: string, options: FormulaProblemOptions = {}): CompoundRead & { error?: NmParseError } {
  const p = readFormula(text)
  if (!p.ok) return { ok: false, message: `The formula “${text}” could not be read: ${p.error.message}`, error: p.error }
  return compoundOfReading(p.value, options)
}

/** The compound of a formula, or null. */
export function compoundOfFormula(text: string, options: FormulaProblemOptions = {}): Compound | null {
  const r = readCompoundFormula(text, options)
  return r.ok ? r.compound : null
}

// --- names -------------------------------------------------------------------------------------------

let NAME_INDEX: Map<string, Compound> | null = null

/** Every name key of the model → its compound (built once, on first use). Hydrates are read separately. */
function nameIndex(): Map<string, Compound> {
  if (NAME_INDEX) return NAME_INDEX
  const m = new Map<string, Compound>()
  const add = (c: Compound) => {
    for (const k of acceptedNameKeys(c)) if (!m.has(k)) m.set(k, c)
  }
  for (const c of acidCompounds()) add(c)
  for (const c of hydrogenCompounds()) add(c)
  for (const c of molecularCompounds()) add(c)
  for (const c of ionicCompounds()) add(c)
  NAME_INDEX = m
  return m
}

/** Reads a name (problem side) into a compound, or why not. */
export function readCompoundName(text: string): CompoundRead {
  const key = nameKey(text)
  if (key === '') return { ok: false, message: 'The problem has no name.' }
  const found = nameIndex().get(key)
  if (found) return { ok: true, compound: found }
  const words = key.split(' ')
  const last = words[words.length - 1]!
  const m = /^(mono|di|tri|tetra|penta|hexa|hepta|octa|nona|deca)hydrate$/.exec(last)
  if (m && words.length > 1) {
    const salt = nameIndex().get(words.slice(0, -1).join(' '))
    if (salt && salt.kind === 'ionic') return { ok: true, compound: hydrateCompound(salt, prefixValue(m[1]!)!) }
    return { ok: false, message: `“${text}” is outside the model: the part before ${last} is not an ionic compound of the tables.` }
  }
  const metal = NUMERAL_METALS.find((s) => key.startsWith(`${elementBySymbol(s)!.name}(`))
  if (metal) return { ok: false, message: `“${text}” is outside the model: check the Roman numeral against the taught charges of ${elementBySymbol(metal)!.name}.` }
  return { ok: false, message: `“${text}” is not a name the model knows: the ions come from the textbook tables, and molecular compounds use the prefixes mono- to deca-.` }
}

/** The compound of a name, or null. */
export function compoundOfName(text: string): Compound | null {
  const r = readCompoundName(text)
  return r.ok ? r.compound : null
}
