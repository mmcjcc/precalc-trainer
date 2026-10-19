/**
 * Honors geometry Unit 5, rectangles, rhombuses, and squares (Jurgensen 5-4). gs.props is algebra with the
 * special properties: a rectangle's diagonals are congruent, a rhombus's are perpendicular and bisect its
 * angles, a square has both. Each seed's trap is the other shape's property, or a half taken as a whole.
 * gs.classify asks for the most specific name from facts, marks, or coordinates, or asks whether the figure
 * must be a rectangle and whether it must be a rhombus, one Yes or No at a time, so a true name is never graded
 * wrong. Letters, the case, the numbers, and the figure's turn all come from the seed.
 */
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { GeometryAnswer } from '@/content/types'
import type { ErrorPatternId, GeoAngleMark, GeoFigureSpec, GeoSegment } from '@/shared/types'
import type { GeoBuilt } from './build'
import { angleLabel, formatLin, lin, showPt, type Lin } from './expr'
import {
  DEG_HINT5,
  LEN_HINT5,
  X_HINT5,
  X_POOL5,
  choiceStage,
  finish5,
  fit,
  numberStage,
  reserved,
  solve,
  sum,
  times,
  typed,
  wholePositive,
  type ChoiceDraft5,
  type TrapDraft,
} from './unit5Build'
import { seg, sideName, sideOf, vtx, type Ids } from './unit5Figs'
import { extraLetters, goodQuad, kiteAt, labeled, parallelogramAt, parallelogramFromDiagonals, quadLetters, tilt, turn, type XY } from './unit5Geom'
import { add, angleBetween, gcd, latticeIsoTrap, latticePgram, latticeTrap, minus, onGrid, scale, vec, type V } from './unit5Lattice'
import { crossingOf } from './unit5Prove'
import { SPECIAL_RULES, UNIT5_RULE_FOR, UNIT5_RULE_IDS } from './unit5Rules'

const COEFFS = [1, 2, 3, 4, 5, 6] as const
const coeffs = (rng: Rng, n: number) => rng.shuffle([...COEFFS]).slice(0, n)
const f = (e: Lin) => formatLin(e)
const mod4 = (k: number) => ((k % 4) + 4) % 4

// --- gs.props --------------------------------------------------------------------------------------------

type SpecialKind = 'rectDiagHalf' | 'rectDiagWhole' | 'rhombusHalves' | 'rectAngles' | 'rhombusAngles' | 'rhombusBisect' | 'rectCorner' | 'squareDiag' | 'squareAngle'
const SPECIAL_KINDS: readonly SpecialKind[] = ['rectDiagHalf', 'rectDiagWhole', 'rhombusHalves', 'rectAngles', 'rhombusAngles', 'rhombusBisect', 'rectCorner', 'squareDiag', 'squareAngle']

const ANSWERED_X_W = (asked: string) => `That is the value of x, not ${asked}. Use x to find the measure itself.`
const RECT_ON_RHOMBUS_HALVES_W = (a: string, b: string) =>
  `That x makes ${a} equal to ${b}, a half of each diagonal. Halves of both diagonals are equal in a rectangle; in a rhombus the diagonals are perpendicular, and only the two halves of one diagonal are equal.`
const RHOMBUS_ON_RECT_W = (a: string, b: string) =>
  `That x makes ∠${a} and ∠${b} add to 90°, as if the diagonals met at a right angle. A rectangle's diagonals are congruent, not perpendicular, so those two angles are equal.`
const RECT_ON_RHOMBUS_W = (a: string, b: string) =>
  `That x makes ∠${a} and ∠${b} equal, as if the half-diagonals were congruent. A rhombus's diagonals are perpendicular, so those two angles add to 90°.`
const RECT_CORNER_W = (a: string, b: string) =>
  `That x makes ∠${a} and ∠${b} equal, as if the diagonal bisected the corner. A rectangle's corner is a right angle, and its diagonal does not bisect it, so the two parts add to 90°.`
const RHOMBUS_CORNER_W = (a: string, b: string) =>
  `That x makes ∠${a} and ∠${b} add to 90°, as if the corner were a right angle. A rhombus's diagonal bisects the corner, so the two parts are equal.`
const HALF_X_W = (half: string, whole: string) =>
  `That x makes ${half} equal to ${whole}. ${half} is half of a diagonal and ${whole} is a whole diagonal, and the diagonals here are congruent, so ${whole} is twice ${half}.`
const HALF_RESULT_W = (asked: string, half: string) => `That is ${half}, half of ${asked}. The diagonals bisect each other, so ${asked} is twice that half.`
const WHOLE_RESULT_W = (asked: string) => `That is the length of a whole diagonal. ${asked} is half of a diagonal.`
const HALF_ANGLE_W = (asked: string, part: string) => `That is m∠${part}, one of the two equal parts. The diagonal bisects the angle, so m∠${asked} is twice that part.`
const SQUARE_CORNER_W = 'That x makes the angle 90°, the whole corner. The diagonal of a square bisects each right angle, so this angle is half of it.'

function numberFinish(
  prompt: string,
  figure: GeoFigureSpec,
  stages: GeometryAnswer['stages'],
  lengths: number[],
  angles: number[],
  title: string,
  params: Record<string, string | number | boolean>,
  promise: ErrorPatternId[],
): GeoBuilt | null {
  return finish5({
    question: 'specialQuadProps',
    prompt,
    figure,
    stages,
    lengths,
    angles,
    title,
    instructions: stages.length > 1 ? 'Find x, then the part the question asks for. The figure is there before you answer.' : 'Find x. The figure is there before you answer.',
    params,
    cards: SPECIAL_RULES,
    ruleFor: UNIT5_RULE_FOR,
    promise,
  })
}

interface Drawn {
  ids: Ids
  T: string
  corners: XY[]
  points: GeometryAnswer['figure']['points']
  segments: GeoSegment[]
}

/**
 * A parallelogram-family figure with both diagonals drawn to their crossing T, turned any amount. Four rays leave
 * T, and GeoFigure finds a clear spot for T's letter only for some turns (for perpendicular diagonals, about a
 * third of them), so the caller tries again until the layout check passes.
 */
function withDiagonals(rng: Rng, ids: Ids, T: string, local: XY[]): Drawn | null {
  const corners = turn(local, rng.int(0, 359), rng.chance(0.5))
  if (!goodQuad(corners, 30)) return null
  const mid = crossingOf(corners)
  const points = [...labeled(ids, corners, corners), ...labeled([T], [mid], corners, [T])]
  const segments: GeoSegment[] = [...[0, 1, 2, 3].map((i) => seg(...sideOf(ids, i))), ...[0, 1, 2, 3].map((i) => seg(vtx(ids, i), T))]
  return { ids, T, corners, points, segments }
}

function rectangleLocal(ratio: number): XY[] {
  return parallelogramAt(20, 20 * ratio, 90)
}

export function drawSpecialProps(seed: number): GeoBuilt {
  const kind = makeRng(mixSeed(seed, 5400)).pick(SPECIAL_KINDS)
  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = makeRng(mixSeed(seed, 5401 + attempt))
    const built = specialCase(rng, kind)
    if (built) return built
  }
  throw new Error(`gs.props/${seed}: no ${kind} problem`)
}

function specialCase(rng: Rng, kind: SpecialKind): GeoBuilt | null {
  if (kind === 'rectAngles' || kind === 'rhombusAngles') return sideAngles(rng, kind === 'rectAngles' ? 'rect' : 'rhombus')
  if (kind === 'rectCorner' || kind === 'rhombusBisect') return cornerAngles(rng, kind === 'rectCorner' ? 'rect' : 'rhombus')
  if (kind === 'squareAngle') return squareAngle(rng)
  if (kind === 'rhombusHalves') return rhombusHalves(rng)
  return diagonalLengths(rng, kind)
}

const shapeWord = (shape: 'rect' | 'rhombus' | 'square') => (shape === 'rect' ? 'rectangle' : shape)

/**
 * Two angles at the ends of one side, each between the side and a diagonal. In a rectangle the half-diagonals
 * are equal, so the two angles are equal. In a rhombus the diagonals are perpendicular, so they add to 90°.
 */
