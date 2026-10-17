/**
 * Honors geometry Unit 3. Every trap is the value that slip produces on this problem.
 * A candidate equal to the right answer is dropped. Figures use the problem's true angles;
 * labels are the given expressions or the angle numbers, never the solved answer.
 */
import type { ErrorPatternId, GeoFigureSpec } from '@/shared/types'
import type { GeometryAnswer, GeometryStageId } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { makeRng } from '@/content/rng'
import { rat, ratAdd, ratMul, ratSub, ratToString, type Rational } from '@/notation'
import type { GeoBuilt } from './build'
import { angleLabel, fitExpr, fitTwo, formatLin, lin, qText, solveEqual, type Lin } from './expr'
import { containsAnswer, exampleShowsAnswer, gradeGeoStage, isGeoMistake, stageDisplay } from './grade'
import { formatLine, readLine } from './lines'
import { PARALLEL_RULES, POLYGON_RULES, UNIT3_RULE_FOR, UNIT3_RULE_IDS } from './unit3Rules'
import type { RuleCard } from '@/content/types'

const XS = [6, 5, 7, 8, 9, 10, 12, 13] as const
const X_HINT = 'A number, like 7 or x = 7.'
const DEG_HINT = 'Degrees, like 50, 50°, or 50 deg.'
const SLOPE_SAMPLES = ['3/2', '5/3', '2/5'] as const
const LINE_HINT = 'An equation, like y = x + 1.'
const SIDES_HINT = 'A number of sides, like 7.'
const OTHER_EXAMPLE: Record<string, string> = { '7': '9', '50': '35', '(2, -3)': '(-4, 1)' }
const PICK = 'Pick one choice for each part. Read every choice before you check.'
const TYPE = 'Type an exact value for each part.'
const MIXED = 'Type an exact value, then pick one choice. Read every choice before you check.'

type StageId = GeometryStageId
type Rel = 'corr' | 'alt-int' | 'alt-ext' | 'ssi' | 'vert' | 'linear' | 'none'

interface Draft {
  id: ErrorPatternId
  stage: StageId
  text: string
  witness: string
}

interface Pt {
  x: number
  y: number
}

const REL_CHOICES: { id: Rel; text: string }[] = [
  { id: 'corr', text: 'Corresponding' },
  { id: 'alt-int', text: 'Alternate interior' },
  { id: 'alt-ext', text: 'Alternate exterior' },
  { id: 'ssi', text: 'Same-side (consecutive) interior' },
  { id: 'vert', text: 'Vertical' },
  { id: 'linear', text: 'Linear pair' },
  { id: 'none', text: 'None of these' },
]

const FACTS: { id: string; text: string }[] = [
  { id: 'corr', text: 'Corresponding angles match' },
  { id: 'alt-int', text: 'Alternate interior angles match' },
  { id: 'alt-ext', text: 'Alternate exterior angles match' },
  { id: 'ssi', text: 'Same-side interior angles add to a straight angle' },
  { id: 'none', text: 'None of these facts' },
]

const YESNO = [
  { id: 'yes', text: 'Yes' },
  { id: 'no', text: 'No' },
]

const LINE_REL = [
  { id: 'par', text: 'Parallel' },
  { id: 'perp', text: 'Perpendicular' },
  { id: 'neither', text: 'Neither' },
]

/** The fourteen pairs the template asks, in seed order. */
const PAIR_BANK: readonly { a: number; b: number; rel: Rel; trap: Rel; id: ErrorPatternId }[] = [
  { a: 4, b: 6, rel: 'alt-int', trap: 'corr', id: 'geo_alt_int_corr_swapped' },
  { a: 1, b: 7, rel: 'alt-ext', trap: 'corr', id: 'geo_alt_ext_corr_swapped' },
  { a: 2, b: 6, rel: 'corr', trap: 'alt-int', id: 'geo_alt_int_corr_swapped' },
  { a: 3, b: 6, rel: 'ssi', trap: 'corr', id: 'geo_same_side_congruent' },
  { a: 3, b: 5, rel: 'alt-int', trap: 'corr', id: 'geo_alt_int_corr_swapped' },
  { a: 2, b: 8, rel: 'alt-ext', trap: 'corr', id: 'geo_alt_ext_corr_swapped' },
  { a: 1, b: 5, rel: 'corr', trap: 'alt-int', id: 'geo_alt_int_corr_swapped' },
  { a: 4, b: 8, rel: 'corr', trap: 'alt-ext', id: 'geo_alt_ext_corr_swapped' },
  { a: 3, b: 7, rel: 'corr', trap: 'alt-ext', id: 'geo_alt_ext_corr_swapped' },
  { a: 4, b: 5, rel: 'ssi', trap: 'corr', id: 'geo_same_side_congruent' },
  { a: 1, b: 3, rel: 'vert', trap: 'corr', id: 'geo_parallel_only_when_not' },
  { a: 2, b: 4, rel: 'vert', trap: 'alt-int', id: 'geo_parallel_only_when_not' },
  { a: 1, b: 2, rel: 'linear', trap: 'ssi', id: 'geo_parallel_only_when_not' },
  { a: 1, b: 6, rel: 'none', trap: 'corr', id: 'geo_parallel_only_when_not' },
]

const NUMBERING =
  'At the upper crossing, 1 is upper-left, 2 is upper-right, 3 is lower-right, and 4 is lower-left. At the lower crossing, 5, 6, 7, and 8 follow the same order.'

const SLOPES: Rational[] = [
  [1, 2], [2, 1], [3, 2], [2, 3], [3, 1], [1, 3], [5, 2], [2, 5], [5, 1], [1, 5],
  [-1, 2], [-2, 1], [-3, 2], [-2, 3], [-3, 1], [-1, 3], [-5, 2], [-2, 5], [-5, 1], [-1, 5],
].map(([n, d]) => rat(n!, d!))

const DIVISORS = [3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20] as const

function hintFor(hint: string, answerText: string): string {
  const other = OTHER_EXAMPLE[answerText]
  return other && hint.includes(answerText) ? hint.split(answerText).join(other) : hint
}

function slopeHint(answerText: string): string {
  const sample = SLOPE_SAMPLES.find((item) => item !== answerText) ?? '3/2'
  return `A slope, like ${sample}.`
}

function r3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function rad(deg: number): number {
  return (deg * Math.PI) / 180
}

function wedge(v: Pt, a: Pt, b: Pt): number {
  const a1 = Math.atan2(a.y - v.y, a.x - v.x)
  const a2 = Math.atan2(b.y - v.y, b.x - v.x)
  let d = a2 - a1
  while (d <= -Math.PI) d += 2 * Math.PI
  while (d > Math.PI) d -= 2 * Math.PI
  return (Math.abs(d) * 180) / Math.PI
}

/** Odd angles are θ and even angles are 180 − θ when the lines are parallel and the top line is horizontal. */
const ANGLE_RAYS: Record<number, { vertex: 'P' | 'Q'; from: string; to: string }> = {
  1: { vertex: 'P', from: 'L1', to: 'U' },
  2: { vertex: 'P', from: 'R1', to: 'U' },
  3: { vertex: 'P', from: 'R1', to: 'Q' },
  4: { vertex: 'P', from: 'L1', to: 'Q' },
  5: { vertex: 'Q', from: 'L2', to: 'P' },
  6: { vertex: 'Q', from: 'R2', to: 'P' },
  7: { vertex: 'Q', from: 'R2', to: 'D' },
  8: { vertex: 'Q', from: 'L2', to: 'D' },
}

function transversalPoints(theta: number, delta: number): Record<string, Pt> {
  const th = rad(theta)
  const de = rad(delta)
  const down = { x: Math.cos(th), y: -Math.sin(th) }
  const P = { x: 0, y: 2.2 }
  const Q = { x: r3(P.x + down.x * 3.6), y: r3(P.y + down.y * 3.6) }
  const U = { x: r3(P.x - down.x * 1.7), y: r3(P.y - down.y * 1.7) }
  const D = { x: r3(Q.x + down.x * 1.7), y: r3(Q.y + down.y * 1.7) }
  const right = { x: Math.cos(de), y: Math.sin(de) }
  return {
    P: { x: 0, y: 2.2 },
    Q,
    U,
    D,
    L1: { x: -3.4, y: 2.2 },
    R1: { x: 3.4, y: 2.2 },
    L2: { x: r3(Q.x - right.x * 3.4), y: r3(Q.y - right.y * 3.4) },
    R2: { x: r3(Q.x + right.x * 3.4), y: r3(Q.y + right.y * 3.4) },
  }
}

