import { afterEach, describe, expect, it } from 'vitest';
import { gizmoHandleUnderPointer, registerGizmoControls } from '../gizmoHandle';

afterEach(() => registerGizmoControls(null));

describe('gizmo handle arbitration', () => {
  it('lets the orbit through when there is no gizmo', () => {
    expect(gizmoHandleUnderPointer()).toBe(false);
  });

  it('lets the orbit through when the gizmo is idle', () => {
    registerGizmoControls({ axis: null, dragging: false });
    expect(gizmoHandleUnderPointer()).toBe(false);
  });

  it('stands the orbit down while a handle is hovered', () => {
    registerGizmoControls({ axis: 'X', dragging: false });
    expect(gizmoHandleUnderPointer()).toBe(true);
  });

  it('stands the orbit down for the whole drag, even once the axis clears', () => {
    registerGizmoControls({ axis: null, dragging: true });
    expect(gizmoHandleUnderPointer()).toBe(true);
  });

  it('releases the orbit again when the gizmo unmounts', () => {
    registerGizmoControls({ axis: 'Y', dragging: true });
    registerGizmoControls(null);
    expect(gizmoHandleUnderPointer()).toBe(false);
  });
});
