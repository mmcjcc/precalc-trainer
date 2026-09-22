# Tutor UI (ask panel, context, parent log)

Step 2 of the split (Grok, 2026-09-21). The server in `server/` is unchanged. This is the screen that
calls it. Uncommitted, for review.

## What landed

- Ask rail panel on every problem (`ProblemFrame`), phone toolbar button included. Hidden unless
  `GET /api/tutor/status` returns `configured: true`. A failed request or a 503 leaves the page
  exactly as before.
- Panel: the standing AI note, this attempt's thread (oldest first), 500-character box with a live
  counter (Enter sends, Shift+Enter a new line), Send, and "N questions left today". One question
  at a time. Answers stream from `POST /api/tutor/ask` via fetch. An error event replaces any
  partial text with its message. "Flag this answer" posts `POST /api/tutor/flag` with the done
  event's id, reason `wrong`, and an optional note, then "Thanks, flagged for a parent to review."
- Thread in `localStorage` under `pct.tutor.<attempt id>` (the store's try/catch adapter). A
  finished attempt's thread is removed when a new attempt starts.
- `buildTutorContext` in `src/problem/tutorContext.ts` (docs/progress/tutor-core.md §6). Each flow
  passes `tutorVerdict` when it is showing a checker result. No name or email.
- `/tutor-log` for a parent (`status.isParent`), linked from Settings only then. Anyone else sees
  "This page is for a parent."
- Vite dev proxy from §8 so `npm run tutor:mock` plus `npm run dev` reaches the mock provider.

## Files

- `src/problem/tutorContext.ts`, `src/problem/tutorContext.test.ts`
- `src/tutor/api.ts`, `threadStorage.ts`, `useTutorStatus.ts`, `TutorPanel.tsx`, `TutorPanel.test.tsx`
- `src/pages/TutorLog.tsx`, `src/pages/TutorLog.test.tsx`
- `src/pages/flows/ProblemFrame.tsx` and the ten flows that show a verdict
- `src/pages/Settings.tsx`, `src/App.tsx`, `vite.config.ts`

## Verification (2026-09-21)

`tsc` clean for `tsconfig.app.json`, `tsconfig.node.json`, and `server/tsconfig.json`.
`vitest run`: 65 files, 1040 tests. `vite build` succeeded.

No browser pass (no dev server in this step). Check the panel at 375px and on a desktop rail,
a streamed answer, a flag, and the parent log against `npm run tutor:mock`.

Flag posts `reason: "wrong"` (the API requires a reason). The control is the one "Flag this answer"
button plus an optional note, not two separate reason buttons.
