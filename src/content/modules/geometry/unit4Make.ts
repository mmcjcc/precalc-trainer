/**
 * Honors geometry Unit 4. Every problem is drawn from its seed: letters, correspondence,
 * orientation, and numbers. A figure shows only the marks that are given. The aria lists
 * those marks in a fixed order so a later test can decide the method without this file's answer.
 *
 * Answers never use 4, 6, 11, 15, 17, 19, 23, 24, 26, 29, 37, 41, 53, 60, 64, 90, 165, or 180.
 */
import { ERROR_PATTERNS } from '@/engine'
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { GeometryAnswer, GeometryStageId } from '@/content/types'
import type { ErrorPatternId, GeoAngleMark, GeoFigureSpec, GeoLine, GeoPoint, GeoSegment } from '@/shared/types'
import type { GeoBuilt } from './build'
import { angleLabel, evalLin, formatLin, lin, solveEqual, type Lin } from './expr'
import { exampleShowsAnswer, exposed } from './grade'
import {
  PERMS,
  SCALENE,
  anglesAt,
  applyPerm,
  ariaOf,
  byId,
  dist,
  emptyScene,
  methodsOf,
  pickLetters,
  placePair,
  placeRightPair,
  placeScaledPair,
  preservingCount,
  pt,
  sameCongruence,
  sideName,
  wedge,
  type Method,
  type Scene,
  type Tick,
} from './unit4Geom'
import { UNIT4_RULE_IDS } from './unit4Rules'

const X_HINT = 'A number, like 11 or x = 11.'
const DEG_HINT = 'Degrees, like 23, 23°, or 23 deg.'
const LEN_HINT = 'A length, like 41.'
const BANNED = new Set([4, 6, 11, 15, 17, 19, 23, 24, 26, 29, 37, 41, 53, 60, 64, 90, 165, 180])
const X_POOL = [2, 3, 5, 7, 8, 9, 10, 12, 13, 14, 16, 18]
const ROTS = [70, 110, 160, 200, 250, 300]
const WHICH_PROMPT = 'Which postulate or theorem, if any, proves the triangles congruent?'

const ORDER_W = 'That order pairs vertices the marks do not pair. Read the correspondence, not the alphabet and not the picture.'
const SSA_W = 'SSA is two sides and a non-included angle. It does not prove the triangles congruent. SAS needs the included angle.'
const AAA_W = 'AAA is three pairs of angles. That shows the same shape, not the same size, so it does not prove the triangles congruent.'
const HL_W = 'HL needs a right angle in each triangle and the hypotenuse. These triangles have no right angle, and SSA is a different pair of parts.'
const SAS_W = 'SAS needs the included angle, the one between the two sides. The angle here is not between them, so the pair is SSA.'
const SWAP_W = 'That choice puts the side on the wrong side of the two angles. One of them is the side between the angles, and the other is a side that is not.'
const SHARED_W = 'A side that lies in both triangles is congruent to itself. Leaving that pair out drops a pair the figure already shows.'
const VERT_MISSED_W = 'The two lines cross, so the opposite angles are congruent. That pair still counts toward proving the triangles congruent.'
const BASE_W = 'That sets the vertex angle equal to a base angle. The base angles are the ones opposite the congruent sides.'
const CONV_W = 'That sets a leg equal to the base. The congruent sides are the ones opposite the congruent angles.'
const EQ_W = 'That number is an angle of an equilateral triangle. The question asks for a side.'
const VERT_W = 'That pairs a part with one that does not correspond. Read the order of the vertices in the statement.'

type Tri = [string, string, string]

interface ChoiceDraft {
  id: string
  text: string
  trap?: ErrorPatternId
  witness?: string
}

function triName(t: Tri): string {
  return `△${t.join('')}`
}

function cong(left: string, right: string): string {
  return `${left} ≅ ${right}`
}

function segKey(a: string, b: string): string {
  return a < b ? `${a}${b}` : `${b}${a}`
}

/** Side i written with the earlier vertex of the name first, so the third side is AC rather than CA. */
function sideLabel(t: Tri, i: number): string {
  if (i === 2) return `${t[0]}${t[2]}`
  return sideName(t.join(''), i)
}

function angLetter(t: Tri, i: number): string {
  return `∠${t[i]}`
}

function blobOf(id: ErrorPatternId, witness: string): string {
  const info = ERROR_PATTERNS[id]
  return `${info.title}\n${info.lesson}\n${info.example}\n${witness}`
}

/** The flow compares with a raw substring, so a short answer must not sit inside the lesson or the example. */
function rawLeaks(id: ErrorPatternId, witness: string, display: string): boolean {
  const info = ERROR_PATTERNS[id]
  if (exampleShowsAnswer(info.example, display)) return true
  return blobOf(id, witness).includes(display)
}

function hide(where: string, blob: string, answers: string[]): void {
  for (const answer of answers) {
    if (exposed(blob, answer)) throw new Error(`${where}: ${answer} is on screen`)
    if (BANNED.has(Number(answer))) throw new Error(`${where}: ${answer} is reserved`)
  }
}

function noRight(points: GeoPoint[], ids: Tri, tol = 2): boolean {
  return anglesAt(points, ids).every((a) => Math.abs(a - 90) >= tol)
}

function drawnScalene(points: GeoPoint[], ids: Tri): boolean {
  const lens = [0, 1, 2].map((i) => dist(points, ids[i], ids[(i + 1) % 3]!))
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      const mx = Math.max(lens[i]!, lens[j]!)
      if (mx === 0 || Math.abs(lens[i]! - lens[j]!) / mx <= 0.1) return false
    }
  }
  return true
}

function orient(rng: Rng): { rot: number; reflect: boolean; ang: readonly [number, number, number] } {
  return { rot: rng.pick(ROTS), reflect: rng.chance(0.5), ang: rng.pick(SCALENE) }
}

function named(rng: Rng): { t1: Tri; t2: Tri; perm: number } {
  const letters = pickLetters(rng, 6)
  const perm = rng.int(0, 5)
  const t1: Tri = [letters[0]!, letters[1]!, letters[2]!]
  const t2 = applyPerm([letters[3]!, letters[4]!, letters[5]!], PERMS[perm]!)
  return { t1, t2, perm }
}

function segsOf(ids: Tri, ticks: Map<string, Tick>): GeoSegment[] {
  const out: GeoSegment[] = []
  for (let i = 0; i < 3; i++) {
    const a = ids[i]!
    const b = ids[(i + 1) % 3]!
    const n = ticks.get(segKey(a, b))
    out.push(n ? { from: a, to: b, ticks: n } : { from: a, to: b })
  }
  return out
}

function arcAt(ids: Tri, i: number, n: Tick): GeoAngleMark {
  return { vertex: ids[i]!, from: ids[(i + 1) % 3]!, to: ids[(i + 2) % 3]!, marks: n }
}

function squareAt(ids: Tri, i: number): GeoAngleMark {
  return { vertex: ids[i]!, from: ids[(i + 1) % 3]!, to: ids[(i + 2) % 3]!, right: true }
}

