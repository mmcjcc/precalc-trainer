// @vitest-environment jsdom
/**
 * The geometry screen with the circle half of Unit 9: per template, the figure first, the promised mistake named and
 * recorded once, then the fix and completion; an unreadable answer records nothing; a reload restores her entries; the
 * π key is on the strip and inserts "pi"; a calculator decimal is a note that records nothing. The segment's last part
 * takes its answer factored, like 4(π - 2).
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { GEO_KEYS, canonicalEntries, type GeometryAnswer } from '@/content/modules/geometry'
import { stageDisplay } from '@/content/modules/geometry/grade'
import { ERROR_PATTERNS } from '@/engine'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '../Problem'

const FLOW_TIMEOUT = 120_000
const NOT_AN_ATTEMPT = 'This doesn’t count as an attempt'
const TEMPLATES = ['ca.circle', 'ca.sector', 'ca.segment'] as const

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
  const p = generateProblem('geoCircleArea', templateId, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${templateId}: not geometry`)
  return { p, a: p.answer, path: problemPath('geoCircleArea', templateId, seed) }
}

function exactText(text: string) {
  const want = text.replace(/\s+/g, ' ').trim()
  return (content: string) => content === want
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
type EvOf<T extends string> = Extract<ReturnType<typeof events>[number], { t: T }>
const finals = () => events('final_answer') as EvOf<'final_answer'>[]
const doneEvent = () => events('problem_done')[0] as EvOf<'problem_done'> | undefined

function openRegion(): HTMLElement {
  const regions = screen.getAllByRole('region')
  return regions[regions.length - 1]!
}

function box(stage: GeometryAnswer['stages'][number]): HTMLInputElement {
  return within(openRegion()).getByRole('textbox', { name: stage.label }) as HTMLInputElement
}

function enter(stage: GeometryAnswer['stages'][number], value: string) {
  fireEvent.change(box(stage), { target: { value } })
}

function showsAnswer(text: string, display: string): boolean {
  const body = text.replace(/Not quite:/g, '')
  return new RegExp(`(^|[^0-9√π.])${display.replace(/[()−+-]/g, '\\$&')}(?![0-9√π]|\\.\\d)`).test(body)
}

function walk(a: GeometryAnswer) {
  const right = canonicalEntries(a)
  const trapAt = a.stages.findIndex((stage) => stage.id === a.trapStage)
  for (let i = 0; i < a.stages.length; i++) {
    const stage = a.stages[i]!
    const heading = a.stages.length > 1 ? `Part ${i + 1} of ${a.stages.length}: ${stage.label}` : stage.label
    expect(within(openRegion()).getByRole('heading', { name: heading })).toBeTruthy()
    expect(screen.queryByText(stage.reveal[0]!)).toBeNull()
    const checkName = `Check ${stage.label}`
    expect(screen.getByRole('button', { name: checkName }).className.split(/\s+/)).toContain('btn-chunky')
    const answer = right[GEO_KEYS[stage.id]] ?? ''
    if (i === trapAt) {
      const before = finals().length
      enter(stage, a.trapAnswer)
      click(checkName)
      const alert = screen.getByRole('alert')
      const info = ERROR_PATTERNS[a.trap]
      expect(alert.textContent).toContain(info.title)
      expect(alert.textContent).toContain(info.lesson)
      expect(alert.textContent).toContain('Example:')
      expect(showsAnswer(alert.textContent ?? '', stageDisplay(stage)), stageDisplay(stage)).toBe(false)
      expect(finals()).toHaveLength(before + 1)
      expect(finals()[before]).toMatchObject({ correct: false, pattern: a.trap, via: 'text' })
      click(checkName)
      expect(finals()).toHaveLength(before + 1)
      expect(doneEvent()).toBeUndefined()
    }
    // She types π as "pi", the way the π key writes it.
    enter(stage, answer.replace(/π/g, 'pi'))
    click(checkName)
  }
  expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
  expect(doneEvent()).toMatchObject({ finalCorrect: false, revealed: 0 })
  expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
  for (const line of a.reveal) expect(screen.getByText(line)).toBeTruthy()
}

/** The decimal a calculator shows for an answer with π in it (null when the answer has no π). */
function calculatorDecimal(answerText: string): string | null {
  if (!answerText.includes('π')) return null
  let total = 0
  for (const part of answerText.split(/ (?=[-+] )/)) {
    const sign = part.startsWith('-') ? -1 : 1
    const t = part.replace(/^[-+] /, '')
    const m = /^\(?(\d*)(π?)(?:√(\d+))?\)?(?:\/(\d+))?$/.exec(t)
    if (!m) throw new Error(`unreadable ${t}`)
    total += (sign * (m[1] ? Number(m[1]) : 1) * (m[2] ? Math.PI : 1) * (m[3] ? Math.sqrt(Number(m[3])) : 1)) / (m[4] ? Number(m[4]) : 1)
  }
  return total.toFixed(2)
}

