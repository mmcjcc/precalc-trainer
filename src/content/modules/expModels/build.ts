/**
 * Exponential growth and decay word problems, drawn from the seed: the principal, the rate, how often it
 * compounds, the years, the half-life, the amounts and the counts. Each answer is checked with gradeLogValue
 * (exact, or with { decimal }), and every trap is the value that slip gives for THIS problem: a draw is kept
 * only when the answer and every trap differ at the rounding the problem asks for.
 */
import { problemId } from '@/content/registry'
import type { Rng } from '@/content/rng'
import type { AnswerSpec, DifficultyKnobs, ExpLogPart, ExpLogPartTrap, ProblemInstance, TemplateDef } from '@/content/types'
import type { CalcPanels, ErrorPatternId, GraphSpec } from '@/shared/types'
import { gradeExpLogPart, leaks, say, withCommas, type PartGrade } from '../explog/parts'
import { LogSkip, gcd, roundPlaces, searchSeed } from '../explog/text'
import { EM_RULES, EM_RULE_IDS } from './rules'

export const EM_MODULE_ID = 'expModels' as const

export type ExpModelsAnswer = Extract<AnswerSpec, { type: 'expModels' }>

const NO_GRAPH: GraphSpec = { kind: 'none' }
const NO_CALC: CalcPanels = { ti84: [], nspire: [] }
const VERSION = 1

export const MONEY_HINT = 'Dollars and cents. A $ sign and commas are fine.'
export const NUMBER_HINT = 'A number, rounded the way the problem asks. A unit after it is fine.'
export const EXACT_HINT = 'An exact expression with ln. Do not round this one.'
export const INSTRUCTIONS: Record<'interest' | 'halflife' | 'growth', string> = {
  interest: 'Give the answer in the box, rounded the way the problem asks.',
  halflife: 'Give the answer in the box, rounded the way the problem asks.',
  growth: 'One part at a time: k exactly, then k rounded, then the last question. Each part opens when the one before it is right.',
}

const LN_HALF = Math.log(0.5)

/** "$2,500". */
function dollars(n: number): string {
  return `$${withCommas(String(n))}`
}

const PERIOD_WORD: Record<number, string> = { 1: 'annually', 2: 'semiannually', 4: 'quarterly', 12: 'monthly' }

const ROUND_YEARS: Record<number, string> = { 1: 'Round to the nearest tenth of a year.', 2: 'Round to the nearest hundredth of a year.' }

function roundWords(places: number, unit: string): string {
  if (places === 0) return `Round to the nearest ${unit}.`
  return `Round to the nearest ${places === 1 ? 'tenth' : 'hundredth'} of ${/^(?:[aeiou]|hour)/.test(unit) ? 'an' : 'a'} ${unit}.`
}

const UNITS: Record<string, string[]> = {
  year: ['years', 'year', 'yrs', 'yr'],
  day: ['days', 'day'],
  hour: ['hours', 'hour', 'hrs', 'hr'],
  gram: ['grams', 'gram', 'g'],
  milligram: ['milligrams', 'milligram', 'mg'],
  bacteria: ['bacteria'],
  people: ['people', 'residents', 'persons'],
}

interface Slip {
  id: ErrorPatternId
  values: number[]
  witness: string
  /** May this slip be the one the problem promises? (Its value looks like an answer someone would type.) */
  promise?: boolean
}

/** A rounded-number part. Slips that give no finite value she could type are dropped; the rest must stand apart. */
function decimalPart(o: {
  id: string
  label: string
  ask: string
  places: number
  money?: boolean
  units?: string[]
  closedForms: string[]
  values: number[]
  slips: Slip[]
  nudge: string
  ruleCard: string
  reveal: string[]
}): { part: ExpLogPart; promisable: ExpLogPartTrap[] } {
  const gap = 10 ** -o.places
  const answer = roundPlaces(o.values[0]!, o.places)
  const typed = (v: number) => (o.money ? withCommas(roundPlaces(v, o.places)) : roundPlaces(v, o.places))
  const traps: ExpLogPartTrap[] = []
  const promisable: ExpLogPartTrap[] = []
  const taken: number[] = [...o.values]
  for (const slip of o.slips) {
    const values = slip.values.filter((v) => Number.isFinite(v) && v > 0 && v < 1e9)
    if (!values.length) continue
    // Each slip has to stand apart from every right value and every earlier slip at the rounding asked.
    for (const v of values) {
      for (const w of taken) {
        if (Math.abs(v - w) < gap || roundPlaces(v, o.places) === roundPlaces(w, o.places)) throw new LogSkip(`${slip.id} collides at ${o.places} places`)
      }
    }
    taken.push(...values)
    const trap: ExpLogPartTrap = { id: slip.id, text: typed(values[0]!), values, witness: slip.witness }
    traps.push(trap)
    // A promised slip gives a number she could take for the answer: within a factor of 6 of it.
    const ratio = values[0]! / o.values[0]!
    if (slip.promise !== false && ratio > 1 / 6 && ratio < 6) promisable.push(trap)
  }
  return {
    part: {
      id: o.id,
      kind: 'decimal',
      label: o.label,
      ask: o.ask,
      formatHint: o.money ? MONEY_HINT : NUMBER_HINT,
      nudge: o.nudge,
      ruleCard: o.ruleCard,
      reveal: o.reveal,
      answerText: o.money ? withCommas(answer) : answer,
      places: o.places,
      ...(o.money ? { money: true } : {}),
      ...(o.units ? { units: o.units } : {}),
      closedForms: o.closedForms,
      traps,
    },
    promisable,
  }
}

