/**
 * Honors geometry Unit 7, module geoTrigRatios (Jurgensen 8-5 and 8-6): the tangent, sine and cosine ratios.
 *
 * tr.ratio writes one ratio of a labeled right triangle in lowest terms, or names which ratio uses two sides.
 * tr.side finds a side from a non-special angle, sometimes multiplying and sometimes dividing. tr.angle finds an
 * acute angle from two sides. Sides, the angle, which ratio, and the turn of the figure all come from the seed.
 * The values and the slips come from the precalculus right-triangle core, unchanged.
 */
import { angleAnswer, angleSlips, fnDegrees, linkOf, rtRatio, rtRatioSlips, sideAnswer, sideSlips, type RtFn, type RtRole } from '@/engine/trig'
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { ErrorPatternId, GeoFigureSpec, GeoSegment } from '@/shared/types'
import type { GeoQty } from './answer'
import type { GeoBuilt } from './build'
import { pickLetters6 } from './unit6Geom'
import {
  approxQ,
  centerOf,
  choiceStage7,
  coreWords,
  exactStage7,
  finish7,
  fromTrig,
  int,
  placeAll,
  placeLabels7,
  pointOf,
  qSay,
  setDebug7,
  sqrtQ,
  toTrig,
  type P2,
  type Places,
  type Stage7,
  type TrapDraft7,
} from './unit7Build'
import { decimalStage, signedRounded, type DecimalSlip } from './unit7bBuild'
import { TRIG_RATIO_RULES, UNIT7B_RULE_IDS } from './unit7bRules'
import { TRIPLES } from './unit7Pyth'

const RATIO_HINT = 'A fraction in lowest terms, like 43/97, or a simplest radical, like (3√11)/2.'
const RATIO_NUDGE = 'Opposite is the side across from the angle, adjacent is the leg that touches it, and the hypotenuse is across from the right angle. The tangent ratio is opposite over adjacent, the sine ratio is opposite over hypotenuse, and the cosine ratio is adjacent over hypotenuse.'
const WHICH_NUDGE = 'Opposite is the side across from the angle, adjacent is the leg that touches it, and the hypotenuse is across from the right angle. Pick the ratio that uses the two sides you were given.'
const SIDE_NUDGE = 'Put the calculator in DEGREE mode. From the angle you know, name the side you know and the side you want: opposite, adjacent, or hypotenuse. Multiply when the unknown is on top of the ratio, and divide when it is on the bottom.'
const ANGLE_NUDGE = 'Put the calculator in DEGREE mode. The angle is the inverse of the ratio of the two sides: opposite over hypotenuse, adjacent over hypotenuse, or opposite over adjacent. On the TI-84 that is 2nd SIN, 2nd COS, or 2nd TAN.'

const WORD: Record<RtFn, string> = { sin: 'sine', cos: 'cosine', tan: 'tangent' }
const SPECIAL = [30, 45, 60]

export interface RatioFixed {
  opp: GeoQty
  adj: GeoQty
  hyp: GeoQty
  fn: RtFn
  mode: 'fraction' | 'which'
}

export interface SideFixed {
  deg: number
  known: RtRole
  asked: RtRole
  /** The known side, a whole number. */
  value: number
  places: Places
}

export interface AngleFixed {
  opp: number
  adj: number
  hyp: number
  /** Which two sides she is given. The third is not labeled. */
  known: readonly [RtRole, RtRole]
  places: Places
}

const num = (q: GeoQty) => approxQ(q)

function randomSides(rng: Rng): { opp: GeoQty; adj: GeoQty; hyp: GeoQty } | null {
  if (rng.next() < 0.6) {
    const t = rng.pick(TRIPLES)
    const k = rng.int(1, 4)
    const a = t[0] * k
    const b = t[1] * k
    const c = t[2] * k
    return rng.chance(0.5) ? { opp: int(a), adj: int(b), hyp: int(c) } : { opp: int(b), adj: int(a), hyp: int(c) }
  }
  if (rng.chance(0.65)) {
    const a = rng.int(2, 12)
    const b = rng.int(2, 16)
    const hyp = sqrtQ(a * a + b * b)
    if (hyp.rad === 1) return null
    return rng.chance(0.5) ? { opp: int(a), adj: int(b), hyp } : { opp: int(b), adj: int(a), hyp }
  }
  const c = rng.int(6, 30)
  const a = rng.int(2, c - 2)
  const b = sqrtQ(c * c - a * a)
  if (b.rad === 1 || b.n <= 0) return null
  return { opp: int(a), adj: b, hyp: int(c) }
}

