import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import Sidebar from './ui/Sidebar';
import { MONO } from './theme';

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

export default function App() {
  const wideEnough = useMediaQuery(`(min-width:${MIN_WIDTH}px)`);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="static"
        color="inherit"
        sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
      >
        <Toolbar variant="dense" sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ color: 'primary.main' }}>
            Sensor FOV Layout
          </Typography>
          <Typography
            sx={{ fontFamily: MONO, fontSize: 12, color: 'text.secondary' }}
            title="ISO 8855, right-handed. Origin on the ground at the centre of the footprint."
          >
            ISO 8855 · +X forward · +Y left · +Z up
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
        </Toolbar>
      </AppBar>

      {wideEnough ? (
        <Box sx={{ flexGrow: 1, display: 'flex', minHeight: 0 }}>
          <Sidebar />
          <Box sx={{ flexGrow: 1, position: 'relative', minWidth: 0, bgcolor: '#F4F1F7' }} />
        </Box>
      ) : (
        <TooNarrow />
      )}
    </Box>
  );
}