// ---------------------------------------------------------------------------
// em.interest
// ---------------------------------------------------------------------------

type InterestAsk = 'balance' | 'time' | 'double'

/** The interest problem for these numbers (exported for the hand-worked tests). n = 0 means continuously. */
export function interestProblem(o: { ask: InterestAsk; P: number; bp: number; n: number; t?: number; A?: number; places?: number }): Drafted {
  const rate = o.bp / 100
  const r = o.bp / 10000
  const rText = String(r)
  const continuous = o.n === 0
  const word = continuous ? 'continuously' : PERIOD_WORD[o.n]!
  const R = rate // the percent itself, the slip of putting 5 for 0.05
  const otherPeriods = [1, 2, 4, 12].filter((m) => m !== o.n)
  const slips: Slip[] = []
  let part: { part: ExpLogPart; promisable: ExpLogPartTrap[] }
  let prompt: string
  if (o.ask === 'balance') {
    const t = o.t!
    const value = continuous ? o.P * Math.exp(r * t) : o.P * (1 + r / o.n) ** (o.n * t)
    if (continuous) {
      slips.push({ id: 'exp_rate_percent', values: [o.P * Math.exp(R * t)], witness: `Your amount uses r = ${R}, the percent itself. In the formula, ${rate}% is r = ${rText}.` })
      slips.push({ id: 'exp_simple_interest', values: [o.P * (1 + r * t)], witness: 'Your amount is simple interest, P(1 + rt): the same interest every year. Compounded interest also earns interest on its interest.' })
      slips.push({ id: 'exp_continuous_swapped', values: [o.P * (1 + r / 12) ** (12 * t)], witness: 'Your amount compounds monthly, P(1 + r/12)^(12t). This account is compounded continuously.' })
      slips.push({ id: 'exp_continuous_swapped', values: [o.P * (1 + r) ** t], witness: 'Your amount compounds once a year, P(1 + r)^t. This account is compounded continuously.' })
      slips.push({ id: 'exp_exponent_missing', values: [o.P * Math.exp(r)], witness: `Your amount uses e^r, one year of growth. After ${t} years the exponent is r·t.` })
    } else {
      slips.push({ id: 'exp_rate_percent', values: [o.P * (1 + R / o.n) ** (o.n * t)], witness: `Your amount uses r = ${R}, the percent itself. In the formula, ${rate}% is r = ${rText}.` })
      for (const m of otherPeriods) {
        slips.push({ id: 'exp_wrong_period', values: [o.P * (1 + r / m) ** (m * t)], witness: `Your amount compounds ${PERIOD_WORD[m]} (n = ${m}). Compounded ${word} means n = ${o.n}.` })
      }
      slips.push({ id: 'exp_simple_interest', values: [o.P * (1 + r * t)], witness: 'Your amount is simple interest, P(1 + rt): the same interest every year. Compound interest also earns interest on its interest.' })
      slips.push({ id: 'exp_continuous_swapped', values: [o.P * Math.exp(r * t)], witness: `Your amount uses Pe^(rt), the formula for compounding continuously. This account is compounded ${word}.` })
      if (o.n !== 1) slips.push({ id: 'exp_exponent_missing', values: [o.P * (1 + r / o.n) ** t], witness: `Your exponent is ${t}, the number of years. Compounded ${word}, the account is compounded ${o.n} times a year, ${o.n}·${t} times in all.` })
    }
    prompt = `${dollars(o.P)} is invested at ${rate}% interest compounded ${word}. How much is in the account after ${t} years? Round to the nearest cent.`
    const closed = continuous ? `${o.P}*e^(${rText}*${t})` : `${o.P}*(1 + ${rText}/${o.n})^(${o.n}*${t})`
    part = decimalPart({
      id: 'answer',
      label: 'Balance',
      ask: `How much is in the account after ${t} years? Round to the nearest cent.`,
      places: 2,
      money: true,
      closedForms: [closed],
      values: [value],
      slips,
      nudge: continuous ? 'Write the rate as a decimal, then use the formula for compounding continuously.' : 'Write the rate as a decimal. The word for how often it compounds tells you n.',
      ruleCard: continuous ? EM_RULE_IDS.continuous : EM_RULE_IDS.compound,
      reveal: continuous
        ? [`Compounded continuously: A = Pe^(rt) with P = ${o.P}, r = ${rText}, t = ${t}.`, `A = ${o.P}e^(${rText}·${t}) ≈ ${withCommas(roundPlaces(value, 2))}.`, `The balance is $${withCommas(roundPlaces(value, 2))}.`]
        : [
            `A = P(1 + r/n)^(nt) with P = ${o.P}, r = ${rText}, n = ${o.n}, t = ${t}.`,
            `A = ${o.P}(1 + ${rText}/${o.n})^(${o.n}·${t}) ≈ ${withCommas(roundPlaces(value, 2))}.`,
            `The balance is $${withCommas(roundPlaces(value, 2))}.`,
          ],
    })
  } else {
    const ratio = o.ask === 'double' ? 2 : o.A! / o.P
    const ratioText = o.ask === 'double' ? '2' : `${o.A}/${o.P}`
    const places = o.places ?? 2
    const lnRatio = Math.log(ratio)
    const value = continuous ? lnRatio / r : lnRatio / (o.n * Math.log(1 + r / o.n))
    if (value > 40) throw new LogSkip('more than forty years')
    if (continuous) {
      slips.push({ id: 'exp_rate_percent', values: [lnRatio / R], witness: `Your time uses r = ${R}, the percent itself. In the formula, ${rate}% is r = ${rText}.` })
      slips.push({ id: 'exp_simple_interest', values: [(ratio - 1) / r], witness: 'Your time is for simple interest, P(1 + rt). Compounded interest grows faster, so it takes less time.' })
      slips.push({ id: 'exp_continuous_swapped', values: [lnRatio / (12 * Math.log(1 + r / 12))], witness: 'Your time is for compounding monthly. This account is compounded continuously: A = Pe^(rt).' })
      slips.push({ id: 'exp_continuous_swapped', values: [lnRatio / Math.log(1 + r)], witness: 'Your time is for compounding once a year. This account is compounded continuously: A = Pe^(rt).' })
    } else {
      slips.push({ id: 'exp_rate_percent', values: [lnRatio / (o.n * Math.log(1 + R / o.n))], witness: `Your time uses r = ${R}, the percent itself. In the formula, ${rate}% is r = ${rText}.` })
      for (const m of otherPeriods) {
        slips.push({ id: 'exp_wrong_period', values: [lnRatio / (m * Math.log(1 + r / m))], witness: `Your time is for compounding ${PERIOD_WORD[m]} (n = ${m}). Compounded ${word} means n = ${o.n}.` })
      }
      slips.push({ id: 'exp_simple_interest', values: [(ratio - 1) / r], witness: 'Your time is for simple interest, P(1 + rt). Compound interest grows faster, so it takes less time.' })
      slips.push({ id: 'exp_continuous_swapped', values: [lnRatio / r], witness: `Your time is for compounding continuously, A = Pe^(rt). This account is compounded ${word}.` })
      if (o.n !== 1) slips.push({ id: 'exp_exponent_missing', values: [lnRatio / Math.log(1 + r / o.n)], witness: `Your number counts compounding periods, n·t. Compounded ${word}, that is ${o.n} periods a year: divide by ${o.n} to get years.` })
    }
    const question = o.ask === 'double' ? 'How long will it take the investment to double?' : `How long will it take for the balance to reach ${dollars(o.A!)}?`
    prompt =
      o.ask === 'double'
        ? `An investment earns ${rate}% interest compounded ${word}. How long will it take the investment to double? ${ROUND_YEARS[places]}`
        : `${dollars(o.P)} is invested at ${rate}% interest compounded ${word}. ${question} ${ROUND_YEARS[places]}`
    const closed = continuous ? `ln(${ratioText})/${rText}` : `ln(${ratioText})/(${o.n}*ln(1 + ${rText}/${o.n}))`
    const set = o.ask === 'double' ? 'A = 2P' : `A = ${o.A}, P = ${o.P}`
    part = decimalPart({
      id: 'answer',
      label: o.ask === 'double' ? 'Doubling time' : 'Time',
      ask: `${question} ${ROUND_YEARS[places]}`,
      places,
      units: UNITS.year,
      closedForms: [closed],
      values: [value],
      slips,
      nudge: o.ask === 'double' ? 'Doubling means A = 2P. Divide both sides by P, then take ln of both sides to bring the exponent down.' : 'Put the numbers into the formula, divide both sides by P, then take ln of both sides to bring the exponent down.',
      ruleCard: EM_RULE_IDS.time,
      reveal: continuous
        ? [`A = Pe^(rt) with ${set} and r = ${rText}: e^(${rText}t) = ${say(ratioText)}.`, `Take ln of both sides: ${rText}t = ln(${say(ratioText)}), so t = ln(${say(ratioText)})/${rText} ≈ ${roundPlaces(value, places)}.`, `It takes about ${roundPlaces(value, places)} years.`]
        : [
            `A = P(1 + r/n)^(nt) with ${set}, r = ${rText}, n = ${o.n}: (1 + ${rText}/${o.n})^(${o.n}t) = ${say(ratioText)}.`,
            `Take ln of both sides: ${o.n}t·ln(1 + ${rText}/${o.n}) = ln(${say(ratioText)}).`,
            `t = ln(${say(ratioText)})/(${o.n}·ln(1 + ${rText}/${o.n})) ≈ ${roundPlaces(value, places)}.`,
            `It takes about ${roundPlaces(value, places)} years.`,
          ],
    })
  }
  return finish('interest', prompt, undefined, [part], [EM_RULE_IDS.compound, EM_RULE_IDS.continuous, EM_RULE_IDS.time])
}

