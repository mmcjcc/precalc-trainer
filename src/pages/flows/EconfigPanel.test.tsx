// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem } from '@/content'
import type { AnswerSpec, ElectronsEconfigQuestion } from '@/content/types'
import { configurationMistakes, configurationText, orbitalDiagram, orbitalDiagramText, unpairedElectrons } from '@/engine'
import type { Spin } from '@/engine'
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

function findEconfig(templateId: string, pred: (a: ElectronsAnswer, q: ElectronsEconfigQuestion) => boolean): { seed: number; a: ElectronsAnswer; q: ElectronsEconfigQuestion } {
  for (let seed = 1; seed <= 300; seed++) {
    const p = generateProblem('electrons', templateId, seed)
    if (p.answer.type !== 'electrons' || p.answer.question.kind !== 'econfig') continue
    if (pred(p.answer, p.answer.question)) return { seed, a: p.answer, q: p.answer.question }
  }
  throw new Error(`no ${templateId} seed`)
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

describe('ElectronFlow: a configuration', () => {
  const hit = findEconfig('ec.shorthand', (a, q) => {
    const cands = configurationMistakes(q.species, q.form ?? 'shorthand')
    return Boolean(cands?.some((c) => c.kind === 'filling_order')) && a.trap === 'filling_order'
  })
  const wrong = configurationMistakes(hit.q.species, hit.q.form ?? 'shorthand')!.find((c) => c.kind === 'filling_order')!
  const right = configurationText(hit.q.species, { form: hit.q.form ?? 'shorthand' })

  it('names the filling-order slip, then accepts the fix, and records both', () => {
    renderAt(problemPath('electrons', 'ec.shorthand', hit.seed))
    expect(screen.getByText(hit.a.prompt)).toBeTruthy()
    expect(screen.getByLabelText(hit.q.display)).toBeTruthy()
    expect(screen.getByLabelText(hit.q.display).closest('div')?.className).toContain('text-4xl')
    expect(screen.getByRole('heading', { name: 'Final answer' })).toBeTruthy()
    expect(screen.queryByRole('complementary', { name: 'Constants' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Graph it' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Calculator' })).toBeNull()
    for (const el of document.querySelectorAll('input')) expect(el.type).not.toBe('number')

    type('Your configuration', '1s2')
    expect(screen.getByText(/reads as/).textContent).toContain('1s²')
    click('s subshell')
    expect((screen.getByLabelText('Your configuration') as HTMLInputElement).value).toContain('s')

    type('Your configuration', wrong.text)
    click('Check answer')
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Subshells fill in a fixed order')
    expect(alert.textContent).toContain(wrong.witness)
    expect(alert.textContent).toContain('Example:')
    expect(finals()).toMatchObject([{ correct: false, pattern: 'ec_filling_order', via: 'text' }])

    click('Check answer')
    expect(finals()).toHaveLength(1)

    click('Nudge me')
    expect(screen.getByText(hit.a.nudge)).toBeTruthy()
    click('Show the rule')
    const hints = screen.getByRole('heading', { name: 'Hints' }).closest('section')!
    expect(within(hints).getByText('Subshells fill in a fixed order')).toBeTruthy()

    type('Your configuration', right)
    click('Check answer')
    expect(finals()).toMatchObject([{ correct: false, pattern: 'ec_filling_order' }, { correct: true }])
    expect(doneEvent()).toMatchObject({ finalCorrect: false, firstTryRate: 0, revealed: 0 })
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    for (const line of hit.a.reveal) expect(screen.getByText(line)).toBeTruthy()
    expect((screen.getByLabelText('Your configuration') as HTMLInputElement).disabled).toBe(true)
  }, 60_000)

  it('an unreadable configuration records no wrong attempt', () => {
    renderAt(problemPath('electrons', 'ec.full', hit.seed))
    type('Your configuration', '1s2 2s')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText(/Write how many electrons are in 2s/)).toBeTruthy()
    click('Check answer')
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('This doesn’t count as an attempt')
    expect(alert.textContent).toContain('Write how many electrons are in 2s')
    expect(finals()).toEqual([])
    expect(doneEvent()).toBeUndefined()
  })

  it('restores her configuration after a reload', () => {
    const view = renderAt(problemPath('electrons', 'ec.shorthand', hit.seed))
    type('Your configuration', right)
    view.unmount()
    expect(useStore.getState().attempt?.final).toMatchObject({ ecText: right })
    renderAt(problemPath('electrons', 'ec.shorthand', hit.seed))
    expect((screen.getByLabelText('Your configuration') as HTMLInputElement).value).toBe(right)
    click('Check answer')
    expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    expect(doneEvent()).toMatchObject({ finalCorrect: true, firstTryRate: 1 })
  })
})

