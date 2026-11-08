/**
 * Shared gate for honors geometry Unit 8 (circles). Exact lengths and degree measures go through Unit 7's stage
 * builder; the reserved answers are this unit's (47, not 43 or 90), because an inscribed angle really can be 43
 * and a chord angle really can be 90. A trap that copies a given stays only for the slips that ARE that copy.
 */
import { ERROR_PATTERNS } from '@/engine'
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { GeometryAnswer, GeometryQuestion, GeometryStageId, RuleCard } from '@/content/types'
import type { ErrorPatternId, GeoAngleMark, GeoFigureSpec, GeoPoint, GeoSegment } from '@/shared/types'
import { formatPoint, formatQty, readGeoAnswer, sameGeoValue, type GeoQty } from './answer'
import type { GeoBuilt } from './build'
import { assertGeoAnswer, exampleShowsAnswer, gradeGeoStage, isGeoMistake, stageDisplay } from './grade'
import { GEO_RULE_FOR } from './rules'
import { englishIssues } from './unit5Build'
import { readTexts, settlePointSides } from './unit6Build'
import {
  choiceStage7,
  exactStage7,
  figureIssues7,
  givenValues7,
  int,
  pointOf,
  qSay,
  rad,
  screenTexts7,
  shows7,
  sqrtQ,
  type P2,
  type Stage7,
  type TrapDraft7,
} from './unit7Build'
import { formatLin, showPt, type Lin } from './expr'

export const DEG_HINT8 = 'A whole number of degrees, like 47.'
export const LEN_HINT8 = 'A whole number or a simplest radical, like 47 or 3√11.'
export const POINT_HINT8 = 'A point, like (8, 13).'
export const PICK_HINT8 = 'Pick one.'

const RESERVED_NUM = new Set([0, 1, 47])
const RESERVED_TEXT = new Set(['3√11', '(3√11)/2', '(8, 13)', '(8, −13)'])

/** Slips whose wrong number is a number the problem already printed. */
const KEEP_GIVEN = new Set<ErrorPatternId>([
  'geo_inscribed_not_halved',
  'geo_arc_not_doubled',
  'geo_major_minor_swapped',
  'geo_cyclic_not_supplementary',
  'geo_radius_unsquared',
  'geo_semicircle_as_quarter',
  'geo_circumscribed_adjacent',
])

export let lastRefuse = ''

export const MINUS = '\u2212'

export function polar(r: number, deg: number): P2 {
  const t = (deg * Math.PI) / 180
  return { x: r * Math.cos(t), y: r * Math.sin(t) }
}

