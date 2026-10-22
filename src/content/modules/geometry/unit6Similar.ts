/**
 * Honors geometry Unit 6, module geoSimilarTriangles (Jurgensen 7-3 to 7-5): proving triangles similar, and using
 * similar triangles.
 *
 * gt.prove: which postulate or theorem proves two triangles similar (the AA Similarity Postulate, the SSS or SAS
 * Similarity Theorem), or that the marks are not enough. The figure is honest: every arc, square, arrow and number is
 * exactly what is given, and nothing else is. Shared angles and vertical angles count where the figure has them. A
 * figure that does not prove it is drawn sometimes similar and sometimes not, so the picture never answers. The answer
 * turns with the seed: any four seeds in a row show the four answers once.
 *
 * gt.solve: a smaller triangle inside a larger one (a segment parallel to a side, or one that makes a congruent angle
 * with the far side), the altitude to the hypotenuse of a right triangle, and indirect measurement (shadows, a mirror on
 * the ground). The true similarity statement first, then x.
 */
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { ErrorPatternId, GeoAngleMark, GeoFigureSpec, GeoLine, GeoPoint, GeoSegment } from '@/shared/types'
import { formatQty, simplifyRadical } from './answer'
import type { GeoBuilt } from './build'
import { R, crossText, isWhole, konst, lin6, lprod, lsolve, positive, qShow, qText, ratDiv, ratMul, type LinQ, type Rational } from './unit6Alg'
import {
  FT_HINT6,
  M_HINT6,
  MEAN_HINT6,
  RESERVED6_NUMBERS,
  X_HINT6,
  choiceStage6,
  finish6,
  numberStage6,
  placeLabels6,
  type ChoiceDraft6,
  type Stage6,
  type TrapDraft6,
} from './unit6Build'
import {
  PERMS3,
  along,
  angleAt,
  besideRight,
  bounds,
  centroid,
  pickLetters6,
  pointAt,
  points6,
  rad,
  readable,
  sameAngles,
  scaled,
  triFromAngles,
  triFromSas,
  triFromSides,
  turned,
  type XY,
} from './unit6Geom'
import { weighted } from './unit6Ratios'
import { SIMILAR_RULES, UNIT6_RULE_IDS } from './unit6Rules'

const PROVE_INSTRUCTIONS = 'Only the marks, numbers, and words given count. The figure is there before you answer.'
const SOLVE_INSTRUCTIONS = 'Choose the statement, then find x. The figure is there before you answer.'

/** The buttons, in a textbook's order. */
export const METHOD_TEXT = {
  AA: 'AA Similarity Postulate',
  SSS: 'SSS Similarity Theorem',
  SAS: 'SAS Similarity Theorem',
  none: 'Not enough information',
} as const
export type SimMethod = keyof typeof METHOD_TEXT

const r2 = (n: number) => Math.round(n * 1000) / 1000

// =================================================================================================================
// gt.prove
// =================================================================================================================

interface ProveScene {
  family: string
  answer: SimMethod
  /** The two triangles, for the prompt and the description. */
  t1: string
  t2: string
  figure: Omit<GeoFigureSpec, 'ariaLabel'>
  /** Which segments are parts of a longer segment (labels on dimension lines). */
  parts?: number[]
  /** Outlines a dimension line must stay outside of. */
  outlines: string[][]
  aria: string
  reveal: string
  /** Wrong buttons that are named slips here: button id → mistake and the sentence about her pick. */
  traps: Partial<Record<SimMethod, { id: ErrorPatternId; witness: string }>>
  /** The slip the seed would rather promise, when it is one of the traps. */
  prefer?: SimMethod
}

const ANSWER_ORDER: readonly SimMethod[] = ['AA', 'SSS', 'SAS', 'none']

/**
 * The answer turns with the seed, so any four seeds in a row show each answer once and any 300 in a row show each
 * exactly 75 times (a quarter). The figure, its letters and its family still come from the seed's own draws.
 */
const ROTATION: readonly SimMethod[] = ['SAS', 'none', 'AA', 'SSS']
export function proveAnswerOf(seed: number): SimMethod {
  return ROTATION[((((seed >>> 0) - 1) % 4) + 4) % 4]!
}

export function drawSimilarProve(seed: number): GeoBuilt {
  const answer = proveAnswerOf(seed)
  const family = weighted(
    makeRng(mixSeed(seed, 6301)),
    answer === 'AA'
      ? ([
          ['aa-arcs', 20],
          ['aa-numbers', 20],
          ['aa-shared', 20],
          ['aa-vertical', 15],
          ['aa-right', 10],
          ['aa-parallel', 15],
        ] as const)
      : answer === 'SSS'
        ? ([['sss', 100]] as const)
        : answer === 'SAS'
          ? ([
              ['sas', 55],
              ['sas-shared', 45],
            ] as const)
          : ([
              ['ssa', 35],
              ['two-sides', 20],
              ['one-angle', 15],
              ['shared-only', 15],
              ['vertical-only', 15],
            ] as const),
  )
  for (let attempt = 0; attempt < 500; attempt++) {
    const rng = makeRng(mixSeed(seed, 6302 + attempt))
    const scene = proveScene(rng, family)
    if (!scene) continue
    const built = proveFinish(scene, seed)
    if (built) return built
  }
  throw new Error(`gt.prove/${seed}: no ${family} problem`)
}

function proveScene(rng: Rng, family: string): ProveScene | null {
  switch (family) {
    case 'aa-arcs':
    case 'aa-numbers':
    case 'aa-right':
    case 'sss':
    case 'sas':
    case 'ssa':
    case 'two-sides':
    case 'one-angle':
      return separateScene(rng, family)
    case 'aa-shared':
    case 'sas-shared':
    case 'shared-only':
    case 'aa-parallel':
      return overlapScene(rng, family)
    default:
      return hourglassScene(rng, family)
  }
}

function proveFinish(scene: ProveScene, seed: number): GeoBuilt | null {
  const answerId = scene.answer
  const choices: ChoiceDraft6[] = ANSWER_ORDER.map((id) => {
    const trap = id === answerId ? undefined : scene.traps[id]
    return trap ? { id, text: METHOD_TEXT[id], trap: trap.id, witness: trap.witness } : { id, text: METHOD_TEXT[id] }
  })
  const stage = choiceStage6({
    id: 'a',
    label: 'Method',
    choices,
    answerId,
    nudge: 'Count the pairs of congruent angles the figure gives, the marked ones and the ones it gives without a mark. Then check the ratios of the sides that have numbers.',
    ruleCard: UNIT6_RULE_IDS.which,
    reveal: [scene.reveal],
    seed,
    salt: 6303,
    keepOrder: true,
  })
  const prefer = scene.prefer ? scene.traps[scene.prefer]?.id : undefined
  const promise = [...(prefer ? [prefer] : []), ...Object.values(scene.traps).map((t) => t!.id)]
  const spec: GeoFigureSpec = { ...scene.figure, ariaLabel: scene.aria }
  const figure = placeLabels6(spec, scene.outlines, new Set(scene.parts ?? []))
  if (!figure) return null
  return finish6({
    question: 'similarProve',
    prompt: `Which postulate or theorem, if any, proves that triangles ${scene.t1} and ${scene.t2} are similar?`,
    figure,
    stages: [stage],
    lengths: [],
    angles: [],
    title: 'Proving triangles similar',
    instructions: PROVE_INSTRUCTIONS,
    params: { case: scene.family, answer: scene.answer },
    cards: SIMILAR_RULES,
    promise,
  })
}

/** Whole-degree angles of a readable scalene triangle: every angle 30° to 110°, no two within 9°, none near 90°. */
function scaleneAngles(rng: Rng): [number, number, number] | null {
  const a0 = rng.int(32, 104)
  const a1 = rng.int(32, 104)
  const a2 = 180 - a0 - a1
  const all: [number, number, number] = [a0, a1, a2]
  if (a2 < 30 || a2 > 110) return null
  if (all.some((g) => Math.abs(g - 90) < 7)) return null
  if (Math.abs(a0 - a1) < 9 || Math.abs(a1 - a2) < 9 || Math.abs(a0 - a2) < 9) return null
  return all
}

/** "angles A and E" / "sides AB and DE". */
const and2 = (a: string, b: string) => `${a} and ${b}`

interface Pair {
  first: string[]
  second: string[]
  p1: XY[]
  p2: XY[]
}

/**
 * Two separate triangles, the second the image of `t2shape` (vertex i of the second goes with vertex i of the first
 * when they are similar), turned and sometimes flipped, side by side in an order from the seed.
 */
function separatePair(rng: Rng, t1shape: XY[], t2shape: XY[], minAngle = 25): Pair | null {
  const letters = pickLetters6(rng, 6)
  const first = letters.slice(0, 3)
  const second = letters.slice(3, 6)
  const own = turned(t1shape, rng.int(-20, 20), false)
  const other = turned(t2shape, rng.int(40, 320), rng.chance(0.5))
  const w = Math.max(bounds(own).maxX - bounds(own).minX, bounds(other).maxX - bounds(other).minX)
  const gap = 0.3 * w
  const firstLeft = rng.chance(0.5)
  const p1 = firstLeft ? own : besideRight(other, own, gap)
  const p2 = firstLeft ? besideRight(own, other, gap) : other
  if (!readable(p1, minAngle, 0.25) || !readable(p2, minAngle, 0.25)) return null
  return { first, second, p1, p2 }
}