function choiceAnswer(
  question: GeometryAnswer['question'],
  prompt: string,
  figure: GeoFigureSpec,
  label: string,
  hint: string,
  nudge: string,
  choices: ChoiceDraft[],
  answerId: string,
  trapId: ErrorPatternId,
  trapChoice: string,
  ruleCard: string,
  reveal: string[],
  title: string,
  params: Record<string, string | number | boolean>,
  seed: number,
): GeoBuilt {
  const shuffled = makeRng(mixSeed(seed, 4)).shuffle(choices)
  const answer = shuffled.find((c) => c.id === answerId)
  if (!answer) throw new Error('missing correct choice')
  const display = answer.text
  for (const choice of shuffled) {
    if (!choice.trap || !choice.witness) continue
    if (rawLeaks(choice.trap, choice.witness, display)) throw new Error(`${choice.trap} leaks ${display}`)
  }
  const traps = shuffled
    .filter((c): c is ChoiceDraft & { trap: ErrorPatternId } => Boolean(c.trap))
    .map((c) => ({ id: c.trap, text: c.id, witness: c.witness ?? 'That choice does not answer this part.' }))
  const stage: GeometryAnswer['stages'][number] = {
    id: 'a',
    kind: 'choice',
    label,
    hint,
    nudge,
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
  const xStage: GeometryAnswer['stages'][number] = {
    id: 'x',
    kind: 'number',
    label: 'x',
    hint: X_HINT,
    answerText: String(x),
    nudge: 'Set the two corresponding parts equal, then solve for x.',
    ruleCard,
    reveal: [`The two corresponding parts give one equation, and x = ${x}.`],
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
    reveal: [`Put ${x} into the part the question asks for.`],
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
  params: Record<string, string | number | boolean>,
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

function centroid(points: GeoPoint[], ids: string[]): { x: number; y: number } {
  const pts = ids.map((id) => byId(points, id))
  return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length }
}

function direction(c: { x: number; y: number }, p: GeoPoint): number {
  return Math.atan2(p.y - c.y, p.x - c.x)
}

function closestId(points: GeoPoint[], ids: string[], target: number): string {
  const c = centroid(points, ids)
  let best = ids[0]!
  let bestD = 99
  for (const id of ids) {
    let d = direction(c, byId(points, id)) - target
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    if (Math.abs(d) < bestD) {
      bestD = Math.abs(d)
      best = id
    }
  }
  return best
}

function alphaImage(source: Tri, target: Tri, index: number): number {
  const ranks = [...source].map((ch, i) => ({ ch, i })).sort((a, b) => (a.ch < b.ch ? -1 : 1))
  const rank = ranks.findIndex((item) => item.i === index)
  const ordered = [...target].map((ch, i) => ({ ch, i })).sort((a, b) => (a.ch < b.ch ? -1 : 1))
  return ordered[rank]!.i
}

function sidePoint(points: GeoPoint[], a: string, b: string): GeoPoint {
  const u = byId(points, a)
  const v = byId(points, b)
  return pt('_', (u.x + v.x) / 2, (u.y + v.y) / 2, 'above')
}

export function drawParts(seed: number): GeoBuilt {
  if ((seed - 1) % 2 === 0) return namePart(seed)
  return statementPart(seed)
}

function namePart(seed: number): GeoBuilt {
  for (let attempt = 0; attempt < 40; attempt++) {
    const rng = makeRng(mixSeed(seed, 20 + attempt))
    const { t1, t2, perm } = named(rng)
    const { rot, reflect, ang } = orient(rng)
    const points = placePair(t1, t2, ang[0], ang[1], 4.2, rot, reflect, 2.6)
    if (!drawnScalene(points, t1) || !noRight(points, t1)) continue
    const angle = rng.chance(0.5)
    const askSecond = rng.chance(0.5)
    const index = rng.int(0, 2)
    const asked = askSecond ? t2 : t1
    const source = askSecond ? t1 : t2
    const correct = index
    const alpha = alphaImage(source, asked, index)
    let positional = index
    if (angle) {
      const srcC = centroid(points, [...source])
      const hit = closestId(points, [...asked], direction(srcC, byId(points, source[index]!)))
      positional = asked.indexOf(hit)
    } else {
      const srcMid = sidePoint(points, source[index]!, source[(index + 1) % 3]!)
      const srcC = centroid(points, [...source])
      let best = 0
      let bestD = 99
      const askedC = centroid(points, [...asked])
      const target = direction(srcC, srcMid)
      for (let i = 0; i < 3; i++) {
        const mid = sidePoint(points, asked[i]!, asked[(i + 1) % 3]!)
        let d = direction(askedC, mid) - target
        while (d > Math.PI) d -= 2 * Math.PI
        while (d < -Math.PI) d += 2 * Math.PI
        if (Math.abs(d) < bestD) {
          bestD = Math.abs(d)
          best = i
        }
      }
      positional = best
    }
    const trapAt = alpha !== correct ? alpha : positional !== correct ? positional : -1
    if (trapAt < 0) continue
    const texts = angle
      ? [0, 1, 2].map((i) => angLetter(asked, i))
      : [0, 1, 2].map((i) => sideLabel(asked, i))
    if (new Set(texts).size !== 3) continue
    const extra = angle ? sideLabel(asked, (correct + 1) % 3) : angLetter(asked, (correct + 1) % 3)
    if (texts.includes(extra)) continue
    const choices: ChoiceDraft[] = [0, 1, 2].map((i) => {
      const draft: ChoiceDraft = { id: i === correct ? 'right' : i === trapAt ? 'order' : `w${i}`, text: texts[i]! }
      if (i === trapAt) {
        draft.trap = 'geo_vertices_out_of_order'
        draft.witness = ORDER_W
      }
      return draft
    })
    choices.push({ id: 'extra', text: extra })
    if (new Set(choices.map((c) => c.text)).size !== 4) continue
    if (!choices.some((c) => c.id === 'order' && c.trap)) continue
    const prompt = angle
      ? `${cong(triName(t1), triName(t2))}. Which angle of ${triName(asked)} corresponds to ${angLetter(source, index)}?`
      : `${cong(triName(t1), triName(t2))}. Which side of ${triName(asked)} corresponds to ${sideLabel(source, index)}?`
    const scene = emptyScene(t1, t2)
    return choiceAnswer(
      'congruentParts',
      prompt,
      {
        ariaLabel: ariaOf(scene),
        points,
        segments: [...segsOf(t1, new Map()), ...segsOf(t2, new Map())],
      },
      angle ? 'Corresponding angle' : 'Corresponding side',
      'Read the order of the vertices in the statement.',
      'The first letter corresponds to the first letter. The picture and the alphabet do not decide it.',
      choices,
      'right',
      'geo_vertices_out_of_order',
      'order',
      UNIT4_RULE_IDS.correspondence,
      [angle ? `${angLetter(source, index)} corresponds to ${angLetter(asked, correct)}.` : `${sideLabel(source, index)} corresponds to ${sideLabel(asked, correct)}.`],
      'Corresponding parts',
      { mode: 'name', perm, case: angle ? 'angle' : 'side' },
      seed,
    )
  }
  throw new Error(`gc.parts/${seed}: no naming problem`)
}

function statementPart(seed: number): GeoBuilt {
  for (let attempt = 0; attempt < 24; attempt++) {
    const rng = makeRng(mixSeed(seed, 50 + attempt))
    const { t1, t2, perm } = named(rng)
    const { rot, reflect, ang } = orient(rng)
    const kind = rng.pick(['SSS', 'SAS', 'ASA'] as const)
    const shift = rng.int(0, 2)
    const scene = emptyScene(t1, t2)
    const ticks = new Map<string, Tick>()
    const mark = (i: number, n: Tick) => {
      ticks.set(segKey(t1[i]!, t1[(i + 1) % 3]!), n)
      ticks.set(segKey(t2[i]!, t2[(i + 1) % 3]!), n)
      scene.sides.push({ a: [t1[i]!, t1[(i + 1) % 3]!], b: [t2[i]!, t2[(i + 1) % 3]!], tick: n })
    }
    const angles: GeoAngleMark[] = []
    if (kind === 'SSS') {
      mark(0, 1)
      mark(1, 2)
      mark(2, 3)
    } else if (kind === 'SAS') {
      const v = shift
      mark((v + 2) % 3, 1)
      mark(v, 2)
      scene.angles.push({ a: t1[v]!, b: t2[v]!, arc: 1 })
      angles.push(arcAt(t1, v, 1), arcAt(t2, v, 1))
    } else {
      const s = shift
      mark(s, 1)
      scene.angles.push({ a: t1[s]!, b: t2[s]!, arc: 1 }, { a: t1[(s + 1) % 3]!, b: t2[(s + 1) % 3]!, arc: 2 })
      angles.push(arcAt(t1, s, 1), arcAt(t2, s, 1), arcAt(t1, (s + 1) % 3, 2), arcAt(t2, (s + 1) % 3, 2))
    }
    const got = methodsOf(scene)
    if (got.length !== 1 || got[0] !== kind || preservingCount(scene) !== 1) continue
    const points = placePair(t1, t2, ang[0], ang[1], 4.2, rot, reflect, 2.6)
    if (!drawnScalene(points, t1) || !drawnScalene(points, t2) || !noRight(points, t1)) continue
    const correct = cong(triName(t1), triName(t2))
    const alpha = cong(triName([...(t1 as string[])].sort() as unknown as Tri), triName([...(t2 as string[])].sort() as unknown as Tri))
    const alphaSame = sameCongruence(alpha, correct)
    const wrong: string[] = []
    for (const p of PERMS) {
      if (p[0] === 0 && p[1] === 1 && p[2] === 2) continue
      const text = cong(triName(t1), triName(applyPerm([...t2], p)))
      if (text !== correct && !sameCongruence(text, correct)) wrong.push(text)
    }
    if (new Set(wrong).size < 3) continue
    const trapText = !alphaSame && !wrong.includes(alpha) ? alpha : !alphaSame ? alpha : wrong[0]!
    if (sameCongruence(trapText, correct)) continue
    const rest = [...new Set(wrong)].filter((text) => text !== trapText && !sameCongruence(text, trapText) && !sameCongruence(text, correct))
    if (rest.length < 2) continue
    const texts = [correct, trapText, rest[0]!, rest[1]!]
    if (new Set(texts).size !== 4) continue
    if (texts.some((text, i) => i > 0 && sameCongruence(text, correct))) continue
    const choices: ChoiceDraft[] = [
      { id: 'right', text: correct },
      { id: 'order', text: trapText, trap: 'geo_vertices_out_of_order', witness: ORDER_W },
      { id: 'other', text: rest[0]! },
      { id: 'else', text: rest[1]! },
    ]
    return choiceAnswer(
      'congruentParts',
      'Which congruence statement do the marks support?',
      { ariaLabel: ariaOf(scene), points, segments: [...segsOf(t1, ticks), ...segsOf(t2, ticks)], ...(angles.length ? { angles } : {}) },
      'Statement',
      'Read the marks, then the order of the vertices.',
      'A different order pairs different vertices. The alphabet is not the correspondence.',
      choices,
      'right',
      'geo_vertices_out_of_order',
      'order',
      UNIT4_RULE_IDS.correspondence,
      [`The marks pair ${t1[0]} with ${t2[0]}, ${t1[1]} with ${t2[1]}, and ${t1[2]} with ${t2[2]}.`],
      'Congruence statement',
      { mode: 'marks', perm, alphaSame: alphaSame ? 1 : 0, case: kind },
      seed,
    )
  }
  throw new Error(`gc.parts/${seed}: no statement problem`)
}

// --- which method --------------------------------------------------------------

interface WhichTrap {
  id: ErrorPatternId
  choice: string
  witness: string
}

function isSsa(scene: Scene, methods: Method[]): boolean {
  if (methods.length || scene.rights.length || scene.shared.length || scene.vertical.length || scene.alt.length) return false
  if (scene.sides.length !== 2 || scene.angles.length !== 1) return false
  const [s0, s1] = scene.sides
  const common = [s0!.a[0], s0!.a[1]].filter((v) => v === s1!.a[0] || v === s1!.a[1])
  return common.length === 1 && scene.angles[0]!.a !== common[0]
}

function isAaa(scene: Scene, methods: Method[]): boolean {
  return (
    methods.length === 0 &&
    scene.angles.length === 3 &&
    scene.sides.length === 0 &&
    scene.shared.length === 0 &&
    scene.rights.length === 0 &&
    scene.vertical.length === 0 &&
    scene.alt.length === 0
  )
}

function trapsFor(scene: Scene, answer: Method | 'none'): WhichTrap[] {
  const out: WhichTrap[] = []
  const add = (choice: string, id: ErrorPatternId, witness: string) => {
    if (choice === answer) return
    if (out.some((trap) => trap.choice === choice)) return
    out.push({ choice, id, witness })
  }
  const methods = methodsOf(scene)
  if (isSsa(scene, methods)) {
    add('SSA', 'geo_ssa_as_congruence', SSA_W)
    add('SAS', 'geo_sas_not_included', SAS_W)
    add('HL', 'geo_hl_no_right', HL_W)
  }
  if (isAaa(scene, methods)) {
    add('AAA', 'geo_aaa_as_congruence', AAA_W)
    add('HL', 'geo_hl_no_right', HL_W)
  }
  if (answer === 'ASA') add('AAS', 'geo_asa_aas_swapped', SWAP_W)
  if (answer === 'AAS') add('ASA', 'geo_asa_aas_swapped', SWAP_W)
  if (answer === 'HL') add('SAS', 'geo_sas_not_included', SAS_W)
  const right = scene.rights.length > 0
  if (!right && answer !== 'HL') add('HL', 'geo_hl_no_right', HL_W)
  if (scene.shared.length > 0 && answer !== 'none') add('none', 'geo_shared_side_missed', SHARED_W)
  if (scene.vertical.length > 0 && answer !== 'none') add('none', 'geo_vertical_angles_missed', VERT_MISSED_W)
  return out
}

interface WhichFigure {
  scene: Scene
  points: GeoPoint[]
  segments: GeoSegment[]
  lines?: GeoLine[]
  angles: GeoAngleMark[]
}

function separateWhich(salt: number, kind: 'SSS' | 'SAS' | 'ASA' | 'AAS' | 'SSA' | 'AAA' | 'sides'): WhichFigure {
  const rng = makeRng(mixSeed(salt + 1, 80))
  const letters = pickLetters(rng, 6)
  const perm = PERMS[salt % 6]!
  const t1: Tri = [letters[0]!, letters[1]!, letters[2]!]
  const t2 = applyPerm([letters[3]!, letters[4]!, letters[5]!], perm)
  const rot = ROTS[salt % ROTS.length]!
  const reflect = salt % 2 === 1
  const shift = salt % 3
  const scene = emptyScene(t1, t2)
  const ticks = new Map<string, Tick>()
  const mark = (i: number, n: Tick) => {
    ticks.set(segKey(t1[i]!, t1[(i + 1) % 3]!), n)
    ticks.set(segKey(t2[i]!, t2[(i + 1) % 3]!), n)
    scene.sides.push({ a: [t1[i]!, t1[(i + 1) % 3]!], b: [t2[i]!, t2[(i + 1) % 3]!], tick: n })
  }
  const angles: GeoAngleMark[] = []
  const arc = (i: number, n: Tick) => {
    scene.angles.push({ a: t1[i]!, b: t2[i]!, arc: n })
    angles.push(arcAt(t1, i, n), arcAt(t2, i, n))
  }
  if (kind === 'SSS') {
    mark(0, 1)
    mark(1, 2)
    mark(2, 3)
  } else if (kind === 'SAS') {
    mark((shift + 2) % 3, 1)
    mark(shift, 2)
    arc(shift, 1)
  } else if (kind === 'ASA') {
    mark(shift, 1)
    arc(shift, 1)
    arc((shift + 1) % 3, 2)
  } else if (kind === 'AAS') {
    mark((shift + 1) % 3, 1)
    arc(shift, 1)
    arc((shift + 1) % 3, 2)
  } else if (kind === 'SSA') {
    mark(shift, 1)
    mark((shift + 1) % 3, 2)
    arc((shift + 2) % 3, 1)
  } else if (kind === 'AAA') {
    arc(0, 1)
    arc(1, 2)
    arc(2, 3)
  } else {
    mark(shift, 1)
    mark((shift + 1) % 3, 2)
  }
  let points: GeoPoint[] | null = null
  for (let extra = 0; extra < SCALENE.length; extra++) {
    const ang = SCALENE[(salt + extra) % SCALENE.length]!
    const placed =
      kind === 'AAA'
        ? placeScaledPair(t1, t2, ang[0], ang[1], 3.6, 5.8, rot, reflect, 2.4)
        : placePair(t1, t2, ang[0], ang[1], 4.2, rot, reflect, 2.6)
    if (!noRight(placed, t1) || !noRight(placed, t2)) continue
    points = placed
    break
  }
  if (!points) throw new Error(`${kind}: near a right angle`)
  return { scene, points, segments: [...segsOf(t1, ticks), ...segsOf(t2, ticks)], angles }
}

function rightWhich(salt: number, kind: 'HL' | 'ASA' | 'AAS'): WhichFigure {
  const rng = makeRng(mixSeed(salt + 1, 90))
  const letters = pickLetters(rng, 6)
  const perm = PERMS[salt % 6]!
  const t1: Tri = [letters[0]!, letters[1]!, letters[2]!]
  const t2 = applyPerm([letters[3]!, letters[4]!, letters[5]!], perm)
  const legs: readonly [number, number][] = [
    [3.2, 4.8],
    [2.8, 4.4],
    [3.5, 5.1],
    [2.6, 4.2],
  ]
  const [rise, run] = legs[salt % legs.length]!
  const rot = ROTS[salt % ROTS.length]!
  const reflect = salt % 2 === 1
  const scene = emptyScene(t1, t2)
  scene.rights = [t1[2]!, t2[2]!]
  const ticks = new Map<string, Tick>()
  const mark = (i: number, n: Tick) => {
    ticks.set(segKey(t1[i]!, t1[(i + 1) % 3]!), n)
    ticks.set(segKey(t2[i]!, t2[(i + 1) % 3]!), n)
    scene.sides.push({ a: [t1[i]!, t1[(i + 1) % 3]!], b: [t2[i]!, t2[(i + 1) % 3]!], tick: n })
  }
  const angles: GeoAngleMark[] = [squareAt(t1, 2), squareAt(t2, 2)]
  if (kind === 'HL') {
    mark(0, 1)
    mark(salt % 2 === 0 ? 1 : 2, 2)
  } else if (kind === 'ASA') {
    mark(1, 1)
    scene.angles.push({ a: t1[1]!, b: t2[1]!, arc: 1 })
    angles.push(arcAt(t1, 1, 1), arcAt(t2, 1, 1))
  } else {
    mark(0, 1)
    scene.angles.push({ a: t1[0]!, b: t2[0]!, arc: 1 })
    angles.push(arcAt(t1, 0, 1), arcAt(t2, 0, 1))
  }
  const points = placeRightPair(t1, t2, rise, run, rot, reflect, 2.4)
  for (const ids of [t1, t2]) {
    const got = wedge(byId(points, ids[2]!), byId(points, ids[0]!), byId(points, ids[1]!))
    if (Math.abs(got - 90) > 0.8) throw new Error(`right angle drifted to ${got.toFixed(2)}`)
  }
  return { scene, points, segments: [...segsOf(t1, ticks), ...segsOf(t2, ticks)], angles }
}

function kiteWhich(salt: number): WhichFigure {
  const [A, B, C, D] = pickLetters(makeRng(mixSeed(salt + 1, 91)), 4) as [string, string, string, string]
  const t1: Tri = [A, B, C]
  const t2: Tri = [A, D, C]
  const points = [pt(A, 0, 0, 'left'), pt(C, 6, 0, 'right'), pt(B, 2, 3, 'above'), pt(D, 2, -3, 'below')]
  const scene = emptyScene(t1, t2)
  scene.sides = [
    { a: [A, B], b: [A, D], tick: 1 },
    { a: [C, B], b: [C, D], tick: 2 },
  ]
  scene.shared = [[A, C]]
  if (!noRight(points, t1) || !noRight(points, t2)) throw new Error('kite is right')
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

function legLegWhich(salt: number): WhichFigure {
  const [A, B, C, D] = pickLetters(makeRng(mixSeed(salt + 1, 92)), 4) as [string, string, string, string]
  const t1: Tri = [A, B, C]
  const t2: Tri = [D, B, C]
  const points = [pt(A, 0, 3.2, 'above'), pt(B, 4.6, 0, 'right'), pt(C, 0, 0, 'left'), pt(D, 0, -3.2, 'below')]
  const scene = emptyScene(t1, t2)
  scene.sides = [{ a: [C, A], b: [C, D], tick: 1 }]
  scene.shared = [[C, B]]
  scene.rights = [C, C]
  const upper = wedge(byId(points, C), byId(points, A), byId(points, B))
  const lower = wedge(byId(points, C), byId(points, D), byId(points, B))
  if (Math.abs(upper - 90) > 0.2 || Math.abs(lower - 90) > 0.2) throw new Error('shared leg is not right')
  return {
    scene,
    points,
    segments: [
      { from: A, to: B },
      { from: B, to: C },
      { from: C, to: A, ticks: 1 },
      { from: D, to: B },
      { from: C, to: D, ticks: 1 },
    ],
    angles: [
      { vertex: C, from: A, to: B, right: true },
      { vertex: C, from: D, to: B, right: true },
    ],
  }
}

function verticalWhich(salt: number, oneSide: boolean): WhichFigure {
  const [A, B, C, D, E] = pickLetters(makeRng(mixSeed(salt + 1, 93)), 5) as [string, string, string, string, string]
  const t1: Tri = [A, E, B]
  const t2: Tri = [C, E, D]
  const points = [pt(A, 0, 2, 'above'), pt(E, 3, 0, 'above'), pt(C, 6, -2, 'below'), pt(B, 0, -1.2, 'below'), pt(D, 6, 1.2, 'above')]
  const scene = emptyScene(t1, t2)
  scene.sides = oneSide
    ? [{ a: [A, E], b: [C, E], tick: 1 }]
    : [
        { a: [A, E], b: [C, E], tick: 1 },
        { a: [B, E], b: [D, E], tick: 2 },
      ]
  scene.vertical = [`${A}${E}${B}-${C}${E}${D}`]
  if (!noRight(points, t1) || !noRight(points, t2)) throw new Error('vertical is right')
  const segments: GeoSegment[] = [
    { from: A, to: E, ticks: 1 },
    { from: E, to: C, ticks: 1 },
    { from: B, to: E, ticks: oneSide ? undefined : 2 },
    { from: E, to: D, ticks: oneSide ? undefined : 2 },
    { from: A, to: B },
    { from: C, to: D },
  ]
  return { scene, points, segments: segments.map((seg) => (seg.ticks ? seg : { from: seg.from, to: seg.to })), angles: [] }
}

function parallelWhich(salt: number, both: boolean): WhichFigure {
  const [A, B, C, D] = pickLetters(makeRng(mixSeed(salt + 1, 94)), 4) as [string, string, string, string]
  const t1: Tri = [A, B, C]
  const t2: Tri = [C, D, A]
  const points = [pt(A, 0, 0, 'below'), pt(B, 4.4, 0, 'below'), pt(C, 5.6, 2.5, 'above'), pt(D, 1.2, 2.5, 'above')]
  const scene = emptyScene(t1, t2)
  scene.shared = [[A, C]]
  scene.parallel = both
    ? [
        { line: `${A}${B}||${D}${C}`, arrows: 1 },
        { line: `${A}${D}||${B}${C}`, arrows: 2 },
      ]
    : [{ line: `${A}${B}||${D}${C}`, arrows: 1 }]
  scene.alt = both ? [`${B}${A}${C}-${D}${C}${A}`, `${B}${C}${A}-${D}${A}${C}`] : [`${B}${A}${C}-${D}${C}${A}`]
  if (!noRight(points, t1) || !noRight(points, t2)) throw new Error('parallelogram is a rectangle')
  const lines: GeoLine[] = both
    ? [
        { through: [A, B], arrows: 1 },
        { through: [D, C], arrows: 1 },
        { through: [A, D], arrows: 2 },
        { through: [B, C], arrows: 2 },
      ]
    : [
        { through: [A, B], arrows: 1 },
        { through: [D, C], arrows: 1 },
      ]
  const segments: GeoSegment[] = both ? [{ from: A, to: C }] : [{ from: A, to: C }, { from: A, to: D }, { from: B, to: C }]
  return { scene, points, segments, lines, angles: [] }
}

function buildWhich(seed: number): { figure: WhichFigure; answer: Method | 'none'; family: string } {
  const slot = (seed - 1) % 6
  const salt = Math.floor((seed - 1) / 6)
  if (slot === 0) {
    return salt % 2 === 0
      ? { figure: separateWhich(salt, 'SSS'), answer: 'SSS', family: 'separate-sss' }
      : { figure: kiteWhich(salt), answer: 'SSS', family: 'kite' }
  }
  if (slot === 1) {
    const kind = salt % 3
    if (kind === 0) return { figure: separateWhich(salt, 'SAS'), answer: 'SAS', family: 'separate-sas' }
    if (kind === 1) return { figure: verticalWhich(salt, false), answer: 'SAS', family: 'vertical' }
    return { figure: legLegWhich(salt), answer: 'SAS', family: 'leg-leg' }
  }
  if (slot === 2) {
    const kind = salt % 3
    if (kind === 0) return { figure: separateWhich(salt, 'ASA'), answer: 'ASA', family: 'separate-asa' }
    if (kind === 1) return { figure: parallelWhich(salt, true), answer: 'ASA', family: 'parallel' }
    return { figure: rightWhich(salt, 'ASA'), answer: 'ASA', family: 'right-asa' }
  }
  if (slot === 3) {
    return salt % 2 === 0
      ? { figure: separateWhich(salt, 'AAS'), answer: 'AAS', family: 'separate-aas' }
      : { figure: rightWhich(salt, 'AAS'), answer: 'AAS', family: 'right-aas' }
  }
  if (slot === 4) return { figure: rightWhich(salt, 'HL'), answer: 'HL', family: 'hl' }
  const kind = salt % 4
  if (kind === 0) return { figure: separateWhich(salt, 'SSA'), answer: 'none', family: 'ssa' }
  if (kind === 1) return { figure: separateWhich(salt, 'AAA'), answer: 'none', family: 'aaa' }
  if (kind === 2) return { figure: verticalWhich(salt, true), answer: 'none', family: 'vertical-one' }
  return { figure: parallelWhich(salt, false), answer: 'none', family: 'parallel-one' }
}

export function drawWhich(seed: number): GeoBuilt {
  const built = buildWhich(seed)
  const methods = methodsOf(built.figure.scene)
  const expect = built.answer === 'none' ? [] : [built.answer]
  if (methods.join(',') !== expect.join(',')) {
    throw new Error(`${built.family}: expected ${expect.join(',') || 'none'}, got ${methods.join(',') || 'none'}`)
  }
  if (built.answer !== 'HL' && built.figure.scene.rights.length === 0) {
    const [t1, t2] = [built.figure.scene.t1, built.figure.scene.t2]
    if (!noRight(built.figure.points, t1) || !noRight(built.figure.points, t2)) {
      throw new Error(`${built.family}: near a right angle`)
    }
  }
  const traps = trapsFor(built.figure.scene, built.answer)
  if (traps.length === 0) throw new Error(`${built.family}: no trap`)
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
  for (const trap of traps) {
    const button = buttons.find((b) => b.id === trap.choice)
    if (!button || button.id === (built.answer === 'none' ? 'none' : built.answer)) throw new Error('trap is the answer')
    button.trap = trap.id
    button.witness = trap.witness
  }
  const salt = Math.floor((seed - 1) / 6)
  const promised = traps[salt % traps.length]!
  const answerId = built.answer === 'none' ? 'none' : built.answer
  return choiceAnswer(
    'congruentWhich',
    WHICH_PROMPT,
    {
      ariaLabel: ariaOf(built.figure.scene),
      points: built.figure.points,
      segments: built.figure.segments,
      ...(built.figure.lines ? { lines: built.figure.lines } : {}),
      ...(built.figure.angles.length ? { angles: built.figure.angles } : {}),
    },
    'Method',
    'Read the marks that are drawn.',
    'Count the pairs that are marked. A side in both triangles counts, and so do vertical angles and alternate interior angles.',
    buttons,
    answerId,
    promised.id,
    promised.choice,
    UNIT4_RULE_IDS.methods,
    [built.answer === 'none' ? 'The marks that are drawn do not prove the triangles congruent.' : 'The marks that are drawn are exactly the pairs this reason uses.'],
    'Which method',
    { case: built.family, perm: salt % 6 },
    seed,
  )
}

// --- algebra with corresponding parts ------------------------------------------

function fitExprs(mAsked: number, mOther: number, x: number, rng: Rng): { asked: Lin; corr: Lin; other: Lin; trapX: number } | null {
  const coeffs = rng.shuffle([1, 2, 3, 4])
  for (const a1 of coeffs) {
    for (const a3 of coeffs) {
      if (a1 === a3) continue
      if ((mOther - mAsked) % (a1 - a3) !== 0) continue
      const trapX = x + (mOther - mAsked) / (a1 - a3)
      if (!Number.isInteger(trapX) || trapX <= 0 || trapX === x || trapX > 80) continue
      const b1 = mAsked - a1 * x
      const b3 = mOther - a3 * x
      for (const a2 of coeffs) {
        if (a2 === a1) continue
        const b2 = mAsked - a2 * x
        const asked = lin(a1, b1)
        const corr = lin(a2, b2)
        const other = lin(a3, b3)
        const texts = [formatLin(asked), formatLin(corr), formatLin(other)]
        if (new Set(texts).size !== 3) continue
        if (evalLin(asked, x) !== mAsked || evalLin(corr, x) !== mAsked || evalLin(other, x) !== mOther) continue
        const solved = solveEqual(asked, corr)
        const trap = solveEqual(asked, other)
        if (!solved || solved.d !== 1 || solved.n !== x) continue
        if (!trap || trap.d !== 1 || trap.n !== trapX) continue
        return { asked, corr, other, trapX }
      }
    }
  }
  return null
}

function clause(angle: boolean, name: string, expr: Lin): string {
  return angle ? `m${name} = ${formatLin(expr)}` : `${name} = ${formatLin(expr)}`
}

export function drawSolve(seed: number): GeoBuilt {
  for (let attempt = 0; attempt < 50; attempt++) {
    const rng = makeRng(mixSeed(seed, 120 + attempt))
    const { t1, t2, perm } = named(rng)
    const { rot, reflect } = orient(rng)
    const angle = rng.chance(0.5)
    const x = rng.pick(X_POOL)
    const askedOnSecond = rng.chance(0.5)
    const askedIndex = rng.int(0, 2)
    const otherIndex = rng.intExcept(0, 2, [askedIndex])
    if (angle) {
      const m1 = rng.int(32, 72)
      const m2 = rng.int(32, 78)
      const m3 = 180 - m1 - m2
      if (m2 === m1 || m3 < 28 || m3 >= 150) continue
      const measures = [0, 0, 0]
      measures[askedIndex] = m1
      measures[otherIndex] = m2
      measures[3 - askedIndex - otherIndex] = m3
      if (measures.some((m) => m <= 0 || m >= 180 || Math.abs(m - 90) < 3 || BANNED.has(m))) continue
      const fit = fitExprs(m1, m2, x, rng)
      if (!fit) continue
      if (rawLeaks('geo_vertices_out_of_order', VERT_W, String(x))) continue
      const askedTri = askedOnSecond ? t2 : t1
      const otherTri = rng.chance(0.5) ? t1 : t2
      const corrTri = askedOnSecond ? t1 : t2
      const askedName = angLetter(askedTri, askedIndex)
      const corrName = angLetter(corrTri, askedIndex)
      const otherName = angLetter(otherTri, otherIndex)
      const parts = rng.shuffle([
        { name: askedName, expr: fit.asked, role: 'asked' },
        { name: corrName, expr: fit.corr, role: 'corr' },
        { name: otherName, expr: fit.other, role: 'other' },
      ])
      if (new Set(parts.map((p) => p.name)).size !== 3) continue
      const prompt = `${cong(triName(t1), triName(t2))}. ${clause(true, parts[0]!.name, parts[0]!.expr)}, ${clause(true, parts[1]!.name, parts[1]!.expr)}, and ${clause(true, parts[2]!.name, parts[2]!.expr)}. Find x, then m${askedName}.`
      const points = placePair(t1, t2, measures[0]!, measures[1]!, 4.4, rot, reflect, 2.8)
      const drawn = anglesAt(points, t1)
      if (drawn.some((a, i) => Math.abs(a - measures[i]!) > 1.2)) continue
      const labels: GeoAngleMark[] = []
      let anglesLabeled = true
      for (const p of parts) {
        const vertex = p.name.slice(1)
        const tri = t1.includes(vertex) ? t1 : t2.includes(vertex) ? t2 : null
        if (!tri) {
          anglesLabeled = false
          break
        }
        const i = tri.indexOf(vertex)
        labels.push({ vertex, from: tri[(i + 1) % 3]!, to: tri[(i + 2) % 3]!, label: angleLabel(p.expr), radius: 18 })
      }
      if (!anglesLabeled || labels.length !== 3) continue
      const figure: GeoFigureSpec = {
        ariaLabel: `Triangles ${t1.join('')} and ${t2.join('')}. ${parts.map((p) => `Angle ${p.name.slice(1)} is labeled ${angleLabel(p.expr)}`).join(', ')}. No congruence marks.`,
        points,
        segments: [...segsOf(t1, new Map()), ...segsOf(t2, new Map())],
        angles: labels,
      }
      const visible = `${prompt}\n${figure.ariaLabel}\n${labels.map((g) => g.label).join(' ')}`
      if ([String(x), String(m1), String(fit.trapX)].some((secret) => exposed(visible, secret))) continue
      hide('solve angle', visible, [String(x), String(m1)])
      const stages = numberStages(x, { id: 'geo_vertices_out_of_order', text: String(fit.trapX), witness: VERT_W }, `m${askedName}`, m1, 'deg', null, UNIT4_RULE_IDS.parts)
      return numberAnswer('congruentSolve', prompt, figure, stages, [8, 9, 10], measures, 'geo_vertices_out_of_order', 'x', String(fit.trapX), 'Corresponding parts', { case: 'angle', perm })
    }
    const lens = [rng.int(8, 26), rng.int(8, 26), rng.int(8, 26)]
    const sorted = [...lens].sort((a, b) => a - b)
    if (sorted[0]! + sorted[1]! <= sorted[2]!) continue
    if (lens[askedIndex] === lens[otherIndex]) continue
    if (lens.some((n) => BANNED.has(n))) continue
    const fit = fitExprs(lens[askedIndex]!, lens[otherIndex]!, x, rng)
    if (!fit) continue
    if (rawLeaks('geo_vertices_out_of_order', VERT_W, String(x))) continue
    const cosAt = (i: number) => {
      const opp = lens[(i + 1) % 3]!
      const left = lens[(i + 2) % 3]!
      const right = lens[i]!
      return (left * left + right * right - opp * opp) / (2 * left * right)
    }
    const c0 = cosAt(0)
    const c1 = cosAt(1)
    if (c0 <= -1 || c0 >= 1 || c1 <= -1 || c1 >= 1) continue
    const a0 = (Math.acos(c0) * 180) / Math.PI
    const a1 = (Math.acos(c1) * 180) / Math.PI
    const a2 = 180 - a0 - a1
    if (a2 <= 8 || a0 <= 8 || a1 <= 8) continue
    const askedTri = askedOnSecond ? t2 : t1
    const corrTri = askedOnSecond ? t1 : t2
    const otherTri = rng.chance(0.5) ? t1 : t2
    const askedName = sideLabel(askedTri, askedIndex)
    const corrName = sideLabel(corrTri, askedIndex)
    const otherName = sideLabel(otherTri, otherIndex)
    const parts = rng.shuffle([
      { name: askedName, expr: fit.asked, tri: askedTri, index: askedIndex },
      { name: corrName, expr: fit.corr, tri: corrTri, index: askedIndex },
      { name: otherName, expr: fit.other, tri: otherTri, index: otherIndex },
    ])
    if (new Set(parts.map((p) => p.name)).size !== 3) continue
    const prompt = `${cong(triName(t1), triName(t2))}. ${clause(false, parts[0]!.name, parts[0]!.expr)}, ${clause(false, parts[1]!.name, parts[1]!.expr)}, and ${clause(false, parts[2]!.name, parts[2]!.expr)}. Find x, then ${askedName}.`
    const points = placePair(t1, t2, a0, a1, 4.4, rot, reflect, 2.8)
    const drawn = anglesAt(points, t1)
    const stored = [Math.round(a0), Math.round(a1), 180 - Math.round(a0) - Math.round(a1)]
    if (stored.some((n) => n <= 0 || n >= 180)) continue
    if (drawn.some((a, i) => Math.abs(a - stored[i]!) > 1.4)) continue
    const segments = [...segsOf(t1, new Map()), ...segsOf(t2, new Map())]
    let labeled = 0
    for (const part of parts) {
      const a = part.tri[part.index]!
      const b = part.index === 2 ? part.tri[0]! : part.tri[(part.index + 1) % 3]!
      const seg = segments.find((s) => (s.from === a && s.to === b) || (s.from === b && s.to === a))
      if (!seg) continue
      seg.label = formatLin(part.expr)
      seg.labelSide = 'above'
      labeled += 1
    }
    if (labeled !== 3) continue
    const figure: GeoFigureSpec = {
      ariaLabel: `Triangles ${t1.join('')} and ${t2.join('')}. ${parts.map((p) => `Side ${p.name} is labeled ${formatLin(p.expr)}`).join(', ')}. No congruence marks.`,
      points,
      segments,
    }
    const visible = `${prompt}\n${figure.ariaLabel}`
    if ([String(x), String(lens[askedIndex]), String(fit.trapX)].some((secret) => exposed(visible, secret))) continue
    hide('solve side', visible, [String(x), String(lens[askedIndex]!)])
    const stages = numberStages(x, { id: 'geo_vertices_out_of_order', text: String(fit.trapX), witness: VERT_W }, askedName, lens[askedIndex]!, 'len', null, UNIT4_RULE_IDS.parts)
    return numberAnswer('congruentSolve', prompt, figure, stages, lens, stored, 'geo_vertices_out_of_order', 'x', String(fit.trapX), 'Corresponding parts', { case: 'side', perm })
  }
  throw new Error(`gc.solve/${seed}: no numbers`)
}

// --- isosceles and equilateral -------------------------------------------------

function placeApex(ids: Tri, apex: number, vertex: number): GeoPoint[] {
  const base = [0, 1, 2].filter((i) => i !== apex) as [number, number]
  const half = 2.3
  const height = half / Math.tan(((vertex / 2) * Math.PI) / 180)
  const pos = new Map<number, GeoPoint>()
  pos.set(base[0]!, pt(ids[base[0]!]!, 0, 0, 'below'))
  pos.set(base[1]!, pt(ids[base[1]!]!, half * 2, 0, 'below'))
  pos.set(apex, pt(ids[apex]!, half, height, 'above'))
  return [0, 1, 2].map((i) => pos.get(i)!)
}

function angleMark(ids: Tri, i: number, label: string, radius: number): GeoAngleMark {
  return { vertex: ids[i]!, from: ids[(i + 1) % 3]!, to: ids[(i + 2) % 3]!, label, radius }
}

export function drawIsosceles(seed: number): GeoBuilt {
  const family = (seed - 1) % 4
  for (let attempt = 0; attempt < 60; attempt++) {
    const rng = makeRng(mixSeed(seed, 160 + attempt))
    const letters = pickLetters(rng, 3)
    const ids: Tri = [letters[0]!, letters[1]!, letters[2]!]
    const name = ids.join('')
    if (family === 2) {
      const x = rng.pick(X_POOL)
      const side = rng.int(10, 32)
      if (BANNED.has(side) || BANNED.has(x)) continue
      const exprs: Lin[] = []
      const used: number[] = []
      let ok = true
      for (let k = 0; k < 3; k++) {
        let placed = false
        for (const a of rng.shuffle([1, 2, 3, 4])) {
          if (used.includes(a)) continue
          const b = side - a * x
          const e = lin(a, b)
          const text = formatLin(e)
          if (exprs.some((old) => formatLin(old) === text)) continue
          if (exposed(text, String(x)) || exposed(text, String(side))) continue
          if (evalLin(e, x) !== side) continue
          exprs.push(e)
          used.push(a)
          placed = true
          break
        }
        if (!placed) ok = false
      }
      if (!ok || exprs.length !== 3) continue
      const e0 = solveEqual(exprs[0]!, exprs[1]!)
      const e1 = solveEqual(exprs[0]!, exprs[2]!)
      if (!e0 || !e1 || e0.n !== x || e0.d !== 1 || e1.n !== x || e1.d !== 1) continue
      if (rawLeaks('geo_equilateral_angle_for_side', EQ_W, String(side))) continue
      const s0 = sideLabel(ids, 0)
      const s1 = sideLabel(ids, 1)
      const s2 = sideLabel(ids, 2)
      const prompt = `${triName(ids)} is equilateral. ${s0} = ${formatLin(exprs[0]!)}, ${s1} = ${formatLin(exprs[1]!)}, and ${s2} = ${formatLin(exprs[2]!)}. Find x, then ${s0}.`
      const points = placeApex(ids, 0, 60)
      const figure: GeoFigureSpec = {
        ariaLabel: `Triangle ${name}. All three sides have 1 tick. Side ${s0} is labeled ${formatLin(exprs[0]!)}, side ${s1} is labeled ${formatLin(exprs[1]!)}, and side ${s2} is labeled ${formatLin(exprs[2]!)}.`,
        points,
        segments: [
          { from: ids[0], to: ids[1], ticks: 1, label: formatLin(exprs[0]!), labelSide: 'above' },
          { from: ids[1], to: ids[2], ticks: 1, label: formatLin(exprs[1]!), labelSide: 'below' },
          { from: ids[2], to: ids[0], ticks: 1, label: formatLin(exprs[2]!), labelSide: 'above' },
        ],
      }
      const visible = `${prompt}\n${figure.ariaLabel}`
      if (exposed(visible, String(x)) || exposed(visible, String(side))) continue
      hide('equilateral', visible, [String(x), String(side)])
      const stages = numberStages(x, null, s0, side, 'len', { id: 'geo_equilateral_angle_for_side', text: '60', witness: EQ_W }, UNIT4_RULE_IDS.equilateral)
      return numberAnswer('isoscelesSolve', prompt, figure, stages, [side, side, side], [60, 60, 60], 'geo_equilateral_angle_for_side', 'result', '60', 'Equilateral triangle', { case: 'equilateral' })
    }
    if (family === 3) {
      const apex = rng.int(0, 2)
      const bases = [0, 1, 2].filter((i) => i !== apex)
      const V = rng.pick([36, 40, 44, 48, 52, 56, 64, 70, 72, 76, 80, 84, 88, 96, 100, 104, 108])
      const base = (180 - V) / 2
      if (!Number.isInteger(base) || base < 24 || base >= 80 || BANNED.has(base) || base === V) continue
      const x = rng.pick(X_POOL)
      if (rawLeaks('geo_base_angles_wrong_vertex', BASE_W, String(x))) continue
      let expr: Lin | null = null
      for (const a of rng.shuffle([1, 2, 3, 4])) {
        const b = base - a * x
        const e = lin(a, b)
        const text = formatLin(e)
        if (exposed(text, String(x)) || exposed(text, String(base)) || exposed(text, String(V))) continue
        if (evalLin(e, x) !== base) continue
        const trap = solveEqual(e, lin(0, V))
        if (!trap || trap.d !== 1 || trap.n === x || trap.n <= 0 || trap.n > 80) continue
        expr = e
        break
      }
      if (!expr) continue
      const trap = solveEqual(expr, lin(0, V))!
      const sideA = apex === 0 ? sideLabel(ids, 0) : apex === 1 ? sideLabel(ids, 0) : sideLabel(ids, 1)
      const sideB = apex === 0 ? `${ids[0]}${ids[2]}` : apex === 1 ? sideLabel(ids, 1) : `${ids[0]}${ids[2]}`
      if (sideA === sideB) continue
      const givenBase = bases[0]!
      const askedBase = bases[1]!
      const prompt = `${sideA} ≅ ${sideB} and m${angLetter(ids, apex)} = ${V}. m${angLetter(ids, givenBase)} = ${formatLin(expr)}. Find x, then m${angLetter(ids, askedBase)}.`
      const points = placeApex(ids, apex, V)
      const drawn = anglesAt(points, ids)
      const stored = [0, 1, 2].map((i) => (i === apex ? V : base))
      if (drawn.some((a, i) => Math.abs(a - stored[i]!) > 1.2)) continue
      const tickSegs: GeoSegment[] = [0, 1, 2].map((i) => {
        const from = ids[i]!
        const to = ids[(i + 1) % 3]!
        const touches = from === ids[apex] || to === ids[apex]
        return touches ? { from, to, ticks: 1 as Tick } : { from, to }
      })
      const figure: GeoFigureSpec = {
        ariaLabel: `Triangle ${name}. ${sideA} and ${sideB} have 1 tick. Angle ${ids[apex]} is labeled ${V}°. Angle ${ids[givenBase]} is labeled ${formatLin(expr)}.`,
        points,
        segments: tickSegs,
        angles: [angleMark(ids, apex, `${V}°`, 18), angleMark(ids, givenBase, angleLabel(expr), 20)],
      }
      const visible = `${prompt}\n${figure.ariaLabel}`
      if ([String(x), String(base), String(trap.n)].some((secret) => exposed(visible, secret))) continue
      hide('vertex', visible, [String(x), String(base)])
      const stages = numberStages(x, { id: 'geo_base_angles_wrong_vertex', text: String(trap.n), witness: BASE_W }, `m${angLetter(ids, askedBase)}`, base, 'deg', null, UNIT4_RULE_IDS.base)
      return numberAnswer('isoscelesSolve', prompt, figure, stages, [9, 9, 8], stored, 'geo_base_angles_wrong_vertex', 'x', String(trap.n), 'Isosceles triangle', { case: 'vertex' })
    }
    if (family === 0) {
      const apex = rng.int(0, 2)
      const bases = [0, 1, 2].filter((i) => i !== apex)
      const base = rng.int(28, 70)
      const vertex = 180 - 2 * base
      if (vertex < 24 || vertex >= 150 || BANNED.has(base) || BANNED.has(vertex) || Math.abs(vertex - 90) < 2) continue
      const x = rng.pick(X_POOL)
      if (rawLeaks('geo_base_angles_wrong_vertex', BASE_W, String(x))) continue
      const fit = fitExprs(base, vertex, x, rng)
      if (!fit) continue
      const asked = rng.pick(bases)
      const measures = [0, 1, 2].map((i) => (i === apex ? vertex : base))
      const baseExpr = fit.asked
      const baseExpr2 = fit.corr
      const vertexExpr = fit.other
      if (evalLin(baseExpr, x) !== base || evalLin(baseExpr2, x) !== base || evalLin(vertexExpr, x) !== vertex) continue
      const byIndex = [lin(0, 0), lin(0, 0), lin(0, 0)]
      byIndex[bases[0]!] = bases[0] === asked ? baseExpr : baseExpr2
      byIndex[bases[1]!] = bases[1] === asked ? baseExpr : baseExpr2
      byIndex[apex] = vertexExpr
      // fitExprs sets asked and corr equal to mAsked (base) and other equal to mOther (vertex). Good.
      if (bases[0] !== asked && bases[1] !== asked) continue
      const sideA = apex === 1 ? sideLabel(ids, 0) : apex === 0 ? sideLabel(ids, 0) : sideLabel(ids, 1)
      const sideB = apex === 1 ? sideLabel(ids, 1) : apex === 0 ? `${ids[0]}${ids[2]}` : `${ids[0]}${ids[2]}`
      const prompt = `${sideA} ≅ ${sideB}. m${angLetter(ids, 0)} = ${formatLin(byIndex[0]!)}, m${angLetter(ids, 1)} = ${formatLin(byIndex[1]!)}, and m${angLetter(ids, 2)} = ${formatLin(byIndex[2]!)}. Find x, then m${angLetter(ids, asked)}.`
      const points = placeApex(ids, apex, vertex)
      const drawn = anglesAt(points, ids)
      if (drawn.some((a, i) => Math.abs(a - measures[i]!) > 1.2)) continue
      const tickSegs: GeoSegment[] = [0, 1, 2].map((i) => {
        const from = ids[i]!
        const to = ids[(i + 1) % 3]!
        const touches = from === ids[apex] || to === ids[apex]
        return touches ? { from, to, ticks: 1 as Tick } : { from, to }
      })
      const figure: GeoFigureSpec = {
        ariaLabel: `Triangle ${name}. ${sideA} and ${sideB} have 1 tick. Angle ${ids[0]} is labeled ${formatLin(byIndex[0]!)}, angle ${ids[1]} is labeled ${formatLin(byIndex[1]!)}, and angle ${ids[2]} is labeled ${formatLin(byIndex[2]!)}.`,
        points,
        segments: tickSegs,
        angles: [0, 1, 2].map((i) => angleMark(ids, i, angleLabel(byIndex[i]!), 18)),
      }
      const visible = `${prompt}\n${figure.ariaLabel}`
      if ([String(x), String(base), String(fit.trapX)].some((secret) => exposed(visible, secret))) continue
      hide('theorem', visible, [String(x), String(base)])
      const stages = numberStages(x, { id: 'geo_base_angles_wrong_vertex', text: String(fit.trapX), witness: BASE_W }, `m${angLetter(ids, asked)}`, base, 'deg', null, UNIT4_RULE_IDS.base)
      const leg = rng.int(8, 16)
      const baseSide = rng.int(6, leg + leg - 1)
      return numberAnswer('isoscelesSolve', prompt, figure, stages, [leg, leg, baseSide], measures, 'geo_base_angles_wrong_vertex', 'x', String(fit.trapX), 'Isosceles triangle', { case: 'theorem' })
    }
    // Converse: congruent angles, so the sides opposite them are congruent.
    const a = rng.int(0, 2)
    const b = rng.intExcept(0, 2, [a])
    const apex = [0, 1, 2].find((i) => i !== a && i !== b)!
    const leg = rng.int(10, 28)
    const baseSide = rng.int(8, leg + leg - 2)
    if (leg + leg <= baseSide || BANNED.has(leg) || BANNED.has(baseSide) || leg === baseSide) continue
    const x = rng.pick(X_POOL)
    if (rawLeaks('geo_base_angles_wrong_vertex', CONV_W, String(x))) continue
    const fit = fitExprs(leg, baseSide, x, rng)
    if (!fit) continue
    const asked = rng.chance(0.5) ? a : b
    // Side opposite vertex v starts at the next vertex.
    const across = (v: number) => (v + 1) % 3
    const bySide: Lin[] = [lin(0, 0), lin(0, 0), lin(0, 0)]
    bySide[across(a)] = asked === a ? fit.asked : fit.corr
    bySide[across(b)] = asked === b ? fit.asked : fit.corr
    bySide[across(apex)] = fit.other
    if (evalLin(bySide[across(a)]!, x) !== leg || evalLin(bySide[across(b)]!, x) !== leg || evalLin(bySide[across(apex)]!, x) !== baseSide) continue
    const askedName = sideLabel(ids, across(asked))
    const s0 = sideLabel(ids, 0)
    const s1 = sideLabel(ids, 1)
    const s2 = sideLabel(ids, 2)
    const prompt = `${angLetter(ids, a)} ≅ ${angLetter(ids, b)}. ${s0} = ${formatLin(bySide[0]!)}, ${s1} = ${formatLin(bySide[1]!)}, and ${s2} = ${formatLin(bySide[2]!)}. Find x, then ${askedName}.`
    const cosApex = (leg * leg + leg * leg - baseSide * baseSide) / (2 * leg * leg)
    if (cosApex <= -1 || cosApex >= 1) continue
    const apexAng = (Math.acos(cosApex) * 180) / Math.PI
    const baseAng = (180 - apexAng) / 2
    if (baseAng < 18 || apexAng < 18) continue
    const points = placeApex(ids, apex, apexAng)
    const stored = [0, 1, 2].map((i) => (i === apex ? Math.round(apexAng) : Math.round(baseAng)))
    stored[apex] = 180 - stored[a]! - stored[b]!
    if (stored.some((n) => n <= 0 || n >= 180)) continue
    const drawn = anglesAt(points, ids)
    if (drawn.some((g, i) => Math.abs(g - (i === apex ? apexAng : baseAng)) > 1.2)) continue
    if (drawn.some((g, i) => Math.abs(g - stored[i]!) > 1.4)) continue
    const segments: GeoSegment[] = [0, 1, 2].map((i) => ({
      from: i === 2 ? ids[2]! : ids[i]!,
      to: i === 2 ? ids[0]! : ids[(i + 1) % 3]!,
      label: formatLin(bySide[i]!),
      labelSide: i === 1 ? ('below' as const) : ('above' as const),
    }))
    const figure: GeoFigureSpec = {
      ariaLabel: `Triangle ${name}. Angles at ${ids[a]} and ${ids[b]} have 1 arc. Side ${s0} is labeled ${formatLin(bySide[0]!)}, side ${s1} is labeled ${formatLin(bySide[1]!)}, and side ${s2} is labeled ${formatLin(bySide[2]!)}.`,
      points,
      segments,
      angles: [
        { vertex: ids[a]!, from: ids[(a + 1) % 3]!, to: ids[(a + 2) % 3]!, marks: 1 },
        { vertex: ids[b]!, from: ids[(b + 1) % 3]!, to: ids[(b + 2) % 3]!, marks: 1 },
      ],
    }
    const visible = `${prompt}\n${figure.ariaLabel}`
    if ([String(x), String(leg), String(fit.trapX)].some((secret) => exposed(visible, secret))) continue
    hide('converse', visible, [String(x), String(leg)])
    const stages = numberStages(x, { id: 'geo_base_angles_wrong_vertex', text: String(fit.trapX), witness: CONV_W }, askedName, leg, 'len', null, UNIT4_RULE_IDS.base)
    const sideLens = [0, 1, 2].map((i) => ((i + 2) % 3 === a || (i + 2) % 3 === b ? leg : baseSide))
    return numberAnswer('isoscelesSolve', prompt, figure, stages, sideLens, stored, 'geo_base_angles_wrong_vertex', 'x', String(fit.trapX), 'Isosceles triangle', { case: 'converse' })
  }
  throw new Error(`gi.solve/${seed}: no ${family}`)
}
