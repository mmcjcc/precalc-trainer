/**
 * Honors geometry Unit 5, gq.props (Jurgensen 5-1): algebra with the properties of a parallelogram. Letters, the property
 * asked, which sides or angles carry the expressions, x, the coefficients, and the figure's turn all come
 * from the seed. A figure shows only what is given.
 *
 * No part's answer is 2, 4, 8, 17, 33, 40, 43, 45, 53, 86, 90, or 180 (see unit5Build.RESERVED_NUMBERS).
 */
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { GeometryAnswer } from '@/content/types'
import type { GeoAngleMark, GeoFigureSpec, GeoSegment } from '@/shared/types'
import type { GeoBuilt } from './build'
import { angleLabel, formatLin, lin, type Lin } from './expr'
import { DEG_HINT5, LEN_HINT5, X_HINT5, X_POOL5, atX, finish5, fit, numberStage, reserved, solve, sum, times, typed, wholePositive, type TrapDraft } from './unit5Build'
import { placeSegLabels, seg, sideName, sideOf, vtx, type Ids } from './unit5Figs'
import { extraLetters, goodQuad, labeled, parallelogramAt, parallelogramFromDiagonals, quadLetters, tilt, turn, type XY } from './unit5Geom'
import { PARALLELOGRAM_RULES, UNIT5_RULE_FOR, UNIT5_RULE_IDS } from './unit5Rules'

const NUMBER_INSTRUCTIONS = 'Find x, then the part the question asks for. The figure is there before you answer.'
const COEFFS = [1, 2, 3, 4, 5, 6] as const

function coeffs(rng: Rng, n: number): number[] {
  return rng.shuffle([...COEFFS]).slice(0, n)
}

function f(e: Lin): string {
  return formatLin(e)
}

/** The corners of a parallelogram in order, turned so that sides `level` (0 for PQ and RS, 1 for QR and SP) run across. */
function pgramCorners(rng: Rng, a: number, b: number, alpha: number, level: 0 | 1, spread: number): XY[] {
  const local = parallelogramAt(a, b, alpha)
  const lift = level === 1 ? -alpha : 0
  return turn(local, lift + tilt(rng, spread), rng.chance(0.5))
}

function quadSides(ids: Ids, extra: Partial<Record<number, Partial<GeoSegment>>> = {}): GeoSegment[] {
  return [0, 1, 2, 3].map((i) => {
    const [a, b] = sideOf(ids, i)
    return seg(a, b, extra[i] ?? {})
  })
}

function angleAt(ids: Ids, i: number, label: string): GeoAngleMark {
  return { vertex: vtx(ids, i), from: vtx(ids, i + 1), to: vtx(ids, i - 1), label, radius: 20 }
}

// --- gq.props: algebra with the properties ---------------------------------------------------------------

type PropsKind = 'sides' | 'oppAngles' | 'consAngles' | 'diagHalves' | 'diagWhole'
const PROPS_KINDS: readonly PropsKind[] = ['sides', 'oppAngles', 'consAngles', 'diagHalves', 'diagWhole']

const OPP_W = (a: string, b: string) =>
  `That x makes ∠${a} and ∠${b} add to 180°. They are opposite angles of the parallelogram, across from each other, so they are congruent.`
const CONS_W = (a: string, b: string) =>
  `That x makes ∠${a} and ∠${b} equal. They share a side, so they are consecutive angles of the parallelogram, and consecutive angles add to 180°.`
const CONS_RESULT_W = (asked: string, given: string) =>
  `That is m∠${given}. Angle ${asked} shares a side with angle ${given}, so the two are consecutive and add to 180°; they are not equal.`
const RHOMBUS_W = (a: string, b: string) =>
  `That x makes ${a} equal to ${b}. Those two sides meet at a vertex. In a parallelogram the sides across from each other are the congruent ones.`
const RHOMBUS_RESULT_W = (asked: string, across: string) =>
  `That length belongs to a side that meets ${asked} at a vertex. ${asked} is across from ${across}, and opposite sides are the congruent ones.`
const DIAG_CONG_W = (a: string, b: string) =>
  `That x makes ${a} equal to ${b}, a half of each diagonal. The diagonals bisect each other, so each one is cut into two equal halves, but the two diagonals need not be equal.`
