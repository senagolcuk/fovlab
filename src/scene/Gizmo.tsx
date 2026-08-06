/**
 * The move / rotate gizmo in the ISO pane.
 *
 * `TransformControls` drives a proxy object rather than the sensor itself, and every change is
 * written back through `updatePose` so the numeric fields track the drag live. Translation
 * snaps to the vehicle body the same way the TOP drag does, with Alt to suppress it.
 */

import { useEffect, useLayoutEffect, useRef } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { anglesFromMatrix, yawPitchFromDirection } from '../core/rotation';
import { rotationMatrix } from '../core/rotation';
import { snapToBody } from '../core/snap';
import type { Mat3, Pose, Vec3 } from '../core/types';
import { useStore } from '../store/useStore';

function matrixFromPose(pose: Pose): THREE.Matrix4 {
  const R = rotationMatrix(pose.yaw, pose.pitch, pose.roll);
  // Matrix4.set takes its arguments row by row, which is how core stores them.
  return new THREE.Matrix4().set(
    R[0][0], R[0][1], R[0][2], 0,
    R[1][0], R[1][1], R[1][2], 0,
    R[2][0], R[2][1], R[2][2], 0,
    0, 0, 0, 1,
  );
}

function mat3FromObject(object: THREE.Object3D): Mat3 {
  const m = new THREE.Matrix4().makeRotationFromQuaternion(object.quaternion);
  const e = m.elements; // column-major
  return [
    [e[0], e[4], e[8]],
    [e[1], e[5], e[9]],
    [e[2], e[6], e[10]],
  ];
}

export default function Gizmo() {
  const dragMode = useStore((s) => s.dragMode);
  const selectedId = useStore((s) => s.selectedId);
  const sensor = useStore((s) => s.sensors.find((x) => x.id === s.selectedId) ?? null);
  const setGizmoDragging = useStore((s) => s.setGizmoDragging);

  const proxy = useRef<THREE.Object3D>(new THREE.Object3D());
  const dragging = useRef(false);
  const altHeld = useRef(false);

  // TransformControls hands back an orientation, not the modifier keys that produced it.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Alt') altHeld.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Alt') altHeld.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const pose = sensor?.pose;

  useLayoutEffect(() => {
    // While dragging, the gizmo is the authority; pushing the store value back would fight it.
    if (!proxy.current || !pose || dragging.current) return;
    proxy.current.position.set(pose.x, pose.y, pose.z);
    proxy.current.quaternion.setFromRotationMatrix(matrixFromPose(pose));
    proxy.current.updateMatrixWorld();
  }, [pose?.x, pose?.y, pose?.z, pose?.yaw, pose?.pitch, pose?.roll, dragMode]);

  useEffect(() => () => setGizmoDragging(false), [setGizmoDragging]);

  if (!sensor || !sensor.visible || dragMode === 'off') return null;

  const onObjectChange = () => {
    const object = proxy.current;
    if (!object) return;
    const state = useStore.getState();

    if (dragMode === 'rotate') {
      const { yaw, pitch, roll } = anglesFromMatrix(mat3FromObject(object));
      state.updatePose(sensor.id, { yaw, pitch, roll });
      return;
    }

    const target: Vec3 = [object.position.x, object.position.y, object.position.z];
    const hit = altHeld.current ? null : snapToBody(target, state.vehicle);
    if (!hit) {
      state.updatePose(sensor.id, { x: target[0], y: target[1], z: target[2] });
      return;
    }

    const { yaw, pitch } = yawPitchFromDirection(hit.normal);
    state.updatePose(sensor.id, {
      x: hit.position[0],
      y: hit.position[1],
      z: hit.position[2],
      yaw,
      pitch,
    });
  };

  return (
    <>
      <primitive object={proxy.current} />
      <TransformControls
        key={selectedId ?? 'none'}
        object={proxy}
        mode={dragMode}
        size={0.8}
        onObjectChange={onObjectChange}
        onMouseDown={() => {
          dragging.current = true;
          setGizmoDragging(true);
        }}
        onMouseUp={() => {
          dragging.current = false;
          setGizmoDragging(false);
        }}
      />
    </>
  );
}
