// @vitest-environment jsdom
/**
 * "Check my own problem" end to end (docs/progress/own-problem.md): the module page's card, the builder (the keypad on
 * a phone, the keyboard on a computer, the live preview, "Check it"), Start into the module's own flow, a slip named
 * and its monster caught, the finish (XP and the goal move; mastery, the rings and the path do not), a reload that
 * brings her lines back, Back to the builder with her text, and the modules that have no constructor.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '@/App'
import { resetKeypadForTests } from '@/components/keypadStore'
import { installPointer, keypad, removePointer, tap, tapBox, typeOnKeypad } from '@/components/keypadTesting'
import { resetCatchMomentForTests } from '@/components/monsters/catchMoment'
import { pickSetTypes, classTypes } from '@/session/buildSet'
import { COURSES } from '@/content'
import { buildOwnProblem, ownProblemId } from '@/content/own'
import { ownProblemPath } from '@/problem/ownUrl'
import { buildTutorContext } from '@/problem/tutorContext'
import { OWN_STORAGE_KEY } from '@/problem/ownDraft'
import { STORAGE_KEYS, mastery, resetStoreForTests, rewardsViewOf, skillRings, useStore, type Ev } from '@/store'

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

const PAGE_TIMEOUT = 120_000
const LAZY = { timeout: 120_000 }

class QuietObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

let navigateTo: NavigateFunction | null = null
let where = ''

/** The router's navigate and location, for Back and for checking where a link went. */
function Probe() {
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    navigateTo = navigate
    where = location.pathname
  })
  return null
}

function renderApp(entries: string[]) {
  return render(
    <MemoryRouter initialEntries={entries}>
      <AppShell />
      <Probe />
    </MemoryRouter>,
  )
}

const store = () => useStore.getState()
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)))

beforeAll(async () => {
  // The lazy pages, loaded once so each test's first find does not wait for the compile.
  await import('@/pages/OwnBuilder')
  await import('@/pages/OwnProblem')
  await import('@/pages/Problem')
}, PAGE_TIMEOUT)

beforeEach(() => {
  resetStoreForTests()
  resetKeypadForTests()
  resetCatchMomentForTests()
  localStorage.clear()
  vi.stubGlobal('IntersectionObserver', QuietObserver)
  window.scrollTo = () => {}
  navigateTo = null
  where = ''
})

afterEach(() => {
  vi.unstubAllGlobals()
  removePointer()
})

const QUIZ = '-13x-20>=-3(2x-5)'