/** The second triangle's letters listed around it from a seeded start, so the name never gives the correspondence. */
function aroundName(rng: Rng, ids: readonly string[]): string {
  const start = rng.int(0, 2)
  const dir = rng.chance(0.5) ? 1 : -1
  return [0, 1, 2].map((k) => ids[(((start + dir * k) % 3) + 3) % 3]!).join('')
}

const arcMark = (ids: readonly string[], v: number, marks: 1 | 2 | 3): GeoAngleMark => ({ vertex: ids[v]!, from: ids[(v + 1) % 3]!, to: ids[(v + 2) % 3]!, marks })
const rightMark = (ids: readonly string[], v: number): GeoAngleMark => ({ vertex: ids[v]!, from: ids[(v + 1) % 3]!, to: ids[(v + 2) % 3]!, right: true })
const numberMark = (ids: readonly string[], v: number, deg: number): GeoAngleMark => ({ vertex: ids[v]!, from: ids[(v + 1) % 3]!, to: ids[(v + 2) % 3]!, label: `${deg}°`, arc: false })

function triSegments(ids: readonly string[], labels: (string | null)[] = [null, null, null]): GeoSegment[] {
  return [0, 1, 2].map((i) => {
    const label = labels[i]
    return label ? { from: ids[i]!, to: ids[(i + 1) % 3]!, label } : { from: ids[i]!, to: ids[(i + 1) % 3]! }
  })
}

const SIM_W = {
  angles: 'The arcs mark two pairs of congruent angles. Two pairs of angles are enough to prove two triangles similar.',
  numbers: 'Use the angle sum: the third angle of each triangle is 180° minus the other two. Then compare the angles of the two triangles again.',
  right: 'Both triangles have a right angle, and all right angles are congruent. That pair counts along with the marked pair.',
  parallel: 'The arrows mark parallel lines, and parallel lines make congruent corresponding angles where the sides cross them. Those pairs count.',
  sides: 'All three pairs of sides have numbers. Divide each side of one triangle by its partner in the other, shortest with shortest: equal ratios prove the triangles similar.',
  sas: 'The arcs sit between the two numbered sides of each triangle. Check whether those sides are in proportion.',
} as const

const TWO_PAIRS_W = 'Only two pairs of sides have numbers. The third pair is not given, so its ratio is unknown.'
const SSA_W = 'Each congruent angle sits across from a numbered side, not between the two numbered sides. With the angle there, triangles of different shapes can carry the same marks.'
const ONE_ANGLE_W = 'Only one pair of congruent angles is given here. One pair does not fix the shape of a triangle.'

function separateScene(rng: Rng, family: string): ProveScene | null {
  const right = family === 'aa-right'
  const ang = right ? null : scaleneAngles(rng)
  if (!right && !ang) return null
  // The scale of the second triangle to the first, and whole-number sides where sides are numbered.
  const [p, q] = rng.pick([
    [2, 3], [3, 2], [3, 4], [4, 3], [3, 5], [5, 3], [2, 5], [5, 2], [4, 5], [5, 4], [1, 2], [2, 1],
  ] as const)
  const factor = q / p
  let t1: XY[]
  let t2: XY[]
  const labels1: (string | null)[] = [null, null, null]
  const labels2: (string | null)[] = [null, null, null]
  const angles: GeoAngleMark[] = []
  let aria = ''
  let reveal = ''
  const traps: ProveScene['traps'] = {}
  let answer: SimMethod
  let prefer: SimMethod | undefined
  // Letters are chosen once the shapes are known; marks are written by vertex index and named afterwards.
  const marks: ((first: string[], second: string[], name2: string) => void)[] = []
  if (family === 'sss') {
    // Whole sides in proportion: p·(a, b, c) and q·(a, b, c).
    const base = rng.shuffle([3, 4, 5, 6, 7, 8, 9]).slice(0, 3)
    const s1 = base.map((v) => v * p)
    const s2 = base.map((v) => v * q)
    if ([...s1, ...s2].some((v) => v > 40)) return null
    const tri = triFromSides(s1[0]!, s1[1]!, s1[2]!)
    if (!tri || !readable(tri, 28, 0.35)) return null
    t1 = tri
    t2 = scaled(tri, factor)
    for (let i = 0; i < 3; i++) {
      labels1[i] = String(s1[i])
      labels2[i] = String(s2[i])
    }
    answer = 'SSS'
    traps.none = { id: 'geo_similarity_test_missed', witness: SIM_W.sides }
    marks.push((first, second, name2) => {
      aria = `Every side has a number. In triangle ${first.join('')}, ${sidesText(first, labels1)}. In triangle ${name2}, ${sidesText(second, labels2)}.`
      reveal = `The sides of ${first.join('')} over their partners in ${name2} are ${[0, 1, 2].map((i) => `${s1[i]}/${s2[i]}`).join(', ')}, all equal to ${qText(R(p, q))}. All three pairs are in proportion, so the SSS Similarity Theorem proves the triangles similar.`
    })
  } else if (family === 'sas' || family === 'ssa' || family === 'two-sides') {
    // Two whole sides of the first triangle and their partners.
    const sa = rng.int(3, 9) * p
    const sb = rng.int(3, 9) * p
    if (sa === sb || sa > 40 || sb > 40 || (sa * q) / p > 40 || (sb * q) / p > 40) return null
    if (family === 'ssa') {
      // Sides V0V1 = c and V1V2 = a, and the angle at V0, which is not between them. The second triangle is either
      // the similar copy or the other triangle with the same marks (the ambiguous case), drawn to its own shape.
      // Only side pairs with two readable solutions (the ambiguous case) are used, so the other one can be drawn.
      const theta = rng.int(28, 48)
      const sin = Math.sin(rad(theta))
      const cos = Math.cos(rad(theta))
      const make = (cc: number, b: number): XY[] => [
        { x: 0, y: 0 },
        { x: cc, y: 0 },
        { x: b * cos, y: b * sin },
      ]
      const options: { c: number; a: number; b1: number; b2: number }[] = []
      for (let ci = 4; ci <= 9; ci++) {
        for (let ai = 3; ai < ci; ai++) {
          const cc = ci * p
          const aa = ai * p
          if (cc > 40 || (cc * q) / p > 40) continue
          const h = cc * sin
          if (aa <= h * 1.12 || aa >= cc * 0.94) continue
          const reach = Math.sqrt(aa * aa - h * h)
          const b1 = cc * cos + reach
          const b2 = cc * cos - reach
          if (b2 < 0.35 * cc) continue
          if (!readable(make(cc, b1), 22, 0.25) || !readable(make(cc, b2), 20, 0.25)) continue
          options.push({ c: cc, a: aa, b1, b2 })
        }
      }
      if (options.length === 0) return null
      const { c, a, b1, b2 } = rng.pick(options)
      t1 = make(c, b1)
      const similar = rng.chance(0.5)
      t2 = scaled(make(c, similar ? b1 : b2), factor)
      labels1[0] = String(c)
      labels1[1] = String(a)
      labels2[0] = String((c * q) / p)
      labels2[1] = String((a * q) / p)
      answer = 'none'
      traps.SAS = { id: 'geo_ssa_as_similarity', witness: SSA_W }
      traps.SSS = { id: 'geo_sss_two_pairs', witness: TWO_PAIRS_W }
      prefer = 'SAS'
      marks.push((first, second, name2) => {
        angles.push(arcMark(first, 0, 1), arcMark(second, 0, 1))
        aria = `In triangle ${first.join('')}, side ${first[0]}${first[1]} is labeled ${c} and side ${first[1]}${first[2]} is labeled ${a}. In triangle ${name2}, side ${second[0]}${second[1]} is labeled ${labels2[0]} and side ${second[1]}${second[2]} is labeled ${labels2[1]}. Angles ${and2(first[0]!, second[0]!)} each have one arc.`
        reveal = `The congruent angles ${first[0]} and ${second[0]} are not between the numbered sides, so the marks are SSA. SSA does not prove triangles similar, and no other test fits.`
      })
      return finishSeparate(rng, family, t1, t2, labels1, labels2, angles, () => aria, () => reveal, traps, answer, marks, prefer)
    }
    const theta = rng.int(34, 128)
    if (Math.abs(theta - 90) < 8) return null
    // Sides at vertex 0: V0V1 (side 0) and V2V0 (side 2), with the angle at V0 between them.
    t1 = triFromSas(sa, sb, theta)
    const similar = family === 'sas' || rng.chance(0.5)
    const theta2 = similar ? theta : theta + (rng.chance(0.5) ? 1 : -1) * rng.int(16, 30)
    if (theta2 < 30 || theta2 > 140 || Math.abs(theta2 - 90) < 6) return null
    t2 = triFromSas((sa * q) / p, (sb * q) / p, theta2)
    if (!readable(t1, 24, 0.25) || !readable(t2, 24, 0.25)) return null
    labels1[0] = String(sa)
    labels1[2] = String(sb)
    labels2[0] = String((sa * q) / p)
    labels2[2] = String((sb * q) / p)
    if (family === 'sas') {
      answer = 'SAS'
      traps.none = { id: 'geo_similarity_test_missed', witness: SIM_W.sas }
      traps.SSS = { id: 'geo_sss_two_pairs', witness: TWO_PAIRS_W }
      marks.push((first, second, name2) => {
        angles.push(arcMark(first, 0, 1), arcMark(second, 0, 1))
        aria = `In triangle ${first.join('')}, side ${first[0]}${first[1]} is labeled ${sa} and side ${first[2]}${first[0]} is labeled ${sb}. In triangle ${name2}, side ${second[0]}${second[1]} is labeled ${labels2[0]} and side ${second[2]}${second[0]} is labeled ${labels2[2]}. Angles ${and2(first[0]!, second[0]!)} each have one arc.`
        reveal = `${first[0]}${first[1]}/${second[0]}${second[1]} = ${sa}/${labels2[0]} and ${first[2]}${first[0]}/${second[2]}${second[0]} = ${sb}/${labels2[2]}, both ${qText(R(p, q))}, and the congruent angles ${first[0]} and ${second[0]} are between those sides. The SAS Similarity Theorem proves the triangles similar.`
      })
    } else {
      answer = 'none'
      traps.SSS = { id: 'geo_sss_two_pairs', witness: TWO_PAIRS_W }
      marks.push((first, second, name2) => {
        aria = `No angles are marked. In triangle ${first.join('')}, side ${first[0]}${first[1]} is labeled ${sa} and side ${first[2]}${first[0]} is labeled ${sb}. In triangle ${name2}, side ${second[0]}${second[1]} is labeled ${labels2[0]} and side ${second[2]}${second[0]} is labeled ${labels2[2]}.`
        reveal = 'Two pairs of sides are in proportion, but the third pair has no numbers and no angle is marked. Two pairs of sides alone do not prove triangles similar.'
      })
    }
  } else {
    // Angle families: aa-arcs, aa-numbers, aa-right, one-angle.
    if (right) {
      const acute = rng.int(30, 60)
      if (Math.abs(acute - 45) < 5) return null
      // Right angle at vertex 2.
      const raw = triFromAngles(acute, 90 - acute, 1)
      t1 = scaled(raw, 6)
      t2 = scaled(t1, factor)
      answer = 'AA'
      traps.none = { id: 'geo_similarity_test_missed', witness: SIM_W.right }
      marks.push((first, second) => {
        angles.push(rightMark(first, 2), rightMark(second, 2), arcMark(first, 0, 1), arcMark(second, 0, 1))
        aria = `Angles ${and2(first[2]!, second[2]!)} are right angles. Angles ${and2(first[0]!, second[0]!)} each have one arc.`
        reveal = `The right angles ${first[2]} and ${second[2]} are congruent, and the arcs give angle ${first[0]} ≅ angle ${second[0]}: two pairs of congruent angles, so the AA Similarity Postulate proves the triangles similar.`
      })
    } else {
      const [a0, a1] = ang!
      t1 = scaled(triFromAngles(a0, a1, 1), 6)
      const i = rng.int(0, 2)
      const j = (i + rng.int(1, 2)) % 3
      const m = 3 - i - j
      if (family === 'one-angle') {
        const similar = rng.chance(0.5)
        if (similar) t2 = scaled(t1, factor)
        else {
          // Same angle at vertex i, a different second angle.
          const other = ang![j]! + (rng.chance(0.5) ? 1 : -1) * rng.int(14, 26)
          const angs = [0, 0, 0]
          angs[i] = ang![i]!
          angs[j] = other
          angs[m] = 180 - angs[i]! - other
          if (angs.some((g) => g < 28 || g > 120 || Math.abs(g - 90) < 6)) return null
          t2 = scaled(triFromAngles(angs[0]!, angs[1]!, 1), 6 * factor)
        }
        answer = 'none'
        traps.AA = { id: 'geo_aa_one_angle', witness: ONE_ANGLE_W }
        marks.push((first, second) => {
          angles.push(arcMark(first, i, 1), arcMark(second, i, 1))
          aria = `Angles ${and2(first[i]!, second[i]!)} each have one arc. Nothing else is marked.`
          reveal = 'One pair of congruent angles is marked and nothing else is given. One pair of angles does not prove triangles similar.'
        })
      } else {
        t2 = scaled(t1, factor)
        answer = 'AA'
        if (family === 'aa-arcs') {
          traps.none = { id: 'geo_similarity_test_missed', witness: SIM_W.angles }
          marks.push((first, second) => {
            angles.push(arcMark(first, i, 1), arcMark(second, i, 1), arcMark(first, j, 2), arcMark(second, j, 2))
            aria = `Angles ${and2(first[i]!, second[i]!)} each have one arc. Angles ${and2(first[j]!, second[j]!)} each have two arcs.`
            reveal = `The arcs give angle ${first[i]} ≅ angle ${second[i]} and angle ${first[j]} ≅ angle ${second[j]}: two pairs of congruent angles, so the AA Similarity Postulate proves the triangles similar.`
          })
        } else {
          // Numbers: two angles of each triangle, the second triangle's sometimes the third angle of the first.
          const thirdWay = rng.chance(0.6)
          const k2 = thirdWay ? m : j
          traps.none = { id: 'geo_similarity_test_missed', witness: SIM_W.numbers }
          marks.push((first, second, name2) => {
            angles.push(numberMark(first, i, ang![i]!), numberMark(first, j, ang![j]!), numberMark(second, i, ang![i]!), numberMark(second, k2, ang![k2]!))
            aria = `In triangle ${first.join('')}, angle ${first[i]} is labeled ${ang![i]}° and angle ${first[j]} is labeled ${ang![j]}°. In triangle ${name2}, angle ${second[i]} is labeled ${ang![i]}° and angle ${second[k2]} is labeled ${ang![k2]}°.`
            reveal = thirdWay
              ? `The third angle of ${first.join('')} is 180 − ${ang![i]} − ${ang![j]} = ${ang![m]}°, so angle ${first[i]} ≅ angle ${second[i]} and angle ${first[m]} ≅ angle ${second[m]}: two pairs of congruent angles, so the AA Similarity Postulate proves the triangles similar.`
              : `Angle ${first[i]} ≅ angle ${second[i]} and angle ${first[j]} ≅ angle ${second[j]}: two pairs of congruent angles, so the AA Similarity Postulate proves the triangles similar.`
          })
        }
      }
    }
  }
  return finishSeparate(rng, family, t1, t2, labels1, labels2, angles, () => aria, () => reveal, traps, answer, marks, prefer)
}

