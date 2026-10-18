/**
 * Honors geometry Unit 4, congruent triangles and isosceles triangles.
 * A figure shows only the marks that are given. A shared side or a pair of vertical angles
 * counts only when the figure actually draws them. The aria lists those marks in a fixed order
 * so a later test can decide the method without reading this file's answer.
 *
 *   Triangles ABC and DEF. Side pairs: AB-DE tick 1; BC-EF tick 2. Angle pairs: B-E arc 1.
 *   Right angles: none. Shared sides: none. Vertical angles: none. Parallel lines: none.
 *   Alternate interior angles: none.
 *
 * "none" means that list is empty. Answers never use 4, 6, 11, 15, 17, 19, 23, 24, 26, 29, 37,
 * 41, 53, 60, 64, 90, 165, or 180, and the hints under the boxes use 11, 23, and 41.
 */
import { makeRng, mixSeed } from '@/content/rng'
import type { GeometryAnswer, GeometryStageId } from '@/content/types'
import type { ErrorPatternId, GeoAngleMark, GeoFigureSpec, GeoLine, GeoPoint, GeoSegment } from '@/shared/types'
import type { GeoBuilt } from './build'
import { angleLabel, evalLin, formatLin, lin, solveEqual, type Lin } from './expr'
import { exposed } from './grade'
import { UNIT4_RULE_IDS } from './unit4Rules'

const X_HINT = 'A number, like 11 or x = 11.'
const DEG_HINT = 'Degrees, like 23, 23°, or 23 deg.'
const LEN_HINT = 'A length, like 41.'
const BANNED = new Set([4, 6, 11, 15, 17, 19, 23, 24, 26, 29, 37, 41, 53, 60, 64, 90, 165, 180])

const ORDER_W = 'That order pairs vertices the marks do not pair. The first letter of one triangle has to name the matching vertex of the other.'
const SSA_W = 'Those two sides and the angle that is not between them do not show the triangles match. Two sides need the angle between them.'
const AAA_W = 'Three matching angles do not show the triangles match. The same angles can sit on triangles of different sizes.'
const HL_W = 'That way needs a right angle in each triangle, and the side opposite it. These triangles do not have a right angle.'
const SAS_W = 'That way needs the angle that sits between the two sides. The angle here is not between them.'
const SWAP_W = 'That way puts the side in the other place relative to the two angles. Look at whether the side sits between the angles.'
const BASE_W = 'That sets the angle between the matching sides equal to a base angle. The two base angles are the ones across from the matching sides.'
const CONV_W = 'That sets a matching side equal to the side between the matching angles. The two matching sides are the ones across from the matching angles.'
const EQ_W = 'That number is an angle of this triangle. The question asks for a side.'
const VERT_W = 'That pairs a different vertex. The first letter lines up with the first letter, not the next one.'

type Tick = 1 | 2 | 3
type Method = 'SSS' | 'SAS' | 'ASA' | 'AAS' | 'HL'
type Pair = [string, string]

interface SideMark {
  a: Pair
  b: Pair
  tick: Tick
}
interface AnglePair {
  a: string
  b: string
  arc: Tick
}
interface Scene {
  t1: [string, string, string]
  t2: [string, string, string]
  sides: SideMark[]
  angles: AnglePair[]
  rights: string[]
  shared: Pair[]
  vertical: string[]
  parallel: { line: string; arrows: 1 | 2 }[]
  alt: string[]
}

const SETS = [
  ['A', 'B', 'C', 'D', 'E', 'F'],
  ['P', 'Q', 'R', 'S', 'T', 'U'],
  ['E', 'F', 'G', 'H', 'N', 'P'],
  ['W', 'X', 'Y', 'Z', 'N', 'P'],
] as const

function letters(seed: number, period: number): readonly string[] {
  return SETS[Math.floor((seed - 1) / period) % SETS.length]!
}

function triName(a: string, b: string, c: string): string {
  return `△${a}${b}${c}`
}

function cong(left: string, right: string): string {
  return `${left} ≅ ${right}`
}

function sideName(a: string, b: string): string {
  return `${a}${b}`
}

const PERMS: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
]

function segKey(a: string, b: string): string {
  return a < b ? `${a}${b}` : `${b}${a}`
}

/** Which methods the marks actually prove. Empty means the marks are not enough. */
function methodsOf(scene: Scene): Method[] {
  const found = new Set<Method>()
  const sideHit = (p: Pair, q: Pair) => {
    const A = segKey(p[0], p[1])
    const B = segKey(q[0], q[1])
    if (scene.shared.some((s) => segKey(s[0], s[1]) === A && A === B)) return true
    return scene.sides.some((s) => {
      const x = segKey(s.a[0], s.a[1])
      const y = segKey(s.b[0], s.b[1])
      return (x === A && y === B) || (x === B && y === A)
    })
  }
  const angleHit = (u: string, v: string) => {
    if (scene.rights.includes(u) && scene.rights.includes(v)) return true
    if (scene.angles.some((g) => (g.a === u && g.b === v) || (g.a === v && g.b === u))) return true
    return namedAngles(scene.vertical, u, v) || namedAngles(scene.alt, u, v)
  }
  for (const perm of PERMS) {
    const map = [scene.t2[perm[0]]!, scene.t2[perm[1]]!, scene.t2[perm[2]]!]
    const matched = [0, 1, 2].filter((i) => sideHit([scene.t1[i]!, scene.t1[(i + 1) % 3]!], [map[i]!, map[(i + 1) % 3]!]))
    const ang = [0, 1, 2].filter((i) => angleHit(scene.t1[i]!, map[i]!))
    if (matched.length === 3) found.add('SSS')
    for (const v of [0, 1, 2]) {
      if (matched.includes((v + 2) % 3) && matched.includes(v) && ang.includes(v)) found.add('SAS')
    }
    for (const s of [0, 1, 2]) {
      if (ang.includes(s) && ang.includes((s + 1) % 3) && matched.includes(s)) found.add('ASA')
    }
    if (ang.length >= 2) {
      for (let i = 0; i < ang.length; i++) {
        for (let j = i + 1; j < ang.length; j++) {
          const included = includedSide(ang[i]!, ang[j]!)
          if (matched.some((s) => s !== included)) found.add('AAS')
        }
      }
    }
    const rightAt = [0, 1, 2].filter((i) => scene.rights.includes(scene.t1[i]!))
    if (rightAt.length === 1 && scene.rights.includes(map[rightAt[0]!]!)) {
      const r = rightAt[0]!
      const others = [0, 1, 2].filter((i) => scene.rights.includes(map[i]!))
      if (others.length === 1 && others[0] === r) {
        const hyp = (r + 1) % 3
        if (matched.includes(hyp) && (matched.includes(r) || matched.includes((r + 2) % 3))) found.add('HL')
      }
    }
  }
  return [...found]
}

