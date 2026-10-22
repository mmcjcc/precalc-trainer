/**
 * Shared words of the optimization templates: units, the number parts' letters and hints, the rounding sentence.
 * Format hints and instructions never carry a number, so no hint can be an answer.
 */
import type { Q } from '@/engine/optim'
import type { LetterWords, OptWords } from './parts'
import type { Route } from './model'
import { commas, qDecimal, qTex } from './text'

export type LengthUnit = 'ft' | 'm' | 'yd'

export const UNIT_WORDS: Record<LengthUnit, { short: string; plural: string; square: string; squareShort: string }> = {
  ft: { short: 'ft', plural: 'feet', square: 'square feet', squareShort: 'ft²' },
  m: { short: 'm', plural: 'meters', square: 'square meters', squareShort: 'm²' },
  yd: { short: 'yd', plural: 'yards', square: 'square yards', squareShort: 'yd²' },
}

export const HINT_EXACT = 'A number. A fraction or a mixed number is fine, and so is a unit after it.'
export const HINT_ROUNDED = 'A number, rounded the way the problem asks. A unit after it is fine.'
export const HINT_PLAIN_EXACT = 'A number. A fraction or a mixed number is fine.'
export const HINT_PLAIN_ROUNDED = 'A number, rounded the way the problem asks.'
export const HINT_MONEY = 'Dollars and cents. A $ sign is fine.'
export const HINT_COUNT = 'A whole number. The word for what is counted after it is fine.'
export const HINT_EQ_SECONDARY = 'An equation in x and y. Any equivalent form is fine.'

export function areaHint(unit: LengthUnit): string {
  const u = UNIT_WORDS[unit]
  return `A number and its square unit: ${u.squareShort} or ${u.square}.`
}

export function primaryHint(quantity: string): string {
  return `Start with ${quantity} = and use both x and y.`
}

export function finalHint(quantity: string): string {
  return `${quantity} = a formula in x alone (or in y alone). Multiplied out or not, both are fine.`
}

/** Every format hint the module shows, for the leak checks. */
export const OPT_HINTS: readonly string[] = [
  HINT_EXACT,
  HINT_ROUNDED,
  HINT_PLAIN_EXACT,
  HINT_PLAIN_ROUNDED,
  HINT_MONEY,
  HINT_COUNT,
  HINT_EQ_SECONDARY,
  ...(['ft', 'm', 'yd'] as const).map(areaHint),
  ...['A', 'P', 'R', 'S'].flatMap((qq) => [primaryHint(qq), finalHint(qq)]),
]

/** The sentence about rounding, when an answer does not come out as a short decimal. */
export function roundingSentence(places: number | null): string {
  if (places === null) return 'Give exact answers: a fraction or a mixed number is fine.'
  return places === 1 ? 'Round your answers to the nearest tenth.' : 'Round your answers to the nearest hundredth.'
}

/** Does every value come out as a decimal with at most two places? */
export function allClean(values: readonly Q[]): boolean {
  return values.every((v) => {
    const d = qDecimal(v, 2)
    return d !== null
  })
}

/** A length letter: "x", with the unit after a number. */
export function lengthLetter(v: Route, unit: LengthUnit): LetterWords {
  const u = UNIT_WORDS[unit]
  return {
    label: v,
    what: v,
    dim: 'length',
    unitForms: (t) => [`${t} ${u.short}`, `${t} ${u.plural}`],
    unitAfter: ` ${u.plural}`,
  }
}

/** A plain number letter (the numbers problems). */
export function plainLetter(v: Route, label = v): LetterWords {
  return { label, what: v, dim: 'none', unitForms: () => [], unitAfter: '' }
}

/** A price letter (dollars). */
export function priceLetter(label: string): LetterWords {
  return {
    label,
    what: 'the price',
    dim: 'money',
    unitForms: (t) => [`$${t}`, `${t} dollars`],
    unitAfter: '',
  }
}

/** A count letter (tickets sold). */
export function countLetter(label: string, nouns: readonly string[]): LetterWords {
  return {
    label,
    what: `the number of ${nouns[0]}`,
    dim: 'count',
    unitForms: (t) => [`${t} ${nouns[0]}`],
    unitAfter: ` ${nouns[0]}`,
  }
}

/** The fence problems' words for parts 4–6. */
export function fenceWords(o: { unit: LengthUnit; places: number | null; extremePhrase: string; maxLabel: string; maxAsk: string; countNoun?: string }): OptWords {
  const u = UNIT_WORDS[o.unit]
  const hint = o.places === null ? HINT_EXACT : HINT_ROUNDED
  return {
    quantity: 'area',
    extremePhrase: o.extremePhrase,
    letters: { x: lengthLetter('x', o.unit), y: lengthLetter('y', o.unit) },
    bestAsk: { x: `What value of $x$ gives ${o.extremePhrase}?`, y: `What value of $y$ gives ${o.extremePhrase}?` },
    otherAsk: { x: 'What is $y$ for that value of $x$?', y: 'What is $x$ for that value of $y$?' },
    maxLabel: o.maxLabel,
    maxAsk: o.maxAsk,
    maxDim: 'area',
    maxUnitRequired: true,
    maxUnitForms: (t) => [`${t} ${u.short}^2`, `${t} ${u.squareShort}`, `${t} ${u.square}`, `${t} sq ${u.short}`, `${commas(t)} ${u.square}`],
    maxShow: (v) => `$${qTex(v)}$ ${u.square}`,
    numberHint: { best: hint, other: hint, max: areaHint(o.unit) },
    ...(o.countNoun ? { countNoun: o.countNoun } : {}),
  }
}

