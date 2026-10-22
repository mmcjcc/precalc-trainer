// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { keypadLayout, KEYPAD_SETS } from '@/components/keypadKeys'
import { GRAPH_STORAGE_KEY, MAX_ROWS, normalizeGraphState, readGraphState } from '@/grapher/state'
import { STANDARD_WINDOW } from '@/grapher/view'
import { flushGraphSave, reloadGraphStoreForTests, resetGraphStoreForTests, useGraphStore } from './graphStore'

const s = () => useGraphStore.getState()

beforeEach(() => {
  localStorage.clear()
  resetGraphStoreForTests()
})

describe('the rows', () => {
  it('a new row takes the next colour not in use; ids are never reused', () => {
    const a = s().addRow()!
    const b = s().addRow()!
    expect(s().rows.map((r) => r.color)).toEqual(['navy', 'red', 'green'])
    s().deleteRow(a)
    const c = s().addRow()!
    expect([a, b, c]).toEqual(['r2', 'r3', 'r4'])
    expect(s().rows.find((r) => r.id === c)!.color).toBe('red')
  })

  it('a row goes after the one she was on; deleting the last row leaves one empty row', () => {
    s().setText('r1', 'y = x')
    const id = s().addRow('r1')!
    s().addRow('r1')
    expect(s().rows.map((r) => r.id)).toEqual(['r1', 'r3', id])
    for (const r of [...s().rows]) s().deleteRow(r.id)
    expect(s().rows).toHaveLength(1)
    expect(s().rows[0]!.text).toBe('')
  })

  it('stops at the row limit and keeps text to its limit', () => {
    for (let i = 0; i < MAX_ROWS + 5; i++) s().addRow()
    expect(s().rows).toHaveLength(MAX_ROWS)
    s().setText('r1', 'x'.repeat(1000))
    expect(s().rows[0]!.text.length).toBe(400)
  })
})

describe('sliders', () => {
  it('a typed value outside the range takes the range with it; a bad range is refused', () => {
    s().ensureSliders(['a'])
    expect(s().sliders.a).toEqual({ value: 1, min: -10, max: 10, step: 0.1 })
    s().setSlider('a', { value: 25 })
    expect(s().sliders.a).toEqual({ value: 25, min: -10, max: 25, step: 0.1 })
    s().setSlider('a', { step: 0 })
    expect(s().sliders.a!.step).toBe(0.1)
  })
})

describe('Graph it', () => {
  it('replaces a lone empty row, adds rows that are new, brings back one already there, and sets the window', () => {
    s().importRows({ rows: [{ text: 'f(x) = x^2' }], window: { xMin: -2, xMax: 2, yMin: -1, yMax: 5 }, label: 'f' })
    expect(s().rows.map((r) => r.text)).toEqual(['f(x) = x^2'])
    expect(s().window).toEqual({ xMin: -2, xMax: 2, yMin: -1, yMax: 5 })
    expect(s().fitPending).toBe(false)
    s().toggleHidden(s().rows[0]!.id)
    s().importRows({ rows: [{ text: 'f(x)=x^2' }, { text: 'y = 6 {x < 1}', color: 'teal' }], label: 'f' })
    expect(s().rows.map((r) => [r.text, r.hidden, r.color])).toEqual([
      ['f(x) = x^2', false, 'navy'],
      ['y = 6 {x < 1}', false, 'teal'],
    ])
    expect(s().arrived).toEqual(s().rows.map((r) => r.id))
    // No window of its own: Zoom to fit when the page has read the rows.
    expect(s().fitPending).toBe(true)
    expect(s().takeFit()).toBe(true)
    expect(s().takeFit()).toBe(false)
  })
})

describe('kept on this device', () => {
  it('is saved a moment after a change and read back on a reload; Clear all keeps the angle mode', async () => {
    s().setText('r1', 'y = sin(x)')
    s().setMode('deg')
    s().setWindow({ xMin: -360, xMax: 360, yMin: -2, yMax: 2 })
    await new Promise((r) => setTimeout(r, 300))
    const stored = JSON.parse(localStorage.getItem(GRAPH_STORAGE_KEY)!)
    expect(stored.rows[0].text).toBe('y = sin(x)')
    expect(stored.mode).toBe('deg')
    reloadGraphStoreForTests()
    expect(s().rows[0]!.text).toBe('y = sin(x)')
    expect(s().window).toEqual({ xMin: -360, xMax: 360, yMin: -2, yMax: 2 })
    s().clearAll()
    expect(s().rows.map((r) => r.text)).toEqual([''])
    expect(s().window).toEqual(STANDARD_WINDOW)
    expect(s().mode).toBe('deg')
    flushGraphSave()
    expect(readGraphState().rows.map((r) => r.text)).toEqual([''])
  })

  it('a stored graph is checked: bad parts take their defaults, a broken one is not used', () => {
    expect(normalizeGraphState(null)).toBeNull()
    expect(normalizeGraphState({ version: 2, rows: [] })).toBeNull()
    expect(normalizeGraphState({ version: 1, rows: [{ id: 'r1', text: 5 }] })).toBeNull()
    expect(normalizeGraphState({ version: 1, rows: [{ id: 'r1', text: 'a' }, { id: 'r1', text: 'b' }] })).toBeNull()
    const g = normalizeGraphState({
      version: 1,
      rows: [{ id: 'r7', text: 'y = x', color: 'pink', hidden: 'yes' }],
      sliders: { a: { value: 2, min: 0, max: 5, step: 1 }, b: { value: 1, min: 3, max: 2, step: 1 }, ab: { value: 1, min: 0, max: 2, step: 1 } },
      window: { xMin: 3, xMax: 1, yMin: 0, yMax: 1 },
      mode: 'gradians',
      table: { rowId: 'r9', start: 'zero', step: 0 },
      nextId: 3,
    })!
    expect(g.rows).toEqual([{ id: 'r7', text: 'y = x', color: 'navy', hidden: false }])
    expect(g.sliders).toEqual({ a: { value: 2, min: 0, max: 5, step: 1 } })
    expect(g.window).toEqual(STANDARD_WINDOW)
    expect(g.mode).toBe('rad')
    expect(g.table).toEqual({ rowId: null, start: 0, step: 1 })
    expect(g.nextId).toBe(8)
  })
})

describe('its keys on the math keypad', () => {
  it('x in the grid; then y, the slider letters and e; then √, |x|, sin, cos, tan, ln, log, π, the inequality signs, braces and f(x)', () => {
    const { primary, context } = keypadLayout(KEYPAD_SETS.graph)
    expect(primary.insert).toBe('x')
    expect(context.map((k) => k.label)).toEqual(['y', 'a', 'b', 'h', 'k', 'e', '√', '|x|', 'sin', 'cos', 'tan', 'ln', 'log', 'π', '<', '≤', '>', '≥', '{ }', 'f(x)'])
  })
})
