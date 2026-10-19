/**
 * Honors geometry Unit 5, gq.prove (Jurgensen 5-2): which fact, if any, proves that a quadrilateral is a
 * parallelogram. The marks are exactly what is given. A figure whose marks do not prove it may still look like
 * a parallelogram; when it is drawn as something else, that shape (an isosceles trapezoid, a trapezoid, a kite)
 * has every mark too, so the marks honestly leave it open. Each run of six seeds shows the six answers once.
 */
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { GeometryAnswer } from '@/content/types'
import type { GeoAngleMark, GeoFigureSpec, GeoLine, GeoSegment } from '@/shared/types'
import type { GeoBuilt } from './build'
import { choiceStage, finish5, type ChoiceDraft5 } from './unit5Build'
import { seg, sideName, sideOf, vtx, type Ids } from './unit5Figs'
import { extraLetters, goodQuad, isoTrapezoidAt, kiteAt, labeled, parallelogramAt, quadLetters, tilt, trapezoidAt, turn, type XY } from './unit5Geom'
import { PARALLELOGRAM_RULES, UNIT5_RULE_FOR, UNIT5_RULE_IDS } from './unit5Rules'

export type ProveId = 'parallel' | 'sides' | 'onePair' | 'angles' | 'diagonals' | 'none'
export const PROVE_IDS: readonly ProveId[] = ['parallel', 'sides', 'onePair', 'angles', 'diagonals', 'none']
export const PROVE_TEXT: Record<ProveId, string> = {
  parallel: 'Both pairs of opposite sides are parallel',
  sides: 'Both pairs of opposite sides are congruent',
  onePair: 'One pair of opposite sides is both congruent and parallel',
  angles: 'Both pairs of opposite angles are congruent',
  diagonals: 'The diagonals bisect each other',
  none: 'Not enough information',
}

type NoneKind = 'mixed' | 'oneCongruent' | 'oneParallel' | 'consecutive' | 'oneDiagonal'
const NONE_KINDS: readonly NoneKind[] = ['mixed', 'oneCongruent', 'oneParallel', 'consecutive', 'oneDiagonal']

const PROVE_PROMPT = (name: string) => `The marks show what is given about quadrilateral ${name}. Which fact, if any, proves that ${name} is a parallelogram?`
const PROVE_HINT = 'Arrows mark parallel sides, ticks mark congruent segments, and arcs mark congruent angles. Only the marks count.'
const PROVE_NUDGE = 'List what the marks give, pair by pair. Then check that list against the five ways to prove a parallelogram.'
const TEST_MISSED_W = 'These marks are enough. Read each mark as a fact, then find which of the five ways those facts give.'

/** What the figure marks: arrows and ticks by side, arcs by vertex, ticks on the half-diagonals by vertex. */
interface ProveScene {
  arrows: Map<number, 1 | 2>
  ticks: Map<number, 1 | 2>
  arcs: Map<number, 1 | 2>
  diag: Map<number, 1 | 2> | null
}

function emptyScene(): ProveScene {
  return { arrows: new Map(), ticks: new Map(), arcs: new Map(), diag: null }
}

const mod4 = (k: number) => ((k % 4) + 4) % 4

/** A generic parallelogram: no right angle, and no two consecutive sides close in length. */
function plainPgram(rng: Rng): XY[] {
  const a = rng.int(10, 30)
  const b = a / (1.3 + rng.next() * 0.6)
  const alpha = rng.chance(0.5) ? rng.int(58, 76) : rng.int(104, 122)
  return parallelogramAt(a, b, alpha)
}

/** Isosceles trapezoid with bases on local sides 0 and 2. */
function isoTrap(rng: Rng): XY[] {
  const bottom = rng.int(18, 30)
  const top = bottom * (0.4 + rng.next() * 0.25)
  const base = rng.int(52, 72)
  const h = ((bottom - top) / 2) * Math.tan((base * Math.PI) / 180)
  return isoTrapezoidAt(bottom, top, h)
}

/** A trapezoid with bases on local sides 0 and 2 and legs of different lengths. */
function plainTrap(rng: Rng): XY[] {
  const bottom = rng.int(18, 30)
  const top = bottom * (0.4 + rng.next() * 0.25)
  const h = rng.int(9, 15)
  const sym = (bottom - top) / 2
  const shift = sym + (rng.chance(0.5) ? 1 : -1) * (2 + rng.next() * 3)
  return trapezoidAt(bottom, top, h, shift)
}

