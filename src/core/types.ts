/**
 * Domain types. Pure data — no behaviour, no imports.
 *
 * Coordinate frame is ISO 8855, right-handed: +X forward, +Y vehicle-left, +Z up.
 * Origin sits on the ground plane at the centre of the vehicle footprint.
 * Lengths are metres, angles are degrees at the API boundary.
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

/** Row-major 3x3. `m[row][col]`. */
export type Mat3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

/**
 * The body style. `bus` is one block the whole length — what the tool drew before there was a
 * choice — so it stays the value a layout without one falls back to.
 */
export type VehicleModel = 'car' | 'van' | 'bus';

/**
 * Plan-view outline of the body. All three are one family — a rectangle shrunk by a corner
 * radius and inflated back by it — so every distance the tool measures stays closed form.
 * `cylinder` is that radius taken to its maximum: a circle when length equals width, and a
 * stadium when they differ, since a plan view with two different dimensions has no other
 * honest reading of "cylinder".
 */
export type VehicleShape = 'box' | 'rounded' | 'cylinder';

export interface Vehicle {
  length: number; // along +X, m
  width: number; // along +Y, m
  height: number; // along +Z, m
  clearance: number; // ground to underside of the box, m
  wheelbase: number; // m
  wheelRadius: number; // m
  shape: VehicleShape;
  /** Which roofline the body has. The plan outline is the same for all of them. */
  model: VehicleModel;
  /** Plan-view corner radius in metres. Only read when `shape` is `rounded`. */
  cornerRadius: number;
}

/**
 * What the sensor is. Free text rather than a closed set: camera, lidar and radar cover most
 * layouts, but ultrasonic and thermal are real sensors too, and nothing geometric reads this —
 * it only ever labels. `SUGGESTED_KINDS` in `catalog.ts` offers the common three.
 */
export type SensorKind = string;

/** What a sensor IS. Independent of where it is mounted. */
export interface SensorSpec {
  id: string; // 'ouster-os1-64'
  kind: SensorKind;
  manufacturer: string;
  model: string;
  hfov: number; // degrees
  vfov: number; // degrees
  range: number; // metres
  resolution?: { h: number; v: number }; // pixels or beams
  datasheetUrl?: string;
  verified: boolean; // false until checked against the datasheet
}

/** The three numbers that define the FOV volume, after spec resolution. */
export type FovSpec = Pick<SensorSpec, 'hfov' | 'vfov' | 'range'>;

export interface Pose {
  x: number;
  y: number;
  z: number; // metres, ISO 8855
  yaw: number;
  pitch: number;
  roll: number; // degrees
}

/** A sensor MOUNTED on the vehicle. */
export interface SensorInstance {
  id: string;
  name: string; // user-editable label, e.g. 'FRONT LEFT CORNER'
  specId: string | null; // null = fully custom
  custom?: FovSpec; // used when specId is null
  override?: Partial<FovSpec>; // tweaks on a catalogue spec
  color: string; // hex
  visible: boolean;
  pose: Pose;
}

export interface Layout {
  version: 1;
  vehicle: Vehicle;
  sensors: SensorInstance[];
  /**
   * User-created models the sensors above refer to.
   *
   * Built-in catalogue entries ship with the app and are not repeated here. Models a person made
   * themselves exist only in their browser, so without them in the file an exported layout would
   * open elsewhere with every such sensor silently falling back to 90°×60° 10 m.
   */
  models?: SensorSpec[];
}

/**
 * The FOV volume as a convex polyhedron. The far surface is tessellated, which is why the vertex
 * count is not fixed.
 */
export interface Frustum {
  /** Index 0 is the apex. */
  vertices: Vec3[];
  /** Full topology. What the ground section walks, so the arc gets resolved. */
  edges: ReadonlyArray<readonly [number, number]>;
  /**
   * What the wireframe draws: the silhouette only. Drawing every tessellation edge turns a fan
   * into a fishing net.
   */
  outline: ReadonlyArray<readonly [number, number]>;
  triangles: ReadonlyArray<readonly [number, number, number]>;
}

/** Everything derived from one sensor's ground intersection. */
export interface GroundCoverage {
  polygon: Vec2[] | null;
  area: number; // m^2, 0 when there is no polygon
  extentX: [number, number] | null;
  extentY: [number, number] | null;
  blindGap: number | null; // m from the vehicle footprint to the polygon
}

/** One contiguous run of uncovered azimuth, degrees in [-180, 180). */
export interface BlindSector {
  startDeg: number;
  endDeg: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