beforeEach(() => {
  resetStoreForTests()
})

describe.each(TEMPLATES)('GeometryFlow unit 9 circles %s', (templateId) => {
  it(
    'shows the figure first, names the promised mistake, then accepts the fix',
    () => {
      const { a, path } = load(templateId)
      renderAt(path)
      expect(screen.getByText(exactText(a.prompt))).toBeTruthy()
      expect(screen.getByRole('img', { name: a.figure.ariaLabel })).toBeTruthy()
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
      expect(useStore.getState().events).toEqual([])
      enter(stage, '???')
      expect(screen.queryByRole('alert')).toBeNull()
      click(checkName)
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      expect(useStore.getState().events).toEqual([])
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores her entries',
    () => {
      const { a, path } = load(templateId)
      const view = renderAt(path)
      const stage = a.stages[0]!
      const key = GEO_KEYS[stage.id]
      enter(stage, '3pi')
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [key]: '3pi' })
      renderAt(path)
      expect(box(stage).value).toBe('3pi')
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )

  it(
    'the π key is on the strip and inserts pi',
    () => {
      const { a, path } = load(templateId)
      renderAt(path)
      const stage = a.stages[0]!
      const strip = within(openRegion()).getByRole('toolbar', { name: 'Math symbols' })
      const pi = within(strip).getByRole('button', { name: 'pi' })
      expect(pi.textContent).toBe('π')
      enter(stage, '3')
      box(stage).setSelectionRange(1, 1)
      fireEvent.click(pi)
      expect(box(stage).value).toBe('3pi')
      expect(useStore.getState().events).toEqual([])
    },
    FLOW_TIMEOUT,
  )

  it(
    'a calculator decimal is a note that records nothing',
    () => {
      let found: { seed: number; index: number } | null = null
      for (let seed = 1; seed <= 60 && !found; seed++) {
        const { a } = load(templateId, seed)
        const index = a.stages.findIndex((s) => s.answerText.includes('π'))
        if (index === 0) found = { seed, index }
      }
      if (!found) throw new Error('no first part with π')
      const { a, path } = load(templateId, found.seed)
      const stage = a.stages[0]!
      renderAt(path)
      enter(stage, calculatorDecimal(stage.answerText)!)
      click(`Check ${stage.label}`)
      const alert = screen.getByRole('alert').textContent ?? ''
      expect(alert).toContain(NOT_AN_ATTEMPT)
      expect(alert).toMatch(/in terms of π/)
      expect(showsAnswer(alert, stage.answerText)).toBe(false)
      expect(useStore.getState().events).toEqual([])
    },
    FLOW_TIMEOUT,
  )
})

describe('GeometryFlow unit 9 circles: the segment', () => {
  it(
    'the last part takes its answer factored, like 4(π - 2)',
    () => {
      let found: { seed: number; typed: string } | null = null
      for (let seed = 1; seed <= 200 && !found; seed++) {
        const { a } = load('ca.segment', seed)
        const m = /^(\d+)π - (\d+)$/.exec(a.stages[2]!.answerText)
        if (!m) continue
        const k = Number(m[1])
        const n = Number(m[2])
        let g = k
        for (let x = n; x; ) [g, x] = [x, g % x]
        if (g < 2) continue
        found = { seed, typed: `${g}(${k / g === 1 ? '' : k / g}π - ${n / g})` }
      }
      if (!found) throw new Error('no factorable segment')
      const { a, path } = load('ca.segment', found.seed)
      renderAt(path)
      const right = canonicalEntries(a)
      for (const stage of a.stages.slice(0, 2)) {
        enter(stage, right[GEO_KEYS[stage.id]]!)
        click(`Check ${stage.label}`)
      }
      const last = a.stages[2]!
      enter(last, found.typed)
      click(`Check ${last.label}`)
      expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'the third hint shows the answer and marks it shown',
    () => {
      const { a, path } = load('ca.segment', 1)
      const stage = a.stages[0]!
      renderAt(path)
      expect(screen.queryByText(stage.reveal[0]!)).toBeNull()
      click('Nudge me')
      expect(screen.getByText(stage.nudge)).toBeTruthy()
      click('Show the rule')
      expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()
      expect(screen.queryByText(stage.reveal[0]!)).toBeNull()
      click(/Explain the answer/)
      expect(useStore.getState().attempt?.final?.revealed).toBe(true)
      expect(screen.getByText(stage.reveal[0]!)).toBeTruthy()
      expect(useStore.getState().events.filter((e) => e.t === 'final_answer')).toEqual([])
    },
    FLOW_TIMEOUT,
  )
})
