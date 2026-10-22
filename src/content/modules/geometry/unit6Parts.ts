/**
 * Honors geometry Unit 6, module geoProportionalParts (Jurgensen 7-6): proportional lengths.
 *
 * gp.splitter: the Triangle Proportionality Theorem (a segment parallel to one side divides the other two sides
 * proportionally), its converse (is the segment parallel? decided from the lengths, on a figure not drawn to scale so
 * the picture never answers), and the special case of a parallel through a midpoint.
 * gp.bisector: the Triangle Angle-Bisector Theorem (the bisector divides the opposite side in the ratio of the other two
 * sides), and three parallel lines cutting two transversals proportionally.
 *
 * Every piece of a longer segment carries its number on a dimension line for that piece. The letters, the case, the
 * numbers, which piece carries x, and the turn of the figure all come from the seed.
 */
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { ErrorPatternId, GeoAngleMark, GeoFigureSpec, GeoLine, GeoPoint, GeoSegment } from '@/shared/types'
import type { GeoBuilt } from './build'
import { R, crossText, isWhole, konst, lin6, linShow, lprod, lsolve, positive, qShow, qText, ratDiv, ratMul, solveSteps, type LinQ, type Rational } from './unit6Alg'
import { LEN_HINT6, RESERVED6_NUMBERS, X_HINT6, X_POOL6, choiceStage6, finish6, numberStage6, placeLabels6, type Stage6, type TrapDraft6 } from './unit6Build'
import { along, bounds, gcd, pickLetters6, pointAt, rad, readable, turned, type XY } from './unit6Geom'
import { weighted } from './unit6Ratios'
import { PARTS_RULES, UNIT6_RULE_IDS } from './unit6Rules'

const NUMBER_INSTRUCTIONS = 'Find x, then the part the question asks for. The figure is there before you answer.'
const r3 = (n: number) => Math.round(n * 1000) / 1000

type Piece = 'AD' | 'DB' | 'AE' | 'EC'
const PIECES: readonly Piece[] = ['AD', 'DB', 'AE', 'EC']

/** "8x − 3", or "x"; "15(x + 4)" in a product. */
const show = (e: LinQ) => linShow(e)

function products(l1: LinQ, l2: LinQ, r1: LinQ, r2: LinQ): Rational | null {
  const left = lprod(l1, l2)
  const right = lprod(r1, r2)
  if (!left || !right) return null
  return lsolve(left, right)
}

/** "6(x + 4)", "9x", "8 · 15": a product as she would write it after cross-multiplying. */
function pshow(e: LinQ, f: LinQ): string {
  const isNum = (g: LinQ) => g.a.n === 0
  if (isNum(e) && isNum(f)) return `${qShow(e.b)} · ${qShow(f.b)}`
  const [num, other] = isNum(e) ? [e, f] : [f, e]
  if (!isNum(num)) return `(${show(e)})(${show(f)})`
  if (other.b.n === 0) return `${qShow(ratMul(num.b, other.a))}x`
  if (num.b.n === num.b.d) return show(other)
  return `${qShow(num.b)}(${show(other)})`
}

/** An expression a·x + b worth `value` at x (b may be 0 when a > 1). Null when it would be unreadable. */
function exprAt(rng: Rng, value: number, x: number, plain: boolean): LinQ | null {
  if (plain) return value === x ? lin6(1, 0) : null
  const a = rng.int(1, 5)
  const b = value - a * x
  if (a === 1 && b === 0) return null
  if (Math.abs(b) > 40) return null
  return lin6(a, b)
}

/**
 * Triangle ABC with A at the bottom and the sides AB and AC rising from it, each at least 16° from the vertical, so the
 * dimension lines of their pieces fall outside the triangle. Turned a little and sometimes flipped.
 */
function triangleUp(rng: Rng, angleA: number, ab: number, ac: number): [XY, XY, XY] {
  const room = Math.max(0, angleA / 2 - 16)
  const tilt = Math.max(-room, Math.min(room, rng.int(-14, 14)))
  const flip = rng.chance(0.5)
  const dirB = 90 + (flip ? -1 : 1) * (angleA / 2) + tilt
  const dirC = 90 - (flip ? -1 : 1) * (angleA / 2) + tilt
  const u = (d: number) => ({ x: Math.cos(rad(d)), y: Math.sin(rad(d)) })
  return [
    { x: 0, y: 0 },
    { x: u(dirB).x * ab, y: u(dirB).y * ab },
    { x: u(dirC).x * ac, y: u(dirC).y * ac },
  ]
}

/** The angle at A of a triangle with these sides (law of cosines), or null when it would be unreadable. */
function angleFromSides(ab: number, ac: number, bc: number): number | null {
  const c = (ab * ab + ac * ac - bc * bc) / (2 * ab * ac)
  if (!(c > -0.5 && c < 0.85)) return null
  return (Math.acos(c) * 180) / Math.PI
}

function sideLabel(p: XY, c: XY): GeoPoint['labelSide'] {
  const dx = p.x - c.x
  const dy = p.y - c.y
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ay >= ax * 1.3) return dy >= 0 ? 'above' : 'below'
  if (ax >= ay * 1.3) return dx >= 0 ? 'right' : 'left'
  return dx >= 0 ? (dy >= 0 ? 'above-right' : 'below-right') : dy >= 0 ? 'above-left' : 'below-left'
}

function triPoints(ids: [string, string, string, string, string], pts: [XY, XY, XY, XY, XY]): GeoPoint[] {
  const c = { x: (pts[0].x + pts[1].x + pts[2].x) / 3, y: (pts[0].y + pts[1].y + pts[2].y) / 3 }
  return ids.map((id, i) => pointAt(id, pts[i]!, sideLabel(pts[i]!, c)!))
}

function partsFinish(
  question: 'splitter' | 'angleBisector',
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
    question,
    prompt,
    figure,
    stages,
    lengths: lengths.filter((v) => Number.isInteger(v) && v > 0),
    angles: [],
    title,
    instructions: NUMBER_INSTRUCTIONS,
    params,
    cards: PARTS_RULES,
    promise,
  })
}

// =================================================================================================================
// gp.splitter
// =================================================================================================================

