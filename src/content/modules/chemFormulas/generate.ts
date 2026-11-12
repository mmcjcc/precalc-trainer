/**
 * Chapter 10, percent composition and formulas: three templates. Substance, variant, element asked
 * about, measured masses, rounding place and wording all come from makeRng(mixSeed(seed, k)).
 * Empirical data are drawn from a real formula and kept only when the mole ratios come out clean
 * (each within 0.03 of its target, none readable two ways), with the moles rounded or not.
 */
import type { Rng } from '@/content/rng'
import { measurement } from '@/content/modules/sigFigs/numbers'
import { rat, ratCmp, ratDiv, ratMul, roundRatToPlace, roundRatToSigFigs, type Rat } from '@/engine/sigfigs/decimal'
import { canonicalForms } from '@/engine/sigfigs/round'
import type { MoCount } from '@/content/types'
import { makeMoleTemplate, prettyNumber, type BuiltStage, type Drawn } from '../moles/build'
import { POOLS, molarMassStage } from '../moles/generate'
import {
  atomicMassText,
  countsDisplay,
  countsMassHundredths,
  countsOf,
  DRAWABLE,
  elementName,
  empiricalCounts,
  hundredthsText,
  massHundredths,
  massList,
  ratOf,
  molarMassHundredths,
  sameCounts,
  show,
  symbolsOf,
  substanceOf,
  type MoSubstance,
} from '../moles/facts'
import { molesOf, percentByMass, solveEmpirical, solveFromMoles } from './facts'
import { multiplierOf } from './grade'

const pretty = prettyNumber

function textOf(r: { m: bigint; place: number }): string {
  return canonicalForms(r.m, r.place).text
}

function placeWord(place: number): string {
  return place === -1 ? 'tenths' : 'hundredths'
}

function ratText(r: Rat, figs: number): string {
  return textOf(roundRatToSigFigs(r, figs))
}

// ---------------------------------------------------------------------------
// cf.percent
// ---------------------------------------------------------------------------

const FORMULA_POOL: readonly MoSubstance[] = [...POOLS.molecular, ...POOLS.salt]
const BINARY_POOL: readonly MoSubstance[] = FORMULA_POOL.filter((s) => countsOf(s).length === 2)

const PERCENT_OPENERS: readonly ((s: MoSubstance) => string)[] = [
  (s) => `How is the mass of ${s.name} (${show(s.key)}) shared among its elements?`,
  (s) => `A label on a jar of ${s.name}, ${show(s.key)}, wants its percent composition.`,
  (s) => `Break ${s.name} (${show(s.key)}) down by mass.`,
  (s) => `Your lab report needs the makeup of ${s.name}, ${show(s.key)}, by mass.`,
]

function percentStage(s: MoSubstance, symbol: string, place: number): BuiltStage {
  const k = countsOf(s).find((c) => c.symbol === symbol)!.n
  const part = k > 1 ? `${k} × ${atomicMassText(symbol)}` : atomicMassText(symbol)
  return {
    kind: 'number',
    label: `Percent ${elementName(symbol)} (${symbol}) by mass`,
    hint: `As a percent, to the ${placeWord(place)} place.`,
    nudge: 'Find this element’s mass in one mole of the compound, then compare it with the whole molar mass.',
    ruleCard: 'cf.percent',
    unit: '%',
    check: { kind: 'percent', formula: s.key, element: symbol, place },
    reveal: (answer) => `${part} ÷ ${hundredthsText(molarMassHundredths(s))} × 100 = ${answer}%.`,
  }
}

function drawFormulaPercent(rng: Rng): Drawn {
  const s = rng.pick(FORMULA_POOL)
  const counts = countsOf(s)
  const place = rng.chance(0.5) ? -1 : -2
  const several = counts.filter((c) => c.n > 1)
  const x = several.length > 0 && rng.chance(0.6) ? rng.pick(several).symbol : rng.pick(counts).symbol
  const y = rng.pick(counts.filter((c) => c.symbol !== x)).symbol
  const opener = rng.int(0, PERCENT_OPENERS.length - 1)
  const prompt = `${PERCENT_OPENERS[opener]!(s)} Use atomic masses rounded to the hundredths: ${massList(symbolsOf(s))}. Give each percent to the ${placeWord(place)} place.`
  return {
    prompt,
    drafts: [molarMassStage(s), percentStage(s, x, place), percentStage(s, y, place)],
    extraCards: ['mo.molarMass'],
    params: { variant: 'formula', formula: s.key, x, y, place, opener },
  }
}

