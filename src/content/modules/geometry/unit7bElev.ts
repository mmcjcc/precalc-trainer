/**
 * Honors geometry Unit 7, module geoElevDepress (Jurgensen 8-7): angles of elevation and depression.
 *
 * el.story is one right triangle in a story. el.two is the two-observation problem, or two observers on opposite
 * sides. Elevation figures stay upright (a mirror only): a depression angle is the wedge between the dashed
 * horizontal and the line of sight, not the angle inside the triangle at the observer. Degrees everywhere.
 * Slips for one triangle come from the precalculus core.
 */
import { angleAnswer, angleSlips, sideAnswer, sideSlips, type DepressionWords, type RtFn, type RtRole } from '@/engine/trig'
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { ErrorPatternId, GeoFigureSpec, GeoPoint, GeoSegment } from '@/shared/types'
import type { GeoBuilt } from './build'
import { coreWords, finish7, placeAll, placeLabels7, setDebug7, type P2, type Places } from './unit7Build'
import { decimalStage, type DecimalSlip } from './unit7bBuild'
import { ELEVATION_RULES, UNIT7B_RULE_IDS } from './unit7bRules'

const SIDE_NUDGE = 'An angle of elevation and an angle of depression are both measured from the horizontal, and they are equal alternate interior angles. Put the calculator in DEGREE mode. Multiply when the unknown side is on top of the ratio, and divide when it is on the bottom.'
const ANGLE_NUDGE = 'An angle of elevation and an angle of depression are both measured from the horizontal. Put the calculator in DEGREE mode. The angle is the inverse of the ratio of the two sides, 2nd SIN, 2nd COS, or 2nd TAN.'
const TWO_NUDGE = 'On the same side of the tower, the farther distance is the closer one plus the space between the points, so the tangents are subtracted. On opposite sides, the two distances add, so the tangents are added. Put the calculator in DEGREE mode.'

const RAD = Math.PI / 180
const tanD = (d: number) => Math.tan(d * RAD)
const sinD = (d: number) => Math.sin(d * RAD)
const cosD = (d: number) => Math.cos(d * RAD)

export type StoryKind = 'tree' | 'building' | 'cliff' | 'lighthouse' | 'window' | 'ladder' | 'kite' | 'ramp' | 'guy' | 'plane'
type Asked = 'opp' | 'adj' | 'hyp' | 'angle'

export interface StoryFixed {
  kind: StoryKind
  asked: Asked
  deg: number
  opp: number
  adj: number
  hyp: number
  /** Sides written on the figure and in the prompt. Each is a whole number of meters. */
  show: readonly RtRole[]
  places: Places
}

export interface TwoFixed {
  /** closer: the second point is nearer the tower. farther: the second point is farther. opposite: one observer on each side. */
  layout: 'closer' | 'farther' | 'opposite'
  asked: 'height' | 'near' | 'far'
  /** The larger angle, at the closer point (or on one side). */
  nearDeg: number
  /** The smaller angle, at the farther point (or on the other side). */
  farDeg: number
  /** Meters between the two points. */
  gap: number
  places: Places
}

const ELEV: readonly StoryKind[] = ['tree', 'building', 'ladder', 'kite', 'ramp', 'guy', 'plane']
const DEPR: readonly StoryKind[] = ['cliff', 'lighthouse', 'window']

const depressionOf = (kind: StoryKind): DepressionWords | undefined => {
  if (kind === 'cliff') return { high: 'the top of the cliff', low: 'the boat' }
  if (kind === 'lighthouse') return { high: 'the top of the lighthouse', low: 'the boat' }
  if (kind === 'window') return { high: 'the window', low: 'the car' }
  return undefined
}

