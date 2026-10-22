# Phone monsters: every named mistake is a monster to catch and squash

Branch `phone-monsters`. Uncommitted, for review.

## Why

The owner asked for the "pizzazz kids need (think Duolingo)". The juice and the unit path shipped. This is the plan's
signature idea, MISTAKE MONSTERS: the app's best feature (it names every mistake) becomes the game. Making a mistake
CATCHES a monster; three clean problems of that type SQUASH it; her collection fills in. It says the right thing: a
caught mistake is a win, never a penalty. The owner chose generated art only (nothing to download or license) and a
teen-friendly style (not babyish: Google's stricter rules for children's apps apply to apps that look made for young
children). How mistakes are detected, named, caught (as cards) and squashed is unchanged: the monsters are only how a
named mistake is shown.

## What she gets

1. **Species and variants.** 33 species, one per family of mistakes (26 math, 7 chemistry), 417 variants: every catalog
   id is a variant of exactly one species (`src/components/monsters/species.ts`, a hand-written table; a test fails on any
   catalog id without a place). Each species has a name and a one-line personality; a variant's tagline is its catalog
   title. Three catalog entries are not mistakes and so never monsters (`NOT_MONSTERS`: `abandoned`, `squaring_caveat`,
   `log_check_answers`; the checker never records them as a mistake).
2. **Generated art** (`art.ts`, pure; `MonsterArt.tsx` draws it). Flat, bold sticker art: a thick ink outline, flat
   colours, a white sticker border on the big pictures. The species fixes the body (blob, bean, box with a corner cut
   off, pear, ghost, triangle, spiky ball, hexagon, cloud, log, drop...), the palette, what grows on top (horns, ears,
   antennae, a mohawk, a crest shaped like a root sign, a sprout, a hard hat, a balance...), the eye style (half-lidded,
   angry, side-eye, spiral, squinting...), the mouth (smirk, fangs, tongue out...), the feet, and its own sign (the Sign
   Flipper is two-tone with a + and a −; Bracket Gremlin's arms are a [ and a ]; the Base Bandit wears a bandit's mask;
   Log Splitter is a log with rings and a crack; the Upside-Downer stands on its head; the Shape Faker wears fake glasses
   and a moustache; the Name Mangler a "Hello, my name is" tag...). Each variant adds deterministic extras chosen from its
   id: a pattern (spots, stripes, a belly patch, freckles, a zigzag, a patch), something it wears (beanie, cap,
   headphones, glasses, shades, a plaster, an earring, a headband, a pencil, a star sticker), one, two or three eyes, a
   small colour shift, where it looks, the size of its horns. A variant's pattern, accessory and eye count are never the
   same as a sibling's. An unseen variant is its species' dark silhouette with a "?" (nothing of the variant).
3. **The catch.** The first time she makes a mistake she has never made before, the verdict that names it shows its
   monster flipping in (then a wiggle), "Caught: The Sign Flipper" and "New in your monster collection." (a rare one
   says so). Once per mistake: remembered in the rewards' slice (`RewardsState.caught`, like the streak milestones,
   carried by backups). After that, every named mistake shows its monster's small avatar beside the title. Where: the
   step card in the work list (`RejectionCard`), the phone composer's verdict line (`ComposerStatus`), the parts flows'
   card (`SigFigRejection`, `PatternLesson`, so atoms and the configurations too), and the interval answer card
   (`FinalAnswerCard`). A new sound cue, "catch" (a soft spring up an octave, then two bright notes; code-made, behind the
   Sounds switch), plays in place of the nope for a first catch.
4. **The squash.** When three clean problems squash a mistake (the rewards decide and pay +50 XP), the finish sheet (and
   the wide completion card) shows the monster squashed: it jumps, splats flat, drops fly, and its card turns gold;
   "Squashed: <name>" and the mistake's title. The pop sound is the juice's own. The +50 line stays in the XP list.
