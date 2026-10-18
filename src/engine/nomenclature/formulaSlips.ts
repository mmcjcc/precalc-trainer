/**
 * What each formula-writing slip PRODUCES for a compound (the generated variants, compared as app text), and
 * the structural rules for the slips that are a property of her formula rather than one text:
 *  - nm_charges_unbalanced: the right two ions, cation first, whose charges do not add up to zero;
 *  - nm_not_lowest_ratio: the right two ions, balanced, both counts multiplied by the same k ≥ 2;
 *  - nm_polyatomic_formula_wrong: the right cation and counts, and an anion (or ammonium) written with the
 *    right elements in the right order but other numbers of atoms;
 *  - nm_hydrate_count_wrong: the right salt with another number of waters, or none.
 * A rule never fires on a right answer: a right answer is balanced, in the lowest ratio, with the table's ions.
 */
import { acidCompounds, compoundFormula, compoundName, ionicCompound, ionPairProblem, oxyacidName, unitText } from './compounds'
import { flatAtoms, simpleParts } from './formula'
import { ateItePartner, hydrogenSiblings, ideSlipIon, ionDisplay, ionsWrittenAs, perHypoVariants } from './ions'
import { otherChargesOf, type Slip } from './nameSlips'
import { ionicSplits, splitBalanced } from './read'
import { capitalized, chargeWords, countWord, formulaDisplay, gcd, romanNumeral, totalWords } from './text'
import type { AcidCompound, Compound, FormulaPart, HydrateCompound, IonicCompound, MolecularCompound, NmIon, NmMistakeId } from './types'

const fd = formulaDisplay

class FormulaSlipList {
  readonly slips: Slip[] = []
  add(id: NmMistakeId, text: string, witness: string): void {
    const last = this.slips[this.slips.length - 1]
    const v = { text, key: text, witness }
    if (last && last.id === id) last.variants.push(v)
    else this.slips.push({ id, variants: [v] })
  }
}

const hText = (n: number) => `H${n === 1 ? '' : n}`

function ionicText(cat: NmIon, x: number, an: NmIon, y: number, anFormula = an.formula): string {
  return unitText(cat.formula, cat.kind === 'polyatomic', x) + unitText(anFormula, an.kind === 'polyatomic', y)
}

/** The formula with one oxygen fewer, as a stand-in for a misremembered ion (CO3 → CO2); null without O2+. */
function oneOxygenFewer(formula: string): string | null {
  const parts = simpleParts(formula)
  const o = parts.find((p) => p.symbol === 'O' && p.count >= 2)
  if (!o) return null
  return parts.map((p) => p.symbol + (p === o ? (o.count - 1 === 1 ? '' : o.count - 1) : p.count === 1 ? '' : p.count)).join('')
}

const hasRepeatedSymbol = (formula: string) => {
  const s = simpleParts(formula).map((p) => p.symbol)
  return new Set(s).size !== s.length
}

function distributed(formula: string, n: number): string {
  return simpleParts(formula)
    .map((p) => `${p.symbol}${p.count * n === 1 ? '' : p.count * n}`)
    .join('')
}

// --- ionic -------------------------------------------------------------------------------------------

