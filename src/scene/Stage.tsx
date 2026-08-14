/**
 * The canvas and the four panes.
 *
 * Pane rectangles come from `core/viewport.ts`, so acceptance test 10 covers the real layout
 * rather than a parallel copy of it. Each pane is a transparent div that owns its own pointer
 * gestures; drei's `<View>` scissors the shared canvas to that div's rectangle.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { View } from '@react-three/drei';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { VIEW_NAMES, paneGrowth, viewportRects, type ViewName } from '../core/viewport';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import type { Rect } from '../core/types';
import {
  ZOOM_LIMITS,
  useStore,
  type IsoViewState,
  type OrthoViewState,
  type ViewsState,
} from '../store/useStore';
import { clamp } from '../core/rotation';

/**
 * A touch more than the pane's own growth. Maximising is asking to look at something closely, so
 * matching the old framing exactly would undersell it — but far enough below the fit margin that
 * a layout framed in the tiled pane does not lose its edges here.
 */
const MAXIMIZED_EXTRA_ZOOM = 1.25;
import { IsoCamera, OrthoCamera } from './Cameras';
import DimensionOverlay from './DimensionOverlay';
import Gizmo from './Gizmo';
import SceneContent from './SceneContent';
import { usePaneGestures } from './usePaneGestures';
import { registerPaneScene, setSceneHandle } from './exportBridge';
import {
  AXIS_HINTS,
  ORTHO_DEFS,
  fitIso,
  fitOrtho,
  panForPoint,
  sceneBounds,
  vehicleCentre,
  type OrthoName,
} from './views';
import { MONO } from '../theme';

/** A shade cooler and lighter than the sidebar, so the viewport reads as its own surface. */
export const BACKGROUND = '#F8FAFB';

/** The exporter reads pixels back off this host; kept here so both sides agree on the id. */
export const STAGE_DOM_ID = 'fovlab-stage';

/**
 * drei's `<View>` renders with `autoClear` off and r3f's own render pass is disabled once a
 * prioritised `useFrame` exists, so nothing would clear the buffers. This runs first each frame.
 */
function ClearFrame() {
  useFrame(({ gl }) => {
    gl.setScissorTest(false);
    gl.clear(true, true, true);
  }, 0);
  return null;
}

/** Publishes the renderer so the image exporter can capture the panes at any resolution. */
function ExportBridge() {
  const gl = useThree((s) => s.gl);
  const setDpr = useThree((s) => s.setDpr);
  useEffect(() => {
    setSceneHandle({ gl, setDpr, getDpr: () => gl.getPixelRatio() });
    return () => setSceneHandle(null);
  }, [gl, setDpr]);
  return null;
}

function PaneLabel({ name, rect }: { name: ViewName; rect: Rect }) {
  const views = useStore((s) => s.views);
  const scale =
    name === 'ISO'
      ? `d = ${views.ISO.distance.toFixed(1)} m`
      : `${(rect.width / views[name].zoom).toFixed(1)} m across`;

  return (
    <Box
      sx={{
        position: 'absolute',
        left: rect.x + 8,
        top: rect.y + 6,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'baseline',
        gap: 1,
      }}
    >
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, letterSpacing: 1, color: 'text.secondary' }}
      >
        {name}
      </Typography>
      <Typography sx={{ fontFamily: MONO, fontSize: 11, color: 'text.secondary' }}>
        {scale}
      </Typography>
      <Typography sx={{ fontFamily: MONO, fontSize: 11, color: 'text.disabled' }}>
        {AXIS_HINTS[name]}
      </Typography>
    </Box>
  );
}

/** Publishes this pane's scene and camera, so the vector exporter can redraw it as shapes. */
/**
 * Maximise / restore, in the pane's top-right corner.
 *
 * Sits above the canvas with the labels, for the same reason they do: the canvas is opaque. It
 * takes the pointer back, so a press on it is not also a pan on the pane underneath.
 */
