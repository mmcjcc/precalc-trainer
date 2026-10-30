/**
 * Wrong next lines named mistakes turn a relation into, for Guided mode's cards. Additive: nothing here
 * grades. Each candidate is kept only when the module's checker names it as exactly that mistake
 * (`buildLineCards` in lineCards.ts).
 *
 * Inequalities: flip, swap without reversing, term across the sign, divide by the x-coefficient the
 * wrong way. Inverses: the same, plus renaming only one of x/y (`swap_misname`).
 */
import { evaluateExpr, niceNumber, parseStatement } from '@/engine'
import { reverseRelOp, singleRelation } from '@/engine/parse'
import type { RelOp } from '@/shared/types'
import type { CardCandidate } from './lineCards'

const squash = (text: string) => text.replace(/\s+/g, '')

function join(lhs: string, op: RelOp, rhs: string): string {
  return `${lhs} ${op} ${rhs}`
}

function num(n: number): string {
  return niceNumber(n)
}

/** Linear coefficient of a letter, or null when the side is not a·letter + b. */
function letterCoefficient(text: string, letter: 'x' | 'y'): number | null {
  const z = { x: 0, y: 0 }
  const at0 = evaluateExpr(text, z)
  const at1 = evaluateExpr(text, { ...z, [letter]: 1 })
  const at2 = evaluateExpr(text, { ...z, [letter]: 2 })
  if (at0 === 'undef' || at1 === 'undef' || at2 === 'undef') return null
  const c = at1 - at0
  if (!Number.isFinite(c) || Math.abs(c) < 1e-9) return null
  if (Math.abs(at2 - (2 * c + at0)) > 1e-6 * Math.max(1, Math.abs(at2))) return null
  return c
}

/** Trailing ± constant on a side, for "term across the sign". */
function splitConstant(src: string): { rest: string; sign: 1 | -1; value: number } | null {
  const m = src.trim().match(/^(.*?)(?:\s*([+-])\s*)(\d+(?:\/\d+)?|\d*\.\d+)\s*$/)
  if (!m || !m[1]!.trim()) return null
  const raw = m[3]!
  const value = raw.includes('/') ? Number(raw.split('/')[0]) / Number(raw.split('/')[1]) : Number(raw)
  if (!Number.isFinite(value) || value === 0) return null
  return { rest: m[1]!.trim(), sign: m[2] === '-' ? -1 : 1, value }
}

function asNumber(src: string): number | null {
  const t = src.trim()
  if (!/^-?\d+(?:\/\d+)?$/.test(t)) return null
  if (t.includes('/')) {
    const [a, b] = t.split('/')
    const v = Number(a) / Number(b)
    return Number.isFinite(v) ? v : null
  }
  const v = Number(t)
  return Number.isFinite(v) ? v : null
}

export function stepLineSlips(line: string, vars: readonly string[] = ['x']): CardCandidate[] {
  const parsed = parseStatement(line, vars)
  if (!parsed.ok) return []
  const out: CardCandidate[] = []
  const seen = new Set<string>()
  const add = (id: string, text: string) => {
    const key = squash(text)
    if (!key || seen.has(key) || key === squash(line)) return
    seen.add(key)
    out.push({ id, text })
  }

  const r = singleRelation(parsed.statement)
  if (!r) return out
  const ineq = r.op !== '='

  if (ineq) {
    add('no_sign_flip', join(r.lhsSrc, reverseRelOp(r.op), r.rhsSrc))
    add('swap_sides_no_reverse', join(r.rhsSrc, r.op, r.lhsSrc))
    add('no_sign_flip', join(`-(${r.lhsSrc})`, r.op, `-(${r.rhsSrc})`))
  }

  const leftC = splitConstant(r.lhsSrc)
  const rightN = asNumber(r.rhsSrc)
  if (leftC && rightN != null) {
    add('term_across_sign', join(leftC.rest, r.op, `${r.rhsSrc} ${leftC.sign > 0 ? '+' : '-'} ${num(leftC.value)}`))
    if (ineq) {
      const moved = rightN - leftC.sign * leftC.value
      add('flip_on_add', join(leftC.rest, reverseRelOp(r.op), num(moved)))
    }
  }
  const rightC = splitConstant(r.rhsSrc)
  if (rightC) {
    add('term_across_sign', join(`${r.lhsSrc} ${rightC.sign > 0 ? '+' : '-'} ${num(rightC.value)}`, r.op, rightC.rest))
    if (ineq) {
      const leftN = asNumber(r.lhsSrc)
      if (leftN != null) {
        const moved = leftN - rightC.sign * rightC.value
        add('flip_on_add', join(num(moved), reverseRelOp(r.op), rightC.rest))
      }
    }
  }

  const coef = letterCoefficient(r.lhsSrc, 'x') ?? letterCoefficient(r.rhsSrc, 'x') ?? letterCoefficient(r.lhsSrc, 'y') ?? letterCoefficient(r.rhsSrc, 'y')
  if (coef != null && Math.abs(Math.abs(coef) - 1) > 1e-9) {
    const k = num(coef)
    const lhs = `(${r.lhsSrc})/${k}`
    const rhs = `(${r.rhsSrc})/${k}`
    if (ineq) {
      if (coef < 0) add('no_sign_flip', join(lhs, r.op, rhs))
      else add('flip_on_positive', join(lhs, reverseRelOp(r.op), rhs))
    }
    // Reciprocal applied to one side only, or multiplied by the coefficient again.
    add('reciprocal_coeff', join(r.lhsSrc, r.op, `(${r.rhsSrc})/${k}`))
    add('reciprocal_coeff', join(`(${r.lhsSrc})*${k}`, r.op, r.rhsSrc))
  }

  if (vars.includes('x') && vars.includes('y')) {
    const onlyX = line.replace(/(?<![A-Za-z])y(?![A-Za-z])/g, 'x')
    const onlyY = line.replace(/(?<![A-Za-z])x(?![A-Za-z])/g, 'y')
    add('swap_misname', onlyX)
    add('swap_misname', onlyY)
  }

  return out
}
