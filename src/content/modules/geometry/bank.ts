/**
 * The conditional bank for honors geometry Unit 2.
 * Each entry stores the hypothesis, the conclusion, both negations in full English, the truth value of
 * each related statement, and a counterexample for every false one. The audit at the bottom is the
 * check the tests call: the contrapositive matches the conditional, the inverse matches the converse,
 * and a counterexample makes that form's hypothesis true and its conclusion false.
 */
import type { GeoFigureSpec } from '@/shared/types'

export const LOGIC_FORMS = ['conditional', 'converse', 'inverse', 'contrapositive'] as const
export type LogicForm = (typeof LOGIC_FORMS)[number]

export interface Situation {
  id: string
  text: string
  /** Does the original hypothesis hold in this situation? */
  p: boolean
  /** Does the original conclusion hold in this situation? */
  q: boolean
}

export type LogicScene = 'vertical' | 'linear' | 'adjacent' | 'midpoint' | 'ray' | 'collinear' | 'angles' | 'lines' | 'life'

export interface BankEntry {
  id: string
  title: string
  /** Hypothesis, written so it can follow "If". */
  p: string
  /** Conclusion, written so it can follow "then". */
  q: string
  /** Negation of the hypothesis, in full English, ready to follow "If". */
  notP: string
  /** Negation of the conclusion, in full English, ready to follow "then". */
  notQ: string
  conditional: boolean
  converse: boolean
  inverse: boolean
  contrapositive: boolean
  /** One counterexample for each false form. Absent when that form is true. */
  counterexamples: Partial<Record<LogicForm, Situation>>
  /** Other honest situations: examples that fit, and decoys that miss a hypothesis. */
  situations: Situation[]
  scene: LogicScene
}

export interface LawChain {
  id: string
  p: string
  q: string
  r: string
  notP: string
  notQ: string
  notR: string
  scene: LogicScene
}

function sit(id: string, text: string, p: boolean, q: boolean): Situation {
  return { id, text, p, q }
}

function ce(id: string, text: string, p: boolean, q: boolean): Situation {
  return sit(id, text, p, q)
}