describe('Check my own problem: a linear inequality from her quiz', () => {
  it(
    'card → builder → keypad → preview → Check it → Start → a slip named and caught → finish: XP and the goal move; mastery, rings and the path do not',
    { timeout: PAGE_TIMEOUT },
    async () => {
      installPointer(true)
      store().setSettings({ rewards: true })
      const course = COURSES.find((c) => c.units.some((u) => u.moduleIds.includes('inequalities')))!
      const before = pickSetTypes({ types: classTypes(course), events: [], rewards: store().rewards, now: Date.now() }).types.map((t) => t.templateId)
      renderApp(['/m/inequalities'])

      // The module page's card.
      const card = await screen.findByRole('heading', { name: 'Check my own problem' }, LAZY)
      fireEvent.click(within(card.closest('section')!).getByRole('link', { name: /Type my problem/ }))
      expect(await screen.findByRole('heading', { level: 1, name: 'Check my own problem' }, LAZY)).toBeTruthy()
      expect(where).toBe('/own/inequalities')

      // Typed on the phone's keypad, with a live preview.
      const box = screen.getByRole('textbox', { name: 'Your problem' })
      tapBox(box)
      expect(keypad()).toBeTruthy()
      typeOnKeypad(QUIZ)
      // The keypad spaces the sign itself and nothing else.
      expect((box as HTMLInputElement).value).toBe('-13x-20 >= -3(2x-5)')
      await wait(120)
      expect(document.querySelector('[aria-label="Preview"] .katex')).toBeTruthy()

      // Check it (the keypad's Check key): what she will be asked, and Start.
      tap('check')
      const ok = await screen.findByRole('heading', { name: /I can check this one/ })
      const verdict = ok.closest('section')!
      expect(verdict.textContent).toContain('give the answer in interval and set notation')
      fireEvent.click(within(verdict).getByRole('button', { name: 'Start' }))

      // Her problem, in the inequality flow, saying it is hers.
      const line = await screen.findByRole('textbox', { name: 'Next line' }, LAZY)
      expect(where).toBe(ownProblemPath('inequalities', 'ineq.distribute', '-13x-20 >= -3(2x-5)'))
      expect(document.querySelector('[data-own-problem]')?.textContent).toBe('Your own problem')
      expect(store().attempt?.own).toBe('-13x-20 >= -3(2x-5)')

      const send = (text: string) => {
        fireEvent.change(screen.getByRole('textbox', { name: 'Next line' }), { target: { value: text } })
        fireEvent.click(screen.getAllByRole('button', { name: /^Check/ })[0]!)
      }
      void line
      send('-13x - 20 >= -6x + 15')
      send('-7x - 20 >= 15')
      send('-7x >= 35')
      // Her quiz slip: dividing by −7 without flipping. Named, and its monster caught.
      send('x >= -5')
      const status = document.querySelector<HTMLElement>('[data-composer-status]')!
      expect(status.querySelector('[data-monster-caught="no_sign_flip"]')).toBeTruthy()
      await act(async () => {})
      expect(store().rewards.caught).toContain('no_sign_flip')
      send('x <= -5')
      expect(store().attempt?.steps).toHaveLength(4)

      // The answer in both notations.
      fireEvent.change(screen.getByLabelText('Interval notation'), { target: { value: '(-inf, -5]' } })
      fireEvent.change(screen.getByLabelText('Set-builder notation'), { target: { value: '{x | x <= -5}' } })
      fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
      const sheet = await screen.findByRole('dialog', { name: /Problem complete|Problem finished/ })
      expect(sheet.querySelector('[data-own-note]')).toBeTruthy()

      // XP and the goal moved; every event of hers is marked; mastery, the rings and the path did not move.
      const events = store().events
      const mine = events.filter((e): e is Extract<Ev, { attemptId: string }> => 'attemptId' in e)
      expect(mine.length).toBeGreaterThan(5)
      expect(mine.every((e) => e.own === true)).toBe(true)
      const view = rewardsViewOf(store())
      expect(view.today.xp).toBeGreaterThan(0)
      expect(view.awards.some((a) => a.kind === 'finish')).toBe(true)
      expect(mastery(events, 'ineq.distribute').count).toBe(0)
      expect(skillRings(events).has('ineq.distribute')).toBe(false)
      const after = pickSetTypes({ types: classTypes(course), events, rewards: store().rewards, now: Date.now() }).types.map((t) => t.templateId)
      expect(after).toEqual(before)
      // The mistake card is caught (its monster is on the loose) and nothing squashed it.
      const card2 = view.cards.find((c) => c.pattern === 'no_sign_flip')
      expect(card2?.skill).toBe('ineq.distribute')
      expect(card2?.squashed).toBe(false)

      // No "Next problem": "Check another" goes back to an empty builder.
      expect(within(sheet).queryByRole('button', { name: 'Next problem' })).toBeNull()
      fireEvent.click(within(sheet).getByRole('button', { name: 'Check another' }))
      const again = await screen.findByRole('textbox', { name: 'Your problem' }, LAZY)
      expect(where).toBe('/own/inequalities')
      expect((again as HTMLInputElement).value).toBe('')
    },
  )

  it('a reload brings back her problem and her lines', { timeout: PAGE_TIMEOUT }, async () => {
    const path = ownProblemPath('inequalities', 'ineq.distribute', '-13x - 20 >= -3(2x - 5)')
    const view = renderApp([path])
    await screen.findByRole('textbox', { name: 'Next line' }, LAZY)
    fireEvent.change(screen.getByRole('textbox', { name: 'Next line' }), { target: { value: '-13x - 20 >= -6x + 15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check this step' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Next line' }), { target: { value: '-7x - 20 >= 15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check this step' }))
    expect(screen.getAllByText('accepted')).toHaveLength(2)
    const saved = localStorage.getItem(STORAGE_KEYS.attempt)
    expect(saved).toContain('"own":"-13x - 20 >= -3(2x - 5)"')
    view.unmount()

    // Reload: memory is gone, localStorage survives.
    useStore.setState({ attempt: null })
    localStorage.setItem(STORAGE_KEYS.attempt, saved!)
    await useStore.persist.rehydrate()
    expect(store().attempt?.steps).toHaveLength(2)
    renderApp([path])
    await screen.findByRole('textbox', { name: 'Next line' }, LAZY)
    expect(screen.getAllByText('accepted')).toHaveLength(2)
    expect(store().attempt?.steps.map((s) => s.text.replace(/[*\s]/g, ''))).toEqual(['-13x-20>=-6x+15', '-7x-20>=15'])
  })

  it('Back from her problem returns to the builder with her text', { timeout: PAGE_TIMEOUT }, async () => {
    renderApp(['/m/inequalities', '/own/inequalities'])
    const box = await screen.findByRole('textbox', { name: 'Your problem' }, LAZY)
    fireEvent.change(box, { target: { value: '2 < 3x + 5 <= 11' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check it' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }))
    await screen.findByRole('textbox', { name: 'Next line' }, LAZY)
    expect(where).toBe(ownProblemPath('inequalities', 'ineq.compound', '2 < 3x + 5 <= 11'))
    act(() => navigateTo!(-1))
    const back = await screen.findByRole('textbox', { name: 'Your problem' }, LAZY)
    expect((back as HTMLInputElement).value).toBe('2 < 3x + 5 <= 11')
    expect(JSON.parse(localStorage.getItem(OWN_STORAGE_KEY)!).inequalities.text).toBe('2 < 3x + 5 <= 11')
  })

  it('Check it says why not, in one plain sentence with a link to the module that does it', { timeout: PAGE_TIMEOUT }, async () => {
    renderApp(['/own/inequalities'])
    const box = await screen.findByRole('textbox', { name: 'Your problem' }, LAZY)
    fireEvent.change(box, { target: { value: 'x^2 - 4 > 0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check it' }))
    const no = await screen.findByRole('heading', { name: 'I can’t check this one here' })
    const section = no.closest('section')!
    expect(section.getAttribute('data-reason')).toBe('polynomial')
    expect(section.querySelector('.katex')).toBeTruthy()
    expect(within(section).getByRole('link', { name: 'Polynomial and rational inequalities' }).getAttribute('href')).toBe('/m/signCharts')
    // A change puts the verdict away.
    fireEvent.change(box, { target: { value: 'x^2 - 4 > ' } })
    expect(screen.queryByRole('heading', { name: 'I can’t check this one here' })).toBeNull()
  })

  it('a link with a statement it cannot open goes to the builder, which says why', { timeout: PAGE_TIMEOUT }, async () => {
    renderApp([ownProblemPath('inequalities', 'ineq.linear', '3x + 2y > 5')])
    const box = await screen.findByRole('textbox', { name: 'Your problem' }, LAZY)
    expect(where).toBe('/own/inequalities')
    expect((box as HTMLInputElement).value).toBe('3x + 2y > 5')
    await waitFor(() => expect(document.querySelector('[data-reason="two_variables"]')).toBeTruthy())
  })
})

/** Type her problem in the builder (a wide screen: the keyboard), check it and start it. */
async function startOwn(moduleId: string, text: string, kind?: string) {
  renderApp([`/own/${moduleId}`])
  const box = await screen.findByRole('textbox', { name: 'Your problem' }, LAZY)
  if (kind) fireEvent.click(screen.getByRole('radio', { name: kind }))
  fireEvent.change(box, { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Check it' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Start' }))
}

const caught = (id: string) => document.querySelector(`[data-monster-caught="${id}"]`)

describe('Check my own problem: the inverse of her quiz function', () => {
  it('Start → yes, one-to-one → the cube-first slip named and caught → her lines → check it → done, every event hers', { timeout: PAGE_TIMEOUT }, async () => {
    await startOwn('inverses', 'f(x) = cbrt(5x - 2) + 4')
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, one-to-one' }, LAZY))
    expect(where).toBe(ownProblemPath('inverses', 'inv.cbrt-shift', 'y = cbrt(5x - 2) + 4'))
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    const send = (text: string) => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Next line' }), { target: { value: text } })
      fireEvent.click(screen.getByRole('button', { name: 'Check this step' }))
    }
    send('x = cbrt(5y - 2) + 4')
    // Her quiz slip: cubing before the 4 is subtracted.
    send('x^3 = 5y - 2 + 4')
    expect(screen.getByText(/Not accepted/)).toBeTruthy()
    const slip = store().events.find((e) => e.t === 'step_rejected')
    expect(slip && slip.t === 'step_rejected' && slip.pattern).toBeTruthy()
    expect(caught(slip!.t === 'step_rejected' ? slip!.pattern! : '')).toBeTruthy()
    send('x - 4 = cbrt(5y - 2)')
    send('(x - 4)^3 = 5y - 2')
    send('(x - 4)^3 + 2 = 5y')
    send('y = ((x - 4)^3 + 2)/5')
    expect(screen.getByRole('heading', { name: /Check it with k = 2/ })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('f(2) ='), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText('f⁻¹(f(2)) ='), { target: { value: '2' } })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Check both' }))
    })
    const card = document.querySelector<HTMLElement>('[data-completion-card]')!
    expect(card).toBeTruthy()
    expect(card.querySelector('[data-own-note]')).toBeTruthy()
    expect(within(card).getByRole('button', { name: 'Check another' })).toBeTruthy()
    const mine = store().events.filter((e) => 'attemptId' in e)
    expect(mine.every((e) => 'own' in e && e.own)).toBe(true)
    expect(mastery(store().events, 'inv.cbrt-shift').count).toBe(0)
  })
})

describe('Check my own problem: a log equation with an extraneous root', () => {
  it('Start → her lines → keeping the extraneous root is named and caught → the right answer → done', { timeout: PAGE_TIMEOUT }, async () => {
    await startOwn('expLogEquations', 'log(x) + log(x - 3) = 1')
    const line = await screen.findByRole('textbox', { name: 'Next line' }, LAZY)
    expect(where).toBe(ownProblemPath('expLogEquations', 'ee.logarithmic', 'log(x) + log(x - 3) = 1'))
    const send = (text: string) => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Next line' }), { target: { value: text } })
      fireEvent.click(screen.getByRole('button', { name: 'Check this line' }))
    }
    void line
    send('x(x - 3) = 10')
    send('x = -2 or x = 5')
    expect(store().attempt?.steps).toHaveLength(2)
    fireEvent.change(screen.getByLabelText('Answer'), { target: { value: 'x = 5 or x = -2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check the answer' }))
    expect(screen.getByRole('alert').textContent).toContain('Not quite:')
    expect(caught('log_extraneous_kept')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Answer'), { target: { value: 'x = 5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check the answer' }))
    const card = await waitFor(() => {
      const c = document.querySelector<HTMLElement>('[data-completion-card]')
      if (!c) throw new Error('not finished')
      return c
    })
    expect(within(card).getByRole('button', { name: 'Check another' })).toBeTruthy()
    expect(store().events.filter((e) => 'attemptId' in e).every((e) => 'own' in e && e.own)).toBe(true)
  })
})

/** Every event of the attempt is marked as hers, and the template's mastery did not move. */
function allHers(templateId: string) {
  const mine = store().events.filter((e) => 'attemptId' in e)
  expect(mine.length).toBeGreaterThan(2)
  expect(mine.every((e) => 'own' in e && e.own)).toBe(true)
  expect(mastery(store().events, templateId).count).toBe(0)
}

const finished = () =>
  waitFor(() => {
    const c = document.querySelector<HTMLElement>('[data-completion-card]')
    if (!c) throw new Error('not finished')
    return c
  })

describe('Check my own problem: condensing logs, the kind picked in the builder', () => {
  it('Condense → Start → the coefficient taken inside named and caught → one log → done', { timeout: PAGE_TIMEOUT }, async () => {
    await startOwn('logProperties', '2log(x) + log(y) - log(n)', 'Condense to one logarithm')
    await screen.findByRole('textbox', { name: 'Next line' }, LAZY)
    expect(where).toBe(ownProblemPath('logProperties', 'lp.condense', '2log(x) + log(y) - log(n)'))
    expect(document.querySelector('[data-own-problem]')).toBeTruthy()
    const send = (text: string) => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Next line' }), { target: { value: text } })
      fireEvent.click(screen.getByRole('button', { name: 'Check this line' }))
    }
    send('log(2xy/n)')
    expect(screen.getByRole('alert').textContent).toContain('Not accepted:')
    expect(caught('log_coefficient_inside')).toBeTruthy()
    send('log(x^2 y / n)')
    const card = await finished()
    expect(within(card).getByRole('button', { name: 'Check another' })).toBeTruthy()
    allHers('lp.condense')
  })
})

describe('Check my own problem: completing the square', () => {
  it('Start → a legal line → the unbalanced square named and caught → vertex form → done', { timeout: PAGE_TIMEOUT }, async () => {
    await startOwn('quadratics', '2x^2 - 12x + 13')
    await screen.findByRole('textbox', { name: 'Next line' }, LAZY)
    expect(where).toBe(ownProblemPath('quadratics', 'cs.form', '2x^2 - 12x + 13'))
    const send = (text: string) => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Next line' }), { target: { value: text } })
      fireEvent.click(screen.getByRole('button', { name: 'Check this line' }))
    }
    send('2(x^2 - 6x) + 13')
    expect(store().attempt?.steps).toHaveLength(1)
    // The 9 added inside is 18 added in all: nothing took it back out.
    send('2(x^2 - 6x + 9) + 13')
    const slip = store().events.find((e) => e.t === 'step_rejected')
    const pattern = slip?.t === 'step_rejected' ? slip.pattern : undefined
    expect(pattern).toBe('poly_cs_unbalanced')
    expect(caught(pattern!)).toBeTruthy()
    send('2(x - 3)^2 - 5')
    const card = await finished()
    expect(within(card).getByRole('button', { name: 'Check another' })).toBeTruthy()
    allHers('cs.form')
  })
})

