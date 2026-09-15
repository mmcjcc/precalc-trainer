import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content/index'
import { evalExpr, isOneToOne, verifyStep } from '@/engine'
import type { CanonicalStep, ProblemInstance } from '@/content/types'

const SEEDS = Array.from({ length: 25 }, (_, i) => (i + 1) * 7919 + 11)

function walk(p: ProblemInstance, path: CanonicalStep[], name: string): string[] {
  const failures: string[] = []
  let line = p.start!
  let swapped = false
  for (const s of path) {
    const r = verifyStep(line, s.text, {
      vars: p.vars,
      seed: p.seed,
      allowSwap: !swapped,
      checkValue: p.check?.k,
      moduleId: 'inverses',
    })
    if (!r.ok) {
      failures.push(
        `${p.id} [${name}] ${line}  →  ${s.text}  (${s.tag}) :: ${r.verdict} ${r.pattern?.id ?? ''} ${r.counterexample?.message ?? r.parseError?.message ?? ''}`,
      )
      break
    }
    if (r.swapped) swapped = true
    line = s.text
  }
  return failures
}

describe('inverse templates — canonical paths through the context engine', () => {
  const templates = getModule('inverses').templates
  it('registers all six inverse families', () => {
    expect(templates.map((t) => t.id).sort()).toEqual(
      ['inv.cbrt-shift', 'inv.frac-linear', 'inv.linear', 'inv.mobius', 'inv.quadratic-not', 'inv.rational'].sort(),
    )
  })
  for (const t of templates) {
    it(`${t.id}: canonical + alt accepted, swap once, clean check values`, { timeout: 300_000 }, () => {
      const failures: string[] = []
      for (const seed of SEEDS) {
        const p = generateProblem('inverses', t.id, seed)
        failures.push(...walk(p, p.canonical, 'canonical'))
        if (p.canonicalAlt?.length) failures.push(...walk(p, p.canonicalAlt, 'alt'))
        const f = p.statementText.replace(/^y = /, '')
        if (p.answer.type !== 'inverse' || !p.check) {
          failures.push(`${p.id}: missing inverse answer or check value`)
          continue
        }
        const { k, fk, twin } = p.check
        if (!Number.isInteger(k) || !Number.isInteger(fk)) failures.push(`${p.id}: non-integer check ${k} → ${fk}`)
        const fAtK = evalExpr(f, { x: k })
        if (fAtK === 'undef' || Math.abs(fAtK - fk) > 1e-9) failures.push(`${p.id}: f(${k}) = ${fAtK}, stored ${fk}`)
        const oto = isOneToOne(f, p.seed).oneToOne
        if (oto !== p.answer.oneToOne) failures.push(`${p.id}: isOneToOne=${oto} but answer.oneToOne=${p.answer.oneToOne}`)
        if (p.answer.oneToOne) {
          const back = p.answer.inverse ? evalExpr(p.answer.inverse, { x: fk }) : 'undef'
          if (back === 'undef' || Math.abs(back - k) > 1e-9) failures.push(`${p.id}: f⁻¹(${fk}) = ${back}, expected ${k}`)
        } else {
          const ft = twin == null ? 'undef' : evalExpr(f, { x: twin })
          if (twin == null || ft === 'undef' || Math.abs(ft - fk) > 1e-9) failures.push(`${p.id}: twin ${twin} gives ${ft}, expected ${fk}`)
        }
        for (const calc of ['ti84', 'nspire'] as const) {
          const blob = p.calc[calc].map((s) => s.keys).join('\n')
          if (!p.calc[calc].length) failures.push(`${p.id}: empty ${calc} panel`)
          else if (!blob.includes(String(k))) failures.push(`${p.id}: ${calc} panel never mentions k = ${k}`)
        }
      }
      expect(failures).toEqual([])
    })
  }
})
