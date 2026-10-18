/**
 * What each naming slip PRODUCES for a compound or an ion: a finite list of variants per slip (every way she
 * could type that slip's name), each with the witness sentence about it. The graders compare her name's key
 * with these keys in priority order; nothing is "close": a variant is exactly what the slip gives for this
 * problem. Variants equal to a right name are never used (the graders check the right names first, and the
 * candidate lists drop them).
 */
import { IDE_NAMES } from './data'
import { acceptedNameKeys, binaryAcidName, compoundFormula, compoundName, hydrogenCompoundOf, oxyacidName } from './compounds'
import {
  ateItePartner,
  elementNameOf,
  hydrogenSiblings,
  ideSlipIon,
  ideSlipName,
  ionDisplay,
  nmCations,
  perHypoVariants,
} from './ions'
import { simpleParts } from './formula'
import { nameKey } from './names'
import { capitalized, chargeWords, countWord, formulaDisplay, gcd, greekPrefix, joinAnd, plural, prefixed, romanNumeral, totalWords } from './text'
import type { AcidCompound, Compound, HydrateCompound, IonicCompound, MolecularCompound, NmIon, NmMistakeId } from './types'

export interface SlipVariant {
  /** What she would type: app text. */
  text: string
  /** The comparison key (a name key, or a formula's app text). */
  key: string
  witness: string
}

export interface Slip {
  id: NmMistakeId
  /** The first variant is the representative one (the candidate lists show it). */
  variants: SlipVariant[]
}

class SlipList {
  readonly slips: Slip[] = []
  add(id: NmMistakeId, text: string, witness: string, key = nameKey(text)): void {
    const last = this.slips[this.slips.length - 1]
    const v = { text, key, witness }
    if (last && last.id === id) last.variants.push(v)
    else this.slips.push({ id, variants: [v] })
  }
}

const fd = formulaDisplay
const hasPrefix = (name: string) => /^(?:mono|di|tri|tetra|penta|hexa|hepta|octa|nona|deca)/.test(name) && !/^(?:dimercury)/.test(name)

/** The words of a cation name she might use: every accepted name of it. */
const namesOf = (ion: NmIon) => [ion.name, ...ion.otherNames]

function oxygens(ion: NmIon): number {
  return simpleParts(ion.formula).reduce((n, p) => n + (p.symbol === 'O' ? p.count : 0), 0)
}

/** The cation's other taught charges (same metal), e.g. Fe³⁺ → [Fe²⁺]; mercury(I) ↔ mercury(II). */
export function otherChargesOf(cation: NmIon): NmIon[] {
  if (!cation.metalName) return []
  return nmCations().filter((c) => c.metalName === cation.metalName && c.text !== cation.text)
}

// --- ionic -------------------------------------------------------------------------------------------

