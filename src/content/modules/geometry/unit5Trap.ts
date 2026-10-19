/**
 * Honors geometry Unit 5, trapezoids, kites, and midsegments (Jurgensen 5-3 and 5-5). gz.midseg is the
 * triangle midsegment (parallel to the third side and half as long) and the median of a trapezoid (half the sum
 * of the bases). gz.isosceles is an isosceles trapezoid (base angles congruent, legs congruent, diagonals
 * congruent) or a kite (diagonals perpendicular, one pair of opposite angles congruent). Each seed's trap is
 * the factor of 2 on the wrong side, a base taken as the median, a parallelogram rule used on a trapezoid, or a
 * kite's congruent angles put between its congruent sides.
 */
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { GeometryAnswer } from '@/content/types'
import type { ErrorPatternId, GeoAngleMark, GeoFigureSpec, GeoSegment } from '@/shared/types'
import type { GeoBuilt } from './build'
import { angleLabel, formatLin, lin, type Lin } from './expr'
import { DEG_HINT5, LEN_HINT5, X_HINT5, X_POOL5, atX, finish5, fit, numberStage, reserved, solve, sum, times, typed, wholePositive, type TrapDraft } from './unit5Build'
import { placeSegLabels, seg, vtx, type Ids } from './unit5Figs'
import { crossing, extraLetters, goodQuad, goodTriangle, isoTrapezoidAt, kiteAt, labeled, quadLetters, tilt, trapezoidAt, turn, type XY } from './unit5Geom'
import { TRAPEZOID_RULES, UNIT5_RULE_FOR, UNIT5_RULE_IDS } from './unit5Rules'

const COEFFS = [1, 2, 3, 4, 5, 6] as const
const coeffs = (rng: Rng, n: number) => rng.shuffle([...COEFFS]).slice(0, n)
const f = (e: Lin) => formatLin(e)
const mid = (a: XY, b: XY): XY => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const ANSWERED_X_W = (asked: string) => `That is the value of x, not ${asked}. Use x to find the measure itself.`
const NUMBER_INSTRUCTIONS = 'Find x, then the part the question asks for. The figure is there before you answer.'

function trapFinish(
  question: GeometryAnswer['question'],
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
    question,
    prompt,
    figure,
    stages,
    lengths,
    angles,
    title,
    instructions: NUMBER_INSTRUCTIONS,
    params,
    cards: TRAPEZOID_RULES,
    ruleFor: UNIT5_RULE_FOR,
    promise,
  })
}

// --- gz.midseg -------------------------------------------------------------------------------------------

type MidKind = 'triangleBoth' | 'triangleBase' | 'medianBases' | 'medianSum' | 'medianOne'
const MID_KINDS: readonly MidKind[] = ['triangleBoth', 'triangleBase', 'medianBases', 'medianSum', 'medianOne']

const DOUBLED_W = (mid: string, side: string) =>
  `That x makes ${mid} twice ${side}. It is the other way around: the midsegment ${mid} is half of ${side}, the side it does not touch.`
const DOUBLED_RESULT_W = (mid: string, side: string) => `That is the length of ${side}. ${mid} joins two midpoints, so it is half of ${side}.`
const NOT_HALVED_W = 'That x makes the median equal to the sum of the bases. The median is halfway between the bases, so it is half of their sum.'
const AS_BASE_W = (base: string) => `That x makes the median equal to base ${base}. The median is between the two bases in length: half of their sum.`

export function drawMidsegment(seed: number): GeoBuilt {
  const kind = makeRng(mixSeed(seed, 5600)).pick(MID_KINDS)
  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = makeRng(mixSeed(seed, 5601 + attempt))
    const built = kind === 'triangleBoth' || kind === 'triangleBase' ? triangleMidsegment(rng, kind) : trapezoidMedian(rng, kind)
    if (built) return built
  }
  throw new Error(`gz.midseg/${seed}: no ${kind} problem`)
}

