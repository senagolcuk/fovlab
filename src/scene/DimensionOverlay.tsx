/**
 * Dimension lines over the orthographic panes.
 *
 * Drawn as SVG above the canvas rather than as geometry inside it, for two reasons. The numbers
 * an engineer reads have to be Roboto Mono at a fixed size — a text mesh would scale with the
 * zoom and change face — and the projection this needs, `orthoWorldToPane`, is already the
 * tested one the panes themselves use, so the annotation cannot drift from the drawing.
 *
 * Everything below happens in pane pixels once the two ends are projected, so the same code
 * serves all three panes whichever way round they are.
 */

import type { Rect, Vec3, Vehicle } from '../core/types';
import { useStore, type OrthoViewState } from '../store/useStore';
import { ORTHO_DEFS, orthoWorldToPane, type OrthoName } from './views';
import { MONO } from '../theme';

const LINE = '#495F81';
/** Clear of the body, and stepped so two dimensions on one pane never sit on top of each other. */
const OFFSETS = [26, 58, 90];
const TICK = 4;
/** Room left for the label, which sits just beyond the dimension line. */
const MARGIN = 18;
/** Shortest on-screen edge worth dimensioning, in pixels. */
const MIN_EDGE = 36;

interface Dim {
  from: Vec3;
  to: Vec3;
  label: string;
  /** Which of `OFFSETS` to stand off by. */
  lane: number;
  /** Draws on the near side of the body instead of the far side, to dodge another dimension. */
  flip?: boolean;
}

/** How far a point can travel along a unit normal before it leaves the pane. */
function maxTravel(
  p: { x: number; y: number },
  nx: number,
  ny: number,
  w: number,
  h: number,
  margin: number,
): number {
  let t = Infinity;
  if (nx > 1e-6) t = Math.min(t, (w - margin - p.x) / nx);
  else if (nx < -1e-6) t = Math.min(t, (margin - p.x) / nx);
  if (ny > 1e-6) t = Math.min(t, (h - margin - p.y) / ny);
  else if (ny < -1e-6) t = Math.min(t, (margin - p.y) / ny);
  return t;
}

/** The dimensions worth showing on each pane, in the plane that pane actually measures. */
export function dimensionsFor(name: OrthoName, v: Vehicle): Dim[] {
  const x = v.length / 2;
  const y = v.width / 2;
  const top = v.clearance + v.height;
  const m = (n: number) => `${n.toFixed(2)} m`;

  switch (name) {
    case 'TOP':
      return [
        { from: [-x, -y, v.clearance], to: [x, -y, v.clearance], label: m(v.length), lane: 0 },
        { from: [x, -y, v.clearance], to: [x, y, v.clearance], label: m(v.width), lane: 0 },
      ];
    case 'FRONT':
      return [
        { from: [x, -y, v.clearance], to: [x, y, v.clearance], label: m(v.width), lane: 0 },
        { from: [x, y, v.clearance], to: [x, y, top], label: m(v.height), lane: 0 },
        { from: [x, y, 0], to: [x, y, v.clearance], label: m(v.clearance), lane: 1 },
      ];
    case 'LEFT':
      return [
        { from: [-x, y, v.clearance], to: [x, y, v.clearance], label: m(v.length), lane: 0 },
        { from: [x, y, v.clearance], to: [x, y, top], label: m(v.height), lane: 0 },
        // Below the wheels, where a side elevation puts it. Two lanes out rather than one: it
        // starts at the wheel centres, already above the underside the length is measured from,
        // so a single lane would leave the two labels a dozen pixels apart.
        {
          from: [-v.wheelbase / 2, y, v.wheelRadius],
          to: [v.wheelbase / 2, y, v.wheelRadius],
          label: m(v.wheelbase),
          lane: 2,
        },
      ];
  }
}

