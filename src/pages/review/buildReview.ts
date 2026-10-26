/**
 * Build a review set. Same seed and same event log → the same problems.
 * Weights reuse `weakSpotWeights` (never tried, mastered, first-try rate) and add the
 * slips still in the event log: a rejection, a wrong final answer, and a named mistake.
 */
import { DEFAULT_REVIEW_COUNT, getReview, resolveReview, type ResolvedTopic } from '@/content'
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import { weakSpotWeights, withoutOwn } from '@/store/selectors'
import type { Ev } from '@/store/types'
import type { ReviewProblem } from './session'

export interface BuiltReview {
  reviewId: string
  seed: number
  count: number
  problems: ReviewProblem[]
}

interface Draft {
  topicId: string
  moduleId: string
  templateId: string
}

/**
 * Weak-spot weight plus recent rejections, wrong finals, and named mistakes (the pattern). Her own problems ("Check
 * my own problem") are left out: their difficulty is unknown, so they never steer the review's picks.
 */
export function reviewTemplateWeights(all: Ev[], templateIds: string[]): Map<string, number> {
  const events = withoutOwn(all)
  const base = weakSpotWeights(events, templateIds)
  const extra = new Map<string, number>()
  const add = (skill: string, n: number) => extra.set(skill, (extra.get(skill) ?? 0) + n)
  for (const e of events) {
    if (e.t === 'step_rejected') add(e.skill, e.pattern ? 2 : 1)
    else if (e.t === 'final_answer' && !e.correct) add(e.skill, e.pattern ? 2 : 1)
  }
  const out = new Map<string, number>()
  for (const row of base) out.set(row.skill, row.weight + (extra.get(row.skill) ?? 0))
  return out
}

function pickIndex(rng: Rng, weights: number[]): number {
  const total = weights.reduce((s, w) => s + w, 0)
  if (!(total > 0)) return Math.max(0, weights.length - 1)
  let r = rng.next() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!
    if (r < 0) return i
  }
  return weights.length - 1
}

function takeOne<T>(rng: Rng, items: readonly T[], weight: (item: T) => number): { picked: T; rest: T[] } {
  const index = pickIndex(rng, items.map(weight))
  return { picked: items[index]!, rest: items.filter((_, i) => i !== index) }
}

interface TopicGroup {
  key: string
  weight: number
  items: { topic: ResolvedTopic; templateId: string; baseWeight: number }[]
}

function buildTopicGroups(topics: readonly ResolvedTopic[]): TopicGroup[] {
  const byKey = new Map<string, TopicGroup>()
  for (const topic of topics) {
    const key = topic.domainId ?? topic.id
    const tWeight = topic.weight && topic.weight > 0 ? topic.weight : 1
    const perTemplate = tWeight / Math.max(1, topic.templates.length)
    let group = byKey.get(key)
    if (!group) {
      group = { key, weight: 0, items: [] }
      byKey.set(key, group)
    }
    group.weight += tWeight
    for (const tp of topic.templates) {
      group.items.push({ topic, templateId: tp.id, baseWeight: perTemplate })
    }
  }
  return [...byKey.values()]
}

/**
 * How many problems each weighted group gets: its share of the count, at least one each, the rest by largest
 * remainder (ties to the earlier group), so 8 problems at 35 / 35 / 15 / 15 are always 3 / 3 / 1 / 1 and 22 are
 * 8 / 8 / 3 / 3. With fewer problems than groups, that many groups are drawn by weight, one problem each.
 * Review 2026-10-25: drawing the counts at random gave an 8-problem SAT set 2 / 4 / 1 / 1.
 */
