// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { SC_KEYS, canonicalEntries, gradeScStage, type SignChartsAnswer, type ScStageId } from '@/content/modules/signCharts'
import { ERROR_PATTERNS } from '@/engine'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '../Problem'

const FLOW_TIMEOUT = 120_000

const BOX: Record<ScStageId, { label: string; check: string }> = {
  critical: { label: 'Critical numbers', check: 'Check the critical numbers' },
  signs: { label: 'Signs', check: 'Check the signs' },
  solution: { label: 'Solution set', check: 'Check the solution' },
}

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
  const p = generateProblem('signCharts', templateId, seed)
  if (p.answer.type !== 'signCharts') throw new Error(`${templateId}: not a sign chart`)
  return { p, a: p.answer, path: problemPath('signCharts', templateId, seed) }
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

function signButtons(): HTMLButtonElement[] {
  return screen.getAllByRole('button', { name: /^Sign on / }) as HTMLButtonElement[]
}

/** Click each sign until it shows the target. Stored text is "+ - -", which grades the same as "+, -, -". */
function setSigns(target: string) {
  const want = target
    .replace(/[−–—]/g, '-')
    .split(/[\s,]+/)
    .filter((part) => part.length > 0)
  const buttons = signButtons()
  expect(buttons).toHaveLength(want.length)
  for (let i = 0; i < want.length; i++) {
    const goal = want[i] === '+' ? '+' : '−'
    let guard = 0
    while ((buttons[i]!.textContent ?? '').trim() !== goal) {
      fireEvent.click(buttons[i]!)
      guard++
      if (guard > 4) throw new Error(`could not set sign ${i} to ${goal}`)
    }
  }
}

function enter(id: ScStageId, value: string) {
  if (id === 'signs') setSigns(value)
  else type(BOX[id].label, value)
}

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
type EvOf<T extends string> = Extract<ReturnType<typeof events>[number], { t: T }>
const finals = () => events('final_answer') as EvOf<'final_answer'>[]
const doneEvent = () => events('problem_done')[0] as EvOf<'problem_done'> | undefined
const graph = () => screen.queryByRole('img', { name: /^Graph of/ })
const NOT_AN_ATTEMPT = 'This doesn\u2019t count as an attempt'

beforeEach(() => {
  resetStoreForTests()
})

function walk(a: SignChartsAnswer) {
  const right = canonicalEntries(a)
  let seenMistake = false
  for (let i = 0; i < a.stages.length; i++) {
    const stage = a.stages[i]!
    const box = BOX[stage.id]
    const heading = a.stages.length > 1 ? `Part ${i + 1} of ${a.stages.length}: ${box.label}` : box.label
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
    if (stage.id === a.trapStage) {
      const before = finals().length
      enter(stage.id, a.trapAnswer)
      click(box.check)
      const alert = screen.getByRole('alert')
      const info = ERROR_PATTERNS[a.trap]
      expect(alert.textContent).toContain(info.title)
      expect(alert.textContent).toContain(info.lesson)
      expect(alert.textContent).toContain('Example:')
      const entered = stage.id === 'signs' ? a.trapAnswer.replace(/,/g, ' ').replace(/\s+/g, ' ').trim() : a.trapAnswer
      const grade = gradeScStage(a, stage.id, entered)
      if (grade.verdict !== 'mistake') throw new Error(`trap graded ${grade.verdict}`)
      expect(grade.mistake).toBe(a.trap)
      expect(alert.textContent).toContain(grade.witness)
      expect(finals()).toHaveLength(before + 1)
      expect(finals()[before]).toMatchObject({ correct: false, pattern: a.trap, via: 'text' })
      click(box.check)
      expect(finals()).toHaveLength(before + 1)
      expect(graph()).toBeNull()
      expect(doneEvent()).toBeUndefined()
      expect(screen.queryByRole('heading', { name: 'The graph' })).toBeNull()
      seenMistake = true
    }
    enter(stage.id, right[SC_KEYS[stage.id]] ?? '')
    click(box.check)
    expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
  }
  expect(seenMistake).toBe(true)
  expect(doneEvent()).toMatchObject({ finalCorrect: false, revealed: 0 })
  expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'The answer, worked out' })).toBeTruthy()
  for (const line of a.reveal) expect(screen.getByText(line)).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'The graph' })).toBeTruthy()
  expect(graph()).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Graph it' })).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Calculator' })).toBeNull()
}

