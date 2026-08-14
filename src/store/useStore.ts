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
import type {
  Layout,
  Pose,
  RangeMode,
  SensorInstance,
  SensorSpec,
  Vec2,
  Vec3,
  Vehicle,
} from '../core/types';
import { VIEW_NAMES, type ViewName } from '../core/viewport';
import catalogJson from '../data/sensors.json';
import {
  DEFAULT_PREFS,
  DEFAULT_VEHICLE,
  loadLayout,
  loadModels,
  DEFAULT_RANGE_MODE,
  loadPrefs,
  newId,
  savePrefs,
  saveLayout,
  saveModels,
} from './persist';

export interface DisplayOptions {
  volume: boolean;
  edges: boolean;
  axis: boolean;
  /**
   * Whether the part of the FOV under the ground plane is drawn. Off by default: a downward
   * sensor's volume carries on below z = 0, which is geometrically true and visually noise in
   * FRONT, LEFT and ISO.
   */
  belowGround: boolean;
  opacity: number; // 0.05 - 0.70
  grid: boolean;
  /** Spacing of the fine grid lines, in metres. */
  gridSize: number;
  /** The vehicle body itself. Off leaves the sensors and their volumes on their own. */
  vehicle: boolean;
  wheels: boolean;
  /** Dimension lines over the three orthographic panes. */
  dimensions: boolean;
  /** Shade uncovered azimuth sectors on the ground, in the TOP pane only. */
  blindSectors: boolean;
  /**
   * Draw every visible FOV as one volume in one colour, so overlaps stop compounding and the
   * coverage reads as a single shape. Purely a shading change — each sensor keeps its own pose,
   * angles and range, and the merged draw covers exactly the space the separate draws did.
   */
  mergeFovs: boolean;
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
  /** Built-ins plus `userModels`. What the picker lists and `effectiveSpec` resolves against. */
  catalog: SensorSpec[];
  /** Models this person defined. Persisted separately and written into an exported layout. */
  userModels: SensorSpec[];
  selectedId: string | null;

  /**
   * Where `range` is measured to. Part of the layout rather than the display options: it changes
   * the footprint, the blind gap and the coverage percentage, so a file has to carry it.
   */
  rangeMode: RangeMode;

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
  /** The pane filling the whole viewport area, or null for the usual four-up tiling. */
  maximizedView: ViewName | null;

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
  /** Drops every sensor. The vehicle and the display options are left alone. */
  clearSensors(): void;
  select(id: string | null): void;
  importLayout(l: Layout): void;

  /**
   * Defines a new model and returns its id. This is the catalogue, not the layout — it adds a
   * sensor *type*, where `addSensor` mounts one on the vehicle.
   */
  addModel(draft: Omit<SensorSpec, 'id'>): string;
  removeModel(id: string): void;

  /** True while the delete prompt is open, naming the sensor it is asking about. */
  pendingDeleteId: string | null;
  /** Cleared for good once the engineer ticks "don't ask again". Persisted per person. */
  askBeforeDelete: boolean;
  /** Opens the prompt, or deletes outright if the prompt has been turned off. */
  requestDeleteSensor(id: string): void;
  confirmPendingDelete(dontAskAgain: boolean): void;
  cancelPendingDelete(): void;
  setAskBeforeDelete(on: boolean): void;

  /** Layout history. Covers the vehicle and the sensors — not the cameras or display options. */
  canUndo: boolean;
  canRedo: boolean;
  undo(): void;
  redo(): void;
  setRangeMode(mode: RangeMode): void;
  setDisplay(patch: Partial<DisplayOptions>): void;
  setLinkZoom(on: boolean): void;
  setDragMode(mode: DragMode): void;
  setGizmoDragging(on: boolean): void;

  /** `origin` names the pane the gesture started in; linked zoom fans it out to the rest. */
  zoomBy(factor: number, origin?: ViewName): void;
  setOrthoView(name: 'TOP' | 'FRONT' | 'LEFT', patch: Partial<OrthoViewState>): void;
  setIsoView(patch: Partial<IsoViewState>): void;
  setViews(views: ViewsState): void;
  toggleMaximized(name: ViewName): void;
  restoreLayout(): void;
  requestFit(): void;
}

