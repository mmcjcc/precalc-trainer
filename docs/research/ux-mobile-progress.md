# LENS: UX, mobile, accessibility, progress/reporting (plus calculator-panel UX under the TI-84 Plus CE + TI-Nspire CX II amendment)

## Findings

### UX-01 [blocker] Mobile symbol strip / input grammar
**Claim:** The symbol strip inserts Unicode glyphs (√ ³√ ≤ ≥ ∞ ∪ π) but the input grammar and math.js parser are ASCII (`sqrt(`, `cbrt(`, `<=`, `inf`, `U`), so every strip key produces an unparseable line unless a normalization layer is specified — and the strip omits the ASCII keys iOS hides behind the 123/#+= layers.

**Evidence:** Spec §Tech stack: input is `(x+1)^3 = 7y+3`, `cbrt(7x+3)-1`, interval `(-inf, -2] U (5, inf)`; §UI/UX: strip = `√, ³√, ≤, ≥, ∞, ∪, {, }, |, π`. math.js has no `√`/`≤` tokens. Worked case: she taps √ then types `x+1)` → line is `√x+1)`, parser rejects. On the iOS keyboard `^ ( ) / = < >` need a layer switch every time; iOS smart punctuation also converts `-` to U+2212 `−` in some contexts and pasted text from her study decks contains `−`, `≤`, `×`.

**Recommendation:** Add one `normalizeInput(s)` function used by BOTH the live preview and the verifier: `√`→`sqrt`, `³√`→`cbrt`, `≤`→`<=`, `≥`→`>=`, `∞`→`inf`, `∪`→`U`, `π`→`pi`, `−`(U+2212)→`-`, `×`/`·`→`*`, `÷`→`/`, curly quotes stripped, NBSP→space. Strip keys insert ASCII tokens with caret placed inside the parens: `sqrt(|)`, `cbrt(|)`, `abs(|)`, and show the pretty glyph as the key label. Strip contents (in order, one horizontally scrollable row): `x y ^ ( ) / = < ≤ > ≥ √ ³√ | | ∞ ∪ { } π`. Input attributes: `inputmode="text" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go"`, font-size ≥16px (iOS auto-zooms on focus below 16px).

### UX-02 [major] Symbol strip caret & focus handling
**Claim:** Spec gives no insertion mechanics; the naive implementation (button onClick + `setRangeText`) dismisses the iOS keyboard and desyncs React's controlled value.

**Evidence:** Tapping any button blurs the focused input on iOS Safari and closes the keyboard; the standard fix is `preventDefault()` on the button's pointerdown/mousedown (Mobiscroll 'Annoying iOS Safari input issues', https://blog.mobiscroll.com/annoying-ios-safari-input-issues-with-workarounds/). MDN: `setRangeText(replacement, start, end, selectMode)` mutates the DOM value directly and does not dispatch `input`, so a React controlled `<input value={...}>` overwrites it on next render (https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/setRangeText).

**Recommendation:** Strip `<button type="button" onPointerDown={e=>e.preventDefault()} onClick={()=>insert(token, caretOffset)}>`. `insert` reads `inputRef.current.selectionStart/End` (cache the last selection on `select`/`keyup` because some browsers report 0 after blur), builds the new string in state, and in a `useLayoutEffect` keyed on a `pendingCaret` value calls `el.setSelectionRange(pos,pos)` and `el.focus({preventScroll:true})`. Tokens carry a caret offset: `sqrt()`→-1, `abs()`→-1, `{}`→-1, `<=`→0. Backspace over an inserted `sqrt(` is plain character deletion (no atomic tokens) — keep it simple.

### UX-03 [major] Mobile layout: bottom sheet vs on-screen keyboard
**Claim:** 'Bottom sheet holding Hints / Graph / TI panel / rule card' plus a bottom-anchored input row cannot coexist with the software keyboard on iOS; without a defined mobile composer model the input, preview and strip will be hidden behind the keyboard.

