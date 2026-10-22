# "Check my own problem": her homework and quiz problems, checked line by line

Branch `own-problem` in `C:\work\own` (outside OneDrive). Uncommitted, for review.

## Why

She brings problems home that the app did not make: Quiz 1 had −13x − 20 ≥ −3(2x − 5) (she divided by −7 without
flipping the sign) and the inverse of f(x) = ∛(5x − 2) + 4 (she cubed before taking the 4 away). Until now the app could
only check its own generated problems. With this she types her own, and the module's own flow checks it unchanged: every
line, the named mistakes (her monster is caught), the hints. Where a problem is outside what the engine can check, the app
says so in one plain sentence instead of pretending.

## What she gets

1. **A card on the module page** of the six modules that take her own problem (`pages/Module.tsx`, after the problem
   types): "Check my own problem", one line, and "Type my problem →" to the builder at `#/own/<moduleId>`. The other
   modules (chemistry, geometry, trig and the rest) show no card, and an `#/own/...` link to one of them goes to its
   module page.
2. **The builder** (`pages/OwnBuilder.tsx`, lazy). A link back to the module, the title, one line on what it does; a
   kind picker when the module has more than one (log properties: "Expand a logarithm" or "Condense to one logarithm",
   the module's own words); the box, labelled "Your problem", with the module's own keys (`ownKeysFor`: the log keys for
   the two log modules, the function keys for quadratics, the difference-quotient keys for that module, the standard
   strip otherwise): the math keypad on a phone, the keyboard and the symbol strip on a computer; a live KaTeX preview
   and the parser's live note under the box; the example as the placeholder ("like -13x - 20 >= -3(2x - 5)").
   **Check it** (the button, Enter, or the keypad's Check key) answers in the box under it (`aria-live`):
   - "✓ I can check this one", her problem in KaTeX, what she will be asked ("Solve for x; give the answer in interval
     and set notation."), and **Start**; or
   - "I can't check this one here" and one sentence that names what is outside, with its formula in KaTeX, and a link to
     the module that does it when there is one ("This has x² in it, and here I check linear inequalities. Polynomial
     inequalities are in [Polynomial and rational inequalities]."). The sentence says only what she typed: it never
     guesses what she meant.
   A change to the text or the kind puts the verdict away. The box keeps her text and kind per module on this device
   (`pct.own`, like the grapher's `pct.graph`: not in backups), so Back from her problem finds it.
3. **Her problem** at `#/own/<moduleId>/<templateId>/<statement>` (`pages/OwnProblem.tsx`, lazy; the statement
   URL-encoded). The page rebuilds the problem from the route alone and opens it in the module's own flow, unchanged
   (`ProblemBody` from `pages/Problem.tsx`). The header says it is hers ("Your own problem", a badge under the phone
   header and after the title on a wide screen; "· Your own problem" in the eyebrow). Her lines are saved under an id
   built from the statement (`own:<module>/<template>@1/<hash>`, a 64-bit hash of it; the statement itself is
   `Attempt.own`), so a reload or Back and return brings them back.
   There is no "Next problem": the finish offers **Check another**, which opens the builder empty. "Copy link" gives the
   own route. Home's Continue card names it ("Your own problem · Distribute, then solve") and goes back to it; leaving it
   for another problem asks with the app's sheet, which describes it. A route whose statement no longer builds (an old
   link, a hand-edited URL) opens the builder with that text and says why at once; a route whose template does not match
   what the statement builds goes to the right one.
4. **What it counts for.** XP (lines, parts, the finish, the no-hints bonus), today's goal and the streak, exactly as a
   generated problem; a named mistake makes or reopens its mistake card (the monster is caught, filed under the type the
   problem opened as). Never: the mastery window, the rings, the +100 for a mastery, squashing a monster (an own finish is
   never one of the three clean problems), a type's review date (a mastered type stays due), set picks (an open card from
   her own problem is not the set builder's rule (a); her own slips add no weight), the path's working unit, or the unit
   review's weights. The finish sheet says so: "Your own problem counts for XP and today's goal. It does not move the
   ring or squash a monster: I can't tell how hard it is." (with rewards off: "This was your own problem, so it does not
   count toward mastery.").
   Every event of her attempt carries `own: true` (`OwnMark` in `store/types.ts`), the way Guided mode marks a picked
   line; the attempt carries her statement (`Attempt.own`, seed `''`). The backup's export and import (replace and merge)
   and the compaction keep the mark; the compaction keeps the last five *generated* finishes per type for the mastery
   window, never an own one in their place.
5. **The six kinds of problem**, each a constructor beside the module's templates
   (`src/content/modules/<module>/own.ts`), returning a `ProblemInstance` exactly like a generated one, with every answer
   computed by the engine, or a reason:

   | Module | Kind (her words) | Takes | Opens as |
   |---|---|---|---|
   | Linear inequalities | Solve an inequality | linear in one of x, y, n: one inequality, a chain a < px + q ≤ b, or two joined by "and" / "or"; whole numbers, fractions, decimals; every finite end of the answer within ±50 | `ineq.compound` (chain, and, or), `ineq.distribute` (parentheses to multiply out), `ineq.fraction`, `ineq.linear` |
   | Inverse functions | Find the inverse | `f(x) = …`, `y = …` or the expression: a line, a fraction-coefficient line, cbrt(px + q) + r (or the 1/3 power), k/(cx + d) + m, (ax + b)/(cx + d) with ad − bc ≠ 0, and a quadratic in vertex form a(x − h)² + k with a whole h (the not-one-to-one problem) | `inv.linear`, `inv.frac-linear`, `inv.cbrt-shift`, `inv.rational`, `inv.mobius`, `inv.quadratic-not` |
   | Exponential and log equations | Solve an exponential or log equation | one equation in x, with x only in exponents or only inside logs, whose solutions the engine finds exactly | `ee.exponential`, `ee.logarithmic`, `ee.quadratic` (a quadratic in disguise) |
   | Properties of logarithms | Expand a logarithm / Condense to one logarithm | an expression in x, y, n with logs of one base that the engine expands fully or condenses to one log (a plain number joins as a log of the base: 3 + log₂ x is log₂ 8x) | `lp.expand`, `lp.condense` |
   | Quadratics | Rewrite in vertex form | a quadratic polynomial in x written any way (shown multiplied out, as the template shows it) | `cs.form` |
   | Difference quotient | Simplify the difference quotient | f(x) = a line, a quadratic, or k/(mx + c), whole numbers up to 50 | `dq.linear`, `dq.quadratic`, `dq.rational` |

   What each says no to, with its reason, is in the module's `own.test.ts` (106 cases in all): absolute values, x in an
   exponent or a function where the module has none, polynomial and rational inequalities (to Sign charts), two
   variables, an equation where an inequality is asked, an identity or a contradiction (it says the solution set),
   square roots (their inverse needs a restricted domain), exponential and log inverses (to Exp and log graphs), a
   quadratic not in vertex form (to Quadratics), mixed equations (2^x = 3x: "I can't solve this one exactly"), no
   solution (it says so), answers it cannot write exactly, an equation in log properties (to Exp and log equations), a
   log of a number only (to Log forms), an expression that is already expanded or already one log (it says to pick the
   other kind), an equation in Quadratics (to Zeros of polynomials), higher degrees, fractions in a difference quotient,
   and more.
6. **Hints**: the module's own ladder. The nudge and the rule card are the module's; worked lines are given only where
   the engine produces real steps for her problem, and the last rung shows the answer with the rule card otherwise:
   - inequalities: the engine's lines (simplify, collect, the constant, divide, with the flip named), each checked by the
     flow's own line checker before it is offered;
   - inverses: the template's swap-first path for her numbers (and the solve-first one where the template has it), each
     line checked on the curve;
   - exponential and log: at most two of the engine's own worked lines (from its explanation, the u written back in x),
     each kept by the flow's checker, then the solution;
   - log properties: the finished form only, as the templates do;
   - quadratics: the engine's completing-the-square path, as the template;
   - difference quotient: the template's steps for her numbers, each kept by the module's graders.
   A per-seed trap (a slip the problem promises) is kept only where the engine computes it for her problem (quadratics:
   the first slip `quadTrapKinds` lists; exponential and log: keeping an extraneous root); otherwise it is left out
   rather than made up.
7. **Robustness.** Before anything is solved (`src/content/own/core.ts`): at most 120 characters, parentheses 6 deep,
   numbers up to 10,000 (50 in the difference quotient) with 4 decimals, powers up to 12 and no power inside a power
   (9^9^9 never reaches math.js), a part with no letter must have a value no bigger than a million (1/0 and log(−5) are
   "undefined"), no log inside a log. Every constructor catches anything unexpected and answers "I'm not sure I can check
   this one, so I won't." A fuzz types 2000 keypad strings per kind (random presses and problem-like strings) and each
   answers within 50 ms, never an exception.

## Design decisions for review

1. **Own events never steer anything adaptive.** Sets, the path, the unit review and the mastery window read
   `withoutOwn(events)` or skip `own` events (`inMasteryWindow`), mistake cards from her own problems included: their
   difficulty is unknown, so they never pull a type into a set. The card itself is made (the monster is caught) and
   shows on the Monsters page; it is squashed only by generated problems of its type.
2. **Not a review of the type.** An own finish does not reset a mastered type's two-week review clock (`lastDoneAt`), so
   own problems of a mastered type pay half while it is fresh and full once it is due, and the type stays due. Progress's
   first-try and hint rates still include her own lines (they are her work).
3. **The template it opens as** is picked from the shape of her problem (table above). It sets the title, the rule
   cards, the type her mistake cards are filed under, and the route. The quadratic of the vertex question (`cs.vertex`,
   "find the vertex") is not offered: the brief names `cs.form` only; it could be a second kind with the same input.
4. **Her statement** is kept as she typed it after the app's own normalizing (the keypad's spacing, runs of spaces as
   one); "f(x) =" becomes "y =" where the parser reads it so (inverses, difference quotient), and a quadratic is shown
   multiplied out. The route, the attempt and the saved lines all use that statement.
5. **Seeds.** The instance's seed is a hash of the statement (the checkers' sampling is the same every time for the
   same problem); the attempt's seed is `''` (the route has none).
6. **Limits that are the engine's, said in her terms.** Inequality answers within ±50 (the line checker searches −60 to
   60); an inverse's curve must be visible in the standard window (at least half of 12 sample points with f and f⁻¹
   within ±55; a vertex quadratic needs 4, f only), otherwise "The numbers in this one send its graph far past where my
   line checks look"; exponential and log answers must be exact (a solution the engine finds only as a decimal is
   written from its own log-free line, like x = e² − 3, or refused); log properties in x, y and n only (the module's
   letters); the difference quotient with whole numbers up to 50 (the module's own range).
7. **Exponential and log answers are exact for her own problems.** 45 % of the exponential template's problems ask for
   rounding; her own problem always asks for the exact answer ("Solve for x exactly"). A homework that asks to round
   still has the exact answer checked here.
8. **A double root in an exponential or log equation is refused** ("I'm not sure my line checks work on this one"):
   the flow's line checker would refuse her right last line there.
9. **Slow structures are refused up front**, not checked slowly: a log inside a log (the log engine took 1.4 s on
   `7x * 25 * ln(100 * ln(6x))` in the fuzz). "Check it" on an exponential or log equation can still take up to about
   half a second on this machine for some equations (the engine proves the answer and each offered line).
10. **The builder's text lives on the device** (`pct.own`), not in backups, like the grapher. "Check another" starts
    empty; Back keeps the text.
11. **Type change shared with others' code**: the log properties and exponential and log answer specs' `trap` and
    `trapAnswer` became optional (`src/content/types.ts`), since her problem may have none; eight test lines in
    `explog.test.ts`, `LogLineFlow.test.tsx` and `tutorContext.test.ts` now say `!`. No app code needed a change.
12. **The id carries a hash of the statement, not the statement.** The tutor's server takes a problem id and an attempt
    id only in letters, digits and `_.:@/#?=&+-`, up to 200 characters (`ID` in `server/src/validate.ts`, not touched);
    an id with her spaces, parentheses or ^ in it would make the tutor refuse every question on her problem. The
    statement is `instance.own` and `Attempt.own`, and a saved attempt matches a page only when the id and the statement
    both agree (`isFor` in `useAttempt.ts`), so even a hash collision could not mix two problems. The fuzz checks every
    id it builds against the server's pattern; a jsdom test builds the tutor context for her problem.
13. **A rule card id gap that was already there**: the inverse templates' steps name rule cards (`reciprocal`,
    `clear-denominator`, `distribute`, `factor`, `root-pm`) that `INV_RULES` does not define; her own path mirrors the
    templates, so it names the same ones. Not fixed here (the brief keeps the modules' content as it is).

## Log

- Shared core (`src/content/own/core.ts`, `print.ts`, `index.ts`): types, screening, reasons, ids, seeds, exact
  printing of p·x + q; the registry, `buildOwnProblem` (never throws), `ownProblemFromRoute`.
- Store: `own` on the attempt and `OwnMark` on its events; `ownMark(attempt)` spread into every event; compaction,
  rewards (no squash, not a review), selectors `isOwnEvent` and `withoutOwn`, used by the set builder and the review.
- Routes and pages: the builder, her problem, the module card, the frame's badge, "Check another", the finish note,
  Home's Continue card and the leave sheet; `useAttempt` and `attemptResolves` know own routes.
- Inequalities, then inverses, exponential and log equations, log properties, quadratics, the difference quotient, each
  finished with its round trip, real-work and why-not tests before the next.
- Found on the way: the parser drops parentheses (distribution is read from sums instead); `toLocaleString`'s first call
  took 95 ms (numbers with commas are formatted by hand); the exponential and log engine writes some exact answers only as
  decimals (written back from its own log-free line); the trap search for log equations took about 95 ms (left out where
  the engine does not name one); the difference quotient's f(x) + h slip is right for f(x) = x + b (f(x) + f(h) is the
  slip there, as in the templates); the fuzz found a log inside a log taking 1.4 s (now refused); the first id format
  carried her statement, which the tutor's server would have refused (now a hash, decision 12).
