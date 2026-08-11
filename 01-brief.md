# 01 — Brief

## What this is

A browser tool for automotive hardware engineers who lay out cameras, lidars and radars on a
vehicle. The user enters vehicle dimensions, places sensors on the vehicle, and immediately sees
the field of view of each sensor in 3D and its coverage footprint on the ground.

The user is an engineer. Precision beats polish. Every number is editable and every number is
shown.

## Core loop

1. Enter vehicle dimensions.
2. Add a sensor — either pick a model from the catalogue or enter a custom FOV.
3. Position it: type exact coordinates, or drag it in the 3D view.
4. See the FOV volume and ground coverage update live.
5. Repeat until the coverage around the vehicle is acceptable.
6. Export the layout as JSON.

## Stack

- **React 18 + TypeScript + Vite**
- **@react-three/fiber** + **@react-three/drei** for 3D. `<View>` gives the four viewports,
  `<TransformControls>` gives the drag gizmo.
- **Zustand** for state.
- **MUI v6** for controls, light theme, blue primary `#1E79D3`. Full palette in `04-ui.md`.
- **Vitest** for the core maths tests.

No server. Everything runs client-side. State persists to `localStorage`.

## Deployment

Static SPA. Build with Vite, deploy to Vercel or Cloudflare Pages, mount at
`/tools/fov-layout` on the existing site or on a subdomain. The core logic stays free of any
site-specific code so the tool can be split out later without a rewrite.

## In scope for v1

- Vehicle box with wheels, ground grid, ISO 8855 coordinate frame
- Sensor instances with position, orientation, HFOV, VFOV, range
- Sensor catalogue with a handful of seeded models, plus fully custom sensors
- Four synchronised viewports: TOP, FRONT, LEFT, ISO
- Linked zoom across viewports, per-view pan
- Drag to reposition a sensor in the ISO view (gizmo) and in the TOP view (2D)
- Exact ground coverage polygon per sensor, with area, extents and blind gap readout
- Blind spot report: azimuth sectors around the vehicle with no coverage within 5 m
- JSON export and import, autosave to localStorage
- Undo and redo over the layout, with a drag counting as one step

## Out of scope for v1

Deliberately deferred. Do not build these.

- Overlap analysis between sensors
- Vehicle body occlusion of the FOV (v1 only warns when a sensor sits inside the body)
- Deriving FOV from focal length and sensor size — **the user always enters FOV directly**
- Accounts, sharing, server-side storage
- Mobile layout — desktop only, minimum 1280px wide
*Undo/redo was on this list and has since been built, at the user's request on 2026-08-11. It
covers the vehicle and the sensors; cameras and display options stay outside it.*

## Timeline

13–20 working days. See `05-build-plan.md`.
