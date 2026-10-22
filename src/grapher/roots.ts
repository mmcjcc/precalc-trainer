/**
 * Numerical helpers for the grapher: bisection on a sign change, Brent's minimization (golden section with parabolic
 * steps) for maxima and minima, the zeros of a function along an interval (crossing zeros by bisection, touching
 * zeros such as (x − 1)² by minimizing |g|), and snapping a computed x to the integer or simple fraction it is.
 * Pure.
 */

export type Fn = (x: number) => number

/** x with f(x) closest to 0 between a and b, where f(a) and f(b) have opposite signs (or one is 0). */
export function bisect(f: Fn, a: number, fa: number, b: number, fb: number, maxIter = 100): number {
  if (fa === 0) return a
  if (fb === 0) return b
  let lo = a
  let hi = b
  let flo = fa
  for (let i = 0; i < maxIter; i++) {
    const mid = lo + (hi - lo) / 2
    if (mid === lo || mid === hi) break
    const fm = f(mid)
    if (fm === 0) return mid
    if (Number.isNaN(fm)) break
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid
      flo = fm
    } else {
      hi = mid
    }
  }
  const fl = Math.abs(f(lo))
  const fh = Math.abs(f(hi))
  return fh < fl ? hi : lo
}

const GOLD = 0.381966011250105

/**
 * Brent's method: the x in [a, b] where f is smallest (f unimodal there), to about `tol` relative. NaN values count as
 * +∞ so the search stays where f is defined.
 */
export function minimize(f: Fn, a: number, b: number, tol = 1e-10, maxIter = 200): number {
  const g = (x: number) => {
    const v = f(x)
    return Number.isNaN(v) ? Infinity : v
  }
  let lo = Math.min(a, b)
  let hi = Math.max(a, b)
  let x = lo + GOLD * (hi - lo)
  let w = x
  let v = x
  let fx = g(x)
  let fw = fx
  let fv = fx
  let d = 0
  let e = 0
  for (let iter = 0; iter < maxIter; iter++) {
    const m = 0.5 * (lo + hi)
    const tol1 = tol * Math.abs(x) + 1e-300
    const tol2 = 2 * tol1
    if (Math.abs(x - m) <= tol2 - 0.5 * (hi - lo)) break
    let useGolden = true
    if (Math.abs(e) > tol1) {
      // A parabola through x, w and v.
      let r = (x - w) * (fx - fv)
      let q = (x - v) * (fx - fw)
      let p = (x - v) * q - (x - w) * r
      q = 2 * (q - r)
      if (q > 0) p = -p
      q = Math.abs(q)
      r = e
      e = d
      if (Math.abs(p) < Math.abs(0.5 * q * r) && p > q * (lo - x) && p < q * (hi - x)) {
        d = p / q
        const u = x + d
        if (u - lo < tol2 || hi - u < tol2) d = x < m ? tol1 : -tol1
        useGolden = false
      }
    }
    if (useGolden) {
      e = (x < m ? hi : lo) - x
      d = GOLD * e
    }
    const u = Math.abs(d) >= tol1 ? x + d : x + (d > 0 ? tol1 : -tol1)
    const fu = g(u)
    if (fu <= fx) {
      if (u < x) hi = x
      else lo = x
      v = w
      fv = fw
      w = x
      fw = fx
      x = u
      fx = fu
    } else {
      if (u < x) lo = u
      else hi = u
      if (fu <= fw || w === x) {
        v = w
        fv = fw
        w = u
        fw = fu
      } else if (fu <= fv || v === x || v === w) {
        v = u
        fv = fu
      }
    }
  }
  return x
}

export function maximize(f: Fn, a: number, b: number, tol = 1e-10): number {
  return minimize((x) => -f(x), a, b, tol)
}

/** The integers and simple fractions (denominator up to 12) nearest x, nearest first. */
export function niceCandidates(x: number): number[] {
  const out = new Set<number>([Math.round(x)])
  for (let d = 2; d <= 12; d++) out.add(Math.round(x * d) / d)
  return [...out].sort((a, b) => Math.abs(a - x) - Math.abs(b - x))
}

/** A zero snapped to the integer or simple fraction it is, when f is at least as close to 0 there. */
export function snapZero(f: Fn, x: number, tol: number): number {
  const fx = Math.abs(f(x))
  for (const c of niceCandidates(x)) {
    if (Math.abs(c - x) > tol) break
    const fc = f(c)
    if (fc === 0 || Math.abs(fc) <= fx) return c === 0 ? 0 : c
  }
  return x
}

/** A maximum (sign 1) or minimum (sign −1) snapped to the integer or simple fraction it is, when f is as extreme there. */
export function snapExtremum(f: Fn, x: number, tol: number, sign: 1 | -1): number {
  const fx = f(x)
  const slack = 1e-12 * Math.max(1, Math.abs(fx))
  for (const c of niceCandidates(x)) {
    if (Math.abs(c - x) > tol) break
    const fc = f(c)
    if (Number.isFinite(fc) && sign * (fc - fx) >= -slack) return c === 0 ? 0 : c
  }
  return x
}

/**
 * The zeros of g along [lo, hi] from n + 1 samples: exact zeros, sign changes refined by bisection (a sign change
 * across a pole of g is not a zero, so |g| must be tiny there), and touching zeros where |g| has a tiny local minimum.
 * At most `cap` of them, in order.
 */
export function zerosAlong(g: Fn, lo: number, hi: number, n: number, cap = 2000): number[] {
  const out: number[] = []
  if (!(hi > lo) || n < 2) return out
  const xs = new Array<number>(n + 1)
  const ys = new Array<number>(n + 1)
  for (let i = 0; i <= n; i++) {
    const x = i === n ? hi : lo + ((hi - lo) * i) / n
    xs[i] = x
    ys[i] = g(x)
  }
  const span = hi - lo
  const push = (x: number) => {
    const last = out[out.length - 1]
    if (last !== undefined && Math.abs(x - last) <= span * 1e-12) return
    out.push(x)
  }
  for (let i = 0; i <= n && out.length < cap; i++) {
    const y = ys[i]!
    if (y === 0) {
      push(xs[i]!)
      continue
    }
    if (i === n) break
    const y1 = ys[i + 1]!
    if (!Number.isFinite(y) || !Number.isFinite(y1)) continue
    if (y1 !== 0 && Math.sign(y) !== Math.sign(y1)) {
      const c = bisect(g, xs[i]!, y, xs[i + 1]!, y1)
      const gc = Math.abs(g(c))
      if (gc <= 1e-7 * Math.max(Math.abs(y), Math.abs(y1)) || gc < 1e-300) push(c)
      continue
    }
    // A touching zero: |g| dips to a tiny value between samples i − 1 and i + 1 without changing sign.
    if (i > 0) {
      const y0 = ys[i - 1]!
      if (Number.isFinite(y0) && Math.sign(y0) === Math.sign(y) && Math.sign(y) === Math.sign(y1)) {
        const a = Math.abs(y)
        if (a <= Math.abs(y0) && a <= Math.abs(y1) && a < 0.2 * Math.max(Math.abs(y0), Math.abs(y1))) {
          const c = minimize((x) => Math.abs(g(x)), xs[i - 1]!, xs[i + 1]!, 1e-12)
          const gc = Math.abs(g(c))
          if (gc <= 1e-9 * Math.max(Math.abs(y0), Math.abs(y1))) push(c)
        }
      }
    }
  }
  return out
}
