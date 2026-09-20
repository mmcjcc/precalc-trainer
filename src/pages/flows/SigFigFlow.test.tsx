// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem } from '@/content'
import { resetStoreForTests, useStore } from '@/store'
import { problemPath } from '@/problem/url'
import ProblemPage from '../Problem'

// function-plot needs a real SVG layout engine; the inequality comparison only needs the panel to exist.
vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

const TEMPLATES = ['sf.count', 'sf.round', 'sf.muldiv', 'sf.addsub', 'sf.mixed', 'sf.sci'] as const
const SEED = 7

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

function sigFigAnswer(templateId: string, seed = SEED) {
  const inst = generateProblem('sigFigs', templateId, seed, {})
  const answer = inst.answer
  if (answer.type !== 'sigFigs') throw new Error('expected a sigFigs answer')
  return { inst, answer }
}

function type(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
const finals = () => events('final_answer') as Extract<ReturnType<typeof events>[number], { t: 'final_answer' }>[]
const doneEvent = () => events('problem_done')[0] as Extract<ReturnType<typeof events>[number], { t: 'problem_done' }> | undefined
const digit = (re: RegExp) => screen.getByRole('button', { name: re })

beforeEach(() => {
  resetStoreForTests()
})

describe('SigFigFlow: every template renders', () => {
  it.each(TEMPLATES)('%s at seed 7 shows the context, the prompt and the answer card, with no graph or calculator', (templateId) => {
    const { answer } = sigFigAnswer(templateId)
    const view = renderAt(problemPath('sigFigs', templateId, SEED))
    expect(screen.getByText(answer.context)).toBeTruthy()
    expect(screen.getByText(answer.prompt)).toBeTruthy()
    expect(screen.getByRole('heading', { name: templateId === 'sf.count' ? 'Mark the significant digits' : 'Final answer' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Hints' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Rule cards' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Graph it' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Calculator' })).toBeNull()
    expect(screen.queryByText(/Show the graph|Show calculator steps/)).toBeNull()
    // Every input keeps zeros: never type="number".
    for (const el of document.querySelectorAll('input')) expect(el.type).not.toBe('number')
    view.unmount()
  })

  it('leaves the graph and calculator shortcuts out of the cheat-sheet, while an inequality keeps both panels', () => {
    const view = renderAt(problemPath('sigFigs', 'sf.muldiv', SEED))
    click('shortcuts (?)')
    const sheet = screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
    expect(within(sheet).getByText('Next hint rung')).toBeTruthy()
    expect(within(sheet).queryByText('Graph panel')).toBeNull()
    expect(within(sheet).queryByText('Calculator panel')).toBeNull()
    view.unmount()

    resetStoreForTests() // otherwise the unfinished sig-fig attempt asks to leave (window.confirm)
    renderAt(problemPath('inequalities', 'ineq.linear', 12345))
    expect(screen.getByRole('heading', { name: 'Graph it' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Calculator' })).toBeTruthy()
    click('shortcuts (?)')
    const sheet2 = screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
    expect(within(sheet2).getByText('Graph panel')).toBeTruthy()
    expect(within(sheet2).getByText('Calculator panel')).toBeTruthy()
  })
})

describe('SigFigFlow: typed numeral answers', () => {
  it('a wrong then right answer records both, names the mistake, and finishes', () => {
    const { answer } = sigFigAnswer('sf.muldiv') // 67.92 g ÷ 9.7 mL → 7.0
    expect(answer.expected).toBe('7.0')
    renderAt(problemPath('sigFigs', 'sf.muldiv', SEED))
    expect(screen.getByText(/stage 0 of 1 · give the answer/)).toBeTruthy()

    type('Your answer', '7')
    expect(screen.getByText('reads as 7 — 1 significant figure')).toBeTruthy()
    click('Check answer')
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Keep the zero that shows your precision')
    expect(alert.textContent).toContain('Example:')
    expect(finals()).toMatchObject([{ correct: false, pattern: 'sf_dropped_zero', via: 'text' }])
    expect(useStore.getState().attempt?.final?.sfText).toBe('7')

    // Re-checking the same wrong entry is not a second try.
    click('Check answer')
    expect(finals()).toHaveLength(1)

    // After a named mistake, rung 2 shows that lesson as the rule card.
    click('Nudge me')
    expect(screen.getByText(answer.nudge)).toBeTruthy()
    click('Show the rule')
    const hints = screen.getByRole('heading', { name: 'Hints' }).closest('section')!
    expect(within(hints).getByText('Keep the zero that shows your precision')).toBeTruthy()
    expect(within(hints).getByText(/Dropping it says the answer is less precise/)).toBeTruthy()

    type('Your answer', '7.0')
    expect(screen.getByText('reads as 7.0 — 2 significant figures')).toBeTruthy()
    click('Check answer')
    expect(finals()).toMatchObject([{ correct: false }, { correct: true }])
    expect(doneEvent()).toMatchObject({ finalCorrect: false, firstTryRate: 0, revealed: 0 })
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    // The full worked explanation appears once she is right.
    for (const line of answer.reveal) expect(screen.getByText(line)).toBeTruthy()
    expect((screen.getByLabelText('Your answer') as HTMLInputElement).disabled).toBe(true)
  })

  it('a right first answer completes with first-try credit and nothing revealed', () => {
    renderAt(problemPath('sigFigs', 'sf.addsub', SEED)) // 5.443 + 72.2 + 51.33 → 129.0
    type('Your answer', '129.0')
    click('Check answer')
    expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    expect(finals()).toMatchObject([{ correct: true }])
    expect(doneEvent()).toMatchObject({ finalCorrect: true, firstTryRate: 1, revealed: 0, hints: 0 })
    expect(useStore.getState().attempt).toBeNull()
  })

  it('accepts the answer through the power-of-ten box and the ± button', () => {
    const { answer } = sigFigAnswer('sf.sci') // 0.0754 L → 7.54 x 10^-2
    expect(answer.expected).toBe('7.54 x 10^-2')
    renderAt(problemPath('sigFigs', 'sf.sci', SEED))
    type('Your answer', '7.54')
    type('Power of ten', '2')
    expect(screen.getByText('reads as 7.54 × 10² — 3 significant figures')).toBeTruthy()
    click('Flip the sign of the power of ten')
    expect((screen.getByLabelText('Power of ten') as HTMLInputElement).value).toBe('-2')
    expect(screen.getByText('reads as 7.54 × 10⁻² — 3 significant figures')).toBeTruthy()
    click('Check answer')
    expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
  })

  it('a parse error points at the character and is not recorded as an answer', () => {
    renderAt(problemPath('sigFigs', 'sf.muldiv', SEED))
    type('Your answer', '7.0 g')
    expect(screen.getByText(/not readable yet \(character 5\)/)).toBeTruthy()
    click('Check answer')
    expect(screen.getByRole('alert').textContent).toMatch(/^Check character 5: /)
    expect(finals()).toHaveLength(0)
    expect(screen.queryByRole('heading', { name: /Problem/ })).toBeNull()
  })

  it('a plain wrong value gets the specific message and no pattern', () => {
    renderAt(problemPath('sigFigs', 'sf.muldiv', SEED))
    type('Your answer', '3.0')
    click('Check answer')
    expect(screen.getByRole('alert').textContent).toContain('recheck the arithmetic')
    expect(finals()).toMatchObject([{ correct: false }])
    expect(finals()[0]!.pattern).toBeUndefined()
  })
})

describe('SigFigFlow: tap the digits', () => {
  it('grades per digit, names the rule under each wrong one, and completes once the marks are right', () => {
    const { answer } = sigFigAnswer('sf.count') // 0.0754 L → 3
    expect(answer.task).toEqual({ kind: 'count', text: '0.0754' })
    renderAt(problemPath('sigFigs', 'sf.count', SEED))
    expect(screen.getByText(/mark the significant digits/)).toBeTruthy()
    const buttons = screen.getAllByRole('button', { name: /^digit / })
    expect(buttons).toHaveLength(5)
    for (const b of buttons) expect(b.getAttribute('aria-pressed')).toBe('false')

    for (const b of buttons) fireEvent.click(b)
    expect(screen.getByText((_, el) => el?.tagName === 'P' && /^You marked 5 digits as significant/.test(el.textContent ?? ''))).toBeTruthy()
    expect(useStore.getState().attempt?.final?.sfTaps).toEqual([0, 2, 3, 4, 5])

    click('Check')
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Leading zeros never count')
    const list = screen.getByRole('list', { name: 'Digits to look at again' })
    expect(within(list).getAllByText(/Leading zeros only place the decimal point/)).toHaveLength(2)
    expect(within(list).getByText(/The 0 in the ones place/)).toBeTruthy()
    expect(finals()).toMatchObject([{ correct: false, pattern: 'sf_leading_zeros', via: 'builder' }])

    fireEvent.click(digit(/^digit 0, ones place/))
    fireEvent.click(digit(/^digit 0, tenths place/))
    expect(screen.queryByRole('alert')).toBeNull()
    click('Check')
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(finals()).toMatchObject([{ correct: false }, { correct: true }])
    expect(screen.getByText('Total: 3 significant figures (7, 5, 4).')).toBeTruthy()
    for (const b of screen.getAllByRole('button', { name: /^digit / })) expect((b as HTMLButtonElement).disabled).toBe(true)
  })

  it('the digits are keyboard operable and the power of ten is shown but not tappable', () => {
    const inst = generateProblem('sigFigs', 'sf.count', SEED, { sciNotation: true })
    const answer = inst.answer
    if (answer.type !== 'sigFigs' || answer.task.kind !== 'count') throw new Error('expected a count task')
    expect(answer.task.text).toMatch(/x 10\^/)
    renderAt(problemPath('sigFigs', 'sf.count', SEED, 's'))
    const buttons = screen.getAllByRole('button', { name: /^digit / })
    expect(buttons.length).toBeGreaterThan(0)
    expect(screen.getByText(/The power of ten is not a digit/)).toBeTruthy()
    const first = buttons[0]!
    first.focus()
    fireEvent.click(first) // Enter/Space on a focused <button> dispatches click in every browser
    expect(first.getAttribute('aria-pressed')).toBe('true')
  })
})

describe('SigFigFlow: mixed operations', () => {
  it('asks how precise the intermediate is, then the final answer', () => {
    const { answer } = sigFigAnswer('sf.mixed') // (24.62 − 12.47) ÷ 6.2 → intermediate 4 figures, answer 2.0
    expect(answer.expected).toBe('2.0')
    renderAt(problemPath('sigFigs', 'sf.mixed', SEED))
    expect(screen.getByText(/stage 0 of 2/)).toBeTruthy()
    expect(screen.queryByLabelText('Your answer')).toBeNull()

    type('Significant figures it carries into the next step', 'four')
    click('Check')
    expect(screen.getByRole('alert').textContent).toContain('whole number')
    expect(finals()).toHaveLength(0)

    type('Significant figures it carries into the next step', '2')
    click('Check')
    expect(screen.getByRole('alert').textContent).toContain('Not quite')
    expect(finals()).toMatchObject([{ correct: false }])

    type('Significant figures it carries into the next step', '4')
    click('Check')
    expect(finals()).toMatchObject([{ correct: false }, { correct: true }])
    expect(useStore.getState().attempt?.final?.sfIntermediateDone).toBe(1)
    expect(screen.getByText(/stage 1 of 2/)).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Intermediate results' }).textContent).toContain('carries 4 significant figures')

    type('Your answer', '2.0')
    click('Check answer')
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(doneEvent()).toMatchObject({ finalCorrect: false })
  })
})

describe('SigFigFlow: hints', () => {
  it('nudge, rule card, then the explanation, which is flagged as a reveal', () => {
    const { answer } = sigFigAnswer('sf.round') // 0.075443 m to 3 → 0.0754
    renderAt(problemPath('sigFigs', 'sf.round', SEED))
    click('Nudge me')
    expect(screen.getByText(answer.nudge)).toBeTruthy()
    click('Show the rule')
    expect(screen.getByText('Rule')).toBeTruthy()
    expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()
    click(/^Explain the answer/)
    expect(screen.getByRole('button', { name: 'All hints shown' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'All hints shown' }) as HTMLButtonElement).disabled).toBe(true)
    for (const line of answer.reveal) expect(screen.getByText(line)).toBeTruthy()
    expect(useStore.getState().attempt?.final).toMatchObject({ revealed: true, firstCorrect: false })
    expect(events('hint')).toHaveLength(3)

    type('Your answer', '0.0754')
    click('Check answer')
    expect(doneEvent()).toMatchObject({ finalCorrect: true, revealed: 1, firstTryRate: 0, hints: 3 })
    expect(screen.getByText(/1 shown/)).toBeTruthy()
  })
})

describe('SigFigFlow: resume after a reload', () => {
  it('restores the typed coefficient and power of ten', () => {
    const view = renderAt(problemPath('sigFigs', 'sf.sci', SEED))
    type('Your answer', '7.54')
    type('Power of ten', '-2')
    view.unmount() // leaving the page flushes the pending save
    expect(useStore.getState().attempt?.final).toMatchObject({ sfText: '7.54', sfPower: '-2' })
    renderAt(problemPath('sigFigs', 'sf.sci', SEED))
    expect((screen.getByLabelText('Your answer') as HTMLInputElement).value).toBe('7.54')
    expect((screen.getByLabelText('Power of ten') as HTMLInputElement).value).toBe('-2')
    click('Check answer')
    expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
  })

  it('restores the tapped digits', () => {
    const view = renderAt(problemPath('sigFigs', 'sf.count', SEED))
    fireEvent.click(digit(/^digit 7/))
    fireEvent.click(digit(/^digit 5/))
    view.unmount()
    renderAt(problemPath('sigFigs', 'sf.count', SEED))
    const pressed = screen.getAllByRole('button', { name: /^digit / }).filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressed.map((b) => b.textContent)).toEqual(['7', '5'])
    expect(screen.getByText((_, el) => el?.tagName === 'P' && /^You marked 2 digits/.test(el.textContent ?? ''))).toBeTruthy()
  })

  it('restores a mixed problem at the final-answer stage', () => {
    const view = renderAt(problemPath('sigFigs', 'sf.mixed', SEED))
    type('Significant figures it carries into the next step', '4')
    click('Check')
    view.unmount()
    renderAt(problemPath('sigFigs', 'sf.mixed', SEED))
    expect(screen.getByText(/stage 1 of 2/)).toBeTruthy()
    expect(screen.getByLabelText('Your answer')).toBeTruthy()
    expect(screen.queryByLabelText('Significant figures it carries into the next step')).toBeNull()
  })
})
