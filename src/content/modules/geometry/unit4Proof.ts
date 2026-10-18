/**
 * Honors geometry Unit 4, two-column proofs. Thirteen skeletons. Letters, and for two
 * separate triangles the correspondence and the turn of the second triangle, come from
 * the seed. A figure shows only the given marks. Jurgensen writes AAS and HL as theorems;
 * a book that calls them postulates is accepted too.
 */
import { makeRng, mixSeed } from '@/content/rng'
import type { GeometryAnswer } from '@/content/types'
import type { ErrorPatternId, GeoAngleMark, GeoFigureSpec, GeoLine, GeoPoint, GeoSegment } from '@/shared/types'
import type { GeoBuilt } from './build'
import { containsAnswer, stageDisplay, stageIdAt } from './grade'
import { reasonLabel, reasonWitness, swapsFor, type ReasonId } from './reasons'
import {
  LETTERS,
  PERMS,
  SCALENE,
  applyPerm,
  pickLetters,
  placePair,
  placeRightPair,
  sameCongruence,
} from './unit4Geom'
import { UNIT4_RULE_IDS } from './unit4Rules'

const REASON_HINT = 'Pick the reason that makes this line legal.'
const REASON_NUDGE =
  'Name the fact that makes this line legal. A fact about corresponding parts comes after the triangles are proved congruent, and a side that lies in both triangles is not one of the starting facts.'
const CHOICE_HINT = 'Pick the statement this row needs.'
const CHOICE_NUDGE = 'A sentence can be true of the figure and still belong on a different row.'
const NOTE_PART = 'The triangles were proved congruent on an earlier row. This row names one pair of corresponding parts.'
const NOTE_TRI = 'The rows above are the facts this step needs. Which sentence do they support?'
const NOTE_RIGHT = 'The two lines meet at this vertex. Which sentence names the angle there?'
const ORDER_W = 'That order pairs vertices the marks do not pair. Read the correspondence, not a different order of the letters.'
const ROTS = [70, 110, 160, 200, 250, 300]

type Tri = [string, string, string]
type Tick = 1 | 2 | 3

interface Choice {
  id: string
  text: string
  trap?: ErrorPatternId
  witness?: string
}

interface ProofRow {
  statement: string
  reason: ReasonId
  pick: 'reason' | 'statement'
  also?: ReasonId[]
  reasonNote?: string
  choices?: Choice[]
}

interface Built {
  id: string
  prompt: string
  figure: GeoFigureSpec
  rows: ProofRow[]
  trapIndex: number
  trap: ErrorPatternId
  trapAnswer: string
  perm?: number
}

interface TrapOpt {
  row: number
  trap: ErrorPatternId
  answer: string
}

interface Figure {
  points: GeoPoint[]
  segments: GeoSegment[]
  angles?: GeoAngleMark[]
  lines?: GeoLine[]
  shared?: string[]
  vertical?: string[]
  alt?: string[]
}

interface Named {
  t1: Tri
  t2: Tri
  perm: number
}

function names6(salt: number, key: number): Named {
  const rng = makeRng(mixSeed(salt + 1, key))
  const letters = pickLetters(rng, 6)
  const perm = rng.int(0, 5)
  const t1: Tri = [letters[0]!, letters[1]!, letters[2]!]
  const t2 = applyPerm([letters[3]!, letters[4]!, letters[5]!], PERMS[perm]!)
  return { t1, t2, perm }
}

function namesN(salt: number, key: number, n: number): string[] {
  return pickLetters(makeRng(mixSeed(salt + 1, key)), n)
}

function trapOf(salt: number, options: readonly TrapOpt[]): TrapOpt {
  return options[salt % options.length]!
}

function reason(statement: string, why: ReasonId, also?: ReasonId[]): ProofRow {
  return also ? { pick: 'reason', statement, reason: why, also } : { pick: 'reason', statement, reason: why }
}

function statementRow(statement: string, why: ReasonId, reasonNote: string, choices: Choice[]): ProofRow {
  return { pick: 'statement', statement, reason: why, reasonNote, choices }
}

function eq(a: string, b: string): string {
  return `${a} ≅ ${b}`
}

function tri(t: Tri): string {
  return `△${t.join('')}`
}

function sideOf(t: Tri, i: number): string {
  if (i === 2) return `${t[0]}${t[2]}`
  return `${t[i]}${t[(i + 1) % 3]}`
}

function angOf(t: Tri, i: number): string {
  return `∠${t[(i + 2) % 3]}${t[i]}${t[(i + 1) % 3]}`
}

function ask(givens: string[], prove: string): string {
  return `Given: ${givens.join(', ')}. Prove: ${prove}.`
}

function congChoices(t1: Tri, t2: Tri): Choice[] {
  const text = (perm: readonly [number, number, number]) => eq(tri(t1), tri(applyPerm([...t2], perm)))
  return [
    { id: 'right', text: eq(tri(t1), tri(t2)) },
    { id: 'order', text: text([1, 2, 0]), trap: 'geo_vertices_out_of_order', witness: ORDER_W },
    { id: 'other', text: text([0, 2, 1]) },
    { id: 'else', text: text([2, 0, 1]) },
  ]
}

function pt(id: string, x: number, y: number, side: NonNullable<GeoPoint['labelSide']>): GeoPoint {
  return { id, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, label: id, labelSide: side }
}

function byId(points: GeoPoint[], id: string): GeoPoint {
  const found = points.find((p) => p.id === id)
  if (!found) throw new Error(`missing ${id}`)
  return found
}

function dist(points: GeoPoint[], a: string, b: string): number {
  const u = byId(points, a)
  const v = byId(points, b)
  return Math.hypot(u.x - v.x, u.y - v.y)
}

function dir(points: GeoPoint[], a: string, b: string): { x: number; y: number } {
  const u = byId(points, a)
  const v = byId(points, b)
  return { x: v.x - u.x, y: v.y - u.y }
}

