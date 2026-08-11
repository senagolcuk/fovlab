/**
 * Undo / redo over the layout. The coalescing rule is the part worth pinning: a drag writes a
 * pose every frame and all of it has to collapse into one step.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_VEHICLE } from '../persist';
import { HISTORY_COALESCE_MS, resetHistory, useStore } from '../useStore';

/** Lets the current burst close, so the next edit starts a new undo step. */
function settle() {
  vi.advanceTimersByTime(HISTORY_COALESCE_MS + 1);
}

beforeEach(() => {
  vi.useFakeTimers();
  useStore.setState({
    vehicle: DEFAULT_VEHICLE,
    sensors: [],
    selectedId: null,
    pendingDeleteId: null,
  });
  resetHistory();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('undo and redo', () => {
  it('has nothing to undo on a fresh layout', () => {
    expect(useStore.getState().canUndo).toBe(false);
    expect(useStore.getState().canRedo).toBe(false);
    useStore.getState().undo(); // must not throw
    expect(useStore.getState().sensors).toHaveLength(0);
  });

  it('takes back an added sensor', () => {
    useStore.getState().addSensor();
    settle();
    expect(useStore.getState().canUndo).toBe(true);

    useStore.getState().undo();
    expect(useStore.getState().sensors).toHaveLength(0);
    expect(useStore.getState().canRedo).toBe(true);
  });

  it('puts it back on redo', () => {
    const id = useStore.getState().addSensor();
    settle();
    useStore.getState().undo();
    useStore.getState().redo();
    expect(useStore.getState().sensors).toHaveLength(1);
    expect(useStore.getState().sensors[0].id).toBe(id);
  });

  it('collapses a whole drag into one step', () => {
    const id = useStore.getState().addSensor();
    settle();
    const startX = useStore.getState().sensors[0].pose.x;

    // A drag: many pose writes at frame rate, with no pause between them.
    for (let i = 1; i <= 40; i++) {
      useStore.getState().updatePose(id, { x: i * 0.05 });
      vi.advanceTimersByTime(16);
    }
    settle();
    expect(useStore.getState().sensors[0].pose.x).toBeCloseTo(2, 10);

    // One undo returns to where the drag began, not to the previous frame.
    useStore.getState().undo();
    expect(useStore.getState().sensors[0].pose.x).toBe(startX);
  });

  it('separates two drags with a pause between them', () => {
    const id = useStore.getState().addSensor();
    settle();
    const startX = useStore.getState().sensors[0].pose.x;

    useStore.getState().updatePose(id, { x: 1 });
    settle();
    useStore.getState().updatePose(id, { x: 2 });
    settle();

    useStore.getState().undo();
    expect(useStore.getState().sensors[0].pose.x).toBe(1);
    useStore.getState().undo();
    expect(useStore.getState().sensors[0].pose.x).toBe(startX);
  });

  it('walks back a delete', () => {
    const id = useStore.getState().addSensor();
    settle();
    useStore.getState().removeSensor(id);
    settle();
    expect(useStore.getState().sensors).toHaveLength(0);

    useStore.getState().undo();
    expect(useStore.getState().sensors).toHaveLength(1);
    expect(useStore.getState().sensors[0].id).toBe(id);
  });

  it('walks back a Reset, which is the one that would really hurt', () => {
    useStore.getState().addSensor();
    settle();
    useStore.getState().addSensor();
    settle();
    useStore.getState().clearSensors();
    settle();
    expect(useStore.getState().sensors).toHaveLength(0);

    useStore.getState().undo();
    expect(useStore.getState().sensors).toHaveLength(2);
  });

  it('covers vehicle dimensions too', () => {
    useStore.getState().setVehicle({ length: 7.5 });
    settle();
    useStore.getState().undo();
    expect(useStore.getState().vehicle.length).toBe(DEFAULT_VEHICLE.length);
  });

  it('drops the redo stack once a new edit lands', () => {
    useStore.getState().addSensor();
    settle();
    useStore.getState().undo();
    expect(useStore.getState().canRedo).toBe(true);

    useStore.getState().addSensor();
    settle();
    expect(useStore.getState().canRedo).toBe(false);
  });

  it('clears a selection that the restored layout never had', () => {
    const id = useStore.getState().addSensor();
    settle();
    expect(useStore.getState().selectedId).toBe(id);

    useStore.getState().undo();
    expect(useStore.getState().selectedId).toBeNull();
  });

  it('does not record its own writes, so undo does not become a toggle', () => {
    useStore.getState().addSensor();
    settle();
    useStore.getState().addSensor();
    settle();

    useStore.getState().undo();
    useStore.getState().undo();
    expect(useStore.getState().sensors).toHaveLength(0);
    expect(useStore.getState().canUndo).toBe(false);
  });
});