function sidesText(ids: readonly string[], labels: readonly (string | null)[]): string {
  const parts = labels.map((l, i) => (l ? `side ${ids[i]}${ids[(i + 1) % 3]} is labeled ${l}` : null)).filter((s): s is string => s !== null)
  return parts.length > 2 ? `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}` : parts.join(' and ')
}

function finishSeparate(
  rng: Rng,
  family: string,
  t1: XY[],
  t2: XY[],
  labels1: (string | null)[],
  labels2: (string | null)[],
  angles: GeoAngleMark[],
  aria: () => string,
  reveal: () => string,
  traps: ProveScene['traps'],
  answer: SimMethod,
  marks: ((first: string[], second: string[], name2: string) => void)[],
  prefer?: SimMethod,
): ProveScene | null {
  const pair = separatePair(rng, t1, t2, family === 'ssa' ? 20 : 25)
  if (!pair) return null
  const t2name = aroundName(rng, pair.second)
  for (const m of marks) m(pair.first, pair.second, t2name)
  const points = [...points6(pair.first, pair.p1, pair.p1), ...points6(pair.second, pair.p2, pair.p2)]
  const segments = [...triSegments(pair.first, labels1), ...triSegments(pair.second, labels2)]
  return {
    family,
    answer,
    t1: pair.first.join(''),
    t2: t2name,
    figure: { points, segments, ...(angles.length ? { angles } : {}) },
    outlines: [pair.first, pair.second],
    aria: `Triangles ${pair.first.join('')} and ${t2name}. ${aria()}`,
    reveal: reveal(),
    traps,
    ...(prefer ? { prefer } : {}),
  }
}

/**
 * Triangle ABC with D on AB and E on AC, and segment DE: triangles ADE and ABC share the angle at A. A sits at the
 * bottom, so the dimension lines of the pieces of AB and AC fall outside the triangle.
 */
interface Overlap {
  A: string
  B: string
  C: string
  D: string
  E: string
  pA: XY
  pB: XY
  pC: XY
  pD: XY
  pE: XY
}

export function overlapShape(rng: Rng, angleA: number, ab: number, ac: number, ad: number, ae: number, tiltSpread = 14): Overlap {
  const [A, B, C, D, E] = pickLetters6(rng, 5)
  // Each side keeps at least 16° from the vertical: GeoFigure puts a nearly vertical segment's dimension line on its
  // right, which is inside the triangle for the left side.
  const room = Math.max(0, angleA / 2 - 16)
  const tilt = Math.max(-room, Math.min(room, rng.int(-tiltSpread, tiltSpread)))
  const flip = rng.chance(0.5)
  // A at the origin; AB and AC open upward around the vertical, by the angle at A.
  const dirB = 90 + (flip ? -1 : 1) * (angleA / 2) + tilt
  const dirC = 90 - (flip ? -1 : 1) * (angleA / 2) + tilt
  const u = (deg: number) => ({ x: Math.cos(rad(deg)), y: Math.sin(rad(deg)) })
  const pA = { x: 0, y: 0 }
  const pB = { x: u(dirB).x * ab, y: u(dirB).y * ab }
  const pC = { x: u(dirC).x * ac, y: u(dirC).y * ac }
  const pD = along(pA, pB, ad / ab)
  const pE = along(pA, pC, ae / ac)
  return { A: A!, B: B!, C: C!, D: D!, E: E!, pA, pB, pC, pD, pE }
}

