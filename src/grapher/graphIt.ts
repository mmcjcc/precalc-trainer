/**
 * "Graph it" from a problem: which rows a problem may hand the grapher, and in which window. The rule
 * (docs/progress/app-grapher.md): only what the problem already shows her, the function it gives or the equation she
 * has entered herself, never the problem's hidden answer. So per problem type:
 *
 *   quadratics, polynomials (zeros, end behavior, rational zeros, synthetic division), rational functions (features,
 *   an asymptote), exponential and log graphs (features, the inverse's f): the given f;
 *   transformations: f, and g as the problem writes it (g(x) = f(x + 1) + 3); only f when g is the answer;
 *   piecewise: the pieces as the problem shows them (each with its condition), k as a slider when k is the answer;
 *   average rate of change: f;
 *   optimization: her own final equation, once it is right (OptimizationFlow; graphItFromFinal below).
 *
 * Never offered: a polynomial built from its zeros (f is the answer), writing a piecewise function or reading one off
 * its graph (the formulas are the answer, or were never shown), matching a graph (the picture is the answer), a
 * rational equation (where the sides meet is the answer), and every other type. Pure.
 *
 * WHERE IT SHOWS (review, 2026-10-22): the graph of the given f still shows the answer of most of these (a vertex, the
 * zeros, f(c)), so the problem page puts the button only behind the reveal gates that already say so: inside the
 * Graph panel after "Show the graph" and inside the calculator steps after "Show calculator steps"
 * (pages/flows/ProblemFrame.tsx). A problem with neither panel shows no Graph it; the Graph tab is always there.
 */
import type { MathNode } from 'mathjs'
import type { OptimizationAnswer, ProblemInstance } from '@/content/types'
import { FUNC_NAMES } from '@/engine/math'
import { finalRoute, readOptEquation } from '@/engine/optim'
import type { GraphSpec } from '@/shared/types'
import type { GraphColor } from './colors'
import { fitY } from './fit'
import { buildModel } from './model'
import { clampWindow, type ViewWindow } from './view'

export interface GraphItRow {
  text: string
  color?: GraphColor
}

export interface GraphItRequest {
  rows: GraphItRow[]
  /** The problem's own window; absent: Zoom to fit when the grapher opens. */
  window?: ViewWindow
  /** What it graphs, for the button's name: "f(x) = x^2 - 6x + 7". */
  label: string
}

/** The window of a problem's function graph: its x-range, and its y-range or (a square window) the same. */
function windowOf(spec: GraphSpec | undefined): ViewWindow | undefined {
  if (!spec || spec.kind !== 'function' || !spec.xDomain) return undefined
  const [xMin, xMax] = spec.xDomain
  const [yMin, yMax] = spec.yDomain ?? spec.xDomain
  if (!(xMax > xMin) || !(yMax > yMin)) return undefined
  return clampWindow({ xMin, xMax, yMin, yMax })
}

const given = (name: string, f: string, window?: ViewWindow): GraphItRequest => ({
  rows: [{ text: `${name}(x) = ${f}` }],
  ...(window ? { window } : {}),
  label: `${name}(x) = ${f}`,
})

/** What the problem's statement lets her graph, or null where Graph it is not offered. */
export function graphItFromStatement(instance: ProblemInstance): GraphItRequest | null {
  const a = instance.answer
  switch (a.type) {
    case 'quadratics':
      return given('f', a.f, windowOf(a.graph))
    case 'polyZeros':
      // pz.build: the zeros and a point are the problem; f is the answer.
      if (a.form === 'hidden') return null
      return given('f', a.f, windowOf(a.graph))
    case 'polyDivision':
      return given('f', a.f)
    case 'rationalFns':
      // A rational equation: where its sides meet is the answer.
      if (a.question === 'equation' || !a.f) return null
      return given('f', a.f, windowOf(a.graph))
    case 'expLogGraphs':
      // Matching: the picture is the answer. The inverse: f only, never f⁻¹.
      if (a.question === 'match') return null
      return given(a.fnName, a.f, windowOf(a.graph))
    case 'transformations': {
      const window = windowOf(instance.graph)
      const f = { text: `f(x) = ${a.parentFormula}` }
      // Writing g is the question: f alone. Otherwise g is given, as the problem writes it, in terms of f.
      if (a.question === 'equation' || !a.notation) return { rows: [f], ...(window ? { window } : {}), label: f.text }
      const g = { text: `g(x) = ${a.notation}` }
      return { rows: [f, g], ...(window ? { window } : {}), label: `${f.text} and ${g.text}` }
    }
    case 'sinusoids':
    case 'otherTrigGraphs':
    case 'inverseTrig':
      // Unit 5: the given function (its graph shows the features, like a quadratic's: behind the gates). Never an
      // equation she writes, a model, or the matching graphs: there the formula or the picture is the answer, and the
      // template leaves `graphIt` unset.
      if (a.type === 'sinusoids' && a.question !== 'features') return null
      if (a.type === 'otherTrigGraphs' && a.question !== 'features') return null
      return a.graphIt ? given('f', a.graphIt, windowOf(instance.graph)) : null
    case 'piecewiseRate': {
      if (a.question === 'rate') return a.f ? given('f', a.f) : null
      const pieces = a.pieces ?? []
      if ((a.question === 'evaluate' || a.question === 'domain') && pieces.length > 0) {
        // One function in pieces: one colour, each piece only where its condition holds (dots at its ends).
        const rows = pieces.map((p) => ({ text: `y = ${p.formula} {${p.condition}}`, color: 'navy' as const }))
        return { rows, label: 'f, piece by piece' }
      }
      if (a.question === 'continuous' && pieces.length === 2 && a.leftFormula && a.rightFormula) {
        // k is the answer: the pieces keep k, and k gets a slider.
        const rows = [
          { text: `y = ${a.leftFormula} {${pieces[0]!.condition}}`, color: 'navy' as const },
          { text: `y = ${a.rightFormula} {${pieces[1]!.condition}}`, color: 'navy' as const },
        ]
        return { rows, label: 'f, piece by piece, with k on a slider' }
      }
      return null
    }
    default:
      return null
  }
}