function drawInterest(rng: Rng): Drafted {
  const P = rng.chance(0.6) ? 500 * rng.int(1, 30) : 100 * rng.int(5, 99)
  const bp = 25 * rng.int(8, 32)
  const n = rng.chance(0.3) ? 0 : rng.pick([1, 2, 4, 12, 12, 4] as const)
  const roll = rng.int(0, 99)
  if (roll < 50) return interestProblem({ ask: 'balance', P, bp, n, t: rng.int(2, 30) })
  const places = rng.pick([1, 2, 2] as const)
  if (roll < 78) {
    const A = Math.round((P * (1.2 + rng.int(1, 28) / 10)) / 100) * 100
    if (A <= P * 1.15) throw new LogSkip('target too close to the principal')
    return interestProblem({ ask: 'time', P, bp, n, A, places })
  }
  return interestProblem({ ask: 'double', P, bp, n, places })
}

// ---------------------------------------------------------------------------
// em.halflife
// ---------------------------------------------------------------------------

type DecayAsk = 'left' | 'time' | 'carbon' | 'halflife'

/** The decay problem for these numbers (exported for the hand-worked tests). */
export function halfLifeProblem(o: {
  ask: DecayAsk
  A0?: number
  A?: number
  h?: number
  t?: number
  /** carbon: percent left, or percent lost when `lost` is set. */
  percent?: number
  lost?: boolean
  mass?: 'gram' | 'milligram'
  time?: 'day' | 'hour' | 'year'
  places: number
}): Drafted {
  const mass = o.mass ?? 'gram'
  const time = o.time ?? 'day'
  const slips: Slip[] = []
  let part: { part: ExpLogPart; promisable: ExpLogPartTrap[] }
  let prompt: string
  const plural = (unit: string) => `${unit}s`
  if (o.ask === 'left') {
    const { A0, h, t } = o as Required<typeof o>
    const value = A0 * 0.5 ** (t / h)
    slips.push({ id: 'exp_halflife_inverted', values: [A0 * 0.5 ** (h / t)], witness: `Your exponent is ${h}/${t}, the half-life over the time. The number of half-lives is the time over the half-life.` })
    slips.push({ id: 'exp_halflife_decayed', values: [A0 - value], witness: 'Your amount is how much decayed: the start minus what is left. The formula gives what is still there.' })
    prompt = `A ${A0}-${mass} sample of a radioactive isotope has a half-life of ${h} ${plural(time)}. How much of it is left after ${t} ${plural(time)}? ${roundWords(o.places, mass)}`
    part = decimalPart({
      id: 'answer',
      label: 'Amount left',
      ask: `How much is left after ${t} ${plural(time)}? ${roundWords(o.places, mass)}`,
      places: o.places,
      units: UNITS[mass],
      closedForms: [`${A0}*(1/2)^(${t}/${h})`],
      values: [value],
      slips,
      nudge: 'Count the half-lives first: the time divided by the half-life. Each one halves what is left.',
      ruleCard: EM_RULE_IDS.halfLife,
      reveal: [`A = A₀(1/2)^(t/h) with A₀ = ${A0}, h = ${h}, t = ${t}.`, `A = ${A0}(1/2)^(${t}/${h}) ≈ ${roundPlaces(value, o.places)}.`, `About ${roundPlaces(value, o.places)} ${plural(mass)} are left.`],
    })
  } else if (o.ask === 'time' || o.ask === 'carbon') {
    const carbon = o.ask === 'carbon'
    const h = carbon ? 5730 : o.h!
    const q = carbon ? (o.lost ? 1 - o.percent! / 100 : o.percent! / 100) : o.A! / o.A0!
    const qText = carbon ? roundPlaces(q, 2).replace(/0+$/, '').replace(/\.$/, '') : `${o.A}/${o.A0}`
    const value = (h * Math.log(q)) / LN_HALF
    slips.push({ id: 'exp_halflife_inverted', values: [(h * LN_HALF) / Math.log(q)], witness: 'Your time comes from the exponent h/t, the half-life over the time. The number of half-lives is t/h: the time over the half-life.' })
    slips.push({
      id: 'exp_halflife_base',
      values: [h],
      witness: `Your time is exactly one half-life. That is what you get when the fraction left replaces the 1/2: q^(t/h) = q gives t = h. The base stays 1/2, and the fraction left is what the power equals.`,
    })
    slips.push({
      id: 'exp_halflife_decayed',
      values: [(h * Math.log(1 - q)) / LN_HALF],
      witness: carbon
        ? o.lost
          ? `Your time uses ${o.percent}% as the part that is left. The problem says that much was lost.`
          : `Your time uses ${100 - o.percent!}%, the part that decayed. The problem says ${o.percent}% is left.`
        : `Your time uses the amount that decayed, ${o.A0! - o.A!} ${plural(mass)}. The formula needs what is left.`,
    })
    if (carbon) {
      prompt = o.lost
        ? `A wooden tool has lost ${o.percent}% of its carbon-14. The half-life of carbon-14 is 5730 years. How old is the tool? ${roundWords(o.places, 'year')}`
        : `A bone contains ${o.percent}% of the carbon-14 that a living bone has. The half-life of carbon-14 is 5730 years. How old is the bone? ${roundWords(o.places, 'year')}`
    } else {
      prompt = `A radioactive isotope has a half-life of ${h} ${plural(time)}. How long will it take a ${o.A0}-${mass} sample to decay to ${o.A} ${plural(mass)}? ${roundWords(o.places, time)}`
    }
    const unit = carbon ? 'year' : time
    part = decimalPart({
      id: 'answer',
      label: carbon ? 'Age' : 'Time',
      ask: carbon ? `How old is it? ${roundWords(o.places, 'year')}` : `How long will it take? ${roundWords(o.places, unit)}`,
      places: o.places,
      units: UNITS[unit],
      closedForms: [`${h}*ln(${qText})/ln(1/2)`],
      values: [value],
      slips,
      nudge: carbon
        ? 'Write the fraction of carbon-14 that is left. Set (1/2)^(t/5730) equal to it, then take ln of both sides.'
        : 'Divide by the starting amount, so (1/2)^(t/h) equals the fraction left. Then take ln of both sides.',
      ruleCard: EM_RULE_IDS.halfLife,
      reveal: [
        `The fraction left is ${say(qText)}: (1/2)^(t/${h}) = ${say(qText)}.`,
        `Take ln of both sides: (t/${h})·ln(1/2) = ln(${say(qText)}), so t = ${h}·ln(${say(qText)})/ln(1/2) ≈ ${roundPlaces(value, o.places)}.`,
        carbon ? `It is about ${withCommas(roundPlaces(value, o.places))} years old.` : `It takes about ${roundPlaces(value, o.places)} ${plural(time)}.`,
      ],
    })
  } else {
    const { A0, A, t } = o as Required<typeof o>
    const q = A / A0
    const value = (t * LN_HALF) / Math.log(q)
    slips.push({ id: 'exp_halflife_inverted', values: [(t * Math.log(q)) / LN_HALF], witness: 'Your half-life comes from the exponent h/t. The number of half-lives is t/h, the time over the half-life.' })
    slips.push({ id: 'exp_halflife_base', values: [t], witness: 'Your half-life equals the time given. That is what you get when the fraction left replaces the 1/2: q^(t/h) = q gives h = t. The base stays 1/2.' })
    slips.push({ id: 'exp_halflife_decayed', values: [(t * LN_HALF) / Math.log(1 - q)], witness: `Your half-life uses the amount that decayed, ${A0 - A} ${plural(mass)}. The formula needs what is left.` })
    prompt = `A ${A0}-${mass} sample of a radioactive substance decays to ${A} ${plural(mass)} in ${t} ${plural(time)}. What is its half-life? ${roundWords(o.places, time)}`
    part = decimalPart({
      id: 'answer',
      label: 'Half-life',
      ask: `What is the half-life? ${roundWords(o.places, time)}`,
      places: o.places,
      units: UNITS[time],
      closedForms: [`${t}*ln(1/2)/ln(${A}/${A0})`],
      values: [value],
      slips,
      nudge: 'Divide by the starting amount: (1/2)^(t/h) equals the fraction left. Take ln of both sides, then solve for h.',
      ruleCard: EM_RULE_IDS.halfLife,
      reveal: [
        `(1/2)^(${t}/h) = ${A}/${A0}.`,
        `Take ln of both sides: (${t}/h)·ln(1/2) = ln(${A}/${A0}), so h = ${t}·ln(1/2)/ln(${A}/${A0}) ≈ ${roundPlaces(value, o.places)}.`,
        `The half-life is about ${roundPlaces(value, o.places)} ${plural(time)}.`,
      ],
    })
  }
  return finish('halflife', prompt, 'A = A_0\\left(\\tfrac{1}{2}\\right)^{t/h}', [part], [EM_RULE_IDS.halfLife, EM_RULE_IDS.time])
}