interface Letters {
  A: string
  B: string
  C: string
  opp: string
  adj: string
  hyp: string
}

function names(rng: Rng): Letters {
  const [A, B, C] = pickLetters6(rng, 3) as [string, string, string]
  return { A, B, C, opp: `${B}${C}`, adj: `${A}${C}`, hyp: `${A}${B}` }
}

/** A right triangle, right angle at C, acute angle at A. Turned, and sometimes mirrored, unless `upright`. */
function triangleFigure(rng: Rng, sides: { opp: GeoQty; adj: GeoQty; hyp: GeoQty }, label: { opp: string; adj: string; hyp: string }, angleLabel: string | undefined, upright: boolean): { figure: GeoFigureSpec; L: Letters } | null {
  const L = names(rng)
  const raw: P2[] = [
    { x: num(sides.adj), y: 0 },
    { x: 0, y: num(sides.opp) },
    { x: 0, y: 0 },
  ]
  const [pA, pB, pC] = placeAll(raw, upright ? 0 : rng.int(0, 359), rng.chance(0.5)) as [P2, P2, P2]
  const ang = (v: P2, p: P2, q: P2) => {
    const ux = p.x - v.x
    const uy = p.y - v.y
    const wx = q.x - v.x
    const wy = q.y - v.y
    return (Math.acos(Math.max(-1, Math.min(1, (ux * wx + uy * wy) / (Math.hypot(ux, uy) * Math.hypot(wx, wy))))) * 180) / Math.PI
  }
  if (!upright && Math.min(ang(pA, pC, pB), ang(pB, pA, pC), ang(pC, pA, pB)) < 15) return null
  const center = centerOf([pA, pB, pC])
  const segments: GeoSegment[] = [
    { from: L.A, to: L.C, label: label.adj },
    { from: L.B, to: L.C, label: label.opp },
    { from: L.A, to: L.B, label: label.hyp },
  ]
  const told = segments.filter((s) => s.label).map((s) => `${s.from}${s.to} is labeled ${s.label!.trim()}`)
  const aria = `Right triangle ${L.A}${L.B}${L.C} with the right angle at ${L.C}. ${told.join(', ').replace(/, ([^,]*)$/, ', and $1')}.`
  const figure = placeLabels7(
    {
      ariaLabel: aria,
      points: [pointOf(L.A, pA, center), pointOf(L.B, pB, center), pointOf(L.C, pC, center)],
      segments,
      angles: [
        { vertex: L.C, from: L.A, to: L.B, right: true },
        ...(angleLabel ? [{ vertex: L.A, from: L.C, to: L.B, label: angleLabel }] : []),
      ],
    },
    [[L.A, L.C, L.B]],
  )
  return figure ? { figure, L } : null
}

function ratioSlips(fn: RtFn, sides: { opp: GeoQty; adj: GeoQty; hyp: GeoQty }): TrapDraft7[] {
  const rt = { opp: toTrig(sides.opp), adj: toTrig(sides.adj), hyp: toTrig(sides.hyp) }
  return rtRatioSlips(fn, rt).flatMap((s) => (s.value === 'undefined' ? [] : [{ id: s.id as ErrorPatternId, stage: 'x' as const, value: fromTrig(s.value), witness: coreWords(s.witness) }]))
}

function whichWitness(answer: RtFn, picked: RtFn): { id: ErrorPatternId; witness: string } {
  if (answer === 'tan' || picked === 'tan') {
    return {
      id: 'trig_hypotenuse_as_leg',
      witness: 'That pairs a leg with the hypotenuse, or the two legs, and this angle does not. The hypotenuse is the side across from the right angle.',
    }
  }
  return {
    id: 'trig_sin_cos_swapped',
    witness: 'That is the ratio as seen from the other acute angle. The side across from this angle and the leg that touches it are not the same side.',
  }
}

const PAIR: Record<RtFn, (A: string) => string> = {
  sin: (A) => `the side across from angle ${A} and the hypotenuse`,
  cos: (A) => `the leg that touches angle ${A} and the hypotenuse`,
  tan: (A) => `the side across from angle ${A} and the leg that touches angle ${A}`,
}

