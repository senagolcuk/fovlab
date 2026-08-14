/**
 * Every visible sensor's FOV drawn as one volume.
 *
 * Nothing about the geometry changes: each sensor keeps its own pose, angles and range, and the
 * merged draw covers exactly the space the separate draws did. What changes is the shading —
 * where two volumes overlap the colour stops compounding, so the coverage reads as one shape
 * rather than a stack of translucent shells.
 *
 * The union is done in the depth buffer, not with a mesh boolean. A depth-only pass records the
 * nearest surface per pixel; the colour pass then draws only fragments at exactly that depth. One
 * layer of colour per pixel, whatever the overlaps — and it costs a second draw call rather than a
 * CSG solve, so twenty sensors stay interactive.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { effectiveSpec } from '../core/catalog';
import { clampSpec } from '../core/frustum';
import type { RangeMode, SensorInstance, SensorSpec } from '../core/types';
import type { DisplayOptions } from '../store/useStore';
import { PALETTE } from '../theme';
import {
  FOOTPRINT_STEP,
  GROUND_LIFT,
  concatIndexed,
  fovBuffers,
  toBufferGeometry,
  type IndexedGeometry,
} from './fovGeometry';

/**
 * One colour, because it is one shape. The house blue rather than a sensor colour: nothing in the
 * merged volume belongs to any single sensor, and borrowing one sensor's colour would say it did.
 */
export const MERGE_COLOR = PALETTE.blue;

/**
 * One layer of colour over a whole set, whatever the overlaps.
 *
 * A depth-only pass records the nearest surface per pixel; the colour pass then paints only
 * fragments at exactly that depth. `transparent` on the depth pass is not for blending — it is
 * what puts both draws in the same render list, so `renderOrder` decides their sequence. Left
 * opaque, three would run every pre-pass before any colour pass and the depth references would
 * trample each other.
 */
function UnionLayer({
  geometry,
  color,
  opacity,
  renderOrder,
  side,
  clip,
}: {
  geometry: THREE.BufferGeometry;
  color: string;
  opacity: number;
  renderOrder: number;
  side: THREE.Side;
  clip: THREE.Plane[] | null;
}) {
  return (
    <>
      <mesh geometry={geometry} renderOrder={renderOrder}>
        <meshBasicMaterial
          colorWrite={false}
          transparent
          depthWrite
          side={side}
          clippingPlanes={clip}
        />
      </mesh>
      <mesh geometry={geometry} renderOrder={renderOrder + 1}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          depthWrite={false}
          // Only the surface the pre-pass recorded as nearest gets to paint.
          depthFunc={THREE.EqualDepth}
          side={side}
          clippingPlanes={clip}
        />
      </mesh>
    </>
  );
}

/**
 * The merged volume: far surface, then near surface.
 *
 * Two layers rather than one, because that is what a single FOV already looks like — its shell is
 * drawn double-sided, so you see where the volume ends as well as where it starts. Collapsing to
 * one layer made a lone sensor change appearance the moment the merge was switched on, which is
 * exactly what a merge must not do. Two passes also cap the depth: N overlapping volumes still
 * paint twice, never N times.
 *
 * Order matters. The far pass runs first and leaves the nearest back face in the depth buffer;
 * the near pass then overwrites it, because a front face is always nearer. Reversed, the near
 * surface's depth would still be sitting there and the far pass would find nothing to match.
 */
function UnionVolume({
  geometry,
  opacity,
  renderOrder,
  clip,
}: {
  geometry: THREE.BufferGeometry;
  opacity: number;
  renderOrder: number;
  clip: THREE.Plane[] | null;
}) {
  return (
    <>
      <UnionLayer
        geometry={geometry}
        color={MERGE_COLOR}
        opacity={opacity}
        renderOrder={renderOrder}
        side={THREE.BackSide}
        clip={clip}
      />
      <UnionLayer
        geometry={geometry}
        color={MERGE_COLOR}
        opacity={opacity}
        renderOrder={renderOrder + 2}
        side={THREE.FrontSide}
        clip={clip}
      />
    </>
  );
}

export default function MergedFov({
  sensors,
  catalog,
  display,
  rangeMode,
  clip,
}: {
  sensors: SensorInstance[];
  catalog: SensorSpec[];
  display: DisplayOptions;
  rangeMode: RangeMode;
  clip: THREE.Plane[] | null;
}) {
  const geometry = useMemo(() => {
    const volumes: IndexedGeometry[] = [];
    const footprints: IndexedGeometry[] = [];

    let index = 0;
    for (const sensor of sensors) {
      if (!sensor.visible) continue;
      const spec = clampSpec(effectiveSpec(sensor, catalog));
      // Each footprint sits a hair above the last, so the nearest-surface test can tell coplanar
      // ones apart. See FOOTPRINT_STEP.
      const buffers = fovBuffers(
        sensor.pose,
        spec,
        rangeMode,
        GROUND_LIFT + index * FOOTPRINT_STEP,
      );
      volumes.push({ positions: buffers.positions, indices: buffers.triangles });
      if (buffers.footprint) footprints.push(buffers.footprint);
      index += 1;
    }

    return {
      volume: volumes.length ? toBufferGeometry(concatIndexed(volumes)) : null,
      ground: footprints.length ? toBufferGeometry(concatIndexed(footprints)) : null,
    };
  }, [sensors, catalog, rangeMode]);

  useEffect(
    () => () => {
      geometry.volume?.dispose();
      geometry.ground?.dispose();
    },
    [geometry],
  );

  return (
    <>
      {display.volume && geometry.volume && (
        <UnionVolume
          geometry={geometry.volume}
          opacity={Math.min(display.opacity, 0.85)}
          renderOrder={3}
          clip={clip}
        />
      )}

      {/* Closes the cut the ground clip leaves open, exactly as the per-sensor drawing does. */}
      {!display.belowGround && geometry.ground && (
        <UnionLayer
          geometry={geometry.ground}
          color={MERGE_COLOR}
          opacity={Math.min(display.opacity * 1.9, 0.92)}
          renderOrder={1}
          side={THREE.DoubleSide}
          clip={null}
        />
      )}
    </>
  );
}
