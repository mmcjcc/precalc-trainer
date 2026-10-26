/**
 * Grades one part of a quantum-number problem. A named mistake is whatever that slip produces
 * for THIS problem, compared exactly. A candidate equal to the right answer is never used.
 */
import type { OrbitalId, QnCheck, QnStageId, QuantumAnswer } from '@/content/types'
import type { ErrorPatternId } from '@/shared/types'
import {
  JOB,
  TELLS,
  VALUES_MS,
  VALUES_MS_BAD,
  VALUES_N,
  VALUES_N_ZERO,
  answerLeaks,
  breaks,
  electronsInShell,
  electronsInSublevel,
  formatList,
  formatPair,
  formatSet,
  impossibleSublevel,
  isDne,
  orbitalAlt,
  isHalfPair,
  isIntegerSpinPhrase,
  loose,
  mlValues,
  orbitalPretty,
  orbitalsInShell,
  orbitalsInSublevel,
  parseCount,
  parseDecision,
  parseIntList,
  parseOrbital,
  parsePair,
  parseSet,
  parseSublevel,
  parseSublevelList,
  parseWhich,
  partnerOf,
  sameIntSet,
  sameNums,
  sublevelName,
  sublevelsOf,
  type QNums,
} from './facts'

export const QN_KEYS: Record<QnStageId, string> = { a: 'a', b: 'b', c: 'c', d: 'd' }

export const QN_MISTAKE_IDS = [
  'qn_l_equals_n',
  'qn_ml_out_of_range',
  'qn_ms_integer',
  'qn_n_zero',
  'qn_shell_orbitals_as_electrons',
  'qn_shell_electrons_as_orbitals',
  'qn_sublevel_electrons_as_orbitals',
  'qn_ml_missing_zero',
  'qn_ml_nonnegative',
  'qn_ml_as_l',
  'qn_ml_as_n',
  'qn_dxy_dx2y2_swapped',
  'qn_p_axis_mixed',
  'qn_same_spin',
  'qn_same_four',
] as const satisfies readonly ErrorPatternId[]

export type QnMistakeId = (typeof QN_MISTAKE_IDS)[number]

export type QnGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string }
  | { verdict: 'mistake'; mistake: QnMistakeId; witness: string; message: string }

export interface QnTrap {
  id: QnMistakeId
  text: string
  witness: string
}

const CORRECT = "That's right."
const WRONG = "That doesn't match this problem."
const CHOOSE = 'Choose one.'
const WHOLE = 'Type a whole number.'
const LIST = 'List the values, separated by commas.'
const NAME = 'Type the shell number and the sublevel letter.'
const SUBS = 'List the sublevels, separated by commas.'

export const WITNESS: Record<QnMistakeId, string> = {
  qn_l_equals_n: 'You let the angular momentum quantum number be as large as the shell, and it has to stay smaller.',
  qn_ml_out_of_range: 'The magnetic quantum number you picked is outside the orientations that sublevel has.',
  qn_ms_integer: 'You treated the spin as a whole number. The two spins are opposite halves.',
  qn_n_zero: 'You started the shells at zero. Shells begin at the first one.',
  qn_shell_orbitals_as_electrons: 'You gave the number of electrons in the shell. This question asks for the orbitals.',
  qn_shell_electrons_as_orbitals: 'You gave the number of orbitals in the shell. This question asks for the electrons.',
  qn_sublevel_electrons_as_orbitals: 'You gave the number of orbitals in the sublevel. This question asks for the electrons.',
  qn_ml_missing_zero: 'Your list has the negative end and the positive end, and it skips the middle.',
  qn_ml_nonnegative: 'Your list stays on zero and the positive side, and it leaves out the negative orientations.',
  qn_ml_as_l: 'You answered with the angular momentum quantum number, which names the shape, not the orientation.',
  qn_ml_as_n: 'You answered with the principal quantum number, which names the size of the shell, not the orientation.',
  qn_dxy_dx2y2_swapped: 'You swapped the d orbital that sits between the axes with the one that sits along them.',
  qn_p_axis_mixed: 'You named a p orbital on a different axis from the one in the question.',
  qn_same_spin: 'You gave the second electron the same spin, so all four quantum numbers match.',
  qn_same_four: 'You gave two electrons the same four quantum numbers. One set belongs to one electron.',
}

