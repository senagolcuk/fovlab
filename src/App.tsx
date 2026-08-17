import { useEffect, useMemo, useRef, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Stage from './scene/Stage';
import { anchorViewsForViewportGrowth } from './scene/anchorViews';
import { SIDEBAR_HANDLE_WIDTH, SIDEBAR_WIDTH_LIMITS } from './store/persist';
import { hasWebGL2 } from './scene/webgl';
import { useStore } from './store/useStore';
import DeletePrompt from './ui/DeletePrompt';
import ExportDialog from './ui/ExportDialog';
import FullscreenButton from './ui/FullscreenButton';
import Sidebar from './ui/Sidebar';
import SidebarResizer from './ui/SidebarResizer';
import ZoomControls from './ui/ZoomControls';
import { CARD_SHADOW, MONO } from './theme';
import { useKeyboardShortcuts } from './ui/useKeyboardShortcuts';

const MIN_WIDTH = 1280;
/** How long the panels take to slide out of the way. */
const PANEL_SLIDE_MS = 240;

function TooNarrow() {
  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 4,
        textAlign: 'center',
      }}
    >
      <Box>
        <Typography variant="h6">This tool needs a wider window.</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          Four synchronised viewports and a 360 px sidebar do not fit below {MIN_WIDTH} px.
          Widen the window or open it on a desktop.
        </Typography>
      </Box>
    </Box>
  );
}

function NoWebGL() {
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 4,
        textAlign: 'center',
      }}
    >
      <Box sx={{ maxWidth: 460 }}>
        <Typography variant="h6">This tool needs WebGL 2.</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          The four viewports are drawn on the graphics card. Chrome 56, Edge 79, Firefox 51 and
          Safari 15 are new enough. If your browser is newer than that, WebGL or hardware
          acceleration has most likely been switched off in its settings.
        </Typography>
      </Box>
    </Box>
  );
}

