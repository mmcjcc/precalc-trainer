/**
 * Honors geometry Unit 5, gq.coords: four vertices on the coordinate plane. She finds the slopes of the sides,
 * the lengths of the sides, or the midpoints of the diagonals, then says what they show. A trap seed asks for
 * the slopes of one pair and the lengths of the other pair of an isosceles trapezoid, which proves nothing.
 *
 * Every slope she finds is a fraction that is not a whole number and every length an irrational radical in
 * simplest form, so no answer can be read off a coordinate in the prompt.
 */
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { GeometryAnswer } from '@/content/types'
import type { GeoFigureSpec } from '@/shared/types'
import { formatPoint, geoQty } from './answer'
import type { GeoBuilt } from './build'
import { showNum, showPt } from './expr'
import { PT_HINT5, RAD_HINT5, SLOPE_HINT5, RESERVED_TEXT, choiceStage, finish5, numberStage, type ChoiceDraft5, type TrapDraft } from './unit5Build'
import { latticeIsoTrap, latticePgram, latticeQuad, latticeTrap, lenOk, lenText, minus, slopeOk, slopeText, type V } from './unit5Lattice'
import { seg, sideName, vtx, type Ids } from './unit5Figs'
import { goodQuad, labeled, quadLetters, type XY } from './unit5Geom'
import { PARALLELOGRAM_RULES, UNIT5_RULE_FOR, UNIT5_RULE_IDS } from './unit5Rules'

export type CoordMode = 'slopesYes' | 'slopesNo' | 'lengthsYes' | 'lengthsNo' | 'midYes' | 'midNo' | 'mixed'
export const COORD_MODES: readonly CoordMode[] = ['slopesYes', 'slopesNo', 'lengthsYes', 'lengthsNo', 'midYes', 'midNo', 'mixed']

const SLOPE_W = 'That is the change in x over the change in y. Slope is the change in y over the change in x.'
const NO_ROOT_W = 'That is the sum of the squared changes. The length is the square root of that sum, in simplest radical form.'
const NOT_SQUARED_W = 'That adds the changes in x and y, which walks the grid. Square each change, add, then take the square root.'
const MID_W = 'That point halves the differences of the coordinates. The midpoint adds each pair of coordinates, then divides by 2.'

/** "3 − (−2)": a difference as she would write it, with a negative number in parentheses. */
function diffText(a: number, b: number): string {
  return `${showNum(a)} − ${b < 0 ? `(${showNum(b)})` : showNum(b)}`
}

/** Worked lines print a true minus sign; answers keep the ASCII hyphen she types. */
const minusSign = (t: string) => t.replace(/-/g, '−')

function pointText(a: V, b: V): string {
  return formatPoint(geoQty(a.x + b.x, 2, 1), geoQty(a.y + b.y, 2, 1))
}

function halfDiff(a: V, b: V): string {
  return formatPoint(geoQty(b.x - a.x, 2, 1), geoQty(b.y - a.y, 2, 1))
}

/** Conclusions she can pick, one set per kind of value. */
function conclusions(kind: 'slopes' | 'lengths', name: string): Record<'both' | 'onlyOne' | 'neither' | 'oneEnough', string> {
  const fact = kind === 'slopes' ? 'parallel' : 'congruent'
  return {
    both: `Both pairs of opposite sides are ${fact}, so ${name} is a parallelogram.`,
    onlyOne: `Only one pair of opposite sides is ${fact}, so ${name} is not a parallelogram.`,
    neither: `Neither pair of opposite sides is ${fact}, so ${name} is not a parallelogram.`,
    oneEnough: `One pair of opposite sides is ${fact}, so ${name} is a parallelogram.`,
  }
}

