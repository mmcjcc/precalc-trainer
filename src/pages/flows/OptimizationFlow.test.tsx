// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { resetKeypadForTests } from '@/components/keypadStore'
import { installPointer, keypad, removePointer, tap, tapBox, typeOnKeypad } from '@/components/keypadTesting'
import { MathKeypad } from '@/components/MathKeypad'
import { answerForms, gradeOptPart, stagesFor } from '@/content/modules/optimization/parts'
import { pieces, plain, showsAnswer } from '@/content/modules/optimization/text'
import type { OptimizationAnswer, OptPart } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
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

/** The first seed from `from` up whose problem promises a slip and passes `ok`. */
function load(templateId: string, ok: (a: OptimizationAnswer) => boolean = () => true, from = 1) {
  for (let seed = from; seed < from + 300; seed++) {
    const p = generateProblem('optimization', templateId, seed)
    const a = p.answer as OptimizationAnswer
    if (a.trap && ok(a)) return { p, a, seed, path: problemPath('optimization', templateId, seed) }
  }
  throw new Error(`${templateId}: no seed found`)
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const field = (label: string) => screen.getByRole('textbox', { name: label }) as HTMLInputElement
const enter = (part: OptPart, value: string) => fireEvent.change(field(part.label), { target: { value } })

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
type EvOf<T extends string> = Extract<ReturnType<typeof events>[number], { t: T }>
const finals = () => events('final_answer') as EvOf<'final_answer'>[]
const doneEvent = () => events('problem_done')[0] as EvOf<'problem_done'> | undefined

beforeEach(() => {
  resetStoreForTests()
})

const TEMPLATES = ['opt.wall', 'opt.pens', 'opt.numbers', 'opt.revenue'] as const

describe.each(TEMPLATES)('%s on the screen', (templateId) => {
  it(
    'shows the problem in KaTeX (with its figure), names the promised mistake, takes the fix, records both, and completes',
    () => {
      const { p, a, path } = load(templateId)
      const view = renderAt(path)
      expect(screen.getByText(p.instructions)).toBeTruthy()
      for (const piece of pieces(a.prompt).filter((x) => !x.tex && x.text.trim().length > 3)) expect(view.container.textContent).toContain(piece.text.trim())
      expect(view.container.querySelectorAll('.katex').length).toBeGreaterThan(0)
      if (a.figure) expect(screen.getAllByRole('img', { name: a.figure.ariaLabel }).length).toBeGreaterThan(0)
      expect(screen.queryByRole('heading', { name: 'The answer, worked out' })).toBeNull()
      let named = false
      for (const [i, part] of a.stages.entries()) {
        expect(screen.getByRole('heading', { name: `Part ${i + 1} of 6: ${part.label}` })).toBeTruthy()
        if (a.stages[i + 1]) expect(screen.queryByRole('heading', { name: new RegExp(`^Part ${i + 2} of`) })).toBeNull()
        if (part.id === a.trapStage) {
          const before = finals().length
          enter(part, a.trapAnswer!)
          click('Check')
          const alert = screen.getByRole('alert')
          const info = ERROR_PATTERNS[a.trap!]
          expect(alert.textContent).toContain(info.title)
          expect(alert.textContent).toContain(info.lesson)
          expect(alert.textContent).toContain('Example:')
          const g = gradeOptPart(a, part, a.trapAnswer!)
          if (g.verdict !== 'mistake') throw new Error(`trap graded ${g.verdict}`)
          // The sentence about her work, its words on the card and its math drawn by KaTeX.
          for (const piece of pieces(g.witness).filter((x) => !x.tex && x.text.trim().length > 3)) expect(alert.textContent).toContain(piece.text.trim())
          expect(showsAnswer([plain(g.witness)], answerForms(part)), 'the card names the answer').toBe(false)
          expect(finals()).toHaveLength(before + 1)
          expect(finals()[before]).toMatchObject({ correct: false, pattern: a.trap, via: 'text' })
          // The same answer again is the same attempt.
          click('Check')
          expect(finals()).toHaveLength(before + 1)
          expect(doneEvent()).toBeUndefined()
          named = true
        }
        enter(part, part.answerText)
        click('Check')
        expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
      }
      expect(named).toBe(true)
      expect(doneEvent()).toMatchObject({ finalCorrect: false, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
      const worked = screen.getByRole('heading', { name: 'The answer, worked out' }).closest('section')!
      expect(worked.querySelectorAll('[data-worked-line]')).toHaveLength(a.reveal.length)
      expect(worked.querySelectorAll('.katex').length).toBeGreaterThan(0)
    },
    FLOW_TIMEOUT,
  )

  it(
    'an unreadable answer records nothing',
    () => {
      const { a, path } = load(templateId)
      const part = a.stages[0]!
      renderAt(path)
      click('Check')
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      expect(useStore.getState().events).toEqual([])
      expect(field(part.label).getAttribute('aria-invalid')).toBe('true')
      enter(part, '???')
      expect(screen.queryByRole('alert')).toBeNull()
      click('Check')
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      // An equation of the wrong kind for the box is a note too: the primary equation in the secondary box is named,
      // but an equation with the quantity that is not the primary is not an attempt.
      enter(part, `${a.quantity} = x + y + 1`)
      click('Check')
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      expect(useStore.getState().events).toEqual([])
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores her entries and the part she is on',
    () => {
      const { a, path } = load(templateId)
      const [first, second] = a.stages
      const view = renderAt(path)
      enter(first!, 'not yet')
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [first!.id]: 'not yet' })
      const again = renderAt(path)
      expect(field(first!.label).value).toBe('not yet')
      enter(first!, first!.answerText)
      click('Check')
      again.unmount()
      expect(useStore.getState().attempt?.final?.polyStage).toBe(1)
      renderAt(path)
      expect(field(first!.label).value).toBe(first!.answerText)
      expect(field(first!.label).disabled).toBe(true)
      expect(field(second!.label).value).toBe('')
      expect(screen.queryByRole('heading', { name: /^Part 3 of/ })).toBeNull()
    },
    FLOW_TIMEOUT,
  )
})

describe('the optimization screen', () => {
  it(
    'a final equation in y: parts 4 and 5 ask for y first, then x, and the worked lines follow her route',
    () => {
      const { a, path } = load('opt.wall')
      renderAt(path)
      const [s1, s2, s3] = a.stages
      for (const part of [s1!, s2!]) {
        enter(part, part.answerText)
        click('Check')
      }
      if (s3!.check.kind !== 'final') throw new Error('not a final part')
      enter(s3!, s3!.check.y)
      click('Check')
      const [yBest, yOther] = a.yStages
      expect(screen.getByRole('heading', { name: `Part 4 of 6: ${yBest!.label}` })).toBeTruthy()
      expect(yBest!.label).toBe('y')
      enter(yBest!, yBest!.answerText)
      click('Check')
      expect(screen.getByRole('heading', { name: `Part 5 of 6: ${yOther!.label}` })).toBeTruthy()
      enter(yOther!, yOther!.answerText)
      click('Check')
      enter(a.stages[5]!, a.stages[5]!.answerText)
      click('Check')
      expect(doneEvent()).toMatchObject({ finalCorrect: true })
      const worked = screen.getByRole('heading', { name: 'The answer, worked out' }).closest('section')!
      expect(worked.querySelectorAll('[data-worked-line]')).toHaveLength(stagesFor(a, 'y').flatMap((s) => s.reveal).length)
    },
    FLOW_TIMEOUT,
  )

  it(
    'the hint ladder: the nudge and the rule never show the answer; the third rung shows the worked lines and marks it shown',
    () => {
      const { a, path } = load('opt.pens')
      const part = a.stages[0]!
      const view = renderAt(path)
      const hints = () => screen.getByRole('heading', { name: 'Hints' }).closest('section')!
      click('Nudge me')
      click('Show the rule')
      expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()
      expect(showsAnswer([hints().textContent ?? ''], answerForms(part))).toBe(false)
      click(/Explain the answer/)
      expect(useStore.getState().attempt?.final).toMatchObject({ revealed: true, firstCorrect: false })
      expect(within(hints()).getAllByText((_, el) => el?.getAttribute('data-worked-line') !== null && el?.tagName === 'LI').length).toBe(part.reveal.length)
      expect(view.container.querySelectorAll('[data-worked-line] .katex').length).toBeGreaterThan(0)
      expect(finals()).toEqual([])
    },
    FLOW_TIMEOUT,
  )

  it(
    'the box reads her equation back in KaTeX, with the quantity’s letter as she wrote it',
    () => {
      const { a, path } = load('opt.wall')
      renderAt(path)
      enter(a.stages[0]!, a.stages[0]!.answerText)
      click('Check')
      enter(a.stages[1]!, 'a = x*y')
      const preview = screen.getByLabelText('Preview')
      expect(preview.querySelector('.katex')).not.toBeNull()
      expect(preview.textContent).toContain('A=xy')
    },
    FLOW_TIMEOUT,
  )

  it(
    'her worksheet slips on the screen: A = 2xy for three pens, then a and b swapped in −b/(2a), typed as she wrote it',
    () => {
      const pens = load('opt.pens', (a) => a.stages[1]!.traps.some((t) => t.text === 'A = 2xy') && /three/.test(a.prompt))
      const view = renderAt(pens.path)
      enter(pens.a.stages[0]!, pens.a.stages[0]!.answerText)
      click('Check')
      enter(pens.a.stages[1]!, 'A = 2xy')
      click('Check')
      expect(screen.getByRole('alert').textContent).toContain(ERROR_PATTERNS.opt_area_wrong_count.title)
      expect(finals().at(-1)).toMatchObject({ correct: false, pattern: 'opt_area_wrong_count' })
      view.unmount()
      resetStoreForTests()
      const pen = load('opt.wall')
      renderAt(pen.path)
      for (const part of pen.a.stages.slice(0, 3)) {
        enter(part, part.answerText)
        click('Check')
      }
      // −a/(2b) with this problem's a and b, as an expression: what her page had for the pigpen, −(−2)/(2·500).
      enter(pen.a.stages[3]!, `-(${pen.p.params.a})/(2*(${pen.p.params.b}))`)
      click('Check')
      expect(screen.getByRole('alert').textContent).toContain(ERROR_PATTERNS.opt_vertex_ab_swapped.title)
      expect(finals().at(-1)).toMatchObject({ correct: false, pattern: 'opt_vertex_ab_swapped' })
    },
    FLOW_TIMEOUT,
  )

  it(
    'on a phone the math keypad alone writes the equations: x, y and the letter of the quantity, =, x² and the digits',
    () => {
      installPointer(true)
      resetKeypadForTests()
      try {
        const { a, path } = load('opt.wall')
        render(
          <MemoryRouter initialEntries={[path]}>
            <MathKeypad />
            <Routes>
              <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
            </Routes>
          </MemoryRouter>,
        )
        const finish = (part: OptPart, typed: string) => {
          const box = field(part.label)
          expect(box.getAttribute('inputmode')).toBe('none')
          tapBox(box)
          expect(keypad()).toBeTruthy()
          expect(typeOnKeypad(typed)).toBeGreaterThan(0)
          tap('check')
          expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
        }
        finish(a.stages[0]!, a.stages[0]!.answerText)
        finish(a.stages[1]!, 'A = xy')
        if (a.stages[2]!.check.kind !== 'final') throw new Error('not final')
        finish(a.stages[2]!, a.stages[2]!.check.x)
      } finally {
        removePointer()
      }
    },
    FLOW_TIMEOUT,
  )
})
