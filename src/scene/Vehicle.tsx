import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Vehicle } from '../core/types';

const TYRE_WIDTH = 0.22;

/**
 * The vehicle box, its edges, four wheels and a nose marker on the ground.
 *
 * A three.js cylinder already runs along its local Y, which is vehicle-left here, so a wheel
 * needs no rotation at all.
 */
export default function VehicleBody({
  vehicle,
  wheels,
}: {
  vehicle: Vehicle;
  wheels: boolean;
}) {
  const { length, width, height, clearance, wheelbase, wheelRadius } = vehicle;
  const centreZ = clearance + height / 2;

  const edges = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(length, width, height)),
    [length, width, height],
  );

  const nose = useMemo(() => {
    const x0 = length / 2 + 0.12;
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [x0, 0.28, 0.002, x0 + 0.5, 0, 0.002, x0, -0.28, 0.002],
        3,
      ),
    );
    return g;
  }, [length]);

  useEffect(() => () => edges.dispose(), [edges]);
  useEffect(() => () => nose.dispose(), [nose]);

  const wheelPositions = useMemo(() => {
    const x = wheelbase / 2;
    const y = width / 2 - TYRE_WIDTH / 2;
    return [
      [x, y],
      [x, -y],
      [-x, y],
      [-x, -y],
    ] as Array<[number, number]>;
  }, [wheelbase, width]);

  return (
    <group>
      <mesh position={[0, 0, centreZ]}>
        <boxGeometry args={[length, width, height]} />
        <meshBasicMaterial
          color="#CFC7D6"
          transparent
          opacity={0.35}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <lineSegments geometry={edges} position={[0, 0, centreZ]}>
        <lineBasicMaterial color="#4A4458" />
      </lineSegments>

      <mesh geometry={nose}>
        <meshBasicMaterial color="#6750A4" side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {wheels &&
        wheelPositions.map(([x, y]) => (
          <mesh key={`${x},${y}`} position={[x, y, wheelRadius]}>
            <cylinderGeometry args={[wheelRadius, wheelRadius, TYRE_WIDTH, 24]} />
            <meshBasicMaterial color="#49454F" transparent opacity={0.55} />
          </mesh>
        ))}
    </group>
  );
}
