/**
 * Honors geometry Unit 7, module geoSpecialRight (Jurgensen 8-4): the 45°-45°-90° and 30°-60°-90° triangles from one
 * side (a whole number or a radical), alone and inside figures: a square's diagonal, an equilateral triangle's
 * altitude, a rectangle whose diagonal makes 30° with a side, a rhombus with a 60° angle, an isosceles right
 * triangle's legs from its hypotenuse. Exact answers.
 *
 * Every side comes from the precalculus core (`@/engine/trig` specialSide), and the slips are its specialSlips (the
 * factors swapped, the hypotenuse as twice a leg of a 45°-45°-90° triangle, a factor used the wrong way, the legs
 * swapped), plus the geometry slips of a figure (the whole side where the right triangle has half of it, half a
 * diagonal for the whole).
 */
import { specialSide, specialSlips, type SpecialRole, type SpecialTriangle } from '@/engine/trig'
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { ErrorPatternId, GeoAngleMark, GeoPoint, GeoSegment } from '@/shared/types'
import type { GeoQty } from './answer'
import type { GeoBuilt } from './build'
import { pickLetters6 } from './unit6Geom'
import { weighted } from './unit6Ratios'
import {
  SPECIAL_HINT7,
  approxQ,
  centerOf,
  coreWords,
  exactStage7,
  finish7,
  fromTrig,
  int,
  isWholeQ,
  placeAll,
  placeLabels7,
  pointOf,
  qSay,
  rad,
  smallestAngle,
  toTrig,
  type P2,
  type Stage7,
  type TrapDraft7,
} from './unit7Build'
import { SPECIAL_RIGHT_RULES, UNIT7_RULE_IDS } from './unit7Rules'

const INSTRUCTIONS = 'Give each length exactly, in simplest radical form. The figure is there before you answer.'

export type SpecialCase = 'tri45' | 'tri30' | 'square' | 'equilateral' | 'rectangle30' | 'rhombus60' | 'isoRight'

const side = (tri: SpecialTriangle, from: SpecialRole, value: GeoQty, to: SpecialRole): GeoQty => fromTrig(specialSide(tri, from, toTrig(value), to))

/** The core's slips for one side, as geometry traps on a part. */
function coreTraps(tri: SpecialTriangle, from: SpecialRole, value: GeoQty, to: SpecialRole, stage: 'x' | 'result'): TrapDraft7[] {
  return specialSlips(tri, from, toTrig(value), to).flatMap((s) => (s.value === 'undefined' ? [] : [{ id: s.id as ErrorPatternId, stage, value: fromTrig(s.value), witness: coreWords(s.witness) }]))
}


/** The worked line for one side from another, in the theorem's words. */
function specialReveal(tri: SpecialTriangle, from: SpecialRole, given: GeoQty, to: SpecialRole, name: string, answer: GeoQty): string {
  const g = qSay(given)
  const a = qSay(answer)
  if (tri === '45') {
    return to === 'hyp'
      ? `In the 45°-45°-90° triangle the hypotenuse is √2 times a leg, so ${name} = ${g} · √2 = ${a}.`
      : `In the 45°-45°-90° triangle a leg is the hypotenuse divided by √2, so ${name} = ${g}/√2 = ${a}.`
  }
  const short = side('30', from, given, 'short')
  const s = qSay(short)
  // "14/2 = 7", but "11/2" and "13√3/2" are already the half: no "= 11/2" after them.
  const bare = (t: string) => t.replace(/[()]/g, '')
  const halfOf = (t: string, result: string) => (bare(`${t}/2`) === bare(result) ? result : `${t}/2 = ${result}`)
  if (from === 'short') {
    return to === 'long'
      ? `In the 30°-60°-90° triangle the longer leg is √3 times the shorter leg, so ${name} = ${g} · √3 = ${a}.`
      : `In the 30°-60°-90° triangle the hypotenuse is twice the shorter leg, so ${name} = 2 · ${g} = ${a}.`
  }
  if (to === 'short') {
    return from === 'long'
      ? `In the 30°-60°-90° triangle the shorter leg is the longer leg divided by √3, so ${name} = ${g}/√3 = ${a}.`
      : `In the 30°-60°-90° triangle the shorter leg is half the hypotenuse, so ${name} = ${halfOf(g, a)}.`
  }
  const first = from === 'long' ? `the shorter leg is ${g}/√3 = ${s}` : `the shorter leg is ${halfOf(g, s)}`
  const then = to === 'hyp' ? `the hypotenuse is twice that, so ${name} = ${a}` : `the longer leg is √3 times that, so ${name} = ${a}`
  return `In the 30°-60°-90° triangle ${first}, and ${then}.`
}

