/**
 * Grades what she typed (or tapped) against a significant-figures task.
 *
 * Rule 11: an answer is right when its VALUE equals the correctly rounded value AND the figures it
 * shows are right, i.e. its last significant digit sits in the expected place. "3.0" is right for
 * 12.50 ÷ 4.1 and "3" is not; "12000" and "1.2e4" are both right for 12345 to two figures; "2000"
 * is wrong for 1999 to two figures (it reads as one), "2.0e3" is right.
 *
 * A wrong answer gets a NAMED mistake only when it is exactly what that mistake produces for these
 * numbers; otherwise a plain, specific message and no pattern id.
 *
 * Zero results (5.26 − 5.26): right when the answer is zero written to the expected place ("0.00");
 * for a place at or above the ones, plain "0".
 */
import type {
  ErrorPatternId,
  PatternHit,
  SigFigGrade,
  SigFigMistakeCandidate,
  SigFigNumeral,
  SigFigTapFeedback,
  SigFigTapGrade,
  SigFigTask,
} from '@/shared/types'
import { patternHit } from '../matchers/catalog'
import {
  absBig,
  decToMinimalPlain,
  decToPlain,
  digitCount,
  ratEq,
  ratFromDec,
  ratIsZero,
  ratTerminates,
  roundRatToPlace,
  roundRatToSigFigs,
  scientificText,
  type Rat,
} from './decimal'
import { figuresPhrase, sigFigPlaceName } from './format'
import { analyseSigFigTask, type SigFigAnalysis } from './evaluate'
import { countMistakes, ruleMistakes } from './mistakes'
import { mustParseSigFig, parseSigFigNumeral, sigFigDec } from './parse'
import { canonicalForms } from './round'

const wrong = (message: string, parsed?: SigFigNumeral): SigFigGrade => ({ status: 'wrong', message, parsed })

function named(id: ErrorPatternId, witness: string, parsed?: SigFigNumeral): SigFigGrade {
  const pattern = patternHit(id, witness)
  return { status: 'wrong', message: witness, pattern, parsed }
}

/** Is a/b = 10^k for an integer k ≠ 0? Returns k, else null. Both nonzero. */
function powerOfTenRatio(a: Rat, b: Rat): number | null {
  const n = a.n * b.d
  const d = a.d * b.n
  if (n === 0n || d === 0n || n < 0n !== d < 0n) return null
  const big = absBig(n)
  const small = absBig(d)
  const [hi, lo, sign] = big >= small ? [big, small, 1] : [small, big, -1]
  if (hi % lo !== 0n) return null
  const q = (hi / lo).toString()
  if (!/^10*$/.test(q) || q.length === 1) return null
  return sign * (q.length - 1)
}

function gradeCount(analysis: SigFigAnalysis, answer: string): SigFigGrade {
  const n = analysis.terms[0].numeral
  const trimmed = answer.trim()
  const lead = answer.length - answer.trimStart().length
  if (trimmed === '') {
    const parseError = { message: 'Type how many significant figures you count.', position: 0, length: 0 }
    return { status: 'parse_error', message: parseError.message, parseError }
  }
  if (!/^\d{1,3}$/.test(trimmed)) {
    const parseError = {
      message: 'Answer with a whole number: how many of the digits are significant?',
      position: lead,
      length: trimmed.length,
    }
    return { status: 'parse_error', message: parseError.message, parseError }
  }
  const count = Number(trimmed) // at most three digits: exact
  if (count === n.sigFigs) return { status: 'correct', message: `Yes: ${n.display} has ${figuresPhrase(n.sigFigs)}.` }
  const hit = countMistakes(n).find((c) => c.count === count)
  if (hit) return named(hit.id, hit.witness)
  if (count > n.digits.length)
    return wrong(`${n.display} only has ${n.digits.length} digits in all, so it cannot have ${count} significant figures.`)
  return wrong(
    'Not quite. Go through it digit by digit: nonzero digits count, zeros in front never do, zeros in the middle do, and zeros at the end count only when a decimal point is written.',
  )
}

