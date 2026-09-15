import type { ProblemInstance } from '@/content/types'
import type { Attempt } from '@/store'
import type { Completion } from '@/problem/useAttempt'

/** Props every problem-kind flow receives from the Problem page. */
export interface FlowProps {
  instance: ProblemInstance
  /** Live attempt, or the last snapshot once the problem is finished (so the work stays on screen). */
  attempt: Attempt | null
  flags: string
  templateTitle: string
  completion: Completion | null
  /** Close the attempt. Whether the final answer counts as correct is decided by the attempt's records. */
  finish: () => void
}
