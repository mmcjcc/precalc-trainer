/**
 * Exact solution sets: normalization, equality, membership, set algebra and the canonical
 * printers (interval / set-builder / LaTeX / aria description).
 *
 * The shape is `SolutionSet` from shared/types: sorted disjoint pieces plus isolated points.
 * Everything here accepts un-normalized input and normalizes first, so callers may build sets
 * loosely (overlapping pieces, [a,a], points on open endpoints) and still get exact answers.
 */
import type { Endpoint, Piece, Rational, SolutionSet } from '@/shared/types'
import { rat, ratCompare, ratEquals, ratFromNumber, ratToLatex, ratToString } from '../rational'

export type { Endpoint, Piece, SolutionSet }

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export function isFiniteEndpoint(e: Endpoint): e is Rational {
  return typeof e !== 'string'
}

export function endpointCompare(a: Endpoint, b: Endpoint): -1 | 0 | 1 {
  if (a === b) return 0
  if (a === '-inf') return -1
  if (b === '-inf') return 1
  if (a === 'inf') return 1
  if (b === 'inf') return -1
  return ratCompare(a, b)
}

export function endpointToString(e: Endpoint): string {
  return e === '-inf' ? '-inf' : e === 'inf' ? 'inf' : ratToString(e)
}

export function endpointToLatex(e: Endpoint): string {
  return e === '-inf' ? '-\\infty' : e === 'inf' ? '\\infty' : ratToLatex(e)
}

