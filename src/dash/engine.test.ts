/**
 * Monster Dash's pure game, replayed. The auto-player proves every seed is playable to the speed
 * cap: the spawn gap's floor keeps a cleared jump from landing inside the next obstacle, and a
 * late, just-in-time jumper must therefore survive as long as it keeps jumping.
 */
import { describe, expect, it } from 'vitest'
import {
  AIR_TIME,
  createDash,
  dashScore,
  DASH_W,
  GROUND_Y,
  nextObstacle,
  OBSTACLE_BOX,
  RUNNER_SIZE,
  RUNNER_X,
  RUNNER_Y0,
  stepDash,
} from './engine'

const DT = 1 / 60

function autoRun(seed: number, seconds: number) {
  const s = createDash(seed)
  const frames = Math.round(seconds / DT)
  for (let i = 0; i < frames && !s.over; i++) {
    let jump = false
    if (s.grounded) {
      const o = nextObstacle(s)
      if (o) {
        const gap = o.x - (s.dist + RUNNER_X + RUNNER_SIZE)
        jump = gap >= 0 && gap <= s.speed * 0.2
      }
    }
    stepDash(s, DT, jump)
  }
  return s
}

describe('the run', () => {
  it('is deterministic: the same seed and inputs replay to the same place', () => {
    const a = autoRun(42, 20)
    const b = autoRun(42, 20)
    expect(a.dist).toBe(b.dist)
    expect(a.obstacles).toEqual(b.obstacles)
    expect(dashScore(a)).toBe(dashScore(b))
  })

  it('ends on the first obstacle when nobody jumps, with a small score on the board', () => {
    for (const seed of [1, 2, 3, 99]) {
      const s = createDash(seed)
      for (let i = 0; i < Math.round(12 / DT) && !s.over; i++) stepDash(s, DT, false)
      expect(s.over, `seed ${seed}`).toBe(true)
      expect(dashScore(s)).toBeGreaterThan(0)
      // It died at an obstacle, not in open field: one overlaps the runner.
      const front = s.dist + RUNNER_X
      expect(s.obstacles.some((o) => o.x < front + RUNNER_SIZE && o.x + OBSTACLE_BOX[o.kind].w > front)).toBe(true)
    }
  })

  it('a just-in-time jumper survives past the speed cap on every seed tried', () => {
    // The cap is reached ~33 s in; 90 s of survival proves the gaps stay jumpable at full speed.
    for (let seed = 1; seed <= 40; seed++) {
      const s = autoRun(seed, 90)
      expect(s.over, `seed ${seed} died at ${s.time.toFixed(1)}s`).toBe(false)
      expect(s.speed).toBe(330)
      expect(dashScore(s)).toBeGreaterThan(1000)
    }
  })

  it('jumps clear the tallest obstacle with room to spare', () => {
    // Apex height from the jump speed must beat the tallest box plus the collision margins.
    const apex = (380 * 380) / (2 * 980)
    const tallest = Math.max(...Object.values(OBSTACLE_BOX).map((b) => b.h))
    expect(apex).toBeGreaterThan(tallest + 10)
    // And the runner really gets there: step one jump and track the top edge.
    const s = createDash(7)
    stepDash(s, DT, true)
    let top = s.y
    for (let i = 0; i < Math.round(AIR_TIME / DT) + 2; i++) {
      stepDash(s, DT, false)
      top = Math.min(top, s.y)
    }
    expect(RUNNER_Y0 - top).toBeGreaterThan(tallest)
    expect(s.grounded).toBe(true)
    expect(s.y).toBe(RUNNER_Y0)
  })

  it('speed ramps to the cap and never past it; obstacles spawn ahead and fall off behind', () => {
    const s = autoRun(5, 60)
    expect(s.speed).toBe(330)
    for (const o of s.obstacles) {
      expect(o.x + OBSTACLE_BOX[o.kind].w).toBeGreaterThan(s.dist - 60)
      expect(o.x).toBeLessThan(s.dist + DASH_W + 320)
    }
    // Every box stands on the ground inside the world's height.
    for (const box of Object.values(OBSTACLE_BOX)) {
      expect(GROUND_Y - box.h).toBeGreaterThan(0)
    }
  })

  it('a stalled frame cannot tunnel the runner through a box', () => {
    const s = createDash(11)
    // Even a one-second frame is clamped: the world may not move further than the narrowest box.
    const before = s.dist
    stepDash(s, 1, false)
    expect(s.dist - before).toBeLessThan(14)
  })
})
