# LENS: Calculator instruction accuracy — TI-84 Plus CE and TI-Nspire CX II (non-CAS)

## Findings

### CALC-01 [blocker] Spec scope / user amendment
**Claim:** The spec's calculator panel is TI-84 Plus CE only; the user amendment requires equivalent, verified TI-Nspire CX II (non-CAS) procedures for every problem family, and the Nspire has no DrawInv, no Y= editor, no Indpnt:Ask spelling, and a different implied-multiplication parser, so the TI-84 templates cannot be mechanically re-labelled.

**Evidence:** TI KB 38095 (education.ti.com/.../38095) gives the Nspire inverse method as menu → 3:Graph Entry/Edit → 2:Relation, type x=f1(y), Enter — a relation, not a DRAW command. The Nspire parser treats a name followed by '(' as a function call, so x(y+2) raises 'Invalid implied multiply' (Cemetech/TI ref guide); on the TI-84 X(Y+2) is legal implied multiplication.

**Recommendation:** Implement the panel as a tabbed 'TI-84 Plus CE | TI-Nspire CX II' component with one template per (problem family × calculator). Use the keystroke tables in the reference field verbatim, and give the Nspire templates their own expression serializer (see CALC-06). Persist the chosen calculator tab in localStorage so the student never has to re-pick it.

### CALC-02 [major] TI-84 Plus CE line style
**Claim:** 'left of Y2, ENTER to cycle styles' is the monochrome TI-84 Plus behaviour; on the CE, ENTER on the icon left of Y= opens a Color/Line spinner dialog that must be navigated and confirmed with OK.

**Evidence:** TI-84 Plus CE eGuide 'Using Color on the Graph Screen': 'Press ◄ to highlight the color and line style indicator. Press [enter]. The spinner dialog displays… thick line style is the default. It can be changed by pressing ◄ or ►… highlight OK and then press [enter].' (education.ti.com/html/webhelp/EG_TI84PlusCE/EN/content/eg_gsguide/m_graphs/gph_using_color_graph.HTML). Eight styles are available: Line, Thick (default), shade above, shade below, Path, Animate, Dotted-Thick, Dotted-Thin.

**Recommendation:** Template text: 'In Y=, press ◄ until the colour/line box left of Y2 is highlighted, ENTER. In the spinner, ► to move to the line-style field, ◄/► to pick Dotted-Thin, ▼ to OK, ENTER.' Optionally set colour to Gray in the same dialog so it matches the app's grey y = x line.

### CALC-03 [major] TI-84 Plus CE DrawInv
**Claim:** The spec's DrawInv step omits three facts that make it fail in practice: it must be issued from the HOME screen (not the graph or Y= screen), Y1 must be pasted from VARS → Y-VARS → 1:Function → 1:Y1 (or ALPHA F4) rather than typed as letters, and any subsequent ZOOM/window/Y= change erases the drawing — so the spec's order 'ZSquare, then DrawInv' must be enforced, never reversed.

**Evidence:** TI-84 guidebook: 'You can execute DRAW menu instructions from the home screen or from within a program'; dummies/brownmath DrawInv walkthrough: '[2nd][MODE] to access the Home screen … 2nd PRGM item 8 DrawInv … VARS → Y-VARS → Function → Y1 … ENTER'. TI-84 CE eGuide appendix: syntax 'DrawInv expression[,color#]', 'DrawInv is valid only in Func graphing'. Drawings are not part of the graph database and are cleared on any regraph (guidebook 'Clearing Drawings').

**Recommendation:** Emit: '1) Y= : Y1 = <expr>. 2) ZOOM 6 then ZOOM 5. 3) 2nd MODE (QUIT) to the home screen. 4) 2nd PRGM 8 → pastes DrawInv. 5) VARS ► 1 1 → pastes Y1 (or ALPHA TRACE 1). 6) Optional: , VARS ◄? no — type ,RED via VARS → COLOR to draw it in red, matching the app's coral f⁻¹. 7) ENTER. If you change the window or any Y= line afterwards, the inverse disappears — repeat steps 3-7.' Add: '2nd PRGM 1 ClrDraw' to clear. For the not-one-to-one family, note that DrawInv draws BOTH branches of the reflected relation, which is exactly the 'fails vertical line test' picture the app badges.