function gradeConvert(analysis: SigFigAnalysis, s: SigFigNumeral, sVal: Rat, eVal: Rat): SigFigGrade {
  const task = analysis.task as Extract<SigFigTask, { kind: 'convert' }>
  const source = analysis.terms[0].numeral
  const valueEqual = ratEq(sVal, eVal)
  const placeOk = s.lastSigPlace === analysis.rounded.place
  if (valueEqual && placeOk) {
    if (task.to === 'scientific') {
      if (!s.scientific)
        return wrong('That is the right number, but it is not in scientific notation yet: one nonzero digit, the decimal point, the rest of the digits, then × 10 to a power.', s)
      if (!s.normalized)
        return named('sf_sci_form', `${s.display} has the right value and the right figures, but scientific notation puts exactly one nonzero digit in front of the decimal point.`, s)
    } else if (s.scientific) {
      return wrong('That is still scientific notation. Write it out the long way, with no power of ten.', s)
    }
    return { status: 'correct', message: `Correct! Same ${figuresPhrase(source.sigFigs)}, new notation.`, parsed: s }
  }
  if (valueEqual)
    return named(
      'sf_sci_changed_figures',
      `${s.display} shows ${figuresPhrase(s.sigFigs)}, but ${source.display} has ${source.sigFigs}. Converting changes how a number is written, never how many figures it has.`,
      s,
    )
  if (!s.isZero && powerOfTenRatio(sVal, eVal) !== null)
    return named(
      'sf_sci_exponent',
      `Your digits are right, but ${s.display} equals ${s.value}, not ${source.value}. Count the jumps of the decimal point again: a big number gets a positive power, a small number a negative one.`,
      s,
    )
  return wrong('The digits changed. Converting only moves the decimal point and adjusts the power of ten; every digit stays the same.', s)
}