/** Middle letter of ∠ABC, or the letter itself when the angle is named by its vertex. */
function angleVertex(name: string): string {
  if (name.length === 1 || name.length === 3) return name[name.length === 1 ? 0 : 1]!
  throw new Error(`bad angle name ${name}`)
}

/**
 * A crossing or a pair of parallels is the given. The matching angles are not stored as arcs:
 * an arc would claim a mark the problem has not drawn.
 */
function namedAngles(list: string[], u: string, v: string): boolean {
  return list.some((spec) => {
    const [left, right] = spec.split('-')
    if (!left || !right) return false
    const a = angleVertex(left)
    const b = angleVertex(right)
    return (a === u && b === v) || (a === v && b === u)
  })
}

function includedSide(va: number, vb: number): number {
  const a = Math.min(va, vb)
  const b = Math.max(va, vb)
  if (a === 0 && b === 1) return 0
  if (a === 1 && b === 2) return 1
  return 2
}

function listOrNone(items: string[]): string {
  return items.length ? items.join('; ') : 'none'
}

function ariaOf(scene: Scene): string {
  const sides = scene.sides.map((s) => `${sideName(s.a[0], s.a[1])}-${sideName(s.b[0], s.b[1])} tick ${s.tick}`)
  const angles = scene.angles.map((g) => `${g.a}-${g.b} arc ${g.arc}`)
  const shared = scene.shared.map((s) => sideName(s[0], s[1]))
  const parallel = scene.parallel.map((p) => `${p.line} arrows ${p.arrows}`)
  return [
    `Triangles ${scene.t1.join('')} and ${scene.t2.join('')}.`,
    `Side pairs: ${listOrNone(sides)}.`,
    `Angle pairs: ${listOrNone(angles)}.`,
    `Right angles: ${listOrNone(scene.rights)}.`,
    `Shared sides: ${listOrNone(shared)}.`,
    `Vertical angles: ${listOrNone(scene.vertical)}.`,
    `Parallel lines: ${listOrNone(parallel)}.`,
    `Alternate interior angles: ${listOrNone(scene.alt)}.`,
  ].join(' ')
}

function emptyScene(t1: [string, string, string], t2: [string, string, string]): Scene {
  return { t1, t2, sides: [], angles: [], rights: [], shared: [], vertical: [], parallel: [], alt: [] }
}

function pt(id: string, x: number, y: number, side: NonNullable<GeoPoint['labelSide']>): GeoPoint {
  return { id, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, label: id, labelSide: side }
}

function rad(deg: number): number {
  return (deg * Math.PI) / 180
}

function wedge(v: GeoPoint, a: GeoPoint, b: GeoPoint): number {
  const a1 = Math.atan2(a.y - v.y, a.x - v.x)
  const a2 = Math.atan2(b.y - v.y, b.x - v.x)
  let d = a2 - a1
  while (d <= -Math.PI) d += 2 * Math.PI
  while (d > Math.PI) d -= 2 * Math.PI
  return (Math.abs(d) * 180) / Math.PI
}

function byId(points: GeoPoint[], id: string): GeoPoint {
  const found = points.find((p) => p.id === id)
  if (!found) throw new Error(`missing ${id}`)
  return found
}

/** A triangle with the given angles at A, B, and C, base AB of length `scale`, A at x = ox. */
function placeTri(ids: [string, string, string], ox: number, angA: number, angB: number, scale: number): GeoPoint[] {
  const angC = 180 - angA - angB
  const ac = (scale * Math.sin(rad(angB))) / Math.sin(rad(angC))
  return [
    pt(ids[0], ox, 0, 'below'),
    pt(ids[1], ox + scale, 0, 'below'),
    pt(ids[2], ox + ac * Math.cos(rad(angA)), ac * Math.sin(rad(angA)), 'above'),
  ]
}

function assertAngles(points: GeoPoint[], ids: [string, string, string], angA: number, angB: number, where: string): void {
  const [A, B, C] = ids.map((id) => byId(points, id)) as [GeoPoint, GeoPoint, GeoPoint]
  const gotA = wedge(A, B, C)
  const gotB = wedge(B, A, C)
  const gotC = wedge(C, A, B)
  if (Math.abs(gotA - angA) > 1.5 || Math.abs(gotB - angB) > 1.5 || Math.abs(gotC - (180 - angA - angB)) > 1.5) {
    throw new Error(`${where}: drew ${gotA.toFixed(1)}, ${gotB.toFixed(1)}, ${gotC.toFixed(1)}`)
  }
}

function hide(where: string, blob: string, answers: string[]): void {
  for (const answer of answers) {
    if (exposed(blob, answer)) throw new Error(`${where}: ${answer} is on screen`)
    if (BANNED.has(Number(answer))) throw new Error(`${where}: ${answer} is reserved`)
  }
}

interface ChoiceDraft {
  id: string
  text: string
  trap?: ErrorPatternId
  witness?: string
}

function choiceAnswer(
  question: GeometryAnswer['question'],
  prompt: string,
  figure: GeoFigureSpec,
  label: string,
  choices: ChoiceDraft[],
  answerId: string,
  trapId: ErrorPatternId,
  trapChoice: string,
  ruleCard: string,
  reveal: string[],
  title: string,
  params: Record<string, string>,
  seed: number,
): GeoBuilt {
  const shuffled = makeRng(mixSeed(seed, 4)).shuffle(choices)
  const answer = shuffled.find((c) => c.id === answerId)
  if (!answer) throw new Error('missing correct choice')
  const traps = shuffled
    .filter((c): c is ChoiceDraft & { trap: ErrorPatternId } => Boolean(c.trap))
    .map((c) => ({ id: c.trap, text: c.id, witness: c.witness ?? 'That choice does not answer this part.' }))
  const stage: GeometryAnswer['stages'][number] = {
    id: 'a',
    kind: 'choice',
    label,
    hint: 'Read the marks that are drawn, then the order of the letters.',
    nudge: 'The first letter of one triangle names the first letter of the other. A side in both triangles counts, and so does an angle made by two lines that cross.',
    answerText: answerId,
    choices: shuffled,
    ruleCard,
    reveal,
    traps,
  }
  const built: GeometryAnswer = {
    type: 'geometry',
    question,
    prompt,
    figure,
    stages: [stage],
    lengths: [],
    angles: [],
    expectedDisplay: answer.text,
    reveal,
    ruleCards: [ruleCard],
    trap: trapId,
    trapStage: 'a',
    trapAnswer: trapChoice,
  }
  return { answer: built, title, instructions: 'One part. The figure is there before you answer.', params }
}

