/**
 * gf.features — a seeded graph with labelled turning points.
 *
 * W: local min, local max, local min, both ends up (her worksheet shape).
 * M: the mirror, both ends down.
 * S: one local max and one local min, ends going opposite ways.
 * Coordinates are quarter-units in [-8, 8], x-values at least 3 apart, and no x-value equals a y-value
 * so "she used the heights" stays distinguishable from the right intervals.
 */
import type { DifficultyKnobs, GraphFeaturesTurn, ProblemInstance, TemplateDef } from '@/content/types'
import { makeRng, type Rng } from '@/content/rng'
import type { CalcPanels } from '@/shared/types'
import { featuresOf } from './answers'
import { buildCurve, type Turn } from './curve'
import { formatQuarter } from './format'
import { GF_RULE_IDS } from './rules'

export const GF_TEMPLATE_ID = 'gf.features'
const NO_CALC: CalcPanels = { ti84: [], nspire: [] }

const NUDGE =
  'Trace the curve left to right. Where it climbs, those x-values are increasing; where it falls, decreasing. Parentheses at each labelled turn, and ∞ always gets a parenthesis.'

/** Her worksheet: both ends up, turns (-2.5, -5.5), (2, 3.25), (7.25, -9.25). */
export const WORKSHEET_TURNS: Turn[] = [
  { x: -2.5, y: -5.5, kind: 'min' },
  { x: 2, y: 3.25, kind: 'max' },
  { x: 7.25, y: -9.25, kind: 'min' },
]

export function instanceFromTurns(turns: readonly GraphFeaturesTurn[], seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const features = featuresOf(turns)
  const curve = buildCurve(features.turns)
  const reveal = [
    `Increasing on ${features.increasing}. Decreasing on ${features.decreasing}. The intervals use x-values, open at each turn.`,
    `Global max: ${features.globalMax}. Global min: ${features.globalMin}.`,
    `Local max: ${features.localMax}. Local min: ${features.localMin}. A global max or min the graph actually reaches is also local, so it is in that list too.`,
  ]
  const s = seed >>> 0
  return {
    id: `graphFeatures/${GF_TEMPLATE_ID}@1/${s.toString(36)}`,
    moduleId: 'graphFeatures',
    templateId: GF_TEMPLATE_ID,
    skill: GF_TEMPLATE_ID,
    genVersion: 1,
    seed: s,
    knobs,
    kind: 'graphFeatures',
    title: 'Read the graph',
    instructions: 'Determine the following items for this function. Use interval notation for increasing and decreasing.',
    statementText: 'the graph',
    vars: ['x'],
    start: null,
    canonical: [],
    answer: {
      type: 'graphFeatures',
      shape: features.shape,
      turns: features.turns,
      leftEnd: features.leftEnd,
      rightEnd: features.rightEnd,
      increasing: features.increasing,
      decreasing: features.decreasing,
      increasingSet: features.increasingSet,
      decreasingSet: features.decreasingSet,
      globalMax: features.globalMax,
      globalMin: features.globalMin,
      localMax: features.localMax,
      localMin: features.localMin,
      globalMaxPoint: features.globalMaxPoint,
      globalMinPoint: features.globalMinPoint,
      localMaxPoints: features.localMaxPoints,
      localMinPoints: features.localMinPoints,
      nudge: NUDGE,
      ruleCard: GF_RULE_IDS.open,
      ruleCards: [
        GF_RULE_IDS.open,
        GF_RULE_IDS.joiner,
        GF_RULE_IDS.xValues,
        GF_RULE_IDS.infinity,
        GF_RULE_IDS.direction,
        GF_RULE_IDS.unbounded,
        GF_RULE_IDS.globalLocal,
        GF_RULE_IDS.points,
      ],
      reveal,
    },
    graph: {
      kind: 'function',
      samples: curve.samples,
      markers: curve.markers,
      xDomain: curve.xDomain,
      yDomain: curve.yDomain,
    },
    calc: NO_CALC,
    params: {
      shape: features.shape,
      tail: curve.tail,
      turns: features.turns.map((t) => `${t.kind}@${formatQuarter(t.x)},${formatQuarter(t.y)}`).join(';'),
    },
  }
}

/** The worksheet graph, for the flow test. Not a seed of the random generator (y = -9.25 sits just outside [-8, 8]). */
export function worksheetInstance(): ProblemInstance {
  return instanceFromTurns(WORKSHEET_TURNS, 0)
}