function cleanEndpoint(e: Endpoint): Endpoint {
  return isFiniteEndpoint(e) ? rat(e.n, e.d) : e
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/** null = empty, Rational = the single point [a,a], Piece = a proper interval (fresh object). */
function cleanPiece(p: Piece): Piece | Rational | null {
  const lo = cleanEndpoint(p.lo)
  const hi = cleanEndpoint(p.hi)
  if (lo === 'inf' || hi === '-inf') return null
  const c = endpointCompare(lo, hi)
  if (c > 0) return null
  if (c === 0) {
    if (isFiniteEndpoint(lo) && p.loClosed && p.hiClosed) return lo
    return null
  }
  return {
    lo,
    hi,
    loClosed: lo === '-inf' ? false : p.loClosed,
    hiClosed: hi === 'inf' ? false : p.hiClosed,
  }
}

function sortPieces(pieces: Piece[]): Piece[] {
  return [...pieces].sort(
    (a, b) =>
      endpointCompare(a.lo, b.lo) ||
      (a.loClosed === b.loClosed ? 0 : a.loClosed ? -1 : 1) ||
      endpointCompare(a.hi, b.hi),
  )
}

/** Do two pieces (with a.lo <= b.lo) overlap or touch so that their union is one piece? */
function joins(a: Piece, b: Piece): boolean {
  const c = endpointCompare(b.lo, a.hi)
  return c < 0 || (c === 0 && (a.hiClosed || b.loClosed))
}

function mergePieces(sorted: Piece[]): Piece[] {
  const out: Piece[] = []
  for (const p of sorted) {
    const last = out[out.length - 1]
    if (last && joins(last, p)) {
      if (endpointCompare(last.lo, p.lo) === 0) last.loClosed = last.loClosed || p.loClosed
      const c = endpointCompare(last.hi, p.hi)
      if (c < 0) {
        last.hi = p.hi
        last.hiClosed = p.hiClosed
      } else if (c === 0) {
        last.hiClosed = last.hiClosed || p.hiClosed
      }
    } else {
      out.push({ ...p })
    }
  }
  return out
}

function sortDedupeRats(points: Rational[]): Rational[] {
  const sorted = [...points].sort(ratCompare)
  const out: Rational[] = []
  for (const p of sorted) {
    const last = out[out.length - 1]
    if (!last || !ratEquals(last, p)) out.push(p)
  }
  return out
}

export function pieceContains(p: Piece, v: Rational): boolean {
  if (isFiniteEndpoint(p.lo)) {
    const c = ratCompare(v, p.lo)
    if (c < 0 || (c === 0 && !p.loClosed)) return false
  }
  if (isFiniteEndpoint(p.hi)) {
    const c = ratCompare(v, p.hi)
    if (c > 0 || (c === 0 && !p.hiClosed)) return false
  }
  return true
}

/**
 * Canonical form: pieces sorted and merged (overlapping or touching), [a,a] → point, (a,a) dropped,
 * a point on an open endpoint closes it, points inside pieces dropped, points sorted and deduped,
 * infinite ends always open. Never mutates its input.
 */
export function normalizeSet(set: SolutionSet): SolutionSet {
  const pieces: Piece[] = []
  const points: Rational[] = []
  for (const p of set.pieces) {
    const c = cleanPiece(p)
    if (c === null) continue
    if ('n' in c) points.push(c)
    else pieces.push(c)
  }
  for (const pt of set.points) points.push(rat(pt.n, pt.d))

  let merged = mergePieces(sortPieces(pieces))
  const loose: Rational[] = []
  for (const pt of sortDedupeRats(points)) {
    let absorbed = false
    for (const p of merged) {
      if (isFiniteEndpoint(p.lo) && ratEquals(p.lo, pt)) {
        p.loClosed = true
        absorbed = true
      }
      if (isFiniteEndpoint(p.hi) && ratEquals(p.hi, pt)) {
        p.hiClosed = true
        absorbed = true
      }
      if (!absorbed && pieceContains(p, pt)) absorbed = true
    }
    if (!absorbed) loose.push(pt)
  }
  // Closing an endpoint can make two pieces touch: (-inf, 2) U {2} U (2, 5) → (-inf, 5).
  merged = mergePieces(merged)
  return { pieces: merged, points: loose }
}

export function pieceEquals(a: Piece, b: Piece): boolean {
  return (
    endpointCompare(a.lo, b.lo) === 0 &&
    endpointCompare(a.hi, b.hi) === 0 &&
    a.loClosed === b.loClosed &&
    a.hiClosed === b.hiClosed
  )
}

export function setsEqual(a: SolutionSet, b: SolutionSet): boolean {
  const na = normalizeSet(a)
  const nb = normalizeSet(b)
  if (na.pieces.length !== nb.pieces.length || na.points.length !== nb.points.length) return false
  for (let i = 0; i < na.pieces.length; i++) {
    if (!pieceEquals(na.pieces[i]!, nb.pieces[i]!)) return false
  }
  for (let i = 0; i < na.points.length; i++) {
    if (!ratEquals(na.points[i]!, nb.points[i]!)) return false
  }
  return true
}

/** Membership. Floats are snapped to simple fractions first (2.0000000001 counts as 2). */
export function setContains(set: SolutionSet, v: Rational | number): boolean {
  let r: Rational
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return false
    r = ratFromNumber(v)
  } else {
    r = v
  }
  if (set.points.some((p) => ratEquals(p, r))) return true
  return set.pieces.some((p) => pieceContains(p, r))
}

export function setFromPieces(pieces: Piece[], points: Rational[] = []): SolutionSet {
  return normalizeSet({ pieces, points })
}

export function emptySet(): SolutionSet {
  return { pieces: [], points: [] }
}

export function allReals(): SolutionSet {
  return { pieces: [{ lo: '-inf', hi: 'inf', loClosed: false, hiClosed: false }], points: [] }
}

export function setIsEmpty(set: SolutionSet): boolean {
  const n = normalizeSet(set)
  return n.pieces.length === 0 && n.points.length === 0
}

export function setIsAllReals(set: SolutionSet): boolean {
  const n = normalizeSet(set)
  return (
    n.points.length === 0 &&
    n.pieces.length === 1 &&
    n.pieces[0]!.lo === '-inf' &&
    n.pieces[0]!.hi === 'inf'
  )
}

// ---------------------------------------------------------------------------
// Set algebra (exact)
// ---------------------------------------------------------------------------