/** Lengths a story may use, in meters. A tree is not 900 m tall and a cliff is not 2 m. */
const BAND: Record<StoryKind, { opp: [number, number]; adj: [number, number]; hyp: [number, number]; deg: [number, number] }> = {
  tree: { opp: [4, 40], adj: [6, 80], hyp: [8, 90], deg: [8, 75] },
  building: { opp: [8, 80], adj: [8, 100], hyp: [12, 130], deg: [8, 75] },
  cliff: { opp: [15, 100], adj: [15, 400], hyp: [20, 420], deg: [8, 70] },
  lighthouse: { opp: [15, 80], adj: [20, 400], hyp: [25, 420], deg: [8, 70] },
  window: { opp: [10, 60], adj: [12, 150], hyp: [16, 170], deg: [8, 70] },
  ladder: { opp: [3, 16], adj: [2, 12], hyp: [4, 16], deg: [20, 75] },
  kite: { opp: [6, 60], adj: [8, 80], hyp: [15, 90], deg: [12, 70] },
  ramp: { opp: [2, 8], adj: [6, 30], hyp: [6, 32], deg: [8, 25] },
  guy: { opp: [6, 25], adj: [4, 30], hyp: [8, 40], deg: [20, 70] },
  plane: { opp: [400, 1200], adj: [200, 2500], hyp: [500, 3000], deg: [10, 60] },
}

const inBand = (kind: StoryKind, opp: number, adj: number, hyp: number, deg: number) => {
  const b = BAND[kind]
  const ok = (n: number, [lo, hi]: [number, number]) => n >= lo && n <= hi
  return ok(opp, b.opp) && ok(adj, b.adj) && ok(hyp, b.hyp) && ok(deg, b.deg)
}

const r6 = (n: number) => Math.round(n * 1e6) / 1e6
const bare = (id: string, p: P2): GeoPoint => ({ id, x: r6(p.x), y: r6(p.y), label: '' })
const seg = (from: string, to: string, label: string, dashed = false): GeoSegment => ({
  from,
  to,
  ...(label ? { label } : {}),
  ...(dashed ? { dashed: true } : {}),
})

const roundLen = (places: Places) => (places === 0 ? 'to the nearest meter' : places === 1 ? 'to the nearest tenth of a meter' : 'to the nearest hundredth of a meter')
const roundAng = (places: Places) => (places === 0 ? 'to the nearest degree' : 'to the nearest tenth of a degree')
const meters = (n: number) => `${n} meters`

function sideLabel(scene: StoryFixed, role: RtRole): string {
  if (scene.asked === role) return 'x'
  if (!scene.show.includes(role)) return ''
  const n = role === 'opp' ? scene.opp : role === 'adj' ? scene.adj : scene.hyp
  return String(n)
}

