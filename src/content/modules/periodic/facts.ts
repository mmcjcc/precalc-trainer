/**
 * Periodic-table facts for chapter 6. Positions, families and charges come from the element
 * table. Radius, ionization energy and electronegativity come from the trend table. A ranking
 * set is kept only when the measurements and the trend she is taught put the elements in the
 * same order.
 */
import type { PtDirection, PtProperty } from '@/content/types'
import { elementBySymbol, elementByZ, ELEMENTS, type ElementInfo } from '@/engine/chem/elements'
import { trendByZ, type ElementTrend } from '@/engine/chem/trends'

export type BlockName = 's' | 'p' | 'd' | 'f'
export type ClassName = 'metal' | 'nonmetal' | 'metalloid'
export type FamilyName = 'alkali metals' | 'alkaline earth metals' | 'halogens' | 'noble gases' | 'transition metals'

/** Kept out of generated problems so catalog examples can use them. */
export const RESERVED_SYMBOLS: readonly string[] = ['Fr', 'Ra', 'Po', 'At', 'Rn']

const METALLOIDS = new Set(['B', 'Si', 'Ge', 'As', 'Sb', 'Te'])
const NONMETALS = new Set(['H', 'He', 'C', 'N', 'O', 'F', 'Ne', 'P', 'S', 'Cl', 'Ar', 'Se', 'Br', 'Kr', 'I', 'Xe', 'Rn', 'At'])

/** Ionization pairs that do not rise left to right. Never ranked by ionization energy. */
export const IONIZATION_EXCEPTION_PAIRS: readonly (readonly [string, string])[] = [
  ['Be', 'B'],
  ['N', 'O'],
  ['Mg', 'Al'],
  ['P', 'S'],
]

const SUBSHELLS: readonly { n: number; l: BlockName; cap: number }[] = [
  { n: 1, l: 's', cap: 2 },
  { n: 2, l: 's', cap: 2 },
  { n: 2, l: 'p', cap: 6 },
  { n: 3, l: 's', cap: 2 },
  { n: 3, l: 'p', cap: 6 },
  { n: 4, l: 's', cap: 2 },
  { n: 3, l: 'd', cap: 10 },
  { n: 4, l: 'p', cap: 6 },
  { n: 5, l: 's', cap: 2 },
  { n: 4, l: 'd', cap: 10 },
  { n: 5, l: 'p', cap: 6 },
  { n: 6, l: 's', cap: 2 },
  { n: 4, l: 'f', cap: 14 },
  { n: 5, l: 'd', cap: 10 },
  { n: 6, l: 'p', cap: 6 },
  { n: 7, l: 's', cap: 2 },
  { n: 5, l: 'f', cap: 14 },
  { n: 6, l: 'd', cap: 10 },
  { n: 7, l: 'p', cap: 6 },
]

export interface ShellConfig {
  /** Aufbau text, e.g. "1s2 2s2 2p6 3s2 3p4". Main-group atoms only; Cr and Cu are not exceptions here. */
  text: string
  /** Electrons in the highest shell. */
  valence: number
  /** Highest shell number. */
  period: number
  /** Subshell that received the last electron. */
  block: BlockName
}

export function isReserved(symbol: string): boolean {
  return RESERVED_SYMBOLS.includes(symbol)
}

export function blockOf(el: ElementInfo): BlockName {
  const z = el.z
  if ((z >= 57 && z <= 71) || (z >= 89 && z <= 103)) return 'f'
  if (el.symbol === 'He') return 's'
  if (el.group == null) return 'f'
  if (el.group <= 2) return 's'
  if (el.group >= 13) return 'p'
  return 'd'
}

export function classOf(el: ElementInfo): ClassName {
  if (METALLOIDS.has(el.symbol)) return 'metalloid'
  if (NONMETALS.has(el.symbol)) return 'nonmetal'
  return 'metal'
}

export function familyOf(el: ElementInfo): FamilyName | null {
  if (el.group === 1 && el.symbol !== 'H') return 'alkali metals'
  if (el.group === 2) return 'alkaline earth metals'
  if (el.group === 17) return 'halogens'
  if (el.group === 18) return 'noble gases'
  if (el.group != null && el.group >= 3 && el.group <= 12) return 'transition metals'
  return null
}