export const DEFAULT_DISPLAY: DisplayOptions = {
  volume: true,
  edges: true,
  axis: false,
  belowGround: true,
  opacity: 0.3,
  grid: true,
  gridSize: 1,
  vehicle: true,
  wheels: true,
  dimensions: false,
  blindSectors: true,
  mergeFovs: false,
};

/** Grid spacing bounds, in metres. */
export const GRID_SIZE_LIMITS: readonly [number, number] = [0.01, 10];

/**
 * Twelve soft hues, one per sensor before the list wraps.
 *
 * Data colours, not house colours: they stay outside `PALETTE` because a dozen of them have to
 * stay tellable apart, which six brand colours cannot do. They are pastel rather than saturated
 * because a layout with eight overlapping volumes is easier to read in soft colour — but not
 * lighter than that, for three reasons the suite pins:
 *
 * - the sidebar swatch is a small dot on white and disappears below about 2.2:1;
 * - two sensors must stay apart in the wireframe, which draws at 0.75 opacity;
 * - none of them may read as the blind-sector red, or an uncovered sector looks like coverage.
 *
 * The volume fill at 0.30 is the one layer where they nearly converge; that is fine, since the
 * axis, the ground outline and the marker all draw opaque and carry the identity.
 */
export const SENSOR_COLORS = [
  '#E8827C', // coral
  '#E89A57', // apricot
  '#C9A63F', // gold
  '#93B14B', // olive
  '#5FAF6B', // green
  '#4FBBA0', // seafoam
  '#4FA3B5', // teal
  '#76ADE0', // sky
  '#5C7FD0', // blue
  '#A38ADE', // lilac
  '#BE6FC0', // orchid
  '#E58AAE', // rose
];

/** Ships with the app. Read-only: growing it needs a datasheet and a commit. */
export const builtInCatalog = parseCatalog(catalogJson);

const restored = typeof localStorage === 'undefined' ? null : loadLayout();
const restoredModels = typeof localStorage === 'undefined' ? [] : loadModels();

/**
 * Built-ins first, then the person's own models, so the picker lists the shipped entries above
 * anything hand-made and `parseCatalog`'s order carries through to the grouped dropdown.
 */
function mergeCatalog(models: SensorSpec[]): SensorSpec[] {
  return [...builtInCatalog, ...models];
}