function sideAngles(rng: Rng, shape: 'rect' | 'rhombus'): GeoBuilt | null {
  const ids = quadLetters(rng)
  const [T] = extraLetters(rng, ids, 1) as [string]
  const name = ids.join('')
  const x = rng.pick(X_POOL5)
  const i = rng.int(0, 3)
  const A = vtx(ids, i)
  const B = vtx(ids, i + 1)
  let gA: number
  let gB: number
  let local: XY[]
  if (shape === 'rect') {
    const beta = rng.int(26, 64)
    if (Math.abs(beta - 45) < 6) return null
    gA = beta
    gB = beta
    const theta = i % 2 === 0 ? beta : 90 - beta
    local = rectangleLocal(Math.tan((theta * Math.PI) / 180))
  } else {
    const alpha = 2 * rng.int(26, 64)
    if (Math.abs(alpha - 90) < 12) return null
    const atA = i % 2 === 0 ? alpha : 180 - alpha
    gA = atA / 2
    gB = 90 - gA
    local = parallelogramAt(20, 20, alpha)
  }
  if ([gA, gB, 180 - 2 * gA, 2 * gA, 2 * gB, 90 - gA].some((n) => reserved(n))) return null
  const [a1, a2] = coeffs(rng, 2) as [number, number]
  const e1 = fit(gA, x, a1)
  const e2 = fit(gB, x, a2)
  const right = shape === 'rect' ? solve(e1, e2) : solve(sum(e1, e2), lin(0, 90))
  if (!right || right.d !== 1 || right.n !== x) return null
  const slip = shape === 'rect' ? solve(sum(e1, e2), lin(0, 90)) : solve(e1, e2)
  if (wholePositive(slip) === null) return null
  const nA = `${T}${A}${B}`
  const nB = `${T}${B}${A}`
  const traps: TrapDraft[] = [
    { id: 'geo_rect_rhombus_swapped', stage: 'x', text: typed(slip!), witness: shape === 'rect' ? RHOMBUS_ON_RECT_W(nA, nB) : RECT_ON_RHOMBUS_W(nA, nB) },
  ]
  let askName: string
  let result: number
  let resultReveal: string
  let resultNudge: string
  if (shape === 'rect') {
    if (rng.chance(0.5)) {
      askName = `${A}${T}${B}`
      result = 180 - 2 * gA
      resultReveal = `Triangle ${A}${T}${B} has two ${gA}° angles, so m∠${askName} = 180 − 2(${gA}) = ${result}.`
      resultNudge = 'The three angles of the triangle at this side add to 180°.'
    } else {
      askName = `${T}${A}${vtx(ids, i - 1)}`
      result = 90 - gA
      resultReveal = `Angle ${vtx(ids, i - 1)}${A}${B} is a right angle, so m∠${askName} = 90 − ${gA} = ${result}.`
      resultNudge = 'The corner of a rectangle is a right angle, and the diagonal splits it into two parts.'
    }
  } else {
    if (rng.chance(0.5)) {
      askName = `${vtx(ids, i - 1)}${A}${B}`
      result = 2 * gA
      traps.push({ id: 'geo_half_for_whole', stage: 'result', text: String(gA), witness: HALF_ANGLE_W(askName, nA) })
    } else {
      askName = `${A}${B}${vtx(ids, i + 2)}`
      result = 2 * gB
      traps.push({ id: 'geo_half_for_whole', stage: 'result', text: String(gB), witness: HALF_ANGLE_W(askName, nB) })
    }
    resultReveal = `A diagonal of a rhombus bisects the angle, so m∠${askName} = 2 · ${result / 2} = ${result}.`
    resultNudge = 'Each diagonal of a rhombus bisects the angles at its ends.'
  }
  traps.push({ id: 'geo_answered_x', stage: 'result', text: String(x), witness: ANSWERED_X_W(`m∠${askName}`) })
  const prompt = `In ${shapeWord(shape)} ${name}, the diagonals meet at ${T}, m∠${nA} = (${f(e1)})°, and m∠${nB} = (${f(e2)})°. Find x, then m∠${askName}.`
  const drawn = withDiagonals(rng, ids, T, local)
  if (!drawn) return null
  const angles: GeoAngleMark[] = [
    { vertex: A, from: T, to: B, label: angleLabel(e1), radius: 20 },
    { vertex: B, from: A, to: T, label: angleLabel(e2), radius: 20 },
  ]
  const figure: GeoFigureSpec = {
    ariaLabel: `${shape === 'rect' ? 'Rectangle' : 'Rhombus'} ${name} with diagonals ${vtx(ids, 0)}${vtx(ids, 2)} and ${vtx(ids, 1)}${vtx(ids, 3)} meeting at ${T}. Angle ${nA} is labeled (${f(e1)})° and angle ${nB} is labeled (${f(e2)})°.`,
    points: drawn.points,
    segments: drawn.segments,
    angles,
  }
  const card = shape === 'rect' ? UNIT5_RULE_IDS.rectangle : UNIT5_RULE_IDS.rhombus
  const xReveal =
    shape === 'rect'
      ? `The diagonals of a rectangle are congruent and bisect each other, so ${A}${T} = ${B}${T} and triangle ${A}${T}${B} is isosceles: ${f(e1)} = ${f(e2)}, and x = ${x}.`
      : `The diagonals of a rhombus are perpendicular, so ∠${A}${T}${B} is a right angle and the other two angles of the triangle add to 90°: (${f(e1)}) + (${f(e2)}) = 90, and x = ${x}.`
  const stages = [
    numberStage({
      id: 'x',
      label: 'x',
      hint: X_HINT5,
      answerText: String(x),
      nudge: 'Look at the triangle with vertex at the crossing point. What does this shape say about its diagonals?',
      ruleCard: card,
      reveal: [xReveal],
      traps,
    }),
    numberStage({
      id: 'result',
      label: `m∠${askName}`,
      hint: DEG_HINT5,
      answerText: String(result),
      nudge: resultNudge,
      ruleCard: card,
      reveal: [resultReveal],
      traps,
      deg: true,
    }),
  ]
  const shapeAngles = shape === 'rect' ? [90, 90, 90, 90] : [0, 1, 2, 3].map((k) => (mod4(k - i) % 2 === 0 ? 2 * gA : 2 * gB))
  return numberFinish(prompt, figure, stages, [], shapeAngles, 'Special parallelograms', { case: shape === 'rect' ? 'rectAngles' : 'rhombusAngles', x, asked: `m∠${askName}` }, ['geo_rect_rhombus_swapped'])
}

/**
 * A corner split by a diagonal. A rhombus's diagonal bisects the corner, so the two parts are equal. A
 * rectangle's corner is a right angle and its diagonal does not bisect it, so the two parts add to 90°.
 */
function cornerAngles(rng: Rng, shape: 'rect' | 'rhombus'): GeoBuilt | null {
  const ids = quadLetters(rng)
  const [T] = extraLetters(rng, ids, 1) as [string]
  const name = ids.join('')
  const x = rng.pick(X_POOL5)
  const i = rng.int(0, 3)
  const V = vtx(ids, i)
  const next = vtx(ids, i + 1)
  const prev = vtx(ids, i - 1)
  let p1: number
  let p2: number
  let local: XY[]
  if (shape === 'rect') {
    p1 = rng.int(26, 64)
    if (Math.abs(p1 - 45) < 6) return null
    p2 = 90 - p1
    // p1 is between the side to `next` and the diagonal.
    const theta = i % 2 === 0 ? p1 : p2
    local = rectangleLocal(Math.tan((theta * Math.PI) / 180))
  } else {
    const alpha = 2 * rng.int(26, 64)
    if (Math.abs(alpha - 90) < 12) return null
    const atV = i % 2 === 0 ? alpha : 180 - alpha
    p1 = atV / 2
    p2 = atV / 2
    local = parallelogramAt(20, 20, alpha)
  }
  // Every measure this case can ask for: one part of the corner (rectangle), or the whole corner and the next one (rhombus).
  if ((shape === 'rect' ? [p1, p2] : [p1, p1 + p2, 180 - p1 - p2]).some((n) => reserved(n) || n <= 0 || n >= 180)) return null
  const [a1, a2] = coeffs(rng, 2) as [number, number]
  const e1 = fit(p1, x, a1)
  const e2 = fit(p2, x, a2)
  const right = shape === 'rect' ? solve(sum(e1, e2), lin(0, 90)) : solve(e1, e2)
  if (!right || right.d !== 1 || right.n !== x) return null
  const slip = shape === 'rect' ? solve(e1, e2) : solve(sum(e1, e2), lin(0, 90))
  if (wholePositive(slip) === null) return null
  const n1 = `${next}${V}${T}`
  const n2 = `${T}${V}${prev}`
  const traps: TrapDraft[] = [
    { id: 'geo_rect_rhombus_swapped', stage: 'x', text: typed(slip!), witness: shape === 'rect' ? RECT_CORNER_W(n1, n2) : RHOMBUS_CORNER_W(n1, n2) },
  ]
  let askName: string
  let result: number
  let resultReveal: string
  let resultNudge: string
  if (shape === 'rect') {
    askName = `${V}${next}${T}`
    result = p1
    resultReveal = `The half-diagonals ${V}${T} and ${next}${T} are equal, so triangle ${V}${T}${next} is isosceles and m∠${askName} = m∠${n1} = ${result}.`
    resultNudge = 'The diagonals of a rectangle are congruent and bisect each other. Look at the triangle along that side.'
  } else if (rng.chance(0.5)) {
    askName = `${prev}${V}${next}`
    result = p1 + p2
    traps.push({ id: 'geo_half_for_whole', stage: 'result', text: String(p1), witness: HALF_ANGLE_W(askName, n1) })
    resultReveal = `The diagonal bisects ∠${askName}, so m∠${askName} = 2 · ${p1} = ${result}.`
    resultNudge = 'The diagonal cuts this corner into two equal parts.'
  } else {
    askName = `${V}${next}${vtx(ids, i + 2)}`
    result = 180 - p1 - p2
    resultReveal = `The whole corner is m∠${prev}${V}${next} = 2 · ${p1} = ${p1 + p2}, and consecutive angles of a rhombus are supplementary, so m∠${askName} = 180 − ${p1 + p2} = ${result}.`
    resultNudge = 'Find the whole corner first. Consecutive angles of a parallelogram add to 180°.'
  }
  traps.push({ id: 'geo_answered_x', stage: 'result', text: String(x), witness: ANSWERED_X_W(`m∠${askName}`) })
  const prompt = `In ${shapeWord(shape)} ${name}, the diagonals meet at ${T}, m∠${n1} = (${f(e1)})°, and m∠${n2} = (${f(e2)})°. Find x, then m∠${askName}.`
  const drawn = withDiagonals(rng, ids, T, local)
  if (!drawn) return null
  const figure: GeoFigureSpec = {
    ariaLabel: `${shape === 'rect' ? 'Rectangle' : 'Rhombus'} ${name} with diagonals ${vtx(ids, 0)}${vtx(ids, 2)} and ${vtx(ids, 1)}${vtx(ids, 3)} meeting at ${T}. Angle ${n1} is labeled (${f(e1)})° and angle ${n2} is labeled (${f(e2)})°.`,
    points: drawn.points,
    segments: drawn.segments,
    angles: [
      { vertex: V, from: next, to: T, label: angleLabel(e1), radius: 22 },
      { vertex: V, from: T, to: prev, label: angleLabel(e2), radius: 30 },
    ],
  }
  const card = shape === 'rect' ? UNIT5_RULE_IDS.rectangle : UNIT5_RULE_IDS.rhombus
  const xReveal =
    shape === 'rect'
      ? `Angle ${prev}${V}${next} is a right angle, so its two parts add to 90°: (${f(e1)}) + (${f(e2)}) = 90, and x = ${x}.`
      : `A diagonal of a rhombus bisects the angle, so the two parts are equal: ${f(e1)} = ${f(e2)}, and x = ${x}.`
  const stages = [
    numberStage({
      id: 'x',
      label: 'x',
      hint: X_HINT5,
      answerText: String(x),
      nudge: 'The diagonal splits this corner in two. Does this shape’s diagonal bisect the corner, or is the corner a right angle?',
      ruleCard: card,
      reveal: [xReveal],
      traps,
    }),
    numberStage({
      id: 'result',
      label: `m∠${askName}`,
      hint: DEG_HINT5,
      answerText: String(result),
      nudge: resultNudge,
      ruleCard: card,
      reveal: [resultReveal],
      traps,
      deg: true,
    }),
  ]
  return numberFinish(prompt, figure, stages, [], [], 'Special parallelograms', { case: shape === 'rect' ? 'rectCorner' : 'rhombusBisect', x, asked: `m∠${askName}` }, ['geo_rect_rhombus_swapped'])
}

