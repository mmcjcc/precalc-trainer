/**
 * The model: ground-state electron configurations of the elements 1 (H) to 36 (Kr) and of their taught ions.
 *
 * Nothing here is a typed-in table of configurations. Every configuration is DERIVED:
 *   1. the filling order 1s 2s 2p 3s 3p 4s 3d 4p, each subshell filled to its capacity (s 2, p 6, d 10);
 *   2. the two exceptions in this range, chromium and copper, which move one electron from 4s to 3d
 *      (a half-filled or a filled d subshell is extra stable): [Ar] 4s1 3d5 and [Ar] 4s1 3d10;
 *   3. ions: a cation loses electrons from the subshell with the HIGHEST shell number first (so a transition
 *      metal loses 4s before 3d); an anion gains electrons in the next open subshell of the filling order.
 * Ion charges come only from `commonCharges` in engine/chem/elements.ts. model.test.ts pins all 36 atoms and
 * every ion against tables typed out by hand.
 */
import { ELEMENTS, elementBySymbol, elementByZ, type ElementInfo } from '../chem/elements'
import type {
  EconfigOrder,
  EconfigSpecies,
  EconfigSpeciesLike,
  ElectronConfiguration,
  NobleGasCore,
  NobleGasShorthand,
  Subshell,
  SubshellCount,
  SubshellLetter,
  SubshellLike,
} from './types'

/** The last element the model covers (krypton). */
export const ECONFIG_MAX_Z = 36

/** Most electrons a subshell holds: 2 per orbital. */
export const SUBSHELL_CAPACITY: Readonly<Record<SubshellLetter, number>> = { s: 2, p: 6, d: 10, f: 14 }

/** Orbitals (boxes) in a subshell. */
export const SUBSHELL_ORBITALS: Readonly<Record<SubshellLetter, number>> = { s: 1, p: 3, d: 5, f: 7 }

const L_INDEX: Readonly<Record<SubshellLetter, number>> = { s: 0, p: 1, d: 2, f: 3 }

/** The order the subshells fill, as far as krypton. */
export const FILLING_ORDER: readonly Subshell[] = [
  { n: 1, l: 's' },
  { n: 2, l: 's' },
  { n: 2, l: 'p' },
  { n: 3, l: 's' },
  { n: 3, l: 'p' },
  { n: 4, l: 's' },
  { n: 3, l: 'd' },
  { n: 4, l: 'p' },
]

/** "1s 2s 2p 3s 3p 4s 3d 4p" for sentences. */
export const FILLING_ORDER_TEXT = FILLING_ORDER.map((s) => `${s.n}${s.l}`).join(' ')

/** Chromium and copper: one electron moves from 4s to 3d. */
export const EXCEPTION_ELEMENTS: readonly number[] = [24, 29]

/** He, Ne, Ar, Kr (from the element table: group 18 up to krypton). */
export const NOBLE_GAS_CORES: readonly NobleGasCore[] = ELEMENTS.filter((e) => e.group === 18 && e.z <= ECONFIG_MAX_Z).map((e) => ({
  symbol: e.symbol,
  z: e.z,
}))

// ---------------------------------------------------------------------------
// Subshells
// ---------------------------------------------------------------------------

/** "3d" */
export function subshellName(s: Subshell): string {
  return `${s.n}${s.l}`
}

/** Shell n has n kinds of subshell: 1p, 2d and 3f do not exist. */
export function subshellExists(s: Subshell): boolean {
  return Number.isInteger(s.n) && s.n >= 1 && L_INDEX[s.l] < s.n
}

/** The filling (Madelung) order: by n + l, then by n. On 1s to 4p it is exactly FILLING_ORDER. */
export function fillingCompare(a: Subshell, b: Subshell): number {
  return a.n + L_INDEX[a.l] - (b.n + L_INDEX[b.l]) || a.n - b.n
}

/** Shell order: by n, then s p d f. */
export function shellCompare(a: Subshell, b: Subshell): number {
  return a.n - b.n || L_INDEX[a.l] - L_INDEX[b.l]
}

