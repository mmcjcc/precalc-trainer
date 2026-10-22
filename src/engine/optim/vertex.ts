/**
 * The vertex of the final equation q(t) = a·t² + b·t + c, exactly, and the numbers the vertex-formula slips give for
 * it: a and b swapped (−a/(2b)), the minus sign dropped (b/(2a)), the 2 dropped (−b/a). Exact rationals throughout.
 */
import { q, qAdd, qDiv, qMul, qNeg, type Q } from '../trig/rational'

/** a·t² + b·t + c with exact coefficients. */
export interface Quadratic {
  a: Q
  b: Q
  c: Q
}

export function evalQuadratic(p: Quadratic, t: Q): Q {
  return qAdd(qAdd(qMul(p.a, qMul(t, t)), qMul(p.b, t)), p.c)
}

/** Where the vertex is and its height. `opens` is up for a > 0 (the vertex is the lowest point), down for a < 0. */
export function vertexOf(p: Quadratic): { t: Q; value: Q; opens: 'up' | 'down' } {
  if (p.a.n === 0) throw new Error('not a quadratic: a = 0')
  const t = qNeg(qDiv(p.b, qMul(q(2), p.a)))
  return { t, value: evalQuadratic(p, t), opens: p.a.n > 0 ? 'up' : 'down' }
}

/** The vertex-formula slips, in the order they are named: each one's t for this quadratic (null where it has none). */
export function vertexSlipValues(p: Quadratic): { id: 'opt_vertex_ab_swapped' | 'opt_vertex_sign' | 'opt_vertex_no_two'; value: Q }[] {
  const out: { id: 'opt_vertex_ab_swapped' | 'opt_vertex_sign' | 'opt_vertex_no_two'; value: Q }[] = []
  if (p.b.n !== 0) out.push({ id: 'opt_vertex_ab_swapped', value: qNeg(qDiv(p.a, qMul(q(2), p.b))) })
  out.push({ id: 'opt_vertex_sign', value: qDiv(p.b, qMul(q(2), p.a)) })
  out.push({ id: 'opt_vertex_no_two', value: qNeg(qDiv(p.b, p.a)) })
  return out
}
