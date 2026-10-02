# Classes, units, and the new name — progress log

Scope: rename the student-facing app to Math & Science Trainer, add a course/unit registry, and group Home, the module page and Progress by class and unit. No new problem types. Not touched: `src/engine/`, module templates, `Dockerfile`, `nginx.conf`, `docker/`, `deploy/`, `server/`, `.github/`. Left uncommitted.

## Plan

- Name: page title and meta, manifest (`name` / `short_name`), header, Home heading, PIN page, README heading and first paragraph. Backup export writes `math-science-trainer` and still imports `precalc-trainer`.
- Registry: `src/content/courses.ts` (precalc units 1–2, chemistry chapters 3–5). Home grouping comes from here. `ModuleDef.subject` stays.
- Settings (additive): `courseId?`, `unitByCourse?`. Old saves without them still load. Included in backup settings.
- Screens: class tabs and a unit switcher on Home, `/c/:courseId` and `/c/:courseId/:unitId`, module eyebrow and Back link, Progress grouped by class.

## Log

- Chemistry check: `atoms` says CK-12 Chemistry - Intermediate ch. 4, `electrons` says CK-12 Introductory Chemistry ch. 5. `sigFigs` never names a chapter number, so it stays Chapter 3 / Measurements.
- Unit 1 modules are stored in `ModuleDef.order` (Home's old order), not the order they were listed in the brief.
- A first visit does not write `courseId` until she picks a class or opens a real `/c/...` link. The class comes from the latest event that belongs to a registered module (a drill-family event is skipped). The unit is the last unit of that class that already has modules, so a significant-figures event opens Chemistry on Chapter 5.
- Weak spots sits with Continue, above the tabs, and draws from every unit of the selected class. Home in the header stays current on `/c/...`.
- Progress skill rows and named mistakes are split by class. The per-class pattern counts still add up to the old global `patternCounts`. A skill that is not a registered template (drill family, retired id) is under Other.
- Checked: `tsc` for `tsconfig.app.json`, `tsconfig.node.json`, and `server/tsconfig.json`; full Vitest suite (109 files, 1892 tests); `vite build`. No dev server.