/** "3d" or { n: 3, l: 'd' } → a subshell; null when unreadable. */
export function readSubshell(s: SubshellLike): Subshell | null {
  if (typeof s === 'string') {
    const m = /^\s*([1-9])\s*([spdf])\s*$/i.exec(s)
    return m ? { n: Number(m[1]), l: m[2]!.toLowerCase() as SubshellLetter } : null
  }
  if (!s || !Number.isInteger(s.n) || s.n < 1 || !(s.l in L_INDEX)) return null
  return { n: s.n, l: s.l }
}

// ---------------------------------------------------------------------------
// Occupancies: a configuration as a map "3d" → 6, for comparing whatever the order
// ---------------------------------------------------------------------------

export type Occupancy = Map<string, number>

export function occupancyOf(config: readonly SubshellCount[]): Occupancy {
  const occ: Occupancy = new Map()
  for (const t of config) if (t.count > 0) occ.set(subshellName(t), (occ.get(subshellName(t)) ?? 0) + t.count)
  return occ
}

function subshellOfKey(key: string): Subshell {
  return { n: Number(key[0]), l: key[1] as SubshellLetter }
}

/** The occupied subshells in filling order (default) or shell order. */
export function configOfOccupancy(occ: Occupancy, order: EconfigOrder = 'filling'): SubshellCount[] {
  const out: SubshellCount[] = []
  for (const [key, count] of occ) if (count > 0) out.push({ ...subshellOfKey(key), count })
  return out.sort(order === 'shell' ? shellCompare : fillingCompare)
}

export function sameOccupancy(a: Occupancy, b: Occupancy): boolean {
  const keys = new Set([...a.keys(), ...b.keys()])
  for (const k of keys) if ((a.get(k) ?? 0) !== (b.get(k) ?? 0)) return false
  return true
}

export function sameConfiguration(a: readonly SubshellCount[], b: readonly SubshellCount[]): boolean {
  return sameOccupancy(occupancyOf(a), occupancyOf(b))
}

export function totalElectrons(config: readonly SubshellCount[]): number {
  return config.reduce((sum, t) => sum + t.count, 0)
}

/** The same subshells sorted by shell number: 3d6 before 4s2. */
export function shellOrder(config: readonly SubshellCount[]): SubshellCount[] {
  return [...config].sort(shellCompare)
}

/** The same subshells sorted in filling order: 4s2 before 3d6. */
export function fillingOrder(config: readonly SubshellCount[]): SubshellCount[] {
  return [...config].sort(fillingCompare)
}

// ---------------------------------------------------------------------------
// Deriving configurations
// ---------------------------------------------------------------------------

/** Fill the subshells in order with this many electrons (no exceptions applied). Throws past krypton. */
export function aufbau(electrons: number): SubshellCount[] {
  if (!Number.isInteger(electrons) || electrons < 0) throw new RangeError(`econfig: ${electrons} is not a number of electrons`)
  const out: SubshellCount[] = []
  let left = electrons
  for (const s of FILLING_ORDER) {
    if (left === 0) break
    const count = Math.min(left, SUBSHELL_CAPACITY[s.l])
    out.push({ n: s.n, l: s.l, count })
    left -= count
  }
  if (left > 0) throw new RangeError(`econfig: ${electrons} electrons do not fit in 1s to 4p`)
  return out
}

/** Ground state of the neutral atom: the filling order, plus the 4s → 3d move for chromium and copper. */
export function neutralConfiguration(z: number): SubshellCount[] {
  const config = aufbau(z)
  if (!EXCEPTION_ELEMENTS.includes(z)) return config
  const occ = occupancyOf(config)
  occ.set('4s', (occ.get('4s') ?? 0) - 1)
  occ.set('3d', (occ.get('3d') ?? 0) + 1)
  return configOfOccupancy(occ)
}

export interface ElectronMoves {
  config: SubshellCount[]
  /** Which subshells the electrons left or entered, in order, with how many each. */
  trace: SubshellCount[]
}

function pushTrace(trace: SubshellCount[], s: Subshell): void {
  const last = trace[trace.length - 1]
  if (last && last.n === s.n && last.l === s.l) last.count += 1
  else trace.push({ n: s.n, l: s.l, count: 1 })
}