const SAMPLE_OPENERS: readonly ((s: MoSubstance) => string)[] = [
  (s) => `A sample of ${s.name} (${show(s.key)}) is broken down into its elements:`,
  (s) => `Decomposing a sample of ${s.name}, ${show(s.key)}, gives`,
  (s) => `In the lab, a sample of ${s.name} (${show(s.key)}) separates into`,
]

function drawSamplePercent(rng: Rng): Drawn {
  const s = rng.pick(BINARY_POOL)
  const [c1, c2] = countsOf(s) as [MoCount, MoCount]
  const m1 = measurement(rng, 3, rng.pick([0, 1, 1]))
  const share = ratDiv(rat(BigInt(c2.n) * massHundredths(c2.symbol)), rat(BigInt(c1.n) * massHundredths(c1.symbol)))
  const m2 = ratText(ratMul(ratOf(m1), share), 3)
  const parts = [
    { symbol: c1.symbol, grams: m1 },
    { symbol: c2.symbol, grams: m2 },
  ]
  const first = rng.chance(0.5) ? c1.symbol : c2.symbol
  const second = first === c1.symbol ? c2.symbol : c1.symbol
  const opener = rng.int(0, SAMPLE_OPENERS.length - 1)
  const listed = parts.map((p) => `${pretty(p.grams)} g of ${elementName(p.symbol)}`).join(' and ')
  const prompt = `${SAMPLE_OPENERS[opener]!(s)} ${listed}. Find the percent of each element in the sample.`
  const stage = (symbol: string): BuiltStage => {
    const grams = parts.find((p) => p.symbol === symbol)!.grams
    return {
      kind: 'number',
      label: `Percent ${elementName(symbol)} (${symbol}) in the sample`,
      hint: 'As a percent; keep the figures the measurements support.',
      nudge: 'One element’s grams over the grams of the whole sample, times 100.',
      ruleCard: 'cf.percent',
      unit: '%',
      check: { kind: 'percent-sample', parts, element: symbol },
      reveal: (answer) => `${pretty(grams)} g ÷ (${parts.map((p) => pretty(p.grams)).join(' + ')}) g × 100 = ${pretty(answer)}%.`,
    }
  }
  return {
    prompt,
    drafts: [stage(first), stage(second)],
    params: { variant: 'sample', formula: s.key, first, m1, m2, opener },
  }
}

const HYDRATE_OPENERS: readonly ((s: MoSubstance) => string)[] = [
  (s) => `How much of ${s.name} (${show(s.key)}) is water?`,
  (s) => `Heat ${s.name}, ${show(s.key)}, and its water steams away. First, the numbers:`,
  (s) => `A bottle of ${s.name} (${show(s.key)}) sits on the shelf.`,
]

function drawHydratePercent(rng: Rng): Drawn {
  const s = rng.pick(POOLS.hydrate)
  const place = rng.chance(0.5) ? -1 : -2
  const opener = rng.int(0, HYDRATE_OPENERS.length - 1)
  const prompt = `${HYDRATE_OPENERS[opener]!(s)} Use atomic masses rounded to the hundredths: ${massList(symbolsOf(s))}. Give the percent to the ${placeWord(place)} place.`
  const water: BuiltStage = {
    kind: 'number',
    label: 'Percent water by mass',
    hint: `As a percent, to the ${placeWord(place)} place.`,
    nudge: 'Weigh all the waters after the dot together, then compare them with the whole hydrate.',
    ruleCard: 'cf.hydrate',
    unit: '%',
    check: { kind: 'percent-water', formula: s.key, place },
    reveal: (answer) => `${s.waters} × 18.02 ÷ ${hundredthsText(molarMassHundredths(s))} × 100 = ${answer}% water.`,
  }
  return {
    prompt,
    drafts: [molarMassStage(s), water],
    extraCards: ['cf.percent'],
    params: { variant: 'hydrate', formula: s.key, place, opener },
  }
}

