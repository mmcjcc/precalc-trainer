// @vitest-environment jsdom
/** The properties drill: four big choices on a phone, all fourteen chips on a wide screen. */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { installPointer, removePointer } from '@/components/keypadTesting'
import { ALL_CHIPS } from '@/shared/types'
import { resetStoreForTests } from '@/store'
import { Drill } from './Drill'

afterEach(() => {
  removePointer()
  resetStoreForTests()
})

/** Answer legal-or-illegal questions until a which-property one comes up, and return its group of choices. */
function reachPropertyQuestion(): HTMLElement {
  for (let i = 0; i < 10; i++) {
    const group = screen.queryByRole('group', { name: 'Properties' })
    if (group) return group
    fireEvent.click(screen.getByRole('button', { name: 'Legal' }))
    fireEvent.click(screen.getByRole('button', { name: /^(Next|See the set score)$/ }))
    if (screen.queryByRole('button', { name: '10 more' })) fireEvent.click(screen.getByRole('button', { name: '10 more' }))
  }
  throw new Error('no which-property question in ten tries')
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