function overlapPoints(o: Overlap): GeoPoint[] {
  const tri = [o.pA, o.pB, o.pC]
  const c = centroid(tri)
  const away = (p: XY) => {
    const dx = p.x - c.x
    const dy = p.y - c.y
    const ax = Math.abs(dx)
    const ay = Math.abs(dy)
    if (ay >= ax * 1.3) return dy >= 0 ? ('above' as const) : ('below' as const)
    if (ax >= ay * 1.3) return dx >= 0 ? ('right' as const) : ('left' as const)
    return dx >= 0 ? (dy >= 0 ? ('above-right' as const) : ('below-right' as const)) : dy >= 0 ? ('above-left' as const) : ('below-left' as const)
  }
  return [
    pointAt(o.A, o.pA, 'below'),
    pointAt(o.B, o.pB, away(o.pB)),
    pointAt(o.C, o.pC, away(o.pC)),
    pointAt(o.D, o.pD, away(o.pD)),
    pointAt(o.E, o.pE, away(o.pE)),
  ]
}

function overlapScene(rng: Rng, family: string): ProveScene | null {
  const angleA = rng.int(38, 78)
  const ab = rng.int(9, 15)
  const ac = rng.int(9, 15)
  if (Math.abs(ab - ac) < 2) return null
  const traps: ProveScene['traps'] = {}
  if (family === 'sas-shared') {
    // AD/AB = AE/AC with whole pieces: AD = p·m, DB = (q − p)·m, AE = p·n, EC = (q − p)·n.
    const [p, q] = rng.pick([
      [1, 3], [2, 3], [2, 5], [3, 5], [1, 2], [3, 4], [2, 7], [3, 7], [4, 7],
    ] as const)
    const m = rng.int(2, 6)
    const n = rng.int(2, 6)
    if (m === n) return null
    const AD = p * m
    const DB = (q - p) * m
    const AE = p * n
    const EC = (q - p) * n
    const o = overlapShape(rng, angleA, AD + DB, AE + EC, AD, AE)
    if (!readable([o.pA, o.pB, o.pC], 30, 0.45)) return null
    traps.none = { id: 'geo_shared_angle_missed', witness: `Angle ${o.A} is in both triangles. It is congruent to itself, so it counts as a pair.` }
    traps.SSS = { id: 'geo_sss_two_pairs', witness: TWO_PAIRS_W }
    const segments: GeoSegment[] = [
      { from: o.A, to: o.D, label: String(AD) },
      { from: o.D, to: o.B, label: String(DB) },
      { from: o.A, to: o.E, label: String(AE) },
      { from: o.E, to: o.C, label: String(EC) },
      { from: o.B, to: o.C },
      { from: o.D, to: o.E },
    ]
    return {
      family,
      answer: 'SAS',
      t1: `${o.A}${o.D}${o.E}`,
      t2: `${o.A}${o.B}${o.C}`,
      figure: { points: overlapPoints(o), segments },
      parts: [0, 1, 2, 3],
      outlines: [[o.A, o.B, o.C]],
      aria: `Triangle ${o.A}${o.B}${o.C} with ${o.D} on ${o.A}${o.B} and ${o.E} on ${o.A}${o.C}, and segment ${o.D}${o.E}. ${o.A}${o.D} is labeled ${AD}, ${o.D}${o.B} is labeled ${DB}, ${o.A}${o.E} is labeled ${AE}, and ${o.E}${o.C} is labeled ${EC}. No angles are marked.`,
      reveal: `Angle ${o.A} is in both triangles. ${o.A}${o.D}/${o.A}${o.B} = ${AD}/${AD + DB} and ${o.A}${o.E}/${o.A}${o.C} = ${AE}/${AE + EC}, both ${qText(R(p, q))}, so the sides around angle ${o.A} are in proportion. The SAS Similarity Theorem proves the triangles similar.`,
      traps,
      prefer: 'none',
    }
  }
  // The pieces are not numbered here, so any whole sizes do; DE is parallel to BC, or makes the angle at D congruent
  // to the angle at C (the reverse pairing), or for shared-only either way or neither.
  const kind = family === 'aa-parallel' ? 'parallel' : family === 'aa-shared' ? (rng.chance(0.5) ? 'parallel' : 'reverse') : rng.pick(['parallel', 'reverse', 'tilted'] as const)
  const t = 0.42 + rng.next() * 0.2
  let ad = ab * t
  let ae = ac * t
  if (kind === 'reverse') {
    // AD·AB = AE·AC puts D and E where angle ADE equals angle ACB.
    ad = ac * t
    ae = (ad * ab) / ac
    if (ad > 0.8 * ab || ae > 0.8 * ac) return null
  } else if (kind === 'tilted') {
    ae = ac * (t + (rng.chance(0.5) ? 0.17 : -0.17))
  }
  const o = overlapShape(rng, angleA, ab, ac, ad, ae, 40)
  if (!readable([o.pA, o.pB, o.pC], 30, 0.45)) return null
  if (!readable([o.pA, o.pD, o.pE], 20, 0.25)) return null
  const segments: GeoSegment[] = [
    { from: o.A, to: o.B },
    { from: o.A, to: o.C },
  ]
  const lines: GeoLine[] = []
  const angles: GeoAngleMark[] = []
  const base = `Triangle ${o.A}${o.B}${o.C} with ${o.D} on ${o.A}${o.B} and ${o.E} on ${o.A}${o.C}`
  let aria: string
  let reveal: string
  let answer: SimMethod
  if (family === 'aa-parallel') {
    lines.push({ through: [o.D, o.E], arrows: 1 }, { through: [o.B, o.C], arrows: 1 })
    answer = 'AA'
    traps.none = { id: 'geo_similarity_test_missed', witness: SIM_W.parallel }
    aria = `${base}. Lines ${o.D}${o.E} and ${o.B}${o.C} each have one arrow, marking them parallel. No angles are marked.`
    reveal = `The parallel lines make corresponding angles congruent: angle ${o.A}${o.D}${o.E} ≅ angle ${o.A}${o.B}${o.C}. Angle ${o.A} is in both triangles. Two pairs of congruent angles: the AA Similarity Postulate proves the triangles similar.`
  } else {
    segments.push({ from: o.B, to: o.C }, { from: o.D, to: o.E })
    if (family === 'aa-shared') {
      const partner = kind === 'parallel' ? o.B : o.C
      const partnerFrom = kind === 'parallel' ? o.A : o.A
      const partnerTo = kind === 'parallel' ? o.C : o.B
      angles.push({ vertex: o.D, from: o.A, to: o.E, marks: 1 }, { vertex: partner, from: partnerFrom, to: partnerTo, marks: 1 })
      answer = 'AA'
      traps.none = { id: 'geo_shared_angle_missed', witness: `Angle ${o.A} is in both triangles. It is congruent to itself, so it counts as a pair along with the marked angles.` }
      aria = `${base}, and segment ${o.D}${o.E}. Angles ${o.A}${o.D}${o.E} and ${o.A}${partner}${partnerTo} each have one arc.`
      reveal = `The arcs give angle ${o.A}${o.D}${o.E} ≅ angle ${o.A}${partner}${partnerTo}, and angle ${o.A} is in both triangles. Two pairs of congruent angles: the AA Similarity Postulate proves the triangles similar.`
    } else {
      answer = 'none'
      traps.AA = { id: 'geo_aa_one_angle', witness: `Angle ${o.A} is in both triangles, so it is one pair of congruent angles. Nothing else is marked, and one pair is not enough.` }
      aria = `${base}, and segment ${o.D}${o.E}. Nothing is marked.`
      reveal = `Angle ${o.A} is in both triangles, but that is the only pair the figure gives. One pair of angles does not prove triangles similar.`
    }
  }
  return {
    family,
    answer,
    t1: `${o.A}${o.D}${o.E}`,
    t2: `${o.A}${o.B}${o.C}`,
    figure: { points: overlapPoints(o), segments, ...(lines.length ? { lines } : {}), ...(angles.length ? { angles } : {}) },
    outlines: [[o.A, o.B, o.C]],
    aria,
    reveal,
    traps,
  }
}

/**
 * An hourglass: A, E, C in a line and B, E, D in a line, with AB and CD drawn. Triangles ABE and CDE meet at E, where
 * the vertical angles are congruent. Drawn with AB parallel to CD (the triangles similar) or not.
 */
