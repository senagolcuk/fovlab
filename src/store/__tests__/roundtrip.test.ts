/**
 * Phase 4's definition of done: a layout can be built, exported, and imported back identically.
 * Ids are deliberately regenerated on import, so they are the one thing excluded.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_FOV } from '../../core/catalog';
import { isInsideBody } from '../../core/ground';
import type { Layout, SensorInstance } from '../../core/types';
import { DEFAULT_VEHICLE, layoutToJson, sanitizeLayout } from '../persist';
import { DEFAULT_VIEWS, currentLayout, useStore } from '../useStore';

function withoutIds(l: Layout) {
  return {
    ...l,
    sensors: l.sensors.map(({ id, ...rest }) => {
      void id;
      return rest;
    }),
  };
}

beforeEach(() => {
  useStore.setState({
    vehicle: DEFAULT_VEHICLE,
    sensors: [],
    selectedId: null,
    views: structuredClone(DEFAULT_VIEWS),
  });
});

describe('sensor lifecycle', () => {
  it('adds a sensor on the front bumper and selects it', () => {
    const id = useStore.getState().addSensor();
    const s = useStore.getState().sensors[0];
    expect(useStore.getState().selectedId).toBe(id);
    expect(s.pose.x).toBeCloseTo(DEFAULT_VEHICLE.length / 2 + 0.02, 6);
    expect(isInsideBody(s.pose, DEFAULT_VEHICLE)).toBe(false); // no warning on a fresh sensor
    expect(s.specId).toBeNull();
    // Against the constant, not a copy of its values: keeping two of these apart is how the
    // default quietly became 50 in one place and 10 in the other.
    expect(s.custom).toEqual(DEFAULT_FOV);
  });

  it('gives consecutive sensors different colours', () => {
    useStore.getState().addSensor();
    useStore.getState().addSensor();
    const [a, b] = useStore.getState().sensors;
    expect(a.color).not.toBe(b.color);
  });

  it('inserts a duplicate right after its source with a fresh id', () => {
    const first = useStore.getState().addSensor();
    useStore.getState().addSensor();
    useStore.getState().duplicateSensor(first);

    const sensors = useStore.getState().sensors;
    expect(sensors).toHaveLength(3);
    expect(sensors[1].id).not.toBe(first);
    expect(sensors[1].name).toBe(`${sensors[0].name} COPY`);
    expect(sensors[1].pose).toEqual(sensors[0].pose);
    expect(sensors[1].pose).not.toBe(sensors[0].pose); // deep copy, not shared
  });

  it('moves the selection off a deleted sensor', () => {
    const a = useStore.getState().addSensor();
    useStore.getState().addSensor();
    useStore.getState().select(a);
    useStore.getState().removeSensor(a);
    expect(useStore.getState().selectedId).toBe(useStore.getState().sensors[0].id);
  });

  it('clears the selection when the last sensor goes', () => {
    const a = useStore.getState().addSensor();
    useStore.getState().removeSensor(a);
    expect(useStore.getState().selectedId).toBeNull();
  });

  it('locks dragging again for each new sensor, whatever the last one was left in', () => {
    useStore.getState().setDragMode('translate');
    useStore.getState().addSensor();
    expect(useStore.getState().dragMode).toBe('off');

    useStore.getState().setDragMode('rotate');
    const a = useStore.getState().sensors[0].id;
    useStore.getState().duplicateSensor(a);
    expect(useStore.getState().dragMode).toBe('off');
  });

  it('does not leave a stale gizmo drag behind when a sensor is added mid-drag', () => {
    useStore.getState().setDragMode('translate');
    useStore.getState().setGizmoDragging(true);
    useStore.getState().addSensor();
    expect(useStore.getState().gizmoDragging).toBe(false);
  });

  it('drops every sensor on clearSensors, keeping the vehicle', () => {
    useStore.getState().setVehicle({ length: 6.2 });
    useStore.getState().addSensor();
    useStore.getState().addSensor();
    useStore.getState().clearSensors();
    expect(useStore.getState().sensors).toEqual([]);
    expect(useStore.getState().selectedId).toBeNull();
    expect(useStore.getState().vehicle.length).toBe(6.2);
  });

  it('is a no-op on an already empty layout', () => {
    useStore.getState().clearSensors();
    useStore.getState().clearSensors();
    expect(useStore.getState().sensors).toEqual([]);
    expect(useStore.getState().selectedId).toBeNull();
  });

  it('touches only the named sensor on updatePose', () => {
    const a = useStore.getState().addSensor();
    useStore.getState().addSensor();
    const before = useStore.getState().sensors[1];
    useStore.getState().updatePose(a, { yaw: 45 });
    expect(useStore.getState().sensors[0].pose.yaw).toBe(45);
    expect(useStore.getState().sensors[1]).toBe(before); // identity preserved
  });
});

describe('export / import round trip', () => {
  it('reproduces the layout exactly, ids aside', () => {
    const store = useStore.getState();
    store.setVehicle({ length: 5.2, width: 2.05, height: 1.62, clearance: 0.25 });

    const a = store.addSensor();
    useStore.getState().updateSensor(a, {
      name: 'FRONT LEFT CORNER',
      color: '#B3261E',
      custom: { hfov: 120, vfov: 40, range: 20 },
    });
    useStore.getState().updatePose(a, { x: 2.4, y: 0.9, z: 0.55, yaw: 45, pitch: -6, roll: 0 });

    const b = useStore.getState().addSensor('generic-corner-radar');
    useStore.getState().updateSensor(b, { name: 'REAR RADAR', override: { range: 42 } });
    useStore.getState().updatePose(b, { x: -2.6, y: -0.9, z: 0.5, yaw: -135 });
    useStore.getState().updateSensor(b, { visible: false });

    const exported = currentLayout();
    const json = layoutToJson(exported);

    // A fresh tab: parse the file and validate it exactly as the import path does.
    const imported = sanitizeLayout(JSON.parse(json));
    expect(imported).not.toBeNull();
    expect(withoutIds(imported!)).toEqual(withoutIds(exported));
  });

  it('keeps the layout stable across a second round trip', () => {
    useStore.getState().addSensor('generic-front-camera-60');
    const once = sanitizeLayout(JSON.parse(layoutToJson(currentLayout())))!;
    const twice = sanitizeLayout(JSON.parse(layoutToJson(once)))!;
    expect(withoutIds(twice)).toEqual(withoutIds(once));
  });

  it('replaces the whole layout on import and selects the first sensor', () => {
    useStore.getState().addSensor();
    const incoming: Layout = {
      version: 1,
      vehicle: { ...DEFAULT_VEHICLE, length: 7 },
      sensors: [
        {
          id: 'x',
          name: 'ONLY',
          specId: null,
          custom: { hfov: 30, vfov: 20, range: 5 },
          color: '#00696E',
          visible: true,
          pose: { x: 1, y: 0, z: 1, yaw: 0, pitch: 0, roll: 0 },
        } satisfies SensorInstance,
      ],
    };
    useStore.getState().importLayout(incoming);

    expect(useStore.getState().vehicle.length).toBe(7);
    expect(useStore.getState().sensors).toHaveLength(1);
    expect(useStore.getState().selectedId).toBe('x');
  });
});