function gradeValue(analysis: SigFigAnalysis, answer: string): SigFigGrade {
  const parsed = parseSigFigNumeral(answer)
  if (!parsed.ok) return { status: 'parse_error', message: parsed.error.message, parseError: parsed.error }
  const s = parsed.numeral
  const sVal = ratFromDec(sigFigDec(s))
  const { task, rounded, evaluation } = analysis
  const eVal = ratFromDec({ int: rounded.m, exp: rounded.place })
  if (task.kind === 'convert') return gradeConvert(analysis, s, sVal, eVal)

  const valueEqual = ratEq(sVal, eVal)
  const zeroExpected = rounded.m === 0n
  const placeOk = zeroExpected ? s.lastSigPlace === Math.min(rounded.place, 0) : s.lastSigPlace === rounded.place

  if (valueEqual && placeOk) {
    const grade: SigFigGrade = {
      status: 'correct',
      message: task.kind === 'round' ? `Correct! ${s.display} shows exactly ${figuresPhrase(evaluation.expected.sigFigs)}.` : `Correct! ${evaluation.limit.text}`,
      parsed: s,
    }
    if (s.scientific && !s.normalized && !zeroExpected)
      grade.note = `Tidy scientific notation has one nonzero digit in front of the decimal point: ${mustParseSigFig(scientificText(rounded.m, rounded.place)).display}.`
    return grade
  }

  const exact = analysis.exactValue
  const calc = task.kind !== 'round'

  // The whole calculator display (terminating), copied down.
  if (calc && !valueEqual && ratTerminates(exact) && ratEq(sVal, exact) && s.lastSigPlace < rounded.place)
    return named('sf_unrounded', `${s.display} is everything the calculator shows, but the measurements cannot support that many digits. Find the limiting measurement and round to match it.`, s)

  // Exactly what a rule-level mistake produces.
  for (const c of ruleMistakes(analysis)) {
    const cVal = ratFromDec({ int: c.m, exp: c.place })
    const cPlaceOk = c.m === 0n ? s.lastSigPlace === Math.min(c.place, 0) : s.lastSigPlace === c.place
    if (ratEq(sVal, cVal) && cPlaceOk) return named(c.id, c.witness, s)
  }

  // Right value, wrong figures showing.
  if (valueEqual && !zeroExpected) {
    const need = evaluation.expected.sigFigs
    if (s.lastSigPlace > rounded.place) {
      if (!s.scientific && !s.hasDecimalPoint && rounded.place >= 0)
        return named(
          'sf_ambiguous_zeros',
          `${s.display} is the right size, but written that way it reads as ${figuresPhrase(s.sigFigs)}: with no decimal point, its trailing zeros are placeholders. Scientific notation can show exactly ${need}.`,
          s,
        )
      return named(
        'sf_dropped_zero',
        `${s.display} has the right value but shows only ${figuresPhrase(s.sigFigs)}. A zero at the end, after the decimal point, is how the answer shows it is good to ${need}.`,
        s,
      )
    }
    return named(
      'sf_extra_zeros',
      `${s.display} has the right value, but it shows ${figuresPhrase(s.sigFigs)}. The extra zero${s.sigFigs - need === 1 ? '' : 's'} claim${s.sigFigs - need === 1 ? 's' : ''} precision the measurements do not have: the limit is ${need}.`,
      s,
    )
  }

  if (!s.isZero) {
    // A long calculator display (non-terminating), copied down: at least three figures too many.
    // One or two extra figures is a rounding choice, not a copied display; that case is handled below.
    if (calc && s.lastSigPlace < rounded.place && s.sigFigs >= evaluation.expected.sigFigs + 3) {
      const at = roundRatToPlace(exact, s.lastSigPlace)
      const shown = (m: bigint): boolean => ratEq(sVal, ratFromDec({ int: m, exp: s.lastSigPlace }))
      if (shown(at.m) || shown(at.truncM))
        return named('sf_unrounded', `${s.display} is straight off the calculator display, but the measurements cannot support that many digits. Find the limiting measurement and round to match it.`, s)
    }

    // Chopped instead of rounded.
    if (rounded.direction === 'up' && ratEq(sVal, ratFromDec({ int: rounded.truncM, exp: rounded.truncPlace })))
      return named(
        'sf_truncated',
        `It looks like the extra digits were chopped off. The first dropped digit is ${rounded.firstDropped}, which is 5 or more, so the last kept digit goes up by one.`,
        s,
      )

    // Size changed by a power of ten.
    if (!zeroExpected) {
      const k = powerOfTenRatio(eVal, sVal)
      if (k !== null) {
        if (k > 0 && rounded.place > 0 && !s.scientific && !s.hasDecimalPoint)
          return named(
            'sf_lost_placeholders',
            `${s.display} is ${decToPlain({ int: 1n, exp: k })} times smaller than the number you started from. Rounding never changes the size of a number: fill the dropped places with placeholder zeros (or use scientific notation).`,
            s,
          )
        return wrong('Your digits are right, but the number is the wrong size: it is off by a power of ten. Check where the decimal point belongs.', s)
      }
    }

    // Right arithmetic, wrong number of figures (no rule explains which).
    if (s.lastSigPlace !== rounded.place && ratEq(sVal, ratFromDec({ int: roundRatToPlace(exact, s.lastSigPlace).m, exp: s.lastSigPlace })))
      return wrong(
        s.lastSigPlace < rounded.place
          ? 'Your arithmetic is right, but you kept more digits than the measurements support. Find the measurement that limits the answer, then round to match it.'
          : 'Your arithmetic is right, but you rounded away a digit you were allowed to keep. Look again at which measurement limits the answer.',
        s,
      )
  }

  return wrong(
    task.kind === 'round'
      ? 'Those are not the right digits. Start at the first nonzero digit, count off the figures you keep, then let the very next digit decide whether the last one goes up.'
      : 'The digits themselves are off, so recheck the arithmetic on your calculator before worrying about significant figures.',
    s,
  )
}

/**
 * Grade a typed answer. Count tasks take a whole number ("3"); every other task takes a numeral
 * in any accepted spelling ("3.0", "1.2e4", "2.0 x 10^3", "2000.").
 * Throws SigFigTaskError only when the TASK is malformed.
 */
export function gradeSigFigAnswer(task: SigFigTask, answer: string): SigFigGrade {
  const analysis = analyseSigFigTask(task)
  return task.kind === 'count' ? gradeCount(analysis, answer) : gradeValue(analysis, answer)
}

const TAP_PATTERN: Partial<Record<SigFigTapFeedback['role'], ErrorPatternId>> = {
  leading_zero: 'sf_leading_zeros',
  captive_zero: 'sf_captive_zero',
  trailing_zero_decimal: 'sf_trailing_zeros_decimal',
  trailing_zero_placeholder: 'sf_placeholder_zeros',
}

/**
 * Grade tapped digits for a count task. `text` is the numeral shown; `selected` holds the
 * `SigFigChar.index` of every digit she marked significant (non-digit indices are ignored).
 */
