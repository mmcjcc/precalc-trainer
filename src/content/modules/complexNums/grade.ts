/**
 * Grades one complex-number answer. A named mistake is whatever that slip produces for THIS
 * problem, compared exactly. A candidate equal to the right answer is never used, and when two
 * slips produce the same answer the earlier one keeps it.
 */
import { rat, ratAdd, ratDiv, ratMul, ratNeg, ratSub, ratToString } from '@/notation'
import {
  CxSkip,
  cx,
  cxConj,
  cxDiv,
  cxIPower,
  cxIsZero,
  cxMul,
  cxMulFoilDropped,
  cxMulI2Positive,
  cxNeg,
  cxSqrt,
  formatCx,
  formatCxList,
  formatPair,
  sameCxList,
  show,
  showCx,
  type Cx,
} from './arith'
import { parseCxAnswer } from './parse'

export const CX_MISTAKE_IDS = [
  'cx_i_squared_positive',
  'cx_foil_dropped',
  'cx_conjugate_wrong',
  'cx_not_simplified',
  'cx_power_cycle',
  'cx_sqrt_product',
  'cx_sqrt_negative_sign',
  'cx_discriminant_sign',
  'cx_conjugate_missing',
  'cx_half_formula',
] as const

export type CxMistakeId = (typeof CX_MISTAKE_IDS)[number]

export type CxStageId = 'answer'

export type CxGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'mistake'; mistake: CxMistakeId; witness: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string }

export interface CxTrap {
  id: CxMistakeId
  stage: CxStageId
  text: string
  values: Cx[]
}

export type CxKind = 'arith' | 'divide' | 'powers' | 'quadratic' | 'zeros'

export type CxOp = '+' | '-' | '*'

export type CxPowerKind = 'power' | 'sqrt' | 'product'

export interface CxModel {
  kind: CxKind
  /** Canonical values (one, or a list of zeros / both quadratic roots). */
  values: Cx[]
  expression: string
  f: string
  givenZero: string
  op?: CxOp
  z1?: Cx
  z2?: Cx
  powerN?: number
  powerKind?: CxPowerKind
  radicand?: number
  radicandB?: number
  quadA?: number
  quadB?: number
  quadC?: number
  given?: Cx
  reals?: Cx[]
}

function correct(message: string): CxGrade {
  return { verdict: 'correct', message }
}

function mistake(id: CxMistakeId, witness: string): CxGrade {
  return { verdict: 'mistake', mistake: id, witness: witness.trim() }
}

function wrong(message: string): CxGrade {
  return { verdict: 'wrong', message: message.trim() }
}

function invalid(message: string): CxGrade {
  return { verdict: 'invalid', message }
}

function addTrap(out: CxTrap[], id: CxMistakeId, values: Cx[], text: string, right: readonly Cx[]): void {
  if (sameCxList(values, right)) return
  if (out.some((t) => sameCxList(t.values, values))) return
  out.push({ id, stage: 'answer', text, values })
}

/**
 * Feedback she can still act on never states the answer: the last hint rung and the finished problem do.
 * Kept as a function so every message ends the same way if that changes.
 */
function rightLine(_p: CxModel): string {
  return ''
}

export function arithTraps(p: CxModel): CxTrap[] {
  if (p.kind !== 'arith' || !p.z1 || !p.z2 || !p.op) return []
  const right = p.values
  const out: CxTrap[] = []
  if (p.op === '*') {
    const i2 = cxMulI2Positive(p.z1, p.z2)
    addTrap(
      out,
      'cx_i_squared_positive',
      [i2],
      formatCx(i2),
      right,
    )
    const foil = cxMulFoilDropped(p.z1, p.z2)
    addTrap(out, 'cx_foil_dropped', [foil], formatCx(foil), right)
  }
  return out
}