function drawPercent(rng: Rng): Drawn {
  const roll = rng.next()
  if (roll < 0.45) return drawFormulaPercent(rng)
  if (roll < 0.7) return drawSamplePercent(rng)
  return drawHydratePercent(rng)
}

// ---------------------------------------------------------------------------
// cf.empirical
// ---------------------------------------------------------------------------

export const EMPIRICAL_POOL: readonly MoSubstance[] = DRAWABLE.filter(
  (s) => (s.kind === 'molecular' || s.kind === 'ionic') && s.key !== 'C12H22O11',
)

const EMPIRICAL_OPENERS: readonly string[] = [
  'A lab analysis of an unknown compound:',
  'An unknown compound is analyzed.',
  'The lab sends back an analysis.',
  'An unknown is tested.',
]

function percentData(s: MoSubstance, place: number): { symbol: string; amount: string }[] {
  return countsOf(s).map((c) => ({ symbol: c.symbol, amount: textOf(roundRatToPlace(percentByMass(s, c.symbol), place)) }))
}

function massData(rng: Rng, s: MoSubstance): { symbol: string; amount: string }[] {
  const counts = countsOf(s)
  const first = measurement(rng, 3, rng.pick([0, 1, 1]))
  const base = rat(BigInt(counts[0]!.n) * massHundredths(counts[0]!.symbol))
  return counts.map((c, i) => ({
    symbol: c.symbol,
    amount: i === 0 ? first : ratText(ratMul(ratOf(first), ratDiv(rat(BigInt(c.n) * massHundredths(c.symbol)), base)), 3),
  }))
}

/** Clean data: the procedure gives the substance's own empirical formula, with or without rounding the moles. */
export function cleanEmpiricalData(s: MoSubstance, data: readonly { symbol: string; amount: string }[]): boolean {
  const want = empiricalCounts(countsOf(s))
  const exact = solveEmpirical(data)
  if (!exact || !sameCounts(exact.counts, want)) return false
  const rounded = solveFromMoles(
    data.map((d) => d.symbol),
    molesOf(data, 3),
  )
  return Boolean(rounded && sameCounts(rounded.counts, want))
}

/**
 * The whole procedure for the worked answer: every element's moles (three figures, as she would write
 * them), each over the smallest, and the multiplier when the ratios are not whole yet. The generator only
 * keeps data whose rounded moles give the same formula, so these are the numbers on her own page.
 */
export function empiricalSteps(data: readonly { symbol: string; amount: string }[]): string {
  const symbols = data.map((d) => d.symbol)
  const moles = molesOf(data, 3)
  const solve = solveFromMoles(symbols, moles)
  if (!solve) return 'Find the moles of every element, divide each by the smallest, and make the ratios whole.'
  const molText = (r: Rat) => pretty(ratText(r, 3))
  const ratioText = (r: Rat) => textOf(roundRatToPlace(r, -2))
  let smallest = moles[0]!
  for (const m of moles) if (ratCmp(m, smallest) < 0) smallest = m
  const molesLine = data.map((d, i) => `${d.symbol} ${pretty(d.amount)} ÷ ${atomicMassText(d.symbol)} = ${molText(moles[i]!)}`).join(', ')
  const ratioLine = symbols.map((s, i) => `${s} ${ratioText(solve.ratios[i]!)}`).join(', ')
  const scaled =
    solve.factor === 1
      ? ''
      : ` Those are not all whole numbers: multiply every one by ${solve.factor} to get ${solve.counts.map((c) => `${c.symbol} ${c.n}`).join(', ')}.`
  return `Moles of each element: ${molesLine}. Divide each by the smallest, ${molText(smallest)}: ${ratioLine}.${scaled}`
}