/** M and N are the midpoints of AB and AC. MN = ½ BC. */
function triangleMidsegment(rng: Rng, kind: 'triangleBoth' | 'triangleBase'): GeoBuilt | null {
  const letters = extraLetters(rng, [], 5)
  const [A, B, C, M, N] = letters as [string, string, string, string, string]
  const x = rng.pick(X_POOL5)
  const m = rng.int(7, 40)
  if (reserved(m) || reserved(2 * m)) return null
  const MN = `${M}${N}`
  const BC = `${B}${C}`
  let eMN: Lin | null = null
  let eBC: Lin | null = null
  let slip: ReturnType<typeof solve>
  if (kind === 'triangleBoth') {
    const [a1, a2] = coeffs(rng, 2) as [number, number]
    if (a2 === 2 * a1 || a1 === 2 * a2) return null
    eMN = fit(m, x, a1)
    eBC = fit(2 * m, x, a2)
    const s = solve(times(2, eMN), eBC)
    if (!s || s.d !== 1 || s.n !== x) return null
    slip = solve(eMN, times(2, eBC))
  } else {
    const a1 = rng.pick(COEFFS)
    eMN = fit(m, x, a1)
    const s = solve(eMN, lin(0, m))
    if (!s || s.d !== 1 || s.n !== x) return null
    slip = solve(eMN, lin(0, 4 * m))
  }
  if (wholePositive(slip) === null) return null
  const askMid = rng.chance(0.5) || kind === 'triangleBase'
  const askName = askMid ? MN : BC
  const result = askMid ? m : 2 * m
  const traps: TrapDraft[] = [{ id: 'geo_midsegment_doubled', stage: 'x', text: typed(slip!), witness: DOUBLED_W(MN, BC) }]
  if (askMid && kind === 'triangleBoth') traps.push({ id: 'geo_midsegment_doubled', stage: 'result', text: String(2 * m), witness: DOUBLED_RESULT_W(MN, BC) })
  traps.push({ id: 'geo_answered_x', stage: 'result', text: String(x), witness: ANSWERED_X_W(askName) })
  const bcText = eBC ? f(eBC) : String(2 * m)
  const prompt = `In triangle ${A}${B}${C}, ${M} is the midpoint of ${A}${B} and ${N} is the midpoint of ${A}${C}, so ${MN} is a midsegment. ${MN} = ${f(eMN)} and ${BC} = ${bcText}. Find x, then ${askName}.`
  // The triangle: base BC across the bottom, apex A above.
  const base = 20
  const apexX = base * (0.25 + rng.next() * 0.5)
  const height = base * (0.55 + rng.next() * 0.4)
  const local: XY[] = [{ x: apexX, y: height }, { x: 0, y: 0 }, { x: base, y: 0 }]
  const tri = turn(local, tilt(rng, 6), rng.chance(0.5))
  if (!goodTriangle(tri, 30)) return null
  const [pA, pB, pC] = tri as [XY, XY, XY]
  const pM = mid(pA, pB)
  const pN = mid(pA, pC)
  const points = [...labeled([A, B, C], [pA, pB, pC], tri), ...labeled([M, N], [pM, pN], tri)]
  const segments: GeoSegment[] = [
    seg(A, M, { ticks: 1 }),
    seg(M, B, { ticks: 1 }),
    seg(A, N, { ticks: 2 }),
    seg(N, C, { ticks: 2 }),
    seg(B, C, { label: bcText }),
    seg(M, N, { label: f(eMN) }),
  ]
  const aria = `Triangle ${A}${B}${C} with ${M} on ${A}${B} and ${N} on ${A}${C}. ${A}${M} and ${M}${B} have 1 tick each, and ${A}${N} and ${N}${C} have 2 ticks each. Segment ${MN} is labeled ${f(eMN)} and side ${BC} is labeled ${bcText}.`
  const figure = placeSegLabels({ ariaLabel: aria, points, segments }, [A, B, C])
  if (!figure) return null
  const xReveal = eBC
    ? `${MN} joins the midpoints of two sides, so ${BC} = 2 · ${MN}: ${f(eBC)} = 2(${f(eMN)}), and x = ${x}.`
    : `${MN} joins the midpoints of two sides, so ${MN} = ½ · ${BC} = ${m}: ${f(eMN)} = ${m}, and x = ${x}.`
  const stages = [
    numberStage({
      id: 'x',
      label: 'x',
      hint: X_HINT5,
      answerText: String(x),
      nudge: 'The midsegment is parallel to the side it does not touch. How do their lengths compare?',
      ruleCard: UNIT5_RULE_IDS.midsegment,
      reveal: [xReveal],
      traps,
    }),
    numberStage({
      id: 'result',
      label: askName,
      hint: LEN_HINT5,
      answerText: String(result),
      nudge: 'Put your value of x into the expression for this segment.',
      ruleCard: UNIT5_RULE_IDS.midsegment,
      reveal: [askMid ? `${MN} = ${atX(eMN, x)}.` : `${BC} = ${atX(eBC!, x)}.`],
      traps,
    }),
  ]
  return trapFinish('midsegment', prompt, figure, stages, [m, 2 * m], [], 'Midsegments and medians', { case: kind, x, asked: askName }, ['geo_midsegment_doubled'])
}

