/**
 * Exact evaluation of a significant-figures task: the un-rounded value, what limits the answer,
 * the canonical expected answer, and a short explanation a student can read.
 *
 * Invalid TASKS are generator bugs and throw SigFigTaskError (validateSigFigTask catches it).
 * Student input is never handled here; see grade.ts.
 */
import type {
  SigFigEvaluation,
  SigFigExpected,
  SigFigGroup,
  SigFigIntermediate,
  SigFigLimit,
  SigFigNumeral,
  SigFigOp,
  SigFigOperand,
  SigFigTask,
  SigFigTaskIssue,
  SigFigTerm,
} from '@/shared/types'
import {
  decToMinimalPlain,
  decToPlain,
  digitCount,
  minimalDec,
  ratAdd,
  ratDiv,
  ratFirstPlace,
  ratFromDec,
  ratIsZero,
  ratMul,
  ratSub,
  ratToDisplay,
  roundRatToPlace,
  roundRatToSigFigs,
  scientificText,
  standardText,
  type Rat,
  type RoundedRat,
} from './decimal'
import { figuresPhrase, joinList, sigFigPlaceName } from './format'
import { mustParseSigFig, parseSigFigNumeral, sigFigDec } from './parse'
import { canonicalForms, endsInSignificantZero } from './round'

export type SigFigFamily = 'muldiv' | 'addsub'

export class SigFigTaskError extends Error {
  code: SigFigTaskIssue['code']
  constructor(message: string, code: SigFigTaskIssue['code'] = 'invalid') {
    super(`sig figs task: ${message}`)
    this.name = 'SigFigTaskError'
    this.code = code
  }
}

export interface TermInfo {
  term: SigFigTerm
  numeral: SigFigNumeral
  value: Rat
  exact: boolean
  /** Index in reading order across the whole task. */
  flatIndex: number
}

/** A term or a finished group, as one operand of a chain. */
export interface Quantity {
  value: Rat
  exact: boolean
  /** Figures and last reliable place (unused when exact). */
  sigFigs: number
  place: number
  label: string
  /** Flat indices of the terms that set this operand's precision. */
  limitingTerms: number[]
}

export interface ChainOutcome {
  family: SigFigFamily
  value: Rat
  /** Every operand was exact: nothing limits the result. */
  exact: boolean
  /** muldiv: fewest figures among the measured operands. */
  sigFigs?: number
  /** addsub: least precise place among the measured operands. */
  place?: number
  /** Positions (in the operand list) of the operands that set the limit. */
  limiting: number[]
}

export interface GroupAnalysis {
  operandIndex: number
  family: SigFigFamily
  terms: TermInfo[]
  ops: SigFigOp[]
  outcome: ChainOutcome
  /** The group rounded to its own precision (used for counting figures and for display only). */
  rounded: RoundedRat
  quantity: Quantity
  /** Rounding the intermediate carried into a new digit, so its figure count is debatable. */
  carried: boolean
}

export interface SigFigAnalysis {
  task: SigFigTask
  terms: TermInfo[]
  /** Outer chain (calculation tasks only). */
  family?: SigFigFamily
  operands?: Quantity[]
  ops?: SigFigOp[]
  groups: GroupAnalysis[]
  exactValue: Rat
  rounded: RoundedRat
  evaluation: SigFigEvaluation
}

const OP_SIGN: Record<SigFigOp, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' }

export function familyOfOps(ops: SigFigOp[]): SigFigFamily | null {
  if (ops.length === 0) return null
  if (ops.every((o) => o === '*' || o === '/')) return 'muldiv'
  if (ops.every((o) => o === '+' || o === '-')) return 'addsub'
  return null
}

function isGroup(operand: SigFigOperand): operand is SigFigGroup {
  return 'terms' in operand
}

/** The task's numbers in reading order (groups flattened): the indices `SigFigLimit.termIndices` uses. */
export function sigFigTaskTerms(task: SigFigTask): SigFigTerm[] {
  switch (task.kind) {
    case 'count':
    case 'round':
    case 'convert':
      return [{ text: task.text }]
    case 'muldiv':
    case 'addsub':
      return task.terms
    case 'mixed':
      return task.operands.flatMap((o) => (isGroup(o) ? o.terms : [o]))
  }
}

