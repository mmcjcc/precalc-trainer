/**
 * Builds one geometry problem from a seed. Every trap is the value that slip produces on
 * this problem. A candidate equal to the right answer is dropped, and the earlier slip
 * keeps a value when two slips agree.
 */
import type { ErrorPatternId } from '@/shared/types'
import type { GeometryAnswer, GeometryStageId } from '@/content/types'
import { formatPoint, formatQty, geoQty, readGeoAnswer, sameGeoValue, simplifyRadical } from './answer'
import type { GeoBuilt } from './build'
import { assertGeoAnswer } from './grade'
import {
  angleLabel,
  evalLin,
  fitExpr,
  fitTwo,
  formatLin,
  lin,
  qIs,
  qText,
  showPt,
  solveEqual,
  type Lin,
} from './expr'
import {
  angleFan,
  complementaryFigure,
  gridFigure,
  linearFigure,
  measureLabel,
  plainAngle,
  segmentFigure,
  separateAngles,
  verticalFigure,
} from './figures'
import { GEO_RULE_FOR, GEO_RULE_IDS } from './rules'

const INSTRUCTIONS = 'Type an exact value for each part.'
const XS = [6, 5, 7, 8, 9, 10, 11, 12] as const
const SEG_PAIRS: readonly (readonly [number, number])[] = [
  [15, 26], [14, 22], [18, 25], [16, 30], [20, 17], [21, 28], [24, 19], [13, 27],
]
const ANG_PAIRS: readonly (readonly [number, number])[] = [
  [15, 26], [20, 35], [24, 40], [18, 48], [28, 22], [32, 41], [16, 55], [30, 27],
]

type StageId = GeometryStageId

interface Draft {
  id: ErrorPatternId
  stage: StageId
  text: string
  witness: string
}

interface Names {
  left: string
  right: string
  whole: string
}

const X_HINT = 'A number, like 7 or x = 7.'
// 2√3 is never a distance between grid points (12 is not a sum of two squares).
const LEN_HINT = 'A length. A square root should be in simplest form, like 2√3.'
const DEG_HINT = 'Degrees, like 50, 50°, or 50 deg.'
const PT_HINT = 'A point, like (2, -3).'
/** A format example that happens to be this part's answer is swapped for another. */
const OTHER_EXAMPLE: Record<string, string> = { '7': '9', '50': '35', '(2, -3)': '(-4, 1)' }
function hintFor(hint: string, answerText: string): string {
  const other = OTHER_EXAMPLE[answerText]
  return other && hint.includes(answerText) ? hint.split(answerText).join(other) : hint
}

function pickX(seed: number): number {
  return XS[(seed - 1) % XS.length]!
}

function keep(out: Draft[], draft: Draft, right: string): void {
  const got = readGeoAnswer(draft.text)
  const expect = readGeoAnswer(right)
  if (!got.ok || !got.simplest || !expect.ok || !expect.simplest) return
  if (sameGeoValue(got.value, expect.value)) return
  if (out.some((t) => t.stage === draft.stage && sameText(t.text, draft.text))) return
  out.push(draft)
}

function sameText(a: string, b: string): boolean {
  const left = readGeoAnswer(a)
  const right = readGeoAnswer(b)
  return left.ok && right.ok && left.simplest && right.simplest && sameGeoValue(left.value, right.value)
}

function choose(traps: Draft[], seed: number): Draft {
  if (traps.length === 0) throw new Error('no trap')
  return traps[(seed - 1) % traps.length]!
}

function accept(built: GeoBuilt): GeoBuilt {
  assertGeoAnswer('draw', built.answer)
  return built
}

function num(n: number): string {
  return String(n)
}

function rulesFor(stages: GeometryAnswer['stages'], trap: ErrorPatternId): string[] {
  const ids = stages.map((s) => s.ruleCard)
  const extra = isMapped(trap) ? GEO_RULE_FOR[trap] : undefined
  return [...new Set([...ids, ...(extra ? [extra] : [])])]
}

function isMapped(id: ErrorPatternId): id is keyof typeof GEO_RULE_FOR {
  return Object.prototype.hasOwnProperty.call(GEO_RULE_FOR, id)
}

function pack(
  question: GeometryAnswer['question'],
  prompt: string,
  figure: GeometryAnswer['figure'],
  stages: GeometryAnswer['stages'],
  lengths: number[],
  angles: number[],
  reveal: string[],
  seed: number,
  title: string,
  params: Record<string, number | string | boolean>,
): GeoBuilt {
  const traps = stages.flatMap((s) => s.traps.map((t) => ({ ...t, stage: s.id })))
  const picked = choose(traps, seed)
  const answer: GeometryAnswer = {
    type: 'geometry',
    question,
    prompt,
    figure,
    stages,
    lengths,
    angles,
    expectedDisplay: stages.map((s) => `${s.label} = ${s.answerText}`).join(', '),
    reveal,
    ruleCards: rulesFor(stages, picked.id),
    trap: picked.id,
    trapStage: picked.stage,
    trapAnswer: picked.text,
  }
  return { answer, title, instructions: INSTRUCTIONS, params }
}

function numberStage(
  id: StageId,
  label: string,
  hint: string,
  answerText: string,
  nudge: string,
  ruleCard: string,
  reveal: string[],
  traps: Draft[],
): GeometryAnswer['stages'][number] {
  return {
    id,
    kind: 'number',
    ...(hint === DEG_HINT ? { unit: 'deg' as const } : {}),
    label,
    hint: hintFor(hint, answerText),
    answerText,
    nudge,
    ruleCard,
    reveal,
    traps: traps.filter((t) => t.stage === id).map(({ id: trapId, text, witness }) => ({ id: trapId, text, witness })),
  }
}