function storyPrompt(s: StoryFixed): string | null {
  const end = s.asked === 'angle' ? roundAng(s.places) : roundLen(s.places)
  const h = s.show.includes('opp') ? meters(s.opp) : ''
  const d = s.show.includes('adj') ? meters(s.adj) : ''
  const w = s.show.includes('hyp') ? meters(s.hyp) : ''
  const deg = s.deg
  const thing = s.kind === 'building' ? 'building' : 'tree'
  if (s.kind === 'tree' || s.kind === 'building') {
    if (s.asked === 'opp') return `From a point ${d} from the base of a ${thing}, the angle of elevation to the top is ${deg}°. How tall is the ${thing}, ${end}?`
    if (s.asked === 'adj') return `The angle of elevation to the top of a ${thing} ${h} tall is ${deg}°. How far is the observer from the base, ${end}?`
    if (s.asked === 'angle') return `A ${thing} is ${h} tall. From a point ${d} from its base, find the angle of elevation to the top, ${end}.`
    return null
  }
  const high = s.kind === 'lighthouse' ? 'lighthouse' : s.kind === 'window' ? 'building' : 'cliff'
  const low = s.kind === 'window' ? 'car' : 'boat'
  if (s.kind === 'cliff' || s.kind === 'lighthouse' || s.kind === 'window') {
    if (s.asked === 'adj') return `From the top of a ${high} ${h} high, the angle of depression to a ${low} is ${deg}°. How far is the ${low} from the base, ${end}?`
    if (s.asked === 'opp') return `From the top of a ${high}, the angle of depression to a ${low} ${d} from the base is ${deg}°. How high is the ${high}, ${end}?`
    if (s.asked === 'hyp') return `From the top of a ${high} ${h} high, the angle of depression to a ${low} is ${deg}°. How far is the ${low} along the line of sight, ${end}?`
    if (s.asked === 'angle') return `A ${high} is ${h} high, and a ${low} is ${d} from its base. Find the angle of depression from the top to the ${low}, ${end}.`
  }
  if (s.kind === 'ladder') {
    if (s.asked === 'opp') return `A ladder ${w} long leans against a wall. The angle of elevation from the ground to the ladder is ${deg}°. How high up the wall does the ladder reach, ${end}?`
    if (s.asked === 'hyp') return `A ladder leans against a wall and reaches ${h} up the wall. The angle of elevation from the ground to the ladder is ${deg}°. How long is the ladder, ${end}?`
    if (s.asked === 'adj') return `A ladder ${w} long leans against a wall. The angle of elevation from the ground to the ladder is ${deg}°. How far is the foot of the ladder from the wall, ${end}?`
    return `A ladder ${w} long leans against a wall and reaches ${h} up the wall. Find the angle of elevation from the ground to the ladder, ${end}.`
  }
  if (s.kind === 'kite') {
    if (s.asked === 'opp') return `A kite string is ${w} long. The angle of elevation of the string is ${deg}°. How high is the kite, ${end}?`
    if (s.asked === 'hyp') return `A kite is ${h} above the ground. The angle of elevation of the string is ${deg}°. How long is the string, ${end}?`
    if (s.asked === 'adj') return `A kite string is ${w} long. The angle of elevation of the string is ${deg}°. How far is the holder from the point on the ground below the kite, ${end}?`
    return `A kite string is ${w} long, and the kite is ${h} above the ground. Find the angle of elevation of the string, ${end}.`
  }
  if (s.kind === 'ramp') {
    if (s.asked === 'opp') return `A ramp ${w} long rises at an angle of elevation of ${deg}°. How high does the ramp rise, ${end}?`
    if (s.asked === 'hyp') return `A ramp rises ${h} at an angle of elevation of ${deg}°. How long is the ramp, ${end}?`
    if (s.asked === 'angle') return `A ramp is ${w} long and rises ${h}. Find the angle of elevation of the ramp, ${end}.`
    return null
  }
  if (s.kind === 'guy') {
    if (s.asked === 'opp') return `A guy wire ${w} long runs from the top of a pole to the ground. The angle of elevation of the wire is ${deg}°. How tall is the pole, ${end}?`
    if (s.asked === 'hyp') return `A pole is ${h} tall. A guy wire runs from its top to the ground at an angle of elevation of ${deg}°. How long is the guy wire, ${end}?`
    if (s.asked === 'angle') return `A pole is ${h} tall, and a guy wire from its top to the ground is ${w} long. Find the angle of elevation of the wire, ${end}.`
    return null
  }
  if (s.asked === 'hyp') return `A plane flies at an altitude of ${h}. The angle of elevation from an observer on the ground to the plane is ${deg}°. How far is the plane from the observer along the line of sight, ${end}?`
  if (s.asked === 'opp') return `The angle of elevation from an observer to a plane is ${deg}°, and the plane is ${d} from the observer along the ground. How high is the plane, ${end}?`
  if (s.asked === 'angle') return `A plane flies at an altitude of ${h} and is ${d} from an observer along the ground. Find the angle of elevation to the plane, ${end}.`
  return null
}

function storyAria(s: StoryFixed): string {
  if (depressionOf(s.kind)) return 'An angle of depression from a high point down to an object. The dashed line is the horizontal, and the right angle is at the base.'
  return 'An angle of elevation from a point on the ground to a high point. The right angle is at the base.'
}