const HALF_X_W = (half: string, whole: string) =>
  `That x makes ${half} equal to ${whole}. ${half} is only half of ${whole}: the diagonals bisect each other, so ${whole} is twice ${half}.`
const HALF_RESULT_W = (asked: string, half: string) =>
  `That is the length of ${half}, half of ${asked}. The diagonals bisect each other, so ${asked} is twice that half.`
const WHOLE_RESULT_W = (asked: string, whole: string) =>
  `That is the length of the whole diagonal ${whole}. ${asked} is one of its two equal halves.`
const ANSWERED_X_W = (asked: string) => `That is the value of x, not ${asked}. Use x to find the measure itself.`

export function drawPgramProps(seed: number): GeoBuilt {
  const kind = makeRng(mixSeed(seed, 5100)).pick(PROPS_KINDS)
  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = makeRng(mixSeed(seed, 5101 + attempt))
    const built =
      kind === 'sides'
        ? propsSides(rng)
        : kind === 'oppAngles'
          ? propsAngles(rng, 'opp')
          : kind === 'consAngles'
            ? propsAngles(rng, 'cons')
            : kind === 'diagHalves'
              ? propsDiagHalves(rng)
              : propsDiagWhole(rng)
    if (built) return built
  }
  throw new Error(`gq.props/${seed}: no ${kind} problem`)
}

function propsFinish(
  prompt: string,
  figure: GeoFigureSpec,
  stages: GeometryAnswer['stages'],
  lengths: number[],
  angles: number[],
  title: string,
  params: Record<string, string | number | boolean>,
  promise: GeometryAnswer['trap'][],
): GeoBuilt | null {
  return finish5({
    question: 'parallelogramProps',
    prompt,
    figure,
    stages,
    lengths,
    angles,
    title,
    instructions: NUMBER_INSTRUCTIONS,
    params,
    cards: PARALLELOGRAM_RULES,
    ruleFor: UNIT5_RULE_FOR,
    promise,
  })
}

function drawnSides(rng: Rng): [number, number] | null {
  const a = rng.int(9, 64)
  const b = rng.int(9, 64)
  const ratio = Math.max(a, b) / Math.min(a, b)
  if (ratio < 1.3 || ratio > 2.3) return null
  return [a, b]
}

