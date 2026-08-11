import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_VEHICLE } from '../persist';
import { useStore } from '../useStore';

beforeEach(() => {
  useStore.setState({
    vehicle: DEFAULT_VEHICLE,
    sensors: [],
    selectedId: null,
    pendingDeleteId: null,
    askBeforeDelete: true,
    dragMode: 'off',
  });
});

describe('delete prompt', () => {
  it('asks rather than deleting while the prompt is on', () => {
    const id = useStore.getState().addSensor();
    useStore.getState().requestDeleteSensor(id);
    expect(useStore.getState().pendingDeleteId).toBe(id);
    expect(useStore.getState().sensors).toHaveLength(1);
  });

  it('deletes on confirm and keeps asking next time', () => {
    const id = useStore.getState().addSensor();
    useStore.getState().requestDeleteSensor(id);
    useStore.getState().confirmPendingDelete(false);
    expect(useStore.getState().sensors).toHaveLength(0);
    expect(useStore.getState().pendingDeleteId).toBeNull();
    expect(useStore.getState().askBeforeDelete).toBe(true);
  });

  it('keeps the sensor on cancel', () => {
    const id = useStore.getState().addSensor();
    useStore.getState().requestDeleteSensor(id);
    useStore.getState().cancelPendingDelete();
    expect(useStore.getState().sensors).toHaveLength(1);
    expect(useStore.getState().pendingDeleteId).toBeNull();
  });

  it('stops asking once the box is ticked, and deletes outright from then on', () => {
    const a = useStore.getState().addSensor();
    useStore.getState().requestDeleteSensor(a);
    useStore.getState().confirmPendingDelete(true);
    expect(useStore.getState().askBeforeDelete).toBe(false);

    const b = useStore.getState().addSensor();
    useStore.getState().requestDeleteSensor(b);
    expect(useStore.getState().pendingDeleteId).toBeNull();
    expect(useStore.getState().sensors).toHaveLength(0);
  });

  it('ignores a delete aimed at a sensor that is already gone', () => {
    const id = useStore.getState().addSensor();
    useStore.getState().removeSensor(id);
    useStore.getState().requestDeleteSensor(id);
    expect(useStore.getState().pendingDeleteId).toBeNull();
  });

  it('drops a pending prompt when the whole layout is reset', () => {
    const id = useStore.getState().addSensor();
    useStore.getState().requestDeleteSensor(id);
    useStore.getState().clearSensors();
    expect(useStore.getState().pendingDeleteId).toBeNull();
    expect(useStore.getState().sensors).toHaveLength(0);
  });
});
