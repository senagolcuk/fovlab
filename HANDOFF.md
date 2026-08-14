# Handoff — fovlab

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

Node 18 or 20+ (Vite 5 and Vitest 2 both want `^18.0.0 || >=20.0.0`).

```bash
npm ci             # or npm install
npm run dev        # http://localhost:5173
npm test           # 203 tests, all green as of the last commit
npm run build      # tsc -b, then a static bundle in dist/
```

`TEST-PLAN.md` sorts the manual checklist below into what the suite already proves and what still
needs a human. Read it before doing a test pass, so you do not re-verify what is already pinned.

---

## Where the build has got to

Every phase of `05-build-plan.md` is complete except the **data** half of phase 5 — see "What is
left". `npm test` is green and `npm run build` is clean.

What exists and works:

- Exact ground polygon, closed-form blind gap, blind spot report, spec resolution — all in `core/`,
  all tested, including the ten acceptance tests from `03-geometry.md`.
- Four synchronised viewports (TOP / FRONT / LEFT / ISO) with per-pane pan and zoom, linked zoom,
  orbit in ISO, middle-drag pan, fit-all and double-click-to-fit.
- Vehicle body in three shapes — box, rounded, cylinder — with wheels, nose marker and a ground grid
  whose cell size is settable. FOV volume, wireframe, optical axis, ground footprint and marker per
  sensor. Dimension lines over the orthographic panes.
- An optional merged draw: every visible FOV as one shape in one colour, so overlaps stop
  compounding. Shading only — each sensor keeps its own range.
- Sidebar: vehicle, display, sensor list with inline editor, coverage report, navigation help.
  JSON export and import, localStorage autosave, Reset, fullscreen.
- Dragging, gated behind the `Drag` control: direct 2D drag in TOP, `TransformControls` gizmo in
  ISO, snap to the body with face-normal alignment and Alt to suppress.
- Undo/redo over the layout, a delete prompt with a saved preference, and user-defined sensor
  models that travel with an exported layout.

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

4. **The canvas keeps `pointer-events: none` at all times.** The panes are DOM divs beneath it,
   which is what lets each pane own its own pan, zoom and orbit without fighting the 3D event
   system.

   *This entry used to describe `scene/useCanvasPointerGate.ts`, which handed the canvas the
   pointer within `GIZMO_REACH` (130 px) of the selected sensor. It was removed on 2026-08-11
   because its premise was false and it made the gizmo unusable.* The premise was that
   `TransformControls` listens on the canvas. It does not: drei's `<View>` calls
   `setEvents({ connected: track.current })`, so `events.connected` — and therefore the
   controls' `domElement` — is the **ISO pane div**. Measured in the browser: the div at
   `980,431 620x382`, exactly the ISO rect. So the gizmo was already receiving pointers, and the
   gate's handover instead put the opaque canvas on top of the pane div. `elementFromPoint` over
   the gizmo returned `CANVAS` with the gate open and the pane `DIV` with it closed — the gate
   fired precisely when the cursor came near the sensor, which is precisely when it broke the
   thing it was meant to enable.

   `TransformControls` and the pane's orbit now share that div. `scene/gizmoHandle.ts` arbitrates:
   the controls set `axis` during their hover pass on the preceding pointermove, so reading it on
   pointerdown decides the winner without depending on listener registration order.

5. **The catalogue stores FOV values wider than `FOV_MAX` (179.4°) unclamped.** `parseCatalog` keeps
   what the datasheet says; `clampSpec` limits what the pyramid can draw. The editor shows the real
   figure with "drawn at 179.4°" beneath it. A rectangular pyramid with a flat far plane genuinely
   cannot represent a 190° lens — showing the engineer a number they never looked up is worse than
   admitting the limit.

6. **Dependencies are pinned to Vite 5 and Vitest 2.** The original machine runs Node 18. On
   Node 20+ the majors named in `05-build-plan.md` work as written; upgrade only deliberately.

7. **Pure modules exist that `02-architecture.md` does not list**, all tested: `core/viewport.ts`
   (the four-pane tiling, so acceptance test 10 covers the layout the app really uses),
   `core/snap.ts` (snap to the body) and `core/footprint.ts` (the body outline).

8. **`SensorFov` is memoised and disposes its geometry.** `updatePose` replaces only the sensor it
   touches, so untouched sensors skip the render. r3f only disposes objects it created itself, so
   the per-frame geometry handed to it as a prop is disposed by hand — without that, a long drag
   leaks one buffer set per frame. `GroundGrid` and `Vehicle` dispose theirs the same way.

9. **Wheel deltas go through `scene/wheel.ts` before they are used.** Chrome and Safari report
   pixels, Firefox reports lines. Reading `deltaY` raw made one Firefox notch about a thirtieth of
   a Chrome one, so zoom looked broken rather than slow.