/** A square's diagonal bisects a right angle: one expression equals 45. */
function squareAngle(rng: Rng): GeoBuilt | null {
  const ids = quadLetters(rng)
  const [T] = extraLetters(rng, ids, 1) as [string]
  const name = ids.join('')
  const x = rng.pick(X_POOL5)
  const a = rng.pick([1, 3, 5])
  const e = fit(45, x, a)
  const slip = solve(e, lin(0, 90))
  if (wholePositive(slip) === null) return null
  const i = rng.int(0, 3)
  const V = vtx(ids, i)
  const next = vtx(ids, i + 1)
  const nm = rng.chance(0.5) ? `${next}${V}${T}` : `${T}${V}${vtx(ids, i - 1)}`
  const prompt = `In square ${name}, the diagonals meet at ${T}, and m∠${nm} = (${f(e)})°. Find x.`
  const drawn = withDiagonals(rng, ids, T, parallelogramAt(20, 20, 90))
  if (!drawn) return null
  const from = nm[0]!
  const to = nm[2]!
  const figure: GeoFigureSpec = {
    ariaLabel: `Square ${name} with diagonals ${vtx(ids, 0)}${vtx(ids, 2)} and ${vtx(ids, 1)}${vtx(ids, 3)} meeting at ${T}. Angle ${nm} is labeled (${f(e)})°.`,
    points: drawn.points,
    segments: drawn.segments,
    angles: [{ vertex: V, from, to, label: angleLabel(e), radius: 22 }],
  }
  const stages = [
    numberStage({
      id: 'x',
      label: 'x',
      hint: X_HINT5,
      answerText: String(x),
      nudge: 'A square is a rhombus too. What does a rhombus’s diagonal do to the corner it starts from?',
      ruleCard: UNIT5_RULE_IDS.square,
      reveal: [`A square is a rhombus, so its diagonal bisects the right angle at ${V}: ${f(e)} = 90 ÷ 2, and x = ${x}.`],
      traps: [{ id: 'geo_half_for_whole', stage: 'x', text: typed(slip!), witness: SQUARE_CORNER_W }],
    }),
  ]
  return numberFinish(prompt, figure, stages, [], [], 'Special parallelograms', { case: 'squareAngle', x, asked: 'x' }, ['geo_half_for_whole'])
}

/** A rhombus: the two halves of one diagonal and a half of the other. Halves of different diagonals are not equal. */
function rhombusHalves(rng: Rng): GeoBuilt | null {
  const ids = quadLetters(rng)
  const [T] = extraLetters(rng, ids, 1) as [string]
  const name = ids.join('')
  const x = rng.pick(X_POOL5)
  const h = rng.int(6, 40)
  const k = rng.int(6, 40)
  const ratio = Math.max(h, k) / Math.min(h, k)
  if (ratio < 1.3 || ratio > 2.4) return null
  if ([h, k, 2 * h, 2 * k].some(reserved)) return null
  const i = rng.int(0, 3)
  const A = vtx(ids, i)
  const C = vtx(ids, i + 2)
  const B = vtx(ids, i + 1)
  const D = vtx(ids, i + 3)
  const near = rng.chance(0.5) ? B : D
  const far = near === B ? D : B
  const [a1, a2, a3] = coeffs(rng, 3) as [number, number, number]
  const e1 = fit(h, x, a1)
  const e2 = fit(h, x, a2)
  const e3 = fit(k, x, a3)
  const s = solve(e1, e2)
  if (!s || s.d !== 1 || s.n !== x) return null
  const t1 = solve(e1, e3)
  const t2 = solve(e2, e3)
  if (wholePositive(t1) === null && wholePositive(t2) === null) return null
  const AT = `${A}${T}`
  const TC = `${T}${C}`
  const NT = `${near}${T}`
  const traps: TrapDraft[] = []
  if (t1) traps.push({ id: 'geo_rect_rhombus_swapped', stage: 'x', text: typed(t1), witness: RECT_ON_RHOMBUS_HALVES_W(AT, NT) })
  if (t2) traps.push({ id: 'geo_rect_rhombus_swapped', stage: 'x', text: typed(t2), witness: RECT_ON_RHOMBUS_HALVES_W(TC, NT) })
  const askKind = rng.pick(['whole', 'otherWhole', 'otherHalf'] as const)
  const askName = askKind === 'whole' ? `${A}${C}` : askKind === 'otherWhole' ? `${B}${D}` : `${T}${far}`
  const result = askKind === 'whole' ? 2 * h : askKind === 'otherWhole' ? 2 * k : k
  if (askKind === 'whole') traps.push({ id: 'geo_diagonal_half_as_whole', stage: 'result', text: String(h), witness: HALF_RESULT_W(askName, AT) })
  if (askKind === 'otherWhole') traps.push({ id: 'geo_diagonal_half_as_whole', stage: 'result', text: String(k), witness: HALF_RESULT_W(askName, NT) })
  traps.push({ id: 'geo_answered_x', stage: 'result', text: String(x), witness: ANSWERED_X_W(askName) })
  const prompt = `${name} is a rhombus, and its diagonals meet at ${T}. ${AT} = ${f(e1)}, ${TC} = ${f(e2)}, and ${NT} = ${f(e3)}. Find x, then ${askName}.`
  const drawn = withDiagonals(rng, ids, T, rotateIds(parallelogramFromDiagonals(h, k, 90), i))
  if (!drawn) return null
  const figure: GeoFigureSpec = {
    ariaLabel: `Rhombus ${name} with diagonals ${vtx(ids, 0)}${vtx(ids, 2)} and ${vtx(ids, 1)}${vtx(ids, 3)} meeting at ${T}. No lengths are marked on the figure.`,
    points: drawn.points,
    segments: drawn.segments,
  }
  const resultReveal =
    askKind === 'whole'
      ? `${askName} = 2 · ${AT} = 2 · ${h} = ${result}.`
      : askKind === 'otherWhole'
        ? `${NT} = ${k} at x = ${x}, and the diagonals bisect each other, so ${askName} = 2 · ${k} = ${result}.`
        : `The diagonals bisect each other, so ${askName} = ${NT} = ${result}.`
  const stages = [
    numberStage({
      id: 'x',
      label: 'x',
      hint: X_HINT5,
      answerText: String(x),
      nudge: 'Which two given pieces are halves of the same diagonal? In a rhombus the diagonals bisect each other, but they are not equal to each other.',
      ruleCard: UNIT5_RULE_IDS.rhombus,
      reveal: [`${AT} and ${TC} are the two halves of diagonal ${A}${C}, so ${f(e1)} = ${f(e2)}, and x = ${x}.`],
      traps,
    }),
    numberStage({
      id: 'result',
      label: askName,
      hint: LEN_HINT5,
      answerText: String(result),
      nudge: 'The crossing point is the midpoint of each diagonal. Use the given half that belongs to this segment.',
      ruleCard: UNIT5_RULE_IDS.rhombus,
      reveal: [resultReveal],
      traps,
    }),
  ]
  return numberFinish(prompt, figure, stages, [h, k, 2 * h, 2 * k], [], 'Special parallelograms', { case: 'rhombusHalves', x, asked: askName }, [
    'geo_rect_rhombus_swapped',
    'geo_diagonal_half_as_whole',
  ])
}

/** Local corners relabeled so that the corner for letter i is local corner 0 (the diagonal with half h). */
function rotateIds(local: XY[], i: number): XY[] {
  return [0, 1, 2, 3].map((k) => local[mod4(k - i)]!)
}

