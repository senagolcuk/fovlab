import { memo, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { effectiveSpec } from '../core/catalog';
import { clampSpec, frustum, opticalAxis } from '../core/frustum';
import { groundPolygon } from '../core/ground';
import type { SensorInstance, SensorSpec } from '../core/types';
import type { RangeMode } from '../core/types';
import type { DisplayOptions } from '../store/useStore';

const MARKER_SIZE = 0.09;
/** Lifted off the ground plane just enough to beat the grid in the depth test. */
const GROUND_LIFT = 0.005;

/**
 * Keeps the volume at or above the ground. A shader clip rather than a geometry cut: the solid
 * stays one convex polyhedron, so the ground section and every number derived from it are
 * untouched by what is merely hidden.
 */
const GROUND_PLANE = [new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)];

function flatten(vertices: ReadonlyArray<readonly [number, number, number]>): number[] {
  const out: number[] = [];
  for (const v of vertices) out.push(v[0], v[1], v[2]);
  return out;
}

function SensorFov({
  sensor,
  catalog,
  display,
  rangeMode,
  selected,
}: {
  sensor: SensorInstance;
  catalog: SensorSpec[];
  display: DisplayOptions;
  rangeMode: RangeMode;
  selected: boolean;
}) {
  const spec = useMemo(
    () => clampSpec(effectiveSpec(sensor, catalog)),
    [sensor.specId, sensor.custom, sensor.override, catalog],
  );

  const pose = sensor.pose;

  const geometry = useMemo(() => {
    const f = frustum(pose, spec, rangeMode);
    const positions = flatten(f.vertices);

    const volume = new THREE.BufferGeometry();
    volume.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    volume.setIndex(f.triangles.flatMap((t) => [t[0], t[1], t[2]]));
    volume.computeVertexNormals();

    const edges = new THREE.BufferGeometry();
    edges.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    edges.setIndex(f.outline.flatMap((e) => [e[0], e[1]]));

    const axisDir = opticalAxis(pose);
    const axis = new THREE.BufferGeometry();
    axis.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          pose.x,
          pose.y,
          pose.z,
          pose.x + axisDir[0] * spec.range,
          pose.y + axisDir[1] * spec.range,
          pose.z + axisDir[2] * spec.range,
        ],
        3,
      ),
    );

    /**
     * The footprint. Clipping the volume at the ground leaves the cut open, so you look straight
     * through the shell into the grid; this closes it. Only drawn when the clip is on, since with
     * the volume carrying on below ground there is no cut to cover.
     */
    const poly = groundPolygon(f);
    let ground: THREE.BufferGeometry | null = null;
    let footprint: THREE.BufferGeometry | null = null;

    if (poly) {
      const flat: number[] = [];
      for (const [x, y] of poly) flat.push(x, y, GROUND_LIFT);

      footprint = new THREE.BufferGeometry();
      footprint.setAttribute('position', new THREE.Float32BufferAttribute(flat, 3));

      ground = new THREE.BufferGeometry();
      ground.setAttribute('position', new THREE.Float32BufferAttribute(flat, 3));
      const index: number[] = [];
      for (let i = 1; i < poly.length - 1; i++) index.push(0, i, i + 1);
      ground.setIndex(index);
    }

    return { volume, edges, axis, ground, footprint };
  }, [
    pose.x,
    pose.y,
    pose.z,
    pose.yaw,
    pose.pitch,
    pose.roll,
    spec.hfov,
    spec.vfov,
    spec.range,
    rangeMode,
  ]);

  /**
   * A pose changes on every frame of a drag, so this rebuilds constantly. r3f only disposes
   * objects it created itself; geometry handed to it as a prop is ours to clean up, and
   * leaking one buffer set per frame would empty the GPU during a long drag.
   */
  useEffect(
    () => () => {
      for (const g of Object.values(geometry)) g?.dispose();
    },
    [geometry],
  );

  if (!sensor.visible) return null;

  const opacity = display.opacity * (selected ? 1.25 : 1);
  /**
   * `null`, never `undefined`. three guards local clipping with `planes === null`, so an
   * `undefined` slips past it and the renderer then reads `undefined.length` — which throws
   * inside the render loop and takes the whole volume off screen.
   */
  const clip = display.belowGround ? null : GROUND_PLANE;

  return (
    <group>
      {display.volume && (
        <mesh geometry={geometry.volume} renderOrder={2}>
          <meshBasicMaterial
            color={sensor.color}
            transparent
            opacity={Math.min(opacity, 0.85)}
            depthWrite={false}
            side={THREE.DoubleSide}
            clippingPlanes={clip}
          />
        </mesh>
      )}

      {display.edges && (
        <lineSegments geometry={geometry.edges} renderOrder={3}>
          <lineBasicMaterial
            color={sensor.color}
            transparent
            opacity={selected ? 1 : 0.75}
            depthWrite={false}
            clippingPlanes={clip}
          />
        </lineSegments>
      )}

      {display.axis && (
        <lineSegments geometry={geometry.axis} renderOrder={3}>
          <lineBasicMaterial color={sensor.color} depthWrite={false} clippingPlanes={clip} />
        </lineSegments>
      )}

      {!display.belowGround && geometry.ground && (
        <mesh geometry={geometry.ground} renderOrder={1}>
          <meshBasicMaterial
            color={sensor.color}
            transparent
            opacity={Math.min(opacity * 1.9, 0.92)}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {!display.belowGround && geometry.footprint && (
        <lineLoop geometry={geometry.footprint} renderOrder={4}>
          <lineBasicMaterial color={sensor.color} depthWrite={false} />
        </lineLoop>
      )}

      <mesh position={[pose.x, pose.y, pose.z]} renderOrder={5}>
        <boxGeometry args={[MARKER_SIZE, MARKER_SIZE, MARKER_SIZE]} />
        <meshBasicMaterial color={selected ? '#1D1B20' : sensor.color} />
      </mesh>

      {selected && (
        <mesh position={[pose.x, pose.y, pose.z]} renderOrder={6}>
          <boxGeometry args={[MARKER_SIZE * 2.1, MARKER_SIZE * 2.1, MARKER_SIZE * 2.1]} />
          <meshBasicMaterial color={sensor.color} wireframe depthTest={false} />
        </mesh>
      )}
    </group>
  );
}

/**
 * `updatePose` replaces only the sensor it touches, so every other instance keeps its identity
 * and skips the render entirely. That is what keeps a drag cheap with twenty sensors across
 * four panes.
 */
export default memo(SensorFov);