function makeRatio(rng: Rng, fixed: RatioFixed | null): GeoBuilt | null {
  const sides = fixed ?? randomSides(rng)
  if (!sides) return null
  if ([sides.opp, sides.adj, sides.hyp].some((q) => !(num(q) > 0))) return null
  const fn = fixed?.fn ?? rng.pick(['sin', 'cos', 'tan'] as const)
  const mode = fixed?.mode ?? (rng.chance(0.2) ? 'which' : 'fraction')
  const drawn = triangleFigure(rng, sides, { opp: qSay(sides.opp), adj: qSay(sides.adj), hyp: qSay(sides.hyp) }, undefined, false)
  if (!drawn) return null
  const { figure, L } = drawn
  const listed = `${L.opp} = ${qSay(sides.opp)}, ${L.adj} = ${qSay(sides.adj)}, and ${L.hyp} = ${qSay(sides.hyp)}`
  const rt = { opp: toTrig(sides.opp), adj: toTrig(sides.adj), hyp: toTrig(sides.hyp) }
  let stage: Stage7
  let prompt: string
  if (mode === 'which') {
    const choices = (['sin', 'cos', 'tan'] as const).map((id) => {
      if (id === fn) return { id, text: `${WORD[id]} ratio` }
      const w = whichWitness(fn, id)
      return { id, text: `${WORD[id]} ratio`, trap: w.id, witness: w.witness }
    })
    stage = choiceStage7({
      id: 'x',
      label: 'ratio',
      choices,
      answerId: fn,
      nudge: WHICH_NUDGE,
      ruleCard: UNIT7B_RULE_IDS.ratios,
      reveal: [`The two sides named are ${PAIR[fn](L.A)}, so the ratio is the ${WORD[fn]} ratio.`],
      seed: rng.int(1, 1_000_000),
      salt: rng.int(1, 1_000_000),
    })
    prompt = `In right triangle ${L.A}${L.B}${L.C}, the right angle is at ${L.C}. ${listed}. Which ratio of angle ${L.A} uses ${PAIR[fn](L.A)}?`
  } else {
    const answer = fromTrig(rtRatio(fn, rt))
    const bare = exactStage7({
      id: 'x',
      label: 'ratio',
      hint: RATIO_HINT,
      answer,
      nudge: RATIO_NUDGE,
      ruleCard: UNIT7B_RULE_IDS.ratios,
      reveal: [`The ${WORD[fn]} ratio of angle ${L.A} is ${qSay(answer)}.`],
      traps: ratioSlips(fn, sides),
      givens: [sides.opp, sides.adj, sides.hyp],
    })
    stage = { ...bare, lowest: true }
    prompt = `In right triangle ${L.A}${L.B}${L.C}, the right angle is at ${L.C}. ${listed}. Write the ${WORD[fn]} ratio of angle ${L.A} as a fraction in lowest terms.`
  }
  if (stage.traps.length === 0) return null
  return finish7({
    question: 'trigRatio',
    prompt,
    figure,
    stages: [stage],
    lengths: [sides.opp, sides.adj, sides.hyp].map(num).filter((n) => Number.isInteger(n)),
    title: 'Writing a ratio',
    instructions: 'Give an exact ratio in lowest terms, or name which ratio it is. The figure is there before you answer.',
    params: { fn, mode },
    cards: TRIG_RATIO_RULES,
    promise: ['trig_opposite_adjacent_swapped', 'trig_sin_cos_swapped', 'trig_hypotenuse_as_leg'],
  })
}

function roleSide(L: Letters, role: RtRole): string {
  return role === 'opp' ? L.opp : role === 'adj' ? L.adj : L.hyp
}

