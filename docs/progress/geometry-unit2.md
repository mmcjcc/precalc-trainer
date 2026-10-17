# Honors Geometry, Unit 2 (reasoning and proof)

Course `geometry`, unit `g2`, title "Reasoning and proof". Two modules, both on the existing geometry screen (`GeometryFlow`): parts one at a time, three hint rungs, entries kept across a reload, and a figure only when the problem has points. Everyday statements use `points: []`, so the picture is skipped.

Unit `g1` is unchanged. Unit `g3` (Parallel and perpendicular lines) is still empty.

## Modules

- `geoLogic` (order 11), "Conditionals and logic": `gl.related`, `gl.truth`, `gl.laws`
- `geoProof` (order 12), "Properties and proofs": `gp.reason`, `gp.algebraic`, `gp.twocolumn`

She never types a reason. The picker is a search box plus one 44 px radio per reason, grouped, and the arrow keys move the pick.

## Statement bank

Each row is one conditional "If p, then q." The four related sentences:

- conditional: If p, then q.
- converse: If q, then p.
- inverse: If not p, then not q.
- contrapositive: If not q, then not p.

A counterexample makes that form's hypothesis true and its conclusion false. The contrapositive has the conditional's truth value. The inverse has the converse's. `auditBank` in `src/content/modules/geometry/bank.ts` checks both, and that a true form has no counterexample in the pool.

### Vertical angles are congruent

- p: two angles are vertical angles
- q: the two angles are congruent
- not p: two angles are not vertical angles
- not q: the two angles are not congruent
- conditional true, converse false, inverse false, contrapositive true
- Counterexample (converse and inverse): Angle 1 and angle 2 both measure 40 degrees, and they sit next to each other instead of opposite each other. (p false, q true)
- Fits: Angle 1 and angle 3 are opposite angles where two lines cross, and both measure 40 degrees.
- Misses both: Angle 1 measures 30 degrees and angle 2 measures 50 degrees, and the angles are not opposite each other.

### A linear pair is supplementary

- p: two angles form a linear pair
- q: the two angles are supplementary
- not p: two angles do not form a linear pair
- not q: the two angles are not supplementary
- conditional true, converse false, inverse false, contrapositive true
- Counterexample (converse and inverse): Angle 1 measures 40 degrees and angle 2 measures 140 degrees, and the angles are not adjacent. (p false, q true)
- Fits: Angle 1 and angle 2 are adjacent and form a straight line, so one measures 40 degrees and the other measures 140 degrees.
- Misses both: Angle 1 measures 40 degrees and angle 2 measures 50 degrees, and the angles are not adjacent.

### Right angles are congruent

- p: two angles are right angles
- q: the two angles are congruent
- not p: the two angles are not both right angles
- not q: the two angles are not congruent
- conditional true, converse false, inverse false, contrapositive true
- Counterexample (converse and inverse): Angle 1 and angle 2 both measure 45 degrees. (p false, q true)
- Fits: Angle 1 and angle 2 both measure 90 degrees.
- Misses both: Angle 1 measures 30 degrees and angle 2 measures 60 degrees.

### A midpoint makes equal parts

- p: M is the midpoint of AB
- q: AM equals MB
- not p: M is not the midpoint of AB
- not q: AM does not equal MB
- conditional true, converse false, inverse false, contrapositive true
- Counterexample (converse and inverse): AM equals MB, and M is not on line AB. (p false, q true)
- Fits: M is the midpoint of AB, so AM and MB are the same length.
- Misses both: M is not on line AB, and AM is longer than MB.

### Betweenness and segment addition

- p: B is between A and C
- q: AB + BC equals AC
- not p: B is not between A and C
- not q: AB + BC does not equal AC
- all four true (the definition runs both ways for three collinear points)
- Fits: A, B, and C are on one line with B between A and C, and the two pieces add to the whole.
- Misses both: A, B, and C are the vertices of a triangle, so B is not between A and C and the pieces do not add to AC.

### Complementary angles add to 90

- p: two angles are complementary
- q: the measures of the two angles add to 90 degrees
- not p: two angles are not complementary
- not q: the measures of the two angles do not add to 90 degrees
- all four true (this is the definition)
- Fits: Angle 1 measures 30 degrees and angle 2 measures 60 degrees.
- Misses both: Angle 1 measures 30 degrees and angle 2 measures 40 degrees.