function ionicSlips(list: SlipList, c: IonicCompound, label: string, water: string): void {
  const { cation: cat, anion: an, cationCount: x, anionCount: y } = c
  const catNames = namesOf(cat)
  const anNames = namesOf(an)
  const add = (id: NmMistakeId, text: string, witness: string) => list.add(id, `${text}${water}`, witness)
  const metal = cat.metalName ?? cat.name

  // The anion named first.
  for (const a of anNames)
    for (const cn of catNames)
      add('nm_anion_first', `${a} ${cn}`, `Your name starts with the anion, ${an.name}. In the name of an ionic compound the cation comes first and the anion second.`)

  // Greek prefixes counting the ions (with or without the numeral).
  const bases = cat.numeral !== null && !cat.numeralOptional ? [cat.name, cat.metalName!] : catNames
  const prefixAnion = !hasPrefix(an.name) && !/hydrogen/.test(an.name)
  for (const base of bases)
    for (const catPrefix of [false, true])
      for (const anPrefix of prefixAnion ? [false, true] : [false]) {
        if (!catPrefix && !anPrefix) continue
        const used: string[] = []
        const catWord = catPrefix ? prefixed(x, base) : base
        if (catPrefix) used.push(`${greekPrefix(x)}-`)
        const anWord = anPrefix ? prefixed(y, an.name) : an.name
        if (anPrefix) used.push(`${greekPrefix(y)}-`)
        const noNumeral = cat.numeral !== null && !cat.numeralOptional && base === cat.metalName
        add(
          'nm_prefix_on_ionic',
          `${catWord} ${anWord}`,
          `Your name counts the ions with Greek prefixes (${joinAnd(used)}). ${label} is ionic, and ionic names never use prefixes: the charges already fix how many of each ion there are.${noNumeral ? ` For ${metal}, the charge goes in a Roman numeral instead.` : ''}`,
        )
      }

  // A Roman numeral on a cation with only one charge.
  if (cat.numeral === null) {
    const root = cat.metalName ?? cat.name
    for (let k = 1; k <= 10; k++)
      for (const a of anNames)
        add(
          'nm_numeral_on_fixed',
          `${root}(${romanNumeral(k)}) ${a}`,
          cat.metalName
            ? `${capitalized(cat.metalName)} forms only one ion, ${ionDisplay(cat)}, so its name never takes a Roman numeral. The numeral is only for metals with more than one charge.`
            : `${capitalized(cat.name)} has only one charge, ${chargeWords(cat.charge)}, so it never takes a Roman numeral. The numeral is only for metals with more than one charge.`,
        )
  }

  // The numeral left off a metal with more than one charge.
  if (cat.numeral !== null && !cat.numeralOptional) {
    const all = [cat, ...otherChargesOf(cat)].sort((p, q) => p.charge - q.charge).map(ionDisplay)
    for (const a of anNames)
      add(
        'nm_numeral_missing',
        `${cat.metalName} ${a}`,
        `${capitalized(cat.metalName!)} ${an.name} does not say which ${cat.metalName} ion is in ${label}. ${capitalized(cat.metalName!)} forms more than one ion (${joinAnd(all)}), so the name needs the charge of one ${cat.metalName} ion as a Roman numeral.`,
      )
  }

  // The wrong numeral.
  if (cat.numeral !== null) {
    const total = -an.charge * y
    const taught = new Set(otherChargesOf(cat).map((o) => o.numeral))
    const order: number[] = []
    const push = (k: number) => {
      if (k >= 1 && k <= 10 && k !== cat.numeral && !order.includes(k)) order.push(k)
    }
    if (x > 1) push(x)
    if (y > 1) push(y)
    for (const k of taught) if (k !== null) push(k)
    push(x)
    for (let k = 1; k <= 10; k++) push(k)
    const unit = cat.formula === 'Hg2' ? 'Hg₂²⁺ ion' : `${metal} ion`
    const share = `${countWord(y)} ${an.name} ion${y === 1 ? '' : 's'} carr${y === 1 ? 'ies' : 'y'} ${totalWords(-total)} in all, balanced by ${countWord(x)} ${unit}${x === 1 ? '' : 's'}`
    for (const k of order) {
      const r = romanNumeral(k)
      let witness: string
      if (k === x && cat.formula !== 'Hg2')
        witness = `(${r}) matches ${x > 1 ? `the subscript of ${metalSymbol(cat)} in ${label}` : `the single ${metalSymbol(cat)} in ${label} (no subscript is written for one)`}, but a subscript counts ions; it is not the charge. The charge comes from the anions: ${share}.`
      else if (k === y && y > 1 && cat.formula !== 'Hg2')
        witness = `(${r}) is the subscript of ${an.name}, not the charge of ${metal}. Each ${an.name} ion is ${chargeWords(an.charge)}, so ${share}.`
      else if (taught.has(k))
        witness = `(${r}) is the other charge ${metal} can have. In ${label}, ${share}.`
      else witness = `(${r}) is not the charge of ${metal} in ${label}: ${share}.`
      for (const a of anNames) add('nm_numeral_wrong', `${cat.metalName}(${r}) ${a}`, witness)
    }
  }

  // The element's name for a monatomic anion.
  if (an.kind === 'monatomic' && an.symbol) {
    const el = elementNameOf(an.symbol)
    for (const cn of catNames)
      add('nm_element_name_for_anion', `${cn} ${el}`, `${capitalized(el)} is the name of the element. As the anion ${ionDisplay(an)}, it takes the -ide ending.`)
  }

  // -ide for a polyatomic ion.
  const ide = ideSlipName(an)
  if (ide) {
    const ion = ideSlipIon(an)
    const what = ion ? `${ion.name} is ${ionDisplay(ion)}, an ion of ${ion.kind === 'monatomic' ? 'a single atom' : 'its own'}` : `${ide} would be a single-atom ion`
    for (const cn of catNames)
      add('nm_ide_for_polyatomic', `${cn} ${ide}`, `${capitalized(what)}. ${label} contains the polyatomic ion ${ionDisplay(an)}, which has its own name in the table: -ide is for one-atom anions.`)
  }

  // -ate and -ite swapped.
  const partner = ateItePartner(an)
  if (partner) {
    const more = oxygens(partner) > oxygens(an)
    for (const pn of namesOf(partner))
      for (const cn of catNames)
        add(
          'nm_ate_ite_swapped',
          `${cn} ${pn}`,
          `${capitalized(partner.name)} is ${ionDisplay(partner)}, with one oxygen ${more ? 'more' : 'fewer'} than the ion in ${label}, ${ionDisplay(an)}. The ion with more oxygen ends in -ate; the one with fewer ends in -ite.`,
        )
  }

  // per- and hypo-.
  for (const v of perHypoVariants(an))
    for (const cn of catNames)
      add(
        'nm_per_hypo_wrong',
        `${cn} ${v.name}`,
        `${capitalized(v.name)} is ${ionDisplay(v)}, but the ion in ${label} is ${ionDisplay(an)}. per- means one oxygen more than -ate, and hypo- one fewer than -ite.`,
      )

  // The hydrogen part of the anion's name.
  for (const s of hydrogenSiblings(an))
    for (const sn of namesOf(s))
      for (const cn of catNames)
        add(
          'nm_hydrogen_prefix_wrong',
          `${cn} ${sn}`,
          `${capitalized(s.name)} is ${ionDisplay(s)}. The anion in ${label} is ${ionDisplay(an)}: the hydrogen part of its name says how many H atoms it carries.`,
        )

  // Peroxide named as oxide.
  if (an.formula === 'O2')
    for (const cn of catNames)
      add(
        'nm_unit_ion_reduced',
        `${cn} oxide`,
        `Oxide is the one-atom ion O²⁻. ${label} contains O₂²⁻, two oxygen atoms bonded into a single ion with a 2− charge in all, and that ion has its own name in the table.`,
      )
}

