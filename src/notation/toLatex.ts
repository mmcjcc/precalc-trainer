import { compileExpression, isFn, isOp, isUnaryMinus, nodeArgs, type MathNode } from '../engine/math'
import { insertImplicitMul, normalizeGlyphs } from '../engine/parse'
import type { RelOp, Relation, Statement } from '../engine/types'

const OP_TEX: Record<RelOp, string> = {
  '=': '=',
  '<': '<',
  '>': '>',
  '<=': '\\le',
  '>=': '\\ge',
  '!=': '\\ne',
}

/**
 * Placeholder for ± ("+-" in app syntax, which math.js cannot parse). It is injected AFTER
 * `insertImplicitMul`, which lowercases and splits every multi-letter identifier a student types,
 * so no student text can ever contain it.
 */
const PM = 'PMSYM'

function rec(node: MathNode): Record<string, unknown> {
  return node as unknown as Record<string, unknown>
}

function wrap(s: string): string {
  return `{${s}}`
}

function parens(s: string): string {
  return `\\left(${s}\\right)`
}

function symbolName(node: MathNode): string | null {
  if (node.type !== 'SymbolNode') return null
  const name = rec(node).name
  return typeof name === 'string' ? name : null
}

function constantValue(node: MathNode): number | null {
  if (node.type !== 'ConstantNode') return null
  const v = rec(node).value
  return typeof v === 'number' ? v : null
}

function isUnaryPlus(node: MathNode): boolean {
  return (
    node.type === 'OperatorNode' &&
    (rec(node).fn === 'unaryPlus' || (rec(node).op === '+' && nodeArgs(node).length === 1))
  )
}

function isBinaryMinus(node: MathNode): boolean {
  return isOp(node, '-') && nodeArgs(node).length === 2
}

function isSumLike(node: MathNode): boolean {
  return isOp(node, '+') || isBinaryMinus(node)
}

function isNegative(node: MathNode): boolean {
  const v = constantValue(node)
  return isUnaryMinus(node) || (v !== null && v < 0)
}

function startsWithPm(node: MathNode): boolean {
  if (symbolName(node) === PM) return true
  if (isUnaryPlus(node) || isOp(node, '*')) {
    const first = nodeArgs(node)[0]
    return first ? startsWithPm(first) : false
  }
  return false
}

export function nodeToLatex(node: MathNode): string {
  if (node.type === 'ConstantNode') {
    const v = constantValue(node)
    return v !== null ? String(v) : String(rec(node).value)
  }
  const sym = symbolName(node)
  if (sym !== null) {
    if (sym === 'pi') return '\\pi'
    if (sym === 'inf' || sym === 'infinity' || sym === 'oo') return '\\infty'
    if (sym === PM) return '\\pm '
    return sym
  }
  if (isUnaryPlus(node)) {
    const inner = nodeArgs(node)[0]
    return inner ? nodeToLatex(inner) : ''
  }
  if (isUnaryMinus(node)) {
    const inner = nodeArgs(node)[0]
    if (!inner) return '-'
    const tex = nodeToLatex(inner)
    return isSumLike(inner) || isNegative(inner) ? `-${parens(tex)}` : `-${tex}`
  }
  if (isFn(node, 'cbrt')) {
    const inner = nodeArgs(node)[0]
    return `\\sqrt[3]{${inner ? nodeToLatex(inner) : ''}}`
  }
  if (isFn(node, 'sqrt')) {
    const inner = nodeArgs(node)[0]
    return `\\sqrt{${inner ? nodeToLatex(inner) : ''}}`
  }
  if (isFn(node, 'nthRoot') || isFn(node, 'root')) {
    const [a, b] = nodeArgs(node)
    if (a && b) return `\\sqrt[${nodeToLatex(b)}]{${nodeToLatex(a)}}`
  }
  if (isFn(node, 'abs')) {
    const inner = nodeArgs(node)[0]
    return `\\left|${inner ? nodeToLatex(inner) : ''}\\right|`
  }
  if (node.type === 'FunctionNode') {
    const fn = (node as unknown as { fn: { name?: string } | string }).fn
    const name = typeof fn === 'string' ? fn : (fn.name ?? 'f')
    const args = nodeArgs(node).map(nodeToLatex).join(',')
    return `\\mathrm{${name}}\\left(${args}\\right)`
  }
  if (isOp(node, '/')) {
    const [a, b] = nodeArgs(node)
    return `\\frac${wrap(a ? nodeToLatex(a) : '')}${wrap(b ? nodeToLatex(b) : '')}`
  }
  if (isOp(node, '^')) {
    const [a, b] = nodeArgs(node)
    const base = a ? nodeToLatex(a) : ''
    const exp = b ? nodeToLatex(b) : ''
    const needsParens =
      a !== undefined &&
      (isSumLike(a) || isOp(a, '*') || isOp(a, '/') || isOp(a, '^') || isNegative(a))
    return `${needsParens ? parens(base) : base}^{${exp}}`
  }
  if (isOp(node, '*')) {
    const args = nodeArgs(node)
    return args
      .map((a, i) => {
        let tex = nodeToLatex(a)
        if (isSumLike(a) || (i > 0 && isNegative(a))) tex = parens(tex)
        if (i === 0) return tex
        const prev = args[i - 1]!
        // 2·3 and x·2 need an explicit dot; 2x, ±3 and 3x do not.
        const needsDot = a.type === 'ConstantNode' && symbolName(prev) !== PM
        return needsDot ? `\\cdot ${tex}` : tex
      })
      .join('')
  }
  if (isOp(node, '+')) {
    return nodeArgs(node)
      .map(nodeToLatex)
      .reduce((acc, tex, i) => {
        if (i === 0) return tex
        return tex.startsWith('-') || tex.startsWith('\\pm') ? `${acc}${tex}` : `${acc}+${tex}`
      }, '')
  }
  if (isBinaryMinus(node)) {
    const [a, b] = nodeArgs(node)
    const btex = b ? nodeToLatex(b) : ''
    const wrapB = b !== undefined && (isSumLike(b) || isNegative(b) || startsWithPm(b))
    return `${a ? nodeToLatex(a) : ''}-${wrapB ? parens(btex) : btex}`
  }
  try {
    return node.toTex()
  } catch {
    return node.toString()
  }
}