### Supplementary angles add to 180

- p: two angles are supplementary
- q: the measures of the two angles add to 180 degrees
- not p: two angles are not supplementary
- not q: the measures of the two angles do not add to 180 degrees
- all four true (this is the definition)
- Fits: Angle 1 measures 40 degrees and angle 2 measures 140 degrees.
- Misses both: Angle 1 measures 40 degrees and angle 2 measures 50 degrees.

### A right angle measures 90

- p: an angle is a right angle
- q: the angle measures 90 degrees
- not p: an angle is not a right angle
- not q: the angle does not measure 90 degrees
- all four true (this is the definition)
- Fits: Angle 1 is a right angle, so it measures 90 degrees.
- Misses both: Angle 1 measures 40 degrees.

### Perpendicular lines form a right angle

- p: two lines are perpendicular
- q: the two lines intersect to form a right angle
- not p: two lines are not perpendicular
- not q: the two lines do not intersect to form a right angle
- all four true (this is the definition)
- Fits: Line AB is perpendicular to line CD, and they meet in a right angle.
- Misses both: Line AB and line CD meet in a 40 degree angle.

### Congruent angles have the same measure

- p: two angles are congruent
- q: the two angles have the same measure
- not p: two angles are not congruent
- not q: the two angles do not have the same measure
- all four true (this is the definition)
- Fits: Angle 1 and angle 2 are congruent, and both measure 40 degrees.
- Misses both: Angle 1 measures 30 degrees and angle 2 measures 50 degrees.

### Congruent segments have the same length

- p: two segments are congruent
- q: the two segments have the same length
- not p: two segments are not congruent
- not q: the two segments do not have the same length
- all four true (this is the definition)
- Fits: Segment AB is congruent to segment CD, and both are 5 units long.
- Misses both: Segment AB is 5 units long and segment CD is 8 units long.

### An acute angle is not obtuse

- p: an angle is acute
- q: the angle is not obtuse
- not p: an angle is not acute
- not q: the angle is obtuse
- conditional true, converse false, inverse false, contrapositive true
- Counterexample (converse and inverse): Angle 1 measures 90 degrees. It is not acute and it is not obtuse. (p false, q true)
- Fits: Angle 1 measures 40 degrees.
- Misses both: Angle 1 measures 120 degrees.

### Complementary angles are acute

- p: two angles are complementary
- q: each of the two angles is acute
- not p: two angles are not complementary
- not q: the two angles are not both acute
- conditional true, converse false, inverse false, contrapositive true
- Counterexample (converse and inverse): Angle 1 measures 30 degrees and angle 2 measures 40 degrees. Both are acute, and they are not complementary. (p false, q true)
- Fits: Angle 1 measures 30 degrees and angle 2 measures 60 degrees.
- Misses both: Angle 1 measures 100 degrees and angle 2 measures 80 degrees.

### Three collinear points have one between the others

- p: A, B, and C are three distinct collinear points
- q: one of the three points is between the other two
- not p: A, B, and C are not three distinct collinear points
- not q: none of the three points is between the other two
- all four true
- Fits: A, B, and C lie on one line, with B between A and C.
- Misses both: A, B, and C are the three vertices of a triangle.

### An angle bisector makes congruent angles

- p: ray BD bisects angle ABC
- q: angle ABD is congruent to angle DBC
- not p: ray BD does not bisect angle ABC
- not q: angle ABD is not congruent to angle DBC
- all four true (this is the definition, for a ray from the vertex)
- Fits: Ray BD bisects angle ABC, and the two pieces measure 20 degrees each.
- Misses both: Ray BD splits angle ABC into a 20 degree angle and a 30 degree angle.

### A linear pair is adjacent

- p: two angles form a linear pair
- q: the two angles are adjacent
- not p: two angles do not form a linear pair
- not q: the two angles are not adjacent
- conditional true, converse false, inverse false, contrapositive true
- Counterexample (converse and inverse): Angle ABD and angle DBC share ray BD and together make a 70 degree angle, not a straight line. (p false, q true)
- Fits: Angle 1 and angle 2 are next to each other and form a straight line.
- Misses both: Angle 1 and angle 2 are opposite angles formed by two crossing lines.

### Saturday means no school