/** Rectangle and square diagonals: congruent, and they bisect each other. */
function diagonalLengths(rng: Rng, kind: 'rectDiagHalf' | 'rectDiagWhole' | 'squareDiag'): GeoBuilt | null {
  const ids = quadLetters(rng)
  const [T] = extraLetters(rng, ids, 1) as [string]
  const name = ids.join('')
  const x = rng.pick(X_POOL5)
  const h = rng.int(6, 40)
  if ([h, 2 * h].some(reserved)) return null
  const i = rng.int(0, 3)
  const A = vtx(ids, i)
  const C = vtx(ids, i + 2)
  const B = vtx(ids, i + 1)
  const D = vtx(ids, i + 3)
  const shape = kind === 'squareDiag' ? 'square' : 'rect'
  const traps: TrapDraft[] = []
  let prompt: string
  let xReveal: string
  let xNudge: string
  let askName: string
  let result: number
  let resultReveal: string
  let promise: ErrorPatternId[]
  if (kind === 'rectDiagHalf') {
    const [a1, a2] = coeffs(rng, 2) as [number, number]
    if (2 * a1 === a2) return null
    const e1 = fit(h, x, a1)
    const e2 = fit(2 * h, x, a2)
    const s = solve(times(2, e1), e2)
    if (!s || s.d !== 1 || s.n !== x) return null
    const slip = solve(e1, e2)
    if (wholePositive(slip) === null) return null
    const AT = `${A}${T}`
    const BD = `${B}${D}`
    traps.push({ id: 'geo_diagonal_half_as_whole', stage: 'x', text: typed(slip!), witness: HALF_X_W(AT, BD) })
    prompt = `${name} is a rectangle, and its diagonals meet at ${T}. ${AT} = ${f(e1)} and ${BD} = ${f(e2)}. Find x, then `
    xReveal = `The diagonals of a rectangle are congruent and bisect each other, so ${BD} = ${A}${C} = 2 · ${AT}: ${f(e2)} = 2(${f(e1)}), and x = ${x}.`
    xNudge = 'One given piece is half of a diagonal and the other is a whole diagonal. The diagonals of a rectangle are congruent.'
    if (rng.chance(0.5)) {
      askName = `${T}${C}`
      result = h
      traps.push({ id: 'geo_diagonal_half_as_whole', stage: 'result', text: String(2 * h), witness: WHOLE_RESULT_W(askName) })
      resultReveal = `${askName} = ${AT} = ${h}.`
    } else {
      askName = `${A}${C}`
      result = 2 * h
      traps.push({ id: 'geo_diagonal_half_as_whole', stage: 'result', text: String(h), witness: HALF_RESULT_W(askName, AT) })
      resultReveal = `${askName} = ${BD} = ${result}.`
    }
    promise = ['geo_diagonal_half_as_whole']
  } else {
    const [a1, a2] = coeffs(rng, 2) as [number, number]
    const whole = kind === 'rectDiagWhole'
    const v = whole ? 2 * h : h
    const e1 = fit(v, x, a1)
    const e2 = fit(v, x, a2)
    const s = solve(e1, e2)
    if (!s || s.d !== 1 || s.n !== x) return null
    const n1 = whole ? `${A}${C}` : `${A}${T}`
    const n2 = whole ? `${B}${D}` : `${B}${T}`
    prompt = `${name} is a ${shapeWord(shape)}, and its diagonals meet at ${T}. ${n1} = ${f(e1)} and ${n2} = ${f(e2)}. Find x, then `
    xReveal = whole
      ? `The diagonals of a rectangle are congruent: ${f(e1)} = ${f(e2)}, and x = ${x}.`
      : `The diagonals of a square are congruent and bisect each other, so all four half-diagonals are equal: ${f(e1)} = ${f(e2)}, and x = ${x}.`
    xNudge = whole ? 'What does a rectangle say about its two diagonals?' : 'A square is a rectangle. What does that say about the halves of its diagonals?'
    if (whole) {
      askName = rng.chance(0.5) ? `${T}${D}` : `${C}${T}`
      result = h
      traps.push({ id: 'geo_diagonal_half_as_whole', stage: 'result', text: String(2 * h), witness: WHOLE_RESULT_W(askName) })
      resultReveal = `The diagonals bisect each other, so ${askName} = ½ · ${2 * h} = ${result}.`
    } else {
      askName = rng.chance(0.5) ? `${B}${D}` : `${A}${C}`
      result = 2 * h
      traps.push({ id: 'geo_diagonal_half_as_whole', stage: 'result', text: String(h), witness: HALF_RESULT_W(askName, askName === `${B}${D}` ? n2 : n1) })
      resultReveal = `${askName} is twice a half-diagonal: 2 · ${h} = ${result}.`
    }
    promise = ['geo_diagonal_half_as_whole']
  }
  traps.push({ id: 'geo_answered_x', stage: 'result', text: String(x), witness: ANSWERED_X_W(askName) })
  const local = shape === 'square' ? parallelogramAt(20, 20, 90) : rectangleLocal(1.3 + rng.next() * 0.8)
  const drawn = withDiagonals(rng, ids, T, local)
  if (!drawn) return null
  const card = shape === 'square' ? UNIT5_RULE_IDS.square : UNIT5_RULE_IDS.rectangle
  const figure: GeoFigureSpec = {
    ariaLabel: `${shape === 'square' ? 'Square' : 'Rectangle'} ${name} with diagonals ${vtx(ids, 0)}${vtx(ids, 2)} and ${vtx(ids, 1)}${vtx(ids, 3)} meeting at ${T}. No lengths are marked on the figure.`,
    points: drawn.points,
    segments: drawn.segments,
  }
  const stages = [
    numberStage({ id: 'x', label: 'x', hint: X_HINT5, answerText: String(x), nudge: xNudge, ruleCard: card, reveal: [xReveal], traps }),
    numberStage({
      id: 'result',
      label: askName,
      hint: LEN_HINT5,
      answerText: String(result),
      nudge: 'The crossing point is the midpoint of each diagonal, and here the two diagonals are the same length.',
      ruleCard: card,
      reveal: [resultReveal],
      traps,
    }),
  ]
  return numberFinish(`${prompt}${askName}.`, figure, stages, [h, 2 * h], [], 'Special parallelograms', { case: kind, x, asked: askName }, promise)
}

// --- gs.classify ------------------------------------------------------------------------------------------

export type QuadName = 'parallelogram' | 'rectangle' | 'rhombus' | 'square' | 'trapezoid' | 'isoTrapezoid' | 'kite' | 'quadrilateral'
export const QUAD_NAMES: readonly QuadName[] = ['parallelogram', 'rectangle', 'rhombus', 'square', 'trapezoid', 'isoTrapezoid', 'kite', 'quadrilateral']
export const NAME_TEXT: Record<QuadName, string> = {
  parallelogram: 'Parallelogram',
  rectangle: 'Rectangle',
  rhombus: 'Rhombus',
  square: 'Square',
  trapezoid: 'Trapezoid',
  isoTrapezoid: 'Isosceles trapezoid',
  kite: 'Kite',
  quadrilateral: 'Quadrilateral',
}
/** Every name that is true of a figure with this most specific name, besides the name itself. */
export const MORE_GENERAL: Record<QuadName, readonly QuadName[]> = {
  parallelogram: ['quadrilateral'],
  rectangle: ['parallelogram', 'quadrilateral'],
  rhombus: ['parallelogram', 'quadrilateral'],
  square: ['rectangle', 'rhombus', 'parallelogram', 'quadrilateral'],
  trapezoid: ['quadrilateral'],
  isoTrapezoid: ['trapezoid', 'quadrilateral'],
  kite: ['quadrilateral'],
  quadrilateral: [],
}

type Mode = 'facts' | 'marks' | 'coords' | 'must'
const MODES: readonly Mode[] = ['facts', 'marks', 'coords', 'must']

interface Names {
  S: string
  P: string
  Q: string
  R: string
  Z: string
  PQ: string
  QR: string
  RS: string
  SP: string
  PR: string
  QS: string
}

function namesOf(ids: Ids): Names {
  return {
    S: ids.join(''),
    P: ids[0],
    Q: ids[1],
    R: ids[2],
    Z: ids[3],
    PQ: sideName(ids, 0),
    QR: sideName(ids, 1),
    RS: sideName(ids, 2),
    SP: sideName(ids, 3),
    PR: `${ids[0]}${ids[2]}`,
    QS: `${ids[1]}${ids[3]}`,
  }
}

type Slip = { id: ErrorPatternId; witness: string }

interface FactSet {
  key: string
  name: QuadName
  text: (n: Names, rng: Rng) => string
  slips?: (n: Names) => Partial<Record<QuadName, Slip>>
  reveal: (n: Names) => string
  /** Set when the facts are about the diagonals, for the must-be question. */
  diagonal?: boolean
}

const NOT_SPECIFIC_W = (S: string) => `That name fits ${S}, but it leaves out a given fact. Use the name that every given fact points to.`
const PERP_W = 'Perpendicular diagonals alone do not make that shape. Nothing says the diagonals bisect each other, or that any sides are congruent.'
const CONG_DIAG_W = 'Congruent diagonals alone do not make that shape. Nothing says the diagonals bisect each other, or that any sides are parallel.'