export const STATEMENT_BANK: readonly BankEntry[] = [
  {
    id: 'vertical-congruent',
    title: 'Vertical angles are congruent',
    p: 'two angles are vertical angles',
    q: 'the two angles are congruent',
    notP: 'two angles are not vertical angles',
    notQ: 'the two angles are not congruent',
    conditional: true,
    converse: false,
    inverse: false,
    contrapositive: true,
    counterexamples: {
      converse: ce('vert-ft', 'Angle 1 and angle 2 both measure 40 degrees, and they sit next to each other instead of opposite each other.', false, true),
      inverse: ce('vert-ft', 'Angle 1 and angle 2 both measure 40 degrees, and they sit next to each other instead of opposite each other.', false, true),
    },
    situations: [
      sit('vert-tt', 'Angle 1 and angle 3 are opposite angles where two lines cross, and both measure 40 degrees.', true, true),
      sit('vert-ff', 'Angle 1 measures 30 degrees and angle 2 measures 50 degrees, and the angles are not opposite each other.', false, false),
    ],
    scene: 'vertical',
  },
  {
    id: 'linear-supplementary',
    title: 'A linear pair is supplementary',
    p: 'two angles form a linear pair',
    q: 'the two angles are supplementary',
    notP: 'two angles do not form a linear pair',
    notQ: 'the two angles are not supplementary',
    conditional: true,
    converse: false,
    inverse: false,
    contrapositive: true,
    counterexamples: {
      converse: ce('lin-ft', 'Angle 1 measures 40 degrees and angle 2 measures 140 degrees, and the angles are not adjacent.', false, true),
      inverse: ce('lin-ft', 'Angle 1 measures 40 degrees and angle 2 measures 140 degrees, and the angles are not adjacent.', false, true),
    },
    situations: [
      sit('lin-tt', 'Angle 1 and angle 2 are adjacent and form a straight line, so one measures 40 degrees and the other measures 140 degrees.', true, true),
      sit('lin-ff', 'Angle 1 measures 40 degrees and angle 2 measures 50 degrees, and the angles are not adjacent.', false, false),
    ],
    scene: 'linear',
  },
  {
    id: 'right-angles-congruent',
    title: 'Right angles are congruent',
    p: 'two angles are right angles',
    q: 'the two angles are congruent',
    notP: 'the two angles are not both right angles',
    notQ: 'the two angles are not congruent',
    conditional: true,
    converse: false,
    inverse: false,
    contrapositive: true,
    counterexamples: {
      converse: ce('right-ft', 'Angle 1 and angle 2 both measure 45 degrees.', false, true),
      inverse: ce('right-ft', 'Angle 1 and angle 2 both measure 45 degrees.', false, true),
    },
    situations: [
      sit('right-tt', 'Angle 1 and angle 2 both measure 90 degrees.', true, true),
      sit('right-ff', 'Angle 1 measures 30 degrees and angle 2 measures 60 degrees.', false, false),
    ],
    scene: 'angles',
  },
  {
    id: 'midpoint-equal-parts',
    title: 'A midpoint makes equal parts',
    p: 'M is the midpoint of AB',
    q: 'AM equals MB',
    notP: 'M is not the midpoint of AB',
    notQ: 'AM does not equal MB',
    conditional: true,
    converse: false,
    inverse: false,
    contrapositive: true,
    counterexamples: {
      converse: ce('mid-ft', 'AM equals MB, and M is not on line AB.', false, true),
      inverse: ce('mid-ft', 'AM equals MB, and M is not on line AB.', false, true),
    },
    situations: [
      sit('mid-tt', 'M is the midpoint of AB, so AM and MB are the same length.', true, true),
      sit('mid-ff', 'M is not on line AB, and AM is longer than MB.', false, false),
    ],
    scene: 'midpoint',
  },
  {
    id: 'segment-between',
    title: 'Betweenness and segment addition',
    p: 'B is between A and C',
    q: 'AB + BC equals AC',
    notP: 'B is not between A and C',
    notQ: 'AB + BC does not equal AC',
    conditional: true,
    converse: true,
    inverse: true,
    contrapositive: true,
    counterexamples: {},
    situations: [
      sit('bet-tt', 'A, B, and C are on one line with B between A and C, and the two pieces add to the whole.', true, true),
      sit('bet-ff', 'A, B, and C are the vertices of a triangle, so B is not between A and C and the pieces do not add to AC.', false, false),
    ],
    scene: 'collinear',
  },
  {
    id: 'complementary-sum',
    title: 'Complementary angles add to 90',
    p: 'two angles are complementary',
    q: 'the measures of the two angles add to 90 degrees',
    notP: 'two angles are not complementary',
    notQ: 'the measures of the two angles do not add to 90 degrees',
    conditional: true,
    converse: true,
    inverse: true,
    contrapositive: true,
    counterexamples: {},
    situations: [
      sit('comp-tt', 'Angle 1 measures 30 degrees and angle 2 measures 60 degrees.', true, true),
      sit('comp-ff', 'Angle 1 measures 30 degrees and angle 2 measures 40 degrees.', false, false),
    ],
    scene: 'angles',
  },
  {
    id: 'supplementary-sum',
    title: 'Supplementary angles add to 180',
    p: 'two angles are supplementary',
    q: 'the measures of the two angles add to 180 degrees',
    notP: 'two angles are not supplementary',
    notQ: 'the measures of the two angles do not add to 180 degrees',
    conditional: true,
    converse: true,
    inverse: true,
    contrapositive: true,
    counterexamples: {},
    situations: [
      sit('supp-tt', 'Angle 1 measures 40 degrees and angle 2 measures 140 degrees.', true, true),
      sit('supp-ff', 'Angle 1 measures 40 degrees and angle 2 measures 50 degrees.', false, false),
    ],
    scene: 'angles',
  },
  {
    id: 'right-measure',
    title: 'A right angle measures 90',
    p: 'an angle is a right angle',
    q: 'the angle measures 90 degrees',
    notP: 'an angle is not a right angle',
    notQ: 'the angle does not measure 90 degrees',
    conditional: true,
    converse: true,
    inverse: true,
    contrapositive: true,
    counterexamples: {},
    situations: [
      sit('rm-tt', 'Angle 1 is a right angle, so it measures 90 degrees.', true, true),
      sit('rm-ff', 'Angle 1 measures 40 degrees.', false, false),
    ],
    scene: 'angles',
  },
  {
    id: 'perpendicular-right',
    title: 'Perpendicular lines form a right angle',
    p: 'two lines are perpendicular',
    q: 'the two lines intersect to form a right angle',
    notP: 'two lines are not perpendicular',
    notQ: 'the two lines do not intersect to form a right angle',
    conditional: true,
    converse: true,
    inverse: true,
    contrapositive: true,
    counterexamples: {},
    situations: [
      sit('perp-tt', 'Line AB is perpendicular to line CD, and they meet in a right angle.', true, true),
      sit('perp-ff', 'Line AB and line CD meet in a 40 degree angle.', false, false),
    ],
    scene: 'lines',
  },
  {
    id: 'congruent-angles',
    title: 'Congruent angles have the same measure',
    p: 'two angles are congruent',
    q: 'the two angles have the same measure',
    notP: 'two angles are not congruent',
    notQ: 'the two angles do not have the same measure',
    conditional: true,
    converse: true,
    inverse: true,
    contrapositive: true,
    counterexamples: {},
    situations: [
      sit('ca-tt', 'Angle 1 and angle 2 are congruent, and both measure 40 degrees.', true, true),
      sit('ca-ff', 'Angle 1 measures 30 degrees and angle 2 measures 50 degrees.', false, false),
    ],
    scene: 'angles',
  },
  {
    id: 'congruent-segments',
    title: 'Congruent segments have the same length',
    p: 'two segments are congruent',
    q: 'the two segments have the same length',
    notP: 'two segments are not congruent',
    notQ: 'the two segments do not have the same length',
    conditional: true,
    converse: true,
    inverse: true,
    contrapositive: true,
    counterexamples: {},
    situations: [
      sit('cs-tt', 'Segment AB is congruent to segment CD, and both are 5 units long.', true, true),
      sit('cs-ff', 'Segment AB is 5 units long and segment CD is 8 units long.', false, false),
    ],
    scene: 'collinear',
  },
  {
    id: 'acute-not-obtuse',
    title: 'An acute angle is not obtuse',
    p: 'an angle is acute',
    q: 'the angle is not obtuse',
    notP: 'an angle is not acute',
    notQ: 'the angle is obtuse',
    conditional: true,
    converse: false,
    inverse: false,
    contrapositive: true,
    counterexamples: {
      converse: ce('acute-ft', 'Angle 1 measures 90 degrees.', false, true),
      inverse: ce('acute-ft', 'Angle 1 measures 90 degrees.', false, true),
    },
    situations: [
      sit('acute-tt', 'Angle 1 measures 40 degrees.', true, true),
      sit('acute-ff', 'Angle 1 measures 120 degrees.', false, false),
    ],
    scene: 'angles',
  },
  {
    id: 'complementary-acute',
    title: 'Complementary angles are acute',
    p: 'two angles are complementary',
    q: 'each of the two angles is acute',
    notP: 'two angles are not complementary',
    notQ: 'the two angles are not both acute',
    conditional: true,
    converse: false,
    inverse: false,
    contrapositive: true,
    counterexamples: {
      converse: ce('ca2-ft', 'Angle 1 measures 30 degrees and angle 2 measures 40 degrees.', false, true),
      inverse: ce('ca2-ft', 'Angle 1 measures 30 degrees and angle 2 measures 40 degrees.', false, true),
    },
    situations: [
      sit('ca2-tt', 'Angle 1 measures 30 degrees and angle 2 measures 60 degrees.', true, true),
      sit('ca2-ff', 'Angle 1 measures 100 degrees and angle 2 measures 80 degrees.', false, false),
    ],
    scene: 'angles',
  },
  {
    id: 'collinear-between',
    title: 'Three collinear points have one between the others',
    p: 'A, B, and C are three distinct collinear points',
    q: 'one of the three points is between the other two',
    notP: 'A, B, and C are not three distinct collinear points',
    notQ: 'none of the three points is between the other two',
    conditional: true,
    converse: true,
    inverse: true,
    contrapositive: true,
    counterexamples: {},
    situations: [
      sit('col-tt', 'A, B, and C lie on one line, with B between A and C.', true, true),
      sit('col-ff', 'A, B, and C are the three vertices of a triangle.', false, false),
    ],
    scene: 'collinear',
  },
  {
    id: 'bisector-congruent',
    title: 'An angle bisector makes congruent angles',
    p: 'ray BD bisects angle ABC',
    q: 'angle ABD is congruent to angle DBC',
    notP: 'ray BD does not bisect angle ABC',
    notQ: 'angle ABD is not congruent to angle DBC',
    conditional: true,
    converse: true,
    inverse: true,
    contrapositive: true,
    counterexamples: {},
    situations: [
      sit('bis-tt', 'Ray BD bisects angle ABC, and the two pieces measure 20 degrees each.', true, true),
      sit('bis-ff', 'Ray BD splits angle ABC into a 20 degree angle and a 30 degree angle.', false, false),
    ],
    scene: 'ray',
  },
  {
    id: 'linear-adjacent',
    title: 'A linear pair is adjacent',
    p: 'two angles form a linear pair',
    q: 'the two angles are adjacent',
    notP: 'two angles do not form a linear pair',
    notQ: 'the two angles are not adjacent',
    conditional: true,
    converse: false,
    inverse: false,
    contrapositive: true,
    counterexamples: {
      converse: ce('adj-ft', 'Angle ABD and angle DBC share ray BD and together make a 70 degree angle, not a straight line.', false, true),
      inverse: ce('adj-ft', 'Angle ABD and angle DBC share ray BD and together make a 70 degree angle, not a straight line.', false, true),
    },
    situations: [
      sit('adj-tt', 'Angle 1 and angle 2 are next to each other and form a straight line.', true, true),
      sit('adj-ff', 'Angle 1 and angle 2 are opposite angles formed by two crossing lines.', false, false),
    ],
    scene: 'adjacent',
  },
  {
    id: 'saturday-school',
    title: 'Saturday means no school',
    p: 'it is Saturday',
    q: 'there is no school',
    notP: 'it is not Saturday',
    notQ: 'there is school',
    conditional: true,
    converse: false,
    inverse: false,
    contrapositive: true,
    counterexamples: {
      converse: ce('sat-ft', 'It is Sunday, and there is no school.', false, true),
      inverse: ce('sat-ft', 'It is Sunday, and there is no school.', false, true),
    },
    situations: [
      sit('sat-tt', 'It is Saturday, and there is no school.', true, true),
      sit('sat-ff', 'It is Wednesday, and there is school.', false, false),
    ],
    scene: 'life',
  },
  {
    id: 'rain-wet',
    title: 'Rain makes the ground wet',
    p: 'it is raining',
    q: 'the ground is wet',
    notP: 'it is not raining',
    notQ: 'the ground is dry',
    conditional: true,
    converse: false,
    inverse: false,
    contrapositive: true,
    counterexamples: {
      converse: ce('rain-ft', 'The sprinkler is on, so the ground is wet, and it is not raining.', false, true),
      inverse: ce('rain-ft', 'The sprinkler is on, so the ground is wet, and it is not raining.', false, true),
    },
    situations: [
      sit('rain-tt', 'It is raining, and the ground is wet.', true, true),
      sit('rain-ff', 'It is sunny, and the ground is dry.', false, false),
    ],
    scene: 'life',
  },
  {
    id: 'congruent-means-right',
    title: 'Congruent angles need not be right angles',
    p: 'two angles are congruent',
    q: 'the two angles are right angles',
    notP: 'two angles are not congruent',
    notQ: 'the two angles are not both right angles',
    conditional: false,
    converse: true,
    inverse: true,
    contrapositive: false,
    counterexamples: {
      conditional: ce('cmr-tf', 'Angle 1 and angle 2 both measure 40 degrees.', true, false),
      contrapositive: ce('cmr-tf', 'Angle 1 and angle 2 both measure 40 degrees.', true, false),
    },
    situations: [
      sit('cmr-tt', 'Angle 1 and angle 2 both measure 90 degrees.', true, true),
      sit('cmr-ff', 'Angle 1 measures 30 degrees and angle 2 measures 50 degrees.', false, false),
    ],
    scene: 'angles',
  },
  {
    id: 'complementary-means-supplementary',
    title: 'Complementary is not supplementary',
    p: 'two angles are complementary',
    q: 'the two angles are supplementary',
    notP: 'two angles are not complementary',
    notQ: 'the two angles are not supplementary',
    conditional: false,
    converse: false,
    inverse: false,
    contrapositive: false,
    counterexamples: {
      conditional: ce('cms-tf', 'Angle 1 measures 30 degrees and angle 2 measures 60 degrees.', true, false),
      converse: ce('cms-ft', 'Angle 1 measures 100 degrees and angle 2 measures 80 degrees.', false, true),
      inverse: ce('cms-ft', 'Angle 1 measures 100 degrees and angle 2 measures 80 degrees.', false, true),
      contrapositive: ce('cms-tf', 'Angle 1 measures 30 degrees and angle 2 measures 60 degrees.', true, false),
    },
    situations: [
      sit('cms-ff', 'Angle 1 measures 20 degrees and angle 2 measures 30 degrees.', false, false),
    ],
    scene: 'angles',
  },
]