type SplitKind = 'splitter' | 'converse' | 'midpoint'

export function drawSplitter(seed: number): GeoBuilt {
  const kind = weighted<SplitKind>(makeRng(mixSeed(seed, 6500)), [
    ['splitter', 45],
    ['converse', 30],
    ['midpoint', 25],
  ])
  for (let attempt = 0; attempt < 500; attempt++) {
    const rng = makeRng(mixSeed(seed, 6501 + attempt))
    const built = kind === 'splitter' ? splitterCase(rng) : kind === 'converse' ? converseCase(rng, seed) : midpointCase(rng)
    if (built) return built
  }
  throw new Error(`gp.splitter/${seed}: no ${kind} problem`)
}

const RATIOS = [
  [1, 2], [2, 1], [2, 3], [3, 2], [3, 4], [4, 3], [2, 5], [5, 2], [3, 5], [5, 3], [4, 5], [5, 4], [1, 3], [3, 1],
] as const

/** DE ∥ BC: AD/DB = AE/EC, with one or two pieces in x. */
function splitterCase(rng: Rng): GeoBuilt | null {
  const [p, q] = rng.pick(RATIOS)
  const m = rng.int(1, 6)
  const n = rng.int(1, 6)
  if (m === n) return null
  const val: Record<Piece, number> = { AD: p * m, DB: q * m, AE: p * n, EC: q * n }
  if (Object.values(val).some((v) => v < 2 || v > 40)) return null
  const ab = val.AD + val.DB
  const ac = val.AE + val.EC
  if (Math.min(val.AD, val.DB) < 0.24 * ab || Math.min(val.AE, val.EC) < 0.24 * ac) return null
  // One piece in x, plainly or as an expression; or two pieces on the same side in x.
  const form = rng.pick(['plain', 'expression', 'expression', 'two'] as const)
  const x = rng.pick(X_POOL6)
  const exprs: Record<Piece, LinQ> = { AD: konst(val.AD), DB: konst(val.DB), AE: konst(val.AE), EC: konst(val.EC) }
  const xPiece = rng.pick(PIECES)
  let asked: Piece | null = null
  if (form === 'plain') {
    exprs[xPiece] = lin6(1, 0)
    if (RESERVED6_NUMBERS.has(val[xPiece])) return null
  } else {
    const e = exprAt(rng, val[xPiece], x, false)
    if (!e) return null
    exprs[xPiece] = e
    asked = xPiece
    if (form === 'two') {
      // The other piece on the same side is in x too.
      const partner: Piece = xPiece === 'AD' ? 'DB' : xPiece === 'DB' ? 'AD' : xPiece === 'AE' ? 'EC' : 'AE'
      const e2 = exprAt(rng, val[partner], x, false)
      if (!e2 || (e2.a.n === e.a.n && e2.b.n === e.b.n)) return null
      exprs[partner] = e2
      asked = rng.pick([xPiece, partner])
    }
  }
  const xValue = form === 'plain' ? val[xPiece] : x
  if (RESERVED6_NUMBERS.has(xValue)) return null
  const right = products(exprs.AD, exprs.EC, exprs.DB, exprs.AE)
  if (!right || !isWhole(right) || right.n !== xValue) return null
  const [A, B, C, D, E] = pickLetters6(rng, 5) as [string, string, string, string, string]
  const name: Record<Piece | 'AB' | 'AC' | 'DE' | 'BC', string> = { AD: `${A}${D}`, DB: `${D}${B}`, AE: `${A}${E}`, EC: `${E}${C}`, AB: `${A}${B}`, AC: `${A}${C}`, DE: `${D}${E}`, BC: `${B}${C}` }
  const traps: TrapDraft6[] = []
  // A piece over a piece on one side, a piece over the whole side on the other.
  const AB = lin6(ratAddQ(exprs.AD.a, exprs.DB.a), ratAddQ(exprs.AD.b, exprs.DB.b))
  const AC = lin6(ratAddQ(exprs.AE.a, exprs.EC.a), ratAddQ(exprs.AE.b, exprs.EC.b))
  const mixed1 = products(exprs.AD, AC, exprs.DB, exprs.AE)
  if (positive(mixed1)) traps.push({ id: 'geo_part_over_whole', stage: 'x', text: qText(mixed1), witness: `That x makes ${name.AD}/${name.DB} equal ${name.AE}/${name.AC}: a piece over a piece on one side, and a piece over the whole side on the other. Compare the same kind of pieces on both sides.` })
  const mixed2 = products(exprs.AD, exprs.EC, AB, exprs.AE)
  if (positive(mixed2)) traps.push({ id: 'geo_part_over_whole', stage: 'x', text: qText(mixed2), witness: `That x makes ${name.AD}/${name.AB} equal ${name.AE}/${name.EC}: a piece over the whole side on one side, and a piece over a piece on the other. Compare the same kind of pieces on both sides.` })
  const cross = products(exprs.AD, exprs.DB, exprs.AE, exprs.EC)
  if (positive(cross)) traps.push({ id: 'geo_cross_multiplied_wrong', stage: 'x', text: qText(cross), witness: `That x makes ${name.AD} · ${name.DB} equal ${name.AE} · ${name.EC}: each ratio’s own top times its own bottom. Cross-multiplying pairs each numerator with the other denominator.` })
  const flip = products(exprs.AD, exprs.AE, exprs.DB, exprs.EC)
  if (positive(flip)) traps.push({ id: 'geo_one_ratio_inverted', stage: 'x', text: qText(flip), witness: `That x makes ${name.AD}/${name.DB} equal ${name.EC}/${name.AE}: the second ratio is turned over. The piece next to ${A} goes on top on both sides.` })
  const label = (pc: Piece) => show(exprs[pc])
  const prompt = `In triangle ${A}${B}${C}, ${D} is on ${name.AB}, ${E} is on ${name.AC}, and ${name.DE} ∥ ${name.BC}. ${name.AD} = ${label('AD')}, ${name.DB} = ${label('DB')}, ${name.AE} = ${label('AE')}, and ${name.EC} = ${label('EC')}. Find x${asked ? `, then ${name[asked]}` : ''}.`
  const shown = `${pshow(exprs.AD, exprs.EC)} = ${pshow(exprs.DB, exprs.AE)}`
  const stages: Stage6[] = [
    numberStage6({
      id: 'x',
      label: 'x',
      hint: X_HINT6,
      answerText: String(xValue),
      nudge: `The parallel segment divides the two sides proportionally: a piece over the other piece on ${name.AB} equals the matching piece over the other piece on ${name.AC}.`,
      ruleCard: UNIT6_RULE_IDS.splitter,
      reveal: [`By the Triangle Proportionality Theorem, ${name.AD}/${name.DB} = ${name.AE}/${name.EC}. ${crossText(shown, lprod(exprs.AD, exprs.EC)!, lprod(exprs.DB, exprs.AE)!)}`],
      traps,
    }),
  ]
  if (asked) {
    stages.push(
      numberStage6({
        id: 'result',
        label: name[asked],
        hint: LEN_HINT6,
        answerText: String(val[asked]),
        nudge: `Put your value of x into the expression for ${name[asked]}.`,
        ruleCard: UNIT6_RULE_IDS.substitute,
        reveal: [`${name[asked]} = ${atX(exprs[asked], x)}.`],
        traps: [{ id: 'geo_answered_x', stage: 'result', text: String(x), witness: `That is the value of x, not ${name[asked]}. Put x back into the expression for ${name[asked]}.` }],
      }),
    )
  }
  const angleA = rng.int(40, 76)
  const tri = triangleUp(rng, angleA, ab, ac)
  if (!readable(tri, 30, 0.4)) return null
  const pD = along(tri[0], tri[1], val.AD / ab)
  const pE = along(tri[0], tri[2], val.AE / ac)
  const figure = splitterFigure([A, B, C, D, E], [tri[0], tri[1], tri[2], pD, pE], { AD: label('AD'), DB: label('DB'), AE: label('AE'), EC: label('EC') }, null)
  const aria = `Triangle ${A}${B}${C} with ${D} on ${name.AB} and ${E} on ${name.AC}, and segment ${name.DE}. ${name.AD} is labeled ${label('AD')}, ${name.DB} is labeled ${label('DB')}, ${name.AE} is labeled ${label('AE')}, and ${name.EC} is labeled ${label('EC')}.`
  return partsFinish(
    'splitter',
    prompt,
    figure ? { ...figure, ariaLabel: aria } : null,
    stages,
    [val.AD, val.DB, val.AE, val.EC],
    { case: 'splitter', form, x: xValue, piece: xPiece },
    rng.pick<ErrorPatternId[]>([['geo_part_over_whole'], ['geo_part_over_whole', 'geo_one_ratio_inverted'], ['geo_cross_multiplied_wrong', 'geo_part_over_whole']]),
    'Triangle Proportionality Theorem',
  )
}

