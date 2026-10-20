// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { generateProblem } from '@/content'
import { patternHit } from '@/engine'
import { buildStepContext, classifyStep } from '@/problem/stepEngine'
import { ComposerStatus, engineVerdict, firstSentence, KEPT, patternVerdict, stepVerdict } from './ComposerVerdict'

describe('firstSentence', () => {
  it('ends at a full stop followed by a new sentence, never inside a number', () => {
    expect(firstSentence('Divide by 2. Then flip it.')).toBe('Divide by 2.')
    expect(firstSentence('0.5 is half. Yes.')).toBe('0.5 is half.')
    expect(firstSentence('One sentence only')).toBe('One sentence only')
    expect(firstSentence('  ')).toBeUndefined()
    expect(firstSentence(undefined)).toBeUndefined()
  })
})

describe('composer verdicts', () => {
  it('a rejected step: the named mistake and its rule in one line, the whole lesson behind Why?', () => {
    const inst = generateProblem('inequalities', 'ineq.linear', 12345, { negativeLead: true })
    const ctx = buildStepContext(inst, false)
    const out = classifyStep(inst.start!, '-6x > 16', ctx)
    if (out.kind !== 'rejected') throw new Error('expected a rejection')
    const v = stepVerdict(out.result)
    if (v.tone !== 'bad') throw new Error('expected a bad verdict')
    expect(v.title.length).toBeGreaterThan(0)
    expect(v.why.title).toBe(v.title)
    render(<>{v.why.body}</>)
    // The body is the work-list card's lesson without its red frame or its alert role.
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a kept line, a kept line with the caveat, nothing yet', () => {
    expect(engineVerdict({ rejection: null, kept: true, caveat: null })).toBe(KEPT)
    const caveat = engineVerdict({ rejection: null, kept: true, caveat: { restriction: 'x >= 0' } })
    expect(caveat).toMatchObject({ tone: 'ok', text: 'Kept. Legal, but check for extra answers.' })
    expect(engineVerdict({ rejection: null, kept: false, caveat: null })).toBeNull()
  })

  it('a named mistake from a grader: title and the first sentence of its lesson', () => {
    const hit = patternHit('no_sign_flip', 'Your line kept > after dividing by −6.')
    const v = patternVerdict(hit, 'Your line kept > after dividing by −6.')
    expect(v).toMatchObject({ tone: 'bad', title: hit.title, sentence: firstSentence(hit.lesson) })
    expect(patternVerdict(null, 'That is not the answer. Look again.')).toMatchObject({ title: 'Not quite', sentence: 'That is not the answer.' })
  })
})

describe('ComposerStatus', () => {
  it('the verdict on the left with Why?, Stuck? on the right', () => {
    const onWhy = vi.fn()
    const onStuck = vi.fn()
    const hit = patternHit('no_sign_flip')
    render(<ComposerStatus verdict={patternVerdict(hit, 'w')} onWhy={onWhy} onStuck={onStuck} />)
    const why = screen.getByRole('button', { name: `Why? ${hit.title}` })
    expect(why.textContent).toBe('Why?')
    fireEvent.click(why)
    expect(onWhy).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Stuck?' }))
    expect(onStuck).toHaveBeenCalledTimes(1)
    expect(screen.getByText(hit.title).closest('p')?.className).toContain('line-clamp-2')
    // Not a live region: the work-list card already announces the verdict.
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('a note that did not count has no Why?; nothing at all without a verdict or a chip', () => {
    const view = render(<ComposerStatus verdict={{ tone: 'info', text: 'That is the line above.' }} onWhy={() => {}} onStuck={null} />)
    expect(screen.getByText('That is the line above.')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    view.unmount()
    const { container } = render(<ComposerStatus verdict={null} onWhy={() => {}} onStuck={null} />)
    expect(container.innerHTML).toBe('')
  })
})