function wedge(points: GeoPoint[], v: string, a: string, b: string): number {
  const V = byId(points, v)
  const A = byId(points, a)
  const B = byId(points, b)
  const a1 = Math.atan2(A.y - V.y, A.x - V.x)
  const a2 = Math.atan2(B.y - V.y, B.x - V.x)
  let d = a2 - a1
  while (d <= -Math.PI) d += 2 * Math.PI
  while (d > Math.PI) d -= 2 * Math.PI
  return (Math.abs(d) * 180) / Math.PI
}

function assertArea(points: GeoPoint[], a: string, b: string, c: string, where: string): void {
  const A = byId(points, a)
  const B = byId(points, b)
  const C = byId(points, c)
  const area = Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y)) / 2
  if (area < 0.4) throw new Error(`${where}: triangle ${a}${b}${c} is flat`)
}

function assertNoRight(points: GeoPoint[], ids: Tri, where: string): void {
  for (let i = 0; i < 3; i++) {
    const got = wedge(points, ids[i]!, ids[(i + 1) % 3]!, ids[(i + 2) % 3]!)
    if (Math.abs(got - 90) < 2) throw new Error(`${where}: angle at ${ids[i]} is right`)
  }
}

function assertSame(where: string, left: number, right: number, tol = 0.05): void {
  if (Math.abs(left - right) > tol) throw new Error(`${where}: ${left.toFixed(2)} vs ${right.toFixed(2)}`)
}

function assertStraight(points: GeoPoint[], a: string, m: string, b: string, where: string): void {
  const d1 = dir(points, m, a)
  const d2 = dir(points, m, b)
  const cross = d1.x * d2.y - d1.y * d2.x
  const dot = d1.x * d2.x + d1.y * d2.y
  if (Math.abs(cross) > 1e-6 || dot >= 0) throw new Error(`${where}: ${a}${m}${b} is not a straight line`)
}

function assertParallel(points: GeoPoint[], a: string, b: string, c: string, d: string, where: string): void {
  const ab = dir(points, a, b)
  const cd = dir(points, c, d)
  if (Math.abs(ab.x * cd.y - ab.y * cd.x) > 1e-6) throw new Error(`${where}: not parallel`)
}

function listOrNone(items: string[]): string {
  return items.length ? items.join('; ') : 'none'
}

function sideKey(a: string, b: string): string {
  return a < b ? `${a}${b}` : `${b}${a}`
}

function describe(t1: string, t2: string, fig: Figure): string {
  const byTick = new Map<number, string[]>()
  for (const seg of fig.segments) {
    if (!seg.ticks) continue
    const list = byTick.get(seg.ticks) ?? []
    list.push(`${seg.from}${seg.to}`)
    byTick.set(seg.ticks, list)
  }
  const sides: string[] = []
  for (const n of [1, 2, 3]) {
    const list = byTick.get(n)
    if (!list) continue
    if (list.length !== 2) throw new Error(`tick ${n} is on ${list.length} sides`)
    sides.push(`${list[0]}-${list[1]} tick ${n}`)
  }
  const byArc = new Map<number, string[]>()
  const rights: string[] = []
  for (const mark of fig.angles ?? []) {
    if (mark.right) {
      rights.push(mark.vertex)
      continue
    }
    if (!mark.marks) continue
    const list = byArc.get(mark.marks) ?? []
    list.push(mark.vertex)
    byArc.set(mark.marks, list)
  }
  const angles: string[] = []
  for (const n of [1, 2, 3]) {
    const list = byArc.get(n)
    if (!list) continue
    if (list.length !== 2) throw new Error(`arc ${n} is on ${list.length} angles`)
    angles.push(`${list[0]}-${list[1]} arc ${n}`)
  }
  const byArrow = new Map<number, string[]>()
  for (const line of fig.lines ?? []) {
    if (!line.arrows) continue
    const list = byArrow.get(line.arrows) ?? []
    list.push(`${line.through[0]}${line.through[1]}`)
    byArrow.set(line.arrows, list)
  }
  const parallel: string[] = []
  for (const n of [1, 2]) {
    const list = byArrow.get(n)
    if (!list) continue
    if (list.length !== 2) throw new Error(`arrows ${n} on ${list.length} lines`)
    parallel.push(`${list[0]}||${list[1]} arrows ${n}`)
  }
  return [
    `Triangles ${t1} and ${t2}.`,
    `Side pairs: ${listOrNone(sides)}.`,
    `Angle pairs: ${listOrNone(angles)}.`,
    `Right angles: ${listOrNone(rights)}.`,
    `Shared sides: ${listOrNone(fig.shared ?? [])}.`,
    `Vertical angles: ${listOrNone(fig.vertical ?? [])}.`,
    `Parallel lines: ${listOrNone(parallel)}.`,
    `Alternate interior angles: ${listOrNone(fig.alt ?? [])}.`,
  ].join(' ')
}

function figureOf(t1: Tri, t2: Tri, fig: Figure): GeoFigureSpec {
  return {
    ariaLabel: describe(t1.join(''), t2.join(''), fig),
    points: fig.points,
    segments: fig.segments,
    ...(fig.lines ? { lines: fig.lines } : {}),
    ...(fig.angles?.length ? { angles: fig.angles } : {}),
  }
}

