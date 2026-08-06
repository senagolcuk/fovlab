import { describe, expect, it } from 'vitest';
import { DEFAULT_FOV, describeFov, effectiveSpec, isInherited, parseCatalog } from '../catalog';
import { clampFov, clampRange, clampSpec, FOV_MAX, FOV_MIN, RANGE_MIN } from '../frustum';
import type { SensorInstance, SensorSpec } from '../types';
import shippedCatalog from '../../data/sensors.json';

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

describe('the shipped catalogue file', () => {
  const specs = parseCatalog(shippedCatalog);

  it('parses every entry', () => {
    expect(specs).toHaveLength(
      (shippedCatalog as { specs: unknown[] }).specs.length,
    );
  });

  it('has a unique id per entry', () => {
    expect(new Set(specs.map((s) => s.id)).size).toBe(specs.length);
  });

  it('leaves the ISX031 fixtures flagged, since only their HFOV is confirmed', () => {
    const isx = specs.filter((s) => s.id.startsWith('sensing-world-isx031'));
    expect(isx).toHaveLength(3);
    for (const s of isx) {
      expect(s.verified).toBe(false);
      expect(s.datasheetUrl).toBeUndefined();
    }
    expect(isx.map((s) => s.hfov)).toEqual([60, 120, 190]);
  });

  it('keeps the 190° lens at its datasheet figure and clamps only at render', () => {
    const spec = specs.find((s) => s.id === 'sensing-world-isx031-190')!;
    expect(spec.hfov).toBe(190); // what the engineer looked up
    expect(clampSpec(spec).hfov).toBe(FOV_MAX); // what a flat far plane can represent
  });

  it('ships every generic entry verified, since they are definitional', () => {
    for (const s of specs.filter((x) => x.id.startsWith('generic-'))) {
      expect(s.verified).toBe(true);
    }
  });
});