- jsdom flows for all six kinds; the fuzz; the progress log and a paragraph in `docs/BUILD_GUIDE.md` §7.

## Not done

- Templates not taken back: `dq.radical` (the brief's forms are the polynomial and k/(ax + b) ones; a square root gets
  "This has a square root in it…"), and `cs.vertex` (not offered as a kind).
- A "round to n places" choice for exponential and log answers (the engine grades decimals; the builder would need a
  second question).
- Inverses of square-root functions with a restricted domain, absolute-value and polynomial inequalities, systems.
- Graphs were not looked at in a browser (no dev server in this task): her problem uses the module's own graph
  settings, built the same way as a generated one's.

## Verification

- Round trips, 300 seeds each, every template a constructor takes: the generated statement typed as her own builds the
  same kind and template, with the same answer (solution set, restrictions, extraneous roots), and the generated right
  answer and the promised trap grade the same on both: inequalities 4 templates, inverses 6, exponential and log 3, log
  properties 2, quadratics `cs.form` (both knob settings), the difference quotient 3 (`dq.radical` checked to give its
  reason).
- Her real work: −13x − 20 ≥ −3(2x − 5) opens as `ineq.distribute`; "x ≥ −5" after "−7x ≥ 35" is named `no_sign_flip`;
  f(x) = ∛(5x − 2) + 4 opens as `inv.cbrt-shift` with f⁻¹(x) = ((x − 4)³ + 2)/5; "x³ = 5y − 2 + 4" after
  "x = ∛(5y − 2) + 4" is named `op_on_one_term`, as the quiz regression names it; her teacher's order is kept.
