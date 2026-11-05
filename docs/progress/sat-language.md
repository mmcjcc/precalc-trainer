# SAT Reading & Writing, phase 1 (`sat-language`)

Branch `sat-language` in `C:\work\satrw`, forked from e1b74cd.

## What was built (Gemini 4 via agy, 2026-11-05 ~00:30–00:55)

A new class `satrw` "SAT Reading & Writing" with the four section domains as units; phase 1 fills
the two generable ones (Expression of Ideas → `rwTransitions`; Standard English Conventions →
`rwBoundaries`, `rwFormSense`). Every item is a digital-SAT-style blank completion ("Which choice
completes the text so that it conforms to the conventions of Standard English?" / "…with the most
logical transition?") with four options, exactly one correct, each wrong option carrying a named
`rw_` mistake and a nudge. New `satrw` answer type + `SatRwFlow` (modeled on the house choice
flows), options shuffled deterministically per seed so the right letter varies. New monster species
"The Clause Splicer" appended to species.ts. The two reading domains stay empty until an authored
item bank exists — generated prose cannot honestly test reading comprehension.

Templates: `rb.join` (joining independent clauses: period/semicolon/comma+conjunction vs comma
splice, fused run-on, conjunction without its comma), `rb.inside` (paired appositive commas vs a
dropped half-pair, commas around a restrictive name, a subject–verb comma), `rf.agree`
(subject–verb agreement across an intervening phrase; distractors agree with the nearest noun),
`rf.pronoun` (pronoun–antecedent number and ambiguity; with two candidate antecedents the correct
choice names the noun), `rt.pick` (transition by logical relation; the three wrong options come
from three distinct other relation families — tested).

The builder hit its agy quota (RESOURCE_EXHAUSTED, 429) right after launching the full suite, so it
never saw cross-cutting results or wrote this doc. Everything after that point is the reviewer's.

## Review (Claude, 2026-11-05)

- Diff footprint: the allow-list exactly (modules folder, flow + test, courses, types, modules
  index, species append, three hard-coded-list test files). No dead branches, no duplicate cases.
- Hand-read of 15 generated items (3 seeds × 5 templates): SAT-register academic prose; the
  historical references check out (Mexía's Andes collections, Carver's cowpea advocacy, Savage's
  "Gamin"); each wrong option is wrong in exactly the targeted way. One cosmetic nit left as is:
  "they're" as a wrong pronoun option is tagged `rw_pronoun_ambiguous` though it is strictly a
  form error.
- Integration fixes applied in review (the full suite the builder never saw):
  1. The store edition is math-only (Jason's standing decision), so the three rw modules now carry
     `subject: 'English'` and `STORE_SKIPS_SUBJECTS` adds `'English'` — the store app's class tabs
     stay Precalculus / Geometry / SAT Math Prep; the family app shows the new class. One-line flip
     if SAT R&W should ever join the store app.
  2. `generators.test.ts`: the registry list grows to sixty-one with the three rw ids.
  3. `AskAnything.test.tsx`: the Ask page's class list gains "SAT Reading & Writing".

## Verification

- Builder: `npm run typecheck` exit 0 (its own run, after fixing its type imports). Full suite:
  never completed (quota).
- Reviewer, targeted (pre-fix): 14 files / 72 tests passed — the satrw 300-seed sweeps
  (deterministic, exactly one correct option by the module's own grader, 4 distinct options, clean
  prose, mistakes registered in ERROR_PATTERNS, rt.pick's three distinct wrong families),
  distinctness ≥40/60 per template, SatRwFlow jsdom test, courses, Home, Progress, monsters guard.
- Reviewer, full suite in this worktree (overlapping three other builds on the machine): typecheck
  exit 0; 6,743 passed / 11 failed — 8 of the failures are the known load-flake families
  (own.fuzz 50 ms budgets; 2000-seed content sweeps against their timeouts, files this diff does
  not touch), 3 were the real list-assertion breaks fixed above.
- Reviewer, post-fix: typecheck exit 0; the three fixed files re-run 20/20. Two review slips worth
  recording: the rw ModuleDefs already carried `subject: 'SAT Reading & Writing'` (a truncated grep
  missed it), so the first fix created duplicate keys — resolved to the single `subject: 'English'`;
  and `StoreEdition.test.tsx` mocks `@/edition` wholesale, so its mock now mirrors the real
  module's skip list. Registration order is rwTransitions → rwBoundaries → rwFormSense (an internal
  import pulls transitions in first); the registry test matches reality.
- Reviewer, browser QA (dev server, desktop): `rb.join` right answer finishes; `rf.agree` wrong
  pick shows "✗ Not quite: Verb agrees with nearby noun instead of the true subject" and catches
  the new monster (The Clause Splicer), right pick finishes with the worked-out answer and rule
  cards. The merged-tree gate before push remains the final word, as always.