### CALC-04 [major] TI-84 Plus CE root entry / parentheses
**Claim:** MATH 4 pastes '³√(' with an open paren that the student must close, and the CE auto-closes unclosed parens at the end of the line — so typing ³√(7X+3-1 silently graphs cbrt(7x+2), which is literally the app's error pattern #8; and MATH 5 (ˣ√) takes the index BEFORE the token, which the spec does not say.

**Evidence:** TI-84 Plus CE eGuide MATH menu: '1: ▶Frac, 2: ▶Dec, 3: ³, 4: ³√(, 5: ˣ√, …' (education.ti.com/html/webhelp/EG_TI84PlusCEOLC/EN/Content/EG_GSGuide/M_Key_Basics/KB_MATH_Menus.HTML). dummies 'Exponents and Roots on the TI-84 Plus': 'type the index first, access the template by pressing [MATH][5], and then type the expression' (in MathPrint the ˣ√ template shows an index box; type index then ► to the radicand). TI KB 34754 confirms 5:ˣ√ usage.

**Recommendation:** Every TI-84 template must render the closing paren explicitly and call it out: 'Y1 = ³√(7X+3) − 1  ← press ) before the −1, otherwise the calculator reads ³√(7X+3−1)'. For nth roots emit '<index> MATH 5 ( <radicand> )'. Add a one-line note in the app's error-pattern-8 lesson: 'Same trap on the calculator: close the ) before the −1.'

### CALC-05 [major] Cube roots of negatives (both calculators)
**Claim:** Templates must never rewrite cbrt(u) as u^(1/3): in the default Real mode the TI-84 CE returns ERR:NONREAL ANS / plots nothing for u<0, and the Nspire returns a 'Non-real result' error (or the complex principal branch in Rectangular mode), so the left half of every cube-root-shift graph vanishes.