function metalSymbol(cat: NmIon): string {
  return cat.symbol ?? fd(cat.formula)
}

// --- molecular ---------------------------------------------------------------------------------------

/** A typical charge of each element as an anion, for the Stock-system slip (N₂O₅ → nitrogen(V) oxide). */
const ANION_SIZE: Readonly<Record<string, number>> = { O: 2, S: 2, Se: 2, Te: 2, F: 1, Cl: 1, Br: 1, I: 1, H: 1, N: 3, P: 3, As: 3, C: 4, Si: 4, B: 3 }

function molecularSlips(list: SlipList, c: MolecularCompound, label: string): void {
  const first = elementNameOf(c.first)
  const second = IDE_NAMES[c.second]!
  const n1 = c.firstCount
  const n2 = c.secondCount
  const w1 = prefixed(n1, first, true)
  const w2 = prefixed(n2, second)

  if (n1 === 1)
    list.add('nm_mono_on_first', `${prefixed(1, first)} ${w2}`, `mono- is never used on the first element: a single ${first} atom is named with no prefix. Only the second element takes mono-.`)

  const missing: [string, string][] = []
  if (n1 > 1) missing.push([`${first} ${w2}`, `the prefix on ${first}`])
  missing.push([`${w1} ${second}`, `the prefix on ${second}`])
  if (n1 > 1) missing.push([`${first} ${second}`, 'both prefixes'])
  for (const [text, which] of missing)
    list.add(
      'nm_prefix_missing',
      text,
      `Your name leaves out ${which}. Two nonmetals can combine in more than one ratio, so a molecular name gives the second element a prefix every time, and the first one whenever there is more than one atom of it.`,
    )

  const g = gcd(n1, n2)
  if (g > 1) {
    const reduced = `${prefixed(n1 / g, first, true)} ${prefixed(n2 / g, second)}`
    const rf = `${c.first}${n1 / g === 1 ? '' : n1 / g}${c.second}${n2 / g === 1 ? '' : n2 / g}`
    list.add(
      'nm_molecular_reduced',
      reduced,
      `${capitalized(reduced)} is the name of ${fd(rf)}, the formula reduced to its lowest ratio. A molecular formula counts the atoms in one molecule and is never reduced: name the atoms that ${label} has.`,
    )
  }

  list.add(
    'nm_element_name_for_anion',
    `${w1} ${prefixed(n2, elementNameOf(c.second))}`,
    `${capitalized(elementNameOf(c.second))} is the element’s own name. The second element of a binary molecular compound takes the -ide ending.`,
  )

  const size = ANION_SIZE[c.second] ?? 2
  const guess = (n2 * size) % n1 === 0 ? (n2 * size) / n1 : 0
  const order = [guess, ...Array.from({ length: 10 }, (_v, i) => i + 1)].filter((k, i, a) => k >= 1 && k <= 10 && a.indexOf(k) === i)
  for (const k of order)
    list.add(
      'nm_stock_on_molecular',
      `${first}(${romanNumeral(k)}) ${second}`,
      `Roman numerals are for metal ions. ${label} is made of two nonmetals that share electrons, so its name uses Greek prefixes for the number of each atom.`,
    )
}