const FACTS: readonly FactSet[] = [
  {
    key: 'pg-sides',
    name: 'parallelogram',
    text: (n) => `Both pairs of opposite sides of ${n.S} are congruent.`,
    reveal: (n) => `Both pairs of opposite sides congruent proves that ${n.S} is a parallelogram. Nothing gives a right angle or congruent consecutive sides.`,
  },
  {
    key: 'pg-diagonals',
    name: 'parallelogram',
    text: (n) => `The diagonals of ${n.S} bisect each other.`,
    reveal: (n) => `Diagonals that bisect each other prove that ${n.S} is a parallelogram. Nothing says they are congruent or perpendicular.`,
  },
  {
    key: 'pg-angles',
    name: 'parallelogram',
    text: (n) => `Both pairs of opposite angles of ${n.S} are congruent.`,
    reveal: (n) => `Both pairs of opposite angles congruent proves that ${n.S} is a parallelogram, and nothing more is given.`,
  },
  {
    key: 'pg-onepair',
    name: 'parallelogram',
    text: (n) => `In ${n.S}, ${n.PQ} ∥ ${n.RS} and ${n.PQ} ≅ ${n.RS}.`,
    reveal: (n) => `One pair of opposite sides both parallel and congruent proves that ${n.S} is a parallelogram, and nothing more is given.`,
  },
  {
    key: 'rect-diagonals',
    name: 'rectangle',
    diagonal: true,
    text: (n) => `${n.S} is a parallelogram with congruent diagonals.`,
    reveal: (n) => `A parallelogram with congruent diagonals is a rectangle. Nothing makes its sides congruent, so ${n.S} need not be a square.`,
  },
  {
    key: 'rect-right',
    name: 'rectangle',
    text: (n) => `${n.S} is a parallelogram with a right angle at ${n.P}.`,
    reveal: (n) => `A parallelogram with one right angle has four right angles, so ${n.S} is a rectangle. Nothing makes its sides congruent.`,
  },
  {
    key: 'rect-four',
    name: 'rectangle',
    text: (n) => `All four angles of ${n.S} are right angles.`,
    reveal: (n) => `A quadrilateral with four right angles is a rectangle. Nothing makes its sides congruent, so ${n.S} need not be a square.`,
  },
  {
    key: 'rect-bisect',
    name: 'rectangle',
    diagonal: true,
    text: (n) => `The diagonals of ${n.S} bisect each other and are congruent.`,
    reveal: () => `Diagonals that bisect each other make a parallelogram, and congruent diagonals make it a rectangle.`,
  },
  {
    key: 'rh-perp',
    name: 'rhombus',
    diagonal: true,
    text: (n) => `${n.S} is a parallelogram with perpendicular diagonals.`,
    reveal: (n) => `A parallelogram with perpendicular diagonals is a rhombus. Nothing gives a right angle, so ${n.S} need not be a square.`,
  },
  {
    key: 'rh-sides',
    name: 'rhombus',
    text: (n) => `All four sides of ${n.S} are congruent.`,
    reveal: (n) => `A quadrilateral with four congruent sides is a rhombus. Nothing gives a right angle, so ${n.S} need not be a square.`,
  },
  {
    key: 'rh-consecutive',
    name: 'rhombus',
    text: (n) => `${n.S} is a parallelogram with ${n.PQ} ≅ ${n.QR}.`,
    reveal: (n) => `In a parallelogram, opposite sides are congruent, so ${n.PQ} ≅ ${n.QR} makes all four sides congruent: a rhombus.`,
  },
  {
    key: 'rh-bisect',
    name: 'rhombus',
    diagonal: true,
    text: (n) => `The diagonals of ${n.S} bisect each other and are perpendicular.`,
    reveal: () => `Diagonals that bisect each other make a parallelogram, and perpendicular diagonals make it a rhombus.`,
  },
  {
    key: 'rh-angles',
    name: 'rhombus',
    text: (n) => `${n.S} is a parallelogram, and diagonal ${n.PR} bisects ∠${n.P} and ∠${n.R}.`,
    reveal: () => `A parallelogram in which a diagonal bisects two angles is a rhombus. Nothing gives a right angle.`,
  },
  {
    key: 'sq-diagonals',
    name: 'square',
    diagonal: true,
    text: (n) => `${n.S} is a parallelogram whose diagonals are congruent and perpendicular.`,
    reveal: () => `Congruent diagonals make the parallelogram a rectangle, and perpendicular diagonals make it a rhombus. A figure that is both is a square.`,
  },
  {
    key: 'sq-sides-right',
    name: 'square',
    text: (n) => `All four sides of ${n.S} are congruent, and ∠${n.P} is a right angle.`,
    reveal: () => `Four congruent sides make a rhombus, and one right angle in a parallelogram makes all four angles right angles. A rhombus with right angles is a square.`,
  },
  {
    key: 'sq-rect',
    name: 'square',
    text: (n) => `${n.S} is a rectangle with ${n.PQ} ≅ ${n.QR}.`,
    reveal: () => `A rectangle with two congruent consecutive sides has four congruent sides, so it is also a rhombus: a square.`,
  },
  {
    key: 'sq-rhombus',
    name: 'square',
    text: (n) => `${n.S} is a rhombus with congruent diagonals.`,
    reveal: () => `A rhombus is a parallelogram, and a parallelogram with congruent diagonals is a rectangle. A rhombus that is a rectangle is a square.`,
  },
  {
    key: 'tz-one',
    name: 'trapezoid',
    text: (n) => `In ${n.S}, ${n.PQ} ∥ ${n.RS}, but ${n.QR} is not parallel to ${n.SP}.`,
    slips: (n) => ({ parallelogram: { id: 'geo_one_pair_half_test', witness: `${n.QR} is not parallel to ${n.SP}, so only one pair of opposite sides is parallel.` } }),
    reveal: (n) => `Exactly one pair of parallel sides makes a trapezoid. Nothing says the legs ${n.QR} and ${n.SP} are congruent.`,
  },
  {
    key: 'tz-longer',
    name: 'trapezoid',
    text: (n) => `In ${n.S}, ${n.PQ} ∥ ${n.RS}, and ${n.PQ} is longer than ${n.RS}.`,
    slips: (n) => ({ parallelogram: { id: 'geo_one_pair_half_test', witness: `${n.PQ} and ${n.RS} are parallel but not the same length, so that pair is not both parallel and congruent.` } }),
    reveal: (n) => `${n.PQ} ∥ ${n.RS} with different lengths means the other pair is not parallel, so ${n.S} has exactly one pair of parallel sides: a trapezoid. Nothing says the legs are congruent.`,
  },
  {
    key: 'it-legs',
    name: 'isoTrapezoid',
    text: (n) => `In ${n.S}, ${n.PQ} ∥ ${n.RS}, ${n.QR} ≅ ${n.SP}, and ${n.PQ} is longer than ${n.RS}.`,
    reveal: (n) => `The bases ${n.PQ} and ${n.RS} have different lengths, so ${n.S} is not a parallelogram; it has exactly one pair of parallel sides and congruent legs. That is an isosceles trapezoid.`,
  },
  {
    key: 'it-angles',
    name: 'isoTrapezoid',
    text: (n) => `${n.S} is a trapezoid with bases ${n.PQ} and ${n.RS}, and ∠${n.P} ≅ ∠${n.Q}.`,
    reveal: () => `A trapezoid whose base angles are congruent is isosceles.`,
  },
  {
    key: 'it-diagonals',
    name: 'isoTrapezoid',
    text: (n) => `${n.S} is a trapezoid with bases ${n.PQ} and ${n.RS}, and its diagonals are congruent.`,
    reveal: () => `A trapezoid with congruent diagonals is isosceles.`,
  },
  {
    key: 'kite-lengths',
    name: 'kite',
    text: (n, rng) => {
      const a = rng.pick([5, 6, 7, 9, 10])
      const b = rng.pick([11, 12, 13, 14, 15])
      return `In ${n.S}, ${n.PQ} = ${n.SP} = ${a} and ${n.QR} = ${n.RS} = ${b}.`
    },
    reveal: (n) => `Two pairs of congruent consecutive sides, ${n.PQ} with ${n.SP} and ${n.QR} with ${n.RS}, and no congruent opposite sides: a kite.`,
  },
  {
    key: 'kite-marks',
    name: 'kite',
    text: (n) => `In ${n.S}, ${n.PQ} ≅ ${n.SP}, ${n.QR} ≅ ${n.RS}, and ${n.PQ} is shorter than ${n.QR}.`,
    reveal: () => `Two pairs of congruent consecutive sides, with the two pairs of different lengths, make a kite.`,
  },
  {
    key: 'q-onepair',
    name: 'quadrilateral',
    text: (n) => `In ${n.S}, ${n.PQ} ≅ ${n.RS}.`,
    slips: (n) => ({ parallelogram: { id: 'geo_one_pair_half_test', witness: `Only ${n.PQ} and ${n.RS} are given as congruent, and nothing says they are parallel.` } }),
    reveal: (n) => `One pair of congruent opposite sides does not force any special name: ${n.S} could be a parallelogram, an isosceles trapezoid, or neither.`,
  },
  {
    key: 'q-perp',
    name: 'quadrilateral',
    text: (n) => `The diagonals of ${n.S} are perpendicular.`,
    slips: () => ({
      rhombus: { id: 'geo_converse_property', witness: PERP_W },
      kite: { id: 'geo_converse_property', witness: PERP_W },
      square: { id: 'geo_converse_property', witness: PERP_W },
    }),
    reveal: () => `Perpendicular diagonals alone do not force a special name: a figure can have them without any congruent sides or any parallel sides.`,
  },
  {
    key: 'q-congdiag',
    name: 'quadrilateral',
    text: (n) => `The diagonals of ${n.S} are congruent.`,
    slips: () => ({
      rectangle: { id: 'geo_converse_property', witness: CONG_DIAG_W },
      isoTrapezoid: { id: 'geo_converse_property', witness: CONG_DIAG_W },
      square: { id: 'geo_converse_property', witness: CONG_DIAG_W },
    }),
    reveal: () => `Congruent diagonals alone do not force a special name: a figure can have them without any parallel sides.`,
  },
]

/** The facts mode leaves out the sets that state the answer's own name, and the must mode uses only these. */
const MUST_FACTS = FACTS.filter((fs) => ['rect-diagonals', 'rect-bisect', 'rh-perp', 'rh-bisect', 'sq-diagonals', 'sq-sides-right'].includes(fs.key))

