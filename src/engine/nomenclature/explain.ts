/**
 * Worked solutions. Each REVEALS the answer (the last hint rung, or after the problem is done). Steps are display
 * text (Fe₂(SO₄)₃, Fe³⁺, SO₄²⁻); `formulaLatex` is the formula for KaTeX. Throw RangeError for a problem outside
 * the model (a template bug), like the econfig core's getters.
 */
import { elementBySymbol } from '../chem/elements'
import { IDE_NAMES } from './data'
import { compoundFormula, compoundName, hydrogenCompoundOf, ionicCompound, ionPairProblem, systematicName, unitText } from './compounds'
import { elementNameOf, ionDisplay, isUnitIon, resolveIon } from './ions'
import { otherChargesOf } from './nameSlips'
import { readCompoundFormula, readCompoundName } from './read'
import { readFormula } from './formula'
import { capitalized, chargeWords, countWord, formulaDisplay, formulaLatex, gcd, greekPrefix, joinAnd, prefixed, totalWords } from './text'
import type {
  AcidCompound,
  Compound,
  CompoundClass,
  FormulaProblemOptions,
  HydrateCompound,
  IonicCompound,
  IonLike,
  MolecularCompound,
  NmExplanation,
  NmIon,
} from './types'

const fd = formulaDisplay

function compoundOf(formula: string, options: FormulaProblemOptions): { c: Compound; label: string } {
  const r = readCompoundFormula(formula, options)
  if (!r.ok) throw new RangeError(r.message)
  const p = readFormula(formula)
  return { c: r.compound, label: fd(p.ok ? p.value.text : formula) }
}

function ionPhrase(ion: NmIon): string {
  if (ion.kind === 'polyatomic') return `the polyatomic ${ion.role} ${ionDisplay(ion)}, ${ion.name}`
  return ion.role === 'cation' ? `the metal ion ${ionDisplay(ion)}` : `the anion ${ionDisplay(ion)}`
}

const groupOf = (ion: NmIon) => (ion.symbol ? elementBySymbol(ion.symbol)?.group ?? null : null)

/** Where a fixed charge comes from, for a sentence. */
function fixedChargeSource(ion: NmIon): string {
  const g = groupOf(ion)
  if (ion.kind === 'polyatomic') return 'from the polyatomic ion table'
  // Hydrogen sits in group 1 but is no metal: hydride is H gaining one electron.
  if (ion.symbol === 'H' && ion.charge < 0) return 'a hydrogen atom that has gained one electron'
  if ((g === 1 || g === 2) && ion.charge > 0) return `as every group ${g} metal is`
  if (g !== null && g >= 13) return `from its place in group ${g}`
  return 'its only taught charge'
}