function drawHalfLife(rng: Rng): Drafted {
  const roll = rng.int(0, 99)
  const time = rng.pick(['day', 'hour', 'year'] as const)
  const h = time === 'hour' ? rng.int(2, 24) : time === 'day' ? rng.int(3, 60) : rng.int(5, 90)
  const mass = rng.chance(0.5) ? 'gram' : 'milligram'
  const A0 = mass === 'gram' ? 10 * rng.int(2, 50) : 25 * rng.int(2, 40)
  const places = rng.pick([1, 2] as const)
  if (roll < 30) {
    const t = rng.int(Math.max(1, Math.round(0.3 * h)), Math.round(4 * h))
    if (t === h) throw new LogSkip('one half-life exactly')
    return halfLifeProblem({ ask: 'left', A0, h, t, mass, time, places })
  }
  if (roll < 70 && roll >= 45) {
    const lost = rng.chance(0.35)
    const percent = rng.intExcept(5, 95, [50])
    return halfLifeProblem({ ask: 'carbon', percent, lost, places: 0 })
  }
  const A = Math.round(A0 * (rng.int(8, 90) / 100))
  if (A <= 0 || A >= A0 || 2 * A === A0) throw new LogSkip('not a decay to a smaller amount')
  if (roll < 45) return halfLifeProblem({ ask: 'time', A0, A, h, mass, time, places })
  const t = time === 'hour' ? rng.int(2, 30) : time === 'day' ? rng.int(2, 60) : rng.int(5, 80)
  return halfLifeProblem({ ask: 'halflife', A0, A, t, mass, time, places })
}