export function add(a: P2, b: P2): P2 {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function mul(a: P2, k: number): P2 {
  return { x: a.x * k, y: a.y * k }
}

export function dot(a: P2, b: P2): number {
  return a.x * b.x + a.y * b.y
}

export function hypot(a: P2): number {
  return Math.hypot(a.x, a.y)
}

export function sub(a: P2, b: P2): P2 {
  return { x: a.x - b.x, y: a.y - b.y }
}

/** Smallest angle at v, in degrees. */
export function angleDeg(v: P2, a: P2, b: P2): number {
  const u = sub(a, v)
  const w = sub(b, v)
  const c = dot(u, w) / (hypot(u) * hypot(w) || 1)
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI
}

/** Intersection of lines AB and CD, or null when they are parallel. */
export function lineCross(a: P2, b: P2, c: P2, d: P2): P2 | null {
  const rx = b.x - a.x
  const ry = b.y - a.y
  const sx = d.x - c.x
  const sy = d.y - c.y
  const den = rx * sy - ry * sx
  if (Math.abs(den) < 1e-9) return null
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den
  return { x: a.x + t * rx, y: a.y + t * ry }
}

/** Strictly between a and b, not on top of either end. */
export function strictlyBetween(p: P2, a: P2, b: P2): boolean {
  const ab = sub(b, a)
  const len2 = dot(ab, ab)
  if (len2 < 1e-12) return false
  const t = dot(sub(p, a), ab) / len2
  if (t <= 0.04 || t >= 0.96) return false
  const foot = add(a, mul(ab, t))
  return hypot(sub(p, foot)) < 1e-6
}

export function dist(a: P2, b: P2): number {
  return hypot(sub(a, b))
}

/** A turn that is not on an axis, so the rim point has a real quadrant. */
export function offAxis(rng: Rng): number {
  const q = rng.int(0, 3)
  return q * 90 + rng.int(16, 74)
}

/** Rotate `p` around `origin` by `deg` degrees. */
export function spin(p: P2, origin: P2, deg: number): P2 {
  const t = (deg * Math.PI) / 180
  const x = p.x - origin.x
  const y = p.y - origin.y
  return { x: origin.x + x * Math.cos(t) - y * Math.sin(t), y: origin.y + x * Math.sin(t) + y * Math.cos(t) }
}

/** Degrees to spin `p` around `center` so it sits on ray `turn`. */
export function aimDelta(p: P2, center: P2, turn: number): number {
  return turn - (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI
}

export function pack(spec: GeoFigureSpec): GeoFigureSpec | null {
  if (spec.points.length === 0 || !spec.ariaLabel.trim()) {
    lastRefuse = 'figure: empty'
    return null
  }
  const settled = settlePointSides(spec)
  const issues = figureIssues7(settled)
  if (issues.length > 0) {
    lastRefuse = `figure: ${issues[0]}`
    return null
  }
  return settled
}

/** Try the grid, then the same picture without it. A numbered grid is never required. */
export function packLoose(spec: GeoFigureSpec): GeoFigureSpec | null {
  const first = pack(spec)
  if (first) return first
  if (!spec.grid) return null
  return pack({ ...spec, grid: undefined })
}

export interface Trap8 {
  id: ErrorPatternId
  value: GeoQty
  witness: string
}

function qtySame(a: string, b: string): boolean {
  const ra = readGeoAnswer(a)
  const rb = readGeoAnswer(b)
  return ra.ok && rb.ok && sameGeoValue(ra.value, rb.value)
}

/** A number part. Degree parts welcome a degree sign. Traps that equal a given are dropped unless the slip is that copy. */
export function numStage(opts: {
  id: GeometryStageId
  label: string
  answer: GeoQty
  deg?: boolean
  nudge: string
  ruleCard: string
  reveal: string[]
  traps: readonly Trap8[]
  givens?: readonly GeoQty[]
}): Stage7 {
  const givens = opts.givens ?? []
  const drafts: TrapDraft7[] = []
  for (const t of opts.traps) {
    const text = formatQty(t.value)
    if (t.value.n <= 0) continue
    if (qtySame(text, formatQty(opts.answer))) continue
    if (!KEEP_GIVEN.has(t.id) && givens.some((g) => qtySame(formatQty(g), text))) continue
    drafts.push({ id: t.id, stage: opts.id, value: t.value, witness: t.witness })
  }
  const stage = exactStage7({
    id: opts.id,
    label: opts.label,
    hint: opts.deg ? DEG_HINT8 : LEN_HINT8,
    answer: opts.answer,
    nudge: opts.nudge,
    ruleCard: opts.ruleCard,
    reveal: opts.reveal,
    traps: drafts,
    givens: [],
  })
  return opts.deg ? { ...stage, unit: 'deg' } : stage
}

export function pointStage(opts: {
  id: GeometryStageId
  label: string
  x: GeoQty
  y: GeoQty
  nudge: string
  ruleCard: string
  reveal: string[]
  traps: { id: ErrorPatternId; x: GeoQty; y: GeoQty; witness: string }[]
}): Stage7 {
  const answerText = formatPoint(opts.x, opts.y)
  const traps = opts.traps
    .map((t) => ({ id: t.id, text: formatPoint(t.x, t.y), witness: t.witness }))
    .filter((t) => t.text !== answerText)
  const seen = new Set<string>()
  const unique = traps.filter((t) => (seen.has(t.text) ? false : (seen.add(t.text), true)))
  return {
    id: opts.id,
    kind: 'point',
    label: opts.label,
    hint: POINT_HINT8,
    answerText,
    nudge: opts.nudge,
    ruleCard: opts.ruleCard,
    reveal: opts.reveal,
    traps: unique,
  }
}

export function pickStage(opts: {
  id: GeometryStageId
  label: string
  choices: { id: string; text: string; trap?: ErrorPatternId; witness?: string }[]
  answerId: string
  nudge: string
  ruleCard: string
  reveal: string[]
  seed: number
  salt: number
}): Stage7 {
  return choiceStage7(opts)
}

function answerQty(stage: Stage7): GeoQty | null {
  if (stage.kind !== 'number') return null
  const r = readGeoAnswer(stage.answerText)
  if (!r.ok || r.value.kind !== 'qty') return null
  return r.value.q
}

function retries(stage: Stage7): string[] {
  if (stage.kind === 'choice') return ['', 'not-a-choice']
  const out = ['???', '1001', '0.001', `${stage.answerText}°`]
  const read = readGeoAnswer(stage.answerText)
  if (!read.ok || read.value.kind !== 'qty') return out
  const q = read.value.q
  if (q.rad > 1 && q.n / q.d > 1 && q.d === 1) out.push(`sqrt(${q.n * q.n * q.rad})`)
  return out
}

function leakOf8(answer: GeometryAnswer, cards: readonly RuleCard[]): string | null {
  const displays = answer.stages.map((stage) => stageDisplay(stage))
  for (const stage of answer.stages) {
    const display = stageDisplay(stage)
    if (RESERVED_TEXT.has(display) || RESERVED_TEXT.has(display.replace(/-/g, '−'))) return `answer ${display} is reserved`
    const q = answerQty(stage)
    if (q && q.rad === 1 && RESERVED_NUM.has(q.n / q.d)) return `answer ${display} is reserved`
    if (q && !(q.n > 0)) return `answer ${display} is not positive`
  }
  const screenBlob = screenTexts7(answer).join('\n')
  for (const display of displays) if (shows7(screenBlob, display)) return `“${display}” is on screen before she answers`
  const given = givenValues7(answer)
  for (const stage of answer.stages) {
    const q = answerQty(stage)
    if (!q) continue
    if (given.some((g) => sameGeoValue({ kind: 'qty', q: g }, { kind: 'qty', q }))) return `${stage.id} answer ${stage.answerText} is a number the problem gives`
  }
  for (let i = 0; i < answer.stages.length; i++) {
    for (let j = i + 1; j < answer.stages.length; j++) {
      for (const line of answer.stages[i]!.reveal) if (shows7(line, displays[j]!)) return `${answer.stages[i]!.id} worked line shows the later answer ${displays[j]}`
    }
  }
  for (const [index, stage] of answer.stages.entries()) {
    const display = stageDisplay(stage)
    for (const text of retries(stage)) {
      const grade = gradeGeoStage(answer, stage.id, text)
      if (grade.verdict === 'correct') {
        if (text === '???' || text === '1001' || text === '0.001' || text === '' || text === 'not-a-choice') return `${stage.id} accepts nonsense`
        continue
      }
      const said = grade.verdict === 'mistake' ? grade.witness : grade.message
      for (const other of displays.slice(index)) if (shows7(said, other)) return `${stage.id} message for “${text}” shows “${other}”`
    }
    for (const trap of stage.traps) {
      if (!isGeoMistake(trap.id)) return `${trap.id} is not a geometry mistake`
      for (const other of displays) if (shows7(trap.witness, other)) return `${stage.id} ${trap.id} witness shows “${other}”`
      const info = ERROR_PATTERNS[trap.id]
      if (shows7(`${info.title}\n${info.lesson}\n${info.example}`, display)) return `${stage.id} catalog ${trap.id} shows “${display}”`
      if (exampleShowsAnswer(info.example, display)) return `${stage.id} catalog example ${trap.id} shows ${display}`
    }
    for (const choice of stage.choices ?? []) {
      if (answer.prompt.toLowerCase().includes(choice.text.toLowerCase())) return `the prompt prints the choice “${choice.text}”`
      if ((stage.nudge + stage.hint).toLowerCase().includes(choice.text.toLowerCase())) return `a hint prints the choice “${choice.text}”`
    }
    for (const card of cards) {
      const example = card.example ?? ''
      if (shows7(example, display)) return `${stage.id} rule card ${card.id} example shows “${display}”`
      const result = example.split(/=|→/).pop()?.trim() ?? ''
      if (result && exampleShowsAnswer(result, display)) return `${stage.id} rule card ${card.id} result shows ${display}`
      if (!/[A-Za-z]{4}/.test(display) && shows7(card.body, display)) return `${stage.id} rule card ${card.id} body shows ${display}`
    }
  }
  return null
}

function pluralIssues(text: string): string[] {
  const out: string[] = []
  if (/\b1 degrees\b/.test(text)) out.push('1 degrees')
  if (/(?<![\d.])(?:[02-9]|\d{2,}) degree\b/.test(text)) out.push('degree after a plural number')
  return out
}

export interface Finish8 {
  question: GeometryQuestion
  prompt: string
  figure: GeoFigureSpec
  stages: Stage7[]
  lengths: number[]
  title: string
  instructions: string
  params: Record<string, string | number | boolean>
  cards: readonly RuleCard[]
  promise: readonly ErrorPatternId[]
  promiseStage?: GeometryStageId
}

/** The finished problem, or null when it shows an answer, crowds the figure, or is not English. */
export function finish8(o: Finish8): GeoBuilt | null {
  const traps = o.stages.flatMap((s) => s.traps.map((t) => ({ ...t, stage: s.id })))
  if (traps.length === 0) {
    lastRefuse = 'no trap'
    return null
  }
  let ordered = traps
  if (o.promiseStage) ordered = [...traps.filter((t) => t.stage === o.promiseStage), ...traps.filter((t) => t.stage !== o.promiseStage)]
  let picked = ordered[0]!
  for (const id of o.promise) {
    const hit = ordered.find((t) => t.id === id)
    if (hit) {
      picked = hit
      break
    }
  }
  const known = new Set(o.cards.map((c) => c.id))
  for (const s of o.stages) if (!known.has(s.ruleCard)) throw new Error(`${s.id}: rule card ${s.ruleCard} is not in this module`)
  const mistakeCards = traps.map((t) => GEO_RULE_FOR[t.id as keyof typeof GEO_RULE_FOR]).filter((id): id is string => Boolean(id) && known.has(id!))
  const cardIds = [...new Set([...o.stages.map((s) => s.ruleCard), ...mistakeCards])]
  const answer: GeometryAnswer = {
    type: 'geometry',
    question: o.question,
    prompt: o.prompt,
    figure: o.figure,
    stages: o.stages,
    lengths: o.lengths.filter((n) => Number.isInteger(n) && n > 0),
    angles: [],
    expectedDisplay: o.stages.map((s) => `${s.label}: ${stageDisplay(s)}`).join(' · '),
    reveal: o.stages.flatMap((s) => s.reveal),
    ruleCards: cardIds,
    trap: picked.id,
    trapStage: picked.stage,
    trapAnswer: picked.text,
  }
  for (const text of readTexts(answer)) {
    const issues = [...englishIssues(text), ...pluralIssues(text)]
    if (issues.length > 0) {
      lastRefuse = `english: ${issues[0]}`
      return null
    }
  }
  if (/\d/.test(o.figure.ariaLabel)) {
    lastRefuse = 'aria has a digit'
    return null
  }
  const issues = figureIssues7(o.figure)
  if (issues.length > 0) {
    lastRefuse = `figure: ${issues[0]}`
    return null
  }
  const leak = leakOf8(answer, o.cards)
  if (leak) {
    lastRefuse = `leak: ${leak}`
    return null
  }
  for (const stage of o.stages) {
    if (gradeGeoStage(answer, stage.id, stage.answerText).verdict !== 'correct') {
      lastRefuse = `${stage.id} answer does not grade`
      return null
    }
    for (const line of stage.reveal) if (answer.prompt.includes(line)) {
      lastRefuse = 'reveal in prompt'
      return null
    }
    for (const trap of stage.traps) {
      const g = gradeGeoStage(answer, stage.id, trap.text)
      if (g.verdict !== 'mistake' || g.mistake !== trap.id) {
        lastRefuse = `${stage.id} trap ${trap.id} grades ${g.verdict}`
        return null
      }
    }
  }
  try {
    assertGeoAnswer(o.title, answer)
  } catch (e) {
    lastRefuse = `shared check: ${e instanceof Error ? e.message : String(e)}`
    return null
  }
  return { answer, title: o.title, instructions: o.instructions, params: o.params }
}

/** Try until a draw ships. `mode` stays fixed so a template's mix does not drift when a picture is redrawn. */
export function generate8(seed: number, salt: number, make: (rng: Rng) => GeoBuilt | null): GeoBuilt {
  for (let n = 0; n < 96; n++) {
    const rng = makeRng(mixSeed(seed, salt + n * 97))
    const built = make(rng)
    if (built) return built
  }
  throw new Error(`unit 8 seed ${seed} salt ${salt}: ${lastRefuse}`)
}

export function modeOf<T extends string>(seed: number, salt: number, modes: readonly T[]): T {
  return modes[makeRng(mixSeed(seed, salt)).int(0, modes.length - 1)]!
}

/** Rotate which real trap is promised, after the picture's numbers are chosen. */
export function rotatePromise(ids: readonly ErrorPatternId[], rng: Rng): ErrorPatternId[] {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return []
  const i = rng.int(0, unique.length - 1)
  return [...unique.slice(i), ...unique.slice(0, i)]
}

export function cmWord(rng: Rng): string {
  return rng.chance(0.5) ? ' cm' : ''
}

export function quadOf(dx: number, dy: number): number {
  if (dx > 0 && dy > 0) return 1
  if (dx < 0 && dy > 0) return 2
  if (dx < 0 && dy < 0) return 3
  if (dx > 0 && dy < 0) return 4
  return 0
}

// --- circles on the coordinate plane -----------------------------------------------------------------------

export function sqTerm(v: string, c: number): string {
  if (c === 0) return `${v}²`
  if (c > 0) return `(${v} ${MINUS} ${c})²`
  return `(${v} + ${-c})²`
}

/** Standard form. `right` is whatever belongs on the right side (r², r, or a diameter's square). */
export function circleEq(h: number, k: number, right: number): string {
  return `${sqTerm('x', h)} + ${sqTerm('y', k)} = ${right}`
}

export function generalEq(d: number, e: number, f: number): string {
  let s = 'x² + y²'
  const term = (coeff: number, v: string) => {
    if (coeff === 0) return
    const mag = Math.abs(coeff)
    const body = mag === 1 ? v : `${mag}${v}`
    s += coeff > 0 ? ` + ${body}` : ` ${MINUS} ${body}`
  }
  term(d, 'x')
  term(e, 'y')
  if (f > 0) s += ` + ${f}`
  else if (f < 0) s += ` ${MINUS} ${-f}`
  return `${s} = 0`
}

export function pointText(x: number, y: number): string {
  return formatPoint(int(x), int(y))
}

export { showPt, formatLin, int, sqrtQ, rad, qSay, pointOf, type Lin, type P2, type Stage7, type GeoPoint, type GeoSegment, type GeoAngleMark }
export type { GeoQty }

/** A rim point in the given direction, for the quadrant check. Id is A or T. */
export function rimPoint(id: string, center: P2, r: number, deg: number, origin: P2): GeoPoint {
  return pointOf(id, add(center, polar(r, deg)), origin, id)
}

export function circleSpec(opts: {
  center: P2
  r: number
  turn: number
  rimId?: string
  extra?: GeoPoint[]
  segments?: GeoSegment[]
  angles?: GeoAngleMark[]
  grid?: boolean
  aria: string
}): GeoFigureSpec {
  const o = pointOf('O', opts.center, add(opts.center, { x: 1, y: 0.2 }), 'O')
  const rim = opts.rimId ?? 'A'
  const a = rimPoint(rim, opts.center, opts.r, opts.turn, opts.center)
  const points = [o, a, ...(opts.extra ?? [])]
  let grid: GeoFigureSpec['grid']
  if (opts.grid) {
    const pad = opts.r + 2
    grid = {
      xMin: Math.floor(opts.center.x - pad),
      xMax: Math.ceil(opts.center.x + pad),
      yMin: Math.floor(opts.center.y - pad),
      yMax: Math.ceil(opts.center.y + pad),
    }
  }
  return {
    ariaLabel: opts.aria,
    points,
    circles: [{ center: 'O', r: opts.r }],
    ...(opts.segments ? { segments: opts.segments } : {}),
    ...(opts.angles ? { angles: opts.angles } : {}),
    ...(grid ? { grid } : {}),
  }
}