function pairFigure(t1: Tri, t2: Tri, salt: number, marked: { i: number; n: Tick }[], arcs: { i: number; n: Tick }[]): Figure {
  let points: GeoPoint[] | null = null
  let last = 'pair: no placement'
  for (let extra = 0; extra < SCALENE.length; extra++) {
    const ang = SCALENE[(salt + extra) % SCALENE.length]!
    const placed = placePair(t1, t2, ang[0], ang[1], 4.2, ROTS[salt % ROTS.length]!, salt % 2 === 1, 2.6)
    try {
      assertArea(placed, t1[0], t1[1], t1[2], 'pair')
      assertArea(placed, t2[0], t2[1], t2[2], 'pair')
      assertNoRight(placed, t1, 'pair')
      assertNoRight(placed, t2, 'pair')
      for (let i = 0; i < 3; i++) {
        assertSame('pair sides', dist(placed, t1[i]!, t1[(i + 1) % 3]!), dist(placed, t2[i]!, t2[(i + 1) % 3]!))
        assertSame('pair angles', wedge(placed, t1[i]!, t1[(i + 1) % 3]!, t1[(i + 2) % 3]!), wedge(placed, t2[i]!, t2[(i + 1) % 3]!, t2[(i + 2) % 3]!), 0.4)
      }
      points = placed
      break
    } catch (err) {
      last = err instanceof Error ? err.message : last
    }
  }
  if (!points) throw new Error(last)
  const ticks = new Map<string, Tick>()
  for (const mark of marked) {
    ticks.set(sideKey(t1[mark.i]!, t1[(mark.i + 1) % 3]!), mark.n)
    ticks.set(sideKey(t2[mark.i]!, t2[(mark.i + 1) % 3]!), mark.n)
  }
  const seg = (p: string, q: string): GeoSegment => {
    const n = ticks.get(sideKey(p, q))
    return n ? { from: p, to: q, ticks: n } : { from: p, to: q }
  }
  const angles: GeoAngleMark[] = []
  for (const arc of arcs) {
    angles.push({ vertex: t1[arc.i]!, from: t1[(arc.i + 1) % 3]!, to: t1[(arc.i + 2) % 3]!, marks: arc.n })
    angles.push({ vertex: t2[arc.i]!, from: t2[(arc.i + 1) % 3]!, to: t2[(arc.i + 2) % 3]!, marks: arc.n })
  }
  const segments = [0, 1, 2].flatMap((i) => [seg(t1[i]!, t1[(i + 1) % 3]!), seg(t2[i]!, t2[(i + 1) % 3]!)])
  return { points, segments, ...(angles.length ? { angles } : {}) }
}

function rightPair(t1: Tri, t2: Tri, salt: number, leg: 1 | 2): Figure {
  const legs: readonly [number, number][] = [
    [3.2, 4.8],
    [2.8, 4.4],
    [3.5, 5.1],
    [2.6, 4.2],
  ]
  const [rise, run] = legs[salt % legs.length]!
  const points = placeRightPair(t1, t2, rise, run, ROTS[salt % ROTS.length]!, salt % 2 === 1, 2.4)
  for (const ids of [t1, t2]) {
    const got = wedge(points, ids[2]!, ids[0]!, ids[1]!)
    if (Math.abs(got - 90) > 0.8) throw new Error(`right angle drifted to ${got.toFixed(2)}`)
    assertArea(points, ids[0], ids[1], ids[2], 'hl')
  }
  assertSame('hyp', dist(points, t1[0]!, t1[1]!), dist(points, t2[0]!, t2[1]!))
  assertSame('leg', dist(points, t1[leg]!, t1[(leg + 1) % 3]!), dist(points, t2[leg]!, t2[(leg + 1) % 3]!))
  const ticks = new Map<string, Tick>()
  const mark = (ids: Tri, i: number, n: Tick) => ticks.set(sideKey(ids[i]!, ids[(i + 1) % 3]!), n)
  mark(t1, 0, 1)
  mark(t2, 0, 1)
  mark(t1, leg, 2)
  mark(t2, leg, 2)
  const seg = (ids: Tri, i: number): GeoSegment => {
    const n = ticks.get(sideKey(ids[i]!, ids[(i + 1) % 3]!))
    return n ? { from: ids[i]!, to: ids[(i + 1) % 3]!, ticks: n } : { from: ids[i]!, to: ids[(i + 1) % 3]! }
  }
  return {
    points,
    segments: [0, 1, 2].flatMap((i) => [seg(t1, i), seg(t2, i)]),
    angles: [
      { vertex: t1[2]!, from: t1[0]!, to: t1[1]!, right: true },
      { vertex: t2[2]!, from: t2[0]!, to: t2[1]!, right: true },
    ],
  }
}

function cardFor(why: ReasonId): string {
  if (why === 'thm-cpctc') return UNIT4_RULE_IDS.cpctc
  if (why === 'cong-refl' || why === 'thm-vertical' || why === 'thm-alt-int') return UNIT4_RULE_IDS.shared
  if (
    why === 'def-midpoint' ||
    why === 'def-seg-bisector' ||
    why === 'def-ang-bisector' ||
    why === 'def-perp' ||
    why === 'def-right' ||
    why === 'def-right-triangle' ||
    why === 'thm-right-cong'
  ) {
    return UNIT4_RULE_IDS.defs
  }
  return UNIT4_RULE_IDS.methods
}

