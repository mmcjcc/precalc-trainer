/**
 * Answers worked BY HAND, restated: each value below was computed on paper from the chemistry
 * (atom counts, charge balance, the activity series), not read back from the module. The grader
 * must accept the right answer and name each slip exactly.
 */
import { describe, expect, it } from 'vitest'
import type { ReactionsAnswer, RxCheck } from '@/content/types'
import { capName, elementName, elementsOf, reactionOf, speciesDisplay, speciesName } from './facts'
import { acceptedRxAnswers, canonicalRxAnswer, gradeRxStage, trapsForRx } from './grade'
import { BALANCED_TEXT, NONE_OFF, REACTS_TEXT, TYPE_ORDER, TYPE_TEXT } from './rules'

function choicesFor(check: RxCheck): string[] | null {
  switch (check.kind) {
    case 'is-balanced':
      return [BALANCED_TEXT.yes, BALANCED_TEXT.no]
    case 'off-element':
      return [...elementsOf(reactionOf(check.reaction)).map((el) => capName(elementName(el))), NONE_OFF]
    case 'type':
      return TYPE_ORDER.map((t) => TYPE_TEXT[t])
    case 'reacts':
      return [REACTS_TEXT.yes, REACTS_TEXT.no]
    default:
      return null
  }
}

/** A one-part problem built straight from a check, for hand-worked grading. */
function hand(check: RxCheck): ReactionsAnswer {
  const choices = choicesFor(check)
  const traps = trapsForRx(check)
  const r = check.kind === 'balance' ? reactionOf(check.reaction) : null
  return {
    type: 'reactions',
    question: 'count',
    prompt: 'Hand worked, not shown to her.',
    stages: [
      {
        id: 'a',
        kind: choices ? 'choice' : r ? 'coefficients' : 'text',
        label: 'Hand',
        hint: 'Hand.',
        answerText: canonicalRxAnswer(check),
        accept: acceptedRxAnswers(check),
        ...(choices ? { choices: choices.map((c) => ({ id: c, text: c })) } : {}),
        ...(r ? { slots: [...r.reactants, ...r.products].map((s) => speciesDisplay(s)), reactantCount: r.reactants.length } : {}),
        nudge: 'Hand.',
        ruleCard: 'rx.count',
        reveal: ['Hand.'],
        traps,
        check,
      },
    ],
    expectedDisplay: '',
    reveal: [],
    ruleCards: ['rx.count'],
  }
}

function grade(check: RxCheck, text: string) {
  return gradeRxStage(hand(check), 'a', text)
}

function expectMistake(check: RxCheck, text: string, id: string) {
  const g = grade(check, text)
  expect(g.verdict, `${text}: ${g.verdict === 'mistake' ? g.mistake : g.message}`).toBe('mistake')
  if (g.verdict === 'mistake') expect(g.mistake).toBe(id)
  return g
}