// ---------------------------------------------------------------------------
// em.growth
// ---------------------------------------------------------------------------

/** n/d as a terminating decimal ("1.5" for 270/180), or null. */
function terminating(n: number, d: number): string | null {
  const g = gcd(n, d)
  let rest = d / g
  while (rest % 2 === 0) rest /= 2
  while (rest % 5 === 0) rest /= 5
  if (rest !== 1) return null
  const text = (n / d).toFixed(10).replace(/0+$/, '').replace(/\.$/, '')
  return text.includes('.') ? text : null
}

/** The growth problem for these numbers (exported for the hand-worked tests). */
export function growthProblem(o: { who: 'bacteria' | 'town'; P0: number; P1: number; t1: number; follow: { ask: 'predict'; T: number } | { ask: 'reach'; S: number; places: number } }): Drafted {
  const { P0, P1, t1 } = o
  const unit = o.who === 'bacteria' ? 'hour' : 'year'
  const g = gcd(P1, P0)
  const kExpr = `ln(${P1}/${P0})/${t1}`
  const kAnswer = P0 / g === 1 ? `ln(${P1 / g})/${t1}` : `ln(${P1 / g}/${P0 / g})/${t1}`
  const k = Math.log(P1 / P0) / t1
  const kRounded = Number(roundPlaces(k, 4))
  if (!(kRounded > 0)) throw new LogSkip('k rounds to 0')
  const count = (n: number) => (o.who === 'town' ? withCommas(String(n)) : String(n))
  const kSlips = (): Slip[] => [
    { id: 'exp_growth_no_log', values: [P1 / P0 / t1], witness: `Your k is the ratio ${P1}/${P0} divided by ${t1}. kt is an exponent of e, so it comes down with ln first.` },
    { id: 'exp_growth_log_diff', values: [Math.log(P1 - P0) / t1], witness: `Your k uses ln(${P1} − ${P0}), the log of the difference. P₀ multiplies e^(kt), so divide by it: the ratio, not the difference.` },
    { id: 'exp_growth_swapped', values: [t1 / Math.log(P1 / P0)], witness: 'Your k has the time on top and the ln of the counts underneath. kt equals the ln, so k is the ln divided by the time.' },
    { id: 'log_ln_confused', values: [Math.log10(P1 / P0) / t1], witness: 'Your k uses log, the base-10 LOG key. e^(kt) is undone by ln, the LN key.' },
    { id: 'log_quotient_as_quotient', values: [Math.log(P1) / Math.log(P0) / t1], witness: `Your k uses ln(${P1})/ln(${P0}), a quotient of two logs. The ln of the ratio ${P1}/${P0} is a different number.` },
  ]
  // (a) the exact k
  const exactTraps: ExpLogPartTrap[] = []
  const textOf: Record<string, string> = {
    exp_growth_no_log: `(${P1}/${P0})/${t1}`,
    exp_growth_log_diff: `ln(${P1 - P0})/${t1}`,
    exp_growth_swapped: `${t1}/ln(${P1}/${P0})`,
    log_ln_confused: `log(${P1}/${P0})/${t1}`,
    log_quotient_as_quotient: `ln(${P1})/ln(${P0})/${t1}`,
  }
  const seen: number[] = [k]
  for (const s of kSlips()) {
    const v = s.values[0]!
    if (!Number.isFinite(v) || seen.some((w) => Math.abs(v - w) < 1e-4)) throw new LogSkip(`${s.id} gives the same k`)
    seen.push(v)
    exactTraps.push({ id: s.id, text: textOf[s.id]!, values: [v], witness: s.witness })
  }
  const exactPart: ExpLogPart = {
    id: 'k',
    kind: 'exact',
    label: 'k, exactly',
    ask: 'Find k. Give the exact value.',
    formatHint: EXACT_HINT,
    nudge: `Put both counts into P = P₀e^(kt): ${count(P1)} = ${count(P0)}e^(${t1}k). Divide by ${count(P0)}, then take ln of both sides.`,
    ruleCard: EM_RULE_IDS.growth,
    reveal: [`${count(P1)} = ${count(P0)}e^(${t1}k), so e^(${t1}k) = ${P1}/${P0}.`, `Take ln of both sides: ${t1}k = ln(${P1}/${P0}), so k = ln(${P1}/${P0})/${t1} = ${say(kAnswer)}.`],
    answerText: kAnswer,
    // Every equal exact form is right (gradeLogValue's exact model); these are the ones the self-check types.
    closedForms: [kExpr, ...(terminating(P1, P0) ? [`ln(${terminating(P1, P0)})/${t1}`] : [])],
    traps: exactTraps,
  }
  // (b) k rounded
  const rounded = decimalPart({
    id: 'kRounded',
    label: 'k, rounded',
    ask: 'Round k to four decimal places.',
    places: 4,
    closedForms: [kExpr],
    values: [k],
    slips: kSlips(),
    nudge: 'Work out your exact k on the calculator, with the LN key, and round it to four decimal places.',
    ruleCard: EM_RULE_IDS.growth,
    reveal: [`k = ${say(kAnswer)} ≈ ${roundPlaces(k, 4)}.`],
  })
  // (c) a prediction, or the time to reach a size, with the exact k or the rounded k
  let follow: { part: ExpLogPart; promisable: ExpLogPartTrap[] }
  const things = o.who === 'bacteria' ? 'bacteria' : 'people'
  if (o.follow.ask === 'predict') {
    const T = o.follow.T
    const exact = P0 * Math.exp(k * T)
    const near = P0 * Math.exp(kRounded * T)
    follow = decimalPart({
      id: 'follow',
      label: o.who === 'bacteria' ? `Bacteria after ${T} hours` : `Population after ${T} years`,
      ask: o.who === 'bacteria' ? `How many bacteria will there be after ${T} hours? Round to the nearest whole number.` : `What will the population be after ${T} years? Round to the nearest whole number.`,
      places: 0,
      units: UNITS[things],
      closedForms: [`${P0}*e^((${kExpr})*${T})`, `${P0}*e^(${kRounded}*${T})`],
      values: [exact, near],
      slips: [],
      nudge: `Put t = ${T} into P = ${count(P0)}e^(kt), with your k.`,
      ruleCard: EM_RULE_IDS.growth,
      reveal: [`P = ${count(P0)}e^(k·${T}) with k = ${say(kAnswer)}: about ${withCommas(roundPlaces(exact, 0))}.`, `With k rounded to ${kRounded}, it is about ${withCommas(roundPlaces(near, 0))}. Either is right.`],
    })
  } else {
    const { S, places } = o.follow
    const lnS = Math.log(S / P0)
    const exact = lnS / k
    const near = lnS / kRounded
    follow = decimalPart({
      id: 'follow',
      label: o.who === 'bacteria' ? `Time to reach ${S} bacteria` : `Time to reach ${withCommas(String(S))} people`,
      ask: o.who === 'bacteria' ? `When will there be ${S} bacteria? ${roundWords(places, unit)}` : `When will the population reach ${withCommas(String(S))}? ${roundWords(places, unit)}`,
      places,
      units: UNITS[unit],
      closedForms: [`ln(${S}/${P0})/(${kExpr})`, `ln(${S}/${P0})/${kRounded}`],
      values: [exact, near],
      slips: [
        { id: 'exp_growth_no_log', values: [S / P0 / k, S / P0 / kRounded], witness: `Your time is the ratio ${S}/${P0} divided by k. kt is an exponent of e: take ln of both sides first.` },
        { id: 'exp_growth_log_diff', values: [Math.log(S - P0) / k, Math.log(S - P0) / kRounded], witness: `Your time uses ln(${S} − ${P0}), the log of the difference. Divide by P₀ first: the ratio, not the difference.` },
        { id: 'exp_growth_swapped', values: [k / lnS, kRounded / lnS], witness: 'Your time has k on top and the ln of the counts underneath. kt equals the ln, so t is the ln divided by k.', promise: false },
        { id: 'log_ln_confused', values: [Math.log10(S / P0) / k, Math.log10(S / P0) / kRounded], witness: 'Your time uses log, the base-10 LOG key. e^(kt) is undone by ln, the LN key.' },
      ],
      nudge: `Set P = ${count(S)}: ${count(S)} = ${count(P0)}e^(kt). Divide by ${count(P0)}, take ln of both sides, then divide by k.`,
      ruleCard: EM_RULE_IDS.growth,
      reveal: [
        `${count(S)} = ${count(P0)}e^(kt), so e^(kt) = ${S}/${P0} and kt = ln(${S}/${P0}).`,
        `t = ln(${S}/${P0})/k ≈ ${roundPlaces(exact, places)} with the exact k (${roundPlaces(near, places)} with k ≈ ${kRounded}).`,
      ],
    })
  }
  const promisable = [...exactTraps, ...rounded.promisable, ...follow.promisable]
  const stages = [exactPart, rounded.part, follow.part]
  const prompt =
    o.who === 'bacteria'
      ? `A culture of bacteria grows according to P = P₀e^(kt), where t is the time in hours. There are ${P0} bacteria at the start and ${P1} after ${t1} hours.`
      : `The population of a town grows according to P = P₀e^(kt), where t is the time in years. The town has ${count(P0)} people now and ${count(P1)} after ${t1} years.`
  return finishParts('growth', prompt, 'P = P_0e^{kt}', stages, promisable, [EM_RULE_IDS.growth, EM_RULE_IDS.time])
}