function ionicSlips(list: FormulaSlipList, c: IonicCompound, label: string, fromName: boolean, water: string): void {
  const { cation: cat, anion: an, cationCount: x, anionCount: y } = c
  const add = (id: NmMistakeId, text: string, witness: string) => list.add(id, `${text}${water}`, witness)
  const anFormulas = [an.formula, ...an.otherFormulas]

  for (const f of anFormulas)
    add(
      'nm_anion_first',
      unitText(f, an.kind === 'polyatomic', y) + unitText(cat.formula, cat.kind === 'polyatomic', x),
      `Your formula starts with ${ionDisplay(an)}, the anion. In a formula, as in the name, the cation comes first: ${cat.name} first, then ${an.name}.`,
    )

  if (cat.formula === 'Hg2') {
    const g = gcd(2 * x, y)
    if (g > 1)
      add(
        'nm_unit_ion_reduced',
        unitText('Hg', false, (2 * x) / g) + unitText(an.formula, an.kind === 'polyatomic', y / g),
        'Your formula splits mercury(I) into single Hg atoms and reduces them. Mercury(I) is the ion Hg₂²⁺: two mercury atoms that stay together, so the 2 inside it is never divided out.',
      )
  }
  if (an.formula === 'O2') {
    const g = gcd(x, 2 * y)
    if (g > 1)
      add(
        'nm_unit_ion_reduced',
        unitText(cat.formula, cat.kind === 'polyatomic', x / g) + unitText('O', false, (2 * y) / g),
        'Your formula splits the peroxide ion. Peroxide is O₂²⁻, two oxygen atoms that stay together as one ion: its 2 is never divided out.',
      )
  }

  // Parentheses left off (the count lands on the ion's last atom), or the ion multiplied out.
  const poly: { ion: NmIon; n: number; side: 'cation' | 'anion' }[] = []
  if (cat.kind === 'polyatomic' && x > 1) poly.push({ ion: cat, n: x, side: 'cation' })
  if (an.kind === 'polyatomic' && y > 1) poly.push({ ion: an, n: y, side: 'anion' })
  const subsets = poly.length === 2 ? [[0], [1], [0, 1]] : poly.length === 1 ? [[0]] : []
  for (const how of ['dropped', 'distributed'] as const)
    for (const subset of subsets) {
      const picked = subset.map((i) => poly[i]!)
      if (how === 'distributed' && picked.some((p) => hasRepeatedSymbol(p.ion.formula))) continue
      const unit = (ion: NmIon, n: number, side: 'cation' | 'anion') => {
        if (!picked.some((p) => p.side === side)) return unitText(ion.formula, ion.kind === 'polyatomic', n)
        return how === 'dropped' ? `${ion.formula}${n}` : distributed(ion.formula, n)
      }
      const p0 = picked[0]!
      const last = simpleParts(p0.ion.formula).at(-1)!.symbol
      add(
        'nm_parentheses_missing',
        unit(cat, x, 'cation') + unit(an, y, 'anion'),
        how === 'dropped'
          ? `Without parentheses, the ${p0.n} after ${fd(p0.ion.formula)} counts only its last atom, ${last}. To show ${countWord(p0.n)} ${p0.ion.name} ions, the whole ion goes in parentheses with the ${p0.n} outside.`
          : `Your formula multiplies out the atoms of ${p0.ion.name}. A polyatomic ion keeps its own formula: to show ${countWord(p0.n)} of them, it goes in parentheses with the ${p0.n} outside.`,
      )
    }

  if (fromName && cat.kind === 'monatomic' && cat.numeral !== null && cat.numeral >= 2) {
    const r = romanNumeral(cat.numeral)
    add(
      'nm_numeral_as_subscript',
      `${cat.symbol}${cat.numeral}${an.formula}`,
      `Your formula turns the (${r}) into a subscript. The Roman numeral is the charge of one ${cat.metalName} ion, ${chargeWords(cat.charge)}, not the number of ${cat.metalName} atoms: balance that charge with ${an.name} ions to find the subscripts.`,
    )
  }

  if (fromName && cat.numeral !== null)
    for (const o of otherChargesOf(cat)) {
      if (ionPairProblem(o, an)) continue
      const oc = ionicCompound(o, an)
      add(
        'nm_numeral_wrong',
        ionicText(o, oc.cationCount, an, oc.anionCount),
        `Your formula balances ${ionDisplay(o)}, the ${cat.metalName} ion of ${o.name} ${an.name}. The Roman numeral in ${label}, (${romanNumeral(cat.numeral)}), gives the charge of each ${cat.metalName} ion.`,
      )
    }

  if (fromName) {
    const ion = ideSlipIon(an)
    if (ion && !ionPairProblem(cat, ion)) {
      const ic = ionicCompound(cat, ion)
      add(
        'nm_ide_for_polyatomic',
        ionicText(cat, ic.cationCount, ion, ic.anionCount),
        `Your formula uses ${ionDisplay(ion)}, ${ion.name}. ${capitalized(an.name)} is a polyatomic ion with oxygen in it, a different ion from ${ion.name}.`,
      )
    }
    for (const s of hydrogenSiblings(an)) {
      if (ionPairProblem(cat, s)) continue
      const sc = ionicCompound(cat, s)
      add(
        'nm_hydrogen_prefix_wrong',
        ionicText(cat, sc.cationCount, s, sc.anionCount),
        `Your formula uses ${ionDisplay(s)}, ${s.name}. The anion in ${label} is ${an.name}: the hydrogen part of its name says how many H atoms it carries.`,
      )
    }
  }

  // A misremembered polyatomic ion: its -ate/-ite partner or a per-/hypo- neighbour (same charge, so the same
  // counts), else one oxygen fewer; ammonium written as NH3.
  if (an.kind === 'polyatomic' && an.formula !== 'O2') {
    const shown = [ateItePartner(an), ...perHypoVariants(an)].filter((v): v is NmIon => v !== null)
    for (const v of shown) add('nm_polyatomic_formula_wrong', ionicText(cat, x, an, y, v.formula), polyWitness(an, v.formula, v))
    const fewer = shown.length === 0 ? oneOxygenFewer(an.formula) : null
    if (fewer) add('nm_polyatomic_formula_wrong', ionicText(cat, x, an, y, fewer), polyWitness(an, fewer, null))
  }
  if (cat.formula === 'NH4')
    add('nm_polyatomic_formula_wrong', unitText('NH3', true, x) + unitText(an.formula, an.kind === 'polyatomic', y), polyWitness(cat, 'NH3', null))

  const [cx, cy] = [Math.abs(cat.charge), Math.abs(an.charge)]
  if (cat.charge * cx + an.charge * cy !== 0)
    add(
      'nm_crisscross_reversed',
      ionicText(cat, cx, an, cy),
      `Your formula gives each ion its own charge as its subscript: ${countWord(cx)} ${ionDisplay(cat)} make ${totalWords(cat.charge * cx)} and ${countWord(cy)} ${ionDisplay(an)} make ${totalWords(an.charge * cy)}, which do not cancel. In the criss-cross, each charge becomes the subscript of the OTHER ion.`,
    )

  const [ux, uy] = gcd(cx, cy) > 1 ? [cy, cx] : [2 * x, 2 * y]
  add('nm_not_lowest_ratio', ionicText(cat, ux, an, uy), notLowestWitness(ux / x))

  const [bx, by] = x === 1 && y === 1 ? [1, 2] : [1, 1]
  add('nm_charges_unbalanced', ionicText(cat, bx, an, by), unbalancedWitness(cat, bx, an, by))
}

