# Tutor core (ask-a-question coach): server, contract, deployment — API document and progress log

Step 1 of the split (Claude, 2026-09-21): the server core, the shared contract, nginx, the images, CI and
the Azure plumbing. **Grok builds the UI from this document** (§6–§8). Nothing committed.

**Status:** server core complete. `npm run typecheck` clean (app + node + server configs); `npm test` 62 files /
1026 tests green (the server's 4 files / 74 tests included); `node node_modules/vite/bin/vite.js build` and
`node server/build.mjs` (-> `server/dist/tutor.mjs`, ~2.4 MB) succeed. The Docker images and the smoke scripts
run only in GitHub Actions (no Docker on the dev box).

## 0. Files

| File | What |
|---|---|
| `src/shared/tutor.ts` | The contract: request, SSE events, status, log, flag types and `TUTOR_LIMITS`. Types + constants only. |
| `server/src/app.ts` | HTTP handler: routes, allowlist re-check, SSE, limits, logging |
| `server/src/prompt.ts` | The fixed system prompt (coach + safety rules) and the per-request problem block |
| `server/src/providers/{gemini,anthropic,mock}.ts` | One adapter per provider; `index.ts` picks one from `TUTOR_PROVIDER` |
| `server/src/{config,auth,limits,log,validate,http,main}.ts` | Environment, principal header, daily limit, JSONL log, body checks, SSE framing, entry point |
| `server/src/*.test.ts`, `server/src/providers/providers.test.ts` | Server tests (mock provider and fake SDK clients; no network) |
| `server/build.mjs`, `server/tsconfig.json`, `server/Dockerfile`, `server/dev-mock.mjs` | esbuild bundle, typecheck config, sidecar image, local mock launcher |
| `nginx.conf` | `/api/` now proxies to 127.0.0.1:3000 (streaming settings); 503 `{"error":"tutor offline"}` without a sidecar |
| `deploy/smoke.sh`, `deploy/smoke-tutor.sh` | Web image checks (updated for `/api/`); tutor image checks alone and behind nginx |
| `deploy/azure-setup.sh` (`tutor`, `tutor-provider`), `deploy/tutor-spec.mjs` | Azure set-up of the sidecar, keys, log share |
| `.github/workflows/{ci,deploy}.yml` | Typecheck/test/build/smoke the tutor; push `precalc-tutor`; roll it out when the app has one |
| `deploy/azure.md` §9, `README.md` | Operator docs and the privacy note |

`package.json`: `@anthropic-ai/sdk` 0.127.0 and `@google/genai` 2.23.0 (dependencies; the SPA never imports
them), scripts `test:server`, `build:server`, `tutor:mock`; `typecheck` also checks `server/tsconfig.json`.
`vite.config.ts`: the test include also covers `server/src/**/*.test.ts`.

## 1. What it does

On any problem she can type a question about THAT problem ("why did my sign flip get rejected?") and get a
short coaching answer streamed back. The model gets the problem, her work, the checker's verdict and named
mistake, and the reference solution (for its eyes only); it explains the checker's decision and never
re-judges it (the checker is exact and wins any disagreement). While the problem is open it never gives the
final answer; once she has finished or the app revealed it, it may walk through the whole solution.

## 2. Endpoints (all under `/api/tutor/`, same origin as the SPA)

nginx lets only allowlisted, signed-in accounts reach `/api/`; the sidecar checks
`X-MS-CLIENT-PRINCIPAL-NAME` against `ALLOWED_USERS` again. The browser sends nothing special: the sign-in
cookie does the work (nginx strips the cookie and Google tokens before the sidecar).

| Method, path | Who | Request | Response |
|---|---|---|---|
| `GET /api/tutor/status` | family | – | `TutorStatus` JSON |
| `POST /api/tutor/ask` | family | `TutorAskRequest` JSON, header `Content-Type: application/json` | `text/event-stream` of `TutorStreamEvent` (§4) |
| `GET /api/tutor/log?limit=N` | `PARENT_USERS` only | `limit` 1–500, default 100 | `TutorLogResponse` JSON, newest first |
| `POST /api/tutor/flag` | family (her own answers; a parent any) | `TutorFlagRequest` JSON | `{ "ok": true }` |

Non-stream failures are JSON `TutorErrorBody` `{ error, code }`:

| Status | code | When | UI |
|---|---|---|---|
| 400 | `bad_request`, `too_long`, `question_too_long` | body shape / a field too long (the `error` names the field) | a bug, or the 500-character cap (enforce `maxLength` in the input) |
| 403 | `forbidden` | account not on the list | should not happen inside the app |
| 403 | `not_parent` | the log, for a non-parent | hide the log link unless `status.isParent` |
| 404 | `not_found` | flag of an unknown / someone else's answer | "Couldn't flag that answer" |
| 405 / 415 | `method_not_allowed` / `unsupported_media_type` | wrong method; POST without JSON content type | a bug |
| 413 | `too_large` | body over 32 KB (nginx refuses over 64 KB with its own 413) | a bug |
| 503 | – | **nginx**, body exactly `{"error":"tutor offline"}`: no sidecar or it is down | "The tutor is offline right now." |

Anything the student can cause at run time (limit, busy, provider down, timeout, safety block, no key) comes
as an SSE `error` event with a friendly sentence instead, so the UI has one path for those.

## 3. The contract (`src/shared/tutor.ts`)

```ts
interface TutorAskRequest { question: string; context: TutorContext }   // question: 1..500 chars after trim

interface TutorContext {
  problemId: string            // ProblemInstance.id
  attemptId?: string           // Attempt.id: the server replays her last 4 answered questions on this attempt
  moduleId: string             // ModuleId
  subject: 'precalculus' | 'chemistry'
  kind: string                 // ProblemKind
  title: string                // <= 200
  instructions: string         // <= 1000
  statement: string            // <= 1000
  work: string[]               // <= 40 lines, each <= 400
  verdict?: TutorVerdict       // the checker's latest decision
  canonical: string[]          // reference only; <= 40 lines, each <= 400
  answer?: string              // reference only; <= 1000
  finished: boolean
  revealed: boolean
}
interface TutorVerdict { status: 'accepted' | 'rejected' | 'correct' | 'wrong' | 'parse_error'; line?: string; message?: string; mistake?: TutorMistake }
interface TutorMistake { id?: string; title: string; lesson: string; witness?: string }

type TutorStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; id: string; remaining: number; limit: number; truncated?: boolean }
  | { type: 'error'; code: TutorErrorCode; message: string; remaining?: number }
type TutorErrorCode = 'unavailable' | 'timeout' | 'limit' | 'busy' | 'blocked' | 'not_configured'

interface TutorStatus { configured: boolean; provider: 'gemini' | 'anthropic' | 'mock'; model: string;
  limit: number; remaining: number; isParent: boolean; logging: 'file' | 'memory' }
interface TutorLogResponse { items: TutorLogItem[]; logging: 'file' | 'memory' }
interface TutorLogItem { id; at; user; problemId; moduleId; question; answer; status: 'ok'|'blocked'|'error'|'timeout'|'aborted';
  counted; finished; revealed; provider; model; verdict?; mistake?; flags: TutorFlag[] }
interface TutorFlagRequest { id: string; reason: 'wrong' | 'inappropriate'; note?: string }   // note <= 500
```

`TUTOR_LIMITS` (import it for the input caps): `question` 500, `field` 1000, `lines` 40, `line` 400,
`flagNote` 500, `bodyBytes` 32768, `historyTurns` 4. Unknown fields are ignored; ids must match
`[A-Za-z0-9_.:@/#?=&+-]{1,200}` (problem and attempt ids do), `moduleId` and `kind` `[A-Za-z0-9_-]{1,60}`.

## 4. SSE format (`POST /api/tutor/ask`)

Status 200, `Content-Type: text/event-stream; charset=utf-8`. Each frame is `event: <type>`, one `data:` line
of JSON (the JSON's `type` equals the event name), and a blank line. Lines starting with `:` are keep-alive
comments (every 15 s while the model thinks): ignore them.

```
event: delta
data: {"type":"delta","text":"The checker named this one: "}

event: delta
data: {"type":"delta","text":"Forgot to flip the inequality. "}

: keep-alive

event: done
data: {"type":"done","id":"4f0c2a9e-...","remaining":28,"limit":30}
```

or, instead of `done`, one `error` (possibly after some deltas: **discard the partial text** and show the
message):

```
event: error
data: {"type":"error","code":"unavailable","message":"The tutor is unavailable right now. Try again in a little while.","remaining":29}
```

| code | message (show as-is) | counted? |
|---|---|---|
| `unavailable` | The tutor is unavailable right now. Try again in a little while. | no |
| `timeout` | The tutor took too long to answer. Try asking again. | no |
| `limit` | You've used all of today's tutor questions. They come back tomorrow. | – (`remaining` 0) |
| `busy` | The tutor is still answering your last question. | – |
| `blocked` | I can't help with that one. Let's get back to the problem. | yes |
| `not_configured` | The tutor isn't set up yet. | – |

`EventSource` can't POST, so read the body with fetch:

```ts
import type { TutorAskRequest, TutorStreamEvent } from '@/shared/tutor'

export async function askTutor(body: TutorAskRequest, on: (e: TutorStreamEvent) => void, signal?: AbortSignal) {
  const res = await fetch('/api/tutor/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
  if (!res.ok || !res.headers.get('content-type')?.startsWith('text/event-stream')) {
    const err = await res.json().catch(() => ({ error: 'tutor offline' }))
    on({ type: 'error', code: 'unavailable', message: res.status === 503 ? 'The tutor is offline right now.' : String(err.error) })
    return
  }
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += value
    let i
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, i); buf = buf.slice(i + 2)
      const data = frame.split('\n').find((l) => l.startsWith('data: '))
      if (data) on(JSON.parse(data.slice(6)) as TutorStreamEvent)
    }
  }
}
```

Closing the panel mid-answer: abort the fetch (the server stops the provider call; it counts only if text had
started). One question at a time per person: disable Ask while streaming (a second one gets `busy`).

## 5. Status fields (`GET /api/tutor/status`)

`configured` false: hide or disable the Ask box ("The tutor isn't set up yet"). `remaining` / `limit`: show
"N questions left today" (also updated by every `done` / `error` event's `remaining`). `isParent`: show a
"Tutor log" link (Settings) that renders `GET /api/tutor/log`. `logging: 'memory'`: the log and the daily count
reset when the tutor restarts (local runs). `provider` / `model`: for the parent's view; not needed for her.
If `status` itself fails (503 offline, network), hide the tutor quietly; the rest of the app is unaffected.

## 6. Building the TutorContext from a ProblemInstance and an Attempt

Build it at the moment she presses Ask, from the flow's current state (never from stale props):

| Field | Source |
|---|---|
| `problemId` | `instance.id` |
| `attemptId` | `attempt.id` (from `useAttemptLifecycle`) |
| `moduleId`, `kind`, `title`, `instructions` | `instance.moduleId`, `instance.kind`, `instance.title`, `instance.instructions` |
| `subject` | `getModule(instance.moduleId).subject === 'Chemistry' ? 'chemistry' : 'precalculus'` (precalculus modules leave `subject` unset) |
| `statement` | `instance.statementText`, except: sigFigs / atoms use `answer.prompt` (plus `answer.context` when not empty); graphFeatures (`statementText` is "the graph") describes the graph in words: `W/M/S shape, turning points (x, y) min/max…, left end up/down, right end up/down`; domainRange prefix `Find the domain of` / `Find the range of`; composition prefix the question (`answer.question`) |
| `work` | step flows (inequality, inverse, evenOdd, diffQuotient): `attempt.steps.map(s => s.text)` (even/odd: prefix each slot's lines `f(-x): ` / `-f(x): `); answer-only flows: what she has entered, one `label: text` per box (`attempt.final.interval`, `.set`, `.sfText` + `.sfPower`, `.atEntries`, `.gfEntries`, `.fnEntries`), empty boxes left out |
| `verdict` | the flow's latest checker result, if any (see below); omit when she hasn't submitted anything yet |
| `canonical` | step kinds: `instance.canonical.map(c => c.text)`; answer-only kinds: `answer.reveal` (sigFigs, atoms, graphFeatures, domainRange, composition); number line / drill: `[]` |
| `answer` | set: `answer.interval` (+ `answer.setBuilder`); parity: `answer.verdict`; inverse: `answer.inverse` or `not one-to-one`; diffQuotient: `answer.simplified`; sigFigs / atoms: `answer.expectedDisplay`; graphFeatures: the six canonical strings; domainRange: `answer.interval`; composition: `simplified` / `valueText` / `interval` by question |
| `finished` | the flow has shown its completion card (problem done recorded) |
| `revealed` | `attempt.steps.some(s => s.revealed) \|\| attempt.final?.revealed === true` (rung 3 or "show the answer" used) |

Verdict mapping (keep the checker's own words; the model is told they are authoritative):

| Checker result | `verdict` |
|---|---|
| `StepResult` rejected (`ok: false`) | `{ status: 'rejected', line: her text, message: counterexample?.message ?? parseError?.message, mistake: pattern && { id, title, lesson, witness } }`; `verdict === 'parse_error'` -> `status: 'parse_error'` |
| `StepResult` accepted | `{ status: 'accepted', line: normalized?.text ?? her text }` (add `message: detected?.detail` if useful) |
| `SigFigGrade`, `AtomGrade` | `status` = `grade.status` (`correct` / `wrong` / `parse_error`), `message` = `grade.message`, `mistake` = `grade.pattern` (atoms: first of `grade.patterns`) |
| `FunctionGrade` (domain, range, composition) | `correct` -> `correct`; `mistake` -> `wrong` with `mistake: { id: kind's ErrorPatternId, title / lesson from the module's catalog (ERROR_PATTERNS), witness: grade.witness }`; `wrong` -> `wrong` + `message`; `invalid` -> `parse_error` + `message` |
| interval / set-builder answers | `compareAnswerSet` / `crossCheck` pattern -> `wrong` + `mistake: pattern`; equal -> `correct` |
| graphFeatures grade | per box result -> `wrong` / `correct` with the named mistake it reports |

Never put her name, email or anything personal in the context; there is nothing personal in these fields.

## 7. UI notes for Grok

- An "Ask the tutor" button on the problem page opens a small panel: a textarea (`maxLength` 500), Ask,
  the streamed answer as plain text (it is ASCII calculator math like the rest of the app; KaTeX optional),
  and "N questions left today". Show the thread of this attempt's questions in the panel (client-side; the
  server keeps its own copy for the model).
- Label it honestly, always visible in the panel: "AI tutor. It can be wrong; the checker is always right."
- Under each finished answer: two small buttons, "This is wrong" and "Not appropriate", which POST
  `/api/tutor/flag` with the `done` event's `id` (optional note). Confirm with "Thanks, a parent will see it."
- Parent view (only when `status.isParent`): Settings -> Tutor log: a table from `GET /api/tutor/log`
  (time, problem, question, answer, status, flags). No editing.
- jsdom tests can mock `fetch`, or run against the mock provider (below). Test hooks in the question text for
  the mock: `[mock-error]` (unavailable), `[mock-blocked]` (blocked), `[mock-hang]` (never answers: timeout /
  abort paths), `[mock-long]` (long answer for scrolling).

## 8. Run it locally (mock provider, no key, no network)

```bash
npm run tutor:mock          # builds server/dist/tutor.mjs, serves http://127.0.0.1:3000 with TUTOR_PROVIDER=mock
TUTOR_DAILY_LIMIT=3 npm run tutor:mock    # to see the limit message quickly
npm run dev                 # in a second terminal, with the proxy below
```

The tutor refuses requests without a listed account, so the Vite dev server has to play the sign-in layer.
Add to `vite.config.ts` (`server` block), for dev only:

```ts
server: {
  port: 5173,
  host: true,
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:3000',
      changeOrigin: false,
      // Plays Container Apps sign-in; server/dev-mock.mjs allows exactly this account (and makes it a parent).
      headers: { 'X-MS-CLIENT-PRINCIPAL-NAME': 'dev@localhost.test' },
    },
  },
},
```

Without the tutor running, Vite answers `/api/` with a proxy error (500/502): treat it like offline. Useful
variables (see `server/src/config.ts`): `TUTOR_MOCK_DELAY_MS` (default 30 ms between words),
`TUTOR_DAILY_LIMIT`, `TUTOR_LOG_DIR` (a folder to get the JSONL log locally), `PARENT_USERS`.
Direct curl: `curl -N -H 'X-MS-CLIENT-PRINCIPAL-NAME: dev@localhost.test' -H 'Content-Type: application/json' -d @body.json http://127.0.0.1:3000/api/tutor/ask`.

## 9. Providers and models

`TUTOR_PROVIDER=gemini | anthropic | mock` (default `gemini`); switching is a setting
(`bash deploy/azure-setup.sh tutor-provider anthropic`), not a code change.

**Gemini (default, the parent's paid key).** Official `@google/genai`, stateless
`ai.models.generateContentStream({ model, contents, config })` with `systemInstruction`, `maxOutputTokens`
2048, `thinkingConfig.thinkingLevel` LOW (`GEMINI_THINKING`, `off` for models without levels), and
`safetySettings` BLOCK_LOW_AND_ABOVE for harassment, hate speech, sexually explicit and dangerous content
(the default for Gemini 2.5/3 models is OFF). A blocked prompt or a SAFETY-type finish becomes `blocked`.
Paid tier: Google does not use the content to improve its products (pricing page, paid-tier row).

Recorded model (Google docs read 2026-09-21):

| | |
|---|---|
| `GEMINI_MODEL` default | **`gemini-3.8-flash`** (stable, released 2026-09-02, no shutdown announced; "most intelligent Flash model"; thinking levels low / medium / high) |
| Input, per 1M tokens (text), paid Standard tier | **$0.75** through Dec 31, 2026; **$1.50** from Jan 1, 2027 |
| Output, per 1M tokens (thinking included), paid Standard tier | **$3.75** through Dec 31, 2026; **$7.50** from Jan 1, 2027 |
| Sources | https://ai.google.dev/gemini-api/docs/pricing , https://ai.google.dev/gemini-api/docs/models , https://ai.google.dev/gemini-api/docs/deprecations |
| Cheaper overrides | `gemini-3.5-flash-lite` $0.30 in / $2.50 out; `gemini-3.1-flash-lite` $0.25 / $1.50 (earliest shutdown 2027-05-07); `gemini-2.5-flash` $0.30 / $2.50 (older; set `GEMINI_THINKING=off`) |

Why the full Flash and not a Flash-Lite: the answer explains math to a student, where a wrong explanation is
invisible and costly, and at family volume the difference is about a dollar a month. A question is roughly
1–2k input tokens (system prompt ~650, problem block, up to 4 earlier turns) and ~0.5–1.5k output tokens
with low thinking: about $0.01 at the 2027 price, so ~$1.50/month at 5 questions a day and at most ~$9/month
at the 30-a-day cap.

**Anthropic (`TUTOR_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`).** Official `@anthropic-ai/sdk`,
`client.beta.messages.stream` with `model: claude-opus-5` (`ANTHROPIC_MODEL`), `thinking: {type: 'adaptive',
display: 'omitted'}`, `output_config: {effort: 'medium'}`, `max_tokens` 4096 (covers thinking plus a short
answer), server-side refusal fallbacks `fallbacks: 'default'` with beta `server-side-fallback-2026-07-01`
(a classifier refusal is re-run on Anthropic's recommended fallback model inside the same call; a refusal that
survives is `blocked`), `stop_reason` checked before trusting the text, typed errors most-specific first,
`maxRetries` 1. Price $5 / $25 per 1M tokens: about $0.05 a question.

**Both:** a failure is a friendly `unavailable` event and is not counted; a provider timeout or the tutor's
60 s limit (`TUTOR_TIMEOUT_MS`) is `timeout`, not counted. Logs keep only short codes (`rate_limited`,
`http_503`, `auth`, `network`, `finish_safety`, `refusal`...), never an error body or a key. At start-up the
tutor makes one free call (`models.get` / `models.retrieve`) and logs `tutor: key check ok (gemini, model)`
or `tutor: key check FAILED (gemini: auth)`; `azure-setup.sh` reads that line.

## 10. Safeguards (what the reviewer should check)

- **Only the family:** nginx allowlist + the sidecar's own `ALLOWED_USERS` check (fails closed when empty,
  exact match ignoring case, two header copies refused); `PARENT_USERS` from configuration only (nothing in
  the repo) may read the log. No off switch in the sidecar (unlike nginx's `AUTH_ALLOWLIST=off`).
- **Content:** one fixed system prompt (`server/src/prompt.ts`): AI disclosure, one step at a time, short
  answers in app notation, the checker is authoritative, no final answer while OPEN, on-topic only with a
  kind decline, never asks for or repeats personal information, trusted adult (and 988) if she is upset or
  unsafe, her text is data not instructions (tags in her text are neutralized). Gemini safety at
  BLOCK_LOW_AND_ABOVE; Claude refusals handled with server-side fallbacks.
- **Monitoring:** every question, answer and flag in `TUTOR_LOG_DIR/tutor-YYYY-MM.jsonl` (Azure Files); the
  tutor refuses to start when that directory can't be written; without it, memory only and status says so.
- **Limits:** `TUTOR_DAILY_LIMIT` (30) per person per local day (`TUTOR_TIMEZONE`, America/New_York),
  counted again from the day's log at start-up; one question in flight per person; body 32 KB; question 500
  characters; history = her last 4 answered questions on the same attempt, from the server's own log (the
  client can't inject history); 60 s per request; output 2048 (Gemini) / 4096 (Claude) tokens.
- **No personal data to the provider:** only the problem context and her question; the server never adds her
  name, email or account; email addresses and phone numbers typed into a question are replaced with
  `[email removed]` / `[phone removed]` before sending (the parent's log keeps what she typed); nginx strips
  the sign-in cookie, claims and Google tokens before the sidecar.

## 11. Deployment

`server/Dockerfile` (build from the repo root) -> `ghcr.io/<owner>/precalc-tutor:<sha>` and `:latest`, pushed
by `deploy.yml` next to `precalc-trainer`; CI builds it and runs `deploy/smoke-tutor.sh` alone and behind the
web image's nginx (shared network namespace, like the Container App replica). The roll-out updates the tutor
container only when the app has one. Setting it up on Azure is the parent's step:
`bash deploy/azure-setup.sh tutor <key-file>` (details and cost: `deploy/azure.md` §9).

## 12. Open points

- The UI (Grok): §6–§8. The Vite proxy snippet in §8 is not applied yet.
- `deploy/smoke-tutor.sh`, both Dockerfiles, the nginx change and the workflows have only been syntax-checked
  locally (`bash -n`); they first run for real in GitHub Actions.
- `azure-setup.sh tutor` has not been run against Azure (by design: the parent runs it). It follows the
  documented CLI flows (`az containerapp show -o json` -> add container + Azure Files volume ->
  `az containerapp update --yaml`; `secret set` / `env storage set` values read from stdin with `@-`).

## Progress log

- 2026-09-21 Read CLAUDE.md, BUILD_GUIDE, roadmap, deploy/azure.md, nginx.conf, Dockerfile, smoke.sh,
  azure-setup.sh, both workflows. Loaded the claude-api skill. Read Google's Gemini docs (models, pricing,
  deprecations, text generation, safety settings, thinking, generate-content reference, terms) and
  Anthropic's child-safety guidance for developers.
- Installed `@anthropic-ai/sdk@0.127.0` and `@google/genai@2.23.0` with npm (dependencies).
- Chose `gemini-3.8-flash` as the GEMINI_MODEL default (prices recorded in §9).
- Wrote `src/shared/tutor.ts` (contract) and the server: `server/src/{config,auth,log,limits,validate,prompt,http,app,main}.ts`,
  `server/src/providers/{types,mock,gemini,anthropic,index}.ts`, `server/tsconfig.json`, `server/build.mjs`.
  `tsc -p server/tsconfig.json` clean; `node server/build.mjs` -> `server/dist/tutor.mjs` (~2.4 MB); a manual run
  with the mock answered status / ask (SSE) / log correctly and wrote `tutor-2026-09.jsonl`.
- Server tests: `server/src/{app,prompt,config}.test.ts`, `server/src/providers/providers.test.ts` (74 tests),
  wired into the root `vitest run` (vite.config.ts include) and `npm run test:server`.
- nginx `/api/` proxy + `@tutor_offline`; `deploy/smoke.sh` updated; `deploy/smoke-tutor.sh`; `server/Dockerfile`;
  ci.yml and deploy.yml; `deploy/azure-setup.sh` `tutor` / `tutor-provider` (+ `users`, `update`, `check` made
  two-container aware) and `deploy/tutor-spec.mjs`; key-file parsing tested on fake files only.
- Full verification: typecheck, 62 files / 1026 tests, vite build, server bundle. Docs: this file,
  `deploy/azure.md` §9, README privacy note.
