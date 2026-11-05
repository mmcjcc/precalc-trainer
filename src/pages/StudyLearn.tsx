import { LearnMode } from '@/study/LearnMode'
import { StudyMissing, StudyModeHeader, useRouteStudySet } from '@/study/frame'

export function StudyLearnPage() {
  const set = useRouteStudySet()
  if (!set) return <StudyMissing />
  return (
    <StudyModeHeader set={set} title="Learn">
      <LearnMode set={set} />
    </StudyModeHeader>
  )
}