/** Opposite sides are congruent. Two opposite sides and one side next to them are expressions in x. */
function propsSides(rng: Rng): GeoBuilt | null {
  const ids = quadLetters(rng)
  const name = ids.join('')
  const x = rng.pick(X_POOL5)
  const sides = drawnSides(rng)
  if (!sides) return null
  const [l1, l2] = sides
  if (reserved(l1) || reserved(l2)) return null
  const len = (i: number) => (i % 2 === 0 ? l1 : l2)
  const alpha = rng.chance(0.5) ? rng.int(56, 78) : rng.int(102, 124)
  const level = rng.chance(0.5) ? 0 : 1
  const opp = level === 0 ? [0, 2] : [1, 3]
  const others = level === 0 ? [1, 3] : [0, 2]
  const dis = rng.pick(others)
  const plain = others.find((i) => i !== dis)!
  const [a1, a2, a3] = coeffs(rng, 3) as [number, number, number]
  const e1 = fit(len(opp[0]!), x, a1)
  const e2 = fit(len(opp[1]!), x, a2)
  const e3 = fit(len(dis), x, a3)
  if (solve(e1, e2)?.n !== x || solve(e1, e2)?.d !== 1) return null
  const t1 = solve(e1, e3)
  const t2 = solve(e2, e3)
  if (wholePositive(t1) === null && wholePositive(t2) === null) return null
  const exprOf = new Map<number, Lin>([
    [opp[0]!, e1],
    [opp[1]!, e2],
    [dis, e3],
  ])
  const ask = rng.int(0, 3)
  const askName = sideName(ids, ask)
  const result = len(ask)
  const n1 = sideName(ids, opp[0]!)
  const n2 = sideName(ids, opp[1]!)
  const nd = sideName(ids, dis)
  const givens = [...exprOf.keys()].sort((p, q) => p - q).map((i) => `${sideName(ids, i)} = ${f(exprOf.get(i)!)}`)
  const prompt = `In parallelogram ${name}, ${givens[0]}, ${givens[1]}, and ${givens[2]}. Find x, then ${askName}.`
  const traps: TrapDraft[] = []
  if (t1) traps.push({ id: 'geo_parallelogram_as_rhombus', stage: 'x', text: typed(t1), witness: RHOMBUS_W(n1, nd) })
  if (t2) traps.push({ id: 'geo_parallelogram_as_rhombus', stage: 'x', text: typed(t2), witness: RHOMBUS_W(n2, nd) })
  if (ask === plain) traps.push({ id: 'geo_parallelogram_as_rhombus', stage: 'result', text: String(len(opp[0]!)), witness: RHOMBUS_RESULT_W(askName, nd) })
  traps.push({ id: 'geo_answered_x', stage: 'result', text: String(x), witness: ANSWERED_X_W(askName) })
  const own = exprOf.get(ask)
  const resultReveal =
    ask === plain
      ? `${askName} is opposite ${nd}, so ${askName} = ${nd} = ${atX(e3, x)}.`
      : `${askName} = ${atX(own!, x)}.`
  const stages = [
    numberStage({
      id: 'x',
      label: 'x',
      hint: X_HINT5,
      answerText: String(x),
      nudge: 'Find the two labeled sides that are across from each other. Opposite sides of a parallelogram are congruent.',
      ruleCard: UNIT5_RULE_IDS.pgramSides,
      reveal: [`${n1} and ${n2} are opposite sides, so they are congruent: ${f(e1)} = ${f(e2)}, and x = ${x}.`],
      traps,
    }),
    numberStage({
      id: 'result',
      label: askName,
      hint: LEN_HINT5,
      answerText: String(result),
      nudge: ask === plain ? 'This side has no expression of its own. Use the side across from it.' : 'Put your value of x into the expression for this side.',
      ruleCard: UNIT5_RULE_IDS.pgramSides,
      reveal: [resultReveal],
      traps,
    }),
  ]
  const corners = pgramCorners(rng, l1, l2, alpha, level as 0 | 1, 7)
  if (!goodQuad(corners)) return null
  const points = labeled(ids, corners, corners)
  const segs = quadSides(ids, Object.fromEntries([...exprOf.entries()].map(([i, e]) => [i, { label: f(e) }])))
  const aria = `Parallelogram ${name}. ${[...exprOf.keys()]
    .sort((p, q) => p - q)
    .map((i) => `Side ${sideName(ids, i)} is labeled ${f(exprOf.get(i)!)}.`)
    .join(' ')}`
  const figure = placeSegLabels({ ariaLabel: aria, points, segments: segs }, ids)
  if (!figure) return null
  return propsFinish(prompt, figure, stages, [l1, l2, l1, l2], [alpha, 180 - alpha, alpha, 180 - alpha], 'Parallelogram properties', { case: 'sides', x, asked: askName }, ['geo_parallelogram_as_rhombus'])
}