function groupQuotas(rng: Rng, groups: readonly TopicGroup[], count: number): number[] {
  const quota = groups.map(() => 0)
  if (count < groups.length) {
    let pool = groups.map((g, i) => ({ g, i }))
    for (let k = 0; k < count; k++) {
      const { picked, rest } = takeOne(rng, pool, (x) => x.g.weight)
      pool = rest
      quota[picked.i] = 1
    }
    return quota
  }
  const total = groups.reduce((s, g) => s + g.weight, 0) || 1
  const ideal = groups.map((g) => (count * g.weight) / total)
  ideal.forEach((x, i) => (quota[i] = Math.max(1, Math.floor(x))))
  let sum = quota.reduce((s, q) => s + q, 0)
  const pick = (better: (a: number, b: number) => boolean, eligible: (i: number) => boolean) => {
    let best = -1
    for (let i = 0; i < quota.length; i++) {
      if (eligible(i) && (best < 0 || better(ideal[i]! - quota[i]!, ideal[best]! - quota[best]!))) best = i
    }
    return best
  }
  while (sum < count) {
    const i = pick((a, b) => a > b, () => true)
    quota[i] = quota[i]! + 1
    sum += 1
  }
  while (sum > count) {
    const i = pick((a, b) => a < b, (j) => quota[j]! > 1)
    quota[i] = quota[i]! - 1
    sum -= 1
  }
  return quota
}

/**
 * Cover as many topics as the count allows (every topic, when it fits), one template each,
 * weighted inside the topic. Fill the remaining slots with replacement, weighted across templates.
 * When topics carry explicit weights (such as the SAT domain shares 35 / 35 / 15 / 15), each weighted
 * domain/topic group gets its share of the count (groupQuotas), drawn inside the group by weak spots.
 * Then shuffle. Problem seeds come from the review seed and the final position.
 */
export function buildReviewSet(reviewId: string, opts: { seed: number; events: Ev[]; count?: number }): BuiltReview {
  const review = getReview(reviewId)
  if (!review) throw new Error(`Unknown review: ${reviewId}`)
  const topics = resolveReview(review)
  const fallbackCount = review.defaultCount ?? DEFAULT_REVIEW_COUNT
  const requested = opts.count ?? fallbackCount
  const count = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : fallbackCount
  const seed = opts.seed >>> 0
  const ids = [...new Set(topics.flatMap((t) => t.templates.map((tp) => tp.id)))]
  const weights = reviewTemplateWeights(opts.events, ids)
  const w = (id: string) => weights.get(id) ?? 0.6
  const rng = makeRng(seed || 1)
  const drafts: Draft[] = []

  const hasExplicitWeights = topics.some((t) => typeof t.weight === 'number' && t.weight > 0)
  if (!hasExplicitWeights) {
    const topicWeight = (topic: ResolvedTopic) => topic.templates.reduce((s, tp) => s + w(tp.id), 0)
    let pool = topics.slice()
    const cover = Math.min(count, pool.length)
    for (let i = 0; i < cover; i++) {
      const { picked, rest } = takeOne(rng, pool, topicWeight)
      pool = rest
      const template = takeOne(rng, picked.templates, (tp) => w(tp.id)).picked
      drafts.push({ topicId: picked.id, moduleId: picked.moduleId, templateId: template.id })
    }

    const all = topics.flatMap((topic) => topic.templates.map((template) => ({ topic, template })))
    while (drafts.length < count) {
      const { topic, template } = takeOne(rng, all, (item) => w(item.template.id)).picked
      drafts.push({ topicId: topic.id, moduleId: topic.moduleId, templateId: template.id })
    }
  } else {
    const groups = buildTopicGroups(topics).filter((g) => g.items.length > 0)
    const quota = groupQuotas(rng, groups, count)
    groups.forEach((group, g) => {
      // Within a group, no type twice until each of its types has had a turn.
      let pool = group.items.slice()
      for (let k = 0; k < quota[g]!; k++) {
        if (pool.length === 0) pool = group.items.slice()
        const { picked: item, rest } = takeOne(rng, pool, (it) => it.baseWeight * w(it.templateId))
        pool = rest
        drafts.push({ topicId: item.topic.id, moduleId: item.topic.moduleId, templateId: item.templateId })
      }
    })
  }

  const problems: ReviewProblem[] = rng.shuffle(drafts).map((draft, i) => ({
    ...draft,
    seed: mixSeed(seed || 1, i + 1),
  }))
  return { reviewId, seed, count: problems.length, problems }
}