function numberStages(
  x: number,
  xTrap: { id: ErrorPatternId; text: string; witness: string } | null,
  resultLabel: string,
  result: number,
  resultUnit: 'deg' | 'len',
  resultTrap: { id: ErrorPatternId; text: string; witness: string } | null,
  ruleCard: string,
): GeometryAnswer['stages'] {
  const xReveal = [`The two matching parts give one equation, and x = ${x}.`]
  const rReveal = [`Put ${x} into the part the question asks for.`]
  const xStage: GeometryAnswer['stages'][number] = {
    id: 'x',
    kind: 'number',
    label: 'x',
    hint: X_HINT,
    answerText: String(x),
    nudge: 'Set the two matching parts equal, then solve for x.',
    ruleCard,
    reveal: xReveal,
    traps: xTrap ? [xTrap] : [],
  }
  const rStage: GeometryAnswer['stages'][number] = {
    id: 'result',
    kind: 'number',
    ...(resultUnit === 'deg' ? { unit: 'deg' as const } : {}),
    label: resultLabel,
    hint: resultUnit === 'deg' ? DEG_HINT : LEN_HINT,
    answerText: String(result),
    nudge: 'Put the value of x into the expression for this part.',
    ruleCard,
    reveal: rReveal,
    traps: resultTrap ? [resultTrap] : [],
  }
  return [xStage, rStage]
}

function numberAnswer(
  question: GeometryAnswer['question'],
  prompt: string,
  figure: GeoFigureSpec,
  stages: GeometryAnswer['stages'],
  lengths: number[],
  angles: number[],
  trap: ErrorPatternId,
  trapStage: GeometryStageId,
  trapAnswer: string,
  title: string,
  params: Record<string, string>,
): GeoBuilt {
  const reveal = stages.flatMap((s) => s.reveal)
  const answer: GeometryAnswer = {
    type: 'geometry',
    question,
    prompt,
    figure,
    stages,
    lengths,
    angles,
    expectedDisplay: stages.map((s) => s.answerText).join(' · '),
    reveal,
    ruleCards: [...new Set(stages.map((s) => s.ruleCard))],
    trap,
    trapStage,
    trapAnswer,
  }
  return { answer, title, instructions: 'Find x, then the part the question asks for. The figure is there before you answer.', params }
}

// --- corresponding parts -------------------------------------------------------

export function drawParts(seed: number): GeoBuilt {
  const L = letters(seed, 4)
  const [A, B, C, D, E, F] = L as unknown as [string, string, string, string, string, string]
  const mode = (seed - 1) % 4
  if (mode === 0 || mode === 2) return namePart(seed, A, B, C, D, E, F, mode === 0)
  return statementPart(seed, A, B, C, D, E, F)
}

function plainTriangles(A: string, B: string, C: string, D: string, E: string, F: string): GeoPoint[] {
  return [
    ...placeTri([A, B, C], 0, 70, 55, 4),
    ...placeTri([D, E, F], 8, 70, 55, 4),
  ]
}

function namePart(seed: number, A: string, B: string, C: string, D: string, E: string, F: string, angle: boolean): GeoBuilt {
  const points = plainTriangles(A, B, C, D, E, F)
  const scene = emptyScene([A, B, C], [D, E, F])
  const prompt = angle
    ? `${cong(triName(A, B, C), triName(D, E, F))}. Which angle matches ∠${A}?`
    : `${cong(triName(A, B, C), triName(D, E, F))}. Which side matches ${sideName(A, B)}?`
  // Cycle of the second triangle: D,E,F → E,F,D sends A to E and B to F.
  const choices: ChoiceDraft[] = angle
    ? [
        { id: 'right', text: `∠${D}` },
        { id: 'order', text: `∠${E}`, trap: 'geo_vertices_out_of_order', witness: ORDER_W },
        { id: 'other', text: `∠${F}` },
        { id: 'same', text: `∠${B}` },
      ]
    : [
        { id: 'right', text: sideName(D, E) },
        { id: 'order', text: sideName(E, F), trap: 'geo_vertices_out_of_order', witness: ORDER_W },
        { id: 'other', text: sideName(D, F) },
        { id: 'same', text: sideName(B, C) },
      ]
  const texts = new Set(choices.map((c) => c.text))
  if (texts.size !== 4) throw new Error('parts choices collided')
  return choiceAnswer(
    'congruentParts',
    prompt,
    {
      ariaLabel: ariaOf(scene),
      points,
      segments: [
        { from: A, to: B },
        { from: B, to: C },
        { from: C, to: A },
        { from: D, to: E },
        { from: E, to: F },
        { from: F, to: D },
      ],
    },
    angle ? `Angle matching ∠${A}` : `Side matching ${sideName(A, B)}`,
    choices,
    'right',
    'geo_vertices_out_of_order',
    'order',
    UNIT4_RULE_IDS.correspondence,
    [angle ? `∠${A} matches ∠${D}, the first vertex of each triangle.` : `${sideName(A, B)} matches ${sideName(D, E)}.`],
    'Corresponding parts',
    { case: angle ? 'angle' : 'side' },
    seed,
  )
}

function statementPart(seed: number, A: string, B: string, C: string, D: string, E: string, F: string): GeoBuilt {
  const points = plainTriangles(A, B, C, D, E, F)
  const scene = emptyScene([A, B, C], [D, E, F])
  scene.sides = [
    { a: [A, B], b: [D, E], tick: 1 },
    { a: [B, C], b: [E, F], tick: 2 },
    { a: [C, A], b: [F, D], tick: 3 },
  ]
  const got = methodsOf(scene)
  if (got.length !== 1 || got[0] !== 'SSS') throw new Error(`statement marks proved ${got.join(',')}`)
  const choices: ChoiceDraft[] = [
    { id: 'right', text: cong(triName(A, B, C), triName(D, E, F)) },
    { id: 'order', text: cong(triName(A, B, C), triName(E, F, D)), trap: 'geo_vertices_out_of_order', witness: ORDER_W },
    { id: 'swap', text: cong(triName(A, B, C), triName(D, F, E)) },
    { id: 'flip', text: cong(triName(A, B, C), triName(F, E, D)) },
  ]
  if (new Set(choices.map((c) => c.text)).size !== 4) throw new Error('statement choices collided')
  const segments: GeoSegment[] = [
    { from: A, to: B, ticks: 1 },
    { from: B, to: C, ticks: 2 },
    { from: C, to: A, ticks: 3 },
    { from: D, to: E, ticks: 1 },
    { from: E, to: F, ticks: 2 },
    { from: F, to: D, ticks: 3 },
  ]
  return choiceAnswer(
    'congruentParts',
    'The marks show which sides match. Which statement names the triangles in the same order?',
    { ariaLabel: ariaOf(scene), points, segments },
    'Statement',
    choices,
    'right',
    'geo_vertices_out_of_order',
    'order',
    UNIT4_RULE_IDS.correspondence,
    [`The tick marks pair ${A} with ${D}, ${B} with ${E}, and ${C} with ${F}.`],
    'Congruence statement',
    { case: 'statement' },
    seed,
  )
}