function ionicNamingSteps(c: IonicCompound, label: string): string[] {
  const { cation: cat, anion: an, cationCount: x, anionCount: y } = c
  const steps = [`${label} is an ionic compound: ${ionPhrase(cat)} and ${ionPhrase(an)}.`]
  const total = -an.charge * y
  if (cat.numeral !== null) {
    const unit = cat.formula === 'Hg2' ? 'Hg₂²⁺ ion' : `${cat.metalName} ion`
    steps.push(
      `${capitalized(countWord(y))} ${an.name} ion${y === 1 ? '' : 's'} carr${y === 1 ? 'ies' : 'y'} ${y} × (${chargeWords(an.charge)}) = ${totalWords(-total)}. ${capitalized(countWord(x))} ${unit}${x === 1 ? '' : 's'} balance${x === 1 ? 's' : ''} that, so each is ${total}+ ÷ ${x} = ${chargeWords(cat.charge)}: ${ionDisplay(cat)}.`,
    )
    if (cat.numeralOptional)
      steps.push(`Nickel has one taught charge, 2+, but the textbook writes it with its numeral: ${cat.name}. Plain nickel is accepted too.`)
    else {
      const all = [cat, ...otherChargesOf(cat)].sort((p, q) => p.charge - q.charge).map(ionDisplay)
      steps.push(`${capitalized(cat.metalName!)} forms more than one ion (${joinAnd(all)}), so the name gives this one’s charge as a Roman numeral: ${cat.name}.`)
    }
    if (cat.formula === 'Hg2') steps.push('Mercury(I) is the ion Hg₂²⁺: two mercury atoms that stay together. The numeral is the charge of each mercury atom, 1+.')
  } else {
    steps.push(
      `${capitalized(cat.name)} is ${ionDisplay(cat)}, ${fixedChargeSource(cat)}, and ${an.name} is ${ionDisplay(an)}: ${x} × (${chargeWords(cat.charge)}) and ${y} × (${chargeWords(an.charge)}) add up to zero.`,
    )
    steps.push(`${capitalized(cat.name)} has only one charge, so its name has no Roman numeral.`)
  }
  if (an.kind === 'monatomic' && an.symbol) steps.push(`The anion takes the -ide ending: ${elementNameOf(an.symbol)} becomes ${an.name}.`)
  else steps.push(`A polyatomic ion keeps its name from the table: ${ionDisplay(an)} is ${an.name}.`)
  if (an.formula === 'O2') steps.push('Peroxide, O₂²⁻, is two oxygen atoms bonded into one ion; it is not two oxide ions.')
  steps.push(`Name the cation first, then the anion, with no prefixes: ${compoundName(c)}.`)
  return steps
}

function molecularNamingSteps(c: MolecularCompound, label: string): string[] {
  const e1 = elementNameOf(c.first)
  const e2 = elementNameOf(c.second)
  const w1 = prefixed(c.firstCount, e1, true)
  const w2 = prefixed(c.secondCount, IDE_NAMES[c.second]!)
  const p2 = greekPrefix(c.secondCount)
  const elided = w2 !== p2 + IDE_NAMES[c.second]!
  const steps = [
    `${label} is a binary molecular compound: two nonmetals, ${e1} and ${e2}, sharing electrons. Its name counts the atoms with Greek prefixes.`,
    c.firstCount === 1
      ? `One ${e1} atom: no prefix, because the first element never takes mono-.`
      : `${capitalized(countWord(c.firstCount))} ${e1} atoms: ${greekPrefix(c.firstCount)}-, so ${w1}.`,
    `${capitalized(countWord(c.secondCount))} ${e2} atom${c.secondCount === 1 ? '' : 's'}: ${p2}- and the ending -ide, so ${w2}${elided ? ` (the final ${p2.slice(-1)} of ${p2}- is dropped before oxide)` : ''}.`,
  ]
  const sys = systematicName(c)
  steps.push(sys ? `By the rules it is ${sys}; it is known as ${compoundName(c)}.` : `Name: ${compoundName(c)}.`)
  return steps
}

function acidNamingSteps(c: AcidCompound, label: string): string[] {
  const an = c.anion
  const n = c.hydrogenCount
  if (c.binary)
    return [
      `${label} is hydrogen with ${ionPhrase(an)} (${an.name}), dissolved in water: a binary acid, with no oxygen.`,
      `${capitalized(countWord(n))} H⁺ balance${n === 1 ? 's' : ''} the ${chargeWords(an.charge)} charge of ${ionDisplay(an)}.`,
      `${capitalized(an.name)} ends in -ide, so the acid is hydro- + the root + -ic acid: ${compoundName(c)}.`,
    ]
  const ate = an.name.endsWith('ate')
  const steps = [
    `${label} is hydrogen with ${ionPhrase(an)}: an acid with oxygen in it (an oxyacid).`,
    `${capitalized(countWord(n))} H⁺ balance${n === 1 ? 's' : ''} the ${chargeWords(an.charge)} charge of ${ionDisplay(an)}.`,
    `${capitalized(an.name)} ends in -${ate ? 'ate' : 'ite'}, so the acid ends in -${ate ? 'ic' : 'ous'}, with no hydro-: ${compoundName(c)}.`,
  ]
  if (/sulf|phosph/.test(an.name)) steps.push(`For ${/sulf/.test(an.name) ? 'sulfur the root is sulfur-' : 'phosphorus the root is phosphor-'}, the longer form.`)
  return steps
}