function finish(built: Built, seed: number): GeoBuilt {
  if (built.rows.length === 0 || built.rows.length > 8) throw new Error(`${built.id}: ${built.rows.length} rows`)
  const proved = /\. Prove: (.+)\.$/.exec(built.prompt)?.[1]
  if (!built.prompt.startsWith('Given: ') || !proved) throw new Error(`${built.id}: prompt is not Given/Prove`)
  const goal = built.rows.find((row) => row.statement === proved)
  if (!goal || goal.pick !== 'reason') throw new Error(`${built.id}: the prove line is not a reason row`)
  for (const row of built.rows) {
    if (row.statement.includes(' and ') && !row.statement.endsWith('are right triangles')) {
      throw new Error(`${built.id}: “${row.statement}” states two facts`)
    }
    if (row.pick === 'statement') {
      for (const choice of row.choices ?? []) {
        if (choice.text !== row.statement && sameCongruence(choice.text, row.statement)) {
          throw new Error(`${built.id}: an equivalent congruence is offered as a distractor`)
        }
      }
    }
  }
  const squares = (built.figure.angles ?? []).filter((mark) => mark.right)
  if (squares.length && built.id !== 'hl-right' && built.id !== 'hl-perp') throw new Error(`${built.id}: a right angle is not given`)
  for (const point of built.figure.points) {
    if (point.id !== 'M' && !LETTERS.includes(point.id)) throw new Error(`${built.id}: ${point.id} is not in the letter pool`)
  }
  const displays: string[] = []
  const stages = built.rows.map((row, index) => {
    if (row.also?.length) {
      if (row.pick !== 'reason') throw new Error(`${built.id}: only a reason row can accept another reason`)
      if (row.also.includes(row.reason)) throw new Error(`${built.id}: a row lists its own reason`)
      if (row.reason !== 'thm-aas' && row.reason !== 'thm-hl') throw new Error(`${built.id}: ${row.reason} has no textbook twin`)
    }
    if (row.reason === 'thm-aas' && !row.also?.includes('post-aas')) throw new Error(`${built.id}: AAS also goes by the postulate`)
    if (row.reason === 'thm-hl' && !row.also?.includes('post-hl')) throw new Error(`${built.id}: HL also goes by the postulate`)
    const reveal = [`Row ${index + 1} says “${row.statement}”, supported by ${reasonLabel(row.reason)}.`]
    if (row.also?.length) {
      reveal[0] = `${reveal[0]} Many books write ${row.also.map((id) => reasonLabel(id)).join(' or ')} for this step, so that is accepted too.`
    }
    if (row.pick === 'reason') {
      const traps = swapsFor(row.reason)
        .filter((swap) => !row.also?.includes(swap.picked))
        .map((swap) => ({ id: swap.mistake, text: swap.picked, witness: reasonWitness(swap.mistake, swap.picked) }))
      displays.push(reasonLabel(row.reason))
      return {
        id: stageIdAt(index),
        kind: 'reason' as const,
        label: `Reason for row ${index + 1}`,
        hint: REASON_HINT,
        nudge: REASON_NUDGE,
        note: `Statement: ${row.statement}`,
        answerText: row.reason,
        ...(row.also?.length ? { accept: [...row.also] } : {}),
        ruleCard: cardFor(row.reason),
        reveal,
        traps,
      }
    }
    const choices = makeRng(mixSeed(seed, index + 11)).shuffle(row.choices ?? [])
    const texts = new Set(choices.map((choice) => choice.text))
    if (texts.size !== choices.length) throw new Error(`${built.id}: row ${index + 1} repeats a statement`)
    const correct = choices.filter((choice) => choice.text === row.statement)
    if (correct.length !== 1) throw new Error(`${built.id}: row ${index + 1} does not have one copy of its statement`)
    displays.push(row.statement)
    const traps = choices
      .filter((choice): choice is Choice & { trap: ErrorPatternId } => Boolean(choice.trap))
      .map((choice) => ({ id: choice.trap, text: choice.id, witness: choice.witness ?? 'That statement belongs on a different row.' }))
    return {
      id: stageIdAt(index),
      kind: 'choice' as const,
      label: `Statement for row ${index + 1}`,
      hint: CHOICE_HINT,
      nudge: CHOICE_NUDGE,
      note: row.reasonNote,
      answerText: correct[0]!.id,
      choices,
      ruleCard: cardFor(row.reason),
      reveal,
      traps,
    }
  })
  const trapStage = stages[built.trapIndex]
  if (!trapStage) throw new Error(`${built.id}: trap row is missing`)
  if (!trapStage.traps.some((trap) => trap.id === built.trap && trap.text === built.trapAnswer)) {
    throw new Error(`${built.id}: promised trap ${built.trap} is not on row ${built.trapIndex + 1}`)
  }
  const answer: GeometryAnswer = {
    type: 'geometry',
    question: 'triangleProof',
    prompt: built.prompt,
    figure: built.figure,
    stages,
    lengths: [],
    angles: [],
    expectedDisplay: stages.map((stage) => stageDisplay(stage)).join(' · '),
    reveal: stages.flatMap((stage) => stage.reveal),
    ruleCards: [...new Set(stages.map((stage) => stage.ruleCard))],
    trap: built.trap,
    trapStage: trapStage.id,
    trapAnswer: built.trapAnswer,
  }
  const shared = [answer.prompt, answer.figure.ariaLabel, ...stages.flatMap((stage) => [stage.hint, stage.nudge, stage.note ?? ''])].join('\n')
  stages.forEach((stage, index) => {
    const givenReason = stage.kind === 'reason' && stage.answerText === 'given'
    if (!givenReason && containsAnswer(shared, displays[index]!)) throw new Error(`${built.id}: “${displays[index]}” is on screen`)
  })
  return {
    answer,
    title: 'Two-column proof',
    instructions: 'Each row is missing its statement or its reason. Pick the missing piece.',
    params: built.perm === undefined ? { skeleton: built.id } : { skeleton: built.id, perm: built.perm },
  }
}

function done(built: Omit<Built, 'trapIndex' | 'trap' | 'trapAnswer'>, salt: number, options: readonly TrapOpt[]): Built {
  const picked = trapOf(salt, options)
  return { ...built, trapIndex: picked.row, trap: picked.trap, trapAnswer: picked.answer }
}