- p: it is Saturday
- q: there is no school
- not p: it is not Saturday
- not q: there is school
- conditional true, converse false, inverse false, contrapositive true
- Counterexample (converse and inverse): It is Sunday, and there is no school. (p false, q true)
- Fits: It is Saturday, and there is no school.
- Misses both: It is Wednesday, and there is school.
- No figure.

### Rain makes the ground wet

- p: it is raining
- q: the ground is wet
- not p: it is not raining
- not q: the ground is dry
- conditional true, converse false, inverse false, contrapositive true
- Counterexample (converse and inverse): The sprinkler is on, so the ground is wet, and it is not raining. (p false, q true)
- Fits: It is raining, and the ground is wet.
- Misses both: It is sunny, and the ground is dry.
- No figure.

### Congruent angles need not be right angles

- p: two angles are congruent
- q: the two angles are right angles
- not p: two angles are not congruent
- not q: the two angles are not both right angles
- conditional false, converse true, inverse true, contrapositive false
- Counterexample (conditional and contrapositive): Angle 1 and angle 2 both measure 40 degrees. They match, and neither is a right angle. (p true, q false)
- Fits: Angle 1 and angle 2 both measure 90 degrees.
- Misses both: Angle 1 measures 30 degrees and angle 2 measures 50 degrees.

The converse is true here: if both angles are right angles, then they are congruent. A biconditional is true only when the conditional and the converse are both true, so "two angles are congruent if and only if the two angles are right angles" is false.

### Complementary is not supplementary

- p: two angles are complementary
- q: the two angles are supplementary
- not p: two angles are not complementary
- not q: the two angles are not supplementary
- all four false
- Counterexample (conditional and contrapositive): Angle 1 measures 30 degrees and angle 2 measures 60 degrees. (p true, q false)
- Counterexample (converse and inverse): Angle 1 measures 100 degrees and angle 2 measures 80 degrees. (p false, q true)
- Misses both: Angle 1 measures 20 degrees and angle 2 measures 30 degrees.

### Chains used by the laws

Each chain is two true implications, p → q → r, so detachment and syllogism have an honest conclusion. The traps are the conclusion that does not follow.

1. Vertical angles → congruent → same measure.
2. Linear pair → supplementary → the measures add to 180 degrees.
3. M is the midpoint of AB → AM equals MB → segment AM is congruent to segment MB.
4. Ray BD bisects angle ABC → angle ABD is congruent to angle DBC → those two angles have the same measure.
5. It is Saturday → there is no school → the school bell does not ring. No figure.
6. It is raining → the ground is wet → the sidewalk is dark. No figure.

The five patterns:

- Affirming the conclusion: If p then q, and q. Nothing follows. The trap concludes p.
- Denying the hypothesis: If p then q, and not p. Nothing follows. The trap concludes not q.
- Syllogism: If p then q, and if q then r. Then if p then r. The trap reverses it to if r then p.
- Wrong order: If p then q, and if r then q. Nothing follows. The trap concludes if p then r.
- Detachment: If p then q, and p. Then q. The trap says nothing follows.

## Reason bank

Grouped, and searched as a list. "Given" is a reason on algebraic proofs and two-column proofs.

- Equality: addition, subtraction, multiplication, division, substitution, distributive, reflexive, symmetric, transitive.
- Congruence: reflexive, symmetric, transitive.
- Definitions: midpoint, segment bisector, angle bisector, congruent segments, congruent angles, complementary, supplementary, right angle, perpendicular lines.
- Postulates: segment addition, angle addition, linear pair.
- Theorems: vertical angles, congruent supplements, congruent complements, all right angles are congruent.

## Named mistakes

New `geo_` ids. Unit 1's ids are unchanged.