type Classified = { verdict: 'correct' } | { verdict: 'invalid' } | { verdict: 'wrong' } | { verdict: 'mistake'; mistake: QnMistakeId }

export function exampleShowsAnswer(example: string, answerText: string): boolean {
  return answerLeaks(example, answerText)
}

export function qnWork(answer: QuantumAnswer, entries: Record<string, string> | undefined): string[] {
  if (!entries) return []
  const lines: string[] = []
  for (const stage of answer.stages) {
    const value = entries[QN_KEYS[stage.id]]?.trim()
    if (!value) continue
    const shown = stage.kind === 'choice' ? (stage.choices?.find((choice) => choice.id === value)?.text ?? value) : value
    lines.push(`${stage.label}: ${shown}`)
  }
  return lines
}

function invalidMessage(check: QnCheck): string {
  switch (check.kind) {
    case 'tells':
    case 'symbol':
    case 'which-job':
    case 'values-n':
    case 'values-ms':
    case 'values-l':
    case 'values-ml':
    case 'allowed':
    case 'breaks':
    case 'shape':
    case 'shape-words':
    case 'partner':
    case 'pair':
      return CHOOSE
    case 'sublevels':
      return SUBS
    case 'name':
      return NAME
    case 'ml-list':
    case 'read-ml':
      return LIST
    default:
      return WHOLE
  }
}

function mlMistake(l: number, n: number | undefined, got: number[]): QnMistakeId | null {
  if (l < 1) return null
  const full = mlValues(l)
  const missing = full.filter((m) => m !== 0)
  const nonnegative = full.filter((m) => m >= 0)
  const tooFar = mlValues(l + 1)
  if (sameIntSet(got, missing)) return 'qn_ml_missing_zero'
  if (sameIntSet(got, nonnegative)) return 'qn_ml_nonnegative'
  if (sameIntSet(got, tooFar)) return 'qn_ml_out_of_range'
  if (got.length === 1 && got[0] === l) return 'qn_ml_as_l'
  if (n !== undefined && got.length === 1 && got[0] === n && n !== l) return 'qn_ml_as_n'
  return null
}

function classifyMl(l: number, n: number | undefined, text: string): Classified {
  const got = parseIntList(text)
  if (!got) return { verdict: 'invalid' }
  if (sameIntSet(got, mlValues(l))) return { verdict: 'correct' }
  const slip = mlMistake(l, n, got)
  return slip ? { verdict: 'mistake', mistake: slip } : { verdict: 'wrong' }
}

function shapeSlip(right: OrbitalId, got: OrbitalId): QnMistakeId | null {
  const swapped = right === 'dxy' || right === 'dx2y2'
  if (swapped && (got === 'dxy' || got === 'dx2y2') && got !== right) return 'qn_dxy_dx2y2_swapped'
  const p = right === 'px' || right === 'py' || right === 'pz'
  if (p && (got === 'px' || got === 'py' || got === 'pz') && got !== right) return 'qn_p_axis_mixed'
  return null
}

function classifyOrbital(right: OrbitalId, text: string): Classified {
  const got = parseOrbital(text)
  if (!got) return { verdict: 'invalid' }
  if (got === right) return { verdict: 'correct' }
  const slip = shapeSlip(right, got)
  return slip ? { verdict: 'mistake', mistake: slip } : { verdict: 'wrong' }
}

function classifyCount(right: number, trap: { value: number; id: QnMistakeId } | null, text: string): Classified {
  const got = parseCount(text)
  if (got === null) return { verdict: 'invalid' }
  if (got === right) return { verdict: 'correct' }
  if (trap && got === trap.value && trap.value !== right) return { verdict: 'mistake', mistake: trap.id }
  return { verdict: 'wrong' }
}

function tellsOf(text: string): 'n' | 'l' | 'ml' | 'ms' | null {
  const t = loose(text)
  for (const which of ['n', 'l', 'ml', 'ms'] as const) if (loose(TELLS[which]) === t) return which
  return null
}