10. **Blind sectors shade light grey at 0.42 opacity, not red at 0.16.** A gap is a finding, not a
    fault, and red read as an error the moment more than a sector or two was open. Grey needs the
    higher opacity — at 0.16 it is invisible over the near-white ground. The overlay is also hidden
    entirely when no sensor is visible: "every sector is blind" is true but useless, and it made the
    opening screen look like an error.

11. **The twelve sensor colours sit outside `PALETTE` deliberately.** They are data, not house
    colours, and a dozen have to stay tellable apart, which six brand colours cannot do.
    `store/__tests__/sensorColors.test.ts` pins the constraints: mutual distance as solids and in
    the 0.75 wireframe, visibility of the faintest 0.30 fill, 2.2:1 for the swatch dot, and that
    none of them reads as the blind-sector shading.

12. **The three body shapes are one geometry family** — a rectangle shrunk by `r` and swept by a
    disc of `r`, in `core/footprint.ts`. Because it is a Minkowski sum, the inside test, the sector
    exit radius and the snap all stay closed form, and each collapses to the old rectangle
    arithmetic exactly at `r = 0`. That is why every pre-existing geometry test still passes
    untouched. Rounding a corner genuinely removes it from the footprint, the blind gap and the
    body warning — the drawing and the numbers are never allowed to disagree.

13. **Dimension lines are an SVG overlay, not 3D text.** The numbers have to be Roboto Mono at a
    fixed size, and a text mesh would scale with the zoom and change face. The overlay projects
    through `orthoWorldToPane`, the same tested function the panes use, so it cannot drift from the
    drawing. It clips to its own pane and pulls a dimension back inside when a fitted view leaves no
    room, rather than spilling into the neighbour.

14. **User models live under their own localStorage key *and* are embedded in an exported layout.**
    `effectiveSpec` falls back to 90°×60° 10 m for an unknown spec id, silently. Without the models
    in the file, the same layout would draw different geometry on another machine with no warning.
    On import the local copy wins on an id clash, so re-opening an old export cannot revert a figure
    since corrected. Deleting a model freezes its numbers into the instances that used it rather
    than letting them fall through to the default.

15. **The merged FOV is a depth trick, not a mesh boolean.** `Display > Merge overlaps` draws every
    visible volume as one shape by recording the nearest surface in a depth-only pass and then
    letting only that surface paint. Four things about `scene/MergedFov.tsx` look wrong and are not:

    - The depth pass writes `DEPTH_BIAS` *behind* itself and the colour pass tests `less`, rather
      than testing equality. Equality is the obvious reading and it is wrong: a fragment on a
      shared triangle edge can be rasterised by either neighbour, and the two interpolate depth to
      values differing in the last bit, so the seam goes unpainted. On a triangle fan that draws
      every spoke as a ray from the apex — which is exactly what it did until the bias went in.

    - The depth pre-pass materials carry `transparent: true` even though `colorWrite` is `false`.
      That is not for blending — it is what puts the pre-pass and the colour pass in the same
      render list, so `renderOrder` decides their sequence. Left opaque, three runs every pre-pass
      before any colour pass and the depth references trample each other.
    - The far surface is drawn **before** the near one. A front face is always nearer, so the near
      pass overwrites the far pass's depth. Reversed, the far pass finds nothing to match.
    - It is two layers, not one. That is what a single FOV already looks like — its shell is drawn
      double-sided — so collapsing to one layer made a lone sensor change appearance the moment the
      merge was switched on, which is exactly what a merge must not do.

    Measured after the change: a lone sensor still differs only along the one-pixel silhouette
    seam, so the bias does not let a second layer through. Footprints are lifted by
    `FOOTPRINT_STEP` each so the nearest-surface test can tell coplanar
    ones apart; twenty sensors span 2 mm. Nothing about the geometry changes — this is shading
    only, and every range, area and coverage number is untouched.

16. **`SensorKind` is free text, not a closed union.** Ultrasonic and thermal are real sensors, and
    nothing geometric reads the field — it only ever labels.

---

## Verifying in the browser

Unit tests cover the maths and the store. For anything that only exists once React and the DOM are
running — gestures, layout arithmetic, persistence — this session used a temporary probe, and it
worked well enough to recommend:

1. Write `src/__probe.ts`, `import './__probe'` in `src/main.tsx`.
2. Drive the app from it and `console.log` the measurements.
3. Run headless Chrome with `--enable-logging=stderr --v=0` and grep the output.
4. **Delete the probe and the import** before committing.

```bash
google-chrome --headless=old --disable-gpu --use-angle=swiftshader \
  --enable-unsafe-swiftshader --hide-scrollbars --window-size=1600,900 \
  --virtual-time-budget=15000 --enable-logging=stderr --v=0 \
  --screenshot=out.png --user-data-dir=/tmp/chrome-fov http://localhost:5173/
```

