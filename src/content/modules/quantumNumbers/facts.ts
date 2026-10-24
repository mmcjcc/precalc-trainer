/**
 * Quantum-number facts (CK-12 Chemistry, chapter 5). The grader and the templates share these.
 * The solve-again test does not: it reads the prompt and the figure and applies the rules itself.
 */
import type { OrbitalId } from '@/content/types'

export const ORBITAL_IDS: readonly OrbitalId[] = ['s', 'px', 'py', 'pz', 'dxy', 'dxz', 'dyz', 'dx2y2', 'dz2']

const LETTERS = ['s', 'p', 'd', 'f', 'g', 'h', 'i'] as const

/** What each quantum number tells. Choice text, not a sentence that starts with a symbol. */
export const TELLS: Record<'n' | 'l' | 'ml' | 'ms', string> = {
  n: "the energy level and the orbital's size",
  l: "the sublevel and the orbital's shape",
  ml: "the orbital's orientation",
  ms: "the electron's spin",
}

/** The name of each quantum number, as a choice. */
export const JOB: Record<'n' | 'l' | 'ml' | 'ms', string> = {
  n: 'the principal quantum number',
  l: 'the angular momentum quantum number',
  ml: 'the magnetic quantum number',
  ms: 'the spin quantum number',
}

export const VALUES_N = '1, 2, 3, …'
export const VALUES_N_ZERO = '0, 1, 2, …'
export const VALUES_MS = '+1/2 or −1/2'
export const VALUES_MS_BAD = '0, +1 or −1'

export interface QNums {
  n: number
  l: number
  ml: number
  /** 1 is +1/2, −1 is −1/2, 0 is 0, 2 is +1, −2 is −1. */
  ms2: number
}

export type QnBreak = 'n' | 'l' | 'ml' | 'ms'

export function letterOf(l: number): string | null {
  return LETTERS[l] ?? null
}

export function lOfLetter(letter: string): number | null {
  const i = LETTERS.indexOf(letter.toLowerCase() as (typeof LETTERS)[number])
  return i < 0 ? null : i
}

/** The sublevel name, or null when l is not allowed for that shell. */
export function sublevelName(n: number, l: number): string | null {
  const letter = letterOf(l)
  if (!letter || !Number.isInteger(n) || !Number.isInteger(l) || n < 1 || l < 0 || l >= n) return null
  return `${n}${letter}`
}

/** Every real sublevel in the shell, through the letters this course names. */
export function sublevelsOf(n: number): string[] {
  const out: string[] = []
  for (let l = 0; l <= n - 1 && l < LETTERS.length; l++) {
    const name = sublevelName(n, l)
    if (name) out.push(name)
  }
  return out
}

/** The sublevel with l = n, which cannot exist. Null past the letters we can write. */
export function impossibleSublevel(n: number): string | null {
  const letter = letterOf(n)
  return letter ? `${n}${letter}` : null
}

export function orbitalsInSublevel(l: number): number {
  return 2 * l + 1
}

export function electronsInSublevel(l: number): number {
  return 2 * orbitalsInSublevel(l)
}

export function orbitalsInShell(n: number): number {
  return n * n
}

export function electronsInShell(n: number): number {
  return 2 * n * n
}

export function mlValues(l: number): number[] {
  const out: number[] = []
  for (let m = -l; m <= l; m++) out.push(m)
  return out
}

/**
 * The first number that breaks the rules, in the order n, l, ml, ms.
 * Null when the set is allowed.
 */
export function breaks(n: number, l: number, ml: number, ms2: number): QnBreak | null {
  if (!Number.isInteger(n) || n < 1) return 'n'
  if (!Number.isInteger(l) || l < 0 || l > n - 1) return 'l'
  if (!Number.isInteger(ml) || ml < -l || ml > l) return 'ml'
  if (ms2 !== 1 && ms2 !== -1) return 'ms'
  return null
}

export function partnerOf(q: QNums): QNums {
  return { ...q, ms2: q.ms2 === 1 ? -1 : 1 }
}