/** Every function name the parser knows, longest first (so "asin" goes before "sin"). */
const FUNCTION_WORDS = new RegExp(
  [...FUNC_NAMES]
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[^A-Za-z0-9]/g, ''))
    .join('|'),
  'gi',
)

function rename(node: MathNode, from: string, to: string): MathNode {
  return node.transform((n) => {
    if (n.type === 'SymbolNode' && (n as unknown as { name: string }).name === from) {
      const clone = n.clone() as unknown as { name: string }
      clone.name = to
      return clone as unknown as MathNode
    }
    return n
  })
}

/**
 * Her final equation (optimization), once it is right, as a row: A(x) = 500x − 2x², in a window like the calculator
 * panel's (x where the problem makes sense, y from 0 past the top). A final equation in y is drawn in x, as the TI-84
 * draws Y1 in X (`inX` says so). Null when it cannot be read.
 */
export function graphItFromFinal(answer: OptimizationAnswer, finalText: string): (GraphItRequest & { inX: boolean }) | null {
  const read = readOptEquation(finalText, answer.quantity)
  if (!read.ok) return null
  const route = finalRoute(finalText, answer.quantity, answer.domain)
  if (route === null) return null
  const q = answer.quantity
  const key = read.key
  const clean = finalText.trim().replace(/[−–]/g, '-')
  const head = new RegExp(`^${q}\\s*(?:\\(\\s*[xy]\\s*\\))?\\s*=\\s*(.+)$`, 'i').exec(clean)
  const tail = new RegExp(`^(.+?)=\\s*${q}\\s*(?:\\(\\s*[xy]\\s*\\))?\\s*$`, 'i').exec(clean)
  let text: string
  const body = (head?.[1] ?? tail?.[1])?.trim()
  const withoutNames = (s: string) => s.replace(FUNCTION_WORDS, ' ')
  if (body && !new RegExp(`[${q}${q.toLowerCase()}]`).test(withoutNames(body))) {
    // Her own words: A = x(500 − 2x) becomes A(x) = x(500 − 2x). No function name has a y in it, so y → x is safe.
    text = `${q}(x) = ${route === 'y' ? body.replace(/[yY]/g, 'x') : body}`
  } else {
    // Not solved for the letter (2A = …): the same equation with the letter as y, which the grapher solves for.
    let lhs = rename(read.lhs, key, '__Q__')
    let rhs = rename(read.rhs, key, '__Q__')
    if (route === 'y') {
      lhs = rename(lhs, 'y', 'x')
      rhs = rename(rhs, 'y', 'x')
    }
    text = `${lhs.toString()} = ${rhs.toString()}`.replace(/__Q__/g, 'y')
  }
  const model = buildModel([{ id: 'final', text }])
  const fn = model.curve(0)
  if (!fn) return null
  const [d0, d1] = route === 'y' ? answer.domain.y : answer.domain.x
  const pad = (d1 - d0) * 0.04
  const x0 = d0 - pad
  const x1 = d1 + pad
  const [yMin, yMax] = fitY([fn], d0, d1, [], true)
  return { rows: [{ text }], window: clampWindow({ xMin: x0, xMax: x1, yMin, yMax }), label: 'your final equation', inX: route === 'y' }
}