const ratAddQ = (a: Rational, b: Rational): Rational => ratDiv(R(a.n * b.d + b.n * a.d), R(a.d * b.d))

/** "3(8) − 5 = 19" for a whole x. */
function atX(e: LinQ, x: number): string {
  const a = e.a.n / e.a.d
  const b = e.b.n / e.b.d
  const head = a === 1 ? `${x}` : `${a}(${x})`
  const value = a * x + b
  if (b === 0) return `${head} = ${value}`
  return `${head} ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${value}`
}

/**
 * The splitter figure: triangle ABC, D on AB, E on AC, segment DE, the four pieces on dimension lines (or, for a
 * midpoint, tick marks on AD and DB). `extra` adds labels on DE and BC.
 */
function splitterFigure(
  ids: [string, string, string, string, string],
  pts: [XY, XY, XY, XY, XY],
  labels: Partial<Record<Piece, string>>,
  extra: { DE?: string; BC?: string; ticks?: boolean } | null,
): GeoFigureSpec | null {
  const [A, B, C, D, E] = ids
  const segments: GeoSegment[] = []
  const parts: number[] = []
  const add = (from: string, to: string, label?: string, part = false, ticks?: 1 | 2) => {
    if (part && label) parts.push(segments.length)
    segments.push({ from, to, ...(label ? { label } : {}), ...(ticks ? { ticks } : {}) })
  }
  add(A, D, labels.AD, true, extra?.ticks ? 1 : undefined)
  add(D, B, labels.DB, true, extra?.ticks ? 1 : undefined)
  add(A, E, labels.AE, true)
  add(E, C, labels.EC, true)
  add(B, C, extra?.BC)
  add(D, E, extra?.DE)
  const spec: GeoFigureSpec = { points: triPoints(ids, pts), segments, ariaLabel: '' }
  return placeLabels6(spec, [[A, B, C]], new Set(parts))
}

