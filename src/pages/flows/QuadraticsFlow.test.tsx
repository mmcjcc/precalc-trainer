// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { AnswerSpec } from '@/content/types'
import { ERROR_PATTERNS, squareMistakes, vertexMistakes } from '@/engine'
import { resetStoreForTests, useStore } from '@/store'
import { problemPath } from '@/problem/url'
import ProblemPage from '../Problem'

type QuadAnswer = Extract<AnswerSpec, { type: 'quadratics' }>

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

function find(templateId: string, pred: (a: QuadAnswer) => boolean): { seed: number; a: QuadAnswer } {
  for (let seed = 1; seed <= 300; seed++) {
    const p = generateProblem('quadratics', templateId, seed)
    if (p.answer.type === 'quadratics' && pred(p.answer)) return { seed, a: p.answer }
  }
  throw new Error(`no ${templateId} seed`)
}

function type(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

function choose(name: string) {
  fireEvent.click(screen.getByRole('radio', { name }))
}

function field(label: string | RegExp): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement
}

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
type EvOf<T extends string> = Extract<ReturnType<typeof events>[number], { t: T }>
const finals = () => events('final_answer') as EvOf<'final_answer'>[]
const rejected = () => events('step_rejected') as EvOf<'step_rejected'>[]
const accepted = () => events('step_accepted') as EvOf<'step_accepted'>[]
const doneEvent = () => events('problem_done')[0] as EvOf<'problem_done'> | undefined
const workedLines = () => within(screen.getByRole('list', { name: 'Worked steps' })).getAllByRole('listitem')
const graph = () => screen.queryByRole('img', { name: /Turning points/ })
const VALUE_BOX = /value$/

beforeEach(() => {
  resetStoreForTests()
})

