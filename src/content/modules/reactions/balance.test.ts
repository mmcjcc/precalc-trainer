import { describe, expect, it } from 'vitest'
import { balanceReaction, balances, coefficientsOf, commonFactor, elementMatrix, gcd } from './balance'
import { REACTIONS, type RxReaction } from './facts'

/**
 * Every reaction of the table balanced BY HAND (reactants, then products), restated here so the
 * balancer is pinned against arithmetic done outside it. Each line was checked element by element.
 */
const BY_HAND: Readonly<Record<string, string>> = {
  'c.h2o': '2H2 + O2 -> 2H2O',
  'c.fe2o3': '4Fe + 3O2 -> 2Fe2O3',
  'c.nacl': '2Na + Cl2 -> 2NaCl',
  'c.mgo': '2Mg + O2 -> 2MgO',
  'c.al2o3': '4Al + 3O2 -> 2Al2O3',
  'c.nh3': 'N2 + 3H2 -> 2NH3',
  'c.kbr': '2K + Br2 -> 2KBr',
  'c.alcl3': '2Al + 3Cl2 -> 2AlCl3',
  'c.mg3n2': '3Mg + N2 -> Mg3N2',
  'c.caoh2': 'CaO + H2O -> Ca(OH)2',
  'c.h2so4': 'SO3 + H2O -> H2SO4',
  'c.zns': 'Zn + S -> ZnS',
  'c.cuo': '2Cu + O2 -> 2CuO',
  'c.p4o10': 'P4 + 5O2 -> P4O10',
  'd.h2o': '2H2O -> 2H2 + O2',
  'd.kclo3': '2KClO3 -> 2KCl + 3O2',
  'd.caco3': 'CaCO3 -> CaO + CO2',
  'd.hgo': '2HgO -> 2Hg + O2',
  'd.nacl': '2NaCl -> 2Na + Cl2',
  'd.ag2o': '2Ag2O -> 4Ag + O2',
  'd.nahco3': '2NaHCO3 -> Na2CO3 + H2O + CO2',
  'd.al2o3': '2Al2O3 -> 4Al + 3O2',
  'd.cuoh2': 'Cu(OH)2 -> CuO + H2O',
  'd.h2co3': 'H2CO3 -> H2O + CO2',
  'd.mgcl2': 'MgCl2 -> Mg + Cl2',
  's.zn.hcl': 'Zn + 2HCl -> ZnCl2 + H2',
  's.al.hcl': '2Al + 6HCl -> 2AlCl3 + 3H2',
  's.fe.cuso4': 'Fe + CuSO4 -> FeSO4 + Cu',
  's.cu.agno3': 'Cu + 2AgNO3 -> Cu(NO3)2 + 2Ag',
  's.zn.cuso4': 'Zn + CuSO4 -> ZnSO4 + Cu',
  's.mg.hcl': 'Mg + 2HCl -> MgCl2 + H2',
  's.na.h2o': '2Na + 2H2O -> 2NaOH + H2',
  's.k.h2o': '2K + 2H2O -> 2KOH + H2',
  's.cl2.nabr': 'Cl2 + 2NaBr -> 2NaCl + Br2',
  's.cl2.kbr': 'Cl2 + 2KBr -> 2KCl + Br2',
  's.al.cucl2': '2Al + 3CuCl2 -> 2AlCl3 + 3Cu',
  's.ca.h2o': 'Ca + 2H2O -> Ca(OH)2 + H2',
  's.zn.agno3': 'Zn + 2AgNO3 -> Zn(NO3)2 + 2Ag',
  's.mg.h2so4': 'Mg + H2SO4 -> MgSO4 + H2',
  'x.agcl': 'AgNO3 + NaCl -> AgCl + NaNO3',
  'x.baso4': 'BaCl2 + Na2SO4 -> BaSO4 + 2NaCl',
  'x.pbi2': 'Pb(NO3)2 + 2KI -> PbI2 + 2KNO3',
  'x.hcl.naoh': 'HCl + NaOH -> NaCl + H2O',
  'x.h2so4.naoh': 'H2SO4 + 2NaOH -> Na2SO4 + 2H2O',
  'x.ca3po42': '3Ca(OH)2 + 2H3PO4 -> Ca3(PO4)2 + 6H2O',
  'x.caco3': 'CaCl2 + Na2CO3 -> CaCO3 + 2NaCl',
  'x.feoh3': 'FeCl3 + 3NaOH -> Fe(OH)3 + 3NaCl',
  'x.cuoh2': 'CuSO4 + 2NaOH -> Cu(OH)2 + Na2SO4',
  'x.hno3.koh': 'HNO3 + KOH -> KNO3 + H2O',
  'x.aloh3': 'AlCl3 + 3NaOH -> Al(OH)3 + 3NaCl',
  'x.na3po4': '2Na3PO4 + 3CaCl2 -> Ca3(PO4)2 + 6NaCl',
  'b.ch4': 'CH4 + 2O2 -> CO2 + 2H2O',
  'b.c2h6': '2C2H6 + 7O2 -> 4CO2 + 6H2O',
  'b.c3h8': 'C3H8 + 5O2 -> 3CO2 + 4H2O',
  'b.c2h4': 'C2H4 + 3O2 -> 2CO2 + 2H2O',
  'b.c2h2': '2C2H2 + 5O2 -> 4CO2 + 2H2O',
  'b.c3h6': '2C3H6 + 9O2 -> 6CO2 + 6H2O',
  'b.c5h12': 'C5H12 + 8O2 -> 5CO2 + 6H2O',
  'b.c4h8': 'C4H8 + 6O2 -> 4CO2 + 4H2O',
}

