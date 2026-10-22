import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Link, Navigate, Route, Routes, useLocation, useNavigationType, useParams } from 'react-router-dom'
import { isFullScreenPath, useFullScreenPageShown } from '@/components/appChrome'
import { MathKeypad } from '@/components/MathKeypad'
import { JuiceLayers } from '@/components/juice/JuiceLayers'
import { useJuice } from '@/components/juice/useJuice'
import { useMonsterCatches } from '@/components/monsters/catchMoment'
import { isNavActive, navItems, tabItems, type NavItem } from '@/components/navItems'
import { useRewardTicks } from '@/components/rewards/haptics'
import { TabBar } from '@/components/TabBar'
import { Toasts } from '@/components/Toast'
import { useBreakpoint } from '@/components/useBreakpoint'
import { Home } from '@/pages/Home'
import { ModulePage } from '@/pages/Module'
import { PinPage } from '@/pages/Pin'
import { ProgressPage } from '@/pages/Progress'
import { SettingsPage } from '@/pages/Settings'
import { TutorLogPage } from '@/pages/TutorLog'
import { useStore } from '@/store'
import { STORE } from '@/edition'
import { useTutorStatus } from '@/tutor/useTutorStatus'

// Heavy routes (KaTeX, the workspace flows, the engine playground) load on demand.
const ProblemPage = lazy(() => import('./pages/Problem'))
const ReviewPage = lazy(() => import('./pages/Review'))
const SetPage = lazy(() => import('./pages/SetPage'))
const DrillPage = lazy(() => import('./pages/Drill'))
const MonstersPage = lazy(() => import('./pages/Monsters'))
const GrapherPage = lazy(() => import('./pages/Grapher'))
const SandboxPage = lazy(() => import('./pages/Sandbox'))
const AskPage = lazy(() => import('./pages/AskAnything'))

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

/** The top navigation (wide screens): the app's name and its destinations as text links. */
function Header({ items }: { items: readonly NavItem[] }) {
  const { pathname } = useLocation()
  return (
    <header className="border-b border-navy-100 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 px-4 py-1">
        <Link to="/" className="flex min-h-11 items-center font-semibold text-navy">
          {STORE ? 'Math Trainer' : 'Math & Science Trainer'}
        </Link>
        <nav aria-label="Main" className="-mx-2 max-w-full overflow-x-auto">
          <ul className="flex items-center gap-0.5">
            {items.map((item) => {
              const active = isNavActive(pathname, item.to, item.end)
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-lg px-2.5 text-sm font-semibold ${
                      active
                        ? 'text-navy shadow-[inset_0_-3px_0_var(--color-coral)]'
                        : 'text-navy/70 hover:bg-navy-50 hover:text-navy'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
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

/**
 * A new page opens at its top. Without this, a page opened from far down another one (Settings to Privacy,
 * a module card to its problem) opened scrolled to the middle, which on a phone hides its title and its
 * problem. Back (a POP) keeps whatever position the browser restores.
 */
function ScrollToTopOnNavigate() {
  const { pathname } = useLocation()
  const type = useNavigationType()
  useEffect(() => {
    if (type !== 'POP') window.scrollTo(0, 0)
  }, [pathname, type])
  return null
}

/**
 * The unlocked app: navigation, routes, keypad, toasts. Wide screens keep the top navigation on every page. On a
 * phone the top navigation gives way to a bottom tab bar (Home, Monsters, Graph, Progress, Settings) on menu screens
 * (those five, the class and module pages, the drill, Ask...), and a problem screen or a running set has neither: it is
 * full screen with its own compact header.
 */
function UnlockedShell() {
  const { pathname } = useLocation()
  const tutor = useTutorStatus()
  const items = navItems(Boolean(tutor.status?.configured))
  const phone = useBreakpoint() === 'mobile'
  const fullScreenPage = useFullScreenPageShown()
  const tabs = phone && !fullScreenPage && !isFullScreenPath(pathname)
  return (
    <>
      <ScrollToTopOnNavigate />
      <SkipLink />
      {!phone && <Header items={items} />}
      <main
        id="main"
        tabIndex={-1}
        className={`mx-auto w-full max-w-6xl flex-1 px-4 outline-none ${phone ? 'pt-4' : 'pt-6'} ${tabs ? 'pb-6' : 'pb-24'}`}
      >
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/c/:courseId/:unitId" element={<Home />} />
            <Route path="/c/:courseId" element={<Home />} />
            <Route path="/m/:moduleId" element={<ModulePage />} />
            <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
            <Route path="/g/:moduleId/:templateId/:seed" element={<LegacyGeneratedRedirect />} />
            <Route path="/review/:reviewId" element={<ReviewPage />} />
            <Route path="/set" element={<SetPage />} />
            <Route path="/drill" element={<DrillPage />} />
            <Route path="/monsters" element={<MonstersPage />} />
            <Route path="/graph" element={<GrapherPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/ask" element={<AskPage />} />
            <Route path="/tutor-log" element={<TutorLogPage />} />
            <Route path="/sandbox" element={<SandboxPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      {tabs && <TabBar items={tabItems()} />}
      {/* One math keypad for every page; it only ever opens on a touch screen, for a math box. */}
      <MathKeypad />
      <Toasts />
      {/* Confetti, the "+10" floats and the streak milestone banner (components/juice). */}
      <JuiceLayers />
    </>
  )
}

/** Everything inside the router: PIN gate, navigation, routes, toast host. Tests mount this in a MemoryRouter. */
export function AppShell() {
  const unlocked = useStore((s) => s.auth.ok)
  const pinHash = configuredPinHash()
  // Rewards on and "Vibrate" on: a light tick on a right line or part, and when the goal is met.
  useRewardTicks()
  // Sounds (the chime, the nope, the arpeggio...), the "+10" floats, the goal's confetti and the streak milestones.
  useJuice()
  // Mistake Monsters: the first time she makes a mistake, the verdict shows its monster, caught (once per mistake).
  useMonsterCatches()

  if (pinHash && !unlocked) {
    return (
      <>
        <PinPage expected={pinHash} />
        <Toasts />
      </>
    )
  }

  return <UnlockedShell />
}

export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  )
}
