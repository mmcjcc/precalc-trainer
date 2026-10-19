/**
 * Independent re-solve of chapter 7 (written by the reviewer, not the core's or the templates' author). Every
 * generated problem is answered again from its printed text with the reviewer's own ion table and naming rules
 * (no call into src/engine/nomenclature), and the stored answer must be one of the forms the problem accepts.
 * Species the oracle does not know (phosphite, the hydrogen compounds, common names) are counted and skipped.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { ModuleId } from '@/shared/types'

const SEEDS = Number(process.env.NM_SEEDS ?? 400)
const HEAVY = 120000

// ---------- the reviewer's oracle --------------------------------------------------------------------

interface Ion {
  name: string
  formula: string
  charge: number
  polyatomic: boolean
}

const VARIABLE = new Set(['Cr', 'Mn', 'Fe', 'Co', 'Cu', 'Sn', 'Au', 'Hg', 'Pb'])
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
const METALS: [string, string, number[]][] = [
  ['Li', 'lithium', [1]], ['Na', 'sodium', [1]], ['K', 'potassium', [1]], ['Rb', 'rubidium', [1]], ['Cs', 'cesium', [1]],
  ['Be', 'beryllium', [2]], ['Mg', 'magnesium', [2]], ['Ca', 'calcium', [2]], ['Sr', 'strontium', [2]], ['Ba', 'barium', [2]],
  ['Al', 'aluminum', [3]], ['Zn', 'zinc', [2]], ['Ag', 'silver', [1]], ['Ni', 'nickel', [2]],
  ['Fe', 'iron', [2, 3]], ['Cu', 'copper', [1, 2]], ['Pb', 'lead', [2, 4]], ['Sn', 'tin', [2, 4]], ['Co', 'cobalt', [2, 3]],
  ['Cr', 'chromium', [2, 3]], ['Mn', 'manganese', [2, 3]], ['Hg', 'mercury', [2]], ['Au', 'gold', [1, 3]],
]
const MONO_ANIONS: [string, string, number][] = [
  ['F', 'fluoride', -1], ['Cl', 'chloride', -1], ['Br', 'bromide', -1], ['I', 'iodide', -1],
  ['O', 'oxide', -2], ['S', 'sulfide', -2], ['Se', 'selenide', -2], ['N', 'nitride', -3], ['P', 'phosphide', -3], ['H', 'hydride', -1],
]
const POLY: [string, string, number][] = [
  ['NH4', 'ammonium', 1], ['H3O', 'hydronium', 1], ['Hg2', 'mercury(I)', 2],
  ['OH', 'hydroxide', -1], ['NO3', 'nitrate', -1], ['NO2', 'nitrite', -1], ['SO4', 'sulfate', -2], ['SO3', 'sulfite', -2],
  ['HSO4', 'hydrogen sulfate', -1], ['HSO3', 'hydrogen sulfite', -1], ['PO4', 'phosphate', -3], ['HPO4', 'hydrogen phosphate', -2],
  ['H2PO4', 'dihydrogen phosphate', -1], ['CO3', 'carbonate', -2], ['HCO3', 'hydrogen carbonate', -1],
  ['C2H3O2', 'acetate', -1], ['ClO4', 'perchlorate', -1], ['ClO3', 'chlorate', -1], ['ClO2', 'chlorite', -1], ['ClO', 'hypochlorite', -1],
  ['BrO4', 'perbromate', -1], ['BrO3', 'bromate', -1], ['BrO2', 'bromite', -1], ['BrO', 'hypobromite', -1],
  ['IO4', 'periodate', -1], ['IO3', 'iodate', -1], ['IO2', 'iodite', -1], ['IO', 'hypoiodite', -1],
  ['MnO4', 'permanganate', -1], ['CrO4', 'chromate', -2], ['Cr2O7', 'dichromate', -2], ['CN', 'cyanide', -1],
  ['O2', 'peroxide', -2], ['C2O4', 'oxalate', -2], ['SCN', 'thiocyanate', -1],
]

const CATIONS: Ion[] = [
  ...METALS.flatMap(([f, n, cs]) => cs.map((c) => ({ name: VARIABLE.has(f) ? `${n}(${ROMAN[c]})` : n, formula: f, charge: c, polyatomic: false }))),
  ...POLY.filter(([, , c]) => c > 0).map(([f, n, c]) => ({ name: n, formula: f, charge: c, polyatomic: true })),
]
const ANIONS: Ion[] = [
  ...MONO_ANIONS.map(([f, n, c]) => ({ name: n, formula: f, charge: c, polyatomic: false })),
  ...POLY.filter(([, , c]) => c < 0).map(([f, n, c]) => ({ name: n, formula: f, charge: c, polyatomic: true })),
]
const IONS = [...CATIONS, ...ANIONS]

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a))
const unit = (ion: Ion, n: number) => (n === 1 ? ion.formula : ion.polyatomic ? `(${ion.formula})${n}` : `${ion.formula}${n}`)
function formulaOf(cat: Ion, an: Ion): string {
  const g = gcd(cat.charge, -an.charge)
  return `${unit(cat, -an.charge / g)}${unit(an, cat.charge / g)}`
}
const ionicName = (cat: Ion, an: Ion) => `${cat.name} ${an.name}`

const PREFIX = ['', 'mono', 'di', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa', 'nona', 'deca']
const ROOT: Record<string, string> = { O: 'oxide', F: 'fluoride', Cl: 'chloride', Br: 'bromide', I: 'iodide', S: 'sulfide', N: 'nitride', P: 'phosphide', Se: 'selenide' }
const ELEMENT: Record<string, string> = { B: 'boron', C: 'carbon', N: 'nitrogen', O: 'oxygen', F: 'fluorine', Si: 'silicon', P: 'phosphorus', S: 'sulfur', Cl: 'chlorine', Br: 'bromine', I: 'iodine', Se: 'selenium', As: 'arsenic', Te: 'tellurium', Xe: 'xenon' }
function molecularName(first: string, n1: number, second: string, n2: number): string | null {
  if (!ELEMENT[first] || !ROOT[second] || n1 < 1 || n1 > 10 || n2 < 1 || n2 > 10) return null
  return `${n1 === 1 ? '' : PREFIX[n1]}${ELEMENT[first]} ${PREFIX[n2]}${ROOT[second]}`
}

/** Names compared the way a teacher would: case, spaces, British spellings and vowel elision ignored. */
function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(\s*/g, '(')
    .replace(/\s*\)\s*/g, ')')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ ion$/, '')
    .replace(/aluminium/g, 'aluminum')
    .replace(/sulph/g, 'sulf')
    .replace(/caesium/g, 'cesium')
    .replace(/monooxide/g, 'monoxide')
    .replace(/(tetr|pent|hex|hept|oct|non|dec)aoxide/g, '$1oxide')
    .replace(/monoxygen/g, 'monooxygen')
    .replace(/bicarbonate/g, 'hydrogen carbonate')
}

