// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { AnswerSpec } from '@/content/types'
import { ERROR_PATTERNS, gradeCoefficientRow, gradeIsFactor, quotientMistakes, remainderMistakes, syntheticMistakes } from '@/engine'
import { ratToString } from '@/notation'
import { resetStoreForTests, useStore } from '@/store'
import { problemPath } from '@/problem/url'
import ProblemPage from '../Problem'

type SdAnswer = Extract<AnswerSpec, { type: 'polyDivision' }>

const FLOW_TIMEOUT = 120_000
const NTH = ['first', 'second', 'third', 'fourth', 'fifth']

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

function find(templateId: string, pred: (a: SdAnswer) => boolean): { seed: number; a: SdAnswer } {
  for (let seed = 1; seed <= 300; seed++) {
    const p = generateProblem('polyDivision', templateId, seed)
    if (p.answer.type === 'polyDivision' && pred(p.answer)) return { seed, a: p.answer }
  }
  throw new Error(`no ${templateId} seed`)
}

function type(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

function field(label: string | RegExp): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement
}

function fillTable(box: string, products: readonly string[], bottom: readonly string[]) {
  type('Number in the box', box)
  bottom.forEach((v, i) => type(`Bottom row, ${NTH[i]} column`, v))
  products.forEach((v, i) => type(`Product, ${NTH[i + 1]} column`, v))
}

const show = (text: string) => text.replace(/-/g, '−')
const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
type EvOf<T extends string> = Extract<ReturnType<typeof events>[number], { t: T }>
const finals = () => events('final_answer') as EvOf<'final_answer'>[]
const doneEvent = () => events('problem_done')[0] as EvOf<'problem_done'> | undefined
const table = () => screen.queryByRole('group', { name: 'Synthetic division table' })
const hintsPanel = () => screen.getByRole('heading', { name: 'Hints' }).closest('section')!
const NOT_AN_ATTEMPT = 'This doesn’t count as an attempt'

/** The rule card shown first on the second hint rung (not one of the cards folded under it). */
function leadCard(title: string) {
  expect(within(hintsPanel()).getByText(title).closest('details')).toBeNull()
}

beforeEach(() => {
  resetStoreForTests()
})