export default function App() {
  const wideEnough = useMediaQuery(`(min-width:${MIN_WIDTH}px)`);
  useKeyboardShortcuts();
  const [exportOpen, setExportOpen] = useState(false);
  // Asked once: the answer cannot change while the page is open.
  const webgl = useMemo(hasWebGL2, []);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const sidebarWidth = useStore((s) => s.sidebarWidth);
  const sidebarSpan = useStore((s) => s.sidebarSpan);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);

  /**
   * The only measured quantity on this screen, and it only changes with the window.
   *
   * Everything the sidebar affects is arithmetic from `sidebarSpan` instead, so the panels, the
   * space left for the viewports and the pane tiling inside them all move in one render. Measuring
   * that space instead put it a frame behind whatever moved it, which is what made the drawing
   * wobble through a drag.
   */
  const rowRef = useRef<HTMLDivElement>(null);
  const [row, setRow] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const read = () => setRow({ width: el.clientWidth, height: el.clientHeight });
    const observer = new ResizeObserver(read);
    observer.observe(el);
    read();
    return () => observer.disconnect();
  }, []);

  const viewportWidth = Math.max(0, row.width - sidebarSpan);

  /** Moves the edge and holds the drawing still, in one update. */
  const setSpan = (next: number) => {
    const store = useStore.getState();
    anchorViewsForViewportGrowth(
      Math.max(0, row.width - store.sidebarSpan),
      Math.max(0, row.width - next),
      row.height,
    );
    store.setSidebarSpan(next);
  };

  const onResize = (width: number) => {
    const clamped = Math.min(
      Math.max(width, SIDEBAR_WIDTH_LIMITS[0]),
      SIDEBAR_WIDTH_LIMITS[1],
    );
    if (clamped === useStore.getState().sidebarWidth) return;
    useStore.getState().setSidebarWidth(clamped);
    setSpan(clamped + SIDEBAR_HANDLE_WIDTH);
  };

  /**
   * Sweeps the span rather than transitioning a width in CSS.
   *
   * A CSS transition animates the element and leaves the cameras behind it; sweeping the one
   * number every frame keeps them in step, so the panels slide away and the drawing stays put.
   */
  const tween = useRef<number>();
  const togglePanels = () => {
    const open = !sidebarOpen;
    setSidebarOpen(open);
    const target = open ? sidebarWidth + SIDEBAR_HANDLE_WIDTH : 0;
    const start = useStore.getState().sidebarSpan;
    const began = performance.now();
    if (tween.current) cancelAnimationFrame(tween.current);
    const step = () => {
      const t = Math.min(1, (performance.now() - began) / PANEL_SLIDE_MS);
      // Ease out, so it leaves briskly and arrives softly.
      setSpan(start + (target - start) * (1 - (1 - t) ** 3));
      if (t < 1) tween.current = requestAnimationFrame(step);
    };
    step();
  };
  const linkZoom = useStore((s) => s.linkZoom);
  const setLinkZoom = useStore((s) => s.setLinkZoom);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="static"
        color="inherit"
        sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
      >
        <Toolbar variant="dense" sx={{ gap: 2 }}>
          <Typography
            variant="h6"
            sx={{
              color: 'primary.main',
              fontWeight: 700,
              fontSize: '1.5rem',
              letterSpacing: 0.5,
            }}
          >
            fovlab
          </Typography>
          {/*
            Which way is which, always on screen. Every angle in the sidebar is signed against
            these three, and an engineer reading a layout should never have to remember them or go
            looking. The frame's name is not the useful half, so only the directions are given.
          */}
          <Typography
            sx={{ fontFamily: MONO, fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}
            title="ISO 8855, right-handed. Origin on the ground at the centre of the footprint."
          >
            +X forward · +Y left · +Z up
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={linkZoom}
                onChange={(e) => setLinkZoom(e.target.checked)}
              />
            }
            label="Link zoom"
            slotProps={{ typography: { variant: 'body2' } }}
          />
          <ZoomControls variant="row" />
          <Button
            size="small"
            variant="outlined"
            startIcon={<ImageOutlinedIcon />}
            onClick={() => setExportOpen(true)}
          >
            Export
          </Button>
          <FullscreenButton />
        </Toolbar>
      </AppBar>

      {wideEnough ? (
        <Box ref={rowRef} sx={{ flexGrow: 1, display: 'flex', minHeight: 0 }}>
          {/*
            Clipped to the span rather than transitioned, so the panels slide out of view while
            every frame of the slide is a layout the cameras already agree with.
          */}
          <Box
            sx={{
              width: `${sidebarSpan}px`,
              flexShrink: 0,
              height: '100%',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            <Sidebar />
            <SidebarResizer onResize={onResize} />
          </Box>
          <Box sx={{ flexGrow: 1, position: 'relative', minWidth: 0 }}>
            {/*
              On the divider itself, which is the edge it moves. Anchored to the left of the
              viewport area rather than to the sidebar, so it lands on the line while the panels
              are open and at the window edge once they are not — one element, always reachable,
              never in a different place than last time.
            */}
            <Tooltip title={sidebarOpen ? 'Hide the panels' : 'Show the panels'}>
              <IconButton
                size="small"
                onClick={togglePanels}
                sx={{
                  position: 'absolute',
                  zIndex: 6,
                  // Mid-height rather than at the top, where it landed on the TOP pane's own
                  // label, and a little above the halfway line so it clears LEFT's label too.
                  top: 'calc(50% - 20px)',
                  left: 0,
                  transform: sidebarOpen ? 'translate(-50%, -50%)' : 'translate(0, -50%)',
                  width: 22,
                  height: 22,
                  color: 'secondary.main',
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  boxShadow: CARD_SHADOW,
                  '&:hover': { bgcolor: 'background.paper', borderColor: 'primary.main' },
                }}
              >
                {sidebarOpen ? (
                  <ChevronLeftIcon sx={{ fontSize: 15 }} />
                ) : (
                  <ChevronRightIcon sx={{ fontSize: 15 }} />
                )}
              </IconButton>
            </Tooltip>
            {webgl ? (
              <>
                <Stage width={viewportWidth} height={row.height} />
                <ZoomControls variant="floating" />
              </>
            ) : (
              <NoWebGL />
            )}
          </Box>
        </Box>
      ) : (
        <TooNarrow />
      )}

      <DeletePrompt />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </Box>
  );
}
