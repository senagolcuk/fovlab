import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { SensorInstance, Vec3, Vehicle } from '../../core/types';
import {
  ISO_FOV,
  ORTHO_DEFS,
  fitIso,
  fitOrtho,
  isoCameraPosition,
  isoCameraQuaternion,
  orthoPaneDeltaToWorld,
  orthoWorldToPane,
  projectToIsoPane,
  sceneBounds,
} from '../views';

const vehicle: Vehicle = {
  length: 4.8,
  width: 1.9,
  height: 1.5,
  clearance: 0.2,
  wheelbase: 2.8,
  wheelRadius: 0.34,
};

describe('orthographic pane bases', () => {
  it('is right-handed for every pane, so nothing renders mirrored', () => {
    for (const [name, def] of Object.entries(ORTHO_DEFS)) {
      const cross = new THREE.Vector3().crossVectors(def.up, def.normal);
      expect(cross.distanceTo(def.right)).toBeLessThan(1e-9);
      expect(def.right.length()).toBeCloseTo(1, 9);
      expect(name).toBeTruthy();
    }
  });

  it('puts the nose up the screen and the vehicle right on the right, in TOP', () => {
    // Screen-right is -Y, so a point on the vehicle's right (-Y) lands right of centre.
    expect(ORTHO_DEFS.TOP.up.toArray()).toEqual([1, 0, 0]);
    expect(ORTHO_DEFS.TOP.right.toArray()).toEqual([0, -1, 0]);
  });

  it('puts the vehicle left on the right, in FRONT', () => {
    expect(ORTHO_DEFS.FRONT.right.toArray()).toEqual([0, 1, 0]);
    expect(ORTHO_DEFS.FRONT.up.toArray()).toEqual([0, 0, 1]);
  });

  it('points the nose screen-left, in LEFT', () => {
    expect(ORTHO_DEFS.LEFT.right.toArray()).toEqual([-1, 0, 0]);
    expect(ORTHO_DEFS.LEFT.up.toArray()).toEqual([0, 0, 1]);
  });

  it('orients the camera so its local axes match the pane basis', () => {
    for (const def of Object.values(ORTHO_DEFS)) {
      const m = new THREE.Matrix4().makeRotationFromQuaternion(def.quaternion);
      const x = new THREE.Vector3().setFromMatrixColumn(m, 0);
      const y = new THREE.Vector3().setFromMatrixColumn(m, 1);
      expect(x.distanceTo(def.right)).toBeLessThan(1e-9);
      expect(y.distanceTo(def.up)).toBeLessThan(1e-9);
    }
  });
});

describe('fitOrtho', () => {
  const box: Vec3[] = [
    [-5, -2, 0],
    [5, 2, 0],
  ];

  it('centres the bounding box in the pane', () => {
    const fit = fitOrtho(ORTHO_DEFS.TOP, box, 600, 400)!;
    expect(fit.pan[0]).toBeCloseTo(0, 9); // along -Y
    expect(fit.pan[1]).toBeCloseTo(0, 9); // along +X
  });

  it('keeps an off-centre box fully inside the pane', () => {
    const shifted: Vec3[] = [
      [10, 4, 0],
      [30, 8, 0],
    ];
    const fit = fitOrtho(ORTHO_DEFS.TOP, shifted, 600, 400)!;
    for (const p of shifted) {
      const u = -p[1] - fit.pan[0];
      const v = p[0] - fit.pan[1];
      expect(Math.abs(u * fit.zoom)).toBeLessThanOrEqual(300);
      expect(Math.abs(v * fit.zoom)).toBeLessThanOrEqual(200);
    }
  });

  it('is limited by whichever axis is tighter', () => {
    // TOP: screen-up is +X (span 20 m over 400 px), screen-right is -Y (span 8 m over 600 px).
    const tall: Vec3[] = [
      [-10, -4, 0],
      [10, 4, 0],
    ];
    const fit = fitOrtho(ORTHO_DEFS.TOP, tall, 600, 400)!;
    expect(fit.zoom).toBeCloseTo(400 / (20 * 1.14), 6);
  });

  it('returns null when there is nothing to frame', () => {
    expect(fitOrtho(ORTHO_DEFS.TOP, [], 600, 400)).toBeNull();
    expect(fitOrtho(ORTHO_DEFS.TOP, box, 0, 400)).toBeNull();
  });
});

describe('fitIso', () => {
  const view = { azimuth: 35, elevation: 24, distance: 14, target: [0, 0, 0] as Vec3 };

  it('targets the bounding box centre', () => {
    const fit = fitIso(view, [
      [0, 0, 0],
      [10, 4, 2],
    ], 600, 400)!;
    expect(fit.target).toEqual([5, 2, 1]);
  });

  it('pulls back far enough that the bounding sphere fits the narrower angle', () => {
    const points: Vec3[] = [
      [-10, -10, -10],
      [10, 10, 10],
    ];
    const fit = fitIso(view, points, 400, 400)!;
    const radius = Math.hypot(10, 10, 10);
    const half = ((ISO_FOV / 2) * Math.PI) / 180;
    expect(fit.distance).toBeCloseTo((radius / Math.sin(half)) * 1.14, 6);
  });

  it('needs more distance in a wide pane than a square one', () => {
    const points: Vec3[] = [
      [-5, -5, -5],
      [5, 5, 5],
    ];
    expect(fitIso(view, points, 400, 400)!.distance).toBeLessThanOrEqual(
      fitIso(view, points, 800, 400)!.distance,
    );
  });
});