export function sameNums(a: QNums, b: QNums): boolean {
  return a.n === b.n && a.l === b.l && a.ml === b.ml && a.ms2 === b.ms2
}

export function formatInt(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : String(n)
}

export function formatList(values: readonly number[]): string {
  return values.map(formatInt).join(', ')
}

export function formatMs(ms2: number): string {
  if (ms2 === 1) return '+1/2'
  if (ms2 === -1) return '−1/2'
  if (ms2 === 0) return '0'
  if (ms2 === 2) return '+1'
  if (ms2 === -2) return '−1'
  return String(ms2)
}

export function formatSet(q: QNums): string {
  return `(${q.n}, ${q.l}, ${formatInt(q.ml)}, ${formatMs(q.ms2)})`
}

export function formatPair(a: QNums, b: QNums): string {
  return `${formatSet(a)} and ${formatSet(b)}`
}

export function orbitalPretty(id: OrbitalId): string {
  if (id === 'dx2y2') return 'dx²−y²'
  if (id === 'dz2') return 'dz²'
  return id
}

/** What the picture shows. Never the orbital's name. */
export function orbitalAlt(id: OrbitalId): string {
  switch (id) {
    case 's':
      return 'A sphere, the same in every direction'
    case 'px':
      return 'Two lobes, along the x axis'
    case 'py':
      return 'Two lobes, along the y axis'
    case 'pz':
      return 'Two lobes, along the z axis'
    case 'dxy':
      return 'Four lobes, between the x and y axes'
    case 'dxz':
      return 'Four lobes, between the x and z axes'
    case 'dyz':
      return 'Four lobes, between the y and z axes'
    case 'dx2y2':
      return 'Four lobes, along the x and y axes'
    case 'dz2':
      return 'Two lobes along the z axis, with a ring in the xy plane'
  }
}

export function loose(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/−|–|—/g, '-')
    .replace(/²/g, '2')
    .replace(/½/g, '1/2')
    .replace(/\s+/g, ' ')
}

export function isDne(raw: string): boolean {
  const t = loose(raw).replace(/[.!]$/, '')
  return t === 'does not exist' || t === "doesn't exist" || t === 'doesnt exist'
}

export function parseDecision(raw: string): 'allowed' | 'not' | null {
  const t = loose(raw).replace(/[.!]$/, '')
  if (t === 'allowed' || t === 'is allowed') return 'allowed'
  if (t === 'not allowed' || t === 'is not allowed' || t === "isn't allowed") return 'not'
  return null
}

export function parseWhich(raw: string): QnBreak | null {
  const t = loose(raw)
  if (t === 'n' || t.includes('principal')) return 'n'
  if (t === 'ml' || t === 'm_l' || t.includes('magnetic')) return 'ml'
  if (t === 'ms' || t === 'm_s' || t.includes('spin quantum')) return 'ms'
  if (t === 'l' || t.includes('angular')) return 'l'
  return null
}

/** +1/2, 1/2, +½, −1/2, -1/2, and the whole-number spins 0, +1, −1. */
export function parseMs(raw: string): number | null {
  const t = loose(raw).replace(/\s+/g, '')
  if (t === '+1/2' || t === '1/2' || t === '+0.5' || t === '0.5' || t === '.5') return 1
  if (t === '-1/2' || t === '-0.5' || t === '-.5') return -1
  if (t === '0' || t === '+0' || t === '-0') return 0
  if (t === '+1' || t === '1') return 2
  if (t === '-1') return -2
  return null
}

export function parseSet(raw: string): QNums | null {
  const t = loose(raw)
  const m = t.match(/^\(\s*([+-]?\d+)\s*,\s*([+-]?\d+)\s*,\s*([+-]?\d+)\s*,\s*([^)]+?)\s*\)$/)
  if (!m) return null
  const ms2 = parseMs(m[4]!)
  if (ms2 === null) return null
  return { n: Number(m[1]), l: Number(m[2]), ml: Number(m[3]), ms2 }
}

