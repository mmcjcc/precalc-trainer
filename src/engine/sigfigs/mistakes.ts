/**
 * What each named mistake WOULD have produced for a task, computed exactly. The grader compares a
 * wrong answer against these (value AND last significant place must both match), so a diagnosis is
 * never a guess about her intent: it is "this is precisely the number that mistake gives".
 */
import type { ErrorPatternId, SigFigNumeral, SigFigOp, SigFigOperand, SigFigTask, SigFigTerm } from '@/shared/types'
import {
  digitCount,
  ratFromDec,
  ratIsZero,
  roundRatToPlace,
  roundRatToSigFigs,
  type Rat,
  type RoundedRat,
} from './decimal'
import { figuresPhrase, joinList, sigFigPlaceName } from './format'
import {
  analyseSigFigTask,
  roundOutcome,
  runChain,
  type Quantity,
  type SigFigAnalysis,
} from './evaluate'
import { canonicalForms } from './round'

/** A numeric answer a mistake leads to: m × 10^place, written to that place. */
export interface NumericMistake {
  id: ErrorPatternId
  m: bigint
  place: number
  witness: string
}

/** A count answer a mistake leads to. */
export interface CountMistake {
  id: ErrorPatternId
  count: number
  witness: string
}

const valueOf = (r: { m: bigint; place: number }): Rat => ratFromDec({ int: r.m, exp: r.place })

function differs(a: { m: bigint; place: number }, b: { m: bigint; place: number }): boolean {
  return a.m !== b.m || a.place !== b.place
}

function stripExact(task: SigFigTask): SigFigTask {
  const plain = (t: SigFigTerm): SigFigTerm => ({ text: t.text })
  const operand = (o: SigFigOperand): SigFigOperand =>
    'terms' in o ? { terms: o.terms.map(plain), ops: o.ops } : plain(o)
  switch (task.kind) {
    case 'muldiv':
    case 'addsub':
      return { ...task, terms: task.terms.map(plain) }
    case 'mixed':
      return { ...task, operands: task.operands.map(operand) }
    default:
      return task
  }
}

function tryRound(fn: () => RoundedRat): RoundedRat | null {
  try {
    return fn()
  } catch {
    return null
  }
}

/** Round a quantity list with the precision the WRONG family's rule would give. */
function wrongRuleRounding(operands: Quantity[], value: Rat, family: 'muldiv' | 'addsub'): { r: RoundedRat; label: string[]; n: number } | null {
  const measured = operands.filter((q) => !q.exact)
  if (measured.length === 0) return null
  if (family === 'muldiv') {
    // She lined up decimal places on a multiplication.
    const place = Math.max(...measured.map((q) => q.place))
    return { r: roundRatToPlace(value, place), label: measured.filter((q) => q.place === place).map((q) => q.label), n: place }
  }
  // She counted figures on an addition.
  const counted = measured.filter((q) => q.sigFigs >= 1)
  if (counted.length === 0 || ratIsZero(value)) return null
  const n = Math.min(...counted.map((q) => q.sigFigs))
  return { r: roundRatToSigFigs(value, n), label: counted.filter((q) => q.sigFigs === n).map((q) => q.label), n }
}

/**
 * Rule-level mistakes for round / muldiv / addsub / mixed tasks, in diagnosis priority order.
 * Candidates identical to the right answer are left out.
 */