function polyWitness(right: NmIon, herFormula: string, known: NmIon | null): string {
  const ion = known ?? ionsWrittenAs(simpleParts(herFormula)).find((i) => i.role === right.role) ?? null
  const her = fd(herFormula)
  if (ion && ion.charge === right.charge) {
    const why =
      ateItePartner(right)?.text === ion.text
        ? ' -ate has one more oxygen than -ite.'
        : perHypoVariants(right).some((v) => v.text === ion.text)
          ? ' per- means one oxygen more than -ate, and hypo- one fewer than -ite.'
          : ''
    return `${her} is ${ion.name}, not ${right.name}.${why} Each polyatomic ion has its own formula in the table.`
  }
  if (herFormula === 'NH3') return `NH₃ is ammonia, a molecule. The ammonium ion is a polyatomic cation with its own formula: check the table.`
  return `${her} is not the formula of ${right.name}: check the table for the number of each atom in the ion.`
}

function notLowestWitness(k: number): string {
  return `Your formula balances the charges, but both subscripts can be divided by ${k}. An ionic formula gives the lowest whole-number ratio of the ions.`
}

function unbalancedWitness(cat: NmIon, x: number, an: NmIon, y: number): string {
  return `In your formula, ${countWord(x)} ${ionDisplay(cat)} ${x === 1 ? 'gives' : 'give'} ${totalWords(cat.charge * x)} and ${countWord(y)} ${ionDisplay(an)} ${y === 1 ? 'gives' : 'give'} ${totalWords(an.charge * y)}: the total is ${totalWords(cat.charge * x + an.charge * y)}, not zero. A compound has no overall charge.`
}

