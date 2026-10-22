/**
 * The calculator panels say only what applies to the problem in front of her: the final equation in Y=, a window
 * that holds the vertex, the maximum tool for a largest value and the minimum tool for a smallest one, the (−) key
 * only when the equation starts with a minus, and the vertex formula with this problem's own a and b.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { exactFromText } from '@/engine/optim'
import { niceBound } from './calc'
import { optAnswerOf, valueOf } from './testkit'

const LOOP_TIMEOUT = 120_000
const TEMPLATES = ['opt.wall', 'opt.pens', 'opt.numbers', 'opt.revenue'] as const

/** "(−)3", "( 9 ÷ 4 )", "−(1/2)" back to a number. */
function keyed(text: string): number {
  const t = text.replace(/\(−\)/g, '-').replace(/−/g, '-').replace(/÷/g, '/').replace(/\s+/g, '')
  return Function(`return (${t})`)() as number
}

describe.each(TEMPLATES)('%s calculator steps over 150 seeds', (templateId) => {
  it(
    'Y=, a window around the vertex, the right tool, and −b/(2a) with this problem’s a and b',
    () => {
      const bad: string[] = []
      for (let seed = 1; seed <= 150 && bad.length < 8; seed++) {
        const p = generateProblem('optimization', templateId, seed)
        const a = optAnswerOf(p)
        const [enter, window, tool, formula] = p.calc.ti84
        if (p.calc.ti84.length !== 4 || p.calc.nspire.length !== 4) bad.push(`${p.id}: ${p.calc.ti84.length} steps`)
        const all = [...p.calc.ti84, ...p.calc.nspire].map((s) => `${s.title} ${s.keys} ${s.why ?? ''} ${s.caution ?? ''}`).join(' ')
        if (/π|\b(?:SIN|COS|TAN|sin|cos|tan)\b|DEGREE|RADIAN|angle mode/.test(all)) bad.push(`${p.id}: a key that does not apply`)
        // Y1 is the final equation in x; the (−) caution only where it starts with a minus.
        const y1 = /Y1 = (.+)$/.exec(enter!.keys)?.[1] ?? ''
        if (!y1) bad.push(`${p.id}: no Y1`)
        if (Boolean(enter!.caution) !== y1.startsWith('(-)')) bad.push(`${p.id}: the (−) caution on ${y1}`)
        // The tool: maximum for a largest value, minimum for a smallest.
        const wantTool = a.goal === 'max' ? '4:maximum' : '3:minimum'
        const otherTool = a.goal === 'max' ? 'minimum' : 'maximum'
        if (!tool!.keys.includes(wantTool) || tool!.keys.includes(otherTool) || p.calc.nspire[2]!.keys.toLowerCase().includes(otherTool)) bad.push(`${p.id}: the wrong tool`)
        // The window holds the vertex: its x between Xmin and Xmax, its height between Ymin and Ymax.
        const w = /Xmin = (\S+), Xmax = (\S+), Ymin = (\S+), Ymax = ([^.\s]+)/.exec(window!.keys)
        if (!w) bad.push(`${p.id}: no window`)
        else {
          const [x0, x1, y0, y1v] = w.slice(1, 5).map((s) => keyed(s.replace(/,$/, '')))
          const xv = valueOf(a, a.stages[3]!)
          const top = valueOf(a, a.stages[5]!)
          if (!(x0! <= xv && xv <= x1!)) bad.push(`${p.id}: x = ${xv} outside [${x0}, ${x1}]`)
          if (!(y0! <= top && top <= y1v!)) bad.push(`${p.id}: the ${a.goal} ${top} outside [${y0}, ${y1v}]`)
        }
        // The vertex formula with this problem's a and b (the final equation in x), the 2a in parentheses.
        const fa = exactFromText(String(p.params.a))
        const fb = exactFromText(String(p.params.b))
        const m = /^(.+?) ÷ \( 2 × (.+) \) → ENTER$/.exec(formula!.keys)
        if (!m) bad.push(`${p.id}: no vertex formula in ${formula!.keys}`)
        else if (Math.abs(keyed(m[1]!) + fb.n / fb.d) > 1e-9 || Math.abs(keyed(m[2]!) - fa.n / fa.d) > 1e-9) bad.push(`${p.id}: −b/(2a) with other numbers: ${formula!.keys}`)
      }
      expect(bad).toEqual([])
    },
    LOOP_TIMEOUT,
  )
})

describe('a round number for the window', () => {
  it('rounds away from zero to a short number', () => {
    expect(niceBound(31250 * 1.15)).toBe(40000)
    expect(niceBound(2645 * 1.15)).toBe(4000)
    expect(niceBound(-64 * 1.15)).toBe(-80)
    expect(niceBound(0)).toBe(0)
  })
})