function acidName(an: Ion): string | null {
  if (!an.polyatomic) {
    const root: Record<string, string> = { F: 'hydrofluoric', Cl: 'hydrochloric', Br: 'hydrobromic', I: 'hydroiodic', S: 'hydrosulfuric' }
    return root[an.formula] ? `${root[an.formula]} acid` : null
  }
  if (an.formula === 'CN') return 'hydrocyanic acid'
  if (an.formula === 'C2H3O2') return 'acetic acid'
  if (an.name.includes('hydrogen') || an.formula === 'O2' || an.formula === 'OH' || an.formula === 'SCN') return null
  const m = /^(.*)(ate|ite)$/.exec(an.name)
  if (!m) return null
  let stem = m[1]!
  if (stem === 'sulf') stem = 'sulfur'
  if (stem === 'phosph') stem = 'phosphor'
  return `${stem}${m[2] === 'ate' ? 'ic' : 'ous'} acid`
}
function acidFormula(an: Ion): string {
  const n = -an.charge
  const h = n === 1 ? 'H' : `H${n}`
  return an.polyatomic ? `${h}${an.formula}` : `${h}${an.formula}(aq)`
}

/** "SO4^2-", "Cl^-", "Al^3+", "Hg2^2+" as an ion of the oracle, or null. */
function ionOf(text: string): Ion | null {
  const m = /^([A-Za-z0-9]+)\^(\d*)([+-])$/.exec(text.replace(/\s+/g, ''))
  if (!m) return null
  const charge = (m[3] === '+' ? 1 : -1) * Number(m[2] || 1)
  return IONS.find((i) => i.formula === m[1] && i.charge === charge) ?? null
}
const ionByName = (name: string) => IONS.find((i) => nameKey(i.name) === nameKey(name)) ?? null
const ionText = (ion: Ion) => `${ion.formula}^${Math.abs(ion.charge) === 1 ? '' : Math.abs(ion.charge)}${ion.charge > 0 ? '+' : '-'}`

