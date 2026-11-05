import { Link, useNavigate } from 'react-router-dom'
import { ImportPanel } from '@/study/ImportPanel'

/** Paste a classmate's code, check it, then keep a copy. */
export function StudyImportPage() {
  const navigate = useNavigate()
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <Link to="/study" className="text-sm font-semibold text-navy underline">
        Back to your sets
      </Link>
      <h1 className="text-3xl font-semibold text-navy">Import a set</h1>
      <p className="text-navy/80">Paste the whole code. You'll see the set before it is added.</p>
      <ImportPanel onAdded={(id) => navigate(`/study/${id}`)} />
    </div>
  )
}
