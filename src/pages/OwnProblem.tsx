import { useMemo } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { getTemplate, hasModule } from '@/content'
import { hasOwnProblems, ownConstructor, ownProblemFromRoute } from '@/content/own'
import { ownBuilderPath, ownProblemPath } from '@/problem/ownUrl'
import type { OwnBuilderState } from './OwnBuilder'
import { ProblemBody } from './Problem'

/**
 * Her own problem (route `/own/:moduleId/:templateId/:statement`): the statement rebuilt by the module's constructor
 * and shown in the module's own flow, exactly as a generated problem of that kind. A reload or Back-and-return
 * rebuilds the same problem, and its saved attempt (keyed by an id built from the statement) brings her lines back.
 * A module without a constructor goes to its module page; a statement that is not one of hers goes to the builder,
 * which says why.
 */
export function OwnProblemPage() {
  const { moduleId, templateId, statement } = useParams()
  const result = useMemo(() => ownProblemFromRoute(moduleId, templateId, statement), [moduleId, templateId, statement])
  if (!moduleId || !hasModule(moduleId)) return <Navigate to="/" replace />
  if (!hasOwnProblems(moduleId)) return <Navigate to={`/m/${moduleId}`} replace />
  if (!result.ok) {
    const state: OwnBuilderState = { text: statement ?? '', check: true, ...(templateId ? { kind: ownConstructor(moduleId)?.kindOfTemplate(templateId) ?? undefined } : {}) }
    return <Navigate to={ownBuilderPath(moduleId)} replace state={state} />
  }
  const instance = result.instance
  if (instance.templateId !== templateId) return <Navigate to={ownProblemPath(moduleId, instance.templateId, instance.own ?? '')} replace />
  return <ProblemBody key={instance.id} instance={instance} flags="" templateTitle={getTemplate(instance.moduleId, instance.templateId).title} />
}

export default OwnProblemPage
