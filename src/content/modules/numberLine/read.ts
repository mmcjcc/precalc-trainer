import type { Piece, Rational, SolutionSet } from '@/shared/types'
import { calcPanels } from '@/content/calc'
import { makeRng, type Rng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { rat, setCriticalValues, setFromPieces } from '@/notation'
import { setAnswer, setPredicate } from '../sets'

/**
 * Number line → notation (CG-06 generator rules):
 *  - 1–3 components, integer critical values in [−8, 8];
 *  - consecutive critical values ≥ 2 apart inside a segment, ≥ 3 apart across a gap;
 *  - at most one isolated point, at most one ray in each direction.
 */

/** L = ray to the left, S = bounded segment, P = isolated point, R = ray to the right. */
export type Component = 'L' | 'S' | 'P' | 'R'

const SHAPES: Record<1 | 2 | 3, readonly (readonly Component[])[]> = {
  1: [['L'], ['S'], ['R'], ['S'], ['L'], ['R'], ['P']],
  2: [
    ['L', 'S'],
    ['L', 'P'],
    ['L', 'R'],
    ['S', 'S'],
    ['S', 'P'],
    ['P', 'S'],
    ['S', 'R'],
    ['P', 'R'],
    ['L', 'R'],
  ],
  3: [
    ['L', 'S', 'R'],
    ['L', 'P', 'R'],
    ['L', 'S', 'P'],
    ['L', 'P', 'S'],
    ['S', 'P', 'R'],
    ['P', 'S', 'R'],
    ['L', 'S', 'S'],
    ['S', 'S', 'R'],
    ['S', 'P', 'S'],
    ['S', 'S', 'P'],
    ['P', 'S', 'S'],
    ['S', 'S', 'S'],
    ['L', 'S', 'R'],
  ],
}

export const NL_MIN = -8
export const NL_MAX = 8
/** Minimum distance between the two endpoints of one segment. */
export const SEGMENT_GAP = 2
/** Minimum distance between the last critical value of one component and the first of the next. */
export const HOLE_GAP = 3

export interface NumberLineLayout {
  shape: Component[]
  set: SolutionSet
  /** Critical values left → right. */
  values: number[]
}

/** Deterministically lay out a shape on the integer number line, honoring the spacing rules. */
export function layoutShape(rng: Rng, shape: readonly Component[]): NumberLineLayout {
  const n = shape.length
  const segments = shape.filter((c) => c === 'S').length
  const minSpan = SEGMENT_GAP * segments + HOLE_GAP * (n - 1)
  const slack = NL_MAX - NL_MIN - minSpan
  // Slots: [start offset, one per gap (n-1), one per segment (extra length)].
  const slotCount = 1 + (n - 1) + segments
  const extra = new Array<number>(slotCount).fill(0)
  const used = rng.int(0, slack)
  for (let i = 0; i < used; i++) extra[rng.int(0, slotCount - 1)]!++
  let gapSlot = 1
  let segSlot = n
  let pos = NL_MIN + extra[0]!
  const pieces: Piece[] = []
  const points: Rational[] = []
  const values: number[] = []
  shape.forEach((c, i) => {
    const closed = () => rng.chance(0.5)
    if (c === 'L') {
      pieces.push({ lo: '-inf', hi: rat(pos), loClosed: false, hiClosed: closed() })
      values.push(pos)
    } else if (c === 'R') {
      pieces.push({ lo: rat(pos), hi: 'inf', loClosed: closed(), hiClosed: false })
      values.push(pos)
    } else if (c === 'P') {
      points.push(rat(pos))
      values.push(pos)
    } else {
      const lo = pos
      const hi = lo + SEGMENT_GAP + extra[segSlot++]!
      pieces.push({ lo: rat(lo), hi: rat(hi), loClosed: closed(), hiClosed: closed() })
      values.push(lo, hi)
      pos = hi
    }
    if (i < n - 1) pos += HOLE_GAP + extra[gapSlot++]!
  })
  return { shape: shape.slice(), set: setFromPieces(pieces, points), values }
}

export const numberLineReadTemplate: TemplateDef = {
  id: 'nl.read',
  title: 'Read the number line',
  description: 'A shaded number line with 1–3 pieces. Write it in interval and set-builder notation.',
  version: 1,
  knobs: [],
  generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
    const rng = makeRng(seed)
    const n = rng.pick<1 | 2 | 3>([1, 2, 2, 3, 3])
    const shape = rng.pick(SHAPES[n])
    const { set, values } = layoutShape(rng, shape)
    const answer = setAnswer(set)
    const predicate = setPredicate(set)
    const critical = setCriticalValues(set)
    return {
      id: `numberLine/nl.read@1/${(seed >>> 0).toString(36)}`,
      moduleId: 'numberLine',
      templateId: 'nl.read',
      skill: 'nl.read',
      genVersion: 1,
      seed,
      knobs,
      kind: 'numberLine',
      title: 'Read the number line',
      instructions: 'Write this set in interval notation AND set-builder notation.',
      // The picture is the statement; this predicate is its app-syntax equivalent (it IS the
      // answer, so the number-line page draws `graph.set` and does not print statementText).
      statementText: predicate,
      vars: ['x'],
      start: null,
      canonical: [],
      answer,
      graph: { kind: 'numberLine', set, xDomain: [NL_MIN - 2, NL_MAX + 2] },
      calc: calcPanels({ family: 'number-line', expr: '0', relation: predicate, boundary: critical }),
      params: {
        shape: shape.join(''),
        values: values.join(','),
        pieces: set.pieces.length,
        points: set.points.length,
      },
    }
  },
}
