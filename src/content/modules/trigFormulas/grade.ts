/**
 * Graders for Unit 6 part 2.
 *
 * Single-term exact answers (a fraction, a radical like 2√5/5, a radian) go through the house grader
 * (`gradeTrigPart` / `gradeAngleList`) after this file has claimed a ta_ / te_ trap. Those ids are not
 * trig mistakes, so the house grader would drop them.
 *
 * Sums of unlike radicals — (√6 − √2)/4, 2 − √3, √6 + √2 — are not a single TrigExact. `readExact` returns
 * null and `specOf` would throw, and `gradeValue` rejects a matching sum as "not one number yet".
 * Those parts are graded here: the same reader, numerically, and a sum is allowed only when the stored
 * answer is itself a sum. Any other form issue (a radical in the denominator, a perfect square) is still rejected.
 */
import type { TrigPart, TrigPartTrap } from '@/content/types'
import { formNote, readAngleList, readExact, readTrigAnswer, type TrigNumberRead } from '@/engine/trig'
import type { ErrorPatternId } from '@/shared/types'
import { gradeTrigPart, type TrigPartGrade } from '../trig/parts'

export const TOL = 1e-9

export function close(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  return Math.abs(a - b) <= TOL * Math.max(1, Math.abs(a), Math.abs(b))
}

export function readNumber(raw: string): TrigNumberRead | null {
  const r = readTrigAnswer(raw)
  if (!r.ok || r.kind !== 'number') return null
  return r
}

function targetOf(part: TrigPart): number {
  const raw = part.check.kind === 'value' ? part.check.value : part.answerText
  const r = readNumber(raw)
  if (!r) throw new Error(`${part.id}: the answer ${raw} cannot be read`)
  return r.approx
}

/** The stored value is a sum of unlike terms, so the house grader cannot hold it. */
export function isSumAnswer(part: TrigPart): boolean {
  const raw = part.check.kind === 'value' ? part.check.value : part.answerText
  return readExact(raw) === null
}

function trapHit(part: TrigPart, hers: number, target: number): TrigPartTrap | null {
  for (const t of part.traps) {
    const r = readNumber(t.text)
    if (!r) continue
    if (close(r.approx, hers) && !close(r.approx, target)) return t
  }
  return null
}

function named(t: TrigPartTrap): TrigPartGrade {
  return { verdict: 'mistake', mistake: t.id, witness: t.witness }
}

function formProblem(read: TrigNumberRead, allowSum: boolean): string | null {
  if (read.decimal) return 'That is a calculator decimal. This part asks for the exact value: a whole number, a fraction or a radical.'
  if (read.degrees) return 'This answer is a number, not an angle: leave off the degree sign.'
  if (!read.issue) return null
  if (read.issue === 'sum' && allowSum) return null
  return formNote(read.issue)
}

/** A typed exact value: house grader for one term, numeric reader for a sum of radicals. */
export function gradeExactValue(part: TrigPart, raw: string): TrigPartGrade {
  const read = readTrigAnswer(raw)
  if (!read.ok) return { verdict: 'invalid', message: read.message }
  if (read.kind !== 'number') return { verdict: 'invalid', message: 'Type the exact value, not a word.' }
  const allowSum = isSumAnswer(part)
  const target = targetOf(part)
  const trap = trapHit(part, read.approx, target)
  if (trap) return named(trap)
  if (allowSum) {
    const problem = formProblem(read, true)
    if (problem) return { verdict: 'invalid', message: problem }
    if (close(read.approx, target)) return { verdict: 'correct', message: 'Correct.' }
    return { verdict: 'wrong', message: part.wrongNote }
  }
  return gradeTrigPart(part, raw)
}

const FN_LINE = /^(sin|cos|tan|csc|sec|cot)\s*\(?\s*x\s*\)?$/i

/** "sin x = 1/2" or "1/2 = sin x". The function has to be the one in the equation. */
export function gradeIsolate(part: TrigPart, raw: string): TrigPartGrade {
  if (part.check.kind !== 'value' || !part.check.fn) throw new Error(`${part.id}: an isolate part needs a value and a function`)
  const text = raw.trim()
  if (!text) return { verdict: 'invalid', message: 'Type your answer first.' }
  const bits = text.split('=')
  if (bits.length !== 2) return { verdict: 'invalid', message: 'Write an equation with one equals sign: the function, =, and the value.' }
  const left = bits[0]!.trim()
  const right = bits[1]!.trim()
  const leftFn = FN_LINE.exec(left)
  const rightFn = FN_LINE.exec(right)
  const fn = (leftFn?.[1] ?? rightFn?.[1])?.toLowerCase()
  const body = leftFn ? right : rightFn ? left : ''
  if (!fn || !body) return { verdict: 'invalid', message: 'Name the function, as in sin x = …' }
  const read = readNumber(body)
  if (!read) {
    const again = readTrigAnswer(body)
    return { verdict: 'invalid', message: again.ok ? 'Type the value as an exact number.' : again.message }
  }
  if (fn !== part.check.fn) return { verdict: 'wrong', message: part.wrongNote }
  const target = targetOf(part)
  for (const t of part.traps) {
    const parsed = parseIsolate(t.text)
    if (!parsed || parsed.fn !== fn) continue
    const tv = readNumber(parsed.body)
    if (tv && close(tv.approx, read.approx) && !close(tv.approx, target)) return named(t)
  }
  const problem = formProblem(read, false)
  if (problem) return { verdict: 'invalid', message: problem }
  if (close(read.approx, target)) return { verdict: 'correct', message: 'Correct.' }
  return { verdict: 'wrong', message: part.wrongNote }
}

