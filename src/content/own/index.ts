/**
 * "Check my own problem": which modules can take her own problem, and their constructors (one per module, beside
 * the module's templates: src/content/modules/<module>/own.ts). See docs/progress/own-problem.md.
 */
import type { ModuleId } from '@/shared/types'
import { ownInequalities } from '../modules/inequalities/own'
import { ownInverses } from '../modules/inverses/own'
import { ownExpLogEquations } from '../modules/expLogEquations/own'
import { ownLogProperties } from '../modules/logProperties/own'
import { ownQuadratics } from '../modules/quadratics/own'
import { ownDiffQuotient } from '../modules/diffQuotient/own'
import { fail, ownFlags, ownOptionsFromFlags, ownStatement, type OwnConstructor, type OwnOptions, type OwnResult } from './core'

export * from './core'

const CONSTRUCTORS: readonly OwnConstructor[] = [ownInequalities, ownInverses, ownExpLogEquations, ownLogProperties, ownQuadratics, ownDiffQuotient]

const BY_MODULE = new Map<string, OwnConstructor>(CONSTRUCTORS.map((c) => [c.moduleId, c]))

/** The modules that offer "Check my own problem", in this order. */
export const OWN_MODULES: readonly ModuleId[] = CONSTRUCTORS.map((c) => c.moduleId)

export function ownConstructor(moduleId: string | undefined): OwnConstructor | null {
  return (moduleId && BY_MODULE.get(moduleId)) || null
}

export function hasOwnProblems(moduleId: string | undefined): boolean {
  return ownConstructor(moduleId) !== null
}

/**
 * Her text as a problem of `kindId` in the module, or why not. Never throws. The options (her answer rounded) reach
 * only a constructor that offers them; elsewhere they are dropped.
 */
export function buildOwnProblem(moduleId: string, kindId: string, text: string, options: OwnOptions = {}): OwnResult {
  const c = ownConstructor(moduleId)
  if (!c) return fail('no_module', 'This module does not check problems of your own yet.')
  try {
    return c.build(kindId, text, c.rounding ? options : {})
  } catch {
    return fail('unsure', 'I’m not sure I can check this one, so I won’t.')
  }
}

/** The route flags (`?d=`) the module would write for these flags: '' where it offers no options or they are not its. */
export function ownCanonicalFlags(moduleId: string | undefined, flags: string | null | undefined): string {
  const c = ownConstructor(moduleId)
  if (!c?.rounding) return ''
  return ownFlags(ownOptionsFromFlags(flags) ?? {})
}

/**
 * The problem a route names (`/own/<module>/<template>/<statement>?d=<flags>`), rebuilt from her statement with the
 * kind that template belongs to and the options its flags carry. The caller compares `instance.templateId` with the
 * route's: a different one means the link was edited by hand or the constructor changed, and the route is corrected.
 */
export function ownProblemFromRoute(moduleId: string | undefined, templateId: string | undefined, statement: string | undefined, flags = ''): OwnResult {
  const c = ownConstructor(moduleId)
  if (!c || !templateId || statement === undefined) return fail('no_module', 'This module does not check problems of your own yet.')
  const kind = c.kindOfTemplate(templateId)
  if (!kind) return fail('no_template', 'That link does not name a kind of problem I check here.')
  return buildOwnProblem(c.moduleId, kind, statement, ownOptionsFromFlags(flags) ?? {})
}

/** Her statement as the route carries it (normalized: the same problem typed twice is the same route). */
export function ownRouteStatement(text: string): string {
  return ownStatement(text)
}