// --- which method --------------------------------------------------------------

interface WhichTrap {
  id: ErrorPatternId
  choice: string
  witness: string
}

const WHICH: readonly {
  id: string
  method: Method | 'none'
  traps: readonly WhichTrap[]
}[] = [
  { id: 'sss', method: 'SSS', traps: [{ id: 'geo_ssa_as_congruence', choice: 'SSA', witness: SSA_W }, { id: 'geo_hl_no_right', choice: 'HL', witness: HL_W }, { id: 'geo_aaa_as_congruence', choice: 'AAA', witness: AAA_W }] },
  { id: 'sas', method: 'SAS', traps: [{ id: 'geo_ssa_as_congruence', choice: 'SSA', witness: SSA_W }, { id: 'geo_hl_no_right', choice: 'HL', witness: HL_W }] },
  { id: 'asa', method: 'ASA', traps: [{ id: 'geo_asa_aas_swapped', choice: 'AAS', witness: SWAP_W }, { id: 'geo_hl_no_right', choice: 'HL', witness: HL_W }] },
  { id: 'aas', method: 'AAS', traps: [{ id: 'geo_asa_aas_swapped', choice: 'ASA', witness: SWAP_W }, { id: 'geo_hl_no_right', choice: 'HL', witness: HL_W }] },
  { id: 'hl', method: 'HL', traps: [{ id: 'geo_sas_not_included', choice: 'SAS', witness: SAS_W }, { id: 'geo_ssa_as_congruence', choice: 'SSA', witness: SSA_W }] },
  { id: 'ssa', method: 'none', traps: [{ id: 'geo_ssa_as_congruence', choice: 'SSA', witness: SSA_W }, { id: 'geo_sas_not_included', choice: 'SAS', witness: SAS_W }, { id: 'geo_hl_no_right', choice: 'HL', witness: HL_W }] },
  { id: 'aaa', method: 'none', traps: [{ id: 'geo_aaa_as_congruence', choice: 'AAA', witness: AAA_W }] },
  { id: 'shared', method: 'SSS', traps: [{ id: 'geo_ssa_as_congruence', choice: 'SSA', witness: SSA_W }, { id: 'geo_hl_no_right', choice: 'HL', witness: HL_W }] },
  { id: 'vertical', method: 'SAS', traps: [{ id: 'geo_ssa_as_congruence', choice: 'SSA', witness: SSA_W }, { id: 'geo_hl_no_right', choice: 'HL', witness: HL_W }] },
  { id: 'parallel', method: 'ASA', traps: [{ id: 'geo_asa_aas_swapped', choice: 'AAS', witness: SWAP_W }] },
]

export function drawWhich(seed: number): GeoBuilt {
  const index = (seed - 1) % WHICH.length
  const spec = WHICH[index]!
  const L = letters(seed, WHICH.length)
  const [A, B, C, D, E, F] = L as unknown as [string, string, string, string, string, string]
  const built = buildWhich(spec.id, A, B, C, D, E, F)
  const got = methodsOf(built.scene)
  if (spec.method === 'none') {
    if (got.length !== 0) throw new Error(`${spec.id}: marks proved ${got.join(',')}`)
  } else if (got.length !== 1 || got[0] !== spec.method) {
    throw new Error(`${spec.id}: expected ${spec.method}, got ${got.join(',') || 'none'}`)
  }
  const promised = spec.traps[Math.floor((seed - 1) / WHICH.length) % spec.traps.length]!
  const buttons: ChoiceDraft[] = [
    { id: 'SSS', text: 'SSS' },
    { id: 'SAS', text: 'SAS' },
    { id: 'ASA', text: 'ASA' },
    { id: 'AAS', text: 'AAS' },
    { id: 'HL', text: 'HL' },
    { id: 'SSA', text: 'SSA' },
    { id: 'AAA', text: 'AAA' },
    { id: 'none', text: 'Not enough information' },
  ]
  for (const trap of spec.traps) {
    const button = buttons.find((b) => b.id === trap.choice)
    if (!button || button.id === (spec.method === 'none' ? 'none' : spec.method)) throw new Error('trap is the answer')
    button.trap = trap.id
    button.witness = trap.witness
  }
  const answerId = spec.method === 'none' ? 'none' : spec.method
  const reveal = [spec.method === 'none' ? 'The marks that are drawn do not show the triangles match.' : `The marks that are drawn are exactly what ${spec.method === 'HL' ? 'a right angle, the side opposite it, and one other side' : 'this picture'} uses.`]
  return choiceAnswer(
    'congruentWhich',
    'Which of these shows that the triangles match?',
    { ariaLabel: ariaOf(built.scene), points: built.points, segments: built.segments, lines: built.lines, angles: built.angles },
    'Method',
    buttons,
    answerId,
    promised.id,
    promised.choice,
    UNIT4_RULE_IDS.methods,
    reveal,
    'Which method',
    { case: spec.id },
    seed,
  )
}

interface WhichFigure {
  scene: Scene
  points: GeoPoint[]
  segments: GeoSegment[]
  lines?: GeoLine[]
  angles: GeoAngleMark[]
}

function buildWhich(id: string, A: string, B: string, C: string, D: string, E: string, F: string): WhichFigure {
  if (id === 'shared') return sharedFigure(A, B, C, D)
  if (id === 'vertical') return verticalFigure(A, B, C, D, E)
  if (id === 'parallel') return parallelFigure(A, B, C, D)
  if (id === 'hl') return hlFigure(A, B, C, D, E, F)
  return pairFigure(id, A, B, C, D, E, F)
}

