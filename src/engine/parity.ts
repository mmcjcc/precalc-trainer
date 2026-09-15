import { evalNode, nearlyEqual } from './math'
import { parseExpression } from './parse'

export type Parity = 'even' | 'odd' | 'neither'
export type ParityReason = 'domain_asymmetric' | 'values'

export type ParityTableRow = {
  k: number
  fk: number | 'undef'
  fNegK: number | 'undef'
  negFk: number | 'undef'
}

export type ParityResult = {
  verdict: Parity
  reason: ParityReason
  table: ParityTableRow[]
}

const SAMPLE_X = [-8, -5, -4, -3, -2, -1, -0.5, 0.5, 1, 2, 3, 4, 5, 8]

/** Domain-symmetry first, then f(−x) vs ±f(x) at defined pairs. */
export function checkParity(f: string, extraK: number[] = []): ParityResult {
  const parsed = parseExpression(f, ['x'])
  if (!parsed.ok) {
    return { verdict: 'neither', reason: 'values', table: [] }
  }
  const node = parsed.node
  const xs = [...new Set([...SAMPLE_X, ...extraK, ...extraK.map((k) => -k)])]
  const table: ParityTableRow[] = []
  let domainAsym = false
  let evenOk = true
  let oddOk = true
  let compared = 0
  for (const k of xs) {
    const fk = evalNode(node, { x: k })
    const fNegK = evalNode(node, { x: -k })
    const negFk: number | 'undef' = fk === 'undef' ? 'undef' : -fk
    if (Math.abs(k) <= 8 && Number.isInteger(k) && k !== 0) {
      table.push({ k, fk, fNegK, negFk })
    }
    if (fk === 'undef' && fNegK === 'undef') continue
    if (fk === 'undef' || fNegK === 'undef') {
      domainAsym = true
      continue
    }
    compared++
    if (!nearlyEqual(fNegK, fk)) evenOk = false
    if (!nearlyEqual(fNegK, -fk)) oddOk = false
  }
  if (domainAsym) return { verdict: 'neither', reason: 'domain_asymmetric', table }
  if (compared < 4) return { verdict: 'neither', reason: 'values', table }
  if (evenOk) return { verdict: 'even', reason: 'values', table }
  if (oddOk) return { verdict: 'odd', reason: 'values', table }
  return { verdict: 'neither', reason: 'values', table }
}

export function evalExpr(text: string, scope: Record<string, number>): number | 'undef' {
  const p = parseExpression(text, Object.keys(scope))
  if (!p.ok) return 'undef'
  return evalNode(p.node, scope)
}

/** Table row of the public contract (BUILD_GUIDE §4). */
export type ParityRow = { k: number; fk: number | 'undef'; fNegK: number | 'undef' }

/**
 * Contract form: `(f, seed?)`. Same test as `checkParity`, with four seeded sample points added to
 * the fixed set; the table lists the friendly integer inputs 1..8 and their negatives.
 */
export function checkParitySeeded(
  f: string,
  seed = 0x9e3779b9,
): { verdict: Parity; reason: ParityReason; table: ParityRow[] } {
  let a = seed >>> 0
  const rand = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const extra: number[] = []
  for (let i = 0; i < 4; i++) extra.push(Math.round((rand() * 18 + 1) * 100) / 100)
  const r = checkParity(f, extra)
  return { verdict: r.verdict, reason: r.reason, table: r.table.map(({ k, fk, fNegK }) => ({ k, fk, fNegK })) }
}