function pointStage(label: string, answerText: string, nudge: string, ruleCard: string, reveal: string[], traps: Draft[]): GeometryAnswer['stages'][number] {
  return {
    id: 'result',
    kind: 'point',
    label,
    hint: hintFor(PT_HINT, answerText),
    answerText,
    nudge,
    ruleCard,
    reveal,
    traps: traps.filter((t) => t.stage === 'result').map(({ id, text, witness }) => ({ id, text, witness })),
  }
}

// --- segment and angle addition ------------------------------------------------

interface SumSpec {
  x: number
  left: Lin
  right: Lin
  whole: Lin
  ask: 'left' | 'right' | 'whole'
}

function drawSumProblem(topic: 'segment' | 'angle', seed: number): GeoBuilt {
  if (seed === 1) return accept(finishSum(topic, { x: 6, left: lin(2, 3), right: lin(5, -4), whole: lin(0, 41), ask: 'left' }, seed))
  let last = 'no candidate'
  for (let bump = 0; bump < 16; bump++) {
    try {
      return accept(finishSum(topic, sumSpec(topic, seed, bump), seed + bump))
    } catch (e) {
      last = e instanceof Error ? e.message : 'bad'
    }
  }
  throw new Error(`${topic} addition seed ${seed}: ${last}`)
}

function sumSpec(topic: 'segment' | 'angle', seed: number, bump: number): SumSpec {
  const x = pickX(seed + bump)
  const pairs = topic === 'segment' ? SEG_PAIRS : ANG_PAIRS
  let p = pairs[(seed + bump - 1) % pairs.length]![0]
  let q = pairs[(seed + bump - 1) % pairs.length]![1]
  if (p <= x) p += 4
  if (q <= x) q += 6
  if (p === q) q += 3
  if (topic === 'angle' && (p >= 180 || q >= 180 || p + q >= 180)) {
    p = 20 + (bump % 5)
    q = 24 + (bump % 4)
  }
  const [left, right] = fitTwo(p, q, x, seed + bump * 3)
  const asks = ['left', 'right', 'whole'] as const
  return { x, left, right, whole: lin(0, p + q), ask: asks[(seed + bump) % 3]! }
}

function finishSum(topic: 'segment' | 'angle', spec: SumSpec, seed: number): GeoBuilt {
  const { x, left, right, whole, ask } = spec
  const leftVal = evalLin(left, x)
  const rightVal = evalLin(right, x)
  const wholeVal = evalLin(whole, x)
  if (leftVal + rightVal !== wholeVal) throw new Error('parts do not add to the whole')
  if (leftVal <= 0 || rightVal <= 0 || wholeVal <= 0) throw new Error('nonpositive length')
  if (topic === 'angle' && (leftVal >= 180 || rightVal >= 180 || wholeVal >= 180)) throw new Error('angle out of range')
  const names: Names = topic === 'segment' ? { left: 'AB', right: 'BC', whole: 'AC' } : { left: 'm∠ABD', right: 'm∠DBC', whole: 'm∠ABC' }
  const askedVal = ask === 'left' ? leftVal : ask === 'right' ? rightVal : wholeVal
  const askedName = names[ask]
  const xText = num(x)
  const askedText = num(askedVal)
  const traps: Draft[] = []
  const parts = solveEqual(left, right)
  const partWhole = solveEqual(left, whole) ?? solveEqual(right, whole)
  if (parts) {
    keep(traps, {
      id: 'geo_parts_equal',
      stage: 'x',
      text: qText(parts),
      witness: `${names.left} is ${formatLin(left)} and ${names.right} is ${formatLin(right)}. Setting those equal gives x = ${qText(parts)}. Nothing in the figure marks the two pieces congruent, so they are not the same ${topic === 'segment' ? 'length' : 'measure'}.`,
    }, xText)
  }
  if (partWhole) {
    const which = solveEqual(left, whole) ? names.left : names.right
    keep(traps, {
      id: 'geo_part_equals_whole',
      stage: 'x',
      text: qText(partWhole),
      witness: `Setting ${which} equal to ${names.whole} gives x = ${qText(partWhole)}. ${which} is one piece of ${names.whole}, and the other piece is not zero.`,
    }, xText)
  }
  keep(traps, {
    id: 'geo_answered_x',
    stage: 'result',
    text: xText,
    witness: `${xText} is the value of x. ${askedName} is what you get after you substitute, and ${xText} is not that ${topic === 'segment' ? 'length' : 'measure'}.`,
  }, askedText)
  const halfVal = ask === 'whole' ? leftVal : wholeVal
  const halfName = ask === 'whole' ? names.left : names.whole
  keep(traps, {
    id: 'geo_half_for_whole',
    stage: 'result',
    text: num(halfVal),
    witness: `${num(halfVal)} is ${halfName}. This part asks for ${askedName}. One piece and the whole are not the same number.`,
  }, askedText)
  const want = ['geo_parts_equal', 'geo_part_equals_whole', 'geo_answered_x', 'geo_half_for_whole']
  if (!want.every((id) => traps.some((t) => t.id === id))) throw new Error(`missing traps ${traps.map((t) => t.id).join(',')}`)
  const rule = topic === 'segment' ? GEO_RULE_IDS.segment : GEO_RULE_IDS.angle
  const postulate = topic === 'segment' ? 'segment addition postulate' : 'angle addition postulate'
  const equation = `(${formatLin(left)}) + (${formatLin(right)}) = ${formatLin(whole)}`
  const combined = formatLin(lin(left.a + right.a, left.b + right.b))
  const xReveal = [
    `The ${postulate} says ${names.left} + ${names.right} = ${names.whole}.`,
    `That is ${equation}.`,
    `Combining like terms gives ${combined} = ${formatLin(whole)}, so x = ${xText}.`,
  ]
  const resultReveal = [`${askedName} = ${ask === 'left' ? formatLin(left) : ask === 'right' ? formatLin(right) : formatLin(whole)} = ${askedText}.`]
  const prompt = topic === 'segment'
    ? `B is between A and C, with AB = ${formatLin(left)}, BC = ${formatLin(right)}, and AC = ${formatLin(whole)}. Find x, then the length of ${askedName}.`
    : `D is in the interior of ∠ABC, with m∠ABD = ${formatLin(left)}, m∠DBC = ${formatLin(right)}, and m∠ABC = ${formatLin(whole)}. Find x, then ${askedName}.`
  const figure = topic === 'segment'
    ? segmentFigure({
        ab: leftVal,
        ac: wholeVal,
        abLabel: formatLin(left),
        bcLabel: formatLin(right),
        acLabel: formatLin(whole),
        aria: `Points A, B, and C are collinear, with B between A and C. AB is labeled ${formatLin(left)}, BC is labeled ${formatLin(right)}, and AC is labeled ${formatLin(whole)}.`,
      })
    : angleFan({
        toD: leftVal,
        toC: wholeVal,
        abd: measureLabel(left),
        dbc: measureLabel(right),
        abc: measureLabel(whole),
        aria: `Ray BD is in the interior of angle ABC. Angle ABD is labeled ${measureLabel(left)}, angle DBC is labeled ${measureLabel(right)}, and angle ABC is labeled ${measureLabel(whole)}.`,
      })
  const xNudge = topic === 'segment'
    ? 'The two pieces of the segment together make the whole segment. Write that as one equation.'
    : 'The two pieces of the angle together make the whole angle. Write that as one equation.'
  return pack(
    topic === 'segment' ? 'addition' : 'angleAddition',
    prompt,
    figure,
    [
      numberStage('x', 'x', X_HINT, xText, xNudge, rule, xReveal, traps),
      numberStage('result', askedName, topic === 'segment' ? LEN_HINT : DEG_HINT, askedText, 'Put the value of x into the expression this part asks for.', GEO_RULE_IDS.substitute, resultReveal, traps),
    ],
    [leftVal, rightVal, wholeVal],
    topic === 'angle' ? [leftVal, rightVal, wholeVal] : [],
    [...xReveal, ...resultReveal],
    seed,
    topic === 'segment' ? 'Segment addition' : 'Angle addition',
    { x, ask, leftA: left.a, leftB: left.b, rightA: right.a, rightB: right.b, whole: wholeVal, asked: askedVal },
  )
}

