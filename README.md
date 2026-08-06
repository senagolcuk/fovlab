# Sensor FOV Layout — documentation set

These documents are the source of truth for the project. Read them in order before writing code.

| File | What it defines |
|---|---|
| `01-brief.md` | What we are building, stack, what is in and out of scope |
| `02-architecture.md` | Folder layout, module boundaries, data model, state |
| `03-geometry.md` | All maths, with acceptance tests |
| `04-ui.md` | Screen layout, viewports, controls, interactions |
| `05-build-plan.md` | Phased plan with a definition of done per phase |
| `sensors.seed.json` | Starting sensor catalogue |

---

## Working agreement

Rules for any AI agent working on this repo.

**Read before writing.** Consult the relevant doc before implementing a feature. If a doc
contradicts the code, the doc wins — or the doc gets updated first, deliberately.

**`src/core/` is sacred.** It is pure TypeScript: no React, no Three.js, no DOM. Every function
in it is deterministic and unit tested. Never change a function in `core/` without running
`npm test`. The acceptance tests in `03-geometry.md` must pass at all times.

**Never invent sensor specifications.** Every entry in the catalogue needs a real datasheet
behind it. If a number is not confirmed, set `"verified": false` and leave `datasheetUrl` empty.
A wrong FOV value makes the whole tool worthless.

**One phase at a time.** Finish a phase to its definition of done, commit, then move on. Do not
start phase 6 work while phase 4 is half-built.

**Small commits, conventional messages.** `feat(core): exact ground polygon`, `fix(ui): top view
drag axis`.

**Ask when the spec is silent.** If a doc does not cover a case, ask rather than guessing —
especially for anything touching coordinate conventions or sign of a rotation.

## Running it

The app lives in this repo alongside the documents.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # the acceptance tests from 03-geometry.md, and the rest
npm run build      # type-check, then a static bundle in dist/
```

Dependencies are pinned to Vite 5 and Vitest 2 because the toolchain here is Node 18. On
Node 20+ the majors in `05-build-plan.md` work as written.

`dist/` is a static SPA built with a relative asset base, so it can be dropped at
`/tools/fov-layout` or on a subdomain without a rebuild.

## Source layout

See `02-architecture.md`. Two files exist that the architecture document does not list, both
pure and both tested:

- `core/viewport.ts` — the four-pane tiling, so acceptance test 10 covers the layout the app
  actually uses rather than a parallel copy of it.
- `core/snap.ts` — snap to the vehicle body, closed form against an axis-aligned box.

## Catalogue status

`src/data/sensors.json` currently ships only the four `generic-*` entries, which are
definitional rather than products and so are verified by construction. The placeholder entries
from `sensors.seed.json` were removed rather than shipped unverified. Growing this to the
15–20 real models in phase 5 needs manufacturer datasheets — see the working agreement above.