function makeSide(rng: Rng, fixed: SideFixed | null): GeoBuilt | null {
  const deg = fixed?.deg ?? rng.intExcept(16, 74, SPECIAL)
  const roles: RtRole[] = ['opp', 'adj', 'hyp']
  const known = fixed?.known ?? rng.pick(roles)
  const asked = fixed?.asked ?? rng.pick(roles.filter((r) => r !== known))
  const value = fixed?.value ?? rng.int(5, 40)
  const places = fixed?.places ?? (rng.chance(0.5) ? 1 : 2)
  if (known === asked || !(value > 1) || (places !== 1 && places !== 2)) return null
  if (SPECIAL.includes(deg) && !fixed) return null
  const problem = {
    deg,
    known: { role: known, value },
    asked,
    names: { opp: 'the opposite side', adj: 'the adjacent side', hyp: 'the hypotenuse' },
  }
  const length = sideAnswer(problem)
  const slips: DecimalSlip[] = sideSlips(problem).map((s) => ({ id: s.id, value: s.value, witness: coreWords(s.witness) }))
  const label = { opp: '', adj: '', hyp: '' }
  label[known] = String(value)
  label[asked] = 'x'
  const trueOpp = lengthFor(deg, known, value, 'opp')
  const trueAdj = lengthFor(deg, known, value, 'adj')
  const trueHyp = lengthFor(deg, known, value, 'hyp')
  if (![trueOpp, trueAdj, trueHyp].every((n) => n > 0 && Number.isFinite(n))) return null
  const drawn = triangleFigure(rng, { opp: fake(trueOpp), adj: fake(trueAdj), hyp: fake(trueHyp) }, label, `${deg}°`, false)
  if (!drawn) return null
  const { L } = drawn
  const place = places === 2 ? 'hundredth' : 'tenth'
  const Lnk = linkOf(known, asked)
  const top = asked === Lnk.top
  const knownName = roleSide(L, known)
  const askedName = roleSide(L, asked)
  const stage = decimalStage({
    label: 'x',
    places,
    value: length,
    nudge: SIDE_NUDGE,
    ruleCard: UNIT7B_RULE_IDS.side,
    reveal: [`${askedName} is ${knownName} ${top ? 'times' : 'divided by'} the ${WORD[Lnk.fn]} of ${deg}°, which comes to ${signedRounded(length, places)}.`],
    slips,
    givens: [deg, value],
  })
  if (!stage) return null
  const prompt = `In right triangle ${L.A}${L.B}${L.C}, the right angle is at ${L.C} and the measure of angle ${L.A} is ${deg}°. ${knownName} = ${value}. Find ${askedName} to the nearest ${place}.`
  return finish7({
    question: 'trigSide',
    prompt,
    figure: drawn.figure,
    stages: [stage],
    lengths: [value],
    title: 'Finding a side',
    instructions: 'Round only at the end, as the problem asks. Put the calculator in DEGREE mode. The figure is there before you answer.',
    params: { deg, known, asked, places, fn: Lnk.fn },
    cards: TRIG_RATIO_RULES,
    promise: ['trig_hypotenuse_as_leg', 'trig_radian_mode', 'trig_opposite_adjacent_swapped'],
  })
}

/** The third side, from the angle and the known one. Used only to draw the triangle in proportion. */
function lengthFor(deg: number, known: RtRole, value: number, want: RtRole): number {
  if (want === known) return value
  return sideAnswer({ deg, known: { role: known, value }, asked: want, names: { opp: 'o', adj: 'a', hyp: 'h' } })
}

/** A coordinate length. The quantity is never shown; the label is whatever the caller set. */
function fake(n: number): GeoQty {
  return { n: Math.max(1, Math.round(n * 1e6)), d: 1e6, rad: 1 }
}

