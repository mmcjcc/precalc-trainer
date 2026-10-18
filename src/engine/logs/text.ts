/**
 * Text for the logs core. Same convention as the earlier cores: fields named `text` are ASCII app syntax
 * the parser reads back ("log_2(x) + 1", "x = log(7)/log(2)"); sentences (`witness`, `message`,
 * `explanation`, `detail`) are display text with − and subscript bases (log₂(x)).
 */
import { fnName, isOp, nodeArgs, tryConst, type MathNode } from '../math'
import { printNode, type Printed } from '../functions/text'
import { niceNumber } from '../samples'

const ATOM = 5

/** A base for the subscript: "2", "1/2", "b". */
function baseText(b: MathNode): string {
  const v = tryConst(b)
  if (v != null && Number.isInteger(v) && v > 0) return String(v)
  const t = printNode(b, logOverride).text
  return /^[a-z0-9.]+$/i.test(t) ? t : `(${t})`
}

/** log(u, b) prints as log_b(u); exp(u) as e^(u). */
function logOverride(node: MathNode): Printed | null {
  const name = fnName(node)
  if (name === 'log' && nodeArgs(node).length === 2) {
    const [a, b] = nodeArgs(node)
    return { text: `log_${baseText(b!)}(${printNode(a!, logOverride).text})`, prec: ATOM }
  }
  if (name === 'log10') return { text: `log(${printNode(nodeArgs(node)[0]!, logOverride).text})`, prec: ATOM }
  if (name === 'log2') return { text: `log_2(${printNode(nodeArgs(node)[0]!, logOverride).text})`, prec: ATOM }
  // A function in an exponent gets parentheses: e^(ln(7)), not e^ln(7).
  if (isOp(node, '^')) {
    const [b, e] = nodeArgs(node)
    if (b && e && e.type === 'FunctionNode') {
      const base = printNode(b, logOverride)
      return { text: `${base.prec < ATOM ? `(${base.text})` : base.text}^(${printNode(e, logOverride).text})`, prec: 4 }
    }
  }
  return null
}

/** App syntax of a tree: "2log(x) - log_3(x + 1)", "e^(2x)". Round-trips through the parser. */
export function appText(node: MathNode): string {
  return printNode(node, logOverride).text
}

const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' }

/** App syntax → reading text: − for minus, log₂(8) for log_2(8), ≤ ≥. */
export function display(text: string): string {
  return text
    .replace(/\)(?=(?:log|ln|exp|sqrt|cbrt|abs)(?:_\w+)?\()/g, ') · ')
    .replace(/ \* /g, ' · ')
    .replace(/log_(\d+)(?=\()/g, (_m, d: string) => `log${[...d].map((c) => SUB[c] ?? c).join('')}`)
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/(?<![A-Za-z])inf(?![A-Za-z])/g, '∞')
    .replace(/-/g, '−')
}

/** Display text of a tree. */
export function displayNode(node: MathNode): string {
  return display(appText(node))
}

/** A number in app syntax: "3", "-1/2", "2.807" (3 decimals when not a simple fraction). */
export function numText(v: number): string {
  return niceNumber(v)
}

/** A number for a sentence: "−3", "1/2", "2.807". */
export function num(v: number): string {
  return display(niceNumber(v))
}

/** A number to `places` decimals for a sentence: "2.807". */
export function fixed(v: number, places: number): string {
  return display(v.toFixed(places))
}

/** "A", "A and B", "A, B and C". */
export function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** "A", "A or B", "A, B or C". */
export function joinOr(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}`
}