function drawGrowth(rng: Rng): Drafted {
  const bacteria = rng.chance(0.55)
  const P0 = bacteria ? 50 * rng.int(2, 20) : 1000 * rng.int(5, 80)
  const P1 = Math.round((P0 * (100 + 5 * rng.int(1, 20))) / 100)
  const t1 = bacteria ? rng.int(2, 8) : rng.int(3, 10)
  if (P1 <= P0) throw new LogSkip('no growth')
  if (rng.chance(0.5)) return growthProblem({ who: bacteria ? 'bacteria' : 'town', P0, P1, t1, follow: { ask: 'predict', T: t1 + rng.int(2, 12) } })
  const scale = bacteria ? 50 : 1000
  const S = Math.round((P0 * (P1 / P0 + 0.5 + rng.int(0, 25) / 10)) / scale) * scale
  if (S <= P1) throw new LogSkip('the target is not past the second count')
  return growthProblem({ who: bacteria ? 'bacteria' : 'town', P0, P1, t1, follow: { ask: 'reach', S, places: rng.pick([1, 2] as const) } })
}

// ---------------------------------------------------------------------------
// Assembling and checking
// ---------------------------------------------------------------------------

export interface Drafted {
  question: ExpModelsAnswer['question']
  prompt: string
  modelTex?: string
  stages: ExpLogPart[]
  /** The exp_ traps that may be promised: the brief's slips, with a value that looks like an answer. */
  promisable: ExpLogPartTrap[]
  ruleCards: string[]
}

