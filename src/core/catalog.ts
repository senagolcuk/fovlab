/**
 * Spec lookup and resolution.
 *
 * A spec is what a sensor IS; an instance is a spec MOUNTED somewhere. They stay separate so
 * that correcting a catalogue number updates every instance using it. Never copy FOV values
 * into an instance at add time.
 */

import { clampRange } from './frustum';
import type { FovSpec, SensorInstance, SensorKind, SensorSpec } from './types';

/** Used when an instance has no spec and no custom block. */
export const DEFAULT_FOV: FovSpec = { hfov: 90, vfov: 60, range: 10 };

export type FovField = keyof FovSpec;
export const FOV_FIELDS: FovField[] = ['hfov', 'vfov', 'range'];

export function findSpec(specId: string | null, catalog: SensorSpec[]): SensorSpec | undefined {
  return specId ? catalog.find((s) => s.id === specId) : undefined;
}

/** override wins over custom, custom over the catalogue spec, spec over the default. */
export function effectiveSpec(inst: SensorInstance, catalog: SensorSpec[]): FovSpec {
  const base = findSpec(inst.specId, catalog);
  const src = base ?? DEFAULT_FOV;
  return {
    hfov: inst.override?.hfov ?? inst.custom?.hfov ?? src.hfov,
    vfov: inst.override?.vfov ?? inst.custom?.vfov ?? src.vfov,
    range: inst.override?.range ?? inst.custom?.range ?? src.range,
  };
}

/** True when the field's value still comes from the catalogue spec, not from the instance. */
export function isInherited(inst: SensorInstance, field: FovField): boolean {
  if (!inst.specId) return false;
  return inst.override?.[field] === undefined;
}

/** Compact list-row summary, e.g. `120°×40° 20m`. */
export function describeFov(spec: FovSpec): string {
  const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  return `${n(spec.hfov)}°×${n(spec.vfov)}° ${n(spec.range)}m`;
}

const KINDS: SensorKind[] = ['camera', 'lidar', 'radar'];

/** A field of view a datasheet could plausibly state. Wider than FOV_MAX is allowed here. */
function isSaneAngle(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 360;
}

/** Drops malformed entries rather than trusting the JSON file. */
export function parseCatalog(raw: unknown): SensorSpec[] {
  const specs = (raw as { specs?: unknown } | null)?.specs;
  if (!Array.isArray(specs)) return [];

  const out: SensorSpec[] = [];
  const seen = new Set<string>();

  for (const entry of specs) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== 'string' || e.id === '' || seen.has(e.id)) continue;
    if (typeof e.manufacturer !== 'string' || typeof e.model !== 'string') continue;
    if (!KINDS.includes(e.kind as SensorKind)) continue;
    if (typeof e.hfov !== 'number' || typeof e.vfov !== 'number' || typeof e.range !== 'number') {
      continue;
    }

    // The catalogue records what the datasheet says, not what the renderer can draw. A lens
    // wider than FOV_MAX is kept at its real figure and clamped at render time by clampSpec,
    // so the editor can show the engineer the number they looked up.
    if (!isSaneAngle(e.hfov) || !isSaneAngle(e.vfov)) continue;

    seen.add(e.id);
    const spec: SensorSpec = {
      id: e.id,
      kind: e.kind as SensorKind,
      manufacturer: e.manufacturer,
      model: e.model,
      hfov: e.hfov,
      vfov: e.vfov,
      range: clampRange(e.range),
      verified: e.verified === true,
    };
    const res = e.resolution as { h?: unknown; v?: unknown } | undefined;
    if (res && typeof res.h === 'number' && typeof res.v === 'number') {
      spec.resolution = { h: res.h, v: res.v };
    }
    if (typeof e.datasheetUrl === 'string' && e.datasheetUrl !== '') {
      spec.datasheetUrl = e.datasheetUrl;
    }
    out.push(spec);
  }

  return out;
}
