import { describe, expect, it } from 'vitest';
import { FOV_MAX, RANGE_MIN } from '../../core/frustum';
import { DEFAULT_VEHICLE, LIMITS, sanitizeLayout, sanitizeVehicle, wrapAngle } from '../persist';

const validSensor = {
  id: 'original-id',
  name: 'FRONT LEFT CORNER',
  specId: 'generic-corner-radar',
  color: '#B3261E',
  visible: true,
  pose: { x: 2.2, y: 0.8, z: 0.5, yaw: 45, pitch: -5, roll: 0 },
};

describe('sanitizeLayout', () => {
  it('rejects anything that is not a v1 layout', () => {
    expect(sanitizeLayout(null)).toBeNull();
    expect(sanitizeLayout({ version: 2, sensors: [] })).toBeNull();
    expect(sanitizeLayout({ version: 1 })).toBeNull();
    expect(sanitizeLayout('{}')).toBeNull();
  });

  it('regenerates ids so an imported layout never collides', () => {
    const l = sanitizeLayout({ version: 1, vehicle: DEFAULT_VEHICLE, sensors: [validSensor] })!;
    expect(l.sensors[0].id).not.toBe('original-id');
    expect(l.sensors[0].name).toBe('FRONT LEFT CORNER');
  });

  it('drops unknown keys', () => {
    const l = sanitizeLayout({
      version: 1,
      vehicle: { ...DEFAULT_VEHICLE, nose: 'long' },
      sensors: [{ ...validSensor, secretPayload: 'x' }],
    })!;
    expect(Object.keys(l.sensors[0]).sort()).toEqual(
      ['color', 'id', 'name', 'pose', 'specId', 'visible'].sort(),
    );
    expect('nose' in l.vehicle).toBe(false);
  });

  it('clamps poses and FOV values to legal ranges', () => {
    const l = sanitizeLayout({
      version: 1,
      vehicle: DEFAULT_VEHICLE,
      sensors: [
        {
          ...validSensor,
          specId: null,
          custom: { hfov: 400, vfov: -3, range: -12 },
          pose: { x: 1e9, y: 0, z: 0, yaw: 720 + 30, pitch: -400, roll: 0 },
        },
      ],
    })!;
    const s = l.sensors[0];
    expect(s.custom).toEqual({ hfov: FOV_MAX, vfov: 0.2, range: RANGE_MIN });
    expect(s.pose.x).toBe(LIMITS.x[1]);
    expect(s.pose.yaw).toBe(30);
    expect(s.pose.pitch).toBe(-90);
  });

  it('keeps an override only when there is a catalogue spec behind it', () => {
    const withSpec = sanitizeLayout({
      version: 1,
      vehicle: DEFAULT_VEHICLE,
      sensors: [{ ...validSensor, override: { range: 40 } }],
    })!;
    expect(withSpec.sensors[0].override).toEqual({ range: 40 });

    const custom = sanitizeLayout({
      version: 1,
      vehicle: DEFAULT_VEHICLE,
      sensors: [{ ...validSensor, specId: null, override: { range: 40 } }],
    })!;
    expect(custom.sensors[0].override).toBeUndefined();
    expect(custom.sensors[0].custom).toBeDefined();
  });

  it('discards malformed sensors but keeps the good ones', () => {
    const l = sanitizeLayout({
      version: 1,
      vehicle: DEFAULT_VEHICLE,
      sensors: [validSensor, null, 42, { ...validSensor, color: 'purple' }],
    })!;
    expect(l.sensors).toHaveLength(2);
    expect(l.sensors[1].color).toBe('#E8827C'); // fell back from an invalid hex
  });
});

describe('sanitizeVehicle', () => {
  it('falls back to the default for missing fields', () => {
    expect(sanitizeVehicle({})).toEqual(DEFAULT_VEHICLE);
  });

  it('clamps out-of-range dimensions', () => {
    const v = sanitizeVehicle({ length: 0, width: 999 });
    expect(v.length).toBe(LIMITS.length[0]);
    expect(v.width).toBe(LIMITS.width[1]);
  });
});

describe('wrapAngle', () => {
  it('wraps into (-180, 180]', () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(360)).toBe(0);
    expect(wrapAngle(370)).toBe(10);
    expect(wrapAngle(-190)).toBe(170);
    expect(wrapAngle(180)).toBe(180);
    expect(wrapAngle(-180)).toBe(180);
  });
});