/** Kite with its axis from local corner 0 to 2; the axis bisects the diagonal from local corner 1 to 3. */
function plainKite(rng: Rng): XY[] {
  const axis = rng.int(20, 30)
  const p = axis * (0.28 + rng.next() * 0.12)
  const w = axis * (0.32 + rng.next() * 0.1)
  return kiteAt(axis, p, w)
}

/** Corners in letter order: letter k sits at local corner k − offset. */
function byLetters(local: XY[], offset: number): XY[] {
  return [0, 1, 2, 3].map((k) => local[mod4(k - offset)]!)
}

/** Where the diagonals of a convex quadrilateral (corners in order) cross. */
export function crossingOf(c: readonly XY[]): XY {
  const [a, b, cc, d] = c as [XY, XY, XY, XY]
  const r = { x: cc.x - a.x, y: cc.y - a.y }
  const s = { x: d.x - b.x, y: d.y - b.y }
  const den = r.x * s.y - r.y * s.x
  const t = ((b.x - a.x) * s.y - (b.y - a.y) * s.x) / den
  return { x: a.x + t * r.x, y: a.y + t * r.y }
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

function proveFigure(ids: Ids, corners: XY[], scene: ProveScene, T: string | null): GeoFigureSpec {
  const name = ids.join('')
  const lines: GeoLine[] = []
  const segments: GeoSegment[] = []
  for (let i = 0; i < 4; i++) {
    const [a, b] = sideOf(ids, i)
    const arrows = scene.arrows.get(i)
    const ticks = scene.ticks.get(i)
    if (arrows) lines.push({ through: [a, b], arrows })
    if (!arrows || ticks) segments.push(ticks ? seg(a, b, { ticks }) : seg(a, b))
  }
  const angles: GeoAngleMark[] = []
  for (const [k, n] of scene.arcs) angles.push({ vertex: vtx(ids, k), from: vtx(ids, k + 1), to: vtx(ids, k - 1), marks: n })
  let points = labeled(ids, corners, corners)
  if (scene.diag && T) {
    points = [...points, ...labeled([T], [crossingOf(corners)], corners, [T])]
    for (let k = 0; k < 4; k++) {
      const n = scene.diag.get(k)
      segments.push(n ? seg(vtx(ids, k), T, { ticks: n }) : seg(vtx(ids, k), T))
    }
  }
  const words: string[] = [`Quadrilateral ${name}.`]
  const sideWords = (map: Map<number, 1 | 2>, noun: string) => {
    for (const n of [1, 2] as const) {
      const pair = [...map.entries()].filter(([, c]) => c === n).map(([i]) => sideName(ids, i))
      if (pair.length === 2) words.push(`Sides ${pair[0]} and ${pair[1]} have ${plural(n, noun)} each.`)
    }
  }
  sideWords(scene.arrows, 'arrow')
  sideWords(scene.ticks, 'tick')
  for (const n of [1, 2] as const) {
    const at = [...scene.arcs.entries()].filter(([, c]) => c === n).map(([k]) => vtx(ids, k))
    if (at.length === 2) words.push(`Angles ${at[0]} and ${at[1]} have ${plural(n, 'arc')} each.`)
  }
  if (scene.diag && T) {
    words.push(`Diagonals ${vtx(ids, 0)}${vtx(ids, 2)} and ${vtx(ids, 1)}${vtx(ids, 3)} meet at ${T}.`)
    for (const n of [1, 2] as const) {
      const halves = [...scene.diag.entries()].filter(([, c]) => c === n).map(([k]) => `${vtx(ids, k)}${T}`)
      if (halves.length === 2) words.push(`Segments ${halves[0]} and ${halves[1]} have ${plural(n, 'tick')} each.`)
    }
  }
  if (words.length === 1) words.push('No marks.')
  return { ariaLabel: words.join(' '), points, segments, ...(lines.length ? { lines } : {}), ...(angles.length ? { angles } : {}) }
}

export function drawPgramProve(seed: number): GeoBuilt {
  // Each run of six seeds shows the six answers once, in an order drawn from the seed.
  const block = Math.floor((seed + 5) / 6)
  const answer = makeRng(mixSeed(block, 5200)).shuffle(PROVE_IDS)[(seed + 5) % 6]!
  const noneKind = makeRng(mixSeed(seed, 5199)).pick(NONE_KINDS)
  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = makeRng(mixSeed(seed, 5201 + attempt))
    const built = proveCase(rng, seed, answer, noneKind)
    if (built) return built
  }
  throw new Error(`gq.prove/${seed}: no ${answer} figure`)
}

