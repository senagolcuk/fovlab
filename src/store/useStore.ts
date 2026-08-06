/**
 * Single source of truth. Flat and boring on purpose.
 *
 * `updatePose` runs on every pointer move during a drag, so it touches exactly one sensor and
 * derives nothing. Anything expensive — the blind spot report above all — is derived by the
 * component that needs it, debounced.
 */

import { create } from 'zustand';
import { parseCatalog } from '../core/catalog';
import type { Layout, Pose, SensorInstance, SensorSpec, Vehicle } from '../core/types';
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
}

export type DragMode = 'off' | 'translate' | 'rotate';

export interface AppState {
  vehicle: Vehicle;
  sensors: SensorInstance[];
  catalog: SensorSpec[];
  selectedId: string | null;

  display: DisplayOptions;
  linkZoom: boolean;
  dragMode: DragMode;

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
}

export const DEFAULT_DISPLAY: DisplayOptions = {
  volume: true,
  edges: true,
  ground: true,
  axis: true,
  opacity: 0.3,
  grid: true,
  wheels: true,
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

/** New sensors land on the front bumper centreline, looking forward. */
function defaultPose(vehicle: Vehicle): Pose {
  return {
    x: Number((vehicle.length / 2).toFixed(3)),
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
    set({ dragMode: mode });
  },
}));

/** The exportable slice of the state. */
export function currentLayout(state: AppState = useStore.getState()): Layout {
  return { version: 1, vehicle: state.vehicle, sensors: state.sensors };
}

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
