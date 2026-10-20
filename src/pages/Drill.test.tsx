// @vitest-environment jsdom
/** The properties drill: four big choices on a phone, all fourteen chips on a wide screen. */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { generateDrill } from '@/content'
import { installPointer, removePointer } from '@/components/keypadTesting'
import { ALL_CHIPS } from '@/shared/types'
import { resetStoreForTests } from '@/store'
import { Drill, drillTex } from './Drill'

// The drill draws a random set: pin its seed to one whose first question asks which property, so the tests never
// depend on the luck of the draw (a set of ten can be all legal-or-illegal questions).
const drawn = vi.hoisted(() => ({ seed: 1 }))
vi.mock('@/content', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/content')>()
  return { ...real, randomSeed: () => drawn.seed }
})

beforeAll(() => {
  for (let seed = 1; seed < 1000; seed++) {
    if (generateDrill(seed, 10)[0]?.question === 'which_property') {
      drawn.seed = seed
      return
    }
  }
  throw new Error('no drill set starts with a which-property question')
})

afterEach(() => {
  removePointer()
  resetStoreForTests()
})

/** The first question is a which-property one (the pinned seed): its group of choices. */
function reachPropertyQuestion(): HTMLElement {
  return screen.getByRole('group', { name: 'Properties' })
}

function renderDrill() {
  render(
    <MemoryRouter>
      <Drill />
    </MemoryRouter>,
  )
}

describe('Properties drill', () => {
  it('on a phone: four full-width choices, one of them right, and the answer is marked', { timeout: 120_000 }, () => {
    installPointer(true)
    renderDrill()
    const group = reachPropertyQuestion()
    const buttons = within(group).getAllByRole('button')
    expect(buttons).toHaveLength(4)
    for (const b of buttons) expect(b.className).toContain('w-full')
    fireEvent.click(buttons[0]!)
    expect(within(group).getAllByText('correct answer:')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /^(Next|See the set score)$/ })).toBeTruthy()
  })

  it('on a wide screen: all fourteen chips, as before', { timeout: 120_000 }, () => {
    renderDrill()
    const group = reachPropertyQuestion()
    expect(within(group).getAllByRole('button')).toHaveLength(ALL_CHIPS.length)
  })
})

describe('the drill’s lines', () => {
  it('keep their brackets when order or grouping is the question', () => {
    expect(drillTex({ chip: 'associative' }, '(1 + x) + 8')).toBe('(1 + x) + 8')
    expect(drillTex({ chip: 'associative' }, '1 + (x + 8)')).toBe('1 + (x + 8)')
    expect(drillTex({ chip: 'commutative' }, '(x + 1) + 8')).toBe('(x + 1) + 8')
    // Elsewhere the usual printer, which drops brackets that change nothing.
    expect(drillTex({ chip: 'distribute' }, '(1 + x) + 8')).not.toContain('(')
  })
})