function hydrateNamingSteps(c: HydrateCompound, label: string): string[] {
  const salt = c.salt
  const saltLabel = fd(compoundFormula(salt))
  return [
    `${label} is a hydrate: the ionic compound ${saltLabel} with ${c.waters === 1 ? 'one water molecule' : `${c.waters} water molecules`} in its crystals.`,
    ...ionicNamingSteps(salt, saltLabel).slice(1, -1),
    `${saltLabel} is ${compoundName(salt)}.`,
    `·${c.waters === 1 ? '' : c.waters}H₂O: ${countWord(c.waters)} water molecule${c.waters === 1 ? '' : 's'}, so ${prefixed(c.waters, 'hydrate')}.`,
    `Name: ${compoundName(c)}.`,
  ]
}

function namingSteps(c: Compound, label: string): string[] {
  switch (c.kind) {
    case 'ionic':
      return ionicNamingSteps(c, label)
    case 'molecular':
      return molecularNamingSteps(c, label)
    case 'acid':
      return acidNamingSteps(c, label)
    case 'hydrate':
      return hydrateNamingSteps(c, label)
    case 'hydrogen': {
      const acid = hydrogenCompoundOf(c.anion, true)!
      return [
        `${label} is hydrogen and ${c.anion.name}, written without (aq): the pure compound, a molecular compound named without prefixes: ${compoundName(c)}.`,
        `Dissolved in water, written ${label}(aq), it is an acid: ${compoundName(acid)}.`,
      ]
    }
  }
}

/** The worked naming of a formula. Throws RangeError outside the model. */
export function explainNameFromFormula(formula: string, options: FormulaProblemOptions = {}): NmExplanation {
  const { c, label } = compoundOf(formula, options)
  return { steps: namingSteps(c, label), answer: compoundName(c), formulaLatex: formulaLatex(compoundFormula(c)) }
}

// --- formula from name --------------------------------------------------------------------------------

function balanceSteps(c: IonicCompound): string[] {
  const { cation: cat, anion: an, cationCount: x, anionCount: y } = c
  const steps: string[] = []
  const [cx, cy] = [Math.abs(an.charge), cat.charge]
  const g = gcd(cx, cy)
  steps.push(
    `Balance the charges with the lowest whole numbers: ${x} × (${chargeWords(cat.charge)}) = ${totalWords(cat.charge * x)} and ${y} × (${chargeWords(an.charge)}) = ${totalWords(an.charge * y)}, which add up to zero.`,
  )
  if (g > 1)
    steps.push(
      `(The criss-cross gives ${fd(unitText(cat.formula, cat.kind === 'polyatomic', cx) + unitText(an.formula, an.kind === 'polyatomic', cy))}; divide both by ${g} for the lowest ratio.)`,
    )
  const poly = [
    ...(cat.kind === 'polyatomic' && x > 1 ? [[cat, x] as const] : []),
    ...(an.kind === 'polyatomic' && y > 1 ? [[an, y] as const] : []),
  ]
  for (const [ion, n] of poly) steps.push(`There are ${countWord(n)} ${ion.name} ions, so ${fd(ion.formula)} goes in parentheses with the ${n} outside.`)
  for (const ion of [cat, an]) if (isUnitIon(ion)) steps.push(`${ionDisplay(ion)} stays whole: the 2 in it belongs to the ion and is never divided out.`)
  return steps
}

function ionSource(ion: NmIon): string {
  if (ion.role === 'cation' && ion.numeral !== null)
    return `The (${ion.name.match(/\(([IVX]+)\)/)?.[1] ?? ''}) in ${ion.name} is the charge of one ${ion.formula === 'Hg2' ? 'mercury atom in the Hg₂²⁺ ion' : `${ion.metalName} ion`}: ${ionDisplay(ion)}.`
  if (ion.kind === 'polyatomic') return `${capitalized(ion.name)} is the polyatomic ion ${ionDisplay(ion)} (from the table).`
  return `${capitalized(ion.name)} is ${ionDisplay(ion)}, ${fixedChargeSource(ion)}.`
}