describe('QuadraticsFlow: vertex form, line by line', () => {
  // a ≠ 1, so "took the number out of the parentheses without multiplying by a" is a live slip.
  const hit = find('cs.form', (a) => Boolean(squareMistakes(a.f)?.some((c) => c.kind === 'cs_constant_not_scaled' && c.shadows.length === 0)) && a.path.length === 6)
  const wrong = squareMistakes(hit.a.f)!.find((c) => c.kind === 'cs_constant_not_scaled')!
  const factored = hit.a.path[1]!.text
  const path = problemPath('quadratics', 'cs.form', hit.seed)

  it(
    'keeps a legal line, names the slip in the next one, then accepts vertex form and finishes',
    () => {
      renderAt(path)
      expect(screen.getByText(hit.a.prompt)).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'Your work' })).toBeTruthy()
      // No graph and no calculator before she finishes: nothing here can be opened early.
      expect(screen.queryByRole('heading', { name: 'Graph it' })).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Calculator' })).toBeNull()
      expect(graph()).toBeNull()
      expect(workedLines()).toHaveLength(1)
      expect(field('Next line').className).toContain('min-h-12')
      expect(screen.getByRole('button', { name: 'Check this line' }).className).toContain('min-h-12')

      type('Next line', factored)
      click('Check this line')
      expect(accepted()).toHaveLength(1)
      expect(accepted()[0]).toMatchObject({ firstTry: true, revealed: false })
      expect(workedLines()).toHaveLength(2)
      expect(field('Next line').value).toBe('')
      expect(screen.getByText(/This line is still equal to f\(x\)\./)).toBeTruthy()
      expect(doneEvent()).toBeUndefined()

      type('Next line', wrong.text)
      click('Check this line')
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_cs_constant_not_scaled.title)
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_cs_constant_not_scaled.lesson)
      expect(alert.textContent).toContain(wrong.witness)
      expect(alert.textContent).toContain('Example:')
      expect(rejected()).toMatchObject([{ pattern: 'poly_cs_constant_not_scaled', stepIdx: 1 }])
      expect(workedLines()).toHaveLength(2)
      // The worked explanation holds the answer: it is not shown beside a mistake she can still fix.
      expect(screen.queryByRole('region', { name: 'How it works out' })).toBeNull()
      expect(screen.queryByRole('region', { name: 'Worked explanation' })).toBeNull()

      // The same wrong line again is not a second try.
      click('Check this line')
      expect(rejected()).toHaveLength(1)

      click('Nudge me')
      expect(screen.getByText(hit.a.nudge)).toBeTruthy()
      click('Show the rule')
      const hints = screen.getByRole('heading', { name: 'Hints' }).closest('section')!
      expect(within(hints).getByText('What leaves the parentheses is multiplied by a')).toBeTruthy()
      expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()

      type('Next line', hit.a.vertexForm)
      click('Check this line')
      expect(accepted()).toHaveLength(2)
      expect(accepted()[1]).toMatchObject({ firstTry: false, revealed: false })
      expect(finals()).toEqual([])
      expect(doneEvent()).toMatchObject({ steps: 2, firstTryRate: 0.5, revealed: 0, finalCorrect: true })
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
      expect(workedLines()).toHaveLength(3)
      expect(screen.queryByLabelText('Next line')).toBeNull()
      for (const line of hit.a.reveal) expect(screen.getByText(line)).toBeTruthy()
      // Now, and only now, the parabola with its vertex.
      expect(graph()).toBeTruthy()
      expect(graph()!.getAttribute('aria-label')).toContain(hit.a.vertexText.replace(/-/g, '−'))
      expect(screen.getByRole('heading', { name: 'The graph of f' })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'an unreadable line, or the line above typed again, records nothing; a plain wrong line is one rejection',
    () => {
      renderAt(path)
      type('Next line', `${hit.a.vertexForm} +`)
      click('Check this line')
      let alert = screen.getByRole('alert')
      expect(alert.textContent).toContain('This doesn’t count as an attempt')
      expect(alert.textContent).toContain('something is missing after the last operator')
      expect(useStore.getState().events.filter((e) => e.t !== 'hint')).toEqual([])
      expect(workedLines()).toHaveLength(1)

      // The notice goes as soon as she edits the line.
      type('Next line', hit.a.f)
      expect(screen.queryByRole('alert')).toBeNull()
      click('Check this line')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain('This doesn’t count as an attempt')
      expect(alert.textContent).toContain('the line above, written again')
      expect(useStore.getState().events).toEqual([])
      expect(workedLines()).toHaveLength(1)

      type('Next line', 'x + 1')
      click('Check this line')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain('Not quite')
      expect(alert.textContent).toContain('This line is not equal to f(x) any more')
      expect(rejected()).toHaveLength(1)
      expect(rejected()[0]!.pattern).toBeUndefined()
      expect(accepted()).toEqual([])
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )

  it(
    'restores her accepted lines and the line she was typing after a reload, and Undo takes a line back',
    () => {
      const view = renderAt(path)
      type('Next line', factored)
      click('Check this line')
      type('Next line', '2(x')
      view.unmount()
      const stored = useStore.getState().attempt
      expect(stored?.steps.map((s) => s.text)).toEqual([factored])
      expect(stored?.draft).toBe('2(x')

      renderAt(path)
      expect(workedLines()).toHaveLength(2)
      expect(field('Next line').value).toBe('2(x')

      click('Undo step 1')
      expect(workedLines()).toHaveLength(1)
      expect(field('Next line').value).toBe(factored)
      expect(events('step_undone')).toHaveLength(1)

      type('Next line', `f(x) = ${hit.a.vertexForm}`)
      click('Check this line')
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
      expect(doneEvent()).toMatchObject({ steps: 1, firstTryRate: 1, finalCorrect: true, revealed: 0 })
    },
    FLOW_TIMEOUT,
  )

  it(
    'the third hint rung shows the worked path and marks the attempt as shown',
    () => {
      renderAt(path)
      click('Nudge me')
      click('Show the rule')
      click(/^Explain the answer/)
      const hints = screen.getByRole('heading', { name: 'Hints' }).closest('section')!
      for (const line of hit.a.reveal) expect(within(hints).getByText(line)).toBeTruthy()
      expect(useStore.getState().attempt?.final).toMatchObject({ revealed: true, firstCorrect: false })
      expect(graph()).toBeNull()

      type('Next line', hit.a.vertexForm)
      click('Check this line')
      expect(accepted()).toMatchObject([{ revealed: true, firstTry: false }])
      expect(doneEvent()!.revealed).toBeGreaterThan(0)
      expect(doneEvent()!.firstTryRate).toBe(0)
    },
    FLOW_TIMEOUT,
  )
})