export function divideTraps(p: CxModel): CxTrap[] {
  if (p.kind !== 'divide' || !p.z1 || !p.z2) return []
  const right = p.values
  const out: CxTrap[] = []
  const den = p.z2
  const mod = cxMul(den, cxConj(den))
  if (!cxIsZero(mod) && mod.reRad === 1 && mod.im.n === 0) {
    const onlyDen = cxDiv(p.z1, cx(mod.re, 0))
    addTrap(
      out,
      'cx_conjugate_wrong',
      [onlyDen],
      formatCx(onlyDen),
      right,
    )
    const wrongNum = cxMul(p.z1, den)
    const wrongConj = cxDiv(wrongNum, cx(mod.re, 0))
    addTrap(
      out,
      'cx_conjugate_wrong',
      [wrongConj],
      formatCx(wrongConj),
      right,
    )
  }
  return out
}

export function powerTraps(p: CxModel): CxTrap[] {
  if (p.kind !== 'powers') return []
  const right = p.values
  const out: CxTrap[] = []
  if (p.powerKind === 'power' && p.powerN !== undefined) {
    const n = p.powerN
    const r = ((n % 4) + 4) % 4
    for (const off of [1, 2, 3]) {
      const slip = cxIPower(r + off)
      addTrap(out, 'cx_power_cycle', [slip], formatCx(slip), right)
    }
    if (n < 0) {
      const asPos = cxIPower(-n)
      addTrap(out, 'cx_power_cycle', [asPos], formatCx(asPos), right)
    }
  }
  if (p.powerKind === 'sqrt' && p.radicand !== undefined) {
    const k = p.radicand
    const pos = cxSqrt(cx(k))
    addTrap(out, 'cx_sqrt_negative_sign', [pos], formatCx(pos), right)
    addTrap(out, 'cx_sqrt_negative_sign', [cxNeg(pos)], formatCx(cxNeg(pos)), right)
  }
  if (p.powerKind === 'product' && p.radicand !== undefined && p.radicandB !== undefined) {
    const pos = cxSqrt(cx(p.radicand * p.radicandB))
    addTrap(out, 'cx_sqrt_product', [pos], formatCx(pos), right)
  }
  return out
}

export function quadraticTraps(p: CxModel): CxTrap[] {
  if (p.kind !== 'quadratic' || p.quadA === undefined || p.quadB === undefined || p.quadC === undefined) return []
  const a = p.quadA
  const b = p.quadB
  const c = p.quadC
  const right = p.values
  const out: CxTrap[] = []
  const d = b * b - 4 * a * c
  if (d >= 0) return out
  const absD = -d
  const k = Math.round(Math.sqrt(absD))
  if (k * k !== absD) return out
  const twoA = 2 * a
  if (twoA === 0) return out

  const real1 = ratDiv(ratAdd(ratNeg(rat(b)), rat(k)), rat(twoA))
  const real2 = ratDiv(ratSub(ratNeg(rat(b)), rat(k)), rat(twoA))
  addTrap(
    out,
    'cx_discriminant_sign',
    [cx(real1), cx(real2)],
    formatPair([cx(real1), cx(real2)]),
    right,
  )

  if (Math.abs(twoA) !== 1) {
    const half1 = cx(ratNeg(rat(b)), ratDiv(rat(k), rat(twoA)))
    const half2 = cx(ratNeg(rat(b)), ratNeg(ratDiv(rat(k), rat(twoA))))
    addTrap(out, 'cx_half_formula', [half1, half2], formatPair([half1, half2]), right)
  }
  return out
}

export function zerosTraps(p: CxModel): CxTrap[] {
  if (p.kind !== 'zeros' || !p.given || !p.reals) return []
  const right = p.values
  const out: CxTrap[] = []
  const missing = [...p.reals, p.given]
  addTrap(out, 'cx_conjugate_missing', missing, formatCxList(missing), right)
  return out
}

export function trapsFor(p: CxModel): CxTrap[] {
  if (p.kind === 'arith') return arithTraps(p)
  if (p.kind === 'divide') return divideTraps(p)
  if (p.kind === 'powers') return powerTraps(p)
  if (p.kind === 'quadratic') return quadraticTraps(p)
  return zerosTraps(p)
}

function matchesTrap(parsed: Cx[], trap: CxTrap): boolean {
  return sameCxList(parsed, trap.values)
}

const NOT_SIMPLIFIED =
  'That matches the value, but it is not in a + bi form yet. Clear i² and any i in a denominator, then try again. This doesn’t count as an attempt.'