describe('Check my own problem: the difference quotient of her function', () => {
  it('Start → f(x) + h named and caught → her lines → done', { timeout: PAGE_TIMEOUT }, async () => {
    await startOwn('diffQuotient', 'f(x) = 3x^2 + 2x - 1')
    await screen.findByLabelText('f(x + h) line', undefined, LAZY)
    expect(where).toBe(ownProblemPath('diffQuotient', 'dq.quadratic', 'y = 3x^2 + 2x - 1'))
    const submit = (label: string, value: string, button: string) => {
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
      fireEvent.click(screen.getByRole('button', { name: button }))
    }
    // Her slip: f(x) with h added on, not x + h put in for x.
    submit('f(x + h) line', '3x^2 + 2x - 1 + h', 'Check f(x + h)')
    expect(caught('dq_fx_plus_h')).toBeTruthy()
    submit('f(x + h) line', '3(x + h)^2 + 2(x + h) - 1', 'Check f(x + h)')
    for (const line of ['(3x^2 + 6xh + 3h^2 + 2x + 2h - 1 - (3x^2 + 2x - 1))/h', '(3x^2 + 6xh + 3h^2 + 2x + 2h - 1 - 3x^2 - 2x + 1)/h', '(6xh + 3h^2 + 2h)/h', '6x + 3h + 2']) {
      submit('Next line', line, 'Check this step')
    }
    expect(screen.getAllByText('accepted')).toHaveLength(5)
    // The last line's property question comes first; skipping it finishes the problem.
    fireEvent.click(screen.getByRole('button', { name: /^Skip \(Tab\)/ }))
    const card = await finished()
    expect(within(card).getByRole('button', { name: 'Check another' })).toBeTruthy()
    allHers('dq.quadratic')
  })
})