/** Is DE ∥ BC? Decided from the four lengths; the figure is not drawn to scale. */
function converseCase(rng: Rng, seed: number): GeoBuilt | null {
  const yes = rng.chance(0.5)
  let val: Record<Piece, number>
  let witnessYes = ''
  let witnessNo = ''
  if (yes) {
    const [p, q] = rng.pick(RATIOS)
    const m = rng.int(2, 6)
    const n = rng.int(2, 6)
    if (m === n) return null
    val = { AD: p * m, DB: q * m, AE: p * n, EC: q * n }
  } else {
    // Not parallel, with numbers where comparing a piece with a whole side would say parallel.
    const [p, q] = rng.pick(RATIOS)
    const m = rng.int(2, 6)
    const n = rng.int(2, 6)
    if (rng.chance(0.5)) {
      // AD/DB = AE/AC: AE = p·n, AC = q·n, so EC = (q − p)·n.
      if (q <= p) return null
      val = { AD: p * m, DB: q * m, AE: p * n, EC: (q - p) * n }
    } else {
      // AD/AB = AE/EC: AD = p·m, AB = q·m, so DB = (q − p)·m, with AE = p·n, EC = q·n.
      if (q <= p) return null
      val = { AD: p * m, DB: (q - p) * m, AE: p * n, EC: q * n }
    }
    if (val.AD * val.EC === val.DB * val.AE) return null
  }
  if (Object.values(val).some((v) => v < 2 || v > 40)) return null
  const [A, B, C, D, E] = pickLetters6(rng, 5) as [string, string, string, string, string]
  const name = { AD: `${A}${D}`, DB: `${D}${B}`, AE: `${A}${E}`, EC: `${E}${C}`, AB: `${A}${B}`, AC: `${A}${C}`, DE: `${D}${E}`, BC: `${B}${C}` }
  const r1 = ratDiv(R(val.AD), R(val.DB))
  const r2 = ratDiv(R(val.AE), R(val.EC))
  const work = (top: number, bottom: number, value: Rational) => (qText(value) === `${top}/${bottom}` ? `${top}/${bottom}` : `${top}/${bottom} = ${qText(value)}`)
  witnessYes = `That compares ${name.AD}/${name.DB}, a piece over a piece, with ${name.AE}/${name.AC}, a piece over the whole side. Compare a piece over the other piece on both sides.`
  witnessNo = `That compares a piece over a piece on one side with a piece over the whole side on the other. Compare ${name.AD}/${name.DB} with ${name.AE}/${name.EC}, the same kind of ratio on both sides.`
  const stage = choiceStage6({
    id: 'a',
    label: 'Parallel?',
    choices: [
      { id: 'yes', text: 'Yes', ...(yes ? {} : { trap: 'geo_part_over_whole' as const, witness: witnessNo }) },
      { id: 'no', text: 'No', ...(yes ? { trap: 'geo_part_over_whole' as const, witness: witnessYes } : {}) },
    ],
    answerId: yes ? 'yes' : 'no',
    nudge: `Compare ${name.AD}/${name.DB} with ${name.AE}/${name.EC}: a piece over the other piece on each side.`,
    ruleCard: UNIT6_RULE_IDS.converse,
    reveal: [
      yes
        ? `${name.AD}/${name.DB} = ${work(val.AD, val.DB, r1)} and ${name.AE}/${name.EC} = ${work(val.AE, val.EC, r2)}. The ratios are equal, so ${name.DE} ∥ ${name.BC} by the converse of the Triangle Proportionality Theorem.`
        : `${name.AD}/${name.DB} = ${work(val.AD, val.DB, r1)} and ${name.AE}/${name.EC} = ${work(val.AE, val.EC, r2)}. The ratios are not equal, so ${name.DE} is not parallel to ${name.BC}.`,
    ],
    seed,
    salt: 6510,
    keepOrder: true,
  })
  // Not drawn to scale: D and E sit at fractions chosen apart from the answer, so the picture never decides it.
  const ab = 10
  const ac = 10 * (0.8 + rng.next() * 0.4)
  const angleA = rng.int(40, 72)
  const tri = triangleUp(rng, angleA, ab, ac)
  if (!readable(tri, 30, 0.4)) return null
  const tD = 0.38 + rng.next() * 0.22
  const looksParallel = rng.chance(0.5)
  const tE = looksParallel ? tD : tD + (rng.chance(0.5) ? 1 : -1) * (0.1 + rng.next() * 0.05)
  const pD = along(tri[0], tri[1], tD)
  const pE = along(tri[0], tri[2], tE)
  const figure = splitterFigure([A, B, C, D, E], [tri[0], tri[1], tri[2], pD, pE], { AD: String(val.AD), DB: String(val.DB), AE: String(val.AE), EC: String(val.EC) }, null)
  const prompt = `In triangle ${A}${B}${C}, ${D} is on ${name.AB} and ${E} is on ${name.AC}, with ${name.AD} = ${val.AD}, ${name.DB} = ${val.DB}, ${name.AE} = ${val.AE}, and ${name.EC} = ${val.EC}. The figure is not drawn to scale. Is ${name.DE} parallel to ${name.BC}?`
  const aria = `Triangle ${A}${B}${C} with ${D} on ${name.AB} and ${E} on ${name.AC}, and segment ${name.DE}, not drawn to scale. ${name.AD} is labeled ${val.AD}, ${name.DB} is labeled ${val.DB}, ${name.AE} is labeled ${val.AE}, and ${name.EC} is labeled ${val.EC}.`
  if (!figure) return null
  return finish6({
    question: 'splitter',
    prompt,
    figure: { ...figure, ariaLabel: aria },
    stages: [stage],
    lengths: [],
    angles: [],
    title: 'Is the segment parallel?',
    instructions: 'Decide from the lengths. The figure is not drawn to scale.',
    params: { case: 'converse', answer: yes ? 'yes' : 'no', looksParallel, toScale: false },
    cards: PARTS_RULES,
    promise: ['geo_part_over_whole'],
  })
}

