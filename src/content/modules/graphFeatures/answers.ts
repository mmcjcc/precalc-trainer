/**
 * Canonical answers from the turning points.
 *
 * Intervals use x-values and are open at every turn (the graph is not strictly monotone there)
 * and at infinity. A reached global extremum — the graph does not run off to ±∞ that way — is
 * also local, so it is in the local list.
 */
import type { GraphFeaturesTurn } from '@/content/types'
import type { Endpoint, Piece, SolutionSet } from '@/shared/types'
import { rat, setFromPieces } from '@/notation'
import type { Turn } from './curve'
import { formatInterval, formatPoint, joinPoints, type XY } from './format'

export interface Features {
  turns: Turn[]
  shape: 'W' | 'M' | 'S'
  leftEnd: 'up' | 'down'
  rightEnd: 'up' | 'down'
  increasingSet: SolutionSet
  decreasingSet: SolutionSet
  increasing: string
  decreasing: string
  globalMaxPoint: XY | null
  globalMinPoint: XY | null
  localMaxPoints: XY[]
  localMinPoints: XY[]
  globalMax: string
  globalMin: string
  localMax: string
  localMin: string
}

function qRat(q: number) {
  return rat(Math.round(q * 4), 4)
}

function endOf(kind: Turn['kind']): 'up' | 'down' {
  // A min's tail opens upward (y → +∞); a max's tail opens downward.
  return kind === 'min' ? 'up' : 'down'
}

function shapeOf(turns: readonly Turn[]): 'W' | 'M' | 'S' {
  if (turns.length === 2) return 'S'
  return turns[0]!.kind === 'min' ? 'W' : 'M'
}

export function featuresOf(turnsIn: readonly GraphFeaturesTurn[]): Features {
  const turns = [...turnsIn].sort((a, b) => a.x - b.x)
  const inc: Piece[] = []
  const dec: Piece[] = []
  const push = (increasing: boolean, lo: Endpoint, hi: Endpoint) => {
    const piece: Piece = { lo, hi, loClosed: false, hiClosed: false }
    ;(increasing ? inc : dec).push(piece)
  }
  const first = turns[0]!
  const last = turns[turns.length - 1]!
  // Coming up into a max from the left, or down into a min.
  push(first.kind === 'max', '-inf', qRat(first.x))
  for (let i = 0; i < turns.length - 1; i++) {
    const a = turns[i]!
    const b = turns[i + 1]!
    push(a.kind === 'min', qRat(a.x), qRat(b.x))
  }
  push(last.kind === 'min', qRat(last.x), 'inf')
  const increasingSet = setFromPieces(inc)
  const decreasingSet = setFromPieces(dec)

  const mins = turns.filter((t) => t.kind === 'min')
  const maxes = turns.filter((t) => t.kind === 'max')
  const lower = (ps: Turn[]) => ps.reduce((a, b) => (a.y <= b.y ? a : b))
  const higher = (ps: Turn[]) => ps.reduce((a, b) => (a.y >= b.y ? a : b))
  const leftEnd = endOf(first.kind)
  const rightEnd = endOf(last.kind)
  // An end that falls goes to −∞, so there is no global min; an end that rises, no global max.
  const globalMinPoint = leftEnd === 'down' || rightEnd === 'down' ? null : xy(lower(mins))
  const globalMaxPoint = leftEnd === 'up' || rightEnd === 'up' ? null : xy(higher(maxes))
  const localMinPoints = mins.map(xy)
  const localMaxPoints = maxes.map(xy)

  return {
    turns,
    shape: shapeOf(turns),
    leftEnd,
    rightEnd,
    increasingSet,
    decreasingSet,
    increasing: formatInterval(increasingSet),
    decreasing: formatInterval(decreasingSet),
    globalMaxPoint,
    globalMinPoint,
    localMaxPoints,
    localMinPoints,
    globalMax: globalMaxPoint ? formatPoint(globalMaxPoint) : 'none',
    globalMin: globalMinPoint ? formatPoint(globalMinPoint) : 'none',
    localMax: joinPoints(localMaxPoints),
    localMin: joinPoints(localMinPoints),
  }
}

function xy(p: Turn): XY {
  return { x: p.x, y: p.y }
}
