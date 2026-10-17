/**
 * Honors geometry Unit 2, properties and proofs. She picks a reason from the shared bank, or a missing
 * statement from choices. Letters and the algebra change with the seed. x = 4 is never an answer.
 */
import { makeRng, mixSeed } from '@/content/rng'
import type { ErrorPatternId, GeoFigureSpec, GeoPoint } from '@/shared/types'
import type { GeometryAnswer } from '@/content/types'
import type { GeoBuilt } from './build'
import { formatLin, lin, showNum } from './expr'
import { containsAnswer, stageDisplay, stageIdAt } from './grade'
import { reasonLabel, reasonWitness, swapsFor, type ReasonId } from './reasons'
import { UNIT2_RULE_IDS } from './unit2Rules'

const REASON_HINT = 'Pick the reason that makes this line legal.'
const REASON_NUDGE =
  'Match the move in the line. Swapping the two sides is not the same as saying something equals itself, and a point on a segment is not the same as adding a number to both sides of an equation.'
const CHOICE_HINT = 'Pick the statement this row needs.'
const CHOICE_NUDGE = 'Another sentence can be true on the figure and still belong on a different row.'

interface Letters {
  a: string
  b: string
  c: string
  d: string
  e: string
  f: string
}

const SETS: readonly Letters[] = [
  { a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', f: 'F' },
  { a: 'P', b: 'Q', c: 'R', d: 'S', e: 'T', f: 'U' },
  { a: 'E', b: 'F', c: 'G', d: 'H', e: 'N', f: 'P' },
  { a: 'W', b: 'X', c: 'Y', d: 'Z', e: 'N', f: 'P' },
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
  reasonNote?: string
  choices?: Choice[]
}

interface Built {
  id: string
  prompt: string
  figure: GeoFigureSpec
  lines?: string[]
  rows: ProofRow[]
  trapIndex: number
  trap: ErrorPatternId
  trapAnswer: string
  lengths?: number[]
  angles?: number[]
}

interface MidParam {
  a: number
  b: number
  c: number
  d: number
  x: number
  len: number
}

const MID: readonly MidParam[] = midpointParams()

export function drawReason(seed: number): GeoBuilt {
  const letters = SETS[seed % SETS.length]!
  const item = REASON_CASES[(seed - 1) % REASON_CASES.length]!
  const swaps = swapsFor(item.reason)
  const chosen = swaps[Math.floor((seed - 1) / REASON_CASES.length) % swaps.length]!
  if (!chosen) throw new Error(`gp.reason/${seed}: ${item.reason} has no named trap`)
  const statement = item.statement(letters)
  const built: Built = {
    id: item.id,
    prompt: `Name the reason for this line.\n${statement}`,
    figure: item.figure(letters),
    rows: [{ pick: 'reason', reason: item.reason, statement }],
    trapIndex: 0,
    trap: chosen.mistake,
    trapAnswer: chosen.picked,
  }
  return finish('reason', 'Name the reason', 'Pick the reason for this line from the list.', built, seed)
}

export function drawAlgebraic(seed: number): GeoBuilt {
  const which = (seed - 1) % 3
  const built = which === 0 ? algebraSym(seed) : which === 1 ? algebraDist(seed) : algebraChain(seed)
  return finish(
    'algebraic',
    'Algebraic proof',
    'The lines are already written. Pick the reason for each line, in order.',
    built,
    seed,
  )
}

export function drawTwoColumn(seed: number): GeoBuilt {
  const letters = SETS[seed % SETS.length]!
  const salt = Math.floor((seed - 1) / SKELETONS.length)
  const built = SKELETONS[(seed - 1) % SKELETONS.length]!(letters, salt)
  return finish('twocolumn', 'Two-column proof', 'Each row is missing its statement or its reason. Pick the missing piece.', built, seed)
}

const REASON_CASES: readonly {
  id: string
  reason: ReasonId
  statement: (letters: Letters) => string
  figure: (letters: Letters) => GeoFigureSpec
}[] = [
  {
    id: 'sym-eq',
    reason: 'eq-sym',
    statement: (L) => `If ${L.a}${L.b} = ${L.c}${L.d}, then ${L.c}${L.d} = ${L.a}${L.b}.`,
    figure: (L) => twoSegments(L, `${L.a}${L.b} and ${L.c}${L.d} are drawn as two segments.`),
  },
  {
    id: 'midpoint',
    reason: 'def-midpoint',
    statement: (L) => `${L.a}M = M${L.b} because M is the midpoint of ${L.a}${L.b}.`,
    figure: (L) => midpointFigure(L),
  },
  {
    id: 'linear',
    reason: 'post-linear-pair',
    statement: () => 'The measures of angle 1 and angle 2 add to 180 because the two angles form a linear pair.',
    figure: (L) => linearFigure(L, false),
  },
  {
    id: 'seg-add',
    reason: 'post-seg-add',
    statement: (L) => `${L.a}${L.b} + ${L.b}${L.c} = ${L.a}${L.c} because ${L.b} is between ${L.a} and ${L.c}.`,
    figure: (L) => collinear3(L),
  },
  {
    id: 'ang-add',
    reason: 'post-ang-add',
    statement: (L) =>
      `The measures of angle 1 and angle 2 add to the measure of angle ${L.a}${L.b}${L.c} because ray ${L.b}${L.d} is inside that angle.`,
    figure: (L) => rayFigure(L),
  },
  {
    id: 'vertical',
    reason: 'thm-vertical',
    statement: () => 'Angle 1 is congruent to angle 2 because the two angles are vertical angles.',
    figure: (L) => verticalFigure(L, false),
  },
  {
    id: 'trans-eq',
    reason: 'eq-trans',
    statement: (L) => `${L.a}${L.b} = ${L.e}${L.f} because ${L.a}${L.b} = ${L.c}${L.d} and ${L.c}${L.d} = ${L.e}${L.f}.`,
    figure: (L) => twoSegments(L, `Segments ${L.a}${L.b}, ${L.c}${L.d}, and ${L.e}${L.f}.`, true),
  },
  {
    id: 'trans-cong',
    reason: 'cong-trans',
    statement: () =>
      'Angle 1 is congruent to angle 3 because angle 1 is congruent to angle 2 and angle 2 is congruent to angle 3.',
    figure: (L) => threeAngles(L),
  },
  {
    id: 'sym-cong',
    reason: 'cong-sym',
    statement: () => 'Angle 2 is congruent to angle 1 because angle 1 is congruent to angle 2.',
    figure: (L) => threeAngles(L),
  },
]

const SKELETONS: readonly ((letters: Letters, salt: number) => Built)[] = [
  midpointAlgebra,
  segOverlap,
  linearSupp,
  verticalProve,
  verticalApply,
  congSupplements,
  congComplements,
  rightAngles,
  angleBisector,
  segmentBisector,
  transitiveSegments,
  perpendicular,
]

function midpointAlgebra(L: Letters, salt: number): Built {
  const p = MID[salt % MID.length]!
  const am = formatLin(lin(p.a, p.b))
  const mb = formatLin(lin(p.c, p.d))
  const gap = p.c - p.a
  if (p.a * p.x + p.b !== p.len || p.c * p.x + p.d !== p.len) throw new Error('midpoint parameters do not meet')
  if (p.b !== gap * p.x + p.d) throw new Error('midpoint subtraction is not the next line')
  if (p.b - p.d !== gap * p.x) throw new Error('midpoint shift is not the next line')
  const chosen = swapsFor('def-midpoint')[salt % 2]!
  return {
    id: 'midpoint-algebra',
    prompt: `M is the midpoint of ${L.a}${L.b}. ${L.a}M = ${am}. M${L.b} = ${mb}. Fill in each row of the proof.`,
    figure: midpointFigure(L),
    lengths: [p.len, p.len],
    rows: [
      reason(`M is the midpoint of ${L.a}${L.b}`, 'given'),
      reason(`${L.a}M = ${am}`, 'given'),
      reason(`M${L.b} = ${mb}`, 'given'),
      reason(`${L.a}M = M${L.b}`, 'def-midpoint'),
      reason(`${am} = ${mb}`, 'eq-subst'),
      reason(`${showNum(p.b)} = ${term(gap, p.d)}`, 'eq-sub'),
      reason(`${showNum(p.b - p.d)} = ${coeff(gap)}`, 'eq-sub'),
      statementRow(`x = ${p.x}`, 'eq-div', 'Both sides of the previous line were divided by the same nonzero number.', xChoices(p.x, L)),
    ],
    trapIndex: 3,
    trap: chosen.mistake,
    trapAnswer: chosen.picked,
  }
}

function segOverlap(L: Letters, salt: number): Built {
  const ab = seg(L.a, L.b)
  const bc = seg(L.b, L.c)
  const cd = seg(L.c, L.d)
  const ac = seg(L.a, L.c)
  const bd = seg(L.b, L.d)
  const chosen = swapsFor('post-seg-add')[salt % 2]!
  return {
    id: 'seg-overlap',
    prompt: `Points ${L.a}, ${L.b}, ${L.c}, and ${L.d} are in that order on a line. ${ab} = ${cd}. Fill in each row of the proof.`,
    figure: collinear4(L),
    rows: [
      reason(`${L.b} is between ${L.a} and ${L.c}, and ${L.c} is between ${L.b} and ${L.d}`, 'given'),
      reason(`${ab} = ${cd}`, 'given'),
      reason(`${ab} + ${bc} = ${ac}`, 'post-seg-add'),
      reason(`${cd} + ${bc} = ${bd}`, 'post-seg-add'),
      reason(`${ab} + ${bc} = ${bd}`, 'eq-subst'),
      statementRow(`${ac} = ${bd}`, 'eq-trans', 'The two sums were each shown equal to the same total, so they equal each other.', [
        { id: 'right', text: `${ac} = ${bd}` },
        { id: 'ab-bd', text: `${ab} = ${bd}` },
        { id: 'ac-cd', text: `${ac} = ${cd}` },
        { id: 'bc-bd', text: `${bc} = ${bd}` },
      ]),
    ],
    trapIndex: 2,
    trap: chosen.mistake,
    trapAnswer: chosen.picked,
  }
}

function linearSupp(L: Letters, _salt: number): Built {
  const chosen = swapsFor('post-linear-pair')[0]!
  return {
    id: 'linear-supp',
    prompt: 'Angle 1 and angle 2 form a linear pair, and angle 2 is congruent to angle 3. Fill in each row of the proof.',
    figure: linearFigure(L, true),
    rows: [
      reason('Angle 1 and angle 2 form a linear pair', 'given'),
      reason('Angle 2 is congruent to angle 3', 'given'),
      reason('Angle 1 and angle 2 are supplementary', 'post-linear-pair'),
      reason('The measures of angle 1 and angle 2 add to 180', 'def-supp'),
      reason('Angle 2 and angle 3 have the same measure', 'def-cong-ang'),
      reason('The measures of angle 1 and angle 3 add to 180', 'eq-subst'),
      statementRow('Angle 1 and angle 3 are supplementary', 'def-supp', 'The measures add to 180, which is what this word means.', [
        { id: 'right', text: 'Angle 1 and angle 3 are supplementary' },
        { id: 'cong', text: 'Angle 1 is congruent to angle 3' },
        { id: 'pair', text: 'Angle 1 and angle 3 form a linear pair' },
        { id: 'old', text: 'The measures of angle 1 and angle 2 add to 180' },
      ]),
    ],
    trapIndex: 2,
    trap: chosen.mistake,
    trapAnswer: chosen.picked,
  }
}

function verticalProve(L: Letters, _salt: number): Built {
  const chosen = swapsFor('post-linear-pair')[0]!
  return {
    id: 'vertical-prove',
    prompt:
      'Two lines cross. Angle 1 and angle 2 are opposite each other. Angle 3 is beside angle 1 on a straight line, and angle 2 is beside angle 3 on a straight line. Fill in the proof.',
    figure: verticalFigure(L, true),
    rows: [
      reason('Angle 1 and angle 3 form a linear pair', 'given'),
      reason('Angle 2 and angle 3 form a linear pair', 'given'),
      reason('Angle 1 and angle 3 are supplementary', 'post-linear-pair'),
      reason('Angle 2 and angle 3 are supplementary', 'post-linear-pair'),
      statementRow(
        'Angle 1 is congruent to angle 2',
        'thm-cong-supp',
        'Both angles are supplements of the same angle, so they match each other.',
        [
          { id: 'right', text: 'Angle 1 is congruent to angle 2' },
          { id: 'supp', text: 'Angle 1 and angle 2 are supplementary' },
          { id: 'sum', text: 'The measures of angle 1 and angle 3 add to 180' },
          { id: 'adj', text: 'Angle 1 is congruent to angle 3' },
        ],
      ),
    ],
    trapIndex: 2,
    trap: chosen.mistake,
    trapAnswer: chosen.picked,
  }
}

function verticalApply(L: Letters, _salt: number): Built {
  const chosen = swapsFor('thm-vertical')[0]!
  return {
    id: 'vertical-apply',
    prompt: 'Angle 1 and angle 2 are vertical angles. Fill in the proof.',
    figure: verticalFigure(L, false),
    rows: [
      reason('Angle 1 and angle 2 are vertical angles', 'given'),
      reason('Angle 1 is congruent to angle 2', 'thm-vertical'),
      statementRow(
        'Angle 1 and angle 2 have the same measure',
        'def-cong-ang',
        'Congruent angles are angles with the same measure. Which statement does that fact support?',
        [
          { id: 'right', text: 'Angle 1 and angle 2 have the same measure' },
          { id: 'sum', text: 'The measures of angle 1 and angle 2 add to 180' },
          { id: 'right-angle', text: 'Angle 1 is a right angle' },
          { id: 'pair', text: 'Angle 1 and angle 2 form a linear pair' },
        ],
      ),
    ],
    trapIndex: 1,
    trap: chosen.mistake,
    trapAnswer: chosen.picked,
  }
}

function congSupplements(L: Letters, _salt: number): Built {
  return samePartner(L, 'cong-supplements', 'supplementary', '180', 'def-supp')
}

function congComplements(L: Letters, _salt: number): Built {
  return samePartner(L, 'cong-complements', 'complementary', '90', 'def-comp')
}

function samePartner(L: Letters, id: string, word: string, total: string, definition: ReasonId): Built {
  const chosen = swapsFor('eq-trans')[0]!
  return {
    id,
    prompt: `Angle 1 and angle 2 are ${word}, and angle 3 and angle 2 are ${word}. Fill in the proof.`,
    figure: threeAngles(L),
    rows: [
      reason(`Angle 1 and angle 2 are ${word}`, 'given'),
      reason(`Angle 3 and angle 2 are ${word}`, 'given'),
      reason(`The measures of angle 1 and angle 2 add to ${total}`, definition),
      reason(`The measures of angle 3 and angle 2 add to ${total}`, definition),
      reason('The measure of angle 1 plus the measure of angle 2 equals the measure of angle 3 plus the measure of angle 2', 'eq-trans'),
      reason('Angle 1 and angle 3 have the same measure', 'eq-sub'),
      statementRow('Angle 1 is congruent to angle 3', 'def-cong-ang', 'Same measure is what this word about angles means.', [
        { id: 'right', text: 'Angle 1 is congruent to angle 3' },
        { id: 'word', text: `Angle 1 and angle 3 are ${word}` },
        { id: 'old', text: `The measures of angle 1 and angle 2 add to ${total}` },
        { id: 'self', text: 'Angle 2 is congruent to angle 2' },
      ]),
    ],
    trapIndex: 4,
    trap: chosen.mistake,
    trapAnswer: chosen.picked,
  }
}

function rightAngles(L: Letters, _salt: number): Built {
  const chosen = swapsFor('eq-trans')[0]!
  return {
    id: 'right-angles',
    prompt: 'Angle 1 is a right angle and angle 2 is a right angle. Fill in the proof.',
    figure: rightPair(L),
    angles: [90, 90],
    rows: [
      reason('Angle 1 is a right angle', 'given'),
      reason('Angle 2 is a right angle', 'given'),
      reason('The measure of angle 1 is 90 degrees', 'def-right'),
      reason('The measure of angle 2 is 90 degrees', 'def-right'),
      reason('Angle 1 and angle 2 have the same measure', 'eq-trans'),
      statementRow('Angle 1 is congruent to angle 2', 'def-cong-ang', 'Same measure is what this word about angles means.', [
        { id: 'right', text: 'Angle 1 is congruent to angle 2' },
        { id: 'sum', text: 'The measures of angle 1 and angle 2 add to 180' },
        { id: 'measure', text: 'The measure of angle 1 is 90 degrees' },
        { id: 'pair', text: 'Angle 1 and angle 2 form a linear pair' },
      ]),
    ],
    trapIndex: 4,
    trap: chosen.mistake,
    trapAnswer: chosen.picked,
  }
}

function angleBisector(L: Letters, _salt: number): Built {
  const chosen = swapsFor('post-ang-add')[0]!
  return {
    id: 'angle-bisector',
    prompt: `Ray ${L.b}${L.d} bisects angle ${L.a}${L.b}${L.c}. Angle 1 and angle 2 are the two pieces, and angle 3 is the whole angle. Fill in the proof.`,
    figure: rayFigure(L),
    rows: [
      reason(`Ray ${L.b}${L.d} bisects angle ${L.a}${L.b}${L.c}`, 'given'),
      statementRow('Angle 1 is congruent to angle 2', 'def-ang-bisector', 'The ray cuts the angle into two matching angles. Which statement does that fact support?', [
        { id: 'right', text: 'Angle 1 is congruent to angle 2' },
        { id: 'sum', text: 'The measures of angle 1 and angle 2 add to the measure of angle 3' },
        { id: 'flat', text: 'The measures of angle 1 and angle 2 add to 180' },
        { id: 'right-angle', text: 'Angle 1 is a right angle' },
      ]),
      reason('Angle 1 and angle 2 have the same measure', 'def-cong-ang'),
      reason('The measures of angle 1 and angle 2 add to the measure of angle 3', 'post-ang-add'),
      reason('The measure of angle 1 added to itself equals the measure of angle 3', 'eq-subst'),
      reason('The measure of angle 3 equals the measure of angle 1 added to itself', 'eq-sym'),
    ],
    trapIndex: 3,
    trap: chosen.mistake,
    trapAnswer: chosen.picked,
  }
}

function segmentBisector(L: Letters, salt: number): Built {
  const chosen = swapsFor('def-midpoint')[salt % 2]!
  return {
    id: 'segment-bisector',
    prompt: `Line ${L.c}${L.d} bisects ${L.a}${L.b} at M. Fill in the proof.`,
    figure: bisectorFigure(L),
    rows: [
      reason(`Line ${L.c}${L.d} bisects ${L.a}${L.b} at M`, 'given'),
      reason(`M is the midpoint of ${L.a}${L.b}`, 'def-seg-bisector'),
      reason(`${L.a}M = M${L.b}`, 'def-midpoint'),
      statementRow(
        `Segment ${L.a}M is congruent to segment M${L.b}`,
        'def-cong-seg',
        'Equal lengths are what this word about segments means. Which statement does that fact support?',
        [
          { id: 'right', text: `Segment ${L.a}M is congruent to segment M${L.b}` },
          { id: 'sum', text: `${L.a}M + M${L.b} = ${L.a}${L.b}` },
          { id: 'ends', text: `${L.a}${L.b} = ${L.c}${L.d}` },
          { id: 'self', text: `${L.a}M = ${L.a}M` },
        ],
      ),
    ],
    trapIndex: 2,
    trap: chosen.mistake,
    trapAnswer: chosen.picked,
  }
}

function transitiveSegments(L: Letters, salt: number): Built {
  const ab = seg(L.a, L.b)
  const cd = seg(L.c, L.d)
  const ef = seg(L.e, L.f)
  const subst = swapsFor('eq-trans')[0]!
  const useReflexive = salt % 2 === 1
  return {
    id: 'transitive-segments',
    prompt: `${ab} = ${cd} and ${cd} = ${ef}. Fill in the proof.`,
    figure: twoSegments(L, `Segments ${ab}, ${cd}, and ${ef}.`, true),
    rows: [
      reason(`${ab} = ${cd}`, 'given'),
      reason(`${cd} = ${ef}`, 'given'),
      reason(`${ab} = ${ef}`, 'eq-trans'),
      statementRow(`${ef} = ${ab}`, 'eq-sym', 'The previous equality can be written with the two sides the other way.', [
        { id: 'right', text: `${ef} = ${ab}` },
        {
          id: 'self',
          text: `${ab} = ${ab}`,
          trap: 'geo_reflexive_for_symmetric',
          witness: 'That sentence says a segment equals itself. This row writes the previous equality with the sides the other way.',
        },
        { id: 'cd', text: `${cd} = ${ef}` },
        { id: 'ab', text: `${ab} = ${cd}` },
      ]),
    ],
    trapIndex: useReflexive ? 3 : 2,
    trap: useReflexive ? 'geo_reflexive_for_symmetric' : subst.mistake,
    trapAnswer: useReflexive ? 'self' : subst.picked,
  }
}

function perpendicular(L: Letters, _salt: number): Built {
  const chosen = swapsFor('eq-sym')[0]!
  return {
    id: 'perpendicular',
    prompt: `Line ${L.a}${L.b} is perpendicular to line ${L.c}${L.d}. Angle 1 is one of the angles where they meet. Fill in the proof.`,
    figure: perpFigure(L),
    angles: [90],
    rows: [
      reason(`Line ${L.a}${L.b} is perpendicular to line ${L.c}${L.d}`, 'given'),
      statementRow('Angle 1 is a right angle', 'def-perp', 'The lines meet so that one angle at the crossing is a right angle. Which statement does that fact support?', [
        { id: 'right', text: 'Angle 1 is a right angle' },
        { id: 'vertical', text: 'Angle 1 and angle 2 are vertical angles' },
        { id: 'measure', text: 'The measure of angle 1 is 90 degrees' },
        { id: 'same', text: `${L.a}${L.b} = ${L.c}${L.d}` },
      ]),
      reason('The measure of angle 1 is 90 degrees', 'def-right'),
      reason('90 degrees equals the measure of angle 1', 'eq-sym'),
    ],
    trapIndex: 3,
    trap: chosen.mistake,
    trapAnswer: chosen.picked,
  }
}

function algebraSym(seed: number): Built {
  const n = [2, 3, 5, 6, 7, 8][(seed - 1) % 6]!
  const k = [3, 5, 6, 7, 8, 9, 10, 11, 12][Math.floor((seed - 1) / 6) % 9]!
  const chosen = swapsFor('eq-sym')[0]!
  const lines = [`${n * k} = ${n}x`, `${n}x = ${n * k}`, `x = ${k}`]
  return {
    id: 'sym-div',
    prompt: 'The first line is the starting equation. Pick the reason for each line.',
    figure: noFigure('No diagram. The lines of the proof are the problem.'),
    lines,
    rows: lines.map((line, index) => reason(line, index === 0 ? 'given' : index === 1 ? 'eq-sym' : 'eq-div')),
    trapIndex: 1,
    trap: chosen.mistake,
    trapAnswer: chosen.picked,
  }
}

function algebraDist(seed: number): Built {
  const n = [2, 3, 5, 6][(seed - 1) % 4]!
  const b = [1, 2, 3, 5, 6][Math.floor((seed - 1) / 4) % 5]!
  const k = [3, 5, 6, 7, 8, 9][Math.floor((seed - 1) / 20) % 6]!
  const total = n * (k + b)
  const chosen = swapsFor('eq-sym')[0]!
  const lines = [
    `${total} = ${n}(x + ${b})`,
    `${n}(x + ${b}) = ${total}`,
    `${formatLin(lin(n, n * b))} = ${total}`,
    `${n}x = ${n * k}`,
    `x = ${k}`,
  ]
  const reasons: ReasonId[] = ['given', 'eq-sym', 'eq-dist', 'eq-sub', 'eq-div']
  return {
    id: 'distribute',
    prompt: 'The first line is the starting equation. Pick the reason for each line.',
    figure: noFigure('No diagram. The lines of the proof are the problem.'),
    lines,
    rows: lines.map((line, index) => reason(line, reasons[index]!)),
    trapIndex: 1,
    trap: chosen.mistake,
    trapAnswer: chosen.picked,
  }
}

function algebraChain(seed: number): Built {
  const k = [3, 5, 6, 7, 8, 9, 10, 11, 12][(seed - 1) % 9]!
  const a = 2 + (seed % 3)
  const c = a + 1 + (seed % 2)
  const b = 1 + (seed % 5)
  const total = a * k + b
  const d = total - c * k
  if (c * k + d !== total) throw new Error('chain totals disagree')
  const chosen = swapsFor('eq-trans')[0]!
  const left = formatLin(lin(a, b))
  const right = formatLin(lin(c, d))
  const gap = c - a
  const lines = [left + ' = ' + showNum(total), showNum(total) + ' = ' + right, `${left} = ${right}`, `${showNum(b)} = ${term(gap, d)}`, `${showNum(b - d)} = ${coeff(gap)}`]
  const reasons: ReasonId[] = ['given', 'given', 'eq-trans', 'eq-sub', 'eq-sub']
  if (b !== gap * k + d) throw new Error('chain subtraction missed the solution')
  if (b - d !== gap * k) throw new Error('chain shift missed the solution')
  return {
    id: 'chain',
    prompt: 'The first two lines are starting equations. Pick the reason for each line.',
    figure: noFigure('No diagram. The lines of the proof are the problem.'),
    lines,
    rows: lines.map((line, index) => reason(line, reasons[index]!)),
    trapIndex: 2,
    trap: chosen.mistake,
    trapAnswer: chosen.picked,
  }
}

function reason(statement: string, why: ReasonId): ProofRow {
  return { pick: 'reason', statement, reason: why }
}

function statementRow(statement: string, why: ReasonId, reasonNote: string, choices: Choice[]): ProofRow {
  return { pick: 'statement', statement, reason: why, reasonNote, choices }
}

function xChoices(x: number, L: Letters): Choice[] {
  const wrong: number[] = []
  for (const n of [x + 1, x + 2, x + 3, x - 1, x + 5, x + 6]) {
    if (n > 0 && n !== x && n !== 4 && n !== 17) wrong.push(n)
    if (wrong.length === 2) break
  }
  return [
    { id: 'right', text: `x = ${x}` },
    { id: 'off1', text: `x = ${wrong[0]}` },
    { id: 'off2', text: `x = ${wrong[1]}` },
    { id: 'sum', text: `${L.a}M + M${L.b} = ${L.a}${L.b}` },
  ]
}

function finish(question: GeometryAnswer['question'], title: string, instructions: string, built: Built, seed: number): GeoBuilt {
  if (built.rows.length === 0 || built.rows.length > 8) throw new Error(`${built.id}: ${built.rows.length} rows`)
  const displays: string[] = []
  const stages = built.rows.map((row, index) => {
    const reveal = [`Row ${index + 1} says “${row.statement}”, supported by ${reasonLabel(row.reason)}.`]
    if (row.pick === 'reason') {
      const traps = swapsFor(row.reason).map((swap) => ({
        id: swap.mistake,
        text: swap.picked,
        witness: reasonWitness(swap.mistake, swap.picked),
      }))
      displays.push(reasonLabel(row.reason))
      return {
        id: stageIdAt(index),
        kind: 'reason' as const,
        label: `Reason for row ${index + 1}`,
        hint: REASON_HINT,
        nudge: REASON_NUDGE,
        note: `Statement: ${row.statement}`,
        answerText: row.reason,
        ruleCard: cardFor(row.reason),
        reveal,
        traps,
      }
    }
    const choices = makeRng(mixSeed(seed, index + 11)).shuffle(row.choices ?? [])
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
  if (trapStage.answerText === built.trapAnswer) throw new Error(`${built.id}: the trap is the right answer`)
  const answer: GeometryAnswer = {
    type: 'geometry',
    question,
    prompt: built.prompt,
    figure: built.figure,
    lines: built.lines,
    stages,
    lengths: built.lengths ?? [],
    angles: built.angles ?? [],
    expectedDisplay: stages.map((stage) => stageDisplay(stage)).join(' · '),
    reveal: stages.flatMap((stage) => stage.reveal),
    ruleCards: [...new Set(stages.map((stage) => stage.ruleCard))],
    trap: built.trap,
    trapStage: trapStage.id,
    trapAnswer: built.trapAnswer,
  }
  for (const stage of stages) {
    for (const other of displays) {
      if (stage.kind === 'reason' && stage.note && containsAnswer(stage.note, other) && other === reasonLabel(stage.answerText)) {
        throw new Error(`${built.id}: a statement repeats the reason`)
      }
    }
  }
  return {
    answer,
    title,
    instructions,
    params: { skeleton: built.id, question },
  }
}

function cardFor(reason: ReasonId): string {
  if (reason === 'given' || reason.startsWith('post-')) return UNIT2_RULE_IDS.postulates
  if (reason.startsWith('eq-')) return UNIT2_RULE_IDS.equality
  if (reason.startsWith('cong-')) return UNIT2_RULE_IDS.congruence
  if (reason.startsWith('def-')) return UNIT2_RULE_IDS.definitions
  return UNIT2_RULE_IDS.theorems
}

function coeff(n: number): string {
  return n === 1 ? 'x' : `${n}x`
}

function term(coeffN: number, constant: number): string {
  return formatLin(lin(coeffN, constant))
}

function seg(left: string, right: string): string {
  return `${left}${right}`
}

function midpointParams(): MidParam[] {
  const out: MidParam[] = []
  for (const x of [3, 5, 6, 7, 8, 9]) {
    for (const a of [2, 3, 4, 5, 6]) {
      for (const step of [1, 2, 3]) {
        const c = a + step
        for (const b of [1, 2, 3, 5, 6, 7, 8, 9]) {
          const len = a * x + b
          const d = len - c * x
          if (d >= 0 || d < -12 || len === 17) continue
          out.push({ a, b, c, d, x, len })
        }
      }
    }
  }
  return out
}

function pt(id: string, x: number, y: number, side: NonNullable<GeoPoint['labelSide']>): GeoPoint {
  return { id, x, y, label: id, labelSide: side }
}

function bare(id: string, x: number, y: number): GeoPoint {
  return { id, x, y }
}

function noFigure(aria: string): GeoFigureSpec {
  return { points: [], ariaLabel: aria }
}

function midpointFigure(L: Letters): GeoFigureSpec {
  return {
    ariaLabel: `${L.a}${L.b} with midpoint M. The two halves are marked the same.`,
    points: [pt(L.a, 0, 0, 'below'), pt('M', 2, 0, 'above'), pt(L.b, 4, 0, 'below')],
    segments: [
      { from: L.a, to: 'M', ticks: 1, labelSide: 'above' },
      { from: 'M', to: L.b, ticks: 1, labelSide: 'above' },
    ],
  }
}

function bisectorFigure(L: Letters): GeoFigureSpec {
  return {
    ariaLabel: `Line ${L.c}${L.d} crosses ${L.a}${L.b} at M, and the two halves of ${L.a}${L.b} are marked the same.`,
    points: [
      pt(L.a, 0, 0, 'below'),
      pt('M', 2, 0, 'above'),
      pt(L.b, 4, 0, 'below'),
      pt(L.c, 2, 1.6, 'above'),
      pt(L.d, 2, -1.6, 'below'),
    ],
    segments: [
      { from: L.a, to: 'M', ticks: 1, labelSide: 'above' },
      { from: 'M', to: L.b, ticks: 1, labelSide: 'above' },
    ],
    lines: [{ through: [L.c, L.d] }],
  }
}

function collinear3(L: Letters): GeoFigureSpec {
  return {
    ariaLabel: `${L.a}, ${L.b}, and ${L.c} on one line, with ${L.b} between ${L.a} and ${L.c}.`,
    points: [pt(L.a, 0, 0, 'below'), pt(L.b, 2, 0, 'above'), pt(L.c, 4.5, 0, 'below')],
    segments: [
      { from: L.a, to: L.b },
      { from: L.b, to: L.c },
    ],
  }
}

function collinear4(L: Letters): GeoFigureSpec {
  return {
    ariaLabel: `${L.a}, ${L.b}, ${L.c}, and ${L.d} in that order on one line.`,
    points: [pt(L.a, 0, 0, 'below'), pt(L.b, 1.6, 0, 'above'), pt(L.c, 3.4, 0, 'below'), pt(L.d, 5.2, 0, 'above')],
    segments: [
      { from: L.a, to: L.b },
      { from: L.b, to: L.c },
      { from: L.c, to: L.d },
    ],
  }
}

function twoSegments(L: Letters, aria: string, third = false): GeoFigureSpec {
  const points = [pt(L.a, 0, 1.2, 'left'), pt(L.b, 3, 1.2, 'right'), pt(L.c, 0, 0, 'left'), pt(L.d, 3, 0, 'right')]
  const segments: NonNullable<GeoFigureSpec['segments']> = [
    { from: L.a, to: L.b, labelSide: 'above' },
    { from: L.c, to: L.d, labelSide: 'above' },
  ]
  if (third) {
    points.push(pt(L.e, 0, -1.2, 'left'), pt(L.f, 3, -1.2, 'right'))
    segments.push({ from: L.e, to: L.f, labelSide: 'below' })
  }
  return { ariaLabel: aria, points, segments }
}

function linearFigure(L: Letters, third: boolean): GeoFigureSpec {
  const points = [pt(L.a, -3, 0, 'left'), pt(L.b, 0, 0, 'below'), pt(L.c, 3, 0, 'right'), pt(L.d, 1.1, 2.1, 'above')]
  const angles: NonNullable<GeoFigureSpec['angles']> = [
    { vertex: L.b, from: L.a, to: L.d, label: '1' },
    { vertex: L.b, from: L.d, to: L.c, label: '2', radius: 28 },
  ]
  if (third) {
    points.push(bare('z1', 5.2, 0), bare('z2', 6.6, 0.2), bare('z3', 7.6, 1.5))
    angles.push({ vertex: 'z2', from: 'z1', to: 'z3', label: '3', radius: 22 })
  }
  return {
    ariaLabel: third
      ? `Angle 1 and angle 2 form a straight line at ${L.b}. Angle 3 is drawn separately.`
      : `Angle 1 and angle 2 form a straight line at ${L.b}.`,
    points,
    segments: [
      { from: L.a, to: L.b },
      { from: L.b, to: L.c },
      ...(third
        ? [
            { from: 'z1', to: 'z2' },
            { from: 'z2', to: 'z3' },
          ]
        : []),
    ],
    rays: [{ from: L.b, through: L.d }],
    angles,
  }
}

function verticalFigure(L: Letters, third: boolean): GeoFigureSpec {
  return {
    ariaLabel: third
      ? `Two lines cross. Angle 1 and angle 2 are opposite, and angle 3 is beside angle 1.`
      : 'Two lines cross. Angle 1 and angle 2 are opposite each other.',
    points: [
      pt(L.a, -3, 0, 'left'),
      pt(L.b, 3, 0, 'right'),
      pt(L.c, 0, 2.4, 'above'),
      pt(L.d, 0, -2.4, 'below'),
      { id: 'O', x: 0, y: 0 },
    ],
    lines: [
      { through: [L.a, L.b] },
      { through: [L.c, L.d] },
    ],
    angles: [
      { vertex: 'O', from: L.a, to: L.c, label: '1' },
      { vertex: 'O', from: L.b, to: L.d, label: '2' },
      ...(third ? [{ vertex: 'O', from: L.c, to: L.b, label: '3', radius: 28 }] : []),
    ],
  }
}

function rayFigure(L: Letters): GeoFigureSpec {
  return {
    ariaLabel: `Ray ${L.b}${L.d} is inside angle ${L.a}${L.b}${L.c}. Angle 1 and angle 2 are the pieces, and angle 3 is the whole angle.`,
    points: [pt(L.b, 0, 0, 'below'), pt(L.a, 3.2, 0.2, 'right'), pt(L.d, 1.2, 2.4, 'above'), pt(L.c, -0.4, 2.6, 'above')],
    rays: [
      { from: L.b, through: L.a },
      { from: L.b, through: L.d },
      { from: L.b, through: L.c },
    ],
    angles: [
      { vertex: L.b, from: L.a, to: L.d, label: '1', marks: 1, radius: 22 },
      { vertex: L.b, from: L.d, to: L.c, label: '2', marks: 1, radius: 22 },
      { vertex: L.b, from: L.a, to: L.c, label: '3', radius: 40 },
    ],
  }
}

function threeAngles(_L: Letters): GeoFigureSpec {
  return {
    ariaLabel: 'Three separate angles, labeled 1, 2, and 3.',
    points: [
      pt('P', 0, 0, 'below'),
      bare('A1', 1.6, 0.2),
      bare('B1', 0.2, 1.6),
      pt('Q', 3.4, 0, 'below'),
      bare('A2', 5, 0.2),
      bare('B2', 3.6, 1.6),
      pt('R', 6.8, 0, 'below'),
      bare('A3', 8.4, 0.2),
      bare('B3', 7, 1.6),
    ],
    rays: [
      { from: 'P', through: 'A1' },
      { from: 'P', through: 'B1' },
      { from: 'Q', through: 'A2' },
      { from: 'Q', through: 'B2' },
      { from: 'R', through: 'A3' },
      { from: 'R', through: 'B3' },
    ],
    angles: [
      { vertex: 'P', from: 'A1', to: 'B1', label: '1' },
      { vertex: 'Q', from: 'A2', to: 'B2', label: '2' },
      { vertex: 'R', from: 'A3', to: 'B3', label: '3' },
    ],
  }
}

function rightPair(_L: Letters): GeoFigureSpec {
  return {
    ariaLabel: 'Two right angles, labeled 1 and 2.',
    points: [
      pt('P', 0, 0, 'below'),
      pt('A', 2, 0, 'right'),
      pt('B', 0, 2, 'above'),
      pt('Q', 4, 0, 'below'),
      pt('C', 6, 0, 'right'),
      pt('D', 4, 2, 'above'),
    ],
    rays: [
      { from: 'P', through: 'A' },
      { from: 'P', through: 'B' },
      { from: 'Q', through: 'C' },
      { from: 'Q', through: 'D' },
    ],
    angles: [
      { vertex: 'P', from: 'A', to: 'B', label: '1', right: true },
      { vertex: 'Q', from: 'C', to: 'D', label: '2', right: true },
    ],
  }
}

function perpFigure(L: Letters): GeoFigureSpec {
  return {
    ariaLabel: `Line ${L.a}${L.b} meets line ${L.c}${L.d} at a right angle. Angle 1 is marked.`,
    points: [pt(L.a, -2.4, 0, 'left'), pt(L.b, 2.4, 0, 'right'), pt(L.c, 0, 2.2, 'above'), pt(L.d, 0, -2.2, 'below'), { id: 'O', x: 0, y: 0 }],
    lines: [
      { through: [L.a, L.b] },
      { through: [L.c, L.d] },
    ],
    angles: [{ vertex: 'O', from: L.b, to: L.c, label: '1', right: true }],
  }
}