export function gradeSigFigTaps(text: string, selected: readonly number[]): SigFigTapGrade {
  const n = mustParseSigFig(text)
  const chosen = new Set(selected)
  const digits: SigFigTapFeedback[] = n.chars
    .filter((c) => c.digit)
    .map((c) => {
      const isSelected = chosen.has(c.index)
      const ok = isSelected === c.significant
      const feedback: SigFigTapFeedback = {
        index: c.index,
        ch: c.ch,
        role: c.role,
        significant: c.significant,
        selected: isSelected,
        ok,
        rule: c.rule,
      }
      const id = TAP_PATTERN[c.role]
      if (!ok && id && !n.isZero) feedback.patternId = id
      return feedback
    })
  const wrongOnes = digits.filter((d) => !d.ok)
  const patterns: PatternHit[] = []
  for (const d of wrongOnes) {
    if (d.patternId && !patterns.some((p) => p.id === d.patternId)) {
      const same = wrongOnes.filter((w) => w.patternId === d.patternId).length
      patterns.push(
        patternHit(
          d.patternId,
          d.selected
            ? `You marked ${same === 1 ? 'a zero' : `${same} zeros`} in ${n.display} that ${same === 1 ? 'does' : 'do'} not count. ${d.rule}`
            : `You skipped ${same === 1 ? 'a zero' : `${same} zeros`} in ${n.display} that ${same === 1 ? 'does' : 'do'} count. ${d.rule}`,
        ),
      )
    }
  }
  const correct = wrongOnes.length === 0
  const message = correct
    ? `Yes: ${n.display} has ${figuresPhrase(n.sigFigs)}.`
    : patterns.length > 0
      ? (patterns[0].witness as string)
      : 'Every nonzero digit is significant, so each one needs to be marked.'
  return { correct, sigFigs: n.sigFigs, selectedCount: digits.filter((d) => d.selected).length, digits, patterns, message }
}

/**
 * Mixed tasks: grade her answer to "how precise is this middle result?". `intermediateIndex`
 * indexes `evaluateSigFigTask(task).intermediates`. Give `sigFigs` (how many figures it is good
 * to) or `place` (power of ten of its last reliable digit), whichever the UI asked for.
 */
export function gradeSigFigIntermediate(
  task: SigFigTask,
  intermediateIndex: number,
  response: { sigFigs?: number; place?: number },
): SigFigGrade {
  const analysis = analyseSigFigTask(task)
  const im = analysis.evaluation.intermediates[intermediateIndex]
  if (!im) throw new Error(`sig figs: task has no intermediate ${intermediateIndex}`)
  const group = analysis.groups.find((g) => g.operandIndex === im.operandIndex)
  if (!group) throw new Error('sig figs: intermediate without a group')
  const byFigures = response.sigFigs !== undefined
  const given = byFigures ? response.sigFigs : response.place
  if (given === undefined || !Number.isInteger(given)) {
    const parseError = { message: 'Pick how precise the middle result is first.', position: 0, length: 0 }
    return { status: 'parse_error', message: parseError.message, parseError }
  }
  const right = byFigures ? im.sigFigs : im.place
  if (given === right)
    return {
      status: 'correct',
      message:
        im.rule === 'addsub'
          ? `Right: ${im.expression} is good to the ${im.placeName} place, so it carries ${figuresPhrase(im.sigFigs)} into the next step. Keep all its digits in the calculator until the end.`
          : `Right: ${im.expression} is good to ${figuresPhrase(im.sigFigs)}, so its last reliable digit is in the ${im.placeName} place. Keep all its digits in the calculator until the end.`,
    }
  const measured = group.terms.filter((t) => !t.exact)
  if (im.rule === 'addsub') {
    const fewest = Math.min(...measured.map((t) => t.numeral.sigFigs))
    if (byFigures && given === fewest)
      return named(
        'sf_muldiv_rule_on_addsub',
        `${fewest} is the fewest figures among the numbers in ${im.expression}, which is the rule for × and ÷. This step adds or subtracts: line up the places, find the least precise one, then count the figures of the result.`,
      )
    const finest = Math.min(...measured.map((t) => t.numeral.lastSigPlace))
    if (!byFigures && given === finest && finest !== im.place)
      return named('sf_most_precise', `The ${sigFigPlaceName(finest)} place is as far as the MOST precise number goes. The least precise number decides where the result stops.`)
  } else {
    const coarsest = Math.max(...measured.map((t) => t.numeral.lastSigPlace))
    if (!byFigures && given === coarsest)
      return named(
        'sf_addsub_rule_on_muldiv',
        `The ${sigFigPlaceName(coarsest)} place comes from lining up decimal places, which is the rule for + and −. This step multiplies or divides: count significant figures, keep the fewest, then see which place that reaches.`,
      )
    const most = Math.max(...measured.map((t) => t.numeral.sigFigs))
    if (byFigures && given === most && most !== im.sigFigs)
      return named('sf_most_precise', `${most} is how many figures the MOST precise number has. The number with the FEWEST figures sets the limit.`)
  }
  return wrong(
    im.rule === 'addsub'
      ? `Not quite. ${im.expression} adds or subtracts, so find the least precise place among its numbers, round the result there in your head, and count the figures that leaves.`
      : `Not quite. ${im.expression} multiplies or divides, so it keeps the fewest significant figures among its numbers.`,
  )
}