/**
 * Valence electrons of a main-group element. Helium is 2, not 8. Transition metals and the
 * f block return null: this course does not ask for their valence count.
 */
export function valenceOf(el: ElementInfo): number | null {
  if (el.symbol === 'He') return 2
  if (el.group == null) return null
  if (el.group === 1 || el.group === 2) return el.group
  if (el.group >= 13 && el.group <= 18) return el.group - 10
  return null
}

/** Neutral-atom configuration in aufbau order. Correct for main-group atoms, which have no exceptions. */
export function configurationOf(z: number): ShellConfig {
  let left = z
  const parts: { n: number; l: BlockName; e: number }[] = []
  for (const sub of SUBSHELLS) {
    if (left <= 0) break
    const e = Math.min(sub.cap, left)
    parts.push({ n: sub.n, l: sub.l, e })
    left -= e
  }
  if (left > 0) throw new Error(`configuration: Z ${z} does not fit the subshell list`)
  const maxN = parts.reduce((m, p) => Math.max(m, p.n), 0)
  const valence = parts.filter((p) => p.n === maxN).reduce((s, p) => s + p.e, 0)
  const last = parts[parts.length - 1]!
  return {
    text: parts.map((p) => `${p.n}${p.l}${p.e}`).join(' '),
    valence,
    period: maxN,
    block: last.l,
  }
}

/** Read a configuration string back. Returns null when the text is not a subshell list. */
export function parseConfiguration(text: string): ShellConfig | null {
  const bits = text.trim().split(/\s+/).filter(Boolean)
  if (bits.length === 0) return null
  const parts: { n: number; l: BlockName; e: number }[] = []
  for (const bit of bits) {
    const m = /^([1-7])([spdf])([1-9]\d*)$/.exec(bit)
    if (!m) return null
    parts.push({ n: Number(m[1]), l: m[2] as BlockName, e: Number(m[3]) })
  }
  const maxN = parts.reduce((m, p) => Math.max(m, p.n), 0)
  const valence = parts.filter((p) => p.n === maxN).reduce((s, p) => s + p.e, 0)
  const last = parts[parts.length - 1]!
  return { text: parts.map((p) => `${p.n}${p.l}${p.e}`).join(' '), valence, period: maxN, block: last.l }
}

export function columnValue(z: number, property: Exclude<PtProperty, 'metallic'>): number {
  const row = trendByZ(z)
  if (!row) throw new Error(`no trend data for Z ${z}`)
  if (property === 'radius') return row.radiusPm
  if (property === 'ionization') return row.ionizationKjMol
  return row.electronegativity
}

/** Higher means farther left. Group 1 is the leftmost numbered column. */
function leftness(group: number): number {
  return 20 - group
}

/**
 * 1 when `a` is greater in this property by the trend, -1 when smaller, 0 when the two rules
 * disagree (a diagonal that is down-and-right) or the elements cannot be compared.
 */
export function trendCompare(a: ElementInfo, b: ElementInfo, property: PtProperty): -1 | 0 | 1 {
  if (a.group == null || b.group == null) return 0
  if (a.z === b.z) return 0
  const down = a.period - b.period
  const left = leftness(a.group) - leftness(b.group)
  const downGrows = property === 'radius' || property === 'metallic'
  const periodVote = down === 0 ? 0 : down > 0 === downGrows ? 1 : -1
  const leftVote = left === 0 ? 0 : left > 0 === downGrows ? 1 : -1
  if (periodVote !== 0 && leftVote !== 0 && periodVote !== leftVote) return 0
  const vote = periodVote !== 0 ? periodVote : leftVote
  return vote === 0 ? 0 : vote > 0 ? 1 : -1
}

function dataCompare(a: number, b: number, property: Exclude<PtProperty, 'metallic'>): -1 | 0 | 1 {
  const av = columnValue(a, property)
  const bv = columnValue(b, property)
  if (av === bv) return 0
  return av > bv ? 1 : -1
}