function pairFigure(id: string, A: string, B: string, C: string, D: string, E: string, F: string): WhichFigure {
  const left = placeTri([A, B, C], 0, id === 'hl' ? 40 : 62, id === 'aaa' ? 48 : 58, 4)
  const scale = id === 'aaa' ? 1.6 : 1
  const right = placeTri([D, E, F], 8, id === 'hl' ? 40 : 62, id === 'aaa' ? 48 : 58, 4 * scale)
  const scene = emptyScene([A, B, C], [D, E, F])
  const segments: GeoSegment[] = [
    { from: A, to: B },
    { from: B, to: C },
    { from: C, to: A },
    { from: D, to: E },
    { from: E, to: F },
    { from: F, to: D },
  ]
  const angles: GeoAngleMark[] = []
  const tick = (from: string, to: string, n: Tick) => {
    const seg = segments.find((s) => s.from === from && s.to === to)
    if (!seg) throw new Error(`no segment ${from}${to}`)
    seg.ticks = n
  }
  const arc = (v: string, from: string, to: string, n: Tick) => {
    angles.push({ vertex: v, from, to, marks: n })
  }
  if (id === 'sss') {
    scene.sides = [
      { a: [A, B], b: [D, E], tick: 1 },
      { a: [B, C], b: [E, F], tick: 2 },
      { a: [C, A], b: [F, D], tick: 3 },
    ]
  } else if (id === 'sas') {
    scene.sides = [
      { a: [A, B], b: [D, E], tick: 1 },
      { a: [B, C], b: [E, F], tick: 2 },
    ]
    scene.angles = [{ a: B, b: E, arc: 1 }]
  } else if (id === 'asa') {
    scene.sides = [{ a: [A, B], b: [D, E], tick: 1 }]
    scene.angles = [
      { a: A, b: D, arc: 1 },
      { a: B, b: E, arc: 2 },
    ]
  } else if (id === 'aas') {
    scene.sides = [{ a: [B, C], b: [E, F], tick: 1 }]
    scene.angles = [
      { a: A, b: D, arc: 1 },
      { a: B, b: E, arc: 2 },
    ]
  } else if (id === 'ssa') {
    scene.sides = [
      { a: [A, B], b: [D, E], tick: 1 },
      { a: [B, C], b: [E, F], tick: 2 },
    ]
    scene.angles = [{ a: A, b: D, arc: 1 }]
  } else if (id === 'aaa') {
    scene.angles = [
      { a: A, b: D, arc: 1 },
      { a: B, b: E, arc: 2 },
      { a: C, b: F, arc: 3 },
    ]
  } else throw new Error(`unknown pair ${id}`)
  for (const s of scene.sides) {
    tick(s.a[0], s.a[1], s.tick)
    tick(s.b[0], s.b[1], s.tick)
  }
  for (const g of scene.angles) {
    arc(g.a, g.a === A ? B : g.a === B ? A : A, g.a === C ? B : C, g.arc)
    arc(g.b, g.b === D ? E : g.b === E ? D : D, g.b === F ? E : F, g.arc)
  }
  return { scene, points: [...left, ...right], segments, angles }
}

function hlFigure(A: string, B: string, C: string, D: string, E: string, F: string): WhichFigure {
  // Right angle at C and at F. Hypotenuse AB-DE, leg BC-EF (they meet at B, not at the right angle).
  const points = [
    pt(A, 0, 3, 'above'),
    pt(B, 4, 0, 'below'),
    pt(C, 0, 0, 'below'),
    pt(D, 8, 3, 'above'),
    pt(E, 12, 0, 'below'),
    pt(F, 8, 0, 'below'),
  ]
  const scene = emptyScene([A, B, C], [D, E, F])
  scene.sides = [
    { a: [A, B], b: [D, E], tick: 1 },
    { a: [B, C], b: [E, F], tick: 2 },
  ]
  scene.rights = [C, F]
  const dot = (u: GeoPoint, v: GeoPoint, w: GeoPoint) => (v.x - u.x) * (w.x - u.x) + (v.y - u.y) * (w.y - u.y)
  if (Math.abs(dot(byId(points, C), byId(points, A), byId(points, B))) > 1e-6) throw new Error('HL left angle is not right')
  if (Math.abs(dot(byId(points, F), byId(points, D), byId(points, E))) > 1e-6) throw new Error('HL right angle is not right')
  return {
    scene,
    points,
    segments: [
      { from: A, to: B, ticks: 1 },
      { from: B, to: C, ticks: 2 },
      { from: C, to: A },
      { from: D, to: E, ticks: 1 },
      { from: E, to: F, ticks: 2 },
      { from: F, to: D },
    ],
    angles: [
      { vertex: C, from: A, to: B, right: true },
      { vertex: F, from: D, to: E, right: true },
    ],
  }
}

function sharedFigure(A: string, B: string, C: string, D: string): WhichFigure {
  // Kite: AB = AD, CB = CD, shared AC. Ticks only. No angles.
  const points = [pt(A, 0, 0, 'left'), pt(C, 6, 0, 'right'), pt(B, 2, 3, 'above'), pt(D, 2, -3, 'below')]
  const scene = emptyScene([A, B, C], [A, D, C])
  scene.sides = [
    { a: [A, B], b: [A, D], tick: 1 },
    { a: [C, B], b: [C, D], tick: 2 },
  ]
  scene.shared = [[A, C]]
  const d = (p: string, q: string) => {
    const u = byId(points, p)
    const v = byId(points, q)
    return Math.hypot(u.x - v.x, u.y - v.y)
  }
  if (Math.abs(d(A, B) - d(A, D)) > 0.02 || Math.abs(d(C, B) - d(C, D)) > 0.02) throw new Error('shared sides are not equal')
  return {
    scene,
    points,
    segments: [
      { from: A, to: B, ticks: 1 },
      { from: B, to: C, ticks: 2 },
      { from: C, to: A },
      { from: A, to: D, ticks: 1 },
      { from: D, to: C, ticks: 2 },
    ],
    angles: [],
  }
}

function verticalFigure(A: string, B: string, C: string, D: string, E: string): WhichFigure {
  // A-E-C and B-E-D are straight. Vertical angles at E are the included pair. No arcs.
  const points = [pt(A, 0, 2, 'above'), pt(E, 3, 0, 'above'), pt(C, 6, -2, 'below'), pt(B, 0, -1.2, 'below'), pt(D, 6, 1.2, 'above')]
  const scene = emptyScene([A, E, B], [C, E, D])
  scene.sides = [
    { a: [A, E], b: [C, E], tick: 1 },
    { a: [B, E], b: [D, E], tick: 2 },
  ]
  scene.vertical = [`${A}${E}${B}-${C}${E}${D}`]
  const opp = (p: string, q: string, r: string) => {
    const u = byId(points, p)
    const m = byId(points, q)
    const v = byId(points, r)
    const d1 = { x: u.x - m.x, y: u.y - m.y }
    const d2 = { x: v.x - m.x, y: v.y - m.y }
    const cross = d1.x * d2.y - d1.y * d2.x
    const dot = d1.x * d2.x + d1.y * d2.y
    if (Math.abs(cross) > 1e-6 || dot >= 0) throw new Error(`${p}${q}${r} is not a straight line`)
  }
  opp(A, E, C)
  opp(B, E, D)
  return {
    scene,
    points,
    segments: [
      { from: A, to: E, ticks: 1 },
      { from: E, to: C, ticks: 1 },
      { from: B, to: E, ticks: 2 },
      { from: E, to: D, ticks: 2 },
      { from: A, to: B },
      { from: C, to: D },
    ],
    angles: [],
  }
}

