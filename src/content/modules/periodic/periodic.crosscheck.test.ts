/**
 * Solve each problem again from the wording. The stored `check` is not used to compute the
 * answer. Rankings are sorted from the trend table's own columns.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { ELEMENTS, elementBySymbol, type ElementInfo } from '@/engine/chem/elements'
import { TRENDS } from '@/engine/chem/trends'
import type { PeriodicAnswer } from '@/content/types'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000
const TEMPLATES = ['pt.locate', 'pt.valence', 'pt.trends', 'pt.ions', 'pt.why'] as const

const METALLOIDS = new Set(['B', 'Si', 'Ge', 'As', 'Sb', 'Te'])
const NONMETALS = new Set(['H', 'He', 'C', 'N', 'O', 'F', 'Ne', 'P', 'S', 'Cl', 'Ar', 'Se', 'Br', 'Kr', 'I', 'Xe', 'Rn', 'At'])
const EXCEPTIONS: readonly (readonly [string, string])[] = [
  ['Be', 'B'],
  ['N', 'O'],
  ['Mg', 'Al'],
  ['P', 'S'],
]

const PROTONS = 'More protons pull on the same shell'
const SHELLS = 'There is another shell of electrons'
const SHIELDING = 'Inner electrons block the nucleus'

type Property = 'radius' | 'ionization' | 'electronegativity' | 'metallic'

function answerOf(templateId: string, seed: number): PeriodicAnswer {
  const p = generateProblem('periodic', templateId, seed)
  if (p.answer.type !== 'periodic') throw new Error(`${templateId}/${seed} is ${p.answer.type}`)
  return p.answer
}

function byName(name: string): ElementInfo {
  const el = ELEMENTS.find((item) => item.name === name)
  if (!el) throw new Error(`no element named ${name}`)
  return el
}

function who(text: string): ElementInfo {
  const symbol = elementBySymbol(text)
  if (symbol && text === symbol.symbol) return symbol
  return byName(text)
}

function blockOf(el: ElementInfo): string {
  if ((el.z >= 57 && el.z <= 71) || (el.z >= 89 && el.z <= 103)) return 'f'
  if (el.symbol === 'He') return 's'
  if (el.group == null) return 'f'
  if (el.group <= 2) return 's'
  if (el.group >= 13) return 'p'
  return 'd'
}

function classOf(el: ElementInfo): string {
  if (METALLOIDS.has(el.symbol)) return 'metalloid'
  if (NONMETALS.has(el.symbol)) return 'nonmetal'
  return 'metal'
}

function familyOf(el: ElementInfo): string | null {
  if (el.group === 1 && el.symbol !== 'H') return 'alkali metals'
  if (el.group === 2) return 'alkaline earth metals'
  if (el.group === 17) return 'halogens'
  if (el.group === 18) return 'noble gases'
  if (el.group != null && el.group >= 3 && el.group <= 12) return 'transition metals'
  return null
}

function valenceOf(el: ElementInfo): number {
  if (el.symbol === 'He') return 2
  if (el.group === 1 || el.group === 2) return el.group
  if (el.group != null && el.group >= 13 && el.group <= 18) return el.group - 10
  throw new Error(`${el.symbol} has no valence count`)
}

function valenceFromGroup(group: number): number {
  if (group === 1 || group === 2) return group
  if (group >= 13 && group <= 18) return group - 10
  throw new Error(`group ${group} has no valence count`)
}

function readConfig(text: string): { valence: number; period: number; block: string } {
  const parts = text.trim().split(/\s+/).map((bit) => {
    const match = /^([1-7])([spdf])(\d+)$/.exec(bit)
    if (!match) throw new Error(`unreadable subshell ${bit}`)
    return { n: Number(match[1]), l: match[2]!, e: Number(match[3]) }
  })
  const period = Math.max(...parts.map((part) => part.n))
  const valence = parts.filter((part) => part.n === period).reduce((sum, part) => sum + part.e, 0)
  return { valence, period, block: parts[parts.length - 1]!.l }
}

function parseSymbol(token: string): ElementInfo {
  const letters = token.trim()
  const el = elementBySymbol(letters.length === 1 ? letters.toUpperCase() : letters[0]!.toUpperCase() + letters.slice(1).toLowerCase())
  if (!el) throw new Error(`no element ${token}`)
  return el
}

function parseIon(token: string): { el: ElementInfo; charge: number } {
  const flat = token.trim().replace(/\s+/g, '').replace(/−/g, '-')
  const match = /^([A-Za-z]{1,2})(?:(\d*)([+-])|([+-])(\d*))?$/.exec(flat)
  if (!match) throw new Error(`unreadable ion ${token}`)
  const el = parseSymbol(match[1]!)
  let charge = 0
  if (match[3]) charge = (match[3] === '+' ? 1 : -1) * (match[2] ? Number(match[2]) : 1)
  else if (match[4]) charge = (match[4] === '+' ? 1 : -1) * (match[5] ? Number(match[5]) : 1)
  return { el, charge }
}

function ionText(el: ElementInfo, charge: number): string {
  if (charge === 0) return el.symbol
  const mag = Math.abs(charge)
  const sign = charge > 0 ? '+' : '-'
  return mag === 1 ? `${el.symbol}${sign}` : `${el.symbol}${mag}${sign}`
}

function column(z: number, property: Exclude<Property, 'metallic'>): number {
  const row = TRENDS[z - 1]
  if (!row || row.z !== z) throw new Error(`no trend row for Z ${z}`)
  if (property === 'radius') return row.radiusPm
  if (property === 'ionization') return row.ionizationKjMol
  return row.electronegativity
}

/** Higher score means more of the property, by the rule she is taught. */
function trendScore(el: ElementInfo, property: Property): number {
  const group = el.group
  if (group == null) throw new Error(`${el.symbol} has no group`)
  const growsDown = property === 'radius' || property === 'metallic'
  return (growsDown ? el.period : -el.period) * 100 + (growsDown ? -group : group)
}