5. **The Monsters tab** (`/monsters`, `src/pages/Monsters.tsx`). A header "14 squashed · 3 on the loose", then species
   by species: its picture, name, personality and "N squashed · M on the loose" (a species she has met is open, the
   others one line with their outline in the dark; a species' tiles are drawn only while it is open, so a phone does
   not draw some 400 pictures for nothing). Each variant: caught in colour with ×count and the squash pips
   (0 to 3), squashed in a gold frame, not seen as a silhouette. Rare variants wear a sparkle frame (a gold ring and two
   twinkling sparkles). A tile opens the monster's card: the picture, the species' name and personality, the mistake's
   title, its catalog lesson and example, how many times and where she last caught it ("Last caught in Linear inequality,
   3 days ago"), the pips, and "Practice this" (a fresh problem of the type she caught it in).
6. **Navigation.** The tab bar is Home, Monsters, Progress, Settings on every screen (both apps, tutor or not). The wide
   top navigation shows the same four, then Ask (tutor configured) and the Sandbox (family app). The drill keeps `/drill`
   and is reached from its module in Unit 1 (Home's "Modules in this unit", then "Start the drill") and from Progress
   ("Open the properties drill"); the tab bar marks Home on the drill, Ask and the Sandbox.
7. **Home's "Mistakes to squash"** (rewards on) shows each open card's monster, and "The whole collection" now opens the
   Monsters tab. Progress's mistake collection has the avatars too and a link "See them all as monsters"; the set's
   results show the squashed monsters' avatars.
8. **Editions and rewards.** The store app (math only) shows the 26 math species; the family app all 33. Rewards off
   (the family app's default): the Monsters tab, the catch and the squash all work, with no XP anywhere.
9. **Reduced motion:** no flip, no wiggle, no splat, no drops, no twinkle; the catch and the squash still show, standing
   still (the squashed monster flattened and its card gold from the start).
10. **Accessibility.** Every picture is decorative (`aria-hidden`, never focusable). Names, states and counts are text: a
    tile is a button named like "Rare. The Sign Flipper: Cube roots keep the sign. Caught 3 times, 1 of 3 clean problems
    to squash it."; unseen tiles are hidden and each species says "9 more not caught yet". The catch's words are inside
    the verdict's alert. The card is a modal dialog named by the species, keeps focus inside (Tab and Shift+Tab go
    round, focus that lands outside comes back), closes with Escape, its close button or a tap outside, and gives focus
    back to the tile. Tiles are 88 px tall, every control at least 44 px; text is navy (or navy/80) on white or gold.

## The species

| Species | Family | Variants | Rare |
|---|---|---|---|
| The Sign Flipper | Sign slips: a + or − lost, flipped or moved, and inequality symbols turned the wrong way | 25 | 2 |
| Bracket Gremlin | Bracket and interval slips: brackets or parentheses, ∪, endpoints, ∞, intervals read backwards | 12 | 1 |
| The Corner Cutter | Shortcut slips: a move done to some terms and not all, or a sum split where nothing splits | 12 | 1 |
| The Scale Tipper | Equation-move slips: a both-sides move done to one side, out of order, or undone with the wrong operation | 7 | 1 |
| The Radical | Radical and rational slips: square roots and their ±, roots with a domain, fractions split or cancelled | 9 | 2 |
| The Upside-Downer | Upside-down slips: a fraction, a ratio or a rate with its top and bottom swapped | 7 | 1 |
| The Power Grabber | Exponent slips: power rules, negative exponents, a square or an exponent forgotten | 8 | 1 |
| Log Splitter | Log slips: the product, quotient and power rules, log values, logs used to undo | 9 | 1 |
| The Base Bandit | Base slips: which base, where it goes, base 10 or e, a base above or below 1 | 7 | 1 |
| The Interest Eater | Growth and decay slips: rates as decimals, compounding, continuous growth, what is left | 7 | 1 |
| The Tangler | Inverse and composition slips: which function inside, f⁻¹ against 1/f, f(x + h), swapping x and y | 16 | 1 |
| The Fence Jumper | Domain and range slips: what may go in, what comes out, where a function is undefined | 10 | 1 |
| The Squinter | Graph-reading slips: increasing or decreasing, highs and lows, x before y, end behavior | 11 | 1 |
| Shifty | Transformation slips: shifts, stretches and reflections the wrong way, size or order | 18 | 1 |
| The Patchwork | Piecewise slips: which piece, which boundary, gaps, domain and range, writing one | 14 | 1 |
| The Slope Slider | Slope and rate slips: rise over run, dividing by the change, parallel and perpendicular, the h | 9 | 1 |
| The Phantom | Ghost-answer slips: extraneous answers kept, real ones dropped, a solution lost by dividing | 6 | 1 |
| The Coefficient Cruncher | Polynomial procedure slips: completing the square, synthetic division, zeros, rational roots | 13 | 1 |
| The Hole Digger | Rational function slips: holes or asymptotes, the degree rule, intercepts at a hole | 9 | 1 |
| The Imaginary Friend | Complex number slips: i², conjugates, a + bi form, powers of i, roots of negatives | 10 | 1 |
| The Mismeasurer | Measure slips: parts and wholes, midpoints, halves and doubles, x for the measure, polygon angle sums | 18 | 1 |
| The Angle Swapper | Angle-pair mix-ups: complementary or supplementary, vertical or linear, transversal pairs, quadrilateral angles | 17 | 1 |
| The If-Then Twister | Logic slips: converse, inverse and contrapositive, counterexamples, the laws of logic | 9 | 1 |
| The Reason Thief | Proof slips: the wrong property for a line, congruence shortcuts that prove nothing, CPCTC too soon | 14 | 1 |
| The Shape Faker | Quadrilateral slips: which properties a shape has, which tests prove it, its most specific name | 11 | 1 |
| The Spinner | Trig slips: radians and degrees, coterminal and reference angles, unit circle values, arcs and sectors | 17 | 1 |
| The Zero Hoarder (chemistry) | Significant figures: which digits count, rounding, the rules for × ÷ and + −, scientific notation | 19 | 1 |
| The Unit Smuggler (chemistry) | Light and units: nanometers to meters, which way the formula goes, c and h | 8 | 1 |
| The Particle Pickpocket (chemistry) | Atomic structure: protons, neutrons, electrons, ions, symbols, isotopes, average mass | 16 | 1 |
| The Orbital Overstuffer (chemistry) | Electron configurations: counting, filling order, the exceptions, ions, cores, valence, diagrams | 17 | 2 |
| The Table Flipper (chemistry) | The periodic table: blocks and families, valence, trends, ion sizes, why a trend goes its way | 20 | 2 |
| The Criss-Crosser (chemistry) | Ionic compounds: balancing charges, polyatomic ions, Roman numerals, -ide, -ate and -ite | 18 | 1 |
| The Name Mangler (chemistry) | Molecular compounds, acids and hydrates: prefixes, hydro-, -ic or -ous, waters, which kind | 14 | 1 |

33 species, 417 variants (305 math, 112 chemistry), 37 rare.

## Design decisions (for review)

- **33 species, not exactly 30.** The brief's families (sign, bracket, inverse and composition, exponent, log, equation
  moves, radical and rational, angle pairs, proof, trig; sig figs, units, nomenclature, electrons) plus one per remaining
  topic. Kind-based where a kind is strong and runs across topics (the Sign Flipper, Bracket Gremlin, the Upside-Downer,
  the Base Bandit, the Corner Cutter, the Phantom), topic-based otherwise (piecewise, rational functions, complex
  numbers, quadrilaterals). The **Sign Flipper is the biggest (25)**: it takes the inequality-direction slips too
  ("flip the sign"); splitting them out ("the U-Turn") would make 34 species. Nomenclature is two species (ionic, and
  molecular/acids/hydrates). Moving an id is one line in `species.ts` (its look changes with its species).
- **Not mistakes, not monsters:** `abandoned` (a behaviour), `squaring_caveat` and `log_check_answers` (notes on a legal
  line). The checker never records them as a mistake, so as monsters they would be silhouettes that can never be caught.
  The placement test accepts only these three, by name.
- **Rare is hand-marked** (`RARE`, 37): the brief's rule is "a mistake only a template or two can produce". The app has
  no list of which mistakes each template can produce, and most module-specific mistakes come from one or two types,
  so the literal rule would make about two thirds of the collection rare. I marked the special cases that only one or
  two problem types can set up, and only on some of their problems (a cube root of a negative, a single-point answer,
  chromium and copper, helium, hydrogen, Hg₂²⁺, a slant asymptote, √(−a)·√(−b), a kite, HL, the root of a sulfur acid...),
  at most two per species. Worth a look by someone who knows each module.
- **Variant looks come from the id, not the list order:** `hash(species:id)` picks the traits; only a clash with an
  earlier sibling's pattern, accessory and eye count draws again (`id#1`, `id#2`...), so adding a mistake at the end of a
  species never changes a caught monster. A test pins the hash of one variant's SVG so an accidental change to the
  generator shows up (change the pin on purpose). Moving an id to another species changes its look.
- **The catch is decided from the event log** like the juice: a store subscriber mounted once in the shell
  (`useMonsterCatches`) looks at events she just added (`freshlyAdded`, never an import or a reset) and calls a mistake
  a first catch when it is not in her log, not in the folded cards and not in `RewardsState.caught` before them
  (`store/catches.ts`). So a mistake she made before the monsters existed is not a catch (it shows its avatar), and the
  memory makes sure the moment never repeats, after a reload or on a device that imported the backup, even where the
  log no longer has it. The memory is written right after the update that caught it (`noteCatches`, a microtask), like
  the milestones. Reset progress clears it, so catches can happen again.
- **The latest named mistake decides the moment:** the catch shows while the verdict for that mistake is on screen;
  the next named mistake (any) starts a new moment, so the same mistake made again shows its avatar. What one tap
  records is one moment (until the next microtask): the interval answer records its two boxes one after the other, so
  the second record of a new mistake would otherwise read as "made before" and hide the first box's catch; within the
  tap the catches add up. A check that names two new mistakes catches both.
- **The "catch" cue replaces the nope** for a first catch (one main sound per moment, as the juice does): a caught
  mistake is a win. One existing test changed for it: the juice's "nope for a slip" test now marks its mistake as caught
  before (one line), so it still tests the nope.
- **Rewards off, the squash still shows** in the completion card (no XP), and the pop plays: "the Monsters tab still
  works ... but no XP is shown" read as "the monsters work". With rewards off the finish sheet does not exist, so the
  completion card is where it shows. Before, the pop was rewards-only; now a squash pops with Sounds on either way.
- **The catch shows with rewards on or off** (it is not XP).
- **No "N of 417 caught" anywhere.** The collection fills in visibly (silhouettes turn into colour), but there is no
  completion count that would reward making mistakes on purpose; the header leads with "squashed".
- **The tab bar is exactly four on every screen** (the brief); the wide top navigation keeps Ask (tutor configured) and
  the Sandbox (family app) after the four, because the brief only names the tab bar and the wide header has the room
  (the existing Ask test expects its link there). The drill left both; Ask and the Sandbox are on Home as before.
- **On a phone the catch shows twice**: in the composer line (where she is looking) and on the work-list card behind it
  (the same component on every screen size). Only one is in view.
- **Colours in the art are hex in `art.ts`** (a pure art module, like the palette constants in `sounds.ts`), not in
  components; the CSS uses the tokens.
- **Silhouettes are the species', not the variant's** (no accessory or pattern leaks a variant before she meets it).
- **Additive store changes:** `RewardsState.caught` (normalized, merged as a union, carried by backups), the action
  `noteCatches`, `store/catches.ts`. `LineVerdict`'s `bad` variant has an optional `pattern` (the composer's verdict
  carries the catalog id). `MomentFacts.caught` (optional). No XP rule, grading, engine, content or catalog text changed.