export function drawPgramCoords(seed: number): GeoBuilt {
  const mode = makeRng(mixSeed(seed, 5300)).pick(COORD_MODES)
  for (let attempt = 0; attempt < 600; attempt++) {
    const rng = makeRng(mixSeed(seed, 5301 + attempt))
    const built = coordsCase(rng, seed, mode)
    if (built) return built
  }
  throw new Error(`gq.coords/${seed}: no ${mode} figure`)
}

function shapeFor(rng: Rng, mode: CoordMode): V[] | null {
  if (mode === 'slopesYes') return latticePgram(rng, slopeOk)
  if (mode === 'lengthsYes') return latticePgram(rng, lenOk)
  if (mode === 'midYes') return latticePgram(rng, () => true)
  if (mode === 'slopesNo') return latticeTrap(rng)
  if (mode === 'lengthsNo' || mode === 'mixed') return latticeIsoTrap(rng)
  return latticeQuad(rng)
}

function coordsCase(rng: Rng, seed: number, mode: CoordMode): GeoBuilt | null {
  const raw = shapeFor(rng, mode)
  if (!raw) return null
  // Start the letters at any corner and go either way around, so the special pair is not always PQ and RS.
  const start = rng.int(0, 3)
  const dir = rng.chance(0.5) ? 1 : -1
  const pts = [0, 1, 2, 3].map((i) => raw[(((start + dir * i) % 4) + 4) % 4]!)
  const xy: XY[] = pts.map((p) => ({ x: p.x, y: p.y }))
  if (!goodQuad(xy, 28, 0.25)) return null
  const ids = quadLetters(rng) as Ids
  const name = ids.join('')
  const P = (k: number) => pts[((k % 4) + 4) % 4]!
  const sideVec = (i: number) => minus(P(i + 1), P(i))
  const sides = [0, 1, 2, 3].map(sideVec)
  const listed = ids.map((id, k) => `${id}${showPt(P(k).x, P(k).y)}`)
  const vertices = `${listed[0]}, ${listed[1]}, ${listed[2]}, and ${listed[3]}`
  const aria = `Quadrilateral ${name} on a coordinate grid, with ${ids.map((id, k) => `${id} at ${showPt(P(k).x, P(k).y)}`).join(', ')}.`
  const parallel = (i: number, j: number) => sides[i]!.x * sides[j]!.y - sides[i]!.y * sides[j]!.x === 0
  const congruent = (i: number, j: number) => sides[i]!.x ** 2 + sides[i]!.y ** 2 === sides[j]!.x ** 2 + sides[j]!.y ** 2
  const stages: GeometryAnswer['stages'] = []
  const traps: TrapDraft[] = []
  const ids4 = ['a', 'b', 'c', 'd'] as const
  // Opposite pairs first: PQ and RS, then QR and SP.
  const order = [0, 2, 1, 3]
  let prompt = ''
  let choices: ChoiceDraft5[] = []
  let answerId = ''
  let reveal = ''
  let promise: GeometryAnswer['trap'][] = []
  let hint = ''
  let nudge = ''
  let finalLabel = 'What the values show'
  const slopeStage = (k: number, i: number) => {
    const v = sides[i]!
    const id = ids4[k]!
    traps.push({ id: 'geo_slope_inverted', stage: id, text: slopeText({ x: v.y, y: v.x }), witness: SLOPE_W })
    return numberStage({
      id,
      label: `Slope of ${sideName(ids, i)}`,
      hint: SLOPE_HINT5,
      answerText: slopeText(v),
      nudge: 'Subtract the y-coordinates, subtract the x-coordinates in the same order, and divide.',
      ruleCard: UNIT5_RULE_IDS.slope,
      reveal: [`Slope of ${sideName(ids, i)} = (${diffText(P(i + 1).y, P(i).y)}) / (${diffText(P(i + 1).x, P(i).x)}) = ${slopeText(v).replace('-', '−')}.`],
      traps,
    })
  }
  const lengthStage = (k: number, i: number) => {
    const v = sides[i]!
    const id = ids4[k]!
    traps.push({ id: 'geo_distance_no_root', stage: id, text: String(v.x * v.x + v.y * v.y), witness: NO_ROOT_W })
    traps.push({ id: 'geo_distance_not_squared', stage: id, text: String(Math.abs(v.x) + Math.abs(v.y)), witness: NOT_SQUARED_W })
    return numberStage({
      id,
      label: sideName(ids, i),
      hint: RAD_HINT5,
      answerText: lenText(v),
      nudge: 'Square the change in x and the change in y, add them, then take the square root.',
      ruleCard: 'geo-distance',
      reveal: [`${sideName(ids, i)} = √(${v.x * v.x} + ${v.y * v.y}) = ${lenText(v)}.`],
      traps,
    })
  }
  if (mode === 'slopesYes' || mode === 'slopesNo') {
    const c = conclusions('slopes', name)
    const both = parallel(0, 2) && parallel(1, 3)
    const one = parallel(0, 2) !== parallel(1, 3)
    if (mode === 'slopesYes' ? !both : !one) return null
    const pp = parallel(0, 2) ? [0, 2] : [1, 3]
    const np = parallel(0, 2) ? [1, 3] : [0, 2]
    for (let k = 0; k < 4; k++) stages.push(slopeStage(k, order[k]!))
    prompt = `Quadrilateral ${name} has vertices ${vertices}. Find the slope of each side. What do the slopes show?`
    answerId = both ? 'both' : 'onlyOne'
    choices = [
      { id: 'both', text: c.both },
      { id: 'onlyOne', text: c.onlyOne },
      { id: 'neither', text: c.neither },
      {
        id: 'oneEnough',
        text: c.oneEnough,
        trap: 'geo_one_pair_half_test',
        witness: both
          ? 'One pair of parallel sides is not enough on its own. Say what the slopes of the other pair show too.'
          : `Equal slopes on ${sideName(ids, pp[0]!)} and ${sideName(ids, pp[1]!)} show one pair of parallel sides. That alone is not enough: a trapezoid has one parallel pair.`,
      },
    ]
    hint = 'Compare the slopes of opposite sides.'
    nudge = 'Equal slopes mean parallel sides. Check both pairs of opposite sides.'
    reveal = both
      ? `${sideName(ids, 0)} and ${sideName(ids, 2)} have equal slopes, and so do ${sideName(ids, 1)} and ${sideName(ids, 3)}. Both pairs of opposite sides are parallel, so ${name} is a parallelogram by definition.`
      : `${sideName(ids, pp[0]!)} and ${sideName(ids, pp[1]!)} have equal slopes, but ${sideName(ids, np[0]!)} and ${sideName(ids, np[1]!)} do not. Only one pair is parallel, so ${name} is a trapezoid, not a parallelogram.`
    promise = both ? ['geo_slope_inverted'] : ['geo_one_pair_half_test']
    finalLabel = 'What the slopes show'
  } else if (mode === 'lengthsYes' || mode === 'lengthsNo') {
    const c = conclusions('lengths', name)
    const both = congruent(0, 2) && congruent(1, 3)
    const one = congruent(0, 2) !== congruent(1, 3)
    if (mode === 'lengthsYes' ? !both : !one) return null
    if (!sides.every(lenOk)) return null
    for (let k = 0; k < 4; k++) stages.push(lengthStage(k, order[k]!))
    prompt = `Quadrilateral ${name} has vertices ${vertices}. Find the length of each side. What do the lengths show?`
    answerId = both ? 'both' : 'onlyOne'
    const pairWith = congruent(0, 2) ? [0, 2] : [1, 3]
    choices = [
      { id: 'both', text: c.both },
      { id: 'onlyOne', text: c.onlyOne },
      { id: 'neither', text: c.neither },
      {
        id: 'oneEnough',
        text: c.oneEnough,
        trap: 'geo_one_pair_half_test',
        witness: both
          ? 'One pair of congruent sides is not enough on its own. Say what the lengths of the other pair show too.'
          : `${sideName(ids, pairWith[0]!)} and ${sideName(ids, pairWith[1]!)} have equal lengths, which is one pair of congruent sides. That alone is not enough: an isosceles trapezoid has one such pair.`,
      },
    ]
    hint = 'Compare the lengths of opposite sides.'
    nudge = 'Equal lengths mean congruent sides. Check both pairs of opposite sides.'
    reveal = both
      ? `${sideName(ids, 0)} = ${sideName(ids, 2)} and ${sideName(ids, 1)} = ${sideName(ids, 3)}: both pairs of opposite sides are congruent, so ${name} is a parallelogram.`
      : `Only ${sideName(ids, pairWith[0]!)} and ${sideName(ids, pairWith[1]!)} are equal. A parallelogram has both pairs of opposite sides congruent, so ${name} is not one.`
    promise = both ? ['geo_distance_no_root'] : ['geo_one_pair_half_test']
    finalLabel = 'What the lengths show'
  } else if (mode === 'midYes' || mode === 'midNo') {
    const m1 = pointText(P(0), P(2))
    const m2 = pointText(P(1), P(3))
    const same = m1 === m2
    if ((mode === 'midYes') !== same) return null
    if ([m1, m2].some((m) => RESERVED_TEXT.has(m))) return null
    const d1 = `${vtx(ids, 0)}${vtx(ids, 2)}`
    const d2 = `${vtx(ids, 1)}${vtx(ids, 3)}`
    traps.push({ id: 'geo_midpoint_subtracted', stage: 'a', text: halfDiff(P(0), P(2)), witness: MID_W })
    traps.push({ id: 'geo_midpoint_subtracted', stage: 'b', text: halfDiff(P(1), P(3)), witness: MID_W })
    stages.push(
      numberStage({
        id: 'a',
        kind: 'point',
        label: `Midpoint of ${d1}`,
        hint: PT_HINT5,
        answerText: m1,
        nudge: 'Add each pair of coordinates, then divide by 2.',
        ruleCard: 'geo-mid-formula',
        reveal: [`The midpoint of ${d1} is ${minusSign(m1)}.`],
        traps,
      }),
      numberStage({
        id: 'b',
        kind: 'point',
        label: `Midpoint of ${d2}`,
        hint: PT_HINT5,
        answerText: m2,
        nudge: 'Add each pair of coordinates, then divide by 2.',
        ruleCard: 'geo-mid-formula',
        reveal: [`The midpoint of ${d2} is ${minusSign(m2)}.`],
        traps,
      }),
    )
    prompt = `Quadrilateral ${name} has vertices ${vertices}. Find the midpoint of each diagonal, ${d1} and ${d2}. What do the midpoints show?`
    answerId = same ? 'same' : 'different'
    choices = [
      { id: 'same', text: `The diagonals have the same midpoint, so they bisect each other and ${name} is a parallelogram.` },
      { id: 'different', text: `The diagonals have different midpoints, so they do not bisect each other and ${name} is not a parallelogram.` },
    ]
    hint = 'Compare the two midpoints.'
    nudge = 'Diagonals that share a midpoint bisect each other.'
    reveal = same
      ? `Both diagonals have midpoint ${minusSign(m1)}, so the diagonals bisect each other and ${name} is a parallelogram.`
      : `The midpoints ${minusSign(m1)} and ${minusSign(m2)} are different, so the diagonals do not bisect each other and ${name} is not a parallelogram.`
    promise = ['geo_midpoint_subtracted']
    finalLabel = 'What the midpoints show'
  } else {
    // Slopes of the bases and lengths of the legs of an isosceles trapezoid.
    const b0 = parallel(0, 2) ? 0 : 1
    const [p0, p2, q1, q3] = [b0, b0 + 2, b0 + 1, (b0 + 3) % 4]
    if (!parallel(p0, p2) || !congruent(q1, q3) || parallel(q1, q3) || congruent(p0, p2)) return null
    if (!slopeOk(sides[p0]!) || !slopeOk(sides[p2]!) || !lenOk(sides[q1]!) || !lenOk(sides[q3]!)) return null
    stages.push(slopeStage(0, p0), slopeStage(1, p2), lengthStage(2, q1), lengthStage(3, q3))
    prompt = `Quadrilateral ${name} has vertices ${vertices}. Find the slopes of ${sideName(ids, p0)} and ${sideName(ids, p2)} and the lengths of ${sideName(ids, q1)} and ${sideName(ids, q3)}. What do these four values show?`
    answerId = 'notProved'
    choices = [
      {
        id: 'mixed',
        text: `One pair of opposite sides is parallel and the other pair is congruent, so ${name} is a parallelogram.`,
        trap: 'geo_parallel_congruent_mixed',
        witness: `The equal slopes are on ${sideName(ids, p0)} and ${sideName(ids, p2)}, and the equal lengths are on ${sideName(ids, q1)} and ${sideName(ids, q3)}: two different pairs. An isosceles trapezoid can have both.`,
      },
      { id: 'notProved', text: `These values do not prove that ${name} is a parallelogram.` },
      { id: 'bothParallel', text: `Both pairs of opposite sides are parallel, so ${name} is a parallelogram.` },
      { id: 'bothCongruent', text: `Both pairs of opposite sides are congruent, so ${name} is a parallelogram.` },
    ]
    hint = 'Notice which pair of sides each value is about.'
    nudge = 'One pair has equal slopes and the other pair has equal lengths. Check whether that is one of the five ways.'
    reveal = `${sideName(ids, p0)} ∥ ${sideName(ids, p2)} and ${sideName(ids, q1)} ≅ ${sideName(ids, q3)} are facts about two different pairs. An isosceles trapezoid has both, so these values do not prove a parallelogram. Here ${name} is an isosceles trapezoid.`
    promise = ['geo_parallel_congruent_mixed']
    finalLabel = 'What the four values show'
  }
  const finalId = (['b', 'c', 'e'] as const)[stages.length === 2 ? 1 : 2]!
  stages.push(
    choiceStage({
      id: finalId,
      label: finalLabel,
      hint,
      choices,
      answerId,
      nudge,
      ruleCard: mode.startsWith('mid') ? 'geo-mid-formula' : mode.startsWith('lengths') ? 'geo-distance' : mode === 'mixed' ? UNIT5_RULE_IDS.pgramTests : UNIT5_RULE_IDS.slope,
      reveal: [reveal],
      seed,
      salt: 5310,
    }),
  )
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const corners: XY[] = pts.map((p) => ({ x: p.x, y: p.y }))
  const points = labeled(ids, corners, corners)
  const segments = [0, 1, 2, 3].map((i) => seg(vtx(ids, i), vtx(ids, i + 1)))
  if (mode.startsWith('mid')) segments.push(seg(vtx(ids, 0), vtx(ids, 2)), seg(vtx(ids, 1), vtx(ids, 3)))
  const figure: GeoFigureSpec = {
    ariaLabel: aria,
    grid: { xMin: Math.min(...xs) - 1, xMax: Math.max(...xs) + 1, yMin: Math.min(...ys) - 1, yMax: Math.max(...ys) + 1 },
    points,
    segments,
  }
  return finish5({
    question: 'parallelogramCoords',
    prompt,
    figure,
    stages,
    lengths: [],
    angles: [],
    title: 'Parallelograms on the coordinate plane',
    instructions: 'Work out each value, then say what they show. The figure is there before you answer.',
    params: { case: mode, vertices: pts.map((p) => `${p.x},${p.y}`).join(' ') },
    cards: PARALLELOGRAM_RULES,
    ruleFor: UNIT5_RULE_FOR,
    promise,
  })
}
