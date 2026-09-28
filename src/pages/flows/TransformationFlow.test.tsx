// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem } from '@/content'
import { describeAsInputs, makeTransform, mappedPointMistakes, equationMistakes, unfactoredConstant } from '@/engine'
import { ratToString, type Rational } from '@/notation'
import type { RatLike } from '@/engine'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '../Problem'

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function finals() {
  return useStore.getState().events.filter((e) => e.t === 'final_answer')
}

function ratText(v: RatLike): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return ratToString(v as Rational)
}

function absAmount(n: number, d: number): string {
  return ratToString(n < 0 ? { n: -n, d } : { n, d })
}

function describeExample() {
  for (let seed = 1; seed <= 300; seed++) {
    const p = generateProblem('transformations', 'tr.describe', seed)
    if (p.answer.type !== 'transformations' || p.answer.trap !== 'unfactored' || p.answer.form !== 'unfactored') continue
    const spec = makeTransform(p.answer.parent, { a: p.answer.a, b: p.answer.b, h: p.answer.h, k: p.answer.k })
    if (spec.h.n <= 0 || spec.b.n <= 0) continue
    const steps = describeAsInputs(spec)
    const shift = steps.findIndex((s) => s.kind === 'shift' && (s.direction === 'right' || s.direction === 'left'))
    if (shift < 0) continue
    const c = unfactoredConstant(spec)
    return { seed, steps, shift, wrong: absAmount(c.n, c.d), nudge: p.answer.nudge, spec }
  }
  throw new Error('no unfactored describe seed')
}

function pointExample() {
  for (let seed = 1; seed <= 300; seed++) {
    const p = generateProblem('transformations', 'tr.point', seed)
    if (p.answer.type !== 'transformations' || p.answer.trap !== 'v-order' || !p.answer.imagePoint) continue
    const spec = makeTransform(p.answer.parent, { a: p.answer.a, b: p.answer.b, h: p.answer.h, k: p.answer.k })
    const hit = mappedPointMistakes(spec, { x: String(p.params.px), y: String(p.params.py) }, { form: p.answer.form })?.find((m) => m.kind === 'v_order')
    if (!hit) continue
    return { seed, wrong: hit.text, right: p.answer.imagePoint, witness: hit.witness }
  }
  throw new Error('no v-order point seed')
}

beforeEach(() => {
  resetStoreForTests()
})