describe.each([
  ['sc.poly', 'Solve the inequality and give the solution set.', 'Solve the inequality.'],
  ['sc.rational', 'Solve the inequality and give the solution set.', 'Solve the inequality.'],
  ['sc.chart', 'Give the critical numbers, the sign on each interval, and the solution set.', 'Solve the inequality.'],
] as const)('SignChartsFlow %s', (templateId, instructions, prompt) => {
  it(
    'names the promised mistake, then accepts the fix, records both, and draws the graph only at the end',
    () => {
      const { a, path } = load(templateId)
      renderAt(path)
      expect(screen.getByText(instructions)).toBeTruthy()
      expect(screen.getByText(prompt)).toBeTruthy()
      expect(graph()).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Graph it' })).toBeNull()
      expect(screen.queryByRole('heading', { name: 'The graph' })).toBeNull()
      expect(screen.queryByText(a.reveal[0]!)).toBeNull()
      expect(screen.queryByRole('region', { name: 'Worked explanation' })).toBeNull()
      if (templateId === 'sc.chart') {
        expect(screen.queryByRole('heading', { name: /Signs/ })).toBeNull()
        click('Nudge me')
        expect(screen.getByText(a.stages[0]!.nudge)).toBeTruthy()
        expect(screen.queryByText(a.reveal[0]!)).toBeNull()
        click('Show the rule')
        expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()
        expect(screen.queryByText(a.reveal[0]!)).toBeNull()
      }
      walk(a)
    },
    FLOW_TIMEOUT,
  )

  it(
    'an unreadable answer records nothing',
    () => {
      const { a, path } = load(templateId)
      const box = BOX[a.stages[0]!.id]
      renderAt(path)
      click(box.check)
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      if (a.stages[0]!.id !== 'signs') expect(field(box.label).getAttribute('aria-invalid')).toBe('true')
      expect(useStore.getState().events).toEqual([])
      if (a.stages[0]!.id !== 'signs') {
        type(box.label, '???')
        expect(screen.queryByRole('alert')).toBeNull()
        click(box.check)
        expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      }
      expect(useStore.getState().events).toEqual([])
      expect(graph()).toBeNull()
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores the entry, and the graph is still hidden',
    () => {
      const { a, path } = load(templateId)
      const box = BOX[a.stages[0]!.id]
      const key = SC_KEYS[a.stages[0]!.id]
      const view = renderAt(path)
      type(box.label, 'not yet')
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [key]: 'not yet' })
      const again = renderAt(path)
      expect(field(box.label).value).toBe('not yet')
      expect(graph()).toBeNull()
      if (a.stages.length > 1) {
        const right = canonicalEntries(a)
        type(box.label, right[key] ?? '')
        click(box.check)
        again.unmount()
        expect(useStore.getState().attempt?.final?.polyStage).toBe(1)
        renderAt(path)
        expect(field(box.label).value).toBe(right[key])
        expect(field(box.label).disabled).toBe(true)
        expect(signButtons().length).toBeGreaterThan(0)
        expect(signButtons().every((button) => button.textContent === '·')).toBe(true)
        expect(graph()).toBeNull()
        expect(screen.queryByRole('heading', { name: /Part 3 of/ })).toBeNull()
      }
    },
    FLOW_TIMEOUT,
  )
})

describe('SignChartsFlow signs', () => {
  it(
    'the sign row is 44 px buttons and moves with the keyboard',
    () => {
      const { a, path } = load('sc.chart')
      renderAt(path)
      const critical = BOX.critical
      type(critical.label, canonicalEntries(a).critical ?? '')
      click(critical.check)
      const buttons = signButtons()
      expect(buttons.length).toBe(a.intervals.length)
      for (const button of buttons) {
        expect(button.style.width).toBe('44px')
        expect(button.style.height).toBe('44px')
      }
      buttons[0]!.focus()
      fireEvent.keyDown(buttons[0]!, { key: 'ArrowRight' })
      expect(document.activeElement).toBe(buttons[1] ?? buttons[0])
      const target = buttons.length > 1 ? buttons[1]! : buttons[0]!
      fireEvent.keyDown(target, { key: 'Enter' })
      expect(target.textContent).toBe('+')
      fireEvent.keyDown(target, { key: ' ' })
      expect(target.textContent).toBe('−')
      fireEvent.keyDown(target, { key: 'ArrowLeft' })
      if (buttons.length > 1) expect(document.activeElement).toBe(buttons[0])
      const before = useStore.getState().events.length
      click(BOX.signs.check)
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      expect(useStore.getState().events).toHaveLength(before)
    },
    FLOW_TIMEOUT,
  )
})

describe('SignChartsFlow hints', () => {
  it(
    'the third hint shows the answer and marks it shown',
    () => {
      const { a, path } = load('sc.poly', 2)
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
      expect(graph()).toBeNull()
      expect(useStore.getState().events.filter((e) => e.t === 'final_answer')).toEqual([])
    },
    FLOW_TIMEOUT,
  )
})