function measureAngle(theta: number, delta: number, n: number): number {
  const pts = transversalPoints(theta, delta)
  const spec = ANGLE_RAYS[n]
  if (!spec) throw new Error(`no angle ${n}`)
  return wedge(pts[spec.vertex]!, pts[spec.from]!, pts[spec.to]!)
}

let numberingOk = false
function assertNumbering(): void {
  if (numberingOk) return
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const got = measureAngle(64, 0, n)
    const want = n % 2 === 1 ? 64 : 116
    if (Math.abs(got - want) > 0.8) throw new Error(`angle ${n} measures ${got.toFixed(2)} when parallel, want ${want}`)
  }
  numberingOk = true
}

function fitDelta(theta: number, angle: number, target: number): number {
  const parallel = measureAngle(theta, 0, angle)
  if (Math.abs(parallel - target) < 0.8) return 0
  let best = 12
  let bestErr = Infinity
  for (let i = -70; i <= 70; i += 0.5) {
    if (Math.abs(i) < 0.25) continue
    const err = Math.abs(measureAngle(theta, i, angle) - target)
    if (err < bestErr) {
      bestErr = err
      best = i
    }
  }
  if (bestErr > 0.8) throw new Error(`no tilt for angle ${angle} = ${target}`)
  return best
}

function transversalFigure(theta: number, delta: number, arrows: boolean, aria: string): GeoFigureSpec {
  assertNumbering()
  const pts = transversalPoints(theta, delta)
  const angles = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
    const spec = ANGLE_RAYS[n]!
    const got = wedge(pts[spec.vertex]!, pts[spec.from]!, pts[spec.to]!)
    if (!(got > 0.5 && got < 179.5)) throw new Error(`angle ${n} drew at ${got}`)
    return { vertex: spec.vertex, from: spec.from, to: spec.to, label: String(n), radius: 22 }
  })
  return {
    ariaLabel: aria,
    points: Object.entries(pts).map(([id, p]) => ({ id, x: p.x, y: p.y })),
    lines: [
      { through: ['L1', 'R1'], ...(arrows ? { arrows: 1 as const } : {}) },
      { through: ['L2', 'R2'], ...(arrows ? { arrows: 1 as const } : {}) },
      { through: ['U', 'D'] },
    ],
    angles,
  }
}

function thetaFor(angle: number, measure: number): number {
  if (angle < 1 || angle > 8) throw new Error(`angle ${angle}`)
  const theta = angle % 2 === 1 ? measure : 180 - measure
  if (theta <= 18 || theta >= 162) throw new Error(`theta ${theta} is too flat`)
  return theta
}

function pairWitness(rel: Rel): string {
  if (rel === 'ssi') {
    return 'These two sit between the lines on one side of the transversal, so they add to a straight angle. They are not a matching pair.'
  }
  if (rel === 'vert' || rel === 'linear' || rel === 'none') {
    return 'That name is a pair that needs the lines not to meet, or it is a different pair. These two angles do not have that relationship.'
  }
  return 'That name is a different pair from the one these two angles make. Check which side of each line they sit on, and which side of the transversal.'
}

function rulesFor(stages: GeometryAnswer['stages'], trap: ErrorPatternId, cards: RuleCard[]): string[] {
  const ids = stages.map((s) => s.ruleCard)
  const extra = isGeoMistake(trap) ? UNIT3_RULE_FOR[trap] : undefined
  const known = new Set(cards.map((card) => card.id))
  return [...new Set([...ids, ...(extra ? [extra] : [])])].filter((id) => known.has(id))
}

function leakOf(answer: GeometryAnswer, cards: RuleCard[]): string | null {
  for (const stage of answer.stages) {
    const display = stageDisplay(stage)
    const replies = [gradeGeoStage(answer, stage.id, stage.kind === 'choice' ? '' : '???'), gradeGeoStage(answer, stage.id, stage.kind === 'line' ? 'banana' : '1001')]
    for (const grade of replies) {
      if (grade.verdict === 'correct') continue
      const said = grade.verdict === 'mistake' ? grade.witness : grade.message
      if (containsAnswer(said, display)) return `${stage.id} message contains “${display}”`
    }
    for (const trap of stage.traps) {
      if (containsAnswer(trap.witness, display)) return `${stage.id} witness contains “${display}”`
      const info = ERROR_PATTERNS[trap.id]
      const lesson = `${info.title}\n${info.lesson}\n${info.example}`
      if (containsAnswer(lesson, display)) return `${stage.id} catalog ${trap.id} contains “${display}”`
      if (!display.startsWith('(') && exampleShowsAnswer(info.example, display)) return `${stage.id} example shows ${display}`
    }
    for (const card of cards) {
      const blob = `${card.body}\n${card.example ?? ''}`
      if (containsAnswer(blob, display)) return `${stage.id} rule card contains “${display}”`
      const result = (card.example ?? '').split(/=|→/).pop()?.trim() ?? ''
      if (result && exampleShowsAnswer(result, display)) return `${stage.id} rule result shows ${display}`
    }
    for (const said of [stage.hint, stage.nudge, stage.note ?? '']) {
      if (containsAnswer(said, display)) return `${stage.id} shows “${display}”`
    }
    const shared = [answer.prompt, answer.figure.ariaLabel, ...(answer.lines ?? [])]
    for (const p of answer.figure.points) shared.push(p.label ?? '')
    for (const s of answer.figure.segments ?? []) if (s.label) shared.push(s.label)
    for (const a of answer.figure.angles ?? []) if (a.label) shared.push(a.label)
    if (containsAnswer(shared.join('\n'), display)) return `${stage.id} answer is on screen`
  }
  return null
}

function pack(
  question: GeometryAnswer['question'],
  prompt: string,
  figure: GeoFigureSpec,
  stages: GeometryAnswer['stages'],
  angles: number[],
  reveal: string[],
  seed: number,
  title: string,
  instructions: string,
  cards: RuleCard[],
  params: Record<string, number | string | boolean>,
): GeoBuilt {
  const traps = stages.flatMap((s) => s.traps.map((t) => ({ ...t, stage: s.id })))
  if (traps.length === 0) throw new Error('no trap')
  for (const stage of stages) {
    const display = stageDisplay(stage)
    if (display === '4' || display === '-4' || display === 'x = 4') throw new Error('reserved answer')
  }
  const picked = traps[(seed - 1) % traps.length]!
  const answer: GeometryAnswer = {
    type: 'geometry',
    question,
    prompt,
    figure,
    stages,
    lengths: [],
    angles,
    expectedDisplay: stages.map((s) => `${s.label} = ${stageDisplay(s)}`).join(', '),
    reveal,
    ruleCards: rulesFor(stages, picked.id, cards),
    trap: picked.id,
    trapStage: picked.stage,
    trapAnswer: picked.text,
  }
  const leak = leakOf(answer, cards)
  if (leak) throw new Error(leak)
  return { answer, title, instructions, params }
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
  extra?: { unit?: 'deg'; allowUndefined?: boolean },
): GeometryAnswer['stages'][number] {
  const useDeg = hint === DEG_HINT || extra?.unit === 'deg'
  return {
    id,
    kind: 'number',
    ...(useDeg ? { unit: 'deg' as const } : {}),
    ...(extra?.allowUndefined ? { allowUndefined: true } : {}),
    label,
    hint: hintFor(hint, answerText),
    answerText,
    nudge,
    ruleCard,
    reveal,
    traps: traps.filter((t) => t.stage === id).map(({ id: trapId, text, witness }) => ({ id: trapId, text, witness })),
  }
}

function lineStage(label: string, answerText: string, nudge: string, ruleCard: string, reveal: string[], traps: Draft[]): GeometryAnswer['stages'][number] {
  const hint = answerText === 'y = x + 1' ? 'An equation, like x = 1.' : LINE_HINT
  return {
    id: 'result',
    kind: 'line',
    label,
    hint,
    answerText,
    nudge,
    ruleCard,
    reveal,
    traps: traps.filter((t) => t.stage === 'result').map(({ id, text, witness }) => ({ id, text, witness })),
  }
}

function choiceStage(
  id: StageId,
  label: string,
  hint: string,
  choices: { id: string; text: string; trap?: ErrorPatternId; witness?: string }[],
  answerId: string,
  nudge: string,
  ruleCard: string,
  reveal: string[],
  seed: number,
): GeometryAnswer['stages'][number] {
  const order = makeRng(seed + id.charCodeAt(0) * 17).shuffle(choices)
  const traps = order
    .filter((choice) => choice.trap && choice.witness)
    .map((choice) => ({ id: choice.trap!, text: choice.id, witness: choice.witness! }))
  return {
    id,
    kind: 'choice',
    label,
    hint,
    answerText: answerId,
    nudge,
    ruleCard,
    reveal,
    choices: order,
    traps,
  }
}