function storyFigure(rng: Rng, s: StoryFixed): GeoFigureSpec | null {
  const mirror = rng.chance(0.5)
  const x = (v: number) => r6(mirror ? -v : v)
  const oppL = sideLabel(s, 'opp')
  const adjL = sideLabel(s, 'adj')
  const hypL = sideLabel(s, 'hyp')
  const ang = s.asked === 'angle' ? '?' : `${s.deg}°`
  let points: GeoPoint[]
  let segments: GeoSegment[]
  let angles: GeoFigureSpec['angles']
  let outline: string[]
  let parts: number[]
  if (depressionOf(s.kind)) {
    points = [bare('F', { x: 0, y: 0 }), bare('O', { x: 0, y: s.opp }), bare('B', { x: x(s.adj), y: 0 }), bare('H', { x: x(s.adj), y: s.opp })]
    segments = [seg('F', 'O', oppL), seg('F', 'B', adjL), seg('O', 'B', hypL), seg('O', 'H', '', true)]
    angles = [
      { vertex: 'F', from: 'O', to: 'B', right: true },
      { vertex: 'O', from: 'H', to: 'B', label: ang },
    ]
    outline = ['O', 'F', 'B']
    parts = []
  } else {
    points = [bare('F', { x: 0, y: 0 }), bare('T', { x: 0, y: s.opp }), bare('P', { x: x(s.adj), y: 0 })]
    segments = [seg('F', 'T', oppL), seg('F', 'P', adjL), seg('P', 'T', hypL)]
    angles = [
      { vertex: 'F', from: 'T', to: 'P', right: true },
      { vertex: 'P', from: 'F', to: 'T', label: ang },
    ]
    outline = ['T', 'F', 'P']
    parts = []
  }
  return placeLabels7({ ariaLabel: storyAria(s), points, segments, angles }, [outline], new Set(parts))
}

const NAMES = { opp: 'the height', adj: 'the distance along the ground', hyp: 'the line of sight' }

function storySlips(s: StoryFixed): DecimalSlip[] {
  const depression = depressionOf(s.kind)
  if (s.asked === 'angle') {
    const roles = s.show
    if (roles.length < 2) return []
    const a = { role: roles[0]!, value: s[roles[0]!] }
    const b = { role: roles[1]!, value: s[roles[1]!] }
    return angleSlips({ a, b, names: NAMES, ...(depression ? { depression } : {}) }).map((slip) => ({ id: slip.id, value: slip.value, witness: coreWords(slip.witness) }))
  }
  const knownRole = s.show[0]
  if (!knownRole) return []
  return sideSlips({
    deg: s.deg,
    known: { role: knownRole, value: s[knownRole] },
    asked: s.asked,
    names: NAMES,
    ...(depression ? { depression } : {}),
  }).map((slip) => ({ id: slip.id, value: slip.value, witness: coreWords(slip.witness) }))
}

function storyValue(s: StoryFixed): number {
  if (s.asked === 'angle') {
    const roles = s.show
    return angleAnswer({ a: { role: roles[0]!, value: s[roles[0]!] }, b: { role: roles[1]!, value: s[roles[1]!] }, names: NAMES })
  }
  const knownRole = s.show[0]!
  return sideAnswer({ deg: s.deg, known: { role: knownRole, value: s[knownRole] }, asked: s.asked, names: NAMES })
}

