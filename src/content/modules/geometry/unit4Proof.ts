/**
 * Honors geometry Unit 4, two-column proofs that triangles are congruent.
 * Thirteen skeletons. Jurgensen writes AAS and HL as theorems; books that call them postulates
 * are accepted too. A figure shows only the given marks: a shared side, a crossing, or a pair of
 * parallels is drawn, and the matching angles those create are not given a second arc.
 * Letters vary by seed. J, K, and L are reserved by an older example, and so is angle 8.
 */
import { makeRng, mixSeed } from '@/content/rng'
import type { GeometryAnswer } from '@/content/types'
import type { ErrorPatternId, GeoAngleMark, GeoFigureSpec, GeoLine, GeoPoint, GeoSegment } from '@/shared/types'
import type { GeoBuilt } from './build'
import { containsAnswer, stageDisplay, stageIdAt } from './grade'
import { reasonLabel, reasonWitness, swapsFor, type ReasonId } from './reasons'
import { UNIT4_RULE_IDS } from './unit4Rules'

const REASON_HINT = 'Pick the reason that makes this line legal.'
const REASON_NUDGE =
  'Name the fact that makes this line legal. A fact about matching parts comes after the triangles are shown to match, and a side that lies in both triangles is not one of the starting facts.'
const CHOICE_HINT = 'Pick the statement this row needs.'
const CHOICE_NUDGE = 'A sentence can be true of the figure and still belong on a different row.'
const NOTE_PART = 'The triangles were shown to match on an earlier row. This row names one pair of matching parts.'
const NOTE_TRI = 'The rows above are the pair of facts this step needs. Which sentence do they support?'
const NOTE_RIGHT = 'The two lines meet at this vertex. Which sentence names the angle there?'
const ORDER_W = 'That lists a vertex in the wrong place. The first letter of one triangle has to name the first letter of the other.'

interface Letters {
  A: string
  B: string
  C: string
  D: string
  E: string
  F: string
}

const SETS: readonly Letters[] = [
  { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F' },
  { A: 'P', B: 'Q', C: 'R', D: 'S', E: 'T', F: 'U' },
  { A: 'E', B: 'F', C: 'G', D: 'H', E: 'N', F: 'P' },
  { A: 'W', B: 'X', C: 'Y', D: 'Z', E: 'N', F: 'P' },
]

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
}

interface TrapOpt {
  row: number
  trap: ErrorPatternId
  answer: string
}

type Tick = 1 | 2 | 3

interface Figure {
  points: GeoPoint[]
  segments: GeoSegment[]
  angles?: GeoAngleMark[]
  lines?: GeoLine[]
  shared?: string[]
  vertical?: string[]
  alt?: string[]
}