function evalAt(e: Lin, x: Rational): Rational {
  return ratAdd(ratMul(rat(e.a, 1), x), rat(e.b, 1))
}

function showInt(n: number): string {
  return n < 0 ? `−${-n}` : String(n)
}

function showRat(r: Rational): string {
  return ratToString(r).replace(/-/g, '−')
}

function slopeHead(m: Rational): string {
  if (ratToString(m) === '1') return 'x'
  if (ratToString(m) === '-1') return '−x'
  return `${showRat(m)}x`
}

/** Prompt form of a non-vertical line. Unicode minus. */
function showSlopeEq(m: Rational, k: number): string {
  const head = slopeHead(m)
  if (k === 0) return `y = ${head}`
  if (k > 0) return `y = ${head} + ${k}`
  return `y = ${head} − ${-k}`
}

function showGiven(m: Rational | null, k: number): string {
  if (m === null) return `x = ${showInt(k)}`
  if (ratToString(m) === '0') return `y = ${showInt(k)}`
  return showSlopeEq(m, k)
}

/** Ax + By = C, the same line as y = mx + k. */
function showStandard(m: Rational, k: number): string {
  let a = m.n
  let b = -m.d
  let c = -m.d * k
  if (a < 0 || (a === 0 && b < 0)) {
    a = -a
    b = -b
    c = -c
  }
  const left = `${a === 1 ? '' : a}x ${b < 0 ? '−' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}y`
  return `${left.replace(/\s+/g, ' ').trim()} = ${showInt(c)}`
}

function lineText(m: Rational | null, px: number, py: number): string {
  if (m === null) {
    const read = readLine(`x = ${px}`)
    if (!read.ok) throw new Error('vertical line')
    return formatLine(read.line)
  }
  const k = ratSub(rat(py, 1), ratMul(m, rat(px, 1)))
  const raw = `y = (${m.n}/${m.d})*x + (${k.n}/${k.d})`
  const read = readLine(raw)
  if (!read.ok) throw new Error(raw)
  return formatLine(read.line)
}

function slopeText(m: Rational | null): string {
  return m === null ? 'undefined' : ratToString(m)
}

function perpSlope(m: Rational | null): Rational | null {
  if (m === null) return rat(0, 1)
  if (ratToString(m) === '0') return null
  return rat(-m.d, m.n)
}

function reciprocalOnly(m: Rational): Rational {
  return rat(m.d, m.n)
}

function signOnly(m: Rational): Rational {
  return rat(-m.n, m.d)
}

// --- pairs ----------------------------------------------------------------------

export function drawTransversalPairs(seed: number): GeoBuilt {
  const row = PAIR_BANK[(seed - 1) % PAIR_BANK.length]!
  const figure = transversalFigure(
    64,
    18,
    false,
    `Lines m and n are cut by a transversal. The angles are numbered 1 to 8. ${NUMBERING}`,
  )
  const prompt = `Lines m and n are cut by a transversal. What is the relationship between ∠${row.a} and ∠${row.b}?`
  const witness = pairWitness(row.rel)
  const stage = choiceStage(
    'a',
    'The relationship',
    'Look at where each angle sits: above or below its line, and on which side of the transversal.',
    REL_CHOICES.map((choice) => (choice.id === row.trap ? { ...choice, trap: row.id, witness } : choice)),
    row.rel,
    'The name comes from the positions, not from the lines being parallel.',
    UNIT3_RULE_IDS.transversal,
    [`∠${row.a} and ∠${row.b} sit in the positions for one specific pair. Use that pair's name.`],
    seed,
  )
  return pack('transversalPairs', prompt, figure, [stage], [], stage.reveal, seed, 'Angle relationship', PICK, PARALLEL_RULES, {
    a: row.a,
    b: row.b,
    rel: row.rel,
  })
}

// --- solve ----------------------------------------------------------------------

interface SolveSpec {
  a: number
  b: number
  left: Lin
  right: Lin
  x: number
  ask: number
}

function congruentPair(seed: number): { a: number; b: number } {
  const pairs = [
    [4, 6],
    [3, 5],
    [1, 7],
    [2, 8],
    [1, 5],
    [2, 6],
    [3, 7],
    [4, 8],
  ] as const
  const row = pairs[(seed - 1) % pairs.length]!
  return { a: row[0], b: row[1] }
}

function solveSpec(seed: number, bump: number): SolveSpec {
  const s = seed + bump
  const ssi = s % 2 === 1
  const pair = ssi ? (s % 4 === 1 ? { a: 3, b: 6 } : { a: 4, b: 5 }) : congruentPair(s)
  const x = XS[(s - 1) % XS.length]!
  let measure = 36 + ((s * 5 + bump) % 48)
  if (measure === 90) measure = 88
  const other = ssi ? 180 - measure : measure
  if (other <= 0 || other >= 180 || measure <= 0 || measure >= 180) throw new Error('measure')
  const [left, right] = fitTwo(measure, other, x, s)
  return { ...pair, left, right, x, ask: s % 3 === 0 ? pair.b : pair.a }
}

function finishSolve(spec: SolveSpec, seed: number): GeoBuilt {
  const rel = spec.a + spec.b === 9 || spec.a + spec.b === 13 ? 'ssi' : 'match'
  // 3+6=9, 4+5=9 are the same-side pairs. Congruent pairs are not those.
  const sameSide = (spec.a === 3 && spec.b === 6) || (spec.a === 4 && spec.b === 5)
  const xRat = rat(spec.x, 1)
  const askedExpr = spec.ask === spec.a ? spec.left : spec.right
  const asked = evalAt(askedExpr, xRat)
  if (asked.d !== 1) throw new Error('asked measure is not an integer')
  const wrong = sameSide ? solveEqual(spec.left, spec.right) : solveEqual(lin(spec.left.a + spec.right.a, spec.left.b + spec.right.b), lin(0, 180))
  if (!wrong || (wrong.n === spec.x && wrong.d === 1)) throw new Error('trap collided')
  const theta = thetaFor(spec.a, evalAt(spec.left, xRat).n)
  const drawnAsk = measureAngle(theta, 0, spec.ask)
  if (Math.abs(drawnAsk - asked.n) > 1) throw new Error(`drew ${drawnAsk} for ${asked.n}`)
  const id: ErrorPatternId = sameSide ? 'geo_same_side_congruent' : 'geo_congruent_as_same_side'
  const witness = sameSide
    ? 'Those angles add to a straight angle. Setting them equal is a different relationship.'
    : 'Those angles match. Adding them to a straight angle is a different relationship.'
  const traps: Draft[] = [{ id, stage: 'x', text: qText(wrong), witness }]
  const prompt = `Lines m and n are parallel and are cut by a transversal. ∠${spec.a} = (${formatLin(spec.left)})° and ∠${spec.b} = (${formatLin(spec.right)})°. Find x, then m∠${spec.ask}.`
  const figure = transversalFigure(theta, 0, true, `Lines m and n are parallel, marked with arrows, and cut by a transversal. ${NUMBERING}`)
  const xReveal = [`The equation from the two angles gives x = ${spec.x}.`]
  const stages = [
    numberStage('x', 'x', X_HINT, String(spec.x), 'Write the equation the two positions call for, then solve it.', sameSide ? UNIT3_RULE_IDS.parallelAngles : UNIT3_RULE_IDS.parallelAngles, xReveal, traps),
    numberStage(
      'result',
      `m∠${spec.ask}`,
      DEG_HINT,
      String(asked.n),
      'Put the value of x into the expression this part asks for.',
      UNIT3_RULE_IDS.parallelAngles,
      [`m∠${spec.ask} uses the x you found.`],
      [],
    ),
  ]
  return pack('parallelSolve', prompt, figure, stages, [evalAt(spec.left, xRat).n, evalAt(spec.right, xRat).n], [`x = ${spec.x}.`, `m∠${spec.ask} = ${asked.n}.`], seed, 'Parallel lines', TYPE, PARALLEL_RULES, {
    a: spec.a,
    b: spec.b,
    rel: rel,
  })
}

export function drawParallelSolve(seed: number): GeoBuilt {
  if (seed === 1) {
    return finishSolve({ a: 3, b: 6, left: lin(2, 10), right: lin(3, 20), x: 30, ask: 3 }, seed)
  }
  if (seed === 2) {
    // x = 10, not 8: the figure numbers the angles 1 to 8, so 8 would be on screen before she answers.
    return finishSolve({ a: 4, b: 6, left: lin(4, 6), right: lin(6, -14), x: 10, ask: 4 }, seed)
  }
  let last = 'no candidate'
  for (let bump = 0; bump < 24; bump++) {
    try {
      return finishSolve(solveSpec(seed, bump), seed)
    } catch (e) {
      last = e instanceof Error ? e.message : 'bad'
    }
  }
  throw new Error(`gl3.solve/${seed}: ${last}`)
}

