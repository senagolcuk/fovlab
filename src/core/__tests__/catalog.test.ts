import { describe, expect, it } from 'vitest';
import { DEFAULT_FOV, describeFov, effectiveSpec, isInherited, parseCatalog } from '../catalog';
import { clampFov, clampRange, FOV_MAX, FOV_MIN, RANGE_MIN } from '../frustum';
import type { SensorInstance, SensorSpec } from '../types';

const catalog: SensorSpec[] = [
  {
    id: 'generic-corner-radar',
    kind: 'radar',
    manufacturer: 'Generic',
    model: 'Corner radar',
    hfov: 150,
    vfov: 20,
    range: 80,
    verified: true,
  },
];

function instance(patch: Partial<SensorInstance> = {}): SensorInstance {
  return {
    id: 's1',
    name: 'FRONT LEFT CORNER',
    specId: null,
    color: '#6750A4',
    visible: true,
    pose: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    ...patch,
  };
}

describe('spec resolution', () => {
  it('falls back to the default when there is no spec and no custom block', () => {
    expect(effectiveSpec(instance(), catalog)).toEqual(DEFAULT_FOV);
  });

  it('inherits every field from the catalogue spec', () => {
    const inst = instance({ specId: 'generic-corner-radar' });
    expect(effectiveSpec(inst, catalog)).toEqual({ hfov: 150, vfov: 20, range: 80 });
  });

  it('leaves the other fields inherited when one is overridden', () => {
    const inst = instance({ specId: 'generic-corner-radar', override: { range: 40 } });
    expect(effectiveSpec(inst, catalog)).toEqual({ hfov: 150, vfov: 20, range: 40 });
    expect(isInherited(inst, 'range')).toBe(false);
    expect(isInherited(inst, 'hfov')).toBe(true);
    expect(isInherited(inst, 'vfov')).toBe(true);
  });

  it('uses the custom block for a fully custom instance', () => {
    const inst = instance({ custom: { hfov: 33, vfov: 22, range: 11 } });
    expect(effectiveSpec(inst, catalog)).toEqual({ hfov: 33, vfov: 22, range: 11 });
    expect(isInherited(inst, 'hfov')).toBe(false);
  });

  it('falls back to the default when the spec id is missing from the catalogue', () => {
    expect(effectiveSpec(instance({ specId: 'gone' }), catalog)).toEqual(DEFAULT_FOV);
  });

  it('summarises a spec for the list row', () => {
    expect(describeFov({ hfov: 120, vfov: 40, range: 20 })).toBe('120°×40° 20m');
  });
});

describe('clamping', () => {
  it('keeps tan(fov/2) finite', () => {
    expect(clampFov(180)).toBe(FOV_MAX);
    expect(clampFov(0)).toBe(FOV_MIN);
    expect(clampFov(-10)).toBe(FOV_MIN);
    expect(clampFov(Number.NaN)).toBe(FOV_MIN);
  });

  it('keeps range positive', () => {
    expect(clampRange(0)).toBe(RANGE_MIN);
    expect(clampRange(-5)).toBe(RANGE_MIN);
    expect(clampRange(12)).toBe(12);
  });
});

describe('parseCatalog', () => {
  it('drops malformed and duplicate entries', () => {
    const parsed = parseCatalog({
      version: 1,
      specs: [
        catalog[0],
        { ...catalog[0] }, // duplicate id
        { id: 'no-kind', manufacturer: 'x', model: 'y', hfov: 1, vfov: 1, range: 1 },
        { id: 'bad-fov', kind: 'camera', manufacturer: 'x', model: 'y', hfov: '90' },
        null,
      ],
    });
    expect(parsed.map((s) => s.id)).toEqual(['generic-corner-radar']);
  });

  it('treats a missing verified flag as unverified', () => {
    const parsed = parseCatalog({
      specs: [{ id: 'a', kind: 'camera', manufacturer: 'm', model: 'n', hfov: 90, vfov: 60, range: 10 }],
    });
    expect(parsed[0].verified).toBe(false);
  });

  it('returns an empty catalogue for junk input', () => {
    expect(parseCatalog(null)).toEqual([]);
    expect(parseCatalog({ specs: 'nope' })).toEqual([]);
  });
});