function finish(question: ExpModelsAnswer['question'], prompt: string, modelTex: string | undefined, parts: { part: ExpLogPart; promisable: ExpLogPartTrap[] }[], ruleCards: string[]): Drafted {
  return finishParts(question, prompt, modelTex, parts.map((p) => p.part), parts.flatMap((p) => p.promisable), ruleCards)
}

function finishParts(question: ExpModelsAnswer['question'], prompt: string, modelTex: string | undefined, stages: ExpLogPart[], promisable: ExpLogPartTrap[], ruleCards: string[]): Drafted {
  return { question, prompt, ...(modelTex ? { modelTex } : {}), stages, promisable: promisable.filter((tr) => tr.id.startsWith('exp_')), ruleCards }
}

/** Every spelling of a part's answer that has to grade right. */
export function modelForms(part: ExpLogPart): string[] {
  if (part.kind === 'exact') return [part.answerText, ...(part.closedForms ?? [])]
  const plain = part.answerText.replace(/,/g, '')
  const forms = [part.answerText, plain, withCommas(plain)]
  if (part.money) forms.push(`$${withCommas(plain)}`, `$${plain}`, `${plain} dollars`, `A = ${plain}`)
  else forms.push(`t = ${plain}`)
  if (part.units?.length) forms.push(`${withCommas(plain)} ${part.units[0]}`)
  return [...new Set(forms)]
}

