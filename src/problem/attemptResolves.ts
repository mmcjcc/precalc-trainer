/**
 * Can the saved attempt still be opened? A saved attempt can outlive its problem: a module or template renamed or
 * retired, a build without the class it was for (the store app has no chemistry), or a generator that no longer
 * builds that seed. Its problem route would send her straight back to Home (pages/Problem.tsx), so an attempt that
 * fails this is never offered on Home and never asked about when she opens another problem; the problem she opens
 * replaces it. Her events, and so her mastery and progress, are untouched. Her own problem ("Check my own problem")
 * resolves when its constructor still builds her statement as the same problem.
 */
import { generateProblem, hasModule } from '@/content'
import { ownProblemFromRoute } from '@/content/own'
import type { ModuleId } from '@/shared/types'
import type { Attempt } from '@/store/types'
import { knobsFromFlags, parseSeedParam } from './url'

type Saved = Pick<Attempt, 'id' | 'moduleId' | 'templateId' | 'seed' | 'difficulty'> & { own?: string }

const known = new Map<string, boolean>()

/** The same test the problem route applies: the module is registered and its template builds this seed. Cached. */
export function attemptResolves(attempt: Saved): boolean {
  const key = `${attempt.id}|${attempt.moduleId}|${attempt.templateId}|${attempt.seed}|${attempt.difficulty}|${attempt.own ?? ''}`
  const hit = known.get(key)
  if (hit !== undefined) return hit
  let ok = false
  if (attempt.own !== undefined) {
    const r = ownProblemFromRoute(attempt.moduleId, attempt.templateId, attempt.own, attempt.difficulty)
    ok = r.ok && r.instance.templateId === attempt.templateId
  } else {
    const seed = parseSeedParam(attempt.seed)
    if (hasModule(attempt.moduleId) && seed !== null) {
      try {
        generateProblem(attempt.moduleId as ModuleId, attempt.templateId, seed, knobsFromFlags(attempt.difficulty))
        ok = true
      } catch {
        ok = false
      }
    }
  }
  if (known.size > 32) known.clear()
  known.set(key, ok)
  return ok
}
