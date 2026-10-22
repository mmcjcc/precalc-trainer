// @vitest-environment jsdom
/**
 * Unit 5 on the screen (TrigFlow): graphs of sine and cosine, of the other four, the inverse functions. Per template:
 * the given equation in KaTeX, the promised mistake named (title, lesson, the sentence about her answer) and recorded
 * once, the fix, completion with the worked lines; an unreadable answer records nothing; a reload restores her entries
 * and the part she is on; the Check button keeps its chunky class. Then what the screen shows and hides: the graph she
 * reads and the four cards as the problem, every other graph behind the Graph panel's gate, Graph it only behind the
 * gates and never for sg.equation, og.match or a model, the TI-84 steps behind their button, the reference triangle's
 * side only once she has found it, the No value button, the three hint rungs, the inverse keys.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { answerForms, gradeTrigPart } from '@/content/modules/trig/parts'
import { pieces, plain, showsNumber } from '@/content/modules/trig/text'
import type { TrigAnswer, TrigPart } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { problemPath } from '@/problem/url'
import type { ModuleId } from '@/shared/types'
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
function load(module: ModuleId, templateId: string, ok: (a: TrigAnswer) => boolean = () => true, from = 1) {
  for (let seed = from; seed < from + 600; seed++) {
    const p = generateProblem(module, templateId, seed)
    const a = p.answer as TrigAnswer
    if (a.trap && ok(a)) return { p, a, seed, path: problemPath(module, templateId, seed) }
  }
  throw new Error(`${templateId}: none found`)
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const field = (label: string) => screen.getByRole('textbox', { name: label }) as HTMLInputElement
const choiceLabel = (part: TrigPart, value: string) => part.choices!.find((c) => c.value === value)!.label

/** Her answer to a part: a radio for a choice, the button for no value, else typed. */
function answer(part: TrigPart, value: string) {
  if (part.kind === 'choice') fireEvent.click(screen.getByRole('radio', { name: choiceLabel(part, value) }))
  else if (part.noValue && value === 'no value') return click('No value')
  else fireEvent.change(field(part.label), { target: { value } })
  click('Check')
}

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
type EvOf<T extends string> = Extract<ReturnType<typeof events>[number], { t: T }>
const finals = () => events('final_answer') as EvOf<'final_answer'>[]
const doneEvent = () => events('problem_done')[0] as EvOf<'problem_done'> | undefined
const graphItButtons = () => screen.queryAllByRole('button', { name: /^Graph it/ })

beforeEach(() => {
  resetStoreForTests()
})

const TEMPLATES = [
  ['sinusoids', 'sg.features'],
  ['sinusoids', 'sg.equation'],
  ['sinusoids', 'sg.model'],
  ['otherTrigGraphs', 'og.features'],
  ['otherTrigGraphs', 'og.match'],
  ['inverseTrig', 'it.evaluate'],
  ['inverseTrig', 'it.compose'],
] as const

