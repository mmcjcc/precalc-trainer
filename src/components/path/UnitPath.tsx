import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMotionAllowed } from '@/components/juice/motion'
import { Ring } from '@/components/rewards/Rings'
import { StepBadge } from '@/components/StepBadge'
import { getReview, randomSeed, type CourseDef, type UnitDef } from '@/content'
import { problemPath } from '@/problem/url'
import { skillRings, useEvents, useStore, type RingLevel } from '@/store'
import { levelUps, readPathMemory, rememberPath, type SeenRing } from './pathMemory'
import { StopDialog } from './StopDialog'
import {
  captionSide,
  laneOf,
  pathStops,
  roadCurve,
  setStart,
  solidLine,
  stopName,
  unitPath,
  type PathModule,
  type PathStop,
} from './pathModel'

/** A stop's node (its ring), px: well over the 44 px a finger needs. */
const NODE = 68
/** "You are here": raised, a size up. */
const HERE_NODE = 80
/** A stop's row: the node and the road's gap to the next one. */
const ROW = 84
/** Room above "You are here" for its tag. */
const TAG = 30
/** The trophy or the finish flag. */
const FINISH = 72
/** The road's width. */
const ROAD = 14
/** How far apart the lanes are (the road winds over five): a phone, a wide screen. */
const LANE_PHONE = 44
const LANE_WIDE = 64

/** The face inside a node's ring (the ring's stroke as `Ring` draws it, and a gap). */
function faceOf(size: number): number {
  return size - 2 * Math.max(4, Math.round(size / 10)) - 10
}