/** A model id that cannot collide with a built-in or with another session's. */
function newModelId(): string {
  return `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Adds models the library does not already know. The local copy wins on an id clash: a spec the
 * person has since corrected must not be reverted by re-importing an older file.
 */
function withModels(existing: SensorSpec[], incoming: SensorSpec[]): SensorSpec[] {
  const known = new Set(existing.map((m) => m.id));
  const added = incoming.filter((m) => !known.has(m.id) && !builtInCatalog.some((b) => b.id === m.id));
  return added.length === 0 ? existing : [...existing, ...added];
}

/** The autosaved layout carries the models it referenced, so boot folds them back in. */
const initialModels = withModels(restoredModels, restored?.models ?? []);


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
  catalog: mergeCatalog(initialModels),
  userModels: initialModels,
  selectedId: restored?.sensors?.[0]?.id ?? null,
  rangeMode: restored?.rangeMode ?? DEFAULT_RANGE_MODE,

  display: DEFAULT_DISPLAY,
  linkZoom: true,
  dragMode: 'off',
  blindReport: null,
  blindReportStale: true,
  views: DEFAULT_VIEWS,
  maximizedView: null,
  gizmoDragging: false,
  fitNonce: 0,
  pendingDeleteId: null,
  askBeforeDelete: typeof localStorage === 'undefined' ? DEFAULT_PREFS.askBeforeDelete : loadPrefs().askBeforeDelete,
  canUndo: false,
  canRedo: false,

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
    // A fresh custom sensor starts at a 50 m range — a sensible default the user then tunes.
    if (!specId) inst.custom = { hfov: 90, vfov: 60, range: 50 };
    // A sensor that did not exist a moment ago arrives locked. Drag mode is global and sticky,
    // so without this the new sensor inherits whatever the last one was left in and the first
    // stray drag moves it.
    set({ sensors: [...sensors, inst], selectedId: inst.id, dragMode: 'off', gizmoDragging: false });
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
    // Same reasoning as addSensor: a duplicate is a new sensor and arrives locked.
    set({ sensors: next, selectedId: copy.id, dragMode: 'off', gizmoDragging: false });
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

  clearSensors() {
    set({ sensors: [], selectedId: null, gizmoDragging: false, pendingDeleteId: null });
  },

  requestDeleteSensor(id) {
    if (!get().sensors.some((x) => x.id === id)) return;
    if (get().askBeforeDelete) {
      set({ pendingDeleteId: id });
      return;
    }
    get().removeSensor(id);
  },

  confirmPendingDelete(dontAskAgain) {
    const id = get().pendingDeleteId;
    if (dontAskAgain) {
      set({ askBeforeDelete: false });
      savePrefs({ askBeforeDelete: false });
    }
    set({ pendingDeleteId: null });
    if (id) get().removeSensor(id);
  },

  cancelPendingDelete() {
    set({ pendingDeleteId: null });
  },

  setAskBeforeDelete(on) {
    set({ askBeforeDelete: on });
    savePrefs({ askBeforeDelete: on });
  },

  // Declared below, next to the history they act on.
  undo() {
    historyUndo();
  },

  redo() {
    historyRedo();
  },

  select(id) {
    set({ selectedId: id });
  },

  importLayout(l) {
    // The file's models join the library first, or its sensors would resolve to the default FOV.
    const userModels = withModels(get().userModels, l.models ?? []);
    set({
      vehicle: l.vehicle,
      sensors: l.sensors,
      selectedId: l.sensors[0]?.id ?? null,
      rangeMode: l.rangeMode ?? DEFAULT_RANGE_MODE,
      userModels,
      catalog: mergeCatalog(userModels),
    });
  },

  addModel(draft) {
    const spec: SensorSpec = { ...draft, id: newModelId() };
    const userModels = [...get().userModels, spec];
    set({ userModels, catalog: mergeCatalog(userModels) });
    return spec.id;
  },

  removeModel(id) {
    const userModels = get().userModels.filter((m) => m.id !== id);
    set({
      userModels,
      catalog: mergeCatalog(userModels),
      // Instances keep pointing at a model that is gone, which would silently resolve to the
      // default FOV. Freeze the numbers they were drawing into each one instead.
      sensors: get().sensors.map((s) =>
        s.specId === id
          ? { ...s, specId: null, custom: effectiveSpec(s, get().catalog), override: undefined }
          : s,
      ),
    });
  },

  setRangeMode(mode) {
    set({ rangeMode: mode });
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

  toggleMaximized(name) {
    set((s) => ({ maximizedView: s.maximizedView === name ? null : name }));
  },

  restoreLayout() {
    set({ maximizedView: null });
  },

  requestFit() {
    set((s) => ({ fitNonce: s.fitNonce + 1 }));
  },
}));

/** The exportable slice of the state. */
export function currentLayout(state: AppState = useStore.getState()): Layout {
  const layout: Layout = {
    version: 1,
    vehicle: state.vehicle,
    sensors: state.sensors,
    rangeMode: state.rangeMode,
  };

  // Only the hand-made models these sensors actually use. Built-ins ship with the app, and the
  // rest of the library is this person's business rather than something to push into every file.
  const used = new Set(state.sensors.map((s) => s.specId).filter((id): id is string => id !== null));
  const models = state.userModels.filter((m) => used.has(m.id));
  if (models.length > 0) layout.models = models;

  return layout;
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
    const poly = groundPolygon(
      frustum(sensor.pose, effectiveSpec(sensor, state.catalog), state.rangeMode),
    );
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
  if (
    state.vehicle === prev.vehicle &&
    state.sensors === prev.sensors &&
    state.rangeMode === prev.rangeMode
  ) {
    return;
  }
  scheduleBlindReport(state);
});

scheduleBlindReport(useStore.getState());

/* --------------------------------------------------------------------------- history */

/**
 * Undo / redo over the layout.
 *
 * Snapshots are whole `vehicle` + `sensors` pairs. Both are treated immutably everywhere in this
 * store, so a snapshot is two references rather than a copy, and holding fifty of them costs
 * nothing.
 *
 * The subtlety is a drag: `updatePose` fires every frame, and those hundred writes are one edit
 * as far as the engineer is concerned. So history records on the **leading** edge of a burst —
 * the state before the first write — and stays quiet until the writes stop for
 * `HISTORY_COALESCE_MS`. One drag, one undo step.
 *
 * Cameras, display options and the selection stay out: undoing should walk back the work, not
 * the view you happen to be looking through.
 */

export const HISTORY_COALESCE_MS = 400;
const HISTORY_LIMIT = 50;

interface Snapshot {
  vehicle: Vehicle;
  sensors: SensorInstance[];
}

let past: Snapshot[] = [];
let future: Snapshot[] = [];
/** Set while undo/redo writes, so the subscription does not record its own work. */
let applyingHistory = false;
let burstTimer: ReturnType<typeof setTimeout> | undefined;

const snapshot = (s: AppState): Snapshot => ({ vehicle: s.vehicle, sensors: s.sensors });

function syncHistoryFlags() {
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  const state = useStore.getState();
  if (state.canUndo !== canUndo || state.canRedo !== canRedo) {
    useStore.setState({ canUndo, canRedo });
  }
}

function applySnapshot(snap: Snapshot) {
  applyingHistory = true;
  const selected = useStore.getState().selectedId;
  useStore.setState({
    vehicle: snap.vehicle,
    sensors: snap.sensors,
    // The selection can name a sensor this snapshot never had.
    selectedId: snap.sensors.some((x) => x.id === selected) ? selected : null,
    pendingDeleteId: null,
    gizmoDragging: false,
  });
  applyingHistory = false;
  syncHistoryFlags();
}

/** Ends the current burst, so the step we are about to take is never folded into it. */
function closeBurst() {
  clearTimeout(burstTimer);
  burstTimer = undefined;
}

function historyUndo() {
  const previous = past.pop();
  if (!previous) return;
  closeBurst();
  future.unshift(snapshot(useStore.getState()));
  applySnapshot(previous);
}

function historyRedo() {
  const next = future.shift();
  if (!next) return;
  closeBurst();
  past.push(snapshot(useStore.getState()));
  applySnapshot(next);
}

/** Test seam: history is module state, so a suite that shares the store has to clear it. */
export function resetHistory() {
  past = [];
  future = [];
  closeBurst();
  syncHistoryFlags();
}

useStore.subscribe((state, prev) => {
  if (applyingHistory) return;
  if (state.vehicle === prev.vehicle && state.sensors === prev.sensors) return;

  if (burstTimer === undefined) {
    past.push(snapshot(prev));
    if (past.length > HISTORY_LIMIT) past.shift();
    // A fresh edit abandons whatever was undone: there is no branching history here.
    future = [];
    syncHistoryFlags();
  }

  clearTimeout(burstTimer);
  burstTimer = setTimeout(() => {
    burstTimer = undefined;
  }, HISTORY_COALESCE_MS);
});

/* -------------------------------------------------------------------------- autosave */

const AUTOSAVE_MS = 300;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

if (typeof localStorage !== 'undefined') {
  useStore.subscribe((state, prev) => {
    if (state.vehicle === prev.vehicle && state.sensors === prev.sensors) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveLayout(currentLayout(state)), AUTOSAVE_MS);
  });

  // The library is its own key: defining a model is not an edit to the drawing, and it must
  // survive Reset, Import and every undo step.
  useStore.subscribe((state, prev) => {
    if (state.userModels !== prev.userModels) saveModels(state.userModels);
  });
}