describe.each(TEMPLATES)('%s %s on the screen', (module, templateId) => {
  it(
    'shows the problem in KaTeX, names the promised mistake, takes the fix, records both, and completes',
    () => {
      const { p, a, path } = load(module, templateId)
      const view = renderAt(path)
      expect(screen.getByText(p.instructions)).toBeTruthy()
      for (const piece of pieces(a.prompt).filter((x) => !x.tex && x.text.trim().length > 3)) expect(view.container.textContent).toContain(piece.text.trim())
      if (a.display) expect(view.container.querySelector('[data-trig-display] .katex, .katex')).not.toBeNull()
      let named = false
      for (const [i, part] of a.stages.entries()) {
        expect(screen.getByRole('heading', { name: a.stages.length > 1 ? `Part ${i + 1} of ${a.stages.length}: ${part.label}` : part.label })).toBeTruthy()
        if (part.id === a.trapStage) {
          const before = finals().length
          answer(part, a.trapAnswer!)
          const alert = screen.getByRole('alert')
          const info = ERROR_PATTERNS[a.trap!]
          expect(alert.textContent).toContain(info.title)
          expect(alert.textContent).toContain(info.lesson)
          const g = gradeTrigPart(part, a.trapAnswer!)
          if (g.verdict !== 'mistake') throw new Error(`trap graded ${g.verdict}`)
          expect(alert.textContent).toContain(plain(g.witness))
          expect(showsNumber([alert.textContent ?? ''], answerForms(part)), 'the card names the answer').toBe(false)
          expect(finals()).toHaveLength(before + 1)
          expect(finals()[before]).toMatchObject({ correct: false, pattern: a.trap })
          // The same answer checked again is not a second record.
          click('Check')
          expect(finals()).toHaveLength(before + 1)
          named = true
        }
        answer(part, part.answerText)
        expect(finals().at(-1)).toMatchObject({ correct: true })
      }
      expect(named).toBe(true)
      expect(doneEvent()).toMatchObject({ finalCorrect: false, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
      const worked = screen.getByRole('heading', { name: 'The answer, worked out' }).closest('section')!
      expect(worked.querySelectorAll('[data-worked-line]')).toHaveLength(a.reveal.length)
    },
    FLOW_TIMEOUT,
  )

  it(
    'an unreadable answer records nothing',
    () => {
      const { a, path } = load(module, templateId)
      const part = a.stages[0]!
      renderAt(path)
      click('Check')
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      if (part.kind !== 'choice') {
        fireEvent.change(field(part.label), { target: { value: '???' } })
        click('Check')
        expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
        expect(field(part.label).getAttribute('aria-invalid')).toBe('true')
      }
      expect(useStore.getState().events).toEqual([])
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores her entries and the part she is on; the Check button stays chunky',
    () => {
      const { a, path } = load(module, templateId)
      const part = a.stages[0]!
      const view = renderAt(path)
      expect(screen.getByRole('button', { name: 'Check' }).className).toContain('btn-chunky')
      const draft = part.kind === 'choice' ? part.choices!.find((c) => c.value !== part.answerText)!.value : 'not yet'
      if (part.kind === 'choice') fireEvent.click(screen.getByRole('radio', { name: choiceLabel(part, draft) }))
      else fireEvent.change(field(part.label), { target: { value: draft } })
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [part.id]: draft })
      const again = renderAt(path)
      if (part.kind === 'choice') expect((screen.getByRole('radio', { name: choiceLabel(part, draft) }) as HTMLInputElement).checked).toBe(true)
      else expect(field(part.label).value).toBe(draft)
      const second = a.stages[1]
      if (second) {
        answer(part, part.answerText)
        again.unmount()
        expect(useStore.getState().attempt?.final?.polyStage).toBe(1)
        renderAt(path)
        expect(screen.getByRole('heading', { name: `Part 2 of ${a.stages.length}: ${second.label}` })).toBeTruthy()
        if (second.kind !== 'choice') expect(field(second.label).value).toBe('')
        expect(screen.getByRole('button', { name: 'Check' }).className).toContain('btn-chunky')
      }
    },
    FLOW_TIMEOUT,
  )
})

describe('the graphs she reads, and the ones behind the gate', () => {
  it(
    'sg.equation from a graph: the graph is the problem, with its two labelled points and nothing else; no Graph it anywhere',
    () => {
      const { a, path } = load('sinusoids', 'sg.equation', (x) => x.figure.kind === 'graph')
      const view = renderAt(path)
      const graph = view.container.querySelector('[data-trig-graph]')!
      expect(graph).not.toBeNull()
      const labels = [...graph.querySelectorAll('[data-trig="marker-label"]')].map((t) => t.textContent)
      expect(labels).toEqual(a.figure.graph!.markers!.map((mk) => mk.label))
      expect(graph.getAttribute('aria-label')).not.toMatch(/cos|sin|period|amplitude/)
      // There is no graph behind a gate (the graph is the problem), and Graph it is never offered.
      expect(screen.queryByRole('button', { name: 'Show the graph' })).toBeNull()
      expect(graphItButtons()).toEqual([])
      click('Show calculator steps')
      expect(graphItButtons()).toEqual([])
    },
    FLOW_TIMEOUT,
  )

  it(
    'og.match: four graphs named only by their letters, a radio for each, and no Graph it',
    () => {
      const { a, path } = load('otherTrigGraphs', 'og.match')
      const view = renderAt(path)
      const cards = view.container.querySelectorAll('[data-trig="match"] > figure')
      expect(cards).toHaveLength(4)
      ;['A', 'B', 'C', 'D'].forEach((l, i) => {
        expect(within(cards[i] as HTMLElement).getByText(`Graph ${l}`)).toBeTruthy()
        expect(cards[i]!.querySelector('svg')!.getAttribute('aria-label')).toBe(`Graph ${l}`)
        expect(screen.getByRole('radio', { name: `Graph ${l}` })).toBeTruthy()
      })
      expect(view.container.querySelectorAll('[data-trig="match"] [data-trig="asymptote"]').length > 0).toBe(!/sin|cos/.test(a.display!.replace(/\\(?:sec|csc)/g, '')))
      expect(graphItButtons()).toEqual([])
    },
    FLOW_TIMEOUT,
  )

  it(
    'sg.features: no graph on the page until she opens the gate; then the wave, and Graph it for the given function only',
    () => {
      const { path } = load('sinusoids', 'sg.features')
      const view = renderAt(path)
      expect(view.container.querySelector('[data-trig-graph]')).toBeNull()
      expect(graphItButtons()).toEqual([])
      click('Show the graph')
      expect(view.container.querySelector('[data-trig-graph]')).not.toBeNull()
      const buttons = graphItButtons()
      expect(buttons).toHaveLength(1)
      expect(buttons[0]!.getAttribute('aria-label')).toMatch(/^Graph it: open .+ in the grapher$/)
    },
    FLOW_TIMEOUT,
  )

  it(
    'a model: its graph behind the gate, and no Graph it (the model is her answer)',
    () => {
      const { path } = load('sinusoids', 'sg.model')
      const view = renderAt(path)
      click('Show the graph')
      expect(view.container.querySelector('[data-trig-graph]')).not.toBeNull()
      click('Show calculator steps')
      expect(graphItButtons()).toEqual([])
    },
    FLOW_TIMEOUT,
  )

  it(
    'the TI-84 steps sit behind their button: RADIAN mode only once she asks',
    () => {
      const { path } = load('otherTrigGraphs', 'og.features')
      renderAt(path)
      expect(screen.queryByText(/Set the angle mode to RADIAN/)).toBeNull()
      click('Show calculator steps')
      expect(screen.getAllByText(/Set the angle mode to RADIAN/).length).toBeGreaterThan(0)
    },
    FLOW_TIMEOUT,
  )
})

describe('the inverse functions on the screen', () => {
  it(
    'an input with no angle: the prompt never names the button; No value finishes it, a number is the named mistake',
    () => {
      const { a, path } = load('inverseTrig', 'it.evaluate', (x) => x.stages[0]!.answerText === 'no value')
      const view = renderAt(path)
      expect(view.container.textContent).toContain('No value')
      for (const text of [a.prompt, a.stages[0]!.ask, a.stages[0]!.formatHint]) expect(plain(text)).not.toMatch(/no value/i)
      answer(a.stages[0]!, a.trapAnswer!)
      expect(finals().at(-1)).toMatchObject({ correct: false, pattern: 'trig_inverse_outside_domain' })
      click('No value')
      expect(finals().at(-1)).toMatchObject({ correct: true })
      expect(doneEvent()).toBeDefined()
    },
    FLOW_TIMEOUT,
  )

  it(
    'an input with an angle: No value is wrong, and says there is one',
    () => {
      const { a, path } = load('inverseTrig', 'it.evaluate', (x) => x.stages[0]!.answerText !== 'no value' && x.stages[0]!.check.kind === 'principal')
      renderAt(path)
      click('No value')
      expect(finals().at(-1)).toMatchObject({ correct: false })
      expect(screen.getByRole('alert').textContent).toMatch(/This one has a value/)
      expect(showsNumber([screen.getByRole('alert').textContent ?? ''], answerForms(a.stages[0]!))).toBe(false)
    },
    FLOW_TIMEOUT,
  )

  it(
    'the keys: π, √, ° and the three inverse functions, and no word for a missing value',
    () => {
      const { path } = load('inverseTrig', 'it.evaluate', (x) => x.stages[0]!.check.kind === 'principal')
      renderAt(path)
      const strip = screen.getByRole('toolbar', { name: 'Math symbols' })
      for (const name of ['inverse sine', 'inverse cosine', 'inverse tangent', 'degrees']) expect(within(strip).getByRole('button', { name })).toBeTruthy()
      expect(within(strip).queryByRole('button', { name: /undefined/i })).toBeNull()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reference triangle: no side until she has said the quadrant, and the side she finds only once she has found it',
    () => {
      const { a, path } = load('inverseTrig', 'it.compose', (x) => x.stages[0]!.id === 'quadrant')
      const view = renderAt(path)
      const side = a.stages[1]!
      const legText = () => [...view.container.querySelectorAll('[data-trig^="leg-"]')].map((t) => t.textContent).filter(Boolean)
      expect(legText()).toEqual([])
      answer(a.stages[0]!, a.stages[0]!.answerText)
      const shown = legText()
      expect(shown).toHaveLength(2)
      expect(shown).not.toContain(a.figure.legs![side.id as 'x' | 'y' | 'r']!.label)
      answer(side, side.answerText)
      expect(legText()).toContain(a.figure.legs![side.id as 'x' | 'y' | 'r']!.label)
    },
    FLOW_TIMEOUT,
  )

  it(
    'three hint rungs: the nudge, the rule card, then the worked lines, which mark the answer as shown',
    () => {
      const { a, path } = load('inverseTrig', 'it.compose', (x) => x.stages[0]!.id === 'value')
      const view = renderAt(path)
      click('Nudge me')
      expect(view.container.textContent).toContain(plain(a.stages[0]!.nudge).slice(0, 20))
      click('Show the rule')
      expect(screen.getAllByText(/Rule/).length).toBeGreaterThan(0)
      expect(screen.getByRole('button', { name: /Explain the answer.*marks the answer as shown/ })).toBeTruthy()
      click(/Explain the answer/)
      expect(screen.getByRole('region', { name: 'Worked explanation' })).toBeTruthy()
      expect(useStore.getState().attempt?.final?.revealed).toBe(true)
      answer(a.stages[0]!, a.stages[0]!.answerText)
      expect(doneEvent()).toMatchObject({ revealed: 1 })
    },
    FLOW_TIMEOUT,
  )
})