/** D is the midpoint of AB and DE ∥ BC: E is the midpoint of AC, and DE is half of BC. */
function midpointCase(rng: Rng): GeoBuilt | null {
  const form = rng.pick(['halves', 'segment'] as const)
  const x = rng.pick(X_POOL6)
  const [A, B, C, D, E] = pickLetters6(rng, 5) as [string, string, string, string, string]
  const name = { AD: `${A}${D}`, DB: `${D}${B}`, AE: `${A}${E}`, EC: `${E}${C}`, AB: `${A}${B}`, AC: `${A}${C}`, DE: `${D}${E}`, BC: `${B}${C}` }
  const angleA = rng.int(40, 76)
  let ab: number
  let ac: number
  const traps: TrapDraft6[] = []
  let stages: Stage6[]
  let prompt: string
  let aria: string
  let labels: Partial<Record<Piece, string>>
  let extra: { DE?: string; BC?: string; ticks: boolean }
  let lengths: number[]
  if (form === 'halves') {
    // AE and EC in x: E is the midpoint, so they are equal.
    const half = rng.int(6, 30)
    const [a1, a2] = rng.shuffle([1, 2, 3, 4, 5]).slice(0, 2) as [number, number]
    const e1 = lin6(a1, half - a1 * x)
    const e2 = lin6(a2, half - a2 * x)
    if (Math.abs(half - a1 * x) > 40 || Math.abs(half - a2 * x) > 40) return null
    const solved = lsolve(e1, e2)
    if (!solved || !isWhole(solved) || solved.n !== x) return null
    const askWhole = rng.chance(0.5)
    const asked = askWhole ? name.AC : name.AE
    const value = askWhole ? 2 * half : half
    // AD/AB = AE/EC: a half on one side, the two pieces on the other.
    const slip = lsolve(lmul2(e1), e2)
    if (positive(slip)) traps.push({ id: 'geo_part_over_whole', stage: 'x', text: qText(slip), witness: `That x makes ${name.EC} twice ${name.AE}: it compares ${name.AD} with the whole side ${name.AB} on one side, and two pieces of ${name.AC} on the other.` })
    const resultTraps: TrapDraft6[] = [{ id: 'geo_answered_x', stage: 'result', text: String(x), witness: `That is the value of x, not ${asked}.` }]
    if (askWhole) resultTraps.push({ id: 'geo_half_for_whole', stage: 'result', text: String(half), witness: `That is ${name.AE}, one of the two halves of ${name.AC}. The whole side is twice that.` })
    stages = [
      numberStage6({
        id: 'x',
        label: 'x',
        hint: X_HINT6,
        answerText: String(x),
        nudge: `A line through the midpoint of ${name.AB}, parallel to ${name.BC}, cuts ${name.AC} at its midpoint. What does that say about ${name.AE} and ${name.EC}?`,
        ruleCard: UNIT6_RULE_IDS.midpoint,
        reveal: [`${name.DE} ∥ ${name.BC} through the midpoint ${D}, so ${E} is the midpoint of ${name.AC} and ${name.AE} = ${name.EC}: ${solveSteps(e1, e2)}.`],
        traps,
      }),
      numberStage6({
        id: 'result',
        label: asked,
        hint: LEN_HINT6,
        answerText: String(value),
        nudge: askWhole ? `${name.AC} is made of the two equal pieces ${name.AE} and ${name.EC}.` : `Put your value of x into the expression for ${name.AE}.`,
        ruleCard: askWhole ? UNIT6_RULE_IDS.midpoint : UNIT6_RULE_IDS.substitute,
        reveal: [askWhole ? `${name.AE} = ${atX(e1, x)}, so ${name.AC} = 2 · ${half} = ${value}.` : `${name.AE} = ${atX(e1, x)}.`],
        traps: resultTraps,
      }),
    ]
    ab = rng.int(14, 24)
    ac = 2 * half
    if (ac / ab < 0.6 || ac / ab > 1.6) {
      ab = Math.round(ac * (0.75 + rng.next() * 0.5))
    }
    labels = { AE: show(e1), EC: show(e2) }
    extra = { ticks: true }
    prompt = `In triangle ${A}${B}${C}, ${D} is the midpoint of ${name.AB}, ${E} is on ${name.AC}, and ${name.DE} ∥ ${name.BC}. ${name.AE} = ${show(e1)} and ${name.EC} = ${show(e2)}. Find x, then ${asked}.`
    aria = `Triangle ${A}${B}${C} with ${D} on ${name.AB} and ${E} on ${name.AC}, and segment ${name.DE}. ${name.AD} and ${name.DB} have one tick each. ${name.AE} is labeled ${show(e1)} and ${name.EC} is labeled ${show(e2)}.`
    lengths = [half, 2 * half]
  } else {
    // DE and BC in x: DE joins the midpoints, so BC = 2 · DE.
    const mid = rng.int(5, 24)
    const [a1, a2] = rng.shuffle([1, 2, 3, 4, 5, 6]).slice(0, 2) as [number, number]
    if (a2 === 2 * a1 || a1 === 2 * a2) return null
    const eDE = lin6(a1, mid - a1 * x)
    const eBC = lin6(a2, 2 * mid - a2 * x)
    if (Math.abs(mid - a1 * x) > 40 || Math.abs(2 * mid - a2 * x) > 40) return null
    const solved = lsolve(lmul2(eDE), eBC)
    if (!solved || !isWhole(solved) || solved.n !== x) return null
    const askMid = rng.chance(0.5)
    const asked = askMid ? name.DE : name.BC
    const value = askMid ? mid : 2 * mid
    const slip = lsolve(eDE, lmul2(eBC))
    if (positive(slip)) traps.push({ id: 'geo_midsegment_doubled', stage: 'x', text: qText(slip), witness: `That x makes ${name.DE} twice ${name.BC}. It is the other way around: ${name.DE} joins two midpoints, so it is half of ${name.BC}.` })
    const resultTraps: TrapDraft6[] = [{ id: 'geo_answered_x', stage: 'result', text: String(x), witness: `That is the value of x, not ${asked}.` }]
    if (askMid) resultTraps.push({ id: 'geo_midsegment_doubled', stage: 'result', text: String(2 * mid), witness: `That is the length of ${name.BC}. ${name.DE} joins two midpoints, so it is half of ${name.BC}.` })
    stages = [
      numberStage6({
        id: 'x',
        label: 'x',
        hint: X_HINT6,
        answerText: String(x),
        nudge: `${E} is the midpoint of ${name.AC}, so ${name.DE} joins two midpoints. How do ${name.DE} and ${name.BC} compare?`,
        ruleCard: UNIT6_RULE_IDS.midpoint,
        reveal: [`${E} is the midpoint of ${name.AC}, so ${name.DE} = ½ · ${name.BC}: ${show(eBC)} = 2(${show(eDE)}), and x = ${x}.`],
        traps,
      }),
      numberStage6({
        id: 'result',
        label: asked,
        hint: LEN_HINT6,
        answerText: String(value),
        nudge: `Put your value of x into the expression for ${asked}.`,
        ruleCard: UNIT6_RULE_IDS.substitute,
        reveal: [`${asked} = ${atX(askMid ? eDE : eBC, x)}.`],
        traps: resultTraps,
      }),
    ]
    const bc = 2 * mid
    ab = Math.round(bc * (0.9 + rng.next() * 0.5))
    ac = Math.round(bc * (0.9 + rng.next() * 0.5))
    labels = {}
    extra = { DE: show(eDE), BC: show(eBC), ticks: true }
    prompt = `In triangle ${A}${B}${C}, ${D} is the midpoint of ${name.AB}, ${E} is on ${name.AC}, and ${name.DE} ∥ ${name.BC}. ${name.DE} = ${show(eDE)} and ${name.BC} = ${show(eBC)}. Find x, then ${asked}.`
    aria = `Triangle ${A}${B}${C} with ${D} on ${name.AB} and ${E} on ${name.AC}, and segment ${name.DE}. ${name.AD} and ${name.DB} have one tick each. ${name.DE} is labeled ${show(eDE)} and ${name.BC} is labeled ${show(eBC)}.`
    lengths = [mid, 2 * mid]
    // The triangle is drawn with BC at its length.
    const angle = angleFromSides(ab, ac, bc)
    if (angle === null) return null
    const tri = triangleUp(rng, angle, ab, ac)
    if (!readable(tri, 30, 0.4)) return null
    const pD = along(tri[0], tri[1], 0.5)
    const pE = along(tri[0], tri[2], 0.5)
    const figure = splitterFigure([A, B, C, D, E], [tri[0], tri[1], tri[2], pD, pE], labels, extra)
    return partsFinish('splitter', prompt, figure ? { ...figure, ariaLabel: aria } : null, stages, lengths, { case: 'midpoint', form, x }, ['geo_midsegment_doubled'], 'A parallel through a midpoint')
  }
  const tri = triangleUp(rng, angleA, ab, ac)
  if (!readable(tri, 30, 0.4)) return null
  const pD = along(tri[0], tri[1], 0.5)
  const pE = along(tri[0], tri[2], 0.5)
  const figure = splitterFigure([A, B, C, D, E], [tri[0], tri[1], tri[2], pD, pE], labels, extra)
  return partsFinish('splitter', prompt, figure ? { ...figure, ariaLabel: aria } : null, stages, lengths, { case: 'midpoint', form, x }, ['geo_part_over_whole', 'geo_half_for_whole'], 'A parallel through a midpoint')
}