function hourglassScene(rng: Rng, family: string): ProveScene | null {
  const [A, B, C, D, E] = pickLetters6(rng, 5)
  const ang = scaleneAngles(rng)
  if (!ang) return null
  // Triangle ABE: angle at A is ang[0], at B ang[1], at E ang[2]; E at the origin after a shift.
  const t = triFromAngles(ang[0], ang[1], 6)
  const pA0 = t[0]
  const pB0 = t[1]
  const pE0 = t[2]
  const k = rng.pick([0.6, 0.7, 0.8, 1.25, 1.4, 1.6])
  const parallel = family === 'aa-vertical' || rng.chance(0.5)
  // C and D on the far side of E: the point reflection through E, scaled (AB ∥ CD), or with D moved along its line.
  const toward = (p: XY, s: number) => ({ x: pE0.x + (pE0.x - p.x) * s, y: pE0.y + (pE0.y - p.y) * s })
  const pC0 = toward(pA0, k)
  const pD0 = toward(pB0, parallel ? k : k * (rng.chance(0.5) ? 1.45 : 0.62))
  const all = turned([pA0, pB0, pC0, pD0, pE0], rng.int(0, 359), rng.chance(0.5))
  const [pA, pB, pC, pD, pE] = all as [XY, XY, XY, XY, XY]
  if (!readable([pA, pB, pE], 26, 0.3) || !readable([pC, pD, pE], 22, 0.25)) return null
  const pts = [pA, pB, pC, pD, pE]
  const points = points6([A!, B!, C!, D!, E!], pts, pts)
  // E sits on two segments: its letter starts on the side away from AB.
  points[4] = { ...points[4]!, labelSide: 'right' }
  const segments: GeoSegment[] = [
    { from: A!, to: B! },
    { from: C!, to: D! },
    { from: A!, to: E! },
    { from: E!, to: C! },
    { from: B!, to: E! },
    { from: E!, to: D! },
  ]
  const traps: ProveScene['traps'] = {}
  const angles: GeoAngleMark[] = []
  let aria = `Segments ${A}${C} and ${B}${D} cross at ${E}, and segments ${A}${B} and ${C}${D} are drawn.`
  let reveal: string
  let answer: SimMethod
  if (family === 'aa-vertical') {
    // Alternate interior angles at A and C (AB ∥ CD), marked congruent.
    angles.push({ vertex: A!, from: B!, to: E!, marks: 1 }, { vertex: C!, from: D!, to: E!, marks: 1 })
    answer = 'AA'
    traps.none = { id: 'geo_vertical_angles_missed', witness: `Segments ${A}${C} and ${B}${D} cross at ${E}, so the angles at ${E} are vertical angles, and vertical angles are congruent. That pair counts.` }
    aria += ` Angles ${B}${A}${E} and ${D}${C}${E} each have one arc.`
    reveal = `The arcs give angle ${B}${A}${E} ≅ angle ${D}${C}${E}, and the angles at ${E} are vertical angles, so they are congruent. Two pairs of congruent angles: the AA Similarity Postulate proves the triangles similar.`
  } else {
    answer = 'none'
    traps.AA = { id: 'geo_aa_one_angle', witness: `The angles at ${E} are vertical angles, so they are one pair of congruent angles. Nothing else is marked, and one pair is not enough.` }
    aria += ' Nothing is marked.'
    reveal = `The vertical angles at ${E} are one pair of congruent angles, and nothing else is given. One pair of angles does not prove triangles similar.`
  }
  return {
    family,
    answer,
    t1: `${A}${B}${E}`,
    t2: `${C}${D}${E}`,
    figure: { points, segments, ...(angles.length ? { angles } : {}) },
    outlines: [
      [A!, B!, E!],
      [C!, D!, E!],
    ],
    aria,
    reveal,
    traps,
  }
}

// =================================================================================================================
// gt.solve
// =================================================================================================================

type SolveKind = 'parallel' | 'reverse' | 'right' | 'shadow' | 'mirror'

export function drawSimilarSolve(seed: number): GeoBuilt {
  const kind = weighted<SolveKind>(makeRng(mixSeed(seed, 6400)), [
    ['parallel', 25],
    ['reverse', 20],
    ['right', 20],
    ['shadow', 20],
    ['mirror', 15],
  ])
  for (let attempt = 0; attempt < 500; attempt++) {
    const rng = makeRng(mixSeed(seed, 6401 + attempt))
    const built =
      kind === 'parallel' ? solveParallel(rng, seed) : kind === 'reverse' ? solveReverse(rng, seed) : kind === 'right' ? solveRight(rng, seed) : solveStory(rng, seed, kind)
    if (built) return built
  }
  throw new Error(`gt.solve/${seed}: no ${kind} problem`)
}

const ORDER_W = 'That order pairs vertices whose angles do not match. The letters have to follow the congruent angles, first with first, second with second, third with third.'

/**
 * The statement choices: the first triangle written as given, and the second triangle's letters in every order but
 * one that is true. Exactly one order makes every pair of angles match; the figure is drawn to scale, so this is
 * checked on the drawing. `position` is the order a student who pairs by the picture would write.
 */
function statementChoices(
  first: [string, string, string],
  second: [string, string, string],
  at: (id: string) => XY,
  position: [string, string, string] | null,
  positionWitness: string,
  rng: Rng,
): { choices: ChoiceDraft6[]; answerId: string; answerText: string } | null {
  const t1 = first.map(at) as [XY, XY, XY]
  const orders = PERMS3.map((perm) => perm.map((i) => second[i]!) as [string, string, string])
  const truth = orders.filter((o) => sameAngles(t1, o.map(at) as [XY, XY, XY], 0.2))
  if (truth.length !== 1) return null
  const right = truth[0]!
  const name = (o: readonly string[]) => `△${first.join('')} ~ △${o.join('')}`
  const wrong = orders.filter((o) => o.join('') !== right.join(''))
  const picked: ChoiceDraft6[] = []
  const pos = position && position.join('') !== right.join('') ? position : null
  if (pos) picked.push({ id: `s-${pos.join('')}`, text: name(pos), trap: 'geo_matched_by_position', witness: positionWitness })
  for (const o of rng.shuffle(wrong)) {
    if (picked.length >= 3) break
    if (pos && o.join('') === pos.join('')) continue
    picked.push({ id: `s-${o.join('')}`, text: name(o), trap: 'geo_vertices_out_of_order', witness: ORDER_W })
  }
  const answerId = `s-${right.join('')}`
  return { choices: [{ id: answerId, text: name(right) }, ...picked], answerId, answerText: name(right) }
}

function statementStage(sc: { choices: ChoiceDraft6[]; answerId: string }, reveal: string, seed: number): Stage6 {
  return choiceStage6({
    id: 'a',
    label: 'Similarity statement',
    choices: sc.choices,
    answerId: sc.answerId,
    nudge: 'Find the pairs of congruent angles first. Then write the vertices in that order: a vertex goes in the same place in both names as the vertex it matches.',
    ruleCard: UNIT6_RULE_IDS.statement,
    reveal: [reveal],
    seed,
    salt: 6402,
  })
}

function solveFinish(
  kind: SolveKind,
  prompt: string,
  figure: GeoFigureSpec | null,
  stages: Stage6[],
  lengths: number[],
  params: Record<string, string | number | boolean>,
  promise: ErrorPatternId[],
  title: string,
): GeoBuilt | null {
  if (!figure) return null
  return finish6({
    question: 'similarSolve',
    prompt,
    figure,
    stages,
    lengths: lengths.filter((v) => Number.isInteger(v) && v > 0),
    angles: [],
    title,
    instructions: SOLVE_INSTRUCTIONS,
    params: { case: kind, ...params },
    cards: SIMILAR_RULES,
    promise,
  })
}

const ratioPairs = [
  [1, 3], [2, 3], [2, 5], [3, 5], [1, 2], [3, 4], [2, 7], [3, 7], [4, 7], [3, 8], [5, 8], [4, 9],
] as const