function formulaSteps(c: Compound, name: string): string[] {
  switch (c.kind) {
    case 'ionic':
      return [`${capitalized(name)} is an ionic compound: the cation ${c.cation.name} and the anion ${c.anion.name}.`, ionSource(c.cation), ionSource(c.anion), ...balanceSteps(c), `Formula: ${fd(compoundFormula(c))}.`]
    case 'molecular': {
      const sys = systematicName(c)
      return [
        sys ? `${capitalized(compoundName(c))} is ${sys}, a binary molecular compound.` : `${capitalized(name)} is a binary molecular compound: the prefixes are the subscripts.`,
        `${capitalized(prefixed(c.firstCount, elementNameOf(c.first), true))}: ${c.firstCount === 1 ? 'one atom (no prefix)' : `${c.firstCount} atoms`} of ${c.first}; ${prefixed(c.secondCount, IDE_NAMES[c.second]!)}: ${c.secondCount} atom${c.secondCount === 1 ? '' : 's'} of ${c.second}.`,
        `A molecular formula is never reduced. Formula: ${fd(compoundFormula(c))}.`,
      ]
    }
    case 'acid': {
      const an = c.anion
      return c.binary
        ? [
            `${capitalized(name)} starts with hydro-: a binary acid, hydrogen and one other element, dissolved in water.`,
            `The anion is ${an.name}, ${ionDisplay(an)}, so ${countWord(c.hydrogenCount)} H⁺ balance${c.hydrogenCount === 1 ? 's' : ''} it.`,
            `Formula: ${fd(compoundFormula(c))}.`,
          ]
        : [
            `${capitalized(name)} has no hydro-: an oxyacid, from the ${an.name.endsWith('ate') ? '-ate' : '-ite'} ion ${an.name}, ${ionDisplay(an)}${an.name.endsWith('ate') ? ' (-ic comes from -ate)' : ' (-ous comes from -ite)'}.`,
            `${capitalized(countWord(c.hydrogenCount))} H⁺ balance${c.hydrogenCount === 1 ? 's' : ''} its ${chargeWords(an.charge)} charge; the H goes first.`,
            `Formula: ${fd(compoundFormula(c))}.`,
          ]
    }
    case 'hydrate':
      return [
        ...formulaSteps(c.salt, compoundName(c.salt)).slice(0, -1),
        `${capitalized(prefixed(c.waters, 'hydrate'))}: ${countWord(c.waters)} water molecule${c.waters === 1 ? '' : 's'}, written after a dot.`,
        `Formula: ${fd(compoundFormula(c))}.`,
      ]
    case 'hydrogen':
      return [`${capitalized(name)}: hydrogen and ${c.anion.name}, ${ionDisplay(c.anion)}, balanced one for one.`, `Formula: ${fd(compoundFormula(c))}.`]
  }
}

/** The worked formula of a name. Throws RangeError outside the model. */
export function explainFormulaFromName(name: string): NmExplanation {
  const r = readCompoundName(name)
  if (!r.ok) throw new RangeError(r.message)
  const c = r.compound
  const formula = compoundFormula(c)
  return { steps: formulaSteps(c, compoundName(c)), answer: fd(formula), formulaLatex: formulaLatex(formula) }
}

/** The worked formula of the compound of two ions. Throws RangeError outside the model. */
export function explainIonicFormula(cation: IonLike, anion: IonLike): NmExplanation {
  const cat = resolveIon(cation)
  const an = resolveIon(anion)
  if (!cat || !an) throw new RangeError('Both ions must be ions of the model.')
  const problem = ionPairProblem(cat, an)
  if (problem) throw new RangeError(problem)
  const c = ionicCompound(cat, an)
  const formula = compoundFormula(c)
  return {
    steps: [`The cation is ${ionDisplay(cat)} and the anion is ${ionDisplay(an)}.`, ...balanceSteps(c), `Cation first, then anion: ${fd(formula)}.`],
    answer: fd(formula),
    formulaLatex: formulaLatex(formula),
  }
}