/** Pieces and points (as closed degenerate pieces) of the normalized set, sorted left → right. */
export function components(set: SolutionSet): Piece[] {
  const n = normalizeSet(set)
  const comps: Piece[] = [
    ...n.pieces,
    ...n.points.map((p): Piece => ({ lo: p, hi: p, loClosed: true, hiClosed: true })),
  ]
  return sortPieces(comps)
}

export function setFromComponents(comps: Piece[]): SolutionSet {
  return normalizeSet({ pieces: comps, points: [] })
}

/** All finite endpoints and isolated points, sorted and deduped. */
export function setCriticalValues(set: SolutionSet): Rational[] {
  const vals: Rational[] = []
  for (const c of components(set)) {
    if (isFiniteEndpoint(c.lo)) vals.push(c.lo)
    if (isFiniteEndpoint(c.hi)) vals.push(c.hi)
  }
  return sortDedupeRats(vals)
}

export function setComplement(set: SolutionSet): SolutionSet {
  const comps = components(set)
  if (comps.length === 0) return allReals()
  const gaps: Piece[] = []
  let prevHi: Endpoint = '-inf'
  let prevHiClosed = false
  for (const c of comps) {
    gaps.push({
      lo: prevHi,
      hi: c.lo,
      loClosed: prevHi === '-inf' ? false : !prevHiClosed,
      hiClosed: c.lo === '-inf' ? false : !c.loClosed,
    })
    prevHi = c.hi
    prevHiClosed = c.hiClosed
  }
  gaps.push({
    lo: prevHi,
    hi: 'inf',
    loClosed: prevHi === '-inf' ? false : !prevHiClosed,
    hiClosed: false,
  })
  return setFromComponents(gaps)
}

function intersectPieces(a: Piece, b: Piece): Piece {
  const cl = endpointCompare(a.lo, b.lo)
  const lo = cl >= 0 ? a.lo : b.lo
  const loClosed = cl > 0 ? a.loClosed : cl < 0 ? b.loClosed : a.loClosed && b.loClosed
  const ch = endpointCompare(a.hi, b.hi)
  const hi = ch <= 0 ? a.hi : b.hi
  const hiClosed = ch < 0 ? a.hiClosed : ch > 0 ? b.hiClosed : a.hiClosed && b.hiClosed
  return { lo, hi, loClosed, hiClosed }
}

export function setIntersection(a: SolutionSet, b: SolutionSet): SolutionSet {
  const out: Piece[] = []
  const bc = components(b)
  for (const x of components(a)) {
    for (const y of bc) out.push(intersectPieces(x, y))
  }
  return setFromComponents(out)
}

export function setUnion(a: SolutionSet, b: SolutionSet): SolutionSet {
  return normalizeSet({ pieces: [...a.pieces, ...b.pieces], points: [...a.points, ...b.points] })
}

export function setDifference(a: SolutionSet, b: SolutionSet): SolutionSet {
  return setIntersection(a, setComplement(b))
}

export function setIsSubset(a: SolutionSet, b: SolutionSet): boolean {
  return setIsEmpty(setDifference(a, b))
}

// ---------------------------------------------------------------------------
// Printers
// ---------------------------------------------------------------------------

export function pieceToInterval(p: Piece): string {
  return `${p.loClosed ? '[' : '('}${endpointToString(p.lo)}, ${endpointToString(p.hi)}${p.hiClosed ? ']' : ')'}`
}

function pieceToIntervalLatex(p: Piece): string {
  return `${p.loClosed ? '[' : '('}${endpointToLatex(p.lo)}, ${endpointToLatex(p.hi)}${p.hiClosed ? ']' : ')'}`
}

/** "(-inf, -2] U (5, inf)", "{}", "(-inf, inf)", "{3}", "(-inf, -2) U [1, 4) U {6}". */
export function setToInterval(set: SolutionSet): string {
  const n = normalizeSet(set)
  if (n.pieces.length === 0 && n.points.length === 0) return '{}'
  const parts = n.pieces.map(pieceToInterval)
  if (n.points.length > 0) parts.push(`{${n.points.map(ratToString).join(', ')}}`)
  return parts.join(' U ')
}

