/**
 * The line between the sidebar and the viewports, and the handle for moving it.
 *
 * It is the border rather than something drawn beside it: a separate grab strip would either sit
 * off the line the eye reads as the edge, or cover it. The strip is wider than the hairline it
 * draws so it can actually be caught with a pointer, and the hairline is centred in it.
 *
 * The pointer is captured for the duration, so a fast drag that outruns the element still steers
 * it, and the whole document takes the resize cursor so it does not flicker back to an arrow over
 * whatever the pointer happens to cross.
 */

import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { SIDEBAR_WIDTH_DEFAULT } from '../store/persist';
import { useStore } from '../store/useStore';

/** Wide enough to catch, narrow enough not to feel like a column of its own. */
const GRAB_WIDTH = 7;

export default function SidebarResizer() {
  const setSidebarWidth = useStore((s) => s.setSidebarWidth);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let dragging = false;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      el.setPointerCapture(e.pointerId);
      // Otherwise the drag starts a text selection across the panels behind it.
      e.preventDefault();
      document.body.style.cursor = 'col-resize';
    };

    const onPointerMove = (e: PointerEvent) => {
      // The sidebar starts at the left edge of the window, so the pointer's x *is* the width.
      if (dragging) setSidebarWidth(e.clientX);
    };

    const stop = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      document.body.style.cursor = '';
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', stop);
      el.removeEventListener('pointercancel', stop);
      document.body.style.cursor = '';
    };
  }, [setSidebarWidth]);

  return (
    <Tooltip title="Drag to resize · double-click to reset" enterDelay={700}>
      <Box
        ref={ref}
        onDoubleClick={() => setSidebarWidth(SIDEBAR_WIDTH_DEFAULT)}
        sx={{
          width: `${GRAB_WIDTH}px`,
          flexShrink: 0,
          height: '100%',
          cursor: 'col-resize',
          touchAction: 'none',
          display: 'flex',
          justifyContent: 'center',
          bgcolor: 'transparent',
          '&:hover .line, &:active .line': { bgcolor: 'primary.main', width: '2px' },
        }}
      >
        <Box className="line" sx={{ width: '1px', height: '100%', bgcolor: 'divider' }} />
      </Box>
    </Tooltip>
  );
}