/** A side a problem may give: a whole number, or a whole number times √2 or √3. */
function givenValue(rng: Rng, radical: 2 | 3 | null): GeoQty {
  const k = rng.int(2, 22)
  return radical ? rad(k, 1, radical) : int(k)
}

interface Asked {
  role: SpecialRole
  /** The segment it is, for the prompt and the figure. */
  name: string
}

/** The stages for the asked sides (x then y), each from the given side. */
function stagesFor(tri: SpecialTriangle, from: SpecialRole, given: GeoQty, asked: Asked[], nudge: string, card: string, extra: (role: SpecialRole, stage: 'x' | 'result') => TrapDraft7[], givens: GeoQty[]): Stage7[] {
  return asked.map((a, i) => {
    const id = i === 0 ? 'x' : 'result'
    const answer = side(tri, from, given, a.role)
    return exactStage7({
      id,
      label: i === 0 ? 'x' : 'y',
      hint: SPECIAL_HINT7,
      answer,
      nudge,
      ruleCard: card,
      reveal: [specialReveal(tri, from, given, a.role, a.name, answer)],
      traps: [...coreTraps(tri, from, given, a.role, id), ...extra(a.role, id)],
      givens,
    })
  })
}

/** "Find x, the length of PQ." or "Find x, the length of PQ, and y, the length of QR." */
function findText(asked: Asked[], each = false): string {
  if (asked.length === 1) return each ? `Find x, the length of each leg.` : `Find x, the length of ${asked[0]!.name}.`
  return `Find x, the length of ${asked[0]!.name}, and y, the length of ${asked[1]!.name}.`
}

const ORDER: Record<SpecialRole, number> = { short: 0, leg: 0, long: 1, hyp: 2 }

function finishSpecial(kind: SpecialCase, prompt: string, figure: Parameters<typeof finish7>[0]['figure'] | null, stages: Stage7[], givens: GeoQty[], rng: Rng, params: Record<string, string | number | boolean>): GeoBuilt | null {
  if (!figure) return null
  return finish7({
    question: 'specialRight',
    prompt,
    figure,
    stages,
    lengths: givens.filter((g) => isWholeQ(g)).map((g) => g.n),
    title: kind === 'tri45' || kind === 'isoRight' ? 'The 45°-45°-90° triangle' : kind === 'tri30' ? 'The 30°-60°-90° triangle' : 'Special right triangles in figures',
    instructions: INSTRUCTIONS,
    params: { case: kind, ...params },
    cards: SPECIAL_RIGHT_RULES,
    promise: rng.shuffle<ErrorPatternId>(['trig_special_root3_two_swapped', 'trig_special_45_two', 'trig_special_legs_swapped', 'trig_special_wrong_way', 'geo_half_not_taken', 'geo_half_for_whole']),
  })
}

/** A right triangle P, Q, R with the right angle at R, PR along one axis and QR along the other, turned and mirrored. */
function rightFigure(rng: Rng, ids: [string, string, string], pr: number, qr: number, labels: { pr?: string; qr?: string; pq?: string }, angle: GeoAngleMark | null, aria: string) {
  const [P, Q, R] = ids
  const pts = placeAll(
    [
      { x: pr, y: 0 },
      { x: 0, y: qr },
      { x: 0, y: 0 },
    ],
    rng.int(0, 359),
    rng.chance(0.5),
  ) as [P2, P2, P2]
  if (smallestAngle(pts[0], pts[1], pts[2]) < 25) return null
  const center = centerOf(pts)
  const segments: GeoSegment[] = [
    { from: P, to: R, ...(labels.pr ? { label: labels.pr } : {}) },
    { from: Q, to: R, ...(labels.qr ? { label: labels.qr } : {}) },
    { from: P, to: Q, ...(labels.pq ? { label: labels.pq } : {}) },
  ]
  const angles: GeoAngleMark[] = [{ vertex: R, from: P, to: Q, right: true }, ...(angle ? [angle] : [])]
  return placeLabels7({ ariaLabel: aria, points: [pointOf(P, pts[0], center), pointOf(Q, pts[1], center), pointOf(R, pts[2], center)], segments, angles }, [[P, Q, R]])
}