describe('iso camera', () => {
  it('sits at the requested distance from the target', () => {
    const view = { azimuth: 35, elevation: 24, distance: 14, target: [1, 2, 3] as Vec3 };
    const p = isoCameraPosition(view);
    expect(p.distanceTo(new THREE.Vector3(1, 2, 3))).toBeCloseTo(14, 9);
    expect(p.z).toBeGreaterThan(3); // positive elevation looks down at the target
  });

  it('keeps world +Z on the upper half of the screen', () => {
    const view = { azimuth: 35, elevation: 24, distance: 14, target: [0, 0, 0] as Vec3 };
    const q = isoCameraQuaternion(isoCameraPosition(view), view.target);
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    expect(camUp.z).toBeGreaterThan(0);
  });
});

describe('projection', () => {
  const view = { zoom: 40, pan: [0, 0] as [number, number] };

  it('puts a point at the pan centre in the middle of the pane', () => {
    const p = orthoWorldToPane([0, 0, 0], ORTHO_DEFS.TOP, view, 600, 400);
    expect(p).toEqual({ x: 300, y: 200 });
  });

  it('puts the nose above centre and the vehicle right to the right, in TOP', () => {
    const nose = orthoWorldToPane([2.4, 0, 0], ORTHO_DEFS.TOP, view, 600, 400);
    expect(nose.y).toBeLessThan(200);
    expect(nose.x).toBe(300);

    const right = orthoWorldToPane([0, -1, 0], ORTHO_DEFS.TOP, view, 600, 400);
    expect(right.x).toBeGreaterThan(300);
  });

  it('follows the pan', () => {
    const panned = { zoom: 40, pan: [3, -2] as [number, number] };
    const p = orthoWorldToPane([-2, -3, 0], ORTHO_DEFS.TOP, panned, 600, 400);
    // world (-2,-3) is u = -y = 3, v = x = -2 — exactly the pan centre.
    expect(p).toEqual({ x: 300, y: 200 });
  });

  it('inverts exactly through orthoPaneDeltaToWorld', () => {
    for (const def of Object.values(ORTHO_DEFS)) {
      const before = orthoWorldToPane([1, 2, 3], def, view, 600, 400);
      const delta = orthoPaneDeltaToWorld(37, -21, def, view.zoom);
      const after = orthoWorldToPane(
        [1 + delta[0], 2 + delta[1], 3 + delta[2]],
        def,
        view,
        600,
        400,
      );
      expect(after.x - before.x).toBeCloseTo(37, 9);
      expect(after.y - before.y).toBeCloseTo(-21, 9);
    }
  });

  it('projects the orbit target to the centre of the ISO pane', () => {
    const iso = { azimuth: 35, elevation: 24, distance: 14, target: [1, 2, 0.5] as Vec3 };
    const p = projectToIsoPane(iso.target, iso, 600, 400)!;
    expect(p.x).toBeCloseTo(300, 6);
    expect(p.y).toBeCloseTo(200, 6);
  });

  it('rejects a point behind the ISO camera', () => {
    const iso = { azimuth: 0, elevation: 0, distance: 10, target: [0, 0, 0] as Vec3 };
    // The camera sits at x = +10 looking back at the origin, so x = 20 is behind it.
    expect(projectToIsoPane([20, 0, 0], iso, 600, 400)).toBeNull();
  });

  it('puts a point above the target higher up the ISO pane', () => {
    const iso = { azimuth: 0, elevation: 0, distance: 10, target: [0, 0, 0] as Vec3 };
    const p = projectToIsoPane([0, 0, 1], iso, 600, 400)!;
    expect(p.y).toBeLessThan(200);
    expect(p.x).toBeCloseTo(300, 6);
  });
});

describe('sceneBounds', () => {
  it('includes the vehicle box even with no sensors', () => {
    const points = sceneBounds(vehicle, [], []);
    expect(points).toHaveLength(8);
    expect(Math.max(...points.map((p) => p[2]))).toBeCloseTo(1.7, 9);
  });

  it('includes the ground footprint, which can reach past the frustum corners', () => {
    const sensor: SensorInstance = {
      id: 'a',
      name: 'A',
      specId: null,
      custom: { hfov: 60, vfov: 40, range: 20 },
      color: '#6750A4',
      visible: true,
      pose: { x: 2.4, y: 0, z: 0.6, yaw: 0, pitch: -3, roll: 0 },
    };
    const withSensor = sceneBounds(vehicle, [sensor], []);
    const frustumOnly = 8 + 5;
    expect(withSensor.length).toBeGreaterThan(frustumOnly);
  });

  it('skips hidden sensors', () => {
    const hidden: SensorInstance = {
      id: 'a',
      name: 'A',
      specId: null,
      custom: { hfov: 60, vfov: 40, range: 20 },
      color: '#6750A4',
      visible: false,
      pose: { x: 0, y: 0, z: 1, yaw: 0, pitch: 0, roll: 0 },
    };
    expect(sceneBounds(vehicle, [hidden], [])).toHaveLength(8);
  });
});