function sssThree(_unused: undefined, salt: number): Built {
  const { t1, t2, perm } = names6(salt, 11)
  const prove = eq(angOf(t1, 0), angOf(t2, 0))
  const givens = [0, 1, 2].map((i) => eq(sideOf(t1, i), sideOf(t2, i)))
  return done(
    {
      id: 'sss-three',
      perm,
      prompt: ask(givens, prove),
      figure: figureOf(t1, t2, pairFigure(t1, t2, salt, [{ i: 0, n: 1 }, { i: 1, n: 2 }, { i: 2, n: 3 }], [])),
      rows: [
        reason(givens[0]!, 'given'),
        reason(givens[1]!, 'given'),
        reason(givens[2]!, 'given'),
        reason(eq(tri(t1), tri(t2)), 'post-sss'),
        reason(prove, 'thm-cpctc'),
      ],
    },
    salt,
    [
      { row: 3, trap: 'geo_cpctc_too_soon', answer: 'thm-cpctc' },
      { row: 3, trap: 'geo_hl_no_right', answer: 'thm-hl' },
    ],
  )
}

function sasIncluded(_unused: undefined, salt: number): Built {
  const { t1, t2, perm } = names6(salt, 12)
  const givens = [eq(sideOf(t1, 0), sideOf(t2, 0)), eq(angOf(t1, 1), angOf(t2, 1)), eq(sideOf(t1, 1), sideOf(t2, 1))]
  const prove = eq(sideOf(t1, 2), sideOf(t2, 2))
  return done(
    {
      id: 'sas-included',
      perm,
      prompt: ask(givens, prove),
      figure: figureOf(t1, t2, pairFigure(t1, t2, salt, [{ i: 0, n: 1 }, { i: 1, n: 2 }], [{ i: 1, n: 1 }])),
      rows: [...givens.map((line) => reason(line, 'given')), reason(eq(tri(t1), tri(t2)), 'post-sas'), reason(prove, 'thm-cpctc')],
    },
    salt,
    [
      { row: 3, trap: 'geo_cpctc_too_soon', answer: 'thm-cpctc' },
      { row: 3, trap: 'geo_hl_no_right', answer: 'thm-hl' },
    ],
  )
}

function asaIncluded(_unused: undefined, salt: number): Built {
  const { t1, t2, perm } = names6(salt, 13)
  const givens = [eq(angOf(t1, 0), angOf(t2, 0)), eq(sideOf(t1, 0), sideOf(t2, 0)), eq(angOf(t1, 1), angOf(t2, 1))]
  const prove = eq(sideOf(t1, 2), sideOf(t2, 2))
  return done(
    {
      id: 'asa-included',
      perm,
      prompt: ask(givens, prove),
      figure: figureOf(t1, t2, pairFigure(t1, t2, salt, [{ i: 0, n: 1 }], [{ i: 0, n: 1 }, { i: 1, n: 2 }])),
      rows: [...givens.map((line) => reason(line, 'given')), reason(eq(tri(t1), tri(t2)), 'post-asa'), reason(prove, 'thm-cpctc')],
    },
    salt,
    [
      { row: 3, trap: 'geo_asa_aas_swapped', answer: 'thm-aas' },
      { row: 3, trap: 'geo_hl_no_right', answer: 'thm-hl' },
      { row: 3, trap: 'geo_cpctc_too_soon', answer: 'thm-cpctc' },
    ],
  )
}

function aasNonincluded(_unused: undefined, salt: number): Built {
  const { t1, t2, perm } = names6(salt, 14)
  const givens = [eq(angOf(t1, 0), angOf(t2, 0)), eq(angOf(t1, 1), angOf(t2, 1)), eq(sideOf(t1, 1), sideOf(t2, 1))]
  const prove = eq(sideOf(t1, 0), sideOf(t2, 0))
  return done(
    {
      id: 'aas-nonincluded',
      perm,
      prompt: ask(givens, prove),
      figure: figureOf(t1, t2, pairFigure(t1, t2, salt, [{ i: 1, n: 1 }], [{ i: 0, n: 1 }, { i: 1, n: 2 }])),
      rows: [
        reason(givens[0]!, 'given'),
        reason(givens[1]!, 'given'),
        reason(givens[2]!, 'given'),
        reason(eq(tri(t1), tri(t2)), 'thm-aas', ['post-aas']),
        reason(prove, 'thm-cpctc'),
      ],
    },
    salt,
    [
      { row: 3, trap: 'geo_asa_aas_swapped', answer: 'post-asa' },
      { row: 3, trap: 'geo_cpctc_too_soon', answer: 'thm-cpctc' },
      { row: 3, trap: 'geo_hl_no_right', answer: 'thm-hl' },
    ],
  )
}

function hlRight(_unused: undefined, salt: number): Built {
  const { t1, t2, perm } = names6(salt, 15)
  const leg: 1 | 2 = salt % 2 === 0 ? 1 : 2
  const givens = [
    `${angOf(t1, 2)} is a right angle`,
    `${angOf(t2, 2)} is a right angle`,
    eq(sideOf(t1, 0), sideOf(t2, 0)),
    eq(sideOf(t1, leg), sideOf(t2, leg)),
  ]
  const prove = eq(sideOf(t1, leg === 1 ? 2 : 1), sideOf(t2, leg === 1 ? 2 : 1))
  return done(
    {
      id: 'hl-right',
      perm,
      prompt: ask(givens, prove),
      figure: figureOf(t1, t2, rightPair(t1, t2, salt, leg)),
      rows: [
        reason(givens[0]!, 'given'),
        reason(givens[1]!, 'given'),
        reason(`${tri(t1)} and ${tri(t2)} are right triangles`, 'def-right-triangle'),
        reason(givens[2]!, 'given'),
        reason(givens[3]!, 'given'),
        reason(eq(tri(t1), tri(t2)), 'thm-hl', ['post-hl']),
        reason(prove, 'thm-cpctc'),
      ],
    },
    salt,
    [
      { row: 5, trap: 'geo_sas_not_included', answer: 'post-sas' },
      { row: 5, trap: 'geo_cpctc_too_soon', answer: 'thm-cpctc' },
    ],
  )
}