// --- acids -------------------------------------------------------------------------------------------

function acidSlips(list: SlipList, c: AcidCompound, label: string, hydrogenForm: boolean): void {
  const an = c.anion
  const right = compoundName(c)
  const salt = hydrogenCompoundOf(an, false)
  const saltKeys = salt && salt.kind === 'hydrogen' ? acceptedNameKeys(salt) : []
  const n = c.hydrogenCount
  const saltNames = c.binary
    ? saltKeys
    : [`hydrogen ${an.name}`, ...(n > 1 ? [`${prefixed(n, 'hydrogen')} ${an.name}`] : [])]
  if (!hydrogenForm)
    for (const s of saltNames)
      list.add(
        'nm_acid_named_as_salt',
        s,
        c.binary
          ? `${capitalized(s)} names the pure compound. Dissolved in water, ${label} is an acid, and an acid has its own kind of name: hydro-…-ic acid for one without oxygen.`
          : `${capitalized(s)} names it like a salt of hydrogen. ${label} is an acid: its name comes from the ending of its ion (-ate becomes -ic, -ite becomes -ous) followed by acid.`,
      )

  if (c.binary) {
    const root = right.replace(/^hydro/, '').replace(/ic acid$/, '')
    const plain = `${root}ic acid`
    list.add(
      'nm_hydro_missing',
      plain,
      `${capitalized(plain)} would be an acid with oxygen in it, named from an -ate ion. ${label} is hydrogen and ${an.kind === 'monatomic' ? `one other element` : 'the cyanide ion'}, with no oxygen: a binary acid’s name starts with hydro-.`,
    )
    if (root === 'sulfur')
      list.add('nm_acid_root', 'hydrosulfic acid', 'Acids of sulfur keep the longer root sulfur-, not sulf-: the sulfur acids are named sulfuric, sulfurous and hydrosulfuric.')
    for (const t of [`${an.name} acid`, `hydro${an.name} acid`])
      list.add('nm_acid_anion_ending', t, `${capitalized(t)} keeps the ion’s own ending. In an acid’s name, -ide becomes hydro-…-ic, -ate becomes -ic and -ite becomes -ous.`)
    return
  }

  list.add(
    'nm_hydro_on_oxyacid',
    `hydro${right}`,
    `hydro- is only for acids with no oxygen (binary acids, such as HCl). ${label} contains oxygen: it is named from its polyatomic ion, ${an.name}, with no hydro-.`,
  )
  const swappedIon = an.name.endsWith('ate') ? `${an.name.slice(0, -3)}ite` : `${an.name.slice(0, -3)}ate`
  const swapped = oxyacidName(swappedIon)
  const isAte = an.name.endsWith('ate')
  list.add(
    'nm_ic_ous_swapped',
    swapped,
    `-${isAte ? 'ous' : 'ic'} acids come from -${isAte ? 'ite' : 'ate'} ions. ${label} contains ${an.name}, an -${isAte ? 'ate' : 'ite'} ion, so its acid’s name ends the other way.`,
  )
  if (/sulfur|phosphor/.test(right))
    list.add(
      'nm_acid_root',
      right.replace('sulfur', 'sulf').replace('phosphor', 'phosph'),
      `Acids of ${/sulfur/.test(right) ? 'sulfur' : 'phosphorus'} keep the longer root ${/sulfur/.test(right) ? 'sulfur-, not sulf-' : 'phosphor-, not phosph-'}. Your name drops part of it.`,
    )
  for (const v of perHypoVariants(an))
    list.add(
      'nm_per_hypo_wrong',
      oxyacidName(v.name),
      `${capitalized(oxyacidName(v.name))} is ${fd(`H${-v.charge === 1 ? '' : -v.charge}${v.formula}`)}, but ${label} has ${plural(oxygens(an), 'oxygen')}. per- means one oxygen more than the -ic acid, and hypo- one fewer than the -ous acid.`,
    )
  for (const t of [`${an.name} acid`, `hydro${an.name} acid`])
    list.add('nm_acid_anion_ending', t, `${capitalized(t)} keeps the ion’s own ending. In an acid’s name, -ide becomes hydro-…-ic, -ate becomes -ic and -ite becomes -ous.`)
}

