/**
 * Blind spot report: azimuth sectors around the vehicle with no ground coverage close in.
 *
 * This is a report, not a physics simulation. Each sector is probed along its centre ray at
 * a handful of radii, starting where the ray leaves the vehicle footprint.
 */

import { pointInPolygon } from './ground';
import { DEG } from './rotation';
import type { BlindSector, Vec2, Vehicle } from './types';

export const SECTOR_COUNT = 72;
export const SECTOR_DEG = 360 / SECTOR_COUNT; // 5
/** How far past the footprint a sector must be covered to count as covered. */
export const BLIND_RADIUS = 5;
const PROBE_STEP = 0.25;

export interface SectorCoverage {
  index: number;
  /** Azimuth of the sector centre, degrees in [-180, 180). 0 is forward, + is left. */
  centerDeg: number;
  covered: boolean;
  /** Distance from the origin at which coverage was first found, or null. */
  firstCoveredRadius: number | null;
}

export interface BlindSpotReport {
  sectors: SectorCoverage[];
  /** Contiguous runs of uncovered azimuth, merged across the +/-180 seam. */
  blind: BlindSector[];
  blindFraction: number;
}

/** Radius at which a ray from the origin leaves the footprint rectangle. */
export function footprintExitRadius(cos: number, sin: number, vehicle: Vehicle): number {
  const hl = vehicle.length / 2;
  const hw = vehicle.width / 2;
  const tx = Math.abs(cos) < 1e-12 ? Infinity : hl / Math.abs(cos);
  const ty = Math.abs(sin) < 1e-12 ? Infinity : hw / Math.abs(sin);
  const t = Math.min(tx, ty);
  return Number.isFinite(t) ? t : 0;
}

export function blindSpotReport(
  polygons: Vec2[][],
  vehicle: Vehicle,
  radius = BLIND_RADIUS,
): BlindSpotReport {
  const sectors: SectorCoverage[] = [];

  for (let i = 0; i < SECTOR_COUNT; i++) {
    const centerDeg = -180 + (i + 0.5) * SECTOR_DEG;
    const cos = Math.cos(centerDeg * DEG);
    const sin = Math.sin(centerDeg * DEG);
    const r0 = footprintExitRadius(cos, sin, vehicle);

    let firstCoveredRadius: number | null = null;
    for (let r = r0; r <= r0 + radius + 1e-9; r += PROBE_STEP) {
      const p: Vec2 = [cos * r, sin * r];
      if (polygons.some((poly) => pointInPolygon(p, poly))) {
        firstCoveredRadius = r;
        break;
      }
    }

    sectors.push({
      index: i,
      centerDeg,
      covered: firstCoveredRadius !== null,
      firstCoveredRadius,
    });
  }

  return {
    sectors,
    blind: mergeBlindRuns(sectors),
    blindFraction: sectors.filter((s) => !s.covered).length / SECTOR_COUNT,
  };
}

function mergeBlindRuns(sectors: SectorCoverage[]): BlindSector[] {
  const runs: BlindSector[] = [];
  let start: number | null = null;

  for (let i = 0; i < sectors.length; i++) {
    if (!sectors[i].covered) {
      if (start === null) start = i;
    } else if (start !== null) {
      runs.push(runFromIndices(start, i - 1));
      start = null;
    }
  }
  if (start !== null) runs.push(runFromIndices(start, sectors.length - 1));

  // A run that touches both ends of the range is one run across the seam.
  if (runs.length > 1) {
    const first = runs[0];
    const last = runs[runs.length - 1];
    if (first.startDeg === -180 && last.endDeg === 180) {
      runs.pop();
      runs.shift();
      runs.push({ startDeg: last.startDeg, endDeg: first.endDeg + 360 });
    }
  }
  return runs;
}

function runFromIndices(from: number, to: number): BlindSector {
  return { startDeg: -180 + from * SECTOR_DEG, endDeg: -180 + (to + 1) * SECTOR_DEG };
}