- Why not: 106 out-of-scope inputs across the six modules, each with its reason code, words, and a first part that
  starts with a capital letter.
- Store and session (`src/store/own.test.ts`, `src/session/own.test.ts`): every event marked; XP, goal and streak move;
  mastery, rings, squash, review date, set picks, the working unit and the review weights do not; the backup and the
  compaction keep the mark.
- jsdom (`src/pages/OwnProblem.test.tsx`, 14 tests): module page → card → builder → keypad (phone) → preview → Check it
  (the keypad's Check key) → Start → her quiz slip named and its monster caught → finish: XP and the goal move, mastery,
  the rings and the set picks do not, every event is hers, "Check another" opens an empty builder; a reload brings her
  lines back; Back returns to the builder with her text; why not with its module link; a bad link goes to the builder,
  which says why; one flow each for inverses, exponential and log (keeping the extraneous root), log properties (the kind
  picked; the coefficient taken inside), quadratics (the unbalanced square) and the difference quotient (f(x) + h); a
  statement with a slash in it; the tutor context of her problem, with ids the tutor's server takes; modules without a
  constructor show no card and their links go to the module page.
- Fuzz (`src/problem/own.fuzz.test.ts`): 2000 keypad strings per kind, each within 50 ms, never an exception, every id
  one the tutor's server takes; plus 400 deep problem-shaped strings per kind that must not hang (2 s each). On this
  laptop a typical inequality takes 10 to 25 ms alone; with five test files running beside it one took 51 ms, so a
  string over 50 ms is timed again (its best of five counts) and a first time over 250 ms fails outright, so a blowup
  like the 1.4 s one cannot hide behind a retry or the log engine's caches (one between 50 and 250 ms that the caches
  speed up could; that is the price of a timing test that does not flake on a busy machine).
