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

## Getting started

```bash
npm create vite@latest sensor-fov -- --template react-ts
cd sensor-fov
npm i three @react-three/fiber @react-three/drei zustand
npm i @mui/material @emotion/react @emotion/styled @mui/icons-material
npm i -D vitest @types/three
```
