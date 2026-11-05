/**
 * Solve each problem again from the wording. The stored `check` is not used to compute the
 * answer: the element is read out of the prompt, its charge comes from the octet rule and its
 * column, and formulas are criss-crossed by hand. Everything must agree with what the module
 * stored, which itself comes from ELEMENTS data and the chem engines.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { IonicBondingAnswer } from '@/content/types'
import { ELEMENTS, elementBySymbol, type ElementInfo } from '@/engine/chem/elements'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000

const SUPER: Record<string, number> = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 }

// Copied sentences, so a reworded option cannot slip through unnoticed.
const PROPS_BY_SCENARIO: Record<string, string> = {
  melt: 'Every ion is gripped by its neighbors in all directions, so tearing the lattice apart takes a huge amount of energy',
  brittle: 'A struck layer shifts, like charges meet face to face, and the repulsion splits the crystal',
  conduct: 'In the solid the ions are locked into the lattice; melting frees the ions to move and carry the current',
  dissolve: 'Water pries the ions out of the lattice, and the freed ions carry the current through the solution',
}
const SEA_BY_ASK: Record<string, string> = {
  conduct: 'Its outer electrons belong to the whole piece and drift along it when pushed',
  bend: 'The positive centers slide past one another while the shared electrons keep holding the piece together',
  alloy: 'The shared electrons bond whatever metal atoms sit in the crystal, so atoms of another size can mix in',
  contrast: 'The metal’s moving charges are shared electrons; the crystal’s charges are ions that cannot leave their places',
}
const LOSE = 'Hand electrons over'
const GAIN = 'Pull electrons in'
const DOTS_VALENCE = 'Only the electrons of the outermost shell'

function answerOf(templateId: string, seed: number): IonicBondingAnswer {
  const p = generateProblem('ionicBonding', templateId, seed)
  if (p.answer.type !== 'ionicBonding') throw new Error(`${templateId}/${seed} is ${p.answer.type}`)
  return p.answer
}

function stageByLabel(a: IonicBondingAnswer, label: string) {
  const stage = a.stages.find((s) => s.label === label)
  if (!stage) throw new Error(`no part labeled ${label}`)
  return stage
}

function valenceOf(el: ElementInfo): number {
  if (el.group === 1 || el.group === 2) return el.group
  if (el.group != null && el.group >= 13 && el.group <= 18) return el.group - 10
  throw new Error(`${el.symbol} has no main-group valence count`)
}

/** The octet rule, from the column alone: groups 1, 2 and 13 shed; 15, 16, 17 collect. */
function chargeFromColumn(el: ElementInfo): number {
  const v = valenceOf(el)
  if (el.group === 1 || el.group === 2 || el.group === 13) return v
  if (el.group === 15 || el.group === 16 || el.group === 17) return -(8 - v)
  throw new Error(`${el.symbol} is not a clean octet-rule column`)
}

function ionText(el: ElementInfo, charge: number): string {
  const size = Math.abs(charge)
  return `${el.symbol}^${size === 1 ? '' : size}${charge > 0 ? '+' : '-'}`
}

/** The noble gas with this many electrons; every ion of the chapter matches one. */
function nobleGasShorthand(electrons: number): string {
  const gas = ELEMENTS.find((el) => el.group === 18 && el.z === electrons)
  if (!gas) throw new Error(`no noble gas with ${electrons} electrons`)
  return `[${gas.symbol}]`
}

function bySymbolInParens(prompt: string): ElementInfo | null {
  const m = /\(([A-Z][a-z]?)\)/.exec(prompt)
  if (!m) return null
  const el = elementBySymbol(m[1]!)
  if (!el) throw new Error(`prompt names unknown symbol ${m[1]}`)
  return el
}

function byConfiguration(prompt: string): ElementInfo {
  let electrons = 0
  for (const m of prompt.matchAll(/\b([1-7])([spdf])(\d+)\b/g)) electrons += Number(m[3])
  if (electrons === 0) throw new Error(`no configuration in: ${prompt}`)
  const el = ELEMENTS.find((item) => item.z === electrons)
  if (!el) throw new Error(`no element with ${electrons} electrons`)
  return el
}