function labelWords(pairs: [string, string | undefined][]): string {
  const items = pairs.filter(([, t]) => t).map(([n, t]) => `${n} is labeled ${t}`)
  if (items.length === 0) return ''
  if (items.length === 1) return `${items[0]}.`
  return `${items.slice(0, -1).join(', ')}${items.length > 2 ? ',' : ''} and ${items[items.length - 1]}.`.replace(/^./, (c) => c.toUpperCase())
}

function tri45(rng: Rng): GeoBuilt | null {
  const [P, Q, R] = pickLetters6(rng, 3) as [string, string, string]
  const fromLeg = rng.chance(0.55)
  const given = givenValue(rng, rng.chance(0.45) ? 2 : null)
  const from: SpecialRole = fromLeg ? 'leg' : 'hyp'
  const to: SpecialRole = fromLeg ? 'hyp' : 'leg'
  const leg = side('45', from, given, 'leg')
  const L = approxQ(leg)
  const asked: Asked[] = [{ role: to, name: fromLeg ? `${P}${Q}` : 'each leg' }]
  const labels = fromLeg ? { pr: qSay(given), pq: 'x' } : { pr: 'x', qr: 'x', pq: qSay(given) }
  const angle: GeoAngleMark = { vertex: P, from: R, to: Q, label: '45°' }
  const aria = `Right triangle ${P}${Q}${R} with the right angle at ${R} and an angle of 45° at ${P}. ${labelWords([
    [`${P}${R}`, labels.pr],
    [`${Q}${R}`, labels.qr],
    [`${P}${Q}`, labels.pq],
  ])}`
  const figure = rightFigure(rng, [P, Q, R], L, L, labels, angle, aria)
  const stages = stagesFor('45', from, given, asked, fromLeg ? 'This is the 45°-45°-90° triangle: the hypotenuse is √2 times a leg.' : 'This is the 45°-45°-90° triangle: both legs are equal, and the hypotenuse is √2 times a leg.', UNIT7_RULE_IDS.special45, () => [], [given])
  const prompt = fromLeg
    ? `In 45°-45°-90° triangle ${P}${Q}${R}, ∠${R} is the right angle and ${P}${R} = ${qSay(given)}. ${findText(asked)}`
    : `In 45°-45°-90° triangle ${P}${Q}${R}, ∠${R} is the right angle and ${P}${Q} = ${qSay(given)}. ${findText(asked, true)}`
  return finishSpecial('tri45', prompt, figure, stages, [given], rng, { from, given: qSay(given) })
}