/** Chains whose two implications are both true, so detachment and syllogism have something honest to use. */
export const LAW_CHAINS: readonly LawChain[] = [
  {
    id: 'vertical-chain',
    p: 'two angles are vertical angles',
    q: 'the two angles are congruent',
    r: 'the two angles have the same measure',
    notP: 'two angles are not vertical angles',
    notQ: 'the two angles are not congruent',
    notR: 'the two angles do not have the same measure',
    scene: 'vertical',
  },
  {
    id: 'linear-chain',
    p: 'two angles form a linear pair',
    q: 'the two angles are supplementary',
    r: 'the measures of the two angles add to 180 degrees',
    notP: 'two angles do not form a linear pair',
    notQ: 'the two angles are not supplementary',
    notR: 'the measures of the two angles do not add to 180 degrees',
    scene: 'linear',
  },
  {
    id: 'midpoint-chain',
    p: 'M is the midpoint of AB',
    q: 'AM equals MB',
    r: 'segment AM is congruent to segment MB',
    notP: 'M is not the midpoint of AB',
    notQ: 'AM does not equal MB',
    notR: 'segment AM is not congruent to segment MB',
    scene: 'midpoint',
  },
  {
    id: 'bisector-chain',
    p: 'ray BD bisects angle ABC',
    q: 'angle ABD is congruent to angle DBC',
    r: 'angle ABD and angle DBC have the same measure',
    notP: 'ray BD does not bisect angle ABC',
    notQ: 'angle ABD is not congruent to angle DBC',
    notR: 'angle ABD and angle DBC do not have the same measure',
    scene: 'ray',
  },
  {
    id: 'saturday-chain',
    p: 'it is Saturday',
    q: 'there is no school',
    r: 'the school bell does not ring',
    notP: 'it is not Saturday',
    notQ: 'there is school',
    notR: 'the school bell rings',
    scene: 'life',
  },
  {
    id: 'rain-chain',
    p: 'it is raining',
    q: 'the ground is wet',
    r: 'the sidewalk is dark',
    notP: 'it is not raining',
    notQ: 'the ground is dry',
    notR: 'the sidewalk is not dark',
    scene: 'life',
  },
]