/** DE ∥ BC inside triangle ABC: triangle ADE ~ triangle ABC. x is DE, BC, AD, or DB. */
function solveParallel(rng: Rng, seed: number): GeoBuilt | null {
  const [p, q] = rng.pick(ratioPairs)
  const m = rng.int(1, 5)
  const n = rng.int(1, 5)
  // AD = p·m, AB = q·m (DB = (q − p)·m), DE = p·n, BC = q·n.
  const AD = p * m
  const DB = (q - p) * m
  const DE = p * n
  const BC = q * n
  if (AD < 2 || DB < 2 || DE < 2 || BC > 60 || AD + DB > 60) return null
  if (Math.min(AD, DB) < 0.24 * (AD + DB)) return null
  const ask = rng.pick(['DE', 'BC', 'AD', 'DB'] as const)
  const value = { DE, BC, AD, DB }[ask]
  if (RESERVED6_NUMBERS.has(value)) return null
  // A triangle with AB = AD + DB and BC as drawn, and AC whatever makes a readable triangle.
  const ab = AD + DB
  const ac = ab * (0.7 + rng.next() * 0.6)
  const cosA = (ab * ab + ac * ac - BC * BC) / (2 * ab * ac)
  if (!(cosA > -0.6 && cosA < 0.85)) return null
  const angleA = (Math.acos(cosA) * 180) / Math.PI
  const o = overlapShape(rng, angleA, ab, ac, AD, (AD / ab) * ac)
  if (!readable([o.pA, o.pB, o.pC], 30, 0.4)) return null
  const at = pointLookup(o)
  const labelOf = (name: string) => (name === ask ? 'x' : String({ DE, BC, AD, DB }[name as 'DE']))
  const segments: GeoSegment[] = [
    { from: o.A, to: o.D, label: labelOf('AD') },
    { from: o.D, to: o.B, label: labelOf('DB') },
    { from: o.A, to: o.C },
    { from: o.D, to: o.E, label: labelOf('DE') },
    { from: o.B, to: o.C, label: labelOf('BC') },
  ]
  const names = { AD: `${o.A}${o.D}`, DB: `${o.D}${o.B}`, DE: `${o.D}${o.E}`, BC: `${o.B}${o.C}`, AB: `${o.A}${o.B}` }
  const sc = statementChoices([o.A, o.D, o.E], [o.A, o.B, o.C], at, null, '', rng)
  if (!sc) return null
  // x from DE/BC = AD/AB, written with x where it is.
  const X = lin6(1, 0)
  const e = (name: 'AD' | 'DB' | 'DE' | 'BC'): LinQ => (name === ask ? X : konst({ DE, BC, AD, DB }[name]))
  const AB = ask === 'AD' ? lin6(1, DB) : ask === 'DB' ? lin6(1, AD) : konst(AD + DB)
  // Right: DE · AB = BC · AD.
  const right = lsolveProducts(e('DE'), AB, e('BC'), e('AD'))
  if (!right || !isWhole(right) || right.n !== value) return null
  const traps: TrapDraft6[] = []
  // The part over the part: DE/BC = AD/DB.
  const partPart = lsolveProducts(e('DE'), e('DB'), e('BC'), e('AD'))
  if (positive(partPart)) {
    traps.push({
      id: 'geo_part_over_whole',
      stage: 'x',
      text: qText(partPart),
      witness: `That x makes ${names.DE}/${names.BC} equal ${names.AD}/${names.DB}. ${names.DE} and ${names.BC} are sides of the two triangles, so the ratio to match is ${names.AD} over the whole side ${names.AB}, not over the other piece ${names.DB}.`,
    })
  }
  // One ratio upside down: DE/BC = AB/AD.
  const flipped = lsolveProducts(e('DE'), e('AD'), e('BC'), AB)
  if (positive(flipped)) {
    traps.push({ id: 'geo_one_ratio_inverted', stage: 'x', text: qText(flipped), witness: `That x makes ${names.DE}/${names.BC} equal ${names.AB}/${names.AD}: one ratio has the small triangle on top and the other has the large triangle on top.` })
  }
  const statement = sc.answerText
  const prompt = `In the figure, ${names.DE} ∥ ${names.BC}, ${names.AD} = ${labelOf('AD')}, ${names.DB} = ${labelOf('DB')}, ${names.DE} = ${labelOf('DE')}, and ${names.BC} = ${labelOf('BC')}. Choose the true similarity statement, then find x.`
  const shown = `${names.DE}/${names.BC} = ${names.AD}/${names.AB}`
  const stages = [
    statementStage(sc, `${names.DE} ∥ ${names.BC} makes angle ${o.A}${o.D}${o.E} ≅ angle ${o.A}${o.B}${o.C} and angle ${o.A}${o.E}${o.D} ≅ angle ${o.A}${o.C}${o.B}, and angle ${o.A} is shared, so ${statement}.`, seed),
    numberStage6({
      id: 'x',
      label: 'x',
      hint: X_HINT6,
      answerText: String(value),
      nudge: `Write a ratio of corresponding sides from each triangle. ${names.AB} is the whole side, ${names.AD} + ${names.DB}.`,
      ruleCard: UNIT6_RULE_IDS.proportion,
      reveal: [`Corresponding sides are in proportion: ${shown}, with ${names.AB} = ${ask === 'AD' ? `x + ${DB}` : ask === 'DB' ? `${AD} + x` : `${AD} + ${DB} = ${AD + DB}`}. ${crossText(`${pshow(e('DE'), AB)} = ${pshow(e('BC'), e('AD'))}`, lprod(e('DE'), AB)!, lprod(e('BC'), e('AD'))!)}`],
      traps,
    }),
  ]
  const aria = `Triangle ${o.A}${o.B}${o.C} with ${o.D} on ${o.A}${o.B} and ${o.E} on ${o.A}${o.C}, and segment ${o.D}${o.E}. ${names.AD} is labeled ${labelOf('AD')}, ${names.DB} is labeled ${labelOf('DB')}, ${names.DE} is labeled ${labelOf('DE')}, and ${names.BC} is labeled ${labelOf('BC')}.`
  const figure = placeLabels6({ ariaLabel: aria, points: overlapPoints(o), segments }, [[o.A, o.B, o.C]], new Set([0, 1]))
  return solveFinish('parallel', prompt, figure, stages, [AD, DB, DE, BC], { ask, x: value }, rng.pick<ErrorPatternId[]>([['geo_part_over_whole'], ['geo_vertices_out_of_order'], ['geo_part_over_whole', 'geo_one_ratio_inverted']]), 'Similar triangles inside a triangle')
}

/** The products of a proportion e1/e2 = e3/e4 cross-multiplied the given way, solved for x when linear. */
function lsolveProducts(l1: LinQ, l2: LinQ, r1: LinQ, r2: LinQ): Rational | null {
  const left = lprod(l1, l2)
  const right = lprod(r1, r2)
  if (!left || !right) return null
  return lsolve(left, right)
}

/** "15(x + 4)", "6x", "8 · 15". */
function pshow(e: LinQ, f: LinQ): string {
  const show = (g: LinQ) => {
    if (g.a.n === 0) return qShow(g.b)
    const head = g.a.n === g.a.d ? 'x' : `${qShow(g.a)}x`
    if (g.b.n === 0) return head
    return `${head} + ${qShow(g.b)}`
  }
  const isNum = (g: LinQ) => g.a.n === 0
  if (isNum(e) && isNum(f)) return `${show(e)} · ${show(f)}`
  const [num, other] = isNum(e) ? [e, f] : [f, e]
  if (!isNum(num)) return `${show(e)} · ${show(f)}`
  if (other.b.n === 0) return `${qShow(ratMul(num.b, other.a))}x`
  return `${show(num)}(${show(other)})`
}

function pointLookup(o: Overlap): (id: string) => XY {
  const map = new Map<string, XY>([
    [o.A, o.pA],
    [o.B, o.pB],
    [o.C, o.pC],
    [o.D, o.pD],
    [o.E, o.pE],
  ])
  return (id) => {
    const p = map.get(id)
    if (!p) throw new Error(`no point ${id}`)
    return { x: r2(p.x), y: r2(p.y) }
  }
}

/**
 * Angle ADE ≅ angle ACB inside triangle ABC (D on AB, E on AC): triangle ADE ~ triangle ACB, so AD/AC = AE/AB.
 * Pairing D with B because D lies on AB is the slip. x is DB or EC, so the equation stays linear.
 */
function solveReverse(rng: Rng, seed: number): GeoBuilt | null {
  // AD·AB = AE·AC with whole pieces.
  const AD = rng.int(2, 9)
  const AE = rng.int(2, 9)
  if (AD === AE) return null
  const AB = rng.int(AD + 2, 20)
  const ACq = ratDiv(R(AD * AB), R(AE))
  if (!isWhole(ACq)) return null
  const AC = ACq.n
  if (AC <= AE + 1 || AC > 24) return null
  const DB = AB - AD
  const EC = AC - AE
  if (Math.min(AD, DB, AE, EC) < 0.24 * Math.max(AB, AC)) return null
  // The triangle: AB and AC with the angle at A; the angle at D then equals the angle at C.
  const angleA = rng.int(40, 80)
  const o = overlapShape(rng, angleA, AB, AC, AD, AE)
  if (!readable([o.pA, o.pB, o.pC], 30, 0.4)) return null
  const at = pointLookup(o)
  const ask = rng.pick(['DB', 'EC'] as const)
  const value = ask === 'DB' ? DB : EC
  if (RESERVED6_NUMBERS.has(value)) return null
  const labelOf = (name: 'AD' | 'DB' | 'AE' | 'EC') => (name === ask ? 'x' : String({ AD, DB, AE, EC }[name]))
  const segments: GeoSegment[] = [
    { from: o.A, to: o.D, label: labelOf('AD') },
    { from: o.D, to: o.B, label: labelOf('DB') },
    { from: o.A, to: o.E, label: labelOf('AE') },
    { from: o.E, to: o.C, label: labelOf('EC') },
    { from: o.B, to: o.C },
    { from: o.D, to: o.E },
  ]
  const angles: GeoAngleMark[] = [
    { vertex: o.D, from: o.A, to: o.E, marks: 1 },
    { vertex: o.C, from: o.A, to: o.B, marks: 1 },
  ]
  const names = { AD: `${o.A}${o.D}`, DB: `${o.D}${o.B}`, AE: `${o.A}${o.E}`, EC: `${o.E}${o.C}`, AB: `${o.A}${o.B}`, AC: `${o.A}${o.C}` }
  const sc = statementChoices(
    [o.A, o.D, o.E],
    [o.A, o.B, o.C],
    at,
    [o.A, o.B, o.C],
    `That statement pairs ${o.D} with ${o.B} because ${o.D} lies on ${names.AB}. The marked angles decide which vertices correspond, not the side a point lies on.`,
    rng,
  )
  if (!sc) return null
  const X = lin6(1, 0)
  const e = (name: 'AD' | 'AE'): LinQ => konst(name === 'AD' ? AD : AE)
  const ABe = ask === 'DB' ? lin6(1, AD) : konst(AB)
  const ACe = ask === 'EC' ? lin6(1, AE) : konst(AC)
  // Right: AD/AC = AE/AB, so AD·AB = AE·AC.
  const right = lsolveProducts(e('AD'), ABe, e('AE'), ACe)
  if (!right || !isWhole(right) || right.n !== value) return null
  const traps: TrapDraft6[] = []
  // By position: AD/AB = AE/AC, so AD·AC = AE·AB.
  const byPosition = lsolveProducts(e('AD'), ACe, e('AE'), ABe)
  if (positive(byPosition)) {
    traps.push({
      id: 'geo_matched_by_position',
      stage: 'x',
      text: qText(byPosition),
      witness: `That x makes ${names.AD}/${names.AB} equal ${names.AE}/${names.AC}, pairing each piece with the side it lies on. The marked angles pair ${names.AD} with ${names.AC} and ${names.AE} with ${names.AB}.`,
    })
  }
  // A piece over a piece: AD/DB = AE/EC (true only if DE were parallel to BC).
  const pieces = lsolveProducts(e('AD'), ask === 'EC' ? X : konst(EC), e('AE'), ask === 'DB' ? X : konst(DB))
  if (positive(pieces)) {
    traps.push({
      id: 'geo_part_over_whole',
      stage: 'x',
      text: qText(pieces),
      witness: `That x makes ${names.AD}/${names.DB} equal ${names.AE}/${names.EC}, a piece over a piece. That holds when a segment is parallel to the third side; here the triangles are similar, so compare whole sides of the two triangles.`,
    })
  }
  const prompt = `In the figure, ∠${o.A}${o.D}${o.E} ≅ ∠${o.A}${o.C}${o.B}, ${names.AD} = ${labelOf('AD')}, ${names.DB} = ${labelOf('DB')}, ${names.AE} = ${labelOf('AE')}, and ${names.EC} = ${labelOf('EC')}. Choose the true similarity statement, then find x.`
  const stages = [
    statementStage(sc, `Angle ${o.A}${o.D}${o.E} ≅ angle ${o.A}${o.C}${o.B} and angle ${o.A} is shared, so ${o.D} goes with ${o.C} and ${o.E} with ${o.B}: ${sc.answerText}.`, seed),
    numberStage6({
      id: 'x',
      label: 'x',
      hint: X_HINT6,
      answerText: String(value),
      nudge: `Follow the similarity statement: ${names.AD} goes with the side of the large triangle in the same place in its name.`,
      ruleCard: UNIT6_RULE_IDS.proportion,
      reveal: [`From ${sc.answerText}: ${names.AD}/${names.AC} = ${names.AE}/${names.AB}, with ${names.AB} = ${ask === 'DB' ? `${AD} + x` : `${AD} + ${DB} = ${AB}`} and ${names.AC} = ${ask === 'EC' ? `${AE} + x` : `${AE} + ${EC} = ${AC}`}. ${crossText(`${pshow(e('AD'), ABe)} = ${pshow(e('AE'), ACe)}`, lprod(e('AD'), ABe)!, lprod(e('AE'), ACe)!)}`],
      traps,
    }),
  ]
  const aria = `Triangle ${o.A}${o.B}${o.C} with ${o.D} on ${o.A}${o.B} and ${o.E} on ${o.A}${o.C}, and segment ${o.D}${o.E}. Angles ${o.A}${o.D}${o.E} and ${o.A}${o.C}${o.B} each have one arc. ${names.AD} is labeled ${labelOf('AD')}, ${names.DB} is labeled ${labelOf('DB')}, ${names.AE} is labeled ${labelOf('AE')}, and ${names.EC} is labeled ${labelOf('EC')}.`
  const figure = placeLabels6({ ariaLabel: aria, points: overlapPoints(o), segments, angles }, [[o.A, o.B, o.C]], new Set([0, 1, 2, 3]))
  // The drawn angle at D is the drawn angle at C.
  if (Math.abs(angleAt(o.pD, o.pA, o.pE) - angleAt(o.pC, o.pA, o.pB)) > 0.05) return null
  return solveFinish('reverse', prompt, figure, stages, [AD, DB, AE, EC], { ask, x: value }, rng.pick<ErrorPatternId[]>([['geo_matched_by_position'], ['geo_matched_by_position', 'geo_part_over_whole']]), 'Similar triangles inside a triangle')
}