function termInfo(term: SigFigTerm, flatIndex: number): TermInfo {
  const parsed = parseSigFigNumeral(term.text)
  if (!parsed.ok) throw new SigFigTaskError(`cannot read "${term.text}": ${parsed.error.message}`)
  return {
    term,
    numeral: parsed.numeral,
    value: ratFromDec(sigFigDec(parsed.numeral)),
    exact: term.exact === true,
    flatIndex,
  }
}

function termQuantity(t: TermInfo): Quantity {
  return {
    value: t.value,
    exact: t.exact,
    sigFigs: t.numeral.sigFigs,
    place: t.numeral.lastSigPlace,
    label: t.numeral.display,
    limitingTerms: [t.flatIndex],
  }
}

/** Left-to-right exact evaluation of one family of operations, and what limits it. */
export function runChain(operands: Quantity[], ops: SigFigOp[], family: SigFigFamily): ChainOutcome {
  if (operands.length < 2) throw new SigFigTaskError('a calculation needs at least two numbers')
  if (ops.length !== operands.length - 1) throw new SigFigTaskError('ops must be one shorter than the numbers')
  if (familyOfOps(ops) !== family) throw new SigFigTaskError(`every operation of a ${family} chain must be of that kind`)
  let value = operands[0].value
  ops.forEach((op, i) => {
    const b = operands[i + 1].value
    if (op === '/' && ratIsZero(b)) throw new SigFigTaskError('division by zero')
    value = op === '+' ? ratAdd(value, b) : op === '-' ? ratSub(value, b) : op === '*' ? ratMul(value, b) : ratDiv(value, b)
  })
  const measured = operands.map((q, i) => ({ q, i })).filter(({ q }) => !q.exact)
  if (measured.length === 0) return { family, value, exact: true, limiting: [] }
  if (family === 'muldiv') {
    if (measured.some(({ q }) => q.sigFigs < 1))
      throw new SigFigTaskError('a measured zero has no significant figures, so it cannot be a factor')
    const sigFigs = Math.min(...measured.map(({ q }) => q.sigFigs))
    return { family, value, exact: false, sigFigs, limiting: measured.filter(({ q }) => q.sigFigs === sigFigs).map(({ i }) => i) }
  }
  const place = Math.max(...measured.map(({ q }) => q.place))
  return { family, value, exact: false, place, limiting: measured.filter(({ q }) => q.place === place).map(({ i }) => i) }
}

/** Round a chain's exact value to the precision its limit allows. */
export function roundOutcome(outcome: ChainOutcome): RoundedRat {
  if (outcome.exact) throw new SigFigTaskError('every number is exact, so nothing limits the answer')
  if (outcome.family === 'muldiv') {
    if (ratIsZero(outcome.value)) throw new SigFigTaskError('the product is zero')
    return roundRatToSigFigs(outcome.value, outcome.sigFigs as number)
  }
  return roundRatToPlace(outcome.value, outcome.place as number)
}

function termLabel(t: TermInfo, first: boolean): string {
  return !first && t.numeral.negative ? `(${t.numeral.display})` : t.numeral.display
}

function chainExpression(labels: string[], ops: SigFigOp[]): string {
  return labels.map((l, i) => (i === 0 ? l : `${OP_SIGN[ops[i - 1]]} ${l}`)).join(' ')
}

/** "12.50 ÷ 4.1", "(12.11 + 1.3) ÷ 2.0"; the numeral itself for count / round / convert. */
export function sigFigTaskExpression(task: SigFigTask): string {
  switch (task.kind) {
    case 'count':
    case 'round':
    case 'convert':
      return mustParseSigFig(task.text).display
    case 'muldiv':
    case 'addsub':
      return chainExpression(
        task.terms.map((t, i) => termLabel(termInfo(t, i), i === 0)),
        task.ops,
      )
    case 'mixed':
      return chainExpression(
        task.operands.map((o, i) => {
          if (!isGroup(o)) return termLabel(termInfo(o, 0), i === 0)
          const inner = chainExpression(
            o.terms.map((t, j) => termLabel(termInfo(t, 0), j === 0)),
            o.ops,
          )
          return familyOfOps(o.ops) === 'addsub' ? `(${inner})` : inner
        }),
        task.ops,
      )
  }
}