export function ruleMistakes(analysis: SigFigAnalysis): NumericMistake[] {
  const { task, rounded: right } = analysis
  const out: NumericMistake[] = []
  const push = (id: ErrorPatternId, r: RoundedRat | null, witness: string): void => {
    if (r && differs(r, right)) out.push({ id, m: r.m, place: r.place, witness })
  }

  if (task.kind === 'round') {
    if (task.sigFigs !== undefined) {
      const n = task.sigFigs
      push(
        'sf_places_not_figures',
        roundRatToPlace(analysis.exactValue, -n),
        `That is rounded to ${n} decimal place${n === 1 ? '' : 's'}. Significant figures are counted from the first nonzero digit, wherever the decimal point happens to be.`,
      )
    }
    return out
  }
  if (task.kind !== 'muldiv' && task.kind !== 'addsub' && task.kind !== 'mixed') return out
  const family = analysis.family as 'muldiv' | 'addsub'
  const operands = analysis.operands as Quantity[]
  const ops = analysis.ops ?? []
  const limitRound = (value: Rat): RoundedRat | null =>
    tryRound(() =>
      family === 'muldiv'
        ? roundRatToSigFigs(value, digitCountOfLimit(analysis))
        : roundRatToPlace(value, right.place),
    )

  // 1. Rounded an intermediate too early.
  const liveGroups = analysis.groups.filter((g) => !g.outcome.exact)
  if (liveGroups.length > 0) {
    const early = operands.map((q, i) => {
      const g = liveGroups.find((x) => x.operandIndex === i)
      return g ? { ...q, value: valueOf(g.rounded) } : q
    })
    const value = tryValue(() => runChain(early, ops, family).value)
    if (value && !(family === 'muldiv' && ratIsZero(value))) {
      const names = liveGroups.map((g) => `${g.quantity.label} to ${canonicalForms(g.rounded.m, g.rounded.place).display}`)
      push(
        'sf_rounded_early',
        limitRound(value),
        `That is what you get if you round ${joinList(names)} before the last step. Keep every digit in the calculator through the middle and round once, at the end.`,
      )
    }
  } else if (operands.length >= 3) {
    const value = stepwiseRounded(operands, ops, family)
    if (value && !(family === 'muldiv' && ratIsZero(value)))
      push(
        'sf_rounded_early',
        limitRound(value),
        'That is what you get when each step is rounded before the next one. Keep every digit in the calculator and round once, at the end.',
      )
  }

  // 2. Let an exact number limit the figures.
  const exactTerms = analysis.terms.filter((t) => t.exact)
  if (exactTerms.length > 0) {
    const asMeasured = tryAnalyse(stripExact(task))
    if (asMeasured) {
      const names = exactTerms.map((t) => `${t.numeral.display}${t.term.note ? ` (${t.term.note})` : ''}`)
      push(
        'sf_exact_limited',
        asMeasured.rounded,
        `${joinList(names)} ${exactTerms.length === 1 ? 'is an exact number' : 'are exact numbers'}, with unlimited significant figures. Only the measured numbers can limit the answer.`,
      )
    }
  }

  // 3. The other family's rule, on the last step...
  const wrongOuter = wrongRuleRounding(operands, analysis.exactValue, family)
  if (wrongOuter) {
    if (family === 'muldiv')
      push(
        'sf_addsub_rule_on_muldiv',
        wrongOuter.r,
        `That is rounded to the ${sigFigPlaceName(wrongOuter.n)} place, matching the decimal places of ${joinList(wrongOuter.label)}. Lining up places is the rule for + and −. For × and ÷, count significant figures instead.`,
      )
    else
      push(
        'sf_muldiv_rule_on_addsub',
        wrongOuter.r,
        `That keeps ${figuresPhrase(wrongOuter.n)}, like ${joinList(wrongOuter.label)}. Counting figures is the rule for × and ÷. For + and −, line up the places and round to the least precise one.`,
      )
  }
  // ...or inside the groups of a mixed problem.
  if (liveGroups.length > 0) {
    const swapped = operands.map((q, i): Quantity | null => {
      const g = liveGroups.find((x) => x.operandIndex === i)
      if (!g) return q
      const w = wrongRuleRounding(g.terms.map((t) => ({
        value: t.value,
        exact: t.exact,
        sigFigs: t.numeral.sigFigs,
        place: t.numeral.lastSigPlace,
        label: t.numeral.display,
        limitingTerms: [t.flatIndex],
      })), g.outcome.value, g.family)
      if (!w || w.r.m === 0n) return null
      return { ...q, sigFigs: digitCount(w.r.m), place: w.r.place }
    })
    if (swapped.every((q): q is Quantity => q !== null)) {
      const redo = tryRound(() => roundOutcome(runChain(swapped, ops, family)))
      const g = liveGroups[0]
      push(
        g.family === 'addsub' ? 'sf_muldiv_rule_on_addsub' : 'sf_addsub_rule_on_muldiv',
        redo,
        g.family === 'addsub'
          ? `${g.quantity.label} is an addition or subtraction, so it is good to the ${sigFigPlaceName(g.quantity.place)} place, which gives it ${figuresPhrase(g.quantity.sigFigs)}. Counting the fewest figures of its numbers is the rule for × and ÷.`
          : `${g.quantity.label} is a multiplication or division, so it is good to ${figuresPhrase(g.quantity.sigFigs)}: its last reliable digit is in the ${sigFigPlaceName(g.quantity.place)} place. Lining up decimal places is the rule for + and −.`,
      )
    }
  }

  // 4. Matched the MOST precise number instead of the least.
  const measured = operands.filter((q) => !q.exact)
  if (measured.length > 1) {
    if (family === 'muldiv') {
      const most = Math.max(...measured.map((q) => q.sigFigs))
      push(
        'sf_most_precise',
        tryRound(() => roundRatToSigFigs(analysis.exactValue, most)),
        `That keeps ${figuresPhrase(most)}, as many as ${joinList(measured.filter((q) => q.sigFigs === most).map((q) => q.label))}, the MOST precise number here. An answer is only as good as its weakest measurement, so the FEWEST figures set the limit.`,
      )
    } else {
      const finest = Math.min(...measured.map((q) => q.place))
      push(
        'sf_most_precise',
        roundRatToPlace(analysis.exactValue, finest),
        `That goes out to the ${sigFigPlaceName(finest)} place, as far as ${joinList(measured.filter((q) => q.place === finest).map((q) => q.label))}, the MOST precise number here. An answer is only as good as its weakest measurement, so the LEAST precise place sets the limit.`,
      )
    }
  }

  // 5. N decimal places instead of N significant figures.
  if (family === 'muldiv') {
    const n = digitCountOfLimit(analysis)
    push(
      'sf_places_not_figures',
      roundRatToPlace(analysis.exactValue, -n),
      `That is rounded to ${n} decimal place${n === 1 ? '' : 's'}. Significant figures are counted from the first nonzero digit, wherever the decimal point happens to be.`,
    )
  }
  return out
}