function pieceToPredicate(p: Piece, v: string): string {
  if (p.lo === '-inf' && p.hi === 'inf') return `${v} in R`
  if (p.lo === '-inf') return `${v} ${p.hiClosed ? '<=' : '<'} ${endpointToString(p.hi)}`
  if (p.hi === 'inf') return `${v} ${p.loClosed ? '>=' : '>'} ${endpointToString(p.lo)}`
  return `${endpointToString(p.lo)} ${p.loClosed ? '<=' : '<'} ${v} ${p.hiClosed ? '<=' : '<'} ${endpointToString(p.hi)}`
}

function pieceToPredicateLatex(p: Piece, v: string): string {
  if (p.lo === '-inf' && p.hi === 'inf') return `${v} \\in \\mathbb{R}`
  if (p.lo === '-inf') return `${v} ${p.hiClosed ? '\\le' : '<'} ${endpointToLatex(p.hi)}`
  if (p.hi === 'inf') return `${v} ${p.loClosed ? '\\ge' : '>'} ${endpointToLatex(p.lo)}`
  return `${endpointToLatex(p.lo)} ${p.loClosed ? '\\le' : '<'} ${v} ${p.hiClosed ? '\\le' : '<'} ${endpointToLatex(p.hi)}`
}

/** "{x | x <= -2 or x > 5}", "{x | -2 < x <= 5}", "{x | x = 3}", "{}", "{x | x in R}". */
export function setToSetBuilder(set: SolutionSet, variable = 'x'): string {
  const n = normalizeSet(set)
  if (n.pieces.length === 0 && n.points.length === 0) return '{}'
  const clauses = [
    ...n.pieces.map((p) => pieceToPredicate(p, variable)),
    ...n.points.map((p) => `${variable} = ${ratToString(p)}`),
  ]
  return `{${variable} | ${clauses.join(' or ')}}`
}

export function setToLatex(set: SolutionSet, form: 'interval' | 'builder', variable = 'x'): string {
  const n = normalizeSet(set)
  if (n.pieces.length === 0 && n.points.length === 0) return '\\emptyset'
  if (form === 'interval') {
    const parts = n.pieces.map(pieceToIntervalLatex)
    if (n.points.length > 0) parts.push(`\\{${n.points.map(ratToLatex).join(', ')}\\}`)
    return parts.join(' \\cup ')
  }
  const clauses = [
    ...n.pieces.map((p) => pieceToPredicateLatex(p, variable)),
    ...n.points.map((p) => `${variable} = ${ratToLatex(p)}`),
  ]
  return `\\{${variable} \\mid ${clauses.join(' \\text{ or } ')}\\}`
}

/**
 * Screen-reader text for the number line, left → right:
 * "closed dot at -2, ray to the left; open dot at 5, ray to the right; isolated point at 3".
 */
export function describeSet(set: SolutionSet): string {
  const n = normalizeSet(set)
  if (n.pieces.length === 0 && n.points.length === 0) return 'empty set: nothing is shaded'
  if (setIsAllReals(n)) return 'the whole number line is shaded'
  const dot = (closed: boolean) => (closed ? 'closed dot' : 'open dot')
  const parts: string[] = []
  for (const p of n.pieces) {
    if (p.lo === '-inf') {
      parts.push(`${dot(p.hiClosed)} at ${endpointToString(p.hi)}, ray to the left`)
    } else if (p.hi === 'inf') {
      parts.push(`${dot(p.loClosed)} at ${endpointToString(p.lo)}, ray to the right`)
    } else {
      parts.push(
        `${dot(p.loClosed)} at ${endpointToString(p.lo)}, ${dot(p.hiClosed)} at ${endpointToString(p.hi)}, segment between`,
      )
    }
  }
  for (const pt of n.points) parts.push(`isolated point at ${ratToString(pt)}`)
  return parts.join('; ')
}
