/**
 * Monster Dash: the pure game. A caught monster runs right (the world scrolls left) and one input
 * makes it jump over subject-flavored obstacles. Everything here is deterministic from the seed and
 * the inputs, so the tests can replay whole runs; drawing lives in components/dash/DashGame.tsx.
 *
 * Units: logical pixels on a 320x180 canvas, seconds. `stepDash` mutates its state (one object per
 * run, stepped 60 times a second) — callers treat the state as owned by the loop.
 */
import { makeRng, mixSeed, type Rng } from '@/content/rng'

export const DASH_W = 320
export const DASH_H = 180
/** Top of the ground band. */
export const GROUND_Y = 150

/** The runner's box. Its feet sit on the ground when `y` is RUNNER_Y0. */
export const RUNNER_X = 46
export const RUNNER_SIZE = 22
export const RUNNER_Y0 = GROUND_Y - RUNNER_SIZE

const GRAVITY = 980
const JUMP_V = -380
/** How long a jump keeps the runner off the ground: 2·|JUMP_V|/GRAVITY ≈ 0.776 s. */
export const AIR_TIME = (2 * -JUMP_V) / GRAVITY

const SPEED_START = 150
const SPEED_RAMP = 5.5
const SPEED_CAP = 330

/** Collision forgiveness: both boxes shrink this much on every side before they are compared. */
const MARGIN = 3

/** Obstacles are chunky 8-bit props from her classes; each kind has one fixed box. */
export type ObstacleKind = 'cone' | 'block' | 'flask' | 'pi' | 'twins'

export const OBSTACLE_BOX: Readonly<Record<ObstacleKind, { w: number; h: number }>> = {
  /** A triangle cone (geometry). */
  cone: { w: 14, h: 18 },
  /** An x² crate (algebra). */
  block: { w: 16, h: 16 },
  /** An Erlenmeyer flask (chemistry). */
  flask: { w: 16, h: 20 },
  /** A tall π gate (precalc). */
  pi: { w: 20, h: 26 },
  /** Two low cones in a row — wide, not tall. */
  twins: { w: 30, h: 14 },
}

const KINDS: readonly ObstacleKind[] = ['cone', 'block', 'flask', 'pi', 'twins']

export interface DashObstacle {
  kind: ObstacleKind
  /** Left edge in world-x (world-x 0 is where the run started; the runner sits at `dist` + RUNNER_X). */
  x: number
}

export interface DashState {
  /** Seconds since the run started. */
  time: number
  /** How far the world has scrolled, in logical pixels. */
  dist: number
  speed: number
  /** The runner's top edge. */
  y: number
  vy: number
  grounded: boolean
  obstacles: DashObstacle[]
  /** World-x where the next obstacle spawns. */
  nextAt: number
  over: boolean
  rng: Rng
}

export function dashScore(s: Pick<DashState, 'dist'>): number {
  return Math.floor(s.dist / 8)
}

/**
 * The gap put after an obstacle. The floor grows with speed so a jump that clears one obstacle
 * always lands before the next (air distance is speed·AIR_TIME; the floor stays above it minus the
 * narrowest obstacle). The engine test proves it by replaying a late-jumping runner to the cap.
 */
function nextGap(rng: Rng, speed: number): number {
  return speed * 0.82 + rng.int(60, 240)
}

export function createDash(seed: number): DashState {
  const rng = makeRng(mixSeed(seed, 77))
  const first = DASH_W + 160 + rng.int(0, 120)
  return {
    time: 0,
    dist: 0,
    speed: SPEED_START,
    y: RUNNER_Y0,
    vy: 0,
    grounded: true,
    obstacles: [],
    nextAt: first,
    over: false,
    rng,
  }
}

function collides(s: DashState): boolean {
  const rl = s.dist + RUNNER_X + MARGIN
  const rr = s.dist + RUNNER_X + RUNNER_SIZE - MARGIN
  const rt = s.y + MARGIN
  const rb = s.y + RUNNER_SIZE - MARGIN
  for (const o of s.obstacles) {
    const box = OBSTACLE_BOX[o.kind]
    if (rr <= o.x + MARGIN || rl >= o.x + box.w - MARGIN) continue
    const ot = GROUND_Y - box.h + MARGIN
    const ob = GROUND_Y - MARGIN
    if (rb > ot && rt < ob) return true
  }
  return false
}

/**
 * One frame. `jump` is whether the input (tap, click, space) is freshly pressed this frame; it only
 * does anything on the ground. `dt` is clamped so a stalled tab cannot tunnel the runner through an
 * obstacle (33 ms at the speed cap moves the world 11 px, under the narrowest 14 px box).
 */
export function stepDash(s: DashState, dt: number, jump: boolean): void {
  if (s.over) return
  const step = Math.min(dt, 1 / 30)
  s.time += step
  s.speed = Math.min(SPEED_CAP, SPEED_START + SPEED_RAMP * s.time)
  s.dist += s.speed * step

  if (jump && s.grounded) {
    s.vy = JUMP_V
    s.grounded = false
  }
  if (!s.grounded) {
    s.vy += GRAVITY * step
    s.y += s.vy * step
    if (s.y >= RUNNER_Y0) {
      s.y = RUNNER_Y0
      s.vy = 0
      s.grounded = true
    }
  }

  // Spawn at the horizon, drop what scrolled off the left edge.
  while (s.nextAt < s.dist + DASH_W + 60) {
    const kind = KINDS[s.rng.int(0, KINDS.length - 1)]!
    s.obstacles.push({ kind, x: s.nextAt })
    s.nextAt += OBSTACLE_BOX[kind].w + nextGap(s.rng, s.speed)
  }
  while (s.obstacles.length > 0 && s.obstacles[0]!.x + 40 < s.dist) s.obstacles.shift()

  if (collides(s)) s.over = true
}

/** The nearest obstacle still ahead of the runner's front edge, for the HUD and the auto-player test. */
export function nextObstacle(s: DashState): DashObstacle | null {
  const front = s.dist + RUNNER_X
  for (const o of s.obstacles) {
    const box = OBSTACLE_BOX[o.kind]
    if (o.x + box.w > front) return o
  }
  return null
}