/** '2Al + 6HCl -> 2AlCl3 + 3H2' → its coefficients and formulas, by a reader of this test's own. */
function readHand(line: string): { coefficients: number[]; formulas: string[] } {
  const terms = line.replace('->', '+').split('+').map((t) => t.trim())
  const coefficients: number[] = []
  const formulas: string[] = []
  for (const term of terms) {
    const m = /^(\d*)(.+)$/.exec(term)!
    coefficients.push(m[1] ? Number(m[1]) : 1)
    formulas.push(m[2]!)
  }
  return { coefficients, formulas }
}

function formulasOf(r: RxReaction): string[] {
  return [...r.reactants, ...r.products].map((s) => s.formula)
}

describe('the balancer', () => {
  it('pins all 59 table reactions against equations balanced by hand', () => {
    expect(Object.keys(BY_HAND).sort()).toEqual(REACTIONS.map((r) => r.id).sort())
    expect(REACTIONS.length).toBeGreaterThanOrEqual(45)
    expect(REACTIONS.length).toBeLessThanOrEqual(60)
    for (const r of REACTIONS) {
      const hand = readHand(BY_HAND[r.id]!)
      expect(hand.formulas, r.id).toEqual(formulasOf(r))
      expect(coefficientsOf(r), r.id).toEqual(hand.coefficients)
    }
  })

  it('every reaction has exactly one lowest-terms solution, no coefficient above 12', () => {
    for (const r of REACTIONS) {
      const result = balanceReaction(r)
      expect(result.ok, r.id).toBe(true)
      if (!result.ok) continue
      expect(commonFactor(result.coefficients), r.id).toBe(1)
      expect(Math.max(...result.coefficients), r.id).toBeLessThanOrEqual(12)
      expect(result.coefficients.every((c) => c >= 1), r.id).toBe(true)
      expect(balances(r, result.coefficients), r.id).toBe(true)
      // Doubling still balances; nudging any one coefficient never does (the solution is unique up to scale).
      expect(balances(r, result.coefficients.map((c) => 2 * c)), r.id).toBe(true)
      result.coefficients.forEach((_, i) => {
        expect(balances(r, result.coefficients.map((c, j) => (j === i ? c + 1 : c))), `${r.id} +1 at ${i}`).toBe(false)
      })
    }
  })

  it('reads the element matrix from the formulas (products negative)', () => {
    const r = REACTIONS.find((x) => x.id === 'x.ca3po42')!
    const { elements, matrix } = elementMatrix(r)
    expect(elements).toEqual(['Ca', 'O', 'H', 'P'])
    // Ca(OH)2, H3PO4, Ca3(PO4)2, H2O
    expect(matrix).toEqual([
      [1, 0, -3, 0],
      [2, 4, -8, -1],
      [2, 3, 0, -2],
      [0, 1, -2, 0],
    ])
  })

  it('reports an equation with no solution and one with many', () => {
    const none: RxReaction = { id: 't.none', type: 'combination', reactants: [{ formula: 'H2', state: 'g' }], products: [{ formula: 'O2', state: 'g' }] }
    expect(balanceReaction(none)).toEqual({ ok: false, reason: 'no-solution' })
    const many: RxReaction = {
      id: 't.many',
      type: 'combination',
      reactants: [
        { formula: 'H2', state: 'g' },
        { formula: 'O2', state: 'g' },
      ],
      products: [
        { formula: 'H2O', state: 'l' },
        { formula: 'H2O2', state: 'l' },
      ],
    }
    expect(balanceReaction(many)).toEqual({ ok: false, reason: 'many-solutions' })
    expect(gcd(12, 18)).toBe(6)
    expect(commonFactor([4, 2, 4])).toBe(2)
  })
})