function namesInPrompt(prompt: string): ElementInfo[] {
  const lower = prompt.toLowerCase()
  return ELEMENTS.filter((el) => new RegExp(`(?<![a-z])${el.name}(?![a-z])`).test(lower))
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

describe('ib.valence re-solved from the prompt', () => {
  it(
    'valence, direction, count, ion and shorthand all re-derive from the element table',
    () => {
      for (const seed of SEEDS) {
        const a = answerOf('ib.valence', seed)
        const el = bySymbolInParens(a.prompt) ?? byConfiguration(a.prompt)
        const valence = valenceOf(el)
        const charge = chargeFromColumn(el)
        expect(stageByLabel(a, 'Valence electrons').answerText, `${seed}`).toBe(String(valence))
        expect(stageByLabel(a, 'Which way do the electrons go?').answerText).toBe(charge > 0 ? LOSE : GAIN)
        expect(stageByLabel(a, 'How many electrons move').answerText).toBe(String(Math.abs(charge)))
        expect(stageByLabel(a, 'The ion').answerText).toBe(ionText(el, charge))
        expect(stageByLabel(a, 'Ion configuration').answerText).toBe(nobleGasShorthand(el.z - charge))
        // The taught charge in the element table agrees with the octet rule for every drawn element.
        expect(el.commonCharges).toEqual([charge])
      }
    },
    HEAVY,
  )
})

describe('ib.dots re-solved from the prompt', () => {
  it(
    'dot counts come from the outer shell as it stands',
    () => {
      for (const seed of SEEDS) {
        const a = answerOf('ib.dots', seed)
        const atom = bySymbolInParens(a.prompt)
        let dots: number
        if (atom) {
          dots = valenceOf(atom)
        } else {
          const m = /([A-Z][a-z]?)([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])/.exec(a.prompt)
          if (!m) throw new Error(`no species in: ${a.prompt}`)
          const el = elementBySymbol(m[1]!)
          if (!el) throw new Error(`unknown symbol ${m[1]}`)
          const size = m[2] ? [...m[2]].reduce((s, ch) => s * 10 + SUPER[ch]!, 0) : 1
          const charge = m[3] === '⁺' ? size : -size
          expect(charge).toBe(chargeFromColumn(el))
          dots = charge > 0 ? 0 : 8
        }
        expect(stageByLabel(a, 'Dots shown').answerText, `${seed}`).toBe(String(dots))
        expect(stageByLabel(a, 'What the dots stand for').answerText).toBe(DOTS_VALENCE)
      }
    },
    HEAVY,
  )
})

describe('ib.transfer re-solved from the prompt', () => {
  it(
    'ions, ratio, formula and electron count all follow from the two named elements',
    () => {
      for (const seed of SEEDS) {
        const a = answerOf('ib.transfer', seed)
        const named = namesInPrompt(a.prompt)
        expect(named.length, a.prompt).toBe(2)
        const metal = named.find((el) => chargeFromColumn(el) > 0)!
        const nonmetal = named.find((el) => chargeFromColumn(el) < 0)!
        expect(metal).toBeTruthy()
        expect(nonmetal).toBeTruthy()
        const c = chargeFromColumn(metal)
        const n = chargeFromColumn(nonmetal)
        const g = gcd(Math.abs(c), Math.abs(n))
        const cations = Math.abs(n) / g
        const anions = Math.abs(c) / g
        expect(stageByLabel(a, 'Metal ion').answerText, `${seed}`).toBe(ionText(metal, c))
        expect(stageByLabel(a, 'Nonmetal ion').answerText).toBe(ionText(nonmetal, n))
        expect(stageByLabel(a, 'Ions per formula unit').answerText).toBe(`${cations}:${anions}`)
        const formula = `${metal.symbol}${cations > 1 ? cations : ''}${nonmetal.symbol}${anions > 1 ? anions : ''}`
        expect(stageByLabel(a, 'Formula unit').answerText).toBe(formula)
        expect(stageByLabel(a, 'Electrons moved per unit').answerText).toBe(String(cations * c))
      }
    },
    HEAVY,
  )
})

describe('ib.props and mb.sea re-solved from the wording', () => {
  it(
    'each scenario maps to the lattice explanation, each metal behaviour to the sea explanation',
    () => {
      for (const seed of SEEDS) {
        const props = answerOf('ib.props', seed)
        const scenario = props.prompt.includes('hard to melt')
          ? 'melt'
          : props.prompt.includes('shatters')
            ? 'brittle'
            : props.prompt.includes('molten liquid')
              ? 'conduct'
              : props.prompt.includes('solution in water')
                ? 'dissolve'
                : null
        expect(scenario, props.prompt).not.toBeNull()
        expect(stageByLabel(props, 'The reason').answerText).toBe(PROPS_BY_SCENARIO[scenario!])

        const sea = answerOf('mb.sea', seed)
        const ask =
          sea.prompt.includes('completely solid') || sea.prompt.includes('doing the conducting')
            ? 'conduct'
            : sea.prompt.includes('hammer') || sea.prompt.includes('bend a bar')
              ? 'bend'
              : sea.prompt.includes('alloy') || sea.prompt.includes('stays bonded')
                ? 'alloy'
                : sea.prompt.includes('rock salt') || sea.prompt.includes('same bench')
                  ? 'contrast'
                  : null
        expect(ask, sea.prompt).not.toBeNull()
        expect(stageByLabel(sea, 'The reason').answerText).toBe(SEA_BY_ASK[ask!])
      }
    },
    HEAVY,
  )
})
