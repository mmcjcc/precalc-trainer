// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem } from '@/content'
import { mastery, resetStoreForTests, useStore } from '@/store'
import { encodeSlotStep, PARITY_REASONS } from '@/problem/evenOdd'
import { ONE_TO_ONE_REASONS } from '@/problem/inverse'
import { problemPath } from '@/problem/url'
import ProblemPage from './Problem'

// function-plot needs a real SVG layout engine; the flows only need the panel to exist.
vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
        <Route path="/" element={<p>home page</p>} />
        <Route path="/drill" element={<p>drill page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function type(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

const completeHeading = () => screen.queryByRole('heading', { name: /Problem complete/ })

beforeEach(() => {
  resetStoreForTests()
})

describe('Problem page routing', () => {
  it('sends an unknown module, template or seed home', () => {
    renderAt('/p/nope/ineq.linear/9ix')
    expect(screen.getByText('home page')).toBeTruthy()
  })
  it('sends an unknown template home', () => {
    renderAt('/p/inequalities/ineq.nope/9ix')
    expect(screen.getByText('home page')).toBeTruthy()
  })
  it('sends a malformed seed home', () => {
    renderAt('/p/inequalities/ineq.linear/!!')
    expect(screen.getByText('home page')).toBeTruthy()
  })
})

describe('inequality flow', () => {
  const inst = generateProblem('inequalities', 'ineq.linear', 12345, {})

  it('accepts a correct first canonical line and starts the attempt', () => {
    renderAt(problemPath('inequalities', 'ineq.linear', 12345))
    expect(useStore.getState().attempt?.problemId).toBe(inst.id)
    type('Next line', inst.canonical[0]!.text)
    click('Check this step')
    expect(screen.getAllByText('accepted')).toHaveLength(1)
    expect(useStore.getState().attempt?.steps).toHaveLength(1)
    expect(screen.queryByText(/Not accepted/)).toBeNull()
  })

  it('rejects a wrong line with a titled rejection card', () => {
    renderAt(problemPath('inequalities', 'ineq.linear', 12345))
    type('Next line', '3x < 9')
    click('Check this step')
    expect(screen.getByText(/Not accepted/)).toBeTruthy()
    expect(screen.queryAllByText('accepted')).toHaveLength(0)
    expect(useStore.getState().attempt?.currentRejections).toBe(1)
  })

  it('opens the final answer only when x is isolated, then completes', () => {
    renderAt(problemPath('inequalities', 'ineq.linear', 12345))
    expect(screen.queryByRole('heading', { name: 'Final answer' })).toBeNull()
    for (const step of inst.canonical) {
      type('Next line', step.text)
      click('Check this step')
    }
    expect(screen.getByRole('heading', { name: 'Final answer' })).toBeTruthy()
    const answer = inst.answer
    if (answer.type !== 'set') throw new Error('expected a set answer')
    type('Interval notation', answer.interval)
    type('Set-builder notation', answer.setBuilder)
    click('Check answer')
    expect(completeHeading()).toBeTruthy()
    // The finished work stays on screen after the attempt is closed.
    expect(useStore.getState().attempt).toBeNull()
    expect(screen.getAllByText('accepted')).toHaveLength(inst.canonical.length)
  })
})

describe('number line flow', () => {
  it('completes when both notations match the shaded set', () => {
    const inst = generateProblem('numberLine', 'nl.read', 12345, {})
    const answer = inst.answer
    if (answer.type !== 'set') throw new Error('expected a set answer')
    renderAt(problemPath('numberLine', 'nl.read', 12345))
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0)
    type('Interval notation', answer.interval)
    type('Set-builder notation', answer.setBuilder)
    click('Check answer')
    expect(completeHeading()).toBeTruthy()
    const done = useStore.getState().events.find((e) => e.t === 'problem_done')
    expect(done && done.t === 'problem_done' && done.finalCorrect).toBe(true)
  })
})

describe('even/odd flow', () => {
  it('unlocks the verdict after one line per slot and completes on the right verdict', () => {
    const seed = 777
    const inst = generateProblem('evenOdd', 'evenOdd.poly', seed, {})
    const answer = inst.answer
    if (answer.type !== 'parity') throw new Error('expected a parity answer')
    renderAt(problemPath('evenOdd', 'evenOdd.poly', seed))
    const checkVerdict = () => screen.getByRole('button', { name: 'Check verdict' }) as HTMLButtonElement
    expect(checkVerdict().disabled).toBe(true)

    type('f(−x) line', answer.fNegX[0]!)
    click('Check f(−x)')
    expect(useStore.getState().attempt?.steps.map((s) => s.text)[0]).toMatch(/^f\(-x\) = /)
    expect((screen.getByRole('button', { name: answer.verdict }) as HTMLButtonElement).disabled).toBe(true)

    type('−f(x) line', answer.negF[0]!)
    click('Check −f(x)')
    expect(useStore.getState().attempt?.steps).toHaveLength(2)

    click(answer.verdict)
    if (answer.verdict === 'neither') {
      const label = PARITY_REASONS.find((r) => r.id === answer.reason)!.label
      fireEvent.click(screen.getByLabelText(label))
    }
    expect(checkVerdict().disabled).toBe(false)
    click('Check verdict')
    expect(completeHeading()).toBeTruthy()
    expect(screen.getByText(/Plug-in check at ±/)).toBeTruthy()
  })
})

describe('inverse flow (inv.quadratic-not)', () => {
  it('No + reason → twin evidence → complete, then offers the optional bonus', () => {
    const seed = 99
    const inst = generateProblem('inverses', 'inv.quadratic-not', seed, {})
    const answer = inst.answer
    if (answer.type !== 'inverse') throw new Error('expected an inverse answer')
    const check = inst.check!
    renderAt(problemPath('inverses', 'inv.quadratic-not', seed))

    click('No')
    const reason = ONE_TO_ONE_REASONS.find((r) => r.id === (answer.reason ?? 'fails_hlt'))!
    fireEvent.click(screen.getByLabelText(reason.label))
    click('Check')
    expect(useStore.getState().attempt?.final?.oneToOne).toBe('no')
    expect(screen.queryByLabelText('Next line')).toBeNull()

    type(`f(${check.k}) =`, String(check.fk))
    type(`f(${check.twin}) =`, String(check.fk + 1))
    click('Check both')
    expect(completeHeading()).toBeNull()
    expect(screen.getByText(new RegExp(`f\\(${check.twin}\\) should be ${check.fk}`))).toBeTruthy()

    type(`f(${check.twin}) =`, String(check.fk))
    click('Check both')
    // The first twin check was recorded wrong, so the attempt finishes but does not count as a
    // correct final answer (F5: finalCorrect is decided by the attempt's records).
    expect(completeHeading()).toBeNull()
    expect(screen.queryByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(useStore.getState().events.find((e) => e.t === 'problem_done')).toMatchObject({ finalCorrect: false })
    expect(screen.getByRole('button', { name: 'Try the bonus' })).toBeTruthy()
  })
})

describe('inverse flow (inv.linear)', () => {
  it('Yes → canonical lines → check it → complete', () => {
    const seed = 4242
    const inst = generateProblem('inverses', 'inv.linear', seed, {})
    const check = inst.check!
    renderAt(problemPath('inverses', 'inv.linear', seed))
    expect(screen.queryByLabelText('Next line')).toBeNull()

    click('Yes, one-to-one')
    click('Check')
    expect(useStore.getState().attempt?.final?.oneToOne).toBe('yes')

    for (const step of inst.canonical) {
      if (screen.queryByRole('heading', { name: /Check it with k/ })) break
      type('Next line', step.text)
      click('Check this step')
      expect(screen.queryByText(/Not accepted/)).toBeNull()
    }
    expect(useStore.getState().attempt?.swapped).toBe(true)
    expect(screen.getByRole('heading', { name: /Check it with k/ })).toBeTruthy()

    type(`f(${check.k}) =`, String(check.fk))
    type(`f⁻¹(f(${check.k})) =`, String(check.k))
    act(() => {
      click('Check both')
    })
    expect(completeHeading()).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Review fixes (flow-logic F1, F4–F9, F12, F13)
// ---------------------------------------------------------------------------

const radios = () => screen.queryAllByRole('radio')
const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)

describe('review fixes: step column', () => {
  const inst = generateProblem('inequalities', 'ineq.linear', 12345, {})

  it('F1: a digit typed into the empty step input goes to the input, not to a chip', () => {
    renderAt(problemPath('inequalities', 'ineq.linear', 12345))
    type('Next line', inst.canonical[0]!.text)
    click('Check this step')
    expect(radios().length).toBeGreaterThan(0)
    const input = screen.getByLabelText('Next line') as HTMLInputElement
    act(() => input.focus())
    expect(document.activeElement).toBe(input)
    const notPrevented = fireEvent.keyDown(input, { key: '3' })
    expect(notPrevented).toBe(true)
    expect(useStore.getState().attempt?.steps[0]?.property).toBe('skipped')
    expect(events('step_accepted')[0]).toMatchObject({ property: 'skipped' })
    // The keystroke lands in the input, whose onChange skips the chip question.
    type('Next line', '3')
    expect(radios()).toHaveLength(0)
  })

  it('F1: digits still pick a chip while focus is inside the chip group', () => {
    renderAt(problemPath('inequalities', 'ineq.linear', 12345))
    type('Next line', inst.canonical[0]!.text)
    click('Check this step')
    const chip = radios()[0] as HTMLButtonElement
    act(() => chip.focus())
    expect(fireEvent.keyDown(chip, { key: '1' })).toBe(false)
    expect(useStore.getState().attempt?.steps[0]?.property).not.toBe('skipped')
  })

  it('F9: the chip prompt closes once the problem is finished', () => {
    renderAt(problemPath('inequalities', 'ineq.linear', 12345))
    for (const step of inst.canonical) {
      type('Next line', step.text)
      click('Check this step')
    }
    expect(radios().length).toBeGreaterThan(0)
    const answer = inst.answer
    if (answer.type !== 'set') throw new Error('expected a set answer')
    type('Interval notation', answer.interval)
    type('Set-builder notation', answer.setBuilder)
    click('Check answer')
    expect(completeHeading()).toBeTruthy()
    expect(radios()).toHaveLength(0)
  })

  it('F12: re-checking the same rejected line is not a second try', () => {
    renderAt(problemPath('inequalities', 'ineq.linear', 12345))
    type('Next line', 'x < 999')
    click('Check this step')
    click('Check this step')
    expect(events('step_rejected')).toHaveLength(1)
    expect(useStore.getState().attempt?.currentRejections).toBe(1)
    expect(screen.getByText(/Not accepted/)).toBeTruthy()
    expect(screen.queryByText(/Two tries in a row/)).toBeNull()
    // A different wrong line is a new try.
    type('Next line', 'x < 998')
    click('Check this step')
    expect(events('step_rejected')).toHaveLength(2)
  })
})

describe('review fixes: even/odd hint ladders (F4)', () => {
  it('each column keeps its own hint rungs', () => {
    renderAt(problemPath('evenOdd', 'evenOdd.poly', 777))
    const inputA = screen.getByLabelText('f(−x) line') as HTMLInputElement
    const inputB = screen.getByLabelText('−f(x) line') as HTMLInputElement
    // queryAll* (not getAll*): a failed getByRole pretty-prints roles and jsdom chokes on KaTeX styles.
    const hintButton = (name: RegExp) => screen.queryAllByRole('button', { name })[0]
    act(() => inputA.focus())
    expect(hintButton(/^Nudge me/)).toBeTruthy()
    fireEvent.click(hintButton(/^Nudge me/)!)
    expect(hintButton(/^Show the rule/)).toBeTruthy()
    fireEvent.click(hintButton(/^Show the rule/)!)
    act(() => inputB.focus())
    expect(screen.queryAllByText(/Hints for the −f\(x\) column/).length).toBeGreaterThan(0)
    expect(hintButton(/^Show the step/)).toBeUndefined()
    expect(hintButton(/^Nudge me/)).toBeTruthy()
    fireEvent.click(hintButton(/^Nudge me/)!)
    expect(hintButton(/^Use this line/)).toBeUndefined()
    const used = useStore.getState().attempt?.hintsUsed ?? {}
    expect(Object.values(used).sort()).toEqual([1, 2])
  })
})

describe('review fixes: completion recording (F5)', () => {
  it('a wrong final answer before the right one shows "Problem finished" and blocks mastery', () => {
    for (const seed of [11, 22, 33, 44, 55]) {
      const inst = generateProblem('numberLine', 'nl.read', seed, {})
      const answer = inst.answer
      if (answer.type !== 'set') throw new Error('expected a set answer')
      const v = inst.vars[0] ?? 'x'
      const view = renderAt(problemPath('numberLine', 'nl.read', seed))
      type('Interval notation', '(-1000, 1000)')
      type('Set-builder notation', `{${v} | -1000 < ${v} < 1000}`)
      click('Check answer')
      expect(completeHeading()).toBeNull()
      type('Interval notation', answer.interval)
      type('Set-builder notation', answer.setBuilder)
      click('Check answer')
      expect(completeHeading()).toBeNull()
      expect(screen.queryByRole('heading', { name: /Problem finished/ })).toBeTruthy()
      view.unmount()
    }
    const dones = events('problem_done')
    expect(dones).toHaveLength(5)
    for (const d of dones) expect(d).toMatchObject({ finalCorrect: false, firstTryRate: 0 })
    expect(mastery(useStore.getState().events, 'nl.read').mastered).toBe(false)
  })
})

describe('review fixes: idle clock and nudge (F6, F13)', () => {
  const inst = generateProblem('inequalities', 'ineq.linear', 12345, {})

  function solveAll() {
    for (const step of inst.canonical) {
      type('Next line', step.text)
      click('Check this step')
    }
  }

  it('F6: the active clock keeps running after the nudge and the last seconds reach problem_done', () => {
    vi.useFakeTimers()
    try {
      renderAt(problemPath('inequalities', 'ineq.linear', 12345))
      act(() => {
        vi.advanceTimersByTime(5 * 60_000)
      })
      expect(useStore.getState().attempt?.nudged).toBe(true)
      expect(useStore.getState().attempt?.activeSecs).toBe(300)
      for (let i = 0; i < 36; i++) {
        act(() => {
          fireEvent.keyDown(window, { key: 'Shift' })
          vi.advanceTimersByTime(10_000)
        })
      }
      expect(useStore.getState().attempt?.activeSecs).toBe(660)
      act(() => {
        vi.advanceTimersByTime(7_000)
      })
      solveAll()
      const answer = inst.answer
      if (answer.type !== 'set') throw new Error('expected a set answer')
      type('Interval notation', answer.interval)
      type('Set-builder notation', answer.setBuilder)
      click('Check answer')
      expect(completeHeading()).toBeTruthy()
      expect(events('problem_done')[0]).toMatchObject({ secs: 667 })
    } finally {
      vi.useRealTimers()
    }
  })

  it('F13: on the final-answer card the nudge points at the answer, not the disabled hint button', () => {
    vi.useFakeTimers()
    try {
      renderAt(problemPath('inequalities', 'ineq.linear', 12345))
      solveAll()
      expect(screen.getByRole('heading', { name: 'Final answer' })).toBeTruthy()
      act(() => {
        vi.advanceTimersByTime(4 * 60_000 + 1000)
      })
      expect(screen.getByText('Still here? Write the solution set both ways below.')).toBeTruthy()
      expect(screen.queryByText(/hint button/)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('review fixes: attempt lifecycle (F7, F8)', () => {
  it('F7: a stored attempt from an older generator version of this same URL starts fresh without asking', () => {
    const inst = generateProblem('evenOdd', 'evenOdd.special', 12345, {})
    const answer = inst.answer
    if (answer.type !== 'parity') throw new Error('expected a parity answer')
    const old = useStore.getState().startAttempt({
      problemId: inst.id.replace(/@\d+\//, '@0/'),
      moduleId: 'evenOdd',
      templateId: 'evenOdd.special',
      skill: inst.skill,
      seed: (12345).toString(36),
      difficulty: '',
      genVersion: 0,
    })
    useStore.getState().acceptStep({ text: encodeSlotStep('A', answer.fNegX[0]!) })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    try {
      renderAt(problemPath('evenOdd', 'evenOdd.special', 12345))
      expect(confirm).not.toHaveBeenCalled()
      const a = useStore.getState().attempt
      expect(a?.problemId).toBe(inst.id)
      expect(a?.steps).toHaveLength(0)
      expect(useStore.getState().toasts.some((t) => t.message === 'This problem was updated, so it starts fresh')).toBe(true)
      expect(events('problem_abandoned')).toMatchObject([{ attemptId: old.id }])
      type('f(−x) line', answer.fNegX[0]!)
      click('Check f(−x)')
      expect(useStore.getState().attempt?.steps).toHaveLength(1)
    } finally {
      confirm.mockRestore()
    }
  })

  it('F7: Cancel on the leave-confirm for a different problem lands on a working page for the stored one', () => {
    const inst = generateProblem('inequalities', 'ineq.linear', 12345, {})
    const first = renderAt(problemPath('inequalities', 'ineq.linear', 12345))
    type('Next line', inst.canonical[0]!.text)
    click('Check this step')
    first.unmount()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    try {
      renderAt(problemPath('inequalities', 'ineq.linear', 999))
      expect(confirm).toHaveBeenCalledTimes(1)
      expect(useStore.getState().attempt?.problemId).toBe(inst.id)
      type('Next line', inst.canonical[1]!.text)
      click('Check this step')
      expect(useStore.getState().attempt?.steps).toHaveLength(2)
    } finally {
      confirm.mockRestore()
    }
  })

  it('F8: the same seed with different difficulty flags asks, then starts its own attempt', () => {
    const plain = generateProblem('inequalities', 'ineq.linear', 12345, {})
    const neg = generateProblem('inequalities', 'ineq.linear', 12345, { negativeLead: true })
    const first = renderAt(problemPath('inequalities', 'ineq.linear', 12345))
    type('Next line', plain.canonical[0]!.text)
    click('Check this step')
    first.unmount()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    try {
      renderAt(problemPath('inequalities', 'ineq.linear', 12345, 'n'))
      expect(confirm).toHaveBeenCalledTimes(1)
      expect(useStore.getState().attempt).toMatchObject({ difficulty: 'n', steps: [] })
      type('Next line', neg.canonical[0]!.text)
      click('Check this step')
      expect(screen.queryByText(/Not accepted/)).toBeNull()
      expect(useStore.getState().attempt?.steps).toHaveLength(1)
    } finally {
      confirm.mockRestore()
    }
  })
})