function makeStory(rng: Rng, fixed: StoryFixed | null): GeoBuilt | null {
  const scene = fixed ?? randomStory(rng)
  if (!scene) return null
  if (!scene.show.every((r) => Number.isInteger(scene[r]) && scene[r] >= 2)) return null
  if (scene.asked !== 'angle' && scene.show.includes(scene.asked)) return null
  if (scene.asked === 'angle' && scene.show.length < 2) return null
  if (scene.asked !== 'angle' && scene.show.length < 1) return null
  if (!(scene.opp > 0 && scene.adj > 0 && scene.hyp > 0)) return null
  if (Math.abs(scene.opp ** 2 + scene.adj ** 2 - scene.hyp ** 2) > 1e-2 * scene.hyp) return null
  const prompt = storyPrompt(scene)
  if (!prompt || prompt.includes('  ')) return null
  const figure = storyFigure(rng, scene)
  if (!figure) return null
  const value = storyValue(scene)
  const fn = storyFn(scene)
  const slips = storySlips(scene)
  const place = scene.asked === 'angle' ? (scene.places === 0 ? 'degree' : 'tenth of a degree') : scene.places === 0 ? 'meter' : scene.places === 1 ? 'tenth of a meter' : 'hundredth of a meter'
  const stage = decimalStage({
    label: scene.asked === 'angle' ? 'measure' : 'x',
    places: scene.places,
    value,
    ...(scene.asked === 'angle' ? { unit: 'deg' as const } : { lengthUnit: 'm' as const }),
    nudge: scene.asked === 'angle' ? ANGLE_NUDGE : SIDE_NUDGE,
    ruleCard: UNIT7B_RULE_IDS.elevation,
    reveal: [`Round to the nearest ${place}. The result is ${scene.asked === 'angle' ? `${value.toFixed(scene.places)}°` : `${value.toFixed(scene.places)} meters`}.`],
    slips,
    givens: [...scene.show.map((r) => scene[r]), ...(scene.asked === 'angle' ? [] : [scene.deg])],
  })
  if (!stage) return null
  // The worked line names her answer. Build it from the rounded text the box expects.
  stage.reveal = [
    scene.asked === 'angle'
      ? `The angle is the inverse ${RATIO_WORD[fn]} of the two sides, which comes to ${stage.answerText}°.`
      : `Use the ${RATIO_WORD[fn]} of ${scene.deg}° on the side you were given. The result, rounded to the nearest ${place}, is ${stage.answerText} meters.`,
  ]
  return finish7({
    question: 'elevationStory',
    prompt,
    figure,
    stages: [stage],
    lengths: scene.show.map((r) => scene[r]).filter((n) => Number.isInteger(n)),
    title: 'An angle of elevation or depression',
    instructions: 'Round only at the end, as the problem asks. Put the calculator in DEGREE mode. The figure is there before you answer.',
    params: { kind: scene.kind, elev: depressionOf(scene.kind) ? 'depression' : 'elevation', asked: scene.asked, places: scene.places },
    cards: ELEVATION_RULES,
    promise: depressionOf(scene.kind)
      ? ['trig_depression_from_vertical', 'trig_radian_mode', 'trig_hypotenuse_as_leg', 'trig_ratio_for_angle']
      : ['trig_radian_mode', 'trig_hypotenuse_as_leg', 'trig_opposite_adjacent_swapped', 'trig_ratio_for_angle'],
  })
}

const RATIO_WORD: Record<RtFn, string> = { sin: 'sine', cos: 'cosine', tan: 'tangent' }

/** The ratio that links the two sides she is using. The worked line names this one, not a different ratio. */
function storyFn(scene: StoryFixed): RtFn {
  const roles: RtRole[] = scene.asked === 'angle' ? [...scene.show] : [scene.show[0]!, scene.asked]
  const has = (r: RtRole) => roles.includes(r)
  if (has('opp') && has('hyp')) return 'sin'
  if (has('adj') && has('hyp')) return 'cos'
  return 'tan'
}

/**
 * The sides the sentence names. A prompt that says "a ladder 6 meters long" shows the hypotenuse, not a leg the
 * sentence never mentions. An angle question shows the two sides it names.
 */
function shownRoles(kind: StoryKind, asked: Asked): readonly RtRole[] | null {
  if (asked === 'angle') {
    if (kind === 'ladder' || kind === 'kite' || kind === 'ramp' || kind === 'guy') return ['opp', 'hyp']
    return ['opp', 'adj']
  }
  if (kind === 'tree' || kind === 'building') {
    if (asked === 'opp') return ['adj']
    if (asked === 'adj') return ['opp']
    return null
  }
  if (kind === 'cliff' || kind === 'lighthouse' || kind === 'window') {
    if (asked === 'opp') return ['adj']
    if (asked === 'adj' || asked === 'hyp') return ['opp']
    return null
  }
  if (kind === 'ladder' || kind === 'kite') {
    if (asked === 'hyp') return ['opp']
    if (asked === 'opp' || asked === 'adj') return ['hyp']
    return null
  }
  if (kind === 'ramp' || kind === 'guy') {
    if (asked === 'opp') return ['hyp']
    if (asked === 'hyp') return ['opp']
    return null
  }
  if (asked === 'opp') return ['adj']
  if (asked === 'hyp') return ['opp']
  return null
}

function sidesFrom(given: RtRole, value: number, deg: number): { opp: number; adj: number; hyp: number } {
  if (given === 'opp') return { opp: value, adj: value / tanD(deg), hyp: value / sinD(deg) }
  if (given === 'adj') return { opp: value * tanD(deg), adj: value, hyp: value / cosD(deg) }
  return { opp: value * sinD(deg), adj: value * cosD(deg), hyp: value }
}

