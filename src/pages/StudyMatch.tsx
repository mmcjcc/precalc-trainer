import { MatchMode } from '@/study/MatchMode'
import { StudyMissing, StudyModeHeader, useRouteStudySet } from '@/study/frame'

export function StudyMatchPage() {
  const set = useRouteStudySet()
  if (!set) return <StudyMissing />
  return (
    <StudyModeHeader set={set} title="Match">
      <MatchMode set={set} />
    </StudyModeHeader>
  )
}