Two traps that cost real time here, both recorded in `TEST-PLAN.md`:

- Synthetic `PointerEvent`s need `pointerType: 'mouse'`. three's `TransformControls` switches on it,
  so without it the gizmo never responds and it looks like an app bug.
- `dispatchEvent` bypasses hit-testing. "Which element receives the pointer" can only be answered
  with `document.elementFromPoint`.

**Known screenshot artifact:** the capture resizes the viewport after r3f has measured the canvas,
so the WebGL content sits about 87 px below where the CSS layout puts it. This is the harness, not
the app. For an aligned capture, temporarily pin the page height in `index.html` with
`<style>html, body, #root { height: 813px !important; }</style>`, then remove it.
`window.innerHeight` is 813 for `--window-size=…,900`.

---

## What is left

### Phase 5 — catalogue data (the only outstanding phase)

The mechanism is finished: autocomplete picker grouped by manufacturer, the inherit / override /
fully-custom paths, the `Unverified` chip, the datasheet link, and an `Add model` dialog for
user-defined types. What is missing is **data**.

`src/data/sensors.json` currently ships:

- Four `generic-*` entries. These are definitional rather than products, so they are verified by
  construction — leave them alone. They differ only in `kind`, HFOV, VFOV and range, and `kind`
  changes nothing but a line of text in the picker.
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

### Not yet verified by a person

The gestures were driven through a browser with synthetic events and measured, so they are no longer
untested — but **no human has used this with a real mouse**. Expect the drag feel to need tuning.

Two real gaps:

- **Firefox and Safari have never run it.** Headless Firefox would not start on the original
  machine. The three cross-browser fixes (wheel `deltaMode`, the number-field wheel steal, text
  selection on drag) were verified in Chrome and by unit test only. Safari's floor is 15 (WebGL2).
- **Performance was never measured on real GPU hardware.** `05-build-plan.md` asks for 20 sensors at
  60 fps. Memoisation and geometry disposal are in place; the measurement is not.

### Deliberately out of scope for v1

Do not build these: overlap analysis between sensors, body occlusion of the FOV, deriving FOV from
focal length and sensor size, accounts or server storage, a mobile layout, importing a vehicle mesh.

Undo/redo **was** on this list and has since been built, at the user's request on 2026-08-11. It
snapshots the vehicle and the sensors only, and coalesces a drag into a single step — see the
history section at the foot of `store/useStore.ts`.

Mesh import was considered on 2026-08-11 and dropped. If it comes back: glTF/GLB only, a cap far
below 100 MB, and the mesh must read as reference-only — the maths would still use the box, so a
realistic body would imply an occlusion model that does not exist.

---

## Manual test checklist

Desktop only, minimum 1280 px wide. The app opens with an empty layout; `SENSORS` starts collapsed,
so open it and click `Add sensor`.

**Viewports**

1. Drag empty space in any pane. The world should stay glued to the cursor at any zoom, in every
   pane, with no drift. Middle-drag pans too, in every pane — in ISO it pans rather than orbits,
   and over a sensor marker it pans rather than grabbing. Chrome's autoscroll widget must never
   appear.
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
   exactly 4 m × 4 m against the 1 m grid — leave `Display > Cell size` at its 1 m default for this
   check, or the squares you are counting are not metres. If it does not, stop and fix the maths
   before anything else.

**Vehicle**

8. Switch `Shape` between Box, Rounded and Cylinder. The body redraws, and the blind-sector shading
   in TOP follows the outline — a cylinder gives a circular ring, not a rectangular one. Only the
   vertical edges round; the roof stays flat.
9. With Rounded selected, raise `Corner radius` past half the shorter side. The field warns and the
   geometry clamps.
10. Turn `Dimensions` on. Each orthographic pane shows the figures it can measure. Zoom out far —
    dimensions disappear rather than colliding, and none ever draws over a neighbouring pane.
11. Turn `Vehicle` off. The body and wheels go, the sensors stay, and the `Wheels` toggle greys out.

**Merging**

11a. Point three overlapping sensors forward. With `Merge overlaps` off, the overlaps read darker
     and each fan keeps its colour. Turn it on: one shape, one colour, no darker wedges, and the
     outer extent is unchanged — every sensor still reaches exactly as far as it did. `Wireframe
     edges` greys out, since the silhouette is what the merge exists to hide.
11b. Hide all but one sensor. Merged and unmerged must look the same: a merge that changes a lone
     sensor is drawing something other than that sensor.
11c. Markers stay their own colour and stay on top of the merged fill — the field of view merges,
     the sensors stay identifiable.

**Editing**