// --- converse -------------------------------------------------------------------

function factFor(rel: Rel): string {
  if (rel === 'corr' || rel === 'alt-int' || rel === 'alt-ext' || rel === 'ssi') return rel
  return 'none'
}

function parallelFacts(rel: Rel): boolean {
  return rel === 'corr' || rel === 'alt-int' || rel === 'alt-ext' || rel === 'ssi'
}

function measuresFit(rel: Rel, left: number, right: number): boolean {
  if (rel === 'ssi') return left + right === 180
  if (rel === 'corr' || rel === 'alt-int' || rel === 'alt-ext') return left === right
  return false
}

function finishConverseNumbers(a: number, b: number, left: number, right: number, seed: number): GeoBuilt {
  const rel = classifyBank(a, b)
  const yes = measuresFit(rel, left, right)
  const fact = yes ? factFor(rel) : 'none'
  const top = a <= 4 ? a : b <= 4 ? b : 0
  let theta = 70
  let delta = yes ? 0 : 18
  if (top) {
    const topMeasure = top === a ? left : right
    theta = thetaFor(top, topMeasure)
    const bottom = top === a ? b : a
    const bottomMeasure = top === a ? right : left
    if (bottom > 4) delta = fitDelta(theta, bottom, bottomMeasure)
    else delta = yes ? 0 : 18
  } else {
    theta = thetaFor(1, 58)
    delta = fitDelta(theta, a, left)
    const other = measureAngle(theta, delta, b)
    if (Math.abs(other - right) > 1.2) throw new Error('bottom pair does not match')
  }
  if (yes && Math.abs(delta) > 0.8) throw new Error('yes figure is not parallel')
  if (!yes && Math.abs(delta) < 1) throw new Error('no figure looks parallel')
  const gotA = measureAngle(theta, delta, a)
  const gotB = measureAngle(theta, delta, b)
  if (Math.abs(gotA - left) > 1.2 || Math.abs(gotB - right) > 1.2) throw new Error(`drew ${gotA.toFixed(1)} and ${gotB.toFixed(1)}`)
  const yesWitness =
    rel === 'vert' || rel === 'linear'
      ? 'Those two angles match either way, or they sit next to each other on a straight line either way. That does not decide whether the lines meet.'
      : 'The two measures do not fit a pair that decides the lines.'
  const factWitness = parallelFacts(rel)
    ? 'That fact is about a different pair than these two angles.'
    : 'That fact decides the lines only for a different pair. These two angles do not decide whether the lines meet.'
  const factTrap = fact === 'none' ? 'corr' : fact === 'corr' ? 'alt-int' : fact === 'alt-int' ? 'corr' : fact === 'alt-ext' ? 'corr' : 'corr'
  const factTrapId: ErrorPatternId = fact === 'alt-ext' ? 'geo_alt_ext_corr_swapped' : fact === 'ssi' || rel === 'ssi' ? 'geo_same_side_congruent' : fact === 'none' || !parallelFacts(rel) ? 'geo_parallel_only_when_not' : 'geo_alt_int_corr_swapped'
  const stages = [
    choiceStage(
      'a',
      'Parallel?',
      'Decide from the two angles.',
      YESNO.map((choice) => (!yes && choice.id === 'yes' ? { ...choice, trap: 'geo_parallel_only_when_not' as const, witness: yesWitness } : choice)),
      yes ? 'yes' : 'no',
      'A pair decides the lines only when the measures fit that pair.',
      UNIT3_RULE_IDS.converse,
      [yes ? 'The measures fit a pair that decides the lines.' : 'The measures do not fit a pair that decides the lines.'],
      seed,
    ),
    choiceStage(
      'b',
      'The fact',
      'Pick the fact that fits these two angles.',
      FACTS.map((choice) => (choice.id === factTrap ? { ...choice, trap: factTrapId, witness: factWitness } : choice)),
      fact,
      'Match the fact to the positions of the two numbered angles.',
      UNIT3_RULE_IDS.converse,
      ['The fact is the one that belongs to these two positions, and only if the measures agree.'],
      seed + 3,
    ),
  ]
  const prompt = `∠${a} = ${left}° and ∠${b} = ${right}°. Are lines m and n parallel? Name the fact that decides it.`
  const figure = transversalFigure(theta, delta, false, `Lines m and n are cut by a transversal. ${NUMBERING}`)
  const angles = [left, right].filter((n) => n > 0 && n < 180)
  return pack('parallelConverse', prompt, figure, stages, angles, stages.flatMap((s) => s.reveal), seed, 'Parallel or not', PICK, PARALLEL_RULES, {
    a,
    b,
    yes,
  })
}

function classifyBank(a: number, b: number): Rel {
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const hit = PAIR_BANK.find((row) => row.a === lo && row.b === hi)
  if (hit) return hit.rel
  const corr = new Set(['1,5', '2,6', '3,7', '4,8'])
  const altInt = new Set(['3,5', '4,6'])
  const altExt = new Set(['1,7', '2,8'])
  const ssi = new Set(['3,6', '4,5'])
  const vert = new Set(['1,3', '2,4', '5,7', '6,8'])
  const linear = new Set(['1,2', '2,3', '3,4', '1,4', '5,6', '6,7', '7,8', '5,8'])
  const key = `${lo},${hi}`
  if (corr.has(key)) return 'corr'
  if (altInt.has(key)) return 'alt-int'
  if (altExt.has(key)) return 'alt-ext'
  if (ssi.has(key)) return 'ssi'
  if (vert.has(key)) return 'vert'
  if (linear.has(key)) return 'linear'
  return 'none'
}

function finishConverseX(spec: SolveSpec, seed: number): GeoBuilt {
  const sameSide = (spec.a === 3 && spec.b === 6) || (spec.a === 4 && spec.b === 5)
  const rel: Rel = sameSide ? 'ssi' : classifyBank(spec.a, spec.b)
  if (!parallelFacts(rel)) throw new Error('not a parallel pair')
  const xRat = rat(spec.x, 1)
  const leftM = evalAt(spec.left, xRat)
  const rightM = evalAt(spec.right, xRat)
  if (leftM.d !== 1 || rightM.d !== 1) throw new Error('measures')
  if (!measuresFit(rel, leftM.n, rightM.n)) throw new Error('x does not make the lines parallel')
  const wrong = sameSide ? solveEqual(spec.left, spec.right) : solveEqual(lin(spec.left.a + spec.right.a, spec.left.b + spec.right.b), lin(0, 180))
  if (!wrong || (wrong.n === spec.x && wrong.d === 1)) throw new Error('trap collided')
  const theta = thetaFor(spec.a, leftM.n)
  if (Math.abs(measureAngle(theta, 0, spec.b) - rightM.n) > 1) throw new Error('figure')
  const id: ErrorPatternId = sameSide ? 'geo_same_side_congruent' : 'geo_congruent_as_same_side'
  const traps: Draft[] = [
    {
      id,
      stage: 'x',
      text: qText(wrong),
      witness: sameSide
        ? 'Those angles add to a straight angle. Setting them equal is a different relationship.'
        : 'Those angles match. Adding them to a straight angle is a different relationship.',
    },
  ]
  const fact = factFor(rel)
  const factTrap = fact === 'corr' ? 'alt-int' : 'corr'
  const factId: ErrorPatternId = rel === 'alt-ext' ? 'geo_alt_ext_corr_swapped' : rel === 'ssi' ? 'geo_same_side_congruent' : 'geo_alt_int_corr_swapped'
  const stages = [
    numberStage('x', 'x', X_HINT, String(spec.x), 'Write the equation these two positions need, then solve it.', UNIT3_RULE_IDS.converse, [`The positions give one equation, and it has one solution.`], traps),
    choiceStage(
      'result',
      'The fact',
      'Pick the fact that fits these two angles.',
      FACTS.map((choice) => (choice.id === factTrap ? { ...choice, trap: factId, witness: 'That fact is about a different pair than these two angles.' } : choice)),
      fact,
      'The fact names the positions of the two angles.',
      UNIT3_RULE_IDS.converse,
      ['Name the pair these two angles make.'],
      seed,
    ),
  ]
  const prompt = `∠${spec.a} = (${formatLin(spec.left)})° and ∠${spec.b} = (${formatLin(spec.right)})°. Find x so that lines m and n are parallel, and name the fact that decides it.`
  const figure = transversalFigure(theta, 0, false, `Lines m and n are cut by a transversal. ${NUMBERING}`)
  return pack('parallelConverse', prompt, figure, stages, [leftM.n, rightM.n], [`x = ${spec.x}.`, 'The fact is the pair these angles make.'], seed, 'Make the lines parallel', MIXED, PARALLEL_RULES, {
    a: spec.a,
    b: spec.b,
    findX: true,
  })
}