export function statementOf(entry: BankEntry, form: LogicForm): string {
  switch (form) {
    case 'conditional':
      return `If ${entry.p}, then ${entry.q}.`
    case 'converse':
      return `If ${entry.q}, then ${entry.p}.`
    case 'inverse':
      return `If ${entry.notP}, then ${entry.notQ}.`
    case 'contrapositive':
      return `If ${entry.notQ}, then ${entry.notP}.`
  }
}

export function biconditionalOf(entry: BankEntry): string {
  const head = entry.p.charAt(0).toUpperCase() + entry.p.slice(1)
  return `${head} if and only if ${entry.q}.`
}

/** A contrapositive attempt that negates only one part. */
export function halfNegation(entry: BankEntry, which: 0 | 1): string {
  return which === 0 ? `If ${entry.notQ}, then ${entry.p}.` : `If ${entry.notP}, then ${entry.q}.`
}

/** Hypothesis and conclusion of a related form, in terms of the original p and q. */
export function formAtoms(form: LogicForm, p: boolean, q: boolean): { hyp: boolean; conc: boolean } {
  switch (form) {
    case 'conditional':
      return { hyp: p, conc: q }
    case 'converse':
      return { hyp: q, conc: p }
    case 'inverse':
      return { hyp: !p, conc: !q }
    case 'contrapositive':
      return { hyp: !q, conc: !p }
  }
}