function sssShared(_unused: undefined, salt: number): Built {
  const [A, B, C, D] = namesN(salt, 21, 4) as [string, string, string, string]
  const t1: Tri = [A, B, C]
  const t2: Tri = [A, D, C]
  const points = [pt(A, 0, 0, 'left'), pt(C, 6, 0, 'right'), pt(B, 2, 3.2, 'above'), pt(D, 2, -3.2, 'below')]
  assertArea(points, A, B, C, 'shared')
  assertArea(points, A, D, C, 'shared')
  assertNoRight(points, t1, 'shared')
  assertNoRight(points, t2, 'shared')
  assertSame('kite', dist(points, A, B), dist(points, A, D))
  assertSame('kite', dist(points, C, B), dist(points, C, D))
  const prove = eq(angOf(t1, 0), angOf(t2, 0))
  const givens = [eq(`${A}${B}`, `${A}${D}`), eq(`${C}${B}`, `${C}${D}`)]
  return done(
    {
      id: 'sss-shared',
      prompt: ask(givens, prove),
      figure: figureOf(t1, t2, {
        points,
        segments: [
          { from: A, to: B, ticks: 1 },
          { from: B, to: C, ticks: 2 },
          { from: C, to: A },
          { from: A, to: D, ticks: 1 },
          { from: D, to: C, ticks: 2 },
        ],
        shared: [`${A}${C}`],
      }),
      rows: [
        reason(givens[0]!, 'given'),
        reason(givens[1]!, 'given'),
        reason(eq(`${A}${C}`, `${A}${C}`), 'cong-refl'),
        reason(eq(tri(t1), tri(t2)), 'post-sss'),
        reason(prove, 'thm-cpctc'),
      ],
    },
    salt,
    [
      { row: 2, trap: 'geo_shared_side_missed', answer: 'given' },
      { row: 3, trap: 'geo_cpctc_too_soon', answer: 'thm-cpctc' },
    ],
  )
}

function sasVertical(_unused: undefined, salt: number): Built {
  const [A, E, C, B, D] = namesN(salt, 22, 5) as [string, string, string, string, string]
  const t1: Tri = [A, E, B]
  const t2: Tri = [C, E, D]
  const points = [pt(A, 0, 2, 'above'), pt(E, 3, 0, 'above'), pt(C, 6, -2, 'below'), pt(B, 0, -1.2, 'below'), pt(D, 6, 1.2, 'above')]
  assertStraight(points, A, E, C, 'vertical')
  assertStraight(points, B, E, D, 'vertical')
  assertArea(points, A, E, B, 'vertical')
  assertArea(points, C, E, D, 'vertical')
  assertNoRight(points, t1, 'vertical')
  assertNoRight(points, t2, 'vertical')
  assertSame('vertical', dist(points, A, E), dist(points, C, E))
  assertSame('vertical', dist(points, B, E), dist(points, D, E))
  const givens = [eq(`${A}${E}`, `${C}${E}`), eq(`${B}${E}`, `${D}${E}`)]
  const prove = eq(sideOf(t1, 2), sideOf(t2, 2))
  return done(
    {
      id: 'sas-vertical',
      prompt: ask(givens, prove),
      figure: figureOf(t1, t2, {
        points,
        segments: [
          { from: A, to: E, ticks: 1 },
          { from: E, to: C, ticks: 1 },
          { from: B, to: E, ticks: 2 },
          { from: E, to: D, ticks: 2 },
          { from: A, to: B },
          { from: C, to: D },
        ],
        vertical: [`${A}${E}${B}-${C}${E}${D}`],
      }),
      rows: [
        reason(givens[0]!, 'given'),
        reason(givens[1]!, 'given'),
        reason(eq(angOf(t1, 1), angOf(t2, 1)), 'thm-vertical'),
        reason(eq(tri(t1), tri(t2)), 'post-sas'),
        reason(prove, 'thm-cpctc'),
      ],
    },
    salt,
    [
      { row: 3, trap: 'geo_cpctc_too_soon', answer: 'thm-cpctc' },
      { row: 3, trap: 'geo_hl_no_right', answer: 'thm-hl' },
    ],
  )
}

function asaParallel(_unused: undefined, salt: number): Built {
  const [A, B, C, D] = namesN(salt, 23, 4) as [string, string, string, string]
  const t1: Tri = [A, B, C]
  const t2: Tri = [C, D, A]
  const points = [pt(A, 0, 0, 'below'), pt(B, 4.4, 0, 'below'), pt(C, 5.6, 2.5, 'above'), pt(D, 1.2, 2.5, 'above')]
  assertParallel(points, A, B, D, C, 'parallel')
  assertParallel(points, A, D, B, C, 'parallel')
  assertArea(points, A, B, C, 'parallel')
  assertArea(points, C, D, A, 'parallel')
  assertNoRight(points, t1, 'parallel')
  assertNoRight(points, t2, 'parallel')
  assertSame('alt', wedge(points, A, B, C), wedge(points, C, D, A))
  assertSame('alt', wedge(points, C, B, A), wedge(points, A, D, C))
  const givens = [`${A}${B} ∥ ${D}${C}`, `${A}${D} ∥ ${B}${C}`]
  const prove = eq(sideOf(t1, 0), sideOf(t2, 0))
  return done(
    {
      id: 'asa-parallel',
      prompt: ask(givens, prove),
      figure: figureOf(t1, t2, {
        points,
        segments: [{ from: A, to: C }],
        lines: [
          { through: [A, B], arrows: 1 },
          { through: [D, C], arrows: 1 },
          { through: [A, D], arrows: 2 },
          { through: [B, C], arrows: 2 },
        ],
        shared: [`${A}${C}`],
        alt: [`${B}${A}${C}-${D}${C}${A}`, `${B}${C}${A}-${D}${A}${C}`],
      }),
      rows: [
        reason(givens[0]!, 'given'),
        reason(givens[1]!, 'given'),
        reason(eq(angOf(t1, 0), angOf(t2, 0)), 'thm-alt-int'),
        reason(eq(angOf(t1, 2), angOf(t2, 2)), 'thm-alt-int'),
        reason(eq(`${A}${C}`, `${A}${C}`), 'cong-refl'),
        reason(eq(tri(t1), tri(t2)), 'post-asa'),
        reason(prove, 'thm-cpctc'),
      ],
    },
    salt,
    [
      { row: 4, trap: 'geo_shared_side_missed', answer: 'given' },
      { row: 5, trap: 'geo_asa_aas_swapped', answer: 'thm-aas' },
    ],
  )
}

