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
import { VIEW_NAMES, viewportRects, type ViewName } from '../core/viewport';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import Button from '@mui/material/Button';
import Fade from '@mui/material/Fade';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Tooltip from '@mui/material/Tooltip';
import type { Rect } from '../core/types';
import {
  useStore,
  type IsoViewState,
  type OrthoViewState,
  type ViewsState,
} from '../store/useStore';

import { IsoCamera, OrthoCamera } from './Cameras';
import DimensionOverlay from './DimensionOverlay';
import Gizmo from './Gizmo';
import SceneContent from './SceneContent';
import { usePaneGestures } from './usePaneGestures';
import { registerPaneScene, setSceneHandle } from './exportBridge';
import {
  AXIS_HINTS,
  ORTHO_DEFS,
  FIT_MARGIN,
  fitIso,
  fitOrtho,
  sceneBounds,
  vehicleCentre,
  type OrthoName,
} from './views';
import { DISPLAY, MONO, PALETTE } from '../theme';

/** A shade cooler and lighter than the sidebar, so the viewport reads as its own surface. */
export const BACKGROUND = '#F8FAFB';

/**
 * How long the opening layout is left to itself before the pane hint appears.
 *
 * Shorter than the pause you actually see: the timer only starts once React has mounted and the
 * first frame is up, and on a cold load that is a second or two on its own. Five seconds here
 * landed at about seven on screen.
 */
const HINT_DELAY_MS = 1000;

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
  const hintOpen = useStore((s) => s.paneHintOpen);
  const dismissPaneHint = useStore((s) => s.dismissPaneHint);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  /**
   * Held back for a moment after the app opens.
   *
   * Arriving with the first frame, the card is one more thing appearing at once and reads as
   * chrome. Coming in after the layout has settled, it reads as something the app is telling you.
   * Restoring the layout before it appears cancels it — whoever found the button already knows.
   */
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // The app opens on ISO alone, so the note belongs on the control that gets you out of it.
  const showHint = waited && hintOpen && maximized;

  return (
    <>
      <Tooltip title={maximized ? 'Back to four views  (Esc)' : `Fill the viewport with ${name}`}>
        <IconButton
          size="small"
          ref={setAnchor}
          onClick={() => toggleMaximized(name)}
          sx={{
            position: 'absolute',
            left: rect.x + rect.width - 34,
            top: rect.y + 4,
            color: showHint ? 'primary.main' : 'secondary.main',
            bgcolor: 'rgba(255,255,255,0.72)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.95)' },
            // A ring while the hint is up, so the sentence has something to point at.
            ...(showHint && {
              boxShadow: `0 0 0 3px ${PALETTE.sky}`,
              bgcolor: 'background.paper',
            }),
          }}
        >
          {maximized ? (
            <CloseFullscreenIcon sx={{ fontSize: 15 }} />
          ) : (
            <OpenInFullIcon sx={{ fontSize: 15 }} />
          )}
        </IconButton>
      </Tooltip>

      <Popper
        open={showHint && Boolean(anchor)}
        anchorEl={anchor}
        placement="bottom-end"
        transition
        modifiers={[{ name: 'offset', options: { offset: [0, 12] } }]}
        sx={{ zIndex: 5 }}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={220}>
            <Paper
              sx={{
                position: 'relative',
                maxWidth: 330,
                p: 1.75,
                borderRadius: 1.5,
                // No border. A border is a line the pointer has to meet exactly, and at a rounded
                // corner it cannot — which is what left a notch here twice. The shadow gives the
                // card its edge instead, and the pointer is simply more of the same paper.
                boxShadow: '0 8px 26px rgba(22, 32, 46, 0.22)',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: -6,
                  // Clear of the corner radius, so the pointer sits on the straight run of the edge.
                  right: 24,
                  width: 14,
                  height: 14,
                  bgcolor: 'background.paper',
                  transform: 'rotate(45deg)',
                  borderRadius: '3px 0 0 0',
                },
              }}
            >
              {/* The wordmark's face: this is the app talking, not another panel label. */}
              <Typography
                sx={{
                  fontFamily: DISPLAY,
                  fontSize: 14.5,
                  fontWeight: 500,
                  lineHeight: 1.55,
                  color: 'text.primary',
                }}
              >
                Minimise ISO with this button to get all four views back: TOP, FRONT and LEFT
                alongside it. Esc does the same.
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={dismissPaneHint}
                  sx={{ py: 0.25, px: 1.75, fontFamily: DISPLAY, fontWeight: 600 }}
                >
                  Got it
                </Button>
              </Box>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
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
        /**
         * The maximised pane is framed at its full size; the rest are framed at the size they
         * will have when they come back. Framing them at the maximised layout's rects would hand
         * them an empty rectangle and leave them unfitted the moment they reappear — which is
         * exactly what happens on startup, where the app opens on ISO alone.
         */
        const width = hostRef.current?.clientWidth ?? 0;
        const height = hostRef.current?.clientHeight ?? 0;
        const maximized = useStore.getState().maximizedView;
        const rect =
          name === maximized
            ? viewportRects(width, height, maximized)[name]
            : viewportRects(width, height)[name];
        if (name === 'ISO') {
          next.ISO =
            fitIso(
              current.ISO,
              points,
              rect.width,
              rect.height,
              FIT_MARGIN,
              vehicleCentre(state.vehicle),
            ) ?? current.ISO;
        } else {
          next[name] =
            fitOrtho(
              ORTHO_DEFS[name],
              points,
              rect.width,
              rect.height,
              FIT_MARGIN,
              // Dead centre, in every pane and in both layouts.
              vehicleCentre(state.vehicle),
            ) ?? current[name];
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
   * Maximising refits the pane, which is the same thing pressing `F` does. Scaling the existing
   * view by the pane's growth instead looked equivalent and was not: the pane doubles while the
   * scaling took the zoom further than that, so a layout already filling its tiled pane spilled
   * over the edges of the big one.
   *
   * Restoring puts the saved view straight back rather than refitting, so the four-up layout
   * returns exactly as it was left however much the maximised pane was moved around. Only that
   * one pane is touched: this is a change of screen area, not a zoom gesture, so `Link zoom` has
   * no say in it.
   */
  const savedView = useRef<{ name: ViewName; view: OrthoViewState | IsoViewState } | null>(null);
  const opening = useRef(true);

  useEffect(() => {
    const previous = maximizedBefore.current;
    maximizedBefore.current = maximizedView;
    const first = opening.current;
    opening.current = false;
    if (!first && previous === maximizedView) return;

    const store = useStore.getState();

    if (previous) {
      if (savedView.current?.name === previous) {
        const saved = savedView.current.view;
        if (previous === 'ISO') store.setIsoView(saved as IsoViewState);
        else store.setOrthoView(previous, saved as OrthoViewState);
      } else {
        // Nothing was put aside — the app opened maximised — so frame it for the pane it returns
        // to rather than leaving it at the zoom the big pane wanted.
        fitPanes(previous);
      }
      savedView.current = null;
    }

    if (!maximizedView) return;

    // The opening layout is where the app starts, not somewhere it was asked to come back to.
    if (!first) {
      savedView.current =
        maximizedView === 'ISO'
          ? { name: 'ISO', view: { ...store.views.ISO } }
          : { name: maximizedView, view: { ...store.views[maximizedView] } };
    }
    fitPanes(maximizedView);
  }, [maximizedView, fitPanes]);

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