12. Every position, orientation and FOV field writes through to all four views live.
13. Angle labels carry their sign convention — `Yaw (+ left)`, `Pitch (+ up)`, `Roll (+ CW)`. Check
    the signs actually behave that way: positive yaw should turn the FOV towards the vehicle's left.
14. Pick a catalogue model: HFOV, VFOV and range grey out as inherited. Override one — the other two
    stay grey, an `Overridden` chip appears, and clearing the chip restores inheritance.
    `Customise` cuts the link and freezes the current numbers into the instance.
15. Pick the ISX031 190° lens: the field shows `190` with `drawn at 179.4°` beneath it, and an
    `Unverified` warning chip appears.
16. `Add model`: define a type with a free-text kind. It appears in the Model list, is selected for
    the current sensor, and survives a reload. `Delete model` returns the sensor to custom with the
    same numbers, not to 90°×60° 10 m.
17. Collapse the `SENSORS` section and reopen it. Every row must be closed, whatever was being
    edited before, and the selection must survive — `Duplicate` and the gizmo still act on the same
    sensor. Picking a sensor in a viewport still opens its row.
18. Add, duplicate and delete. A duplicate lands directly below its source with a fresh id, and
    `Drag` returns to `Off` for every new sensor.
19. The readout shows footprint area, X and Y extents and the blind gap. Move a sensor inside the
    vehicle body — the occlusion warning should appear.

**Dragging**

`Drag` gates every drag, in every pane. With it `Off` a sensor cannot be moved at all: dragging its
marker pans the view instead. This is deliberate — placing a sensor is always a deliberate act, so
nothing shifts under a stray drag while the layout is being read.

19. With `Drag` set to `Off`, press on a sensor marker in TOP and drag. The pane must pan and the
    sensor must not move. Set `Drag` to `Move`: now the cursor becomes a grab hand over the marker
    and the X and Y fields track the drag live.
20. Drag a sensor to within 15 cm of the vehicle body. It should stick to the surface and swing its
    optical axis to point out of that face. On a rounded or cylindrical body it must land on the
    curve, not on a square corner. Hold `Alt` while dragging — no snap.
21. Select a sensor, set `Drag` to `Move`. The gizmo appears at the marker in the ISO pane.
    Dragging an axis writes to the position fields live, and the camera must not orbit at the same
    time. Away from the gizmo, orbit still works.
22. Switch to `Rotate`. Dragging a ring writes to yaw, pitch and roll. TOP dragging is off in this
    mode. Rotate to point straight down and confirm the numbers stay sane.

**Report and persistence**

23. Place four surround cameras. The `Coverage` panel gives a covered-azimuth percentage and lists
    the gaps with a bearing in words. Gaps shade light grey on the ground in TOP.
24. The report must not recompute during a drag — it settles 150 ms after you let go. The spinner in
    the panel header shows while the answer on screen is stale.
25. Remove a front sensor: the forward sectors must appear in the report.
26. `Export`, then `Import` in a fresh tab. The layout must come back identically, including any
    user-defined models its sensors use. Import a deliberately malformed JSON file — you should get
    a readable error, not a broken app.
27. Edit the vehicle dimensions, reload the page: they persist. So do user models, which live under
    their own key and survive `Reset`, `Import` and undo.
28. `Reset` asks first, then clears every sensor and refits the four views. `Ctrl+Z` brings them
    back.

**Keyboard**

29. `+` / `-` zoom, `F` fits all, `Esc` leaves drag mode and then clears the selection.
30. `Delete` (or `Backspace`) removes the selected sensor while a drag mode is on, asking first
    until "Don't ask again" is ticked. `Display > Ask before deleting a sensor` turns the prompt
    back on — it is the only way back.
31. `Ctrl+Z` / `Ctrl+Y` undo and redo. A whole drag is one step.
32. Click into a number field and type `-6`. The views must not zoom out — keystrokes are ignored
    while a text field has focus, and `Ctrl+Z` there undoes the typing, not the layout.
33. Scroll the sidebar with the cursor over a focused number field. The value must not change.

**Performance**

34. Add twenty sensors and drag one. It should hold 60 fps with all four panes visible.

---

## How to work on this

One change at a time, to a working state, then commit. Small commits, conventional messages
(`feat(core): exact ground polygon`, `fix(ui): top view drag axis`). Never change a function in
`core/` without running `npm test`. Ask when a document is silent — especially about coordinate
conventions or the sign of a rotation.

Measure rather than assume. Several things this session looked obviously true and were not: the
pointer gate's premise, where a dimension label lands, whether a commit staged what it claimed.
The browser probe above turns most of those questions into one number.

State per browser, not in the repo: `sensor-fov.layout.v1`, `sensor-fov.models.v1` and
`sensor-fov.prefs.v1`. A fresh machine starts empty — move work across with `Export` / `Import`.