function lettersOf(seed: number, count: number): Letters {
  return SETS[Math.floor((seed - 1) / count) % SETS.length]!
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

function tri(a: string, b: string, c: string): string {
  return `△${a}${b}${c}`
}

function ang(a: string, b: string, c: string): string {
  return `∠${a}${b}${c}`
}

function partChoices(right: string, order: string, a: string, b: string): Choice[] {
  return [
    { id: 'right', text: right },
    { id: 'order', text: order, trap: 'geo_vertices_out_of_order', witness: ORDER_W },
    { id: 'other', text: a },
    { id: 'else', text: b },
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

/** Angle at v between points a and b, in degrees. */
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
  const ab = dist(points, a, b)
  const bc = dist(points, b, c)
  const ca = dist(points, c, a)
  if (ab + bc <= ca + 0.05 || ab + ca <= bc + 0.05 || bc + ca <= ab + 0.05) throw new Error(`${where}: not a triangle`)
}

function assertNoRight(points: GeoPoint[], a: string, b: string, c: string, where: string): void {
  for (const [v, p, q] of [
    [a, b, c],
    [b, a, c],
    [c, a, b],
  ] as const) {
    const got = wedge(points, v, p, q)
    if (Math.abs(got - 90) < 2) throw new Error(`${where}: angle at ${v} is right`)
  }
}

function assertSame(where: string, left: number, right: number): void {
  if (Math.abs(left - right) > 0.05) throw new Error(`${where}: ${left.toFixed(2)} vs ${right.toFixed(2)}`)
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

function placeTri(ids: [string, string, string], ox: number, angA: number, angB: number, scale: number): GeoPoint[] {
  const angC = 180 - angA - angB
  const rad = (d: number) => (d * Math.PI) / 180
  const ac = (scale * Math.sin(rad(angB))) / Math.sin(rad(angC))
  return [
    pt(ids[0], ox, 0, 'below'),
    pt(ids[1], ox + scale, 0, 'below'),
    pt(ids[2], ox + ac * Math.cos(rad(angA)), ac * Math.sin(rad(angA)), 'above'),
  ]
}

function listOrNone(items: string[]): string {
  return items.length ? items.join('; ') : 'none'
}

function sideKey(a: string, b: string): string {
  return a < b ? `${a}${b}` : `${b}${a}`
}

/** The aria is read off the marks that are actually drawn, plus the crossings and parallels the figure shows. */
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

function figureOf(t1: string, t2: string, fig: Figure): GeoFigureSpec {
  return {
    ariaLabel: describe(t1, t2, fig),
    points: fig.points,
    segments: fig.segments,
    ...(fig.lines ? { lines: fig.lines } : {}),
    ...(fig.angles?.length ? { angles: fig.angles } : {}),
  }
}

/** Two separate copies. Side 0 is AB/DE, 1 is BC/EF, 2 is CA/FD. Angle 0 is at A/D. */
function pairFigure(L: Letters, marked: { i: 0 | 1 | 2; n: Tick }[], arcs: { i: 0 | 1 | 2; n: Tick }[]): Figure {
  const { A, B, C, D, E, F } = L
  const points = [...placeTri([A, B, C], 0, 62, 58, 4), ...placeTri([D, E, F], 8.5, 62, 58, 4)]
  assertArea(points, A, B, C, 'pair')
  assertArea(points, D, E, F, 'pair')
  assertNoRight(points, A, B, C, 'pair')
  assertNoRight(points, D, E, F, 'pair')
  const left: [string, string][] = [
    [A, B],
    [B, C],
    [C, A],
  ]
  const right: [string, string][] = [
    [D, E],
    [E, F],
    [F, D],
  ]
  const ticks = new Map<string, Tick>()
  for (const mark of marked) {
    const [p, q] = left[mark.i]!
    const [r, s] = right[mark.i]!
    ticks.set(sideKey(p, q), mark.n)
    ticks.set(sideKey(r, s), mark.n)
    assertSame('pair sides', dist(points, p, q), dist(points, r, s))
  }
  const seg = (p: string, q: string): GeoSegment => {
    const n = ticks.get(sideKey(p, q))
    return n ? { from: p, to: q, ticks: n } : { from: p, to: q }
  }
  const fromL: [string, string][] = [
    [B, C],
    [A, C],
    [A, B],
  ]
  const fromR: [string, string][] = [
    [E, F],
    [D, F],
    [D, E],
  ]
  const verts = [A, B, C]
  const verts2 = [D, E, F]
  const angles: GeoAngleMark[] = []
  for (const arc of arcs) {
    const [p, q] = fromL[arc.i]!
    const [r, s] = fromR[arc.i]!
    angles.push({ vertex: verts[arc.i]!, from: p, to: q, marks: arc.n })
    angles.push({ vertex: verts2[arc.i]!, from: r, to: s, marks: arc.n })
    assertSame('pair angles', wedge(points, verts[arc.i]!, p, q), wedge(points, verts2[arc.i]!, r, s))
  }
  return {
    points,
    segments: [seg(A, B), seg(B, C), seg(C, A), seg(D, E), seg(E, F), seg(F, D)],
    angles,
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
  const squares = (built.figure.angles ?? []).filter((mark) => mark.right)
  if (squares.length && built.id !== 'hl-right' && built.id !== 'hl-perp') throw new Error(`${built.id}: a right angle is not given`)
  for (const point of built.figure.points) {
    if ('JKL'.includes(point.id)) throw new Error(`${built.id}: ${point.id} is reserved`)
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
  for (const display of displays) {
    if (containsAnswer(shared, display)) throw new Error(`${built.id}: “${display}” is on screen`)
  }
  return {
    answer,
    title: 'Two-column proof',
    instructions: 'Each row is missing its statement or its reason. Pick the missing piece.',
    params: { skeleton: built.id },
  }
}

function done(built: Omit<Built, 'trapIndex' | 'trap' | 'trapAnswer'>, salt: number, options: readonly TrapOpt[]): Built {
  const picked = trapOf(salt, options)
  return { ...built, trapIndex: picked.row, trap: picked.trap, trapAnswer: picked.answer }
}

// --- skeletons -----------------------------------------------------------------

function sssThree(L: Letters, salt: number): Built {
  const { A, B, C, D, E, F } = L
  const fig = pairFigure(L, [
    { i: 0, n: 1 },
    { i: 1, n: 2 },
    { i: 2, n: 3 },
  ], [])
  return done(
    {
      id: 'sss-three',
      prompt: `Triangles ${A}${B}${C} and ${D}${E}${F}. ${A}${B} matches ${D}${E}, ${B}${C} matches ${E}${F}, and ${C}${A} matches ${F}${D}. Fill in each row.`,
      figure: figureOf(`${A}${B}${C}`, `${D}${E}${F}`, fig),
      rows: [
        reason(eq(`${A}${B}`, `${D}${E}`), 'given'),
        reason(eq(`${B}${C}`, `${E}${F}`), 'given'),
        reason(eq(`${C}${A}`, `${F}${D}`), 'given'),
        reason(eq(tri(A, B, C), tri(D, E, F)), 'post-sss'),
        statementRow(eq(ang(B, A, C), ang(E, D, F)), 'thm-cpctc', NOTE_PART, partChoices(eq(ang(B, A, C), ang(E, D, F)), eq(ang(B, A, C), ang(D, E, F)), eq(ang(A, B, C), ang(E, D, F)), eq(`${A}${C}`, `${E}${F}`))),
      ],
    },
    salt,
    [
      { row: 3, trap: 'geo_cpctc_too_soon', answer: 'thm-cpctc' },
      { row: 3, trap: 'geo_hl_no_right', answer: 'thm-hl' },
    ],
  )
}

function sasIncluded(L: Letters, salt: number): Built {
  const { A, B, C, D, E, F } = L
  const fig = pairFigure(L, [
    { i: 0, n: 1 },
    { i: 1, n: 2 },
  ], [{ i: 1, n: 1 }])
  return done(
    {
      id: 'sas-included',
      prompt: `Triangles ${A}${B}${C} and ${D}${E}${F}. ${A}${B} matches ${D}${E}, the angle at ${B} matches the angle at ${E}, and ${B}${C} matches ${E}${F}. Fill in each row.`,
      figure: figureOf(`${A}${B}${C}`, `${D}${E}${F}`, fig),
      rows: [
        reason(eq(`${A}${B}`, `${D}${E}`), 'given'),
        reason(eq(ang(A, B, C), ang(D, E, F)), 'given'),
        reason(eq(`${B}${C}`, `${E}${F}`), 'given'),
        reason(eq(tri(A, B, C), tri(D, E, F)), 'post-sas'),
        statementRow(eq(`${A}${C}`, `${D}${F}`), 'thm-cpctc', NOTE_PART, partChoices(eq(`${A}${C}`, `${D}${F}`), eq(`${A}${C}`, `${E}${F}`), eq(ang(B, A, C), ang(D, E, F)), eq(`${A}${B}`, `${E}${F}`))),
      ],
    },
    salt,
    [
      { row: 3, trap: 'geo_cpctc_too_soon', answer: 'thm-cpctc' },
      { row: 3, trap: 'geo_hl_no_right', answer: 'thm-hl' },
    ],
  )
}

function asaIncluded(L: Letters, salt: number): Built {
  const { A, B, C, D, E, F } = L
  const fig = pairFigure(L, [{ i: 0, n: 1 }], [
    { i: 0, n: 1 },
    { i: 1, n: 2 },
  ])
  return done(
    {
      id: 'asa-included',
      prompt: `Triangles ${A}${B}${C} and ${D}${E}${F}. The angle at ${A} matches the angle at ${D}, ${A}${B} matches ${D}${E}, and the angle at ${B} matches the angle at ${E}. Fill in each row.`,
      figure: figureOf(`${A}${B}${C}`, `${D}${E}${F}`, fig),
      rows: [
        reason(eq(ang(B, A, C), ang(E, D, F)), 'given'),
        reason(eq(`${A}${B}`, `${D}${E}`), 'given'),
        reason(eq(ang(A, B, C), ang(D, E, F)), 'given'),
        reason(eq(tri(A, B, C), tri(D, E, F)), 'post-asa'),
        statementRow(eq(`${A}${C}`, `${D}${F}`), 'thm-cpctc', NOTE_PART, partChoices(eq(`${A}${C}`, `${D}${F}`), eq(`${A}${C}`, `${D}${E}`), eq(ang(A, C, B), ang(E, D, F)), eq(`${B}${C}`, `${D}${F}`))),
      ],
    },
    salt,
    [
      { row: 3, trap: 'geo_asa_aas_swapped', answer: 'thm-aas' },
      { row: 3, trap: 'geo_hl_no_right', answer: 'thm-hl' },
      { row: 3, trap: 'geo_cpctc_too_soon', answer: 'thm-cpctc' },
    ],
  )
}

function aasNonincluded(L: Letters, salt: number): Built {
  const { A, B, C, D, E, F } = L
  const fig = pairFigure(L, [{ i: 1, n: 1 }], [
    { i: 0, n: 1 },
    { i: 1, n: 2 },
  ])
  return done(
    {
      id: 'aas-nonincluded',
      prompt: `Triangles ${A}${B}${C} and ${D}${E}${F}. The angle at ${A} matches the angle at ${D}, the angle at ${B} matches the angle at ${E}, and ${B}${C} matches ${E}${F}. Fill in each row.`,
      figure: figureOf(`${A}${B}${C}`, `${D}${E}${F}`, fig),
      rows: [
        reason(eq(ang(B, A, C), ang(E, D, F)), 'given'),
        reason(eq(ang(A, B, C), ang(D, E, F)), 'given'),
        reason(eq(`${B}${C}`, `${E}${F}`), 'given'),
        reason(eq(tri(A, B, C), tri(D, E, F)), 'thm-aas', ['post-aas']),
        statementRow(eq(`${A}${B}`, `${D}${E}`), 'thm-cpctc', NOTE_PART, partChoices(eq(`${A}${B}`, `${D}${E}`), eq(`${A}${B}`, `${E}${F}`), eq(`${A}${C}`, `${D}${E}`), eq(ang(A, C, B), ang(D, E, F)))),
      ],
    },
    salt,
    [
      { row: 3, trap: 'geo_asa_aas_swapped', answer: 'post-asa' },
      { row: 3, trap: 'geo_sas_not_included', answer: 'post-sas' },
      { row: 3, trap: 'geo_cpctc_too_soon', answer: 'thm-cpctc' },
    ],
  )
}

function rightPair(L: Letters, leg: 'bc' | 'ac'): Figure {
  const { A, B, C, D, E, F } = L
  const points = [pt(A, 0, 3, 'above'), pt(B, 4, 0, 'below'), pt(C, 0, 0, 'left'), pt(D, 8.5, 3, 'above'), pt(E, 12.5, 0, 'below'), pt(F, 8.5, 0, 'left')]
  assertArea(points, A, B, C, 'hl')
  assertArea(points, D, E, F, 'hl')
  const dot = (v: string, p: string, q: string) => {
    const d1 = dir(points, v, p)
    const d2 = dir(points, v, q)
    return d1.x * d2.x + d1.y * d2.y
  }
  if (Math.abs(dot(C, A, B)) > 1e-6 || Math.abs(dot(F, D, E)) > 1e-6) throw new Error('hl angle is not right')
  assertSame('hyp', dist(points, A, B), dist(points, D, E))
  const legL: [string, string] = leg === 'bc' ? [B, C] : [A, C]
  const legR: [string, string] = leg === 'bc' ? [E, F] : [D, F]
  assertSame('leg', dist(points, legL[0], legL[1]), dist(points, legR[0], legR[1]))
  const tick = (p: string, q: string, n: Tick | undefined): GeoSegment => (n ? { from: p, to: q, ticks: n } : { from: p, to: q })
  return {
    points,
    segments: [
      tick(A, B, 1),
      tick(B, C, leg === 'bc' ? 2 : undefined),
      tick(C, A, leg === 'ac' ? 2 : undefined),
      tick(D, E, 1),
      tick(E, F, leg === 'bc' ? 2 : undefined),
      tick(F, D, leg === 'ac' ? 2 : undefined),
    ],
    angles: [
      { vertex: C, from: A, to: B, right: true },
      { vertex: F, from: D, to: E, right: true },
    ],
  }
}

function hlRight(L: Letters, salt: number): Built {
  const { A, B, C, D, E, F } = L
  return done(
    {
      id: 'hl-right',
      prompt: `Triangles ${A}${B}${C} and ${D}${E}${F}. The angle at ${C} is a right angle and the angle at ${F} is a right angle. ${A}${B} matches ${D}${E}, and ${B}${C} matches ${E}${F}. Fill in each row.`,
      figure: figureOf(`${A}${B}${C}`, `${D}${E}${F}`, rightPair(L, 'bc')),
      rows: [
        reason(`${ang(A, C, B)} is a right angle`, 'given'),
        reason(`${ang(D, F, E)} is a right angle`, 'given'),
        reason(`${tri(A, B, C)} and ${tri(D, E, F)} are right triangles`, 'def-right-triangle'),
        reason(eq(`${A}${B}`, `${D}${E}`), 'given'),
        reason(eq(`${B}${C}`, `${E}${F}`), 'given'),
        reason(eq(tri(A, B, C), tri(D, E, F)), 'thm-hl', ['post-hl']),
        statementRow(eq(`${A}${C}`, `${D}${F}`), 'thm-cpctc', NOTE_PART, partChoices(eq(`${A}${C}`, `${D}${F}`), eq(`${A}${C}`, `${E}${F}`), eq(`${A}${B}`, `${D}${F}`), eq(ang(A, B, C), ang(D, F, E)))),
      ],
    },
    salt,
    [
      { row: 5, trap: 'geo_sas_not_included', answer: 'post-sas' },
      { row: 5, trap: 'geo_cpctc_too_soon', answer: 'thm-cpctc' },
    ],
  )
}

function sssShared(L: Letters, salt: number): Built {
  const { A, B, C, D } = L
  const points = [pt(A, 0, 0, 'left'), pt(C, 6, 0, 'right'), pt(B, 2, 3.2, 'above'), pt(D, 2, -3.2, 'below')]
  assertArea(points, A, B, C, 'shared')
  assertArea(points, A, D, C, 'shared')
  assertNoRight(points, A, B, C, 'shared')
  assertNoRight(points, A, D, C, 'shared')
  assertSame('kite', dist(points, A, B), dist(points, A, D))
  assertSame('kite', dist(points, C, B), dist(points, C, D))
  const fig: Figure = {
    points,
    segments: [
      { from: A, to: B, ticks: 1 },
      { from: B, to: C, ticks: 2 },
      { from: C, to: A },
      { from: A, to: D, ticks: 1 },
      { from: D, to: C, ticks: 2 },
    ],
    shared: [`${A}${C}`],
  }
  return done(
    {
      id: 'sss-shared',
      prompt: `Triangles ${A}${B}${C} and ${A}${D}${C} share ${A}${C}. ${A}${B} matches ${A}${D}, and ${C}${B} matches ${C}${D}. Fill in each row.`,
      figure: figureOf(`${A}${B}${C}`, `${A}${D}${C}`, fig),
      rows: [
        reason(eq(`${A}${B}`, `${A}${D}`), 'given'),
        reason(eq(`${C}${B}`, `${C}${D}`), 'given'),
        reason(eq(`${A}${C}`, `${A}${C}`), 'cong-refl'),
        reason(eq(tri(A, B, C), tri(A, D, C)), 'post-sss'),
        statementRow(eq(ang(B, A, C), ang(D, A, C)), 'thm-cpctc', NOTE_PART, partChoices(eq(ang(B, A, C), ang(D, A, C)), eq(ang(B, A, C), ang(A, D, C)), eq(ang(A, B, C), ang(D, A, C)), eq(`${A}${B}`, `${C}${D}`))),
      ],
    },
    salt,
    [
      { row: 2, trap: 'geo_shared_side_missed', answer: 'given' },
      { row: 3, trap: 'geo_cpctc_too_soon', answer: 'thm-cpctc' },
    ],
  )
}

function sasVertical(L: Letters, salt: number): Built {
  const { A, B, C, D, E } = L
  // The same crossing as the "which method" figure. A steeper X puts E's letter on a ray.
  const points = [pt(A, 0, 2, 'above'), pt(E, 3, 0, 'above'), pt(C, 6, -2, 'below'), pt(B, 0, -1.2, 'below'), pt(D, 6, 1.2, 'above')]
  assertStraight(points, A, E, C, 'vertical')
  assertStraight(points, B, E, D, 'vertical')
  assertArea(points, A, E, B, 'vertical')
  assertArea(points, C, E, D, 'vertical')
  assertNoRight(points, A, E, B, 'vertical')
  assertNoRight(points, C, E, D, 'vertical')
  assertSame('vertical', dist(points, A, E), dist(points, C, E))
  assertSame('vertical', dist(points, B, E), dist(points, D, E))
  const fig: Figure = {
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
  }
  return done(
    {
      id: 'sas-vertical',
      prompt: `Triangles ${A}${E}${B} and ${C}${E}${D}. ${A}${E} matches ${C}${E}, and ${B}${E} matches ${D}${E}. The lines cross at ${E}. Fill in each row.`,
      figure: figureOf(`${A}${E}${B}`, `${C}${E}${D}`, fig),
      rows: [
        reason(eq(`${A}${E}`, `${C}${E}`), 'given'),
        reason(eq(`${B}${E}`, `${D}${E}`), 'given'),
        reason(eq(ang(A, E, B), ang(C, E, D)), 'thm-vertical'),
        reason(eq(tri(A, E, B), tri(C, E, D)), 'post-sas'),
        statementRow(eq(`${A}${B}`, `${C}${D}`), 'thm-cpctc', NOTE_PART, partChoices(eq(`${A}${B}`, `${C}${D}`), eq(`${A}${B}`, `${E}${D}`), eq(`${A}${E}`, `${C}${D}`), eq(ang(E, A, B), ang(C, E, D)))),
      ],
    },
    salt,
    [
      { row: 3, trap: 'geo_cpctc_too_soon', answer: 'thm-cpctc' },
      { row: 3, trap: 'geo_hl_no_right', answer: 'thm-hl' },
    ],
  )
}

function asaParallel(L: Letters, salt: number): Built {
  const { A, B, C, D } = L
  const points = [pt(A, 0, 0, 'below'), pt(B, 4.4, 0, 'below'), pt(C, 5.6, 2.5, 'above'), pt(D, 1.2, 2.5, 'above')]
  assertParallel(points, A, B, D, C, 'parallel')
  assertParallel(points, A, D, B, C, 'parallel')
  assertArea(points, A, B, C, 'parallel')
  assertArea(points, C, D, A, 'parallel')
  assertNoRight(points, A, B, C, 'parallel')
  assertNoRight(points, C, D, A, 'parallel')
  assertSame('alt', wedge(points, A, B, C), wedge(points, C, D, A))
  assertSame('alt', wedge(points, C, B, A), wedge(points, A, D, C))
  const fig: Figure = {
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
  }
  return done(
    {
      id: 'asa-parallel',
      prompt: `Triangles ${A}${B}${C} and ${C}${D}${A}. ${A}${B} is parallel to ${D}${C}, and ${A}${D} is parallel to ${B}${C}. The triangles share ${A}${C}. Fill in each row.`,
      figure: figureOf(`${A}${B}${C}`, `${C}${D}${A}`, fig),
      rows: [
        reason(`${A}${B} ∥ ${D}${C}`, 'given'),
        reason(`${A}${D} ∥ ${B}${C}`, 'given'),
        reason(eq(ang(B, A, C), ang(D, C, A)), 'thm-alt-int'),
        reason(eq(ang(B, C, A), ang(D, A, C)), 'thm-alt-int'),
        reason(eq(`${A}${C}`, `${A}${C}`), 'cong-refl'),
        reason(eq(tri(A, B, C), tri(C, D, A)), 'post-asa'),
        statementRow(eq(`${A}${B}`, `${C}${D}`), 'thm-cpctc', NOTE_PART, partChoices(eq(`${A}${B}`, `${C}${D}`), eq(`${A}${B}`, `${D}${A}`), eq(ang(A, B, C), ang(D, C, A)), eq(`${B}${C}`, `${A}${C}`))),
      ],
    },
    salt,
    [
      { row: 4, trap: 'geo_shared_side_missed', answer: 'given' },
      { row: 5, trap: 'geo_asa_aas_swapped', answer: 'thm-aas' },
    ],
  )
}

function hlPerp(L: Letters, salt: number): Built {
  const { A, B, C, D, E, F } = L
  const right = `${ang(A, C, B)} is a right angle`
  return done(
    {
      id: 'hl-perp',
      prompt: `${A}${C} is perpendicular to ${B}${C}, and ${D}${F} is perpendicular to ${E}${F}. ${A}${B} matches ${D}${E}, and ${A}${C} matches ${D}${F}. Fill in each row.`,
      figure: figureOf(`${A}${B}${C}`, `${D}${E}${F}`, rightPair(L, 'ac')),
      rows: [
        reason(`${A}${C} ⊥ ${B}${C}`, 'given'),
        reason(`${D}${F} ⊥ ${E}${F}`, 'given'),
        statementRow(right, 'def-perp', NOTE_RIGHT, [
          { id: 'right', text: right },
          { id: 'b', text: `${ang(A, B, C)} is a right angle` },
          { id: 'a', text: `${ang(B, A, C)} is a right angle` },
          { id: 'side', text: eq(`${A}${C}`, `${D}${F}`) },
        ]),
        reason(`${ang(D, F, E)} is a right angle`, 'def-perp'),
        reason(`${tri(A, B, C)} and ${tri(D, E, F)} are right triangles`, 'def-right-triangle'),
        reason(`${eq(`${A}${B}`, `${D}${E}`)} and ${eq(`${A}${C}`, `${D}${F}`)}`, 'given'),
        reason(eq(tri(A, B, C), tri(D, E, F)), 'thm-hl', ['post-hl']),
      ],
    },
    salt,
    [
      { row: 6, trap: 'geo_sas_not_included', answer: 'post-sas' },
      { row: 6, trap: 'geo_cpctc_too_soon', answer: 'thm-cpctc' },
    ],
  )
}

function sasMidpoint(L: Letters, salt: number): Built {
  const { A, B, C, D } = L
  const points = [pt(B, 0, 0, 'below'), pt('M', 3.2, 0, 'below'), pt(C, 6.4, 0, 'below'), pt(A, 1.3, 2.6, 'above'), pt(D, 5.1, 2.6, 'above')]
  assertArea(points, A, B, 'M', 'midpoint')
  assertArea(points, D, C, 'M', 'midpoint')
  assertNoRight(points, A, B, 'M', 'midpoint')
  assertNoRight(points, D, C, 'M', 'midpoint')
  assertSame('mid halves', dist(points, B, 'M'), dist(points, 'M', C))
  assertSame('mid sides', dist(points, A, B), dist(points, D, C))
  assertSame('mid angles', wedge(points, B, A, 'M'), wedge(points, C, D, 'M'))
  const fig: Figure = {
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
  }
  return done(
    {
      id: 'sas-midpoint',
      prompt: `M is the midpoint of ${B}${C}. Triangles ${A}${B}M and ${D}${C}M. ${A}${B} matches ${D}${C}, and the angle at ${B} matches the angle at ${C}. Fill in each row.`,
      figure: figureOf(`${A}${B}M`, `${D}${C}M`, fig),
      rows: [
        reason(`M is the midpoint of ${B}${C}`, 'given'),
        reason(eq(`${B}M`, `M${C}`), 'def-midpoint'),
        reason(eq(`${A}${B}`, `${D}${C}`), 'given'),
        reason(eq(ang(A, B, 'M'), ang(D, C, 'M')), 'given'),
        reason(eq(tri(A, B, 'M'), tri(D, C, 'M')), 'post-sas'),
        statementRow(eq(`${A}M`, `${D}M`), 'thm-cpctc', NOTE_PART, partChoices(eq(`${A}M`, `${D}M`), eq(`${A}M`, `${B}${C}`), eq(`${A}${B}`, `${D}M`), eq(ang(B, A, 'M'), ang(D, C, 'M')))),
      ],
    },
    salt,
    [
      { row: 4, trap: 'geo_cpctc_too_soon', answer: 'thm-cpctc' },
      { row: 4, trap: 'geo_hl_no_right', answer: 'thm-hl' },
    ],
  )
}

function asaBisector(L: Letters, salt: number): Built {
  const { A, B, C } = L
  const points = [pt(B, 3, 0, 'below'), pt(A, 0, 2.6, 'left'), pt(C, 6, 2.6, 'right'), pt('M', 3, 3.6, 'above')]
  assertArea(points, A, B, 'M', 'bisector')
  assertArea(points, C, B, 'M', 'bisector')
  assertNoRight(points, A, B, 'M', 'bisector')
  assertNoRight(points, C, B, 'M', 'bisector')
  assertSame('bis sides', dist(points, A, B), dist(points, C, B))
  assertSame('bis angles', wedge(points, A, B, 'M'), wedge(points, C, B, 'M'))
  assertSame('bis halves', wedge(points, B, A, 'M'), wedge(points, B, C, 'M'))
  const fig: Figure = {
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
  }
  return done(
    {
      id: 'asa-bisector',
      prompt: `Ray ${B}M bisects angle ${A}${B}${C}. ${A}${B} matches ${C}${B}, and the angle at ${A} matches the angle at ${C}. Fill in each row.`,
      figure: figureOf(`${A}${B}M`, `${C}${B}M`, fig),
      rows: [
        reason(`Ray ${B}M bisects ${ang(A, B, C)}`, 'given'),
        reason(eq(ang(A, B, 'M'), ang(C, B, 'M')), 'def-ang-bisector'),
        reason(eq(ang(B, A, 'M'), ang(B, C, 'M')), 'given'),
        reason(eq(`${A}${B}`, `${C}${B}`), 'given'),
        reason(eq(tri(A, B, 'M'), tri(C, B, 'M')), 'post-asa'),
        statementRow(eq(`${A}M`, `${C}M`), 'thm-cpctc', NOTE_PART, partChoices(eq(`${A}M`, `${C}M`), eq(`${A}M`, `${B}M`), eq(`${A}${B}`, `${C}M`), eq(ang(A, B, 'M'), ang(B, C, 'M')))),
      ],
    },
    salt,
    [
      { row: 4, trap: 'geo_asa_aas_swapped', answer: 'thm-aas' },
      { row: 4, trap: 'geo_hl_no_right', answer: 'thm-hl' },
    ],
  )
}

function segBisector(L: Letters, salt: number): Built {
  const { A, B, C, D } = L
  const points = [pt(A, 0, 0, 'below'), pt('M', 3.2, 0, 'below'), pt(B, 6.4, 0, 'below'), pt(C, 4.6, 2.8, 'above'), pt(D, 1.8, -2.8, 'below')]
  assertStraight(points, A, 'M', B, 'seg')
  assertStraight(points, C, 'M', D, 'seg')
  assertArea(points, A, 'M', C, 'seg')
  assertArea(points, B, 'M', D, 'seg')
  assertNoRight(points, A, 'M', C, 'seg')
  assertNoRight(points, B, 'M', D, 'seg')
  assertSame('seg halves', dist(points, A, 'M'), dist(points, 'M', B))
  assertSame('seg arms', dist(points, 'M', C), dist(points, 'M', D))
  const fig: Figure = {
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
  }
  return done(
    {
      id: 'seg-bisector',
      prompt: `Line ${C}${D} bisects ${A}${B} at M. ${C}M matches ${D}M. Triangles ${A}M${C} and ${B}M${D}. Fill in each row.`,
      figure: figureOf(`${A}M${C}`, `${B}M${D}`, fig),
      rows: [
        reason(`Line ${C}${D} bisects ${A}${B} at M`, 'given'),
        reason(`M is the midpoint of ${A}${B}`, 'def-seg-bisector'),
        reason(eq(`${A}M`, `M${B}`), 'def-midpoint'),
        reason(eq(`${C}M`, `${D}M`), 'given'),
        reason(eq(ang(A, 'M', C), ang(B, 'M', D)), 'thm-vertical'),
        reason(eq(tri(A, 'M', C), tri(B, 'M', D)), 'post-sas'),
        statementRow(eq(`${A}${C}`, `${B}${D}`), 'thm-cpctc', NOTE_PART, partChoices(eq(`${A}${C}`, `${B}${D}`), eq(`${A}${C}`, `${B}M`), eq(`${A}M`, `${B}${D}`), eq(`${C}M`, `${A}${B}`))),
      ],
    },
    salt,
    [
      { row: 5, trap: 'geo_cpctc_too_soon', answer: 'thm-cpctc' },
      { row: 5, trap: 'geo_hl_no_right', answer: 'thm-hl' },
    ],
  )
}

function cpctcPick(L: Letters, salt: number): Built {
  const { A, B, C, D, E, F } = L
  const fig = pairFigure(L, [
    { i: 0, n: 1 },
    { i: 1, n: 2 },
  ], [{ i: 1, n: 1 }])
  const right = eq(tri(A, B, C), tri(D, E, F))
  return done(
    {
      id: 'cpctc-pick',
      prompt: `Triangles ${A}${B}${C} and ${D}${E}${F}. ${A}${B} matches ${D}${E}, the angle at ${B} matches the angle at ${E}, and ${B}${C} matches ${E}${F}. Fill in each row.`,
      figure: figureOf(`${A}${B}${C}`, `${D}${E}${F}`, fig),
      rows: [
        reason(eq(`${A}${B}`, `${D}${E}`), 'given'),
        reason(eq(ang(A, B, C), ang(D, E, F)), 'given'),
        reason(eq(`${B}${C}`, `${E}${F}`), 'given'),
        statementRow(right, 'post-sas', NOTE_TRI, partChoices(right, eq(tri(A, B, C), tri(E, F, D)), eq(tri(A, B, C), tri(D, F, E)), eq(tri(A, C, B), tri(D, F, E)))),
        reason(eq(ang(B, A, C), ang(E, D, F)), 'thm-cpctc'),
      ],
    },
    salt,
    [{ row: 3, trap: 'geo_vertices_out_of_order', answer: 'order' }],
  )
}

const SKELETONS: readonly ((letters: Letters, salt: number) => Built)[] = [
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
  const built = SKELETONS[(seed - 1) % count]!(lettersOf(seed, count), Math.floor((seed - 1) / count))
  return finish(built, seed)
}
