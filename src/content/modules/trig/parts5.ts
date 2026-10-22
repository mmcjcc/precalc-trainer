/**
 * Checking the Unit 5 kinds of trig part (graphs of the trig functions, inverse functions) with the core's readers and
 * graders: a phase shift, a midline, a range (the app's interval reader), the key points, a function graded as a
 * function, a set of x-values, an inverse function's value or no value. A named mistake is a trap computed for THIS
 * problem; a plain wrong answer gets the part's own note; a message she can retry on never states the answer.
 * parts.ts dispatches here.
 */
import type { TrigPart } from '@/content/types'
import { parseSetAnswer } from '@/engine'
import {
  angleIn,
  exactEq,
  exactNeg,
  exactNum,
  gradePoints,
  gradeShift,
  gradeTrigAnswer,
  gradeXSet,
  hasDecimal,
  hasTrigFunction,
  isTrigMistake,
  nearlySameFunction,
  q,
  readExact,
  readFunctionAnswer,
  readPointList,
  readShift,
  readTrigAnswer,
  readXSet,
  sameFunction,
  spreadSamples,
  type ExprNode,
  type PointsCandidate,
  type ShiftCandidate,
  type TrigCandidate,
  type TrigExact,
  type TrigGrade,
  type XSetCandidate,
} from '@/engine/trig'
import { setsEqual } from '@/notation'
import type { ErrorPatternId, SolutionSet } from '@/shared/types'

/** The same shape as parts.ts's TrigPartGrade (kept here so the two files do not import each other). */
export type Part5Grade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'mistake'; mistake: ErrorPatternId; witness: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string }

const UNIT5_KINDS = new Set(['shift', 'midline', 'interval', 'points', 'function', 'family', 'principal'])

export function isUnit5Part(part: TrigPart): boolean {
  return UNIT5_KINDS.has(part.kind)
}

function fromCore(part: TrigPart, g: TrigGrade): Part5Grade {
  switch (g.verdict) {
    case 'correct':
      return { verdict: 'correct', message: g.message }
    case 'mistake':
      return { verdict: 'mistake', mistake: g.mistake, witness: g.witness }
    case 'wrong':
      return { verdict: 'wrong', message: part.wrongNote }
    case 'invalid':
      return { verdict: 'invalid', message: g.message }
  }
}

const exact = (text: string): TrigExact => {
  const v = readExact(text)
  if (v === null || v === 'undefined') throw new Error(`cannot read ${text}`)
  return v
}

// ---------------------------------------------------------------------------
// Phase shift and midline
// ---------------------------------------------------------------------------

function gradeShiftPart(part: TrigPart, raw: string): Part5Grade {
  const c = part.check
  if (c.kind !== 'shift') throw new Error('not a shift part')
  const cands: ShiftCandidate[] = []
  for (const t of part.traps) {
    if (!isTrigMistake(t.id)) continue
    const r = readShift(t.text)
    if (r.ok) cands.push({ id: t.id, value: r.value, witness: t.witness })
  }
  return fromCore(part, gradeShift(exact(c.value), raw, cands))
}

/** "y = 2", "2", "y=-1/2": the height of the midline, or why it cannot be read. */
export function readMidline(raw: string): { ok: true; value: TrigExact; tex: string } | { ok: false; message: string } {
  const t = (raw ?? '').replace(/[−–—]/g, '-').trim()
  if (!t) return { ok: false, message: 'Type your answer first: the midline is y = a number.' }
  const m = /^([A-Za-z])\s*=\s*(.*)$/.exec(t)
  if (m && m[1]!.toLowerCase() !== 'y') return { ok: false, message: 'The midline is a horizontal line: write it as y = a number.' }
  const body = m ? m[2]! : t
  const r = readTrigAnswer(body)
  if (!r.ok) return { ok: false, message: r.message }
  if (r.kind === 'undefined') return { ok: false, message: 'The midline is a horizontal line: write it as y = a number.' }
  if (r.degrees) return { ok: false, message: 'A height has no degree sign.' }
  if (!r.exact) return { ok: false, message: 'Write the height as one number.' }
  return { ok: true, value: r.exact, tex: `y = ${r.tex}` }
}

function gradeMidlinePart(part: TrigPart, raw: string): Part5Grade {
  const c = part.check
  if (c.kind !== 'midline') throw new Error('not a midline part')
  const r = readMidline(raw)
  if (!r.ok) return { verdict: 'invalid', message: r.message }
  if (exactEq(r.value, exact(c.value))) return { verdict: 'correct', message: 'Correct: that is the midline.' }
  for (const t of part.traps) {
    const s = readMidline(t.text)
    if (s.ok && exactEq(s.value, r.value) && isTrigMistake(t.id)) return { verdict: 'mistake', mistake: t.id, witness: t.witness }
  }
  return { verdict: 'wrong', message: part.wrongNote }
}