/** The altitude CD to the hypotenuse of right triangle ABC: three similar triangles and the geometric mean. */
function solveRight(rng: Rng, seed: number): GeoBuilt | null {
  const [A, B, C, D] = pickLetters6(rng, 4) as [string, string, string, string]
  const AD = rng.int(2, 16)
  const DB = rng.int(2, 18)
  if (AD === DB || Math.max(AD, DB) / Math.min(AD, DB) > 4.2) return null
  const AB = AD + DB
  const ask = rng.pick(['CD', 'CD', 'AC', 'BC'] as const)
  const square = ask === 'CD' ? AD * DB : ask === 'AC' ? AD * AB : DB * AB
  const q = simplifyRadical(1, 1, square)
  if (q.rad > 30) return null
  const answerText = formatQty(q)
  if (q.rad === 1 && RESERVED6_NUMBERS.has(q.n)) return null
  // The figure: AB along the bottom, C above D.
  const h = Math.sqrt(AD * DB)
  let pts: XY[] = [
    { x: 0, y: 0 },
    { x: AB, y: 0 },
    { x: AD, y: h },
    { x: AD, y: 0 },
  ]
  pts = turned(pts, rng.int(-10, 10), rng.chance(0.5))
  const [pA, pB, pC, pD] = pts as [XY, XY, XY, XY]
  if (!readable([pA, pB, pC], 18, 0.2)) return null
  const lookup = new Map([
    [A, pA],
    [B, pB],
    [C, pC],
    [D, pD],
  ])
  const at = (id: string) => {
    const p = lookup.get(id)!
    return { x: r2(p.x), y: r2(p.y) }
  }
  const legName = ask === 'AC' ? `${A}${C}` : `${B}${C}`
  const segments: GeoSegment[] = [
    { from: A, to: D, label: String(AD) },
    { from: D, to: B, label: String(DB) },
    { from: A, to: C, ...(ask === 'AC' ? { label: 'x' } : {}) },
    { from: C, to: B, ...(ask === 'BC' ? { label: 'x' } : {}) },
    { from: C, to: D, ...(ask === 'CD' ? { label: 'x' } : {}) },
  ]
  const angles: GeoAngleMark[] = [
    { vertex: C, from: A, to: B, right: true },
    { vertex: D, from: B, to: C, right: true },
  ]
  // The statement pairs the small triangle that holds x with the triangle its ratio uses.
  const [first, second]: [[string, string, string], [string, string, string]] =
    ask === 'CD'
      ? [
          [A, D, C],
          [C, D, B],
        ]
      : ask === 'AC'
        ? [
            [A, D, C],
            [A, C, B],
          ]
        : [
            [B, D, C],
            [B, C, A],
          ]
  const sc = statementChoices(first, second, at, null, '', rng)
  if (!sc) return null
  const traps: TrapDraft6[] = []
  const xName = ask === 'CD' ? `${C}${D}` : legName
  const [m1, m2] = ask === 'CD' ? [AD, DB] : ask === 'AC' ? [AD, AB] : [DB, AB]
  const m1Name = ask === 'BC' ? `${D}${B}` : `${A}${D}`
  const m2Name = ask === 'CD' ? `${D}${B}` : `${A}${B}`
  traps.push({
    id: 'geo_geometric_as_arithmetic',
    stage: 'x',
    text: qText(ratDiv(R(m1 + m2), R(2))),
    witness: `That is the average of ${m1Name} and ${m2Name}. ${xName} is their geometric mean: the positive number whose square is their product.`,
  })
  traps.push({ id: 'geo_mean_not_rooted', stage: 'x', text: String(m1 * m2), witness: `That is ${m1Name} · ${m2Name}, which is the square of ${xName}. Take its positive square root.` })
  if (ask !== 'CD') {
    // The leg with the segment at the other end of the hypotenuse.
    const farName = ask === 'AC' ? `${D}${B}` : `${A}${D}`
    const far = ask === 'AC' ? DB : AD
    const wrong = simplifyRadical(1, 1, far * AB)
    traps.push({
      id: 'geo_matched_by_position',
      stage: 'x',
      text: formatQty(wrong),
      witness: `That pairs ${legName} with ${farName}, the segment at the far end of the hypotenuse. In the similar triangles, ${legName} goes with the segment next to it.`,
    })
  }
  const prompt = `In right triangle ${A}${B}${C}, ∠${A}${C}${B} is a right angle and ${C}${D} is the altitude to the hypotenuse, with ${A}${D} = ${AD} and ${D}${B} = ${DB}. Choose the true similarity statement, then find x, the length of ${xName}.`
  const ratio =
    ask === 'CD'
      ? `${A}${D}/${C}${D} = ${C}${D}/${D}${B}`
      : ask === 'AC'
        ? `${A}${D}/${A}${C} = ${A}${C}/${A}${B}`
        : `${B}${D}/${B}${C} = ${B}${C}/${B}${A}`
  const root = q.rad === 1 ? `${q.n}` : answerText === `√${square}` ? answerText : `√${square} = ${answerText}`
  const stages = [
    statementStage(sc, `Each small triangle shares an acute angle with the large one and has a right angle, so the three triangles are similar: ${sc.answerText}.`, seed),
    numberStage6({
      id: 'x',
      label: 'x',
      hint: MEAN_HINT6,
      answerText,
      nudge: 'Write the proportion from your similarity statement. The unknown appears twice, so cross-multiplying gives x².',
      ruleCard: UNIT6_RULE_IDS.rightMean,
      reveal: [`From ${sc.answerText}: ${ratio}, so x² = ${m1} · ${m2} = ${square} and x = ${root}.`],
      traps,
    }),
  ]
  const aria = `Right triangle ${A}${B}${C} with the right angle at ${C}, and altitude ${C}${D} to the hypotenuse ${A}${B}, with a right-angle mark at ${D}. ${A}${D} is labeled ${AD}, ${D}${B} is labeled ${DB}, and ${xName} is labeled x.`
  const points = [...points6([A, B, C], [pA, pB, pC], [pA, pB, pC]), pointAt(D, pD, 'below')]
  const figure = placeLabels6({ ariaLabel: aria, points, segments, angles }, [[A, B, C]], new Set([0, 1]))
  return solveFinish('right', prompt, figure, stages, [AD, DB], { ask, x: answerText }, ['geo_geometric_as_arithmetic', 'geo_mean_not_rooted', 'geo_matched_by_position'], 'The altitude to the hypotenuse')
}