/** MN is the median of trapezoid PQRS with bases PQ and SR: MN = ½(PQ + SR). */
function trapezoidMedian(rng: Rng, kind: 'medianBases' | 'medianSum' | 'medianOne'): GeoBuilt | null {
  const ids = quadLetters(rng)
  const [M, N] = extraLetters(rng, ids, 2) as [string, string]
  const name = ids.join('')
  const [P, Q, R, S] = ids
  const x = rng.pick(X_POOL5)
  const b1 = rng.int(12, 60)
  const b2 = rng.int(6, 50)
  if (b1 === b2 || (b1 + b2) % 2 !== 0) return null
  if (Math.max(b1, b2) / Math.min(b1, b2) < 1.35) return null
  const med = (b1 + b2) / 2
  if ([b1, b2, med].some(reserved)) return null
  const PQ = `${P}${Q}`
  const SR = `${S}${R}`
  const MN = `${M}${N}`
  const traps: TrapDraft[] = []
  let ePQ: Lin | null = null
  let eSR: Lin | null = null
  let eMN: Lin | null = null
  let askName: string
  let result: number
  let xReveal: string
  if (kind === 'medianBases') {
    const a = rng.pick(COEFFS)
    eMN = fit(med, x, a)
    const notHalved = solve(eMN, lin(0, b1 + b2))
    const base1 = solve(eMN, lin(0, b1))
    const base2 = solve(eMN, lin(0, b2))
    if (wholePositive(notHalved) === null && wholePositive(base1) === null && wholePositive(base2) === null) return null
    if (notHalved) traps.push({ id: 'geo_median_not_halved', stage: 'x', text: typed(notHalved), witness: NOT_HALVED_W })
    if (base1) traps.push({ id: 'geo_median_as_base', stage: 'x', text: typed(base1), witness: AS_BASE_W(PQ) })
    if (base2) traps.push({ id: 'geo_median_as_base', stage: 'x', text: typed(base2), witness: AS_BASE_W(SR) })
    askName = MN
    result = med
    xReveal = `The median is half the sum of the bases: ${f(eMN)} = ½(${b1} + ${b2}) = ${med}, and x = ${x}.`
  } else if (kind === 'medianSum') {
    const [a1, a2] = coeffs(rng, 2) as [number, number]
    ePQ = fit(b1, x, a1)
    eSR = fit(b2, x, a2)
    const s = solve(sum(ePQ, eSR), lin(0, 2 * med))
    if (!s || s.d !== 1 || s.n !== x) return null
    const notHalved = solve(sum(ePQ, eSR), lin(0, med))
    const base1 = solve(ePQ, lin(0, med))
    const base2 = solve(eSR, lin(0, med))
    if (wholePositive(notHalved) === null && wholePositive(base1) === null && wholePositive(base2) === null) return null
    if (notHalved) traps.push({ id: 'geo_median_not_halved', stage: 'x', text: typed(notHalved), witness: NOT_HALVED_W })
    if (base1) traps.push({ id: 'geo_median_as_base', stage: 'x', text: typed(base1), witness: AS_BASE_W(PQ) })
    if (base2) traps.push({ id: 'geo_median_as_base', stage: 'x', text: typed(base2), witness: AS_BASE_W(SR) })
    const askFirst = rng.chance(0.5)
    askName = askFirst ? PQ : SR
    result = askFirst ? b1 : b2
    xReveal = `The median is half the sum of the bases, so the bases add to twice it: (${f(ePQ)}) + (${f(eSR)}) = 2 · ${med}, and x = ${x}.`
  } else {
    const [a1, a2] = coeffs(rng, 2) as [number, number]
    if (a1 === 2 * a2) return null
    ePQ = fit(b1, x, a1)
    eMN = fit(med, x, a2)
    const s = solve(lin(ePQ.a, ePQ.b + b2), times(2, eMN))
    if (!s || s.d !== 1 || s.n !== x) return null
    const notHalved = solve(lin(ePQ.a, ePQ.b + b2), eMN)
    const base1 = ePQ.a === eMN.a ? null : solve(ePQ, eMN)
    const base2 = solve(eMN, lin(0, b2))
    if (wholePositive(notHalved) === null && wholePositive(base1) === null && wholePositive(base2) === null) return null
    if (notHalved) traps.push({ id: 'geo_median_not_halved', stage: 'x', text: typed(notHalved), witness: NOT_HALVED_W })
    if (base1) traps.push({ id: 'geo_median_as_base', stage: 'x', text: typed(base1), witness: AS_BASE_W(PQ) })
    if (base2) traps.push({ id: 'geo_median_as_base', stage: 'x', text: typed(base2), witness: AS_BASE_W(SR) })
    const askMedian = rng.chance(0.5)
    askName = askMedian ? MN : PQ
    result = askMedian ? med : b1
    xReveal = `The median is half the sum of the bases: ${f(eMN)} = ½((${f(ePQ)}) + ${b2}), and x = ${x}.`
  }
  traps.push({ id: 'geo_answered_x', stage: 'result', text: String(x), witness: ANSWERED_X_W(askName) })
  const pqText = ePQ ? f(ePQ) : String(b1)
  const srText = eSR ? f(eSR) : String(b2)
  const mnText = eMN ? f(eMN) : String(med)
  const prompt = `${name} is a trapezoid with bases ${PQ} and ${SR}. ${M} is the midpoint of leg ${S}${P} and ${N} is the midpoint of leg ${Q}${R}, so ${MN} is the median. ${PQ} = ${pqText}, ${SR} = ${srText}, and ${MN} = ${mnText}. Find x, then ${askName}.`
  // Bases across, PQ on the bottom; the drawing is to scale.
  const h = Math.max(b1, b2) * (0.35 + rng.next() * 0.25)
  const lean = (rng.next() - 0.5) * 0.5 * Math.abs(b1 - b2)
  const local = trapezoidAt(b1, b2, h, (b1 - b2) / 2 + lean)
  const corners = turn(local, tilt(rng, 6), rng.chance(0.5))
  if (!goodQuad(corners, 30)) return null
  const pM = mid(corners[3]!, corners[0]!)
  const pN = mid(corners[1]!, corners[2]!)
  const points = [...labeled(ids, corners, corners), ...labeled([M, N], [pM, pN], corners)]
  const segments: GeoSegment[] = [
    seg(P, Q, { label: pqText }),
    seg(Q, N, { ticks: 2 }),
    seg(N, R, { ticks: 2 }),
    seg(R, S, { label: srText }),
    seg(S, M, { ticks: 1 }),
    seg(M, P, { ticks: 1 }),
    seg(M, N, { label: mnText }),
  ]
  const aria = `Trapezoid ${name} with bases ${PQ} and ${SR}. ${M} is on leg ${S}${P} and ${N} is on leg ${Q}${R}; ${S}${M} and ${M}${P} have 1 tick each, and ${Q}${N} and ${N}${R} have 2 ticks each. Base ${PQ} is labeled ${pqText}, base ${SR} is labeled ${srText}, and segment ${MN} is labeled ${mnText}.`
  const figure = placeSegLabels({ ariaLabel: aria, points, segments }, ids)
  if (!figure) return null
  const own = askName === MN ? eMN : askName === PQ ? ePQ : eSR
  const resultReveal = own ? `${askName} = ${atX(own, x)}.` : `${askName} = ${result}.`
  const stages = [
    numberStage({
      id: 'x',
      label: 'x',
      hint: X_HINT5,
      answerText: String(x),
      nudge: 'The median of a trapezoid sits halfway between the bases. How does its length compare with theirs?',
      ruleCard: UNIT5_RULE_IDS.median,
      reveal: [xReveal],
      traps,
    }),
    numberStage({
      id: 'result',
      label: askName,
      hint: LEN_HINT5,
      answerText: String(result),
      nudge: 'Put your value of x into the expression for this segment.',
      ruleCard: UNIT5_RULE_IDS.median,
      reveal: [resultReveal],
      traps,
    }),
  ]
  const promise: ErrorPatternId[] = rng.chance(0.5) ? ['geo_median_not_halved', 'geo_median_as_base'] : ['geo_median_as_base', 'geo_median_not_halved']
  return trapFinish('midsegment', prompt, figure, stages, [b1, b2, med], [], 'Midsegments and medians', { case: kind, x, asked: askName }, promise)
}

