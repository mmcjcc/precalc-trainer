/**
 * A row's KaTeX preview, drawn from what the parser read (parse.ts TexPlan) with the app's own LaTeX writer
 * (`@/notation` toLatex). Her function calls travel through the parser as carrier calls; here they become f(…) again,
 * paired innermost first. Pure.
 */
import { toLatex } from '@/notation'
import { CARRIER_BASE, CARRIER_NAME } from './compile'
import type { RowRel, TexPlan } from './parse'

const START = `\\mathrm{${CARRIER_NAME}}\\left(`
const END = /,-(\d+)\\right\)/g
const OP_TEX: Record<RowRel, string> = { '=': '=', '<': '<', '>': '>', '<=': '\\le', '>=': '\\ge', '!=': '\\ne' }

function escapeTex(s: string): string {
  return s.replace(/[\\{}&%$#_^~]/g, (c) => `\\${c === '\\' ? 'backslash ' : c}`)
}

/** toLatex of a carrier text, with her function names put back: \mathrm{nthroot}\left(u,-1000\right) → f\left(u\right). */
export function carrierTex(text: string, names: ReadonlyMap<number, string>): string {
  let tex: string
  try {
    tex = toLatex(text)
  } catch {
    return escapeTex(text)
  }
  if (tex.includes(START)) {
    type Mark = { at: number; len: number; end: boolean; k: number }
    const marks: Mark[] = []
    for (let at = tex.indexOf(START); at >= 0; at = tex.indexOf(START, at + 1)) marks.push({ at, len: START.length, end: false, k: -1 })
    for (const m of tex.matchAll(END)) {
      const k = Number(m[1]) - CARRIER_BASE
      if (k >= 0 && names.has(k)) marks.push({ at: m.index, len: m[0].length, end: true, k })
    }
    marks.sort((a, b) => a.at - b.at)
    const edits: { at: number; len: number; text: string }[] = []
    const open: Mark[] = []
    for (const m of marks) {
      if (!m.end) {
        open.push(m)
        continue
      }
      const start = open.pop()
      if (!start) continue
      edits.push({ at: start.at, len: start.len, text: `${names.get(m.k)!}\\left(` }, { at: m.at, len: m.len, text: '\\right)' })
    }
    edits.sort((a, b) => b.at - a.at)
    for (const e of edits) tex = tex.slice(0, e.at) + e.text + tex.slice(e.at + e.len)
  }
  // The app's writer glues \pi to a letter after it (\pix); KaTeX needs the space.
  return tex.replace(/\\pi(?=[A-Za-z])/g, '\\pi ')
}

/** The whole row's preview. */
export function planTex(plan: TexPlan, names: ReadonlyMap<number, string>): string {
  const t = (s: string) => carrierTex(s, names)
  const restriction = (r?: string) => (r ? `\\quad\\left\\{ ${t(r)} \\right\\}` : '')
  switch (plan.kind) {
    case 'none':
      return ''
    case 'plain':
      return `\\text{${escapeTex(plan.text)}}`
    case 'expr':
      return `${t(plan.text)}${restriction(plan.restrict)}`
    case 'relation': {
      const side = (s: string) => (/^[A-Za-z]$/.test(s) ? s : t(s))
      return `${side(plan.left)} ${OP_TEX[plan.op]} ${side(plan.right)}${restriction(plan.restrict)}`
    }
    case 'define':
      return `${plan.display}(x) = ${t(plan.body)}`
    case 'points':
      return plan.points.map(([a, b]) => `\\left(${t(a)},\\ ${t(b)}\\right)`).join(',\\ ')
  }
}