function parallelFigure(A: string, B: string, C: string, D: string): WhichFigure {
  // Non-rectangular parallelogram. Diagonal AC is the included side of the two alternate-interior pairs.
  const points = [pt(A, 0, 0, 'below'), pt(B, 4, 0, 'below'), pt(C, 5.2, 2.2, 'above'), pt(D, 1.2, 2.2, 'above')]
  const scene = emptyScene([A, B, C], [C, D, A])
  scene.shared = [[A, C]]
  scene.parallel = [
    { line: `${A}${B}||${D}${C}`, arrows: 1 },
    { line: `${A}${D}||${B}${C}`, arrows: 2 },
  ]
  scene.alt = [`${B}${A}${C}-${D}${C}${A}`, `${B}${C}${A}-${D}${A}${C}`]
  const dir = (p: string, q: string) => {
    const u = byId(points, p)
    const v = byId(points, q)
    return { x: v.x - u.x, y: v.y - u.y }
  }
  const ab = dir(A, B)
  const dc = dir(D, C)
  const ad = dir(A, D)
  const bc = dir(B, C)
  if (Math.abs(ab.x * dc.y - ab.y * dc.x) > 1e-6) throw new Error('AB is not parallel to DC')
  if (Math.abs(ad.x * bc.y - ad.y * bc.x) > 1e-6) throw new Error('AD is not parallel to BC')
  const ang = wedge(byId(points, A), byId(points, B), byId(points, D))
  if (Math.abs(ang - 90) < 2) throw new Error('parallelogram is a rectangle')
  return {
    scene,
    points,
    segments: [{ from: A, to: C }],
    lines: [
      { through: [A, B], arrows: 1 },
      { through: [D, C], arrows: 1 },
      { through: [A, D], arrows: 2 },
      { through: [B, C], arrows: 2 },
    ],
    angles: [],
  }
}

// --- algebra with matching parts ----------------------------------------------

interface AngJob {
  a: Lin
  d: Lin
  e: Lin
  x: number
  measure: number
  trapX: number
  b: number
  c: number
}
interface SideJob {
  ab: Lin
  de: Lin
  ef: Lin
  x: number
  measure: number
  trapX: number
  sides: [number, number, number]
}

const ANGLES: readonly AngJob[] = [
  { a: lin(2, 20), d: lin(4, 4), e: lin(1, 62), x: 8, measure: 36, trapX: 42, b: 70, c: 74 },
  { a: lin(3, 6), d: lin(5, -10), e: lin(2, 40), x: 8, measure: 30, trapX: 34, b: 56, c: 94 },
  { a: lin(4, 4), d: lin(2, 22), e: lin(3, 14), x: 9, measure: 40, trapX: 10, b: 41, c: 99 },
  { a: lin(5, 5), d: lin(3, 25), e: lin(4, 8), x: 10, measure: 55, trapX: 3, b: 48, c: 77 },
]

const SIDES: readonly SideJob[] = [
  { ab: lin(2, 9), de: lin(4, -7), ef: lin(1, 22), x: 8, measure: 25, trapX: 13, sides: [25, 18, 20] },
  { ab: lin(3, 3), de: lin(5, -13), ef: lin(4, 1), x: 8, measure: 27, trapX: 2, sides: [27, 20, 14] },
  { ab: lin(2, 14), de: lin(5, -10), ef: lin(1, 28), x: 8, measure: 30, trapX: 14, sides: [30, 16, 20] },
  { ab: lin(4, 6), de: lin(6, -12), ef: lin(2, 20), x: 9, measure: 42, trapX: 7, sides: [42, 15, 30] },
]

function checkJob(where: string, left: Lin, right: Lin, x: number, measure: number, trapLeft: Lin, trapX: number): void {
  const solved = solveEqual(left, right)
  if (!solved || solved.d !== 1 || solved.n !== x) throw new Error(`${where}: x is not ${x}`)
  if (evalLin(left, x) !== measure || evalLin(right, x) !== measure) throw new Error(`${where}: measure is not ${measure}`)
  const trap = solveEqual(left, trapLeft)
  if (!trap || trap.d !== 1 || trap.n !== trapX || trapX === x) throw new Error(`${where}: trap x is not ${trapX}`)
}

export function drawSolve(seed: number): GeoBuilt {
  const n = (seed - 1) % (ANGLES.length + SIDES.length)
  const L = letters(seed, ANGLES.length + SIDES.length)
  const [A, B, C, D, E, F] = L as unknown as [string, string, string, string, string, string]
  if (n < ANGLES.length) return angleSolve(ANGLES[n]!, A, B, C, D, E, F)
  return sideSolve(SIDES[n - ANGLES.length]!, A, B, C, D, E, F)
}

function angleSolve(job: AngJob, A: string, B: string, C: string, D: string, E: string, F: string): GeoBuilt {
  checkJob('angle', job.a, job.d, job.x, job.measure, job.e, job.trapX)
  if (job.measure + job.b + job.c !== 180) throw new Error('angles do not add to 180')
  const prompt = `${cong(triName(A, B, C), triName(D, E, F))}. m∠${A} = ${formatLin(job.a)}, m∠${D} = ${formatLin(job.d)}, and m∠${E} = ${formatLin(job.e)}. Find x, then m∠${A}.`
  const points = [...placeTri([A, B, C], 0, job.measure, job.b, 4.5), ...placeTri([D, E, F], 9, job.measure, job.b, 4.5)]
  assertAngles(points, [A, B, C], job.measure, job.b, 'solve angle')
  assertAngles(points, [D, E, F], job.measure, job.b, 'solve angle copy')
  const labels = [
    { vertex: A, from: B, to: C, label: angleLabel(job.a), radius: 22 },
    { vertex: D, from: E, to: F, label: angleLabel(job.d), radius: 22 },
    { vertex: E, from: D, to: F, label: angleLabel(job.e), radius: 26 },
  ]
  const figure: GeoFigureSpec = {
    ariaLabel: `Triangles ${A}${B}${C} and ${D}${E}${F}. Angle ${A} is labeled ${angleLabel(job.a)}, angle ${D} is labeled ${angleLabel(job.d)}, and angle ${E} is labeled ${angleLabel(job.e)}. No matching marks.`,
    points,
    segments: [
      { from: A, to: B },
      { from: B, to: C },
      { from: C, to: A },
      { from: D, to: E },
      { from: E, to: F },
      { from: F, to: D },
    ],
    angles: labels,
  }
  hide('solve angle', `${prompt}\n${figure.ariaLabel}\n${labels.map((g) => g.label).join(' ')}`, [String(job.x), String(job.measure)])
  const stages = numberStages(job.x, { id: 'geo_vertices_out_of_order', text: String(job.trapX), witness: VERT_W }, `m∠${A}`, job.measure, 'deg', null, UNIT4_RULE_IDS.parts)
  return numberAnswer('congruentSolve', prompt, figure, stages, [5, 6, 7], [job.measure, job.b, job.c], 'geo_vertices_out_of_order', 'x', String(job.trapX), 'Corresponding parts', { case: 'angle' })
}