function parseIsolate(text: string): { fn: string; body: string } | null {
  const bits = text.split('=')
  if (bits.length !== 2) return null
  const left = bits[0]!.trim()
  const right = bits[1]!.trim()
  const leftFn = FN_LINE.exec(left)
  const rightFn = FN_LINE.exec(right)
  if (leftFn) return { fn: leftFn[1]!.toLowerCase(), body: right }
  if (rightFn) return { fn: rightFn[1]!.toLowerCase(), body: left }
  return null
}

/** "30" or "30°" on a radian reference angle: degrees slipped into a radian answer. */
export function gradeReference(part: TrigPart, raw: string): TrigPartGrade {
  const trap = part.traps.find((t) => t.id === 'te_deg_rad')
  const trimmed = raw.trim()
  const bare = trimmed.replace(/°/g, '').replace(/\s*(?:degrees|degree|deg)\.?$/i, '').trim()
  if (trap && (bare === trap.text || trimmed === trap.text || trimmed === `${trap.text}°`)) return named(trap)
  const read = readTrigAnswer(raw)
  if (trap && read.ok && read.kind === 'number' && read.degrees && close(read.approx, Number(trap.text))) return named(trap)
  return gradeTrigPart(part, raw)
}

function degOf(text: string): number {
  const [n, d] = text.split('/')
  return Number(n) / (d ? Number(d) : 1)
}

const DEG_TOL = 1e-4

export function sameDegrees(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false
  const s = [...a].sort((x, y) => x - y)
  const t = [...b].sort((x, y) => x - y)
  return s.every((v, i) => Math.abs(v - t[i]!) < DEG_TOL)
}

/** Radians in, degrees out. A degree sign or a decimal is refused. */
export function radianListDegrees(raw: string): { ok: true; degs: number[] } | { ok: false; message: string } {
  const read = readAngleList(raw)
  if (!read.ok) return read
  for (const item of read.items) {
    if (item.degrees) return { ok: false, message: 'These angles are in radians, not degrees.' }
    if (item.decimal) return { ok: false, message: 'Give exact angles, not decimals.' }
    if (item.issue) return { ok: false, message: formNote(item.issue) }
    if (!item.hasPi && Math.abs(item.approx) > 1e-9) return { ok: false, message: 'In radians each angle is a multiple of π (0 is allowed).' }
  }
  const degs = read.items.map((item) => (item.approx * 180) / Math.PI)
  if (new Set(degs.map((d) => Math.round(d * 1e6))).size !== degs.length) {
    return { ok: false, message: 'You listed an angle twice.' }
  }
  return { ok: true, degs }
}

function trapDegrees(text: string): number[] | null {
  const read = radianListDegrees(text)
  return read.ok ? read.degs : null
}

function listKey(degs: readonly number[]): string {
  return [...degs].sort((a, b) => a - b).map((d) => d.toFixed(4)).join(',')
}

/**
 * A list of radian solutions. `union` is the combined set of a factored equation: those angles do not all
 * satisfy one function, so the house list grader (which checks one value) must not see them.
 */
export function gradeRadianList(part: TrigPart, raw: string, union: boolean): TrigPartGrade {
  if (part.check.kind !== 'angles') throw new Error(`${part.id}: not a list`)
  const read = radianListDegrees(raw)
  if (!read.ok) return { verdict: 'invalid', message: read.message }
  const answer = part.check.degs.map(degOf)
  for (const t of part.traps) {
    const degs = trapDegrees(t.text)
    if (degs && sameDegrees(degs, read.degs) && !sameDegrees(degs, answer)) {
      return { verdict: 'mistake', mistake: t.id, witness: t.witness, key: listKey(read.degs) }
    }
  }
  if (sameDegrees(read.degs, answer)) return { verdict: 'correct', message: 'Correct.', key: listKey(read.degs) }
  if (union) return { verdict: 'wrong', message: part.wrongNote, key: listKey(read.degs) }
  const house = gradeTrigPart(part, raw)
  if (house.verdict === 'correct') return { verdict: 'correct', message: house.message, key: listKey(read.degs) }
  return house
}

export function gradeChoice(part: TrigPart, raw: string): TrigPartGrade {
  return gradeTrigPart(part, raw)
}

/** Every trap on the part grades as its own id, and none of them is the right answer. */
export function assertTraps(part: TrigPart, grade: (text: string) => TrigPartGrade): void {
  const right = grade(part.answerText)
  if (right.verdict !== 'correct') throw new Error(`${part.id}: answer ${part.answerText} graded ${right.verdict}${'message' in right ? ` (${right.message})` : ''}`)
  for (const form of part.forms) {
    const g = grade(form)
    if (g.verdict !== 'correct') throw new Error(`${part.id}: form ${form} graded ${g.verdict}${'message' in g ? ` (${g.message})` : ''}`)
  }
  for (const t of part.traps) {
    const g = grade(t.text)
    if (g.verdict !== 'mistake' || g.mistake !== t.id) {
      throw new Error(`${part.id}: trap ${t.id} text ${t.text} graded ${g.verdict}${'mistake' in g ? ` (${g.mistake})` : ''}`)
    }
  }
}

export function mistake(id: ErrorPatternId, text: string, witness: string): TrigPartTrap {
  return { id, text, witness }
}