function symbolOf(text: string): 'n' | 'l' | 'ml' | 'ms' | null {
  const t = loose(text).replace(/\s+/g, '')
  if (t === 'ml' || t === 'm_l') return 'ml'
  if (t === 'ms' || t === 'm_s') return 'ms'
  if (t === 'l') return 'l'
  if (t === 'n') return 'n'
  return null
}

function jobOf(text: string): 'n' | 'l' | 'ml' | 'ms' | null {
  const t = loose(text)
  for (const which of ['n', 'l', 'ml', 'ms'] as const) if (loose(JOB[which]) === t) return which
  return null
}

function mlConfused(which: 'n' | 'l' | 'ml' | 'ms'): QnMistakeId | null {
  if (which === 'l') return 'qn_ml_as_l'
  if (which === 'n') return 'qn_ml_as_n'
  return null
}

function classifyName(n: number, l: number, text: string): Classified {
  const exists = sublevelName(n, l)
  if (!exists) {
    if (isDne(text)) return { verdict: 'correct' }
    const parsed = parseSublevel(text)
    if (!parsed) return { verdict: 'invalid' }
    if (parsed.n === n && parsed.l === l) return { verdict: 'mistake', mistake: 'qn_l_equals_n' }
    if (parsed.l >= parsed.n) return { verdict: 'mistake', mistake: 'qn_l_equals_n' }
    return { verdict: 'wrong' }
  }
  const parsed = parseSublevel(text)
  if (isDne(text)) return { verdict: 'wrong' }
  if (!parsed) return { verdict: 'invalid' }
  if (parsed.n === n && parsed.l === l) return { verdict: 'correct' }
  if (parsed.l >= parsed.n) return { verdict: 'mistake', mistake: 'qn_l_equals_n' }
  return { verdict: 'wrong' }
}

function wordsOrbital(ask: Extract<QnCheck, { kind: 'shape-words' }>['ask']): OrbitalId | 'count' {
  switch (ask) {
    case 'd-along-xy':
      return 'dx2y2'
    case 'd-between-xy':
      return 'dxy'
    case 'd-between-xz':
      return 'dxz'
    case 'd-between-yz':
      return 'dyz'
    case 'd-ring':
      return 'dz2'
    case 'p-x':
      return 'px'
    case 'p-y':
      return 'py'
    case 'p-z':
      return 'pz'
    case 'sphere':
      return 's'
    case 's-orientations':
      return 'count'
  }
}