function randomStory(rng: Rng): StoryFixed | null {
  const kind = rng.chance(0.5) ? rng.pick(DEPR) : rng.pick(ELEV)
  const asked = rng.pick(asksFor(kind))
  const roles = shownRoles(kind, asked)
  if (!roles) return null
  const places: Places = asked === 'angle' ? (rng.chance(0.25) ? 1 : 0) : rng.chance(0.2) ? 2 : rng.chance(0.15) ? 0 : 1
  const band = BAND[kind]
  const cap = (role: RtRole) => Math.min(band[role][1], kind === 'plane' ? 900 : band[role][1])
  if (asked === 'angle') {
    if (roles[0] === 'opp' && roles[1] === 'hyp') {
      const hyp = rng.int(band.hyp[0], cap('hyp'))
      const oppHi = Math.min(cap('opp'), hyp - 1)
      if (oppHi < band.opp[0]) return null
      const opp = rng.int(band.opp[0], oppHi)
      const adj = Math.sqrt(hyp * hyp - opp * opp)
      const deg = (Math.asin(opp / hyp) * 180) / Math.PI
      if (!inBand(kind, opp, adj, hyp, deg)) return null
      return { kind, asked, deg, opp, adj, hyp, show: ['opp', 'hyp'], places }
    }
    const opp = rng.int(band.opp[0], cap('opp'))
    const adj = rng.int(band.adj[0], cap('adj'))
    const deg = (Math.atan(opp / adj) * 180) / Math.PI
    const hyp = Math.hypot(opp, adj)
    if (!inBand(kind, opp, adj, hyp, deg)) return null
    return { kind, asked, deg, opp, adj, hyp, show: ['opp', 'adj'], places }
  }
  const given = roles[0]!
  const hi = cap(given)
  if (hi < band[given][0]) return null
  const deg = rng.int(band.deg[0], band.deg[1])
  const value = rng.int(band[given][0], hi)
  const sides = sidesFrom(given, value, deg)
  if (!inBand(kind, sides.opp, sides.adj, sides.hyp, deg)) return null
  return { kind, asked, deg, ...sides, show: [given], places }
}

function asksFor(kind: StoryKind): Asked[] {
  if (kind === 'ramp' || kind === 'guy') return ['opp', 'hyp', 'angle']
  if (kind === 'plane') return ['opp', 'hyp', 'angle']
  if (kind === 'tree' || kind === 'building') return ['opp', 'adj', 'angle']
  return ['opp', 'adj', 'hyp', 'angle']
}

// --- two observations --------------------------------------------------------------------------------------

const tanR = (d: number) => Math.tan(d)

function heightOf(gap: number, farDeg: number, nearDeg: number, how: 'sub' | 'add', trig: (d: number) => number): number {
  const a = trig(farDeg)
  const b = trig(nearDeg)
  const den = how === 'add' ? a + b : b - a
  if (den === 0) return NaN
  return (gap * a * b) / den
}

function twoValue(spec: TwoFixed, h: number): number {
  if (spec.asked === 'height') return h
  if (spec.asked === 'near') return h / tanD(spec.nearDeg)
  return h / tanD(spec.farDeg)
}

function twoPrompt(spec: TwoFixed): string {
  const end = roundLen(spec.places)
  const gap = meters(spec.gap)
  if (spec.layout === 'opposite') {
    const tail = spec.asked === 'height' ? `How tall is the tower, ${end}?` : spec.asked === 'near' ? `How far is the observer who sees the ${spec.nearDeg}° angle from the base of the tower, ${end}?` : `How far is the observer who sees the ${spec.farDeg}° angle from the base of the tower, ${end}?`
    return `Two observers stand on opposite sides of a tower, ${gap} apart. The angles of elevation to the top are ${spec.nearDeg}° and ${spec.farDeg}°. ${tail}`
  }
  if (spec.layout === 'closer') {
    const tail = spec.asked === 'height' ? `How tall is the tower, ${end}?` : spec.asked === 'near' ? `How far is the closer point from the base of the tower, ${end}?` : `How far is the farther point from the base of the tower, ${end}?`
    return `From a point on level ground, the angle of elevation to the top of a tower is ${spec.farDeg}°. From a second point ${gap} closer to the tower, the angle of elevation is ${spec.nearDeg}°. ${tail}`
  }
  const tail = spec.asked === 'height' ? `How tall is the tower, ${end}?` : spec.asked === 'near' ? `How far is the closer point from the base of the tower, ${end}?` : `How far is the farther point from the base of the tower, ${end}?`
  return `From a point on level ground, the angle of elevation to the top of a tower is ${spec.nearDeg}°. From a second point ${gap} farther from the tower, the angle of elevation is ${spec.farDeg}°. ${tail}`
}

