import { Link, useParams } from 'react-router-dom'
import { useStore } from '@/store'
import type { StudySet } from '@/store/studySets'
import type { ReactNode } from 'react'

export function useStudySet(id: string | undefined): StudySet | null {
  return useStore((s) => (id ? (s.studySets.find((set) => set.id === id) ?? null) : null))
}

export function useRouteStudySet(): StudySet | null {
  const { setId } = useParams()
  return useStudySet(setId)
}

export function StudyMissing() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
      <h1 className="text-2xl font-semibold text-navy">Study sets</h1>
      <p className="text-navy">That study set isn't on this device.</p>
      <Link to="/study" className="font-semibold text-navy underline">
        Back to your sets
      </Link>
    </div>
  )
}

export function StudyModeHeader({ set, title, children }: { set: StudySet; title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <Link to={`/study/${set.id}`} className="text-sm font-semibold text-navy underline">
        Back to {set.title}
      </Link>
      <h1 className="text-2xl font-semibold text-navy">{title}</h1>
      {children}
    </div>
  )
}