// --- hydrates ----------------------------------------------------------------------------------------

function hydrateSlips(list: SlipList, c: HydrateCompound, label: string): void {
  const salt = compoundName(c.salt)
  const word = prefixed(c.waters, 'hydrate')
  const others: number[] = []
  const push = (m: number) => {
    if (m >= 1 && m <= 10 && m !== c.waters && !others.includes(m)) others.push(m)
  }
  push(c.waters - 1)
  push(c.waters + 1)
  for (let m = 1; m <= 10; m++) push(m)
  for (const m of others)
    list.add(
      'nm_hydrate_count_wrong',
      `${salt} ${prefixed(m, 'hydrate')}`,
      `${capitalized(prefixed(m, 'hydrate'))} means ${plural(m, 'water molecule')}, but ${label} has a different number after the dot. Count the H₂O and use its Greek prefix.`,
    )
  list.add('nm_hydrate_count_wrong', `${salt} hydrate`, `Hydrate alone does not say how many water molecules there are: the name needs the Greek prefix for the number after the dot in ${label}.`)
  list.add('nm_hydrate_count_wrong', salt, `Your name leaves out the water. ${label} is a hydrate: its name ends with a Greek prefix for the number of water molecules, then hydrate.`)
  ionicSlips(list, c.salt, label, ` ${word}`)
}

/** Every naming slip for a compound, in the graders' priority order. `label` is the formula as display text. */
export function nameSlips(c: Compound, label = fd(compoundFormula(c))): Slip[] {
  const list = new SlipList()
  switch (c.kind) {
    case 'ionic':
      ionicSlips(list, c, label, '')
      break
    case 'molecular':
      molecularSlips(list, c, label)
      break
    case 'acid':
      acidSlips(list, c, label, false)
      break
    case 'hydrogen': {
      // Without water the acid name is accepted too (CK-12 calls HCl hydrochloric acid), so the acid slips apply.
      const acid = hydrogenCompoundOf(c.anion, true)!
      if (c.anion.symbol)
        list.add(
          'nm_element_name_for_anion',
          `hydrogen ${elementNameOf(c.anion.symbol)}`,
          `${capitalized(elementNameOf(c.anion.symbol))} is the element’s own name. The second element of a binary compound takes the -ide ending.`,
        )
      acidSlips(list, acid as AcidCompound, label, true)
      break
    }
    case 'hydrate':
      hydrateSlips(list, c, label)
      break
  }
  return list.slips
}

// --- single ions -------------------------------------------------------------------------------------