describe('QuadraticsFlow: vertex, axis, direction, value', () => {
  const hit = find('cs.vertex', (a) => Boolean(vertexMistakes(a.f)?.some((c) => c.kind === 'cs_h_sign')))
  const wrong = vertexMistakes(hit.a.f)!.find((c) => c.kind === 'cs_h_sign')!
  const path = problemPath('quadratics', 'cs.vertex', hit.seed)

  function fill(vertex: string) {
    type('Vertex', vertex)
    type('Axis of symmetry', hit.a.axisText)
    choose(hit.a.opens)
    choose(hit.a.extremumKind)
    type(VALUE_BOX, hit.a.extremumText)
  }

  it(
    'names the sign slip in the vertex, then accepts the fix, records both, and shows the graph',
    () => {
      renderAt(path)
      expect(screen.getByText(hit.a.prompt)).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'Your answers' })).toBeTruthy()
      // The calculator check is offered (behind its own gate); the graph is not there at all yet.
      expect(screen.getByRole('heading', { name: 'Calculator' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Show calculator steps' })).toBeTruthy()
      expect(screen.queryByText(/Analyze Graph|2nd/)).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Graph it' })).toBeNull()
      expect(graph()).toBeNull()
      for (const el of document.querySelectorAll('input')) expect(el.type).not.toBe('number')
      for (const label of ['Vertex', 'Axis of symmetry', VALUE_BOX]) expect(field(label).className).toContain('min-h-12')
      for (const name of ['up', 'down', 'minimum', 'maximum']) expect(screen.getByRole('radio', { name }).closest('label')!.className).toContain('min-h-11')
      expect(screen.getByRole('group', { name: 'The parabola opens' })).toBeTruthy()

      fill(wrong.text)
      expect(field(VALUE_BOX).labels![0]!.textContent).toBe(hit.a.extremumKind === 'minimum' ? 'Minimum value' : 'Maximum value')
      click('Check answers')
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_cs_h_sign.title)
      expect(alert.textContent).toContain(wrong.witness)
      expect(alert.textContent).toContain('Example:')
      expect(screen.getAllByRole('status').filter((el) => el.textContent?.includes('Correct:'))).toHaveLength(3)
      expect(finals()).toMatchObject([{ correct: false, pattern: 'poly_cs_h_sign', via: 'text' }])
      expect(screen.queryByRole('region', { name: 'How it works out' })).toBeNull()

      click('Check answers')
      expect(finals()).toHaveLength(1)

      click('Nudge me')
      expect(screen.getByText(hit.a.nudge)).toBeTruthy()
      click('Show the rule')
      const hints = screen.getByRole('heading', { name: 'Hints' }).closest('section')!
      expect(within(hints).getByText('Read the vertex from a(x − h)^2 + k')).toBeTruthy()

      type('Vertex', hit.a.vertexText)
      click('Check answers')
      expect(finals()).toMatchObject([{ correct: false, pattern: 'poly_cs_h_sign' }, { correct: true }])
      expect(doneEvent()).toMatchObject({ finalCorrect: false, firstTryRate: 0, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
      expect(screen.queryByRole('alert')).toBeNull()
      for (const line of hit.a.reveal) expect(screen.getByText(line)).toBeTruthy()
      expect(field('Vertex').disabled).toBe(true)
      expect((screen.getByRole('radio', { name: hit.a.opens }) as HTMLInputElement).disabled).toBe(true)
      expect(graph()).toBeTruthy()
      expect(graph()!.getAttribute('aria-label')).toContain(hit.a.vertexText.replace(/-/g, '−'))
    },
    FLOW_TIMEOUT,
  )

  it(
    'an unreadable or missing box is not an attempt: nothing is recorded and nothing is marked',
    () => {
      renderAt(path)
      click('Check answers')
      let alert = screen.getByRole('alert')
      expect(alert.textContent).toContain('This doesn’t count as an attempt')
      expect(alert.textContent).toContain('Vertex: ')
      expect(alert.textContent).toContain('Direction: Choose whether the parabola opens up or down.')
      expect(finals()).toEqual([])

      fill(hit.a.vertexText)
      // Typing clears the notice.
      expect(screen.queryByRole('alert')).toBeNull()
      type('Axis of symmetry', 'y = 3')
      click('Check answers')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain('This doesn’t count as an attempt')
      expect(alert.textContent).toContain('Axis of symmetry: ')
      expect(alert.textContent).toContain('vertical line')
      expect(field('Axis of symmetry').getAttribute('aria-invalid')).toBe('true')
      expect(screen.queryAllByRole('status').filter((el) => el.textContent?.includes('Correct:'))).toHaveLength(0)
      expect(finals()).toEqual([])
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )

  it(
    'restores every box after a reload',
    () => {
      const view = renderAt(path)
      fill(hit.a.vertexText)
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyEntries).toEqual({
        vertex: hit.a.vertexText,
        axis: hit.a.axisText,
        opens: hit.a.opens,
        extremumKind: hit.a.extremumKind,
        extremumValue: hit.a.extremumText,
      })

      renderAt(path)
      expect(field('Vertex').value).toBe(hit.a.vertexText)
      expect(field('Axis of symmetry').value).toBe(hit.a.axisText)
      expect((screen.getByRole('radio', { name: hit.a.opens }) as HTMLInputElement).checked).toBe(true)
      expect((screen.getByRole('radio', { name: hit.a.extremumKind }) as HTMLInputElement).checked).toBe(true)
      expect(field(VALUE_BOX).value).toBe(hit.a.extremumText)

      click('Check answers')
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
      expect(finals()).toMatchObject([{ correct: true }])
      expect(doneEvent()).toMatchObject({ finalCorrect: true, firstTryRate: 1, revealed: 0 })
    },
    FLOW_TIMEOUT,
  )
})