function drawEmpirical(rng: Rng): Drawn {
  for (let tries = 0; tries < 200; tries++) {
    const s = rng.pick(EMPIRICAL_POOL)
    const byPercent = rng.chance(0.5)
    const place = rng.chance(0.7) ? -1 : -2
    const data = byPercent ? percentData(s, place) : massData(rng, s)
    if (!cleanEmpiricalData(s, data)) continue
    const opener = rng.int(0, EMPIRICAL_OPENERS.length - 1)
    const asked = rng.pick(data)
    const listed = data.map((d) => (byPercent ? `${d.amount}% ${elementName(d.symbol)} (${d.symbol})` : `${pretty(d.amount)} g of ${elementName(d.symbol)} (${d.symbol})`))
    const list = listed.length > 1 ? `${listed.slice(0, -1).join(', ')} and ${listed.at(-1)}` : listed[0]!
    const prompt = byPercent
      ? `${EMPIRICAL_OPENERS[opener]} It is ${list} by mass. Use atomic masses rounded to the hundredths: ${massList(data.map((d) => d.symbol))}. Work from a 100 g sample, so each percent is that many grams.`
      : `${EMPIRICAL_OPENERS[opener]} A sample of it contains ${list}. Use atomic masses rounded to the hundredths: ${massList(data.map((d) => d.symbol))}.`
    const symbols = data.map((d) => d.symbol)
    const moles: BuiltStage = {
      kind: 'number',
      label: `Moles of ${elementName(asked.symbol)} (${asked.symbol})`,
      hint: 'Keep the figures the measurement supports.',
      nudge: 'Grams of one element to moles of it: its atomic mass is the mass of one mole.',
      ruleCard: 'cf.empirical',
      unit: 'mol',
      check: { kind: 'element-moles', symbol: asked.symbol, grams: asked.amount },
      reveal: (answer) => `${pretty(asked.amount)} g ÷ ${atomicMassText(asked.symbol)} g/mol = ${pretty(answer)} mol of ${asked.symbol}.`,
    }
    const formula: BuiltStage = {
      kind: 'counts',
      label: 'The empirical formula',
      hint: 'A whole number of 1 or more beside each symbol.',
      nudge: 'Moles of every element, then divide each by the smallest. Look hard at any ratio that is not close to a whole number.',
      ruleCard: 'cf.empirical',
      symbols,
      check: { kind: 'empirical', data, basis: byPercent ? 'percent' : 'mass' },
      reveal: (answer) => `${empiricalSteps(data)} The empirical formula is ${countsDisplay(parseAnswerCounts(answer))}.`,
    }
    return {
      prompt,
      drafts: [moles, formula],
      extraCards: ['cf.percent'],
      params: { formula: s.key, byPercent, place: byPercent ? place : 0, asked: asked.symbol, opener },
    }
  }
  throw new Error('cf.empirical: no clean data in 200 tries')
}

function parseAnswerCounts(answer: string): MoCount[] {
  return answer.split(';').map((p) => {
    const [symbol, n] = p.split('=')
    return { symbol: symbol!, n: Number(n) }
  })
}

// ---------------------------------------------------------------------------
// cf.molecular
// ---------------------------------------------------------------------------

export const MOLECULAR_POOL: readonly MoSubstance[] = ['C6H12O6', 'C2H6', 'H2O2', 'C6H6', 'C10H8', 'C8H18'].map(substanceOf)

const MOLECULAR_OPENERS: readonly string[] = ['From the lab:', 'Two results about an unknown:', 'An analysis and a mass spectrometer agree.', 'Put two facts together.', 'A puzzle from the stockroom:', 'The analysis is back.']

