import { useCallback } from 'react'
import type { ProblemInstance } from '@/content/types'
import { buildTutorContext } from '@/problem/tutorContext'
import type { Attempt } from '@/store'
import type { TutorStatus, TutorVerdict } from '@/shared/tutor'
import { TutorChatPanel } from './TutorChat'

type Props = {
  instance: ProblemInstance
  attempt: Attempt | null
  verdict?: TutorVerdict | null
  finished: boolean
  status: TutorStatus
}

/** Ask tab on a generated problem. The conversation itself lives in TutorChatPanel. */
export function TutorAskPanel({ instance, attempt, verdict, finished, status }: Props) {
  const makeBody = useCallback(
    (question: string) => ({
      question,
      context: buildTutorContext(instance, attempt, verdict, finished),
    }),
    [instance, attempt, verdict, finished],
  )
  return (
    <TutorChatPanel
      threadId={attempt?.id ?? null}
      status={status}
      makeBody={makeBody}
      finished={finished}
      placeholder="Ask about this problem"
    />
  )
}