/** The structural rules for an ionic formula (see the file comment). */
function ionicRule(c: IonicCompound, parts: readonly FormulaPart[]): { id: NmMistakeId; witness: string } | null {
  const { cation: cat, anion: an, cationCount: x, anionCount: y } = c
  const splits = ionicSplits(parts).filter((s) => s.order === 'cation-first' && s.cation.text === cat.text && s.anion.text === an.text)
  const balanced = splits.find(splitBalanced)
  if (balanced) {
    const k = balanced.cationCount / x
    if (Number.isInteger(k) && k >= 2 && balanced.anionCount === k * y) return { id: 'nm_not_lowest_ratio', witness: notLowestWitness(k) }
  }
  const off = splits.find((s) => !splitBalanced(s))
  if (off && !balanced) return { id: 'nm_charges_unbalanced', witness: unbalancedWitness(cat, off.cationCount, an, off.anionCount) }
  const wrongIon = polyatomicMisread(c, parts)
  if (wrongIon) return { id: 'nm_polyatomic_formula_wrong', witness: polyWitness(wrongIon.ion, wrongIon.formula, null) }
  return null
}

/** The same symbols in the same order as `ion`, other counts. */
function sameSymbols(parts: readonly FormulaPart[], ion: NmIon): boolean {
  if (parts.some((p) => p.type !== 'element')) return false
  const mine = parts.map((p) => (p.type === 'element' ? p.symbol : ''))
  return [ion.formula, ...ion.otherFormulas].some((f) => {
    const s = simpleParts(f)
    const counts = s.map((p) => p.count).join()
    const herCounts = parts.map((p) => (p.type === 'element' ? p.count : 0)).join()
    return s.length === mine.length && s.every((p, i) => p.symbol === mine[i]) && counts !== herCounts
  })
}

function polyatomicMisread(c: IonicCompound, parts: readonly FormulaPart[]): { ion: NmIon; formula: string } | null {
  const { cation: cat, anion: an, cationCount: x, anionCount: y } = c
  const text = (ps: readonly FormulaPart[]) => flatAtoms(ps).map(([s, n]) => `${s}${n === 1 ? '' : n}`).join('')
  /** One side read as an ion written `count` times; a single element 'Hg2' is Hg×2 or the unit Hg2. */
  const unitsOf = (side: readonly FormulaPart[]): { inner: FormulaPart[]; count: number }[] => {
    if (side.length === 1 && side[0]!.type === 'group') return [{ inner: side[0]!.parts, count: side[0]!.count }]
    if (side.some((p) => p.type === 'group')) return []
    if (side.length === 1) {
      const e = side[0]!
      return e.count > 1 ? [{ inner: [{ ...e, count: 1 }], count: e.count }, { inner: [e], count: 1 }] : [{ inner: [e], count: 1 }]
    }
    return [{ inner: [...side], count: 1 }]
  }
  for (let k = 1; k < parts.length; k++)
    for (const l of unitsOf(parts.slice(0, k)))
      for (const r of unitsOf(parts.slice(k))) {
        const lIsCat = ionsWrittenAs(l.inner).some((i) => i.text === cat.text)
        if (lIsCat && l.count === x && an.kind === 'polyatomic' && r.count === y && sameSymbols(r.inner, an)) return { ion: an, formula: text(r.inner) }
        const rIsAn = ionsWrittenAs(r.inner).some((i) => i.text === an.text)
        if (cat.kind === 'polyatomic' && l.count === x && sameSymbols(l.inner, cat) && r.count === y && rIsAn) return { ion: cat, formula: text(l.inner) }
      }
  return null
}

