/**
 * Function parts (Unit 5): an equation for a graph, a model, an expression in x, graded by equivalence as functions.
 * Builds the part's check (exact at the key points, sampled over two periods or the domain) and keeps only the traps
 * that are really different functions: from the answer, and from each other.
 */
import type { TrigPartCheck, TrigPartTrap } from '@/content/types'
import { exactText, readExact, readFunctionAnswer, sameFunction, spreadSamples, type TrigExact } from '@/engine/trig'

export type FunctionCheck = Extract<TrigPartCheck, { kind: 'function' }>

export function functionCheck(answer: string, variable: 'x' | 't', exactAt: readonly TrigExact[], lo: number, hi: number, bare = false): FunctionCheck {
  return { kind: 'function', answer, variable, exactAt: exactAt.map(exactText), samples: { lo, hi, n: 48 }, bare }
}

function nodeOf(text: string, variable: string) {
  const r = readFunctionAnswer(text, { variable, allowBare: true })
  if (!r.ok) throw new Error(`${text}: ${r.message}`)
  return r.node
}

/** Do two spellings give the same function, by this check? */
export function sameUnder(c: FunctionCheck, a: string, b: string): boolean {
  const exactAt = c.exactAt.map((t) => {
    const v = readExact(t)
    if (v === null || v === 'undefined') throw new Error(`cannot read ${t}`)
    return v
  })
  return sameFunction(nodeOf(a, c.variable), nodeOf(b, c.variable), { variable: c.variable, exactAt, samples: spreadSamples(c.samples.lo, c.samples.hi, c.samples.n) })
}

/** The traps that are different functions from the answer and from every earlier trap (the earlier names it). */
export function distinctFunctionTraps(c: FunctionCheck, traps: readonly TrigPartTrap[]): TrigPartTrap[] {
  const out: TrigPartTrap[] = []
  for (const t of traps) {
    if (sameUnder(c, c.answer, t.text)) continue
    if (out.some((o) => sameUnder(c, o.text, t.text))) continue
    out.push(t)
  }
  return out
}

/** The spellings that really are the answer (each one must grade right). */
export function sameForms(c: FunctionCheck, forms: readonly string[]): string[] {
  return [...new Set(forms)].filter((f) => f !== c.answer && sameUnder(c, c.answer, f))
}
