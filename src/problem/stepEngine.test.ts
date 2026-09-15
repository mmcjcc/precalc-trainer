import { describe, expect, it } from 'vitest'
import '@/content'
import { generateProblem } from '@/content'
import { buildStepContext, classifyStep, exampleSegments, gradeChip, hintView, progressLine, rejectionView } from './stepEngine'
import { flagsFromKnobs, knobsFromFlags, parseSeedParam, problemPath } from './url'

const inst = generateProblem('inequalities', 'ineq.linear', 12345, {}) // 3x + 6 < 3
const start = inst.start ?? ''

describe('classifyStep', () => {
  const ctx = buildStepContext(inst, false)
  it('accepts a legal step with normalized text and latex from the typed line', () => {
    const r = classifyStep(start, '3x < -3', ctx)
    expect(r.kind).toBe('accepted')
    if (r.kind === 'accepted') {
      expect(r.text).toBe('3*x < -3')
      expect(r.latex).toContain('3x')
      expect(r.result.acceptableChips).toContain('add_sub')
    }
  })
  it('turns a parse failure into a positioned error, not a rejection', () => {
    const r = classifyStep(start, '3x + < 3', ctx)
    expect(r.kind).toBe('parse')
    if (r.kind === 'parse') expect(r.error.position).toBe(4)
  })
  it('rejects an illegal step with a counterexample view', () => {
    const r = classifyStep('-5x <= 30', 'x <= -6', ctx)
    expect(r.kind).toBe('rejected')
    if (r.kind === 'rejected') {
      const v = rejectionView(r.result)
      expect(v.title).toMatch(/flips/)
      expect(v.counterexample).toMatch(/x = 0/)
      expect(v.sideValues.length).toBe(2)
      expect(v.example.length).toBeGreaterThan(1)
    }
  })
})

describe('helpers', () => {
  it('renders example segments as latex only when they parse', () => {
    const segs = exampleSegments('−14 ≤ −14x → x ≥ 1 ✗ → x ≤ 1')
    expect(segs[0]?.latex).toBeTruthy()
    expect(segs[1]?.latex).toBeUndefined()
    expect(segs[2]?.latex).toBeTruthy()
  })
  it('grades chips without penalty', () => {
    expect(gradeChip('add_sub', ['add_sub']).outcome).toBe('correct')
    const w = gradeChip('distribute', ['mul_div'])
    expect(w.outcome).toBe('wrong')
    expect(w.message).toMatch(/multiply\/divide/)
  })
  it('anchors progress and hints on the current line', () => {
    expect(progressLine(inst, start, false)).toMatchObject({ stage: 0, total: 2, solved: false, offPath: false })
    expect(progressLine(inst, 'x < -1', false).solved).toBe(true)
    const h = hintView(inst, start, false)
    expect(h.next?.text).toBe('3x < -3')
    expect(h.card?.id).toBe('add-sub')
    expect(hintView(inst, 'x < -1', false).reveal).toBeNull()
  })
  it('keeps progress monotone over the attempt and decides solved from the module, not the anchor', () => {
    // A legal detour after the first canonical line: anchor is -1, but the best stage stays 1.
    const detour = '3x + 7 < 4'
    const p = progressLine(inst, detour, false, [start, '3x < -3', detour])
    expect(p).toMatchObject({ stage: 1, total: 2, solved: false, offPath: true })
    expect(p.label).toMatch(/off the usual path/)
    // Isolated but written backwards: not the canonical text, still solved.
    expect(progressLine(inst, '-1 > x', false, [start, '3x < -3', '-1 > x']).solved).toBe(true)
    // Anchoring on the last line alone never counts as solved when x is not isolated.
    expect(progressLine(inst, '3x < -3', false).solved).toBe(false)
  })
  it('says a legal off-path line has no step to reveal', () => {
    const h = hintView(inst, '3x + 7 < 4', false)
    expect(h.reveal).toBeNull()
    expect(h.offPath).toBe(true)
    expect(h.nudge).toMatch(/off the usual route/)
    expect(hintView(inst, 'x < -1', false, null, true)).toMatchObject({ reveal: null, offPath: false })
  })
  it('maps difficulty flags and seeds', () => {
    expect(knobsFromFlags('fn')).toEqual({ fractions: true, negativeLead: true })
    expect(flagsFromKnobs({ negativeLead: true, steps: 2 })).toBe('n2')
    expect(parseSeedParam('9ix')).toBe(12345)
    expect(parseSeedParam('!!')).toBeNull()
    expect(problemPath('inequalities', 'ineq.linear', 12345, 'n')).toBe('/p/inequalities/ineq.linear/9ix?d=n')
  })
})
