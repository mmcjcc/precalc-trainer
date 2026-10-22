/**
 * The word problems of rt.side and rt.angle: a ladder against a wall, a ramp, a kite on a staked string, a lighthouse
 * and a boat (an angle of depression), a tree and its shadow. Each story names its three sides from the angle at the
 * low end (opposite, adjacent, hypotenuse), says which pairs it asks about, the sizes a real one has, and its words.
 * Lengths are whole numbers; angles whole degrees.
 */
import type { DepressionWords, RtNames, RtRole } from '@/engine/trig'
import { m } from '../trig/text'
import { LENGTH_UNITS, type LengthUnit } from './common'
import type { Scene } from './shapes'

/** A side problem: the side she knows and its sizes, the side she is asked for, the sentence and the question. */
export interface SideCase {
  known: RtRole
  asked: RtRole
  range: [number, number]
  /** The situation, with the known length `v` and the angle `a` (math strings). */
  text: (v: string, a: string) => string
  question: string
}

/** An angle problem: the two sides she knows (each with its sizes) and the sentence. */
export interface AngleCase {
  a: { role: RtRole; range: [number, number] }
  b: { role: RtRole; range: [number, number] }
  text: (va: string, vb: string) => string
  question: string
}

export interface Story {
  scene: Scene
  unit: LengthUnit
  names: RtNames
  depression?: DepressionWords
  /** Whole degrees a real one has, for a side problem; an angle problem keeps its answer in the same range. */
  angle: [number, number]
  sides: SideCase[]
  angles: AngleCase[]
  /** The figure in words (no number she is asked for). */
  picture: string
}

const ft = LENGTH_UNITS.ft
const meters = LENGTH_UNITS.m

