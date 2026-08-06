/**
 * The canvas and the four panes.
 *
 * Pane rectangles come from `core/viewport.ts`, so acceptance test 10 covers the real layout
 * rather than a parallel copy of it. Each pane is a transparent div that owns its own pointer
 * gestures; drei's `<View>` scissors the shared canvas to that div's rectangle.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { View } from '@react-three/drei';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { VIEW_NAMES, viewportRects, type ViewName } from '../core/viewport';
import type { Rect } from '../core/types';
import { useStore, type ViewsState } from '../store/useStore';
import { IsoCamera, OrthoCamera } from './Cameras';
import SceneContent from './SceneContent';
import { usePaneGestures } from './usePaneGestures';
import { AXIS_HINTS, ORTHO_DEFS, fitIso, fitOrtho, sceneBounds, type OrthoName } from './views';
import { MONO } from '../theme';

const BACKGROUND = '#F7F5FA';

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
      }}
    >
      {name === 'ISO' ? <IsoCamera /> : <OrthoCamera name={name as OrthoName} />}
      <SceneContent />
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

  const rects = useMemo(() => viewportRects(size.width, size.height), [size.width, size.height]);

  const fitPanes = useCallback(
    (only?: ViewName) => {
      const state = useStore.getState();
      const points = sceneBounds(state.vehicle, state.sensors, state.catalog);
      const current = state.views;
      const next: ViewsState = { ...current };

      for (const name of VIEW_NAMES) {
        if (only && name !== only) continue;
        const rect = viewportRects(
          hostRef.current?.clientWidth ?? 0,
          hostRef.current?.clientHeight ?? 0,
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

  useEffect(() => {
    if (size.width === 0 || size.height === 0) return;
    if (fitNonce === 0 && fittedOnce.current) return;
    fittedOnce.current = true;
    fitPanes();
  }, [fitNonce, size.width, size.height, fitPanes]);

  const onFitPane = useCallback((name: ViewName) => fitPanes(name), [fitPanes]);

  return (
    <Box
      ref={hostRef}
      sx={{ position: 'absolute', inset: 0, bgcolor: BACKGROUND, overflow: 'hidden' }}
    >
      {size.width > 0 &&
        VIEW_NAMES.map((name, i) => (
          <Pane key={name} name={name} index={i + 1} rect={rects[name]} onFit={onFitPane} />
        ))}

      <Canvas
        eventSource={hostRef as never}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => gl.setClearColor(BACKGROUND)}
        // Views scissor against the canvas rect, so a stale measurement offsets every pane.
        resize={{ scroll: false, debounce: 0 }}
        flat
      >
        <ClearFrame />
        <View.Port />
      </Canvas>

      {/* The canvas is opaque, so the pane separators have to sit above it. */}
      {size.width > 0 && (
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

      {size.width > 0 &&
        VIEW_NAMES.map((name) => <PaneLabel key={name} name={name} rect={rects[name]} />)}
    </Box>
  );
}
