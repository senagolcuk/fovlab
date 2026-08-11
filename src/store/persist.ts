/**
 * localStorage autosave and JSON import/export.
 *
 * Import is hostile-input territory: validate the version, clamp values to legal ranges,
 * regenerate every id and drop unknown keys. Nothing from a file is trusted verbatim.
 */

import { parseCatalog } from '../core/catalog';
import { clampFov, clampRange } from '../core/frustum';
import { clamp } from '../core/rotation';
import type {
  FovSpec,
  Layout,
  Pose,
  SensorInstance,
  SensorSpec,
  Vehicle,
  VehicleShape,
} from '../core/types';

const SHAPES: VehicleShape[] = ['box', 'rounded', 'cylinder'];

export const STORAGE_KEY = 'sensor-fov.layout.v1';

export const DEFAULT_VEHICLE: Vehicle = {
  length: 4.8,
  width: 1.9,
  height: 1.5,
  clearance: 0.2,
  wheelbase: 2.8,
  wheelRadius: 0.34,
  shape: 'box',
  cornerRadius: 0.3,
};

/** Legal ranges for every editable number, in metres or degrees. */
export const LIMITS = {
  length: [0.5, 30],
  width: [0.5, 6],
  height: [0.2, 6],
  clearance: [0, 2],
  wheelbase: [0.3, 25],
  wheelRadius: [0.05, 1.5],
  // The upper bound is per-vehicle — half the shorter side — so `cornerRadius()` clamps again.
  cornerRadius: [0, 3],
  x: [-40, 40],
  y: [-20, 20],
  z: [-5, 20],
  angle: [-360, 360],
} as const;

let idCounter = 0;
export function newId(prefix = 's'): string {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/* ------------------------------------------------------------------------- sanitising */

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function limited(v: unknown, key: keyof typeof LIMITS, fallback: number): number {
  const [lo, hi] = LIMITS[key];
  return clamp(num(v, fallback), lo, hi);
}

/** Wraps an angle into (-180, 180] so imported poses read sensibly. */
export function wrapAngle(deg: number): number {
  const w = ((((deg + 180) % 360) + 360) % 360) - 180;
  return w === -180 ? 180 : w;
}

export function sanitizeVehicle(raw: unknown): Vehicle {
  const v = (raw ?? {}) as Record<string, unknown>;
  return {
    length: limited(v.length, 'length', DEFAULT_VEHICLE.length),
    width: limited(v.width, 'width', DEFAULT_VEHICLE.width),
    height: limited(v.height, 'height', DEFAULT_VEHICLE.height),
    clearance: limited(v.clearance, 'clearance', DEFAULT_VEHICLE.clearance),
    wheelbase: limited(v.wheelbase, 'wheelbase', DEFAULT_VEHICLE.wheelbase),
    wheelRadius: limited(v.wheelRadius, 'wheelRadius', DEFAULT_VEHICLE.wheelRadius),
    // A layout written before shapes existed has neither field, and must stay a box.
    shape: SHAPES.includes(v.shape as VehicleShape)
      ? (v.shape as VehicleShape)
      : DEFAULT_VEHICLE.shape,
    cornerRadius: limited(v.cornerRadius, 'cornerRadius', DEFAULT_VEHICLE.cornerRadius),
  };
}

function sanitizePose(raw: unknown): Pose {
  const p = (raw ?? {}) as Record<string, unknown>;
  return {
    x: limited(p.x, 'x', 0),
    y: limited(p.y, 'y', 0),
    z: limited(p.z, 'z', 0),
    yaw: wrapAngle(num(p.yaw, 0)),
    pitch: clamp(num(p.pitch, 0), -90, 90),
    roll: wrapAngle(num(p.roll, 0)),
  };
}

function sanitizeFov(raw: unknown): FovSpec | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const f = raw as Record<string, unknown>;
  if (typeof f.hfov !== 'number' && typeof f.vfov !== 'number' && typeof f.range !== 'number') {
    return undefined;
  }
  return {
    hfov: clampFov(num(f.hfov, 90)),
    vfov: clampFov(num(f.vfov, 60)),
    range: clampRange(num(f.range, 10)),
  };
}