/** Every ionic formula the oracle can build, with its two ions. */
const PAIRS = new Map<string, [Ion, Ion]>()
for (const c of CATIONS) for (const a of ANIONS) {
  if (a.formula === 'H' && c.polyatomic) continue
  const f = formulaOf(c, a)
  if (!PAIRS.has(f)) PAIRS.set(f, [c, a])
}
const PAIR_BY_NAME = new Map<string, [Ion, Ion]>()
for (const [, pair] of PAIRS) PAIR_BY_NAME.set(nameKey(ionicName(pair[0], pair[1])), pair)
const MOLECULAR_BY_NAME = new Map<string, string>()
for (const f of Object.keys(ELEMENT)) for (const s of Object.keys(ROOT)) for (let n1 = 1; n1 <= 10; n1++) for (let n2 = 1; n2 <= 10; n2++) {
  const name = molecularName(f, n1, s, n2)
  if (name) MOLECULAR_BY_NAME.set(nameKey(name), `${f}${n1 > 1 ? n1 : ''}${s}${n2 > 1 ? n2 : ''}`)
}

function hydrateName(formula: string): string | null {
  const m = /^(.*)·(\d*)H2O$/.exec(formula)
  if (!m) return null
  const pair = PAIRS.get(m[1]!)
  const n = Number(m[2] || 1)
  return pair && n >= 1 && n <= 10 ? `${ionicName(pair[0], pair[1])} ${PREFIX[n]}hydrate` : null
}
function hydrateFormula(name: string): string | null {
  const m = /^(.*) (mono|di|tri|tetra|penta|hexa|hepta|octa|nona|deca)hydrate$/.exec(nameKey(name))
  if (!m) return null
  const pair = PAIR_BY_NAME.get(m[1]!)
  const n = PREFIX.indexOf(m[2]!)
  return pair ? `${formulaOf(pair[0], pair[1])}·${n > 1 ? n : ''}H2O` : null
}

function classOf(formula: string): string | null {
  if (/·\d*H2O$/.test(formula)) return 'hydrate'
  if (/^H\d*[A-Z]/.test(formula) && !formula.startsWith('Hg')) {
    if (/\(aq\)$/.test(formula)) return 'acid'
    const anion = formula.replace(/^H\d*/, '')
    if (ANIONS.some((a) => a.polyatomic && a.formula === anion)) return 'acid'
    return null // HCl without (aq): the core allows either reading
  }
  if (/NH4/.test(formula) || METALS.some(([sym]) => formula.startsWith(sym) && !/^[A-Z][a-z]?[a-z]/.test(formula.slice(sym.length, sym.length + 1)))) return 'ionic'
  if (/^([A-Z][a-z]?)(\d*)([A-Z][a-z]?)(\d*)$/.test(formula)) return 'molecular'
  return null
}

// ---------- the sweep --------------------------------------------------------------------------------

type Stage = { part: string; answerText: string; accept: string[]; kind: string }
type Answer = { given: string; problem: string; ions?: { cation: string; anion: string }; stages: Stage[] }