export function drawParallelConverse(seed: number): GeoBuilt {
  if (seed === 1) return finishConverseNumbers(4, 6, 70, 70, seed)
  if (seed === 2) return finishConverseNumbers(1, 3, 70, 70, seed)
  if (seed === 3) return finishConverseX({ a: 3, b: 6, left: lin(2, 10), right: lin(3, 20), x: 30, ask: 3 }, seed)
  let last = 'no candidate'
  for (let bump = 0; bump < 24; bump++) {
    try {
      const s = seed + bump
      if (s % 3 === 0) return finishConverseX(solveSpec(s, 0), seed)
      const pool = [
        [4, 6],
        [3, 5],
        [1, 5],
        [2, 8],
        [3, 6],
        [1, 3],
        [2, 4],
        [1, 2],
      ] as const
      const [a, b] = pool[s % pool.length]!
      const rel = classifyBank(a, b)
      const yes = s % 3 === 1 && parallelFacts(rel)
      let left = 40 + ((s * 3) % 40)
      let right = left
      if (rel === 'ssi') {
        left = 40 + ((s * 3) % 30)
        right = yes ? 180 - left : left
      } else if (parallelFacts(rel)) {
        right = yes ? left : left + 15
      } else if (rel === 'linear') {
        left = 50
        right = 130
      } else {
        right = left
      }
      if (right <= 0 || right >= 180 || left <= 0 || left >= 180) throw new Error('range')
      return finishConverseNumbers(a, b, left, right, seed)
    } catch (e) {
      last = e instanceof Error ? e.message : 'bad'
    }
  }
  throw new Error(`gl3.converse/${seed}: ${last}`)
}

// --- slopes ---------------------------------------------------------------------

function gridFigure(lines: { m: Rational | null; k: number }[], point: Pt | null, aria: string): GeoFigureSpec {
  const pts: { id: string; x: number; y: number; label?: string }[] = []
  const drawn: { through: [string, string] }[] = []
  let i = 0
  for (const line of lines) {
    const [p, q] = lineEnds(line.m, line.k, i)
    const a = `A${i}`
    const b = `B${i}`
    pts.push({ id: a, x: p.x, y: p.y }, { id: b, x: q.x, y: q.y })
    drawn.push({ through: [a, b] })
    i++
  }
  if (point) pts.push({ id: 'P', x: point.x, y: point.y, label: 'P' })
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const pad = 1
  return {
    ariaLabel: aria,
    grid: {
      xMin: Math.min(-1, ...xs) - pad,
      xMax: Math.max(1, ...xs) + pad,
      yMin: Math.min(-1, ...ys) - pad,
      yMax: Math.max(1, ...ys) + pad,
    },
    points: pts,
    lines: drawn,
  }
}

function lineEnds(m: Rational | null, k: number, salt: number): [Pt, Pt] {
  if (m === null) return [{ x: k, y: -1 }, { x: k, y: 3 }]
  if (ratToString(m) === '0') return [{ x: -2, y: k }, { x: 3, y: k }]
  const x1 = salt % 2 === 0 ? 0 : -1
  const x2 = x1 + m.d
  const y1 = r3((m.n / m.d) * x1 + k)
  const y2 = r3((m.n / m.d) * x2 + k)
  return [{ x: x1, y: y1 }, { x: x2, y: y2 }]
}

function slopeTraps(given: Rational | null, asked: 'parallel' | 'perp'): Draft[] {
  const right = asked === 'parallel' ? given : perpSlope(given)
  const traps: Draft[] = []
  const push = (id: ErrorPatternId, value: Rational | null, witness: string) => {
    const text = slopeText(value)
    if (text === slopeText(right)) return
    traps.push({ id, stage: 'result', text, witness })
  }
  if (asked === 'perp' && given && ratToString(given) !== '0') {
    push('geo_perp_reciprocal_only', reciprocalOnly(given), 'Flipping only the fraction, and not the sign, is a different slope.')
    push('geo_perp_sign_only', signOnly(given), 'Changing only the sign, and not flipping the fraction, is a different slope.')
    push('geo_lines_relation_swapped', given, 'That is the slope you were given. A right angle changes it.')
  } else if (asked === 'parallel' && given && ratToString(given) !== '0') {
    push('geo_lines_relation_swapped', perpSlope(given), 'That flip is the slope for a right angle. A line that does not meet this one keeps the slope.')
  }
  if (slopeText(right) === 'undefined') {
    push('geo_vertical_as_zero', rat(0, 1), 'A vertical line has no number for its slope. The number you wrote is the horizontal one.')
  }
  if (slopeText(right) === '0') {
    push('geo_vertical_as_zero', null, 'A horizontal line has a slope you can write down. A vertical line is the one with no slope number.')
  }
  return traps
}

function finishSlopeValue(prompt: string, answer: string, traps: Draft[], figure: GeoFigureSpec, seed: number, allowUndefined: boolean): GeoBuilt {
  if (traps.length === 0) throw new Error('no slope trap')
  const stage = numberStage(
    'result',
    'Slope',
    slopeHint(answer),
    answer,
    'Use the slope the question asks for. A right angle flips the fraction and changes the sign.',
    UNIT3_RULE_IDS.slope,
    ['The slope follows from the line in the problem.'],
    traps,
    { allowUndefined },
  )
  return pack('lineSlopes', prompt, figure, [stage], [], ['The slope is the one the question asked for.'], seed, 'Slope', TYPE, PARALLEL_RULES, { kind: 'slope' })
}

function finishEquation(given: Rational | null, k: number, px: number, py: number, dir: 'parallel' | 'perp', shown: string, seed: number): GeoBuilt {
  const slope = dir === 'parallel' ? given : perpSlope(given)
  const answer = lineText(slope, px, py)
  const original = lineText(given, 0, k)
  if (answer === original) throw new Error('point is on the given line')
  const traps: Draft[] = []
  if (dir === 'parallel') {
    traps.push({
      id: 'geo_parallel_kept_intercept',
      stage: 'result',
      text: original,
      witness: 'That equation still has the original line’s intercept, so it misses the point.',
    })
  } else if (given && ratToString(given) !== '0' && slope) {
    const flipped = lineText(reciprocalOnly(given), px, py)
    const signed = lineText(signOnly(given), px, py)
    if (flipped !== answer) {
      traps.push({ id: 'geo_perp_reciprocal_only', stage: 'result', text: flipped, witness: 'Flipping only the fraction, and not the sign, is a different line.' })
    }
    if (signed !== answer && signed !== flipped) {
      traps.push({ id: 'geo_perp_sign_only', stage: 'result', text: signed, witness: 'Changing only the sign, and not flipping the fraction, is a different line.' })
    }
  } else {
    const kept = lineText(given, px, py)
    if (kept !== answer) {
      traps.push({
        id: 'geo_vertical_as_zero',
        stage: 'result',
        text: kept,
        witness: 'A vertical line and a horizontal line are not the same. A right angle switches which one you have.',
      })
    }
  }
  if (traps.length === 0) throw new Error('no equation trap')
  const stage = lineStage(
    'Equation',
    answer,
    'Keep the slope the question asks for, then make the line contain the point.',
    UNIT3_RULE_IDS.line,
    ['The new line contains the given point and has the slope the question asks for.'],
    traps,
  )
  const word = dir === 'parallel' ? 'parallel' : 'perpendicular'
  const prompt = `What is an equation of the line that passes through (${px}, ${py}) and is ${word} to the line ${shown}?`
  const figure = gridFigure([{ m: given, k }], { x: px, y: py }, `A coordinate grid showing the line ${shown} and the point P (${px}, ${py}).`)
  return pack('lineSlopes', prompt, figure, [stage], [], stage.reveal, seed, 'Equation of a line', TYPE, PARALLEL_RULES, { kind: 'equation', dir })
}