function twoFigure(rng: Rng, spec: TwoFixed, h: number, nearDist: number, farDist: number): GeoFigureSpec | null {
  const mirror = rng.chance(0.5)
  const [pF, pT, pC, pA] = placeAll(
    [
      { x: 0, y: 0 },
      { x: 0, y: h },
      { x: nearDist, y: 0 },
      { x: spec.layout === 'opposite' ? -farDist : farDist, y: 0 },
    ],
    0,
    mirror,
  ) as [P2, P2, P2, P2]
  const heightLabel = spec.asked === 'height' ? 'x' : ''
  const nearLabel = spec.asked === 'near' ? 'x' : ''
  const farLabel = spec.layout === 'opposite' ? (spec.asked === 'far' ? 'x' : '') : String(spec.gap)
  // On one side the second ground segment is the gap between the points, a piece of the base. On opposite sides
  // each ground segment is one observer's distance.
  const segments: GeoSegment[] = [
    seg('F', 'T', heightLabel),
    seg('F', 'C', nearLabel),
    seg('C', 'A', spec.layout === 'opposite' ? '' : farLabel),
    seg('T', 'C', ''),
    seg('T', 'A', ''),
  ]
  if (spec.layout === 'opposite') segments[2] = seg('F', 'A', farLabel)
  const parts = new Set<number>()
  segments.forEach((s, i) => {
    if (s.label && (s.from === 'F' || s.to === 'F' || s.from === 'C') && s.to !== 'T' && s.from !== 'T') parts.add(i)
  })
  // A labeled piece of the base is always a dimension line. The vertical is an outer side, not a piece.
  if (spec.layout !== 'opposite') {
    parts.delete(0)
  } else {
    parts.delete(0)
  }
  const angles: NonNullable<GeoFigureSpec['angles']> = [
    { vertex: 'F', from: 'T', to: 'C', right: true },
    { vertex: 'C', from: 'F', to: 'T', label: `${spec.nearDeg}°` },
    { vertex: spec.layout === 'opposite' ? 'A' : 'A', from: spec.layout === 'opposite' ? 'F' : 'C', to: 'T', label: `${spec.farDeg}°` },
  ]
  const outline = spec.layout === 'opposite' ? ['T', 'C', 'A'] : ['T', 'F', 'A']
  return placeLabels7(
    {
      ariaLabel: 'A tower and two angles of elevation from points on level ground. The right angle is at the base of the tower.',
      points: [bare('F', pF), bare('T', pT), bare('C', pC), bare('A', pA)],
      segments,
      angles,
    },
    [outline],
    parts,
  )
}

