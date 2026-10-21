// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { anyShows } from '@/content/modules/explog/text'
import { EE_KEYS, type ExpLogAnswer } from '@/content/modules/expLogEquations'
import type { LogPropertiesAnswer } from '@/content/modules/logProperties'
import { checkLogStep, ERROR_PATTERNS } from '@/engine'
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
const accepted = () => events('step_accepted') as EvOf<'step_accepted'>[]
const rejected = () => events('step_rejected') as EvOf<'step_rejected'>[]
const finals = () => events('final_answer') as EvOf<'final_answer'>[]
const doneEvent = () => events('problem_done')[0] as EvOf<'problem_done'> | undefined

beforeEach(() => {
  resetStoreForTests()
})

function walkProperties(a: LogPropertiesAnswer) {
  expect(screen.getByRole('heading', { name: 'Your work' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'The answer, worked out' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'How it works out' })).toBeNull()
  expect(screen.getByText(/Assume all variables are positive/)).toBeTruthy()
  type('Next line', a.trapAnswer)
  click('Check this line')
  const alert = screen.getByRole('alert')
  expect(alert.textContent).toContain('Not accepted:')
  expect(alert.textContent).toContain(ERROR_PATTERNS[a.trap].title)
  expect(anyShows([alert.textContent ?? ''], [a.answerText]), alert.textContent ?? '').toBe(false)
  expect(rejected()).toMatchObject([{ pattern: a.trap }])
  expect(accepted()).toEqual([])
  click('Check this line')
  expect(rejected()).toHaveLength(1)
  type('Next line', a.answerText)
  click('Check this line')
  expect(accepted().length).toBeGreaterThan(0)
  expect(finals()).toEqual([])
  expect(doneEvent()).toMatchObject({ finalCorrect: true, revealed: 0 })
  expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
  expect(screen.queryByLabelText('Next line')).toBeNull()
  for (const line of a.reveal) expect(screen.getAllByText(line).length).toBeGreaterThan(0)
}