/** What the oracle says each part's answer is, or null when it does not know. */
function expected(template: string, a: Answer, stage: Stage): { text: string; compare: 'name' | 'formula' } | null {
  const p = a.problem
  switch (stage.part) {
    case 'ion-name': {
      const ion = ionOf(p)
      return ion ? { text: ion.name, compare: 'name' } : null
    }
    case 'ion-formula': {
      // nm.ion by name, or one of the two ions of an ions-by-name problem.
      const names = a.ions ? [a.ions.cation, a.ions.anion] : [p]
      const which = stage.answerText.includes('+') ? names[0]! : names[names.length - 1]!
      const ion = ionByName(which)
      return ion ? { text: ionText(ion), compare: 'formula' } : null
    }
    case 'ionic-formula': {
      if (a.ions) {
        const c = ionOf(a.ions.cation) ?? ionByName(a.ions.cation)
        const an = ionOf(a.ions.anion) ?? ionByName(a.ions.anion)
        return c && an ? { text: formulaOf(c, an), compare: 'formula' } : null
      }
      const pair = PAIR_BY_NAME.get(nameKey(p))
      return pair ? { text: formulaOf(pair[0], pair[1]), compare: 'formula' } : null
    }
    case 'ionic-name': {
      const pair = PAIRS.get(p)
      return pair ? { text: ionicName(pair[0], pair[1]), compare: 'name' } : null
    }
    case 'molecular-name': {
      const m = /^([A-Z][a-z]?)(\d*)([A-Z][a-z]?)(\d*)$/.exec(p)
      const name = m ? molecularName(m[1]!, Number(m[2] || 1), m[3]!, Number(m[4] || 1)) : null
      return name ? { text: name, compare: 'name' } : null
    }
    case 'molecular-formula': {
      const f = MOLECULAR_BY_NAME.get(nameKey(p))
      return f ? { text: f, compare: 'formula' } : null
    }
    case 'acid-name': {
      if (a.given === 'anion') {
        const ion = ionOf(p)
        const n = ion ? acidName(ion) : null
        return n ? { text: n, compare: 'name' } : null
      }
      const m = /^(H\d*)([A-Za-z0-9]+?)(\(aq\))?$/.exec(p)
      if (!m) return null
      const hs = m[1] === 'H' ? 1 : Number(m[1]!.slice(1))
      const ion = ANIONS.find((x) => x.formula === m[2] && x.charge === -hs)
      const n = ion ? acidName(ion) : null
      return n ? { text: n, compare: 'name' } : null
    }
    case 'acid-formula': {
      const ion = ANIONS.find((x) => acidName(x) !== null && nameKey(acidName(x)!) === nameKey(p))
      return ion ? { text: acidFormula(ion), compare: 'formula' } : null
    }
    case 'hydrate-name': {
      const n = hydrateName(p)
      return n ? { text: n, compare: 'name' } : null
    }
    case 'hydrate-formula': {
      const f = hydrateFormula(p)
      return f ? { text: f, compare: 'formula' } : null
    }
    case 'class': {
      const c = classOf(p)
      return c ? { text: c, compare: 'name' } : null
    }
    default:
      throw new Error(`${template}: unknown part ${stage.part}`)
  }
}

const sameFormula = (x: string, y: string) => x.replace(/\s+/g, '').replace(/CH3COO/g, 'C2H3O2') === y.replace(/\s+/g, '').replace(/CH3COO/g, 'C2H3O2')

const TEMPLATES: [ModuleId, string][] = [
  ['ionicNames' as ModuleId, 'nm.ion'],
  ['ionicNames' as ModuleId, 'nm.ionicFormula'],
  ['ionicNames' as ModuleId, 'nm.ionicName'],
  ['ionicNames' as ModuleId, 'nm.ionicFromName'],
  ['molecularAcids' as ModuleId, 'nm.molecular'],
  ['molecularAcids' as ModuleId, 'nm.acid'],
  ['molecularAcids' as ModuleId, 'nm.hydrate'],
  ['molecularAcids' as ModuleId, 'nm.classify'],
]

describe('chapter 7 answered again with the reviewer’s own ion table and rules', () => {
  it.each(TEMPLATES)('%s/%s', (module, template) => {
    const bad: string[] = []
    let checked = 0
    let skipped = 0
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = generateProblem(module, template, seed).answer as unknown as Answer
      for (const stage of a.stages) {
        const want = expected(template, a, stage)
        if (!want) {
          skipped++
          continue
        }
        checked++
        const forms = [stage.answerText, ...stage.accept]
        const ok = want.compare === 'name' ? forms.some((f) => nameKey(f) === nameKey(want.text)) : forms.some((f) => sameFormula(f, want.text))
        if (!ok) bad.push(`${template}/${seed} ${stage.part} of “${a.problem}”: oracle ${want.text}, stored ${stage.answerText}${stage.accept.length ? ` (+${stage.accept.join(' | ')})` : ''}`)
      }
    }
    expect(bad.slice(0, 12), `${bad.length} disagreements`).toEqual([])
    expect(checked / (checked + skipped), `${template}: checked ${checked}, outside the oracle ${skipped}`).toBeGreaterThan(0.7)
  }, HEAVY)
})