/** Noble gases stay out of radius, electronegativity and metallic-character rankings. */
export function trendAllowed(el: ElementInfo, property: PtProperty): boolean {
  if (el.z > 56 || el.group == null) return false
  // Main-group elements only: transition-metal trends are irregular, and the course teaches the trends on
  // groups 1, 2 and 13-18.
  if (el.group >= 3 && el.group <= 12) return false
  if (el.group === 18 && property !== 'ionization') return false
  return trendByZ(el.z) != null
}

function pairsAgree(zs: readonly number[], property: PtProperty): boolean {
  for (let i = 0; i < zs.length; i++) {
    for (let j = i + 1; j < zs.length; j++) {
      const a = elementByZ(zs[i]!)!
      const b = elementByZ(zs[j]!)!
      const trend = trendCompare(a, b, property)
      if (trend === 0) return false
      if (property === 'metallic') continue
      if (dataCompare(zs[i]!, zs[j]!, property) !== trend) return false
    }
  }
  return true
}

/** Increasing order by the trend. Every pair must already agree. */
export function orderByTrend(zs: readonly number[], property: PtProperty): number[] {
  return zs.slice().sort((a, b) => trendCompare(elementByZ(a)!, elementByZ(b)!, property))
}

/** Increasing order by the measured column. Metallic character has no column. */
export function orderByData(zs: readonly number[], property: Exclude<PtProperty, 'metallic'>): number[] {
  return zs.slice().sort((a, b) => columnValue(a, property) - columnValue(b, property))
}

export interface TrendSet {
  property: PtProperty
  scope: 'period' | 'group' | 'diagonal'
  /** Atomic numbers in increasing order for this property. */
  zs: number[]
}

function combinations(zs: readonly number[], k: number): number[][] {
  const out: number[][] = []
  const acc: number[] = []
  const walk = (start: number) => {
    if (acc.length === k) {
      out.push(acc.slice())
      return
    }
    for (let i = start; i < zs.length; i++) {
      acc.push(zs[i]!)
      walk(i + 1)
      acc.pop()
    }
  }
  walk(0)
  return out
}

function scopeOf(zs: readonly number[]): 'period' | 'group' | 'diagonal' | null {
  const els = zs.map((z) => elementByZ(z)!)
  const periods = new Set(els.map((el) => el.period))
  const groups = new Set(els.map((el) => el.group))
  if (periods.size === 1 && groups.size === zs.length) return 'period'
  if (groups.size === 1 && periods.size === zs.length) return 'group'
  if (periods.size > 1 && groups.size > 1) return 'diagonal'
  return null
}

function keep(zs: number[], property: PtProperty, scope: 'period' | 'group' | 'diagonal'): TrendSet | null {
  if (!pairsAgree(zs, property)) return null
  const found = scopeOf(zs)
  if (found !== scope) return null
  return { property, scope, zs: orderByTrend(zs, property) }
}

const TREND_BUCKETS = new Map<string, TrendSet[]>()