function tri30(rng: Rng, fixed?: { from: 'short' | 'long' | 'hyp'; given: GeoQty; asked: ('short' | 'long' | 'hyp')[]; at60: boolean }): GeoBuilt | null {
  const [P, Q, R] = pickLetters6(rng, 3) as [string, string, string]
  // ∠P = 30°: QR (across from P) is the shorter leg, PR the longer leg, PQ the hypotenuse.
  const names: Record<'short' | 'long' | 'hyp', string> = { short: `${Q}${R}`, long: `${P}${R}`, hyp: `${P}${Q}` }
  const from = fixed?.from ?? rng.pick(['short', 'long', 'hyp'] as const)
  const given = fixed?.given ?? givenValue(rng, rng.chance(0.4) ? 3 : null)
  const others = (['short', 'long', 'hyp'] as const).filter((r) => r !== from)
  const askedRoles = fixed ? [...fixed.asked] : rng.chance(0.6) ? [...others] : [rng.pick(others)]
  askedRoles.sort((p, q) => ORDER[p] - ORDER[q])
  const asked: Asked[] = askedRoles.map((role) => ({ role, name: names[role] }))
  const short = side('30', from, given, 'short')
  const S = approxQ(short)
  const labelOf = (role: 'short' | 'long' | 'hyp') => (role === from ? qSay(given) : askedRoles[0] === role ? 'x' : askedRoles[1] === role ? 'y' : undefined)
  const labels = { pr: labelOf('long'), qr: labelOf('short'), pq: labelOf('hyp') }
  const at60 = fixed?.at60 ?? rng.chance(0.35)
  const angle: GeoAngleMark = at60 ? { vertex: Q, from: R, to: P, label: '60°' } : { vertex: P, from: R, to: Q, label: '30°' }
  const aria = `Right triangle ${P}${Q}${R} with the right angle at ${R} and an angle of ${at60 ? `60° at ${Q}` : `30° at ${P}`}. ${labelWords([
    [`${P}${R}`, labels.pr],
    [`${Q}${R}`, labels.qr],
    [`${P}${Q}`, labels.pq],
  ])}`
  const figure = rightFigure(rng, [P, Q, R], S * Math.sqrt(3), S, labels, angle, aria)
  const stages = stagesFor('30', from, given, asked, 'This is the 30°-60°-90° triangle. Find the shorter leg first: it is across from the 30° angle.', UNIT7_RULE_IDS.special30, () => [], [given])
  const angleText = at60 ? `m∠${Q} = 60` : `m∠${P} = 30`
  const prompt = `In 30°-60°-90° triangle ${P}${Q}${R}, ∠${R} is the right angle, ${angleText}, and ${names[from]} = ${qSay(given)}. ${findText(asked)}`
  return finishSpecial('tri30', prompt, figure, stages, [given], rng, { from, given: qSay(given), asked: askedRoles.join(',') })
}

function square(rng: Rng, fixed?: { fromSide: boolean; given: GeoQty }): GeoBuilt | null {
  const [A, B, C, D] = pickLetters6(rng, 4) as [string, string, string, string]
  const fromSide = fixed?.fromSide ?? rng.chance(0.55)
  const given = fixed?.given ?? givenValue(rng, rng.chance(0.4) ? 2 : null)
  const sideLen = fromSide ? given : side('45', 'hyp', given, 'leg')
  const s = approxQ(sideLen)
  const pts = placeAll(
    [
      { x: -s / 2, y: -s / 2 },
      { x: s / 2, y: -s / 2 },
      { x: s / 2, y: s / 2 },
      { x: -s / 2, y: s / 2 },
    ],
    rng.int(-30, 30),
    rng.chance(0.5),
  )
  const center = centerOf(pts)
  const ab = `${A}${B}`
  const ac = `${A}${C}`
  const segments: GeoSegment[] = [
    { from: A, to: B, label: fromSide ? qSay(given) : 'x' },
    { from: B, to: C },
    { from: C, to: D },
    { from: D, to: A },
    { from: A, to: C, label: fromSide ? 'x' : qSay(given) },
  ]
  const aria = `Square ${A}${B}${C}${D} with diagonal ${ac} and a right-angle mark at ${B}. ${ab} is labeled ${segments[0]!.label} and ${ac} is labeled ${segments[4]!.label}.`
  const figure = placeLabels7(
    { ariaLabel: aria, points: [A, B, C, D].map((id, i) => pointOf(id, pts[i]!, center)), segments, angles: [{ vertex: B, from: A, to: C, right: true }] },
    [[A, B, C, D]],
  )
  const asked: Asked[] = [{ role: fromSide ? 'hyp' : 'leg', name: fromSide ? ac : ab }]
  const stages = stagesFor(
    '45',
    fromSide ? 'leg' : 'hyp',
    given,
    asked,
    `The diagonal cuts the square into two 45°-45°-90° triangles, with the sides of the square as legs.`,
    UNIT7_RULE_IDS.specialFigures,
    () => [],
    [given],
  )
  const prompt = fromSide
    ? `${A}${B}${C}${D} is a square with sides of length ${qSay(given)}. Find x, the length of diagonal ${ac}.`
    : `${A}${B}${C}${D} is a square with diagonal ${ac} = ${qSay(given)}. Find x, the length of ${ab}.`
  return finishSpecial('square', prompt, figure, stages, [given], rng, { from: fromSide ? 'side' : 'diagonal', given: qSay(given) })
}