function drawMolecular(rng: Rng): Drawn {
  for (let tries = 0; tries < 200; tries++) {
    const s = rng.pick(MOLECULAR_POOL)
    const emp = empiricalCounts(countsOf(s))
    const exact = molarMassHundredths(s)
    const molarMass = rng.chance(0.25) ? hundredthsText(exact) : ratText(ratMul(rat(exact, 100n), rat(1000n + BigInt(rng.intExcept(-5, 5, [0])), 1000n)), 4)
    const k = multiplierOf(emp, molarMass)
    const efm = countsMassHundredths(emp)
    const ratio = ratDiv(ratOf(molarMass), rat(efm, 100n))
    const off = Math.abs(Number(ratio.n) / Number(ratio.d) - k)
    if (off > 0.03 || BigInt(k) * efm !== exact) continue
    const opener = rng.int(0, MOLECULAR_OPENERS.length - 1)
    const empShown = countsDisplay(emp)
    const prompt = rng.chance(0.5)
      ? `${MOLECULAR_OPENERS[opener]} A compound has the empirical formula ${empShown}, and its molar mass is ${pretty(molarMass)} g/mol. Use atomic masses rounded to the hundredths: ${massList(emp.map((c) => c.symbol))}.`
      : `${MOLECULAR_OPENERS[opener]} Its molar mass is ${pretty(molarMass)} g/mol, and the empirical formula is ${empShown}. Use atomic masses rounded to the hundredths: ${massList(emp.map((c) => c.symbol))}.`
    const symbols = emp.map((c) => c.symbol)
    const sum = emp.map((c) => (c.n > 1 ? `${c.n} × ${atomicMassText(c.symbol)}` : atomicMassText(c.symbol))).join(' + ')
    return {
      prompt,
      drafts: [
        {
          kind: 'number',
          label: `Mass of the empirical formula ${empShown}`,
          hint: 'In g/mol, to the hundredths place.',
          nudge: 'Add the atomic masses of the empirical formula, each times its subscript.',
          ruleCard: 'mo.molarMass',
          unit: 'g/mol',
          check: { kind: 'formula-mass', counts: emp },
          reveal: (answer) => `${empShown}: ${sum} = ${answer} g/mol.`,
        },
        {
          kind: 'whole',
          label: 'The multiplier',
          hint: 'A whole number.',
          nudge: 'Divide the molar mass by the empirical formula mass, then take the nearest whole number.',
          ruleCard: 'cf.molecular',
          check: { kind: 'multiplier', counts: emp, molarMass },
          reveal: (answer) => `${pretty(molarMass)} ÷ ${hundredthsText(efm)} is about ${answer}, so the multiplier is ${answer}.`,
        },
        {
          kind: 'counts',
          label: 'The molecular formula',
          hint: 'A whole number of 1 or more beside each symbol.',
          nudge: 'Multiply every subscript of the empirical formula by the multiplier.',
          ruleCard: 'cf.molecular',
          symbols,
          check: { kind: 'molecular', counts: emp, molarMass },
          reveal: (answer) => `${empShown} repeated: the molecular formula is ${countsDisplay(parseAnswerCounts(answer))}.`,
        },
      ],
      extraCards: ['cf.empirical'],
      params: { formula: s.key, molarMass, opener },
    }
  }
  throw new Error('cf.molecular: no clean molar mass in 200 tries')
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const percentTemplate = makeMoleTemplate(
  'chemFormulas',
  'cf.percent',
  'percent',
  'Percent composition',
  'Each element’s percent by mass from a formula, from the measured masses of a sample, and the percent water in a hydrate.',
  'Answer each part. Give each percent as the problem asks.',
  131,
  drawPercent,
)

export const empiricalTemplate = makeMoleTemplate(
  'chemFormulas',
  'cf.empirical',
  'empirical',
  'Empirical formulas',
  'From percents or measured masses: moles of each element, divide by the smallest, and multiply up a ratio that ends in a half, a third or a quarter.',
  'Answer each part. Enter the formula as a whole number beside each symbol.',
  132,
  drawEmpirical,
)

export const molecularTemplate = makeMoleTemplate(
  'chemFormulas',
  'cf.molecular',
  'molecular',
  'Molecular formulas',
  'The empirical formula mass, the whole-number multiplier from the molar mass, and the molecular formula.',
  'Answer each part. Enter the formula as a whole number beside each symbol.',
  133,
  drawMolecular,
)

export const CF_TEMPLATES = [percentTemplate, empiricalTemplate, molecularTemplate] as const