function orderSymbols(els: ElementInfo[], property: Property, direction: 'increasing' | 'decreasing'): string {
  const sorted = els.slice().sort((a, b) => {
    if (property === 'metallic') return trendScore(a, property) - trendScore(b, property)
    return column(a.z, property) - column(b.z, property)
  })
  const symbols = (direction === 'increasing' ? sorted : sorted.slice().reverse()).map((el) => el.symbol)
  return symbols.join(', ')
}

function propertyOf(phrase: string): Property {
  if (phrase === 'atomic radius') return 'radius'
  if (phrase === 'first ionization energy') return 'ionization'
  if (phrase === 'electronegativity') return 'electronegativity'
  if (phrase === 'metallic character') return 'metallic'
  throw new Error(`unknown property ${phrase}`)
}

function stageText(answer: PeriodicAnswer, label: string): string {
  const stage = answer.stages.find((item) => item.label === label)
  if (!stage) throw new Error(`no part ${label} in ${answer.prompt}`)
  return stage.answerText
}

function checkLocate(answer: PeriodicAnswer) {
  const match = /^Where is (.+) on the periodic table\?$/.exec(answer.prompt)
  if (!match) throw new Error(answer.prompt)
  const el = who(match[1]!)
  expect(stageText(answer, 'Period')).toBe(String(el.period))
  expect(stageText(answer, 'Group')).toBe(el.group == null ? 'none' : String(el.group))
  expect(stageText(answer, 'Block')).toBe(blockOf(el))
  expect(stageText(answer, 'Class')).toBe(classOf(el))
  const family = familyOf(el)
  if (family) expect(stageText(answer, 'Family')).toBe(family)
  else expect(answer.stages.some((stage) => stage.label === 'Family')).toBe(false)
}

function checkValence(answer: PeriodicAnswer) {
  const numbered = /^How many valence electrons does an element in group (\d+) have(?:, other than helium)?\?$/.exec(answer.prompt)
  if (numbered) {
    expect(stageText(answer, 'Valence electrons')).toBe(String(valenceFromGroup(Number(numbered[1]))))
    return
  }
  if (answer.prompt === 'How many valence electrons does an element in the first column have, other than hydrogen?') {
    expect(stageText(answer, 'Valence electrons')).toBe('1')
    return
  }
  if (answer.prompt === 'How many valence electrons does an element in the second column have?') {
    expect(stageText(answer, 'Valence electrons')).toBe('2')
    return
  }
  const named = /^How many valence electrons does (.+) have\?$/.exec(answer.prompt)
  if (named) {
    expect(stageText(answer, 'Valence electrons')).toBe(String(valenceOf(who(named[1]!))))
    return
  }
  const config = /^Read this configuration: (.+)\.$/.exec(answer.prompt)
  if (!config) throw new Error(answer.prompt)
  const read = readConfig(config[1]!)
  expect(stageText(answer, 'Valence electrons')).toBe(String(read.valence))
  expect(stageText(answer, 'Block')).toBe(read.block)
  expect(stageText(answer, 'Period')).toBe(String(read.period))
}