/** Opposite angles are congruent, or consecutive angles are supplementary. Two angles are expressions in x. */
function propsAngles(rng: Rng, which: 'opp' | 'cons'): GeoBuilt | null {
  const ids = quadLetters(rng)
  const name = ids.join('')
  const x = rng.pick(X_POOL5)
  const m = rng.int(38, 142)
  if (Math.abs(m - 90) < 12 || reserved(m) || reserved(180 - m)) return null
  const v = rng.int(0, 3)
  const w = which === 'opp' ? v + 2 : v + 1
  const mv = m
  const mw = which === 'opp' ? m : 180 - m
  const [a1, a2] = coeffs(rng, 2) as [number, number]
  const e1 = fit(mv, x, a1)
  const e2 = fit(mw, x, a2)
  const solved = which === 'opp' ? solve(e1, e2) : solve(sum(e1, e2), lin(0, 180))
  if (!solved || solved.d !== 1 || solved.n !== x) return null
  const slip = which === 'opp' ? solve(sum(e1, e2), lin(0, 180)) : solve(e1, e2)
  if (wholePositive(slip) === null) return null
  const V = vtx(ids, v)
  const W = vtx(ids, w)
  const askAt = rng.int(0, 3)
  const A = vtx(ids, askAt)
  // The measure at vertex k: m at v and v + 2, 180 − m at the other two.
  const at = (k: number) => ((((k - v) % 2) + 2) % 2 === 0 ? m : 180 - m)
  const result = at(askAt)
  const traps: TrapDraft[] = []
  if (which === 'opp') traps.push({ id: 'geo_opposite_angles_supplementary', stage: 'x', text: typed(slip!), witness: OPP_W(V, W) })
  else traps.push({ id: 'geo_consecutive_angles_equal', stage: 'x', text: typed(slip!), witness: CONS_W(V, W) })
  // Asked for an angle next to the two equal labeled angles: giving their measure sets consecutive angles equal.
  if (which === 'opp' && result !== m) traps.push({ id: 'geo_consecutive_angles_equal', stage: 'result', text: String(m), witness: CONS_RESULT_W(A, V) })
  traps.push({ id: 'geo_answered_x', stage: 'result', text: String(x), witness: ANSWERED_X_W(`m∠${A}`) })
  const prompt = `In parallelogram ${name}, m∠${V} = (${f(e1)})° and m∠${W} = (${f(e2)})°. Find x, then m∠${A}.`
  const xReveal =
    which === 'opp'
      ? `Angles ${V} and ${W} are opposite angles, so they are congruent: ${f(e1)} = ${f(e2)}, and x = ${x}.`
      : `Angles ${V} and ${W} are consecutive angles, so they are supplementary: (${f(e1)}) + (${f(e2)}) = 180, and x = ${x}.`
  const labeledHere = askAt === v || askAt === ((w % 4) + 4) % 4
  const resultReveal = labeledHere
    ? `Put x = ${x} into its own expression: m∠${A} = ${result}.`
    : result === m
      ? `Angle ${A} is opposite an angle that measures ${m}°, so m∠${A} = ${result}.`
      : `Angle ${A} shares a side with an angle that measures ${180 - result}°, so m∠${A} = 180 − ${180 - result} = ${result}.`
  const stages = [
    numberStage({
      id: 'x',
      label: 'x',
      hint: X_HINT5,
      answerText: String(x),
      nudge: 'Are the two labeled angles across from each other, or do they share a side? That decides the equation.',
      ruleCard: UNIT5_RULE_IDS.pgramAngles,
      reveal: [xReveal],
      traps,
    }),
    numberStage({
      id: 'result',
      label: `m∠${A}`,
      hint: DEG_HINT5,
      answerText: String(result),
      nudge: labeledHere ? 'Put your value of x into this angle’s expression.' : 'Find a labeled angle across from this one, or one that shares a side with it.',
      ruleCard: UNIT5_RULE_IDS.pgramAngles,
      reveal: [resultReveal],
      traps,
      deg: true,
    }),
  ]
  const sides = drawnSides(rng)
  if (!sides) return null
  const alpha = v % 2 === 0 ? m : 180 - m
  const corners = turn(parallelogramAt(sides[0], sides[1], alpha), tilt(rng, 30), rng.chance(0.5))
  if (!goodQuad(corners)) return null
  const points = labeled(ids, corners, corners)
  const figure: GeoFigureSpec = {
    ariaLabel: `Parallelogram ${name}. Angle ${V} is labeled (${f(e1)})° and angle ${W} is labeled (${f(e2)})°.`,
    points,
    segments: quadSides(ids),
    angles: [angleAt(ids, v, angleLabel(e1)), angleAt(ids, w, angleLabel(e2))],
  }
  return propsFinish(
    prompt,
    figure,
    stages,
    [sides[0], sides[1], sides[0], sides[1]],
    [0, 1, 2, 3].map((k) => at(k)),
    'Parallelogram properties',
    { case: which === 'opp' ? 'oppAngles' : 'consAngles', x, asked: `m∠${A}` },
    [which === 'opp' ? 'geo_opposite_angles_supplementary' : 'geo_consecutive_angles_equal'],
  )
}

interface DiagFigure {
  ids: Ids
  T: string
  figure: GeoFigureSpec
}