/**
 * Remove k electrons, each from the occupied subshell with the highest shell number (the highest letter when
 * two share a shell): 4p, then 4s, then 3d. Throws when there are not k electrons.
 */
export function removeOutermost(config: readonly SubshellCount[], k: number): ElectronMoves {
  const occ = occupancyOf(config)
  const trace: SubshellCount[] = []
  for (let i = 0; i < k; i++) {
    const occupied = configOfOccupancy(occ, 'shell')
    const outer = occupied[occupied.length - 1]
    if (!outer) throw new RangeError('econfig: no electron left to remove')
    occ.set(subshellName(outer), outer.count - 1)
    pushTrace(trace, outer)
  }
  return { config: configOfOccupancy(occ), trace }
}

/** Add k electrons, each to the first subshell of the filling order with room. Throws past 4p6. */
export function addInOrder(config: readonly SubshellCount[], k: number): ElectronMoves {
  const occ = occupancyOf(config)
  const trace: SubshellCount[] = []
  for (let i = 0; i < k; i++) {
    const open = FILLING_ORDER.find((s) => (occ.get(subshellName(s)) ?? 0) < SUBSHELL_CAPACITY[s.l])
    if (!open) throw new RangeError('econfig: no room left in 1s to 4p')
    occ.set(subshellName(open), (occ.get(subshellName(open)) ?? 0) + 1)
    pushTrace(trace, open)
  }
  return { config: configOfOccupancy(occ), trace }
}

/**
 * The configuration of element z with this charge, by the three rules in the file comment. NOT validated
 * against commonCharges (the mistake candidates need other charges); throws RangeError when it cannot exist.
 */
export function deriveConfiguration(z: number, charge: number): SubshellCount[] {
  const neutral = neutralConfiguration(z)
  if (charge === 0) return neutral
  return charge > 0 ? removeOutermost(neutral, charge).config : addInOrder(neutral, -charge).config
}

/**
 * The MISTAKEN ion: k electrons taken from 3d first and from 4s only when 3d runs out (Fe2+ as [Ar] 4s2 3d4).
 * Used to recognise that slip; never a right answer.
 */
export function removeFrom3dFirst(z: number, k: number): SubshellCount[] {
  const occ = occupancyOf(neutralConfiguration(z))
  const from3d = Math.min(k, occ.get('3d') ?? 0)
  occ.set('3d', (occ.get('3d') ?? 0) - from3d)
  occ.set('4s', (occ.get('4s') ?? 0) - (k - from3d))
  return configOfOccupancy(occ)
}

// ---------------------------------------------------------------------------
// Species
// ---------------------------------------------------------------------------

const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹'

/** Superscript characters to their plain twins, one character for one (positions are kept). */
export function plainSuperscripts(text: string): string {
  let out = ''
  for (const ch of text) {
    const i = SUPERSCRIPT_DIGITS.indexOf(ch)
    if (i >= 0) out += String(i)
    else if (ch === '⁺') out += '+'
    else if (ch === '⁻' || ch === '−' || ch === '–' || ch === '—') out += '-'
    else out += ch
  }
  return out
}

/** 10 → "¹⁰" */
export function superscriptNumber(n: number): string {
  return [...String(n)].map((d) => SUPERSCRIPT_DIGITS[Number(d)]).join('')
}

function findElement(symbol: string): ElementInfo | undefined {
  const lower = symbol.toLowerCase()
  return elementBySymbol(symbol) ?? ELEMENTS.find((e) => e.symbol.toLowerCase() === lower)
}

