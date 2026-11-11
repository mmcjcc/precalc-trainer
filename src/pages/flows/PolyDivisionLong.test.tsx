// @vitest-environment jsdom
/**
 * Long division on the problem screen (PolyDivisionFlow, question `long`): worksheet problem 5 worked
 * the way she started it on paper, then put right, one checked part at a time. The graders are the
 * engine's (engine/polynomials/long.test.ts); this is what the screen shows and records.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '../Problem'

const FLOW_TIMEOUT = 120_000
const NOT_AN_ATTEMPT = 'This doesn’t count as an attempt'

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

function type(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
const part = (n: number, title: string) => screen.queryByRole('heading', { name: `Part ${n} of 5: ${title}` })

beforeEach(() => {
  resetStoreForTests()
})

describe('PolyDivisionFlow: long division (ld.worksheet, problem 5)', () => {
  // Seed 4 is the first of the four again: (x^3 + 3x^2 + 2x - 5)/(x^2 + 1).
  const SEED = 4
  const path = problemPath('polyDivision', 'ld.worksheet', SEED)

  it('is the worksheet problem, and shows nothing of a part she has not reached', { timeout: FLOW_TIMEOUT }, () => {
    const p = generateProblem('polyDivision', 'ld.worksheet', SEED)
    expect(p.statementText).toBe('(x^3 + 3x^2 + 2x - 5)/(x^2 + 1)')
    renderAt(path)
    expect(screen.getByText('Divide with long division, one round at a time. Then give the quotient and the remainder.')).toBeTruthy()
    expect(part(1, 'Divide, then multiply')).toBeTruthy()
    expect(part(2, 'Subtract')).toBeNull()
    expect(screen.queryByLabelText('What is left')).toBeNull()
    expect(screen.queryByLabelText('Quotient')).toBeNull()
    expect(document.querySelector('[data-ld-layout]')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Synthetic division table' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Calculator' })).toBeNull()
  })

  it(
    'her paper start is answered step by step: the wrong first term, then the subtraction, through to the quotient and remainder',
    { timeout: FLOW_TIMEOUT },
    () => {
      renderAt(path)

      // An empty step is not an attempt.
      click('Check this step')
      expect(screen.getByText(NOT_AN_ATTEMPT, { exact: false })).toBeTruthy()
      expect(events('final_answer')).toHaveLength(0)

      // What she wrote on top of her page: 1. Only the term is judged; the product waits for it.
      type('First term of the quotient', '1')
      type('That term times the divisor', 'x^2 + 1')
      click('Check this step')
      let alert = screen.getByRole('alert')
      expect(alert.textContent).toContain('Look only at the leading terms')
      expect(alert.textContent).not.toContain('Multiply x by each term')
      expect(part(2, 'Subtract')).toBeNull()
      expect(events('final_answer')).toHaveLength(1)

      // The right term with only the first term of the divisor multiplied.
      type('First term of the quotient', 'x')
      type('That term times the divisor', 'x^3')
      click('Check this step')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain('first term of the divisor only')

      type('That term times the divisor', 'x^3 + x')
      click('Check this step')
      expect(part(2, 'Subtract')).toBeTruthy()
      expect(screen.getByText('The term and its product are right.')).toBeTruthy()
      // The subtraction is laid out with the empty column of x^2 + 1.
      const layout = document.querySelector('[data-ld-layout]')
      expect(layout).toBeTruthy()
      expect(layout!.querySelector('[aria-label]')?.getAttribute('aria-label') ?? layout!.textContent).toContain('like terms lined up')

      // The line on her page: unlike terms subtracted.
      type('What is left', '2x^2 + 2x - 5')
      click('Check the subtraction')
      expect(screen.getByRole('alert').textContent).toContain('skips a power')
      expect(part(3, 'Divide, then multiply again')).toBeNull()

      type('What is left', '3x^2 + x - 5')
      click('Check the subtraction')
      expect(part(3, 'Divide, then multiply again')).toBeTruthy()
      expect(screen.getByText(/What is left is 3x\^2 \+ x − 5\./)).toBeTruthy()

      type('Next term of the quotient', '3')
      const products = screen.getAllByLabelText('That term times the divisor') as HTMLInputElement[]
      expect(products[0]!.disabled).toBe(true)
      fireEvent.change(products[1]!, { target: { value: '3x^2 + 3' } })
      click('Check this step')
      expect(part(4, 'Subtract again')).toBeTruthy()

      const lefts = screen.getAllByLabelText('What is left') as HTMLInputElement[]
      // The minus sign not carried to the 3: -5 + 3.
      fireEvent.change(lefts[1]!, { target: { value: 'x - 2' } })
      click('Check the subtraction')
      expect(screen.getByRole('alert').textContent).toContain('minus sign belongs to every term')
      fireEvent.change(lefts[1]!, { target: { value: 'x - 8' } })
      click('Check the subtraction')
      expect(part(5, 'Quotient and remainder')).toBeTruthy()
      expect(events('problem_done')).toHaveLength(0)

      // The two answers swapped, then right.
      type('Quotient', 'x - 8')
      type('Remainder', 'x + 3')
      click('Check answers')
      expect(screen.getAllByRole('alert').map((el) => el.textContent).join(' ')).toContain('That is the quotient')
      type('Quotient', 'x + 3')
      type('Remainder', 'x - 8')
      click('Check answers')
      expect(events('problem_done')).toHaveLength(1)
      expect(screen.getByRole('heading', { name: 'The whole division' })).toBeTruthy()
      expect(screen.getAllByText(/quotient x \+ 3, remainder x − 8/).length).toBeGreaterThan(0)
      // Every check that was an attempt is on the record, the wrong ones included.
      const finals = events('final_answer') as { correct: boolean }[]
      expect(finals.filter((e) => !e.correct).length).toBeGreaterThanOrEqual(4)
      expect(finals.filter((e) => e.correct).length).toBeGreaterThanOrEqual(5)
    },
  )

  it('the hints of a part never give the next one away', { timeout: FLOW_TIMEOUT }, () => {
    renderAt(path)
    const hints = () => screen.getByRole('heading', { name: 'Hints' }).closest('section')!
    click('Nudge me')
    expect(hints().textContent).toContain('first term of the dividend')
    click('Show the rule')
    expect(hints().textContent).toContain('Each round starts with the leading terms only')
    expect(hints().textContent).not.toContain('3x^2 + x − 5')
    expect(hints().textContent).not.toContain('x − 8')
    // The last rung explains this part and stops there: nothing of the subtraction that comes next.
    click(/^Explain the answer/)
    expect(hints().textContent).toContain('x^3 ÷ x^2 = x')
    expect(hints().textContent).toContain('x · (x^2 + 1) = x^3 + x')
    expect(hints().textContent).not.toContain('3x^2 + x − 5')
  })
})
