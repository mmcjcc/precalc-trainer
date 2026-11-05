import { FlashMode } from '@/study/FlashMode'
import { StudyMissing, StudyModeHeader, useRouteStudySet } from '@/study/frame'

export function StudyFlashPage() {
  const set = useRouteStudySet()
  if (!set) return <StudyMissing />
  return (
    <StudyModeHeader set={set} title="Flashcards">
      <FlashMode set={set} />
    </StudyModeHeader>
  )
}
