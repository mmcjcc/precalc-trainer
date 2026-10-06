import { useMemo, useRef } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { generateProblem, getTemplate, hasModule } from '@/content'
import type { ProblemInstance } from '@/content/types'
import { useStore, type Attempt } from '@/store'
import { useAttemptLifecycle, useCompletion } from '@/problem/useAttempt'
import { useActiveClock } from '@/problem/useIdleNudge'
import { knobsFromFlags, parseSeedParam } from '@/problem/url'
import { AtomFlow } from './flows/AtomFlow'
import { CompositionFlow } from './flows/CompositionFlow'
import { FunctionOpsFlow } from './flows/FunctionOpsFlow'
import { DiffQuotientFlow } from './flows/DiffQuotientFlow'
import { DomainRangeFlow } from './flows/DomainRangeFlow'
import { PiecewiseRateFlow } from './flows/PiecewiseRateFlow'
import { PolyDivisionFlow } from './flows/PolyDivisionFlow'
import { PolyZerosFlow } from './flows/PolyZerosFlow'
import { QuadraticsFlow } from './flows/QuadraticsFlow'
import { TransformationFlow } from './flows/TransformationFlow'
import { GraphFeaturesFlow } from './flows/GraphFeaturesFlow'
import { EvenOddFlow } from './flows/EvenOddFlow'
import { InequalityFlow } from './flows/InequalityFlow'
import { InverseFlow } from './flows/InverseFlow'
import { NumberLineFlow } from './flows/NumberLineFlow'
import { ElectronFlow } from './flows/ElectronFlow'
import { SigFigFlow } from './flows/SigFigFlow'
import type { FlowProps } from './flows/types'

interface Resolved {
  instance: ProblemInstance
  templateTitle: string
}

function resolve(moduleId: string | undefined, templateId: string | undefined, seedParam: string | undefined, flags: string): Resolved | null {
  if (!moduleId || !templateId || !hasModule(moduleId)) return null
  const seed = parseSeedParam(seedParam)
  if (seed === null) return null
  try {
    const template = getTemplate(moduleId, templateId)
    return { instance: generateProblem(moduleId, templateId, seed, knobsFromFlags(flags)), templateTitle: template.title }
  } catch {
    return null
  }
}

/**
 * The problem screen, from ids rather than the route. The review page wraps this so the flows
 * stay the ones each module already uses.
 */
export function ProblemView({
  moduleId,
  templateId,
  seed,
  flags = '',
}: {
  moduleId: string | undefined
  templateId: string | undefined
  seed: string | undefined
  flags?: string
}) {
  const resolved = useMemo(() => resolve(moduleId, templateId, seed, flags), [moduleId, templateId, seed, flags])
  if (!resolved) return <Navigate to="/" replace />
  if (resolved.instance.kind === 'drill') return <Navigate to="/drill" replace />
  return <ProblemBody key={`${resolved.instance.id}?${flags}`} instance={resolved.instance} flags={flags} templateTitle={resolved.templateTitle} />
}

/** Problem page (route /p/:moduleId/:templateId/:seed?d=<flags>). Unknown module, template, or seed goes home. */
export function ProblemPage() {
  const { moduleId, templateId, seed } = useParams()
  const [search] = useSearchParams()
  return <ProblemView moduleId={moduleId} templateId={templateId} seed={seed} flags={search.get('d') ?? ''} />
}

function ProblemBody({ instance, flags, templateTitle }: { instance: ProblemInstance; flags: string; templateTitle: string }) {
  const takeSecs = useRef<() => number>(() => 0)
  const { completion, finish } = useCompletion(instance, templateTitle, () => takeSecs.current())
  const live = useAttemptLifecycle(instance, flags, !completion)
  // Active seconds run for the whole open attempt (the idle nudge firing does not stop them); the
  // unreported tail is handed to finishAttempt.
  const addActiveSecs = useStore((s) => s.addActiveSecs)
  takeSecs.current = useActiveClock(Boolean(live) && !completion, addActiveSecs)
  // finishAttempt clears the stored attempt; keep the last one so the finished work stays on screen.
  const snapshot = useRef<Attempt | null>(null)
  if (live) snapshot.current = live
  const attempt = live ?? (completion ? snapshot.current : null)
  const props: FlowProps = { instance, attempt, flags, templateTitle, completion, finish }

  switch (instance.kind) {
    case 'inequality':
      return <InequalityFlow {...props} />
    case 'numberLine':
      return <NumberLineFlow {...props} />
    case 'evenOdd':
      return <EvenOddFlow {...props} />
    case 'inverse':
      return <InverseFlow {...props} />
    case 'sigFigs':
      return <SigFigFlow {...props} />
    case 'atoms':
      return <AtomFlow {...props} />
    case 'electrons':
      return <ElectronFlow {...props} />
    case 'diffQuotient':
      return <DiffQuotientFlow {...props} />
    case 'graphFeatures':
      return <GraphFeaturesFlow {...props} />
    case 'domainRange':
      return <DomainRangeFlow {...props} />
    case 'composition':
      return <CompositionFlow {...props} />
    case 'functionOps':
      return <FunctionOpsFlow {...props} />
    case 'transformations':
      return <TransformationFlow {...props} />
    case 'piecewiseRate':
      return <PiecewiseRateFlow {...props} />
    case 'quadratics':
      return <QuadraticsFlow {...props} />
    case 'polyDivision':
      return <PolyDivisionFlow {...props} />
    case 'polyZeros':
      return <PolyZerosFlow {...props} />
    default:
      return <Navigate to="/" replace />
  }
}

export default ProblemPage
