# Unit 1 review

Mixed practice set for the Unit 1 test. No new maths and no engine changes: a content definition, a seeded builder, and a page that wraps the existing problem screen.

## Decisions

- A review is a list of topics. Each topic names a module; its templates are read from the registry at build time (not copied, and no problem text is stored). Unit 2 is another entry in `REVIEWS`.
- The builder lives next to the page, not in the content layer, because it calls the store's `weakSpotWeights`. Content does not import the store.
- Weight = weak-spot weight (never tried 0.6, mastered 0.05, otherwise 1 − first-try rate) plus recent event-log slips: a rejection, a wrong final answer, and an extra bump when that slip has a catalog pattern. Compacted weekly buckets are not "recent".
- When the count is at least the number of topics, every topic appears once, then the rest of the slots are drawn with replacement by that weight. Fewer problems than topics covers that many topics, weighted the same way. The list is shuffled with the same seed.
- The page is `/review/:reviewId`. It renders the existing problem view; it does not copy a flow. "Next" stays inside the set (the problem chrome's "Next problem" would jump to a random one of the same type).
- The set, the index, per-slot status, and the attempt id are stored at `pct.review.<id>` through the same try/catch storage helpers as the rest of the app. The summary reads those attempt ids back out of the event log. Mistake names are the engine catalog titles, the same ones the Progress page shows.
- Timed uses Settings' test mode: the switch writes `settings.testMode`, and the attempt starts as `timed` the way every other problem does.

## Files

- `src/content/reviews.ts` — definition
- `src/pages/review/buildReview.ts` — builder
- `src/pages/review/session.ts` — save / load / summary
- `src/pages/Review.tsx` — start, problems, summary
- Home card and route `/review/unit1`

## Check by hand

- Phone width (375px): start screen, a problem with the "Problem k of n" bar, the summary. Not checked in a browser (no dev server).
- Timed on: the problem header shows "test mode" and a timer; those problems stay out of mastery.
- Reload mid-problem, and again after finishing one but before Next.
- A topic with a named mistake links to that module; a clean topic does not.

## Verified

- `tsc -p tsconfig.app.json --noEmit` and `tsc -p tsconfig.node.json --noEmit` passed.
- Full Vitest suite: 90 files, 1491 tests passed.
- `vite build` passed. The existing chunk-size warning is unchanged.
