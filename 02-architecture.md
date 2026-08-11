# 02 — Architecture and data model

## Folder layout

```
src/
  core/            pure TS — no React, no Three.js, no DOM
    types.ts       domain types
    rotation.ts    rotation matrix, vector maths
    frustum.ts     FOV pyramid corners
    ground.ts      exact ground polygon, area, extents, blind gap
    coverage.ts    blind spot sector report
    catalog.ts     spec lookup and resolution
    __tests__/     Vitest suites — the acceptance tests live here

  store/
    useStore.ts    Zustand store, single source of truth
    persist.ts     localStorage autosave, JSON import/export

  scene/           React Three Fiber components
    Stage.tsx      canvas + the four <View> panes
    views.ts       camera definitions for TOP/FRONT/LEFT/ISO
    Vehicle.tsx
    SensorFov.tsx  one sensor: volume, edges, axis, ground polygon, marker
    Gizmo.tsx      TransformControls wiring
    TopDrag.tsx    2D drag handling in the TOP view

  ui/
    Sidebar.tsx
    VehiclePanel.tsx
    SensorList.tsx
    SensorEditor.tsx
    CatalogPicker.tsx
    DisplayPanel.tsx
    ZoomControls.tsx
    CoverageReport.tsx

  data/
    sensors.json   the catalogue

  theme.ts
  App.tsx
```

## Dependency rules

```
core  ←  store  ←  scene
                ←  ui
```

- `core` imports nothing from the project. It is portable and testable in isolation.
- `store` imports `core`. It holds state and calls core functions.
- `scene` and `ui` import `store` and `core`. They never talk to each other directly — they
  communicate through the store.

If a piece of maths ends up inside a React component, it is in the wrong place.

## Domain model

```ts
// core/types.ts

export type Vec3 = [number, number, number];

export interface Vehicle {
  length: number;      // along +X, m
  width: number;       // along +Y, m
  height: number;      // along +Z, m
  clearance: number;   // ground to underside of the box, m
  wheelbase: number;   // m
  wheelRadius: number; // m
  shape: 'box' | 'rounded' | 'cylinder';
  cornerRadius: number; // plan-view corner radius, m; read only when shape is 'rounded'
}

export type SensorKind = 'camera' | 'lidar' | 'radar';

/** What a sensor IS. Independent of where it is mounted. */
export interface SensorSpec {
  id: string;              // 'ouster-os1-64'
  kind: SensorKind;
  manufacturer: string;
  model: string;
  hfov: number;            // degrees
  vfov: number;            // degrees
  range: number;           // metres
  resolution?: { h: number; v: number }; // pixels or beams
  datasheetUrl?: string;
  verified: boolean;       // false until checked against the datasheet
}

export interface Pose {
  x: number; y: number; z: number;    // metres, ISO 8855
  yaw: number; pitch: number; roll: number; // degrees
}

/** A sensor MOUNTED on the vehicle. */
export interface SensorInstance {
  id: string;
  name: string;            // user-editable label, e.g. 'FRONT LEFT CORNER'
  specId: string | null;   // null = fully custom
  custom?: Pick<SensorSpec, 'hfov' | 'vfov' | 'range'>; // used when specId is null
  override?: Partial<Pick<SensorSpec, 'hfov' | 'vfov' | 'range'>>; // tweaks on a catalogue spec
  color: string;           // hex
  visible: boolean;
  pose: Pose;
}

export interface Layout {
  version: 1;
  vehicle: Vehicle;
  sensors: SensorInstance[];
}
```

**Why spec and instance are separate:** the same camera model gets mounted in six places. When a
catalogue spec is corrected, every instance using it must update. Never copy FOV values into the
instance at add time.

Resolution order for the effective FOV of an instance:

```ts
export function effectiveSpec(inst: SensorInstance, catalog: SensorSpec[]) {
  const base = inst.specId ? catalog.find(s => s.id === inst.specId) : undefined;
  const src = base ?? { hfov: 90, vfov: 60, range: 10 };
  return {
    hfov: inst.override?.hfov ?? inst.custom?.hfov ?? src.hfov,
    vfov: inst.override?.vfov ?? inst.custom?.vfov ?? src.vfov,
    range: inst.override?.range ?? inst.custom?.range ?? src.range,
  };
}
```

## Store

Single Zustand store. Keep it flat and boring.

```ts
interface AppState {
  vehicle: Vehicle;
  sensors: SensorInstance[];
  catalog: SensorSpec[];
  selectedId: string | null;

  display: {
    volume: boolean;
    edges: boolean;
    ground: boolean;
    axis: boolean;
    opacity: number;   // 0.05 – 0.70
    grid: boolean;
    wheels: boolean;
  };

  linkZoom: boolean;
  dragMode: 'off' | 'translate' | 'rotate';

  setVehicle(patch: Partial<Vehicle>): void;
  addSensor(specId?: string): void;
  updateSensor(id: string, patch: Partial<SensorInstance>): void;
  updatePose(id: string, patch: Partial<Pose>): void;   // hot path — called during drag
  duplicateSensor(id: string): void;
  removeSensor(id: string): void;
  select(id: string | null): void;
  importLayout(l: Layout): void;
}
```

`updatePose` fires on every pointer move during a drag. Keep it cheap: mutate only the one
sensor, and let derived geometry recompute in the component that needs it. Do not recompute the
blind spot report on every frame — debounce it to ~150 ms.

## JSON format

Export and import use the `Layout` shape verbatim, with `version: 1`. On import, validate the
version, clamp values to legal ranges, regenerate all `id` fields, and drop unknown keys.