describe('ElectronFlow: an orbital diagram', () => {
  const hit = findEconfig('ec.diagram', (_a, q) => Boolean(q.subshell))
  const info = orbitalDiagram(hit.q.species, hit.q.subshell)

  function box(n: number) {
    return screen.getByRole('button', { name: new RegExp(`^Box ${n},`) })
  }

  it('lets a box hold two up arrows, names the Pauli slip, then accepts the fixed diagram', () => {
    renderAt(problemPath('electrons', 'ec.diagram', hit.seed))
    expect(screen.getByRole('group', { name: 'Orbital diagram' })).toBeTruthy()
    expect(screen.getByText(hit.a.prompt)).toBeTruthy()
    expect(screen.queryByRole('complementary', { name: 'Constants' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Calculator' })).toBeNull()
    for (const el of document.querySelectorAll('input')) expect(el.type).not.toBe('number')

    const controls = [box(1), screen.getByRole('button', { name: 'Up arrow' }), screen.getByRole('button', { name: 'Down arrow' }), screen.getByRole('button', { name: 'Clear box' })]
    for (const button of controls) {
      expect(button.className).toContain('min-h-11')
      expect(button.className).toContain('min-w-11')
    }

    fireEvent.keyDown(box(1), { key: 'ArrowUp' })
    fireEvent.keyDown(box(1), { key: 'ArrowUp' })
    expect(box(1).getAttribute('aria-label')).toBe('Box 1, up up')
    expect(box(1).textContent).toContain('↑↑')

    type('Unpaired electrons', '0')
    click('Check answer')
    expect(finals().some((f) => f.correct === false && f.pattern === 'ec_pauli_broken')).toBe(true)
    const alerts = screen.getAllByRole('alert').map((el) => el.textContent ?? '')
    expect(alerts.some((text) => text.includes('Two arrows in one box point the same way'))).toBe(true)

    click('Clear box')
    for (let i = 0; i < info.boxes.length; i++) {
      fireEvent.click(box(i + 1))
      for (const spin of info.boxes[i]!) click(spin === 'up' ? 'Up arrow' : 'Down arrow')
    }
    type('Unpaired electrons', String(unpairedElectrons(hit.q.species)))
    click('Check answer')
    expect(finals().at(-1)).toMatchObject({ correct: true })
    expect(doneEvent()).toMatchObject({ finalCorrect: false })
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
  }, 60_000)

  it('restores the diagram after a reload, including a two-up box', () => {
    const view = renderAt(problemPath('electrons', 'ec.diagram', hit.seed))
    click('Up arrow')
    click('Up arrow')
    const stored = boxesOf(info.orbitals, 0, ['up', 'up'])
    expect(useStore.getState().attempt?.final?.ecDiagram).toBe(orbitalDiagramText(stored))
    view.unmount()
    renderAt(problemPath('electrons', 'ec.diagram', hit.seed))
    expect(box(1).getAttribute('aria-label')).toBe('Box 1, up up')
    expect(box(1).textContent).toContain('↑↑')
  })
})

function boxesOf(orbitals: number, index: number, spins: Spin[]): Spin[][] {
  return Array.from({ length: orbitals }, (_, i) => (i === index ? [...spins] : []))
}
