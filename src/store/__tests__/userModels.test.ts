/**
 * User-defined models. The point of a model rather than a fully custom sensor is reuse, so the
 * things worth pinning are that instances resolve through it, and that it travels with an
 * exported layout — without that, the same file draws different geometry on another machine.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { effectiveSpec } from '../../core/catalog';
import type { SensorSpec } from '../../core/types';
import { DEFAULT_VEHICLE, sanitizeLayout } from '../persist';
import { builtInCatalog, currentLayout, useStore } from '../useStore';

const draft: Omit<SensorSpec, 'id'> = {
  kind: 'ultrasonic',
  manufacturer: 'Acme',
  model: 'Park sonar',
  hfov: 70,
  vfov: 30,
  range: 4,
  verified: false,
};

beforeEach(() => {
  useStore.setState({
    vehicle: DEFAULT_VEHICLE,
    sensors: [],
    selectedId: null,
    userModels: [],
    catalog: builtInCatalog,
  });
});

describe('defining a model', () => {
  it('adds a type to the catalogue without mounting anything', () => {
    const before = useStore.getState().sensors.length;
    const id = useStore.getState().addModel(draft);
    expect(useStore.getState().sensors).toHaveLength(before);
    expect(useStore.getState().catalog.some((s) => s.id === id)).toBe(true);
  });

  it('keeps a free-text kind, since kind only ever labels', () => {
    const id = useStore.getState().addModel(draft);
    expect(useStore.getState().catalog.find((s) => s.id === id)!.kind).toBe('ultrasonic');
  });

  it('lists built-ins before hand-made models', () => {
    useStore.getState().addModel(draft);
    const ids = useStore.getState().catalog.map((s) => s.id);
    expect(ids.slice(0, builtInCatalog.length)).toEqual(builtInCatalog.map((s) => s.id));
  });

  it('resolves an instance through the model rather than copying its numbers', () => {
    const id = useStore.getState().addModel(draft);
    const sensor = useStore.getState().addSensor(id);
    const state = useStore.getState();
    expect(effectiveSpec(state.sensors[0], state.catalog)).toEqual({ hfov: 70, vfov: 30, range: 4 });
    expect(state.sensors[0].specId).toBe(id);
    expect(state.sensors[0].custom).toBeUndefined();
    void sensor;
  });

  it('reaches every instance when the model is corrected', () => {
    const id = useStore.getState().addModel(draft);
    useStore.getState().addSensor(id);
    useStore.getState().addSensor(id);

    const fixed = useStore.getState().userModels.map((m) => ({ ...m, range: 6 }));
    useStore.setState({ userModels: fixed, catalog: [...builtInCatalog, ...fixed] });

    const state = useStore.getState();
    for (const s of state.sensors) {
      expect(effectiveSpec(s, state.catalog).range).toBe(6);
    }
  });
});

describe('a model in an exported layout', () => {
  it('travels with the file when a sensor uses it', () => {
    const id = useStore.getState().addModel(draft);
    useStore.getState().addSensor(id);
    expect(currentLayout().models?.map((m) => m.id)).toEqual([id]);
  });

  it('stays out of the file when nothing uses it', () => {
    useStore.getState().addModel(draft);
    expect(currentLayout().models).toBeUndefined();
  });

  it('does not repeat the built-ins, which ship with the app', () => {
    useStore.getState().addSensor(builtInCatalog[0].id);
    expect(currentLayout().models).toBeUndefined();
  });

  it('survives the round trip, so the geometry is the same on the other machine', () => {
    const id = useStore.getState().addModel(draft);
    useStore.getState().addSensor(id);
    const exported = sanitizeLayout(JSON.parse(JSON.stringify(currentLayout())))!;

    // A fresh reader: the library is empty, as it would be in another browser.
    useStore.setState({ sensors: [], userModels: [], catalog: builtInCatalog });
    useStore.getState().importLayout(exported);

    const state = useStore.getState();
    expect(state.userModels.map((m) => m.model)).toEqual(['Park sonar']);
    expect(effectiveSpec(state.sensors[0], state.catalog)).toEqual({
      hfov: 70,
      vfov: 30,
      range: 4,
    });
  });

  it('keeps the local copy when an older file carries a stale version of it', () => {
    const id = useStore.getState().addModel(draft);
    useStore.getState().addSensor(id);
    const stale = sanitizeLayout(JSON.parse(JSON.stringify(currentLayout())))!;

    // The person has since corrected the figure the old file still holds.
    const fixed = useStore.getState().userModels.map((m) => ({ ...m, range: 9 }));
    useStore.setState({ userModels: fixed, catalog: [...builtInCatalog, ...fixed] });

    useStore.getState().importLayout(stale);
    const state = useStore.getState();
    expect(effectiveSpec(state.sensors[0], state.catalog).range).toBe(9);
  });
});

describe('deleting a model', () => {
  it('freezes the numbers into instances instead of letting them fall back', () => {
    const id = useStore.getState().addModel(draft);
    useStore.getState().addSensor(id);
    useStore.getState().removeModel(id);

    const state = useStore.getState();
    expect(state.catalog.some((s) => s.id === id)).toBe(false);
    expect(state.sensors[0].specId).toBeNull();
    // Still 70×30×4, not the 90×60×10 a missing spec would have resolved to.
    expect(effectiveSpec(state.sensors[0], state.catalog)).toEqual({ hfov: 70, vfov: 30, range: 4 });
  });

  it('leaves sensors that used other models alone', () => {
    const keep = useStore.getState().addModel(draft);
    const drop = useStore.getState().addModel({ ...draft, model: 'Other' });
    useStore.getState().addSensor(keep);
    useStore.getState().removeModel(drop);
    expect(useStore.getState().sensors[0].specId).toBe(keep);
  });
});
