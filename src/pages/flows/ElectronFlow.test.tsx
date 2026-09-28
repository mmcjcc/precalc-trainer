// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem } from '@/content'
import type { AnswerSpec, ElectronsOrderQuestion } from '@/content/types'
import { resetStoreForTests, useStore } from '@/store'
import { problemPath } from '@/problem/url'
import ProblemPage from '../Problem'

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
        <Route path="/" element={<p>home page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

type ElectronsAnswer = Extract<AnswerSpec, { type: 'electrons' }>

function findAnswer(templateId: string, pred: (a: ElectronsAnswer) => boolean): { seed: number; a: ElectronsAnswer } {
  for (let seed = 1; seed <= 300; seed++) {
    const p = generateProblem('electrons', templateId, seed)
    if (p.answer.type === 'electrons' && pred(p.answer)) return { seed, a: p.answer }
  }
  throw new Error(`no ${templateId} seed`)
}

function findOrder(): { seed: number; q: ElectronsOrderQuestion; prompt: string; reveal: string[] } {
  const p = generateProblem('electrons', 'light.spectrum', 1)
  if (p.answer.type !== 'electrons' || p.answer.question.kind !== 'order') throw new Error('expected an ordering problem')
  return { seed: 1, q: p.answer.question, prompt: p.answer.prompt, reveal: p.answer.reveal }
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function click(name: string | RegExp) {
  const exact = typeof name === 'string' ? new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) : name
  fireEvent.click(screen.getByRole('button', { name: exact }))
}

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
const finals = () => events('final_answer') as Extract<ReturnType<typeof events>[number], { t: 'final_answer' }>[]
const doneEvent = () => events('problem_done')[0] as Extract<ReturnType<typeof events>[number], { t: 'problem_done' }> | undefined

beforeEach(() => {
  resetStoreForTests()
})

describe('ElectronFlow: a light calculation', () => {
  const laser = findAnswer('light.freq', (a) => a.context.includes('Orange light has a wavelength of 620 nm') && a.question.kind === 'light' && a.question.wavelengthText === '620')

  it('shows the context, the wavelength large, the constants, and no graph or calculator', () => {
    renderAt(problemPath('electrons', 'light.freq', laser.seed))
    expect(screen.getByText(laser.a.question.kind === 'light' ? laser.a.question.given.display : '')).toBeTruthy()
    expect(screen.getByText(/Orange light has a wavelength of 620 nm/)).toBeTruthy()
    const given = screen.getByRole('group', { name: 'Given' })
    expect(given.querySelector('span')?.className).toContain('text-3xl')
    expect(given.textContent).toContain('620')
    expect(given.textContent).toContain('nm')
    const constants = screen.getByRole('complementary', { name: 'Constants' })
    expect(constants.textContent).toContain('3 significant figures')
    expect(constants.textContent).toContain('4 significant figures')
    expect(constants.textContent).toMatch(/1 nm = 10⁻⁹ m/)
    expect(constants.textContent).toContain('exact')
    expect(screen.getByRole('heading', { name: 'Final answer' })).toBeTruthy()
    expect(screen.getByText('Hz')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Graph it' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Calculator' })).toBeNull()
    for (const el of document.querySelectorAll('input')) expect(el.type).not.toBe('number')
  })

  it('names the nanometer slip, then accepts the fix, and records both', () => {
    renderAt(problemPath('electrons', 'light.freq', laser.seed))
    type('Your answer', '4.8')
    type('Power of ten', '5')
    expect(screen.getByText(/reads as 4\.8 × 10⁵/)).toBeTruthy()
    click('Check answer')
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Convert nanometers to meters first')
    expect(alert.textContent).toContain('620 nm')
    expect(alert.textContent).toContain('Example:')
    expect(finals()).toMatchObject([{ correct: false, pattern: 'lt_no_conversion', via: 'text' }])

    click('Check answer')
    expect(finals()).toHaveLength(1)

    click('Nudge me')
    expect(screen.getByText(/Change nanometers into meters/)).toBeTruthy()
    click('Show the rule')
    const hints = screen.getByRole('heading', { name: 'Hints' }).closest('section')!
    expect(within(hints).getByText('Convert nanometers to meters first')).toBeTruthy()

    type('Your answer', '4.8')
    type('Power of ten', '14')
    click('Check answer')
    expect(finals()).toMatchObject([{ correct: false }, { correct: true }])
    expect(doneEvent()).toMatchObject({ finalCorrect: false, firstTryRate: 0, revealed: 0 })
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    for (const line of laser.a.reveal) expect(screen.getByText(line)).toBeTruthy()
    expect((screen.getByLabelText('Your answer') as HTMLInputElement).disabled).toBe(true)
  })

  it('restores the coefficient and power of ten after a reload', () => {
    const view = renderAt(problemPath('electrons', 'light.freq', laser.seed))
    type('Your answer', '4.8')
    type('Power of ten', '14')
    view.unmount()
    expect(useStore.getState().attempt?.final).toMatchObject({ sfText: '4.8', sfPower: '14' })
    renderAt(problemPath('electrons', 'light.freq', laser.seed))
    expect((screen.getByLabelText('Your answer') as HTMLInputElement).value).toBe('4.8')
    expect((screen.getByLabelText('Power of ten') as HTMLInputElement).value).toBe('14')
    click('Check answer')
    expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
  })
})