**Evidence:** MDN VisualViewport: 'User-interface features like the on-screen keyboard (OSK) can shrink the visual viewport without affecting the layout viewport' — iOS Safari does not resize the layout viewport, so `position:fixed; bottom:0` elements stay under the keyboard (https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport). A 375×812 phone with keyboard open leaves ~330px of visible height; problem statement + steps + preview + strip + a sheet handle do not fit.

**Recommendation:** Mobile (<768px) = single column: (1) compact sticky header with the problem statement (KaTeX, tap to expand) and '3 of 5 steps'; (2) scrollable steps list, newest step auto-scrolled into view after acceptance; (3) a composer pinned to the visual viewport: live preview (min-height reserved, 1 line), text input, symbol strip. Pin the composer with `visualViewport` `resize`/`scroll` listeners (translateY = `vv.offsetTop + vv.height - window.innerHeight`) and `height:100dvh` on the app shell; add `<meta name=viewport content="width=device-width, initial-scale=1, interactive-widget=resizes-content">` for Chrome Android. Hints/Graph/Calculator/Rule live in a modal bottom sheet opened from a 4-button toolbar above the strip; opening the sheet blurs the input first (keyboard and sheet are mutually exclusive). Desktop (≥1024px): steps column max 640px + 360px right rail; 768–1023px: rail becomes tabs under the composer.

### UX-04 [major] Palette / contrast / color-plus-icon
**Claim:** Two of the three brand colors fail WCAG contrast on white, and the spec's ✓/✗ 'green/red' signaling names colors the palette does not define.

**Evidence:** Computed WCAG ratios (sRGB relative luminance): navy #2F3C7E on white 10.15:1 (pass); coral #F96167 on white 3.03:1 and white-on-coral 3.03:1 (fails AA 4.5:1 for body text, only passes 3:1 for large text/UI components); gold #F9E795 on white 1.24:1 (unusable for text, borders, or state); navy on gold 8.17:1 (pass). Spec §UI/UX says 'green/red' but the palette has no green.

**Recommendation:** Add derived tokens: `coral-700 #C62F37` (5.44:1 on white, 5.44:1 white-on-it) for error text and coral-filled buttons; `success #0F7A3E` (5.42:1) for accepted steps; `gold-text #7A5C00` (6.25:1) for any text on gold; keep #F96167/#F9E795 for fills, badges and highlights behind navy text only. Signal state with three channels: color, an icon with `aria-hidden`, and visible text ('Accepted', 'Not equivalent', 'Hint used'). Tailwind config exposes these as named tokens so the builder cannot reach for raw coral on white.

### UX-05 [major] Screen-reader output
**Claim:** 'All math has aria labels (KaTeX handles this)' is inaccurate: KaTeX emits MathML, not aria-labels; the live preview would be re-announced on every keystroke if made live; and the two SVG surfaces (number line, function-plot graph) have no text alternative at all.