// --- gz.isosceles: isosceles trapezoids and kites ----------------------------------------------------------

type IsoKind = 'baseAngles' | 'oppositeAngles' | 'diagonals' | 'kiteEnds' | 'kiteSides'
const ISO_KINDS: readonly IsoKind[] = ['baseAngles', 'oppositeAngles', 'diagonals', 'kiteEnds', 'kiteSides']

const BASE_SUPP_W = (a: string, b: string) =>
  `That x makes ∠${a} and ∠${b} add to 180°, as in a parallelogram. In an isosceles trapezoid the two angles at one base are congruent.`
const OPP_EQUAL_W = (a: string, b: string) =>
  `That x makes ∠${a} and ∠${b} equal, as opposite angles of a parallelogram would be. An isosceles trapezoid is not a parallelogram: ∠${b} is congruent to the angle beside it on the same base, and that angle and ∠${a} add to 180°.`
const BISECT_W = (a: string, b: string) =>
  `That x makes ${a} equal to ${b}, as if the diagonals bisected each other. That is a parallelogram rule. An isosceles trapezoid's diagonals are congruent, but they do not cut each other in half.`
const KITE_W = (a: string, b: string) =>
  `That x makes ∠${a} and ∠${b} equal, but those are the angles between the congruent sides. A kite's congruent angles are at the other two vertices, where unequal sides meet.`
