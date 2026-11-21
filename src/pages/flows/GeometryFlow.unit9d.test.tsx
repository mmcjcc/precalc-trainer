// @vitest-environment jsdom
/**
 * The geometry screen with the last module of Unit 9: per template, the figure first, the promised mistake named and
 * recorded once, then the fix and completion; an unreadable answer records nothing; a reload restores her entries. A
 * ratio part takes "4:25", "4 to 25", "4/25" and an unreduced "8:50" alike; a shaded region's sum passes factored; a
 * probability passes as an unreduced fraction.
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
const TEMPLATES = ['ra.shared', 'ra.similar', 'ra.shaded', 'ra.chance'] as const

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
  const p = generateProblem('geoAreaRatios', templateId, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${templateId}: not geometry`)
  return { p, a: p.answer, path: problemPath('geoAreaRatios', templateId, seed) }
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
    enter(stage, answer.replace(/π/g, 'pi'))
    click(checkName)
  }
  expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
  expect(doneEvent()).toMatchObject({ finalCorrect: false, revealed: 0 })
  expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
  for (const line of a.reveal) expect(screen.getByText(line)).toBeTruthy()
}

/** Type `typed` as the only part of a one-part problem (or the first part) and expect it to pass. */
function passes(templateId: string, seed: number, typed: (a: GeometryAnswer) => string, stageIndex = 0) {
  resetStoreForTests()
  const { a, path } = load(templateId, seed)
  const view = renderAt(path)
  const right = canonicalEntries(a)
  for (const stage of a.stages.slice(0, stageIndex)) {
    enter(stage, right[GEO_KEYS[stage.id]]!.replace(/π/g, 'pi'))
    click(`Check ${stage.label}`)
  }
  const stage = a.stages[stageIndex]!
  enter(stage, typed(a))
  click(`Check ${stage.label}`)
  expect(finals().at(-1), `${templateId}/${seed} “${typed(a)}”`).toMatchObject({ correct: true, via: 'text' })
  view.unmount()
}

beforeEach(() => {
  resetStoreForTests()
})

describe.each(TEMPLATES)('GeometryFlow unit 9 area ratios %s', (templateId) => {
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
      enter(stage, '3/7')
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [key]: '3/7' })
      renderAt(path)
      expect(box(stage).value).toBe('3/7')
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )
})

describe('GeometryFlow unit 9 area ratios: answer forms', () => {
  it(
    'a ratio part takes 4:25, 4 to 25, 4/25 and an unreduced 8:50 alike',
    () => {
      let seed = 0
      for (let s = 1; s <= 200 && !seed; s++) {
        const { a } = load('ra.shared', s)
        if (a.stages[0]!.ratio) seed = s
      }
      expect(seed).toBeGreaterThan(0)
      const { a } = load('ra.shared', seed)
      const [n, d] = a.stages[0]!.answerText.split('/')
      for (const typed of [`${n}:${d}`, `${n} to ${d}`, `${n}/${d}`, `${2 * Number(n)}:${2 * Number(d)}`]) passes('ra.shared', seed, () => typed)
    },
    FLOW_TIMEOUT,
  )

  it(
    'a shaded region typed factored, like 25(4 - π), passes',
    () => {
      let found: { seed: number; typed: string; index: number } | null = null
      for (let seed = 1; seed <= 300 && !found; seed++) {
        const { a } = load('ra.shaded', seed)
        const index = a.stages.length - 1
        const text = a.stages[index]!.answerText
        // "100 - 25π" or "25π - 50": a whole number and a multiple of π with a common factor.
        const m = /^(\d+) - (\d+)π$/.exec(text) ?? /^(\d+)π - (\d+)$/.exec(text)
        if (!m) continue
        const piFirst = text.includes('π -')
        const x = Number(m[1])
        const y = Number(m[2])
        let g = x
        for (let t = y; t; ) [g, t] = [t, g % t]
        if (g < 2) continue
        const inner = piFirst ? `${x / g === 1 ? '' : x / g}pi - ${y / g}` : `${x / g} - ${y / g === 1 ? '' : y / g}pi`
        found = { seed, typed: `${g}(${inner})`, index }
      }
      if (!found) throw new Error('no factorable shaded area')
      const { seed, typed, index } = found
      passes('ra.shaded', seed, () => typed, index)
    },
    FLOW_TIMEOUT,
  )

  it(
    'a probability typed as an unreduced fraction passes; with π, unreduced, it is a note that records nothing',
    () => {
      let plain = 0
      let withPi = 0
      for (let s = 1; s <= 300 && (!plain || !withPi); s++) {
        const text = load('ra.chance', s).a.stages[0]!.answerText
        if (!plain && /^\d+\/\d+$/.test(text)) plain = s
        if (!withPi && /^\(\d+π\)\/\d+$/.test(text)) withPi = s
      }
      expect(plain && withPi).toBeTruthy()
      passes('ra.chance', plain, (a) => {
        const [n, d] = a.stages[0]!.answerText.split('/')
        return `${3 * Number(n)}/${3 * Number(d)}`
      })
      resetStoreForTests()
      const piCase = load('ra.chance', withPi)
      const view = renderAt(piCase.path)
      const m = /^\((\d+)π\)\/(\d+)$/.exec(piCase.a.stages[0]!.answerText)!
      enter(piCase.a.stages[0]!, `${2 * Number(m[1])}pi/${2 * Number(m[2])}`)
      click(`Check ${piCase.a.stages[0]!.label}`)
      const alert = screen.getByRole('alert').textContent ?? ''
      expect(alert).toContain(NOT_AN_ATTEMPT)
      expect(showsAnswer(alert, piCase.a.stages[0]!.answerText)).toBe(false)
      expect(useStore.getState().events).toEqual([])
      view.unmount()
      // A probability is a plain number: a ratio sign is not part of its form, and an unreduced fraction records no note.
      const { a } = load('ra.chance', plain)
      expect(a.stages[0]!.ratio).toBeUndefined()
      expect(a.stages[0]!.lowest).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )
})