/** "Fe", "Fe3+", "Fe 3+", "Fe^3+", "Fe+3", "Cl-", "O²⁻", { z: 26, charge: 3 }, { symbol: 'Fe' } → a species. */
export function resolveSpecies(input: EconfigSpeciesLike): EconfigSpecies | null {
  if (typeof input === 'string') {
    const m = /^\s*([A-Za-z]{1,2})\s*\^?\s*(?:(\d)?([+-])|([+-])(\d))?\s*$/.exec(plainSuperscripts(input))
    if (!m) return null
    const el = findElement(m[1]!)
    if (!el) return null
    const sign = m[3] ?? m[4]
    const size = Number(m[2] ?? m[5] ?? 1)
    return { z: el.z, charge: sign ? (sign === '-' ? -size : size) || 0 : 0 }
  }
  if (!input || typeof input !== 'object') return null
  const charge = input.charge ?? 0
  if (!Number.isInteger(charge)) return null
  if ('z' in input) return Number.isInteger(input.z) ? { z: input.z, charge } : null
  const el = typeof input.symbol === 'string' ? findElement(input.symbol.trim()) : undefined
  return el ? { z: el.z, charge } : null
}

/** Charge as written on a symbol: 0 → "", 1 → "+", −1 → "-", 3 → "3+", −2 → "2-". */
function chargeSuffix(charge: number): string {
  if (charge === 0) return ''
  return `${Math.abs(charge) === 1 ? '' : Math.abs(charge)}${charge > 0 ? '+' : '-'}`
}

/** "3+", "1−": the size is always shown (for sentences). */
export function chargeSize(charge: number): string {
  return `${Math.abs(charge)}${charge > 0 ? '+' : '−'}`
}

function symbolOf(z: number): string {
  return elementByZ(z)?.symbol ?? `element ${z}`
}

/** "Fe3+", "Cl-", "Na": plain text, read back by `resolveSpecies`. */
export function speciesText(sp: EconfigSpecies): string {
  return `${symbolOf(sp.z)}${chargeSuffix(sp.charge)}`
}

/** "Fe³⁺", "Cl⁻", "Na": for sentences. */
export function speciesDisplay(sp: EconfigSpecies): string {
  const suffix = chargeSuffix(sp.charge)
  return `${symbolOf(sp.z)}${[...suffix].map((ch) => (ch === '+' ? '⁺' : ch === '-' ? '⁻' : SUPERSCRIPT_DIGITS[Number(ch)])).join('')}`
}

/** "\mathrm{Fe}^{3+}" */
export function speciesLatex(sp: EconfigSpecies): string {
  const suffix = chargeSuffix(sp.charge)
  return `\\mathrm{${symbolOf(sp.z)}}${suffix ? `^{${suffix}}` : ''}`
}

/** Groups 1, 2 and 13 to 18. */
export function isMainGroup(z: number): boolean {
  const g = elementByZ(z)?.group
  return g === 1 || g === 2 || (g !== null && g !== undefined && g >= 13)
}

/**
 * Why a species is outside the model, or null when it is inside: element 1 to 36, charge 0 or one of the
 * element's `commonCharges`, at least one electron.
 */
export function speciesProblem(input: EconfigSpeciesLike): string | null {
  const sp = resolveSpecies(input)
  if (!sp) return `Could not read the species ${typeof input === 'string' ? `"${input}"` : JSON.stringify(input)}.`
  const el = elementByZ(sp.z)
  if (!el || sp.z < 1 || sp.z > ECONFIG_MAX_Z)
    return `Element ${sp.z}${el ? ` (${el.name})` : ''} is outside the model: hydrogen (1) to krypton (36) only.`
  if (sp.charge === 0) return null
  if (!el.commonCharges.includes(sp.charge)) {
    const taught = el.commonCharges.map(chargeSize)
    return taught.length === 0
      ? `${speciesDisplay(sp)} is outside the model: ${el.name} has no simple ion taught at this level.`
      : `${speciesDisplay(sp)} is outside the model: the taught ${taught.length === 1 ? 'charge' : 'charges'} of ${el.name} ${taught.length === 1 ? 'is' : 'are'} ${taught.join(' and ')}.`
  }
  if (sp.z - sp.charge < 1) return `${speciesDisplay(sp)} has no electrons, so there is no configuration to write.`
  return null
}

/** The species, or a RangeError with `speciesProblem`'s reason (a template bug). */
export function requireSpecies(input: EconfigSpeciesLike): EconfigSpecies {
  const problem = speciesProblem(input)
  if (problem) throw new RangeError(`econfig: ${problem}`)
  return resolveSpecies(input)!
}