function finishRelation(m1: Rational | null, k1: number, m2: Rational | null, k2: number, shown1: string, shown2: string, seed: number): GeoBuilt {
  const s1 = slopeText(m1)
  const s2 = slopeText(m2)
  let answer = 'neither'
  if (s1 === s2) answer = 'par'
  else if ((s1 === 'undefined' && s2 === '0') || (s2 === 'undefined' && s1 === '0')) answer = 'perp'
  else if (m1 && m2 && ratToString(ratMul(m1, m2)) === '-1') answer = 'perp'
  const trapId = answer === 'par' ? 'perp' : 'par'
  const stage = choiceStage(
    'a',
    'The lines',
    'Compare the two slopes.',
    LINE_REL.map((choice) =>
      choice.id === trapId
        ? { ...choice, trap: 'geo_lines_relation_swapped' as const, witness: 'Check whether the slopes match, multiply to −1, or do something else. A vertical line has no slope number.' }
        : choice,
    ),
    answer,
    'Same slope, a right angle between the lines, or something else.',
    UNIT3_RULE_IDS.slope,
    ['Compare the slopes, including a line with no slope number.'],
    seed,
  )
  const prompt = `The line ${shown1} and the line ${shown2} are drawn. Are the lines parallel, perpendicular, or neither?`
  const figure = gridFigure(
    [
      { m: m1, k: k1 },
      { m: m2, k: k2 },
    ],
    null,
    `A coordinate grid showing ${shown1} and ${shown2}.`,
  )
  return pack('lineSlopes', prompt, figure, [stage], [], stage.reveal, seed, 'Parallel or perpendicular', PICK, PARALLEL_RULES, { kind: 'relation' })
}

export function drawLineSlopes(seed: number): GeoBuilt {
  if (seed === 1) {
    const m = rat(2, 1)
    return finishSlopeValue(
      'What is the slope of a line perpendicular to the line y = 2x + 3?',
      '-1/2',
      [{ id: 'geo_perp_reciprocal_only', stage: 'result', text: '1/2', witness: 'Flipping only the fraction, and not the sign, is a different slope.' }],
      gridFigure([{ m, k: 3 }], null, 'A coordinate grid showing the line y = 2x + 3.'),
      seed,
      false,
    )
  }
  if (seed === 2) {
    return finishEquation(rat(2, 1), 3, 1, 4, 'parallel', 'y = 2x + 3', seed)
  }
  if (seed === 3) {
    const m = rat(3, 1)
    return finishSlopeValue(
      'What is the slope of a line perpendicular to the line y = 3x − 1?',
      '-1/3',
      [{ id: 'geo_perp_sign_only', stage: 'result', text: '-3', witness: 'Changing only the sign, and not flipping the fraction, is a different slope.' }],
      gridFigure([{ m, k: -1 }], null, 'A coordinate grid showing the line y = 3x − 1.'),
      seed,
      false,
    )
  }
  if (seed === 4) {
    return finishRelation(rat(2, 1), 1, rat(2, 1), -4, 'y = 2x + 1', 'y = 2x − 4', seed)
  }
  if (seed === 5) {
    return finishSlopeValue(
      'What is the slope of a line parallel to the line x = 2?',
      'undefined',
      [{ id: 'geo_vertical_as_zero', stage: 'result', text: '0', witness: 'A vertical line has no number for its slope. The number you wrote is the horizontal one.' }],
      gridFigure([{ m: null, k: 2 }], null, 'A coordinate grid showing the vertical line x = 2.'),
      seed,
      true,
    )
  }
  let last = 'no candidate'
  for (let bump = 0; bump < 20; bump++) {
    try {
      return finishSlopeGeneral(seed, bump)
    } catch (e) {
      last = e instanceof Error ? e.message : 'bad'
    }
  }
  throw new Error(`gl3.slopes/${seed}: ${last}`)
}

function finishSlopeGeneral(seed: number, bump: number): GeoBuilt {
  const s = seed + bump * 3
  const kind = s % 5
  const m = SLOPES[s % SLOPES.length]!
  const k = [1, 2, 3, 5, 6, -2, -3, 8][s % 8]!
  const dir: 'parallel' | 'perp' = s % 2 === 0 ? 'perp' : 'parallel'
  if (kind === 4 || s % 11 === 0) {
    const vertical = s % 2 === 0
    const given = vertical ? null : rat(0, 1)
    const kk = vertical ? 2 + (s % 3) : 3 + (s % 3)
    if (dir === 'parallel' && kind !== 3) {
      const asked = 'parallel' as const
      const answer = slopeText(given)
      return finishSlopeValue(
        `What is the slope of a line parallel to the line ${showGiven(given, kk)}?`,
        answer,
        slopeTraps(given, asked),
        gridFigure([{ m: given, k: kk }], null, `A coordinate grid showing ${showGiven(given, kk)}.`),
        seed,
        answer === 'undefined' || slopeTraps(given, asked).some((t) => t.text === 'undefined'),
      )
    }
    const px = 4 + (s % 2)
    const py = 1
    return finishEquation(given, kk, px, py, dir === 'parallel' ? 'perp' : 'parallel', showGiven(given, kk), seed)
  }
  if (kind === 0) {
    const shown = s % 8 === 0 && ratToString(m) !== '0' ? showStandard(m, k) : showGiven(m, k)
    const answer = slopeText(dir === 'parallel' ? m : perpSlope(m))
    const traps = slopeTraps(m, dir)
    const word = dir === 'parallel' ? 'parallel' : 'perpendicular'
    return finishSlopeValue(
      `What is the slope of a line ${word} to the line ${shown}?`,
      answer,
      traps,
      gridFigure([{ m, k }], null, `A coordinate grid showing the line ${shown}.`),
      seed,
      answer === 'undefined' || traps.some((t) => t.text === 'undefined'),
    )
  }
  if (kind === 1) {
    const x1 = 0
    const y1 = 1 + (s % 3)
    const x2 = x1 + m.d
    const y2 = y1 + m.n
    const answer = slopeText(dir === 'parallel' ? m : perpSlope(m))
    const traps = slopeTraps(m, dir)
    const word = dir === 'parallel' ? 'parallel' : 'perpendicular'
    return finishSlopeValue(
      `What is the slope of a line ${word} to the line through (${x1}, ${y1}) and (${x2}, ${y2})?`,
      answer,
      traps,
      gridFigure([{ m, k: y1 - (m.n / m.d) * x1 }], null, `A coordinate grid showing the line through (${x1}, ${y1}) and (${x2}, ${y2}).`),
      seed,
      answer === 'undefined' || traps.some((t) => t.text === 'undefined'),
    )
  }
  if (kind === 2) {
    const mode = s % 3
    if (mode === 0) return finishRelation(m, k, m, k + 2 + (s % 2), showGiven(m, k), showGiven(m, k + 2 + (s % 2)), seed)
    if (mode === 1) {
      const p = perpSlope(m)
      const k2 = k + 3
      return finishRelation(m, k, p, p === null ? 2 : k2, showGiven(m, k), showGiven(p, p === null ? 2 : k2), seed)
    }
    const other = SLOPES[(s + 3) % SLOPES.length]!
    if (ratToString(other) === ratToString(m) || (perpSlope(m) && ratToString(other) === ratToString(perpSlope(m)!))) throw new Error('not neither')
    return finishRelation(m, k, other, k + 1, showGiven(m, k), showGiven(other, k + 1), seed)
  }
  const px = 1 + (s % 3)
  const py = 4 + (s % 2)
  const on = m === null ? px === k : Math.abs(py - (m.n / m.d) * px - k) < 1e-9
  if (on) throw new Error('point on line')
  const shown = s % 5 === 0 ? showStandard(m, k) : showGiven(m, k)
  return finishEquation(m, k, px, py, dir, shown, seed)
}

// --- triangles ------------------------------------------------------------------

function triangleFigure(A: number, B: number, C: number, labels: { A?: string; B?: string; C?: string; E?: string }): GeoFigureSpec {
  const AB = (5 * Math.sin(rad(C))) / Math.sin(rad(A))
  const ax = r3(AB * Math.cos(rad(B)))
  const ay = r3(AB * Math.sin(rad(B)))
  const pts: Record<string, Pt> = {
    B: { x: 0, y: 0 },
    C: { x: 5, y: 0 },
    A: { x: ax, y: ay },
  }
  if (labels.E) pts.D = { x: 7, y: 0 }
  const at = (id: string) => pts[id]!
  const gotA = wedge(at('A'), at('B'), at('C'))
  const gotB = wedge(at('B'), at('A'), at('C'))
  const gotC = wedge(at('C'), at('B'), at('A'))
  if (Math.abs(gotA - A) > 1.2 || Math.abs(gotB - B) > 1.2 || Math.abs(gotC - C) > 1.2) {
    throw new Error(`triangle drew ${gotA.toFixed(1)}, ${gotB.toFixed(1)}, ${gotC.toFixed(1)}`)
  }
  if (labels.E && Math.abs(wedge(at('C'), at('D'), at('A')) - (A + B)) > 1.2) throw new Error('exterior arc missed')
  const angles = [
    ...(labels.A ? [{ vertex: 'A', from: 'B', to: 'C', label: labels.A, radius: 22 }] : []),
    ...(labels.B ? [{ vertex: 'B', from: 'A', to: 'C', label: labels.B, radius: 22 }] : []),
    ...(labels.C ? [{ vertex: 'C', from: 'B', to: 'A', label: labels.C, radius: 26 }] : []),
    ...(labels.E ? [{ vertex: 'C', from: 'D', to: 'A', label: labels.E, radius: 36 }] : []),
  ]
  return {
    ariaLabel: labels.E
      ? 'Triangle ABC with side BC extended through C to D, and the given angles labeled.'
      : 'Triangle ABC with the given interior angles labeled.',
    points: [
      { id: 'A', x: ax, y: ay, label: 'A', labelSide: 'above' },
      { id: 'B', x: 0, y: 0, label: 'B', labelSide: 'below' },
      { id: 'C', x: 5, y: 0, label: 'C', labelSide: 'below' },
      ...(labels.E ? [{ id: 'D', x: 7, y: 0, label: 'D', labelSide: 'below' as const }] : []),
    ],
    segments: [
      { from: 'A', to: 'B' },
      { from: 'A', to: 'C' },
      { from: 'B', to: 'C' },
    ],
    rays: labels.E ? [{ from: 'C', through: 'D' }] : [],
    angles,
  }
}