// ---------------------------------------------------------------------------
// A range
// ---------------------------------------------------------------------------

/** "y ∈ ℝ", "all reals": every real number, the way some books write it. */
const IN_REALS = /^\{?\s*(?:[xy]\s*\|\s*)?[xy]\s*(?:∈|in)\s*(?:ℝ|R|the\s+reals|all\s+real\s+numbers)\s*\}?$/i

export function readRange(raw: string): { ok: true; set: SolutionSet } | { ok: false; message: string } {
  const t = (raw ?? '').replace(/[−–—]/g, '-').trim()
  if (!t) return { ok: false, message: 'Type your answer first: an interval, like [a, b].' }
  if (/π|pi/i.test(t)) return { ok: false, message: 'A range is a set of heights, y-values: it has no π in it.' }
  const p = parseSetAnswer(IN_REALS.test(t) ? 'all real numbers' : t)
  if (!p.ok) return { ok: false, message: /set-builder box/.test(p.error.message) ? 'Write it in interval notation, like [a, b], or as an inequality in y.' : p.error.message }
  return { ok: true, set: p.set }
}

function gradeIntervalPart(part: TrigPart, raw: string): Part5Grade {
  const c = part.check
  if (c.kind !== 'interval') throw new Error('not an interval part')
  const her = readRange(raw)
  if (!her.ok) return { verdict: 'invalid', message: her.message }
  const target = readRange(c.value)
  if (!target.ok) throw new Error(`${part.id}: the range ${c.value} cannot be read`)
  if (setsEqual(her.set, target.set)) return { verdict: 'correct', message: 'Correct: that is the range.' }
  for (const t of part.traps) {
    const s = readRange(t.text)
    if (s.ok && setsEqual(her.set, s.set) && isTrigMistake(t.id)) return { verdict: 'mistake', mistake: t.id, witness: t.witness }
  }
  return { verdict: 'wrong', message: part.wrongNote }
}

// ---------------------------------------------------------------------------
// Key points, x-values
// ---------------------------------------------------------------------------

function gradePointsPart(part: TrigPart, raw: string): Part5Grade {
  const c = part.check
  if (c.kind !== 'points') throw new Error('not a points part')
  const answer = c.points.map(([x, y]) => ({ x: exact(x), y: exact(y) }))
  const cands: PointsCandidate[] = []
  for (const t of part.traps) {
    if (!isTrigMistake(t.id)) continue
    const r = readPointList(t.text)
    if (r.ok) cands.push({ id: t.id, points: r.points, witness: t.witness })
  }
  return fromCore(part, gradePoints(answer, raw, cands))
}

function gradeFamilyPart(part: TrigPart, raw: string): Part5Grade {
  const c = part.check
  if (c.kind !== 'family') throw new Error('not a family part')
  const a = readXSet(c.answer)
  if (!a.ok) throw new Error(`${part.id}: the answer ${c.answer} cannot be read`)
  const cands: XSetCandidate[] = []
  for (const t of part.traps) {
    if (!isTrigMistake(t.id)) continue
    const r = readXSet(t.text)
    if (r.ok) cands.push({ id: t.id, set: r.set, witness: t.witness })
  }
  return fromCore(part, gradeXSet({ answer: a.set, what: c.what, ...(c.between ? { between: c.between } : {}) }, raw, cands))
}

// ---------------------------------------------------------------------------
// A function, graded as a function
// ---------------------------------------------------------------------------

const parsedCache = new Map<string, ExprNode | null>()

function nodeOf(text: string, variable: string, bare: boolean): ExprNode | null {
  const key = `${variable}|${bare}|${text}`
  if (parsedCache.has(key)) return parsedCache.get(key)!
  const r = readFunctionAnswer(text, { variable, allowBare: true })
  const node = r.ok ? r.node : null
  if (parsedCache.size > 4000) parsedCache.clear()
  parsedCache.set(key, node)
  return node
}

/** The check of a function part as the core takes it. */
export function functionCheckOf(part: TrigPart): { variable: string; exactAt: TrigExact[]; samples: number[] } {
  const c = part.check
  if (c.kind !== 'function') throw new Error('not a function part')
  return { variable: c.variable, exactAt: c.exactAt.map(exact), samples: spreadSamples(c.samples.lo, c.samples.hi, c.samples.n) }
}