function buildTrendSets(): TrendSet[] {
  const sets: TrendSet[] = []
  const seen = new Set<string>()
  const add = (set: TrendSet | null) => {
    if (!set) return
    const key = `${set.property}|${set.scope}|${set.zs.slice().sort((a, b) => a - b).join(',')}`
    if (seen.has(key)) return
    seen.add(key)
    sets.push(set)
    const bucketKey = `${set.property}|${set.scope}`
    const bucket = TREND_BUCKETS.get(bucketKey)
    if (bucket) bucket.push(set)
    else TREND_BUCKETS.set(bucketKey, [set])
  }
  const properties: PtProperty[] = ['radius', 'ionization', 'electronegativity', 'metallic']
  const byPeriod = new Map<number, number[]>()
  const byGroup = new Map<number, number[]>()
  for (const el of ELEMENTS) {
    if (el.z > 56 || el.group == null) continue
    const period = byPeriod.get(el.period) ?? []
    period.push(el.z)
    byPeriod.set(el.period, period)
    const group = byGroup.get(el.group) ?? []
    group.push(el.z)
    byGroup.set(el.group, group)
  }
  for (const property of properties) {
    const rows = [...byPeriod.values()].map((zs) => zs.filter((z) => trendAllowed(elementByZ(z)!, property)))
    const cols = [...byGroup.values()].map((zs) => zs.filter((z) => trendAllowed(elementByZ(z)!, property)))
    for (const row of rows) {
      for (const k of [3, 4]) {
        if (row.length < k) continue
        for (const combo of combinations(row, k)) {
          add(keep(combo, property, 'period'))
        }
      }
    }
    for (const col of cols) {
      for (const k of [3, 4]) {
        if (col.length < k) continue
        for (const combo of combinations(col, k)) {
          add(keep(combo, property, 'group'))
        }
      }
    }
    const pool = ELEMENTS.filter((el) => trendAllowed(el, property)).map((el) => el.z)
    const triples: number[][] = []
    for (const combo of combinations(pool, 3)) {
      const set = keep(combo, property, 'diagonal')
      if (set) {
        add(set)
        triples.push(combo)
      }
    }
    const inPool = new Set(pool)
    for (const triple of triples) {
      const have = new Set(triple)
      for (const extra of pool) {
        if (!inPool.has(extra) || have.has(extra)) continue
        add(keep([...triple, extra], property, 'diagonal'))
      }
    }
  }
  return sets
}

export const TREND_SETS: readonly TrendSet[] = buildTrendSets()

export function trendSets(property: PtProperty, scope: TrendSet['scope']): readonly TrendSet[] {
  return TREND_BUCKETS.get(`${property}|${scope}`) ?? []
}

export function symbolOf(z: number): string {
  const el = elementByZ(z)
  if (!el) throw new Error(`no element Z ${z}`)
  return el.symbol
}

export function formatSymbols(zs: readonly number[]): string {
  return zs.map((z) => symbolOf(z)).join(', ')
}

const SUPER: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁺': '+',
  '⁻': '-',
}

export function ionLabel(symbol: string, charge: number): string {
  if (charge === 0) return symbol
  const mag = Math.abs(charge)
  const sign = charge > 0 ? '+' : '-'
  return mag === 1 ? `${symbol}${sign}` : `${symbol}${mag}${sign}`
}

export interface Species {
  z: number
  charge: number
}

export function speciesKey(sp: Species): string {
  return `${sp.z}:${sp.charge}`
}

export function speciesLabel(sp: Species): string {
  return ionLabel(symbolOf(sp.z), sp.charge)
}

/** Valence count read from a main-group column. Group 18 is 8; helium is the exception and is not this question. */
export function valenceFromGroup(group: number): number | null {
  if (group === 1 || group === 2) return group
  if (group >= 13 && group <= 18) return group - 10
  return null
}

/** Parse one symbol or ion. Accepts Na+, Mg2+, O2-, O^2-, O-2, and unicode superscripts. */
export function parseSpecies(token: string): Species | null {
  const flat = [...token.trim()].map((ch) => SUPER[ch] ?? ch).join('').replace(/\s+/g, '').replace(/−/g, '-').replace(/\^/g, '')
  const m = /^([A-Za-z]{1,2})(?:([0-9]*)([+-])|([+-])([0-9]*))?$/.exec(flat)
  if (!m) return null
  const raw = m[1]!
  const canon = raw.length === 1 ? raw.toUpperCase() : raw[0]!.toUpperCase() + raw[1]!.toLowerCase()
  const el = elementBySymbol(canon)
  if (!el) return null
  let charge = 0
  if (m[3]) {
    const n = m[2] === '' || m[2] == null ? 1 : Number(m[2])
    if (!Number.isInteger(n) || n < 1) return null
    charge = m[3] === '+' ? n : -n
  } else if (m[4]) {
    const n = m[5] == null || m[5] === '' ? 1 : Number(m[5])
    if (!Number.isInteger(n) || n < 1) return null
    charge = m[4] === '+' ? n : -n
  }
  return { z: el.z, charge }
}