function equilateral(rng: Rng, fixed?: { fromSide: boolean; given: GeoQty }): GeoBuilt | null {
  const [A, B, C, D] = pickLetters6(rng, 4) as [string, string, string, string]
  const fromSide = fixed?.fromSide ?? rng.chance(0.6)
  const given = fixed?.given ?? givenValue(rng, rng.chance(0.4) ? 3 : null)
  // Right triangle ABD: hypotenuse AB (a side), shorter leg BD (half a side), longer leg AD (the altitude).
  const sideLen = fromSide ? given : side('30', 'long', given, 'hyp')
  const s = approxQ(sideLen)
  const h = (s * Math.sqrt(3)) / 2
  const pts = placeAll(
    [
      { x: 0, y: h * 0.62 },
      { x: -s / 2, y: -h * 0.38 },
      { x: s / 2, y: -h * 0.38 },
      { x: 0, y: -h * 0.38 },
    ],
    rng.int(-30, 30) + (rng.chance(0.25) ? 180 : 0),
    false,
  ) as [P2, P2, P2, P2]
  const center = centerOf([pts[0], pts[1], pts[2]])
  const ab = `${A}${B}`
  const ad = `${A}${D}`
  const segments: GeoSegment[] = [
    { from: A, to: B, label: fromSide ? qSay(given) : 'x' },
    { from: A, to: C },
    { from: B, to: C },
    { from: A, to: D, label: fromSide ? 'x' : qSay(given) },
  ]
  const aria = `Equilateral triangle ${A}${B}${C} with the altitude ${ad} to ${B}${C}, and a right-angle mark at ${D}. ${ab} is labeled ${segments[0]!.label} and ${ad} is labeled ${segments[3]!.label}.`
  const figure = placeLabels7(
    {
      ariaLabel: aria,
      points: [pointOf(A, pts[0], center), pointOf(B, pts[1], center), pointOf(C, pts[2], center), pointOf(D, pts[3], pts[0])],
      segments,
      angles: [{ vertex: D, from: C, to: A, right: true }],
    },
    [[A, B, C]],
  )
  const extra = (role: SpecialRole, stage: 'x' | 'result'): TrapDraft7[] => {
    if (fromSide && role === 'long') {
      // The whole side used as the shorter leg: the altitude would be the side times √3.
      return [
        {
          id: 'geo_half_not_taken',
          stage,
          value: side('30', 'short', given, 'long'),
          witness: `That uses the whole side as the shorter leg. The altitude cuts ${B}${C} in half, so the shorter leg of right triangle ${A}${B}${D} is half a side.`,
        },
      ]
    }
    if (!fromSide && role === 'hyp') {
      return [
        {
          id: 'geo_half_for_whole',
          stage,
          value: side('30', 'long', given, 'short'),
          witness: `That is ${B}${D}, the shorter leg, which is half a side. A side of the equilateral triangle is twice ${B}${D}.`,
        },
      ]
    }
    return []
  }
  const asked: Asked[] = [{ role: fromSide ? 'long' : 'hyp', name: fromSide ? ad : ab }]
  const stages = stagesFor(
    '30',
    fromSide ? 'hyp' : 'long',
    given,
    asked,
    `The altitude cuts the equilateral triangle into two 30°-60°-90° triangles. In triangle ${A}${B}${D}, the hypotenuse is a side and the shorter leg is half a side.`,
    UNIT7_RULE_IDS.specialFigures,
    extra,
    [given],
  )
  const prompt = fromSide
    ? `Equilateral triangle ${A}${B}${C} has sides of length ${qSay(given)}, and ${ad} is an altitude. Find x, the length of ${ad}.`
    : `The altitude ${ad} of equilateral triangle ${A}${B}${C} has length ${qSay(given)}. Find x, the length of ${ab}.`
  return finishSpecial('equilateral', prompt, figure, stages, [given], rng, { from: fromSide ? 'side' : 'altitude', given: qSay(given) })
}