function PaneZoomButton({ name, rect }: { name: ViewName; rect: Rect }) {
  const maximized = useStore((s) => s.maximizedView === name);
  const toggleMaximized = useStore((s) => s.toggleMaximized);

  return (
    <Tooltip title={maximized ? 'Back to four views  (Esc)' : `Fill the viewport with ${name}`}>
      <IconButton
        size="small"
        onClick={() => toggleMaximized(name)}
        sx={{
          position: 'absolute',
          left: rect.x + rect.width - 34,
          top: rect.y + 4,
          color: 'secondary.main',
          bgcolor: 'rgba(255,255,255,0.72)',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.95)' },
        }}
      >
        {maximized ? (
          <CloseFullscreenIcon sx={{ fontSize: 15 }} />
        ) : (
          <OpenInFullIcon sx={{ fontSize: 15 }} />
        )}
      </IconButton>
    </Tooltip>
  );
}

function PaneRegister({ name }: { name: ViewName }) {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    registerPaneScene(name, { scene, camera });
    return () => registerPaneScene(name, null);
  }, [name, scene, camera]);
  return null;
}

function Pane({
  name,
  index,
  rect,
  onFit,
}: {
  name: ViewName;
  index: number;
  rect: Rect;
  onFit: (name: ViewName) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fit = useCallback(() => onFit(name), [onFit, name]);
  usePaneGestures(ref, name, fit);

  return (
    <View
      // The forwarded ref is the tracked div, not a three.js object.
      ref={ref as never}
      index={index}
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        touchAction: 'none',
        // Firefox and Safari start a text selection on a drag that begins here otherwise.
        // Safari only took the unprefixed property in 17, so both spellings stay.
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      {name === 'ISO' ? <IsoCamera /> : <OrthoCamera name={name as OrthoName} />}
      <SceneContent blindSectors={name === 'TOP'} />
      <PaneRegister name={name} />
      {name === 'ISO' && <Gizmo />}
    </View>
  );
}

export default function Stage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    observer.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => observer.disconnect();
  }, []);

  const maximizedView = useStore((s) => s.maximizedView);
  const rects = useMemo(
    () => viewportRects(size.width, size.height, maximizedView),
    [size.width, size.height, maximizedView],
  );

  const fitPanes = useCallback(
    (only?: ViewName) => {
      const state = useStore.getState();
      const points = sceneBounds(state.vehicle, state.sensors, state.catalog);
      const current = state.views;
      const next: ViewsState = { ...current };

      for (const name of VIEW_NAMES) {
        if (only && name !== only) continue;
        // The maximised pane is a different size from the tiled one, and a fit has to frame the
        // pane that is actually on screen.
        const rect = viewportRects(
          hostRef.current?.clientWidth ?? 0,
          hostRef.current?.clientHeight ?? 0,
          useStore.getState().maximizedView,
        )[name];
        if (name === 'ISO') {
          next.ISO = fitIso(current.ISO, points, rect.width, rect.height) ?? current.ISO;
        } else {
          next[name] =
            fitOrtho(ORTHO_DEFS[name], points, rect.width, rect.height) ?? current[name];
        }
      }
      state.setViews(next);
    },
    [],
  );

  const fitNonce = useStore((s) => s.fitNonce);
  const fittedOnce = useRef(false);
  const maximizedBefore = useRef<ViewName | null>(null);

  useEffect(() => {
    if (size.width === 0 || size.height === 0) return;
    if (fitNonce === 0 && fittedOnce.current) return;
    fittedOnce.current = true;
    fitPanes();
  }, [fitNonce, size.width, size.height, fitPanes]);

  const onFitPane = useCallback((name: ViewName) => fitPanes(name), [fitPanes]);

  /**
   * Framing for a maximised pane, and the way back.
   *
   * Maximising doubles the room, so the view is scaled by the pane's own growth — the same
   * fraction of the pane stays covered and the drawing comes closer rather than the extra space
   * appearing around it — with a little more on top, since the point of maximising is to look at
   * something closely.
   *
   * It also centres on the vehicle. A fitted view is framed on the bounding box of the vehicle
   * *and* every FOV, and volumes reaching forward pull that centre well ahead of the body, which
   * left the vehicle sitting low in the enlarged pane. The vehicle is the thing everything else
   * is positioned against, so it is what the middle of the pane should hold.
   *
   * Restoring puts the saved view straight back rather than undoing the arithmetic, so the four-up
   * layout returns exactly as it was left however much the maximised pane was panned around.
   * Only that one pane is touched: this is a change of screen area, not a zoom gesture, so
   * `Link zoom` has no say in it.
   */
  const savedView = useRef<{ name: ViewName; view: OrthoViewState | IsoViewState } | null>(null);

  useEffect(() => {
    const previous = maximizedBefore.current;
    maximizedBefore.current = maximizedView;
    if (previous === maximizedView) return;

    const store = useStore.getState();

    if (previous && savedView.current?.name === previous) {
      const saved = savedView.current.view;
      if (previous === 'ISO') store.setIsoView(saved as IsoViewState);
      else store.setOrthoView(previous, saved as OrthoViewState);
      savedView.current = null;
    }

    if (!maximizedView) return;

    const el = hostRef.current;
    if (!el) return;
    const growth =
      paneGrowth(el.clientWidth, el.clientHeight, maximizedView) * MAXIMIZED_EXTRA_ZOOM;
    const centre = vehicleCentre(store.vehicle);

    if (maximizedView === 'ISO') {
      savedView.current = { name: 'ISO', view: { ...store.views.ISO } };
      store.setIsoView({ target: centre, distance: store.views.ISO.distance / growth });
    } else {
      savedView.current = { name: maximizedView, view: { ...store.views[maximizedView] } };
      store.setOrthoView(maximizedView, {
        pan: panForPoint(ORTHO_DEFS[maximizedView], centre),
        zoom: clamp(store.views[maximizedView].zoom * growth, ...ZOOM_LIMITS),
      });
    }
  }, [maximizedView]);

  return (
    <Box
      ref={hostRef}
      // Stable handle so the image exporter can find the viewport and tile it into panes.
      id={STAGE_DOM_ID}
      sx={{ position: 'absolute', inset: 0, bgcolor: BACKGROUND, overflow: 'hidden' }}
    >
      {size.width > 0 &&
        VIEW_NAMES.map((name, i) =>
          rects[name].width > 0 ? (
            <Pane key={name} name={name} index={i + 1} rect={rects[name]} onFit={onFitPane} />
          ) : null,
        )}

      <Canvas
        eventSource={hostRef as never}
        // Must stay `none`. The canvas covers all four panes, and drei's `<View>` points the
        // event layer at the pane divs underneath — including the one `TransformControls`
        // listens on. Give the canvas the pointer and the gizmo stops receiving events.
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        // `preserveDrawingBuffer` keeps the last frame readable so the image exporter can grab
        // the panes at any moment rather than only inside the render pass.
        // `stencil` is off by default and the merged FOV paints through it.
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, stencil: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(BACKGROUND);
          // Per-material clipping planes are ignored unless this is on.
          gl.localClippingEnabled = true;
        }}
        // Views scissor against the canvas rect, so a stale measurement offsets every pane.
        resize={{ scroll: false, debounce: 0 }}
        flat
      >
        <ClearFrame />
        <ExportBridge />
        <View.Port />
      </Canvas>

      {/* The canvas is opaque, so the pane separators have to sit above it. */}
      {size.width > 0 && !maximizedView && (
        <>
          <Box
            sx={{
              position: 'absolute',
              left: rects.FRONT.x,
              top: 0,
              width: '1px',
              height: '100%',
              bgcolor: 'divider',
              pointerEvents: 'none',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              top: rects.LEFT.y,
              width: '100%',
              height: '1px',
              bgcolor: 'divider',
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      {/* Above the canvas for the same reason the separators are: the canvas is opaque. */}
      {size.width > 0 &&
        (['TOP', 'FRONT', 'LEFT'] as OrthoName[])
          .filter((name) => rects[name].width > 0)
          .map((name) => <DimensionOverlay key={name} name={name} rect={rects[name]} />)}

      {size.width > 0 &&
        VIEW_NAMES.filter((name) => rects[name].width > 0).map((name) => (
          <PaneLabel key={name} name={name} rect={rects[name]} />
        ))}

      {size.width > 0 &&
        VIEW_NAMES.filter((name) => rects[name].width > 0).map((name) => (
          <PaneZoomButton key={name} name={name} rect={rects[name]} />
        ))}
    </Box>
  );
}