export default function DimensionOverlay({ name, rect }: { name: OrthoName; rect: Rect }) {
  const show = useStore((s) => s.display.dimensions);
  const vehicle = useStore((s) => s.vehicle);
  const view = useStore((s) => s.views[name]) as OrthoViewState;

  if (!show || rect.width === 0 || rect.height === 0) return null;

  const def = ORTHO_DEFS[name];
  const project = (p: Vec3) => orthoWorldToPane(p, def, view, rect.width, rect.height);
  const centre = project([0, 0, vehicle.clearance + vehicle.height / 2]);

  return (
    <svg
      width={rect.width}
      height={rect.height}
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        pointerEvents: 'none',
        // A dimension must never draw over a neighbouring pane.
        overflow: 'hidden',
      }}
    >
      {dimensionsFor(name, vehicle).map((dim, i) => {
        const a = project(dim.from);
        const b = project(dim.to);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        // Once the edge is shorter than the stand-off, the annotation is bigger than the thing it
        // measures and neighbouring dimensions start colliding. Say nothing until it earns space.
        if (len < MIN_EDGE) return null;

        let nx = -dy / len;
        let ny = dx / len;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        // Stand the dimension off on the far side from the body, not through it.
        if ((mid.x - centre.x) * nx + (mid.y - centre.y) * ny < 0) {
          nx = -nx;
          ny = -ny;
        }
        if (dim.flip) {
          nx = -nx;
          ny = -ny;
        }

        // A fitted pane can leave no room outside the vehicle at all — TOP frames a 4.8 m car in
        // 5.5 m of height. Rather than drawing into the neighbouring pane, take the other side,
        // and failing that draw as far out as the pane allows.
        let off = OFFSETS[dim.lane] ?? OFFSETS[0];
        const room = (sx: number, sy: number) =>
          Math.min(
            maxTravel(a, sx, sy, rect.width, rect.height, MARGIN),
            maxTravel(b, sx, sy, rect.width, rect.height, MARGIN),
          );
        if (room(nx, ny) < off) {
          const other = room(-nx, -ny);
          if (other > room(nx, ny)) {
            nx = -nx;
            ny = -ny;
            off = Math.min(off, other);
          } else {
            off = Math.min(off, room(nx, ny));
          }
        }
        if (off < 1) return null;
        const a2 = { x: a.x + nx * off, y: a.y + ny * off };
        const b2 = { x: b.x + nx * off, y: b.y + ny * off };
        const ux = dx / len;
        const uy = dy / len;

        // Keep the text the right way up however the pane is oriented.
        let angle = (Math.atan2(b2.y - a2.y, b2.x - a2.x) * 180) / Math.PI;
        if (angle > 90 || angle < -90) angle += 180;
        const label = { x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2 };

        return (
          <g key={i} stroke={LINE} strokeWidth={1}>
            {/* Extension lines, running from the body out past the dimension line. */}
            <line x1={a.x + nx * 4} y1={a.y + ny * 4} x2={a.x + nx * (off + 6)} y2={a.y + ny * (off + 6)} />
            <line x1={b.x + nx * 4} y1={b.y + ny * 4} x2={b.x + nx * (off + 6)} y2={b.y + ny * (off + 6)} />
            <line x1={a2.x} y1={a2.y} x2={b2.x} y2={b2.y} />
            {/* Architectural ticks rather than arrowheads: they stay legible at one pixel. */}
            <line
              x1={a2.x - (ux - nx) * TICK}
              y1={a2.y - (uy - ny) * TICK}
              x2={a2.x + (ux - nx) * TICK}
              y2={a2.y + (uy - ny) * TICK}
            />
            <line
              x1={b2.x - (ux - nx) * TICK}
              y1={b2.y - (uy - ny) * TICK}
              x2={b2.x + (ux - nx) * TICK}
              y2={b2.y + (uy - ny) * TICK}
            />
            <text
              x={label.x}
              y={label.y}
              transform={`rotate(${angle.toFixed(2)} ${label.x} ${label.y})`}
              dy={-4}
              textAnchor="middle"
              fill={LINE}
              stroke="#F8FAFB"
              strokeWidth={3}
              paintOrder="stroke"
              style={{ fontFamily: MONO, fontSize: 11.5 }}
            >
              {dim.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
