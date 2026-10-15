// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { CX_KEYS, canonicalEntries, gradeCxStage, type ComplexNumsAnswer } from '@/content/modules/complexNums'
import { ERROR_PATTERNS } from '@/engine'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '../Problem'

const FLOW_TIMEOUT = 120_000

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

function load(templateId: string, seed = 1) {
  const p = generateProblem('complexNums', templateId, seed)
  if (p.answer.type !== 'complexNums') throw new Error(`${templateId}: not complexNums`)
  return { p, a: p.answer, path: problemPath('complexNums', templateId, seed) }
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: label }), { target: { value } })
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

function field(label: string): HTMLInputElement {
  return screen.getByRole('textbox', { name: label }) as HTMLInputElement
}

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
type EvOf<T extends string> = Extract<ReturnType<typeof events>[number], { t: T }>
const finals = () => events('final_answer') as EvOf<'final_answer'>[]
const doneEvent = () => events('problem_done')[0] as EvOf<'problem_done'> | undefined
const NOT_AN_ATTEMPT = 'This doesn’t count as an attempt'

beforeEach(() => {
  resetStoreForTests()
})

function walk(a: ComplexNumsAnswer) {
  const right = canonicalEntries(a)
  const box = { label: 'Answer', check: 'Check the answer' }
  expect(screen.getByRole('heading', { name: 'Your answer' })).toBeTruthy()
  const before = finals().length
  type(box.label, a.trapAnswer)
  click(box.check)
  const alert = screen.getByRole('alert')
  const info = ERROR_PATTERNS[a.trap]
  expect(alert.textContent).toContain(info.title)
  expect(alert.textContent).toContain(info.lesson)
  expect(alert.textContent).toContain('Example:')
  const grade = gradeCxStage(a, 'answer', a.trapAnswer)
  if (grade.verdict !== 'mistake') throw new Error(`trap graded ${grade.verdict}`)
  expect(alert.textContent).toContain(grade.witness)
  expect(finals()).toHaveLength(before + 1)
  expect(finals()[before]).toMatchObject({ correct: false, pattern: a.trap, via: 'text' })
  click(box.check)
  expect(finals()).toHaveLength(before + 1)
  expect(doneEvent()).toBeUndefined()
  type(box.label, right[CX_KEYS.answer] ?? '')
  click(box.check)
  expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
  expect(doneEvent()).toMatchObject({ finalCorrect: false, revealed: 0 })
  expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'The answer, worked out' })).toBeTruthy()
  for (const line of a.reveal) expect(screen.getByText(line)).toBeTruthy()
}

describe.each([
  ['cx.arith', 'Simplify.'],
  ['cx.divide', 'Simplify.'],
  ['cx.powers', 'Simplify.'],
  ['cx.quadratic', 'Solve the equation.'],
  ['cx.zeros', 'Find all zeros of f.'],
] as const)('ComplexNumsFlow %s', (templateId, prompt) => {
  it(
    'names the promised mistake, then accepts the fix, records both, and completes',
    () => {
      const { a, path } = load(templateId)
      renderAt(path)
      expect(screen.getByText(prompt)).toBeTruthy()
      expect(screen.getByText(a.prompt)).toBeTruthy()
      expect(screen.queryByText(a.reveal[0]!)).toBeNull()
      walk(a)
    },
    FLOW_TIMEOUT,
  )

  it(
    'an unreadable answer records nothing',
    () => {
      const { path } = load(templateId)
      renderAt(path)
      click('Check the answer')
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      expect(field('Answer').getAttribute('aria-invalid')).toBe('true')
      expect(useStore.getState().events).toEqual([])
      type('Answer', '???')
      expect(screen.queryByRole('alert')).toBeNull()
      click('Check the answer')
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      expect(useStore.getState().events).toEqual([])
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores the entry',
    () => {
      const { path } = load(templateId)
      const view = renderAt(path)
      type('Answer', 'not yet')
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [CX_KEYS.answer]: 'not yet' })
      renderAt(path)
      expect(field('Answer').value).toBe('not yet')
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )
})

describe('ComplexNumsFlow hints', () => {
  it(
    'the third hint shows the answer and marks it shown',
    () => {
      const { a, path } = load('cx.arith', 2)
      renderAt(path)
      expect(screen.queryByText(a.stages[0]!.reveal[0]!)).toBeNull()
      click('Nudge me')
      click('Show the rule')
      expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()
      expect(screen.queryByText(a.stages[0]!.reveal[0]!)).toBeNull()
      click(/Explain the answer/)
      expect(useStore.getState().attempt?.final?.revealed).toBe(true)
      expect(useStore.getState().attempt?.final?.firstCorrect).toBe(false)
      for (const line of a.stages[0]!.reveal) expect(screen.getByText(line)).toBeTruthy()
      expect(useStore.getState().events.filter((e) => e.t === 'final_answer')).toEqual([])
    },
    FLOW_TIMEOUT,
  )
})
