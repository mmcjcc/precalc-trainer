/**
 * TUTOR_DAILY_LIMIT questions per person per local day, plus one question in flight per person.
 * A slot is reserved before the provider is called (so parallel requests can't overshoot) and
 * committed afterwards: counted when the provider produced an answer, released without counting
 * when the provider failed or timed out. Seeded from the day's log at start-up, so a restart (or a
 * scale-to-zero cold start) doesn't hand out a fresh allowance.
 */
export type Reservation = 'ok' | 'limit' | 'busy'

export class DailyLimiter {
  private day: string
  private used = new Map<string, number>()
  private inFlight = new Map<string, number>()

  constructor(
    readonly limit: number,
    private readonly today: () => string,
    seed?: Map<string, number>,
  ) {
    this.day = today()
    if (seed) this.used = new Map(seed)
  }

  private roll(): void {
    const d = this.today()
    if (d !== this.day) {
      this.day = d
      this.used.clear()
    }
  }

  usedToday(user: string): number {
    this.roll()
    return this.used.get(user) ?? 0
  }

  remaining(user: string): number {
    return Math.max(0, this.limit - this.usedToday(user))
  }

  reserve(user: string): Reservation {
    this.roll()
    if ((this.inFlight.get(user) ?? 0) > 0) return 'busy'
    if ((this.used.get(user) ?? 0) >= this.limit) return 'limit'
    this.inFlight.set(user, 1)
    return 'ok'
  }

  /** Ends a reservation. Returns the questions left after it. */
  commit(user: string, counted: boolean): number {
    this.roll()
    this.inFlight.delete(user)
    if (counted) this.used.set(user, (this.used.get(user) ?? 0) + 1)
    return this.remaining(user)
  }
}