describe('hand-worked answers', () => {
  it('counts O in 3Ca(NO3)2 as 18, and names the three counting slips', () => {
    const check: RxCheck = { kind: 'atom-count', formula: 'Ca(NO3)2', coefficient: 3, element: 'O' }
    // one unit: (NO3)2 holds 3 × 2 = 6 O; three units: 18
    expect(canonicalRxAnswer(check)).toBe('18')
    expect(grade(check, '18').verdict).toBe('correct')
    expect(grade(check, '18 atoms').verdict).toBe('correct')
    expectMistake(check, '6', 'rx_coef_first_only') // the 3 reached Ca only
    expectMistake(check, '9', 'rx_paren_first_only') // the 2 reached N only: 3 O × 3
    expectMistake(check, '8', 'rx_add_not_multiply') // 3 + 2 + 3
    expect(grade(check, '12').verdict).toBe('wrong')
    expect(grade(check, 'eighteen').verdict).toBe('invalid')
  })

  it('counts H in 2NH3 as 6 and H in 3Ca(OH)2 as 6', () => {
    const nh3: RxCheck = { kind: 'atom-count', formula: 'NH3', coefficient: 2, element: 'H' }
    expect(canonicalRxAnswer(nh3)).toBe('6')
    expectMistake(nh3, '3', 'rx_coef_first_only')
    expectMistake(nh3, '5', 'rx_add_not_multiply') // 2 + 3
    const caoh2: RxCheck = { kind: 'atom-count', formula: 'Ca(OH)2', coefficient: 3, element: 'H' }
    expect(canonicalRxAnswer(caoh2)).toBe('6') // (OH)2 has 2 H; three units
    expectMistake(caoh2, '2', 'rx_coef_first_only')
    expectMistake(caoh2, '3', 'rx_paren_first_only') // the 2 went to O, so 1 H per unit
    expectMistake(caoh2, '5', 'rx_add_not_multiply') // 3 + 2
  })

  it('counts O in 4Fe2O3 as 12 and Fe in 2Fe2O3 as 4 (no slip possible there)', () => {
    const o: RxCheck = { kind: 'atom-count', formula: 'Fe2O3', coefficient: 4, element: 'O' }
    expect(canonicalRxAnswer(o)).toBe('12')
    expectMistake(o, '3', 'rx_coef_first_only')
    expectMistake(o, '7', 'rx_add_not_multiply')
    const fe: RxCheck = { kind: 'atom-count', formula: 'Fe2O3', coefficient: 2, element: 'Fe' }
    expect(canonicalRxAnswer(fe)).toBe('4')
    // Fe is first (the coefficient slip changes nothing) and 2 + 2 = 2 × 2: no trap is honest here.
    expect(trapsForRx(fe)).toEqual([])
  })

  it('balances 2Al + 6HCl -> 2AlCl3 + 3H2 and names doubled and one-element-off answers', () => {
    const check: RxCheck = { kind: 'balance', reaction: 's.al.hcl' }
    expect(canonicalRxAnswer(check)).toBe('2 6 2 3')
    expect(grade(check, '2|6|2|3').verdict).toBe('correct')
    expect(grade(check, '2 6 2 3').verdict).toBe('correct')
    expectMistake(check, '4 12 4 6', 'rx_not_lowest')
    // 2Al + 6HCl -> 2AlCl3 + 2H2: Al 2 = 2, Cl 6 = 6, H 6 against 4
    const off = expectMistake(check, '2 6 2 2', 'rx_element_unbalanced')
    if (off.verdict === 'mistake') {
      expect(off.witness).toContain('hydrogen')
      expect(off.witness).toContain('6')
      expect(off.witness).toContain('4')
      expect(off.witness).not.toContain('2 6 2 3')
    }
    // all 1s: H 1 against 2 AND Cl 1 against 3 — two elements off, no single named slip
    expect(grade(check, '1 1 1 1').verdict).toBe('wrong')
    expect(grade(check, '2 6 2').verdict).toBe('invalid')
    expect(grade(check, '2|6||3').verdict).toBe('invalid')
    expect(grade(check, '0 0 0 0').verdict).toBe('invalid')
  })

  it('balances 2H2 + O2 -> 2H2O, and the skeleton leaves only oxygen off', () => {
    const check: RxCheck = { kind: 'balance', reaction: 'c.h2o' }
    expect(canonicalRxAnswer(check)).toBe('2 1 2')
    expectMistake(check, '1 1 1', 'rx_element_unbalanced') // H 2 = 2, O 2 against 1
    expectMistake(check, '4 2 4', 'rx_not_lowest')
  })

  it('balances 3Ca(OH)2 + 2H3PO4 -> Ca3(PO4)2 + 6H2O', () => {
    expect(canonicalRxAnswer({ kind: 'balance', reaction: 'x.ca3po42' })).toBe('3 2 1 6')
    expect(canonicalRxAnswer({ kind: 'balance', reaction: 'b.c2h6' })).toBe('2 7 4 6')
  })

  it('reads whether an equation balances, and which element is off', () => {
    expect(canonicalRxAnswer({ kind: 'is-balanced', reaction: 'c.fe2o3', coefficients: [4, 3, 2] })).toBe('Balanced')
    // 2Fe + 3O2 -> Fe2O3: Fe 2 = 2, O 6 against 3
    expect(canonicalRxAnswer({ kind: 'is-balanced', reaction: 'c.fe2o3', coefficients: [2, 3, 1] })).toBe('Not balanced')
    expect(canonicalRxAnswer({ kind: 'off-element', reaction: 'c.fe2o3', coefficients: [2, 3, 1] })).toBe('Oxygen')
    expect(canonicalRxAnswer({ kind: 'off-element', reaction: 'c.h2o', coefficients: [2, 1, 2] })).toBe(NONE_OFF)
    expect(grade({ kind: 'off-element', reaction: 'c.h2o', coefficients: [1, 1, 1] }, 'oxygen').verdict).toBe('correct')
  })

  it('names the five reaction types, with the two swaps', () => {
    expect(canonicalRxAnswer({ kind: 'type', reaction: 'd.kclo3' })).toBe('Decomposition')
    expectMistake({ kind: 'type', reaction: 'd.kclo3' }, 'Combination', 'rx_combo_decomp_swapped')
    expectMistake({ kind: 'type', reaction: 'c.nh3' }, 'Decomposition', 'rx_combo_decomp_swapped')
    expectMistake({ kind: 'type', reaction: 's.zn.hcl' }, 'Double replacement', 'rx_single_double_swapped')
    expectMistake({ kind: 'type', reaction: 'x.agcl' }, 'Single replacement', 'rx_single_double_swapped')
    expect(canonicalRxAnswer({ kind: 'type', reaction: 'b.c3h8' })).toBe('Combustion')
    expect(grade({ kind: 'type', reaction: 'b.c3h8' }, 'Combination').verdict).toBe('wrong')
  })

  it('writes product formulas from the charges (the nomenclature engine grades them)', () => {
    const alcl3: RxCheck = { kind: 'ionic-product', cation: 'Al^3+', anion: 'Cl^-', reactants: [] }
    expect(canonicalRxAnswer(alcl3)).toBe('AlCl3') // Al³⁺ needs three Cl⁻
    expect(grade(alcl3, 'AlCl3(s)').verdict).toBe('correct')
    expectMistake(alcl3, 'AlCl', 'nm_charges_unbalanced')
    const mg3n2: RxCheck = { kind: 'ionic-product', cation: 'Mg^2+', anion: 'N^3-', reactants: [] }
    expect(canonicalRxAnswer(mg3n2)).toBe('Mg3N2') // 3 × 2+ = 6+, 2 × 3− = 6−
    expectMistake(mg3n2, 'Mg2N3', 'nm_crisscross_reversed')
    const fe2o3: RxCheck = { kind: 'ionic-product', cation: 'Fe^3+', anion: 'O^2-', reactants: [] }
    expect(canonicalRxAnswer(fe2o3)).toBe('Fe2O3')
  })

  it('a double replacement trades partners; a reactant handed back is named', () => {
    const agcl: RxCheck = { kind: 'ionic-product', cation: 'Ag^+', anion: 'Cl^-', reactants: ['AgNO3', 'NaCl'] }
    expect(canonicalRxAnswer(agcl)).toBe('AgCl')
    expectMistake(agcl, 'AgNO3', 'rx_not_swapped')
    expectMistake(agcl, 'NaCl', 'rx_not_swapped')
    const pbi2: RxCheck = { kind: 'ionic-product', cation: 'Pb^2+', anion: 'I^-', reactants: ['Pb(NO3)2', 'KI'] }
    expect(canonicalRxAnswer(pbi2)).toBe('PbI2') // Pb²⁺ needs two I⁻
    const feoh3: RxCheck = { kind: 'ionic-product', cation: 'Fe^3+', anion: 'OH^-', reactants: ['FeCl3', 'NaOH'] }
    expect(canonicalRxAnswer(feoh3)).toBe('Fe(OH)3')
    const zn: RxCheck = { kind: 'ionic-product', cation: 'Zn^2+', anion: 'SO4^2-', reactants: ['CuSO4'] }
    expect(canonicalRxAnswer(zn)).toBe('ZnSO4')
    expectMistake(zn, 'CuSO4', 'rx_not_swapped')
  })

  it('writes free elements, the seven diatomics with a 2', () => {
    const o: RxCheck = { kind: 'element', symbol: 'O' }
    expect(canonicalRxAnswer(o)).toBe('O2')
    expectMistake(o, 'O', 'rx_diatomic_single')
    expect(grade(o, 'O3').verdict).toBe('wrong')
    expect(grade(o, 'O2(g)').verdict).toBe('correct')
    expectMistake({ kind: 'element', symbol: 'Br' }, 'Br', 'rx_diatomic_single')
    expect(canonicalRxAnswer({ kind: 'element', symbol: 'Cu' })).toBe('Cu')
    expect(grade({ kind: 'element', symbol: 'Cu' }, 'Cu2').verdict).toBe('wrong')
    expect(grade({ kind: 'element', symbol: 'S' }, 'S8').verdict).toBe('correct')
    expect(grade(o, 'o2').verdict).toBe('invalid')
  })

  it('reads the activity series', () => {
    const cases: [string, string, string][] = [
      ['Zn', 'CuSO4', 'Reacts'], // zinc above copper
      ['Ag', 'CuSO4', 'No reaction'], // silver below copper
      ['Cu', 'AgNO3', 'Reacts'], // copper above silver
      ['Au', 'AgNO3', 'No reaction'],
      ['Zn', 'HCl', 'Reacts'], // zinc above hydrogen
      ['Cu', 'HCl', 'No reaction'], // copper below hydrogen
      ['Na', 'H2O', 'Reacts'], // one of the three that beat cold water
      ['Cu', 'H2O', 'No reaction'],
      ['Cl', 'NaBr', 'Reacts'], // chlorine above bromine
      ['I', 'NaBr', 'No reaction'], // iodine below bromine
    ]
    for (const [lone, compound, expected] of cases) {
      const check: RxCheck = { kind: 'reacts', lone, compound }
      expect(canonicalRxAnswer(check), `${lone} + ${compound}`).toBe(expected)
      expectMistake(check, expected === 'Reacts' ? 'No reaction' : 'Reacts', 'rx_activity_backwards')
    }
  })

  it('complete combustion gives carbon dioxide and water', () => {
    const c: RxCheck = { kind: 'combustion-product', fuel: 'C3H8', carries: 'carbon' }
    const h: RxCheck = { kind: 'combustion-product', fuel: 'C3H8', carries: 'hydrogen' }
    expect(canonicalRxAnswer(c)).toBe('CO2')
    expect(canonicalRxAnswer(h)).toBe('H2O')
    expectMistake(c, 'CO', 'rx_combustion_products')
    expectMistake(c, 'C', 'rx_combustion_products')
    expectMistake(h, 'H2', 'rx_combustion_products')
    expect(grade(c, 'H2O').verdict).toBe('wrong')
  })

  it('turns names into formulas with the engine, and names each species of a word equation', () => {
    expect(canonicalRxAnswer({ kind: 'named-formula', name: 'copper(II) sulfate' })).toBe('CuSO4')
    expect(canonicalRxAnswer({ kind: 'named-formula', name: 'hydrochloric acid' })).toBe('HCl')
    expect(canonicalRxAnswer({ kind: 'named-formula', name: 'water' })).toBe('H2O')
    expect(canonicalRxAnswer({ kind: 'named-formula', name: 'methane' })).toBe('CH4')
    expect(canonicalRxAnswer({ kind: 'named-formula', name: 'calcium hydroxide' })).toBe('Ca(OH)2')
    expectMistake({ kind: 'named-formula', name: 'aluminum chloride' }, 'AlCl', 'nm_charges_unbalanced')
    expect(speciesName({ formula: 'HCl', state: 'aq' })).toBe('hydrochloric acid')
    expect(speciesName({ formula: 'O2', state: 'g' })).toBe('oxygen gas')
    expect(speciesName({ formula: 'Br2', state: 'l' })).toBe('bromine')
    expect(speciesName({ formula: 'HgO', state: 's' })).toBe('mercury(II) oxide')
    expect(speciesName({ formula: 'Fe2O3', state: 's' })).toBe('iron(III) oxide')
    expect(speciesName({ formula: 'NaHCO3', state: 's' })).toBe('sodium hydrogen carbonate')
  })
})