function pickXs(rng: Rng, n: 2 | 3): number[] {
  const minGap = 12
  const lo = -32
  const hi = 32
  const minSpan = minGap * (n - 1)
  const startMax = hi - minSpan
  const start = rng.int(lo, startMax)
  const remain = startMax - start
  const extras = Array.from({ length: Math.max(0, n - 1) }, () => 0)
  for (let i = 0; i < remain; i++) extras[rng.int(0, n - 2)]! += 1
  const xs: number[] = []
  let p = start
  for (let i = 0; i < n; i++) {
    xs.push(p)
    if (i < n - 1) p += minGap + extras[i]!
  }
  return xs
}

/** Quarter-integers already in left-to-right order. Null when a coordinate is banned (an x-value). */
function tryYs(rng: Rng, banned: Set<number>, shape: 'W' | 'M' | 'S'): number[] | null {
  if (shape === 'S') {
    const lo = rng.int(-32, 20)
    const hi = lo + rng.int(6, 12)
    if (banned.has(lo) || banned.has(hi)) return null
    return [lo, hi]
  }
  if (shape === 'W') {
    const low = rng.int(-32, 8)
    const high = low + rng.int(5, 10)
    const peak = high + rng.int(6, 10)
    if (banned.has(low) || banned.has(high) || banned.has(peak)) return null
    return rng.chance(0.5) ? [high, peak, low] : [low, peak, high]
  }
  const higher = rng.int(-8, 32)
  const lowerMax = higher - rng.int(5, 10)
  const valley = lowerMax - rng.int(6, 10)
  if (banned.has(higher) || banned.has(lowerMax) || banned.has(valley)) return null
  return rng.chance(0.5) ? [lowerMax, valley, higher] : [higher, valley, lowerMax]
}

function fallbackYs(banned: Set<number>, shape: 'W' | 'M' | 'S'): number[] {
  if (shape === 'S') {
    for (let lo = -32; lo <= 20; lo++) {
      for (let span = 6; span <= 12; span++) {
        const hi = lo + span
        if (!banned.has(lo) && !banned.has(hi)) return [lo, hi]
      }
    }
  } else if (shape === 'W') {
    for (let low = -32; low <= 8; low++) {
      for (let gap = 5; gap <= 10; gap++) {
        const high = low + gap
        for (let rise = 6; rise <= 10; rise++) {
          const peak = high + rise
          if (!banned.has(low) && !banned.has(high) && !banned.has(peak)) return [low, peak, high]
        }
      }
    }
  } else {
    for (let higher = -8; higher <= 32; higher++) {
      for (let gap = 5; gap <= 10; gap++) {
        const lowerMax = higher - gap
        for (let drop = 6; drop <= 10; drop++) {
          const valley = lowerMax - drop
          if (!banned.has(higher) && !banned.has(lowerMax) && !banned.has(valley)) return [higher, valley, lowerMax]
        }
      }
    }
  }
  throw new Error('graphFeatures: no room for y-values')
}

function pickYs(rng: Rng, banned: Set<number>, shape: 'W' | 'M' | 'S'): number[] {
  for (let attempt = 0; attempt < 80; attempt++) {
    const got = tryYs(rng, banned, shape)
    if (got) return got
  }
  return fallbackYs(banned, shape)
}

function generateTurns(rng: Rng): Turn[] {
  const shape = rng.pick(['W', 'M', 'S'] as const)
  if (shape === 'S') {
    const rightUp = rng.chance(0.5)
    const xs = pickXs(rng, 2)
    const [lo, hi] = pickYs(rng, new Set(xs), 'S') as [number, number]
    if (rightUp) {
      return [
        { x: xs[0]! / 4, y: hi / 4, kind: 'max' },
        { x: xs[1]! / 4, y: lo / 4, kind: 'min' },
      ]
    }
    return [
      { x: xs[0]! / 4, y: lo / 4, kind: 'min' },
      { x: xs[1]! / 4, y: hi / 4, kind: 'max' },
    ]
  }
  const xs = pickXs(rng, 3)
  const ys = pickYs(rng, new Set(xs), shape)
  const kinds: Turn['kind'][] = shape === 'W' ? ['min', 'max', 'min'] : ['max', 'min', 'max']
  return xs.map((x, i) => ({ x: x / 4, y: ys[i]! / 4, kind: kinds[i]! }))
}

export const graphFeaturesTemplate: TemplateDef = {
  id: GF_TEMPLATE_ID,
  title: 'Turning points',
  description: 'A graph with its turning points labelled. Increasing, decreasing, and the global and local max and min.',
  version: 1,
  knobs: [],
  generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
    return instanceFromTurns(generateTurns(makeRng(seed >>> 0)), seed, knobs)
  },
}