function makeAngle(rng: Rng, fixed: AngleFixed | null): GeoBuilt | null {
  let opp: number
  let adj: number
  let hyp: number
  let known: [RtRole, RtRole]
  let places: Places
  if (fixed) {
    opp = fixed.opp
    adj = fixed.adj
    hyp = fixed.hyp
    known = [fixed.known[0], fixed.known[1]]
    places = fixed.places
  } else {
    const t = rng.pick(TRIPLES)
    const k = rng.int(1, 3)
    const swap = rng.chance(0.5)
    opp = (swap ? t[1] : t[0]) * k
    adj = (swap ? t[0] : t[1]) * k
    hyp = t[2] * k
    const pair = rng.pick([
      ['opp', 'hyp'],
      ['adj', 'hyp'],
      ['opp', 'adj'],
    ] as const)
    known = [pair[0], pair[1]]
    places = rng.chance(0.25) ? 1 : 0
  }
  if (opp <= 0 || adj <= 0 || hyp <= 0) return null
  if (Math.abs(opp * opp + adj * adj - hyp * hyp) > 1e-4) return null
  const a = known.includes('opp') ? { role: 'opp' as const, value: opp } : { role: 'adj' as const, value: adj }
  const bRole: RtRole = known.find((r) => r !== a.role)!
  const b = { role: bRole, value: bRole === 'opp' ? opp : bRole === 'adj' ? adj : hyp }
  const problem = { a, b, names: { opp: 'the opposite side', adj: 'the adjacent side', hyp: 'the hypotenuse' } }
  const deg = angleAnswer(problem)
  if (!fixed && SPECIAL.some((s) => Math.abs(deg - s) < 0.05)) return null
  if (!(deg > 1 && deg < 89)) return null
  const slips: DecimalSlip[] = angleSlips(problem).map((s) => ({ id: s.id, value: s.value, witness: coreWords(s.witness) }))
  const label = { opp: known.includes('opp') ? String(opp) : '', adj: known.includes('adj') ? String(adj) : '', hyp: known.includes('hyp') ? String(hyp) : '' }
  const drawn = triangleFigure(rng, { opp: fake(opp), adj: fake(adj), hyp: fake(hyp) }, label, '?', false)
  if (!drawn) return null
  const { figure, L } = drawn
  const stage = decimalStage({
    label: 'measure',
    places,
    value: deg,
    unit: 'deg',
    nudge: ANGLE_NUDGE,
    ruleCard: UNIT7B_RULE_IDS.angle,
    reveal: [],
    slips,
    givens: known.map((r) => (r === 'opp' ? opp : r === 'adj' ? adj : hyp)),
  })
  if (!stage) return null
  const place = places === 0 ? 'degree' : 'tenth of a degree'
  const Lnk = linkOf(a.role, b.role)
  stage.reveal = [`The ${WORD[Lnk.fn]} of angle ${L.A} uses ${roleSide(L, Lnk.top)} over ${roleSide(L, Lnk.bottom)}, so the angle is ${stage.answerText}°.`]
  const givenText = known.map((r) => `${roleSide(L, r)} = ${r === 'opp' ? opp : r === 'adj' ? adj : hyp}`).join(' and ')
  const prompt = `In right triangle ${L.A}${L.B}${L.C}, the right angle is at ${L.C}. ${givenText}. Find the measure of angle ${L.A} to the nearest ${place}.`
  return finish7({
    question: 'trigAngle',
    prompt,
    figure,
    stages: [stage],
    lengths: [opp, adj, hyp],
    title: 'Finding an angle',
    instructions: 'Round only at the end, as the problem asks. Put the calculator in DEGREE mode. The figure is there before you answer.',
    params: { fn: Lnk.fn, places, opp, adj, hyp },
    cards: TRIG_RATIO_RULES,
    promise: ['trig_ratio_for_angle', 'trig_radian_mode', 'trig_opposite_adjacent_swapped', 'trig_hypotenuse_as_leg'],
  })
}

function draw(seed: number, salt: number, make: (rng: Rng) => GeoBuilt | null, what: string): GeoBuilt {
  for (let attempt = 0; attempt < 240; attempt++) {
    const built = make(makeRng(mixSeed(seed, salt + attempt)))
    if (built) return built
  }
  throw new Error(`${what}: no problem for seed ${seed}`)
}

function example(salt: number, make: (rng: Rng) => GeoBuilt | null, what: string): GeoBuilt {
  let why = 'make returned null'
  setDebug7((reason) => {
    why = reason
  })
  try {
    for (let attempt = 0; attempt < 240; attempt++) {
      const built = make(makeRng(mixSeed(1, salt + attempt)))
      if (built) return built
    }
  } finally {
    setDebug7(null)
  }
  throw new Error(`${what}: the example did not pass the gate (${why})`)
}

export function drawTrigRatio(seed: number): GeoBuilt {
  return draw(seed, 7701, (rng) => makeRatio(rng, null), 'tr.ratio')
}
export function drawTrigSide(seed: number): GeoBuilt {
  return draw(seed, 7801, (rng) => makeSide(rng, null), 'tr.side')
}
export function drawTrigAngle(seed: number): GeoBuilt {
  return draw(seed, 7901, (rng) => makeAngle(rng, null), 'tr.angle')
}

export function ratioProblem(fixed: RatioFixed): GeoBuilt['answer'] {
  return example(8801, (rng) => makeRatio(rng, fixed), 'tr.ratio').answer
}
export function sideProblem(fixed: SideFixed): GeoBuilt['answer'] {
  return example(8901, (rng) => makeSide(rng, fixed), 'tr.side').answer
}
export function angleProblem(fixed: AngleFixed): GeoBuilt['answer'] {
  return example(9001, (rng) => makeAngle(rng, fixed), 'tr.angle').answer
}

/** tan 35°, for the hand check. The core's DEGREE-mode tangent. */
export function tanDegrees(deg: number): number {
  return fnDegrees('tan', deg)
}
