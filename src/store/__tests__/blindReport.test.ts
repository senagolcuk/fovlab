/**
 * Phase 7's definition of done: removing a front sensor makes the forward sectors appear in
 * the report. Also pins the debounce, which is what keeps the report out of the render loop.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_VEHICLE } from '../persist';
import { REPORT_DEBOUNCE_MS, useStore } from '../useStore';

function addSurroundSensor(yaw: number) {
  const id = useStore.getState().addSensor();
  useStore.getState().updateSensor(id, { custom: { hfov: 100, vfov: 60, range: 30 } });
  useStore.getState().updatePose(id, { x: 0, y: 0, z: 1, yaw, pitch: -25, roll: 0 });
  return id;
}

/** Runs the pending debounce. */
function settle() {
  vi.advanceTimersByTime(REPORT_DEBOUNCE_MS + 1);
}

beforeEach(() => {
  vi.useFakeTimers();
  useStore.setState({
    vehicle: DEFAULT_VEHICLE,
    sensors: [],
    selectedId: null,
    blindReport: null,
    blindReportStale: true,
  });
  settle();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('blind spot report', () => {
  it('reports the whole azimuth blind with no sensors', () => {
    expect(useStore.getState().blindReport?.blindFraction).toBe(1);
  });

  it('does not recompute until the debounce elapses', () => {
    for (const yaw of [0, 90, 180, 270]) addSurroundSensor(yaw);
    expect(useStore.getState().blindReportStale).toBe(true);
    expect(useStore.getState().blindReport?.blindFraction).toBe(1); // still the old answer

    vi.advanceTimersByTime(REPORT_DEBOUNCE_MS - 1);
    expect(useStore.getState().blindReportStale).toBe(true);

    vi.advanceTimersByTime(2);
    expect(useStore.getState().blindReportStale).toBe(false);
    expect(useStore.getState().blindReport?.blindFraction).toBe(0);
  });

  it('opens the forward sectors when the front sensor is removed', () => {
    const front = addSurroundSensor(0);
    for (const yaw of [90, 180, 270]) addSurroundSensor(yaw);
    settle();
    expect(useStore.getState().blindReport?.blind).toEqual([]);

    useStore.getState().removeSensor(front);
    settle();

    const report = useStore.getState().blindReport!;
    expect(report.blind.length).toBeGreaterThan(0);
    expect(report.sectors.find((s) => Math.abs(s.centerDeg) < 3)!.covered).toBe(false);
    expect(
      report.sectors.find((s) => Math.abs(Math.abs(s.centerDeg) - 180) < 3)!.covered,
    ).toBe(true);
  });

  it('treats a hidden sensor as absent', () => {
    const front = addSurroundSensor(0);
    for (const yaw of [90, 180, 270]) addSurroundSensor(yaw);
    settle();
    expect(useStore.getState().blindReport?.blindFraction).toBe(0);

    useStore.getState().updateSensor(front, { visible: false });
    settle();
    expect(useStore.getState().blindReport!.blindFraction).toBeGreaterThan(0);
  });

  it('collapses a burst of pose changes into one recomputation', () => {
    const id = addSurroundSensor(0);
    settle();
    const before = useStore.getState().blindReport;

    for (let i = 0; i < 20; i++) useStore.getState().updatePose(id, { yaw: i });
    expect(useStore.getState().blindReport).toBe(before); // nothing recomputed mid-drag

    settle();
    expect(useStore.getState().blindReport).not.toBe(before);
  });
});
