/**
 * Opt-in regression sweep (about 100 s): `npm run test:sweep`. Not part of `npm test`.
 *
 * Every canonical step of the inequality and inverse templates, 10 seeds each, both orderings for
 * inverses, through the context engine with swap gating:
 *   - the correct step must be accepted;
 *   - the same step with its sides swapped and the symbol reversed must be accepted;
 *   - broken variants (flipped symbol, a constant changed by one, negated right side) must be
 *     rejected, each with a named lesson or a counterexample.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content/index'
import type { CanonicalStep, ProblemInstance } from '@/content/types'
import { evalExpr, verifyStep } from '@/engine'

const REV: Record<string, string> = { '<': '>', '>': '<', '<=': '>=', '>=': '<=', '=': '=' }
const SEEDS = 10

function splitSingle(line: string): { l: string; op: string; r: string } | null {
  if (/\bor\b|\band\b|\+-/.test(line)) return null
  const parts = line.split(/(<=|>=|<|>|=)/)
  if (parts.length !== 3) return null
  return { l: parts[0]!.trim(), op: parts[1]!, r: parts[2]!.trim() }
}

function mutations(line: string): { kind: string; text: string }[] {
  const out: { kind: string; text: string }[] = []
  const s = splitSingle(line)
  if (s && s.op !== '=') out.push({ kind: 'flip-op', text: `${s.l} ${REV[s.op]} ${s.r}` })
  const m = line.match(/(\d+)(?!.*\d)/)
  if (m && m.index != null) {
    out.push({ kind: 'const+1', text: line.slice(0, m.index) + String(Number(m[1]) + 1) + line.slice(m.index + m[1]!.length) })
  }
  if (s) {
    const rv = evalExpr(s.r, { x: 1.37, y: 2.11 })
    if (rv !== 'undef' && Math.abs(rv) > 1e-9) out.push({ kind: 'negate-rhs', text: `${s.l} ${s.op} -(${s.r})` })
  }
  return out
}

function sweep(p: ProblemInstance, path: CanonicalStep[], name: string, problems: string[]): void {
  let line = p.start!
  let swapped = false
  for (const step of path) {
    const ctx = { vars: p.vars, seed: p.seed, allowSwap: !swapped, checkValue: p.check?.k }
    const good = verifyStep(line, step.text, ctx)
    if (!good.ok) {
      problems.push(`false reject [${name}] ${p.id}: ${line}  ->  ${step.text} (${good.verdict} ${good.pattern?.id ?? ''})`)
      return
    }
    const s = splitSingle(step.text)
    if (s && !verifyStep(line, `${s.r} ${REV[s.op]} ${s.l}`, ctx).ok) {
      problems.push(`swap-sides reject [${name}] ${p.id}: ${line}  ->  ${s.r} ${REV[s.op]} ${s.l}`)
    }
    for (const mu of mutations(step.text)) {
      const r = verifyStep(line, mu.text, ctx)
      if (r.ok) problems.push(`false accept (${mu.kind}) [${name}] ${p.id}: ${line}  ->  ${mu.text} (canonical ${step.text})`)
      else if (!r.pattern && !r.counterexample) problems.push(`no lesson (${mu.kind}) [${name}] ${p.id}: ${line}  ->  ${mu.text}`)
    }
    if (good.swapped) swapped = true
    line = step.text
  }
}

describe('canonical-path mutation sweep', () => {
  for (const moduleId of ['inequalities', 'inverses'] as const) {
    for (const t of getModule(moduleId).templates) {
      it(`${t.id}`, { timeout: 300_000 }, () => {
        const problems: string[] = []
        for (let n = 1; n <= SEEDS; n++) {
          const p = generateProblem(moduleId, t.id, n * 104729 + 7)
          sweep(p, p.canonical, 'canonical', problems)
          if (p.canonicalAlt?.length) sweep(p, p.canonicalAlt, 'alt', problems)
        }
        expect(problems).toEqual([])
      })
    }
  }
})