const lmul2 = (e: LinQ): LinQ => ({ a: ratMul(R(2), e.a), b: ratMul(R(2), e.b) })

// =================================================================================================================
// gp.bisector
// =================================================================================================================

type BisectKind = 'bisector' | 'parallels'

export function drawBisectorParts(seed: number): GeoBuilt {
  const kind = weighted<BisectKind>(makeRng(mixSeed(seed, 6600)), [
    ['bisector', 60],
    ['parallels', 40],
  ])
  for (let attempt = 0; attempt < 500; attempt++) {
    const rng = makeRng(mixSeed(seed, 6601 + attempt))
    const built = kind === 'bisector' ? bisectorCase(rng) : parallelsCase(rng)
    if (built) return built
  }
  throw new Error(`gp.bisector/${seed}: no ${kind} problem`)
}

type BPiece = 'AB' | 'AC' | 'BD' | 'DC'

/** AD bisects angle BAC: BD/DC = AB/AC. */
function bisectorCase(rng: Rng): GeoBuilt | null {
  // AB = g·c', AC = g·b' (c', b' coprime), BC = m·(b' + c'), so BD = m·c' and DC = m·b'.
  const [c1, b1] = rng.pick([
    [2, 3], [3, 2], [3, 4], [4, 3], [2, 5], [5, 2], [3, 5], [5, 3], [4, 5], [5, 4], [5, 6], [6, 5], [4, 7], [7, 4], [5, 7], [7, 5],
  ] as const)
  if (gcd(c1, b1) !== 1) return null
  const g = rng.int(2, 8)
  const m = rng.int(1, g - 1)
  const val: Record<BPiece, number> = { AB: g * c1, AC: g * b1, BD: m * c1, DC: m * b1 }
  const bc = val.BD + val.DC
  if (Object.values(val).some((v) => v < 2 || v > 45)) return null
  const angleA = angleFromSides(val.AB, val.AC, bc)
  if (angleA === null || angleA < 40 || angleA > 115) return null
  const form = rng.pick(['plain', 'expression', 'expression'] as const)
  const x = rng.pick(X_POOL6)
  const exprs: Record<BPiece, LinQ> = { AB: konst(val.AB), AC: konst(val.AC), BD: konst(val.BD), DC: konst(val.DC) }
  const xPiece = rng.pick(['AB', 'AC', 'BD', 'DC'] as const)
  let asked: BPiece | null = null
  if (form === 'plain') exprs[xPiece] = lin6(1, 0)
  else {
    const e = exprAt(rng, val[xPiece], x, false)
    if (!e) return null
    exprs[xPiece] = e
    asked = xPiece
  }
  const xValue = form === 'plain' ? val[xPiece] : x
  if (RESERVED6_NUMBERS.has(xValue)) return null
  // Right: BD/DC = AB/AC, so BD·AC = DC·AB.
  const right = products(exprs.BD, exprs.AC, exprs.DC, exprs.AB)
  if (!right || !isWhole(right) || right.n !== xValue) return null
  const [A, B, C, D] = pickLetters6(rng, 4) as [string, string, string, string]
  const name: Record<BPiece | 'BC' | 'AD', string> = { AB: `${A}${B}`, AC: `${A}${C}`, BD: `${B}${D}`, DC: `${D}${C}`, BC: `${B}${C}`, AD: `${A}${D}` }
  const traps: TrapDraft6[] = []
  const swapped = products(exprs.BD, exprs.AB, exprs.DC, exprs.AC)
  if (positive(swapped)) traps.push({ id: 'geo_bisector_ratio_swapped', stage: 'x', text: qText(swapped), witness: `That x makes ${name.BD}/${name.DC} equal ${name.AC}/${name.AB}, pairing each piece with the side across from it. Each piece goes with the side of the triangle that touches it.` })
  const BC = lin6(ratAddQ(exprs.BD.a, exprs.DC.a), ratAddQ(exprs.BD.b, exprs.DC.b))
  const whole = products(exprs.BD, exprs.AC, BC, exprs.AB)
  if (positive(whole)) traps.push({ id: 'geo_part_over_whole', stage: 'x', text: qText(whole), witness: `That x makes ${name.BD}/${name.BC} equal ${name.AB}/${name.AC}: a piece over the whole side on one side, and two whole sides on the other. Use the two pieces, ${name.BD}/${name.DC}.` })
  const cross = products(exprs.BD, exprs.DC, exprs.AB, exprs.AC)
  if (positive(cross)) traps.push({ id: 'geo_cross_multiplied_wrong', stage: 'x', text: qText(cross), witness: `That x makes ${name.BD} · ${name.DC} equal ${name.AB} · ${name.AC}: each ratio’s own top times its own bottom. Cross-multiplying pairs each numerator with the other denominator.` })
  const label = (pc: BPiece) => show(exprs[pc])
  const prompt = `In triangle ${A}${B}${C}, ${name.AD} bisects ∠${B}${A}${C}, with ${D} on ${name.BC}. ${name.AB} = ${label('AB')}, ${name.AC} = ${label('AC')}, ${name.BD} = ${label('BD')}, and ${name.DC} = ${label('DC')}. Find x${asked ? `, then ${name[asked]}` : ''}.`
  const shown = `${pshow(exprs.BD, exprs.AC)} = ${pshow(exprs.DC, exprs.AB)}`
  const stages: Stage6[] = [
    numberStage6({
      id: 'x',
      label: 'x',
      hint: X_HINT6,
      answerText: String(xValue),
      nudge: `The bisector divides ${name.BC} in the ratio of the other two sides. Pair each piece with the side that touches it.`,
      ruleCard: UNIT6_RULE_IDS.bisector,
      reveal: [`By the Triangle Angle-Bisector Theorem, ${name.BD}/${name.DC} = ${name.AB}/${name.AC}. ${crossText(shown, lprod(exprs.BD, exprs.AC)!, lprod(exprs.DC, exprs.AB)!)}`],
      traps,
    }),
  ]
  if (asked) {
    stages.push(
      numberStage6({
        id: 'result',
        label: name[asked],
        hint: LEN_HINT6,
        answerText: String(val[asked]),
        nudge: `Put your value of x into the expression for ${name[asked]}.`,
        ruleCard: UNIT6_RULE_IDS.substitute,
        reveal: [`${name[asked]} = ${atX(exprs[asked], x)}.`],
        traps: [{ id: 'geo_answered_x', stage: 'result', text: String(x), witness: `That is the value of x, not ${name[asked]}.` }],
      }),
    )
  }
  // A at the top, BC across the bottom, so the dimension lines of BD and DC fall below the triangle.
  const tri0 = triangleUp(rng, angleA, val.AB, val.AC)
  const tri = turned(tri0, 180 + rng.int(-8, 8), rng.chance(0.5)) as [XY, XY, XY]
  if (!readable(tri, 28, 0.35)) return null
  const pD = along(tri[1], tri[2], val.BD / bc)
  const pts: [XY, XY, XY, XY] = [tri[0], tri[1], tri[2], pD]
  const c = { x: (tri[0].x + tri[1].x + tri[2].x) / 3, y: (tri[0].y + tri[1].y + tri[2].y) / 3 }
  const points: GeoPoint[] = [A, B, C, D].map((id, i) => pointAt(id, pts[i]!, i === 3 ? 'below' : sideLabel(pts[i]!, c)!))
  const segments: GeoSegment[] = [
    { from: A, to: B, label: label('AB') },
    { from: A, to: C, label: label('AC') },
    { from: B, to: D, label: label('BD') },
    { from: D, to: C, label: label('DC') },
    { from: A, to: D },
  ]
  const angles: GeoAngleMark[] = [
    { vertex: A, from: B, to: D, marks: 1 },
    { vertex: A, from: D, to: C, marks: 1 },
  ]
  const aria = `Triangle ${A}${B}${C} with ${D} on ${name.BC} and segment ${name.AD}. Angles ${B}${A}${D} and ${D}${A}${C} each have one arc. ${name.AB} is labeled ${label('AB')}, ${name.AC} is labeled ${label('AC')}, ${name.BD} is labeled ${label('BD')}, and ${name.DC} is labeled ${label('DC')}.`
  const figure = placeLabels6({ ariaLabel: aria, points, segments, angles }, [[A, B, C]], new Set([2, 3]))
  return partsFinish(
    'angleBisector',
    prompt,
    figure,
    stages,
    Object.values(val),
    { case: 'bisector', form, x: xValue, piece: xPiece },
    rng.pick<ErrorPatternId[]>([['geo_bisector_ratio_swapped'], ['geo_bisector_ratio_swapped', 'geo_part_over_whole'], ['geo_part_over_whole', 'geo_bisector_ratio_swapped']]),
    'Triangle Angle-Bisector Theorem',
  )
}