- `npm run typecheck`: all three configs pass. The whole suite (`vitest run --maxWorkers=3`): 336 files, 5721 tests,
  all passed (1351 s). `vite build --outDir C:\work\own\.tmp-dist` (deleted after): built, with the existing
  chunk-size warning only. The main chunk is 3,309 kB (3,235 kB in `geometry-unit6.md`): about 75 kB is the six
  constructors, which the module page (the card) and Home (a saved own attempt is checked to still build) import. The
  builder and her problem are lazy chunks of 5.5 kB and 1 kB.

## Files

New:
- `src/content/own/core.ts`, `src/content/own/print.ts`, `src/content/own/index.ts`
- `src/content/modules/inequalities/own.ts`, `.../inverses/own.ts`, `.../expLogEquations/own.ts`,
  `.../logProperties/own.ts`, `.../quadratics/own.ts`, `.../diffQuotient/own.ts`, each with its `own.test.ts`
- `src/pages/OwnBuilder.tsx`, `src/pages/OwnProblem.tsx`, `src/pages/OwnProblem.test.tsx`
- `src/problem/ownUrl.ts`, `src/problem/ownDraft.ts`, `src/problem/own.fuzz.test.ts`
- `src/store/own.test.ts`, `src/session/own.test.ts`
- `docs/progress/own-problem.md`

Changed:
- `src/content/types.ts` (`ProblemInstance.own`; optional `trap` and `trapAnswer` on two answer specs)
- `src/store/types.ts` (`Attempt.own`, `OwnMark`), `src/store/index.ts`, `src/store/compaction.ts`,
  `src/store/rewards.ts`, `src/store/selectors.ts`
- `src/session/buildSet.ts`, `src/pages/review/buildReview.ts`
- `src/problem/useAttempt.ts`, `src/problem/attemptResolves.ts`
- `src/App.tsx`, `src/components/appChrome.ts`, `src/components/rewards/Finish.tsx`, `src/pages/Home.tsx`,
  `src/pages/Module.tsx`, `src/pages/Problem.tsx` (exports `ProblemBody`), `src/pages/flows/ProblemFrame.tsx`,
  `src/pages/flows/LeaveProblemSheet.tsx`
- Tests: `src/content/modules/explog.test.ts`, `src/pages/flows/LogLineFlow.test.tsx`, `src/problem/tutorContext.test.ts`
  (`!` on the now optional trap)
- `docs/BUILD_GUIDE.md` (§7, one paragraph)