describe('TransformationFlow', () => {
  it('builds the step cards, names the unfactored shift, restores them, then accepts the fix', () => {
    const ex = describeExample()
    const view = renderAt(problemPath('transformations', 'tr.describe', ex.seed))
    expect(screen.getByRole('heading', { name: 'Describe the transformations' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Show the graph' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show calculator steps' })).toBeNull()

    ex.steps.forEach((step) => {
      if (step.kind === 'shift') fireEvent.click(screen.getByRole('button', { name: 'Add a shift' }))
      else if (step.kind === 'scale') fireEvent.click(screen.getByRole('button', { name: 'Add a stretch or compress' }))
      else fireEvent.click(screen.getByRole('button', { name: 'Add a reflection' }))
    })
    ex.steps.forEach((step, i) => {
      const n = i + 1
      if (step.kind === 'shift') {
        fireEvent.change(screen.getByLabelText(`Direction for step ${n}`), { target: { value: step.direction } })
        const amount = i === ex.shift ? ex.wrong : ratText(step.amount)
        fireEvent.change(screen.getByLabelText(`Amount for step ${n}`), { target: { value: amount } })
      } else if (step.kind === 'scale') {
        fireEvent.change(screen.getByLabelText(`Word for step ${n}`), { target: { value: step.word } })
        fireEvent.change(screen.getByLabelText(`Scale axis for step ${n}`), { target: { value: step.axis } })
        fireEvent.change(screen.getByLabelText(`Factor for step ${n}`), { target: { value: ratText(step.factor) } })
      } else {
        fireEvent.change(screen.getByLabelText(`Reflection axis for step ${n}`), { target: { value: step.axis } })
      }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Factor the inside before you read the shift')
    expect(alert.textContent).toMatch(/→/)
    expect(screen.getByRole('list', { name: 'Step checks' }).textContent).toMatch(/Wrong|Missing|Extra/)
    expect(finals().some((e) => e.t === 'final_answer' && e.pattern === 'tr_unfactored_shift' && e.correct === false)).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Nudge me' }))
    expect(screen.getByText(ex.nudge)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show the rule' }))
    const hints = screen.getByRole('heading', { name: 'Hints' }).closest('section')!
    expect(within(hints).getByText('Factor the inside first')).toBeTruthy()

    view.unmount()
    renderAt(problemPath('transformations', 'tr.describe', ex.seed))
    expect((screen.getByLabelText(`Amount for step ${ex.shift + 1}`) as HTMLInputElement).value).toBe(ex.wrong)

    const right = ex.steps[ex.shift]
    if (right?.kind !== 'shift') throw new Error('shift')
    fireEvent.change(screen.getByLabelText(`Amount for step ${ex.shift + 1}`), { target: { value: ratText(right.amount) } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(finals().some((e) => e.t === 'final_answer' && e.correct === true)).toBe(true)
    const done = useStore.getState().events.find((e) => e.t === 'problem_done')
    expect(done).toMatchObject({ finalCorrect: false, revealed: 0 })
  }, 30_000)

  it('previews a point, names the vertical order mistake, and accepts the image', () => {
    const ex = pointExample()
    const view = renderAt(problemPath('transformations', 'tr.point', ex.seed))
    expect(screen.getByRole('heading', { name: 'Map a point' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Point on g'), { target: { value: ex.wrong } })
    expect(screen.getByText(/^reads as /).textContent).toMatch(/reads as /)
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('alert').textContent).toContain('Multiply y first, then shift')
    expect(screen.getByRole('alert').textContent).toContain(ex.witness.slice(0, 24))
    expect(finals()).toMatchObject([{ correct: false, pattern: 'tr_v_order', via: 'text' }])

    view.unmount()
    renderAt(problemPath('transformations', 'tr.point', ex.seed))
    expect((screen.getByLabelText('Point on g') as HTMLInputElement).value).toBe(ex.wrong)

    fireEvent.change(screen.getByLabelText('Point on g'), { target: { value: ex.right } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(finals()).toMatchObject([{ correct: false, pattern: 'tr_v_order' }, { correct: true }])
  }, 30_000)

  it('names a wrong equation and then accepts an equivalent formula', () => {
    let example: { seed: number; wrong: string; right: string } | null = null
    for (let seed = 1; seed <= 80 && !example; seed++) {
      const p = generateProblem('transformations', 'tr.equation', seed)
      if (p.answer.type !== 'transformations' || p.answer.trap !== 'unfactored') continue
      const spec = makeTransform(p.answer.parent, { a: p.answer.a, b: p.answer.b, h: p.answer.h, k: p.answer.k })
      const hit = equationMistakes(spec, { form: 'factored' })?.find((m) => m.kind === 'unfactored_shift')
      if (!hit) continue
      example = { seed, wrong: hit.text, right: p.answer.formula }
    }
    if (!example) throw new Error('no equation unfactored seed')
    renderAt(problemPath('transformations', 'tr.equation', example.seed))
    expect(screen.getByRole('heading', { name: 'Write the equation of g' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Formula for g(x)'), { target: { value: example.wrong } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('alert').textContent).toContain('Factor the inside before you read the shift')
    expect(finals().some((e) => e.t === 'final_answer' && e.pattern === 'tr_unfactored_shift')).toBe(true)
    fireEvent.change(screen.getByLabelText('Formula for g(x)'), { target: { value: example.right } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
  }, 30_000)
})