## Log

- 2026-10-21: read CLAUDE.md, BUILD_GUIDE (§0, §7), roadmap, phone-rewards.md, phone-juice.md, phone-path.md; the
  catalog (420 entries), `store/rewards.ts` (cards per mistake and type, squash after three clean problems), the
  rewards components (MistakeCards, TodayCard, Finish, words), the juice (sounds, cues, useJuice, motion, the milestone
  memory), every place a named mistake is shown (RejectionCard, ComposerVerdict, SigFigFeedback, AtomFeedback,
  FinalAnswerCard and the flows that use them), the tab bar and nav items, App, Home, Progress, the module page, the
  path's dialog (focus trap), BottomSheet, the edition and the store tests.
- Listed every unit's modules and types (a scratch test, deleted) and placed every catalog id by hand; the placement
  test passed on the first run.
- Wrote the art generator, then a scratch rasterizer (Node, no browser: it flattens the shape model and writes PNG
  contact sheets) to look at every species, silhouette and variant at 28 to 240 px. Fixed what the sheets showed: belly
  signs (the Table Flipper's grid, the Name Mangler's tag) hidden behind the feet (a belly layer drawn after the feet,
  and the face a little higher on those species), the Radical's root-sign crest mostly hidden behind its head (raised),
  the Scale Tipper's balance reading as a propeller (bigger pans, a pivot), faint patterns (stronger). Before the first
  render, from the bounds: the hole's lip and the If-Then Twister's arrow sat too near the edge, the triangle's eyes too
  near its sides. The scratch files were deleted.