// --- midpoint and bisector ----------------------------------------------------

interface HalfSpec {
  shape: 'A' | 'B'
  x: number
  left: Lin
  right: Lin
  /** Whole as an expression. Shape A still stores a constant so the value is easy to read. */
  whole: Lin
  ask: 'left' | 'whole'
}

function drawHalfProblem(topic: 'midpoint' | 'bisector', seed: number): GeoBuilt {
  if (seed === 1 && topic === 'midpoint') {
    return accept(finishHalf(topic, { shape: 'A', x: 6, left: lin(3, 5), right: lin(5, -7), whole: lin(0, 46), ask: 'whole' }, seed))
  }
  if (seed === 1 && topic === 'bisector') {
    return accept(finishHalf(topic, { shape: 'A', x: 5, left: lin(4, 6), right: lin(7, -9), whole: lin(0, 52), ask: 'whole' }, seed))
  }
  let last = 'no candidate'
  for (let bump = 0; bump < 16; bump++) {
    try {
      return accept(finishHalf(topic, halfSpec(topic, seed, bump), seed + bump))
    } catch (e) {
      last = e instanceof Error ? e.message : 'bad'
    }
  }
  throw new Error(`${topic} seed ${seed}: ${last}`)
}

function halfSpec(topic: 'midpoint' | 'bisector', seed: number, bump: number): HalfSpec {
  const x = pickX(seed + bump)
  const shape: 'A' | 'B' = (seed + bump) % 2 === 1 ? 'A' : 'B'
  let half = 16 + ((seed + bump) % 8) * 3
  if (half <= x) half += 4
  if (topic === 'bisector' && half >= 90) half = 24 + (bump % 6)
  const wholeVal = 2 * half
  const left = fitExpr(half, x, seed + bump)
  if (shape === 'A') {
    const right = fitExpr(half, x, seed + bump + 5, [left.a])
    return { shape, x, left, right, whole: lin(0, wholeVal), ask: (seed + bump) % 2 === 1 ? 'whole' : 'left' }
  }
  // Not left.a (part = whole would be the right x) and not 2 * left.a (2(part) = whole for every x).
  const whole = fitExpr(wholeVal, x, seed + bump + 4, [left.a, 2 * left.a])
  return { shape, x, left, right: lin(0, 0), whole, ask: (seed + bump) % 2 === 1 ? 'whole' : 'left' }
}

