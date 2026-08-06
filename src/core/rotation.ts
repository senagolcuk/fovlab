/**
 * Rotation and small vector helpers.
 *
 *   R = Rz(yaw) . Ry(-pitch) . Rx(roll)
 *
 * so yaw + turns left, pitch + tilts up, roll + is clockwise about the optical axis.
 * The sensor local frame is +X_c optical axis, +Y_c image-left, +Z_c image-up.
 */

import type { Mat3, Vec3 } from './types';

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export function rotationMatrix(yawDeg: number, pitchDeg: number, rollDeg: number): Mat3 {
  const a = yawDeg * DEG;
  const b = -pitchDeg * DEG;
  const c = rollDeg * DEG;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const cb = Math.cos(b);
  const sb = Math.sin(b);
  const cc = Math.cos(c);
  const sc = Math.sin(c);
  return [
    [ca * cb, ca * sb * sc - sa * cc, ca * sb * cc + sa * sc],
    [sa * cb, sa * sb * sc + ca * cc, sa * sb * cc - ca * sc],
    [-sb, cb * sc, cb * cc],
  ];
}

/** m . v */
export function applyMat3(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

export function transpose(m: Mat3): Mat3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
}

/** a . b */
export function multiplyMat3(a: Mat3, b: Mat3): Mat3 {
  const out: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r][c] = a[r][0] * b[0][c] + a[r][1] * b[1][c] + a[r][2] * b[2][c];
    }
  }
  return out as Mat3;
}

export function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale3(v: Vec3, k: number): Vec3 {
  return [v[0] * k, v[1] * k, v[2] * k];
}

export function length3(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

export function normalize3(v: Vec3): Vec3 {
  const l = length3(v);
  return l === 0 ? [0, 0, 0] : [v[0] / l, v[1] / l, v[2] / l];
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * The inverse of `rotationMatrix`: the yaw, pitch and roll that produced `m`.
 *
 * Needed by the rotate gizmo, which hands back an orientation rather than three angles.
 * At a vertical optical axis yaw and roll describe the same turn, so roll is pinned to zero
 * and the whole turn is reported as yaw.
 */
export function anglesFromMatrix(m: Mat3): { yaw: number; pitch: number; roll: number } {
  const sinB = clamp(-m[2][0], -1, 1);
  const b = Math.asin(sinB);
  const GIMBAL_EPS = 1e-6;

  if (Math.abs(Math.cos(b)) < GIMBAL_EPS) {
    return {
      yaw: Math.atan2(-m[0][1], m[1][1]) * RAD,
      pitch: (-b * RAD) as number,
      roll: 0,
    };
  }

  return {
    yaw: Math.atan2(m[1][0], m[0][0]) * RAD,
    pitch: -b * RAD,
    roll: Math.atan2(m[2][1], m[2][2]) * RAD,
  };
}

/**
 * Yaw and pitch that aim the optical axis along `dir`. Roll is left to the caller.
 * Used by snap-to-body, which aligns a sensor with an outward face normal.
 */
export function yawPitchFromDirection(dir: Vec3): { yaw: number; pitch: number } {
  const [x, y, z] = normalize3(dir);
  const yaw = Math.atan2(y, x) * RAD;
  const pitch = Math.asin(clamp(z, -1, 1)) * RAD;
  return { yaw, pitch };
}