/** What this answer is for this check: right, a named slip, a plain miss, or not an attempt. */
export function classify(check: QnCheck, text: string): Classified {
  const raw = text.trim()
  if (!raw) return { verdict: 'invalid' }
  switch (check.kind) {
    case 'tells': {
      const which = tellsOf(raw)
      if (!which) return { verdict: 'invalid' }
      if (which === check.which) return { verdict: 'correct' }
      if (check.which === 'ml') {
        const slip = mlConfused(which)
        if (slip) return { verdict: 'mistake', mistake: slip }
      }
      return { verdict: 'wrong' }
    }
    case 'symbol': {
      const which = symbolOf(raw)
      if (!which) return { verdict: 'invalid' }
      if (which === check.which) return { verdict: 'correct' }
      if (check.which === 'ml') {
        const slip = mlConfused(which)
        if (slip) return { verdict: 'mistake', mistake: slip }
      }
      return { verdict: 'wrong' }
    }
    case 'which-job': {
      const which = jobOf(raw)
      if (!which) return { verdict: 'invalid' }
      if (which === check.which) return { verdict: 'correct' }
      if (check.which === 'ml') {
        const slip = mlConfused(which)
        if (slip) return { verdict: 'mistake', mistake: slip }
      }
      return { verdict: 'wrong' }
    }
    case 'values-n': {
      if (loose(raw) === loose(VALUES_N)) return { verdict: 'correct' }
      if (loose(raw) === loose(VALUES_N_ZERO)) return { verdict: 'mistake', mistake: 'qn_n_zero' }
      if (loose(raw) === loose(VALUES_MS) || loose(raw) === 'any whole number') return { verdict: 'wrong' }
      return { verdict: 'invalid' }
    }
    case 'values-ms': {
      if (isHalfPair(raw)) return { verdict: 'correct' }
      if (isIntegerSpinPhrase(raw)) return { verdict: 'mistake', mistake: 'qn_ms_integer' }
      if (loose(raw) === loose(VALUES_N) || loose(raw) === 'any whole number') return { verdict: 'wrong' }
      return { verdict: 'invalid' }
    }
    case 'values-l': {
      const got = parseIntList(raw)
      if (!got) return { verdict: 'invalid' }
      const right = range(0, check.n - 1)
      const throughN = range(0, check.n)
      if (sameIntSet(got, right)) return { verdict: 'correct' }
      if (sameIntSet(got, throughN)) return { verdict: 'mistake', mistake: 'qn_l_equals_n' }
      return { verdict: 'wrong' }
    }
    case 'values-ml':
      return classifyMl(check.l, undefined, raw)
    case 'allowed': {
      const decision = parseDecision(raw)
      if (!decision) return { verdict: 'invalid' }
      const why = breaks(check.n, check.l, check.ml, check.ms2)
      if (!why) return decision === 'allowed' ? { verdict: 'correct' } : { verdict: 'wrong' }
      if (decision === 'not') return { verdict: 'correct' }
      if (why === 'n') return { verdict: 'mistake', mistake: 'qn_n_zero' }
      if (why === 'l') return { verdict: 'mistake', mistake: 'qn_l_equals_n' }
      if (why === 'ml') return { verdict: 'mistake', mistake: 'qn_ml_out_of_range' }
      return { verdict: 'mistake', mistake: 'qn_ms_integer' }
    }
    case 'breaks': {
      const which = parseWhich(raw)
      if (!which) return { verdict: 'invalid' }
      const why = breaks(check.n, check.l, check.ml, check.ms2)
      if (why && which === why) return { verdict: 'correct' }
      return { verdict: 'wrong' }
    }
    case 'sub-orbitals':
      return classifyCount(orbitalsInSublevel(check.l), null, raw)
    case 'orbital-electrons':
      return classifyCount(2, null, raw)
    case 'sub-electrons':
      return classifyCount(electronsInSublevel(check.l), { value: orbitalsInSublevel(check.l), id: 'qn_sublevel_electrons_as_orbitals' }, raw)
    case 'shell-orbitals':
      return classifyCount(orbitalsInShell(check.n), { value: electronsInShell(check.n), id: 'qn_shell_orbitals_as_electrons' }, raw)
    case 'shell-electrons':
      return classifyCount(electronsInShell(check.n), { value: orbitalsInShell(check.n), id: 'qn_shell_electrons_as_orbitals' }, raw)
    case 'ml-list':
      return classifyMl(check.l, check.n, raw)
    case 'sublevels': {
      const got = parseSublevelList(raw)
      if (!got) return { verdict: 'invalid' }
      const right = sublevelsOf(check.n)
      const names = got.map((item) => `${item.n}${letterOr(item.l)}`)
      if (sameNameSet(names, right)) return { verdict: 'correct' }
      const extra = impossibleSublevel(check.n)
      if (extra && (sameNameSet(names, [...right, extra]) || sameNameSet(names, [extra]))) return { verdict: 'mistake', mistake: 'qn_l_equals_n' }
      if (got.some((item) => item.l >= item.n)) return { verdict: 'mistake', mistake: 'qn_l_equals_n' }
      return { verdict: 'wrong' }
    }
    case 'nl-electrons':
      return classifyCount(electronsInSublevel(check.l), { value: orbitalsInSublevel(check.l), id: 'qn_sublevel_electrons_as_orbitals' }, raw)
    case 'nlm-electrons':
      return classifyCount(2, null, raw)
    case 'name':
      return classifyName(check.n, check.l, raw)
    case 'read-n': {
      const got = parseCount(raw)
      if (got === null) return { verdict: 'invalid' }
      if (got === check.n) return { verdict: 'correct' }
      if (got === 0) return { verdict: 'mistake', mistake: 'qn_n_zero' }
      return { verdict: 'wrong' }
    }
    case 'read-l': {
      const got = parseCount(raw)
      if (got === null) return { verdict: 'invalid' }
      if (got === check.l) return { verdict: 'correct' }
      if (got === check.n) return { verdict: 'mistake', mistake: 'qn_l_equals_n' }
      return { verdict: 'wrong' }
    }
    case 'read-ml':
      return classifyMl(check.l, check.n, raw)
    case 'shape':
      return classifyOrbital(check.orbital, raw)
    case 'shape-words': {
      const which = wordsOrbital(check.ask)
      if (which === 'count') return classifyCount(1, null, raw)
      return classifyOrbital(which, raw)
    }
    case 'partner': {
      const got = parseSet(raw)
      if (!got) return { verdict: 'invalid' }
      const source: QNums = { n: check.n, l: check.l, ml: check.ml, ms2: check.ms2 }
      if (sameNums(got, partnerOf(source))) return { verdict: 'correct' }
      if (sameNums(got, source)) return { verdict: 'mistake', mistake: 'qn_same_spin' }
      return { verdict: 'wrong' }
    }
    case 'pair': {
      const got = parsePair(raw)
      if (!got) return { verdict: 'invalid' }
      const [a, b] = got
      // Any two electrons with the same four numbers break the principle.
      if (sameNums(a, b)) return { verdict: 'correct' }
      return { verdict: 'wrong' }
    }
    case 'set-count':
      return classifyCount(1, { value: 2, id: 'qn_same_four' }, raw)
    default: {
      const unexpected: never = check
      throw new Error(`unknown quantum check ${String(unexpected)}`)
    }
  }
}

