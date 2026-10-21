/**
 * How a problem type is solved. Step by step: one checked line at a time in a work column, then the answer
 * (inequalities, inverses, difference quotients, even/odd, completing the square, exponential and log equations, log
 * properties). The other types take an answer, or a set of parts.
 *
 * Declared per module: a problem's kind is known only once it is generated, which is too slow for Home (one problem of
 * every type takes over a second). solveStyle.test.ts generates every template and checks these lists against it.
 */

/** Problem kinds solved one checked line at a time. */
export const STEP_KINDS: ReadonlySet<string> = new Set([
  'inequality',
  'inverse',
  'diffQuotient',
  'evenOdd',
  'quadratics',
  'expLogEquations',
  'logProperties',
])

/** Modules whose problems are all solved step by step. */
export const STEP_MODULES: ReadonlySet<string> = new Set([
  'inequalities',
  'inverses',
  'diffQuotient',
  'evenOdd',
  'quadratics',
  'expLogEquations',
  'logProperties',
])

/** Modules that also offer Pick: choosing each next line from three cards (src/problem/cardSources.ts). */
export const PICK_MODULES: ReadonlySet<string> = new Set(['expLogEquations'])

export function isStepKind(kind: string): boolean {
  return STEP_KINDS.has(kind)
}

export function stepByStepModule(moduleId: string): boolean {
  return STEP_MODULES.has(moduleId)
}

export function pickModule(moduleId: string): boolean {
  return PICK_MODULES.has(moduleId)
}
