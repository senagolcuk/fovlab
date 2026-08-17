import { useMemo, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
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
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
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
            sx={{ fontFamily: MONO, fontSize: 10, color: 'text.secondary', whiteSpace: 'nowrap' }}
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
        <Box sx={{ flexGrow: 1, display: 'flex', minHeight: 0 }}>
          {/*
            Collapsed by width rather than unmounted, so the panels slide out of the way and the
            viewports grow into the space instead of everything jumping at once. The content keeps
            its own width throughout, so nothing reflows on the way.
          */}
          <Collapse
            in={sidebarOpen}
            orientation="horizontal"
            timeout={260}
            easing="cubic-bezier(0.4, 0, 0.2, 1)"
            sx={{ height: '100%', flexShrink: 0 }}
          >
            <Box sx={{ display: 'flex', height: '100%' }}>
              <Sidebar />
              <SidebarResizer />
            </Box>
          </Collapse>
          <Box sx={{ flexGrow: 1, position: 'relative', minWidth: 0 }}>
            {/*
              At the top of the divider, straddling the app bar's lower edge.
              Anchored to the viewport area rather than to the sidebar, so it caps the line while
              the panels are open and sits at the window edge once they are not — one element, in
              one place, whichever state it is in. Straddling the bar rather than sitting under it
              keeps it off the TOP pane's own label, and lands it just right of the axis hint,
              which is where the eye already is in this corner.
            */}
            <Tooltip title={sidebarOpen ? 'Hide the panels' : 'Show the panels'}>
              <IconButton
                size="small"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                sx={{
                  position: 'absolute',
                  zIndex: 6,
                  top: 0,
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
                <Stage />
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