function finishTriangleSum(angles: [number, number, number], exprs: [Lin, Lin, Lin], x: number, ask: 0 | 1 | 2, seed: number): GeoBuilt {
  const names = ['A', 'B', 'C'] as const
  const wrong = solveEqual(lin(exprs[0].a + exprs[1].a + exprs[2].a, exprs[0].b + exprs[1].b + exprs[2].b), lin(0, 540))
  if (!wrong || (wrong.d === 1 && wrong.n === x)) throw new Error('trap collided')
  const asked = angles[ask]
  const traps: Draft[] = [
    {
      id: 'geo_interior_sum_n180',
      stage: 'x',
      text: qText(wrong),
      witness: 'A triangle has one straight angle in total, not one for each of its three angles.',
    },
  ]
  const labels = {
    A: angleLabel(exprs[0]),
    B: angleLabel(exprs[1]),
    C: angleLabel(exprs[2]),
  }
  const prompt = `In △ABC, m∠A = (${formatLin(exprs[0])})°, m∠B = (${formatLin(exprs[1])})°, and m∠C = (${formatLin(exprs[2])})°. Find x, then m∠${names[ask]}.`
  const figure = triangleFigure(angles[0], angles[1], angles[2], labels)
  const stages = [
    numberStage('x', 'x', X_HINT, String(x), 'The three angles of a triangle make one straight angle.', UNIT3_RULE_IDS.triangle, [`The three expressions add to a straight angle, so x = ${x}.`], traps),
    numberStage('result', `m∠${names[ask]}`, DEG_HINT, String(asked), 'Put the value of x into the expression for this angle.', UNIT3_RULE_IDS.triangle, [`m∠${names[ask]} uses the x you found.`], []),
  ]
  return pack('triangleAngles', prompt, figure, stages, [...angles], [`x = ${x}.`, `m∠${names[ask]} = ${asked}.`], seed, 'Triangle angles', TYPE, POLYGON_RULES, { kind: 'sum' })
}

function finishExterior(remote1: Lin, remote2: Lin, exterior: Lin, x: number, seed: number): GeoBuilt {
  const xRat = rat(x, 1)
  const A = evalAt(remote1, xRat)
  const B = evalAt(remote2, xRat)
  const E = evalAt(exterior, xRat)
  if (A.d !== 1 || B.d !== 1 || E.d !== 1) throw new Error('not integers')
  if (A.n + B.n !== E.n) throw new Error('exterior theorem failed')
  const C = 180 - E.n
  if (A.n <= 0 || B.n <= 0 || C <= 0 || E.n <= 0 || E.n >= 180 || C >= 180) throw new Error('angle range')
  const adjacent = solveEqual(exterior, lin(-(remote1.a + remote2.a), 180 - remote1.b - remote2.b))
  const allThree = solveEqual(lin(remote1.a + remote2.a + exterior.a, remote1.b + remote2.b + exterior.b), lin(0, 180))
  const traps: Draft[] = []
  if (adjacent && !(adjacent.n === x && adjacent.d === 1)) {
    traps.push({
      id: 'geo_exterior_adjacent',
      stage: 'x',
      text: qText(adjacent),
      witness: 'The angle beside the exterior adds with it to a straight angle. The exterior equals the two angles that are not beside it.',
    })
  }
  if (allThree && !(allThree.n === x && allThree.d === 1) && (!adjacent || qText(allThree) !== qText(adjacent))) {
    traps.push({
      id: 'geo_exterior_adjacent',
      stage: 'x',
      text: qText(allThree),
      witness: 'Adding the exterior in with the two remote angles treats it as a third interior angle. It equals the two that are not beside it.',
    })
  }
  if (traps.length === 0) throw new Error('no exterior trap')
  const prompt = `The exterior angle at C of △ABC measures (${formatLin(exterior)})°. The remote interior angles measure (${formatLin(remote1)})° and (${formatLin(remote2)})°. Find x, then the exterior angle.`
  const figure = triangleFigure(A.n, B.n, C, {
    A: angleLabel(remote1),
    B: angleLabel(remote2),
    E: angleLabel(exterior),
  })
  const stages = [
    numberStage('x', 'x', X_HINT, String(x), 'The exterior angle equals the two interior angles that are not beside it.', UNIT3_RULE_IDS.triangle, [`The exterior equals the two remote angles, so x = ${x}.`], traps),
    numberStage('result', 'The exterior angle', DEG_HINT, String(E.n), 'Put the value of x into the exterior angle.', UNIT3_RULE_IDS.triangle, ['The exterior angle uses the x you found.'], []),
  ]
  return pack('triangleAngles', prompt, figure, stages, [A.n, B.n, C, E.n], [`x = ${x}.`, `The exterior angle is ${E.n}°.`], seed, 'Exterior angle', TYPE, POLYGON_RULES, { kind: 'exterior' })
}

export function drawTriangleAngles(seed: number): GeoBuilt {
  // (3x + 2) + (2x + 1) is 5x + 3, so the exterior has to be a different expression. x = 8 is the only solution.
  if (seed === 1) return finishExterior(lin(3, 2), lin(2, 1), lin(6, -5), 8, seed)
  if (seed === 2) return finishTriangleSum([40, 60, 80], [lin(2, 0), lin(3, 0), lin(4, 0)], 20, 1, seed)
  let last = 'no candidate'
  for (let bump = 0; bump < 24; bump++) {
    try {
      const s = seed + bump
      const x = XS[(s - 1) % XS.length]!
      if (s % 2 === 0) {
        let A = 28 + ((s * 3) % 30)
        let B = 30 + ((s * 5) % 28)
        if (A + B >= 150) B = 24
        const E = A + B
        if (E === 90 || E >= 170) throw new Error('skip')
        const exprs = [fitExpr(A, x, s), fitExpr(B, x, s + 2), fitExpr(E, x, s + 4)] as [Lin, Lin, Lin]
        return finishExterior(exprs[0], exprs[1], exprs[2], x, seed)
      }
      let A = 30 + ((s * 3) % 25)
      let B = 34 + ((s * 5) % 25)
      let C = 180 - A - B
      if (C < 25) {
        A = 40
        B = 50
        C = 90
      }
      if (C >= 180 || A >= 180 || B >= 180) throw new Error('range')
      const exprs: [Lin, Lin, Lin] = [fitExpr(A, x, s), fitExpr(B, x, s + 3), fitExpr(C, x, s + 6)]
      const ask = (s % 3) as 0 | 1 | 2
      return finishTriangleSum([A, B, C], exprs, x, ask, seed)
    } catch (e) {
      last = e instanceof Error ? e.message : 'bad'
    }
  }
  throw new Error(`gpa.triangle/${seed}: ${last}`)
}

// --- polygons -------------------------------------------------------------------

function polygonPoints(n: number): Pt[] {
  const r = 2.2
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const ang = Math.PI / 2 + (2 * Math.PI * i) / n
    pts.push({ x: r3(r * Math.cos(ang)), y: r3(r * Math.sin(ang)) })
  }
  let sign = 0
  for (let i = 0; i < n; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % n]!
    const c = pts[(i + 2) % n]!
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(cross) < 1e-4) throw new Error('flat polygon')
    const s = Math.sign(cross)
    if (sign === 0) sign = s
    else if (s !== sign) throw new Error('not convex')
  }
  return pts
}