const MARK_TARGETS: readonly QuadName[] = ['parallelogram', 'rectangle', 'rhombus', 'square', 'quadrilateral']
const MUST_TARGETS = ['rectangle', 'rhombus', 'square'] as const
type MustTarget = (typeof MUST_TARGETS)[number]

export function drawClassify(seed: number): GeoBuilt {
  // The kind of question and the answer are drawn once, so a shape that is harder to place is not skipped.
  const pick = makeRng(mixSeed(seed, 5500))
  const mode = pick.pick(MODES)
  const target = mode === 'marks' ? pick.pick(MARK_TARGETS) : mode === 'must' ? pick.pick(MUST_TARGETS) : pick.pick(QUAD_NAMES)
  for (let attempt = 0; attempt < 600; attempt++) {
    const rng = makeRng(mixSeed(seed, 5501 + attempt))
    const built =
      mode === 'facts'
        ? classifyFacts(rng, seed, target)
        : mode === 'marks'
          ? classifyMarks(rng, seed, target)
          : mode === 'coords'
            ? classifyCoords(rng, seed, target)
            : classifyMust(rng, seed, target as MustTarget)
    if (built) return built
  }
  throw new Error(`gs.classify/${seed}: no ${mode} ${target} problem`)
}

const NAME_HINT = 'Use only what is given. Pick the one name that uses all of it.'
const NAME_NUDGE = 'Write down every given fact. Then find the name whose definition, or a theorem, matches all of them, and check that nothing given is left out.'
const NAME_PROMPT = (S: string) => `What is the most specific name for ${S}?`

function nameStage(seed: number, answer: QuadName, S: string, slips: Partial<Record<QuadName, Slip>>, reveal: string, salt: number): GeometryAnswer['stages'][number] {
  const choices: ChoiceDraft5[] = QUAD_NAMES.map((id) => {
    const slip = slips[id] ?? (MORE_GENERAL[answer].includes(id) ? { id: 'geo_not_most_specific' as const, witness: NOT_SPECIFIC_W(S) } : undefined)
    return slip && id !== answer ? { id, text: NAME_TEXT[id], trap: slip.id, witness: slip.witness } : { id, text: NAME_TEXT[id] }
  })
  return choiceStage({
    id: 'a',
    label: 'Most specific name',
    hint: NAME_HINT,
    choices,
    answerId: answer,
    nudge: NAME_NUDGE,
    ruleCard: UNIT5_RULE_IDS.classify,
    reveal: [reveal],
    seed,
    salt,
  })
}

function classifyFinish(
  prompt: string,
  figure: GeoFigureSpec,
  stages: GeometryAnswer['stages'],
  params: Record<string, string | number | boolean>,
  promise: ErrorPatternId[],
  promiseStage?: GeometryAnswer['trapStage'],
): GeoBuilt | null {
  // On a naming question, promise the nearest general name (a square called a rectangle), not "quadrilateral".
  const answer = stages.length === 1 ? (stages[0]!.answerText as QuadName) : null
  const nearest = answer && MORE_GENERAL[answer] ? MORE_GENERAL[answer][0] : undefined
  return finish5({
    ...(promiseStage ? { promiseStage } : {}),
    ...(nearest ? { promiseText: nearest } : {}),
    question: 'quadClassify',
    prompt,
    figure,
    stages,
    lengths: [],
    angles: [],
    title: stages.length > 1 ? 'Which names must it have?' : 'The most specific name',
    instructions: stages.length > 1 ? 'Two parts, one at a time. Use only what is given.' : 'One part. Use only what is given.',
    params,
    cards: SPECIAL_RULES,
    ruleFor: UNIT5_RULE_FOR,
    promise,
  })
}

const NO_FIGURE: GeoFigureSpec = { ariaLabel: '', points: [] }
const NAME_PROMISE: ErrorPatternId[] = ['geo_converse_property', 'geo_one_pair_half_test', 'geo_not_most_specific']

function classifyFacts(rng: Rng, seed: number, target: QuadName): GeoBuilt | null {
  const ids = quadLetters(rng)
  const n = namesOf(ids)
  const set = rng.pick(FACTS.filter((fs) => fs.name === target))
  const facts = set.text(n, rng)
  const stage = nameStage(seed, target, n.S, set.slips?.(n) ?? {}, set.reveal(n), 5510)
  return classifyFinish(`${facts} ${NAME_PROMPT(n.S)}`, NO_FIGURE, [stage], { case: `facts-${set.key}`, answer: target }, NAME_PROMISE)
}

// Marks on a figure. The figure is drawn to agree with every mark, and shows nothing more.

interface MarkScene {
  ticks: Map<number, 1 | 2>
  arcs: Map<number, 1 | 2>
  rights: number[]
  diag: Map<number, 1 | 2> | null
  rightAtCrossing: boolean
}

const scene0 = (): MarkScene => ({ ticks: new Map(), arcs: new Map(), rights: [], diag: null, rightAtCrossing: false })

interface MarkSet {
  key: string
  name: QuadName
  scene: () => MarkScene
  shape: (rng: Rng) => XY[] | null
  slips?: (n: Names) => Partial<Record<QuadName, Slip>>
  reveal: (n: Names) => string
}

function genericPgram(rng: Rng): XY[] {
  const a = rng.int(16, 26)
  const b = a / (1.3 + rng.next() * 0.5)
  return parallelogramAt(a, b, rng.chance(0.5) ? rng.int(58, 74) : rng.int(106, 122))
}

function rectShape(rng: Rng): XY[] {
  return rectangleLocal(1.35 + rng.next() * 0.6)
}

function rhombusShape(rng: Rng): XY[] {
  return parallelogramAt(20, 20, rng.chance(0.5) ? rng.int(56, 72) : rng.int(108, 124))
}

function squareShape(): XY[] {
  return parallelogramAt(20, 20, 90)
}

/** Isosceles trapezoid with its legs as local sides 0 and 2 (the ticked opposite pair). */
function legsTrap(rng: Rng): XY[] {
  const bottom = rng.int(20, 28)
  const top = bottom * (0.45 + rng.next() * 0.2)
  const h = ((bottom - top) / 2) * Math.tan((rng.int(55, 70) * Math.PI) / 180)
  const [P, Q, R, S] = [{ x: 0, y: 0 }, { x: bottom, y: 0 }, { x: (bottom + top) / 2, y: h }, { x: (bottom - top) / 2, y: h }]
  return [Q, R, S, P]
}

/** Diagonals perpendicular, crossing at a point that is the midpoint of neither. */
function orthoQuad(rng: Rng): XY[] {
  const a = 8 + rng.next() * 4
  const c = 14 + rng.next() * 6
  const b = 7 + rng.next() * 3
  const d = 11 + rng.next() * 5
  return [{ x: -a, y: 0 }, { x: 0, y: -b }, { x: c, y: 0 }, { x: 0, y: d }]
}

/** Kite with its congruent angles at local corners 0 and 2 (the axis runs from corner 1 to 3). */
function kiteSideways(rng: Rng): XY[] {
  const axis = rng.int(22, 30)
  const local = kiteAt(axis, axis * (0.3 + rng.next() * 0.1), axis * (0.34 + rng.next() * 0.08))
  return [local[1]!, local[2]!, local[3]!, local[0]!]
}

