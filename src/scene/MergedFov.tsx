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
 * How far behind itself the depth pass writes, in depth units.
 *
 * Testing the colour pass for depth *equality* looks right and is not: a fragment on a shared
 * triangle edge can be rasterised by either neighbour, and the two interpolate depth to values
 * that differ in the last bit. The equality then fails and the seam goes unpainted — which on a
 * triangle fan draws every spoke as a visible ray from the apex. Nudging the recorded depth just
 * behind the surface and testing `less` instead accepts the whole surface and still rejects
 * anything genuinely further back.
 */
const DEPTH_BIAS = 1;
/**
 * Slope scaling stays off. It is what a shadow map wants, but here it over-biases exactly the
 * polygons that are steepest in view — a lateral face seen edge-on — until the surface behind
 * passes the test too and the fold paints twice. The tie being broken is a last-bit one, so a
 * constant is the whole of it.
 */
const DEPTH_BIAS_SLOPE = 0;

/**
 * One layer of colour over a whole set, whatever the overlaps.
 *
 * A depth-only pass records the nearest surface per pixel; the colour pass then paints only
 * fragments at that depth. `transparent` on the depth pass is not for blending — it is what puts
 * both draws in the same render list, so `renderOrder` decides their sequence. Left opaque, three
 * would run every pre-pass before any colour pass and the depth references would trample each
 * other.
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
          polygonOffset
          polygonOffsetFactor={DEPTH_BIAS_SLOPE}
          polygonOffsetUnits={DEPTH_BIAS}
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
          // Only the surface the pre-pass recorded as nearest gets to paint; the bias is what
          // keeps that from turning into a per-triangle-edge test.
          depthFunc={THREE.LessDepth}
          side={side}
          clippingPlanes={clip}
        />
      </mesh>
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
        <UnionLayer
          geometry={geometry.volume}
          color={MERGE_COLOR}
          opacity={Math.min(display.opacity, 0.85)}
          renderOrder={3}
          side={THREE.DoubleSide}
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