function finishHalf(topic: 'midpoint' | 'bisector', spec: HalfSpec, seed: number): GeoBuilt {
  const { shape, x, left, ask } = spec
  const halfVal = evalLin(left, x)
  const rightVal = shape === 'A' ? evalLin(spec.right, x) : halfVal
  const wholeVal = shape === 'A' ? 2 * halfVal : evalLin(spec.whole, x)
  if (halfVal !== rightVal || wholeVal !== 2 * halfVal) throw new Error('halves do not match')
  if (shape === 'B' && spec.whole.a === 2 * left.a) throw new Error('the whole is twice the piece for every x')
  if (halfVal <= 0 || wholeVal <= 0) throw new Error('nonpositive')
  if (topic === 'bisector' && (halfVal >= 180 || wholeVal >= 180)) throw new Error('angle out of range')
  const piece = topic === 'midpoint' ? 'AM' : 'm∠ABD'
  const other = topic === 'midpoint' ? 'MB' : 'm∠DBC'
  const wholeName = topic === 'midpoint' ? 'AB' : 'm∠ABC'
  const askedName = ask === 'whole' ? wholeName : piece
  const askedVal = ask === 'whole' ? wholeVal : halfVal
  const xText = num(x)
  const askedText = num(askedVal)
  const traps: Draft[] = []
  if (shape === 'B') {
    const slipped = solveEqual(left, spec.whole)
    if (!slipped || qIs(slipped, x)) throw new Error('part-equals-whole is not a different x')
    keep(traps, {
      id: 'geo_part_equals_whole',
      stage: 'x',
      text: qText(slipped),
      witness: `Setting ${piece} equal to ${wholeName} gives x = ${qText(slipped)}. ${piece} is one piece, and ${wholeName} is twice that piece.`,
    }, xText)
  }
  const halfGiven = ask === 'whole' ? halfVal : wholeVal
  const halfGivenName = ask === 'whole' ? piece : wholeName
  keep(traps, {
    id: 'geo_half_for_whole',
    stage: 'result',
    text: num(halfGiven),
    witness: `${num(halfGiven)} is ${halfGivenName}. This part asks for ${askedName}. The whole is twice one piece, so the piece and the whole are different numbers.`,
  }, askedText)
  keep(traps, {
    id: 'geo_answered_x',
    stage: 'result',
    text: xText,
    witness: `${xText} is the value of x, not ${askedName}. Substitute it into the expression.`,
  }, askedText)
  const want = shape === 'A' ? ['geo_half_for_whole', 'geo_answered_x'] : ['geo_part_equals_whole', 'geo_half_for_whole', 'geo_answered_x']
  if (!want.every((id) => traps.some((t) => t.id === id))) throw new Error(`missing half traps ${traps.map((t) => t.id).join(',')}`)
  const rule = topic === 'midpoint' ? GEO_RULE_IDS.midpoint : GEO_RULE_IDS.bisector
  const who = topic === 'midpoint' ? 'M is the midpoint of AB' : 'BD bisects ∠ABC'
  const given = shape === 'A'
    ? `${piece} = ${formatLin(left)} and ${other} = ${formatLin(spec.right)}`
    : `${piece} = ${formatLin(left)} and ${wholeName} = ${formatLin(spec.whole)}`
  const prompt = `${who}. ${given}. Find x, then ${topic === 'midpoint' ? `the length of ${askedName}` : askedName}.`
  const xHow = shape === 'A'
    ? `The marks mean ${piece} = ${other}, so ${formatLin(left)} = ${formatLin(spec.right)}, and x = ${xText}.`
    : `A midpoint or a bisector makes the whole twice one piece, so 2(${formatLin(left)}) = ${formatLin(spec.whole)}, and x = ${xText}.`
  const xReveal = [xHow]
  const resultReveal = [`${askedName} = ${askedText}.`]
  const figure = topic === 'midpoint'
    ? segmentFigure({
        ab: halfVal,
        ac: wholeVal,
        abLabel: formatLin(left),
        bcLabel: shape === 'A' ? formatLin(spec.right) : undefined,
        acLabel: shape === 'B' ? formatLin(spec.whole) : undefined,
        ticks: true,
        aria: `M is the midpoint of AB, and the two halves are marked with matching ticks. AM is labeled ${formatLin(left)}${shape === 'A' ? `, and MB is labeled ${formatLin(spec.right)}` : `, and AB is labeled ${formatLin(spec.whole)}`}.`,
      })
    : angleFan({
        toD: halfVal,
        toC: wholeVal,
        abd: measureLabel(left),
        dbc: shape === 'A' ? measureLabel(spec.right) : undefined,
        abc: shape === 'B' ? measureLabel(spec.whole) : undefined,
        congruent: true,
        aria: `BD bisects angle ABC, and the two halves are marked with matching arcs. Angle ABD is labeled ${measureLabel(left)}${shape === 'A' ? `, and angle DBC is labeled ${measureLabel(spec.right)}` : `, and angle ABC is labeled ${measureLabel(spec.whole)}`}.`,
      })
  const xNudge = shape === 'A'
    ? 'The marks show that the two pieces match. Write that as an equation.'
    : 'The marked point cuts the whole in half, so the whole is twice one piece.'
  // The midpoint figure names the middle point M, but segmentFigure always labels B. Rename by rebuilding points.
  const fixed = topic === 'midpoint' ? renameMidpoint(figure, halfVal, wholeVal) : figure
  return pack(
    topic === 'midpoint' ? 'midpoint' : 'bisector',
    prompt,
    fixed,
    [
      numberStage('x', 'x', X_HINT, xText, xNudge, rule, xReveal, traps),
      numberStage('result', askedName, topic === 'midpoint' ? LEN_HINT : DEG_HINT, askedText, 'The whole is twice one piece. Use the x you just found.', GEO_RULE_IDS.substitute, resultReveal, traps),
    ],
    [halfVal, wholeVal],
    topic === 'bisector' ? [halfVal, wholeVal] : [],
    [...xReveal, ...resultReveal],
    seed,
    topic === 'midpoint' ? 'Midpoint on a segment' : 'Angle bisector',
    { x, shape: shape === 'A' ? 0 : 1, half: halfVal, whole: wholeVal, ask: ask === 'whole' ? 1 : 0 },
  )
}

