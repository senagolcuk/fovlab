import { useMemo } from 'react';
import * as THREE from 'three';
import { effectiveSpec } from '../core/catalog';
import { clampSpec, FRUSTUM_EDGES, FRUSTUM_TRIANGLES, frustum, opticalAxis } from '../core/frustum';
import { groundPolygon } from '../core/ground';
import type { SensorInstance, SensorSpec } from '../core/types';
import type { DisplayOptions } from '../store/useStore';

/** Lifted off the ground plane just enough to beat the grid in the depth test. */
const GROUND_LIFT = 0.005;
const MARKER_SIZE = 0.09;

function flatten(vertices: ReadonlyArray<readonly [number, number, number]>): number[] {
  const out: number[] = [];
  for (const v of vertices) out.push(v[0], v[1], v[2]);
  return out;
}

export default function SensorFov({
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
    const f = frustum(pose, spec);
    const positions = flatten(f.vertices);

    const volume = new THREE.BufferGeometry();
    volume.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    volume.setIndex(FRUSTUM_TRIANGLES.flatMap((t) => [t[0], t[1], t[2]]));
    volume.computeVertexNormals();

    const edges = new THREE.BufferGeometry();
    edges.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    edges.setIndex(FRUSTUM_EDGES.flatMap((e) => [e[0], e[1]]));

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

    const poly = groundPolygon(f);
    let ground: THREE.BufferGeometry | null = null;
    let outline: THREE.BufferGeometry | null = null;

    if (poly) {
      const flat: number[] = [];
      for (const [x, y] of poly) flat.push(x, y, GROUND_LIFT);

      outline = new THREE.BufferGeometry();
      outline.setAttribute('position', new THREE.Float32BufferAttribute(flat, 3));

      ground = new THREE.BufferGeometry();
      ground.setAttribute('position', new THREE.Float32BufferAttribute(flat, 3));
      const index: number[] = [];
      for (let i = 1; i < poly.length - 1; i++) index.push(0, i, i + 1);
      ground.setIndex(index);
    }

    return { volume, edges, axis, ground, outline };
  }, [pose.x, pose.y, pose.z, pose.yaw, pose.pitch, pose.roll, spec.hfov, spec.vfov, spec.range]);

  if (!sensor.visible) return null;

  const opacity = display.opacity * (selected ? 1.25 : 1);

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
          />
        </lineSegments>
      )}

      {display.axis && (
        <lineSegments geometry={geometry.axis} renderOrder={3}>
          <lineBasicMaterial color={sensor.color} depthWrite={false} />
        </lineSegments>
      )}

      {display.ground && geometry.ground && (
        <mesh geometry={geometry.ground} renderOrder={1}>
          <meshBasicMaterial
            color={sensor.color}
            transparent
            opacity={Math.min(opacity * 1.4, 0.9)}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {display.ground && geometry.outline && (
        <lineLoop geometry={geometry.outline} renderOrder={4}>
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