function walkEquation(a: ExpLogAnswer) {
  const forms = [a.answerText, ...a.accept]
  expect(screen.getByRole('heading', { name: 'Your answer' })).toBeTruthy()
  expect(field('Answer').disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Check the answer' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByRole('heading', { name: 'The answer, worked out' })).toBeNull()
  type('Next line', a.path[0]!)
  click('Check this line')
  expect(accepted()).toHaveLength(1)
  expect(field('Answer').disabled).toBe(false)
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
  type('Answer', a.answerText)
  click('Check the answer')
  expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
  expect(doneEvent()).toMatchObject({ finalCorrect: false, revealed: 0 })
  expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
  for (const line of a.reveal) expect(screen.getAllByText(line).length).toBeGreaterThan(0)
}

describe.each([
  ['lp.expand', 'logProperties'],
  ['lp.condense', 'logProperties'],
] as const)('LogPropertiesFlow %s', (templateId, moduleId) => {
  it(
    'names the promised slip, then accepts the finished line, records both, and completes',
    () => {
      const p = generateProblem(moduleId, templateId, 1)
      if (p.answer.type !== 'logProperties') throw new Error(templateId)
      renderAt(problemPath(moduleId, templateId, 1))
      expect(screen.getByText(p.answer.prompt)).toBeTruthy()
      walkProperties(p.answer)
    },
    FLOW_TIMEOUT,
  )

  it(
    'an unreadable line records nothing',
    () => {
      renderAt(problemPath(moduleId, templateId, 1))
      type('Next line', '???')
      click('Check this line')
      expect(screen.getByRole('alert').textContent).toContain('This doesn’t count as an attempt')
      expect(useStore.getState().events).toEqual([])
      type('Next line', 'log(')
      expect(screen.queryByRole('alert')).toBeNull()
      click('Check this line')
      expect(screen.getByRole('alert').textContent).toContain('This doesn’t count as an attempt')
      expect(useStore.getState().events).toEqual([])
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores the line she was typing',
    () => {
      const view = renderAt(problemPath(moduleId, templateId, 1))
      type('Next line', '2log(x')
      view.unmount()
      expect(useStore.getState().attempt?.draft).toBe('2log(x')
      renderAt(problemPath(moduleId, templateId, 1))
      expect(field('Next line').value).toBe('2log(x')
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )
})

describe.each([
  ['ee.exponential', 'expLogEquations'],
  ['ee.logarithmic', 'expLogEquations'],
  ['ee.quadratic', 'expLogEquations'],
] as const)('ExpLogEquationsFlow %s', (templateId, moduleId) => {
  it(
    'keeps the answer box shut until a line is kept, names the promised slip, then accepts the solution',
    () => {
      const p = generateProblem(moduleId, templateId, 1)
      if (p.answer.type !== 'expLogEquations') throw new Error(templateId)
      renderAt(problemPath(moduleId, templateId, 1))
      expect(screen.getByText(p.answer.prompt)).toBeTruthy()
      walkEquation(p.answer)
    },
    FLOW_TIMEOUT,
  )

  it(
    'an unreadable line, and an unreadable solution, record nothing',
    () => {
      const p = generateProblem(moduleId, templateId, 2)
      if (p.answer.type !== 'expLogEquations') throw new Error(templateId)
      renderAt(problemPath(moduleId, templateId, 2))
      type('Next line', '???')
      click('Check this line')
      expect(screen.getByRole('alert').textContent).toContain('This doesn’t count as an attempt')
      expect(useStore.getState().events).toEqual([])
      type('Next line', p.answer.path[0]!)
      click('Check this line')
      expect(accepted()).toHaveLength(1)
      type('Answer', '???')
      click('Check the answer')
      expect(screen.getByRole('alert').textContent).toContain('This doesn’t count as an attempt')
      expect(finals()).toEqual([])
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores the draft and the answer box',
    () => {
      const p = generateProblem(moduleId, templateId, 3)
      if (p.answer.type !== 'expLogEquations') throw new Error(templateId)
      const view = renderAt(problemPath(moduleId, templateId, 3))
      type('Next line', p.answer.path[0]!)
      click('Check this line')
      type('Answer', 'not yet')
      type('Next line', 'still typing')
      view.unmount()
      const stored = useStore.getState().attempt
      expect(stored?.steps).toHaveLength(1)
      expect(stored?.draft).toBe('still typing')
      expect(stored?.final?.polyEntries?.[EE_KEYS.answer]).toBe('not yet')
      renderAt(problemPath(moduleId, templateId, 3))
      expect(field('Next line').value).toBe('still typing')
      expect(field('Answer').value).toBe('not yet')
      expect(field('Answer').disabled).toBe(false)
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )
})

describe('a logarithmic line that lets an extra answer in', () => {
  it(
    'says to check the original, as a note, and does not record a mistake',
    () => {
      let found: ExpLogAnswer | null = null
      let seed = 0
      for (let n = 1; n <= 40 && !found; n++) {
        const p = generateProblem('expLogEquations', 'ee.logarithmic', n)
        if (p.answer.type !== 'expLogEquations') continue
        const line = p.answer.path[0]!
        const step = checkLogStep(p.answer.equation, line, { original: p.answer.equation, vars: ['x'], seed: n })
        if (step.ok && step.caveat === 'extraneous_check') {
          found = p.answer
          seed = n
        }
      }
      expect(found, 'a logarithmic seed whose first line brings in an extra answer').toBeTruthy()
      renderAt(problemPath('expLogEquations', 'ee.logarithmic', seed))
      type('Next line', found!.path[0]!)
      click('Check this line')
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.getByRole('status').textContent).toContain('Legal, but check your answers in the original.')
      expect(screen.getByRole('status').textContent).toMatch(/original|positive input|extraneous|check/i)
      expect(rejected()).toEqual([])
      expect(finals()).toEqual([])
      expect(accepted()).toHaveLength(1)
      expect(useStore.getState().events.some((e) => e.t === 'step_rejected' || (e.t === 'final_answer' && e.pattern === 'log_check_answers'))).toBe(false)
    },
    FLOW_TIMEOUT,
  )
})

describe('LogLineFlow hints', () => {
  it(
    'the third rung shows the next line and marks it shown',
    () => {
      const p = generateProblem('logProperties', 'lp.expand', 2)
      if (p.answer.type !== 'logProperties') throw new Error('expand')
      renderAt(problemPath('logProperties', 'lp.expand', 2))
      click('Nudge me')
      click('Show the rule')
      expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()
      expect(screen.queryByText('Next line', { selector: 'p' })).toBeNull()
      click(/Show the step/)
      expect(useStore.getState().attempt?.final).toMatchObject({ revealed: true, firstCorrect: false })
      expect(screen.getByText('Next line', { selector: 'p' })).toBeTruthy()
      click('Use this line')
      expect(accepted()).toMatchObject([{ revealed: true, firstTry: false }])
      expect(doneEvent()?.revealed).toBeGreaterThan(0)
    },
    FLOW_TIMEOUT,
  )
})

/** A one-step problem, ln(x) = k: the first line she writes is the solution. */
function oneLineSeed(): number {
  for (let seed = 1; seed < 600; seed++) {
    const a = generateProblem('expLogEquations', 'ee.logarithmic', seed).answer
    if (a.type === 'expLogEquations' && /^ln\(x\) = \d$/.test(a.equation)) return seed
  }
  throw new Error('no ln(x) = k in 600 seeds')
}

describe('ExpLogEquationsFlow, fixes from the review', () => {
  it(
    'a line that already is the solution goes into the answer box, and one wrong answer counts once',
    () => {
      const seed = oneLineSeed()
      const p = generateProblem('expLogEquations', 'ee.logarithmic', seed)
      if (p.answer.type !== 'expLogEquations') throw new Error('ee.logarithmic')
      renderAt(problemPath('expLogEquations', 'ee.logarithmic', seed))
      type('Next line', p.answer.path[0]!)
      click('Check this line')
      expect(accepted()).toHaveLength(1)
      expect(field('Answer').value.replace(/\s+/g, '')).toBe(p.answer.path[0]!.replace(/\s+/g, ''))
      // The composer offers the check where she is, until the box holds something else.
      expect(document.querySelector('[data-answer-ready]')!.textContent).toContain('Your last line is in the answer box.')
      // The same wrong answer twice, once with a trailing space, is one recorded attempt.
      type('Answer', 'x = 3')
      expect(document.querySelector('[data-answer-ready]')).toBeNull()
      click('Check the answer')
      type('Answer', 'x = 3 ')
      click('Check the answer')
      expect(finals()).toHaveLength(1)
      type('Answer', p.answer.answerText)
      click('Check the answer')
      expect(finals().at(-1)).toMatchObject({ correct: true })
      expect(doneEvent()).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    '"Check my answer" in the composer checks the line that went into the answer box, and finishes',
    () => {
      const seed = oneLineSeed()
      const p = generateProblem('expLogEquations', 'ee.logarithmic', seed)
      if (p.answer.type !== 'expLogEquations') throw new Error('ee.logarithmic')
      renderAt(problemPath('expLogEquations', 'ee.logarithmic', seed))
      expect(document.querySelector('[data-answer-ready]')).toBeNull()
      type('Next line', p.answer.path[0]!)
      click('Check this line')
      expect(screen.getByText(/It is in the answer box below\./)).toBeTruthy()
      click('Check my answer')
      expect(finals()).toMatchObject([{ correct: true }])
      expect(doneEvent()).toMatchObject({ finalCorrect: true })
      expect(document.querySelector('[data-answer-ready]')).toBeNull()
    },
    FLOW_TIMEOUT,
  )
})
