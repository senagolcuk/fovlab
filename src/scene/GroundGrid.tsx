import { useMemo } from 'react';
import * as THREE from 'three';

/** 1 m lines out to here, 10 m lines beyond. A 1 m grid at 200 m is noise, not information. */
const FINE_HALF = 25;
const COARSE_HALF = 100;
const MAJOR_EVERY = 10;

/** Ground grid on z = 0, with a heavier line every 10 m and the X and Y axes picked out. */
export default function GroundGrid({ visible }: { visible: boolean }) {
  const { minor, major, axes } = useMemo(() => {
    const minorPts: number[] = [];
    const majorPts: number[] = [];

    for (let i = -FINE_HALF; i <= FINE_HALF; i++) {
      if (i === 0 || i % MAJOR_EVERY === 0) continue;
      minorPts.push(i, -FINE_HALF, 0, i, FINE_HALF, 0);
      minorPts.push(-FINE_HALF, i, 0, FINE_HALF, i, 0);
    }

    for (let i = -COARSE_HALF; i <= COARSE_HALF; i += MAJOR_EVERY) {
      if (i === 0) continue;
      majorPts.push(i, -COARSE_HALF, 0, i, COARSE_HALF, 0);
      majorPts.push(-COARSE_HALF, i, 0, COARSE_HALF, i, 0);
    }

    const axisPts = [-COARSE_HALF, 0, 0, COARSE_HALF, 0, 0, 0, -COARSE_HALF, 0, 0, COARSE_HALF, 0];

    const build = (pts: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      return g;
    };

    return { minor: build(minorPts), major: build(majorPts), axes: build(axisPts) };
  }, []);

  if (!visible) return null;

  return (
    <group renderOrder={-1}>
      <lineSegments geometry={minor}>
        <lineBasicMaterial color="#DCD6E0" transparent opacity={0.8} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={major}>
        <lineBasicMaterial color="#B6ADBF" depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={axes}>
        <lineBasicMaterial color="#8A7F95" depthWrite={false} />
      </lineSegments>
    </group>
  );
}