function renameMidpoint(figure: GeometryAnswer['figure'], half: number, whole: number): GeometryAnswer['figure'] {
  return {
    ...figure,
    points: [
      { id: 'A', x: 0, y: 0, label: 'A', labelSide: 'below' },
      { id: 'M', x: half, y: 0, label: 'M', labelSide: 'below' },
      { id: 'B', x: whole, y: 0, label: 'B', labelSide: 'below' },
    ],
    segments: (figure.segments ?? []).map((seg) => ({
      ...seg,
      from: seg.from === 'B' ? 'M' : seg.from,
      to: seg.to === 'B' ? 'M' : seg.to === 'C' ? 'B' : seg.to,
    })),
  }
}

// --- coordinate ---------------------------------------------------------------

const MID_PAIRS: readonly (readonly [number, number, number, number])[] = [
  [2, 4, 8, 10],
  [1, 5, 7, 9],
  [-2, 3, 6, 7],
  [0, 2, 6, 8],
  [3, -1, 9, 5],
  [-4, 6, 2, 10],
  [4, 1, 10, 7],
  [-3, -2, 5, 4],
]

const TRIPLES: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 3, 4],
  [0, 0, 5, 12],
  [0, 0, 6, 8],
  [0, 0, 8, 15],
  [0, 0, 7, 24],
  [0, 0, 9, 12],
  [0, 0, 20, 21],
  [0, 0, 12, 16],
]

const RADICALS: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 2, 4],
  [0, 0, 1, 2],
  [0, 0, 2, 3],
  [0, 0, 1, 3],
  [0, 0, 1, 6],
  [0, 0, 4, 5],
  [0, 0, 3, 6],
  [0, 0, 4, 6],
]

function drawCoordProblem(seed: number): GeoBuilt {
  const mode = (seed - 1) % 3
  if (mode === 0) return accept(finishMidpoint(seed))
  if (mode === 1) return accept(finishEndpoint(seed))
  return accept(finishDistance(seed))
}

function ptText(x: number, y: number): string {
  return formatPoint(geoQty(x, 1, 1), geoQty(y, 1, 1))
}

function finishMidpoint(seed: number): GeoBuilt {
  const [ax, ay, bx, by] = MID_PAIRS[(seed - 1) % MID_PAIRS.length]!
  if ((ax + bx) % 2 !== 0 || (ay + by) % 2 !== 0) throw new Error('midpoint is not an integer')
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  const sx = (ax - bx) / 2
  const sy = (ay - by) / 2
  const right = ptText(mx, my)
  const wrong = ptText(sx, sy)
  const traps: Draft[] = []
  keep(traps, {
    id: 'geo_midpoint_subtracted',
    stage: 'result',
    text: wrong,
    witness: `The midpoint of ${showPt(ax, ay)} and ${showPt(bx, by)} adds the coordinates, then divides by 2. Subtracting them gives ${wrong}.`,
  }, right)
  if (traps.length !== 1) throw new Error('midpoint trap missing')
  const reveal = [`The midpoint is ((${ax} + ${bx}) / 2, (${ay} + ${by}) / 2) = ${right}.`]
  return pack(
    'coord',
    'Find the midpoint of AB.',
    gridFigure({
      points: [
        { id: 'A', x: ax, y: ay },
        { id: 'B', x: bx, y: by },
      ],
      segments: [{ from: 'A', to: 'B' }],
      aria: `Point A at ${showPt(ax, ay)} and point B at ${showPt(bx, by)} on a coordinate grid.`,
    }),
    [pointStage('Midpoint', right, 'Add each pair of coordinates, then divide by 2.', GEO_RULE_IDS.midFormula, reveal, traps)],
    [Math.abs(bx - ax) + Math.abs(by - ay)],
    [],
    reveal,
    seed,
    'Midpoint in the plane',
    { mode: 0, ax, ay, bx, by, mx, my },
  )
}

function finishEndpoint(seed: number): GeoBuilt {
  const [ax, ay, bx, by] = MID_PAIRS[(seed - 1) % MID_PAIRS.length]!
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  const right = ptText(bx, by)
  const avg = formatPoint(geoQty(ax + mx, 2, 1), geoQty(ay + my, 2, 1))
  const traps: Draft[] = []
  keep(traps, {
    id: 'geo_endpoint_averaged',
    stage: 'result',
    text: avg,
    witness: `Averaging A ${showPt(ax, ay)} and M ${showPt(mx, my)} gives ${avg}, the midpoint of AM. B is 2M − A.`,
  }, right)
  if (traps.length !== 1) throw new Error('endpoint trap missing')
  const reveal = [`B = 2M − A = (${2}·${mx} − ${ax}, ${2}·${my} − ${ay}) = ${right}.`]
  return pack(
    'coord',
    `M is the midpoint of AB. Find the coordinates of B.`,
    gridFigure({
      points: [
        { id: 'A', x: ax, y: ay },
        { id: 'M', x: mx, y: my },
      ],
      segments: [{ from: 'A', to: 'M' }],
      aria: `Point A at ${showPt(ax, ay)} and midpoint M at ${showPt(mx, my)} on a coordinate grid.`,
    }),
    [pointStage('B', right, 'M is already the average of A and B, so B = 2M − A.', GEO_RULE_IDS.endpoint, reveal, traps)],
    [Math.abs(bx - ax) + Math.abs(by - ay)],
    [],
    reveal,
    seed,
    'The other endpoint',
    { mode: 1, ax, ay, mx, my, bx, by },
  )
}

