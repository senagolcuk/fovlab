/**
 * One camera per pane, installed as that view's default camera.
 *
 * The orthographic frustum is left to drei's `<View>`, which sets left/right/top/bottom to the
 * pane's pixel half-dimensions every frame. That makes `camera.zoom` exactly pixels per metre,
 * which is what every pan and zoom gesture is written against.
 */

import { useLayoutEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store/useStore';
import {
  ISO_FOV,
  ORTHO_DEFS,
  ORTHO_DISTANCE,
  isoCameraPosition,
  isoCameraQuaternion,
  orthoCameraPosition,
  type OrthoName,
} from './views';

export function OrthoCamera({ name }: { name: OrthoName }) {
  const def = ORTHO_DEFS[name];
  const view = useStore((s) => s.views[name]);
  const set = useThree((s) => s.set);

  const camera = useMemo(
    () => new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, ORTHO_DISTANCE * 2),
    [],
  );

  useLayoutEffect(() => {
    set({ camera });
  }, [camera, set]);

  useLayoutEffect(() => {
    camera.up.copy(def.up);
    camera.quaternion.copy(def.quaternion);
    camera.position.copy(orthoCameraPosition(def, view));
    camera.zoom = view.zoom;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }, [camera, def, view]);

  return null;
}

export function IsoCamera() {
  const view = useStore((s) => s.views.ISO);
  const set = useThree((s) => s.set);

  const camera = useMemo(() => new THREE.PerspectiveCamera(ISO_FOV, 1, 0.05, 4000), []);

  useLayoutEffect(() => {
    set({ camera });
  }, [camera, set]);

  useLayoutEffect(() => {
    const position = isoCameraPosition(view);
    camera.up.set(0, 0, 1);
    camera.position.copy(position);
    camera.quaternion.copy(isoCameraQuaternion(position, view.target));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }, [camera, view]);

  return null;
}
