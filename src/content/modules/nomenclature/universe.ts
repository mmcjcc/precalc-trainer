/**
 * Every answer the templates can generate, by kind of part, computed from the pools (exactly, not by sampling
 * seeds). A format hint, a rule-card example or the example line of a named mistake shown on a part must contain
 * none of the answers of that kind of part; rule-card examples, which every part of a module shows, none at all.
 *
 * For a classify part the answers are the four kinds, which every choice list prints; there an example line
 * singles out an answer when it names the kind of a compound the template can ask about, so the "answers" of a
 * classify part are the formulas the template classifies.
 */
import { chemicalNameKey, compoundOfFormula, type Compound } from '@/engine'
import type { NmPartKind } from '@/content/types'
import { formulasOf, leaks, nameKeysOf, type LeakKeys } from './leaks'
import { ACID_NAME_RESERVED, classifyPool, MOLECULAR_NAME_RESERVED, poolAcids, poolHydrates, poolIonicCompounds, poolIons, poolMolecular, printedAcidFormula } from './pools'

export const NM_PART_KINDS: readonly NmPartKind[] = [
  'ion-name',
  'ion-formula',
  'ionic-name',
  'ionic-formula',
  'molecular-name',
  'molecular-formula',
  'acid-name',
  'acid-formula',
  'hydrate-name',
  'hydrate-formula',
  'class',
]

function compound(formula: string): Compound {
  const c = compoundOfFormula(formula)
  if (!c) throw new Error(`pool formula ${formula} is outside the model`)
  return c
}

function build(part: NmPartKind): LeakKeys {
  const formulas: string[] = []
  const names: string[] = []
  switch (part) {
    case 'ion-name':
      for (const { item } of poolIons()) names.push(...[item.name, ...item.otherNames].map(chemicalNameKey))
      break
    case 'ion-formula':
      for (const { item } of poolIons()) {
        const charge = item.text.slice(item.text.indexOf('^'))
        formulas.push(...[item.formula, ...item.otherFormulas].map((f) => `${f}${charge}`))
      }
      break
    case 'ionic-name':
      for (const { compound: c } of poolIonicCompounds()) names.push(...nameKeysOf(c))
      break
    case 'ionic-formula':
      for (const { compound: c } of poolIonicCompounds()) formulas.push(...formulasOf(c))
      break
    case 'molecular-name':
      for (const { item } of poolMolecular()) if (!MOLECULAR_NAME_RESERVED.has(item)) names.push(...nameKeysOf(compound(item)))
      break
    case 'molecular-formula':
      for (const { item } of poolMolecular()) formulas.push(...formulasOf(compound(item)))
      break
    case 'acid-name':
      for (const { item } of poolAcids()) if (!ACID_NAME_RESERVED.has(printedAcidFormula(item))) names.push(...nameKeysOf(item))
      break
    case 'acid-formula':
      for (const { item } of poolAcids()) formulas.push(...formulasOf(item))
      break
    case 'hydrate-name':
      for (const { item } of poolHydrates()) names.push(...nameKeysOf(compound(item)))
      break
    case 'hydrate-formula':
      for (const { item } of poolHydrates()) formulas.push(...formulasOf(compound(item)), item)
      break
    case 'class':
      for (const { item } of classifyPool()) formulas.push(item.formula)
      break
  }
  return { formulas: [...new Set(formulas)], names: [...new Set(names)], words: [] }
}

const CACHE = new Map<NmPartKind, LeakKeys>()

/** Every answer of this kind of part, as leak keys. */
export function universeKeys(part: NmPartKind): LeakKeys {
  let keys = CACHE.get(part)
  if (!keys) {
    keys = build(part)
    CACHE.set(part, keys)
  }
  return keys
}

const SHOWS = new Map<string, boolean>()

/** True when the text contains an answer the templates can generate for a part of this kind (remembered per text). */
export function showsAnyAnswer(text: string, part: NmPartKind): boolean {
  const memo = `${part}|${text}`
  let shows = SHOWS.get(memo)
  if (shows === undefined) {
    shows = leaks(text, universeKeys(part))
    SHOWS.set(memo, shows)
  }
  return shows
}