// --- molecular ---------------------------------------------------------------------------------------

function molecularSlips(list: FormulaSlipList, c: MolecularCompound, label: string): void {
  const t = (a: string, m: number, b: string, n: number) => `${a}${m === 1 ? '' : m}${b}${n === 1 ? '' : n}`
  const { first, firstCount: n1, second, secondCount: n2 } = c
  list.add('nm_anion_first', t(second, n2, first, n1), `Your formula writes ${second} first. A molecular formula lists the elements in the order of the name: ${first} first.`)
  const g = gcd(n1, n2)
  if (g > 1)
    list.add(
      'nm_molecular_reduced',
      t(first, n1 / g, second, n2 / g),
      'Your formula is reduced to the lowest ratio. A molecular formula counts the atoms in one molecule, so its subscripts are exactly what the prefixes say.',
    )
  const variants: [number, number][] = []
  if (n1 > 1) variants.push([1, n2])
  if (n2 > 1) variants.push([n1, 1])
  if (n1 > 1 && n2 > 1) variants.push([1, 1])
  for (const [m, n] of variants)
    list.add('nm_prefix_missing', t(first, m, second, n), `Your formula leaves out a subscript. In ${label}, each prefix gives the number of atoms of its element.`)
}

// --- acids -------------------------------------------------------------------------------------------

function acidSlips(list: FormulaSlipList, c: AcidCompound, label: string): void {
  const an = c.anion
  const n = c.hydrogenCount
  if (an.formula !== 'CH3COO') list.add('nm_anion_first', `${an.formula}${hText(n)}`, 'Your formula puts the H last. In an acid’s formula the hydrogen comes first, then the anion.')
  const root = label.replace(/^hydro/, '').replace(/(?:ic|ous) acid$/, '')
  if (c.binary) {
    const oxy = acidCompounds().find((a) => !a.binary && compoundName(a) === `${root}ic acid`)
    if (oxy)
      list.add(
        'nm_hydro_on_oxyacid',
        compoundFormula(oxy),
        `${fd(compoundFormula(oxy))} is ${compoundName(oxy)}, an acid with oxygen in it. The hydro- in ${label} means there is no oxygen: just hydrogen and one other element.`,
      )
  } else if (/ic acid$/.test(label) && !/^(?:per|hypo)/.test(label)) {
    const bin = acidCompounds().find((a) => a.binary && compoundName(a) === `hydro${root}ic acid`)
    if (bin)
      list.add(
        'nm_hydro_missing',
        `${hText(bin.hydrogenCount)}${bin.anion.formula}`,
        `${fd(`${hText(bin.hydrogenCount)}${bin.anion.formula}`)} is hydro${root}ic acid, an acid with no oxygen. ${capitalized(label)} has no hydro-: it is an oxyacid, named from an -ate ion.`,
      )
  }
  if (!c.binary) {
    const shown = [ateItePartner(an), ...perHypoVariants(an)].filter((v): v is NmIon => v !== null)
    for (const v of shown) {
      const text = `${hText(n)}${v.formula}`
      const partner = ateItePartner(an)?.text === v.text
      list.add(
        'nm_polyatomic_formula_wrong',
        text,
        partner
          ? `${fd(text)} is ${oxyacidName(v.name)}, made from ${v.name}. ${capitalized(label)} is made from ${an.name}: an -ic acid comes from an -ate ion and an -ous acid from an -ite ion.`
          : `${fd(text)} is ${oxyacidName(v.name)}. per- means one oxygen more than the -ic acid, and hypo- one fewer than the -ous acid.`,
      )
    }
  }
  const m = n > 1 ? 1 : 2
  list.add(
    'nm_charges_unbalanced',
    `${hText(m)}${an.formula}`,
    `Your formula has ${countWord(m)} H⁺ for ${ionDisplay(an)}, which has a ${chargeWords(an.charge)} charge: the hydrogen ions must balance it exactly.`,
  )
}