/** The figure limit of a muldiv answer (before any carry changed the digit count). */
function digitCountOfLimit(analysis: SigFigAnalysis): number {
  return analysis.rounded.m === 0n ? 1 : digitCount(analysis.rounded.m)
}

function tryValue(fn: () => Rat): Rat | null {
  try {
    return fn()
  } catch {
    return null
  }
}

function tryAnalyse(task: SigFigTask): SigFigAnalysis | null {
  try {
    return analyseSigFigTask(task)
  } catch {
    return null
  }
}

/** Left to right, rounding the running result to the running limit after every operation. */
function stepwiseRounded(operands: Quantity[], ops: SigFigOp[], family: 'muldiv' | 'addsub'): Rat | null {
  try {
    let acc: Quantity = operands[0]
    for (let i = 0; i < ops.length; i++) {
      const step = runChain([acc, operands[i + 1]], [ops[i]], family)
      if (step.exact) {
        acc = { ...acc, value: step.value, exact: true }
        continue
      }
      if (family === 'muldiv' && ratIsZero(step.value)) return null
      const r = roundOutcome(step)
      if (r.m === 0n && family === 'muldiv') return null
      acc = {
        value: valueOf(r),
        exact: false,
        sigFigs: r.m === 0n ? 0 : digitCount(r.m),
        place: r.place,
        label: 'running result',
        limitingTerms: [],
      }
    }
    return acc.value
  } catch {
    return null
  }
}

/** Count answers the classic miscounts lead to, in diagnosis priority order (right count excluded). */
export function countMistakes(n: SigFigNumeral): CountMistake[] {
  const digits = n.chars.filter((c) => c.digit)
  const pointIndex = n.chars.findIndex((c) => c.role === 'decimal_point')
  const afterPoint = (index: number): boolean => pointIndex >= 0 && index > pointIndex
  const leading = digits.filter((c) => c.role === 'leading_zero')
  const captive = digits.filter((c) => c.role === 'captive_zero')
  const trailingDec = digits.filter((c) => c.role === 'trailing_zero_decimal')
  const placeholder = digits.filter((c) => c.role === 'trailing_zero_placeholder')
  const s = (k: number): string => (k === 1 ? '' : 's')
  const out: CountMistake[] = []
  const push = (id: ErrorPatternId, count: number, witness: string): void => {
    if (count > 0 && count !== n.sigFigs && !out.some((c) => c.count === count)) out.push({ id, count, witness })
  }
  if (placeholder.length > 0)
    push(
      'sf_placeholder_zeros',
      n.sigFigs + placeholder.length,
      `${n.sigFigs + placeholder.length} includes the ${placeholder.length} zero${s(placeholder.length)} at the end of ${n.display}. With no decimal point written, ${placeholder.length === 1 ? 'that zero is only a placeholder' : 'those zeros are only placeholders'}.`,
    )
  if (leading.length > 0) {
    const witness = (count: number): string =>
      `${count} includes leading zeros of ${n.display}. Zeros in front of the first nonzero digit only place the decimal point, so they never count.`
    push('sf_leading_zeros', n.sigFigs + leading.length, witness(n.sigFigs + leading.length))
    const late = leading.filter((c) => afterPoint(c.index)).length
    if (late > 0) push('sf_leading_zeros', n.sigFigs + late, witness(n.sigFigs + late))
  }
  if (trailingDec.length > 0) {
    const witness = (count: number): string =>
      `${count} leaves out trailing zeros of ${n.display}. It has a decimal point, so those zeros were measured and they count.`
    push('sf_trailing_zeros_decimal', n.sigFigs - trailingDec.length, witness(n.sigFigs - trailingDec.length))
    const late = trailingDec.filter((c) => afterPoint(c.index)).length
    if (late > 0) push('sf_trailing_zeros_decimal', n.sigFigs - late, witness(n.sigFigs - late))
  }
  if (captive.length > 0)
    push(
      'sf_captive_zero',
      n.sigFigs - captive.length,
      `${n.sigFigs - captive.length} leaves out the zero${s(captive.length)} sandwiched inside ${n.display}. A zero between significant digits is significant too.`,
    )
  return out
}