**Evidence:** TI KB 31051: cube root of −27 'in rectangular mode returns 1.5 + 2.59808·i, but in real mode it returns −3' when using the root template; with ^(1/3) the real-mode result is a non-real error (KB 36477). dummies TI-84: '(−27)^(1/3) may return an error or a complex number'. The MATH 4 ³√( and the Nspire root template/root(u,3) return the real root.

**Recommendation:** Serializer rule: app cbrt(u) → TI-84 '³√(u)' via MATH 4; → Nspire nth-root template (ctrl + ^ , index 3) or typed root(u,3). Assert in the Vitest suite that no generated calculator string contains '^(1/3)' or '^(1/2)'.

### CALC-06 [major] Nspire expression syntax (implied multiplication, variable names)
**Claim:** The app accepts x(y+2) and 2x; on the Nspire, x(y+2) is parsed as a call to a function named x and errors with 'Invalid implied multiply', so the Nspire serializer must emit explicit multiplication before every '(' that follows a variable, and must rename the independent variable to lowercase x for f1(x).

**Evidence:** TI-Nspire reference guide: 'When the next non-blank following a valid name is a left parenthesis, the name is assumed to be a function/program reference'; Cemetech thread and TI error list show 'x(x+1) is invalid; x*(x+1) is the correct syntax'. Nspire variable names are case-insensitive (Cemetech 'Case-sensitivity on TI-nspire CX CAS'), so X and x are the same variable there, but on the TI-84 only the X,T,θ,n key variable X is graphed in Func mode — typing Y or N in a Y= line silently graphs a constant.

**Recommendation:** Write two serializers: ti84(expr) uppercases the independent variable to X, keeps implicit products (2X, X(X+1) are legal), uses ³√(, √(, abs(, and (−) for unary minus; nspire(expr) lowercases to x, inserts '*' between any name and '(' and between adjacent factors, uses root(u,3)/√(u)/abs(u). For problems stated in n or y as the independent variable (e.g. f(n) = 3n−5), rename to X/x in the panel and say so: 'the calculator only graphs X — treat n as X'. Unit-test both serializers on the eleven seeded homework expressions.

### CALC-07 [major] Nspire non-CAS composition check and Scratchpad scoping
**Claim:** The 'inverse check via nested f1(f2(x))' cannot be done symbolically on the non-CAS CX II — the Calculator app needs a numeric argument (f1(f2(3))) — and the functions are only visible in the same variable scope: Scratchpad Graph ↔ Scratchpad Calculate share variables, but neither shares with a document's Calculator page.

**Evidence:** TI KB 27250 (composite functions) is CAS-only; the non-CAS error is 'Input argument must be numeric' / undefined variable. TI eGuide 'Working with Variables in the Scratchpad': 'Scratchpad variables are shared between Scratchpad Calculate and Scratchpad Graph, but not with any TI-Nspire documents.'

**Recommendation:** Standardise every Nspire template on the Scratchpad (press the Scratchpad key ⌂» to open; press it again to toggle Calculate ↔ Graph). Round-trip check: in Scratchpad Calculate type f1(f2(k)) and f2(f1(k)) with the instance's stored integer check value k — both must return k. Visual composition check: in Scratchpad Graph enter f3(x)=f1(f2(x)) (the grapher evaluates numerically, so this DOES plot on non-CAS) and observe it lies on f4(x)=x. Never emit a symbolic f1(f2(x)) for the Calculator app.

### CALC-08 [minor] Square window rationale differs per calculator
**Claim:** The spec's 'ZStandard then ZSquare' is right for the TI-84 CE (ZStandard is ±10 on both axes over a non-square pixel grid) but on the Nspire Zoom-Standard is already equal-scale, so the Nspire template should only invoke Zoom-Square after a manual window edit or after ctrl+T splits the page.

**Evidence:** TI KB 27950 (Nspire Window/Zoom): '5: Zoom - Standard … automatically sets x-min, x-max, ymin, and y-max to center the origin. The x and y scale factors are equal.' and 'B: Zoom - Square … recalculates y-min and y-max so that the vertical scale is the same as the horizontal scale.' TI-84 CE cheat sheet: ZDecimal is −6.6≤x≤6.6, −4.1≤y≤4.1 (a square, friendly-trace window on the CE) and ZSquare 'makes circles look like circles'.

**Recommendation:** TI-84: keep ZOOM 6 → ZOOM 5 and add ZOOM 4 (ZDecimal) as the alternative when the check value k is small (|k|≤6): it is already square and TRACE steps by 0.1. Nspire: 'menu → 4:Window/Zoom → 5:Zoom-Standard (already square). If you typed your own window or added a table with ctrl+T, press menu → 4 → B:Zoom-Square.'

### CALC-09 [minor] Horizontal line test — Nspire procedure
**Claim:** The Nspire has no interactive DRAW → Horizontal; the reliable equivalent is a constant function that the student grabs and drags, with a Geometry line as fallback.

**Evidence:** TI KB 22951 lists 'Linear function; y=b' among graphs that can be translated by grab-and-drag: 'position the cursor on the graph until the ✥ symbol appears, press ctrl+click, use the Touchpad to translate, esc when finished; the equation updates in real time.' dummies 'Points & Lines Menu': with the Line tool, 'press and hold Shift … adjust the angle of the line in 15-degree increments' to get a horizontal line.

**Recommendation:** Nspire template: 'ctrl+G, enter f9(x)=2, Enter. Hover the new horizontal line until ✥ appears, ctrl+click (or press and hold click), ▲/▼ to slide it up and down, esc to drop it. If any position crosses f1 twice, f1 is not one-to-one.' Use a high slot (f9) so it does not collide with f2/f3 used by the inverse. TI-84 template: from the GRAPH screen 2nd PRGM 3 Horizontal, ▲/▼ moves the line, ENTER stamps it (you may stamp several), CLEAR exits; 2nd PRGM 1 ClrDraw removes them.

### CALC-10 [minor] TI-84 (−) vs − key in Y3 = -Y2
**Claim:** The ± template 'Y3 = -Y2' fails with ERR:SYNTAX if the student uses the subtraction key; the CE requires the (−) negation key, and Y2 must be pasted from VARS/ALPHA F4.

**Evidence:** TI KB 34597 'Shortcuts for Working with Menus': 'press [ALPHA][TRACE] to locate the Y-Var shortcut menu' which pastes Y1…Y9; the − key is binary subtraction on the TI-84 family and produces a syntax error with no left operand.

**Recommendation:** Emit 'Y3 = (−) ALPHA TRACE 2' rendered as 'Y3 = -Y2  (use the (−) key at the bottom, not the − key)'. On the Nspire the ± case is simpler: the Relation x=f1(y) draws both branches at once; only emit f3(x)=−f2(x) when the student wants to compare her algebraic ±√ answer.

### CALC-11 [note] OS / model caveats
**Claim:** Menu numbers and features above are current for TI-84 Plus CE OS 5.8.5 and TI-Nspire CX II OS 6.x; Relation graphing (x=f1(y)) exists only from Nspire OS 4.0, and Graph Entry/Edit numbering shifted at 4.0 (3 = Equation Templates, 4 = Parametric).

**Evidence:** TI software pages list TI-84 Plus CE OS 5.8.5 and TI-Nspire CX II OS 6.4 as current. TI KB 38095 says the x=f1(y) method 'will only work if you have the latest operating system'. dummies (OS 4+) lists Graph Entry/Edit as 1 Function, 2 Relation, 3 Equation Templates, 4 Parametric, 5 Polar.

**Recommendation:** Print a one-line footer on each panel: 'Written for TI-84 Plus CE OS 5.x and TI-Nspire CX II OS 5/6 (non-CAS). The CX II never shipped below OS 5, so Relation graphing is always available; on an old CX (non-II) below OS 4 use the parametric fallback in the reference.' Prefer menu names over numbers in the Nspire text where the number changed across OS versions (Parametric).

## Design decisions

- **Nspire inverse method**: Primary: Relation x=f1(y). Fallback: Parametric x1(t)=f1(t), y1(t)=t with tmin/tmax set explicitly.  
  _Why:_ Relation is TI's documented method (KB 38095), draws both branches for the not-one-to-one case, and needs no t-window; parametric default t-range is 0..6.28 (radians) so negative x would be missing unless tmin/tmax are reset.

- **Nspire workflow scope**: All Nspire templates use the Scratchpad (Graph + Calculate) rather than a document.  
  _Why:_ Scratchpad Graph and Calculate share f1..f9; documents do not share with the Scratchpad, and the Scratchpad is one keypress away from anywhere.

- **Two expression serializers**: ti84(expr) and nspire(expr) are separate functions with unit tests, not string replacements on one template.  
  _Why:_ Variable casing (X vs x), implicit-multiplication legality (X(X+1) OK on 84, x*(x+1) required on Nspire), unary minus ((−) vs −), and root tokens all differ.

- **Panel structure**: Tabbed panel, calculator choice persisted in localStorage, one static template per (family × calculator).  
  _Why:_ Matches the spec's 'static instruction templates … no calculator emulation' while satisfying the amendment.

## Reference

## Calculator keystroke reference (verified Sept 2026)

Worked example used throughout: **f(x) = ∛(7x+3) − 1**, inverse **f⁻¹(x) = ((x+1)³ − 3)/7**, check value k = 3 (f(3) = ∛24 − 1 is not an integer — generator should pick k such that 7k+3 is a perfect cube, e.g. k = 5 → ∛38? no; use the generator constraint: k = (c³−3)/7 integer, e.g. c = 2 → k = 5/7 ✗, c = 5 → k = 122/7 ✗, c = −1 → k = −4/7 ✗, c = 4 → k = 61/7 ✗ … so for this family generate a,b with b ≡ c³ (mod a); the example below uses f(x)=∛(x+7)−1, k = 1 → f(1) = 2−1 = 1).
± example: **g(x) = 4x² − 7**, reflected relation branches **y = ±√((x+7)/4)**.
Rational example: **h(x) = 3/(x+2)**.

Key legend — TI-84: `2nd`, `ALPHA`, `MATH`, `VARS`, `ZOOM`, `Y=`, `(−)` = negation key, `X` = the X,T,θ,n key. Nspire: `menu`, `ctrl`, `⌂»` = Scratchpad key, `click` = touchpad centre, `tab`.

### A. Task-by-task keystrokes

| Task | TI-84 Plus CE (OS 5.x) | TI-Nspire CX II non-CAS (OS 5/6) |
|---|---|---|
| Open grapher | `Y=` | `⌂»` (Scratchpad). If it opens on Calculate, press `⌂»` again for Graph. Entry line hidden? `ctrl`+`G` (or `tab`). |
| Enter f | `Y1 =` type expression, `ENTER`. Use `X` key for x. | `f1(x)=` type expression, `enter`. Use the `x` key (lower-case; Nspire is case-insensitive). |
| Cube root | `MATH` `4` → pastes `³√(` ; type radicand; **type `)`** before anything that follows. Example: `MATH 4 X + 7 ) − 1`. | `ctrl`+`^` → nth-root template; type `3` in the index box, `tab`/`►` to the radicand, type `x+7`, `►` out; then `−1`. Or type `root(x+7,3)−1`. |
| nth root | Type the index **first**, then `MATH` `5`, then the radicand in parens: `5 MATH 5 (X+2)` = ⁵√(x+2). (MathPrint shows a radical with index box.) | Same template as above with index n; or `root(u,n)`. |
| Square root | `2nd` `x²` → `√(`; close with `)`. | `ctrl`+`x²` → √ template; or `sqrt(u)`. |
| Absolute value | `MATH` `►` (NUM) `1:abs(` … `)` | `abs(u)` or Templates key (right of `9`) → \|□\|. |
| Fraction | `ALPHA` `Y=` (F1) `1:n/d`, type numerator, `▼`, denominator, `►` to exit. (Also `MATH` NUM `D:n/d`.) Example h: `3 ▼ X+2 ►`. Requires MathPrint mode (default). | `ctrl`+`÷` → fraction template; numerator, `▼`/`tab`, denominator, `►` out. Or plain `3/(x+2)`. |
| Standard window | `ZOOM` `6` (ZStandard). | `menu` `4` (Window/Zoom) `5` (Zoom-Standard) — already equal-scale. |
| Square window | `ZOOM` `5` (ZSquare) — needed after ZStandard because the CE screen is 265×165 px. Alternative: `ZOOM` `4` ZDecimal = −6.6..6.6 × −4.1..4.1, square, TRACE steps 0.1. | `menu` `4` `B` (Zoom-Square) — only needed after editing the window by hand or after `ctrl`+`T` splits the page. |
| Draw the inverse relation | Order matters: set window first. `2nd` `MODE` (QUIT) → home screen. `2nd` `PRGM` (DRAW) `8` → `DrawInv `. `VARS` `►` `1` `1` → `Y1` (shortcut: `ALPHA` `TRACE` `1`). Optional colour: `,` then `VARS` `►` `►`(COLOR) pick RED. `ENTER`. It is a drawing: not traceable; any ZOOM/WINDOW/Y= change erases it (redo steps). Clear: `2nd` `PRGM` `1` ClrDraw. | `ctrl`+`G` → entry line. `menu` `3` (Graph Entry/Edit) `2` (Relation). Type `x=f1(y)`, `enter`. (Requires OS ≥ 4.0; every CX II qualifies.) The relation is a real graph: it survives zooming and, for a non-1-1 f, draws both branches. Fallback (parametric): `menu` `3` → Parametric (item 4 on OS ≥ 4): `x1(t)=f1(t)`, `y1(t)=t`, set `tmin=−20 tmax=20 tstep=0.05`, `enter`. |
| y = x mirror line | `Y=` → `Y2 = X`. `◄` until the colour/line box left of Y2 is highlighted, `ENTER` → spinner dialog; `►` to line-style field, `◄`/`►` choose *Dotted-Thin*, colour field → *Gray*; `▼` to OK, `ENTER`. | `f2(x)=x`, `enter`. Hover the line, `ctrl`+`menu` → *Attributes* → `▼` to the 2nd row (line style), `◄`/`►` to *dashed* or *dotted*, `enter`. Colour: `ctrl`+`menu` → *Color* → *Line Color*. |
| Horizontal line test | From the GRAPH screen: `2nd` `PRGM` `3` (Horizontal). `▲`/`▼` moves the line; `ENTER` stamps it (repeat for more); `CLEAR` exits. Ask: does any position cross f twice? `2nd` `PRGM` `1` to clear. | `ctrl`+`G`, `f9(x)=2`, `enter`. Hover the new line until ✥ shows, `ctrl`+`click` (grab), `▲`/`▼` to slide, `esc` to release; its equation updates live. Alternative: `menu` `8` Geometry → Points & Lines → Line, click first point, hold `shift` while placing the second to snap horizontal (15° steps). |
| The ± (not one-to-one) case | `Y1 = 4X²−7`. `Y2 = √((X+7)/4)`: `2nd x² ( ( X + 7 ) ÷ 4 ) )`. `Y3 = (−) ALPHA TRACE 2` → shows `-Y2` — **(−) key, not −**. Or simply DrawInv Y1 (draws both branches). | Relation `x=f1(y)` already draws both branches. To compare with her ±√ answer: `f2(x)=√((x+7)/4)`, `f3(x)=−f2(x)` (functions may reference each other). Badge: the relation fails the vertical line test. |
| Evaluate f(k) | Home screen: `ALPHA` `TRACE` `1` → `Y1`, then `(` `3` `)` `ENTER` (i.e. `Y1(3)`). Or `VARS ► 1 1 ( 3 ) ENTER`. | `⌂»` to Scratchpad Calculate. Type `f1(3)` `enter`. (Only works because f1 was defined in the Scratchpad Graph; document Calculator pages do not see Scratchpad functions.) |
| Round-trip / composition check | `Y1(Y2(3))` using `ALPHA TRACE` to paste each name; expect 3. Never type letters Y-1. | `f1(f2(3))` and `f2(f1(3))` → expect 3. Symbolic `f1(f2(x))` errors on non-CAS ('Input argument must be numeric'). Visual: in Graph, `f3(x)=f1(f2(x))` plots numerically and should coincide with `f2(x)=x`… (use the y=x line slot). |
| Table with chosen x-values | `2nd` `WINDOW` (TBLSET) → `Indpnt:` `►` to **Ask**, `ENTER`. `2nd` `GRAPH` (TABLE) → type an X, `ENTER`; Y1 (and Y2…) fill in. | On the Graph: `ctrl`+`T` (split-screen table). With the table pane active: `menu` → *Table* → *Edit Table Settings* → `Independent:` **Ask**, `enter`. Click a cell in the x column, type a value, `enter`. `ctrl`+`T` again removes the table. |
| Clear / start over | `Y=` `CLEAR` on each line; `2nd PRGM 1` ClrDraw. | In Scratchpad Graph: `menu` `1` Actions → *Clear Scratchpad*? (safer: `ctrl`+`G`, `▲` to each fn, `del`). |

### B. Syntax mapping (app text → TI-84 CE → Nspire non-CAS)

| App input | TI-84 Plus CE Y= line | TI-Nspire CX II entry line | Notes |
|---|---|---|---|
| `x` (independent var, any of x/n/y in the problem) | `X` (X,T,θ,n key) | `x` | Only X is graphed on the 84 in Func mode; rename n→X in the panel and say so. Nspire is case-insensitive. |
| `cbrt(u)` | `³√(u)` via `MATH 4` — close the `)` | nth-root template (`ctrl`+`^`, index 3) or `root(u,3)` | Never `u^(1/3)`: real-mode error / missing left half on both. |
| `sqrt(u)` | `√(u)` via `2nd x²` | `√(u)` via `ctrl`+`x²` or `sqrt(u)` | Even root: both calculators graph only the principal branch. |
| `abs(u)` | `abs(u)` via `MATH ► 1` | `abs(u)` or \|□\| template | |
| `a/b` (fraction coefficient, e.g. `(3/5)y`) | `n/d` template `ALPHA Y= 1` or `(3/5)X` | `ctrl`+`÷` template or `(3/5)*x` | |
| `3/(x+2)` | `3/(X+2)` | `3/(x+2)` | Keep the parens in both. |
| `u^3`, `u^2` | `u^3`, `u²` via `x²` key or `MATH 3` for ³ | `u^3`, `u²` | Parenthesise negative bases: `(-2)^2`. |
| `2x`, `2(x+1)` | `2X`, `2(X+1)` | `2x`, `2(x+1)` | Numeric coefficient implied multiplication is legal on both. |
| `x(y+2)`, `x(x+1)` | `X(X+1)` legal | **must be** `x*(x+1)` — `x(x+1)` = 'Invalid implied multiply' | Serializer inserts `*` between a name and `(` for Nspire. |
| unary minus `-f(x)` | `(−)` key: `-Y2` | `(−)` key or `−`: `−f2(x)` | On the 84 the binary − key gives ERR:SYNTAX. |
| `f(x)` references | `Y1`, `Y2` pasted via `ALPHA TRACE n` / `VARS ► 1 n` | `f1(x)`, `f2(x)` typed | Typing the letter Y then 1 on the 84 does not create Y1. |
| `∞`, `U`, `{x | …}` (final-answer notation) | not enterable — panel says 'read from the graph/number line' | same | Inequality module shades the app's number line instead. |

### C. OS caveats
- TI-84 Plus CE current OS 5.8.5 (TI software page). MATH/DRAW/ZOOM numbering above is stable across 5.x; `DrawInv expression[,color#]` colour argument is CE-only; the Y= colour/line *spinner dialog* is CE-only (monochrome 84 Plus cycles with ENTER).
- TI-Nspire CX II current OS 6.x (TI page lists 6.4). Relation graphing (`x=f1(y)`) needs OS ≥ 4.0 (TI KB 38095 'latest operating system'); Graph Entry/Edit on OS ≥ 4 is 1 Function, 2 Relation, 3 Equation Templates, 4 Parametric, 5 Polar. Window/Zoom is 1 Window Settings … 5 Zoom-Standard … A Zoom-Fit, B Zoom-Square, C Zoom-Decimal (TI KB 27950). Non-CAS cannot evaluate symbolic compositions; use numbers or graph them.
- Sources checked: TI-84 Plus CE eGuide (MATH menus; Using Color on the Graph Screen; Appendix D DrawInv), TI KB 34754/34597, dummies TI-84 root/DrawInv/line-style articles, brownmath DrawInv; TI KB 38095 (Nspire inverse via Relation), 27950 (Window/Zoom), 29131 (nth root ctrl+^ / root(value,n)), 31051 & 36477 (negative roots, real vs rectangular), 22951 (grab-and-drag y=b), 25131 (ctrl+T table), TI eGuide 'Graphing Relations', 'Working with Function Tables' (Independent Auto/Ask), 'Working with Variables in the Scratchpad', Cemetech/TI ref guide on implied multiplication and case-insensitivity, TI software pages for OS versions.