function hlPerp(_unused: undefined, salt: number): Built {
  const { t1, t2, perm } = names6(salt, 17)
  const leg: 1 | 2 = 2
  const right = `${angOf(t1, 2)} is a right angle`
  const givens = [`${sideOf(t1, leg)} ⊥ ${sideOf(t1, 1)}`, `${sideOf(t2, leg)} ⊥ ${sideOf(t2, 1)}`, eq(sideOf(t1, 0), sideOf(t2, 0)), eq(sideOf(t1, leg), sideOf(t2, leg))]
  const prove = eq(tri(t1), tri(t2))
  return done(
    {
      id: 'hl-perp',
      perm,
      prompt: ask(givens, prove),
      figure: figureOf(t1, t2, rightPair(t1, t2, salt, leg)),
      rows: [
        reason(givens[0]!, 'given'),
        reason(givens[1]!, 'given'),
        statementRow(right, 'def-perp', NOTE_RIGHT, [
          { id: 'right', text: right },
          { id: 'b', text: `${angOf(t1, 1)} is a right angle` },
          { id: 'a', text: `${angOf(t1, 0)} is a right angle` },
          { id: 'side', text: givens[2]! },
        ]),
        reason(`${angOf(t2, 2)} is a right angle`, 'def-perp'),
        reason(`${tri(t1)} and ${tri(t2)} are right triangles`, 'def-right-triangle'),
        reason(givens[2]!, 'given'),
        reason(givens[3]!, 'given'),
        reason(prove, 'thm-hl', ['post-hl']),
      ],
    },
    salt,
    [
      { row: 7, trap: 'geo_sas_not_included', answer: 'post-sas' },
      { row: 7, trap: 'geo_cpctc_too_soon', answer: 'thm-cpctc' },
    ],
  )
}

function sasMidpoint(_unused: undefined, salt: number): Built {
  const [A, B, C, D] = namesN(salt, 24, 4) as [string, string, string, string]
  const t1: Tri = [A, B, 'M']
  const t2: Tri = [D, C, 'M']
  const points = [pt(B, 0, 0, 'below'), pt('M', 3.2, 0, 'below'), pt(C, 6.4, 0, 'below'), pt(A, 1.3, 2.6, 'above'), pt(D, 5.1, 2.6, 'above')]
  assertArea(points, A, B, 'M', 'midpoint')
  assertArea(points, D, C, 'M', 'midpoint')
  assertNoRight(points, t1, 'midpoint')
  assertNoRight(points, t2, 'midpoint')
  assertSame('mid halves', dist(points, B, 'M'), dist(points, 'M', C))
  assertSame('mid sides', dist(points, A, B), dist(points, D, C))
  assertSame('mid angles', wedge(points, B, A, 'M'), wedge(points, C, D, 'M'), 0.4)
  const givens = [`M is the midpoint of ${B}${C}`, eq(`${A}${B}`, `${D}${C}`), eq(angOf(t1, 1), angOf(t2, 1))]
  const prove = eq(tri(t1), tri(t2))
  const part = eq(`${A}M`, `${D}M`)
  return done(
    {
      id: 'sas-midpoint',
      prompt: ask(givens, prove),
      figure: figureOf(t1, t2, {
        points,
        segments: [
          { from: A, to: B, ticks: 1 },
          { from: B, to: 'M' },
          { from: 'M', to: C },
          { from: D, to: C, ticks: 1 },
          { from: D, to: 'M' },
          { from: A, to: 'M' },
        ],
        angles: [
          { vertex: B, from: A, to: 'M', marks: 1 },
          { vertex: C, from: D, to: 'M', marks: 1 },
        ],
      }),
      rows: [
        reason(givens[0]!, 'given'),
        reason(eq(`${B}M`, `${C}M`), 'def-midpoint'),
        reason(givens[1]!, 'given'),
        reason(givens[2]!, 'given'),
        reason(prove, 'post-sas'),
        statementRow(part, 'thm-cpctc', NOTE_PART, [
          { id: 'right', text: part },
          { id: 'order', text: eq(`${A}M`, `${C}M`), trap: 'geo_vertices_out_of_order', witness: ORDER_W },
          { id: 'other', text: eq(`${A}M`, `${B}${C}`) },
          { id: 'else', text: eq(`${A}${B}`, `${D}${C}`) },
        ]),
      ],
    },
    salt,
    [
      { row: 4, trap: 'geo_cpctc_too_soon', answer: 'thm-cpctc' },
      { row: 4, trap: 'geo_hl_no_right', answer: 'thm-hl' },
    ],
  )
}