// ---------------------------------------------------------------------------
// Statement rendering (chain-aware: consecutive relations sharing a side print as a < E <= b)
// ---------------------------------------------------------------------------

function clauseToLatex(clause: Relation[]): string {
  const groups: string[] = []
  let current = ''
  let prev: Relation | undefined
  for (const r of clause) {
    if (prev && current && prev.rhsSrc === r.lhsSrc) {
      current += ` ${OP_TEX[r.op]} ${nodeToLatex(r.rhs)}`
    } else {
      if (current) groups.push(current)
      current = `${nodeToLatex(r.lhs)} ${OP_TEX[r.op]} ${nodeToLatex(r.rhs)}`
    }
    prev = r
  }
  if (current) groups.push(current)
  return groups.join(' \\text{ and } ')
}

export function statementToLatex(stmt: Statement): string {
  return stmt.disjuncts.map(clauseToLatex).join(' \\text{ or } ')
}

// ---------------------------------------------------------------------------
// Text rendering: "x = +-3" → "x = \pm 3", "-3 < 2x+1 <= 5" → "-3 < 2x+1 \le 5",
// "x < -2 or x > 5" → "x < -2 \text{ or } x > 5", "f^-1(x) = ..." → "f^{-1}(x) = ..."
// ---------------------------------------------------------------------------

function rewriteAbsBars(src: string): string {
  let s = src
  for (let guard = 0; guard < 8; guard++) {
    const start = s.indexOf('|')
    if (start < 0) return s
    const end = s.indexOf('|', start + 1)
    if (end < 0) return s
    s = `${s.slice(0, start)}abs(${s.slice(start + 1, end)})${s.slice(end + 1)}`
  }
  return s
}

function isLetter(c: string | undefined): boolean {
  return c !== undefined && /[A-Za-z]/.test(c)
}

/** Split on a keyword ("or" / "and") that sits at bracket depth 0 and is not part of a longer word. */
function splitTopLevelWord(src: string, word: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    if (c === '(' || c === '{' || c === '[') depth++
    else if (c === ')' || c === '}' || c === ']') depth = Math.max(0, depth - 1)
    if (depth !== 0) continue
    if (src.startsWith(word, i) && !isLetter(src[i - 1]) && !isLetter(src[i + word.length])) {
      parts.push(src.slice(start, i))
      start = i + word.length
      i = start - 1
    }
  }
  parts.push(src.slice(start))
  return parts
}

const REL_OPS: RelOp[] = ['<=', '>=', '!=', '=', '<', '>']

function topLevelRelOps(src: string): { index: number; op: RelOp }[] {
  const hits: { index: number; op: RelOp }[] = []
  let depth = 0
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    if (c === '(' || c === '{' || c === '[') depth++
    else if (c === ')' || c === '}' || c === ']') depth = Math.max(0, depth - 1)
    if (depth !== 0) continue
    for (const op of REL_OPS) {
      if (src.startsWith(op, i)) {
        hits.push({ index: i, op })
        i += op.length - 1
        break
      }
    }
  }
  return hits
}

function escapeTex(s: string): string {
  return s.replace(/[&%$#_]/g, '\\$&')
}

function sideToLatex(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  const compact = s.replace(/\s+/g, '')
  const inv = compact.match(/^(?:f\^-1|f\^\(-1\)|finv)\(([xyn])\)$/i)
  if (inv) return `f^{-1}(${inv[1]!.toLowerCase()})`
  const fx = compact.match(/^f\(([xyn])\)$/i)
  if (fx) return `f(${fx[1]!.toLowerCase()})`
  try {
    const prepared = insertImplicitMul(s).replace(/\+-/g, `+${PM}*`)
    return nodeToLatex(compileExpression(prepared))
  } catch {
    return escapeTex(s)
  }
}

function chainToLatex(text: string): string {
  const ops = topLevelRelOps(text)
  if (ops.length === 0) return sideToLatex(text)
  const out: string[] = []
  let start = 0
  for (const hit of ops) {
    out.push(sideToLatex(text.slice(start, hit.index)))
    out.push(OP_TEX[hit.op])
    start = hit.index + hit.op.length
  }
  out.push(sideToLatex(text.slice(start)))
  return out.join(' ')
}

/** Render a line of app-syntax work (relation, chain, or/and compound, or bare expression). */
export function toLatex(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  const src = rewriteAbsBars(normalizeGlyphs(trimmed.replace(/\+\/-/g, '+-')))
  const clauses = splitTopLevelWord(src, 'or')
    .map((c) => c.trim())
    .filter(Boolean)
  return clauses
    .map((clause) =>
      splitTopLevelWord(clause, 'and')
        .map((c) => c.trim())
        .filter(Boolean)
        .map(chainToLatex)
        .join(' \\text{ and } '),
    )
    .join(' \\text{ or } ')
}
