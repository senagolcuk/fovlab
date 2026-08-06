/**
 * localStorage autosave and JSON import/export.
 *
 * Import is hostile-input territory: validate the version, clamp values to legal ranges,
 * regenerate every id and drop unknown keys. Nothing from a file is trusted verbatim.
 */

import { clampFov, clampRange } from '../core/frustum';
import { clamp } from '../core/rotation';
import type { FovSpec, Layout, Pose, SensorInstance, Vehicle } from '../core/types';

export const STORAGE_KEY = 'sensor-fov.layout.v1';

export const DEFAULT_VEHICLE: Vehicle = {
  length: 4.8,
  width: 1.9,
  height: 1.5,
  clearance: 0.2,
  wheelbase: 2.8,
  wheelRadius: 0.34,
};

/** Legal ranges for every editable number, in metres or degrees. */
export const LIMITS = {
  length: [0.5, 30],
  width: [0.5, 6],
  height: [0.2, 6],
  clearance: [0, 2],
  wheelbase: [0.3, 25],
  wheelRadius: [0.05, 1.5],
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
    color: typeof s.color === 'string' && HEX.test(s.color) ? s.color : '#6750A4',
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

  return {
    version: 1,
    vehicle: sanitizeVehicle(l.vehicle),
    sensors: l.sensors
      .slice(0, 200)
      .map((s, i) => sanitizeSensor(s, i))
      .filter((s): s is SensorInstance => s !== null),
  };
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