function polygonFigure(n: number, aria: string, mark?: { label: string; exterior: boolean }): GeoFigureSpec {
  const pts = polygonPoints(n)
  const points = pts.map((p, i) => ({ id: `V${i}`, x: p.x, y: p.y }))
  const segments = pts.map((_, i) => ({ from: `V${i}`, to: `V${(i + 1) % n}` }))
  const angles: GeoFigureSpec['angles'] = []
  const rays: GeoFigureSpec['rays'] = []
  if (mark && !mark.exterior) {
    angles.push({ vertex: 'V1', from: 'V0', to: 'V2', label: mark.label, radius: 22 })
  } else if (mark?.exterior) {
    const v0 = pts[0]!
    const v1 = pts[1]!
    const len = Math.hypot(v1.x - v0.x, v1.y - v0.y) || 1
    const ex = r3(v1.x + ((v1.x - v0.x) / len) * 0.9)
    const ey = r3(v1.y + ((v1.y - v0.y) / len) * 0.9)
    points.push({ id: 'E', x: ex, y: ey })
    rays.push({ from: 'V1', through: 'E' })
    angles.push({ vertex: 'V1', from: 'E', to: 'V2', label: mark.label, radius: 22 })
    const got = wedge({ x: v1.x, y: v1.y }, { x: ex, y: ey }, pts[2]!)
    const want = 360 / n
    if (Math.abs(got - want) > 2 && Math.abs(got - (180 - want)) < 2) throw new Error('exterior arc is the interior')
    if (Math.abs(got - want) > 2) throw new Error(`exterior arc ${got.toFixed(1)} want ${want}`)
  }
  return { ariaLabel: aria, points, segments, rays, angles }
}

function intAnswer(n: number, which: 'sum' | 'each-int' | 'each-ext' | 'ext-sum'): { text: string; trap: string; id: ErrorPatternId; angles: number[] } {
  if (which === 'sum') {
    const value = (n - 2) * 180
    return { text: String(value), trap: String(n * 180), id: 'geo_interior_sum_n180', angles: [] }
  }
  if (which === 'ext-sum') {
    if (n === 4) throw new Error('exterior sum trap equals the answer')
    return { text: '360', trap: String((n - 2) * 180), id: 'geo_exterior_sum_as_interior', angles: [] }
  }
  if (which === 'each-ext') {
    const value = rat(360, n)
    const trap = rat(180, n)
    if (ratToString(value) === ratToString(trap)) throw new Error('trap collided')
    const angles = value.d === 1 && value.n > 0 && value.n < 180 ? [value.n] : []
    return { text: ratToString(value), trap: ratToString(trap), id: 'geo_exterior_180_over_n', angles }
  }
  const value = rat((n - 2) * 180, n)
  const trap = String((n - 2) * 180)
  if (ratToString(value) === trap) throw new Error('trap collided')
  const angles = value.d === 1 && value.n > 0 && value.n < 180 ? [value.n] : []
  return { text: ratToString(value), trap, id: 'geo_interior_not_divided', angles }
}

function finishPolygonAsk(n: number, which: 'sum' | 'each-int' | 'each-ext' | 'ext-sum', seed: number): GeoBuilt {
  const solved = intAnswer(n, which)
  const regular = which === 'each-int' || which === 'each-ext'
  const noun = regular ? 'regular' : 'convex'
  const what =
    which === 'sum'
      ? `What is the sum of the interior angles of a convex ${n}-gon?`
      : which === 'each-int'
        ? `What is each interior angle of a regular ${n}-gon?`
        : which === 'each-ext'
          ? `What is each exterior angle of a regular ${n}-gon?`
          : `What is the sum of the exterior angles of a convex ${n}-gon, one at each vertex?`
  const label = which === 'sum' || which === 'ext-sum' ? 'The sum' : 'Each angle'
  const nudge =
    which === 'ext-sum'
      ? 'One exterior angle at each vertex makes a full turn.'
      : which === 'each-ext'
        ? 'A full turn is shared equally by the sides.'
        : which === 'each-int'
          ? 'Find the interior sum, then share it equally.'
          : 'Use a straight angle for each side after the first two.'
  const witness =
    solved.id === 'geo_interior_sum_n180'
      ? 'That count uses one straight angle for every side. The first two sides do not add another straight angle.'
      : solved.id === 'geo_interior_not_divided'
        ? 'That is the sum of the interior angles. Each one is that sum shared equally.'
        : solved.id === 'geo_exterior_180_over_n'
          ? 'Each exterior angle is a full turn shared by the sides, not a straight angle shared by the sides.'
          : 'That sum grows with the number of sides. One exterior angle at each vertex makes a full turn.'
  const card = which === 'ext-sum' || which === 'each-ext' ? UNIT3_RULE_IDS.exterior : UNIT3_RULE_IDS.polygon
  const stage = numberStage('result', label, DEG_HINT, solved.text, nudge, card, ['The polygon in the question has one answer.'], [
    { id: solved.id, stage: 'result', text: solved.trap, witness },
  ])
  const figure = polygonFigure(n, `A ${noun} ${n}-gon.`)
  return pack('polygonAngles', what, figure, [stage], solved.angles, stage.reveal, seed, 'Polygon angles', TYPE, POLYGON_RULES, { n, which })
}

function finishSides(kind: 'int' | 'ext', degrees: number, seed: number): GeoBuilt {
  const n = kind === 'ext' ? 360 / degrees : 360 / (180 - degrees)
  if (!Number.isInteger(n) || n < 3 || n > 20) throw new Error('n')
  const trap = kind === 'ext' ? rat(180, degrees) : rat(360, degrees)
  const trapText = ratToString(trap)
  if (trapText === String(n)) throw new Error('trap collided')
  const id: ErrorPatternId = kind === 'ext' ? 'geo_sides_from_exterior_180' : 'geo_sides_from_interior_360'
  const witness =
    kind === 'ext'
      ? 'The number of sides is a full turn divided by one exterior angle. A straight angle is only half of that turn.'
      : 'Dividing a full turn by the interior angle uses the inside angle. Use the turn at the vertex, which is a straight angle minus that interior angle.'
  const prompt =
    kind === 'ext'
      ? `Each exterior angle of a regular polygon measures ${degrees}°. How many sides does it have?`
      : `Each interior angle of a regular polygon measures ${degrees}°. How many sides does it have?`
  const stage = numberStage('result', 'The number of sides', SIDES_HINT, String(n), witness, UNIT3_RULE_IDS.exterior, ['The number of sides comes from a full turn and one exterior angle.'], [
    { id, stage: 'result', text: trapText, witness },
  ])
  const figure = polygonFigure(n, `A regular polygon with one ${kind === 'ext' ? 'exterior' : 'interior'} angle marked ${degrees} degrees.`, {
    label: `${degrees}°`,
    exterior: kind === 'ext',
  })
  return pack('polygonAngles', prompt, figure, [stage], kind === 'ext' || (degrees > 0 && degrees < 180) ? [degrees] : [], stage.reveal, seed, 'How many sides', TYPE, POLYGON_RULES, {
    n,
    which: kind,
  })
}

export function drawPolygonAngles(seed: number): GeoBuilt {
  if (seed === 1) return finishPolygonAsk(7, 'sum', seed)
  if (seed === 2) return finishPolygonAsk(8, 'each-int', seed)
  if (seed === 3) return finishPolygonAsk(6, 'each-ext', seed)
  if (seed === 4) return finishSides('int', 120, seed)
  if (seed === 5) return finishPolygonAsk(10, 'ext-sum', seed)
  let last = 'no candidate'
  for (let bump = 0; bump < 24; bump++) {
    try {
      const s = seed + bump
      const mode = s % 6
      if (mode === 0) return finishPolygonAsk(3 + ((s * 2) % 18), 'sum', seed)
      if (mode === 1) return finishPolygonAsk(DIVISORS[s % DIVISORS.length]!, 'each-int', seed)
      if (mode === 2) {
        const n = DIVISORS[s % DIVISORS.length]!
        if (n === 4) throw new Error('skip square exterior')
        return finishPolygonAsk(n, 'each-ext', seed)
      }
      if (mode === 3) {
        const options = DIVISORS.filter((n) => n !== 4)
        const n = options[s % options.length]!
        return finishSides('int', 180 - 360 / n, seed)
      }
      if (mode === 4) {
        const n = DIVISORS[s % DIVISORS.length]!
        return finishSides('ext', 360 / n, seed)
      }
      const n = 3 + ((s * 3) % 18)
      if (n === 4) throw new Error('skip')
      return finishPolygonAsk(n, 'ext-sum', seed)
    } catch (e) {
      last = e instanceof Error ? e.message : 'bad'
    }
  }
  throw new Error(`gpa.polygon/${seed}: ${last}`)
}
