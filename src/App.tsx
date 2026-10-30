import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigationType, useParams } from 'react-router-dom'
import { isFullScreenPath, useDockedComposerShown, useFullScreenPageShown } from '@/components/appChrome'
import { MathKeypad } from '@/components/MathKeypad'
import { JuiceLayers } from '@/components/juice/JuiceLayers'
import { useJuice } from '@/components/juice/useJuice'
import { useMonsterCatches } from '@/components/monsters/catchMoment'
import { NavRail } from '@/components/NavRail'
import { navItems, tabItems } from '@/components/navItems'
import { useAppliedTheme } from '@/components/quests/theme'
import { useRewardTicks } from '@/components/rewards/haptics'
import { TabBar } from '@/components/TabBar'
import { Toasts } from '@/components/Toast'
import { useLayout } from '@/components/useBreakpoint'
import { Home } from '@/pages/Home'
import { ModulePage } from '@/pages/Module'
import { PinPage } from '@/pages/Pin'
import { ProgressPage } from '@/pages/Progress'
import { SettingsPage } from '@/pages/Settings'
import { TutorLogPage } from '@/pages/TutorLog'
import { useStore } from '@/store'
import { useTutorStatus } from '@/tutor/useTutorStatus'

// Heavy routes (KaTeX, the workspace flows, the engine playground) load on demand.
const ProblemPage = lazy(() => import('./pages/Problem'))
const ReviewPage = lazy(() => import('./pages/Review'))
const SetPage = lazy(() => import('./pages/SetPage'))
const DrillPage = lazy(() => import('./pages/Drill'))
const MonstersPage = lazy(() => import('./pages/Monsters'))
const GrapherPage = lazy(() => import('./pages/Grapher'))
const OwnBuilderPage = lazy(() => import('./pages/OwnBuilder'))
const OwnProblemPage = lazy(() => import('./pages/OwnProblem'))
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
 * The unlocked app: navigation, routes, keypad, toasts. The layout follows the window's width (components/useBreakpoint):
 * - the tablet layout (840 px and more: a tablet on its side, a large tablet, a computer): the navigation rail down the
 *   left on every screen (Home, Monsters, Graph, Progress, Settings, then Ask and the Sandbox where the app has them);
 * - the phone layout (below 840 px): a bottom tab bar on menu screens (the five, the class and module pages, the drill,
 *   Ask...), and a problem screen or a running set has none: it is full screen with its own compact header. From 600 px
 *   (a tablet held upright, a phone on its side) the page is a wider reading column (42rem), still one column.
 */
function UnlockedShell() {
  const { pathname } = useLocation()
  const tutor = useTutorStatus()
  const items = navItems(Boolean(tutor.status?.configured))
  const phone = useLayout() === 'phone'
  const fullScreenPage = useFullScreenPageShown()
  const dockedComposer = useDockedComposerShown()
  const tabs = phone && !fullScreenPage && !isFullScreenPath(pathname)
  // The phone's composer sits right on the keypad (or the bottom of the screen): no padding under the page.
  const bottom = tabs ? 'pb-6' : phone && dockedComposer ? 'pb-0' : 'pb-24'
  // Home is a dashboard of cards, so on a desktop it gets a wider page (its cards then pair up side by side);
  // reading pages (a problem, a review, Settings) keep the book-ish 6xl measure. Review 2026-10-26: at 1900 px
  // a third of the window was empty gutter while Home's class column was squeezed to 720 px.
  const home = pathname === '/' || pathname.startsWith('/c/')
  const problem = fullScreenPage || isFullScreenPath(pathname)
  return (
    <>
      <ScrollToTopOnNavigate />
      <SkipLink />
      {!phone && <NavRail items={items} />}
      <main
        id="main"
        tabIndex={-1}
        data-layout={phone ? 'phone' : 'tablet'}
        className={`mx-auto w-full flex-1 outline-none ${phone ? 'max-w-2xl px-4 pt-4' : home || problem ? 'max-w-[88rem] px-6 pt-6' : 'max-w-6xl px-6 pt-6'} ${bottom}`}
      >
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/c/:courseId/:unitId" element={<Home />} />
            <Route path="/c/:courseId" element={<Home />} />
            <Route path="/m/:moduleId" element={<ModulePage />} />
            <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
            <Route path="/g/:moduleId/:templateId/:seed" element={<LegacyGeneratedRedirect />} />
            <Route path="/own/:moduleId" element={<OwnBuilderPage />} />
            <Route path="/own/:moduleId/:templateId/:statement" element={<OwnProblemPage />} />
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
  // The colour theme a daily chest gave her, when she picked it in Settings (rewards on): the navy tokens on <html>.
  useAppliedTheme()

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