/** Every slip in naming a single ion (her name may end in "ion"; the graders strip it). */
export function ionNameSlips(ion: NmIon): Slip[] {
  const list = new SlipList()
  const label = ionDisplay(ion)
  if (ion.role === 'cation') {
    if (ion.numeral === null) {
      const root = ion.metalName ?? ion.name
      for (let k = 1; k <= 10; k++)
        list.add(
          'nm_numeral_on_fixed',
          `${root}(${romanNumeral(k)})`,
          ion.metalName
            ? `${capitalized(ion.metalName)} forms only one ion, ${label}, so its name never takes a Roman numeral.`
            : `${capitalized(ion.name)} has only one charge, ${chargeWords(ion.charge)}, so it never takes a Roman numeral.`,
        )
    } else {
      if (!ion.numeralOptional) {
        const all = [ion, ...otherChargesOf(ion)].sort((p, q) => p.charge - q.charge).map(ionDisplay)
        list.add(
          'nm_numeral_missing',
          ion.metalName!,
          `${capitalized(ion.metalName!)} forms more than one ion (${joinAnd(all)}), so the name of ${label} needs its charge as a Roman numeral.`,
        )
      }
      const taught = new Set(otherChargesOf(ion).map((o) => o.numeral))
      const order = [...taught].filter((k): k is number => k !== null)
      for (let k = 1; k <= 10; k++) if (!order.includes(k) && k !== ion.numeral) order.push(k)
      for (const k of order) {
        const r = romanNumeral(k)
        const witness =
          ion.formula === 'Hg2'
            ? `(${r}) is not the charge of each mercury atom here. Hg₂²⁺ is two mercury atoms sharing a 2+ charge, so each one is 1+.`
            : `(${r}) says ${countWord(k)}+, but ${label} has a ${chargeWords(ion.charge)} charge: the Roman numeral is the ion’s charge.`
        list.add('nm_numeral_wrong', `${ion.metalName}(${r})`, witness)
      }
    }
    return list.slips
  }
  if (ion.kind === 'monatomic' && ion.symbol) {
    const el = elementNameOf(ion.symbol)
    list.add('nm_element_name_for_anion', el, `${capitalized(el)} is the name of the element. As the anion ${label}, it takes the -ide ending.`)
    return list.slips
  }
  const ide = ideSlipName(ion)
  if (ide) {
    const other = ideSlipIon(ion)
    list.add(
      'nm_ide_for_polyatomic',
      ide,
      `${other ? `${capitalized(ide)} is ${ionDisplay(other)}` : `${capitalized(ide)} would be a one-atom ion`}. ${label} is a polyatomic ion with its own name in the table: -ide is for one-atom anions.`,
    )
  }
  const partner = ateItePartner(ion)
  if (partner)
    for (const pn of namesOf(partner))
      list.add(
        'nm_ate_ite_swapped',
        pn,
        `${capitalized(partner.name)} is ${ionDisplay(partner)}, with one oxygen ${oxygens(partner) > oxygens(ion) ? 'more' : 'fewer'} than ${label}. The ion with more oxygen ends in -ate; the one with fewer ends in -ite.`,
      )
  for (const v of perHypoVariants(ion))
    list.add('nm_per_hypo_wrong', v.name, `${capitalized(v.name)} is ${ionDisplay(v)}, not ${label}. per- means one oxygen more than -ate, and hypo- one fewer than -ite.`)
  for (const s of hydrogenSiblings(ion))
    for (const sn of namesOf(s))
      list.add('nm_hydrogen_prefix_wrong', sn, `${capitalized(s.name)} is ${ionDisplay(s)}. ${label} carries a different number of H atoms, and the hydrogen part of the name counts them.`)
  if (ion.formula === 'O2')
    list.add('nm_unit_ion_reduced', 'oxide', 'Oxide is the one-atom ion O²⁻. O₂²⁻ is two oxygen atoms bonded into one ion, and it has its own name in the table.')
  return list.slips
}

/** The name of the acid an ion gives, for sentences: 'sulfuric acid' (binary: 'hydrochloric acid'). */
export function acidNameOf(anion: NmIon): string {
  return /(?:ate|ite)$/.test(anion.name) ? oxyacidName(anion.name) : binaryAcidName(anion)
}