function makeTwo(rng: Rng, fixed: TwoFixed | null): GeoBuilt | null {
  const spec = fixed ?? randomTwo(rng)
  if (!spec) return null
  if (!(spec.nearDeg > spec.farDeg) || spec.gap < 2 || !Number.isInteger(spec.gap)) return null
  const how = spec.layout === 'opposite' ? 'add' : 'sub'
  const h = heightOf(spec.gap, spec.farDeg, spec.nearDeg, how, tanD)
  const nearDist = h / tanD(spec.nearDeg)
  const farDist = h / tanD(spec.farDeg)
  if (!(h > 0) || h > 400 || nearDist < 2 || farDist < 2 || farDist > 800) return null
  if (spec.layout !== 'opposite' && Math.abs(farDist - nearDist - spec.gap) > 1e-2) return null
  if (spec.layout === 'opposite' && Math.abs(nearDist + farDist - spec.gap) > 1e-2) return null
  const value = twoValue(spec, h)
  if (!(value > 0) || value > 800) return null
  const wrongHow = how === 'add' ? 'sub' : 'add'
  const slips: DecimalSlip[] = []
  const push = (id: ErrorPatternId, height: number, witness: string) => {
    const v = spec.asked === 'height' ? height : spec.asked === 'near' ? height / tanD(spec.nearDeg) : height / tanD(spec.farDeg)
    slips.push({ id, value: v, witness })
  }
  push(
    'geo_distances_combined',
    heightOf(spec.gap, spec.farDeg, spec.nearDeg, wrongHow, tanD),
    spec.layout === 'opposite'
      ? 'The two observers stand on opposite sides, so the two distances add up to the space between them and the tangents are added. Subtracting them builds the picture of both observers on the same side.'
      : 'On the same side of the tower the farther distance is the closer one plus the space between the points, so the tangents are subtracted. Adding them builds the picture of two observers on opposite sides.',
  )
  push('trig_radian_mode', heightOf(spec.gap, spec.farDeg, spec.nearDeg, how, tanR), 'That is what the calculator gives in RADIAN mode. Press MODE, choose DEGREE, and work it out again.')
  push(
    'trig_opposite_adjacent_swapped',
    heightOf(spec.gap, 90 - spec.nearDeg, 90 - spec.farDeg, how, tanD),
    'That uses the other acute angle at each observation, the one up at the top, instead of the angle of elevation from the ground.',
  )
  const figure = twoFigure(rng, spec, h, nearDist, farDist)
  if (!figure) return null
  const stage = decimalStage({
    label: 'x',
    places: spec.places,
    value,
    lengthUnit: 'm',
    nudge: TWO_NUDGE,
    ruleCard: UNIT7B_RULE_IDS.two,
    reveal: [`The result, rounded to the nearest ${spec.places === 0 ? 'meter' : spec.places === 1 ? 'tenth of a meter' : 'hundredth of a meter'}, is ${value.toFixed(spec.places)} meters.`],
    slips,
    givens: [spec.nearDeg, spec.farDeg, spec.gap],
  })
  if (!stage) return null
  const place = spec.places === 0 ? 'meter' : spec.places === 1 ? 'tenth of a meter' : 'hundredth of a meter'
  stage.reveal = [`The two angles and the space between the points fix the height. Rounded to the nearest ${place}, the result is ${stage.answerText} meters.`]
  return finish7({
    question: 'elevationTwo',
    prompt: twoPrompt(spec),
    figure,
    stages: [stage],
    lengths: [spec.gap],
    title: 'Two angles of elevation',
    instructions: 'Round only at the end, as the problem asks. Put the calculator in DEGREE mode. The figure is there before you answer.',
    params: { layout: spec.layout, asked: spec.asked, places: spec.places },
    cards: ELEVATION_RULES,
    promise: ['geo_distances_combined', 'trig_radian_mode', 'trig_opposite_adjacent_swapped'],
  })
}

function randomTwo(rng: Rng): TwoFixed | null {
  const layout = rng.pick(['closer', 'farther', 'opposite'] as const)
  const asked = rng.pick(['height', 'near', 'far'] as const)
  const farDeg = rng.int(12, 50)
  const nearDeg = rng.int(farDeg + 8, Math.min(75, farDeg + 40))
  const gap = rng.int(20, 150)
  const places: Places = rng.chance(0.2) ? 0 : rng.chance(0.25) ? 2 : 1
  return { layout, asked, nearDeg, farDeg, gap, places }
}

function draw(seed: number, salt: number, make: (rng: Rng) => GeoBuilt | null, what: string): GeoBuilt {
  for (let attempt = 0; attempt < 400; attempt++) {
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

export function drawElevStory(seed: number): GeoBuilt {
  return draw(seed, 8001, (rng) => makeStory(rng, null), 'el.story')
}
export function drawElevTwo(seed: number): GeoBuilt {
  return draw(seed, 8101, (rng) => makeTwo(rng, null), 'el.two')
}
export function storyProblem(fixed: StoryFixed): GeoBuilt['answer'] {
  return example(9101, (rng) => makeStory(rng, fixed), 'el.story').answer
}
export function twoProblem(fixed: TwoFixed): GeoBuilt['answer'] {
  return example(9201, (rng) => makeTwo(rng, fixed), 'el.two').answer
}
