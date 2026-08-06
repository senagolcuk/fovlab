# Handoff — Sensor FOV Layout

Paste this whole file as your opening prompt on a fresh machine.

---

## Your task

You are taking over an in-progress build. **Read `README.md` first, then `01-brief.md`,
`02-architecture.md`, `03-geometry.md`, `04-ui.md`, `05-build-plan.md` in that order.** Those
documents are the source of truth. If a document contradicts the code, the document wins — or the
document gets updated first, deliberately.

The working agreement in `README.md` is binding. In particular: `src/core/` is pure TypeScript with
no React, no Three.js and no DOM; `npm test` must be green at all times; and **never invent a sensor
specification** — every catalogue entry needs a real datasheet behind it.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 120 tests, all green as of the last commit
npm run build      # tsc -b, then a static bundle in dist/
```

---

## Where the build has got to

Phases 1, 2, 3, 4, 6, 7 and 8 of `05-build-plan.md` are complete and committed. Nine commits, one
per phase plus the scaffold. `npm test` is green and `npm run build` is clean.

Phase 5 is the only one left, and only its **data** half — see "What is left" below.

What exists and works:

- Exact ground polygon, closed-form blind gap, blind spot report, spec resolution — all in `core/`,
  all tested, including the ten acceptance tests from `03-geometry.md`.
- Four synchronised viewports (TOP / FRONT / LEFT / ISO) with per-pane pan and zoom, linked zoom,
  orbit in ISO, fit-all and double-click-to-fit.
- Vehicle box with wheels, nose marker and ground grid; FOV volume, wireframe, optical axis, ground
  footprint and marker per sensor.
- Sidebar: vehicle dimensions, sensor list with inline editor, display options, coverage report,
  navigation help. JSON export and import, localStorage autosave.
- Dragging: direct 2D drag in TOP, `TransformControls` gizmo in ISO, snap to the vehicle body with
  face-normal alignment and Alt to suppress.

---

## Decisions that look wrong but are not — do not "fix" these

A fresh reader is likely to try to undo each of these. Each exists for a reason found the hard way.

1. **`ClearFrame` in `scene/Stage.tsx`.** drei's `<View>` renders with `autoClear` off, and r3f's
   own render pass is disabled once a prioritised `useFrame` exists. Nothing would clear the colour
   or depth buffer. `ClearFrame` runs at priority 0, before the views. Remove it and you get
   smearing and depth garbage.

2. **The pane separators are drawn above the canvas, not as pane borders.** The canvas is opaque
   and covers the whole viewport area, so a `box-shadow` on the pane divs is invisible.

3. **`resize={{ scroll: false, debounce: 0 }}` on the `<Canvas>`.** Views scissor against the canvas
   rect, so a stale measurement offsets every pane.

4. **`scene/useCanvasPointerGate.ts`.** The panes are DOM divs beneath a `pointer-events: none`
   canvas — that is what lets each pane own its own pan, zoom and orbit without fighting the 3D
   event system. But `TransformControls` listens on the canvas, so it would never see a pointer.
   The gate hands the canvas the pointer only while the cursor is inside the ISO pane and within
   `GIZMO_REACH` (130 px) of the selected sensor, plus for the duration of a gizmo drag. If the
   gizmo feels hard to grab, tune `GIZMO_REACH` — do not remove the gate.

5. **The catalogue stores FOV values wider than `FOV_MAX` (179.4°) unclamped.** `parseCatalog` keeps
   what the datasheet says; `clampSpec` limits what the pyramid can draw. The editor shows the real
   figure with "drawn at 179.4°" beneath it. A rectangular pyramid with a flat far plane genuinely
   cannot represent a 190° lens — showing the engineer a number they never looked up is worse than
   admitting the limit.

6. **Dependencies are pinned to Vite 5 and Vitest 2.** The original machine runs Node 18. On
   Node 20+ the majors named in `05-build-plan.md` work as written; upgrade only deliberately.

7. **Two pure modules exist that `02-architecture.md` does not list**, both tested:
   `core/viewport.ts` (the four-pane tiling, so acceptance test 10 covers the layout the app really
   uses) and `core/snap.ts` (snap to the body, closed form against an axis-aligned box).

8. **`SensorFov` is memoised and disposes its geometry.** `updatePose` replaces only the sensor it
   touches, so untouched sensors skip the render. r3f only disposes objects it created itself, so
   the per-frame geometry handed to it as a prop is disposed by hand — without that, a long drag
   leaks one buffer set per frame.

---

## Screenshot rig, if you need to verify rendering

Headless Chrome with SwiftShader works:

```bash
google-chrome --headless=old --disable-gpu --use-angle=swiftshader \
  --enable-unsafe-swiftshader --hide-scrollbars --window-size=1600,900 \
  --virtual-time-budget=15000 --screenshot=out.png \
  --user-data-dir=/tmp/chrome-fov http://localhost:5173/
