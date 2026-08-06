/**
 * Single source of truth. Flat and boring on purpose.
 *
 * `updatePose` runs on every pointer move during a drag, so it touches exactly one sensor and
 * derives nothing. Anything expensive — the blind spot report above all — is derived by the
 * component that needs it, debounced.
 */

import { create } from 'zustand';
import { effectiveSpec, parseCatalog } from '../core/catalog';
import { blindSpotReport, type BlindSpotReport } from '../core/coverage';
import { frustum } from '../core/frustum';
import { groundPolygon } from '../core/ground';
import { clamp } from '../core/rotation';
import type { Layout, Pose, SensorInstance, SensorSpec, Vec2, Vec3, Vehicle } from '../core/types';
import { VIEW_NAMES, type ViewName } from '../core/viewport';
import catalogJson from '../data/sensors.json';
import { DEFAULT_VEHICLE, loadLayout, newId, saveLayout } from './persist';

export interface DisplayOptions {
  volume: boolean;
  edges: boolean;
  ground: boolean;
  axis: boolean;
  opacity: number; // 0.05 - 0.70
  grid: boolean;
  wheels: boolean;
  /** Shade uncovered azimuth sectors on the ground, in the TOP pane only. */
  blindSectors: boolean;
}

export type DragMode = 'off' | 'translate' | 'rotate';

/**
 * Camera state per pane. `zoom` is pixels per metre, which makes a pointer drag map to world
 * metres by a single division and keeps the drag glued to the cursor. `pan` is the world
 * position of the pane centre, expressed along that pane's screen-right and screen-up axes.
 */
export interface OrthoViewState {
  zoom: number;
  pan: [number, number];
}

export interface IsoViewState {
  azimuth: number; // degrees about +Z
  elevation: number; // degrees, clamped to ±83
  distance: number; // metres from the target
  target: Vec3;
}

export interface ViewsState {
  TOP: OrthoViewState;
  FRONT: OrthoViewState;
  LEFT: OrthoViewState;
  ISO: IsoViewState;
}

export const ZOOM_LIMITS: [number, number] = [1, 4000]; // pixels per metre
export const ISO_DISTANCE_LIMITS: [number, number] = [0.8, 600];
export const ELEVATION_LIMIT = 83;

export const DEFAULT_VIEWS: ViewsState = {
  TOP: { zoom: 60, pan: [0, 0] },
  FRONT: { zoom: 60, pan: [0, 0] },
  LEFT: { zoom: 60, pan: [0, 0] },
  ISO: { azimuth: 35, elevation: 24, distance: 14, target: [0, 0, 0.8] },
};

export interface AppState {
  vehicle: Vehicle;
  sensors: SensorInstance[];
  catalog: SensorSpec[];
  selectedId: string | null;

  display: DisplayOptions;
  linkZoom: boolean;
  dragMode: DragMode;

  /**
   * The blind spot report, recomputed on a debounce rather than on every change. Derived
   * state rather than an action, because both the sidebar panel and the TOP overlay read it
   * and neither should pay for it twice.
   */
  blindReport: BlindSpotReport | null;
  blindReportStale: boolean;

  views: ViewsState;
  /** True while the ISO gizmo owns the pointer, so the pane must not also orbit. */
  gizmoDragging: boolean;
  /** Bumped to ask the stage — which is the only thing that knows the pane sizes — to refit. */
  fitNonce: number;

  setVehicle(patch: Partial<Vehicle>): void;
  addSensor(specId?: string): string;
  updateSensor(id: string, patch: Partial<SensorInstance>): void;
  updatePose(id: string, patch: Partial<Pose>): void;
  duplicateSensor(id: string): void;
  removeSensor(id: string): void;
  select(id: string | null): void;
  importLayout(l: Layout): void;
  setDisplay(patch: Partial<DisplayOptions>): void;
  setLinkZoom(on: boolean): void;
  setDragMode(mode: DragMode): void;
  setGizmoDragging(on: boolean): void;