function acidRule(c: AcidCompound, parts: readonly FormulaPart[]): { id: NmMistakeId; witness: string } | null {
  const h = parts[0]
  if (!h || h.type !== 'element' || h.symbol !== 'H') return null
  const rest = parts.slice(1)
  const an = c.anion
  if (ionsWrittenAs(rest).some((i) => i.text === an.text) && h.count !== c.hydrogenCount)
    return {
      id: 'nm_charges_unbalanced',
      witness: `Your formula has ${countWord(h.count)} H⁺ for ${ionDisplay(an)}, which has a ${chargeWords(an.charge)} charge: the hydrogen ions must balance it exactly.`,
    }
  if (h.count === c.hydrogenCount && an.kind === 'polyatomic' && sameSymbols(rest, an))
    return { id: 'nm_polyatomic_formula_wrong', witness: polyWitness(an, flatAtoms(rest).map(([s, k]) => `${s}${k === 1 ? '' : k}`).join(''), null) }
  return null
}

// --- hydrates ----------------------------------------------------------------------------------------

function hydrateSlips(list: FormulaSlipList, c: HydrateCompound, label: string, fromName: boolean): void {
  const salt = compoundFormula(c.salt)
  const counts: number[] = []
  for (const m of [c.waters - 1, c.waters + 1]) if (m >= 1 && m <= 10 && m !== c.waters) counts.push(m)
  for (const m of counts)
    list.add('nm_hydrate_count_wrong', `${salt}·${m === 1 ? '' : m}H2O`, `Your formula has ${countWord(m)} water molecule${m === 1 ? '' : 's'}. Check what the prefix in ${label} stands for.`)
  list.add('nm_hydrate_count_wrong', salt, `Your formula leaves out the water. ${capitalized(label)} is a hydrate: its formula ends with a dot and the water molecules.`)
  ionicSlips(list, c.salt, label, fromName, `·${c.waters === 1 ? '' : c.waters}H2O`)
}

/** Every formula-writing slip for a compound, in priority order. `fromName`: the problem gave a name (not two ions). */
export function formulaSlips(c: Compound, label: string, fromName: boolean): Slip[] {
  const list = new FormulaSlipList()
  switch (c.kind) {
    case 'ionic':
      ionicSlips(list, c, label, fromName, '')
      break
    case 'molecular':
      molecularSlips(list, c, label)
      break
    case 'acid':
      acidSlips(list, c, label)
      break
    case 'hydrate':
      hydrateSlips(list, c, label, fromName)
      break
    case 'hydrogen':
      break
  }
  return list.slips
}

/** The structural rules, applied after the generated variants (her formula parts, state and waters as read). */
export function formulaRule(c: Compound, parts: readonly FormulaPart[], waters: number | null): { id: NmMistakeId; witness: string } | null {
  switch (c.kind) {
    case 'ionic':
      return waters === null ? ionicRule(c, parts) : null
    case 'acid':
      return waters === null ? acidRule(c, parts) : null
    case 'hydrate': {
      const saltRight = [c.salt.anion.formula, ...c.salt.anion.otherFormulas].some((f) => partsTextEq(parts, ionicText(c.salt.cation, c.salt.cationCount, c.salt.anion, c.salt.anionCount, f)))
      if (saltRight && waters !== c.waters)
        return {
          id: 'nm_hydrate_count_wrong',
          witness: waters === null ? 'Your formula leaves out the water: a hydrate’s formula ends with a dot and its water molecules.' : `Your formula has ${countWord(waters)} water molecule${waters === 1 ? '' : 's'}. Check the Greek prefix in front of hydrate.`,
        }
      if (waters === c.waters) return ionicRule(c.salt, parts)
      return null
    }
    default:
      return null
  }
}

function partsTextEq(parts: readonly FormulaPart[], text: string): boolean {
  const t = (ps: readonly FormulaPart[]): string => ps.map((p) => (p.type === 'element' ? p.symbol : `(${t(p.parts)})`) + (p.count === 1 ? '' : p.count)).join('')
  return t(parts) === text
}
