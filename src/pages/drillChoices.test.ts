import { describe, expect, it } from 'vitest'
import { ALL_CHIPS } from '@/shared/types'
import { PHONE_CHOICES, propertyChoices } from './drillChoices'

describe('the drill’s four choices on a phone', () => {
  it('always holds the right property and three different others', () => {
    for (const right of ALL_CHIPS) {
      for (const id of ['q1', 'q2', 'q3', 'q-long-id-42']) {
        const choices = propertyChoices(id, right)
        expect(choices).toHaveLength(PHONE_CHOICES)
        expect(new Set(choices).size).toBe(PHONE_CHOICES)
        expect(choices).toContain(right)
        for (const c of choices) expect(ALL_CHIPS).toContain(c)
      }
    }
  })

  it('keeps the same order for the same question, so a re-render never reshuffles', () => {
    expect(propertyChoices('item-7', 'distribute')).toEqual(propertyChoices('item-7', 'distribute'))
  })

  it('takes two of the others from the moves easiest to mix up with the right one', () => {
    const choices = propertyChoices('item-3', 'add_sub')
    const sameFamily = choices.filter((c) => ['mul_div', 'power_both', 'root_both'].includes(c))
    expect(sameFamily).toHaveLength(2)
    // A family of two (commutative, associative) gives one near miss; the rest come from elsewhere.
    expect(propertyChoices('item-5', 'commutative')).toContain('associative')
  })

  it('does not always put the right property in the same place', () => {
    const places = new Set(Array.from({ length: 20 }, (_, i) => propertyChoices(`q${i}`, 'factor').indexOf('factor')))
    expect(places.size).toBeGreaterThan(1)
  })
})
