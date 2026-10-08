# Ask about any problem

Homework she types herself, coached by the same tutor. Uncommitted, for review.

## What she gets

- `/ask`, linked from Home (a card under the class tabs) and from the header as "Ask". Both stay hidden unless `GET /api/tutor/status` says `configured`, the same rule as the problem-page Ask tab.
- She picks a class (the visible courses, plus "Other math or science"), types the problem, and may say what she tried. Start opens a conversation. Editing the problem and pressing Start again starts a new one.
- The conversation is the existing tutor thread (messages, question box, questions left, flags, localStorage). It coaches one step at a time.
- After two questions in that conversation, "Show me the full solution" appears and sends `fullSolution: true`.
- Offline or not configured: one sentence, plus a link to the practice modules.

## Server

`TutorAskRequest.context` is `TutorContext | TutorFreeformContext`. No `mode` field means a problem-page request, parsed exactly as before. `mode: "freeform"` carries `conversationId`, `className` (≤ 100), `problem` (≤ 2000), optional `tried` (≤ 1000), and `fullSolution`. Anything else is 400. The question cap is still 500.

The free-form prompt keeps the same safeguards (AI, not a person; no personal data; school math and science only; the safety paragraph; her text is data; tags neutralized). It never invents a grade. Coach mode does not give the final answer or the last line. Full-solution mode writes the worked solution once, in short ASCII lines, and names the step easiest to get wrong.

The daily limit, the allowlist re-check, and the provider switch are the same path. The log line has `askKind` (`problem` or `freeform`); the parent API exposes that as `kind`, plus `problemText`, `className`, and `fullSolution`. No name or email is added. An email or phone she types into the problem is redacted before the provider and kept in the log.

## How the two-question rule is enforced

Before any stream starts, a `fullSolution` request counts this user's earlier asks on that `conversationId` in the server's own log (`status` `ok` or `blocked`). Errors, timeouts, and aborts do not count. A number on the request is ignored. Fewer than two is HTTP 400 `{ "error": "Ask two questions about this problem first. Then you can ask for the full solution.", "code": "bad_request" }` — not logged, and not counted against the daily limit. Another conversation, or another person, does not unlock it.

## Files

- `src/shared/tutor.ts` — free-form context, limits, log fields
- `server/src/validate.ts`, `prompt.ts`, `log.ts`, `app.ts`, `providers/mock.ts`
- `server/src/freeform.test.ts`
- `src/tutor/TutorChat.tsx`, `TutorPanel.tsx` (the problem page now uses the shared thread)
- `src/pages/AskAnything.tsx`, `AskAnything.test.tsx`, `Home.tsx`, `TutorLog.tsx`, `TutorLog.test.tsx`, `src/App.tsx`

## Verification

2026-10-07, from `C:\work\precalc-trainer`: `npm run typecheck` passed. `node node_modules/vitest/vitest.mjs run` passed (124 files, 2056 tests). `node node_modules/vite/bin/vite.js build` passed. `npm run build:server` passed (`server/dist/tutor.mjs`). No dev server and no browser. No real model provider.