type TPiece = 'PQ' | 'QR' | 'ST' | 'TU'

/** Three parallel lines cut two transversals: PQ/QR = ST/TU. Not drawn to scale across the two transversals. */
function parallelsCase(rng: Rng): GeoBuilt | null {
  const [p, q] = rng.pick(RATIOS)
  const m = rng.int(2, 7)
  const n = rng.int(2, 7)
  if (m === n) return null
  const val: Record<TPiece, number> = { PQ: p * m, QR: q * m, ST: p * n, TU: q * n }
  if (Object.values(val).some((v) => v < 2 || v > 40)) return null
  const form = rng.pick(['plain', 'expression', 'expression'] as const)
  const x = rng.pick(X_POOL6)
  const exprs: Record<TPiece, LinQ> = { PQ: konst(val.PQ), QR: konst(val.QR), ST: konst(val.ST), TU: konst(val.TU) }
  const xPiece = rng.pick(['PQ', 'QR', 'ST', 'TU'] as const)
  let asked: TPiece | null = null
  if (form === 'plain') exprs[xPiece] = lin6(1, 0)
  else {
    const e = exprAt(rng, val[xPiece], x, false)
    if (!e) return null
    exprs[xPiece] = e
    asked = xPiece
  }
  const xValue = form === 'plain' ? val[xPiece] : x
  if (RESERVED6_NUMBERS.has(xValue)) return null
  const right = products(exprs.PQ, exprs.TU, exprs.QR, exprs.ST)
  if (!right || !isWhole(right) || right.n !== xValue) return null
  const [P, Q, Rr, S, T, U] = pickLetters6(rng, 6) as [string, string, string, string, string, string]
  const name: Record<TPiece | 'PR' | 'SU', string> = { PQ: `${P}${Q}`, QR: `${Q}${Rr}`, ST: `${S}${T}`, TU: `${T}${U}`, PR: `${P}${Rr}`, SU: `${S}${U}` }
  const traps: TrapDraft6[] = []
  const crosswise = products(exprs.PQ, exprs.ST, exprs.QR, exprs.TU)
  if (positive(crosswise)) traps.push({ id: 'geo_one_ratio_inverted', stage: 'x', text: qText(crosswise), witness: `That x makes ${name.PQ}/${name.QR} equal ${name.TU}/${name.ST}: the second ratio is turned over. The piece between the same two lines goes on top on both transversals.` })
  const PR = lin6(ratAddQ(exprs.PQ.a, exprs.QR.a), ratAddQ(exprs.PQ.b, exprs.QR.b))
  const whole = products(exprs.PQ, exprs.TU, PR, exprs.ST)
  if (positive(whole)) traps.push({ id: 'geo_part_over_whole', stage: 'x', text: qText(whole), witness: `That x makes ${name.PQ}/${name.PR} equal ${name.ST}/${name.TU}: a piece over the whole on one transversal, and a piece over a piece on the other.` })
  const cross = products(exprs.PQ, exprs.QR, exprs.ST, exprs.TU)
  if (positive(cross)) traps.push({ id: 'geo_cross_multiplied_wrong', stage: 'x', text: qText(cross), witness: `That x makes ${name.PQ} · ${name.QR} equal ${name.ST} · ${name.TU}: each ratio’s own top times its own bottom. Cross-multiplying pairs each numerator with the other denominator.` })
  const label = (pc: TPiece) => show(exprs[pc])
  const prompt = `Three parallel lines cut one transversal at ${P}, ${Q}, and ${Rr} and another at ${S}, ${T}, and ${U}. ${name.PQ} = ${label('PQ')}, ${name.QR} = ${label('QR')}, ${name.ST} = ${label('ST')}, and ${name.TU} = ${label('TU')}. The figure is not drawn to scale. Find x${asked ? `, then ${name[asked]}` : ''}.`
  const shown = `${pshow(exprs.PQ, exprs.TU)} = ${pshow(exprs.QR, exprs.ST)}`
  const stages: Stage6[] = [
    numberStage6({
      id: 'x',
      label: 'x',
      hint: X_HINT6,
      answerText: String(xValue),
      nudge: 'The parallel lines divide the two transversals proportionally: the upper piece over the lower piece is the same on both.',
      ruleCard: UNIT6_RULE_IDS.parallels,
      reveal: [`The parallel lines divide the transversals proportionally: ${name.PQ}/${name.QR} = ${name.ST}/${name.TU}. ${crossText(shown, lprod(exprs.PQ, exprs.TU)!, lprod(exprs.QR, exprs.ST)!)}`],
      traps,
    }),
  ]
  if (asked) {
    stages.push(
      numberStage6({
        id: 'result',
        label: name[asked],
        hint: LEN_HINT6,
        answerText: String(val[asked]),
        nudge: `Put your value of x into the expression for ${name[asked]}.`,
        ruleCard: UNIT6_RULE_IDS.substitute,
        reveal: [`${name[asked]} = ${atX(exprs[asked], x)}.`],
        traps: [{ id: 'geo_answered_x', stage: 'result', text: String(x), witness: `That is the value of x, not ${name[asked]}.` }],
      }),
    )
  }
  // Horizontal parallels at heights 0, −d1, −(d1 + d2) with d1/d2 = p/q; two nearly vertical transversals.
  const total = 9
  const d1 = (total * p) / (p + q)
  const tilt1 = rng.int(-10, 10)
  let tilt2 = rng.int(-10, 10)
  if (Math.abs(tilt1 - tilt2) < 6) tilt2 = tilt1 + (tilt1 > 0 ? -8 : 8)
  const gap = 6 + rng.next() * 2
  const onLine = (x0: number, tiltDeg: number, y: number): XY => ({ x: x0 + Math.tan(rad(tiltDeg)) * -y, y })
  const pts: XY[] = [onLine(0, tilt1, 0), onLine(0, tilt1, -d1), onLine(0, tilt1, -total), onLine(gap, tilt2, 0), onLine(gap, tilt2, -d1), onLine(gap, tilt2, -total)]
  const b = bounds(pts)
  if (b.maxX - b.minX < 4) return null
  const ids = [P, Q, Rr, S, T, U]
  const points: GeoPoint[] = ids.map((id, i) => {
    const pt = pts[i]!
    const side: GeoPoint['labelSide'] = i < 3 ? 'above-left' : 'above-right'
    return { id, x: r3(pt.x), y: r3(pt.y), label: id, labelSide: side }
  })
  const lines: GeoLine[] = [
    { through: [P, S], arrows: 1 },
    { through: [Q, T], arrows: 1 },
    { through: [Rr, U], arrows: 1 },
    { through: [P, Rr] },
    { through: [S, U] },
  ]
  const segments: GeoSegment[] = [
    { from: P, to: Q, label: label('PQ') },
    { from: Q, to: Rr, label: label('QR') },
    { from: S, to: T, label: label('ST') },
    { from: T, to: U, label: label('TU') },
  ]
  const aria = `Three parallel lines, each with one arrow, cut transversal ${name.PR} at ${P}, ${Q}, and ${Rr} and transversal ${name.SU} at ${S}, ${T}, and ${U}, not drawn to scale. ${name.PQ} is labeled ${label('PQ')}, ${name.QR} is labeled ${label('QR')}, ${name.ST} is labeled ${label('ST')}, and ${name.TU} is labeled ${label('TU')}.`
  const figure = placeLabels6({ ariaLabel: aria, points, segments, lines }, [], new Set([0, 1, 2, 3]))
  return partsFinish(
    'angleBisector',
    prompt,
    figure,
    stages,
    Object.values(val),
    { case: 'parallels', form, x: xValue, piece: xPiece, toScale: false },
    rng.pick<ErrorPatternId[]>([['geo_one_ratio_inverted'], ['geo_part_over_whole'], ['geo_one_ratio_inverted', 'geo_cross_multiplied_wrong']]),
    'Three parallel lines',
  )
}