export function parsePair(raw: string): [QNums, QNums] | null {
  const parts = raw.split(/\s+and\s+/i)
  if (parts.length !== 2) return null
  const a = parseSet(parts[0]!)
  const b = parseSet(parts[1]!)
  if (!a || !b) return null
  return [a, b]
}

export function parseSublevel(raw: string): { n: number; l: number } | null {
  const t = loose(raw).replace(/\s+/g, '')
  const m = t.match(/^(\d+)([spdfghi])$/)
  if (!m) return null
  const l = lOfLetter(m[2]!)
  if (l === null) return null
  return { n: Number(m[1]), l }
}

export function parseSublevelList(raw: string): { n: number; l: number }[] | null {
  const t = raw.trim()
  if (!t) return null
  const parts = t.split(/[, ]+/).filter(Boolean)
  if (parts.length === 0) return null
  const out: { n: number; l: number }[] = []
  for (const part of parts) {
    const one = parseSublevel(part)
    if (!one) return null
    out.push(one)
  }
  return out
}

export function parseIntList(raw: string): number[] | null {
  const t = loose(raw).replace(/\band\b/g, ',')
  if (!t) return null
  const parts = t.split(/[, ]+/).filter(Boolean)
  if (parts.length === 0) return null
  const nums: number[] = []
  for (const part of parts) {
    if (!/^[+-]?\d+$/.test(part)) return null
    nums.push(Number(part))
  }
  return nums
}

export function sameIntSet(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false
  const left = [...a].sort((x, y) => x - y)
  const right = [...b].sort((x, y) => x - y)
  return left.every((v, i) => v === right[i])
}

export function parseCount(raw: string): number | null {
  let t = loose(raw).replace(/[.!]$/, '')
  t = t.replace(/^(answer\s*[:=]|the answer is)\s*/, '')
  t = t.replace(/\s*(electrons?|orbitals?|orientations?|values?)$/, '')
  if (!/^[+-]?\d+$/.test(t)) return null
  return Number(t)
}

export function parseOrbital(raw: string): OrbitalId | null {
  const t = loose(raw).replace(/\s+/g, '').replace(/\^2/g, '2')
  if (t === 's') return 's'
  if (t === 'px') return 'px'
  if (t === 'py') return 'py'
  if (t === 'pz') return 'pz'
  if (t === 'dxy') return 'dxy'
  if (t === 'dxz') return 'dxz'
  if (t === 'dyz') return 'dyz'
  if (t === 'dx2-y2' || t === 'dx2y2' || t === 'd(x2-y2)') return 'dx2y2'
  if (t === 'dz2') return 'dz2'
  return null
}

/** The two spin values, in either order, written as halves. */
export function isHalfPair(raw: string): boolean {
  const t = loose(raw)
  const m = t.match(/^(.+?)\s+or\s+(.+)$/)
  if (!m) return false
  const spins = [parseMs(m[1]!), parseMs(m[2]!)].sort((a, b) => (a ?? 0) - (b ?? 0))
  return spins[0] === -1 && spins[1] === 1
}

/** 0, +1 and −1 offered as the spins. */
export function isIntegerSpinPhrase(raw: string): boolean {
  const t = loose(raw)
  if (t.includes('1/2')) return false
  const nums = t.match(/[+-]?\d+/g)
  if (!nums) return false
  const set = new Set(nums.map((n) => Number(n)))
  return set.size === 3 && set.has(0) && set.has(1) && set.has(-1)
}

/**
 * True when `text` contains `answer` as its own token or phrase.
 * A digit inside a longer token does not count, and a letter inside a word does not count.
 * An apostrophe stays inside the word, so a possessive does not contain a one-letter answer.
 */
export function answerLeaks(text: string, answer: string): boolean {
  const ans = loose(answer)
  if (!ans) return false
  const escaped = ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![a-z0-9'])${escaped}(?![a-z0-9'])`).test(loose(text))
}