describe('a statement with a slash in it', () => {
  it('opens from its link: the / stays inside her statement', { timeout: PAGE_TIMEOUT }, async () => {
    const path = ownProblemPath('logProperties', 'lp.expand', 'log(x^2 y / n)')
    expect(path).toContain('%2F')
    renderApp([path])
    await screen.findByRole('textbox', { name: 'Next line' }, LAZY)
    expect(where).toBe(path)
    expect(store().attempt?.own).toBe('log(x^2 y / n)')
    expect(store().attempt?.problemId).toBe(ownProblemId('logProperties', 'lp.expand', 'log(x^2 y / n)'))
  })

  it('her problem’s ids are ones the tutor’s server takes, and the tutor context carries them', { timeout: PAGE_TIMEOUT }, async () => {
    renderApp([ownProblemPath('inequalities', 'ineq.distribute', '-13x - 20 >= -3(2x - 5)')])
    await screen.findByRole('textbox', { name: 'Next line' }, LAZY)
    const attempt = store().attempt!
    const r = buildOwnProblem('inequalities', 'solve', '-13x - 20 >= -3(2x - 5)')
    if (!r.ok) throw new Error('not built')
    const context = buildTutorContext(r.instance, attempt, null, false)
    // `ID` in server/src/validate.ts.
    const TUTOR_ID = /^[A-Za-z0-9_.:@/#?=&+-]{1,200}$/
    expect(context.problemId).toBe(attempt.problemId)
    expect(TUTOR_ID.test(context.problemId)).toBe(true)
    expect(context.attemptId).toBe(attempt.id)
    expect(TUTOR_ID.test(context.attemptId!)).toBe(true)
    expect(context.statement).toContain('-13x')
  })
})

describe('modules without a constructor', () => {
  it('chemistry, geometry and trig show no card, and an /own/ link goes to the module page', { timeout: PAGE_TIMEOUT }, async () => {
    for (const moduleId of ['sigFigs', 'geoSegments', 'unitCircle']) {
      const view = renderApp([`/m/${moduleId}`])
      await screen.findByRole('heading', { level: 1 }, LAZY)
      expect(document.querySelector('[data-own-card]'), moduleId).toBeNull()
      view.unmount()
      const link = renderApp([`/own/${moduleId}`])
      await waitFor(() => expect(where).toBe(`/m/${moduleId}`), LAZY)
      link.unmount()
      const deep = renderApp([`/own/${moduleId}/x/2x%20%2B%201`])
      await waitFor(() => expect(where).toBe(`/m/${moduleId}`), LAZY)
      deep.unmount()
    }
  })

  it('the inequality module shows the card', { timeout: PAGE_TIMEOUT }, async () => {
    renderApp(['/m/inequalities'])
    await screen.findByRole('heading', { level: 1 }, LAZY)
    expect(document.querySelector('[data-own-card]')).toBeTruthy()
  })
})