/** Diagonals PR and QS cross at T with halves h (on the diagonal from vertex `from`) and k (the other one). */
function diagFigure(rng: Rng, ids: Ids, T: string, from: 0 | 1, h: number, k: number): DiagFigure | null {
  const phi = rng.int(38, 142)
  if (Math.abs(phi - 90) < 14) return null
  const local = parallelogramFromDiagonals(from === 0 ? h : k, from === 0 ? k : h, phi)
  const corners = turn(local, tilt(rng, 25), rng.chance(0.5))
  if (!goodQuad(corners)) return null
  const mid = { x: (corners[0]!.x + corners[2]!.x) / 2, y: (corners[0]!.y + corners[2]!.y) / 2 }
  const points = [...labeled(ids, corners, corners), ...labeled([T], [mid], corners, [T])]
  const name = ids.join('')
  const figure: GeoFigureSpec = {
    ariaLabel: `Parallelogram ${name} with diagonals ${vtx(ids, 0)}${vtx(ids, 2)} and ${vtx(ids, 1)}${vtx(ids, 3)}, which meet at ${T}. No lengths are marked on the figure.`,
    points,
    segments: [...quadSides(ids), ...[0, 1, 2, 3].map((i) => seg(vtx(ids, i), T))],
  }
  return { ids, T, figure }
}

/** The diagonals bisect each other: the two halves of one diagonal are expressions in x, and a half of the other is a distractor. */
function propsDiagHalves(rng: Rng): GeoBuilt | null {
  const ids = quadLetters(rng)
  const [T] = extraLetters(rng, ids, 1) as [string]
  const x = rng.pick(X_POOL5)
  const h = rng.int(6, 40)
  const k = rng.int(6, 40)
  const ratio = Math.max(h, k) / Math.min(h, k)
  if (ratio < 1.3 || ratio > 2.6) return null
  if ([h, k, 2 * h, 2 * k].some(reserved)) return null
  const from = rng.chance(0.5) ? 0 : 1
  const A = vtx(ids, from)
  const C = vtx(ids, from + 2)
  const B = vtx(ids, from + 1)
  const D = vtx(ids, from + 3)
  const near = rng.chance(0.5) ? B : D
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
  const askKind = rng.pick(['whole', 'otherWhole', 'otherHalf'] as const)
  const otherHalf = near === B ? `${T}${D}` : `${T}${B}`
  const askName = askKind === 'whole' ? `${A}${C}` : askKind === 'otherWhole' ? `${B}${D}` : otherHalf
  const result = askKind === 'whole' ? 2 * h : askKind === 'otherWhole' ? 2 * k : k
  const traps: TrapDraft[] = []
  if (t1) traps.push({ id: 'geo_diagonals_assumed_congruent', stage: 'x', text: typed(t1), witness: DIAG_CONG_W(AT, NT) })
  if (t2) traps.push({ id: 'geo_diagonals_assumed_congruent', stage: 'x', text: typed(t2), witness: DIAG_CONG_W(TC, NT) })
  if (askKind === 'whole') traps.push({ id: 'geo_diagonal_half_as_whole', stage: 'result', text: String(h), witness: HALF_RESULT_W(askName, AT) })
  if (askKind === 'otherWhole') traps.push({ id: 'geo_diagonal_half_as_whole', stage: 'result', text: String(k), witness: HALF_RESULT_W(askName, NT) })
  traps.push({ id: 'geo_answered_x', stage: 'result', text: String(x), witness: ANSWERED_X_W(askName) })
  const prompt = `The diagonals of parallelogram ${ids.join('')} meet at ${T}. ${AT} = ${f(e1)}, ${TC} = ${f(e2)}, and ${NT} = ${f(e3)}. Find x, then ${askName}.`
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
      nudge: 'Which two given pieces are halves of the same diagonal? The diagonals of a parallelogram bisect each other.',
      ruleCard: UNIT5_RULE_IDS.pgramDiagonals,
      reveal: [`${AT} and ${TC} are the two halves of diagonal ${A}${C}, so ${f(e1)} = ${f(e2)}, and x = ${x}.`],
      traps,
    }),
    numberStage({
      id: 'result',
      label: askName,
      hint: LEN_HINT5,
      answerText: String(result),
      nudge: 'The crossing point is the midpoint of each diagonal. Use the given half that belongs to this segment.',
      ruleCard: UNIT5_RULE_IDS.pgramDiagonals,
      reveal: [resultReveal],
      traps,
    }),
  ]
  const drawn = diagFigure(rng, ids, T, from as 0 | 1, h, k)
  if (!drawn) return null
  return propsFinish(prompt, drawn.figure, stages, [h, k, 2 * h, 2 * k], [], 'Diagonals of a parallelogram', { case: 'diagHalves', x, asked: askName }, [
    'geo_diagonals_assumed_congruent',
    'geo_diagonal_half_as_whole',
  ])
}