function letterOr(l: number): string {
  return ['s', 'p', 'd', 'f', 'g', 'h', 'i'][l] ?? '?'
}

function sameNameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const left = [...a].map((name) => loose(name)).sort()
  const right = [...b].map((name) => loose(name)).sort()
  return left.every((name, i) => name === right[i])
}

export function canonicalAnswer(check: QnCheck): string {
  switch (check.kind) {
    case 'tells':
      return TELLS[check.which]
    case 'symbol':
      return check.which
    case 'which-job':
      return JOB[check.which]
    case 'values-n':
      return VALUES_N
    case 'values-ms':
      return VALUES_MS
    case 'values-l':
      return formatList(Array.from({ length: check.n }, (_, i) => i))
    case 'values-ml':
      return formatList(mlValues(check.l))
    case 'allowed':
      return breaks(check.n, check.l, check.ml, check.ms2) ? 'Not allowed' : 'Allowed'
    case 'breaks': {
      const why = breaks(check.n, check.l, check.ml, check.ms2)
      if (!why) throw new Error('breaks question on an allowed set')
      return JOB[why]
    }
    case 'sub-orbitals':
      return String(orbitalsInSublevel(check.l))
    case 'orbital-electrons':
      return '2'
    case 'sub-electrons':
    case 'nl-electrons':
      return String(electronsInSublevel(check.l))
    case 'shell-orbitals':
      return String(orbitalsInShell(check.n))
    case 'shell-electrons':
      return String(electronsInShell(check.n))
    case 'ml-list':
      return formatList(mlValues(check.l))
    case 'sublevels':
      return sublevelsOf(check.n).join(', ')
    case 'nlm-electrons':
      return '2'
    case 'name':
      return sublevelName(check.n, check.l) ?? 'Does not exist'
    case 'read-n':
      return String(check.n)
    case 'read-l':
      return String(check.l)
    case 'read-ml':
      return formatList(mlValues(check.l))
    case 'shape':
      return orbitalPretty(check.orbital)
    case 'shape-words': {
      const which = wordsOrbital(check.ask)
      return which === 'count' ? '1' : orbitalPretty(which)
    }
    case 'partner':
      return formatSet(partnerOf({ n: check.n, l: check.l, ml: check.ml, ms2: check.ms2 }))
    case 'pair': {
      const source: QNums = { n: check.n, l: check.l, ml: check.ml, ms2: check.ms2 }
      return formatPair(source, source)
    }
    case 'set-count':
      return '1'
    default: {
      const unexpected: never = check
      throw new Error(`unknown quantum check ${String(unexpected)}`)
    }
  }
}

