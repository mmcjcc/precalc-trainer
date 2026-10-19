// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { anyShows, numberForms } from '@/content/modules/explog/text'
import { LF_KEYS, type LogFormsAnswer } from '@/content/modules/logForms'
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
  const p = generateProblem('logForms', templateId, seed)
  if (p.answer.type !== 'logForms') throw new Error(`${templateId}: not logForms`)
  return { p, a: p.answer, path: problemPath('logForms', templateId, seed) }
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

function formsOf(a: LogFormsAnswer): string[] {
  return a.question === 'value' ? numberForms(a.answerText) : [a.answerText, a.answerText.replace(/\s+/g, '')]
}

beforeEach(() => {
  resetStoreForTests()
})

function walk(a: LogFormsAnswer) {
  const forms = formsOf(a)
  expect(screen.getByRole('heading', { name: 'Your answer' })).toBeTruthy()
  expect(screen.queryByRole('region', { name: 'Worked explanation' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'How it works out' })).toBeNull()
  expect(screen.queryByRole('heading', { name: 'The answer, worked out' })).toBeNull()
  type('Answer', a.trapAnswer)
  click('Check the answer')
  const alert = screen.getByRole('alert')
  expect(alert.textContent).toContain('Not quite:')
  expect(alert.textContent).toContain(ERROR_PATTERNS[a.trap].title)
  expect(anyShows([alert.textContent ?? ''], forms), alert.textContent ?? '').toBe(false)
  expect(finals()).toHaveLength(1)
  expect(finals()[0]).toMatchObject({ correct: false, pattern: a.trap, via: 'text' })
  click('Check the answer')
  expect(finals()).toHaveLength(1)
  expect(doneEvent()).toBeUndefined()
  type('Answer', a.answerText)
  click('Check the answer')
  expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
  expect(doneEvent()).toMatchObject({ finalCorrect: false, revealed: 0 })
  expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'The answer, worked out' })).toBeTruthy()
  for (const line of a.reveal) expect(screen.getAllByText(line).length).toBeGreaterThan(0)
}

describe.each([
  ['lf.value', 'Give the exact value.'],
  ['lf.convert', 'Rewrite the equation in the other form.'],
  ['lf.decimal', /Round to (two|three|four) decimal places\./],
] as const)('LogFormsFlow %s', (templateId, instructions) => {
  it(
    'names the promised mistake, then accepts the fix, records both, and completes',
    () => {
      const { a, path } = load(templateId)
      renderAt(path)
      expect(screen.getByText(instructions)).toBeTruthy()
      expect(screen.getByText(a.prompt)).toBeTruthy()
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
      expect(screen.getByRole('alert').textContent).toContain('This doesn’t count as an attempt')
      expect(field('Answer').getAttribute('aria-invalid')).toBe('true')
      expect(useStore.getState().events).toEqual([])
      type('Answer', '???')
      expect(screen.queryByRole('alert')).toBeNull()
      click('Check the answer')
      expect(screen.getByRole('alert').textContent).toContain('This doesn’t count as an attempt')
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
      expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [LF_KEYS.answer]: 'not yet' })
      renderAt(path)
      expect(field('Answer').value).toBe('not yet')
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )
})

describe('LogFormsFlow hints', () => {
  it(
    'the third hint shows the worked value and marks it shown; the first two do not',
    () => {
      const { a, path } = load('lf.value', 1)
      renderAt(path)
      const hints = () => screen.getByRole('heading', { name: 'Hints' }).closest('section')!
      expect(screen.queryByRole('region', { name: 'Worked explanation' })).toBeNull()
      click('Nudge me')
      click('Show the rule')
      expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()
      expect(screen.queryByRole('region', { name: 'Worked explanation' })).toBeNull()
      expect(anyShows([hints().textContent ?? ''], formsOf(a))).toBe(false)
      click(/Explain the answer/)
      expect(useStore.getState().attempt?.final).toMatchObject({ revealed: true, firstCorrect: false })
      expect(screen.getByRole('region', { name: 'Worked explanation' })).toBeTruthy()
      for (const line of a.reveal) expect(screen.getAllByText(line).length).toBeGreaterThan(0)
      expect(finals()).toEqual([])
    },
    FLOW_TIMEOUT,
  )
})