function rectangle30(rng: Rng): GeoBuilt | null {
  const [A, B, C, D] = pickLetters6(rng, 4) as [string, string, string, string]
  // m∠BAC = 30: in right triangle ABC, BC is the shorter leg, AB the longer leg, AC the hypotenuse.
  const names: Record<'short' | 'long' | 'hyp', string> = { short: `${B}${C}`, long: `${A}${B}`, hyp: `${A}${C}` }
  const from = rng.pick(['short', 'long', 'hyp'] as const)
  const given = givenValue(rng, rng.chance(0.4) ? 3 : null)
  const others = (['short', 'long', 'hyp'] as const).filter((r) => r !== from)
  const askedRoles = rng.chance(0.55) ? [...others] : [rng.pick(others)]
  askedRoles.sort((p, q) => ORDER[p] - ORDER[q])
  const asked: Asked[] = askedRoles.map((role) => ({ role, name: names[role] }))
  const S = approxQ(side('30', from, given, 'short'))
  const Lg = S * Math.sqrt(3)
  const pts = placeAll(
    [
      { x: -Lg / 2, y: -S / 2 },
      { x: Lg / 2, y: -S / 2 },
      { x: Lg / 2, y: S / 2 },
      { x: -Lg / 2, y: S / 2 },
    ],
    rng.int(-25, 25),
    rng.chance(0.5),
  )
  const center = centerOf(pts)
  const labelOf = (role: 'short' | 'long' | 'hyp') => (role === from ? qSay(given) : askedRoles[0] === role ? 'x' : askedRoles[1] === role ? 'y' : undefined)
  const segments: GeoSegment[] = [
    { from: A, to: B, ...(labelOf('long') ? { label: labelOf('long')! } : {}) },
    { from: B, to: C, ...(labelOf('short') ? { label: labelOf('short')! } : {}) },
    { from: C, to: D },
    { from: D, to: A },
    { from: A, to: C, ...(labelOf('hyp') ? { label: labelOf('hyp')! } : {}) },
  ]
  const aria = `Rectangle ${A}${B}${C}${D} with diagonal ${A}${C}, a right-angle mark at ${B}, and the 30° angle between ${A}${B} and ${A}${C} marked at ${A}. ${labelWords([
    [names.long, labelOf('long')],
    [names.short, labelOf('short')],
    [names.hyp, labelOf('hyp')],
  ])}`
  const figure = placeLabels7(
    {
      ariaLabel: aria,
      points: [A, B, C, D].map((id, i) => pointOf(id, pts[i]!, center)),
      segments,
      angles: [
        { vertex: B, from: A, to: C, right: true },
        { vertex: A, from: B, to: C, label: '30°' },
      ],
    },
    [[A, B, C, D]],
  )
  const stages = stagesFor('30', from, given, asked, `Triangle ${A}${B}${C} has its right angle at ${B} and an angle of 30° at ${A}, so its sides follow the 30°-60°-90° Triangle Theorem. The side across from the 30° angle is the shorter leg.`, UNIT7_RULE_IDS.specialFigures, () => [], [given])
  const prompt = `In rectangle ${A}${B}${C}${D}, diagonal ${A}${C} makes an angle of 30° with side ${A}${B}, and ${names[from]} = ${qSay(given)}. ${findText(asked)}`
  return finishSpecial('rectangle30', prompt, figure, stages, [given], rng, { from, given: qSay(given), asked: askedRoles.join(',') })
}