describe('ElectronFlow: ordering', () => {
  const order = findOrder()
  const label = (id: string) => order.q.items.find((item) => item.id === id)!.label

  it('taps in reverse, names it, then the right order finishes; undo works from the button and the keyboard', () => {
    renderAt(problemPath('electrons', 'light.spectrum', order.seed))
    expect(screen.getByText(order.prompt)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Graph it' })).toBeNull()
    const buttons = order.q.items.map((item) => screen.getByRole('button', { name: item.label }))
    for (const button of buttons) {
      expect(button.className).toContain('min-h-11')
      expect(button.className).toContain('min-w-11')
    }

    click(label(order.q.order[0]!))
    click(label(order.q.order[1]!))
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    const placed = () => within(screen.getByRole('list', { name: 'Your order' })).getAllByRole('listitem').map((li) => li.textContent)
    expect(placed()).toEqual([`1. ${label(order.q.order[0]!)}`])
    click('Undo')
    expect(screen.getByText('Nothing tapped yet.')).toBeTruthy()

    for (const id of [...order.q.order].reverse()) click(label(id))
    click('Check order')
    expect(screen.getByRole('alert').textContent).toContain('That ranking runs the other way')
    expect(finals()).toMatchObject([{ correct: false, pattern: 'lt_order_reversed', via: 'text' }])

    for (let i = 0; i < order.q.order.length; i++) click('Undo')
    for (const id of order.q.order) click(label(id))
    click('Check order')
    expect(finals()).toMatchObject([{ correct: false }, { correct: true }])
    expect(doneEvent()).toMatchObject({ finalCorrect: false, revealed: 0 })
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    for (const line of order.reveal) expect(screen.getByText(line)).toBeTruthy()
  }, 20_000)

  it('restores the tapped order after a reload', () => {
    const view = renderAt(problemPath('electrons', 'light.spectrum', order.seed))
    const first = label(order.q.items[0]!.id)
    const second = label(order.q.items[1]!.id)
    click(first)
    click(second)
    view.unmount()
    expect(useStore.getState().attempt?.final?.ltOrder).toEqual([order.q.items[0]!.id, order.q.items[1]!.id])
    renderAt(problemPath('electrons', 'light.spectrum', order.seed))
    const list = screen.getByRole('list', { name: 'Your order' })
    expect(list.textContent).toContain(first)
    expect(list.textContent).toContain(second)
    expect(screen.queryByRole('button', { name: first })).toBeNull()
  })
})