/** The diagonals bisect each other: a half and the whole diagonal are expressions in x. */
function propsDiagWhole(rng: Rng): GeoBuilt | null {
  const ids = quadLetters(rng)
  const [T] = extraLetters(rng, ids, 1) as [string]
  const x = rng.pick(X_POOL5)
  const h = rng.int(6, 40)
  const k = rng.int(6, 40)
  const ratio = Math.max(h, k) / Math.min(h, k)
  if (ratio < 1.3 || ratio > 2.6) return null
  if ([h, 2 * h].some(reserved)) return null
  const from = rng.chance(0.5) ? 0 : 1
  const A = vtx(ids, from)
  const C = vtx(ids, from + 2)
  const [a1, a2] = coeffs(rng, 2) as [number, number]
  if (2 * a1 === a2) return null
  const e1 = fit(h, x, a1)
  const e2 = fit(2 * h, x, a2)
  const s = solve(times(2, e1), e2)
  if (!s || s.d !== 1 || s.n !== x) return null
  const slip = solve(e1, e2)
  if (wholePositive(slip) === null) return null
  const startAtA = rng.chance(0.5)
  const half = startAtA ? `${A}${T}` : `${C}${T}`
  const otherHalf = startAtA ? `${T}${C}` : `${T}${A}`
  const whole = `${A}${C}`
  const askKind = rng.pick(['otherHalf', 'whole'] as const)
  const askName = askKind === 'otherHalf' ? otherHalf : whole
  const result = askKind === 'otherHalf' ? h : 2 * h
  const traps: TrapDraft[] = [{ id: 'geo_diagonal_half_as_whole', stage: 'x', text: typed(slip!), witness: HALF_X_W(half, whole) }]
  if (askKind === 'otherHalf') traps.push({ id: 'geo_diagonal_half_as_whole', stage: 'result', text: String(2 * h), witness: WHOLE_RESULT_W(askName, whole) })
  traps.push({ id: 'geo_answered_x', stage: 'result', text: String(x), witness: ANSWERED_X_W(askName) })
  const prompt = `The diagonals of parallelogram ${ids.join('')} meet at ${T}. ${half} = ${f(e1)} and ${whole} = ${f(e2)}. Find x, then ${askName}.`
  const stages = [
    numberStage({
      id: 'x',
      label: 'x',
      hint: X_HINT5,
      answerText: String(x),
      nudge: 'One given piece is half of a diagonal, and the other is the whole diagonal. How many halves make the whole?',
      ruleCard: UNIT5_RULE_IDS.pgramDiagonals,
      reveal: [`The diagonals bisect each other, so ${whole} = 2 · ${half}: ${f(e2)} = 2(${f(e1)}), and x = ${x}.`],
      traps,
    }),
    numberStage({
      id: 'result',
      label: askName,
      hint: LEN_HINT5,
      answerText: String(result),
      nudge: askKind === 'otherHalf' ? 'The crossing point is the midpoint of the diagonal, so the two halves are equal.' : 'Put your value of x into the expression for the whole diagonal.',
      ruleCard: UNIT5_RULE_IDS.pgramDiagonals,
      reveal: [askKind === 'otherHalf' ? `${askName} = ${half} = ${h}.` : `${whole} = ${atX(e2, x)}.`],
      traps,
    }),
  ]
  const drawn = diagFigure(rng, ids, T, from as 0 | 1, h, k)
  if (!drawn) return null
  return propsFinish(prompt, drawn.figure, stages, [h, 2 * h], [], 'Diagonals of a parallelogram', { case: 'diagWhole', x, asked: askName }, ['geo_diagonal_half_as_whole'])
}