function finishDistance(seed: number): GeoBuilt {
  const radical = seed % 2 === 0
  const table = radical ? RADICALS : TRIPLES
  // Distance seeds are 3, 6, 9, … The even ones are radicals (6, 12, 18, …). Step through
  // each table in order so every row is used, not only the indexes that survive the split.
  const slot = radical ? seed / 6 - 1 : (seed - 3) / 6
  if (!Number.isInteger(slot) || slot < 0) throw new Error(`seed ${seed} is not a distance seed`)
  const [ax, ay, bx, by] = table[slot % table.length]!
  const dx = bx - ax
  const dy = by - ay
  const sum = dx * dx + dy * dy
  const taxi = Math.abs(dx) + Math.abs(dy)
  const right = formatQty(simplifyRadical(1, 1, sum))
  const traps: Draft[] = []
  keep(traps, {
    id: 'geo_distance_not_squared',
    stage: 'result',
    text: num(taxi),
    witness: `From ${showPt(ax, ay)} to ${showPt(bx, by)}, |Δx| + |Δy| is ${taxi}. The distance squares those changes and then takes the square root.`,
  }, right)
  keep(traps, {
    id: 'geo_distance_no_root',
    stage: 'result',
    text: num(sum),
    witness: `Δx² + Δy² is ${sum}. That sum is the square of the distance, not the distance itself.`,
  }, right)
  if (traps.length !== 2) throw new Error(`distance traps ${traps.map((t) => t.id).join(',')}`)
  const reveal = [`AB = √((${bx} − ${ax})² + (${by} − ${ay})²) = √${sum} = ${right}.`]
  return pack(
    'coord',
    'Find the distance from A to B.',
    gridFigure({
      points: [
        { id: 'A', x: ax, y: ay },
        { id: 'B', x: bx, y: by },
      ],
      segments: [{ from: 'A', to: 'B' }],
      aria: `Point A at ${showPt(ax, ay)} and point B at ${showPt(bx, by)} on a coordinate grid.`,
    }),
    [numberStage('result', 'Distance', LEN_HINT, right, 'Square the change in x and the change in y, add, then take the square root.', GEO_RULE_IDS.distance, reveal, traps)],
    [taxi],
    [],
    reveal,
    seed,
    'Distance in the plane',
    { mode: 2, ax, ay, bx, by, radical: radical ? 1 : 0 },
  )
}

// --- angle pairs --------------------------------------------------------------

type PairKind = 'comp' | 'supp' | 'vertical' | 'linear'

function drawPairProblem(seed: number): GeoBuilt {
  if (seed === 1) {
    return accept(finishPair('comp', 6, lin(4, 2), lin(5, 34), 26, 64, 'left', seed))
  }
  let last = 'no candidate'
  for (let bump = 0; bump < 16; bump++) {
    try {
      return accept(pairAt(seed, bump))
    } catch (e) {
      last = e instanceof Error ? e.message : 'bad'
    }
  }
  throw new Error(`pairs seed ${seed}: ${last}`)
}

function pairAt(seed: number, bump: number): GeoBuilt {
  const kind = (['comp', 'supp', 'vertical', 'linear'] as const)[(seed + bump - 1) % 4]!
  const x = pickX(seed + bump)
  const ask = (seed + bump) % 2 === 0 ? 'right' : 'left'
  if (kind === 'vertical') {
    const m = 24 + ((seed + bump) % 10) * 6
    const left = fitExpr(m, x, seed + bump)
    const right = fitExpr(m, x, seed + bump + 4, [left.a])
    return finishPair(kind, x, left, right, m, m, ask, seed + bump)
  }
  let p: number
  let q: number
  if (kind === 'comp') {
    p = 22 + ((seed + bump) % 8) * 6
    q = 90 - p
  } else if (kind === 'supp') {
    p = 26 + ((seed + bump) % 9) * 10
    q = 180 - p
  } else {
    p = 28 + ((seed + bump) % 8) * 12
    q = 180 - p
  }
  if (p <= 0 || q <= 0 || p >= 180 || q >= 180 || p === q) throw new Error('pair measures')
  const [left, right] = fitTwo(p, q, x, seed + bump * 3)
  return finishPair(kind, x, left, right, p, q, ask, seed + bump)
}