- Then the store memory (`store/catches.ts`, the slice, backups, the action) and its tests; the collection model
  (`collection.ts`) and its tests from seeded logs; the art tests (deterministic, valid, inside the viewBox, siblings
  distinct, silhouettes); the React art, the catch moment and its banner and avatar in every verdict; the "catch" cue;
  the squash moment; the Monsters page and the card; the navigation; Home, Progress and the set's results.
- Existing tests changed on purpose: `TabBar.test.tsx` (four tabs; the drill marks Home; the wide navigation's extras),
  `Rewards.test.tsx` ("The whole collection" goes to `/monsters`), `Juice.test.tsx` (one line: the slip's mistake was
  caught before, so it is still the nope), `Progress.test.tsx` (the page in a router: it links to the drill now).
- Fixed on the way: a regex in a test built by adding a string to a regex; the composer status's wrapper (the catch
  goes above the row; the row keeps its tests' text). Found reading my own code before the full run: a check that
  records two boxes would start a second moment and hide the first box's catch (now one tap is one moment, with a test);
  a closed species still drew all its tiles (now only while open, with a test). The first full run was stopped for
  these, and the suite run once after them.

## Not done / left alone

- No device or browser testing (by instruction): how the monsters look was checked on PNGs from the scratch rasterizer
  (fills, strokes, dashes and opacity, not the browser's renderer); the flip, wiggle, splat, drops, gold and twinkle are
  covered by jsdom tests of their classes only. Worth a look on the emulator: the catch in the phone composer with the
  keypad up (it adds about 50 px), the splat's timing on the finish sheet, the Monsters tab's scroll with many species
  open, the card as a bottom sheet.
- Rare is a hand-marked list (above); the species placement is a judgment call per id (the table and its families are
  in this file and in `species.ts`).
- The other builder's new math module will add catalog ids: the placement test fails until they are placed in
  `species.ts` (a family's `variants` list), as intended.
- Not changed: how mistakes are detected or named, the catalog's text, cards, squashes, XP, the set builder, mastery,
  content, engines, the flows' logic.

## Verification (2026-10-21)

- `npm run typecheck`: clean (app, node and server configs).
- New tests: `components/monsters/species.test.ts` (7), `art.test.ts` (6), `collection.test.ts` (7),
  `MonsterArt.test.tsx` (3), `Catch.test.tsx` (10), `Squash.test.tsx` (5), `catchCue.test.ts` (2),
  `store/catches.test.ts` (6), `pages/Monsters.test.tsx` (11), `pages/StoreMonsters.test.tsx` (1): 58, and two more
  rows in `TabBar.test.tsx` (`/monsters`, `/sandbox`). Changed on purpose: `TabBar.test.tsx`, `Rewards.test.tsx`,
  `Juice.test.tsx`, `Progress.test.tsx` (see the log).
- Whole suite, `vitest run --maxWorkers=4`, once at the end: 286 files, 4702 tests, all pass (899 s, with another
  builder's suite running beside it).
- `vite build --outDir C:/work/monsters/.tmp-dist`: passes (the existing chunk-size warning only; the Monsters page is
  its own 9 kB chunk). The built CSS keeps the flip-in, wiggle, splat, squashed pose, drops, gold card, rare frame and
  twinkle rules and the reduced-motion block that stops them, and Tailwind generated the arbitrary classes
  (`min-h-[5.5rem]`, `max-h-[88dvh]`, `text-[11px]`, the details-marker rule). The folder was deleted.

## Files

New: `src/components/monsters/{species.ts, art.ts, collection.ts, catchMoment.ts, MonsterArt.tsx, MonsterTag.tsx,
SquashMoment.tsx, MonsterCard.tsx}` and their tests (`species.test.ts`, `art.test.ts`, `collection.test.ts`,
`MonsterArt.test.tsx`, `Catch.test.tsx`, `Squash.test.tsx`, `catchCue.test.ts`), `src/store/catches.ts` (+ test),
`src/pages/Monsters.tsx` (+ `Monsters.test.tsx`, `StoreMonsters.test.tsx`), `docs/progress/phone-monsters.md`.
Changed: `src/store/{types.ts, rewards.ts (normalize and merge the slice), index.ts (noteCatches)}`,
`src/components/{RejectionCard.tsx, ComposerVerdict.tsx, SigFigFeedback.tsx, FinalAnswerCard.tsx, navItems.tsx}`,
`src/components/juice/{sounds.ts, cues.ts, useJuice.ts}`, `src/components/rewards/{Finish.tsx, MistakeCards.tsx,
TodayCard.tsx}`, `src/components/set/SetSummary.tsx`, `src/pages/{Progress.tsx}`, `src/pages/flows/ProblemFrame.tsx`,
`src/App.tsx`, `src/index.css`, `docs/BUILD_GUIDE.md` (§0 UI row, §7); tests `src/components/TabBar.test.tsx`,
`src/components/rewards/Rewards.test.tsx`, `src/components/juice/Juice.test.tsx`, `src/pages/Progress.test.tsx`.