// ---------------------------------------------------------------------------
// Explanation sentences
// ---------------------------------------------------------------------------

function haveHas(n: number): string {
  return n === 1 ? 'has' : 'have'
}

function limitSentence(family: SigFigFamily, labels: string[], sigFigs: number, place: number): string {
  const who = joinList(labels)
  return family === 'muldiv'
    ? `${who} ${haveHas(labels.length)} the fewest significant figures (${sigFigs}).`
    : `${who} ${labels.length === 1 ? 'is' : 'are'} the least precise: ${labels.length === 1 ? 'it stops' : 'they stop'} at the ${sigFigPlaceName(place)} place.`
}

function termFactSentences(terms: TermInfo[], family: SigFigFamily): string[] {
  const measured = terms.filter((t) => !t.exact)
  const out: string[] = []
  if (measured.length > 0) {
    out.push(
      measured
        .map((t) =>
          family === 'muldiv'
            ? `${t.numeral.display} has ${figuresPhrase(t.numeral.sigFigs)}`
            : `${t.numeral.display} stops at the ${sigFigPlaceName(t.numeral.lastSigPlace)} place`,
        )
        .join('; ') + '.',
    )
  }
  for (const t of terms.filter((x) => x.exact)) {
    out.push(
      `${t.numeral.display} is an exact number${t.term.note ? ` (${t.term.note})` : ''}: it has unlimited significant figures and never limits the answer.`,
    )
  }
  return out
}

/** How the final value is rounded and written. `target` reads "2 significant figures" or "the tenths place". */
function roundingSentences(unrounded: string, r: RoundedRat, target: string, forms: { text: string; display: string }): string[] {
  const out: string[] = []
  const placeName = sigFigPlaceName(r.place)
  if (r.direction === 'exact') {
    out.push(`${unrounded} written to ${target} is ${forms.display}: nothing has to be dropped.`)
  } else {
    const verdict =
      r.firstDropped >= 5
        ? `${r.firstDropped}, which is 5 or more, so the last kept digit goes up`
        : `${r.firstDropped}, which is less than 5, so the kept digits stay as they are`
    out.push(`Round to ${target}: the first dropped digit is ${verdict}. That gives ${forms.display}.`)
  }
  if (r.carried) out.push('Rounding up carried into a new digit, so the figures are counted again from the new first digit.')
  if (r.m === 0n) return out
  const standard = standardText(r.m, r.place)
  const figures = digitCount(r.m)
  if (standard === null) {
    const plain = decToPlain({ int: r.m, exp: r.place })
    // No decimal point, so it reads as the digits in front of the trailing zeros. Counted arithmetically:
    // the evaluator must not depend on the parser's input limits to describe its own output.
    const reads = digitCount(minimalDec({ int: r.m, exp: r.place }).int)
    out.push(
      `Written as ${plain} it would read as only ${figuresPhrase(reads)}, so scientific notation is the clear way to show ${figures}.`,
    )
  } else if (r.place === 0 && endsInSignificantZero(r.m)) {
    out.push('The decimal point written at the end shows that the zeros in front of it are significant.')
  } else if (r.place > 0) {
    out.push('The zeros that fill the dropped places are placeholders: they keep the number the same size and are not significant.')
  } else if (r.place < 0 && endsInSignificantZero(r.m)) {
    out.push(`Keep the final zero: it shows the answer is good to the ${placeName} place.`)
  }
  return out
}