const KITE_RESULT_W = (asked: string, given: string) =>
  `That is m∠${given}. Angles ${asked} and ${given} are the angles between congruent sides, and those two are usually different. The congruent angles are at the other two vertices.`

export function drawTrapezoidKite(seed: number): GeoBuilt {
  const kind = makeRng(mixSeed(seed, 5700)).pick(ISO_KINDS)
  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = makeRng(mixSeed(seed, 5701 + attempt))
    const built = kind === 'kiteEnds' || kind === 'kiteSides' ? kiteCase(rng, kind) : isoCase(rng, kind)
    if (built) return built
  }
  throw new Error(`gz.isosceles/${seed}: no ${kind} problem`)
}

/** An isosceles trapezoid PQRS with bases PQ (bottom) and SR, legs QR and SP. `beta` is the angle at P and at Q. */
function isoCorners(rng: Rng, beta: number): XY[] | null {
  // An acute base angle sits at the longer base.
  const long = rng.int(22, 30)
  const short = long * (0.35 + rng.next() * 0.3)
  const acute = beta < 90 ? beta : 180 - beta
  const h = ((long - short) / 2) * Math.tan((acute * Math.PI) / 180)
  const local = beta < 90 ? isoTrapezoidAt(long, short, h) : isoTrapezoidAt(short, long, h)
  const corners = turn(local, tilt(rng, 15), rng.chance(0.5))
  return goodQuad(corners, 28) ? corners : null
}