function gradeFunctionPart(part: TrigPart, raw: string): Part5Grade {
  const c = part.check
  if (c.kind !== 'function') throw new Error('not a function part')
  const her = readFunctionAnswer(raw, { variable: c.variable, allowBare: c.bare })
  if (!her.ok) return { verdict: 'invalid', message: her.message }
  if (c.algebraic && hasTrigFunction(her.node)) return { verdict: 'invalid', message: 'Write it without trig functions: an algebraic expression in x, like a radical or a fraction.' }
  const answer = nodeOf(c.answer, c.variable, true)
  if (!answer) throw new Error(`${part.id}: the answer ${c.answer} cannot be read`)
  const check = functionCheckOf(part)
  if (sameFunction(her.node, answer, check)) return { verdict: 'correct', message: c.bare ? 'Correct: that is the same function.' : 'Correct: your equation gives this graph.' }
  for (const t of part.traps) {
    const s = nodeOf(t.text, c.variable, true)
    if (s && isTrigMistake(t.id) && sameFunction(her.node, s, check)) return { verdict: 'mistake', mistake: t.id, witness: t.witness }
  }
  if (hasDecimal(her.node) && nearlySameFunction(her.node, answer, check.samples, c.variable)) {
    return { verdict: 'invalid', message: 'That is close, but it has a decimal where an exact number belongs. Use π and fractions, not calculator decimals.' }
  }
  return { verdict: 'wrong', message: part.wrongNote }
}

// ---------------------------------------------------------------------------
// An inverse function's value, or no value
// ---------------------------------------------------------------------------

/** The words the "No value" button enters, and the spellings that mean the same. */
export const NO_VALUE_TEXT = 'no value'

function gradePrincipalPart(part: TrigPart, raw: string): Part5Grade {
  const c = part.check
  if (c.kind !== 'principal') throw new Error('not a principal part')
  const read = readTrigAnswer(raw)
  if (read.ok && read.kind === 'undefined') {
    if (c.deg === null) return { verdict: 'correct', message: 'Correct: there is no such angle.' }
    return { verdict: 'wrong', message: 'This one has a value: there is an angle in the range with that input.' }
  }
  if (c.deg === null) {
    if (!read.ok) return { verdict: 'invalid', message: read.message }
    // Any number here is a value given where there is none: the trap's id names it, whatever the number.
    const trap = part.traps.find((t) => isTrigMistake(t.id))
    if (trap && isTrigMistake(trap.id)) return { verdict: 'mistake', mistake: trap.id, witness: trap.witness }
    return { verdict: 'wrong', message: part.wrongNote }
  }
  const [n, d] = c.deg.split('/')
  const deg = q(Number(n), d ? Number(d) : 1)
  const cands: TrigCandidate[] = []
  for (const t of part.traps) {
    if (!isTrigMistake(t.id)) continue
    const v = readExact(t.text)
    if (v !== null && v !== 'undefined') cands.push({ id: t.id, value: v, witness: t.witness })
  }
  const g = gradeTrigAnswer({ kind: 'angle', unit: c.unit, deg }, raw, cands)
  // The angle she gives in the other unit is a note, never a mistake (gradeTrigAnswer's wrong_unit).
  return fromCore(part, g)
}

/** Grade one Unit 5 part. */
export function gradeUnit5Part(part: TrigPart, raw: string): Part5Grade {
  switch (part.kind) {
    case 'shift':
      return gradeShiftPart(part, raw)
    case 'midline':
      return gradeMidlinePart(part, raw)
    case 'interval':
      return gradeIntervalPart(part, raw)
    case 'points':
      return gradePointsPart(part, raw)
    case 'function':
      return gradeFunctionPart(part, raw)
    case 'family':
      return gradeFamilyPart(part, raw)
    case 'principal':
      return gradePrincipalPart(part, raw)
    default:
      throw new Error(`${part.kind} is not a Unit 5 part`)
  }
}

/** KaTeX of what she typed, for the "reads as" preview of a Unit 5 part; '' when it cannot be read. */
export function unit5PreviewTex(part: TrigPart, value: string): string {
  if (!value.trim()) return ''
  const c = part.check
  switch (c.kind) {
    case 'shift': {
      const r = readShift(value)
      return r.ok ? r.tex : ''
    }
    case 'midline': {
      const r = readMidline(value)
      return r.ok ? r.tex : ''
    }
    case 'points': {
      const r = readPointList(value)
      return r.ok ? r.tex : ''
    }
    case 'function': {
      const r = readFunctionAnswer(value, { variable: c.variable, allowBare: c.bare })
      return r.ok ? r.tex : ''
    }
    case 'family': {
      const r = readXSet(value)
      return r.ok ? r.tex : ''
    }
    case 'principal': {
      const r = readTrigAnswer(value)
      return r.ok ? r.tex : ''
    }
    default:
      return ''
  }
}

/** An exact angle in degrees as the value she would type in the unit asked ("−π/3", "−60"). */
export function principalText(deg: number, unit: 'deg' | 'rad'): TrigExact {
  return angleIn(q(deg), unit)
}

/** The size of a phase shift, for the leak checks: a text showing "π/4" shows a shift of π/4 left or right. */
export function shiftSize(value: string): TrigExact {
  const v = exact(value)
  return exactNum(v) < 0 ? exactNeg(v) : v
}
