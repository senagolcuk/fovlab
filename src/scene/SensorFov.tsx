import { memo, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { effectiveSpec } from '../core/catalog';
import { clampSpec, opticalAxis } from '../core/frustum';
import { LAYER } from './layers';
import type { SensorInstance, SensorSpec } from '../core/types';
import type { DisplayOptions } from '../store/useStore';
import { fovBuffers, toBufferGeometry } from './fovGeometry';

const MARKER_SIZE = 0.09;

/**
 * Keeps the volume at or above the ground. A shader clip rather than a geometry cut: the solid
 * stays one convex polyhedron, so the ground section and every number derived from it are
 * untouched by what is merely hidden.
 */
const GROUND_PLANE = [new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)];

function SensorFov({
  sensor,
  catalog,
  display,
  selected,
}: {
  sensor: SensorInstance;
  catalog: SensorSpec[];
  display: DisplayOptions;
  selected: boolean;
}) {
  const spec = useMemo(
    () => clampSpec(effectiveSpec(sensor, catalog)),
    [sensor.specId, sensor.custom, sensor.override, catalog],
  );

  const pose = sensor.pose;

  const geometry = useMemo(() => {
    const buffers = fovBuffers(pose, spec);

    const volume = new THREE.BufferGeometry();
    volume.setAttribute('position', new THREE.Float32BufferAttribute(buffers.positions, 3));
    volume.setIndex(buffers.triangles);
    volume.computeVertexNormals();

    const edges = new THREE.BufferGeometry();
    edges.setAttribute('position', new THREE.Float32BufferAttribute(buffers.positions, 3));
    edges.setIndex(buffers.outline);

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
    let ground: THREE.BufferGeometry | null = null;
    let footprint: THREE.BufferGeometry | null = null;

    if (buffers.footprint) {
      ground = toBufferGeometry(buffers.footprint);
      footprint = new THREE.BufferGeometry();
      footprint.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(buffers.footprint.positions, 3),
      );
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
   * While merged, `MergedFov` draws the volume, the footprint and nothing else. The per-sensor
   * shell, its silhouette and its outline would each betray the individual frusta the merge
   * exists to hide, so they stand down. The marker and the optical axis stay: they belong to the
   * sensor rather than to its field of view, and they are how one is still picked out by colour.
   */
  const merged = display.mergeFovs;
  /**
   * `null`, never `undefined`. three guards local clipping with `planes === null`, so an
   * `undefined` slips past it and the renderer then reads `undefined.length` — which throws
   * inside the render loop and takes the whole volume off screen.
   */
  const clip = display.belowGround ? null : GROUND_PLANE;

  return (
    <group>
      {display.volume && !merged && (
        <mesh geometry={geometry.volume} renderOrder={LAYER.FOV_VOLUME}>
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

      {display.edges && !merged && (
        <lineSegments geometry={geometry.edges} renderOrder={LAYER.FOV_EDGES}>
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
        <lineSegments geometry={geometry.axis} renderOrder={LAYER.FOV_EDGES}>
          <lineBasicMaterial
            color={sensor.color}
            depthWrite={false}
            depthTest={!merged}
            clippingPlanes={clip}
          />
        </lineSegments>
      )}

      {!display.belowGround && !merged && geometry.ground && (
        <mesh geometry={geometry.ground} renderOrder={LAYER.FOV_FOOTPRINT}>
          <meshBasicMaterial
            color={sensor.color}
            transparent
            opacity={Math.min(opacity * 1.9, 0.92)}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {!display.belowGround && !merged && geometry.footprint && (
        <lineLoop geometry={geometry.footprint} renderOrder={LAYER.FOV_OUTLINE}>
          <lineBasicMaterial color={sensor.color} depthWrite={false} />
        </lineLoop>
      )}

      <mesh position={[pose.x, pose.y, pose.z]} renderOrder={LAYER.SENSOR_MARKER}>
        <boxGeometry args={[MARKER_SIZE, MARKER_SIZE, MARKER_SIZE]} />
        {/*
          An opaque marker sits in the depth-tested pass, which is drawn before every translucent
          surface and so ends up under them. `transparent` joins the same list, where the layer
          order puts it back on top, crisp rather than tinted.
        */}
        <meshBasicMaterial
          color={selected ? '#1D1B20' : sensor.color}
          transparent
          depthTest={false}
        />
      </mesh>

      {selected && (
        <mesh position={[pose.x, pose.y, pose.z]} renderOrder={LAYER.SENSOR_MARKER_SELECTION}>
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