```

**Known artifact:** the capture resizes the viewport after r3f has measured the canvas, so the
WebGL content in the screenshot sits about 87 px below where the CSS layout puts it. This is the
harness, not the app. To get an aligned capture, temporarily pin the page height in `index.html`:

```html
<style>html, body, #root { height: 813px !important; }</style>
```

Take the screenshot, then remove it again. `window.innerHeight` is 813 for `--window-size=…,900`.

---

## What is left

### Phase 5 — the catalogue (the only outstanding phase)

The mechanism is finished and working: autocomplete picker grouped by manufacturer, the
inherit / override / fully-custom paths, the `Unverified` warning chip and the datasheet link. What
is missing is data.

`src/data/sensors.json` currently ships:

- Four `generic-*` entries. These are definitional rather than products, so they are verified by
  construction — leave them alone.
- Three `sensing-world-isx031-*` test fixtures at 60°, 120° and 190° HFOV. **Only the HFOV figures
  are real** — the user supplied them. VFOV (60) and range (50) are placeholders, deliberately
  identical across all three variants so they cannot be mistaken for per-lens data. All three carry
  `verified: false` and an empty `datasheetUrl`.

The user is building their own sensor database and will supply datasheets. When they do, for each
entry: read every number off the manufacturer datasheet, set `datasheetUrl`, then set
`verified: true`. Do not fill any of these in from memory — a wrong FOV value makes the whole tool
worthless, and this is the one rule the project cares about most.

The suite in `src/core/__tests__/catalog.test.ts` under `the shipped catalogue file` pins this: every
entry parses, ids are unique, the generic entries stay verified, and the 190° lens keeps its
datasheet figure while `clampSpec` reduces it for drawing. Keep that suite honest as entries are
added.

### Not yet verified by anyone

The maths and rendering are covered by tests and by screenshots. The **interactive gestures have
never been clicked through** — they were written and unit-tested at the store level, but no human or
agent has driven them with a real pointer. Treat the checklist below as the first real test pass,
and expect the drag feel to need tuning. `05-build-plan.md` budgets for exactly that: "This phase is
mostly tuning, not typing."

Performance was addressed structurally (memoisation, geometry disposal) but never measured on real
GPU hardware. `05-build-plan.md` asks for 20 sensors at 60 fps in phase 8 — that still needs a
measurement.

### Deliberately out of scope for v1

Do not build these: overlap analysis between sensors, body occlusion of the FOV, deriving FOV from
focal length and sensor size, accounts or server storage, a mobile layout, undo/redo.

---

## Manual test checklist

Desktop only, minimum 1280 px wide. The app opens empty — click `Add sensor`, or pick one of the
`Sensing World ISX031` models from the Model dropdown in the editor.

**Viewports**

1. Drag empty space in any pane. The world should stay glued to the cursor at any zoom, in every
   pane, with no drift.
2. Scroll to zoom. In the orthographic panes the point under the cursor should stay put.
3. `Link zoom` on: scrolling in one pane scales all four by the same factor. Off: only that pane.
   Panning is always per-pane, in both modes.
4. Drag in ISO to orbit; elevation stops at ±83°. Shift+drag pans instead.
5. Double-click a pane fits that pane only. `Fit all views` fits all four — a long-range sensor must
   never be clipped.
6. Check the pane labels: `TOP` should read nose-up with the vehicle's right on screen right;
   `FRONT` looks aft with the vehicle's left on screen right; `LEFT` has the nose pointing screen
   left. Each label shows its scale in metres.

**Geometry checkpoint** (from `05-build-plan.md`, worth repeating by eye)

7. Place a sensor at `z = 2`, `pitch = -90`, `90° × 90°`. The ground square in TOP must measure
   exactly 4 m × 4 m against the 1 m grid. If it does not, stop and fix the maths before anything
   else.

**Editing**

8. Every position, orientation and FOV field writes through to all four views live.
9. Angle labels carry their sign convention — `Yaw (+ left)`, `Pitch (+ up)`, `Roll (+ CW)`. Check
   the signs actually behave that way: positive yaw should turn the FOV towards the vehicle's left.
10. Pick a catalogue model: HFOV, VFOV and range grey out as inherited. Override one — the other two
    stay grey, an `Overridden` chip appears, and clearing the chip restores inheritance.
    `Customise` cuts the link and freezes the current numbers into the instance.
11. Pick the ISX031 190° lens: the field shows `190` with `drawn at 179.4°` beneath it, and an
    `Unverified` warning chip appears.
12. Add, duplicate and delete. A duplicate lands directly below its source with a fresh id.
13. The readout shows footprint area, X and Y extents and the blind gap. Move a sensor inside the
    vehicle box — the occlusion warning should appear.

**Dragging**

14. In TOP, hover a sensor marker — the cursor becomes a grab hand. Drag it; the X and Y fields must
    track live.
15. Drag a sensor to within 15 cm of the vehicle body. It should stick to the surface and swing its
    optical axis to point out of that face. Hold `Alt` while dragging — no snap.
16. Select a sensor, set `Drag in ISO` to `Move`. The gizmo appears at the marker. Dragging an axis
    writes to the position fields live, and the camera must not orbit at the same time. Away from
    the gizmo, orbit still works.
17. Switch to `Rotate`. Dragging a ring writes to yaw, pitch and roll. Rotate to point straight down
    and confirm the numbers stay sane.

**Report and persistence**

18. Place four surround cameras. The `Coverage` panel gives a covered-azimuth percentage and lists
    the gaps with a bearing in words. Gaps shade red on the ground in TOP.
19. The report must not recompute during a drag — it settles 150 ms after you let go. The spinner in
    the panel header shows while the answer on screen is stale.
20. Remove a front sensor: the forward sectors must appear in the report.
21. `Export`, then `Import` in a fresh tab. The layout must come back identically. Import a
    deliberately malformed JSON file — you should get a readable error, not a broken app.
22. Edit the vehicle dimensions, reload the page: they persist.

**Keyboard**

23. `+` / `-` zoom, `F` fits all, `Esc` leaves drag mode and then clears the selection.
24. Click into a number field and type `-6`. The views must not zoom out — keystrokes are ignored
    while a text field has focus.

**Performance**

25. Add twenty sensors and drag one. It should hold 60 fps with all four panes visible.

---

## How to work on this

One phase at a time, to its definition of done, then commit. Small commits, conventional messages
(`feat(core): exact ground polygon`, `fix(ui): top view drag axis`). Never change a function in
`core/` without running `npm test`. Ask when a document is silent — especially about coordinate
conventions or the sign of a rotation.