/** The name and formula of one ion, explained. Throws RangeError outside the model. */
export function explainIon(ion: IonLike): NmExplanation {
  const I = resolveIon(ion)
  if (!I) throw new RangeError(`${typeof ion === 'string' ? ion : ion?.text} is not an ion of the model.`)
  const steps: string[] = []
  if (I.kind === 'polyatomic') {
    steps.push(`${ionDisplay(I)} is a polyatomic ion: a group of atoms with one charge, ${chargeWords(I.charge)}, for the whole group.`)
    if (I.formula === 'Hg2') steps.push('It is two mercury atoms that stay together and share the 2+ charge, so each mercury atom is 1+: the Roman numeral is (I).')
    if (I.formula === 'O2') steps.push('It is two oxygen atoms bonded together, 2− for the pair: not the oxide ion O²⁻, which is one atom.')
    steps.push(`Its name comes from the polyatomic ion table: ${I.name}.`)
    if (/(?:ate|ite)$/.test(I.name)) steps.push('An -ate ion has one more oxygen than the -ite ion of the same element; per- adds one more, hypo- takes one away.')
  } else if (I.role === 'cation') {
    steps.push(`${ionDisplay(I)} is ${I.metalName} that has lost ${countWord(I.charge)} electron${I.charge === 1 ? '' : 's'}: a ${chargeWords(I.charge)} cation.`)
    steps.push(
      I.numeral !== null && !I.numeralOptional
        ? `${capitalized(I.metalName!)} forms more than one ion, so the name carries the charge as a Roman numeral: ${I.name}.`
        : I.numeralOptional
          ? `The textbook writes it ${I.name}; nickel has only one taught charge, so plain nickel is accepted.`
          : `${capitalized(I.metalName!)} has only one charge, so the ion is simply ${I.name}.`,
    )
  } else {
    steps.push(`${ionDisplay(I)} is ${elementNameOf(I.symbol!)} that has gained ${countWord(-I.charge)} electron${I.charge === -1 ? '' : 's'}: a ${chargeWords(I.charge)} anion.`)
    steps.push(`A one-atom anion takes the ending -ide: ${I.name}.`)
  }
  return { steps, answer: `${I.name}, ${ionDisplay(I)}`, formulaLatex: formulaLatex(I.text) }
}

const CLASS_WORDS: Readonly<Record<CompoundClass, string>> = { ionic: 'ionic', molecular: 'molecular', acid: 'an acid', hydrate: 'a hydrate' }

/** Why a formula is ionic, molecular, an acid or a hydrate, as a chain of yes/no checks. Throws RangeError outside the model. */
export function explainClassify(formula: string, options: FormulaProblemOptions = {}): NmExplanation {
  const { c, label } = compoundOf(formula, options)
  const steps: string[] = []
  const cls = c.kind === 'hydrogen' ? 'molecular' : c.kind
  steps.push(c.kind === 'hydrate' ? `Water after a dot? Yes: ${label} is a hydrate.` : 'Water after a dot? No.')
  if (c.kind !== 'hydrate') {
    if (c.kind === 'acid') steps.push(`H first, with an anion${c.binary ? ', in water' : ' that has oxygen'}? Yes: ${label} is an acid.`)
    else steps.push(c.kind === 'hydrogen' ? 'H first, with an anion, in water? Not here: there is no (aq).' : 'H first, with an anion, in water? No.')
  }
  if (c.kind === 'ionic') steps.push(`A metal ion or NH₄⁺ with an anion? Yes: ${ionDisplay(c.cation)} and ${ionDisplay(c.anion)}, so it is ionic.`)
  if (c.kind === 'molecular' || c.kind === 'hydrogen') steps.push(`Two nonmetals sharing electrons? Yes: ${label} is a molecular compound.`)
  return { steps, answer: CLASS_WORDS[cls], formulaLatex: formulaLatex(compoundFormula(c)) }
}
