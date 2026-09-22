import { lazy, Suspense } from 'react'
import { HashRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { Toasts } from '@/components/Toast'
import { Home } from '@/pages/Home'
import { ModulePage } from '@/pages/Module'
import { PinPage } from '@/pages/Pin'
import { ProgressPage } from '@/pages/Progress'
import { SettingsPage } from '@/pages/Settings'
import { TutorLogPage } from '@/pages/TutorLog'
import { useStore } from '@/store'

// Heavy routes (KaTeX, the workspace flows, the engine playground) load on demand.
const ProblemPage = lazy(() => import('./pages/Problem'))
const DrillPage = lazy(() => import('./pages/Drill'))
const SandboxPage = lazy(() => import('./pages/Sandbox'))

const NAV: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/drill', label: 'Drill' },
  { to: '/progress', label: 'Progress' },
  { to: '/settings', label: 'Settings' },
  { to: '/sandbox', label: 'Sandbox' },
]

/** SHA-256 hex from public/config.js (regenerated from APP_PIN in the container). Empty = no gate. */
function configuredPinHash(): string {
  if (typeof window === 'undefined') return ''
  return (window.__PRECALC_CONFIG__?.pinHash ?? '').trim().toLowerCase()
}

function SkipLink() {
  return (
    <button
      type="button"
      onClick={() => document.getElementById('main')?.focus()}
      className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:font-semibold focus:text-navy"
    >
      Skip to content
    </button>
  )
}

function Header() {
  return (
    <header className="border-b border-navy-100 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 px-4 py-1">
        <Link to="/" className="flex min-h-11 items-center font-semibold text-navy">
          Precalc Trainer
        </Link>
        <nav aria-label="Main" className="-mx-2 max-w-full overflow-x-auto">
          <ul className="flex items-center gap-0.5">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-lg px-2.5 text-sm font-semibold ${
                      isActive
                        ? 'text-navy shadow-[inset_0_-3px_0_var(--color-coral)]'
                        : 'text-navy/70 hover:bg-navy-50 hover:text-navy'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}

function Loading() {
  return (
    <p role="status" className="py-10 text-center text-navy/70">
      Loading…
    </p>
  )
}

/** Old spike links (`/g/...`) keep working: same module/template/seed, same query string. */
function LegacyGeneratedRedirect() {
  const { moduleId = '', templateId = '', seed = '' } = useParams()
  const { search } = useLocation()
  return <Navigate to={`/p/${moduleId}/${templateId}/${seed}${search}`} replace />
}

/** Everything inside the router: PIN gate, header, routes, toast host. Tests mount this in a MemoryRouter. */
export function AppShell() {
  const unlocked = useStore((s) => s.auth.ok)
  const pinHash = configuredPinHash()

  if (pinHash && !unlocked) {
    return (
      <>
        <PinPage expected={pinHash} />
        <Toasts />
      </>
    )
  }

  return (
    <>
      <SkipLink />
      <Header />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 outline-none">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/m/:moduleId" element={<ModulePage />} />
            <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
            <Route path="/g/:moduleId/:templateId/:seed" element={<LegacyGeneratedRedirect />} />
            <Route path="/drill" element={<DrillPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/tutor-log" element={<TutorLogPage />} />
            <Route path="/sandbox" element={<SandboxPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <Toasts />
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  )
}