/** A species the model covers, from text or parts: econfigSpecies('Fe', 3), econfigSpecies('Cl-'). Throws otherwise. */
export function econfigSpecies(symbolOrText: string, charge?: number): EconfigSpecies {
  if (charge === undefined) return requireSpecies(symbolOrText)
  const base = resolveSpecies(symbolOrText)
  if (!base || base.charge !== 0) throw new RangeError(`econfig: could not read the element "${symbolOrText}"`)
  return requireSpecies({ z: base.z, charge })
}

/** The 36 neutral atoms, hydrogen to krypton. */
export function econfigAtoms(): EconfigSpecies[] {
  return ELEMENTS.filter((e) => e.z <= ECONFIG_MAX_Z).map((e) => ({ z: e.z, charge: 0 }))
}

/** Every ion the model covers: each element's `commonCharges`, most common first (H+ has no electrons and is left out). */
export function econfigIons(): EconfigSpecies[] {
  const out: EconfigSpecies[] = []
  for (const e of ELEMENTS) {
    if (e.z > ECONFIG_MAX_Z) continue
    for (const charge of e.commonCharges) if (speciesProblem({ z: e.z, charge }) === null) out.push({ z: e.z, charge })
  }
  return out
}

// ---------------------------------------------------------------------------
// The public getters
// ---------------------------------------------------------------------------

/** Z minus the charge. */
export function electronCount(species: EconfigSpeciesLike): number {
  const sp = requireSpecies(species)
  return sp.z - sp.charge
}

/**
 * The ground-state configuration, occupied subshells in filling order (4s before 3d). Pass order 'shell' for
 * 3d before 4s. Throws RangeError for a species outside the model.
 */
export function electronConfiguration(species: EconfigSpeciesLike, order: EconfigOrder = 'filling'): ElectronConfiguration {
  const sp = requireSpecies(species)
  const config = deriveConfiguration(sp.z, sp.charge)
  return order === 'shell' ? shellOrder(config) : config
}

/**
 * What is left of `config` after the core's subshells, or null when the config does not contain the whole
 * core (every core subshell full).
 */
export function restAfterCore(config: readonly SubshellCount[], core: NobleGasCore): SubshellCount[] | null {
  const occ = occupancyOf(config)
  const coreConfig = aufbau(core.z)
  for (const t of coreConfig) if ((occ.get(subshellName(t)) ?? 0) !== t.count) return null
  const inCore = new Set(coreConfig.map(subshellName))
  return config.filter((t) => !inCore.has(subshellName(t))).map((t) => ({ ...t }))
}

/**
 * The core the shorthand uses: for a neutral atom the last noble gas BEFORE the element ([Ne] for argon, none
 * for hydrogen and helium); for an ion the largest noble gas with no more electrons than the ion ([Ne] for
 * Na+, [Ar] for Fe3+).
 */
export function canonicalCore(sp: EconfigSpecies): NobleGasCore | null {
  const electrons = sp.z - sp.charge
  const allowed = NOBLE_GAS_CORES.filter((g) => (sp.charge === 0 ? g.z < sp.z : g.z <= electrons))
  return allowed[allowed.length - 1] ?? null
}

/** The noble-gas shorthand: [Ar] and 4s2 3d6 for iron. Throws RangeError for a species outside the model. */
export function nobleGasShorthand(species: EconfigSpeciesLike, order: EconfigOrder = 'filling'): NobleGasShorthand {
  const sp = requireSpecies(species)
  const config = deriveConfiguration(sp.z, sp.charge)
  const core = canonicalCore(sp)
  if (!core) return { core: null, rest: order === 'shell' ? shellOrder(config) : config }
  const rest = restAfterCore(config, core)
  if (!rest) throw new RangeError(`econfig: ${speciesText(sp)} does not contain the [${core.symbol}] core`)
  return { core, rest: order === 'shell' ? shellOrder(rest) : rest }
}

/** The element record of a species in the model. */
export function elementOf(sp: EconfigSpecies): ElementInfo {
  const el = elementByZ(sp.z)
  if (!el) throw new RangeError(`econfig: no element ${sp.z}`)
  return el
}