export const STORIES: Record<Scene, Story> = {
  ladder: {
    scene: 'ladder',
    unit: ft,
    names: { opp: 'the height up the wall', adj: 'the distance from the wall', hyp: 'the ladder' },
    angle: [55, 80],
    sides: [
      { known: 'hyp', asked: 'opp', range: [10, 30], text: (v, a) => `A ${v}-foot ladder leans against a wall and makes a ${a} angle with the ground.`, question: 'How high up the wall does the ladder reach?' },
      { known: 'hyp', asked: 'adj', range: [10, 30], text: (v, a) => `A ${v}-foot ladder leans against a wall and makes a ${a} angle with the ground.`, question: 'How far is the foot of the ladder from the wall?' },
      { known: 'opp', asked: 'hyp', range: [8, 28], text: (v, a) => `A ladder leans against a wall, makes a ${a} angle with the ground, and reaches ${v} feet up the wall.`, question: 'How long is the ladder?' },
      { known: 'adj', asked: 'hyp', range: [2, 9], text: (v, a) => `The foot of a ladder is ${v} feet from a wall, and the ladder makes a ${a} angle with the ground.`, question: 'How long is the ladder?' },
    ],
    angles: [
      { a: { role: 'hyp', range: [10, 30] }, b: { role: 'opp', range: [8, 29] }, text: (l, h) => `A ${l}-foot ladder leaning against a wall reaches ${h} feet up the wall.`, question: 'What angle does the ladder make with the ground?' },
      { a: { role: 'hyp', range: [10, 30] }, b: { role: 'adj', range: [2, 9] }, text: (l, d) => `The foot of a ${l}-foot ladder leaning against a wall is ${d} feet from the wall.`, question: 'What angle does the ladder make with the ground?' },
    ],
    picture: 'A ladder leans against a wall, its foot on the ground',
  },
  ramp: {
    scene: 'ramp',
    unit: ft,
    names: { opp: 'the rise', adj: 'the distance along the ground', hyp: 'the ramp' },
    angle: [3, 12],
    sides: [
      { known: 'hyp', asked: 'opp', range: [8, 40], text: (v, a) => `A ramp ${v} feet long rises from the ground at an angle of ${a}.`, question: 'How high does it rise?' },
      { known: 'hyp', asked: 'adj', range: [8, 40], text: (v, a) => `A ramp ${v} feet long rises from the ground at an angle of ${a}.`, question: 'How far does it reach along the ground?' },
      { known: 'opp', asked: 'hyp', range: [1, 5], text: (v, a) => `A ramp rises ${v} feet from the ground at an angle of ${a}.`, question: 'How long is the ramp?' },
      { known: 'opp', asked: 'adj', range: [1, 5], text: (v, a) => `A ramp rises ${v} feet from the ground at an angle of ${a}.`, question: 'How far does it reach along the ground?' },
    ],
    angles: [
      { a: { role: 'opp', range: [1, 5] }, b: { role: 'adj', range: [8, 48] }, text: (h, d) => `A ramp rises ${h} feet over a distance of ${d} feet along the ground.`, question: 'What angle does the ramp make with the ground?' },
      { a: { role: 'opp', range: [1, 5] }, b: { role: 'hyp', range: [8, 48] }, text: (h, l) => `A ramp ${l} feet long rises ${h} feet from the ground.`, question: 'What angle does the ramp make with the ground?' },
    ],
    picture: 'A ramp rises from the ground to a raised edge',
  },
  kite: {
    scene: 'kite',
    unit: ft,
    names: { opp: 'the height of the kite', adj: 'the distance along the ground', hyp: 'the string' },
    angle: [25, 65],
    sides: [
      { known: 'hyp', asked: 'opp', range: [40, 300], text: (v, a) => `A kite flies on a ${v}-foot string staked to the ground, at an angle of elevation of ${a}.`, question: 'How high is the kite?' },
      { known: 'hyp', asked: 'adj', range: [40, 300], text: (v, a) => `A kite flies on a ${v}-foot string staked to the ground, at an angle of elevation of ${a}.`, question: 'How far is the stake from the point on the ground right below the kite?' },
      { known: 'opp', asked: 'hyp', range: [30, 200], text: (v, a) => `A kite flies ${v} feet above the ground on a string staked to the ground, at an angle of elevation of ${a}.`, question: 'How long is the string?' },
    ],
    angles: [
      { a: { role: 'opp', range: [30, 200] }, b: { role: 'hyp', range: [40, 300] }, text: (h, l) => `A kite flies ${h} feet above the ground on a ${l}-foot string staked to the ground.`, question: 'What is the angle of elevation of the string?' },
      { a: { role: 'adj', range: [20, 200] }, b: { role: 'hyp', range: [40, 300] }, text: (d, l) => `A kite on a ${l}-foot string staked to the ground flies right above a point ${d} feet from the stake.`, question: 'What is the angle of elevation of the string?' },
    ],
    picture: 'A kite on a string staked to the ground, with a dashed line straight down from the kite',
  },
  lighthouse: {
    scene: 'lighthouse',
    unit: meters,
    names: { opp: 'the height of the lighthouse', adj: 'the distance from the base to the boat', hyp: 'the line of sight' },
    depression: { high: 'the top of the lighthouse', low: 'the boat' },
    angle: [8, 40],
    sides: [
      { known: 'opp', asked: 'adj', range: [20, 80], text: (v, a) => `From the top of a ${v}-meter lighthouse, the angle of depression to a boat is ${a}.`, question: 'How far is the boat from the base of the lighthouse?' },
      { known: 'opp', asked: 'hyp', range: [20, 80], text: (v, a) => `From the top of a ${v}-meter lighthouse, the angle of depression to a boat is ${a}.`, question: 'How far is the boat from the top of the lighthouse, along the line of sight?' },
      { known: 'adj', asked: 'opp', range: [60, 400], text: (v, a) => `A boat is ${v} meters from the base of a lighthouse. From the top of the lighthouse, the angle of depression to the boat is ${a}.`, question: 'How tall is the lighthouse?' },
    ],
    angles: [
      { a: { role: 'opp', range: [20, 80] }, b: { role: 'adj', range: [60, 400] }, text: (h, d) => `A lighthouse is ${h} meters tall, and a boat is ${d} meters from its base.`, question: 'What is the angle of depression from the top of the lighthouse to the boat?' },
      { a: { role: 'opp', range: [20, 80] }, b: { role: 'hyp', range: [60, 400] }, text: (h, s) => `From the top of a ${h}-meter lighthouse, a boat is ${s} meters away along the line of sight.`, question: 'What is the angle of depression from the top of the lighthouse to the boat?' },
    ],
    picture: 'A lighthouse on the shore and a boat on the water, with the line of sight from the top of the lighthouse down to the boat and a dashed horizontal line at the top',
  },
  tree: {
    scene: 'tree',
    unit: ft,
    names: { opp: 'the height of the tree', adj: 'the shadow', hyp: 'the sun’s ray' },
    angle: [25, 70],
    sides: [
      { known: 'adj', asked: 'opp', range: [8, 60], text: (v, a) => `When the sun is ${a} above the horizon, a tree casts a shadow ${v} feet long.`, question: 'How tall is the tree?' },
      { known: 'opp', asked: 'adj', range: [10, 80], text: (v, a) => `A tree ${v} feet tall casts a shadow when the sun is ${a} above the horizon.`, question: 'How long is the shadow?' },
    ],
    angles: [{ a: { role: 'opp', range: [10, 80] }, b: { role: 'adj', range: [8, 60] }, text: (h, s) => `A tree ${h} feet tall casts a shadow ${s} feet long.`, question: 'What is the angle of elevation of the sun?' }],
    picture: 'A tree and its shadow on the ground, with the sun’s ray from the top of the tree to the tip of the shadow',
  },
}

/** A length for a sentence: "20" as KaTeX. */
export const num = (v: number) => m(String(v))