export function formTruth(entry: BankEntry, form: LogicForm): boolean {
  return entry[form]
}

export function biconditionalTruth(entry: BankEntry): boolean {
  return entry.conditional && entry.converse
}

export function situationPool(entry: BankEntry): Situation[] {
  const out: Situation[] = []
  const seen = new Set<string>()
  const add = (situation: Situation) => {
    if (seen.has(situation.text)) return
    seen.add(situation.text)
    out.push(situation)
  }
  for (const situation of entry.situations) add(situation)
  for (const form of LOGIC_FORMS) {
    const counter = entry.counterexamples[form]
    if (counter) add(counter)
  }
  return out
}

export function isCounterexample(form: LogicForm, situation: Situation): boolean {
  const atoms = formAtoms(form, situation.p, situation.q)
  return atoms.hyp && !atoms.conc
}

/** What is wrong with this entry, if anything. Empty means the bank row is logically consistent. */
export function auditEntry(entry: BankEntry): string[] {
  const errors: string[] = []
  if (!entry.p.trim() || !entry.q.trim() || !entry.notP.trim() || !entry.notQ.trim()) errors.push('a clause is empty')
  if (entry.notP.trim() === entry.p.trim()) errors.push('notP copies p')
  if (entry.notQ.trim() === entry.q.trim()) errors.push('notQ copies q')
  if (entry.contrapositive !== entry.conditional) errors.push('contrapositive does not match the conditional')
  if (entry.inverse !== entry.converse) errors.push('inverse does not match the converse')
  const texts = new Set<string>()
  for (const form of LOGIC_FORMS) {
    const sentence = statementOf(entry, form)
    if (texts.has(sentence)) errors.push(`duplicate wording for ${form}`)
    texts.add(sentence)
    const counter = entry.counterexamples[form]
    if (entry[form]) {
      if (counter) errors.push(`${form} is true but has a counterexample`)
    } else if (!counter) {
      errors.push(`${form} is false and has no counterexample`)
    } else {
      const atoms = formAtoms(form, counter.p, counter.q)
      if (!atoms.hyp || atoms.conc) errors.push(`${form} counterexample does not make the hypothesis true and the conclusion false`)
    }
  }
  const pool = situationPool(entry)
  for (const form of LOGIC_FORMS) {
    if (entry[form]) {
      for (const situation of pool) {
        if (isCounterexample(form, situation)) errors.push(`${situation.id} counters the true ${form}`)
      }
    }
    if (!pool.some((situation) => !formAtoms(form, situation.p, situation.q).hyp)) {
      errors.push(`${form} has no situation that misses the hypothesis`)
    }
  }
  return errors
}