/**
 * Realistic wrong answers for a task and the named mistake each one earns, in the grader's own
 * priority order. Every entry has been run through gradeSigFigAnswer, so `id` is exactly what the
 * student would be told. Content can use it to build distractors or to pick tasks that can expose
 * a particular mistake.
 */
export function sigFigMistakeCandidates(task: SigFigTask): SigFigMistakeCandidate[] {
  const analysis = analyseSigFigTask(task)
  const texts: string[] = []
  const { rounded, exactValue } = analysis

  if (task.kind === 'count') {
    texts.push(...countMistakes(analysis.terms[0].numeral).map((c) => String(c.count)))
  } else if (task.kind === 'convert') {
    const source = analysis.terms[0].numeral
    const canonical = analysis.evaluation.expected.text
    const respell = (m: bigint, place: number): string | null => {
      const forms = canonicalForms(m, place, task.to === 'scientific')
      const all = [forms.text, ...forms.alternates]
      return all.find((t) => mustParseSigFig(t).scientific === (task.to === 'scientific')) ?? null
    }
    const padded = respell(rounded.m * 10n, rounded.place - 1)
    if (padded) texts.push(padded)
    if (rounded.m % 10n === 0n) {
      const dropped = respell(rounded.m / 10n, rounded.place + 1)
      if (dropped) texts.push(dropped)
    }
    if (task.to === 'scientific') {
      const match = /^(.*) x 10\^(-?\d+)$/.exec(canonical)
      if (match && match[2] !== '0') texts.push(`${match[1]} x 10^${match[2].startsWith('-') ? match[2].slice(1) : '-' + match[2]}`)
      if (source.sigDigits.length >= 3) {
        const d = source.sigDigits
        texts.push(`${source.negative ? '-' : ''}${d.slice(0, 2)}.${d.slice(2)} x 10^${source.firstSigPlace - 1}`)
      }
    }
  } else {
    if (task.kind !== 'round' && ratTerminates(exactValue)) texts.push(analysis.evaluation.unrounded)
    for (const c of ruleMistakes(analysis)) texts.push(canonicalForms(c.m, c.place).text)
    if (rounded.m !== 0n) {
      if (rounded.m % 10n === 0n) texts.push(decToMinimalPlain({ int: rounded.m, exp: rounded.place }))
      const padded = canonicalForms(rounded.m * 10n, rounded.place - 1)
      texts.push(padded.text)
      if (task.kind !== 'round' && !ratTerminates(exactValue) && !ratIsZero(exactValue)) {
        const long = roundRatToSigFigs(exactValue, Math.max(10, digitCount(rounded.m) + 4))
        texts.push(decToPlain({ int: long.m, exp: long.place }))
      }
      if (rounded.direction === 'up' && rounded.truncM !== 0n) texts.push(canonicalForms(rounded.truncM, rounded.truncPlace).text)
      if (rounded.place > 0) texts.push(decToPlain({ int: rounded.m, exp: 0 }))
    }
  }

  const out: SigFigMistakeCandidate[] = []
  for (const text of texts) {
    if (out.some((c) => c.text === text)) continue
    const grade = task.kind === 'count' ? gradeCount(analysis, text) : gradeValue(analysis, text)
    if (grade.status === 'wrong' && grade.pattern)
      out.push({ id: grade.pattern.id, text, witness: grade.pattern.witness ?? grade.message })
  }
  return out
}