interface Story {
  thing: string
  short: string
}

const SHADOW_THINGS: readonly Story[] = [
  { thing: 'a tree', short: 'tree' },
  { thing: 'a flagpole', short: 'flagpole' },
  { thing: 'a lamppost', short: 'lamppost' },
  { thing: 'a statue', short: 'statue' },
]
const MIRROR_THINGS: readonly Story[] = [
  { thing: 'a flagpole', short: 'flagpole' },
  { thing: 'a tree', short: 'tree' },
  { thing: 'a goalpost', short: 'goalpost' },
  { thing: 'a wall', short: 'wall' },
]

/** Shadows at the same time of day, or a mirror on the ground. */
function solveStory(rng: Rng, seed: number, kind: 'shadow' | 'mirror'): GeoBuilt | null {
  const feet = rng.chance(0.75)
  const unit = feet ? 'ft' : 'm'
  const unitWord = feet ? 'feet' : 'meters'
  const h = feet ? rng.int(4, 6) : 2
  // The tall object is t times the person: t·h whole or a half.
  const t = rng.pick([2, 2.5, 3, 3.5, 4])
  const s = feet ? rng.int(3, 12) : rng.int(2, 6)
  const S = t * s
  if (!Number.isInteger(S)) return null
  const H = t * h
  if (!Number.isInteger(H * 2)) return null
  const Hq = R(Math.round(H * 2), 2)
  if (RESERVED6_NUMBERS.has(H)) return null
  const story = rng.pick(kind === 'shadow' ? SHADOW_THINGS : MIRROR_THINGS)
  const [P, Q, Rr, A, B, C] = pickLetters6(rng, 6) as [string, string, string, string, string, string]
  // The person and the object, standing on the ground, drawn to one scale.
  let pts: XY[]
  let segments: GeoSegment[]
  let angles: GeoAngleMark[]
  let first: [string, string, string]
  let second: [string, string, string]
  let parts: number[]
  if (kind === 'shadow') {
    const gap = 0.6 * s + 0.08 * S
    // Person: foot Q, top P, shadow tip R. Object: foot B, top A, shadow tip C. The sun's rays PR and AC are parallel.
    pts = [
      { x: 0, y: h },
      { x: 0, y: 0 },
      { x: s, y: 0 },
      { x: s + gap, y: H },
      { x: s + gap, y: 0 },
      { x: s + gap + S, y: 0 },
    ]
    segments = [
      { from: P, to: Q, label: String(h) },
      { from: Q, to: Rr, label: String(s) },
      { from: P, to: Rr },
      { from: A, to: B, label: 'x' },
      { from: B, to: C, label: String(S) },
      { from: A, to: C },
    ]
    angles = [
      { vertex: Q, from: Rr, to: P, right: true },
      { vertex: B, from: C, to: A, right: true },
      { vertex: Rr, from: P, to: Q, marks: 1 },
      { vertex: C, from: A, to: B, marks: 1 },
    ]
    first = [P, Q, Rr]
    second = [A, B, C]
    parts = []
  } else {
    // Person: foot Q, eyes P. Mirror R on the ground. Object: base B, top A. The angles at the mirror are congruent.
    pts = [
      { x: 0, y: h },
      { x: 0, y: 0 },
      { x: s, y: 0 },
      { x: s + S, y: H },
      { x: s + S, y: 0 },
    ]
    segments = [
      { from: P, to: Q, label: String(h) },
      { from: Q, to: Rr, label: String(s) },
      { from: Rr, to: B, label: String(S) },
      { from: B, to: A, label: 'x' },
      { from: P, to: Rr },
      { from: Rr, to: A },
    ]
    angles = [
      { vertex: Q, from: Rr, to: P, right: true },
      { vertex: B, from: Rr, to: A, right: true },
      { vertex: Rr, from: P, to: Q, marks: 1 },
      { vertex: Rr, from: A, to: B, marks: 1 },
    ]
    first = [P, Q, Rr]
    second = [A, B, Rr]
    parts = [1, 2]
  }
  const ids = kind === 'shadow' ? [P, Q, Rr, A, B, C] : [P, Q, Rr, A, B]
  const lookup = new Map(ids.map((id, i) => [id, pts[i]!]))
  const at = (id: string) => {
    const p = lookup.get(id)!
    return { x: r2(p.x), y: r2(p.y) }
  }
  const points: GeoPoint[] = ids.map((id, i) => {
    const p = pts[i]!
    const side: GeoPoint['labelSide'] = p.y > 0 ? 'above' : 'below'
    return { id, x: r2(p.x), y: r2(p.y), label: id, labelSide: side }
  })
  const sc = statementChoices(first, second, at, null, '', rng)
  if (!sc) return null
  const traps: TrapDraft6[] = []
  const heightName = `${P}${Q}`
  const groundName = `${Q}${Rr}`
  const bigGround = kind === 'shadow' ? `${B}${C}` : `${Rr}${B}`
  const bigHeight = `${A}${B}`
  // Crossed: the person's height with the object's ground length.
  const crossed = ratDiv(R(h * s), R(S))
  traps.push({
    id: 'geo_shadows_crossed',
    stage: 'x',
    text: qText(crossed),
    witness: `That x pairs the person’s height with the ${story.short}’s ${kind === 'shadow' ? 'shadow' : 'distance to the mirror'}. Each ratio has to compare a height with its own ${kind === 'shadow' ? 'shadow' : 'distance to the mirror'}.`,
  })
  const inverted = ratDiv(R(s * S), R(h))
  traps.push({
    id: 'geo_one_ratio_inverted',
    stage: 'x',
    text: qText(inverted),
    witness: `That x comes from a proportion with one ratio turned over: height over ${kind === 'shadow' ? 'shadow' : 'distance'} on one side and ${kind === 'shadow' ? 'shadow' : 'distance'} over height on the other.`,
  })
  const ground = kind === 'shadow' ? 'shadow' : 'distance to the mirror'
  const scene =
    kind === 'shadow'
      ? `At the same time of day, a person who is ${h} ${unitWord} tall casts a shadow ${s} ${unitWord} long, and ${story.thing} casts a shadow ${S} ${unitWord} long. In the figure, ${heightName} is the person, ${groundName} is the person’s shadow, ${bigHeight} is the ${story.short}, and ${bigGround} is its shadow; the sun’s rays ${P}${Rr} and ${A}${C} are parallel.`
      : `A mirror lies on the ground at ${Rr}, ${S} ${unitWord} from the base of ${story.thing}. A person whose eyes are ${h} ${unitWord} above the ground stands ${s} ${unitWord} from the mirror and sees the top of the ${story.short} in it. In the figure, ${heightName} is the person, ${bigHeight} is the ${story.short}, and the light meets the mirror and leaves it at equal angles.`
  const prompt = `${scene} Choose the true similarity statement, then find the height of the ${story.short}, x, in ${unitWord}.`
  // A half reads as a decimal in feet or meters: 12.5, not 25/2.
  const answerText = Hq.d === 1 ? qText(Hq) : String(Hq.n / Hq.d)
  const shown = `${pshow(konst(h), konst(S))} = ${pshow(lin6(1, 0), konst(s))}`
  const stages = [
    statementStage(
      sc,
      kind === 'shadow'
        ? `Both triangles have a right angle at the ground, and the parallel rays make the angles at ${Rr} and ${C} congruent, so ${sc.answerText}.`
        : `Both triangles have a right angle at the ground, and the angles at the mirror are congruent, so ${sc.answerText}.`,
      seed,
    ),
    numberStage6({
      id: 'x',
      label: 'x',
      hint: feet ? FT_HINT6 : M_HINT6,
      answerText,
      nudge: `Write height over ${ground} for the person and for the ${story.short}. The two ratios are equal.`,
      ruleCard: UNIT6_RULE_IDS.indirect,
      reveal: [`${heightName}/${groundName} = ${bigHeight}/${bigGround}, so ${h}/${s} = x/${S}. ${crossText(shown, konst(h * S), lin6(s, 0)).replace(`x = ${qShow(Hq)}.`, `x = ${answerText}.`)}`],
      traps,
      lengthUnit: unit,
    }),
  ]
  const aria =
    kind === 'shadow'
      ? `Two right triangles on the ground. ${heightName} is labeled ${h} and its shadow ${groundName} is labeled ${s}; ${bigHeight} is labeled x and its shadow ${bigGround} is labeled ${S}. Right angles at ${Q} and ${B}; angles ${Rr} and ${C} each have one arc.`
      : `Two right triangles on the ground that meet at the mirror ${Rr}. ${heightName} is labeled ${h}, ${groundName} is labeled ${s}, ${Rr}${B} is labeled ${S}, and ${bigHeight} is labeled x. Right angles at ${Q} and ${B}; the angles ${P}${Rr}${Q} and ${A}${Rr}${B} each have one arc.`
  const outline = kind === 'shadow' ? [first, second] : [[P, Q, Rr], [A, B, Rr]]
  const figure = placeLabels6({ ariaLabel: aria, points, segments, angles }, outline, new Set(parts))
  return solveFinish(kind, prompt, figure, stages, [h, s, S], { x: answerText, unit, story: story.short }, ['geo_shadows_crossed', 'geo_one_ratio_inverted'], kind === 'shadow' ? 'Shadows and similar triangles' : 'A mirror and similar triangles')
}