function isoCase(rng: Rng, kind: 'baseAngles' | 'oppositeAngles' | 'diagonals'): GeoBuilt | null {
  const ids = quadLetters(rng)
  const name = ids.join('')
  const [P, Q, R, S] = ids
  const x = rng.pick(X_POOL5)
  const beta = rng.int(48, 132)
  if (Math.abs(beta - 90) < 14 || reserved(beta) || reserved(180 - beta)) return null
  const corners = isoCorners(rng, beta)
  if (!corners) return null
  const tickLegs = [seg(Q, R, { ticks: 1 }), seg(S, P, { ticks: 1 })]
  const intro = `${name} is an isosceles trapezoid with bases ${P}${Q} and ${S}${R}.`
  const traps: TrapDraft[] = []
  if (kind === 'diagonals') {
    const [T] = extraLetters(rng, ids, 1) as [string]
    const T0 = crossing(corners[0]!, corners[2]!, corners[1]!, corners[3]!)
    if (!T0) return null
    // Whole diagonal PR, and the two pieces of QS: PR = QS = QT + TS.
    const scale = rng.int(18, 40)
    const ratio = Math.hypot(T0.x - corners[1]!.x, T0.y - corners[1]!.y) / Math.hypot(corners[3]!.x - corners[1]!.x, corners[3]!.y - corners[1]!.y)
    const qt = Math.round(scale * ratio)
    const ts = scale - qt
    if (qt <= 3 || ts <= 3 || qt === ts || [scale, qt, ts].some(reserved)) return null
    const [a1, a2, a3] = coeffs(rng, 3) as [number, number, number]
    if (a1 === a2 + a3) return null
    const ePR = fit(scale, x, a1)
    const eQT = fit(qt, x, a2)
    const eTS = fit(ts, x, a3)
    const s = solve(ePR, sum(eQT, eTS))
    if (!s || s.d !== 1 || s.n !== x) return null
    const slip = solve(eQT, eTS)
    if (wholePositive(slip) === null) return null
    traps.push({ id: 'geo_trapezoid_as_parallelogram', stage: 'x', text: typed(slip!), witness: BISECT_W(`${Q}${T}`, `${T}${S}`) })
    const askWhole = rng.chance(0.5)
    const askName = askWhole ? `${Q}${S}` : `${P}${R}`
    traps.push({ id: 'geo_answered_x', stage: 'result', text: String(x), witness: ANSWERED_X_W(askName) })
    const prompt = `${intro} Its diagonals meet at ${T}. ${P}${R} = ${f(ePR)}, ${Q}${T} = ${f(eQT)}, and ${T}${S} = ${f(eTS)}. Find x, then ${askName}.`
    const points = [...labeled(ids, corners, corners), ...labeled([T], [T0], corners, [T])]
    const figure: GeoFigureSpec = {
      ariaLabel: `Isosceles trapezoid ${name} with bases ${P}${Q} and ${S}${R}; legs ${Q}${R} and ${S}${P} have 1 tick each. Diagonals ${P}${R} and ${Q}${S} meet at ${T}. No lengths are marked on the figure.`,
      points,
      segments: [seg(P, Q), seg(R, S), ...tickLegs, seg(P, T), seg(T, R), seg(Q, T), seg(T, S)],
    }
    const stages = [
      numberStage({
        id: 'x',
        label: 'x',
        hint: X_HINT5,
        answerText: String(x),
        nudge: 'The diagonals of an isosceles trapezoid are congruent. Write the length of each diagonal from what is given.',
        ruleCard: UNIT5_RULE_IDS.isoTrapezoid,
        reveal: [`The diagonals are congruent, so ${P}${R} = ${Q}${T} + ${T}${S}: ${f(ePR)} = (${f(eQT)}) + (${f(eTS)}), and x = ${x}.`],
        traps,
      }),
      numberStage({
        id: 'result',
        label: askName,
        hint: LEN_HINT5,
        answerText: String(scale),
        nudge: 'Both diagonals have the same length. Use the expression you can evaluate.',
        ruleCard: UNIT5_RULE_IDS.isoTrapezoid,
        reveal: [askWhole ? `${Q}${S} = ${P}${R} = ${atX(ePR, x)}.` : `${P}${R} = ${atX(ePR, x)}.`],
        traps,
      }),
    ]
    return trapFinish('trapezoidKite', prompt, figure, stages, [scale, qt, ts], [beta, beta, 180 - beta, 180 - beta], 'Isosceles trapezoids and kites', { case: kind, x, asked: askName }, ['geo_trapezoid_as_parallelogram'])
  }
  const [a1, a2] = coeffs(rng, 2) as [number, number]
  // Base angles at P and Q measure beta; at R and S, 180 − beta.
  const first = rng.chance(0.5) ? P : Q
  const second = kind === 'baseAngles' ? (first === P ? Q : P) : first === P ? R : S
  const m2 = kind === 'baseAngles' ? beta : 180 - beta
  const e1 = fit(beta, x, a1)
  const e2 = fit(m2, x, a2)
  const s = kind === 'baseAngles' ? solve(e1, e2) : solve(sum(e1, e2), lin(0, 180))
  if (!s || s.d !== 1 || s.n !== x) return null
  const slip = kind === 'baseAngles' ? solve(sum(e1, e2), lin(0, 180)) : solve(e1, e2)
  if (wholePositive(slip) === null) return null
  traps.push(
    kind === 'baseAngles'
      ? { id: 'geo_trapezoid_as_parallelogram', stage: 'x', text: typed(slip!), witness: BASE_SUPP_W(first, second) }
      : { id: 'geo_trapezoid_as_parallelogram', stage: 'x', text: typed(slip!), witness: OPP_EQUAL_W(first, second) },
  )
  const others = [P, Q, R, S].filter((v) => v !== first && v !== second)
  const asked = rng.pick(others)
  const result = asked === P || asked === Q ? beta : 180 - beta
  traps.push({ id: 'geo_answered_x', stage: 'result', text: String(x), witness: ANSWERED_X_W(`m∠${asked}`) })
  const prompt = `In isosceles trapezoid ${name} with bases ${P}${Q} and ${S}${R}, m∠${first} = (${f(e1)})° and m∠${second} = (${f(e2)})°. Find x, then m∠${asked}.`
  const angleAt = (v: string, e: Lin): GeoAngleMark => {
    const i = ids.indexOf(v)
    return { vertex: v, from: vtx(ids, i + 1), to: vtx(ids, i - 1), label: angleLabel(e), radius: 20 }
  }
  const figure: GeoFigureSpec = {
    ariaLabel: `Isosceles trapezoid ${name} with bases ${P}${Q} and ${S}${R}; legs ${Q}${R} and ${S}${P} have 1 tick each. Angle ${first} is labeled (${f(e1)})° and angle ${second} is labeled (${f(e2)})°.`,
    points: labeled(ids, corners, corners),
    segments: [seg(P, Q), seg(R, S), ...tickLegs],
    angles: [angleAt(first, e1), angleAt(second, e2)],
  }
  const xReveal =
    kind === 'baseAngles'
      ? `Angles ${first} and ${second} are the base angles at base ${P}${Q}, so they are congruent: ${f(e1)} = ${f(e2)}, and x = ${x}.`
      : `Angle ${second} is congruent to the other angle at its base, and that angle and ∠${first} lie along one leg, so they add to 180°: (${f(e1)}) + (${f(e2)}) = 180, and x = ${x}.`
  const resultReveal =
    result === beta
      ? `Angle ${asked} is a base angle at base ${P}${Q}, so m∠${asked} = ${beta}.`
      : `Angle ${asked} is at base ${S}${R}, along a leg from the angle that measures ${beta}°, so m∠${asked} = 180 − ${beta} = ${result}.`
  const stages = [
    numberStage({
      id: 'x',
      label: 'x',
      hint: X_HINT5,
      answerText: String(x),
      nudge: 'Find where each labeled angle sits: at the same base, or at different bases?',
      ruleCard: UNIT5_RULE_IDS.isoTrapezoid,
      reveal: [xReveal],
      traps,
    }),
    numberStage({
      id: 'result',
      label: `m∠${asked}`,
      hint: DEG_HINT5,
      answerText: String(result),
      nudge: 'Angles at the same base are congruent; two angles along one leg add to 180°.',
      ruleCard: UNIT5_RULE_IDS.isoTrapezoid,
      reveal: [resultReveal],
      traps,
      deg: true,
    }),
  ]
  return trapFinish('trapezoidKite', prompt, figure, stages, [], [beta, beta, 180 - beta, 180 - beta], 'Isosceles trapezoids and kites', { case: kind, x, asked: `m∠${asked}` }, ['geo_trapezoid_as_parallelogram'])
}