function sanitizeOverride(raw: unknown): Partial<FovSpec> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const f = raw as Record<string, unknown>;
  const out: Partial<FovSpec> = {};
  if (typeof f.hfov === 'number') out.hfov = clampFov(f.hfov);
  if (typeof f.vfov === 'number') out.vfov = clampFov(f.vfov);
  if (typeof f.range === 'number') out.range = clampRange(f.range);
  return Object.keys(out).length ? out : undefined;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function sanitizeSensor(raw: unknown, index: number): SensorInstance | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;

  const specId = typeof s.specId === 'string' && s.specId !== '' ? s.specId : null;
  const custom = sanitizeFov(s.custom);

  const inst: SensorInstance = {
    id: newId(),
    name: typeof s.name === 'string' && s.name.trim() ? s.name.slice(0, 64) : `SENSOR ${index + 1}`,
    specId,
    // Duplicated rather than imported from the store, which imports this module.
    color: typeof s.color === 'string' && HEX.test(s.color) ? s.color : '#E8827C',
    visible: s.visible !== false,
    pose: sanitizePose(s.pose),
  };

  // A custom block only means anything when there is no catalogue spec behind it.
  if (!specId) inst.custom = custom ?? { hfov: 90, vfov: 60, range: 10 };
  const override = sanitizeOverride(s.override);
  if (specId && override) inst.override = override;

  return inst;
}

/** Returns null when the payload is not a v1 layout at all. */
export function sanitizeLayout(raw: unknown): Layout | null {
  if (!raw || typeof raw !== 'object') return null;
  const l = raw as Record<string, unknown>;
  if (l.version !== 1) return null;
  if (!Array.isArray(l.sensors)) return null;

  const layout: Layout = {
    version: 1,
    vehicle: sanitizeVehicle(l.vehicle),
    sensors: l.sensors
      .slice(0, 200)
      .map((s, i) => sanitizeSensor(s, i))
      .filter((s): s is SensorInstance => s !== null),
  };

  // Absent in files written before models existed, and in files that only use built-in entries.
  if (Array.isArray(l.models)) {
    const models = parseCatalog({ specs: l.models.slice(0, 200) });
    if (models.length > 0) layout.models = models;
  }
  return layout;
}

/* --------------------------------------------------------------------------- storage */

export function loadLayout(): Layout | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return null;
    return sanitizeLayout(JSON.parse(text));
  } catch {
    return null;
  }
}

export function saveLayout(layout: Layout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Quota or a private-mode block. Losing autosave is not worth breaking the app over.
  }
}

export function clearLayout(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/* ----------------------------------------------------------------------------- prefs */

/**
 * Preferences live under their own key rather than in the layout: they belong to the person, not
 * to the drawing, and exporting a layout must not carry one engineer's "don't ask again" to
 * everyone who opens the file.
 */
/**
 * Models a person made themselves, kept apart from the layout: they are a library that outlives
 * any one drawing. Referenced ones are also written into an exported layout, so a file opened on
 * another machine draws the same geometry rather than falling back to the default FOV.
 */
const MODELS_KEY = 'sensor-fov.models.v1';

export function loadModels(): SensorSpec[] {
  try {
    const text = localStorage.getItem(MODELS_KEY);
    if (!text) return [];
    return parseCatalog({ specs: JSON.parse(text) });
  } catch {
    return [];
  }
}

export function saveModels(models: SensorSpec[]): void {
  try {
    localStorage.setItem(MODELS_KEY, JSON.stringify(models));
  } catch {
    // Quota or a private-mode block. The models last the session rather than breaking the app.
  }
}

const PREFS_KEY = 'sensor-fov.prefs.v1';

export interface Prefs {
  /** False once the engineer has ticked "don't ask again" on the delete prompt. */
  askBeforeDelete: boolean;
}

export const DEFAULT_PREFS: Prefs = { askBeforeDelete: true };

export function loadPrefs(): Prefs {
  try {
    const text = localStorage.getItem(PREFS_KEY);
    if (!text) return DEFAULT_PREFS;
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PREFS;
    const { askBeforeDelete } = parsed as Partial<Prefs>;
    // Only an explicit false turns the prompt off; anything unreadable keeps asking.
    return { askBeforeDelete: askBeforeDelete !== false };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Quota or a private-mode block. The prompt simply keeps asking.
  }
}

/* ------------------------------------------------------------------- file in and out */

export function layoutToJson(layout: Layout): string {
  return JSON.stringify(layout, null, 2);
}

export function downloadLayout(layout: Layout, filename = 'sensor-layout.json'): void {
  const blob = new Blob([layoutToJson(layout)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Rejects with a message fit to show the user. */
export async function readLayoutFile(file: File): Promise<Layout> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const layout = sanitizeLayout(parsed);
  if (!layout) throw new Error('That file is not a version 1 sensor layout.');
  return layout;
}
