# 05 — Build plan

13–20 working days, full time. Each phase ends with a commit and a working app. Never leave the
app in a state where `npm run dev` shows a blank screen overnight.

---

## Phase 1 — Core maths (day 1)

Port and harden the geometry.

- `core/types.ts`, `core/rotation.ts`, `core/frustum.ts`, `core/ground.ts`
- Blind gap in closed form — replace the old sampled version
- All 10 acceptance tests from `03-geometry.md` in Vitest

**Done when:** `npm test` is green and `core/` has no import from React or Three.js.

---

## Phase 2 — Store and shell (day 2)

- Zustand store per `02-architecture.md`
- MUI theme, app bar, sidebar shell, empty stage
- localStorage autosave and rehydrate

**Done when:** vehicle dimensions can be edited, and a reload restores them.

---

## Phase 3 — Scene and four viewports (days 3–5)

- Vehicle box, edges, wheels, ground grid, nose marker
- Four `<View>` panes with the exact camera setup from `04-ui.md`
- FOV volume, wireframe edges, optical axis, ground polygon, sensor marker
- Pan, zoom, orbit, linked zoom, fit all, double-click to fit
- Pane labels with scale and axis hints

**Done when:** three hardcoded sensors render correctly in all four panes and fit-all frames
everything without clipping.

Checkpoint: place a sensor at `z = 2, pitch = −90, 90°×90°` and confirm the ground square is
4 m × 4 m in the TOP view. If it is not, stop and fix the maths before continuing.

---

## Phase 4 — Sidebar and sensor editing (days 6–8)

- Vehicle panel, display panel, navigation help
- Sensor list, selection, expand-to-edit
- All position, orientation and FOV fields wired to the store
- Add, duplicate, delete
- Per-sensor coverage readout
- JSON export and import

**Done when:** a full layout can be built, exported, reloaded in a fresh tab and imported back
identically.

---

## Phase 5 — Catalogue (days 9–11)

- `data/sensors.json` and the spec resolution logic
- Autocomplete picker in the sensor editor
- Inherit / override / fully custom paths
- `verified` warning chip and datasheet link

Then the slow part: collect real datasheets and fill in real numbers. Start with the seed file and
grow it to 15–20 models. Budget most of a full day for this and do not rush it — verify each
number against a PDF, not against memory.

**Done when:** picking a model fills the FOV fields, overriding one field leaves the others
inherited, and every shipped entry has `verified: true` with a datasheet URL.

---

## Phase 6 — Dragging (days 12–15)

- `TransformControls` in ISO, move and rotate modes
- Direct 2D drag in the TOP view
- Snap to vehicle body with face-normal alignment, `Alt` to suppress
- Orbit suppression during gizmo drag
- Debounced report recomputation

This phase is mostly tuning, not typing. Expect several rounds of "drag it, dislike the feel,
adjust". Leave room for that.

**Done when:** a sensor can be positioned entirely by mouse, the numeric fields track the drag
live, and nothing stutters with eight sensors visible.

---

## Phase 7 — Blind spot report (days 16–17)

- 72 azimuth sectors, uncovered sectors within 5 m
- Sidebar panel listing the gaps
- Optional: highlight uncovered sectors on the ground in the TOP view

**Done when:** removing a front sensor makes the forward sectors appear in the report.

---

## Phase 8 — Polish and ship (days 18–20)

- Keyboard shortcuts, focus handling, empty and error states
- Import validation against malformed JSON
- Performance pass — 20 sensors should stay at 60 fps
- README, build, deploy

**Done when:** it is live at its URL and a colleague can use it without being told how.

---

## If you fall behind

Cut in this order:

1. Snap to body (phase 6)
2. Ground highlight of uncovered sectors (phase 7)
3. The whole blind spot report (phase 7)
4. TOP view 2D drag — keep only the ISO gizmo

Never cut phase 1 tests or phase 5 verification. Those are what separate this from a demo.