function asaBisector(_unused: undefined, salt: number): Built {
  const [A, B, C] = namesN(salt, 25, 3) as [string, string, string]
  const t1: Tri = [A, B, 'M']
  const t2: Tri = [C, B, 'M']
  const points = [pt(B, 3, 0, 'below'), pt(A, 0, 2.6, 'left'), pt(C, 6, 2.6, 'right'), pt('M', 3, 3.6, 'above')]
  assertArea(points, A, B, 'M', 'bisector')
  assertArea(points, C, B, 'M', 'bisector')
  assertNoRight(points, t1, 'bisector')
  assertNoRight(points, t2, 'bisector')
  assertSame('bis sides', dist(points, A, B), dist(points, C, B))
  assertSame('bis angles', wedge(points, A, B, 'M'), wedge(points, C, B, 'M'), 0.4)
  assertSame('bis halves', wedge(points, B, A, 'M'), wedge(points, B, C, 'M'), 0.4)
  const givens = [`Ray ${B}M bisects ${angOf([A, B, C], 1)}`, eq(angOf(t1, 0), angOf(t2, 0)), eq(`${A}${B}`, `${C}${B}`)]
  const prove = eq(`${A}M`, `${C}M`)
  return done(
    {
      id: 'asa-bisector',
      prompt: ask(givens, prove),
      figure: figureOf(t1, t2, {
        points,
        segments: [
          { from: A, to: B, ticks: 1 },
          { from: B, to: C, ticks: 1 },
          { from: B, to: 'M' },
          { from: A, to: 'M' },
          { from: C, to: 'M' },
        ],
        angles: [
          { vertex: A, from: B, to: 'M', marks: 1 },
          { vertex: C, from: B, to: 'M', marks: 1 },
        ],
        shared: [`${B}M`],
      }),
      rows: [
        reason(givens[0]!, 'given'),
        reason(eq(angOf(t1, 1), angOf(t2, 1)), 'def-ang-bisector'),
        reason(givens[1]!, 'given'),
        reason(givens[2]!, 'given'),
        reason(eq(tri(t1), tri(t2)), 'post-asa'),
        reason(prove, 'thm-cpctc'),
      ],
    },
    salt,
    [
      { row: 4, trap: 'geo_asa_aas_swapped', answer: 'thm-aas' },
      { row: 4, trap: 'geo_hl_no_right', answer: 'thm-hl' },
    ],
  )
}

function segBisector(_unused: undefined, salt: number): Built {
  const [A, B, C, D] = namesN(salt, 26, 4) as [string, string, string, string]
  const t1: Tri = [A, 'M', C]
  const t2: Tri = [B, 'M', D]
  const points = [pt(A, 0, 0, 'below'), pt('M', 3.2, 0, 'below'), pt(B, 6.4, 0, 'below'), pt(C, 4.6, 2.8, 'above'), pt(D, 1.8, -2.8, 'below')]
  assertStraight(points, A, 'M', B, 'seg')
  assertStraight(points, C, 'M', D, 'seg')
  assertArea(points, A, 'M', C, 'seg')
  assertArea(points, B, 'M', D, 'seg')
  assertNoRight(points, t1, 'seg')
  assertNoRight(points, t2, 'seg')
  assertSame('seg halves', dist(points, A, 'M'), dist(points, 'M', B))
  assertSame('seg arms', dist(points, 'M', C), dist(points, 'M', D))
  const givens = [`Line ${C}${D} bisects ${A}${B} at M`, eq(`${C}M`, `${D}M`)]
  const prove = eq(sideOf(t1, 2), sideOf(t2, 2))
  return done(
    {
      id: 'seg-bisector',
      prompt: ask(givens, prove),
      figure: figureOf(t1, t2, {
        points,
        segments: [
          { from: A, to: 'M' },
          { from: 'M', to: B },
          { from: C, to: 'M', ticks: 1 },
          { from: 'M', to: D, ticks: 1 },
          { from: A, to: C },
          { from: B, to: D },
        ],
        vertical: [`${A}M${C}-${B}M${D}`],
      }),
      rows: [
        reason(givens[0]!, 'given'),
        reason(`M is the midpoint of ${A}${B}`, 'def-seg-bisector'),
        reason(eq(`${A}M`, `${B}M`), 'def-midpoint'),
        reason(givens[1]!, 'given'),
        reason(eq(angOf(t1, 1), angOf(t2, 1)), 'thm-vertical'),
        reason(eq(tri(t1), tri(t2)), 'post-sas'),
        reason(prove, 'thm-cpctc'),
      ],
    },
    salt,
    [
      { row: 5, trap: 'geo_cpctc_too_soon', answer: 'thm-cpctc' },
      { row: 5, trap: 'geo_hl_no_right', answer: 'thm-hl' },
    ],
  )
}

function cpctcPick(_unused: undefined, salt: number): Built {
  const { t1, t2, perm } = names6(salt, 16)
  const givens = [eq(sideOf(t1, 0), sideOf(t2, 0)), eq(angOf(t1, 1), angOf(t2, 1)), eq(sideOf(t1, 1), sideOf(t2, 1))]
  const prove = eq(angOf(t1, 0), angOf(t2, 0))
  const right = eq(tri(t1), tri(t2))
  return done(
    {
      id: 'cpctc-pick',
      perm,
      prompt: ask(givens, prove),
      figure: figureOf(t1, t2, pairFigure(t1, t2, salt, [{ i: 0, n: 1 }, { i: 1, n: 2 }], [{ i: 1, n: 1 }])),
      rows: [
        reason(givens[0]!, 'given'),
        reason(givens[1]!, 'given'),
        reason(givens[2]!, 'given'),
        statementRow(right, 'post-sas', NOTE_TRI, congChoices(t1, t2)),
        reason(prove, 'thm-cpctc'),
      ],
    },
    salt,
    [{ row: 3, trap: 'geo_vertices_out_of_order', answer: 'order' }],
  )
}

const SKELETONS: readonly ((unused: undefined, salt: number) => Built)[] = [
  sssThree,
  sasIncluded,
  asaIncluded,
  aasNonincluded,
  hlRight,
  sssShared,
  sasVertical,
  asaParallel,
  hlPerp,
  sasMidpoint,
  asaBisector,
  segBisector,
  cpctcPick,
]

export function drawTriangleProof(seed: number): GeoBuilt {
  const count = SKELETONS.length
  const built = SKELETONS[(seed - 1) % count]!(undefined, Math.floor((seed - 1) / count))
  return finish(built, seed)
}