const MARKS: readonly MarkSet[] = [
  {
    key: 'pg-ticks',
    name: 'parallelogram',
    scene: () => ({ ...scene0(), ticks: new Map<number, 1 | 2>([[0, 1], [2, 1], [1, 2], [3, 2]]) }),
    shape: genericPgram,
    reveal: () => 'Both pairs of opposite sides are marked congruent, so the figure is a parallelogram. No marks give right angles or congruent consecutive sides.',
  },
  {
    key: 'pg-arcs',
    name: 'parallelogram',
    scene: () => ({ ...scene0(), arcs: new Map<number, 1 | 2>([[0, 1], [2, 1], [1, 2], [3, 2]]) }),
    shape: genericPgram,
    reveal: () => 'Both pairs of opposite angles are marked congruent, so the figure is a parallelogram, and nothing more is marked.',
  },
  {
    key: 'pg-diag',
    name: 'parallelogram',
    scene: () => ({ ...scene0(), diag: new Map<number, 1 | 2>([[0, 1], [2, 1], [1, 2], [3, 2]]) }),
    shape: genericPgram,
    reveal: () => 'Each diagonal is marked cut in half, so the diagonals bisect each other: a parallelogram. The two diagonals are not marked congruent or perpendicular.',
  },
  {
    key: 'rect-rights',
    name: 'rectangle',
    scene: () => ({ ...scene0(), rights: [0, 1, 2, 3] }),
    shape: rectShape,
    reveal: () => 'Four right angles make a rectangle. No sides are marked congruent.',
  },
  {
    key: 'rect-diag',
    name: 'rectangle',
    scene: () => ({ ...scene0(), diag: new Map<number, 1 | 2>([[0, 1], [1, 1], [2, 1], [3, 1]]) }),
    shape: rectShape,
    reveal: () => 'All four half-diagonals are marked congruent: the diagonals bisect each other and are congruent, so the figure is a rectangle. Nothing marks them perpendicular.',
  },
  {
    key: 'rh-ticks',
    name: 'rhombus',
    scene: () => ({ ...scene0(), ticks: new Map<number, 1 | 2>([[0, 1], [1, 1], [2, 1], [3, 1]]) }),
    shape: rhombusShape,
    reveal: () => 'Four congruent sides make a rhombus. No right angle is marked.',
  },
  {
    key: 'rh-diag',
    name: 'rhombus',
    scene: () => ({ ...scene0(), diag: new Map<number, 1 | 2>([[0, 1], [2, 1], [1, 2], [3, 2]]), rightAtCrossing: true }),
    shape: rhombusShape,
    reveal: () => 'The diagonals are marked bisecting each other and perpendicular, so the figure is a rhombus. They are not marked congruent.',
  },
  {
    key: 'sq-ticks',
    name: 'square',
    scene: () => ({ ...scene0(), ticks: new Map<number, 1 | 2>([[0, 1], [1, 1], [2, 1], [3, 1]]), rights: [0] }),
    shape: squareShape,
    reveal: () => 'Four congruent sides make a rhombus, and a right angle makes it a rectangle too. A figure that is both is a square.',
  },
  {
    key: 'sq-diag',
    name: 'square',
    scene: () => ({ ...scene0(), diag: new Map<number, 1 | 2>([[0, 1], [1, 1], [2, 1], [3, 1]]), rightAtCrossing: true }),
    shape: squareShape,
    reveal: () => 'The diagonals are marked congruent, bisecting each other, and perpendicular. That makes a rectangle and a rhombus: a square.',
  },
  {
    key: 'q-onepair',
    name: 'quadrilateral',
    scene: () => ({ ...scene0(), ticks: new Map<number, 1 | 2>([[0, 1], [2, 1]]) }),
    shape: (rng) => (rng.chance(0.5) ? genericPgram(rng) : legsTrap(rng)),
    slips: (n) => ({ parallelogram: { id: 'geo_one_pair_half_test', witness: `Only ${n.PQ} and ${n.RS} are marked, with ticks, and nothing marks them parallel.` } }),
    reveal: () => 'One pair of opposite sides marked congruent does not force any special name.',
  },
  {
    key: 'q-perp',
    name: 'quadrilateral',
    scene: () => ({ ...scene0(), diag: new Map(), rightAtCrossing: true }),
    shape: orthoQuad,
    slips: () => ({
      rhombus: { id: 'geo_converse_property', witness: PERP_W },
      kite: { id: 'geo_converse_property', witness: PERP_W },
      square: { id: 'geo_converse_property', witness: PERP_W },
    }),
    reveal: () => 'Only a right angle at the crossing is marked. Perpendicular diagonals alone do not force a special name.',
  },
  {
    key: 'q-arcs',
    name: 'quadrilateral',
    scene: () => ({ ...scene0(), arcs: new Map<number, 1 | 2>([[0, 1], [2, 1]]) }),
    shape: (rng) => (rng.chance(0.5) ? genericPgram(rng) : kiteSideways(rng)),
    slips: () => ({ kite: { id: 'geo_converse_property', witness: 'One pair of congruent opposite angles alone does not make that shape. No sides are marked congruent.' } }),
    reveal: () => 'Only one pair of opposite angles is marked congruent. That alone does not force a special name.',
  },
]

const plural = (k: number, noun: string) => `${k} ${noun}${k === 1 ? '' : 's'}`

function markFigure(ids: Ids, corners: XY[], m: MarkScene, T: string | null): GeoFigureSpec {
  const n = ids.join('')
  const segments: GeoSegment[] = [0, 1, 2, 3].map((i) => {
    const t = m.ticks.get(i)
    return t ? seg(...sideOf(ids, i), { ticks: t }) : seg(...sideOf(ids, i))
  })
  const angles: GeoAngleMark[] = []
  for (const [k, c] of m.arcs) angles.push({ vertex: vtx(ids, k), from: vtx(ids, k + 1), to: vtx(ids, k - 1), marks: c })
  for (const k of m.rights) angles.push({ vertex: vtx(ids, k), from: vtx(ids, k + 1), to: vtx(ids, k - 1), right: true })
  let points = labeled(ids, corners, corners)
  // Not "Quadrilateral": on a most-specific-name question that word is a button.
  const words = [`Figure ${n}.`]
  for (const c of [1, 2] as const) {
    const sides = [...m.ticks.entries()].filter(([, v]) => v === c).map(([i]) => sideName(ids, i))
    if (sides.length === 4) words.push(`All four sides have ${plural(c, 'tick')}.`)
    else if (sides.length === 2) words.push(`Sides ${sides[0]} and ${sides[1]} have ${plural(c, 'tick')} each.`)
    const at = [...m.arcs.entries()].filter(([, v]) => v === c).map(([k]) => vtx(ids, k))
    if (at.length === 2) words.push(`Angles ${at[0]} and ${at[1]} have ${plural(c, 'arc')} each.`)
  }
  if (m.rights.length === 4) words.push('All four angles are marked as right angles.')
  else if (m.rights.length === 1) words.push(`Angle ${vtx(ids, m.rights[0]!)} is marked as a right angle.`)
  if (m.diag && T) {
    points = [...points, ...labeled([T], [crossingOf(corners)], corners, [T])]
    for (let k = 0; k < 4; k++) {
      const c = m.diag.get(k)
      segments.push(c ? seg(vtx(ids, k), T, { ticks: c }) : seg(vtx(ids, k), T))
    }
    words.push(`Diagonals ${vtx(ids, 0)}${vtx(ids, 2)} and ${vtx(ids, 1)}${vtx(ids, 3)} meet at ${T}.`)
    const all = [...m.diag.values()]
    if (all.length === 4 && all.every((v) => v === 1)) words.push(`All four segments from ${T} to a vertex have 1 tick.`)
    else {
      for (const c of [1, 2] as const) {
        const halves = [...m.diag.entries()].filter(([, v]) => v === c).map(([k]) => `${vtx(ids, k)}${T}`)
        if (halves.length === 2) words.push(`Segments ${halves[0]} and ${halves[1]} have ${plural(c, 'tick')} each.`)
      }
    }
    if (m.rightAtCrossing) {
      angles.push({ vertex: T, from: vtx(ids, 0), to: vtx(ids, 1), right: true })
      words.push(`The diagonals are marked perpendicular at ${T}.`)
    }
  }
  return { ariaLabel: words.join(' '), points, segments, ...(angles.length ? { angles } : {}) }
}

function drawMarks(rng: Rng, ids: Ids, set: MarkSet): GeoFigureSpec | null {
  const local = set.shape(rng)
  if (!local) return null
  const corners = turn(local, tilt(rng, 20), rng.chance(0.5))
  if (!goodQuad(corners, 30)) return null
  const scene = set.scene()
  const T = scene.diag ? extraLetters(rng, ids, 1)[0]! : null
  return markFigure(ids, corners, scene, T)
}

function classifyMarks(rng: Rng, seed: number, target: QuadName): GeoBuilt | null {
  const ids = quadLetters(rng)
  const n = namesOf(ids)
  const set = rng.pick(MARKS.filter((ms) => ms.name === target))
  const figure = drawMarks(rng, ids, set)
  if (!figure) return null
  const stage = nameStage(seed, target, n.S, set.slips?.(n) ?? {}, set.reveal(n), 5520)
  return classifyFinish(`The marks show what is given about ${n.S}. ${NAME_PROMPT(n.S)}`, figure, [stage], { case: `marks-${set.key}`, answer: target }, NAME_PROMISE)
}

// Coordinates: the name comes from exact slopes and lengths of a figure on the grid.

/** The most specific name of a convex quadrilateral with whole-number vertices, from exact arithmetic. */
export function nameOfLattice(p: readonly V[]): QuadName {
  const s = [0, 1, 2, 3].map((i) => minus(p[(i + 1) % 4]!, p[i]!))
  const cross = (a: V, b: V) => a.x * b.y - a.y * b.x
  const len2 = s.map((v) => v.x * v.x + v.y * v.y)
  const par02 = cross(s[0]!, s[2]!) === 0
  const par13 = cross(s[1]!, s[3]!) === 0
  if (par02 && par13) {
    const right = s[0]!.x * s[1]!.x + s[0]!.y * s[1]!.y === 0
    const equal = len2[0] === len2[1]
    return right && equal ? 'square' : right ? 'rectangle' : equal ? 'rhombus' : 'parallelogram'
  }
  if (par02 || par13) {
    const legs = par02 ? [1, 3] : [0, 2]
    return len2[legs[0]!] === len2[legs[1]!] ? 'isoTrapezoid' : 'trapezoid'
  }
  if ((len2[0] === len2[1] && len2[2] === len2[3]) || (len2[1] === len2[2] && len2[3] === len2[0])) return 'kite'
  return 'quadrilateral'
}

function latticeFor(rng: Rng, target: QuadName): V[] | null {
  const O = { x: 0, y: 0 }
  if (target === 'parallelogram') return latticePgram(rng, () => true)
  if (target === 'trapezoid') return latticeTrap(rng)
  if (target === 'isoTrapezoid') return latticeIsoTrap(rng)
  const d = vec(rng, -4, 4)
  if (gcd(d.x, d.y) !== 1) return null
  const perp = { x: -d.y, y: d.x }
  if (target === 'square') {
    const k = rng.int(1, 2)
    return onGrid(rng, [O, scale(k, d), add(scale(k, d), scale(k, perp)), scale(k, perp)])
  }
  if (target === 'rectangle') {
    const a = rng.int(1, 3)
    const b = rng.intExcept(1, 3, [a])
    return onGrid(rng, [O, scale(a, d), add(scale(a, d), scale(b, perp)), scale(b, perp)])
  }
  if (target === 'rhombus') {
    const u = vec(rng, -5, 5)
    const v = rng.chance(0.5) ? { x: u.y, y: u.x } : { x: u.x, y: -u.y }
    const ang = angleBetween(u, v)
    if (!(ang > 35 && ang < 145) || Math.abs(ang - 90) < 10) return null
    return onGrid(rng, [O, u, add(u, v), v])
  }
  if (target === 'kite') {
    const s1 = rng.int(1, 3)
    const s2 = rng.intExcept(1, 4, [s1])
    const k = rng.int(1, 2)
    return onGrid(rng, [scale(-s1, perp), scale(k, d), scale(s2, perp), scale(-k, d)])
  }
  // A plain quadrilateral with one pair of congruent opposite sides and no parallel sides.
  const u = vec(rng, -5, 5)
  const w = vec(rng, -5, 5)
  const rs = { x: -u.y, y: u.x }
  const pts = [O, u, add(u, w), add(add(u, w), rs)]
  return onGrid(rng, pts)
}

