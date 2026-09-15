/**
 * Local text description of a SolutionSet for the number line's aria-label.
 * TODO(phase C): swap for `describeSet` from '@/notation' once notation/index.ts lands; keep the
 * rational helpers here only until `ratToString`/`ratToNumber` are exported there.
 */
import type { Endpoint, Rational, SolutionSet } from '@/shared/types'

export function ratToNumber(r: Rational): number {
  return r.n / r.d
}

export function ratToString(r: Rational): string {
  return r.d === 1 ? String(r.n) : `${r.n}/${r.d}`
}

export function endpointToNumber(e: Endpoint): number {
  if (e === '-inf') return -Infinity
  if (e === 'inf') return Infinity
  return ratToNumber(e)
}

function dot(closed: boolean): string {
  return closed ? 'closed dot' : 'open dot'
}

/** e.g. "closed dot at -2, ray to the left; open dot at 5, ray to the right; isolated point at 3". */
export function describeSet(set: SolutionSet): string {
  const parts: string[] = []
  for (const p of set.pieces) {
    if (p.lo === '-inf' && p.hi === 'inf') {
      parts.push('the whole number line shaded')
    } else if (p.lo === '-inf') {
      const hi = p.hi as Rational
      parts.push(`${dot(p.hiClosed)} at ${ratToString(hi)}, ray to the left`)
    } else if (p.hi === 'inf') {
      const lo = p.lo as Rational
      parts.push(`${dot(p.loClosed)} at ${ratToString(lo)}, ray to the right`)
    } else if (typeof p.lo !== 'string' && typeof p.hi !== 'string') {
      parts.push(`segment from ${ratToString(p.lo)} (${dot(p.loClosed)}) to ${ratToString(p.hi)} (${dot(p.hiClosed)})`)
    }
  }
  for (const pt of set.points) parts.push(`isolated point at ${ratToString(pt)}`)
  if (parts.length === 0) return 'Number line: empty set, nothing shaded'
  return `Number line: ${parts.join('; ')}`
}
