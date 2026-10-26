/**
 * The species table (species.ts): every catalog id is a variant of exactly one species (or one of the few entries
 * that are not mistakes), every species has variants, and both editions place every mistake they can make.
 * A new mistake in the catalog fails here until it is placed.
 */
import { describe, expect, it } from 'vitest'
import { ERROR_PATTERNS } from '@/engine'
import { NOT_MONSTERS, RARE, SPECIES, isMonster, speciesForEdition, speciesOf, variantIndex } from './species'

const CATALOG = Object.keys(ERROR_PATTERNS)
/** The chemistry modules' mistakes: significant figures, atoms, light, configurations, quantum numbers, the table, nomenclature. */
const CHEMISTRY = /^(sf|at|lt|ec|pt|nm|qn)_/

describe('the species table', () => {
  it('places every catalog id in exactly one species, or lists it as not a mistake', () => {
    const placed = new Map<string, string[]>()
    for (const s of SPECIES) for (const id of s.variants) placed.set(id, [...(placed.get(id) ?? []), s.id])
    const unplaced = CATALOG.filter((id) => !placed.has(id) && !(id in NOT_MONSTERS))
    expect(unplaced, 'catalog ids with no species: place each one in species.ts').toEqual([])
    const twice = [...placed].filter(([, where]) => where.length > 1)
    expect(twice, 'ids placed in two species').toEqual([])
    const unknown = [...placed.keys()].filter((id) => !(id in ERROR_PATTERNS))
    expect(unknown, 'placed ids that are not in the catalog').toEqual([])
    expect(Object.keys(NOT_MONSTERS).filter((id) => !(id in ERROR_PATTERNS))).toEqual([])
    expect(Object.keys(NOT_MONSTERS).filter((id) => placed.has(id))).toEqual([])
    expect(placed.size + Object.keys(NOT_MONSTERS).length).toBe(CATALOG.length)
  })

  it('every species has variants, its own id and its own name, a personality and a family', () => {
    expect(SPECIES.length).toBeGreaterThanOrEqual(28)
    expect(SPECIES.length).toBeLessThanOrEqual(36)
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(SPECIES.length)
    expect(new Set(SPECIES.map((s) => s.name)).size).toBe(SPECIES.length)
    for (const s of SPECIES) {
      expect(s.variants.length, s.id).toBeGreaterThanOrEqual(5)
      expect(new Set(s.variants).size, s.id).toBe(s.variants.length)
      expect(s.name.trim().length, s.id).toBeGreaterThan(3)
      expect(s.personality.length, s.id).toBeGreaterThan(15)
      expect(s.family.length, s.id).toBeGreaterThan(15)
    }
  })

  it('looks a mistake up both ways', () => {
    expect(speciesOf('no_sign_flip')?.name).toBe('The Sign Flipper')
    expect(speciesOf('log_sum_split')?.name).toBe('Log Splitter')
    expect(speciesOf('endpoint_type')?.name).toBe('Bracket Gremlin')
    expect(speciesOf('log_convert_swapped')?.name).toBe('The Base Bandit')
    expect(variantIndex('no_sign_flip')).toBe(0)
    for (const id of Object.keys(NOT_MONSTERS)) {
      expect(isMonster(id)).toBe(false)
      expect(speciesOf(id)).toBeNull()
    }
    expect(speciesOf('not_a_pattern')).toBeNull()
    expect(variantIndex('not_a_pattern')).toBe(-1)
  })

  it('rare variants are placed mistakes, a few per species at most', () => {
    for (const id of RARE) expect(isMonster(id), id).toBe(true)
    for (const s of SPECIES) expect(s.variants.filter((id) => RARE.has(id)).length, s.id).toBeLessThanOrEqual(3)
    expect(RARE.size).toBeLessThan(CATALOG.length / 5)
  })
})

describe('the editions', () => {
  it('chemistry mistakes are chemistry species, and every other mistake is a math species', () => {
    for (const s of SPECIES) {
      for (const id of s.variants) expect(CHEMISTRY.test(id) ? 'chemistry' : 'math', `${id} in ${s.id}`).toBe(s.subject)
    }
  })

  it('the store app (math only) shows the math species and places every math mistake', () => {
    const shown = speciesForEdition(true)
    expect(shown.every((s) => s.subject === 'math')).toBe(true)
    const ids = new Set(shown.flatMap((s) => s.variants))
    const math = CATALOG.filter((id) => !CHEMISTRY.test(id) && !(id in NOT_MONSTERS))
    expect(math.filter((id) => !ids.has(id))).toEqual([])
    expect(math.length).toBe(ids.size)
  })

  it('the family app shows every species and places every mistake', () => {
    const shown = speciesForEdition(false)
    expect(shown).toHaveLength(SPECIES.length)
    const ids = new Set(shown.flatMap((s) => s.variants))
    expect(CATALOG.filter((id) => !(id in NOT_MONSTERS) && !ids.has(id))).toEqual([])
  })
})