/** Wrong answers worth naming for this check. The right answer is never included. */
export function trapsFor(check: QnCheck): QnTrap[] {
  const out: QnTrap[] = []
  const seen = new Set<string>()
  for (const text of candidates(check)) {
    const graded = classify(check, text)
    if (graded.verdict !== 'mistake') continue
    const key = `${graded.mistake}|${loose(text)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ id: graded.mistake, text, witness: WITNESS[graded.mistake] })
  }
  return out
}

function range(lo: number, hi: number): number[] {
  const out: number[] = []
  for (let v = lo; v <= hi; v++) out.push(v)
  return out
}

function candidates(check: QnCheck): string[] {
  switch (check.kind) {
    case 'tells':
      return Object.values(TELLS)
    case 'symbol':
      return ['n', 'l', 'ml', 'ms']
    case 'which-job':
      return Object.values(JOB)
    case 'values-n':
      return [VALUES_N, VALUES_N_ZERO, VALUES_MS, 'any whole number']
    case 'values-ms':
      return [VALUES_MS, VALUES_MS_BAD, VALUES_N, 'any whole number']
    case 'values-l':
      return [formatList(range(0, check.n - 1)), formatList(range(0, check.n)), formatList(range(1, Math.max(1, check.n - 1))), formatList([-1, 0, 1])]
    case 'values-ml':
      return mlCandidates(check.l, undefined)
    case 'allowed':
      return ['Allowed', 'Not allowed']
    case 'breaks':
      return Object.values(JOB)
    case 'sub-orbitals':
      return [String(orbitalsInSublevel(check.l)), String(electronsInSublevel(check.l))]
    case 'orbital-electrons':
      return ['2', '1', '6']
    case 'sub-electrons':
    case 'nl-electrons':
      return [String(electronsInSublevel(check.l)), String(orbitalsInSublevel(check.l)), '2']
    case 'shell-orbitals':
      return [String(orbitalsInShell(check.n)), String(electronsInShell(check.n))]
    case 'shell-electrons':
      return [String(electronsInShell(check.n)), String(orbitalsInShell(check.n))]
    case 'ml-list':
      return mlCandidates(check.l, check.n)
    case 'sublevels': {
      const right = sublevelsOf(check.n)
      const extra = impossibleSublevel(check.n)
      return extra ? [right.join(', '), [...right, extra].join(', '), extra] : [right.join(', ')]
    }
    case 'nlm-electrons':
      return ['2', '1', String(electronsInSublevel(check.l))]
    case 'name': {
      const real = sublevelName(check.n, check.l)
      const bad = `${check.n}${letterOr(check.l)}`
      const other = impossibleSublevel(Math.min(check.n, 3)) ?? '1p'
      return real ? [real, 'Does not exist', other, bad] : ['Does not exist', bad, "doesn't exist"]
    }
    case 'read-n':
      return [String(check.n), '0', String(check.l)]
    case 'read-l':
      return [String(check.l), String(check.n), '0']
    case 'read-ml':
      return mlCandidates(check.l, check.n)
    case 'shape':
      return ORBITAL_PRETTY
    case 'shape-words':
      return wordsOrbital(check.ask) === 'count' ? ['1', '3', '5', '7'] : ORBITAL_PRETTY
    case 'partner': {
      const source: QNums = { n: check.n, l: check.l, ml: check.ml, ms2: check.ms2 }
      return [formatSet(partnerOf(source)), formatSet(source)]
    }
    case 'pair': {
      const source: QNums = { n: check.n, l: check.l, ml: check.ml, ms2: check.ms2 }
      return [formatPair(source, partnerOf(source)), formatPair(source, source)]
    }
    case 'set-count':
      return ['1', '2', '0']
    default: {
      const unexpected: never = check
      throw new Error(`unknown quantum check ${String(unexpected)}`)
    }
  }
}

const ORBITAL_PRETTY = (['s', 'px', 'py', 'pz', 'dxy', 'dxz', 'dyz', 'dx2y2', 'dz2'] as const).map((id) => orbitalPretty(id))

function mlCandidates(l: number, n: number | undefined): string[] {
  const full = mlValues(l)
  const out = [formatList(full), formatList(full.filter((m) => m !== 0)), formatList(full.filter((m) => m >= 0)), formatList(mlValues(l + 1)), String(l)]
  if (n !== undefined) out.push(String(n))
  return out
}

export function gradeQnStage(answer: QuantumAnswer, stageId: QnStageId, text: string): QnGrade {
  const stage = answer.stages.find((item) => item.id === stageId)
  if (!stage) return { verdict: 'invalid', message: CHOOSE }
  const graded = classify(stage.check, text)
  if (graded.verdict === 'invalid') return { verdict: 'invalid', message: invalidMessage(stage.check) }
  if (graded.verdict === 'correct') return { verdict: 'correct', message: CORRECT }
  if (graded.verdict === 'wrong') return { verdict: 'wrong', message: WRONG }
  return { verdict: 'mistake', mistake: graded.mistake, witness: WITNESS[graded.mistake], message: WITNESS[graded.mistake] }
}

/** The generator refuses to ship a problem that does not grade itself. */
export function assertQuantum(answer: QuantumAnswer): void {
  if (answer.stages.length < 1) throw new Error('no stages')
  for (const stage of answer.stages) {
    const ok = gradeQnStage(answer, stage.id, stage.answerText)
    if (ok.verdict !== 'correct') throw new Error(`${answer.question} ${stage.id} answer "${stage.answerText}" graded ${ok.verdict}`)
    const shown = stage.kind === 'choice' ? (stage.choices?.find((choice) => loose(choice.id) === loose(stage.answerText))?.text ?? stage.answerText) : stage.answerText
    for (const surface of [answer.prompt, stage.hint, stage.nudge]) {
      if (answerLeaks(surface, stage.answerText) || answerLeaks(surface, shown)) throw new Error(`${stage.id} leaks "${shown}" in ${surface}`)
    }
    for (const trap of stage.traps) {
      const graded = gradeQnStage(answer, stage.id, trap.text)
      if (graded.verdict !== 'mistake' || graded.mistake !== trap.id) throw new Error(`${trap.id} via "${trap.text}" graded ${graded.verdict}`)
      if (loose(trap.text) === loose(stage.answerText)) throw new Error(`${trap.id} equals the answer`)
      if (answerLeaks(trap.witness, stage.answerText) || answerLeaks(trap.witness, shown)) throw new Error(`${trap.id} witness leaks`)
    }
    if (stage.kind === 'choice') {
      const choices = stage.choices ?? []
      const rights = choices.filter((choice) => gradeQnStage(answer, stage.id, choice.id).verdict === 'correct')
      if (rights.length !== 1) throw new Error(`${stage.id} has ${rights.length} right choices`)
      for (const choice of choices) {
        const graded = gradeQnStage(answer, stage.id, choice.id)
        if (graded.verdict === 'invalid') throw new Error(`${stage.id} choice "${choice.text}" is unreadable`)
        if (choice.trap && (graded.verdict !== 'mistake' || graded.mistake !== choice.trap)) throw new Error(`${stage.id} tag ${choice.trap}`)
      }
    }
  }
  if (answer.figure) {
    if (answer.figure.ariaLabel !== orbitalAlt(answer.figure.orbital)) throw new Error('figure description drifted')
    if (answerLeaks(answer.figure.ariaLabel, orbitalPretty(answer.figure.orbital))) throw new Error('figure prints its name')
  }
  if (/does not exist/i.test(answer.prompt)) throw new Error('prompt prints a button')
  if (/\b[Aa]n? \d/.test(answer.prompt)) throw new Error(`article before a number: ${answer.prompt}`)
  for (const sentence of answer.prompt.split(/(?<=[.?!])\s+/)) {
    if (!/^[A-Z]/.test(sentence)) throw new Error(`sentence does not start cleanly: ${sentence}`)
  }
  if (answer.trap) {
    if (!answer.trapStage || answer.trapAnswer == null) throw new Error('trap is incomplete')
    const graded = gradeQnStage(answer, answer.trapStage, answer.trapAnswer)
    if (graded.verdict !== 'mistake' || graded.mistake !== answer.trap) throw new Error(`promised ${answer.trap} graded ${graded.verdict}`)
  }
}