function cardTexts(): string[] {
  return EM_RULES.flatMap((r) => [r.title, r.body, r.example ?? ''])
}

/** The draw, assembled and checked: every answer and spelling right, every trap its own id, nothing shown early. */
export function modelAnswer(d: Drafted, pick: (traps: readonly ExpLogPartTrap[]) => ExpLogPartTrap): ExpModelsAnswer {
  if (!d.promisable.length) throw new LogSkip('no trap to promise')
  const chosen = pick(d.promisable)
  const stage = d.stages.find((s) => s.traps.includes(chosen))!
  const answer: ExpModelsAnswer = {
    type: 'expModels',
    question: d.question,
    prompt: d.prompt,
    ...(d.modelTex ? { modelTex: d.modelTex } : {}),
    stages: d.stages,
    expectedDisplay: d.stages
      .map((s) => `${s.label}: ${s.money ? '$' : ''}${say(s.kind === 'decimal' ? withCommas(s.answerText.replace(/,/g, '')) : s.answerText)}${s.units?.[0] ? ` ${s.units[0]}` : ''}`)
      .join('; '),
    nudge: d.stages[0]!.nudge,
    ruleCard: d.stages[0]!.ruleCard,
    ruleCards: d.ruleCards,
    reveal: d.stages.flatMap((s) => s.reveal),
    trap: chosen.id,
    trapStage: stage.id,
    trapAnswer: chosen.text,
  }
  for (const part of answer.stages) {
    // The answer itself (and, for k, each exact form) grades right. The other spellings of a number ($, commas,
    // units) are the reader's job and are covered by the tests over 300 seeds.
    for (const form of part.kind === 'exact' ? modelForms(part) : [part.answerText]) {
      const g = gradeExpLogPart(part, form)
      if (g.verdict !== 'correct') throw new LogSkip(`${part.id}: “${form}” graded ${g.verdict}`)
    }
  }
  // Every trap already stands apart from the right values and from each other at the rounding asked (or, for the
  // exact k, as a number), which is what makes it grade as its own id; the promised one is graded here, and the
  // tests grade every trap of 300 seeds.
  const g = gradeExpLogPart(stage, chosen.text)
  if (g.verdict !== 'mistake' || g.mistake !== chosen.id) throw new LogSkip(`the promised ${chosen.id} “${chosen.text}” graded ${g.verdict === 'mistake' ? g.mistake : g.verdict}`)
  const found = leaks(answer.prompt, INSTRUCTIONS[answer.question], answer.stages, modelForms, cardTexts())
  if (found.length) throw new LogSkip(`a text she sees early spells an answer: ${found[0]}`)
  return answer
}

const TITLES: Record<ExpModelsAnswer['question'], string> = {
  interest: 'Compound and continuous interest',
  halflife: 'Half-life and decay',
  growth: 'Continuous growth',
}

function generate(templateId: string, salt: number, draw: (rng: Rng) => Drafted) {
  return (seed: number, knobs: DifficultyKnobs = {}): ProblemInstance => {
    const answer = searchSeed(seed, salt, 64, (rng) => modelAnswer(draw(rng), (traps) => rng.pick(traps)))
    return {
      id: problemId(EM_MODULE_ID, templateId, VERSION, seed),
      moduleId: EM_MODULE_ID,
      templateId,
      skill: templateId,
      genVersion: VERSION,
      seed: seed >>> 0,
      knobs,
      kind: 'expModels',
      title: TITLES[answer.question],
      instructions: INSTRUCTIONS[answer.question],
      statementText: answer.prompt,
      vars: [],
      start: null,
      canonical: [],
      answer,
      graph: NO_GRAPH,
      calc: NO_CALC,
      params: { question: answer.question, trap: answer.trap, trapStage: answer.trapStage, answer: answer.stages.map((s) => s.answerText).join(' | ') },
    }
  }
}

export const interestTemplate: TemplateDef = {
  id: 'em.interest',
  title: 'Compound and continuous interest',
  description: 'The balance to the cent, the time to reach a balance, or the doubling time, compounded n times a year or continuously.',
  version: VERSION,
  knobs: [],
  generate: generate('em.interest', 51, drawInterest),
}

export const halflifeTemplate: TemplateDef = {
  id: 'em.halflife',
  title: 'Half-life and decay',
  description: 'The amount left, the time to decay to an amount, carbon-14 dating, or the half-life from two measurements.',
  version: VERSION,
  knobs: [],
  generate: generate('em.halflife', 52, drawHalfLife),
}

export const growthTemplate: TemplateDef = {
  id: 'em.growth',
  title: 'Continuous growth',
  description: 'k from two counts, exactly and rounded, then a prediction or the time to reach a size.',
  version: VERSION,
  knobs: [],
  generate: generate('em.growth', 53, drawGrowth),
}

export const EM_TEMPLATES = [interestTemplate, halflifeTemplate, growthTemplate] as const

/** Grade her entry for one part of a word problem. */
export function gradeEmPart(answer: ExpModelsAnswer, stageId: string, text: string): PartGrade {
  const part = answer.stages.find((s) => s.id === stageId)
  if (!part) return { verdict: 'invalid', message: 'This part could not be found.' }
  return gradeExpLogPart(part, text)
}

export { partsWork as emWork } from '../explog/parts'
