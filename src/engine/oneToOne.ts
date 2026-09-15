/**
 * One-to-one test for a function of x: sampled outputs plus a root-finding pass that looks for a
 * second input with the same output (the horizontal-line test, numerically). Returns the nicest
 * witness pair (integers first, then small magnitude).
 */
import { evalNode, nearlyEqual } from './math'
import { parseExpression } from './parse'
import { findRootsOf, GRID_N_SLICE } from './roots'
import { DEFAULT_SEED, mulberry32, nicenessRank, snapNumber } from './samples'

export interface OneToOneResult {
  oneToOne: boolean
  /** Two different inputs with the same output, e.g. { a: -2, b: 2, y: 4 }. */
  witness?: { a: number; b: number; y: number }
}

const INTEGER_XS = [-8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8]
const HALF_XS = [-7.5, -5.5, -3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5, 5.5, 7.5]

function witnessKey(a: number, b: number): [number, number] {
  return [nicenessRank(a) + nicenessRank(b), Math.abs(a) + Math.abs(b)]
}

export function isOneToOne(f: string, seed = DEFAULT_SEED): OneToOneResult {
  const parsed = parseExpression(f, ['x'])
  if (!parsed.ok) return { oneToOne: true }
  const node = parsed.node
  const rand = mulberry32(seed ^ 0x1b873593)
  const xs = [...INTEGER_XS, ...HALF_XS]
  for (let i = 0; i < 6; i++) xs.push(Math.round((rand() * 20 - 10) * 100) / 100)

  const pts: { x: number; y: number }[] = []
  for (const x of xs) {
    const y = evalNode(node, { x })
    if (y !== 'undef') pts.push({ x, y })
  }
  let best: { a: number; b: number; y: number } | undefined
  let bestKey: [number, number] = [Infinity, Infinity]
  const consider = (a: number, b: number, y: number) => {
    if (Math.abs(a - b) < 1e-6) return
    const key = witnessKey(a, b)
    if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
      best = a < b ? { a, b, y } : { a: b, b: a, y }
      bestKey = key
    }
  }
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const p = pts[i]!
      const q = pts[j]!
      if (nearlyEqual(p.y, q.y, Math.max(Math.abs(p.y), Math.abs(q.y)))) consider(p.x, q.x, p.y)
    }
  }
  if (best) return { oneToOne: false, witness: snapWitness(best) }

  // Root-finding pass: does f(x) = f(a) have a second solution for a few friendly a values?
  for (const a of [0, 1, -1, 2, -2, 3, -3]) {
    const fa = evalNode(node, { x: a })
    if (fa === 'undef') continue
    const { roots } = findRootsOf((t) => {
      const v = evalNode(node, { x: t })
      if (v === 'undef') return 'undef'
      return { g: v - fa, scale: Math.max(1, Math.abs(v), Math.abs(fa)) }
    }, GRID_N_SLICE)
    for (const r of roots) consider(a, r, fa)
    if (best) return { oneToOne: false, witness: snapWitness(best) }
  }
  return { oneToOne: true }
}

function snapWitness(w: { a: number; b: number; y: number }): { a: number; b: number; y: number } {
  return { a: snapNumber(w.a), b: snapNumber(w.b), y: snapNumber(w.y) }
}