function checkTrends(answer: PeriodicAnswer) {
  const match = /^Rank these by (.+), (increasing|decreasing): (.+)\.$/.exec(answer.prompt)
  if (!match) throw new Error(answer.prompt)
  const property = propertyOf(match[1]!)
  const direction = match[2] as 'increasing' | 'decreasing'
  const els = match[3]!.split(',').map((token) => parseSymbol(token))
  expect(new Set(els.map((el) => el.symbol)).size).toBe(els.length)
  for (const el of els) {
    expect(el.z).toBeLessThanOrEqual(56)
    expect(TRENDS[el.z - 1]?.z).toBe(el.z)
    if (property !== 'ionization') expect(el.group).not.toBe(18)
  }
  if (property === 'ionization') {
    const symbols = new Set(els.map((el) => el.symbol))
    for (const [left, right] of EXCEPTIONS) expect(symbols.has(left) && symbols.has(right)).toBe(false)
  }
  const fromData = orderSymbols(els, property, direction)
  expect(stageText(answer, 'Order')).toBe(fromData)
  if (property !== 'metallic') expect(orderSymbols(els, property, direction)).toBe(fromData)
  const byRule = els
    .slice()
    .sort((a, b) => trendScore(a, property) - trendScore(b, property))
    .map((el) => el.symbol)
  const ruled = (direction === 'increasing' ? byRule : byRule.slice().reverse()).join(', ')
  expect(ruled).toBe(fromData)
  const rank = answer.stages[0]!.check
  if (rank.kind !== 'rank') throw new Error('trends part is not a ranking')
  expect(rank.property).toBe(property)
  expect(rank.direction).toBe(direction)
  expect(rank.zs.map((z) => elementBySymbol(ELEMENTS[z - 1]!.symbol)!.z).sort((a, b) => a - b)).toEqual(els.map((el) => el.z).sort((a, b) => a - b))
  if (property !== 'metallic') {
    const claimed = rank.zs
      .slice()
      .sort((a, b) => column(a, property) - column(b, property))
    const directed = direction === 'increasing' ? claimed : claimed.slice().reverse()
    expect(directed.map((z) => ELEMENTS[z - 1]!.symbol).join(', ')).toBe(answer.stages[0]!.answerText)
  }
}

function checkIons(answer: PeriodicAnswer) {
  const compare = /^Which is larger, (.+) or (.+)\?$/.exec(answer.prompt)
  if (compare) {
    const left = parseIon(compare[1]!)
    const right = parseIon(compare[2]!)
    const pair = [left, right]
    expect(pair.filter((item) => item.charge === 0)).toHaveLength(1)
    const ion = pair.find((item) => item.charge !== 0)!
    const atom = pair.find((item) => item.charge === 0)!
    expect(ion.el.z).toBe(atom.el.z)
    expect(ion.el.commonCharges).toContain(ion.charge)
    const larger = ion.charge > 0 ? atom.el.symbol : ionText(ion.el, ion.charge)
    expect(stageText(answer, 'Larger one')).toBe(larger)
    return
  }
  const series = /^These ions have the same number of electrons\. Rank them by ionic radius, (increasing|decreasing): (.+)\.$/.exec(answer.prompt)
  if (!series) throw new Error(answer.prompt)
  const direction = series[1] as 'increasing' | 'decreasing'
  const ions = series[2]!.split(',').map((token) => parseIon(token))
  const electrons = ions.map((ion) => ion.el.z - ion.charge)
  expect(new Set(electrons).size).toBe(1)
  for (const ion of ions) expect(ion.el.commonCharges).toContain(ion.charge)
  const increasing = ions.slice().sort((a, b) => b.el.z - a.el.z)
  const ordered = (direction === 'increasing' ? increasing : increasing.slice().reverse()).map((ion) => ionText(ion.el, ion.charge))
  expect(stageText(answer, 'Order')).toBe(ordered.join(', '))
}

function checkWhy(answer: PeriodicAnswer) {
  const match = /^Why does ([A-Za-z]{1,2}) have (a smaller atomic radius|a higher first ionization energy|a larger atomic radius|a lower first ionization energy) than ([A-Za-z]{1,2})\?$/.exec(answer.prompt)
  if (!match) throw new Error(answer.prompt)
  const focus = parseSymbol(match[1]!)
  const other = parseSymbol(match[3]!)
  const phrase = match[2]!
  let reason = PROTONS
  if (focus.period === other.period) reason = PROTONS
  else if (phrase === 'a larger atomic radius') reason = SHELLS
  else if (phrase === 'a lower first ionization energy') reason = SHIELDING
  else throw new Error(`unexpected down-group wording: ${answer.prompt}`)
  if (focus.period !== other.period) expect(focus.group).toBe(other.group)
  if (focus.period === other.period) expect(focus.group).not.toBe(other.group)
  expect(stageText(answer, 'Reason')).toBe(reason)
}

describe.each(TEMPLATES)('%s solved again from the wording', (templateId) => {
  it(
    'matches the tables, and every ranking matches the column it names',
    () => {
      for (const seed of SEEDS) {
        const answer = answerOf(templateId, seed)
        if (templateId === 'pt.locate') checkLocate(answer)
        else if (templateId === 'pt.valence') checkValence(answer)
        else if (templateId === 'pt.trends') checkTrends(answer)
        else if (templateId === 'pt.ions') checkIons(answer)
        else checkWhy(answer)
      }
    },
    HEAVY,
  )
})