describe('PolyDivisionFlow: the table (sd.table)', () => {
  // A cubic with a missing power and a remainder that is not 0, so every part has something to get wrong.
  const hit = find('sd.table', (a) => a.trap === 'sd_missing_placeholder' && a.degree === 3 && !a.isFactor)
  const a = hit.a
  const path = problemPath('polyDivision', 'sd.table', hit.seed)
  const rightRow = a.rows.coefficients.join(', ')
  const shortRow = a.rows.coefficients.filter((v) => v !== '0').join(', ')
  const signRun = syntheticMistakes(a.f, a.c)!.find((c) => c.kind === 'sd_wrong_sign_c')!
  const signBox = ratToString(signRun.box)
  const signBottom = signRun.bottom.map(ratToString)
  const signProducts = signRun.products.map(ratToString)
  // Subtracting with the right box: the same bottom row, each product with the opposite sign.
  const subtractedProducts = signRun.products.map((v) => ratToString({ n: -v.n, d: v.d }))
  const wrongQuotient = quotientMistakes(a.f, a.c)!.find((c) => c.kind === 'sd_quotient_degree')!

  function passRow() {
    type('Top row of the table', rightRow)
    click('Check the row')
  }

  function passTable() {
    fillTable(a.c, a.rows.products, a.rows.bottom)
    click('Check the table')
  }

  it(
    'names the missing 0, then the subtraction and the box, then the quotient degree; each fix moves on; all of it is recorded',
    () => {
      renderAt(path)
      expect(screen.getByText(a.prompt)).toBeTruthy()
      expect(a.prompt).toContain(show(a.divisor))
      expect(screen.getByRole('heading', { name: 'Part 1 of 3: The top row' })).toBeTruthy()
      // No graph and no calculator in this module, and nothing of the later parts before she gets there:
      // a table drawn now would say how many numbers the row needs.
      expect(screen.queryByRole('heading', { name: 'Graph it' })).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Calculator' })).toBeNull()
      expect(table()).toBeNull()
      expect(screen.queryByLabelText('Quotient')).toBeNull()
      expect(field('Top row of the table').className).toContain('min-h-12')
      expect(field('Top row of the table').placeholder).toBe('')
      expect(screen.getByRole('button', { name: 'Check the row' }).className).toContain('min-h-12')

      // Part 1: the row without its 0.
      const short = gradeCoefficientRow(a.f, shortRow)
      expect(short.verdict).toBe('mistake')
      type('Top row of the table', shortRow)
      click('Check the row')
      let alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_sd_missing_placeholder.title)
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_sd_missing_placeholder.lesson)
      if (short.verdict === 'mistake') expect(alert.textContent).toContain(short.witness)
      expect(alert.textContent).toContain('Example:')
      expect(finals()).toMatchObject([{ correct: false, pattern: 'poly_sd_missing_placeholder', via: 'text' }])
      // The worked explanation holds the answer: it is not shown beside a mistake she can still fix.
      expect(screen.queryByRole('region', { name: 'How it works out' })).toBeNull()
      expect(screen.queryByRole('region', { name: 'Worked explanation' })).toBeNull()
      expect(table()).toBeNull()

      // The same wrong row again is not a second try.
      click('Check the row')
      expect(finals()).toHaveLength(1)

      click('Nudge me')
      expect(within(hintsPanel()).getByText(a.stages[0]!.nudge)).toBeTruthy()
      click('Show the rule')
      leadCard('Every power gets a place in the top row')
      expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()

      passRow()
      expect(finals()).toMatchObject([{ correct: false }, { correct: true }])
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.getByText('The top row is right.')).toBeTruthy()
      expect(field('Top row of the table').disabled).toBe(true)
      expect(screen.queryByRole('button', { name: 'Check the row' })).toBeNull()
      expect(useStore.getState().attempt?.final?.polyStage).toBe(1)

      // Part 2: the table appears with her checked row printed, and focus is in the box.
      expect(screen.getByRole('heading', { name: 'Part 2 of 3: The table' })).toBeTruthy()
      const grid = table()!
      expect(grid.textContent).toContain(`Top row: ${show(rightRow)}.`)
      expect(document.activeElement).toBe(field('Number in the box'))
      // Each part has its own hint ladder: the one for the table starts closed.
      expect(screen.getByRole('button', { name: 'Nudge me' })).toBeTruthy()
      expect(within(hintsPanel()).queryByText(a.stages[0]!.nudge)).toBeNull()
      // Tab order is the document order: the box, then column by column (product, then sum).
      const cells = within(grid).getAllByRole('textbox') as HTMLInputElement[]
      expect(cells.map((el) => el.getAttribute('aria-label'))).toEqual([
        'Number in the box',
        'Bottom row, first column',
        'Product, second column',
        'Bottom row, second column',
        'Product, third column',
        'Bottom row, third column',
        'Product, fourth column',
        'Bottom row, fourth column',
      ])
      for (const el of cells) {
        expect(el.type).toBe('text')
        expect(el.className).toContain('h-11')
        expect(el.className).toContain('w-11')
        expect(el.tabIndex).toBe(0)
      }

      // Subtracted every product, with the right number in the box.
      fillTable(a.c, subtractedProducts, signBottom)
      click('Check the table')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_sd_subtracted.title)
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_sd_subtracted.lesson)
      expect(alert.textContent).toContain('Example:')
      expect(finals()).toHaveLength(3)
      expect(finals()[2]).toMatchObject({ correct: false, pattern: 'poly_sd_subtracted' })
      // The rule card follows the slip just named.
      click('Nudge me')
      click('Show the rule')
      leadCard('Multiply, write it under the next coefficient, add')

      // The same bottom row with the opposite number in the box is the other slip: the box and the
      // products are what tell the two apart.
      fillTable(signBox, signProducts, signBottom)
      click('Check the table')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_sd_wrong_sign_c.title)
      expect(alert.textContent).toContain(`write ${show(a.c)}, not ${show(signBox)}`)
      expect(finals()).toHaveLength(4)
      expect(finals()[3]).toMatchObject({ correct: false, pattern: 'poly_sd_wrong_sign_c' })
      leadCard('The box holds the number that makes the divisor 0')
      expect(screen.queryByLabelText('Quotient')).toBeNull()

      passTable()
      expect(finals()).toHaveLength(5)
      expect(finals()[4]).toMatchObject({ correct: true })
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.getByText('The table is right: every column checks out.')).toBeTruthy()
      // The engine's own sentence states the quotient and the remainder, which part 3 asks for.
      expect(screen.queryByText(/so the quotient is/)).toBeNull()
      for (const el of within(table()!).getAllByRole('textbox') as HTMLInputElement[]) expect(el.disabled).toBe(true)

      // Part 3: quotient one power too high, remainder right.
      expect(screen.getByRole('heading', { name: 'Part 3 of 3: Quotient and remainder' })).toBeTruthy()
      expect(document.activeElement).toBe(field('Quotient'))
      for (const label of ['Quotient', 'Remainder']) {
        expect(field(label).className).toContain('min-h-12')
        expect(field(label).placeholder).toBe('')
      }
      type('Quotient', wrongQuotient.text)
      type('Remainder', a.remainderText)
      click('Check answers')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_sd_quotient_degree.title)
      expect(alert.textContent).toContain(wrongQuotient.witness)
      expect(screen.getByText(/^Correct: the remainder is/)).toBeTruthy()
      expect(finals()).toHaveLength(6)
      expect(finals()[5]).toMatchObject({ correct: false, pattern: 'poly_sd_quotient_degree' })
      expect(screen.queryByRole('region', { name: 'How it works out' })).toBeNull()
      expect(doneEvent()).toBeUndefined()

      type('Quotient', a.quotientText)
      click('Check answers')
      expect(finals()).toHaveLength(7)
      expect(finals()[6]).toMatchObject({ correct: true })
      expect(doneEvent()).toMatchObject({ finalCorrect: false, firstTryRate: 0, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.getByRole('heading', { name: 'The whole division' })).toBeTruthy()
      for (const line of a.reveal) expect(screen.getByText(line)).toBeTruthy()
      expect(field('Quotient').disabled).toBe(true)
      expect(field('Remainder').disabled).toBe(true)
      expect(screen.queryByRole('button', { name: 'Check answers' })).toBeNull()
      // Still no graph: this module has none, even afterwards.
      expect(screen.queryByRole('heading', { name: 'Graph it' })).toBeNull()
      expect(screen.queryByRole('img', { name: /graph/i })).toBeNull()
    },
    FLOW_TIMEOUT,
  )

  it(
    'an unreadable row, an empty cell, or the whole division typed as the quotient is not an attempt: nothing is recorded',
    () => {
      renderAt(path)
      click('Check the row')
      let alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      expect(alert.textContent).toContain('Type the coefficient row first')
      expect(field('Top row of the table').getAttribute('aria-invalid')).toBe('true')
      expect(document.activeElement).toBe(field('Top row of the table'))
      expect(useStore.getState().events).toEqual([])

      // The notice goes as soon as she edits.
      type('Top row of the table', '2, , 3')
      expect(screen.queryByRole('alert')).toBeNull()
      click('Check the row')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      expect(alert.textContent).toContain('empty place in the coefficient row')
      expect(useStore.getState().events).toEqual([])
      expect(table()).toBeNull()

      passRow()
      expect(finals()).toMatchObject([{ correct: true }])

      // Nothing typed: the box comes first.
      click('Check the table')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      expect(alert.textContent).toContain('The box: ')
      expect(document.activeElement).toBe(field('Number in the box'))
      expect(field('Number in the box').getAttribute('aria-invalid')).toBe('true')

      // Everything right except one empty cell of the middle row: that cell gets the focus.
      fillTable(a.c, a.rows.products, a.rows.bottom)
      expect(screen.queryByRole('alert')).toBeNull()
      type('Product, third column', '')
      click('Check the table')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      expect(alert.textContent).toContain('Fill in every box of the middle row.')
      expect(document.activeElement).toBe(field('Product, third column'))
      expect(field('Product, third column').getAttribute('aria-invalid')).toBe('true')
      expect(field('Number in the box').getAttribute('aria-invalid')).toBeNull()

      // An empty bottom cell, with the wrong number in the box: still not an attempt.
      type('Product, third column', a.rows.products[1]!)
      type('Bottom row, fourth column', '')
      type('Number in the box', signBox)
      click('Check the table')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      expect(alert.textContent).toContain('Fill in every box of the bottom row.')
      expect(document.activeElement).toBe(field('Bottom row, fourth column'))
      expect(finals()).toHaveLength(1)
      expect(screen.queryByLabelText('Quotient')).toBeNull()

      passTable()
      expect(finals()).toMatchObject([{ correct: true }, { correct: true }])

      // The whole result q(x) + r/(x − c) is equal, but it is not the quotient alone.
      type('Quotient', `${a.quotientText} + (${a.remainderText})/(${a.divisor})`)
      type('Remainder', a.remainderText)
      click('Check answers')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      expect(alert.textContent).toContain('Quotient: That is the whole result of the division.')
      expect(field('Quotient').getAttribute('aria-invalid')).toBe('true')
      expect(document.activeElement).toBe(field('Quotient'))
      // Nothing is marked right or wrong while one box is not an attempt.
      expect(screen.queryByText(/^Correct: the remainder is/)).toBeNull()
      expect(finals()).toHaveLength(2)
      expect(doneEvent()).toBeUndefined()

      type('Quotient', a.quotientText)
      type('Remainder', '')
      click('Check answers')
      expect(screen.getByRole('alert').textContent).toContain('Remainder: Type a number first.')
      expect(document.activeElement).toBe(field('Remainder'))
      expect(finals()).toHaveLength(2)
    },
    FLOW_TIMEOUT,
  )

  it(
    'restores the part she had reached and every cell after a reload; all right first time is a complete problem',
    () => {
      const view = renderAt(path)
      passRow()
      type('Number in the box', a.c)
      type('Bottom row, first column', a.rows.bottom[0]!)
      type('Product, second column', a.rows.products[0]!)
      view.unmount()
      const stored = useStore.getState().attempt
      expect(stored?.final?.polyStage).toBe(1)
      expect(stored?.final?.polyEntries).toEqual({ row: rightRow, box: a.c, b0: a.rows.bottom[0], p1: a.rows.products[0] })

      renderAt(path)
      expect(field('Top row of the table').value).toBe(rightRow)
      expect(field('Top row of the table').disabled).toBe(true)
      expect(screen.getByText('The top row is right.')).toBeTruthy()
      expect(table()).toBeTruthy()
      expect(field('Number in the box').value).toBe(a.c)
      expect(field('Bottom row, first column').value).toBe(a.rows.bottom[0])
      expect(field('Product, second column').value).toBe(a.rows.products[0])
      expect(field('Bottom row, second column').value).toBe('')
      expect(screen.queryByLabelText('Quotient')).toBeNull()

      passTable()
      type('Quotient', a.quotientText)
      const again = screen.getByRole('button', { name: 'Check answers' })
      expect(again).toBeTruthy()
      type('Remainder', a.remainderText)
      fireEvent.click(again)
      expect(finals()).toMatchObject([{ correct: true }, { correct: true }, { correct: true }])
      expect(doneEvent()).toMatchObject({ finalCorrect: true, firstTryRate: 1, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
      expect(screen.getByText(/^Correct: the quotient is/)).toBeTruthy()
      expect(screen.getByText(/^Correct: the remainder is/)).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'the third hint rung explains the open part only, and marks the attempt as shown',
    () => {
      renderAt(path)
      click('Nudge me')
      click('Show the rule')
      click(/^Explain the answer/)
      for (const line of a.stages[0]!.reveal) expect(within(hintsPanel()).getByText(line)).toBeTruthy()
      // The explanation of the top row does not work the table for her.
      expect(within(hintsPanel()).queryByText(a.stages[1]!.reveal[2]!)).toBeNull()
      expect(useStore.getState().attempt?.final).toMatchObject({ revealed: true, firstCorrect: false })
      expect(useStore.getState().attempt?.hintsUsed).toEqual({ '0': 3 })

      passRow()
      // A new part, a new ladder.
      expect(screen.getByRole('button', { name: 'Nudge me' })).toBeTruthy()
      click('Nudge me')
      expect(within(hintsPanel()).getByText(a.stages[1]!.nudge)).toBeTruthy()
      expect(useStore.getState().attempt?.hintsUsed).toEqual({ '0': 3, '1': 1 })

      passTable()
      type('Quotient', a.quotientText)
      type('Remainder', a.remainderText)
      click('Check answers')
      expect(doneEvent()!.revealed).toBeGreaterThan(0)
      expect(doneEvent()!.firstTryRate).toBe(0)
      expect(doneEvent()!.finalCorrect).toBe(true)
    },
    FLOW_TIMEOUT,
  )
})

describe('PolyDivisionFlow: f(c) by synthetic division (sd.value)', () => {
  const hit = find('sd.value', (a) => Boolean(remainderMistakes(a.f, a.c)?.some((c) => c.kind === 'sd_remainder_last_quotient' && c.shadows.length === 0)))
  const a = hit.a
  const path = problemPath('polyDivision', 'sd.value', hit.seed)
  const rightBottom = a.rows.bottom.join(', ')
  const signRun = syntheticMistakes(a.f, a.c)!.find((c) => c.kind === 'sd_wrong_sign_c')!
  const early = remainderMistakes(a.f, a.c)!.find((c) => c.kind === 'sd_remainder_last_quotient')!
  const valueLabel = `f(${show(a.c)}) =`

  it(
    'names the box slip in the bottom row, then the number read one place early; the fix finishes the problem',
    () => {
      renderAt(path)
      expect(screen.getByText(a.prompt)).toBeTruthy()
      expect(a.prompt).toContain(`f(${show(a.c)})`)
      expect(screen.getByRole('heading', { name: 'Part 1 of 2: The bottom row' })).toBeTruthy()
      expect(screen.queryByRole('heading', { name: 'Graph it' })).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Calculator' })).toBeNull()
      expect(screen.queryByLabelText(valueLabel)).toBeNull()

      type('Bottom row of your table', signRun.text)
      click('Check the row')
      let alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_sd_wrong_sign_c.title)
      expect(alert.textContent).toContain(signRun.witness)
      expect(finals()).toMatchObject([{ correct: false, pattern: 'poly_sd_wrong_sign_c', via: 'text' }])
      expect(screen.queryByRole('region', { name: 'How it works out' })).toBeNull()

      type('Bottom row of your table', rightBottom)
      click('Check the row')
      expect(finals()).toMatchObject([{ correct: false }, { correct: true }])
      expect(screen.getByText('The bottom row is right.')).toBeTruthy()
      // The engine's sentence for a right row names the remainder, which is the value she is about to give.
      expect(screen.queryByText(/^Correct: the bottom row is/)).toBeNull()
      expect(screen.getByRole('heading', { name: 'Part 2 of 2: The value' })).toBeTruthy()
      expect(document.activeElement).toBe(field(valueLabel))
      expect(field(valueLabel).className).toContain('min-h-12')

      // An empty box is not an attempt.
      click('Check the value')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      expect(finals()).toHaveLength(2)

      type(valueLabel, early.text)
      click('Check the value')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_sd_remainder_last_quotient.title)
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_sd_remainder_last_quotient.lesson)
      expect(finals()).toHaveLength(3)
      expect(finals()[2]).toMatchObject({ correct: false, pattern: 'poly_sd_remainder_last_quotient' })
      click('Nudge me')
      expect(within(hintsPanel()).getByText(a.stages[1]!.nudge)).toBeTruthy()
      click('Show the rule')
      leadCard('Read the bottom row: quotient, then remainder')
      expect(doneEvent()).toBeUndefined()

      type(valueLabel, a.remainderText)
      click('Check the value')
      expect(finals()).toHaveLength(4)
      expect(doneEvent()).toMatchObject({ finalCorrect: false, firstTryRate: 0, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
      for (const line of a.reveal) expect(screen.getByText(line)).toBeTruthy()
      expect(field(valueLabel).disabled).toBe(true)
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores the row, the part and the value she was typing',
    () => {
      const view = renderAt(path)
      type('Bottom row of your table', rightBottom)
      click('Check the row')
      type(valueLabel, '12')
      view.unmount()
      expect(useStore.getState().attempt?.final).toMatchObject({ polyStage: 1, polyEntries: { bottom: rightBottom, value: '12' } })

      renderAt(path)
      expect(field('Bottom row of your table').value).toBe(rightBottom)
      expect(field('Bottom row of your table').disabled).toBe(true)
      expect(field(valueLabel).value).toBe('12')
      type(valueLabel, a.remainderText)
      click('Check the value')
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
      expect(doneEvent()).toMatchObject({ finalCorrect: true, firstTryRate: 1 })
    },
    FLOW_TIMEOUT,
  )
})

describe('PolyDivisionFlow: the factor theorem (sd.factor)', () => {
  // f(c) = 0 and f(−c) ≠ 0: answering "no" is what testing the opposite number gives.
  const hit = find('sd.factor', (a) => a.isFactor)
  const a = hit.a
  const path = problemPath('polyDivision', 'sd.factor', hit.seed)
  const rightBottom = a.rows.bottom.join(', ')
  const question = `Is ${show(a.divisor)} a factor of f(x)?`
  const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement

  it(
    'names the sign slip behind a wrong "no", then accepts "yes"; an unanswered choice is not an attempt',
    () => {
      const slip = gradeIsFactor(a.f, a.c, 'no')
      expect(slip.verdict).toBe('mistake')
      renderAt(path)
      expect(screen.getByText(a.prompt)).toBeTruthy()
      expect(a.prompt).toBe(question)
      expect(screen.queryByRole('group', { name: question })).toBeNull()

      type('Bottom row of your table', rightBottom)
      click('Check the row')
      expect(finals()).toMatchObject([{ correct: true }])
      expect(screen.getByRole('heading', { name: 'Part 2 of 2: Factor or not' })).toBeTruthy()
      expect(screen.getByRole('group', { name: question })).toBeTruthy()
      for (const name of ['yes', 'no']) {
        expect(radio(name).closest('label')!.className).toContain('min-h-11')
        expect(radio(name).closest('label')!.className).toContain('min-w-11')
        expect(radio(name).checked).toBe(false)
      }
      expect(document.activeElement).toBe(radio('yes'))

      click('Check the answer')
      let alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      expect(alert.textContent).toContain('Answer yes or no.')
      expect(finals()).toHaveLength(1)

      fireEvent.click(radio('no'))
      expect(screen.queryByRole('alert')).toBeNull()
      click('Check the answer')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_sd_wrong_sign_c.title)
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_sd_wrong_sign_c.lesson)
      if (slip.verdict === 'mistake') expect(alert.textContent).toContain(slip.witness)
      expect(finals()).toMatchObject([{ correct: true }, { correct: false, pattern: 'poly_sd_wrong_sign_c' }])
      expect(screen.queryByRole('region', { name: 'How it works out' })).toBeNull()
      click('Nudge me')
      click('Show the rule')
      leadCard('The box holds the number that makes the divisor 0')

      fireEvent.click(radio('yes'))
      click('Check the answer')
      expect(finals()).toHaveLength(3)
      // The first check was right, but a later part was not: this is not a first-try problem.
      expect(doneEvent()).toMatchObject({ finalCorrect: false, firstTryRate: 0, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
      for (const line of a.reveal) expect(screen.getByText(line)).toBeTruthy()
      expect(radio('yes').disabled).toBe(true)
      expect(radio('yes').checked).toBe(true)
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores the choice she had made',
    () => {
      const view = renderAt(path)
      type('Bottom row of your table', rightBottom)
      click('Check the row')
      fireEvent.click(radio('yes'))
      view.unmount()
      expect(useStore.getState().attempt?.final).toMatchObject({ polyStage: 1, polyEntries: { bottom: rightBottom, factor: 'yes' } })

      renderAt(path)
      expect(radio('yes').checked).toBe(true)
      expect(radio('no').checked).toBe(false)
      click('Check the answer')
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
      expect(doneEvent()).toMatchObject({ finalCorrect: true, firstTryRate: 1, revealed: 0 })
    },
    FLOW_TIMEOUT,
  )
})