**Evidence:** KaTeX options doc: default `output: 'htmlAndMathml'` 'outputs HTML for visual rendering and includes MathML for accessibility' (https://katex.org/docs/options) — the visual HTML span is hidden from AT and the MathML is what gets read. VoiceOver reads MathML natively; NVDA needs the MathCAT add-on ('MathML is ignored by NVDA by default', nvaccess/nvda#17667). function-plot renders raw `<svg>` with no title/desc; spec's number line is a hand-rolled SVG with none specified.

**Recommendation:** Keep KaTeX default output (do not set `output:'html'`). Preview container: no `aria-live`; give it `aria-label="Preview"` and let the user read it on demand. Step result region: `role="status" aria-live="polite"` containing plain text first ('Step 3 accepted — combine like terms' / 'Not equivalent. At x = 1 the old line is true but the new line is false'), KaTeX second. Number-line SVG: `role="img"` + generated `aria-label` ('closed dot at −2, ray to the left; open dot at 5, ray to the right'). Graph: wrap function-plot in `<figure>` with `<figcaption>` listing the plotted functions in words ('f(x) = cube root of (7x+3) − 1 in navy; inverse in coral dashed; y = x dotted') and `role="img" aria-labelledby` on the svg. Parse errors: render the error text in the status region with the character index, not KaTeX's red `errorColor` output.

### UX-06 [major] Touch targets
**Claim:** 'Big touch targets' is undefined; the 10 property chips and a 10–20-key symbol strip on a 375px-wide phone will violate minimum target size unless sizes and overflow behavior are specified.

**Evidence:** WCAG 2.2 SC 2.5.8 (AA): 'The size of the target for pointer inputs is at least 24 by 24 CSS pixels' with a 24px-circle spacing alternative (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html); Apple HIG uses 44pt. 20 strip keys × 44px = 880px > 375px; 10 chips of 'multiply/divide both sides (sign flip if negative!)' text wrap badly at 2 columns.

**Recommendation:** Strip: single row, `overflow-x:auto`, `scroll-snap-type:x mandatory`, each key `min-w-11 h-11` (44×44), 4px gap, most-used keys (`x y ^ ( ) / = ≤ ≥`) first so they are visible without scrolling. Property chips: 2-column grid on mobile, `min-h-11`, short labels with a `title`/expander for the long hint ('÷ both sides (flip if −)'). Step-row secondary actions (undo/edit) ≥24×24 with 8px spacing. Add a Vitest/DOM test that asserts computed sizes on a 375px jsdom viewport for the strip and chips.

### UX-07 [major] Keyboard-first desktop flow
**Claim:** 'Keyboard-first on desktop' has no keymap or focus-management rules, and the chip prompt after each accepted step will steal focus from the input unless specified.

**Evidence:** Spec §UI/UX only states the goal. Concrete failure: after acceptance, focus moves to the chip group; pressing Enter on a chip returns nothing to the input, so every step costs a mouse click. Single Alt+letter shortcuts (e.g. Alt+H for hint) open Firefox/Edge menu bars on Windows.

**Recommendation:** Keymap: Enter = submit step; Esc = clear input (or close sheet/dialog if open); Ctrl+Shift+H = next hint rung (with a confirm on rung 3 because it costs); Ctrl+Shift+G = graph panel; Ctrl+Shift+C = calculator panel; Ctrl+Z = undo last accepted step (see UX-15); `?` = shortcut cheat-sheet. After acceptance: chip group renders as `role="radiogroup"` with arrow-key navigation, digits 1–9/0 select a chip directly, Enter confirms, Esc or Tab skips ('skipped' recorded) — in every case focus returns to the input via `inputRef.focus()`. Rejection: focus stays in the input with the bad line selected (`select()`) so retyping replaces it. Structured answer inputs (interval builder, one-to-one radio, even/odd) are all reachable by Tab in DOM order; no `tabindex>0`.

### UX-08 [major] Property-chip interaction semantics
**Claim:** The chip step is described three ways at once ('optionally, toggleable', 'bonus point', 'no penalty') and the scoring it references ('bonus point', 'reduced score for that problem') is never defined, so the builder cannot implement it or the progress view consistently.

**Evidence:** §Core engine step 3 vs §Hint ladder rung 3 vs §Progress (which lists first-try %, hint rate, error counts — no score). Her stated weakness is exactly property identification, so making the chip skippable-by-default undercuts the purpose; making it blocking punishes fast correct work.

**Recommendation:** Setting `askProperty: 'always' | 'off'`, default `always` in modules 2–4 and forced in module 5. Non-blocking: the chip prompt is inline under the accepted step; Enter/Esc/typing the next line skips it and records `property: 'skipped'`. Record `correct | wrong | skipped | off` per step. Drop 'points'; define per-skill metrics instead: first-try step rate, hint rate, property accuracy (correct ÷ answered), error-pattern counts. A 'show the step' rung marks that step `firstTry:false, revealed:true` — that is the whole 'cost'. Wrong chip → one-line correction naming the right property, no other consequence.

### UX-09 [major] Progress data model in localStorage
**Claim:** Aggregated counters cannot produce the required 'sign-flip errors: 4 → 0 this week' comparison or any metric added later; an append-only event log with periodic roll-up can, and fits comfortably in the 5 MiB quota.

**Evidence:** 'This week vs before' needs per-event timestamps or time-bucketed counters; counters also can't be re-derived when a metric definition changes (e.g. first-try). Size: one event ≈120 bytes of JSON; 20 problems/day × ~7 events ≈ 17 KB/day, ≈ 300 days before hitting MDN's 5 MiB per-origin localStorage limit (https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) — fine for a year with roll-up, not without.

**Recommendation:** Event log (see reference schema) as source of truth; derive views with a memoized selector. Compaction on app start: events older than 60 days fold into `weekly[isoWeek][skillId]` counters and are deleted. Wrap every write in try/catch (QuotaExceededError, Safari private mode) and keep the in-memory store working when storage is unavailable. Include `schemaVersion` and a `migrate()` chain. Add Export/Import JSON (text-area copy/paste plus file) on the progress screen — she uses phone AND desktop and the spec's 'per-device' storage means her parent's review otherwise only sees one device.

### UX-10 [major] Data persistence on iPhone Safari
**Claim:** On iOS Safari, all localStorage for the app will be deleted after seven days of Safari use with no interaction on the site — a one-week break wipes her progress (and the PIN flag).

**Evidence:** WebKit blog 'Full Third-Party Cookie Blocking and More': ITP deletes 'all of a website's script-writable storage after seven days of Safari use without user interaction on the site', listing LocalStorage explicitly; home-screen web apps are exempt: 'We do not expect the first-party in such a web application to have its website data deleted' (https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/). MDN confirms the seven-day rule under 'Safari proactively evicts data'.

**Recommendation:** Ship a web app manifest (name, icons, `display: standalone`, theme color navy) and on iOS Safari show a one-time 'Add to Home Screen' card explaining that it keeps progress. Combine with the export/import from UX-09 and an unobtrusive 'last backup: 12 days ago' line on the progress screen. Do not rely on a service worker for this (not required for the exemption, adds cache-invalidation risk).

### UX-11 [major] Resume after reload
**Claim:** Nothing specifies what happens when she reloads or backgrounds the tab mid-problem; without a persisted in-progress attempt the 'abandoned problem' nudge and '3 of 5 steps' indicator are meaningless after any reload.

**Evidence:** Spec persists only 'progress'. iOS Safari routinely evicts background tabs, so a phone user reloads several times per session.

**Recommendation:** Persist `attempt.current` (module, template, seed, difficulty, accepted steps with property tags, hints used, draft input text, startedAt, lastActiveAt) after every accepted step and on a 500 ms debounce of typing. Route `/p/:module/:template/:seed` is the canonical problem URL; on load, if `attempt.current` matches the route, restore it; if the route is `/` and a current attempt exists, the home screen shows a 'Continue — 3 of 5 steps' card. Starting a different problem while one is in progress asks once ('Leave this problem? It will count as unfinished') and records `problem_abandoned`.

### UX-12 [major] Module/problem picker and 'complete'
**Claim:** The spec has no home screen, no way to choose a module or problem type, and no definition of 'complete' for a module or 'mastery' for a skill, so the mastery bars have no denominator.

**Evidence:** §Content modules lists five modules and §Progress asks for 'per-skill mastery bars' but no screen or rule is described. '80% first-try' of what window? All time (never moves once she has 200 steps) or recent (moves)?

**Recommendation:** Screens: Home (module cards with mastery bar, 'Continue' card, 'Practice weak spots' button that samples templates weighted by lowest mastery), Module page (template families with per-family mastery, difficulty toggles, 'Start random'), Problem page, Drill page (module 5), Progress page, Settings. Skill = template family (e.g. `ineq.divide-negative`). Mastery = rolling window of the last 5 completed attempts of that family: % of steps accepted first-try with no 'show the step'; family 'mastered' when window is ≥80% and the final answer was right in all 5. Module 'complete' = every family mastered; show it as a state, never as a lock (all content is always open). Show 'last practiced N days ago' next to the bar instead of decaying the number.

### UX-13 [major] Share-by-seed URL
**Claim:** 'Shareable seed in URL' is unspecified: without pinning the generator version and template id, a shared link will produce a different problem after any generator change, and the PIN gate will drop the deep link.

**Evidence:** Deterministic generators change whenever coefficient constraints are tuned (spec explicitly expects tuning: 'coefficients constrained so answers stay clean'). The PIN gate 'asks once per device' with no returnTo path.

**Recommendation:** URL: `/p/<moduleId>/<templateId>/<seed>?d=<difficulty>&g=<genVersion>` — seed as base36 uint32, `d` as a short flag string (e.g. `fn` = fractions+negative lead), `g` integer bumped when a template's generator changes; old `g` values must keep their generator function (keep a version map per template). nginx SPA fallback already exists so path routing is fine. 'Copy link' button: `navigator.share` if available, else `navigator.clipboard.writeText` with a visible 'Copied' status. PIN screen stores `returnTo` in sessionStorage and navigates there after success. Links never carry progress or PIN.

### UX-14 [minor] Idle nudge / abandoned-problem tracking
**Claim:** 'N minutes idle' is undefined, 'abandoned problem' is misfiled as an error pattern (#11) so it would inflate her error counts, and a modal nudge would interrupt typing.

**Evidence:** §Error-pattern library #11 is behavioral, not a math delta; a matcher over (oldExpr,newExpr) cannot detect it. Background tabs must not count as idle (she switches to the calculator app).

**Recommendation:** Idle = 4 minutes of foreground time (`document.visibilityState === 'visible'`) with no input/pointer events while a problem is in progress; pause the clock while hidden. Nudge = a single inline banner above the composer ('Two steps left — want a nudge?' with Hint / Dismiss), once per attempt, no sound, no modal. Record `problem_abandoned` only when she starts another problem or 24 h pass. Report it in a separate 'Habits' block on the progress page (problems finished vs left), not in the error-pattern list.

### UX-15 [minor] Steps column editing
**Claim:** The worked-steps column has no way to back out an accepted step, so a legal-but-unhelpful line traps her on a longer path.

**Evidence:** Numeric equivalence accepts any legal transformation, including detours (e.g. expanding `(x+1)^3` when the canonical path takes a cube root). Hints then key off the canonical next step, which no longer matches her state.

**Recommendation:** Allow 'Undo last step' (Ctrl+Z / button on the last row only); log `step_undone`, never counted as an error. Hints compare her current state to each canonical step by numeric equivalence and pick the first canonical line that follows her state; if none matches, rung 1 says 'this is legal but off the usual path — try to get back to …'.

### UX-16 [minor] Celebration, streaks, test mode
**Claim:** 'Celebrate honestly' and 'optional test mode' need concrete rules or the builder will ship the defaults of gamified apps (loss-aversion streak warnings, unpausable timers).

**Evidence:** Spec names the goal but not the rules; `prefers-reduced-motion` is not mentioned.

**Recommendation:** Day streak = consecutive days with ≥1 completed problem, shown as a number, never with a 'don't lose your streak' warning, countdown, badge scarcity, or notification. Completion toast lists what she did ('5 steps, 4 first-try, 1 hint') and any newly mastered family; confetti only when `prefers-reduced-motion: no-preference`. Test mode: opt-in per session from Settings, shows elapsed and a target time per template (e.g. 3 min), pausable, never locks input or auto-submits at zero; attempts carry `mode:'timed'` and are excluded from the mastery window but shown separately.

### UX-17 [minor] Calculator panel UX under the two-calculator amendment
**Claim:** With both TI-84 Plus CE and TI-Nspire CX II required, the panel needs a persisted calculator selector and per-family keystroke templates for both; and two of the spec's TI-84 lines are inaccurate for the CE model.

**Evidence:** TI-84 Plus CE line style: pressing ENTER on the icon left of Y1 opens a Color/Line dialog ('Press ENTER to open the Color / Line selection menu … navigate to OK'), not a cycle (dummies TI-84 Plus CE Color/Line article; TI Getting Started guide). Nspire facts verified: nth-root template = templates key 'directly to the left of the [9] key', '4th option on the 1st row', `tab` between index and radicand (TI KB 29131); fraction template = ctrl + ÷ (TI online-calculator shortcut list 'ctrl + / Fraction template'); table = ctrl + T ('Toggle Table'); entry line = ctrl + G; inverse = 'press [Ctrl] then [G]', '[menu] [3:Graph Entry/Edit] [2:Relation]', enter `x=f1(y)` — TI notes 'only work if you have the latest operating system' (TI KB 38095); Window/Zoom = menu 4, '5: Zoom - Standard', 'B: Zoom - Square' (TI KB 27950). The Nspire has no DRAW Horizontal; a horizontal-line test is done by graphing a second function f2(x)=c.

**Recommendation:** Segmented control 'TI-84 Plus CE | TI-Nspire CX II' at the top of the panel, persisted as `settings.calculator`, asked once on first run ('Which calculator do you use?'). Render each instruction as an ordered list of `<kbd>` keycaps with the substituted expression in a monospace `<code>` block, plus a 'Copy expression' button. Fix the CE line-style step to: left-arrow onto the icon left of Y2 → ENTER → choose Line style (Dotted) → OK. Nspire templates per family: entering — Graphs app, `f1(x)=`, cube root via templates key → ⁿ√ (row 1, item 4) → `3` tab `7x+3` → `−1`; fractions via ctrl+÷; window — menu 4 → 5 Zoom-Standard, then menu 4 → B Zoom-Square when y = x symmetry matters; inverse — ctrl+G → menu 3 → 2 Relation → `x=f1(y)` (state OS ≥ latest per TI); y = x — `f2(x)=x` then ctrl+menu on the graph → Attributes → line style; one-to-one visual — `f3(x)=2` and edit the constant (or Insert Slider); ± case — `f2(x)=√((x+7)/4)`, `f3(x)=−f2(x)` (Nspire allows referencing f2); plug-in check — ctrl+T for the table, or Calculator app `f1(3)`. Keep the panel collapsed by default on mobile and remember open/closed state.

### UX-18 [minor] Live preview & parse-error display
**Claim:** The live preview needs a debounce, a reserved height, and an error strategy; KaTeX's `throwOnError:false` renders the raw string in red, which is color-only and unreadable for `sqrt(` typos.

**Evidence:** KaTeX options: with `throwOnError:false` invalid input is rendered in `errorColor` (#cc0000) (https://katex.org/docs/options). Layout shift under the input on every keystroke on a phone makes the strip jump.

**Recommendation:** Debounce parse+render 60–80 ms; preview container `min-h-10`; on parse failure keep the last good render at 50% opacity and show a text line 'Check character 7: expected )' with a caret marker under the input (the spec already wants exact position). Never rely on the red color.

### UX-19 [minor] PIN gate accessibility and semantics
**Claim:** 'Stores a session flag' contradicts 'asks once per device' (sessionStorage re-asks in every tab/after every close), and the PIN screen has no a11y spec.

**Evidence:** Spec §Container: 'the SPA asks once per device and stores a session flag'. Safari eviction (UX-10) will also clear the flag, which is acceptable but should be expected.

**Recommendation:** Store `auth.ok = true` in localStorage (not sessionStorage). PIN input: `<label>` 'Family PIN', `inputmode="numeric" autocomplete="off"`, `type="password"` with a show/hide toggle, error text in `role="alert"`, submit on Enter, no lockout. Preserve `returnTo` (UX-13).

### UX-20 [minor] Structured answer inputs on mobile
**Claim:** Free-text interval notation on a phone keyboard (`(-inf, -2] U (5, inf)`) needs `[ ] ( ) ,` from the 123 layer and `U` from the letter layer; the spec's 'chip-builder or strict parser' should resolve to the builder on touch devices.

**Evidence:** Spec §Structured answer types offers either. The seeded error patterns #1–#3 (backwards interval, dropped ∪, `[3]`) are exactly the mistakes a builder prevents by construction — but the spec also wants them detected and taught.

**Recommendation:** Ship both: a piece-builder (add piece → choose `( [ {` / endpoints / `) ]` / ∪) with 44px controls as the default on touch, and a text field (desktop default, toggle on mobile). Run the same validator on both paths so the targeted lessons (#1–#3) still fire from text input; when the builder is used, log `interval_builder` on the attempt so the progress view does not read the absence of those errors as mastery of notation.

## Design decisions

- **Progress storage**: Append-only event log in localStorage, compacted into weekly per-skill counters after 60 days; all views derived by selectors.  
  _Why:_ Time-windowed comparisons ('this week vs before') and future metric changes need raw events; size stays under 1 MB/year with roll-up (≈17 KB/day raw).

- **Property chip**: Prompt after every accepted step (default on in modules 2–4, mandatory in the drill), non-blocking, skippable with Enter/Esc, recorded as correct/wrong/skipped.  
  _Why:_ Property identification is the stated core weakness, but gating on it would penalize correct fast work; recording 'skipped' keeps property accuracy honest.

- **Mobile composer**: Single-column mobile layout with the input/preview/symbol strip pinned to the visual viewport; hints/graph/calculator/rule card in a modal bottom sheet that is never open at the same time as the keyboard.  
  _Why:_ iOS Safari does not resize the layout viewport for the keyboard; a persistent sheet and a keyboard cannot share ~330 px of visible height.

- **Symbol strip tokens**: Strip inserts ASCII parser tokens (sqrt(), cbrt(), <=, inf, U, pi) with caret placed inside parens; a single normalizeInput() also maps Unicode math glyphs to the same tokens before parsing.  
  _Why:_ The grammar is ASCII; normalizing makes pasted text from her study decks and the strip both work through one code path.

- **Calculator panel**: Persisted segmented control between TI-84 Plus CE and TI-Nspire CX II; instructions rendered as keycap lists per problem family with the expression substituted.  
  _Why:_ Amendment requires both models; keystroke sequences differ entirely (menu-driven CE vs template/ctrl-driven Nspire).

- **Mastery definition**: Skill = template family; mastery = rolling last-5-attempt first-try step rate with no revealed steps and correct final answers; module complete = all families mastered; nothing is ever locked.  
  _Why:_ A rolling window moves with practice; all-time averages freeze after a few hundred steps and hide improvement.

- **Persistence resilience**: Web manifest + Add-to-Home-Screen prompt on iOS, export/import JSON on the progress page, try/catch around all storage writes.  
  _Why:_ Safari ITP deletes localStorage after 7 days without interaction unless installed to the home screen; she also uses two devices.

## Reference

## Routes / screens

| Route | Screen | Notes |
|---|---|---|
| `/pin` | PIN gate | localStorage `auth.ok`; honors `returnTo` |
| `/` | Home | module cards + mastery bars, "Continue (3 of 5 steps)" card, "Practice weak spots" |
| `/m/:moduleId` | Module | template families w/ mastery, difficulty toggles, "Start random" |
| `/p/:moduleId/:templateId/:seed?d=<flags>&g=<genVersion>` | Problem | canonical shareable URL; seed base36 uint32; `g` pins generator version |
| `/drill/:setId?` | Properties drill (module 5) | flashcard/legal-or-illegal |
| `/progress` | Progress | mastery, hint rate, property accuracy, error patterns (this week vs before), habits, streak, export/import |
| `/settings` | Settings | calculator (ti84ce | nspirecx2), askProperty, testMode, reducedMotion follows OS |

Mobile breakpoints: <768 single column + modal sheet; 768–1023 rail as tabs under composer; ≥1024 right rail 360px, steps column max 640px.

## Keymap (desktop)
Enter submit · Esc clear/close · Ctrl+Shift+H hint rung · Ctrl+Shift+G graph · Ctrl+Shift+C calculator · Ctrl+Z undo last step · 1–9/0 pick chip when chip group focused · Tab/Esc skip chip · `?` cheat-sheet.

## localStorage schema (key prefix `pct.`)

```ts
// pct.meta
{ schemaVersion: 1, createdAt: ISO, lastBackupAt?: ISO }

// pct.settings
{ calculator: 'ti84ce' | 'nspirecx2', askProperty: 'always' | 'off',
  testMode: boolean, seenA2HS: boolean }

// pct.auth
{ ok: true }

// pct.attempt.current  (null when none)
{ id: string, moduleId, templateId, seed: string, difficulty: string, genVersion: number,
  mode: 'normal' | 'timed', startedAt: ISO, lastActiveAt: ISO,
  steps: [{ idx, text, latex?, accepted: true, firstTry: boolean, revealed: boolean,
            property: 'correct' | 'wrong' | 'skipped' | 'off', propertyTag?: string }],
  hintsUsed: { [stepIdx]: 0|1|2|3 }, draft: string, nudged: boolean,
  final?: { interval?: string, set?: string, oneToOne?: 'yes'|'no', reason?: string, parity?: string } }

// pct.events  (append-only array; compacted after 60 days)
type Ev =
 | { t: 'step_accepted',  at, attemptId, skill, stepIdx, firstTry, revealed, property }
 | { t: 'step_rejected',  at, attemptId, skill, stepIdx, pattern?: string /* e.g. 'no_sign_flip' */ }
 | { t: 'hint',           at, attemptId, skill, stepIdx, rung: 1|2|3 }
 | { t: 'step_undone',    at, attemptId, skill, stepIdx }
 | { t: 'final_answer',   at, attemptId, skill, correct, pattern?: string, via?: 'builder'|'text' }
 | { t: 'problem_done',   at, attemptId, skill, moduleId, steps, firstTryRate, hints, mode, secs }
 | { t: 'problem_abandoned', at, attemptId, skill }
 | { t: 'drill_answer',   at, skill, correct, kind: 'property'|'legal' }
// skill = templateId (e.g. 'ineq.divide-negative', 'inv.cbrt-shift'); at = epoch ms

// pct.weekly  (compaction target; keyed by ISO week, then skill)
{ '2026-W37': { 'ineq.divide-negative': { steps, firstTry, revealed, hints, propAnswered, propCorrect,
                                          patterns: { no_sign_flip: 2 }, done, abandoned } } }

// pct.streak
{ lastDay: 'YYYY-MM-DD', count: number }
```

Derived selectors (never stored): `mastery(skill)` = last 5 `problem_done` for skill → mean firstTryRate, mastered iff ≥0.8 and no revealed steps and all finals correct; `hintRate(skill)` = hints ÷ steps; `propertyAccuracy` = propCorrect ÷ propAnswered; `patternCounts(range)` = count of `step_rejected`/`final_answer` with `pattern` in range, compared as `thisWeek` vs `allBefore`.

Compaction: on app start, fold events with `at < now − 60d` into `pct.weekly`, then delete them. All writes in try/catch; in-memory store keeps working on QuotaExceededError.

## Verified calculator facts (for the two-model panel)
- TI-84 Plus CE: MATH → 4: ³√( ; MATH → 5: ˣ√ ; ZOOM 6 ZStandard, ZOOM 5 ZSquare ; 2nd PRGM (DRAW) 8: DrawInv, 1: ClrDraw, 3: Horizontal ; line style on CE = left-arrow onto icon left of Yn → ENTER opens Color/Line dialog → choose → OK (not ENTER-cycling).
- TI-Nspire CX II (non-CAS): templates key is left of [9]; nth-root template = row 1, item 4; `tab` moves index→radicand; fraction template ctrl+÷; ctrl+G toggles graph entry line; ctrl+T toggles table; Window/Zoom = menu → 4, item 5 Zoom-Standard, item B Zoom-Square; inverse = ctrl+G → menu → 3 Graph Entry/Edit → 2 Relation → `x=f1(y)` (recent OS required per TI); no DRAW Horizontal — use `f2(x)=c` (or Insert Slider); `f3(x)=−f2(x)` is allowed for the ± case; plug-in check via table or Calculator app `f1(3)`.

Sources checked: katex.org/docs/options; webkit.org/blog/10218; w3.org/WAI/WCAG22/Understanding/target-size-minimum; MDN Storage quotas, VisualViewport, setRangeText; TI KB 29131, 38095, 27950; TI-Nspire online calculator keyboard shortcuts; dummies/TI CE Color-Line article; nvaccess/nvda#17667.