function sideSolve(job: SideJob, A: string, B: string, C: string, D: string, E: string, F: string): GeoBuilt {
  checkJob('side', job.ab, job.de, job.x, job.measure, job.ef, job.trapX)
  const [c, a, b] = job.sides
  if (a + b <= c || a + c <= b || b + c <= a) throw new Error('sides are not a triangle')
  const angA = Math.round((Math.acos((b * b + c * c - a * a) / (2 * b * c)) * 180) / Math.PI)
  const angB = Math.round((Math.acos((a * a + c * c - b * b) / (2 * a * c)) * 180) / Math.PI)
  const angC = 180 - angA - angB
  if (angA <= 0 || angB <= 0 || angC <= 0) throw new Error('side angles failed')
  const prompt = `${cong(triName(A, B, C), triName(D, E, F))}. ${sideName(A, B)} = ${formatLin(job.ab)}, ${sideName(D, E)} = ${formatLin(job.de)}, and ${sideName(E, F)} = ${formatLin(job.ef)}. Find x, then ${sideName(A, B)}.`
  const points = [...placeTri([A, B, C], 0, angA, angB, 4.5), ...placeTri([D, E, F], 9, angA, angB, 4.5)]
  const figure: GeoFigureSpec = {
    ariaLabel: `Triangles ${A}${B}${C} and ${D}${E}${F}. Side ${A}${B} is labeled ${formatLin(job.ab)}, side ${D}${E} is labeled ${formatLin(job.de)}, and side ${E}${F} is labeled ${formatLin(job.ef)}. No matching marks.`,
    points,
    segments: [
      { from: A, to: B, label: formatLin(job.ab), labelSide: 'below' },
      { from: B, to: C },
      { from: C, to: A },
      { from: D, to: E, label: formatLin(job.de), labelSide: 'below' },
      { from: E, to: F, label: formatLin(job.ef), labelSide: 'below' },
      { from: F, to: D },
    ],
  }
  hide('solve side', `${prompt}\n${figure.ariaLabel}`, [String(job.x), String(job.measure)])
  const stages = numberStages(job.x, { id: 'geo_vertices_out_of_order', text: String(job.trapX), witness: VERT_W }, sideName(A, B), job.measure, 'len', null, UNIT4_RULE_IDS.parts)
  return numberAnswer('congruentSolve', prompt, figure, stages, [...job.sides], [angA, angB, angC], 'geo_vertices_out_of_order', 'x', String(job.trapX), 'Corresponding parts', { case: 'side' })
}

// --- isosceles and equilateral -------------------------------------------------

interface ThmJob {
  b: Lin
  c: Lin
  vertex: Lin
  x: number
  base: number
  trapX: number
  sides: [number, number, number]
}
interface ConvJob {
  ab: Lin
  ac: Lin
  bc: Lin
  x: number
  side: number
  trapX: number
}
interface EqJob {
  ab: Lin
  bc: Lin
  ac: Lin
  x: number
  side: number
}

const THEOREM: readonly ThmJob[] = [
  { b: lin(5, 0), c: lin(7, -16), vertex: lin(17, -36), x: 8, base: 40, trapX: 3, sides: [10, 10, 8] },
  { b: lin(3, 9), c: lin(5, -7), vertex: lin(30, -126), x: 8, base: 33, trapX: 5, sides: [9, 9, 6] },
  { b: lin(2, 16), c: lin(4, 0), vertex: lin(16, -12), x: 8, base: 32, trapX: 2, sides: [8, 8, 7] },
  { b: lin(6, -6), c: lin(4, 10), vertex: lin(24, -96), x: 8, base: 42, trapX: 5, sides: [11, 11, 8] },
]

const CONVERSE: readonly ConvJob[] = [
  { ab: lin(4, 2), ac: lin(6, -14), bc: lin(3, 4), x: 8, side: 34, trapX: 2 },
  { ab: lin(3, 6), ac: lin(5, -10), bc: lin(1, 16), x: 8, side: 30, trapX: 5 },
  { ab: lin(5, -5), ac: lin(3, 13), bc: lin(2, 16), x: 9, side: 40, trapX: 7 },
  { ab: lin(2, 18), ac: lin(4, 2), bc: lin(3, 6), x: 8, side: 34, trapX: 12 },
]

const EQUILATERAL: readonly EqJob[] = [
  { ab: lin(2, 6), bc: lin(3, -2), ac: lin(4, -10), x: 8, side: 22 },
  { ab: lin(3, 3), bc: lin(5, -13), ac: lin(4, -5), x: 8, side: 27 },
  { ab: lin(2, 14), bc: lin(4, -4), ac: lin(3, 5), x: 9, side: 32 },
  { ab: lin(4, 4), bc: lin(6, -12), ac: lin(5, -4), x: 8, side: 36 },
]

export function drawIsosceles(seed: number): GeoBuilt {
  const family = (seed - 1) % 3
  const n = Math.floor((seed - 1) / 3) % 4
  const [A, B, C] = letters(seed, 12)
  if (!A || !B || !C) throw new Error('letters')
  if (family === 0) return drawTheorem(THEOREM[n]!, A, B, C)
  if (family === 1) return drawConverse(CONVERSE[n]!, A, B, C)
  return drawEquilateral(EQUILATERAL[n]!, A, B, C)
}

function apexPoints(A: string, B: string, C: string, apex: number): GeoPoint[] {
  const base = 4
  const height = base / 2 / Math.tan(rad(apex / 2))
  return [pt(B, 0, 0, 'below'), pt(C, base, 0, 'below'), pt(A, base / 2, height, 'above')]
}

