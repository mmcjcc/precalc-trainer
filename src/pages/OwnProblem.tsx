import { useMemo } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { getTemplate, hasModule } from '@/content'
import { hasOwnProblems, ownCanonicalFlags, ownConstructor, ownOptionsFromFlags, ownProblemFromRoute } from '@/content/own'
import { ownBuilderPath, ownProblemPath } from '@/problem/ownUrl'
import type { OwnBuilderState } from './OwnBuilder'
import { ProblemBody } from './Problem'

/**
 * Her own problem (route `/own/:moduleId/:templateId/:statement`, `?d=` what she asked of the answer: 'r3' rounded to
 * three decimal places): the statement rebuilt by the module's constructor and shown in the module's own flow, exactly
 * as a generated problem of that kind. A reload or Back-and-return rebuilds the same problem, and its saved attempt
 * (keyed by an id built from the statement and the flags, which the attempt keeps as its `difficulty`) brings her lines
 * back. A module without a constructor goes to its module page; a statement that is not one of hers goes to the
 * builder, which says why; flags the module does not write are corrected.
 */
export function OwnProblemPage() {
  const { moduleId, templateId, statement } = useParams()
  const [search] = useSearchParams()
  const given = search.get('d') ?? ''
  const flags = ownCanonicalFlags(moduleId, given)
  const result = useMemo(() => ownProblemFromRoute(moduleId, templateId, statement, flags), [moduleId, templateId, statement, flags])
  if (!moduleId || !hasModule(moduleId)) return <Navigate to="/" replace />
  if (!hasOwnProblems(moduleId)) return <Navigate to={`/m/${moduleId}`} replace />
  if (!result.ok) {
    const kind = templateId ? (ownConstructor(moduleId)?.kindOfTemplate(templateId) ?? undefined) : undefined
    const places = ownOptionsFromFlags(flags)?.places
    const state: OwnBuilderState = { text: statement ?? '', check: true, ...(kind ? { kind } : {}), ...(places ? { places } : {}) }
    return <Navigate to={ownBuilderPath(moduleId)} replace state={state} />
  }
  const instance = result.instance
  if (instance.templateId !== templateId || flags !== given) {
    return <Navigate to={ownProblemPath(moduleId, instance.templateId, instance.own ?? '', flags)} replace />
  }
  return <ProblemBody key={instance.id} instance={instance} flags={flags} templateTitle={getTemplate(instance.moduleId, instance.templateId).title} />
}

export default OwnProblemPage
