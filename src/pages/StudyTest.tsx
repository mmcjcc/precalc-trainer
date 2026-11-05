import { TestMode } from '@/study/TestMode'
import { StudyMissing, StudyModeHeader, useRouteStudySet } from '@/study/frame'

export function StudyTestPage() {
  const set = useRouteStudySet()
  if (!set) return <StudyMissing />
  return (
    <StudyModeHeader set={set} title="Test">
      <TestMode set={set} />
    </StudyModeHeader>
  )
}