function rhombus60(rng: Rng): GeoBuilt | null {
  const [A, B, C, D, E] = pickLetters6(rng, 5) as [string, string, string, string, string]
  // m∠DAB = 60: BD (the shorter diagonal) is as long as a side; AC (the longer one) is a side times √3. In right
  // triangle ABE, AB is the hypotenuse, BE (half of BD) the shorter leg and AE (half of AC) the longer leg.
  const form = rng.pick(['sideToLong', 'longToSide', 'shortToLong'] as const)
  const given = givenValue(rng, form === 'longToSide' && rng.chance(0.5) ? 3 : null)
  let sideLen: GeoQty
  let answer: GeoQty
  const traps: TrapDraft7[] = []
  const ac = `${A}${C}`
  const bd = `${B}${D}`
  const ab = `${A}${B}`
  let prompt: string
  let reveal: string
  let partName: string
  const half = (q: GeoQty) => rad(q.n, q.d * 2, q.rad)
  if (form === 'sideToLong' || form === 'shortToLong') {
    sideLen = given
    answer = side('30', 'short', given, 'long')
    partName = ac
    traps.push({ id: 'geo_half_for_whole', stage: 'result', value: half(answer), witness: `That is ${A}${E}, half of ${ac}. The diagonals of a rhombus bisect each other, so ${ac} is twice ${A}${E}.` })
    for (const t of coreTraps('30', 'hyp', given, 'long', 'result')) traps.push({ ...t, value: rad(2 * (t.value as GeoQty).n, (t.value as GeoQty).d, (t.value as GeoQty).rad), witness: `${t.witness} Then ${ac} is twice ${A}${E}.` })
    prompt =
      form === 'sideToLong'
        ? `Rhombus ${A}${B}${C}${D} has sides of length ${qSay(given)} and m∠${D}${A}${B} = 60. Its diagonals meet at ${E}. Find the length of the longer diagonal, ${ac}.`
        : `In rhombus ${A}${B}${C}${D}, m∠${D}${A}${B} = 60 and the shorter diagonal ${bd} = ${qSay(given)}. The diagonals meet at ${E}. Find the length of the longer diagonal, ${ac}.`
    reveal =
      form === 'sideToLong'
        ? `In right triangle ${A}${B}${E}, m∠${B}${A}${E} = 30, so ${A}${E} = ${qSay(given)}/2 · √3 = ${qSay(half(answer))}. The diagonals bisect each other, so ${ac} = 2 · ${A}${E} = ${qSay(answer)}.`
        : `Triangle ${A}${B}${D} is equilateral, so ${ab} = ${bd} = ${qSay(given)}. In right triangle ${A}${B}${E}, ${A}${E} = ${qSay(given)}/2 · √3 = ${qSay(half(answer))}, so ${ac} = 2 · ${A}${E} = ${qSay(answer)}.`
  } else {
    // The side from the longer diagonal.
    const ae = half(given)
    sideLen = side('30', 'long', ae, 'hyp')
    answer = sideLen
    partName = 'x'
    traps.push({
      id: 'geo_half_not_taken',
      stage: 'result',
      value: side('30', 'long', given, 'hyp'),
      witness: `That uses all of ${ac} as the longer leg. The diagonals bisect each other, so the longer leg of right triangle ${A}${B}${E} is ${A}${E}, half of ${ac}.`,
    })
    traps.push(...coreTraps('30', 'long', ae, 'hyp', 'result'))
    prompt = `In rhombus ${A}${B}${C}${D}, m∠${D}${A}${B} = 60 and the longer diagonal ${ac} = ${qSay(given)}. The diagonals meet at ${E}. Find x, the length of ${ab}.`
    reveal = `The diagonals bisect each other, so ${A}${E} = ${qSay(ae)}. In right triangle ${A}${B}${E}, m∠${B}${A}${E} = 30 and ${A}${E} is the longer leg, so the shorter leg ${B}${E} = ${ae.d > 1 ? `(${qSay(ae)})` : qSay(ae)}/√3 = ${qSay(side('30', 'long', ae, 'short'))} and ${ab} = 2 · ${B}${E} = ${qSay(answer)}.`
  }
  const s = approxQ(sideLen)
  const pts = placeAll(
    [
      { x: 0, y: 0 },
      { x: s, y: 0 },
      { x: 1.5 * s, y: (s * Math.sqrt(3)) / 2 },
      { x: s / 2, y: (s * Math.sqrt(3)) / 2 },
      { x: 0.75 * s, y: (s * Math.sqrt(3)) / 4 },
    ],
    rng.int(-30, 30),
    rng.chance(0.5),
  ) as [P2, P2, P2, P2, P2]
  const center = pts[4]
  const abLabel = form === 'longToSide' ? 'x' : form === 'sideToLong' ? qSay(given) : undefined
  const segments: GeoSegment[] = [
    { from: A, to: B, ...(abLabel ? { label: abLabel } : {}) },
    { from: B, to: C },
    { from: C, to: D },
    { from: D, to: A },
    { from: A, to: C },
    { from: B, to: D },
  ]
  const aria = `Rhombus ${A}${B}${C}${D} with diagonals ${ac} and ${bd} meeting at ${E}, a right-angle mark at ${E}, and the 60° angle ${D}${A}${B} marked at ${A}.${abLabel ? ` ${ab} is labeled ${abLabel}.` : ''}`
  const points: GeoPoint[] = [A, B, C, D].map((id, i) => pointOf(id, pts[i]!, center))
  points.push(pointOf(E, pts[4], { x: (pts[0].x + pts[3].x) / 2, y: (pts[0].y + pts[3].y) / 2 }))
  const figure = placeLabels7(
    {
      ariaLabel: aria,
      points,
      segments,
      angles: [
        { vertex: E, from: B, to: C, right: true },
        { vertex: A, from: B, to: D, label: '60°' },
      ],
    },
    [[A, B, C, D]],
  )
  const stage = exactStage7({
    id: form === 'longToSide' ? 'x' : 'result',
    label: partName,
    hint: SPECIAL_HINT7,
    answer,
    nudge: 'The diagonals of a rhombus bisect each other at right angles and bisect its angles, so they cut it into four 30°-60°-90° triangles.',
    ruleCard: UNIT7_RULE_IDS.inside,
    reveal: [reveal],
    traps,
    givens: [given],
  })
  return finishSpecial('rhombus60', prompt, figure, [stage], [given], rng, { form, given: qSay(given) })
}