  /** `origin` names the pane the gesture started in; linked zoom fans it out to the rest. */
  zoomBy(factor: number, origin?: ViewName): void;
  setOrthoView(name: 'TOP' | 'FRONT' | 'LEFT', patch: Partial<OrthoViewState>): void;
  setIsoView(patch: Partial<IsoViewState>): void;
  setViews(views: ViewsState): void;
  requestFit(): void;
}

export const DEFAULT_DISPLAY: DisplayOptions = {
  volume: true,
  edges: true,
  ground: true,
  axis: true,
  opacity: 0.3,
  grid: true,
  wheels: true,
  blindSectors: true,
};

/** Distinct at a glance against the violet UI and against each other. */
export const SENSOR_COLORS = [
  '#6750A4',
  '#B3261E',
  '#00696E',
  '#8C5000',
  '#0061A4',
  '#3F6B2B',
  '#7D5260',
  '#5B5891',
];

export const catalog = parseCatalog(catalogJson);

const restored = typeof localStorage === 'undefined' ? null : loadLayout();


function nextColor(sensors: SensorInstance[]): string {
  return SENSOR_COLORS[sensors.length % SENSOR_COLORS.length];
}

function nextName(sensors: SensorInstance[]): string {
  return `SENSOR ${sensors.length + 1}`;
}

/**
 * New sensors land just clear of the front bumper, on the centreline, looking forward.
 * `SURFACE_OFFSET` keeps them off the box face so a fresh sensor does not open with the
 * occlusion warning already showing.
 */
const SURFACE_OFFSET = 0.02;

function defaultPose(vehicle: Vehicle): Pose {
  return {
    x: Number((vehicle.length / 2 + SURFACE_OFFSET).toFixed(3)),
    y: 0,
    z: Number((vehicle.clearance + 0.4).toFixed(3)),
    yaw: 0,
    pitch: 0,
    roll: 0,
  };
}