function finishPair(kind: PairKind, x: number, left: Lin, right: Lin, p: number, q: number, ask: 'left' | 'right', seed: number): GeoBuilt {
  if (evalLin(left, x) !== p || evalLin(right, x) !== q) throw new Error('pair expressions')
  const total = kind === 'comp' ? 90 : kind === 'vertical' ? 0 : 180
  if (kind !== 'vertical' && p + q !== total) throw new Error('pair total')
  if (kind === 'vertical' && p !== q) throw new Error('vertical not equal')
  const xText = num(x)
  const askedVal = ask === 'left' ? p : q
  const askedName = ask === 'left' ? 'm∠1' : 'm∠2'
  const askedText = num(askedVal)
  const sum = lin(left.a + right.a, left.b + right.b)
  const traps: Draft[] = []
  if (kind === 'comp' || kind === 'supp') {
    const wrongTotal = kind === 'comp' ? 180 : 90
    const slipped = solveEqual(sum, lin(0, wrongTotal))
    if (!slipped) throw new Error('swapped has no solution')
    keep(traps, {
      id: 'geo_comp_supp_swapped',
      stage: 'x',
      text: qText(slipped),
      witness: `These angles are ${kind === 'comp' ? 'complementary' : 'supplementary'}. Using ${wrongTotal}° instead of ${total}° gives x = ${qText(slipped)}.`,
    }, xText)
  } else if (kind === 'vertical') {
    const slipped = solveEqual(sum, lin(0, 180))
    if (!slipped) throw new Error('vertical sum has no solution')
    keep(traps, {
      id: 'geo_vertical_as_supplementary',
      stage: 'x',
      text: qText(slipped),
      witness: `∠1 and ∠2 are vertical angles, so they have the same measure. Adding them to 180° gives x = ${qText(slipped)}.`,
    }, xText)
  } else {
    const slipped = solveEqual(left, right)
    if (!slipped) throw new Error('linear pair has no equal-solution')
    keep(traps, {
      id: 'geo_linear_pair_equal',
      stage: 'x',
      text: qText(slipped),
      witness: `∠1 and ∠2 are a linear pair, so they add to 180°. Setting them equal gives x = ${qText(slipped)}.`,
    }, xText)
  }
  keep(traps, {
    id: 'geo_answered_x',
    stage: 'result',
    text: xText,
    witness: `${xText} is the value of x, not ${askedName}. Substitute it into ${ask === 'left' ? formatLin(left) : formatLin(right)}.`,
  }, askedText)
  const relation = kind === 'comp' ? 'complementary' : kind === 'supp' ? 'supplementary' : kind === 'vertical' ? 'vertical angles' : 'a linear pair'
  const rule = kind === 'comp' ? GEO_RULE_IDS.comp : kind === 'supp' ? GEO_RULE_IDS.supp : kind === 'vertical' ? GEO_RULE_IDS.vertical : GEO_RULE_IDS.linear
  const prompt = `∠1 and ∠2 are ${relation}. m∠1 = ${formatLin(left)} and m∠2 = ${formatLin(right)}. Find x, then ${askedName}.`
  const figure = kind === 'comp'
    ? complementaryFigure(p, angleLabel(left), angleLabel(right))
    : kind === 'supp'
      ? separateAngles(angleLabel(left), angleLabel(right), p, q)
      : kind === 'vertical'
        ? verticalFigure(p, angleLabel(left), angleLabel(right))
        : linearFigure(p, angleLabel(left), angleLabel(right))
  const how = kind === 'vertical'
    ? `Vertical angles are congruent, so ${formatLin(left)} = ${formatLin(right)} and x = ${xText}.`
    : kind === 'comp'
      ? `Complementary angles add to 90°, so (${formatLin(left)}) + (${formatLin(right)}) = 90 and x = ${xText}.`
      : kind === 'supp'
        ? `Supplementary angles add to 180°, so (${formatLin(left)}) + (${formatLin(right)}) = 180 and x = ${xText}.`
        : `A linear pair adds to 180°, so (${formatLin(left)}) + (${formatLin(right)}) = 180 and x = ${xText}.`
  const xReveal = [how]
  const resultReveal = [`${askedName} = ${ask === 'left' ? formatLin(left) : formatLin(right)} = ${askedText}.`]
  const xNudge = kind === 'vertical'
    ? 'Vertical angles have the same measure. Set the two expressions equal.'
    : kind === 'comp'
      ? 'Complementary angles add to 90°. Write that equation.'
      : kind === 'linear'
        ? 'A linear pair adds to 180°. Write that equation.'
        : 'Supplementary angles add to 180°. Write that equation.'
  return pack(
    'pairs',
    prompt,
    figure,
    [
      numberStage('x', 'x', X_HINT, xText, xNudge, rule, xReveal, traps),
      numberStage('result', askedName, DEG_HINT, askedText, 'Put the value of x into the expression for this angle.', GEO_RULE_IDS.substitute, resultReveal, traps),
    ],
    [],
    [p, q],
    [...xReveal, ...resultReveal],
    seed,
    'Angle pairs',
    { kind: kind === 'comp' ? 0 : kind === 'supp' ? 1 : kind === 'vertical' ? 2 : 3, x, p, q, ask: ask === 'left' ? 0 : 1 },
  )
}

// --- word problems ------------------------------------------------------------

interface WordSpec {
  kind: 'comp' | 'supp'
  rel: 'more' | 'less' | 'times'
  k: number
  n: number
}

const WORD_CANDIDATES: readonly WordSpec[] = [
  { kind: 'comp', rel: 'more', k: 2, n: 12 },
  { kind: 'comp', rel: 'more', k: 2, n: 6 },
  { kind: 'comp', rel: 'more', k: 2, n: 18 },
  { kind: 'comp', rel: 'more', k: 1, n: 10 },
  { kind: 'comp', rel: 'more', k: 1, n: 20 },
  { kind: 'comp', rel: 'more', k: 4, n: 10 },
  { kind: 'comp', rel: 'more', k: 5, n: 12 },
  { kind: 'comp', rel: 'less', k: 2, n: 12 },
  { kind: 'comp', rel: 'less', k: 2, n: 6 },
  { kind: 'comp', rel: 'less', k: 2, n: 18 },
  { kind: 'comp', rel: 'less', k: 1, n: 10 },
  { kind: 'comp', rel: 'less', k: 4, n: 10 },
  { kind: 'comp', rel: 'times', k: 2, n: 0 },
  { kind: 'comp', rel: 'times', k: 4, n: 0 },
  { kind: 'comp', rel: 'times', k: 5, n: 0 },
  { kind: 'comp', rel: 'times', k: 8, n: 0 },
  { kind: 'supp', rel: 'more', k: 2, n: 12 },
  { kind: 'supp', rel: 'more', k: 2, n: 18 },
  { kind: 'supp', rel: 'more', k: 1, n: 20 },
  { kind: 'supp', rel: 'more', k: 1, n: 30 },
  { kind: 'supp', rel: 'more', k: 4, n: 10 },
  { kind: 'supp', rel: 'less', k: 2, n: 12 },
  { kind: 'supp', rel: 'less', k: 2, n: 24 },
  { kind: 'supp', rel: 'less', k: 1, n: 20 },
  { kind: 'supp', rel: 'less', k: 4, n: 20 },
  { kind: 'supp', rel: 'times', k: 4, n: 0 },
  { kind: 'supp', rel: 'times', k: 5, n: 0 },
  { kind: 'supp', rel: 'times', k: 8, n: 0 },
]

