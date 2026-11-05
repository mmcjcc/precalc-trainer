// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { IonicBondingAnswer } from '@/content/types'
import { gradeIbStage, IB_KEYS } from '@/content/modules/ionicBonding'
import { answerLeaks } from '@/content/modules/ionicBonding/facts'
import { ERROR_PATTERNS } from '@/engine'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '../Problem'

const FLOW_TIMEOUT = 120_000
const TEMPLATES = ['ib.valence', 'ib.dots', 'ib.transfer', 'ib.props', 'mb.sea'] as const

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
  const p = generateProblem('ionicBonding', templateId, seed)
  if (p.answer.type !== 'ionicBonding') throw new Error(`${templateId}: not ionicBonding`)
  return { a: p.answer, path: problemPath('ionicBonding', templateId, seed) }
}

/** Every chapter 8 seed promises a trap; keep the walk anyway, in case a seed ever stops. */
function loadTrapped(templateId: string) {
  for (let seed = 1; seed <= 40; seed++) {
    const loaded = load(templateId, seed)
    if (loaded.a.trap) return loaded
  }
  throw new Error(`${templateId}: no promised trap in the first 40 seeds`)
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: label }), { target: { value } })
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

function radio(name: string): HTMLInputElement {
  return screen.getByRole('radio', { name: (text) => text === name }) as HTMLInputElement
}

function enter(stage: IonicBondingAnswer['stages'][number], value: string) {
  if (stage.kind === 'choice') fireEvent.click(radio(value))
  else type(stage.label, value)
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

function heading(a: IonicBondingAnswer, index: number): string {
  const stage = a.stages[index]!
  return a.stages.length > 1 ? `Part ${index + 1} of ${a.stages.length}: ${stage.label}` : stage.label
}

function walk(a: IonicBondingAnswer) {
  const trapAt = a.stages.findIndex((stage) => stage.id === a.trapStage)
  for (let i = 0; i < a.stages.length; i++) {
    const stage = a.stages[i]!
    expect(screen.getByRole('heading', { name: heading(a, i) })).toBeTruthy()
    const checkName = `Check ${stage.label}`
    if (i === trapAt && a.trap && a.trapAnswer) {
      const before = finals().length
      enter(stage, a.trapAnswer)
      click(checkName)
      const alert = screen.getByRole('alert')
      const info = ERROR_PATTERNS[a.trap]
      expect(alert.textContent).toContain(info.title)
      expect(alert.textContent).toContain(info.lesson)
      // The card blanks a wrong → right example that would show this part's answer (the reused
      // ec_ entry prints a bracketed core some ions have as their whole answer).
      const answers = [stage.answerText, ...(stage.accept ?? [])]
      if (answers.every((answer) => !answerLeaks(info.example, answer))) {
        expect(alert.textContent).toContain('Example:')
      } else {
        expect(alert.textContent).not.toContain('Example:')
      }
      const grade = gradeIbStage(a, stage.id, a.trapAnswer)
      if (grade.verdict !== 'mistake') throw new Error(`trap graded ${grade.verdict}`)
      expect(alert.textContent).toContain(grade.witness)
      expect(answerLeaks(alert.textContent ?? '', stage.answerText)).toBe(false)
      expect(finals()).toHaveLength(before + 1)
      expect(finals()[before]).toMatchObject({ correct: false, pattern: a.trap, via: 'text' })
      click(checkName)
      expect(finals()).toHaveLength(before + 1)
      expect(doneEvent()).toBeUndefined()
      enter(stage, stage.answerText)
      click(checkName)
    } else {
      enter(stage, stage.answerText)
      click(checkName)
    }
  }
  expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
  expect(doneEvent()).toMatchObject({ finalCorrect: false, revealed: 0 })
  expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'The answer, worked out' })).toBeTruthy()
  for (const line of a.reveal) expect(screen.getByText(line)).toBeTruthy()
}

describe.each(TEMPLATES)('IonicBondingFlow %s', (templateId) => {
  it(
    'names the promised mistake, then accepts the fix',
    () => {
      const { a, path } = loadTrapped(templateId)
      renderAt(path)
      expect(screen.getByText(a.prompt)).toBeTruthy()
      for (const stage of a.stages) expect(screen.queryByText(stage.reveal[0]!)).toBeNull()
      walk(a)
    },
    FLOW_TIMEOUT,
  )

  it(
    'an unreadable answer records nothing',
    () => {
      const { a, path } = load(templateId)
      renderAt(path)
      const stage = a.stages[0]!
      const checkName = `Check ${stage.label}`
      click(checkName)
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      if (stage.kind === 'text') {
        expect(field(stage.label).getAttribute('aria-invalid')).toBe('true')
        type(stage.label, '???')
        expect(screen.queryByRole('alert')).toBeNull()
        click(checkName)
        expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      }
      expect(useStore.getState().events).toEqual([])
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores her entries',
    () => {
      const { a, path } = load(templateId)
      const stage = a.stages[0]!
      const view = renderAt(path)
      if (stage.kind === 'choice') {
        const value = stage.choices?.[0]?.text
        if (!value) throw new Error('choice part has no options')
        enter(stage, value)
        view.unmount()
        expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [IB_KEYS[stage.id]]: value })
        renderAt(path)
        expect(radio(value).checked).toBe(true)
      } else {
        type(stage.label, 'not yet')
        view.unmount()
        expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [IB_KEYS[stage.id]]: 'not yet' })
        renderAt(path)
        expect(field(stage.label).value).toBe('not yet')
      }
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )
})

describe('IonicBondingFlow parts and hints', () => {
  it(
    'a finished first part is still there after a reload, and the next part is open',
    () => {
      const { a, path } = load('ib.valence', 1)
      const view = renderAt(path)
      type('Valence electrons', a.stages[0]!.answerText)
      click('Check Valence electrons')
      expect(screen.getByRole('heading', { name: heading(a, 1) })).toBeTruthy()
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyStage).toBe(1)
      renderAt(path)
      expect(field('Valence electrons').value).toBe(a.stages[0]!.answerText)
      expect(screen.getByRole('heading', { name: heading(a, 1) })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'the third hint shows the answer and marks it shown',
    () => {
      const { a, path } = load('ib.valence', 2)
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