function classifyCoords(rng: Rng, seed: number, target: QuadName): GeoBuilt | null {
  const raw = latticeFor(rng, target)
  if (!raw) return null
  const start = rng.int(0, 3)
  const dir = rng.chance(0.5) ? 1 : -1
  const pts = [0, 1, 2, 3].map((i) => raw[mod4(start + dir * i)]!)
  if (!goodQuad(pts, 28, 0.25)) return null
  if (nameOfLattice(pts) !== target) return null
  const ids = quadLetters(rng)
  const n = namesOf(ids)
  const sides = [0, 1, 2, 3].map((i) => minus(pts[(i + 1) % 4]!, pts[i]!))
  const len2 = sides.map((v) => v.x * v.x + v.y * v.y)
  const slips: Partial<Record<QuadName, Slip>> = {}
  if (target === 'trapezoid' || target === 'isoTrapezoid') {
    // Which pair is parallel decides the words in the witness.
    const par02 = sides[0]!.x * sides[2]!.y - sides[0]!.y * sides[2]!.x === 0
    const [a, b] = par02 ? [n.PQ, n.RS] : [n.QR, n.SP]
    if (target === 'trapezoid') slips.parallelogram = { id: 'geo_one_pair_half_test', witness: `${a} and ${b} have equal slopes, but the other two sides do not, so only one pair of opposite sides is parallel.` }
  }
  if (target === 'quadrilateral') {
    const pairs = len2[0] === len2[2] ? [n.PQ, n.RS] : len2[1] === len2[3] ? [n.QR, n.SP] : null
    if (!pairs) return null
    slips.parallelogram = { id: 'geo_one_pair_half_test', witness: `${pairs[0]} and ${pairs[1]} have equal lengths, but no two sides have equal slopes, so no pair is parallel.` }
  }
  const listed = ids.map((id, k) => `${id}${showPt(pts[k]!.x, pts[k]!.y)}`)
  const prompt = `${n.S} has vertices ${listed[0]}, ${listed[1]}, ${listed[2]}, and ${listed[3]}. ${NAME_PROMPT(n.S)}`
  const corners: XY[] = pts.map((p) => ({ x: p.x, y: p.y }))
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const figure: GeoFigureSpec = {
    ariaLabel: `Figure ${n.S} on a coordinate grid, with ${ids.map((id, k) => `${id} at ${showPt(pts[k]!.x, pts[k]!.y)}`).join(', ')}.`,
    grid: { xMin: Math.min(...xs) - 1, xMax: Math.max(...xs) + 1, yMin: Math.min(...ys) - 1, yMax: Math.max(...ys) + 1 },
    points: labeled(ids, corners, corners),
    segments: [0, 1, 2, 3].map((i) => seg(...sideOf(ids, i))),
  }
  const reveal = coordsReveal(target, n, sides)
  const stage = nameStage(seed, target, n.S, slips, reveal, 5530)
  return classifyFinish(prompt, figure, [stage], { case: `coords-${target}`, answer: target }, NAME_PROMISE)
}

function coordsReveal(target: QuadName, n: Names, s: V[]): string {
  const slope = (v: V) => (v.x === 0 ? 'undefined' : `${v.y < 0 !== v.x < 0 && v.y !== 0 ? '−' : ''}${Math.abs(v.y / gcd(v.y, v.x))}${Math.abs(v.x / gcd(v.y, v.x)) === 1 ? '' : `/${Math.abs(v.x / gcd(v.y, v.x))}`}`)
  const names = [n.PQ, n.QR, n.RS, n.SP]
  const facts = `The slopes of ${names.join(', ')} are ${s.map(slope).join(', ')}, and their lengths squared are ${s.map((v) => v.x * v.x + v.y * v.y).join(', ')}.`
  const why: Record<QuadName, string> = {
    parallelogram: 'Both pairs of opposite sides are parallel, consecutive sides are not perpendicular, and consecutive sides are not equal: a parallelogram.',
    rectangle: 'Both pairs of opposite sides are parallel and consecutive sides are perpendicular, but consecutive sides are not equal: a rectangle.',
    rhombus: 'All four sides are equal, but consecutive sides are not perpendicular: a rhombus.',
    square: 'All four sides are equal and consecutive sides are perpendicular: a square.',
    trapezoid: 'Exactly one pair of opposite sides is parallel, and the legs are not equal: a trapezoid.',
    isoTrapezoid: 'Exactly one pair of opposite sides is parallel, and the legs are equal: an isosceles trapezoid.',
    kite: 'Two pairs of consecutive sides are equal, and no opposite sides are equal: a kite.',
    quadrilateral: 'No sides are parallel, and the equal sides do not make a kite: just a quadrilateral.',
  }
  return `${facts} ${why[target]}`
}

// Must it be a rectangle? Must it be a rhombus? One Yes or No at a time.

const YES_NO: ChoiceDraft5[] = [
  { id: 'yes', text: 'Yes' },
  { id: 'no', text: 'No' },
]

function mustStage(seed: number, id: 'a' | 'b', which: 'rectangle' | 'rhombus', truth: boolean, slip: Slip | null, reveal: string): GeometryAnswer['stages'][number] {
  const wrong = truth ? 'no' : 'yes'
  return choiceStage({
    id,
    label: which === 'rectangle' ? 'Rectangle?' : 'Rhombus?',
    hint: which === 'rectangle' ? 'Must every figure with these facts be a rectangle?' : 'Must every figure with these facts be a rhombus?',
    choices: YES_NO.map((c) => (c.id === wrong && slip ? { ...c, trap: slip.id, witness: slip.witness } : c)),
    answerId: truth ? 'yes' : 'no',
    nudge: which === 'rectangle' ? 'A rectangle is a parallelogram with four right angles. Do the facts force that?' : 'A rhombus is a parallelogram with four congruent sides. Do the facts force that?',
    ruleCard: UNIT5_RULE_IDS.rectRhombus,
    reveal: [reveal],
    seed,
    salt: 5540,
    keepOrder: true,
  })
}

const MUST_MARKS = MARKS.filter((ms) => ['rect-diag', 'rh-diag', 'sq-ticks', 'sq-diag'].includes(ms.key))

function classifyMust(rng: Rng, seed: number, target: MustTarget): GeoBuilt | null {
  const ids = quadLetters(rng)
  const n = namesOf(ids)
  const useMarks = rng.chance(0.5)
  let lead: string
  let figure: GeoFigureSpec = NO_FIGURE
  let key: string
  let diagonal: boolean
  if (useMarks) {
    const set = rng.pick(MUST_MARKS.filter((ms) => ms.name === target))
    const drawn = drawMarks(rng, ids, set)
    if (!drawn) return null
    figure = drawn
    lead = `The marks show what is given about ${n.S}.`
    key = `marks-${set.key}`
    diagonal = set.key.endsWith('diag')
  } else {
    const set = rng.pick(MUST_FACTS.filter((fs) => fs.name === target))
    lead = set.text(n, rng)
    key = `facts-${set.key}`
    diagonal = Boolean(set.diagonal)
  }
  const isRect = target !== 'rhombus'
  const isRhombus = target !== 'rectangle'
  const rectSlip: Slip | null =
    target === 'square'
      ? { id: 'geo_square_not_rectangle', witness: 'These facts give four right angles. A figure with four right angles is a rectangle, whatever else is true of it.' }
      : target === 'rhombus' && diagonal
        ? { id: 'geo_rect_rhombus_swapped', witness: 'Perpendicular diagonals give a parallelogram four congruent sides. Nothing here gives it right angles.' }
        : null
  const rhombusSlip: Slip | null =
    target === 'square'
      ? { id: 'geo_square_not_rectangle', witness: 'These facts give four congruent sides. A figure with four congruent sides is a rhombus, whatever else is true of it.' }
      : target === 'rectangle' && diagonal
        ? { id: 'geo_rect_rhombus_swapped', witness: 'Congruent diagonals give a parallelogram four right angles. Nothing here makes its sides congruent.' }
        : null
  if (!rectSlip && !rhombusSlip) return null
  const rectReveal = isRect ? `Yes: the facts give a parallelogram with four right angles, which is a rectangle.` : `No: nothing given forces a right angle, so it need not be a rectangle.`
  const rhombusReveal = isRhombus ? `Yes: the facts give a parallelogram with four congruent sides, which is a rhombus.` : `No: nothing given forces congruent sides, so it need not be a rhombus.`
  const stages = [mustStage(seed, 'a', 'rectangle', isRect, rectSlip, rectReveal), mustStage(seed, 'b', 'rhombus', isRhombus, rhombusSlip, rhombusReveal)]
  const prompt = `${lead} Must ${n.S} be a rectangle? Must it be a rhombus?`
  // The second part's slip is promised first: a slip on the last part cannot hint at a part still open.
  const promise: ErrorPatternId[] = rhombusSlip ? [rhombusSlip.id] : [rectSlip!.id]
  return classifyFinish(prompt, figure, stages, { case: `must-${key}`, answer: `${isRect ? 'yes' : 'no'}-${isRhombus ? 'yes' : 'no'}` }, promise, rhombusSlip ? 'b' : 'a')
}