/** Star for a stop to do or under way, a check once it is solid. Decorative: the stop's name says its state. */
function Glyph({ level, px }: { level: RingLevel; px: number }) {
  if (level === 'solid' || level === 'mastered') {
    return (
      <svg aria-hidden="true" focusable="false" width={px} height={px} viewBox="0 0 24 24">
        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" className="stroke-white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg aria-hidden="true" focusable="false" width={px} height={px} viewBox="0 0 24 24">
      <path
        d="M12 2.8l2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.87l-5.5 2.88 1.05-6.12L3.1 9.3l6.15-.9z"
        className={level === 'new' ? 'fill-white stroke-navy/50' : 'fill-white stroke-white'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const FACE: Record<RingLevel, string> = {
  new: 'bg-navy-100',
  practiced: 'bg-navy',
  solid: 'bg-ok',
  mastered: 'bg-ok',
}

/**
 * One stop: its node (the ring with the face, raised with "You are here" where the next set starts) and its title
 * beside it. A stop that levelled up since the path last showed it waits until it is in view, then pops and its ring
 * sweeps from where it stood to now (motion allowed only; the stop's name always says its state now).
 */
function StopButton({
  stop,
  here,
  from,
  motion,
  style,
  side,
  open,
  onOpen,
  onPlayed,
  buttonRef,
}: {
  stop: PathStop
  here: boolean
  /** The ring the path last showed, when it levelled up since. */
  from: SeenRing | undefined
  motion: boolean
  style: CSSProperties
  side: 'left' | 'right'
  open: boolean
  onOpen: (el: HTMLButtonElement) => void
  onPlayed: (skill: string) => void
  buttonRef: (el: HTMLButtonElement | null) => void
}) {
  const [phase, setPhase] = useState<'wait' | 'play' | 'idle'>(from ? 'wait' : 'idle')
  const [swept, setSwept] = useState(false)
  const nodeRef = useRef<HTMLSpanElement>(null)

  // Wait until the stop is on screen (Home is long on a phone), then celebrate, once.
  useEffect(() => {
    if (phase !== 'wait') return
    let played = false
    const play = () => {
      if (played) return
      played = true
      setPhase('play')
      onPlayed(stop.templateId)
    }
    const el = nodeRef.current
    if (!el || typeof IntersectionObserver !== 'function') {
      play()
      return
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect()
        play()
      }
    }, { threshold: 0.6 })
    io.observe(el)
    return () => {
      played = true
      io.disconnect()
    }
  }, [phase, onPlayed, stop.templateId])

  useEffect(() => {
    if (phase !== 'play') return
    const sweep = setTimeout(() => setSwept(true), 80)
    const end = setTimeout(() => setPhase('idle'), 900)
    return () => {
      clearTimeout(sweep)
      clearTimeout(end)
    }
  }, [phase])

  const ring = stop.ring
  const level: RingLevel = phase === 'wait' && from ? from.level : ring.level
  const fill = (phase === 'wait' || (phase === 'play' && !swept)) && from ? from.fill : ring.fill
  // A practiced type shows a sliver even when none of its problems went well yet (as the rewards' rings do).
  const value = level === 'practiced' ? Math.max(fill, 0.04) : fill
  const size = here ? HERE_NODE : NODE
  const face = faceOf(size)

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={stopName(stop, here)}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={(e) => onOpen(e.currentTarget)}
      style={style}
      data-path-stop={stop.templateId}
      data-stop-state={ring.level}
      data-here={here ? '' : undefined}
      data-levelup={phase === 'idle' ? undefined : phase}
      className={`path-stop absolute z-[1] flex items-center gap-2.5 rounded-2xl ${side === 'left' ? 'flex-row-reverse text-right' : 'text-left'}`}
    >
      <span
        ref={nodeRef}
        className={`relative inline-flex shrink-0 rounded-full ${phase === 'play' ? 'path-levelup' : ''}`}
        style={{ width: size, height: size }}
      >
        {here && motion && <span aria-hidden className="path-pulse absolute inset-0 rounded-full border-4 border-gold" />}
        {here && (
          <span
            aria-hidden
            className="path-here-tag absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-navy bg-gold px-2.5 py-0.5 text-xs font-bold text-navy"
          >
            You are here
          </span>
        )}
        <Ring value={value} size={size} tone={level === 'solid' || level === 'mastered' ? 'ok' : 'navy'}>
          <span
            className={`path-face flex items-center justify-center rounded-full ${FACE[level]}`}
            data-face={level}
            style={{ width: face, height: face }}
          >
            <Glyph level={level} px={Math.round(face * 0.52)} />
          </span>
        </Ring>
      </span>
      <span className={`path-caption line-clamp-2 min-w-0 text-balance text-sm leading-snug text-navy ${here ? 'font-bold' : 'font-semibold'}`}>{stop.title}</span>
    </button>
  )
}

/** A module's signpost where its stretch of road begins: its title, and the step-by-step mark where it applies. */
function Signpost({ module, first }: { module: PathModule; first: boolean }) {
  return (
    <div className="relative flex justify-center px-2 py-3" data-path-signpost={module.moduleId}>
      <span aria-hidden className={`absolute left-1/2 w-[14px] -translate-x-1/2 bg-navy-100 ${first ? 'top-1/2 bottom-0' : 'inset-y-0'}`} />
      <div className="relative z-[1] flex max-w-full flex-col items-center gap-1 rounded-2xl border-2 border-navy-100 bg-white px-4 py-2 text-center">
        <h3 className="text-sm font-bold text-navy">{module.title}</h3>
        {module.steps && <StepBadge pick={module.pick} />}
      </div>
    </div>
  )
}

/** The road under one row: from the stop before (or the signpost) to this stop, and on to the next signpost or the end. */
function Road({ lane, laneStep, cy, height, fromAbove, toBelow }: { lane: number; laneStep: number; cy: number; height: number; fromAbove: number | null; toBelow: boolean }) {
  const width = 4 * laneStep + 2 * ROAD
  const mid = width / 2
  const x = mid + lane * laneStep
  const top = fromAbove === null ? 0 : ROW / 2
  let d = fromAbove === null ? roadCurve(mid, 0, x, cy) : roadCurve(mid + fromAbove * laneStep, 0, x, top + cy)
  if (toBelow) d += ` ${roadCurve(x, top + cy, mid, top + height)}`
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={width}
      height={top + height}
      viewBox={`0 0 ${width} ${top + height}`}
      className="pointer-events-none absolute z-0 overflow-visible"
      style={{ left: `calc(50% - ${mid}px)`, top: -top }}
    >
      <path d={d} fill="none" strokeWidth={ROAD} strokeLinecap="round" className="stroke-navy-100" />
      <path d={d} fill="none" strokeWidth={3} strokeLinecap="round" strokeDasharray="0 11" className="stroke-white" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg aria-hidden="true" focusable="false" width="34" height="34" viewBox="0 0 24 24">
      <path
        d="M7 3.5h10v4.2a5 5 0 0 1-10 0zM7 5H4.2v1.4A3.4 3.4 0 0 0 7.6 9.8M17 5h2.8v1.4a3.4 3.4 0 0 1-3.4 3.4M12 12.7v3.6M8.6 20.5h6.8M9.6 20.5c0-2.2 1-3.4 2.4-4.2 1.4.8 2.4 2 2.4 4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FlagIcon() {
  return (
    <svg aria-hidden="true" focusable="false" width="30" height="30" viewBox="0 0 24 24">
      <path d="M6 21V3.5M6 4.5h11.5l-2.6 3.9 2.6 3.9H6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Home's unit path (docs/progress/phone-path.md): the selected unit as a road she walks. Its header (the unit's name,
 * "N of M types solid", where she is), then an ordered list of stops, one per problem type in course order with a
 * signpost where each module begins, ending at the unit review's trophy (where the unit has one) or a finish flag.
 * Every stop opens a small sheet (a phone) or popover (wide) with "Practice this type" and "About this module": no
 * locks. "You are here" is the type "Start a set" would start with, from the set builder itself.
 *
 * Mount it once per unit (key it by the unit): it decides on mount which stops levelled up since the path last showed
 * them (pathMemory.ts). The page decides the screen size (`phone`); the path never reads it.
 */
export function UnitPath({ course, unit, phone, onShowUnit }: { course: CourseDef; unit: UnitDef; phone: boolean; onShowUnit: (unitId: string) => void }) {
  const events = useEvents()
  const rewards = useStore((s) => s.rewards)
  const navigate = useNavigate()
  const motion = useMotionAllowed()
  const headingId = useId()
  const hereLineId = useId()
  const rings = useMemo(() => skillRings(events), [events])
  const modules = useMemo(() => unitPath(course, unit, rings), [course, unit, rings])
  const stops = useMemo(() => pathStops(modules), [modules])
  // Where "Start a set" would start (Home passes the unit it shows, as here).
  const start = useMemo(() => setStart(course, events, rewards, Date.now(), unit.id), [course, events, rewards, unit.id])
  const hereId = start && start.unitId === unit.id ? start.templateId : null
  const hereStop = hereId ? stops.find((s) => s.templateId === hereId) : undefined
  const elsewhere = start && start.unitId !== unit.id ? course.units.find((u) => u.id === start.unitId) : undefined
  const elsewhereTitle = useMemo(() => {
    if (!start || !elsewhere) return null
    return unitPath(course, elsewhere, rings).flatMap((m) => m.stops).find((s) => s.templateId === start.templateId)?.title ?? null
  }, [course, elsewhere, rings, start])
  const review = unit.reviewId ? getReview(unit.reviewId) : undefined
  const laneStep = phone ? LANE_PHONE : LANE_WIDE

  // The log as stored (always, once the app has booted): the memory is never compared with an empty log.
  const hydrated = useStore((s) => s.hydrated)
  // The stops that levelled up since the path last showed them: decided once, when this unit's path appears.
  const [ups] = useState<Map<string, SeenRing>>(() =>
    motion && hydrated ? levelUps(readPathMemory(), rings, stops.map((s) => s.templateId)) : new Map(),
  )
  // Remember the rest as shown now; a level-up is remembered when its celebration plays.
  useEffect(() => {
    if (!hydrated) return
    rememberPath(
      rings,
      stops.filter((s) => !ups.has(s.templateId)).map((s) => s.templateId),
    )
  }, [hydrated, rings, stops, ups])
  const onPlayed = useCallback((skill: string) => rememberPath(rings, [skill]), [rings])

  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const [openId, setOpenId] = useState<string | null>(null)
  const [opener, setOpener] = useState<HTMLElement | null>(null)
  const close = useCallback(() => setOpenId(null), [])
  const openStop = openId ? stops.find((s) => s.templateId === openId) : undefined

  function practice(stop: PathStop) {
    navigate(problemPath(stop.moduleId, stop.templateId, randomSeed(), stop.flags))
  }

  function showHere() {
    const el = hereId ? buttons.current.get(hereId) : undefined
    if (!el) return
    el.scrollIntoView?.({ block: 'center', behavior: motion ? 'smooth' : 'auto' })
    el.focus({ preventScroll: true })
  }

  if (stops.length === 0) return null

  return (
    <section aria-labelledby={headingId} className="space-y-2" data-unit-path="">
      <header className="rounded-2xl border border-navy-100 bg-navy-50 p-4">
        <h2 id={headingId} className="text-lg font-semibold text-navy">
          {unit.label} · {unit.title}
        </h2>
        <p className="mt-0.5 text-sm text-navy" data-path-solid="">
          {solidLine(stops)}
        </p>
        {hereStop && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3">
            <p id={hereLineId} className="text-sm text-navy">
              You are here: <span className="font-semibold">{hereStop.title}</span>
            </p>
            <button
              type="button"
              onClick={showHere}
              aria-describedby={hereLineId}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-navy underline"
            >
              Show me
            </button>
          </div>
        )}
        {elsewhere && elsewhereTitle && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3">
            <p id={hereLineId} className="text-sm text-navy">
              Your next set starts in {elsewhere.label} · {elsewhere.title}, with <span className="font-semibold">{elsewhereTitle}</span>.
            </p>
            <button
              type="button"
              onClick={() => onShowUnit(elsewhere.id)}
              aria-describedby={hereLineId}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-navy underline"
            >
              Show that unit
            </button>
          </div>
        )}
      </header>

      <ol role="list" aria-label={`Path through ${unit.label}`} className="relative isolate mx-auto max-w-2xl pb-2" data-path-list="">
        {modules.map((m, mi) =>
          m.stops.map((stop, si) => {
            const here = stop.templateId === hereId
            const lane = laneOf(stop.index)
            const side = captionSide(stop.index)
            const size = here ? HERE_NODE : NODE
            const height = here ? ROW + TAG : ROW
            const cy = here ? TAG + ROW / 2 : ROW / 2
            const centre = lane * laneStep
            const half = size / 2
            const style: CSSProperties =
              side === 'right'
                ? { left: `calc(50% + ${centre - half}px)`, maxWidth: `calc(50% - ${centre - half}px)`, top: cy - half }
                : { right: `calc(50% - ${centre + half}px)`, maxWidth: `calc(50% + ${centre + half}px)`, top: cy - half }
            const prev = si > 0 ? m.stops[si - 1]! : null
            return (
              <li key={stop.templateId} data-path-item="">
                {si === 0 && <Signpost module={m} first={mi === 0} />}
                <div className="relative" style={{ height }}>
                  <Road
                    lane={lane}
                    laneStep={laneStep}
                    cy={cy}
                    height={height}
                    fromAbove={prev ? laneOf(prev.index) : null}
                    toBelow={si === m.stops.length - 1}
                  />
                  <StopButton
                    stop={stop}
                    here={here}
                    from={ups.get(stop.templateId)}
                    motion={motion}
                    style={style}
                    side={side}
                    open={openId === stop.templateId}
                    onOpen={(el) => {
                      setOpener(el)
                      setOpenId(stop.templateId)
                    }}
                    onPlayed={onPlayed}
                    buttonRef={(el) => {
                      if (el) buttons.current.set(stop.templateId, el)
                      else buttons.current.delete(stop.templateId)
                    }}
                  />
                  {!phone && openStop === stop && (
                    <StopDialog
                      stop={stop}
                      here={here}
                      variant="popover"
                      style={{ left: `calc(50% + ${centre}px)`, top: cy + half + 12 }}
                      returnFocus={opener}
                      onClose={close}
                      onPractice={() => practice(stop)}
                    />
                  )}
                </div>
              </li>
            )
          }),
        )}
        <li className="relative flex flex-col items-center pt-3" data-path-finish="">
          <span aria-hidden className="absolute left-1/2 top-0 w-[14px] -translate-x-1/2 bg-navy-100" style={{ height: 12 + FINISH / 2 }} />
          {review ? (
            <Link
              to={`/review/${review.id}`}
              aria-label={`${review.title}: one mixed set from the whole unit`}
              data-path-trophy=""
              className="path-stop relative z-[1] flex flex-col items-center gap-1 rounded-2xl px-3 pb-1"
            >
              <span
                className="path-face path-trophy flex items-center justify-center rounded-full border-4 border-white bg-gold text-gold-text"
                style={{ width: FINISH, height: FINISH }}
              >
                <TrophyIcon />
              </span>
              <span className="text-sm font-bold text-navy">{review.title}</span>
            </Link>
          ) : (
            <div className="relative z-[1] flex flex-col items-center gap-1 px-3 pb-1 text-center" data-path-flag="">
              <span
                aria-hidden
                className="flex items-center justify-center rounded-full border-4 border-navy-100 bg-white text-navy"
                style={{ width: FINISH, height: FINISH }}
              >
                <FlagIcon />
              </span>
              <span className="text-sm font-bold text-navy">Finish line</span>
              <span className="text-sm text-navy">{solidLine(stops)}</span>
            </div>
          )}
        </li>
      </ol>

      {phone && openStop && (
        <StopDialog
          stop={openStop}
          here={openStop.templateId === hereId}
          variant="sheet"
          returnFocus={opener}
          onClose={close}
          onPractice={() => practice(openStop)}
        />
      )}
    </section>
  )
}