/**
 * Kite PQRS with PQ ≅ PS and RQ ≅ RS: P and R are the ends of the axis, where congruent sides meet. The congruent
 * angles are at Q and S, where unequal sides meet.
 */
function kiteCase(rng: Rng, kind: 'kiteEnds' | 'kiteSides'): GeoBuilt | null {
  const ids = quadLetters(rng)
  const name = ids.join('')
  // The letters around the kite start at an axis end, either one.
  const [P, Q, R, S] = rng.chance(0.5) ? ids : ([ids[2], ids[3], ids[0], ids[1]] as Ids)
  const x = rng.pick(X_POOL5)
  const halfP = rng.int(20, 62)
  const halfR = rng.int(20, 62)
  if (Math.abs(halfP - halfR) < 8) return null
  const angP = 2 * halfP
  const angR = 2 * halfR
  const angQ = 180 - halfP - halfR
  if ([angP, angR, angQ].some((g) => g < 40 || g > 140) || Math.abs(angQ - 90) < 6) return null
  const w = 10
  const p = w / Math.tan((halfP * Math.PI) / 180)
  const axis = p + w / Math.tan((halfR * Math.PI) / 180)
  const local = kiteAt(axis, p, w)
  const order = [P, Q, R, S]
  const corners = turn(local, rng.int(0, 359), rng.chance(0.5))
  if (!goodQuad(corners, 28)) return null
  const traps: TrapDraft[] = []
  const angleAt = (v: string, label: string): GeoAngleMark => {
    const i = order.indexOf(v)
    return { vertex: v, from: order[(i + 1) % 4]!, to: order[(i + 3) % 4]!, label, radius: 20 }
  }
  const intro = `In kite ${name}, ${P}${Q} ≅ ${P}${S}, ${R}${Q} ≅ ${R}${S},`
  let prompt: string
  let angles: GeoAngleMark[]
  let askName: string
  let result: number
  let xReveal: string
  let resultReveal: string
  let ariaAngles: string
  if (kind === 'kiteEnds') {
    // P and R are expressions; ∠Q is given. ∠S ≅ ∠Q, so P + R = 360 − 2Q.
    const [a1, a2] = coeffs(rng, 2) as [number, number]
    const eP = fit(angP, x, a1)
    const eR = fit(angR, x, a2)
    const s = solve(sum(eP, eR), lin(0, 360 - 2 * angQ))
    if (!s || s.d !== 1 || s.n !== x) return null
    const slip = solve(eP, eR)
    if (wholePositive(slip) === null) return null
    traps.push({ id: 'geo_kite_angles_wrong_pair', stage: 'x', text: typed(slip!), witness: KITE_W(P, R) })
    const askP = rng.chance(0.5)
    askName = `m∠${askP ? P : R}`
    result = askP ? angP : angR
    traps.push({ id: 'geo_answered_x', stage: 'result', text: String(x), witness: ANSWERED_X_W(askName) })
    prompt = `${intro} m∠${P} = (${f(eP)})°, m∠${R} = (${f(eR)})°, and m∠${Q} = ${angQ}°. Find x, then ${askName}.`
    angles = [angleAt(P, angleLabel(eP)), angleAt(R, angleLabel(eR)), angleAt(Q, `${angQ}°`)]
    ariaAngles = `Angle ${P} is labeled (${f(eP)})°, angle ${R} is labeled (${f(eR)})°, and angle ${Q} is labeled ${angQ}°.`
    xReveal = `Angles ${S} and ${Q} are where unequal sides meet, so they are congruent, and m∠${P} + m∠${R} = 360 − 2(${angQ}): (${f(eP)}) + (${f(eR)}) = ${360 - 2 * angQ}, and x = ${x}.`
    resultReveal = `So ${askName} = ${atX(askP ? eP : eR, x)}.`
  } else {
    // Q and S are expressions (congruent); ∠P is given. Ask ∠R = 360 − P − 2Q.
    const [a1, a2] = coeffs(rng, 2) as [number, number]
    const eQ = fit(angQ, x, a1)
    const eS = fit(angQ, x, a2)
    const s = solve(eQ, eS)
    if (!s || s.d !== 1 || s.n !== x) return null
    askName = `m∠${R}`
    result = angR
    if (reserved(angP)) return null
    traps.push({ id: 'geo_kite_angles_wrong_pair', stage: 'result', text: String(angP), witness: KITE_RESULT_W(R, P) })
    traps.push({ id: 'geo_answered_x', stage: 'result', text: String(x), witness: ANSWERED_X_W(askName) })
    prompt = `${intro} m∠${Q} = (${f(eQ)})°, m∠${S} = (${f(eS)})°, and m∠${P} = ${angP}°. Find x, then ${askName}.`
    angles = [angleAt(Q, angleLabel(eQ)), angleAt(S, angleLabel(eS)), angleAt(P, `${angP}°`)]
    ariaAngles = `Angle ${Q} is labeled (${f(eQ)})°, angle ${S} is labeled (${f(eS)})°, and angle ${P} is labeled ${angP}°.`
    xReveal = `Angles ${Q} and ${S} are where unequal sides meet, so they are congruent: ${f(eQ)} = ${f(eS)}, and x = ${x}.`
    resultReveal = `Both m∠${Q} and m∠${S} equal ${angQ}, and the four angles add to 360°, so ${askName} = 360 − ${angP} − 2(${angQ}) = ${result}.`
  }
  if ([result].some(reserved)) return null
  const points = labeled(order, corners, corners)
  const figure: GeoFigureSpec = {
    ariaLabel: `Kite ${name}. ${P}${Q} and ${P}${S} have 1 tick each, and ${R}${Q} and ${R}${S} have 2 ticks each. ${ariaAngles}`,
    points,
    segments: [seg(P, Q, { ticks: 1 }), seg(Q, R, { ticks: 2 }), seg(R, S, { ticks: 2 }), seg(S, P, { ticks: 1 })],
    angles,
  }
  const stages = [
    numberStage({
      id: 'x',
      label: 'x',
      hint: X_HINT5,
      answerText: String(x),
      nudge: 'Which two angles of a kite are congruent? Look at where the congruent sides meet, and where they do not.',
      ruleCard: UNIT5_RULE_IDS.kite,
      reveal: [xReveal],
      traps,
    }),
    numberStage({
      id: 'result',
      label: askName,
      hint: DEG_HINT5,
      answerText: String(result),
      nudge: kind === 'kiteEnds' ? 'Put your value of x into the expression for this angle.' : 'The four angles of the kite add to 360°, and two of them are congruent.',
      ruleCard: UNIT5_RULE_IDS.kite,
      reveal: [resultReveal],
      traps,
      deg: true,
    }),
  ]
  return trapFinish('trapezoidKite', prompt, figure, stages, [], [angP, angQ, angR, angQ], 'Isosceles trapezoids and kites', { case: kind, x, asked: askName }, ['geo_kite_angles_wrong_pair'])
}