export const useStore = create<AppState>()((set, get) => ({
  vehicle: restored?.vehicle ?? DEFAULT_VEHICLE,
  sensors: restored?.sensors ?? [],
  catalog,
  selectedId: restored?.sensors?.[0]?.id ?? null,

  display: DEFAULT_DISPLAY,
  linkZoom: true,
  dragMode: 'off',
  blindReport: null,
  blindReportStale: true,
  views: DEFAULT_VIEWS,
  gizmoDragging: false,
  fitNonce: 0,

  setVehicle(patch) {
    set((s) => ({ vehicle: { ...s.vehicle, ...patch } }));
  },

  addSensor(specId) {
    const { sensors, vehicle } = get();
    const inst: SensorInstance = {
      id: newId(),
      name: nextName(sensors),
      specId: specId ?? null,
      color: nextColor(sensors),
      visible: true,
      pose: defaultPose(vehicle),
    };
    if (!specId) inst.custom = { hfov: 90, vfov: 60, range: 10 };
    set({ sensors: [...sensors, inst], selectedId: inst.id });
    return inst.id;
  },

  updateSensor(id, patch) {
    set((s) => ({
      sensors: s.sensors.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  },

  updatePose(id, patch) {
    set((s) => {
      const i = s.sensors.findIndex((x) => x.id === id);
      if (i < 0) return s;
      const next = s.sensors.slice();
      next[i] = { ...next[i], pose: { ...next[i].pose, ...patch } };
      return { sensors: next };
    });
  },

  duplicateSensor(id) {
    const { sensors } = get();
    const src = sensors.find((x) => x.id === id);
    if (!src) return;
    const copy: SensorInstance = {
      ...src,
      id: newId(),
      name: `${src.name} COPY`,
      pose: { ...src.pose },
      custom: src.custom ? { ...src.custom } : undefined,
      override: src.override ? { ...src.override } : undefined,
    };
    const at = sensors.indexOf(src) + 1;
    const next = sensors.slice();
    next.splice(at, 0, copy);
    set({ sensors: next, selectedId: copy.id });
  },

  removeSensor(id) {
    set((s) => {
      const sensors = s.sensors.filter((x) => x.id !== id);
      return {
        sensors,
        selectedId: s.selectedId === id ? (sensors[0]?.id ?? null) : s.selectedId,
      };
    });
  },

  select(id) {
    set({ selectedId: id });
  },

  importLayout(l) {
    set({ vehicle: l.vehicle, sensors: l.sensors, selectedId: l.sensors[0]?.id ?? null });
  },

  setDisplay(patch) {
    set((s) => ({ display: { ...s.display, ...patch } }));
  },

  setLinkZoom(on) {
    set({ linkZoom: on });
  },

  setDragMode(mode) {
    set({ dragMode: mode, gizmoDragging: mode === 'off' ? false : get().gizmoDragging });
  },

  setGizmoDragging(on) {
    set({ gizmoDragging: on });
  },

  zoomBy(factor, origin) {
    set((s) => {
      const targets: ViewName[] =
        origin === undefined || s.linkZoom ? VIEW_NAMES : [origin];
      const views = { ...s.views };
      for (const name of targets) {
        if (name === 'ISO') {
          views.ISO = {
            ...views.ISO,
            distance: clamp(views.ISO.distance / factor, ...ISO_DISTANCE_LIMITS),
          };
        } else {
          views[name] = { ...views[name], zoom: clamp(views[name].zoom * factor, ...ZOOM_LIMITS) };
        }
      }
      return { views };
    });
  },

  setOrthoView(name, patch) {
    set((s) => ({ views: { ...s.views, [name]: { ...s.views[name], ...patch } } }));
  },

  setIsoView(patch) {
    set((s) => {
      const next = { ...s.views.ISO, ...patch };
      next.elevation = clamp(next.elevation, -ELEVATION_LIMIT, ELEVATION_LIMIT);
      next.distance = clamp(next.distance, ...ISO_DISTANCE_LIMITS);
      return { views: { ...s.views, ISO: next } };
    });
  },

  setViews(views) {
    set({ views });
  },

  requestFit() {
    set((s) => ({ fitNonce: s.fitNonce + 1 }));
  },
}));

/** The exportable slice of the state. */
export function currentLayout(state: AppState = useStore.getState()): Layout {
  return { version: 1, vehicle: state.vehicle, sensors: state.sensors };
}

/* --------------------------------------------------------------- blind spot report */

/**
 * 72 sectors against every ground polygon is far too much to run inside a drag, so this settles
 * 150 ms after the last change. One subscription for the whole app: every reader takes the same
 * result out of the store.
 */
export const REPORT_DEBOUNCE_MS = 150;
let reportTimer: ReturnType<typeof setTimeout> | undefined;

function recomputeBlindReport(state: AppState) {
  const polygons: Vec2[][] = [];
  for (const sensor of state.sensors) {
    if (!sensor.visible) continue;
    const poly = groundPolygon(frustum(sensor.pose, effectiveSpec(sensor, state.catalog)));
    if (poly) polygons.push(poly);
  }
  useStore.setState({
    blindReport: blindSpotReport(polygons, state.vehicle),
    blindReportStale: false,
  });
}

function scheduleBlindReport(state: AppState) {
  clearTimeout(reportTimer);
  if (!state.blindReportStale) useStore.setState({ blindReportStale: true });
  reportTimer = setTimeout(() => recomputeBlindReport(useStore.getState()), REPORT_DEBOUNCE_MS);
}

useStore.subscribe((state, prev) => {
  if (state.vehicle === prev.vehicle && state.sensors === prev.sensors) return;
  scheduleBlindReport(state);
});

scheduleBlindReport(useStore.getState());

/* -------------------------------------------------------------------------- autosave */

const AUTOSAVE_MS = 300;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

if (typeof localStorage !== 'undefined') {
  useStore.subscribe((state, prev) => {
    if (state.vehicle === prev.vehicle && state.sensors === prev.sensors) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveLayout(currentLayout(state)), AUTOSAVE_MS);
  });
}