function countSteps(n: SigFigNumeral): string[] {
  const digits = n.chars.filter((c) => c.digit)
  const tally = (role: string): number => digits.filter((c) => c.role === role).length
  const out: string[] = []
  const leading = tally('leading_zero')
  const captive = tally('captive_zero')
  const trailingDec = tally('trailing_zero_decimal')
  const placeholder = tally('trailing_zero_placeholder')
  const nonzero = digits.filter((c) => c.role === 'nonzero').map((c) => c.ch)
  const s = (k: number): string => (k === 1 ? '' : 's')
  if (leading > 0) out.push(`The ${leading} leading zero${s(leading)} only place${leading === 1 ? 's' : ''} the decimal point: not significant.`)
  out.push(`The nonzero digit${s(nonzero.length)} (${nonzero.join(', ')}) always count${nonzero.length === 1 ? 's' : ''}.`)
  if (captive > 0) out.push(`The ${captive} zero${s(captive)} between significant digits count${captive === 1 ? 's' : ''} too.`)
  if (trailingDec > 0) out.push(`A decimal point is written, so the ${trailingDec} trailing zero${s(trailingDec)} ${trailingDec === 1 ? 'was' : 'were'} measured: significant.`)
  if (placeholder > 0) out.push(`No decimal point is written, so the ${placeholder} trailing zero${s(placeholder)} ${placeholder === 1 ? 'is a placeholder' : 'are placeholders'}: not significant.`)
  if (n.scientific) out.push('The power of ten only sets the size of the number; it never changes the count.')
  out.push(`Total: ${figuresPhrase(n.sigFigs)} (${n.sigDigits.split('').join(', ')}).`)
  return out
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

function expectedFrom(r: RoundedRat, forms: { text: string; display: string; alternates: string[] }): SigFigExpected {
  return {
    text: forms.text,
    display: forms.display,
    alternates: forms.alternates,
    value: decToMinimalPlain({ int: r.m, exp: r.place }),
    sigFigs: r.m === 0n ? 0 : digitCount(r.m),
    place: r.place,
  }
}

function displayFigures(target: number): number {
  return Math.max(12, target + 6)
}

function analyseSingle(task: Extract<SigFigTask, { kind: 'count' | 'round' | 'convert' }>): SigFigAnalysis {
  const info = termInfo({ text: task.text }, 0)
  const n = info.numeral
  const base = { task, terms: [info], groups: [], exactValue: info.value }
  const expression = n.display

  if (task.kind === 'count') {
    if (n.isZero) throw new SigFigTaskError('a zero has no significant figures to count')
    const rounded = roundRatToPlace(info.value, n.lastSigPlace)
    const text = String(n.sigFigs)
    const limit: SigFigLimit = {
      rule: 'count',
      termIndices: [0],
      sigFigs: n.sigFigs,
      place: n.lastSigPlace,
      placeName: sigFigPlaceName(n.lastSigPlace),
      text: `${n.display} has ${figuresPhrase(n.sigFigs)}.`,
    }
    return {
      ...base,
      rounded,
      evaluation: {
        task,
        expression,
        unrounded: n.value,
        unroundedTerminates: true,
        limit,
        expected: { text, display: text, alternates: [], value: text, sigFigs: n.sigFigs, place: n.lastSigPlace },
        tie: false,
        rounding: 'exact',
        intermediates: [],
        steps: countSteps(n),
      },
    }
  }

  if (task.kind === 'round') {
    const bySigFigs = task.sigFigs !== undefined
    if (bySigFigs === (task.place !== undefined)) throw new SigFigTaskError('a round task needs exactly one of sigFigs or place')
    let rounded: RoundedRat
    if (bySigFigs) {
      const want = task.sigFigs as number
      if (!Number.isInteger(want) || want < 1) throw new SigFigTaskError(`cannot round to ${want} significant figures`)
      if (n.isZero) throw new SigFigTaskError('zero cannot be rounded to significant figures')
      rounded = roundRatToSigFigs(info.value, want)
    } else {
      if (!Number.isInteger(task.place)) throw new SigFigTaskError(`bad place ${task.place}`)
      rounded = roundRatToPlace(info.value, task.place as number)
    }
    const forms = canonicalForms(rounded.m, rounded.place)
    const expected = expectedFrom(rounded, forms)
    const placeName = sigFigPlaceName(rounded.place)
    const target = bySigFigs ? figuresPhrase(task.sigFigs as number) : `the ${placeName} place`
    const steps: string[] = []
    if (bySigFigs) {
      steps.push(
        `Start counting at the first nonzero digit of ${n.display}. Keeping ${figuresPhrase(task.sigFigs as number)} means the last digit you keep is in the ${sigFigPlaceName(ratFirstPlace(info.value) - (task.sigFigs as number) + 1)} place.`,
      )
    }
    steps.push(...roundingSentences(n.display, rounded, target, forms))
    const limit: SigFigLimit = {
      rule: 'round',
      termIndices: [0],
      sigFigs: expected.sigFigs,
      place: rounded.place,
      placeName,
      text: `The question asks for ${target}.`,
    }
    return {
      ...base,
      rounded,
      evaluation: {
        task,
        expression,
        unrounded: n.value,
        unroundedTerminates: true,
        limit,
        expected,
        tie: rounded.tie,
        rounding: rounded.direction,
        intermediates: [],
        steps,
      },
    }
  }

  // convert
  if (n.isZero) throw new SigFigTaskError('zero has no scientific notation worth practising')
  const digits = BigInt(n.sigDigits)
  const m = n.negative ? -digits : digits
  const rounded = roundRatToPlace(info.value, n.lastSigPlace)
  const placeName = sigFigPlaceName(n.lastSigPlace)
  let text: string
  const steps: string[] = []
  if (task.to === 'scientific') {
    text = scientificText(m, n.lastSigPlace)
    const power = n.firstSigPlace
    const coefficient = text.split(' x ')[0].replace('-', '−')
    steps.push(`Move the decimal point until exactly one nonzero digit is in front of it: ${coefficient}.`)
    steps.push(
      power === 0
        ? 'The point did not have to move, so the power of ten is 0.'
        : power > 0
          ? `The point moved ${power} place${power === 1 ? '' : 's'} to the left (a big number), so the power of ten is +${power}.`
          : `The point moved ${-power} place${power === -1 ? '' : 's'} to the right (a small number), so the power of ten is −${-power}.`,
    )
  } else {
    const standard = standardText(m, n.lastSigPlace)
    if (standard === null)
      throw new SigFigTaskError(
        `standard notation cannot show the ${figuresPhrase(n.sigFigs)} of ${n.text}`,
        'not_representable',
      )
    text = standard
    const e = n.exponent
    steps.push(
      e === 0
        ? 'The power of ten is 0, so the decimal point stays where it is.'
        : e > 0
          ? `× 10 to the +${e} means move the decimal point ${e} place${e === 1 ? '' : 's'} to the right, filling empty places with zeros.`
          : `× 10 to the −${-e} means move the decimal point ${-e} place${e === -1 ? '' : 's'} to the left, filling empty places with zeros.`,
    )
  }
  const display = mustParseSigFig(text).display
  steps.push(`Keep the same ${figuresPhrase(n.sigFigs)} (${n.sigDigits.split('').join(', ')}): ${display}.`)
  const limit: SigFigLimit = {
    rule: 'convert',
    termIndices: [0],
    sigFigs: n.sigFigs,
    place: n.lastSigPlace,
    placeName,
    text: `${n.display} has ${figuresPhrase(n.sigFigs)}, and converting never changes that.`,
  }
  return {
    ...base,
    rounded,
    evaluation: {
      task,
      expression,
      unrounded: n.value,
      unroundedTerminates: true,
      limit,
      expected: { text, display, alternates: [], value: n.value, sigFigs: n.sigFigs, place: n.lastSigPlace },
      tie: false,
      rounding: 'exact',
      intermediates: [],
      steps,
    },
  }
}

function analyseGroup(group: SigFigGroup, operandIndex: number, outer: SigFigFamily, firstFlat: number): GroupAnalysis {
  const family = familyOfOps(group.ops)
  if (family === null) throw new SigFigTaskError('a group must use one kind of operation')
  if (family === outer) throw new SigFigTaskError('a group must use the other kind of operation than the outer calculation')
  const terms = group.terms.map((t, j) => termInfo(t, firstFlat + j))
  const outcome = runChain(terms.map(termQuantity), group.ops, family)
  const label = chainExpression(
    terms.map((t, j) => termLabel(t, j === 0)),
    group.ops,
  )
  const shown = family === 'addsub' ? `(${label})` : label
  if (outcome.exact) {
    const never = roundRatToPlace(outcome.value, 0)
    return {
      operandIndex,
      family,
      terms,
      ops: group.ops,
      outcome,
      rounded: never,
      carried: false,
      quantity: { value: outcome.value, exact: true, sigFigs: 0, place: 0, label: shown, limitingTerms: [] },
    }
  }
  const rounded = roundOutcome(outcome)
  if (rounded.m === 0n) throw new SigFigTaskError(`${shown} rounds to zero, so it has no significant figures left`, 'zero_result')
  const carried = ratIsZero(outcome.value) ? false : ratFirstPlace(outcome.value) !== rounded.place + digitCount(rounded.m) - 1
  return {
    operandIndex,
    family,
    terms,
    ops: group.ops,
    outcome,
    rounded,
    carried,
    quantity: {
      value: outcome.value,
      exact: false,
      sigFigs: digitCount(rounded.m),
      place: rounded.place,
      label: shown,
      limitingTerms: outcome.limiting.map((i) => terms[i].flatIndex),
    },
  }
}

function analyseCalculation(task: Extract<SigFigTask, { kind: 'muldiv' | 'addsub' | 'mixed' }>): SigFigAnalysis {
  const terms: TermInfo[] = []
  const groups: GroupAnalysis[] = []
  let operands: Quantity[]
  let family: SigFigFamily
  if (task.kind === 'mixed') {
    const outer = familyOfOps(task.ops)
    if (outer === null) throw new SigFigTaskError('the outer operations must all be + − or all × ÷')
    family = outer
    if (!task.operands.some(isGroup)) throw new SigFigTaskError('a mixed task needs at least one group')
    operands = task.operands.map((o, i) => {
      if (isGroup(o)) {
        const g = analyseGroup(o, i, outer, terms.length)
        groups.push(g)
        terms.push(...g.terms)
        return g.quantity
      }
      const t = termInfo(o, terms.length)
      terms.push(t)
      return termQuantity(t)
    })
  } else {
    family = task.kind
    task.terms.forEach((t, i) => terms.push(termInfo(t, i)))
    operands = terms.map(termQuantity)
  }

  const outcome = runChain(operands, task.ops, family)
  const rounded = roundOutcome(outcome)
  const forms = canonicalForms(rounded.m, rounded.place)
  const expected = expectedFrom(rounded, forms)
  const placeName = sigFigPlaceName(rounded.place)
  const expression = sigFigTaskExpression(task)
  const shown = ratToDisplay(outcome.value, displayFigures(expected.sigFigs))
  const limitingLabels = outcome.limiting.map((i) => operands[i].label)
  const limit: SigFigLimit = {
    rule: family,
    termIndices: outcome.limiting.flatMap((i) => operands[i].limitingTerms),
    sigFigs: expected.sigFigs,
    place: rounded.place,
    placeName,
    text: limitSentence(family, limitingLabels, outcome.sigFigs ?? expected.sigFigs, rounded.place),
  }

  const intermediates: SigFigIntermediate[] = groups
    .filter((g) => !g.outcome.exact)
    .map((g) => {
      const labels = g.outcome.limiting.map((i) => g.terms[i].numeral.display)
      const gPlace = g.quantity.place
      return {
        operandIndex: g.operandIndex,
        rule: g.family,
        expression: g.quantity.label.replace(/^\((.*)\)$/, '$1'),
        unrounded: ratToDisplay(g.outcome.value, displayFigures(g.quantity.sigFigs)).text,
        roundedDisplay: canonicalForms(g.rounded.m, g.rounded.place).display,
        sigFigs: g.quantity.sigFigs,
        place: gPlace,
        placeName: sigFigPlaceName(gPlace),
        limit: {
          rule: g.family,
          termIndices: g.quantity.limitingTerms,
          sigFigs: g.quantity.sigFigs,
          place: gPlace,
          placeName: sigFigPlaceName(gPlace),
          text: limitSentence(g.family, labels, g.outcome.sigFigs ?? g.quantity.sigFigs, gPlace),
        },
      }
    })

  // Explanation.
  const steps: string[] = []
  const unroundedPretty = shown.text.replace(/^-/, '−')
  if (task.kind === 'mixed') {
    for (const g of groups) {
      const im = intermediates.find((x) => x.operandIndex === g.operandIndex)
      if (!im) {
        steps.push(`${g.quantity.label} uses only exact numbers, so it never limits the answer.`)
        continue
      }
      steps.push(...termFactSentences(g.terms, g.family))
      steps.push(
        g.family === 'addsub'
          ? `Work out ${im.expression} first: ${im.unrounded.replace(/^-/, '−')}. Adding and subtracting go by place, so it is good to the ${im.placeName} place, which makes it ${figuresPhrase(im.sigFigs)} (${im.roundedDisplay}). Do not round yet: keep every digit in the calculator.`
          : `Work out ${im.expression} first: ${im.unrounded.replace(/^-/, '−')}. Multiplying and dividing go by significant figures, so it is good to ${figuresPhrase(im.sigFigs)} (${im.roundedDisplay}): its last reliable digit is in the ${im.placeName} place. Do not round yet: keep every digit in the calculator.`,
      )
    }
    const loose = terms.filter((t) => !groups.some((g) => g.terms.includes(t)))
    steps.push(...termFactSentences(loose, family))
    steps.push(
      family === 'muldiv'
        ? `Now the multiplying and dividing: the answer keeps the fewest significant figures. ${limit.text}`
        : `Now the adding and subtracting: the answer is rounded to the least precise place. ${limit.text}`,
    )
    steps.push(`With every digit carried through: ${expression} = ${unroundedPretty}.`)
  } else {
    steps.push(...termFactSentences(terms, family))
    steps.push(
      family === 'muldiv'
        ? `Multiplying and dividing: the answer keeps the fewest significant figures. ${limit.text}`
        : `Adding and subtracting: the answer is rounded to the least precise place. ${limit.text}`,
    )
    steps.push(`Calculator: ${expression} = ${unroundedPretty}.`)
  }
  const target = family === 'muldiv' ? figuresPhrase(outcome.sigFigs as number) : `the ${placeName} place`
  steps.push(...roundingSentences(unroundedPretty, rounded, target, forms))
  if (family === 'addsub' && rounded.m !== 0n) {
    const fewest = Math.min(...operands.filter((q) => !q.exact).map((q) => q.sigFigs))
    if (expected.sigFigs < fewest && task.ops.includes('-'))
      steps.push(`Notice the answer has only ${figuresPhrase(expected.sigFigs)}: subtracting close numbers loses figures, and that is fine.`)
  }

  return {
    task,
    terms,
    family,
    operands,
    ops: task.ops,
    groups,
    exactValue: outcome.value,
    rounded,
    evaluation: {
      task,
      expression,
      unrounded: shown.text,
      unroundedTerminates: shown.terminates,
      limit,
      expected,
      tie: rounded.tie,
      rounding: rounded.direction,
      intermediates,
      steps,
    },
  }
}

/** Full internal analysis (BigInt values included) for the grader and the mistake table. Throws SigFigTaskError. */
export function analyseSigFigTask(task: SigFigTask): SigFigAnalysis {
  return task.kind === 'count' || task.kind === 'round' || task.kind === 'convert'
    ? analyseSingle(task)
    : analyseCalculation(task)
}

/**
 * Evaluate a task exactly. Throws SigFigTaskError when the TASK itself is malformed (unreadable
 * numeral, mixed families in one chain, division by zero, nothing measured, …).
 */
export function evaluateSigFigTask(task: SigFigTask): SigFigEvaluation {
  return analyseSigFigTask(task).evaluation
}

/**
 * Everything that makes a generated task unsuitable; [] means fine. Never throws.
 *  invalid            malformed (message says why)
 *  tie                the discarded part is exactly one half (rule 10: never show these)
 *  zero_result        the rounded answer, or an intermediate, is zero
 *  intermediate_carry a group of a mixed task carries into a new digit when rounded (9.96 → 10.0),
 *                     so how many figures it has is debatable
 *  not_representable  conversion to standard notation cannot show the figures (2.0 × 10³)
 */
export function validateSigFigTask(task: SigFigTask): SigFigTaskIssue[] {
  let analysis: SigFigAnalysis
  try {
    analysis = analyseSigFigTask(task)
  } catch (err) {
    if (err instanceof SigFigTaskError) return [{ code: err.code, message: err.message }]
    return [{ code: 'invalid', message: err instanceof Error ? err.message : String(err) }]
  }
  const issues: SigFigTaskIssue[] = []
  if (analysis.evaluation.tie)
    issues.push({ code: 'tie', message: 'the discarded part is exactly one half, so half-up and half-even disagree' })
  if (task.kind !== 'count' && analysis.rounded.m === 0n)
    issues.push({ code: 'zero_result', message: 'the rounded answer is zero' })
  for (const g of analysis.groups)
    if (g.carried)
      issues.push({ code: 'intermediate_carry', message: `${g.quantity.label} carries into a new digit when rounded` })
  return issues
}