function drawTheorem(job: ThmJob, A: string, B: string, C: string): GeoBuilt {
  checkJob('theorem', job.b, job.c, job.x, job.base, job.vertex, job.trapX)
  const vertex = 180 - 2 * job.base
  if (evalLin(job.vertex, job.x) !== vertex) throw new Error('vertex expression missed')
  if (job.sides[0] !== job.sides[1] || job.sides[0] + job.sides[1] <= job.sides[2]) throw new Error('theorem sides')
  const prompt = `${sideName(A, B)} and ${sideName(A, C)} match. m∠${A} = ${formatLin(job.vertex)}, m∠${B} = ${formatLin(job.b)}, and m∠${C} = ${formatLin(job.c)}. Find x, then m∠${B}.`
  const points = apexPoints(A, B, C, vertex)
  assertAngles(points, [A, B, C], vertex, job.base, 'theorem')
  const labels = [
    { vertex: A, from: B, to: C, label: angleLabel(job.vertex), radius: 20 },
    { vertex: B, from: A, to: C, label: angleLabel(job.b), radius: 22 },
    { vertex: C, from: B, to: A, label: angleLabel(job.c), radius: 22 },
  ]
  const figure: GeoFigureSpec = {
    ariaLabel: `Triangle ${A}${B}${C}. Sides ${A}${B} and ${A}${C} have 1 tick. Angle ${A} is labeled ${angleLabel(job.vertex)}, angle ${B} is labeled ${angleLabel(job.b)}, and angle ${C} is labeled ${angleLabel(job.c)}.`,
    points,
    segments: [
      { from: A, to: B, ticks: 1 },
      { from: A, to: C, ticks: 1 },
      { from: B, to: C },
    ],
    angles: labels,
  }
  hide('theorem', `${prompt}\n${figure.ariaLabel}`, [String(job.x), String(job.base)])
  const stages = numberStages(job.x, { id: 'geo_base_angles_wrong_vertex', text: String(job.trapX), witness: BASE_W }, `m∠${B}`, job.base, 'deg', null, UNIT4_RULE_IDS.base)
  return numberAnswer('isoscelesSolve', prompt, figure, stages, [...job.sides], [vertex, job.base, job.base], 'geo_base_angles_wrong_vertex', 'x', String(job.trapX), 'Isosceles triangle', { case: 'theorem' })
}

function drawConverse(job: ConvJob, A: string, B: string, C: string): GeoBuilt {
  checkJob('converse', job.ab, job.ac, job.x, job.side, job.bc, job.trapX)
  const bc = evalLin(job.bc, job.x)
  if (job.side + job.side <= bc) throw new Error('converse sides')
  const angB = Math.round((Math.acos((job.side * job.side + bc * bc - job.side * job.side) / (2 * job.side * bc)) * 180) / Math.PI)
  const angA = 180 - 2 * angB
  if (angA <= 0 || angB <= 0) throw new Error('converse angles')
  const prompt = `∠${B} and ∠${C} match. ${sideName(A, B)} = ${formatLin(job.ab)}, ${sideName(A, C)} = ${formatLin(job.ac)}, and ${sideName(B, C)} = ${formatLin(job.bc)}. Find x, then ${sideName(A, B)}.`
  const points = apexPoints(A, B, C, angA)
  assertAngles(points, [A, B, C], angA, angB, 'converse')
  const figure: GeoFigureSpec = {
    ariaLabel: `Triangle ${A}${B}${C}. Angles at ${B} and ${C} have 1 arc. Side ${A}${B} is labeled ${formatLin(job.ab)}, side ${A}${C} is labeled ${formatLin(job.ac)}, and side ${B}${C} is labeled ${formatLin(job.bc)}.`,
    points,
    segments: [
      { from: A, to: B, label: formatLin(job.ab), labelSide: 'above' },
      { from: A, to: C, label: formatLin(job.ac), labelSide: 'above' },
      { from: B, to: C, label: formatLin(job.bc), labelSide: 'below' },
    ],
    angles: [
      { vertex: B, from: A, to: C, marks: 1 },
      { vertex: C, from: B, to: A, marks: 1 },
    ],
  }
  hide('converse', `${prompt}\n${figure.ariaLabel}`, [String(job.x), String(job.side)])
  const stages = numberStages(job.x, { id: 'geo_base_angles_wrong_vertex', text: String(job.trapX), witness: CONV_W }, sideName(A, B), job.side, 'len', null, UNIT4_RULE_IDS.base)
  return numberAnswer('isoscelesSolve', prompt, figure, stages, [job.side, job.side, bc], [angA, angB, angB], 'geo_base_angles_wrong_vertex', 'x', String(job.trapX), 'Isosceles triangle', { case: 'converse' })
}

function drawEquilateral(job: EqJob, A: string, B: string, C: string): GeoBuilt {
  const ab = solveEqual(job.ab, job.bc)
  const ac = solveEqual(job.ab, job.ac)
  if (!ab || !ac || ab.d !== 1 || ac.d !== 1 || ab.n !== job.x || ac.n !== job.x) throw new Error('equilateral x')
  if (evalLin(job.ab, job.x) !== job.side || evalLin(job.bc, job.x) !== job.side || evalLin(job.ac, job.x) !== job.side) {
    throw new Error('equilateral side')
  }
  const prompt = `${sideName(A, B)}, ${sideName(B, C)}, and ${sideName(A, C)} all match. ${sideName(A, B)} = ${formatLin(job.ab)}, ${sideName(B, C)} = ${formatLin(job.bc)}, and ${sideName(A, C)} = ${formatLin(job.ac)}. Find x, then ${sideName(A, B)}.`
  const points = apexPoints(A, B, C, 60)
  assertAngles(points, [A, B, C], 60, 60, 'equilateral')
  const figure: GeoFigureSpec = {
    ariaLabel: `Triangle ${A}${B}${C}. All three sides have 1 tick. Side ${A}${B} is labeled ${formatLin(job.ab)}, side ${B}${C} is labeled ${formatLin(job.bc)}, and side ${A}${C} is labeled ${formatLin(job.ac)}.`,
    points,
    segments: [
      { from: A, to: B, ticks: 1, label: formatLin(job.ab), labelSide: 'above' },
      { from: B, to: C, ticks: 1, label: formatLin(job.bc), labelSide: 'below' },
      { from: C, to: A, ticks: 1, label: formatLin(job.ac), labelSide: 'above' },
    ],
  }
  hide('equilateral', `${prompt}\n${figure.ariaLabel}`, [String(job.x), String(job.side)])
  const stages = numberStages(job.x, null, sideName(A, B), job.side, 'len', { id: 'geo_equilateral_angle_for_side', text: '60', witness: EQ_W }, UNIT4_RULE_IDS.equilateral)
  return numberAnswer('isoscelesSolve', prompt, figure, stages, [job.side, job.side, job.side], [60, 60, 60], 'geo_equilateral_angle_for_side', 'result', '60', 'Equilateral triangle', { case: 'equilateral' })
}