export function auditBank(entries: readonly BankEntry[] = STATEMENT_BANK): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const entry of entries) {
    if (ids.has(entry.id)) errors.push(`duplicate id ${entry.id}`)
    ids.add(entry.id)
    for (const error of auditEntry(entry)) errors.push(`${entry.id}: ${error}`)
  }
  return errors
}

const pt = (id: string, x: number, y: number, label: string | undefined, labelSide: NonNullable<GeoFigureSpec['points'][number]['labelSide']>) => ({
  id,
  x,
  y,
  ...(label ? { label } : {}),
  labelSide,
})

/** A small figure for a geometry statement. Everyday statements get no points, so the screen skips the picture. */
export function sceneFigure(scene: LogicScene, aria: string): GeoFigureSpec {
  if (scene === 'life') return { points: [], ariaLabel: aria }
  if (scene === 'vertical') {
    return {
      ariaLabel: aria,
      points: [
        pt('A', -3, 0, 'A', 'left'),
        pt('B', 3, 0, 'B', 'right'),
        pt('C', 0, 2.4, 'C', 'above'),
        pt('D', 0, -2.4, 'D', 'below'),
        pt('O', 0, 0, undefined, 'above'),
      ],
      lines: [
        { through: ['A', 'B'] },
        { through: ['C', 'D'] },
      ],
      angles: [
        { vertex: 'O', from: 'A', to: 'C', label: '1' },
        { vertex: 'O', from: 'B', to: 'D', label: '2' },
      ],
    }
  }
  if (scene === 'linear' || scene === 'adjacent') {
    return {
      ariaLabel: aria,
      points: [
        pt('A', -3, 0, 'A', 'left'),
        pt('B', 0, 0, 'B', 'below'),
        pt('C', 3, 0, 'C', 'right'),
        pt('D', 1.2, 2.2, 'D', 'above'),
      ],
      segments: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
      ],
      rays: [{ from: 'B', through: 'D' }],
      angles: [
        { vertex: 'B', from: 'A', to: 'D', label: '1' },
        { vertex: 'B', from: 'D', to: 'C', label: '2', radius: 28 },
      ],
    }
  }
  if (scene === 'midpoint' || scene === 'collinear') {
    return {
      ariaLabel: aria,
      points: [
        pt('A', 0, 0, 'A', 'below'),
        pt('M', 2, 0, 'M', 'below'),
        pt('B', 4, 0, 'B', 'below'),
      ],
      segments: [
        { from: 'A', to: 'M', ticks: 1, labelSide: 'above' },
        { from: 'M', to: 'B', ticks: 1, labelSide: 'above' },
      ],
    }
  }
  if (scene === 'ray') {
    return {
      ariaLabel: aria,
      points: [
        pt('A', -2.4, 0.2, 'A', 'left'),
        pt('B', 0, 0, 'B', 'below'),
        pt('C', 2.6, 0.4, 'C', 'right'),
        pt('D', 0.4, 2.4, 'D', 'above'),
      ],
      rays: [
        { from: 'B', through: 'A' },
        { from: 'B', through: 'C' },
        { from: 'B', through: 'D' },
      ],
      angles: [
        { vertex: 'B', from: 'A', to: 'D', label: '1' },
        { vertex: 'B', from: 'D', to: 'C', label: '2', radius: 26 },
      ],
    }
  }
  if (scene === 'lines') {
    return {
      ariaLabel: aria,
      points: [
        pt('A', -2.6, -1.4, 'A', 'left'),
        pt('B', 2.6, 1.4, 'B', 'right'),
        pt('C', -2.2, 1.6, 'C', 'above'),
        pt('D', 2.2, -1.6, 'D', 'below'),
        pt('E', 0, 0, 'E', 'below-right'),
      ],
      lines: [
        { through: ['A', 'B'] },
        { through: ['C', 'D'] },
      ],
      angles: [{ vertex: 'E', from: 'B', to: 'C', label: '1' }],
    }
  }
  return {
    ariaLabel: aria,
    points: [
      pt('A', -2.2, 0, 'A', 'left'),
      pt('B', 0, 0, 'B', 'below'),
      pt('C', 2.4, 1.6, 'C', 'above'),
    ],
    rays: [
      { from: 'B', through: 'A' },
      { from: 'B', through: 'C' },
    ],
    angles: [{ vertex: 'B', from: 'A', to: 'C', label: '1' }],
  }
}