function isoRight(rng: Rng): GeoBuilt | null {
  const [P, Q, R] = pickLetters6(rng, 3) as [string, string, string]
  const given = givenValue(rng, rng.chance(0.4) ? 2 : null)
  const leg = side('45', 'hyp', given, 'leg')
  const L = approxQ(leg)
  const labels = { pr: 'x', qr: 'x', pq: qSay(given) }
  const aria = `Isosceles right triangle ${P}${Q}${R} with the right angle at ${R}. Each leg is labeled x and the hypotenuse ${P}${Q} is labeled ${qSay(given)}.`
  const figure = rightFigure(rng, [P, Q, R], L, L, labels, null, aria)
  const stages = stagesFor('45', 'hyp', given, [{ role: 'leg', name: 'each leg' }], 'An isosceles right triangle is the 45°-45°-90° triangle: its legs are equal, and the hypotenuse is √2 times a leg.', UNIT7_RULE_IDS.special45, () => [], [given])
  const prompt = `The hypotenuse ${P}${Q} of isosceles right triangle ${P}${Q}${R} has length ${qSay(given)}. Find x, the length of each leg.`
  return finishSpecial('isoRight', prompt, figure, stages, [given], rng, { given: qSay(given) })
}

export function drawSpecial(seed: number): GeoBuilt {
  const kind = weighted<SpecialCase>(makeRng(mixSeed(seed, 7600)), [
    ['tri45', 16],
    ['tri30', 24],
    ['square', 12],
    ['equilateral', 12],
    ['rectangle30', 13],
    ['rhombus60', 11],
    ['isoRight', 12],
  ])
  for (let attempt = 0; attempt < 600; attempt++) {
    const rng = makeRng(mixSeed(seed, 7601 + attempt))
    const built =
      kind === 'tri45'
        ? tri45(rng)
        : kind === 'tri30'
          ? tri30(rng)
          : kind === 'square'
            ? square(rng)
            : kind === 'equilateral'
              ? equilateral(rng)
              : kind === 'rectangle30'
                ? rectangle30(rng)
                : kind === 'rhombus60'
                  ? rhombus60(rng)
                  : isoRight(rng)
    if (built) return built
  }
  throw new Error(`sp.special/${seed}: no ${kind} problem`)
}



/** For the hand-worked tests: a problem from chosen numbers, the letters and turn from the first salt that passes the gate. */
export const specialFor = {
  tri30: (fixed: { from: 'short' | 'long' | 'hyp'; given: GeoQty; asked: ('short' | 'long' | 'hyp')[]; at60: boolean }) => firstBuilt((rng) => tri30(rng, fixed)),
  square: (fixed: { fromSide: boolean; given: GeoQty }) => firstBuilt((rng) => square(rng, fixed)),
  equilateral: (fixed: { fromSide: boolean; given: GeoQty }) => firstBuilt((rng) => equilateral(rng, fixed)),
}

function firstBuilt(make: (rng: Rng) => GeoBuilt | null): GeoBuilt {
  for (let attempt = 0; attempt < 400; attempt++) {
    const built = make(makeRng(mixSeed(1, 9100 + attempt)))
    if (built) return built
  }
  throw new Error('no problem for those numbers')
}