function proveCase(rng: Rng, seed: number, answer: ProveId, noneKind: NoneKind): GeoBuilt | null {
  const ids = quadLetters(rng)
  const name = ids.join('')
  const scene = emptyScene()
  const o = rng.int(0, 1)
  const s = (i: number) => sideName(ids, i)
  let local: XY[] = plainPgram(rng)
  let offset = rng.int(0, 3)
  let T: string | null = null
  const traps = new Map<ProveId, { trap: GeometryAnswer['trap']; witness: string }>()
  let reveal = ''
  let family: string = answer
  if (answer !== 'none') traps.set('none', { trap: 'geo_parallelogram_test_missed', witness: TEST_MISSED_W })
  if (answer === 'parallel') {
    scene.arrows.set(0, 1).set(2, 1).set(1, 2).set(3, 2)
    reveal = `The arrows give ${s(0)} ∥ ${s(2)} and ${s(1)} ∥ ${s(3)}: both pairs of opposite sides are parallel, which is the definition of a parallelogram.`
  } else if (answer === 'sides') {
    scene.ticks.set(0, 1).set(2, 1).set(1, 2).set(3, 2)
    reveal = `The ticks give ${s(0)} ≅ ${s(2)} and ${s(1)} ≅ ${s(3)}: both pairs of opposite sides are congruent.`
  } else if (answer === 'onePair') {
    scene.arrows.set(o, 1).set(mod4(o + 2), 1)
    scene.ticks.set(o, 1).set(mod4(o + 2), 1)
    reveal = `The same pair, ${s(o)} and ${s(o + 2)}, is marked both parallel and congruent. One such pair is enough.`
  } else if (answer === 'angles') {
    scene.arcs.set(0, 1).set(2, 1).set(1, 2).set(3, 2)
    reveal = `The arcs give ∠${vtx(ids, 0)} ≅ ∠${vtx(ids, 2)} and ∠${vtx(ids, 1)} ≅ ∠${vtx(ids, 3)}: both pairs of opposite angles are congruent.`
  } else if (answer === 'diagonals') {
    T = extraLetters(rng, ids, 1)[0]!
    scene.diag = new Map<number, 1 | 2>([
      [0, 1],
      [2, 1],
      [1, 2],
      [3, 2],
    ])
    reveal = `The ticks give ${vtx(ids, 0)}${T} ≅ ${T}${vtx(ids, 2)} and ${vtx(ids, 1)}${T} ≅ ${T}${vtx(ids, 3)}: ${T} is the midpoint of both diagonals, so the diagonals bisect each other.`
  } else {
    // Drawn half the time as a parallelogram (the marks still do not prove it) and half the time as the
    // shape that has the same marks without being one.
    const looksLikeOne = rng.chance(0.5)
    family = `${noneKind}-${looksLikeOne ? 'pgram' : 'other'}`
    if (noneKind === 'mixed') {
      scene.arrows.set(o, 1).set(mod4(o + 2), 1)
      scene.ticks.set(mod4(o + 1), 1).set(mod4(o + 3), 1)
      if (!looksLikeOne) {
        local = isoTrap(rng)
        offset = o
      }
      traps.set('onePair', {
        trap: 'geo_parallel_congruent_mixed',
        witness: `The arrows are on ${s(o)} and ${s(o + 2)}, and the ticks are on ${s(o + 1)} and ${s(o + 3)}: two different pairs. No single pair is marked both parallel and congruent.`,
      })
      reveal = `The marks give ${s(o)} ∥ ${s(o + 2)} and ${s(o + 1)} ≅ ${s(o + 3)}: one pair parallel and the other pair congruent. An isosceles trapezoid has those marks too, so they do not prove a parallelogram.`
    } else if (noneKind === 'oneCongruent') {
      scene.ticks.set(o, 1).set(mod4(o + 2), 1)
      if (!looksLikeOne) {
        // Legs of the trapezoid are local sides 1 and 3, so the ticked pair is drawn as the legs.
        local = isoTrap(rng)
        offset = o + 1
      }
      const only = `Only ${s(o)} and ${s(o + 2)} are marked, with ticks.`
      traps.set('onePair', { trap: 'geo_one_pair_half_test', witness: `${only} Nothing marks that pair parallel, and one pair proves it only when it is both.` })
      traps.set('sides', { trap: 'geo_one_pair_half_test', witness: `${only} ${s(o + 1)} and ${s(o + 3)} have no marks, so the figure does not give both pairs.` })
      reveal = `The ticks give only ${s(o)} ≅ ${s(o + 2)}. One pair of congruent sides can belong to an isosceles trapezoid, so the marks do not prove a parallelogram.`
    } else if (noneKind === 'oneParallel') {
      scene.arrows.set(o, 1).set(mod4(o + 2), 1)
      if (!looksLikeOne) {
        local = plainTrap(rng)
        offset = o
      }
      const only = `Only ${s(o)} and ${s(o + 2)} are marked, with arrows.`
      traps.set('onePair', { trap: 'geo_one_pair_half_test', witness: `${only} Nothing marks that pair congruent, and one pair proves it only when it is both.` })
      traps.set('parallel', { trap: 'geo_one_pair_half_test', witness: `${only} ${s(o + 1)} and ${s(o + 3)} have no arrows, so the figure does not give both pairs.` })
      reveal = `The arrows give only ${s(o)} ∥ ${s(o + 2)}. A trapezoid has one pair of parallel sides, so the marks do not prove a parallelogram.`
    } else if (noneKind === 'consecutive') {
      // Congruent angles that share a side force an isosceles trapezoid's look, so this one is always drawn as one.
      family = noneKind
      const v = rng.int(0, 3)
      scene.arcs.set(mod4(v), 1).set(mod4(v + 1), 1).set(mod4(v + 2), 2).set(mod4(v + 3), 2)
      local = isoTrap(rng)
      offset = v
      const A = vtx(ids, v)
      const B = vtx(ids, v + 1)
      traps.set('angles', {
        trap: 'geo_consecutive_marks_as_opposite',
        witness: `The single arcs are on ∠${A} and ∠${B}, which share side ${A}${B}. The angle across from ∠${A} is ∠${vtx(ids, v + 2)}.`,
      })
      reveal = `The arcs give ∠${A} ≅ ∠${B} and ∠${vtx(ids, v + 2)} ≅ ∠${vtx(ids, v + 3)}: consecutive angles, not opposite ones. An isosceles trapezoid has those angles, so they do not prove a parallelogram.`
    } else {
      T = extraLetters(rng, ids, 1)[0]!
      const d = rng.int(0, 1)
      scene.diag = new Map<number, 1 | 2>([
        [d, 1],
        [mod4(d + 2), 1],
      ])
      if (!looksLikeOne) {
        // The kite's axis (local corners 0 and 2) bisects the diagonal from local corner 1, drawn as letter d.
        local = plainKite(rng)
        offset = d - 1
      }
      const A = vtx(ids, d)
      const C = vtx(ids, d + 2)
      traps.set('diagonals', {
        trap: 'geo_one_diagonal_bisected',
        witness: `The ticks cut ${A}${C} in half at ${T}, but nothing marks ${vtx(ids, d + 1)}${T} and ${T}${vtx(ids, d + 3)} equal. Only one diagonal is shown bisected.`,
      })
      reveal = `The ticks give only ${A}${T} ≅ ${T}${C}: one diagonal is bisected. A kite has those marks too, so they do not prove a parallelogram.`
    }
  }
  const corners = byLetters(turn(local, tilt(rng, 12), rng.chance(0.5)), offset)
  if (!goodQuad(corners, 30)) return null
  const figure = proveFigure(ids, corners, scene, T)
  const choices: ChoiceDraft5[] = PROVE_IDS.map((id) => {
    const t = traps.get(id)
    return t ? { id, text: PROVE_TEXT[id], trap: t.trap, witness: t.witness } : { id, text: PROVE_TEXT[id] }
  })
  const stage = choiceStage({
    id: 'a',
    label: 'Proof of a parallelogram',
    hint: PROVE_HINT,
    choices,
    answerId: answer,
    nudge: PROVE_NUDGE,
    ruleCard: UNIT5_RULE_IDS.pgramTests,
    reveal: [reveal],
    seed,
    salt: 5210,
  })
  return finish5({
    question: 'parallelogramProve',
    prompt: PROVE_PROMPT(name),
    figure,
    stages: [stage],
    lengths: [],
    angles: [],
    title: 'Proving a parallelogram',
    instructions: 'One part. The marks on the figure are exactly what is given.',
    params: { case: family, answer },
    cards: PARALLELOGRAM_RULES,
    ruleFor: UNIT5_RULE_FOR,
    promise: ['geo_parallel_congruent_mixed', 'geo_one_pair_half_test', 'geo_consecutive_marks_as_opposite', 'geo_one_diagonal_bisected', 'geo_parallelogram_test_missed'],
  })
}
