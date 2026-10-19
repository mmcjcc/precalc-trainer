import type { ExpLogGraphsAnswer, ExpLogGraphsStageId } from '@/content/types'
import { compileExpr, evaluateExpr, logValue, parseExpression, parseSetAnswer } from '@/engine'
import { setsEqual } from '@/notation'
import type { ErrorPatternId } from '@/shared/types'

export type EgGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'mistake'; mistake: ErrorPatternId; witness: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string }

export const EG_KEYS: Record<ExpLogGraphsStageId, string> = {
  domain: 'domain',
  range: 'range',
  asymptote: 'asymptote',
  intercept: 'intercept',
  behavior: 'behavior',
  match: 'match',
  inverse: 'inverse',
}

function correct(message: string): EgGrade {
  return { verdict: 'correct', message }
}

function mistake(id: ErrorPatternId, witness: string): EgGrade {
  return { verdict: 'mistake', mistake: id, witness }
}

function wrong(message: string): EgGrade {
  return { verdict: 'wrong', message }
}

function invalid(message: string): EgGrade {
  return { verdict: 'invalid', message }
}

function evalNumber(text: string): number | null {
  const t = text.trim()
  if (!t) return null
  const lv = logValue(t)
  if (lv && Number.isFinite(lv.value)) return lv.value
  const parsed = parseExpression(t, [])
  if (!parsed.ok) return null
  try {
    const fn = compileExpr(parsed.node)
    const v = evaluateExpr(fn, {})
    return Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

function parseAsymptoteLine(text: string): { axis: 'x' | 'y'; value: number } | null {
  const m = text.trim().match(/^([xy])\s*=\s*(.+)$/i)
  if (!m) return null
  const axis = m[1]!.toLowerCase() as 'x' | 'y'
  const val = evalNumber(m[2]!.trim())
  if (val === null || !Number.isFinite(val)) return null
  return { axis, value: val }
}

function parseExactPoint(text: string): { x: number; y: number } | null {
  const t = text.trim()
  if (!t.startsWith('(') || !t.endsWith(')')) return null
  const inner = t.slice(1, -1).trim()
  let depth = 0
  let commaAt = -1
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) {
      if (commaAt !== -1) return null
      commaAt = i
    }
  }
  if (commaAt === -1) return null
  const left = inner.slice(0, commaAt).trim()
  const right = inner.slice(commaAt + 1).trim()
  if (!left || !right) return null
  const x = evalNumber(left)
  const y = evalNumber(right)
  if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

function normalizeBehavior(text: string): 'increasing' | 'decreasing' | null {
  const t = text.trim().toLowerCase()
  if (t === 'increasing' || t === 'inc' || t === 'increases') return 'increasing'
  if (t === 'decreasing' || t === 'dec' || t === 'decreases') return 'decreasing'
  return null
}

function stripInverseLhs(text: string): { ok: true; expr: string } | { ok: false; message: string } {
  const t = text.trim()
  if (!t) return { ok: false, message: 'Type your answer first.' }
  if (!t.includes('=')) return { ok: true, expr: t }
  const m = t.match(/^(?:y|[fg](?:\s*\^\s*(?:\{\s*-1\s*\}|-1))?\s*\(\s*x\s*\))\s*=\s*(.+)$/i)
  if (!m) {
    return {
      ok: false,
      message: 'Write the inverse solved for y in terms of x, like y = log_2(x - 3) + 1.',
    }
  }
  return { ok: true, expr: m[1]!.trim() }
}

function compileFormulaInX(exprText: string): ((x: number) => number) | null {
  const stripped = stripInverseLhs(exprText)
  if (!stripped.ok) return null
  const parsed = parseExpression(stripped.expr, ['x'])
  if (!parsed.ok) return null
  try {
    const fn = compileExpr(parsed.node)
    return (x: number) => evaluateExpr(fn, { x })
  } catch {
    return null
  }
}

function formulasAgreeOn(a: (x: number) => number, b: (x: number) => number, sampleXs: readonly number[]): boolean {
  let finiteCount = 0
  for (const x of sampleXs) {
    const va = a(x)
    const vb = b(x)
    const aFin = Number.isFinite(va)
    const bFin = Number.isFinite(vb)
    if (aFin !== bFin) return false
    if (aFin && bFin) {
      if (Math.abs(va - vb) > 1e-6 * Math.max(1, Math.abs(va), Math.abs(vb))) return false
      finiteCount++
    }
  }
  return finiteCount >= 3
}

/**
 * Grade an inverse function by composing with the original on the original's domain and range:
 * g(f(x)) = x for x in dom(f) and f(g(y)) = y for y = f(x) in range(f).
 */
export function gradeExpLogInverse(answer: ExpLogGraphsAnswer, stage: ExpLogGraphsAnswer['stages'][number], raw: string): EgGrade {
  const stripped = stripInverseLhs(raw)
  if (!stripped.ok) return invalid(stripped.message)
  if (/(?<![A-Za-z])y(?![A-Za-z])/.test(stripped.expr)) {
    return invalid('Write the inverse in terms of x, not y.')
  }
  const parsed = parseExpression(stripped.expr, ['x'])
  if (!parsed.ok) return invalid(parsed.error.message)
  if (!/(?<![A-Za-z])x(?![A-Za-z])/.test(parsed.text)) {
    return invalid('The inverse function must be an expression in x.')
  }

  let gEval: (x: number) => number
  let fEval: (x: number) => number
  try {
    const gCompiled = compileExpr(parsed.node)
    const fParsed = parseExpression(answer.f, ['x'])
    if (!fParsed.ok) return invalid('Could not read the original function.')
    const fCompiled = compileExpr(fParsed.node)
    gEval = (x: number) => evaluateExpr(gCompiled, { x })
    fEval = (x: number) => evaluateExpr(fCompiled, { x })
  } catch {
    return invalid('Could not evaluate your expression.')
  }

  const { h, k, a, family } = answer
  const domainOffsets = family === 'exp' ? [-2.1, -1.3, -0.5, 0.2, 0.9, 1.7, 2.4] : [0.25, 0.6, 1.3, 2.2, 3.7, 5.5, 8.1]
  const domainXs = domainOffsets.map((d) => h + d)

  let compositionOk = true
  for (const x of domainXs) {
    const y = fEval(x)
    if (!Number.isFinite(y)) continue
    const gx = gEval(y)
    if (!Number.isFinite(gx) || Math.abs(gx - x) > 1e-6 * Math.max(1, Math.abs(x))) {
      compositionOk = false
      break
    }
    const fgy = fEval(gx)
    if (!Number.isFinite(fgy) || Math.abs(fgy - y) > 1e-6 * Math.max(1, Math.abs(y))) {
      compositionOk = false
      break
    }
  }

  if (compositionOk && family === 'exp') {
    // For an exponential original, range(f) is one side of y = k; the inverse must be undefined outside range(f).
    const outsideY = a > 0 ? k - 2.3 : k + 2.3
    if (Number.isFinite(gEval(outsideY))) {
      compositionOk = false
    }
  }

  if (compositionOk) {
    return correct('The inverse function is right.')
  }

  // Check named traps by functional equivalence on sample points.
  const testXs = [-5.3, -3.7, -2.1, -0.7, 0.4, 1.8, 3.2, 4.9, 6.7, 9.3, 12.1]
  for (const trap of stage.traps) {
    const trapFn = compileFormulaInX(trap.text)
    if (trapFn && formulasAgreeOn(gEval, trapFn, testXs)) {
      return mistake(trap.id, trap.witness)
    }
  }

  return wrong('That expression does not compose with the original function to give x.')
}

export function gradeExpLogGraphsStage(answer: ExpLogGraphsAnswer, stageId: ExpLogGraphsStageId, raw: string): EgGrade {
  const stage = answer.stages.find((s) => s.id === stageId)
  if (!stage) return invalid('Unknown stage.')
  const t = raw.trim()
  if (!t) return invalid('Type your answer first.')

  if (stageId === 'domain' || stageId === 'range') {
    const parsed = parseSetAnswer(t)
    if (!parsed.ok) return invalid(parsed.error.message)
    const expected = parseSetAnswer(stage.answerText)
    if (expected.ok && setsEqual(parsed.set, expected.set)) {
      return correct(stageId === 'domain' ? 'The domain is right.' : 'The range is right.')
    }
    for (const trap of stage.traps) {
      const trapSet = parseSetAnswer(trap.text)
      if (trapSet.ok && setsEqual(parsed.set, trapSet.set)) {
        return mistake(trap.id, trap.witness)
      }
    }
    return wrong(stageId === 'domain' ? 'That is not the domain of this function.' : 'That is not the range of this function.')
  }

  if (stageId === 'asymptote') {
    const line = parseAsymptoteLine(t)
    if (!line) {
      return invalid('Write the asymptote as an equation of a line, like y = 2 or x = -3.')
    }
    const expected = parseAsymptoteLine(stage.answerText)
    if (expected && line.axis === expected.axis && Math.abs(line.value - expected.value) <= 1e-9) {
      return correct('The asymptote is right.')
    }
    for (const trap of stage.traps) {
      const trapLine = parseAsymptoteLine(trap.text)
      if (trapLine && line.axis === trapLine.axis && Math.abs(line.value - trapLine.value) <= 1e-9) {
        return mistake(trap.id, trap.witness)
      }
    }
    const axisTrap = stage.traps.find((tr) => tr.id === 'exp_asymptote_axis')
    if (expected && line.axis !== expected.axis && axisTrap) {
      return mistake(axisTrap.id, axisTrap.witness)
    }
    return wrong('That is not the asymptote of this function.')
  }

  if (stageId === 'intercept') {
    const pt = parseExactPoint(t)
    if (!pt) {
      return invalid('Write the intercept as an ordered pair (x, y), like (0, 3) or (2, 0).')
    }
    const expected = parseExactPoint(stage.answerText)
    if (expected && Math.abs(pt.x - expected.x) <= 1e-9 && Math.abs(pt.y - expected.y) <= 1e-9) {
      return correct('The intercept is right.')
    }
    for (const trap of stage.traps) {
      const trapPt = parseExactPoint(trap.text)
      if (trapPt && Math.abs(pt.x - trapPt.x) <= 1e-9 && Math.abs(pt.y - trapPt.y) <= 1e-9) {
        return mistake(trap.id, trap.witness)
      }
    }
    return wrong('That is not the intercept of this function.')
  }

  if (stageId === 'behavior') {
    const beh = normalizeBehavior(t)
    if (!beh) {
      return invalid('Choose or type increasing or decreasing.')
    }
    const expected = normalizeBehavior(stage.answerText)
    if (beh === expected) {
      return correct('The behavior is right.')
    }
    for (const trap of stage.traps) {
      if (normalizeBehavior(trap.text) === beh) {
        return mistake(trap.id, trap.witness)
      }
    }
    return wrong('Check whether the outputs rise or fall as x increases.')
  }

  if (stageId === 'match') {
    const upper = t.toUpperCase()
    let pickedId: 'A' | 'B' | 'C' | 'D' | null = null
    if (upper === 'A' || upper === 'B' || upper === 'C' || upper === 'D') {
      pickedId = upper
    } else if (answer.candidates) {
      const exactCandidate = answer.candidates.find(
        (c) => c.equation.toLowerCase() === t.toLowerCase() || c.f.toLowerCase() === t.toLowerCase(),
      )
      if (exactCandidate) pickedId = exactCandidate.id
    }
    if (!pickedId) {
      return invalid('Choose A, B, C, or D.')
    }
    if (pickedId === stage.answerText.trim().toUpperCase()) {
      return correct('That matches the function.')
    }
    for (const trap of stage.traps) {
      if (trap.text.trim().toUpperCase() === pickedId) {
        return mistake(trap.id, trap.witness)
      }
    }
    return wrong('That candidate does not match every feature of the function.')
  }

  return gradeExpLogInverse(answer, stage, t)
}

export function canonicalGraphEntries(answer: ExpLogGraphsAnswer): Record<string, string> {
  const out: Record<string, string> = {}
  for (const stage of answer.stages) {
    out[EG_KEYS[stage.id]] = stage.answerText
  }
  return out
}

export function egWork(answer: ExpLogGraphsAnswer, entries: Record<string, string> | undefined): string[] {
  if (!entries) return []
  const lines: string[] = []
  for (const stage of answer.stages) {
    const val = entries[EG_KEYS[stage.id]]?.trim()
    if (val) lines.push(`${stage.label}: ${val}`)
  }
  return lines
}