/** Split "Na, Mg, Cl" or "Na < Mg < Cl" (any case and spacing) into tokens. Does not check that they are elements. */
export function listTokens(text: string): string[] {
  const cleaned = text.trim().replace(/−/g, '-').replace(/–/g, '-')
  if (!cleaned) return []
  const commaed = cleaned.replace(/\s*(?:<|>|≤|≥|then)\s*/gi, ',')
  const bits = commaed.includes(',') ? commaed.split(',') : commaed.split(/\s+/)
  return bits.map((bit) => bit.trim()).filter(Boolean)
}

/** Split "Na, Mg, Cl" or "Na < Mg < Cl" (any case and spacing) into species. Null if any token is unreadable. */
export function parseList(text: string): Species[] | null {
  const tokens = listTokens(text)
  if (tokens.length < 2) return null
  const out: Species[] = []
  for (const token of tokens) {
    const sp = parseSpecies(token)
    if (!sp) return null
    out.push(sp)
  }
  return out
}

export function sameSpecies(a: readonly Species[], b: readonly Species[]): boolean {
  return a.length === b.length && a.every((sp, i) => speciesKey(sp) === speciesKey(b[i]!))
}

export function sameSet(a: readonly Species[], b: readonly Species[]): boolean {
  if (a.length !== b.length) return false
  const left = a.map(speciesKey).sort()
  const right = b.map(speciesKey).sort()
  return left.every((key, i) => key === right[i])
}

/**
 * True when `text` contains `answer` as its own token or phrase. A digit inside a longer number
 * does not count, and a letter inside a word does not count.
 */
export function answerLeaks(text: string, answer: string): boolean {
  const norm = (s: string) => s.replace(/−/g, '-').replace(/\s+/g, ' ').trim().toLowerCase()
  const ans = norm(answer)
  if (!ans) return false
  const escaped = ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(norm(text))
}

export function directed(zs: readonly number[], direction: PtDirection): number[] {
  return direction === 'increasing' ? zs.slice() : zs.slice().reverse()
}

/** Isoelectronic radius increases as atomic number falls (same electron count, fewer protons). */
export function isoOrder(ions: readonly Species[], direction: PtDirection): Species[] {
  const increasing = ions.slice().sort((a, b) => b.z - a.z)
  return direction === 'increasing' ? increasing : increasing.slice().reverse()
}

export function neutral(z: number): Species {
  return { z, charge: 0 }
}

export function largerIsAtom(charge: number): boolean {
  return charge > 0
}

export function trendRow(z: number): ElementTrend {
  const row = trendByZ(z)
  if (!row) throw new Error(`no trend data for Z ${z}`)
  return row
}

/** Elements the locate template may ask about. */
export function locatePool(): ElementInfo[] {
  return ELEMENTS.filter((el) => !isReserved(el.symbol))
}

/** Main-group elements whose valence count this course asks for. */
export function valencePool(): ElementInfo[] {
  return ELEMENTS.filter((el) => !isReserved(el.symbol) && valenceOf(el) != null && el.z <= 54)
}

/** Increasing order by a measured column, or null when two values tie. */
export function strictDataOrder(zs: readonly number[], property: Exclude<PtProperty, 'metallic'>): number[] | null {
  const seen = new Set<number>()
  for (const z of zs) {
    const value = columnValue(z, property)
    if (seen.has(value)) return null
    seen.add(value)
  }
  return orderByData(zs, property)
}

export interface WhyCase {
  kind: 'period-radius' | 'period-ie' | 'group-radius' | 'group-ie'
  /** The element the question names first. */
  focus: number
  other: number
  reason: 'protons' | 'shells' | 'shielding'
}

export interface IsoSet {
  electrons: number
  /** Increasing ionic radius: fewer protons (lower Z) come last. */
  ions: Species[]
}

const WHY_BY = new Map<WhyCase['kind'], WhyCase[]>()