export interface WordRow {
  spec: WordSpec
  angle: number
  reversed: number
  swapped: number
  partner: number
}

export function wordRow(spec: WordSpec): WordRow | null {
  const total = spec.kind === 'comp' ? 90 : 180
  const other = spec.kind === 'comp' ? 180 : 90
  const den = spec.k + 1
  const more = spec.rel === 'more' || spec.rel === 'times'
  const num = more ? spec.k * total + spec.n : spec.k * total - spec.n
  const rev = more ? total - spec.n : total + spec.n
  const swap = more ? spec.k * other + spec.n : spec.k * other - spec.n
  if (num % den !== 0 || rev % den !== 0 || swap % den !== 0) return null
  const angle = num / den
  const reversed = rev / den
  const swapped = swap / den
  const partner = total - angle
  if (![angle, reversed, swapped, partner].every((n) => Number.isInteger(n) && n > 0 && n < 180)) return null
  if (reversed === angle || swapped === angle || swapped === reversed) return null
  return { spec, angle, reversed, swapped, partner }
}

export const WORD_BANK: readonly WordRow[] = WORD_CANDIDATES.map((spec) => {
  const row = wordRow(spec)
  if (!row) throw new Error(`word spec is not a whole-number angle: ${spec.kind} ${spec.rel} ${spec.k} ${spec.n}`)
  return row
})

function drawWordProblem(seed: number): GeoBuilt {
  const row = WORD_BANK[(seed - 1) % WORD_BANK.length]!
  return accept(finishWord(row, seed))
}

function timesWord(k: number): string {
  if (k === 2) return 'twice'
  if (k === 3) return 'three times'
  if (k === 4) return 'four times'
  if (k === 5) return 'five times'
  if (k === 8) return 'eight times'
  return `${k} times`
}

function wordPrompt(spec: WordSpec): string {
  const partner = spec.kind === 'comp' ? 'complement' : 'supplement'
  const times = timesWord(spec.k)
  if (spec.rel === 'times') return `An angle measures ${times} its ${partner}. Find the angle.`
  if (spec.k === 1 && spec.rel === 'more') return `An angle measures ${spec.n} more than its ${partner}. Find the angle.`
  if (spec.k === 1 && spec.rel === 'less') return `An angle measures ${spec.n} less than its ${partner}. Find the angle.`
  if (spec.rel === 'more') return `An angle measures ${spec.n} more than ${times} its ${partner}. Find the angle.`
  return `An angle measures ${spec.n} less than ${times} its ${partner}. Find the angle.`
}

function finishWord(row: WordRow, seed: number): GeoBuilt {
  const { spec, angle, reversed, swapped, partner } = row
  const partnerName = spec.kind === 'comp' ? 'complement' : 'supplement'
  const traps: Draft[] = []
  keep(traps, {
    id: 'geo_complement_reversed',
    stage: 'result',
    text: num(reversed),
    witness: `That writes the ${partnerName} in the angle’s place. ${reversed}° is the ${partnerName}, and the sentence asks for the angle.`,
  }, num(angle))
  const wrongTotal = spec.kind === 'comp' ? 180 : 90
  keep(traps, {
    id: 'geo_comp_supp_swapped',
    stage: 'result',
    text: num(swapped),
    witness: `The sentence is about a ${partnerName}. Using ${wrongTotal}° instead gives ${swapped}°.`,
  }, num(angle))
  if (traps.length !== 2) throw new Error('word traps')
  const prompt = wordPrompt(spec)
  const total = spec.kind === 'comp' ? 90 : 180
  const partnerExpr = `(${total} − a)`
  const scaled = spec.k === 1 ? partnerExpr : `${timesWord(spec.k)} ${partnerExpr}`
  const relation = spec.rel === 'times' ? `${timesWord(spec.k)} ${partnerExpr}` : spec.rel === 'more' ? `${scaled} + ${spec.n}` : `${scaled} − ${spec.n}`
  const reveal = [
    `Let the angle be a. Its ${partnerName} is ${total} − a.`,
    `The sentence says a = ${relation}.`,
    `Solving gives a = ${angle}. The ${partnerName} is ${partner}°.`,
  ]
  return pack(
    'words',
    prompt,
    plainAngle(),
    [numberStage('result', 'The angle', DEG_HINT, num(angle), `Let the angle be a and write its ${partnerName} as ${total} − a. Then translate the sentence.`, GEO_RULE_IDS.words, reveal, traps)],
    [],
    [angle, partner],
    reveal,
    seed,
    'Angle word problems',
    { kind: spec.kind === 'comp' ? 0 : 1, rel: spec.rel === 'more' ? 0 : spec.rel === 'less' ? 1 : 2, k: spec.k, n: spec.n, angle, partner },
  )
}

export function drawSegmentAddition(seed: number): GeoBuilt {
  return drawSumProblem('segment', seed)
}

export function drawAngleAddition(seed: number): GeoBuilt {
  return drawSumProblem('angle', seed)
}

export function drawMidpoint(seed: number): GeoBuilt {
  return drawHalfProblem('midpoint', seed)
}

export function drawBisector(seed: number): GeoBuilt {
  return drawHalfProblem('bisector', seed)
}

export function drawCoordinate(seed: number): GeoBuilt {
  return drawCoordProblem(seed)
}

export function drawPairs(seed: number): GeoBuilt {
  return drawPairProblem(seed)
}

export function drawWords(seed: number): GeoBuilt {
  return drawWordProblem(seed)
}
