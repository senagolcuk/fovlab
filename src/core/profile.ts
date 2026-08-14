/**
 * The vehicle's side profile: how tall the body is at each point along its length.
 *
 * The plan outline is `footprint.ts` and is the same for every model — a car and a bus of the
 * same dimensions take up the same ground. What a model changes is the roofline, so the body is
 * a short stack of blocks along X, each spanning the full footprint and rising to its own height.
 *
 * This is not decoration. The occlusion warning and the snap both read it, so a sensor dropped on
 * a car's bonnet lands on the bonnet rather than at roof height. The drawing and the numbers are
 * never allowed to disagree.
 */

import type { Vehicle, VehicleModel } from './types';

export interface BodySegment {
  /** World X of the rear and front ends of this block. */
  minX: number;
  maxX: number;
  /** World Z of its roof. The floor is the ground clearance, for every block. */
  top: number;
}

/**
 * Each entry is `[from, to, height]`: the first two are fractions of the length measured back
 * from the nose, the last a fraction of the height above the clearance.
 *
 * Proportions rather than metres, so the dimensions the engineer types still drive everything —
 * a 12 m bus and a 4.5 m hatchback both get a roofline that belongs to them.
 */
const PROFILES: Record<VehicleModel, ReadonlyArray<readonly [number, number, number]>> = {
  /** One block the whole way: the shape the tool has always drawn, and still the default. */
  bus: [[0, 1, 1]],
  /** Bonnet, cabin, boot. */
  car: [
    [0, 0.26, 0.5],
    [0.26, 0.72, 1],
    [0.72, 1, 0.58],
  ],
  /** A short bonnet, then a box body the rest of the way. */
  van: [
    [0, 0.18, 0.52],
    [0.18, 1, 1],
  ],
};

export const VEHICLE_MODELS: VehicleModel[] = ['car', 'van', 'bus'];

export function bodySegments(vehicle: Vehicle): BodySegment[] {
  const nose = vehicle.length / 2;
  const profile = PROFILES[vehicle.model] ?? PROFILES.bus;
  return profile.map(([from, to, h]) => ({
    minX: nose - to * vehicle.length,
    maxX: nose - from * vehicle.length,
    top: vehicle.clearance + h * vehicle.height,
  }));
}

/**
 * The roofline above `x`. Returns the clearance — a body of no height — beyond the ends.
 *
 * Blocks meet at a shared edge, so a point on a step belongs to the taller of the two: the step
 * face is part of the body, and a sensor on it should sit against the tall side.
 */
export function bodyTopAt(x: number, vehicle: Vehicle): number {
  let top = vehicle.clearance;
  for (const s of bodySegments(vehicle)) {
    if (x >= s.minX && x <= s.maxX && s.top > top) top = s.top;
  }
  return top;
}

/** The tallest point of the body, which is the height the engineer typed. */
export function bodyMaxTop(vehicle: Vehicle): number {
  return vehicle.clearance + vehicle.height;
}