- `geo_converse_inverse_swapped` — she picks the converse where the inverse belongs, or the reverse.
- `geo_contrapositive_half` — only one part is negated.
- `geo_contrapositive_unswitched` — both parts negated, but not swapped (that is the inverse).
- `geo_false_converse` — she treats a false converse, or a false if-and-only-if, as true.
- `geo_counterexample_hypothesis` — the situation she picks does not satisfy the hypothesis.
- `geo_affirm_conclusion` — from "if p then q" and q, she concludes p.
- `geo_deny_hypothesis` — from "if p then q" and not p, she concludes not q.
- `geo_syllogism_order` — the chain is reversed, or the second premise is not the next link.
- `geo_missed_detachment` — detachment applies and she says nothing follows.
- `geo_midpoint_for_addition` — definition of midpoint where the segment addition postulate is required.
- `geo_addition_for_midpoint` — the segment addition postulate where the definition of midpoint is required.
- `geo_substitution_for_transitive` — substitution where transitive is required.
- `geo_equality_for_postulate` — the addition property of equality where the segment or angle addition postulate is required.
- `geo_reflexive_for_symmetric` — reflexive where symmetric is required.
- `geo_congruent_for_midpoint` — the definition of congruent segments where the definition of midpoint is required.
- `geo_linear_for_vertical` — the linear pair postulate where the vertical angles theorem is required.
- `geo_vertical_for_linear` — the vertical angles theorem where the linear pair postulate is required.

A wrong pick that is none of these is a plain wrong answer: "That choice does not answer this part." or "That reason does not justify this line."

Catalog examples and rule cards use a reserved story (a square, segments JK and LM, x = 4, angle 8 measuring 17). Generated proofs never use letters J, K, or L, never use x = 4 as an answer, and never use angle label 8 or measure 17. The midpoint point is still named M.

## Proof skeletons

Twelve two-column proofs. Letters and numbers change with the seed. One or two rows ask for the statement; the rest ask for the reason. Each skeleton has a hand-written check that the reason on each row really justifies that row.

1. `midpoint-algebra` — M is the midpoint, AM and MB are linear expressions, prove x. The generated x is never 4.
2. `seg-overlap` — A, B, C, D in that order and AB = CD, prove AC = BD.
3. `linear-supp` — angle 1 and angle 2 are a linear pair and angle 2 is congruent to angle 3, prove angle 1 and angle 3 are supplementary.
4. `vertical-prove` — two lines cross; prove the opposite angles are congruent from the linear pairs and the congruent supplements theorem.
5. `vertical-apply` — vertical angles are congruent, so they have the same measure.
6. `cong-supplements` — two angles supplementary to the same angle are congruent.
7. `cong-complements` — two angles complementary to the same angle are congruent.
8. `right-angles` — two right angles are congruent, from the definition and the transitive property (not the theorem, so the theorem stays something she can name on a one-line reason).
9. `angle-bisector` — a bisector makes two congruent pieces, which add to the whole angle.
10. `segment-bisector` — a bisector passes through the midpoint, so the pieces match and the segments are congruent.
11. `transitive-segments` — AB = CD and CD = EF, so AB = EF, and the equality can be written the other way.
12. `perpendicular` — perpendicular lines form a right angle, which measures 90 degrees.

Algebraic proofs, three shapes, three to five lines, the first line given:

- `sym-div` — na = nx, swap, divide. Three lines.
- `distribute` — a total equals n(x + b). Swap, distribute, subtract, divide. Five lines.
- `chain` — two expressions equal the same total. Transitive, then subtract twice. Five lines. Exactly one integer solution, and the two expressions do not have the same coefficient.

One-line reasons (`gp.reason`) are sentences whose wording picks the reason: a swapped equality, a midpoint, a linear pair, segment or angle addition, vertical angles, and the transitive property for equality or congruence.

## Fixed-seed traps

Hash routes. Seed 1 is the base36 seed `1`.

- `#/p/geoLogic/gl.related/1` — `geo_converse_inverse_swapped`
- `#/p/geoLogic/gl.truth/1` — `geo_false_converse`
- `#/p/geoLogic/gl.laws/1` — `geo_affirm_conclusion`
- `#/p/geoProof/gp.reason/1` — `geo_reflexive_for_symmetric`
- `#/p/geoProof/gp.algebraic/1` — `geo_reflexive_for_symmetric`
- `#/p/geoProof/gp.twocolumn/1` — `geo_addition_for_midpoint` (the segment addition postulate, where the midpoint definition is required)

`#/p/geoLogic/gl.related/h` (seed 17) is the Saturday statement and has no figure.

## Checked

`npm run typecheck`, the full Vitest suite (151 files, 2323 tests), and `vite build` passed. No browser pass: a dev server was not started. The jsdom flow tests cover a named mistake and the fix, a reload, the reason list by keyboard, a plain wrong choice, and the missing figure on an everyday statement.
