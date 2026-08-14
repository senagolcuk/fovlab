import Box from '@mui/material/Box';
import CoverageReport from './CoverageReport';
import DisplayPanel from './DisplayPanel';
import ShortcutsPanel from './ShortcutsPanel';
import SensorList from './SensorList';
import VehiclePanel from './VehiclePanel';

export const SIDEBAR_WIDTH = 360;

export default function Sidebar() {
  return (
    <Box
      component="aside"
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        // Off-white behind the cards, so each panel reads as a raised surface.
        bgcolor: 'background.default',
        borderRight: 1,
        borderColor: 'divider',
        px: 1.5,
        pt: 1.5,
        pb: 3,
      }}
    >
      <VehiclePanel />
      <DisplayPanel />
      <SensorList />
      <CoverageReport />
      <ShortcutsPanel />
    </Box>
  );
}