function buildWhy(): WhyCase[] {
  const out: WhyCase[] = []
  const pool = ELEMENTS.filter((el) => el.z <= 56 && el.group != null && el.group !== 18 && !isReserved(el.symbol))
  const addPair = (
    focus: ElementInfo,
    other: ElementInfo,
    property: 'radius' | 'ionization',
    kind: WhyCase['kind'],
    reason: WhyCase['reason'],
    want: -1 | 1,
  ) => {
    if (!trendAllowed(focus, property) || !trendAllowed(other, property)) return
    const trend = trendCompare(focus, other, property)
    if (trend !== want) return
    if (dataCompare(focus.z, other.z, property) !== trend) return
    out.push({ kind, focus: focus.z, other: other.z, reason })
  }
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i]!
      const b = pool[j]!
      if (a.period === b.period && a.group !== b.group) {
        const radiusDown = trendCompare(a, b, 'radius')
        if (radiusDown !== 0) {
          const smaller = radiusDown < 0 ? a : b
          const larger = smaller === a ? b : a
          addPair(smaller, larger, 'radius', 'period-radius', 'protons', -1)
        }
        const ionDown = trendCompare(a, b, 'ionization')
        if (ionDown !== 0) {
          const higher = ionDown > 0 ? a : b
          const lower = higher === a ? b : a
          addPair(higher, lower, 'ionization', 'period-ie', 'protons', 1)
        }
      } else if (a.group === b.group && a.period !== b.period) {
        const radiusDown = trendCompare(a, b, 'radius')
        if (radiusDown !== 0) {
          const bigger = radiusDown > 0 ? a : b
          const smaller = bigger === a ? b : a
          addPair(bigger, smaller, 'radius', 'group-radius', 'shells', 1)
        }
        const ionDown = trendCompare(a, b, 'ionization')
        if (ionDown !== 0) {
          const easier = ionDown < 0 ? a : b
          const harder = easier === a ? b : a
          addPair(easier, harder, 'ionization', 'group-ie', 'shielding', -1)
        }
      }
    }
  }
  out.sort((p, q) => p.kind.localeCompare(q.kind) || p.focus - q.focus || p.other - q.other)
  for (const item of out) {
    const bucket = WHY_BY.get(item.kind)
    if (bucket) bucket.push(item)
    else WHY_BY.set(item.kind, [item])
  }
  return out
}

function combineSpecies(items: readonly Species[], k: number): Species[][] {
  const out: Species[][] = []
  const acc: Species[] = []
  const walk = (start: number) => {
    if (acc.length === k) {
      out.push(acc.slice())
      return
    }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i]!)
      walk(i + 1)
      acc.pop()
    }
  }
  walk(0)
  return out
}

const ISO_BY_SIZE = new Map<number, IsoSet[]>()

function buildIso(): IsoSet[] {
  const byElectrons = new Map<number, Species[]>()
  for (const el of ELEMENTS) {
    if (el.z > 56 || isReserved(el.symbol)) continue
    for (const charge of el.commonCharges) {
      if (charge === 0) continue
      const electrons = el.z - charge
      if (electrons < 2) continue
      const sp = { z: el.z, charge }
      const list = byElectrons.get(electrons) ?? []
      if (list.some((have) => have.z === sp.z)) continue
      list.push(sp)
      byElectrons.set(electrons, list)
    }
  }
  const sets: IsoSet[] = []
  const counts = [...byElectrons.keys()].sort((a, b) => a - b)
  for (const electrons of counts) {
    const group = (byElectrons.get(electrons) ?? []).slice().sort((a, b) => a.z - b.z)
    if (group.length < 3) continue
    for (const k of [3, 4]) {
      if (group.length < k) continue
      for (const combo of combineSpecies(group, k)) {
        sets.push({ electrons, ions: isoOrder(combo, 'increasing') })
      }
    }
  }
  for (const set of sets) {
    const bucket = ISO_BY_SIZE.get(set.ions.length)
    if (bucket) bucket.push(set)
    else ISO_BY_SIZE.set(set.ions.length, [set])
  }
  return sets
}

export const WHY_CASES: readonly WhyCase[] = buildWhy()
export const ISO_SETS: readonly IsoSet[] = buildIso()

export function whyCases(kind: WhyCase['kind']): readonly WhyCase[] {
  return WHY_BY.get(kind) ?? []
}

export function isoSets(size: 3 | 4): readonly IsoSet[] {
  return ISO_BY_SIZE.get(size) ?? []
}