export function gradeModel(p: CxModel, text: string): CxGrade {
  let parsed
  try {
    parsed = parseCxAnswer(text)
  } catch (e) {
    if (e instanceof CxSkip || e instanceof RangeError) return invalid('This answer could not be checked exactly.')
    throw e
  }
  if (!parsed.ok) return invalid(parsed.message)
  const right = p.values
  if (sameCxList(parsed.values, right)) {
    if (!parsed.simplified) return invalid(NOT_SIMPLIFIED)
    return correct(`Correct: ${show(formatPair(right))}.`)
  }
  const pool = trapsFor(p)
  for (const trap of pool) {
    if (matchesTrap(parsed.values, trap)) {
      return mistake(trap.id, witnessFor(p, trap))
    }
  }
  if (p.kind === 'quadratic' || p.kind === 'zeros') {
    return wrong(`Those are not the ${p.kind === 'zeros' ? 'zeros' : 'solutions'}. ${rightLine(p)}`)
  }
  return wrong(`That is not equal to ${show(p.expression)}. ${rightLine(p)}`)
}

function witnessFor(p: CxModel, trap: CxTrap): string {
  const right = rightLine(p)
  const hers = show(trap.text)
  switch (trap.id) {
    case 'cx_i_squared_positive': {
      const z1 = p.z1!
      const z2 = p.z2!
      const bd = ratMul(z1.im, z2.im)
      const ac = ratMul(z1.re, z2.re)
      const wrongRe = ratAdd(ac, bd)
      const rightRe = ratSub(ac, bd)
      return `i² is −1, so the real part of ${show(p.expression)} is ${show(ratToString(rightRe))}, not ${show(ratToString(wrongRe))}. ${hers} uses i² as +1. ${right}`
    }
    case 'cx_foil_dropped':
      return `(${showCx(p.z1!)})(${showCx(p.z2!)}) has four terms. Keeping only the first and last leaves ${hers} and drops the imaginary part. ${right}`
    case 'cx_conjugate_wrong':
      return `To divide, multiply the top and the bottom by the conjugate of ${showCx(p.z2!)} — that is ${showCx(cxConj(p.z2!))}, and both pieces need it. ${hers} is what the wrong conjugate (or only the denominator) produces. ${right}`
    case 'cx_not_simplified':
      return NOT_SIMPLIFIED
    case 'cx_power_cycle':
      if (p.powerN !== undefined && p.powerN < 0) {
        return `i^(${p.powerN}) follows the cycle of 4; a negative power is the reciprocal, not i^${-p.powerN}. ${hers} is one step off that cycle. ${right}`
      }
      return `Powers of i repeat every four: i, −1, −i, 1. ${hers} is one step off that cycle: divide the power by 4 and use the remainder. ${right}`
    case 'cx_sqrt_product':
      return `√(−${p.radicand}) · √(−${p.radicandB}) = i√${p.radicand} · i√${p.radicandB} = i² √${(p.radicand ?? 0) * (p.radicandB ?? 0)} = −√${(p.radicand ?? 0) * (p.radicandB ?? 0)}. Taking √(ab) drops the minus sign and gives ${hers}. ${right}`
    case 'cx_sqrt_negative_sign':
      return `√(−${p.radicand}) = i√${p.radicand}. ${hers} is real — the i is missing (or the sign was flipped to make it real). ${right}`
    case 'cx_discriminant_sign':
      return `The discriminant of ${show(p.expression.replace(/\s*=\s*0$/, ''))} is negative, so the roots are complex. ${hers} treats it as positive and invents two real roots. ${right}`
    case 'cx_conjugate_missing':
      return `${show(p.givenZero)} is a zero of a polynomial with real coefficients, so ${showCx(cxConj(p.given!))} is a zero too. ${hers} leaves that conjugate out. ${right}`
    case 'cx_half_formula':
      return `The quadratic formula divides −b and the square root by 2a, not only the square root. ${hers} left −b undivided. ${right}`
  }
}

export function expectedText(p: CxModel): string {
  return formatPair(p.values)
}
